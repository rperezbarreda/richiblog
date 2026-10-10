#!/usr/bin/env python3
# =========================================
# EL MENÚ — ¿QUÉ QUIERES HACER?
# =========================================
# La puerta de entrada a todo lo demás. En vez de acordarse de cómo se
# llama cada herramienta y en qué carpeta está, se pasa esto:
#
#     python herramientas/menu.py
#
# y sale una lista de APARTADOS, los mismos que el menú de la web: blog,
# mis movidas, rol, la wiki, mi rincón… Eliges uno y dentro están sus
# herramientas. Lo de rol con lo de rol, lo del blog con lo del blog.
#
# Si ya sabes a dónde vas, se puede escribir directamente el apartado y la
# opción separados por un punto: «3.4» es la cuarta cosa del tercero.
#
# NO HACE NADA POR SU CUENTA. Es un índice que llama a otros: todo lo que
# ocurre de verdad sigue estando en el script de siempre, que se puede
# seguir usando suelto si ya sabes cuál es.
#
# PARA AÑADIR UNA OPCIÓN: una línea más en el apartado que toque de
# APARTADOS, aquí abajo. El menú se dibuja solo a partir de esa lista, y
# comprueba al arrancar que todos los archivos que nombra existan de
# verdad: una herramienta que se renombre y no se cambie aquí se canta
# nada más abrir el menú, en vez de fallar el día que la elijas.

import subprocess
import sys
from pathlib import Path

HERRAMIENTAS = Path(__file__).resolve().parent
RAIZ = HERRAMIENTAS.parent

# Dos opciones no son una herramienta suelta sino varias seguidas. En vez
# de un script llevan una de estas marcas.
REPASAR_TODO = "repasar-todo"
REGENERAR = "regenerar"

# Publicar un borrador sale en los tres apartados donde se escribe algo
# que nace como borrador. Es la misma herramienta: enseña todos los
# borradores que haya, sean de donde sean.
PUBLICAR = ("Publicar un borrador",
            "1-publicar/publicar.py", [],
            "Lo que ya esté escrito deja de ser borrador y sale en la web.")

# (nombre del apartado, de qué va, [opciones])
# Cada opción: (qué hace, qué script, qué argumentos, una línea explicándolo)
#
# Los argumentos son los que hacen que una misma herramienta salga como
# varias cosas: nuevo.py sabe publicar cinco cosas, y aquí cada una va en
# su apartado, que es como se piensa en ello ("voy a escribir una
# entrada"), no como lo pide el script.
APARTADOS = [
    ("Blog", "entradas del diario", [
        ("Escribir una entrada del blog",
         "1-publicar/nuevo.py", ["--entrada"],
         "Crea la página con la fecha puesta. Nace como borrador."),
        PUBLICAR,
    ]),

    ("Mis movidas", "relatos y el reto de escritura", [
        ("Escribir un relato",
         "1-publicar/nuevo.py", ["--relato"],
         "Igual que una entrada, pero va a mis movidas."),
        ("Escribir un día del reto de escritura",
         "1-publicar/nuevo.py", ["--reto"],
         "Coge el siguiente día que falte, con su palabra."),
        PUBLICAR,
    ]),

    ("Rol", "las campañas, los NPC, el botín y los recursos", [
        ("Apuntar las notas de una partida",
         "1-publicar/nuevo.py", ["--sesion"],
         "Elige la campaña y deja el cuaderno en blanco. Nace como borrador."),
        ("Añadir NPC a una campaña",
         "1-publicar/nuevo-personaje.py", [],
         "Nombre, grupo, qué es, foto y lo que sepamos."),
        ("Llevar el botín de una campaña",
         "1-publicar/botin.py", [],
         "Añadir lo conseguido, gastar, devolver, cambiar o quitar."),
        ("Añadir algo a los recursos de rol",
         "1-publicar/nuevo.py", ["--rol"],
         "Una ficha, un mapa, una aventura… para el portfolio."),
        PUBLICAR,
    ]),

    ("Wiki Cralëa", "traer la wiki de Chronicler y elegir qué se publica", [
        ("Traer la wiki desde Chronicler",
         "1-publicar/importar-mundo.py", [],
         "Se trae lo que entra —páginas, mapas e imágenes— y lo publica."),
        ("Elegir qué páginas entran en la wiki",
         "1-publicar/importar-mundo.py", ["--elegir"],
         "La lista con [x] y [ ]. Lo que quede fuera no se publica."),
        ("Pasar la wiki a la web sin traer nada",
         "3-generadores/generar-mundo.py", [],
         "Convierte lo que ya hay en la carpeta wiki/ en páginas."),
    ]),

    ("Mi rincón", "en lo que ando, recomendaciones y los gatos", [
        ("Cambiar lo que pone «en lo que ando»",
         "1-publicar/en-lo-que-ando.py", [],
         "Lo que leo, veo y juego, lo que escribo y el post-it de pendientes."),
        ("Añadir una recomendación",
         "1-publicar/nueva-recomendacion.py", [],
         "Libros, pelis, juegos… lo de la página de recomendaciones."),
        ("Añadir fotos a la galería de un gato",
         "2-imagenes/generar-galeria.py", [],
         "Hace las miniaturas y pregunta la descripción de cada una."),
    ]),

    ("Imágenes", "traerlas de tu ordenador y dejarlas a punto", [
        ("Traer una imagen de tu ordenador",
         "2-imagenes/traer-imagen.py", [],
         "Pegas la ruta y la deja en su carpeta, en WebP y a su tamaño."),
        ("Preparar las imágenes antes de subirlas",
         "2-imagenes/optimizar-imagenes.py", [],
         "Pasa imagenes/ a WebP, las encoge y les quita los datos de dentro."),
        ("Sacar los tamaños del dibujo de la portada",
         "2-imagenes/tamanos-portada.py", [],
         "Solo si has cambiado el dibujo de la portada."),
    ]),

    ("Antes de subir", "repasar el sitio y rehacer lo generado", [
        ("Repasar el sitio entero",
         REPASAR_TODO, None,
         "Pasa de golpe las cinco comprobaciones de 4-comprobar/."),
        ("Repasar que no haya enlaces rotos",
         "4-comprobar/enlaces-rotos.py", [],
         "No cambia nada: solo mira y te lo cuenta."),
        ("Volver a generar los listados, el mapa y las cabeceras",
         REGENERAR, None,
         "Solo hace falta si has tocado una página, un CSS o un JS a mano."),
    ]),
]

REPASO = [
    "4-comprobar/enlaces-rotos.py",
    "4-comprobar/css-sano.py",
    "4-comprobar/temas-completos.py",
    "4-comprobar/nombres-repetidos.py",
    "4-comprobar/inyecciones.py",
]


def pasar(relativo, argumentos=None):
    """Llama a una herramienta como si la hubieras escrito tú, desde la
    carpeta del sitio: así todo lo que calcula rutas sigue encontrándolo
    todo donde espera."""
    ruta = HERRAMIENTAS / relativo
    print(f"\n  ---- {relativo} {' '.join(argumentos or [])}----\n")
    return subprocess.run(
        [sys.executable, str(ruta)] + list(argumentos or []),
        cwd=RAIZ,
        check=False,
    ).returncode


def faltan():
    """Lo que el menú nombra y no está. Se mira al arrancar: más vale
    enterarse aquí que al elegir la opción."""
    nombres = [o[1] for _, _, opciones in APARTADOS for o in opciones
               if o[1] not in (REPASAR_TODO, REGENERAR)] + REPASO
    return [n for n in dict.fromkeys(nombres) if not (HERRAMIENTAS / n).is_file()]


def hacer(opcion):
    titulo, script, argumentos, _ = opcion
    print(f"\n  >> {titulo}")
    if script == REPASAR_TODO:
        for uno in REPASO:
            pasar(uno)
    elif script == REGENERAR:
        # Los generadores, en el mismo orden que usan nuevo.py y
        # publicar.py: ese orden importa (ver GENERADORES en comun.py), así
        # que se coge de ahí en vez de repetirlo.
        sys.path.insert(0, str(HERRAMIENTAS))
        from comun import GENERADORES
        for uno in GENERADORES:
            pasar(uno)
    else:
        pasar(script, argumentos)
    input("\n  Hecho. Pulsa Enter para volver al menú. ")


def titulo_grande(texto):
    print("\n  ==================================")
    print(f"  {texto}")
    print("  ==================================\n")


def dibujar_apartados():
    titulo_grande("EL BLOG DE RICHI — ¿qué quieres hacer?")
    for i, (nombre, de_que, _) in enumerate(APARTADOS, start=1):
        print(f"   {i}. {nombre}")
        print(f"      {de_que}")
    print("\n   0. salir")
    print("\n  (si ya sabes cuál, «3.2» va directo a la segunda cosa del tercero)\n")


def dibujar_opciones(n):
    nombre, _, opciones = APARTADOS[n]
    titulo_grande(f"{n + 1}. {nombre.upper()}")
    for i, (titulo, _, _, pista) in enumerate(opciones, start=1):
        print(f"   {i}. {titulo}")
        print(f"      {pista}")
    print("\n   0. volver\n")


def numero(texto, cuantos):
    """El número escrito, de 1 a cuantos, como índice. None si no vale."""
    try:
        n = int(texto)
    except ValueError:
        return None
    return n - 1 if 1 <= n <= cuantos else None


def dentro_de(n):
    """El apartado n, hasta que se pide volver."""
    opciones = APARTADOS[n][2]
    while True:
        dibujar_opciones(n)
        elegido = input("  Elige un número: ").strip()
        if elegido in ("0", "", "q", "volver"):
            return
        i = numero(elegido, len(opciones))
        if i is None:
            print(f"\n  {elegido!r} no es ninguna de las opciones.")
            continue
        hacer(opciones[i])


def main():
    perdidas = faltan()
    if perdidas:
        print("\n  OJO: el menú nombra herramientas que no encuentro:")
        for p in perdidas:
            print(f"     {p}")
        print("  Si las has movido o renombrado, cámbialo en APARTADOS,")
        print("  dentro de herramientas/menu.py.")

    while True:
        dibujar_apartados()
        elegido = input("  Elige un número: ").strip()
        if elegido in ("0", "", "q", "salir"):
            print("\n  Hasta luego.\n")
            return 0

        # «3.2»: directo a la opción, sin pasar por la lista del apartado.
        if "." in elegido:
            a, _, o = elegido.partition(".")
            n = numero(a, len(APARTADOS))
            i = numero(o, len(APARTADOS[n][2])) if n is not None else None
            if i is None:
                print(f"\n  {elegido!r} no es ninguna de las opciones.")
                continue
            hacer(APARTADOS[n][2][i])
            continue

        n = numero(elegido, len(APARTADOS))
        if n is None:
            print(f"\n  {elegido!r} no es ninguno de los apartados.")
            continue
        dentro_de(n)


if __name__ == "__main__":
    sys.exit(main())
