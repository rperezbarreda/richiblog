# =========================================
# LAS RECETAS (mis movidas → recetas)
# =========================================
# Escribe, a partir de datos/mis_movidas/recetas.json, el índice
# (web/mis_movidas/recetas/index_recetas.html: buscador, filtros por tipo
# de plato y etiquetas, y una tarjeta por receta) y la página de cada una
# (web/mis_movidas/recetas/<clave>.html: foto, tiempos, raciones,
# ingredientes que se pueden ir marcando, pasos y notas).
#
# Se pasa sola desde el editor al guardar una receta. A mano:
#     python herramientas/3-generadores/generar-recetas.py [--probar]
# y después actualizar-cabeceras.py (el <head> y el menú de las nuevas).
#
# CADA RECETA EN EL JSON ("recetas": [...], la última arriba):
#   titulo        «Tortilla de patatas» (lo único obligatorio).
#   clave         el nombre de su página (tortilla-de-patatas); si no
#                 está, sale del título. Mejor no cambiarla después.
#   fecha         «06-11-2026» (cuándo se publicó).
#   tipo          tipo de plato: «Postre», «Plato principal»… (un botón
#                 del filtro).
#   etiquetas     «vegetariana, sin gluten» (más botones del filtro). Con
#                 los tiempos, si en total no pasa de 30 minutos, se le
#                 pone sola la de «rápida».
#   imagen, imagen_alt   la foto (imagenes/mis_movidas/recetas/) y qué se
#                 ve en ella.
#   descripcion   una o dos frases (la tarjeta y lo de arriba de la
#                 página).
#   raciones      «4 personas», «12 galletas».
#   preparacion, coccion, reposo   en minutos (números). Salen como «1 h
#                 15 min»; el total los suma.
#   dificultad    «Fácil», «Media» o «Difícil».
#   origen        de dónde viene: «De mi abuela».
#   ingredientes  uno por línea: «200 g de harina». «## Para la masa»
#                 encima de unos los agrupa.
#   pasos         uno por línea, en orden (también con «## …»).
#   notas         con formato (markdown): trucos, variantes, cómo se
#                 guarda…

import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "0-comun"))

from comun import PLANTILLAS, RAIZ, escribir_texto, leer_json, leer_texto, nombre_archivo  # noqa: E402
from mundo_formato import Avisos, Conversor  # noqa: E402

DATOS = RAIZ / "datos" / "mis_movidas" / "recetas.json"
WEB = RAIZ / "web" / "mis_movidas" / "recetas"
URL = "/web/mis_movidas/recetas/"
MOLDE_INDICE = PLANTILLAS / "recetas-index.html"
MOLDE_RECETA = PLANTILLAS / "receta.html"
OG_POR_DEFECTO = "/imagenes/meta/og.webp"
OG_ALT = "El Blog de Richi — ilustración de Richi sobre fondo morado"
# Hasta cuántos minutos en total es «rápida» (la etiqueta que se pone sola).
RAPIDA = 30


def e(texto):
    return html.escape(str(texto if texto is not None else ""), quote=True)


def clave_de(r):
    return nombre_archivo(str(r.get("clave") or r.get("titulo") or ""), "")


def ruta_que_existe(ruta):
    """Una dirección del sitio ("/imagenes/…") si el archivo está; si no,
    "" (y así la página no lleva una imagen rota)."""
    ruta = str(ruta or "").strip()
    if ruta.startswith("/") and not ruta.startswith("//") and (RAIZ / ruta.lstrip("/")).is_file():
        return ruta
    return ""


def minutos(valor):
    try:
        n = int(float(str(valor).strip().replace(",", ".")))
    except (TypeError, ValueError):
        return 0
    return max(0, n)


def tiempo(n):
    """90 -> «1 h 30 min»."""
    if n <= 0:
        return ""
    h, m = divmod(n, 60)
    if not h:
        return "%d min" % m
    return "%d h" % h + (" %d min" % m if m else "")


def iso_tiempo(n):
    """Para los buscadores (schema.org): 90 -> «PT1H30M»."""
    h, m = divmod(n, 60)
    return "PT" + ("%dH" % h if h else "") + ("%dM" % m if m or not h else "")


def lista_de(valor):
    if isinstance(valor, list):
        trozos = valor
    else:
        trozos = str(valor or "").split("\n")
    return [str(t).strip() for t in trozos if str(t).strip()]


def grupos_de(valor):
    """Las líneas, por grupos: «## Para la masa» abre uno. [(titulo, [cosas])]."""
    grupos = [("", [])]
    for linea in lista_de(valor):
        if linea.startswith("#"):
            grupos.append((linea.lstrip("#").strip(), []))
        else:
            grupos[-1][1].append(re.sub(r"^(?:[-*•]|\d+[.)])\s+", "", linea))
    return [(t, cosas) for t, cosas in grupos if cosas]


def etiquetas_de(r):
    """El tipo de plato, sus etiquetas y, si va, «rápida». Sin repetir y sin
    comas dentro (la coma separa: así lo lee filtros.js)."""
    crudo = r.get("etiquetas")
    trozos = crudo if isinstance(crudo, list) else str(crudo or "").replace("\n", ",").split(",")
    total = minutos(r.get("preparacion")) + minutos(r.get("coccion")) + minutos(r.get("reposo"))
    salida, vistas = [], set()
    for trozo in [r.get("tipo") or ""] + list(trozos) + (["rápida"] if 0 < total <= RAPIDA else []):
        limpio = " ".join(str(trozo).replace(",", " ").split()).strip().lower()
        if limpio and limpio not in vistas:
            vistas.add(limpio)
            salida.append(limpio)
    return salida


def fecha_iso(fecha):
    m = re.fullmatch(r"\s*(\d{1,2})-(\d{1,2})-(\d{4})\s*", str(fecha or ""))
    return "%s-%02d-%02d" % (m.group(3), int(m.group(2)), int(m.group(1))) if m else ""


MESES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
         "noviembre", "diciembre")


def fecha_bonita(fecha):
    iso = fecha_iso(fecha)
    if not iso:
        return ""
    a, m, d = iso.split("-")
    return "%d de %s de %s" % (int(d), MESES[int(m) - 1], a)


def markdown(texto, avisos):
    texto = str(texto or "").strip()
    if not texto:
        return ""
    return Conversor(lambda n: ("", False), ruta_que_existe, avisos, None).a_html(texto)


def ventana(nombre, dentro):
    """Un recuadro con su barra de título de ventana (y sus −■✕ de
    adorno, que los pone botones-ventana.js)."""
    return ('<section class="receta-ventana" aria-labelledby="receta-%s">\n'
            '    <div class="receta-ventana-barra">\n'
            '        <h2 id="receta-%s">%s</h2>\n'
            '        <div class="window-controls window-controls-small" data-window-controls aria-hidden="true"></div>\n'
            '    </div>\n'
            '    <div class="receta-ventana-cuerpo">\n%s\n    </div>\n'
            '</section>\n') % (e(nombre.split(".")[0]), e(nombre.split(".")[0]),
                               e(nombre), dentro)


def datos_de_tiempo(r):
    """[(emoji, qué, cuánto)] con lo que haya, y el total."""
    filas = []
    for k, emoji, que in (("preparacion", "🔪", "preparación"), ("coccion", "🔥", "cocción"), ("reposo", "⏳", "reposo")):
        n = minutos(r.get(k))
        if n:
            filas.append((emoji, que, tiempo(n)))
    total = sum(minutos(r.get(k)) for k in ("preparacion", "coccion", "reposo"))
    return filas, total


# =========================================
# EL ÍNDICE
# =========================================

def tarjeta(r):
    c = clave_de(r)
    foto = ruta_que_existe(r.get("imagen"))
    _, total = datos_de_tiempo(r)
    etiquetas = etiquetas_de(r)
    datos = [x for x in (("⏱️ " + tiempo(total)) if total else "",
                         ("🍽️ " + str(r.get("raciones")).strip()) if str(r.get("raciones") or "").strip() else "",
                         ("📊 " + str(r.get("dificultad")).strip()) if str(r.get("dificultad") or "").strip() else "")
             if x]
    # Los ingredientes, escondidos, para que el buscador también encuentre
    # por ellos («calabacín»).
    ingredientes = "; ".join(c for _, cosas in grupos_de(r.get("ingredientes")) for c in cosas)
    return (
        '                <li class="receta-celda" data-categoria="%s">\n'
        '                    <article class="receta-tarjeta">\n'
        '                        %s\n'
        '                        <div class="receta-tarjeta-texto">\n'
        '                            <h2 class="receta-tarjeta-titulo"><a href="%s%s.html">%s</a></h2>\n'
        '%s%s%s'
        '                            <span class="visually-hidden receta-tarjeta-ingredientes">Ingredientes: %s</span>\n'
        '                        </div>\n'
        '                    </article>\n'
        '                </li>\n'
    ) % (e(", ".join(etiquetas)),
         ('<img class="receta-tarjeta-foto" src="%s" alt="" loading="lazy" decoding="async" width="600" height="400">'
          % e(foto)) if foto else '<span class="receta-tarjeta-foto es-sin-foto" aria-hidden="true">🍳</span>',
         URL, c, e(r.get("titulo") or c),
         ('                            <p class="receta-tarjeta-datos">%s</p>\n' % e(" · ".join(datos))) if datos else "",
         ('                            <p class="receta-tarjeta-desc">%s</p>\n' % e(r.get("descripcion")))
         if str(r.get("descripcion") or "").strip() else "",
         ('                            <ul class="receta-etiquetas" aria-label="Etiquetas">%s</ul>\n'
          % "".join('<li>%s</li>' % e(x) for x in etiquetas)) if etiquetas else "",
         e(ingredientes))


BUSCADOR = """            <form class="buscar" role="search" data-buscar
                  data-buscar-items=".receta-celda"
                  data-buscar-en=".receta-tarjeta-titulo, .receta-tarjeta-desc, .receta-etiquetas, .receta-tarjeta-ingredientes"
                  data-buscar-nombre="receta|recetas">
                <label class="buscar-label" for="buscar-campo">buscar:</label>
                <div class="buscar-caja">
                    <input class="buscar-campo" type="search" id="buscar-campo"
                           name="buscar" placeholder="nombre, ingrediente o etiqueta"
                           autocomplete="off" spellcheck="false"
                           aria-describedby="buscar-cuenta">
                    <button class="buscar-limpiar" type="button" data-buscar-limpiar hidden>
                        <span aria-hidden="true">✕</span>
                        <span class="visually-hidden">Limpiar la búsqueda</span>
                    </button>
                </div>
                <p class="buscar-cuenta" id="buscar-cuenta" role="status"
                   data-buscar-cuenta></p>
            </form>

            <div class="filtros" data-filtros
                 data-filtros-items=".receta-celda"
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


def pagina_indice(datos, recetas):
    titulo = str(datos.get("titulo") or "recetas")
    intro = str(datos.get("intro") or "").strip()
    if recetas:
        lista = BUSCADOR + ('            <ul class="receta-rejilla">\n%s            </ul>'
                            % "".join(tarjeta(r) for r in recetas))
    else:
        lista = '            <p class="receta-vacio">Todavía no hay ninguna receta.</p>'
    cambios = {
        "{{TITULO}}": e(titulo[:1].upper() + titulo[1:]),
        "{{TITULO_H1}}": e(titulo),
        "{{DESCRIPCION}}": e(intro or "Mis recetas de cocina."),
        "{{URL}}": URL + "index_recetas.html",
        "{{IMAGEN_OG}}": OG_POR_DEFECTO,
        "{{IMAGEN_OG_ALT}}": OG_ALT,
        "{{INTRO}}": ('<p class="receta-intro">%s</p>' % e(intro)) if intro else "",
        "{{LISTA}}": lista,
    }
    return rellenar(leer_texto(MOLDE_INDICE)[0], cambios)


# =========================================
# LA PÁGINA DE UNA RECETA
# =========================================

def ingredientes_html(r):
    grupos = grupos_de(r.get("ingredientes"))
    if not grupos:
        return ""
    c = clave_de(r)
    partes, n = [], 0
    for titulo, cosas in grupos:
        items = []
        for cosa in cosas:
            n += 1
            items.append('            <li><label class="receta-ingrediente"><input type="checkbox" data-receta-marca="%d">'
                         ' <span>%s</span></label></li>' % (n, e(cosa)))
        partes.append(('        <h3 class="receta-grupo">%s</h3>\n' % e(titulo) if titulo else "")
                      + '        <ul class="receta-ingredientes">\n%s\n        </ul>' % "\n".join(items))
    # Arriba, cuántos van marcados y el botón de desmarcar (los pone y los
    # mueve recetas.js: sin JavaScript, las casillas se marcan igual, pero
    # no se recuerdan).
    cabeza = ('        <div class="receta-marcas" data-receta-marcas="%s" hidden>\n'
              '            <p class="receta-marcas-cuenta" data-receta-cuenta aria-live="polite"></p>\n'
              '            <button class="receta-boton" type="button" data-receta-desmarcar>desmarcar todo</button>\n'
              '        </div>\n'
              '        <p class="receta-ayuda">Ve marcando lo que ya tienes o ya has echado.</p>\n') % e(c)
    return ventana("ingredientes.lst", cabeza + "\n".join(partes))


def pasos_html(r):
    grupos = grupos_de(r.get("pasos"))
    if not grupos:
        return ""
    partes = []
    for titulo, cosas in grupos:
        partes.append(('        <h3 class="receta-grupo">%s</h3>\n' % e(titulo) if titulo else "")
                      + '        <ol class="receta-pasos">\n%s\n        </ol>'
                      % "\n".join('            <li>%s</li>' % e(p) for p in cosas))
    return ventana("pasos.txt", "\n".join(partes))


def json_ld(r, foto):
    """Lo que entienden los buscadores (schema.org/Recipe)."""
    filas, total = datos_de_tiempo(r)
    d = {"@context": "https://schema.org", "@type": "Recipe", "name": str(r.get("titulo") or ""),
         "author": {"@type": "Person", "name": "Richi"},
         "recipeIngredient": [c for _, cosas in grupos_de(r.get("ingredientes")) for c in cosas],
         "recipeInstructions": [{"@type": "HowToStep", "text": p} for _, cosas in grupos_de(r.get("pasos"))
                                for p in cosas]}
    if str(r.get("descripcion") or "").strip():
        d["description"] = str(r["descripcion"]).strip()
    if foto:
        d["image"] = "https://richi.blog" + foto
    if fecha_iso(r.get("fecha")):
        d["datePublished"] = fecha_iso(r.get("fecha"))
    if str(r.get("raciones") or "").strip():
        d["recipeYield"] = str(r["raciones"]).strip()
    if str(r.get("tipo") or "").strip():
        d["recipeCategory"] = str(r["tipo"]).strip()
    for k, campo in (("preparacion", "prepTime"), ("coccion", "cookTime")):
        if minutos(r.get(k)):
            d[campo] = iso_tiempo(minutos(r.get(k)))
    if total:
        d["totalTime"] = iso_tiempo(total)
    # «</» no puede salir dentro de un <script>: se escapa la barra.
    texto = json.dumps(d, ensure_ascii=False, indent=2).replace("</", "<\\/")
    return '<script type="application/ld+json">\n%s\n    </script>' % texto


def pagina_receta(r, avisos):
    c = clave_de(r)
    titulo = str(r.get("titulo") or c)
    foto = ruta_que_existe(r.get("imagen"))
    if str(r.get("imagen") or "").strip() and not foto:
        avisos.di("imagen que no encuentro", r.get("imagen"))
    alt = str(r.get("imagen_alt") or "").strip()
    filas, total = datos_de_tiempo(r)
    datos = ['<li><span aria-hidden="true">%s</span> <span class="receta-dato-que">%s:</span> %s</li>'
             % (emoji, e(que), e(cuanto)) for emoji, que, cuanto in filas]
    if total and len(filas) > 1:
        datos.append('<li class="es-total"><span aria-hidden="true">⏱️</span> <span class="receta-dato-que">en total:</span> %s</li>'
                     % e(tiempo(total)))
    for k, emoji, que in (("raciones", "🍽️", "raciones"), ("dificultad", "📊", "dificultad"), ("origen", "👵", "de dónde viene")):
        v = str(r.get(k) or "").strip()
        if v:
            datos.append('<li><span aria-hidden="true">%s</span> <span class="receta-dato-que">%s:</span> %s</li>'
                         % (emoji, e(que), e(v)))
    etiquetas = etiquetas_de(r)
    etiquetas_html = ('<ul class="receta-etiquetas es-enlaces" aria-label="Etiquetas">%s</ul>'
                      % "".join('<li><a href="%sindex_recetas.html?cat=%s">%s</a></li>'
                                % (URL, e(x.replace(" ", "%20")), e(x)) for x in etiquetas)) if etiquetas else ""
    foto_html = ""
    if foto:
        foto_html = ('<button class="lightbox-trigger receta-foto" type="button">'
                     '<img src="%s" alt="%s" width="1200" height="800" decoding="async">'
                     '<span class="visually-hidden"> (ampliar)</span></button>' % (e(foto), e(alt)))
    notas = markdown(r.get("notas"), avisos)
    publicada = fecha_bonita(r.get("fecha"))
    cuerpo = (
        '            <div class="receta-cabecera">\n'
        '                <h1 class="home-title receta-titulo">%s</h1>\n'
        '%s%s%s'
        '            </div>\n'
        '            <div class="receta-arriba%s">\n'
        '                %s\n'
        '                %s\n'
        '            </div>\n'
        '            <div class="receta-columnas">\n%s%s            </div>\n'
        '%s'
    ) % (e(titulo),
         ('                <p class="receta-desc">%s</p>\n' % e(r.get("descripcion"))) if str(r.get("descripcion") or "").strip() else "",
         ('                <p class="receta-fecha">publicada el <time datetime="%s">%s</time></p>\n'
          % (fecha_iso(r.get("fecha")), e(publicada))) if publicada else "",
         ('                %s\n' % etiquetas_html) if etiquetas_html else "",
         "" if foto_html else " es-sin-foto",
         foto_html,
         ventana("datos.dat", '        <ul class="receta-datos">\n%s\n        </ul>' % "\n".join(
             "            " + d for d in datos)) if datos else "",
         ingredientes_html(r), pasos_html(r),
         ventana("notas.md", '        <div class="receta-notas">\n%s\n        </div>' % notas) if notas else "")
    descripcion = str(r.get("descripcion") or "").strip() or "Receta de %s." % titulo
    cambios = {
        "{{TITULO}}": e(titulo),
        "{{DESCRIPCION}}": e(descripcion),
        "{{URL}}": URL + c + ".html",
        "{{IMAGEN_OG}}": foto or OG_POR_DEFECTO,
        "{{IMAGEN_OG_ALT}}": e(alt or OG_ALT) if foto else OG_ALT,
        "{{JSON_LD}}": json_ld(r, foto),
        "{{CUERPO}}": cuerpo,
    }
    return rellenar(leer_texto(MOLDE_RECETA)[0], cambios)


# =========================================
# ESCRIBIR
# =========================================

def rellenar(molde, cambios):
    for marca, valor in cambios.items():
        molde = molde.replace(marca, valor)
    return molde


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


def escribir(destino, texto, probar):
    """Solo si cambia algo (y respetando el <head> y el menú que ya tenga)."""
    if destino.is_file():
        viejo = leer_texto(destino)[0]
        texto = conservar_cabecera(viejo, texto)
        if viejo == texto:
            return False
    if not probar:
        destino.parent.mkdir(parents=True, exist_ok=True)
        escribir_texto(destino, texto)
    return True


def main():
    probar = "--probar" in sys.argv
    datos = leer_json(DATOS, None)
    if not isinstance(datos, dict):
        print("  No encuentro datos/mis_movidas/recetas.json (o no tiene la forma que espero).")
        return
    recetas, vistas = [], set()
    for r in datos.get("recetas") or []:
        if not isinstance(r, dict) or not clave_de(r):
            continue
        if clave_de(r) in vistas or clave_de(r) == "index_recetas":
            print("  Hay dos recetas con la clave «%s»: la segunda no sale." % clave_de(r))
            continue
        vistas.add(clave_de(r))
        recetas.append(r)

    cambiadas = []
    if escribir(WEB / "index_recetas.html", pagina_indice(datos, recetas), probar):
        cambiadas.append("index_recetas.html")
    for r in recetas:
        c = clave_de(r)
        avisos = Avisos()
        if escribir(WEB / ("%s.html" % c), pagina_receta(r, avisos), probar):
            cambiadas.append("%s.html" % c)
        for que, donde in getattr(avisos, "lista", []) or []:
            print("  %s: %s «%s»" % (r.get("titulo") or c, que, donde))

    # Las que ya no están en el JSON: se avisa, no se borra nada.
    if WEB.is_dir():
        for pagina in sorted(WEB.glob("*.html")):
            if pagina.stem != "index_recetas" and pagina.stem not in vistas:
                print("  web/mis_movidas/recetas/%s ya no está en el JSON: bórrala a mano si sobra." % pagina.name)

    for nombre in cambiadas:
        print("  %s web/mis_movidas/recetas/%s" % ("cambiaría" if probar else "escrita", nombre))
    if not cambiadas:
        print("  Las páginas de las recetas ya estaban al día.")


if __name__ == "__main__":
    main()
