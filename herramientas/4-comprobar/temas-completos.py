#!/usr/bin/env python3
"""Mira que cada tema de color esté en TODOS los sitios donde vive.

POR QUÉ EXISTE ESTO
-------------------
Un tema de color no está en un sitio, está en seis:

  1. estilos/base.css                     los colores
  2. scripts/tema.js                      la lista TEMAS, el nombre que se
                                          escribe en data-theme y el color
                                          de la barra del móvil
  3. el <script> del <head> de CADA página, que pinta el tema guardado
     antes del primer dibujo (si no, la web parpadea al cargar)
  4. estilos/componentes/ajustes.css      la muestra de color del botón
  5. fragmentos/ajustes.html              el botón
  6. web/accesibilidad/accesibilidad.html los cuenta por su nombre

Y si falta en uno solo, lo que pasa es raro y silencioso: el tema se
elige pero no se pinta, o se pinta pero parpadea al cargar, o el botón
sale sin color. Con diez temas y 31 páginas, acordarse a mano no es un
plan.

    python3 herramientas/4-comprobar/temas-completos.py
"""
import re
import sys
from pathlib import Path

# Dos pisos hacia arriba: este archivo vive en
# herramientas/4-comprobar/. (Éste no usa comun.py: se vale solo.)
RAIZ = Path(__file__).resolve().parents[2]


def entre(texto, desde, hasta):
    i = texto.find(desde)
    if i == -1:
        return ""
    j = texto.find(hasta, i)
    return texto[i:j] if j != -1 else texto[i:]


def main():
    tema_js = (RAIZ / "scripts/tema.js").read_text(encoding="utf-8")

    lista = entre(tema_js, "const TEMAS = [", "];")
    temas = re.findall(r'"([^"]+)"', lista)
    if not temas:
        print("  No he encontrado la lista TEMAS en scripts/tema.js.")
        return 1

    atributos = dict(
        re.findall(r'"?([\w-]+)"?\s*:\s*"([^"]*)"',
                   entre(tema_js, "const TEMA_ATRIBUTO = {", "};"))
    )
    barras = dict(
        re.findall(r'"?([\w-]+)"?\s*:\s*"([^"]*)"',
                   entre(tema_js, "const COLOR_BARRA = {", "};"))
    )

    base = (RAIZ / "estilos/base.css").read_text(encoding="utf-8")
    ajustes = (RAIZ / "estilos/componentes/ajustes.css").read_text(encoding="utf-8")
    lateral = (RAIZ / "fragmentos/ajustes.html").read_text(encoding="utf-8")

    paginas = [
        f for f in sorted(RAIZ.rglob("*.html"))
        if "originales-sustituidas" not in f.as_posix()
        and "var temas = {" in f.read_text(encoding="utf-8")
    ]

    fallos = []
    for tema in temas:
        atributo = atributos.get(tema)
        if atributo is None:
            fallos.append("%s: no está en TEMA_ATRIBUTO." % tema)
            continue
        if tema not in barras:
            fallos.append("%s: no está en COLOR_BARRA (el color de la barra "
                          "del móvil)." % tema)

        # El de fábrica no escribe atributo ni sale en los sitios de abajo.
        if atributo == "":
            continue

        if ('[data-theme="%s"]' % atributo) not in base:
            fallos.append("%s: no tiene sus colores en estilos/base.css "
                          "([data-theme=\"%s\"])." % (tema, atributo))
        if ('[data-tema="%s"]' % tema) not in ajustes:
            fallos.append("%s: no tiene muestra de color en "
                          "estilos/componentes/ajustes.css." % tema)
        if ('data-tema="%s"' % tema) not in lateral:
            fallos.append("%s: no tiene botón en "
                          "fragmentos/ajustes.html." % tema)

        # La clave puede ir entre comillas o sin ellas: en JavaScript solo
        # hacen falta cuando el nombre lleva un guion, así que "claro" va
        # pelado y "terminal-azul" entrecomillado.
        clave = re.compile(r'(^|[{,\s])"?%s"?\s*:' % re.escape(tema), re.M)
        sin_prepintado = [
            f.relative_to(RAIZ).as_posix() for f in paginas
            if not clave.search(entre(
                f.read_text(encoding="utf-8"), "var temas = {", "};"))
        ]
        if sin_prepintado:
            fallos.append(
                "%s: falta en el pre-pintado de %d página(s): %s%s"
                % (tema, len(sin_prepintado), ", ".join(sin_prepintado[:3]),
                   "…" if len(sin_prepintado) > 3 else "")
            )

    print()
    if fallos:
        print("  ---- temas a medias ----")
        for f in fallos:
            print("     %s" % f)
        print("\n  %d tema(s) revisados, %d problema(s)." % (len(temas), len(fallos)))
        return 1

    print("  %d temas, y los %d completos en los seis sitios "
          "(%d páginas con pre-pintado)." % (len(temas), len(temas), len(paginas)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
