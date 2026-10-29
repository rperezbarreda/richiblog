#!/usr/bin/env python3
# =========================================
# QUITAR LOS COMENTARIOS DE LAS PÁGINAS PUBLICADAS
# =========================================
# Las páginas nacen de las plantillas de herramientas/plantillas/, y las
# plantillas van llenas de comentarios que explican cómo se escribe cada
# cosa: qué es data-tags, cómo se pone la imagen de la derecha, cómo se
# escriben las escenas de una partida... Sirven mientras escribes. Una vez
# publicada la página, no los lee nadie más que el navegador de quien
# entra, que se los baja enteros: medido, 128 KB repartidos en 37
# archivos, entre un cuarto y un tercio de lo que pesaba cada página, y
# 9 KB del menú, que se pide en TODAS.
#
# Así que esto los quita de lo publicado. Lo pasan solos nuevo.py y
# publicar.py (va en GENERADORES, en comun.py) y generar-mundo.py.
#
#     python herramientas/3-generadores/quitar-comentarios.py
#     python herramientas/3-generadores/quitar-comentarios.py --probar
#
# LO QUE NO SE QUITA NUNCA:
#
#   · Los BORRADORES. Mientras escribes, la guía de la plantilla sigue en
#     la página; se va al publicarla.
#   · Las seis marcas de actualizar-cabeceras.py (MARCAS, aquí abajo): el
#     bloque de CSS, el de JS, el del tema y el adelanto del menú. La
#     herramienta reescribe el <head> buscando esas marcas, y sin ellas
#     no lo encontraría. Las demás etiquetas tipo "==== HOME ====" no las
#     usa nadie y se van.
#   · El CÓDIGO COMENTADO: un comentario que empieza por "<" es HTML que
#     has escondido (un párrafo que no quieres enseñar todavía), no una
#     explicación. Se queda.
#   · Lo que empiece por "!": <!--! esto se queda -->. Es la forma de
#     proteger cualquier comentario de texto que quieras conservar.
#
# DÓNDE MIRA: index.html, not_found.html, web/ y fragmentos/. Las
# plantillas no se tocan: son la guía, y ahí tienen que seguir.
#
# Solo mira fuera de <script> y <style>: dentro de esos, un "<!--" no es
# un comentario de HTML y no se toca.
#
# LA REGLA DE QUÉ SE QUEDA está en comun.py (limpiar_comentarios_html),
# porque la usan también los generadores que escriben páginas desde una
# plantilla (generar-archivo.py, generar-mundo.py): así ya las escriben
# limpias.

import sys
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "0-comun"))

from comun import (RAIZ, es_borrador, escribir_texto, leer_texto,  # noqa: E402
                   limpiar_comentarios_html as limpiar)

def donde_mirar():
    for nombre in ("index.html", "not_found.html"):
        if (RAIZ / nombre).is_file():
            yield RAIZ / nombre
    yield from sorted((RAIZ / "web").rglob("*.html"))
    yield from sorted((RAIZ / "fragmentos").glob("*.html"))


def main():
    probar = "--probar" in sys.argv
    total_quitados = 0
    total_bytes = 0
    archivos = 0
    borradores = 0
    for archivo in donde_mirar():
        if es_borrador(archivo):
            borradores += 1
            continue
        texto, crlf = leer_texto(archivo)
        nuevo, quitados = limpiar(texto)
        if not quitados:
            continue
        ahorro = len(texto.encode("utf-8")) - len(nuevo.encode("utf-8"))
        total_quitados += quitados
        total_bytes += ahorro
        archivos += 1
        print(f"  {archivo.relative_to(RAIZ)}: {quitados} comentario(s), {ahorro / 1024:.1f} KB")
        if not probar:
            escribir_texto(archivo, nuevo, crlf)

    if not total_quitados:
        print("  Ningún comentario que quitar en lo publicado.")
    else:
        hecho = "Quitaría" if probar else "Quitados"
        print(f"\n  {hecho} {total_quitados} comentario(s) de {archivos} archivo(s):"
              f" {total_bytes / 1024:.0f} KB menos.")
    if borradores:
        print(f"  ({borradores} borrador(es) sin tocar: la guía se va al publicarlos)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
