#!/usr/bin/env python3
# =========================================
# ENLACES ROTOS — ¿apunta todo a algo que existe?
# =========================================
# Recorre el sitio entero y comprueba, uno por uno, que cada cosa a la
# que se apunta está de verdad ahí: los enlaces entre páginas, las
# imágenes, los CSS, los JS, las fuentes, los fragmentos y las rutas
# que llevan dentro los .json de datos/.
#
# POR QUÉ HACE FALTA
# ------------------
# En un sitio hecho a mano no hay nada que avise: una carpeta renombrada,
# una foto que se borró o un .css que se subió con otro nombre no dan
# ningún error al abrir la página. Sencillamente la imagen no sale, o el
# estilo no se aplica, y eso solo se ve si pasas por esa página concreta
# y te fijas. Ya pasó una vez con un CSS que no se había subido bien:
# la página se veía sin estilos y el código estaba perfecto. Esto lo
# habría dicho en dos segundos.
#
# CÓMO USARLO
# -----------
#     python herramientas/4-comprobar/enlaces-rotos.py
#
# No toca nada: solo mira y cuenta. Vale la pena pasarlo antes de subir.
#
#     python herramientas/4-comprobar/enlaces-rotos.py --externos
#
# Además comprueba los enlaces de fuera (Ko-fi, Bluesky, Goodreads...)
# pidiéndoselos a internet. Va más lento y hay webs que contestan raro
# a un programa, así que lo que diga de estos es "mira a ver", no
# "está roto".
#
# QUÉ MIRA Y QUÉ NO
# -----------------
# - Mira href, src, srcset, poster, las og:image, los url() de los CSS,
#   las rutas escritas en los .js y las de los .json de datos/.
# - En los .js no cuenta lo que esté dentro de un comentario (había un
#   ejemplo inventado que salía siempre como roto), ni las rutas que se
#   montan con ${...}, porque hasta que no corre el navegador no se sabe
#   cómo quedan.
# - Las anclas (#algo) se comprueban también, mirando si existe ese id
#   en la página de destino o en los fragmentos que se inyectan.
# - El ?v= de las direcciones se ignora: es la marca anti-caché que pone
#   actualizar-cabeceras.py, no parte del nombre del archivo.
# - Al final lista los archivos a los que no apunta nadie. Ojo con esa
#   lista: que algo no esté enlazado no significa que sobre (puede ser
#   una página que se comparte a mano), pero suele delatar lo que quedó
#   de una prueba.

import sys
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import json
import re

from comun import RAIZ

# Las direcciones absolutas del propio sitio también se comprueban: en
# las cabeceras hay bastantes (canonical, og:image, el RSS) y ahí es
# facilísimo dejar una ruta vieja, porque el navegador nunca las abre.
DOMINIOS = (
    "https://www.richi.blog",
    "https://richi.blog",
    "http://www.richi.blog",
    "http://richi.blog",
)

# Carpetas que no forman parte de lo que se sube.
FUERA = {"herramientas", "__pycache__", ".git", "node_modules"}

# Páginas y archivos a los que puede no apuntar nadie y están bien así:
# son puertas de entrada (las abre el navegador, el buscador o el lector
# de RSS por su cuenta).
ENTRADAS = {
    "index.html",
    "not_found.html",
    "robots.txt",
    "sitemap.xml",
    "blog/rss.xml",
}

# Lo que no es un enlace a un archivo del sitio.
OTROS_ESQUEMAS = ("mailto:", "tel:", "javascript:", "data:", "blob:", "#")

# Qué archivos se leen buscando referencias, y con qué.
EXT_HTML = {".html"}
EXT_CSS = {".css"}
EXT_JS = {".js"}
EXT_JSON = {".json"}
EXT_XML = {".xml"}
# Lo que puede aparecer en un .json como nombre suelto, sin carpeta.
EXT_MEDIA = {".webp", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".avif", ".ico", ".mp4", ".mp3", ".pdf"}

# Dónde se busca lo que no usa nadie. datos/ y fragmentos/ entran porque
# a esos sí les apunta siempre algo (un script o una página); imagenes/,
# estilos/, scripts/ y tipografias/ son donde se acumula lo que sobra.
CARPETAS_HUERFANOS = ("imagenes", "estilos", "scripts", "tipografias", "fragmentos", "datos", "ligero")

# Archivos que no enlaza ninguna página A PROPÓSITO, porque quien los lee
# es una herramienta y no el navegador. Sin esto salen en la lista de "no
# apunta nadie" cada vez, y una lista con ruido se deja de mirar.
LOS_LEEN_LAS_HERRAMIENTAS = {
    # Los apartados de la portada del mundo: los lee
    # 3-generadores/generar-mundo.py al escribir datos/wiki/mundo.json.
    "datos/wiki/mundo-categorias.json",
    # Los eventos de la línea de tiempo: los leen
    # 3-generadores/generar-linea-tiempo.py y 1-publicar/linea-de-tiempo.py.
    "datos/wiki/linea-de-tiempo.json",
    # Las hojas de la página de la línea de tiempo. Mientras no haya ningún
    # evento esa página no existe, y nadie las pide; con el primero, sí.
    "estilos/paginas/mundo-linea.css",
    "estilos/paginas/mundo-linea.responsive.css",
}


# =========================================
# SACAR LAS REFERENCIAS DE CADA TIPO DE ARCHIVO
# =========================================

RE_ATRIBUTOS = re.compile(
    # data-reto-datos, data-campana-datos, data-npcs-datos,
    # data-ando-datos, data-mundo-datos y data-mundo-regiones-datos no son enlaces, pero apuntan al JSON del que esa
    # página saca su contenido: si se borra o se cambia de nombre, la
    # página se queda vacía y nadie se entera. Van aquí para que cuenten
    # como una referencia más.
    r"""\b(?:href|src|poster|data-reto-datos|data-campana-datos"""
    r"""|data-npcs-datos|data-ando-datos|data-mundo-datos|data-mundo-regiones-datos|data-mundo-categorias)"""
    r"""\s*=\s*["']([^"']*)["']""",
    re.I,
)
RE_SRCSET = re.compile(r"""\bsrcset\s*=\s*["']([^"']*)["']""", re.I)
RE_META_IMAGEN = re.compile(
    r"""<meta[^>]*\b(?:property|name)\s*=\s*["'](?:og:image|twitter:image)["'][^>]*"""
    r"""\bcontent\s*=\s*["']([^"']*)["']""",
    re.I,
)
RE_URL_CSS = re.compile(r"""url\(\s*["']?([^"')]+)["']?\s*\)""", re.I)
RE_IMPORT_CSS = re.compile(r"""@import\s+(?:url\()?["']([^"']+)["']""", re.I)
# Los paquetes (estilos/paquete-*.css, scripts/paquete-*.js) llevan en su
# cabecera la lista de los archivos que tienen pegados dentro, escrita por
# herramientas/3-generadores/actualizar-cabeceras.py. Eso cuenta como una
# referencia: desde que las páginas piden el paquete, nadie enlaza ya a
# base.css ni a tema.js, y sin esto salían los veintiséis en la lista de
# "archivos a los que no apunta nadie" justo cuando más se usan.
RE_FUENTE_PAQUETE = re.compile(r"^\s*fuente:\s*(/\S+)\s*$", re.M)
# En los .js solo se buscan rutas absolutas del sitio, que es como están
# escritas todas: "/datos/mis_movidas/rol.json", "/scripts/paginas/rol.js"...
RE_RUTA_JS = re.compile(r"""["'`](/[^"'`\s>]+\.[A-Za-z0-9]{2,5})["'`]""")


# Las direcciones VIEJAS de scripts/paginas/redirecciones.js (lo que hay a
# la izquierda de cada mudanza) no existen a propósito: son las que el 404
# manda a su sitio nuevo. No son enlaces rotos.
RE_MUDANZA = re.compile(r"""\[\s*["'`](/[^"'`]*)["'`]\s*,\s*["'`]/""")


def direcciones_que_se_mudan():
    viejas = set()
    for ruta in (RAIZ / "scripts" / "paginas" / "redirecciones.js",
                 RAIZ / "ligero" / "scripts" / "paginas" / "redirecciones.js"):
        if ruta.is_file():
            viejas.update(RE_MUDANZA.findall(ruta.read_text(encoding="utf-8")))
    return viejas


RE_COMENTARIO_HTML = re.compile(r"<!--.*?-->", re.S)


def linea_de(texto, posicion):
    return texto.count("\n", 0, posicion) + 1


def en_blanco(trozo):
    """El mismo trozo de texto en blanco, conservando los saltos de
    línea, para que los números de línea sigan cuadrando."""
    return "".join("\n" if c == "\n" else " " for c in trozo)


def sin_comentarios_html(texto):
    """Los comentarios de HTML, en blanco. En las entradas del blog hay
    bloques de ejemplo comentados (el <figure> con la imagen, con un
    nombre de archivo inventado) y salían los cuatro como enlaces rotos
    cuando en realidad el navegador no los mira."""
    return RE_COMENTARIO_HTML.sub(lambda m: en_blanco(m.group(0)), texto)


def de_html(texto):
    texto = sin_comentarios_html(texto)
    for regex in (RE_ATRIBUTOS, RE_META_IMAGEN, RE_URL_CSS):
        for m in regex.finditer(texto):
            yield linea_de(texto, m.start()), m.group(1)
    for m in RE_SRCSET.finditer(texto):
        # srcset="foto.webp 1x, foto@2x.webp 2x"
        for trozo in m.group(1).split(","):
            ruta = trozo.strip().split(" ")[0]
            if ruta:
                yield linea_de(texto, m.start()), ruta


def de_css(texto):
    for regex in (RE_URL_CSS, RE_IMPORT_CSS, RE_FUENTE_PAQUETE):
        for m in regex.finditer(texto):
            yield linea_de(texto, m.start()), m.group(1)


def sin_comentarios(codigo):
    """El mismo código con los comentarios en blanco (se cambian por
    espacios, no se borran, para que los números de línea sigan
    cuadrando). Hace falta porque en los comentarios hay rutas de
    ejemplo que no existen y salían todas como enlaces rotos.

    Va carácter a carácter en vez de con una expresión regular porque
    "https://ko-fi.com" lleva dos barras dentro de un texto y cualquier
    regex sencilla se lo come a partir de ahí."""
    fuera = []
    i = 0
    total = len(codigo)
    comilla = None
    while i < total:
        c = codigo[i]
        if comilla:
            if c == "\\":
                fuera.append(codigo[i:i + 2])
                i += 2
                continue
            if c == comilla:
                comilla = None
            fuera.append(c)
            i += 1
            continue
        if c in "\"'`":
            comilla = c
            fuera.append(c)
            i += 1
            continue
        if c == "/" and i + 1 < total and codigo[i + 1] == "/":
            fin = codigo.find("\n", i)
            fin = total if fin == -1 else fin
            fuera.append(" " * (fin - i))
            i = fin
            continue
        if c == "/" and i + 1 < total and codigo[i + 1] == "*":
            fin = codigo.find("*/", i + 2)
            fin = total if fin == -1 else fin + 2
            # los saltos de línea se conservan para no descuadrar el conteo
            fuera.append(en_blanco(codigo[i:fin]))
            i = fin
            continue
        fuera.append(c)
        i += 1
    return "".join(fuera)


def de_js(texto):
    for m in RE_FUENTE_PAQUETE.finditer(texto):
        yield linea_de(texto, m.start()), m.group(1)
    limpio = sin_comentarios(texto)
    for m in RE_RUTA_JS.finditer(limpio):
        ruta = m.group(1)
        if "${" in ruta or "+" in ruta:
            continue  # se monta al vuelo; hasta que no corre no se sabe
        yield linea_de(limpio, m.start()), ruta


def indice_nombres(cache={}):
    """Índice nombre de archivo -> dónde está, para las imágenes. Hace
    falta porque en datos/mi_rincon/fotos-santuarios.json las fotos se guardan solo
    con su nombre ("PXL_2026...webp"): la carpeta la monta el JavaScript
    con el nombre del gato, así que en el JSON no hay ninguna ruta que
    comprobar tal cual."""
    if not cache:
        for archivo in (RAIZ / "imagenes").rglob("*"):
            if archivo.is_file():
                cache.setdefault(archivo.name, []).append(archivo)
    return cache


def de_json(archivo, texto):
    """Cualquier texto de dentro del JSON que parezca una dirección. Se
    buscan en el JSON ya leído (no con una regex) para no confundir un
    trozo de HTML de una descripción con un enlace suelto."""
    try:
        datos = json.loads(texto)
    except json.JSONDecodeError as error:
        return [(1, None, f"el JSON no se entiende: {error}")]

    encontradas = []

    def mirar(cosa):
        if isinstance(cosa, dict):
            for valor in cosa.values():
                mirar(valor)
        elif isinstance(cosa, list):
            for valor in cosa:
                mirar(valor)
        elif isinstance(cosa, str):
            limpio = cosa.strip()
            if not limpio:
                return
            linea = linea_de(texto, texto.find(cosa))
            if limpio.startswith("/") or limpio.startswith("http"):
                encontradas.append((linea, limpio, None))
            elif "/" not in limpio and Path(limpio).suffix.lower() in EXT_MEDIA:
                # un nombre de archivo suelto: se busca dentro de imagenes/
                donde = indice_nombres().get(limpio)
                if donde:
                    for sitio in donde:
                        encontradas.append((linea, "/" + sitio.relative_to(RAIZ).as_posix(), None))
                else:
                    encontradas.append((linea, limpio, None))

    mirar(datos)
    return encontradas


RE_XML = re.compile(r"""(?:<loc>\s*([^<\s]+)\s*</loc>)|(?:\bhref\s*=\s*["']([^"']+)["'])""", re.I)


# Medias rutas: "/imagenes/main/pngtuber_white_theme", a la que el
# JavaScript le pega después "-412.webp" o ".webp" según el tamaño de la
# pantalla. No se pueden comprobar (no son un archivo), pero sí sirven
# para no dar por huérfanas las tres variantes de esa imagen.
RE_MEDIA_RUTA = re.compile(r"""["'`](/[A-Za-z0-9_][A-Za-z0-9_./-]*[A-Za-z0-9_])["'`]""")


def prefijos(texto, es_js):
    """Las medias rutas que hay escritas en un .js (o en un <script> de
    una página): las que no acaban en extensión."""
    limpio = sin_comentarios(texto) if es_js else sin_comentarios_html(texto)
    for m in RE_MEDIA_RUTA.finditer(limpio):
        ruta = m.group(1)
        if "." not in ruta.rsplit("/", 1)[-1]:
            yield ruta


def de_xml(texto):
    for m in RE_XML.finditer(texto):
        yield linea_de(texto, m.start()), m.group(1) or m.group(2)


# =========================================
# DECIDIR A QUÉ APUNTA CADA REFERENCIA
# =========================================

def partir(ref):
    """Quita el ?v= anti-caché y separa el #ancla."""
    ancla = ""
    if "#" in ref:
        ref, ancla = ref.split("#", 1)
    if "?" in ref:
        ref = ref.split("?", 1)[0]
    return ref, ancla


def clasificar(ref, origen):
    """Devuelve (tipo, destino, ancla). El tipo es 'interno', 'externo'
    o 'ignorar'. En los internos, destino es una ruta del disco."""
    ref = (ref or "").strip()
    if not ref:
        return "ignorar", None, ""
    if ref.startswith("#"):
        # ancla de la propia página
        return "interno", origen, ref[1:]
    if ref.lower().startswith(OTROS_ESQUEMAS):
        return "ignorar", None, ""

    for dominio in DOMINIOS:
        if ref.lower().startswith(dominio):
            ref = ref[len(dominio):] or "/"
            break
    else:
        if ref.startswith("//") or re.match(r"^[A-Za-z][A-Za-z0-9+.\-]*:", ref):
            return "externo", ref, ""

    camino, ancla = partir(ref)
    if not camino:
        return "interno", origen, ancla

    if camino.startswith("/"):
        destino = (RAIZ / camino.lstrip("/")).resolve()
    else:
        destino = (origen.parent / camino).resolve()

    return "interno", destino, ancla


def existe(destino):
    """La ruta que se sirve de verdad, o None si no hay nada. Una
    carpeta cuenta si dentro hay un index.html."""
    if destino.is_file():
        return destino
    if destino.is_dir():
        for nombre in ("index.html", f"index_{destino.name}.html"):
            if (destino / nombre).is_file():
                return destino / nombre
    return None


# =========================================
# ANCLAS
# =========================================

RE_IDS = re.compile(r"""\b(?:id|name)\s*=\s*["']([^"']+)["']""", re.I)


def ids_de(archivo, cache={}):
    if archivo not in cache:
        try:
            texto = archivo.read_text(encoding="utf-8", errors="replace")
        except OSError:
            texto = ""
        cache[archivo] = set(RE_IDS.findall(texto))
    return cache[archivo]


def ids_de_fragmentos():
    """Los id que traen los trozos de HTML que se inyectan con
    JavaScript (la barra lateral, las frases). No están en el archivo de
    la página, pero en el navegador sí existen."""
    ids = set()
    carpeta = RAIZ / "fragmentos"
    if carpeta.is_dir():
        for trozo in carpeta.glob("*.html"):
            ids |= ids_de(trozo)
    return ids


# =========================================
# RECORRER EL SITIO
# =========================================

def archivos_del_sitio():
    for ruta in sorted(RAIZ.rglob("*")):
        if not ruta.is_file():
            continue
        partes = set(ruta.relative_to(RAIZ).parts)
        if partes & FUERA:
            continue
        yield ruta


def referencias(medias_rutas=None):
    """Todas las referencias del sitio: (archivo, línea, referencia, queja).

    Si se le pasa un conjunto, va metiendo ahí las medias rutas que se
    completan con JavaScript."""
    for ruta in archivos_del_sitio():
        ext = ruta.suffix.lower()
        if ext not in EXT_HTML | EXT_CSS | EXT_JS | EXT_JSON | EXT_XML:
            continue
        texto = ruta.read_text(encoding="utf-8", errors="replace")
        if medias_rutas is not None and ext in EXT_HTML | EXT_JS:
            medias_rutas.update(prefijos(texto, ext in EXT_JS))
        if ext in EXT_HTML:
            for linea, ref in de_html(texto):
                yield ruta, linea, ref, None
        elif ext in EXT_CSS:
            for linea, ref in de_css(texto):
                yield ruta, linea, ref, None
        elif ext in EXT_JS:
            viejas = direcciones_que_se_mudan() if ruta.name == "redirecciones.js" else ()
            for linea, ref in de_js(texto):
                if ref in viejas:
                    continue
                yield ruta, linea, ref, None
        elif ext in EXT_JSON:
            for linea, ref, queja in de_json(ruta, texto):
                yield ruta, linea, ref, queja
        elif ext in EXT_XML:
            for linea, ref in de_xml(texto):
                yield ruta, linea, ref, None


def comprobar_externos(enlaces):
    """Un HEAD a cada dirección de fuera. Si no lo admiten, un GET. Lo
    que salga es orientativo: hay webs que a un programa le contestan
    403 y a un navegador que sí."""
    import urllib.error
    import urllib.request

    malos = []
    print(f"\n  Comprobando {len(enlaces)} enlace(s) de fuera...")
    for direccion in sorted(enlaces):
        for metodo in ("HEAD", "GET"):
            peticion = urllib.request.Request(
                direccion, method=metodo,
                # sin esto muchas webs contestan 403 a Python
                headers={"User-Agent": "Mozilla/5.0 (comprobador de enlaces de richi.blog)"},
            )
            try:
                with urllib.request.urlopen(peticion, timeout=10) as respuesta:
                    codigo = respuesta.status
                break
            except urllib.error.HTTPError as error:
                codigo = error.code
                if metodo == "HEAD" and codigo in (403, 405, 501):
                    continue  # no admite HEAD: se prueba con GET
                break
            except Exception as error:  # timeout, DNS, certificado...
                codigo = f"no contesta ({type(error).__name__})"
                break
        marca = "ok" if str(codigo).startswith("2") else str(codigo)
        print(f"    {marca:>24}  {direccion}")
        if not str(codigo).startswith("2"):
            malos.append((direccion, codigo))
    return malos


def revisar(mirar_externos=False):
    rotos = []        # apunta a algo que no está
    anclas = []       # el archivo está, el #ancla no
    quejas = []       # el archivo no se puede ni leer
    externos = set()
    usados = set()
    medias_rutas = set()

    ids_inyectados = ids_de_fragmentos()

    for ruta, linea, ref, queja in referencias(medias_rutas):
        if queja:
            quejas.append((ruta, linea, queja))
            continue

        tipo, destino, ancla = clasificar(ref, ruta)
        if tipo == "ignorar":
            continue
        if tipo == "externo":
            externos.add(destino)
            continue

        real = existe(destino)
        if real is None:
            rotos.append((ruta, linea, ref))
            continue

        # Para la lista de "no lo usa nadie" hay dos cosas que no valen
        # como que alguien lo use: que una página se enlace a sí misma
        # (todas lo hacen, con el «saltar al contenido»), y que salga en
        # el sitemap o en el RSS, porque ahí entran solas todas las
        # páginas y entonces nunca habría ninguna suelta.
        if real != ruta and ruta.suffix.lower() not in EXT_XML:
            usados.add(real)

        if ancla and real.suffix.lower() == ".html":
            if ancla not in ids_de(real) and ancla not in ids_inyectados:
                anclas.append((ruta, linea, ref))

    # --- lo que no usa nadie ---
    def alguien_lo_completa(archivo):
        """Si su ruta empieza por una media ruta de las que monta el
        JavaScript, cuenta como usado."""
        entera = "/" + archivo.relative_to(RAIZ).as_posix()
        return any(entera.startswith(trozo) for trozo in medias_rutas)

    huerfanos = []
    for carpeta in CARPETAS_HUERFANOS:
        base = RAIZ / carpeta
        if not base.is_dir():
            continue
        for archivo in sorted(base.rglob("*")):
            if archivo.relative_to(RAIZ).as_posix() in LOS_LEEN_LAS_HERRAMIENTAS:
                continue
            if archivo.is_file() and archivo not in usados and not alguien_lo_completa(archivo):
                huerfanos.append(archivo)
    for pagina in sorted(RAIZ.rglob("*.html")):
        if set(pagina.relative_to(RAIZ).parts) & FUERA:
            continue
        if pagina in usados:
            continue
        if pagina.relative_to(RAIZ).as_posix() in ENTRADAS:
            continue
        huerfanos.append(pagina)

    # =========================================
    # CONTARLO
    # =========================================
    print(f"\n  ---- enlaces rotos ----")

    if quejas:
        print(f"\n  {len(quejas)} archivo(s) que no se pueden leer:")
        for ruta, linea, queja in quejas:
            print(f"    {ruta.relative_to(RAIZ).as_posix()}: {queja}")

    if rotos:
        print(f"\n  {len(rotos)} enlace(s) roto(s):")
        anterior = None
        for ruta, linea, ref in rotos:
            if ruta != anterior:
                print(f"\n    {ruta.relative_to(RAIZ).as_posix()}")
                anterior = ruta
            print(f"      línea {linea}: {ref}")
    else:
        print("\n  Nada roto: todo lo que se enlaza existe.")

    if anclas:
        print(f"\n  {len(anclas)} ancla(s) que no llevan a ningún sitio")
        print("  (el archivo está, pero dentro no hay nada con ese id):")
        anterior = None
        for ruta, linea, ref in anclas:
            if ruta != anterior:
                print(f"\n    {ruta.relative_to(RAIZ).as_posix()}")
                anterior = ruta
            print(f"      línea {linea}: {ref}")

    if huerfanos:
        print(f"\n  {len(huerfanos)} archivo(s) a los que no apunta nadie.")
        print("  Repasa antes de borrar: puede haber algo que se comparta a mano.")
        for archivo in huerfanos:
            print(f"    {archivo.relative_to(RAIZ).as_posix()}")

    print(f"\n  {len(usados)} archivo(s) enlazados y en su sitio."
          f" {len(externos)} enlace(s) a otras webs.")

    malos_fuera = []
    if mirar_externos:
        malos_fuera = comprobar_externos(externos)
        if malos_fuera:
            print(f"\n  {len(malos_fuera)} enlace(s) de fuera que no han contestado bien."
                  "\n  Ábrelos a mano antes de darlos por muertos: hay webs que"
                  "\n  contestan mal a un programa y bien a un navegador.")
    elif externos:
        print("  (los de fuera no se han comprobado; pásale --externos si quieres)")

    return rotos, anclas, quejas


if __name__ == "__main__":
    rotos, anclas, quejas = revisar("--externos" in sys.argv)
    # Distinto de 0 si hay algo roto de verdad, por si algún día esto se
    # llama desde otro script.
    sys.exit(1 if (rotos or quejas) else 0)
