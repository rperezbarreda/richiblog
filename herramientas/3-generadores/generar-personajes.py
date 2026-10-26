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
#         "retrato": "/imagenes/personajes/yorel/yorel.webp",
#         "retrato_alt": "Cómo es, para quien no lo ve",
#         "raza": "…", "clase": "…", "nivel": 5, "lema": "Una frase suya",
#         "fue": 10, "des": 14, "con": 12, "int": 10, "sab": 13, "car": 16,
#         "ficha": "/imagenes/personajes/yorel/ficha-yorel.pdf",
#         "historia": "En Markdown", "extra": "En Markdown"
#     }],
#     "gente":    [{"personaje": "yorel", "cosas": [{"nombre", "que",
#                   "relacion", "token", "notas"}]}],
#     "imagenes": [{"personaje": "yorel", "cosas": [{"imagen", "alt",
#                   "pie"}]}]
#   }
#
# Solo hace falta la clave y el nombre: lo que falte no sale (sin foto,
# su inicial dentro del aro; sin estadísticas, sin cuadritos).
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
PESTANAS = (("historia", "historia"), ("gente", "npcs"), ("imagenes", "imágenes"), ("extra", "extra"))


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
    foto = ruta_que_existe(p.get("token")) or ruta_que_existe(p.get("retrato"))
    icono = str(p.get("icono") or "").strip()
    que = lo_que_es(p)
    return (
        '                <li class="oc-celda">\n'
        '                    <a class="oc-tarjeta %s" href="%s%s/%s.html">\n'
        '                        <span class="oc-tarjeta-aro">\n'
        '                            %s\n'
        '                            <span class="oc-tarjeta-nombre" aria-hidden="true">%s</span>\n'
        '                        </span>\n'
        '                        <span class="oc-tarjeta-etiqueta">%s<span class="oc-tarjeta-completo">%s</span></span>\n'
        '%s'
        '                    </a>\n'
        '                </li>\n'
    ) % (color_de(p), URL, c, c, redondel(foto, nombre, "oc-tarjeta-foto"), e(nombre),
         ('<span class="oc-icono" aria-hidden="true">%s</span>' % e(icono)) if icono else "", e(completo),
         ('                        <span class="oc-tarjeta-que">%s</span>\n' % e(que)) if que else "")


def pagina_indice(datos, personajes):
    titulo = str(datos.get("titulo") or "mis personajes")
    intro = str(datos.get("intro") or "").strip()
    if personajes:
        lista = ('            <ul class="oc-rejilla">\n%s            </ul>'
                 % "".join(tarjeta(p) for p in personajes))
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
    retrato = ruta_que_existe(p.get("retrato")) or ruta_que_existe(p.get("token"))
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


def pestanas(p, c, datos, personajes, avisos):
    nombre = str(p.get("nombre") or c)
    contenido = {
        "historia": markdown(p.get("historia"), c, personajes, avisos),
        "gente": apartado_gente(grupos_de(datos, "gente", c), c, personajes, avisos),
        "imagenes": apartado_imagenes(grupos_de(datos, "imagenes", c), nombre),
        "extra": markdown(p.get("extra"), c, personajes, avisos),
    }
    vacio = {
        "historia": "Todavía no he escrito su historia.",
        "gente": "Todavía no hay nadie apuntado.",
        "imagenes": "Todavía no hay imágenes.",
        "extra": "Nada más, de momento.",
    }
    # Sin JavaScript, los cuatro apartados uno debajo de otro y estos
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
            '                        <div class="oc-apartado" id="oc-%s" data-oc-apartado="%s">\n'
            '                            <h2 class="oc-apartado-titulo">%s</h2>\n'
            '                            <div class="%s">%s</div>\n'
            '                        </div>'
            % (ident, ident, texto, clase,
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
    retrato = ruta_que_existe(p.get("retrato")) or ruta_que_existe(p.get("token"))
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
