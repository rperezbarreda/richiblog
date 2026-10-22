#!/usr/bin/env python3
"""Lee los mapas interactivos de Chronicler (.cmap) y los deja en SVG.

QUÉ ES UN .cmap
---------------
Un JSON. Éste es uno de verdad, recortado:

    {
      "version": "1.0",
      "title": "Mapamundi de Cralëa",
      "width": 7680, "height": 4320,
      "layers": [
        { "id": "de8d…", "name": "Mapa Político",
          "image": "mapamundi_fronteras.png",
          "opacity": 1, "zIndex": 1, "visible": true },
        { "id": "base", "name": "Mapa Continental",
          "image": "mapamundi.png", "opacity": 1, "zIndex": 0,
          "visible": false }
      ],
      "pins": [],
      "shapes": [
        { "id": "ddbb…", "type": "polygon",
          "points": [ {"x": 2463, "y": 2136}, … ],
          "color": "#e74c3c",
          "label": "Azarasia",
          "targetPage": "Azarasia",      <- lleva a una página de la wiki
          "targetMap": "Partaria del Sur",  <- o a otro mapa
          "layerId": "base" }
      ]
    }

LO QUE AÑADE ESTA WEB AL FORMATO (lo escribe el editor de mapas,
herramientas/1-publicar/editor-wiki.py; Chronicler no lo conoce y, si
abres el mapa allí y lo guardas, puede perderlo):

    "page": "Reino de Prunia"          de qué página es el mapa: esa
                                        página lleva un botón para abrirlo
    pins[].kind: "capital" | "ciudad" | "pueblo" | "fortaleza" | "ruina"
                                        el tipo de sitio: cada uno se
                                        dibuja con su símbolo
    pins[].kind también: "puerto" | "templo" | "torre" | "cueva" |
                 "mina" | "puente" | "batalla" | "mazmorra" | "campamento"
    "lines": [ { "id": "…", "kind": "camino" | "rio" | "frontera" |
                         "maritima" | "muralla" | "ruta",
                 "points": [ {"x": 10, "y": 20}, … ],
                 "label": "Río Lorem", "targetPage": "Río Lorem",
                 "taper": false, "width": 3, "dash": "dotted", "gap": 8 } ]
                                        rayas abiertas. Los ríos se
                                        ensanchan hacia el final (la
                                        desembocadura) salvo con
                                        "taper": false; las rutas llevan
                                        flechas hacia donde van. width
                                        (grosor en px de pantalla), dash
                                        ("solid", "dashed", "dotted",
                                        "dashdot") y gap (la separación)
                                        cambian el estilo de su tipo
    "labels": [ { "id": "…", "x": 900, "y": 300, "label": "Mar de las
                  Brumas", "size": "grande" | "mediano" | "pequeno",
                  "angle": -15, "color": "#…" } ]
                                        texto suelto en el mapa, del
                                        tamaño del mapa (crece con el zoom)
    "emblems": [ { "id": "…", "x": 900, "y": 300, "label": "Casa Vardán",
                   "targetPage": "Casa Vardán", "image": "vardan_bandera.webp",
                   "shape": "escudo" | "bandera" | "redondo",
                   "size": "pequeno" | "mediano" | "grande", "color": "#…" } ]
                                        emblemas: un escudo (o una bandera,
                                        o un medallón) con una imagen dentro
                                        (la bandera o el blasón), como un
                                        pin grande
    shapes[].kind: "vecino" | "provincia" | "lago" | "mar" | "bosque" |
                   "montana" | "desierto" | "pantano" | "valle"
                                        qué clase de zona es: cada una
                                        lleva su trama (olas, árboles,
                                        montes, rayado…) encima de su color
    labels[].points: [ {"x": 10, "y": 20}, … ]
                                        un texto que va SOBRE UNA CURVA (el
                                        nombre de un río, de una
                                        cordillera): se escribe a lo largo
                                        de esos puntos, suavizados
    "compass": "arriba-derecha"         la rosa de los vientos, en esa
                                        esquina ("arriba-izquierda",
                                        "abajo-derecha"…)
    "scale": { "pixels": 412.5, "distance": 50, "unit": "leguas",
               "travel": { "a pie": 8, "a caballo": 12 } }
                                        la escala: tantos píxeles del
                                        lienzo son tanta distancia, y
                                        cuánto se anda en un día. Sale
                                        una barra de escala en el mapa

Las coordenadas son PÍXELES del lienzo (width x height), no tantos por
ciento. Eso es cómodo: el SVG se monta con viewBox="0 0 width height" y
los puntos se copian tal cual.

CÓMO SE PASA A LA WEB
---------------------
Un SVG metido en la propia página. No un <canvas> ni una librería de
mapas: con SVG, cada región es un <a> de verdad, así que se recorre con el
tabulador, se puede enlazar, la lee un lector de pantalla y SE VE SIN
JAVASCRIPT. Lo único que añade el JavaScript es el zoom, el arrastre y
encender o apagar capas.

LOS POLÍGONOS SE SIMPLIFICAN. El mapa de ejemplo trae 29.321 puntos, que
son unos 258 KB de coordenadas metidas en el HTML. Con el algoritmo de
Ramer-Douglas-Peucker se quedan en la mitad y a simple vista es el mismo
dibujo.

LA TOLERANCIA VA EN PROPORCIÓN AL LIENZO y no en píxeles fijos: un píxel
por cada 2.560 del lado largo. En el mapa de 7.680 son 3 px y en el mismo
mapa exportado a 1.920 son 0,75, que es la misma cantidad de dibujo. Con
un número fijo pasaba esto: al reexportar el mapa a 1.920, esos mismos 3
px se comían el 84% de los puntos y las costas salían a trozos rectos. Se
puede poner a mano con --detalle.

LO QUE NO ESTÁ ETIQUETADO NO ES INTERACTIVO. De las 123 formas del mapa de
ejemplo, 106 no tienen ni nombre ni enlace: son el dibujo (fronteras,
costas). Ésas salen pintadas pero con aria-hidden y sin foco, porque un
tabulador que pasa por 106 cosas sin nombre no es navegar, es un castigo.
"""

import html
import math
import json
import re
import unicodedata

# El sufijo de la versión pequeña de cada imagen de capa (ver arriba).
PEQUE_DE_CAPA = "-peque.webp"
ANCHO_PEQUE_DE_CAPA = 1280
# Y la MÁXIMA, para acercarse mucho: solo si la original es bastante más
# grande que la normal (un mapamundi ampliado con IA), hasta este lado. La
# escribe preparar_capas y la pide mundo-mapa.js al acercar mucho.
MAXIMA_DE_CAPA = "-max.webp"
LADO_MAXIMO_DE_CAPA = 8192


# =========================================
# LEER
# =========================================

def leer_cmap(texto, avisar=None):
    """Un .cmap a un diccionario con lo que hace falta. Devuelve None si
    no se entiende: un archivo roto no debe tumbar la conversión entera."""
    try:
        crudo = json.loads(texto)
    except (ValueError, TypeError) as error:
        if avisar:
            avisar("el .cmap no es un JSON que entienda", str(error)[:60])
        return None
    if not isinstance(crudo, dict):
        if avisar:
            avisar("el .cmap no tiene la forma que espero", "no es un objeto")
        return None

    ancho = _entero(crudo.get("width"), 0)
    alto = _entero(crudo.get("height"), 0)
    if ancho <= 0 or alto <= 0:
        if avisar:
            avisar("el mapa no dice cuánto mide", f"width={crudo.get('width')} height={crudo.get('height')}")
        return None

    # Las capas, de abajo arriba. zIndex manda; si no lo trae, el orden en
    # que estén escritas.
    capas = []
    for n, capa in enumerate(crudo.get("layers") or []):
        if not isinstance(capa, dict):
            continue
        capas.append({
            "id": str(capa.get("id") or f"capa{n}"),
            "nombre": str(capa.get("name") or f"capa {n + 1}").strip(),
            "imagen": str(capa.get("image") or "").strip(),
            "opacidad": _numero(capa.get("opacity"), 1.0),
            "orden": _entero(capa.get("zIndex"), n),
            # visible es lo que estaba encendido al guardar en la
            # aplicación. Se respeta: es como lo dejaste tú.
            "visible": capa.get("visible") is not False,
        })
    capas.sort(key=lambda c: c["orden"])

    # Los pines y las regiones, CANTANDO lo que se queda fuera. Que un pin
    # sin coordenadas desaparezca sin decir nada es justo el agujero que
    # este formato no puede tener: en el mapa se vería un sitio de menos y
    # no habría manera de saber por qué.
    pines, formas = [], []
    for n, uno in enumerate(crudo.get("pins") or []):
        hecho = _pin(uno)
        if hecho is None:
            if avisar:
                avisar("un pin del mapa que no sé poner (le faltan las"
                       " coordenadas)", _quien(uno, n))
            continue
        if _perdio_el_color(uno):
            if avisar:
                avisar("color de un pin que no entiendo", _quien(uno, n))
        pines.append(hecho)
    for n, uno in enumerate(crudo.get("shapes") or []):
        hecho = _forma(uno)
        if hecho is None:
            if avisar:
                avisar("una región del mapa que no sé dibujar (no llega a"
                       " tres puntos)", _quien(uno, n))
            continue
        if _perdio_el_color(uno):
            if avisar:
                avisar("color de una región que no entiendo", _quien(uno, n))
        formas.append(hecho)

    textos = [hecho for hecho in (_texto(uno) for uno in crudo.get("labels") or []) if hecho]
    # Los emblemas sueltos de antes ("emblems") son sitios con forma de
    # emblema: se leen como pines (el editor ya los guarda así).
    emblemas = []
    for em in (_emblema(uno) for uno in crudo.get("emblems") or []):
        if em:
            pines.append({"x": em["x"], "y": em["y"], "etiqueta": em["etiqueta"], "color": em["color"],
                          "icono": "", "pagina": em["pagina"], "mapa": em["mapa"], "capa": "",
                          "escondido": False, "tipo": "", "forma": em["forma"], "tamano": em["tamano"],
                          "imagen": em["imagen"]})

    lineas = []
    for n, uno in enumerate(crudo.get("lines") or []):
        hecho = _linea(uno)
        if hecho is None:
            if avisar:
                avisar("un camino o un río que no sé dibujar (no llega a dos"
                       " puntos)", _quien(uno, n))
            continue
        lineas.append(hecho)

    return {
        "titulo": str(crudo.get("title") or "").strip(),
        "ancho": ancho,
        "alto": alto,
        "capas": capas,
        "pines": pines,
        "formas": formas,
        "lineas": lineas,
        "textos": textos,
        "emblemas": emblemas,
        "escala": _escala(crudo.get("scale")),
        "pagina": str(crudo.get("page") or "").strip(),
        "rosa": _rosa_valida(crudo.get("compass")),
        # Dónde cae en el mapamundi (si es un mapa regional situado; lo
        # pone el editor de mapas, ver herramientas/mapas_mundo.py).
        "mundo": _mundo(crudo.get("world")),
    }


def _mundo(crudo):
    """{"mapa", "x", "y", "w", "h"} (en unidades del mapamundi) o None."""
    if not isinstance(crudo, dict):
        return None
    numeros = [_numero(crudo.get(k), None) for k in ("x", "y", "w", "h")]
    if any(n is None for n in numeros) or numeros[2] <= 0 or numeros[3] <= 0:
        return None
    x, y, w, h = numeros
    return {"mapa": str(crudo.get("map") or "").strip(), "x": x, "y": y, "w": w, "h": h}


# =========================================
# LOS MAPAS REGIONALES, EN EL MAPAMUNDI
# =========================================
# Lo que se pinta en cada mapa regional situado (con "world") sale también
# en el mapamundi, en su sitio: los asentamientos y demás sitios, los
# caminos, los senderos, las rutas y los ríos. No sus regiones (lagos,
# bosques, países vecinos: el mapamundi ya tiene las suyas), ni sus
# fronteras, ni sus textos sueltos. Los sitios «Puente» sin nombre
# tampoco: los puentes salen solos donde un camino cruza un río. Así, con
# las regiones apagadas (la casilla «regiones»), el mapamundi es el mapa
# de rutas de todo el mundo, y la ruta se puede buscar de un país a otro.
RAYAS_QUE_NO_PASAN = ("frontera",)
# Con lo regional dentro, se puede acercar más (hay pueblos que a 6x aún
# se ven pequeños), y los nombres de los pueblos salen de más cerca.
ZOOM_MAXIMO_CON_REGIONALES = 16
CERCA_CON_REGIONALES = 4


def juntar_regionales(mundo, regionales, avisar=None):
    """Añade a «mundo» (lo leído del mapamundi) lo de cada mapa regional
    de «regionales» (lo leído de cada uno, con su "mundo"), pasado a las
    medidas del mapamundi. Devuelve cuántos ha juntado."""
    juntados = 0
    for reg in regionales:
        sitio = reg.get("mundo")
        if not sitio or not reg.get("ancho") or not reg.get("alto"):
            continue
        fx, fy = sitio["w"] / reg["ancho"], sitio["h"] / reg["alto"]

        def a_mundo(x, y):
            return sitio["x"] + x * fx, sitio["y"] + y * fy

        for pin in reg.get("pines") or []:
            if pin.get("tipo") == "puente" and not pin.get("etiqueta"):
                continue
            nuevo = dict(pin)
            nuevo["x"], nuevo["y"] = a_mundo(pin["x"], pin["y"])
            # Las capas son las del mapa regional: aquí no existen.
            nuevo["capa"] = ""
            mundo["pines"].append(nuevo)
        for linea in reg.get("lineas") or []:
            if linea.get("tipo") in RAYAS_QUE_NO_PASAN:
                continue
            nueva = dict(linea)
            nueva["puntos"] = [a_mundo(x, y) for x, y in linea["puntos"]]
            # Con el detalle de su mapa (el del mapamundi es mucho más
            # grueso: un camino de pueblo saldría recto y más corto).
            nueva["detalle"] = detalle_de(reg) * fx
            # Cuánto más fino es su mapa que el mapamundi (para la red de
            # caminos: _red_de_caminos).
            nueva["escala_de"] = max(reg["ancho"], reg["alto"]) * fx / max(mundo["ancho"], mundo["alto"])
            mundo["lineas"].append(nueva)
        # La escala: la del primer regional que la tenga, si el mapamundi
        # no tiene la suya (en píxeles del regional; aquí, en unidades).
        if not mundo.get("escala") and reg.get("escala"):
            escala = dict(reg["escala"])
            escala["pixeles"] = escala["pixeles"] * fx
            mundo["escala"] = escala
        juntados += 1
        mundo.setdefault("regionales", []).append(reg.get("titulo") or "")
    if juntados:
        mundo["zoom_maximo"] = ZOOM_MAXIMO_CON_REGIONALES
        mundo["cerca"] = CERCA_CON_REGIONALES
    return juntados


def _quien(crudo, n):
    """Cómo llamar a una región o a un pin en un aviso: por su nombre, y si
    no tiene, por el sitio que ocupa en el archivo."""
    if isinstance(crudo, dict):
        nombre = (crudo.get("label") or crudo.get("name")
                  or crudo.get("targetPage") or crudo.get("targetMap") or "")
        if str(nombre).strip():
            return str(nombre).strip()
    return "el número %d del archivo" % (n + 1)


def _perdio_el_color(crudo):
    """Traía un color y no era de los que valen, así que se ha quedado sin
    él (y lo pinta la hoja de estilos). Vale la pena decirlo: un color
    escrito de otra manera es un error de dedo, no una decisión."""
    if not isinstance(crudo, dict):
        return False
    tenia = str(crudo.get("color") or "").strip()
    return bool(tenia) and not _color(tenia)


def _pin(crudo):
    """Un pin: una chincheta con su nombre, su color, su emoji y a dónde
    lleva. Así lo guarda Chronicler, comprobado en un mapa de verdad:

        { "id": "9ea0…", "x": 494.5, "y": 314,
          "targetPage": "Reino de Prunia", "label": "Reino de Prunia",
          "color": "#3498db", "icon": "🏰", "invisible": false }

    La posición se acepta también dentro de un "position", que es la otra
    forma razonable de escribirla por si cambia."""
    if not isinstance(crudo, dict):
        return None
    sitio = crudo.get("position") if isinstance(crudo.get("position"), dict) else crudo
    x, y = _numero(sitio.get("x"), None), _numero(sitio.get("y"), None)
    if x is None or y is None:
        return None
    return {
        "x": x,
        "y": y,
        "etiqueta": str(crudo.get("label") or crudo.get("name") or "").strip(),
        "color": _color(crudo.get("color")),
        "icono": str(crudo.get("icon") or crudo.get("emoji") or "").strip(),
        "pagina": str(crudo.get("targetPage") or "").strip(),
        "mapa": str(crudo.get("targetMap") or "").strip(),
        "capa": str(crudo.get("layerId") or "").strip(),
        # Un pin que en Chronicler está escondido. Se respeta: ni se
        # dibuja ni sale en la lista. Pero se cuenta al terminar, que una
        # chincheta que desaparece sin decir nada es justo lo que no
        # queremos.
        "escondido": crudo.get("invisible") is True,
        # El tipo de sitio (capital, ciudad…), si lo tiene: se dibuja con
        # su símbolo en vez de la chincheta redonda.
        "tipo": _tipo_de_pin(crudo.get("kind") or crudo.get("tipo")),
        # CÓMO SE VE (de esta web): sin "shape", con su símbolo; con él,
        # como un emblema (escudo, bandera o medallón) de su tamaño, con
        # su imagen dentro o, sin ella, con el símbolo del tipo.
        "forma": _forma_valida(crudo.get("shape")),
        "tamano": _tamano_valido(crudo.get("size")),
        "imagen": str(crudo.get("image") or "").strip(),
    }


# LOS TIPOS DE SITIO: (símbolo para la lista y la leyenda, nombre). El
# dibujo de cada uno está en _simbolo_de_pin.
TIPOS_DE_PIN = {
    "capital": ("★", "capital"),
    "ciudad": ("◉", "ciudad"),
    "pueblo": ("●", "pueblo"),
    "fortaleza": ("♜", "fortaleza"),
    "ruina": ("✕", "ruina"),
    # Éstos van con su símbolo escrito (una letra de las fuentes de
    # símbolos que trae cualquier sistema) dentro de una bola.
    "puerto": ("⚓", "puerto"),
    "templo": ("⛩", "templo"),
    "torre": ("♖", "torre"),
    "cueva": ("⌓", "cueva"),
    "mina": ("⛏", "mina"),
    "puente": ("⌒", "puente"),
    "batalla": ("⚔", "batalla"),
    "mazmorra": ("☠", "mazmorra"),
    "campamento": ("⛺", "campamento"),
}
# Los de nombre siempre a la vista; los demás, solo al acercarse (al 200%
# o más): con todos los pueblos escritos, el mapa entero era una sopa.
SIEMPRE_CON_NOMBRE = {"", "capital", "ciudad"}
TIPOS_DE_LINEA = {"camino": "camino principal", "sendero": "sendero", "rio": "río", "frontera": "frontera",
                  "maritima": "ruta marítima", "muralla": "muralla", "ruta": "ruta de viaje"}
# Tamaños de antes (el lado largo del mapa entre esto); ahora el editor
# guarda el tamaño en píxeles del mapa ("fontSize").
TAMANOS_DE_TEXTO = {"grande": 45, "mediano": 70, "pequeno": 110}
# Cómo se agrupan las rayas para encender y apagar: cada grupo, su casilla.
GRUPO_DE_RAYA = {"camino": "caminos", "sendero": "caminos", "rio": "rios", "frontera": "otras",
                 "maritima": "otras", "muralla": "otras", "ruta": "otras"}
NOMBRE_DE_GRUPO_DE_RAYA = (("caminos", "caminos"), ("rios", "ríos"), ("otras", "otras rayas"))
# El grosor de cada raya, en píxeles de pantalla (el de mundo-mapa.css),
# para calcular sus trazos cuando lleva un estilo propio.
ANCHO_DE_RAYA = {"camino": 4.5, "sendero": 2.5, "rio": 4, "frontera": 3, "maritima": 4, "muralla": 6, "ruta": 3.5}
TRAZOS_DE_RAYA = ("solid", "dashed", "dotted", "dashdot")
# Las letras de los textos sueltos: cada una es una clase en
# mundo-mapa.css (es-letra-…), con las fuentes que ya carga la web.
FORMAS_DE_EMBLEMA = ("tipo", "escudo", "bandera", "redondo", "cuadrado", "rombo", "hexagono", "octogono",
                     "triangulo", "triangulo-abajo", "casa", "torre", "cupula", "pildora", "estrella", "cruz")
TAMANOS_DE_EMBLEMA = {"pequeno": 0.8, "mediano": 1.2, "grande": 1.7}
# LAS CLASES DE ZONA: cada una con su nombre, su color si la zona no trae
# uno, y su trama (_trama). Se distinguen por la trama, no solo por el
# color: olas el agua, arbolitos el bosque, montes la montaña…
TIPOS_DE_ZONA = {"vecino": ("país vecino", "#9a8fb0"), "provincia": ("provincia o comarca", "#f5ce6c"),
                 "lago": ("lago", "#3f8fd2"), "mar": ("mar", "#2f6fb0"), "bosque": ("bosque", "#2e7d32"),
                 "montana": ("montaña", "#8d6e63"), "desierto": ("desierto", "#e0c27a"),
                 "pantano": ("pantano o ciénaga", "#6b7d3a"), "valle": ("valle o llanura", "#9ccc65")}
# Dónde va la rosa de los vientos.
RINCONES_DE_ROSA = ("arriba-izquierda", "arriba-derecha", "abajo-izquierda", "abajo-derecha")
# Las rayas por las que se viaja (las que forman la red de caminos para
# calcular rutas): caminos, senderos y rutas, de tierra y de mar.
RAYAS_DE_VIAJE = ("camino", "sendero", "ruta", "maritima")


def _rosa_valida(valor):
    if isinstance(valor, dict):
        valor = valor.get("corner")
    valor = str(valor or "").strip().lower()
    return valor if valor in RINCONES_DE_ROSA else ""


def _forma_valida(valor):
    valor = str(valor or "").strip().lower()
    return valor if valor in FORMAS_DE_EMBLEMA else ""


def _tamano_valido(valor):
    valor = str(valor or "").strip().lower()
    return valor if valor in TAMANOS_DE_EMBLEMA else "mediano"
LETRAS_DE_TEXTO = ("antigua", "elegante", "legible", "moderna", "a-mano", "pixel", "maquina")


def _tipo_de_pin(valor):
    valor = str(valor or "").strip().lower()
    return valor if valor in TIPOS_DE_PIN else ""


def _linea(crudo):
    """Un camino o un río: una raya abierta de dos puntos o más."""
    if not isinstance(crudo, dict):
        return None
    puntos = []
    for punto in crudo.get("points") or []:
        if isinstance(punto, dict):
            x, y = _numero(punto.get("x"), None), _numero(punto.get("y"), None)
        elif isinstance(punto, (list, tuple)) and len(punto) >= 2:
            x, y = _numero(punto[0], None), _numero(punto[1], None)
        else:
            continue
        if x is not None and y is not None:
            puntos.append((x, y))
    if len(puntos) < 2:
        return None
    tipo = str(crudo.get("kind") or crudo.get("tipo") or "").strip().lower()
    return {
        "puntos": puntos,
        "tipo": tipo if tipo in TIPOS_DE_LINEA else "camino",
        "etiqueta": str(crudo.get("label") or "").strip(),
        "pagina": str(crudo.get("targetPage") or "").strip(),
        "mapa": str(crudo.get("targetMap") or "").strip(),
        "color": _color(crudo.get("color")),
        "ensancha": crudo.get("taper") is not False,
        # Su estilo propio, si lo tiene (si no, el de su tipo).
        "ancho": _entre(_numero(crudo.get("width"), None), 0.5, 20),
        "trazo": str(crudo.get("dash") or "").strip().lower() if str(crudo.get("dash") or "").strip().lower()
        in TRAZOS_DE_RAYA else "",
        "hueco": _entre(_numero(crudo.get("gap"), None), 1, 80),
    }


def _entre(valor, menos, mas):
    """El número, si está entre menos y más; si no, None."""
    if valor is None or not (menos <= valor <= mas):
        return None
    return valor


def _estilo_de_raya(linea):
    """El style="" de una raya con estilo propio (grosor y trazos), o "".
    En style y no en atributos: la hoja de estilos ganaría a un atributo."""
    if not (linea["ancho"] or linea["trazo"] or linea["hueco"]):
        return ""
    w = linea["ancho"] or ANCHO_DE_RAYA.get(linea["tipo"], 3.5)
    partes = []
    if linea["ancho"]:
        partes.append("stroke-width: %.1fpx" % w)
    trazo = linea["trazo"]
    hueco = linea["hueco"] or 2 * w
    if trazo == "solid":
        partes.append("stroke-dasharray: none")
    elif trazo == "dashed":
        partes.append("stroke-dasharray: %.1fpx %.1fpx" % (3 * w, hueco))
    elif trazo == "dotted":
        partes.append("stroke-dasharray: 0.1px %.1fpx; stroke-linecap: round" % hueco)
    elif trazo == "dashdot":
        partes.append("stroke-dasharray: %.1fpx %.1fpx 0.1px %.1fpx; stroke-linecap: round" % (3 * w, hueco, hueco))
    elif linea["hueco"]:
        # Solo la separación, con los trazos de su tipo: tres anchos de
        # trazo y el hueco que diga.
        partes.append("stroke-dasharray: %.1fpx %.1fpx" % (3 * w, hueco))
    return ' style="%s"' % "; ".join(partes) if partes else ""


def _texto(crudo):
    """Un texto suelto del mapa («Mar de las Brumas»)."""
    if not isinstance(crudo, dict):
        return None
    x, y = _numero(crudo.get("x"), None), _numero(crudo.get("y"), None)
    texto = str(crudo.get("label") or crudo.get("text") or "").strip()
    if x is None or y is None or not texto:
        return None
    tamano = str(crudo.get("size") or "mediano").strip().lower()
    letra = str(crudo.get("font") or "antigua").strip().lower()
    pixeles = _numero(crudo.get("fontSize"), 0) or 0
    curva = _puntos(crudo.get("points") if isinstance(crudo.get("points"), list) else [])
    return {"x": x, "y": y, "texto": texto,
            "curva": curva if len(curva) >= 2 else [],
            "tamano": tamano if tamano in TAMANOS_DE_TEXTO else "mediano",
            "pixeles": pixeles if 0 < pixeles <= 5000 else 0,
            "letra": letra if letra in LETRAS_DE_TEXTO else "antigua",
            "cursiva": crudo.get("italic") is not False,
            "giro": max(-180.0, min(180.0, _numero(crudo.get("angle"), 0.0) or 0.0)),
            "color": _color(crudo.get("color"))}


def _emblema(crudo):
    """Un emblema: un escudo con una imagen dentro, en un punto."""
    if not isinstance(crudo, dict):
        return None
    x, y = _numero(crudo.get("x"), None), _numero(crudo.get("y"), None)
    if x is None or y is None:
        return None
    forma = str(crudo.get("shape") or "escudo").strip().lower()
    tamano = str(crudo.get("size") or "mediano").strip().lower()
    return {"x": x, "y": y,
            "etiqueta": str(crudo.get("label") or "").strip(),
            "pagina": str(crudo.get("targetPage") or "").strip(),
            "mapa": str(crudo.get("targetMap") or "").strip(),
            "imagen": str(crudo.get("image") or "").strip(),
            "forma": forma if forma in FORMAS_DE_EMBLEMA else "escudo",
            "tamano": tamano if tamano in TAMANOS_DE_EMBLEMA else "mediano",
            "color": _color(crudo.get("color"))}


# LA FORMA DE CADA TIPO DE SITIO: la de su bola (con su símbolo dentro) y
# la que toma como emblema con «según su tipo» ("shape": "tipo"). Así un
# pueblo, una ciudad y una ruina se distinguen por la forma y no solo por
# el color: círculo, hexágono, rombo…
FORMA_POR_TIPO = {"capital": "escudo", "ciudad": "hexagono", "pueblo": "redondo", "fortaleza": "cuadrado",
                  "ruina": "rombo", "puerto": "octogono", "templo": "casa", "torre": "torre",
                  "cueva": "cupula", "mina": "triangulo-abajo", "puente": "pildora", "batalla": "estrella",
                  "mazmorra": "cruz", "campamento": "triangulo"}


def _poligono(puntos):
    return "M" + " L".join("%s %s" % (_cifra(x), _cifra(y)) for x, y in puntos) + " Z"


def _forma_de_emblema(forma, r, tipo=""):
    """El contorno de un emblema (o de la bola de un sitio) de «radio» r,
    centrado en (0, 0), y lo que baja por debajo (para poner el nombre).
    forma "tipo": la de su tipo (FORMA_POR_TIPO)."""
    c = _cifra
    if forma == "tipo":
        forma = FORMA_POR_TIPO.get(tipo, "redondo")
    if forma == "bandera":
        return _poligono([(-1.3 * r, -0.9 * r), (1.3 * r, -0.9 * r), (1.3 * r, 0.9 * r), (-1.3 * r, 0.9 * r)]), 0.9 * r
    if forma == "redondo":
        return ("M%s 0 A%s %s 0 1 0 %s 0 A%s %s 0 1 0 %s 0 Z"
                % (c(-1.2 * r), c(1.2 * r), c(1.2 * r), c(1.2 * r), c(1.2 * r), c(1.2 * r), c(-1.2 * r))), 1.2 * r
    if forma == "cuadrado":
        return _poligono([(-1.05 * r, -1.05 * r), (1.05 * r, -1.05 * r), (1.05 * r, 1.05 * r), (-1.05 * r, 1.05 * r)]), 1.05 * r
    if forma == "rombo":
        return _poligono([(0, -1.4 * r), (1.2 * r, 0), (0, 1.4 * r), (-1.2 * r, 0)]), 1.4 * r
    if forma in ("hexagono", "octogono"):
        lados = 6 if forma == "hexagono" else 8
        giro = -90 if lados == 6 else -90 + 22.5
        radio = 1.25 * r if lados == 6 else 1.2 * r
        puntos = [(radio * math.cos(math.radians(giro + k * 360 / lados)),
                   radio * math.sin(math.radians(giro + k * 360 / lados))) for k in range(lados)]
        return _poligono(puntos), max(y for _, y in puntos)
    if forma == "triangulo":
        return _poligono([(0, -1.45 * r), (1.35 * r, 0.95 * r), (-1.35 * r, 0.95 * r)]), 0.95 * r
    if forma == "triangulo-abajo":
        return _poligono([(-1.35 * r, -0.95 * r), (1.35 * r, -0.95 * r), (0, 1.45 * r)]), 1.45 * r
    if forma == "casa":
        return _poligono([(-1.05 * r, 1.05 * r), (-1.05 * r, -0.2 * r), (0, -1.35 * r), (1.05 * r, -0.2 * r),
                          (1.05 * r, 1.05 * r)]), 1.05 * r
    if forma == "torre":
        return _poligono([(-0.8 * r, 1.2 * r), (-0.8 * r, -1.35 * r), (0.8 * r, -1.35 * r), (0.8 * r, 1.2 * r)]), 1.2 * r
    if forma == "cupula":
        return ("M%s %s V0 A%s %s 0 0 1 %s 0 V%s Z" % (c(-1.2 * r), c(0.9 * r), c(1.2 * r), c(1.2 * r), c(1.2 * r),
                                                     c(0.9 * r))), 0.9 * r
    if forma == "pildora":
        return ("M%s %s H%s A%s %s 0 0 1 %s %s H%s A%s %s 0 0 1 %s %s Z"
                % (c(-0.6 * r), c(-0.8 * r), c(0.6 * r), c(0.8 * r), c(0.8 * r), c(0.6 * r), c(0.8 * r),
                   c(-0.6 * r), c(0.8 * r), c(0.8 * r), c(-0.6 * r), c(-0.8 * r))), 0.8 * r
    if forma == "estrella":
        puntos = []
        for k in range(8):
            largo = 1.45 * r if k % 2 == 0 else 0.6 * r
            angulo = math.radians(-90 + k * 45)
            puntos.append((largo * math.cos(angulo), largo * math.sin(angulo)))
        return _poligono(puntos), 1.45 * r
    if forma == "cruz":
        a, b = 0.45 * r, 1.3 * r
        return _poligono([(-a, -b), (a, -b), (a, -a), (b, -a), (b, a), (a, a), (a, b), (-a, b), (-a, a), (-b, a),
                          (-b, -a), (-a, -a)]), b
    # El escudo de siempre: arriba recto y abajo en punta redondeada.
    return ("M%s %s H%s V0 C%s %s %s %s 0 %s C%s %s %s %s %s 0 Z"
            % (c(-1.1 * r), c(-1.3 * r), c(1.1 * r),
               c(1.1 * r), c(0.9 * r), c(0.4 * r), c(1.15 * r), c(1.35 * r),
               c(-0.4 * r), c(1.15 * r), c(-1.1 * r), c(0.9 * r), c(-1.1 * r))), 1.35 * r


def _marca_de_leyenda(tipo, suyos, emblema_a, n):
    """Un SVG pequeño con un sitio de ese tipo tal y como se ve en el mapa
    (para la leyenda). Con las mismas clases que en el mapa, así que lo
    pinta la misma hoja de estilos."""
    r = 10
    emblemas = [p for p in suyos if p.get("forma")]
    if emblemas:
        ejemplo = next((p for p in emblemas if p.get("imagen")), emblemas[0])
        contorno, _ = _forma_de_emblema(ejemplo["forma"], r, tipo)
        url = emblema_a(ejemplo["imagen"]) if (emblema_a and ejemplo.get("imagen")) else ""
        recorte = "mapa-leyenda-recorte-%d" % n
        dentro = ['<clipPath id="%s"><path d="%s"></path></clipPath>' % (recorte, contorno),
                  '<path class="mapa-emblema-fondo" d="%s"%s></path>'
                  % (contorno, (' style="fill: %s"' % ejemplo["color"]) if ejemplo.get("color") else "")]
        if url:
            dentro.append('<image href="%s" x="-14" y="-14" width="28" height="28" preserveAspectRatio="xMidYMid slice"'
                          ' clip-path="url(#%s)"></image>' % (html.escape(url, quote=True), recorte))
        else:
            dentro.append('<text class="mapa-pin-letra" x="0" y="0" font-size="11" text-anchor="middle"'
                          ' dominant-baseline="central">%s\ufe0e</text>' % TIPOS_DE_PIN[tipo][0])
        dentro.append('<path class="mapa-emblema-marco" d="%s" stroke-width="1.6"></path>' % contorno)
        cuerpo = '<g class="mapa-pin mapa-emblema con-tipo es-%s">%s</g>' % (tipo, "".join(dentro))
    else:
        cuerpo = '<g class="mapa-pin con-tipo es-%s">%s</g>' % (tipo, _simbolo_de_pin(tipo, r * 1.15, 2, ""))
    return ('<svg viewBox="-15 -15 30 30" width="34" height="34" focusable="false">%s</svg>' % cuerpo)


def _escala(crudo):
    """{pixeles, distancia, unidad, viaje} o None."""
    if not isinstance(crudo, dict):
        return None
    pixeles, distancia = _numero(crudo.get("pixels"), 0), _numero(crudo.get("distance"), 0)
    if not pixeles or not distancia or pixeles <= 0 or distancia <= 0:
        return None
    viaje = crudo.get("travel") if isinstance(crudo.get("travel"), dict) else {}
    return {"pixeles": pixeles, "distancia": distancia,
            "unidad": str(crudo.get("unit") or "").strip()[:20],
            "viaje": {str(k)[:20]: v for k, v in viaje.items()
                      if isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0}}


def _simbolo_de_pin(tipo, radio, grosor, pintura):
    """El dibujo de un sitio según su tipo, centrado en (0, 0). Siempre
    lleva una pieza con la clase mapa-pin-bola, que es la que se resalta
    al pasar por encima."""
    r = radio
    def num(v):
        return _cifra(v)
    if tipo == "capital":
        # Un círculo con una estrella dentro.
        puntas = []
        for i in range(10):
            angulo = math.pi / 2 + i * math.pi / 5
            largo = r * (0.62 if i % 2 == 0 else 0.26)
            puntas.append("%s %s" % (num(largo * math.cos(angulo)), num(-largo * math.sin(angulo))))
        return ('<circle class="mapa-pin-bola" cx="0" cy="0" r="%s"%s stroke-width="%d"></circle>'
                '<path class="mapa-pin-marca" d="M%sZ"></path>'
                % (num(r * 1.05), pintura, grosor, " L".join(puntas)))
    if tipo == "ciudad":
        # Un hexágono con un punto: se distingue del pueblo (un círculo)
        # por la forma, no solo por el tamaño.
        return ('<path class="mapa-pin-bola" d="%s"%s stroke-width="%d"></path>'
                '<circle class="mapa-pin-marca" cx="0" cy="0" r="%s"></circle>'
                % (_forma_de_emblema("hexagono", r * 0.78)[0], pintura, grosor, num(r * 0.36)))
    if tipo == "pueblo":
        return ('<circle class="mapa-pin-bola" cx="0" cy="0" r="%s"%s stroke-width="%d"></circle>'
                % (num(r * 0.55), pintura, grosor))
    if tipo == "fortaleza":
        # Una torre con almenas.
        a, b = r * 0.8, r * 0.95
        d = ("M%s %s L%s %s L%s %s L%s %s L%s %s L%s %s L%s %s L%s %s L%s %s L%s %s Z"
             % (num(-a), num(b), num(-a), num(-b), num(-a / 3), num(-b), num(-a / 3), num(-b / 2),
                num(a / 3), num(-b / 2), num(a / 3), num(-b), num(a), num(-b), num(a), num(b),
                num(-a), num(b), num(-a), num(b)))
        return ('<path class="mapa-pin-bola" d="%s"%s stroke-width="%d"></path>' % (d, pintura, grosor))
    if tipo == "ruina":
        # Un rombo roto con una cruz: lo que queda de algo.
        d = "M0 %s L%s 0 L0 %s L%s 0 Z" % (num(-r), num(r), num(r), num(-r))
        cruz = "M%s %s L%s %s M%s %s L%s %s" % (num(-r * .4), num(-r * .4), num(r * .4), num(r * .4),
                                                 num(r * .4), num(-r * .4), num(-r * .4), num(r * .4))
        return ('<path class="mapa-pin-bola" d="%s"%s stroke-width="%d"></path>'
                '<path class="mapa-pin-marca es-raya" d="%s" stroke-width="%d"></path>'
                % (d, pintura, grosor, cruz, max(2, grosor)))
    if tipo in TIPOS_DE_PIN:
        # La forma de su tipo (FORMA_POR_TIPO: octógono el puerto, casa el
        # templo, píldora el puente…) con su símbolo escrito dentro (el
        # U+FE0E de detrás pide «como letra, no como emoji de colores»).
        return ('<path class="mapa-pin-bola" d="%s"%s stroke-width="%d"></path>'
                '<text class="mapa-pin-letra" x="0" y="0" font-size="%s" text-anchor="middle"'
                ' dominant-baseline="central">%s\ufe0e</text>'
                % (_forma_de_emblema("tipo", r * 0.8, tipo)[0], pintura, grosor, num(r * 0.95),
                   TIPOS_DE_PIN[tipo][0]))
    return ""


def _trazo_abierto(puntos):
    """Como _trazo, pero sin cerrar: un camino o un río."""
    return _trazo(puntos)[:-1]


def _largos(puntos):
    """Lo andado hasta cada punto, desde el primero."""
    acumulado = [0.0]
    for (x1, y1), (x2, y2) in zip(puntos, puntos[1:]):
        acumulado.append(acumulado[-1] + math.hypot(x2 - x1, y2 - y1))
    return acumulado


def _punto_a(puntos, acumulado, s):
    """El punto que está a s de distancia del primero, por la raya, y hacia
    dónde va la raya ahí (en grados)."""
    for i in range(1, len(puntos)):
        if acumulado[i] >= s or i == len(puntos) - 1:
            (x1, y1), (x2, y2) = puntos[i - 1], puntos[i]
            tramo = (acumulado[i] - acumulado[i - 1]) or 1
            f = max(0.0, min(1.0, (s - acumulado[i - 1]) / tramo))
            return (x1 + (x2 - x1) * f, y1 + (y2 - y1) * f), math.degrees(math.atan2(y2 - y1, x2 - x1))
    return puntos[0], 0.0


def _rio_que_se_ensancha(puntos, clase, color, trozos=8, ancho=None):
    """El río en ocho trozos seguidos, cada uno algo más gordo que el
    anterior: fino donde nace (el primer punto) y ancho en la
    desembocadura. El grosor va en píxeles de pantalla (como el resto de
    las rayas, ver la hoja de estilos), en un style="" porque la hoja le
    pone uno fijo a .mapa-linea.es-rio."""
    acumulado = _largos(puntos)
    total = acumulado[-1]
    if total <= 0:
        return ""
    salida = []
    for k in range(trozos):
        a, b = total * k / trozos, total * (k + 1) / trozos
        (inicio, _), (fin, _) = _punto_a(puntos, acumulado, a), _punto_a(puntos, acumulado, b)
        tramo = [inicio] + [p for p, s in zip(puntos, acumulado) if a < s < b] + [fin]
        # De 2 a 7,5 px; con un grosor propio, de su 45% a su 160%.
        grueso = (ancho * (0.45 + 1.15 * (k + 0.5) / trozos)) if ancho else 2 + 5.5 * (k + 0.5) / trozos
        salida.append('<path class="%s es-tramo" d="%s"%s style="stroke-width: %.1fpx" fill="none"></path>'
                      % (clase, _trazo_abierto(tramo), color, grueso))
    return "".join(salida)


def _flechas(puntos, radio, color):
    """Las flechas de una ruta de viaje, hacia donde va (del primer punto
    al último). Como los pines, miden lo mismo en pantalla: llevan
    data-mapa-xy y su giro, y mundo-mapa.js les pone el scale."""
    acumulado = _largos(puntos)
    total = acumulado[-1]
    if total <= 0:
        return ""
    cuantas = max(1, min(12, round(total / (radio * 9))))
    r = radio * 0.6
    forma = "M%s %s L%s 0 L%s %s Z" % (_cifra(-r), _cifra(-r * 0.75), _cifra(r), _cifra(-r), _cifra(r * 0.75))
    pintura = (' fill="%s"' % color) if color else ""
    salida = []
    for j in range(cuantas):
        (x, y), giro = _punto_a(puntos, acumulado, total * (j + 0.5) / cuantas)
        sitio = "%s,%s" % (_cifra(x), _cifra(y))
        salida.append('<path class="mapa-flecha" d="%s"%s transform="translate(%s) rotate(%s)"'
                      ' data-mapa-xy="%s" data-mapa-giro="%s"></path>'
                      % (forma, pintura, sitio, _cifra(giro), sitio, _cifra(giro)))
    return "".join(salida)


# =========================================
# LOS PUENTES
# =========================================
# Donde un camino o un sendero cruza un río va un puente, solo: no está en
# el .cmap, se calcula al pintar (la misma cuenta que el editor de mapas,
# puentesDelMapa en mapas.js). Cuenta como cruce el que pasa de un lado al
# otro del río; un camino que acaba en la orilla, o que la toca y vuelve,
# no lleva puente, y dos cruces muy juntos del mismo camino son uno.
RAYAS_CON_PUENTE = ("camino", "sendero")
COLOR_DE_CAMINO = {"camino": "#f0dfb4", "sendero": "#e2cf9f"}


def _caja(puntos):
    xs = [p[0] for p in puntos]
    ys = [p[1] for p in puntos]
    return min(xs), min(ys), max(xs), max(ys)


def _se_tocan(a, b):
    return a[0] <= b[2] and b[0] <= a[2] and a[1] <= b[3] and b[1] <= a[3]


def _lado(c, d, p):
    """De qué lado de la raya c→d cae p (lo que cae encima, del de +)."""
    return 1 if (d[0] - c[0]) * (p[1] - c[1]) - (d[1] - c[1]) * (p[0] - c[0]) >= 0 else -1


def _ancho_del_rio(rio, en_el_rio):
    """Lo que mide el río en pantalla en ese punto (0 el nacimiento, 1 la
    desembocadura), como lo pinta _rio_que_se_ensancha."""
    if rio["ensancha"] and not (rio["trazo"] and rio["trazo"] != "solid"):
        k = min(7, int(en_el_rio * 8))
        return rio["ancho"] * (0.45 + 1.15 * (k + 0.5) / 8) if rio["ancho"] else 2 + 5.5 * (k + 0.5) / 8
    return rio["ancho"] or ANCHO_DE_RAYA["rio"]


def puentes(lineas):
    """Los puentes de un mapa: [{"x", "y", "giro", "sendero", "color",
    "rio"}], con el giro del camino y lo que mide el río ahí."""
    rios = []
    for linea in lineas:
        if linea["tipo"] == "rio" and len(linea["puntos"]) >= 2:
            rios.append((linea, _caja(linea["puntos"]), _largos(linea["puntos"])))
    salida = []
    if not rios:
        return salida
    for camino in lineas:
        pc = camino["puntos"]
        if camino["tipo"] not in RAYAS_CON_PUENTE or len(pc) < 2:
            continue
        caja_camino = _caja(pc)
        largos_camino = _largos(pc)
        cruces = []
        for rio, caja_rio, largos in rios:
            if not _se_tocan(caja_camino, caja_rio):
                continue
            pr = rio["puntos"]
            total = largos[-1] or 1
            for i in range(1, len(pc)):
                a, b = pc[i - 1], pc[i]
                tramo = (min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1]))
                for j in range(1, len(pr)):
                    c, d = pr[j - 1], pr[j]
                    if not _se_tocan(tramo, (min(c[0], d[0]), min(c[1], d[1]), max(c[0], d[0]), max(c[1], d[1]))):
                        continue
                    if _lado(c, d, a) == _lado(c, d, b) or _lado(a, b, c) == _lado(a, b, d):
                        continue
                    den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0])
                    s = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den if den else 0
                    p = (a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s)
                    cruces.append({
                        "p": p, "giro": math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])), "rio": rio,
                        "en_el_rio": (largos[j - 1] + math.hypot(p[0] - c[0], p[1] - c[1])) / total,
                        "lejos": largos_camino[i - 1] + math.hypot(p[0] - a[0], p[1] - a[1]),
                    })
        # Los que caen en el mismo punto: pares, toca y vuelve; nones, cruza.
        sueltos = []
        for x in cruces:
            igual = next((y for y in sueltos if math.hypot(y["p"][0] - x["p"][0], y["p"][1] - x["p"][1]) < 0.01), None)
            if igual:
                igual["veces"] += 1
            else:
                x["veces"] = 1
                sueltos.append(x)
        ultimos = []
        for x in sorted((x for x in sueltos if x["veces"] % 2 == 1), key=lambda x: x["lejos"]):
            pr = x["rio"]["puntos"]
            if any(math.hypot(q[0] - x["p"][0], q[1] - x["p"][1]) < 0.5 for q in (pc[0], pc[-1], pr[0], pr[-1])):
                continue
            if ultimos and x["lejos"] - ultimos[-1]["lejos"] < 1:
                continue
            ultimos.append(x)
        for x in ultimos:
            salida.append({"x": x["p"][0], "y": x["p"][1], "giro": x["giro"], "sendero": camino["tipo"] == "sendero",
                           "color": camino["color"] or COLOR_DE_CAMINO[camino["tipo"]],
                           "rio": _ancho_del_rio(x["rio"], x["en_el_rio"])})
    return salida


def _puentes_svg(lineas, radio):
    """Los puentes, como los pines: dibujados en unidades del mapa para que
    con el mapa entero midan lo que en pantalla, y con data-mapa-xy para
    que mundo-mapa.js los deje de ese tamaño a cualquier zoom. El tablero,
    del color del camino, tapa el río; los pretiles, oscuros a los lados y
    abiertos en las puntas. Se pintan encima de las rayas."""
    u = radio / 15  # PIN_EN_PANTALLA de mundo-mapa.js: 15 px por radio
    salida = []
    for puente in puentes(lineas):
        largo = max(10, puente["rio"] / 2 + 6) * u
        ancho = (4 if puente["sendero"] else 5) * u
        abre = 3.5 * u
        pretiles = "".join((
            "M%s %sL%s %sL%s %sL%s %s" % (_cifra(-largo - abre), _cifra(-ancho - abre), _cifra(-largo), _cifra(-ancho),
                                         _cifra(largo), _cifra(-ancho), _cifra(largo + abre), _cifra(-ancho - abre)),
            "M%s %sL%s %sL%s %sL%s %s" % (_cifra(-largo - abre), _cifra(ancho + abre), _cifra(-largo), _cifra(ancho),
                                         _cifra(largo), _cifra(ancho), _cifra(largo + abre), _cifra(ancho + abre)),
        ))
        sitio = "%s,%s" % (_cifra(puente["x"]), _cifra(puente["y"]))
        salida.append('<g class="mapa-puente" transform="translate(%s) rotate(%s)" data-mapa-xy="%s"'
                      ' data-mapa-giro="%s"><rect x="%s" y="%s" width="%s" height="%s" fill="%s"></rect>'
                      '<path class="mapa-puente-pretil" d="%s"></path></g>'
                      % (sitio, _cifra(puente["giro"]), sitio, _cifra(puente["giro"]), _cifra(-largo),
                         _cifra(-ancho), _cifra(2 * largo), _cifra(2 * ancho), puente["color"], pretiles))
    return "".join(salida)


# =========================================
# LAS TRAMAS DE LAS ZONAS
# =========================================
# Un <pattern> por clase de zona, de lado s (en unidades del mapa: crece
# con el zoom, como lo dibujado), que se pinta ENCIMA del color de la zona.
# La tinta es oscura y medio transparente (sirve encima de cualquier
# color), y en el agua, clara.

def _trama(tipo, s, ident):
    c = _cifra
    g = s * 0.07
    oscura = ' stroke="#1b1020" stroke-opacity="0.5" fill="none" stroke-width="%s" stroke-linecap="round"' % c(g)
    if tipo == "vecino":
        # Rayado en diagonal: «esto es de fuera».
        d = "M0 %s L%s 0 M%s %s L%s %s M%s %s L%s %s" % (c(s), c(s), c(-s / 4), c(s / 4), c(s / 4), c(-s / 4),
                                                       c(s * 3 / 4), c(s * 5 / 4), c(s * 5 / 4), c(s * 3 / 4))
        dentro = '<path d="%s"%s></path>' % (d, oscura)
    elif tipo in ("lago", "mar"):
        # Olas: dos filas de ondas, en claro.
        def ola(x, y):
            return "M%s %s q%s %s %s 0 t%s 0" % (c(x), c(y), c(s * 0.12), c(-s * 0.12), c(s * 0.24), c(s * 0.24))
        dentro = ('<path d="%s %s" stroke="#ffffff" stroke-opacity="0.6" fill="none" stroke-width="%s"'
                  ' stroke-linecap="round"></path>' % (ola(s * 0.05, s * 0.3), ola(s * 0.5, s * 0.78), c(g)))
    elif tipo == "bosque":
        # Arbolitos: un triángulo con su tronco, a tresbolillo.
        def arbol(x, y):
            return ("M%s %s l%s %s l%s 0 Z M%s %s l0 %s"
                    % (c(x), c(y - s * 0.16), c(s * 0.11), c(s * 0.22), c(-s * 0.22), c(x), c(y + s * 0.06), c(s * 0.08)))
        dentro = ('<path d="%s %s" stroke="#1b1020" stroke-opacity="0.55" fill="#1b1020" fill-opacity="0.3"'
                  ' stroke-width="%s" stroke-linejoin="round"></path>' % (arbol(s * 0.25, s * 0.3), arbol(s * 0.75, s * 0.8), c(g)))
    elif tipo == "montana":
        # Montes: dos picos.
        def monte(x, y):
            return "M%s %s l%s %s l%s %s" % (c(x - s * 0.18), c(y + s * 0.1), c(s * 0.18), c(-s * 0.22), c(s * 0.18), c(s * 0.22))
        dentro = '<path d="%s %s"%s stroke-linejoin="round"></path>' % (monte(s * 0.25, s * 0.3), monte(s * 0.75, s * 0.8), oscura)
    elif tipo == "desierto":
        # Puntitos de arena.
        puntos = [(0.15, 0.2), (0.55, 0.12), (0.35, 0.5), (0.8, 0.45), (0.12, 0.78), (0.6, 0.85)]
        dentro = "".join('<circle cx="%s" cy="%s" r="%s" fill="#1b1020" fill-opacity="0.45"></circle>'
                         % (c(x * s), c(y * s), c(g * 0.9)) for x, y in puntos)
    elif tipo == "pantano":
        # Agua quieta y matas de junco.
        def mata(x, y):
            return ("M%s %s l%s 0 M%s %s l0 %s M%s %s l%s %s M%s %s l%s %s"
                    % (c(x - s * 0.14), c(y), c(s * 0.28), c(x), c(y), c(-s * 0.16), c(x - s * 0.07), c(y),
                       c(-s * 0.05), c(-s * 0.11), c(x + s * 0.07), c(y), c(s * 0.05), c(-s * 0.11)))
        dentro = '<path d="%s %s"%s></path>' % (mata(s * 0.25, s * 0.35), mata(s * 0.75, s * 0.85), oscura)
    elif tipo == "valle":
        # Hierba: matitas sueltas.
        def hierba(x, y):
            return "M%s %s l%s %s l%s %s" % (c(x - s * 0.07), c(y - s * 0.1), c(s * 0.07), c(s * 0.1), c(s * 0.07), c(-s * 0.1))
        dentro = '<path d="%s %s"%s></path>' % (hierba(s * 0.3, s * 0.3), hierba(s * 0.8, s * 0.75), oscura)
    else:
        return ""
    return ('<pattern id="%s" patternUnits="userSpaceOnUse" width="%s" height="%s">%s</pattern>'
            % (ident, c(s), c(s), dentro))


def _muestra_de_zona(tipo, color, n):
    """Un cuadradito para la leyenda: el color de la zona con su trama."""
    trama = _trama(tipo, 12, "mapa-leyenda-trama-%d" % n)
    encima = ('<rect x="1" y="1" width="32" height="20" fill="url(#mapa-leyenda-trama-%d)"></rect>' % n) if trama else ""
    return ('<svg viewBox="0 0 34 22" width="34" height="22" focusable="false"><defs>%s</defs>'
            '<rect class="mapa-leyenda-zona es-%s" x="1" y="1" width="32" height="20" fill="%s"></rect>%s</svg>'
            % (trama, tipo, color, encima))


# =========================================
# LOS TEXTOS SOBRE UNA CURVA
# =========================================
# Los puntos que se marcan en el editor se suavizan (Catmull-Rom: una curva
# que pasa por todos ellos sin picos). Si van de derecha a izquierda se
# les da la vuelta, que si no el texto sale cabeza abajo.

def _curva_suave(puntos):
    if puntos[-1][0] < puntos[0][0]:
        puntos = list(reversed(puntos))
    c = _cifra
    if len(puntos) == 2:
        return "M%s %s L%s %s" % (c(puntos[0][0]), c(puntos[0][1]), c(puntos[1][0]), c(puntos[1][1]))
    trozos = ["M%s %s" % (c(puntos[0][0]), c(puntos[0][1]))]
    for i in range(len(puntos) - 1):
        p0 = puntos[max(0, i - 1)]
        p1, p2 = puntos[i], puntos[i + 1]
        p3 = puntos[min(len(puntos) - 1, i + 2)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        trozos.append("C%s %s %s %s %s %s" % (c(c1[0]), c(c1[1]), c(c2[0]), c(c2[1]), c(p2[0]), c(p2[1])))
    return " ".join(trozos)


# =========================================
# LA ROSA DE LOS VIENTOS
# =========================================
# Ocho puntas (las cuatro grandes, partidas en claro y oscuro como las de
# los mapas antiguos), un aro dorado y las letras N, E, S y O. Del tamaño
# del mapa (crece con el zoom, como la barra de escala de dentro del
# dibujo). La misma en el editor (rosaDeLosVientos en mapas.js).

def _rosa(rincon, ancho, alto):
    base = max(ancho, alto)
    r = base / 18
    margen = r * 1.45
    x = margen if rincon.endswith("izquierda") else ancho - margen
    y = margen if rincon.startswith("arriba") else alto - margen
    c = _cifra
    trozos = ['<g class="mapa-rosa" transform="translate(%s %s)">' % (c(x), c(y)),
              '<circle class="mapa-rosa-fondo" r="%s"></circle>' % c(r * 0.8),
              '<circle class="mapa-rosa-aro" r="%s" stroke-width="%s"></circle>' % (c(r * 0.78), c(r * 0.035)),
              '<circle class="mapa-rosa-aro es-fino" r="%s" stroke-width="%s"></circle>' % (c(r * 0.68), c(r * 0.015))]
    for largo, ancho_punta, giros in ((0.58, 0.11, (45, 135, 225, 315)), (1.0, 0.15, (0, 90, 180, 270))):
        for giro in giros:
            a = math.radians(giro - 90)
            punta = (largo * r * math.cos(a), largo * r * math.sin(a))
            lado = (ancho_punta * r * math.cos(a + math.pi / 2), ancho_punta * r * math.sin(a + math.pi / 2))
            for clase, signo in (("es-clara", 1), ("es-oscura", -1)):
                trozos.append('<path class="mapa-rosa-punta %s" d="M0 0 L%s %s L%s %s Z" stroke-width="%s"></path>'
                              % (clase, c(punta[0]), c(punta[1]), c(signo * lado[0]), c(signo * lado[1]), c(r * 0.012)))
    trozos.append('<circle class="mapa-rosa-centro" r="%s"></circle>' % c(r * 0.07))
    for letra, giro, tam in (("N", 0, 0.34), ("E", 90, 0.24), ("S", 180, 0.24), ("O", 270, 0.24)):
        a = math.radians(giro - 90)
        lejos = r * 1.0 + r * tam * 0.75
        trozos.append('<text class="mapa-rosa-letra" x="%s" y="%s" font-size="%s" stroke-width="%s"'
                      ' text-anchor="middle" dominant-baseline="central">%s</text>'
                      % (c(lejos * math.cos(a)), c(lejos * math.sin(a)), c(r * tam), c(r * tam * 0.18), letra))
    trozos.append("</g>")
    return "".join(trozos)


# =========================================
# LA RED DE CAMINOS
# =========================================
# Para calcular rutas en la web («de Torrelodosa a Brujamar por los
# caminos»): los caminos, senderos y rutas hechos un grafo. Los puntos que
# caen casi en el mismo sitio son el mismo cruce; un camino que acaba
# encima de otro (sin un punto ahí) se engancha partiendo ese tramo; y cada
# sitio con nombre se engancha al camino que le pase más cerca, si le pasa
# cerca. El camino más corto lo busca mundo-mapa.js (Dijkstra).

def _red_de_caminos(lineas, sitios, ancho, alto, radio, detalle=0):
    junto = max(ancho, alto) / 400
    cerca = radio * 1.3
    # Un camino que se queda a nada de otro (a menos de medio pin) es que
    # quería llegar a él: se engancha.
    sin_salida = max(junto, radio * 0.45)
    # Con caminos de mapas regionales (juntar_regionales), las tolerancias
    # de su escala, que es más fina: con las del mapamundi se juntarían
    # cruces que no lo son y saldrían atajos.
    finos = [linea["escala_de"] for linea in lineas if linea.get("escala_de")]
    if finos:
        fino = min(1.0, min(finos))
        junto, cerca, sin_salida = junto * fino, cerca * fino, sin_salida * fino
    nodos = []
    celdas = {}

    def nodo(x, y, tol=junto):
        cx, cy = int(x // tol), int(y // tol)
        for i in range(cx - 1, cx + 2):
            for j in range(cy - 1, cy + 2):
                for n in celdas.get((i, j), ()):
                    if math.hypot(nodos[n][0] - x, nodos[n][1] - y) <= tol:
                        return n
        nodos.append((x, y))
        celdas.setdefault((cx, cy), []).append(len(nodos) - 1)
        return len(nodos) - 1

    tramos = set()
    extremos = []
    for linea in lineas:
        if linea["tipo"] not in RAYAS_DE_VIAJE:
            continue
        cuales = [nodo(x, y) for x, y in simplificar(linea["puntos"], min(detalle, linea.get("detalle") or detalle) / 2)]
        for a, b in zip(cuales, cuales[1:]):
            if a != b:
                tramos.add((min(a, b), max(a, b)))
        extremos += [cuales[0], cuales[-1]]
    if not tramos:
        return None

    def partir(x, y, tol, salvo=()):
        """El tramo más cercano a (x, y), a menos de tol: lo parte en el
        punto de encima y devuelve ese nodo (o None)."""
        mejor, lejos = None, tol
        for a, b in tramos:
            if a in salvo or b in salvo:
                continue
            (ax, ay), (bx, by) = nodos[a], nodos[b]
            dx, dy = bx - ax, by - ay
            largo = dx * dx + dy * dy
            if not largo:
                continue
            f = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / largo))
            px, py = ax + dx * f, ay + dy * f
            d = math.hypot(px - x, py - y)
            if d < lejos:
                lejos, mejor = d, (a, b, px, py, f)
        if not mejor:
            return None
        a, b, px, py, f = mejor
        if f <= 0.0001:
            return a
        if f >= 0.9999:
            return b
        nodos.append((px, py))
        n = len(nodos) - 1
        tramos.discard((a, b))
        tramos.add((min(a, n), max(a, n)))
        tramos.add((min(b, n), max(b, n)))
        return n

    # Los caminos que acaban encima de otro (o casi), enganchados a él. Sin
    # contar los puntos de su propio camino que tiene al lado, que si no se
    # enganchaba a sí mismo.
    vecinos = {}
    for a, b in tramos:
        vecinos.setdefault(a, set()).add(b)
        vecinos.setdefault(b, set()).add(a)

    def suyos(e, hasta):
        vistos, cola = {e: 0.0}, [e]
        while cola:
            n = cola.pop()
            for m in vecinos.get(n, ()):
                d = vistos[n] + math.hypot(nodos[n][0] - nodos[m][0], nodos[n][1] - nodos[m][1])
                if d <= hasta and d < vistos.get(m, 1e18):
                    vistos[m] = d
                    cola.append(m)
        return set(vistos)

    for e in set(extremos):
        sola = len(vecinos.get(e, ())) <= 1
        tol = sin_salida if sola else junto
        n = partir(nodos[e][0], nodos[e][1], tol, salvo=suyos(e, tol * 3))
        if n is not None and n != e:
            tramos.add((min(e, n), max(e, n)))
    # Y los sitios, cada uno al camino más cercano.
    en_la_red = []
    for sitio in sitios:
        x, y = sitio["x"], sitio["y"]
        n = None
        mejor = cerca
        for i, (nx, ny) in enumerate(nodos):
            d = math.hypot(nx - x, ny - y)
            if d < mejor:
                mejor, n = d, i
        if n is None or mejor > junto * 2:
            otro = partir(x, y, cerca)
            if otro is not None and (n is None or math.hypot(nodos[otro][0] - x, nodos[otro][1] - y) < mejor):
                n = otro
        if n is not None:
            en_la_red.append([n, sitio["nombre"], sitio["cual"]])
    if len(en_la_red) < 2:
        return None
    # Solo los nodos que se usan, renumerados (los de un tramo partido
    # pueden haberse quedado sueltos).
    usados = sorted({n for t in tramos for n in t} | {s[0] for s in en_la_red})
    nuevo = {n: i for i, n in enumerate(usados)}
    plano = []
    for n in usados:
        plano += [round(nodos[n][0], 1), round(nodos[n][1], 1)]
    aristas = []
    for a, b in sorted(tramos):
        aristas += [nuevo[a], nuevo[b]]
    en_la_red.sort(key=lambda s: _sin_tildes(s[1]))
    return {"p": plano, "a": aristas, "s": [[nuevo[n], nombre, cual] for n, nombre, cual in en_la_red]}


def _bonito(n):
    return ("%.2f" % n).rstrip("0").rstrip(".").replace(".", ",")


def _barra_de_escala(escala, ancho, alto):
    """La barra de escala, abajo a la izquierda, en unidades del mapa (así
    crece con el zoom, que es lo que tiene que hacer una escala). Mide un
    número redondo (1, 2 o 5 por diez a la lo que sea) de alrededor de un
    sexto del mapa. Devuelve (svg, texto para la leyenda)."""
    por_pixel = escala["distancia"] / escala["pixeles"]
    deseado = ancho / 6 * por_pixel
    potencia = 10 ** math.floor(math.log10(deseado))
    valor = next(m * potencia for m in (5, 2, 1) if m * potencia <= deseado)
    largo = valor / por_pixel
    base = max(ancho, alto)
    x0, y0, alto_barra = ancho / 40, alto - alto / 22, base / 200
    letra = base / 60
    unidad = escala["unidad"]
    texto = "%s %s" % (_bonito(valor), unidad) if unidad else _bonito(valor)
    mitad = largo / 2
    svg = ('<g class="mapa-escala">'
           '<rect class="mapa-escala-fondo" x="%s" y="%s" width="%s" height="%s"></rect>'
           '<rect class="mapa-escala-clara" x="%s" y="%s" width="%s" height="%s"></rect>'
           '<rect class="mapa-escala-oscura" x="%s" y="%s" width="%s" height="%s"></rect>'
           '<text class="mapa-escala-cifra" x="%s" y="%s" font-size="%s" stroke-width="%s">%s</text></g>'
           % (_cifra(x0 - alto_barra * 0.6), _cifra(y0 - alto_barra * 0.6), _cifra(largo + alto_barra * 1.2),
              _cifra(alto_barra * 2.2),
              _cifra(x0), _cifra(y0), _cifra(mitad), _cifra(alto_barra),
              _cifra(x0 + mitad), _cifra(y0), _cifra(mitad), _cifra(alto_barra),
              _cifra(x0), _cifra(y0 - alto_barra * 1.6), _cifra(letra), _cifra(letra * 0.2),
              html.escape(texto)))
    leyenda = "Escala: la barra de abajo a la izquierda del mapa mide %s." % texto
    if escala["viaje"]:
        dias = ", ".join("%s %s %s al día" % (como, _bonito(cuanto), unidad) for como, cuanto in escala["viaje"].items())
        leyenda += " De viaje se hacen " + dias + "."
    return svg, leyenda


def _forma(crudo):
    if not isinstance(crudo, dict):
        return None
    puntos = []
    for punto in crudo.get("points") or []:
        if isinstance(punto, dict):
            x, y = _numero(punto.get("x"), None), _numero(punto.get("y"), None)
        elif isinstance(punto, (list, tuple)) and len(punto) >= 2:
            x, y = _numero(punto[0], None), _numero(punto[1], None)
        else:
            continue
        if x is not None and y is not None:
            puntos.append((x, y))
    if len(puntos) < 3:
        return None
    return {
        "puntos": puntos,
        "color": _color(crudo.get("color")),
        "etiqueta": str(crudo.get("label") or "").strip(),
        "pagina": str(crudo.get("targetPage") or "").strip(),
        "mapa": str(crudo.get("targetMap") or "").strip(),
        "capa": str(crudo.get("layerId") or "").strip(),
        "tipo": _tipo_de_zona(crudo.get("kind")),
    }


def _tipo_de_zona(valor):
    valor = str(valor or "").strip().lower()
    return valor if valor in TIPOS_DE_ZONA else ""


def _puntos(crudo):
    """Una lista de puntos ({x, y} o [x, y]) a tuplas, sin los que no se
    entienden."""
    puntos = []
    for punto in crudo or []:
        if isinstance(punto, dict):
            x, y = _numero(punto.get("x"), None), _numero(punto.get("y"), None)
        elif isinstance(punto, (list, tuple)) and len(punto) >= 2:
            x, y = _numero(punto[0], None), _numero(punto[1], None)
        else:
            continue
        if x is not None and y is not None:
            puntos.append((x, y))
    return puntos


def _entero(valor, por_defecto):
    try:
        return int(float(valor))
    except (TypeError, ValueError):
        return por_defecto


def _numero(valor, por_defecto):
    try:
        return float(valor)
    except (TypeError, ValueError):
        return por_defecto


# Un color de los que valen: #rgb, #rrggbb. Nada más. Esto acaba metido en
# un atributo de estilo del SVG, así que no se copia lo que ponga: se
# comprueba, y lo que no cuadre se queda sin color.
RE_COLOR = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def _color(valor):
    texto = str(valor or "").strip()
    return texto if RE_COLOR.match(texto) else ""


# =========================================
# SIMPLIFICAR
# =========================================

def simplificar(puntos, tolerancia):
    """Ramer-Douglas-Peucker, sin recursión (un polígono de 2.493 puntos
    la agota). Quita los puntos que no cambian la forma más de
    "tolerancia" píxeles."""
    if tolerancia <= 0 or len(puntos) < 3:
        return puntos
    guardar = [False] * len(puntos)
    guardar[0] = guardar[-1] = True
    pila = [(0, len(puntos) - 1)]
    tol2 = tolerancia * tolerancia
    while pila:
        i, j = pila.pop()
        if j <= i + 1:
            continue
        peor, cual = 0.0, i
        ax, ay = puntos[i]
        bx, by = puntos[j]
        dx, dy = bx - ax, by - ay
        largo2 = dx * dx + dy * dy
        for n in range(i + 1, j):
            px, py = puntos[n]
            if largo2 == 0:
                d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = ((px - ax) * dx + (py - ay) * dy) / largo2
                t = 0.0 if t < 0 else (1.0 if t > 1 else t)
                d = (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2
            if d > peor:
                peor, cual = d, n
        if peor > tol2:
            guardar[cual] = True
            pila.append((i, cual))
            pila.append((cual, j))
    return [p for p, g in zip(puntos, guardar) if g]


def centro(puntos):
    """El centro de gravedad de un polígono, para poner ahí su nombre."""
    area = cx = cy = 0.0
    n = len(puntos)
    for i in range(n):
        x1, y1 = puntos[i]
        x2, y2 = puntos[(i + 1) % n]
        cruz = x1 * y2 - x2 * y1
        area += cruz
        cx += (x1 + x2) * cruz
        cy += (y1 + y2) * cruz
    if abs(area) < 1e-9:
        # Un polígono degenerado (todos los puntos en línea): la media
        # sirve igual y no divide por cero.
        return (sum(p[0] for p in puntos) / n, sum(p[1] for p in puntos) / n)
    area *= 0.5
    return (cx / (6 * area), cy / (6 * area))


def slug(texto):
    plano = "".join(c for c in unicodedata.normalize("NFD", (texto or "").lower())
                    if unicodedata.category(c) != "Mn")
    return re.sub(r"^_+|_+$", "", re.sub(r"[^a-z0-9]+", "_", plano)) or "mapa"


def _sin_tildes(texto):
    return "".join(c for c in unicodedata.normalize("NFD", (texto or "").lower())
                   if unicodedata.category(c) != "Mn")


# =========================================
# PINTAR
# =========================================
# De aquí sale el trozo de HTML que se mete en la plantilla. Dos cosas, y
# las dos importan:
#
#   el SVG         el dibujo: las capas de fondo y encima cada región.
#   la LISTA       los sitios del mapa en texto, con sus enlaces.
#
# LA LISTA NO ES UN EXTRA, ES EL MAPA EN TEXTO. Un mapa es un dibujo: si no
# se ve bien, o se navega con el teclado, o se lee con un lector de
# pantalla, el dibujo no dice nada. Así que todo lo que lleva el mapa está
# también en la lista, en orden alfabético y con el mismo enlace. Por eso el
# SVG entero va con aria-hidden y sus enlaces con tabindex="-1": no es que
# se esconda nada, es que lo mismo no se cuenta dos veces. Un tabulador que
# pasa por 123 polígonos sin nombre no es navegar.

# Un píxel por cada 2.560 del lado largo del mapa. El porqué, en la
# cabecera: así el dibujo es el mismo exporte Chronicler a 1.920 o a 7.680.
DETALLE_RELATIVO = 1 / 2560


def detalle_de(mapa):
    """Cuánto se simplifican los contornos de este mapa, si no se dice
    otra cosa."""
    return max(mapa["ancho"], mapa["alto"]) * DETALLE_RELATIVO


# =========================================
# REGIONES Y PAÍSES
# =========================================
# En el mapamundi hay dos tamaños de cosa: las REGIONES (Azarasia, Partaria,
# un archipiélago entero) y los PAÍSES que hay dentro de ellas. Dibujadas
# las dos a la vez, una región tapa a sus países. Así que el mapa enseña
# una cosa u otra, y se cambia con los mandos («ver: países / regiones»).
#
# No hace falta marcarlas en Chronicler: una forma con nombre que tiene
# dentro otra forma con nombre ES una región. Lo demás son países. Un país
# que no está dentro de ninguna región (una isla grande e independiente)
# sale en los dos modos, porque si no, en el de regiones, desaparecería
# del mapa.

def _area(puntos):
    a = 0.0
    for i, (x1, y1) in enumerate(puntos):
        x2, y2 = puntos[(i + 1) % len(puntos)]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2


def _caja(puntos):
    xs = [p[0] for p in puntos]
    ys = [p[1] for p in puntos]
    return min(xs), min(ys), max(xs), max(ys)


def _dentro(punto, puntos):
    x, y = punto
    dentro = False
    j = len(puntos) - 1
    for i in range(len(puntos)):
        xi, yi = puntos[i]
        xj, yj = puntos[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            dentro = not dentro
        j = i
    return dentro


def niveles(formas, region_de=None):
    """{índice de la forma: "region" | "pais" | "suelto"} para las formas
    con nombre. "suelto" es un país que no está en ninguna región.

    QUIÉN MANDA: las páginas de la wiki. Si alguna página dice en su ficha
    «región: [[Partaria]]», region_de lo trae ({"reino de kasa": "partaria"})
    y eso decide: Partaria es una región y el Reino de Kasa un país suyo.
    Así se corrige a mano lo que el dibujo no deja claro (unas islas que
    asoman fuera de la raya de su archipiélago).

    Sin ninguna página que lo diga, se adivina por el dibujo:
    Una forma B está dentro de otra A si A es más grande y la mayoría de
    una muestra de puntos de B (y su centro) caen dentro de A. Con muestra y
    no con todos los puntos: el mapamundi tiene 29.000 y compararlos todos
    con todos tardaba minutos."""
    con_nombre = [(i, f) for i, f in enumerate(formas)
                  if f["etiqueta"] or f["pagina"] or f["mapa"]]
    # Las páginas mandan solo si hablan de ALGUNA de estas formas: en el
    # mapa de un reino, con sus comarcas y sus valles, las páginas del
    # mapamundi no dicen nada, y entonces se mira el dibujo.
    if region_de:
        regiones = set(region_de.values())
        if not any((f["etiqueta"] or f["pagina"] or f["mapa"]).strip().lower() in regiones
                   or (f["etiqueta"] or f["pagina"] or f["mapa"]).strip().lower() in region_de
                   for _, f in con_nombre):
            region_de = None
    if region_de:
        regiones = set(region_de.values())
        salida = {}
        for i, f in con_nombre:
            nombre = (f["etiqueta"] or f["pagina"] or f["mapa"]).strip().lower()
            if nombre in regiones:
                salida[i] = "region"
            elif nombre in region_de:
                salida[i] = "pais"
            else:
                salida[i] = "suelto"
        return salida
    datos = {}
    for i, f in con_nombre:
        pts = f["puntos"]
        paso = max(1, len(pts) // 24)
        muestra = pts[::paso]
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        datos[i] = (_area(pts), _caja(pts), muestra + [(cx, cy)], pts)
    contiene = {i: False for i, _ in con_nombre}
    dentro_de_algo = {i: False for i, _ in con_nombre}
    for a, _ in con_nombre:
        area_a, caja_a, _, pts_a = datos[a]
        for b, _ in con_nombre:
            if a == b:
                continue
            area_b, caja_b, muestra_b, _ = datos[b]
            if area_b >= area_a:
                continue
            if (caja_b[2] < caja_a[0] or caja_b[0] > caja_a[2]
                    or caja_b[3] < caja_a[1] or caja_b[1] > caja_a[3]):
                continue
            if sum(_dentro(p, pts_a) for p in muestra_b) > len(muestra_b) / 2:
                contiene[a] = True
                dentro_de_algo[b] = True
    salida = {}
    for i, _ in con_nombre:
        if contiene[i]:
            salida[i] = "region"
        else:
            salida[i] = "pais" if dentro_de_algo[i] else "suelto"
    return salida


def pintar(mapa, pagina_a, mapa_a, imagen_a, detalle=None, avisar=None, region_de=None, emblema_a=None):
    """El HTML de un mapa.

    pagina_a(nombre) y mapa_a(nombre) devuelven (dirección, existe); si
    existe es False, el sitio sale en la lista marcado como «falta», que es
    el enlace rojo de las wikis. imagen_a(nombre) devuelve la dirección de
    una imagen de la bóveda, o "" si no está.
    """
    def di(que, donde=""):
        if avisar:
            avisar(que, donde)

    if detalle is None:
        detalle = detalle_de(mapa)
    ancho, alto = mapa["ancho"], mapa["alto"]
    # El grosor de las líneas va en unidades del lienzo, no en píxeles de
    # pantalla: así una raya mide lo mismo en proporción con cualquier
    # zoom y en cualquier mapa, sea de 2.000 o de 8.000 de ancho.
    grosor = max(2, round(max(ancho, alto) / 1200))
    # Un pin no es geografía, es un señalador: tiene que medir lo mismo en
    # pantalla en cualquier mapa. El SVG se pinta al ancho del lienzo —unos
    # mil píxeles en un ordenador—, así que un sesentavo del ancho del
    # lienzo son unos 16 píxeles de radio, que es lo que hace falta para
    # verlo y para darle con el dedo. Proporcional al mapa salían de 5 px.
    radio = max(8, round(ancho / 60))

    sitios = []
    capas = []
    imagenes = []
    puntos_antes = puntos_despues = 0

    # El grosor va también como propiedad, para que la hoja de estilos
    # pueda engordar la raya de una región al señalarla sin saber cuánto
    # mide el mapa: "el triple de lo normal" vale para cualquiera.
    trozos = ['<svg class="mapa-svg" viewBox="0 0 %d %d" width="%d" height="%d"'
              ' style="--mapa-grosor: %d" aria-hidden="true" focusable="false"'
              ' preserveAspectRatio="xMidYMid meet">'
              % (ancho, alto, ancho, alto, grosor)]

    # ---- LAS CAPAS ----
    for capa in mapa["capas"]:
        url = ""
        if capa["imagen"]:
            url = imagen_a(capa["imagen"])
            if url:
                imagenes.append(capa["imagen"])
            else:
                di("imagen de una capa del mapa que no encuentro", capa["imagen"])
        clase = "mapa-capa" + ("" if capa["visible"] else " es-apagada")
        trozos.append('<g class="%s" data-mapa-capa="%s">'
                      % (clase, html.escape(capa["id"], quote=True)))
        if url:
            opacidad = ""
            if capa["opacidad"] < 0.999:
                opacidad = ' opacity="%s"' % _cifra(max(0.0, min(1.0, capa["opacidad"])))
            # De entrada, la versión pequeña (1280 de ancho, la escribe
            # generar-mundo.py en preparar_capas: un cuarto de lo que pesa
            # la grande); scripts/paginas/mundo-mapa.js la cambia por la
            # grande en cuanto se acerca el mapa o la pantalla la pide.
            peque = url[:-5] + PEQUE_DE_CAPA if url.lower().endswith(".webp") else ""
            trozos.append('<image class="mapa-capa-img" href="%s"%s x="0" y="0"'
                          ' width="%d" height="%d" preserveAspectRatio="none"%s></image>'
                          % (html.escape(peque or url, quote=True),
                             ' data-mapa-grande="%s"' % html.escape(url, quote=True) if peque else "",
                             ancho, alto, opacidad))
        trozos.append("</g>")
        capas.append({"id": capa["id"], "nombre": capa["nombre"],
                      "visible": capa["visible"], "imagen": capa["imagen"]})

    # ---- LAS FORMAS ----
    # El dibujo primero y lo que se puede pulsar después, porque en SVG
    # manda el último: un polígono decorativo pintado encima de una región
    # enlazada se comería los clics.
    dibujo, vivas, vivas_regiones = [], [], []
    nivel_de = niveles(mapa["formas"], region_de)
    hay_niveles = "region" in nivel_de.values()
    # El mapa de una página (con "page") enseña de salida TODAS las zonas,
    # las grandes y las de dentro a la vez; el mapamundi, los países.
    todas_de_salida = bool(mapa.get("pagina"))
    cuantas = 0
    # DE LA MÁS GRANDE A LA MÁS PEQUEÑA: en SVG lo último tapa a lo de
    # antes, así que una zona dentro de otra se pinta después y queda
    # encima (se ve y se puede pulsar). En el orden del archivo, una zona
    # grande dibujada después se tragaba a las de dentro.
    orden = sorted(range(len(mapa["formas"])), key=lambda i: -_area(mapa["formas"][i]["puntos"]))
    # Las tramas de las clases de zona que hay (olas, árboles…), en <defs>.
    base_mapa = max(ancho, alto)
    tramas = "".join(_trama(tipo, base_mapa / 90, "mapa-trama-" + tipo)
                     for tipo in TIPOS_DE_ZONA if any(f["tipo"] == tipo for f in mapa["formas"]))
    if tramas:
        trozos.append("<defs>%s</defs>" % tramas)
    for indice in orden:
        forma = mapa["formas"][indice]
        nombre = forma["etiqueta"] or forma["pagina"] or forma["mapa"]
        destinos = _destinos(forma, pagina_a, mapa_a)

        antes = forma["puntos"]
        despues = simplificar(antes, detalle)
        puntos_antes += len(antes)
        puntos_despues += len(despues)
        coordenadas = _trazo(despues)
        tipo_zona = forma["tipo"]
        color = forma["color"] or (TIPOS_DE_ZONA[tipo_zona][1] if tipo_zona else "")
        # La trama de su clase de zona, encima del color (sin ratón: no
        # se pulsa, se pulsa lo de debajo).
        trama = ('<path class="mapa-trama es-zona-%s" d="%s" fill="url(#mapa-trama-%s)"></path>'
                 % (tipo_zona, coordenadas, tipo_zona) if tipo_zona and tipo_zona != "provincia" else "")
        de_zona = (" es-zona-" + tipo_zona) if tipo_zona else ""

        if not nombre:
            # Sin nombre y sin enlace: es el dibujo (fronteras, costas,
            # regiones que todavía no son nada). Se pinta y no se toca.
            dibujo.append('<path class="mapa-dibujo%s" d="%s"%s stroke-width="%d"></path>%s'
                          % (de_zona, coordenadas, _pintura(color), grosor, trama))
            continue

        cuantas += 1
        cual = "s%d" % cuantas
        nivel = nivel_de.get(indice, "pais")
        que_zona = TIPOS_DE_ZONA[tipo_zona][0] if tipo_zona else ""
        for uno in destinos:
            sitios.append(dict(uno, id=cual, nombre=nombre, color=color,
                               tipo="forma", icono="", region=(nivel == "region"), que=que_zona))
        # El polígono lleva al primero que exista. Si la región apunta a una
        # página Y a otro mapa —que es raro pero pasa—, el dibujo lleva a la
        # página y el mapa sale como una fila más de la lista, que es la
        # única manera de no esconder uno de los dos.
        elegido = next((d for d in destinos if d["url"]), destinos[0])
        url = elegido["url"]
        poligono = ('<path d="%s"%s stroke-width="%d"></path>%s'
                    % (coordenadas, _pintura(color), grosor, trama))
        # El <title> es el globo que enseña el navegador por su cuenta:
        # sirve sin JavaScript. Cuando hay JavaScript, mundo-mapa.js se los
        # lleva y enseña el suyo, que dice además a dónde va; por eso el
        # nombre va también en un atributo.
        titulo = "<title>%s</title>" % html.escape(nombre)
        datos = _datos_del_globo(nombre, " · ".join(x for x in (que_zona, _nota(elegido["destino"], url)) if x), "")
        # Su clase de zona, para el desplegable de «zonas» de los mandos
        # (mundo-mapa.js: apagar zonas sueltas o una clase entera).
        datos += ' data-mapa-zona="%s"' % (tipo_zona or "otra")
        suelto = (" es-suelto" if (hay_niveles and nivel == "suelto") else "") + de_zona
        destino_lista = vivas_regiones if nivel == "region" else vivas
        if url:
            # tabindex="-1": se puede pulsar con el ratón, pero no sale en
            # el recorrido del tabulador. Lo que se recorre es la lista.
            destino_lista.append('<a class="mapa-forma es-enlace%s" href="%s" data-mapa-sitio="%s"%s'
                                 ' tabindex="-1">%s%s</a>'
                                 % (suelto, html.escape(url, quote=True), cual, datos,
                                    titulo, poligono))
        else:
            destino_lista.append('<g class="mapa-forma%s" data-mapa-sitio="%s"%s>%s%s</g>'
                                 % (suelto, cual, datos, titulo, poligono))

    trozos.append('<g class="mapa-dibujos">%s</g>' % "".join(dibujo))
    if hay_niveles:
        # Las regiones, apagadas de salida: se empieza viendo los países.
        # Sin JavaScript se quedan así, que es lo más útil (los países son
        # lo que más se busca, y las regiones están en la lista de abajo).
        trozos.append('<g class="mapa-formas mapa-regiones%s" data-mapa-nivel="regiones">'
                      '%s</g>' % ("" if todas_de_salida else " es-apagada", "".join(vivas_regiones)))
        trozos.append('<g class="mapa-formas mapa-paises" data-mapa-nivel="paises">%s</g>'
                      % "".join(vivas))
    else:
        trozos.append('<g class="mapa-formas">%s</g>' % "".join(vivas))

    # ---- LOS CAMINOS Y LOS RÍOS ----
    # Rayas abiertas, debajo de los pines. Los ríos azules y más gordos,
    # los caminos a trazos: se distinguen por la forma de la raya y no
    # solo por el color. Con nombre, salen en la lista como cualquier
    # sitio, y si llevan a una página, se pueden pulsar.
    rayas = {}
    for linea in mapa.get("lineas") or []:
        simple = simplificar(linea["puntos"], min(detalle, linea.get("detalle") or detalle) / 2)
        coordenadas = _trazo_abierto(simple)
        clase = "mapa-linea es-" + linea["tipo"]
        color = (' stroke="%s"' % linea["color"]) if linea["color"] else ""
        # (grueso y no «ancho», que es lo que mide el mapa y se usa abajo)
        grueso = grosor * (3 if linea["tipo"] == "rio" else 2)
        grupo = rayas.setdefault(GRUPO_DE_RAYA.get(linea["tipo"], "otras"), [])
        if linea["tipo"] == "rio" and linea["ensancha"] and not (linea["trazo"] and linea["trazo"] != "solid"):
            raya = _rio_que_se_ensancha(simple, clase, color, ancho=linea["ancho"])
        else:
            raya = ('<path class="%s" d="%s"%s stroke-width="%d" fill="none"%s></path>'
                    % (clase, coordenadas, color, grueso, _estilo_de_raya(linea)))
        if linea["tipo"] == "ruta":
            raya += _flechas(simple, radio, linea["color"])
        nombre = linea["etiqueta"] or linea["pagina"]
        if not nombre:
            grupo.append(raya)
            continue
        cuantas += 1
        cual = "s%d" % cuantas
        destinos = _destinos(linea, pagina_a, mapa_a)
        for uno in destinos:
            sitios.append(dict(uno, id=cual, nombre=nombre, color=linea["color"], tipo="linea",
                               icono="〰" if linea["tipo"] == "rio" else "┅",
                               que=TIPOS_DE_LINEA[linea["tipo"]]))
        elegido = next((d for d in destinos if d["url"]), destinos[0])
        datos = _datos_del_globo(nombre, TIPOS_DE_LINEA[linea["tipo"]], "")
        # Una raya fina es difícil de acertar con el ratón: debajo va otra
        # gorda y transparente, que es la que recibe el puntero.
        tocar = ('<path class="mapa-linea-toque" d="%s" stroke-width="%d" fill="none"></path>'
                 % (coordenadas, grosor * 8))
        if elegido["url"]:
            grupo.append('<a class="mapa-linea-sitio es-enlace" href="%s" data-mapa-sitio="%s"%s'
                         ' tabindex="-1"><title>%s</title>%s%s</a>'
                         % (html.escape(elegido["url"], quote=True), cual, datos,
                            html.escape(nombre), tocar, raya))
        else:
            grupo.append('<g class="mapa-linea-sitio" data-mapa-sitio="%s"%s><title>%s</title>%s%s</g>'
                         % (cual, datos, html.escape(nombre), tocar, raya))
    # Un grupo por clase de raya (caminos, ríos, otras), cada uno con su
    # casilla en los mandos para encenderlo y apagarlo por separado.
    for clave, _ in NOMBRE_DE_GRUPO_DE_RAYA:
        if rayas.get(clave):
            trozos.append('<g class="mapa-lineas es-%s">%s</g>' % (clave, "".join(rayas[clave])))
    # Los puentes, encima de todas las rayas; se apagan con los caminos.
    con_puente = _puentes_svg(mapa.get("lineas") or [], radio)
    if con_puente:
        trozos.append('<g class="mapa-lineas es-caminos es-puentes">%s</g>' % con_puente)

    # ---- LOS TEXTOS SUELTOS ----
    # «Mar de las Brumas», «Montes Grises»: escritos en el mapa, del tamaño
    # del mapa (crecen con el zoom, como lo dibujado), debajo de los pines.
    base = max(ancho, alto)
    letreros = []
    curvas = 0
    for tx in mapa.get("textos") or []:
        tam = tx["pixeles"] or base / TAMANOS_DE_TEXTO[tx["tamano"]]
        giro = (' transform="rotate(%s %s %s)"' % (_cifra(tx["giro"]), _cifra(tx["x"]), _cifra(tx["y"]))
                if tx["giro"] else "")
        color = (' fill="%s"' % tx["color"]) if tx["color"] else ""
        if tx["curva"]:
            # SOBRE UNA CURVA: la curva (invisible) y el texto a lo largo
            # de ella, centrado.
            curvas += 1
            ident = "mapa-curva-%d" % curvas
            letreros.append('<path id="%s" class="mapa-texto-curva" d="%s" fill="none"></path>'
                            '<text class="mapa-texto es-letra-%s%s" font-size="%s" stroke-width="%s"'
                            ' dominant-baseline="central"%s><textPath href="#%s" startOffset="50%%"'
                            ' text-anchor="middle">%s</textPath></text>'
                            % (ident, _curva_suave(tx["curva"]), tx["letra"], "" if tx["cursiva"] else " es-recta",
                               _cifra(tam), _cifra(tam * 0.16), color, ident, html.escape(tx["texto"])))
            continue
        letreros.append('<text class="mapa-texto es-letra-%s%s" x="%s" y="%s" font-size="%s" stroke-width="%s"'
                        ' text-anchor="middle" dominant-baseline="central"%s%s>%s</text>'
                        % (tx["letra"], "" if tx["cursiva"] else " es-recta", _cifra(tx["x"]), _cifra(tx["y"]), _cifra(tam), _cifra(tam * 0.16),
                           giro, color, html.escape(tx["texto"])))
    if letreros:
        trozos.append('<g class="mapa-textos">%s</g>' % "".join(letreros))

    # ---- LOS PINES ----
    pines = []
    escondidos = 0
    recortes = 0
    # Los sitios con nombre, para la red de caminos (las rutas).
    para_la_red = []
    # Los que se ven como emblema, primero (debajo): son más grandes.
    for pin in sorted(mapa["pines"], key=lambda p: 0 if p.get("forma") else 1):
        if pin["escondido"]:
            # Marcado como invisible en Chronicler: ni se dibuja ni se
            # lista. Se cuenta para decirlo al final.
            escondidos += 1
            continue
        # Sin nombre, su tipo («Puente»), y no «sin nombre».
        sin_nombre = not (pin["etiqueta"] or pin["pagina"] or pin["mapa"])
        nombre = (pin["etiqueta"] or pin["pagina"] or pin["mapa"]
                  or (TIPOS_DE_PIN[pin["tipo"]][1].capitalize() if pin["tipo"] in TIPOS_DE_PIN else "sin nombre"))
        destinos = _destinos(pin, pagina_a, mapa_a)
        cuantas += 1
        cual = "s%d" % cuantas
        simbolo_lista, que_es = TIPOS_DE_PIN.get(pin["tipo"], ("", ""))
        if sin_nombre:
            # Ya se llama como su tipo: «Puente», y no «Puente · puente».
            que_es = ""
        if pin["etiqueta"] or pin["pagina"] or pin["mapa"]:
            para_la_red.append({"x": pin["x"], "y": pin["y"], "nombre": nombre, "cual": cual})
        for uno in destinos:
            sitios.append(dict(uno, id=cual, nombre=nombre, color=pin["color"],
                               tipo="pin", icono=pin["icono"] or simbolo_lista, que=que_es))
        elegido = next((d for d in destinos if d["url"]), destinos[0])
        url = elegido["url"]
        nota = " · ".join(x for x in (que_es, _nota(elegido["destino"], url)) if x)
        datos = _datos_del_globo(nombre, nota, "" if pin["tipo"] else pin["icono"])
        # LA CHINCHETA SE DIBUJA EN EL CENTRO Y SE COLOCA CON UN transform.
        # Así mundo-mapa.js puede añadirle un "scale" para que el pin mida
        # lo mismo en pantalla con cualquier zoom, sin recalcular nada: un
        # pin es un señalador, no un trozo de geografía, y al 600% una
        # chincheta de seis veces su tamaño tapa medio país.
        sitio = ' transform="translate(%s,%s)" data-mapa-xy="%s,%s"' % (
            _cifra(pin["x"]), _cifra(pin["y"]), _cifra(pin["x"]), _cifra(pin["y"]))
        dentro = ['<title>%s</title>' % html.escape(nombre)]
        if pin.get("forma"):
            # COMO EMBLEMA: el escudo (o la bandera, o el medallón) con la
            # imagen recortada dentro, o con el símbolo de su tipo si no
            # tiene imagen; el marco dorado, y el nombre debajo.
            recortes += 1
            r = radio * TAMANOS_DE_EMBLEMA[pin["tamano"]]
            contorno, bajo = _forma_de_emblema(pin["forma"], r, pin["tipo"])
            url_imagen = emblema_a(pin["imagen"]) if (emblema_a and pin["imagen"]) else ""
            if pin["imagen"] and not url_imagen:
                di("no encuentro la imagen de un emblema", pin["imagen"])
            recorte = "mapa-emblema-%d" % recortes
            dentro.append('<clipPath id="%s"><path d="%s"></path></clipPath>' % (recorte, contorno))
            dentro.append('<path class="mapa-emblema-fondo" d="%s"%s></path>'
                          % (contorno, (' style="fill: %s"' % pin["color"]) if pin["color"] else ""))
            if url_imagen:
                dentro.append('<image href="%s" x="%s" y="%s" width="%s" height="%s"'
                              ' preserveAspectRatio="xMidYMid slice" clip-path="url(#%s)"></image>'
                              % (html.escape(url_imagen, quote=True), _cifra(-1.4 * r), _cifra(-1.4 * r),
                                 _cifra(2.8 * r), _cifra(2.8 * r), recorte))
            elif pin["tipo"]:
                dentro.append('<text class="mapa-pin-letra" x="0" y="0" font-size="%s" text-anchor="middle"'
                              ' dominant-baseline="central">%s\ufe0e</text>'
                              % (_cifra(r * 1.05), TIPOS_DE_PIN[pin["tipo"]][0]))
            dentro.append('<path class="mapa-emblema-marco" d="%s" stroke-width="%s"></path>'
                          % (contorno, _cifra(r * 0.16)))
            if pin["etiqueta"]:
                de_cerca = "" if pin["tipo"] in SIEMPRE_CON_NOMBRE else " es-de-cerca"
                dentro.append('<text class="mapa-pin-nombre%s" x="0" y="%s" font-size="%s" stroke-width="%s"'
                              ' text-anchor="middle" dominant-baseline="hanging">%s</text>'
                              % (de_cerca, _cifra(bajo + radio * 0.35), _cifra(radio * 1.05),
                                 _cifra(radio * 0.28), html.escape(pin["etiqueta"])))
            de_tipo = " mapa-emblema" + ((" con-tipo es-" + pin["tipo"]) if pin["tipo"] else "")
            if url:
                pines.append('<a class="mapa-pin es-enlace%s" href="%s" data-mapa-sitio="%s"%s%s'
                             ' tabindex="-1">%s</a>'
                             % (de_tipo, html.escape(url, quote=True), cual, datos, sitio, "".join(dentro)))
            else:
                pines.append('<g class="mapa-pin%s" data-mapa-sitio="%s"%s%s>%s</g>'
                             % (de_tipo, cual, datos, sitio, "".join(dentro)))
            continue
        # Con tipo, el color propio va en un style="" para ganarle al del
        # tipo, que lo pone la hoja de estilos.
        pintura = ((' style="fill: %s"' if pin["tipo"] else ' fill="%s"') % pin["color"]) if pin["color"] else ""
        simbolo = _simbolo_de_pin(pin["tipo"], radio, grosor, pintura) if pin["tipo"] else ""
        if simbolo:
            dentro.append(simbolo)
        else:
            dentro.append('<circle class="mapa-pin-bola" cx="0" cy="0" r="%d"%s'
                          ' stroke-width="%d"></circle>'
                          % (radio, _pintura(pin["color"]), grosor))
        if pin["icono"] and not simbolo:
            dentro.append('<text class="mapa-pin-icono" x="0" y="0"'
                          ' font-size="%d" text-anchor="middle"'
                          ' dominant-baseline="central">%s</text>'
                          % (round(radio * 1.3), html.escape(pin["icono"])))
        # SU NOMBRE, ESCRITO AL LADO. Va dentro del pin, así que crece y
        # encoge con él (mide siempre lo mismo en pantalla). Los de las
        # capitales y las ciudades siempre; los demás, al acercarse.
        if pin["etiqueta"]:
            de_cerca = "" if pin["tipo"] in SIEMPRE_CON_NOMBRE else " es-de-cerca"
            dentro.append('<text class="mapa-pin-nombre%s" x="%s" y="0" font-size="%s"'
                          ' stroke-width="%s" dominant-baseline="central">%s</text>'
                          % (de_cerca, _cifra(radio * 1.4), _cifra(radio * 1.05), _cifra(radio * 0.28),
                             html.escape(pin["etiqueta"])))
        de_tipo = (" con-tipo es-" + pin["tipo"]) if pin["tipo"] else ""
        if url:
            pines.append('<a class="mapa-pin es-enlace%s" href="%s" data-mapa-sitio="%s"%s%s'
                         ' tabindex="-1">%s</a>'
                         % (de_tipo, html.escape(url, quote=True), cual, datos, sitio, "".join(dentro)))
        else:
            pines.append('<g class="mapa-pin%s" data-mapa-sitio="%s"%s%s>%s</g>'
                         % (de_tipo, cual, datos, sitio, "".join(dentro)))

    if pines:
        # El radio va aquí para que el JavaScript sepa de qué tamaño parte.
        trozos.append('<g class="mapa-pines" data-mapa-radio="%d">%s</g>'
                      % (radio, "".join(pines)))

    # ---- LA BARRA DE ESCALA ----
    escala = mapa.get("escala")
    texto_escala = ""
    if escala:
        barra, texto_escala = _barra_de_escala(escala, ancho, alto)
        trozos.append(barra)

    # ---- LA ROSA DE LOS VIENTOS ----
    if mapa.get("rosa"):
        trozos.append(_rosa(mapa["rosa"], ancho, alto))

    trozos.append("</svg>")
    # ---- LA RED DE CAMINOS (para las rutas, en mundo-mapa.js) ----
    red = _red_de_caminos(mapa.get("lineas") or [], para_la_red, ancho, alto, radio, detalle)
    if red:
        trozos[0] = trozos[0].replace('<svg class="mapa-svg"', '<svg class="mapa-svg" data-mapa-red="%s"'
                                      % html.escape(json.dumps(red, ensure_ascii=False, separators=(",", ":")),
                                                    quote=True), 1)
    # El radio también en el SVG: las flechas de las rutas se escalan como
    # los pines aunque el mapa no tenga ninguno.
    # Y la escala, para la barra de escala de verdad (la que pinta
    # mundo-mapa.js, que se ajusta al zoom) y para medir.
    de_escala = ""
    if escala:
        de_escala = (' data-mapa-escala-px="%s" data-mapa-escala-distancia="%s" data-mapa-escala-unidad="%s"'
                     ' data-mapa-viaje="%s"'
                     % (_cifra(escala["pixeles"]), _cifra(escala["distancia"]), html.escape(escala["unidad"], quote=True),
                        html.escape(json.dumps(escala["viaje"], ensure_ascii=False), quote=True)))
    trozos[0] = trozos[0].replace('<svg class="mapa-svg"', '<svg class="mapa-svg" data-mapa-radio="%d"%s'
                                  % (radio, de_escala), 1)
    # Con los mapas regionales dentro (juntar_regionales): más zoom, y los
    # nombres de los pueblos desde más cerca (lo lee mundo-mapa.js).
    if mapa.get("zoom_maximo"):
        trozos[0] = trozos[0].replace('<svg class="mapa-svg"', '<svg class="mapa-svg" data-mapa-zoom-maximo="%s"'
                                      ' data-mapa-cerca="%s"' % (mapa["zoom_maximo"], mapa.get("cerca") or 2), 1)

    sitios.sort(key=lambda s: (_sin_tildes(s["nombre"]), s["id"]))
    # LA LEYENDA: los tipos de sitio y de raya que salen en ESTE mapa.
    # La marca de cada tipo, COMO SE VE EN ESTE MAPA: si sus sitios van como
    # emblema, el emblema (con la imagen del primero que la tenga: la
    # capital, con su bandera); si no, su símbolo.
    usados = []
    marcas = {}
    for tipo in TIPOS_DE_PIN:
        suyos = [p for p in mapa["pines"] if p["tipo"] == tipo and not p["escondido"]]
        if suyos:
            usados.append(("pin es-" + tipo, TIPOS_DE_PIN[tipo][0], TIPOS_DE_PIN[tipo][1]))
            marcas[tipo] = _marca_de_leyenda(tipo, suyos, emblema_a, len(marcas) + 1)
    for tipo, nombre in TIPOS_DE_LINEA.items():
        if any(l["tipo"] == tipo for l in mapa.get("lineas") or []):
            usados.append(("linea es-" + tipo, "", nombre))
    # Las clases de zona, con su color y su trama.
    for tipo, (nombre, color) in TIPOS_DE_ZONA.items():
        suyas = [f for f in mapa["formas"] if f["tipo"] == tipo]
        if suyas:
            usados.append(("zona es-" + tipo, "", nombre))
            marcas["zona-" + tipo] = _muestra_de_zona(tipo, next((f["color"] for f in suyas if f["color"]), color),
                                                      len(marcas) + 1)
    leyenda = ""
    if usados or texto_escala:
        def marca(clase, simbolo):
            tipo = clase[len("pin es-"):] if clase.startswith("pin es-") else ""
            if clase.startswith("zona es-"):
                tipo = "zona-" + clase[len("zona es-"):]
            if tipo in marcas:
                return '<span class="mapa-leyenda-marca es-dibujo" aria-hidden="true">%s</span>' % marcas[tipo]
            return '<span class="mapa-leyenda-marca %s" aria-hidden="true">%s</span>' % (clase, html.escape(simbolo))
        lista = ('<ul>%s</ul>' % "".join('<li>%s%s</li>' % (marca(clase, simbolo), html.escape(nombre))
                                         for clase, simbolo, nombre in usados)) if usados else ""
        escrita = ('<p class="mapa-escala-texto">%s</p>' % html.escape(texto_escala)) if texto_escala else ""
        # Con JavaScript es un panel flotante encima del mapa, que se abre
        # con el botón «leyenda» de los mandos (mundo-mapa.js); sin él, va
        # debajo del mapa, a la vista.
        leyenda = ('<div class="mapa-leyenda" id="mapa-leyenda" data-mapa-leyenda>'
                   '<h2 class="mapa-sitios-titulo" id="mapa-leyenda-titulo">Leyenda</h2>%s%s</div>'
                   % (lista, escrita))

    return {
        "svg": "".join(trozos),
        "leyenda": leyenda,
        "hay_lineas": [clave for clave, _ in NOMBRE_DE_GRUPO_DE_RAYA if rayas.get(clave)],
        "hay_escala": bool(escala),
        "hay_ruta": bool(red),
        "hay_rosa": bool(mapa.get("rosa")),
        "hay_nombres": bool(letreros) or any(p["etiqueta"] and not p["escondido"] for p in mapa["pines"]),
        "sitios": sitios,
        "capas": capas,
        "imagenes": imagenes,
        "puntos": (puntos_antes, puntos_despues),
        "dibujo": len(dibujo),
        "niveles": hay_niveles,
        "todas_de_salida": todas_de_salida,
        "escondidos": escondidos,
    }


# =========================================
# LA VISTA EN PEQUEÑO
# =========================================
# El mismo mapa, en chico y sin nada que pulsar: un archivo .svg suelto que
# la portada de la wiki enseña con un <img> y que lleva a la página del
# mapa. Es la silueta del mundo, que se reconoce de un vistazo mucho mejor
# que las palabras «mapa interactivo».
#
# POR QUÉ UN ARCHIVO Y NO EL SVG METIDO EN LA PORTADA: así la portada sigue
# siendo una página que se edita a mano, el navegador se guarda la vista en
# su caché como cualquier imagen, y lo que se pinta no puede tocar nada de
# la página. A cambio, un SVG cargado con <img> no ve la hoja de estilos
# del sitio ni puede pedir imágenes de fuera: por eso aquí los colores van
# escritos dentro y NO se pinta la imagen de fondo del mapa, solo las
# formas.
#
# Y SE SIMPLIFICA MUCHO MÁS QUE EL MAPA DE VERDAD: esto se ve a 300px, así
# que cada punto de más es peso que no se nota. Con el mapamundi pasa de
# 29.321 puntos a unos 2.000.

def pintar_vista(mapa, detalle=None, region_de=None):
    ancho, alto = mapa["ancho"], mapa["alto"]
    if detalle is None:
        detalle = max(ancho, alto) / 320
    grosor = max(2, round(max(ancho, alto) / 600))
    trozos = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d"'
              ' width="%d" height="%d" role="img">' % (ancho, alto, ancho, alto)]
    # Los países y no las regiones: una región pintada encima tapa a los
    # suyos y la silueta sale como un borrón de un color.
    nivel_de = niveles(mapa["formas"], region_de)
    for indice, forma in enumerate(mapa["formas"]):
        if nivel_de.get(indice) == "region":
            continue
        puntos = simplificar(forma["puntos"], detalle)
        if len(puntos) < 3:
            continue
        color = forma["color"] or "#9a8fb0"
        trozos.append('<path d="%s" fill="%s" fill-opacity="0.35" stroke="%s"'
                      ' stroke-opacity="0.85" stroke-width="%d"></path>'
                      % (_trazo(puntos), color, color, grosor))
    trozos.append("</svg>")
    return "".join(trozos)


def _nota(destino, url):
    """La coletilla de un sitio: a dónde lleva, o por qué no lleva a
    ninguna parte. La misma en la lista y en el globo del mapa, que son la
    misma cosa contada dos veces."""
    if url:
        return "otro mapa" if destino == "mapa" else ""
    if destino == "mapa":
        return "falta el mapa"
    if destino == "pagina":
        return "sin página"
    return ""


def _datos_del_globo(nombre, nota, icono):
    """Lo que necesita mundo-mapa.js para enseñar el globo al pasar por
    encima: el nombre, la coletilla y el emoji. Va en atributos y no dentro
    del dibujo porque el globo es HTML, no SVG: así se puede leer, se
    puede pintar con la tipografía del sitio y cabe en varias líneas."""
    trozos = [' data-mapa-nombre="%s"' % html.escape(nombre, quote=True)]
    if nota:
        trozos.append(' data-mapa-que="%s"' % html.escape(nota, quote=True))
    if icono:
        trozos.append(' data-mapa-icono="%s"' % html.escape(icono, quote=True))
    return "".join(trozos)


def _trazo(puntos):
    """Los puntos de una región, como el "d" de un <path>.

    Van en RELATIVO ("vete 12 a la derecha y 3 abajo") y no en absoluto,
    que es lo primero que se escribió. El motivo es el peso, medido con el
    mapamundi de ejemplo: en absoluto son 129 KB que se quedan en 55 al
    comprimirlos; en relativo, 82 que se quedan en 29. La mitad. Y es la
    misma figura exacta, porque la posición se va redondeando a cada paso
    en vez de arrastrar el error.

    Un <path> en vez de un <polygon> por lo mismo: el polígono no entiende
    de relativos."""
    px, py = round(puntos[0][0]), round(puntos[0][1])
    saltos = []
    for x, y in puntos[1:]:
        x, y = round(x), round(y)
        saltos.append("%d %d" % (x - px, y - py))
        px, py = x, y
    # La Z cierra la figura: es lo que la convierte en una región y no en
    # una línea que da la vuelta.
    return "M%d %dl%sZ" % (round(puntos[0][0]), round(puntos[0][1]), ",".join(saltos))


def _destinos(crudo, pagina_a, mapa_a):
    """A dónde lleva una región o un pin. Normalmente a un sitio, pero
    puede llevar a una página Y a otro mapa, así que esto devuelve una
    lista y no un sitio suelto.

    Cada uno sale como {destino, apunta_a, url, existe}, con url vacía si
    lo que enlaza no existe todavía: eso no es un error, es el enlace rojo
    de las wikis y acaba en la lista de lo que falta por escribir."""
    cosas = []
    for destino, nombre in (("pagina", crudo["pagina"]), ("mapa", crudo["mapa"])):
        if not nombre:
            continue
        url, existe = (pagina_a if destino == "pagina" else mapa_a)(nombre)
        cosas.append({"destino": destino, "apunta_a": nombre,
                      "url": url if existe else "", "existe": existe})
    if not cosas and crudo.get("etiqueta"):
        # Sin «lleva a» puesto en el mapa, pero con nombre: si hay una
        # página de la wiki que se llama igual, lleva a ella. Así no hace
        # falta enlazar a mano en Chronicler cada una de las 120 regiones,
        # y una página nueva queda enlazada desde el mapa en cuanto existe.
        url, existe = pagina_a(crudo["etiqueta"])
        if existe:
            cosas.append({"destino": "pagina", "apunta_a": crudo["etiqueta"],
                          "url": url, "existe": True})
    if not cosas:
        # Tiene nombre pero no lleva a ninguna parte: es un sitio del mapa
        # que está dibujado y nada más. Sale en la lista igual.
        cosas.append({"destino": "", "apunta_a": "", "url": "", "existe": True})
    return cosas


def _cifra(numero):
    return ("%.2f" % numero).rstrip("0").rstrip(".") or "0"


def _pintura(color):
    """El color de una forma, como atributos del SVG.

    El color viene del .cmap, así que ya ha pasado por RE_COLOR; si no
    valía, viene vacío y la forma se queda con el color que le dé la hoja
    de estilos, que es lo que hace que cambie con el tema.

    Van como ATRIBUTOS (fill="…") y no en un style="": así la hoja de
    estilos los puede pisar, que es justo lo que hace falta en el modo de
    alto contraste del sistema, donde el color del mapa no vale. Lo
    transparentes que son lo dice el CSS con fill-opacity, no esto."""
    if not color:
        # Sin color, currentColor: lo pone la hoja de estilos y cambia con
        # el tema. Es lo que hay que escribir, y no dejarlo vacío: un SVG
        # sin fill pinta NEGRO, y un lunar negro encima de un mapa oscuro
        # es lo que salió al probarlo con un pin de color mal escrito.
        return ' fill="currentColor" stroke="currentColor"'
    return ' fill="%s" stroke="%s"' % (color, color)


# =========================================
# LA LISTA DE SITIOS
# =========================================

def pintar_lista(sitios, titulo_id="mapa-sitios-titulo"):
    if not sitios:
        return ""
    filas = []
    for sitio in sitios:
        marca = ""
        if sitio["color"]:
            # El color va en una propiedad propia y no en "background" a
            # secas para que la hoja de estilos mande: en el modo de alto
            # contraste del sistema, estos cuadraditos desaparecen.
            marca = ('<span class="mapa-sitio-color" style="--mapa-color: %s"'
                     ' aria-hidden="true"></span>' % sitio["color"])
        icono = ('<span class="mapa-sitio-icono" aria-hidden="true">%s</span>'
                 % html.escape(sitio["icono"])) if sitio["icono"] else ""
        nombre = '<span class="mapa-sitio-nombre">%s</span>' % html.escape(sitio["nombre"])
        # Las notas dicen a dónde lleva la fila, o por qué no lleva a
        # ninguna parte: un nombre sin enlace y sin explicación parece un
        # enlace roto, y lo que es en realidad es trabajo pendiente.
        aviso = " · ".join(x for x in (sitio.get("que", ""), _nota(sitio["destino"], sitio["url"])) if x)
        if not aviso and sitio.get("region"):
            aviso = "región"
        nota = ('<span class="mapa-sitio-nota">%s</span>' % aviso) if aviso else ""
        dentro = marca + icono + nombre + nota
        if sitio["url"]:
            filas.append('<li class="mapa-sitio-item"><a class="mapa-sitio es-enlace"'
                         ' href="%s" data-mapa-sitio="%s">%s</a></li>'
                         % (html.escape(sitio["url"], quote=True), sitio["id"], dentro))
        else:
            filas.append('<li class="mapa-sitio-item"><span class="mapa-sitio"'
                         ' data-mapa-sitio="%s">%s</span></li>'
                         % (sitio["id"], dentro))
    return ('<nav class="mapa-sitios" aria-labelledby="%s">'
            '<h2 class="mapa-sitios-titulo" id="%s">Lo que hay en el mapa</h2>'
            '<ul class="mapa-sitios-lista">%s</ul></nav>'
            % (titulo_id, titulo_id, "".join(filas)))


# =========================================
# LOS MANDOS
# =========================================
# El zoom y las capas. Sin JavaScript no hacen nada, así que no se pintan:
# los esconde la hoja de estilos con html:not(.js), igual que el resto del
# sitio. El mapa se sigue viendo entero y las capas salen como estuvieran
# guardadas en Chronicler.

def pintar_mandos(capas, hay_formas=True, hay_pines=False, hay_niveles=False, hay_lineas=False,
                  hay_nombres=False, todas_de_salida=False, hay_escala=False, hay_leyenda=False, hay_ruta=False,
                  hay_rosa=False):
    trozos = ['<div class="mapa-mandos" data-mapa-mandos>']
    trozos.append(
        '<div class="mapa-zoom" role="group" aria-label="Zoom del mapa">'
        '<button class="mapa-boton" type="button" data-mapa-menos'
        ' aria-label="Alejar el mapa">−</button>'
        '<span class="mapa-zoom-cifra" data-mapa-cifra role="status">100%</span>'
        '<button class="mapa-boton" type="button" data-mapa-mas'
        ' aria-label="Acercar el mapa">+</button>'
        '<button class="mapa-boton mapa-boton-ancho" type="button" data-mapa-ajustar>'
        'ajustar</button>'
        "</div>")

    # LA LEYENDA, en un panel encima del mapa que abre y cierra este botón
    # (sin JavaScript no se pinta: la leyenda está debajo, a la vista).
    if hay_leyenda:
        trozos.append(
            '<button class="mapa-boton mapa-boton-ancho" type="button" data-mapa-leyenda-boton'
            ' aria-expanded="false" aria-controls="mapa-leyenda" hidden>'
            '<span aria-hidden="true">📜</span> leyenda</button>')

    # MEDIR, si el mapa tiene escala: se pulsa de un sitio a otro y dice
    # cuánto hay y cuántos días de viaje (lo hace mundo-mapa.js; sin
    # JavaScript el botón no se pinta: lo esconde la hoja hasta que el
    # JavaScript le quita el hidden).
    if hay_escala:
        trozos.append(
            '<div class="mapa-medir" role="group" aria-label="Medir distancias">'
            '<button class="mapa-boton mapa-boton-ancho" type="button" data-mapa-medir aria-pressed="false"'
            ' hidden><span aria-hidden="true">📏</span> medir</button>'
            '<button class="mapa-boton mapa-boton-ancho" type="button" data-mapa-medir-borrar hidden>'
            'borrar la medida</button>'
            '<p class="mapa-medida" data-mapa-medida role="status"></p>'
            '</div>')

    # LA RUTA por los caminos (de un sitio a otro): el botón la enciende y
    # la apaga, y encendida abre debajo, en el mismo menú, un panel que
    # pinta mundo-mapa.js con la red que lleva el SVG (data-mapa-red).
    if hay_ruta:
        trozos.append(
            '<button class="mapa-boton mapa-boton-ancho" type="button" data-mapa-ruta-boton'
            ' aria-pressed="false" hidden>'
            '<span aria-hidden="true">🧭</span> ruta</button>')

    # QUÉ SE VE ENCIMA DEL DIBUJO. Lo primero, las regiones: un mapa
    # dibujado a mano ya trae sus fronteras pintadas, así que las manchas
    # de color por encima tapan justo lo que se quiere mirar. Apagarlas
    # deja la imagen limpia, y los sitios se siguen pulsando desde la
    # lista de abajo.
    #
    # Las capas van en el mismo grupo, pero solo si hay más de una: un
    # interruptor para quedarse sin mapa no es un interruptor.
    casillas = []
    if hay_formas and hay_niveles:
        # Países o regiones (ver niveles()), las dos cosas a la vez (las de
        # dentro encima), o nada encima de la imagen. En el mapa de una
        # página se habla de zonas y se empieza viéndolas todas.
        if todas_de_salida:
            opciones = (("todo", "todas las zonas", True), ("regiones", "solo las grandes", False),
                        ("paises", "solo las de dentro", False), ("nada", "solo la imagen", False))
        else:
            opciones = (("paises", "países", True), ("regiones", "regiones", False),
                        ("todo", "las dos", False), ("nada", "solo la imagen", False))
        for valor, texto, marcado in opciones:
            casillas.append(
                '<label class="mapa-capa-casilla"><input type="radio" name="mapa-nivel"'
                ' value="%s" data-mapa-nivel-casilla%s> %s</label>'
                % (valor, " checked" if marcado else "", texto))
    elif hay_formas:
        casillas.append(
            '<label class="mapa-capa-casilla"><input type="checkbox"'
            ' data-mapa-regiones checked> regiones</label>')
    if hay_pines:
        casillas.append(
            '<label class="mapa-capa-casilla"><input type="checkbox"'
            ' data-mapa-pines checked> pines</label>')
    # Las rayas, por grupos (hay_lineas: los que hay, de
    # NOMBRE_DE_GRUPO_DE_RAYA): caminos, ríos y otras, cada uno con la suya.
    if hay_lineas:
        grupos = hay_lineas if isinstance(hay_lineas, (list, tuple)) else [g for g, _ in NOMBRE_DE_GRUPO_DE_RAYA]
        for clave, texto in NOMBRE_DE_GRUPO_DE_RAYA:
            if clave in grupos:
                casillas.append(
                    '<label class="mapa-capa-casilla"><input type="checkbox"'
                    ' data-mapa-lineas="%s" checked> %s</label>' % (clave, texto))
    if hay_nombres:
        casillas.append(
            '<label class="mapa-capa-casilla"><input type="checkbox"'
            ' data-mapa-nombres checked> nombres</label>')
    if hay_rosa:
        casillas.append(
            '<label class="mapa-capa-casilla"><input type="checkbox"'
            ' data-mapa-rosa checked> rosa de los vientos</label>')
    if len(capas) > 1:
        for capa in capas:
            casillas.append(
                '<label class="mapa-capa-casilla"><input type="checkbox"'
                ' data-mapa-capa-casilla="%s"%s> %s</label>'
                % (html.escape(capa["id"], quote=True),
                   " checked" if capa["visible"] else "",
                   html.escape(capa["nombre"])))
    if casillas:
        trozos.append('<fieldset class="mapa-capas">'
                      '<legend class="mapa-capas-titulo">ver</legend>%s</fieldset>'
                      % "".join(casillas))
    # LAS ZONAS, UNA A UNA O POR CLASES (lagos, bosques, países vecinos…):
    # un desplegable que llena mundo-mapa.js con las que haya en el dibujo.
    if hay_formas:
        trozos.append('<details class="mapa-zonas" data-mapa-zonas hidden>'
                      '<summary class="mapa-capas-titulo">zonas</summary>'
                      '<div class="mapa-zonas-dentro" data-mapa-zonas-dentro></div></details>')
    trozos.append("</div>")
    return "".join(trozos)
