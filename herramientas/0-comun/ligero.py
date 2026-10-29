#!/usr/bin/env python3
# =========================================
# EL CSS Y EL JS, SIN COMENTARIOS, PARA SERVIRLOS
# =========================================
# No se ejecuta solo: lo usa actualizar-cabeceras.py.
#
# El código de este sitio está escrito para leerse: cada regla y cada
# función lleva su porqué al lado. Eso es la documentación y se queda
# donde está, en estilos/ y scripts/. Pero el navegador de quien entra se
# bajaba también todos esos comentarios, y medido eran entre la mitad y
# tres cuartas partes de cada archivo:
#
#     paquete-comun.js    118 KB  →  58 KB   (comprimido: 35 → 14)
#     paquete-comun.css    90 KB  →  38 KB   (comprimido: 27 →  7)
#     notas-rol.css        83 KB  →  34 KB   (comprimido: 24 →  5)
#
# Así que lo que piden las páginas es una COPIA sin comentarios, que
# escribe actualizar-cabeceras.py en ligero/ (ligero/estilos/...,
# ligero/scripts/...), y los paquetes, que ya eran archivos generados,
# salen también sin ellos. Los originales no se tocan nunca.
#
# CÓMO SE QUITAN. No con una expresión regular, que en JavaScript no
# sirve: un "//" puede estar dentro de una cadena ("https://..."), un
# "/*" dentro de una expresión regular, y quitarlos ahí rompería el
# código. Esto lee el código como lo lee el navegador: sabe cuándo está
# dentro de una cadena, de una plantilla `${...}` o de una expresión
# regular, y solo quita lo que de verdad es un comentario. Y no hace nada
# más: no junta líneas ni cambia nombres. Lo que queda es el mismo código,
# con la misma sangría, y se puede leer en el inspector del navegador.
#
# COMPROBADO: el árbol de sintaxis de cada archivo (lo que el navegador
# entiende de él) sale idéntico antes y después, con acorn para el JS y
# con css-tree para el CSS. Si algún día se toca esto, hay que volver a
# comprobarlo así.

import re

_CRUDO_CSS = re.compile(r"""("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|/\*.*?\*/""", re.S)


def css_sin_comentarios(texto):
    """Quita los /* */ del CSS, respetando lo que haya dentro de comillas."""
    salida = _CRUDO_CSS.sub(lambda m: m.group(1) if m.group(1) else "", texto)
    return _sin_huecos(salida)


# Después de estas palabras, una "/" empieza una expresión regular y no
# es una división: return /x/.test(...), typeof /x/...
_ANTES_DE_REGEX = {
    "return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
    "throw", "case", "do", "else", "yield", "await",
}
# Y después de estos signos, también.
_SIGNOS_ANTES_DE_REGEX = set("(,=:[!&|?{};+-*%<>~^")


def js_sin_comentarios(texto):
    """Quita los // y /* */ de JavaScript sin tocar cadenas, plantillas ni
    expresiones regulares."""
    salida = []
    i, n = 0, len(texto)
    # Lo último significativo que se ha escrito: decide si una "/" es una
    # división o empieza una expresión regular.
    ultimo = ""
    # Las plantillas `...${ código }...`: cuántas llaves abiertas hay en
    # cada nivel de ${ }, para saber cuándo se vuelve a la plantilla.
    pila = []

    def palabra_antes():
        j = len(salida) - 1
        trozo = "".join(salida[-40:]) if salida else ""
        m = re.search(r"([A-Za-z_$][\w$]*)\s*$", trozo)
        return m.group(1) if m else ""

    def leer_plantilla(i):
        """Copia una plantilla desde después de la ` de apertura. Devuelve
        dónde se ha quedado y si ha entrado en un ${ (True) o ha cerrado."""
        while i < n:
            c = texto[i]
            if c == "\\":
                salida.append(texto[i:i + 2])
                i += 2
                continue
            if c == "`":
                salida.append(c)
                return i + 1, False
            if c == "$" and i + 1 < n and texto[i + 1] == "{":
                salida.append("${")
                return i + 2, True
            salida.append(c)
            i += 1
        return i, False

    while i < n:
        c = texto[i]
        sig = texto[i + 1] if i + 1 < n else ""

        # Comentario de línea: fuera hasta el salto (el salto se queda).
        if c == "/" and sig == "/":
            fin = texto.find("\n", i)
            i = n if fin == -1 else fin
            continue
        # Comentario de bloque: fuera. Si separaba dos palabras, queda un
        # espacio para que no se peguen.
        if c == "/" and sig == "*":
            fin = texto.find("*/", i + 2)
            fin = n if fin == -1 else fin + 2
            antes = salida[-1][-1:] if salida else ""
            despues = texto[fin:fin + 1]
            if antes and despues and not antes.isspace() and not despues.isspace():
                salida.append(" ")
            i = fin
            continue
        # Cadenas: tal cual hasta su comilla.
        if c in "\"'":
            j = i + 1
            while j < n and texto[j] != c:
                if texto[j] == "\\":
                    j += 1
                elif texto[j] == "\n":
                    break
                j += 1
            salida.append(texto[i:j + 1])
            i = j + 1
            ultimo = "a"
            continue
        # Plantillas.
        if c == "`":
            salida.append(c)
            i, abierta = leer_plantilla(i + 1)
            if abierta:
                pila.append(0)
                ultimo = "{"
            else:
                ultimo = "a"
            continue
        if pila and c == "{":
            pila[-1] += 1
        elif pila and c == "}":
            if pila[-1] == 0:
                pila.pop()
                salida.append("}")
                i, abierta = leer_plantilla(i + 1)
                if abierta:
                    pila.append(0)
                    ultimo = "{"
                else:
                    ultimo = "a"
                continue
            pila[-1] -= 1
        # Expresiones regulares.
        if c == "/" and (ultimo == "" or ultimo in _SIGNOS_ANTES_DE_REGEX
                         or (ultimo == "w" and palabra_antes() in _ANTES_DE_REGEX)):
            j = i + 1
            en_clase = False
            while j < n:
                d = texto[j]
                if d == "\\":
                    j += 2
                    continue
                if d == "[":
                    en_clase = True
                elif d == "]":
                    en_clase = False
                elif d == "/" and not en_clase:
                    break
                elif d == "\n":
                    break
                j += 1
            j += 1
            while j < n and (texto[j].isalnum() or texto[j] == "_"):
                j += 1
            salida.append(texto[i:j])
            i = j
            ultimo = "a"
            continue

        salida.append(c)
        if not c.isspace():
            if c.isalnum() or c in "_$":
                ultimo = "w"
            elif c in ")]":
                ultimo = ")"
            else:
                ultimo = c
        i += 1

    return _sin_huecos("".join(salida))


def _sin_huecos(texto):
    """Fuera los espacios al final de línea y las líneas que se han
    quedado vacías al irse su comentario."""
    lineas = [l.rstrip() for l in texto.replace("\r\n", "\n").split("\n")]
    return "\n".join(l for l in lineas if l) + "\n"


def sin_comentarios(ruta, texto):
    if ruta.endswith(".css"):
        return css_sin_comentarios(texto)
    if ruta.endswith(".js"):
        return js_sin_comentarios(texto)
    return texto
