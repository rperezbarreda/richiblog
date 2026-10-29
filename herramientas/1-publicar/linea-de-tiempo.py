#!/usr/bin/env python3
# =========================================
# LA LÍNEA DE TIEMPO DE LA WIKI
# =========================================
# Lleva los eventos de datos/wiki/linea-de-tiempo.json, que es de donde
# salen la página de la línea (web/wiki/linea-de-tiempo/linea_de_tiempo.html) y la página
# de cada evento. Es lo mismo que editar ese archivo a mano, pero sin
# pelearse con las comillas y viendo la lista mientras se toca.
#
#     python herramientas/1-publicar/linea-de-tiempo.py
#
# Sale la lista, de lo más antiguo a lo más reciente, y debajo:
#
#     a  añadir un evento
#     c  cambiar uno         el nombre, el año, hasta cuándo, cómo se
#                            escribe el año, el resumen, el texto de su
#                            página o la imagen
#     q  quitar uno
#     e  las eras            añadir, cambiar o quitar eras
#
# CADA EVENTO:
#
#     nombre       lo que sale en la tarjeta y el título de su página.
#                  Es también cómo se le enlaza desde la wiki: un
#                  [[La Gran Sequía]] en una página de la wiki lleva a él.
#     año          un número entero; los de antes del año 0, en negativo
#                  (-25500). Es lo que ordena la línea y lo que la separa.
#     hasta        opcional: si dura varios años (una guerra), el año en
#                  que acaba. Sale «−11420 a −11380».
#     cómo se lee  opcional: si el año se dice de otra manera ("342 de la
#                  Era Nueva", "hace mucho"), eso es lo que se ve. El año
#                  de verdad sigue haciendo falta para ordenarlo.
#     resumen      una o dos frases, para la tarjeta de la línea. Mejor por
#                  debajo de 180 letras: si no, la tarjeta estira la línea.
#     texto        lo de su página, en el mismo Markdown que la wiki
#                  (**negrita**, listas, [[enlaces]] a páginas de la wiki o
#                  a otros eventos…). Se escribe aquí párrafo a párrafo, o
#                  se pega la ruta de un .md donde lo tengas escrito.
#     imagen       opcional: la ruta donde la tengas en tu ordenador (se
#                  trae a imagenes/wiki/eventos/ en WebP) o el nombre de
#                  una que ya esté en imagenes/wiki/.
#
# LAS ERAS son los trozos grandes de la historia, como nuestra Edad
# Media: un nombre, desde qué año y, si quieres, hasta cuál (si no, dura
# hasta que empieza la siguiente; la última, hasta hoy) y una frase. En la
# línea, cada era es una franja con su nombre al principio, y los eventos
# que caen dentro son suyos. No hace falta decirle a cada evento en qué
# era está: se sabe por el año.
#
# CADA CAMBIO SE GUARDA AL MOMENTO. Al terminar se pasa
# generar-linea-tiempo.py, que escribe las páginas y lo de detrás (el
# sitemap, el mapa del sitio, el buscador y las cabeceras).

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "0-comun"))

from comun import RAIZ, escribir_json, leer_json, pasar_generadores, preguntar  # noqa: E402
from imagenes import SITIOS, nombre_para, parece_de_fuera, traer  # noqa: E402
import mundo_linea  # noqa: E402

ARCHIVO = mundo_linea.DATOS
SI = ("s", "si", "sí")

EXPLICACION = (
    "LA LÍNEA DE TIEMPO DE LA WIKI. Cada evento: \"nombre\", \"fecha\" (el año,"
    " un número; negativo para antes del año 0), y si quieres \"hasta\" (si dura"
    " varios años), \"fecha_texto\" (cómo se lee el año, si no es el número tal"
    " cual), \"resumen\" (para la tarjeta), \"texto\" (su página, en Markdown,"
    " con [[enlaces]] a la wiki) e \"imagen\". Cada era: \"nombre\", \"desde\","
    " y si quieres \"hasta\" (si no, hasta que empieza la siguiente) y"
    " \"resumen\". Se ordenan solos. Lo más cómodo es"
    " herramientas/1-publicar/linea-de-tiempo.py; si lo cambias a mano, pasa"
    " herramientas/3-generadores/generar-linea-tiempo.py.")


# =========================================
# LEER Y GUARDAR
# =========================================

def cargar():
    datos = leer_json(ARCHIVO, None)
    if isinstance(datos, list):
        datos = {"eventos": datos}
    if not isinstance(datos, dict):
        datos = {}
    datos.setdefault("_", EXPLICACION)
    datos.setdefault("titulo", mundo_linea.TITULO_POR_DEFECTO)
    datos.setdefault("intro", mundo_linea.INTRO_POR_DEFECTO)
    if not isinstance(datos.get("eventos"), list):
        datos["eventos"] = []
    return datos


def ordenar(datos):
    """En el archivo, en el mismo orden que en la web: así se lee bien a
    mano. Los que no tengan un año que se entienda, al final."""
    def clave(ev):
        f = mundo_linea.leer_fecha(ev.get("fecha"))
        return (f is None, f if f is not None else 0)
    datos["eventos"].sort(key=clave)


def guardar(datos):
    ordenar(datos)
    if datos.get("eras"):
        ordenar_eras(datos)
    escribir_json(ARCHIVO, datos)


# =========================================
# ENSEÑAR
# =========================================

def visible(ev):
    fecha = mundo_linea.leer_fecha(ev.get("fecha"))
    if str(ev.get("fecha_texto") or "").strip():
        return str(ev["fecha_texto"]).strip()
    if fecha is None:
        return "¿?"
    hasta = mundo_linea.leer_fecha(ev.get("hasta"))
    if hasta is not None and hasta > fecha:
        return "%s a %s" % (mundo_linea.anyo(fecha), mundo_linea.anyo(hasta))
    return mundo_linea.anyo(fecha)


def eras_leidas(datos):
    return mundo_linea.leer_eras(datos.get("eras") or [], avisar=lambda *_: None)


def ensenar(datos):
    eventos = datos["eventos"]
    print("\n  ==================================")
    print(f"  {datos.get('titulo') or mundo_linea.TITULO_POR_DEFECTO}")
    print("  ==================================")
    if not eventos:
        print("\n  Todavía no hay ningún evento.")
        return
    eras = eras_leidas(datos)
    ancho = max(len(visible(e)) for e in eventos)
    ultima = "-"
    for n, ev in enumerate(eventos, start=1):
        fecha = mundo_linea.leer_fecha(ev.get("fecha"))
        era = mundo_linea.era_de({"fecha": fecha}, eras) if fecha is not None else None
        if eras and (era["slug"] if era else None) != ultima:
            ultima = era["slug"] if era else None
            print(f"\n   ── {era['nombre']} ({mundo_linea.fechas_de_era(era)})" if era
                  else "\n   ── (fuera de cualquier era)")
        extra = []
        if ev.get("imagen"):
            extra.append("imagen")
        if str(ev.get("texto") or "").strip():
            extra.append("con texto")
        print(f"   {n:>2}. {visible(ev):>{ancho}}  {ev.get('nombre') or '(sin nombre)'}"
              + (f"   [{', '.join(extra)}]" if extra else ""))


def elegir_evento(datos, pregunta):
    dicho = preguntar(f"{pregunta} (número; Enter en blanco: ninguno)")
    if not dicho:
        return None
    try:
        n = int(dicho)
    except ValueError:
        n = 0
    if 1 <= n <= len(datos["eventos"]):
        return n - 1
    print(f"     {dicho!r} no es ninguno de la lista.")
    return None


# =========================================
# PREGUNTAR CADA COSA
# =========================================

def pedir_nombre(datos, actual=""):
    while True:
        nombre = preguntar("Nombre del evento", actual)
        if not nombre:
            print("     Hace falta un nombre.")
            continue
        repetido = [e for e in datos["eventos"]
                    if e.get("nombre") != actual
                    and mundo_linea.slug(e.get("nombre")) == mundo_linea.slug(nombre)]
        if repetido:
            print(f"     Ya hay uno que se llama «{repetido[0].get('nombre')}»: tendrían"
                  " la misma página. Ponle otro nombre.")
            continue
        return nombre


def pedir_fecha(actual=None):
    por_defecto = "" if actual is None else str(actual)
    while True:
        dicho = preguntar("Año (un número; los de antes del año 0, en negativo: -25500)",
                          por_defecto)
        fecha = mundo_linea.leer_fecha(dicho)
        if fecha is not None:
            return fecha
        print(f"     {dicho!r} no es un año que entienda: tiene que ser un número entero.")


def pedir_hasta(desde, actual=None, que="Si dura varios años, ¿hasta qué año?"):
    """Opcional. Enter: no dura (o se queda como está); «-» lo quita."""
    por_defecto = "" if actual is None else str(actual)
    while True:
        dicho = preguntar(f"{que} (Enter: no; «-» quita lo que haya)", por_defecto)
        if not dicho or dicho == "-":
            return None
        hasta = mundo_linea.leer_fecha(dicho)
        if hasta is None:
            print(f"     {dicho!r} no es un año que entienda.")
            continue
        if hasta <= desde:
            print(f"     Tiene que ser después de {desde}.")
            continue
        return hasta


def pedir_fecha_texto(actual=""):
    print("\n     Si el año se dice de otra manera («342 de la Era Nueva»), escríbelo.")
    print("     Enter en blanco: se ve el número tal cual. «-» para quitar lo que haya.")
    dicho = preguntar("Cómo se lee el año", actual)
    return "" if dicho == "-" else dicho


def pedir_resumen(actual=""):
    print("\n     Una o dos frases, para la tarjeta de la línea.")
    while True:
        dicho = preguntar("Resumen", actual)
        if len(dicho) > mundo_linea.RESUMEN_MAXIMO:
            print(f"     Son {len(dicho)} letras: en la tarjeta se lee mejor por debajo de"
                  f" {mundo_linea.RESUMEN_MAXIMO}, y si no, estira la línea.")
            if preguntar("¿Lo dejo así? (s/N)", "n").lower() not in SI:
                actual = dicho
                continue
        return dicho


def pedir_texto(actual=""):
    """El texto de su página: párrafo a párrafo, o la ruta de un .md."""
    print("\n     El texto de su página, en el Markdown de la wiki ([[Valderín]] enlaza")
    print("     a una página; **negrita**, *cursiva*…). Escribe un párrafo por línea y")
    print("     deja una línea en blanco para terminar. O pega la ruta de un .md o un")
    print("     .txt donde lo tengas escrito.")
    if actual:
        print("     (ya tiene texto: Enter en blanco lo deja como está; «-» lo borra)")
    primera = input("  > ").strip()
    if not primera:
        return actual
    if primera == "-":
        return ""
    ruta = Path(primera.strip("\"'"))
    if ruta.suffix.lower() in (".md", ".txt") and ruta.is_file():
        texto = ruta.read_text(encoding="utf-8").strip()
        print(f"     Leído {ruta.name}: {len(texto)} letras.")
        return texto
    parrafos = [primera]
    while True:
        linea = input("  > ").strip()
        if not linea:
            break
        parrafos.append(linea)
    return "\n\n".join(parrafos)


def pedir_imagen(nombre, actual=""):
    if actual:
        print(f"\n     Ahora tiene: {actual}  («-» para quitarla)")
    dicho = preguntar("Imagen (la ruta donde la tengas, o el nombre de una que ya esté;"
                      " Enter: ninguna)" if not actual else "Imagen", actual)
    if not dicho or dicho == actual:
        return actual
    if dicho == "-":
        return ""
    if parece_de_fuera(dicho):
        ajustes = SITIOS["evento"]
        ruta, aviso = traer(dicho, ajustes["carpeta"], nombre_para(nombre, ajustes["sufijo"]),
                            lado=ajustes["lado"], cuadrada=ajustes["cuadrada"])
        if not ruta:
            print(f"     No he podido traerla: {aviso}")
            return actual
        print(f"     Traída a {ruta}  ({aviso})")
        return ruta
    encontrada = mundo_linea._imagen(dicho)
    if not encontrada:
        print(f"     OJO: no encuentro {dicho} en imagenes/wiki/. Se apunta igual,")
        print("     pero hasta que esté la página sale sin imagen.")
        return dicho
    return encontrada


def nuevo_evento(datos):
    ev = {"nombre": pedir_nombre(datos)}
    ev["fecha"] = pedir_fecha()
    hasta = pedir_hasta(ev["fecha"])
    if hasta is not None:
        ev["hasta"] = hasta
    fecha_texto = pedir_fecha_texto()
    if fecha_texto:
        ev["fecha_texto"] = fecha_texto
    resumen = pedir_resumen()
    if resumen:
        ev["resumen"] = resumen
    texto = pedir_texto()
    if texto:
        ev["texto"] = texto
    imagen = pedir_imagen(ev["nombre"])
    if imagen:
        ev["imagen"] = imagen
    return ev


def poner(ev, campo, valor):
    if valor in ("", None):
        ev.pop(campo, None)
    else:
        ev[campo] = valor


def cambiar(datos, ev):
    while True:
        texto = str(ev.get("texto") or "")
        campos = [
            ("nombre", ev.get("nombre") or "-"),
            ("año", ev.get("fecha")),
            ("hasta", ev.get("hasta") if ev.get("hasta") not in (None, "") else "no dura"),
            ("cómo se lee el año", ev.get("fecha_texto") or "el número tal cual"),
            ("resumen", (ev.get("resumen") or "-")[:50]),
            ("texto de su página", f"{len(texto)} letras" if texto else "sin texto"),
            ("imagen", ev.get("imagen") or "sin imagen"),
        ]
        print(f"\n  Cambiando «{ev.get('nombre')}»")
        for n, (que, ahora) in enumerate(campos, start=1):
            print(f"     {n}. {que:<20} ({ahora})")
        dicho = preguntar("¿Qué cambio? (Enter en blanco: nada más)")
        if not dicho:
            return
        if dicho == "1":
            viejo = ev.get("nombre") or ""
            nuevo = pedir_nombre(datos, viejo)
            if nuevo != viejo:
                ev["nombre"] = nuevo
                print(f"     OJO: si alguna página de la wiki enlaza [[{viejo}]], ahora")
                print("     sale como «sin página». Cámbialo también en esas páginas.")
        elif dicho == "2":
            ev["fecha"] = pedir_fecha(ev.get("fecha"))
            if str(ev.get("fecha_texto") or "").strip():
                print(f"     OJO: en la web se sigue leyendo «{ev['fecha_texto']}».")
                print("     Si ya no vale, cámbialo en «cómo se lee el año» (opción 4).")
            hasta = mundo_linea.leer_fecha(ev.get("hasta"))
            if hasta is not None and hasta <= ev["fecha"]:
                print(f"     OJO: acababa en {hasta}, antes del año nuevo; le quito el «hasta».")
                ev.pop("hasta", None)
        elif dicho == "3":
            poner(ev, "hasta", pedir_hasta(ev["fecha"], mundo_linea.leer_fecha(ev.get("hasta"))))
        elif dicho == "4":
            poner(ev, "fecha_texto", pedir_fecha_texto(ev.get("fecha_texto") or ""))
        elif dicho == "5":
            poner(ev, "resumen", pedir_resumen(ev.get("resumen") or ""))
        elif dicho == "6":
            poner(ev, "texto", pedir_texto(texto))
        elif dicho == "7":
            poner(ev, "imagen", pedir_imagen(ev.get("nombre") or "evento",
                                             ev.get("imagen") or ""))
        else:
            print(f"     {dicho!r} no es ninguna de las opciones.")


# =========================================
# LAS ERAS
# =========================================

def ensenar_eras(datos):
    # Aquí sí con los avisos: si dos eras se pisan, es donde hay que verlo.
    eras = mundo_linea.leer_eras(datos.get("eras") or [])
    crudas = datos.get("eras") or []
    print("\n  ---- las eras ----")
    if not eras:
        print("  Todavía no hay ninguna.")
        return
    # En el orden del archivo (que se guarda ordenado), con lo que dura
    # cada una de verdad.
    for n, era in enumerate(eras, start=1):
        fin = era["fin"]
        dura = ("hasta hoy" if fin is None else
                f"hasta {mundo_linea.anyo(fin)}"
                + ("" if era["hasta"] is not None else " (donde empieza la siguiente)"))
        print(f"   {n:>2}. {era['nombre']}: desde {mundo_linea.anyo(era['desde'])}, {dura}")
    if len(crudas) != len(eras):
        print("  (hay alguna que no entiendo en el archivo: le falta el nombre o el «desde»)")


def ordenar_eras(datos):
    def clave(era):
        f = mundo_linea.leer_fecha(era.get("desde"))
        return (f is None, f if f is not None else 0)
    datos.setdefault("eras", []).sort(key=clave)


def pedir_nombre_de_era(datos, actual=""):
    while True:
        nombre = preguntar("Nombre de la era («Edad Media», «Era de los Dragones»…)", actual)
        if not nombre:
            print("     Hace falta un nombre.")
            continue
        if any(e.get("nombre") != actual and mundo_linea.slug(e.get("nombre")) == mundo_linea.slug(nombre)
               for e in datos.get("eras") or []):
            print("     Ya hay una que se llama así.")
            continue
        return nombre


def pedir_era(datos, era=None):
    era = era if era is not None else {}
    era["nombre"] = pedir_nombre_de_era(datos, era.get("nombre") or "")
    era["desde"] = pedir_fecha(mundo_linea.leer_fecha(era.get("desde")))
    print("\n     ¿Hasta qué año? Si no lo dices, dura hasta que empieza la siguiente")
    print("     (y la última, hasta hoy).")
    poner(era, "hasta", pedir_hasta(era["desde"], mundo_linea.leer_fecha(era.get("hasta")),
                                    "Hasta"))
    print("\n     Una frase que la cuente, debajo de su nombre en la línea (opcional).")
    poner(era, "resumen", preguntar("Resumen", era.get("resumen") or ""))
    return era


def las_eras(datos):
    cambios = 0
    while True:
        ensenar_eras(datos)
        hay = bool(datos.get("eras"))
        print("\n  ¿Qué hago con las eras?")
        print("     a. añadir una")
        if hay:
            print("     c. cambiar una")
            print("     q. quitar una (los eventos no se tocan)")
        print("     0. volver")
        accion = preguntar("Elige", "0").lower()
        if accion in ("0", "", "volver"):
            return cambios
        if accion == "a":
            datos.setdefault("eras", []).append(pedir_era(datos))
        elif accion in ("c", "q") and hay:
            ordenar_eras(datos)
            dicho = preguntar("¿Cuál? (número; Enter en blanco: ninguna)")
            try:
                n = int(dicho) - 1
            except ValueError:
                n = -1
            if not 0 <= n < len(datos["eras"]):
                continue
            if accion == "c":
                pedir_era(datos, datos["eras"][n])
            else:
                nombre = datos["eras"][n].get("nombre")
                if preguntar(f"¿Quito la era «{nombre}»? (s/N)", "n").lower() not in SI:
                    continue
                del datos["eras"][n]
        else:
            print(f"\n  {accion!r} no es ninguna de las opciones.")
            continue
        guardar(datos)
        cambios += 1
        print("\n  Guardado.")


# =========================================

def main():
    if "--listar" in sys.argv:
        ensenar(cargar())
        print()
        return 0

    datos = cargar()
    cambios = 0
    while True:
        ensenar(datos)
        hay = bool(datos["eventos"])
        print("\n  ¿Qué hago?")
        print("     a. añadir un evento")
        if hay:
            print("     c. cambiar uno")
            print("     q. quitar uno")
        print("     e. las eras")
        print("     0. terminar")
        accion = preguntar("Elige", "0").lower()

        if accion in ("0", "", "salir", "terminar"):
            break

        if accion == "a":
            while True:
                ev = nuevo_evento(datos)
                datos["eventos"].append(ev)
                guardar(datos)
                cambios += 1
                print(f"\n  Añadido «{ev['nombre']}» ({visible(ev)}).")
                if preguntar("¿Añado otro? (s/N)", "n").lower() not in SI:
                    break

        elif accion == "e":
            cambios += las_eras(datos)

        elif accion == "c" and hay:
            i = elegir_evento(datos, "¿Cuál cambio?")
            if i is not None:
                antes = dict(datos["eventos"][i])
                cambiar(datos, datos["eventos"][i])
                if datos["eventos"][i] != antes:
                    guardar(datos)
                    cambios += 1
                    print("\n  Guardado.")

        elif accion == "q" and hay:
            i = elegir_evento(datos, "¿Cuál quito?")
            if i is not None:
                nombre = datos["eventos"][i].get("nombre")
                if preguntar(f"¿Quito «{nombre}» y su página? (s/N)", "n").lower() in SI:
                    del datos["eventos"][i]
                    guardar(datos)
                    cambios += 1
                    print(f"\n  Quitado «{nombre}».")
        else:
            print(f"\n  {accion!r} no es ninguna de las opciones.")

    if cambios:
        print(f"\n  {cambios} cambio(s) en {ARCHIVO.relative_to(RAIZ)}. Escribo las páginas…")
        pasar_generadores(("3-generadores/generar-linea-tiempo.py",))
    else:
        print("\n  Sin cambios.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
