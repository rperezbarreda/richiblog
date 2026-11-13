#!/usr/bin/env python3
# =========================================
# TRAER LA PANTALLA DE MÁSTER A LA WEB
# =========================================
# La pantalla de máster es una app aparte (su repo:
# github.com/rperezbarreda/pantalla_master). En la web va TAL CUAL, en
# pantalla-master/ (richi.blog/pantalla-master/): la misma app que se
# descarga, sin el menú ni nada del blog. Este script copia aquí sus
# archivos para que las dos vayan siempre igual.
#
#     python herramientas/1-publicar/traer-pantalla-master.py
#         se baja la última versión de GitHub (la rama main)
#
#     python herramientas/1-publicar/traer-pantalla-master.py "C:\\ruta\\pantalla_master"
#         la copia de la app que tengas en el ordenador (para probar algo
#         que todavía no has subido)
#
# ES UN ESPEJO: lo que ya no esté en la app se quita de pantalla-master/.
# Nada de esa carpeta se toca a mano: se pisa la próxima vez.
#
# QUÉ SE TRAE: las páginas (index, jugadores, reproductor), el
# manifest, el service worker (sw.js: la app se instala y va sin
# conexión también desde la web) y las carpetas estilos, scripts, datos, idiomas,
# tipografias, imagenes y sonidos. La licencia, como LICENSE.txt
# (Neocities no deja subir archivos sin extensión). Lo demás (el
# lanzador, los ejecutables, las herramientas) no hace falta en la web.
#
# OJO CON LOS SONIDOS: los .ogg no se pueden subir con la cuenta gratis
# de Neocities. Si la app lleva alguno, se avisa: el service worker los
# tiene en su lista y, si faltan, no se instala para ir sin conexión.
#
# LO DE LA WEB NO LA TOCA: actualizar-cabeceras, el buscador, el mapa del
# sitio y las comprobaciones se saltan pantalla-master/ (APPS_APARTE, en
# comun.py). Solo el sitemap enseña su página de entrada.

import io
import shutil
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "0-comun"))
from comun import RAIZ  # noqa: E402

DESTINO = RAIZ / "pantalla-master"
ZIP_GITHUB = "https://codeload.github.com/rperezbarreda/pantalla_master/zip/refs/heads/main"

SUELTOS = ["index.html", "jugadores.html", "reproductor.html", "manifest.webmanifest", "sw.js"]
CARPETAS = ["estilos", "scripts", "datos", "idiomas", "tipografias", "imagenes", "sonidos"]
# La documentación de la app no hace falta en la web.
NO = {".md", ".py", ".txt"}
SOLO_DE_PAGO = {".ogg", ".mp3", ".wav", ".m4a", ".flac"}


def de_github():
    """{ruta: bytes} de la rama main, sin la carpeta de arriba del zip."""
    print("  Bajando la última versión de GitHub…")
    with urllib.request.urlopen(ZIP_GITHUB, timeout=60) as r:
        datos = r.read()
    archivos = {}
    with zipfile.ZipFile(io.BytesIO(datos)) as z:
        for nombre in z.namelist():
            if nombre.endswith("/"):
                continue
            ruta = nombre.split("/", 1)[1] if "/" in nombre else nombre
            archivos[ruta] = z.read(nombre)
    return archivos


def de_carpeta(origen):
    archivos = {}
    for p in origen.rglob("*"):
        if p.is_file() and ".git" not in p.relative_to(origen).parts:
            archivos[p.relative_to(origen).as_posix()] = p.read_bytes()
    return archivos


def lo_de_la_web(archivos):
    """Solo lo que hace falta en la web, con su ruta dentro de pantalla-master/."""
    salida = {}
    for ruta, contenido in archivos.items():
        arriba = ruta.split("/", 1)[0]
        if ruta in SUELTOS or (arriba in CARPETAS and "/" in ruta and Path(ruta).suffix.lower() not in NO):
            salida[ruta] = contenido
    if "LICENSE" in archivos:
        salida["LICENSE.txt"] = archivos["LICENSE"]
    return salida


def main():
    if len(sys.argv) > 1:
        origen = Path(sys.argv[1]).expanduser()
        if not (origen / "index.html").is_file() or not (origen / "sw.js").is_file():
            print(f"  En {origen} no está la app (falta index.html o sw.js).")
            return 1
        archivos = de_carpeta(origen)
    else:
        try:
            archivos = de_github()
        except OSError as error:
            print(f"  No he podido bajarla de GitHub: {error}")
            print("  Prueba con la ruta de tu copia de la app (mira arriba del todo de este archivo).")
            return 1

    nuevos = lo_de_la_web(archivos)
    falta = [s for s in SUELTOS if s not in nuevos]
    if falta:
        print("  Esto no parece la pantalla de máster: falta " + ", ".join(falta) + ". No toco nada.")
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

    print(f"\n  pantalla-master/: {escritos} archivo(s) nuevos o cambiados, {iguales} igual(es), "
          f"{len(quitados)} quitado(s).")
    for q in quitados:
        print("     fuera: " + q)
    de_pago = [r for r in nuevos if Path(r).suffix.lower() in SOLO_DE_PAGO]
    if de_pago:
        print(f"\n  OJO: {len(de_pago)} sonido(s) que la cuenta gratis de Neocities no deja subir "
              f"(p. ej. {de_pago[0]}). Sin ellos, la app de la web no se instala para ir sin conexión.")
    # Todo lo que el service worker quiere guardar tiene que estar: si falta
    # uno (una carpeta nueva de la app que no está en CARPETAS), no se
    # instala y la web no va sin conexión.
    lista = re.findall(r'^\s*"([^"]+)",?\s*$', nuevos.get("sw.js", b"").decode("utf-8", "replace"), re.M)
    sin = [r for r in lista if r not in ("./",) and r not in nuevos]
    if sin:
        print(f"\n  OJO: el service worker pide {len(sin)} archivo(s) que no se han traído (p. ej. {sin[0]}):"
              " añade su carpeta a CARPETAS, arriba de este archivo. Sin ellos no se instala.")
    print("\n  Listo. Pruébala en el servidor local: http://localhost:8000/pantalla-master/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
