#!/usr/bin/env python3
# =========================================
# LA LÍNEA DE TIEMPO DE LA WIKI (las piezas)
# =========================================
# Lo que hay aquí lo usan dos:
#
#   3-generadores/generar-linea-tiempo.py  escribe las páginas
#   3-generadores/generar-mundo.py         para que un [[enlace]] de la
#                                          bóveda pueda llevar a un evento
#                                          y para los «se habla de esto en»
#
# No se pasa suelto. Lo que se edita es datos/wiki/linea-de-tiempo.json,
# a mano o con herramientas/1-publicar/linea-de-tiempo.py.
#
# QUÉ SALE
#
#     web/wiki/linea-de-tiempo/linea_de_tiempo.html      la línea entera
#     web/wiki/linea-de-tiempo/evento_<nombre>.html      una página por evento
#     y las fichas de todo eso en datos/wiki/mundo.json, que es de donde
#     salen la portada de la wiki (con la línea en pequeño) y su buscador.
#
# LAS ERAS (Edad Media, Era Nueva…) van en el mismo JSON, en "eras": cada
# una con "nombre", "desde" y, si quiere, "hasta" y "resumen". En la línea
# son franjas con su nombre al principio, y los eventos que caen dentro
# son suyos (ver leer_eras y era_de).
#
# LA ESCALA. Los eventos están separados según los años que hay entre
# ellos, pero no a lo bruto: con -25500 y 1200 en la misma línea, a escala
# exacta los de la época reciente quedarían pegados y habría metros de
# línea vacía. Así que:
#
#   · Se mira el hueco TÍPICO entre dos eventos (la mediana) y ése se
#     pinta a OBJETIVO rem. Todos los demás, en proporción.
#   · Un hueco que en proporción saldría más largo que MAXIMO se corta: se
#     pinta a CORTE rem con un «≈» en la línea y cuántos años son. Es la
#     forma honrada de comprimir: se ve que ahí falta tiempo.
#   · Un hueco que saldría más corto que MINIMO se estira hasta MINIMO,
#     porque las tarjetas tienen que caber.
#
# Las rayitas son años redondos (cada 1000, cada 50, cada 1… según la
# escala), y una de cada pocas lleva el año escrito, como en una regla.

import html
import json
import re
import statistics
import sys
import unicodedata
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from comun import (RAIZ, escribir_json, escribir_texto, leer_json,  # noqa: E402
                   leer_texto, limpiar_comentarios_html)
from mundo_formato import Avisos, Conversor  # noqa: E402
from mundo_piezas import pintar_contenido  # noqa: E402

DATOS = RAIZ / "datos" / "wiki" / "linea-de-tiempo.json"
# La wiki entera (para ver qué páginas hay y quién enlaza a quién) y la
# carpeta propia de la línea, dentro de ella. Con guion y no con guion
# bajo a propósito: las carpetas que salen de la bóveda pasan por slug(),
# que solo pone guiones bajos, así que una carpeta de wiki/ nunca puede
# acabar llamándose igual que ésta.
WIKI = RAIZ / "web" / "wiki"
WIKI_URL = "/web/wiki/"
CARPETA = "linea-de-tiempo"
SALIDA = WIKI / CARPETA
URL = WIKI_URL + CARPETA + "/"
PAGINA = "linea_de_tiempo.html"
PREFIJO = "evento_"
VISTA = RAIZ / "imagenes" / "wiki" / "linea-de-tiempo.svg"  # ya no se usa: se borra
INDICE = RAIZ / "datos" / "wiki" / "mundo.json"
PLANTILLA_LINEA = RAIZ / "herramientas" / "plantillas" / "mundo-linea.html"
PLANTILLA_EVENTO = RAIZ / "herramientas" / "plantillas" / "mundo-pagina.html"
IMAGENES = RAIZ / "imagenes" / "wiki"

# La escala, en rem (ver arriba). La raíz del sitio está a 21,6 px, así
# que 9 rem son unos 195 px.
OBJETIVO = 9.0
MINIMO = 6.5
MAXIMO = 20.0
CORTE = 8.0
# Cada cuánto, más o menos, una rayita; y lo que se aparta de los puntos
# para no pisarlos.
RAYA_CADA = 2.0
APARTE_RAYA = 0.75
APARTE_ANYO = 0.75

# Lo que se lee en la tarjeta. Más largo no cabe sin estirar la línea.
RESUMEN_MAXIMO = 180

TITULO_POR_DEFECTO = "Línea de tiempo"
INTRO_POR_DEFECTO = "Lo que ha pasado en Cralëa, de lo más antiguo a lo más reciente."


def slug(texto):
    """El mismo que generar-mundo.py: sin tildes, en minúsculas y con
    guiones bajos."""
    plano = "".join(c for c in unicodedata.normalize("NFD", (texto or "").lower())
                    if unicodedata.category(c) != "Mn")
    return re.sub(r"^_+|_+$", "", re.sub(r"[^a-z0-9]+", "_", plano)) or "evento"


# =========================================
# LEER
# =========================================

# =========================================
# EL CALENDARIO
# =========================================
# Sin calendario, un año es un número y ya está: -25500, 1203.
#
# Con calendario ("calendario" en el JSON), los años se cuentan como en el
# mundo: hacia atrás ANTES de un momento y hacia delante DESPUÉS de otro,
#
#     "calendario": {"antes": "AEM", "despues": "DEM"}
#
# y se escriben así en el JSON y así salen en la web: "800.000.000 AEM",
# "-13.000 DEM", "1340 DEM". En Cralëa: Antes y Después de la Era Muda.
#
# ENTRE LOS DOS CEROS NO SE SABE CUÁNTO HAY. 0 AEM es cuando empieza la Era
# Muda y 0 DEM cuando acaba, y lo que dura es un misterio (por eso puede
# haber años DEM negativos: −13.000 DEM es 13.000 años antes de que acabe,
# pero no se sabe cuánto después de que empezó). Así que la línea no lo
# mide: el tramo que cruza ese hueco se corta siempre con su «≈» y dice
# «duración incierta» en vez de un número de años.
#
# Por dentro, para ordenar y medir, un año AEM es un número muy por debajo
# de cualquier año DEM: BASE_ANTES menos los años que diga. BASE_ANTES es
# un múltiplo redondo de todo, así que las rayitas de los años AEM siguen
# cayendo en años redondos.

BASE_ANTES = -10 ** 10
CALENDARIO = {}
# «Hoy» en el mundo ("hoy" en el JSON, "1340 DEM"): donde acaba la línea.
# La última era, si no dice hasta cuándo, llega hasta aquí.
HOY = [None]


def poner_calendario(crudo):
    """El calendario del JSON (o ninguno). Lo usan leer_fecha y anyo."""
    CALENDARIO.clear()
    if isinstance(crudo, dict):
        antes = str(crudo.get("antes") or "").strip()
        despues = str(crudo.get("despues") or crudo.get("después") or "").strip()
        if antes and despues:
            CALENDARIO.update(antes=antes, despues=despues)
    return dict(CALENDARIO)


def _numero(texto):
    limpio = texto.replace("−", "-").replace(" ", "").replace(".", "").replace("\u202f", "")
    return int(limpio) if re.fullmatch(r"-?\d+", limpio) else None


def leer_fecha(valor):
    """El año como número entero, o None. Vale 1200, -25500, "-25500" y
    "−25500" (el signo menos de verdad, que es el que sale en la web). Con
    calendario, además "800.000.000 AEM" y "-13.000 DEM"; un número sin
    sigla se entiende como de después (DEM)."""
    if isinstance(valor, bool):
        return None
    if isinstance(valor, int):
        return valor
    if isinstance(valor, float) and valor.is_integer():
        return int(valor)
    texto = str(valor or "").strip()
    if CALENDARIO:
        m = re.fullmatch(r"(.*?)\s*(%s|%s)" % (re.escape(CALENDARIO["antes"]),
                                                re.escape(CALENDARIO["despues"])),
                         texto, re.I)
        if m:
            n = _numero(m.group(1))
            if n is None:
                return None
            if m.group(2).lower() == CALENDARIO["antes"].lower():
                return BASE_ANTES - n
            return n
    return _numero(texto)


def es_antes(numero):
    return bool(CALENDARIO) and numero <= BASE_ANTES


def cruza_el_hueco(a, b):
    """¿Entre los años a y b está el hueco sin medir entre 0 AEM y lo
    primero de DEM?"""
    return bool(CALENDARIO) and a <= BASE_ANTES < b


def leer(avisar=print):
    """(cabecera, eventos). Los eventos vienen ordenados por fecha (y, a
    igual fecha, como estén escritos) y cada uno con su "slug" y su "url".
    Lo que no se entienda se canta con avisar() y se deja fuera."""
    try:
        crudo = json.loads(DATOS.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}, []
    except (OSError, ValueError) as error:
        avisar(f"  OJO: no entiendo {DATOS.relative_to(RAIZ)}: {error}")
        return {}, []
    if isinstance(crudo, list):
        crudo = {"eventos": crudo}
    if not isinstance(crudo, dict):
        avisar(f"  OJO: {DATOS.relative_to(RAIZ)} no tiene la forma que espero.")
        return {}, []
    # Lo primero el calendario: sin él no se entienden las fechas.
    poner_calendario(crudo.get("calendario"))
    HOY[0] = leer_fecha(crudo.get("hoy")) if crudo.get("hoy") not in (None, "") else None
    if crudo.get("hoy") not in (None, "") and HOY[0] is None:
        avisar(f"  OJO: no entiendo el «hoy» ({crudo.get('hoy')!r}); la línea acaba"
               " en el último evento.")
    eventos = []
    vistos = {}
    for n, uno in enumerate(crudo.get("eventos") or []):
        if not isinstance(uno, dict):
            continue
        nombre = str(uno.get("nombre") or "").strip()
        fecha = leer_fecha(uno.get("fecha"))
        if not nombre:
            avisar(f"  OJO: el evento número {n + 1} no tiene nombre; lo dejo fuera.")
            continue
        if fecha is None:
            avisar(f"  OJO: «{nombre}» no tiene un año que entienda"
                   f" ({uno.get('fecha')!r}); lo dejo fuera.")
            continue
        clave = PREFIJO + slug(nombre)
        if clave in vistos:
            avisar(f"  OJO: «{nombre}» y «{vistos[clave]}» acaban en la misma página"
                   f" ({clave}.html). Me quedo con el primero; cambia el nombre de uno.")
            continue
        vistos[clave] = nombre
        ev = dict(uno)
        # Un evento que dura: "hasta" es el año en que acaba. Si no se
        # entiende o es antes de que empiece, se hace como si no estuviera.
        hasta = leer_fecha(uno.get("hasta")) if uno.get("hasta") not in (None, "") else None
        if hasta is not None and hasta <= fecha:
            avisar(f"  OJO: «{nombre}» acaba ({hasta}) antes de empezar ({fecha});"
                   " no hago caso del «hasta».")
            hasta = None
        ev.update(nombre=nombre, fecha=fecha, hasta=hasta, slug=clave,
                  url=URL + clave + ".html", orden=n)
        eventos.append(ev)
    eventos.sort(key=lambda e: (e["fecha"], e["orden"]))
    if HOY[0] is not None and eventos and eventos[-1]["fecha"] > HOY[0]:
        avisar(f"  OJO: «{eventos[-1]['nombre']}» es de después de «hoy»"
               f" ({anyo(HOY[0])}). ¿Está bien el año?")
    cabecera = {
        "titulo": str(crudo.get("titulo") or TITULO_POR_DEFECTO).strip(),
        "intro": str(crudo.get("intro") or INTRO_POR_DEFECTO).strip(),
        "eras": leer_eras(crudo.get("eras") or [], avisar),
        "hoy": HOY[0],
    }
    return cabecera, eventos


def leer_eras(crudas, avisar=print):
    """Las eras, ordenadas, cada una con "desde", "hasta" (el año en que
    acaba, o None si sigue hasta hoy) y "fin" (dónde acaba DE VERDAD en la
    línea: su "hasta", o el principio de la siguiente si no lo dice).

    Una era es un trozo de la historia con nombre, como la Edad Media: va
    de un año a otro y los eventos que caen dentro son suyos. No se pueden
    pisar: si una empieza antes de que acabe la anterior, la anterior se
    acaba ahí (y se avisa)."""
    eras, vistas = [], set()
    for n, uno in enumerate(crudas if isinstance(crudas, list) else []):
        if not isinstance(uno, dict):
            continue
        nombre = str(uno.get("nombre") or "").strip()
        desde = leer_fecha(uno.get("desde"))
        if not nombre or desde is None:
            avisar(f"  OJO: la era número {n + 1} necesita nombre y «desde»; la dejo fuera.")
            continue
        clave = "era_" + slug(nombre)
        if clave in vistas:
            avisar(f"  OJO: hay dos eras que se llaman «{nombre}»; me quedo con la primera.")
            continue
        vistas.add(clave)
        hasta = leer_fecha(uno.get("hasta")) if uno.get("hasta") not in (None, "") else None
        if hasta is not None and hasta <= desde:
            avisar(f"  OJO: la era «{nombre}» acaba antes de empezar; no hago caso del «hasta».")
            hasta = None
        era = dict(uno)
        # Su color, el de su franja (como en tu dibujo de la línea). Solo
        # "#rrggbb"; si no, la del tema.
        color = str(uno.get("color") or "").strip()
        if color and not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
            avisar(f"  OJO: el color de «{nombre}» ({color}) no es un #rrggbb; uso el del tema.")
            color = ""
        era.update(nombre=nombre, desde=desde, hasta=hasta, slug=clave, orden=n, color=color)
        eras.append(era)
    eras.sort(key=lambda e: (e["desde"], e["orden"]))
    for n, era in enumerate(eras):
        siguiente = eras[n + 1] if n + 1 < len(eras) else None
        fin = era["hasta"]
        if siguiente and fin is not None and fin > siguiente["desde"]:
            avisar(f"  OJO: «{era['nombre']}» acaba en {fin}, pero «{siguiente['nombre']}»"
                   f" empieza en {siguiente['desde']}. La corto ahí.")
            fin = siguiente["desde"]
        if fin is None and siguiente:
            fin = siguiente["desde"]
        era["fin"] = fin
        if fin is None and HOY[0] is not None:
            era["hasta_hoy"] = HOY[0]
        # ¿Hay un hueco sin era detrás? Entonces se marca dónde acaba.
        era["cierra"] = era["hasta"] is not None and (
            siguiente is None or era["hasta"] < siguiente["desde"])
    return eras


def era_de(evento, eras):
    """La era en la que cae un evento (por el año en que empieza), o None.
    En el año en que una acaba y empieza la siguiente, es de la siguiente."""
    suya = None
    for era in eras:
        if evento["fecha"] < era["desde"]:
            break
        if era["fin"] is None or evento["fecha"] < era["fin"] or (
                era["cierra"] and evento["fecha"] == era["fin"]):
            suya = era
    return suya


def por_nombre(eventos):
    """{nombre en minúsculas: evento}, para resolver [[enlaces]]."""
    return {e["nombre"].strip().lower(): e for e in eventos}


RE_ENLACE = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]")


def enlaces_de(evento):
    """A qué páginas de la wiki apunta un evento: los [[nombres]] de su
    texto y de su resumen."""
    texto = "%s\n%s" % (evento.get("resumen") or "", evento.get("texto") or "")
    return [m.group(1).strip() for m in RE_ENLACE.finditer(texto)]


def paginas_mias(eventos):
    """Los archivos de web/wiki/ que son de la línea de tiempo: los que
    generar-mundo.py no tiene que quitar aunque no estén en la bóveda."""
    if not eventos:
        return set()
    return {PAGINA} | {e["slug"] + ".html" for e in eventos}


def es_de_la_linea(ruta):
    """¿Este archivo de web/wiki/ es de la línea de tiempo? Lo que está en
    su carpeta, y lo que dejó en la raíz la versión de antes (cuando todo
    iba suelto en web/wiki/), que se quita al pasar generar()."""
    ruta = Path(ruta)
    if SALIDA in ruta.parents:
        return True
    return ruta.parent == WIKI and es_mia(ruta.name)


def es_mia(nombre_de_archivo):
    """Por el nombre: cualquier evento_*.html y la línea. Para limpiar los
    de eventos que ya no están."""
    return nombre_de_archivo == PAGINA or nombre_de_archivo.startswith(PREFIJO)


# =========================================
# FECHAS
# =========================================

def _miles(n):
    """13000 → "13.000", 800000000 → "800.000.000"; 1340 se queda en 1340
    (en español los de cuatro cifras van sin punto). Negativos con el signo
    menos de verdad."""
    cifras = "%d" % abs(n)
    if abs(n) >= 10000:
        cifras = "{:,}".format(abs(n)).replace(",", ".")
    return ("−" if n < 0 else "") + cifras


def anyo(numero):
    """-25500 → "−25500": con el signo menos de verdad, que un lector de
    pantalla lee como «menos» y no como «guion». Con calendario, con su
    sigla: «800.000.000 AEM», «−13.000 DEM»."""
    if CALENDARIO:
        if numero <= BASE_ANTES:
            return "%s %s" % (_miles(BASE_ANTES - numero), CALENDARIO["antes"])
        return "%s %s" % (_miles(numero), CALENDARIO["despues"])
    return ("−%d" % -numero) if numero < 0 else "%d" % numero


def anyo_corto(numero):
    """Para el rótulo de una rayita, que tiene poco sitio: «300 M AEM»,
    «20 mil AEM», «500 DEM». Sin calendario, igual que anyo()."""
    if not CALENDARIO:
        return anyo(numero)
    if numero <= BASE_ANTES:
        valor, sigla = BASE_ANTES - numero, CALENDARIO["antes"]
    else:
        valor, sigla = numero, CALENDARIO["despues"]
    signo = "−" if valor < 0 else ""
    valor = abs(valor)
    if valor >= 1_000_000 and valor % 100_000 == 0:
        texto = ("%g" % (valor / 1_000_000)).replace(".", ",") + " M"
    elif valor >= 10_000 and valor % 1000 == 0:
        texto = "%d mil" % (valor // 1000)
    else:
        texto = _miles(valor)
    return "%s%s %s" % (signo, texto, sigla)


def fecha_visible(evento):
    """Lo que sale en la tarjeta: «−25500», «−11420 a −11380» si dura, o lo
    que diga fecha_texto tal cual."""
    propia = str(evento.get("fecha_texto") or "").strip()
    if propia:
        return propia
    if evento.get("hasta") is not None:
        return "%s a %s" % (anyo(evento["fecha"]), anyo(evento["hasta"]))
    return anyo(evento["fecha"])


def cuando(evento):
    """Para leerlo suelto: «año −25500», «de −11420 a −11380», o lo que
    diga fecha_texto tal cual («hacia el −12000», «1203 de la Era Nueva»)."""
    propia = str(evento.get("fecha_texto") or "").strip()
    if propia:
        return propia
    if evento.get("hasta") is not None:
        return "de %s a %s" % (anyo(evento["fecha"]), anyo(evento["hasta"]))
    return "año " + anyo(evento["fecha"])


def fechas_de_era(era):
    """«de −12000 a −5000», o «desde 1203» si no se ha acabado. Con
    fecha_texto, lo que diga."""
    propia = str(era.get("fecha_texto") or "").strip()
    if propia:
        return propia
    if era.get("hasta") is not None:
        return "de %s a %s" % (anyo(era["desde"]), anyo(era["hasta"]))
    if era.get("fin") is not None:
        # Sin «hasta», acaba donde empieza la siguiente.
        return "de %s a %s" % (anyo(era["desde"]), anyo(era["fin"]))
    if era.get("hasta_hoy") is not None:
        return "de %s a hoy" % anyo(era["desde"])
    return "desde %s" % anyo(era["desde"])


def cuantos_anyos(n):
    if n is None:
        return "duración incierta"
    if n == 1:
        return "1 año"
    # 25500 → "25.500", igual que los años (ver _miles).
    return _miles(n) + " años"


# =========================================
# LA ESCALA
# =========================================

def _redondo(valor):
    """El número «redondo» más cerca de valor: 1 o 5 por una potencia de
    diez (1, 5, 10, 50, 100, 500, 1000…). Sin el 2, a propósito: con
    rayitas cada 1000 los años escritos caen cada 5000 (−25000, −20000…),
    y con rayitas cada 500, cada 1000. Con rayitas cada 2000 caerían en
    −24000, −20000, −16000, que no es como se cuenta."""
    if valor <= 1:
        return 1
    import math
    candidatos = []
    for potencia in range(0, len(str(int(valor))) + 2):
        for cifra in (1, 5):
            candidatos.append(cifra * 10 ** potencia)
    return min(candidatos, key=lambda c: abs(math.log(c / valor)))


def tramos(eventos):
    """Para cada hueco entre dos cosas seguidas de la línea (eventos, y
    principios y finales de era): su alto en rem, si se ha cortado y las
    rayitas de dentro, como [(posición en %, año o None)].

    Devuelve (lista de tramos, rem por año)."""
    huecos = [b["fecha"] - a["fecha"] for a, b in zip(eventos, eventos[1:])]
    positivos = [h for (a, b), h in zip(zip(eventos, eventos[1:]), huecos)
                 if h > 0 and not cruza_el_hueco(a["fecha"], b["fecha"])] or \
        [h for h in huecos if h > 0]
    if not positivos:
        return [{"alto": MINIMO, "corte": False, "rayas": [], "anyos": h} for h in huecos], 0
    por_anyo = OBJETIVO / statistics.median(positivos)

    paso = _redondo(RAYA_CADA / por_anyo)
    rotulo_cada = paso * (2 if str(paso)[0] == "5" else 5)

    salida = []
    for (a, b), hueco in zip(zip(eventos, eventos[1:]), huecos):
        if cruza_el_hueco(a["fecha"], b["fecha"]):
            # El hueco sin medir del calendario: siempre cortado, y sin
            # número de años, que no se sabe.
            salida.append({"alto": CORTE, "corte": True, "rayas": [], "anyos": None})
            continue
        natural = hueco * por_anyo
        if natural > MAXIMO:
            salida.append({"alto": CORTE, "corte": True, "rayas": [], "anyos": hueco})
            continue
        alto = max(natural, MINIMO)
        rayas = []
        if hueco > 0:
            primero = -(-(a["fecha"] + 1) // paso) * paso
            t = primero
            while t < b["fecha"]:
                parte = (t - a["fecha"]) / hueco
                desde_arriba, desde_abajo = parte * alto, (1 - parte) * alto
                if min(desde_arriba, desde_abajo) >= APARTE_RAYA:
                    rotulo = (t % rotulo_cada == 0
                              and min(desde_arriba, desde_abajo) >= APARTE_ANYO)
                    rayas.append((round(parte * 100, 2), t if rotulo else None))
                t += paso
        salida.append({"alto": round(alto, 2), "corte": False, "rayas": rayas,
                       "anyos": hueco})
    return salida, por_anyo


# =========================================
# PINTAR LA LÍNEA
# =========================================

def resumen_plano(evento):
    """El resumen como texto: los [[enlaces]] se quedan en su nombre (la
    tarjeta entera ya es un enlace, y un enlace dentro de otro no vale)."""
    texto = str(evento.get("resumen") or "").strip()
    texto = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", texto)
    texto = re.sub(r"\[\[([^\]#|]+)(?:#[^\]]*)?\]\]", r"\1", texto)
    return re.sub(r"\s+", " ", texto)


def pintar_tramo(tramo):
    trozos = ['<div class="linea-tramo" aria-hidden="true">']
    if tramo["corte"]:
        trozos.append('<span class="linea-corte"><span class="linea-corte-signo">≈</span>'
                      '<span class="linea-corte-texto">%s</span></span>'
                      % html.escape(cuantos_anyos(tramo["anyos"])))
    for donde, rotulo in tramo["rayas"]:
        if rotulo is None:
            trozos.append('<span class="linea-raya" style="top: %s%%"></span>' % donde)
        else:
            trozos.append('<span class="linea-raya es-grande" style="top: %s%%">'
                          '<span class="linea-raya-anyo">%s</span></span>'
                          % (donde, html.escape(anyo_corto(rotulo))))
    trozos.append("</div>")
    return "".join(trozos)


def elementos(eventos, eras):
    """Todo lo que va en la línea, en orden: los eventos, el principio de
    cada era y, si una era acaba antes de que empiece la siguiente, su
    final. Cada uno con su "fecha", que es lo que mide la escala.

    A igual año: primero lo que empieza (la era), luego los eventos y al
    final lo que acaba: un evento en el último año de una era es suyo."""
    cosas = [{"tipo": "evento", "fecha": e["fecha"], "evento": e, "orden": (1, e["orden"])}
             for e in eventos]
    for era in eras:
        cosas.append({"tipo": "era", "fecha": era["desde"], "era": era,
                      "orden": (0, era["orden"])})
        if era["cierra"]:
            cosas.append({"tipo": "fin", "fecha": era["hasta"], "era": era,
                          "orden": (2, era["orden"])})
    if HOY[0] is not None and (not cosas or HOY[0] >= max(c["fecha"] for c in cosas)):
        cosas.append({"tipo": "hoy", "fecha": HOY[0], "orden": (3, 0)})
    cosas.sort(key=lambda c: (c["fecha"], c["orden"]))
    return cosas


def _color_de_era(era):
    return ' style="--era-color: %s"' % era["color"] if era.get("color") else ""


def _estilo(tramo):
    return ' style="--tramo: %srem"' % tramo["alto"] if tramo else ""


def pintar_evento(evento, lado, tramo, nivel):
    resumen = resumen_plano(evento)
    clases = "linea-evento %s%s" % (lado, " es-ultimo" if tramo is None else "")
    return ('<li id="%s" class="%s"%s>'
            '<span class="linea-punto" aria-hidden="true"></span>'
            '<div class="linea-tarjeta">'
            '<p class="linea-fecha">%s</p>'
            '<h%d class="linea-nombre"><a class="linea-enlace" href="%s">%s</a></h%d>'
            '%s'
            '</div>'
            '%s'
            '</li>'
            % (evento["slug"], clases, _estilo(tramo),
               html.escape(fecha_visible(evento)),
               nivel, html.escape(evento["url"], quote=True), html.escape(evento["nombre"]), nivel,
               '<p class="linea-resumen">%s</p>' % html.escape(resumen) if resumen else "",
               pintar_tramo(tramo) if tramo else ""))


def pintar_linea(eventos, eras=()):
    """La línea entera. Sin eras, una lista de eventos. Con eras, cada era
    es un <section> con su título (un <h2>) y su lista de eventos (con
    <h3>); lo que cae fuera de cualquier era va en listas sueltas."""
    if not eventos:
        return ('<p class="linea-vacia">Todavía no hay ningún evento. Se añaden con'
                ' herramientas/1-publicar/linea-de-tiempo.py.</p>')
    cosas = elementos(eventos, list(eras))
    lista, _ = tramos(cosas)
    nivel = 3 if eras else 2
    salida = ['<div class="linea">']
    en_era = False      # dentro de un <section> de era
    lista_abierta = False
    n_evento = 0
    n_era = 0

    def cerrar_lista():
        nonlocal lista_abierta
        if lista_abierta:
            salida.append("</ol>")
            lista_abierta = False

    def cerrar_era():
        nonlocal en_era
        cerrar_lista()
        if en_era:
            salida.append("</section>")
            en_era = False

    for n, cosa in enumerate(cosas):
        tramo = lista[n] if n < len(lista) else None
        if cosa["tipo"] == "era":
            cerrar_era()
            era = cosa["era"]
            resumen = resumen_plano(era)
            salida.append(
                '<section id="%s" class="linea-era %s"%s aria-labelledby="%s-titulo">'
                '<div class="linea-era-cabecera%s"%s>'
                '<div class="linea-era-rotulo">'
                '<h2 class="linea-era-nombre" id="%s-titulo">%s</h2>'
                '<p class="linea-era-fechas">%s</p>%s'
                '</div>%s</div>'
                % (era["slug"], "es-par" if n_era % 2 == 0 else "es-impar",
                   _color_de_era(era), era["slug"],
                   " es-ultimo" if tramo is None else "", _estilo(tramo),
                   era["slug"], html.escape(era["nombre"]),
                   html.escape(fechas_de_era(era)),
                   '<p class="linea-era-resumen">%s</p>' % html.escape(resumen) if resumen else "",
                   pintar_tramo(tramo) if tramo else ""))
            en_era = True
            n_era += 1
        elif cosa["tipo"] == "fin":
            cerrar_lista()
            salida.append(
                '<div class="linea-era-fin%s"%s>'
                '<p class="linea-era-fin-texto">aquí acaba «%s»</p>%s</div>'
                % (" es-ultimo" if tramo is None else "", _estilo(tramo),
                   html.escape(cosa["era"]["nombre"]),
                   pintar_tramo(tramo) if tramo else ""))
            cerrar_era()
        elif cosa["tipo"] == "hoy":
            cerrar_lista()
            salida.append('<div class="linea-hoy"><p class="linea-hoy-texto">hoy · %s</p></div>'
                          % html.escape(anyo(cosa["fecha"])))
        else:
            if not lista_abierta:
                salida.append('<ol class="linea-lista" aria-label="%s">'
                              % ("Eventos de %s" % html.escape(cosas_era_nombre(cosas, n))
                                 if en_era else "Eventos"))
                lista_abierta = True
            lado = "es-izquierda" if n_evento % 2 == 0 else "es-derecha"
            salida.append(pintar_evento(cosa["evento"], lado, tramo, nivel))
            n_evento += 1
    cerrar_era()
    salida.append("</div>")
    return "\n".join(salida)


def cosas_era_nombre(cosas, n):
    """El nombre de la era en la que está la cosa n (la última que ha
    empezado antes)."""
    for cosa in reversed(cosas[:n]):
        if cosa["tipo"] == "era":
            return cosa["era"]["nombre"]
    return ""


# =========================================
# LA LÍNEA EN PEQUEÑO, PARA LA PORTADA
# =========================================
# En la columna de «mapas y línea de tiempo» de la portada de la wiki sale
# la línea en pequeño, de arriba abajo como en su página, con TEXTO: el año
# y el nombre de cada evento en su recuadrito (que lleva a su página) y el
# nombre de cada era. La pinta scripts/paginas/mundo.js con lo que va aquí,
# en el campo "mini" de la ficha de la línea en datos/wiki/mundo.json:
#
#     "alto"   lo que mide la línea entera, en rem de la escala
#     "cosas"  cada evento, era o corte, con su "y" (en rem, desde arriba)
#
# Es la misma escala que la página (los mismos tramos), así que lo que está
# cerca en el tiempo está cerca aquí también. mundo.js la encoge a píxeles.

def mini(eventos, eras=()):
    cosas = elementos(eventos, list(eras))
    lista, _ = tramos(cosas)
    ys, y = [], 0.0
    for n in range(len(cosas)):
        ys.append(round(y, 2))
        if n < len(lista):
            y += lista[n]["alto"]
    total = round(y, 2)
    salida, n_evento, n_era = [], 0, 0
    for n, cosa in enumerate(cosas):
        if cosa["tipo"] == "evento":
            e = cosa["evento"]
            salida.append({"tipo": "evento", "y": ys[n], "nombre": e["nombre"],
                           "fecha": fecha_visible(e), "url": e["url"],
                           "lado": "izquierda" if n_evento % 2 == 0 else "derecha"})
            n_evento += 1
        elif cosa["tipo"] == "era":
            era = cosa["era"]
            hasta = total
            for m in range(n + 1, len(cosas)):
                if cosas[m]["tipo"] == "era" or (cosas[m]["tipo"] == "fin"
                                                 and cosas[m]["era"] is era):
                    hasta = ys[m]
                    break
            salida.append({"tipo": "era", "y": ys[n], "hasta": hasta,
                           "nombre": era["nombre"], "fechas": fechas_de_era(era),
                           "url": URL + PAGINA + "#" + era["slug"],
                           "par": n_era % 2 == 0, "color": era.get("color") or ""})
            n_era += 1
        elif cosa["tipo"] == "hoy":
            salida.append({"tipo": "hoy", "y": ys[n], "texto": "hoy · " + anyo(cosa["fecha"])})
        if n < len(lista) and lista[n]["corte"]:
            salida.append({"tipo": "corte", "y": round(ys[n] + lista[n]["alto"] / 2, 2)})
    return {"alto": total, "cosas": salida}


# =========================================
# LAS FICHAS PARA LA PORTADA (datos/wiki/mundo.json)
# =========================================

GRUPO = "historia"


def fichas(cabecera, eventos, por_pagina=None):
    """Lo que la línea de tiempo añade al índice de la portada: la línea
    (con su dibujito, que la pone en la columna de los mapas) y cada
    evento. Van marcadas con "linea" para poder quitarlas y volver a
    ponerlas sin tocar lo demás."""
    if not eventos:
        return []
    primera, ultima = fecha_visible(eventos[0]), fecha_visible(eventos[-1])
    eras = cabecera.get("eras") or []
    cuantos = "1 evento" if len(eventos) == 1 else "%d eventos" % len(eventos)
    salida = [{
        "titulo": cabecera.get("titulo") or TITULO_POR_DEFECTO,
        "url": URL + PAGINA,
        "carpeta": GRUPO,
        "etiquetas": ["línea de tiempo"],
        "grupo": GRUPO,
        "sub": [],
        "que": ("%s, de %s a %s" % (cuantos, primera, ultima) if len(eventos) > 1 else cuantos)
               + ("" if not eras else " · 1 era" if len(eras) == 1 else " · %d eras" % len(eras)),
        # La línea en pequeño, con texto (ver mini()). Con esto sale en la
        # columna de los mapas de la portada, y no en la lista.
        "mini": mini(eventos, eras),
        "resumen": "",
        "linea": True,
    }]
    for e in eventos:
        era = era_de(e, eras)
        salida.append({
            "titulo": e["nombre"],
            "url": e["url"],
            "carpeta": GRUPO,
            "etiquetas": ["evento"],
            "grupo": GRUPO,
            "sub": ["evento"],
            "que": cuando(e) + (" · " + era["nombre"] if era else ""),
            "resumen": resumen_plano(e),
            "linea": True,
        })
    return salida


def poner_fichas(nuevas, probar=False):
    """Quita de datos/wiki/mundo.json las fichas de la línea que hubiera y
    pone las de ahora, delante de «lo demás» (que va siempre al final)."""
    todas = leer_json(INDICE, [])
    if not isinstance(todas, list):
        todas = []
    resto = [f for f in todas if isinstance(f, dict) and not f.get("linea")]
    antes = [f for f in resto if f.get("grupo") != "lo demás"]
    despues = [f for f in resto if f.get("grupo") == "lo demás"]
    salida = antes + nuevas + despues
    if salida != todas and not probar:
        escribir_json(INDICE, salida)
    return salida != todas


# =========================================
# CADA EVENTO, SU PÁGINA
# =========================================
# Con la misma plantilla que un artículo de la wiki (mundo-pagina.html), así
# que se ven igual: el texto a la izquierda y una ficha a la derecha con el
# año, la imagen y el evento de antes y el de después.

RE_TITULO_H1 = re.compile(r'<h1 class="mundo-titulo">(.*?)</h1>', re.S)


def quien_enlaza(eventos):
    """{url de un evento: [(título, url)]} de las páginas de la wiki que lo
    enlazan. Se mira el HTML ya escrito: es lo más fiable y no hace falta
    la bóveda para saberlo."""
    urls = {e["url"] for e in eventos}
    salida = {u: [] for u in urls}
    if not WIKI.is_dir():
        return salida
    for pagina in sorted(WIKI.rglob("*.html")):
        if es_de_la_linea(pagina) or pagina.name == "index_wiki.html":
            continue
        texto, _ = leer_texto(pagina)
        m = RE_TITULO_H1.search(texto)
        if not m:
            continue
        titulo = html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()
        for url in urls:
            if ('href="%s"' % url) in texto:
                salida[url].append((titulo, WIKI_URL + pagina.relative_to(WIKI).as_posix()))
    return salida


def _a_que_lleva(eventos):
    """Lo que un [[enlace]] del texto de un evento sabe resolver: otro
    evento, una página de la wiki ya escrita o un mapa."""
    eventos_por_nombre = por_nombre(eventos)
    # Las páginas de la wiki ya escritas, por el nombre de su archivo: van
    # en subcarpetas (las mismas que en wiki/), así que se buscan todas.
    escritas = {}
    if WIKI.is_dir():
        for pagina in WIKI.rglob("*.html"):
            if es_de_la_linea(pagina):
                continue
            escritas.setdefault(pagina.stem, pagina.relative_to(WIKI).as_posix())

    def ruta(nombre):
        nombre = nombre.strip()
        ev = eventos_por_nombre.get(nombre.lower())
        if ev:
            return ev["url"], True
        for candidato in (slug(nombre), "mapa_" + slug(nombre)):
            if candidato in escritas:
                return WIKI_URL + escritas[candidato], True
        return WIKI_URL + slug(nombre) + ".html", False
    return ruta


def _imagen(nombre):
    """Una imagen: una dirección del sitio que exista, o el nombre de una
    que ya esté en imagenes/wiki/ (o en imagenes/wiki/eventos/)."""
    pedido = str(nombre or "").strip()
    if not pedido:
        return ""
    if pedido.startswith("/") and not pedido.startswith("//"):
        return pedido if (RAIZ / pedido.lstrip("/")).is_file() else ""
    suelto = pedido.replace("\\", "/").rsplit("/", 1)[-1]
    for carpeta in (IMAGENES / "eventos", IMAGENES):
        if (carpeta / suelto).is_file():
            return "/" + (carpeta / suelto).relative_to(RAIZ).as_posix()
    return ""


def _enlace(evento, texto=None):
    return '<a class="mundo-enlace" href="%s">%s</a>' % (
        html.escape(evento["url"], quote=True), html.escape(texto or evento["nombre"]))


def pintar_ficha(evento, antes, despues, era, avisos):
    trozos = ['<aside class="mundo-ficha" role="note" aria-labelledby="mundo-ficha-titulo">',
              '<h2 class="mundo-ficha-titulo" id="mundo-ficha-titulo">%s</h2>'
              % html.escape(evento["nombre"])]
    imagen = str(evento.get("imagen") or "").strip()
    if imagen:
        ruta = _imagen(imagen)
        if ruta:
            pie = str(evento.get("pie") or "").strip()
            foto = ('<img class="mundo-ficha-img" src="%s" alt="%s" loading="lazy" decoding="async">'
                    % (html.escape(ruta, quote=True), html.escape(pie, quote=True)))
            if pie:
                foto = "<figure>%s<figcaption>%s</figcaption></figure>" % (foto, html.escape(pie))
            trozos.append('<div class="mundo-ficha-fotos"><ul><li class="mundo-ficha-foto">%s'
                          '</li></ul></div>' % foto)
        else:
            avisos.di("imagen que no encuentro", imagen)
    trozos.append('<p class="mundo-ficha-que">evento</p>')
    filas = [("cuándo", html.escape(fecha_visible(evento)))]
    if era:
        filas.append(("era", '<a class="mundo-enlace" href="%s%s#%s">%s</a>'
                      ' <span class="linea-ficha-anyo">(%s)</span>'
                      % (URL, PAGINA, era["slug"], html.escape(era["nombre"]),
                         html.escape(fechas_de_era(era)))))
    if antes:
        filas.append(("antes", "%s <span class=\"linea-ficha-anyo\">(%s)</span>"
                      % (_enlace(antes), html.escape(fecha_visible(antes)))))
    if despues:
        filas.append(("después", "%s <span class=\"linea-ficha-anyo\">(%s)</span>"
                      % (_enlace(despues), html.escape(fecha_visible(despues)))))
    filas.append(("en la línea", '<a class="mundo-enlace" href="%s%s#%s">verlo en su sitio</a>'
                  % (URL, PAGINA, evento["slug"])))
    trozos.append('<dl class="mundo-ficha-datos">')
    for nombre, valor in filas:
        trozos.append('<div class="mundo-ficha-fila"><dt>%s</dt><dd>%s</dd></div>'
                      % (html.escape(nombre), valor))
    trozos.append("</dl></aside>")
    return "".join(trozos)


def pintar_backlinks(lista):
    if not lista:
        return ""
    filas = "".join('<li><a class="mundo-enlace" href="%s">%s</a></li>'
                    % (html.escape(url, quote=True), html.escape(titulo))
                    for titulo, url in sorted(set(lista), key=lambda x: x[0].lower()))
    return ('<nav class="mundo-backlinks" aria-labelledby="mundo-backlinks-titulo">'
            '<h2 id="mundo-backlinks-titulo">Se habla de esto en</h2><ul>%s</ul></nav>'
            % filas)


def _rellenar(molde, cambios):
    for marca, valor in cambios:
        molde = molde.replace(marca, valor)
    return molde


def _escribir(destino, texto, probar):
    if probar:
        return False
    if destino.is_file() and leer_texto(destino)[0] == texto:
        return False
    destino.parent.mkdir(parents=True, exist_ok=True)
    escribir_texto(destino, texto)
    return True


def pagina_de_evento(molde, evento, antes, despues, enlazan, ruta, era, avisos):
    conversor = Conversor(ruta, _imagen, avisos, None)
    texto = str(evento.get("texto") or "").strip()
    resumen = resumen_plano(evento)
    if texto:
        cuerpo = conversor.a_html(texto)
    elif resumen:
        cuerpo = "<p>%s</p>" % html.escape(resumen)
    else:
        cuerpo = '<p class="mundo-falta">Todavía no hay nada escrito de este evento.</p>'
    for nombre in conversor.enlaces:
        if not ruta(nombre)[1]:
            avisos.di("enlace a una página que no existe", nombre)
    etiqueta = ('<p class="mundo-etiquetas"><span class="mundo-etiquetas-label">etiquetas:</span>'
                '<a class="mundo-etiqueta" href="%sindex_wiki.html?buscar=%s">evento</a></p>'
                % (WIKI_URL, urllib.parse.quote("evento")))
    relleno = _rellenar(molde, (
        ("{{TITULO}}", html.escape(evento["nombre"])),
        ("{{SUBTITULO_BLOQUE}}", '<p class="mundo-subtitulo">%s</p>'
         % html.escape(cuando(evento))),
        ("{{DESCRIPCION}}", html.escape(resumen or evento["nombre"], quote=True)),
        # La plantilla pone /web/wiki/{{SLUG}}.html en la dirección
        # canónica: el evento vive en la carpeta de la línea.
        ("{{SLUG}}", CARPETA + "/" + evento["slug"]),
        # En su columna, como la ficha de cualquier entrada (la columna es
        # lo que se sube arriba en pantalla estrecha: mundo.responsive.css).
        # Encima, el «Contenido» de su texto (si tiene apartados), como en
        # las demás entradas.
        ("{{FICHA}}", '<div class="mundo-lateral">%s%s</div>'
                      % (pintar_contenido(cuerpo, bool(enlazan)),
                         pintar_ficha(evento, antes, despues, era, avisos))),
        ("{{CUERPO}}", cuerpo),
        ("{{ETIQUETAS}}", etiqueta),
        ("{{BACKLINKS}}", pintar_backlinks(enlazan)),
        # Dónde estás, como en el resto de entradas de la wiki (ver
        # pintar_migas en generar-mundo.py): la wiki, la línea de tiempo
        # (en el sitio de este evento) y el evento.
        ("{{MIGAS}}", '<div class="mundo-migas" role="navigation" aria-label="Dónde estás"><ol>'
                      '<li><a href="%sindex_wiki.html">Wiki Cralëa</a></li>'
                      '<li><a href="%s%s#%s">Línea de tiempo</a></li>'
                      '<li aria-current="page">%s</li></ol></div>'
                      % (WIKI_URL, URL, PAGINA, html.escape(evento["slug"], quote=True),
                         html.escape(evento["nombre"]))),
    ))
    # Desde un evento se vuelve a la línea, no a la portada de la wiki.
    return relleno.replace(
        '<a class="mundo-volver" href="/web/wiki/index_wiki.html">← volver a la wiki</a>',
        '<a class="mundo-volver" href="%s%s#%s">← volver a la línea de tiempo</a>'
        % (URL, PAGINA, evento["slug"])).replace(
        '<a class="mundo-volver mundo-volver-abajo" href="/web/wiki/index_wiki.html">← volver a la wiki</a>',
        '<a class="mundo-volver mundo-volver-abajo" href="%s%s#%s">← volver a la línea de tiempo</a>'
        % (URL, PAGINA, evento["slug"]))


def generar(probar=False, avisar=print):
    """Escribe todo lo de la línea. Devuelve un resumen para contarlo:
    {"eventos", "escritas", "quitadas", "avisos": [(evento, [(qué, dónde)])]}."""
    cabecera, eventos = leer(avisar)
    eras = cabecera.get("eras") or []
    ruta = _a_que_lleva(eventos)
    escritas, avisos_por_evento = 0, []

    # Lo que enlaza cada evento: otras páginas de la wiki y otros eventos.
    enlazan = quien_enlaza(eventos)
    eventos_por_nombre = por_nombre(eventos)
    for e in eventos:
        for nombre in enlaces_de(e):
            otro = eventos_por_nombre.get(nombre.strip().lower())
            if otro and otro is not e:
                enlazan[otro["url"]].append((e["nombre"], e["url"]))

    if eventos:
        molde = limpiar_comentarios_html(leer_texto(PLANTILLA_EVENTO)[0])[0]
        for n, e in enumerate(eventos):
            avisos = Avisos()
            antes = eventos[n - 1] if n > 0 else None
            despues = eventos[n + 1] if n + 1 < len(eventos) else None
            texto = pagina_de_evento(molde, e, antes, despues, enlazan[e["url"]], ruta,
                                     era_de(e, eras), avisos)
            if _escribir(SALIDA / (e["slug"] + ".html"), texto, probar):
                escritas += 1
            largo = len(resumen_plano(e))
            if largo > RESUMEN_MAXIMO:
                avisos.di("el resumen es largo para la tarjeta (%d letras; mejor menos de %d)"
                          % (largo, RESUMEN_MAXIMO), "")
            if avisos:
                avisos_por_evento.append((e["nombre"], avisos.lista))

        molde = limpiar_comentarios_html(leer_texto(PLANTILLA_LINEA)[0])[0]
        primera, ultima = fecha_visible(eventos[0]), fecha_visible(eventos[-1])
        descripcion = "%s: %s, de %s a %s." % (
            cabecera["titulo"], "1 evento" if len(eventos) == 1 else "%d eventos" % len(eventos),
            primera, ultima)
        texto = _rellenar(molde, (
            ("{{TITULO}}", html.escape(cabecera["titulo"])),
            ("{{INTRO}}", html.escape(cabecera["intro"])),
            ("{{DESCRIPCION}}", html.escape(descripcion, quote=True)),
            ("{{LINEA}}", pintar_linea(eventos, eras)),
        ))
        if _escribir(SALIDA / PAGINA, texto, probar):
            escritas += 1

    # Lo que sobra: eventos que ya no están (o la línea entera, si no
    # queda ninguno).
    buenas = paginas_mias(eventos)
    quitadas = []
    # Y lo que dejó en la raíz de web/wiki/ la versión de antes.
    viejas = [p for p in WIKI.glob("*.html") if es_mia(p.name)] if WIKI.is_dir() else []
    for pagina in viejas:
        quitadas.append(pagina.name)
        if not probar:
            pagina.unlink()
    if SALIDA.is_dir():
        for pagina in sorted(SALIDA.glob("*.html")):
            if es_mia(pagina.name) and pagina.name not in buenas:
                quitadas.append(pagina.name)
                if not probar:
                    pagina.unlink()
    # El dibujo que había antes (un SVG), si sigue por ahí: ahora la
    # portada pinta la línea en pequeño con texto.
    if VISTA.is_file():
        quitadas.append(VISTA.name)
        if not probar:
            VISTA.unlink()

    if poner_fichas(fichas(cabecera, eventos), probar):
        escritas += 1
    return {"eventos": eventos, "escritas": escritas, "quitadas": quitadas,
            "avisos": avisos_por_evento}

