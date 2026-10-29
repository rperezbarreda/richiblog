#!/usr/bin/env python3
# =========================================
# EL BOTÍN DE UNA CAMPAÑA
# =========================================
# Lleva la lista de lo que el grupo va juntando: el "botin" del JSON de la
# campaña (datos/notas_rol/campana-<clave>.json), que es de donde sale la
# ventana «el botín →» del índice. Es lo mismo que editar ese archivo a
# mano, pero sin pelearse con las comas y viendo la lista entera mientras
# se toca.
#
#     python herramientas/1-publicar/botin.py
#     python herramientas/1-publicar/botin.py --campana ragna
#
# Sale la lista repartida por apartados, en el mismo orden que en la web,
# y debajo lo que se puede hacer:
#
#     a  añadir algo           lo que se ha conseguido en la partida
#     g  gastar algo           todo, o una parte si empieza por un número
#                              ("4 kits curativos" -> gastas 1 -> "3 kits")
#     d  devolver              deshace un gastado
#     c  cambiar algo          el nombre, el apartado, quién lo lleva, la
#                              sesión o la foto
#     q  quitar del todo       para lo que se apuntó por error
#
# GASTAR NO ES QUITAR. Lo gastado se queda en la lista, tachado y en gris,
# porque «qué tuvimos» es media discusión de cada partida. Quitar es para
# lo que no debió apuntarse nunca.
#
# CADA CAMBIO SE GUARDA AL MOMENTO, como en nuevo-personaje.py: si cierras
# la ventana a mitad, lo hecho hasta ahí ya está escrito.
#
# PARA AÑADIR UNA COSA SIN PREGUNTAS (desde el historial de la terminal):
#
#     python herramientas/1-publicar/botin.py --campana ragna \
#            --anadir "Espada corta" --tipo armas --sesion 2 --quien Thenarys
#
# LOS APARTADOS son los de TIPOS_DE_BOTIN en scripts/paginas/notas-rol.js,
# y aquí están copiados en TIPOS. Si añades uno allí, añádelo aquí: si no,
# esta herramienta te avisará de que lo que escribes caerá en «otras
# cosas», que es justo lo que hará la web.
#
# AL TERMINAR PASA EL BUSCADOR, porque lo del botín se encuentra desde la
# lupa y datos/sitio/buscador.json es un archivo generado.

import sys
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "0-comun"))

import argparse  # noqa: E402
import re  # noqa: E402

from comun import (RAIZ, elegir, elegir_campana, escribir_json,  # noqa: E402
                   pasar_generadores, preguntar, sin_tildes)
from imagenes import SITIOS, nombre_para, parece_de_fuera, traer  # noqa: E402

# El mismo orden y las mismas palabras que TIPOS_DE_BOTIN en
# scripts/paginas/notas-rol.js. El orden no es alfabético a propósito: va
# de lo que se usa en una pelea a lo que se usa fuera, y el dinero al final.
TIPOS = [
    ("armas", ["arma"]),
    ("armaduras", ["armadura", "escudos", "escudo"]),
    ("pociones", ["pocion", "pociones y hierbas", "curacion"]),
    ("pergaminos", ["pergamino", "conjuros", "hechizos", "pergaminos de conjuro"]),
    ("equipo", ["utiles", "util", "herramientas", "provisiones"]),
    ("objetos mágicos", ["objeto magico", "objetos magicos", "magia", "magicos"]),
    ("dinero", ["monedas", "oro", "tesoro"]),
    ("otras cosas", ["otros", "otras", "varios", "sin clasificar"]),
]
SIN_TIPO = "otras cosas"

SI = ("s", "si", "sí")


# =========================================
# LOS APARTADOS
# =========================================

def como_se_escribe(texto):
    """Sin tildes, sin mayúsculas y sin espacios de sobra: como compara los
    tipos la web (comoSeEscribeElTipo en notas-rol.js)."""
    return sin_tildes(str(texto or "")).lower().strip()


def apartado_de(tipo):
    """En qué apartado sale una cosa en la web. Lo que no lleve tipo, o lo
    lleve mal escrito, cae en «otras cosas»: nunca desaparece nada."""
    buscado = como_se_escribe(tipo)
    for nombre, alias in TIPOS:
        if buscado == como_se_escribe(nombre) or buscado in (como_se_escribe(a) for a in alias):
            return nombre
    return SIN_TIPO


def reconocido(tipo):
    return apartado_de(tipo) != SIN_TIPO or como_se_escribe(tipo) in (
        como_se_escribe(a) for a in [SIN_TIPO] + TIPOS[-1][1])


# =========================================
# ENSEÑAR LA LISTA
# =========================================

def en_orden(botin):
    """[(índice en el JSON, cosa)] en el orden en que salen en la web: por
    apartados y, dentro, como estén en el archivo. Los números que se ven
    en pantalla son las posiciones de esta lista, no las del JSON."""
    orden = {nombre: i for i, (nombre, _) in enumerate(TIPOS)}
    filas = [(i, c) for i, c in enumerate(botin) if isinstance(c, dict)]
    return sorted(filas, key=lambda f: (orden[apartado_de(f[1].get("tipo"))], f[0]))


def cuenta(botin):
    cosas = [c for c in botin if isinstance(c, dict)]
    gastadas = sum(1 for c in cosas if c.get("gastado"))
    return (f"{len(cosas)} cosa(s) · {gastadas} gastada(s) · "
            f"quedan {len(cosas) - gastadas}")


def describir(cosa):
    trozos = []
    if cosa.get("de") not in (None, ""):
        trozos.append(f"sesión {cosa['de']}")
    if (cosa.get("quien") or "").strip():
        trozos.append(f"lo lleva {cosa['quien']}")
    if (cosa.get("imagen") or "").strip():
        trozos.append("con foto")
    return " · ".join(trozos)


def ensenar(botin, titulo):
    print(f"\n  ==================================")
    print(f"  EL BOTÍN — {titulo.upper()}")
    print(f"  ==================================")
    filas = en_orden(botin)
    if not filas:
        print("\n  Todavía no hay nada apuntado.")
        return []
    print(f"  ({cuenta(botin)})")
    apartado_actual = None
    for n, (_, cosa) in enumerate(filas, start=1):
        apartado = apartado_de(cosa.get("tipo"))
        if apartado != apartado_actual:
            print(f"\n  {apartado}")
            apartado_actual = apartado
        marca = "  [gastado]" if cosa.get("gastado") else ""
        print(f"    {n:>2}. {cosa.get('que') or '(sin nombre)'}{marca}")
        detalle = describir(cosa)
        if detalle:
            print(f"        {detalle}")
    return filas


def elegir_cosa(filas, pregunta, solo=None):
    """Pide un número de la lista de pantalla. Devuelve el índice en el
    JSON, o None con un Enter en blanco. 'solo' filtra qué se puede
    elegir (lo gastado para devolver, lo que no para gastar)."""
    if not filas:
        print("\n  No hay nada en la lista.")
        return None
    validas = {n for n, (_, c) in enumerate(filas, start=1) if solo is None or solo(c)}
    if not validas:
        print("\n  No hay nada que se pueda elegir para esto.")
        return None
    while True:
        dicho = preguntar(f"{pregunta} (número, Enter para volver)")
        if not dicho:
            return None
        try:
            n = int(dicho)
        except ValueError:
            print(f"     {dicho!r} no es un número.")
            continue
        if n in validas:
            return filas[n - 1][0]
        if 1 <= n <= len(filas):
            print("     Ése no vale para esto.")
        else:
            print(f"     No hay ningún {n} en la lista.")


# =========================================
# LAS PREGUNTAS
# =========================================

def elegir_numero(titulo, opciones):
    """Un menú numerado donde un Enter en blanco es «nada, vuelve». El
    elegir() de comun.py no sirve aquí: sin permitir una opción nueva, un
    Enter elige la primera, y en «cambiar» eso era no poder salir nunca."""
    print(f"\n  {titulo}")
    for i, opcion in enumerate(opciones, start=1):
        print(f"     {i}. {opcion}")
    while True:
        dicho = preguntar("Elige (Enter en blanco: nada más)")
        if not dicho:
            return None
        try:
            n = int(dicho)
        except ValueError:
            n = 0
        if 1 <= n <= len(opciones):
            return n - 1
        print(f"     {dicho!r} no es ninguna de las opciones.")


def ultima_sesion(campana):
    numeros = []
    for s in campana.get("sesiones") or []:
        try:
            numeros.append(int(s.get("numero")))
        except (AttributeError, TypeError, ValueError):
            continue
    return max(numeros) if numeros else None


def pedir_tipo(actual=""):
    nombres = [n for n, _ in TIPOS]
    por_defecto = str(nombres.index(apartado_de(actual)) + 1) if actual else "1"
    tipo = elegir("¿En qué apartado va?", nombres, por_defecto=por_defecto).strip()
    if not reconocido(tipo):
        print(f"     OJO: «{tipo}» no es ningún apartado de la web, así que")
        print(f"     saldrá en «{SIN_TIPO}». Si quieres uno nuevo, añádelo a")
        print("     TIPOS_DE_BOTIN (scripts/paginas/notas-rol.js) y a TIPOS (aquí).")
    return tipo


def pedir_sesion(campana, actual=None):
    por_defecto = actual if actual not in (None, "") else ultima_sesion(campana)
    crudo = preguntar("¿En qué sesión se consiguió? (Enter en blanco: no se sabe)",
                      "" if por_defecto is None else str(por_defecto))
    if not crudo:
        return None
    try:
        return int(crudo)
    except ValueError:
        print(f"     {crudo!r} no es un número; lo dejo sin sesión.")
        return None


def pedir_quien(campana, actual=""):
    """Uno de la mesa, el carro, otro que se escriba, o nadie."""
    gente = [(p.get("nombre") or "").strip() for p in campana.get("personajes") or []
             if isinstance(p, dict)]
    opciones = [g for g in gente if g] + ["el carro"]
    if actual:
        print(f"\n  Ahora lo lleva: {actual}  (escribe «-» para que no lo lleve nadie)")
    dicho = elegir("¿Quién lo lleva? (Enter en blanco: nadie en concreto)",
                   opciones, por_defecto="").strip()
    if dicho == "-":
        return ""
    return dicho or actual


def pedir_imagen(clave, que):
    """La foto del objeto: o el nombre de un archivo que ya está en
    imagenes/notas_rol/<clave>/botin/, o la ruta de una imagen de tu
    ordenador, que se trae, se recorta a cuadrado y se pasa a WebP."""
    dicho = preguntar("Foto (archivo, o la ruta donde la tengas; Enter para saltar)")
    if not dicho:
        return ""
    ajustes = SITIOS["botin"]
    carpeta = ajustes["carpeta"].format(campana=clave)
    if parece_de_fuera(dicho):
        ruta, aviso = traer(dicho, carpeta, nombre_para(que, ajustes["sufijo"]),
                            lado=ajustes["lado"], cuadrada=ajustes["cuadrada"])
        if not ruta:
            print(f"     No he podido traerla: {aviso}")
            return ""
        print(f"     Traída a {ruta}  ({aviso})")
        return ruta
    ruta = dicho if dicho.startswith("/") else f"/{carpeta}/{dicho.lstrip('/')}"
    if not (RAIZ / ruta.lstrip("/")).is_file():
        print(f"     OJO: no encuentro {ruta}. Se apunta igual; hasta que esté")
        print("     saldrá el rombo de siempre.")
    return ruta


def nueva_cosa(campana, clave):
    que = preguntar("¿Qué es? (\"4 kits curativos\", \"Piedra mensajera\"…)")
    while not que:
        print("     Hace falta decir qué es: es lo único obligatorio.")
        que = preguntar("¿Qué es?")
    cosa = {"que": que}
    de = pedir_sesion(campana)
    if de is not None:
        cosa["de"] = de
    cosa["tipo"] = pedir_tipo()
    quien = pedir_quien(campana)
    if quien:
        cosa["quien"] = quien
    imagen = pedir_imagen(clave, que)
    if imagen:
        cosa["imagen"] = imagen
    return cosa


# =========================================
# LAS ACCIONES
# =========================================

NUMERO_DELANTE = re.compile(r"^\s*(\d+)\s+(.+)$")


def gastar(cosa):
    """Todo, o una parte si el nombre empieza por un número. Devuelve una
    frase con lo que ha hecho."""
    trozos = NUMERO_DELANTE.match(cosa.get("que") or "")
    if trozos and int(trozos.group(1)) > 1:
        hay, resto = int(trozos.group(1)), trozos.group(2)
        crudo = preguntar(f"Hay {hay}. ¿Cuántos se han gastado?", "1")
        try:
            gastados = int(crudo)
        except ValueError:
            return f"{crudo!r} no es un número; no he cambiado nada."
        if gastados <= 0:
            return "No he cambiado nada."
        if gastados < hay:
            cosa["que"] = f"{hay - gastados} {resto}"
            return f"Quedan {cosa['que']}."
    cosa["gastado"] = True
    return f"«{cosa['que']}» gastado: sale tachado en la lista."


def cambiar(cosa, campana, clave):
    while True:
        print(f"\n  Cambiando «{cosa.get('que')}»")
        campos = [
            f"qué es        ({cosa.get('que') or '-'})",
            f"apartado      ({cosa.get('tipo') or SIN_TIPO})",
            f"quién lo lleva ({cosa.get('quien') or 'nadie'})",
            f"sesión        ({cosa.get('de') if cosa.get('de') not in (None, '') else '-'})",
            f"foto          ({cosa.get('imagen') or 'sin foto'})",
        ]
        n = elegir_numero("¿Qué cambio?", campos)
        if n is None:
            return
        if n == 0:
            nuevo = preguntar("¿Qué es?", cosa.get("que") or "")
            if nuevo:
                cosa["que"] = nuevo
        elif n == 1:
            cosa["tipo"] = pedir_tipo(cosa.get("tipo") or "")
        elif n == 2:
            quien = pedir_quien(campana, cosa.get("quien") or "")
            if quien:
                cosa["quien"] = quien
            else:
                cosa.pop("quien", None)
        elif n == 3:
            de = pedir_sesion(campana, cosa.get("de"))
            if de is None:
                cosa.pop("de", None)
            else:
                cosa["de"] = de
        elif n == 4:
            if cosa.get("imagen") and preguntar("¿Le quito la foto? (s/N)", "n").lower() in SI:
                cosa.pop("imagen", None)
            else:
                imagen = pedir_imagen(clave, cosa.get("que") or "objeto")
                if imagen:
                    cosa["imagen"] = imagen


# =========================================

def main():
    parser = argparse.ArgumentParser(description="Lleva el botín de una campaña de rol.")
    parser.add_argument("--campana", help="la clave de la campaña (ragna, …)")
    parser.add_argument("--listar", action="store_true",
                        help="enseña la lista y sale, sin tocar nada")
    parser.add_argument("--anadir", metavar="QUE",
                        help="añade una cosa sin preguntar y sale")
    parser.add_argument("--tipo", default="", help="con --anadir: el apartado")
    parser.add_argument("--sesion", type=int, help="con --anadir: la sesión")
    parser.add_argument("--quien", default="", help="con --anadir: quién lo lleva")
    args = parser.parse_args()

    archivo, campana = elegir_campana(args.campana, "¿De qué campaña es el botín?")
    if not campana:
        return 1
    clave = (campana.get("clave") or "").strip()
    titulo = campana.get("nombre") or clave
    botin = campana.get("botin")
    if not isinstance(botin, list):
        botin = []

    def guardar():
        campana["botin"] = botin
        escribir_json(archivo, campana)

    if args.listar:
        ensenar(botin, titulo)
        print()
        return 0

    if args.anadir:
        cosa = {"que": args.anadir.strip()}
        if args.sesion is not None:
            cosa["de"] = args.sesion
        cosa["tipo"] = args.tipo.strip() or SIN_TIPO
        if not reconocido(cosa["tipo"]):
            print(f"  OJO: «{cosa['tipo']}» no es ningún apartado; saldrá en «{SIN_TIPO}».")
        if args.quien.strip():
            cosa["quien"] = args.quien.strip()
        botin.append(cosa)
        guardar()
        print(f"  Añadido «{cosa['que']}» a {archivo.relative_to(RAIZ)}")
        pasar_generadores(("3-generadores/generar-buscador.py",))
        return 0

    cambios = 0
    while True:
        filas = ensenar(botin, titulo)
        print("\n  ¿Qué hago?")
        print("     a. añadir algo")
        if filas:
            print("     g. gastar algo (todo, o una parte)")
            print("     d. devolver algo gastado")
            print("     c. cambiar algo")
            print("     q. quitar algo del todo")
        print("     0. terminar")
        accion = preguntar("Elige", "0").lower()

        if accion in ("0", "", "salir", "terminar"):
            break

        if accion == "a":
            while True:
                cosa = nueva_cosa(campana, clave)
                botin.append(cosa)
                guardar()
                cambios += 1
                print(f"\n  Añadido «{cosa['que']}» en «{apartado_de(cosa['tipo'])}».")
                if preguntar("¿Añado otra cosa? (S/n)", "s").lower() not in SI:
                    break

        elif accion == "g" and filas:
            i = elegir_cosa(filas, "¿Qué se ha gastado?", solo=lambda c: not c.get("gastado"))
            if i is not None:
                print(f"\n  {gastar(botin[i])}")
                guardar()
                cambios += 1

        elif accion == "d" and filas:
            i = elegir_cosa(filas, "¿Qué devuelvo?", solo=lambda c: c.get("gastado"))
            if i is not None:
                botin[i].pop("gastado", None)
                guardar()
                cambios += 1
                print(f"\n  «{botin[i]['que']}» vuelve a estar en la lista, sin tachar.")

        elif accion == "c" and filas:
            i = elegir_cosa(filas, "¿Qué cambio?")
            if i is not None:
                antes = dict(botin[i])
                cambiar(botin[i], campana, clave)
                if botin[i] != antes:
                    guardar()
                    cambios += 1
                    print("\n  Guardado.")

        elif accion == "q" and filas:
            print("\n  Quitar es para lo que se apuntó por error. Si se ha usado,")
            print("  mejor «gastar»: así se sigue viendo lo que hubo.")
            i = elegir_cosa(filas, "¿Qué quito?")
            if i is not None:
                que = botin[i].get("que")
                if preguntar(f"¿Quito «{que}» del todo? (s/N)", "n").lower() in SI:
                    del botin[i]
                    guardar()
                    cambios += 1
                    print(f"\n  «{que}» quitado.")
        else:
            print(f"\n  {accion!r} no es ninguna de las opciones.")

    if not cambios:
        print("\n  No he cambiado nada.\n")
        return 0
    print(f"\n  {cambios} cambio(s) guardado(s) en {archivo.relative_to(RAIZ)}.")
    print("  En la web se ve al momento; paso el buscador para que también")
    print("  se encuentre desde la lupa.")
    pasar_generadores(("3-generadores/generar-buscador.py",))
    return 0


if __name__ == "__main__":
    sys.exit(main())
