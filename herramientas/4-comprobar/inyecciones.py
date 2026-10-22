#!/usr/bin/env python3
"""Busca los sitios por donde se podría colar código en la web.

QUÉ ES ESTO
-----------
Media web se pinta en el navegador: las entradas, el mapa, el buscador,
el reparto de una campaña, los mensajes del guestbook... Todo eso sale de
un JSON o de lo que alguien escriba, y acaba metido en la página. Si ese
texto se mete como HTML sin más, quien controle el texto controla la
página: puede meter un <script>, un <img onerror=...> o un enlace que
empiece por "javascript:" y que ejecute código al pulsarlo.

En esta web eso se evita de dos formas, y las dos están escritas a mano
en cada script:

  1. ESCAPANDO el texto antes de pegarlo (escapeHtml, escapar,
     escaparHtmlNotas...), o montando los nodos con createElement y
     textContent, que no tiene este problema.
  2. COMPROBANDO las direcciones antes de ponerlas en un href o un src
     (urlSegura, rutaSegura*...): si no empieza por "/" o por "http",
     no se pone.

Como son costumbres y no una regla que obligue el lenguaje, es fácil
olvidarse una vez. Pasó: el botón de "volver a la campaña" del quién es
quién se tragaba un "javascript:" del JSON, y era el único href de esa
página sin comprobar.

Esto repasa los .js y canta tres cosas:

  1. Un innerHTML (o insertAdjacentHTML) al que se le pega algo
     calculado sin pasarlo por una función de escapar.
  2. Un href, un src o un action que se rellena con algo que no viene de
     una función de las de comprobar direcciones.
  3. Un eval(), un new Function() o un setTimeout("texto"), que son
     formas de ejecutar texto como si fuera código.

Y en las páginas, una cuarta:

  4. Un <script> escrito dentro de la página cuya huella no está en la
     lista de permitidos de esa página (el <meta> Content-Security-Policy
     que escribe actualizar-cabeceras.py). El navegador lo bloquearía.

NO CAMBIA NADA: solo mira y te lo cuenta. Y es un repaso de bulto, no un
analizador de JavaScript: puede cantar algo que esté bien (un href que
siempre vale, por ejemplo). Lo que no debería es callarse algo que esté
mal, que es para lo que está.

CÓMO USARLO
-----------
    python herramientas/4-comprobar/inyecciones.py

Lo pasa también «Repasar el sitio entero», en el menú (Repasar y subir).
"""

import re
import sys
from pathlib import Path

# Dos pisos hacia arriba: este archivo vive en herramientas/4-comprobar/.
# (Éste no usa comun.py: se vale solo.)
RAIZ = Path(__file__).resolve().parents[2]
SCRIPTS = RAIZ / "scripts"

# Los paquetes son una copia pegada de los demás (los escribe
# herramientas/3-generadores/actualizar-cabeceras.py), así que cantarían
# los mismos avisos dos veces.
def es_paquete(js):
    return js.name.startswith("paquete-")


# Las funciones que dejan un texto en condiciones de pegarse como HTML.
# Si el trozo pasa por una de éstas, está escapado y no hay nada que
# decir. Se buscan por el nombre porque es como están escritas en toda la
# web: cada script lleva la suya con su propio apellido para que no se
# pisen (ver herramientas/4-comprobar/nombres-repetidos.py).
ESCAPAR = re.compile(r"\b(?:escap\w*|encodeURI\w*|sanear\w*)\s*\(", re.I)

# Las funciones que comprueban una dirección antes de ponerla.
SEGURAS = re.compile(r"\b(?:\w*[Ss]egura\w*|encodeURI\w*)\s*\(", re.I)

# Lo que no se escribe nunca: ejecutar texto como código.
PELIGROS = re.compile(r"\beval\s*\(|\bnew\s+Function\s*\(|\bdocument\.write\s*\(")

# setTimeout("texto", 100) ejecuta ese texto como código; con una función
# delante no. Solo se canta la forma con comillas.
RELOJ_CON_TEXTO = re.compile(r"\b(?:setTimeout|setInterval)\s*\(\s*[\"'`]")

# Asignaciones a innerHTML/outerHTML y el insertAdjacentHTML.
RE_HTML = re.compile(
    r"""(\.(?:inner|outer)HTML\s*=|\.insertAdjacentHTML\s*\()([^\n;]*)"""
)

# href / src / action que se rellenan con algo.
RE_DIRECCION = re.compile(
    r"""\.(?:href|src|action)\s*=\s*([^\n;]*)"""
    r"""|setAttribute\(\s*["'](?:href|src|action)["']\s*,([^\n)]*)\)"""
)

# Lo que no es "algo calculado": una cadena escrita a mano, una cadena
# vacía, un número. Si lo que se pega es literalmente eso, no hay nada
# que comprobar.
RE_LITERAL = re.compile(r"""^\s*(?:["'][^"'`]*["']|``|\d+|true|false|null)\s*$""")


def sin_comentarios(texto):
    """Los // y los /* */ fuera, para no cantar lo que está explicado en
    un comentario. Las cadenas se dejan: ahí sí hay código de verdad."""
    texto = re.sub(r"/\*.*?\*/", "", texto, flags=re.S)
    return re.sub(r"(^|\s)//[^\n]*", r"\1", texto)


def linea_de(texto, posicion):
    return texto.count("\n", 0, posicion) + 1


# Dónde empieza cada función del archivo, para poder mirar "lo que hay
# alrededor" de una línea y, sobre todo, para poder seguirle la pista a
# una función por su nombre.
RE_FUNCION = re.compile(r"^function\s+([A-Za-z_$][\w$]*)\s*\(", re.M)


def funciones_de(texto):
    """{nombre: cuerpo} de las funciones de primer nivel del archivo."""
    marcas = [(m.group(1), m.start()) for m in RE_FUNCION.finditer(texto)]
    cuerpos = {}
    for i, (nombre, desde) in enumerate(marcas):
        hasta = marcas[i + 1][1] if i + 1 < len(marcas) else len(texto)
        cuerpos[nombre] = texto[desde:hasta]
    return cuerpos


def envoltorio(texto, posicion):
    """El cuerpo de la función dentro de la que cae esa posición."""
    ultimo = None
    for m in RE_FUNCION.finditer(texto):
        if m.start() > posicion:
            break
        ultimo = m
    if ultimo is None:
        return texto
    return texto[ultimo.start():]


# Los nombres que se citan en un trozo de código: para poder ir a ver qué
# hace la función que monta el HTML en vez de quedarse en el ".map(...)".
RE_NOMBRE = re.compile(r"\b([A-Za-z_$][\w$]*)\s*(?=[(.,)\]]|$)")


def escapa_de_verdad(trozo, cuerpos, vistos=None):
    """¿Ese trozo acaba pasando por una función de escapar? Se mira él y,
    si lo que hace es llamar a otra función del mismo archivo (el típico
    lista.map(filaDeLoQueSea)), se mira esa también. Un nivel o dos, que
    es como está escrito todo aquí."""
    if ESCAPAR.search(trozo):
        return True
    vistos = vistos or set()
    for nombre in RE_NOMBRE.findall(trozo):
        if nombre in vistos or nombre not in cuerpos:
            continue
        vistos.add(nombre)
        if len(vistos) > 12:
            return False
        if escapa_de_verdad(cuerpos[nombre], cuerpos, vistos):
            return True
    return False


# Una constante en mayúsculas (SUBIR_ICONO, WINDOW_CONTROLS_MARKUP) es
# HTML escrito a mano en el propio archivo: no viene de fuera.
_PIEZA = r"""(?:[A-Z][A-Z0-9_]*|"[^"`]*"|'[^'`]*'|`[^`$]*`)"""
RE_SOLO_CONSTANTES = re.compile(
    r"""^\s*%s(?:\s*\+\s*%s)*\s*$""" % (_PIEZA, _PIEZA)
)


# LO QUE YA SE HA MIRADO Y ESTÁ BIEN.
#
# Un repaso de bulto no puede saberlo todo, y tres o cuatro sitios de la
# web montan HTML a mano con texto escrito aquí dentro, que no viene de
# ninguna parte. Cantarlos cada vez acabaría con que nadie lea lo que
# esto dice, que es la peor forma de que una comprobación no sirva.
#
# Así que se apuntan aquí, con el porqué, y se callan. La clave lleva el
# TROZO de código, no el número de línea: si ese trozo cambia, el aviso
# vuelve a salir y hay que volver a mirarlo. Mover la línea de sitio no
# lo despierta; tocar lo que hace, sí.
REVISADOS = {
    ("scripts/componentes/gatin-random.js", "gatinAHtml()"):
        "el HTML está escrito entero ahí dentro; la foto se pone después"
        " con img.src y pasando por encodeURIComponent.",
    ("scripts/componentes/leer-en-voz.js", "avisoDeVozHTML()"):
        "los cuatro pasos (Windows, Mac, Android, Linux) están escritos en"
        " el propio archivo: no viene nada de fuera.",
    ("scripts/tema.js", "`${base}.webp`"):
        "base es una de dos rutas escritas a mano, según el tema sea claro"
        " u oscuro.",
    ("scripts/tema.js",
     "`${base}-412.webp 412w, ${base}-620.webp 620w, ${base}.webp 1161w`"):
        "lo mismo: las tres direcciones salen de esas dos rutas.",
}


def mirar(js):
    texto = sin_comentarios(js.read_text(encoding="utf-8"))
    nombre = js.relative_to(RAIZ).as_posix()
    cuerpos = funciones_de(texto)
    avisos = []

    for m in PELIGROS.finditer(texto):
        avisos.append((linea_de(texto, m.start()), "ejecuta texto como código",
                       m.group(0).strip()))
    for m in RELOJ_CON_TEXTO.finditer(texto):
        avisos.append((linea_de(texto, m.start()),
                       "un reloj con texto en vez de una función",
                       m.group(0).strip()))

    for m in RE_HTML.finditer(texto):
        trozo = m.group(2)
        if RE_LITERAL.match(trozo) or RE_SOLO_CONSTANTES.match(trozo):
            continue
        if "+" not in trozo and "${" not in trozo and "(" not in trozo:
            continue
        if escapa_de_verdad(trozo, cuerpos):
            continue
        if (nombre, trozo.strip()) in REVISADOS:
            continue
        avisos.append((linea_de(texto, m.start()),
                       "HTML pegado sin pasar por una función de escapar",
                       trozo.strip()[:70]))

    for m in RE_DIRECCION.finditer(texto):
        trozo = (m.group(1) or m.group(2) or "")
        if RE_LITERAL.match(trozo):
            continue
        if SEGURAS.search(trozo):
            continue
        # Una plantilla que empieza por "/" y la monta la propia página
        # (`/web/blog/${anyo}/...`): la dirección no viene de fuera.
        if re.match(r"""^\s*[`"']/""", trozo):
            continue
        if re.match(r"""^\s*["'`]#["'`]?""", trozo.strip()):
            continue
        # Y el caso de siempre: la dirección se comprueba unas líneas más
        # arriba, dentro de la misma función, y aquí ya llega limpia.
        if SEGURAS.search(envoltorio(texto, m.start())[:1200]):
            continue
        if (nombre, trozo.strip()) in REVISADOS:
            continue
        avisos.append((linea_de(texto, m.start()),
                       "dirección puesta sin comprobar",
                       trozo.strip()[:70]))

    return nombre, avisos


# ---- LA LISTA DE SCRIPTS PERMITIDOS DE CADA PÁGINA ----
#
# Cada página lleva en el <head> un <meta http-equiv="Content-Security-
# Policy">: la lista de lo que el navegador deja ejecutar. Los scripts que
# vienen de un archivo .js del propio sitio pasan siempre; los que van
# escritos dentro de la página (<script>...</script>, sin src) solo pasan
# si su huella (un sha256 de lo que llevan dentro) está en esa lista. Así,
# un script que alguien consiguiera colar en la página no se ejecuta.
#
# La lista la escribe actualizar-cabeceras.py. Si se cambia A MANO un
# script escrito en la página (aunque sea un espacio) y no se pasa, la
# huella ya no coincide y el navegador lo bloquea: el tema no se aplica,
# el menú no se adelanta... sin ningún error a la vista. Esto lo canta
# antes de subir.
RE_SCRIPT_EN_LINEA = re.compile(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", re.S)
RE_CSP = re.compile(r'<meta http-equiv="Content-Security-Policy" content="([^"]*)"[^>]*>')


def huella(codigo):
    import base64
    import hashlib
    return "'sha256-%s'" % base64.b64encode(
        hashlib.sha256(codigo.encode("utf-8")).digest()).decode()


def paginas_publicadas():
    for nombre in ("index.html", "not_found.html"):
        if (RAIZ / nombre).is_file():
            yield RAIZ / nombre
    yield from sorted((RAIZ / "web").rglob("*.html"))


def mirar_csp(pagina):
    """Lo que le falta a la lista de esa página, o None si está bien."""
    # El navegador lee los saltos de Windows como "\n" antes de calcular la
    # huella, así que aquí también.
    texto = pagina.read_bytes().decode("utf-8").replace("\r\n", "\n")
    m = RE_CSP.search(texto)
    if not m:
        return "no lleva la lista de scripts permitidos"
    sin_meta = texto[:m.start()] + texto[m.end():]
    permitidas = set(m.group(1).replace(";", " ").split())
    faltan = [s for s in RE_SCRIPT_EN_LINEA.finditer(sin_meta)
              if huella(s.group(1)) not in permitidas]
    if faltan:
        return "%d script(s) escritos en la página que el navegador bloquearía" % len(faltan)
    return None


def main():
    if not SCRIPTS.is_dir():
        print("  No encuentro scripts/. ¿Estás en la carpeta raíz del sitio?")
        return 1

    print("\n  ---- scripts escritos en las páginas ----\n")
    mal = [(p, que) for p in paginas_publicadas() for que in [mirar_csp(p)] if que]
    if not mal:
        print("  Todos están en la lista de permitidos de su página.")
    else:
        for pagina, que in mal:
            print("  %s: %s" % (pagina.relative_to(RAIZ).as_posix(), que))
        print("\n  Pasa python herramientas/3-generadores/actualizar-cabeceras.py:")
        print("  rehace la lista con lo que lleva cada página ahora.")

    total = 0
    mirados = 0
    print("\n  ---- por dónde se podría colar código ----\n")
    for js in sorted(SCRIPTS.rglob("*.js")):
        if es_paquete(js):
            continue
        mirados += 1
        nombre, avisos = mirar(js)
        if not avisos:
            continue
        total += len(avisos)
        print("  %s" % nombre)
        for linea, que, trozo in avisos:
            print("     línea %-5d %s" % (linea, que))
            print("                 %s" % trozo)
        print()

    if not total:
        print("  Nada que mirar: todo lo que se pega va escapado y todas las")
        print("  direcciones se comprueban antes de ponerlas.\n")
    else:
        print("  %d sitio(s) que repasar en %d archivo(s).\n" % (total, mirados))
        print("  Repásalos uno a uno: alguno puede estar bien (una dirección")
        print("  que siempre vale, por ejemplo). Lo que NO puede quedarse es")
        print("  un texto de fuera pegado como HTML o puesto en un href.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
