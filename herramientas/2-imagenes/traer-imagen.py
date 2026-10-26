#!/usr/bin/env python3
# =========================================
# TRAER UNA IMAGEN DE FUERA AL SITIO
# =========================================
# Le pasas la ruta de una imagen que tengas por ahí —descargas, escritorio,
# un pendrive— y la deja DENTRO del sitio: en su carpeta, con su nombre,
# en WebP y al tamaño que haga falta. Al terminar te escribe la ruta tal y
# como va en el JSON, lista para copiar.
#
# CÓMO USARLO
# -----------
# Lo más cómodo es sin nada y que vaya preguntando:
#
#     python herramientas/2-imagenes/traer-imagen.py
#
# Y te pide la ruta. Pégala tal cual sale del explorador de Windows, con
# comillas o sin ellas:
#
#     e:\rpere\Descargas\ejemplo.jpg
#     "C:\Users\richi\Pictures\sigil.png"
#     ~/Descargas/mapa.png
#
# Con todo escrito de una vez, para no contestar nada:
#
#     python herramientas/2-imagenes/traer-imagen.py \
#            --de "e:\rpere\Descargas\sigil.jpg" --para npc-token \
#            --nombre Sigil --campana ragna
#
# Y para ver qué haría sin tocar nada:
#
#     python herramientas/2-imagenes/traer-imagen.py --de ... --probar
#
# QUÉ HACE CON LA IMAGEN
# ----------------------
# La pasa a WebP, la deja al tamaño que pide el sitio donde va (un token no
# necesita 4000 píxeles), recorta a cuadrado lo que tiene que ser cuadrado
# —tirando hacia arriba, que si no los retratos se quedan sin cabeza—, le
# quita los metadatos (el GPS de las fotos de móvil, entre otros) y la gira
# si venía tumbada. El original NO se toca ni se borra.
#
# SI YA HAY UNA IMAGEN CON ESE NOMBRE no se machaca: se guarda con un -2
# detrás y se te dice. Lo que había puede estar enlazado desde una página.
#
# AL TERMINAR, si has traído algo que va en una ficha, acuérdate de pegar
# la ruta en su JSON. La herramienta de añadir NPC
# (herramientas/1-publicar/nuevo-personaje.py) ya hace las dos cosas de
# una vez: le pegas la ruta de fuera y la trae y la apunta.

import argparse
import sys
from pathlib import Path

# comun.py e imagenes.py viven un piso más arriba, en herramientas/, y
# Python solo busca los imports en la carpeta del propio archivo.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import datetime as dt

from comun import RAIZ, campanas_que_hay, elegir, elegir_campana, nombre_archivo, preguntar
from imagenes import SITIOS, limpiar_ruta, nombre_para, resolver, traer


def pedir_origen(dado):
    """La ruta de la imagen. Si viene por --de y no está, se dice y se
    para: quien escribe la orden entera no está delante esperando a que
    le pregunten otra vez. Si se pregunta, se insiste, porque equivocarse
    al pegar una ruta larga es lo normal."""
    dado = (dado or "").strip()
    if dado:
        if resolver(dado):
            return dado
        print(f"  No encuentro {limpiar_ruta(dado)!r}.")
        print("  Mira que la ruta sea de ESTE ordenador y que el archivo siga ahí.")
        return None

    while True:
        crudo = preguntar("Ruta de la imagen (Enter para dejarlo)")
        if not crudo:
            return None
        if resolver(crudo):
            return crudo
        print(f"     No encuentro {limpiar_ruta(crudo)!r}.")
        print("     Pégala tal cual sale del explorador; las comillas dan igual.")


def pedir_sitio(dado):
    if dado:
        if dado in SITIOS:
            return dado
        print(f"  No sé qué es {dado!r}. Los sitios que hay: {', '.join(SITIOS)}.")
        return None
    claves = list(SITIOS)
    textos = [f"{SITIOS[c]['que']}  [{c}]" for c in claves]
    elegido = elegir("¿Dónde va?", textos, permitir_nueva=False)
    return claves[textos.index(elegido)]


def rellenar_carpeta(plantilla, args):
    """La carpeta de destino puede llevar {campana}, {anyo} o {santuario}.
    Lo que haga falta se pregunta; lo que no, ni se menciona."""
    carpeta = plantilla

    if "{campana}" in carpeta:
        clave = (args.campana or "").strip()
        if not clave:
            archivo, datos = elegir_campana(None, "¿De qué campaña es?")
            if not archivo:
                return None
            clave = (datos.get("clave") or archivo.stem.replace("campana-", "")).strip()
        elif not any((d.get("clave") or "") == clave for _, d in campanas_que_hay()):
            print(f"  OJO: no tengo ninguna campaña que se llame {clave!r}.")
        carpeta = carpeta.replace("{campana}", clave)

    if "{anyo}" in carpeta:
        anyo = (args.anyo or "").strip() or preguntar(
            "¿De qué año?", str(dt.date.today().year))
        carpeta = carpeta.replace("{anyo}", anyo)

    if "{santuario}" in carpeta:
        cuales = sorted(p.name for p in (RAIZ / "imagenes" / "santuarios").iterdir()
                        if p.is_dir()) if (RAIZ / "imagenes" / "santuarios").is_dir() else []
        cual = (args.santuario or "").strip()
        if not cual:
            cual = elegir("¿De qué santuario?", cuales) if cuales \
                else preguntar("¿De qué santuario? (carpeta)")
        carpeta = carpeta.replace("{santuario}", cual)

    if "{personaje}" in carpeta:
        # Uno de mis personajes: su clave (la de su carpeta y su página).
        cual = nombre_archivo((args.personaje or "").strip(), "")
        while not cual:
            cual = nombre_archivo(preguntar("¿De qué personaje? (su clave: yorel, diana…)"), "")
        carpeta = carpeta.replace("{personaje}", cual)

    return carpeta


def main():
    args = pedir_argumentos()

    origen = pedir_origen(args.de)
    if not origen:
        print("  Nada que traer.")
        return

    clave = pedir_sitio(args.para)
    if not clave:
        return
    sitio = SITIOS[clave]

    carpeta = rellenar_carpeta(sitio["carpeta"], args)
    if carpeta is None:
        return
    if clave == "otra":
        carpeta = (args.carpeta or "").strip() or preguntar(
            "¿En qué carpeta del sitio?", "imagenes")
        carpeta = carpeta.strip("/").replace("\\", "/")

    # El nombre: el de quien o de lo que sea, no el del archivo original,
    # que casi siempre es "descarga (3).png".
    como = (args.nombre or "").strip() or preguntar(
        "¿Cómo se llama? (para el nombre del archivo)",
        Path(limpiar_ruta(origen)).stem)
    nombre = nombre_para(como, sitio["sufijo"])

    ruta, aviso = traer(origen, carpeta, nombre,
                        lado=sitio["lado"], cuadrada=sitio["cuadrada"],
                        probar=args.probar)
    if not ruta:
        print(f"  No se ha podido: {aviso}")
        return

    print()
    print(f"  {ruta}")
    if aviso:
        print(f"     ({aviso})")
    if not args.probar and Path(ruta).name != nombre:
        print(f"     Ya había un {nombre}, así que este se llama distinto.")
    print()
    print("  Esa es la ruta que va en el JSON. Y si has traído varias,")
    print("  pasa el buscador cuando termines de apuntarlas:")
    print("      python herramientas/3-generadores/generar-buscador.py")


def pedir_argumentos():
    parser = argparse.ArgumentParser(
        description="Trae una imagen de fuera al sitio, convertida y al tamaño que toca.")
    parser.add_argument("--de", help="ruta de la imagen en tu ordenador")
    parser.add_argument("--para", help="dónde va: " + ", ".join(SITIOS))
    parser.add_argument("--nombre", help="cómo se llama (para el nombre del archivo)")
    parser.add_argument("--campana", help="clave de la campaña, si va en una")
    parser.add_argument("--anyo", help="año, si va en el blog")
    parser.add_argument("--santuario", help="carpeta del santuario, si va en uno")
    parser.add_argument("--personaje", help="clave de uno de mis personajes, si es suya")
    parser.add_argument("--carpeta", help="carpeta del sitio, con --para otra")
    parser.add_argument("--probar", action="store_true",
                        help="dice qué haría y no toca nada")
    return parser.parse_args()


if __name__ == "__main__":
    main()
