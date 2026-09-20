#!/usr/bin/env python3
# =========================================
# ENTRADA NUEVA — crea el archivo y lo deja listo para escribir
# =========================================
# Te pregunta cuatro cosas y te deja la página montada: la carpeta del
# mes, el HTML con su título, su fecha, sus etiquetas y todo el bloque
# de <meta> (el que decide cómo se ve el enlace al compartirlo).
#
# Lo único que tienes que hacer después es abrir el archivo y escribir.
#
# NACE COMO BORRADOR
# ------------------
# La entrada se crea con la marca data-borrador puesta: existe, la
# puedes mirar en local y arriba se ve una franja que lo dice, pero NO
# sale en los listados, ni en el RSS, ni en el sitemap. Cuando la
# tengas escrita, se publica con:
#
#     python3 herramientas/publicar.py
#
# Así una entrada a medio escribir no se publica sola el día que subas
# el sitio por cualquier otra cosa.
#
# CÓMO USARLO
# -----------
# Desde la carpeta raíz del sitio:
#
#     python herramientas/nueva-entrada.py
#
# Y responder. Para no tener que responder nada, también se le puede
# decir todo de una vez:
#
#     python herramientas/nueva-entrada.py --titulo "Tarde de mapas" \
#            --fecha 18-09-2026 --etiquetas diario
#
#     python herramientas/nueva-entrada.py --relato \
#            --titulo "Pequeño insecto" --subcategoria microrelato
#
# QUÉ HACE EXACTAMENTE
# --------------------
# 1. Calcula el nombre del archivo a partir del título: "Tarde de
#    mapas" -> tarde-de-mapas.html. Sin tildes ni eñes, que en una URL
#    dan problemas.
# 2. Lo guarda en web/blog/<año>/<mes>/ (o en web/mis_movidas/relatos/
#    si es un relato), creando la carpeta si no existe.
# 3. Rellena la plantilla de herramientas/plantillas/.
# 4. Pasa los generadores: generar-archivo.py (crea la página del año y
#    su enlace en el menú si hace falta), actualizar-cabeceras.py,
#    generar-posts.py (los listados) y generar-rss.py (el feed). Como
#    todavía es un borrador, ninguno de ellos la mete en ningún sitio:
#    eso pasa al publicarla.
#
# Si el archivo ya existe NO lo pisa: te avisa y no hace nada.
#
# LO QUE TE TOCA A TI DESPUÉS
# ---------------------------
# - Escribir la entrada (el archivo trae un párrafo de muestra).
# - Cambiar la imagen de la derecha por la que quieras, o quitarla.
#
# Lo demás se apaña solo: si publicas en un mes o en un año que todavía
# no existían, la página del archivo de ese año y su enlace en el menú
# se crean al vuelo.

import argparse
import datetime as dt
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

# Los tipos de relato que ya usa el sitio. Es solo la lista que se
# ofrece al preguntar: se puede escribir otro y el listado de relatos
# lo recoge igual (ver scripts/componentes/filtros.js).
TIPOS_RELATO = ["microrelato", "relato corto"]

RAIZ = Path(__file__).resolve().parent.parent
PLANTILLAS = RAIZ / "herramientas" / "plantillas"

MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]
# Cómo escribe la web la fecha en la propia entrada. Tiene que coincidir
# con lo que entiende generar-posts.py al leerla de vuelta.
MESES_CORTOS = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sept", "oct", "nov", "dic",
]

CUERPO_MUESTRA = (
    "Escribe aquí la entrada. Este párrafo está de muestra: bórralo y "
    "cuenta lo que quieras. Para separar párrafos, cada uno va entre "
    "&lt;p&gt; y &lt;/p&gt;."
)


def sin_tildes(texto):
    return "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    )


def nombre_archivo(titulo):
    """'Tarde de mapas' -> 'tarde-de-mapas'."""
    limpio = sin_tildes(titulo).lower().replace("ñ", "n")
    limpio = re.sub(r"[^a-z0-9]+", "-", limpio).strip("-")
    return limpio or "entrada"


def escapar(texto):
    """Para meter texto dentro de un atributo HTML sin romperlo."""
    return (
        texto.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def preguntar(texto, por_defecto=""):
    pista = f" [{por_defecto}]" if por_defecto else ""
    respuesta = input(f"  {texto}{pista}: ").strip()
    return respuesta or por_defecto


def leer_fecha(texto):
    """Acepta dd-mm-aaaa y dd/mm/aaaa. Devuelve una fecha o None."""
    for formato in ("%d-%m-%Y", "%d/%m/%Y"):
        try:
            return dt.datetime.strptime(texto, formato).date()
        except ValueError:
            continue
    return None


def pedir_datos(args):
    hoy = dt.date.today()
    datos = {}

    datos["relato"] = args.relato
    if not args.titulo and not args.relato:
        print("\n  ¿Qué vas a publicar?")
        print("     1. Una entrada del blog")
        print("     2. Un relato")
        datos["relato"] = preguntar("Elige", "1") == "2"

    datos["titulo"] = args.titulo or preguntar("Título")
    while not datos["titulo"]:
        print("     Hace falta un título: de ahí sale el nombre del archivo.")
        datos["titulo"] = preguntar("Título")

    if args.fecha:
        fecha = leer_fecha(args.fecha)
        if not fecha:
            print(f"  No entiendo la fecha {args.fecha!r}. Ponla como dd-mm-aaaa.")
            sys.exit(1)
    else:
        fecha = None
        while not fecha:
            crudo = preguntar("Fecha (dd-mm-aaaa)", hoy.strftime("%d-%m-%Y"))
            fecha = leer_fecha(crudo)
            if not fecha:
                print("     No la entiendo. Ponla como dd-mm-aaaa, por ejemplo 18-09-2026.")
    datos["fecha"] = fecha

    if datos["relato"]:
        # El tipo es lo que filtra la ventana filtros.lst del listado de
        # relatos, y esa ventana se construye con los tipos que
        # encuentra: si escribes uno nuevo, aparece su botón solo.
        datos["subcategoria"] = args.subcategoria
        if not datos["subcategoria"]:
            print("\n  ¿Qué tipo de relato es?")
            for i, tipo in enumerate(TIPOS_RELATO, start=1):
                print(f"     {i}. {tipo}")
            print("     (o escribe un tipo nuevo)")
            elegido = preguntar("Elige", "1")
            try:
                datos["subcategoria"] = TIPOS_RELATO[int(elegido) - 1]
            except (ValueError, IndexError):
                datos["subcategoria"] = elegido
        datos["subcategoria"] = datos["subcategoria"].strip().lower()
        datos["etiquetas"] = []
    else:
        crudas = args.etiquetas if args.etiquetas is not None else preguntar(
            "Etiquetas (diario, opiniones, novedades…)"
        )
        # Se aceptan separadas por espacios o por comas: escribir
        # "diario, testeo" es lo natural y si no se limpia acaba
        # habiendo una etiqueta llamada "diario,".
        datos["etiquetas"] = (
            [e for e in re.split(r"[\s,]+", crudas.strip().lower()) if e]
            if isinstance(crudas, str)
            else list(crudas)
        )
        datos["subcategoria"] = ""

    datos["descripcion"] = args.descripcion or preguntar(
        "Resumen de una línea (sale al compartir el enlace)",
        f"{datos['titulo']} — El Blog de Richi",
    )

    # La imagen de la columna de la derecha. Se puede dejar en blanco: la
    # entrada nace sin ella y la columna se queda solo con "sigue
    # leyendo". Antes salía siempre una de ejemplo (la portada de una
    # aventura de rol) que había que acordarse de quitar.
    datos["imagen"] = args.imagen
    if datos["imagen"] is None:
        datos["imagen"] = preguntar(
            "Imagen de la columna derecha (ruta dentro del sitio, Enter para ninguna)"
        )
    datos["imagen"] = (datos["imagen"] or "").strip()
    datos["alt"] = ""
    datos["pie"] = ""
    if datos["imagen"]:
        if not datos["imagen"].startswith("/"):
            datos["imagen"] = "/imagenes/blog/" + datos["imagen"].lstrip("/")
        datos["alt"] = args.alt if args.alt is not None else preguntar(
            "Descripción de la imagen (Enter si es puro adorno)"
        )
        datos["pie"] = args.pie if args.pie is not None else preguntar(
            "Pie de la imagen (Enter para ninguno)"
        )
    return datos


def destino_de(datos):
    archivo = nombre_archivo(datos["titulo"]) + ".html"
    if datos["relato"]:
        return RAIZ / "web" / "mis_movidas" / "relatos" / archivo
    fecha = datos["fecha"]
    return RAIZ / "web" / "blog" / str(fecha.year) / MESES[fecha.month - 1] / archivo


def bloque_imagen(datos):
    """El <figure> de la columna derecha, o nada si no hay imagen."""
    if not datos.get("imagen"):
        return ""
    clase = "relato-post-aside" if datos["relato"] else "blog-post-aside"
    archivo = RAIZ / datos["imagen"].lstrip("/")
    medidas = ""
    if archivo.is_file():
        try:
            from PIL import Image

            with Image.open(archivo) as im:
                medidas = f' width="{im.size[0]}" height="{im.size[1]}"'
        except Exception:
            # Sin Pillow (o con un archivo raro) se sigue igual: solo se
            # pierde el hueco reservado mientras carga.
            medidas = ""
    else:
        print(f"\n  OJO: no encuentro {datos['imagen']} en el sitio.")
        print("  La entrada se crea igual, pero ahí saldrá un hueco hasta que la subas.")
    pie = (
        f"\n                                <figcaption>{escapar(datos['pie'])}</figcaption>"
        if datos.get("pie")
        else ""
    )
    return (
        f'                            <figure class="{clase}">\n'
        f'                                <img src="{escapar(datos["imagen"])}" '
        f'alt="{escapar(datos.get("alt") or "")}"{medidas} loading="lazy" decoding="async">'
        f"{pie}\n"
        f"                            </figure>\n"
    )


def montar(datos, destino):
    plantilla = PLANTILLAS / ("entrada-relato.html" if datos["relato"] else "entrada-blog.html")
    if not plantilla.is_file():
        print(f"  No encuentro la plantilla {plantilla.relative_to(RAIZ)}.")
        sys.exit(1)

    fecha = datos["fecha"]
    url = "/" + destino.relative_to(RAIZ).as_posix()
    texto = plantilla.read_text(encoding="utf-8")
    texto = texto.replace("{{TITULO}}", escapar(datos["titulo"]))
    texto = texto.replace(
        "{{FECHA}}", f"{fecha.day:02d} {MESES_CORTOS[fecha.month - 1]} {fecha.year}"
    )
    # La misma fecha en formato de máquina (aaaa-mm-dd) para el
    # <time datetime>: es lo que hace que un buscador o un lector de
    # pantalla entiendan que eso es una fecha y no un texto cualquiera.
    texto = texto.replace("{{FECHA_ISO}}", fecha.strftime("%Y-%m-%d"))
    texto = texto.replace("{{URL}}", url)
    texto = texto.replace("{{DESCRIPCION}}", escapar(datos["descripcion"]))
    texto = texto.replace("{{TAGS}}", escapar(" ".join(datos["etiquetas"])))
    texto = texto.replace("{{SUBCATEGORIA}}", escapar(datos["subcategoria"]))
    texto = texto.replace("{{CUERPO}}", CUERPO_MUESTRA)
    # El año del enlace "volver al archivo": estaba escrito a mano en la
    # plantilla y una entrada de enero de 2027 seguía apuntando al
    # archivo de 2026.
    texto = texto.replace("{{ANYO}}", str(fecha.year))
    texto = texto.replace("{{IMAGEN}}", bloque_imagen(datos))

    if "{{" in texto:
        sobran = sorted(set(re.findall(r"\{\{[A-Z_]+\}\}", texto)))
        print(f"  La plantilla tiene marcadores que no sé rellenar: {', '.join(sobran)}")
        sys.exit(1)

    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(texto, encoding="utf-8")
    return url


def pasar_generadores():
    # El orden importa: primero el archivo del año (que crea
    # index_<año>.html y el enlace del menú si es un año o un mes
    # nuevo), luego las cabeceras (para que la página recién creada, y
    # el index_<año>.html si es nuevo, lleven su lista de CSS), luego
    # los listados, y el RSS al final, que lee de ellos.
    for script in ("generar-archivo.py", "actualizar-cabeceras.py",
                   "generar-posts.py", "generar-rss.py"):
        ruta = RAIZ / "herramientas" / script
        if not ruta.is_file():
            continue
        print(f"\n  ---- {script} ----")
        subprocess.run([sys.executable, str(ruta)], cwd=RAIZ, check=False)


def main():
    parser = argparse.ArgumentParser(description="Crea una entrada nueva ya montada.")
    parser.add_argument("--relato", action="store_true", help="es un relato, no una entrada de blog")
    parser.add_argument("--titulo")
    parser.add_argument("--fecha", help="dd-mm-aaaa (por defecto, hoy)")
    parser.add_argument("--etiquetas", help="separadas por espacios o por comas")
    parser.add_argument(
        "--subcategoria", help="solo para relatos: microrelato, relato corto…"
    )
    parser.add_argument("--imagen", help="ruta de la imagen lateral ('' para ninguna)")
    parser.add_argument("--alt", help="descripción de la imagen lateral")
    parser.add_argument("--pie", help="pie de la imagen lateral")
    parser.add_argument("--descripcion")
    args = parser.parse_args()

    print("\n  ENTRADA NUEVA\n")
    datos = pedir_datos(args)
    destino = destino_de(datos)

    if destino.exists():
        print(f"\n  Ya existe {destino.relative_to(RAIZ)} y no la voy a pisar.")
        print("  Si quieres empezar de cero, bórrala tú y vuelve a ejecutar esto.")
        return 1

    url = montar(datos, destino)
    print(f"\n  Creada  {destino.relative_to(RAIZ)}  (de momento, BORRADOR)")
    print(f"  Estará en  https://richi.blog{url}")

    pasar_generadores()

    print("\n  Ya puedes abrir el archivo y escribir. Lo que queda por tu parte:")
    print("     - el texto (hay un párrafo de muestra para borrar)")
    print("     - la imagen de la columna derecha, si no le pusiste ninguna")
    print("       (el hueco está comentado dentro del propio archivo)")
    print("\n  Nace como borrador: la página existe y la puedes mirar en local,")
    print("  pero no sale en los listados ni en el RSS, y arriba se ve una")
    print("  franja avisando. Para verla mientras escribes, levanta el")
    print("  servidor y abre la dirección de arriba en el navegador:")
    print("\n      python3 -m http.server 8000")
    print(f"      http://localhost:8000{url}")
    print("\n  Cuando la tengas lista:")
    print("\n      python3 herramientas/publicar.py")
    print("\n  y ya sí, a subir el sitio a Neocities.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
