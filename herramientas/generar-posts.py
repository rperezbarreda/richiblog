#!/usr/bin/env python3
# =========================================
# GENERADOR DE LOS LISTADOS (posts.json)
# =========================================
# Recorre las páginas que ya tienes escritas y reescribe los dos
# archivos de los que la web saca sus listados:
#
#     datos/entradas-blog.json          (portada, archivo del año, diario, RSS)
#     datos/mis-movidas.json   (portada y listado de relatos)
#
# POR QUÉ
# -------
# Hasta ahora, al publicar algo había que hacer dos cosas: escribir el
# HTML y acordarse de añadir una línea al JSON con el título, la fecha,
# el enlace y las etiquetas. Cuando una de las dos se queda a medias,
# la entrada existe pero no aparece en ningún sitio (o al revés: sale
# en la lista y el enlace da 404), y no hay ningún aviso.
#
# Con esto, la página es la única fuente de la verdad: el JSON se
# reconstruye a partir de ella y no se vuelve a tocar a mano.
#
# CÓMO USARLO
# -----------
# Cada vez que publiques, borres o cambies el título/la fecha de una
# entrada, ejecuta desde la carpeta raíz del sitio:
#
#     python herramientas/generar-posts.py
#
# Para ver qué haría sin tocar nada:
#
#     python herramientas/generar-posts.py --probar
#
# Después conviene pasar también el del RSS, que lee de este JSON:
#
#     python herramientas/generar-rss.py
#
# DE DÓNDE SACA CADA COSA
# -----------------------
# Del propio HTML de la entrada:
#
#     título          <h1 class="blog-post-title">…</h1>
#     fecha           <p class="blog-post-date">12 sept 2026</p>
#     etiquetas       <article class="blog-post" data-tags="diario">
#                     (separadas por espacios; si alguna lleva coma se
#                     limpia al leerla)
#     enlace          la ruta del archivo dentro del sitio
#
# Y en los relatos, igual con relato-post-title / relato-post-date y
# data-subcategoria.
#
# Y el portfolio de rol, que no son páginas sueltas sino tarjetas
# dentro de web/mis_movidas/rol/index_rol.html:
#
#     título          <h2 class="portfolio-card-title">…</h2>
#     categoría       <div class="portfolio-card" data-categoria="aventuras">
#     fecha           <div class="portfolio-card" data-fecha="14-09-2026">
#     enlace          el primer botón de la tarjeta (el de Ko-fi)

import json
import re
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
BLOG = RAIZ / "web" / "blog"
RELATOS = RAIZ / "web" / "mis_movidas" / "relatos"
ROL = RAIZ / "web" / "mis_movidas" / "rol" / "index_rol.html"
JSON_BLOG = RAIZ / "datos" / "entradas-blog.json"
JSON_MOVIDAS = RAIZ / "datos" / "mis-movidas.json"

# Los meses tal y como los escribe la web en la fecha de cada entrada
# (es lo que devuelve toLocaleDateString en español). Se aceptan también
# los nombres enteros, por si algún día escribes la fecha a mano.
MESES = {
    "ene": 1, "enero": 1,
    "feb": 2, "febrero": 2,
    "mar": 3, "marzo": 3,
    "abr": 4, "abril": 4,
    "may": 5, "mayo": 5,
    "jun": 6, "junio": 6,
    "jul": 7, "julio": 7,
    "ago": 8, "agosto": 8,
    "sep": 9, "sept": 9, "septiembre": 9,
    "oct": 10, "octubre": 10,
    "nov": 11, "noviembre": 11,
    "dic": 12, "diciembre": 12,
}


def sin_tildes(texto):
    return "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    )


def buscar(patron, texto):
    encontrado = re.search(patron, texto, re.S)
    return encontrado.group(1).strip() if encontrado else None


def partir_etiquetas(crudas):
    """'diario testeo' y 'diario, testeo' dan lo mismo. Las comas son el
    error fácil de cometer al escribirlas, y si se colaban salía una
    etiqueta llamada 'diario,' con su propio botón en el filtro."""
    return [e for e in re.split(r"[\s,]+", crudas.strip().lower()) if e]


def limpiar_html(texto):
    """Quita etiquetas de dentro de un título y deja el texto pelado."""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", texto)).strip()


def leer_fecha(texto):
    """'12 sept 2026' -> '12-09-2026'. Devuelve None si no se entiende."""
    if not texto:
        return None
    partes = sin_tildes(texto.lower().replace(".", "")).split()
    if len(partes) != 3:
        return None
    dia, mes, anyo = partes
    if mes not in MESES or not dia.isdigit() or not anyo.isdigit():
        return None
    return f"{int(dia):02d}-{MESES[mes]:02d}-{int(anyo):04d}"


def clave_orden(entrada):
    """De más nueva a más vieja. Las que no tengan fecha, al final."""
    fecha = entrada.get("date") or ""
    partes = fecha.split("-")
    if len(partes) != 3:
        return (0, 0, 0)
    dia, mes, anyo = (int(p) for p in partes)
    return (-anyo, -mes, -dia)



# Una entrada o un relato a medio escribir llevan data-borrador en su
# <article>. Mientras lo lleven no existen para el resto del sitio: ni
# listados, ni RSS, ni sitemap, ni archivo del año. Lo quita
# herramientas/publicar.py.
#
# Se busca en la propia etiqueta <article> y no en todo el archivo a
# secas: la plantilla explica en un comentario qué es data-borrador, y
# buscando por el texto pelado ese comentario contaba como marca y la
# entrada no se publicaba nunca.
RE_BORRADOR = re.compile(r'<article class="(?:blog|relato)-post"[^>]*\bdata-borrador\b')


def es_borrador(archivo):
    try:
        return bool(RE_BORRADOR.search(archivo.read_text(encoding="utf-8")))
    except OSError:
        return False

def paginas(carpeta, patron):
    """Las páginas de contenido: fuera índices, páginas sueltas y
    borradores."""
    for p in sorted(carpeta.rglob(patron)):
        if p.name.startswith("index_") or p.name == "diario.html":
            continue
        if es_borrador(p):
            continue
        yield p


def url_de(ruta):
    return "/" + ruta.relative_to(RAIZ).as_posix()


def leer_entrada(ruta, prefijo):
    """Saca del HTML lo que hace falta para el listado."""
    texto = ruta.read_text(encoding="utf-8")
    fallos = []

    titulo = buscar(rf'<h1 class="{prefijo}-post-title">(.*?)</h1>', texto)
    if titulo:
        titulo = limpiar_html(titulo)
    else:
        fallos.append(f'no encuentro <h1 class="{prefijo}-post-title">')

    cruda = buscar(rf'<p class="{prefijo}-post-date">(.*?)</p>', texto)
    fecha = leer_fecha(limpiar_html(cruda) if cruda else None)
    if not fecha:
        fallos.append(
            f'no entiendo la fecha de <p class="{prefijo}-post-date"> '
            f"(encontré: {cruda!r})"
        )

    return titulo, fecha, texto, fallos


def recoger_blog():
    entradas, avisos = [], []
    for ruta in paginas(BLOG, "*.html"):
        titulo, fecha, texto, fallos = leer_entrada(ruta, "blog")
        if fallos:
            avisos.append((ruta, fallos))
            continue
        crudas = buscar(r'<article class="blog-post"[^>]*data-tags="([^"]*)"', texto) or ""
        entradas.append(
            {
                "title": titulo,
                "date": fecha,
                "url": url_de(ruta),
                "tags": partir_etiquetas(crudas),
            }
        )
    entradas.sort(key=clave_orden)
    return entradas, avisos


# El portfolio de rol no son páginas sueltas: son tarjetas dentro de
# web/mis_movidas/rol/index_rol.html, todas en la misma rejilla. De ahí
# salen el título, la categoría (data-categoria), la fecha (data-fecha)
# y el enlace, que es el primer botón de la tarjeta: el de Ko-fi.
# Antes la categoría era el id del panel de pestañas; las pestañas ya no
# existen —ahora se filtra con la ventana filtros.lst— y cada tarjeta
# dice a cuál pertenece.
def recoger_rol():
    entradas, avisos = [], []
    if not ROL.is_file():
        return entradas, avisos

    texto = ROL.read_text(encoding="utf-8")
    for tarjeta in re.finditer(
        r'<div class="portfolio-card"(.*?)(?=<div class="portfolio-card"|</div>\s*</section>|$)',
        texto,
        re.S,
    ):
        trozo = tarjeta.group(0)
        titulo = buscar(r'<h2 class="portfolio-card-title">(.*?)</h2>', trozo)
        subcategoria = buscar(r'data-categoria="([^"]*)"', trozo)
        fecha = buscar(r'data-fecha="([^"]*)"', trozo)
        enlace = buscar(r'<a class="portfolio-card-btn"[^>]*href="([^"]*)"', trozo)
        fallos = []
        if not titulo:
            fallos.append("no encuentro el título de la tarjeta")
        if not subcategoria:
            fallos.append("la tarjeta no dice de qué categoría es (data-categoria)")
        if not fecha or len(fecha.split("-")) != 3:
            fallos.append(f'falta o no entiendo data-fecha (encontré: {fecha!r})')
        if not enlace:
            fallos.append("la tarjeta no tiene botón con enlace")
        if fallos:
            nombre = limpiar_html(titulo) if titulo else "tarjeta sin título"
            avisos.append((ROL, [f"[{nombre}] {f}" for f in fallos]))
            continue
        entradas.append(
            {
                "title": limpiar_html(titulo),
                "category": "rol",
                "subcategory": subcategoria,
                "date": fecha,
                "url": enlace,
            }
        )
    return entradas, avisos


def recoger_movidas():
    entradas, avisos = [], []
    for ruta in paginas(RELATOS, "*.html"):
        titulo, fecha, texto, fallos = leer_entrada(ruta, "relato")
        if fallos:
            avisos.append((ruta, fallos))
            continue
        sub = (
            buscar(r'<article class="relato-post"[^>]*data-subcategoria="([^"]*)"', texto)
            or ""
        )
        entradas.append(
            {
                "title": titulo,
                "category": "relatos",
                "subcategory": sub,
                "date": fecha,
                "url": url_de(ruta),
            }
        )

    rol, avisos_rol = recoger_rol()
    todas = rol + entradas
    todas.sort(key=clave_orden)
    return todas, avisos + avisos_rol, len(rol)


def comparar(destino, datos):
    """Qué cambia respecto a lo que había, para que no se pierda nada sin
    enterarse. La primera vez que se ejecuta esto es lo que saca a la luz
    las entradas que se habían quedado descolgadas."""
    if not destino.is_file():
        return []
    try:
        previo = json.loads(destino.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return ["  el JSON que había no se puede leer; se reescribe entero"]

    antes = {p.get("url"): p for p in previo}
    ahora = {p.get("url"): p for p in datos}
    lineas = []

    for url in antes.keys() - ahora.keys():
        lineas.append(f"  SE QUITA   {antes[url].get('title')}  ({url})")
    for url in ahora.keys() - antes.keys():
        lineas.append(f"  SE AÑADE   {ahora[url].get('title')}  ({url})")
    for url in antes.keys() & ahora.keys():
        for campo in ("title", "date", "subcategory"):
            viejo, nuevo = antes[url].get(campo), ahora[url].get(campo)
            if campo in antes[url] and viejo != nuevo:
                lineas.append(
                    f"  CAMBIA     {ahora[url].get('title')}: {campo} "
                    f"{viejo!r} -> {nuevo!r}"
                )
        if sorted(antes[url].get("tags", [])) != sorted(ahora[url].get("tags", [])):
            lineas.append(
                f"  CAMBIA     {ahora[url].get('title')}: etiquetas "
                f"{antes[url].get('tags')} -> {ahora[url].get('tags')}"
            )
    return sorted(lineas)


def escribir(destino, datos, probar):
    nuevo = json.dumps(datos, ensure_ascii=False, indent=4) + "\n"
    anterior = destino.read_text(encoding="utf-8") if destino.is_file() else ""
    if nuevo == anterior:
        print(f"  {destino.relative_to(RAIZ)} ya estaba al día")
        return False
    if not probar:
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(nuevo, encoding="utf-8")
    print(f"  {destino.relative_to(RAIZ)} {'se reescribiría' if probar else 'reescrito'}")
    return True


def generar(probar=False):
    if probar:
        print("  MODO PRUEBA: no se cambia ningún archivo.\n")

    blog, avisos_blog = recoger_blog()
    movidas, avisos_movidas, cuantas_rol = recoger_movidas()

    print(f"  {len(blog)} entrada(s) de blog")
    for e in blog:
        etiquetas = ", ".join(e["tags"]) if e["tags"] else "sin etiquetas"
        print(f"     {e['date']}  {e['title'][:38]:38}  [{etiquetas}]")

    print(f"\n  {len(movidas)} en mis movidas ({cuantas_rol} del portfolio de rol)")
    for e in movidas:
        print(f"     {e['date']}  {e['title'][:38]:38}  [{e['category']}]")

    cambios = comparar(JSON_BLOG, blog) + comparar(JSON_MOVIDAS, movidas)
    if cambios:
        print("\n  Lo que cambia respecto a lo que había en los JSON:")
        for linea in cambios:
            print("   " + linea)
        print(
            "\n  Recuerda: manda la página. Si alguna de estas líneas te sorprende,\n"
            "  es que el JSON y el HTML decían cosas distintas — arregla la página\n"
            "  y vuelve a ejecutar esto."
        )

    print()
    escribir(JSON_BLOG, blog, probar)
    escribir(JSON_MOVIDAS, movidas, probar)

    avisos = avisos_blog + avisos_movidas
    if avisos:
        print("\n  OJO, estas páginas se han quedado fuera del listado:")
        for ruta, fallos in avisos:
            print(f"     {ruta.relative_to(RAIZ)}")
            for f in fallos:
                print(f"        - {f}")
        print("\n  Suele ser que el título o la fecha no están donde se esperan.")
        print("  Compáralas con una entrada que sí funcione y vuelve a ejecutar.")

    if not probar and not avisos:
        print("\n  Listo. Acuérdate de pasar también:  python herramientas/generar-rss.py")

    return 1 if avisos else 0


if __name__ == "__main__":
    sys.exit(generar(probar="--probar" in sys.argv))
