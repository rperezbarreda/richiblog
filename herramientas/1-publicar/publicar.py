#!/usr/bin/env python3
# =========================================
# PUBLICAR UN BORRADOR
# =========================================
# Toda entrada o relato que crea nuevo.py nace como BORRADOR:
# la página existe y la puedes ver en local, pero no sale en los
# listados, ni en el RSS, ni en el sitemap, ni en el archivo del año.
#
# POR QUÉ
# -------
# Antes, al crear una entrada, se metía en el acto en
# datos/blog/entradas-blog.json y en blog/rss.xml. Si la dejabas a medias y
# unos días después subías el sitio por cualquier otra cosa, esa
# entrada a medio escribir se publicaba sola — y en el RSS es peor,
# porque quien esté suscrito ya se la ha guardado aunque luego la
# borres.
#
# CÓMO USARLO
# -----------
# Desde la carpeta raíz del sitio:
#
#     python3 herramientas/1-publicar/publicar.py
#
# Te enseña los borradores que tengas y eliges cuál publicar. Si sabes
# cuál es, se lo puedes decir directamente:
#
#     python3 herramientas/1-publicar/publicar.py web/blog/2026/enero/lo-que-sea.html
#     python3 herramientas/1-publicar/publicar.py --todos
#
# Publicar es quitar el atributo data-borrador de la página y volver a
# pasar los generadores; esto hace las dos cosas.
#
# Y AL REVÉS
# ----------
# Para volver a esconder algo ya publicado:
#
#     python3 herramientas/1-publicar/publicar.py --despublicar web/blog/....html
#
# Ojo: si ya estaba en el RSS, quien se lo haya descargado se lo queda.
# Despublicar sirve para arreglar un despiste rápido, no para borrar
# algo del mundo.
#
# NOTA: esta carpeta "herramientas" es solo para ti — no hace falta
# subirla a Neocities.

import sys
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "0-comun"))

import argparse
import re

from comun import RAIZ, escribir_como_estaba, leer_texto, pasar_generadores
WEB = RAIZ / "web"

# La etiqueta <article> de la entrada, que es el único sitio donde
# cuenta la marca. Mirar "data-borrador" en todo el archivo no vale: la
# plantilla trae un comentario explicando qué es, y ese comentario
# contaba como marca.
ARTICULO = re.compile(r'<article class="(?:blog|relato|cuaderno)-post"[^>]*>')

# El atributo, con o sin valor, y comiéndose el espacio de delante para
# no dejar dos seguidos.
ATRIBUTO = re.compile(r'\s+data-borrador(?:="[^"]*")?')


def marca_de(texto):
    """La etiqueta <article> del archivo, o None si no la tiene."""
    return ARTICULO.search(texto)


def titulo_de(texto):
    m = re.search(
        r'<h1 class="(?:blog|relato|cuaderno)-post-title">(.*?)</h1>', texto, re.S
    )
    if not m:
        return "(sin título)"
    return " ".join(re.sub(r"<[^>]+>", "", m.group(1)).split())


def fecha_de(texto):
    m = re.search(r'<time datetime="([^"]+)"', texto)
    return m.group(1) if m else "sin fecha"


def borradores():
    """Todas las páginas de web/ que siguen marcadas como borrador."""
    encontrados = []
    for archivo in sorted(WEB.rglob("*.html")):
        if archivo.name.startswith("index_") or archivo.name == "diario.html":
            continue
        texto = archivo.read_text(encoding="utf-8")
        etiqueta = marca_de(texto)
        if etiqueta and "data-borrador" in etiqueta.group(0):
            encontrados.append((archivo, titulo_de(texto), fecha_de(texto)))
    return encontrados


def publicados():
    """Las que ya están publicadas, para poder despublicar una."""
    encontrados = []
    for archivo in sorted(WEB.rglob("*.html")):
        if archivo.name.startswith("index_") or archivo.name == "diario.html":
            continue
        texto = archivo.read_text(encoding="utf-8")
        etiqueta = marca_de(texto)
        if etiqueta and "data-borrador" not in etiqueta.group(0):
            encontrados.append((archivo, titulo_de(texto), fecha_de(texto)))
    return encontrados


# Publicar y despublicar escriben con escribir_como_estaba: la mitad de
# las páginas están guardadas con saltos de línea de Windows y, con
# write_text, quitar un atributo dejaba el archivo ENTERO marcado como
# modificado en git. Ver comun.py.

def quitar_marca(archivo):
    texto, _ = leer_texto(archivo)
    etiqueta = marca_de(texto)
    if not etiqueta or "data-borrador" not in etiqueta.group(0):
        return False
    limpia = ATRIBUTO.sub("", etiqueta.group(0), count=1)
    escribir_como_estaba(
        archivo, texto[: etiqueta.start()] + limpia + texto[etiqueta.end():]
    )
    return True


def poner_marca(archivo):
    texto, _ = leer_texto(archivo)
    etiqueta = marca_de(texto)
    if not etiqueta or "data-borrador" in etiqueta.group(0):
        return False
    marcada = etiqueta.group(0).replace('-post"', '-post" data-borrador', 1)
    escribir_como_estaba(
        archivo, texto[: etiqueta.start()] + marcada + texto[etiqueta.end():]
    )
    return True


def elegir(lista, verbo):
    print(f"\n  ¿Qué quieres {verbo}?\n")
    for i, (archivo, titulo, fecha) in enumerate(lista, 1):
        print(f"    {i}. {titulo}   ({fecha})")
        print(f"       {archivo.relative_to(RAIZ)}")
    print(f"\n    0. dejarlo estar")

    try:
        elegido = input("\n  Número: ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return []
    if elegido in ("", "0"):
        return []
    if not elegido.isdigit() or not (1 <= int(elegido) <= len(lista)):
        print("  Ese número no está en la lista.")
        return []
    return [lista[int(elegido) - 1]]


def ruta_pedida(texto):
    """Acepta la ruta tal cual la escribas: con o sin / delante, desde
    la raíz del sitio o entera."""
    candidata = Path(texto)
    if not candidata.is_absolute():
        candidata = RAIZ / texto.lstrip("/")
    if not candidata.is_file():
        print(f"  No encuentro {texto}")
        return None
    return candidata.resolve()


def main():
    parser = argparse.ArgumentParser(
        description="Publica (o despublica) una entrada o un relato."
    )
    parser.add_argument("pagina", nargs="?", help="ruta de la página, si ya la sabes")
    parser.add_argument("--todos", action="store_true", help="publica todos los borradores")
    parser.add_argument(
        "--despublicar", action="store_true", help="vuelve a marcarla como borrador"
    )
    args = parser.parse_args()

    if not WEB.is_dir():
        print("  No encuentro la carpeta web/. ¿Estás en la carpeta raíz del sitio?")
        return 1

    accion = "despublicar" if args.despublicar else "publicar"
    disponibles = publicados() if args.despublicar else borradores()

    if args.pagina:
        archivo = ruta_pedida(args.pagina)
        if not archivo:
            return 1
        elegidos = [(archivo, "", "")]
    elif args.todos and not args.despublicar:
        elegidos = disponibles
    else:
        if not disponibles:
            if args.despublicar:
                print("\n  No hay nada publicado que despublicar.\n")
            else:
                print("\n  No tienes ningún borrador: todo lo que hay está publicado.\n")
            return 0
        elegidos = elegir(disponibles, accion)

    if not elegidos:
        print("\n  No he tocado nada.\n")
        return 0

    tocados = []
    for archivo, _, _ in elegidos:
        hecho = poner_marca(archivo) if args.despublicar else quitar_marca(archivo)
        nombre = archivo.relative_to(RAIZ)
        if hecho:
            tocados.append(nombre)
            print(f"\n  {nombre}: ahora está {'sin publicar' if args.despublicar else 'PUBLICADA'}.")
        else:
            estado = "ya era un borrador" if args.despublicar else "ya estaba publicada"
            print(f"\n  {nombre}: {estado}, la dejo como está.")

    if not tocados:
        return 0

    pasar_generadores()
    print("\n  Listo. Sube el sitio a Neocities cuando quieras.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
