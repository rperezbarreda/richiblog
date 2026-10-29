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
# - Los originales que sí se sustituyen no se borran: se guardan en
#   herramientas/originales-sustituidas/ por si acaso. Esa carpeta no
#   hace falta subirla a Neocities.
#
# LO QUE YA HA PASADO NO SE VUELVE A MIRAR
# ----------------------------------------
# Cada imagen que pasa por aquí se apunta en
# herramientas/0-comun/datos/imagenes-pasadas.json con una huella de su CONTENIDO (no
# de la fecha del archivo, que se pierde al copiar la carpeta o al
# descomprimir un zip). La vez siguiente, lo que esté apuntado y no haya
# cambiado ni se mira ni se nombra: solo sale lo nuevo. Si cambias una
# imagen por otra con el mismo nombre, la huella ya no cuadra y se vuelve
# a mirar.
#
#     python herramientas/2-imagenes/optimizar-imagenes.py --todas
#
# se olvida de la lista y lo mira todo otra vez.
#
# UN .webp NUEVO TAMBIÉN SE MIRA. Antes se saltaban todos por ser WebP, y
# así se colaban fotos de 4000 px y con los datos del móvil dentro (pasó
# con tres del blog). Ahora, si un WebP nuevo pasa de MAX_LADO o lleva
# metadatos, se encoge o se limpia; si no, solo se apunta. No se
# recomprime nada que no lo necesite: cada recompresión pierde algo.
#
# LO QUE NO SE TOCA NUNCA, y ni se nombra: el favicon (tiene que seguir
# siendo .ico), los iconos de las redes (imagenes/social_media/, SVG que
# el CSS pinta del color del tema) y cualquier otro SVG o ICO. Ver
# EXCLUIDAS, aquí abajo.

import sys
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "0-comun"))

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
# Por la ruta, desde imagenes/: un archivo, o una carpeta si acaba en "/".
EXCLUIDAS = ("favicon.ico", "social_media/")

# La lista de lo que ya ha pasado (ver arriba). En herramientas/, que no
# se sube a Neocities; sí va en git, para que valga en cualquier ordenador.
PASADAS = RAIZ / "herramientas" / "0-comun" / "datos" / "imagenes-pasadas.json"


def huella(archivo):
    import hashlib
    return hashlib.sha1(archivo.read_bytes()).hexdigest()[:16]


def leer_pasadas():
    import json
    try:
        datos = json.loads(PASADAS.read_text(encoding="utf-8"))
        return datos if isinstance(datos, dict) else {}
    except (OSError, ValueError):
        return {}


def guardar_pasadas(pasadas):
    import json
    PASADAS.write_text(json.dumps(dict(sorted(pasadas.items())), ensure_ascii=False, indent=1) + "\n",
                       encoding="utf-8")


def excluida(rel_imagenes):
    """Si una ruta (desde imagenes/) no se toca nunca."""
    ruta = rel_imagenes.as_posix()
    if rel_imagenes.suffix.lower() in INTOCABLES:
        return True
    return any(ruta == e or (e.endswith("/") and ruta.startswith(e)) for e in EXCLUIDAS)


def sin_metadatos_webp(crudo):
    """El mismo WebP sin sus bloques de metadatos (EXIF y XMP), SIN
    recomprimir la imagen: un WebP es una lista de bloques y la foto va en
    uno y los datos del móvil en otros, así que basta con quitar esos.
    Devuelve los bytes nuevos, o None si no es un WebP que se entienda."""
    import struct
    if len(crudo) < 12 or crudo[:4] != b"RIFF" or crudo[8:12] != b"WEBP":
        return None
    bloques, i = [], 12
    while i + 8 <= len(crudo):
        tipo = crudo[i:i + 4]
        largo = struct.unpack("<I", crudo[i + 4:i + 8])[0]
        fin = i + 8 + largo + (largo & 1)
        if fin > len(crudo):
            return None
        if tipo not in (b"EXIF", b"XMP "):
            bloque = bytearray(crudo[i:fin])
            if tipo == b"VP8X":
                # Los avisos de "aquí hay EXIF / XMP" de la cabecera.
                bloque[8] &= ~(0x08 | 0x04) & 0xFF
            bloques.append(bytes(bloque))
        i = fin
    cuerpo = b"WEBP" + b"".join(bloques)
    return b"RIFF" + struct.pack("<I", len(cuerpo)) + cuerpo


def repasar_webp(origen, probar):
    """Un WebP que no ha pasado por aquí: si lleva metadatos se le quitan
    (sin recomprimir), y si es enorme se encoge, pero solo si sale más
    ligero. Devuelve una frase con lo hecho, o None si estaba bien (y
    entonces no se toca)."""
    with Image.open(origen) as img:
        animada = getattr(img, "n_frames", 1) > 1
        grande = max(img.size) > MAX_LADO and not animada
        datos = bool(img.info.get("exif")) or bool(img.info.get("xmp"))
    if not (grande or datos):
        return None
    if probar:
        return " y ".join(m for m, si in (("a encoger", grande), ("sin metadatos", datos)) if si)

    antes = origen.stat().st_size
    copia = COPIA / origen.relative_to(IMGS)
    copia.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(origen, copia)
    hecho = []

    if datos:
        limpio = sin_metadatos_webp(origen.read_bytes())
        if limpio:
            origen.write_bytes(limpio)
            hecho.append("sin metadatos")

    if grande:
        import io
        with Image.open(origen) as img:
            plano = img.convert("RGBA" if img.mode in ("RGBA", "LA", "P") else "RGB")
            plano.thumbnail((MAX_LADO, MAX_LADO), Image.LANCZOS)
            salida = io.BytesIO()
            plano.save(salida, "WEBP", quality=CALIDAD, method=6)
        # Solo si pesa menos: encoger una foto que ya venía muy comprimida
        # puede dar un archivo más pesado (pasó: 248 KB -> 480), y eso no
        # es optimizar.
        if salida.tell() < origen.stat().st_size:
            origen.write_bytes(salida.getvalue())
            hecho.append("encogida")
        else:
            hecho.append("de tamaño se queda (encogida pesaba más)")

    if not hecho:
        return None
    despues = origen.stat().st_size
    return f"{' y '.join(hecho)}: {antes/1024:.1f} KB -> {despues/1024:.1f} KB"


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


def procesar(probar=False, todas=False):
    if not IMGS.is_dir():
        print(f"No encuentro la carpeta {IMGS.relative_to(RAIZ)}.")
        return

    if probar:
        print("  MODO PRUEBA: no se cambia ningún archivo.\n")

    imagenes = sorted(p for p in IMGS.rglob("*") if p.is_file())
    cambios = []
    fallidas = []
    total_antes = total_despues = 0
    convertidas = intactas = ya_estaban = excluidas = repasadas = 0
    pasadas = {} if todas else leer_pasadas()
    # Lo que sigue en la carpeta: lo apuntado de algo que ya no está se
    # olvida al guardar.
    vistas = {}

    def apuntar(archivo):
        clave = archivo.relative_to(IMGS).as_posix()
        vistas[clave] = huella(archivo)

    for origen in imagenes:
        rel = origen.relative_to(RAIZ)
        ext = origen.suffix.lower()

        if excluida(origen.relative_to(IMGS)):
            excluidas += 1
            continue

        if ext not in CONVERTIBLES and ext != ".webp":
            continue

        # YA PASADA y sin cambios: ni se mira.
        clave = origen.relative_to(IMGS).as_posix()
        if pasadas.get(clave) == huella(origen):
            vistas[clave] = pasadas[clave]
            ya_estaban += 1
            continue

        if ext == ".webp":
            try:
                hecho = repasar_webp(origen, probar)
            except Exception as error:
                print(f"  {str(rel):52} NO se ha podido revisar: {error}")
                fallidas.append(str(rel))
                continue
            if hecho:
                print(f"  {str(rel):52} {hecho}")
                repasadas += 1
            if not probar:
                apuntar(origen)
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
            # Apuntada igual: la próxima vez no hay que volver a probarlo.
            if not probar:
                apuntar(origen)
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
            apuntar(destino)

    if cambios:
        print("\n  Actualizando enlaces en el código:")
        actualizar_referencias(cambios, probar)

    if not probar:
        guardar_pasadas(vistas)

    print(f"\n  {convertidas} convertida(s) a WebP, {repasadas} WebP encogido(s) o limpiado(s),"
          f" {intactas} dejada(s) como estaban.")
    print(f"  {ya_estaban} ya habían pasado y no se han mirado;"
          f" {excluidas} que no se tocan nunca (favicon, iconos de redes, SVG).")
    if fallidas:
        print(f"  {len(fallidas)} no se pudieron convertir: {', '.join(fallidas)}")
    if not probar and total_antes:
        print(f"  Peso: {total_antes/1024:.0f} KB -> {total_despues/1024:.0f} KB"
              f"  ({100 - total_despues * 100 / total_antes:.0f}% menos)")
        print(f"  Los originales están guardados en {COPIA.relative_to(RAIZ)}")
    if probar and convertidas:
        print("  Ejecútalo sin --probar para aplicarlo.")


if __name__ == "__main__":
    procesar(probar="--probar" in sys.argv, todas="--todas" in sys.argv)
