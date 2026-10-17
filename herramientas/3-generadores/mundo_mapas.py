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
    "lines": [ { "id": "…", "kind": "camino" | "rio",
                 "points": [ {"x": 10, "y": 20}, … ],
                 "label": "Río Lorem", "targetPage": "Río Lorem" } ]
                                        caminos y ríos: rayas abiertas

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
        "pagina": str(crudo.get("page") or "").strip(),
    }


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
    }


# LOS TIPOS DE SITIO: (símbolo para la lista y la leyenda, nombre). El
# dibujo de cada uno está en _simbolo_de_pin.
TIPOS_DE_PIN = {
    "capital": ("★", "capital"),
    "ciudad": ("◉", "ciudad"),
    "pueblo": ("●", "pueblo"),
    "fortaleza": ("♜", "fortaleza"),
    "ruina": ("✕", "ruina"),
}
TIPOS_DE_LINEA = {"camino": "camino", "rio": "río"}


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
    }


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
        return ('<circle class="mapa-pin-bola" cx="0" cy="0" r="%s"%s stroke-width="%d"></circle>'
                '<circle class="mapa-pin-marca" cx="0" cy="0" r="%s"></circle>'
                % (num(r * 0.85), pintura, grosor, num(r * 0.38)))
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
    return ""


def _trazo_abierto(puntos):
    """Como _trazo, pero sin cerrar: un camino o un río."""
    return _trazo(puntos)[:-1]


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
    }


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


def pintar(mapa, pagina_a, mapa_a, imagen_a, detalle=None, avisar=None, region_de=None):
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
    cuantas = 0
    for indice, forma in enumerate(mapa["formas"]):
        nombre = forma["etiqueta"] or forma["pagina"] or forma["mapa"]
        destinos = _destinos(forma, pagina_a, mapa_a)

        antes = forma["puntos"]
        despues = simplificar(antes, detalle)
        puntos_antes += len(antes)
        puntos_despues += len(despues)
        coordenadas = _trazo(despues)
        color = forma["color"]

        if not nombre:
            # Sin nombre y sin enlace: es el dibujo (fronteras, costas,
            # regiones que todavía no son nada). Se pinta y no se toca.
            dibujo.append('<path class="mapa-dibujo" d="%s"%s stroke-width="%d"></path>'
                          % (coordenadas, _pintura(color), grosor))
            continue

        cuantas += 1
        cual = "s%d" % cuantas
        nivel = nivel_de.get(indice, "pais")
        for uno in destinos:
            sitios.append(dict(uno, id=cual, nombre=nombre, color=color,
                               tipo="forma", icono="", region=(nivel == "region")))
        # El polígono lleva al primero que exista. Si la región apunta a una
        # página Y a otro mapa —que es raro pero pasa—, el dibujo lleva a la
        # página y el mapa sale como una fila más de la lista, que es la
        # única manera de no esconder uno de los dos.
        elegido = next((d for d in destinos if d["url"]), destinos[0])
        url = elegido["url"]
        poligono = ('<path d="%s"%s stroke-width="%d"></path>'
                    % (coordenadas, _pintura(color), grosor))
        # El <title> es el globo que enseña el navegador por su cuenta:
        # sirve sin JavaScript. Cuando hay JavaScript, mundo-mapa.js se los
        # lleva y enseña el suyo, que dice además a dónde va; por eso el
        # nombre va también en un atributo.
        titulo = "<title>%s</title>" % html.escape(nombre)
        datos = _datos_del_globo(nombre, _nota(elegido["destino"], url), "")
        suelto = " es-suelto" if (hay_niveles and nivel == "suelto") else ""
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
        trozos.append('<g class="mapa-formas mapa-regiones es-apagada" data-mapa-nivel="regiones">'
                      '%s</g>' % "".join(vivas_regiones))
        trozos.append('<g class="mapa-formas mapa-paises" data-mapa-nivel="paises">%s</g>'
                      % "".join(vivas))
    else:
        trozos.append('<g class="mapa-formas">%s</g>' % "".join(vivas))

    # ---- LOS CAMINOS Y LOS RÍOS ----
    # Rayas abiertas, debajo de los pines. Los ríos azules y más gordos,
    # los caminos a trazos: se distinguen por la forma de la raya y no
    # solo por el color. Con nombre, salen en la lista como cualquier
    # sitio, y si llevan a una página, se pueden pulsar.
    rayas = []
    for linea in mapa.get("lineas") or []:
        coordenadas = _trazo_abierto(simplificar(linea["puntos"], detalle / 2))
        clase = "mapa-linea es-" + linea["tipo"]
        color = (' stroke="%s"' % linea["color"]) if linea["color"] else ""
        ancho = grosor * (3 if linea["tipo"] == "rio" else 2)
        raya = ('<path class="%s" d="%s"%s stroke-width="%d" fill="none"></path>'
                % (clase, coordenadas, color, ancho))
        nombre = linea["etiqueta"] or linea["pagina"]
        if not nombre:
            rayas.append(raya)
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
            rayas.append('<a class="mapa-linea-sitio es-enlace" href="%s" data-mapa-sitio="%s"%s'
                         ' tabindex="-1"><title>%s</title>%s%s</a>'
                         % (html.escape(elegido["url"], quote=True), cual, datos,
                            html.escape(nombre), tocar, raya))
        else:
            rayas.append('<g class="mapa-linea-sitio" data-mapa-sitio="%s"%s><title>%s</title>%s%s</g>'
                         % (cual, datos, html.escape(nombre), tocar, raya))
    if rayas:
        trozos.append('<g class="mapa-lineas">%s</g>' % "".join(rayas))

    # ---- LOS PINES ----
    pines = []
    escondidos = 0
    for pin in mapa["pines"]:
        if pin["escondido"]:
            # Marcado como invisible en Chronicler: ni se dibuja ni se
            # lista. Se cuenta para decirlo al final.
            escondidos += 1
            continue
        nombre = pin["etiqueta"] or pin["pagina"] or pin["mapa"] or "sin nombre"
        destinos = _destinos(pin, pagina_a, mapa_a)
        cuantas += 1
        cual = "s%d" % cuantas
        simbolo_lista, que_es = TIPOS_DE_PIN.get(pin["tipo"], ("", ""))
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
        pintura = (' fill="%s"' % pin["color"]) if pin["color"] else ""
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
        de_tipo = (" es-" + pin["tipo"]) if pin["tipo"] else ""
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

    trozos.append("</svg>")

    sitios.sort(key=lambda s: (_sin_tildes(s["nombre"]), s["id"]))
    # LA LEYENDA: los tipos de sitio y de raya que salen en ESTE mapa.
    usados = []
    for tipo in TIPOS_DE_PIN:
        if any(p["tipo"] == tipo and not p["escondido"] for p in mapa["pines"]):
            usados.append(("pin es-" + tipo, TIPOS_DE_PIN[tipo][0], TIPOS_DE_PIN[tipo][1]))
    for tipo, nombre in TIPOS_DE_LINEA.items():
        if any(l["tipo"] == tipo for l in mapa.get("lineas") or []):
            usados.append(("linea es-" + tipo, "", nombre))
    leyenda = ""
    if usados:
        leyenda = ('<div class="mapa-leyenda"><h2 class="mapa-sitios-titulo">Leyenda</h2><ul>%s</ul></div>'
                   % "".join('<li><span class="mapa-leyenda-marca %s" aria-hidden="true">%s</span>%s</li>'
                             % (clase, html.escape(simbolo), html.escape(nombre))
                             for clase, simbolo, nombre in usados))

    return {
        "svg": "".join(trozos),
        "leyenda": leyenda,
        "hay_lineas": bool(rayas),
        "sitios": sitios,
        "capas": capas,
        "imagenes": imagenes,
        "puntos": (puntos_antes, puntos_despues),
        "dibujo": len(dibujo),
        "niveles": hay_niveles,
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

def pintar_mandos(capas, hay_formas=True, hay_pines=False, hay_niveles=False, hay_lineas=False):
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
        # Países o regiones (ver niveles()), o nada encima de la imagen.
        # Son radios: una cosa u otra, nunca las dos, porque una región
        # tapa a sus países.
        for valor, texto, marcado in (("paises", "países", True),
                                      ("regiones", "regiones", False),
                                      ("nada", "solo la imagen", False)):
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
    if hay_lineas:
        casillas.append(
            '<label class="mapa-capa-casilla"><input type="checkbox"'
            ' data-mapa-lineas checked> caminos y ríos</label>')
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
    trozos.append("</div>")
    return "".join(trozos)
