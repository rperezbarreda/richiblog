#!/usr/bin/env python3
# =========================================
# GENERADOR DE LOS LISTADOS (posts.json)
# =========================================
# Recorre las páginas que ya tienes escritas y reescribe los dos
# archivos de los que la web saca sus listados:
#
#     datos/blog/entradas-blog.json          (portada, archivo del año, diario, RSS)
#     datos/mis_movidas/mis-movidas.json   (portada y listado de relatos)
#     datos/notas_rol/notas-rol.json     (índice de cada campaña y RSS; a la portada
#                               NO va a propósito, ver más abajo)
#
# POR QUÉ
# -------
# Hasta ahora, al publicar algo había que hacer dos cosas: escribir el
# HTML y acordarse de añadir una línea al JSON con el título, la fecha,
# el enlace y las etiquetas. Cuando una de las dos se queda a medias,
# la entrada existe pero no aparece en ningún sitio (o al revés: sale
# en la lista y el enlace da 404), y no hay ningún aviso.
#
# Con esto, la página es la única fuente de la verdad: el JSON se
# reconstruye a partir de ella y no se vuelve a tocar a mano.
#
# CÓMO USARLO
# -----------
# Cada vez que publiques, borres o cambies el título/la fecha de una
# entrada, ejecuta desde la carpeta raíz del sitio:
#
#     python herramientas/3-generadores/generar-posts.py
#
# Para ver qué haría sin tocar nada:
#
#     python herramientas/3-generadores/generar-posts.py --probar
#
# Después conviene pasar también el del RSS, que lee de este JSON:
#
#     python herramientas/3-generadores/generar-rss.py
#
# DE DÓNDE SACA CADA COSA
# -----------------------
# Del propio HTML de la entrada:
#
#     título          <h1 class="blog-post-title">…</h1>
#     fecha           <p class="blog-post-date">12 sept 2026</p>
#     etiquetas       <article class="blog-post" data-tags="diario">
#                     (separadas por espacios; si alguna lleva coma se
#                     limpia al leerla)
#     enlace          la ruta del archivo dentro del sitio
#     minutos         cuánto se tarda en leerla, contando las palabras
#                     del cuerpo (ver PALABRAS_POR_MINUTO más abajo)
#
# Y en los relatos, igual con relato-post-title / relato-post-date y
# data-subcategoria.
#
# El portfolio de rol es la excepción: no son páginas sueltas ni
# tarjetas escritas en el HTML, sino las fichas de datos/mis_movidas/rol.json, que
# es donde se escriben y de donde las pinta scripts/paginas/rol.js. De
# cada una sale el título, la categoría, la fecha y el enlace de Ko-fi.

import sys
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import json
import re
import unicodedata

from comun import (
    RAIZ,
    escribir_json,
    escribir_texto,
    leer_texto,
    limpiar_html,
    paginas,
    sin_tildes,
    url_de,
)
BLOG = RAIZ / "web" / "blog"
RELATOS = RAIZ / "web" / "mis_movidas" / "relatos"
NOTAS_ROL = RAIZ / "web" / "notas_rol"
JSON_ROL = RAIZ / "datos" / "mis_movidas" / "rol.json"
JSON_BLOG = RAIZ / "datos" / "blog" / "entradas-blog.json"
JSON_MOVIDAS = RAIZ / "datos" / "mis_movidas" / "mis-movidas.json"
# Las notas de las partidas de rol van en su propio listado y NO en
# mis-movidas.json, a propósito: ese es el que leen la portada
# (novedades.exe) y el listado de relatos, y las notas de una partida no
# son algo que se publique para que lo lea nadie —son para acordarse—.
# Al RSS sí entran: generar-rss.py lee también este archivo.
JSON_NOTAS = RAIZ / "datos" / "notas_rol" / "notas-rol.json"

# Los meses tal y como los escribe la web en la fecha de cada entrada
# (es lo que devuelve toLocaleDateString en español). Se aceptan también
# los nombres enteros, por si algún día escribes la fecha a mano.
MESES = {
    "ene": 1, "enero": 1,
    "feb": 2, "febrero": 2,
    "mar": 3, "marzo": 3,
    "abr": 4, "abril": 4,
    "may": 5, "mayo": 5,
    "jun": 6, "junio": 6,
    "jul": 7, "julio": 7,
    "ago": 8, "agosto": 8,
    "sep": 9, "sept": 9, "septiembre": 9,
    "oct": 10, "octubre": 10,
    "nov": 11, "noviembre": 11,
    "dic": 12, "diciembre": 12,
}



# =========================================
# TIEMPO DE LECTURA
# =========================================
# 200 palabras por minuto es lo que se suele dar por bueno leyendo en
# pantalla en español (las cuentas que andan por ahí van de 180 a 240;
# 200 deja el número redondo y no exagera). El resultado es orientativo
# y así se escribe: "4 min", no "4 minutos y medio".
PALABRAS_POR_MINUTO = 200

RE_COMENTARIO = re.compile(r"<!--.*?-->", re.S)


def cuerpo_de(texto, prefijo):
    """El texto de la entrada, sin la cabecera ni la columna de al lado.

    La columna (blog-post-side) lleva el pie de una imagen y la ventana
    de "sigue leyendo", que no son la entrada: contándolos, dos entradas
    igual de largas salían con minutos distintos según cuántas cosas
    tuvieran al lado."""
    inicio = texto.find(f'<div class="{prefijo}-post-body">')
    if inicio == -1:
        return ""
    fin = texto.find(f'<div class="{prefijo}-post-side"', inicio)
    return texto[inicio:fin if fin != -1 else len(texto)]


def minutos_de(cuerpo):
    """Cuántos minutos se tarda en leer eso, como mínimo uno."""
    limpio = RE_COMENTARIO.sub(" ", cuerpo)
    palabras = len(re.sub(r"<[^>]+>", " ", limpio).split())
    if not palabras:
        return 0
    return max(1, round(palabras / PALABRAS_POR_MINUTO))


def buscar(patron, texto):
    encontrado = re.search(patron, texto, re.S)
    return encontrado.group(1).strip() if encontrado else None


def partir_etiquetas(crudas):
    """'diario testeo' y 'diario, testeo' dan lo mismo. Las comas son el
    error fácil de cometer al escribirlas, y si se colaban salía una
    etiqueta llamada 'diario,' con su propio botón en el filtro."""
    return [e for e in re.split(r"[\s,]+", crudas.strip().lower()) if e]



def leer_fecha(texto):
    """'12 sept 2026' -> '12-09-2026'. Devuelve None si no se entiende."""
    if not texto:
        return None
    partes = sin_tildes(texto.lower().replace(".", "")).split()
    if len(partes) != 3:
        return None
    dia, mes, anyo = partes
    if mes not in MESES or not dia.isdigit() or not anyo.isdigit():
        return None
    return f"{int(dia):02d}-{MESES[mes]:02d}-{int(anyo):04d}"


def clave_orden(entrada):
    """De más nueva a más vieja. Las que no tengan fecha, al final."""
    fecha = entrada.get("date") or ""
    partes = fecha.split("-")
    if len(partes) != 3:
        return (0, 0, 0)
    dia, mes, anyo = (int(p) for p in partes)
    return (-anyo, -mes, -dia)



# Una entrada o un relato a medio escribir llevan data-borrador en su
# <article>. Mientras lo lleven no existen para el resto del sitio: ni
# listados, ni RSS, ni sitemap, ni archivo del año. Lo quita
# herramientas/1-publicar/publicar.py.
#
# Se busca en la propia etiqueta <article> y no en todo el archivo a
# secas: la plantilla explica en un comentario qué es data-borrador, y
# buscando por el texto pelado ese comentario contaba como marca y la
# entrada no se publicaba nunca.





def carpeta_de_coleccion(ruta):
    """Si el relato está en una subcarpeta de relatos/, esa carpeta es
    su colección ("writeober26"). Si está suelto, no hay colección."""
    relativa = ruta.relative_to(RELATOS).parts
    return relativa[0] if len(relativa) > 1 else ""


def leer_entrada(ruta, prefijo):
    """Saca del HTML lo que hace falta para el listado."""
    texto = ruta.read_text(encoding="utf-8")
    fallos = []

    titulo = buscar(rf'<h1 class="{prefijo}-post-title">(.*?)</h1>', texto)
    if titulo:
        titulo = limpiar_html(titulo)
    else:
        fallos.append(f'no encuentro <h1 class="{prefijo}-post-title">')

    cruda = buscar(rf'<p class="{prefijo}-post-date">(.*?)</p>', texto)
    fecha = leer_fecha(limpiar_html(cruda) if cruda else None)
    if not fecha:
        fallos.append(
            f'no entiendo la fecha de <p class="{prefijo}-post-date"> '
            f"(encontré: {cruda!r})"
        )

    return titulo, fecha, texto, fallos


# LOS MINUTOS, ESCRITOS EN LA PROPIA ENTRADA. Al lado de la fecha
# («04 oct 2026 · 4 min»). Antes los ponía scripts/componentes/lectura.js
# cuando llegaba el listado, y al llegar partía la cabecera en dos líneas
# y todo el texto daba un salto hacia abajo (auditoría de velocidad del
# 16-10-2026: era lo que más le bajaba la nota a las entradas). Escritos
# aquí ya están desde el primer pintado; lectura.js ve que están y no
# hace nada. El mismo número que el del listado, porque es el mismo.
RE_MINUTOS = re.compile(r'\s*<p class="lectura-minutos">.*?</p>', re.S)


def poner_minutos(ruta, prefijo, minutos, probar):
    """Escribe (o pone al día) el «N min» detrás de la fecha. Devuelve si
    ha cambiado algo."""
    texto, crlf = leer_texto(ruta)
    m = re.search(rf'(\n?([ \t]*)<p class="{prefijo}-post-date">.*?</p>)', texto, re.S)
    if not m or not minutos:
        return False
    sangria = m.group(2)
    nuevo_p = ('\n%s<p class="lectura-minutos">%d min<span class="visually-hidden">'
               ' de lectura</span></p>' % (sangria, minutos))
    resto = texto[m.end():]
    viejo = RE_MINUTOS.match(resto)
    if viejo:
        if viejo.group(0) == nuevo_p:
            return False
        resto = resto[viejo.end():]
    nuevo = texto[:m.end()] + nuevo_p + resto
    if not probar:
        escribir_texto(ruta, nuevo, crlf)
    return True


# LA VENTANA DE texto_a_voz.mp3. Vive en fragmentos/texto-a-voz.html, que
# es el único sitio donde está escrita, y este generador la copia en cada
# entrada y relato, arriba de la columna de la foto. Llega dormida
# (data-voz-esqueleto: invisible y sin poder pulsarse, ver lectura.css) y
# scripts/componentes/leer-en-voz.js la despierta si el navegador sabe
# leer en voz alta; si no, la quita. Antes la montaba el script al
# cargar y al aparecer empujaba la foto 270 px hacia abajo (auditoría de
# velocidad del 16-10-2026). Va en una sola línea, para encontrarla y
# cambiarla fácil la vez siguiente.
FRAGMENTO_VOZ = RAIZ / "fragmentos" / "texto-a-voz.html"


def hueco_de_voz():
    try:
        crudo = FRAGMENTO_VOZ.read_text(encoding="utf-8")
    except OSError:
        return ""
    return re.sub(r">\s+<", "><", crudo.strip())


RE_HUECO = re.compile(r'\s*<div class="voz-ventana" data-voz-esqueleto.*?</div></div></div>', re.S)


def poner_hueco_de_voz(ruta, prefijo, probar):
    texto, crlf = leer_texto(ruta)
    m = re.search(rf'(\n([ \t]*)<div class="{prefijo}-post-side">)', texto)
    if not m:
        return False
    sangria = m.group(2) + "    "
    resto = texto[m.end():]
    viejo = RE_HUECO.match(resto)
    hueco = hueco_de_voz()
    if not hueco:
        return False
    nuevo_hueco = "\n" + sangria + hueco
    if viejo:
        if viejo.group(0) == nuevo_hueco:
            return False
        resto = resto[viejo.end():]
    nuevo = texto[:m.end()] + nuevo_hueco + resto
    if not probar:
        escribir_texto(ruta, nuevo, crlf)
    return True


# LA FICHA DE CADA CAMPAÑA (campana.nfo), ESCRITA EN SU PÁGINA. Es el
# ÚNICO sitio donde se monta: scripts/paginas/notas-rol.js ya no la pinta,
# solo le da vida (cada personaje abre su ficha al pulsarlo). Antes la
# pintaba el script al cargar y al aparecer empujaba la lista de sesiones
# media pantalla hacia abajo (auditoría de velocidad del 16-10-2026).
# Manda el JSON de la campaña (datos/notas_rol/campana-*.json): si se
# cambia, al pasar esto otra vez se reescribe.
#
# LOS PERSONAJES VAN CON SU CARA: un token por cada uno, que es un botón
# (abre su ficha encima, no cambia de página: aria-haspopup). Lo que es
# cada uno (clase, nivel, quién lo lleva) no va escrito debajo del token
# —ocupaba tres líneas bajo un círculo de 140px—: va en el nombre del
# botón (lo lee el lector de pantalla) y en su title, y entero en la
# ventana que abre. data-pj lleva su nombre, que es como el script lo
# encuentra en el JSON; data-grande, el retrato grande por si la
# miniatura (token_mini, la hace tokens-pequenos.py) no carga.
CAMPANAS = RAIZ / "datos" / "notas_rol"
CAMPOS_FICHA = (("sistema", "sistema"), ("director", "dirige"), ("personajes", "personajes"),
                ("sinopsis", "de qué va"))
COLORES_PJ = ("verde", "azul", "rojo", "morado")


def _e(texto):
    import html
    return html.escape(str(texto), quote=True)


def _imagen_segura(url):
    url = str(url or "").strip()
    return url if re.match(r"^/(?!/)|^https?://", url, re.I) else ""


def ficha_de_campana(campana):
    filas = [(c, n) for c, n in CAMPOS_FICHA if c in campana]
    if not filas:
        return ""
    por_rellenar = '<span class="campana-dato-vacio">por rellenar</span>'
    trozos = []
    for clave, nombre in filas:
        if clave == "personajes":
            gente = [p for p in (campana.get("personajes") or [])
                     if isinstance(p, dict) and str(p.get("nombre") or "").strip()]
            if not gente:
                valor = por_rellenar
            else:
                items = []
                for p in gente:
                    nombre_pj = str(p["nombre"]).strip()
                    color = str(p.get("color") or "").strip().lower()
                    color = color if color in COLORES_PJ else ""
                    nivel = p.get("nivel")
                    try:
                        nivel = int(nivel) if nivel else 0
                    except (TypeError, ValueError):
                        nivel = 0
                    primera = " ".join(x for x in (str(p.get("clase") or "").strip(),
                                                   "nivel %d" % nivel if nivel else "") if x)
                    jugador = str(p.get("jugador") or "").strip()
                    extra = " · ".join(x for x in (primera, "lo lleva " + jugador if jugador else "") if x)
                    atributos = (' aria-label="%s" title="%s"' % (_e(nombre_pj + ". " + extra), _e(extra))
                                 if extra else "")
                    ruta = _imagen_segura(p.get("token_mini")) or _imagen_segura(p.get("token"))
                    grande = _imagen_segura(p.get("token"))
                    if ruta:
                        retrato = ('<img class="campana-personaje-img" src="%s"%s alt="" loading="lazy"'
                                   ' decoding="async">' % (_e(ruta), ' data-grande="%s"' % _e(grande)
                                                           if grande and grande != ruta else ""))
                    else:
                        retrato = ('<span class="campana-personaje-mono" aria-hidden="true">%s</span>'
                                   % _e((nombre_pj or "?")[0].upper()))
                    clase_color = " pj-" + color if color else ""
                    items.append(
                        '<li class="campana-personaje"><button type="button" class="campana-personaje-token%s"'
                        ' aria-haspopup="dialog" data-pj="%s"%s><span class="campana-personaje-marco">%s</span>'
                        '<strong class="campana-personaje-nombre%s">%s</strong></button></li>'
                        % (clase_color, _e(nombre_pj), atributos, retrato, clase_color, _e(nombre_pj)))
                valor = '<ul class="campana-personajes">%s</ul>' % "".join(items)
        else:
            texto = str(campana.get(clave) or "").strip()
            valor = _e(texto) if texto else por_rellenar
        trozos.append('<div class="campana-dato"><dt class="campana-dato-nombre">%s</dt>'
                      '<dd class="campana-dato-valor">%s</dd></div>' % (_e(nombre), valor))
    return '<dl class="campana-ficha-lista">%s</dl>' % "".join(trozos)


def poner_fichas_de_campana(probar):
    for archivo in sorted(CAMPANAS.glob("campana-*.json")):
        try:
            campana = json.loads(archivo.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        pagina = str(campana.get("pagina") or "").strip().lstrip("/")
        ruta = RAIZ / pagina if pagina else None
        if not ruta or not ruta.is_file():
            continue
        texto, crlf = leer_texto(ruta)
        dentro = ficha_de_campana(campana)
        nuevo = re.sub(r'(<div class="campana-ficha-cuerpo" data-campana-ficha-cuerpo>).*?(</div>\s*</div>)',
                       lambda m: m.group(1) + dentro + m.group(2), texto, count=1, flags=re.S)
        # Con algo dentro, se ve desde el principio; sin nada, escondida
        # (como la deja el script cuando el JSON no trae ningún campo).
        nuevo = re.sub(r'<div class="campana-ficha" data-campana-ficha( hidden)?>',
                       '<div class="campana-ficha" data-campana-ficha%s>' % ("" if dentro else " hidden"),
                       nuevo, count=1)
        if nuevo != texto and not probar:
            escribir_texto(ruta, nuevo, crlf)


# EL POST-IT DE CADA SESIÓN, SACADO DE LAS MISIONES DE LA CAMPAÑA. La
# lista de verdad es una sola, "misiones" en el JSON de la campaña (se
# lleva en el editor, en la ficha de la campaña); el post-it de «Cosas
# pendientes» de la sesión N enseña lo que estaba abierto en ella: lo que
# empezó en la N o antes (o no se sabe cuándo) y no se había cerrado
# antes. Lo que se cerró EN esa sesión sale tachado (completado) o
# tachado y con «fallida». Cada cosa lleva debajo, pequeño, quién la
# pidió y la recompensa prometida, si se saben.
#
#   { "que": "…", "de": 1, "hasta": 3, "estado": "completada" | "fallada",
#     "quien": "Sigil", "recompensa": "50 po", "obtenida": "40 po" }
#
# Sin estado es pendiente; "hecha": true (lo de antes) vale como
# completada. Una campaña SIN "misiones" no toca sus post-its (los de
# antes se escribían a mano). Los comentarios de la plantilla llevan un
# post-it de ejemplo: no cuentan.
RE_POSTIT_DE_SESION = re.compile(r'(<aside class="cuaderno-postit"[^>]*>.*?<ul class="cuaderno-tareas">)(.*?)(</ul>)',
                                 re.S)


def estado_de_mision(cosa):
    estado = str(cosa.get("estado") or "").strip().lower()
    if estado in ("completada", "fallada"):
        return estado
    return "completada" if cosa.get("hecha") else "pendiente"


def _numero_de_sesion(valor):
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None


def postit_de_sesion(campana, numero, sangria):
    lineas = []
    for apartado in campana.get("misiones") or []:
        if not isinstance(apartado, dict):
            continue
        for cosa in apartado.get("cosas") or []:
            if not isinstance(cosa, dict) or not str(cosa.get("que") or "").strip():
                continue
            de = _numero_de_sesion(cosa.get("de"))
            hasta = _numero_de_sesion(cosa.get("hasta"))
            estado = estado_de_mision(cosa)
            if de is not None and de > numero:
                continue
            # Cerrada sin saber cuándo: ya no se ve en ninguna sesión.
            if estado != "pendiente" and (hasta is None or hasta < numero):
                continue
            clases = []
            extra = []
            if estado != "pendiente" and hasta == numero:
                clases.append("hecho")
                if estado == "fallada":
                    clases.append("es-fallada")
                    extra.append("fallida")
            quien = str(cosa.get("quien") or "").strip()
            recompensa = str(cosa.get("recompensa") or "").strip()
            if quien:
                extra.append("lo pide " + quien)
            if recompensa and estado == "pendiente":
                extra.append("recompensa: " + recompensa)
            texto = _e(str(cosa["que"]).strip())
            if extra:
                texto += ' <span class="cuaderno-tarea-extra">%s</span>' % _e(" · ".join(extra))
            lineas.append(sangria + "    <li%s>%s</li>" % (' class="%s"' % " ".join(clases) if clases else "", texto))
    return lineas


def poner_postits_de_sesiones(probar):
    for archivo in sorted(CAMPANAS.glob("campana-*.json")):
        try:
            campana = json.loads(archivo.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if not isinstance(campana.get("misiones"), list):
            continue
        for sesion in campana.get("sesiones") or []:
            if not isinstance(sesion, dict):
                continue
            numero = _numero_de_sesion(sesion.get("numero"))
            ruta = RAIZ / str(sesion.get("url") or "").lstrip("/")
            if numero is None or not sesion.get("url") or not ruta.is_file():
                continue
            texto, crlf = leer_texto(ruta)
            tapado = re.sub(r"<!--.*?-->", lambda m: re.sub(r"[^\n]", " ", m.group(0)), texto, flags=re.S)
            m = RE_POSTIT_DE_SESION.search(tapado)
            if not m:
                continue
            inicio = texto.rfind("\n", 0, m.start(1) + m.group(1).rfind("<ul")) + 1
            sangria = texto[inicio:m.start(1) + m.group(1).rfind("<ul")]
            sangria = sangria[:len(sangria) - len(sangria.lstrip())]
            lineas = postit_de_sesion(campana, numero, sangria)
            dentro = "\n" + "\n".join(lineas) + ("\n" if lineas else "") + sangria
            nuevo = texto[:m.start(2)] + dentro + texto[m.end(2):]
            if nuevo != texto and not probar:
                escribir_texto(ruta, nuevo, crlf)


def recoger_blog():
    entradas, avisos = [], []
    for ruta in paginas(BLOG, "*.html"):
        titulo, fecha, texto, fallos = leer_entrada(ruta, "blog")
        if fallos:
            avisos.append((ruta, fallos))
            continue
        crudas = buscar(r'<article class="blog-post"[^>]*data-tags="([^"]*)"', texto) or ""
        entradas.append(
            {
                "title": titulo,
                "date": fecha,
                "url": url_de(ruta),
                "tags": partir_etiquetas(crudas),
                "minutos": minutos_de(cuerpo_de(texto, "blog")),
            }
        )
        poner_minutos(ruta, "blog", entradas[-1]["minutos"], PROBAR[0])
        poner_hueco_de_voz(ruta, "blog", PROBAR[0])
    entradas.sort(key=clave_orden)
    return entradas, avisos


# El portfolio de rol vive en datos/mis_movidas/rol.json, que es el archivo que se
# toca (a mano o con nuevo.py --rol) y del que la propia página saca sus
# tarjetas. Aquí solo se traduce al formato del listado: de cada ficha
# se queda el título, la categoría, la fecha y el enlace de Ko-fi, que
# es lo que necesitan la portada y el RSS.
# Antes las tarjetas estaban escritas dentro de index_rol.html y esto
# las leía de allí con expresiones regulares; se cambió porque esa
# página crecía ~2 KB por cosa publicada y había que editar HTML para
# añadir nada.
def recoger_rol():
    entradas, avisos = [], []
    if not JSON_ROL.is_file():
        return entradas, avisos

    try:
        fichas = json.loads(JSON_ROL.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        avisos.append((JSON_ROL, [f"no entiendo el JSON: {error}"]))
        return entradas, avisos
    if not isinstance(fichas, list):
        avisos.append((JSON_ROL, ["esperaba una lista de fichas entre [ ]"]))
        return entradas, avisos

    for ficha in fichas:
        if not isinstance(ficha, dict):
            avisos.append((JSON_ROL, ["hay algo en la lista que no es una ficha"]))
            continue
        titulo = (ficha.get("title") or "").strip()
        subcategoria = (ficha.get("subcategory") or "").strip()
        fecha = (ficha.get("date") or "").strip()
        enlace = (ficha.get("kofi") or "").strip()
        fallos = []
        if not titulo:
            fallos.append("la ficha no tiene título (title)")
        if not subcategoria:
            fallos.append("la ficha no dice de qué categoría es (subcategory)")
        if not fecha or len(fecha.split("-")) != 3:
            fallos.append(f"falta o no entiendo date, que va en dd-mm-aaaa (encontré: {fecha!r})")
        if not enlace:
            fallos.append("la ficha no tiene enlace de Ko-fi (kofi)")
        if fallos:
            nombre = titulo or "ficha sin título"
            avisos.append((JSON_ROL, [f"[{nombre}] {f}" for f in fallos]))
            continue
        entradas.append(
            {
                "title": titulo,
                "category": "rol",
                "subcategory": subcategoria,
                "date": fecha,
                "url": enlace,
            }
        )
    return entradas, avisos


# =========================================
# LAS NOTAS DE LAS PARTIDAS DE ROL
# =========================================
# Una sesión es una página como una entrada, con dos diferencias: su
# <article> se llama cuaderno-post y lleva data-campana diciendo de qué
# campaña es. De ahí sale su listado, que es lo que usa el índice de la
# campaña para saber qué sesiones están publicadas de verdad.


def cuerpo_de_notas(texto):
    """El texto de las hojas, para contar los minutos. Aquí no vale
    cuerpo_de(): las notas no tienen un .cuaderno-post-body, tienen
    varias hojas dentro de .cuaderno-post-body-wrap."""
    inicio = texto.find('<div class="cuaderno-post-body-wrap">')
    if inicio == -1:
        return ""
    fin = texto.find("</article>", inicio)
    return texto[inicio:fin if fin != -1 else len(texto)]


def recoger_notas_rol():
    entradas, avisos = [], []
    if not NOTAS_ROL.is_dir():
        return entradas, avisos

    for ruta in paginas(NOTAS_ROL, "*.html"):
        # La página de npcs de una campaña vive en la misma carpeta y no
        # es una sesión: no tiene título de notas ni fecha ni campaña
        # escrita dentro (todo eso lo pinta el navegador desde su JSON).
        # Sin esta línea salía en la lista de "se han quedado fuera" con
        # tres fallos, como si estuviera mal escrita.
        if ruta.name.startswith("npcs_"):
            continue
        titulo, fecha, texto, fallos = leer_entrada(ruta, "cuaderno")
        campana = (
            buscar(
                r'<article class="cuaderno-post"[^>]*data-campana="([^"]*)"', texto
            )
            or ""
        ).strip()
        if not campana:
            fallos = fallos + [
                'no dice de qué campaña es (falta data-campana en el <article>)'
            ]
        if fallos:
            avisos.append((ruta, fallos))
            continue
        entradas.append(
            {
                "title": titulo,
                "campana": campana,
                "date": fecha,
                "url": url_de(ruta),
                "minutos": minutos_de(cuerpo_de_notas(texto)),
            }
        )
    entradas.sort(key=clave_orden)
    return entradas, avisos


def recoger_movidas():
    entradas, avisos = [], []
    for ruta in paginas(RELATOS, "*.html"):
        titulo, fecha, texto, fallos = leer_entrada(ruta, "relato")
        if fallos:
            avisos.append((ruta, fallos))
            continue
        sub = (
            buscar(r'<article class="relato-post"[^>]*data-subcategoria="([^"]*)"', texto)
            or ""
        )
        entrada = {
            "title": titulo,
            "category": "relatos",
            "subcategory": sub,
            "date": fecha,
            "url": url_de(ruta),
            "minutos": minutos_de(cuerpo_de(texto, "relato")),
        }
        # Un relato dentro de una subcarpeta de relatos/ pertenece a una
        # colección: hoy, el reto de escritura diaria. Se apunta a cuál
        # para que el listado de relatos NO los liste de uno en uno —son
        # 31 y taparían todo lo demás durante un mes— y para que la
        # portada los resuma en una sola línea. En el RSS sí entran
        # sueltos: quien está suscrito quiere cada texto.
        coleccion = carpeta_de_coleccion(ruta)
        if coleccion:
            entrada["collection"] = coleccion
        entradas.append(entrada)
        poner_minutos(ruta, "relato", entrada["minutos"], PROBAR[0])
        poner_hueco_de_voz(ruta, "relato", PROBAR[0])

    rol, avisos_rol = recoger_rol()
    todas = rol + entradas
    todas.sort(key=clave_orden)
    return todas, avisos + avisos_rol, len(rol)


def comparar(destino, datos):
    """Qué cambia respecto a lo que había, para que no se pierda nada sin
    enterarse. La primera vez que se ejecuta esto es lo que saca a la luz
    las entradas que se habían quedado descolgadas."""
    if not destino.is_file():
        return []
    try:
        previo = json.loads(destino.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return ["  el JSON que había no se puede leer; se reescribe entero"]

    antes = {p.get("url"): p for p in previo}
    ahora = {p.get("url"): p for p in datos}
    lineas = []

    for url in antes.keys() - ahora.keys():
        lineas.append(f"  SE QUITA   {antes[url].get('title')}  ({url})")
    for url in ahora.keys() - antes.keys():
        lineas.append(f"  SE AÑADE   {ahora[url].get('title')}  ({url})")
    for url in antes.keys() & ahora.keys():
        for campo in ("title", "date", "subcategory"):
            viejo, nuevo = antes[url].get(campo), ahora[url].get(campo)
            if campo in antes[url] and viejo != nuevo:
                lineas.append(
                    f"  CAMBIA     {ahora[url].get('title')}: {campo} "
                    f"{viejo!r} -> {nuevo!r}"
                )
        if sorted(antes[url].get("tags", [])) != sorted(ahora[url].get("tags", [])):
            lineas.append(
                f"  CAMBIA     {ahora[url].get('title')}: etiquetas "
                f"{antes[url].get('tags')} -> {ahora[url].get('tags')}"
            )
    return sorted(lineas)


def escribir(destino, datos, probar):
    nuevo = json.dumps(datos, ensure_ascii=False, indent=4) + "\n"
    anterior = destino.read_text(encoding="utf-8") if destino.is_file() else ""
    if nuevo == anterior:
        print(f"  {destino.relative_to(RAIZ)} ya estaba al día")
        return False
    if not probar:
        escribir_json(destino, datos)
    print(f"  {destino.relative_to(RAIZ)} {'se reescribiría' if probar else 'reescrito'}")
    return True


# Si se está probando (--probar): poner_minutos no escribe nada.
PROBAR = [False]


def generar(probar=False):
    PROBAR[0] = probar
    if probar:
        print("  MODO PRUEBA: no se cambia ningún archivo.\n")

    blog, avisos_blog = recoger_blog()
    poner_fichas_de_campana(probar)
    poner_postits_de_sesiones(probar)
    movidas, avisos_movidas, cuantas_rol = recoger_movidas()
    notas, avisos_notas = recoger_notas_rol()

    print(f"  {len(blog)} entrada(s) de blog")
    for e in blog:
        etiquetas = ", ".join(e["tags"]) if e["tags"] else "sin etiquetas"
        print(f"     {e['date']}  {e['title'][:38]:38}  [{etiquetas}]")

    print(f"\n  {len(movidas)} en mis movidas ({cuantas_rol} del portfolio de rol)")
    for e in movidas:
        print(f"     {e['date']}  {e['title'][:38]:38}  [{e['category']}]")

    print(f"\n  {len(notas)} sesión(es) de rol apuntada(s)")
    for e in notas:
        print(f"     {e['date']}  {e['title'][:38]:38}  [{e['campana']}]")

    cambios = (
        comparar(JSON_BLOG, blog)
        + comparar(JSON_MOVIDAS, movidas)
        + comparar(JSON_NOTAS, notas)
    )
    if cambios:
        print("\n  Lo que cambia respecto a lo que había en los JSON:")
        for linea in cambios:
            print("   " + linea)
        print(
            "\n  Recuerda: manda la página. Si alguna de estas líneas te sorprende,\n"
            "  es que el JSON y el HTML decían cosas distintas — arregla la página\n"
            "  y vuelve a ejecutar esto."
        )

    print()
    escribir(JSON_BLOG, blog, probar)
    escribir(JSON_MOVIDAS, movidas, probar)
    escribir(JSON_NOTAS, notas, probar)

    avisos = avisos_blog + avisos_movidas + avisos_notas
    if avisos:
        print("\n  OJO, estas páginas se han quedado fuera del listado:")
        for ruta, fallos in avisos:
            print(f"     {ruta.relative_to(RAIZ)}")
            for f in fallos:
                print(f"        - {f}")
        print("\n  Suele ser que el título o la fecha no están donde se esperan.")
        print("  Compáralas con una entrada que sí funcione y vuelve a ejecutar.")

    if not probar and not avisos:
        print("\n  Listo. Acuérdate de pasar también:  python herramientas/3-generadores/generar-rss.py")

    return 1 if avisos else 0


if __name__ == "__main__":
    sys.exit(generar(probar="--probar" in sys.argv))
