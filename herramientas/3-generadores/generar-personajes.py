#!/usr/bin/env python3
# =========================================
# MIS PERSONAJES: EL ÍNDICE Y UNA PÁGINA POR PERSONAJE
# =========================================
# Mis OC (los personajes míos, no los de una campaña ni los de la wiki:
# esto va aparte de las dos cosas). Todo sale de UN archivo,
# datos/personajes/personajes.json, y este script escribe:
#
#     web/personajes/index_personajes.html       la rejilla de redondeles
#     web/personajes/<clave>/<clave>.html        la ficha de cada uno
#
# Las imágenes y la ficha en PDF de cada personaje van en su carpeta,
# imagenes/personajes/<clave>/ (el editor las deja ahí solas).
#
# EL JSON
# -------
#   {
#     "titulo": "mis personajes",
#     "intro": "La entradilla del índice.",
#     "personajes": [{
#         "clave": "yorel",                 la carpeta y la dirección
#         "nombre": "Yorel",                el grande (en el redondel)
#         "nombre_completo": "Yorel Telvet",
#         "icono": "✨",                    va delante del nombre completo
#         "color": "azul",                  el del aro (ver COLORES)
#         "token": "/imagenes/personajes/yorel/yorel_tkn.webp",
#                                           el de la GALERÍA: el redondel
#                                           del índice, y nada más
#         "retrato": "/imagenes/personajes/yorel/yorel.webp",
#                                           la de PERFIL: la del post-it
#                                           de su ficha, y nada más
#         "retrato_alt": "Cómo es, para quien no lo ve",
#         "raza": "…", "clase": "…", "nivel": 5, "lema": "Una frase suya",
#         "fue": 10, "des": 14, "con": 12, "int": 10, "sab": 13, "car": 16,
#         "ficha": "/imagenes/personajes/yorel/ficha-yorel.pdf",
#         "historia": "En Markdown", "extra": "En Markdown",
#
#         Y lo de la pestaña «ficha» (D&D), todo opcional:
#         "ca": 15, "pg": 38, "velocidad": "9 m", "dados_golpe": "5d8",
#         "competencia": 3                  (si no, sale del nivel)
#         "salvaciones": "Destreza, Inteligencia",
#         "habilidades": ["Sigilo (pericia)", "Percepción"],
#         "ataques": ["Espada corta: +6, 1d6+4 perforante"],
#         "aptitud_magica": "int"           (fue, des, con, int, sab, car)
#         "espacios": ["1.º: 4", "2.º: 2"],
#         "conjuros": ["Truco: Luz", "1: Escudo", "1: Proyectil mágico"],
#         "objetos": ["Armadura de cuero"], "dinero": "15 po",
#         "competencias": ["Común", "Élfico", "Herramientas de ladrón"],
#         "rasgos": "En Markdown (rasgos de raza, de clase, dotes)",
#         "sentidos": "Visión en la oscuridad 18 m", "defensas": ["Resistencia: fuego"],
#         "acciones": ["Acción adicional: Acción astuta", "Reacción: Esquiva asombrosa"],
#         "trasfondo": "…", "alineamiento": "…", "fe": "…", "edad": "…", "altura": "…",
#         "peso": "…", "ojos": "…", "pelo": "…", "piel": "…",
#         "personalidad", "ideales", "vinculos", "defectos": en Markdown
#     }],
#     "gente":    [{"personaje": "yorel", "cosas": [{"nombre", "que",
#                   "relacion", "token", "notas"}]}],
#     "imagenes": [{"personaje": "yorel", "cosas": [{"imagen", "alt",
#                   "pie"}]}]
#   }
#
# Solo hace falta la clave y el nombre: lo que falte no sale (sin foto,
# su inicial dentro del aro; sin estadísticas, sin cuadritos). El token y
# la imagen de perfil son dos cosas distintas y NO se sustituyen una a la
# otra: sin token, el índice lleva la inicial aunque haya perfil, y al
# revés.
#
# EN LA HISTORIA Y EN «EXTRA» vale el Markdown de la wiki: **negrita**,
# *cursiva*, listas, > citas, ## apartados, ![[imagen.webp|descripción]]
# (una de su carpeta) y [[Otro personaje]], que enlaza con su ficha.
#
# CÓMO USARLO
# -----------
#     python3 herramientas/3-generadores/generar-personajes.py
#     python3 herramientas/3-generadores/generar-personajes.py --probar
#
# Lo pasa el editor al guardar «Mis personajes», y también va con los
# demás generadores. Después hay que pasar actualizar-cabeceras.py (el
# editor y pasar_generadores ya lo hacen) para que las páginas nuevas
# tengan su CSS y su menú.
#
# Un personaje que se quita del JSON NO se borra de la web: se avisa, y
# su carpeta se borra a mano (por si era un error).

import html
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from comun import PLANTILLAS, RAIZ, escribir_texto, leer_json, leer_texto, nombre_archivo  # noqa: E402
from mundo_formato import Avisos, Conversor  # noqa: E402

DATOS = RAIZ / "datos" / "personajes" / "personajes.json"
WEB = RAIZ / "web" / "personajes"
URL = "/web/personajes/"
IMAGENES = RAIZ / "imagenes" / "personajes"
MOLDE_INDICE = PLANTILLAS / "personajes-index.html"
MOLDE_FICHA = PLANTILLAS / "personaje.html"
OG_POR_DEFECTO = "/imagenes/meta/og.webp"

# Los colores del aro. El nombre es el del JSON; la clase, oc-color-<nombre>,
# y el color de verdad lo pone personajes.css (uno para cada tema).
COLORES = ("azul", "celeste", "naranja", "verde", "gris", "morado", "rojo", "rosa", "amarillo")

# Las seis de D&D, en su orden de siempre.
STATS = (("fue", "FUE", "Fuerza"), ("des", "DES", "Destreza"), ("con", "CON", "Constitución"),
         ("int", "INT", "Inteligencia"), ("sab", "SAB", "Sabiduría"), ("car", "CAR", "Carisma"))

# Las pestañas, en el orden en que salen.
# Las partes de la página de cada uno, en el MENÚ de la izquierda del
# recuadro (y con su emoji). «ficha» lleva dentro, como un submenú, las de
# SUBPESTANAS_DE_FICHA.
PESTANAS = (("historia", "📖", "historia"), ("ficha", "📋", "ficha"), ("criaturas", "🐾", "criaturas"),
            ("gente", "👥", "npcs"),
            ("imagenes", "🖼️", "imágenes"), ("extra", "📎", "extra"))

# Las subpestañas de la pestaña «ficha» (lo de D&D), en su orden y con su
# emoji, como las secciones de la hoja de D&D Beyond: qué ventanitas van en
# cada una lo dice apartado_ficha(). Solo salen las que tienen algo.
SUBPESTANAS_DE_FICHA = (
    ("combate", "📊", "combate"),
    ("habilidades", "🎯", "habilidades"),
    ("acciones", "⚔️", "acciones"),
    ("combos", "⚡", "combos"),
    ("conjuros", "✨", "conjuros"),
    ("inventario", "🎒", "inventario"),
    ("rasgos", "🧬", "rasgos"),
    ("competencias", "🗣️", "competencias"),
    ("trasfondo", "📜", "trasfondo"),
)

# Las dieciocho habilidades de D&D 5e, con la característica de la que
# tiran. Se escriben en «habilidades» una por línea («Sigilo»,
# «Percepción (pericia)»); el nombre se compara sin tildes ni mayúsculas.
HABILIDADES = (
    ("Acrobacias", "des"), ("Arcanos", "int"), ("Atletismo", "fue"), ("Engaño", "car"),
    ("Historia", "int"), ("Interpretación", "car"), ("Intimidación", "car"), ("Investigación", "int"),
    ("Juego de manos", "des"), ("Medicina", "sab"), ("Naturaleza", "int"), ("Percepción", "sab"),
    ("Perspicacia", "sab"), ("Persuasión", "car"), ("Religión", "int"), ("Sigilo", "des"),
    ("Supervivencia", "sab"), ("Trato con animales", "sab"),
)


def e(texto):
    return html.escape(str(texto if texto is not None else ""), quote=True)


def clave_de(p):
    return nombre_archivo(str(p.get("clave") or p.get("nombre") or ""), "")


def color_de(p):
    color = str(p.get("color") or "").strip().lower()
    return "oc-color-" + (color if color in COLORES else "gris")


def ruta_que_existe(ruta):
    """Una dirección del sitio ("/imagenes/…") si el archivo está; si no, "",
    y así la página no lleva una imagen rota."""
    ruta = str(ruta or "").strip()
    if ruta.startswith("/") and not ruta.startswith("//") and (RAIZ / ruta.lstrip("/")).is_file():
        return ruta
    return ""


def inicial(nombre):
    nombre = str(nombre or "?").strip()
    return nombre[:1].upper() or "?"


def redondel(foto, nombre, clase):
    """El aro con la foto dentro, o con la inicial si no hay foto."""
    if foto:
        return ('<span class="%s"><img src="%s" alt="" loading="lazy" decoding="async"></span>'
                % (clase, e(foto)))
    return ('<span class="%s es-sin-foto"><span class="oc-inicial" aria-hidden="true">%s</span></span>'
            % (clase, e(inicial(nombre))))


def lo_que_es(p):
    """«Humano · Pícaro · nivel 5», con lo que haya."""
    trozos = [str(p.get(k) or "").strip() for k in ("raza", "clase")]
    if str(p.get("nivel") or "").strip():
        trozos.append("nivel %s" % str(p.get("nivel")).strip())
    return " · ".join(t for t in trozos if t)


def grupos_de(datos, clave_lista, clave):
    for grupo in datos.get(clave_lista) or []:
        if isinstance(grupo, dict) and grupo.get("personaje") == clave:
            return [c for c in grupo.get("cosas") or [] if isinstance(c, dict)]
    return []


# =========================================
# EL MARKDOWN
# =========================================

def conversor_para(clave, personajes, avisos):
    por_nombre = {}
    for p in personajes:
        c = clave_de(p)
        for n in (p.get("nombre"), p.get("nombre_completo"), c):
            if n:
                por_nombre[str(n).strip().lower()] = URL + "%s/%s.html" % (c, c)

    def enlace_a(nombre):
        url = por_nombre.get(str(nombre or "").strip().lower())
        return (url, True) if url else ("", False)

    def imagen_a(nombre):
        pedido = str(nombre or "").strip()
        directa = ruta_que_existe(pedido)
        if directa:
            return directa
        suelto = pedido.replace("\\", "/").rsplit("/", 1)[-1]
        for carpeta in (IMAGENES / clave, IMAGENES):
            if suelto and (carpeta / suelto).is_file():
                return "/" + (carpeta / suelto).relative_to(RAIZ).as_posix()
        return ""

    return Conversor(enlace_a, imagen_a, avisos, None)


def markdown(texto, clave, personajes, avisos):
    texto = str(texto or "").strip()
    if not texto:
        return ""
    return conversor_para(clave, personajes, avisos).a_html(texto)


# =========================================
# EL ÍNDICE
# =========================================

def tarjeta(p):
    c = clave_de(p)
    nombre = str(p.get("nombre") or c)
    completo = str(p.get("nombre_completo") or nombre)
    foto = ruta_que_existe(p.get("token"))
    icono = str(p.get("icono") or "").strip()
    que = lo_que_es(p)
    etiquetas = ", ".join(etiquetas_de(p))
    return (
        '                <li class="oc-celda"%s>\n'
        '                    <a class="oc-tarjeta %s" href="%s%s/%s.html">\n'
        '                        <span class="oc-tarjeta-aro">\n'
        '                            %s\n'
        '                            <span class="oc-tarjeta-nombre" aria-hidden="true">%s</span>\n'
        '                        </span>\n'
        '                        <span class="oc-tarjeta-etiqueta">%s<span class="oc-tarjeta-completo">%s</span></span>\n'
        '%s'
        '                    </a>\n'
        '                </li>\n'
    ) % ((' data-categoria="%s"' % e(etiquetas)) if etiquetas else "",
         color_de(p), URL, c, c, redondel(foto, nombre, "oc-tarjeta-foto"), e(nombre),
         ('<span class="oc-icono" aria-hidden="true">%s</span>' % e(icono)) if icono else "", e(completo),
         ('                        <span class="oc-tarjeta-que">%s</span>\n' % e(que)) if que else "")


def etiquetas_de(p):
    """Las etiquetas de un personaje («D&D 5e, jugando»), que son los
    botones del filtro del índice. Sin comas dentro de una: la coma es la
    que las separa (así lo lee scripts/componentes/filtros.js)."""
    crudo = p.get("etiquetas")
    trozos = crudo if isinstance(crudo, list) else str(crudo or "").replace("\n", ",").split(",")
    vistas, salida = set(), []
    for trozo in trozos:
        limpio = " ".join(str(trozo).split()).strip()
        if limpio and limpio.lower() not in vistas:
            vistas.add(limpio.lower())
            salida.append(limpio)
    return salida


# El filtro de arriba del índice (el mismo que el de los relatos y los
# NPC): los botones los pone filtros.js con las etiquetas de cada tarjeta.
FILTROS = """            <div class="filtros" data-filtros
                 data-filtros-items=".oc-celda"
                 data-filtros-orden="aparicion">
                <span class="filtros-label" id="filtros-label">filtrar:</span>

                <button class="filtros-toggle" type="button" data-filtros-toggle
                        aria-expanded="false" aria-controls="filtros-lista">
                    <span class="visually-hidden">Filtrando por: </span>
                    <span class="filtros-toggle-label" data-filtros-label>todas</span>
                    <span class="filtros-toggle-arrow" aria-hidden="true">▾</span>
                </button>

                <div class="filtros-list" id="filtros-lista" role="group" aria-labelledby="filtros-label"></div>
            </div>

            <p class="filtros-vacio" data-filtros-vacio role="status" hidden></p>

"""


def pagina_indice(datos, personajes):
    titulo = str(datos.get("titulo") or "mis personajes")
    intro = str(datos.get("intro") or "").strip()
    if personajes:
        lista = ('            <ul class="oc-rejilla">\n%s            </ul>'
                 % "".join(tarjeta(p) for p in personajes))
        # Solo con etiquetas: sin ninguna, el filtro no tendría botones.
        if any(etiquetas_de(p) for p in personajes):
            lista = FILTROS + lista
    else:
        lista = '            <p class="oc-vacio">Todavía no hay ningún personaje.</p>'
    cambios = {
        "{{TITULO}}": e(titulo[:1].upper() + titulo[1:]),
        "{{TITULO_H1}}": e(titulo),
        "{{DESCRIPCION}}": e(intro or "Mis personajes de rol."),
        "{{URL}}": URL + "index_personajes.html",
        "{{IMAGEN_OG}}": OG_POR_DEFECTO,
        "{{IMAGEN_OG_ALT}}": "El Blog de Richi — ilustración de Richi sobre fondo morado",
        "{{INTRO}}": ('<p class="oc-intro">%s</p>' % e(intro)) if intro else "",
        "{{LISTA}}": lista,
    }
    return rellenar(leer_texto(MOLDE_INDICE)[0], cambios)


# =========================================
# LA FICHA DE UNO
# =========================================

def modificador(valor):
    m = (valor - 10) // 2
    return ("+%d" % m) if m >= 0 else ("−%d" % -m)


def numero(valor):
    try:
        return int(str(valor).strip())
    except (TypeError, ValueError):
        return None


def dado(dentro, formula, que):
    """Algo que se tira al pulsarlo (un bono, un daño…): personajes.js lo
    convierte en un botón que lanza «formula» («1d20+4», «1d6+2») en el
    lanzador de dados, con «que» de nombre («sigilo», «arco corto:
    daño»). Sin JavaScript, el texto tal cual. «dentro» ya va en HTML."""
    return ('<span class="oc-dado" data-dados="%s" data-que="%s">%s</span>'
            % (e(formula), e(que), dentro))


def prueba(bono, que):
    """Una tirada de d20 con su bono («+4» -> 1d20+4)."""
    return dado(con_signo(bono), "1d20%+d" % bono if bono else "1d20", que)


# LOS TIPOS DE DAÑO, en español y en inglés (las descripciones de D&D
# Beyond vienen en inglés), al nombre que se enseña. Al tirar, el daño sale
# separado por tipo, cada uno con su color (personajes.js y
# personajes.css: oc-dano-<tipo sin tildes>).
TIPOS_DE_DANO = {
    "perforante": "perforante", "piercing": "perforante", "cortante": "cortante", "slashing": "cortante",
    "contundente": "contundente", "bludgeoning": "contundente", "fuego": "fuego", "fire": "fuego",
    "frio": "frío", "cold": "frío", "acido": "ácido", "acid": "ácido", "relampago": "relámpago",
    "rayo": "relámpago", "lightning": "relámpago", "trueno": "trueno", "thunder": "trueno",
    "veneno": "veneno", "poison": "veneno", "necrotico": "necrótico", "necrotic": "necrótico",
    "radiante": "radiante", "radiant": "radiante", "fuerza": "fuerza", "force": "fuerza",
    "psiquico": "psíquico", "psychic": "psíquico",
}
_EN = "piercing|slashing|bludgeoning|fire|cold|acid|lightning|thunder|poison|necrotic|radiant|force|psychic"
_ES = ("perforante|cortante|contundente|fuego|fr[ií]o|[aá]cido|rel[aá]mpago|rayo|trueno|veneno|necr[oó]tico|"
       "radiante|ps[ií]quico")

# Los dados que salen escritos en un texto («1d10», «2d8 + 1d6», «d20»,
# «1d6+2»): cada uno, una tirada. No los que van pegados a una letra («los
# d8s»). Si detrás dice de qué tipo es el daño («1d10 fire damage»,
# «2d6 de daño de fuego», «1d6+2 perforante»), se apunta (grupo «tipo»;
# «fuerza» solo detrás de «daño de», que si no es la característica).
DADOS_EN_TEXTO = re.compile(
    r"(?<![\w])(\d*)d(\d+)(?!\w)((?:\s*[+−-]\s*\d+(?![\d]*\s*d))?)"
    r"(?=(?:\s+(?:(?P<en>" + _EN + r")\s+damage|(?:de\s+)?da[ñn]o\s+(?:de\s+|por\s+)?(?P<es1>" + _ES
    + r"|fuerza)|(?P<es2>" + _ES + r"))\b)?)", re.I)


def tipo_de(m):
    """El tipo de daño de una fórmula encontrada, o «»."""
    palabra = m.group("en") or m.group("es1") or m.group("es2") or ""
    return TIPOS_DE_DANO.get(llano(palabra), "")


def formula_de(cuantos, caras, mas, tipo=""):
    mas = re.sub(r"\s+", "", mas or "").replace("−", "-")
    return "%sd%s%s%s" % (cuantos or "1", caras, mas, ("[%s]" % tipo) if tipo else "")


def con_dados(html, que):
    """El HTML de un texto con cada fórmula de dados convertida en una
    tirada (solo en el texto, no dentro de las etiquetas ni de los
    enlaces)."""
    trozos = re.split(r"(<[^>]+>)", html)
    dentro_de_a = 0
    for n, trozo in enumerate(trozos):
        if trozo.startswith("<"):
            if re.match(r"<a[\s>]", trozo):
                dentro_de_a += 1
            elif trozo.startswith("</a"):
                dentro_de_a = max(0, dentro_de_a - 1)
            continue
        if not dentro_de_a:
            trozos[n] = DADOS_EN_TEXTO.sub(
                lambda m: dado(m.group(0), formula_de(m.group(1), m.group(2), m.group(3), tipo_de(m)), que), trozo)
    return "".join(trozos)


def postit(p, c):
    """Lo de debajo del nombre en el post-it: la foto, la raza y la clase,
    la frase y las características (con el modificador, que se tira al
    pulsarlo)."""
    nombre = str(p.get("nombre") or c)
    retrato = ruta_que_existe(p.get("retrato"))
    alt = str(p.get("retrato_alt") or "").strip() or "Retrato de %s" % nombre
    partes = []
    if retrato:
        partes.append('                    <button class="lightbox-trigger oc-retrato" type="button" '
                      'aria-label="Ver en grande: %s">\n'
                      '                        <img src="%s" alt="%s" decoding="async">\n'
                      '                    </button>' % (e(alt), e(retrato), e(alt)))
    else:
        partes.append('                    <div class="oc-retrato es-sin-foto"><span class="oc-inicial" '
                      'aria-hidden="true">%s</span></div>' % e(inicial(nombre)))
    que = lo_que_es(p)
    if que:
        partes.append('                    <p class="oc-postit-que">%s</p>' % e(que))
    lema = str(p.get("lema") or "").strip()
    if lema:
        partes.append('                    <p class="oc-postit-lema">«%s»</p>' % e(lema.strip("«»\"")))
    valores = [(k, corto, largo, numero(p.get(k))) for k, corto, largo in STATS]
    if any(v is not None for *_, v in valores):
        partes.append('                    <h2 class="oc-stats-titulo">características</h2>')
        partes.append('                    <dl class="oc-stats">')
        # El MODIFICADOR en grande (es lo que se usa, y se tira al
        # pulsarlo) y la puntuación pequeña debajo.
        for _, corto, largo, v in valores:
            if v is None:
                dentro = '<span class="oc-stat-mod">—</span>'
            else:
                dentro = ('<span class="oc-stat-mod"><span class="visually-hidden">modificador </span>%s</span>'
                          '<span class="oc-stat-valor"><span class="visually-hidden">, puntuación </span>%s</span>'
                          % (dado(modificador(v), "1d20%+d" % modificador_num(v) if modificador_num(v) else "1d20",
                                  "prueba de " + largo.lower()), v))
            partes.append(
                '                        <div class="oc-stat">'
                '<dt><abbr title="%s">%s</abbr></dt><dd>%s</dd></div>' % (largo, corto, dentro))
        partes.append('                    </dl>')
    return "\n".join(partes)


def vitales(p):
    """Los puntos de golpe y la CA, en su cajita al lado del nombre."""
    datos = [(corto, largo, str(p.get(k) or "").strip(), emoji) for k, corto, largo, emoji in (
        ("pg", "PG", "Puntos de golpe", "❤️"), ("ca", "CA", "Clase de armadura", "🛡️"))]
    datos = [x for x in datos if x[2]]
    if not datos:
        return ""
    return ('                        <dl class="oc-vitales">%s</dl>' % "".join(
        '<div class="oc-vital"><dt><span class="oc-vital-emoji" aria-hidden="true">%s</span>'
        '<abbr title="%s">%s</abbr></dt><dd>%s</dd></div>' % (emoji, largo, corto, e(valor))
        for corto, largo, valor, emoji in datos))


def botones(p, avisos):
    """Debajo del post-it: su ficha en D&D Beyond y en PDF."""
    enlaces = []
    ddb = str(p.get("dndbeyond") or "").strip()
    if ddb:
        if not re.match(r"^https?://", ddb):
            ddb = "https://" + ddb.lstrip("/")
        enlaces.append('<a class="oc-boton oc-boton-ddb" href="%s" target="_blank" rel="noopener">ficha dndbeyond'
                       '<span class="visually-hidden"> (se abre en otra pestaña)</span></a>' % e(ddb))
    pedido = str(p.get("ficha") or "").strip()
    ruta = ruta_que_existe(pedido)
    if pedido and not ruta:
        avisos.di("ficha en PDF que no encuentro", pedido)
    # Debajo, otra fila: la ficha en PDF para descargar. Si hay un PDF
    # subido (el campo «ficha»), ese; si no, personajes.js pone un botón que
    # la saca en PDF con el navegador (imprimir → guardar como PDF), con
    # todas las partes una detrás de otra.
    pdf = ""
    if ruta:
        pdf = ('<a class="oc-boton oc-boton-pdf" href="%s" download>'
               '<span class="oc-boton-icono" aria-hidden="true">📄</span> ficha en pdf</a>' % e(ruta))
    # La primera fila siempre está (aunque vacía): personajes.js mete en
    # ella el botón de los dados.
    return ('                <div class="oc-botones" data-oc-botones>%s</div>\n'
            '                <div class="oc-botones" data-oc-botones-pdf>%s</div>' % ("".join(enlaces), pdf))


def apartado_gente(gente, c, personajes, avisos):
    if not gente:
        return ""
    filas = []
    for g in gente:
        nombre = str(g.get("nombre") or "").strip()
        if not nombre:
            continue
        foto = ruta_que_existe(g.get("token"))
        que = str(g.get("que") or "").strip()
        relacion = str(g.get("relacion") or "").strip()
        notas = markdown(g.get("notas"), c, personajes, avisos)
        filas.append(
            '<li class="oc-npc">%s<div class="oc-npc-texto"><h3 class="oc-npc-nombre">%s</h3>%s%s%s</div></li>'
            % (redondel(foto, nombre, "oc-npc-foto"), e(nombre),
               ('<p class="oc-npc-que">%s</p>' % e(que)) if que else "",
               ('<p class="oc-npc-relacion">%s</p>' % e(relacion)) if relacion else "",
               ('<div class="oc-texto oc-npc-notas">%s</div>' % notas) if notas else ""))
    return '<ul class="oc-npcs">%s</ul>' % "".join(filas) if filas else ""


def apartado_imagenes(fotos, nombre):
    celdas = []
    for f in fotos:
        ruta = ruta_que_existe(f.get("imagen"))
        if not ruta:
            continue
        alt = str(f.get("alt") or f.get("pie") or "Imagen de %s" % nombre).strip()
        pie = str(f.get("pie") or "").strip()
        celdas.append(
            '<li class="oc-foto"><figure><button class="lightbox-trigger" type="button" aria-label="Ver en grande: %s">'
            '<img src="%s" alt="%s" loading="lazy" decoding="async"></button>%s</figure></li>'
            % (e(alt), e(ruta), e(alt), ('<figcaption>%s</figcaption>' % e(pie)) if pie else ""))
    return '<ul class="oc-galeria">%s</ul>' % "".join(celdas) if celdas else ""


# =========================================
# LA PESTAÑA «FICHA»: todo lo de D&D
# =========================================
# Lo que sale en la hoja de personaje, en recuadros: el combate (CA, PG,
# velocidad, iniciativa, competencia, percepción pasiva), las tiradas de
# salvación y las habilidades (calculadas con las características y el
# nivel), los ataques, la magia, los objetos, los rasgos y las
# competencias. Cada recuadro sale solo si tiene algo.

def llano(texto):
    import unicodedata
    texto = unicodedata.normalize("NFD", str(texto or "")).lower()
    return " ".join("".join(ch for ch in texto if unicodedata.category(ch) != "Mn").split())


def con_signo(n):
    return ("+%d" % n) if n >= 0 else ("−%d" % -n)


def lineas_de(valor):
    if isinstance(valor, list):
        return [str(x).strip() for x in valor if str(x).strip()]
    return [l.strip() for l in str(valor or "").split("\n") if l.strip()]


def bonificador_de_competencia(p):
    propio = numero(p.get("competencia"))
    if propio is not None:
        return propio
    nivel = numero(p.get("nivel"))
    return 2 + (max(1, min(nivel, 20)) - 1) // 4 if nivel else None


def recuadro(titulo, dentro, clase="", emoji="", nivel=4):
    """Una ventanita como las del resto del sitio: su barra de título con
    nombre de archivo («combate.dat») y los −■✕ (que la pliegan: lo hace
    scripts/componentes/ventanas-plegables.js), y lo de dentro."""
    # Un <div> y no un <section>: base.css le da a TODA <section> alto,
    # scroll y relleno de página entera.
    return ('<div class="oc-hoja-caja%s"><div class="recent-entries-header">'
            '<h%d class="oc-hoja-titulo">%s%s</h%d>'
            '<div class="window-controls window-controls-small" data-window-controls aria-hidden="true"></div>'
            '</div><div class="oc-hoja-dentro">%s</div></div>'
            % ((" " + clase) if clase else "", nivel,
               ('<span class="oc-hoja-emoji" aria-hidden="true">%s</span>' % emoji) if emoji else "", e(titulo), nivel,
               dentro))


def lista_simple(cosas, clase="oc-lista-maquina"):
    return '<ul class="%s">%s</ul>' % (clase, "".join("<li>%s</li>" % e(x) for x in cosas))


def numeros(datos, clase=""):
    """Los numeritos grandes (CA, PG, CD…), cada uno en su cajita como las
    de estadisticas.dat en «quién soy»: lo que es arriba en pequeñito, el
    número en grande y una barra abajo. Cada dato es (nombre, valor,
    barra) o (nombre, valor, barra, dicho): la barra es solo para la
    vista (la abreviatura: «CA», «PG»…) salvo que lleve «dicho», que es
    como se lee (el modificador de una característica). Un quinto,
    (fórmula, qué, "valor" o "barra"), hace que eso se tire al pulsarlo
    (la iniciativa, el modificador de una característica…)."""
    cajas = []
    for dato in datos:
        nombre, valor, barra = dato[:3]
        dicho = dato[3] if len(dato) > 3 else None
        tirada = dato[4] if len(dato) > 4 else None
        valor_html, barra_html = e(valor), e(barra)
        if tirada and tirada[2] == "valor":
            valor_html = dado(valor_html, tirada[0], tirada[1])
        elif tirada:
            barra_html = dado(barra_html, tirada[0], tirada[1])
        if not barra:
            pie = ""
        elif dicho is None:
            pie = '<span class="oc-cajita-barra" aria-hidden="true">%s</span>' % barra_html
        else:
            pie = ('<span class="oc-cajita-barra"><span class="visually-hidden">%s </span>%s</span>'
                   % (e(dicho), barra_html))
        # Lo que no cabe en grande («10d6», «1208») va algo más pequeño.
        cajas.append('<li class="oc-cajita"><span class="oc-cajita-nombre">%s</span>'
                     '<span class="oc-cajita-valor%s">%s</span>%s</li>'
                     % (e(nombre), " es-larga" if len(str(valor)) > 3 else "", valor_html, pie))
    return '<ul class="oc-cajitas%s">%s</ul>' % ((" " + clase) if clase else "", "".join(cajas))


def pares(datos):
    """Una lista de «nombre: valor» (la apariencia, el trasfondo…), como
    los datos de «quién soy»: la etiqueta pequeñita encima, en amarillo,
    y el valor debajo."""
    return '<dl class="oc-datos">%s</dl>' % "".join(
        '<div class="oc-dato"><dt>%s</dt><dd>%s</dd></div>' % (e(a), e(b)) for a, b in datos)


def etiquetas(cosas):
    """Cosas cortas en lista de máquina (los idiomas, las competencias),
    como proficiencias.cfg en «quién soy»."""
    return lista_simple(cosas, "oc-lista-maquina")


# Un emoji para cada objeto del inventario, como en inventario.dat de
# «quién soy». Se mira si alguna palabra del objeto EMPIEZA por una de
# estas (así «raciones» cae en «racion»); manda la primera que case. Si
# el objeto ya empieza por un emoji, se deja el suyo.
EMOJIS_DE_OBJETOS = (
    (("pocion", "tintura", "tincture", "elixir", "potion", "vial", "redoma"), "🧪"),
    (("pergamino", "scroll"), "📜"),
    (("libro", "grimorio", "tomo", "diario"), "📖"),
    (("mapa",), "🗺️"),
    (("arco", "flecha", "virote", "ballesta", "carcaj"), "🏹"),
    (("espada", "daga", "estoque", "cimitarra", "sable", "punal", "cuchillo"), "🗡️"),
    (("hacha",), "🪓"),
    (("martillo", "maza", "lucero"), "🔨"),
    (("lanza", "tridente", "alabarda", "pica", "jabalina"), "🔱"),
    (("escudo", "rodela", "cota", "armadura", "coraza", "peto", "cuero"), "🛡️"),
    (("anillo",), "💍"),
    (("amuleto", "collar", "medallon", "colgante", "simbolo", "rosario"), "📿"),
    (("varita", "baston", "vara", "cetro"), "🪄"),
    (("orbe", "bola"), "🔮"),
    (("piedra", "gema", "diamante", "cuarzo", "rubi", "zafiro", "esmeralda", "perla", "cristal"), "💎"),
    (("tunica", "capa", "manto", "abrigo", "ropa", "ropaje", "vestido", "traje"), "🧥"),
    (("bota", "botas", "zapato", "sandalia"), "🥾"),
    (("guante", "guantelete", "brazal"), "🧤"),
    (("sombrero", "yelmo", "casco", "capucha", "diadema", "corona"), "🎩"),
    (("gafas", "lente", "anteojo", "catalejo"), "👓"),
    (("mochila", "bolsa", "saco", "zurron", "morral", "bolsita"), "🎒"),
    (("cuerda", "soga"), "🪢"),
    (("cadena", "grillete"), "⛓️"),
    (("antorcha", "yesquero", "pedernal"), "🔥"),
    (("vela", "linterna", "lampara", "farol"), "🕯️"),
    (("racion", "comida", "pan", "queso", "carne", "manzana"), "🍖"),
    (("odre", "cantimplora", "botella", "frasco", "aceite", "vino", "cerveza"), "🍶"),
    (("llave", "ganzua"), "🗝️"),
    (("espejo",), "🪞"),
    (("garfio", "gancho"), "🪝"),
    (("cubo",), "🪣"),
    (("red",), "🕸️"),
    (("palanca", "piton", "polea", "pala", "pico", "clavo"), "🔧"),
    (("utiles", "herramientas", "kit", "estuche", "instrumental"), "🧰"),
    (("laud", "flauta", "tambor", "lira", "violin", "gaita", "cuerno", "instrumento"), "🎻"),
    (("dado", "dados", "baraja", "cartas", "naipes"), "🎲"),
    (("moneda", "monedas", "oro", "plata"), "🪙"),
    (("tienda", "saco de dormir", "manta", "petate"), "⛺"),
    (("pluma", "tinta", "papel", "pergaminos"), "✒️"),
)


def emoji_de_objeto(nombre):
    if nombre and not nombre[0].isalnum() and not nombre[0] in "(«\"'¿¡":
        return ""
    palabras = llano(nombre).replace(",", " ").replace("(", " ").split()
    for claves, emoji in EMOJIS_DE_OBJETOS:
        if any(p.startswith(k) for k in claves for p in palabras):
            return emoji
    return "📦"


# Las monedas de D&D: la abreviatura y cómo se llaman.
MONEDAS = {"pc": "cobre", "pp": "plata", "pe": "electro", "po": "oro", "ppt": "platino",
           "cp": "cobre", "sp": "plata", "ep": "electro", "gp": "oro", "pt": "platino"}


def casillas(n, que):
    """Una casilla por uso o por espacio de conjuro, que se puede marcar
    como gastada al pulsarla (personajes.js las vuelve botones; solo para
    llevar la cuenta mientras se juega: no se guarda). «que» es de qué
    son («forma salvaje», «espacios de nivel 1»), para el lector."""
    return '<span class="oc-casillas" data-oc-casillas="%s">%s</span>' % (
        e(que), '<span class="oc-casilla"></span>' * n)


# LAS DESCRIPCIONES: lo que sale al desplegar un conjuro, una acción, un
# rasgo, un ataque o un objeto. Van todas en el campo «descripciones», un
# bloque por cosa, y se buscan por el nombre (sin mirar mayúsculas ni
# tildes; y si no está, sin lo de entre paréntesis del final: «Puntos de
# hechicería (10 usos)» encuentra «Puntos de hechicería»):
#     ## Bola de fuego
#     Origen: Lista de Hechicero
#     Datos: Nivel 3 · Evocación · 1 acción · 45 m · V, S, M · Instantáneo
#     El texto, con formato…
# «Origen» (de dónde le viene: «Hechicero, nivel 3», «Dote»…) y «Datos»
# (en pastillitas) son opcionales.

def leer_descripciones(texto):
    salida, actual = {}, None
    for linea in str(texto or "").split("\n"):
        if linea.startswith("## "):
            nombre = linea[3:].strip()
            actual = {"nombre": nombre, "origen": "", "datos": "", "cuerpo": []}
            if nombre and llano(nombre) not in salida:
                salida[llano(nombre)] = actual
            continue
        if actual is None:
            continue
        m = re.match(r"^\s*(origen|datos)\s*:\s*(.*)$", linea, re.I)
        if m and not any(x.strip() for x in actual["cuerpo"]):
            actual[llano(m.group(1))] = m.group(2).strip()
            continue
        actual["cuerpo"].append(linea)
    for d in salida.values():
        d["cuerpo"] = "\n".join(d["cuerpo"]).strip()
    return salida


def buscar_descripcion(descripciones, nombre):
    nombre = re.sub(r"\s*[×x]\s*\d+$", "", str(nombre or "").strip())
    while nombre:
        d = descripciones.get(llano(nombre))
        if d:
            return d
        sin = re.sub(r"\s*\([^()]*\)\s*$", "", nombre)
        if sin == nombre:
            return None
        nombre = sin
    return None


def chapa_de_origen(origen):
    """De dónde le viene, en su chapita (y para el lector, tras una coma)."""
    if not origen:
        return ""
    return ('<span class="oc-origen"><span class="visually-hidden">, </span>%s</span>' % e(origen))


def chapas_de_conjuro(datos):
    """De los datos de un conjuro, lo que va en su título: el tiempo
    (acción, acción adicional, reacción, 1 minuto…), si es de
    concentración y si es ritual."""
    trozos = [x.strip() for x in str(datos or "").split("·") if x.strip()]
    chapas = []
    tiempo = next((x for x in trozos if re.search(r"acci|reacci|minuto|hora", llano(x))
                   and not llano(x).startswith("concentracion")), "")
    if tiempo:
        chapas.append(("es-tiempo", re.sub(r"^1\s+", "", tiempo)))
    if any(llano(x).startswith("concentracion") for x in trozos):
        chapas.append(("es-concentracion", "concentración"))
    if any(llano(x) == "ritual" for x in trozos):
        chapas.append(("es-ritual", "ritual"))
    return "".join('<span class="oc-chapa %s"><span class="visually-hidden">, </span>%s</span>' % (clase, e(x))
                   for clase, x in chapas)


ESCUELAS = ("abjuracion", "conjuracion", "adivinacion", "encantamiento", "evocacion", "ilusion", "nigromancia",
            "transmutacion", "abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion",
            "necromancy", "transmutation")


def partes_de_conjuro(datos):
    """Los datos de un conjuro («Nivel 3 · Evocación · 1 acción · 45 m ·
    V, S, M (guano) · Instantáneo»), cada uno en su sitio de la carta. Van
    en ese orden (el del importador); lo que no se reconoce, a «otros»."""
    r = {"nivel": "", "escuela": "", "tiempo": "", "alcance": "", "componentes": "", "duracion": "", "otros": []}
    for x in [x.strip() for x in str(datos or "").split("·") if x.strip()]:
        l = llano(x)
        if not r["nivel"] and (l.startswith("truco") or re.match(r"^nivel \d", l)):
            r["nivel"] = x
        elif not r["escuela"] and l in ESCUELAS:
            r["escuela"] = x
        elif l == "ritual":
            r["otros"].append(x)
        elif not r["componentes"] and re.match(r"^[vsm](\s*,\s*[vsm])*(\s|\(|$)", l):
            r["componentes"] = x
        elif not (r["tiempo"] or r["alcance"] or r["componentes"]) and re.search(
                r"acci|reacci|^\d+ (minuto|hora)s?$|especial", l):
            r["tiempo"] = x
        elif not (r["alcance"] or r["componentes"]) and (re.search(r"\d\s*(m|km)\b", l) or l.startswith(
                ("personal", "toque", "a la vista", "ilimitado", "self", "touch"))):
            r["alcance"] = x
        elif not r["duracion"]:
            r["duracion"] = x
        else:
            r["otros"].append(x)
    return r


def carta_de_conjuro(nombre, entrada, origen, cuerpo_html):
    """Un conjuro como una CARTA (la ventana que sale al pulsarlo): el
    nombre, el nivel y la escuela; en una caja, el tiempo, el alcance, los
    componentes y la duración; la descripción; y abajo, los componentes en
    redondelitos y el material."""
    d = partes_de_conjuro((entrada or {}).get("datos"))
    sub = " · ".join(x for x in (d["nivel"], d["escuela"]) if x)
    chapas = []
    if "concentracion" in llano(d["duracion"]):
        chapas.append("concentración")
    if any(llano(x) == "ritual" for x in d["otros"]):
        chapas.append("ritual")
    letras, material = d["componentes"], ""
    m = re.match(r"^([^(]*?)\s*\((.*)\)\s*$", d["componentes"])
    if m:
        letras, material = m.group(1).strip(), m.group(2).strip()
    datos = [(n, v) for n, v in (("tiempo de lanzamiento", d["tiempo"]), ("alcance", d["alcance"]),
                                 ("componentes", letras), ("duración", d["duracion"])) if v]
    partes = ['<div class="oc-carta es-conjuro">',
              '<div class="oc-carta-cabeza"><h3 class="oc-carta-titulo">%s</h3>%s%s</div>' % (
                  e(nombre), ('<p class="oc-carta-sub">%s</p>' % e(sub)) if sub else "",
                  ('<p class="oc-carta-chapas">%s</p>' % "".join(
                      '<span class="oc-chapa es-concentracion">%s</span>' % e(x) for x in chapas)) if chapas else "")]
    if datos:
        partes.append('<dl class="oc-carta-datos">%s</dl>' % "".join(
            '<div><dt>%s</dt><dd>%s</dd></div>' % (e(n), e(v)) for n, v in datos))
    if cuerpo_html:
        partes.append('<p class="oc-carta-banda">descripción</p><div class="oc-texto oc-carta-texto">%s</div>'
                      % cuerpo_html)
    if letras or material:
        redondeles = "".join('<span class="oc-carta-letra">%s</span>' % e(x.strip())
                             for x in letras.split(",") if x.strip())
        partes.append('<div class="oc-carta-pie"><span class="oc-carta-letras" aria-hidden="true">%s</span>'
                      '<span class="visually-hidden">Componentes: %s. </span>%s</div>'
                      % (redondeles, e(letras), ('<span class="oc-carta-material">%s</span>' % e(material))
                         if material else ""))
    if origen:
        partes.append('<p class="oc-carta-origen">%s</p>' % e(origen))
    partes.append("</div>")
    return "".join(partes)


def desplegable(cabeza, entrada, origen, c, personajes, avisos, cuerpo_extra="", chapas=False, carta=""):
    """Una cosa de la ficha: si tiene descripción (o texto propio), un
    <details> que se despliega con sus datos y su texto; si no, solo su
    nombre, con de dónde le viene detrás si se sabe. «cabeza» ya va en
    HTML (el nombre, su emoji…). Con «carta» (el nombre de un conjuro), lo
    de dentro es su carta, y al pulsarlo personajes.js la abre en una
    ventana en vez de desplegarla."""
    origen = (entrada or {}).get("origen") or origen
    cuerpo = (entrada or {}).get("cuerpo") or cuerpo_extra
    datos = (entrada or {}).get("datos") or ""
    if chapas and datos:
        cabeza += chapas_de_conjuro(datos)
    if not (cuerpo or datos):
        return cabeza + chapa_de_origen(origen)
    if carta:
        cuerpo_html = con_dados(markdown(cuerpo, c, personajes, avisos), carta.lower()) if cuerpo else ""
        return ('<details class="oc-desplegable" data-oc-modal="carta"><summary>'
                '<span class="oc-desplegable-flecha" aria-hidden="true">▸</span>'
                '<span class="oc-desplegable-cabeza">%s</span>%s</summary>'
                '<div class="oc-desplegable-dentro">%s</div></details>'
                % (cabeza, chapa_de_origen(origen), carta_de_conjuro(carta, entrada, origen, cuerpo_html)))
    dentro = ""
    if datos:
        dentro += '<ul class="oc-desplegable-datos">%s</ul>' % "".join(
            "<li>%s</li>" % e(x.strip()) for x in datos.split("·") if x.strip())
    if cuerpo:
        # Los dados del texto («1d10», «8d6»…) se tiran al pulsarlos.
        que = re.sub(r'<span[^>]*aria-hidden="true"[^>]*>.*?</span>', "", cabeza)
        que = re.sub(r"<[^>]+>", "", que).strip()
        que = re.sub(r"\s+", " ", que)
        dentro += '<div class="oc-texto">%s</div>' % con_dados(markdown(cuerpo, c, personajes, avisos), que)
    return ('<details class="oc-desplegable"><summary><span class="oc-desplegable-flecha" aria-hidden="true">▸</span>'
            '<span class="oc-desplegable-cabeza">%s</span>%s</summary>'
            '<div class="oc-desplegable-dentro">%s</div></details>' % (cabeza, chapa_de_origen(origen), dentro))


# Lo que se gasta: «Forma salvaje (2 usos)» o «(2 usos, descanso
# largo)»: el nombre, una casilla por uso (como los espacios de conjuro)
# y cómo se recarga.
USOS = re.compile(r"^(.*?)\s*\((\d+)\s+usos?(?:\s*[,;]\s*([^)]+))?\)\s*$", re.I)


def con_usos(texto):
    """El nombre de algo y, aparte, sus casillas de usos y cómo se recarga
    (o «» si no tiene usos). En HTML. Van aparte porque las casillas son
    botones y no pueden ir dentro del nombre que se despliega."""
    m = USOS.match(str(texto or "").strip())
    if not m:
        return e(texto), ""
    n = int(m.group(2))
    recarga = (m.group(3) or "").strip()
    return e(m.group(1)), ('<span class="oc-usos"><span class="visually-hidden">%d %s: </span>%s%s</span>'
                           % (n, "uso" if n == 1 else "usos", casillas(min(n, 20), m.group(1).strip().lower()),
                              ('<span class="oc-chapa es-recarga"><span class="visually-hidden">, se recarga: '
                               '</span><span aria-hidden="true">↻ </span>%s</span>' % e(recarga)) if recarga else ""))


def lista_desplegable(cosas, clase, descripciones, c, personajes, avisos, cabeza=None, chapas=False):
    """Una lista (conjuros, acciones, objetos…) con cada cosa desplegable
    si tiene descripción."""
    filas = []
    for x in cosas:
        nombre, usos = (cabeza(x), "") if cabeza else con_usos(x)
        filas.append('<li class="oc-fila%s">%s%s</li>' % (
            " con-usos" if usos else "",
            desplegable(nombre, buscar_descripcion(descripciones, x), "", c, personajes, avisos, chapas=chapas,
                        carta=re.sub(r"<[^>]+>", "", nombre) if chapas else ""), usos))
    return '<ul class="%s">%s</ul>' % (clase, "".join(filas))


def rasgos_desplegables(texto, descripciones, c, personajes, avisos):
    """Los rasgos, si están escritos como lista («- **Nombre** (de dónde
    viene)» o «- **Nombre.** Lo que hace.»): cada uno desplegable, con su
    descripción (o con lo que hay escrito detrás del nombre), repartidos
    por de dónde vienen: [(grupo, html)], con grupo «raza», «clase»,
    «dotes» u «otros» (los que no dicen de dónde). Si están escritos de
    otra manera, None (y salen tal cual, con formato)."""
    lineas = [l for l in str(texto or "").split("\n") if l.strip()]
    if not lineas or not all(re.match(r"^\s*[-*+]\s+", l) for l in lineas):
        return None
    por_grupo = {"raza": [], "clase": [], "dotes": [], "otros": []}
    for linea in lineas:
        x = re.sub(r"^\s*[-*+]\s+", "", linea).strip()
        m = re.match(r"^\*\*(.+?)\*\*\s*(.*)$", x)
        nombre, resto = (m.group(1), m.group(2)) if m else (x, "")
        nombre = nombre.strip().rstrip(".:").strip()
        origen = ""
        mo = re.match(r"^\(([^()]*)\)\s*(.*)$", resto.strip())
        if mo:
            origen, resto = mo.group(1).strip(), mo.group(2)
        elif not m:
            mo = re.match(r"^(.*?)\s*\(([^()]*)\)$", nombre)
            if mo:
                nombre, origen = mo.group(1).strip(), mo.group(2).strip()
        resto = resto.strip().lstrip(".:—-").strip()
        entrada = buscar_descripcion(descripciones, nombre)
        de = llano((entrada or {}).get("origen") or origen)
        grupo = ("raza" if de.startswith("raza") or "su raza" in de else "dotes" if "dote" in de
                 else "clase" if de else "otros")
        por_grupo[grupo].append("<li>%s</li>" % desplegable(
            '<span class="oc-desplegable-nombre">%s</span>' % e(nombre), entrada, origen, c, personajes, avisos,
            resto))
    return [(g, '<ul class="oc-lista-maquina oc-hoja-rasgos">%s</ul>' % "".join(filas))
            for g, filas in por_grupo.items() if filas]


def foto_de_objeto(c, nombre):
    """La imagen de un objeto, si está en su carpeta: imagenes/personajes/
    <clave>/objetos/<su-nombre>.webp (las baja ahí el importador de D&D
    Beyond; también se pueden poner a mano con ese nombre)."""
    base = "/imagenes/personajes/%s/objetos/%s" % (c, nombre_archivo(nombre, "objeto"))
    for ext in (".webp", ".png", ".jpg", ".jpeg", ".gif"):
        ruta = ruta_que_existe(base + ext)
        if ruta:
            return ruta
    return None


def galeria_de_objetos(objetos, descripciones, c, personajes, avisos):
    """El inventario en GALERÍA: cada objeto en su tarjeta, con su imagen
    (o, si no tiene, su emoji en grande), su nombre y cuántos lleva. TODA
    la tarjeta se pulsa y abre una ventana con el objeto en grande, sus
    datos y su descripción (personajes.js; sin JavaScript se despliega
    debajo)."""
    tarjetas = []
    for o in objetos:
        o = re.sub(r"\s*\[[^\]]*\]\s*$", "", o)
        m = re.match(r"^(.*?)\s*[×x]\s*(\d+)$", o.strip())
        nombre, cuantos = (m.group(1).strip(), m.group(2)) if m else (o.strip(), "")
        foto = foto_de_objeto(c, nombre)
        if foto:
            dibujo = '<img src="%s" alt="" loading="lazy" decoding="async">' % e(foto)
            grande = '<img class="oc-carta-imagen" src="%s" alt="%s" decoding="async">' % (e(foto), e(nombre))
        else:
            emoji = emoji_de_objeto(nombre) or "📦"
            dibujo = '<span aria-hidden="true">%s</span>' % emoji
            grande = '<span class="oc-carta-imagen es-sin-foto" aria-hidden="true">%s</span>' % emoji
        entrada = buscar_descripcion(descripciones, nombre) or {}
        datos = [x.strip() for x in str(entrada.get("datos") or "").split("·") if x.strip()]
        cuerpo = entrada.get("cuerpo") or ""
        carta = ('<div class="oc-carta es-objeto"><div class="oc-carta-cabeza"><h3 class="oc-carta-titulo">%s%s</h3>'
                 '%s</div>%s%s</div>'
                 % (e(nombre), (' <span class="oc-hoja-cuantos">×%s</span>' % cuantos) if cuantos else "",
                    ('<p class="oc-carta-sub">%s</p>' % e(" · ".join(datos))) if datos else "", grande,
                    ('<p class="oc-carta-banda">descripción</p><div class="oc-texto oc-carta-texto">%s</div>'
                     % con_dados(markdown(cuerpo, c, personajes, avisos), nombre.lower())) if cuerpo else ""))
        tarjetas.append(
            '<li class="oc-objeto"><details class="oc-objeto-detalles" data-oc-modal="objeto"><summary>'
            '<span class="oc-objeto-foto%s">%s</span><span class="oc-objeto-nombre">%s%s</span></summary>'
            '<div class="oc-desplegable-dentro">%s</div></details></li>'
            % ("" if foto else " es-sin-foto", dibujo, e(nombre),
               (' <span class="oc-hoja-cuantos">×%s</span>' % cuantos) if cuantos else "", carta))
    return '<ul class="oc-inventario">%s</ul>' % "".join(tarjetas)


def partes_de_ataque(a):
    """«Arco corto: +4, 1d6+2 perforante; alcance 24/96 m» -> el nombre,
    el modificador (que se tira: 1d20+4), el daño (todo, una tirada:
    «1d8+3 cortante + 2d6 fuego» -> 1d8+3[cortante]+2d6[fuego], que sale
    separado por tipo) y lo de «extra» (lo de detrás del «;»). Los dos de
    en medio, en HTML (o «» si no hay)."""
    nombre, _, resto = a.partition(":")
    nombre, resto = nombre.strip(), resto.strip()
    principal, _, extra = resto.partition(";")
    principal, extra = principal.strip(), extra.strip()
    mod = ""
    m = re.match(r"^([+−-]\s*\d+)\s*,?\s*(.*)$", principal)
    if m:
        bono = int(m.group(1).replace("−", "-").replace(" ", ""))
        mod = prueba(bono, nombre.lower() + ": ataque")
        principal = m.group(2).strip()
    dano = ""
    trozos = list(DADOS_EN_TEXTO.finditer(principal))
    fijo = re.match(r"^(\d+)\s+(\w+)", principal)
    if trozos:
        formula = "+".join(formula_de(m.group(1), m.group(2), m.group(3), tipo_de(m)) for m in trozos)
        dano = dado(e(principal), formula, nombre.lower() + ": daño")
    elif fijo:
        # Un daño fijo («1 perforante», como el mordisco de un murciélago).
        tipo = TIPOS_DE_DANO.get(llano(fijo.group(2)), "")
        dano = dado(e(principal), fijo.group(1) + ("[%s]" % tipo if tipo else ""), nombre.lower() + ": daño")
    elif principal:
        extra = (principal + ("; " + extra if extra else "")).strip()
    return nombre, mod, dano, extra


# LOS COMBOS: lo que se hace en un turno de combate, escrito a mano en el
# campo «combos», un bloque por combo:
#     ## Fuego y escudo
#     Acción: Bola de fuego
#     Acción adicional: Forma salvaje
#     Reacción: Escudo
#     Movimiento: alejarse 9 m
#     Notas: si están todos juntos.
# Cada paso con lo que gasta delante (acción, acción adicional o «bonus»,
# reacción, movimiento, gratis); «Notas:» (o una línea sin nada delante),
# debajo. Lo de cada paso se busca entre los ataques (y sale con sus
# tiradas), los conjuros (y se abre su carta) y las descripciones.
COSTES = (("accion adicional", "acción adicional", "es-adicional"), ("bonus", "acción adicional", "es-adicional"),
          ("accion bonus", "acción adicional", "es-adicional"), ("accion", "acción", "es-accion"),
          ("reaccion", "reacción", "es-reaccion"), ("movimiento", "movimiento", "es-movimiento"),
          ("gratis", "gratis", "es-gratis"), ("libre", "gratis", "es-gratis"))


def leer_combos(texto):
    combos, actual = [], None
    for linea in str(texto or "").split("\n"):
        if linea.startswith("## "):
            actual = {"nombre": linea[3:].strip(), "pasos": [], "notas": []}
            combos.append(actual)
            continue
        if actual is None or not linea.strip():
            continue
        tipo, sep, que = linea.partition(":")
        l = llano(tipo)
        coste = next(((n, cl) for k, n, cl in COSTES if l.startswith(k)), None) if sep else None
        if coste and que.strip():
            actual["pasos"].append((coste[0], coste[1], que.strip()))
        elif sep and l.startswith("nota"):
            actual["notas"].append(que.strip())
        else:
            actual["notas"].append(linea.strip())
    return [x for x in combos if x["nombre"]]


# EL INVENTARIO, repartido: lo que lleva PUESTO, lo MÁGICO y lo de la
# MOCHILA (el importador escribe detrás de cada objeto [equipado] y
# [mágico]; si no lo dice, se mira en sus «Datos:»: «lo lleva puesto», la
# rareza, la sintonización). Y dentro de cada uno, por tipo de cosa (por
# el primero de sus «Datos:», «Arma», «Poción»…, o por su nombre).
CATEGORIAS_DE_OBJETO = (
    ("armas", "⚔️", r"^arma$|\bweapon|espada|daga|\barco\b|ballesta|hacha|\bmaza\b|martillo|lanza|jabalina|"
                   r"honda|estoque|cimitarra|\bhoz\b|garrote|quarterstaff|tridente|latigo|mangual|sword|bow|axe|"
                   r"dagger|sickle|spear|mace"),
    ("armaduras y escudos", "🛡️", r"armadura|escudo|rodela|\bcota\b|coraza|\bpeto\b|armor|shield"),
    ("munición", "🏹", r"flecha|virote|municion|ammunition|arrow|bolt"),
    ("pociones y pergaminos", "🧪", r"pocion|potion|pergamino|scroll|tintura|tincture|elixir|antitoxina"),
    ("anillos y joyas", "💍", r"anillo|\bring\b|amuleto|collar|medallon|broche|piedra ioun|\bgema"),
    ("varitas y bastones", "🪄", r"varita|\bwand|baston|\bstaff|\bvara\b|\brod\b|cetro|\borbe|foco"),
    ("ropa", "🧥", r"\bropa|tunica|\bcapa\b|manto|botas|guantes|sombrero|clothes|robe|cloak|boots|gloves"),
    ("herramientas", "🧰", r"utiles|herramient|tools|\bkit\b|instrumento|laud|flauta|tambor"),
    ("comida y bebida", "🍖", r"racion|ration|comida|\bodre|waterskin|\bvino\b|cerveza|\bpan\b"),
    ("equipo de aventura", "🎒", r"."),
)
RAREZAS = ("comun", "poco comun", "raro", "muy raro", "legendario", "artefacto")


def lugar_de_objeto(linea, entrada):
    """De un objeto («Anillo de protección [mágico, equipado]»): su nombre
    con cuántos, y si va con lo PUESTO, lo MÁGICO o la MOCHILA."""
    marcas = ""
    m = re.match(r"^(.*?)\s*\[([^\]]*)\]\s*$", linea.strip())
    if m:
        linea, marcas = m.group(1), llano(m.group(2))
    datos = [llano(x) for x in str((entrada or {}).get("datos") or "").split("·") if x.strip()]
    magico = "magic" in marcas or any(x in RAREZAS or "sintoniz" in x for x in datos)
    puesto = "equipad" in marcas or "puesto" in marcas or any("lo lleva puesto" in x for x in datos)
    return linea.strip(), ("magicos" if magico else "equipado" if puesto else "mochila")


def categoria_de_objeto(nombre, entrada):
    datos = [x.strip() for x in str((entrada or {}).get("datos") or "").split("·") if x.strip()]
    for texto in ([llano(datos[0])] if datos else []) + [llano(nombre)]:
        for cat, emoji, patron in CATEGORIAS_DE_OBJETO[:-1]:
            if re.search(patron, texto):
                return cat
    return CATEGORIAS_DE_OBJETO[-1][0]


def tabla_de_ataques(ataques, descripciones, c, personajes, avisos):
    """Los ataques en una tabla: el nombre, el modificador (se tira:
    1d20+4), el daño (en su caja, que se tira) y lo demás («extra»: una
    salvación, un alcance…). Cada línea es «Arco corto: +4, 1d6+2
    perforante; alcance 24/96 m» (lo de detrás del «;», a «extra»). Si el
    ataque tiene descripción, va en una fila debajo, que personajes.js
    pliega detrás de un botón con su nombre."""
    filas = []
    for n, a in enumerate(ataques):
        nombre, mod, dano, extra = partes_de_ataque(a)
        entrada = buscar_descripcion(descripciones, nombre)
        id_desc = "oc-ataque-%d" % n
        filas.append('<tr><th scope="row" class="oc-ataque-nombre"%s>%s</th><td class="oc-ataque-mod">%s</td>'
                     '<td class="oc-ataque-dano">%s</td><td class="oc-ataque-extra">%s</td></tr>'
                     % ((' data-oc-desc="%s"' % id_desc) if entrada else "", e(nombre), mod or "—",
                        dano or "—", e(extra) if extra else "—"))
        if entrada:
            dentro = ""
            if entrada.get("datos"):
                dentro += '<ul class="oc-desplegable-datos">%s</ul>' % "".join(
                    "<li>%s</li>" % e(x.strip()) for x in entrada["datos"].split("·") if x.strip())
            if entrada.get("cuerpo"):
                dentro += '<div class="oc-texto">%s</div>' % con_dados(
                    markdown(entrada["cuerpo"], c, personajes, avisos), nombre.lower())
            filas.append('<tr class="oc-ataque-desc" id="%s"><td colspan="4"><div class="oc-desplegable-dentro">%s'
                         '</div></td></tr>' % (id_desc, dentro))
    return ('<div class="oc-tabla-caja"><table class="oc-ataques"><thead><tr><th scope="col">ataque</th>'
            '<th scope="col">modificador</th><th scope="col">daño</th><th scope="col">extra</th></tr></thead>'
            '<tbody>%s</tbody></table></div>' % "".join(filas))


def apartado_ficha(p, c, personajes, avisos):
    mods = {k: (modificador_num(numero(p.get(k))) if numero(p.get(k)) is not None else None) for k, _, _ in STATS}
    comp = bonificador_de_competencia(p)
    corto_de = dict((a, b) for a, b, _ in STATS)
    largo_de = dict((a, c3) for a, _, c3 in STATS)
    # Las ventanitas, repartidas en las SUBPESTAÑAS de la ficha.
    grupos = {g: [] for g, _, _ in SUBPESTANAS_DE_FICHA}
    descripciones = leer_descripciones(p.get("descripciones"))

    def lista_con(cosas, clase="oc-lista-maquina", cabeza=None, chapas=False):
        return lista_desplegable(cosas, clase, descripciones, c, personajes, avisos, cabeza, chapas)

    competentes = {}
    for linea in lineas_de(p.get("habilidades")):
        nombre = llano(linea.split("(")[0])
        competentes[nombre] = 2 if "pericia" in llano(linea) else 1
    conocidas = {llano(n) for n, _ in HABILIDADES}
    for nombre in competentes:
        if nombre not in conocidas:
            avisos.di("habilidad que no conozco", nombre)

    def bono_de_habilidad(nombre):
        k = dict(HABILIDADES)[nombre]
        return None if mods[k] is None else mods[k] + (comp or 0) * competentes.get(llano(nombre), 0)

    # 📊 COMBATE: los numeritos grandes, los sentidos y las defensas.
    # Primero, las seis características como en estadisticas.dat de
    # «quién soy»: el nombre, la puntuación en grande y el modificador en
    # la barra de abajo.
    # El MODIFICADOR en grande (se tira) y la puntuación en la barra.
    stats = [(largo.lower(), con_signo(mods[k]), str(numero(p.get(k))), "puntuación",
              ("1d20%+d" % mods[k] if mods[k] else "1d20", "prueba de " + largo.lower(), "valor"))
             for k, _, largo in STATS if mods[k] is not None]
    if stats:
        # estadisticas.dat y combate.dat, una al lado de la otra, y sus
        # cajitas de dos en dos (dos columnas y tres filas cada una).
        grupos["combate"].append(recuadro("estadisticas.dat", numeros(stats, "es-de-dos"), "", "📊"))
    datos = []
    for clave, texto, barra in (("ca", "clase de armadura", "CA"), ("pg", "puntos de golpe", "PG"),
                                ("velocidad", "velocidad", "a pie")):
        valor = str(p.get(clave) or "").strip()
        if valor:
            datos.append((texto, valor, barra))
    if mods["des"] is not None:
        datos.append(("iniciativa", con_signo(mods["des"]), "DES", None,
                      ("1d20%+d" % mods["des"] if mods["des"] else "1d20", "iniciativa", "valor")))
    if comp is not None:
        datos.append(("competencia", con_signo(comp), "bono"))
    dados = str(p.get("dados_golpe") or "").strip()
    if dados:
        # Al pulsarlo, un dado de golpe con la Constitución (lo que se
        # cura en un descanso corto por cada dado que se gasta).
        m = re.search(r"d(\d+)", dados)
        tirada = None
        if m:
            con = mods["con"] or 0
            tirada = ("1d%s%s" % (m.group(1), ("%+d" % con) if con else ""), "dado de golpe", "valor")
        datos.append(("dados de golpe", dados, "DG", None, tirada))
    if datos:
        grupos["combate"].append(recuadro("combate.dat", numeros(datos, "es-de-dos"), "", "🛡️"))
    sentidos = []
    for nombre in ("Percepción", "Investigación", "Perspicacia"):
        bono = bono_de_habilidad(nombre)
        if bono is not None:
            sentidos.append((nombre.lower(), str(10 + bono), "pasiva", ""))
    extra_sentidos = str(p.get("sentidos") or "").strip()
    if sentidos or extra_sentidos:
        grupos["combate"].append(recuadro("sentidos.txt", (numeros(sentidos) if sentidos else "")
                                          + ('<p class="oc-hoja-nota">%s</p>' % e(extra_sentidos)
                                             if extra_sentidos else ""), "", "👁️"))
    defensas = lineas_de(p.get("defensas"))
    if defensas:
        grupos["combate"].append(recuadro("defensas.txt", lista_simple(defensas, "oc-lista-maquina"), "", "🧱"))

    # 🎯 HABILIDADES: las salvaciones y las dieciocho, con su marca.
    if any(v is not None for v in mods.values()):
        salva = {llano(x)[:3] for x in str(p.get("salvaciones") or "").replace("\n", ",").split(",") if x.strip()}
        filas = [fila_de_tirada(largo.lower(), mods[k] + ((comp or 0) if k in salva else 0), 1 if k in salva else 0,
                                que="salvación de " + largo.lower())
                 for k, _, largo in STATS if mods[k] is not None]
        # Las salvaciones, a todo lo ancho, a dos columnas y en colores
        # invertidos (para que destaquen).
        grupos["habilidades"].append(recuadro("salvaciones.lst", '<ul class="oc-hoja-tiradas es-dos-columnas">%s</ul>'
                                              % "".join(filas), "es-ancha es-invertida", "🎲"))
        filas = [fila_de_tirada(nombre.lower(), bono_de_habilidad(nombre), competentes.get(llano(nombre), 0),
                                corto_de[k].lower())
                 for nombre, k in HABILIDADES if mods[k] is not None]
        grupos["habilidades"].append(recuadro("habilidades.lst", '<ul class="oc-hoja-tiradas es-dos-columnas">%s</ul>'
                                              % "".join(filas), "es-ancha", "🎯"))

    # ⚔️ ACCIONES: los ataques y lo demás que hace en un turno.
    ataques = lineas_de(p.get("ataques"))
    if ataques:
        grupos["acciones"].append(recuadro("ataques.lst", tabla_de_ataques(ataques, descripciones, c, personajes,
                                                                           avisos), "es-ancha", "🗡️"))
    acciones = lineas_de(p.get("acciones"))
    if acciones:
        por_tipo = {}
        for a in acciones:
            tipo, _, que = a.partition(":")
            if not que.strip():
                tipo, que = "Otras", a
            por_tipo.setdefault(tipo.strip(), []).append(que.strip())
        dentro = "".join('<h5 class="oc-hoja-subtitulo">%s</h5>%s' % (e(tipo), lista_con(cosas))
                         for tipo, cosas in por_tipo.items())
        grupos["acciones"].append(recuadro("acciones.txt", dentro, "es-ancha", "⏱️"))

    # ✨ CONJUROS: la aptitud, la CD y el ataque (calculados) en su
    # ventanita, y una por nivel con sus espacios dibujados (▢▢▢).
    aptitud = llano(p.get("aptitud_magica"))[:3]
    if aptitud in mods and mods[aptitud] is not None and comp is not None:
        grupos["conjuros"].append(recuadro("magia.dat", numeros([
            ("aptitud mágica", corto_de[aptitud], largo_de[aptitud].lower(), ""),
            ("CD de salvación", str(8 + comp + mods[aptitud]), "CD"),
            ("ataque de conjuro", con_signo(comp + mods[aptitud]), "ataque", None,
             ("1d20%+d" % (comp + mods[aptitud]), "ataque de conjuro", "valor"))]), "es-ancha", "🔮"))
    espacios = {}
    for linea in lineas_de(p.get("espacios")):
        m = re.match(r"^\s*(\d+)\D*?:\s*(\d+)", linea)
        if m:
            espacios[m.group(1)] = int(m.group(2))
    por_nivel = {}
    for linea in lineas_de(p.get("conjuros")):
        nivel, sep, nombre = linea.partition(":")
        if not sep:
            nivel, nombre = "", linea
        nivel = llano(nivel)
        clave_n = "0" if nivel.startswith("truco") else (nivel if nivel.isdigit() else "?")
        por_nivel.setdefault(clave_n, []).append(nombre.strip())
    for clave_n in sorted(set(por_nivel) | set(espacios), key=lambda x: (x == "?", int(x) if x.isdigit() else 99)):
        titulo = "trucos.lst" if clave_n == "0" else ("nivel_%s.lst" % clave_n if clave_n != "?" else "conjuros.lst")
        dentro = ""
        if espacios.get(clave_n):
            n = espacios[clave_n]
            dentro += ('<p class="oc-hoja-espacios">%s<span>%d %s</span></p>'
                       % (casillas(n, "espacios de %s" % ("nivel " + clave_n if clave_n != "?" else "conjuro")),
                          n, "espacio" if n == 1 else "espacios"))
        if por_nivel.get(clave_n):
            # A dos columnas solo si no se despliega ninguno (desplegado, un
            # conjuro a media columna no se lee).
            dentro += lista_con(por_nivel[clave_n], "oc-lista-maquina oc-hoja-conjuros", chapas=True)
        # Cada nivel a todo lo ancho, uno detrás de otro.
        grupos["conjuros"].append(recuadro(titulo, dentro, "es-ancha", "✨" if clave_n == "0" else "📖"))

    # 🎒 INVENTARIO: el dinero en monedas y los objetos con su cantidad.
    dinero = str(p.get("dinero") or "").strip()
    if dinero:
        # Cada moneda en su cajita, como las estadísticas: cómo se llama,
        # cuántas y la abreviatura en la barra.
        monedas, sueltas = [], []
        for trozo in re.split(r"\s*,\s*|\s+y\s+", dinero):
            m = re.match(r"^(\d[\d.]*)\s*(\w+)$", trozo.strip())
            if m:
                monedas.append((MONEDAS.get(m.group(2).lower(), m.group(2)), m.group(1), m.group(2)))
            elif trozo.strip():
                sueltas.append(trozo.strip())
        grupos["inventario"].append(recuadro("bolsa.txt", (numeros(monedas) if monedas else "")
                                             + (lista_simple(sueltas, "oc-lista-maquina") if sueltas else ""),
                                             "es-ancha", "💰"))
    objetos = lineas_de(p.get("objetos"))
    if objetos:
        # Lo puesto, lo mágico y la mochila, cada uno en su ventanita y,
        # dentro, por tipo de cosa (armas, armaduras, pociones…).
        lugares = {"equipado": {}, "magicos": {}, "mochila": {}}
        for o in objetos:
            sin_cuantos = re.sub(r"\s*[×x]\s*\d+\s*(\[[^\]]*\])?\s*$", "", re.sub(r"\s*\[[^\]]*\]\s*$", "", o))
            entrada = buscar_descripcion(descripciones, sin_cuantos)
            linea, lugar = lugar_de_objeto(o, entrada)
            lugares[lugar].setdefault(categoria_de_objeto(sin_cuantos, entrada), []).append(linea)
        for lugar, titulo, emoji in (("equipado", "equipado.lst", "🗡️"), ("magicos", "magicos.lst", "✨"),
                                     ("mochila", "mochila.lst", "🎒")):
            if not lugares[lugar]:
                continue
            dentro = "".join(
                '<h5 class="oc-hoja-subtitulo"><span class="oc-subtitulo-emoji" aria-hidden="true">%s</span> %s</h5>%s'
                % (emoji_c, e(cat), galeria_de_objetos(lugares[lugar][cat], descripciones, c, personajes, avisos))
                for cat, emoji_c, _ in CATEGORIAS_DE_OBJETO if cat in lugares[lugar])
            grupos["inventario"].append(recuadro(titulo, dentro, "es-ancha", emoji))

    # 🧬 RASGOS: en una ventanita los de raza, en otra los de clase y en
    # otra las dotes (y los que no dicen de dónde vienen, aparte).
    rasgos = rasgos_desplegables(p.get("rasgos"), descripciones, c, personajes, avisos)
    if rasgos is None:
        texto = markdown(p.get("rasgos"), c, personajes, avisos)
        rasgos = [("otros", '<div class="oc-texto">%s</div>' % texto)] if texto else []
    ventanas = {"raza": ("raza.txt", "🧝"), "clase": ("clase.txt", "📚"), "dotes": ("dotes.txt", "⭐"),
                "otros": ("rasgos.txt", "🧬")}
    for g, html_g in rasgos:
        titulo, emoji = ventanas[g]
        grupos["rasgos"].append(recuadro(titulo, html_g, "es-ancha", emoji))

    # 🗣️ COMPETENCIAS: los idiomas, las armas (y armaduras y escudos) y
    # las herramientas, cada cosa en su ventanita.
    idiomas, armas, armaduras, herramientas, otras = [], [], [], [], []
    for linea in lineas_de(p.get("competencias")):
        l = llano(linea)
        if l.startswith("idiomas:"):
            idiomas += [x.strip() for x in linea.split(":", 1)[1].split(",") if x.strip()]
        elif re.search(r"armadura|escudo|armor|shield", l):
            armaduras.append(linea)
        elif re.search(r"\barmas?\b|weapon|espada|ballesta|arco|daga|hacha|maza|lanza|jabalina|honda|martillo|"
                       r"estoque|cimitarra|\bhoz\b|baston|garrote|dardo|tridente|latigo|pica|alabarda|mangual|"
                       r"lucero|sword|bow|axe|dagger|club|mace|spear|sickle|staff|sling|dart|whip", l):
            armas.append(linea)
        elif re.search(r"util|herramient|tool|kit|juego|instrumento|vehiculo|suministro|supplies|set\b|laud|"
                       r"flauta|tambor|gaita|lira|cuerno|vehicle|dados|baraja|ajedrez", l):
            herramientas.append(linea)
        else:
            otras.append(linea)
    if idiomas:
        grupos["competencias"].append(recuadro("idiomas.txt", etiquetas(idiomas), "", "🗣️"))
    if armas or armaduras:
        dentro = ""
        if armas:
            dentro += '<h5 class="oc-hoja-subtitulo">armas</h5>' + etiquetas(armas)
        if armaduras:
            dentro += '<h5 class="oc-hoja-subtitulo">armaduras y escudos</h5>' + etiquetas(armaduras)
        grupos["competencias"].append(recuadro("armas.txt", dentro, "", "⚔️"))
    if herramientas:
        grupos["competencias"].append(recuadro("herramientas.txt", etiquetas(herramientas), "", "🛠️"))
    if otras:
        grupos["competencias"].append(recuadro("otras.txt", etiquetas(otras), "", "📌"))

    # 📜 TRASFONDO: quién es, cómo es y qué le mueve.
    quien = [(texto, str(p.get(clave) or "").strip()) for clave, texto in (
        ("trasfondo", "Trasfondo"), ("alineamiento", "Alineamiento"), ("fe", "Fe"))]
    quien = [(a, b) for a, b in quien if b]
    if quien:
        grupos["trasfondo"].append(recuadro("origen.txt", pares(quien), "", "🏛️"))
    aspecto = [(texto, str(p.get(clave) or "").strip()) for clave, texto in (
        ("edad", "Edad"), ("altura", "Altura"), ("peso", "Peso"), ("ojos", "Ojos"), ("pelo", "Pelo"),
        ("piel", "Piel"))]
    aspecto = [(a, b) for a, b in aspecto if b]
    if aspecto:
        grupos["trasfondo"].append(recuadro("aspecto.txt", pares(aspecto), "", "🪞"))
    alma = []
    for clave, texto in (("personalidad", "Rasgos de personalidad"), ("ideales", "Ideales"),
                         ("vinculos", "Vínculos"), ("defectos", "Defectos")):
        valor = markdown(p.get(clave), c, personajes, avisos)
        if valor:
            alma.append('<h5 class="oc-hoja-subtitulo">%s</h5><div class="oc-texto">%s</div>' % (texto, valor))
    if alma:
        grupos["trasfondo"].append(recuadro("personalidad.txt", "".join(alma), "es-ancha", "💭"))
    # ⚡ COMBOS: los que estén escritos, cada uno en su ventanita con sus
    # pasos (lo que gasta cada uno en su chapita de color), y una ventanita
    # «turno.txt» con todo lo que se puede hacer con la acción, la acción
    # adicional y la reacción (para pensar los combos).
    nombres_de_conjuros = {llano(n) for lista in por_nivel.values() for n in lista}
    ataque_de = {llano(a.partition(":")[0]): a for a in ataques}

    def cosa_de_combo(que):
        a = ataque_de.get(llano(que))
        if a:
            nombre, mod, dano, extra = partes_de_ataque(a)
            return ('<span class="oc-desplegable-nombre">%s</span>%s%s%s'
                    % (e(nombre), (' <span class="oc-combo-tirada">%s</span>' % mod) if mod else "",
                       (' <span class="oc-combo-tirada es-dano">%s</span>' % dano) if dano else "",
                       (' <span class="oc-combo-extra">%s</span>' % e(extra)) if extra else ""))
        es_conjuro = llano(que) in nombres_de_conjuros
        return desplegable('<span class="oc-desplegable-nombre">%s</span>' % e(que), buscar_descripcion(descripciones, que),
                           "", c, personajes, avisos, chapas=es_conjuro, carta=que if es_conjuro else "")

    for combo in leer_combos(p.get("combos")):
        pasos = "".join('<li class="oc-combo-paso"><span class="oc-combo-coste %s">%s</span>'
                        '<span class="oc-combo-que">%s</span></li>' % (clase, e(coste), cosa_de_combo(que))
                        for coste, clase, que in combo["pasos"])
        notas = "".join('<p class="oc-hoja-nota">%s</p>' % e(n) for n in combo["notas"] if n)
        titulo = (nombre_archivo(combo["nombre"], "combo") or "combo") + ".cmb"
        grupos["combos"].append(recuadro(titulo, '<p class="oc-combo-nombre">%s</p><ul class="oc-combo-pasos">%s</ul>%s'
                                         % (e(combo["nombre"]), pasos, notas), "es-ancha", "⚡"))
    turno = {"acción": [], "acción adicional": [], "reacción": []}
    for a in ataques:
        turno["acción"].append((a.partition(":")[0].strip(), "ataque"))
    for lista in por_nivel.values():
        for n in lista:
            tiempo = llano(partes_de_conjuro((buscar_descripcion(descripciones, n) or {}).get("datos"))["tiempo"])
            hueco = ("acción adicional" if "adicional" in tiempo else "reacción" if "reaccion" in tiempo
                     else "acción" if "accion" in tiempo else None)
            if hueco:
                turno[hueco].append((n, "conjuro"))
    for a in acciones:
        tipo, _, que = a.partition(":")
        hueco = {"accion": "acción", "accion adicional": "acción adicional", "reaccion": "reacción"}.get(llano(tipo))
        if hueco and que.strip():
            turno[hueco].append((USOS.sub(r"\1", que.strip()) if USOS.match(que.strip()) else que.strip(), "rasgo"))
    if any(turno.values()):
        columnas = "".join(
            '<div class="oc-turno-columna"><h5 class="oc-hoja-subtitulo"><span class="oc-combo-coste %s">%s</span></h5>'
            '<ul class="oc-lista-maquina">%s</ul></div>'
            % (clase, e(hueco), "".join('<li>%s <span class="oc-turno-tipo">%s</span></li>' % (e(n), e(tipo))
                                         for n, tipo in turno[hueco]) or "<li>—</li>")
            for hueco, clase in (("acción", "es-accion"), ("acción adicional", "es-adicional"),
                                 ("reacción", "es-reaccion")))
        grupos["combos"].append(recuadro("turno.txt", '<p class="oc-hoja-nota">Lo que puede hacer en un turno, por'
                                         ' lo que gasta (para pensar combos).</p><div class="oc-turno">%s</div>'
                                         % columnas, "es-ancha", "⏳"))

    return [(g, emoji, texto, "".join(grupos[g])) for g, emoji, texto in SUBPESTANAS_DE_FICHA if grupos[g]]


def modificador_num(valor):
    return (valor - 10) // 2


def fila_de_tirada(nombre, total, nivel, corto="", que=None):
    """Una tirada como las de habilidades.lst en «quién soy»: el circulito
    (vacío, relleno si es competente, con aro si tiene pericia), el bono y
    el nombre, y de qué característica tira. El circulito es solo para la
    vista; para el lector va dicho con palabras."""
    marca = ("", " es-llena", " es-pericia")[nivel]
    dicho = ("", " (competente)", " (con pericia)")[nivel]
    return ('<li class="oc-tirada"><span class="oc-marca%s" aria-hidden="true"></span>'
            '<span><span class="oc-tirada-bono">%s</span> %s%s<span class="visually-hidden">%s</span></span></li>'
            % (marca, prueba(total, que or nombre), e(nombre),
               (' <span class="oc-tirada-de">(%s)</span>' % corto) if corto else "", dicho))


# =========================================
# LAS CRIATURAS (familiares, invocaciones, mascotas…)
# =========================================
# Cada una con su ficha de monstruo, como las del Manual de monstruos: su
# imagen, qué es, la CA, los PG, la velocidad y la iniciativa en cajitas,
# las seis características (el modificador en grande, que se tira), las
# habilidades, los sentidos, los idiomas y el desafío, sus rasgos, sus
# acciones (en la tabla de los ataques, con sus tiradas) y lo que haya
# que saber. Están en «criaturas» de personajes.json (agrupadas por
# personaje, como la gente), y en el editor, en «Sus criaturas».

def apartado_criaturas(criaturas, c, personajes, avisos):
    """Cada criatura como un BLOQUE DE ESTADÍSTICAS de los de siempre
    (el del Manual de monstruos): el nombre en su barra, el tamaño y el
    tipo en cursiva, unas rayas, la CA, los PG, la velocidad y el desafío,
    las seis características en fila («15 (+2)»), las habilidades, los
    sentidos y los idiomas con la imagen al lado, los rasgos, las
    acciones y, en la barra de abajo, qué es. Todo lo que se tira se puede
    pulsar."""
    bloques = []
    for k in criaturas:
        nombre = str(k.get("nombre") or "").strip()
        if not nombre:
            continue
        de = nombre.lower() + ": "
        mods = {s: (modificador_num(numero(k.get(s))) if numero(k.get(s)) is not None else None) for s, _, _ in STATS}
        comp = numero(k.get("competencia"))
        raya = '<div class="oc-bloque-raya" aria-hidden="true"></div>'
        partes = ['<h3 class="oc-bloque-nombre">%s</h3>' % e(nombre)]
        tipo = str(k.get("tipo") or "").strip()
        if tipo:
            partes.append('<p class="oc-bloque-tipo">%s</p>' % e(tipo))
        partes.append(raya)

        # Lo básico, a dos columnas: CA, velocidad, PG (sus dados se
        # tiran), desafío, iniciativa (se tira) y competencia.
        basicos = []
        if str(k.get("ca") or "").strip():
            basicos.append(("CA", e(k.get("ca"))))
        if str(k.get("velocidad") or "").strip():
            basicos.append(("Velocidad", e(k.get("velocidad"))))
        pg = str(k.get("pg") or "").strip()
        if pg:
            m = re.match(r"^(\d+)\s*\(([^)]*)\)\s*$", pg)
            basicos.append(("PG", "%s (%s)" % (e(m.group(1)), dado(e(m.group(2)), re.sub(r"\s+", "", m.group(2))
                                                                   .replace("−", "-"), de + "puntos de golpe"))
                            if m else e(pg)))
        if str(k.get("desafio") or "").strip():
            basicos.append(("Desafío", e(k.get("desafio"))))
        if mods["des"] is not None:
            basicos.append(("Iniciativa", prueba(mods["des"], de + "iniciativa")))
        if comp is not None:
            basicos.append(("Competencia", con_signo(comp)))
        if basicos:
            partes.append('<dl class="oc-bloque-basicos">%s</dl>' % "".join(
                '<div><dt>%s</dt><dd>%s</dd></div>' % (a, b) for a, b in basicos))
            partes.append(raya)

        # Las seis, en fila: «15 (+2)», y el modificador se tira.
        if any(v is not None for v in mods.values()):
            partes.append('<dl class="oc-bloque-stats">%s</dl>' % "".join(
                '<div><dt><abbr title="%s">%s</abbr></dt><dd>%s (%s)</dd></div>'
                % (largo, corto, numero(k.get(s)), dado(con_signo(mods[s]), "1d20%+d" % mods[s] if mods[s] else "1d20",
                                                        de + largo.lower()))
                for s, corto, largo in STATS if mods[s] is not None))
            partes.append(raya)

        # Salvaciones, habilidades, sentidos e idiomas, con la imagen al
        # lado (se ve en grande al pulsarla).
        datos = []
        for clave, texto in (("salvaciones", "Salvaciones"), ("habilidades", "Habilidades")):
            valor = str(k.get(clave) or "").strip()
            if valor:
                trozos = []
                for x in re.split(r"\s*[,;]\s*", valor):
                    m = re.match(r"^(.*?)\s*([+−-]\s*\d+)$", x.strip())
                    if m:
                        bono = int(m.group(2).replace("−", "-").replace(" ", ""))
                        trozos.append("%s %s" % (e(m.group(1)), prueba(bono, de + m.group(1).lower())))
                    elif x.strip():
                        trozos.append(e(x.strip()))
                datos.append((texto, ", ".join(trozos)))
        sentidos = str(k.get("sentidos") or "").strip()
        if mods["sab"] is not None:
            percepcion = 10 + mods["sab"]
            m = re.search(r"percepci[oó]n\s*([+−-]\s*\d+)", str(k.get("habilidades") or ""), re.I)
            if m:
                percepcion = 10 + int(m.group(1).replace("−", "-").replace(" ", ""))
            sentidos = (sentidos + ", " if sentidos else "") + "Percepción pasiva %d" % percepcion
        if sentidos:
            datos.append(("Sentidos", e(sentidos)))
        if str(k.get("idiomas") or "").strip():
            datos.append(("Idiomas", e(k.get("idiomas"))))
        imagen = ruta_que_existe(k.get("imagen")) or ruta_que_existe(k.get("token"))
        alt = str(k.get("imagen_alt") or "").strip() or nombre
        foto = ('<button class="lightbox-trigger oc-bloque-foto" type="button" aria-label="Ver en grande: %s">'
                '<img src="%s" alt="%s" loading="lazy" decoding="async"></button>' % (e(alt), e(imagen), e(alt))
                ) if imagen else ""
        if datos or foto:
            partes.append('<div class="oc-bloque-medio"><dl class="oc-bloque-datos">%s</dl>%s</div>' % ("".join(
                '<div><dt>%s</dt><dd>%s</dd></div>' % (a, b) for a, b in datos), foto))
            partes.append(raya)

        rasgos = markdown(k.get("rasgos"), c, personajes, avisos)
        if rasgos:
            partes.append('<div class="oc-texto oc-bloque-texto">%s</div>' % con_dados(rasgos, nombre.lower()))
        acciones = lineas_de(k.get("acciones"))
        if acciones:
            filas = []
            for a in acciones:
                nombre_a, mod, dano, extra = partes_de_ataque(a)
                trozos = ["<strong><em>%s.</em></strong>" % e(nombre_a)]
                if mod:
                    trozos.append("<em>Tirada de ataque:</em> %s." % mod)
                if dano:
                    trozos.append("<em>Impacto:</em> %s." % dano)
                if extra:
                    trozos.append(e(extra[0].upper() + extra[1:]) + ("" if extra.endswith(".") else "."))
                filas.append("<p>%s</p>" % " ".join(trozos))
            partes.append('<h4 class="oc-bloque-titulo">Acciones</h4><div class="oc-texto oc-bloque-texto">%s</div>'
                          % "".join(filas))
        notas = markdown(k.get("notas"), c, personajes, avisos)
        if notas:
            partes.append('<h4 class="oc-bloque-titulo">Lo que hay que saber</h4>'
                          '<div class="oc-texto oc-bloque-texto">%s</div>' % con_dados(notas, nombre.lower()))
        que = str(k.get("que") or "").strip()
        if que:
            partes.append('<p class="oc-bloque-pie">%s</p>' % e(que))
        bloques.append('<div class="oc-bloque">%s</div>' % "".join(partes))
    return '<div class="oc-bloques">%s</div>' % "".join(bloques) if bloques else ""


def pestanas(p, c, datos, personajes, avisos):
    """El recuadro: a la izquierda el MENÚ (historia, ficha —con sus
    partes debajo, como un submenú: combate, habilidades…—, npcs, imágenes
    y extra) y a la derecha lo elegido. Sin JavaScript el menú son enlaces
    que saltan a cada parte y se ven todas, una debajo de otra, con su
    título; con él (personajes.js), solo la elegida."""
    nombre = str(p.get("nombre") or c)
    partes_ficha = apartado_ficha(p, c, personajes, avisos)
    contenido = {
        "historia": markdown(p.get("historia"), c, personajes, avisos),
        "gente": apartado_gente(grupos_de(datos, "gente", c), c, personajes, avisos),
        "criaturas": apartado_criaturas(grupos_de(datos, "criaturas", c), c, personajes, avisos),
        "imagenes": apartado_imagenes(grupos_de(datos, "imagenes", c), nombre),
        "extra": markdown(p.get("extra"), c, personajes, avisos),
    }
    vacio = {
        "historia": "Todavía no he escrito su historia.",
        "ficha": "Todavía no tiene la ficha apuntada.",
        "gente": "Todavía no hay nadie apuntado.",
        "criaturas": "",
        "imagenes": "Todavía no hay imágenes.",
        "extra": "Nada más, de momento.",
    }
    menu = ['                    <nav class="oc-menu" aria-label="Partes de %s" data-oc-menu>' % e(nombre),
            '                        <ul class="oc-menu-lista">']
    cajas = ['                    <div class="oc-partes" data-oc-partes>']
    for ident, emoji, texto in PESTANAS:
        # Las criaturas solo salen si tiene alguna.
        if ident == "criaturas" and not contenido["criaturas"]:
            continue
        cabeza = ('<span class="oc-menu-emoji" aria-hidden="true">%s</span><span class="oc-menu-texto">%s</span>'
                  % (emoji, texto))
        if ident == "ficha" and partes_ficha:
            sub = "".join('<li><a class="oc-menu-enlace es-sub" href="#oc-ficha-%s" data-oc-ir="oc-ficha-%s">'
                          '<span class="oc-menu-emoji" aria-hidden="true">%s</span>'
                          '<span class="oc-menu-texto">%s</span></a></li>' % (g, g, em, tx)
                          for g, em, tx, _ in partes_ficha)
            menu.append('                            <li class="oc-menu-grupo"><a class="oc-menu-enlace" '
                        'href="#oc-ficha" data-oc-grupo="oc-ficha">%s</a>'
                        '<ul class="oc-menu-sub" id="oc-menu-ficha">%s</ul></li>' % (cabeza, sub))
            grupos = "".join('<div class="oc-hoja-grupo" id="oc-ficha-%s" data-oc-parte>'
                             '<h3 class="oc-hoja-grupo-titulo"><span aria-hidden="true">%s</span> %s</h3>'
                             '<div class="oc-hoja">%s</div></div>' % (g, em, tx, html_g)
                             for g, em, tx, html_g in partes_ficha)
            cajas.append('                        <div class="oc-apartado es-ficha" id="oc-ficha">\n'
                         '                            <h2 class="oc-apartado-titulo">%s</h2>\n'
                         '                            %s\n'
                         '                        </div>' % (texto, grupos))
            continue
        menu.append('                            <li><a class="oc-menu-enlace" href="#oc-%s" data-oc-ir="oc-%s">%s</a></li>'
                    % (ident, ident, cabeza))
        dentro = contenido.get(ident, "")
        clase = "oc-texto" if ident in ("historia", "extra") else "oc-lista"
        cajas.append(
            '                        <div class="oc-apartado" id="oc-%s" data-oc-parte>\n'
            '                            <h2 class="oc-apartado-titulo">%s</h2>\n'
            '                            <div class="%s">%s</div>\n'
            '                        </div>'
            % (ident, texto, clase, dentro or '<p class="oc-vacio">%s</p>' % vacio[ident]))
    menu.append('                        </ul>')
    menu.append('                        <a class="oc-volver oc-menu-volver" href="/web/personajes/index_personajes.html">'
                '← mis personajes</a>')
    menu.append('                    </nav>')
    cajas.append('                    </div>')
    return ('                    <div class="oc-panel" data-oc-panel>\n%s\n%s\n                    </div>'
            % ("\n".join(menu), "\n".join(cajas)))


def pagina_ficha(p, datos, personajes, avisos):
    c = clave_de(p)
    nombre = str(p.get("nombre") or c)
    completo = str(p.get("nombre_completo") or "").strip()
    icono = str(p.get("icono") or "").strip()
    que = lo_que_es(p)
    sub = []
    if completo and completo != nombre:
        sub.append('<p class="oc-nombre-completo">%s%s</p>'
                   % (('<span class="oc-icono" aria-hidden="true">%s</span>' % e(icono)) if icono else "", e(completo)))
    retrato = ruta_que_existe(p.get("retrato"))
    historia_plana = re.sub(r"[#*_>\[\]!|`]+", "", str(p.get("historia") or "")).split("\n")
    primera = next((l.strip() for l in historia_plana if l.strip()), "")
    descripcion = (completo or nombre) + (", " + que if que else "") + ". " + (primera[:180] if primera else
                                                                              "Uno de mis personajes de rol.")
    panel = pestanas(p, c, datos, personajes, avisos)
    cambios = {
        "{{TITULO}}": e("%s · Mis personajes" % (completo or nombre)),
        "{{DESCRIPCION}}": e(descripcion),
        "{{URL}}": URL + "%s/%s.html" % (c, c),
        "{{IMAGEN_OG}}": retrato or OG_POR_DEFECTO,
        "{{IMAGEN_OG_ALT}}": e(str(p.get("retrato_alt") or "Retrato de %s" % nombre) if retrato else
                               "El Blog de Richi — ilustración de Richi sobre fondo morado"),
        "{{COLOR}}": color_de(p),
        "{{NOMBRE}}": e(nombre),
        "{{NOMBRE_ATRIBUTO}}": e(nombre),
        "{{SUBTITULO}}": "\n                ".join(sub),
        "{{PANEL}}": panel,
        "{{VITALES}}": vitales(p),
        "{{POSTIT}}": postit(p, c),
        "{{BOTONES}}": botones(p, avisos),
    }
    return rellenar(leer_texto(MOLDE_FICHA)[0], cambios)


# =========================================
# ESCRIBIRLO
# =========================================

def rellenar(molde, cambios):
    for marca, valor in cambios.items():
        molde = molde.replace(marca, valor)
    return molde


def escribir(destino, texto, probar):
    """Solo si cambia algo. La página que ya existe trae su <head> y su
    menú ya puestos por actualizar-cabeceras.py: se le respetan, para que
    no salga «cambiada» cada vez que se pasa esto."""
    if destino.is_file():
        viejo = leer_texto(destino)[0]
        texto = conservar_cabecera(viejo, texto)
        if viejo == texto:
            return False
    if not probar:
        destino.parent.mkdir(parents=True, exist_ok=True)
        escribir_texto(destino, texto)
    return True


def conservar_cabecera(viejo, nuevo):
    """Lo que pone actualizar-cabeceras.py (el CSS, el JS y el menú) se
    copia de la página que ya había; lo demás, lo nuevo."""
    for patron in (r"<!-- ==== CSS ==== -->.*?<!-- ==== fin del JS ==== -->",
                   r'<div id="sidebar-container"[^>]*>.*?</div>\s*(?=\n\s*<main)'):
        en_viejo = re.search(patron, viejo, re.S)
        en_nuevo = re.search(patron, nuevo, re.S)
        if en_viejo and en_nuevo:
            nuevo = nuevo[:en_nuevo.start()] + en_viejo.group(0) + nuevo[en_nuevo.end():]
    return nuevo


def main():
    probar = "--probar" in sys.argv
    datos = leer_json(DATOS, None)
    if not isinstance(datos, dict):
        print("  No encuentro datos/personajes/personajes.json (o no tiene la forma que espero).")
        return
    personajes, vistas = [], set()
    for p in datos.get("personajes") or []:
        if not isinstance(p, dict) or not clave_de(p):
            continue
        if clave_de(p) in vistas:
            print("  Hay dos personajes con la clave «%s»: el segundo no sale." % clave_de(p))
            continue
        vistas.add(clave_de(p))
        personajes.append(p)

    cambiadas = []
    if escribir(WEB / "index_personajes.html", pagina_indice(datos, personajes), probar):
        cambiadas.append("index_personajes.html")
    for p in personajes:
        c = clave_de(p)
        avisos = Avisos()
        if escribir(WEB / c / ("%s.html" % c), pagina_ficha(p, datos, personajes, avisos), probar):
            cambiadas.append("%s/%s.html" % (c, c))
        for que, donde in getattr(avisos, "lista", []) or []:
            print("  %s: %s «%s»" % (p.get("nombre") or c, que, donde))

    # Los que ya no están en el JSON: se avisa, no se borra nada.
    if WEB.is_dir():
        for carpeta in sorted(x for x in WEB.iterdir() if x.is_dir()):
            if carpeta.name not in vistas:
                print("  web/personajes/%s/ ya no está en el JSON: bórrala a mano si sobra." % carpeta.name)

    for nombre in cambiadas:
        print("  %s web/personajes/%s" % ("cambiaría" if probar else "escrita", nombre))
    if not cambiadas:
        print("  Las páginas de los personajes ya estaban al día.")


if __name__ == "__main__":
    main()
