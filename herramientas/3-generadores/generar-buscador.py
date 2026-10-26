#!/usr/bin/env python3
# =========================================
# ÍNDICE DE BÚSQUEDA — datos/sitio/buscador.json
# =========================================
# Escribe el listado que usa web/buscar/buscar.html: todas las páginas de
# la web con su título, su sección, su fecha, sus categorías y —esto es
# lo nuevo— EL TEXTO DE DENTRO de las entradas del blog y de los relatos.
#
# Con eso se puede buscar "panadería" y que salga la entrada donde lo
# cuentas, aunque no lo pongas en el título ni sea una categoría.
#
# NO CONFUNDIR CON LOS OTROS DOS LISTADOS:
#   - datos/sitio/mapa-del-sitio.json es la tabla de web/mapa/mapa.html: qué
#     páginas hay y desde cuándo. Sin texto.
#   - sitemap.xml es para los buscadores de fuera.
#   - éste es para buscar DENTRO de la web, y es el único que lleva el
#     texto completo.
#
# POR QUÉ UN ARCHIVO APARTE Y NO AMPLIAR EL DEL MAPA
# --------------------------------------------------
# Por el peso. El mapa son 6 KB y lo pide cualquiera que entre en
# /web/mapa/. Esto, con los relatos dentro, pasa de los 100 KB y subiendo
# —cada relato son entre 5 y 15 KB de texto—. Si fuera el mismo archivo,
# todo el que abriera el mapa se bajaría los relatos enteros para ver una
# tabla de títulos.
#
# Separados, este solo lo pide quien busca algo, que es justo quien
# necesita que esté. La página de la búsqueda es la ÚNICA que lo carga:
# ni la portada ni el menú lo tocan, solo mandan a esa página con la
# palabra en la dirección.
#
# DE DÓNDE SALE EL TEXTO
# ----------------------
# Del <main> de cada página, quitando lo que no es contenido: el menú, la
# cabecera con los atajos, la ventanita de "sigue leyendo", el buscador,
# los filtros, los avisos de "cargando" y los <script>. Si no se quitara,
# buscar "volver al archivo" sacaría las 30 entradas del blog a la vez.
#
# Los listados que se pintan solos con JavaScript (el portfolio de rol,
# las recomendaciones) no tienen su texto en el HTML: ése se saca de sus
# propios JSON, que es de donde lo saca también la página.
#
# CUÁNDO HAY QUE EJECUTARLO
# -------------------------
# Siempre antes de subir, si has escrito o cambiado algo. Va en la lista
# GENERADORES de herramientas/comun.py, así que nuevo.py y publicar.py ya
# lo pasan ellos solos y no hay que acordarse.
#
#     python3 herramientas/3-generadores/generar-buscador.py
#     python3 herramientas/3-generadores/generar-buscador.py --probar
#
# NOTA: esta carpeta "herramientas" es solo para ti — no hace falta
# subirla a Neocities.

import sys
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import re
from html.parser import HTMLParser

from comun import RAIZ, es_borrador, escribir_json, leer_json, limpiar_html

SALIDA = RAIZ / "datos" / "sitio" / "buscador.json"

EXCLUIDOS = {"not_found.html"}
CARPETAS_EXCLUIDAS = {"herramientas", "fragmentos"}

# Las páginas que son solo un listado de otras cosas: salen en la
# búsqueda (alguien puede buscar "mapa"), pero sin texto, porque su texto
# son los títulos de las demás y saldría todo duplicado.
SOLO_TITULO = {
    # La propia página de buscar: su texto es la ayuda del formulario
    # ("mira el título, la sección, las categorías…"), así que indexarla
    # haría que buscar "categoría" o "relatos" sacara la página de buscar
    # entre los resultados de buscar. Se queda por el título, para quien
    # busque "buscar".
    "/web/buscar/buscar.html",
    "/web/mapa/mapa.html",
    "/web/changelog/changelog.html",
    "/web/blog/diario.html",
}

# Lo que hay dentro del <main> pero NO es el contenido de la página: se
# salta entero, con todo lo que lleve dentro. Si no se quitara, buscar
# "volver al archivo" o "sigue leyendo" sacaría las 30 entradas del blog
# a la vez, que es lo contrario de buscar.
#
# Se mira por clase o por atributo, no por el texto: el texto cambia y
# esto no se acordaría de venir a actualizarlo.
SALTAR_CLASES = {
    # Los atajos de la cabecera de una entrada y su fecha: el título se
    # guarda aparte, y la fecha también.
    "blog-post-header",
    "relato-post-header",
    # La ventanita de "sigue leyendo" del final.
    "blog-post-otras",
    # El buscador y los filtros de los listados.
    "buscar",
    "filtros",
    # Los avisos de "Cargando…" de lo que se pinta con JavaScript.
    "entries-loading",
    "entries-empty",
    "entries-error",
    "guestbook-entries-loading",
    "guestbook-entries-empty",
    "guestbook-entries-error",
    "galeria-vacia",
    # Las barras de título de las ventanitas falsas (−■✕ y el nombre
    # del archivo): son decorado, no contenido.
    "recent-entries-header",
    "gatin-random-header",
    "pet-window-header",
    # Volver al inicio, volver a relatos...
    "volver-inicio",
    "blog-post-back",
    "relato-post-back",
    "reto-volver",
    "pet-back",
    # Las notas de una partida: la cabecera (título y fecha, que se
    # guardan aparte) y la cabecerita que cada hoja del cuaderno repite
    # con la sesión y la fecha. Si no se quitara, buscar "sesión" sacaría
    # todas las partidas por su decorado.
    "cuaderno-post-header",
    "cuaderno-post-back",
    "cuaderno-hoja-cabecera",
    "campana-volver",
    # El nombre de la campaña y su intro: están escritos en el HTML como
    # respaldo para quien entre sin JavaScript, pero el bueno es el del
    # JSON (ver extras_de_campanas) y, contándolos los dos, el texto de la
    # página salía duplicado.
    "campana-nombre",
    "campana-intro",
}
SALTAR_ATRIBUTOS = {"data-otras-caja", "data-otras-entradas"}
SALTAR_ETIQUETAS = {"script", "style", "svg", "noscript", "template"}


class SacaElTexto(HTMLParser):
    """Saca el texto de un trozo de HTML saltándose los cachos que no son
    contenido.

    Se hace con el analizador de la biblioteca estándar y no a base de
    expresiones regulares, y por un motivo concreto: una expresión
    regular no sabe contar etiquetas. Al quitar un <div> con otros
    <div> dentro, se paraba en el PRIMER cierre y dejaba suelto el
    resto; así se colaba el "Cargando…" de la ventanita de "sigue
    leyendo" en el texto de todas las entradas. Contando apertura y
    cierre no puede pasar.
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.trozos = []
        # A cuántos niveles de profundidad estamos dentro de algo que
        # hay que saltarse. 0 = estamos en terreno bueno.
        self.saltando = 0
        self.etiqueta_saltada = None
        self.profundidad = 0

    def handle_starttag(self, etiqueta, atributos):
        if etiqueta in VACIAS:
            return
        if self.saltando:
            if etiqueta == self.etiqueta_saltada:
                self.profundidad += 1
            return
        if self.hay_que_saltar(etiqueta, atributos):
            self.saltando = 1
            self.etiqueta_saltada = etiqueta
            self.profundidad = 1

    def handle_endtag(self, etiqueta):
        if not self.saltando:
            return
        if etiqueta == self.etiqueta_saltada:
            self.profundidad -= 1
            if self.profundidad <= 0:
                self.saltando = 0
                self.etiqueta_saltada = None

    def handle_data(self, datos):
        if not self.saltando:
            self.trozos.append(datos)

    @staticmethod
    def hay_que_saltar(etiqueta, atributos):
        if etiqueta in SALTAR_ETIQUETAS:
            return True
        for nombre, valor in atributos:
            if nombre in SALTAR_ATRIBUTOS:
                return True
            if nombre == "class" and valor:
                if set(valor.split()) & SALTAR_CLASES:
                    return True
            # Lo que está escondido a la vista tampoco es texto que
            # alguien esté leyendo.
            if nombre == "hidden":
                return True
        return False


# Etiquetas que no se cierran: si se contaran, el contador no bajaría
# nunca y a partir de ahí se saltaría la página entera.
VACIAS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}

RE_MAIN = re.compile(r"<main\b[^>]*>(.*?)</main>", re.S | re.I)
RE_TITULO = re.compile(r"<title>(.*?)</title>", re.S)
RE_H1 = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
RE_ETIQUETA = re.compile(r"<[^>]+>")
RE_ESPACIOS = re.compile(r"\s+")

LISTADOS = (
    RAIZ / "datos" / "blog" / "entradas-blog.json",
    RAIZ / "datos" / "mis_movidas" / "mis-movidas.json",
    RAIZ / "datos" / "notas_rol" / "notas-rol.json",
)


def seccion_de(url):
    """De qué parte de la web es. Las mismas que usa el mapa del sitio,
    para que las dos páginas hablen igual."""
    if url in ("/", "/index.html"):
        return "portada"
    if url.startswith("/web/blog/"):
        return "blog"
    if url.startswith("/web/mis_movidas/relatos/"):
        return "relatos"
    if url.startswith("/web/mis_movidas/rol/"):
        return "rol"
    if url.startswith("/web/notas_rol/"):
        return "notas de rol"
    # Mis personajes: aparte de las campañas y de la wiki.
    if url.startswith("/web/personajes/"):
        return "mis personajes"
    if url.startswith("/web/santuarios/"):
        return "santuarios"
    if url.startswith("/web/recomendaciones/"):
        return "recomendaciones"
    if url.startswith("/web/wiki/"):
        return "wiki cralëa"
    return "otras"


def titulo_de(texto, url):
    crudo = RE_TITULO.search(texto)
    if crudo:
        limpio = limpiar_html(crudo.group(1))
        # "Blog 2026 · El Blog de Richi" -> "Blog 2026"
        return limpio.split("·")[0].strip() or limpio
    uno = RE_H1.search(texto)
    if uno:
        return limpiar_html(uno.group(1))
    return Path(url).stem


def texto_de(pagina):
    """El texto de dentro del <main>, limpio y en una sola línea."""
    dentro = RE_MAIN.search(pagina)
    if not dentro:
        return ""
    saca = SacaElTexto()
    saca.feed(dentro.group(1))
    # Las etiquetas se cambian por un espacio y no por nada: si no,
    # "<p>uno</p><p>dos</p>" se quedaba en "unodos" y buscar "dos" no
    # encontraba nada.
    return RE_ESPACIOS.sub(" ", " ".join(saca.trozos)).strip()


def datos_de_los_listados():
    """url -> {fecha, categorías, minutos} de los listados que ya hay."""
    fichas = {}
    for archivo in LISTADOS:
        for entrada in leer_json(archivo, []) or []:
            url = (entrada.get("url") or "").strip()
            if not url.startswith("/"):
                continue
            categorias = []
            for clave in ("tags", "category", "subcategory", "collection", "campana"):
                valor = entrada.get(clave)
                if isinstance(valor, list):
                    categorias += [str(v).strip() for v in valor if str(v).strip()]
                elif isinstance(valor, str) and valor.strip():
                    categorias.append(valor.strip())
            fichas[url] = {
                "fecha": (entrada.get("date") or "").strip(),
                "categorias": sorted(set(categorias)),
                "minutos": entrada.get("minutos") or 0,
            }
    return fichas


def fichas_de_rol():
    """Las tarjetas del portfolio de rol. No son páginas de la web: cada
    una lleva a Ko-fi o a Drive, así que se apuntan con su enlace de
    fuera y la página de la búsqueda las marca como tales."""
    salida = []
    for ficha in leer_json(RAIZ / "datos" / "mis_movidas" / "rol.json", []) or []:
        titulo = (ficha.get("title") or "").strip()
        if not titulo:
            continue
        categorias = [
            c
            for c in (ficha.get("subcategory"), ficha.get("system"))
            if isinstance(c, str) and c.strip()
        ]
        salida.append(
            {
                "url": "/web/mis_movidas/rol/index_rol.html",
                "titulo": titulo,
                "seccion": "rol",
                "fecha": (ficha.get("date") or "").strip(),
                "categorias": sorted(set(c.strip() for c in categorias)),
                "texto": (ficha.get("description") or "").strip(),
            }
        )
    return salida


# La ficha de cada campaña de rol. Su página se pinta sola con JavaScript
# (el sistema, quién dirige, los personajes, la sinopsis), así que ese
# texto no está en el HTML y buscando "ragna" o el nombre de un personaje
# no saldría nada.
#
# Esto NO devuelve fichas sueltas como el portfolio de rol: la página ya
# está en el listado —es un .html como cualquier otra— y meterla otra vez
# la sacaría dos veces en los resultados. Devuelve el texto y la categoría
# que hay que SUMARLE a la que ya está, por su dirección.
def extras_de_campanas():
    extras = {}
    for archivo in sorted((RAIZ / "datos" / "notas_rol").glob("campana-*.json")):
        campana = leer_json(archivo, {}) or {}
        if not isinstance(campana, dict):
            continue
        pagina = (campana.get("pagina") or "").strip()
        if not pagina:
            continue
        personajes = [
            (p.get("nombre") or "").strip()
            for p in (campana.get("personajes") or [])
            if isinstance(p, dict)
        ]
        trozos = [
            campana.get("nombre"),
            campana.get("intro"),
            campana.get("sistema"),
            campana.get("director"),
            campana.get("sinopsis"),
        ]
        # Y el botín: "los kits curativos" se busca igual que se busca un
        # personaje, y la única página donde están escritos es ésta.
        trozos += [
            (c.get("que") or "")
            for c in (campana.get("botin") or [])
            if isinstance(c, dict)
        ]
        clave = (campana.get("clave") or "").strip()
        extras[pagina] = {
            "categorias": [clave] if clave else [],
            "texto": " ".join(
                t.strip()
                for t in trozos + personajes
                if isinstance(t, str) and t.strip()
            ),
        }

        # Y lo mismo con la página de npcs de esa campaña, que es otra
        # página vacía en el HTML: los nombres, lo que es cada uno y lo
        # que se sabe de ellos viven en datos/notas_rol/npcs-<clave>.json y
        # los pinta el navegador. Sin esto, buscar "Terkus" o "tabernera"
        # no encontraba nada.
        quien = (campana.get("npcs") or "").strip()
        reparto = leer_json(RAIZ / "datos" / "notas_rol" / ("npcs-%s.json" % clave), {}) if clave else {}
        if quien and isinstance(reparto, dict):
            palabras = []
            # Los personajes de los jugadores salen ahí arriba, en «la
            # mesa», y no viven en el archivo del reparto sino en el de la
            # campaña, así que se suman aparte. Si no, buscar "Faëlar"
            # llevaba al índice de la campaña y no a su ficha.
            for suyo in campana.get("personajes") or []:
                if not isinstance(suyo, dict):
                    continue
                palabras += [suyo.get("nombre"), suyo.get("clase"), suyo.get("jugador")]
                palabras += [
                    t
                    for t in (suyo.get("equipo") or []) + (suyo.get("notas") or [])
                    if isinstance(t, str)
                ]
            for quienquiera in reparto.get("personajes") or []:
                if not isinstance(quienquiera, dict):
                    continue
                palabras += [
                    quienquiera.get("nombre"),
                    quienquiera.get("categoria"),
                    quienquiera.get("que"),
                    quienquiera.get("donde"),
                ]
                palabras += [
                    n for n in (quienquiera.get("notas") or []) if isinstance(n, str)
                ]
            extras[quien] = {
                "categorias": [clave] if clave else [],
                "texto": " ".join(
                    t.strip() for t in palabras if isinstance(t, str) and t.strip()
                ),
            }
    return extras


def fichas_de_recomendaciones():
    """Lo que hay en las recomendaciones. El JSON va por bloques (libros,
    series...) y cada bloque tiene sus cosas dentro."""
    salida = []
    for bloque in leer_json(RAIZ / "datos" / "mi_rincon" / "recomendaciones.json", []) or []:
        categoria = (bloque.get("clave") or "").strip()
        for cosa in bloque.get("cosas") or []:
            titulo = (cosa.get("titulo") or "").strip()
            if not titulo:
                continue
            trozos = [cosa.get("texto"), cosa.get("autor")]
            salida.append(
                {
                    "url": "/web/recomendaciones/recomendaciones.html",
                    "titulo": titulo,
                    "seccion": "recomendaciones",
                    "fecha": str(cosa.get("anyo") or "").strip(),
                    "categorias": [categoria] if categoria else [],
                    "texto": " ".join(t.strip() for t in trozos if isinstance(t, str)),
                }
            )
    return salida


# Lo que pone la página de "en lo que ando". Igual que las campañas: la
# página está vacía en el HTML y lo que se ve lo pinta el navegador con
# datos/mi_rincon/en-lo-que-ando.json, así que buscando lo que estoy leyendo no
# saldría nada. No devuelve una ficha suelta —la página ya está en el
# listado— sino el texto que hay que SUMARLE.
#
# Lo de la campaña de rol no se suma: eso ya está en la página de la
# campaña, que sale en su propia ficha, y repetirlo haría que buscar
# "Ragna" sacara esta página antes que las notas.
def extras_de_en_lo_que_ando():
    datos = leer_json(RAIZ / "datos" / "mi_rincon" / "en-lo-que-ando.json", {}) or {}
    if not isinstance(datos, dict):
        return {}
    palabras = [datos.get("intro")]
    for cosa in datos.get("ahora") or []:
        if isinstance(cosa, dict):
            palabras += [cosa.get("que"), cosa.get("titulo"), cosa.get("de"),
                         cosa.get("nota")]
    for cosa in datos.get("escribiendo") or []:
        if isinstance(cosa, dict):
            palabras += [cosa.get("titulo"), cosa.get("tipo"),
                         cosa.get("estado"), cosa.get("nota")]
    for cosa in datos.get("pendientes") or []:
        if isinstance(cosa, dict):
            palabras.append(cosa.get("cosa"))
    texto = " ".join(p.strip() for p in palabras if isinstance(p, str) and p.strip())
    if not texto:
        return {}
    return {"/web/en_lo_que_ando/en_lo_que_ando.html": {
        "categorias": [], "texto": texto}}


def generar(probar=False):
    listados = datos_de_los_listados()
    campanas = extras_de_campanas()
    campanas.update(extras_de_en_lo_que_ando())
    fichas = []

    for archivo in sorted(RAIZ.rglob("*.html")):
        relativo = archivo.relative_to(RAIZ)
        if set(relativo.parts) & CARPETAS_EXCLUIDAS:
            continue
        if relativo.name in EXCLUIDOS or es_borrador(archivo):
            continue

        url = "/" + relativo.as_posix()
        pagina = archivo.read_text(encoding="utf-8", errors="replace")
        extra = listados.get(url, {})
        ficha = {
            "url": url,
            "titulo": titulo_de(pagina, url),
            "seccion": seccion_de(url),
            "fecha": extra.get("fecha", ""),
            "categorias": extra.get("categorias", []),
            "texto": "" if url in SOLO_TITULO else texto_de(pagina),
        }
        # El índice de una campaña de rol y su página de npcs: se les
        # suma lo que su JSON pinta dentro y que en el HTML no está
        # escrito (ver extras_de_campanas).
        campana = campanas.get(url)
        if campana:
            ficha["categorias"] = sorted(
                set(ficha["categorias"]) | set(campana["categorias"])
            )
            ficha["texto"] = " ".join(
                t for t in (ficha["texto"], campana["texto"]) if t
            )
        fichas.append(ficha)

    fichas += fichas_de_rol()
    fichas += fichas_de_recomendaciones()

    # Las que tienen fecha primero y de lo más nuevo a lo más viejo; las
    # que no (sobre mí, contacto...), detrás y por título. Así, buscando
    # algo que sale en varias, lo de arriba es lo último que escribiste.
    def orden(f):
        partes = (f["fecha"] or "").split("-")
        if len(partes) == 3:
            dia, mes, anyo = partes
            return (0, f"-{anyo}{mes}{dia}", "")
        return (1, "", f["titulo"].lower())

    fichas.sort(key=orden)

    letras = sum(len(f["texto"]) for f in fichas)
    print(f"  {len(fichas)} ficha(s), {letras // 1024} KB de texto.")
    con_texto = [f for f in fichas if f["texto"]]
    print(f"  Con texto dentro: {len(con_texto)}.")

    if probar:
        print("  (--probar: no se ha escrito nada)")
        for f in fichas[:5]:
            print(f"    {f['seccion']:15s} {f['titulo'][:40]:42s} {len(f['texto'])} letras")
        return

    escribir_json(SALIDA, fichas)
    print(f"  Escrito {SALIDA.relative_to(RAIZ)}.")


if __name__ == "__main__":
    generar("--probar" in sys.argv)
