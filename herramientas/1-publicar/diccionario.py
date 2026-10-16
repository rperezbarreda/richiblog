#!/usr/bin/env python3
# =========================================
# EL DICCIONARIO DE LA WIKI
# =========================================
# Lleva las palabras de datos/wiki/diccionario.json: las que salen en la
# página Diccionario de la wiki y en el «Vocabulario» de cada idioma. Las
# palabras de cada idioma sirven además al generador de nombres, que
# aprende de ellas cómo suena esa lengua.
#
#     python herramientas/1-publicar/diccionario.py
#
#     a  añadir una palabra
#     c  cambiar una
#     q  quitar una
#
# CADA PALABRA:
#
#     palabra       como se escribe («Lunaah»).
#     idioma        el nombre de la página del idioma, si la tiene
#                   («Nithir»); si no, como se llame.
#     significado   lo que quiere decir.
#     notas         opcional: de dónde viene, cómo se pronuncia…
#     página        opcional: una página de la wiki donde se explica
#                   («La Luna»).
#
# Se guarda al momento. Para verlo en la web, pasa la wiki
# (generar-mundo.py), que es quien escribe la página del diccionario.

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from comun import RAIZ, escribir_json, leer_json, pasar_generadores, preguntar, sin_tildes  # noqa: E402

ARCHIVO = RAIZ / "datos" / "wiki" / "diccionario.json"
VAULT = RAIZ / "wiki"
SI = ("s", "si", "sí")


def cargar():
    datos = leer_json(ARCHIVO, None)
    if not isinstance(datos, dict):
        datos = {}
    if not isinstance(datos.get("palabras"), list):
        datos["palabras"] = []
    return datos


def guardar(datos):
    datos["palabras"].sort(key=lambda p: (sin_tildes(str(p.get("idioma") or "")).lower(),
                                         sin_tildes(str(p.get("palabra") or "")).lower()))
    escribir_json(ARCHIVO, datos)


def paginas():
    return {sin_tildes(a.stem).lower(): a.stem for a in VAULT.rglob("*.md")
            if "_system" not in a.relative_to(VAULT).parts}


def ensenar(datos):
    print("\n  ==================================")
    print("  EL DICCIONARIO")
    print("  ==================================")
    if not datos["palabras"]:
        print("\n  Todavía no hay ninguna palabra.")
        return
    ultimo = None
    for n, p in enumerate(datos["palabras"], start=1):
        idioma = p.get("idioma") or "(sin idioma)"
        if idioma != ultimo:
            ultimo = idioma
            print(f"\n   ── {idioma}")
        print(f"   {n:>3}. {p.get('palabra')}: {p.get('significado') or ''}")


def elegir(datos, pregunta):
    dicho = preguntar(f"{pregunta} (número; Enter en blanco: ninguna)")
    if dicho.isdigit() and 1 <= int(dicho) <= len(datos["palabras"]):
        return int(dicho) - 1
    if dicho:
        print(f"     {dicho!r} no es ninguna de la lista.")
    return None


def pedir(datos, p):
    while True:
        palabra = preguntar("Palabra", p.get("palabra", ""))
        if palabra:
            p["palabra"] = palabra
            break
        print("     Hace falta la palabra.")
    idiomas = sorted({str(x.get("idioma")) for x in datos["palabras"] if x.get("idioma")})
    if idiomas:
        print("     Idiomas que ya hay: " + ", ".join(idiomas))
    idioma = preguntar("Idioma", p.get("idioma", idiomas[0] if len(idiomas) == 1 else ""))
    # Si ya hay un idioma o una página que se llama así, como se llama.
    conocidos = {sin_tildes(i).lower(): i for i in idiomas}
    conocidos.update(paginas())
    p["idioma"] = conocidos.get(sin_tildes(idioma).lower(), idioma)
    p["significado"] = preguntar("Qué significa", p.get("significado", ""))
    notas = preguntar("Notas (Enter: ninguna; «-» para quitarlas)", p.get("notas", ""))
    p["notas"] = "" if notas == "-" else notas
    pagina = preguntar("Página de la wiki donde se explica (Enter: ninguna; «-» para quitarla)",
                       p.get("pagina", "")).strip("[] ")
    if pagina == "-" or not pagina:
        p["pagina"] = ""
    else:
        todas = paginas()
        real = todas.get(sin_tildes(pagina).lower())
        if not real:
            print(f"     No hay ninguna página que se llame «{pagina}»: la apunto igual, y saldrá"
                  " enlazada cuando exista.")
        p["pagina"] = real or pagina
    return p


def main():
    datos = cargar()
    cambios = 0
    while True:
        ensenar(datos)
        hay = bool(datos["palabras"])
        print("\n  ¿Qué hago?")
        print("     a. añadir una palabra")
        if hay:
            print("     c. cambiar una")
            print("     q. quitar una")
        print("     0. terminar")
        accion = preguntar("Elige", "0").lower()
        if accion in ("0", "", "salir", "terminar"):
            break
        if accion == "a":
            while True:
                datos["palabras"].append(pedir(datos, {}))
                guardar(datos)
                cambios += 1
                if preguntar("¿Añado otra? (s/N)", "n").lower() not in SI:
                    break
        elif accion == "c" and hay:
            i = elegir(datos, "¿Cuál cambio?")
            if i is not None:
                pedir(datos, datos["palabras"][i])
                guardar(datos)
                cambios += 1
        elif accion == "q" and hay:
            i = elegir(datos, "¿Cuál quito?")
            if i is not None and preguntar(f"¿Quito «{datos['palabras'][i].get('palabra')}»? (s/N)",
                                           "n").lower() in SI:
                del datos["palabras"][i]
                guardar(datos)
                cambios += 1
        else:
            print(f"\n  {accion!r} no es ninguna de las opciones.")
    if cambios:
        print(f"\n  {cambios} cambio(s) en {ARCHIVO.relative_to(RAIZ)}.")
        if preguntar("¿Paso la wiki a la web ahora, para que se vea? (S/n)", "s").lower() in SI:
            pasar_generadores(("3-generadores/generar-mundo.py",))
    return 0


if __name__ == "__main__":
    sys.exit(main())
