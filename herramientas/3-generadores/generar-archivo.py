#!/usr/bin/env python3
# =========================================
# ARCHIVO POR AÑOS — las páginas index_<año>.html y el menú
# =========================================
# Mira qué entradas tienes escritas y se encarga del andamiaje que hay
# alrededor:
#
#   - crea (o pone al día) web/blog/<año>/index_<año>.html, con un
#     bloque por cada mes que tenga algo publicado;
#   - añade el año al desplegable de "blog" del menú lateral
#     (fragmentos/barra-lateral.html), con el más nuevo arriba.
#
# POR QUÉ
# -------
# Al publicar la primera entrada de un año o de un mes nuevo, la
# entrada existía pero no había forma de llegar a ella: faltaba la
# página del año y su enlace en el menú, y había que acordarse de
# copiar el archivo del año anterior a mano y cambiarle el año por
# dentro en nueve sitios.
#
# CÓMO USARLO
# -----------
# Normalmente no hace falta ejecutarlo a mano: nuevo.py ya lo
# llama. Si lo quieres suelto, desde la carpeta raíz del sitio:
#
#     python herramientas/3-generadores/generar-archivo.py
#     python herramientas/3-generadores/generar-archivo.py --probar
#
# QUÉ PUEDES TOCAR Y QUÉ NO
# -------------------------
# Las páginas index_<año>.html se REESCRIBEN enteras cada vez, así que
# no las edites a mano: lo que quieras cambiar de ellas, cámbialo en
# herramientas/plantillas/archivo-anyo.html (y archivo-mes.html para el
# bloque de cada mes) y vuelve a pasar esto.
#
# Del menú solo se toca el desplegable de "blog": el resto del archivo
# se queda como esté.

import sys
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import re

from comun import (MESES, RAIZ, es_borrador, escribir_como_estaba, leer_texto,
                   limpiar_comentarios_html)
BLOG = RAIZ / "web" / "blog"
SIDEBAR = RAIZ / "fragmentos" / "barra-lateral.html"
PLANTILLA_ANYO = RAIZ / "herramientas" / "plantillas" / "archivo-anyo.html"
PLANTILLA_MES = RAIZ / "herramientas" / "plantillas" / "archivo-mes.html"

ENLACE_DIARIO = '<a href="/web/blog/diario.html">diario</a>'



# Una entrada o un relato a medio escribir llevan data-borrador en su
# <article>. Mientras lo lleven no existen para el resto del sitio: ni
# listados, ni RSS, ni sitemap, ni archivo del año. Lo quita
# herramientas/1-publicar/publicar.py.
#
# Se busca en la propia etiqueta <article> y no en todo el archivo a
# secas: la plantilla explica en un comentario qué es data-borrador, y
# buscando por el texto pelado ese comentario contaba como marca y la
# entrada no se publicaba nunca.



def meses_con_entradas():
    """{año: [nº de mes, …]} mirando qué carpetas tienen páginas dentro."""
    encontrado = {}
    if not BLOG.is_dir():
        return encontrado

    for carpeta_anyo in sorted(p for p in BLOG.iterdir() if p.is_dir()):
        if not re.fullmatch(r"\d{4}", carpeta_anyo.name):
            continue
        anyo = int(carpeta_anyo.name)
        meses = []
        for carpeta_mes in sorted(p for p in carpeta_anyo.iterdir() if p.is_dir()):
            if carpeta_mes.name not in MESES:
                print(
                    f"  OJO: {carpeta_mes.relative_to(RAIZ)} no se llama como ningún mes;"
                    " la salto."
                )
                continue
            entradas = [
                p
                for p in carpeta_mes.glob("*.html")
                if not p.name.startswith("index_") and not es_borrador(p)
            ]
            if entradas:
                meses.append(MESES.index(carpeta_mes.name) + 1)
        if meses:
            encontrado[anyo] = sorted(meses)
        else:
            print(f"  OJO: {carpeta_anyo.relative_to(RAIZ)} no tiene ninguna entrada,")
            print(f"       así que {anyo} se queda fuera del menú.")
            if (carpeta_anyo / f"index_{anyo}.html").is_file():
                print(f"       Su index_{anyo}.html sigue ahí y no lo borro por si acaso:")
                print(f"       si ya no lo quieres, borra la carpeta {carpeta_anyo.name}/ entera.")
    return encontrado


def html_del_anyo(anyo, meses):
    plantilla = PLANTILLA_ANYO.read_text(encoding="utf-8")
    bloque = PLANTILLA_MES.read_text(encoding="utf-8")
    trozos = [
        bloque.replace("{{MES}}", MESES[m - 1]).replace("{{CLAVE}}", f"{anyo}-{m:02d}")
        for m in meses
    ]
    # Una línea en blanco entre bloques y otra al final, como estaba
    # escrito a mano.
    # Sin los comentarios de la plantilla: la página del año siempre está
    # publicada (ver quitar-comentarios.py).
    return limpiar_comentarios_html(plantilla.replace("{{MESES}}", "\n".join(trozos) + "\n").replace(
        "{{ANYO}}", str(anyo)
    ))[0]


def escribir(destino, contenido, probar):
    """Respetando los saltos de línea que ya tuviera la página: la
    mitad del sitio está guardado con los de Windows y, escribiendo a
    lo bruto, git marcaba el archivo entero como cambiado aunque solo
    se hubiera añadido un mes. Ver comun.py."""
    anterior = leer_texto(destino)[0] if destino.is_file() else None
    if anterior == contenido:
        return "igual"
    if not probar:
        destino.parent.mkdir(parents=True, exist_ok=True)
        if destino.is_file():
            escribir_como_estaba(destino, contenido)
        else:
            destino.write_text(contenido, encoding="utf-8")
    return "nuevo" if anterior is None else "actualizado"


def cerrar_div(texto, desde):
    """Índice del </div> que cierra el <div> abierto en 'desde'."""
    profundidad = 0
    for m in re.finditer(r"<(/?)div\b", texto[desde:]):
        profundidad += -1 if m.group(1) else 1
        if profundidad == 0:
            return desde + m.start()
    return -1


def actualizar_menu(anyos, probar):
    """Reescribe SOLO el desplegable de 'blog' del menú lateral."""
    if not SIDEBAR.is_file():
        print(f"  No encuentro {SIDEBAR.relative_to(RAIZ)}; el menú se queda como está.")
        return "sin menu"

    texto, _ = leer_texto(SIDEBAR)
    marca = texto.find("<span>blog</span>")
    if marca == -1:
        print("  No encuentro el grupo 'blog' en el menú; lo dejo como está.")
        return "sin grupo"

    abre = texto.find('<div class="submenu">', marca)
    if abre == -1:
        print("  El grupo 'blog' del menú no tiene submenú; lo dejo como está.")
        return "sin submenu"

    cierra = cerrar_div(texto, abre)
    if cierra == -1:
        print("  No consigo leer el submenú del menú; lo dejo como está.")
        return "sin cierre"

    sangria = " " * 20
    enlaces = [ENLACE_DIARIO] + [
        f'<a href="/web/blog/{a}/index_{a}.html">{a}</a>' for a in sorted(anyos, reverse=True)
    ]
    nuevo = (
        '<div class="submenu">\n'
        + "".join(f"{sangria}{e}\n" for e in enlaces)
        + " " * 16
    )

    completo = texto[:abre] + nuevo + texto[cierra:]
    if completo == texto:
        return "igual"
    if not probar:
        escribir_como_estaba(SIDEBAR, completo)
    return "actualizado"


def generar(probar=False):
    if probar:
        print("  MODO PRUEBA: no se cambia ningún archivo.\n")

    if not PLANTILLA_ANYO.is_file() or not PLANTILLA_MES.is_file():
        print(f"  Faltan las plantillas en {PLANTILLA_ANYO.parent.relative_to(RAIZ)}.")
        return 1

    encontrado = meses_con_entradas()
    if not encontrado:
        print("  No hay ninguna entrada de blog todavía; no hay nada que hacer.")
        return 0

    for anyo in sorted(encontrado):
        meses = encontrado[anyo]
        destino = BLOG / str(anyo) / f"index_{anyo}.html"
        estado = escribir(destino, html_del_anyo(anyo, meses), probar)
        nombres = ", ".join(MESES[m - 1] for m in meses)
        etiqueta = {
            "igual": "ya estaba al día",
            "nuevo": "CREADO",
            "actualizado": "actualizado",
        }[estado]
        print(f"  {destino.relative_to(RAIZ)}  {etiqueta}")
        print(f"     {len(meses)} mes(es): {nombres}")

    estado_menu = actualizar_menu(encontrado.keys(), probar)
    if estado_menu == "igual":
        print("\n  El menú ya tenía todos los años.")
    elif estado_menu == "actualizado":
        anyos = ", ".join(str(a) for a in sorted(encontrado, reverse=True))
        print(f"\n  Menú {'actualizado' if not probar else 'se actualizaría'}: {anyos}")

    return 0


if __name__ == "__main__":
    sys.exit(generar(probar="--probar" in sys.argv))
