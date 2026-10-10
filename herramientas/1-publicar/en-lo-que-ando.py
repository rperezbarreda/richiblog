#!/usr/bin/env python3
# =========================================
# EN LO QUE ANDO — cambiar lo que pone la página
# =========================================
# Rellena datos/en-lo-que-ando.json, que es de donde sale
# web/en_lo_que_ando/en_lo_que_ando.html. Es lo mismo que abrir el archivo
# y escribir, pero sin pelearse con las comas y las comillas, y poniendo
# la fecha de "última vez que toqué esto" sin que haya que acordarse.
#
# CÓMO USARLO
# -----------
# Desde la carpeta raíz del sitio:
#
#     python herramientas/1-publicar/en-lo-que-ando.py
#
# y sale un menú: qué estás leyendo, qué estás viendo, qué estás jugando,
# qué andas escribiendo y los pendientes. Se toca lo que se quiera y se
# sale; lo que no se toque se queda como estaba.
#
# DE CADA COSA pregunta el título, de quién es, por dónde vas (en %, y se
# puede dejar en blanco: entonces no sale barra), una nota y un enlace.
#
# Si ya sabes a qué vienes, te ahorras el menú:
#
#     python herramientas/1-publicar/en-lo-que-ando.py --leyendo
#     python herramientas/1-publicar/en-lo-que-ando.py --escribiendo
#     python herramientas/1-publicar/en-lo-que-ando.py --pendientes
#     python herramientas/1-publicar/en-lo-que-ando.py --ver
#
# LO QUE NO SE TOCA AQUÍ: el bloque de la partida de rol. Ése se escribe
# solo con lo que haya en datos/notas-rol.json y en el JSON de la campaña;
# publicar unas notas es lo que lo actualiza. Si hubiera que venir aquí a
# cambiarlo a mano, el día que se olvidara la página estaría mintiendo.
#
# PARA DEJAR UN HUECO EN BLANCO (que ese trozo no salga en la web) se
# contesta un guion: "-". Borrar es tan normal como poner.

import argparse
import sys
from datetime import date
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from comun import (  # noqa: E402
    RAIZ,
    escribir_json,
    leer_json,
    pasar_generadores,
    preguntar,
)

ARCHIVO = RAIZ / "datos" / "en-lo-que-ando.json"

# Los tres huecos de "ahora mismo" y en qué orden salen. Están escritos
# aquí y no sacados del archivo a propósito: son siempre estos tres, y así
# el menú es el mismo esté el archivo como esté.
HUECOS = ["leyendo", "viendo", "jugando"]

# Lo que se escribe para dejar un hueco vacío.
BORRAR = "-"


def cargar():
    datos = leer_json(ARCHIVO, None)
    if not isinstance(datos, dict):
        print(f"\n  No encuentro {ARCHIVO.relative_to(RAIZ)} o no es lo que espero.")
        print("  Créalo con un {} dentro y vuelve a pasar esto.\n")
        sys.exit(1)
    # Los tres huecos, siempre los tres y en su orden: si falta alguno en
    # el archivo se añade vacío, que es lo mismo que no tenerlo pero deja
    # el menú completo.
    tenia = {
        (c.get("que") or "").strip().lower(): c
        for c in (datos.get("ahora") or [])
        if isinstance(c, dict)
    }
    datos["ahora"] = [
        tenia.get(hueco, {"que": hueco, "titulo": "", "de": "", "nota": "",
                          "porcentaje": None, "enlace": ""})
        for hueco in HUECOS
    ]
    datos.setdefault("escribiendo", [])
    datos.setdefault("pendientes", [])
    datos.setdefault("intro", "")
    datos.setdefault("actualizado", "")
    return datos


def guardar(datos):
    datos["actualizado"] = date.today().strftime("%d-%m-%Y")
    escribir_json(ARCHIVO, datos)
    print(f"\n  Escrito {ARCHIVO.relative_to(RAIZ)} ({datos['actualizado']}).")


# =========================================
# ENSEÑAR LO QUE HAY
# =========================================

def ver(datos):
    print("\n  ---- en lo que ando ----")
    cuando = (datos.get("actualizado") or "").strip()
    print(f"  última vez que se tocó: {cuando or 'nunca'}\n")

    for cosa in datos["ahora"]:
        titulo = (cosa.get("titulo") or "").strip()
        de = (cosa.get("de") or "").strip()
        cuanto = cosa.get("porcentaje")
        linea = titulo + (f" — {de}" if de else "") if titulo else "(vacío)"
        if titulo and cuanto is not None:
            linea += f"   [{cuanto}%]"
        print(f"  {cosa['que']:<10} {linea}")

    escritos = [c for c in datos["escribiendo"] if (c.get("titulo") or "").strip()]
    print(f"\n  escribiendo ({len(escritos)}):")
    for c in escritos:
        extra = " · ".join(
            x for x in [(c.get("tipo") or "").strip(), (c.get("estado") or "").strip()] if x
        )
        print(f"     {c['titulo'].strip()}" + (f"  ({extra})" if extra else ""))
    if not escritos:
        print("     (nada)")

    pendientes = [c for c in datos["pendientes"] if (c.get("cosa") or "").strip()]
    hechas = sum(1 for c in pendientes if c.get("hecho"))
    print(f"\n  pendientes ({hechas} de {len(pendientes)} hechas):")
    for c in pendientes:
        print(f"     [{'x' if c.get('hecho') else ' '}] {c['cosa'].strip()}")
    if not pendientes:
        print("     (nada)")
    print()


# =========================================
# LOS TRES HUECOS: LEYENDO, VIENDO, JUGANDO
# =========================================

def tocar_hueco(datos, cual):
    cosa = [c for c in datos["ahora"] if c.get("que") == cual][0]
    antes = (cosa.get("titulo") or "").strip()
    print(f"\n  ---- {cual} ----")
    if antes:
        print(f"  Ahora mismo pone: {antes}")
    print(f'  (un "{BORRAR}" en el título lo deja en blanco y no sale en la web)')

    titulo = preguntar("Qué", antes)
    if titulo == BORRAR or not titulo:
        cosa.update({"titulo": "", "de": "", "nota": "", "enlace": ""})
        print(f"  {cual}: en blanco.")
        return True

    cosa["titulo"] = titulo
    # Si lo que hay es otra cosa distinta, lo de antes no vale como valor
    # por defecto: sería ofrecer el autor del libro anterior.
    mismo = titulo == antes
    cosa["de"] = sin_guion(
        preguntar("De quién (autor, estudio, quien sea)",
                  (cosa.get("de") or "") if mismo else "")
    )
    cosa["porcentaje"] = pedir_porcentaje(cosa.get("porcentaje") if mismo else None)
    cosa["nota"] = sin_guion(
        preguntar("Una nota (por dónde vas, qué te parece)",
                  (cosa.get("nota") or "") if mismo else "")
    )
    cosa["enlace"] = sin_guion(
        preguntar("Un enlace, si tiene", (cosa.get("enlace") or "") if mismo else "")
    )
    avisar_del_enlace(cosa["enlace"])
    return True


def sin_guion(valor):
    return "" if valor.strip() == BORRAR else valor.strip()


# POR DÓNDE VAS, de 0 a 100. Es opcional: en blanco no sale barra ninguna.
# Se admite escribirlo con el % puesto, porque es lo que sale solo al
# teclearlo, y se recorta a 0-100 sin rechistar: una barra al 150% se sale
# del riel.
def pedir_porcentaje(antes):
    por_defecto = "" if antes is None else str(antes)
    while True:
        dicho = preguntar("Por dónde vas, en % (vacío = no poner barra)",
                          por_defecto).replace("%", "").strip()
        if not dicho or dicho == BORRAR:
            return None
        try:
            numero = int(round(float(dicho.replace(",", "."))))
        except ValueError:
            print("  Eso no es un número. Escribe algo como 45, o déjalo en blanco.")
            continue
        if not 0 <= numero <= 100:
            print(f"  {numero} se sale de 0 a 100. Lo dejo en {max(0, min(100, numero))}.")
        return max(0, min(100, numero))


# Las direcciones las comprueba también el JavaScript antes de ponerlas
# (ver rutaSeguraAndo en scripts/paginas/en-lo-que-ando.js), así que esto
# no es la seguridad: es para enterarse del dedazo ahora y no el día que
# alguien pulse un enlace que no lleva a ninguna parte.
def avisar_del_enlace(enlace):
    if not enlace:
        return
    if enlace.startswith("http://") or enlace.startswith("https://"):
        return
    if enlace.startswith("/"):
        destino = RAIZ / enlace.lstrip("/").split("?")[0].split("#")[0]
        if not destino.exists():
            print(f"  OJO: {enlace} no existe en el sitio. Lo apunto igual.")
        return
    print("  OJO: eso no parece una dirección (ni empieza por / ni por http).")
    print("  La página no lo pondrá como enlace. Lo apunto igual.")


# =========================================
# EN QUÉ ANDO ESCRIBIENDO
# =========================================

def tocar_escribiendo(datos):
    while True:
        lista = [c for c in datos["escribiendo"] if (c.get("titulo") or "").strip()]
        print("\n  ---- en qué ando escribiendo ----")
        for i, c in enumerate(lista, start=1):
            extra = " · ".join(
                x for x in [(c.get("tipo") or "").strip(), (c.get("estado") or "").strip()]
                if x
            )
            print(f"     {i}. {c['titulo'].strip()}" + (f"  ({extra})" if extra else ""))
        if not lista:
            print("     (nada apuntado)")
        print("\n     a. añadir una")
        if lista:
            print("     q. quitar una")
            print("     e. cambiar el estado de una")
        print("     0. volver")

        que = preguntar("Qué hago", "0").lower()
        if que in ("0", "", "volver"):
            datos["escribiendo"] = lista
            return
        if que == "a":
            nueva = pedir_escrito()
            if nueva:
                lista.append(nueva)
        elif que == "q" and lista:
            cual = numero_de(lista, "Cuál quito")
            if cual is not None:
                print(f"  Fuera: {lista[cual]['titulo'].strip()}")
                lista.pop(cual)
        elif que == "e" and lista:
            cual = numero_de(lista, "Cuál cambio")
            if cual is not None:
                lista[cual]["estado"] = sin_guion(
                    preguntar("Por dónde va", lista[cual].get("estado") or "")
                )
        datos["escribiendo"] = lista


def pedir_escrito():
    titulo = preguntar("Qué estás escribiendo")
    if not titulo or titulo == BORRAR:
        return None
    escrito = {
        "titulo": titulo,
        "tipo": sin_guion(preguntar("Qué es (relato, reto, novela…)")),
        "estado": sin_guion(preguntar("Por dónde va (a medias, día 4 de 31…)")),
        "nota": sin_guion(preguntar("Una nota, si quieres")),
        "enlace": sin_guion(preguntar("Un enlace, si ya hay algo publicado")),
    }
    avisar_del_enlace(escrito["enlace"])
    return escrito


def numero_de(lista, pregunta):
    elegido = preguntar(pregunta, "")
    try:
        numero = int(elegido)
    except ValueError:
        print("  Eso no es un número de los de la lista.")
        return None
    if not 1 <= numero <= len(lista):
        print("  Ese número no está en la lista.")
        return None
    return numero - 1


# =========================================
# LOS PENDIENTES (EL POST-IT)
# =========================================

def tocar_pendientes(datos):
    while True:
        lista = [c for c in datos["pendientes"] if (c.get("cosa") or "").strip()]
        hechas = sum(1 for c in lista if c.get("hecho"))
        print(f"\n  ---- pendientes ({hechas} de {len(lista)} hechas) ----")
        for i, c in enumerate(lista, start=1):
            print(f"     {i}. [{'x' if c.get('hecho') else ' '}] {c['cosa'].strip()}")
        if not lista:
            print("     (nada apuntado)")
        print("\n     a. apuntar una")
        if lista:
            print("     m. marcar o desmarcar una")
            print("     q. quitar una")
            if hechas:
                print("     l. quitar todas las que están hechas")
        print("     0. volver")

        que = preguntar("Qué hago", "0").lower()
        if que in ("0", "", "volver"):
            datos["pendientes"] = lista
            return
        if que == "a":
            cosa = preguntar("Qué queda por hacer")
            if cosa and cosa != BORRAR:
                lista.append({"cosa": cosa, "hecho": False})
        elif que == "m" and lista:
            cual = numero_de(lista, "Cuál marco o desmarco")
            if cual is not None:
                lista[cual]["hecho"] = not lista[cual].get("hecho")
        elif que == "q" and lista:
            cual = numero_de(lista, "Cuál quito")
            if cual is not None:
                print(f"  Fuera: {lista[cual]['cosa'].strip()}")
                lista.pop(cual)
        elif que == "l" and hechas:
            lista = [c for c in lista if not c.get("hecho")]
            print(f"  Quitadas {hechas}.")
        datos["pendientes"] = lista


# =========================================
# EL MENÚ
# =========================================

def menu(datos):
    while True:
        ver(datos)
        print("  ---- qué quieres cambiar ----")
        for i, hueco in enumerate(HUECOS, start=1):
            print(f"     {i}. {hueco}")
        print("     4. en qué ando escribiendo")
        print("     5. los pendientes")
        print("     6. la línea de arriba (la que explica qué es esta página)")
        print("     0. guardar y salir\n")

        elegido = preguntar("Elige", "0")
        if elegido in ("0", "", "salir"):
            return True
        if elegido in ("1", "2", "3"):
            tocar_hueco(datos, HUECOS[int(elegido) - 1])
        elif elegido == "4":
            tocar_escribiendo(datos)
        elif elegido == "5":
            tocar_pendientes(datos)
        elif elegido == "6":
            datos["intro"] = preguntar("La línea de arriba", datos.get("intro") or "")
        else:
            print(f"\n  {elegido!r} no es ninguna de las opciones.")


def main():
    parser = argparse.ArgumentParser(
        description="Cambia lo que pone la página de «en lo que ando».")
    parser.add_argument("--ver", action="store_true",
                        help="enseña lo que hay ahora y no toca nada")
    parser.add_argument("--leyendo", action="store_true", help="va directo a «leyendo»")
    parser.add_argument("--viendo", action="store_true", help="va directo a «viendo»")
    parser.add_argument("--jugando", action="store_true", help="va directo a «jugando»")
    parser.add_argument("--escribiendo", action="store_true",
                        help="va directo a lo que estás escribiendo")
    parser.add_argument("--pendientes", action="store_true", help="va directo al post-it")
    args = parser.parse_args()

    datos = cargar()

    if args.ver:
        ver(datos)
        return 0

    directos = [
        (args.leyendo, "leyendo"),
        (args.viendo, "viendo"),
        (args.jugando, "jugando"),
    ]
    toco = False
    for puesto, cual in directos:
        if puesto:
            tocar_hueco(datos, cual)
            toco = True
    if args.escribiendo:
        tocar_escribiendo(datos)
        toco = True
    if args.pendientes:
        tocar_pendientes(datos)
        toco = True
    if not toco:
        menu(datos)

    guardar(datos)
    # Solo el buscador: esta página no sale en ningún listado ni en el RSS
    # —no es una entrada— pero lo que pone sí se busca desde la lupa, y eso
    # se saca del JSON al generar el índice.
    pasar_generadores(("3-generadores/generar-buscador.py",))
    print("\n  Listo. Mira cómo ha quedado:")
    print("  http://localhost:8000/web/en_lo_que_ando/en_lo_que_ando.html\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
