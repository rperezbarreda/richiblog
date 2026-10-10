#!/usr/bin/env python3
# =========================================
# EL MENÚ — ¿QUÉ QUIERES HACER?
# =========================================
# La puerta de entrada a todo lo demás. En vez de acordarse de cómo se
# llama cada herramienta y en qué carpeta está, se pasa esto:
#
#     python herramientas/menu.py
#
# y sale una lista en castellano de lo que se puede hacer. Eliges un
# número y él llama a la que toca, pasándole lo que haga falta.
#
# NO HACE NADA POR SU CUENTA. Es un índice que llama a otros: todo lo que
# ocurre de verdad sigue estando en el script de siempre, que se puede
# seguir usando suelto si ya sabes cuál es. Esto existe para los días en
# que no te acuerdas.
#
# PARA AÑADIR UNA OPCIÓN: una línea más en OPCIONES, aquí abajo. El menú
# se dibuja solo a partir de esa lista, y comprueba al arrancar que todos
# los archivos que nombra existan de verdad: una herramienta que se
# renombre y no se cambie aquí se canta nada más abrir el menú, en vez de
# fallar el día que la elijas.

import subprocess
import sys
from pathlib import Path

HERRAMIENTAS = Path(__file__).resolve().parent
RAIZ = HERRAMIENTAS.parent

# (qué hace, qué script, qué argumentos le pasa, una línea explicándolo)
#
# Los argumentos de aquí son los que hacen que una misma herramienta
# salga como varias cosas distintas en el menú: nuevo.py sabe publicar
# cinco cosas, y aquí cada una es su propia opción, que es como se piensa
# en ello ("voy a escribir una entrada"), no como lo pide el script.
OPCIONES = [
    ("Escribir una entrada del blog",
     "1-publicar/nuevo.py", ["--entrada"],
     "Crea la página con la fecha puesta. Nace como borrador."),

    ("Escribir un relato",
     "1-publicar/nuevo.py", ["--relato"],
     "Igual que una entrada, pero va a mis movidas."),

    ("Escribir un día del reto de escritura",
     "1-publicar/nuevo.py", ["--reto"],
     "Coge la palabra del día que toque."),

    ("Añadir algo al portfolio de rol",
     "1-publicar/nuevo.py", ["--rol"],
     "Una ficha, un mapa, una aventura…"),

    ("Apuntar las notas de una partida de rol",
     "1-publicar/nuevo.py", ["--sesion"],
     "Elige la campaña y deja el cuaderno en blanco."),

    ("Añadir NPC a una campaña",
     "1-publicar/nuevo-personaje.py", [],
     "Los NPC: nombre, grupo, qué es, foto y lo que sepamos."),

    ("Añadir una recomendación",
     "1-publicar/nueva-recomendacion.py", [],
     "Libros, pelis, juegos… lo de la página de recomendaciones."),

    ("Cambiar lo que pone «en lo que ando»",
     "1-publicar/en-lo-que-ando.py", [],
     "Lo que leo, veo y juego, lo que escribo y el post-it de pendientes."),

    ("PUBLICAR un borrador",
     "1-publicar/publicar.py", [],
     "Lo que ya esté escrito deja de ser borrador y sale en la web."),

    ("Preparar las imágenes antes de subirlas",
     "2-imagenes/optimizar-imagenes.py", [],
     "Pasa imagenes/ a WebP, las encoge y les quita los datos de dentro."),

    ("Añadir fotos a la galería de un gato",
     "2-imagenes/generar-galeria.py", [],
     "Hace las miniaturas y pregunta la descripción de cada una."),

    ("Traer el mundo desde Chronicler",
     "1-publicar/importar-mundo.py", [],
     "Se trae la bóveda entera —páginas, mapas e imágenes— y la publica."),

    ("Pasar el mundo a la web",
     "3-generadores/generar-mundo.py", [],
     "Convierte la wiki de mundo/ (la bóveda de Chronicler) en páginas."),

    ("Repasar que no haya enlaces rotos",
     "4-comprobar/enlaces-rotos.py", [],
     "No cambia nada: solo mira y te lo cuenta."),

    ("Repasar el sitio entero antes de subirlo",
     None, None,
     "Pasa de golpe las cinco comprobaciones de 4-comprobar/."),

    ("Volver a generar los listados, el mapa y las cabeceras",
     None, None,
     "Solo hace falta si has tocado una página a mano."),
]

# Las dos opciones de arriba que no son una herramienta suelta, sino
# varias seguidas. Van por nombre de archivo y no por número de opción
# para que reordenar el menú no las descoloque.
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
    print(f"\n  ---- {relativo} ----\n")
    return subprocess.run(
        [sys.executable, str(ruta)] + list(argumentos or []),
        cwd=RAIZ,
        check=False,
    ).returncode


def faltan():
    """Lo que el menú nombra y no está. Se mira al arrancar: más vale
    enterarse aquí que al elegir la opción."""
    nombres = [o[1] for o in OPCIONES if o[1]] + REPASO
    return [n for n in dict.fromkeys(nombres) if not (HERRAMIENTAS / n).is_file()]


def dibujar():
    print("\n  ==================================")
    print("  EL BLOG DE RICHI — ¿qué quieres hacer?")
    print("  ==================================\n")
    for i, (titulo, _, _, pista) in enumerate(OPCIONES, start=1):
        print(f"   {i:>2}. {titulo}")
        print(f"       {pista}")
    print("\n    0. salir\n")


def main():
    perdidas = faltan()
    if perdidas:
        print("\n  OJO: el menú nombra herramientas que no encuentro:")
        for p in perdidas:
            print(f"     {p}")
        print("  Si las has movido o renombrado, cámbialo en OPCIONES,")
        print("  dentro de herramientas/menu.py.")

    while True:
        dibujar()
        elegido = input("  Elige un número: ").strip()
        if elegido in ("0", "", "q", "salir"):
            print("\n  Hasta luego.\n")
            return 0
        try:
            titulo, script, argumentos, _ = OPCIONES[int(elegido) - 1]
        except (ValueError, IndexError):
            print(f"\n  {elegido!r} no es ninguna de las opciones.")
            continue

        print(f"\n  >> {titulo}")
        if script:
            pasar(script, argumentos)
        elif "Repasar el sitio" in titulo:
            for uno in REPASO:
                pasar(uno)
        else:
            # Los generadores, en el mismo orden que usan nuevo.py y
            # publicar.py: ese orden importa (ver GENERADORES en
            # comun.py), así que se coge de ahí en vez de repetirlo.
            sys.path.insert(0, str(HERRAMIENTAS))
            from comun import GENERADORES

            for uno in GENERADORES:
                pasar(uno)

        input("\n  Hecho. Pulsa Enter para volver al menú. ")


if __name__ == "__main__":
    sys.exit(main())
