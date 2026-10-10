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
#     python3 herramientas/3-generadores/actualizar-cabeceras.py
#
# Te dice qué páginas ha cambiado y cuáles ya estaban bien. Si solo
# quieres ver qué haría, sin tocar nada:
#
#     python3 herramientas/3-generadores/actualizar-cabeceras.py --probar
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

import sys
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import hashlib
import re

from comun import RAIZ, leer_texto, escribir_texto

# Las plantillas son páginas a medio hacer: no tienen URL propia, así
# que se les dice a mano qué tipo de página van a ser al copiarse.
PLANTILLAS = {
    "herramientas/plantillas/entrada-blog.html": "/web/blog/2026/enero/una-entrada.html",
    "herramientas/plantillas/entrada-relato.html": "/web/mis_movidas/relatos/un-relato.html",
    "herramientas/plantillas/archivo-anyo.html": "/web/blog/2026/index_2026.html",
    "herramientas/plantillas/sesion-rol.html": "/web/notas_rol/ragna/sesion-99.html",
    "herramientas/plantillas/npcs-rol.html": "/web/notas_rol/ragna/npcs_ragna.html",
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
    # La página de npcs de una campaña: la rejilla de tokens. Lleva lo
    # de las notas de rol MÁS su propia hoja y la de los filtros, que son
    # los mismos botones del archivo del blog y del portfolio.
    es_npcs_rol = bool(re.search(r"/notas_rol/[^/]+/npcs_[^/]+\.html$", ruta))
    # El índice de una campaña: la ficha, el botín y las misiones. Lleva
    # el papel del post-it (las misiones) y la ventana que se abre encima.
    es_campana_rol = bool(re.search(r"/notas_rol/[^/]+/index_[^/]+\.html$", ruta))
    # Las notas de una partida: lo que NO es el índice de la campaña ni el
    # la página de npcs. Son las únicas que llevan post-it.
    es_sesion_rol = (
        es_notas_rol
        and not es_npcs_rol
        and not re.search(r"/notas_rol/[^/]+/index_[^/]+\.html$", ruta)
    )
    es_accesibilidad = "/accesibilidad/" in ruta
    es_changelog = "/changelog/" in ruta
    es_mapa = "/mapa/" in ruta
    es_buscar = "/buscar/" in ruta
    es_recomendaciones = "/recomendaciones/" in ruta
    # "En lo que ando": cuatro bloques y uno de ellos es el post-it de los
    # pendientes, el mismo que el de las notas de una partida. De ahí que
    # lleve el componente del post-it sin ser una página de rol.
    es_ando = "/en_lo_que_ando/" in ruta
    # La wiki del mundo. Son TRES páginas distintas: la portada, que lleva
    # buscador y filtros; cada artículo, que no lleva ninguno de los dos; y
    # cada mapa, que lleva lo suyo (el zoom, las capas y el dibujo).
    es_mundo = "/web/wiki/" in ruta
    es_mundo_indice = ruta.endswith("/wiki/index_wiki.html")
    es_mundo_mapa = bool(re.search(r"/wiki/mapa_[^/]+\.html$", ruta))
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
        hojas += ["/estilos/paginas/notas-rol.css"]
        # El post-it va entre las dos, exactamente donde estaba cuando
        # vivía dentro de notas-rol.css: el responsive lo pisa en el móvil
        # (le quita el giro), así que tiene que cargarse después.
        #
        # Lo llevan las notas de una partida (la nota de cosas pendientes
        # que va al lado del cuaderno) y el índice de la campaña, que usa
        # el mismo papel amarillo para la ventana de las misiones.
        if es_sesion_rol or es_campana_rol:
            hojas += ["/estilos/componentes/postit.css"]
        hojas += ["/estilos/paginas/notas-rol.responsive.css"]
        # La ventana que se abre encima: la ficha de un NPC en la página de
        # npcs, y la ficha de un personaje, el botín y las misiones en el
        # índice de la campaña. Las notas de una partida no abren ninguna,
        # así que no la llevan.
        #
        # Y la lupa, que es la imagen a pantalla completa: el retrato de un
        # NPC y las fotos de los objetos del botín.
        if not es_sesion_rol:
            hojas += [
                "/estilos/componentes/ventana-modal.css",
                "/estilos/componentes/ventana-modal.responsive.css",
                "/estilos/componentes/lupa.css",
            ]
        if es_npcs_rol:
            hojas += [
                "/estilos/paginas/npcs-rol.css",
                "/estilos/paginas/npcs-rol.responsive.css",
                "/estilos/componentes/filtros.css",
                "/estilos/componentes/filtros.responsive.css",
                # El buscador de la rejilla, el mismo que el archivo del
                # blog, los relatos y el portfolio.
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
    elif es_recomendaciones:
        # Igual que accesibilidad o el changelog: marcos propios, nada
        # de portada.css. Y el filtro de categorías, el mismo que el
        # portfolio de rol y el listado de relatos.
        hojas += [
            "/estilos/paginas/recomendaciones.css",
            "/estilos/componentes/filtros.css",
            "/estilos/componentes/filtros.responsive.css",
        ]
    elif es_mundo:
        # Marcos propios, como el changelog o las recomendaciones.
        hojas += ["/estilos/paginas/mundo.css"]
        if es_mundo_indice:
            hojas += [
                "/estilos/componentes/filtros.css",
                "/estilos/componentes/filtros.responsive.css",
                "/estilos/componentes/buscador.css",
            ]
        if es_mundo_mapa:
            hojas += ["/estilos/paginas/mundo-mapa.css"]
        hojas += ["/estilos/paginas/mundo.responsive.css"]
        if es_mundo_mapa:
            hojas += ["/estilos/paginas/mundo-mapa.responsive.css"]
    elif es_ando:
        # Marcos propios, como el changelog o las recomendaciones. Y el
        # post-it, que aquí es un bloque más de la rejilla.
        hojas += [
            "/estilos/paginas/en-lo-que-ando.css",
            "/estilos/componentes/postit.css",
            "/estilos/paginas/en-lo-que-ando.responsive.css",
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
    # La página de npcs: se mira ANTES que las notas de una partida,
    # que si no se lo traga (está dentro de notas_rol/ y no es el índice)
    # y acabaría cargando el script del cuaderno, que allí no pinta nada.
    es_npcs_rol = bool(re.search(r"/notas_rol/[^/]+/npcs_[^/]+$", camino))
    es_sesion_rol = ("/notas_rol/" in camino and not es_campana_rol
                     and not es_npcs_rol)
    # Solo las fichas de cada gato: el índice de santuarios no tiene
    # galería.
    es_ficha_santuario = bool(re.search(r"/santuarios/[^/]+/[^/]+$", camino))
    es_404 = camino.endswith("/not_found")
    es_changelog = "/changelog/" in camino
    es_mapa = "/mapa/" in camino
    es_buscar = "/buscar/" in camino
    es_recomendaciones = "/recomendaciones/" in camino
    es_ando = "/en_lo_que_ando/" in camino
    es_mundo = "/web/wiki/" in camino
    es_mundo_indice = camino.endswith("/wiki/index_wiki")
    es_mundo_mapa = bool(re.search(r"/wiki/mapa_[^/]+$", camino))
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
        # ventana-modal.js antes: de ahí salen la ficha de un personaje,
        # el botín y las misiones. Y lupa.js, que es la foto de un objeto
        # del botín a pantalla completa.
        js += [
            "/scripts/componentes/ventana-modal.js",
            "/scripts/componentes/lupa.js",
            "/scripts/paginas/notas-rol.js",
        ]
    elif es_npcs_rol:
        # buscador.js y filtros.js antes que el de la página, y en ese
        # orden (el mismo que en los relatos y el portfolio): el filtro le
        # pregunta al buscador si cada token pasa, y los dos tienen que
        # estar escuchando cuando el reparto termina de pintarse y avisa.
        # ventana-modal.js antes también: es quien abre la ficha.
        js += [
            "/scripts/componentes/buscador.js",
            "/scripts/componentes/filtros.js",
            "/scripts/componentes/ventana-modal.js",
            # Y la lupa: el retrato de la ficha a pantalla completa.
            "/scripts/componentes/lupa.js",
            "/scripts/paginas/npcs-rol.js",
        ]
    elif es_sesion_rol:
        # tareas.js antes: monta las casillas de las cosas pendientes, y
        # cuaderno.js no depende de ellas pero sí al revés (el botón de
        # plegar se cuela en la misma barra).
        js += [
            "/scripts/componentes/tareas.js",
            "/scripts/paginas/cuaderno.js",
        ]
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
    elif es_mundo:
        # La portada lleva el índice, el buscador y los filtros; un
        # artículo solo necesita lo de los spoilers, que está en el mismo
        # archivo y no hace nada si no hay ninguno.
        #
        # Un MAPA no lleva mundo.js: no tiene índice que pintar ni
        # spoilers que destapar, y lo suyo está en mundo-mapa.js.
        if es_mundo_mapa:
            js.append("/scripts/paginas/mundo-mapa.js")
        else:
            if es_mundo_indice:
                js += [
                    "/scripts/componentes/buscador.js",
                    "/scripts/componentes/filtros.js",
                ]
            js.append("/scripts/paginas/mundo.js")
    elif es_ando:
        # tareas.js ANTES que el de la página: ése pinta la lista de
        # pendientes cuando le llega el JSON y ahí mismo avisa
        # (tareas:actualizar) para que le pongan las casillas. Si llegara
        # después, no habría nadie escuchando ese aviso.
        js += [
            "/scripts/componentes/tareas.js",
            "/scripts/paginas/en-lo-que-ando.js",
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
# LOS PAQUETES
# =========================================
# Hay once hojas de estilo y quince scripts que lleva LA MISMA página,
# todas: la base, el aviso, la ventana de ajustes, la barra lateral... En
# la cabecera eso eran veintiséis líneas iguales en los 38 archivos, y
# veintiséis viajes del navegador.
#
# Así que se juntan: la herramienta escribe tres archivos pegando los de
# dentro, y en la cabecera va uno en vez de once.
#
# POR QUÉ TRES Y NO UNO SOLO
# --------------------------
# Porque el ORDEN del CSS decide quién gana: en esta web hay unas cuantas
# reglas que se apoyan en cargarse después de otra (la regla de "nav" de
# la barra lateral, los "[hidden]" de las notas de rol...). Los comunes no
# van todos seguidos: ocho van SIEMPRE antes de la hoja de la página y
# tres SIEMPRE después. Si se juntaran en uno, esos tres adelantarían a la
# hoja de la página y cambiaría lo que se ve. Son dos paquetes porque son
# dos sitios distintos de la cascada.
#
# Y POR QUÉ NO UN PAQUETE POR PÁGINA
# ----------------------------------
# Medido: hay 19 combinaciones distintas de CSS para 31 páginas, así que
# serían 19 paquetes de ~200 KB (3,8 MB) y cada página se bajaría el suyo
# entero en vez de reaprovechar la base que ya tenía de la anterior.
# Juntar solo lo común deja la caché compartida intacta.
#
# SI AÑADES O QUITAS ALGO de estas listas, hay que cambiarlo también en
# hojas_de() o scripts_de(): el paquete es lo que se pide, pero esas
# funciones siguen siendo las que dicen qué lleva cada página. La
# herramienta avisa si no cuadran.
#
# UNA PÁGINA QUE NO LOS LLEVE TODOS SEGUIDOS se queda con sus archivos
# sueltos y no pasa nada: es lo que le ocurre al 404, que no lleva ni
# barra lateral ni tema.

PAQUETES = (
    (
        "/estilos/paquete-comun.css",
        [
            "/estilos/base.css",
            "/estilos/base.responsive.css",
            "/estilos/componentes/visor-imagenes.css",
            "/estilos/componentes/aviso.css",
            "/estilos/componentes/aviso.responsive.css",
            "/estilos/componentes/cabecera-ventana.css",
            "/estilos/componentes/subir.css",
            "/estilos/componentes/ajustes.css",
        ],
    ),
    (
        "/estilos/paquete-cierre.css",
        [
            "/estilos/componentes/ventanas-plegables.css",
            "/estilos/componentes/impresion.css",
            "/estilos/componentes/sin-movimiento.css",
        ],
    ),
    (
        "/scripts/paquete-comun.js",
        [
            "/scripts/componentes/cargador-fragmentos.js",
            "/scripts/componentes/barra-lateral.js",
            "/scripts/componentes/gatin-random.js",
            "/scripts/tema.js",
            "/scripts/componentes/ajustes.js",
            "/scripts/componentes/buscar-lupa.js",
            "/scripts/componentes/botones-ventana.js",
            "/scripts/componentes/ventanas-plegables.js",
            "/scripts/componentes/rastro-cursor.js",
            "/scripts/componentes/chispas-botones.js",
            "/scripts/componentes/enlaces-fuera.js",
            "/scripts/componentes/visor-imagenes.js",
            "/scripts/componentes/aviso.js",
            "/scripts/componentes/subir.js",
            "/scripts/componentes/teclado-scroll.js",
        ],
    ),
)


def escribir_paquetes(probar=False):
    """Escribe los tres paquetes pegando sus archivos. Devuelve los que
    ha tenido que reescribir."""
    rehechos = []
    for destino, miembros in PAQUETES:
        trozos = [
            "/* ARCHIVO GENERADO — NO LO EDITES.\n"
            "   Lo escribe herramientas/3-generadores/actualizar-cabeceras.py\n"
            "   pegando los archivos de abajo, que son los que lleva TODA\n"
            "   página del sitio. Para cambiar algo se toca el archivo de\n"
            "   verdad y se vuelve a pasar la herramienta.\n"
            "\n"
            + "".join("   fuente: %s\n" % m for m in miembros)
            + "*/\n"
        ]
        for miembro in miembros:
            archivo = RAIZ / miembro.lstrip("/")
            if not archivo.is_file():
                print(f"  AVISO: el paquete {destino} nombra {miembro}, que no está.")
                continue
            trozos.append("\n/* ======== %s ======== */\n" % miembro)
            trozos.append(archivo.read_text(encoding="utf-8"))
        texto = "".join(trozos)
        # En JavaScript los /* */ también valen, así que el separador
        # sirve igual para los dos; lo que no vale es dejar un archivo sin
        # salto de línea pegado al siguiente.
        if not texto.endswith("\n"):
            texto += "\n"

        salida = RAIZ / destino.lstrip("/")
        antes = salida.read_text(encoding="utf-8") if salida.is_file() else None
        if antes != texto:
            rehechos.append(destino)
            if not probar:
                # Con escribir_texto, y no con write_text, por los saltos
                # de línea: es lo que usa todo lo demás del proyecto para
                # no dejar un archivo con los saltos cambiados.
                escribir_texto(salida, texto)
    return rehechos


def repasar_paquetes():
    """Que lo que dicen los paquetes siga cuadrando con lo que piden las
    páginas. Si alguien añade una hoja común en hojas_de() y se olvida de
    meterla en el paquete, o al revés, esto lo canta aquí en vez de
    dejarlo pasar."""
    avisos = []
    for destino, miembros in PAQUETES:
        usan, sueltas = 0, []
        for _, ruta in paginas():
            lista = hojas_de(ruta) if destino.endswith(".css") else scripts_de(ruta)
            if con_paquetes(lista) != lista:
                if destino in con_paquetes(lista):
                    usan += 1
                    continue
            if set(miembros) <= set(lista):
                # Los lleva todos pero no seguidos: el paquete ya no vale
                # para esa página y se queda con los archivos sueltos.
                sueltas.append(ruta)
        if not usan:
            avisos.append("  AVISO: el paquete %s no lo usa ninguna página."
                          " ¿Han cambiado hojas_de()/scripts_de()?" % destino)
        if sueltas:
            avisos.append(
                "  AVISO: %d página(s) llevan todo lo de %s pero no seguido,"
                " así que se quedan con los archivos sueltos: %s"
                % (len(sueltas), destino, ", ".join(sueltas[:3]))
            )
    return avisos


def con_paquetes(lista):
    """Cambia cada tirada de archivos de un paquete por el paquete. Lo
    que no esté entero y seguido se queda como está."""
    salida = list(lista)
    for destino, miembros in PAQUETES:
        n = len(miembros)
        for i in range(len(salida) - n + 1):
            if salida[i:i + n] == miembros:
                salida[i:i + n] = [destino]
                break
    return salida


# =========================================
# EL BLOQUE QUE SE ESCRIBE EN EL <head>
# =========================================

ABRE = "<!-- ==== CSS ===="
CIERRA = "<!-- ==== fin del CSS ==== -->"

# LOS COMENTARIOS DE LA CABECERA VAN CORTOS A PROPÓSITO.
#
# Esto se escribe en las 38 páginas del sitio, así que cada línea de
# explicación se copia 38 veces: las que había antes (el porqué de que
# los <link> vayan aquí y no los pida un script, lo que significa el ?v=,
# por qué el menú se adelanta...) ocupaban un tercio de la cabecera de
# cada archivo. El porqué de cada cosa está AQUÍ, en esta herramienta,
# que es donde se toca, y resumido en herramientas/LEEME.txt. En la
# página queda solo lo que hace falta saber mirándola: que esto lo
# escribe una herramienta y que no se toca a mano.
CABECERA = f"""    {ABRE}
         La escribe herramientas/3-generadores/actualizar-cabeceras.py.
         No la toques a mano (el porqué, en esa herramienta). -->
"""


ABRE_JS = "<!-- ==== JS ===="
CIERRA_JS = "<!-- ==== fin del JS ==== -->"

CABECERA_JS = f"""    {ABRE_JS}
         Igual que el CSS: la escribe la herramienta, a partir de
         scripts_de(). Van con defer y en este orden, que importa. -->
"""


BARRA_LATERAL = "/fragmentos/barra-lateral.html"

# EL ADELANTO DEL MENÚ
#
# El menú no está escrito en el HTML de cada página: vive en
# fragmentos/barra-lateral.html y lo pide scripts/componentes/barra-lateral.js,
# que va con defer y por tanto no corre hasta que el navegador ha
# terminado de leer la página. Medido con la red frenada, el menú no
# aparecía hasta 1,5 s: el HTML tardaba 190 ms, los scripts se ejecutaban
# sobre los 1000 y solo entonces empezaba el viaje a por el trozo.
#
# Esa línea lo pide ahí mismo, antes incluso que el CSS, y guarda la
# promesa. Cuando barra-lateral.js arranca no empieza ningún viaje: se
# sube al que ya iba. El menú pasó a estar a los 786 ms, la mitad.
#
# Va escrita a pelo y no en un archivo aparte a propósito: un archivo
# aparte habría que pedirlo, y pedirlo es justo lo que se está intentando
# no hacer. Si algo falla se queda sin adelanto y loadComponent() lo pide
# como siempre.
ABRE_ADELANTO = "<!-- ==== ADELANTO DEL MENÚ ===="

ADELANTO = f"""    {ABRE_ADELANTO}
         El menú, pedido LO PRIMERO para que no llegue tarde. Lo escribe
         la herramienta; el porqué está en ella. -->
    <script>window.adelantoDeFragmentos={{}};try{{window.adelantoDeFragmentos["%s"]=fetch("%s").then(function(r){{return r.ok?r.text():null}}).catch(function(){{return null}})}}catch(e){{}}</script>
"""


def bloque(ruta):
    links = "\n".join(
        f'    <link rel="stylesheet" href="{con_version(h)}">'
        for h in con_paquetes(hojas_de(ruta))
    )
    # El cargador va SIN defer y antes que los demás: es quien pone el
    # tamaño del texto, la letra y el filtro CRT antes del primer
    # pintado, y quien deja preparado window.conVersion() para los que
    # vienen detrás.
    cargador = f'    <script src="{con_version(CARGADOR)}"></script>'
    defer = "\n".join(
        f'    <script defer src="{con_version(s)}"></script>'
        for s in con_paquetes(scripts_de(ruta))
    )
    # El 404 no lleva barra lateral: ahí no hay nada que adelantar.
    adelanto = ""
    if "/scripts/componentes/barra-lateral.js" in scripts_de(ruta):
        adelanto = ADELANTO % (BARRA_LATERAL, con_version(BARRA_LATERAL))

    return (
        f"{adelanto}{CABECERA}{links}\n    {CIERRA}\n{cargador}\n"
        f"{CABECERA_JS}{defer}\n    {CIERRA_JS}"
    )


# =========================================
# EL TEMA, ANTES DE PINTAR NADA
# =========================================
# Las primeras líneas de cada página ponen el tema elegido en el <html>
# ANTES del primer pintado. Tiene que ir ahí, escrito a pelo: si esperara
# a scripts/tema.js (que va con defer, o sea al final), la página se
# pintaría con el tema de fábrica y daría un fogonazo al cambiar.
#
# ANTES ESTABA COPIADO EN LAS 38 PÁGINAS, cincuenta líneas cada una, y
# añadir un tema significaba tocarlas todas a mano —de ahí que exista
# herramientas/4-comprobar/temas-completos.py, para cazar las que se
# quedaban sin él—. Ahora lo escribe esta herramienta leyendo la lista de
# scripts/tema.js: los temas se tocan ahí y aquí no hay que acordarse de
# nada.
#
# Sale compacto a propósito: es código generado, se repite 38 veces y no
# se lee ni se toca a mano. El porqué de cada cosa está en scripts/tema.js
# y en herramientas/LEEME.txt.

TEMA_JS = RAIZ / "scripts" / "tema.js"
ABRE_TEMA = "<!-- ==== TEMA ===="

# El color con el que arranca la barra del navegador en el móvil: el del
# tema de fábrica. El script de abajo lo cambia si hay otro puesto.
COLOR_DE_FABRICA = "#12091c"


def _entre(texto, desde, hasta):
    i = texto.find(desde)
    if i == -1:
        return ""
    i += len(desde)
    j = texto.find(hasta, i)
    return texto[i:j] if j != -1 else texto[i:]


def temas_del_sitio():
    """{clave: [atributo, color de la barra]} sacado de scripts/tema.js,
    que es donde vive la lista. El tema de fábrica no entra: es el que
    sale cuando no hay ninguno puesto, así que no tiene nada que poner."""
    js = TEMA_JS.read_text(encoding="utf-8")
    atributos = dict(re.findall(
        r'"?([\w-]+)"?\s*:\s*"([^"]*)"', _entre(js, "const TEMA_ATRIBUTO = {", "};")))
    barras = dict(re.findall(
        r'"?([\w-]+)"?\s*:\s*"([^"]*)"', _entre(js, "const COLOR_BARRA = {", "};")))
    claves = re.findall(r'"([^"]+)"', _entre(js, "const TEMAS = [", "];"))
    salida = []
    for clave in claves:
        atributo = atributos.get(clave, "")
        if not atributo:
            continue
        salida.append((clave, atributo, barras.get(clave, COLOR_DE_FABRICA)))
    return salida


def bloque_del_tema():
    temas = temas_del_sitio()
    if not temas:
        print("  AVISO: no encuentro los temas en scripts/tema.js;"
              " dejo el pre-pintado como estaba.")
        return None
    # Una clave por línea pero sin comentarios: así sigue siendo legible
    # en el inspector del navegador sin ocupar media pantalla. Las comillas
    # de la clave solo hacen falta si lleva un guion, pero se ponen siempre:
    # cuesta dos caracteres y evita tener que pensarlo.
    filas = ",\n".join(
        '            "%s": ["%s", "%s"]' % (clave, atributo, barra)
        for clave, atributo, barra in temas
    )
    return f"""    {ABRE_TEMA}
         El tema elegido, puesto antes del primer pintado para que no haya
         fogonazo. Lo escribe la herramienta leyendo scripts/tema.js. -->
    <meta name="theme-color" content="{COLOR_DE_FABRICA}">
    <script>
      (function () {{
        // Una marca de que el JavaScript funciona, puesta ANTES del primer
        // pintado. Sirve para que una hoja de estilo pueda decir "esto
        // solo si hay JavaScript": un spoiler tapado, por ejemplo, que sin
        // JavaScript sería texto perdido y con él se destapa al pulsarlo.
        // Aquí y no en otro sitio porque es el único script que corre
        // antes de pintar: puesto más tarde habría fogonazo.
        document.documentElement.classList.add("js");
        try {{
          var temas = {{
{filas}
          }};
          var guardado = localStorage.getItem("richi-theme");
          var elegido = temas[guardado];
          if (!elegido && !guardado &&
              window.matchMedia("(prefers-color-scheme: light)").matches) {{
            elegido = temas.claro;
          }}
          if (elegido) {{
            document.documentElement.setAttribute("data-theme", elegido[0]);
            var barra = document.querySelector('meta[name="theme-color"]');
            if (barra) {{ barra.setAttribute("content", elegido[1]); }}
          }}
        }} catch (e) {{}}
      }})();
    </script>
"""


# Lo que hay que sustituir: el bloque viejo (el que empezaba con el
# comentario del color de la barra) o el nuevo. Los dos terminan en el
# </script> del pre-pintado.
TEMA_PUESTO = re.compile(
    r"[ \t]*(?:<!-- Color de la barra del navegador|"
    + re.escape(ABRE_TEMA) + r").*?</script>\n",
    re.S,
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
    # Se reconocen las dos formas, la de antes y la de ahora: si solo
    # valiera la nueva, la primera vez que se pasara esto después de
    # acortar los comentarios quedarían los dos, el viejo y el nuevo.
    r"(?:[ \t]*(?:<!-- El menú, pedido LO PRIMERO\.|"
    + re.escape(ABRE_ADELANTO) + r").*?</script>\n)?"
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
    # Lo PRIMERO: los paquetes. El ?v= de cada uno sale de su contenido,
    # así que tienen que estar escritos antes de ponerle la dirección a
    # ninguna página.
    rehechos = escribir_paquetes(probar)
    if rehechos:
        print("Paquetes rehechos: %s" % ", ".join(rehechos))
    for aviso in repasar_paquetes():
        print(aviso)

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

    # El pre-pintado del tema: es el mismo para todas las páginas, así que
    # se arma una sola vez y no una por archivo.
    tema = bloque_del_tema()

    cambiadas, iguales, saltadas = [], [], []
    for archivo, ruta in paginas():
        texto, crlf = leer_texto(archivo)
        # Lo que había al abrir el archivo: es contra esto contra lo que
        # hay que comparar al final para saber si ha cambiado algo. Sin
        # guardarlo, una página a la que solo le cambiara el pre-pintado
        # se daba por "ya estaba al día" y no se escribía.
        original = texto
        nuevo = bloque(ruta)

        # El pre-pintado del tema, que vive en las primeras líneas y es
        # igual en todas las páginas.
        if tema and TEMA_PUESTO.search(texto):
            texto = TEMA_PUESTO.sub(lambda m: tema, texto, count=1)

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

        if salida == original:
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
