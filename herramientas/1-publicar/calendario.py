#!/usr/bin/env python3
# =========================================
# EL CALENDARIO DE LA WIKI
# =========================================
# Lleva lo que sale marcado en el calendario de la portada de la wiki (la
# tarjeta de la columna de la derecha, entre el mapamundi y la línea de
# tiempo): las festividades y los eventos de cada mes del Ciclo de los
# Heraldos. Todo está en datos/wiki/calendario.json; esto es lo mismo que
# editarlo a mano, pero sin pelearse con las comillas.
#
#     python herramientas/1-publicar/calendario.py
#
# Sale lo que hay, mes a mes, y debajo:
#
#     a  añadir una festividad o un evento
#     c  cambiar uno
#     q  quitar uno
#     h  el día de hoy en Cralëa (se marca, y el calendario abre en su mes)
#
# CADA COSA:
#
#     nombre    lo que se ve.
#     mes       el número (1 a 12) o el nombre («Valentía», «Susurro»…);
#               13, o «fin», para los cuatro días del Fin del Ciclo.
#     día       1 a 28 (en el Fin del Ciclo, 1 a 4). Es el número que se
#               resalta en la rejilla; lo de cada día sale en un globo al
#               pasar el ratón por encima.
#     tipo      festividad (se repite cada año) o evento (algo que pasó o
#               pasará: una batalla, una coronación…).
#     año       opcional, sobre todo para los eventos: como se lea
#               («1340 DEM»).
#     resumen   una o dos frases.
#     enlace    opcional: una página de la wiki, a la que lleva pulsar el
#               día (sin enlace, lleva a su mes en la entrada del
#               calendario). Vale su nombre entre
#               corchetes ([[La Gran Sequía]]) o la dirección (/web/wiki/…).
#
# Cómo es el año (los meses, sus Heraldos, la semana, los días del Fin del
# Ciclo) también está en el JSON, pero no hace falta tocarlo; lo que se
# cuenta de cada mes está en wiki/Calendario/El Ciclo de los Heraldos.md.
#
# CADA CAMBIO SE GUARDA AL MOMENTO, y no hay que generar nada: la portada
# lee el JSON tal cual.

import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from comun import RAIZ, escribir_json, leer_json, preguntar  # noqa: E402

ARCHIVO = RAIZ / "datos" / "wiki" / "calendario.json"
INDICE = RAIZ / "datos" / "wiki" / "mundo.json"
SI = ("s", "si", "sí")
DIAS_MES = 28


def llano(texto):
    texto = unicodedata.normalize("NFD", str(texto or "").lower())
    return "".join(c for c in texto if unicodedata.category(c) != "Mn").strip()


# =========================================
# LEER Y GUARDAR
# =========================================

def cargar():
    datos = leer_json(ARCHIVO, None)
    if not isinstance(datos, dict) or not isinstance(datos.get("meses"), list) or not datos["meses"]:
        print(f"  No encuentro los meses en {ARCHIVO.relative_to(RAIZ)}.")
        print("  Ese archivo es el que dice cómo es el año; sin él no puedo hacer nada.")
        sys.exit(1)
    if not isinstance(datos.get("eventos"), list):
        datos["eventos"] = []
    return datos


def total_meses(datos):
    return len(datos["meses"]) + (1 if (datos.get("fin") or {}).get("dias") else 0)


def dias_de(datos, mes):
    if mes <= len(datos["meses"]):
        return DIAS_MES
    return len((datos.get("fin") or {}).get("dias") or [])


def nombre_del_mes(datos, mes):
    if 1 <= mes <= len(datos["meses"]):
        return datos["meses"][mes - 1].get("nombre", f"mes {mes}")
    return (datos.get("fin") or {}).get("nombre", "Fin del Ciclo")


def clave(ev):
    dia = ev.get("dia")
    return (int(ev.get("mes") or 99), dia is not None, dia or 0, llano(ev.get("nombre")))


def guardar(datos):
    datos["eventos"].sort(key=clave)
    escribir_json(ARCHIVO, datos)


# =========================================
# ENSEÑAR
# =========================================

def cuando(datos, ev):
    mes = int(ev.get("mes") or 0)
    dia = ev.get("dia")
    if dia is None:
        return "sin día (no sale)"
    if mes > len(datos["meses"]):
        dias = (datos.get("fin") or {}).get("dias") or []
        return dias[dia - 1]["nombre"] if 1 <= dia <= len(dias) else f"día {dia}"
    return f"día {dia}"


def ensenar(datos):
    print("\n  ==================================")
    print(f"  {datos.get('nombre') or 'El calendario'}")
    print("  ==================================")
    hoy = datos.get("hoy")
    if isinstance(hoy, dict) and hoy.get("mes"):
        print(f"  Hoy en Cralëa: {cuando(datos, hoy)} del {nombre_del_mes(datos, int(hoy['mes']))}")
    eventos = datos["eventos"]
    if not eventos:
        print("\n  Todavía no hay nada marcado.")
        return
    ultimo = None
    for n, ev in enumerate(eventos, start=1):
        mes = int(ev.get("mes") or 0)
        if mes != ultimo:
            ultimo = mes
            print(f"\n   ── {nombre_del_mes(datos, mes)}")
        extra = [ev.get("tipo") or "festividad"]
        if ev.get("anyo"):
            extra.append(f"año {ev['anyo']}")
        if ev.get("enlace"):
            extra.append("con enlace")
        print(f"   {n:>2}. {cuando(datos, ev):>16}  {ev.get('nombre') or '(sin nombre)'}"
              f"   [{', '.join(extra)}]")


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

def leer_mes(datos, dicho):
    """Un número, o el nombre del mes con o sin «Mes de», con o sin
    tildes. «fin» es el Fin del Ciclo."""
    dicho = llano(dicho)
    if not dicho:
        return None
    if dicho.isdigit():
        n = int(dicho)
        return n if 1 <= n <= total_meses(datos) else None
    limpio = re.sub(r"^(mes )?(de |del )?(la )?", "", dicho)
    for n, mes in enumerate(datos["meses"], start=1):
        nombre = re.sub(r"^(mes )?(de |del )?(la )?", "", llano(mes.get("nombre")))
        if limpio and (limpio == nombre or nombre.startswith(limpio)):
            return n
    if total_meses(datos) > len(datos["meses"]) and ("fin" in dicho or "ciclo" in dicho):
        return total_meses(datos)
    return None


def pedir_mes(datos, actual=None):
    print("     Meses: " + ", ".join(f"{n} {llano(m.get('nombre')).replace('mes de ', '').replace('mes del ', '')}"
                                     for n, m in enumerate(datos["meses"], start=1))
          + (f", {total_meses(datos)} fin del ciclo" if total_meses(datos) > len(datos["meses"]) else ""))
    while True:
        mes = leer_mes(datos, preguntar("Mes (número o nombre)", "" if actual is None else str(actual)))
        if mes:
            return mes
        print("     Ese mes no lo conozco.")


def pedir_dia(datos, mes, actual=None):
    tope = dias_de(datos, mes)
    if mes > len(datos["meses"]):
        dias = (datos.get("fin") or {}).get("dias") or []
        print("     " + ", ".join(f"{n} {d.get('nombre')}" for n, d in enumerate(dias, start=1)))
    while True:
        dicho = preguntar(f"Día (1 a {tope})", "" if actual is None else str(actual))
        if dicho.isdigit() and 1 <= int(dicho) <= tope:
            return int(dicho)
        print(f"     Tiene que ser un número del 1 al {tope}.")


def pedir_tipo(actual="festividad"):
    while True:
        dicho = llano(preguntar("¿Festividad (f) o evento (e)?", "f" if actual != "evento" else "e"))
        if dicho in ("f", "festividad", "fiesta"):
            return "festividad"
        if dicho in ("e", "evento"):
            return "evento"
        print("     f o e.")


def paginas_de_la_wiki():
    lista = leer_json(INDICE, []) or []
    return {llano(f.get("titulo")): f.get("url") for f in lista
            if isinstance(f, dict) and f.get("titulo") and f.get("url")}


def pedir_enlace(actual=""):
    paginas = None
    while True:
        dicho = preguntar("Enlace: [[Nombre de una página]] o /web/wiki/… (Enter en blanco: ninguno;"
                          " «-» para quitarlo)", actual)
        if not dicho or dicho == "-":
            return ""
        if dicho.startswith("/web/"):
            if (RAIZ / dicho.lstrip("/").split("#")[0]).is_file():
                return dicho
            print("     Esa página no existe.")
            continue
        nombre = dicho.strip("[] ")
        if paginas is None:
            paginas = paginas_de_la_wiki()
        url = paginas.get(llano(nombre))
        if url:
            print(f"     → {url}")
            return url
        parecidas = [t for t in paginas if llano(nombre) in t][:5]
        print(f"     No hay ninguna página que se llame «{nombre}»."
              + (" ¿Alguna de estas?: " + ", ".join(parecidas) if parecidas else ""))


def pedir_todo(datos, ev):
    while True:
        nombre = preguntar("Nombre", ev.get("nombre", ""))
        if nombre:
            ev["nombre"] = nombre
            break
        print("     Hace falta un nombre.")
    ev["tipo"] = pedir_tipo(ev.get("tipo", "festividad"))
    ev["mes"] = pedir_mes(datos, ev.get("mes"))
    actual = ev.get("dia") if ev.get("dia") and ev["dia"] <= dias_de(datos, ev["mes"]) else None
    ev["dia"] = pedir_dia(datos, ev["mes"], actual)
    anyo = preguntar("Año, si pasó un año concreto (como se lea: 1340 DEM; «-» para quitarlo)",
                     ev.get("anyo", ""))
    if anyo and anyo != "-":
        ev["anyo"] = anyo
    else:
        ev.pop("anyo", None)
    resumen = preguntar("Resumen (una o dos frases; «-» para quitarlo)", ev.get("resumen", ""))
    if resumen and resumen != "-":
        ev["resumen"] = resumen
    else:
        ev.pop("resumen", None)
    enlace = pedir_enlace(ev.get("enlace", ""))
    if enlace:
        ev["enlace"] = enlace
    else:
        ev.pop("enlace", None)
    return ev


def poner_hoy(datos):
    print("\n  El día de hoy en Cralëa: sale marcado y el calendario abre en su mes.")
    if preguntar("¿Lo quito, para que no haya ninguno? (s/N)", "n").lower() in SI:
        datos["hoy"] = None
        return
    actual = datos.get("hoy") if isinstance(datos.get("hoy"), dict) else {}
    mes = pedir_mes(datos, actual.get("mes"))
    dia = pedir_dia(datos, mes, actual.get("dia") if actual.get("mes") == mes else None)
    datos["hoy"] = {"mes": mes, "dia": dia}


# =========================================
# EL MENÚ
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
        print("     a. añadir una festividad o un evento")
        if hay:
            print("     c. cambiar uno")
            print("     q. quitar uno")
        print("     h. el día de hoy en Cralëa")
        print("     0. terminar")
        accion = preguntar("Elige", "0").lower()

        if accion in ("0", "", "salir", "terminar"):
            break
        if accion == "a":
            while True:
                ev = pedir_todo(datos, {})
                datos["eventos"].append(ev)
                guardar(datos)
                cambios += 1
                print(f"\n  Añadido «{ev['nombre']}» ({cuando(datos, ev)} del"
                      f" {nombre_del_mes(datos, ev['mes'])}).")
                if preguntar("¿Añado otro? (s/N)", "n").lower() not in SI:
                    break
        elif accion == "c" and hay:
            i = elegir_evento(datos, "¿Cuál cambio?")
            if i is not None:
                antes = json.dumps(datos["eventos"][i], sort_keys=True)
                pedir_todo(datos, datos["eventos"][i])
                if json.dumps(datos["eventos"][i], sort_keys=True) != antes:
                    guardar(datos)
                    cambios += 1
                    print("\n  Guardado.")
        elif accion == "q" and hay:
            i = elegir_evento(datos, "¿Cuál quito?")
            if i is not None:
                nombre = datos["eventos"][i].get("nombre")
                if preguntar(f"¿Quito «{nombre}»? (s/N)", "n").lower() in SI:
                    del datos["eventos"][i]
                    guardar(datos)
                    cambios += 1
                    print(f"\n  Quitado «{nombre}».")
        elif accion == "h":
            poner_hoy(datos)
            guardar(datos)
            cambios += 1
            print("\n  Guardado.")
        else:
            print(f"\n  {accion!r} no es ninguna de las opciones.")

    if cambios:
        print(f"\n  {cambios} cambio(s) en {ARCHIVO.relative_to(RAIZ)}. No hace falta generar"
              " nada: la portada de la wiki lo lee tal cual. Súbelo con lo demás.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
