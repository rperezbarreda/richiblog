#!/usr/bin/env python3
# =========================================
# TRAER LA WIKI DE CRALËA A LA WEB
# =========================================
# La wiki de Cralëa vive en su propio repo (github.com/rperezbarreda/
# wiki_cralea): allí están sus fuentes (los .md y los .cmap), sus
# herramientas y lo publicado, en sitio/wiki/. Lo publicado es un sitio
# entero, con su portada, su menú, su CSS, su JS, sus letras, sus imágenes
# y sus datos, y todas sus direcciones empiezan por /wiki/. En la web va
# TAL CUAL, en wiki/ (richi.blog/wiki/): este script copia aquí sitio/wiki/
# para que las dos vayan siempre igual.
#
#     python herramientas/1-publicar/traer-wiki.py
#         se baja la última versión de GitHub (la rama main)
#
#     python herramientas/1-publicar/traer-wiki.py "C:\\ruta\\wiki_cralea"
#         la copia del repo que tengas en el ordenador (para probar algo
#         que todavía no has subido). Vale la carpeta del repo o su
#         sitio/wiki/.
#
# ES UN ESPEJO: lo que ya no esté en sitio/wiki/ se quita de wiki/. Nada
# de esa carpeta se toca a mano: se pisa la próxima vez.
#
# LO DE LA WEB NO LA TOCA: actualizar-cabeceras, el mapa del sitio, las
# comprobaciones y quitar comentarios se saltan wiki/ (APPS_APARTE, en
# comun.py). El buscador y el sitemap sí cogen sus páginas.

import io
import sys
import urllib.request
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DESTINO = RAIZ / "wiki"
ZIP_GITHUB = "https://github.com/rperezbarreda/wiki_cralea/archive/refs/heads/main.zip"
DENTRO = "sitio/wiki/"
# Lo que Neocities (cuenta gratis) no deja subir, por si algún día aparece.
NO_SE_SUBE = {".md", ".py", ".txt", ".cmap", ".zip"}
BASURA = {"Thumbs.db", "desktop.ini", ".DS_Store"}


def lo_publicado(archivos):
    """{ruta dentro de sitio/wiki/: bytes} de {ruta en el repo: bytes}."""
    salida = {}
    for ruta, contenido in archivos.items():
        if not ruta.startswith(DENTRO):
            continue
        dentro = ruta[len(DENTRO):]
        nombre = dentro.rsplit("/", 1)[-1]
        if not dentro or nombre in BASURA or nombre.startswith(".") or Path(nombre).suffix.lower() in NO_SE_SUBE:
            continue
        salida[dentro] = contenido
    return salida


def de_github():
    """{ruta en el repo: bytes} de la rama main, sin la carpeta de arriba del zip."""
    print("  Bajando la última versión de GitHub…")
    with urllib.request.urlopen(ZIP_GITHUB, timeout=120) as r:
        datos = r.read()
    archivos = {}
    with zipfile.ZipFile(io.BytesIO(datos)) as z:
        for nombre in z.namelist():
            if nombre.endswith("/"):
                continue
            ruta = nombre.split("/", 1)[1] if "/" in nombre else nombre
            if ruta.startswith(DENTRO):
                archivos[ruta] = z.read(nombre)
    return archivos


def de_carpeta(origen):
    """{ruta en el repo: bytes} de una copia local (el repo o su sitio/wiki/)."""
    if (origen / "sitio" / "wiki" / "index.html").is_file():
        base = origen / "sitio" / "wiki"
    elif (origen / "index.html").is_file() and origen.name == "wiki":
        base = origen
    else:
        return None
    archivos = {}
    for p in base.rglob("*"):
        if p.is_file() and ".git" not in p.relative_to(base).parts:
            archivos[DENTRO + p.relative_to(base).as_posix()] = p.read_bytes()
    return archivos


def main():
    if len(sys.argv) > 1:
        origen = Path(sys.argv[1]).expanduser()
        archivos = de_carpeta(origen)
        if archivos is None:
            print(f"  En {origen} no está la wiki (ni sitio/wiki/index.html ni index.html).")
            return 1
    else:
        try:
            archivos = de_github()
        except OSError as error:
            print(f"  No he podido bajarla de GitHub: {error}")
            print("  Prueba con la ruta de tu copia del repo (mira arriba del todo de este archivo).")
            return 1

    nuevos = lo_publicado(archivos)
    if "index.html" not in nuevos:
        print("  Esto no parece la wiki: falta sitio/wiki/index.html. No toco nada.")
        return 1
    # Por si acaso: wiki/ es SOLO el espejo. Si quedasen fuentes (los .md
    # de antes de que la wiki se fuera a su repo), no se pisan.
    if DESTINO.is_dir() and any(DESTINO.rglob("*.md")):
        print("  OJO: en wiki/ hay archivos .md: parecen las fuentes de antes, no la wiki publicada. No toco nada.")
        return 1

    escritos, iguales = 0, 0
    for ruta, contenido in sorted(nuevos.items()):
        destino = DESTINO / ruta
        if destino.is_file() and destino.read_bytes() == contenido:
            iguales += 1
            continue
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(contenido)
        escritos += 1

    quitados = []
    if DESTINO.is_dir():
        for p in sorted(DESTINO.rglob("*"), key=lambda x: -len(x.parts)):
            rel = p.relative_to(DESTINO).as_posix()
            if p.is_file() and rel not in nuevos:
                p.unlink()
                quitados.append(rel)
            elif p.is_dir() and not any(p.iterdir()):
                p.rmdir()

    print(f"\n  wiki/: {escritos} archivo(s) nuevos o cambiados, {iguales} igual(es), {len(quitados)} quitado(s).")
    for q in quitados[:20]:
        print("     fuera: " + q)
    if len(quitados) > 20:
        print(f"     … y {len(quitados) - 20} más.")
    print("\n  Listo. Pásale el buscador y el sitemap (o «Pasar a la web» en el editor) y pruébala en el"
          " servidor local: http://localhost:8000/wiki/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
