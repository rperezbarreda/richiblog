#!/usr/bin/env python3
# =========================================
# ESCRIBE EL BLOQUE DE CSS DE CADA PÁGINA
# =========================================
# Antes había un script (cargador-estilos.js) que, ya dentro del
# navegador, miraba la URL y escribía los <link> del CSS que esa página
# necesitaba. Funcionaba, pero costaba tiempo: el navegador tenía que
# pedir ese script y ejecutarlo ANTES de enterarse siquiera de que
# existía el CSS. Dos viajes de ida y vuelta al servidor antes de poder
# pintar nada, que en un móvil con mala cobertura eran ~200 ms de
# pantalla en blanco.
#
# Ahora los <link> van escritos en el <head> de cada página, así que el
# navegador los ve en cuanto le llega el HTML y los pide de inmediato.
# Los archivos de CSS siguen sueltos, uno por cosa, que es lo que hace
# que a partir de la segunda página casi todo salga de la caché.
#
# Para no tener que acordarse de qué lleva cada página, la lista se
# sigue decidiendo en UN SOLO SITIO: la función "hojas_de()" de aquí
# abajo. Esta herramienta la aplica a todas las páginas de golpe.
#
# CÓMO USARLO
# -----------
# Desde la carpeta raíz del sitio:
#
#     python3 herramientas/actualizar-cabeceras.py
#
# Te dice qué páginas ha cambiado y cuáles ya estaban bien. Si solo
# quieres ver qué haría, sin tocar nada:
#
#     python3 herramientas/actualizar-cabeceras.py --probar
#
# CUÁNDO HAY QUE EJECUTARLO
# -------------------------
#   - Cuando creas un archivo de CSS nuevo, o borras uno.
#   - Cuando cambias qué páginas usan qué (por ejemplo, si un día la
#     página de accesibilidad pasa a usar portada.css).
#   - Cuando añades un tipo de página que no existía.
# En el día a día (publicar una entrada, subir fotos, añadir algo al
# portfolio) NO hace falta: las plantillas ya salen con su bloque
# puesto, y nueva-entrada.py lo pasa solo por si acaso.
#
# NOTA: esta carpeta "herramientas" es solo para ti — no hace falta
# subirla a Neocities.

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# Las plantillas son páginas a medio hacer: no tienen URL propia, así
# que se les dice a mano qué tipo de página van a ser al copiarse.
PLANTILLAS = {
    "herramientas/plantillas/entrada-blog.html": "/web/blog/2026/enero/una-entrada.html",
    "herramientas/plantillas/entrada-relato.html": "/web/mis_movidas/relatos/un-relato.html",
    "herramientas/plantillas/archivo-anyo.html": "/web/blog/2026/index_2026.html",
}

# Carpetas que no son el sitio.
FUERA = {"herramientas", "fragmentos"}


# =========================================
# QUÉ CSS LLEVA CADA PÁGINA
# =========================================
# Esta es la única lista que hay que tocar. El orden importa: se
# escriben en el mismo orden en el <head>, y el de más abajo gana si dos
# dicen cosas distintas sobre lo mismo.

def hojas_de(ruta):
    """ruta es la dirección pública de la página, tal cual sale en la
    barra del navegador: "/index.html", "/web/blog/diario.html"..."""
    hojas = [
        # Base: la necesita cualquier página del sitio.
        "/estilos/base.css",
        "/estilos/base.responsive.css",
        "/estilos/componentes/visor-imagenes.css",
        # El aviso emergente es un componente: va en la base (como el
        # visor) para que cualquier página pueda montar uno sin tener
        # que acordarse de tocar esta lista.
        "/estilos/componentes/aviso.css",
        "/estilos/componentes/aviso.responsive.css",
        # Igual: la cabecera de ventana falsa (−■✕) se usa en tarjetas
        # de casi todas las páginas.
        "/estilos/componentes/cabecera-ventana.css",
        # Botón flotante de "volver arriba": solo se ve en móvil (lo
        # decide el propio CSS), pero lo puede necesitar cualquier
        # página, el 404 incluido.
        "/estilos/componentes/subir.css",
    ]

    es_portada = ruta in ("/", "/index.html")
    es_sobre_mi = "/sobre_mi/" in ruta
    es_contacto = "/contacto/" in ruta
    es_blog = "/blog/" in ruta
    es_santuarios = "/santuarios/" in ruta
    es_rol = "/mis_movidas/rol/" in ruta
    es_relatos = "/mis_movidas/relatos/" in ruta
    es_accesibilidad = "/accesibilidad/" in ruta
    es_404 = ruta.endswith("/not_found.html")

    # Páginas de lectura: una entrada del blog (no el archivo del año ni
    # el diario) o un relato (no su índice). Son las únicas que
    # necesitan los estilos del texto que se escribe dentro.
    es_lectura = (
        (re.search(r"/blog/\d+/", ruta) and not re.search(r"/index_\d+\.html$", ruta))
        or (es_relatos and not ruta.endswith("/index_relatos.html"))
    )

    if es_404:
        # El 404 no lleva barra lateral, así que se corta aquí.
        return hojas + ["/estilos/paginas/no-encontrada.css"]

    if es_lectura:
        hojas.append("/estilos/componentes/texto-entrada.css")

    if es_portada:
        hojas += [
            "/estilos/paginas/portada.css",
            "/estilos/paginas/portada.responsive.css",
            "/estilos/componentes/frases.css",
        ]
    elif es_sobre_mi:
        hojas += [
            "/estilos/paginas/portada.css",
            "/estilos/paginas/sobre-mi.css",
            "/estilos/paginas/sobre-mi.responsive.css",
        ]
    elif es_contacto:
        hojas += [
            "/estilos/paginas/portada.css",
            "/estilos/paginas/contacto.css",
            "/estilos/paginas/contacto.responsive.css",
        ]
    elif es_blog:
        hojas += [
            "/estilos/paginas/blog.css",
            "/estilos/paginas/blog.responsive.css",
        ]
    elif es_santuarios:
        hojas += [
            "/estilos/paginas/santuarios.css",
            "/estilos/paginas/santuarios.responsive.css",
        ]
    elif es_rol:
        hojas += [
            "/estilos/paginas/mis-movidas.css",
            "/estilos/paginas/mis-movidas.responsive.css",
            # La ventana de filtros (filtros.lst) la comparten rol y
            # relatos, así que va en su propio archivo de componente.
            "/estilos/componentes/filtros.css",
            "/estilos/componentes/filtros.responsive.css",
        ]
    elif es_relatos:
        hojas += [
            "/estilos/paginas/relatos.css",
            "/estilos/paginas/relatos.responsive.css",
        ]
        # Solo el listado lleva filtros; una página de lectura no.
        if ruta.endswith("/index_relatos.html"):
            hojas += [
                "/estilos/componentes/filtros.css",
                "/estilos/componentes/filtros.responsive.css",
            ]
    elif es_accesibilidad:
        # Sin portada.css: esta página no usa nada de la portada, se
        # dibuja sus propios marcos (ver el comentario de .acc-bloque).
        hojas.append("/estilos/paginas/accesibilidad.css")

    # El resto de páginas de contenido siempre llevan barra lateral.
    hojas += [
        "/estilos/componentes/barra-lateral.css",
        "/estilos/componentes/barra-lateral.responsive.css",
    ]
    return hojas


# =========================================
# EL BLOQUE QUE SE ESCRIBE EN EL <head>
# =========================================

ABRE = "<!-- ==== CSS ===="
CIERRA = "<!-- ==== fin del CSS ==== -->"

CABECERA = f"""    {ABRE}
         Esta lista la escribe herramientas/actualizar-cabeceras.py.
         No la toques a mano: si cambias qué CSS lleva una página,
         cámbialo en esa herramienta y vuélvela a ejecutar.

         Van escritos aquí, y no cargados por un script, para que el
         navegador los pida nada más recibir el HTML. Con un script de
         por medio tardaba ~200 ms más en pintar la página. -->
"""

# El cargador de JS se queda: los <script> van con "defer", así que no
# retrasan el pintado y ahí no se gana nada por escribirlos a mano.
SCRIPTS = '    <script src="/scripts/cargador-scripts.js"></script>'


def bloque(ruta):
    links = "\n".join(
        f'    <link rel="stylesheet" href="{h}">' for h in hojas_de(ruta)
    )
    return f"{CABECERA}{links}\n    {CIERRA}\n{SCRIPTS}"


# Lo que había antes de pasar esta herramienta por primera vez: el
# cargador de scripts, el comentario viejo y el cargador de estilos.
VIEJO = re.compile(
    r'[ \t]*<script src="/scripts/cargador-scripts\.js"></script>\n'
    r'(?:[ \t]*<!-- ==== CSS ==== -->\n)?'
    r'[ \t]*<script src="/scripts/cargador-estilos\.js"></script>'
)

# Lo que hay a partir de la segunda vez.
YA_PUESTO = re.compile(
    r"[ \t]*" + re.escape(ABRE) + r".*?" + re.escape(CIERRA) + r"\n"
    r'[ \t]*<script src="/scripts/cargador-scripts\.js"></script>',
    re.S,
)


def paginas():
    """Todas las páginas del sitio (con su dirección pública) más las
    plantillas (con el tipo de página que van a ser)."""
    for archivo in sorted(RAIZ.rglob("*.html")):
        rel = archivo.relative_to(RAIZ)
        clave = rel.as_posix()
        if clave in PLANTILLAS:
            yield archivo, PLANTILLAS[clave]
            continue
        if rel.parts[0] in FUERA:
            continue
        yield archivo, "/" + clave


def main():
    probar = "--probar" in sys.argv

    cambiadas, iguales, saltadas = [], [], []
    for archivo, ruta in paginas():
        texto = archivo.read_text(encoding="utf-8")
        nuevo = bloque(ruta)

        # Las dos expresiones se tragan la sangría de la primera línea,
        # así que el bloque nuevo se pone entero, con la suya.
        if YA_PUESTO.search(texto):
            salida = YA_PUESTO.sub(lambda m: nuevo, texto, count=1)
        elif VIEJO.search(texto):
            salida = VIEJO.sub(lambda m: nuevo, texto, count=1)
        else:
            # Un fragmento suelto (barra-lateral.html, frases.html) o
            # algo que no es una página completa: ni se toca.
            saltadas.append(archivo.relative_to(RAIZ).as_posix())
            continue

        if salida == texto:
            iguales.append(archivo.relative_to(RAIZ).as_posix())
        else:
            cambiadas.append(
                (archivo.relative_to(RAIZ).as_posix(), len(hojas_de(ruta)))
            )
            if not probar:
                archivo.write_text(salida, encoding="utf-8")

    if cambiadas:
        print("Actualizadas:" if not probar else "Se actualizarían:")
        for nombre, cuantas in cambiadas:
            print(f"  {nombre}  ({cuantas} hojas de estilo)")
    if iguales:
        print(f"Ya estaban al día: {len(iguales)} página(s).")
    if saltadas:
        print(f"Sin cabecera (no son páginas completas): {', '.join(saltadas)}")
    if not cambiadas and not iguales:
        print("No he encontrado ninguna página. ¿Estás en la carpeta raíz?")
        sys.exit(1)


if __name__ == "__main__":
    main()
