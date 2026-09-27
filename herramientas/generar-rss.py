#!/usr/bin/env python3
# =========================================
# GENERADOR DEL RSS
# =========================================
# El RSS no se escribe a mano: se genera a partir de los dos listados
# de datos/ (entradas-blog.json y mis-movidas.json), que a su vez salen
# de las propias páginas. Así no hay que acordarse de actualizar dos
# sitios al publicar.
#
# QUÉ LLEVA EL FEED
# -----------------
# Todo lo que publicas, mezclado y de más nuevo a más viejo:
#   - las entradas del blog (diario incluido)
#   - los relatos
#   - lo que subas al portfolio de rol
# Cada cosa va marcada con su categoría, así que un lector de feeds
# puede enseñar de qué es cada una.
#
# CÓMO USARLO
# -----------
# Desde la carpeta raíz del sitio:
#
#     python3 herramientas/generar-rss.py
#
# Eso reescribe blog/rss.xml. Sube ese archivo a Neocities junto con
# los demás y listo: quien esté suscrito lo verá la próxima vez que su
# lector pase a mirar.
#
# nuevo.py y nuevo.py --rol ya lo ejecutan solos al terminar, así
# que en el día a día no hace falta llamarlo a mano.
#
# El resumen de cada cosa se saca de su propia página (el primer
# párrafo de la entrada o del relato, la descripción de la tarjeta en
# el portfolio), así que tampoco hay que escribirlo dos veces.
#
# NOTA: esta carpeta "herramientas" es solo para ti — no hace falta
# subirla a Neocities.

import html
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

# Si algún día cambias de dominio, este es el único sitio que hay que tocar.
SITIO = "https://richi.blog"

TITULO_CANAL = "El Blog de Richi"
DESCRIPCION_CANAL = (
    "Todo lo que voy publicando: entradas del blog, relatos y material de rol."
)
IDIOMA = "es"

from comun import RAIZ
JSON_BLOG = RAIZ / "datos" / "entradas-blog.json"
JSON_MOVIDAS = RAIZ / "datos" / "mis-movidas.json"
ROL = RAIZ / "web" / "mis_movidas" / "rol" / "index_rol.html"
SALIDA = RAIZ / "blog" / "rss.xml"
RUTA_FEED = "/blog/rss.xml"

# RSS exige los nombres en inglés (RFC 822), pase lo que pase con el
# idioma del sitio o del ordenador donde se ejecute esto.
DIAS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
         "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def leer_fecha(texto):
    """Las fechas de los listados vienen como dd-mm-aaaa."""
    dia, mes, anio = (int(p) for p in (texto or "").split("-"))
    return datetime(anio, mes, dia, tzinfo=timezone.utc)


def fecha_rfc822(momento):
    return "{}, {:02d} {} {} 00:00:00 +0000".format(
        DIAS[momento.weekday()], momento.day, MESES[momento.month - 1], momento.year
    )


def limpiar(trozo_html):
    """Deja el texto pelado de un trozo de HTML."""
    texto = re.sub(r"<[^>]+>", "", trozo_html)
    return html.unescape(" ".join(texto.split()))


def primer_parrafo(url, clase_cuerpo):
    """Primer párrafo del cuerpo de una página del sitio, para usarlo de
    resumen. Si el archivo no está o tiene otra pinta, se devuelve
    cadena vacía y el feed sale igual, solo que sin resumen."""
    archivo = RAIZ / url.lstrip("/")
    if not archivo.is_file():
        return ""
    contenido = archivo.read_text(encoding="utf-8")
    cuerpo = re.search(rf'<div class="{clase_cuerpo}">(.*?)</div>', contenido, re.S)
    if not cuerpo:
        return ""
    parrafo = re.search(r"<p>(.*?)</p>", cuerpo.group(1), re.S)
    return limpiar(parrafo.group(1)) if parrafo else ""


def descripciones_del_rol():
    """{título de la tarjeta: su descripción} leyendo index_rol.html."""
    if not ROL.is_file():
        return {}
    texto = ROL.read_text(encoding="utf-8")
    fichas = {}
    for tarjeta in re.finditer(
        r'<div class="portfolio-card"(.*?)(?=<div class="portfolio-card"|</div>\s*</section>|$)',
        texto,
        re.S,
    ):
        trozo = tarjeta.group(0)
        titulo = re.search(r'<h2 class="portfolio-card-title">(.*?)</h2>', trozo, re.S)
        desc = re.search(r'<p class="portfolio-card-desc">(.*?)</p>', trozo, re.S)
        if titulo:
            fichas[limpiar(titulo.group(1))] = limpiar(desc.group(1)) if desc else ""
    return fichas


def identificador(prefijo, titulo, fecha):
    """Un guid estable para lo que no tiene página propia (el portfolio
    de rol enlaza a Ko-fi, y dos aventuras no pueden compartir guid o
    el lector de feeds se cree que son la misma)."""
    limpio = unicodedata.normalize("NFD", titulo.lower())
    limpio = "".join(c for c in limpio if unicodedata.category(c) != "Mn")
    limpio = re.sub(r"[^a-z0-9]+", "-", limpio).strip("-")
    return f"{SITIO}/#{prefijo}-{limpio}-{fecha}"


def cosas_del_blog():
    if not JSON_BLOG.is_file():
        return []
    entradas = json.loads(JSON_BLOG.read_text(encoding="utf-8"))
    cosas = []
    for e in entradas:
        if not e.get("title") or not e.get("url"):
            continue
        cosas.append({
            "titulo": e["title"],
            "fecha": e["date"],
            "enlace": SITIO + e["url"],
            "guid": SITIO + e["url"],
            "guid_es_enlace": True,
            "resumen": primer_parrafo(e["url"], "blog-post-body"),
            "categorias": ["blog"] + list(e.get("tags") or []),
        })
    return cosas


def cosas_de_mis_movidas():
    if not JSON_MOVIDAS.is_file():
        return []
    entradas = json.loads(JSON_MOVIDAS.read_text(encoding="utf-8"))
    desc_rol = descripciones_del_rol()
    cosas = []
    for e in entradas:
        titulo, url = e.get("title"), e.get("url")
        if not titulo or not url:
            continue
        categoria = (e.get("category") or "").strip()
        subcategoria = (e.get("subcategory") or "").strip()
        propia = url.startswith("/")
        cosas.append({
            "titulo": titulo,
            "fecha": e["date"],
            # Los relatos tienen página propia; el portfolio de rol
            # enlaza a donde se descarga (Ko-fi), que es lo que le
            # interesa a quien lo lea en su lector de feeds.
            "enlace": SITIO + url if propia else url,
            "guid": SITIO + url if propia else identificador(categoria, titulo, e["date"]),
            "guid_es_enlace": propia,
            "resumen": (
                primer_parrafo(url, "relato-post-body")
                if propia
                else desc_rol.get(titulo, "")
            ),
            "categorias": [c for c in (categoria, subcategoria) if c],
        })
    return cosas


def pieza(cosa):
    trozos = [
        "        <item>",
        f"            <title>{html.escape(cosa['titulo'])}</title>",
        f"            <link>{html.escape(cosa['enlace'])}</link>",
        f'            <guid isPermaLink="{"true" if cosa["guid_es_enlace"] else "false"}">'
        f"{html.escape(cosa['guid'])}</guid>",
        f"            <pubDate>{fecha_rfc822(leer_fecha(cosa['fecha']))}</pubDate>",
    ]
    for categoria in cosa["categorias"]:
        trozos.append(f"            <category>{html.escape(categoria)}</category>")
    if cosa["resumen"]:
        trozos.append(f"            <description>{html.escape(cosa['resumen'])}</description>")
    trozos.append("        </item>")
    return "\n".join(trozos)


def generar():
    cosas = cosas_del_blog() + cosas_de_mis_movidas()
    cosas.sort(key=lambda c: leer_fecha(c["fecha"]), reverse=True)

    ultima = (
        fecha_rfc822(leer_fecha(cosas[0]["fecha"]))
        if cosas
        else fecha_rfc822(datetime.now(timezone.utc))
    )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
        "    <channel>\n"
        f"        <title>{html.escape(TITULO_CANAL)}</title>\n"
        f"        <link>{SITIO}/</link>\n"
        f"        <description>{html.escape(DESCRIPCION_CANAL)}</description>\n"
        f"        <language>{IDIOMA}</language>\n"
        f"        <lastBuildDate>{ultima}</lastBuildDate>\n"
        f'        <atom:link href="{SITIO}{RUTA_FEED}" rel="self" type="application/rss+xml"/>\n'
        + "\n".join(pieza(c) for c in cosas)
        + ("\n" if cosas else "")
        + "    </channel>\n"
        "</rss>\n"
    )

    SALIDA.write_text(xml, encoding="utf-8")
    cuenta = {}
    for c in cosas:
        cuenta[c["categorias"][0] if c["categorias"] else "otros"] = (
            cuenta.get(c["categorias"][0] if c["categorias"] else "otros", 0) + 1
        )
    detalle = ", ".join(f"{n} de {k}" for k, n in sorted(cuenta.items()))
    print(f"Escrito {SALIDA.relative_to(RAIZ)} con {len(cosas)} cosa(s): {detalle}.")


if __name__ == "__main__":
    generar()
