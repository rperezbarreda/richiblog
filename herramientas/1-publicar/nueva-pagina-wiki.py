#!/usr/bin/env python3
# =========================================
# UNA PÁGINA NUEVA DE LA WIKI
# =========================================
# La wiki se escribe a mano: cada página es un archivo de texto (.md)
# dentro de wiki/, y herramientas/3-generadores/generar-mundo.py los pasa
# a la web. Esto crea el archivo de una página nueva, con su cabecera ya
# puesta y un esqueleto para rellenar, en la carpeta de su apartado:
#
#     python herramientas/1-publicar/nueva-pagina-wiki.py
#
#     wiki/lugares/Valderín.md
#
# Pregunta el nombre, el apartado de la portada (países, lugares,
# personajes…, los de datos/wiki/mundo-categorias.json), una línea de
# subtítulo y qué es (lo que sale encima de la ficha). Luego lo abres con
# cualquier editor de texto y escribes. Cómo se escribe cada cosa (negrita,
# listas, [[enlaces]] a otras páginas, la ficha de la derecha, imágenes…)
# está en wiki/Cómo se escribe esto.md, que se ve publicada en la wiki.
#
# EL NOMBRE DEL ARCHIVO ES EL NOMBRE DE LA PÁGINA: es como se la enlaza
# desde otra, [[Valderín]]. Si lo cambias, cambia también los enlaces.
#
# Cuando la tengas escrita, pásala a la web con el menú (Wiki Cralëa →
# Pasar la wiki a la web) o con
#
#     python herramientas/3-generadores/generar-mundo.py

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from comun import (RAIZ, elegir, esta_fuera, guardar_wiki_fuera,  # noqa: E402
                   leer_json, pasar_generadores, preguntar, sin_tildes, wiki_fuera)

VAULT = RAIZ / "wiki"
CATEGORIAS = RAIZ / "datos" / "wiki" / "mundo-categorias.json"
SI = ("s", "si", "sí")
# Lo que no puede ir en el nombre de un archivo en Windows.
PROHIBIDO = '<>:"/\\|?*'


def apartados():
    """[(nombre del apartado, la etiqueta que lo hace suyo)], sin los mapas,
    que no se escriben aquí."""
    salida = []
    for uno in leer_json(CATEGORIAS, []) or []:
        if not isinstance(uno, dict):
            continue
        nombre = str(uno.get("nombre") or "").strip()
        etiquetas = [str(e) for e in uno.get("etiquetas") or [] if str(e).strip()]
        if not nombre or not etiquetas or nombre == "mapas":
            continue
        # La primera de la lista, pero con tilde si la tiene en otra
        # («país» mejor que «pais»): es la que se lee en la página.
        primera = etiquetas[0]
        con_tilde = [e for e in etiquetas
                     if not e.isascii() and sin_tildes(e).lower() == sin_tildes(primera).lower()]
        salida.append((nombre, (con_tilde or [primera])[0]))
    return salida


def entre_comillas(texto):
    """Un valor de la cabecera, entre comillas para que un «:» o un [[ ]]
    no la rompan."""
    return '"%s"' % texto.replace("\\", "\\\\").replace('"', '\\"')


def esqueleto(nombre, etiqueta, subtitulo, que):
    cabecera = ["---", "title: " + entre_comillas(nombre)]
    if subtitulo:
        cabecera.append("subtitle: " + entre_comillas(subtitulo))
    if que:
        cabecera.append("infobox: " + entre_comillas(que))
    cabecera.append("tags: [%s]" % etiqueta)
    cabecera += [
        "# Lo de debajo sale en la ficha de la derecha, una fila por línea,",
        "# en este orden. Cambia, quita o añade las que quieras: «nombre: valor».",
        "# Una imagen arriba de la ficha: image: nombre-de-la-imagen.webp",
        "# (la imagen, en wiki/_imagenes/).",
        "---",
        "",
        "Una o dos frases que digan qué es %s. Este primer párrafo es el que" % nombre,
        "sale en la portada de la wiki y en el buscador.",
        "",
        "## Historia",
        "",
        "Lo que haya que contar. Para enlazar otra página: [[Nombre de la página]].",
        "",
    ]
    return "\n".join(cabecera)


def main():
    if not VAULT.is_dir():
        VAULT.mkdir(parents=True)
    print("\n  ==================================")
    print("  UNA PÁGINA NUEVA DE LA WIKI")
    print("  ==================================\n")

    nombre = ""
    while not nombre:
        nombre = preguntar("Nombre de la página (es también cómo se la enlaza: [[así]])")
        malos = [c for c in nombre if c in PROHIBIDO]
        if malos:
            print(f"     No puede llevar {' '.join(malos)}: es el nombre de un archivo.")
            nombre = ""
            continue
        ya = [p for p in VAULT.rglob("*.md") if p.stem.lower() == nombre.lower()]
        if ya:
            print(f"     Ya hay una que se llama así: {ya[0].relative_to(RAIZ)}")
            nombre = ""

    lista = apartados()
    nombres = [n for n, _ in lista]
    if nombres:
        elegido = elegir("¿En qué apartado de la portada va?", nombres + ["(otro: escribe la etiqueta)"],
                         permitir_nueva=True)
        if elegido in nombres:
            carpeta, etiqueta = elegido, dict(lista)[elegido]
        else:
            etiqueta = preguntar("Etiqueta") if elegido.startswith("(otro") else elegido
            carpeta = "otros"
    else:
        etiqueta = preguntar("Etiqueta (país, lugar, personaje…)", "lugar")
        carpeta = "otros"

    subtitulo = preguntar("Subtítulo, una línea debajo del título (Enter: ninguno)")
    que = preguntar("Qué es, para la ficha («Reino», «Ciudad portuaria»…; Enter: nada)")

    destino = VAULT / carpeta / (nombre + ".md")
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(esqueleto(nombre, etiqueta, subtitulo, que), encoding="utf-8")
    print(f"\n  Creada: {destino.relative_to(RAIZ)}")
    # Si esa ruta estaba en la lista de lo que se deja fuera (de cuando la
    # wiki venía de Chronicler), se quita: la acabas de escribir para que
    # salga.
    relativo = destino.relative_to(VAULT).as_posix()
    reglas = wiki_fuera()
    if esta_fuera(relativo, reglas):
        quedan = [r for r in reglas if r.lower() != relativo.lower()]
        if esta_fuera(relativo, quedan):
            print(f"  OJO: su carpeta está entera en herramientas/wiki-fuera.txt;"
                  " quítala de ahí o no saldrá.")
        else:
            guardar_wiki_fuera(quedan)
            print("  (estaba en herramientas/wiki-fuera.txt, la lista de lo que no se"
                  " publica: la he quitado de ahí)")
    print("  Ábrela con cualquier editor de texto y escribe. Cómo se escribe cada")
    print("  cosa: wiki/Cómo se escribe esto.md.")

    if preguntar("\n  ¿La paso ya a la web, tal cual está? (s/N)", "n").lower() in SI:
        pasar_generadores(("3-generadores/generar-mundo.py",))
    else:
        print("\n  Cuando la tengas: menú → Wiki Cralëa → Pasar la wiki a la web.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
