#!/usr/bin/env python3
# =========================================
# GENERADOR DEL SITEMAP
# =========================================
# Recorre los .html del sitio y escribe sitemap.xml, que es lo que
# miran los buscadores para saber qué páginas existen sin tener que
# adivinarlas siguiendo enlaces.
#
# CÓMO USARLO
# -----------
# Cada vez que añadas o quites una página, ejecuta desde la carpeta
# raíz del sitio:
#
#     python3 herramientas/generar-sitemap.py
#
# Eso reescribe sitemap.xml. Súbelo a Neocities con el resto.
#
# La fecha de cada página sale de cuándo se modificó el archivo por
# última vez, así que no hay que apuntarla a mano en ningún sitio.
#
# Se quedan fuera a propósito: el 404 (no tiene sentido indexarlo) y
# esta carpeta de herramientas.
#
# NOTA: igual que el generador del RSS, esta carpeta es solo para ti;
# no hace falta subirla a Neocities.

import re
from datetime import datetime, timezone
from pathlib import Path

SITIO = "https://richi.blog"

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "sitemap.xml"

EXCLUIDOS = {"not_found.html"}
CARPETAS_EXCLUIDAS = {"herramientas", "fragmentos"}

# La portada primero y el resto por orden alfabético, para que el
# archivo salga siempre igual y los cambios se lean de un vistazo.
def orden(ruta):
    return (ruta != "/index.html", ruta)



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

def generar():
    paginas = []
    for archivo in RAIZ.rglob("*.html"):
        relativo = archivo.relative_to(RAIZ)
        if set(relativo.parts) & CARPETAS_EXCLUIDAS:
            continue
        if relativo.name in EXCLUIDOS:
            continue
        if es_borrador(archivo):
            continue
        ruta = "/" + relativo.as_posix()
        modificado = datetime.fromtimestamp(archivo.stat().st_mtime, tz=timezone.utc)
        paginas.append((ruta, modificado.strftime("%Y-%m-%d")))

    paginas.sort(key=lambda p: orden(p[0]))

    piezas = [
        "    <url>\n"
        f"        <loc>{SITIO}{ruta}</loc>\n"
        f"        <lastmod>{fecha}</lastmod>\n"
        "    </url>"
        for ruta, fecha in paginas
    ]

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(piezas)
        + "\n</urlset>\n"
    )

    SALIDA.write_text(xml, encoding="utf-8")
    print(f"Escrito sitemap.xml con {len(paginas)} página(s).")


if __name__ == "__main__":
    generar()
