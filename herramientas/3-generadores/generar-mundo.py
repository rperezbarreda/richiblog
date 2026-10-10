#!/usr/bin/env python3
# =========================================
# LA WIKI DEL MUNDO
# =========================================
# Convierte la carpeta donde escribes el mundo —una bóveda de Chronicler,
# que son archivos .md de toda la vida— en páginas HTML del sitio.
#
#     wiki/                         lo que escribes (Chronicler apunta aquí)
#         lugares/Valderín.md
#         gente/Apaaka.md
#         imagenes/valderin.webp
#         Mapamundi de Cralëa.cmap   un mapa interactivo
#
#     web/wiki/valderin.html        lo que sale
#     web/wiki/mapa_mapamundi_de_cralea.html   el mapa, en SVG
#     web/wiki/index_wiki.html     la portada, con el índice y el buscador
#     imagenes/wiki/valderin.webp   las imágenes, copiadas
#     datos/wiki/mundo.json               el índice, para el buscador del sitio
#
# CÓMO USARLO
# -----------
#     python herramientas/3-generadores/generar-mundo.py
#     python herramientas/3-generadores/generar-mundo.py --probar
#
# Con --probar no escribe nada: dice lo que haría y canta los avisos, que
# es lo que conviene pasar la primera vez.
#
# LA CARPETA wiki/ ES LA FUENTE Y NO SE TOCA. Esto solo lee de ahí. Lo que
# se escribe a mano es el .md; lo de web/wiki/ se vuelve a hacer entero
# cada vez, así que no tiene sentido editarlo (se pierde al pasar esto).
#
# QUÉ PASA CON LO QUE NO ENTIENDE
# -------------------------------
# No lo adivina: lo deja como está y lo CANTA al terminar, con el nombre
# de la página y la línea. Una conversión que se calla lo que no ha
# entendido es peor que una que falla, porque el agujero aparece meses
# después. Si al pasar esto no sale ningún aviso, lo que hay en la web es
# lo que hay en la bóveda.
#
# LOS ENLACES A PÁGINAS QUE NO EXISTEN no se pierden: salen como texto
# marcado (el "enlace rojo" de las wikis de siempre) y se listan al final,
# que es la lista de lo que falta por escribir.

import argparse
import difflib
import html
import json
import re
import shutil
import sys
import unicodedata
import urllib.parse
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from comun import (RAIZ, es_del_mundo, esta_fuera, wiki_fuera, escribir_json,  # noqa: E402
                   escribir_texto, leer_json, leer_texto,
                   pasar_generadores)
from mundo_formato import (Avisos, Conversor, Guardados,  # noqa: E402
                            leer_frontmatter, partir)
import mundo_mapas  # noqa: E402

VAULT = RAIZ / "wiki"
SALIDA = RAIZ / "web" / "wiki"
IMAGENES = RAIZ / "imagenes" / "wiki"
INDICE = RAIZ / "datos" / "wiki" / "mundo.json"
# Los apartados de la portada: ver clasificar(). Se edita a mano.
CATEGORIAS = RAIZ / "datos" / "wiki" / "mundo-categorias.json"
PLANTILLA = RAIZ / "herramientas" / "plantillas" / "mundo-pagina.html"
PLANTILLA_INDICE = RAIZ / "herramientas" / "plantillas" / "mundo-index.html"
PLANTILLA_MAPA = RAIZ / "herramientas" / "plantillas" / "mundo-mapa.html"
URL = "/web/wiki/"

# Las imágenes que se copian tal cual. WebP es a lo que las pasa
# herramientas/2-imagenes/optimizar-imagenes.py, y lo demás se copia igual
# pero avisando: una wiki con treinta PNG de 4 MB tarda en cargar.
IMAGENES_OK = {".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".avif"}
IMAGENES_PESADAS = {".png", ".jpg", ".jpeg", ".gif"}

# Los mapas interactivos de Chronicler. Lo que hay dentro de un .cmap y
# cómo se pasa a SVG está en mundo_mapas.py.
MAPAS_OK = {".cmap"}

# A cuánto se encogen las imágenes de fondo de un mapa. El mapamundi de
# ejemplo es un PNG de 7680x4320: eso son varios megas que no se ven, porque
# por muy grande que sea la pantalla el mapa se pinta como mucho a dos mil y
# pico píxeles de ancho. Con el zoom al máximo se nota algo de grano, y a
# cambio la página carga. Hace falta Pillow (la misma que
# 2-imagenes/optimizar-imagenes.py); si no está, la imagen se copia tal cual
# y se avisa.
ANCHO_DE_CAPA = 2560

# Los campos del frontmatter que NO son una fila de la infobox: o son el
# título, o dicen cómo pintarla.
APARTE = {"title", "subtitle", "infobox", "image", "layout", "tags"}


def slug(texto):
    plano = "".join(c for c in unicodedata.normalize("NFD", (texto or "").lower())
                    if unicodedata.category(c) != "Mn")
    return re.sub(r"^_+|_+$", "", re.sub(r"[^a-z0-9]+", "_", plano)) or "pagina"


# =========================================
# LEER LA BÓVEDA
# =========================================

def leer_vault():
    """Todas las páginas, imágenes y mapas de wiki/.

    El NOMBRE de una página es el del archivo sin ".md", que es con el que
    se la enlaza desde otra ([[Valderín]]), aunque el frontmatter diga otro
    title. Es lo que hace Chronicler y es lo que hay que respetar: si aquí
    mandara el title, renombrar un archivo rompería enlaces que en la app
    funcionan.
    """
    paginas = {}
    imagenes = {}
    mapas = {}
    # Lo que has elegido dejar fuera (herramientas/wiki-fuera.txt). Solo
    # páginas y mapas: las imágenes se publican si alguna página las usa.
    fuera = wiki_fuera()
    dejadas = []
    for archivo in sorted(VAULT.rglob("*")):
        if not archivo.is_file():
            continue
        # Lo que es de la aplicación y no del mundo: la caché de
        # Chronicler, sus plantillas, lo que empiece por punto. La regla
        # está en comun.py porque la comparten esto y el importador.
        if not es_del_mundo(archivo, VAULT):
            continue
        if (archivo.suffix.lower() in (".md",) + tuple(MAPAS_OK)
                and esta_fuera(archivo.relative_to(VAULT).as_posix(), fuera)):
            dejadas.append(archivo.relative_to(VAULT).as_posix())
            continue
        if archivo.suffix.lower() == ".md":
            nombre = archivo.stem
            if nombre.lower() in paginas:
                print(f"  OJO: hay dos páginas que se llaman «{nombre}».")
                print(f"       {paginas[nombre.lower()]['archivo'].relative_to(VAULT)}")
                print(f"       {archivo.relative_to(VAULT)}")
                print("       Me quedo con la primera; renombra una de las dos.")
                continue
            paginas[nombre.lower()] = {
                "nombre": nombre,
                "archivo": archivo,
                # La carpeta en la que está, que es como se agrupa en el
                # índice: en Chronicler las carpetas SON la organización.
                "carpeta": archivo.parent.relative_to(VAULT).as_posix(),
            }
        elif archivo.suffix.lower() in MAPAS_OK:
            # Un mapa se enlaza por su nombre, igual que una página: desde
            # otro mapa con "targetMap", y desde un artículo con un
            # [[enlace]] de los de siempre.
            nombre = archivo.stem
            if nombre.lower() in mapas:
                print(f"  OJO: hay dos mapas que se llaman «{nombre}».")
                print("       Me quedo con el primero; renombra uno de los dos.")
                continue
            mapas[nombre.lower()] = {
                "nombre": nombre,
                "archivo": archivo,
                "carpeta": archivo.parent.relative_to(VAULT).as_posix(),
            }
        elif archivo.suffix.lower() in IMAGENES_OK:
            # POR LA RUTA ENTERA, no solo por el nombre. En una bóveda de
            # verdad las imágenes están repartidas en carpetas
            # (_imagenes/mapas/, _imagenes/banderas_y_heraldica/…) y
            # Chronicler las nombra a veces por el nombre a secas y a
            # veces con la carpeta delante. Guardadas por ruta se pueden
            # buscar de las dos maneras (ver pedir_imagen).
            imagenes[archivo.relative_to(VAULT).as_posix().lower()] = archivo
    if dejadas:
        print(f"\n  {len(dejadas)} cosa(s) de la bóveda que has dejado fuera"
              " (herramientas/wiki-fuera.txt):")
        for ruta in dejadas[:12]:
            print(f"     {ruta}")
        if len(dejadas) > 12:
            print(f"     … y {len(dejadas) - 12} más.")
        print("  No se publican, y lo que enlace a ellas sale como «sin página».")
    return paginas, imagenes, mapas


# =========================================
# ENCONTRAR UNA IMAGEN
# =========================================
# Esto existe porque al traer la bóveda de verdad no se veía NINGUNA
# imagen, ni la del mapamundi ni la de la ficha de un reino, y las dos
# estaban ahí. Lo que pasaba es que las referencias no vienen como se
# esperaba: una bóveda que guarda las imágenes en _imagenes/mapas/ las
# nombra con la carpeta delante, y en Windows a veces con la barra al
# revés. Así que aquí se busca de varias maneras, de la más exacta a la
# más apañada, y cuando hay que apañarse SE DICE.

def indice_de_imagenes(imagenes):
    """Las mismas imágenes, miradas de tres maneras: por su ruta dentro de
    la bóveda, por su nombre a secas y por el nombre sin la extensión."""
    por_ruta, por_nombre, por_raiz = {}, {}, {}
    for ruta, archivo in sorted(imagenes.items()):
        por_ruta[ruta] = archivo
        por_nombre.setdefault(archivo.name.lower(), archivo)
        por_raiz.setdefault(archivo.stem.lower(), archivo)
    return por_ruta, por_nombre, por_raiz


def _como_lo_pide(nombre):
    """La referencia tal y como viene, puesta de una manera que se pueda
    buscar: las barras del derecho, sin %20 y sin el "./" de delante."""
    texto = str(nombre or "").strip().replace("\\", "/")
    if "%" in texto:
        texto = urllib.parse.unquote(texto)
    texto = texto.lstrip("/")
    while texto.startswith("./"):
        texto = texto[2:]
    return texto.strip()


def pedir_imagen(indices, nombre):
    """Busca una imagen. Devuelve (archivo, apaño), donde apaño es "" si se
    ha encontrado tal cual, o lo que haya habido que hacer para dar con
    ella (que es lo que se canta al terminar)."""
    por_ruta, por_nombre, por_raiz = indices
    pedido = _como_lo_pide(nombre)
    if not pedido:
        return None, ""
    bajo = pedido.lower()
    if bajo in por_ruta:
        return por_ruta[bajo], ""
    suelto = bajo.rsplit("/", 1)[-1]
    if suelto in por_nombre:
        # Pedida con carpeta y encontrada por el nombre, o al revés: es lo
        # normal y no hace falta decir nada, porque es exactamente lo que
        # hace Chronicler al buscarlas.
        return por_nombre[suelto], ""
    # Y lo último: el mismo nombre con otra extensión. Pasa al pasar las
    # imágenes a WebP (optimizar-imagenes.py) sin volver a tocar la página
    # que las nombra. Se usa, pero se dice, porque arreglarlo en la bóveda
    # es un segundo y así no se arrastra.
    raiz = suelto.rsplit(".", 1)[0] if "." in suelto else suelto
    if raiz in por_raiz:
        return por_raiz[raiz], "uso %s" % por_raiz[raiz].name
    return None, ""


def parecidas_a(indices, nombre, cuantas=3):
    """Las imágenes que hay cuyo nombre se parece al que se pide. Es para
    el aviso: «no encuentro X» a secas obliga a ir a mirar la carpeta."""
    por_nombre = indices[1]
    suelto = _como_lo_pide(nombre).lower().rsplit("/", 1)[-1]
    if not suelto or not por_nombre:
        return []
    # Exigente a propósito (0,72): un "parecido" que no se parece hace
    # perder más tiempo del que ahorra.
    return difflib.get_close_matches(suelto, list(por_nombre), cuantas, 0.72)


# =========================================
# LA INFOBOX
# =========================================

def filas_de_la_infobox(datos, convertir):
    """Los campos del frontmatter que salen en la infobox, en el orden en
    que están escritos y con las reglas de "layout" aplicadas.

    layout entiende lo que entiende Chronicler:
        header     un encabezado encima o debajo de un campo
        separator  una raya
        alias      cambiarle el nombre visible a uno o varios campos
        group      poner varios campos en columnas
    """
    reglas = datos.get("layout") or []
    if not isinstance(reglas, list):
        reglas = []

    alias = {}
    encabezados = {"above": {}, "below": {}}
    rayas = {"above": set(), "below": set()}
    grupos = []
    for regla in reglas:
        if not isinstance(regla, dict):
            continue
        tipo = (regla.get("type") or "").strip()
        claves = regla.get("keys")
        claves = claves if isinstance(claves, list) else ([claves] if claves else [])
        if tipo == "alias":
            for c in claves:
                alias[c] = regla.get("text", c)
        elif tipo == "header":
            for donde in ("above", "below"):
                destino = regla.get(donde)
                for c in ([destino] if isinstance(destino, str) else destino or []):
                    encabezados[donde].setdefault(c, []).append(regla.get("text", ""))
        elif tipo == "separator":
            for donde in ("above", "below"):
                destino = regla.get(donde)
                for c in ([destino] if isinstance(destino, str) else destino or []):
                    rayas[donde].add(c)
        elif tipo == "group":
            grupos.append([c for c in claves])

    enGrupo = {c: n for n, g in enumerate(grupos) for c in g}
    filas = []
    puestos = set()
    for clave, valor in datos.items():
        if clave in APARTE or clave in puestos:
            continue
        for texto in encabezados["above"].get(clave, []):
            filas.append({"tipo": "header", "texto": texto})
        if clave in rayas["above"]:
            filas.append({"tipo": "separator"})

        if clave in enGrupo:
            grupo = grupos[enGrupo[clave]]
            columnas = [(alias.get(c, c), datos[c]) for c in grupo if c in datos]
            puestos.update(grupo)
            filas.append({"tipo": "group",
                          "columnas": [(n, convertir(str(v))) for n, v in columnas]})
        else:
            puestos.add(clave)
            filas.append({"tipo": "dato", "nombre": alias.get(clave, clave),
                          "valor": convertir(_como_texto(valor))})

        for texto in encabezados["below"].get(clave, []):
            filas.append({"tipo": "header", "texto": texto})
        if clave in rayas["below"]:
            filas.append({"tipo": "separator"})
    return filas


def _como_texto(valor):
    if isinstance(valor, list):
        return ", ".join(_como_texto(v) for v in valor)
    return str(valor)


def pintar_infobox(datos, filas, imagenes_html):
    if not filas and not imagenes_html and not datos.get("infobox"):
        return ""
    trozos = ['<aside class="mundo-ficha" aria-labelledby="mundo-ficha-titulo">']
    trozos.append('<h2 class="mundo-ficha-titulo" id="mundo-ficha-titulo">%s</h2>'
                  % html.escape(str(datos.get("title") or "Ficha")))
    if imagenes_html:
        trozos.append(imagenes_html)
    if datos.get("infobox"):
        trozos.append('<p class="mundo-ficha-que">%s</p>'
                      % html.escape(str(datos["infobox"])))
    if filas:
        trozos.append('<dl class="mundo-ficha-datos">')
        for fila in filas:
            # Los encabezados y las rayas van envueltos en su <div> igual
            # que los datos: dentro de una <dl>, mezclar <dt> sueltos con
            # <div> que envuelven pares dt/dd no es HTML válido, y un
            # lector de pantalla se pierde la estructura de la lista.
            if fila["tipo"] == "header":
                trozos.append('<div class="mundo-ficha-apartado"><dt>%s</dt><dd></dd></div>'
                              % html.escape(str(fila["texto"])))
            elif fila["tipo"] == "separator":
                trozos.append('<div class="mundo-ficha-raya" aria-hidden="true">'
                              "<dt></dt><dd></dd></div>")
            elif fila["tipo"] == "group":
                for nombre, valor in fila["columnas"]:
                    trozos.append('<div class="mundo-ficha-fila es-columna">'
                                  '<dt>%s</dt><dd>%s</dd></div>'
                                  % (html.escape(str(nombre)), valor))
            else:
                trozos.append('<div class="mundo-ficha-fila"><dt>%s</dt><dd>%s</dd></div>'
                              % (html.escape(str(fila["nombre"])), fila["valor"]))
        trozos.append("</dl>")
    trozos.append("</aside>")
    return "".join(trozos)


def imagenes_de_la_ficha(datos, ruta_de_imagen, avisos):
    """El campo "image": una sola, un carrusel, o un carrusel con pies.

        image: valderin.webp
        image: [dia.webp, noche.webp]
        image: [[dia.webp, "De día"], [noche.webp, "De noche"]]
    """
    crudo = datos.get("image")
    if not crudo:
        return ""
    fotos = []
    for item in (crudo if isinstance(crudo, list) else [crudo]):
        if isinstance(item, list):
            fotos.append((str(item[0]), str(item[1]) if len(item) > 1 else ""))
        else:
            fotos.append((str(item), ""))

    trozos = []
    for nombre, pie in fotos:
        ruta = ruta_de_imagen(nombre.strip())
        if not ruta:
            avisos.di("imagen de la ficha que no encuentro", nombre.strip())
            continue
        alterno = pie or ""
        foto = ('<img class="mundo-ficha-img" src="%s" alt="%s" loading="lazy" decoding="async">'
                % (html.escape(ruta, quote=True), html.escape(alterno, quote=True)))
        if pie:
            foto = "<figure>%s<figcaption>%s</figcaption></figure>" % (foto, html.escape(pie))
        trozos.append('<li class="mundo-ficha-foto">%s</li>' % foto)
    if not trozos:
        return ""
    if len(trozos) == 1:
        return '<div class="mundo-ficha-fotos"><ul>%s</ul></div>' % trozos[0]
    # Varias: salen una debajo de otra y no en un carrusel. Un carrusel es
    # un sitio donde se esconden fotos detrás de un botón que hay que
    # descubrir; en una página que se lee de arriba abajo, verlas todas es
    # mejor y además se imprimen.
    return ('<div class="mundo-ficha-fotos es-varias"><ul>%s</ul></div>'
            % "".join(trozos))


# =========================================
# ARMAR CADA PÁGINA
# =========================================

def poner_slugs(paginas, mapas):
    """El nombre de archivo de cada página y de cada mapa, que es su
    dirección en la web y por tanto lo que no puede repetirse. Los mapas
    llevan "mapa_" delante: así se distinguen de un vistazo en web/wiki/ y
    una página y un mapa con el mismo nombre no se pisan."""
    for ficha in paginas.values():
        ficha["slug"] = slug(ficha["nombre"])
        ficha["url"] = URL + ficha["slug"] + ".html"
    for mapa in mapas.values():
        mapa["slug"] = "mapa_" + slug(mapa["nombre"])
        mapa["url"] = URL + mapa["slug"] + ".html"

    vistos = {}
    for cosa in list(paginas.values()) + list(mapas.values()):
        otro = vistos.get(cosa["slug"])
        if otro:
            print(f"  OJO: «{cosa['nombre']}» y «{otro}» acaban con el mismo")
            print(f"       nombre de archivo ({cosa['slug']}.html) y se pisan.")
            print("       Renombra uno de los dos en la bóveda.")
        vistos[cosa["slug"]] = cosa["nombre"]


def convertir_todo(paginas, imagenes, mapas, avisos_por_pagina):
    """Convierte cada página y devuelve lo que hace falta para escribirlas.
    Se hace en dos vueltas porque una página necesita saber de las demás:
    qué páginas existen (para los enlaces rojos) y quién la enlaza (para
    los backlinks)."""

    def ruta_de_pagina(nombre):
        clave = nombre.strip().lower()
        ficha = paginas.get(clave)
        if ficha:
            return ficha["url"], True
        # Un [[enlace]] también puede llevar a un mapa: en la bóveda un
        # mapa es un archivo con su nombre, como una página.
        mapa = mapas.get(clave)
        if mapa:
            return mapa["url"], True
        return URL + slug(nombre) + ".html", False

    indices = indice_de_imagenes(imagenes)
    # Los avisos son los de la página que se esté convirtiendo en cada
    # momento, y esto se llama desde dentro del conversor: se deja aquí el
    # cuaderno abierto y el bucle de abajo va cambiando de hoja.
    cuaderno = [None]

    def ruta_de_imagen(nombre):
        archivo, apano = pedir_imagen(indices, nombre)
        if archivo is None:
            # Lo de «no la encuentro» ya lo dice el conversor con el
            # nombre que pedía; aquí solo se añade lo que sí hay, cuando
            # se parece a lo que buscaba.
            cerca = parecidas_a(indices, nombre)
            if cerca and cuaderno[0] is not None:
                cuaderno[0].di("lo que más se parece a %s que sí tengo"
                               % _como_lo_pide(nombre), ", ".join(cerca))
            return ""
        if apano and cuaderno[0] is not None:
            cuaderno[0].di("no tengo %s" % _como_lo_pide(nombre), apano)
        return "/imagenes/wiki/" + archivo.name

    # Primera vuelta: leer y convertir.
    for ficha in sorted(paginas.values(), key=lambda f: f["nombre"].lower()):
        avisos = Avisos()
        cuaderno[0] = avisos
        # leer_texto devuelve (texto, era_de_windows); aquí solo
        # importa el texto.
        crudo, _ = leer_texto(ficha["archivo"])
        fm, cuerpo = partir(crudo)
        datos = leer_frontmatter(fm, avisos)

        # Las inserciones se resuelven en la segunda vuelta, cuando ya
        # están convertidas todas: una página puede insertar a otra que
        # todavía no se ha leído. Aquí se deja una marca.
        pendientes = []

        def apunta(nombre, titulo, clases, _p=pendientes):
            _p.append((nombre, titulo, clases))
            return "\ue002%d\ue003" % (len(_p) - 1)

        conversor = Conversor(ruta_de_pagina, ruta_de_imagen, avisos, apunta)
        ficha["cuerpo_html"] = conversor.a_html(cuerpo)
        ficha["pendientes"] = pendientes
        ficha["datos"] = datos
        ficha["titulo"] = str(datos.get("title") or ficha["nombre"]).strip()
        ficha["subtitulo"] = str(datos.get("subtitle") or "").strip()
        ficha["etiquetas"] = [str(e).strip() for e in
                              (datos.get("tags") if isinstance(datos.get("tags"), list)
                               else [datos.get("tags")] if datos.get("tags") else [])
                              if str(e).strip()]
        ficha["enlaces"] = conversor.enlaces
        # La infobox usa el mismo conversor para los valores, porque un
        # campo puede llevar un [[enlace]] dentro.
        chico = Conversor(ruta_de_pagina, ruta_de_imagen, avisos, None)
        ficha["ficha_html"] = pintar_infobox(
            datos,
            filas_de_la_infobox(datos, lambda v: _una_linea(chico, v)),
            imagenes_de_la_ficha(datos, ruta_de_imagen, avisos),
        )
        ficha["enlaces"] += chico.enlaces
        # El resumen para el buscador y para el índice: el primer párrafo,
        # sin etiquetas.
        ficha["resumen"] = _primer_parrafo(ficha["cuerpo_html"])
        ficha["texto"] = _solo_texto(ficha["cuerpo_html"])
        if avisos:
            avisos_por_pagina.append((ficha["nombre"], avisos.lista))

    # Segunda vuelta: los backlinks y las inserciones.
    for ficha in paginas.values():
        ficha["backlinks"] = []
    for ficha in paginas.values():
        for nombre in set(n.strip().lower() for n in ficha["enlaces"]):
            otra = paginas.get(nombre)
            if otra and otra is not ficha:
                # Un apunte y no la ficha entera: a esta lista también se
                # añaden mapas, que no son páginas (ver convertir_mapas).
                otra["backlinks"].append({"titulo": ficha["titulo"],
                                          "url": ficha["url"], "mapa": False})
    for ficha in paginas.values():
        ficha["backlinks"].sort(key=lambda f: f["titulo"].lower())
        ficha["cuerpo_html"] = _resolver_inserciones(ficha, paginas, avisos_por_pagina)
    return paginas


def _una_linea(conversor, valor):
    """Un valor de la infobox: una línea suelta de Markdown. Igual que el
    cuerpo pero sin envolverla en un <p>, y devolviendo los trozos que se
    hayan apartado por el camino (un [[enlace]] dentro de un campo es lo
    normal: "raza: \'[[Elfo|Alto elfo]]\'")."""
    g = Guardados()
    return g.devuelve(conversor._trozos(valor, g))


def _resolver_inserciones(ficha, paginas, avisos_por_pagina):
    texto = ficha["cuerpo_html"]
    # Los valores de la infobox ya vienen con sus marcas devueltas; aquí
    # solo quedan las del cuerpo.
    for n, (nombre, titulo, clases) in enumerate(ficha["pendientes"]):
        otra = paginas.get(nombre.strip().lower())
        if not otra:
            avisos_por_pagina.append(
                (ficha["nombre"], [("inserción de una página que no existe", nombre)]))
            dentro = ('<p class="mundo-falta">No hay ninguna página que se llame «%s».</p>'
                      % html.escape(nombre))
            encabezado = titulo or nombre
        else:
            dentro = otra["cuerpo_html"]
            encabezado = titulo or otra["titulo"]
            # Una inserción dentro de otra se corta aquí: dos páginas que
            # se insertan la una a la otra darían vueltas para siempre.
            dentro = re.sub(r"\ue002\d+\ue003", "", dentro)
        caja = ('<div class="%s"><h2 class="mundo-insercion-titulo">%s</h2>'
                '<div class="mundo-insercion-cuerpo">%s</div></div>'
                % (" ".join(clases), html.escape(str(encabezado)), dentro))
        texto = texto.replace("\ue002%d\ue003" % n, caja)
    return re.sub(r"\ue002\d+\ue003", "", texto)


RE_ETIQUETA = re.compile(r"<[^>]+>")


def _solo_texto(html_hecho):
    return html.unescape(RE_ETIQUETA.sub(" ", html_hecho or ""))


def _primer_parrafo(html_hecho):
    m = re.search(r"<p>(.*?)</p>", html_hecho or "", re.S)
    if not m:
        return ""
    texto = re.sub(r"\s+", " ", _solo_texto(m.group(1))).strip()
    # Quitar las etiquetas deja un espacio donde estaban, y si lo que
    # seguía era un punto o una coma queda "en Valderín ." Se juntan.
    texto = re.sub(r"\s+([,.;:!?)\]»…])", r"\1", texto)
    texto = re.sub(r"([(\[«])\s+", r"\1", texto)
    return texto if len(texto) <= 220 else texto[:217].rstrip() + "…"


# =========================================
# LOS MAPAS
# =========================================
# Un .cmap de Chronicler pasa a una página con el mapa en SVG y, debajo, la
# lista de todo lo que hay dibujado en él. Lo de leer el formato y pintarlo
# está en mundo_mapas.py; aquí se enganchan las dos cosas que solo se saben
# desde el generador: a qué página de la wiki lleva cada región y dónde han
# acabado las imágenes de fondo.

try:
    from PIL import Image
    HAY_PILLOW = True
except ImportError:
    # Igual que en 2-imagenes/optimizar-imagenes.py: Pillow es opcional. Sin
    # ella el mapa funciona, solo que su imagen de fondo se copia tal cual
    # y pesa lo que pese.
    Image = None
    HAY_PILLOW = False


def nombre_de_capa(archivo):
    """Cómo se va a llamar en imagenes/wiki/ la imagen de fondo de un
    mapa. Hay que saberlo ANTES de prepararla, porque es lo que se escribe
    dentro del SVG."""
    if not HAY_PILLOW:
        return archivo.name
    try:
        with Image.open(archivo) as foto:
            cabe = max(foto.size) <= ANCHO_DE_CAPA
    except (OSError, ValueError):
        return archivo.name
    if cabe and archivo.suffix.lower() == ".webp":
        return archivo.name
    return slug(archivo.stem) + ".webp"


def convertir_mapas(mapas, paginas, imagenes, avisos_por_pagina, detalle):
    """Lee los .cmap, los pinta y deja en cada uno lo que hace falta para
    escribir su página. Devuelve las imágenes de fondo que hay que
    preparar: {cómo se va a llamar: el archivo de la bóveda}."""
    capas_por_preparar = {}

    # Primero se leen TODOS y se aparta lo que no se entienda. Hace falta
    # saber qué mapas hay de verdad antes de pintar ninguno, porque una
    # región puede llevar a otro mapa y eso se resuelve al pintar.
    for clave in list(mapas):
        mapa = mapas[clave]
        avisos = Avisos()
        crudo, _ = leer_texto(mapa["archivo"])
        leido = mundo_mapas.leer_cmap(crudo, avisos.di)
        if leido is None:
            avisos_por_pagina.append((mapa["nombre"] + " (mapa)", avisos.lista))
            del mapas[clave]
            continue
        mapa["leido"] = leido
        mapa["avisos"] = avisos

    indices = indice_de_imagenes(imagenes)
    cuaderno = [None]

    def de_imagen(nombre):
        archivo, apano = pedir_imagen(indices, nombre)
        if archivo is None:
            cerca = parecidas_a(indices, nombre)
            if cerca and cuaderno[0] is not None:
                cuaderno[0].di("lo que más se parece a %s que sí tengo"
                               % _como_lo_pide(nombre), ", ".join(cerca))
            return ""
        if apano and cuaderno[0] is not None:
            cuaderno[0].di("no tengo %s" % _como_lo_pide(nombre), apano)
        final = nombre_de_capa(archivo)
        capas_por_preparar[final] = archivo
        return "/imagenes/wiki/" + final

    def de_pagina(nombre):
        ficha = paginas.get(nombre.strip().lower())
        return (ficha["url"], True) if ficha else ("", False)

    def de_mapa(nombre):
        otro = mapas.get(nombre.strip().lower())
        return (otro["url"], True) if otro else ("", False)

    for mapa in sorted(mapas.values(), key=lambda m: m["nombre"].lower()):
        leido, avisos = mapa["leido"], mapa["avisos"]
        cuaderno[0] = avisos
        hecho = mundo_mapas.pintar(leido, de_pagina, de_mapa, de_imagen,
                                   detalle=detalle, avisar=avisos.di)
        mapa["titulo"] = leido["titulo"] or mapa["nombre"]
        mapa["ancho"], mapa["alto"] = leido["ancho"], leido["alto"]
        mapa["svg"] = hecho["svg"]
        mapa["sitios"] = hecho["sitios"]
        mapa["capas"] = hecho["capas"]
        mapa["lista"] = mundo_mapas.pintar_lista(hecho["sitios"])
        # El interruptor de las regiones solo tiene sentido si hay
        # regiones que apagar.
        hay_formas = bool(hecho["dibujo"]) or any(s["tipo"] == "forma" for s in hecho["sitios"])
        hay_pines = any(s["tipo"] == "pin" for s in hecho["sitios"])
        mapa["mandos"] = mundo_mapas.pintar_mandos(hecho["capas"], hay_formas, hay_pines)
        mapa["puntos"] = hecho["puntos"]
        mapa["dibujo"] = hecho["dibujo"]
        mapa["escondidos"] = hecho["escondidos"]
        # Y la silueta del mapa, para la portada de la wiki.
        mapa["vista"] = mundo_mapas.pintar_vista(leido)
        mapa["vista_url"] = "/imagenes/wiki/vista_%s.svg" % mapa["slug"]

        # QUIÉN SALE EN QUÉ MAPA. Una región que lleva a una página es un
        # enlace a esa página, así que el mapa aparece en su "se habla de
        # esto en", igual que cualquier artículo que la mencione. Es la
        # única forma de llegar desde la página al mapa donde está.
        puestos = set()
        for sitio in hecho["sitios"]:
            if sitio["destino"] != "pagina" or not sitio["url"]:
                continue
            clave = sitio["apunta_a"].strip().lower()
            if clave in puestos:
                continue
            puestos.add(clave)
            otra = paginas.get(clave)
            if otra:
                otra["backlinks"].append({"titulo": mapa["titulo"],
                                          "url": mapa["url"], "mapa": True})
        if avisos:
            avisos_por_pagina.append((mapa["nombre"] + " (mapa)", avisos.lista))
    return capas_por_preparar


def preparar_capas(capas, probar):
    """Las imágenes de fondo de los mapas. El mapamundi de ejemplo es un
    PNG de 7680x4320 y varios megas: encogido a 2560 y pasado a WebP pesa
    una fracción y en pantalla no se distingue, porque el mapa nunca se
    pinta más grande que eso.

    Se vuelve a hacer solo si la de la bóveda es más nueva que la que ya
    hay preparada: convertir un PNG de ocho mil píxeles tarda sus segundos
    y no hace falta repetirlo en cada pase."""
    hechas, saltadas, enteras, pesadas = 0, 0, [], []
    for final, archivo in sorted(capas.items()):
        destino = IMAGENES / final
        try:
            if destino.is_file() and destino.stat().st_mtime >= archivo.stat().st_mtime:
                saltadas += 1
                continue
        except OSError:
            pass
        if probar:
            hechas += 1
            continue
        IMAGENES.mkdir(parents=True, exist_ok=True)
        if final == archivo.name:
            # Tal cual: o no hay Pillow, o ya era un WebP del tamaño que
            # toca. Si pesa, se canta al final.
            shutil.copy2(archivo, destino)
            enteras.append(archivo.name)
            hechas += 1
            continue
        try:
            with Image.open(archivo) as foto:
                # El canal de transparencia se conserva: la capa de encima
                # de un mapa suele ser justo eso, un PNG con las fronteras
                # pintadas y el resto transparente.
                foto = foto.convert("RGBA" if "A" in foto.getbands() else "RGB")
                if max(foto.size) > ANCHO_DE_CAPA:
                    foto.thumbnail((ANCHO_DE_CAPA, ANCHO_DE_CAPA), Image.LANCZOS)
                foto.save(destino, "WEBP", quality=82, method=6)
            hechas += 1
        except (OSError, ValueError) as error:
            print(f"  OJO: no he podido preparar {archivo.name}: {error}")
            shutil.copy2(archivo, destino)
            enteras.append(archivo.name)
            hechas += 1
        if destino.is_file() and destino.stat().st_size > 900_000:
            pesadas.append((final, destino.stat().st_size // 1024))
    return hechas, saltadas, enteras, pesadas


def escribir_vistas(mapas, probar):
    """Las siluetas de los mapas, en imagenes/wiki/. Y de paso se llevan
    por delante las de los mapas que ya no estén."""
    escritas = 0
    buenas = set()
    for mapa in mapas.values():
        destino = IMAGENES / Path(mapa["vista_url"]).name
        buenas.add(destino.name)
        if probar:
            continue
        IMAGENES.mkdir(parents=True, exist_ok=True)
        if not destino.is_file() or leer_texto(destino)[0] != mapa["vista"]:
            escribir_texto(destino, mapa["vista"])
            escritas += 1
    if not probar and IMAGENES.is_dir():
        for viejo in IMAGENES.glob("vista_*.svg"):
            if viejo.name not in buenas:
                viejo.unlink()
    return escritas


def escribir_mapas(mapas, probar):
    if not mapas:
        return 0
    molde, _ = leer_texto(PLANTILLA_MAPA)
    escritos = 0
    for mapa in mapas.values():
        cuantos = cuantos_sitios(mapa)
        resumen = resumen_de_mapa(mapa)
        relleno = molde
        for marca, valor in (
            ("{{TITULO}}", html.escape(mapa["titulo"])),
            ("{{DESCRIPCION}}", html.escape(resumen, quote=True)),
            ("{{SLUG}}", mapa["slug"]),
            ("{{MANDOS}}", mapa["mandos"]),
            ("{{MAPA}}", mapa["svg"]),
            ("{{SITIOS}}", mapa["lista"]),
            ("{{CUANTOS}}", "1 sitio" if cuantos == 1 else "%d sitios" % cuantos),
        ):
            relleno = relleno.replace(marca, valor)
        destino = SALIDA / (mapa["slug"] + ".html")
        if not probar and (not destino.is_file() or leer_texto(destino)[0] != relleno):
            escribir_texto(destino, relleno)
            escritos += 1
    return escritos


def cuantos_sitios(mapa):
    """Cuántos sitios hay en el mapa. Por identificador y no por filas de
    la lista: una región que lleva a una página y a otro mapa son dos
    filas, pero un solo sitio."""
    return len({s["id"] for s in mapa["sitios"]})


def resumen_de_mapa(mapa):
    """La línea que lo describe: en la portada del mundo, en el buscador del
    sitio y en la descripción de la página."""
    nombres = list(dict.fromkeys(s["nombre"] for s in mapa["sitios"]))[:8]
    cuantos = cuantos_sitios(mapa)
    if not cuantos:
        return "Mapa de %s." % mapa["titulo"]
    linea = "Mapa con %s: %s" % (
        "1 sitio" if cuantos == 1 else "%d sitios" % cuantos,
        ", ".join(nombres))
    if cuantos > len(nombres):
        linea += "…"
    return linea if len(linea) <= 220 else linea[:217].rstrip() + "…"


# =========================================
# ESCRIBIR
# =========================================

def pintar_etiquetas(etiquetas):
    if not etiquetas:
        return ""
    trozos = ['<p class="mundo-etiquetas"><span class="mundo-etiquetas-label">etiquetas:</span>']
    for e in etiquetas:
        # La etiqueta va codificada para la dirección: una con espacios o
        # con tildes («Mar Ciego», «religión») dejaba una dirección rota
        # que el navegador apañaba como podía.
        trozos.append('<a class="mundo-etiqueta" href="%sindex_wiki.html?cat=%s">%s</a>'
                      % (URL, html.escape(urllib.parse.quote(e), quote=True), html.escape(e)))
    trozos.append("</p>")
    return "".join(trozos)


def pintar_backlinks(ficha):
    if not ficha["backlinks"]:
        return ""
    filas = []
    for o in ficha["backlinks"]:
        # Un mapa se avisa: si no, un nombre suelto en esta lista parece
        # otro artículo y al pulsarlo aparece un dibujo.
        nota = ('<span class="mundo-backlink-nota">mapa</span>'
                if o.get("mapa") else "")
        filas.append('<li><a class="mundo-enlace" href="%s">%s</a>%s</li>'
                     % (html.escape(o["url"], quote=True),
                        html.escape(o["titulo"]), nota))
    return ('<nav class="mundo-backlinks" aria-labelledby="mundo-backlinks-titulo">'
            '<h2 id="mundo-backlinks-titulo">Se habla de esto en</h2><ul>%s</ul></nav>'
            % "".join(filas))


def escribir_paginas(paginas, probar):
    molde, _ = leer_texto(PLANTILLA)
    escritas = 0
    for ficha in paginas.values():
        relleno = molde
        for marca, valor in (
            ("{{TITULO}}", html.escape(ficha["titulo"])),
            ("{{SUBTITULO}}", html.escape(ficha["subtitulo"])),
            ("{{SUBTITULO_BLOQUE}}",
             '<p class="mundo-subtitulo">%s</p>' % html.escape(ficha["subtitulo"])
             if ficha["subtitulo"] else ""),
            ("{{DESCRIPCION}}", html.escape(ficha["resumen"] or ficha["titulo"], quote=True)),
            ("{{SLUG}}", ficha["slug"]),
            ("{{FICHA}}", ficha["ficha_html"]),
            ("{{CUERPO}}", ficha["cuerpo_html"]),
            ("{{ETIQUETAS}}", pintar_etiquetas(ficha["etiquetas"])),
            ("{{BACKLINKS}}", pintar_backlinks(ficha)),
        ):
            relleno = relleno.replace(marca, valor)
        destino = SALIDA / (ficha["slug"] + ".html")
        if not probar and (not destino.is_file() or leer_texto(destino)[0] != relleno):
            escribir_texto(destino, relleno)
            escritas += 1
    return escritas


# =========================================
# LOS APARTADOS DE LA PORTADA
# =========================================
# La portada no se reparte por las carpetas de la bóveda, sino por unos
# apartados grandes —países, lugares, personajes, religión…— y dentro de
# cada uno por las etiquetas que queden. Es lo que hace una wiki: las
# carpetas son cómo tienes guardados los archivos, y eso no tiene por qué
# ser cómo se busca una cosa.
#
# QUIÉN MANDA: datos/wiki/mundo-categorias.json, que se edita a mano. Cada
# página cae en el PRIMER apartado del que lleve alguna etiqueta, y las
# etiquetas que le sobren son las que la reparten por dentro. Lo que no
# caiga en ninguno va a «lo demás», y al terminar se cantan las etiquetas
# que se han quedado fuera de todos los apartados, que es la lista de lo
# que hay que añadir al archivo (o de las que están mal escritas).

LO_DEMAS = "lo demás"


def leer_categorias():
    """Los apartados, como [(nombre, {etiquetas en llano})]. Si el archivo
    no está o no se entiende, se avisa y no se reparte nada: todo va a un
    solo apartado, que es mejor que repartirlo mal."""
    crudo = leer_json(CATEGORIAS, None)
    if not isinstance(crudo, list):
        if CATEGORIAS.is_file():
            print(f"  OJO: {CATEGORIAS.relative_to(RAIZ)} no es una lista;"
                  " no reparto la portada por apartados.")
        return []
    categorias = []
    for uno in crudo:
        if not isinstance(uno, dict):
            continue
        nombre = str(uno.get("nombre") or "").strip()
        etiquetas = uno.get("etiquetas")
        if not nombre or not isinstance(etiquetas, list):
            continue
        categorias.append((nombre, {_llano(e) for e in etiquetas if str(e).strip()}))
    return categorias


def _llano(texto):
    """Para comparar etiquetas sin pelearse con las mayúsculas ni las
    tildes: «País», «pais» y «PAIS» son la misma."""
    return "".join(c for c in unicodedata.normalize("NFD", str(texto or "").strip().lower())
                   if unicodedata.category(c) != "Mn")


def clasificar(etiquetas, categorias):
    """En qué apartado va una página y con qué etiquetas se reparte dentro.
    Devuelve (apartado, [etiquetas que sobran])."""
    suyas = [(e, _llano(e)) for e in etiquetas]
    for nombre, deEsta in categorias:
        if any(llano in deEsta for _, llano in suyas):
            return nombre, [e for e, llano in suyas if llano not in deEsta]
    return LO_DEMAS, [e for e, _ in suyas]


def escribir_indice(paginas, mapas, probar, categorias=()):
    """La portada: el índice por apartados. Las fichas y los botones de
    etiqueta los pinta el navegador con datos/wiki/mundo.json, igual que el
    resto de listados del sitio."""
    fichas = []
    for ficha in sorted(paginas.values(), key=lambda f: f["titulo"].lower()):
        grupo, sub = clasificar(ficha["etiquetas"], categorias)
        fichas.append({
            "titulo": ficha["titulo"],
            "url": ficha["url"],
            # Una página en la raíz de la bóveda: relative_to devuelve ".",
            # y en la portada salía un apartado titulado ".".
            "carpeta": "sin carpeta" if ficha["carpeta"] in ("", ".") else ficha["carpeta"],
            "etiquetas": ficha["etiquetas"],
            # El apartado de la portada y las etiquetas que la reparten
            # dentro de él (ver clasificar).
            "grupo": grupo,
            "sub": sub,
            "que": ficha["subtitulo"] or str(ficha["datos"].get("infobox") or ""),
            "resumen": ficha["resumen"],
        })
    # Los mapas, todos juntos en su apartado y no en la carpeta en la que
    # estén guardados: en la portada se buscan como "los mapas", no como
    # "lo que hay en lugares/".
    for mapa in sorted(mapas.values(), key=lambda m: m["titulo"].lower()):
        grupo, sub = clasificar(["mapa"], categorias)
        fichas.append({
            "titulo": mapa["titulo"],
            "url": mapa["url"],
            "carpeta": "mapas",
            "etiquetas": ["mapa"],
            "grupo": grupo,
            "sub": sub,
            "que": "mapa interactivo",
            # La silueta del mapa: la portada la enseña al lado del índice
            # y lleva a la página del mapa.
            "vista": mapa["vista_url"],
            # SIN RESUMEN a propósito. Lo que cabía poner aquí es la lista
            # de sitios ("Mapa con 18 sitios: Archipiélago de…"), y en la
            # portada eso era un párrafo de nombres sueltos, cortado por la
            # mitad, que no decía nada. La lista entera está en el mapa, que
            # es su sitio. Esto sigue saliendo en la descripción de la
            # página (la que se ve al compartir el enlace), que ahí sí vale.
            "resumen": "",
        })
    # Y en el orden de los apartados, que es el del archivo de
    # categorías: la portada los pinta según van llegando, así que el
    # orden se decide aquí y no en el navegador. «Lo demás» al final.
    orden = {nombre: n for n, (nombre, _) in enumerate(categorias)}
    fichas.sort(key=lambda f: (orden.get(f["grupo"], len(orden)), f["titulo"].lower()))
    if not probar:
        escribir_json(INDICE, fichas)
    return fichas


def copiar_imagenes(imagenes, usadas, probar):
    """Las imágenes que se usan, a imagenes/wiki/.

    TODAS JUNTAS Y SIN CARPETAS, aunque en la bóveda estén repartidas en
    _imagenes/mapas/ y _imagenes/banderas_y_heraldica/: en la web las
    nombran las páginas por el nombre, y una carpeta de más solo sería un
    sitio más donde equivocarse. Lo único que hay que vigilar de hacerlo
    así es que no haya dos que se llamen igual, y eso se canta."""
    copiadas, pesadas, repetidas = 0, [], []
    puestas = {}
    for ruta, archivo in sorted(imagenes.items()):
        if archivo.name.lower() not in usadas:
            continue
        otra = puestas.get(archivo.name.lower())
        if otra is not None and otra != archivo:
            repetidas.append((archivo.name, otra, archivo))
            continue
        puestas[archivo.name.lower()] = archivo
        if archivo.suffix.lower() in IMAGENES_PESADAS and archivo.stat().st_size > 400_000:
            pesadas.append((archivo.name, archivo.stat().st_size // 1024))
        destino = IMAGENES / archivo.name
        if probar:
            continue
        if not destino.is_file() or destino.stat().st_size != archivo.stat().st_size:
            destino.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(archivo, destino)
            copiadas += 1
    return copiadas, pesadas, repetidas


def limpiar_lo_que_sobra(paginas, mapas, probar):
    """Las páginas de web/wiki/ que ya no tienen su .md (o su .cmap): se
    han borrado o renombrado en la bóveda. Se quitan, porque si no se
    quedan colgando en el sitemap y en el buscador."""
    buenos = ({f["slug"] + ".html" for f in paginas.values()}
              | {m["slug"] + ".html" for m in mapas.values()}
              | {"index_wiki.html"})
    sobran = [p for p in SALIDA.glob("*.html") if p.name not in buenos] if SALIDA.is_dir() else []
    if not probar:
        for p in sobran:
            p.unlink()
    return [p.name for p in sobran]


# =========================================
# CONTARLO
# =========================================

def main():
    parser = argparse.ArgumentParser(
        description="Convierte la bóveda de wiki/ en las páginas de web/wiki/.")
    parser.add_argument("--probar", action="store_true",
                        help="no escribe nada: dice lo que haría y canta los avisos")
    parser.add_argument("--detalle", type=float, default=None, metavar="PX",
                        help="cuánto se simplifican los contornos de los mapas, en"
                             " píxeles del lienzo. Si no se dice, una milésima del"
                             " lado largo (3 px en un mapa de 7680); 0 los deja"
                             " enteros y la página pesa el doble")
    args = parser.parse_args()

    if not VAULT.is_dir():
        print(f"\n  No encuentro {VAULT.relative_to(RAIZ)}/.")
        print("  Ahí es donde va el mundo: apunta Chronicler a esa carpeta,")
        print("  o copia dentro la bóveda que ya tengas.\n")
        return 1

    paginas, imagenes, mapas = leer_vault()
    if not paginas and not mapas:
        print(f"\n  {VAULT.relative_to(RAIZ)}/ está, pero no tiene ningún .md dentro.\n")
        return 1

    poner_slugs(paginas, mapas)
    avisos_por_pagina = []
    paginas = convertir_todo(paginas, imagenes, mapas, avisos_por_pagina)
    capas = convertir_mapas(mapas, paginas, imagenes, avisos_por_pagina, args.detalle)
    # Los mapas han añadido backlinks después de que convertir_todo los
    # ordenara, así que se vuelven a ordenar con todo dentro.
    for ficha in paginas.values():
        ficha["backlinks"].sort(key=lambda o: o["titulo"].lower())

    usadas = set()
    for ficha in paginas.values():
        for m in re.finditer(r'/imagenes/wiki/([^"]+)"', ficha["cuerpo_html"] + ficha["ficha_html"]):
            usadas.add(m.group(1).lower())

    SALIDA.mkdir(parents=True, exist_ok=True)
    escritas = escribir_paginas(paginas, args.probar)
    escritos = escribir_mapas(mapas, args.probar)
    escritos += escribir_vistas(mapas, args.probar)
    categorias = leer_categorias()
    fichas = escribir_indice(paginas, mapas, args.probar, categorias)
    copiadas, pesadas, repetidas = copiar_imagenes(imagenes, usadas, args.probar)
    hechas, saltadas, enteras, gordas = preparar_capas(capas, args.probar)
    sobran = limpiar_lo_que_sobra(paginas, mapas, args.probar)

    print(f"\n  {len(paginas)} página(s) en la bóveda"
          + (f" y {len(mapas)} mapa(s)." if mapas else "."))
    if args.probar:
        print("  (--probar: no se ha escrito nada)")
    else:
        print(f"  {escritas} escrita(s) o cambiada(s), {copiadas} imagen(es) copiada(s).")
        if mapas:
            print(f"  {escritos} mapa(s) escrito(s) o cambiado(s)"
                  + (f", {hechas} imagen(es) de fondo preparada(s)" if hechas else "")
                  + (f", {saltadas} que ya estaba(n)" if saltadas else "") + ".")
    if sobran:
        print(f"  {len(sobran)} página(s) que ya no están en la bóveda"
              f"{' (quitadas)' if not args.probar else ''}: {', '.join(sobran[:6])}")

    # LO QUE FALTA POR ESCRIBIR: los enlaces que no llevan a ninguna parte.
    # No es un error: en una wiki a medias es la lista de lo siguiente.
    faltan = {}
    for ficha in paginas.values():
        for nombre in ficha["enlaces"]:
            if nombre.strip().lower() not in paginas and nombre.strip().lower() not in mapas:
                faltan.setdefault(nombre.strip(), []).append(ficha["titulo"])
    # Y lo mismo desde los mapas: una región dibujada que apunta a una
    # página que no está escrita. En un mapa esto es lo normal y es la
    # lista de por dónde seguir.
    for mapa in mapas.values():
        for sitio in mapa["sitios"]:
            if sitio["apunta_a"] and not sitio["url"]:
                nombre = sitio["apunta_a"].strip()
                # Si lo que falta es otro mapa se dice, porque no se
                # arregla escribiendo una página: hay que dibujarlo en
                # Chronicler y volver a traer la bóveda.
                if sitio["destino"] == "mapa":
                    nombre += "  (un mapa)"
                faltan.setdefault(nombre, []).append(mapa["titulo"])
    if faltan:
        print(f"\n  ---- {len(faltan)} cosa(s) enlazada(s) que no existen todavía ----")
        for nombre, desde in sorted(faltan.items(), key=lambda x: -len(x[1]))[:15]:
            print(f"     {nombre}  (desde {', '.join(sorted(set(desde))[:3])})")
        if len(faltan) > 15:
            print(f"     … y {len(faltan) - 15} más.")

    # LAS ETIQUETAS QUE NO SON DE NINGÚN APARTADO. No es un error —una
    # etiqueta suelta reparte bien por dentro—, pero si lo que esperabas
    # era un apartado «religión» y las páginas están en «lo demás», es que
    # falta la etiqueta en datos/wiki/mundo-categorias.json o está escrita de
    # otra manera. Esto es esa lista.
    if categorias:
        sueltas = {}
        for ficha in fichas:
            if ficha["grupo"] != LO_DEMAS:
                continue
            for e in ficha["etiquetas"]:
                sueltas.setdefault(e, []).append(ficha["titulo"])
        cuantas = sum(1 for f in fichas if f["grupo"] == LO_DEMAS)
        if cuantas:
            print(f"\n  {cuantas} página(s) en «{LO_DEMAS}», o sea que no llevan"
                  " ninguna etiqueta de las que reparten.")
            if sueltas:
                print("  Las etiquetas que tienen son éstas; si alguna debería ser un")
                print(f"  apartado, añádela en {CATEGORIAS.relative_to(RAIZ)}:")
                for e, donde in sorted(sueltas.items(), key=lambda x: -len(x[1]))[:10]:
                    print(f"     {e}  ({len(donde)})")

    # LAS PÁGINAS A LAS QUE NO LLEGA NADIE. En una wiki, una página sin
    # backlinks solo se encuentra buscándola.
    huerfanas = [f["titulo"] for f in paginas.values() if not f["backlinks"]]
    if huerfanas:
        print(f"\n  {len(huerfanas)} página(s) a las que no enlaza ninguna otra:")
        print("     " + ", ".join(sorted(huerfanas)[:10])
              + (f" … y {len(huerfanas) - 10} más" if len(huerfanas) > 10 else ""))

    # DOS IMÁGENES QUE SE LLAMAN IGUAL en carpetas distintas. En la
    # bóveda conviven; en imagenes/wiki/ no, porque ahí van todas juntas.
    # La segunda no se copia, así que donde se use saldría la primera: hay
    # que renombrar una de las dos.
    if repetidas:
        print(f"\n  OJO: {len(repetidas)} imagen(es) con el nombre repetido."
              " Solo se publica la primera:")
        for nombre, una, otra in repetidas[:5]:
            print(f"     {nombre}")
            print(f"        se publica  {una.relative_to(VAULT).as_posix()}")
            print(f"        se queda    {otra.relative_to(VAULT).as_posix()}")

    if pesadas:
        print(f"\n  {len(pesadas)} imagen(es) que pesan lo suyo. Pásalas por")
        print("  herramientas/2-imagenes/optimizar-imagenes.py:")
        for nombre, kb in sorted(pesadas, key=lambda x: -x[1])[:6]:
            print(f"     {nombre}  {kb} KB")

    # DOS MAPAS CON EL MISMO NOMBRE DENTRO. Los archivos se llaman distinto
    # —si no, ya se habría avisado al leer la bóveda—, así que los dos se
    # publican, pero en la portada salen dos tarjetas que dicen lo mismo.
    # Le pasó al tener el mapa viejo y el nuevo exportados a la vez.
    titulos = {}
    for mapa in mapas.values():
        titulos.setdefault(mapa["titulo"].strip().lower(), []).append(mapa)
    for cuales in titulos.values():
        if len(cuales) > 1:
            print(f"\n  OJO: {len(cuales)} mapas que se llaman «{cuales[0]['titulo']}»"
                  " por dentro:")
            for mapa in cuales:
                print(f"     {mapa['archivo'].relative_to(VAULT).as_posix()}")
            print("  Los publico los dos, pero en la portada salen dos tarjetas")
            print("  iguales. Si uno es el viejo, bórralo de la bóveda.")

    # LOS MAPAS: cuánto ha quedado de cada uno. El número que importa es
    # el de puntos, porque los contornos van dentro del HTML y son casi
    # toda la página.
    if mapas:
        print(f"\n  ---- los mapas ----")
        for mapa in sorted(mapas.values(), key=lambda m: m["titulo"].lower()):
            antes, despues = mapa["puntos"]
            cuantos = cuantos_sitios(mapa)
            peso = len(mapa["svg"].encode("utf-8")) // 1024
            print(f"     {mapa['titulo']}  ({mapa['ancho']}x{mapa['alto']})")
            print(f"        {cuantos} sitio(s) con nombre, {mapa['dibujo']} forma(s) de dibujo,"
                  f" {len(mapa['capas'])} capa(s)")
            if antes:
                print(f"        {antes} punto(s) en la bóveda -> {despues} en la web"
                      f" ({100 * despues // antes}%), {peso} KB de dibujo")
            if mapa["escondidos"]:
                print(f"        {mapa['escondidos']} pin(es) marcado(s) como invisibles"
                      " en Chronicler: no los publico")
            if not cuantos:
                print("        OJO: ninguna región tiene nombre ni enlace, así que el"
                      " mapa no lleva a ninguna parte.")
        if enteras:
            print(f"\n  {len(enteras)} imagen(es) de fondo copiada(s) tal cual:")
            for nombre in enteras[:4]:
                print(f"     {nombre}")
            if not HAY_PILLOW:
                print("  (no tengo Pillow, así que no puedo encogerlas. Se instala con")
                print("   «pip install Pillow», igual que para optimizar-imagenes.py)")
        if gordas:
            print("\n  Imagen(es) de fondo que siguen pesando lo suyo:")
            for nombre, kb in sorted(gordas, key=lambda x: -x[1])[:4]:
                print(f"     {nombre}  {kb} KB")

    # LO QUE NO HE SABIDO CONVERTIR. Lo último, para que sea lo que quede
    # en pantalla.
    if avisos_por_pagina:
        cuantos = sum(len(l) for _, l in avisos_por_pagina)
        print(f"\n  ---- {cuantos} cosa(s) que no he sabido convertir ----")
        for nombre, lista in avisos_por_pagina:
            print(f"  {nombre}")
            for que, donde in lista:
                print("     " + que + (": " + str(donde) if donde else ""))
        print("\n  Eso sale en la web tal cual está escrito. Si alguna importa,")
        print("  dímelo y la añado al conversor.")
    else:
        print("\n  Todo convertido: no hay nada que no haya entendido.")

    # Y los de detrás, pasados aquí mismo: una wiki nueva son páginas
    # nuevas, y sin ellos no salen en el sitemap, ni en el mapa, ni se
    # encuentran con la lupa, ni llevan sus hojas de estilo. Tardan
    # segundos y olvidarse de uno se nota meses después.
    #
    # No van en GENERADORES (comun.py) a propósito: esa lista la pasan
    # nuevo.py y publicar.py cada vez que se escribe una entrada del blog,
    # y convertir la wiki entera al publicar un relato no tiene sentido.
    # SIEMPRE, y no solo cuando ha cambiado algo. Antes iba con un "si he
    # escrito algo", y eso dejaba un agujero que se tragó la página de un
    # mapa entera: las páginas se escriben con la cabecera de la PLANTILLA,
    # que no lleva las hojas de estilo que toquen —eso lo escribe
    # actualizar-cabeceras.py después—, así que una página recién escrita
    # está a medias hasta que pasa el de detrás. Si por lo que sea no pasa
    # (porque la vez siguiente ya "no ha cambiado nada"), la página se
    # queda sin estilos para siempre y nada vuelve a tocarla: el mapa salía
    # con la hoja de las recomendaciones puesta.
    #
    # Pasarlos siempre cuesta un par de segundos y no puede salir mal: los
    # cuatro miran lo que hay y solo escriben lo que de verdad cambia.
    if not args.probar:
        print()
        pasar_generadores((
            "3-generadores/generar-sitemap.py",
            "3-generadores/generar-mapa.py",
            "3-generadores/generar-buscador.py",
            "3-generadores/actualizar-cabeceras.py",
        ))
    else:
        print("\n  Al pasarlo de verdad, detrás van solos el sitemap, el mapa,")
        print("  el buscador y las cabeceras.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
