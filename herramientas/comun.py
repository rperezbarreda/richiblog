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


def elegir(titulo, opciones, permitir_nueva=True):
    """Un menú numerado. Devuelve la opción elegida, o lo que escriba
    quien prefiera inventarse una (una categoría nueva, por ejemplo)."""
    print(f"\n  {titulo}")
    for i, opcion in enumerate(opciones, start=1):
        print(f"     {i}. {opcion}")
    if permitir_nueva:
        print("     (o escribe una nueva)")
    elegido = preguntar("Elige", "1")
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
RE_BORRADOR = re.compile(r'<article class="(?:blog|relato)-post"[^>]*\bdata-borrador\b')


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


# El orden importa: primero el archivo del año (que crea index_<año>.html
# y el enlace del menú si es un año o un mes nuevo), luego los listados,
# el RSS que lee de ellos, el sitemap, el mapa del sitio (que necesita
# las fechas de los listados), y las cabeceras al final, que le ponen su
# bloque de CSS a las páginas nuevas y dejan cada archivo con su versión
# anti-caché al día.
GENERADORES = (
    "generar-archivo.py",
    "generar-posts.py",
    "generar-rss.py",
    "generar-sitemap.py",
    "generar-mapa.py",
    "actualizar-cabeceras.py",
)


def pasar_generadores(scripts=GENERADORES):
    for script in scripts:
        ruta = HERRAMIENTAS / script
        if not ruta.is_file():
            continue
        print(f"\n  ---- {script} ----")
        subprocess.run([sys.executable, str(ruta)], cwd=RAIZ, check=False)
