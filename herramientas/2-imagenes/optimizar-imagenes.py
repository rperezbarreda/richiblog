#!/usr/bin/env python3
# =========================================
# OPTIMIZADOR DE IMÁGENES — TODA LA CARPETA imagenes/
# =========================================
# Recorre imagenes/ entera, pasa a WebP lo que convenga, y actualiza las
# referencias en el HTML, el CSS y el JavaScript para que no se rompa
# ningún enlace al cambiar la extensión.
#
# CÓMO USARLO
# -----------
# 1. Instala la librería de imágenes, una sola vez:
#
#        pip install pillow
#
#    (en Windows, si "pip" no le suena:  py -m pip install pillow)
#
# 2. Desde la carpeta raíz del sitio, primero mira qué haría sin
#    tocar nada:
#
#        python herramientas/2-imagenes/optimizar-imagenes.py --probar
#
# 3. Si te convence, ejecútalo de verdad:
#
#        python herramientas/2-imagenes/optimizar-imagenes.py
#
# QUÉ HACE Y QUÉ NO
# -----------------
# - Convierte a WebP cualquier imagen de imagenes/ que no lo sea ya.
# - Si la imagen es más grande de lo necesario, la reduce (ver
#   MAX_LADO abajo). Nada que ya esté a un tamaño razonable se toca.
# - Conserva la animación de los GIF animados.
# - Le quita los metadatos: las fotos de móvil llevan dentro el
#   modelo, la fecha y muchas veces las coordenadas GPS de donde se
#   hicieron. Eso no tiene por qué acabar publicado.
# - Si el WebP sale MÁS GRANDE que el original (pasa con iconos
#   pequeños y con PNG de pocos colores), se queda el original y te
#   lo dice. Convertir por convertir no es optimizar.
# - No toca el favicon (.ico): tiene que seguir siendo .ico.
# - Los originales que sí se sustituyen no se borran: se guardan en
#   herramientas/originales-sustituidas/ por si acaso. Esa carpeta no
#   hace falta subirla a Neocities.
#
# Puedes ejecutarlo tantas veces como quieras: lo ya convertido se lo
# salta.

import sys
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import shutil

try:
    from PIL import Image, ImageOps
except ImportError:
    print("Falta la librería Pillow. Instálala con:  pip install pillow")
    print("(en Windows, si pip no le suena:  py -m pip install pillow)")
    sys.exit(1)

# ---- Ajustes ----
# Lado máximo en píxeles. Solo se reduce lo que lo supere; está alto a
# propósito para no estropear imágenes que ya estaban bien ajustadas.
# Si metes fotos de móvil (4000 px), bájalo a 1600 y las dejará a un
# tamaño mucho más sensato.
MAX_LADO = 1920
CALIDAD = 82          # 0-100; por encima de 85 se nota poco y pesa bastante más
CALIDAD_ANIMADA = 70  # las animaciones pesan mucho más: se aprieta algo más

from comun import RAIZ
IMGS = RAIZ / "imagenes"
COPIA = RAIZ / "herramientas" / "originales-sustituidas"

# Dónde buscar las rutas que hay que actualizar al renombrar
EXTENSIONES_TEXTO = {".html", ".css", ".js", ".json", ".xml"}
CARPETAS_IGNORADAS = {"herramientas", "originales-sustituidas"}

CONVERTIBLES = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tif", ".tiff"}
INTOCABLES = {".ico", ".svg"}


def archivos_de_texto():
    for p in RAIZ.rglob("*"):
        if not p.is_file() or p.suffix.lower() not in EXTENSIONES_TEXTO:
            continue
        if set(p.relative_to(RAIZ).parts) & CARPETAS_IGNORADAS:
            continue
        yield p


def actualizar_referencias(cambios, probar):
    """cambios = [(ruta_vieja, ruta_nueva)] tal y como aparecen en el código."""
    tocados = 0
    for archivo in archivos_de_texto():
        texto = archivo.read_text(encoding="utf-8")
        nuevo = texto
        for viejo, reciente in cambios:
            nuevo = nuevo.replace(viejo, reciente)
        if nuevo != texto:
            tocados += 1
            if not probar:
                archivo.write_text(nuevo, encoding="utf-8")
            print(f"     referencia actualizada en {archivo.relative_to(RAIZ)}")
    return tocados


def convertir(origen, probar):
    """Devuelve (destino, bytes_antes, bytes_despues) o None si no compensa."""
    destino = origen.with_suffix(".webp")
    antes = origen.stat().st_size

    with Image.open(origen) as img:
        # Solo se tratan como animación los formatos que de verdad lo son.
        # Un TIFF de varias páginas también tiene "n_frames", pero es un
        # documento escaneado, no una animación: de ese nos quedamos con
        # la primera página.
        animada = (img.format in {"GIF", "WEBP", "PNG"}
                   and getattr(img, "n_frames", 1) > 1)

        if animada:
            lienzo = img.size
            # Todos los fotogramas tienen que medir lo mismo o el WebP se
            # niega a guardarlos ("Invalid frame dimensions"). Muchos GIF
            # guardan cada fotograma recortado a la zona que cambia, así
            # que aquí se pega cada uno sobre un lienzo del tamaño
            # completo antes de nada.
            escala = min(1.0, MAX_LADO / max(lienzo))
            tam_final = (max(1, round(lienzo[0] * escala)),
                         max(1, round(lienzo[1] * escala))) if escala < 1 else None

            fotogramas = []
            duraciones = []
            for i in range(img.n_frames):
                img.seek(i)
                duraciones.append(img.info.get("duration", 80))
                cuadro = img.convert("RGBA")
                if cuadro.size != lienzo:
                    fondo = Image.new("RGBA", lienzo, (0, 0, 0, 0))
                    fondo.paste(cuadro)
                    cuadro = fondo
                if tam_final:
                    cuadro = cuadro.resize(tam_final, Image.LANCZOS)
                fotogramas.append(cuadro.copy())

            primero, resto = fotogramas[0], fotogramas[1:]
            if probar:
                return destino, antes, None
            primero.save(destino, "WEBP", save_all=True, append_images=resto,
                         duration=duraciones, loop=0, quality=CALIDAD_ANIMADA,
                         method=4, minimize_size=True)
        else:
            if getattr(img, "n_frames", 1) > 1:
                img.seek(0)  # TIFF de varias páginas: solo la primera
            # exif_transpose gira la foto según cómo se sostuvo el móvil;
            # sin esto, las verticales salen tumbadas.
            plano = ImageOps.exif_transpose(img)
            tiene_transparencia = plano.mode in ("RGBA", "LA", "P")
            plano = plano.convert("RGBA" if tiene_transparencia else "RGB")
            if max(plano.size) > MAX_LADO:
                plano.thumbnail((MAX_LADO, MAX_LADO), Image.LANCZOS)
            if probar:
                return destino, antes, None
            # Sin exif= no se copia ningún metadato: adiós al GPS.
            plano.save(destino, "WEBP", quality=CALIDAD, method=6)

    despues = destino.stat().st_size
    if despues >= antes:
        destino.unlink()
        return None
    return destino, antes, despues


def procesar(probar=False):
    if not IMGS.is_dir():
        print(f"No encuentro la carpeta {IMGS.relative_to(RAIZ)}.")
        return

    if probar:
        print("  MODO PRUEBA: no se cambia ningún archivo.\n")

    imagenes = sorted(p for p in IMGS.rglob("*") if p.is_file())
    cambios = []
    fallidas = []
    total_antes = total_despues = 0
    convertidas = intactas = ya_estaban = 0

    for origen in imagenes:
        rel = origen.relative_to(RAIZ)
        ext = origen.suffix.lower()

        if ext in INTOCABLES:
            print(f"  {str(rel):52} se deja como está ({ext})")
            intactas += 1
            continue

        if ext == ".webp":
            ya_estaban += 1
            continue

        if ext not in CONVERTIBLES:
            continue

        # Si una imagen concreta da problemas, se dice cuál y se sigue con
        # las demás: antes un solo archivo raro abortaba todo el proceso
        # sin llegar a decir siquiera de cuál se trataba.
        try:
            resultado = convertir(origen, probar)
        except Exception as error:
            print(f"  {str(rel):52} NO se ha podido convertir: {error}")
            print( "       (se queda el original, el resto sigue su curso)")
            if destino_suelto := origen.with_suffix(".webp"):
                if destino_suelto.is_file() and destino_suelto.stat().st_size == 0:
                    destino_suelto.unlink()
            fallidas.append(str(rel))
            continue

        if resultado is None:
            print(f"  {str(rel):52} el WebP salía más grande: se queda el original")
            intactas += 1
            continue

        destino, antes, despues = resultado
        if probar:
            print(f"  {str(rel):52} -> {destino.name}")
            convertidas += 1
        else:
            total_antes += antes
            total_despues += despues
            convertidas += 1
            print(f"  {str(rel):52} {antes/1024:8.1f} KB -> {despues/1024:7.1f} KB"
                  f"  ({100 - despues * 100 / antes:.0f}% menos)")

        cambios.append(("/" + rel.as_posix(), "/" + destino.relative_to(RAIZ).as_posix()))
        cambios.append((origen.name, destino.name))

        if not probar:
            guardado = COPIA / rel.relative_to("imagenes")
            guardado.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(origen), str(guardado))

    if cambios:
        print("\n  Actualizando enlaces en el código:")
        actualizar_referencias(cambios, probar)

    print(f"\n  {convertidas} convertida(s), {intactas} dejada(s) como estaban,"
          f" {ya_estaban} ya eran WebP.")
    if fallidas:
        print(f"  {len(fallidas)} no se pudieron convertir: {', '.join(fallidas)}")
    if not probar and total_antes:
        print(f"  Peso: {total_antes/1024:.0f} KB -> {total_despues/1024:.0f} KB"
              f"  ({100 - total_despues * 100 / total_antes:.0f}% menos)")
        print(f"  Los originales están guardados en {COPIA.relative_to(RAIZ)}")
    if probar and convertidas:
        print("  Ejecútalo sin --probar para aplicarlo.")


if __name__ == "__main__":
    procesar(probar="--probar" in sys.argv)
