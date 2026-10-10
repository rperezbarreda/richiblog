#!/usr/bin/env python3
# =========================================
# TRAER EL MUNDO DESDE CHRONICLER
# =========================================
# Le pasas la carpeta donde tienes la bóveda y él hace lo demás: la mira,
# te cuenta lo que hay, se trae las páginas y las imágenes a mundo/ y pasa
# el generador, que convierte todo a páginas de la web.
#
#     python herramientas/1-publicar/importar-mundo.py "C:\\Users\\Richi\\Mundo"
#     python herramientas/1-publicar/importar-mundo.py ~/Documentos/mundo
#
# LA SEGUNDA VEZ NO HACE FALTA LA RUTA: se la apunta en
# herramientas/mundo-origen.txt y, si no le dices otra, usa esa.
#
#     python herramientas/1-publicar/importar-mundo.py
#
# ES UN ESPEJO, NO UN AÑADIR. Lo que esté en mundo/ y ya no esté en la
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
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from comun import (RAIZ, RUTAS_QUE_NO_SON_EL_MUNDO,  # noqa: E402
                   es_del_mundo, pasar_generadores, preguntar)

DESTINO = RAIZ / "mundo"
ORIGEN_APUNTADO = RAIZ / "herramientas" / "mundo-origen.txt"

PAGINAS = {".md"}
IMAGENES = {".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".avif"}
# Los mapas interactivos. Un .cmap es un JSON con el tamaño del lienzo, las
# capas de fondo y los contornos de cada región; lo convierte
# herramientas/3-generadores/mundo_mapas.py.
MAPAS = {".cmap"}

# Lo que no se trae nunca, ni con --todo: son cosas de la propia
# aplicación o del sistema, no del mundo. Se miran por el nombre de una
# carpeta en cualquier punto de la ruta.
# Lo que no se trae nunca —la caché de Chronicler, sus plantillas, lo que
# empiece por punto— está en comun.py y no aquí, porque tiene que ser LO
# MISMO que ignora el generador al publicar: ver es_del_mundo.

# El archivo que esta herramienta escribe dentro de mundo/ y que no viene
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
    carpeta aquí significaría vaciar mundo/ y llenarlo de otra cosa."""
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

    # Si lo que te han dado es la propia carpeta mundo/, no hay nada que
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
        print("  La bóveda tiene que ser una carpeta de fuera; mundo/ es la copia")
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
# TRAERLO
# =========================================

def dentro_de(destino, carpeta):
    """Que lo que vamos a escribir esté DE VERDAD dentro de mundo/. Un
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
    """Lo que hay en mundo/ y ya no está en la bóveda. Se devuelve para
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
                        help="no quita de mundo/ lo que ya no esté en la bóveda")
    parser.add_argument("--todo", action="store_true",
                        help="trae también lo que no sean páginas, mapas ni imágenes")
    parser.add_argument("--sin-generar", action="store_true",
                        help="solo trae los archivos; no pasa el generador")
    args = parser.parse_args()

    boveda = donde_esta_la_boveda(args.ruta)
    if boveda is None:
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

    a_traer = (list(paginas) + list(mapas) + list(imagenes)
               + (list(otros) if args.todo else []))

    # LO QUE SOBRA, ANTES de tocarlo: borrar sin avisar es la forma más
    # rápida de perder algo que no se sabía que estaba ahí.
    sobran = [] if args.anadir else lo_que_sobra(a_traer, boveda)
    if sobran:
        print(f"\n  ---- {len(sobran)} archivo(s) en mundo/ que ya no están en la bóveda ----")
        for archivo in sobran[:12]:
            print(f"     {archivo.relative_to(DESTINO).as_posix()}")
        if len(sobran) > 12:
            print(f"     … y {len(sobran) - 12} más.")
        if not args.probar:
            print("\n  Los quito, para que no se queden publicados.")
            print("  (si quieres conservarlos, corta aquí y vuelve con --anadir)")
            if preguntar("¿Sigo? (S/n)", "s").lower() not in SI:
                print("\n  No he tocado nada.\n")
                return 0

    copiados, saltados, fuera = traer(a_traer, boveda, args.probar)
    quitados = tirar(sobran, args.probar)

    if fuera:
        print(f"\n  OJO: {len(fuera)} archivo(s) con una ruta que se sale de mundo/.")
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
