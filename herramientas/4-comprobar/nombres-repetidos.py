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
#     python herramientas/4-comprobar/nombres-repetidos.py
#
# Sale con código 1 si encuentra algo que pueda pisarse de verdad, o
# sea, dos definiciones DISTINTAS con el mismo nombre. Si son idénticas
# (una función de ayuda copiada en dos páginas) lo dice, pero no
# protesta: gane la que gane, hace lo mismo.
#
# Lo que NO mira: nombres dentro de una función, que esos no salen al
# global; y los de dentro de un (function(){ ... })(), por lo mismo.

import sys
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "0-comun"))

import re
from collections import defaultdict

from comun import RAIZ

SCRIPTS = RAIZ / "scripts"

# Solo lo que empieza en la columna 0: lo indentado está dentro de algo
# y no llega al ámbito global.
RE_GLOBAL = re.compile(
    r"^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)"
    r"|^(const|let|class)\s+([A-Za-z_$][\w$]*)"
    r"|^var\s+([A-Za-z_$][\w$]*)",
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


# Los paquetes (scripts/paquete-*.js) no se miran: son una copia pegada
# de otros archivos de aquí, escrita por
# herramientas/3-generadores/actualizar-cabeceras.py, así que TODOS sus
# nombres salen repetidos por definición y taparían los repetidos de
# verdad. Lo que lleva dentro ya se repasa en su archivo original.
def es_paquete(js):
    return js.name.startswith("paquete-")


def los_js():
    return [js for js in sorted(SCRIPTS.rglob("*.js")) if not es_paquete(js)]


def revisar():
    donde = defaultdict(dict)
    for js in los_js():
        texto = js.read_text(encoding="utf-8")
        nombre_archivo = js.relative_to(RAIZ).as_posix()
        for hallazgo in RE_GLOBAL.finditer(texto):
            # Los grupos del patrón de arriba, en orden: 1 el nombre de
            # una función, 2 la palabra (const/let/class), 3 el nombre que
            # va detrás de esa palabra, 4 el nombre de un var.
            nombre = hallazgo.group(1) or hallazgo.group(3) or hallazgo.group(4)
            # Si es const, let o class se apunta cuál: eso cambia si
            # repetirlo es grave o no (ver más abajo).
            clase = hallazgo.group(2) or ""
            donde[nombre][nombre_archivo] = (clase, cuerpo_de(texto, nombre))

    chocan = []
    iguales = []
    for nombre, archivos in sorted(donde.items()):
        if len(archivos) < 2:
            continue
        cuerpos = {c.strip() for _, c in archivos.values()}
        declarados = {k for k, _ in archivos.values() if k}
        if declarados:
            # const, let y class NO se pueden repetir, ni siendo
            # calcaditos: dos "const x" en dos archivos de la misma
            # página tiran "Identifier \'x\' has already been declared" y
            # el segundo archivo deja de ejecutarse ENTERO. Con function
            # no pasa, que la segunda pisa a la primera y en paz.
            #
            # Esto pasó de verdad y costó encontrarlo: un const repetido
            # entre entradas-blog.js y novedades.js dejó novedades.exe en
            # "Cargando proyectos…" para siempre, sin más pista que un
            # error en la consola. Si hace falta una constante en dos
            # sitios, se mete DENTRO de la función.
            chocan.append((nombre, sorted(archivos), sorted(declarados)[0]))
        elif len(cuerpos) == 1:
            iguales.append((nombre, sorted(archivos)))
        else:
            chocan.append((nombre, sorted(archivos), ""))

    print(f"\n  {len(donde)} nombres globales en {len(los_js())} archivos")

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
    for nombre, archivos, clase in chocan:
        if clase:
            print(f"     {nombre}  ({clase} repetido: REVIENTA el segundo archivo")
            print(f"        entero. Mételo dentro de la función que lo usa.)")
        else:
            print(f"     {nombre}")
        for archivo in archivos:
            print(f"        {archivo}")
    print()
    return 1


if __name__ == "__main__":
    sys.exit(revisar())
