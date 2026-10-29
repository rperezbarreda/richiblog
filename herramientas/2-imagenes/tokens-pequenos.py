#!/usr/bin/env python3
# =========================================
# LOS TOKENS, EN PEQUEÑO
# =========================================
# Los tokens de los NPC y de los personajes de la mesa se guardan a
# 564 px (el doble de lo que mide la ficha), pero donde más se ven es en
# la rejilla de npcs, en la fila de retratos de la campaña y en el globo
# de las notas, y ahí miden entre 102 y 140 px. Medido: la página de npcs
# se bajaba ~700 KB de tokens para enseñarlos del tamaño de un sello.
#
# Esto hace, al lado de cada token, una copia de 280 px (el doble de lo
# más grande que se ve, para pantallas finas) con "-mini" en el nombre, y
# apunta su ruta en el JSON como "token_mini":
#
#     "token": "/imagenes/notas_rol/ragna/sigil_tkn.webp",
#     "token_mini": "/imagenes/notas_rol/ragna/sigil_tkn-mini.webp",
#
# La web usa el mini donde se ve pequeño y el grande en la ficha. Si un
# token no tiene mini (no estaba Pillow, o lo has puesto a mano y no se ha
# pasado esto), se usa el grande, como siempre: no se rompe nada.
#
# NO HACE FALTA PASARLO A MANO: lo pasan los generadores (va en
# GENERADORES, en comun.py) y nuevo-personaje.py. Solo rehace un mini si
# el token es más nuevo que él.
#
#     python herramientas/2-imagenes/tokens-pequenos.py
#     python herramientas/2-imagenes/tokens-pequenos.py --probar

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "0-comun"))

from comun import RAIZ, escribir_json, leer_json  # noqa: E402
from imagenes import hacer_pequena  # noqa: E402

LADO = 280
CARPETA = RAIZ / "datos" / "notas_rol"


def main():
    probar = "--probar" in sys.argv
    hechos, sin_poder, archivos = 0, [], 0
    for archivo in sorted(CARPETA.glob("npcs-*.json")) + sorted(CARPETA.glob("campana-*.json")):
        datos = leer_json(archivo, None)
        if not isinstance(datos, dict) or not isinstance(datos.get("personajes"), list):
            continue
        cambiado = False
        for quien in datos["personajes"]:
            if not isinstance(quien, dict):
                continue
            token = (quien.get("token") or "").strip()
            if not token.startswith("/") or token.startswith("//"):
                if "token_mini" in quien:
                    del quien["token_mini"]
                    cambiado = True
                continue
            antes = Path(RAIZ / token.lstrip("/")).with_name(
                Path(token).stem + "-mini.webp")
            ya_estaba = antes.is_file() and antes.stat().st_mtime >= (RAIZ / token.lstrip("/")).stat().st_mtime \
                if (RAIZ / token.lstrip("/")).is_file() else False
            mini = hacer_pequena(token, LADO, probar=probar)
            if not mini:
                sin_poder.append(f"{quien.get('nombre') or '?'} ({token})")
                continue
            if not ya_estaba:
                hechos += 1
            if quien.get("token_mini") != mini:
                quien["token_mini"] = mini
                cambiado = True
        if cambiado:
            archivos += 1
            if not probar:
                escribir_json(archivo, datos)

    verbo = "Haría" if probar else "Hechos"
    if hechos or archivos:
        print(f"  {verbo} {hechos} token(s) pequeño(s); {archivos} JSON puesto(s) al día.")
    else:
        print("  Los tokens pequeños ya estaban al día.")
    for nombre in sin_poder:
        print(f"  OJO: no he podido hacer el pequeño de {nombre}: se queda el grande.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
