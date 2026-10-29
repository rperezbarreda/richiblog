#!/usr/bin/env python3
# =========================================
# EL NOMBRE Y LA INTRO DE LA PÁGINA DE NPCS, LOS DEL JSON
# =========================================
# La página de npcs (web/notas_rol/<clave>/npcs_<clave>.html) lleva
# escritos el nombre de la campaña y una línea de presentación, y
# scripts/paginas/npcs-rol.js los cambia al cargar por los de
# datos/notas_rol/npcs-<clave>.json ("nombre" e "intro"). Si los dos no
# dicen lo mismo, la página se pinta con uno, llega el JSON y salta al
# otro: medido, una intro con una frase de más empujaba la página entera
# 70 px hacia abajo, y era casi todo el salto de maqueta de la página.
#
# Así que esto copia los del JSON a la página, y el JSON es el que manda:
# se cambia ahí y esto lo pone al día. Lo pasan solos los generadores
# (GENERADORES, en comun.py) y nuevo-personaje.py.
#
#     python herramientas/3-generadores/textos-npcs.py
#     python herramientas/3-generadores/textos-npcs.py --probar

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "0-comun"))

import html  # noqa: E402
import re  # noqa: E402

from comun import RAIZ, escribir_como_estaba, leer_json, leer_texto  # noqa: E402

CAMPOS = (("nombre", "data-npcs-nombre"), ("intro", "data-npcs-intro"))


def main():
    probar = "--probar" in sys.argv
    cambiadas = 0
    for archivo in sorted((RAIZ / "datos" / "notas_rol").glob("npcs-*.json")):
        datos = leer_json(archivo, {})
        if not isinstance(datos, dict):
            continue
        pagina = (datos.get("pagina") or "").strip()
        if not pagina.startswith("/") or pagina.startswith("//"):
            continue
        destino = RAIZ / pagina.lstrip("/")
        if not destino.is_file():
            continue
        texto, _ = leer_texto(destino)
        nuevo = texto
        for clave, atributo in CAMPOS:
            valor = (datos.get(clave) or "").strip()
            if not valor:
                continue
            # <p class="..." data-npcs-intro>lo que sea</p>: se cambia lo de
            # dentro y nada más. Escapado, porque va dentro del HTML.
            nuevo = re.sub(
                r"(<(\w+)[^>]*\b%s\b[^>]*>)(.*?)(</\2>)" % re.escape(atributo),
                lambda m: m.group(1) + html.escape(valor, quote=False) + m.group(4),
                nuevo, count=1, flags=re.S)
        if nuevo != texto:
            cambiadas += 1
            print(f"  {destino.relative_to(RAIZ)}: nombre e intro al día con"
                  f" {archivo.relative_to(RAIZ)}")
            if not probar:
                escribir_como_estaba(destino, nuevo)
    if not cambiadas:
        print("  Las páginas de npcs ya dicen lo mismo que su JSON.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
