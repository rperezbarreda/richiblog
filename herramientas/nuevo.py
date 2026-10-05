#!/usr/bin/env python3
# =========================================
# PUBLICAR ALGO NUEVO
# =========================================
# Una sola herramienta para las cinco cosas que se publican en el
# sitio. Antes eran tres scripts distintos (nueva-entrada.py,
# nuevo-rol.py y nuevo-dia-reto.py) que hacían lo mismo con otros
# nombres: preguntar cuatro datos, montar el archivo desde una
# plantilla, apuntarlo donde toque y pasar los generadores.
#
# CÓMO USARLO
# -----------
# Desde la carpeta raíz del sitio, sin más:
#
#     python herramientas/nuevo.py
#
# y te pregunta qué vas a publicar. Si ya lo sabes, se lo dices y te
# ahorras la primera pregunta:
#
#     python herramientas/nuevo.py --entrada --titulo "Tarde de mapas" \
#            --fecha 18-09-2026 --etiquetas diario
#
#     python herramientas/nuevo.py --relato \
#            --titulo "Pequeño insecto" --subcategoria microrelato
#
#     python herramientas/nuevo.py --rol --titulo "El Faro de Kerm" \
#            --categoria aventuras --kofi https://ko-fi.com/s/xxxx
#
#     python herramientas/nuevo.py --reto            (el siguiente que falte)
#     python herramientas/nuevo.py --reto --dia 7
#
#     python herramientas/nuevo.py --sesion          (la siguiente que toque)
#     python herramientas/nuevo.py --sesion --campana ragna --numero 4 \
#            --fecha 03-10-2026 --titulo "El mercado"
#
# QUÉ HACE CADA UNA
# -----------------
#   entrada / relato  Crea la página en web/blog/<año>/<mes>/ o en
#                     web/mis_movidas/relatos/, con su título, su fecha,
#                     sus etiquetas y todo el bloque de <meta> (el que
#                     decide cómo se ve el enlace al compartirlo). Si el
#                     archivo ya existe NO lo pisa.
#   rol               Añade la ficha a datos/rol.json, que es de donde
#                     la página del portfolio saca sus tarjetas.
#   reto              Crea el texto de un día del reto de escritura,
#                     sacando la palabra de su JSON.
#   sesion            Crea las notas de una partida de rol en la carpeta
#                     de su campaña, con dos hojas de cuaderno en blanco,
#                     y la apunta en el JSON de la campaña.
#
# Y en los cinco casos pasa los generadores al terminar, así que los
# listados, el RSS y el sitemap se enteran solos.
#
# NACE COMO BORRADOR
# ------------------
# Todo lo que lleva página propia (entrada, relato, día del reto y notas
# de una partida) se crea con la marca data-borrador puesta: existe y la
# puedes mirar en
# local, pero NO sale en los listados, ni en el RSS, ni en el sitemap, y
# arriba se ve una franja que lo dice. Cuando la tengas escrita:
#
#     python herramientas/publicar.py
#
# Así una entrada a medio escribir no se publica sola el día que subas
# el sitio por cualquier otra cosa. Las fichas de rol no tienen
# borrador: son una tarjeta, se ven en cuanto se añaden.

import argparse
import datetime as dt
import re
import sys

from comun import (
    MESES,
    PLANTILLAS,
    RAIZ,
    elegir,
    escapar,
    escribir_json,
    escribir_como_estaba,
    fecha_iso,
    fecha_larga,
    leer_fecha,
    leer_json,
    leer_texto,
    nombre_archivo,
    pasar_generadores,
    preguntar,
)

# Los tipos de relato que ya usa el sitio. Es solo la lista que se
# ofrece al preguntar: se puede escribir otro y el listado de relatos
# lo recoge igual (ver scripts/componentes/filtros.js).
TIPOS_RELATO = ["microrelato", "relato corto"]

ROL = RAIZ / "web" / "mis_movidas" / "rol" / "index_rol.html"
JSON_ROL = RAIZ / "datos" / "rol.json"
IMGS_ROL = "/imagenes/mis_movidas/rol/"

JSON_RETO = RAIZ / "datos" / "reto-writeober26.json"
CARPETA_RETO = RAIZ / "web" / "mis_movidas" / "relatos" / "writeober26"
SUBCATEGORIA_RETO = "writeober26"

# Las campañas de rol: una por archivo en datos/campana-<clave>.json. No
# hay una lista escrita en ningún sitio a propósito —se buscan por el
# nombre del archivo—, así que para empezar una campaña nueva basta con
# copiar uno de esos JSON y su carpeta.
CAMPANAS = RAIZ / "datos"
PATRON_CAMPANA = "campana-*.json"

CUERPO_MUESTRA = (
    "Escribe aquí la entrada. Este párrafo está de muestra: bórralo y "
    "cuenta lo que quieras. Para separar párrafos, cada uno va entre "
    "&lt;p&gt; y &lt;/p&gt;."
)
CUERPO_MUESTRA_RETO = (
    "Aquí va el texto del día. Cada párrafo, entre &lt;p&gt; y "
    "&lt;/p&gt;. Acuérdate de meter la palabra del día en algún sitio, "
    "que es la única regla del reto."
)


def rellenar(plantilla, valores):
    """Cambia los {{MARCADORES}} de una plantilla y avisa si queda
    alguno sin rellenar, que siempre es un despiste."""
    texto = plantilla
    for marca, valor in valores.items():
        texto = texto.replace("{{" + marca + "}}", valor)
    if "{{" in texto:
        sobran = sorted(set(re.findall(r"\{\{[A-Z_]+\}\}", texto)))
        print(f"  La plantilla tiene marcadores que no sé rellenar: {', '.join(sobran)}")
        sys.exit(1)
    return texto


# =========================================
# ENTRADA DE BLOG Y RELATO
# =========================================

def pedir_entrada(args, es_relato):
    hoy = dt.date.today()
    datos = {"relato": es_relato}

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

    if es_relato:
        # El tipo es lo que filtra la ventana filtros.lst del listado de
        # relatos, y esa ventana se construye con los tipos que
        # encuentra: si escribes uno nuevo, aparece su botón solo.
        datos["subcategoria"] = args.subcategoria or elegir(
            "¿Qué tipo de relato es?", TIPOS_RELATO
        )
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


def destino_entrada(datos):
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


def montar_entrada(datos, destino):
    plantilla = PLANTILLAS / ("entrada-relato.html" if datos["relato"] else "entrada-blog.html")
    if not plantilla.is_file():
        print(f"  No encuentro la plantilla {plantilla.relative_to(RAIZ)}.")
        sys.exit(1)

    fecha = datos["fecha"]
    url = "/" + destino.relative_to(RAIZ).as_posix()
    texto = rellenar(
        plantilla.read_text(encoding="utf-8"),
        {
            "TITULO": escapar(datos["titulo"]),
            "FECHA": fecha_larga(fecha),
            # La misma fecha en formato de máquina para el <time
            # datetime>: es lo que hace que un buscador o un lector de
            # pantalla entiendan que eso es una fecha.
            "FECHA_ISO": fecha_iso(fecha),
            "URL": url,
            "DESCRIPCION": escapar(datos["descripcion"]),
            "TAGS": escapar(" ".join(datos["etiquetas"])),
            "SUBCATEGORIA": escapar(datos["subcategoria"]),
            "CUERPO": CUERPO_MUESTRA,
            # El año del enlace "volver al archivo": estaba escrito a
            # mano en la plantilla y una entrada de enero de 2027 seguía
            # apuntando al archivo de 2026.
            "ANYO": str(fecha.year),
            "IMAGEN": bloque_imagen(datos),
        },
    )
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(texto, encoding="utf-8")
    return url


def hacer_entrada(args, es_relato):
    print("\n  RELATO NUEVO\n" if es_relato else "\n  ENTRADA NUEVA\n")
    datos = pedir_entrada(args, es_relato)
    destino = destino_entrada(datos)

    if destino.exists():
        print(f"\n  Ya existe {destino.relative_to(RAIZ)} y no la voy a pisar.")
        print("  Si quieres empezar de cero, bórrala tú y vuelve a ejecutar esto.")
        return 1

    url = montar_entrada(datos, destino)
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


# =========================================
# PORTFOLIO DE ROL
# =========================================

def enlace_valido(url):
    return bool(re.match(r"^https?://", url or ""))


def categorias_de_rol(texto, fichas):
    """Las categorías que ya existen: las declaradas en la ventana de
    filtros de la página más las que lleve alguna ficha del JSON."""
    declaradas = []
    encontrado = re.search(r'data-filtros-categorias="([^"]*)"', texto)
    if encontrado:
        declaradas = [c.strip() for c in encontrado.group(1).split(",") if c.strip()]
    usadas = [(f.get("subcategory") or "") for f in fichas if isinstance(f, dict)]
    vistas = []
    for c in declaradas + usadas:
        c = c.strip()
        if c and c not in vistas:
            vistas.append(c)
    return vistas


def pedir_rol(args, categorias):
    datos = {}

    datos["categoria"] = args.categoria or elegir("¿En qué categoría va?", categorias)
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
    fecha = leer_fecha(crudo)
    if not fecha:
        print(f"  No entiendo la fecha {crudo!r}. Ponla como dd-mm-aaaa.")
        sys.exit(1)
    datos["fecha"] = fecha

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


def anotar_categoria(texto, categoria):
    """Deja la categoría nueva declarada en la ventana de filtros. No
    hace falta para que salga su botón —eso lo decide la ficha— pero
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


def hacer_rol(args):
    if not ROL.is_file():
        print(f"  No encuentro {ROL.relative_to(RAIZ)}.")
        return 1

    texto, _ = leer_texto(ROL)
    fichas = leer_json(JSON_ROL, [])
    if not isinstance(fichas, list):
        print(f"  {JSON_ROL.relative_to(RAIZ)} debería ser una lista entre [ ].")
        return 1
    categorias = categorias_de_rol(texto, fichas)

    print("\n  NUEVA COSA EN EL PORTFOLIO DE ROL\n")
    datos = pedir_rol(args, categorias)

    titulos = [(f.get("title") or "").strip().lower() for f in fichas if isinstance(f, dict)]
    if datos["titulo"].strip().lower() in titulos:
        print(f"\n  Ya hay una ficha titulada {datos['titulo']!r}; no añado otra.")
        return 1

    archivo_imagen = RAIZ / datos["imagen"].lstrip("/")
    if not archivo_imagen.is_file():
        print(f"\n  OJO: no encuentro {datos['imagen']} en el sitio.")
        print("  La ficha se crea igual, pero ahí saldrá un hueco hasta que la subas.")

    # Nada de escapar aquí: esto es JSON, no HTML. De escaparlo al
    # pintarlo se encarga scripts/paginas/rol.js, que es quien sabe
    # dónde acaba cada cosa.
    # La primera de la lista: el orden del archivo da igual (la página
    # ordena por fecha) pero así lo último publicado es lo primero que
    # se ve al abrirlo.
    fichas.insert(0, {
        "title": datos["titulo"],
        "subcategory": datos["categoria"],
        "date": datos["fecha"].strftime("%d-%m-%Y"),
        "image": datos["imagen"],
        "alt": datos["alt"],
        "system": datos["sistema"],
        "description": datos["descripcion"],
        "kofi": datos["kofi"],
        "drive": datos["drive"],
    })
    escribir_json(JSON_ROL, fichas)

    if datos["es_nueva"]:
        escribir_como_estaba(ROL, anotar_categoria(texto, datos["categoria"]))

    print(f"\n  Añadida a «{datos['categoria']}» en {JSON_ROL.relative_to(RAIZ)}")
    if datos["es_nueva"]:
        print("  (categoría nueva: ya tiene su botón en filtros.lst)")

    pasar_generadores()
    print("\n  Listo. Repasa la tarjeta en la web y sube el sitio a Neocities.")
    return 0


# =========================================
# UN DÍA DEL RETO DE ESCRITURA
# =========================================

def elegir_dia(reto, pedido):
    """El que digas con --dia; si no dices nada, EL SIGUIENTE QUE FALTE
    POR ESCRIBIR, por orden de día.

    POR QUÉ NO EL DE HOY, QUE ERA LO DE ANTES
    -----------------------------------------
    Porque un reto de escritura se escribe en orden, no a la vez que pasa
    el calendario. Si te saltas un día —o te pones al día el domingo— la
    fecha de hoy te manda al día que toca por calendario y te deja huecos
    detrás: escribiste el 1, abriste el script el 3 y te ofreció el 3,
    con el 2 sin escribir y sin avisar. Eso pasó de verdad.

    Yendo por orden, el script siempre ofrece el siguiente que falta y los
    huecos se van cerrando solos. Y de paso se acaban las sorpresas por la
    hora: a las doce y pico de la noche, "hoy" ya era otro día para el
    ordenador y te saltaba uno sin que hubieras hecho nada raro.

    Para escribir uno fuera de orden sigue estando --dia N, que es
    explícito y no se equivoca."""
    dias = reto["dias"]
    por_numero = {int(d.get("dia") or 0): d for d in dias if isinstance(d, dict)}

    if pedido:
        dia = por_numero.get(pedido)
        if not dia:
            print(f"  Este reto no tiene día {pedido}: van del 1 al {max(por_numero)}.")
            sys.exit(1)
        return dia

    # Por número de día y no por el orden en que estén en el archivo: el
    # JSON lo puede tocar cualquiera a mano y el orden de dentro no es
    # una promesa.
    pendientes = sorted(
        (d for d in dias if not (d.get("url") or "").strip()),
        key=lambda d: int(d.get("dia") or 0),
    )
    if not pendientes:
        print("  Están todos los días escritos. Enhorabuena.")
        sys.exit(0)

    siguiente = pendientes[0]
    # Si quedan huecos por detrás del último escrito, se dice: puede que
    # fuera a propósito, pero puede que te lo hayas saltado sin querer.
    escritos = [
        int(d.get("dia") or 0) for d in dias if (d.get("url") or "").strip()
    ]
    if escritos and int(siguiente.get("dia") or 0) < max(escritos):
        print(
            f"  (Te faltaba el día {siguiente.get('dia')}, que se había"
            f" quedado por detrás del {max(escritos)}.)"
        )
    return siguiente


def hacer_reto(args):
    reto = leer_json(JSON_RETO)
    if not reto or not isinstance(reto.get("dias"), list) or not reto["dias"]:
        print(f"  No encuentro los días en {JSON_RETO.relative_to(RAIZ)}.")
        return 1

    dia = elegir_dia(reto, args.dia)
    numero = int(dia.get("dia") or 0)
    print(f"\n  {reto.get('nombre', 'RETO')} — DÍA {numero}\n")

    palabra = (dia.get("palabra") or "").strip()
    if not palabra:
        palabra = (args.palabra or "").strip() or preguntar("Palabra de este día")
        if not palabra:
            print("  Sin palabra no hay día: la palabra es el reto.")
            return 1
        dia["palabra"] = palabra
    else:
        print(f"  Palabra: {palabra}")

    if (dia.get("url") or "").strip():
        print(f"\n  El día {numero} ya está escrito: {dia['url']}")
        print("  Si quieres rehacerlo, borra esa página y su url del JSON.")
        return 1

    titulo = (args.titulo or "").strip() or preguntar("Título del texto", palabra)

    destino = CARPETA_RETO / f"dia-{numero:02d}-{nombre_archivo(palabra, str(numero))}.html"
    if destino.exists():
        print(f"\n  Ya existe {destino.relative_to(RAIZ)}; no lo piso.")
        return 1

    plantilla = PLANTILLAS / "dia-reto.html"
    if not plantilla.is_file():
        print(f"  No encuentro la plantilla {plantilla.relative_to(RAIZ)}.")
        return 1

    fecha = leer_fecha(dia.get("fecha", "")) or dt.date.today()
    url = "/" + destino.relative_to(RAIZ).as_posix()
    texto = rellenar(
        plantilla.read_text(encoding="utf-8"),
        {
            "TITULO": escapar(titulo),
            "FECHA": fecha_larga(fecha),
            "FECHA_ISO": fecha_iso(fecha),
            "URL": url,
            "DESCRIPCION": escapar(
                f"Día {numero} del reto de escritura, con la palabra «{palabra}»."
            ),
            "SUBCATEGORIA": escapar(SUBCATEGORIA_RETO),
            "CUERPO": CUERPO_MUESTRA_RETO,
            # Sin imagen: un texto de un día no la lleva. El hueco de la
            # plantilla se queda comentado por si algún día quieres una.
            "IMAGEN": "",
        },
    )
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(texto, encoding="utf-8")

    dia["titulo"] = titulo
    dia["url"] = url
    escribir_json(JSON_RETO, reto)

    print(f"\n  Creado {destino.relative_to(RAIZ)}")
    print("  Escribe el texto dentro y, cuando esté, publícalo:")
    print("      python herramientas/publicar.py")

    pasar_generadores()
    print("\n  Listo. Ojo: hasta que no lo publiques sigue siendo un borrador.")
    return 0


# =========================================
# LAS NOTAS DE UNA PARTIDA DE ROL
# =========================================
# Lo mismo que un día del reto, pero por campañas: se elige la campaña, se
# coge el número de sesión que toca y se deja la página montada con la
# fecha puesta y dos hojas de cuaderno en blanco para escribir dentro.
#
# Quién manda es el JSON de la campaña (datos/campana-<clave>.json): de ahí
# sale su nombre, su carpeta y las sesiones que ya hay, y ahí se apunta la
# nueva. La ficha de la campaña —el sistema, los personajes, la sinopsis—
# se escribe a mano en ese mismo archivo y esto no la toca.


def campanas_que_hay():
    """[(archivo, datos)] de las campañas, por orden de archivo."""
    encontradas = []
    for archivo in sorted(CAMPANAS.glob(PATRON_CAMPANA)):
        datos = leer_json(archivo, {})
        if isinstance(datos, dict) and (datos.get("nombre") or "").strip():
            encontradas.append((archivo, datos))
    return encontradas


def elegir_campana(pedida):
    """La campaña que diga --campana, o la única que haya, o se pregunta."""
    campanas = campanas_que_hay()
    if not campanas:
        print(f"  No encuentro ninguna campaña en datos/{PATRON_CAMPANA}.")
        print("  Para empezar una, copia datos/campana-ragna.json con otro")
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
    elegido = elegir("¿De qué campaña son las notas?", nombres, permitir_nueva=False)
    return campanas[nombres.index(elegido)]


def siguiente_sesion(campana, pedido):
    """El número que diga --numero; si no, el siguiente al más alto que
    haya. Al revés que el reto de escritura, aquí no se va rellenando
    huecos: una campaña no tiene 31 casillas esperando, las sesiones se
    juegan en orden y la que toca es siempre la de después de la última."""
    sesiones = campana.get("sesiones") or []
    numeros = [int(s.get("numero") or 0) for s in sesiones if isinstance(s, dict)]
    if pedido:
        if pedido in numeros:
            print(f"  La sesión {pedido} ya está apuntada en esta campaña.")
            print("  Si quieres rehacerla, borra su página y su línea del JSON.")
            return None
        return pedido
    return (max(numeros) + 1) if numeros else 1


def hacer_sesion(args):
    archivo_campana, campana = elegir_campana(args.campana)
    if not campana:
        return 1

    nombre = (campana.get("nombre") or "").strip()
    clave = (campana.get("clave") or "").strip()
    pagina = (campana.get("pagina") or "").strip()
    if not clave or not pagina:
        print(f"  A {archivo_campana.relative_to(RAIZ)} le falta \"clave\" o \"pagina\".")
        return 1

    carpeta = (RAIZ / pagina.lstrip("/")).parent
    if not carpeta.is_dir():
        print(f"  No encuentro la carpeta de la campaña: {carpeta.relative_to(RAIZ)}")
        return 1

    numero = siguiente_sesion(campana, args.numero)
    if numero is None:
        return 1

    print(f"\n  NOTAS DE UNA PARTIDA — {nombre.upper()}, SESIÓN {numero}\n")

    crudo = args.fecha or preguntar(
        "¿Qué día se jugó? (dd-mm-aaaa)", dt.date.today().strftime("%d-%m-%Y")
    )
    fecha = leer_fecha(crudo)
    if not fecha:
        print(f"  No entiendo la fecha {crudo!r}. Ponla como dd-mm-aaaa.")
        return 1

    # El título es opcional: una sesión se llama "Sesión 4" y ya se
    # entiende. Si le pones nombre, sale detrás ("Sesión 4 · El mercado").
    titulo_corto = (
        args.titulo
        if args.titulo is not None
        else preguntar("Nombre de la sesión (Enter para ninguno)")
    ).strip()
    # El nombre va detrás con una raya y no con el punto medio del resto
    # del sitio a propósito: el punto medio es el que separa el título de
    # la sección y del nombre de la web en el <title> de la pestaña, y
    # quien lee esos títulos de vuelta (el buscador y el mapa) se queda
    # con lo de delante del primero. Con un punto medio aquí, "Sesión 4 ·
    # El mercado" salía en los resultados como "Sesión 4" a secas.
    sesion = f"Sesión {numero}"
    titulo = sesion
    if titulo_corto:
        titulo += f" — {titulo_corto}"

    destino = carpeta / f"sesion-{numero:02d}.html"
    if destino.exists():
        print(f"\n  Ya existe {destino.relative_to(RAIZ)}; no lo piso.")
        return 1

    plantilla = PLANTILLAS / "sesion-rol.html"
    if not plantilla.is_file():
        print(f"  No encuentro la plantilla {plantilla.relative_to(RAIZ)}.")
        return 1

    fecha_corta = fecha.strftime("%d-%m-%Y")
    url = "/" + destino.relative_to(RAIZ).as_posix()
    texto = rellenar(
        plantilla.read_text(encoding="utf-8"),
        {
            "TITULO": escapar(titulo),
            # Solo "Sesión N", sin el nombre: es lo que repite la cabecera
            # de cada hoja, y ahí el nombre entero no cabría.
            "SESION": escapar(sesion),
            "FECHA": fecha_larga(fecha),
            "FECHA_ISO": fecha_iso(fecha),
            # La fecha tal cual la escribes en el cuaderno, que es como
            # sale en la cabecera de cada hoja.
            "FECHA_CORTA": escapar(fecha_corta),
            "URL": url,
            "DESCRIPCION": escapar(
                args.descripcion
                or f"Notas de la sesión {numero} de la {nombre}, jugada el {fecha_corta}."
            ),
            "CAMPANA": escapar(clave),
            "CAMPANA_NOMBRE": escapar(nombre),
            "CAMPANA_URL": escapar(pagina),
            # De dónde saca la página el PDF y los saltos a la sesión de
            # al lado: de su propio JSON. Se escribe aquí y no se deduce
            # en el script del navegador para que lo compruebe
            # herramientas/enlaces-rotos.py como cualquier otra ruta.
            "CAMPANA_DATOS": escapar(
                "/" + archivo_campana.relative_to(RAIZ).as_posix()
            ),
        },
    )
    destino.write_text(texto, encoding="utf-8")

    campana.setdefault("sesiones", []).append(
        {
            "numero": numero,
            "fecha": fecha_corta,
            "titulo": titulo_corto,
            "url": url,
            # El cuaderno escaneado, si lo hay. Nace en blanco: el PDF se
            # suele subir después de pasar las notas a limpio, y entonces
            # se pega aquí su enlace y el botón de descargar aparece solo
            # en la página de la sesión.
            "pdf": (args.pdf or "").strip(),
        }
    )
    escribir_json(archivo_campana, campana)

    print(f"\n  Creado {destino.relative_to(RAIZ)}  (de momento, BORRADOR)")
    print(f"  Estará en  https://richi.blog{url}")
    print("\n  Dentro hay dos hojas de cuaderno con un ejemplo de cada cosa")
    print("  (párrafos, listas, personajes en negrita, lugares en cursiva y el")
    print("  corte entre escenas). Borra lo de muestra y pasa a limpio las")
    print("  notas; si hacen falta más hojas, copia el bloque de una entera.")
    if not (args.pdf or "").strip():
        print("\n  Si subes el cuaderno escaneado a Drive, pega su enlace en")
        print(f"  {archivo_campana.relative_to(RAIZ)}, en el \"pdf\" de esta sesión,")
        print("  y debajo del post-it sale el botón de descargarlo.")
    print("\n  Cuando estén listas:")
    print("\n      python3 herramientas/publicar.py")

    pasar_generadores()
    print("\n  Listo. Ojo: hasta que no lo publiques sigue siendo un borrador.")
    return 0


# =========================================

TIPOS = ["Una entrada del blog", "Un relato", "Algo del portfolio de rol",
         "Un día del reto de escritura", "Las notas de una partida de rol"]


def main():
    parser = argparse.ArgumentParser(description="Publica algo nuevo en el sitio.")
    que = parser.add_mutually_exclusive_group()
    que.add_argument("--entrada", action="store_true", help="una entrada del blog")
    que.add_argument("--relato", action="store_true", help="un relato")
    que.add_argument("--rol", action="store_true", help="una ficha del portfolio de rol")
    que.add_argument("--reto", action="store_true", help="un día del reto de escritura")
    que.add_argument("--sesion", action="store_true",
                     help="las notas de una partida de rol")

    # Comunes
    parser.add_argument("--titulo")
    parser.add_argument("--fecha", help="dd-mm-aaaa (por defecto, hoy)")
    parser.add_argument("--descripcion")
    parser.add_argument("--imagen", help="ruta de la imagen dentro del sitio")
    parser.add_argument("--alt", help="descripción de la imagen")
    # Entrada y relato
    parser.add_argument("--etiquetas", help="entradas: separadas por espacios o comas")
    parser.add_argument("--subcategoria", help="relatos: microrelato, relato corto…")
    parser.add_argument("--pie", help="entradas: pie de la imagen lateral")
    # Rol
    parser.add_argument("--categoria", help="rol: aventuras, mapas, sistemas… o una nueva")
    parser.add_argument("--sistema", help="rol: sistema y jugadores")
    parser.add_argument("--kofi", help="rol: enlace de Ko-fi")
    parser.add_argument("--drive", help="rol: enlace de Drive ('' para ninguno)")
    # Reto
    parser.add_argument(
        "--dia", type=int,
        help="reto: qué día (por defecto, el siguiente sin escribir)")
    parser.add_argument("--palabra", help="reto: solo si ese día aún no la tiene")
    # Notas de rol
    parser.add_argument("--campana", help="sesión: de qué campaña (su clave)")
    parser.add_argument("--pdf", help="sesión: enlace al PDF de las notas")
    parser.add_argument(
        "--numero", type=int,
        help="sesión: qué número (por defecto, el siguiente de la campaña)")
    args = parser.parse_args()

    if args.rol:
        return hacer_rol(args)
    if args.reto:
        return hacer_reto(args)
    if args.sesion:
        return hacer_sesion(args)
    if args.relato:
        return hacer_entrada(args, True)
    if args.entrada:
        return hacer_entrada(args, False)

    # Sin decir qué, se pregunta. Con --titulo y sin más, se da por
    # hecho que es una entrada del blog, como hacía nueva-entrada.py.
    if args.titulo:
        return hacer_entrada(args, False)
    elegido = elegir("¿Qué vas a publicar?", TIPOS, permitir_nueva=False)
    if elegido == TIPOS[1]:
        return hacer_entrada(args, True)
    if elegido == TIPOS[2]:
        return hacer_rol(args)
    if elegido == TIPOS[3]:
        return hacer_reto(args)
    if elegido == TIPOS[4]:
        return hacer_sesion(args)
    return hacer_entrada(args, False)


if __name__ == "__main__":
    sys.exit(main())
