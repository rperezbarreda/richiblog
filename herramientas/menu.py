#!/usr/bin/env python3
# =========================================
# EL MENÚ — ¿QUÉ QUIERES HACER?
# =========================================
# La puerta de entrada a todo lo demás. En vez de acordarse de cómo se
# llama cada herramienta y en qué carpeta está, se pasa esto:
#
#     python herramientas/menu.py
#
# y SE ABRE EL EDITOR DE LA WEB, en el navegador (1-publicar/editor-wiki.py):
# ahí está casi todo con ventanas, y en su apartado «Comandos», cada cosa
# de este menú con un botón que la abre en su propia ventana de comandos.
# El menú de siempre, aquí mismo, con:
#
#     python herramientas/menu.py --texto
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

# El editor de la web (en el navegador) sale el último en cada apartado
# (para no mover los números de siempre), abierto ya en el suyo: lo mismo
# que lo de encima, pero con ventanas.
EDITOR = "1-publicar/editor-wiki.py"


def editor(en, que):
    return ("Todo esto en el editor (en el navegador)", EDITOR, ["--en", en], que)


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
        editor("escribir", "Escribir como en un Word, seguir con una ya hecha y publicarla."),
    ]),

    ("Mis movidas", "relatos y el reto de escritura", [
        ("Escribir un relato",
         "1-publicar/nuevo.py", ["--relato"],
         "Igual que una entrada, pero va a mis movidas."),
        ("Escribir un día del reto de escritura",
         "1-publicar/nuevo.py", ["--reto"],
         "Coge el siguiente día que falte, con su palabra."),
        PUBLICAR,
        editor("escribir", "Relatos y días del reto, escritos como en un Word."),
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
        ("Pasar mis personajes a la web",
         "3-generadores/generar-personajes.py", [],
         "Rehace el índice y la ficha de cada uno desde datos/personajes/personajes.json."),
        PUBLICAR,
        editor("campanas", "Las notas de partida, los NPC, el botín y lo demás de las campañas, con fichas."),
    ]),

    ("Wiki Cralëa", "escribir sus páginas, la línea de tiempo y pasarla a la web", [
        ("Escribir en la wiki con el editor (en el navegador)",
         EDITOR, ["--en", "wiki"],
         "Páginas, mapas, línea de tiempo, calendario y diccionario; y pasarla a la web."),
        ("Escribir una página nueva de la wiki (aquí, con preguntas)",
         "1-publicar/nueva-pagina-wiki.py", [],
         "Elige el tipo (país, personaje, monstruo…) y crea el .md con su plantilla."),
        ("Llevar la línea de tiempo",
         "1-publicar/linea-de-tiempo.py", [],
         "Añadir, cambiar o quitar eventos. Cada uno tiene su página."),
        ("Llevar el calendario (festividades y eventos)",
         "1-publicar/calendario.py", [],
         "Lo que sale marcado en el calendario de la portada de la wiki."),
        ("Llevar el diccionario",
         "1-publicar/diccionario.py", [],
         "Las palabras de las lenguas del mundo (y del generador de nombres)."),
        ("Ver lo que falta en la wiki",
         "5-consulta/pendientes-wiki.py", [],
         "Páginas por escribir, campos «por decidir», relleno e imágenes."),
        ("Pasar la wiki a la web",
         "3-generadores/generar-mundo.py", [],
         "Convierte los .md y el mapa de la carpeta wiki/ en páginas."),
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
        editor("rincon", "En lo que ando, las recomendaciones y las fotos de los gatos."),
    ]),

    ("Imágenes", "traerlas de tu ordenador y dejarlas a punto", [
        ("Traer una imagen de tu ordenador",
         "2-imagenes/traer-imagen.py", [],
         "Pegas la ruta y la deja en su carpeta, en WebP y a su tamaño."),
        ("Preparar las imágenes antes de subirlas",
         "2-imagenes/optimizar-imagenes.py", [],
         "Solo lo nuevo: a WebP, a su tamaño y sin los datos del móvil."),
        ("Sacar los tamaños del dibujo de la portada",
         "2-imagenes/tamanos-portada.py", [],
         "Solo si has cambiado el dibujo de la portada."),
        ("Instalar las ayudas de los mapas (una vez)",
         "2-imagenes/instalar-ayudas-de-mapas.py", [],
         "Para que el editor busque los mapas en el mapamundi y los amplíe con IA sin que salgan borrosos."),
        editor("repasar", "Elegir la imagen en una ventana en vez de pegar la ruta."),
    ]),

    ("Repasar y subir", "repasar el sitio, rehacer lo generado y subirlo a Neocities", [
        ("Repasar el sitio entero",
         REPASAR_TODO, None,
         "Pasa de golpe las cinco comprobaciones de 4-comprobar/."),
        ("Repasar que no haya enlaces rotos",
         "4-comprobar/enlaces-rotos.py", [],
         "No cambia nada: solo mira y te lo cuenta."),
        ("Volver a generar los listados, el mapa y las cabeceras",
         REGENERAR, None,
         "Solo hace falta si has tocado una página, un CSS o un JS a mano."),
        ("Subir el sitio a Neocities",
         "1-publicar/subir-neocities.py", [],
         "Sube solo lo que ha cambiado (pregunta antes). La primera vez pide la clave de la API."),
        ("Ver qué se subiría a Neocities (sin subir nada)",
         "1-publicar/subir-neocities.py", ["--ensayo"],
         "Un ensayo: compara y te lo cuenta."),
        ("Subir y borrar de Neocities lo que ya no está aquí",
         "1-publicar/subir-neocities.py", ["--borrar"],
         "Como subir, y además borra allí lo que aquí ya no existe (enseña la lista y pregunta aparte)."),
        ("Cambiar la clave de la API de Neocities",
         "1-publicar/subir-neocities.py", ["--clave"],
         "Por si la has cambiado en Neocities."),
        editor("neocities", "Repasar, ver qué se subiría y subirlo, con botones."),
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


def hacer(opcion, al_acabar="Hecho. Pulsa Enter para volver al menú. "):
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
    input("\n  " + al_acabar)


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


def opcion_de(texto):
    """«3.2» -> la opción (o None si no hay tal)."""
    a, _, o = str(texto).partition(".")
    n = numero(a, len(APARTADOS))
    i = numero(o, len(APARTADOS[n][2])) if n is not None else None
    return APARTADOS[n][2][i] if i is not None else None


def es_el_editor(opcion):
    return opcion[1] == EDITOR


# =========================================
# ABRIR UNA OPCIÓN EN SU PROPIA VENTANA
# =========================================
# Lo que usa el apartado «Comandos» del editor: cada opción del menú en una
# ventana de comandos nueva (las herramientas preguntan cosas, y eso se
# contesta en una ventana, no en el navegador). Va como «menu.py --solo
# 3.2»: hace esa opción y espera a que pulses Enter para cerrarse, para
# que dé tiempo a leer lo que ha dicho. Sin opción, el menú entero.

def abrir_en_ventana(cual=None):
    """Abre una ventana de comandos con esa opción («3.2») o con el menú
    de siempre (None). Devuelve None si va, o qué ha fallado."""
    orden = [sys.executable, str(HERRAMIENTAS / "menu.py")] + (["--solo", cual] if cual else ["--texto"])
    try:
        if sys.platform.startswith("win"):
            subprocess.Popen(orden, cwd=RAIZ, creationflags=subprocess.CREATE_NEW_CONSOLE)
            return None
        if sys.platform == "darwin":
            linea = "cd " + _entre_comillas(str(RAIZ)) + " && " + " ".join(_entre_comillas(x) for x in orden)
            subprocess.Popen(["osascript", "-e", 'tell application "Terminal" to do script "%s"'
                              % linea.replace("\\", "\\\\").replace('"', '\\"'),
                              "-e", 'tell application "Terminal" to activate'])
            return None
        import shutil
        for terminal, antes in (("x-terminal-emulator", ["-e"]), ("gnome-terminal", ["--"]),
                                ("konsole", ["-e"]), ("xfce4-terminal", ["-x"]), ("xterm", ["-e"])):
            if shutil.which(terminal):
                subprocess.Popen([terminal] + antes + orden, cwd=RAIZ)
                return None
    except OSError as error:
        return "No he podido abrir la ventana de comandos (%s)." % error
    return ("No sé abrir una ventana de comandos en este ordenador. Abre una tú y escribe: "
            + " ".join(_entre_comillas(x) for x in ["python", "herramientas/menu.py"]
                       + (["--solo", cual] if cual else ["--texto"])))


def _entre_comillas(texto):
    return "'" + texto.replace("'", "'\\''") + "'" if any(c in texto for c in " '\"$") else texto


def solo(cual):
    """--solo 3.2: esa opción y nada más (en su ventana)."""
    opcion = opcion_de(cual)
    if opcion is None:
        print(f"\n  {cual!r} no es ninguna de las opciones.")
        input("\n  Pulsa Enter para cerrar esta ventana. ")
        return 1
    hacer(opcion, "Hecho. Pulsa Enter para cerrar esta ventana. ")
    return 0


def main():
    argumentos = sys.argv[1:]
    if "--solo" in argumentos[:-1]:
        return solo(argumentos[argumentos.index("--solo") + 1])
    if "--texto" not in argumentos:
        # Lo normal: el editor de la web, en el navegador.
        print("\n  Abriendo el editor de la web en el navegador.")
        print("  (El menú de aquí, con: python herramientas/menu.py --texto)")
        return pasar(EDITOR)
    return menu_de_texto()


def menu_de_texto():
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
