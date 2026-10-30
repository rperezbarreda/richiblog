#!/usr/bin/env python3
# =========================================
# LA PANTALLA DE MÁSTER COMO APP APARTE (para itch.io o para usarla sin
# internet, en el ordenador o en una tablet)
# =========================================
# Saca de la web la pantalla de máster (web/pantalla_master/) y la deja
# en una carpeta que funciona sola, sin servidor: se abre con doble clic
# en index.html, o se sube a itch.io como juego HTML («This file will be
# played in the browser») con el .zip que escribe al lado.
#
# NO ES OTRO CÓDIGO: es el mismo de la web, copiado. Lo que se arregla o
# se añade en scripts/paginas/pantalla-master.js, personajes.js y sus CSS
# llega a la app al volver a pasar esto. Así que:
#   1. haz los cambios en la web, como siempre (y su actualizar-cabeceras);
#   2. python herramientas/3-generadores/generar-app-master.py ../pantalla-de-master
#      (la carpeta del repositorio de la app; por defecto, esa);
#   3. en esa carpeta, commit y push; el .zip para itch.io queda al lado
#      (pantalla-de-master.zip).
#
# QUÉ CAMBIA RESPECTO A LA PÁGINA DE LA WEB
# -----------------------------------------
#   - Sin la barra lateral, el buscador ni el gatito: solo el botón «Aa»
#     de accesibilidad (tamaño del texto, letra, temas…) y el lienzo.
#   - Sin la Content-Security-Policy ni las etiquetas para buscadores y
#     redes sociales.
#   - Las direcciones, relativas (con doble clic la página va por
#     file://, donde «/estilos/…» sería la raíz del disco).
#   - LOS DATOS VAN DENTRO (scripts/datos.js): el bestiario, los
#     conjuros, la tienda, las reglas y los fragmentos HTML que se piden
#     con fetch(). Por file:// el navegador no deja pedir archivos, así
#     que datos.js envuelve fetch() y contesta él a esas direcciones.
#   - Se marca <html class="es-app"> (estilos/app.css quita el hueco de
#     la barra lateral).
# Lo que se guarda (los tableros, la iniciativa…) va en el navegador,
# como en la web: con «⬇ exportar» de «＋ añadir» se saca a un archivo.
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DESTINO = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else (RAIZ.parent / "pantalla-de-master")
PAGINA = RAIZ / "web/pantalla_master/pantalla_master.html"
NOMBRE = "Pantalla de máster"
DESCRIPCION = ("Una pantalla de máster para D&D 5e (reglas de 2024): un tablero de ventanas que se mueven, con "
               "iniciativa, bestiario, conjuros, tienda, party, dados y notas.")

# Lo que se mete en datos.js: la dirección con la que lo pide el código
# y el archivo.
DATOS = ["/datos/personajes/compendio/bestiario.json", "/datos/personajes/compendio/conjuros-srd.json",
         "/datos/personajes/compendio/tienda.json", "/datos/personajes/reglas-dnd.json"]
FRAGMENTOS = ["/fragmentos/ajustes.html", "/fragmentos/texto-a-voz.html", "/fragmentos/frases.html"]
# Lo que se copia tal cual (las letras y los fondos que piden los CSS).
COPIAR = ["imagenes/favicon.ico", "imagenes/dark_bg.webp", "imagenes/white_bg.webp"]


def leer(ruta):
    return (RAIZ / ruta.lstrip("/")).read_text(encoding="utf-8")


def quitar(html, patron):
    nuevo, n = re.subn(patron, "", html, flags=re.S)
    if not n:
        print("  ¡ojo! no he encontrado:", patron[:60])
    return nuevo


def main():
    html = PAGINA.read_text(encoding="utf-8")
    if DESTINO == RAIZ or RAIZ in DESTINO.parents:
        sys.exit("El destino tiene que estar fuera del repositorio del blog.")
    DESTINO.mkdir(parents=True, exist_ok=True)
    for sub in ("estilos", "scripts", "tipografias", "imagenes"):
        if (DESTINO / sub).exists():
            shutil.rmtree(DESTINO / sub)
        (DESTINO / sub).mkdir()

    # ---- el <head>: fuera la CSP, lo de los buscadores y las redes ----
    html = quitar(html, r'\s*<meta http-equiv="Content-Security-Policy"[^>]*>')
    for patron in (r'\s*<link rel="canonical"[^>]*>', r'\s*<meta property="og:[^>]*>', r'\s*<meta name="twitter:[^>]*>',
                   r'\s*<link rel="alternate"[^>]*>', r'\s*<link rel="preload"[^>]*>'):
        html = re.sub(patron, "", html)
    html = re.sub(r"<title>.*?</title>", "<title>" + NOMBRE + "</title>", html)
    html = re.sub(r'<meta name="description" content="[^"]*">',
                  '<meta name="description" content="' + DESCRIPCION + '">', html)
    html = html.replace('<html lang="es">', '<html lang="es" class="es-app">', 1)
    html = html.replace('href="/imagenes/favicon.ico"', 'href="imagenes/favicon.ico"')

    # ---- los CSS y los JS: copiados, con direcciones relativas ----
    estilos = re.findall(r'<link rel="stylesheet" href="([^"?]+)(?:\?v=[^"]*)?">', html)
    for ruta in estilos:
        nombre = Path(ruta).name
        css = leer(ruta)
        css = re.sub(r'url\("?/(tipografias|imagenes)/([^")]+)"?\)', r'url("../\1/\2")', css)
        (DESTINO / "estilos" / nombre).write_text(css, encoding="utf-8")
        for letra in re.findall(r'url\("\.\./tipografias/([^"]+)"\)', css):
            shutil.copy(RAIZ / "tipografias" / letra, DESTINO / "tipografias" / letra)
        html = re.sub(r'href="' + re.escape(ruta) + r'(\?v=[^"]*)?"', 'href="estilos/' + nombre + '"', html)
    html = html.replace("<!-- ==== fin del CSS ==== -->",
                        '<link rel="stylesheet" href="estilos/app.css">\n    <!-- ==== fin del CSS ==== -->')
    scripts = re.findall(r'<script (?:defer )?src="([^"?]+)(?:\?v=[^"]*)?"></script>', html)
    for ruta in scripts:
        nombre = Path(ruta).name
        (DESTINO / "scripts" / nombre).write_text(leer(ruta), encoding="utf-8")
        html = re.sub(r'src="' + re.escape(ruta) + r'(\?v=[^"]*)?"', 'src="scripts/' + nombre + '"', html)
    # datos.js, antes que todos (envuelve fetch()).
    html = html.replace('<script src="scripts/cargador-scripts.js">',
                        '<script src="scripts/datos.js"></script>\n    <script src="scripts/cargador-scripts.js">', 1)
    for ruta in COPIAR:
        shutil.copy(RAIZ / ruta, DESTINO / ruta)

    # ---- el <body>: sin la barra lateral ni el buscador ----
    html = quitar(html, r'<header class="mobile-topbar">.*?</header>\s*')
    html = quitar(html, r'<div id="sidebar-backdrop"[^>]*></div>\s*')
    html = quitar(html, r'<aside class="sidebar" id="sidebar">.*?</aside>\s*')
    html = quitar(html, r'<dialog class="buscar-modal".*?</dialog>\s*')

    # ---- datos.js ----
    datos = {ruta: json.loads(leer(ruta)) for ruta in DATOS}
    datos.update({ruta: leer(ruta) for ruta in FRAGMENTOS})
    js = ("// Los datos de la pantalla de máster, dentro (los escribe\n"
          "// herramientas/3-generadores/generar-app-master.py del blog: no se edita).\n"
          "// fetch() de esas direcciones lo contesta esto, sin red.\n"
          "(function () {\n"
          "    var datos = " + json.dumps(datos, ensure_ascii=False, separators=(",", ":")) + ";\n"
          "    var deVerdad = window.fetch ? window.fetch.bind(window) : null;\n"
          "    window.fetch = function (que, opciones) {\n"
          "        var ruta = String((que && que.url) || que).replace(/^[a-z]+:\\/\\/[^\\/]*/i, \"\").split(\"?\")[0];\n"
          "        for (var clave in datos) {\n"
          "            if (ruta === clave || ruta.slice(-clave.length) === clave) {\n"
          "                var dato = datos[clave];\n"
          "                var esTexto = typeof dato === \"string\";\n"
          "                return Promise.resolve(new Response(esTexto ? dato : JSON.stringify(dato), { status: 200,\n"
          "                    headers: { \"Content-Type\": esTexto ? \"text/html; charset=utf-8\" : \"application/json\" } }));\n"
          "            }\n"
          "        }\n"
          "        return deVerdad ? deVerdad(que, opciones) : Promise.reject(new Error(\"sin red\"));\n"
          "    };\n"
          "})();\n")
    (DESTINO / "scripts" / "datos.js").write_text(js, encoding="utf-8")

    # ---- app.css: lo poco que cambia ----
    (DESTINO / "estilos" / "app.css").write_text(APP_CSS, encoding="utf-8")
    (DESTINO / "index.html").write_text(html, encoding="utf-8")

    # ---- el .zip para itch.io (index.html en la raíz del zip) ----
    zipa = DESTINO.parent / (DESTINO.name + ".zip")
    with zipfile.ZipFile(zipa, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(DESTINO.rglob("*")):
            rel = f.relative_to(DESTINO)
            if f.is_file() and not rel.parts[0].startswith(".") and rel.name not in ("README.md", "LICENCIA.md"):
                z.write(f, rel.as_posix())
    peso = sum(f.stat().st_size for f in DESTINO.rglob("*") if f.is_file() and ".git" not in f.parts)
    print("  App en", DESTINO, "(%d KB)" % (peso // 1024))
    print("  Para itch.io:", zipa, "(%d KB)" % (zipa.stat().st_size // 1024))


APP_CSS = """/* LA APP (la escribe herramientas/3-generadores/generar-app-master.py del
   blog: no se edita). Sin la barra lateral de la web: el lienzo, a todo lo
   ancho, y a la derecha el hueco del botón «Aa» de accesibilidad. */
html.es-app body {
    display: block;
}

html.es-app #sidebar-container {
    display: contents;
}

html.es-app main {
    width: auto;
    margin: 20px 92px 24px 20px;
}

@media (max-width: 860px) {
    html.es-app main {
        margin: 68px 12px 16px;
    }
}
"""

if __name__ == "__main__":
    main()
