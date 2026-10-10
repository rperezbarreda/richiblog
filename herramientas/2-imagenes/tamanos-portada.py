#!/usr/bin/env python3
# =========================================
# LOS TAMAÑOS DEL DIBUJO DE LA PORTADA
# =========================================
# El dibujo de la portada está en tres anchos por tema (412, 620 y el
# original de 1161) y el navegador se baja el que le hace falta. Esto
# saca los dos pequeños a partir de los grandes.
#
# POR QUÉ
# -------
# Medido: en casi todas las pantallas el dibujo se ve a 206 píxeles de
# ancho. Bajarse el de 1161 para eso son 187 KB en la página más
# pesada del sitio, y encima es lo último que termina de aparecer. Con
# los tres tamaños, un portátil normal se baja 45 KB en vez de 187.
#
# CUÁNDO USARLO
# -------------
# Solo si cambias el dibujo. Pon los dos nuevos (claro y oscuro) en
# imagenes/main/ con los mismos nombres de siempre y ejecuta:
#
#     python3 herramientas/2-imagenes/tamanos-portada.py
#
# Si el dibujo nuevo tiene otras medidas, te lo dice: hay que cambiar
# el width, el height y los números del srcset en index.html (te los
# escribe aquí, listos para copiar).
#
# Necesita Pillow:  pip install pillow
#
# NOTA: esta carpeta "herramientas" es solo para ti — no hace falta
# subirla a Neocities.

import sys
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


try:
    from PIL import Image
except ImportError:
    print("  Falta la librería Pillow:  pip install pillow")
    sys.exit(1)

from comun import RAIZ
CARPETA = RAIZ / "imagenes" / "main"

# Los dos dibujos, uno por tema.
ORIGINALES = ("pngtuber_dark_theme", "pngtuber_white_theme")

# Los anchos pequeños. 412 = los 206 px a los que se ve, en pantalla
# retina; 620 cubre el tramo de 1900px de ventana en adelante.
ANCHOS = (412, 620)

CALIDAD = 82


def main():
    if not CARPETA.is_dir():
        print(f"  No encuentro {CARPETA.relative_to(RAIZ)}.")
        return 1

    medidas = set()
    for nombre in ORIGINALES:
        origen = CARPETA / f"{nombre}.webp"
        if not origen.is_file():
            print(f"  No encuentro {origen.relative_to(RAIZ)}, lo salto.")
            continue

        imagen = Image.open(origen).convert("RGBA")
        medidas.add(imagen.size)
        print(f"\n  {origen.relative_to(RAIZ)}  ({imagen.size[0]}x{imagen.size[1]},"
              f" {origen.stat().st_size / 1024:.0f} KB)")

        for ancho in ANCHOS:
            if ancho >= imagen.size[0]:
                print(f"     {ancho}px: el original ya es más pequeño, lo salto.")
                continue
            alto = round(imagen.size[1] * ancho / imagen.size[0])
            destino = CARPETA / f"{nombre}-{ancho}.webp"
            imagen.resize((ancho, alto), Image.LANCZOS).save(
                destino, "WEBP", quality=CALIDAD, method=6
            )
            print(f"     {destino.name}  {ancho}x{alto}"
                  f"  {destino.stat().st_size / 1024:.0f} KB")

    if len(medidas) > 1:
        print("\n  OJO: los dos dibujos no miden lo mismo. Deberían, o la")
        print("  portada dará un salto al cambiar de tema.")

    if medidas:
        ancho, alto = sorted(medidas)[-1]
        print("\n  En index.html, la ilustración tiene que decir:")
        print(f'\n      width="{ancho}" height="{alto}"')
        print(f"      ...-412.webp 412w, ...-620.webp 620w, ....webp {ancho}w")
        print("\n  Si esos números ya son los que hay, no hay que tocar nada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
