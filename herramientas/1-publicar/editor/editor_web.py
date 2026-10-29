#!/usr/bin/env python3
# =========================================
# EL EDITOR DE LA WEB — todo lo que no es la wiki
# =========================================
# Lo que le añade a editor-wiki.py (que es quien lo sirve: esto no se
# ejecuta suelto) para llevar EL RESTO DE LA WEB desde el navegador, con
# ventanas en vez de preguntas:
#
#   · ESCRIBIR: las entradas del blog, los relatos, los días del reto y las
#     notas de las partidas. Hacer una nueva (con lo mismo que pregunta
#     nuevo.py), abrir cualquiera —borrador o publicada— y escribir su
#     texto como en un procesador de textos (negrita, títulos, listas,
#     citas, enlaces, imágenes, tablas…), cambiar su título, su resumen,
#     sus etiquetas y su imagen, y publicarla o volver a dejarla en
#     borrador (lo mismo que publicar.py).
#   · LAS FICHAS: lo que vive en un JSON de datos/ y llevan las demás
#     herramientas de 1-publicar: los recursos de rol, los NPC y el botín
#     de cada campaña, las recomendaciones, «en lo que ando», el
#     calendario, la línea de tiempo, el diccionario, las palabras del reto
#     y las fotos de los gatos. Cada una es una lista de fichas con sus
#     casillas (COLECCIONES, abajo).
#   · LAS IMÁGENES (traerlas de tu ordenador, como traer-imagen.py) y
#     REPASAR EL SITIO (las cinco comprobaciones) o volver a generarlo.
#
# NO HACE NADA DISTINTO de las herramientas de siempre: usa sus mismas
# funciones (las de nuevo.py, publicar.py, imagenes.py, calendario.py,
# linea-de-tiempo.py…) y, al terminar, pasa los mismos generadores que
# pasarían ellas. Lo que se guarda queda igual que si se hubiera hecho a
# mano o con ellas.
#
# LO QUE TARDA (crear, publicar, pasar los generadores) va en otro hilo, y
# el editor pregunta a /api/web/tarea cómo va para enseñar la barra de
# progreso, como al pasar la wiki.

import base64
import datetime as dt
import html
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import unicodedata
import threading
import time
from html.parser import HTMLParser
from pathlib import Path

HERRAMIENTAS = Path(__file__).resolve().parents[2]
PUBLICAR = HERRAMIENTAS / "1-publicar"
EDITOR = Path(__file__).resolve().parent
sys.path.insert(0, str(HERRAMIENTAS / "0-comun"))
sys.path.insert(0, str(HERRAMIENTAS / "3-generadores"))

from comun import (GENERADORES, RAIZ, campanas_que_hay, escapar, escribir_como_estaba,  # noqa: E402
                   escribir_json, fecha_iso, fecha_larga, leer_fecha, leer_json, leer_texto,
                   nombre_archivo, sin_tildes)
import imagenes as img  # noqa: E402

WEB = RAIZ / "web"
PY = sys.executable


# =========================================
# LAS HERRAMIENTAS DE SIEMPRE, CARGADAS
# =========================================
# Llevan guiones en el nombre, así que se cargan por su ruta. Cada una
# una sola vez, y solo cuando hace falta: si alguna se rompe, el resto del
# editor sigue.

_CARGADAS = {}


def herramienta(nombre):
    if nombre not in _CARGADAS:
        # Las de 1-publicar/, o las del propio editor (dndbeyond).
        ruta = PUBLICAR / (nombre + ".py")
        if not ruta.is_file():
            ruta = EDITOR / (nombre + ".py")
        spec = importlib.util.spec_from_file_location("editor_web_" + nombre.replace("-", "_"), ruta)
        modulo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(modulo)
        _CARGADAS[nombre] = modulo
    return _CARGADAS[nombre]


def _sin_salir(funcion, *args):
    """Las herramientas, cuando algo no cuadra, lo dicen y hacen sys.exit:
    aquí eso es un error que contar, no un editor que se cierra."""
    try:
        return funcion(*args)
    except SystemExit:
        raise ValueError("la herramienta se ha parado (mira la ventana donde arrancaste el editor)")


# =========================================
# LAS TAREAS LARGAS, CON SU BARRA
# =========================================
# Una tarea es una lista de pasos [(qué se ve, la orden, de quién)]. Cada
# paso es un script de las herramientas; se cuenta cuánto va por el TIEMPO
# que lleva comparado con lo que tardó la última vez (como al pasar la
# wiki en editor-wiki.py), y nunca pasa de 99 hasta que termina.

TAREA = {"activa": False, "fase": "", "porcentaje": 0, "terminado": True, "resultado": None, "registro": []}

# EL REGISTRO: todo lo que van diciendo las herramientas, línea a línea y
# según lo dicen, con una marca al empezar y al acabar cada paso («▶», «✓»,
# «✗»). Es lo que enseña la ventana flotante del proceso en el editor (la
# pide por trozos: desde la línea que ya tiene). Con tope, por si acaso.
LINEAS_DE_REGISTRO = 5000


def apuntar(registro, linea):
    # Las líneas en blanco, fuera: en la ventana solo estiraban la lista.
    if not str(linea).strip():
        return
    if len(registro) < LINEAS_DE_REGISTRO:
        registro.append(linea)
    elif len(registro) == LINEAS_DE_REGISTRO:
        registro.append("… (hay más, pero no caben aquí)")


def estado_con_registro(estado, desde):
    """El estado de una tarea, con las líneas del registro desde «desde»."""
    salida = {k: estado[k] for k in ("activa", "fase", "porcentaje", "terminado", "resultado")}
    registro = estado.get("registro") or []
    try:
        desde = max(0, int(desde or 0))
    except ValueError:
        desde = 0
    salida["lineas"] = registro[desde:]
    salida["total"] = len(registro)
    return salida
TIEMPOS = Path(tempfile.gettempdir()) / "editor-web-tiempos.json"
_CERROJO = threading.Lock()

NOMBRES_DE_PASOS = {
    "generar-archivo.py": "Los archivos del año y del mes",
    "tokens-pequenos.py": "Los tokens en pequeño",
    "generar-posts.py": "Los listados",
    "quitar-comentarios.py": "Quitando las notas de las plantillas",
    "textos-npcs.py": "La página de los NPC",
    "generar-rss.py": "El RSS",
    "generar-sitemap.py": "El sitemap",
    "generar-mapa.py": "El mapa del sitio",
    "generar-buscador.py": "El buscador",
    "actualizar-cabeceras.py": "Las cabeceras y los menús",
    "css-sano.py": "Mirando las hojas de estilo",
    "temas-completos.py": "Mirando los temas de color",
    "generar-linea-tiempo.py": "La línea de tiempo",
    "generar-mundo.py": "La wiki",
    "generar-galeria.py": "Las miniaturas de la galería",
    "enlaces-rotos.py": "Enlaces rotos",
    "nombres-repetidos.py": "Nombres repetidos",
    "inyecciones.py": "Lo que se pega sin escapar",
}


def paso(script, *argumentos):
    nombre = script.split("/")[-1]
    return (NOMBRES_DE_PASOS.get(nombre, nombre), [PY, str(HERRAMIENTAS / script)] + list(argumentos), nombre)


def pasos_generadores():
    return [paso(s) for s in GENERADORES]


def _tiempos():
    try:
        datos = json.loads(TIEMPOS.read_text(encoding="utf-8"))
        return datos if isinstance(datos, dict) else {}
    except (OSError, ValueError):
        return {}


def _correr(pasos, al_avanzar, seguir_aunque_falle=False, registro=None):
    registro = registro if registro is not None else []
    antes = _tiempos()
    esperados = [float(antes.get(clave) or 8.0) for _, _, clave in pasos]
    total = sum(esperados) or 1.0
    hecho = 0.0
    salida, fallos = [], []
    entorno = dict(os.environ, PYTHONUNBUFFERED="1", PYTHONIOENCODING="utf-8")
    for (fase, orden, clave), espera in zip(pasos, esperados):
        al_avanzar(fase, round(hecho / total * 100))
        apuntar(registro, "▶ %s  (%s)" % (fase, clave))
        empieza = time.monotonic()
        proceso = subprocess.Popen(orden, cwd=RAIZ, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
                                   env=entorno)
        reloj = threading.Timer(900, proceso.kill)
        reloj.start()
        lineas = []

        def contar(base=hecho, espera=espera, empieza=empieza, fase=fase):
            while proceso.poll() is None:
                parte = min(0.97, (time.monotonic() - empieza) / espera)
                al_avanzar(fase, min(99, round((base + espera * parte) / total * 100)))
                time.sleep(0.25)

        contador = threading.Thread(target=contar, daemon=True)
        contador.start()
        try:
            for linea in proceso.stdout:
                lineas.append(linea.rstrip("\n"))
                apuntar(registro, "  " + linea.rstrip("\n"))
            proceso.wait()
        finally:
            reloj.cancel()
            contador.join(timeout=1)
        antes[clave] = round(time.monotonic() - empieza, 1)
        apuntar(registro, ("✗ %s ha fallado" if proceso.returncode else "✓ %s, hecho") % fase
                + " (%s s)" % antes[clave])
        hecho += espera
        utiles = [l for l in lineas if l.strip()]
        salida.append(clave + ":\n" + "\n".join(utiles[-12:]))
        if proceso.returncode:
            fallos.append(fase)
            if not seguir_aunque_falle:
                break
    try:
        TIEMPOS.write_text(json.dumps(antes), encoding="utf-8")
    except OSError:
        pass
    if fallos:
        return {"error": "Algo ha fallado: " + ", ".join(fallos) + ".", "salida": "\n\n".join(salida)}
    return {"ok": True, "salida": "\n\n".join(salida)}


def empezar_tarea(pasos, fin=None, seguir_aunque_falle=False, primero="Empezando"):
    """Corre los pasos en otro hilo y vuelve enseguida. fin(resultado), si
    se da, añade lo que haga falta al resultado (a dónde ir después)."""
    if not _CERROJO.acquire(blocking=False):
        return {"error": "Ya hay algo pasándose; espera a que termine."}
    TAREA.update({"activa": True, "fase": primero, "porcentaje": 0, "terminado": False, "resultado": None,
                  "registro": []})

    def avanzar(fase, porcentaje):
        TAREA["fase"], TAREA["porcentaje"] = fase, porcentaje

    def trabajar():
        try:
            hecho = (_correr(pasos, avanzar, seguir_aunque_falle, TAREA["registro"]) if pasos
                     else {"ok": True, "salida": ""})
            if fin:
                hecho.update(fin(hecho) or {})
        except Exception as error:  # que el editor lo cuente y no se quede esperando
            hecho = {"error": "Algo ha fallado: %s" % error}
        TAREA.update({"activa": False, "terminado": True, "porcentaje": 100, "resultado": hecho})
        _CERROJO.release()

    threading.Thread(target=trabajar, daemon=True).start()
    return {"tarea": True}


def estado_de_la_tarea(desde=0):
    return estado_con_registro(TAREA, desde)


# =========================================
# EL HTML DE DENTRO DE UNA ENTRADA
# =========================================
# Lo que escribe el editor (el texto de una entrada, lo de una escena de
# las notas) se lee como un árbol y se vuelve a escribir: así sale con
# las etiquetas bien cerradas, una por línea, y sin lo que no tiene que
# estar en una página (un <script>, un onclick=, un enlace javascript:).
# Lo demás se queda tal cual: un texto escrito a mano con otras etiquetas
# no se pierde por abrirlo aquí.

VACIAS = {"br", "hr", "img", "wbr", "source", "col", "meta", "link", "input"}
FUERA = {"script", "style", "iframe", "object", "embed", "link", "meta", "form", "input", "button",
         "textarea", "select", "base", "frame", "frameset", "applet"}
# Las que van con lo de dentro en líneas aparte (si no, en la misma).
CAJAS = {"ul", "ol", "table", "thead", "tbody", "tfoot", "tr", "blockquote", "figure", "details", "div", "section"}
CIERRAN_P = {"p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "pre", "blockquote", "figure", "table", "div",
             "hr", "details", "section", "dl", "address", "aside", "header", "footer", "nav"}
DIRECCION_BUENA = re.compile(r"^(https?:|/|#|mailto:)", re.I)


class _Arbol(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.raiz = {"tag": None, "attrs": [], "hijos": []}
        self.pila = [self.raiz]

    def _cerrar_hasta(self, tag, antes_de=()):
        """Cierra la última «tag» abierta, si la hay sin pasar por una de
        «antes_de» (un <li> abierto dentro de su <ul>, no de otro)."""
        for i in range(len(self.pila) - 1, 0, -1):
            if self.pila[i]["tag"] == tag:
                del self.pila[i:]
                return
            if self.pila[i]["tag"] in antes_de:
                return

    def handle_starttag(self, tag, attrs):
        # Lo que cierra solo un navegador: un párrafo sin </p> acaba donde
        # empieza el siguiente bloque, un <li> donde empieza el siguiente…
        # Si no, un </p> que se olvidó metía el resto del texto dentro.
        if tag in CIERRAN_P and self.pila[-1]["tag"] == "p":
            self.pila.pop()
        if tag == "li":
            self._cerrar_hasta("li", ("ul", "ol"))
        if tag in ("td", "th"):
            self._cerrar_hasta("td", ("tr", "table"))
            self._cerrar_hasta("th", ("tr", "table"))
        if tag == "tr":
            self._cerrar_hasta("tr", ("table", "thead", "tbody"))
        nodo = {"tag": tag, "attrs": attrs, "hijos": []}
        self.pila[-1]["hijos"].append(nodo)
        if tag not in VACIAS:
            self.pila.append(nodo)

    def handle_startendtag(self, tag, attrs):
        self.pila[-1]["hijos"].append({"tag": tag, "attrs": attrs, "hijos": []})

    def handle_endtag(self, tag):
        for i in range(len(self.pila) - 1, 0, -1):
            if self.pila[i]["tag"] == tag:
                del self.pila[i:]
                return

    def handle_data(self, datos):
        self.pila[-1]["hijos"].append(datos)


def arbol(texto):
    lector = _Arbol()
    lector.feed(texto or "")
    lector.close()
    return lector.raiz["hijos"]


def _atributos(nodo):
    salida = []
    for clave, valor in nodo["attrs"]:
        clave = clave.lower()
        if clave.startswith("on") or clave == "style" or clave == "srcdoc":
            continue
        if clave in ("href", "src", "action", "formaction", "xlink:href"):
            if not valor or not DIRECCION_BUENA.match(valor.strip()):
                continue
        salida.append(" %s" % clave if valor is None else ' %s="%s"' % (clave, html.escape(valor, quote=True)))
    return "".join(salida)


def _es_blanco(nodo):
    return isinstance(nodo, str) and not nodo.strip()


def _en_linea(nodos, en_pre=False):
    """Lo de dentro, seguido (dentro de un párrafo, de un <li>…). Fuera de
    un <pre>, los saltos y los espacios de más son un espacio (como los
    lee el navegador)."""
    trozos = []
    for nodo in nodos:
        if isinstance(nodo, str):
            trozos.append(html.escape(nodo if en_pre else re.sub(r"\s+", " ", nodo), quote=False))
        elif nodo["tag"] in FUERA:
            continue
        elif nodo["tag"] in VACIAS:
            trozos.append("<%s%s>" % (nodo["tag"], _atributos(nodo)))
        else:
            trozos.append("<%s%s>%s</%s>" % (nodo["tag"], _atributos(nodo),
                                             _en_linea(nodo["hijos"], en_pre or nodo["tag"] == "pre"), nodo["tag"]))
    return "".join(trozos)


def _bonito(nodos, sangria, lineas):
    for nodo in nodos:
        if _es_blanco(nodo):
            continue
        if isinstance(nodo, str):
            lineas.append(sangria + html.escape(nodo.strip(), quote=False))
            continue
        tag = nodo["tag"]
        if tag in FUERA:
            continue
        if tag in VACIAS:
            lineas.append(sangria + "<%s%s>" % (tag, _atributos(nodo)))
        elif tag in CAJAS and any(not isinstance(h, str) for h in nodo["hijos"]):
            lineas.append(sangria + "<%s%s>" % (tag, _atributos(nodo)))
            _bonito(nodo["hijos"], sangria + "    ", lineas)
            lineas.append(sangria + "</%s>" % tag)
        else:
            dentro = _en_linea(nodo["hijos"], tag == "pre")
            if tag != "pre":
                dentro = dentro.strip()
            lineas.append(sangria + "<%s%s>%s</%s>" % (tag, _atributos(nodo), dentro, tag))


def limpiar(texto, sangria=""):
    """El HTML de un trozo de entrada, limpio y una cosa por línea."""
    lineas = []
    _bonito(arbol(texto), sangria, lineas)
    return "\n".join(lineas)


def _sin_sangria(texto):
    """Lo de dentro de una caja, sin la sangría común (para el editor)."""
    lineas = texto.strip("\n").split("\n")
    puestas = [len(l) - len(l.lstrip()) for l in lineas if l.strip()]
    quitar = min(puestas) if puestas else 0
    return "\n".join(l[quitar:] for l in lineas).strip()


def tapar_comentarios(texto):
    """El texto con lo de dentro de cada <!-- --> en blanco (los saltos de
    línea se quedan): mide lo mismo, así que lo que se encuentra en él está
    en el mismo sitio del de verdad. Los borradores llevan en comentarios
    EJEMPLOS de lo que va en la página (una figura, una hoja del
    cuaderno…), y buscando en el texto tal cual se encontraba el ejemplo
    en vez de lo de verdad."""
    return re.sub(r"<!--.*?-->", lambda m: re.sub(r"[^\n]", " ", m.group(0)), texto, flags=re.S)


def caja(texto, apertura):
    """Dónde empieza y acaba lo de DENTRO de la caja que abre «apertura»
    (una expresión regular de su etiqueta), contando las de dentro del
    mismo tipo. (inicio, fin) o None. Lo de los comentarios no cuenta."""
    texto = tapar_comentarios(texto)
    m = re.search(apertura, texto)
    if not m:
        return None
    etiqueta = re.match(r"<(\w+)", m.group(0)).group(1)
    profundo = 1
    for t in re.finditer(r"<(/?)%s\b[^>]*>" % etiqueta, texto[m.end():]):
        profundo += -1 if t.group(1) else 1
        if profundo == 0:
            return m.end(), m.end() + t.start()
    return None


def _texto_plano(trozo):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", trozo or "")).split())


# =========================================
# LAS ENTRADAS
# =========================================
# Una entrada es cualquier página de web/ con su <article class="…-post">:
# blog-post (el blog), relato-post (los relatos y los días del reto) y
# cuaderno-post (las notas de una partida). Las mismas que ve publicar.py.

RE_ARTICULO = re.compile(r'<article class="(blog|relato|cuaderno)-post"[^>]*>')
NOMBRES_DE_TIPO = {"entrada": "entrada del blog", "relato": "relato", "reto": "día del reto",
                   "sesion": "notas de una partida"}


def _prefijo(tipo):
    return {"entrada": "blog", "sesion": "cuaderno"}.get(tipo, "relato")


def _tipo_de(archivo, texto):
    m = RE_ARTICULO.search(texto)
    if not m:
        return None
    if m.group(1) == "blog":
        return "entrada"
    if m.group(1) == "cuaderno":
        return "sesion"
    return "reto" if archivo.parent.resolve() == herramienta("nuevo").CARPETA_RETO.resolve() else "relato"


def entradas():
    salida = []
    for archivo in sorted(WEB.rglob("*.html")):
        if archivo.name.startswith("index_") or archivo.name == "diario.html":
            continue
        texto = archivo.read_text(encoding="utf-8")
        tipo = _tipo_de(archivo, texto)
        if not tipo:
            continue
        rel = archivo.relative_to(RAIZ).as_posix()
        titulo = re.search(r'<h1 class="\w+-post-title">(.*?)</h1>', texto, re.S)
        fecha = re.search(r'<time datetime="([^"]+)">([^<]*)</time>', texto)
        salida.append({"archivo": rel, "url": "/" + rel, "tipo": tipo, "que": NOMBRES_DE_TIPO[tipo],
                       "titulo": _texto_plano(titulo.group(1)) if titulo else "(sin título)",
                       "fecha": fecha.group(1) if fecha else "", "fecha_texto": fecha.group(2) if fecha else "",
                       "borrador": "data-borrador" in RE_ARTICULO.search(texto).group(0)})
    salida.sort(key=lambda e: (e["fecha"], e["archivo"]), reverse=True)
    return salida


def ruta_de_entrada(relativo):
    """La página pedida, si es una entrada de verdad y está dentro de web/."""
    try:
        archivo = (RAIZ / str(relativo or "").lstrip("/")).resolve()
        archivo.relative_to(WEB.resolve())
    except (ValueError, OSError):
        return None, None, None
    if not archivo.is_file() or archivo.suffix != ".html":
        return None, None, None
    texto, _ = leer_texto(archivo)
    tipo = _tipo_de(archivo, texto)
    return (archivo, texto, tipo) if tipo else (None, None, None)


def _atributo(etiqueta, nombre):
    m = re.search(r'\s%s="([^"]*)"' % re.escape(nombre), etiqueta)
    return html.unescape(m.group(1)) if m else ""


def _meta(texto, nombre, propiedad=False):
    m = re.search(r'<meta %s="%s" content="([^"]*)"' % ("property" if propiedad else "name", re.escape(nombre)), texto)
    return html.unescape(m.group(1)) if m else ""


def _campana_de(texto):
    etiqueta = RE_ARTICULO.search(texto).group(0)
    clave = _atributo(etiqueta, "data-campana")
    for archivo, datos in campanas_que_hay():
        if (datos.get("clave") or "") == clave:
            return archivo, datos
    return None, None


def _imagen_al_lado(texto, pre):
    m = re.search(r'<figure class="%s-post-aside">(.*?)</figure>' % pre, tapar_comentarios(texto), re.S)
    if not m:
        return None
    m = re.match(r'<figure class="%s-post-aside">(.*?)</figure>' % pre, texto[m.start():m.end()], re.S)
    imagen = re.search(r"<img\b[^>]*>", m.group(1))
    pie = re.search(r"<figcaption>(.*?)</figcaption>", m.group(1), re.S)
    # Una que no es una imagen sin más (un vídeo que hace de gif, una
    # <picture>…) está escrita a mano: se enseña, y no se toca si no se
    # pide cambiarla.
    a_mano = not imagen or bool(re.search(r"<(video|picture|source|iframe)\b", m.group(1)))
    # El pie, con lo que lleve dentro (un enlace a quien hizo la foto).
    return {"a_mano": a_mano,
            "src": _atributo(imagen.group(0), "src") if imagen else "",
            "alt": _atributo(imagen.group(0), "alt") if imagen else "",
            "pie": " ".join(_en_linea(arbol(pie.group(1))).split()) if pie else ""}


def leer_cuaderno(texto):
    """Las hojas de unas notas: [{numero, titulo, bloques}], y cada bloque
    un trozo de texto suelto o una escena (con su nombre, si está abierta y
    lo de dentro)."""
    sitio = caja(texto, r'<div class="cuaderno">')
    if not sitio:
        return []
    hojas = []
    for nodo in arbol(texto[sitio[0]:sitio[1]]):
        if isinstance(nodo, str) or "cuaderno-hoja" not in dict(nodo["attrs"]).get("class", "").split():
            continue
        hoja = {"numero": "", "titulo": "", "bloques": []}

        def buscar(n, clase):
            if isinstance(n, str):
                return None
            if clase in dict(n["attrs"]).get("class", "").split():
                return n
            for h in n["hijos"]:
                encontrado = buscar(h, clase)
                if encontrado:
                    return encontrado
            return None

        titulo = buscar(nodo, "cuaderno-hoja-titulo")
        numero = buscar(nodo, "cuaderno-hoja-numero")
        hoja["titulo"] = _texto_plano(_en_linea(titulo["hijos"])) if titulo else ""
        hoja["numero"] = _texto_plano(_en_linea(numero["hijos"])) if numero else ""
        cuerpo = buscar(nodo, "cuaderno-hoja-cuerpo")
        sueltos = []
        for hijo in (cuerpo["hijos"] if cuerpo else []):
            if not isinstance(hijo, str) and "cuaderno-escena" in dict(hijo["attrs"]).get("class", "").split():
                if sueltos:
                    hoja["bloques"].append({"tipo": "texto", "html": limpiar_nodos(sueltos)})
                    sueltos = []
                nombre = buscar(hijo, "cuaderno-escena-nombre")
                dentro = buscar(hijo, "cuaderno-escena-cuerpo")
                hoja["bloques"].append({"tipo": "escena", "nombre": _texto_plano(_en_linea(nombre["hijos"])) if nombre else "",
                                        "abierta": any(k == "open" for k, _ in hijo["attrs"]),
                                        "html": limpiar_nodos(dentro["hijos"]) if dentro else ""})
            elif not _es_blanco(hijo):
                sueltos.append(hijo)
        if sueltos:
            hoja["bloques"].append({"tipo": "texto", "html": limpiar_nodos(sueltos)})
        hojas.append(hoja)
    return hojas


# EL POST-IT DE UNA PARTIDA: las «Cosas pendientes» de al lado del
# cuaderno, un <ul class="cuaderno-tareas"> dentro de <aside
# class="cuaderno-postit">. Es de cada sesión, escrito a mano en el editor
# de las notas (no sale de las misiones de la campaña). Cada cosa es un
# <li> (con class="hecho" si ya está hecha: sale tachada y con la casilla
# marcada). Los comentarios de la plantilla llevan un post-it de ejemplo:
# no cuentan (tapar_comentarios).
RE_POSTIT = re.compile(r'<aside class="cuaderno-postit"[^>]*>.*?(<ul class="cuaderno-tareas">)(.*?)(</ul>)', re.S)


def _sitio_del_postit(texto):
    """Dónde está lo de DENTRO de la lista del post-it (inicio, fin), o
    None si la página no tiene post-it."""
    m = RE_POSTIT.search(tapar_comentarios(texto))
    return (m.start(2), m.end(2)) if m else None


def leer_postit(texto):
    sitio = _sitio_del_postit(texto)
    if not sitio:
        return None
    cosas = []
    for nodo in arbol(texto[sitio[0]:sitio[1]]):
        if isinstance(nodo, str) or nodo["tag"] != "li":
            continue
        dentro = _en_linea(nodo["hijos"]).strip()
        if _texto_plano(dentro):
            cosas.append({"html": dentro, "hecho": "hecho" in dict(nodo["attrs"]).get("class", "").split()})
    return cosas


def _cambiar_postit(texto, cosas):
    sitio = _sitio_del_postit(texto)
    if not sitio:
        return texto
    sangria = _sangria_de(texto, texto.rfind("<ul", 0, sitio[0]))
    lineas = []
    for cosa in cosas:
        if not isinstance(cosa, dict):
            continue
        # Lo que llega pasa por el mismo colador que el resto de las notas
        # (solo etiquetas de texto, sin scripts ni direcciones raras).
        dentro = _en_linea(arbol(str(cosa.get("html") or ""))).strip()
        if not _texto_plano(dentro):
            continue
        lineas.append(sangria + "    <li%s>%s</li>" % (' class="hecho"' if cosa.get("hecho") else "", dentro))
    return texto[:sitio[0]] + "\n" + "\n".join(lineas) + ("\n" if lineas else "") + sangria + texto[sitio[1]:]


def limpiar_nodos(nodos):
    lineas = []
    _bonito(nodos, "", lineas)
    return "\n".join(lineas)


def leer_entrada(relativo):
    archivo, texto, tipo = ruta_de_entrada(relativo)
    if not archivo:
        return {"error": "Esa entrada no está."}
    pre = _prefijo(tipo)
    articulo = RE_ARTICULO.search(texto).group(0)
    titulo = re.search(r'<h1 class="%s-post-title">(.*?)</h1>' % pre, texto, re.S)
    fecha = re.search(r'<time datetime="([^"]+)">([^<]*)</time>', texto)
    rel = archivo.relative_to(RAIZ).as_posix()
    salida = {"archivo": rel, "url": "/" + rel, "tipo": tipo, "que": NOMBRES_DE_TIPO[tipo],
              "titulo": _texto_plano(titulo.group(1)) if titulo else "",
              "descripcion": _meta(texto, "description"),
              "fecha": fecha.group(1) if fecha else "", "fecha_texto": fecha.group(2) if fecha else "",
              "borrador": "data-borrador" in articulo}
    if tipo == "entrada":
        salida["etiquetas"] = _atributo(articulo, "data-tags")
    if tipo == "relato":
        salida["subcategoria"] = _atributo(articulo, "data-subcategoria")
    if tipo in ("entrada", "relato", "reto"):
        sitio = caja(texto, r'<div class="%s-post-body">' % pre)
        salida["cuerpo"] = _sin_sangria(texto[sitio[0]:sitio[1]]) if sitio else ""
        salida["imagen"] = _imagen_al_lado(texto, pre)
        salida["sitio_imagen"] = "blog" if tipo == "entrada" else "relatos"
        salida["anyo"] = (fecha.group(1)[:4] if fecha else str(dt.date.today().year))
    if tipo == "sesion":
        salida["hojas"] = leer_cuaderno(texto)
        salida["postit"] = leer_postit(texto)
        archivo_c, campana = _campana_de(texto)
        salida["campana"] = (campana or {}).get("clave", "")
        salida["campana_nombre"] = (campana or {}).get("nombre", "")
        # Los personajes de la mesa, con su color: el botón «personaje de la
        # mesa» los pone resaltados de su color (<strong class="pj-verde">).
        salida["personajes"] = [{"nombre": p.get("nombre", ""), "color": p.get("color", "")}
                                for p in (campana or {}).get("personajes") or [] if isinstance(p, dict)]
        sesion = next((s for s in (campana or {}).get("sesiones") or []
                       if isinstance(s, dict) and s.get("url") == "/" + rel), {})
        salida["titulo_corto"] = sesion.get("titulo", "")
        salida["numero"] = sesion.get("numero", "")
        salida["pdf"] = sesion.get("pdf", "")
        salida["resumen"] = sesion.get("resumen", "")
        salida["resumen_auto"] = bool(sesion.get("resumen_auto")) or not sesion.get("resumen")
    return salida


def _cambiar_titulo(texto, titulo, pre):
    """El título en sus tres sitios: <title>, og:title y el <h1>. En los
    dos primeros va con lo que lleve detrás («· El Blog de Richi»)."""
    def con_cola(m):
        antes = html.unescape(m.group(2))
        cola = antes.split(" · ", 1)[1] if " · " in antes else ""
        return m.group(1) + escapar(titulo + (" · " + cola if cola else "")) + m.group(3)
    texto = re.sub(r"(<title>)(.*?)(</title>)", con_cola, texto, count=1, flags=re.S)
    texto = re.sub(r'(<meta property="og:title" content=")([^"]*)(")', con_cola, texto, count=1)
    texto = re.sub(r'(<meta name="twitter:title" content=")([^"]*)(")', con_cola, texto, count=1)
    return re.sub(r'(<h1 class="%s-post-title">)(.*?)(</h1>)' % pre,
                  lambda m: m.group(1) + escapar(titulo) + m.group(3), texto, count=1, flags=re.S)


def _cambiar_descripcion(texto, descripcion):
    for patron in (r'(<meta name="description" content=")([^"]*)(")',
                   r'(<meta property="og:description" content=")([^"]*)(")',
                   r'(<meta name="twitter:description" content=")([^"]*)(")'):
        texto = re.sub(patron, lambda m: m.group(1) + escapar(descripcion) + m.group(3), texto, count=1)
    return texto


def _cambiar_atributo_del_articulo(texto, nombre, valor):
    m = RE_ARTICULO.search(texto)
    etiqueta = m.group(0)
    if re.search(r'\s%s="[^"]*"' % nombre, etiqueta):
        nueva = re.sub(r'(\s%s=")[^"]*(")' % nombre, lambda x: x.group(1) + escapar(valor) + x.group(2), etiqueta)
    else:
        nueva = etiqueta[:-1] + ' %s="%s">' % (nombre, escapar(valor))
    return texto[:m.start()] + nueva + texto[m.end():]


def _sangria_de(texto, posicion):
    inicio = texto.rfind("\n", 0, posicion) + 1
    linea = texto[inicio:posicion]
    return linea[:len(linea) - len(linea.lstrip())]


def _cambiar_cuerpo(texto, pre, cuerpo):
    sitio = caja(texto, r'<div class="%s-post-body">' % pre)
    if not sitio:
        raise ValueError("no encuentro dónde va el texto en la página")
    abre = texto.rfind("<", 0, sitio[0])
    sangria = _sangria_de(texto, abre)
    limpio = limpiar(cuerpo, sangria + "    ")
    if not limpio.strip():
        limpio = sangria + "    <p></p>"
    return texto[:sitio[0]] + "\n" + limpio + "\n" + sangria + texto[sitio[1]:]


def _figura(pre, src, alt, pie, sangria):
    """La imagen de la columna de la derecha, como la deja nuevo.py (con
    su ancho y su alto, para que el texto no salte al cargar); el pie
    puede llevar un enlace dentro."""
    tam = medidas(src)
    dims = ' width="%d" height="%d"' % (tam["ancho"], tam["alto"]) if tam["ancho"] else ""
    lineas = [sangria + '<figure class="%s-post-aside">' % pre,
              sangria + '    <img src="%s" alt="%s"%s loading="lazy" decoding="async">' % (escapar(src), escapar(alt), dims)]
    pie = _en_linea(arbol(pie)).strip()
    if pie:
        lineas.append(sangria + "    <figcaption>%s</figcaption>" % pie)
    lineas.append(sangria + "</figure>")
    return "\n".join(lineas)


def _cambiar_imagen(texto, tipo, imagen):
    """Solo si ha cambiado: la que ya está se queda tal cual si es la
    misma (con lo que tenga escrito a mano)."""
    pre = _prefijo(tipo)
    antes = _imagen_al_lado(texto, pre)
    if antes and antes.get("a_mano") and not (imagen and imagen.get("cambiar")):
        return texto
    if antes:
        antes = {k: antes[k] for k in ("src", "alt", "pie")}
    quiere = None
    if imagen and str(imagen.get("src") or "").strip():
        quiere = {"src": str(imagen["src"]).strip(), "alt": " ".join(str(imagen.get("alt") or "").split()),
                  "pie": " ".join(_en_linea(arbol(str(imagen.get("pie") or ""))).split())}
        if not quiere["src"].startswith("/") or quiere["src"].startswith("//"):
            raise ValueError("la imagen tiene que ser una del sitio (/imagenes/…)")
    if antes == quiere or (antes and quiere and antes["src"] == quiere["src"] and antes["alt"] == quiere["alt"]
                           and " ".join(antes["pie"].split()) == quiere["pie"]):
        return texto
    tapado = tapar_comentarios(texto)
    vieja = re.search(r'([ \t]*)<figure class="%s-post-aside">.*?</figure>' % pre, tapado, re.S)
    if vieja:
        if not quiere:
            fin = vieja.end() + (1 if texto[vieja.end():vieja.end() + 1] == "\n" else 0)
            return texto[:vieja.start()] + texto[fin:]
        return texto[:vieja.start()] + _figura(pre, quiere["src"], quiere["alt"], quiere["pie"], vieja.group(1)) \
            + texto[vieja.end():]
    if not quiere:
        return texto
    donde = tapado.find('<div class="%s-post-otras"' % pre)
    if donde == -1:
        lado = caja(texto, r'<div class="%s-post-side">' % pre)
        if not lado:
            raise ValueError("no encuentro la columna de la derecha en la página")
        sangria = _sangria_de(texto, texto.rfind("<", 0, lado[0])) + "    "
        return texto[:lado[0]] + "\n" + _figura(pre, quiere["src"], quiere["alt"], quiere["pie"], sangria) + texto[lado[0]:]
    linea = texto.rfind("\n", 0, donde) + 1
    sangria = _sangria_de(texto, donde)
    return texto[:linea] + _figura(pre, quiere["src"], quiere["alt"], quiere["pie"], sangria) + "\n" + texto[linea:]


def _cuaderno_html(hojas, sangria, cabecera):
    """Las hojas otra vez en HTML, como las deja la plantilla."""
    s = sangria
    lineas = []
    for n, hoja in enumerate(hojas, 1):
        titulo = str(hoja.get("titulo") or "").strip() or cabecera
        lineas += [s + '<div class="cuaderno-hoja">',
                   s + '    <div class="cuaderno-hoja-cabecera" aria-hidden="true">',
                   s + '        <p class="cuaderno-hoja-titulo">%s</p>' % escapar(titulo),
                   s + '        <p class="cuaderno-hoja-numero">%d</p>' % n,
                   s + "    </div>",
                   s + '    <div class="cuaderno-hoja-cuerpo" tabindex="0" role="region"',
                   s + '         aria-label="Hoja %d, con scroll">' % n]
        for bloque in hoja.get("bloques") or []:
            if not isinstance(bloque, dict):
                continue
            if bloque.get("tipo") == "escena":
                lineas += [s + '        <details class="cuaderno-escena"%s>' % (" open" if bloque.get("abierta", True) else ""),
                           s + '            <summary class="cuaderno-escena-titulo">',
                           s + '                <span class="cuaderno-escena-flecha" aria-hidden="true"></span>',
                           s + '                <span class="cuaderno-escena-nombre">%s</span>'
                           % escapar(str(bloque.get("nombre") or "").strip() or "Una escena"),
                           s + "            </summary>",
                           s + '            <div class="cuaderno-escena-cuerpo">']
                dentro = limpiar(str(bloque.get("html") or ""), s + "                ")
                if dentro.strip():
                    lineas.append(dentro)
                lineas += [s + "            </div>", s + "        </details>"]
            else:
                dentro = limpiar(str(bloque.get("html") or ""), s + "        ")
                if dentro.strip():
                    lineas.append(dentro)
        lineas += [s + "    </div>", s + "</div>"]
    return "\n".join(lineas)


def guardar_entrada(peticion):
    archivo, texto, tipo = ruta_de_entrada(peticion.get("archivo"))
    if not archivo:
        return {"error": "Esa entrada ya no está."}
    pre = _prefijo(tipo)
    descripcion = " ".join(str(peticion.get("descripcion") or "").split())
    if tipo == "sesion":
        archivo_c, campana = _campana_de(texto)
        corto = " ".join(str(peticion.get("titulo_corto") or "").split())
        sesion = next((s for s in (campana or {}).get("sesiones") or []
                       if isinstance(s, dict) and s.get("url") == "/" + archivo.relative_to(RAIZ).as_posix()), None)
        numero = (sesion or {}).get("numero") or re.sub(r"\D", "", archivo.stem) or "?"
        titulo = "Sesión %s" % int(numero) if str(numero).isdigit() else "Sesión %s" % numero
        if corto:
            titulo += " — " + corto
    else:
        titulo = " ".join(str(peticion.get("titulo") or "").split())
    if not titulo:
        return {"error": "Hace falta un título."}
    texto = _cambiar_titulo(texto, titulo, pre)
    if descripcion:
        texto = _cambiar_descripcion(texto, descripcion)
    if tipo == "entrada":
        etiquetas = [e for e in re.split(r"[\s,]+", str(peticion.get("etiquetas") or "").strip().lower()) if e]
        texto = _cambiar_atributo_del_articulo(texto, "data-tags", " ".join(etiquetas))
    if tipo == "relato":
        sub = str(peticion.get("subcategoria") or "").strip().lower()
        if not sub:
            return {"error": "Hace falta el tipo de relato (microrelato, relato corto…)."}
        texto = _cambiar_atributo_del_articulo(texto, "data-subcategoria", sub)
    try:
        if tipo in ("entrada", "relato", "reto"):
            texto = _cambiar_cuerpo(texto, pre, str(peticion.get("cuerpo") or ""))
            texto = _cambiar_imagen(texto, tipo, peticion.get("imagen"))
        else:
            sitio = caja(texto, r'<div class="cuaderno">')
            if not sitio:
                return {"error": "No encuentro el cuaderno en la página."}
            hojas = [h for h in peticion.get("hojas") or [] if isinstance(h, dict)]
            if not hojas:
                return {"error": "Unas notas necesitan una hoja por lo menos."}
            sangria = _sangria_de(texto, texto.rfind("<", 0, sitio[0]))
            fecha = leer_fecha(str((sesion or {}).get("fecha") or "")) if sesion else None
            cabecera = "Sesión %s — %s" % (numero, fecha.strftime("%d-%m-%Y") if fecha else "")
            hojas_viejas = leer_cuaderno(texto)
            if hojas_viejas and hojas_viejas[0].get("titulo"):
                cabecera = hojas_viejas[0]["titulo"]
            texto = (texto[:sitio[0]] + "\n" + _cuaderno_html(hojas, sangria, cabecera) + "\n" + sangria
                     + texto[sitio[1]:])
            if isinstance(peticion.get("postit"), list):
                texto = _cambiar_postit(texto, peticion["postit"])
    except ValueError as error:
        return {"error": "No he podido guardarla: %s." % error}
    escribir_como_estaba(archivo, texto)
    if tipo == "sesion" and sesion is not None:
        sesion["titulo"] = corto
        pdf = str(peticion.get("pdf") or "").strip()
        if pdf and not re.match(r"^https?://", pdf):
            return {"error": "El enlace del PDF tiene que empezar por http:// o https:// (lo demás está guardado)."}
        sesion["pdf"] = pdf
        # EL RESUMEN: lo escrito a mano se queda (y ya no se rehace solo);
        # vacío, vuelve a ser el automático (lo rehace generar-posts.py).
        if isinstance(peticion.get("resumen"), str):
            resumen = "\n".join(l.strip() for l in peticion["resumen"].strip().splitlines() if l.strip())
            if not resumen:
                # Vacío: vuelve el automático, rehecho ya con estas notas.
                from resumenes import resumen_de_notas
                sesion["resumen"] = resumen_de_notas(texto)
                sesion["resumen_auto"] = True
                if not sesion["resumen"]:
                    sesion.pop("resumen")
            elif peticion.get("resumen_auto"):
                # El automático (el de antes o uno rehecho con su botón).
                sesion["resumen"] = resumen
                sesion["resumen_auto"] = True
            elif resumen != sesion.get("resumen") or sesion.get("resumen_auto"):
                sesion["resumen"] = resumen
                sesion["resumen_auto"] = False
        escribir_json(archivo_c, campana)
    rel = archivo.relative_to(RAIZ).as_posix()
    if peticion.get("pasar"):
        return empezar_tarea(pasos_generadores(), fin=lambda r: {"entrada": leer_entrada(rel)})
    return {"ok": True, "entrada": leer_entrada(rel)}


def publicar_entrada(peticion):
    archivo, texto, tipo = ruta_de_entrada(peticion.get("archivo"))
    if not archivo:
        return {"error": "Esa entrada ya no está."}
    publicar = herramienta("publicar")
    hecho = publicar.poner_marca(archivo) if peticion.get("despublicar") else publicar.quitar_marca(archivo)
    rel = archivo.relative_to(RAIZ).as_posix()
    if not hecho:
        return {"ok": True, "entrada": leer_entrada(rel), "nada": True}
    return empezar_tarea(pasos_generadores(), fin=lambda r: {"entrada": leer_entrada(rel)})


# ---- HACER UNA NUEVA ----
# Lo mismo que nuevo.py (sus mismas funciones), sin preguntas: lo que
# preguntaría llega ya escrito del editor.

def _fecha_pedida(texto):
    fecha = leer_fecha(str(texto or "")) if texto else dt.date.today()
    if not fecha:
        raise ValueError("no entiendo la fecha «%s»: ponla como dd-mm-aaaa" % texto)
    return fecha


def crear_entrada(peticion):
    nuevo = herramienta("nuevo")
    tipo = str(peticion.get("tipo") or "")
    try:
        if tipo in ("entrada", "relato"):
            destino = _crear_entrada_o_relato(nuevo, peticion, tipo == "relato")
        elif tipo == "reto":
            destino = _crear_dia_del_reto(nuevo, peticion)
        elif tipo == "sesion":
            destino = _crear_sesion(nuevo, peticion)
        else:
            return {"error": "No sé hacer eso."}
    except ValueError as error:
        return {"error": str(error)[:1].upper() + str(error)[1:] + "."}
    rel = destino.relative_to(RAIZ).as_posix()
    return empezar_tarea(pasos_generadores(), fin=lambda r: {"entrada": leer_entrada(rel)}, primero="Creada; pasando")


def _crear_entrada_o_relato(nuevo, p, es_relato):
    titulo = " ".join(str(p.get("titulo") or "").split())
    if not titulo:
        raise ValueError("hace falta un título: de ahí sale el nombre del archivo")
    datos = {"relato": es_relato, "titulo": titulo, "fecha": _fecha_pedida(p.get("fecha"))}
    if es_relato:
        datos["subcategoria"] = str(p.get("subcategoria") or "").strip().lower()
        if not datos["subcategoria"]:
            raise ValueError("hace falta el tipo de relato (microrelato, relato corto…)")
        datos["etiquetas"] = []
    else:
        datos["subcategoria"] = ""
        datos["etiquetas"] = [e for e in re.split(r"[\s,]+", str(p.get("etiquetas") or "").strip().lower()) if e]
    datos["descripcion"] = " ".join(str(p.get("descripcion") or "").split()) or "%s — El Blog de Richi" % titulo
    imagen = p.get("imagen") or {}
    datos["imagen"] = str(imagen.get("src") or "").strip()
    datos["alt"] = str(imagen.get("alt") or "")
    datos["pie"] = str(imagen.get("pie") or "")
    destino = nuevo.destino_entrada(datos)
    if destino.exists():
        raise ValueError("ya hay una con ese título (%s); ábrela desde la lista"
                         % destino.relative_to(RAIZ).as_posix())
    _sin_salir(nuevo.montar_entrada, datos, destino)
    return destino


def _crear_dia_del_reto(nuevo, p):
    reto = leer_json(nuevo.JSON_RETO)
    if not reto or not isinstance(reto.get("dias"), list):
        raise ValueError("no encuentro los días del reto")
    try:
        numero = int(p.get("dia"))
    except (TypeError, ValueError):
        raise ValueError("¿qué día?")
    dia = next((d for d in reto["dias"] if isinstance(d, dict) and int(d.get("dia") or 0) == numero), None)
    if not dia:
        raise ValueError("el reto no tiene día %d" % numero)
    if (dia.get("url") or "").strip():
        raise ValueError("el día %d ya está escrito; ábrelo desde la lista" % numero)
    palabra = (dia.get("palabra") or "").strip() or " ".join(str(p.get("palabra") or "").split())
    if not palabra:
        raise ValueError("ese día no tiene palabra: escríbela")
    dia["palabra"] = palabra
    titulo = " ".join(str(p.get("titulo") or "").split()) or palabra
    destino = nuevo.CARPETA_RETO / f"dia-{numero:02d}-{nombre_archivo(palabra, str(numero))}.html"
    if destino.exists():
        raise ValueError("ya existe %s" % destino.relative_to(RAIZ).as_posix())
    fecha = leer_fecha(dia.get("fecha", "")) or dt.date.today()
    url = "/" + destino.relative_to(RAIZ).as_posix()
    texto = _sin_salir(nuevo.rellenar, (nuevo.PLANTILLAS / "dia-reto.html").read_text(encoding="utf-8"), {
        "TITULO": escapar(titulo), "FECHA": fecha_larga(fecha), "FECHA_ISO": fecha_iso(fecha), "URL": url,
        "DESCRIPCION": escapar(f"Día {numero} del reto de escritura, con la palabra «{palabra}»."),
        "SUBCATEGORIA": escapar(nuevo.SUBCATEGORIA_RETO), "CUERPO": nuevo.CUERPO_MUESTRA_RETO, "IMAGEN": "",
    })
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(texto, encoding="utf-8")
    dia["titulo"] = titulo
    dia["url"] = url
    escribir_json(nuevo.JSON_RETO, reto)
    return destino


def _crear_sesion(nuevo, p):
    clave = str(p.get("campana") or "").strip()
    archivo_c, campana = next(((a, d) for a, d in campanas_que_hay() if d.get("clave") == clave), (None, None))
    if not campana:
        raise ValueError("no encuentro esa campaña")
    pagina = (campana.get("pagina") or "").strip()
    carpeta = (RAIZ / pagina.lstrip("/")).parent
    if not pagina or not carpeta.is_dir():
        raise ValueError("no encuentro la carpeta de la campaña")
    numeros = [int(s.get("numero") or 0) for s in campana.get("sesiones") or [] if isinstance(s, dict)]
    try:
        numero = int(p.get("numero") or ((max(numeros) + 1) if numeros else 1))
    except (TypeError, ValueError):
        raise ValueError("el número de sesión tiene que ser un número")
    if numero in numeros:
        raise ValueError("la sesión %d ya está apuntada en esta campaña" % numero)
    fecha = _fecha_pedida(p.get("fecha"))
    corto = " ".join(str(p.get("titulo") or "").split())
    sesion = f"Sesión {numero}"
    titulo = sesion + (f" — {corto}" if corto else "")
    destino = carpeta / f"sesion-{numero:02d}.html"
    if destino.exists():
        raise ValueError("ya existe %s" % destino.relative_to(RAIZ).as_posix())
    pdf = str(p.get("pdf") or "").strip()
    if pdf and not re.match(r"^https?://", pdf):
        raise ValueError("el enlace del PDF tiene que empezar por http:// o https://")
    nombre = (campana.get("nombre") or "").strip()
    corta = fecha.strftime("%d-%m-%Y")
    url = "/" + destino.relative_to(RAIZ).as_posix()
    texto = _sin_salir(nuevo.rellenar, (nuevo.PLANTILLAS / "sesion-rol.html").read_text(encoding="utf-8"), {
        "TITULO": escapar(titulo), "SESION": escapar(sesion), "FECHA": fecha_larga(fecha),
        "FECHA_ISO": fecha_iso(fecha), "FECHA_CORTA": escapar(corta), "URL": url,
        "DESCRIPCION": escapar(" ".join(str(p.get("descripcion") or "").split())
                               or f"Notas de la sesión {numero} de la {nombre}, jugada el {corta}."),
        "CAMPANA": escapar(clave), "CAMPANA_NOMBRE": escapar(nombre), "CAMPANA_URL": escapar(pagina),
        "CAMPANA_DATOS": escapar("/" + archivo_c.relative_to(RAIZ).as_posix()),
    })
    destino.write_text(texto, encoding="utf-8")
    campana.setdefault("sesiones", []).append({"numero": numero, "fecha": corta, "titulo": corto, "url": url,
                                               "pdf": pdf})
    escribir_json(archivo_c, campana)
    return destino


def para_hacer_nuevas():
    """Lo que hace falta para los formularios de «hacer una nueva»."""
    nuevo = herramienta("nuevo")
    reto = leer_json(nuevo.JSON_RETO, {}) or {}
    relatos = set(nuevo.TIPOS_RELATO)
    etiquetas = set()
    for e in entradas():
        archivo, texto, tipo = ruta_de_entrada(e["archivo"])
        etiqueta = RE_ARTICULO.search(texto).group(0)
        if tipo == "relato":
            relatos.add(_atributo(etiqueta, "data-subcategoria"))
        if tipo == "entrada":
            etiquetas.update(_atributo(etiqueta, "data-tags").split())
    campanas = []
    for _, d in campanas_que_hay():
        numeros = [int(s.get("numero") or 0) for s in d.get("sesiones") or [] if isinstance(s, dict)]
        campanas.append({"clave": d.get("clave", ""), "nombre": d.get("nombre", ""),
                         "siguiente": (max(numeros) + 1) if numeros else 1})
    return {"relatos": sorted(r for r in relatos if r), "etiquetas": sorted(etiquetas),
            "reto": {"nombre": reto.get("nombre", "el reto"),
                     "dias": [{"dia": d.get("dia"), "fecha": d.get("fecha", ""), "palabra": d.get("palabra", ""),
                               "escrito": bool((d.get("url") or "").strip())}
                              for d in reto.get("dias") or [] if isinstance(d, dict)]},
            "campanas": campanas, "hoy": dt.date.today().strftime("%d-%m-%Y")}


# =========================================
# LAS IMÁGENES
# =========================================
# Se suben desde el navegador (o se pega su ruta) y pasan por
# imagenes.traer(): a WebP, a su tamaño y sin los datos del móvil, en la
# carpeta que toque según para qué sea (SITIOS en imagenes.py).

def _temporal(crudo, sufijo):
    descriptor, ruta = tempfile.mkstemp(suffix=sufijo)
    with os.fdopen(descriptor, "wb") as archivo:
        archivo.write(crudo)
    return Path(ruta)


def _campos_de_carpeta(sitio, campos):
    campos = campos if isinstance(campos, dict) else {}
    salida = {}
    if "{anyo}" in img.SITIOS[sitio]["carpeta"]:
        anyo = str(campos.get("anyo") or dt.date.today().year)
        if not re.fullmatch(r"\d{4}", anyo):
            raise ValueError("el año no es un año")
        salida["anyo"] = anyo
    if "{campana}" in img.SITIOS[sitio]["carpeta"]:
        clave = str(campos.get("campana") or "")
        if clave not in {d.get("clave") for _, d in campanas_que_hay()}:
            raise ValueError("no encuentro esa campaña")
        salida["campana"] = clave
    if "{personaje}" in img.SITIOS[sitio]["carpeta"]:
        # Uno de mis personajes: su clave (la de su carpeta). Puede ser uno
        # recién añadido que aún no se ha guardado, así que basta con que
        # sea una clave que valga.
        clave = nombre_archivo(str(campos.get("personaje") or ""), "")
        if not clave:
            raise ValueError("primero ponle nombre al personaje")
        salida["personaje"] = clave
    if "{santuario}" in img.SITIOS[sitio]["carpeta"]:
        gato = str(campos.get("santuario") or "")
        if gato not in santuarios():
            raise ValueError("no encuentro ese santuario")
        salida["santuario"] = gato
    return salida


def subir_imagen(peticion):
    sitio = str(peticion.get("sitio") or "")
    if sitio not in img.SITIOS:
        return {"error": "No sé a dónde va esa imagen."}
    try:
        campos = _campos_de_carpeta(sitio, peticion.get("campos"))
    except ValueError as error:
        return {"error": str(error).capitalize() + "."}
    ajustes = img.SITIOS[sitio]
    carpeta = ajustes["carpeta"].format(**campos)
    if sitio == "otra":
        pedida = str(peticion.get("carpeta") or "imagenes").strip().strip("/")
        if not re.fullmatch(r"imagenes(/[\w\-]+)*", pedida):
            return {"error": "La carpeta tiene que estar dentro de imagenes/."}
        carpeta = pedida
    nombre = img.nombre_para(str(peticion.get("nombre") or "imagen"), ajustes["sufijo"])
    ruta = str(peticion.get("ruta") or "").strip()
    temporal = None
    try:
        if not ruta:
            datos = str(peticion.get("datos") or "")
            if "," in datos:
                datos = datos.split(",", 1)[1]
            try:
                crudo = base64.b64decode(datos, validate=True)
            except ValueError:
                return {"error": "La imagen no ha llegado bien."}
            if len(crudo) > 40 * 1024 * 1024:
                return {"error": "Es demasiado grande (más de 40 MB)."}
            temporal = _temporal(crudo, Path(str(peticion.get("archivo") or "imagen.png")).suffix.lower() or ".png")
            ruta = str(temporal)
        hecha, aviso = img.traer(ruta, carpeta, nombre, lado=ajustes["lado"], cuadrada=ajustes["cuadrada"])
    finally:
        if temporal:
            try:
                temporal.unlink()
            except OSError:
                pass
    if not hecha:
        return {"error": "No he podido traerla: " + aviso}
    ancho = alto = 0
    try:
        from PIL import Image
        with Image.open(RAIZ / hecha.lstrip("/")) as im:
            ancho, alto = im.size
    except Exception:
        pass
    return {"ok": True, "ruta": hecha, "aviso": aviso, "ancho": ancho, "alto": alto}


def medidas(ruta):
    """El ancho y el alto de una imagen del sitio (para el width/height)."""
    try:
        archivo = (RAIZ / str(ruta or "").lstrip("/")).resolve()
        archivo.relative_to(RAIZ.resolve())
        from PIL import Image
        with Image.open(archivo) as im:
            return {"ancho": im.size[0], "alto": im.size[1]}
    except Exception:
        return {"ancho": 0, "alto": 0}


def sitios_de_imagen():
    return [{"clave": k, "que": v["que"], "lado": v["lado"], "carpeta": v["carpeta"]}
            for k, v in img.SITIOS.items()]


# =========================================
# LAS FICHAS
# =========================================
# Cada COLECCIÓN es lo que lleva una de las herramientas de 1-publicar: un
# JSON (o un trozo de él) que es una lista de fichas, cada una con sus
# casillas. Las «partes» son las listas de una misma página (la línea de
# tiempo tiene eventos y eras; «en lo que ando», lo de ahora, lo que
# escribo y los pendientes).
#
# Cada casilla: clave (la del JSON), nombre (lo que se lee), tipo:
#   texto · largo (varias líneas) · numero · fecha (dd-mm-aaaa) · si-no ·
#   elegir (de una lista; con «libre», también una nueva) · imagen (se sube
#   y pasa por traer(); «sitio» dice a dónde) · enlace · color · lineas
#   (una lista: una cosa por línea) · ver (solo se enseña)
# y además: obligatorio, ayuda, vacio («quitar»: si se deja en blanco, la
# clave no se escribe, como hacen las herramientas), numerico (un elegir
# que guarda números).
#
# LO QUE NO SE CONOCE SE RESPETA: cada ficha vuelve con lo que tuviera de
# más (token_mini, primera…), y cada archivo con todo lo de fuera de la
# lista. Solo cambia lo que se cambie.

def C(clave, nombre, tipo="texto", **resto):
    return dict(resto, clave=clave, nombre=nombre, tipo=tipo)


def santuarios():
    carpeta = RAIZ / "imagenes" / "santuarios"
    return sorted(c.name for c in carpeta.iterdir() if c.is_dir()) if carpeta.is_dir() else []


def _opciones(lista):
    return [[x, x] for x in lista]


def _paginas_de_la_wiki():
    try:
        sys.path.insert(0, str(PUBLICAR))
        return [a.stem for a in herramienta("nueva-pagina-wiki").paginas_de_la_wiki()]
    except Exception:
        return []


def _sesiones_de(campana):
    return [[s.get("numero"), "Sesión %s%s" % (s.get("numero"), (" — " + s["titulo"]) if s.get("titulo") else "")]
            for s in (campana or {}).get("sesiones") or [] if isinstance(s, dict) and s.get("numero")]


def _campana(clave):
    for archivo, datos in campanas_que_hay():
        if datos.get("clave") == clave:
            return archivo, datos
    return None, None


def colecciones():
    """Las colecciones, con lo que hace falta para pintar sus casillas.
    Las opciones que dependen de lo que haya (las categorías, las sesiones
    de la campaña…) se ponen al leer cada una (opciones_de)."""
    nuevo_personaje_tipos = ["aliado", "aliada", "neutral", "enemigo", "enemiga", "desconocida"]
    estados = ["vivo", "viva", "muerto", "muerta", "desaparecido", "desaparecida", "desconocido"]
    tipos_botin = ["armas", "armaduras", "pociones", "pergaminos", "equipo", "objetos mágicos", "dinero", "otras cosas"]
    escuelas = ["abjuración", "adivinación", "conjuración", "encantamiento", "evocación", "ilusión", "nigromancia",
                "transmutación"]
    # Lo de un pergamino solo sale con el apartado «pergaminos» elegido, y
    # lo de un objeto mágico con «objetos mágicos».
    es_pergamino = {"tipo": ["pergaminos"]}
    es_magico = {"tipo": ["objetos mágicos"]}
    con_descripcion = {"tipo": ["pergaminos", "objetos mágicos"]}
    rarezas = ["común", "poco común", "rara", "muy rara", "legendaria", "artefacto"]
    colores_oc = ["azul", "celeste", "naranja", "verde", "gris", "morado", "rojo", "rosa", "amarillo"]
    # Los sistemas de rol de mis personajes (0-comun/sistemas_rol.py): las
    # pestañas de D&D solo salen con D&D; las de la hoja genérica, con los
    # demás.
    import sistemas_rol
    sistemas_oc = [[k, v["nombre"]] for k, v in sistemas_rol.SISTEMAS.items() if k != "dnd5e"]
    es_dnd = {"sistema": ["", "dnd5e"]}
    no_es_dnd = {"sistema": [k for k, _ in sistemas_oc]}
    monedas = [["po", "po (oro)"], ["pp", "pp (plata)"], ["pc", "pc (cobre)"], ["pe", "pe (electro)"],
               ["ppt", "ppt (platino)"]]
    return [
        {"id": "rol", "apartado": "recursos", "corto": "Las tarjetas de aventuras, fichas y mapas.", "titulo": "Recursos de rol (el portfolio)",
         "ayuda": "Las tarjetas de la página de rol: aventuras, fichas, mapas… Lo último, arriba.",
         "archivo": "datos/mis_movidas/rol.json", "despues": "generadores",
         "partes": [{"id": "fichas", "camino": [], "titulo": "Las fichas", "nombre_de": "title",
                     "detalle": ["subcategory", "date"], "nuevas_arriba": True, "campos": [
                         C("title", "Título", obligatorio=True),
                         C("subcategory", "Categoría", "elegir", libre=True, obligatorio=True,
                           ayuda="Una de las que hay o una nueva (sale su botón en los filtros)."),
                         C("date", "Fecha de publicación", "fecha", obligatorio=True, hoy=True),
                         C("system", "Sistema y jugadores", ayuda="Sale debajo del título: «D&D 5e · 2-5 jugadores»."),
                         C("description", "Descripción", "largo", obligatorio=True),
                         C("image", "Portada", "imagen", sitio="rol"),
                         C("alt", "Descripción de la portada", ayuda="Para quien no la ve."),
                         C("kofi", "Enlace de Ko-fi", "enlace", obligatorio=True),
                         C("drive", "Enlace de Google Drive", "enlace", siempre=True,
                           ayuda="Opcional: sin él, la tarjeta sale con un solo botón."),
                     ]}]},
        {"id": "npcs", "apartado": "campanas", "corto": "La gente de cada campaña, con su token.", "titulo": "Los NPC de una campaña", "por_campana": True,
         "ayuda": "La gente que os vais encontrando: la rejilla de tokens de la página de NPC.",
         "archivo": "datos/notas_rol/npcs-{campana}.json", "despues": "npcs",
         "partes": [{"id": "personajes", "camino": ["personajes"], "titulo": "La gente", "nombre_de": "nombre",
                     "detalle": ["que", "relacion"], "por_grupos": "_grupos", "campos": [
                         C("nombre", "Nombre", obligatorio=True),
                         C("_grupos", "Grupos", "texto",
                           ayuda="De qué grupo es (la caravana, Sirevia…). Si es de varios, separados por comas:"
                                 " su token sale en todos."),
                         C("que", "Qué es", ayuda="Raza, oficio, clase…", siempre=True),
                         C("donde", "Dónde se le conoció o dónde está", siempre=True),
                         C("relacion", "Cómo se lleva con el grupo", "elegir",
                           opciones=_opciones(nuevo_personaje_tipos), libre=True),
                         C("estado", "Cómo está", "elegir", opciones=_opciones(estados), libre=True),
                         C("token", "Token (el redondel)", "imagen", sitio="npc-token", siempre=True),
                         C("ilustracion", "Ilustración (la grande de su ficha)", "imagen", sitio="npc-ficha", siempre=True),
                         C("notas", "Lo que sabemos", "lineas", ayuda="Una cosa por línea.", siempre=True),
                         C("primera", "Sesión en la que salió por primera vez", "elegir", numerico=True, vacio="quitar"),
                     ]}]},
        {"id": "campana", "apartado": "campanas", "corto": "De qué va, el sistema y los de la mesa.", "titulo": "La ficha de una campaña", "por_campana": True,
         "ayuda": "Lo que sale arriba en la página de la campaña: de qué va, el sistema, quién dirige y los"
                  " personajes de la mesa (con su color en las notas). Las misiones van aparte, en «Las"
                  " misiones (el post-it)».",
         "archivo": "datos/notas_rol/campana-{campana}.json", "despues": "generadores",
         "partes": [
             {"id": "datos", "tipo": "objeto", "camino": [], "titulo": "La campaña", "campos": [
                 C("nombre", "Nombre", obligatorio=True, ayuda="«campaña de Ragna»: sale en los títulos."),
                 C("intro", "La entradilla", "largo"),
                 C("sistema", "Sistema", ayuda="«DnD 5.5e»…"),
                 C("director", "Quién dirige"),
                 C("sinopsis", "De qué va", "largo", grande=True)]},
             {"id": "personajes", "camino": ["personajes"], "titulo": "Los personajes de la mesa", "nombre_de": "nombre",
              "detalle": ["clase", "jugador"], "campos": [
                  C("nombre", "Nombre", obligatorio=True),
                  C("jugador", "Quién lo lleva", siempre=True),
                  C("clase", "Raza y clase", siempre=True, ayuda="«Elfo Druida»…"),
                  C("nivel", "Nivel", "numero", minimo=1, maximo=30, siempre=True),
                  C("color", "Su color en las notas", "elegir", obligatorio=True,
                    opciones=[["verde", "verde"], ["azul", "azul"], ["rojo", "rojo"], ["morado", "morado"]],
                    ayuda="Con el que sale su nombre en las notas de las partidas."),
                  C("token", "Token (el redondel)", "imagen", sitio="pj-token", siempre=True),
                  C("ilustracion", "Ilustración (la grande)", "imagen", sitio="pj-ficha", siempre=True),
                  C("equipo", "Lo que lleva encima", "lineas", ayuda="Una cosa por línea.", siempre=True),
                  C("notas", "Notas", "lineas", ayuda="Una cosa por línea.", siempre=True)]},
         ]},
        {"id": "misiones", "apartado": "campanas", "corto": "Lo pendiente y lo ya cerrado.", "titulo": "Las misiones (el post-it)", "por_campana": True,
         "ayuda": "Lo que el grupo tiene a medias y lo que ya se cerró, en toda la campaña: sale en el post-it"
                  " de la página de la campaña (lo pendiente y, plegado, el histórico). El post-it de cada sesión"
                  " es aparte: se escribe en sus notas. Arriba lo pendiente; debajo, el histórico.",
         "archivo": "datos/notas_rol/campana-{campana}.json", "despues": "generadores",
         "partes": [
             {"id": "misiones", "camino": ["misiones"], "titulo": "Las misiones", "por_estado": "estado",
              "agrupada": {"clave": "nombre", "nombre": "nombre", "dentro": "cosas", "libre": True},
              "ayuda": "Cada cosa, en su misión (una que ya hay o una nueva, escribiéndola). Lo acabado no se"
                       " borra: en «Cómo va» se marca completada o fallada, con la sesión en que se cerró, y pasa"
                       " al histórico. Una misión sin nada dentro se quita.",
              "nombre_de": "que", "detalle": ["estado", "de"], "campos": [
                  C("_grupo", "Misión", "elegir", libre=True, obligatorio=True,
                    ayuda="«la Gran Caravana»… Una nueva: escríbela."),
                  C("que", "Qué hay que hacer", obligatorio=True),
                  C("estado", "Cómo va", "elegir", vacio="quitar",
                    opciones=[["", "pendiente"], ["completada", "completada"], ["fallada", "fallada"]]),
                  C("quien", "Quién nos lo pidió", "elegir", libre=True, vacio="quitar",
                    ayuda="Un NPC de la campaña (o escribe otro). Opcional."),
                  C("recompensa", "Recompensa prometida", vacio="quitar",
                    ayuda="Lo que nos darían. Opcional; sale en el post-it mientras está pendiente."),
                  C("de", "Sesión en la que empezó", "elegir", numerico=True, vacio="quitar"),
                  C("hasta", "Sesión en la que se cerró", "elegir", numerico=True, vacio="quitar",
                    ayuda="Al completarla o fallarla."),
                  C("obtenida", "Lo que nos llevamos", vacio="quitar",
                    ayuda="Al cerrarla: la recompensa que hubo de verdad. Vacío: ninguna."),
                  C("_al_botin", "Pasar «Lo que nos llevamos» al botín (o al dinero, si son monedas)", "accion",
                    accion="mision-al-botin", si={"estado": ["completada"]}),
                  C("urgente", "Urgente", "si-no", vacio="quitar",
                    ayuda="Sale arriba de su misión, con su marca."),
                  C("plazo", "Plazo", vacio="quitar", ayuda="«Antes de que la caravana se vaya», «3 días»…"),
                  C("pistas", "Pistas", "lineas", vacio="quitar",
                    ayuda="Lo que sabemos de ella, una cosa por línea. En la web, plegadas debajo.")]},
         ]},
        {"id": "botin", "apartado": "campanas", "corto": "Lo que el grupo va juntando.", "titulo": "El botín de una campaña", "por_campana": True,
         "ayuda": "Lo que el grupo va juntando. Lo gastado se queda en la lista, tachado: «qué tuvimos» es media"
                  " discusión de cada partida. Quitarlo es para lo que no debió apuntarse.",
         "archivo": "datos/notas_rol/campana-{campana}.json", "despues": "buscador",
         "partes": [{"id": "botin", "camino": ["botin"], "titulo": "El botín", "nombre_de": "que",
                     "detalle": ["tipo", "quien"], "campos": [
                         C("que", "Qué es", obligatorio=True,
                           ayuda="«Kits curativos», «Piedra mensajera»… (cuántas, más abajo)."),
                         C("tipo", "Apartado", "elegir", opciones=_opciones(tipos_botin)),
                         C("quien", "Quién lo lleva", "elegir", libre=True, vacio="quitar"),
                         C("de", "De qué sesión", "elegir", numerico=True, vacio="quitar"),
                         C("cantidad", "Cuántas quedan", "numero", minimo=0, vacio="quitar", pasos=True,
                           inicial="inicial",
                           agota="gastado", ayuda="Con − y + se va contando en la partida; al llegar a 0 queda"
                                                  " gastado. Vacío si es una sola cosa."),
                         C("inicial", "Cuántas había", "numero", minimo=0, vacio="quitar",
                           ayuda="Para que en la web salga «4 de 5». Se apunta solo al gastar la primera."),
                         C("gastado", "Gastado", "si-no", vacio="quitar"),
                         C("valor", "Valor (en po, cada una)", "numero", minimo=0, vacio="quitar",
                           ayuda="Lo que sacaríais vendiéndolo: «25», «0,5». Opcional; la web suma el total."),
                         C("imagen", "Foto", "imagen", sitio="botin", vacio="quitar"),
                         C("efecto", "Qué hace (en el juego)", vacio="quitar",
                           ayuda="Lo que cuenta en una tirada: «+1d4 de daño de ácido», «cura 2d4+2», «+1 a la CA»."
                                 " Opcional; sale debajo del nombre, en su recuadro."),
                         C("hechizo", "El hechizo", vacio="quitar", si=es_pergamino,
                           ayuda="Su nombre, y si quieres el original: «Escudo (Shield)»."),
                         C("nivel", "Nivel del hechizo", "numero", minimo=0, maximo=9, vacio="quitar", si=es_pergamino,
                           ayuda="0 para un truco."),
                         C("escuela", "Escuela", "elegir", libre=True, vacio="quitar", si=es_pergamino,
                           opciones=_opciones(escuelas)),
                         C("lanzamiento", "Tiempo de lanzamiento", vacio="quitar", si=es_pergamino,
                           ayuda="«1 acción», «1 reacción, al recibir un ataque»…"),
                         C("alcance", "Alcance", vacio="quitar", si=es_pergamino, ayuda="«Personal», «18 m»…"),
                         C("duracion", "Duración", vacio="quitar", si=es_pergamino,
                           ayuda="«Instantánea», «1 asalto», «Concentración, hasta 1 minuto»…"),
                         C("tirada", "Tirada o CD", vacio="quitar", si=es_pergamino,
                           ayuda="Si pide salvación o ataque: «CD 13 de DES», «+5 al ataque»."),
                         C("rareza", "Rareza", "elegir", libre=True, vacio="quitar", si=es_magico,
                           opciones=_opciones(rarezas)),
                         C("sintonizacion", "Requiere sintonización", "si-no", vacio="quitar", si=es_magico),
                         C("cargas", "Cargas", vacio="quitar", si=es_magico,
                           ayuda="«3», «3; recupera 1d3 al amanecer»…"),
                         C("descripcion", "Qué hace (al desplegarlo en la web)", "largo", vacio="quitar",
                           si=con_descripcion, ayuda="El hechizo o el objeto, entero. Un párrafo por línea."),
                     ]}]},
        {"id": "dinero", "apartado": "campanas", "corto": "Lo que entra y sale, y lo de cada uno.", "titulo": "El dinero de una campaña", "por_campana": True,
         "ayuda": "Lo que entra y lo que sale de la bolsa del grupo, con su concepto y su sesión. La web lo suma por"
                  " monedas, lo pasa a oro y lo enseña en la ventana «el dinero» del índice, con lo que lleva cada"
                  " personaje y un conversor.",
         "archivo": "datos/notas_rol/campana-{campana}.json", "despues": None,
         "partes": [{"id": "movimientos", "camino": ["dinero", "movimientos"], "titulo": "Entradas y gastos",
                     "nombre_de": "que", "detalle": ["sentido", "cantidad", "moneda", "de"], "campos": [
                         C("que", "Concepto", obligatorio=True, ayuda="«Botín de los bandidos», «el carromato»…"),
                         C("sentido", "Entra o sale", "elegir", obligatorio=True,
                           opciones=[["entra", "entra (lo ganamos)"], ["sale", "sale (lo gastamos)"]]),
                         C("cantidad", "Cuánto", "numero", minimo=0, obligatorio=True),
                         C("moneda", "Moneda", "elegir", obligatorio=True, opciones=monedas),
                         C("de", "De qué sesión", "elegir", numerico=True, vacio="quitar"),
                         C("quien", "Quién", "elegir", libre=True, vacio="quitar",
                           ayuda="Quién lo cobró o lo pagó, si importa."),
                         C("reparto", "Cuánto le toca a cada uno", "lineas", vacio="quitar",
                           ayuda="Un personaje por línea con su parte, en la misma moneda: «Mellissa: 20»."
                                 " «Cada uno: 5» es lo mismo para todos. Lo que no se reparte es del grupo."),
                     ]}]},
        {"id": "personajes", "apartado": "personajes", "corto": "Mis OC, aparte de las campañas: ficha, historia, gente e imágenes.", "titulo": "Mis personajes",
         "ayuda": "Mis OC: el índice de redondeles y la ficha de cada uno (historia, npcs, imágenes, extra, la foto con"
                  " sus características y su PDF). Va aparte de las campañas y de la wiki.",
         "archivo": "datos/personajes/personajes.json", "despues": "personajes",
         "partes": [
             {"id": "datos", "tipo": "objeto", "camino": [], "titulo": "La página de mis personajes", "campos": [
                 C("titulo", "Título", ayuda="«mis personajes»: el grande de arriba del índice."),
                 C("intro", "La entradilla", "largo")]},
             {"id": "personajes", "camino": ["personajes"], "titulo": "Los personajes", "nombre_de": "nombre",
              "detalle": ["nombre_completo", "color"],
              # LA FICHA DE CADA UNO, POR PESTAÑAS (fichas.js): arriba, los
              # botones de importar y ver; debajo, una pestaña por cosa, cada
              # una con sus casillas. Las de npcs, fotos y criaturas enseñan
              # las de las otras partes de ese personaje («parte»), para
              # editarlas una a una o añadir. Una casilla que no esté en
              # ninguna pestaña sale en la primera.
              "siempre": ["_dndbeyond", "_previa"],
              # Al elegir un sistema, lo que esté vacío se rellena con lo de
              # su plantilla (fichas.js).
              "plantillas": sistemas_rol.PLANTILLAS,
              "pestanas": [
                  {"id": "datos", "emoji": "📇", "texto": "datos", "campos": [
                      "nombre", "nombre_completo", "clave", "icono", "etiquetas", "color", "sistema", "raza", "clase",
                      "nivel", "lema", "dndbeyond", "ficha"]},
                  {"id": "hoja", "emoji": "🎲", "texto": "hoja", "si": no_es_dnd, "campos": [
                      "tirada", "conceptos", "atributos", "pericias", "recursos", "armas", "poderes", "equipo"]},
                  {"id": "stats", "emoji": "📊", "texto": "stats", "si": es_dnd, "campos": [
                      "fue", "des", "con", "int", "sab", "car", "ca", "pg", "velocidad", "dados_golpe", "competencia",
                      "salvaciones", "habilidades", "sentidos", "defensas"]},
                  {"id": "acciones", "emoji": "⚔️", "texto": "acciones", "si": es_dnd, "campos": ["ataques", "acciones", "combos"]},
                  {"id": "conjuros", "emoji": "✨", "texto": "conjuros", "si": es_dnd, "campos": [
                      "aptitud_magica", "espacios", "conjuros"]},
                  {"id": "inventario", "emoji": "🎒", "texto": "inventario", "si": es_dnd, "campos": ["objetos", "dinero"]},
                  {"id": "rasgos", "emoji": "🧬", "texto": "rasgos y competencias", "si": es_dnd, "campos": ["rasgos", "competencias"]},
                  {"id": "descripciones", "emoji": "📝", "texto": "descripciones", "si": es_dnd, "campos": ["descripciones"]},
                  {"id": "trasfondo", "emoji": "📜", "texto": "trasfondo", "campos": [
                      "trasfondo", "alineamiento", "fe", "edad", "altura", "peso", "ojos", "pelo", "piel",
                      "personalidad", "ideales", "vinculos", "defectos"]},
                  {"id": "textos", "emoji": "📖", "texto": "historia y extra", "campos": ["historia", "extra"]},
                  {"id": "frases", "emoji": "💬", "texto": "frases y música", "campos": ["frases", "musica", "paleta"]},
                  {"id": "fotos", "emoji": "🖼️", "texto": "fotos", "campos": ["token", "retrato", "retrato_alt"],
                   "parte": "imagenes"},
                  {"id": "npcs", "emoji": "👥", "texto": "npcs", "campos": [], "parte": "gente"},
                  {"id": "criaturas", "emoji": "🐾", "texto": "criaturas", "campos": [], "parte": "criaturas"},
                  {"id": "moodboard", "emoji": "📌", "texto": "moodboard", "campos": [], "parte": "moodboard"},
              ],
              "campos": [
                  C("_dndbeyond", "Importar de D&D Beyond", "accion", accion="personaje-dndbeyond", si=es_dnd,
                    ayuda="Rellena su ficha con la de D&D Beyond (el enlace, el número o el JSON), en español. No"
                          " guarda: repásalo y guarda tú."),
                  C("_previa", "Ver cómo queda (sin guardar)", "accion", accion="personaje-previa",
                    ayuda="Abre su ficha en otra pestaña con lo que hay escrito ahora, aunque no esté guardado."),
                  C("nombre", "Nombre", obligatorio=True, ayuda="El corto, el que va en grande en el redondel."),
                  C("nombre_completo", "Nombre completo", siempre=True, ayuda="«Yorel Telvet»: el de la etiqueta."),
                  C("clave", "Su dirección", vacio="quitar",
                    ayuda="El nombre de su carpeta y de su página (yorel). Si lo dejas en blanco, sale del nombre."
                          " Mejor no cambiarlo después: cambiaría su dirección."),
                  C("icono", "Icono", vacio="quitar", ayuda="Un emoji que va delante del nombre completo: ✨, 🐺…"),
                  C("etiquetas", "Etiquetas (para el filtro del índice)", vacio="quitar",
                    ayuda="Separadas por comas: «D&D 5e, jugando, Ragna». Cada una sale como un botón del filtro."),
                  C("color", "Color del aro", "elegir", obligatorio=True, opciones=_opciones(colores_oc)),
                  C("sistema", "Sistema de juego", "elegir", vacio="quitar", ninguno="D&D 5e", opciones=sistemas_oc,
                    ayuda="Con otro que no sea D&D, su ficha es la «hoja» (en vez de stats, acciones, conjuros…), y"
                          " al elegirlo se rellena con lo de ese juego lo que esté vacío."),
                  C("token", "Token de la galería", "imagen", sitio="oc-token", siempre=True,
                    ayuda="El redondel del índice de mis personajes (cuadrado; se recorta solo). Solo sale ahí."),
                  C("retrato", "Imagen de perfil", "imagen", sitio="oc-retrato", siempre=True,
                    ayuda="La del post-it de su ficha (de pie, mejor). Solo sale ahí: no se usa el token."),
                  C("retrato_alt", "Cómo es (para quien no ve la imagen de perfil)", vacio="quitar"),
                  C("raza", "Raza", vacio="quitar", ayuda="En otros sistemas, lo que sea: «Toreador», «Humana»…"),
                  C("clase", "Clase", vacio="quitar", ayuda="En otros sistemas, lo que sea: «Neonata», «Netrunner»…"),
                  C("nivel", "Nivel", "numero", minimo=1, maximo=30, vacio="quitar",
                    ayuda="En Vampiro, su generación; en Cyberpunk RED, su rango (sale en la chapita de la foto)."),
                  C("lema", "Una frase suya", vacio="quitar", ayuda="Sale en el post-it, debajo de la clase."),
              ] + [C(k, n, "numero", minimo=1, maximo=30, vacio="quitar",
                     ayuda="La puntuación (el modificador se calcula solo)." if k == "fue" else "")
                   for k, n in (("fue", "Fuerza"), ("des", "Destreza"), ("con", "Constitución"),
                                ("int", "Inteligencia"), ("sab", "Sabiduría"), ("car", "Carisma"))] + [
                  # LA PESTAÑA «FICHA» (D&D): lo que se calcula (iniciativa,
                  # competencia, salvaciones, habilidades, CD…) sale solo de
                  # las características y el nivel.
                  C("ca", "Clase de armadura (CA)", vacio="quitar"),
                  C("pg", "Puntos de golpe", vacio="quitar", ayuda="«38» o «38 (máx.)»."),
                  C("velocidad", "Velocidad", vacio="quitar", ayuda="«9 m»."),
                  C("dados_golpe", "Dados de golpe", vacio="quitar", ayuda="«5d8»."),
                  C("competencia", "Bonificador de competencia", "numero", minimo=1, maximo=10, vacio="quitar",
                    ayuda="Si lo dejas en blanco, sale del nivel."),
                  C("salvaciones", "Salvaciones en las que es competente", vacio="quitar",
                    ayuda="Separadas por comas: «Destreza, Inteligencia»."),
                  C("habilidades", "Habilidades en las que es competente", "lineas", vacio="quitar",
                    ayuda="Una por línea; «(pericia)» detrás si la tiene doble: «Sigilo (pericia)». Valen: "
                          "Acrobacias, Arcanos, Atletismo, Engaño, Historia, Interpretación, Intimidación, "
                          "Investigación, Juego de manos, Medicina, Naturaleza, Percepción, Perspicacia, "
                          "Persuasión, Religión, Sigilo, Supervivencia y Trato con animales."),
                  C("ataques", "Ataques", "lineas", vacio="quitar",
                    ayuda="Uno por línea: «Espada corta: +6, 1d6+4 perforante». Lo de detrás de un «;» sale"
                          " en la columna «extra»: «Aliento: CD 13, 2d6 fuego; salvación de Destreza»."),
                  C("aptitud_magica", "Aptitud mágica", "elegir", vacio="quitar",
                    opciones=[["fue", "Fuerza"], ["des", "Destreza"], ["con", "Constitución"],
                              ["int", "Inteligencia"], ["sab", "Sabiduría"], ["car", "Carisma"]],
                    ayuda="Con qué lanza conjuros (la CD y el ataque de conjuro se calculan solos)."),
                  C("espacios", "Espacios de conjuro", "lineas", vacio="quitar",
                    ayuda="Uno por línea: «1.º: 4», «2.º: 2»."),
                  C("conjuros", "Conjuros", "lineas", vacio="quitar",
                    ayuda="Uno por línea, con su nivel delante: «Truco: Luz», «1: Escudo». Salen por niveles."),
                  C("objetos", "Objetos", "lineas", vacio="quitar",
                    ayuda="Uno por línea: «Antorcha ×5». Detrás, entre corchetes, si lo lleva puesto o es mágico:"
                          " «Espada larga [equipado]», «Anillo de protección [mágico, equipado]». En la ficha se"
                          " reparten en puesto, mágico y mochila, y dentro por tipo (armas, pociones…)."),
                  C("dinero", "Dinero", vacio="quitar", ayuda="«15 po, 4 pp»."),
                  C("competencias", "Competencias e idiomas", "lineas", vacio="quitar",
                    ayuda="Uno por línea: armas, armaduras, herramientas, idiomas…"),
                  C("rasgos", "Rasgos y dotes", "largo", vacio="quitar", markdown=True,
                    ayuda="Los de su raza, su clase y sus dotes, en lista: «- **Nombre** (Hechicero, nivel 3)»"
                          " (lo de entre paréntesis, de dónde le viene) o «- **Nombre.** Lo que hace.». Así cada"
                          " uno sale desplegable (con su texto de «Descripciones», si lo tiene)."),
                  C("sentidos", "Sentidos", vacio="quitar", ayuda="«Visión en la oscuridad 18 m». Las pasivas se calculan."),
                  C("defensas", "Defensas", "lineas", vacio="quitar",
                    ayuda="Una por línea: «Resistencia: fuego», «Inmunidad: veneno», «Ventaja contra ser hechizado»."),
                  C("acciones", "Acciones", "lineas", vacio="quitar",
                    ayuda="Una por línea, con su tipo delante: «Acción adicional: Acción astuta», «Reacción: …»."
                          " Lo que se gasta, con sus usos y cómo se recarga detrás: «Acción adicional: Forma"
                          " salvaje (2 usos, descanso largo)» (sale una casilla por uso)."),
                  C("combos", "Combos (para el combate)", "largo", grande=True, vacio="quitar",
                    ayuda="Un bloque por combo: «## Fuego y escudo» y debajo, uno por línea, lo que hace con lo"
                          " que gasta delante: «Acción: Bola de fuego», «Acción adicional: Forma salvaje»,"
                          " «Reacción: Escudo», «Movimiento: …», «Gratis: …», y «Notas: …». Los ataques salen con"
                          " sus tiradas y los conjuros se abren en su carta (escríbelos como en sus listas)."),
                  C("descripciones", "Descripciones (lo que sale al desplegar)", "largo", grande=True,
                    vacio="quitar", markdown=True,
                    ayuda="Lo que cuenta cada conjuro, objeto, rasgo o acción está en el compendio (Rol →"
                          " «Compendio: …»), compartido por todas las fichas. Aquí, de cada uno, un bloque que"
                          " empieza con ## y su nombre, igual que en su lista, y debajo «Tipo:» (conjuros,"
                          " objetos, rasgos o acciones) y «Origen:» (de dónde le viene: «Hechicero, nivel 3»,"
                          " «Dote»). Si debajo escribes «Datos:» o un texto, ese manda solo para este personaje."
                          " El importador de D&D Beyond lo rellena y añade al compendio lo que falte."),
                  C("trasfondo", "Trasfondo", vacio="quitar", ayuda="«Criminal», «Sabio»…"),
                  C("alineamiento", "Alineamiento", "elegir", libre=True, vacio="quitar",
                    opciones=_opciones(["Legal bueno", "Neutral bueno", "Caótico bueno", "Legal neutral", "Neutral",
                                        "Caótico neutral", "Legal malvado", "Neutral malvado", "Caótico malvado"])),
                  C("fe", "Fe", vacio="quitar", ayuda="A quién reza, si reza."),
                  C("edad", "Edad", vacio="quitar"),
                  C("altura", "Altura", vacio="quitar"),
                  C("peso", "Peso", vacio="quitar"),
                  C("ojos", "Ojos", vacio="quitar"),
                  C("pelo", "Pelo", vacio="quitar"),
                  C("piel", "Piel", vacio="quitar"),
                  C("personalidad", "Rasgos de personalidad", "largo", vacio="quitar", markdown=True),
                  C("ideales", "Ideales", "largo", vacio="quitar", markdown=True),
                  C("vinculos", "Vínculos", "largo", vacio="quitar", markdown=True),
                  C("defectos", "Defectos", "largo", vacio="quitar", markdown=True),
                  C("dndbeyond", "Su ficha en D&D Beyond (el enlace)", vacio="quitar",
                    ayuda="«https://www.dndbeyond.com/characters/12345678»: sale el botón «ficha dndbeyond»"
                          " debajo de su foto. Al importar de D&D Beyond se pone solo."),
                  C("ficha", "La ficha en PDF", "pdf", vacio="quitar",
                    ayuda="Se guarda en su carpeta y sale el botón «pdf» debajo de su foto."),
                  C("historia", "Historia", "largo", grande=True, vacio="quitar", markdown=True, imagenes="oc-imagen",
                    ayuda="Con formato: **negrita**, ## apartados, > citas, [[Otro personaje]] enlaza con su ficha."),
                  C("extra", "Extra", "largo", grande=True, vacio="quitar", markdown=True, imagenes="oc-imagen",
                    ayuda="Lo que no es historia: manías, curiosidades, canciones…"),
                  # LA HOJA DE OTROS SISTEMAS (0-comun/sistemas_rol.py).
                  C("tirada", "Con qué se tira", vacio="quitar", si={"sistema": ["generico"]},
                    ayuda="«1d20», «2d6», «1d100»: a eso se suma el atributo o la habilidad al pulsarlos."),
                  C("conceptos", "Lo que le define", "lineas", vacio="quitar",
                    ayuda="Uno por línea, «Etiqueta: texto»: «Clan: Toreador», «Concepto principal: …» (en Fate,"
                          " sus aspectos), «Rol: Netrunner»."),
                  C("atributos", "Atributos", "lineas", vacio="quitar",
                    ayuda="Uno por línea, «Nombre: valor» («Fuerza: 3»). «## Físicos» encima de unos los agrupa."),
                  C("pericias", "Habilidades", "lineas", vacio="quitar",
                    ayuda="Igual: «Pelea: 2». Con un atributo entre paréntesis, la tirada suma los dos: «Pelea"
                          " (DES): 2». Lo de detrás del número es una nota: «Persuasión: 3 (seducción)»."),
                  C("recursos", "Recursos (lo que se gasta)", "lineas", vacio="quitar",
                    ayuda="Uno por línea: «Salud: 0/7» son 7 casillas que se marcan jugando (0 marcadas de"
                          " inicio); «Recuperación: 3», un número; «Consecuencia leve (2): …», un texto."),
                  C("armas", "Armas", "lineas", vacio="quitar",
                    ayuda="Una por línea: «Pistola pesada: 3d6; CdF 2» (el daño se tira; lo de detrás del «;», aparte)."),
                  C("poderes", "Poderes (disciplinas, proezas, ciberware…)", "largo", grande=True, vacio="quitar",
                    markdown=True, ayuda="Con formato; cada «## Apartado» sale en su ventanita."),
                  C("equipo", "Equipo", "lineas", vacio="quitar", ayuda="Un objeto por línea."),
                  # SUS FRASES, SU MÚSICA Y SU PALETA (para todos).
                  C("frases", "Frases suyas", "lineas", vacio="quitar",
                    ayuda="Una por línea; detrás de un «|», cuándo la dijo: «No me mires así. | En la sesión 3»."),
                  C("musica", "Su música (de Spotify)", "lineas", vacio="quitar",
                    ayuda="Un enlace de Spotify por línea (canción, disco o lista: «Compartir → Copiar enlace»)."
                          " Delante, con «|», el título y detrás una nota: «Su tema | https://open.spotify.com/… |"
                          " cuando entra en escena». Si no pones título, al guardar se pone el de Spotify."),
                  C("paleta", "Su paleta de colores", "lineas", vacio="quitar",
                    ayuda="Un color por línea, en hexadecimal y su nombre: «#5b0a1a Sangre seca»."),
              ]},
             {"id": "gente", "camino": ["gente"], "dentro_de": "personajes", "titulo": "Su gente (la pestaña npcs)",
              "agrupada": {"clave": "personaje", "nombre": "personaje", "dentro": "cosas", "libre": True},
              "nombre_de": "nombre", "detalle": ["que", "relacion"], "campos": [
                  C("_grupo", "De quién", "elegir", obligatorio=True,
                    ayuda="El personaje en cuya ficha sale (tiene que estar guardado ya)."),
                  C("nombre", "Nombre", obligatorio=True),
                  C("que", "Quién es", vacio="quitar", ayuda="«Su hermana», «su maestro»…"),
                  C("vinculo", "Vínculo", "elegir", libre=True, vacio="quitar",
                    opciones=_opciones(["Familia", "Pareja", "Amistad", "Aliado", "Mentor", "Rival", "Enemigo",
                                        "Contacto"]),
                    ayuda="En la pestaña npcs se agrupan por él."),
                  C("parentesco", "Parentesco (para el árbol familiar)", "elegir", libre=True, vacio="quitar",
                    opciones=_opciones(["Madre", "Padre", "Hermana", "Hermano", "Abuela", "Abuelo", "Tía", "Tío",
                                        "Prima", "Primo", "Pareja", "Hija", "Hijo", "Sobrina", "Sobrino", "Nieta",
                                        "Nieto", "Bisabuela", "Bisabuelo"]),
                    ayuda="Con él sale en el árbol, en la fila de su generación (abuelos, padres y tíos, la suya,"
                          " hijos y sobrinos…)."),
                  C("estado", "Estado", "elegir", libre=True, vacio="quitar",
                    opciones=_opciones(["Fallecida", "Fallecido", "Desaparecida", "Desaparecido"]),
                    ayuda="Si ha muerto, en el árbol sale con † y la foto en gris."),
                  C("oc", "Es uno de mis personajes", "elegir", vacio="quitar",
                    ayuda="Su nombre enlaza con su ficha (y si no le pones foto, lleva su token)."),
                  C("relacion", "Cómo se llevan", vacio="quitar"),
                  C("token", "Foto (el redondel)", "imagen", sitio="oc-npc", vacio="quitar"),
                  C("notas", "Lo que hay que saber", "largo", vacio="quitar", markdown=True),
              ]},
             {"id": "criaturas", "camino": ["criaturas"], "dentro_de": "personajes",
              "titulo": "Sus criaturas (familiares, invocaciones, mascotas: la pestaña criaturas)",
              "agrupada": {"clave": "personaje", "nombre": "personaje", "dentro": "cosas", "libre": True},
              "nombre_de": "nombre", "detalle": ["que"], "campos": [
                  C("_grupo", "De quién", "elegir", obligatorio=True,
                    ayuda="El personaje en cuya ficha sale (tiene que estar guardado ya)."),
                  C("nombre", "Nombre", obligatorio=True),
                  C("que", "Qué es", vacio="quitar", ayuda="«Familiar · polilla feérica», «Compañero animal»…"),
                  C("tipo", "Tamaño, tipo y alineamiento", vacio="quitar", ayuda="«Feérica diminuta, sin alineamiento»."),
                  C("imagen", "Imagen", "imagen", sitio="oc-criatura", vacio="quitar"),
                  C("imagen_alt", "Qué se ve en la imagen", vacio="quitar"),
                  C("ca", "Clase de armadura (CA)", vacio="quitar"),
                  C("pg", "Puntos de golpe", vacio="quitar", ayuda="«1 (1d4 − 1)»."),
                  C("velocidad", "Velocidad", vacio="quitar", ayuda="«1,5 m, volar 9 m»."),
              ] + [C(k, n, "numero", minimo=1, maximo=30, vacio="quitar")
                   for k, n in (("fue", "Fuerza"), ("des", "Destreza"), ("con", "Constitución"),
                                ("int", "Inteligencia"), ("sab", "Sabiduría"), ("car", "Carisma"))] + [
                  C("salvaciones", "Salvaciones", vacio="quitar", ayuda="«Destreza +4, Sabiduría +3» (cada bono se tira)."),
                  C("habilidades", "Habilidades", vacio="quitar", ayuda="«Percepción +3, Sigilo +4» (cada bono se tira)."),
                  C("sentidos", "Sentidos", vacio="quitar", ayuda="«Vista ciega 18 m». La percepción pasiva se calcula."),
                  C("idiomas", "Idiomas", vacio="quitar"),
                  C("desafio", "Desafío", vacio="quitar", ayuda="«0 (10 PX)»."),
                  C("competencia", "Bonificador de competencia", "numero", minimo=1, maximo=10, vacio="quitar"),
                  C("rasgos", "Rasgos", "largo", vacio="quitar", markdown=True,
                    ayuda="Con formato: **Nombre.** Lo que hace. Los dados del texto se tiran al pulsarlos."),
                  C("acciones", "Acciones", "lineas", vacio="quitar",
                    ayuda="Como los ataques, una por línea: «Mordisco: +4, 1 perforante; alcance 1,5 m»."),
                  C("notas", "Lo que hay que saber", "largo", vacio="quitar", markdown=True),
              ]},
             {"id": "moodboard", "camino": ["moodboard"], "dentro_de": "personajes",
              "titulo": "Su moodboard (en la pestaña inspiración)",
              "agrupada": {"clave": "personaje", "nombre": "personaje", "dentro": "cosas", "libre": True},
              "nombre_de": "alt", "detalle": ["texto"], "campos": [
                  C("_grupo", "De quién", "elegir", obligatorio=True),
                  C("imagen", "Imagen", "imagen", sitio="oc-moodboard", vacio="quitar"),
                  C("alt", "Qué se ve", vacio="quitar", ayuda="Para quien no la ve."),
                  C("texto", "O una palabra o una frase (en vez de imagen)", vacio="quitar",
                    ayuda="Sale en una tarjetita pegada entre las fotos."),
              ]},
             {"id": "imagenes", "camino": ["imagenes"], "dentro_de": "personajes",
              "titulo": "Sus imágenes (la pestaña imágenes)",
              "agrupada": {"clave": "personaje", "nombre": "personaje", "dentro": "cosas", "libre": True},
              "nombre_de": "alt", "detalle": ["pie"], "campos": [
                  C("_grupo", "De quién", "elegir", obligatorio=True),
                  C("imagen", "Imagen", "imagen", sitio="oc-imagen", obligatorio=True),
                  C("alt", "Qué se ve", obligatorio=True, ayuda="Para quien no la ve."),
                  C("pie", "Pie de foto", vacio="quitar"),
              ]},
         ]},
    ] + [
        # EL COMPENDIO (0-comun/compendio.py): cada conjuro, objeto, rasgo y
        # acción, una vez para todos mis personajes. Lo que cambies aquí
        # cambia en todas las fichas que lo tengan.
        {"id": "compendio-" + tipo, "apartado": "personajes", "titulo": "Compendio: " + tipo,
         "corto": "%s %s de todas las fichas: %s una vez y cambian en todas." % (
             art.capitalize(), tipo, "cámbialas" if art == "las" else "cámbialos"),
         "ayuda": "Lo que sale al desplegar cada uno de los %s en las fichas de mis personajes (el nombre tiene"
                  " que ser igual que en su lista; no mira mayúsculas ni tildes). Si a un personaje le quieres"
                  " poner otro texto solo a él, escríbelo en su pestaña «descripciones»." % tipo,
         "archivo": "datos/personajes/compendio/%s.json" % tipo, "despues": "personajes",
         "partes": [{"id": tipo, "camino": [tipo], "titulo": art.capitalize() + " " + tipo, "nombre_de": "nombre",
                     "detalle": ["datos"], "campos": [
                         C("nombre", "Nombre", obligatorio=True),
                         C("datos", "Datos (las pastillitas)", vacio="quitar",
                           ayuda="Separados por «·»: «Nivel 3 · Evocación · 1 acción · 45 m»."),
                         C("texto", "Lo que hace", "largo", grande=True, markdown=True, vacio="quitar"),
                     ]}]}
        for tipo, art in (("conjuros", "los"), ("objetos", "los"), ("rasgos", "los"), ("acciones", "las"))
    ] + [
        {"id": "recomendaciones", "apartado": "rincon", "corto": "Libros, series, pelis y juegos.", "titulo": "Recomendaciones",
         "ayuda": "Libros, series, pelis, juegos… las ventanitas de la página de recomendaciones.",
         "archivo": "datos/mi_rincon/recomendaciones.json", "despues": None,
         "partes": [{"id": "cosas", "camino": [], "agrupada": {"clave": "clave", "nombre": "nombre", "dentro": "cosas"},
                     "titulo": "Lo recomendado", "nombre_de": "titulo", "detalle": ["autor", "anyo"], "campos": [
                         C("_grupo", "Categoría", "elegir", obligatorio=True),
                         C("titulo", "Título", obligatorio=True),
                         C("autor", "De quién es"),
                         C("anyo", "Año"),
                         C("texto", "Lo que cuentas", "largo"),
                         C("imprescindible", "Imprescindible", "si-no"),
                         C("imagen", "Portada", "imagen", sitio="recomendaciones"),
                         C("alt", "Descripción de la portada"),
                         C("enlace", "Enlace", "enlace"),
                         C("enlaceTexto", "Texto del enlace", ayuda="«Enlace a Goodreads»…"),
                     ]}]},
        {"id": "en-lo-que-ando", "apartado": "rincon", "corto": "Lo de ahora, lo que escribo y los pendientes.", "titulo": "En lo que ando",
         "ayuda": "Lo que pone la página «en lo que ando». La fecha de «actualizado» se pone sola al guardar.",
         "archivo": "datos/mi_rincon/en-lo-que-ando.json", "herramienta": "en-lo-que-ando", "despues": "buscador",
         "partes": [
             {"id": "intro", "tipo": "objeto", "camino": [], "titulo": "La entradilla", "campos": [
                 C("intro", "Lo que sale arriba", "largo")]},
             {"id": "ahora", "camino": ["ahora"], "titulo": "Ahora mismo", "fijas": True, "nombre_de": "que",
              "detalle": ["titulo"], "campos": [
                  C("que", "Qué", "ver"), C("titulo", "Título", ayuda="Vacío: ese hueco no sale."),
                  C("de", "De quién es"),
                  C("porcentaje", "Por dónde vas (%)", "numero", minimo=0, maximo=100,
                    ayuda="Vacío: sin barra.", vacio="nulo"),
                  C("nota", "Una nota"), C("enlace", "Enlace", "enlace")]},
             {"id": "escribiendo", "camino": ["escribiendo"], "titulo": "Lo que ando escribiendo",
              "nombre_de": "titulo", "detalle": ["tipo", "estado"], "campos": [
                  C("titulo", "Título", obligatorio=True), C("tipo", "Qué es", ayuda="«reto de escritura», «novela»…"),
                  C("estado", "Cómo va", ayuda="«2 días de 31», «primer borrador»…"), C("nota", "Una nota", "largo"),
                  C("enlace", "Enlace", "enlace")]},
             {"id": "pendientes", "camino": ["pendientes"], "titulo": "Pendientes (el post-it)", "nombre_de": "cosa",
              "detalle": [], "campos": [C("cosa", "Qué", obligatorio=True), C("hecho", "Hecho", "si-no")]},
         ]},
        {"id": "gatos", "apartado": "rincon", "corto": "Subir fotos y describirlas.", "titulo": "Las fotos de los gatos",
         "ayuda": "La galería de cada santuario. Las fotos nuevas se suben aquí abajo; a cada una, su descripción"
                  " (lo que se lee en voz alta quien no la ve).",
         "archivo": "datos/mi_rincon/fotos-santuarios.json", "despues": None, "gatos": True,
         "partes": [{"id": "fotos", "camino": [], "agrupada": {"tipo": "diccionario"}, "fijas": True,
                     "titulo": "Las fotos", "nombre_de": "alt", "detalle": ["archivo"], "campos": [
                         C("_grupo", "De quién", "ver"), C("archivo", "La foto", "ver", foto=True),
                         C("alt", "Descripción", "largo")]}]},
        {"id": "reto", "apartado": "escribir", "corto": "Una palabra para cada día.", "titulo": "Las palabras del reto",
         "ayuda": "Una palabra para cada día. Lo escrito de cada día se abre desde «Escribir».",
         "archivo": "datos/mis_movidas/reto-writeober26.json", "despues": "generadores",
         "partes": [
             {"id": "reto", "tipo": "objeto", "camino": [], "titulo": "El reto", "campos": [
                 C("nombre", "Nombre"), C("intro", "De qué va", "largo")]},
             {"id": "dias", "camino": ["dias"], "titulo": "Los días", "fijas": True, "nombre_de": "palabra",
              "detalle": ["dia", "fecha"], "campos": [
                  C("dia", "Día", "ver"), C("fecha", "Fecha", "fecha"), C("palabra", "Palabra"),
                  C("titulo", "Título de lo escrito", "ver"), C("url", "Dónde está", "ver")]},
         ]},
        {"id": "calendario", "apartado": "wiki", "corto": "Festividades y eventos de Cralëa.", "titulo": "El calendario de la wiki",
         "ayuda": "Las festividades y los eventos que salen marcados en el calendario de la portada de la wiki.",
         "archivo": "datos/wiki/calendario.json", "herramienta": "calendario", "despues": None,
         "partes": [
             {"id": "hoy", "tipo": "objeto", "camino": ["hoy"], "titulo": "El día de hoy en Cralëa",
              "ayuda": "Se marca, y el calendario abre en su mes. Vacío: ninguno.", "campos": [
                  C("mes", "Mes", "elegir", numerico=True, vacio="quitar"),
                  C("dia", "Día", "numero", minimo=1, maximo=28, vacio="quitar")]},
             {"id": "eventos", "camino": ["eventos"], "titulo": "Lo marcado", "nombre_de": "nombre",
              "detalle": ["mes", "dia"], "campos": [
                  C("nombre", "Nombre", obligatorio=True),
                  C("tipo", "Qué es", "elegir", opciones=[["festividad", "festividad (se repite cada año)"],
                                                          ["evento", "evento (pasó o pasará una vez)"]]),
                  C("mes", "Mes", "elegir", numerico=True, obligatorio=True),
                  C("dia", "Día", "numero", minimo=1, maximo=28, obligatorio=True,
                    ayuda="De 1 a 28; en el Fin del Ciclo, de 1 a 4."),
                  C("anyo", "Año", vacio="quitar", ayuda="Si pasó un año concreto, como se lea: «1340 DEM»."),
                  C("resumen", "Resumen", "largo"),
                  C("enlace", "Enlace", vacio="quitar",
                    ayuda="Una página de la wiki: su nombre entre corchetes ([[La Gran Sequía]]) o /web/wiki/…"),
              ]},
         ]},
        {"id": "linea", "apartado": "wiki", "corto": "Los eventos y las eras.", "titulo": "La línea de tiempo",
         "ayuda": "Los eventos (cada uno con su página) y las eras. Se ordenan solos por el año.",
         "archivo": "datos/wiki/linea-de-tiempo.json", "herramienta": "linea-de-tiempo", "despues": "linea",
         "partes": [
             {"id": "ajustes", "tipo": "objeto", "camino": [], "titulo": "La página", "campos": [
                 C("titulo", "Título"), C("intro", "Entradilla", "largo"),
                 C("hoy", "El año de hoy", ayuda="Como se lea: «1340 DEM».")]},
             {"id": "eventos", "camino": ["eventos"], "titulo": "Los eventos", "nombre_de": "nombre",
              "detalle": ["fecha"], "campos": [
                  C("nombre", "Nombre", obligatorio=True,
                    ayuda="Es también cómo se le enlaza desde la wiki: [[así]]."),
                  C("fecha", "Año", obligatorio=True, anyo=True,
                    ayuda="Un número (negativo antes del año 0) o como se escriba: «800.000.000 AEM»."),
                  C("hasta", "Hasta", anyo=True, vacio="quitar", ayuda="Si dura varios años."),
                  C("fecha_texto", "Cómo se lee el año", vacio="quitar",
                    ayuda="Si se dice de otra manera: «hace mucho»."),
                  C("resumen", "Resumen", "largo", maximo_letras=180,
                    ayuda="Para la tarjeta de la línea: mejor por debajo de 180 letras."),
                  C("texto", "Su página", "largo", grande=True, vacio="quitar", markdown=True, imagenes="evento",
                    ayuda="En el mismo formato que la wiki: **negrita**, listas, [[enlaces]]. Los botones de"
                          " encima lo ponen. Con dos títulos o más sale el «Contenido» a un lado."),
                  C("imagen", "Imagen", "imagen", sitio="evento", vacio="quitar"),
              ]},
             {"id": "eras", "camino": ["eras"], "titulo": "Las eras", "nombre_de": "nombre", "detalle": ["desde"],
              "campos": [
                  C("nombre", "Nombre", obligatorio=True),
                  C("desde", "Desde", obligatorio=True, anyo=True),
                  C("hasta", "Hasta", anyo=True, vacio="quitar",
                    ayuda="Si no, dura hasta que empieza la siguiente."),
                  C("resumen", "Resumen", "largo", vacio="quitar"),
                  C("color", "Color", "color", vacio="quitar"),
              ]},
         ]},
        {"id": "diccionario", "apartado": "wiki", "corto": "Las palabras de las lenguas del mundo.", "titulo": "El diccionario",
         "ayuda": "Las palabras de las lenguas del mundo (y del generador de nombres).",
         "archivo": "datos/wiki/diccionario.json", "herramienta": "diccionario", "despues": "mundo",
         "partes": [{"id": "palabras", "camino": ["palabras"], "titulo": "Las palabras", "nombre_de": "palabra",
                     "detalle": ["idioma", "significado"], "campos": [
                         C("palabra", "Palabra", obligatorio=True),
                         C("idioma", "Idioma", "elegir", libre=True, obligatorio=True,
                           ayuda="El nombre de la página del idioma, si la tiene."),
                         C("significado", "Significado", obligatorio=True),
                         C("notas", "Notas", ayuda="De dónde viene, cómo se pronuncia…"),
                         C("pagina", "Página de la wiki", "elegir", libre=True,
                           ayuda="Una página donde se explica (opcional)."),
                     ]}]},
    ]


def coleccion(ident):
    return next((c for c in colecciones() if c["id"] == ident), None)


def _archivo_de(col, clave):
    if col.get("por_campana"):
        if clave not in {d.get("clave") for _, d in campanas_que_hay()}:
            raise ValueError("no encuentro esa campaña")
    return RAIZ / col["archivo"].format(campana=clave or "")


def _cargar_datos(col, archivo):
    if col.get("herramienta"):
        datos = _sin_salir(herramienta(col["herramienta"]).cargar)
        if col["id"] == "linea":
            # Para entender los años con su calendario («800.000.000 AEM»).
            herramienta("linea-de-tiempo").mundo_linea.poner_calendario(datos.get("calendario"))
        return datos
    return leer_json(archivo, None)


def _guardar_datos(col, archivo, datos):
    if col.get("herramienta"):
        _sin_salir(herramienta(col["herramienta"]).guardar, datos)
    else:
        escribir_json(archivo, datos)


def _ir(datos, camino, crear=False):
    for n, paso_ in enumerate(camino):
        if not isinstance(datos, dict):
            return None
        if paso_ not in datos and crear:
            # Lo de en medio de un camino (["dinero", "movimientos"]) es un
            # diccionario; lo del final, una lista.
            datos[paso_] = {} if paso_ == "hoy" or n < len(camino) - 1 else []
        datos = datos.get(paso_)
    return datos


def _grupos_npc(ficha):
    crudo = ficha.get("categorias", ficha.get("categoria"))
    lista = crudo if isinstance(crudo, list) else [crudo]
    return ", ".join(str(c).strip() for c in lista if str(c or "").strip())


def _ficha_para_editar(campos, ficha):
    salida = {}
    for campo in campos:
        clave = campo["clave"]
        if clave == "_grupos":
            salida[clave] = _grupos_npc(ficha)
        elif clave.startswith("_"):
            continue
        else:
            valor = ficha.get(clave)
            if campo["tipo"] == "lineas":
                valor = "\n".join(str(x) for x in valor) if isinstance(valor, list) else str(valor or "")
            salida[clave] = valor
    return salida


def opciones_de(col, clave_campana, datos):
    """Las opciones que dependen de lo que hay, por casilla."""
    salida = {}
    _, campana = _campana(clave_campana) if clave_campana else (None, None)
    if col["id"] == "rol":
        nuevo = herramienta("nuevo")
        texto = leer_texto(nuevo.ROL)[0] if nuevo.ROL.is_file() else ""
        salida["subcategory"] = _opciones(nuevo.categorias_de_rol(texto, datos if isinstance(datos, list) else []))
    if col["id"] == "npcs":
        salida["primera"] = _sesiones_de(campana)
        # Los grupos, en el orden de los apartados de la página de NPC (y
        # detrás, los que no estén en ninguno): para el filtro de la lista.
        orden = []
        for apartado in (datos or {}).get("apartados") or []:
            for cat in (apartado or {}).get("categorias") or []:
                if cat not in orden:
                    orden.append(cat)
        for ficha in (datos or {}).get("personajes") or []:
            for cat in [g.strip() for g in _grupos_npc(ficha).split(",") if g.strip()]:
                if cat not in orden:
                    orden.append(cat)
        salida["_grupos"] = _opciones(orden)
    if col["id"] == "misiones":
        salida["de"] = _sesiones_de(campana)
        salida["hasta"] = _sesiones_de(campana)
        clave = (campana or {}).get("clave") or clave_campana
        npcs = []
        try:
            npcs = json.loads((RAIZ / "datos" / "notas_rol" / ("npcs-%s.json" % clave)).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            pass
        salida["quien"] = _opciones([p.get("nombre", "") for p in (npcs or {}).get("personajes") or []
                                     if isinstance(p, dict) and p.get("nombre")])
        salida["_grupo"] = _opciones([m.get("nombre", "") for m in (datos or {}).get("misiones") or []
                                      if isinstance(m, dict) and m.get("nombre")])
    if col["id"] == "dinero":
        salida["de"] = _sesiones_de(campana)
        salida["quien"] = _opciones([p.get("nombre", "") for p in (campana or {}).get("personajes") or []
                                     if isinstance(p, dict)] + ["el grupo"])
    if col["id"] == "botin":
        salida["de"] = _sesiones_de(campana)
        salida["quien"] = _opciones([p.get("nombre", "") for p in (campana or {}).get("personajes") or []
                                     if isinstance(p, dict)] + ["el carro"])
    if col["id"] == "personajes":
        salida["_grupo"] = [[_clave_oc(p), str(p.get("nombre") or _clave_oc(p))]
                            for p in (datos or {}).get("personajes") or [] if isinstance(p, dict) and _clave_oc(p)]
        salida["oc"] = salida["_grupo"]
    if col["id"] == "recomendaciones":
        salida["_grupo"] = [[g.get("clave"), g.get("nombre")] for g in datos or [] if isinstance(g, dict)]
    if col["id"] == "calendario":
        meses = [[i + 1, m.get("nombre") or "Mes %d" % (i + 1)] for i, m in enumerate(datos.get("meses") or [])]
        if datos.get("fin"):
            meses.append([len(meses) + 1, (datos["fin"] or {}).get("nombre") or "Fin del Ciclo"])
        salida["mes"] = meses
    if col["id"] == "diccionario":
        salida["idioma"] = _opciones(sorted({str(p.get("idioma") or "") for p in datos.get("palabras") or []} - {""}))
        salida["pagina"] = _opciones(_paginas_de_la_wiki())
    return salida


def leer_coleccion(ident, clave_campana=""):
    col = coleccion(ident)
    if not col:
        return {"error": "No sé qué es eso."}
    try:
        archivo = _archivo_de(col, clave_campana)
    except ValueError as error:
        return {"error": str(error).capitalize() + "."}
    datos = _cargar_datos(col, archivo)
    if datos is None:
        return {"error": "No encuentro %s." % archivo.relative_to(RAIZ).as_posix()}
    partes = {}
    for parte in col["partes"]:
        dentro = _ir(datos, parte["camino"])
        if parte.get("tipo") == "objeto":
            partes[parte["id"]] = _ficha_para_editar(parte["campos"], dentro if isinstance(dentro, dict) else {})
            continue
        fichas = []
        agrupada = parte.get("agrupada")
        if agrupada and agrupada.get("tipo") == "diccionario":
            for grupo, lista in (dentro or {}).items():
                for i, ficha in enumerate(lista if isinstance(lista, list) else []):
                    if isinstance(ficha, dict):
                        fichas.append(dict(_ficha_para_editar(parte["campos"], ficha), _grupo=grupo, _g=grupo, _i=i,
                                           _foto="/imagenes/santuarios/%s/%s" % (grupo, ficha.get("mini") or ficha.get("archivo", ""))))
        elif agrupada:
            for grupo in dentro or []:
                if not isinstance(grupo, dict):
                    continue
                for i, ficha in enumerate(grupo.get(agrupada["dentro"]) or []):
                    if isinstance(ficha, dict):
                        clave = grupo.get(agrupada["clave"])
                        fichas.append(dict(_ficha_para_editar(parte["campos"], ficha), _grupo=clave, _g=clave, _i=i))
        else:
            for i, ficha in enumerate(dentro if isinstance(dentro, list) else []):
                if isinstance(ficha, dict):
                    fichas.append(dict(_ficha_para_editar(parte["campos"], ficha), _i=i))
        partes[parte["id"]] = fichas
    return {"id": ident, "titulo": col["titulo"], "ayuda": col.get("ayuda", ""), "campana": clave_campana,
            "partes_def": col["partes"], "opciones": opciones_de(col, clave_campana, datos), "partes": partes,
            "archivo": archivo.relative_to(RAIZ).as_posix(), "despues": col.get("despues"),
            "santuarios": santuarios() if col.get("gatos") else None,
            "por_campana": bool(col.get("por_campana"))}


def _valor(campo, crudo, ficha_nombre):
    """El valor de una casilla tal y como va al JSON (o QUITAR)."""
    tipo = campo["tipo"]
    donde = "«%s»%s" % (campo["nombre"], (" de «%s»" % ficha_nombre) if ficha_nombre else "")
    if tipo == "si-no":
        valor = bool(crudo)
        return valor if (valor or campo.get("vacio") != "quitar") else QUITAR
    if tipo == "lineas":
        lista = [l.strip() for l in str(crudo or "").split("\n") if l.strip()]
        return lista
    texto = str(crudo if crudo is not None else "").strip()
    if tipo != "largo":
        texto = " ".join(texto.split())
    if not texto:
        if campo.get("obligatorio"):
            raise ValueError("falta %s" % donde)
        if campo.get("vacio") == "quitar":
            return QUITAR
        if campo.get("vacio") == "nulo":
            return None
        return ""
    if tipo == "numero" or campo.get("numerico"):
        try:
            numero = float(texto.replace(",", "."))
        except ValueError:
            raise ValueError("%s tiene que ser un número" % donde)
        numero = int(numero) if numero == int(numero) else numero
        if "minimo" in campo and numero < campo["minimo"] or "maximo" in campo and numero > campo["maximo"]:
            raise ValueError("%s tiene que estar entre %s y %s" % (donde, campo.get("minimo"), campo.get("maximo")))
        return numero
    if tipo == "fecha":
        fecha = leer_fecha(texto)
        if not fecha:
            raise ValueError("no entiendo la fecha de %s: ponla como dd-mm-aaaa" % donde)
        return fecha.strftime("%d-%m-%Y")
    if tipo == "enlace" and not re.match(r"^(https?://|/)", texto):
        raise ValueError("%s tiene que empezar por http://, https:// o / (una página del sitio)" % donde)
    if tipo == "color" and not re.fullmatch(r"#[0-9a-fA-F]{6}", texto):
        raise ValueError("%s no es un color (#rrggbb)" % donde)
    if tipo == "pdf" and not re.fullmatch(r"/imagenes/[\w/\-]+\.pdf", texto):
        raise ValueError("%s tiene que ser un PDF del sitio: súbelo con su botón" % donde)
    if tipo == "imagen" and not (texto.startswith("/") and not texto.startswith("//")):
        raise ValueError("%s tiene que ser una imagen del sitio (/imagenes/…): súbela con su botón" % donde)
    if campo.get("anyo"):
        linea = herramienta("linea-de-tiempo").mundo_linea
        if linea.leer_fecha(texto) is None:
            raise ValueError("no entiendo el año de %s («%s»)" % (donde, texto))
        crudo_numero = re.fullmatch(r"[−-]?\d+", texto)
        if crudo_numero:
            return int(texto.replace("−", "-"))
    if campo.get("maximo_letras") and len(texto) > campo["maximo_letras"]:
        raise ValueError("%s tiene %d letras: mejor por debajo de %d, que si no estira la tarjeta"
                         % (donde, len(texto), campo["maximo_letras"]))
    return texto


QUITAR = object()


def _poner(ficha, campo, valor):
    clave = campo["clave"]
    if clave == "_grupos":
        # Uno, «categoria»; varios, «categorias» (como nuevo-personaje.py),
        # en el sitio donde estuviera, para no desordenar la ficha. Si son
        # los mismos que tenía, como estaban escritos.
        grupos = [g.strip() for g in str(valor or "").split(",") if g.strip()] or ["sin clasificar"]
        if _grupos_npc(ficha) == ", ".join(grupos):
            return
        nueva = ("categoria", grupos[0]) if len(grupos) == 1 else ("categorias", grupos)
        orden = list(ficha.items())
        sitio = next((n for n, (k, _) in enumerate(orden) if k in ("categoria", "categorias")), None)
        orden = [(k, v) for k, v in orden if k not in ("categoria", "categorias")]
        orden.insert(sitio if sitio is not None else min(1, len(orden)), nueva)
        ficha.clear()
        ficha.update(orden)
        return
    if valor is QUITAR:
        ficha.pop(clave, None)
    elif clave not in ficha and not campo.get("siempre") and (
            (valor is False and campo["tipo"] == "si-no") or valor in ("", [], None)):
        # Lo vacío que no estaba escrito no se escribe (es lo mismo, y así
        # la ficha queda como la dejaría la herramienta).
        return
    else:
        ficha[clave] = valor


def _montar_ficha(campos, original, crudo, nombre_de):
    ficha = dict(original)
    nombre = str(crudo.get(nombre_de) or "") if nombre_de else ""
    for campo in campos:
        if campo["tipo"] in ("ver", "accion") or campo["clave"] == "_grupo":
            continue
        if campo["clave"] == "_grupos":
            _poner(ficha, campo, crudo.get("_grupos"))
            continue
        _poner(ficha, campo, _valor(campo, crudo.get(campo["clave"]), nombre))
    return ficha


def _mezclar_partes(col, archivo, datos, llegan):
    """Lo que llega del editor (las fichas de cada parte), metido en los
    datos de la colección, con sus comprobaciones. No escribe nada: lo usa
    guardar_coleccion (que luego guarda) y la vista previa de un personaje
    (que no). Devuelve las categorías nuevas del portfolio de rol."""
    nuevas_categorias = []
    for parte in col["partes"]:
        if parte["id"] not in llegan:
            continue
        crudo = llegan[parte["id"]]
        if parte.get("tipo") == "objeto":
            destino = _ir(datos, parte["camino"]) if parte["camino"] else datos
            nueva = _montar_ficha(parte["campos"], destino if isinstance(destino, dict) else {},
                                  crudo if isinstance(crudo, dict) else {}, None)
            if parte["camino"]:
                padre = _ir(datos, parte["camino"][:-1])
                clave_obj = parte["camino"][-1]
                if nueva:
                    padre[clave_obj] = nueva
                elif clave_obj in padre:
                    # Vacío: como estaba (null si lo tenía así).
                    padre[clave_obj] = None
            else:
                datos.update(nueva)
            continue
        if not isinstance(crudo, list):
            continue
        agrupada = parte.get("agrupada")
        if agrupada and agrupada.get("tipo") == "diccionario":
            viejo = datos if isinstance(datos, dict) else {}
            nuevo_dict = {g: [] for g in viejo}
            for ficha in crudo:
                g = str(ficha.get("_g") or "")
                lista = viejo.get(g) or []
                i = ficha.get("_i")
                if g in viejo and isinstance(i, int) and 0 <= i < len(lista):
                    nuevo_dict[g].append(_montar_ficha(parte["campos"], lista[i], ficha, None))
            datos.clear()
            datos.update(nuevo_dict)
            continue
        if agrupada:
            contenedor = _ir(datos, parte["camino"], crear=True) if parte["camino"] else datos
            grupos = [g for g in contenedor or [] if isinstance(g, dict)]
            por_clave = {g.get(agrupada["clave"]): g for g in grupos}
            viejas = {k: list(g.get(agrupada["dentro"]) or []) for k, g in por_clave.items()}
            nuevas = {k: [] for k in por_clave}
            for ficha in crudo:
                destino = ficha.get("_grupo")
                if isinstance(destino, str):
                    destino = destino.strip()
                if destino not in por_clave and agrupada.get("libre") and destino:
                    # Uno nuevo (una misión nueva): se añade al final.
                    nuevo_grupo = {agrupada["clave"]: destino, agrupada["dentro"]: []}
                    contenedor.append(nuevo_grupo)
                    por_clave[destino] = nuevo_grupo
                    nuevas[destino] = []
                if destino not in por_clave:
                    raise ValueError("«%s» no tiene una categoría que exista" % (ficha.get(parte["nombre_de"]) or "?"))
                origen = viejas.get(ficha.get("_g")) or []
                i = ficha.get("_i")
                original = origen[i] if isinstance(i, int) and 0 <= i < len(origen) else {}
                nuevas[destino].append(_montar_ficha(parte["campos"], original, ficha, parte.get("nombre_de")))
            for k, g in por_clave.items():
                g[agrupada["dentro"]] = nuevas[k]
            if agrupada.get("libre"):
                # Las que se han quedado sin nada (una misión acabada y
                # vaciada), fuera.
                contenedor[:] = [g for g in contenedor if not isinstance(g, dict) or g.get(agrupada["dentro"])]
            continue
        lista = _ir(datos, parte["camino"], crear=True) if parte["camino"] else datos
        if not isinstance(lista, list):
            raise ValueError("%s no tiene la forma que espero" % archivo.relative_to(RAIZ).as_posix())
        viejas = list(lista)
        nuevas = []
        for ficha in crudo:
            i = ficha.get("_i")
            original = viejas[i] if isinstance(i, int) and 0 <= i < len(viejas) else {}
            if parte.get("fijas") and not original:
                continue
            nuevas.append(_montar_ficha(parte["campos"], original, ficha, parte.get("nombre_de")))
        if parte.get("fijas"):
            # Las fijas no se añaden ni se quitan: se quedan todas, en su orden.
            vistas = {id(viejas[f.get("_i")]) for f in crudo if isinstance(f.get("_i"), int)
                      and 0 <= f.get("_i") < len(viejas)}
            if len(vistas) != len(viejas):
                raise ValueError("faltan fichas de «%s», que no se pueden quitar" % parte["titulo"])
        if col["id"] == "rol":
            conocidas = {c for c, _ in opciones_de(col, "", viejas).get("subcategory", [])}
            nuevas_categorias = sorted({str(f.get("subcategory") or "") for f in nuevas} - conocidas - {""})
        if col["id"] == "calendario" and parte["id"] == "eventos":
            for f in nuevas:
                _arreglar_evento_del_calendario(datos, f)
        lista[:] = nuevas
    if col["id"] == "personajes":
        _arreglar_personajes(datos)
    if col["id"] == "misiones":
        # Una misión cerrada (completada o fallada) sin decir en qué
        # sesión: en la última que haya, que es casi siempre la de
        # ahora (así el histórico dice cuándo se cerró).
        ultima = max([int(s.get("numero")) for s in datos.get("sesiones") or []
                      if isinstance(s, dict) and str(s.get("numero") or "").isdigit()] or [0])
        for apartado in datos.get("misiones") or []:
            for cosa in (apartado or {}).get("cosas") or [] if isinstance(apartado, dict) else []:
                if isinstance(cosa, dict) and cosa.get("estado") and not cosa.get("hasta") and ultima:
                    cosa["hasta"] = ultima
    if col["id"] == "calendario":
        hoy = datos.get("hoy")
        if isinstance(hoy, dict) and not (hoy.get("mes") and hoy.get("dia")):
            if hoy.get("mes") or hoy.get("dia"):
                raise ValueError("el día de hoy necesita el mes y el día (o ninguno de los dos)")
            datos["hoy"] = None
    return nuevas_categorias


def guardar_coleccion(peticion):
    col = coleccion(str(peticion.get("id") or ""))
    if not col:
        return {"error": "No sé qué es eso."}
    clave_campana = str(peticion.get("campana") or "")
    try:
        archivo = _archivo_de(col, clave_campana)
        datos = _cargar_datos(col, archivo)
        if datos is None:
            return {"error": "No encuentro %s." % archivo.relative_to(RAIZ).as_posix()}
        nuevas_categorias = _mezclar_partes(col, archivo, datos, peticion.get("partes") or {})
        _guardar_datos(col, archivo, datos)
        if nuevas_categorias:
            nuevo = herramienta("nuevo")
            texto = leer_texto(nuevo.ROL)[0]
            for categoria in nuevas_categorias:
                texto = nuevo.anotar_categoria(texto, categoria)
            escribir_como_estaba(nuevo.ROL, texto)
    except ValueError as error:
        return {"error": "No he guardado nada: %s." % error}
    pasos = pasos_despues(col.get("despues"))
    if pasos:
        return empezar_tarea(pasos, fin=lambda r: {"coleccion": leer_coleccion(col["id"], clave_campana)},
                             primero="Guardado; pasando")
    return {"ok": True, "coleccion": leer_coleccion(col["id"], clave_campana)}


def _arreglar_evento_del_calendario(datos, evento):
    """El día, dentro de su mes (el Fin del Ciclo tiene 4), y el enlace:
    un [[nombre]] de la wiki pasa a su dirección (como calendario.py)."""
    calendario = herramienta("calendario")
    dias = calendario.dias_de(datos, int(evento.get("mes") or 1))
    if int(evento.get("dia") or 0) > dias:
        raise ValueError("«%s» cae el día %s, y ese mes tiene %d" % (evento.get("nombre"), evento.get("dia"), dias))
    enlace = str(evento.get("enlace") or "").strip()
    if enlace and not enlace.startswith("/web/"):
        nombre = enlace.strip("[] ")
        url = calendario.paginas_de_la_wiki().get(calendario.llano(nombre))
        if not url:
            raise ValueError("no hay ninguna página de la wiki que se llame «%s»" % nombre)
        evento["enlace"] = url
    elif enlace and not (RAIZ / enlace.lstrip("/").split("#")[0]).is_file():
        raise ValueError("el enlace de «%s» lleva a una página que no existe" % evento.get("nombre"))


def _clave_oc(p):
    return nombre_archivo(str(p.get("clave") or p.get("nombre") or ""), "")


def _arreglar_personajes(datos):
    """Cada personaje con su clave (si no la tiene, la de su nombre) y sin
    repetir; y lo de las pestañas npcs, imágenes y criaturas, de uno que exista."""
    vistas = set()
    for p in datos.get("personajes") or []:
        if not isinstance(p, dict):
            continue
        clave = _clave_oc(p)
        if not clave:
            raise ValueError("«%s» necesita un nombre con alguna letra" % (p.get("nombre") or "?"))
        if clave in vistas:
            raise ValueError("hay dos personajes con la dirección «%s»: cámbiasela a uno" % clave)
        vistas.add(clave)
        p["clave"] = clave
        if not re.fullmatch(r"[a-z0-9-]+", clave):
            raise ValueError("la dirección «%s» solo puede llevar letras sin tilde, números y guiones" % clave)
        if p.get("musica"):
            p["musica"] = _titulos_de_spotify(p["musica"])
    for lista, que in (("gente", "gente"), ("imagenes", "imágenes"), ("criaturas", "criaturas"),
                       ("moodboard", "moodboard")):
        for grupo in datos.get(lista) or []:
            if isinstance(grupo, dict) and grupo.get("personaje") not in vistas:
                raise ValueError("hay %s de «%s», que no es ninguno de los personajes" % (que, grupo.get("personaje")))


# Lo que dice Spotify de un enlace suyo (su título), ya preguntado.
_SPOTIFY_TITULOS = {}


def _titulos_de_spotify(musica):
    """La música de un personaje con el título de Spotify puesto en las
    líneas que solo traen el enlace («Título | enlace»). Si Spotify no
    contesta (sin internet…), se queda como estaba."""
    lineas = musica if isinstance(musica, list) else str(musica or "").split("\n")
    salida = []
    for linea in lineas:
        trozos = [x.strip() for x in str(linea).split("|")]
        enlaces = [x for x in trozos if re.match(r"^https://open\.spotify\.com/", x)]
        if len(enlaces) == 1 and len([x for x in trozos if x]) == 1:
            url = enlaces[0].split("?", 1)[0]
            if url not in _SPOTIFY_TITULOS:
                try:
                    pedir = urllib.request.Request(
                        "https://open.spotify.com/oembed?url=" + urllib.parse.quote(url, safe=""),
                        headers={"User-Agent": "Mozilla/5.0 (editor de richi.blog)"})
                    with urllib.request.urlopen(pedir, timeout=6) as respuesta:
                        _SPOTIFY_TITULOS[url] = str(json.loads(respuesta.read(200000)).get("title") or "").strip()
                except (urllib.error.URLError, OSError, ValueError):
                    _SPOTIFY_TITULOS[url] = ""
            titulo = _SPOTIFY_TITULOS[url].replace("|", "/")
            if titulo:
                linea = "%s | %s" % (titulo, enlaces[0])
        salida.append(linea)
    return salida if isinstance(musica, list) else "\n".join(salida)


def _generador(nombre):
    """Un script de 3-generadores, cargado como módulo (no se ejecuta su
    main). Sin caché: así la vista previa usa siempre el que hay."""
    carpeta = RAIZ / "herramientas" / "3-generadores"
    if str(carpeta) not in sys.path:
        sys.path.insert(0, str(carpeta))
    spec = importlib.util.spec_from_file_location("editor_gen_" + nombre.replace("-", "_"),
                                                  carpeta / (nombre + ".py"))
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


# LA VISTA PREVIA DE UN PERSONAJE: la última que se ha pedido, por su
# clave. No se escribe en ningún archivo: editor-wiki.py la sirve en
# /previa/personajes/<clave>.html mientras el editor esté abierto.
PREVIAS = {}


def vista_previa_personaje(peticion):
    """La ficha de uno de mis personajes con lo que hay escrito en el editor
    (sin guardar): se mezcla como al guardar, pero sobre una copia, y se
    monta la página entera con su cabecera, como la generaría
    generar-personajes.py y la dejaría actualizar-cabeceras.py."""
    import copy
    col = coleccion("personajes")
    archivo = _archivo_de(col, "")
    datos = copy.deepcopy(_cargar_datos(col, archivo) or {})
    try:
        _mezclar_partes(col, archivo, datos, peticion.get("partes") or {})
        _arreglar_personajes(datos)
    except ValueError as error:
        return {"error": "No puedo enseñarlo así: %s." % error}
    pedida = nombre_archivo(str(peticion.get("clave") or ""), "")
    gen = _generador("generar-personajes")
    personajes = [p for p in datos.get("personajes") or [] if isinstance(p, dict) and gen.clave_de(p)]
    uno = next((p for p in personajes if gen.clave_de(p) == pedida), None)
    if not uno:
        return {"error": "Ponle nombre al personaje para poder verlo."}
    avisos = gen.Avisos()
    texto = gen.pagina_ficha(uno, datos, personajes, avisos)
    url = "/web/personajes/%s/%s.html" % (pedida, pedida)
    pagina = _generador("actualizar-cabeceras").montar_pagina(texto, url)
    if pagina is None:
        return {"error": "No he podido montar la página."}
    PREVIAS[pedida] = pagina
    return {"ok": True, "url": "/previa/personajes/%s.html" % pedida,
            "avisos": ["%s «%s»" % (q, d) for q, d in avisos.lista]}


def _al_compendio(campos, avisos):
    """Lo que cuenta D&D Beyond de cada conjuro, objeto, rasgo o acción va
    al compendio (datos/personajes/compendio/, ver 0-comun/compendio.py)
    si aún no está; lo que ya está no se toca (puede que lo hayas
    cambiado a tu gusto). En el personaje se queda solo de dónde le viene
    cada cosa."""
    import compendio
    gen = _generador("generar-personajes")
    nuevas, por_tipo, bloques = 0, {}, []
    for d in gen.leer_descripciones(campos.get("descripciones")).values():
        tipo = d.get("tipo") if d.get("tipo") in compendio.TIPOS else (
            compendio.tipo_de_datos(d.get("datos")) or "rasgos")
        por_tipo.setdefault(tipo, []).append({"nombre": d["nombre"], "datos": d.get("datos"),
                                              "texto": d.get("cuerpo")})
        partes = ["## " + d["nombre"], "Tipo: " + tipo]
        if d.get("origen"):
            partes.append("Origen: " + d["origen"])
        bloques.append("\n".join(partes))
    for tipo, entradas in por_tipo.items():
        nuevas += compendio.anadir(tipo, entradas)
    if bloques:
        campos["descripciones"] = "\n\n".join(bloques)
    if nuevas:
        avisos.append("%d cosa(s) nuevas añadidas al compendio (Rol → «Compendio: …»)." % nuevas)


def importar_de_dndbeyond(peticion):
    """La ficha de D&D Beyond como las casillas de uno de mis personajes
    (1-publicar/editor/dndbeyond.py), y si se pide, su retrato de allí como
    imagen de perfil y token de la galería (los que no tenga)."""
    ddb = herramienta("dndbeyond")
    try:
        datos = ddb.obtener(peticion.get("texto"))
        campos, avisos, retrato = ddb.a_ficha(datos)
    except ddb.ErrorDeImportacion as error:
        return {"error": str(error)}
    _al_compendio(campos, avisos)
    clave = nombre_archivo(str(peticion.get("personaje") or campos.get("nombre") or ""), "")
    imagenes = {}
    quiere = peticion.get("imagenes") or []
    if retrato and quiere and clave:
        # La de D&D Beyond sin el recorte de la URL (?width=150…): la grande.
        grande = retrato.split("?", 1)[0]
        temporal = None
        try:
            peticion_img = urllib.request.Request(grande, headers={"User-Agent": "Mozilla/5.0 (editor de richi.blog)"})
            with urllib.request.urlopen(peticion_img, timeout=20) as respuesta:
                crudo = respuesta.read(15 * 1024 * 1024)
            temporal = _temporal(crudo, Path(grande).suffix.lower() or ".jpg")
            for campo, sitio in (("retrato", "oc-retrato"), ("token", "oc-token")):
                if campo in quiere:
                    hecho = subir_imagen({"sitio": sitio, "campos": {"personaje": clave}, "nombre": clave,
                                          "ruta": str(temporal)})
                    if hecho.get("ok"):
                        imagenes[campo] = hecho["ruta"]
                    else:
                        avisos.append("La imagen de D&D Beyond no ha podido ser %s: %s"
                                      % ("la de perfil" if campo == "retrato" else "el token", hecho.get("error")))
        except (urllib.error.URLError, OSError, ValueError) as error:
            avisos.append("No he podido bajar su retrato de D&D Beyond (%s)." % getattr(error, "reason", error))
        finally:
            if temporal:
                try:
                    temporal.unlink()
                except OSError:
                    pass
    # LAS IMÁGENES DE LOS OBJETOS (para la galería del inventario), a
    # imagenes/personajes/<clave>/objetos/<su-nombre>.webp. Las que ya
    # estén no se vuelven a bajar.
    if "objetos" in quiere and clave:
        bajadas = 0
        for nombre, url in ddb.imagenes_de_objetos(datos).items():
            carpeta = RAIZ / "imagenes" / "personajes" / clave / "objetos"
            if (carpeta / ("%s.webp" % nombre_archivo(nombre, "objeto"))).exists():
                continue
            temporal = None
            try:
                peticion_img = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (editor de richi.blog)"})
                with urllib.request.urlopen(peticion_img, timeout=20) as respuesta:
                    crudo = respuesta.read(10 * 1024 * 1024)
                temporal = _temporal(crudo, Path(url).suffix.lower() or ".png")
                hecho = subir_imagen({"sitio": "oc-objeto", "campos": {"personaje": clave}, "nombre": nombre,
                                      "ruta": str(temporal)})
                if hecho.get("ok"):
                    bajadas += 1
                else:
                    avisos.append("La imagen de «%s» no ha podido ser: %s" % (nombre, hecho.get("error")))
            except (urllib.error.URLError, OSError, ValueError) as error:
                avisos.append("No he podido bajar la imagen de «%s» (%s)." % (nombre, getattr(error, "reason", error)))
            finally:
                if temporal:
                    try:
                        temporal.unlink()
                    except OSError:
                        pass
        if bajadas:
            avisos.append("%d imagen(es) de objetos guardadas para el inventario." % bajadas)
    return {"ok": True, "campos": campos, "imagenes": imagenes, "avisos": avisos}


def subir_pdf_de_personaje(peticion):
    """La ficha en PDF de uno de mis personajes, a su carpeta:
    imagenes/personajes/<clave>/ficha-<clave>.pdf (pisa la que hubiera)."""
    clave = nombre_archivo(str(peticion.get("personaje") or ""), "")
    if not clave:
        return {"error": "Primero ponle nombre al personaje."}
    datos = str(peticion.get("datos") or "")
    if "," in datos:
        datos = datos.split(",", 1)[1]
    try:
        crudo = base64.b64decode(datos, validate=True)
    except ValueError:
        return {"error": "El PDF no ha llegado bien."}
    if not crudo.startswith(b"%PDF"):
        return {"error": "Eso no es un PDF."}
    if len(crudo) > 20 * 1024 * 1024:
        return {"error": "Es demasiado grande (más de 20 MB)."}
    destino = RAIZ / "imagenes" / "personajes" / clave / ("ficha-%s.pdf" % clave)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(crudo)
    return {"ok": True, "ruta": "/" + destino.relative_to(RAIZ).as_posix(),
            "aviso": "%d KB" % max(1, len(crudo) // 1024)}


def pasos_despues(que):
    if que == "generadores":
        return pasos_generadores()
    if que == "buscador":
        return [paso("3-generadores/generar-buscador.py")]
    if que == "npcs":
        return [paso(s) for s in ("2-imagenes/tokens-pequenos.py", "3-generadores/textos-npcs.py",
                                  "3-generadores/generar-posts.py", "3-generadores/generar-buscador.py")]
    if que == "linea":
        return [paso("3-generadores/generar-linea-tiempo.py")]
    if que == "personajes":
        return [paso(s) for s in ("3-generadores/generar-personajes.py", "3-generadores/quitar-comentarios.py",
                                  "3-generadores/generar-sitemap.py", "3-generadores/generar-buscador.py",
                                  "3-generadores/actualizar-cabeceras.py")]
    if que == "mundo":
        return [paso("3-generadores/generar-mundo.py"), paso("3-generadores/actualizar-cabeceras.py")]
    return []


def subir_fotos_de_gato(peticion):
    """Las fotos nuevas de un santuario: a su carpeta (a WebP y a su
    tamaño) y luego generar-galeria.py, que hace las miniaturas y las
    apunta en el JSON. La descripción de cada una se escribe después."""
    gato = str(peticion.get("santuario") or "")
    if gato not in santuarios():
        return {"error": "No encuentro ese santuario."}
    traidas, fallos = [], []
    for foto in peticion.get("fotos") or []:
        hecho = subir_imagen({"sitio": "santuarios", "campos": {"santuario": gato},
                              "nombre": Path(str(foto.get("archivo") or "foto")).stem,
                              "archivo": foto.get("archivo"), "datos": foto.get("datos")})
        (traidas if hecho.get("ok") else fallos).append(hecho.get("ruta") or hecho.get("error"))
    if not traidas:
        return {"error": "No he podido traer ninguna: " + "; ".join(fallos)}
    return empezar_tarea([paso("2-imagenes/generar-galeria.py", "--sin-preguntar")],
                         fin=lambda r: {"coleccion": leer_coleccion("gatos"), "traidas": len(traidas),
                                        "fallos": fallos})


# =========================================
# REPASAR Y VOLVER A GENERAR
# =========================================

def repasar():
    return empezar_tarea([paso("4-comprobar/" + s) for s in ("enlaces-rotos.py", "css-sano.py", "temas-completos.py",
                                                            "nombres-repetidos.py", "inyecciones.py")],
                         seguir_aunque_falle=True, primero="Repasando")


def regenerar():
    return empezar_tarea(pasos_generadores(), primero="Generando")


# =========================================
# LO QUE LE LLEGA AL SERVIDOR
# =========================================
# editor-wiki.py le pasa aquí todo lo de /api/web/… (con la contraseña ya
# comprobada). Devuelve el diccionario que hay que contestar en JSON.

# =========================================
# LO QUE SE PUEDE ENLAZAR ESCRIBIENDO [[
# =========================================
# Las páginas de la wiki (de mundo.json, que lo escribe generar-mundo) y los
# NPC de cada campaña, para el buscador que sale al escribir [[.

def enlazables():
    paginas = []
    for f in leer_json(RAIZ / "datos" / "wiki" / "mundo.json", []) or []:
        if isinstance(f, dict) and f.get("titulo") and f.get("url"):
            paginas.append({"nombre": str(f["titulo"]), "url": str(f["url"]), "que": str(f.get("que") or "")})
    npcs, grupos = {}, {}
    for archivo in sorted((RAIZ / "datos" / "notas_rol").glob("npcs-*.json")):
        datos = leer_json(archivo, {}) or {}
        clave = archivo.stem[len("npcs-"):]
        # Con lo que ayuda a encontrarlos en el buscador de las notas: su
        # cara, su grupo, dónde viven y cómo están.
        npcs[clave] = [{"nombre": str(p.get("nombre")), "que": str(p.get("que") or ""),
                        "foto": str(p.get("token_mini") or p.get("token") or ""),
                        "grupo": _grupos_npc(p), "donde": str(p.get("donde") or ""),
                        "estado": str(p.get("estado") or ""),
                        "notas": " ".join(str(x) for x in (p.get("notas") or [])[:3]
                                          if isinstance(p.get("notas"), list))[:300]}
                       for p in datos.get("personajes") or [] if isinstance(p, dict) and p.get("nombre")]
        grupos[clave] = [g[0] for g in opciones_de(coleccion("npcs"), "", datos).get("_grupos", [])]
    # Las misiones de cada campaña (para «Nueva misión» y «Pista» en las
    # notas): las abiertas, con su apartado.
    misiones = {}
    for _, campana in campanas_que_hay():
        clave = campana.get("clave")
        lista = []
        for apartado in campana.get("misiones") or []:
            if not isinstance(apartado, dict):
                continue
            for cosa in apartado.get("cosas") or []:
                if isinstance(cosa, dict) and cosa.get("que") and not cosa.get("estado") and not cosa.get("hecha"):
                    lista.append({"mision": str(apartado.get("nombre") or ""), "que": str(cosa["que"])})
        misiones[clave] = lista
    return {"paginas": paginas, "npcs": npcs, "grupos": grupos, "misiones": misiones}


# =========================================
# DE LAS NOTAS AL BOTÍN, A LAS MISIONES Y AL DINERO
# =========================================
# Lo que el editor hace sin pasar por las fichas: pasar al botín la lista
# de objetos de unas notas (o lo que se llevó el grupo de una misión), y
# crear una misión o apuntarle una pista desde lo elegido en las notas.
# Escriben solo su trozo del JSON de la campaña: lo demás, como estaba.
MONEDAS = {"pc": "pc", "pp": "pp", "pe": "pe", "po": "po", "ppt": "ppt", "cobre": "pc", "plata": "pp",
           "electro": "pe", "electrum": "pe", "oro": "po", "platino": "ppt"}
RE_MONEDAS = re.compile(r"^\s*(\d+(?:[.,]\d+)?)\s*(?:(ppt|pp|pc|pe|po)\b|monedas?\s+de\s+"
                        r"(oro|plata|cobre|electro|electrum|platino))", re.I)
RE_CUANTAS = re.compile(r"^\s*[x×]?\s*(\d+)\s*[x×]?\s+(.+)$", re.I)


def _texto_llano(texto):
    return " ".join(unicodedata.normalize("NFD", str(texto or "")).encode("ascii", "ignore").decode().lower().split())


def _de_sesion(valor):
    return int(valor) if str(valor or "").strip().isdigit() else None


def _campana_para_tocar(clave):
    archivo, campana = _campana(str(clave or ""))
    if not archivo:
        raise ValueError("no encuentro esa campaña")
    return archivo, campana


def resumen_automatico(peticion):
    """El resumen que saldría solo de estas hojas (las del editor, aunque
    no estén guardadas)."""
    from resumenes import resumen_de_notas
    hojas = [h for h in peticion.get("hojas") or [] if isinstance(h, dict)]
    try:
        cuaderno = _cuaderno_html(hojas, "", "")
    except ValueError as error:
        return {"error": str(error)}
    return {"ok": True, "resumen": resumen_de_notas(cuaderno)}


def anadir_al_botin(peticion):
    """{campana, cosas: [{que, de?, tipo?, quien?}]}. Las monedas («25 po»,
    «10 monedas de oro») van al dinero, como una entrada; lo demás, al
    botín, con su cantidad aparte si empieza por un número («4 kits» →
    «Kits», 4). Lo que ya estaba (mismo nombre) no se repite."""
    try:
        archivo, campana = _campana_para_tocar(peticion.get("campana"))
    except ValueError as error:
        return {"error": str(error).capitalize() + "."}
    botin = campana.setdefault("botin", [])
    movimientos = campana.setdefault("dinero", {}).setdefault("movimientos", [])
    hechas, al_dinero, ya = [], [], []
    for cosa in peticion.get("cosas") or []:
        if not isinstance(cosa, dict):
            continue
        texto = " ".join(str(cosa.get("que") or "").split())
        if not texto:
            continue
        de = _de_sesion(cosa.get("de"))
        monedas = RE_MONEDAS.match(texto)
        if monedas:
            numero = float(monedas.group(1).replace(",", "."))
            movimiento = {"que": str(cosa.get("concepto") or texto), "sentido": "entra",
                          "cantidad": int(numero) if numero == int(numero) else numero,
                          "moneda": MONEDAS[(monedas.group(2) or monedas.group(3)).lower()]}
            if de:
                movimiento["de"] = de
            movimientos.append(movimiento)
            al_dinero.append(texto)
            continue
        cantidad = None
        nombre = texto
        cuantas = RE_CUANTAS.match(texto)
        if cuantas:
            cantidad = int(cuantas.group(1))
            nombre = cuantas.group(2).strip()
        # Con mayúscula, como lo demás del botín («un carromato» → «Un carromato»).
        nombre = nombre[:1].upper() + nombre[1:]
        if any(_texto_llano(c.get("que")) in (_texto_llano(nombre), _texto_llano(texto))
               for c in botin if isinstance(c, dict)):
            ya.append(texto)
            continue
        nueva = {"que": nombre}
        if cantidad and cantidad > 1:
            nueva["cantidad"] = cantidad
        for clave in ("tipo", "quien"):
            if str(cosa.get(clave) or "").strip():
                nueva[clave] = str(cosa[clave]).strip()
        if de:
            nueva["de"] = de
        botin.append(nueva)
        hechas.append(texto)
    escribir_json(archivo, campana)
    return {"ok": True, "botin": hechas, "dinero": al_dinero, "ya": ya}


def nueva_mision(peticion):
    """{campana, mision (el apartado), que, quien?, de?}"""
    try:
        archivo, campana = _campana_para_tocar(peticion.get("campana"))
    except ValueError as error:
        return {"error": str(error).capitalize() + "."}
    que = " ".join(str(peticion.get("que") or "").split())
    grupo = " ".join(str(peticion.get("mision") or "").split())
    if not que or not grupo:
        return {"error": "Hace falta qué hay que hacer y de qué misión es."}
    misiones = campana.setdefault("misiones", [])
    apartado = next((m for m in misiones if isinstance(m, dict) and m.get("nombre") == grupo), None)
    if apartado is None:
        apartado = {"nombre": grupo, "cosas": []}
        misiones.append(apartado)
    cosa = {"que": que}
    if _de_sesion(peticion.get("de")):
        cosa["de"] = _de_sesion(peticion.get("de"))
    if str(peticion.get("quien") or "").strip():
        cosa["quien"] = str(peticion["quien"]).strip()
    apartado.setdefault("cosas", []).append(cosa)
    escribir_json(archivo, campana)
    return {"ok": True}


def pista_de_mision(peticion):
    """{campana, mision, que (la cosa de la misión), pista}"""
    try:
        archivo, campana = _campana_para_tocar(peticion.get("campana"))
    except ValueError as error:
        return {"error": str(error).capitalize() + "."}
    pista = " ".join(str(peticion.get("pista") or "").split())
    if not pista:
        return {"error": "La pista está vacía."}
    for apartado in campana.get("misiones") or []:
        if not isinstance(apartado, dict) or apartado.get("nombre") != peticion.get("mision"):
            continue
        for cosa in apartado.get("cosas") or []:
            if isinstance(cosa, dict) and cosa.get("que") == peticion.get("que"):
                pistas = cosa.setdefault("pistas", [])
                if pista not in pistas:
                    pistas.append(pista)
                escribir_json(archivo, campana)
                return {"ok": True}
    return {"error": "Esa misión ya no está."}


def crear_npc(peticion):
    """Un NPC nuevo desde las notas de una partida: con su nombre, su
    grupo, qué es y la sesión en la que salió. Se guarda como si se hubiera
    añadido en sus fichas (y se pasa a la web igual)."""
    clave = str(peticion.get("campana") or "").strip()
    nombre = " ".join(str(peticion.get("nombre") or "").split())
    if not nombre:
        return {"error": "Hace falta su nombre."}
    col = leer_coleccion("npcs", clave)
    if col.get("error"):
        return col
    if any(sin_tildes(str(f.get("nombre") or "")).lower() == sin_tildes(nombre).lower()
           for f in col["partes"]["personajes"]):
        return {"error": "Ya hay un NPC que se llama «%s» en esta campaña." % nombre}
    nuevo = {"nombre": nombre, "_grupos": str(peticion.get("grupo") or "").strip(),
             "que": str(peticion.get("que") or "").strip(), "donde": "", "relacion": "", "estado": "",
             "token": "", "ilustracion": "", "notas": ""}
    if str(peticion.get("sesion") or "").strip().isdigit():
        nuevo["primera"] = str(int(peticion["sesion"]))
    partes = {"personajes": col["partes"]["personajes"] + [nuevo]}
    return guardar_coleccion({"id": "npcs", "campana": clave, "partes": partes})


# =========================================
# GITHUB: LA GUÍA DE COMANDOS
# =========================================
# El editor no sube nada por su cuenta (en el ordenador de Richi git pide
# sus credenciales en la consola): enseña lo que hay cambiado, si se
# puede saber, y los comandos para hacerlo uno mismo, ya con la carpeta,
# la rama y el mensaje puestos.

REPOSITORIO = "https://github.com/rperezbarreda/richiblog"


def _git(*args, tiempo=60):
    try:
        hecho = subprocess.run(["git"] + list(args), cwd=RAIZ, capture_output=True, text=True, timeout=tiempo,
                               stdin=subprocess.DEVNULL, encoding="utf-8", errors="replace")
    except FileNotFoundError:
        return 127, "", "No encuentro git en este ordenador."
    except subprocess.TimeoutExpired:
        return 124, "", "git ha tardado demasiado."
    return hecho.returncode, hecho.stdout, hecho.stderr


def git_estado():
    salida = {"carpeta": str(RAIZ), "windows": sys.platform.startswith("win"), "repositorio": REPOSITORIO,
              "rama": "", "cuantos": None, "cambios": []}
    codigo, rama, error = _git("rev-parse", "--abbrev-ref", "HEAD")
    if codigo:
        salida["aviso"] = ("No encuentro git en este ordenador: instálalo (abajo dice cómo)." if codigo == 127
                           else "Esta carpeta no es todavía un repositorio de git (abajo, cómo bajarlo).")
        return salida
    salida["rama"] = rama.strip()
    _, cambios, _ = _git("status", "--porcelain", "-uall")
    lineas = [l for l in cambios.splitlines() if l.strip()]
    que = {"M": "cambiado", "A": "nuevo", "D": "borrado", "R": "movido", "?": "nuevo"}
    salida["cuantos"] = len(lineas)
    salida["cambios"] = [{"que": que.get((l[:2].strip() or "M")[0], "cambiado"), "archivo": l[3:]}
                         for l in lineas[:300]]
    return salida


# =========================================
# LOS BORRADORES AUTOMÁTICOS
# =========================================
# Mientras escribes, el editor manda cada poco lo que tienes sin guardar, y
# aquí se apunta en un archivo aparte (en la carpeta temporal del
# ordenador, nunca en la web ni en el proyecto). Si se cierra la ventana o
# se va la luz, al volver a abrir esa entrada o esa página el editor
# ofrece recuperarlo. Al guardar de verdad, se borra.
#   clave: «entrada:web/blog/…html» o «wiki:Nombre de la página»

BORRADORES = Path(tempfile.gettempdir()) / "editor-web-borradores"


def _archivo_de_borrador(clave):
    import hashlib
    return BORRADORES / (hashlib.sha1(str(clave).encode("utf-8")).hexdigest() + ".json")


def leer_borrador(clave):
    archivo = _archivo_de_borrador(clave)
    try:
        dato = json.loads(archivo.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"borrador": None}
    return {"borrador": dato if dato.get("clave") == clave else None}


def apuntar_borrador(peticion):
    clave = str(peticion.get("clave") or "").strip()
    if not clave:
        return {"error": "Falta de qué es el borrador."}
    archivo = _archivo_de_borrador(clave)
    if peticion.get("datos") is None:
        try:
            archivo.unlink()
        except OSError:
            pass
        return {"ok": True}
    BORRADORES.mkdir(parents=True, exist_ok=True)
    archivo.write_text(json.dumps({"clave": clave, "cuando": dt.datetime.now().strftime("%d-%m-%Y %H:%M"),
                                   "datos": peticion["datos"]}, ensure_ascii=False), encoding="utf-8")
    return {"ok": True}


# =========================================
# LOS COMANDOS (el menú de siempre)
# =========================================
# El apartado «Comandos» del editor: lo de herramientas/menu.py, cada cosa
# con un botón que la abre en su propia ventana de comandos (ver
# menu.abrir_en_ventana). Lo que lleva al editor no sale: ya estás en él.

def _menu():
    if "menu" not in _CARGADAS:
        spec = importlib.util.spec_from_file_location("editor_web_menu", HERRAMIENTAS / "menu.py")
        modulo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(modulo)
        _CARGADAS["menu"] = modulo
    return _CARGADAS["menu"]


def comandos():
    menu = _menu()
    apartados = []
    for n, (nombre, de_que, opciones) in enumerate(menu.APARTADOS, start=1):
        lista = [{"cual": "%d.%d" % (n, i), "titulo": titulo, "pista": pista}
                 for i, (titulo, script, _, pista) in enumerate(opciones, start=1) if script != menu.EDITOR]
        apartados.append({"nombre": nombre, "de_que": de_que, "opciones": lista})
    return {"apartados": apartados}


def abrir_comando(peticion):
    cual = str(peticion.get("cual") or "").strip()
    menu = _menu()
    if cual:
        opcion = menu.opcion_de(cual)
        if opcion is None or menu.es_el_editor(opcion):
            return {"error": "No sé qué es eso."}
    error = menu.abrir_en_ventana(cual or None)
    if error:
        return {"error": error}
    return {"ok": True, "titulo": menu.opcion_de(cual)[0] if cual else "El menú de siempre"}


# PUBLICAR EN NEOCITIES (el apartado del editor): las opciones de
# subir-neocities.py del menú, cada una en su ventana de comandos, como en
# «Comandos» (la herramienta pregunta antes de subir y pide la clave).
NEOCITIES_MODOS = {"ensayo": ["--ensayo"], "subir": [], "borrar": ["--borrar"], "clave": ["--clave"]}


def neocities_estado():
    clave = bool(os.environ.get("NEOCITIES_API_KEY")) or (Path.home() / ".richiblog-neocities").is_file()
    return {"clave": clave}


def abrir_neocities(peticion):
    argumentos = NEOCITIES_MODOS.get(str(peticion.get("modo") or ""))
    if argumentos is None:
        return {"error": "No sé qué es eso."}
    menu = _menu()
    for n, (_, _, opciones) in enumerate(menu.APARTADOS, start=1):
        for i, (titulo, script, args, _) in enumerate(opciones, start=1):
            if script == "1-publicar/subir-neocities.py" and list(args or []) == argumentos:
                return abrir_comando({"cual": "%d.%d" % (n, i)})
    return {"error": "No encuentro esa opción en el menú (herramientas/menu.py)."}


def atender_get(ruta, pregunta):
    uno = lambda k: (pregunta.get(k) or [""])[0]  # noqa: E731
    if ruta == "/api/web/entradas":
        return {"entradas": entradas(), "nuevas": para_hacer_nuevas()}
    if ruta == "/api/web/entrada":
        return leer_entrada(uno("archivo"))
    if ruta == "/api/web/tarea":
        return estado_de_la_tarea(uno("desde"))
    if ruta == "/api/web/colecciones":
        return {"colecciones": [{"id": c["id"], "titulo": c["titulo"], "apartado": c["apartado"],
                                 "ayuda": c.get("ayuda", ""), "corto": c.get("corto", ""),
                                 "por_campana": bool(c.get("por_campana"))}
                                for c in colecciones()],
                "campanas": [{"clave": d.get("clave", ""), "nombre": d.get("nombre", "")} for _, d in campanas_que_hay()],
                "sitios": sitios_de_imagen()}
    if ruta == "/api/web/coleccion":
        return leer_coleccion(uno("id"), uno("campana"))
    if ruta == "/api/web/neocities/estado":
        return neocities_estado()
    if ruta == "/api/web/medidas":
        return medidas(uno("ruta"))
    if ruta == "/api/web/comandos":
        return comandos()
    if ruta == "/api/web/borrador":
        return leer_borrador(uno("clave"))
    if ruta == "/api/web/enlazables":
        return enlazables()
    if ruta == "/api/web/git":
        return git_estado()
    return None


def atender_post(ruta, peticion):
    if ruta == "/api/web/entrada/nueva":
        return crear_entrada(peticion)
    if ruta == "/api/web/neocities":
        return abrir_neocities(peticion)
    if ruta == "/api/web/comando":
        return abrir_comando(peticion)
    if ruta == "/api/web/borrador":
        return apuntar_borrador(peticion)
    if ruta == "/api/web/npc/nuevo":
        return crear_npc(peticion)
    if ruta == "/api/web/sesion/resumen":
        return resumen_automatico(peticion)
    if ruta == "/api/web/botin/anadir":
        return anadir_al_botin(peticion)
    if ruta == "/api/web/mision/nueva":
        return nueva_mision(peticion)
    if ruta == "/api/web/mision/pista":
        return pista_de_mision(peticion)
    if ruta == "/api/web/entrada/guardar":
        return guardar_entrada(peticion)
    if ruta == "/api/web/entrada/publicar":
        return publicar_entrada(peticion)
    if ruta == "/api/web/personaje/dndbeyond":
        return importar_de_dndbeyond(peticion)
    if ruta == "/api/web/personaje/previa":
        return vista_previa_personaje(peticion)
    if ruta == "/api/web/personaje/pdf":
        return subir_pdf_de_personaje(peticion)
    if ruta == "/api/web/imagen":
        return subir_imagen(peticion)
    if ruta == "/api/web/coleccion/guardar":
        return guardar_coleccion(peticion)
    if ruta == "/api/web/gatos/subir":
        return subir_fotos_de_gato(peticion)
    if ruta == "/api/web/repasar":
        return repasar()
    if ruta == "/api/web/regenerar":
        return regenerar()
    return None
