#!/usr/bin/env python3
# =========================================
# ÍNDICE DE BÚSQUEDA — datos/buscador.json
# =========================================
# Escribe el listado que usa web/buscar/buscar.html: todas las páginas de
# la web con su título, su sección, su fecha, sus categorías y —esto es
# lo nuevo— EL TEXTO DE DENTRO de las entradas del blog y de los relatos.
#
# Con eso se puede buscar "panadería" y que salga la entrada donde lo
# cuentas, aunque no lo pongas en el título ni sea una categoría.
#
# NO CONFUNDIR CON LOS OTROS DOS LISTADOS:
#   - datos/mapa-del-sitio.json es la tabla de web/mapa/mapa.html: qué
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
#     python3 herramientas/generar-buscador.py
#     python3 herramientas/generar-buscador.py --probar
#
# NOTA: esta carpeta "herramientas" es solo para ti — no hace falta
# subirla a Neocities.

import re
import sys
from html.parser import HTMLParser
from pathlib import Path

from comun import RAIZ, es_borrador, escribir_json, leer_json, limpiar_html

SALIDA = RAIZ / "datos" / "buscador.json"

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
    RAIZ / "datos" / "entradas-blog.json",
    RAIZ / "datos" / "mis-movidas.json",
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
    if url.startswith("/web/santuarios/"):
        return "santuarios"
    if url.startswith("/web/recomendaciones/"):
        return "recomendaciones"
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
            for clave in ("tags", "category", "subcategory", "collection"):
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
    for ficha in leer_json(RAIZ / "datos" / "rol.json", []) or []:
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


def fichas_de_recomendaciones():
    """Lo que hay en las recomendaciones. El JSON va por bloques (libros,
    series...) y cada bloque tiene sus cosas dentro."""
    salida = []
    for bloque in leer_json(RAIZ / "datos" / "recomendaciones.json", []) or []:
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


def generar(probar=False):
    listados = datos_de_los_listados()
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
        fichas.append(
            {
                "url": url,
                "titulo": titulo_de(pagina, url),
                "seccion": seccion_de(url),
                "fecha": extra.get("fecha", ""),
                "categorias": extra.get("categorias", []),
                "texto": "" if url in SOLO_TITULO else texto_de(pagina),
            }
        )

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
