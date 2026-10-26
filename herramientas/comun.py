#!/usr/bin/env python3
# =========================================
# LO QUE COMPARTEN TODAS LAS HERRAMIENTAS
# =========================================
# Esto NO se ejecuta solo: es el cajón de las cosas que usaban tres o
# cuatro herramientas cada una por su cuenta. Estaban copiadas, y eso
# ya dio un problema de verdad: el arreglo para no romper los saltos de
# línea de Windows se hizo en actualizar-cabeceras.py y los otros
# scripts siguieron rompiéndolos, así que cada vez que se pasaban
# dejaban la página entera marcada como modificada en git. Ahora esa
# decisión —y las demás de aquí— viven en un solo sitio.
#
# Para usarlo desde cualquier herramienta de esta carpeta:
#
#     from comun import RAIZ, preguntar, escribir_texto
#
# (Python mira primero en la carpeta del script que estás ejecutando,
# así que no hace falta instalar nada ni tocar rutas.)

import datetime as dt
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

# La carpeta del sitio. Se calcula desde ESTE archivo, así que da igual
# desde dónde ejecutes la herramienta.
RAIZ = Path(__file__).resolve().parent.parent
HERRAMIENTAS = RAIZ / "herramientas"
PLANTILLAS = HERRAMIENTAS / "plantillas"

# Los meses, como los escribe la web. MESES_CORTOS es lo que se pinta en
# la fecha de una entrada y tiene que coincidir con lo que entiende
# generar-posts.py al leerla de vuelta.
MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]
MESES_CORTOS = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sept", "oct", "nov", "dic",
]


# =========================================
# PREGUNTAR Y ESCRIBIR POR PANTALLA
# =========================================

def preguntar(texto, por_defecto=""):
    """Una pregunta con su valor por defecto entre corchetes."""
    pista = f" [{por_defecto}]" if por_defecto else ""
    return input(f"  {texto}{pista}: ").strip() or por_defecto


def elegir(titulo, opciones, permitir_nueva=True, por_defecto="1"):
    """Un menú numerado. Devuelve la opción elegida, o lo que escriba
    quien prefiera inventarse una (una categoría nueva, por ejemplo).

    por_defecto es lo que vale un Enter en blanco. Normalmente "1", que es
    lo cómodo; con "" un Enter devuelve una cadena vacía, que es como se
    sale de un bucle de "¿alguno más?" sin tener que escribir nada."""
    print(f"\n  {titulo}")
    for i, opcion in enumerate(opciones, start=1):
        print(f"     {i}. {opcion}")
    if permitir_nueva:
        print("     (o escribe una nueva)")
    elegido = preguntar("Elige", por_defecto)
    try:
        return opciones[int(elegido) - 1]
    except (ValueError, IndexError):
        return elegido if permitir_nueva else opciones[0]


# =========================================
# TEXTO
# =========================================

def sin_tildes(texto):
    return "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    )


def nombre_archivo(titulo, por_defecto="entrada"):
    """'Tarde de mapas' -> 'tarde-de-mapas'. Sin tildes ni eñes, que en
    una dirección dan problemas."""
    limpio = sin_tildes(titulo).lower().replace("ñ", "n")
    limpio = re.sub(r"[^a-z0-9]+", "-", limpio).strip("-")
    return limpio or por_defecto


def escapar(texto):
    """Para meter texto dentro de un atributo HTML sin romperlo. El &
    primero, o se escaparían dos veces los que ya vengan escapados."""
    return (
        (texto or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def limpiar_html(texto):
    """El texto de dentro de una etiqueta, sin etiquetas ni espacios de
    más: '<em>hola</em>  mundo' -> 'hola mundo'."""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", texto or "")).strip()


# =========================================
# FECHAS
# =========================================

def leer_fecha(texto):
    """Acepta dd-mm-aaaa y dd/mm/aaaa. Devuelve una fecha o None."""
    for formato in ("%d-%m-%Y", "%d/%m/%Y"):
        try:
            return dt.datetime.strptime((texto or "").strip(), formato).date()
        except ValueError:
            continue
    return None


def fecha_larga(fecha):
    """La fecha como la escribe la web: '05 oct 2026'."""
    return f"{fecha.day:02d} {MESES_CORTOS[fecha.month - 1]} {fecha.year}"


def fecha_iso(fecha):
    """La misma fecha en formato de máquina, para el <time datetime>."""
    return fecha.strftime("%Y-%m-%d")


# =========================================
# LEER Y ESCRIBIR SIN ROMPER NADA
# =========================================
# La mitad de las páginas del sitio están guardadas con saltos de línea
# de Windows (\r\n). read_text/write_text de Python los convierte a \n
# sin avisar, así que una herramienta que solo cambia una línea dejaba
# el archivo entero marcado como cambiado en git y no había forma de ver
# qué se había tocado de verdad. Estas dos respetan lo que había.

def leer_texto(archivo):
    """Devuelve (texto con saltos \\n, si el archivo era de Windows)."""
    crudo = Path(archivo).read_bytes()
    return crudo.decode("utf-8").replace("\r\n", "\n"), b"\r\n" in crudo


def escribir_texto(archivo, texto, crlf=False):
    if crlf:
        texto = texto.replace("\n", "\r\n")
    Path(archivo).write_bytes(texto.encode("utf-8"))


def escribir_como_estaba(archivo, texto):
    """Escribe respetando los saltos de línea que ya tuviera el archivo.
    Para cuando se modifica una página que ya existe."""
    _, crlf = leer_texto(archivo)
    escribir_texto(archivo, texto, crlf)


def leer_json(archivo, por_defecto=None):
    """El JSON, o el valor por defecto si no está o está roto. Si está
    roto se avisa y se para: es mejor que seguir y pisarlo."""
    ruta = Path(archivo)
    if not ruta.is_file():
        return por_defecto
    try:
        return json.loads(ruta.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        print(f"  {ruta.relative_to(RAIZ)} tiene algo mal y no lo entiendo: {error}")
        print("  Arréglalo y vuelve a pasar esto; no toco nada mientras tanto.")
        sys.exit(1)


def escribir_json(archivo, datos):
    """Con sangría de 4 y sin escapar los acentos, que es como están
    todos los de datos/ y como se leen bien al abrirlos a mano. Y
    respetando los saltos de línea que ya tuviera el archivo, por lo
    mismo que las páginas: si no, cambiar una entrada dejaba el JSON
    entero marcado como modificado en git."""
    ruta = Path(archivo)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    texto = json.dumps(datos, ensure_ascii=False, indent=4) + "\n"
    crlf = ruta.is_file() and b"\r\n" in ruta.read_bytes()
    escribir_texto(ruta, texto, crlf)


# =========================================
# EL SITIO
# =========================================

# La marca que lleva una entrada a medio escribir. Mientras esté puesta
# no sale en los listados, ni en el RSS, ni en el sitemap.
RE_BORRADOR = re.compile(
    r'<article class="(?:blog|relato|cuaderno)-post"[^>]*\bdata-borrador\b'
)


# LOS COMENTARIOS DE LAS PÁGINAS PUBLICADAS. Lo que explica la plantilla
# sobra en la página publicada (ver 3-generadores/quitar-comentarios.py,
# que es quien lo pasa por todo lo publicado). Se quedan las marcas de
# actualizar-cabeceras.py, el código comentado (empieza por "<") y lo que
# empiece por "!".
COMENTARIO = re.compile(r"<!--(.*?)-->", re.S)
# Lo que no se toca por dentro: ahí "<!--" es texto.
CRUDO = re.compile(r"<(script|style)\b.*?</\1\s*>", re.S | re.I)


# Las marcas que busca actualizar-cabeceras.py (ABRE, CIERRA, ABRE_JS,
# CIERRA_JS, ABRE_TEMA y ABRE_ADELANTO). Si cambian allí, cambian aquí.
MARCAS = ("==== CSS ====", "==== fin del CSS ====", "==== JS ====",
          "==== fin del JS ====", "==== TEMA ====", "==== ADELANTO DEL MENÚ ====",
          "==== BARRA LATERAL ====", "==== fin de la BARRA LATERAL ====",
          "==== FRAGMENTO ", "==== fin del FRAGMENTO ")


def se_queda(cuerpo):
    limpio = cuerpo.strip()
    return limpio.startswith(MARCAS) or limpio.startswith("<") or limpio.startswith("!")



def limpiar_comentarios_html(texto):
    """(texto sin comentarios de explicación, cuántos se han ido)."""
    crudos = [(m.start(), m.end()) for m in CRUDO.finditer(texto)]

    def dentro_de_crudo(i):
        return any(a <= i < b for a, b in crudos)

    quitados = 0
    trozos = []
    ultimo = 0
    for m in COMENTARIO.finditer(texto):
        if dentro_de_crudo(m.start()) or se_queda(m.group(1)):
            continue
        inicio, fin = m.start(), m.end()
        # Si el comentario ocupa sus propias líneas, se va con ellas: con
        # su sangría delante y su salto detrás. Si no, solo él.
        linea_ini = texto.rfind("\n", 0, inicio) + 1
        linea_fin = texto.find("\n", fin)
        linea_fin = len(texto) if linea_fin == -1 else linea_fin
        if not texto[linea_ini:inicio].strip() and not texto[fin:linea_fin].strip():
            inicio = linea_ini
            fin = min(linea_fin + 1, len(texto))
        trozos.append(texto[ultimo:inicio])
        ultimo = fin
        quitados += 1
    trozos.append(texto[ultimo:])
    return "".join(trozos), quitados


def es_borrador(archivo):
    try:
        return bool(RE_BORRADOR.search(Path(archivo).read_text(encoding="utf-8")))
    except OSError:
        return False


def url_de(ruta):
    """La dirección pública de un archivo del sitio."""
    return "/" + Path(ruta).relative_to(RAIZ).as_posix()


def paginas(carpeta, patron="*.html"):
    """Las páginas de contenido de una carpeta: fuera índices, páginas
    sueltas y borradores."""
    for p in sorted(Path(carpeta).rglob(patron)):
        if p.name.startswith("index_") or p.name == "diario.html":
            continue
        if es_borrador(p):
            continue
        yield p


# =========================================
# LA BÓVEDA DEL MUNDO
# =========================================
# Qué es el mundo y qué es la aplicación, dentro de una bóveda de
# Chronicler. Vive aquí porque lo usan DOS herramientas y tienen que estar
# de acuerdo: 1-publicar/importar-mundo.py, que se trae la bóveda, y
# 3-generadores/generar-mundo.py, que la publica. Si la que trae se trajera
# algo que la que publica ignora, quedaría ocupando sitio en wiki/; y al
# revés es peor, porque entonces se publica.

# Carpetas que no son el mundo, miren donde miren dentro de la bóveda.
CARPETAS_QUE_NO_SON_EL_MUNDO = {
    ".git", ".obsidian", ".trash", ".DS_Store", "__pycache__", "node_modules",
    # Lo de Chronicler: sus copias de trabajo y lo que guarda en caché.
    ".chronicler", ".chronicler-cache", ".cache",
}

# Y esto por la ruta entera, contando desde la raíz de la bóveda:
# _system/templates son las PLANTILLAS de Chronicler —los moldes para
# crear páginas nuevas, con sus huecos sin rellenar—, no páginas del
# mundo. Publicarlas sería publicar un formulario en blanco.
RUTAS_QUE_NO_SON_EL_MUNDO = ("_system/templates",)

ARCHIVOS_QUE_NO_SON_EL_MUNDO = {".DS_Store", "Thumbs.db", "desktop.ini"}


def es_del_mundo(archivo, boveda):
    """Si un archivo de la bóveda es del mundo (y se trae y se publica) o
    es de la aplicación (y no se toca)."""
    nombre = archivo.name
    if nombre in ARCHIVOS_QUE_NO_SON_EL_MUNDO or nombre.startswith("._"):
        return False
    try:
        partes = archivo.relative_to(boveda).parts
    except ValueError:
        return False
    for parte in partes[:-1]:
        # Cualquier carpeta que empiece por punto: las esconde el sistema
        # porque no son para que las mires, y eso vale igual aquí.
        if parte in CARPETAS_QUE_NO_SON_EL_MUNDO or parte.startswith("."):
            return False
    camino = "/".join(partes)
    for ruta in RUTAS_QUE_NO_SON_EL_MUNDO:
        if camino == ruta or camino.startswith(ruta + "/"):
            return False
    return not nombre.startswith(".")


# LO QUE TÚ DEJAS FUERA. Lo de arriba es lo que no es del mundo; esto es lo
# que SÍ es del mundo pero no quieres publicar todavía: una página a medio
# escribir, un sitio que aún no ha salido en la partida. Se elige con
#
#     python herramientas/1-publicar/importar-mundo.py --elegir
#
# y se apunta en herramientas/wiki-fuera.txt, una ruta por línea, contando
# desde la raíz de la bóveda. Lo leen las DOS herramientas, por lo mismo
# que es_del_mundo: si solo lo supiera el importador, el generador volvería
# a publicar la página en cuanto Chronicler escribiera directamente en
# wiki/ (pasó: se quitaron seis páginas a mano y volvieron al generar).
#
# Se puede escribir a mano. Una línea que acabe en "/" deja fuera la
# carpeta entera, con lo que se añada a ella en el futuro incluido. Las
# mayúsculas dan igual, como en Windows.
WIKI_FUERA = HERRAMIENTAS / "wiki-fuera.txt"


def wiki_fuera():
    """Las líneas de wiki-fuera.txt, tal y como están escritas."""
    if not WIKI_FUERA.is_file():
        return []
    reglas = []
    for linea in WIKI_FUERA.read_text(encoding="utf-8").splitlines():
        linea = linea.strip().replace("\\", "/").lstrip("/")
        if linea and not linea.startswith("#"):
            reglas.append(linea)
    return reglas


def esta_fuera(relativo, reglas):
    """Si un archivo de la bóveda (su ruta desde la raíz de la bóveda) está
    en la lista de lo que se deja fuera."""
    ruta = str(relativo).replace("\\", "/").lower()
    for regla in reglas:
        regla = regla.lower()
        if ruta == regla or (regla.endswith("/") and ruta.startswith(regla)):
            return True
    return False


def guardar_wiki_fuera(reglas):
    lineas = [
        "# Lo que NO entra en la wiki aunque esté en la bóveda de Chronicler.",
        "# Una ruta por línea, desde la raíz de la bóveda. Si acaba en \"/\",",
        "# la carpeta entera. Lo escribe importar-mundo.py --elegir y lo leen",
        "# él y generar-mundo.py. Se puede tocar a mano.",
    ]
    WIKI_FUERA.write_text("\n".join(lineas + sorted(reglas, key=str.lower)) + "\n",
                          encoding="utf-8")


# =========================================
# LAS CAMPAÑAS DE ROL
# =========================================
# Una campaña por archivo en datos/notas_rol/campana-<clave>.json. No hay una lista
# escrita en ningún sitio a propósito —se buscan por el nombre del
# archivo—, así que para empezar una campaña nueva basta con copiar uno de
# esos JSON y su carpeta.
#
# Esto vive aquí, y no en la herramienta que lo estrenó, porque lo usan
# dos: la que crea las notas de una partida (nuevo.py --sesion) y la que
# añade gente a los npcs (nuevo-personaje.py). Copiado en las dos,
# el día que cambiara el nombre del archivo habría que acordarse de las
# dos.

CAMPANAS = RAIZ / "datos" / "notas_rol"
PATRON_CAMPANA = "campana-*.json"


def campanas_que_hay():
    """[(archivo, datos)] de las campañas, por orden de archivo."""
    encontradas = []
    for archivo in sorted(CAMPANAS.glob(PATRON_CAMPANA)):
        datos = leer_json(archivo, {})
        if isinstance(datos, dict) and (datos.get("nombre") or "").strip():
            encontradas.append((archivo, datos))
    return encontradas


def elegir_campana(pedida, pregunta="¿De qué campaña?"):
    """La campaña que diga --campana, o la única que haya, o se pregunta.
    Devuelve (archivo, datos), o (None, None) si no hay forma."""
    campanas = campanas_que_hay()
    if not campanas:
        print(f"  No encuentro ninguna campaña en datos/notas_rol/{PATRON_CAMPANA}.")
        print("  Para empezar una, copia datos/notas_rol/campana-ragna.json con otro")
        print("  nombre y copia también su carpeta en web/notas_rol/.")
        return None, None

    if pedida:
        buscada = pedida.strip().lower()
        for archivo, datos in campanas:
            if (datos.get("clave") or "").strip().lower() == buscada:
                return archivo, datos
        claves = ", ".join((d.get("clave") or "?") for _, d in campanas)
        print(f"  No tengo ninguna campaña que se llame {pedida!r}. Hay: {claves}.")
        return None, None

    if len(campanas) == 1:
        return campanas[0]

    nombres = [(d.get("nombre") or d.get("clave") or "?") for _, d in campanas]
    elegido = elegir(pregunta, nombres, permitir_nueva=False)
    return campanas[nombres.index(elegido)]


# El orden importa: primero el archivo del año (que crea index_<año>.html
# y el enlace del menú si es un año o un mes nuevo), luego los listados,
# el RSS que lee de ellos, el sitemap, el mapa del sitio (que necesita
# las fechas de los listados), y las cabeceras al final, que le ponen su
# bloque de CSS a las páginas nuevas y dejan cada archivo con su versión
# anti-caché al día.
# Las rutas van con su subcarpeta porque desde que las herramientas están
# repartidas por carpetas, el nombre suelto ya no basta para encontrarlas.
GENERADORES = (
    "3-generadores/generar-archivo.py",
    # Los tokens de los NPC y de la mesa, en pequeño, para donde se ven
    # pequeños. Antes del buscador, que lee esos JSON, y antes de
    # generar-posts, que escribe con ellos la ficha de cada campaña.
    "2-imagenes/tokens-pequenos.py",
    "3-generadores/generar-posts.py",
    # Mis personajes: el índice y la ficha de cada uno, de su JSON.
    "3-generadores/generar-personajes.py",
    # Los comentarios de explicación de las plantillas, fuera de lo
    # publicado (los borradores se quedan con su guía). Después de
    # generar-archivo, que escribe páginas nuevas desde una plantilla.
    "3-generadores/quitar-comentarios.py",
    # El nombre y la intro de la página de npcs, los mismos que su JSON:
    # si no, la página salta al llegar el JSON.
    "3-generadores/textos-npcs.py",
    "3-generadores/generar-rss.py",
    "3-generadores/generar-sitemap.py",
    "3-generadores/generar-mapa.py",
    # Después de los listados y antes de las cabeceras: éste lee el HTML
    # ya montado de cada página para sacarle el texto, así que tiene que
    # ir cuando las entradas nuevas ya existen.
    "3-generadores/generar-buscador.py",
    "3-generadores/actualizar-cabeceras.py",
    # El último, cuando ya está todo escrito: no genera nada, solo mira
    # que ninguna hoja de estilo tenga un comentario mal cerrado. Va
    # aquí y no a mano porque ese fallo el navegador no lo canta: se
    # come en silencio la regla que venga detrás y la página se ve rara
    # sin que nada parezca roto. Pasó con las dos columnas de la ventana
    # de accesibilidad.
    "4-comprobar/css-sano.py",
    # Y que ningún tema de color se haya quedado a medias: un tema vive
    # en seis sitios (los colores, el script, el pre-pintado de cada
    # página, la muestra del botón, el botón y la página de
    # accesibilidad) y faltando en uno falla raro y en silencio.
    "4-comprobar/temas-completos.py",
)


def pasar_generadores(scripts=GENERADORES):
    for script in scripts:
        ruta = HERRAMIENTAS / script
        if not ruta.is_file():
            continue
        print(f"\n  ---- {script} ----")
        subprocess.run([sys.executable, str(ruta)], cwd=RAIZ, check=False)
