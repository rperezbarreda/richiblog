#!/usr/bin/env python3
# =========================================
# LA WIKI DEL MUNDO
# =========================================
# Convierte la carpeta donde escribes el mundo —archivos .md de toda la
# vida, escritos a mano (empezó siendo una bóveda de Chronicler, y por eso
# entiende su formato)— en páginas HTML del sitio.
#
#     wiki/                         lo que escribes
#         lugares/Valderín.md       (nueva-pagina-wiki.py los empieza)
#         gente/Apaaka.md
#         _imagenes/valderin.webp
#         Mapamundi de Cralëa.cmap   el mapa interactivo, de Chronicler
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
import mundo_piezas  # noqa: E402

from comun import (RAIZ, es_del_mundo, esta_fuera, wiki_fuera, escribir_json,
                   limpiar_comentarios_html,  # noqa: E402
                   escribir_texto, leer_json, leer_texto,
                   pasar_generadores)
from mundo_formato import (Avisos, Conversor, Guardados,  # noqa: E402
                            leer_frontmatter, partir)
import mundo_mapas  # noqa: E402
# La línea de tiempo: sus eventos se enlazan desde la bóveda ([[La Gran
# Sequía]]) como si fueran páginas, y al revés. Lo suyo está ahí.
import mundo_linea  # noqa: E402
# Los mapas de situación de cada país (un recorte del mapa con él resaltado).
import mundo_situacion  # noqa: E402

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
APARTE = {"title", "subtitle", "infobox", "image", "layout", "tags",
          # La bandera y el blasón van arriba de la ficha, en su hueco (ver
          # emblemas_de_la_ficha), no como una fila más.
          "bandera", "blasón", "blason", "escudo"}


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
    # LOS CAMPOS VACÍOS NO SALEN. Las plantillas de página
    # (wiki/_system/templates/) traen la ficha entera con los campos sin
    # rellenar, y una ficha con doce filas en blanco no dice nada. El
    # encabezado de un tramo cuyo primer campo está vacío no se pierde: se
    # queda esperando al siguiente campo que tenga algo, salvo que ese
    # traiga su propio encabezado (entonces el tramo de antes estaba
    # vacío entero y su título sobra).
    pendientes = []
    for clave, valor in datos.items():
        if clave in APARTE or clave in puestos:
            continue
        if clave in enGrupo:
            vacio = all(_esta_vacio(datos.get(c)) for c in grupos[enGrupo[clave]])
        else:
            vacio = _esta_vacio(valor)
        propios = encabezados["above"].get(clave, [])
        if vacio:
            if propios:
                pendientes = list(propios)
            continue
        for texto in (propios or pendientes):
            filas.append({"tipo": "header", "texto": texto})
        pendientes = []
        if clave in rayas["above"]:
            filas.append({"tipo": "separator"})

        if clave in enGrupo:
            grupo = grupos[enGrupo[clave]]
            columnas = [(alias.get(c, c), datos[c]) for c in grupo
                        if c in datos and not _esta_vacio(datos[c])]
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


def _esta_vacio(valor):
    if valor is None:
        return True
    if isinstance(valor, list):
        return all(_esta_vacio(v) for v in valor)
    texto = str(valor).strip()
    # Un enlace sin nada dentro («[[]]») es un hueco de plantilla.
    return not texto or texto in ("[[]]", "''", '""')


def _como_texto(valor):
    if isinstance(valor, list):
        return ", ".join(_como_texto(v) for v in valor)
    return str(valor)


def pintar_infobox(datos, filas, imagenes_html, emblemas_html=""):
    # Sin nada que enseñar no hay ficha, aunque diga qué es («infobox»): un
    # recuadro con «Personaje» y nada debajo es lo que deja una plantilla
    # recién creada, y no dice nada.
    if not filas and not imagenes_html and not emblemas_html:
        return ""
    # role="note": es información al margen del artículo. Un <aside> a
    # secas dentro de <main> es una región complementaria anidada, y las
    # complementarias tienen que ir al nivel de arriba (axe, WAI-ARIA).
    trozos = ['<aside class="mundo-ficha" role="note" aria-labelledby="mundo-ficha-titulo">']
    # La bandera y el blasón, ARRIBA DEL TODO, como en las wikis de países.
    if emblemas_html:
        trozos.append(emblemas_html)
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


# Dónde va la bandera en la ficha mientras falta el mapa de situación,
# que se dibuja después de convertir las páginas (preparar_situaciones
# necesita la «región» de cada ficha). La cambia poner_emblemas.
MARCA_EMBLEMAS = "\ue010emblemas\ue011"


def emblemas_de_la_ficha(datos, ruta_de_imagen, avisos, titulo):
    """LA BANDERA Y EL BLASÓN de una página:

        bandera: reino_prunia.webp
        blasón: reino_prunia_blason.webp      (o blason:, o escudo:)

    Devuelve ([(nombre, dirección, alt)], dirección de la bandera o ""). La
    bandera la usa también la portada, junto al nombre de cada país."""
    cuales = []
    for nombre, claves in (("Bandera", ("bandera",)),
                           ("Blasón", ("blasón", "blason", "escudo"))):
        valor = next((datos.get(c) for c in claves if datos.get(c)), None)
        if not valor:
            continue
        ruta = ruta_de_imagen(str(valor).strip())
        if not ruta:
            avisos.di("%s que no encuentro" % nombre.lower(), str(valor).strip())
            continue
        cuales.append((nombre, ruta, "%s de %s" % (nombre, titulo)))
    bandera = next((r for n, r, _ in cuales if n == "Bandera"), "")
    return cuales, bandera


def poner_emblemas(ficha, situacion):
    """Cambia la marca de la ficha por su carrusel: la bandera, el blasón
    y el MAPA DE SITUACIÓN, en el mismo hueco, arriba del todo. Con más de
    uno, scripts/paginas/mundo.js pone flechas para pasar de uno a otro
    (sin JavaScript salen todos, uno debajo de otro). El mapa entra
    siempre que lo haya: es el único sitio donde sale (el artículo ya no
    lo lleva a lo grande)."""
    cuales = list(ficha.get("emblemas") or [])
    if situacion:
        url, titulo_pagina, mapa_titulo, _, pulsar = situacion
        cuales.append(("Mapa", url, "Mapa de situación: %s resaltado en el %s"
                       % (titulo_pagina, mapa_titulo), pulsar))
    trozos = []
    for nombre, ruta, alt, *resto in cuales:
        # El mapa lleva además dónde están sus países para pulsar: al
        # ampliarlo, cada vecino lleva a su página (ver mundo.js).
        extra = (' data-mundo-pulsar="%s"' % html.escape(resto[0], quote=True)) if resto else ""
        trozos.append(
            '<li class="mundo-emblema" data-mundo-emblema="%s"%s><figure>'
            '<img class="mundo-emblema-img" src="%s" alt="%s" loading="lazy" decoding="async">'
            '<figcaption>%s</figcaption></figure></li>'
            % (html.escape(nombre, quote=True), extra, html.escape(ruta, quote=True),
               html.escape(alt, quote=True), html.escape(nombre)))
    html_ = ('<div class="mundo-emblemas" data-mundo-emblemas><ul class="mundo-emblemas-lista">%s</ul></div>'
             % "".join(trozos)) if trozos else ""
    if not html_ and ficha.get("ficha_vacia"):
        ficha["ficha_html"] = ""
        return
    ficha["ficha_html"] = ficha["ficha_html"].replace(MARCA_EMBLEMAS, html_)


def imagenes_de_la_ficha(datos, ruta_de_imagen, avisos):
    """El campo "image": una sola, un carrusel, o un carrusel con pies.

        image: valderin.webp
        image: [dia.webp, noche.webp]
        image: [[dia.webp, "De día"], [noche.webp, "De noche"]]
    """
    crudo = datos.get("image")
    fotos = []
    if not crudo:
        crudo = []
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
    # EN LAS MISMAS CARPETAS QUE EN LA BÓVEDA: wiki/Mapamundi/Azarasia/
    # Reino de Prunia.md sale en web/wiki/mapamundi/azarasia/
    # reino_de_prunia.html. Cada trozo del camino pasa por slug(), igual que
    # el nombre: sin tildes ni espacios, que es como van las direcciones.
    def _carpeta(cosa):
        trozos = [slug(t) for t in str(cosa.get("carpeta") or "").split("/")
                  if t not in ("", ".")]
        return "/".join(trozos) + "/" if trozos else ""

    for ficha in paginas.values():
        ficha["slug"] = _carpeta(ficha) + slug(ficha["nombre"])
        ficha["url"] = URL + ficha["slug"] + ".html"
    for mapa in mapas.values():
        mapa["slug"] = _carpeta(mapa) + "mapa_" + slug(mapa["nombre"])
        mapa["url"] = URL + mapa["slug"] + ".html"

    vistos = {}
    for cosa in list(paginas.values()) + list(mapas.values()):
        otro = vistos.get(cosa["slug"])
        if otro:
            print(f"  OJO: «{cosa['nombre']}» y «{otro}» acaban con el mismo")
            print(f"       nombre de archivo ({cosa['slug']}.html) y se pisan.")
            print("       Renombra uno de los dos en la bóveda.")
        vistos[cosa["slug"]] = cosa["nombre"]


def convertir_todo(paginas, imagenes, mapas, avisos_por_pagina, eventos=None):
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
        # Y a un evento de la línea de tiempo, por su nombre.
        evento = (eventos or {}).get(clave)
        if evento:
            return evento["url"], True
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
        ficha["emblemas"], ficha["bandera_url"] = emblemas_de_la_ficha(
            datos, ruta_de_imagen, avisos, str(datos.get("title") or ficha["nombre"]))
        filas = filas_de_la_infobox(datos, lambda v: _una_linea(chico, v))
        fotos = imagenes_de_la_ficha(datos, ruta_de_imagen, avisos)
        # Una marca SIEMPRE: el carrusel lleva el mapa de situación, que aún
        # no está (ver poner_emblemas), y una región sin bandera también lo
        # lleva. Si al final no hay nada que poner y la ficha no tenía nada
        # más, se quita entera (ficha_vacia).
        ficha["ficha_vacia"] = not pintar_infobox(datos, filas, fotos)
        ficha["ficha_html"] = pintar_infobox(datos, filas, fotos, MARCA_EMBLEMAS)

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


def regiones_de(paginas):
    """QUÉ PAÍS ES DE QUÉ REGIÓN, según las fichas de las páginas: el campo
    «región» ([[Partaria]]). {nombre en minúsculas: región en minúsculas}.
    Lo usan el mapa (qué formas son regiones), los mapas de situación (qué
    regiones llevan miniatura) y la portada (los países, bajo su región)."""
    salida = {}
    for ficha in paginas.values():
        datos = ficha.get("datos") or {}
        valor = datos.get("región") or datos.get("region")
        if not valor:
            continue
        nombre = re.sub(r"^\[\[|\]\]$", "", str(valor).strip()).split("|")[0].strip()
        if nombre:
            salida[ficha["nombre"].strip().lower()] = nombre.lower()
    return salida


def subrazas_de(paginas):
    """QUÉ SUBRAZA ES DE QUÉ RAZA, como en D&D (elfos altos, drow, elfos
    del bosque… son elfos): el campo «subraza de» ([[Elfos]]) de la ficha.
    {subraza en minúsculas: raza en minúsculas}. Lo usan la página de la
    raza (su lista de subrazas), las migas y la portada.

    Va con su propio campo y no con «raza» porque «raza» lo lleva también
    la ficha de un personaje, y un personaje no es una subraza."""
    salida = {}
    for ficha in paginas.values():
        datos = ficha.get("datos") or {}
        valor = datos.get("subraza de")
        if not valor:
            continue
        nombre = re.sub(r"^\[\[|\]\]$", "", str(valor).strip()).split("|")[0].strip()
        if nombre and nombre.lower() in paginas:
            salida[ficha["nombre"].strip().lower()] = nombre.lower()
    return salida


def lista_de_subrazas(ficha, paginas, subraza_de):
    """LAS SUBRAZAS DE UNA RAZA, sacadas de las fichas de las subrazas (no
    de lo que haya escrito en la página de la raza): cada una con su
    enlace y su primera frase. "" si no tiene ninguna."""
    suya = ficha["nombre"].strip().lower()
    hijas = sorted((f for f in paginas.values()
                    if subraza_de.get(f["nombre"].strip().lower()) == suya),
                   key=lambda f: f["titulo"].lower())
    if not hijas:
        return ""
    trozos = []
    for f in hijas:
        que = (f.get("resumen") or "").strip()
        trozos.append('<li><a class="mundo-subraza-nombre" href="%s">%s</a>%s</li>'
                      % (html.escape(f["url"], quote=True), html.escape(f["titulo"]),
                         ('<span class="mundo-subraza-que">%s</span>' % html.escape(que)) if que else ""))
    return '<ul class="mundo-subrazas">%s</ul>' % "".join(trozos)


def con_subrazas(cuerpo, lista):
    """Pone la lista en el apartado «Subrazas» del artículo (detrás de lo
    que haya escrito en él); si no lo hay, lo añade detrás de la
    entradilla, antes del primer apartado: es lo primero que se busca en
    la página de una raza."""
    if not lista:
        return cuerpo
    titulo = '<h2 id="subrazas">Subrazas</h2>'
    if titulo in cuerpo:
        despues = cuerpo.index(titulo) + len(titulo)
        siguiente = cuerpo.find("<h2", despues)
        punto = siguiente if siguiente != -1 else len(cuerpo)
        return cuerpo[:punto] + lista + "\n" + cuerpo[punto:]
    primero = cuerpo.find("<h2")
    bloque = titulo + "\n" + lista + "\n"
    if primero == -1:
        return cuerpo + "\n" + bloque
    return cuerpo[:primero] + bloque + cuerpo[primero:]


def con_banderas_en_el_mapa(svg, paginas):
    """A cada país del mapa que lleve a una página con bandera, la
    dirección de esa bandera en data-mapa-bandera: mundo-mapa.js la enseña
    en el globo al pasar el ratón por encima, junto al nombre."""
    banderas = {f["url"]: f.get("bandera_url") for f in paginas.values() if f.get("bandera_url")}
    if not banderas:
        return svg

    def poner(m):
        bandera = banderas.get(html.unescape(m.group(2)))
        if not bandera:
            return m.group(0)
        return m.group(0) + ' data-mapa-bandera="%s"' % html.escape(bandera, quote=True)

    return re.sub(r'<a class="mapa-forma([^"]*)" href="([^"]+)"', poner, svg)


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

    # QUÉ PAÍS ES DE QUÉ REGIÓN: con eso el mapa sabe qué formas son
    # regiones y cuáles países (ver niveles() en mundo_mapas.py).
    region_de = regiones_de(paginas)

    for mapa in sorted(mapas.values(), key=lambda m: m["nombre"].lower()):
        leido, avisos = mapa["leido"], mapa["avisos"]
        cuaderno[0] = avisos
        hecho = mundo_mapas.pintar(leido, de_pagina, de_mapa, de_imagen,
                                   detalle=detalle, avisar=avisos.di,
                                   region_de=region_de)
        mapa["titulo"] = leido["titulo"] or mapa["nombre"]
        mapa["ancho"], mapa["alto"] = leido["ancho"], leido["alto"]
        mapa["svg"] = con_banderas_en_el_mapa(hecho["svg"], paginas)
        mapa["sitios"] = hecho["sitios"]
        mapa["capas"] = hecho["capas"]
        mapa["lista"] = mundo_mapas.pintar_lista(hecho["sitios"])
        # El interruptor de las regiones solo tiene sentido si hay
        # regiones que apagar.
        hay_formas = bool(hecho["dibujo"]) or any(s["tipo"] == "forma" for s in hecho["sitios"])
        hay_pines = any(s["tipo"] == "pin" for s in hecho["sitios"])
        mapa["mandos"] = mundo_mapas.pintar_mandos(hecho["capas"], hay_formas, hay_pines,
                                                   hecho.get("niveles", False))
        mapa["puntos"] = hecho["puntos"]
        mapa["dibujo"] = hecho["dibujo"]
        mapa["escondidos"] = hecho["escondidos"]
        # Y la silueta del mapa, para la portada de la wiki.
        mapa["vista"] = mundo_mapas.pintar_vista(leido, region_de=region_de)
        mapa["vista_url"] = "/imagenes/wiki/vista_%s.svg" % mapa["slug"].replace("/", "_")

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
    # Sin los comentarios de la plantilla: estas páginas salen publicadas.
    molde = limpiar_comentarios_html(molde)[0]
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
        destino.parent.mkdir(parents=True, exist_ok=True)
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
        # Lleva a la portada con la etiqueta buscada (allí ya no hay
        # botones de etiquetas, pero el buscador mira las etiquetas de cada
        # página). Va codificada para la dirección: una con espacios o
        # con tildes («Mar Ciego», «religión») dejaba una dirección rota
        # que el navegador apañaba como podía.
        trozos.append('<a class="mundo-etiqueta" href="%sindex_wiki.html?buscar=%s">%s</a>'
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
        nota = ('<span class="mundo-backlink-nota">mapa</span>' if o.get("mapa")
                else '<span class="mundo-backlink-nota">evento</span>' if o.get("evento")
                else "")
        filas.append('<li><a class="mundo-enlace" href="%s">%s</a>%s</li>'
                     % (html.escape(o["url"], quote=True),
                        html.escape(o["titulo"]), nota))
    return ('<nav class="mundo-backlinks" aria-labelledby="mundo-backlinks-titulo">'
            '<h2 id="mundo-backlinks-titulo">Se habla de esto en</h2><ul>%s</ul></nav>'
            % "".join(filas))


# =========================================
# LA NAVEGACIÓN DE CADA ENTRADA
# =========================================
# Como en una wiki de las de siempre: arriba, DÓNDE ESTÁS (Wiki Cralëa ›
# Mapamundi › Azarasia › Islas de Labros › Corte de Labros), y al lado del
# artículo, debajo de la ficha, el CONTENIDO de la página con un enlace a
# cada apartado.

def pintar_migas(ficha, paginas, region_de):
    """El camino hasta la página, por sus regiones: la «región» de su
    ficha, la región de esa, etc. Lo de arriba del todo lo pone su carpeta
    de la bóveda (Mapamundi/<parte>): una parte sin página propia
    (Archipiélagos) lleva a su apartado de la portada."""
    portada = URL + "index_wiki.html"
    cadena = []
    vista = {ficha["nombre"].strip().lower()}
    # Una subraza cuelga de su raza igual que un país de su región.
    # Y lo que «pertenece a» algo (un Heraldo, al panteón), igual.
    raza = (subrazas_de(paginas).get(ficha["nombre"].strip().lower())
            or mundo_piezas.padres_de_jerarquia(paginas).get(ficha["nombre"].strip().lower()))
    if raza:
        region_de = dict(region_de)
        region_de[ficha["nombre"].strip().lower()] = raza
        # Y su camino hacia arriba, si lo de arriba también pertenece a algo.
        for hija, madre in mundo_piezas.padres_de_jerarquia(paginas).items():
            region_de.setdefault(hija, madre)
    clave = region_de.get(ficha["nombre"].strip().lower())
    while clave and clave not in vista and clave in paginas:
        vista.add(clave)
        cadena.insert(0, paginas[clave])
        clave = region_de.get(clave)
    migas = [("Wiki Cralëa", portada)]
    parte = _parte_de(ficha["carpeta"])
    if parte:
        migas.append(("Mapamundi", portada + "#mundo-regiones-titulo"))
        arriba = cadena[0] if cadena else ficha
        if _llano(arriba["nombre"]) != _llano(parte):
            # Las regiones no siempre dicen de qué parte son (Islas de
            # Labros no lleva «región»): la parte sale de la carpeta. Con
            # página, a su página; sin ella (Archipiélagos), a su apartado
            # de la lista de la portada (el id lo pone idDeSubMundo en
            # mundo.js: "mundo-" + el nombre sin tildes).
            suya = paginas.get(parte.lower())
            migas.append((suya["titulo"], suya["url"]) if suya
                         else (parte, portada + "#mundo-" + slug(parte).replace("_", "-")))
    for otra in cadena:
        migas.append((otra["titulo"], otra["url"]))
    trozos = ['<li><a href="%s">%s</a></li>' % (html.escape(u, quote=True), html.escape(t))
              for t, u in migas]
    trozos.append('<li aria-current="page">%s</li>' % html.escape(ficha["titulo"]))
    # Un <div> con role y no un <nav>: barra-lateral.css le pone a todo
    # <nav> (y a sus enlaces) el aspecto del menú, columna incluida.
    return ('<div class="mundo-migas" role="navigation" aria-label="Dónde estás">'
            '<ol>%s</ol></div>' % "".join(trozos))


def pintar_contenido(cuerpo, con_backlinks):
    """El índice de la página: cada encabezado del artículo (los h3,
    dentro del h2 de encima) y «se habla de esto en».
    Con menos de dos cosas no sale: un índice de una línea no ayuda."""
    entradas = []
    for m in re.finditer(r'<h([23]) id="([^"]+)">(.*?)</h\1>', cuerpo, re.S):
        texto = html.unescape(re.sub(r"<[^>]+>", "", m.group(3))).strip()
        if texto:
            entradas.append((int(m.group(1)), m.group(2), texto))
    if con_backlinks:
        entradas.append((2, "mundo-backlinks-titulo", "Se habla de esto en"))
    if len(entradas) < 2:
        return ""
    trozos, abierta = [], False
    for nivel, ancla, texto in entradas:
        enlace = '<a href="#%s">%s</a>' % (html.escape(ancla, quote=True), html.escape(texto))
        if nivel == 3 and trozos:
            if not abierta:
                # Dentro del último h2: se reabre su <li>.
                trozos[-1] = trozos[-1][:-len("</li>")] + "<ol>"
                abierta = True
            trozos.append("<li>%s</li>" % enlace)
            continue
        if abierta:
            trozos.append("</ol></li>")
            abierta = False
        trozos.append("<li>%s</li>" % enlace)
    if abierta:
        trozos.append("</ol></li>")
    # <div> con role, no <nav>: lo mismo que las migas (pintar_migas). Y
    # dentro un <details>, para poder plegarlo (lo recuerda mundo.js).
    return ('<div class="mundo-contenido" role="navigation" aria-labelledby="mundo-contenido-titulo">'
            '<details class="mundo-contenido-plegable" open data-mundo-contenido>'
            '<summary class="mundo-contenido-cabecera">'
            '<span class="mundo-sub-flecha" aria-hidden="true">▾</span>'
            '<h2 class="mundo-contenido-titulo" id="mundo-contenido-titulo">Contenido</h2></summary>'
            '<ol>%s</ol></details></div>' % "".join(trozos))


def rejilla_de_paises(ficha, paginas, region_de):
    """LOS PAÍSES DE UNA REGIÓN, en la rejilla de banderas de la portada (la
    bandera grande y el nombre debajo; las mismas clases, así que se ven
    igual). Salen de la «región» de cada ficha, no de la lista que haya
    escrita en el .md: así no se queda atrás si un país cambia de sitio.
    "" si no es región de nadie."""
    suya = ficha["nombre"].strip().lower()
    hijos = sorted((f for f in paginas.values()
                    if region_de.get(f["nombre"].strip().lower()) == suya and f is not ficha),
                   key=lambda f: f["titulo"].lower())
    if not hijos:
        return ""
    trozos = []
    for f in hijos:
        bandera = f.get("bandera_url")
        dibujo = ('<img class="mundo-item-bandera" src="%s" alt="" width="150" height="100"'
                  ' loading="lazy" decoding="async">' % html.escape(bandera, quote=True)
                  if bandera else
                  '<span class="mundo-item-bandera es-hueco" aria-hidden="true"></span>')
        trozos.append('<li class="mundo-ficha-item"><a class="mundo-item" href="%s">%s'
                      '<strong class="mundo-item-titulo">%s</strong></a></li>'
                      % (html.escape(f["url"], quote=True), dibujo, html.escape(f["titulo"])))
    return '<ul class="mundo-items es-corta">%s</ul>' % "".join(trozos)


def con_rejilla_de_paises(cuerpo, rejilla):
    """Pone la rejilla en el apartado «Países» del artículo, en lugar de la
    lista que hubiera; si no hay apartado, lo añade al final."""
    if not rejilla:
        return cuerpo
    titulo = '<h2 id="paises">Países</h2>'
    m = re.search(re.escape(titulo) + r"\s*<ul>.*?</ul>", cuerpo, re.S)
    if m:
        return cuerpo[:m.start()] + titulo + "\n" + rejilla + cuerpo[m.end():]
    if titulo in cuerpo:
        return cuerpo.replace(titulo, titulo + "\n" + rejilla, 1)
    return cuerpo + "\n" + titulo + "\n" + rejilla


DICCIONARIO = RAIZ / "datos" / "wiki" / "diccionario.json"


def leer_diccionario():
    datos = leer_json(DICCIONARIO, {}) or {}
    palabras = datos.get("palabras") if isinstance(datos, dict) else datos
    return [p for p in (palabras or []) if isinstance(p, dict) and str(p.get("palabra") or "").strip()]


# LAS PIEZAS: lo que se escribe en una página como <div class="pieza-…"></div>
# en una línea suelta y aquí se cambia por lo que es. Las del conversor y el
# generador de nombres las pinta el navegador (scripts/paginas/mundo.js);
# aquí solo se les dice de dónde sacar los datos.
PIEZAS_DEL_NAVEGADOR = {
    "pieza-conversor": '<div class="mundo-conversor" data-mundo-conversor'
                       ' data-conversor-datos="/datos/wiki/conversor.json"'
                       ' data-calendario-datos="/datos/wiki/calendario.json">'
                       '<p class="mundo-auto-vacio">El conversor necesita JavaScript.</p></div>',
    "pieza-nombres": '<div class="mundo-nombres" data-mundo-nombres'
                     ' data-nombres-datos="/datos/wiki/nombres.json">'
                     '<p class="mundo-auto-vacio">El generador necesita JavaScript.</p></div>',
}


def con_piezas(cuerpo, paginas, todas_rel, padre_de, palabras):
    def pieza(m):
        cual = m.group(1)
        if cual == "pieza-relaciones":
            return mundo_piezas.diagrama_de_relaciones(paginas, todas_rel)
        if cual == "pieza-panteon":
            return mundo_piezas.panteon_entero(paginas, padre_de)
        if cual == "pieza-diccionario":
            return mundo_piezas.tabla_de_palabras(palabras, paginas)
        return PIEZAS_DEL_NAVEGADOR.get(cual, "")
    return re.sub(r'<div class="(pieza-[a-z]+)">\s*</div>', pieza, cuerpo)


def _fecha_de_evento(ev):
    if str(ev.get("fecha_texto") or "").strip():
        return str(ev["fecha_texto"]).strip()
    if ev.get("fecha") is None:
        return ""
    texto = mundo_linea.anyo(ev["fecha"])
    if ev.get("hasta") is not None and ev["hasta"] > ev["fecha"]:
        texto += " a " + mundo_linea.anyo(ev["hasta"])
    return texto


def escribir_paginas(paginas, probar, categorias=(), eventos=()):
    molde, _ = leer_texto(PLANTILLA)
    # Sin los comentarios de la plantilla: estas páginas salen publicadas.
    molde = limpiar_comentarios_html(molde)[0]
    escritas = 0
    region_de = regiones_de(paginas)
    subraza_de = subrazas_de(paginas)
    padre_de = mundo_piezas.padres_de_jerarquia(paginas)
    familia = mundo_piezas.familias(paginas)
    todas_rel = mundo_piezas.todas_las_relaciones(paginas)
    palabras = leer_diccionario()
    parecidos = mundo_piezas.indice_de_parecidos(paginas, filtros_de)
    sub_de = {}
    for ficha in paginas.values():
        grupo, sub = clasificar(ficha["etiquetas"], categorias)
        sub_de[ficha["nombre"].strip().lower()] = (grupo, sub[0] if sub else "")
    for ficha in paginas.values():
        relleno = molde
        cuerpo = con_rejilla_de_paises(ficha["cuerpo_html"],
                                       rejilla_de_paises(ficha, paginas, region_de))
        cuerpo = con_subrazas(cuerpo, lista_de_subrazas(ficha, paginas, subraza_de))
        cuerpo = con_piezas(cuerpo, paginas, todas_rel, padre_de, palabras)
        # El glosario, antes de lo que se añade solo (que son listas de
        # enlaces y nombres, y ahí no hace falta).
        cuerpo = mundo_piezas.con_glosario(cuerpo, palabras)
        # LO QUE SALE SOLO, sacado de las fichas de las demás páginas (ver
        # herramientas/3-generadores/mundo_piezas.py): sus lugares, sus
        # personajes, sus aliados y enemigos, lo que cuelga de ella, su
        # árbol familiar y, si es un idioma, sus palabras.
        for ancla, titulo, lista in mundo_piezas.apartados_inversos(ficha, paginas):
            cuerpo = mundo_piezas.en_su_apartado(cuerpo, ancla, titulo, lista)
        cuerpo = mundo_piezas.en_su_apartado(
            cuerpo, "relaciones", "Relaciones", mundo_piezas.relaciones(ficha, paginas, todas_rel))
        cuerpo = mundo_piezas.en_su_apartado(
            cuerpo, "lo_que_la_forma", "Lo que la forma", mundo_piezas.jerarquia(ficha, paginas, padre_de))
        cuerpo = mundo_piezas.en_su_apartado(
            cuerpo, "arbol_familiar", "Árbol familiar", mundo_piezas.arbol_familiar(ficha, paginas, familia))
        cuerpo = mundo_piezas.en_su_apartado(
            cuerpo, "cronologia", "Cronología",
            mundo_piezas.cronologia(ficha, paginas, eventos, mundo_linea.enlaces_de, _fecha_de_evento,
                                    mundo_linea.leer_fecha))
        if mundo_piezas.llano(mundo_piezas.que_es(ficha)) == "idioma":
            suyas = [p for p in palabras
                     if mundo_piezas.llano(p.get("idioma")) == mundo_piezas.llano(ficha["nombre"])]
            if suyas:
                cuerpo = mundo_piezas.en_su_apartado(
                    cuerpo, "vocabulario", "Vocabulario",
                    mundo_piezas.tabla_de_palabras(suyas, paginas, enlazar_idioma=False))
        # La caja de navegación, al final del artículo (en su columna: a
        # todo lo ancho se metía debajo del cuadro de contenido, que va fijo
        # abajo a la derecha).
        navbox = mundo_piezas.caja_de_navegacion(ficha, paginas, region_de, subraza_de,
                                                 padre_de, sub_de)
        cuerpo += navbox
        # Las páginas parecidas, debajo, sin repetir las de la caja.
        en_la_caja = {k for k, f in paginas.items() if 'href="%s"' % html.escape(f["url"], quote=True) in navbox}
        cuerpo += mundo_piezas.caja_de_parecidas(ficha, paginas, parecidos, en_la_caja)
        # Y el aviso de esbozo, arriba del todo (no en las utilidades, que
        # no son del mundo).
        if not ficha["carpeta"].lower().startswith("utilidades"):
            cuerpo = mundo_piezas.aviso_de_esbozo(ficha) + cuerpo
        # El contenido ANTES que la ficha: en escritorio da igual (flota abajo
        # a la derecha), y en móvil así sale arriba del todo, como en una
        # wiki de las de siempre.
        lateral = pintar_contenido(cuerpo, bool(ficha["backlinks"])) + ficha["ficha_html"]
        for marca, valor in (
            ("{{TITULO}}", html.escape(ficha["titulo"])),
            ("{{SUBTITULO}}", html.escape(ficha["subtitulo"])),
            ("{{SUBTITULO_BLOQUE}}",
             '<p class="mundo-subtitulo">%s</p>' % html.escape(ficha["subtitulo"])
             if ficha["subtitulo"] else ""),
            ("{{DESCRIPCION}}", html.escape(ficha["resumen"] or ficha["titulo"], quote=True)),
            ("{{SLUG}}", ficha["slug"]),
            ("{{MIGAS}}", pintar_migas(ficha, paginas, region_de)),
            # La ficha y, debajo, el contenido de la página, en la columna
            # de la derecha (o arriba, en pantalla estrecha).
            ("{{FICHA}}", '<div class="mundo-lateral">%s</div>' % lateral if lateral else ""),
            ("{{CUERPO}}", cuerpo),
            ("{{ETIQUETAS}}", pintar_etiquetas(ficha["etiquetas"])),
            ("{{BACKLINKS}}", pintar_backlinks(ficha)),
        ):
            relleno = relleno.replace(marca, valor)
        destino = SALIDA / (ficha["slug"] + ".html")
        destino.parent.mkdir(parents=True, exist_ok=True)
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
        # El orden de los subapartados dentro de éste, si se da ("orden":
        # ["Azarasia", "Partaria", …]). Si no, por orden alfabético.
        orden = uno.get("orden")
        if isinstance(orden, list):
            ORDEN_DE_SUBAPARTADOS[nombre] = [_llano(o) for o in orden if str(o).strip()]
            # Y tal cual, con sus tildes: la portada los escribe.
            _ORDEN_CRUDO[nombre] = [str(o).strip() for o in orden if str(o).strip()]
    return categorias


ORDEN_DE_SUBAPARTADOS = {}
_ORDEN_CRUDO = {}


def _orden_del_sub(grupo, sub):
    """Para ordenar las fichas de un apartado por su subapartado: el que
    diga "orden" en las categorías, y si no, por el nombre."""
    if not sub:
        return (-1, "")
    primero = _llano(sub[0])
    orden = ORDEN_DE_SUBAPARTADOS.get(grupo) or []
    if primero in orden:
        return (orden.index(primero), "")
    return (len(orden), primero)


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


# LOS FILTROS DE LAS VENTANAS DE LA PORTADA: los campos de las fichas por
# los que tiene sentido filtrar (los monstruos por hábitat, los personajes
# por raza…). En la ventana sale un desplegable por cada uno que tenga al
# menos dos valores distintos entre las páginas de esa sección. El tipo es
# el «infobox» (Asentamiento, Fortaleza, Criatura…).
FILTRABLES = ("raza", "ubicación", "tipo", "hábitat", "tamaño", "peligrosidad", "rareza",
              "lealtad", "familia", "ámbitos", "sede", "organización")


def filtros_de(ficha):
    datos = ficha.get("datos") or {}
    salida = {}
    que = str(datos.get("infobox") or "").strip()
    if que:
        salida["qué es"] = que
    for campo in FILTRABLES:
        valor = datos.get(campo)
        if isinstance(valor, list):
            valor = ", ".join(str(v) for v in valor)
        texto = str(valor or "").strip()
        # Los enlaces, por su nombre: [[Elfos|los elfos]] → Elfos.
        texto = re.sub(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]", r"\1", texto).strip(" *")
        if texto and "por decidir" not in texto.lower() and len(texto) <= 60:
            salida[campo] = texto
    return salida


def escribir_indice(paginas, mapas, probar, categorias=(), peques=None):
    """La portada: el índice por apartados. Las fichas y los botones de
    etiqueta los pinta el navegador con datos/wiki/mundo.json, igual que el
    resto de listados del sitio."""
    fichas = []
    region_de = regiones_de(paginas)
    subraza_de = subrazas_de(paginas)
    for ficha in sorted(paginas.values(), key=lambda f: f["titulo"].lower()):
        grupo, sub = clasificar(ficha["etiquetas"], categorias)
        # Su región, con el título de su página (la portada pone cada país
        # debajo de su región, como los portales de geografía).
        suya = paginas.get(region_de.get(ficha["nombre"].strip().lower(), ""))
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
            "region": suya["titulo"] if suya else "",
            # Lo que se puede filtrar en la ventana de su sección (el tipo,
            # la raza, el hábitat…; ver FILTRABLES).
            "filtros": filtros_de(ficha),
            # De qué raza es, si es una subraza (ver subrazas_de): la
            # portada la pone debajo de su raza.
            "subraza_de": (paginas[subraza_de[ficha["nombre"].strip().lower()]]["titulo"]
                           if ficha["nombre"].strip().lower() in subraza_de else ""),
            # Si aún es de relleno («*Texto de relleno.*»): la portada no la
            # saca de destacada ni en el «¿sabías que…?».
            # (o de ejemplo, en lorem ipsum: wiki/Ejemplos/).
            "relleno": any(m in (ficha.get("texto") or "") for m in ("Texto de relleno", "Lorem ipsum")),
            # Su bandera, si tiene: la portada la pone junto al nombre.
            "bandera": ficha.get("bandera_url") or "",
            # Y si es una región (no tiene bandera), su mapa de situación en
            # pequeño, que es lo que sale en su hueco de la rejilla.
            "miniatura": (peques or {}).get(ficha["nombre"].strip().lower(), ""),
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
    # Y dentro de cada apartado, por subapartado: la portada los pinta en
    # el orden en que le llegan.
    fichas.sort(key=lambda f: (orden.get(f["grupo"], len(orden)),
                               _orden_del_sub(f["grupo"], f["sub"]), f["titulo"].lower()))
    if not probar:
        escribir_json(INDICE, fichas)
    return fichas


# =========================================
# «BUSCA UNA REGIÓN», EN LA PORTADA
# =========================================
# La portada de la wiki empieza, como los portales de geografía de las
# wikis grandes (el de A Wiki of Ice and Fire, que es de donde sale la
# idea), por una rejilla de miniaturas: cada parte del mundo y, debajo, sus
# regiones, cada una con su mapa de situación en pequeño. Lo pinta
# scripts/paginas/mundo.js con datos/wiki/mundo-regiones.json, que se
# escribe aquí.

REGIONES = RAIZ / "datos" / "wiki" / "mundo-regiones.json"


def partes_del_mapamundi():
    """Las partes del mundo, en orden: el "orden" del apartado del
    mapamundi en datos/wiki/mundo-categorias.json (Azarasia, Partaria…).
    Hay que haber leído las categorías antes (leer_categorias)."""
    for grupo, orden in ORDEN_DE_SUBAPARTADOS.items():
        if _llano(grupo) == "mapamundi":
            return [str(o).strip() for o in _ORDEN_CRUDO.get(grupo, orden)]
    return []


def _parte_de(carpeta):
    """Mapamundi/Azarasia/Islas de Labros → Azarasia."""
    trozos = [t for t in str(carpeta or "").split("/") if t]
    return trozos[1] if len(trozos) > 1 and _llano(trozos[0]) == "mapamundi" else ""


def escribir_regiones(paginas, partes, peques, de_partes, probar):
    region_de = regiones_de(paginas)
    cuantas = {}
    for region in region_de.values():
        cuantas[region] = cuantas.get(region, 0) + 1
    salida = []
    for parte in partes:
        llave = parte.lower()
        suyas = [f for f in paginas.values() if _llano(_parte_de(f["carpeta"])) == _llano(parte)]
        if not suyas:
            continue
        propia = paginas.get(llave)
        salida.append({
            "nombre": propia["titulo"] if propia else parte,
            # Sin página propia (Archipiélagos), la tarjeta lleva a su
            # apartado en la lista de abajo.
            "url": propia["url"] if propia else "",
            "imagen": peques.get(llave) or de_partes.get(llave, ""),
            "cuenta": len(suyas),
        })
    if not probar:
        escribir_json(REGIONES, salida)
    return salida


# =========================================
# LO DE LA PORTADA QUE NO ES EL ÍNDICE
# =========================================
# Lo que tienen las portadas de las wikis de mundos (Kanka, World Anvil,
# las de Fandom): la fecha de HOY en el mundo y los ÚLTIMOS CAMBIOS. Lo
# pinta scripts/paginas/mundo.js con datos/wiki/mundo-portada.json. La
# página destacada, el «¿sabías que…?» y la página al azar salen de
# mundo.json, en el navegador.

PORTADA = RAIZ / "datos" / "wiki" / "mundo-portada.json"


def _fecha_de(archivo):
    """(cuándo, "aaaa-mm-dd") del último cambio de un archivo de la bóveda.
    Si tiene cambios sin commit, la del archivo (es lo último que se ha
    tocado); si no, la de su último commit (la de verdad: al bajar el
    repositorio, todos los archivos nacen con la fecha del día)."""
    import datetime
    import subprocess
    del_archivo = Path(archivo).stat().st_mtime
    try:
        sucio = subprocess.run(["git", "status", "--porcelain", "--", str(archivo)],
                               cwd=RAIZ, capture_output=True, text=True, timeout=10).stdout.strip()
        if not sucio:
            hecho = subprocess.run(["git", "log", "-1", "--format=%ct", "--", str(archivo)],
                                   cwd=RAIZ, capture_output=True, text=True, timeout=10)
            if hecho.stdout.strip():
                cuando = int(hecho.stdout.strip())
                return cuando, datetime.date.fromtimestamp(cuando).isoformat()
    except (OSError, subprocess.SubprocessError, ValueError):
        pass
    return del_archivo, datetime.date.fromtimestamp(del_archivo).isoformat()


# CUÁNTO FALTA: las páginas que ya tienen texto de verdad (no el de
# relleno de la plantilla ni el lorem ipsum de los ejemplos) y los campos
# de las fichas que ya están decididos (no dicen «por decidir»). No cuenta
# las de utilidades, que no son del mundo (ni las de ejemplo, si vuelve a
# haber una carpeta wiki/Ejemplos/). Lo mismo, con detalle, lo dice
# herramientas/5-consulta/pendientes-wiki.py.
SIN_CONTAR = {"tags", "aliases", "etiquetas", "cssclasses", "image", "imagen", "bandera",
              "blasón", "blason", "escudo", "plantilla"}


def progreso_de(paginas):
    escritas = total = decididos = campos = 0
    for f in paginas.values():
        partes = Path(f["carpeta"]).parts
        if partes and partes[0].lower() in ("ejemplos", "utilidades"):
            continue
        texto = leer_texto(f["archivo"])[0]
        m = re.match(r"^---\n(.*?)\n---\n?", texto, re.S)
        cuerpo = re.sub(r"<!--.*?-->", "", texto[m.end():] if m else texto, flags=re.S)
        total += 1
        if cuerpo.strip() and not any(r in cuerpo for r in ("Texto de relleno", "Lorem ipsum")):
            escritas += 1
        for linea in (m.group(1) if m else "").split("\n"):
            if linea.lstrip().startswith("#") or linea.startswith((" ", "\t", "-")) or ":" not in linea:
                continue
            clave, valor = linea.split(":", 1)
            valor = valor.strip().strip("'\"")
            if clave.strip().lower() in SIN_CONTAR or not valor:
                continue
            campos += 1
            if "por decidir" not in valor.lower():
                decididos += 1
    return {"paginas": total, "escritas": escritas, "campos": campos, "decididos": decididos}


def escribir_portada(paginas, probar, cuantos=6):
    cabecera, _ = mundo_linea.leer(lambda *a: None)
    hoy = None
    if cabecera.get("hoy") is not None:
        era = mundo_linea.era_de({"fecha": cabecera["hoy"]}, cabecera.get("eras") or [])
        hoy = {"anyo": mundo_linea.anyo(cabecera["hoy"]),
               "era": era["nombre"] if era else "",
               "url": mundo_linea.URL + mundo_linea.PAGINA}
    fechas = {clave: _fecha_de(f["archivo"]) for clave, f in paginas.items()}
    cambios = [{"titulo": paginas[k]["titulo"], "url": paginas[k]["url"], "fecha": fechas[k][1]}
               for k in sorted(fechas, key=lambda k: fechas[k][0], reverse=True)[:cuantos]]
    salida = {"hoy": hoy, "cambios": cambios, "progreso": progreso_de(paginas)}
    if not probar:
        escribir_json(PORTADA, salida)
    return salida


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


# =========================================
# LOS MAPAS DE SITUACIÓN
# =========================================

SITUACION = IMAGENES / "situacion"
# Lo que hace falta para pulsar los países del mapa de situación ampliado.
PULSAR = RAIZ / "datos" / "wiki" / "situacion"


def preparar_situaciones(paginas, mapas, imagenes, probar, partes=()):
    """Un mapa de situación por cada página que se llame como una forma con
    nombre de algún mapa. Devuelve:

      · {nombre en minúsculas: (url, título de la página, título del mapa,
        url del mapa)}, para el artículo;
      · cuántos se han dibujado ahora;
      · {nombre en minúsculas: url de la miniatura}, solo de las REGIONES
        (las que son «región» de alguna página) y de las partes del mundo:
        son las de la portada (ver escribir_regiones);
      · {parte en minúsculas: url de la miniatura} de las partes del mundo
        que no tienen página ni forma propia (Archipiélagos): se dibujan
        con las formas de todas sus páginas juntas resaltadas.
    """
    if not mundo_situacion.HAY_PILLOW or not mapas:
        return {}, 0, {}, {}
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    indices = indice_de_imagenes(imagenes)
    salida, peques, de_partes, hechas, buenas = {}, {}, {}, 0, set()
    este = Path(mundo_situacion.__file__)
    con_peque = set(regiones_de(paginas).values()) | {p.lower() for p in partes}
    PEQUE_DIR = SITUACION / "peque"

    def dibuja(fondo_abierto, leido, poligonos, vecinos, archivo, fuentes, peque,
               grande=True, siempre=False):
        """Dibuja (si hace falta) la grande y, si peque, la miniatura.
        Devuelve cuántas ha dibujado y el fondo, abierto la primera vez que
        se necesita (es una imagen de 2560 de ancho: se abre una vez)."""
        hechas_aqui = 0
        destinos = [(SITUACION / archivo, {})] if grande else []
        if peque:
            destinos.append((PEQUE_DIR / archivo, {"tamano": mundo_situacion.PEQUE,
                                                    "calidad": mundo_situacion.CALIDAD_PEQUE}))
        for destino, ajustes in destinos:
            buenas.add(destino)
            if probar or (not siempre and mundo_situacion.al_dia(destino, fuentes)):
                continue
            if fondo_abierto[0] is None:
                fondo_abierto[0] = Image.open(fuentes[1]).convert("RGB")
            mundo_situacion.dibujar(fondo_abierto[0], leido["ancho"], leido["alto"],
                                    poligonos, vecinos, destino, **ajustes)
            hechas_aqui += 1
        return hechas_aqui

    for mapa in sorted(mapas.values(), key=lambda m: m["nombre"].lower()):
        crudo, _ = leer_texto(mapa["archivo"])
        leido = mundo_mapas.leer_cmap(crudo, lambda *a: None)
        if not leido:
            continue
        fondo_archivo = None
        for capa in leido["capas"]:
            if capa.get("imagen"):
                fondo_archivo, _ = pedir_imagen(indices, capa["imagen"])
                if fondo_archivo:
                    break
        if not fondo_archivo:
            continue
        formas = {}
        for forma in leido["formas"]:
            nombre = (forma["etiqueta"] or forma["pagina"] or "").strip().lower()
            if nombre:
                formas.setdefault(nombre, []).append(forma["puntos"])
        # Las fronteras finas de alrededor: las de los países, no las de
        # las regiones (que pasan por encima de todo y lían el dibujo).
        nivel = mundo_mapas.niveles(leido["formas"])
        vecinos_todos = [(i, f["puntos"]) for i, f in enumerate(leido["formas"])
                         if nivel.get(i) in ("pais", "suelto")]
        titulo_mapa = leido.get("titulo") or mapa["nombre"]
        # Las formas con página, para el mapa de situación que se pulsa
        # (ver mundo_situacion.para_pulsar): las de los países, como las
        # fronteras finas.
        con_pagina = {}
        for i, f in enumerate(leido["formas"]):
            nombre = (f["etiqueta"] or f["pagina"] or "").strip().lower()
            if nombre in paginas and nivel.get(i) in ("pais", "suelto"):
                con_pagina.setdefault(nombre, []).append(f["puntos"])
        fuentes = [mapa["archivo"], fondo_archivo, este]
        fondo = [None]
        for clave, ficha in paginas.items():
            poligonos = formas.get(ficha["nombre"].strip().lower())
            if not poligonos or clave in salida:
                continue
            archivo = slug(ficha["nombre"]) + ".webp"
            vecinos = [p for _, p in vecinos_todos if p not in poligonos]
            hechas += dibuja(fondo, leido, poligonos, vecinos, archivo, fuentes,
                             clave in con_peque)
            if clave in con_peque:
                peques[clave] = "/imagenes/wiki/situacion/peque/" + archivo
            titulo_suyo = (str(ficha["datos"].get("title") if ficha.get("datos") else "")
                           or ficha["nombre"])
            otras = [(paginas[k]["titulo"], paginas[k]["url"], pols)
                     for k, pols in con_pagina.items() if k != clave]
            pulsar = mundo_situacion.para_pulsar(poligonos, otras, leido["ancho"], leido["alto"],
                                                 "/imagenes/wiki/situacion/" + archivo, titulo_suyo)
            datos_pulsar = PULSAR / (slug(ficha["nombre"]) + ".json")
            buenas.add(datos_pulsar)
            if not probar:
                # Apretado, sin sangría: son cientos de números, y con
                # sangría (escribir_json) cada uno iba en su línea.
                datos_pulsar.parent.mkdir(parents=True, exist_ok=True)
                texto = json.dumps(pulsar, ensure_ascii=False, separators=(",", ":")) + "\n"
                if not datos_pulsar.is_file() or leer_texto(datos_pulsar)[0] != texto:
                    escribir_texto(datos_pulsar, texto)
            salida[clave] = ("/imagenes/wiki/situacion/" + archivo, titulo_suyo, titulo_mapa,
                             mapa["url"], "/datos/wiki/situacion/" + datos_pulsar.name)
        # LAS PARTES DEL MUNDO SIN PÁGINA (Archipiélagos): todas las formas
        # de las páginas de su carpeta, resaltadas a la vez.
        for parte in partes:
            llave = parte.lower()
            if llave in paginas or llave in de_partes:
                continue
            suyas = [f for f in paginas.values()
                     if _llano(_parte_de(f["carpeta"])) == _llano(parte)]
            poligonos = [pol for f in suyas
                         for pol in formas.get(f["nombre"].strip().lower(), [])]
            if not poligonos:
                continue
            archivo = slug(parte) + ".webp"
            vecinos = [p for _, p in vecinos_todos if p not in poligonos]
            # Solo la miniatura: sin página, la grande no la enseña nadie.
            # Y SIEMPRE: lo que la hace cambiar no es solo el mapa, también
            # qué zonas son de esa parte (mover una carpeta de la bóveda de
            # una parte a otra), y eso no se ve en la fecha de ningún
            # archivo. Son tres miniaturas pequeñas.
            hechas += dibuja(fondo, leido, poligonos, vecinos, archivo, fuentes, True,
                             grande=False, siempre=True)
            de_partes[llave] = "/imagenes/wiki/situacion/peque/" + archivo
    # Los de páginas o formas que ya no están.
    if not probar:
        for carpeta, cuales in ((SITUACION, "*.webp"), (PEQUE_DIR, "*.webp"), (PULSAR, "*.json")):
            if carpeta.is_dir():
                for viejo in carpeta.glob(cuales):
                    if viejo not in buenas:
                        viejo.unlink()
    return salida, hechas, peques, de_partes


def limpiar_lo_que_sobra(paginas, mapas, probar):
    """Las páginas de web/wiki/ (y sus subcarpetas) que ya no tienen su .md
    (o su .cmap): se han borrado, renombrado o cambiado de carpeta en la
    bóveda. Se quitan, porque si no se quedan colgando en el sitemap y en
    el buscador. Y las carpetas que se queden vacías, también."""
    buenos = ({f["slug"] + ".html" for f in paginas.values()}
              | {m["slug"] + ".html" for m in mapas.values()}
              | {"index_wiki.html"})
    sobran = []
    if SALIDA.is_dir():
        for p in sorted(SALIDA.rglob("*.html")):
            relativo = p.relative_to(SALIDA).as_posix()
            # Lo de la línea de tiempo no sale de la bóveda: lo escribe y
            # lo limpia mundo_linea.py (en web/wiki/linea-de-tiempo/).
            if mundo_linea.es_de_la_linea(p):
                continue
            if relativo not in buenos:
                sobran.append(p)
    if not probar:
        for p in sobran:
            p.unlink()
        for carpeta in sorted((c for c in SALIDA.rglob("*") if c.is_dir()),
                              key=lambda c: -len(c.parts)):
            if not any(carpeta.iterdir()):
                carpeta.rmdir()
    return [p.relative_to(SALIDA).as_posix() for p in sobran]


# =========================================
# CONTARLO
# =========================================

# LOS DATOS DEL CONVERSOR DE FECHAS Y DEL GENERADOR DE NOMBRES, que pinta el
# navegador. El conversor necesita las eras con sus años ya en números (la
# misma cuenta que la línea de tiempo: ver mundo_linea.leer_fecha) y el
# generador, los nombres de cada sitio (ver mundo_piezas.estilos_de_nombres).
CONVERSOR = RAIZ / "datos" / "wiki" / "conversor.json"
NOMBRES = RAIZ / "datos" / "wiki" / "nombres.json"
NOMBRES_PROPIOS = RAIZ / "datos" / "wiki" / "nombres-propios.json"


def escribir_datos_de_las_piezas(paginas, probar):
    cabecera, _ = mundo_linea.leer(avisar=lambda *_: None)
    eras = mundo_linea.leer_eras(cabecera.get("eras") or [], avisar=lambda *_: None)
    calendario = mundo_linea.CALENDARIO
    conversor = {
        "_": "Lo escribe generar-mundo.py a partir de la línea de tiempo: no se edita.",
        "antes": calendario.get("antes", ""),
        "despues": calendario.get("despues", ""),
        "base_antes": mundo_linea.BASE_ANTES,
        "hoy": mundo_linea.HOY[0],
        "eras": [{"nombre": e["nombre"], "desde": e["desde"], "fin": e["fin"],
                  "url": mundo_linea.URL + mundo_linea.PAGINA + "#" + e["slug"]} for e in eras],
    }
    extra = leer_json(NOMBRES_PROPIOS, {}) or {}
    nombres = {
        "_": ("Lo escribe generar-mundo.py con los nombres que ya hay en la wiki. Para"
              " añadir los tuyos (o un estilo nuevo), datos/wiki/nombres-propios.json."),
        "estilos": mundo_piezas.estilos_de_nombres(
            paginas, regiones_de(paginas),
            extra.get("estilos", []) if isinstance(extra, dict) else [], leer_diccionario()),
    }
    if probar:
        return
    for archivo, datos in ((CONVERSOR, conversor), (NOMBRES, nombres)):
        texto = json.dumps(datos, ensure_ascii=False, indent=4) + "\n"
        if not archivo.is_file() or leer_texto(archivo)[0] != texto:
            escribir_texto(archivo, texto)


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
    _, eventos = mundo_linea.leer()
    eventos_por_nombre = mundo_linea.por_nombre(eventos)
    paginas = convertir_todo(paginas, imagenes, mapas, avisos_por_pagina, eventos_por_nombre)
    # Los mapas de situación, DESPUÉS de convertir: hace falta el campo
    # «región» de cada ficha para saber cuáles son regiones (esas llevan
    # además su miniatura para la portada).
    categorias = leer_categorias()
    partes = partes_del_mapamundi()
    situaciones, hechas_sit, peques, de_partes = preparar_situaciones(
        paginas, mapas, imagenes, args.probar, partes)
    for clave, ficha in paginas.items():
        poner_emblemas(ficha, situaciones.get(clave))
    capas = convertir_mapas(mapas, paginas, imagenes, avisos_por_pagina, args.detalle)
    # Un evento que nombra una página ([[Valderín]] en su texto) sale en el
    # «se habla de esto en» de esa página, igual que un artículo o un mapa.
    for evento in eventos:
        for nombre in set(n.lower() for n in mundo_linea.enlaces_de(evento)):
            otra = paginas.get(nombre)
            if otra:
                otra["backlinks"].append({"titulo": evento["nombre"], "url": evento["url"],
                                          "mapa": False, "evento": True})
    # Los mapas han añadido backlinks después de que convertir_todo los
    # ordenara, así que se vuelven a ordenar con todo dentro.
    for ficha in paginas.values():
        ficha["backlinks"].sort(key=lambda o: o["titulo"].lower())

    usadas = set()
    for ficha in paginas.values():
        for m in re.finditer(r'/imagenes/wiki/([^"]+)"', ficha["cuerpo_html"] + ficha["ficha_html"]):
            usadas.add(m.group(1).lower())

    SALIDA.mkdir(parents=True, exist_ok=True)
    escritas = escribir_paginas(paginas, args.probar, categorias, eventos)
    escritos = escribir_mapas(mapas, args.probar)
    escritos += escribir_vistas(mapas, args.probar)
    fichas = escribir_indice(paginas, mapas, args.probar, categorias, peques)
    escribir_regiones(paginas, partes, peques, de_partes, args.probar)
    escribir_portada(paginas, args.probar)
    escribir_datos_de_las_piezas(paginas, args.probar)
    copiadas, pesadas, repetidas = copiar_imagenes(imagenes, usadas, args.probar)
    hechas, saltadas, enteras, gordas = preparar_capas(capas, args.probar)
    sobran = limpiar_lo_que_sobra(paginas, mapas, args.probar)

    print(f"\n  {len(paginas)} página(s) en la bóveda"
          + (f" y {len(mapas)} mapa(s)." if mapas else "."))
    if situaciones:
        print(f"  {len(situaciones)} mapa(s) de situación"
              + (f", {hechas_sit} dibujado(s) ahora." if hechas_sit else ", ya al día."))
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
            clave = nombre.strip().lower()
            if clave not in paginas and clave not in mapas and clave not in eventos_por_nombre:
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
    # LA LÍNEA DE TIEMPO, después de escribir las páginas y el índice: sus
    # eventos dicen qué páginas los enlazan (y eso se mira en lo escrito) y
    # su ficha va dentro de datos/wiki/mundo.json, que se acaba de rehacer.
    linea = mundo_linea.generar(args.probar)
    if linea["eventos"]:
        print(f"\n  ---- la línea de tiempo: {len(linea['eventos'])} evento(s) ----")
        for nombre, lista in linea["avisos"]:
            print(f"  {nombre}")
            for que, donde in lista:
                print("     " + que + (": " + str(donde) if donde else ""))

    if not args.probar:
        print()
        pasar_generadores((
            # Las páginas de la wiki salen de plantillas con su guía en
            # comentarios: fuera antes de publicarlas.
            "3-generadores/quitar-comentarios.py",
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
