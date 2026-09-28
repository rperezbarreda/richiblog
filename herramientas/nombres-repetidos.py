#!/usr/bin/env python3
# =========================================
# NOMBRES REPETIDOS ENTRE SCRIPTS
# =========================================
# En esta web no hay módulos ni empaquetador: los .js se cargan con
# <script> a secas, así que TODOS comparten el mismo ámbito global. Dos
# archivos con una función del mismo nombre no dan error: gana la del
# último que se carga, y el otro se queda llamando a una función que no
# es la suya.
#
# Ya pasó de verdad: texto-tamano.js tenía una mover() para subir y
# bajar el tamaño de la letra, y teclado-scroll.js tiene otra mover()
# para desplazar la página. Como el segundo se carga después, el + del
# tamaño acababa llamando a la del scroll y no hacía nada (solo se veía
# un error raro en la consola).
#
# Esto lo busca antes de que pase. No abre el navegador ni toca nada:
# lee los .js y compara los nombres que quedan sueltos en el global.
#
# CÓMO USARLO
# -----------
#     python herramientas/nombres-repetidos.py
#
# Sale con código 1 si encuentra algo que pueda pisarse de verdad, o
# sea, dos definiciones DISTINTAS con el mismo nombre. Si son idénticas
# (una función de ayuda copiada en dos páginas) lo dice, pero no
# protesta: gane la que gane, hace lo mismo.
#
# Lo que NO mira: nombres dentro de una función, que esos no salen al
# global; y los de dentro de un (function(){ ... })(), por lo mismo.

import re
import sys
from collections import defaultdict

from comun import RAIZ

SCRIPTS = RAIZ / "scripts"

# Solo lo que empieza en la columna 0: lo indentado está dentro de algo
# y no llega al ámbito global.
RE_GLOBAL = re.compile(
    r"^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)"
    r"|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)",
    re.M,
)


def cuerpo_de(texto, nombre):
    """El trozo de archivo donde se define ese nombre, para poder
    comparar dos definiciones y saber si son la misma."""
    patron = re.compile(
        r"^(?:async\s+)?function\s+" + re.escape(nombre) + r"\s*\(.*?^\}",
        re.M | re.S,
    )
    encontrado = patron.search(texto)
    if encontrado:
        return encontrado.group(0)
    patron = re.compile(
        r"^(?:const|let|var)\s+" + re.escape(nombre) + r"\s*=.*?;\s*$",
        re.M | re.S,
    )
    encontrado = patron.search(texto)
    return encontrado.group(0) if encontrado else ""


def revisar():
    donde = defaultdict(dict)
    for js in sorted(SCRIPTS.rglob("*.js")):
        texto = js.read_text(encoding="utf-8")
        nombre_archivo = js.relative_to(RAIZ).as_posix()
        for hallazgo in RE_GLOBAL.finditer(texto):
            nombre = hallazgo.group(1) or hallazgo.group(2)
            donde[nombre][nombre_archivo] = cuerpo_de(texto, nombre)

    chocan = []
    iguales = []
    for nombre, archivos in sorted(donde.items()):
        if len(archivos) < 2:
            continue
        cuerpos = {c.strip() for c in archivos.values()}
        if len(cuerpos) == 1:
            iguales.append((nombre, sorted(archivos)))
        else:
            chocan.append((nombre, sorted(archivos)))

    print(f"\n  {len(donde)} nombres globales en {len(list(SCRIPTS.rglob('*.js')))} archivos")

    if iguales:
        print(f"\n  ---- repetidos, pero idénticos ({len(iguales)}) ----")
        print("  (la misma función copiada en dos sitios: gane la que gane,")
        print("   hace lo mismo. No rompe nada, pero si tocas una, toca la otra.)")
        for nombre, archivos in iguales:
            print(f"     {nombre}")
            for archivo in archivos:
                print(f"        {archivo}")

    if not chocan:
        print("\n  ---- ningún nombre se pisa ----\n")
        return 0

    print(f"\n  ---- OJO: {len(chocan)} nombre(s) que SÍ se pisan ----")
    print("  (dos cosas distintas con el mismo nombre: gana la del archivo")
    print("   que se cargue después. Cambia uno de los dos.)")
    for nombre, archivos in chocan:
        print(f"     {nombre}")
        for archivo in archivos:
            print(f"        {archivo}")
    print()
    return 1


if __name__ == "__main__":
    sys.exit(revisar())
