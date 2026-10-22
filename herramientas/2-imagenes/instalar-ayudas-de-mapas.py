#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
INSTALAR LAS AYUDAS DE LOS MAPAS (una vez en cada ordenador)

    python herramientas/2-imagenes/instalar-ayudas-de-mapas.py
    python herramientas/2-imagenes/instalar-ayudas-de-mapas.py --comprobar

Dos cosas que el editor de mapas usa si están (ver herramientas/mapas_mundo.py):

  1. OPENCV, para BUSCAR SOLO dónde cae un mapa regional en el mapamundi.
     Se instala con pip (opencv-python-headless, unos 40 MB).

  2. EL AMPLIADOR CON IA (Real-ESRGAN, realesrgan-ncnn-vulkan), para
     agrandar la imagen de un mapa sin que salga borrosa. Es un programa
     suelto de unos 45 MB: se baja de su página de GitHub
     (github.com/xinntao/Real-ESRGAN, la versión 0.2.5.0) y se deja en
     herramientas/programas/realesrgan/, que NO va a GitHub ni a
     Neocities (.gitignore). Usa la tarjeta gráfica (Vulkan; vale la
     integrada de casi cualquier ordenador de los últimos años).

Con --comprobar no instala nada: dice qué hay y amplía una imagen de
prueba pequeña para ver que el ampliador funciona en este ordenador.
"""

import io
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

HERRAMIENTAS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERRAMIENTAS))

import mapas_mundo  # noqa: E402

VERSION = "v0.2.5.0"
ZIPS = {
    "Windows": "realesrgan-ncnn-vulkan-20220424-windows.zip",
    "Linux": "realesrgan-ncnn-vulkan-20220424-ubuntu.zip",
    "Darwin": "realesrgan-ncnn-vulkan-20220424-macos.zip",
}
URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/%s/%s"
# Lo que trae el zip y no hace falta (vídeos y fotos de ejemplo).
SOBRA = (".mp4", ".jpg", ".jpeg", ".md")


def instalar_opencv():
    if mapas_mundo.hay_opencv():
        print("  OpenCV: ya estaba.")
        return True
    print("  Instalando OpenCV (opencv-python-headless)…")
    for extra in ([], ["--user"]):
        hecho = subprocess.run([sys.executable, "-m", "pip", "install", "opencv-python-headless"] + extra)
        if hecho.returncode == 0:
            print("  OpenCV: instalado.")
            return True
    print("  No se ha podido instalar OpenCV. Prueba a mano:  python -m pip install opencv-python-headless")
    return False


def bajar(url):
    print("  Bajando " + url)
    with urllib.request.urlopen(url, timeout=120) as respuesta:
        total = int(respuesta.headers.get("Content-Length") or 0)
        trozos, llevo, avisado = [], 0, -10
        while True:
            trozo = respuesta.read(1 << 20)
            if not trozo:
                break
            trozos.append(trozo)
            llevo += len(trozo)
            if total:
                cuanto = llevo * 100 // total
                if cuanto >= avisado + 10:
                    print(f"    {cuanto}%")
                    avisado = cuanto
    return b"".join(trozos)


def instalar_ampliador():
    if mapas_mundo.ampliador():
        print("  Ampliador con IA: ya estaba (%s)." % mapas_mundo.ampliador())
        return True
    sistema = platform.system()
    if sistema not in ZIPS:
        print(f"  No hay ampliador para este sistema ({sistema}).")
        return False
    try:
        crudo = bajar(URL % (VERSION, ZIPS[sistema]))
    except OSError as error:
        print(f"  No se ha podido bajar: {error}")
        return False
    carpeta = mapas_mundo.CARPETA_DEL_AMPLIADOR
    if carpeta.exists():
        shutil.rmtree(carpeta)
    carpeta.mkdir(parents=True)
    with zipfile.ZipFile(io.BytesIO(crudo)) as z:
        for miembro in z.infolist():
            nombre = Path(miembro.filename)
            if miembro.is_dir() or nombre.suffix.lower() in SOBRA or ".." in nombre.parts or nombre.is_absolute():
                continue
            destino = carpeta / nombre
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_bytes(z.read(miembro))
    programa = mapas_mundo.ampliador()
    if not programa:
        print("  El zip no traía el programa. Algo ha cambiado en GitHub: avísame.")
        return False
    if sistema != "Windows":
        programa.chmod(0o755)
    print(f"  Ampliador con IA: instalado en {carpeta}.")
    return True


def comprobar():
    print(f"  OpenCV: {'sí' if mapas_mundo.hay_opencv() else 'no'}")
    programa = mapas_mundo.ampliador()
    print(f"  Ampliador con IA: {programa or 'no'}")
    if not programa:
        return
    from PIL import Image
    carpeta = Path(tempfile.mkdtemp(prefix="probar-ampliador-"))
    try:
        Image.new("RGB", (48, 32), (40, 90, 140)).save(carpeta / "a.png")
        con_ia, aviso = mapas_mundo.a_medida(carpeta / "a.png", carpeta / "b.webp", 192, 128)
        print("  Prueba: " + ("amplía con IA, funciona." if con_ia else "NO ha podido usar la IA (" + aviso + ")."))
    finally:
        shutil.rmtree(carpeta, ignore_errors=True)


def principal():
    print("\n  LAS AYUDAS DE LOS MAPAS\n")
    if "--comprobar" in sys.argv:
        comprobar()
        print()
        return 0
    bien = instalar_opencv()
    bien = instalar_ampliador() and bien
    print()
    comprobar()
    print("\n  " + ("Listo." if bien else "Ha faltado algo (mira arriba). Lo demás funciona igual.") + "\n")
    return 0 if bien else 1


if __name__ == "__main__":
    sys.exit(principal())
