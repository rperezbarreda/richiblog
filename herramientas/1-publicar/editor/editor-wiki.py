#!/usr/bin/env python3
# =========================================
# EL EDITOR DE LA WEB (en el navegador)
# =========================================
# Empezó siendo el de la wiki de Cralëa (de ahí el nombre del archivo),
# pero la wiki se fue a su propio repo (github.com/rperezbarreda/
# wiki_cralea; aquí llega con traer-wiki.py) y esto lleva EL RESTO DE LA
# WEB, cada cosa en su apartado del menú de arriba:
#
#   · ESCRIBIR: las entradas del blog, los relatos, los días del reto y
#     las notas de las partidas. Hacer una nueva (nace como borrador) o
#     seguir con una que ya hay, y escribirla COMO EN UN WORD: negrita,
#     títulos, listas, enlaces, imágenes, tablas… sin ver el HTML (aunque
#     se puede). Las notas de partida, hoja a hoja y escena a escena, con
#     un botón para los personajes de la mesa (de su color). Guardar,
#     Publicar o Volver a borrador, y Ver cómo queda.
#   · ROL Y MI RINCÓN: las fichas de lo que va en un JSON (las campañas y
#     los recursos de rol, los NPC, el botín, las recomendaciones, «en lo
#     que ando», el reto y las fotos de los gatos): una lista para elegir,
#     añadir, cambiar, ordenar o quitar. Y traer a la web lo de otros repos
#     (la pantalla de máster y la wiki de Cralëa).
#   · LOS MAPAS DE LAS CAMPAÑAS (los .cmap de mapas-rol/): poner sitios,
#     pintar regiones y rayas (caminos, ríos, fronteras, rutas de viaje de
#     cada sesión…), escribir textos en el mapa, moverlos o borrarlos (con
#     imán, y con deshacer), medir distancias, hacer un mapa nuevo a
#     partir de una imagen y ampliar su imagen (con IA si está).
#   · IMÁGENES Y REPASAR: traer una imagen suelta, repasar el sitio
#     entero y volver a generar.
#   · COMANDOS: lo de menu.py, cada cosa con un botón que la abre en su
#     propia ventana de comandos (menu.abrir_en_ventana), y la guía de
#     comandos para guardar en GitHub (editor_web.git_estado).
#
# Lo de escribir y las fichas lo hace editor_web.py (aquí al lado), con
# las mismas herramientas de siempre por debajo (nuevo.py, publicar.py…),
# así que el resultado es igual que con ellas. Aquí, los mapas y el
# servidor.
#
#     python herramientas/1-publicar/editor/editor-wiki.py [--en escribir]
#
# o, igual, python herramientas/menu.py, que abre esto (el menú de texto
# de antes, con menu.py --texto). --en escribir|campanas|rol|rincon|
# repasar|comandos lo abre ya en ese apartado. Se abre solo en el
# navegador; si no, la dirección sale aquí escrita. Para cerrarlo, Ctrl+C
# aquí o cerrar esta ventana.
#
# SOLO PARA TI: escucha en 127.0.0.1 (este ordenador y nadie más), y cada
# vez que se abre inventa una contraseña que va en la dirección; sin ella
# no se puede guardar nada. No hace falta nada instalado aparte de Python
# (y Pillow para subir imágenes, que ya lo usa el resto de herramientas).
#
# Los archivos de la página del editor están en
# herramientas/1-publicar/editor/editor-wiki/: editor.html, editor.css,
# editor.js (lo común), mapas.js (el editor de mapas), redactor.js (el
# «Word»), escribir.js (las entradas) y fichas.js (las fichas y lo de
# imágenes y repasar).

import base64
import json
import os
import re
import secrets
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERRAMIENTAS = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(HERRAMIENTAS / "0-comun"))

from comun import RAIZ, escribir_como_estaba, escribir_texto, sin_tildes  # noqa: E402

# Lo del resto de la web (el blog, los relatos, el rol, las fichas de
# datos/…): está en editor_web.py, junto a esto; aquí solo se le pasan las
# peticiones de /api/web/….
sys.path.insert(0, str(Path(__file__).resolve().parent))
import editor_web  # noqa: E402

CARPETA_EDITOR = Path(__file__).resolve().parent / "editor-wiki"
TOKEN = secrets.token_urlsafe(18)
# Lo que no puede llevar el nombre de un archivo (en Windows).
PROHIBIDO = '<>:"/\\|?*'


# =========================================
# LAS IMÁGENES QUE LLEGAN
# =========================================

def archivo_temporal(crudo, sufijo):
    """La imagen subida, en un archivo temporal para traer() (que trabaja
    con rutas). mkstemp lo deja ABIERTO: hay que cerrarlo, que en Windows
    un archivo abierto no se puede ni leer desde otro sitio ni borrar
    («[WinError 32] … está siendo utilizado por otro proceso»)."""
    descriptor, ruta = tempfile.mkstemp(suffix=sufijo)
    with os.fdopen(descriptor, "wb") as archivo:
        archivo.write(crudo)
    return Path(ruta)


def borrar_temporal(temporal):
    """Lo borra si puede. Si Windows aún lo tiene agarrado (un antivirus
    mirándolo, por ejemplo), se queda en la carpeta temporal, que ya se
    vacía sola: no es motivo para que falle la subida."""
    if temporal:
        try:
            temporal.unlink()
        except OSError:
            pass


# =========================================
# LOS MAPAS
# =========================================
# Los .cmap de las campañas (el formato está explicado en
# herramientas/0-comun/mundo_mapas.py): el mapamundi de Ragna, los de sus
# zonas… Van en mapas-rol/<campaña>/, con sus imágenes en
# mapas-rol/<campaña>/imagenes/ (la carpeta no se sube: lo que se publica
# lo escribe generar-mapas-rol.py). En el editor salen como
# «@campañas/<campaña>/<Título>.cmap». El editor los lee enteros y los
# devuelve enteros: lo que no conoce va y vuelve sin tocar. Aquí solo se
# comprueba que lo que llega es un mapa y que se escribe dentro de
# mapas-rol/.

MAPAS_ROL = RAIZ / "mapas-rol"
PREFIJO_ROL = "@campañas/"


def relativo_de_mapa(archivo):
    """Cómo se llama un .cmap en el editor: «@campañas/<campaña>/<archivo>»."""
    return PREFIJO_ROL + archivo.relative_to(MAPAS_ROL).as_posix()


def carpeta_de_imagenes(archivo):
    """Dónde van las imágenes de un mapa (relativo a la raíz): las de su campaña."""
    return "mapas-rol/%s/imagenes" % archivo.parent.name

def sesiones_de_campana(clave):
    """Las sesiones de una campaña, [{numero, titulo}]: para decir de cuál
    es cada ruta de viaje en sus mapas."""
    try:
        datos = json.loads((RAIZ / "datos" / "notas_rol" / ("campana-%s.json" % clave)).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    salida = []
    for s in datos.get("sesiones") or []:
        try:
            salida.append({"numero": int(s.get("numero")), "titulo": str(s.get("titulo") or "")})
        except (TypeError, ValueError, AttributeError):
            continue
    return salida


def campanas_que_hay():
    """Las campañas (datos/notas_rol/campana-<clave>.json): [{clave, nombre}]."""
    salida = []
    for archivo in sorted((RAIZ / "datos" / "notas_rol").glob("campana-*.json")):
        try:
            datos = json.loads(archivo.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        clave = archivo.stem[len("campana-"):]
        salida.append({"clave": clave, "nombre": str(datos.get("nombre") or clave)})
    return salida
# Las imágenes de mapa, a su tamaño (o hasta este lado): un mapa encogido
# a 1600 se queda sin detalle al acercarse.
LADO_MAPA = 4096


def _leer_cmap(archivo):
    try:
        datos = json.loads(archivo.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return datos if isinstance(datos, dict) else None


def mapas_que_hay():
    salida = []
    de_rol = sorted(MAPAS_ROL.glob("*/*.cmap"), key=lambda a: a.stem.lower()) if MAPAS_ROL.is_dir() else []
    for archivo in de_rol:
        datos = _leer_cmap(archivo)
        if datos is None:
            continue
        salida.append({"archivo": relativo_de_mapa(archivo),
                       "titulo": str(datos.get("title") or archivo.stem),
                       "pines": len(datos.get("pins") or []),
                       "regiones": len(datos.get("shapes") or []),
                       "rayas": len(datos.get("lines") or [])})
    return salida


def ruta_de_mapa(relativo):
    """El .cmap que se pide, si es un .cmap de dentro de mapas-rol/."""
    relativo = str(relativo or "").replace("\\", "/").strip("/")
    if not relativo.lower().endswith(".cmap") or not relativo.startswith(PREFIJO_ROL):
        return None
    archivo = (MAPAS_ROL / relativo[len(PREFIJO_ROL):]).resolve()
    try:
        archivo.relative_to(MAPAS_ROL.resolve())
    except ValueError:
        return None
    return archivo if archivo.is_file() else None


def url_de_imagen(nombre):
    """Dónde la sirve el editor: se busca por el nombre en mapas-rol/."""
    nombre = str(nombre or "").replace("\\", "/").split("/")[-1].lower()
    if not nombre or not MAPAS_ROL.is_dir():
        return ""
    for archivo in sorted(MAPAS_ROL.rglob("*")):
        if archivo.name.lower() == nombre and archivo.is_file():
            return "/" + urllib.parse.quote(archivo.relative_to(RAIZ).as_posix())
    return ""


def leer_mapa(archivo):
    datos = _leer_cmap(archivo)
    if datos is None:
        return {"error": "Ese mapa no se puede leer: no es un JSON que entienda."}
    capas = [c for c in datos.get("layers") or [] if isinstance(c, dict)]
    imagenes = {str(c.get("image")): url_de_imagen(c.get("image")) for c in capas if c.get("image")}
    # Y las de los emblemas (banderas, blasones): las de los sitios que se
    # ven como emblema y las de los emblemas sueltos de antes.
    for em in (datos.get("emblems") or []) + (datos.get("pins") or []):
        if isinstance(em, dict) and em.get("image"):
            imagenes[str(em["image"])] = url_de_imagen(em["image"])
    # Su página es la que escribe generar-mapas-rol.py.
    clave = archivo.parent.name
    return {"archivo": relativo_de_mapa(archivo), "datos": datos, "imagenes": imagenes,
            "url": "/web/notas_rol/%s/mapa_%s.html" % (clave, slug_de_mapa_rol(datos, archivo)),
            "campana": clave, "sesiones": sesiones_de_campana(clave)}


def slug_de_mapa_rol(datos, archivo):
    """El final de la dirección del mapa de una campaña (mapa_<esto>.html):
    su título, sin tildes ni espacios. Lo mismo que generar-mapas-rol.py."""
    texto = sin_tildes(str((datos or {}).get("title") or archivo.stem)).lower()
    return re.sub(r"[^a-z0-9]+", "_", texto).strip("_") or "mapa"


def _lista_de_puntos(puntos):
    return isinstance(puntos, list) and all(
        isinstance(p, dict) and isinstance(p.get("x"), (int, float)) and isinstance(p.get("y"), (int, float))
        for p in puntos)


def guardar_mapa(archivo, datos):
    """Comprueba que es un mapa (medidas, y listas de cosas con
    coordenadas) y lo escribe."""
    if not isinstance(datos, dict):
        return {"error": "Lo que ha llegado no es un mapa."}
    for medida in ("width", "height"):
        if not isinstance(datos.get(medida), (int, float)) or datos[medida] <= 0:
            return {"error": "El mapa no dice cuánto mide."}
    for lista in ("pins", "shapes", "lines", "layers"):
        if not isinstance(datos.get(lista, []), list):
            return {"error": "El mapa ha llegado roto (%s)." % lista}
    for pin in datos.get("pins") or []:
        if not (isinstance(pin, dict) and isinstance(pin.get("x"), (int, float))
                and isinstance(pin.get("y"), (int, float))):
            return {"error": "Hay un sitio sin coordenadas."}
    for cosa in (datos.get("shapes") or []) + (datos.get("lines") or []):
        if not (isinstance(cosa, dict) and _lista_de_puntos(cosa.get("points"))):
            return {"error": "Hay una región o una raya con puntos raros."}
    # Escrito como lo escribe Chronicler (sangrado de dos, sin \u00 en las
    # tildes), con sus saltos de línea de Windows si los tenía y el salto
    # del final solo si lo tenía: que el archivo cambie por lo cambiado y
    # nada más.
    final = "\n" if archivo.read_bytes().endswith(b"\n") else ""
    escribir_como_estaba(archivo, json.dumps(datos, ensure_ascii=False, indent=2) + final)
    return {"ok": True, "mapa": leer_mapa(archivo)}


def traer_emblema(peticion):
    """La imagen de un emblema (una bandera, un blasón) a las imágenes de
    la campaña del mapa, a 512 px como mucho. {nombre, url}."""
    try:
        import imagenes as img
    except ImportError:
        return {"error": "No encuentro herramientas/0-comun/imagenes.py."}
    mapa = ruta_de_mapa(peticion.get("mapa"))
    if not mapa:
        return {"error": "Ese mapa ya no está."}
    nombre = str(peticion.get("nombre") or "").strip() or "emblema"
    ruta, temporal, error = _imagen_que_llega(peticion, "emblema.png", 20)
    if error:
        return {"error": error}
    try:
        hecha, aviso = img.traer(ruta, carpeta_de_imagenes(mapa), img.nombre_para(nombre, "_emblema"), lado=512)
    finally:
        borrar_temporal(temporal)
    if not hecha:
        return {"error": "No he podido traerla: " + aviso}
    return {"ok": True, "nombre": Path(hecha).name, "url": url_de_imagen(Path(hecha).name), "aviso": aviso}


def _imagen_que_llega(peticion, por_defecto="mapa.png", megas=40):
    """La imagen que manda el editor: subida (datos en base64) o por su
    ruta. Devuelve (ruta, temporal, error); el temporal hay que borrarlo
    (borrar_temporal) al acabar."""
    ruta = str(peticion.get("ruta") or "").strip()
    if ruta:
        return ruta, None, ""
    datos = str(peticion.get("datos") or "")
    if not datos:
        return "", None, "Falta la imagen."
    original = str(peticion.get("archivo") or por_defecto)
    if "," in datos:
        datos = datos.split(",", 1)[1]
    try:
        crudo = base64.b64decode(datos, validate=True)
    except ValueError:
        return "", None, "La imagen no ha llegado bien."
    if len(crudo) > megas * 1024 * 1024:
        return "", None, "Es demasiado grande (más de %d MB)." % megas
    temporal = archivo_temporal(crudo, Path(original).suffix.lower() or ".png")
    return str(temporal), temporal, ""


def _medidas(archivo):
    from PIL import Image
    with Image.open(archivo) as abierta:
        return abierta.size


def _hecha(archivo, aviso="", **mas):
    try:
        ancho, alto = _medidas(archivo)
    except Exception as error:  # Pillow ya la ha abierto para convertirla: no debería pasar
        return {"error": "No sé cuánto mide la imagen: %s" % error}
    return dict({"ok": True, "nombre": archivo.name, "ancho": ancho, "alto": alto,
                 "url": url_de_imagen(archivo.name), "aviso": aviso}, **mas)


def traer_imagen_de_mapa(peticion, nombre, carpeta):
    """La imagen que llega (subida o por su ruta) a «carpeta» (la de las
    imágenes de una campaña). Devuelve {nombre, ancho, alto, url} o {error}."""
    try:
        import imagenes as img
    except ImportError:
        return {"error": "No encuentro herramientas/0-comun/imagenes.py."}
    ruta, temporal, error = _imagen_que_llega(peticion)
    if error:
        return {"error": error}
    try:
        hecha, aviso = img.traer(ruta, carpeta, img.nombre_para(nombre, "_mapa"), lado=LADO_MAPA)
    finally:
        borrar_temporal(temporal)
    if not hecha:
        return {"error": "No he podido traerla: " + aviso}
    return _hecha(RAIZ / carpeta / Path(hecha).name, aviso)


# ---- AMPLIAR LA IMAGEN (herramientas/0-comun/mapas_mundo.py) ----
# La imagen de fondo de un mapa, más grande (con IA si está el ampliador):
# para que no se vea borrosa al acercarse.

def _mapas_mundo():
    import mapas_mundo
    return mapas_mundo


def _imagen_del_mapa(archivo, nombre=""):
    """La imagen de fondo (la primera capa) de un .cmap: (Path, datos).
    Con nombre, esa (la que tiene ahora el editor, aunque no esté
    guardado)."""
    datos = _leer_cmap(archivo)
    if not datos:
        return None, None
    capas = sorted([c for c in datos.get("layers") or [] if isinstance(c, dict) and c.get("image")],
                   key=lambda c: float(c.get("zIndex") or 0))
    if not capas and not nombre:
        return None, datos
    nombre = str(nombre or capas[0]["image"]).replace("\\", "/").split("/")[-1].lower()
    for imagen in sorted(MAPAS_ROL.rglob("*")):
        if imagen.name.lower() == nombre and imagen.is_file():
            return imagen, datos
    return None, datos


def ayudas_de_mapas():
    mm = _mapas_mundo()
    return {"ampliador": bool(mm.ampliador()), "lado_maximo": mm.LADO_MAXIMO}


def ampliar_mapa(archivo, peticion):
    """La imagen de fondo del mapa, a ancho × alto, en una imagen nueva
    (la de antes se queda: puede estar en uso hasta que se guarde)."""
    try:
        import imagenes as img
    except ImportError:
        return {"error": "No encuentro herramientas/0-comun/imagenes.py."}
    mm = _mapas_mundo()
    imagen, _ = _imagen_del_mapa(archivo, peticion.get("imagen"))
    if not imagen:
        return {"error": "Este mapa no tiene imagen de fondo."}
    try:
        if peticion.get("factor"):
            # Por cuánto multiplicar la imagen de verdad (el mapamundi: sus
            # coordenadas no son píxeles de su imagen y no cambian).
            factor = float(peticion["factor"])
            ancho_ahora, alto_ahora = _medidas(imagen)
            ancho, alto = round(ancho_ahora * factor), round(alto_ahora * factor)
        else:
            ancho, alto = int(peticion.get("ancho")), int(peticion.get("alto"))
    except (TypeError, ValueError):
        return {"error": "No sé a qué medida ponerla."}
    if not (1 <= ancho <= mm.LADO_MAXIMO and 1 <= alto <= mm.LADO_MAXIMO):
        return {"error": "Saldría de %d × %d, y como mucho son %d píxeles de lado. Prueba con menos."
                         % (ancho, alto, mm.LADO_MAXIMO)}
    destino = img.sin_pisar(RAIZ / carpeta_de_imagenes(archivo), img.nombre_para(archivo.stem, "_mapa"))
    con_ia, aviso = mm.a_medida(imagen, destino, ancho, alto, ia=peticion.get("ia") is not False,
                                modelo=str(peticion.get("modelo") or "pintado"))
    return _hecha(destino, aviso, con_ia=con_ia)


def nuevo_mapa(peticion):
    """El mapa de una campaña: en mapas-rol/<campaña>/, con su imagen en
    mapas-rol/<campaña>/imagenes/. Un .cmap con la imagen de fondo y nada
    encima."""
    clave = str(peticion.get("campana") or "").strip()
    campana = next((c for c in campanas_que_hay() if c["clave"] == clave), None)
    if not campana:
        return {"error": "No hay ninguna campaña «%s»." % clave if clave else "Falta de qué campaña es el mapa."}
    titulo = str(peticion.get("titulo") or "").strip() or "Mapamundi de " + re.sub(
        r"^campaña de\s+", "", campana["nombre"], flags=re.I).strip()
    malos = [c for c in titulo if c in PROHIBIDO]
    if malos:
        return {"error": "El título no puede llevar %s: es también el nombre del archivo." % " ".join(malos)}
    destino = MAPAS_ROL / clave / (titulo + ".cmap")
    if destino.exists():
        return {"error": "Ya hay un mapa así: %s. Ábrelo desde la lista de mapas." % relativo_de_mapa(destino)}
    imagen = traer_imagen_de_mapa(peticion, titulo, "mapas-rol/%s/imagenes" % clave)
    if imagen.get("error"):
        return imagen
    datos = {"version": "1.0", "title": titulo, "campaign": clave,
             "width": imagen["ancho"], "height": imagen["alto"],
             "layers": [{"id": "base", "name": "Mapa", "image": imagen["nombre"], "opacity": 1,
                         "zIndex": 0, "visible": True}],
             "pins": [], "shapes": [], "lines": []}
    destino.parent.mkdir(parents=True, exist_ok=True)
    escribir_texto(destino, json.dumps(datos, ensure_ascii=False, indent=2) + "\n")
    return {"ok": True, "mapa": leer_mapa(destino), "aviso": imagen.get("aviso", "")}


# =========================================
# PASAR A LA WEB
# =========================================

PASAR_LOCK = threading.Lock()
SCRIPTS_DE_PASAR = ("3-generadores/generar-mapas-rol.py", "3-generadores/actualizar-cabeceras.py")
# Lo que se apuntó la última vez (cuántas líneas escribió cada script y
# cuánto tardó), para que la barra de progreso sepa cuánto le queda.
ULTIMA_PASADA = Path(tempfile.gettempdir()) / "editor-wiki-ultima-pasada.json"
# Cómo va lo que se está pasando ahora; lo lee /api/pasar/estado.
PASADA = {"activa": False, "fase": "", "porcentaje": 0, "terminado": True, "resultado": None, "registro": []}


def _ultima_pasada():
    try:
        datos = json.loads(ULTIMA_PASADA.read_text(encoding="utf-8"))
        return datos if isinstance(datos, dict) else {}
    except (OSError, ValueError):
        return {}


def pasar_a_la_web(al_avanzar=None):
    """Pasa los mapas de las campañas a la web (generar-mapas-rol.py y
    actualizar-cabeceras.py)
    leyendo lo que escriben según lo escriben. al_avanzar(fase,
    porcentaje): cuánto va. Se cuenta por el TIEMPO que lleva cada script
    comparado con lo que tardó la última vez (y por las líneas que lleva
    escritas, si van más deprisa): solo con las líneas la barra iba a
    saltos, porque los scripts escriben casi todo al final. La primera
    vez, a ojo. Nunca pasa de 99 hasta que termina de verdad."""
    if not PASAR_LOCK.acquire(blocking=False):
        return {"error": "Ya se está pasando a la web; espera a que termine."}
    try:
        antes = _ultima_pasada()
        lineas_antes = {s: int(antes.get(s, {}).get("lineas") or 0) for s in SCRIPTS_DE_PASAR}
        tiempos = {s: float(antes.get(s, {}).get("segundos") or 0) for s in SCRIPTS_DE_PASAR}
        total_tiempo = sum(tiempos.values())
        # Cuánto de la barra le toca a cada script: lo que tardó la última
        # vez (la primera, más o menos lo de siempre: el primero tarda más).
        pesos = ([tiempos[s] / total_tiempo for s in SCRIPTS_DE_PASAR] if total_tiempo > 0 and all(tiempos.values())
                 else [0.3, 0.7])
        nombres = {"generar-mapas-rol.py": "Pintando los mapas de las campañas",
                   "actualizar-cabeceras.py": "Poniendo las cabeceras y los menús"}
        salida, apuntado, hecho_antes = [], {}, 0.0
        entorno = dict(os.environ, PYTHONUNBUFFERED="1", PYTHONIOENCODING="utf-8")
        for n, script in enumerate(SCRIPTS_DE_PASAR):
            nombre = script.split("/")[-1]
            fase = nombres.get(nombre, nombre)
            esperadas = lineas_antes[script] or (400 if n == 0 else 250)
            segundos = tiempos[script] or (30.0 if n == 0 else 10.0)
            if al_avanzar:
                al_avanzar(fase, round(hecho_antes * 100))
            editor_web.apuntar(PASADA["registro"], "▶ %s  (%s)" % (fase, nombre))
            empieza = time.monotonic()
            proceso = subprocess.Popen([sys.executable, str(HERRAMIENTAS / script)], cwd=RAIZ,
                                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                                       encoding="utf-8", errors="replace", env=entorno)
            reloj = threading.Timer(900, proceso.kill)
            reloj.start()
            lineas = []

            def contar(n=n, fase=fase, empieza=empieza, base=hecho_antes):
                # Cada cuarto de segundo, mientras el script siga.
                while proceso.poll() is None:
                    parte = min(0.97, max((time.monotonic() - empieza) / segundos, len(lineas) / esperadas))
                    if al_avanzar:
                        al_avanzar(fase, min(99, round((base + pesos[n] * parte) * 100)))
                    time.sleep(0.25)

            contador = threading.Thread(target=contar, daemon=True)
            contador.start()
            try:
                for linea in proceso.stdout:
                    lineas.append(linea.rstrip("\n"))
                    editor_web.apuntar(PASADA["registro"], "  " + linea.rstrip("\n"))
                proceso.wait()
            finally:
                reloj.cancel()
                contador.join(timeout=1)
            apuntado[script] = {"lineas": len(lineas), "segundos": round(time.monotonic() - empieza, 1)}
            editor_web.apuntar(PASADA["registro"], ("✗ %s ha fallado" if proceso.returncode else "✓ %s, hecho") % fase
                               + " (%s s)" % apuntado[script]["segundos"])
            hecho_antes += pesos[n]
            utiles = [l for l in lineas if l.strip()]
            salida.append(nombre + ":\n" + "\n".join(utiles[-12:]))
            if proceso.returncode:
                return {"error": "Algo ha fallado al pasarlo a la web.", "salida": "\n\n".join(salida)}
        try:
            ULTIMA_PASADA.write_text(json.dumps(apuntado), encoding="utf-8")
        except OSError:
            pass
        return {"ok": True, "salida": "\n\n".join(salida)}
    finally:
        PASAR_LOCK.release()


def empezar_a_pasar(peticion):
    """Pasa el mapa en otro hilo y vuelve enseguida: el editor va
    preguntando a /api/pasar/estado cómo va (para la barra de progreso)."""
    if PASADA["activa"]:
        return {"empezado": True, "ya": True}
    mapa = ruta_de_mapa(peticion.get("mapa"))
    PASADA.update({"activa": True, "fase": "Empezando", "porcentaje": 0, "terminado": False, "resultado": None,
                   "registro": []})

    def avanzar(fase, porcentaje):
        PASADA["fase"], PASADA["porcentaje"] = fase, porcentaje

    def trabajar():
        try:
            hecho = pasar_a_la_web(avanzar)
            if mapa and hecho.get("ok"):
                hecho["url"] = leer_mapa(mapa).get("url", "")
        except Exception as error:  # que el editor lo cuente y no se quede esperando
            hecho = {"error": "Algo ha fallado: %s" % error}
        PASADA.update({"activa": False, "terminado": True, "porcentaje": 100, "resultado": hecho})

    threading.Thread(target=trabajar, daemon=True).start()
    return {"empezado": True}


# =========================================
# EL SERVIDOR
# =========================================

class Editor(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Lo de fuera de /editor/ es el sitio tal cual: así «ver cómo
        # queda» abre la página de verdad, con sus estilos.
        super().__init__(*args, directory=str(RAIZ), **kwargs)

    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, datos, estado=200):
        cuerpo = json.dumps(datos, ensure_ascii=False).encode("utf-8")
        self.send_response(estado)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def _permitido(self):
        # La contraseña, y que se le hable como 127.0.0.1 o localhost: una
        # web de fuera que se haga pasar por este ordenador (lo que se
        # llama «DNS rebinding») llegaría con otro nombre.
        anfitrion = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]").lower()
        return (anfitrion in ("127.0.0.1", "localhost")
                and secrets.compare_digest(self.headers.get("X-Editor", ""), TOKEN))

    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)
        if url.path in ("/", "/editor", "/editor/"):
            return self._archivo(CARPETA_EDITOR / "editor.html", "text/html; charset=utf-8")
        if url.path.startswith("/editor/"):
            nombre = url.path[len("/editor/"):]
            tipos = {"editor.css": "text/css; charset=utf-8", "editor.js": "text/javascript; charset=utf-8",
                     "mapas.js": "text/javascript; charset=utf-8", "escribir.js": "text/javascript; charset=utf-8",
                     "redactor.js": "text/javascript; charset=utf-8", "fichas.js": "text/javascript; charset=utf-8"}
            if nombre in tipos:
                return self._archivo(CARPETA_EDITOR / nombre, tipos[nombre])
            return self._json({"error": "no existe"}, 404)
        if url.path.startswith("/api/"):
            if not self._permitido():
                return self._json({"error": "Falta la contraseña del editor: recarga la página (o vuelve a"
                                   " abrir la dirección que sale al arrancarlo)."}, 403)
            pregunta = urllib.parse.parse_qs(url.query)
            if url.path.startswith("/api/web/"):
                try:
                    contestado = editor_web.atender_get(url.path, pregunta)
                except Exception as error:  # que el editor diga qué ha pasado
                    return self._json({"error": "Algo ha fallado: %s" % error}, 500)
                return self._json(contestado if contestado is not None else {"error": "no existe"},
                                  200 if contestado is not None else 404)
            if url.path == "/api/pasar/estado":
                return self._json(editor_web.estado_con_registro(PASADA, (pregunta.get("desde") or [""])[0]))
            if url.path == "/api/imagen-url":
                nombre = (pregunta.get("nombre") or [""])[0]
                return self._json({"url": url_de_imagen(nombre)})
            if url.path == "/api/mapas":
                return self._json({"mapas": mapas_que_hay(), "campanas": campanas_que_hay()})
            if url.path == "/api/mapa/ayudas":
                return self._json(ayudas_de_mapas())
            if url.path == "/api/mapa":
                archivo = ruta_de_mapa((pregunta.get("archivo") or [""])[0])
                if not archivo:
                    return self._json({"error": "Ese mapa no está."}, 404)
                return self._json(leer_mapa(archivo))
            return self._json({"error": "no existe"}, 404)
        # La vista previa de uno de mis personajes (editor_web.PREVIAS): la
        # página entera, que pide sus estilos y sus fotos al sitio de aquí.
        # Sin contraseña (se abre en otra pestaña, sin la cabecera), pero
        # solo hablándole como 127.0.0.1 o localhost.
        previa = re.fullmatch(r"/previa/personajes/([a-z0-9-]+)\.html", url.path)
        if previa:
            anfitrion = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]").lower()
            pagina = editor_web.PREVIAS.get(previa.group(1)) if anfitrion in ("127.0.0.1", "localhost") else None
            if not pagina:
                return self._json({"error": "No hay vista previa de ese personaje: vuelve a pulsar «Ver cómo queda»."},
                                  404)
            cuerpo = pagina.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(cuerpo)))
            self.end_headers()
            self.wfile.write(cuerpo)
            return None
        # El sitio: sin las herramientas ni lo escondido.
        if url.path.startswith(("/herramientas", "/.git")):
            return self._json({"error": "no existe"}, 404)
        return super().do_GET()

    def do_POST(self):
        url = urllib.parse.urlsplit(self.path)
        if not self._permitido():
            return self._json({"error": "Falta la contraseña del editor."}, 403)
        largo = int(self.headers.get("Content-Length") or 0)
        if largo > 60 * 1024 * 1024:
            return self._json({"error": "Demasiado grande."}, 413)
        try:
            peticion = json.loads(self.rfile.read(largo).decode("utf-8") or "{}")
        except ValueError:
            return self._json({"error": "No entiendo lo que ha llegado."}, 400)
        try:
            if url.path.startswith("/api/web/"):
                contestado = editor_web.atender_post(url.path, peticion)
                if contestado is not None:
                    return self._json(contestado)
            if url.path == "/api/mapa/emblema":
                return self._json(traer_emblema(peticion))
            if url.path == "/api/mapa/nuevo":
                return self._json(nuevo_mapa(peticion))
            if url.path == "/api/mapa/ampliar":
                archivo = ruta_de_mapa(peticion.get("mapa"))
                if not archivo:
                    return self._json({"error": "Ese mapa ya no está."})
                return self._json(ampliar_mapa(archivo, peticion))
            if url.path in ("/api/mapa/guardar", "/api/mapa/imagen"):
                # (En la de la imagen, «archivo» es cómo se llamaba la
                # imagen subida; el mapa va en «mapa».)
                archivo = ruta_de_mapa(peticion.get("mapa" if url.path == "/api/mapa/imagen" else "archivo"))
                if not archivo:
                    return self._json({"error": "Ese mapa ya no está."})
                if url.path == "/api/mapa/imagen":
                    return self._json(traer_imagen_de_mapa(peticion, archivo.stem, carpeta_de_imagenes(archivo)))
                return self._json(guardar_mapa(archivo, peticion.get("datos")))
            if url.path == "/api/pasar":
                return self._json(empezar_a_pasar(peticion))
        except Exception as error:  # que el editor diga qué ha pasado, y no se quede colgado
            return self._json({"error": "Algo ha fallado: %s" % error}, 500)
        return self._json({"error": "no existe"}, 404)

    def _archivo(self, ruta, tipo):
        cuerpo = ruta.read_bytes()
        if ruta.name == "editor.html":
            cuerpo = cuerpo.replace(b"{{TOKEN}}", TOKEN.encode("ascii"))
        self.send_response(200)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)


def puerto_libre(desde=8765):
    for puerto in range(desde, desde + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            # Fuera de Windows, el puerto de un editor recién cerrado se
            # puede volver a usar enseguida (si no, se queda unos segundos
            # «ocupado» y abría en otro, y lo que recuerda el navegador
            # —el tamaño de la letra, las carpetas abiertas— es de cada
            # dirección, así que se perdía). En Windows esa opción
            # deja pisar un puerto que otro tiene abierto: allí, no.
            if not sys.platform.startswith("win"):
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("127.0.0.1", puerto))
                return puerto
            except OSError:
                continue
    return 0


def main():
    puerto = puerto_libre()
    servidor = ThreadingHTTPServer(("127.0.0.1", puerto), Editor)
    direccion = "http://127.0.0.1:%d/editor/" % servidor.server_address[1]
    # --en escribir|campanas|rol|rincon|repasar|neocities|github|comandos: abre ya en ese apartado.
    if "--en" in sys.argv[:-1]:
        direccion += "#" + sys.argv[sys.argv.index("--en") + 1]
    print("\n  ==================================")
    print("  EL EDITOR DE LA WEB")
    print("  ==================================")
    print("\n  Abierto en el navegador. Si no se ha abierto solo, copia esto en él:")
    print("\n     " + direccion)
    print("\n  Para cerrarlo: Ctrl+C aquí (o cierra esta ventana).")
    if "--sin-navegador" not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(direccion)).start()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\n  Cerrado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
