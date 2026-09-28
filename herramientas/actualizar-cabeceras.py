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
# TAMBIÉN PONE LA VERSIÓN ANTI-CACHÉ
# ----------------------------------
# El navegador se guarda el CSS y el JS para no volver a pedirlos, así
# que al subir cambios a Neocities quien ya había entrado en la web
# sigue viendo los viejos durante días. Por eso cada archivo va con su
# versión pegada a la dirección:
#
#     <link rel="stylesheet" href="/estilos/base.css?v=8f3a1c2d">
#
# Ese v= son los primeros ocho caracteres de un resumen (sha1) del
# CONTENIDO del archivo, así que cambia solo cuando el archivo cambia
# de verdad: el navegador se vuelve a bajar lo que has tocado y sigue
# usando de su caché todo lo demás.
#
# Esta herramienta escribe ese v= en dos sitios:
#   1. Los <link> del CSS y el <script> del cargador, en cada página.
#   2. La lista VERSIONES de scripts/cargador-scripts.js, que es de
#      donde salen los ?v= de los demás JS y de los fragmentos.
# Los JSON de datos/ no llevan v= a propósito: cambian cada vez que
# publicas algo y se piden con cache: "no-cache" (está explicado en
# cargador-scripts.js).
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
#   - SIEMPRE ANTES DE SUBIR, si has tocado algún CSS o algún JS. Es lo
#     que hace que el cambio se vea en la web sin que nadie tenga que
#     hacer ctrl+F5.
#   - Cuando creas un archivo de CSS nuevo, o borras uno.
#   - Cuando cambias qué páginas usan qué (por ejemplo, si un día la
#     página de accesibilidad pasa a usar portada.css).
#   - Cuando añades un tipo de página que no existía.
# Publicar una entrada o un relato no necesita que te acuerdes:
# nuevo.py y publicar.py la pasan ellos solos (la página nueva
# necesita su bloque de CSS de todas formas). Y subir fotos o añadir
# algo al portfolio tampoco hace falta: eso solo cambia los JSON de
# datos/, que no llevan v= justamente por esto.
#
# NOTA: esta carpeta "herramientas" es solo para ti — no hace falta
# subirla a Neocities.

import hashlib
import re
import sys
from pathlib import Path

from comun import RAIZ, leer_texto, escribir_texto

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
        # El mando "Aa" que agranda el texto: va flotando en una esquina
        # de cualquier página.
        "/estilos/componentes/texto-tamano.css",
    ]

    es_portada = ruta in ("/", "/index.html")
    es_sobre_mi = "/sobre_mi/" in ruta
    es_contacto = "/contacto/" in ruta
    es_blog = "/blog/" in ruta
    es_santuarios = "/santuarios/" in ruta
    es_rol = "/mis_movidas/rol/" in ruta
    es_relatos = "/mis_movidas/relatos/" in ruta
    es_accesibilidad = "/accesibilidad/" in ruta
    es_changelog = "/changelog/" in ruta
    es_mapa = "/mapa/" in ruta
    es_404 = ruta.endswith("/not_found.html")
    # La página de un reto de escritura: vive en una subcarpeta de
    # relatos/ y se llama index_<loquesea>.html. No es una página de
    # lectura (no lleva un texto dentro) ni el listado de relatos.
    es_reto = bool(re.search(r"/mis_movidas/relatos/[^/]+/index_[^/]+\.html$", ruta))

    # Páginas de lectura: una entrada del blog (no el archivo del año ni
    # el diario) o un relato (no su índice). Son las únicas que
    # necesitan los estilos del texto que se escribe dentro.
    es_lectura = (
        (re.search(r"/blog/\d+/", ruta) and not re.search(r"/index_\d+\.html$", ruta))
        or (es_relatos and not ruta.endswith("/index_relatos.html") and not es_reto)
    )

    if es_404:
        # El 404 no lleva barra lateral, así que se corta aquí.
        return hojas + ["/estilos/paginas/no-encontrada.css"]

    if es_lectura:
        hojas.append("/estilos/componentes/texto-entrada.css")
        # El tiempo de lectura y el índice de apartados: los monta
        # scripts/componentes/lectura.js en estas mismas páginas.
        hojas.append("/estilos/componentes/lectura.css")

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
        # El buscador, solo en el archivo del año: es la única página
        # del blog que lleva un listado que filtrar.
        if re.search(r"/index_\d+\.html$", ruta):
            hojas.append("/estilos/componentes/buscador.css")
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
            # relatos, así que va en su propio archivo de componente. El
            # buscador, igual: lo llevan estas dos y el archivo del blog.
            "/estilos/componentes/filtros.css",
            "/estilos/componentes/filtros.responsive.css",
            "/estilos/componentes/buscador.css",
        ]
    elif es_reto:
        # La página del reto no usa nada de relatos.css: es una rejilla
        # de días, no un listado ni un texto.
        hojas += [
            "/estilos/paginas/reto.css",
            "/estilos/paginas/reto.responsive.css",
        ]
    elif es_relatos:
        hojas += [
            "/estilos/paginas/relatos.css",
            "/estilos/paginas/relatos.responsive.css",
        ]
        # Solo el listado lleva filtros; una página de lectura no. Y
        # también la tarjeta del reto, que vive ahí arriba.
        if ruta.endswith("/index_relatos.html"):
            hojas += [
                "/estilos/componentes/filtros.css",
                "/estilos/componentes/filtros.responsive.css",
                "/estilos/componentes/buscador.css",
                "/estilos/paginas/reto.css",
                "/estilos/paginas/reto.responsive.css",
            ]
    elif es_accesibilidad:
        # Sin portada.css: esta página no usa nada de la portada, se
        # dibuja sus propios marcos (ver el comentario de .acc-bloque).
        hojas.append("/estilos/paginas/accesibilidad.css")
    elif es_changelog:
        # Igual que accesibilidad: marcos propios, nada de portada.css.
        hojas.append("/estilos/paginas/changelog.css")
    elif es_mapa:
        hojas += [
            "/estilos/paginas/mapa.css",
            # La tabla se puede filtrar con el mismo buscador que el
            # archivo del blog, los relatos y el portfolio de rol.
            "/estilos/componentes/buscador.css",
        ]

    # El resto de páginas de contenido siempre llevan barra lateral.
    hojas += [
        "/estilos/componentes/barra-lateral.css",
        "/estilos/componentes/barra-lateral.responsive.css",
    ]
    return hojas


# =========================================
# LA VERSIÓN DE CADA ARCHIVO
# =========================================

CARGADOR = "/scripts/cargador-scripts.js"

# Lo que entra en la lista de cargador-scripts.js: lo que el navegador
# pide por su cuenta después de cargar la página. Los JSON de datos/ no
# están (ver la explicación de arriba), y el propio cargador tampoco:
# ese lleva su v= escrito en el <head>, y ponerlo además en su propia
# lista sería una pescadilla mordiéndose la cola (al cambiar la lista
# cambia el archivo, y al cambiar el archivo cambia su resumen).
VERSIONADAS = {
    "scripts": (".js",),
    "fragmentos": (".html",),
}


def version_de(ruta_publica):
    """Resumen corto del contenido, o "" si el archivo no está."""
    archivo = RAIZ / ruta_publica.lstrip("/")
    if not archivo.is_file():
        return ""
    return hashlib.sha1(archivo.read_bytes()).hexdigest()[:8]


def con_version(ruta_publica):
    version = version_de(ruta_publica)
    return f"{ruta_publica}?v={version}" if version else ruta_publica


def rutas_versionadas():
    for carpeta, extensiones in sorted(VERSIONADAS.items()):
        base = RAIZ / carpeta
        if not base.is_dir():
            continue
        for archivo in sorted(base.rglob("*")):
            if not archivo.is_file() or archivo.suffix not in extensiones:
                continue
            ruta = "/" + archivo.relative_to(RAIZ).as_posix()
            if ruta != CARGADOR:
                yield ruta


ABRE_VERSIONES = "        // ==== generado ===="
CIERRA_VERSIONES = "        // ==== fin del generado ===="


def escribir_versiones():
    """Rellena la lista VERSIONES de cargador-scripts.js. Devuelve
    cuántos archivos ha apuntado, o None si no encuentra las marcas."""
    archivo = RAIZ / CARGADOR.lstrip("/")
    texto, crlf = leer_texto(archivo)
    if ABRE_VERSIONES not in texto or CIERRA_VERSIONES not in texto:
        return None

    lineas = [
        f'        "{ruta}": "{version_de(ruta)}",' for ruta in rutas_versionadas()
    ]
    nuevo = "\n".join([ABRE_VERSIONES, *lineas, CIERRA_VERSIONES])
    antes, resto = texto.split(ABRE_VERSIONES, 1)
    _, despues = resto.split(CIERRA_VERSIONES, 1)
    salida = antes + nuevo + despues
    if salida != texto:
        escribir_texto(archivo, salida, crlf)
    return len(lineas)



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
         por medio tardaba ~200 ms más en pintar la página.

         El ?v= de cada uno es el resumen de su contenido: cambia solo
         cuando cambia el archivo, y es lo que hace que al subir a
         Neocities se vea el cambio en vez de la versión guardada en la
         caché del navegador. -->
"""


def bloque(ruta):
    links = "\n".join(
        f'    <link rel="stylesheet" href="{con_version(h)}">' for h in hojas_de(ruta)
    )
    # El cargador de JS se queda: los <script> van con "defer", así que
    # no retrasan el pintado y ahí no se gana nada por escribirlos a
    # mano. Su v= va aquí porque es el único JS que pide el HTML; el de
    # los demás sale de la lista que él mismo lleva dentro.
    scripts = f'    <script src="{con_version(CARGADOR)}"></script>'
    return f"{CABECERA}{links}\n    {CIERRA}\n{scripts}"


# La línea del cargador, con o sin su ?v=: hay que reconocer las dos
# para no dejar de encontrar el bloque justo cuando ya está bien.
LINEA_CARGADOR = (
    r'[ \t]*<script src="/scripts/cargador-scripts\.js(?:\?v=[^"]*)?"></script>'
)

# Lo que había antes de pasar esta herramienta por primera vez: el
# cargador de scripts, el comentario viejo y el cargador de estilos.
VIEJO = re.compile(
    LINEA_CARGADOR + r"\n"
    r'(?:[ \t]*<!-- ==== CSS ==== -->\n)?'
    r'[ \t]*<script src="/scripts/cargador-estilos\.js"></script>'
)

# Lo que hay a partir de la segunda vez.
YA_PUESTO = re.compile(
    r"[ \t]*" + re.escape(ABRE) + r".*?" + re.escape(CIERRA) + r"\n" + LINEA_CARGADOR,
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

    # Primero la lista de versiones y después las páginas: el <head>
    # lleva el v= de cargador-scripts.js, y ese archivo acaba de
    # cambiar al escribirle la lista dentro.
    if not probar:
        cuantas = escribir_versiones()
        if cuantas is None:
            print(
                f"  AVISO: no encuentro las marcas de la lista de versiones en"
                f" {CARGADOR}.\n"
                "         Los CSS llevarán su ?v=, pero los demás JS y los"
                " fragmentos no."
            )
        else:
            print(f"Versiones apuntadas en el cargador: {cuantas} archivo(s).")

    cambiadas, iguales, saltadas = [], [], []
    for archivo, ruta in paginas():
        texto, crlf = leer_texto(archivo)
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
                escribir_texto(archivo, salida, crlf)

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
