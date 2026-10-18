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
# Pregunta el nombre y QUÉ TIPO DE PÁGINA es (lugar, personaje, raza o
# subraza, deidad, religión, organización, monstruo, objeto mágico,
# acontecimiento, era, astro, festividad, idioma) y la
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
#     # pregunta raza: ¿De qué…?     algo que preguntar; lo que se conteste
#                                    va donde ponga {{raza}}
#     # elige sub: ¿Qué es? | Astros=Astro | Constelaciones=Constelación | Otro
#                                    un menú: {{sub}} es lo elegido y
#                                    {{sub_uno}} lo de detrás del «=» (en
#                                    singular, para la ficha); «Otro» deja
#                                    escribir uno nuevo
#     # busca donde: ¿Dónde está?    busca entre las páginas que hay (vale
#                                    escribir solo un trozo) y deja elegir;
#                                    si no está, va escrito sin enlace
#     # carpeta: Personajes          dónde se guarda, dentro de wiki/
#     # carpeta: junto a {{raza}}    o en la carpeta de esa otra página (y
#                                    con /{{nombre}} detrás, en una suya
#                                    dentro de ella: el País)
#     # si no está: Razas/{{raza}}   dónde, si esa otra página no existe
#     # oculta: sí                   no sale en la lista (la Subraza: se
#                                    llega a ella desde «Raza»)
#     # especial: raza               la Raza: pregunta si es raza o
#                                    subraza (ver flujo_de_raza)
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

import difflib
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

RE_META = re.compile(r"^#\s*(plantilla|para|orden|carpeta|si no está|oculta|especial"
                     r"|pregunta\s+\w+|elige\s+\w+|busca\s+\w+)\s*:\s*(.*)$")


def leer_plantillas():
    """[{nombre, para, orden, carpeta, si_no, oculta, especial,
    preguntas: [(tipo, clave, texto)], texto, archivo}]"""
    salida = []
    if not PLANTILLAS.is_dir():
        return salida
    for archivo in sorted(PLANTILLAS.glob("*.md")):
        texto = archivo.read_text(encoding="utf-8")
        una = {"nombre": re.sub(r"^\d+\w?\s*", "", archivo.stem), "para": "", "orden": 999,
               "carpeta": "", "si_no": "", "oculta": False, "especial": "",
               "preguntas": [], "texto": texto, "archivo": archivo}
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
            elif clave == "si no está":
                una["si_no"] = valor
            elif clave == "oculta":
                una["oculta"] = valor.lower() in SI
            elif clave == "especial":
                una["especial"] = valor.lower()
            else:
                tipo, nombre = clave.split()
                una["preguntas"].append((tipo, nombre, valor))
        salida.append(una)
    return sorted(salida, key=lambda u: (u["orden"], u["nombre"].lower()))


def paginas_de_la_wiki():
    """Todas las páginas de la wiki (sin las plantillas): [archivo]."""
    return [a for a in VAULT.rglob("*.md") if "_system" not in a.relative_to(VAULT).parts]


def pagina_llamada(nombre):
    """El .md de la wiki que se llama así (sin mirar mayúsculas ni
    tildes), o None."""
    bajo = sin_tildes(nombre.strip()).lower()
    for archivo in paginas_de_la_wiki():
        if sin_tildes(archivo.stem).lower() == bajo:
            return archivo
    return None


def elegir_de_lista(pregunta, opciones):
    """Un menú numerado; devuelve el índice elegido (desde 0)."""
    print("\n  " + pregunta)
    for n, texto in enumerate(opciones, start=1):
        print(f"     {n:>2}. {texto}")
    while True:
        dicho = preguntar("Elige", "1")
        if dicho.isdigit() and 1 <= int(dicho) <= len(opciones):
            return int(dicho) - 1
        print("     Tiene que ser uno de los números de la lista.")


def preguntar_eleccion(texto):
    """«¿Pregunta? | Opción=en singular | Opción | Otro» -> (valor, singular).
    «Otro» deja escribir uno nuevo."""
    trozos = [t.strip() for t in texto.split("|")]
    pregunta, opciones = trozos[0], [t for t in trozos[1:] if t]
    pares = [(o.split("=", 1) + [o])[:2] if "=" in o else [o, o] for o in opciones]
    i = elegir_de_lista(pregunta, [p[0] for p in pares])
    valor, uno = pares[i]
    if valor.lower() == "otro":
        valor = ""
        while not valor:
            valor = preguntar("Escríbelo (en plural si es un apartado: «Cometas»)")
        uno = preguntar("¿Y uno solo cómo se dice? (para la ficha: «Cometa»)", valor)
    return valor.strip(), uno.strip()


def buscar_pagina(texto):
    """Busca entre las páginas que ya hay la que se diga. Devuelve
    (nombre, con_enlace): con_enlace es False si no existe y se queda
    escrito tal cual."""
    while True:
        dicho = preguntar(texto + " (Enter: ninguno)").strip().strip("[]").strip()
        if not dicho:
            return "", False
        exacta = pagina_llamada(dicho)
        if exacta:
            print(f"     → [[{exacta.stem}]]")
            return exacta.stem, True
        buscado = sin_tildes(dicho).lower()
        nombres = sorted({a.stem for a in paginas_de_la_wiki()}, key=str.lower)
        parecidas = [n for n in nombres if buscado in sin_tildes(n).lower()]
        if len(parecidas) < 8:
            for n in difflib.get_close_matches(dicho, nombres, 8, 0.6):
                if n not in parecidas:
                    parecidas.append(n)
        parecidas = parecidas[:8]
        if not parecidas:
            print(f"     No hay ninguna página que se parezca a «{dicho}».")
            if preguntar("¿Lo dejo escrito así, sin enlace? (S/n)", "s").lower() in SI:
                return dicho, False
            continue
        i = elegir_de_lista(f"¿Cuál es? (he buscado «{dicho}»)",
                            parecidas + [f"ninguna: dejar «{dicho}» escrito sin enlace",
                                         "ninguna: buscar otra cosa"])
        if i < len(parecidas):
            return parecidas[i], True
        if i == len(parecidas):
            return dicho, False


def rellenar(plantilla, valores, sin_enlace=()):
    """El texto de la plantilla con los huecos rellenos y sin las líneas que
    son solo para esta herramienta."""
    lineas = [l for l in plantilla["texto"].split("\n") if not RE_META.match(l.strip())]
    texto = "\n".join(lineas)
    for clave in sorted(valores, key=len, reverse=True):
        valor = valores[clave]
        if valor and clave in sin_enlace:
            # Lo que no es una página de la wiki va escrito, no enlazado.
            texto = texto.replace("[[{{%s}}]]" % clave, valor)
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


def desde_plantilla(plantilla, nombre, fijos=None):
    """(carpeta dentro de wiki/, texto de la página)."""
    valores = {"nombre": nombre}
    valores.update(fijos or {})
    sin_enlace = set()
    for tipo, clave, texto in plantilla["preguntas"]:
        if clave in valores:
            continue
        if tipo == "elige":
            valores[clave], valores[clave + "_uno"] = preguntar_eleccion(texto)
        elif tipo == "busca":
            valor, enlazado = buscar_pagina(texto)
            valores[clave] = valor
            if valor and not enlazado:
                sin_enlace.add(clave)
        else:
            valor = preguntar(texto).strip().strip("[]").strip()
            # Si es el nombre de una página que ya existe, tal y como se
            # llama ella: «elfos» y «Elfos» serían dos apartados distintos
            # en la portada (las etiquetas se escriben como se escriben).
            otra = pagina_llamada(valor) if valor else None
            valores[clave] = otra.stem if otra else valor

    return carpeta_de(plantilla, valores), rellenar(plantilla, valores, sin_enlace)


def carpeta_de(plantilla, valores):
    """Dónde se guarda, dentro de wiki/, con las respuestas ya dadas (la
    usa también el editor: herramientas/1-publicar/editor-wiki.py)."""
    carpeta = plantilla["carpeta"] or "otros"
    m = re.match(r"^junto a \{\{(\w+)\}\}(/.*)?$", carpeta)
    if m:
        # En la carpeta de otra página (una subraza, junto a su raza), y
        # dentro de ella lo que venga detrás (un país: junto a su región,
        # en su propia carpeta: «junto a {{region}}/{{nombre}}»).
        otra = pagina_llamada(valores.get(m.group(1), "")) if valores.get(m.group(1)) else None
        if otra:
            carpeta = otra.parent.relative_to(VAULT).as_posix() + (m.group(2) or "")
        else:
            carpeta = plantilla["si_no"] or "otros"
    for clave, valor in valores.items():
        carpeta = carpeta.replace("{{%s}}" % clave, valor)
    return re.sub(r"/?\{\{\w+\}\}", "", carpeta).strip("/") or "otros"


# =========================================
# LAS RAZAS Y SUS SUBRAZAS
# =========================================
# Una sola entrada en la lista: «Raza». Después se elige si es una raza
# (que podrá tener subrazas) o una subraza de una de las que ya hay; o de
# una que aún no existe, y entonces se crea también la raza.

def razas_que_hay():
    """Los nombres de las páginas que son razas: llevan la etiqueta Razas
    y no son subraza de nadie."""
    salida = []
    for archivo in paginas_de_la_wiki():
        cabeza = archivo.read_text(encoding="utf-8").split("\n---", 1)[0]
        etiquetas = re.search(r"^tags:\s*\[(.*)\]", cabeza, re.M)
        if not etiquetas or "razas" not in [sin_tildes(e.strip()).lower()
                                            for e in etiquetas.group(1).split(",")]:
            continue
        if re.search(r"^subraza de:", cabeza, re.M):
            continue
        salida.append(archivo.stem)
    return sorted(salida, key=str.lower)


def nombre_nuevo(pregunta):
    while True:
        nombre = preguntar(pregunta).strip()
        if not nombre:
            continue
        malos = [c for c in nombre if c in PROHIBIDO]
        if malos:
            print(f"     No puede llevar {' '.join(malos)}: es el nombre de un archivo.")
            continue
        if pagina_llamada(nombre):
            print(f"     Ya hay una página que se llama así: {pagina_llamada(nombre).relative_to(RAIZ)}")
            continue
        return nombre


def flujo_de_raza(plantilla_raza, plantillas, nombre):
    subraza = next((p for p in plantillas if p["especial"] == "subraza"), None)
    razas = razas_que_hay()
    opciones = [f"Es una raza (podrá tener subrazas)"]
    opciones += [f"Es una subraza de {r}" for r in razas] if subraza else []
    if subraza:
        opciones.append("Es una subraza de una raza que aún no existe (la creo también)")
    i = elegir_de_lista(f"¿{nombre} es una raza o una subraza?", opciones)
    if i == 0:
        return desde_plantilla(plantilla_raza, nombre)
    if i <= len(razas):
        return desde_plantilla(subraza, nombre, {"raza": razas[i - 1]})
    raza = nombre_nuevo("¿Cómo se llama la raza? (Elfos, Enanos…)")
    carpeta, texto = desde_plantilla(plantilla_raza, raza)
    escribir_pagina(raza, carpeta, texto)
    return desde_plantilla(subraza, nombre, {"raza": raza})


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

    todas = leer_plantillas()
    plantillas = [p for p in todas if not p["oculta"]]
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
            if plantilla["especial"] == "raza":
                carpeta, texto = flujo_de_raza(plantilla, todas, nombre)
            else:
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


def escribir_pagina(nombre, carpeta, texto):
    destino = VAULT / carpeta / (nombre + ".md")
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(texto, encoding="utf-8")
    print(f"\n  Creada: {destino.relative_to(RAIZ)}")
    return destino


def crear(nombre, carpeta, texto):
    destino = escribir_pagina(nombre, carpeta, texto)
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
