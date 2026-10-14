#!/usr/bin/env python3
# =========================================
# AÑADIR RECOMENDACIONES
# =========================================
# Rellena datos/mi_rincon/recomendaciones.json, que es de donde salen las
# ventanitas de web/recomendaciones/recomendaciones.html. Es lo mismo
# que editar el archivo a mano, pero sin pelearse con las comas y las
# comillas, y comprobando de paso que la portada existe y que el enlace
# tiene buena pinta.
#
# CÓMO USARLO
# -----------
# Desde la carpeta raíz del sitio:
#
#     python herramientas/1-publicar/nueva-recomendacion.py
#
# y te pregunta en qué categoría vas a añadir. Puedes elegir una en
# concreta o "todas", que lo único que cambia es que entonces te
# pregunta la categoría en cada cosa, por si vas saltando.
#
# Si ya lo sabes, te ahorras esa pregunta:
#
#     python herramientas/1-publicar/nueva-recomendacion.py --categoria libros
#
# Y si lo sabes TODO, la añade sin preguntar nada (útil para meter
# varias de una sentada desde el historial de la terminal):
#
#     python herramientas/1-publicar/nueva-recomendacion.py --categoria pelis \
#            --titulo "Donnie Darko" --autor "Richard Kelly" --anyo 2001 \
#            --texto "Lo que quieras contar de ella." \
#            --imagen donnie-darko.webp --imprescindible \
#            --enlace https://ejemplo.org/ficha
#
# Otras cosas que sabe hacer:
#
#     --listar                 enseña lo que ya hay, por categorías
#     --categoria <nueva>      si no existe, te ofrece crearla
#
# Al terminar cada una pregunta si quieres añadir otra, así que para
# una tarde de rellenar basta con pasarlo una vez.
#
# NO HAY QUE PASAR NINGÚN GENERADOR DESPUÉS. La página lee el JSON tal
# cual: guardas y ya está.

import sys
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import argparse

from imagenes import ruta_o_traida  # noqa: E402
from comun import (
    RAIZ,
    elegir,
    escribir_json,
    leer_json,
    preguntar,
)

JSON = RAIZ / "datos" / "mi_rincon" / "recomendaciones.json"


# =========================================
# EL ARCHIVO
# =========================================

def cargar():
    datos = leer_json(JSON, None)
    if datos is None:
        print(f"  No encuentro {JSON.relative_to(RAIZ)}.")
        return None
    if not isinstance(datos, list):
        print(f"  {JSON.relative_to(RAIZ)} debería ser una lista entre [ ].")
        return None
    return datos


def clave_de(bloque):
    """El nombre corto de una categoría: el que se usa para elegirla y
    el que lleva el filtro de la página. Si no está escrito, se saca del
    nombre de la ventanita ("libros.txt" -> "libros")."""
    clave = (bloque.get("clave") or "").strip()
    if clave:
        return clave
    return (bloque.get("nombre") or "").strip().rsplit(".", 1)[0]


def buscar_bloque(datos, clave):
    for bloque in datos:
        if isinstance(bloque, dict) and clave_de(bloque) == clave:
            return bloque
    return None


def listar(datos):
    print("\n  LO QUE HAY AHORA MISMO\n")
    total = 0
    for bloque in datos:
        cosas = bloque.get("cosas") or []
        total += len(cosas)
        print(f"  {clave_de(bloque)} ({len(cosas)})")
        for cosa in cosas:
            marca = " ★" if cosa.get("imprescindible") else ""
            datos_sueltos = " · ".join(
                str(t).strip()
                for t in (cosa.get("autor"), cosa.get("anyo"))
                if str(t or "").strip()
            )
            apunte = f"   ({datos_sueltos})" if datos_sueltos else ""
            print(f"     - {cosa.get('titulo', '?')}{marca}{apunte}")
        print()
    print(f"  Total: {total}\n")


# =========================================
# PREGUNTAR
# =========================================

def pedir_categoria(datos, args, ultima):
    """La categoría de esta cosa. Con --categoria no se pregunta nada;
    si se eligió "todas" al empezar, se pregunta en cada una, dejando la
    anterior como respuesta por defecto."""
    if args.categoria:
        return args.categoria.strip().lower()

    claves = [clave_de(b) for b in datos]
    if ultima and ultima in claves:
        # Con una ya elegida, basta con dar al Enter para repetirla.
        escrito = preguntar(f"Categoría ({', '.join(claves)})", ultima)
        return escrito.strip().lower()
    return elegir("¿En qué categoría va?", claves).strip().lower()


def pedir_cosa(args, titulos):
    cosa = {}

    titulo = (args.titulo or "").strip() or preguntar("Título")
    while not titulo:
        print("     Hace falta un título.")
        titulo = preguntar("Título")
    if titulo.strip().lower() in titulos:
        print(f"\n  Ya hay algo titulado {titulo!r} en esa categoría.")
        if preguntar("¿Lo añado igual? (s/N)", "n").lower() not in ("s", "si", "sí"):
            return None
    cosa["titulo"] = titulo

    autor = args.autor if args.autor is not None else preguntar(
        "Autor, estudio, grupo… (Enter para saltar)"
    )
    anyo = args.anyo if args.anyo is not None else preguntar("Año (Enter para saltar)")
    if autor.strip():
        cosa["autor"] = autor.strip()
    if str(anyo).strip():
        cosa["anyo"] = str(anyo).strip()

    texto = (args.texto or "").strip() or preguntar(
        "¿Por qué lo recomiendas? (es lo que sale al abrirla)"
    )
    while not texto:
        print("     Escribe algo, aunque sea corto: es lo que se viene a leer.")
        texto = preguntar("¿Por qué lo recomiendas?")
    cosa["texto"] = texto

    if args.imprescindible:
        esencial = True
    else:
        esencial = preguntar("¿Imprescindible? (s/N)", "n").lower() in ("s", "si", "sí")
    if esencial:
        cosa["imprescindible"] = True

    # La ruta de tu ordenador (se trae, se pasa a WebP y se deja a su
    # tamaño), o el nombre de una que ya esté en imagenes/recomendaciones/.
    imagen = ruta_o_traida(
        args.imagen if args.imagen is not None else preguntar(
            "Portada (la ruta donde la tengas, o el nombre de una del sitio;"
            " Enter para saltar)"),
        "recomendaciones", titulo)
    if imagen:
        cosa["imagen"] = imagen
        if not (RAIZ / imagen.lstrip("/")).is_file():
            print(f"     OJO: no encuentro {imagen} en el sitio.")
            print("     Se añade igual, pero ahí saldrá un hueco hasta que la subas.")
        alt = args.alt if args.alt is not None else preguntar(
            "Descripción de la portada (para quien no la ve)", f"Portada de {titulo}"
        )
        cosa["alt"] = alt.strip()

    enlace = args.enlace if args.enlace is not None else preguntar(
        "Enlace (Enter para saltar)"
    )
    enlace = enlace.strip()
    while enlace and not enlace.startswith(("http://", "https://", "/")):
        print("     Tiene que empezar por http://, https:// o / (algo de esta web).")
        enlace = preguntar("Enlace (Enter para saltar)").strip()
    if enlace:
        cosa["enlace"] = enlace
        nombre = args.enlace_texto if args.enlace_texto is not None else preguntar(
            "Texto del enlace", "más información"
        )
        cosa["enlaceTexto"] = nombre.strip() or "más información"

    return cosa


def resumen(clave, cosa):
    print(f"\n  {cosa['titulo']}{' ★' if cosa.get('imprescindible') else ''}  →  {clave}")
    for campo, etiqueta in (
        ("autor", "autor"),
        ("anyo", "año"),
        ("imagen", "portada"),
        ("enlace", "enlace"),
    ):
        if cosa.get(campo):
            print(f"     {etiqueta}: {cosa[campo]}")
    print(f"     {cosa['texto']}")


# =========================================
# AÑADIR
# =========================================

def crear_categoria(datos, clave):
    print(f"\n  La categoría {clave!r} no existe todavía.")
    if preguntar("¿La creo? (S/n)", "s").lower() not in ("s", "si", "sí", ""):
        return None
    nombre = preguntar("Nombre de la ventanita", f"{clave}.txt")
    bloque = {"nombre": nombre, "clave": clave, "cosas": []}
    datos.append(bloque)
    return bloque


def main():
    parser = argparse.ArgumentParser(
        description="Añade cosas a datos/mi_rincon/recomendaciones.json."
    )
    parser.add_argument("--listar", action="store_true",
                        help="enseña lo que ya hay y se sale")
    parser.add_argument("--categoria", help="libros, series, pelis, juegos, anime, musica…")
    parser.add_argument("--titulo")
    parser.add_argument("--autor")
    parser.add_argument("--anyo")
    parser.add_argument("--texto", help="por qué lo recomiendas")
    parser.add_argument("--imagen", help="la portada: la ruta de tu ordenador o el nombre de una del sitio")
    parser.add_argument("--alt", help="descripción de la portada")
    parser.add_argument("--enlace")
    parser.add_argument("--enlace-texto", dest="enlace_texto")
    parser.add_argument("--imprescindible", action="store_true")
    args = parser.parse_args()

    datos = cargar()
    if datos is None:
        return 1

    if args.listar:
        listar(datos)
        return 0

    if not datos:
        print(f"  {JSON.relative_to(RAIZ)} está vacío: no hay ninguna categoría.")
        return 1

    print("\n  RELLENAR LAS RECOMENDACIONES")
    print("  (Enter en «¿otra?» para salir cuando acabes)\n")

    # Con --categoria no hay nada que elegir. Sin ella se pregunta una
    # vez: o una en concreta, o "todas", que solo quiere decir que se
    # pregunta en cada cosa.
    ultima = ""
    if not args.categoria:
        claves = [clave_de(b) for b in datos]
        elegida = elegir("¿De qué categoría vas a añadir?", claves + ["todas"])
        elegida = elegida.strip().lower()
        if elegida != "todas":
            ultima = elegida
            args.categoria = elegida

    # Si lo ha dicho todo por la línea de órdenes, se añade y se sale sin
    # preguntar nada más.
    de_una = bool(args.titulo and args.texto and args.categoria)
    anyadidas = 0

    while True:
        clave = pedir_categoria(datos, args, ultima)
        if not clave:
            print("  Hace falta una categoría.")
            return 1
        ultima = clave

        bloque = buscar_bloque(datos, clave)
        if bloque is None:
            bloque = crear_categoria(datos, clave)
            if bloque is None:
                return 1

        cosas = bloque.setdefault("cosas", [])
        titulos = [
            (c.get("titulo") or "").strip().lower() for c in cosas if isinstance(c, dict)
        ]
        cosa = pedir_cosa(args, titulos)
        if cosa is None:
            print("  Nada añadido.")
        else:
            resumen(clave, cosa)
            if de_una or preguntar("¿La añado? (S/n)", "s").lower() in ("s", "si", "sí", ""):
                # La última de su categoría: en la página salen en el
                # orden del archivo, así que lo nuevo queda al final, que
                # es como se va llenando una estantería.
                cosas.append(cosa)
                escribir_json(JSON, datos)
                anyadidas += 1
                print(f"\n  Apuntada en {clave}. Van {len(cosas)} en esa categoría.")
            else:
                print("  Nada añadido.")

        if de_una:
            break
        # Los datos de la línea de órdenes son de la primera; la
        # siguiente se pregunta entera.
        for campo in ("titulo", "autor", "anyo", "texto", "imagen", "alt",
                      "enlace", "enlace_texto"):
            setattr(args, campo, None)
        args.imprescindible = False

        if preguntar("\n  ¿Añadimos otra? (S/n)", "s").lower() not in ("s", "si", "sí", ""):
            break

    if anyadidas:
        print(f"\n  Listo: {anyadidas} cosa(s) nueva(s) en {JSON.relative_to(RAIZ)}.")
        print("  No hace falta pasar ningún generador: la página lo lee tal cual.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
