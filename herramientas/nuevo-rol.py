#!/usr/bin/env python3
# =========================================
# PORTFOLIO DE ROL — añade una aventura, un mapa o un sistema
# =========================================
# Te pregunta los datos y mete la tarjeta en la rejilla de
# web/mis_movidas/rol/index_rol.html. Después pasa los generadores,
# así que la aventura aparece sola en la portada (novedades.exe) y en
# el RSS sin tocar ningún JSON.
#
# CÓMO USARLO
# -----------
# Desde la carpeta raíz del sitio:
#
#     python herramientas/nuevo-rol.py
#
# Y responder. También se le puede decir todo de una vez:
#
#     python herramientas/nuevo-rol.py --titulo "El Faro de Kerm" \
#            --categoria aventuras --sistema "D&D 5e · 3-5 jugadores" \
#            --kofi https://ko-fi.com/s/xxxx \
#            --drive https://drive.google.com/file/d/xxxx/view
#
# ANTES DE EMPEZAR
# ----------------
# Ten la portada de la aventura ya guardada en imagenes/mis_movidas/rol/ y
# pasada por optimizar-imagenes.py. El script te pregunta por su ruta y
# te avisa si no la encuentra, pero no la crea.
#
# QUÉ HACE
# --------
# 1. Monta la tarjeta desde herramientas/plantillas/tarjeta-rol.html.
# 2. La mete la primera de la rejilla, con su data-categoria.
# 3. Si la categoría es nueva, la añade a la lista de la ventana de
#    filtros (data-filtros-categorias) para que tenga botón propio.
# 4. Pasa generar-posts.py y generar-rss.py.
#
# La categoría puede ser una de las que ya hay o una nueva: el filtro
# de la página se construye solo a partir de las categorías que
# encuentra, así que no hay ninguna lista que mantener a mano.
#
# El enlace de Drive es opcional: si lo dejas en blanco, la tarjeta se
# queda solo con el botón de Ko-fi.

import argparse
import datetime as dt
import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ROL = RAIZ / "web" / "mis_movidas" / "rol" / "index_rol.html"
PLANTILLA = RAIZ / "herramientas" / "plantillas" / "tarjeta-rol.html"
IMGS_ROL = "/imagenes/mis_movidas/rol/"

BOTON_DRIVE = (
    '                            <a class="portfolio-card-btn '
    'portfolio-card-btn-secondary" href="{enlace}" target="_blank" '
    'rel="noopener noreferrer">Descargar gratis ↓'
    '<span class="visually-hidden"> — {titulo} (se abre en otra pestaña)</span></a>'
)


def escapar(texto):
    """Para meter texto en el HTML sin romperlo. El & primero, o se
    escaparían dos veces los que ya vengan escapados."""
    return (
        texto.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def preguntar(texto, por_defecto=""):
    pista = f" [{por_defecto}]" if por_defecto else ""
    return input(f"  {texto}{pista}: ").strip() or por_defecto


def categorias_disponibles(texto):
    """Las categorías que ya conoce la página: las declaradas en la
    ventana de filtros más las que lleve alguna tarjeta."""
    declaradas = buscar_declaradas(texto)
    usadas = re.findall(r'<div class="portfolio-card"[^>]*data-categoria="([^"]*)"', texto)
    vistas = []
    for c in declaradas + usadas:
        c = c.strip()
        if c and c not in vistas:
            vistas.append(c)
    return vistas


def buscar_declaradas(texto):
    encontrado = re.search(r'data-filtros-categorias="([^"]*)"', texto)
    if not encontrado:
        return []
    return [c.strip() for c in encontrado.group(1).split(",") if c.strip()]


def enlace_valido(url):
    return bool(re.match(r"^https?://", url or ""))


def pedir_datos(args, categorias):
    datos = {}

    datos["categoria"] = args.categoria
    if not datos["categoria"]:
        print("\n  ¿En qué categoría va?")
        for i, c in enumerate(categorias, start=1):
            print(f"     {i}. {c}")
        print("     (o escribe una categoría nueva)")
        elegido = preguntar("Elige", "1")
        try:
            datos["categoria"] = categorias[int(elegido) - 1]
        except (ValueError, IndexError):
            datos["categoria"] = elegido
    datos["categoria"] = datos["categoria"].strip().lower()
    if not datos["categoria"]:
        print("  Hace falta una categoría.")
        sys.exit(1)
    # Una categoría nueva no es un error: el filtro de la página se
    # construye a partir de lo que encuentra, así que basta con dejarla
    # también declarada (ver anotar_categoria).
    datos["es_nueva"] = datos["categoria"] not in categorias

    datos["titulo"] = args.titulo or preguntar("Título")
    while not datos["titulo"]:
        print("     Hace falta un título.")
        datos["titulo"] = preguntar("Título")

    datos["sistema"] = args.sistema or preguntar(
        "Sistema y jugadores (sale debajo del título)", "D&D 5e · 2-5 jugadores"
    )
    datos["descripcion"] = args.descripcion or preguntar("Descripción (un párrafo)")
    while not datos["descripcion"]:
        print("     Escribe algo, aunque sea corto: es lo que se lee en la tarjeta.")
        datos["descripcion"] = preguntar("Descripción")

    crudo = args.fecha or preguntar(
        "Fecha de publicación (dd-mm-aaaa)", dt.date.today().strftime("%d-%m-%Y")
    )
    try:
        datos["fecha"] = dt.datetime.strptime(crudo.replace("/", "-"), "%d-%m-%Y").date()
    except ValueError:
        print(f"  No entiendo la fecha {crudo!r}. Ponla como dd-mm-aaaa.")
        sys.exit(1)

    datos["imagen"] = args.imagen or preguntar(
        "Imagen de portada (ruta dentro del sitio)", IMGS_ROL + "thumbnail_.webp"
    )
    if not datos["imagen"].startswith("/"):
        datos["imagen"] = IMGS_ROL + datos["imagen"].lstrip("/")
    datos["alt"] = args.alt or preguntar(
        "Descripción de la imagen (para quien no la ve)",
        f"Portada de {datos['titulo']}",
    )

    datos["kofi"] = args.kofi or preguntar("Enlace de Ko-fi")
    while not enlace_valido(datos["kofi"]):
        print("     Tiene que empezar por http:// o https://.")
        datos["kofi"] = preguntar("Enlace de Ko-fi")

    datos["drive"] = args.drive if args.drive is not None else preguntar(
        "Enlace de Google Drive (opcional, Enter para saltar)"
    )
    if datos["drive"] and not enlace_valido(datos["drive"]):
        print(f"  El enlace de Drive {datos['drive']!r} no empieza por http; lo dejo fuera.")
        datos["drive"] = ""

    return datos


def montar_tarjeta(datos):
    texto = PLANTILLA.read_text(encoding="utf-8")
    texto = texto.replace("{{CATEGORIA}}", escapar(datos["categoria"]))
    texto = texto.replace("{{FECHA}}", datos["fecha"].strftime("%d-%m-%Y"))
    texto = texto.replace("{{IMAGEN}}", escapar(datos["imagen"]))
    texto = texto.replace("{{ALT}}", escapar(datos["alt"]))
    texto = texto.replace("{{TITULO}}", escapar(datos["titulo"]))
    texto = texto.replace("{{SISTEMA}}", escapar(datos["sistema"]))
    texto = texto.replace("{{DESCRIPCION}}", escapar(datos["descripcion"]))
    texto = texto.replace("{{KOFI}}", escapar(datos["kofi"]))

    if datos["drive"]:
        texto = texto.replace(
            "{{DRIVE}}",
            BOTON_DRIVE.format(
                enlace=escapar(datos["drive"]),
                titulo=escapar(datos["titulo"]),
            ),
        )
    else:
        # Sin Drive, fuera la línea entera: dejarla en blanco deja un
        # hueco raro dentro del HTML.
        texto = texto.replace("{{DRIVE}}\n", "")

    if "{{" in texto:
        sobran = sorted(set(re.findall(r"\{\{[A-Z_]+\}\}", texto)))
        print(f"  La plantilla tiene marcadores sin rellenar: {', '.join(sobran)}")
        sys.exit(1)
    return texto


def insertar(texto, tarjeta):
    """La tarjeta nueva va la primera de la rejilla."""
    marca = texto.find('<div class="portfolio-grid"')
    if marca == -1:
        print("  No encuentro la rejilla (.portfolio-grid) en index_rol.html.")
        sys.exit(1)
    corte = texto.index("\n", marca) + 1
    return texto[:corte] + "\n" + tarjeta + texto[corte:]


def anotar_categoria(texto, categoria):
    """Deja la categoría nueva declarada en la ventana de filtros. No
    hace falta para que salga su botón —eso lo decide la tarjeta— pero
    así sigue teniéndolo el día que se quede sin nada dentro."""
    encontrado = re.search(r'data-filtros-categorias="([^"]*)"', texto)
    if not encontrado:
        return texto
    actuales = [c.strip() for c in encontrado.group(1).split(",") if c.strip()]
    if categoria in actuales:
        return texto
    actuales.append(categoria)
    return (
        texto[: encontrado.start(1)]
        + escapar(", ".join(actuales))
        + texto[encontrado.end(1) :]
    )


def pasar_generadores():
    for script in ("generar-posts.py", "generar-rss.py"):
        ruta = RAIZ / "herramientas" / script
        if not ruta.is_file():
            continue
        print(f"\n  ---- {script} ----")
        subprocess.run([sys.executable, str(ruta)], cwd=RAIZ, check=False)


def main():
    parser = argparse.ArgumentParser(description="Añade una cosa al portfolio de rol.")
    parser.add_argument("--categoria", help="aventuras, mapas, sistemas… o una nueva")
    parser.add_argument("--titulo")
    parser.add_argument("--sistema")
    parser.add_argument("--descripcion")
    parser.add_argument("--fecha", help="dd-mm-aaaa (por defecto, hoy)")
    parser.add_argument("--imagen", help="ruta de la portada dentro del sitio")
    parser.add_argument("--alt", help="descripción de la imagen")
    parser.add_argument("--kofi")
    parser.add_argument("--drive", help="opcional; pon '' para no poner ninguno")
    args = parser.parse_args()

    if not ROL.is_file():
        print(f"  No encuentro {ROL.relative_to(RAIZ)}.")
        return 1
    if not PLANTILLA.is_file():
        print(f"  No encuentro {PLANTILLA.relative_to(RAIZ)}.")
        return 1

    texto = ROL.read_text(encoding="utf-8")
    categorias = categorias_disponibles(texto)

    print("\n  NUEVA COSA EN EL PORTFOLIO DE ROL\n")
    datos = pedir_datos(args, categorias)

    if f'<h2 class="portfolio-card-title">{escapar(datos["titulo"])}</h2>' in texto:
        print(f"\n  Ya hay una tarjeta titulada {datos['titulo']!r}; no añado otra.")
        return 1

    archivo_imagen = RAIZ / datos["imagen"].lstrip("/")
    if not archivo_imagen.is_file():
        print(f"\n  OJO: no encuentro {datos['imagen']} en el sitio.")
        print("  La tarjeta se crea igual, pero ahí saldrá un hueco hasta que la subas.")

    tarjeta = montar_tarjeta(datos)
    texto = insertar(texto, tarjeta)
    if datos["es_nueva"]:
        texto = anotar_categoria(texto, datos["categoria"])
    ROL.write_text(texto, encoding="utf-8")

    print(f"\n  Añadida a «{datos['categoria']}» en index_rol.html")
    if datos["es_nueva"]:
        print("  (categoría nueva: ya tiene su botón en filtros.lst)")

    pasar_generadores()

    print("\n  Listo. Repasa la tarjeta en la web y sube el sitio a Neocities.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
