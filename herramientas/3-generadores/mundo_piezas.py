# =========================================
# LO QUE LAS PÁGINAS DE LA WIKI SE PONEN SOLAS
# =========================================
# Lo usa generar-mundo.py al escribir cada página. Todo sale de las fichas
# (el frontmatter de los .md), así que no hay que mantener ninguna lista a
# mano: si un lugar dice «ubicación: [[Reino de X]]», el Reino de X lo
# lista entre sus lugares; si dos facciones se dicen enemigas, las dos lo
# enseñan; si un personaje dice quiénes son sus padres, sale su árbol.
#
#   apartados_inversos   «Lugares» en un país, «Personajes» en una raza…
#   relaciones           aliados y enemigos (en las dos direcciones)
#   jerarquia            «pertenece a»: el panteón, una orden y sus ramas
#   arbol_familiar       padres, pareja, hijos (y abuelos, nietos, hermanos)
#   caja_de_navegacion   al pie: las páginas hermanas
#   piezas               lo que va en una página dentro de <div class="pieza-…">
#                        (el diagrama de relaciones, el panteón entero, el
#                        diccionario)
#
# Todo devuelve HTML ya escapado. Los nombres se comparan en minúsculas,
# que es como están las claves de «paginas» en generar-mundo.py.

import html
import math
import re
import unicodedata

RE_ENLACE = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]")


def esc(texto):
    return html.escape(str(texto or ""), quote=True)


def llano(texto):
    plano = unicodedata.normalize("NFD", str(texto or "").lower())
    return "".join(c for c in plano if unicodedata.category(c) != "Mn").strip()


def enlaces_de(valor):
    """Las páginas a las que apunta un campo de la ficha: «[[A]], [[B|b]]»
    → ["a", "b"] (en minúsculas). Un texto sin corchetes no apunta a nada."""
    if isinstance(valor, list):
        valor = ", ".join(str(v) for v in valor)
    return [m.group(1).strip().lower() for m in RE_ENLACE.finditer(str(valor or ""))]


def campo(ficha, *nombres):
    datos = ficha.get("datos") or {}
    for nombre in nombres:
        if nombre in datos and datos[nombre] not in (None, ""):
            return datos[nombre]
    return ""


def clave(ficha):
    return ficha["nombre"].strip().lower()


def enlace(ficha, actual=None):
    if actual is not None and ficha is actual:
        return '<strong aria-current="page">%s</strong>' % esc(ficha["titulo"])
    return '<a class="mundo-enlace" href="%s">%s</a>' % (esc(ficha["url"]), esc(ficha["titulo"]))


def que_es(ficha):
    return str(campo(ficha, "infobox") or "").strip()


def en_su_apartado(cuerpo, ancla, titulo, html_):
    """Pone html_ al final del apartado <h2 id="ancla"> del artículo (si
    lo has escrito, lo tuyo sale primero); si no lo hay, lo añade al final
    con ese título."""
    if not html_:
        return cuerpo
    cabeza = '<h2 id="%s">' % ancla
    i = cuerpo.find(cabeza)
    if i != -1:
        siguiente = cuerpo.find("<h2", i + len(cabeza))
        punto = siguiente if siguiente != -1 else len(cuerpo)
        return cuerpo[:punto] + html_ + "\n" + cuerpo[punto:]
    return cuerpo + '\n<h2 id="%s">%s</h2>\n%s\n' % (ancla, esc(titulo), html_)


def lista_de_fichas(fichas, actual=None, con_que=True):
    trozos = []
    for f in fichas:
        que = que_es(f) if con_que else ""
        trozos.append("<li>%s%s</li>" % (
            enlace(f, actual), ' <span class="mundo-auto-que">%s</span>' % esc(que) if que else ""))
    return '<ul class="mundo-auto-lista">%s</ul>' % "".join(trozos)


def ordenadas(fichas):
    return sorted(fichas, key=lambda f: llano(f["titulo"]))


# =========================================
# LO QUE APUNTA AQUÍ POR UN CAMPO
# =========================================
# (campo de la ficha de las OTRAS páginas, ancla y título del apartado que
# sale en la página apuntada). Un lugar «ubicación: [[Reino de X]]» sale en
# «Lugares» del Reino de X; un personaje «raza: [[Elfos]]», en «Personajes»
# de los Elfos.

# La última columna, si la hay: la etiqueta que tiene que llevar la otra
# página (un objeto mágico también tiene «ubicación», y no es un lugar).
INVERSOS = (
    (("ubicación", "ubicacion", "país", "pais"), "lugares", "Lugares", "lugares"),
    (("ubicación", "ubicacion"), "objetos", "Lo que se guarda aquí", "objetos magicos"),
    (("raza",), "personajes", "Personajes", ""),
    (("residencia",), "habitantes_conocidos", "Quién vive aquí", ""),
)


def apartados_inversos(ficha, paginas):
    salida = []
    suya = clave(ficha)
    for campos, ancla, titulo, etiqueta in INVERSOS:
        hijas = [f for f in paginas.values() if f is not ficha
                 and (not etiqueta or etiqueta in [llano(t) for t in f.get("etiquetas") or []])
                 and any(suya in enlaces_de(campo(f, c)) for c in campos)]
        if hijas:
            salida.append((ancla, titulo, lista_de_fichas(ordenadas(hijas))))
    return salida


# =========================================
# ALIADOS Y ENEMIGOS
# =========================================
# Los campos «aliados» y «enemigos» de cualquier ficha (países,
# organizaciones, deidades, personajes…). Basta con que lo diga UNO de los
# dos: si el Reino de X tiene a la Orden de Y por aliada, la Orden de Y
# también enseña al Reino de X entre sus aliados.

TIPOS_DE_RELACION = (("aliados", "Aliados"), ("enemigos", "Enemigos"))


def todas_las_relaciones(paginas):
    """{(a, b, tipo)} con a < b: cada pareja una vez."""
    salida = set()
    for f in paginas.values():
        for tipo, _ in TIPOS_DE_RELACION:
            for otra in enlaces_de(campo(f, tipo)):
                if otra in paginas and otra != clave(f):
                    a, b = sorted((clave(f), otra))
                    salida.add((a, b, tipo))
    return salida


def relaciones(ficha, paginas, todas):
    suya = clave(ficha)
    trozos = []
    for tipo, titulo in TIPOS_DE_RELACION:
        otras = [paginas[b if a == suya else a] for a, b, t in todas
                 if t == tipo and suya in (a, b)]
        if otras:
            trozos.append('<h3 class="mundo-auto-subtitulo">%s</h3>%s'
                          % (titulo, lista_de_fichas(ordenadas(otras))))
    return "".join(trozos)


def diagrama_de_relaciones(paginas, todas):
    """El diagrama de todas: cada página en un círculo y una línea entre las
    que tienen algo (seguida, aliados; a rayas, enemigos: no solo por el
    color). Debajo, lo mismo en una tabla, que es lo que lee un lector de
    pantalla y lo que se puede buscar."""
    if not todas:
        return ('<p class="mundo-auto-vacio">Todavía no hay ninguna relación apuntada. Se'
                ' apuntan en la ficha de cada página, con los campos «aliados» y'
                ' «enemigos» ([[Una página]], [[Otra]]).</p>')
    nodos = ordenadas([paginas[k] for k in {a for a, b, t in todas} | {b for a, b, t in todas}])
    n = len(nodos)
    # Más ancho que alto: los nombres van a los lados del círculo y algunos
    # son largos («Califato de Jhel'Zadir»).
    ancho, alto = 960, 640
    radio = alto / 2 - 60
    cx, cy = ancho / 2, alto / 2
    pos = {}
    for i, f in enumerate(nodos):
        angulo = -math.pi / 2 + 2 * math.pi * i / n
        pos[clave(f)] = (cx + radio * math.cos(angulo), cy + radio * math.sin(angulo), angulo)
    lineas = []
    for a, b, tipo in sorted(todas):
        x1, y1, _ = pos[a]
        x2, y2, _ = pos[b]
        lineas.append('<line class="rel-%s" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>'
                      % (tipo, x1, y1, x2, y2))
    puntos = []
    for f in nodos:
        x, y, angulo = pos[clave(f)]
        fuera = 18
        tx, ty = x + fuera * math.cos(angulo), y + fuera * math.sin(angulo)
        ancla = "start" if math.cos(angulo) > 0.2 else ("end" if math.cos(angulo) < -0.2 else "middle")
        puntos.append('<a href="%s"><circle cx="%.1f" cy="%.1f" r="9"/>'
                      '<text x="%.1f" y="%.1f" text-anchor="%s" dominant-baseline="middle">%s</text></a>'
                      % (esc(f["url"]), x, y, tx, ty, ancla, esc(f["titulo"])))
    # role="group" y no "img": dentro van los enlaces a cada página, y una
    # imagen no puede llevar cosas que se pulsan (axe: nested-interactive).
    svg = ('<svg class="mundo-relaciones-svg" viewBox="0 0 %d %d" role="group"'
           ' aria-labelledby="rel-titulo rel-desc">'
           '<title id="rel-titulo">Diagrama de relaciones</title>'
           '<desc id="rel-desc">Cada línea une dos páginas: seguida si son aliados, a rayas si'
           ' son enemigos. La tabla de debajo dice lo mismo.</desc>%s%s</svg>'
           % (ancho, alto, "".join(lineas), "".join(puntos)))
    leyenda = ('<p class="mundo-relaciones-leyenda" aria-hidden="true">'
               '<span class="rel-muestra rel-aliados"></span> aliados'
               '<span class="rel-muestra rel-enemigos"></span> enemigos</p>')
    filas = []
    for a, b, tipo in sorted(todas, key=lambda r: (llano(paginas[r[0]]["titulo"]), r[2])):
        filas.append("<tr><td>%s</td><td>%s</td><td>%s</td></tr>"
                     % (enlace(paginas[a]), "aliados" if tipo == "aliados" else "enemigos",
                        enlace(paginas[b])))
    tabla = ('<div class="mundo-tabla"><table class="mundo-relaciones-tabla"><caption>Todas las relaciones</caption>'
             '<thead><tr><th scope="col">Uno</th><th scope="col">Son</th><th scope="col">Otro</th>'
             '</tr></thead><tbody>%s</tbody></table></div>' % "".join(filas))
    return '<div class="mundo-relaciones">%s%s%s</div>' % (svg, leyenda, tabla)


# =========================================
# A QUIÉN PERTENECE: EL PANTEÓN, UNA ORDEN Y SUS RAMAS
# =========================================
# El campo «pertenece a: [[Los Heraldos]]». De ahí sale un árbol: en la
# página de arriba, todo lo que cuelga de ella; en las de abajo, el camino
# hasta arriba (en las migas).

def padres_de_jerarquia(paginas):
    """{hija: madre} por «pertenece a»."""
    salida = {}
    for f in paginas.values():
        for otra in enlaces_de(campo(f, "pertenece a")):
            if otra in paginas and otra != clave(f):
                salida[clave(f)] = otra
                break
    return salida


def _rama(nombre, paginas, hijas_de, actual, vistos):
    vistos = vistos | {nombre}
    f = paginas[nombre]
    que = que_es(f)
    dentro = "".join(_rama(h, paginas, hijas_de, actual, vistos)
                     for h in sorted(hijas_de.get(nombre, []), key=lambda k: llano(paginas[k]["titulo"]))
                     if h not in vistos)
    return '<li><span class="mundo-arbol-nodo">%s%s</span>%s</li>' % (
        enlace(f, actual), ' <span class="mundo-auto-que">%s</span>' % esc(que) if que else "",
        "<ul>%s</ul>" % dentro if dentro else "")


def hijas_de_jerarquia(padre_de):
    hijas = {}
    for h, p in padre_de.items():
        hijas.setdefault(p, []).append(h)
    return hijas


def jerarquia(ficha, paginas, padre_de):
    """El árbol de lo que cuelga de esta página, o ""."""
    hijas = hijas_de_jerarquia(padre_de)
    suya = clave(ficha)
    if suya not in hijas:
        return ""
    # Desde lo que cuelga de ella: ella misma ya es la página.
    return '<ul class="mundo-arbol">%s</ul>' % "".join(
        _rama(h, paginas, hijas, ficha, {suya})
        for h in sorted(hijas[suya], key=lambda k: llano(paginas[k]["titulo"])))


def panteon_entero(paginas, padre_de, solo=None):
    """Todos los árboles de «pertenece a» (o solo los que empiecen en una
    página de las de «solo»)."""
    hijas = hijas_de_jerarquia(padre_de)
    raices = [k for k in hijas if k not in padre_de and (solo is None or k in solo)]
    if not raices:
        return ('<p class="mundo-auto-vacio">Todavía no hay nada que cuelgue de nada. Se'
                ' apunta en la ficha de cada página con «pertenece a: [[La de arriba]]».</p>')
    return '<ul class="mundo-arbol">%s</ul>' % "".join(
        _rama(r, paginas, hijas, None, set()) for r in sorted(raices, key=lambda k: llano(paginas[k]["titulo"])))


# =========================================
# EL ÁRBOL FAMILIAR
# =========================================
# Los campos «padres», «pareja» e «hijos» de los personajes. Como con los
# aliados, basta con que lo diga uno: si la madre lista a su hija entre sus
# hijos, la hija tiene a su madre entre sus padres aunque no lo ponga.

def familias(paginas):
    padres, parejas = {}, {}
    for f in paginas.values():
        yo = clave(f)
        for p in enlaces_de(campo(f, "padres", "padre", "madre")):
            if p in paginas and p != yo:
                padres.setdefault(yo, set()).add(p)
        for h in enlaces_de(campo(f, "hijos", "hijas")):
            if h in paginas and h != yo:
                padres.setdefault(h, set()).add(yo)
        for p in enlaces_de(campo(f, "pareja", "esposa", "esposo", "consorte")):
            if p in paginas and p != yo:
                parejas.setdefault(yo, set()).add(p)
                parejas.setdefault(p, set()).add(yo)
    hijos = {}
    for h, ps in padres.items():
        for p in ps:
            hijos.setdefault(p, set()).add(h)
    return padres, hijos, parejas


def arbol_familiar(ficha, paginas, familia):
    padres, hijos, parejas = familia
    yo = clave(ficha)
    sus_padres = padres.get(yo, set())
    abuelos = set().union(*[padres.get(p, set()) for p in sus_padres]) if sus_padres else set()
    hermanos = set().union(*[hijos.get(p, set()) for p in sus_padres]) - {yo} if sus_padres else set()
    sus_hijos = hijos.get(yo, set())
    nietos = set().union(*[hijos.get(h, set()) for h in sus_hijos]) if sus_hijos else set()
    sus_parejas = parejas.get(yo, set())
    if not (sus_padres or sus_hijos or sus_parejas or hermanos):
        return ""

    def fila(titulo, claves, clase=""):
        if not claves:
            return ""
        caja = "".join('<li class="mundo-familia-persona%s">%s</li>'
                       % (" es-yo" if k == yo else clase, enlace(paginas[k], ficha))
                       for k in sorted(claves, key=lambda k: llano(paginas[k]["titulo"])))
        return ('<div class="mundo-familia-fila"><h3 class="mundo-familia-titulo">%s</h3>'
                '<ul>%s</ul></div>' % (esc(titulo), caja))

    centro = fila("Generación de %s" % ficha["titulo"],
                  {yo} | sus_parejas | hermanos, "")
    # Qué es cada uno en su generación, para quien no ve la caja resaltada.
    detalles = []
    if sus_parejas:
        detalles.append("pareja: " + ", ".join(paginas[k]["titulo"] for k in sorted(sus_parejas)))
    if hermanos:
        detalles.append("hermanos: " + ", ".join(paginas[k]["titulo"] for k in sorted(hermanos)))
    junto = "; ".join(detalles)
    nota = ('<p class="mundo-familia-nota">%s</p>' % esc(junto[:1].upper() + junto[1:])) if detalles else ""
    lista = ('<div class="mundo-familia">%s%s%s%s%s</div>'
             % (fila("Abuelos", abuelos), fila("Padres", sus_padres), centro,
                fila("Hijos", sus_hijos), fila("Nietos", nietos)))
    dibujo = dibujo_familiar(ficha, paginas, familia)
    # El dibujo, como un árbol de los de siempre; y debajo, plegado, lo
    # mismo en lista (con los hermanos, que el dibujo no lleva).
    return ('<div class="mundo-familia-dibujo">%s</div>%s'
            '<details class="mundo-familia-lista"><summary>Ver el árbol como lista</summary>%s</details>'
            % (dibujo, nota, lista))


# EL DIBUJO DEL ÁRBOL, en SVG, como los árboles genealógicos de siempre:
# arriba los abuelos (cada pareja de abuelos sobre su hijo o hija), luego
# los padres, en medio la persona (con su pareja al lado, unidas por una
# raya) y debajo sus hijos y sus nietos. Las rayas bajan de cada pareja a
# lo que sale de ella. Cada caja es un enlace a su página.

ANCHO_HUECO = 200
CAJA_ANCHO, CAJA_ALTO = 176, 64
FILA = CAJA_ALTO + 56


def _lineas_de_nombre(nombre, largo=19):
    palabras, lineas, actual = nombre.split(), [], ""
    for p in palabras:
        if actual and len(actual) + 1 + len(p) > largo:
            lineas.append(actual)
            actual = p
        else:
            actual = (actual + " " + p).strip()
    if actual:
        lineas.append(actual)
    if len(lineas) > 2:
        lineas = [lineas[0], (" ".join(lineas[1:]))[:largo - 1] + "…"]
    return lineas


def _fechas(f):
    nace = str(campo(f, "nacimiento") or "").strip().strip("*")
    muere = str(campo(f, "muerte") or "").strip().strip("*")
    nace = "" if "por decidir" in nace else nace
    muere = "" if "por decidir" in muere else muere
    if not nace and not muere:
        return ""
    texto = (nace or "?") + (" – " + muere if muere else "")
    return texto if len(texto) <= 24 else texto[:23] + "…"


def dibujo_familiar(ficha, paginas, familia):
    padres, hijos, parejas = familia
    yo = clave(ficha)
    orden = lambda ks: sorted(ks, key=lambda k: llano(paginas[k]["titulo"]))
    sus_padres = orden(padres.get(yo, set()))[:2]
    abuelos_de = [orden(padres.get(p, set()))[:2] for p in sus_padres]
    hay_abuelos = any(abuelos_de)
    sus_parejas = orden(parejas.get(yo, set()))
    sus_hijos = orden(hijos.get(yo, set()))
    nietos_de = {h: orden(hijos.get(h, set())) for h in sus_hijos}
    hay_nietos = any(nietos_de.values())

    fila_de = {}
    n = 0
    for nombre, hay in (("abuelos", hay_abuelos), ("padres", bool(sus_padres)), ("yo", True),
                        ("hijos", bool(sus_hijos)), ("nietos", hay_nietos)):
        if hay:
            fila_de[nombre] = n
            n += 1
    y_de = lambda nombre: 20 + fila_de[nombre] * FILA

    cajas, rayas = [], []   # cajas: (clave, x centro, y arriba); rayas: (x1, y1, x2, y2)
    W = ANCHO_HUECO
    # Arriba: abuelos y padres, como en un árbol de antepasados.
    x_padres = []
    for i, p in enumerate(sus_padres):
        if hay_abuelos:
            base = i * 2 * W
            xs = [base + (j + 0.5) * W for j in range(2)]
            suyos = abuelos_de[i]
            puestos = []
            for j, a in enumerate(suyos):
                cajas.append((a, xs[j], y_de("abuelos")))
                puestos.append(xs[j])
            x = base + W
            if puestos:
                _pareja_a_hijo(rayas, puestos, x, y_de("abuelos"), y_de("padres"))
        else:
            x = (i + 0.5) * W
        cajas.append((p, x, y_de("padres")))
        x_padres.append(x)
    x_yo = sum(x_padres) / len(x_padres) if x_padres else 0.5 * W
    cajas.append((yo, x_yo, y_de("yo")))
    if x_padres:
        _pareja_a_hijo(rayas, x_padres, x_yo, y_de("padres"), y_de("yo"))
    # Su pareja (o parejas), al lado, unidas por una raya a media altura.
    x_pareja = []
    for i, p in enumerate(sus_parejas):
        x = x_yo + (i + 1) * W
        cajas.append((p, x, y_de("yo")))
        x_pareja.append(x)
    if x_pareja:
        medio = y_de("yo") + CAJA_ALTO / 2
        rayas.append((x_yo + CAJA_ANCHO / 2, medio, x_pareja[0] - CAJA_ANCHO / 2, medio))
    # Abajo: hijos y nietos, cada hijo en el centro de los suyos.
    if sus_hijos:
        desde = (x_yo + x_pareja[0]) / 2 if x_pareja else x_yo
        anchos = [max(1, len(nietos_de[h])) for h in sus_hijos]
        total = sum(anchos) * W
        x = desde - total / 2
        x_hijos = []
        for h, a in zip(sus_hijos, anchos):
            centro = x + a * W / 2
            cajas.append((h, centro, y_de("hijos")))
            x_hijos.append(centro)
            if nietos_de[h]:
                xs = [x + (j + 0.5) * W for j in range(len(nietos_de[h]))]
                for nieto, xn in zip(nietos_de[h], xs):
                    cajas.append((nieto, xn, y_de("nietos")))
                _padre_a_hijos(rayas, centro, xs, y_de("hijos"), y_de("nietos"))
            x += a * W
        arranque = y_de("yo") + (CAJA_ALTO / 2 if x_pareja else CAJA_ALTO)
        _padre_a_hijos(rayas, desde, x_hijos, y_de("yo"), y_de("hijos"), arranque)

    # Todo dentro del dibujo, con un margen.
    izquierda = min(x for _, x, _ in cajas) - CAJA_ANCHO / 2 - 10
    derecha = max(x for _, x, _ in cajas) + CAJA_ANCHO / 2 + 10
    ancho = derecha - izquierda
    alto = 20 + n * FILA - 36
    dx = -izquierda
    trozos = []
    for x1, y1, x2, y2 in rayas:
        trozos.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (x1 + dx, y1, x2 + dx, y2))
    for k, x, y in cajas:
        f = paginas[k]
        es_yo = k == yo
        lineas = _lineas_de_nombre(f["titulo"])
        fechas = _fechas(f)
        filas = len(lineas) + (1 if fechas else 0)
        y_texto = y + CAJA_ALTO / 2 - (filas - 1) * 9 + 5
        texto = "".join('<tspan x="%.1f" y="%.1f">%s</tspan>' % (x + dx, y_texto + i * 18, esc(l))
                        for i, l in enumerate(lineas))
        if fechas:
            texto += '<tspan class="arbol-fechas" x="%.1f" y="%.1f">%s</tspan>' % (
                x + dx, y_texto + len(lineas) * 18, esc(fechas))
        caja = ('<rect x="%.1f" y="%.1f" width="%d" height="%d" rx="6"/>'
                '<text text-anchor="middle">%s</text>' % (x + dx - CAJA_ANCHO / 2, y, CAJA_ANCHO, CAJA_ALTO, texto))
        if es_yo:
            trozos.append('<g class="arbol-persona es-yo" aria-current="page">%s</g>' % caja)
        else:
            trozos.append('<a class="arbol-persona" href="%s">%s</a>' % (esc(f["url"]), caja))
    return ('<svg class="mundo-arbol-svg" width="%d" height="%d" viewBox="0 0 %d %d" role="group"'
            ' aria-label="Árbol familiar de %s">%s</svg>'
            % (ancho, alto, ancho, alto, esc(ficha["titulo"]), "".join(trozos)))


def _pareja_a_hijo(rayas, xs_padres, x_hijo, y_padres, y_hijo):
    """Las rayas de una pareja (o de uno solo) a su hijo: bajan de cada uno,
    se juntan en una barra y de ahí al hijo."""
    barra = y_padres + CAJA_ALTO + (FILA - CAJA_ALTO) / 2
    for x in xs_padres:
        rayas.append((x, y_padres + CAJA_ALTO, x, barra))
    puntos = list(xs_padres) + [x_hijo]
    rayas.append((min(puntos), barra, max(puntos), barra))
    rayas.append((x_hijo, barra, x_hijo, y_hijo))


def _padre_a_hijos(rayas, x_padre, xs_hijos, y_padre, y_hijos, arranque=None):
    barra = y_padre + CAJA_ALTO + (FILA - CAJA_ALTO) / 2
    rayas.append((x_padre, arranque if arranque is not None else y_padre + CAJA_ALTO, x_padre, barra))
    puntos = list(xs_hijos) + [x_padre]
    rayas.append((min(puntos), barra, max(puntos), barra))
    for x in xs_hijos:
        rayas.append((x, barra, x, y_hijos))


# =========================================
# LA CAJA DE NAVEGACIÓN, AL PIE
# =========================================
# Como las de Wikipedia: las páginas hermanas, para pasar de una a otra sin
# volver a la portada. Se busca, por este orden:
#   - un país: los demás países de su región (con su bandera en pequeño);
#   - una raza o una subraza: la raza y todas sus subrazas;
#   - lo que «pertenece a» algo: lo que pertenece a lo mismo;
#   - un lugar: los demás lugares de su país o zona;
#   - y si no, las de su mismo apartado de la portada (Astros, Credos…),
#     siempre que sean entre 2 y 40.

MAXIMO = 40


def caja_de_navegacion(ficha, paginas, region_de, subraza_de, padre_de, sub_de):
    yo = clave(ficha)

    def caja(titulo_html, miembros, con_bandera=False):
        miembros = [m for m in miembros if m in paginas]
        if len(miembros) < 2:
            return ""
        trozos = []
        for k in sorted(set(miembros), key=lambda k: llano(paginas[k]["titulo"])):
            f = paginas[k]
            bandera = f.get("bandera_url") if con_bandera else ""
            dibujo = ('<img class="mundo-navbox-bandera" src="%s" alt="" width="24" height="16"'
                      ' loading="lazy" decoding="async">' % esc(bandera)) if bandera else ""
            trozos.append("<li>%s%s</li>" % (dibujo, enlace(f, ficha)))
        return ('<div class="mundo-navbox" role="navigation" aria-labelledby="mundo-navbox-titulo">'
                '<h2 class="mundo-navbox-titulo" id="mundo-navbox-titulo">%s</h2><ul>%s</ul></div>'
                % (titulo_html, "".join(trozos)))

    def titulo(k, prefijo=""):
        f = paginas.get(k)
        return esc(prefijo) + (enlace(f) if f else "")

    # Un país, o una región: los países de la región.
    region = region_de.get(yo) or (yo if yo in region_de.values() else "")
    if region and region in paginas:
        paises = [k for k, r in region_de.items() if r == region]
        hecha = caja(titulo(region, "Países de "), paises, con_bandera=True)
        if hecha:
            return hecha
    raza = subraza_de.get(yo) or (yo if yo in subraza_de.values() else "")
    if raza:
        hecha = caja(titulo(raza, "La familia de los "), [raza] + [k for k, r in subraza_de.items() if r == raza])
        if hecha:
            return hecha
    arriba = padre_de.get(yo) or (yo if yo in padre_de.values() else "")
    if arriba:
        hecha = caja(titulo(arriba), [arriba] + [k for k, p in padre_de.items() if p == arriba])
        if hecha:
            return hecha
    donde = (enlaces_de(campo(ficha, "ubicación", "ubicacion")) or [""])[0]
    if donde in paginas:
        vecinos = [clave(f) for f in paginas.values()
                   if donde in enlaces_de(campo(f, "ubicación", "ubicacion"))]
        hecha = caja(titulo(donde, "Lugares de "), vecinos)
        if hecha:
            return hecha
    grupo, sub = sub_de.get(yo, ("", ""))
    if sub:
        iguales = [k for k, gs in sub_de.items() if gs == (grupo, sub)]
        if 2 <= len(iguales) <= MAXIMO:
            return caja(esc(sub), iguales)
    return ""


# =========================================
# EL DICCIONARIO
# =========================================

def tabla_de_palabras(palabras, paginas, enlazar_idioma=True):
    if not palabras:
        return ('<p class="mundo-auto-vacio">Todavía no hay ninguna palabra. Se añaden con'
                ' herramientas/1-publicar/diccionario.py.</p>')
    filas = []
    for p in sorted(palabras, key=lambda p: llano(p.get("palabra"))):
        idioma = str(p.get("idioma") or "").strip()
        pag_idioma = paginas.get(idioma.lower()) if idioma else None
        celda_idioma = enlace(pag_idioma) if (enlazar_idioma and pag_idioma) else esc(idioma)
        donde = str(p.get("pagina") or "").strip()
        pag = paginas.get(donde.lower()) if donde else None
        notas = esc(p.get("notas") or "")
        if pag:
            notas = (notas + " " if notas else "") + "(ver %s)" % enlace(pag)
        filas.append('<tr data-diccionario-fila data-idioma="%s"><th scope="row" class="mundo-diccionario-palabra"'
                     ' lang="und">%s</th><td>%s</td><td>%s</td><td>%s</td></tr>'
                     % (esc(idioma), esc(p.get("palabra")), celda_idioma, esc(p.get("significado")), notas))
    return ('<div class="mundo-diccionario" data-mundo-diccionario>'
            '<div class="mundo-tabla"><table class="mundo-diccionario-tabla"><caption>Palabras del mundo</caption>'
            '<thead><tr><th scope="col">Palabra</th><th scope="col">Idioma</th>'
            '<th scope="col">Qué significa</th><th scope="col">Notas</th></tr></thead>'
            '<tbody>%s</tbody></table></div></div>' % "".join(filas))


# =========================================
# LOS NOMBRES DE CADA SITIO, PARA EL GENERADOR DE NOMBRES
# =========================================
# El generador de nombres (scripts/paginas/mundo.js) aprende cómo suenan
# los nombres de cada sitio con los que ya hay: los de los países de cada
# región, los de los Heraldos, los de los astros… De «Tribu Gogango»,
# «Tribu Molosgo» y «Tribu Ordasco» saca nombres que suenan a Partaria.
# Aquí se quita lo que no es nombre propio («Reino de», «Tribu», «el
# Sanguinario»…).

PALABRAS_DE_TITULO = {
    "reino", "reinos", "califato", "canton", "condado", "dominios", "emirato", "gran", "horda",
    "imperio", "marca", "marquesado", "obispado", "orden", "principado", "tribu", "isla", "islas",
    "ruinas", "valle", "coronas", "mandato", "territorios", "republica", "ducado", "baronia",
    "archipielago", "tierras", "faros", "cuna", "corte", "ciudad", "ciudades", "libre", "libres",
    "sacro", "santo", "nueva", "nuevo", "alto", "alta", "bajo", "baja", "puerto", "fortaleza",
    "monte", "montes", "bosque", "mar", "rio", "lago", "costa", "liga", "confederacion",
    "union", "pueblo", "pueblos", "clan", "clanes", "estado", "estados", "señorio", "senorio",
    "jefatura", "khanato", "kanato", "sultanato", "teocracia", "dominio", "protectorado",
    "unidos", "unidas", "independiente", "del", "de", "la", "las", "los", "el", "y",
    "academia", "alianza", "santa", "viento", "vientos", "corona", "forja", "quebrada", "morada",
    "paraje", "fragmentado", "franja", "infierno", "frondoso", "ciclo", "heraldos", "sol",
    "luna", "cosmologia", "cielo", "mundo", "mundos", "torre", "puente", "camino",
    "cumbres", "calcinadas", "mercantil", "mercado", "custodios", "reflejadas", "palacio",
    "ojo", "techo", "paramo",
}


def palabras_comunes(paginas):
    """Las palabras que salen EN MINÚSCULA en el texto de alguna página: son
    palabras de las de siempre («viento», «academia»), no nombres propios,
    aunque vayan con mayúscula en un título («Coronas del Viento»)."""
    comunes = set()
    for f in paginas.values():
        for palabra in re.findall(r"\b[a-záéíóúüñ][a-záéíóúüñ']+\b", f.get("texto") or ""):
            comunes.add(llano(palabra))
    return comunes


def nombres_propios(titulo, comunes=frozenset()):
    """«Dominios de Bor'Korr el Sanguinario» → ["Bor'Korr"]."""
    sin_el = re.split(r"\s+(?:el|la)\s+[A-ZÁÉÍÓÚÑ]", titulo)[0]
    salida = []
    for palabra in re.split(r"[\s\-–]+", sin_el):
        limpia = palabra.strip(".,;:()«»\"")
        if (len(limpia) >= 3 and llano(limpia) not in PALABRAS_DE_TITULO
                and llano(limpia) not in comunes and limpia[:1].isupper()):
            salida.append(limpia)
    return salida


def estilos_de_nombres(paginas, region_de, extra, palabras=()):
    """[{nombre, ejemplos}] para datos/wiki/nombres.json. Las palabras del
    diccionario cuentan también, en el estilo de su idioma."""
    estilos = {}
    comunes = palabras_comunes(paginas)

    def apunta(estilo, titulo):
        for n in nombres_propios(titulo, comunes):
            estilos.setdefault(estilo, [])
            if n not in estilos[estilo]:
                estilos[estilo].append(n)

    for pais, region in region_de.items():
        if pais in paginas and region in paginas:
            apunta(paginas[region]["titulo"], paginas[pais]["titulo"])
    for f in paginas.values():
        # Las de ejemplo (lorem ipsum) no enseñan cómo suena nada.
        if "Lorem ipsum" in (f.get("texto") or ""):
            continue
        tags = [llano(t) for t in f.get("etiquetas") or []]
        que = llano(que_es(f))
        if "cosmologia" in tags and que in ("astro", "mundo tributo", "constelacion"):
            apunta("Nithir", f["titulo"])
        if que in ("deidad", "heraldo"):
            apunta("Los dioses y los Heraldos", f["titulo"])
        raza = (enlaces_de(campo(f, "raza")) or [""])[0]
        if raza in paginas:
            apunta(paginas[raza]["titulo"], f["titulo"])
    for p in palabras:
        idioma = str(p.get("idioma") or "").strip()
        if idioma:
            for n in re.split(r"[\s\-]+", str(p.get("palabra") or "")):
                if len(n) >= 3:
                    estilos.setdefault(idioma, [])
                    if n not in estilos[idioma]:
                        estilos[idioma].append(n)
    for uno in extra:
        nombre = str(uno.get("nombre") or "").strip()
        if not nombre:
            continue
        for n in uno.get("ejemplos") or []:
            n = str(n).strip()
            if n:
                estilos.setdefault(nombre, [])
                if n not in estilos[nombre]:
                    estilos[nombre].append(n)
    # Con menos de cuatro ejemplos no hay de dónde aprender.
    return [{"nombre": k, "ejemplos": v} for k, v in sorted(estilos.items(), key=lambda kv: llano(kv[0]))
            if len(v) >= 4]


# =========================================
# LA CRONOLOGÍA DE CADA PÁGINA
# =========================================
# Los eventos de la línea de tiempo que tienen que ver con una página, por
# orden: los que la enlazan en su texto ([[Reino de X]]) o la nombran en
# su nombre o su resumen («Nacimiento Azaras y Parta» sale en Azaras y en
# Parta), y las páginas de acontecimientos (plantilla Acontecimiento) que
# la nombran en su ficha (lugar, bandos…).
#
# EN UN PAÍS (o en cualquier página que tenga lugares), además, lo que ha
# pasado en sus lugares: es la línea de tiempo del país, con el sitio
# donde pasó cada cosa.

CAMPOS_DE_ACONTECIMIENTO = ("lugar", "ubicación", "ubicacion", "bandos", "participantes",
                            "comandantes", "país", "pais")


def _nombra(texto, titulo):
    if len(titulo) < 4:
        return False
    return re.search(r"(?<![\wÀ-ÿ])%s(?![\wÀ-ÿ])" % re.escape(titulo), texto or "", re.I) is not None


def cronologia(ficha, paginas, eventos, enlaces_de_evento, fecha_de, leer_fecha):
    suya = clave(ficha)
    # Ella y sus lugares (lo que dice «ubicación: [[ella]]» y es un lugar).
    sitios = {suya: None}
    for f in paginas.values():
        if (f is not ficha and "lugares" in [llano(t) for t in f.get("etiquetas") or []]
                and suya in enlaces_de(campo(f, "ubicación", "ubicacion"))):
            sitios[clave(f)] = f
    cosas = []
    for ev in eventos:
        enlazadas = {n.lower() for n in enlaces_de_evento(ev)}
        texto = " ".join(str(ev.get(k) or "") for k in ("nombre", "resumen"))
        for k, lugar in sitios.items():
            if k in enlazadas or _nombra(texto, paginas[k]["titulo"]):
                cosas.append((ev.get("fecha"), fecha_de(ev), ev["nombre"], ev["url"],
                              str(ev.get("resumen") or ""), lugar))
                break
    for f in paginas.values():
        if f is ficha or llano(que_es(f)) != "acontecimiento":
            continue
        nombradas = set()
        for c in CAMPOS_DE_ACONTECIMIENTO:
            nombradas.update(enlaces_de(campo(f, c)))
        for k, lugar in sitios.items():
            if k in nombradas:
                cuando = str(campo(f, "fecha") or "").strip()
                cosas.append((leer_fecha(cuando), cuando, f["titulo"], f["url"],
                              f.get("resumen") or "", lugar))
                break
    if not cosas:
        return ""
    cosas.sort(key=lambda c: (c[0] is None, c[0] if c[0] is not None else 0, llano(c[2])))
    trozos = []
    for _, cuando, nombre, url, resumen, lugar in cosas:
        donde = (' <span class="mundo-crono-donde">en %s</span>' % enlace(lugar)) if lugar else ""
        corto = resumen if len(resumen) <= 180 else resumen[:179].rsplit(" ", 1)[0] + "…"
        trozos.append('<li><span class="mundo-crono-fecha">%s</span>'
                      '<span class="mundo-crono-cuerpo"><a class="mundo-enlace" href="%s">%s</a>%s%s</span></li>'
                      % (esc(cuando or "¿?"), esc(url), esc(nombre), donde,
                         ('<span class="mundo-crono-resumen">%s</span>' % esc(corto)) if corto else ""))
    return '<ol class="mundo-cronologia">%s</ol>' % "".join(trozos)


# =========================================
# EL GLOSARIO, DENTRO DEL TEXTO
# =========================================
# Las palabras del diccionario que salen en el texto de una página (la
# primera vez de cada una) se marcan: al pasar el ratón, al llegar con el
# tabulador o al pulsarlas, sale lo que significan (lo pinta
# scripts/paginas/mundo.js). Son botones, para que se lleguen con el
# teclado, y su significado va en un texto escondido que el lector de
# pantalla lee como descripción. No se toca lo que va dentro de un
# enlace, de un título, de una tabla ni de un bloque de código.

NO_DENTRO = {"a", "h1", "h2", "h3", "h4", "h5", "h6", "table", "pre", "code", "button", "svg",
             "script", "style", "summary"}
RE_TROZO = re.compile(r"(<[^>]+>)")


def con_glosario(cuerpo, palabras):
    buenas = sorted({str(p.get("palabra") or "").strip(): p for p in palabras
                     if len(str(p.get("palabra") or "").strip()) >= 3}.items(),
                    key=lambda kv: -len(kv[0]))
    if not buenas:
        return cuerpo
    puestas = set()
    definiciones = []
    dentro = []
    trozos = RE_TROZO.split(cuerpo)
    for i, trozo in enumerate(trozos):
        if trozo.startswith("<"):
            m = re.match(r"<(/?)([a-zA-Z0-9]+)", trozo)
            if m:
                nombre = m.group(2).lower()
                if nombre in NO_DENTRO:
                    if m.group(1):
                        if nombre in dentro:
                            while dentro and dentro.pop() != nombre:
                                pass
                    elif not trozo.endswith("/>"):
                        dentro.append(nombre)
            continue
        if dentro or not trozo.strip():
            continue
        for palabra, p in buenas:
            if palabra in puestas:
                continue
            patron = re.compile(r"(?<![\wÀ-ÿ'-])%s(?![\wÀ-ÿ'-])" % re.escape(html.escape(palabra, quote=False)))
            m = patron.search(trozo)
            if not m:
                continue
            puestas.add(palabra)
            n = len(definiciones) + 1
            significado = str(p.get("significado") or "").strip()
            idioma = str(p.get("idioma") or "").strip()
            texto = (idioma + ": " if idioma else "") + significado
            definiciones.append('<span id="glosario-%d" hidden>%s</span>' % (n, esc(texto)))
            boton = ('<button type="button" class="mundo-glosario" aria-describedby="glosario-%d">%s</button>'
                     % (n, m.group(0)))
            trozo = trozo[:m.start()] + boton + trozo[m.end():]
        trozos[i] = trozo
    if not definiciones:
        return cuerpo
    return "".join(trozos) + '<div class="mundo-glosario-definiciones">%s</div>' % "".join(definiciones)
