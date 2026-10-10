#!/usr/bin/env python3
# =========================================
# GALERÍA DEL SANTUARIO — miniaturas + listado
# =========================================
# Mira las fotos que ya tengas en imagenes/santuarios/<gato>/, crea una
# miniatura de cada una y escribe datos/fotos-santuarios.json, que es de
# donde la web saca la galería.
#
# POR QUÉ HACEN FALTA LAS MINIATURAS
# ----------------------------------
# En la rejilla cada foto se ve como mucho a 265x160 píxeles, pero el
# archivo que hay detrás mide 1920 y pesa entre 130 y 700 KB. Sin
# miniaturas, abrir la ficha de Tali descarga 6,7 MB y la de Regis
# 9,7 MB — para enseñar recuadros diminutos. Con miniaturas, la
# rejilla carga unos pocos cientos de KB y la foto grande solo se
# descarga cuando alguien la amplía.
#
# CÓMO USARLO
# -----------
# Cada vez que añadas fotos nuevas a imagenes/santuarios/<gato>/ (ya
# pasadas por optimizar-imagenes.py), ejecuta desde la raíz del sitio:
#
#     python herramientas/2-imagenes/generar-galeria.py
#
# Y sube lo que genere. No hace falta tocar ningún HTML: la galería
# se monta sola desde el JSON.
#
# Al terminar las miniaturas te va preguntando la descripción de cada
# foto que todavía no la tenga (el alt: lo que se lee en voz alta quien
# no ve la foto). Enter la deja para otro día, "fin" deja de preguntar
# por las que queden, y con --sin-preguntar no pregunta nada.
#
# DETALLES
# --------
# - Las fotos grandes NO se tocan: solo se les crea la miniatura.
# - thumbnail.webp de cada carpeta se ignora: esa es la portada que
#   sale en el índice de santuarios, no una foto de la galería.
# - El orden es de más nueva a más vieja, sacando la fecha del nombre
#   del archivo (IMG_20250106..., PXL_20260302...). Las que no lleven
#   fecha en el nombre van al final, por orden alfabético.
# - Los textos alternativos que escribas a mano en el JSON se
#   respetan al volver a ejecutarlo.
# - Se puede ejecutar las veces que haga falta: lo ya hecho se salta.

import sys
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import json
import re

try:
    from PIL import Image
except ImportError:
    print("Falta la librería Pillow. Instálala con:  pip install pillow")
    print("(en Windows, si pip no le suena:  py -m pip install pillow)")
    sys.exit(1)

# ---- Ajustes ----
LADO_MINI = 600   # medido: la rejilla nunca dibuja más de 265x160, así que
                  # con 600 van sobradas incluso en pantallas de alta densidad
CALIDAD = 80

from comun import RAIZ, escribir_json, preguntar
SANTUARIOS = RAIZ / "imagenes" / "santuarios"
JSON_FOTOS = RAIZ / "datos" / "fotos-santuarios.json"

SUFIJO_MINI = "-mini"
PORTADA = "thumbnail.webp"

# Las descripciones que se inventa el script cuando no hay ninguna. No
# valen para nada a la hora de entender la foto, así que se tratan como
# "todavía sin describir" y se vuelven a preguntar.
RE_AUTOMATICO = re.compile(r"^.+, foto \d+$")


def alt_automatico(gato, numero):
    return f"{gato.capitalize()}, foto {numero}"


def clave_orden(ruta):
    """De más nueva a más vieja usando la fecha del nombre del archivo."""
    fecha = re.search(r"(20\d{6})", ruta.name)
    # el 0 delante hace que las que tienen fecha vayan antes que las que no
    return (0, -int(fecha.group(1)), ruta.name) if fecha else (1, 0, ruta.name)


def cargar_previo():
    if not JSON_FOTOS.is_file():
        return {}
    try:
        return json.loads(JSON_FOTOS.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        print(f"  (aviso: {JSON_FOTOS.name} no se entiende, se reescribe de cero)")
        return {}


def pedir_alts(pendientes):
    """Va preguntando la descripción de las fotos que no la tienen.

    Las que ya llevan una escrita a mano no se preguntan: se dan por
    buenas. Lo que se conteste se mete en el mismo diccionario que
    después se escribe en el JSON.
    """
    if not pendientes:
        return 0
    if not sys.stdin.isatty():
        # Ejecutado desde publicar.py o desde otro script: no hay nadie
        # al teclado, así que ni se intenta.
        print(f"\n  ({len(pendientes)} foto(s) sin descripción; ejecútalo a mano para escribirlas)")
        return 0

    print("\n  ---- descripciones ----")
    print(f"  Quedan {len(pendientes)} foto(s) por describir. Esto es lo que se")
    print("  lee en voz alta cuando alguien no puede ver la foto, así que mejor")
    print('  "Tali dormida en el teclado" que "gato".')
    print('  Enter la deja para otro día · "fin" deja de preguntar.')

    escritas = 0
    for numero, (ruta, entrada) in enumerate(pendientes, start=1):
        print(f"\n  [{numero}/{len(pendientes)}] {ruta.relative_to(RAIZ).as_posix()}")
        respuesta = preguntar("Descripción")
        if respuesta.lower() in ("fin", "basta", "luego"):
            print(f"  Vale, lo dejo. Quedan {len(pendientes) - numero + 1} sin describir.")
            break
        if not respuesta:
            continue
        entrada["alt"] = respuesta
        escritas += 1
    return escritas


def generar(preguntar_alts=True):
    if not SANTUARIOS.is_dir():
        print(f"No encuentro {SANTUARIOS.relative_to(RAIZ)}.")
        return

    previo = cargar_previo()
    resultado = {}
    creadas = saltadas = 0
    peso_grandes = peso_minis = 0
    pendientes = []

    for carpeta in sorted(c for c in SANTUARIOS.iterdir() if c.is_dir()):
        gato = carpeta.name.lower()
        fotos = sorted(
            (p for p in carpeta.glob("*.webp")
             if p.name != PORTADA and SUFIJO_MINI not in p.stem),
            key=clave_orden,
        )
        if not fotos:
            continue

        alt_previos = {f["archivo"]: f.get("alt", "") for f in previo.get(gato, [])}
        lista = []
        print(f"\n  [{gato}] {len(fotos)} foto(s)")

        for numero, foto in enumerate(fotos, start=1):
            mini = foto.with_name(foto.stem + SUFIJO_MINI + ".webp")

            if mini.is_file() and mini.stat().st_mtime >= foto.stat().st_mtime:
                with Image.open(foto) as img:
                    ancho, alto = img.size
                saltadas += 1
            else:
                with Image.open(foto) as img:
                    ancho, alto = img.size
                    pequena = img.convert("RGB")
                    pequena.thumbnail((LADO_MINI, LADO_MINI), Image.LANCZOS)
                    pequena.save(mini, "WEBP", quality=CALIDAD, method=6)
                creadas += 1

            peso_grandes += foto.stat().st_size
            peso_minis += mini.stat().st_size

            # Describe la foto para quien no puede verla. El automático
            # es un apaño: mejor "Tali dormida en el teclado".
            alt = alt_previos.get(foto.name, "")
            sin_describir = not alt or bool(RE_AUTOMATICO.match(alt))

            entrada = {
                "archivo": foto.name,
                "mini": mini.name,
                "ancho": ancho,
                "alto": alto,
                "alt": alt if not sin_describir else alt_automatico(gato, numero),
            }
            lista.append(entrada)
            if sin_describir:
                # Se preguntan al final, cuando las miniaturas ya están
                # hechas: así no se queda el proceso a medias esperando
                # a que alguien escriba.
                pendientes.append((foto, entrada))

        resultado[gato] = lista

    escritas = pedir_alts(pendientes) if preguntar_alts else 0

    JSON_FOTOS.parent.mkdir(parents=True, exist_ok=True)
    escribir_json(JSON_FOTOS, resultado)

    print(f"\n  {creadas} miniatura(s) creadas, {saltadas} ya estaban.")
    if peso_grandes:
        print(f"  La rejilla pasa de cargar {peso_grandes/1024/1024:.1f} MB"
              f" a {peso_minis/1024/1024:.1f} MB"
              f"  ({100 - peso_minis * 100 / peso_grandes:.0f}% menos)")
    print(f"  Listado escrito en {JSON_FOTOS.relative_to(RAIZ)}")
    if escritas:
        print(f"  {escritas} descripción(es) nuevas.")
    quedan = len(pendientes) - escritas
    if quedan:
        print(f"  Ojo: {quedan} foto(s) siguen con la descripción automática"
              " («Regis, foto 4» y parecidas). Se vuelven a preguntar la"
              " próxima vez, o escríbelas a mano en el JSON.")


if __name__ == "__main__":
    generar(preguntar_alts="--sin-preguntar" not in sys.argv)
