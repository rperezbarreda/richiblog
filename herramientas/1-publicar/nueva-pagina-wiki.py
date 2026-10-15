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
#     wiki/Lugares/Valderín.md
#
# Pregunta el nombre y QUÉ TIPO DE PÁGINA es (país, región, asentamiento,
# lugar, personaje, raza, deidad, religión, organización, monstruo,
# objeto mágico, acontecimiento, era, astro, festividad, idioma) y la
# crea con su PLANTILLA: la ficha con todos los campos que suele llevar
# esa clase de página en una wiki de un mundo de fantasía, y los apartados
# de siempre, cada uno con una nota escondida que dice qué va ahí. Los
# campos que dejes vacíos no salen, y las notas (<!-- así -->) tampoco: se
# puede publicar a medio rellenar.
#
# LAS PLANTILLAS están en wiki/_system/templates/ (la carpeta donde
# Chronicler guarda las suyas, que no se publica). Son .md normales: se
# pueden cambiar, y una nueva que pongas ahí sale sola en la lista. Arriba
# llevan unas líneas que lee esta herramienta y que no pasan a la página:
#
#     # plantilla: País              el nombre en la lista
#     # para: un reino, un…          la explicación de al lado
#     # orden: 1                     dónde sale en la lista
#     # pregunta region: ¿De qué…?   algo que preguntar; lo que se conteste
#                                    va donde ponga {{region}}
#     # carpeta: Personajes          dónde se guarda, dentro de wiki/
#     # carpeta: junto a {{region}}  o en la carpeta de esa otra página
#                                    (y entonces {{parte}} es la parte del
#                                    mapamundi en la que está)
#
# {{nombre}} es siempre el nombre de la página. Lo que no se conteste se
# queda vacío (un [[{{algo}}]] sin contestar desaparece entero).
#
# Luego lo abres con cualquier editor de texto y escribes. Cómo se escribe cada cosa (negrita,
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

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from comun import (RAIZ, elegir, esta_fuera, guardar_wiki_fuera,  # noqa: E402
                   leer_json, pasar_generadores, preguntar, sin_tildes, wiki_fuera)

VAULT = RAIZ / "wiki"
PLANTILLAS = VAULT / "_system" / "templates"
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
        "# La bandera y el blasón, arriba del todo y en el mismo hueco:",
        "# bandera: nombre.webp  y  blasón: nombre.webp",
        "# (en wiki/_imagenes/banderas/, o donde quieras dentro de _imagenes).",
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


# =========================================
# LAS PLANTILLAS
# =========================================

RE_META = re.compile(r"^#\s*(plantilla|para|orden|carpeta|pregunta\s+\w+)\s*:\s*(.*)$")


def leer_plantillas():
    """[{nombre, para, orden, carpeta, preguntas: [(clave, texto)], texto}]"""
    salida = []
    if not PLANTILLAS.is_dir():
        return salida
    for archivo in sorted(PLANTILLAS.glob("*.md")):
        texto = archivo.read_text(encoding="utf-8")
        una = {"nombre": re.sub(r"^\d+\s*", "", archivo.stem), "para": "", "orden": 999,
               "carpeta": "", "preguntas": [], "texto": texto}
        for linea in texto.split("\n"):
            m = RE_META.match(linea.strip())
            if not m:
                continue
            clave, valor = m.group(1), m.group(2).strip()
            if clave == "plantilla":
                una["nombre"] = valor
            elif clave == "para":
                una["para"] = valor
            elif clave == "orden":
                una["orden"] = int(valor) if valor.isdigit() else 999
            elif clave == "carpeta":
                una["carpeta"] = valor
            else:
                una["preguntas"].append((clave.split()[1], valor))
        salida.append(una)
    return sorted(salida, key=lambda u: (u["orden"], u["nombre"].lower()))


def pagina_llamada(nombre):
    """El .md de la wiki que se llama así (sin mirar mayúsculas), o None."""
    bajo = nombre.strip().lower()
    for archivo in VAULT.rglob("*.md"):
        if archivo.stem.lower() == bajo and "_system" not in archivo.relative_to(VAULT).parts:
            return archivo
    return None


def rellenar(plantilla, valores):
    """El texto de la plantilla con los huecos rellenos y sin las líneas que
    son solo para esta herramienta."""
    lineas = [l for l in plantilla["texto"].split("\n") if not RE_META.match(l.strip())]
    texto = "\n".join(lineas)
    for clave, valor in valores.items():
        if valor:
            texto = texto.replace("{{%s}}" % clave, valor)
        else:
            # Un enlace a nada desaparece entero, comillas incluidas («región:
            # "[[]]"» no dice nada); en una lista de etiquetas, con su coma.
            texto = re.sub(r'"?\[\[\{\{%s\}\}\]\]"?' % re.escape(clave), "", texto)
            texto = re.sub(r",\s*\{\{%s\}\}" % re.escape(clave), "", texto)
            texto = texto.replace("{{%s}}" % clave, "")
    return texto


def con_subtitulo(texto, subtitulo):
    if not subtitulo:
        return texto
    return re.sub(r'^subtitle:.*$', "subtitle: " + entre_comillas(subtitulo), texto, count=1, flags=re.M)


def desde_plantilla(plantilla, nombre):
    """(carpeta dentro de wiki/, texto de la página)."""
    valores = {"nombre": nombre}
    for clave, pregunta in plantilla["preguntas"]:
        valores[clave] = preguntar(pregunta).strip().strip("[]").strip()

    carpeta = plantilla["carpeta"] or "otros"
    m = re.match(r"^junto a \{\{(\w+)\}\}$", carpeta)
    if m:
        # En la carpeta de otra página (un país, junto a su región), y la
        # parte del mapamundi es la carpeta de debajo de Mapamundi/.
        otra = pagina_llamada(valores.get(m.group(1), "")) if valores.get(m.group(1)) else None
        if otra:
            relativa = otra.parent.relative_to(VAULT)
            carpeta = relativa.as_posix()
            if len(relativa.parts) > 1 and relativa.parts[0].lower() == "mapamundi":
                valores.setdefault("parte", relativa.parts[1])
        else:
            if valores.get(m.group(1)):
                print(f"     No encuentro ninguna página que se llame «{valores[m.group(1)]}».")
            parte = preguntar("¿En qué parte del mapamundi va? (Azarasia, Partaria, Archipiélagos)")
            valores["parte"] = parte
            carpeta = "Mapamundi/" + parte if parte else "Mapamundi"
    # Lo que quede por rellenar en la carpeta ({{parte}} en la de una región).
    for clave, valor in valores.items():
        carpeta = carpeta.replace("{{%s}}" % clave, valor)
    carpeta = re.sub(r"/?\{\{\w+\}\}", "", carpeta).strip("/") or "otros"
    return carpeta, rellenar(plantilla, valores)


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
        ya = [p for p in [pagina_llamada(nombre)] if p]
        if ya:
            print(f"     Ya hay una que se llama así: {ya[0].relative_to(RAIZ)}")
            nombre = ""

    plantillas = leer_plantillas()
    if plantillas:
        print("\n  ¿Qué tipo de página es?")
        for n, una in enumerate(plantillas, start=1):
            print(f"     {n:>2}. {una['nombre']:<16} {una['para']}")
        print(f"     {len(plantillas) + 1:>2}. {'En blanco':<16} sin plantilla: solo la cabecera y un apartado")
        while True:
            dicho = preguntar("Elige", "1")
            if dicho.isdigit() and 1 <= int(dicho) <= len(plantillas) + 1:
                break
            print("     Tiene que ser uno de los números de la lista.")
        if int(dicho) <= len(plantillas):
            plantilla = plantillas[int(dicho) - 1]
            carpeta, texto = desde_plantilla(plantilla, nombre)
            texto = con_subtitulo(texto, preguntar(
                "Subtítulo, una línea debajo del título (Enter: ninguno)"))
            return crear(nombre, carpeta, texto)

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

    return crear(nombre, carpeta, esqueleto(nombre, etiqueta, subtitulo, que))


def crear(nombre, carpeta, texto):
    destino = VAULT / carpeta / (nombre + ".md")
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(texto, encoding="utf-8")
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
    print("  Ábrela con cualquier editor de texto y escribe. Los campos de la ficha")
    print("  que dejes vacíos no salen, ni las notas <!-- así --> de cada apartado.")
    print("  Cómo se escribe cada cosa: wiki/Cómo se escribe esto.md.")

    if preguntar("\n  ¿La paso ya a la web, tal cual está? (s/N)", "n").lower() in SI:
        pasar_generadores(("3-generadores/generar-mundo.py",))
    else:
        print("\n  Cuando la tengas: menú → Wiki Cralëa → Pasar la wiki a la web.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
