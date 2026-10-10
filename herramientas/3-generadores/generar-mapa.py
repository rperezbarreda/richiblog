#!/usr/bin/env python3
# =========================================
# MAPA DEL SITIO — datos/sitio/mapa-del-sitio.json
# =========================================
# Escribe la lista de TODAS las páginas de la web, con su título, de qué
# sección son y desde cuándo existen. De ahí saca su tabla
# web/mapa/mapa.html, que es el índice de todo lo que hay publicado.
#
# No confundir con sitemap.xml: ese es para los buscadores y lleva la
# fecha en que se tocó el archivo por última vez. Este es para las
# personas y lleva la fecha en que apareció la página.
#
# DOS FECHAS
# ----------
# Cada página lleva dos: desde cuándo está ("creada") y cuándo se tocó
# por última vez ("actualizada").
#
# DE DÓNDE SALE LA FECHA DE CREACIÓN
# ----------------------------------
# Una entrada del blog o un relato ya tienen fecha de publicación en su
# listado (datos/blog/entradas-blog.json y datos/mis_movidas/mis-movidas.json): se usa
# esa, que es la buena.
#
# Las demás páginas —la portada, sobre mí, contacto…— no tienen fecha en
# ninguna parte. Podría mirarse la fecha del archivo, pero eso se pierde
# en cuanto se copia la carpeta o se descomprime un zip, y entonces
# saldría que la web entera nació el día que cambiaste de ordenador. Así
# que se hace de otra forma: la primera vez que esta herramienta ve una
# página, apunta la fecha de hoy y NO la vuelve a tocar nunca más. Lo
# que hay escrito en datos/sitio/mapa-del-sitio.json manda siempre.
#
# Eso quiere decir dos cosas:
#   - Las páginas que ya existían el día que se pasó esto por primera
#     vez salen todas con esa fecha. Si alguna te importa, cámbiala a
#     mano en el JSON: no se vuelve a pisar.
#   - Las que hagas a partir de ahora salen con su fecha de verdad.
#
# Y LA DE ACTUALIZACIÓN
# ---------------------
# Tampoco se mira la fecha del archivo, por lo mismo. Lo que se hace es
# guardar un resumen (sha1) del CONTENIDO de cada página: si al volver a
# pasar esto el resumen ha cambiado, es que la página se ha tocado de
# verdad, y ese día queda apuntado.
#
# Del resumen se deja fuera el <head>, los ?v= de las direcciones y los
# comentarios: actualizar-cabeceras.py reescribe esa parte de TODAS las
# páginas cada vez que se toca un CSS, y si contara, cambiar un color
# pondría la web entera como actualizada ese día. Con los comentarios
# pasa lo mismo: aquí cada página se explica por dentro, y arreglar una
# explicación no es actualizar la entrada.
#
# CÓMO USARLO
# -----------
#     python herramientas/3-generadores/generar-mapa.py
#
# Va después de generar-posts.py, que es quien pone al día las fechas de
# las entradas. Si pasas nuevo.py o publicar.py, ya van los dos en
# orden y no tienes que acordarte.

import sys
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import datetime as dt
import hashlib
import re

from comun import (
    MESES_CORTOS,
    RAIZ,
    es_borrador,
    escribir_json,
    leer_json,
    limpiar_html,
)

SALIDA = RAIZ / "datos" / "sitio" / "mapa-del-sitio.json"
LISTADOS = (
    RAIZ / "datos" / "blog" / "entradas-blog.json",
    RAIZ / "datos" / "mis_movidas" / "mis-movidas.json",
    RAIZ / "datos" / "notas_rol" / "notas-rol.json",
)

# Lo mismo que se queda fuera del sitemap: lo que no es una página de la
# web que alguien pueda visitar.
EXCLUIDOS = {"not_found.html"}
CARPETAS_EXCLUIDAS = {"herramientas", "fragmentos"}

# El orden en que salen las secciones en la tabla. Lo que no esté aquí
# va al final, por orden alfabético.
ORDEN_SECCIONES = [
    "portada", "blog", "relatos", "rol", "notas de rol", "wiki cralëa",
    "santuarios", "recomendaciones", "otras",
]


# Lo que se mira para saber si una página ha cambiado: su <body>, sin
# los ?v= (que los reescribe actualizar-cabeceras.py al tocar cualquier
# CSS), sin los COMENTARIOS y sin los espacios de más, que se colaban al
# reindentar.
#
# Los comentarios se quedan fuera por lo mismo que el <head>: en esta web
# hay más comentario que HTML —cada página explica por dentro cómo está
# hecha— y se tocan a menudo sin que cambie ni una palabra de lo que se
# lee. El día que las herramientas cambiaron de carpeta hubo que
# renombrar la ruta en veinte comentarios, y eso marcó veinte entradas
# viejas como "actualizada hoy" sin haber tocado su texto. Lo que se
# apunta aquí es cuándo cambió LA PÁGINA, no el archivo.
RE_VERSION = re.compile(r"\?v=[0-9a-f]+")
RE_COMENTARIO = re.compile(r"<!--.*?-->", re.S)
RE_ESPACIOS = re.compile(r"\s+")


def resumen_de(texto):
    inicio = texto.find("<body")
    cuerpo = texto[inicio:] if inicio != -1 else texto
    cuerpo = RE_COMENTARIO.sub("", RE_VERSION.sub("", cuerpo))
    cuerpo = RE_ESPACIOS.sub(" ", cuerpo)
    return hashlib.sha1(cuerpo.encode("utf-8")).hexdigest()[:8]


def seccion_de(url):
    """De qué parte de la web es esa página."""
    if url in ("/", "/index.html"):
        return "portada"
    if url.startswith("/web/blog/"):
        return "blog"
    if url.startswith("/web/mis_movidas/relatos/"):
        return "relatos"
    if url.startswith("/web/mis_movidas/rol/"):
        return "rol"
    # El portfolio de rol (lo que se publica) y las notas de las partidas
    # (lo que se juega) son dos cosas distintas y van en secciones
    # distintas, aunque las dos sean de rol.
    if url.startswith("/web/notas_rol/"):
        return "notas de rol"
    if url.startswith("/web/santuarios/"):
        return "santuarios"
    if url.startswith("/web/recomendaciones/"):
        return "recomendaciones"
    # La wiki del mundo: una sección propia y no "otras". Son muchas
    # páginas y se buscan juntas. Lo que se lee es el nombre de la wiki,
    # no el de la carpeta.
    if url.startswith("/web/wiki/"):
        return "wiki cralëa"
    return "otras"


def titulo_de(texto, url):
    """El título de la pestaña, sin el nombre del sitio detrás. Si no hay
    <title>, se prueba con el <h1>; y si tampoco, con el nombre del
    archivo, que siempre es mejor que dejarlo en blanco."""
    crudo = re.search(r"<title>(.*?)</title>", texto, re.S)
    if crudo:
        limpio = limpiar_html(crudo.group(1))
        # "Blog 2026 · El Blog de Richi" -> "Blog 2026"
        return limpio.split("·")[0].strip() or limpio
    uno = re.search(r"<h1[^>]*>(.*?)</h1>", texto, re.S)
    if uno:
        return limpiar_html(uno.group(1))
    return Path(url).stem


def fechas_publicadas():
    """url -> fecha de publicación, de los listados que ya existen."""
    fechas = {}
    for archivo in LISTADOS:
        for entrada in leer_json(archivo, []) or []:
            url = (entrada.get("url") or "").strip()
            fecha = (entrada.get("date") or "").strip()
            # Las fichas del portfolio de rol apuntan a Ko-fi, no a una
            # página de aquí: no pintan nada en el mapa.
            if url.startswith("/") and len(fecha.split("-")) == 3:
                fechas[url] = fecha
    return fechas


def hoy():
    ahora = dt.date.today()
    return f"{ahora.day:02d}-{ahora.month:02d}-{ahora.year}"


def fecha_legible(cruda):
    partes = (cruda or "").split("-")
    if len(partes) != 3:
        return ""
    dia, mes, anyo = (int(p) for p in partes)
    return f"{dia:02d} {MESES_CORTOS[mes - 1]} {anyo}"


def generar(probar=False):
    publicadas = fechas_publicadas()
    # Lo que ya estaba apuntado: de aquí salen las fechas que no hay que
    # volver a inventar.
    anteriores = {
        p.get("url"): p for p in (leer_json(SALIDA, []) or []) if isinstance(p, dict)
    }

    paginas = []
    cambiadas = []
    nuevas = 0
    for archivo in sorted(RAIZ.rglob("*.html")):
        relativo = archivo.relative_to(RAIZ)
        if set(relativo.parts) & CARPETAS_EXCLUIDAS:
            continue
        if relativo.name in EXCLUIDOS:
            continue
        if es_borrador(archivo):
            continue

        url = "/" + relativo.as_posix()
        texto = archivo.read_text(encoding="utf-8", errors="replace")
        antes = anteriores.get(url, {})
        fecha = publicadas.get(url) or antes.get("fecha") or hoy()

        # Si el contenido no es el mismo que la última vez, hoy es el día
        # en que se actualizó. Una página que nunca se ha tocado desde
        # que nació se queda con su propia fecha de creación.
        #
        # Una que estaba apuntada pero todavía sin resumen (de antes de
        # que esto guardara resúmenes) NO cuenta como cambiada: no se
        # sabe si ha cambiado, y dar por actualizada la web entera el día
        # que se estrena esto sería mentir en 21 filas a la vez.
        resumen = resumen_de(texto)
        if url not in anteriores:
            nuevas += 1
            actualizada = fecha
        elif antes.get("resumen") and resumen != antes["resumen"]:
            actualizada = hoy()
            cambiadas.append(url)
        else:
            actualizada = antes.get("actualizada") or fecha

        paginas.append(
            {
                "url": url,
                "titulo": titulo_de(texto, url),
                "seccion": seccion_de(url),
                "fecha": fecha,
                "actualizada": actualizada,
                "resumen": resumen,
            }
        )

    # Por sección (en el orden de arriba) y, dentro de cada una, de lo
    # más nuevo a lo más viejo.
    def clave(pagina):
        try:
            puesto = ORDEN_SECCIONES.index(pagina["seccion"])
        except ValueError:
            puesto = len(ORDEN_SECCIONES)
        dia, mes, anyo = (int(p) for p in pagina["fecha"].split("-"))
        return (puesto, pagina["seccion"], -anyo, -mes, -dia, pagina["titulo"])

    paginas.sort(key=clave)

    idas = [url for url in anteriores if url not in {p["url"] for p in paginas}]

    print(f"\n  {len(paginas)} página(s) en el mapa"
          f"  ({nuevas} nueva(s), {len(cambiadas)} cambiada(s),"
          f" {len(idas)} que ya no está(n))")
    for url in idas:
        print(f"     se va:  {url}")
    for pagina in paginas:
        if pagina["url"] not in anteriores:
            print(f"     nueva:  {fecha_legible(pagina['fecha'])}  {pagina['url']}")
    for url in cambiadas:
        print(f"     tocada: {url}")

    if probar:
        print("\n  MODO PRUEBA: no se ha escrito nada.")
        return

    escribir_json(SALIDA, paginas)
    print(f"\n  Escrito {SALIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    generar("--probar" in sys.argv)
