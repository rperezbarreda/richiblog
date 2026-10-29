#!/usr/bin/env python3
# =========================================
# LA LÍNEA DE TIEMPO DE LA WIKI
# =========================================
# Convierte datos/wiki/linea-de-tiempo.json (los eventos y las eras) en:
#
#     web/wiki/linea-de-tiempo/linea_de_tiempo.html      la línea entera
#     web/wiki/linea-de-tiempo/evento_<nombre>.html      una página por evento
#
# y pone la línea (en pequeño, con sus eventos y sus eras) y los eventos en
# la portada de la wiki (en datos/wiki/mundo.json, apartado «historia»).
#
#     python herramientas/3-generadores/generar-linea-tiempo.py
#     python herramientas/3-generadores/generar-linea-tiempo.py --probar
#
# NO HACE FALTA PASARLO A MANO: lo pasan solos
# herramientas/1-publicar/linea-de-tiempo.py (al cambiar un evento) y
# generar-mundo.py (al pasar la wiki, porque los eventos enlazan páginas
# de la wiki y viceversa). Las piezas están en mundo_linea.py.
#
# Sin eventos no se publica nada: ni la página ni la tarjeta de la portada.

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "0-comun"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from comun import pasar_generadores  # noqa: E402
import mundo_linea  # noqa: E402

# Lo de detrás: una página nueva no sale en el sitemap, ni en el mapa, ni
# en el buscador, ni lleva sus hojas de estilo hasta que pasan éstos.
DETRAS = (
    "3-generadores/generar-sitemap.py",
    "3-generadores/generar-mapa.py",
    "3-generadores/generar-buscador.py",
    "3-generadores/actualizar-cabeceras.py",
)


def contar(hecho, probar):
    eventos = hecho["eventos"]
    if not eventos:
        print("  No hay ningún evento en datos/wiki/linea-de-tiempo.json:"
              " no se publica la línea.")
    else:
        print(f"  {len(eventos)} evento(s), de {mundo_linea.fecha_visible(eventos[0])}"
              f" a {mundo_linea.fecha_visible(eventos[-1])}.")
        if probar:
            print("  (--probar: no se ha escrito nada)")
        else:
            print(f"  {hecho['escritas']} archivo(s) escrito(s) o cambiado(s).")
    if hecho["quitadas"]:
        print(f"  Quitado lo que ya no está: {', '.join(hecho['quitadas'][:6])}")
    for nombre, lista in hecho["avisos"]:
        print(f"\n  {nombre}")
        for que, donde in lista:
            print("     " + que + (": " + str(donde) if donde else ""))


def main():
    probar = "--probar" in sys.argv
    hecho = mundo_linea.generar(probar)
    contar(hecho, probar)
    if not probar:
        pasar_generadores(DETRAS)
    return 0


if __name__ == "__main__":
    sys.exit(main())
