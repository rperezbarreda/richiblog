#!/usr/bin/env python3
# =========================================
# EL MAPA DE SITUACIÓN DE CADA PAÍS
# =========================================
# Para cada página de la wiki que se llame como una forma de un mapa (un
# país, una región), un recorte del mapa con ESA forma resaltada: el resto
# oscurecido, su contorno marcado y las fronteras de alrededor en fino. Va
# en el artículo de su página, después del primer párrafo, y se amplía
# pulsándolo (la lupa, ver scripts/paginas/mundo.js).
#
# Sale del dibujo de fondo del mapa (la capa con imagen del .cmap, p. ej.
# wiki/_imagenes/mapamundi_fronteras.webp) y de las formas del propio
# .cmap, así que si cambias una frontera o la imagen y pasas la wiki, el
# mapa de situación se rehace solo. Lo usa generar-mundo.py; no se pasa
# suelto.
#
#     imagenes/wiki/situacion/<nombre>.webp        1200x800, unos 75 KB
#     imagenes/wiki/situacion/peque/<nombre>.webp  360x240, unos 15 KB: la
#         miniatura de las regiones en la portada de la wiki («Busca una
#         región»); solo de las regiones, no de cada país
#
# Solo se rehace lo que haga falta: si la imagen ya está y es más nueva que
# el .cmap, que la imagen de fondo y que este archivo, se deja. Cambiar
# cómo se dibuja (aquí abajo) los rehace todos la próxima vez.

from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageEnhance
    HAY_PILLOW = True
except ImportError:
    HAY_PILLOW = False

ANCHO, ALTO = 1200, 800          # 3:2. Va a lo ancho del artículo (unos 860px)
                                 # y se amplía con la lupa, así que sobra algo
SUPER = 2                        # se dibuja al doble y se encoge: bordes suaves
MARGEN = 0.45                    # lo que se ve alrededor, en proporción a la forma
LADO_MINIMO = 0.22               # una isla pequeña no sale a pantalla completa:
                                 # como poco, este trozo del ancho del mapa. Más
                                 # pequeño y el dibujo de fondo se estira tanto
                                 # que se ve borroso.
OSCURO = 0.42                    # cuánto brillo le queda a lo que no es el país
AMARILLO = (245, 206, 108, 255)
FRONTERA = (255, 255, 255, 110)
CALIDAD = 75
PEQUE = (360, 240)               # la miniatura de la portada
CALIDAD_PEQUE = 72


def _caja(poligonos):
    xs = [x for p in poligonos for x, _ in p]
    ys = [y for p in poligonos for _, y in p]
    return min(xs), min(ys), max(xs), max(ys)


def encuadre(poligonos, ancho_mapa, alto_mapa):
    """La ventana del mapa que se recorta (x0, y0, x1, y1), en las
    coordenadas del .cmap: la forma con su margen, a 3:2 y sin salirse."""
    x0, y0, x1, y1 = _caja(poligonos)
    w, h = x1 - x0, y1 - y0
    lado = max(w, h) * (1 + 2 * MARGEN)
    lado = max(lado, ancho_mapa * LADO_MINIMO)
    cw, ch = lado, lado / (ANCHO / ALTO)
    if ch < h * (1 + 2 * MARGEN):
        ch = h * (1 + 2 * MARGEN)
        cw = ch * (ANCHO / ALTO)
    cw, ch = min(cw, ancho_mapa), min(ch, alto_mapa)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    ax = min(max(cx - cw / 2, 0), ancho_mapa - cw)
    ay = min(max(cy - ch / 2, 0), alto_mapa - ch)
    return ax, ay, ax + cw, ay + ch


def dibujar(fondo, ancho_mapa, alto_mapa, poligonos, vecinos, destino,
            tamano=(ANCHO, ALTO), calidad=CALIDAD):
    """Escribe el mapa de situación en destino. fondo es la imagen del mapa
    ya abierta (RGB); poligonos, los de la forma a resaltar; vecinos, los
    de las demás formas, para las fronteras finas. tamano, para la
    miniatura (PEQUE): las rayas no encogen por debajo de lo que miden a
    640, o en pequeño el contorno amarillo se perdería."""
    ANCHO, ALTO = tamano
    GROSOR = max(1, ANCHO / 640)     # las rayas se pensaron a 640 de ancho
    x0, y0, x1, y1 = encuadre(poligonos, ancho_mapa, alto_mapa)
    escala = fondo.width / ancho_mapa
    trozo = fondo.crop((round(x0 * escala), round(y0 * escala),
                        round(x1 * escala), round(y1 * escala)))
    W, H = ANCHO * SUPER, ALTO * SUPER
    trozo = trozo.resize((W, H), Image.LANCZOS).convert("RGB")

    def a_pixel(p):
        return ((p[0] - x0) / (x1 - x0) * W, (p[1] - y0) / (y1 - y0) * H)

    mascara = Image.new("L", (W, H), 0)
    pinta = ImageDraw.Draw(mascara)
    for pol in poligonos:
        pinta.polygon([a_pixel(p) for p in pol], fill=255)
    oscuro = ImageEnhance.Brightness(trozo).enhance(OSCURO)
    lienzo = Image.composite(trozo, oscuro, mascara).convert("RGBA")

    capa = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    raya = ImageDraw.Draw(capa)
    def g(px):
        return max(1, round(px * GROSOR * SUPER))

    for pol in vecinos:
        puntos = [a_pixel(p) for p in pol]
        raya.line(puntos + puntos[:1], fill=FRONTERA, width=g(1), joint="curve")
    for pol in poligonos:
        puntos = [a_pixel(p) for p in pol]
        raya.line(puntos + puntos[:1], fill=(0, 0, 0, 200), width=g(6), joint="curve")
        raya.line(puntos + puntos[:1], fill=AMARILLO, width=g(3), joint="curve")
    # UNA ISLA DIMINUTA se pierde aunque esté resaltada (Kukulna mide unos
    # pocos píxeles en el recorte): se le pone un círculo alrededor, como
    # en los mapas de situación de toda la vida.
    todos = [a_pixel(p) for pol in poligonos for p in pol]
    xs, ys = [p[0] for p in todos], [p[1] for p in todos]
    lado = max(max(xs) - min(xs), max(ys) - min(ys))
    if lado < 60 * GROSOR * SUPER:
        cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
        r = max(lado / 2 + 18 * GROSOR * SUPER, 34 * GROSOR * SUPER)
        raya.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(0, 0, 0, 200), width=g(6))
        raya.ellipse((cx - r, cy - r, cx + r, cy + r), outline=AMARILLO, width=g(3))
    lienzo = Image.alpha_composite(lienzo, capa).convert("RGB")
    lienzo = lienzo.resize((ANCHO, ALTO), Image.LANCZOS)
    destino.parent.mkdir(parents=True, exist_ok=True)
    lienzo.save(destino, "WEBP", quality=calidad, method=6)


def al_dia(destino, fuentes):
    """¿La imagen ya está y es más nueva que todo lo que la hace?"""
    if not destino.is_file():
        return False
    hecha = destino.stat().st_mtime
    return all(hecha >= f.stat().st_mtime for f in fuentes if f and Path(f).is_file())


# =========================================
# EL MAPA DE SITUACIÓN, PARA PULSAR
# =========================================
# Al ampliar el mapa de situación (la lupa), encima del dibujo van las
# formas de los países que se ven en el recorte, y cada una lleva a su
# página: así se salta de un país a su vecino. Esto devuelve lo que hace
# falta para dibujarlas, que generar-mundo.py guarda en
# datos/wiki/situacion/<página>.json y pinta scripts/paginas/mundo.js:
#
#     {"vista": [x, y, ancho, alto],       el recorte, en las medidas del
#                                          mapa (las mismas del .cmap)
#      "imagen": "/imagenes/wiki/situacion/<página>.webp",
#      "yo": {"titulo": …, "formas": [[x, y, x, y…], …]},
#      "vecinos": [{"titulo": …, "url": …, "formas": [[…]]}, …]}
#
# Las formas van simplificadas (sin los puntos que no cambian el dibujo a
# ese tamaño) y redondeadas: el mapamundi tiene 29.000 puntos y aquí solo
# hacen falta unos pocos cientos.

def _simplificar(puntos, tolerancia):
    """Douglas-Peucker: quita los puntos que se apartan menos de tolerancia
    de la raya entre sus vecinos."""
    if len(puntos) < 4:
        return list(puntos)
    def distancia(p, a, b):
        (x, y), (x1, y1), (x2, y2) = p, a, b
        dx, dy = x2 - x1, y2 - y1
        if dx == dy == 0:
            return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
        t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
        return ((x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2) ** 0.5
    quedan = [False] * len(puntos)
    quedan[0] = quedan[-1] = True
    pila = [(0, len(puntos) - 1)]
    while pila:
        i, j = pila.pop()
        lejos, k = 0, None
        for n in range(i + 1, j):
            d = distancia(puntos[n], puntos[i], puntos[j])
            if d > lejos:
                lejos, k = d, n
        if k is not None and lejos > tolerancia:
            quedan[k] = True
            pila += [(i, k), (k, j)]
    return [p for p, q in zip(puntos, quedan) if q]


def _plano(pol, tolerancia):
    # Con decimales solo si el recorte es tan pequeño que medio punto se
    # notaría; si no, en enteros (es un archivo de números: lo que pesa).
    cifras = 1 if tolerancia < 0.5 else 0
    salida = []
    for x, y in _simplificar(pol, tolerancia):
        salida += [int(v) if float(v).is_integer() else v for v in (round(x, cifras), round(y, cifras))]
    return salida


def para_pulsar(poligonos, otras, ancho_mapa, alto_mapa, imagen, titulo):
    """otras: [(título, url, [polígonos])] de las formas con página. Entran
    las que asoman en el recorte."""
    x0, y0, x1, y1 = encuadre(poligonos, ancho_mapa, alto_mapa)
    # Lo que mide un par de píxeles al verlo ampliado: para pulsar sobra.
    tolerancia = (x1 - x0) / 500
    vecinos = []
    for nombre, url, suyos in otras:
        dentro = []
        for pol in suyos:
            cx0, cy0, cx1, cy1 = _caja([pol])
            if cx1 < x0 or cx0 > x1 or cy1 < y0 or cy0 > y1:
                continue
            plano = _plano(pol, tolerancia)
            if len(plano) >= 6:
                dentro.append(plano)
        if dentro:
            vecinos.append({"titulo": nombre, "url": url, "formas": dentro})
    vecinos.sort(key=lambda v: v["titulo"].lower())
    return {"vista": [round(v, 1) for v in (x0, y0, x1 - x0, y1 - y0)],
            "imagen": imagen,
            "yo": {"titulo": titulo, "formas": [_plano(p, tolerancia) for p in poligonos]},
            "vecinos": vecinos}
