#!/usr/bin/env python3
# =========================================
# TRAER EL MUNDO DESDE CHRONICLER
# =========================================
# Le pasas la carpeta donde tienes la bóveda y él hace lo demás: la mira,
# te cuenta lo que hay, se trae las páginas y las imágenes a wiki/ y pasa
# el generador, que convierte todo a páginas de la web.
#
#     python herramientas/1-publicar/importar-mundo.py "C:\\Users\\Richi\\Mundo"
#     python herramientas/1-publicar/importar-mundo.py ~/Documentos/mundo
#
# LA SEGUNDA VEZ NO HACE FALTA LA RUTA: se la apunta en
# herramientas/0-comun/datos/mundo-origen.txt y, si no le dices otra, usa esa.
#
#     python herramientas/1-publicar/importar-mundo.py
#
# ES UN ESPEJO, NO UN AÑADIR. Lo que esté en wiki/ y ya no esté en la
# bóveda se quita, porque si no, una página que renombraste en Chronicler
# se quedaría publicada dos veces: con el nombre viejo y con el nuevo. Se
# te dice cuáles antes de tocarlas. Con --anadir no quita nada.
#
# LO QUE SE TRAE
# --------------
#   · las páginas (.md), con sus carpetas tal cual están;
#   · los mapas interactivos (.cmap);
#   · las imágenes (.webp, .png, .jpg, .gif, .svg, .avif), incluidas las
#     del fondo de los mapas, que suelen ser enormes: el generador las
#     encoge al pasarlas a la web.
#
# LO QUE NO SE TRAE NUNCA es lo que es de la aplicación y no del mundo:
# la caché de Chronicler (.chronicler-cache), sus plantillas
# (_system/templates, que son los moldes para crear páginas y no páginas),
# y cualquier carpeta que empiece por punto. Al terminar se dice cuántos
# archivos se han quedado ahí y en qué carpetas, para que se vea que no se
# está dejando fuera nada que hiciera falta. La lista está en comun.py
# (es_del_mundo) porque el generador tiene que ignorar exactamente lo
# mismo al publicar.
#
# LO DEMÁS NO SE TRAE, PERO SE CUENTA. Al terminar sale un inventario de
# todo lo que hay en la bóveda que no es ninguna de esas tres cosas: qué
# extensión tiene, cuántos archivos son, cuánto pesan y, si es texto, un
# asomo de lo que lleva dentro. Ahí es donde aparecería cualquier cosa
# nueva que Chronicler guarde a su manera. Con --todo se trae también eso,
# sin publicarlo, que es lo que hace falta para poder mirarlo y convertirlo
# algún día (es así como se descubrió el formato de los mapas).
#
# ELEGIR QUÉ ENTRA. No todo lo que hay en la bóveda tiene que estar en la
# web: una página a medio escribir, un sitio que todavía no ha salido en la
# partida. Cada vez que lo pasas te pregunta si quieres cambiar lo que
# entra (Enter es que no), y para ir directo a eso:
#
#     python herramientas/1-publicar/importar-mundo.py --elegir
#
# Sale la lista de páginas y mapas por carpetas, con [x] lo que entra y
# [ ] lo que no, y se cambia escribiendo números («3», «5-8»), el nombre
# de una carpeta («gente/») o «todo» / «nada». Lo que dejes fuera se apunta
# en herramientas/0-comun/datos/wiki-fuera.txt y SE QUEDA FUERA hasta que lo vuelvas a
# marcar: ni se trae ni lo publica generar-mundo.py, aunque siga en la
# bóveda. Las imágenes no se eligen: el generador solo publica las que use
# alguna página.
#
# Si no hay bóveda de fuera (Chronicler escribe directamente en wiki/),
# --elegir trabaja sobre wiki/: elige y vuelve a generar, sin traer nada.
#
# ANTES DE TOCAR NADA, PRUÉBALO EN SECO:
#
#     python herramientas/1-publicar/importar-mundo.py <ruta> --probar
#
# No copia ni borra nada: solo mira la bóveda y te dice lo que haría.

import argparse
import shutil
import sys
import unicodedata
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "0-comun"))

from comun import (RAIZ, RUTAS_QUE_NO_SON_EL_MUNDO,  # noqa: E402
                   WIKI_FUERA, es_del_mundo, esta_fuera, guardar_wiki_fuera,
                   pasar_generadores, preguntar, wiki_fuera)

DESTINO = RAIZ / "wiki"
ORIGEN_APUNTADO = RAIZ / "herramientas" / "0-comun" / "datos" / "mundo-origen.txt"
# Donde se apuntaba antes de ordenar las herramientas en carpetas: si
# todavía está ahí, se pasa a su sitio nuevo.
_ORIGEN_VIEJO = RAIZ / "herramientas" / "mundo-origen.txt"
if _ORIGEN_VIEJO.is_file() and not ORIGEN_APUNTADO.is_file():
    try:
        _ORIGEN_VIEJO.replace(ORIGEN_APUNTADO)
    except OSError:
        ORIGEN_APUNTADO = _ORIGEN_VIEJO

PAGINAS = {".md"}
IMAGENES = {".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".avif"}
# Los mapas interactivos. Un .cmap es un JSON con el tamaño del lienzo, las
# capas de fondo y los contornos de cada región; lo convierte
# herramientas/0-comun/mundo_mapas.py.
MAPAS = {".cmap"}

# Lo que no se trae nunca, ni con --todo: son cosas de la propia
# aplicación o del sistema, no del mundo. Se miran por el nombre de una
# carpeta en cualquier punto de la ruta.
# Lo que no se trae nunca —la caché de Chronicler, sus plantillas, lo que
# empiece por punto— está en comun.py y no aquí, porque tiene que ser LO
# MISMO que ignora el generador al publicar: ver es_del_mundo.

# El archivo que esta herramienta escribe dentro de wiki/ y que no viene
# de la bóveda: no hay que borrarlo al hacer el espejo.
NUESTROS = {"LEEME.txt"}

SI = ("s", "si", "sí", "y", "yes")


def kb(n):
    return f"{n / 1024:.0f} KB" if n < 1024 * 1024 else f"{n / 1024 / 1024:.1f} MB"


# =========================================
# DE DÓNDE SE TRAE
# =========================================

def donde_esta_la_boveda(pedida):
    """La ruta que te hayan dado, o la de la última vez. Se comprueba que
    exista y que parezca una bóveda antes de hacer nada: equivocarse de
    carpeta aquí significaría vaciar wiki/ y llenarlo de otra cosa."""
    if pedida:
        ruta = Path(pedida).expanduser()
    else:
        apuntada = leer_apuntado()
        if apuntada:
            ruta = apuntada
            print(f"\n  Uso la de la última vez: {ruta}")
        else:
            # Se pregunta en vez de rendirse: desde el menú no hay forma de
            # pasar la ruta en la línea de órdenes.
            print("\n  No tengo ninguna bóveda apuntada todavía.")
            print("  Es la carpeta que tengas abierta en Chronicler; en Windows se")
            print("  copia desde la barra de direcciones del explorador.")
            dicho = preguntar("¿Dónde está?")
            if not dicho:
                print("\n  Sin ruta no puedo hacer nada. También se le puede pasar suelta:")
                print('\n     python herramientas/1-publicar/importar-mundo.py "C:\\\\ruta\\\\a\\\\tu\\\\mundo"\n')
                return None
            # Las rutas copiadas del explorador vienen con comillas a veces.
            ruta = Path(dicho.strip('"').strip("'")).expanduser()

    try:
        ruta = ruta.resolve()
    except OSError:
        print(f"\n  No puedo llegar a esa ruta: {pedida}\n")
        return None

    if not ruta.is_dir():
        print(f"\n  No encuentro la carpeta: {ruta}")
        print("  Mira que la ruta esté bien escrita y que el disco esté conectado.\n")
        return None

    # Que sea la bóveda y no la carpeta de al lado.
    if not any(ruta.rglob("*.md")):
        print(f"\n  En {ruta} no hay ningún .md.")
        print("  Eso no parece una bóveda de Chronicler: ¿será la carpeta de")
        print("  encima, o la de las copias de seguridad?\n")
        return None

    # Si lo que te han dado es la propia carpeta wiki/, no hay nada que
    # traer: ya está donde tiene que estar. Pasa que es lo más fácil de
    # confundir, porque Chronicler puede estar apuntando justo ahí.
    if ruta == DESTINO.resolve():
        print(f"\n  {ruta}")
        print("  ÉSA ES YA la carpeta del mundo: si escribes ahí con Chronicler,")
        print("  no hay nada que traer. Para publicarlo:")
        print("\n     python herramientas/3-generadores/generar-mundo.py\n")
        return None

    # Y que no sea ningún otro sitio de dentro, que sería un lío de los gordos.
    if ruta == RAIZ.resolve() or RAIZ.resolve() in ruta.parents:
        print(f"\n  {ruta} está dentro del propio sitio.")
        print("  La bóveda tiene que ser una carpeta de fuera; wiki/ es la copia")
        print("  que hace esta herramienta, no el original.\n")
        return None
    return ruta


def leer_apuntado():
    if not ORIGEN_APUNTADO.is_file():
        return None
    try:
        texto = ORIGEN_APUNTADO.read_text(encoding="utf-8").strip()
    except OSError:
        return None
    for linea in texto.split("\n"):
        linea = linea.strip()
        if linea and not linea.startswith("#"):
            return Path(linea).expanduser()
    return None


def apuntar(ruta):
    ORIGEN_APUNTADO.write_text(
        "# De dónde se trae el mundo. Lo escribe\n"
        "# herramientas/1-publicar/importar-mundo.py la primera vez que le\n"
        "# pasas una ruta, para no tener que repetirla. Cámbiala a mano si\n"
        "# mueves la bóveda de sitio.\n"
        f"{ruta}\n",
        encoding="utf-8",
    )


# =========================================
# MIRAR LO QUE HAY
# =========================================

def es_basura(archivo, boveda):
    return not es_del_mundo(archivo, boveda)


def inventario(boveda):
    """Qué hay en la bóveda, repartido en cuatro montones: páginas, mapas,
    imágenes y lo demás. El último es el interesante cuando algo no cuadra:
    ahí aparece cualquier cosa que Chronicler guarde en un formato que
    todavía no sabemos convertir."""
    paginas, mapas, imagenes, otros, dejados = [], [], [], [], []
    for archivo in sorted(boveda.rglob("*")):
        if not archivo.is_file():
            continue
        if es_basura(archivo, boveda):
            dejados.append(archivo)
            continue
        sufijo = archivo.suffix.lower()
        if sufijo in PAGINAS:
            paginas.append(archivo)
        elif sufijo in MAPAS:
            mapas.append(archivo)
        elif sufijo in IMAGENES:
            imagenes.append(archivo)
        else:
            otros.append(archivo)
    return paginas, mapas, imagenes, otros, dejados


def contar_otros(otros, boveda):
    """Lo que no son páginas ni imágenes, agrupado por extensión y con lo
    que ocupa. Es lo que hay que mirar para saber cómo guarda Chronicler
    los mapas."""
    por_extension = {}
    for archivo in otros:
        sufijo = archivo.suffix.lower() or "(sin extensión)"
        ficha = por_extension.setdefault(sufijo, {"cuantos": 0, "bytes": 0, "ejemplos": []})
        ficha["cuantos"] += 1
        try:
            ficha["bytes"] += archivo.stat().st_size
        except OSError:
            pass
        if len(ficha["ejemplos"]) < 3:
            ficha["ejemplos"].append(archivo.relative_to(boveda).as_posix())
    return por_extension


def asomarse(archivo, letras=300):
    """Las primeras letras de un archivo, si es texto. Para poder ver de
    qué va un formato que no conocemos sin tener que abrirlo."""
    try:
        crudo = archivo.read_bytes()[:4000]
    except OSError:
        return ""
    if b"\x00" in crudo[:1000]:
        return ""  # binario
    try:
        texto = crudo.decode("utf-8")
    except UnicodeDecodeError:
        return ""
    texto = " ".join(texto.split())
    return texto[:letras]


# =========================================
# ELEGIR QUÉ ENTRA
# =========================================

def rangos(texto, maximo):
    """«3», «5-8», «1 4 7», «2,3»: los números que se han escrito. None si
    hay algo que no es un número, para no cambiar nada a medias."""
    elegidos = set()
    for trozo in texto.replace(",", " ").split():
        if "-" in trozo:
            a, _, b = trozo.partition("-")
            if not (a.isdigit() and b.isdigit()):
                return None
            a, b = sorted((int(a), int(b)))
            elegidos.update(range(a, b + 1))
        elif trozo.isdigit():
            elegidos.add(int(trozo))
        else:
            return None
    return {n for n in elegidos if 1 <= n <= maximo}


def elegir_que_entra(boveda, paginas, mapas):
    """La pantalla de [x] / [ ]. Devuelve True si ha cambiado algo (y lo ha
    guardado en wiki-fuera.txt)."""
    reglas = wiki_fuera()
    cosas = sorted(
        [(a.relative_to(boveda).as_posix(), "página") for a in paginas]
        + [(a.relative_to(boveda).as_posix(), "mapa") for a in mapas],
        key=lambda c: (c[0].count("/") > 0, c[0].rsplit("/", 1)[0].lower() if "/" in c[0] else "", c[0].lower()),
    )
    if not cosas:
        print("\n  No hay páginas ni mapas que elegir.")
        return False
    fuera = {ruta for ruta, _ in cosas if esta_fuera(ruta, reglas)}
    antes = set(fuera)

    def carpeta(ruta):
        return ruta.rsplit("/", 1)[0] + "/" if "/" in ruta else ""

    while True:
        print("\n  ---- QUÉ ENTRA EN LA WIKI ----")
        print("  [x] entra · [ ] se queda fuera\n")
        actual = None
        for n, (ruta, que) in enumerate(cosas, start=1):
            if carpeta(ruta) != actual:
                actual = carpeta(ruta)
                print(f"  {actual or '(en la raíz)'}")
            marca = " " if ruta in fuera else "x"
            nombre = ruta.rsplit("/", 1)[-1].rsplit(".", 1)[0]
            extra = "  (mapa)" if que == "mapa" else ""
            print(f"     [{marca}] {n:>3}. {nombre}{extra}")
        print(f"\n  Entran {len(cosas) - len(fuera)} de {len(cosas)}.")
        print("  Escribe números para cambiarlos (3, 5-8), una carpeta (gente/),")
        print("  «todo» o «nada». Enter en blanco para terminar.")
        dicho = preguntar("¿Qué cambio?").strip()
        if not dicho:
            break
        if dicho.lower() == "todo":
            fuera.clear()
            continue
        if dicho.lower() == "nada":
            fuera = {ruta for ruta, _ in cosas}
            continue
        if dicho.endswith("/") or dicho.endswith("\\"):
            buscada = dicho.replace("\\", "/").strip("/").lower() + "/"
            dentro = [r for r, _ in cosas if carpeta(r).lower() == buscada]
            if not dentro:
                print(f"     No hay ninguna carpeta {dicho!r} con páginas.")
                continue
            # Si entra alguna, la carpeta se saca entera; si no entra
            # ninguna, se mete entera. Es lo que uno espera al «pulsarla».
            if any(r not in fuera for r in dentro):
                fuera.update(dentro)
            else:
                fuera.difference_update(dentro)
            continue
        numeros = rangos(dicho, len(cosas))
        if not numeros:
            print(f"     No entiendo {dicho!r}.")
            continue
        for n in numeros:
            ruta = cosas[n - 1][0]
            fuera.symmetric_difference_update({ruta})

    if fuera == antes:
        print("\n  No cambia nada de lo que entra.")
        return False

    # Las carpetas enteras escritas a mano se respetan mientras todo lo de
    # dentro siga fuera: así lo que añadas en el futuro a esa carpeta
    # también se queda fuera. Si has vuelto a meter algo de una, la regla
    # de carpeta se deshace en sus archivos.
    nuevas = set()
    for regla in reglas:
        if regla.endswith("/"):
            dentro = [r for r, _ in cosas if esta_fuera(r, [regla])]
            if all(r in fuera for r in dentro):
                nuevas.add(regla)
    nuevas.update(r for r in fuera if not esta_fuera(r, nuevas))
    # Lo apuntado de algo que ya no está en la bóveda se conserva: puede
    # ser una página que se ha movido de carpeta un momento.
    existentes = {r.lower() for r, _ in cosas}
    nuevas.update(r for r in reglas if not r.endswith("/") and r.lower() not in existentes)
    guardar_wiki_fuera(nuevas)
    print(f"\n  Apuntado en {WIKI_FUERA.relative_to(RAIZ)}:"
          f" {len(fuera)} cosa(s) fuera.")
    return True


# =========================================
# TRAERLO
# =========================================

def dentro_de(destino, carpeta):
    """Que lo que vamos a escribir esté DE VERDAD dentro de wiki/. Un
    nombre de archivo con ".." en la bóveda escribiría fuera del sitio, y
    eso no puede pasar ni por accidente."""
    try:
        return carpeta.resolve() in destino.resolve().parents or destino.resolve() == carpeta.resolve()
    except OSError:
        return False


def traer(archivos, boveda, probar):
    """Copia lo que haya cambiado. Se mira el tamaño y la fecha, no el
    contenido: en una bóveda de trescientas páginas, leerlas todas dos
    veces para comparar tarda más que copiarlas."""
    copiados, saltados, fuera = 0, 0, []
    for archivo in archivos:
        relativo = archivo.relative_to(boveda)
        destino = DESTINO / relativo
        if not dentro_de(destino, DESTINO):
            fuera.append(relativo.as_posix())
            continue
        if destino.is_file():
            try:
                suyo, nuestro = archivo.stat(), destino.stat()
                if suyo.st_size == nuestro.st_size and int(suyo.st_mtime) <= int(nuestro.st_mtime):
                    saltados += 1
                    continue
            except OSError:
                pass
        if probar:
            copiados += 1
            continue
        destino.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(archivo, destino)
        copiados += 1
    return copiados, saltados, fuera


def lo_que_sobra(traidos, boveda):
    """Lo que hay en wiki/ y ya no está en la bóveda. Se devuelve para
    poder enseñarlo ANTES de borrar nada."""
    deberia = {(DESTINO / a.relative_to(boveda)).resolve() for a in traidos}
    sobran = []
    if not DESTINO.is_dir():
        return sobran
    for archivo in sorted(DESTINO.rglob("*")):
        if not archivo.is_file() or archivo.name in NUESTROS:
            continue
        if archivo.resolve() not in deberia:
            sobran.append(archivo)
    return sobran


def tirar(sobran, probar):
    if probar:
        return len(sobran)
    for archivo in sobran:
        try:
            archivo.unlink()
        except OSError:
            pass
    # Y las carpetas que se hayan quedado vacías, de abajo arriba.
    for carpeta in sorted(DESTINO.rglob("*"), key=lambda p: -len(p.parts)):
        if carpeta.is_dir() and not any(carpeta.iterdir()):
            try:
                carpeta.rmdir()
            except OSError:
                pass
    return len(sobran)


# =========================================
# CONTARLO
# =========================================

def main():
    parser = argparse.ArgumentParser(
        description="Trae el mundo desde la bóveda de Chronicler y lo monta en la web.")
    parser.add_argument("ruta", nargs="?",
                        help="la carpeta de la bóveda. Si no la pones, uso la de la última vez.")
    parser.add_argument("--probar", action="store_true",
                        help="no copia ni borra nada: solo mira y te lo cuenta")
    parser.add_argument("--anadir", action="store_true",
                        help="no quita de wiki/ lo que ya no esté en la bóveda")
    parser.add_argument("--todo", action="store_true",
                        help="trae también lo que no sean páginas, mapas ni imágenes")
    parser.add_argument("--sin-generar", action="store_true",
                        help="solo trae los archivos; no pasa el generador")
    parser.add_argument("--elegir", action="store_true",
                        help="enseña la lista de páginas y mapas para elegir qué entra")
    args = parser.parse_args()

    boveda = donde_esta_la_boveda(args.ruta)
    if boveda is None:
        # Sin bóveda de fuera se puede elegir igual sobre wiki/: es lo que
        # pasa si Chronicler escribe directamente ahí.
        if args.elegir and DESTINO.is_dir() and any(DESTINO.rglob("*.md")):
            print(f"\n  Elijo sobre {DESTINO.relative_to(RAIZ)}/, sin traer nada.")
            pags, maps, _, _, _ = inventario(DESTINO)
            if elegir_que_entra(DESTINO, pags, maps) and not args.probar:
                pasar_generadores(("3-generadores/generar-mundo.py",))
            return 0
        return 1

    print(f"\n  ---- {boveda} ----")
    paginas, mapas, imagenes, otros, dejados = inventario(boveda)
    pesan = sum(a.stat().st_size for a in imagenes if a.is_file())
    print(f"  {len(paginas)} página(s), {len(mapas)} mapa(s),"
          f" {len(imagenes)} imagen(es) ({kb(pesan)}).")
    for mapa in mapas:
        print(f"     mapa: {mapa.relative_to(boveda).as_posix()}")

    # LO QUE SE QUEDA EN LA BÓVEDA porque es de la aplicación y no del
    # mundo. Se dice en una línea y por carpetas: así se ve de un vistazo
    # que no se está dejando fuera algo que sí hacía falta.
    if dejados:
        donde = {}
        for archivo in dejados:
            partes = archivo.relative_to(boveda).parts
            raiz = partes[0] if len(partes) > 1 else "(sueltos)"
            for ruta in RUTAS_QUE_NO_SON_EL_MUNDO:
                if "/".join(partes).startswith(ruta + "/"):
                    raiz = ruta
            donde[raiz] = donde.get(raiz, 0) + 1
        resumen = ", ".join(f"{sitio} ({cuantos})"
                            for sitio, cuantos in sorted(donde.items(), key=lambda x: -x[1])[:5])
        print(f"  {len(dejados)} archivo(s) que son de Chronicler y no del"
              f" mundo, y no me traigo: {resumen}")

    # EL INVENTARIO DE LO DEMÁS: lo que Chronicler guarde a su manera y
    # aquí todavía no se sepa convertir. Sale siempre y con detalle, porque
    # es lo único que avisa de que la aplicación ha aprendido algo nuevo.
    if otros:
        por_extension = contar_otros(otros, boveda)
        total = sum(f["bytes"] for f in por_extension.values())
        print(f"\n  ---- {len(otros)} archivo(s) que no sé qué son ({kb(total)}) ----")
        print("  (no son páginas, ni mapas, ni imágenes)\n")
        for sufijo, ficha in sorted(por_extension.items(), key=lambda x: -x[1]["cuantos"]):
            print(f"     {sufijo:<16} {ficha['cuantos']:>4}  {kb(ficha['bytes']):>9}")
            for ejemplo in ficha["ejemplos"]:
                print(f"                      {ejemplo}")
            # Si es texto, un asomo de lo que lleva dentro: con eso se
            # puede saber si es JSON, qué campos tiene y si se puede
            # convertir.
            primero = next(a for a in otros if a.relative_to(boveda).as_posix() == ficha["ejemplos"][0])
            vistazo = asomarse(primero)
            if vistazo:
                print(f"                      ┌ {vistazo[:160]}")
                if len(vistazo) > 160:
                    print(f"                      └ {vistazo[160:300]}")
        if not args.todo:
            print("\n  No me los traigo (todavía no sé convertirlos a la web).")
            print("  Con --todo los copio igualmente, para tenerlos a mano.")

    if not paginas and not mapas:
        print("\n  No hay ninguna página ni ningún mapa que traer.\n")
        return 1

    # ELEGIR QUÉ ENTRA: con --elegir directamente, y si no, se pregunta
    # (Enter es que no, y se queda lo que hubiera apuntado).
    if args.elegir:
        elegir_que_entra(boveda, paginas, mapas)
    elif not args.probar:
        if preguntar("\n¿Quieres cambiar qué páginas entran en la wiki? (s/N)", "n").lower() in SI:
            elegir_que_entra(boveda, paginas, mapas)

    reglas = wiki_fuera()
    fuera_paginas = [a for a in list(paginas) + list(mapas)
                     if esta_fuera(a.relative_to(boveda).as_posix(), reglas)]
    if fuera_paginas:
        print(f"\n  {len(fuera_paginas)} página(s)/mapa(s) que has dejado fuera"
              f" ({WIKI_FUERA.relative_to(RAIZ)}): no me los traigo.")
    a_traer = ([a for a in list(paginas) + list(mapas) if a not in fuera_paginas]
               + list(imagenes) + (list(otros) if args.todo else []))

    # LO QUE SOBRA, ANTES de tocarlo: borrar sin avisar es la forma más
    # rápida de perder algo que no se sabía que estaba ahí. Se separa lo
    # que ya no está en la bóveda de lo que sí está pero has dejado fuera.
    sobran = [] if args.anadir else lo_que_sobra(a_traer, boveda)
    elegidas_fuera = [a for a in sobran
                      if esta_fuera(a.relative_to(DESTINO).as_posix(), reglas)]
    borradas = [a for a in sobran if a not in elegidas_fuera]
    if elegidas_fuera:
        print(f"\n  ---- {len(elegidas_fuera)} archivo(s) en wiki/ que has dejado fuera ----")
        for archivo in elegidas_fuera[:12]:
            print(f"     {archivo.relative_to(DESTINO).as_posix()}")
        if len(elegidas_fuera) > 12:
            print(f"     … y {len(elegidas_fuera) - 12} más.")
        print("  (siguen en tu bóveda: solo se quitan de la copia del sitio)")
    if borradas:
        print(f"\n  ---- {len(borradas)} archivo(s) en wiki/ que ya no están en la bóveda ----")
        for archivo in borradas[:12]:
            print(f"     {archivo.relative_to(DESTINO).as_posix()}")
        if len(borradas) > 12:
            print(f"     … y {len(borradas) - 12} más.")
    if sobran:
        if not args.probar:
            print("\n  Los quito, para que no se queden publicados.")
            print("  (si quieres conservarlos, corta aquí y vuelve con --anadir)")
            if preguntar("¿Sigo? (S/n)", "s").lower() not in SI:
                print("\n  No he tocado nada.\n")
                return 0

    copiados, saltados, fuera = traer(a_traer, boveda, args.probar)
    quitados = tirar(sobran, args.probar)

    if fuera:
        print(f"\n  OJO: {len(fuera)} archivo(s) con una ruta que se sale de wiki/.")
        print("  No los he copiado. Mira cómo se llaman:")
        for f in fuera[:5]:
            print(f"     {f}")

    print()
    if args.probar:
        print(f"  (--probar: no he tocado nada)")
        print(f"  Traería {copiados}, dejaría {saltados} como están"
              + (f" y quitaría {quitados}." if quitados else "."))
        print("\n  Quita el --probar para hacerlo de verdad.\n")
        return 0

    print(f"  {copiados} traído(s), {saltados} que ya estaban igual"
          + (f", {quitados} quitado(s)." if quitados else "."))
    apuntar(boveda)
    print(f"  Apuntado de dónde viene, para la próxima: "
          f"{ORIGEN_APUNTADO.relative_to(RAIZ)}")

    if args.sin_generar:
        print("\n  No paso el generador (--sin-generar). Cuando quieras:")
        print("     python herramientas/3-generadores/generar-mundo.py\n")
        return 0

    # Y a convertirlo. generar-mundo.py pasa detrás los suyos (el sitemap,
    # el mapa del sitio, el buscador y las cabeceras), así que con esto
    # queda todo hecho.
    print()
    pasar_generadores(("3-generadores/generar-mundo.py",))
    return 0


if __name__ == "__main__":
    sys.exit(main())
