#!/usr/bin/env python3
"""Mira que las hojas de estilo estén bien cerradas.

POR QUÉ EXISTE ESTO
-------------------
El CSS de esta web lleva más comentario que regla, y eso tiene un
peligro muy concreto: si un comentario se cierra donde no toca, el
navegador NO AVISA DE NADA. Se encuentra texto suelto donde esperaba una
regla, se lo traga en silencio —y de propina se traga también la regla
que venía detrás— y la página se ve rara sin que nada parezca roto.

Pasó: un "*/" de más dejó el bloque de las dos columnas de la ventana de
accesibilidad fuera de juego. El panel seguía funcionando, solo que a
una columna, y no había forma de saber por qué mirando el archivo.

Lo que se comprueba, archivo a archivo:
  1. Comentarios: que cada /* tenga su */ y que no haya ningún */
     suelto, que es el caso que de verdad hace daño.
  2. Llaves: que cada { tenga su }, contando sin los comentarios.
  3. Arrobas: que cada @media / @supports / @container abra bloque.

No es un validador de CSS: no mira si una propiedad existe ni si un
valor vale. Para eso ya está el navegador. Esto mira lo único que el
navegador no te cuenta.

    python3 herramientas/4-comprobar/css-sano.py
"""
import re
import sys
from pathlib import Path

# Dos pisos hacia arriba: este archivo vive en
# herramientas/4-comprobar/. (Éste no usa comun.py: se vale solo.)
RAIZ = Path(__file__).resolve().parents[2]
ARROBAS_CON_BLOQUE = ("@media", "@supports", "@container", "@keyframes", "@font-face")


def sin_comentarios(texto):
    """El texto con los comentarios en blanco (se dejan los saltos de
    línea para que los números de línea sigan cuadrando)."""
    fuera = []
    for trozo in re.split(r"(/\*.*?\*/)", texto, flags=re.S):
        if trozo.startswith("/*") and trozo.endswith("*/"):
            fuera.append("\n" * trozo.count("\n"))
        else:
            fuera.append(trozo)
    return "".join(fuera)


def linea_de(texto, posicion):
    return texto.count("\n", 0, posicion) + 1


def revisar(ruta):
    texto = ruta.read_text(encoding="utf-8")
    fallos = []

    # ---- 1. comentarios ----
    # Se recorre a mano en vez de contar apariciones: lo que importa no
    # es cuántos hay, es el ORDEN. Un "*/" cuando no hay comentario
    # abierto es el error que de verdad tira una regla.
    dentro = False
    i = 0
    abierto_en = 0
    while i < len(texto) - 1:
        par = texto[i:i + 2]
        if not dentro and par == "/*":
            dentro = True
            abierto_en = i
            i += 2
            continue
        if not dentro and par == "*/":
            fallos.append(
                "línea %d: hay un */ y no había ningún comentario abierto. "
                "Todo lo que venga detrás hasta la siguiente llave se "
                "pierde, y la regla de después también." % linea_de(texto, i)
            )
            i += 2
            continue
        if dentro and par == "*/":
            dentro = False
            i += 2
            continue
        i += 1
    if dentro:
        fallos.append(
            "línea %d: este comentario se abre y no se cierra nunca."
            % linea_de(texto, abierto_en)
        )

    limpio = sin_comentarios(texto)

    # ---- 2. llaves ----
    hondo = 0
    for i, ch in enumerate(limpio):
        if ch == "{":
            hondo += 1
        elif ch == "}":
            hondo -= 1
            if hondo < 0:
                fallos.append(
                    "línea %d: una } de más." % linea_de(limpio, i)
                )
                hondo = 0
    if hondo > 0:
        fallos.append("falta(n) %d llave(s) de cierre al final." % hondo)

    # ---- 3. arrobas con bloque ----
    for m in re.finditer(r"@[a-zA-Z-]+", limpio):
        if m.group(0) not in ARROBAS_CON_BLOQUE:
            continue
        resto = limpio[m.end():]
        corte = min(
            (resto.find(c) for c in "{};" if resto.find(c) != -1),
            default=-1,
        )
        if corte == -1 or resto[corte] != "{":
            fallos.append(
                "línea %d: %s sin su bloque { }."
                % (linea_de(limpio, m.start()), m.group(0))
            )

    return fallos


def main():
    hojas = sorted(RAIZ.glob("estilos/**/*.css"))
    if not hojas:
        print("  No he encontrado ninguna hoja en estilos/.")
        return 1

    con_fallos = 0
    for hoja in hojas:
        fallos = revisar(hoja)
        if fallos:
            con_fallos += 1
            print("\n  %s" % hoja.relative_to(RAIZ).as_posix())
            for f in fallos:
                print("     %s" % f)

    print()
    if con_fallos:
        print("  %d hoja(s) con algo mal de %d." % (con_fallos, len(hojas)))
        return 1
    print("  %d hoja(s) revisadas: comentarios y llaves en su sitio." % len(hojas))
    return 0


if __name__ == "__main__":
    sys.exit(main())
