#!/usr/bin/env python3
# =========================================
# AMPLIAR LA IMAGEN DE UN MAPA
# =========================================
# Esto NO se ejecuta solo: lo usa el editor de mapas (editor-wiki.py) en
# «El mapa en sí» → «Ampliar la imagen», para los mapas de las campañas.
# (Se llama así porque empezó con los mapas de la wiki de Cralëa, que
# también los situaba en el mapamundi; la wiki se fue a su propio repo.)
#
# AMPLIAR SIN PERDER CALIDAD. Agrandar una imagen con la cuenta de siempre
# (Lanczos) solo la estira: los bordes salen borrosos. Con IA (Real-ESRGAN,
# el programa realesrgan-ncnn-vulkan) se rehacen los bordes y la textura y
# sale nítida. El programa no viene con el sitio (pesa 45 MB): lo baja
# herramientas/2-imagenes/instalar-ayudas-de-mapas.py a
# herramientas/programas/realesrgan/, que no va a GitHub. Usa la tarjeta
# gráfica (Vulkan; vale la integrada): son segundos. Si no está, o falla,
# se amplía con Lanczos y un poco de nitidez, y se avisa.

import platform
import shutil
import subprocess
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
CARPETA_DEL_AMPLIADOR = RAIZ / "herramientas" / "programas" / "realesrgan"

# Más que esto de lado no lo abre bien casi nada (ni el navegador).
LADO_MAXIMO = 8192
CALIDAD = 90
# Los modelos de Real-ESRGAN: el general (pintura, texturas) y el de
# dibujos de líneas limpias.
MODELOS = {"pintado": "realesrgan-x4plus", "dibujo": "realesrgan-x4plus-anime"}


def ampliador():
    """El programa de Real-ESRGAN, si está instalado."""
    nombre = "realesrgan-ncnn-vulkan" + (".exe" if platform.system() == "Windows" else "")
    for sitio in (CARPETA_DEL_AMPLIADOR / nombre, *CARPETA_DEL_AMPLIADOR.glob("*/" + nombre)):
        if sitio.is_file():
            return sitio
    encontrado = shutil.which("realesrgan-ncnn-vulkan")
    return Path(encontrado) if encontrado else None


def _con_ia(origen_png, destino_png, modelo):
    programa = ampliador()
    if not programa:
        return "no está instalado el ampliador con IA"
    carpeta_modelos = programa.parent / "models"
    orden = [str(programa), "-i", str(origen_png), "-o", str(destino_png), "-n", MODELOS.get(modelo, modelo),
             "-s", "4", "-f", "png"]
    if carpeta_modelos.is_dir():
        orden += ["-m", str(carpeta_modelos)]
    try:
        hecho = subprocess.run(orden, capture_output=True, text=True, timeout=3600,
                               creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    except (OSError, subprocess.TimeoutExpired) as error:
        return "el ampliador con IA no ha funcionado (%s)" % error
    if hecho.returncode != 0 or not Path(destino_png).is_file():
        detalle = (hecho.stderr or hecho.stdout or "").strip().splitlines()
        return "el ampliador con IA no ha funcionado (%s)" % (detalle[-1] if detalle else "sin tarjeta gráfica?")
    return ""


def a_medida(origen, destino, ancho, alto, ia=True, modelo="pintado"):
    """La imagen origen a ancho × alto, guardada en destino (WebP).
    Para agrandar, con IA si está (y si no, Lanczos con un poco de
    nitidez); para encoger, Lanczos. Devuelve (con_ia, aviso)."""
    from PIL import Image, ImageFilter
    with Image.open(origen) as abierta:
        plano = abierta.convert("RGBA" if abierta.mode in ("RGBA", "LA", "P") else "RGB")
    factor = max(ancho / plano.width, alto / plano.height)
    con_ia = False
    aviso = ""
    if factor > 1.15 and ia:
        carpeta = Path(tempfile.mkdtemp(prefix="mapa-ampliar-"))
        try:
            entrada, salida = carpeta / "entrada.png", carpeta / "salida.png"
            plano.convert("RGB").save(entrada)
            fallo = _con_ia(entrada, salida, modelo)
            if not fallo:
                with Image.open(salida) as ampliada:
                    grande = ampliada.convert("RGB")
                    # (Si la original tenía transparencia, se le devuelve.)
                    if plano.mode == "RGBA":
                        grande.putalpha(plano.getchannel("A").resize(grande.size, Image.LANCZOS))
                    plano = grande
                con_ia = True
            else:
                aviso = fallo + "; ampliada sin IA"
        finally:
            shutil.rmtree(carpeta, ignore_errors=True)
    if plano.size != (ancho, alto):
        agrandar = ancho > plano.width
        plano = plano.resize((ancho, alto), Image.LANCZOS)
        if agrandar and not con_ia:
            plano = plano.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    Path(destino).parent.mkdir(parents=True, exist_ok=True)
    plano.save(destino, "WEBP", quality=CALIDAD, method=6)
    return con_ia, aviso


if __name__ == "__main__":
    print("Ampliador con IA:", ampliador() or "no")
