#!/usr/bin/env python3
# =========================================
# EL EDITOR DE LA WIKI (en el navegador)
# =========================================
# Lo mismo que nueva-pagina-wiki.py, pero con ventanas en vez de
# preguntas, y además para SEGUIR escribiendo una página que ya existe sin
# tener que abrir el .md: cada dato de la ficha es una casilla y cada
# apartado del texto, un recuadro donde escribir, con la nota de la
# plantilla encima diciendo qué va ahí.
#
#     python herramientas/1-publicar/editor-wiki.py
#
# (o desde el menú: Wiki Cralëa → Escribir en la wiki con el editor). Se
# abre solo en el navegador; si no, la dirección sale aquí escrita. Para
# cerrarlo, Ctrl+C aquí o cerrar esta ventana.
#
# QUÉ HACE
#
#   · CREAR una página nueva: el nombre, el tipo (con las plantillas de
#     wiki/_system/templates/, las mismas de nueva-pagina-wiki.py) y lo que
#     pregunte cada plantilla, con las páginas que ya hay para elegir.
#     También se puede crear directamente una de las PÁGINAS QUE FALTAN
#     (las que se enlazan y aún no existen: salen en rojo en la web).
#   · SEGUIR CON UNA que ya hay: se busca por el nombre.
#   · Mientras se escribe: un botón para poner un [[enlace]] a otra página
#     donde esté el cursor, y para las imágenes de la ficha (image,
#     bandera, blasón), SUBIR UNA de tu ordenador: la pasa a WebP, a su
#     tamaño y sin los datos del móvil, a wiki/_imagenes/ (lo mismo que
#     traer-imagen.py), y pone su nombre en la casilla.
#   · LOS MAPAS (los .cmap): poner sitios (capital, ciudad, pueblo,
#     fortaleza, ruina, puerto, templo…), pintar regiones y rayas (caminos,
#     ríos, fronteras, rutas…), escribir textos en el mapa, ponerles nombre
#     y la página a la que llevan, moverlos o borrarlos (con imán, y con
#     deshacer), y medir distancias con su escala y sus días de viaje.
#     También hacer un mapa nuevo para una página a partir de una imagen:
#     se guarda junto a la página y esa página sale en la web con un botón
#     para explorarlo.
#   · GUARDAR (Ctrl+S) escribe el .md. GUARDAR Y PASAR A LA WEB además
#     pasa la wiki (generar-mundo.py y actualizar-cabeceras.py), con una
#     barra de progreso mientras tanto, y deja un
#     enlace para VER CÓMO QUEDA, aquí mismo, en el navegador.
#
# LO QUE NO TOCA: las notas escondidas (<!-- así -->) de cada apartado se
# quedan donde estaban, igual que los comentarios de la cabecera (# así)
# y el «layout» de la ficha. Solo cambia lo que cambies.
#
# SOLO PARA TI: escucha en 127.0.0.1 (este ordenador y nadie más), y cada
# vez que se abre inventa una contraseña que va en la dirección; sin ella
# no se puede guardar nada. No hace falta nada instalado aparte de Python
# (y Pillow para subir imágenes, que ya lo usa el resto de herramientas).
#
# Los archivos de la página del editor están en
# herramientas/1-publicar/editor-wiki/ (editor.html, editor.css,
# editor.js y mapas.js, que es el editor de mapas).

import base64
import difflib
import importlib.util
import json
import os
import re
import secrets
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERRAMIENTAS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERRAMIENTAS))

from comun import (RAIZ, esta_fuera, escribir_como_estaba, escribir_texto,  # noqa: E402
                   guardar_wiki_fuera, leer_json, leer_texto, sin_tildes, wiki_fuera)

# La herramienta de siempre, para no repetir cómo se leen y rellenan las
# plantillas: se carga por su ruta porque lleva guiones en el nombre.
_spec = importlib.util.spec_from_file_location(
    "nueva_pagina_wiki", HERRAMIENTAS / "1-publicar" / "nueva-pagina-wiki.py")
npw = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(npw)

VAULT = RAIZ / "wiki"
IMAGENES = VAULT / "_imagenes"
CARPETA_EDITOR = Path(__file__).resolve().parent / "editor-wiki"
MUNDO_JSON = RAIZ / "datos" / "wiki" / "mundo.json"
TOKEN = secrets.token_urlsafe(18)
RE_ENLACE = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]")
RE_TITULO = re.compile(r"^(#{2,6})\s+(.*?)\s*#*\s*$")
RE_NOTA = re.compile(r"<!--.*?-->", re.S)
IMAGEN = (".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg")
# Los datos de la cabecera que son una imagen: llevan el botón de subir.
CAMPOS_DE_IMAGEN = ("image", "bandera", "blasón", "blason", "escudo")
# Lo de la cabecera que no es una casilla de la ficha: el título es el
# nombre del archivo, y estas tres tienen la suya propia arriba.
APARTE = ("title", "subtitle", "infobox", "tags")
# Cómo se llama cada una en el editor (las demás, como en la ficha).
NOMBRES = {"subtitle": "Subtítulo", "infobox": "Qué es (sale arriba de la ficha)",
           "tags": "Etiquetas (separadas por comas)", "image": "Imagen de la ficha"}


# =========================================
# LAS PÁGINAS QUE HAY
# =========================================

def todas():
    return sorted(npw.paginas_de_la_wiki(), key=lambda a: a.stem.lower())


def imagenes_que_hay():
    if not IMAGENES.is_dir():
        return []
    return sorted({a.name for a in IMAGENES.rglob("*") if a.suffix.lower() in IMAGEN}, key=str.lower)


def paginas_que_faltan():
    """[(nombre, cuántas la nombran)] de los [[enlaces]] a páginas que no
    existen, de la más nombrada a la que menos."""
    existen = {sin_tildes(a.stem).lower() for a in todas()}
    existen |= {sin_tildes(a.stem).lower() for a in VAULT.rglob("*.cmap")}
    linea = leer_json(RAIZ / "datos" / "wiki" / "linea-de-tiempo.json", {}) or {}
    for grupo in ("eventos", "eras"):
        existen |= {sin_tildes(str(e.get("nombre", ""))).lower() for e in linea.get(grupo, []) or []}
    existen.add("linea de tiempo")
    cuantas = {}
    for archivo in todas():
        texto = RE_NOTA.sub("", leer_texto(archivo)[0])
        texto = "\n".join(l for l in texto.split("\n") if not l.lstrip().startswith("#"))
        for m in RE_ENLACE.finditer(texto):
            nombre = m.group(1).strip()
            if re.search(r"\.(webp|png|jpe?g|gif|svg)$", nombre, re.I) or not nombre:
                continue
            if sin_tildes(nombre).lower() not in existen:
                cuantas.setdefault(nombre, set()).add(archivo.stem)
    return sorted(((n, len(d)) for n, d in cuantas.items()), key=lambda x: (-x[1], x[0].lower()))


def url_de_la_pagina(nombre):
    """Dónde sale publicada, mirando mundo.json (lo escribe generar-mundo)."""
    for f in leer_json(MUNDO_JSON, []) or []:
        if isinstance(f, dict) and sin_tildes(str(f.get("titulo", ""))).lower() == sin_tildes(nombre).lower():
            return str(f.get("url") or "")
    return ""


# =========================================
# LEER UNA PÁGINA EN TROZOS, Y VOLVER A JUNTARLA
# =========================================
# La cabecera (entre los dos ---) se lee línea a línea: cada «clave: valor»
# de primer nivel es una casilla; los comentarios (# así) se enseñan como
# ayuda de las casillas que vienen detrás; lo sangrado (el layout, una
# lista con guiones) se queda tal cual, sin casilla. El texto se parte por
# los títulos (## y más): cada trozo es un recuadro, y sus notas
# escondidas (<!-- así -->) se enseñan encima y se guardan donde estaban.

def partir(texto):
    if texto.startswith("---\n"):
        fin = texto.find("\n---", 4)
        if fin != -1:
            despues = texto.find("\n", fin + 1)
            despues = len(texto) if despues == -1 else despues + 1
            return texto[4:fin], texto[despues:], True
    return "", texto, False


def sin_comillas(valor):
    """Como lo lee el generador (mundo_formato._valor): lo de dentro de las
    comillas, tal cual."""
    v = valor.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    return v


def leer_cabecera(cabecera):
    """[{clave, valor, crudo, nota, aparte, fija}] en orden. fija: algo que
    no tiene casilla (una lista sangrada, el layout)."""
    lineas = cabecera.split("\n")
    salida, nota = [], []
    i = 0
    while i < len(lineas):
        linea = lineas[i]
        if linea.lstrip().startswith("#"):
            nota.append(linea.lstrip()[1:].strip())
            i += 1
            continue
        m = re.match(r"^([^\s#:][^:]*):(.*)$", linea)
        if not m:
            i += 1
            continue
        clave, resto = m.group(1).strip(), m.group(2)
        # Lo sangrado de debajo es suyo (layout, una lista con guiones, un
        # texto de varias líneas): no lleva casilla.
        j = i + 1
        while j < len(lineas) and (lineas[j][:1] in (" ", "\t") or lineas[j].lstrip().startswith("- ")) \
                and lineas[j].strip():
            j += 1
        fija = j > i + 1 or resto.strip() in ("|", "|-", ">", ">-")
        valor = resto.strip()
        if clave == "tags" and valor.startswith("[") and valor.endswith("]"):
            valor = ", ".join(sin_comillas(e) for e in valor[1:-1].split(",") if e.strip())
        elif not (valor.startswith("[") and not valor.startswith("[[")):
            valor = sin_comillas(valor)
        salida.append({"clave": clave, "valor": "" if fija else valor, "crudo": linea,
                       "nota": " ".join(nota).strip(), "fija": fija,
                       "imagen": clave.lower() in CAMPOS_DE_IMAGEN,
                       "nombre": NOMBRES.get(clave, clave[:1].upper() + clave[1:])})
        nota = []
        i = j
    return salida


def leer_cuerpo(cuerpo):
    """[{nivel, titulo, nota, texto}]. El primero (nivel 0) es lo de antes
    del primer título: la entradilla."""
    trozos = [{"nivel": 0, "titulo": "", "lineas": []}]
    en_codigo = False
    for linea in cuerpo.split("\n"):
        if linea.strip().startswith("```"):
            en_codigo = not en_codigo
        m = None if en_codigo else RE_TITULO.match(linea)
        if m:
            trozos.append({"nivel": len(m.group(1)), "titulo": m.group(2), "lineas": [], "linea": linea})
        else:
            trozos[-1]["lineas"].append(linea)
    salida = []
    for t in trozos:
        texto = "\n".join(t["lineas"])
        notas = RE_NOTA.findall(texto)
        limpio = RE_NOTA.sub("", texto).strip("\n")
        salida.append({"nivel": t["nivel"], "titulo": t["titulo"], "linea": t.get("linea", ""),
                       "lineas": t["lineas"], "notas": notas,
                       "nota": " ".join(re.sub(r"\s+", " ", n[4:-3]).strip() for n in notas),
                       "texto": limpio.strip()})
    return salida


def leer_pagina(archivo):
    texto, _ = leer_texto(archivo)
    cabecera, cuerpo, tiene = partir(texto)
    return {"nombre": archivo.stem,
            "archivo": archivo.relative_to(RAIZ).as_posix(),
            "campos": leer_cabecera(cabecera) if tiene else [],
            "apartados": leer_cuerpo(cuerpo),
            "url": url_de_la_pagina(archivo.stem)}


def entre_comillas(valor):
    """Entre comillas dobles; si lleva alguna, entre simples; y si lleva
    de las dos, las dobles pasan a ser las de imprenta (el generador no
    entiende las comillas escapadas con \\)."""
    if '"' not in valor:
        return '"%s"' % valor
    if "'" not in valor:
        return "'%s'" % valor
    return '"%s"' % re.sub(r'"([^"]*)"', "“\\1”", valor).replace('"', "”")


def escribir_valor(clave, valor):
    valor = (valor or "").replace("\r", "").replace("\n", " ").strip()
    if not valor:
        return clave + ":"
    if clave == "tags":
        partes = [p.strip() for p in valor.strip("[]").split(",") if p.strip()]
        return "tags: [%s]" % ", ".join(partes)
    # Una lista escrita a mano ([a.webp, b.webp]) va tal cual; un [[enlace]]
    # o cualquier otra cosa, entre comillas, para que un «:» no rompa nada.
    if valor.startswith("[") and valor.endswith("]") and not valor.startswith("[["):
        return "%s: %s" % (clave, valor)
    return "%s: %s" % (clave, entre_comillas(valor))


def juntar(archivo, campos_nuevos, apartados_nuevos):
    """El .md con lo nuevo: campos_nuevos {clave: valor}; apartados_nuevos
    [texto] en el mismo orden en que se leyeron."""
    texto, crlf = leer_texto(archivo)
    cabecera, cuerpo, tiene = partir(texto)
    if tiene:
        lineas = cabecera.split("\n")
        viejos = {c["crudo"]: c for c in leer_cabecera(cabecera)}
        salida = []
        for linea in lineas:
            c = viejos.get(linea)
            if c and not c["fija"] and c["clave"] in campos_nuevos:
                nuevo = campos_nuevos[c["clave"]]
                # Si no ha cambiado, la línea de siempre (con sus comillas o
                # sin ellas): que el .md no cambie por nada.
                salida.append(linea if nuevo.strip() == c["valor"].strip() else escribir_valor(c["clave"], nuevo))
            else:
                salida.append(linea)
        # Los campos nuevos (los que se han añadido desde el editor), al
        # final de la ficha: antes del «layout» si lo hay, que es un bloque
        # sangrado y no una fila.
        ya = {c["clave"] for c in viejos.values()}
        nuevos = [escribir_valor(clave.strip(), valor) for clave, valor in campos_nuevos.items()
                  if clave not in ya and clave.strip() and valor.strip()]
        donde = next((n for n, l in enumerate(salida) if re.match(r"^layout\s*:\s*$", l)), len(salida))
        salida[donde:donde] = nuevos
        nueva_cabecera = "---\n" + "\n".join(salida) + "\n---\n"
    else:
        nueva_cabecera = ""
    # El texto: los apartados que no han cambiado, tal cual estaban (con
    # sus líneas en blanco); los que sí, con su título, sus notas y lo
    # nuevo, respetando si llevaba una línea en blanco debajo del título y
    # otra antes del siguiente.
    lineas = []
    for n, ap in enumerate(leer_cuerpo(cuerpo)):
        propias = ([ap["linea"]] if ap["nivel"] else []) + ap["lineas"]
        nuevo = apartados_nuevos[n] if n < len(apartados_nuevos) else ap["texto"]
        nuevo = (nuevo or "").replace("\r", "").strip("\n")
        if nuevo.strip() == ap["texto"].strip():
            lineas += propias
            continue
        hecho = [ap["linea"]] if ap["nivel"] else []
        if ap["lineas"] and not ap["lineas"][0].strip():
            hecho.append("")
        for nota in ap["notas"]:
            hecho += nota.split("\n")
        if nuevo.strip():
            hecho += nuevo.split("\n")
        # Una en blanco antes del siguiente título (o al final).
        hecho.append("")
        lineas += hecho
    nuevo_cuerpo = "\n".join(lineas)
    if not nuevo_cuerpo.endswith("\n"):
        nuevo_cuerpo += "\n"
    return nueva_cabecera + nuevo_cuerpo, crlf


# =========================================
# CREAR
# =========================================

def plantillas():
    salida = []
    for p in npw.leer_plantillas():
        preguntas = []
        for tipo, clave, texto in p["preguntas"]:
            una = {"tipo": tipo, "clave": clave, "texto": texto}
            if tipo == "elige":
                trozos = [t.strip() for t in texto.split("|")]
                una["texto"] = trozos[0]
                una["opciones"] = [{"valor": (o.split("=", 1) + [o])[0], "uno": (o.split("=", 1) + [o])[1]}
                                   for o in trozos[1:] if o]
            preguntas.append(una)
        salida.append({"id": p["archivo"].name, "nombre": p["nombre"], "para": p["para"],
                       "oculta": p["oculta"], "especial": p["especial"], "preguntas": preguntas})
    return salida


def nombre_valido(nombre):
    nombre = (nombre or "").strip()
    if not nombre:
        return "Hace falta un nombre."
    malos = [c for c in nombre if c in npw.PROHIBIDO]
    if malos:
        return "El nombre no puede llevar %s: es también el nombre del archivo." % " ".join(malos)
    if npw.pagina_llamada(nombre):
        return "Ya hay una página que se llama así."
    return ""


def crear_desde(plantilla, nombre, respuestas, fijos=None):
    valores = {"nombre": nombre}
    valores.update(fijos or {})
    sin_enlace = set()
    for tipo, clave, texto in plantilla["preguntas"]:
        if clave in valores:
            continue
        valor = str(respuestas.get(clave, "") or "").strip().strip("[]").strip()
        if tipo == "elige":
            valores[clave] = valor
            valores[clave + "_uno"] = str(respuestas.get(clave + "_uno", "") or valor).strip()
            continue
        otra = npw.pagina_llamada(valor) if valor else None
        if otra:
            valores[clave] = otra.stem
        else:
            valores[clave] = valor
            if valor and tipo == "busca":
                sin_enlace.add(clave)
    carpeta = npw.carpeta_de(plantilla, valores)
    texto = npw.rellenar(plantilla, valores, sin_enlace)
    subtitulo = str(respuestas.get("_subtitulo", "") or "").strip()
    return carpeta, npw.con_subtitulo(texto, subtitulo)


def escribir_nueva(nombre, carpeta, texto):
    destino = VAULT / carpeta / (nombre + ".md")
    destino.parent.mkdir(parents=True, exist_ok=True)
    escribir_texto(destino, texto)
    # Si estaba en la lista de lo que no se publica, fuera de ella (lo
    # mismo que nueva-pagina-wiki.py).
    relativo = destino.relative_to(VAULT).as_posix()
    reglas = wiki_fuera()
    if esta_fuera(relativo, reglas):
        quedan = [r for r in reglas if r.lower() != relativo.lower()]
        if not esta_fuera(relativo, quedan):
            guardar_wiki_fuera(quedan)
    return destino


def crear(peticion):
    nombre = str(peticion.get("nombre") or "").strip()
    malo = nombre_valido(nombre)
    if malo:
        return {"error": malo}
    respuestas = peticion.get("respuestas") or {}
    lista = npw.leer_plantillas()
    elegida = next((p for p in lista if p["archivo"].name == peticion.get("plantilla")), None)
    if elegida is None:
        carpeta = "otros"
        etiqueta = str(respuestas.get("_etiqueta") or "lugar").strip()
        texto = npw.esqueleto(nombre, etiqueta, str(respuestas.get("_subtitulo") or "").strip(),
                              str(respuestas.get("_que") or "").strip())
        return {"ok": True, "archivo": escribir_nueva(nombre, carpeta, texto).relative_to(RAIZ).as_posix()}
    creadas = []
    if elegida["especial"] == "raza":
        # Raza o subraza (ver flujo_de_raza en nueva-pagina-wiki.py).
        modo = str(respuestas.get("_raza_modo") or "raza")
        subraza = next((p for p in lista if p["especial"] == "subraza"), None)
        if modo != "raza" and subraza:
            raza = str(respuestas.get("_raza_de") or "").strip()
            if modo == "nueva":
                malo = nombre_valido(raza)
                if malo:
                    return {"error": "La raza nueva: " + malo}
                carpeta_r, texto_r = crear_desde(elegida, raza, {})
                creadas.append(escribir_nueva(raza, carpeta_r, texto_r))
            elif not npw.pagina_llamada(raza):
                return {"error": "Elige de qué raza es."}
            else:
                raza = npw.pagina_llamada(raza).stem
            elegida, respuestas = subraza, dict(respuestas, raza=raza)
    carpeta, texto = crear_desde(elegida, nombre, respuestas,
                                 {"raza": respuestas.get("raza", "")} if elegida["especial"] == "subraza" else None)
    destino = escribir_nueva(nombre, carpeta, texto)
    return {"ok": True, "archivo": destino.relative_to(RAIZ).as_posix(),
            "tambien": [c.relative_to(RAIZ).as_posix() for c in creadas]}


# =========================================
# LAS IMÁGENES
# =========================================

def archivo_temporal(crudo, sufijo):
    """La imagen subida, en un archivo temporal para traer() (que trabaja
    con rutas). mkstemp lo deja ABIERTO: hay que cerrarlo, que en Windows
    un archivo abierto no se puede ni leer desde otro sitio ni borrar
    («[WinError 32] … está siendo utilizado por otro proceso»)."""
    descriptor, ruta = tempfile.mkstemp(suffix=sufijo)
    with os.fdopen(descriptor, "wb") as archivo:
        archivo.write(crudo)
    return Path(ruta)


def borrar_temporal(temporal):
    """Lo borra si puede. Si Windows aún lo tiene agarrado (un antivirus
    mirándolo, por ejemplo), se queda en la carpeta temporal, que ya se
    vacía sola: no es motivo para que falle la subida."""
    if temporal:
        try:
            temporal.unlink()
        except OSError:
            pass


def subir_imagen(peticion):
    try:
        import imagenes as img
    except ImportError:
        return {"error": "No encuentro herramientas/imagenes.py."}
    campo = str(peticion.get("campo") or "image").lower()
    titulo = str(peticion.get("pagina") or "imagen")
    carpeta = "wiki/_imagenes/banderas" if campo in ("bandera", "blasón", "blason", "escudo") else "wiki/_imagenes"
    sufijo = "" if campo in ("image",) else ("_" + sin_tildes(campo).lower())
    nombre = img.nombre_para(titulo, sufijo)
    ruta = str(peticion.get("ruta") or "").strip()
    temporal = None
    try:
        if not ruta:
            datos = str(peticion.get("datos") or "")
            original = str(peticion.get("archivo") or "imagen.png")
            if "," in datos:
                datos = datos.split(",", 1)[1]
            try:
                crudo = base64.b64decode(datos, validate=True)
            except ValueError:
                return {"error": "La imagen no ha llegado bien."}
            if len(crudo) > 40 * 1024 * 1024:
                return {"error": "Es demasiado grande (más de 40 MB)."}
            temporal = archivo_temporal(crudo, Path(original).suffix.lower() or ".png")
            ruta = str(temporal)
        hecha, aviso = img.traer(ruta, carpeta, nombre, lado=1600)
    finally:
        borrar_temporal(temporal)
    if not hecha:
        return {"error": "No he podido traerla: " + aviso}
    return {"ok": True, "nombre": Path(hecha).name, "aviso": aviso}


# =========================================
# LOS MAPAS
# =========================================
# Los .cmap de la bóveda (el formato está explicado en
# herramientas/3-generadores/mundo_mapas.py). El editor los lee enteros y
# los devuelve enteros: lo que no conoce (lo que escribió Chronicler) va y
# vuelve sin tocar. Aquí solo se comprueba que lo que llega es un mapa y
# que se escribe dentro de la bóveda.

CARPETA_MAPAS = "wiki/_imagenes/mapas"
# Las imágenes de mapa, a su tamaño (o hasta este lado): un mapa encogido
# a 1600 se queda sin detalle al acercarse.
LADO_MAPA = 4096


def _leer_cmap(archivo):
    try:
        datos = json.loads(archivo.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return datos if isinstance(datos, dict) else None


def mapas_que_hay():
    salida = []
    for archivo in sorted(VAULT.rglob("*.cmap"), key=lambda a: a.stem.lower()):
        datos = _leer_cmap(archivo)
        if datos is None:
            continue
        salida.append({"archivo": archivo.relative_to(VAULT).as_posix(),
                       "titulo": str(datos.get("title") or archivo.stem),
                       "pagina": str(datos.get("page") or ""),
                       "pines": len(datos.get("pins") or []),
                       "regiones": len(datos.get("shapes") or []),
                       "rayas": len(datos.get("lines") or [])})
    return salida


def mapas_de(nombre):
    """Los mapas que dicen ser de esta página ("page")."""
    clave = sin_tildes(nombre).lower()
    return [m for m in mapas_que_hay() if sin_tildes(m["pagina"]).lower() == clave]


def ruta_de_mapa(relativo):
    """El .cmap que se pide, si es un .cmap de dentro de la bóveda."""
    relativo = str(relativo or "").replace("\\", "/").strip("/")
    if not relativo.lower().endswith(".cmap"):
        return None
    archivo = (VAULT / relativo).resolve()
    try:
        archivo.relative_to(VAULT.resolve())
    except ValueError:
        return None
    return archivo if archivo.is_file() else None


def url_de_imagen(nombre):
    """Dónde la sirve el editor: se busca por el nombre en wiki/_imagenes/
    (igual que hace generar-mundo con las capas)."""
    nombre = str(nombre or "").replace("\\", "/").split("/")[-1].lower()
    if not nombre or not IMAGENES.is_dir():
        return ""
    for archivo in sorted(IMAGENES.rglob("*")):
        if archivo.name.lower() == nombre:
            return "/" + urllib.parse.quote(archivo.relative_to(RAIZ).as_posix())
    return ""


def leer_mapa(archivo):
    datos = _leer_cmap(archivo)
    if datos is None:
        return {"error": "Ese mapa no se puede leer: no es un JSON que entienda."}
    capas = [c for c in datos.get("layers") or [] if isinstance(c, dict)]
    return {"archivo": archivo.relative_to(VAULT).as_posix(), "datos": datos,
            "imagenes": {str(c.get("image")): url_de_imagen(c.get("image")) for c in capas if c.get("image")},
            "url": url_de_la_pagina(str(datos.get("title") or archivo.stem))}


def _lista_de_puntos(puntos):
    return isinstance(puntos, list) and all(
        isinstance(p, dict) and isinstance(p.get("x"), (int, float)) and isinstance(p.get("y"), (int, float))
        for p in puntos)


def guardar_mapa(archivo, datos):
    """Comprueba que es un mapa (medidas, y listas de cosas con
    coordenadas) y lo escribe."""
    if not isinstance(datos, dict):
        return {"error": "Lo que ha llegado no es un mapa."}
    for medida in ("width", "height"):
        if not isinstance(datos.get(medida), (int, float)) or datos[medida] <= 0:
            return {"error": "El mapa no dice cuánto mide."}
    for lista in ("pins", "shapes", "lines", "layers"):
        if not isinstance(datos.get(lista, []), list):
            return {"error": "El mapa ha llegado roto (%s)." % lista}
    for pin in datos.get("pins") or []:
        if not (isinstance(pin, dict) and isinstance(pin.get("x"), (int, float))
                and isinstance(pin.get("y"), (int, float))):
            return {"error": "Hay un sitio sin coordenadas."}
    for cosa in (datos.get("shapes") or []) + (datos.get("lines") or []):
        if not (isinstance(cosa, dict) and _lista_de_puntos(cosa.get("points"))):
            return {"error": "Hay una región o una raya con puntos raros."}
    # Escrito como lo escribe Chronicler (sangrado de dos, sin \u00 en las
    # tildes), con sus saltos de línea de Windows si los tenía y el salto
    # del final solo si lo tenía: que el archivo cambie por lo cambiado y
    # nada más.
    final = "\n" if archivo.read_bytes().endswith(b"\n") else ""
    escribir_como_estaba(archivo, json.dumps(datos, ensure_ascii=False, indent=2) + final)
    return {"ok": True, "mapa": leer_mapa(archivo)}


def traer_imagen_de_mapa(peticion, nombre):
    """La imagen que llega (subida o por su ruta) a wiki/_imagenes/mapas/.
    Devuelve {nombre, ancho, alto, url} o {error}."""
    try:
        import imagenes as img
    except ImportError:
        return {"error": "No encuentro herramientas/imagenes.py."}
    ruta = str(peticion.get("ruta") or "").strip()
    temporal = None
    try:
        if not ruta:
            datos = str(peticion.get("datos") or "")
            if not datos:
                return {"error": "Falta la imagen del mapa."}
            original = str(peticion.get("archivo") or "mapa.png")
            if "," in datos:
                datos = datos.split(",", 1)[1]
            try:
                crudo = base64.b64decode(datos, validate=True)
            except ValueError:
                return {"error": "La imagen no ha llegado bien."}
            if len(crudo) > 40 * 1024 * 1024:
                return {"error": "Es demasiado grande (más de 40 MB)."}
            temporal = archivo_temporal(crudo, Path(original).suffix.lower() or ".png")
            ruta = str(temporal)
        hecha, aviso = img.traer(ruta, CARPETA_MAPAS, img.nombre_para(nombre, "_mapa"), lado=LADO_MAPA)
    finally:
        borrar_temporal(temporal)
    if not hecha:
        return {"error": "No he podido traerla: " + aviso}
    archivo = RAIZ / CARPETA_MAPAS / Path(hecha).name
    try:
        from PIL import Image
        with Image.open(archivo) as abierta:
            ancho, alto = abierta.size
    except Exception as error:  # Pillow ya la ha abierto para convertirla: no debería pasar
        return {"error": "No sé cuánto mide la imagen: %s" % error}
    return {"ok": True, "nombre": archivo.name, "ancho": ancho, "alto": alto,
            "url": url_de_imagen(archivo.name), "aviso": aviso}


# Con artículo si empieza por un nombre común: «Mapa del Reino de
# Prunia», «Mapa de la Unión de Cuerza», «Mapa de la Tribu Utná», pero
# «Mapa de Azarasia». Es nombre común si es uno de éstos o si va seguido
# de «de» («Paraje de Cereno»). Femeninas las acabadas en -a, -ión, -dad
# y -tad, y las de FEMENINAS.
COMUNES = {"reino", "república", "imperio", "principado", "sultanato", "unión", "cantón", "tribu",
           "archipiélago", "alianza", "liga", "horda", "mandato", "maharato", "páramo", "valle", "isla",
           "ciudad", "bosque", "montaña", "desierto", "mar", "costa", "ducado", "condado", "baronía",
           "marquesado", "señorío", "corona", "territorio", "dominio", "confederación", "federación"}
FEMENINAS = {"tribu", "costa", "torre", "fuente", "corte", "cuna"}


def titulo_por_defecto(nombre):
    palabras = nombre.split()
    primera = palabras[0].lower() if palabras else ""
    sin_plural = primera[:-1] if primera.endswith("s") and len(primera) > 3 else primera
    comun = sin_plural in COMUNES or (len(palabras) >= 3 and palabras[1].lower() in ("de", "del"))
    if not comun:
        return "Mapa de " + nombre
    singular = sin_plural
    femenina = (singular in FEMENINAS or singular.endswith(("a", "ión", "dad", "tad")))
    articulo = ("de las " if femenina else "de los ") if singular != primera else ("de la " if femenina else "del ")
    return "Mapa " + articulo + nombre


def nuevo_mapa(peticion):
    """Un .cmap nuevo con una imagen de fondo y nada encima, en la carpeta
    de su página (o en la raíz de la bóveda si no es de ninguna)."""
    pagina = str(peticion.get("pagina") or "").strip()
    titulo = str(peticion.get("titulo") or "").strip()
    archivo_pagina = npw.pagina_llamada(pagina) if pagina else None
    if pagina and not archivo_pagina:
        return {"error": "No hay ninguna página que se llame «%s»." % pagina}
    if archivo_pagina:
        pagina = archivo_pagina.stem
    nombre = pagina or titulo
    if not nombre:
        return {"error": "Hace falta la página del mapa o, si no es de ninguna, su título."}
    malos = [c for c in nombre if c in npw.PROHIBIDO]
    if malos:
        return {"error": "El título no puede llevar %s: es también el nombre del archivo." % " ".join(malos)}
    carpeta = archivo_pagina.parent if archivo_pagina else VAULT
    destino = carpeta / (nombre + ".cmap")
    if destino.exists():
        return {"error": "Ya hay un mapa así: %s. Ábrelo desde la lista de mapas."
                % destino.relative_to(VAULT).as_posix()}
    imagen = traer_imagen_de_mapa(peticion, nombre)
    if imagen.get("error"):
        return imagen
    datos = {"version": "1.0", "title": titulo or titulo_por_defecto(nombre)}
    if pagina:
        datos["page"] = pagina
    datos.update({"width": imagen["ancho"], "height": imagen["alto"],
                  "layers": [{"id": "base", "name": "Mapa", "image": imagen["nombre"], "opacity": 1,
                              "zIndex": 0, "visible": True}],
                  "pins": [], "shapes": [], "lines": []})
    escribir_texto(destino, json.dumps(datos, ensure_ascii=False, indent=2) + "\n")
    return {"ok": True, "mapa": leer_mapa(destino)}


# =========================================
# PASAR A LA WEB
# =========================================

PASAR_LOCK = threading.Lock()
SCRIPTS_DE_PASAR = ("3-generadores/generar-mundo.py", "3-generadores/actualizar-cabeceras.py")
# Lo que se apuntó la última vez (cuántas líneas escribió cada script y
# cuánto tardó), para que la barra de progreso sepa cuánto le queda.
ULTIMA_PASADA = Path(tempfile.gettempdir()) / "editor-wiki-ultima-pasada.json"
# Cómo va lo que se está pasando ahora; lo lee /api/pasar/estado.
PASADA = {"activa": False, "fase": "", "porcentaje": 0, "terminado": True, "resultado": None}


def _ultima_pasada():
    try:
        datos = json.loads(ULTIMA_PASADA.read_text(encoding="utf-8"))
        return datos if isinstance(datos, dict) else {}
    except (OSError, ValueError):
        return {}


def pasar_a_la_web(al_avanzar=None):
    """Pasa la wiki a la web (generar-mundo.py y actualizar-cabeceras.py)
    leyendo lo que escriben según lo escriben. al_avanzar(fase,
    porcentaje): cuánto va. Se cuenta por el TIEMPO que lleva cada script
    comparado con lo que tardó la última vez (y por las líneas que lleva
    escritas, si van más deprisa): solo con las líneas la barra iba a
    saltos, porque los scripts escriben casi todo al final. La primera
    vez, a ojo. Nunca pasa de 99 hasta que termina de verdad."""
    if not PASAR_LOCK.acquire(blocking=False):
        return {"error": "Ya se está pasando la wiki; espera a que termine."}
    try:
        antes = _ultima_pasada()
        lineas_antes = {s: int(antes.get(s, {}).get("lineas") or 0) for s in SCRIPTS_DE_PASAR}
        tiempos = {s: float(antes.get(s, {}).get("segundos") or 0) for s in SCRIPTS_DE_PASAR}
        total_tiempo = sum(tiempos.values())
        # Cuánto de la barra le toca a cada script: lo que tardó la última
        # vez (la primera, más o menos lo de siempre: el primero tarda más).
        pesos = ([tiempos[s] / total_tiempo for s in SCRIPTS_DE_PASAR] if total_tiempo > 0 and all(tiempos.values())
                 else [0.65, 0.35])
        nombres = {"generar-mundo.py": "Montando las páginas de la wiki",
                   "actualizar-cabeceras.py": "Poniendo las cabeceras y los menús"}
        salida, apuntado, hecho_antes = [], {}, 0.0
        entorno = dict(os.environ, PYTHONUNBUFFERED="1", PYTHONIOENCODING="utf-8")
        for n, script in enumerate(SCRIPTS_DE_PASAR):
            nombre = script.split("/")[-1]
            fase = nombres.get(nombre, nombre)
            esperadas = lineas_antes[script] or (400 if n == 0 else 250)
            segundos = tiempos[script] or (30.0 if n == 0 else 10.0)
            if al_avanzar:
                al_avanzar(fase, round(hecho_antes * 100))
            empieza = time.monotonic()
            proceso = subprocess.Popen([sys.executable, str(HERRAMIENTAS / script)], cwd=RAIZ,
                                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                                       encoding="utf-8", errors="replace", env=entorno)
            reloj = threading.Timer(900, proceso.kill)
            reloj.start()
            lineas = []

            def contar(n=n, fase=fase, empieza=empieza, base=hecho_antes):
                # Cada cuarto de segundo, mientras el script siga.
                while proceso.poll() is None:
                    parte = min(0.97, max((time.monotonic() - empieza) / segundos, len(lineas) / esperadas))
                    if al_avanzar:
                        al_avanzar(fase, min(99, round((base + pesos[n] * parte) * 100)))
                    time.sleep(0.25)

            contador = threading.Thread(target=contar, daemon=True)
            contador.start()
            try:
                for linea in proceso.stdout:
                    lineas.append(linea.rstrip("\n"))
                proceso.wait()
            finally:
                reloj.cancel()
                contador.join(timeout=1)
            apuntado[script] = {"lineas": len(lineas), "segundos": round(time.monotonic() - empieza, 1)}
            hecho_antes += pesos[n]
            utiles = [l for l in lineas if l.strip()]
            salida.append(nombre + ":\n" + "\n".join(utiles[-12:]))
            if proceso.returncode:
                return {"error": "Algo ha fallado al pasar la wiki.", "salida": "\n\n".join(salida)}
        try:
            ULTIMA_PASADA.write_text(json.dumps(apuntado), encoding="utf-8")
        except OSError:
            pass
        return {"ok": True, "salida": "\n\n".join(salida)}
    finally:
        PASAR_LOCK.release()


def empezar_a_pasar(peticion):
    """Pasa la wiki en otro hilo y vuelve enseguida: el editor va
    preguntando a /api/pasar/estado cómo va (para la barra de progreso)."""
    if PASADA["activa"]:
        return {"empezado": True, "ya": True}
    nombre = str(peticion.get("nombre") or "")
    mapa = ruta_de_mapa(peticion.get("mapa"))
    PASADA.update({"activa": True, "fase": "Empezando", "porcentaje": 0, "terminado": False, "resultado": None})

    def avanzar(fase, porcentaje):
        PASADA["fase"], PASADA["porcentaje"] = fase, porcentaje

    def trabajar():
        try:
            hecho = pasar_a_la_web(avanzar)
            if nombre:
                hecho["url"] = url_de_la_pagina(nombre)
            if mapa:
                datos = _leer_cmap(mapa) or {}
                hecho["url"] = url_de_la_pagina(str(datos.get("title") or mapa.stem))
        except Exception as error:  # que el editor lo cuente y no se quede esperando
            hecho = {"error": "Algo ha fallado: %s" % error}
        PASADA.update({"activa": False, "terminado": True, "porcentaje": 100, "resultado": hecho})

    threading.Thread(target=trabajar, daemon=True).start()
    return {"empezado": True}


# =========================================
# EL SERVIDOR
# =========================================

class Editor(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Lo de fuera de /editor/ es el sitio tal cual: así «ver cómo
        # queda» abre la página de verdad, con sus estilos.
        super().__init__(*args, directory=str(RAIZ), **kwargs)

    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, datos, estado=200):
        cuerpo = json.dumps(datos, ensure_ascii=False).encode("utf-8")
        self.send_response(estado)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def _permitido(self):
        # La contraseña, y que se le hable como 127.0.0.1 o localhost: una
        # web de fuera que se haga pasar por este ordenador (lo que se
        # llama «DNS rebinding») llegaría con otro nombre.
        anfitrion = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]").lower()
        return (anfitrion in ("127.0.0.1", "localhost")
                and secrets.compare_digest(self.headers.get("X-Editor", ""), TOKEN))

    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)
        if url.path in ("/", "/editor", "/editor/"):
            return self._archivo(CARPETA_EDITOR / "editor.html", "text/html; charset=utf-8")
        if url.path.startswith("/editor/"):
            nombre = url.path[len("/editor/"):]
            tipos = {"editor.css": "text/css; charset=utf-8", "editor.js": "text/javascript; charset=utf-8",
                     "mapas.js": "text/javascript; charset=utf-8"}
            if nombre in tipos:
                return self._archivo(CARPETA_EDITOR / nombre, tipos[nombre])
            return self._json({"error": "no existe"}, 404)
        if url.path.startswith("/api/"):
            if not self._permitido():
                return self._json({"error": "Falta la contraseña del editor: recarga la página (o vuelve a"
                                   " abrir la dirección que sale al arrancarlo)."}, 403)
            pregunta = urllib.parse.parse_qs(url.query)
            if url.path == "/api/inicio":
                return self._json({
                    "plantillas": plantillas(),
                    "paginas": [a.stem for a in todas()],
                    "razas": npw.razas_que_hay(),
                    "faltan": [{"nombre": n, "veces": v} for n, v in paginas_que_faltan()[:200]],
                    "imagenes": imagenes_que_hay(),
                })
            if url.path == "/api/pagina":
                nombre = (pregunta.get("nombre") or [""])[0]
                archivo = npw.pagina_llamada(nombre)
                if not archivo:
                    parecidas = difflib.get_close_matches(nombre, [a.stem for a in todas()], 5, 0.5)
                    return self._json({"error": "No hay ninguna página que se llame «%s»." % nombre,
                                       "parecidas": parecidas}, 404)
                return self._json(dict(leer_pagina(archivo), mapas=mapas_de(archivo.stem)))
            if url.path == "/api/pasar/estado":
                return self._json({k: PASADA[k] for k in ("activa", "fase", "porcentaje", "terminado", "resultado")})
            if url.path == "/api/mapas":
                return self._json({"mapas": mapas_que_hay()})
            if url.path == "/api/mapa":
                archivo = ruta_de_mapa((pregunta.get("archivo") or [""])[0])
                if not archivo:
                    return self._json({"error": "Ese mapa no está."}, 404)
                return self._json(leer_mapa(archivo))
            return self._json({"error": "no existe"}, 404)
        # El sitio: sin las herramientas ni lo escondido.
        # (Las imágenes de la wiki sí: el editor enseña la que pone cada
        # casilla.)
        if url.path.startswith(("/herramientas", "/.git")) or (
                url.path.startswith("/wiki/") and not url.path.startswith("/wiki/_imagenes/")):
            return self._json({"error": "no existe"}, 404)
        return super().do_GET()

    def do_POST(self):
        url = urllib.parse.urlsplit(self.path)
        if not self._permitido():
            return self._json({"error": "Falta la contraseña del editor."}, 403)
        largo = int(self.headers.get("Content-Length") or 0)
        if largo > 60 * 1024 * 1024:
            return self._json({"error": "Demasiado grande."}, 413)
        try:
            peticion = json.loads(self.rfile.read(largo).decode("utf-8") or "{}")
        except ValueError:
            return self._json({"error": "No entiendo lo que ha llegado."}, 400)
        try:
            if url.path == "/api/crear":
                return self._json(crear(peticion))
            if url.path == "/api/guardar":
                archivo = npw.pagina_llamada(str(peticion.get("nombre") or ""))
                if not archivo:
                    return self._json({"error": "Esa página ya no está."})
                campos = {str(k): str(v) for k, v in (peticion.get("campos") or {}).items()}
                apartados = [str(t) for t in peticion.get("apartados") or []]
                texto, crlf = juntar(archivo, campos, apartados)
                escribir_texto(archivo, texto, crlf)
                return self._json({"ok": True, "pagina": leer_pagina(archivo)})
            if url.path == "/api/imagen":
                return self._json(subir_imagen(peticion))
            if url.path == "/api/mapa/nuevo":
                return self._json(nuevo_mapa(peticion))
            if url.path in ("/api/mapa/guardar", "/api/mapa/imagen"):
                # (En la de la imagen, «archivo» es cómo se llamaba la
                # imagen subida; el mapa va en «mapa».)
                archivo = ruta_de_mapa(peticion.get("mapa" if url.path == "/api/mapa/imagen" else "archivo"))
                if not archivo:
                    return self._json({"error": "Ese mapa ya no está."})
                if url.path == "/api/mapa/imagen":
                    return self._json(traer_imagen_de_mapa(peticion, archivo.stem))
                return self._json(guardar_mapa(archivo, peticion.get("datos")))
            if url.path == "/api/pasar":
                return self._json(empezar_a_pasar(peticion))
        except Exception as error:  # que el editor diga qué ha pasado, y no se quede colgado
            return self._json({"error": "Algo ha fallado: %s" % error}, 500)
        return self._json({"error": "no existe"}, 404)

    def _archivo(self, ruta, tipo):
        cuerpo = ruta.read_bytes()
        if ruta.name == "editor.html":
            cuerpo = cuerpo.replace(b"{{TOKEN}}", TOKEN.encode("ascii"))
        self.send_response(200)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)


def puerto_libre(desde=8765):
    for puerto in range(desde, desde + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", puerto))
                return puerto
            except OSError:
                continue
    return 0


def main():
    puerto = puerto_libre()
    servidor = ThreadingHTTPServer(("127.0.0.1", puerto), Editor)
    direccion = "http://127.0.0.1:%d/editor/" % servidor.server_address[1]
    print("\n  ==================================")
    print("  EL EDITOR DE LA WIKI")
    print("  ==================================")
    print("\n  Abierto en el navegador. Si no se ha abierto solo, copia esto en él:")
    print("\n     " + direccion)
    print("\n  Para cerrarlo: Ctrl+C aquí (o cierra esta ventana).")
    if "--sin-navegador" not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(direccion)).start()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\n  Cerrado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
