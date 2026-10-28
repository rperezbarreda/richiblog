#!/usr/bin/env python3
# =========================================
# TRAER UNA IMAGEN DE FUERA Y DEJARLA LISTA
# =========================================
# Esto NO se ejecuta solo: es lo que usan la herramienta traer-imagen.py y
# la de añadir NPC para coger una imagen de donde la tengas —la carpeta de
# descargas, el escritorio, un pendrive— y dejarla dentro del sitio, en su
# sitio, con el nombre que toca y al tamaño que toca.
#
# POR QUÉ EXISTE
# --------------
# Antes había que hacerlo a mano y en cuatro pasos: copiar el archivo a
# imagenes/..., renombrarlo, pasarlo a WebP y acordarse de la ruta para
# escribirla en el JSON. Cuatro pasos para una foto, y cada vez que se
# olvidaba uno quedaba un JPG de cuatro megas publicado o una ruta mal
# escrita que no se veía hasta abrir la página.
#
# QUÉ HACE
# --------
# - Admite la ruta tal y como la copias del explorador de Windows
#   (e:\rpere\Descargas\ejemplo.jpg), con comillas o sin ellas, y también
#   las de toda la vida (/home/..., ~/Descargas/...).
# - La convierte a WebP, que es lo que usa el sitio entero.
# - La deja al tamaño que pida el sitio al que va (un token no necesita
#   4000 píxeles), y si ya era más pequeña NO la agranda: estirar una
#   imagen pequeña solo la emborrona.
# - Recorta a cuadrado lo que tenga que ser cuadrado, tirando hacia
#   arriba: un retrato recortado por el centro se queda sin cabeza.
# - Le quita los metadatos. Las fotos llevan dentro el modelo del móvil,
#   la fecha y muchas veces las coordenadas de dónde se hicieron, y eso no
#   tiene por qué acabar publicado.
# - Gira la foto según cómo se sostuvo el móvil, que si no salen tumbadas.
# - Conserva la transparencia de los PNG.
# - NO borra ni toca el original: lo tuyo se queda donde estaba.
#
# LO QUE DEVUELVE es la ruta tal y como se escribe en un JSON del sitio
# ("/imagenes/notas_rol/ragna/sigil_tkn.webp"), lista para pegar.

import re
import shutil
from pathlib import Path

from comun import RAIZ, nombre_archivo


# =========================================
# A DÓNDE VA CADA COSA
# =========================================
# Cada sitio dice en qué carpeta se guarda, cuánto puede medir y si tiene
# que salir cuadrado. {campana} lo rellena quien llame a esto.
#
# LOS TAMAÑOS no son caprichosos: son los que de verdad se ven en la web,
# medidos en pantalla y multiplicados por dos para que no se vean borrosos
# en una pantalla de las finas. Subir una imagen de 4000 píxeles para
# enseñarla a 140 es hacer esperar a quien entra por nada.
SITIOS = {
    "npc-token": {
        "que": "token de un NPC (el redondel de la rejilla)",
        "carpeta": "imagenes/notas_rol/{campana}",
        "sufijo": "_tkn",
        "lado": 564,
        "cuadrada": True,
    },
    "npc-ficha": {
        "que": "ilustración de un NPC (la grande de su ficha)",
        "carpeta": "imagenes/notas_rol/{campana}",
        "sufijo": "",
        "lado": 1000,
        "cuadrada": False,
    },
    "pj-token": {
        "que": "retrato de un personaje de la mesa",
        "carpeta": "imagenes/notas_rol/{campana}",
        "sufijo": "_tkn",
        "lado": 564,
        "cuadrada": True,
    },
    "pj-ficha": {
        "que": "ilustración de un personaje de la mesa",
        "carpeta": "imagenes/notas_rol/{campana}",
        "sufijo": "",
        "lado": 1000,
        "cuadrada": False,
    },
    "botin": {
        "que": "un objeto del botín (el cuadradito de la lista)",
        "carpeta": "imagenes/notas_rol/{campana}/botin",
        "sufijo": "",
        "lado": 600,
        "cuadrada": True,
    },
    "mundo": {
        "que": "una imagen de la wiki del mundo",
        "carpeta": "wiki/_imagenes",
        "sufijo": "",
        "lado": 1600,
        "cuadrada": False,
    },
    "evento": {
        "que": "la imagen de un evento de la línea de tiempo",
        "carpeta": "imagenes/wiki/eventos",
        "sufijo": "",
        "lado": 1600,
        "cuadrada": False,
    },
    "blog": {
        "que": "una imagen de una entrada del blog",
        "carpeta": "imagenes/blog/{anyo}",
        "sufijo": "",
        "lado": 1400,
        "cuadrada": False,
    },
    "relatos": {
        "que": "una imagen de un relato",
        "carpeta": "imagenes/mis_movidas/relatos",
        "sufijo": "",
        "lado": 1400,
        "cuadrada": False,
    },
    "recomendaciones": {
        "que": "la portada de una recomendación",
        "carpeta": "imagenes/recomendaciones",
        "sufijo": "",
        "lado": 800,
        "cuadrada": False,
    },
    "santuarios": {
        "que": "una foto de un santuario",
        "carpeta": "imagenes/santuarios/{santuario}",
        "sufijo": "",
        "lado": 1400,
        "cuadrada": False,
    },
    "notas": {
        "que": "una imagen dentro de las notas de una partida",
        "carpeta": "imagenes/notas_rol/{campana}/notas",
        "sufijo": "",
        "lado": 1400,
        "cuadrada": False,
    },
    "rol": {
        "que": "la portada de una aventura de rol",
        "carpeta": "imagenes/mis_movidas/rol",
        "sufijo": "",
        "lado": 1200,
        "cuadrada": False,
    },
    # Mis personajes (mis OC): todo lo de cada uno en su carpeta.
    "oc-token": {
        "que": "el redondel de uno de mis personajes (el índice)",
        "carpeta": "imagenes/personajes/{personaje}",
        "sufijo": "_tkn",
        "lado": 600,
        "cuadrada": True,
    },
    "oc-retrato": {
        "que": "el retrato de uno de mis personajes (el post-it de su ficha)",
        "carpeta": "imagenes/personajes/{personaje}",
        "sufijo": "",
        "lado": 900,
        "cuadrada": False,
    },
    "oc-imagen": {
        "que": "una imagen de uno de mis personajes (su galería o su historia)",
        "carpeta": "imagenes/personajes/{personaje}",
        "sufijo": "",
        "lado": 1600,
        "cuadrada": False,
    },
    "oc-objeto": {
        "que": "un objeto del inventario de uno de mis personajes",
        "carpeta": "imagenes/personajes/{personaje}/objetos",
        "sufijo": "",
        "lado": 600,
        "cuadrada": False,
    },
    "oc-criatura": {
        "que": "una criatura de uno de mis personajes (familiar, invocación, mascota)",
        "carpeta": "imagenes/personajes/{personaje}/criaturas",
        "sufijo": "",
        "lado": 900,
        "cuadrada": False,
    },
    "oc-npc": {
        "que": "alguien de la gente de uno de mis personajes",
        "carpeta": "imagenes/personajes/{personaje}/gente",
        "sufijo": "_tkn",
        "lado": 300,
        "cuadrada": True,
    },
    "otra": {
        "que": "otra cosa (se pregunta la carpeta)",
        "carpeta": "imagenes",
        "sufijo": "",
        "lado": 1600,
        "cuadrada": False,
    },
}

CALIDAD = 82  # el mismo que usa optimizar-imagenes.py

# Lo que sabemos abrir. El .webp también: puede venir ya en webp pero con
# 3000 píxeles de lado, y entonces hay que encogerlo igual.
QUE_SABEMOS_ABRIR = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tif", ".tiff", ".webp"}


def pillow():
    """Pillow, o un aviso que se entienda. Se importa aquí dentro y no
    arriba del todo a propósito: así las herramientas que no tocan
    imágenes siguen funcionando aunque no esté instalada."""
    try:
        from PIL import Image, ImageOps
    except ImportError:
        print("  Falta la librería Pillow, que es la que abre las imágenes.")
        print("  Instálala una sola vez con:  pip install pillow")
        print("  (en Windows, si pip no le suena:  py -m pip install pillow)")
        return None, None
    return Image, ImageOps


# =========================================
# LA RUTA QUE PEGAS
# =========================================
# Lo que sale al copiar un archivo en el explorador de Windows viene con
# comillas; lo que sale al arrastrarlo a una terminal de Linux viene con
# los espacios escapados; y a veces lo que se pega es un file:///. Las
# tres cosas son la misma ruta, así que se limpian aquí y no en cada sitio
# que pregunte por una imagen.

def limpiar_ruta(texto):
    ruta = (texto or "").strip()
    if not ruta:
        return ""
    # Comillas de los dos tipos, por fuera.
    if len(ruta) >= 2 and ruta[0] == ruta[-1] and ruta[0] in "\"'":
        ruta = ruta[1:-1].strip()
    # "& 'C:\...'" de PowerShell, y el prefijo de copiar como ruta.
    ruta = re.sub(r"^&\s*", "", ruta).strip().strip("\"'")
    if ruta.lower().startswith("file:///"):
        from urllib.parse import unquote, urlparse
        ruta = unquote(urlparse(ruta).path)
        # file:///e:/x -> /e:/x ; en Windows sobra la barra de delante.
        if re.match(r"^/[a-zA-Z]:", ruta):
            ruta = ruta[1:]
    # Espacios escapados al arrastrar a una terminal.
    ruta = ruta.replace("\\ ", " ") if "\\ " in ruta and "\\\\" not in ruta else ruta
    return ruta.strip()


def parece_de_fuera(texto):
    """¿Esto es la ruta de un archivo de tu ordenador, o el nombre de uno
    que ya está dentro del sitio? Es lo que distingue "sigil_tkn.webp" de
    "e:\\rpere\\Descargas\\sigil.jpg"."""
    ruta = limpiar_ruta(texto)
    if not ruta:
        return False
    if ruta.startswith("/imagenes") or ruta.startswith("imagenes/"):
        return False
    # Una letra de unidad de Windows, una barra invertida, una ruta
    # absoluta de Unix o un ~ : todo eso es de fuera.
    return bool(re.match(r"^[a-zA-Z]:[\\/]", ruta)) or "\\" in ruta \
        or ruta.startswith("/") or ruta.startswith("~")


def resolver(texto):
    """La ruta, ya limpia, como un Path que exista. None si no está."""
    ruta = limpiar_ruta(texto)
    if not ruta:
        return None
    p = Path(ruta).expanduser()
    return p if p.is_file() else None


# =========================================
# EL NOMBRE QUE LE PONEMOS
# =========================================
# El del archivo original no vale casi nunca: "IMG_20260412_1033 (2).jpg",
# "descarga (3).png". Se le pone el nombre de quien es, sin tildes ni
# espacios, que es como se llaman todas las imágenes del sitio.

def nombre_para(titulo, sufijo="", por_defecto="imagen"):
    base = nombre_archivo(titulo or "", por_defecto)
    return f"{base}{sufijo}.webp"


def sin_pisar(carpeta, nombre):
    """Si ya hay un archivo así, se le pone un número detrás. NUNCA se
    machaca una imagen que ya esté: lo que había puede estar enlazado
    desde una página y nadie se enteraría hasta verla rota."""
    destino = carpeta / nombre
    if not destino.exists():
        return destino
    raiz, ext = destino.stem, destino.suffix
    for n in range(2, 100):
        otro = carpeta / f"{raiz}-{n}{ext}"
        if not otro.exists():
            return otro
    return carpeta / f"{raiz}-{Path(nombre).stem}{ext}"


# =========================================
# TRAERLA
# =========================================

def traer(origen, carpeta_rel, nombre, lado=1600, cuadrada=False, probar=False):
    """Copia la imagen de 'origen' dentro del sitio, convertida y al
    tamaño que toque.

        origen      lo que te pase quien la tenga (ruta de Windows o de
                    Unix, con comillas o sin ellas)
        carpeta_rel carpeta de destino, desde la raíz del sitio
                    ("imagenes/notas_rol/ragna")
        nombre      cómo se va a llamar, con su .webp
        lado        lo que puede medir el lado más largo. Solo se encoge:
                    nunca se agranda una imagen pequeña.
        cuadrada    True para recortar a cuadrado (tokens)

    Devuelve (ruta_para_el_json, aviso) o (None, por_qué_no)."""
    fuente = resolver(origen)
    if fuente is None:
        limpia = limpiar_ruta(origen)
        return None, f"no encuentro el archivo {limpia or origen!r}"

    if fuente.suffix.lower() not in QUE_SABEMOS_ABRIR:
        return None, f"no sé abrir un {fuente.suffix or 'archivo sin extensión'}"

    Image, ImageOps = pillow()
    if Image is None:
        return None, "sin Pillow no se puede convertir"

    carpeta = RAIZ / carpeta_rel
    destino = sin_pisar(carpeta, nombre)
    ruta_json = "/" + destino.relative_to(RAIZ).as_posix()

    if probar:
        return ruta_json, "modo prueba: no se ha escrito nada"

    carpeta.mkdir(parents=True, exist_ok=True)

    aviso = ""
    with Image.open(fuente) as img:
        if getattr(img, "n_frames", 1) > 1 and img.format == "GIF":
            # Un GIF animado aquí sería un token que se mueve. No es lo
            # que se espera de un retrato, pero tampoco hay que decidirlo
            # por nadie: se queda el primer fotograma y se avisa.
            img.seek(0)
            aviso = "era un GIF animado; se ha quedado el primer fotograma"

        plano = ImageOps.exif_transpose(img)
        con_transparencia = plano.mode in ("RGBA", "LA", "P")
        plano = plano.convert("RGBA" if con_transparencia else "RGB")

        if cuadrada:
            corto = min(plano.size)
            cuanto = min(lado, corto)
            if corto < lado:
                aviso = (aviso + "; " if aviso else "") + \
                    f"era de {plano.size[0]}x{plano.size[1]}, así que sale a {cuanto}px"
            # centering (0.5, 0.35): el recorte tira hacia ARRIBA. Un
            # retrato recortado por el centro geométrico se queda con la
            # barbilla y sin la mitad de la cabeza.
            plano = ImageOps.fit(plano, (cuanto, cuanto), Image.LANCZOS,
                                 centering=(0.5, 0.35))
        elif max(plano.size) > lado:
            plano.thumbnail((lado, lado), Image.LANCZOS)

        # Sin exif=: ni GPS, ni modelo de móvil, ni fecha.
        plano.save(destino, "WEBP", quality=CALIDAD, method=6)

    antes = fuente.stat().st_size
    despues = destino.stat().st_size
    cuanto = f"{antes // 1024} KB → {despues // 1024} KB"
    if despues > antes:
        cuanto += " (ha engordado: ya venía bien comprimida)"
    aviso = (aviso + "; " if aviso else "") + cuanto
    return ruta_json, aviso


def copiar_tal_cual(origen, carpeta_rel, nombre, probar=False):
    """Para lo que NO es una imagen: un PDF, por ejemplo. Se copia y ya;
    aquí no hay nada que optimizar."""
    fuente = resolver(origen)
    if fuente is None:
        limpia = limpiar_ruta(origen)
        return None, f"no encuentro el archivo {limpia or origen!r}"

    carpeta = RAIZ / carpeta_rel
    destino = sin_pisar(carpeta, nombre)
    ruta_json = "/" + destino.relative_to(RAIZ).as_posix()
    if probar:
        return ruta_json, "modo prueba: no se ha escrito nada"
    carpeta.mkdir(parents=True, exist_ok=True)
    shutil.copy2(fuente, destino)
    return ruta_json, f"{destino.stat().st_size // 1024} KB"


# =========================================
# LA VERSIÓN PEQUEÑA DE UNA IMAGEN QUE YA ESTÁ DENTRO
# =========================================
# Para lo que se enseña pequeño muchas veces seguidas: los tokens de los
# NPC son de 564 px y en la rejilla se ven a 102-140, así que una página
# de npcs se bajaba casi un mega de retratos para enseñarlos del tamaño de
# un sello. La pequeña se guarda al lado, con un sufijo ("-mini"), y la
# grande se queda para donde se ve grande (la ficha).
#
# Devuelve la ruta pública de la pequeña, o None si no ha podido (no está
# la imagen o no está Pillow). Si ya existe y es más nueva que la grande,
# no la rehace. Nunca la agranda.

def ruta_o_traida(dicho, sitio, nombre, **campos):
    """Lo que contestas cuando una herramienta pregunta por una imagen,
    sea lo que sea:

      · la ruta de tu ordenador (e:\\rpere\\Descargas\\foto.jpg, con
        comillas o sin ellas): se trae al sitio, en su carpeta, pasada a
        WebP y al tamaño que toca (lo de traer(), arriba);
      · una ruta del sitio (/imagenes/blog/2026/foto.webp): tal cual;
      · solo el nombre de una que ya está (foto.webp): en la carpeta de
        ese sitio.

    sitio es una clave de SITIOS ("blog", "relatos"…); campos, lo que pida
    su carpeta ({anyo}, {campana}…); nombre, de quién es (el título), que
    es como se llamará el archivo traído. Devuelve la ruta tal y como se
    escribe en la página ("/imagenes/…"), o "" si no se ha dado ninguna o
    no se ha podido traer. Lo usan nuevo.py y nueva-recomendacion.py; el
    botín, la línea de tiempo y los NPC hacen lo mismo cada uno a su
    manera, de antes de que esto existiera."""
    dicho = (dicho or "").strip()
    if not dicho:
        return ""
    ajustes = SITIOS[sitio]
    carpeta = ajustes["carpeta"].format(**campos)
    if parece_de_fuera(dicho):
        ruta, aviso = traer(dicho, carpeta, nombre_para(nombre, ajustes["sufijo"]),
                            lado=ajustes["lado"], cuadrada=ajustes["cuadrada"])
        if not ruta:
            print(f"     No he podido traerla: {aviso}")
            return ""
        print(f"     Traída a {ruta}  ({aviso})")
        return ruta
    limpia = limpiar_ruta(dicho)
    return limpia if limpia.startswith("/") else f"/{carpeta}/{limpia.lstrip('/')}"


def hacer_pequena(ruta_publica, lado, sufijo="-mini", probar=False):
    origen = RAIZ / ruta_publica.lstrip("/")
    if not origen.is_file():
        return None
    destino = origen.with_name(origen.stem + sufijo + ".webp")
    publica = "/" + destino.relative_to(RAIZ).as_posix()
    if destino.is_file() and destino.stat().st_mtime >= origen.stat().st_mtime:
        return publica
    if probar:
        return publica
    Image, ImageOps = pillow()
    if Image is None:
        return None
    with Image.open(origen) as img:
        plano = ImageOps.exif_transpose(img)
        if plano.mode not in ("RGB", "RGBA"):
            plano = plano.convert("RGBA" if "A" in plano.getbands() else "RGB")
        plano.thumbnail((lado, lado), Image.LANCZOS)
        plano.save(destino, "WEBP", quality=CALIDAD, method=6)
    return publica
