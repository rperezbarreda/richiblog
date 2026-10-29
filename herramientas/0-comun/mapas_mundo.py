#!/usr/bin/env python3
# =========================================
# LOS MAPAS REGIONALES, A LA MISMA ESCALA
# =========================================
# Esto NO se ejecuta solo: lo usa el editor de mapas (editor-wiki.py) al
# hacer un mapa nuevo y en «El mapa en sí» → «En el mapamundi».
#
# LA ESCALA COMÚN. Todos los mapas regionales van a la MISMA escala: 8
# píxeles de imagen por cada unidad del mapamundi (el .cmap del mapamundi
# mide 1920 × 1080; su imagen, 2560 × 1440). Es la del mapa de Prunia,
# que se hizo así. Con todos iguales, juntarlos en un mapa grande es poner
# cada uno en su sitio, sin estirar ni encoger nada.
#
# SU SITIO EN EL MAPAMUNDI va en el .cmap del mapa regional, en "world":
#
#     "world": { "map": "Mapamundi de Cralëa.cmap",
#                "x": 331.1, "y": 235.1, "w": 348, "h": 202.3 }
#
# en unidades del mapamundi (lo que mide su .cmap). Chronicler no lo usa
# y no le molesta. Lo encuentra SOLO situar(): busca la imagen del mapa
# regional dentro de la del mapamundi (OpenCV, SIFT: puntos que se
# parecen en las dos y la mejor forma de encajarlos). Funciona con los
# mapas que salen de recortar y ampliar el mapamundi, aunque estén
# retocados; un mapa dibujado de cero no se parece y hay que situarlo a
# mano en el editor.
#
# AMPLIAR SIN PERDER CALIDAD. Agrandar una imagen con la cuenta de siempre
# (Lanczos) solo la estira: los bordes salen borrosos. Con IA (Real-ESRGAN,
# el programa realesrgan-ncnn-vulkan) se rehacen los bordes y la textura y
# sale nítida. El programa no viene con el sitio (pesa 45 MB): lo baja
# herramientas/2-imagenes/instalar-ayudas-de-mapas.py a
# herramientas/programas/realesrgan/, que no va a GitHub. Usa la tarjeta
# gráfica (Vulkan; vale la integrada): son segundos. Si no está, o falla,
# se amplía con Lanczos y un poco de nitidez, y se avisa.
#
# OpenCV tampoco viene con Python: lo instala la misma herramienta
# (pip install opencv-python-headless). Sin él, situar() lo dice y no
# rompe nada.

import json
import math
import platform
import shutil
import subprocess
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
VAULT = RAIZ / "wiki"
NOMBRE_DEL_MAPAMUNDI = "Mapamundi de Cralëa.cmap"
CARPETA_DEL_AMPLIADOR = RAIZ / "herramientas" / "programas" / "realesrgan"

# Píxeles de imagen regional por unidad del mapamundi.
ESCALA_COMUN = 8
# Más que esto de lado no lo abre bien casi nada (ni el navegador).
LADO_MAXIMO = 8192
CALIDAD = 90
# Los modelos de Real-ESRGAN: el general (pintura, texturas) y el de
# dibujos de líneas limpias.
MODELOS = {"pintado": "realesrgan-x4plus", "dibujo": "realesrgan-x4plus-anime"}


# =========================================
# EL MAPAMUNDI
# =========================================

def mapamundi():
    """{"archivo", "nombre", "ancho", "alto", "imagen": Path} del
    mapamundi, o None si no está."""
    archivo = VAULT / NOMBRE_DEL_MAPAMUNDI
    try:
        datos = json.loads(archivo.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    capas = sorted(datos.get("layers") or [], key=lambda c: float(c.get("zIndex") or 0))
    imagen = None
    for capa in capas:
        nombre = str(capa.get("image") or "")
        for sitio in (VAULT / "_imagenes" / nombre, VAULT / "_imagenes" / "mapas" / nombre):
            if nombre and sitio.is_file():
                imagen = sitio
                break
        if imagen:
            break
    if not imagen:
        return None
    return {"archivo": archivo, "nombre": NOMBRE_DEL_MAPAMUNDI, "ancho": float(datos.get("width") or 0),
            "alto": float(datos.get("height") or 0), "imagen": imagen}


def hay_opencv():
    try:
        import cv2  # noqa: F401
        return True
    except ImportError:
        return False


# =========================================
# SITUAR UN MAPA EN EL MAPAMUNDI
# =========================================

def situar(ruta_imagen):
    """Dónde cae la imagen de un mapa regional en el mapamundi.
    Devuelve {"x", "y", "w", "h", "map", "seguridad"} (en unidades del
    mapamundi) o {"error": por qué no}."""
    try:
        import cv2
        import numpy as np
        from PIL import Image
    except ImportError:
        return {"error": "Para buscarlo solo hace falta OpenCV. Instálalo una vez con"
                         " herramientas/2-imagenes/instalar-ayudas-de-mapas.py."}
    mundo = mapamundi()
    if not mundo:
        return {"error": "No encuentro el mapamundi (wiki/%s) o su imagen." % NOMBRE_DEL_MAPAMUNDI}

    def gris(ruta, lado, minimo=0):
        with Image.open(ruta) as abierta:
            plano = abierta.convert("L")
            # Muy grande, se encoge (va más rápido); muy pequeña, se agranda
            # un poco: en una imagen de 200 px apenas hay puntos que buscar.
            f = min(1.0, lado / max(plano.size))
            if minimo and max(plano.size) < minimo:
                f = minimo / max(plano.size)
            if f != 1:
                plano = plano.resize((round(plano.width * f), round(plano.height * f)), Image.LANCZOS)
            return np.array(plano), f

    try:
        regional, f1 = gris(ruta_imagen, 3000, minimo=900)
        grande, f2 = gris(mundo["imagen"], 4000)
    except OSError as error:
        return {"error": "No he podido abrir la imagen: %s" % error}
    sift = cv2.SIFT_create()
    k1, d1 = sift.detectAndCompute(regional, None)
    k2, d2 = sift.detectAndCompute(grande, None)
    if d1 is None or d2 is None or len(k1) < 10:
        return {"error": "La imagen no tiene detalles con los que buscarla."}
    pares = cv2.BFMatcher().knnMatch(d1, d2, k=2)
    buenos = [a for a, *b in pares if b and a.distance < 0.8 * b[0].distance]
    if len(buenos) < 12:
        return {"error": "No se parece a ningún trozo del mapamundi (¿está dibujado de cero?). Sitúalo a mano."}
    origen = np.float32([k1[a.queryIdx].pt for a in buenos])
    destino = np.float32([k2[a.trainIdx].pt for a in buenos])
    matriz, dentro = cv2.estimateAffinePartial2D(origen, destino, ransacReprojThreshold=4)
    seguridad = int(dentro.sum()) if dentro is not None else 0
    if matriz is None or seguridad < 12:
        return {"error": "No he encontrado dónde cae con seguridad. Sitúalo a mano."}
    escala = math.hypot(matriz[0, 0], matriz[1, 0])
    giro = math.degrees(math.atan2(matriz[1, 0], matriz[0, 0]))
    if abs(giro) > 3:
        return {"error": "Parece que está girado respecto al mapamundi (%.0f°). Sitúalo a mano." % giro}
    # De píxeles de la imagen regional (la de verdad) a píxeles de la
    # imagen del mapamundi (la de verdad), y de ahí a unidades del
    # mapamundi (su .cmap).
    with Image.open(ruta_imagen) as abierta:
        ancho, alto = abierta.size
    with Image.open(mundo["imagen"]) as abierta:
        ancho_mundo_img = abierta.size[0]
    por_unidad = ancho_mundo_img / mundo["ancho"]
    x = (matriz[0, 2] / f2) / por_unidad
    y = (matriz[1, 2] / f2) / por_unidad
    w = ancho * f1 * escala / f2 / por_unidad
    h = alto * f1 * escala / f2 / por_unidad
    redondo = lambda n: round(float(n), 1)  # noqa: E731
    return {"map": mundo["nombre"], "x": redondo(x), "y": redondo(y), "w": redondo(w), "h": redondo(h),
            "seguridad": seguridad}


def medida_comun(mundo_rect, ancho, alto):
    """Lo que debería medir la imagen de un mapa situado en mundo_rect para
    ir a la escala común (sin pasar de LADO_MAXIMO). Devuelve (ancho,
    alto, escala_de_verdad)."""
    escala = ESCALA_COMUN
    w, h = float(mundo_rect["w"]) * escala, float(mundo_rect["h"]) * escala
    if max(w, h) > LADO_MAXIMO:
        escala = escala * LADO_MAXIMO / max(w, h)
        w, h = float(mundo_rect["w"]) * escala, float(mundo_rect["h"]) * escala
    # Con la forma de la imagen (el ancho manda: el alto, en proporción).
    nuevo_ancho = max(1, round(w))
    nuevo_alto = max(1, round(nuevo_ancho * alto / ancho))
    return nuevo_ancho, nuevo_alto, escala


# =========================================
# AMPLIAR (O ENCOGER) A UNA MEDIDA
# =========================================

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
    import sys
    if len(sys.argv) > 1:
        print(json.dumps(situar(sys.argv[1]), ensure_ascii=False))
    print("OpenCV:", "sí" if hay_opencv() else "no", "· ampliador con IA:", ampliador() or "no")
