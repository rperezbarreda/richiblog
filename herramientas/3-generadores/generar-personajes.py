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
PESTANAS = (("historia", "historia"), ("ficha", "ficha"), ("gente", "npcs"), ("imagenes", "imágenes"),
            ("extra", "extra"))

# Las subpestañas de la pestaña «ficha» (lo de D&D), en su orden y con su
# emoji, como las secciones de la hoja de D&D Beyond: qué ventanitas van en
# cada una lo dice apartado_ficha(). Solo salen las que tienen algo.
SUBPESTANAS_DE_FICHA = (
    ("combate", "📊", "combate"),
    ("habilidades", "🎯", "habilidades"),
    ("acciones", "⚔️", "acciones"),
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


def postit(p, c):
    nombre = str(p.get("nombre") or c)
    retrato = ruta_que_existe(p.get("retrato"))
    alt = str(p.get("retrato_alt") or "").strip() or "Retrato de %s" % nombre
    partes = ['                    <div class="oc-postit">']
    if retrato:
        partes.append('                        <button class="lightbox-trigger oc-retrato" type="button" '
                      'aria-label="Ver en grande: %s">\n'
                      '                            <img src="%s" alt="%s" decoding="async">\n'
                      '                        </button>' % (e(alt), e(retrato), e(alt)))
    else:
        partes.append('                        <div class="oc-retrato es-sin-foto"><span class="oc-inicial" '
                      'aria-hidden="true">%s</span></div>' % e(inicial(nombre)))
    que = lo_que_es(p)
    if que:
        partes.append('                        <p class="oc-postit-que">%s</p>' % e(que))
    lema = str(p.get("lema") or "").strip()
    if lema:
        partes.append('                        <p class="oc-postit-lema">«%s»</p>' % e(lema.strip("«»\"")))
    valores = [(k, corto, largo, numero(p.get(k))) for k, corto, largo in STATS]
    if any(v is not None for *_, v in valores):
        partes.append('                        <h2 class="oc-stats-titulo">características</h2>')
        partes.append('                        <dl class="oc-stats">')
        for _, corto, largo, v in valores:
            partes.append(
                '                            <div class="oc-stat">'
                '<dt><abbr title="%s">%s</abbr></dt>'
                '<dd><span class="oc-stat-valor">%s</span>%s</dd></div>'
                % (largo, corto, "—" if v is None else v,
                   "" if v is None else '<span class="oc-stat-mod"><span class="visually-hidden">, modificador </span>%s</span>' % modificador(v)))
        partes.append('                        </dl>')
    partes.append('                    </div>')
    return "\n".join(partes)


def boton_pdf(p, avisos):
    pedido = str(p.get("ficha") or "").strip()
    ruta = ruta_que_existe(pedido)
    if pedido and not ruta:
        avisos.di("ficha en PDF que no encuentro", pedido)
    if not ruta:
        return ""
    return ('                    <a class="oc-pdf" href="%s" target="_blank" rel="noopener">ver ficha pdf'
            '<span class="visually-hidden"> (se abre en otra pestaña)</span></a>' % e(ruta))


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


def recuadro(titulo, dentro, clase="", emoji=""):
    """Una ventanita como las del resto del sitio: su barra de título con
    nombre de archivo («combate.dat») y los −■✕ (que la pliegan: lo hace
    scripts/componentes/ventanas-plegables.js), y lo de dentro."""
    # Un <div> y no un <section>: base.css le da a TODA <section> alto,
    # scroll y relleno de página entera.
    return ('<div class="oc-hoja-caja%s"><div class="recent-entries-header">'
            '<h4 class="oc-hoja-titulo">%s%s</h4>'
            '<div class="window-controls window-controls-small" data-window-controls aria-hidden="true"></div>'
            '</div><div class="oc-hoja-dentro">%s</div></div>'
            % ((" " + clase) if clase else "",
               ('<span class="oc-hoja-emoji" aria-hidden="true">%s</span>' % emoji) if emoji else "", e(titulo), dentro))


def lista_simple(cosas, clase="oc-lista-maquina"):
    return '<ul class="%s">%s</ul>' % (clase, "".join("<li>%s</li>" % e(x) for x in cosas))


def numeros(datos):
    """Los numeritos grandes (CA, PG, CD…), cada uno en su cajita como las
    de estadisticas.dat en «quién soy»: lo que es arriba en pequeñito, el
    número en grande y una barra abajo. Cada dato es (nombre, valor,
    barra) o (nombre, valor, barra, dicho): la barra es solo para la
    vista (la abreviatura: «CA», «PG»…) salvo que lleve «dicho», que es
    como se lee (el modificador de una característica)."""
    cajas = []
    for dato in datos:
        nombre, valor, barra = dato[:3]
        dicho = dato[3] if len(dato) > 3 else None
        if not barra:
            pie = ""
        elif dicho is None:
            pie = '<span class="oc-cajita-barra" aria-hidden="true">%s</span>' % e(barra)
        else:
            pie = ('<span class="oc-cajita-barra"><span class="visually-hidden">%s </span>%s</span>'
                   % (e(dicho), e(barra)))
        # Lo que no cabe en grande («10d6», «1208») va algo más pequeño.
        cajas.append('<li class="oc-cajita"><span class="oc-cajita-nombre">%s</span>'
                     '<span class="oc-cajita-valor%s">%s</span>%s</li>'
                     % (e(nombre), " es-larga" if len(str(valor)) > 3 else "", e(valor), pie))
    return '<ul class="oc-cajitas">%s</ul>' % "".join(cajas)


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


def objeto_con_cuantos(texto):
    """«Antorcha ×5» -> su emoji, el nombre y, aparte, la cantidad en su
    chapita."""
    m = re.match(r"^(.*?)\s*[×x]\s*(\d+)$", texto.strip())
    nombre, cuantos = (m.group(1), m.group(2)) if m else (texto.strip(), "")
    emoji = emoji_de_objeto(nombre)
    return ('%s%s%s' % (('<span class="oc-objeto-emoji" aria-hidden="true">%s</span>' % emoji) if emoji else "",
                        e(nombre), (' <span class="oc-hoja-cuantos">×%s</span>' % cuantos) if cuantos else ""))


# Las monedas de D&D: la abreviatura y cómo se llaman.
MONEDAS = {"pc": "cobre", "pp": "plata", "pe": "electro", "po": "oro", "ppt": "platino",
           "cp": "cobre", "sp": "plata", "ep": "electro", "gp": "oro", "pt": "platino"}


def marcas(n, clase=""):
    """Unos circulitos como los de habilidades.lst (los espacios de
    conjuro). Solo para la vista."""
    return '<span class="oc-marcas" aria-hidden="true">%s</span>' % (
        '<span class="oc-marca%s"></span>' % ((" " + clase) if clase else "")) * n


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


def desplegable(cabeza, entrada, origen, c, personajes, avisos, cuerpo_extra=""):
    """Una cosa de la ficha: si tiene descripción (o texto propio), un
    <details> que se despliega con sus datos y su texto; si no, solo su
    nombre, con de dónde le viene detrás si se sabe. «cabeza» ya va en
    HTML (el nombre, su emoji, sus usos…)."""
    origen = (entrada or {}).get("origen") or origen
    cuerpo = (entrada or {}).get("cuerpo") or cuerpo_extra
    datos = (entrada or {}).get("datos") or ""
    if not (cuerpo or datos):
        return cabeza + chapa_de_origen(origen)
    dentro = ""
    if datos:
        dentro += '<ul class="oc-desplegable-datos">%s</ul>' % "".join(
            "<li>%s</li>" % e(x.strip()) for x in datos.split("·") if x.strip())
    if cuerpo:
        dentro += '<div class="oc-texto">%s</div>' % markdown(cuerpo, c, personajes, avisos)
    return ('<details class="oc-desplegable"><summary><span class="oc-desplegable-flecha" aria-hidden="true">▸</span>'
            '<span class="oc-desplegable-cabeza">%s</span>%s</summary>'
            '<div class="oc-desplegable-dentro">%s</div></details>' % (cabeza, chapa_de_origen(origen), dentro))


def lista_desplegable(cosas, clase, descripciones, c, personajes, avisos, cabeza=None):
    """Una lista (conjuros, acciones, objetos…) con cada cosa desplegable
    si tiene descripción."""
    filas = []
    for x in cosas:
        filas.append("<li>%s</li>" % desplegable(cabeza(x) if cabeza else e(x), buscar_descripcion(descripciones, x),
                                                 "", c, personajes, avisos))
    return '<ul class="%s">%s</ul>' % (clase, "".join(filas))


def rasgos_desplegables(texto, descripciones, c, personajes, avisos):
    """Los rasgos, si están escritos como lista («- **Nombre** (de dónde
    viene)» o «- **Nombre.** Lo que hace.»): cada uno desplegable, con su
    descripción (o con lo que hay escrito detrás del nombre). Si están
    escritos de otra manera, None (y salen tal cual, con formato)."""
    lineas = [l for l in str(texto or "").split("\n") if l.strip()]
    if not lineas or not all(re.match(r"^\s*[-*+]\s+", l) for l in lineas):
        return None
    filas = []
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
        filas.append("<li>%s</li>" % desplegable('<span class="oc-desplegable-nombre">%s</span>' % e(nombre),
                                                 buscar_descripcion(descripciones, nombre), origen,
                                                 c, personajes, avisos, resto))
    return '<ul class="oc-lista-maquina oc-hoja-rasgos">%s</ul>' % "".join(filas)


def apartado_ficha(p, c, personajes, avisos):
    mods = {k: (modificador_num(numero(p.get(k))) if numero(p.get(k)) is not None else None) for k, _, _ in STATS}
    comp = bonificador_de_competencia(p)
    corto_de = dict((a, b) for a, b, _ in STATS)
    largo_de = dict((a, c3) for a, _, c3 in STATS)
    # Las ventanitas, repartidas en las SUBPESTAÑAS de la ficha.
    grupos = {g: [] for g, _, _ in SUBPESTANAS_DE_FICHA}
    descripciones = leer_descripciones(p.get("descripciones"))

    def lista_con(cosas, clase="oc-lista-maquina", cabeza=None):
        return lista_desplegable(cosas, clase, descripciones, c, personajes, avisos, cabeza)

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
    stats = [(largo.lower(), str(numero(p.get(k))), con_signo(mods[k]), "modificador")
             for k, _, largo in STATS if mods[k] is not None]
    if stats:
        grupos["combate"].append(recuadro("estadisticas.dat", numeros(stats), "es-ancha", "📊"))
    datos = []
    for clave, texto, barra in (("ca", "clase de armadura", "CA"), ("pg", "puntos de golpe", "PG"),
                                ("velocidad", "velocidad", "a pie")):
        valor = str(p.get(clave) or "").strip()
        if valor:
            datos.append((texto, valor, barra))
    if mods["des"] is not None:
        datos.append(("iniciativa", con_signo(mods["des"]), "DES"))
    if comp is not None:
        datos.append(("competencia", con_signo(comp), "bono"))
    dados = str(p.get("dados_golpe") or "").strip()
    if dados:
        datos.append(("dados de golpe", dados, "DG"))
    if datos:
        grupos["combate"].append(recuadro("combate.dat", numeros(datos), "es-ancha", "🛡️"))
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
        filas = [fila_de_tirada(largo.lower(), mods[k] + ((comp or 0) if k in salva else 0), 1 if k in salva else 0)
                 for k, _, largo in STATS if mods[k] is not None]
        grupos["habilidades"].append(recuadro("salvaciones.lst", '<ul class="oc-hoja-tiradas">%s</ul>'
                                              % "".join(filas), "", "🎲"))
        filas = [fila_de_tirada(nombre.lower(), bono_de_habilidad(nombre), competentes.get(llano(nombre), 0),
                                corto_de[k].lower())
                 for nombre, k in HABILIDADES if mods[k] is not None]
        grupos["habilidades"].append(recuadro("habilidades.lst", '<ul class="oc-hoja-tiradas es-dos-columnas">%s</ul>'
                                              % "".join(filas), "es-ancha", "🎯"))

    # ⚔️ ACCIONES: los ataques y lo demás que hace en un turno.
    ataques = lineas_de(p.get("ataques"))
    if ataques:
        filas = []
        for a in ataques:
            nombre, _, resto = a.partition(":")
            cabeza = ('<span class="oc-hoja-nombre">%s</span>%s'
                      % (e(nombre.strip()), (' <span class="oc-hoja-detalle">%s</span>' % e(resto.strip()))
                         if resto.strip() else ""))
            filas.append('<li>%s</li>' % desplegable(cabeza, buscar_descripcion(descripciones, nombre), "",
                                                     c, personajes, avisos))
        grupos["acciones"].append(recuadro("ataques.lst", '<ul class="oc-hoja-filas">%s</ul>' % "".join(filas),
                                           "es-ancha", "🗡️"))
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
            ("ataque de conjuro", con_signo(comp + mods[aptitud]), "ataque")]), "es-ancha", "🔮"))
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
            dentro += ('<p class="oc-hoja-espacios">%s%d %s</p>'
                       % (marcas(n), n, "espacio" if n == 1 else "espacios"))
        if por_nivel.get(clave_n):
            # A dos columnas solo si no se despliega ninguno (desplegado, un
            # conjuro a media columna no se lee).
            con_algo = any(buscar_descripcion(descripciones, x) for x in por_nivel[clave_n])
            dentro += lista_con(por_nivel[clave_n], "oc-lista-maquina" + ("" if con_algo else " oc-hoja-conjuros"))
        grupos["conjuros"].append(recuadro(titulo, dentro, "", "✨" if clave_n == "0" else "📖"))

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
        con_algo = any(buscar_descripcion(descripciones, o) for o in objetos)
        grupos["inventario"].append(recuadro("inventario.lst", lista_con(
            objetos, "oc-lista-maquina" + ("" if con_algo else " oc-hoja-objetos"), objeto_con_cuantos),
            "es-ancha", "🎒"))

    # 🧬 RASGOS: los de raza, de clase y las dotes.
    rasgos = rasgos_desplegables(p.get("rasgos"), descripciones, c, personajes, avisos)
    if rasgos is None:
        rasgos = markdown(p.get("rasgos"), c, personajes, avisos)
        rasgos = '<div class="oc-texto">%s</div>' % rasgos if rasgos else ""
    if rasgos:
        grupos["rasgos"].append(recuadro("rasgos.txt", rasgos, "es-ancha", "🧬"))

    # 🗣️ COMPETENCIAS: los idiomas aparte, y lo demás en pastillas.
    idiomas, otras = [], []
    for linea in lineas_de(p.get("competencias")):
        if llano(linea).startswith("idiomas:"):
            idiomas += [x.strip() for x in linea.split(":", 1)[1].split(",") if x.strip()]
        else:
            otras.append(linea)
    if idiomas:
        grupos["competencias"].append(recuadro("idiomas.txt", etiquetas(idiomas), "", "🗣️"))
    if otras:
        grupos["competencias"].append(recuadro("competencias.txt", etiquetas(otras), "", "🛠️"))

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
    return hoja_con_subpestanas(grupos)


def hoja_con_subpestanas(grupos):
    """Los grupos que tienen algo, cada uno en su apartado, y encima unos
    enlaces para saltar a cada uno: personajes.js los convierte en
    subpestañas (debajo de las de historia, ficha…). Sin JavaScript se ven
    todos, uno debajo de otro, con su título. Con un solo grupo, sin
    subpestañas."""
    llenos = [(g, emoji, texto) for g, emoji, texto in SUBPESTANAS_DE_FICHA if grupos[g]]
    if not llenos:
        return ""
    cajas = []
    for g, emoji, texto in llenos:
        cajas.append('<div class="oc-hoja-grupo" id="oc-ficha-%s" data-oc-subapartado="%s">'
                     '<h3 class="oc-hoja-grupo-titulo"><span aria-hidden="true">%s</span> %s</h3>'
                     '<div class="oc-hoja">%s</div></div>'
                     % (g, g, emoji, texto, "".join(grupos[g])))
    if len(llenos) == 1:
        return cajas[0]
    menu = ('<nav class="oc-subpestanas" aria-label="Partes de la ficha" data-oc-subpestanas>%s</nav>'
            % "".join('<a class="oc-subpestana" href="#oc-ficha-%s" data-oc-pestana="%s">'
                      '<span class="oc-subpestana-emoji" aria-hidden="true">%s</span>%s</a>'
                      % (g, g, emoji, texto) for g, emoji, texto in llenos))
    return menu + '<div class="oc-hoja-grupos" data-oc-subpanel>%s</div>' % "".join(cajas)


def modificador_num(valor):
    return (valor - 10) // 2


def fila_de_tirada(nombre, total, nivel, corto=""):
    """Una tirada como las de habilidades.lst en «quién soy»: el circulito
    (vacío, relleno si es competente, con aro si tiene pericia), el bono y
    el nombre, y de qué característica tira. El circulito es solo para la
    vista; para el lector va dicho con palabras."""
    marca = ("", " es-llena", " es-pericia")[nivel]
    dicho = ("", " (competente)", " (con pericia)")[nivel]
    return ('<li class="oc-tirada"><span class="oc-marca%s" aria-hidden="true"></span>'
            '<span><span class="oc-tirada-bono">%s</span> %s%s<span class="visually-hidden">%s</span></span></li>'
            % (marca, con_signo(total), e(nombre),
               (' <span class="oc-tirada-de">(%s)</span>' % corto) if corto else "", dicho))


def pestanas(p, c, datos, personajes, avisos):
    nombre = str(p.get("nombre") or c)
    contenido = {
        "historia": markdown(p.get("historia"), c, personajes, avisos),
        "ficha": apartado_ficha(p, c, personajes, avisos),
        "gente": apartado_gente(grupos_de(datos, "gente", c), c, personajes, avisos),
        "imagenes": apartado_imagenes(grupos_de(datos, "imagenes", c), nombre),
        "extra": markdown(p.get("extra"), c, personajes, avisos),
    }
    vacio = {
        "historia": "Todavía no he escrito su historia.",
        "ficha": "Todavía no tiene la ficha apuntada.",
        "gente": "Todavía no hay nadie apuntado.",
        "imagenes": "Todavía no hay imágenes.",
        "extra": "Nada más, de momento.",
    }
    # Sin JavaScript, los cinco apartados uno debajo de otro y estos
    # enlaces para saltar a cada uno; con él, personajes.js convierte los
    # enlaces en pestañas y enseña solo el elegido.
    menu = ['                    <nav class="oc-pestanas" aria-label="Apartados de %s" data-oc-pestanas>' % e(nombre)]
    for ident, texto in PESTANAS:
        menu.append('                        <a class="oc-pestana" href="#oc-%s" data-oc-pestana="%s">%s</a>'
                    % (ident, ident, texto))
    menu.append('                    </nav>')
    cajas = ['                    <div class="oc-panel" data-oc-panel>']
    for ident, texto in PESTANAS:
        dentro = contenido[ident]
        clase = "oc-texto" if ident in ("historia", "extra") else "oc-lista"
        cajas.append(
            '                        <div class="oc-apartado%s" id="oc-%s" data-oc-apartado="%s">\n'
            '                            <h2 class="oc-apartado-titulo">%s</h2>\n'
            '                            <div class="%s">%s</div>\n'
            '                        </div>'
            % (" es-ficha" if ident == "ficha" else "", ident, ident, texto, clase,
               dentro or '<p class="oc-vacio">%s</p>' % vacio[ident]))
    cajas.append('                    </div>')
    return "\n".join(menu + cajas)


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
        "{{PESTANAS}}": pestanas(p, c, datos, personajes, avisos),
        "{{POSTIT}}": postit(p, c),
        "{{PDF}}": boton_pdf(p, avisos),
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
