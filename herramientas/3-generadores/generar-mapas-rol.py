#!/usr/bin/env python3
# =========================================
# LOS MAPAS DE LAS CAMPAÑAS DE ROL
# =========================================
# El mapamundi de una campaña (el de Ragna…) y los de sus zonas: sitios,
# caminos, ríos, regiones, escala, leyenda, medir… Van con las notas de
# su campaña.
#
#     mapas-rol/<campaña>/<Título>.cmap          lo que se dibuja (el editor
#                                                de mapas: editor-wiki.py →
#                                                Campañas → Los mapas →
#                                                «Un mapa nuevo»)
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
# que enciende el botón «el mapamundi →» del índice de la campaña.
#
# LOS MAPAS DE ZONA (los pueblos de una comarca…). Una campaña puede tener
# varios mapas: uno es EL MAPAMUNDI (el que lleve «mapamundi» en el título;
# si ninguno, el que no lo enlaza ningún otro; si no, el primero por el
# título) y los demás son zonas. No se juntan: son mapas aparte, enlazados.
#   - En el mapamundi, un sitio o una región lleva a una zona si en el
#     editor tiene «Lleva al mapa» (targetMap) con su título, o, sin eso, si
#     se llama igual que ella.
#   - La página de una zona vuelve al mapamundi («← volver al mapamundi»).
#   - En el JSON, "zonas": [{titulo, url}], que salen en «extra» debajo del
#     mapamundi.
#
# LAS IMÁGENES AL PULSAR: un sitio que se llama como una imagen de la
# campaña (Sirevia y «Mapa de Sirevia», en «✨ extra»: se quita el «Mapa
# de» y las tildes) la enseña en grande al pulsarlo, en el mapa y en la
# lista de debajo.
#
# LAS RUTAS DE CADA SESIÓN. Una raya «Ruta de viaje» puede decir de qué
# sesión es (en el editor, «De la sesión»; en el .cmap, "session": 3). En
# la página del mapa se ven todas o solo la de una (en «capas», «rutas de
# las sesiones»), y si no tiene nombre se llama «sesión 3 · <su título>».
# En el JSON, cada sesión con ruta lleva "ruta": el mapa con ?sesion=3,
# que es el enlace «la ruta en el mapa» de sus notas y de su resumen.
#
# Lo de pintar está en 0-comun/mundo_mapas.py (es de cuando la wiki de
# Cralëa vivía aquí y sus mapas se pintaban igual). Lo que no hay es a
# dónde enlazar páginas («targetPage»), así que un sitio que diga que
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
# El ancho de la imagen de cada capa en la web (más grande, sale con
# su versión «máxima» aparte: ver preparar_capa).
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


def leer_uno(archivo):
    """Lee un .cmap de una campaña: {archivo, clave, campana, leido,
    avisos, titulo, url} o None."""
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
    slug = slug_de({"title": leido["titulo"]}, archivo)
    return {"archivo": archivo, "clave": clave, "campana": campana, "leido": leido, "avisos": avisos,
            "titulo": leido["titulo"] or archivo.stem, "url": "/web/notas_rol/%s/mapa_%s.html" % (clave, slug)}


# Lo que puede llevar a otro sitio en un mapa (los textos sueltos no).
COSAS_QUE_LLEVAN = ("pines", "formas", "lineas", "emblemas")


def _clave_de(nombre):
    return sin_tildes(str(nombre or "")).strip().lower()


def enlazar_zonas(mapas):
    """Los mapas de UNA campaña: cuál es el mapamundi y a dónde lleva cada
    cosa. Pone "mapa" (el título del otro mapa) en lo que lleva a otro: lo
    que ya lo tenía (targetMap) y lo que se llama igual que uno, o que dice
    llevar a una «página» que es en realidad un mapa suyo. Devuelve el
    mapamundi."""
    por_titulo = {}
    for m in mapas:
        por_titulo.setdefault(_clave_de(m["titulo"]), m)
        por_titulo.setdefault(_clave_de(m["archivo"].stem), m)
    enlazados = set()
    for m in mapas:
        for lista in COSAS_QUE_LLEVAN:
            for cosa in m["leido"].get(lista) or []:
                if not isinstance(cosa, dict):
                    continue
                if not cosa.get("mapa"):
                    for posible in (cosa.get("pagina"), cosa.get("etiqueta")):
                        otro = por_titulo.get(_clave_de(posible)) if posible else None
                        if otro is not None and otro is not m:
                            cosa["mapa"] = otro["titulo"]
                            if posible == cosa.get("pagina"):
                                cosa["pagina"] = ""
                            break
                otro = por_titulo.get(_clave_de(cosa.get("mapa"))) if cosa.get("mapa") else None
                if otro is not None and otro is not m:
                    enlazados.add(id(otro))
    con_nombre = [m for m in mapas if "mapamundi" in _clave_de(m["titulo"])]
    sueltos = [m for m in mapas if id(m) not in enlazados]
    mundo = (con_nombre or sueltos or mapas)[0]

    def mapa_a(nombre):
        otro = por_titulo.get(_clave_de(nombre))
        return (otro["url"], True) if otro is not None else ("", False)
    for m in mapas:
        m["mapa_a"] = mapa_a
        m["mundo"] = mundo
    return mundo


def corto_de_sesion(sesion):
    """El título de una sesión sin el «Sesión 3 ·» de delante."""
    return re.sub(r"^\s*sesi[oó]n\s*\d+\s*(?:[·.:\-–—]\s*)?", "", str(sesion.get("titulo") or ""),
                  flags=re.I).strip()


def poner_sesiones(m):
    """Las rutas de viaje con sesión: les pone nombre si no lo tienen y
    devuelve [(número, texto)] de las sesiones que hay en este mapa."""
    sesiones = {}
    for s in m["campana"].get("sesiones") or []:
        try:
            sesiones[int(s.get("numero"))] = s
        except (TypeError, ValueError, AttributeError):
            continue
    hay = {}
    for linea in m["leido"].get("lineas") or []:
        numero = linea.get("sesion") or 0
        if not numero:
            continue
        corto = corto_de_sesion(sesiones.get(numero) or {})
        texto = "sesión %d" % numero + (" · " + corto if corto else "")
        if numero not in sesiones:
            m["avisos"].di("la ruta «%s» es de la sesión %d, que no está en la campaña"
                           % (linea.get("etiqueta") or "sin nombre", numero))
        if not linea.get("etiqueta"):
            linea["etiqueta"] = texto[0].upper() + texto[1:]
        hay[numero] = texto
    return sorted(hay.items())


def poner_imagenes_al_pulsar(m):
    """Un sitio que se llama como una imagen de la campaña («Sirevia» y
    «Mapa de Sirevia», en «✨ extra»), al pulsarlo enseña esa imagen. Va en
    "ver" de cada pin: {url, titulo} (lo pinta mundo_mapas.py)."""
    def llano(texto):
        texto = _clave_de(texto)
        return re.sub(r"^(mapa|plano)\s+(de\s+la|de\s+los|de\s+las|del|de)\s+", "", texto).strip()
    imagenes = {}
    for im in m["campana"].get("imagenes") or []:
        if isinstance(im, dict) and im.get("imagen") and im.get("titulo"):
            imagenes.setdefault(llano(im["titulo"]), {"url": str(im["imagen"]), "titulo": str(im["titulo"])})
    for pin in m["leido"].get("pines") or []:
        nombre = llano(pin.get("etiqueta"))
        if nombre and nombre in imagenes:
            pin["ver"] = imagenes[nombre]


def un_mapa(m, probar):
    """Pinta un .cmap de una campaña (ya leído, ver leer_uno) y escribe su
    página. Devuelve (clave, título, url)."""
    archivo, clave, campana, leido, avisos = m["archivo"], m["clave"], m["campana"], m["leido"], m["avisos"]
    m["sesiones"] = poner_sesiones(m)
    poner_imagenes_al_pulsar(m)
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
        # Las banderas y blasones: los sube el editor a las imágenes de la campaña.
        origen = buscar(nombre, [suyas])
        if origen is None:
            return ""
        if not probar:
            salida_img.mkdir(parents=True, exist_ok=True)
            shutil.copy2(origen, salida_img / origen.name)
        return url_img + origen.name

    hecho = mundo_mapas.pintar(leido, lambda n: ("", False), m["mapa_a"], de_imagen,
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
                                       hecho.get("hay_zonas_regionales", False), sesiones=m["sesiones"])
    titulo, url = m["titulo"], m["url"]
    # Una zona vuelve a su mapamundi; el mapamundi, a la campaña.
    mundo = m["mundo"]
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
        ("{{VOLVER}}", html.escape("← volver a la " + nombre_campana if mundo is m else "← volver al " + mundo["titulo"])),
        ("{{VOLVER_URL}}", html.escape(str(campana.get("pagina") or "/web/notas_rol/%s/index_%s.html" % (clave, clave))
                                       if mundo is m else mundo["url"], quote=True)),
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
    # Primero se leen todos: para saber a dónde lleva cada cosa hay que
    # conocer antes los otros mapas de su campaña.
    leidos = {}
    for archivo in sorted(MAPAS_ROL.glob("*/*.cmap"), key=lambda a: (a.parent.name, a.stem.lower())) \
            if MAPAS_ROL.is_dir() else []:
        m = leer_uno(archivo)
        if m:
            leidos.setdefault(m["clave"], []).append(m)
    hechos = []
    por_campana = {}
    zonas_de = {}
    rutas_de = {}
    for clave, mapas in leidos.items():
        mundo = enlazar_zonas(mapas)
        por_campana[clave] = mundo["url"]
        zonas_de[clave] = [{"titulo": m["titulo"], "url": m["url"]} for m in mapas if m is not mundo]
        for m in mapas:
            hechos.append(un_mapa(m, args.probar))
        # Dónde está la ruta de cada sesión: en el mapamundi si sale allí;
        # si no, en la primera zona donde salga.
        rutas = {}
        for m in sorted(mapas, key=lambda x: x is not mundo):
            for numero, _ in m["sesiones"]:
                rutas.setdefault(numero, "%s?sesion=%d" % (m["url"], numero))
        rutas_de[clave] = rutas
    # El botón «el mapamundi →» de cada campaña: "mapa" en su JSON, y sus
    # zonas en "zonas"; o fuera si ya no tiene.
    for archivo in sorted((RAIZ / "datos" / "notas_rol").glob("campana-*.json")):
        clave = archivo.stem[len("campana-"):]
        datos, _ = nombre_de_campana(clave)
        if datos is None:
            continue
        quiere = por_campana.get(clave)
        zonas = zonas_de.get(clave) or []
        rutas = rutas_de.get(clave) or {}
        sesiones = [s for s in datos.get("sesiones") or [] if isinstance(s, dict)]

        def ruta_de(s):
            try:
                return rutas.get(int(s.get("numero")))
            except (TypeError, ValueError):
                return None
        antes = (datos.get("mapa"), datos.get("zonas") or [], [s.get("ruta") for s in sesiones])
        if antes == (quiere, zonas, [ruta_de(s) for s in sesiones]):
            continue
        for nombre, valor in (("mapa", quiere), ("zonas", zonas)):
            if valor:
                datos[nombre] = valor
            else:
                datos.pop(nombre, None)
        for s in sesiones:
            if ruta_de(s):
                s["ruta"] = ruta_de(s)
            else:
                s.pop("ruta", None)
        if not args.probar:
            escribir_texto(archivo, json.dumps(datos, ensure_ascii=False, indent=4) + "\n")
        print("  %s: el mapamundi %s%s" % (archivo.relative_to(RAIZ), "→ " + quiere if quiere else "quitado",
                                          (", %d zona(s)" % len(zonas) if zonas else "")
                                          + (", ruta de %d sesión(es)" % len(rutas) if rutas else "")))
    print("\n  %d mapa(s) de campaña." % len(hechos))
    return 0


if __name__ == "__main__":
    sys.exit(main())
