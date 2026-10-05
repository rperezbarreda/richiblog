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
    "herramientas/plantillas/sesion-rol.html": "/web/notas_rol/ragna/sesion-99.html",
    "herramientas/plantillas/campana-rol.html": "/web/notas_rol/ragna/index_ragna.html",
}

# Carpetas que no son el sitio.
FUERA = {"herramientas", "fragmentos"}


# =========================================
# QUÉ CSS LLEVA CADA PÁGINA
# =========================================
# Esta es la única lista que hay que tocar. El orden importa: se
# escriben en el mismo orden en el <head>, y el de más abajo gana si dos
# dicen cosas distintas sobre lo mismo.

# Hojas que van al FINAL de la lista de cualquier página, después de las
# de su sección. Cuando dos reglas pesan lo mismo gana la que se carga
# después, así que aquí abajo va lo que tiene que poder con lo que haya
# puesto cualquier página.
#
# Por ahora solo las ventanas que se plieguen: plegar una consiste en
# esconder todo lo que no sea su barra de título, y eso tiene que ganarle
# al display (flex, grid, block...) que su página le haya dado a esos
# trozos. Así se consigue sin inflar los selectores ni usar !important,
# que en esta web no aparece en ningún archivo.
ULTIMAS = [
    "/estilos/componentes/ventanas-plegables.css",
    # Cómo sale la web en papel. Va aquí abajo porque tiene que poder
    # con el estilo de cualquier página: en papel se quita el menú, los
    # botones y los fondos, salga de donde salga.
    "/estilos/componentes/impresion.css",
    # Y lo último de lo último: el mando de "dejarlo todo quieto". Tiene
    # que poder parar CUALQUIER animación o transición de cualquier
    # página, así que estando al final le gana a todas sin tener que
    # inflar sus selectores ni usar !important.
    "/estilos/componentes/sin-movimiento.css",
]


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
        # El botón "Aa" que abre la ventana de accesibilidad: va
        # flotando en una esquina de cualquier página.
        "/estilos/componentes/ajustes.css",
    ]

    es_portada = ruta in ("/", "/index.html")
    es_sobre_mi = "/sobre_mi/" in ruta
    es_contacto = "/contacto/" in ruta
    es_blog = "/blog/" in ruta
    es_santuarios = "/santuarios/" in ruta
    es_rol = "/mis_movidas/rol/" in ruta
    es_relatos = "/mis_movidas/relatos/" in ruta
    # Las notas de las partidas de rol: el índice de una campaña y las
    # notas de cada partida. Las dos llevan la misma hoja, así que aquí no
    # hace falta distinguirlas (en scripts_de sí: el JavaScript solo lo
    # necesita el índice).
    es_notas_rol = "/notas_rol/" in ruta
    es_accesibilidad = "/accesibilidad/" in ruta
    es_changelog = "/changelog/" in ruta
    es_mapa = "/mapa/" in ruta
    es_buscar = "/buscar/" in ruta
    es_recomendaciones = "/recomendaciones/" in ruta
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
        return hojas + ["/estilos/paginas/no-encontrada.css"] + ULTIMAS

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
    elif es_notas_rol:
        # Las dos páginas de una campaña (su índice y las notas de cada
        # partida) comparten hoja: tienen la mitad de las piezas en común
        # y separarlas serían dos archivos de 200 líneas con lo mismo
        # dentro. Nada de relatos.css ni de texto-entrada.css: las hojas
        # del cuaderno se dibujan solas, con sus propios renglones.
        hojas += [
            "/estilos/paginas/notas-rol.css",
            "/estilos/paginas/notas-rol.responsive.css",
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
    elif es_recomendaciones:
        # Igual que accesibilidad o el changelog: marcos propios, nada
        # de portada.css. Y el filtro de categorías, el mismo que el
        # portfolio de rol y el listado de relatos.
        hojas += [
            "/estilos/paginas/recomendaciones.css",
            "/estilos/componentes/filtros.css",
            "/estilos/componentes/filtros.responsive.css",
        ]
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
        # La lupa del menú y su ventana de buscar viven dentro de esa
        # barra, así que van con ella. Aquí abajo y no en la base porque
        # el 404 se sale antes: no tiene menú, y cargarle estos estilos
        # sería pedirle 3 KB para nada.
        "/estilos/paginas/buscar.css",
    ]
    return hojas + ULTIMAS


# =========================================
# QUÉ JS LLEVA CADA PÁGINA
# =========================================
# Esta lista vivía dentro de scripts/cargador-scripts.js: ese archivo
# miraba la URL ya dentro del navegador y escribía los <script> que
# tocaban. Funcionaba, pero costaba caro y por la misma razón que costó
# el CSS en su día: el navegador no se entera de que existen esos
# scripts hasta que ha pedido el cargador y lo ha ejecutado.
#
# Medido con la red frenada (3G rápido, 150 ms de ida y vuelta) y el
# móvil haciendo como que va lento:
#
#   - Los scripts de la página no empezaban a pedirse hasta los 814 ms.
#     Escritos aquí se piden a los 190, con el CSS.
#   - La barra lateral tardaba 1,5 s en aparecer, porque su archivo
#     (barra-lateral.js) era uno de esos y encima tiene que pedir
#     después el trozo de HTML.
#
# "defer" no retrasa el pintado, que era el argumento de antes, pero sí
# retrasa TODO lo demás: el menú, los botones de las ventanas, el mando
# de accesibilidad. Esos 600 ms se notan.
#
# El orden importa y es el mismo de antes: unos cuantos scripts esperan
# a que otro haya montado algo (los −■✕ antes de plegar, el buscador
# antes del listado que avisa). Los comentarios de cada tramo explican
# cuál y por qué.
#
# De paso se arregla un apaño: el cargador tenía que adivinar el tipo de
# página quitándole el ".html" a la URL, porque Neocities sirve las
# páginas con y sin extensión y por el camino se quedaba alguna sin su
# JS. Aquí eso no puede pasar: cada página lleva escrito el suyo.


def scripts_de(ruta):
    """Igual que hojas_de(), pero con el JS. "ruta" es la dirección
    pública de la página: "/index.html", "/web/blog/diario.html"..."""
    # Sin ".html" ni barra final, que es como se escribían las
    # comprobaciones cuando esto vivía en el navegador.
    camino = re.sub(r"\.html$", "", ruta).rstrip("/") or "/"

    es_portada = camino in ("/", "/index")
    es_sobre_mi = "/sobre_mi/" in camino
    es_contacto = "/contacto/" in camino
    es_archivo_blog = bool(re.search(r"/blog/\d+/index_\d+$", camino))
    es_diario = camino.endswith("/blog/diario")
    es_rol = "/mis_movidas/rol/" in camino
    es_lista_relatos = camino.endswith("/mis_movidas/relatos/index_relatos")
    # La página de un reto de escritura: una subcarpeta de relatos/ con
    # su propio index_. Se mira ANTES que es_lectura, que si no se la
    # traga (está dentro de relatos/ y no es el listado).
    es_reto = bool(re.search(r"/mis_movidas/relatos/[^/]+/index_[^/]+$", camino))
    # El índice de una campaña de rol: ahí se pinta la ficha y la lista de
    # sesiones. Las notas de una partida son HTML escrito a mano y no
    # necesitan ningún script propio.
    es_campana_rol = bool(re.search(r"/notas_rol/[^/]+/index_[^/]+$", camino))
    # Y las notas de una partida: ahí el script pliega las escenas y
    # marca las cosas pendientes. La página funciona sin él —las escenas
    # las pliega el navegador solo, que son <details>—, pero con él se
    # pueden plegar todas de golpe y marcar las casillas.
    es_sesion_rol = "/notas_rol/" in camino and not es_campana_rol
    # Solo las fichas de cada gato: el índice de santuarios no tiene
    # galería.
    es_ficha_santuario = bool(re.search(r"/santuarios/[^/]+/[^/]+$", camino))
    es_404 = camino.endswith("/not_found")
    es_changelog = "/changelog/" in camino
    es_mapa = "/mapa/" in camino
    es_buscar = "/buscar/" in camino
    es_recomendaciones = "/recomendaciones/" in camino
    # Páginas de lectura: una entrada del blog (no el archivo del año)
    # o un relato (no su índice). Ahí va la ventana de "sigue leyendo".
    es_lectura = bool(
        (re.search(r"/blog/\d+/", camino) and not es_archivo_blog)
        or (
            "/mis_movidas/relatos/" in camino
            and not es_lista_relatos
            and not es_reto
        )
    )

    if es_404:
        # El 404 no lleva barra lateral ni componentes de navegación.
        return [
            "/scripts/componentes/botones-ventana.js",
            # Después de botones-ventana.js: este monta el mando de
            # plegar sobre las barras de título, y los −■✕ de dentro los
            # pone el otro. En el 404 la ventanita del gatete ASCII
            # también se pliega; los −■✕ grandes de la pantalla entera
            # no, que esos no tienen barra (siguen soltando brillos).
            "/scripts/componentes/ventanas-plegables.js",
            "/scripts/componentes/rastro-cursor.js",
            "/scripts/componentes/chispas-botones.js",
            "/scripts/componentes/enlaces-fuera.js",
            "/scripts/componentes/subir.js",
            "/scripts/componentes/teclado-scroll.js",
        ]

    # Base: la necesita cualquier página de contenido del sitio.
    js = [
        "/scripts/componentes/cargador-fragmentos.js",
        "/scripts/componentes/barra-lateral.js",
        # Vive dentro de la barra lateral, así que lo lleva cualquier
        # página que la tenga (el 404 sale antes, arriba).
        "/scripts/componentes/gatin-random.js",
        "/scripts/tema.js",
        # La ventana de accesibilidad, que es donde viven el tamaño del
        # texto, la separación entre líneas, la letra, el tema, la voz y
        # los efectos. Su HTML va con el resto del armazón, en
        # fragmentos/barra-lateral.html, así que lo lleva cualquier
        # página que tenga barra lateral. En el 404, que no la tiene, no
        # sale el mando, pero lo que se haya elegido se respeta igual
        # (lo pone cargador-scripts.js).
        "/scripts/componentes/ajustes.js",
        # La lupa del final del menú, que abre la ventana de buscar. Va
        # en la base porque la barra lateral está en todas las páginas de
        # contenido (el 404 sale antes, arriba, y no tiene menú).
        "/scripts/componentes/buscar-lupa.js",
        "/scripts/componentes/botones-ventana.js",
        # El − y el ■ de las barras de título, que ya plegan la ventana
        # de verdad. Va en la base porque esas barras están en casi
        # todas las páginas, y después de botones-ventana.js, que es
        # quien pone los cuadraditos que este engancha.
        "/scripts/componentes/ventanas-plegables.js",
        "/scripts/componentes/rastro-cursor.js",
        "/scripts/componentes/chispas-botones.js",
        # Marca los enlaces que llevan fuera de la web. Va en la base
        # porque hay enlaces de ésos en media docena de páginas.
        "/scripts/componentes/enlaces-fuera.js",
        "/scripts/componentes/visor-imagenes.js",
        # Igual que el visor: va en la base para que cualquier página
        # pueda montar un aviso emergente sin tocar esta lista.
        "/scripts/componentes/aviso.js",
        "/scripts/componentes/subir.js",
        # Sin esto la página no se mueve con el teclado: ver el
        # comentario de arriba del propio archivo.
        "/scripts/componentes/teclado-scroll.js",
    ]

    if es_portada:
        js += [
            "/scripts/componentes/frases.js",
            # Antes que los dos que pintan las ventanas: ellos le
            # llaman en cuanto tienen la lista puesta, y si no está
            # cargado se la saltan y los títulos se quedan enteros.
            "/scripts/componentes/recortar-titulos.js",
            "/scripts/paginas/entradas-blog.js",
            "/scripts/paginas/novedades.js",
        ]
    elif es_sobre_mi:
        js.append("/scripts/paginas/sobre-mi.js")
    elif es_contacto:
        # Antes que guestbook.js: le da el cuadro de texto con formato y
        # el pintado seguro de los mensajes.
        js += [
            "/scripts/paginas/guestbook-texto.js",
            "/scripts/paginas/guestbook.js",
        ]
    elif es_archivo_blog:
        # Antes que entradas-blog.js: cuando el archivo termina de
        # pintarse le pide al buscador que aplique lo que venga en
        # ?buscar=, así que tiene que estar ya cargado.
        js += [
            "/scripts/componentes/buscador.js",
            "/scripts/paginas/entradas-blog.js",
        ]
    elif es_diario:
        js.append("/scripts/paginas/diario.js")
    elif es_rol:
        # Antes que rol.js, igual que en relatos: así los componentes ya
        # están escuchando cuando el portfolio termina de pintarse y
        # avisa de que hay categorías nuevas que contar.
        js += [
            "/scripts/componentes/buscador.js",
            "/scripts/componentes/filtros.js",
            "/scripts/paginas/rol.js",
        ]
    elif es_lista_relatos:
        js += [
            "/scripts/componentes/buscador.js",
            "/scripts/componentes/filtros.js",
            "/scripts/paginas/relatos.js",
            # La tarjeta del reto que va encima del listado.
            "/scripts/paginas/reto.js",
        ]
    elif es_reto:
        js.append("/scripts/paginas/reto.js")
    elif es_campana_rol:
        js.append("/scripts/paginas/notas-rol.js")
    elif es_sesion_rol:
        js.append("/scripts/paginas/cuaderno.js")
    elif es_lectura:
        # Antes que otras-entradas.js: ese avisa con la ficha de esta
        # entrada en cuanto le llega el listado, y lectura.js tiene que
        # estar ya escuchando.
        js.append("/scripts/componentes/lectura.js")
        # Después de lectura.js: el botón de escuchar se cuelga del
        # "4 min" que pinta ese, y si no lo encuentra se queda esperando
        # al aviso de que ya está puesto.
        js.append("/scripts/componentes/leer-en-voz.js")
        js.append("/scripts/paginas/otras-entradas.js")
    elif es_ficha_santuario:
        js.append("/scripts/paginas/santuarios.js")
    elif es_changelog:
        js.append("/scripts/paginas/changelog.js")
    elif es_recomendaciones:
        # Antes que recomendaciones.js: así el filtro ya está escuchando
        # cuando la página termina de pintar las ventanitas y avisa de
        # que hay categorías que contar.
        js += [
            "/scripts/componentes/filtros.js",
            "/scripts/paginas/recomendaciones.js",
        ]
    elif es_buscar:
        # La página de buscar en toda la web. No lleva el buscador de los
        # listados: aquel filtra lo que ya está en pantalla y éste busca
        # en un listado aparte con el texto de todo.
        js.append("/scripts/paginas/buscar.js")
    elif es_mapa:
        # Antes que mapa.js, como en el archivo del blog: la tabla se
        # pinta sola cuando llega el JSON y ahí mismo le pide al buscador
        # que aplique lo que venga en ?buscar=.
        js += [
            "/scripts/componentes/buscador.js",
            "/scripts/paginas/mapa.js",
        ]

    return js


# =========================================
# LA VERSIÓN DE CADA ARCHIVO
# =========================================

CARGADOR = "/scripts/cargador-scripts.js"

# Lo que entra en la lista de cargador-scripts.js: lo que el navegador
# pide por su cuenta después de cargar la página. Hoy son solo los
# fragmentos de HTML (la barra lateral y las frases), que se piden con
# fetch() desde el propio navegador.
#
# El JS ya no está aquí: desde que cada página lleva sus <script>
# escritos en el <head>, su ?v= lo pone esta misma herramienta al
# escribirlos, igual que el del CSS. La lista pasó de 40 líneas a dos, y
# eso se nota: cargador-scripts.js es lo único que bloquea el pintado.
#
# Los JSON de datos/ tampoco están (ver la explicación de arriba).
VERSIONADAS = {
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


ABRE_JS = "<!-- ==== JS ===="
CIERRA_JS = "<!-- ==== fin del JS ==== -->"

CABECERA_JS = f"""    {ABRE_JS}
         Esta lista también la escribe la herramienta, a partir de
         scripts_de(). No la toques a mano.

         Todos van con "defer": se bajan mientras el navegador lee el
         HTML, no retrasan el pintado y se ejecutan al final, en este
         mismo orden, que en unos cuantos casos importa.

         Están escritos aquí y no los pide un script, por lo mismo que
         el CSS: así el navegador los descubre en cuanto le llega el
         HTML. Pidiéndolos desde el cargador no empezaban a bajarse
         hasta 600 ms después, y con ellos se retrasaba todo lo que se
         puede tocar (el menú el que más). -->
"""


BARRA_LATERAL = "/fragmentos/barra-lateral.html"

ADELANTO = """    <!-- El menú, pedido LO PRIMERO. No está escrito en el HTML de cada
         página: vive en fragmentos/barra-lateral.html y lo pide
         scripts/componentes/barra-lateral.js, que va con defer y por
         tanto no corre hasta que el navegador ha terminado de leer la
         página. Medido con la red frenada, el menú no aparecía hasta
         1,5 s: el HTML tardaba 190 ms, los scripts se ejecutaban sobre
         los 1000 y solo entonces empezaba el viaje a por el trozo.

         Esta línea lo pide aquí mismo, antes incluso que el CSS, y
         guarda la promesa. Cuando barra-lateral.js arranca no empieza
         ningún viaje: se sube al que ya iba. El menú pasó a estar a los
         786 ms, la mitad.

         Va escrita a pelo y no en un archivo aparte a propósito: un
         archivo aparte habría que pedirlo, y pedirlo es justo lo que se
         está intentando no hacer. Si algo falla se queda sin adelanto y
         loadComponent() lo pide como siempre. -->
    <script>window.adelantoDeFragmentos={};try{window.adelantoDeFragmentos["%s"]=fetch("%s").then(function(r){return r.ok?r.text():null}).catch(function(){return null})}catch(e){}</script>
"""


def bloque(ruta):
    links = "\n".join(
        f'    <link rel="stylesheet" href="{con_version(h)}">' for h in hojas_de(ruta)
    )
    # El cargador va SIN defer y antes que los demás: es quien pone el
    # tamaño del texto, la letra y el filtro CRT antes del primer
    # pintado, y quien deja preparado window.conVersion() para los que
    # vienen detrás.
    cargador = f'    <script src="{con_version(CARGADOR)}"></script>'
    defer = "\n".join(
        f'    <script defer src="{con_version(s)}"></script>'
        for s in scripts_de(ruta)
    )
    # El 404 no lleva barra lateral: ahí no hay nada que adelantar.
    adelanto = ""
    if "/scripts/componentes/barra-lateral.js" in scripts_de(ruta):
        adelanto = ADELANTO % (BARRA_LATERAL, con_version(BARRA_LATERAL))

    return (
        f"{adelanto}{CABECERA}{links}\n    {CIERRA}\n{cargador}\n"
        f"{CABECERA_JS}{defer}\n    {CIERRA_JS}"
    )


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

# Lo que hay a partir de la segunda vez. El bloque del JS va con "?":
# las páginas que todavía no lo tengan (la primera vez que se pasa la
# herramienta después de este cambio) se reconocen igual y lo reciben.
YA_PUESTO = re.compile(
    # El adelanto del menú, si ya está puesto: va delante del CSS y
    # también hay que sustituirlo (su ?v= cambia al tocar el fragmento).
    r"(?:[ \t]*<!-- El menú, pedido LO PRIMERO\..*?</script>\n)?"
    r"[ \t]*" + re.escape(ABRE) + r".*?" + re.escape(CIERRA) + r"\n" + LINEA_CARGADOR
    + r"(?:\n[ \t]*" + re.escape(ABRE_JS) + r".*?" + re.escape(CIERRA_JS) + r")?",
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
