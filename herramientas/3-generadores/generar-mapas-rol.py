#!/usr/bin/env python3
# =========================================
# LOS MAPAS DE LAS CAMPAÑAS DE ROL
# =========================================
# El mapamundi de una campaña (el de Ragna…) es un mapa como los de la
# wiki —sitios, caminos, ríos, regiones, escala, leyenda, medir—, pero no
# es de la wiki: va con las notas de su campaña.
#
#     mapas-rol/<campaña>/<Título>.cmap          lo que se dibuja (el editor
#                                                de mapas: editor-wiki.py →
#                                                Mapas → «Un mapa nuevo» →
#                                                «Para qué es: una campaña»)
#     mapas-rol/<campaña>/imagenes/              sus imágenes, tal cual llegan
#                                                (no se suben a la web)
#
# De cada uno sale:
#
#     web/notas_rol/<campaña>/mapa_<título>.html   su página (plantilla:
#                                                  herramientas/plantillas/mapa-rol.html)
#     imagenes/notas_rol/<campaña>/mapa/           su imagen preparada para la
#                                                  web (la normal, la pequeña que
#                                                  se pide primero y la máxima
#                                                  para acercarse mucho)
#
# y en el JSON de la campaña, "mapa": la dirección de su página, que es lo
# que enciende el botón «el mapamundi →» del índice de la campaña. Si una
# campaña tiene varios, el botón lleva al primero (por el título).
#
# Lo de pintar es lo mismo que en la wiki (0-comun/mundo_mapas.py), así
# que todo lo que se puede hacer allí se puede hacer aquí; lo que no hay es
# a dónde enlazar (las páginas de la wiki), así que un sitio que diga que
# lleva a una página sale sin enlace.
#
#     python herramientas/3-generadores/generar-mapas-rol.py
#     python herramientas/3-generadores/generar-mapas-rol.py --probar   (sin escribir)

import argparse
import html
import json
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "0-comun"))
import mundo_mapas  # noqa: E402
from comun import RAIZ, leer_texto, escribir_texto, limpiar_comentarios_html, sin_tildes  # noqa: E402
from mundo_formato import Avisos  # noqa: E402

try:
    from PIL import Image
except ImportError:  # sin Pillow, las imágenes van tal cual
    Image = None

MAPAS_ROL = RAIZ / "mapas-rol"
PLANTILLA = RAIZ / "herramientas" / "plantillas" / "mapa-rol.html"
# Los mismos tamaños que los mapas de la wiki (generar-mundo.py).
ANCHO_DE_CAPA = 2560


def slug_de(datos, archivo):
    """mapa_<esto>.html: el título sin tildes ni espacios (lo mismo que
    slug_de_mapa_rol en editor-wiki.py)."""
    texto = sin_tildes(str((datos or {}).get("title") or archivo.stem)).lower()
    return re.sub(r"[^a-z0-9]+", "_", texto).strip("_") or "mapa"


def buscar(nombre, carpetas):
    nombre = str(nombre or "").replace("\\", "/").split("/")[-1].lower()
    for carpeta in carpetas:
        if carpeta.is_dir():
            for archivo in sorted(carpeta.rglob("*")):
                if archivo.is_file() and archivo.name.lower() == nombre:
                    return archivo
    return None


def preparar_capa(origen, destino_dir, probar):
    """La imagen de fondo, para la web: la normal (2560 como mucho, WebP),
    la pequeña (-peque.webp, la que se pide primero) y, si la original da
    para ello, la máxima (-max.webp, para acercarse mucho). Devuelve el
    nombre de la normal y si tiene máxima. Solo se rehace si la original es
    más nueva."""
    final = origen.stem + ".webp"
    normal = destino_dir / final
    peque = destino_dir / (origen.stem + mundo_mapas.PEQUE_DE_CAPA)
    maxima = destino_dir / (origen.stem + mundo_mapas.MAXIMA_DE_CAPA)
    if Image is None:
        if not probar:
            destino_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(origen, destino_dir / origen.name)
        return origen.name, False
    with Image.open(origen) as foto:
        lado = max(foto.size)
    con_maxima = lado > ANCHO_DE_CAPA * 1.2

    def viejo(destino):
        return not destino.is_file() or destino.stat().st_mtime < origen.stat().st_mtime

    if probar:
        return final, con_maxima
    destino_dir.mkdir(parents=True, exist_ok=True)
    for destino, tope, calidad in ((normal, ANCHO_DE_CAPA, 82), (peque, mundo_mapas.ANCHO_PEQUE_DE_CAPA, 80),
                                   (maxima if con_maxima else None, mundo_mapas.LADO_MAXIMO_DE_CAPA, 78)):
        if destino is None or not viejo(destino):
            continue
        with Image.open(origen) as foto:
            foto = foto.convert("RGBA" if "A" in foto.getbands() else "RGB")
            if max(foto.size) > tope:
                foto.thumbnail((tope, tope), Image.LANCZOS)
            foto.save(destino, "WEBP", quality=calidad, method=6)
    return final, con_maxima


def nombre_de_campana(clave):
    archivo = RAIZ / "datos" / "notas_rol" / ("campana-%s.json" % clave)
    try:
        return json.loads(archivo.read_text(encoding="utf-8")), archivo
    except (OSError, ValueError):
        return None, archivo


def un_mapa(archivo, probar):
    """Pinta un .cmap de una campaña y escribe su página. Devuelve
    (clave, título, url) o None."""
    clave = archivo.parent.name
    campana, _ = nombre_de_campana(clave)
    if campana is None:
        print("  OJO: %s es de la campaña «%s», que no existe (datos/notas_rol/campana-%s.json)."
              % (archivo.relative_to(RAIZ), clave, clave))
        return None
    avisos = Avisos()
    crudo, _ = leer_texto(archivo)
    leido = mundo_mapas.leer_cmap(crudo, avisos.di)
    if leido is None:
        print("  OJO: no entiendo %s: %s" % (archivo.relative_to(RAIZ), "; ".join(avisos.lista) or "no es un mapa"))
        return None
    suyas = MAPAS_ROL / clave / "imagenes"
    salida_img = RAIZ / "imagenes" / "notas_rol" / clave / "mapa"
    url_img = "/imagenes/notas_rol/%s/mapa/" % clave
    maximas = set()

    def de_imagen(nombre):
        origen = buscar(nombre, [suyas])
        if origen is None:
            return ""
        final, con_maxima = preparar_capa(origen, salida_img, probar)
        if con_maxima:
            maximas.add(final)
        return url_img + final

    def de_emblema(nombre):
        # Las banderas y blasones: los sube el editor a wiki/_imagenes/banderas/.
        origen = buscar(nombre, [suyas, RAIZ / "wiki" / "_imagenes" / "banderas"])
        if origen is None:
            return ""
        if not probar:
            salida_img.mkdir(parents=True, exist_ok=True)
            shutil.copy2(origen, salida_img / origen.name)
        return url_img + origen.name

    hecho = mundo_mapas.pintar(leido, lambda n: ("", False), lambda n: ("", False), de_imagen,
                               detalle=None, avisar=avisos.di, region_de={}, emblema_a=de_emblema)
    svg = hecho["svg"]

    def con_maxima(m):
        url = m.group(1)
        if url.rsplit("/", 1)[-1] in maximas:
            return m.group(0) + ' data-mapa-maxima="%s"' % html.escape(url[:-5] + mundo_mapas.MAXIMA_DE_CAPA,
                                                                       quote=True)
        return m.group(0)
    svg = re.sub(r'data-mapa-grande="([^"]+)"', con_maxima, svg)

    hay_formas = bool(hecho["dibujo"]) or any(s["tipo"] == "forma" for s in hecho["sitios"])
    hay_pines = any(s["tipo"] == "pin" for s in hecho["sitios"])
    mandos = mundo_mapas.pintar_mandos(hecho["capas"], hay_formas, hay_pines,
                                       hecho.get("niveles", False), hecho.get("hay_lineas", False),
                                       hecho.get("hay_nombres", False), hecho.get("todas_de_salida", False),
                                       hecho.get("hay_escala", False), bool(hecho.get("leyenda")),
                                       hecho.get("hay_ruta", False), hecho.get("hay_rosa", False),
                                       hecho.get("hay_zonas_regionales", False))
    titulo = leido["titulo"] or archivo.stem
    slug = slug_de({"title": leido["titulo"]}, archivo)
    url = "/web/notas_rol/%s/mapa_%s.html" % (clave, slug)
    ids = {s.get("id") or s["nombre"] for s in hecho["sitios"]}
    cuantos = len(ids)
    nombres = list(dict.fromkeys(s["nombre"] for s in hecho["sitios"]))[:8]
    resumen = ("Mapa de %s." % titulo) if not cuantos else "Mapa con %s: %s%s" % (
        "1 sitio" if cuantos == 1 else "%d sitios" % cuantos, ", ".join(nombres), "…" if cuantos > len(nombres) else "")
    nombre_campana = str(campana.get("nombre") or clave)
    molde = limpiar_comentarios_html(leer_texto(PLANTILLA)[0])[0]
    for marca, valor in (
        ("{{TITULO}}", html.escape(titulo)),
        ("{{CAMPANA}}", html.escape(nombre_campana)),
        ("{{DESCRIPCION}}", html.escape(resumen, quote=True)),
        ("{{URL}}", url),
        ("{{MANDOS}}", mandos),
        ("{{MAPA}}", svg),
        ("{{SITIOS}}", mundo_mapas.pintar_lista(hecho["sitios"])),
        ("{{LEYENDA}}", hecho.get("leyenda", "")),
        ("{{VOLVER}}", html.escape("← volver a la " + nombre_campana)),
        ("{{VOLVER_URL}}", html.escape(str(campana.get("pagina") or "/web/notas_rol/%s/index_%s.html" % (clave, clave)),
                                       quote=True)),
        ("{{CUANTOS}}", "1 sitio" if cuantos == 1 else "%d sitios" % cuantos),
    ):
        molde = molde.replace(marca, valor)
    destino = RAIZ / url.lstrip("/")
    if not probar and (not destino.is_file() or leer_texto(destino)[0] != molde):
        destino.parent.mkdir(parents=True, exist_ok=True)
        escribir_texto(destino, molde)
        print("  escrita %s" % destino.relative_to(RAIZ))
    for aviso in avisos.lista:
        print("  OJO (%s): %s" % (titulo, aviso))
    return clave, titulo, url


def main():
    parser = argparse.ArgumentParser(description="Los mapas de las campañas de rol (mapas-rol/).")
    parser.add_argument("--probar", action="store_true", help="dice lo que haría sin escribir nada")
    args = parser.parse_args()
    hechos = []
    for archivo in sorted(MAPAS_ROL.glob("*/*.cmap"), key=lambda a: (a.parent.name, a.stem.lower())) \
            if MAPAS_ROL.is_dir() else []:
        hecho = un_mapa(archivo, args.probar)
        if hecho:
            hechos.append(hecho)
    # El botón «el mapamundi →» de cada campaña: "mapa" en su JSON (el
    # primero por el título), o fuera si ya no tiene ninguno.
    por_campana = {}
    for clave, titulo, url in hechos:
        por_campana.setdefault(clave, url)
    for archivo in sorted((RAIZ / "datos" / "notas_rol").glob("campana-*.json")):
        clave = archivo.stem[len("campana-"):]
        datos, _ = nombre_de_campana(clave)
        if datos is None:
            continue
        quiere = por_campana.get(clave)
        if datos.get("mapa") == quiere or (quiere is None and "mapa" not in datos):
            continue
        if quiere:
            datos["mapa"] = quiere
        else:
            datos.pop("mapa", None)
        if not args.probar:
            escribir_texto(archivo, json.dumps(datos, ensure_ascii=False, indent=4) + "\n")
        print("  %s: el mapamundi %s" % (archivo.relative_to(RAIZ), "→ " + quiere if quiere else "quitado"))
    print("\n  %d mapa(s) de campaña." % len(hechos))
    return 0


if __name__ == "__main__":
    sys.exit(main())
