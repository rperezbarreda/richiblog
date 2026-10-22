#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SUBIR EL SITIO A NEOCITIES, con su API: solo lo que ha cambiado.

    python herramientas/1-publicar/subir-neocities.py            sube lo cambiado (pregunta antes)
    python herramientas/1-publicar/subir-neocities.py --ensayo   dice qué subiría, sin subir nada
    python herramientas/1-publicar/subir-neocities.py --borrar   además, borra de Neocities lo que
                                                                 ya no está aquí (pregunta aparte)
    python herramientas/1-publicar/subir-neocities.py --clave    cambia la clave guardada

CÓMO SABE QUÉ HA CAMBIADO. Neocities da la lista de todo lo que hay en el
sitio con la huella (SHA-1) de cada archivo. Aquí se saca la de cada
archivo del ordenador y se sube solo el que no está allí o tiene otra
huella. Así subir después de cambiar una entrada son unos pocos archivos
y no los 23 MB del sitio.

QUÉ SE SUBE: todo lo de la carpeta del sitio MENOS herramientas/ (es
solo para ti), wiki/ (el origen de la wiki: ninguna página la pide; lo
que se sube es lo que genera, en web/wiki/, imagenes/wiki/ y
datos/wiki/), .git y lo que empieza por punto, y la basurilla
(__pycache__, Thumbs.db, desktop.ini, .DS_Store). Lo mismo que dice el
LEEME.

LA CLAVE DE LA API. Se saca en Neocities: Settings (Ajustes), tu sitio,
pestaña «API». Da acceso a tus archivos, así que NO se guarda en la
carpeta del sitio (que va a GitHub): la primera vez se pide y se guarda
en tu carpeta de usuario, en el archivo .richiblog-neocities (en
Windows, C:\\Users\\tu-usuario\\.richiblog-neocities). También vale
ponerla en la variable de entorno NEOCITIES_API_KEY.

CON CUIDADO CON NEOCITIES: los archivos van en tandas (como mucho 40 MB
o 100 archivos por tanda) y una detrás de otra, con una pausa, que es lo
que piden en su guía de la API. Las cuentas gratis no admiten algunos
tipos de archivo (los vídeos, el audio, los .zip): si la tuya lo es (se
le pregunta a Neocities), esos ni se intentan y se dice cuáles son. Y si
aun así una tanda falla por algún archivo, se parte por la mitad (y la
mitad mala otra vez, hasta dar con él) en vez de probar de uno en uno:
pocas llamadas. Al final se dice qué no ha querido y por qué; lo demás
se sube igual.

BORRAR no se hace nunca sin --borrar, y aun así enseña la lista y
pregunta. Lo borrado en Neocities no se puede recuperar (aquí sigue
estando, claro: se puede volver a subir).

Sin nada que instalar: solo la biblioteca de Python.
"""

import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent.parent
# (Solo para probar el script contra un servidor de mentira.)
API = os.environ.get("NEOCITIES_URL_API", "https://neocities.org/api").rstrip("/")
ARCHIVO_DE_CLAVE = Path.home() / ".richiblog-neocities"

CARPETAS_QUE_NO = {"herramientas", "wiki"}
BASURA = {"__pycache__", "Thumbs.db", "desktop.ini", ".DS_Store"}
EXTENSIONES_QUE_NO = {".pyc", ".py"}
# Lo que una cuenta gratis de Neocities no deja subir (de lo que puede
# haber en una web como esta). Con cuenta de pago, todo.
SOLO_CON_CUENTA_DE_PAGO = {".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv", ".mp3", ".wav", ".ogg", ".oga",
                           ".flac", ".m4a", ".aac", ".zip", ".7z", ".rar", ".exe"}

TANDA_BYTES = 40 * 1024 * 1024
TANDA_ARCHIVOS = 100
PAUSA = 1.0  # segundos entre llamadas: sin agobiar a Neocities
INTENTOS = 3


# =========================================
# LA CLAVE
# =========================================

def leer_clave():
    clave = os.environ.get("NEOCITIES_API_KEY", "").strip()
    if clave:
        return clave
    try:
        return ARCHIVO_DE_CLAVE.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def pedir_clave():
    print("\n  Hace falta la clave de la API de Neocities.")
    print("  Está en Neocities: Settings (Ajustes) → tu sitio → pestaña «API».")
    print(f"  Se guardará en {ARCHIVO_DE_CLAVE} (fuera de la carpeta del sitio).\n")
    clave = input("  Pega aquí la clave y pulsa Intro: ").strip()
    if not clave:
        return ""
    ARCHIVO_DE_CLAVE.write_text(clave + "\n", encoding="utf-8")
    try:
        os.chmod(ARCHIVO_DE_CLAVE, 0o600)
    except OSError:
        pass
    return clave


# =========================================
# HABLAR CON NEOCITIES
# =========================================

class ErrorDeNeocities(Exception):
    def __init__(self, mensaje, tipo=""):
        super().__init__(mensaje)
        self.tipo = tipo


def llamar(clave, metodo, ruta, campos=None, cuerpo=None, tipo_cuerpo=None):
    """Una llamada a la API. Devuelve el JSON. Reintenta si se corta la
    conexión o Neocities da un error suyo (5xx); con un 4xx no, porque
    reintentar no lo arregla."""
    url = API + ruta
    datos = None
    cabeceras = {"Authorization": "Bearer " + clave, "User-Agent": "richiblog-subir/1"}
    if metodo == "GET" and campos:
        url += "?" + urllib.parse.urlencode(campos)
    elif cuerpo is not None:
        datos = cuerpo
        cabeceras["Content-Type"] = tipo_cuerpo
    elif campos is not None:
        datos = urllib.parse.urlencode(campos, doseq=True).encode("utf-8")
        cabeceras["Content-Type"] = "application/x-www-form-urlencoded"
    ultimo = None
    for intento in range(INTENTOS):
        peticion = urllib.request.Request(url, data=datos, headers=cabeceras, method=metodo)
        try:
            with urllib.request.urlopen(peticion, timeout=300) as r:
                return json.loads(r.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as e:
            try:
                respuesta = json.loads(e.read().decode("utf-8") or "{}")
            except ValueError:
                respuesta = {}
            mensaje = respuesta.get("message") or f"error {e.code}"
            if e.code == 403 or respuesta.get("error_type") == "invalid_auth":
                raise ErrorDeNeocities("Neocities no acepta la clave (" + mensaje + ").", "clave")
            if e.code < 500:
                raise ErrorDeNeocities(mensaje, respuesta.get("error_type", ""))
            ultimo = ErrorDeNeocities(mensaje, respuesta.get("error_type", ""))
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            ultimo = ErrorDeNeocities(f"no se pudo hablar con Neocities ({getattr(e, 'reason', e)})", "red")
        time.sleep(PAUSA * (intento + 2))
    raise ultimo


def multiparte(archivos):
    """El cuerpo multipart/form-data de /api/upload: un campo por archivo,
    que se llama como su ruta en el sitio."""
    frontera = "----richiblog" + uuid.uuid4().hex
    trozos = []
    for ruta, local in archivos:
        nombre = ruta.replace('"', "%22")
        trozos.append(("--" + frontera + "\r\n"
                       f'Content-Disposition: form-data; name="{nombre}"; filename="{nombre}"\r\n'
                       "Content-Type: application/octet-stream\r\n\r\n").encode("utf-8"))
        trozos.append(local.read_bytes())
        trozos.append(b"\r\n")
    trozos.append(("--" + frontera + "--\r\n").encode("utf-8"))
    return b"".join(trozos), "multipart/form-data; boundary=" + frontera


# =========================================
# LO DE AQUÍ Y LO DE ALLÍ
# =========================================

def archivos_del_sitio():
    """{ruta en el sitio: archivo}, con / aunque sea Windows."""
    salida = {}
    for carpeta, subcarpetas, nombres in os.walk(RAIZ):
        relativa = Path(carpeta).relative_to(RAIZ)
        subcarpetas[:] = sorted(
            s for s in subcarpetas
            if not s.startswith(".") and s not in BASURA
            and not (relativa == Path(".") and s in CARPETAS_QUE_NO))
        for nombre in sorted(nombres):
            if nombre.startswith(".") or nombre in BASURA or Path(nombre).suffix.lower() in EXTENSIONES_QUE_NO:
                continue
            local = Path(carpeta) / nombre
            salida[(relativa / nombre).as_posix()] = local
    return salida


def huella(local):
    h = hashlib.sha1()
    with open(local, "rb") as f:
        for trozo in iter(lambda: f.read(1 << 20), b""):
            h.update(trozo)
    return h.hexdigest()


def archivos_de_neocities(clave):
    respuesta = llamar(clave, "GET", "/list")
    return {f["path"]: f.get("sha1_hash", "") for f in respuesta.get("files", []) if not f.get("is_directory")}


def tandas(lista):
    tanda, peso = [], 0
    for ruta, local in lista:
        tam = local.stat().st_size
        if tanda and (peso + tam > TANDA_BYTES or len(tanda) >= TANDA_ARCHIVOS):
            yield tanda
            tanda, peso = [], 0
        tanda.append((ruta, local))
        peso += tam
    if tanda:
        yield tanda


def megas(n):
    return f"{n / (1024 * 1024):.1f} MB" if n >= 1024 * 1024 else f"{max(1, round(n / 1024))} KB"


def cuantos(n, uno, varios):
    return f"{n} {uno if n == 1 else varios}"


def preguntar(texto):
    try:
        return input(texto).strip().lower() in ("s", "si", "sí", "y", "yes")
    except EOFError:
        return False


# =========================================
# SUBIR Y BORRAR
# =========================================

def subir_tanda(clave, tanda, rechazados):
    """Sube una tanda; si Neocities no la quiere por algún archivo, la
    parte en dos y prueba cada mitad. Devuelve cuántos ha subido."""
    cuerpo, tipo = multiparte(tanda)
    try:
        llamar(clave, "POST", "/upload", cuerpo=cuerpo, tipo_cuerpo=tipo)
        return len(tanda)
    except ErrorDeNeocities as e:
        if e.tipo in ("clave", "red"):
            raise
        if len(tanda) == 1:
            rechazados.append((tanda[0][0], str(e)))
            return 0
    mitad = len(tanda) // 2
    hechos = 0
    for parte in (tanda[:mitad], tanda[mitad:]):
        time.sleep(PAUSA)
        hechos += subir_tanda(clave, parte, rechazados)
    return hechos


def subir(clave, lista):
    """Sube por tandas. Devuelve [(ruta, por qué no)] de lo que no quiso."""
    rechazados = []
    hechos = 0
    total = len(lista)
    for tanda in tandas(lista):
        hechos += subir_tanda(clave, tanda, rechazados)
        print(f"  Subidos {hechos} de {total}.")
        time.sleep(PAUSA)
    return rechazados


def borrar(clave, rutas):
    # De 50 en 50: si una ruta falla, Neocities cancela la tanda entera.
    for i in range(0, len(rutas), 50):
        llamar(clave, "POST", "/delete", campos={"filenames[]": rutas[i:i + 50]})
        time.sleep(PAUSA)


def principal(argumentos):
    ensayo = "--ensayo" in argumentos
    con_borrar = "--borrar" in argumentos
    print("\n  SUBIR EL SITIO A NEOCITIES\n")

    clave = "" if "--clave" in argumentos else leer_clave()
    if not clave:
        clave = pedir_clave()
        if not clave:
            print("  Sin clave no se puede. No se ha subido nada.\n")
            return 1

    print("  Mirando lo que hay en Neocities…")
    try:
        alli = archivos_de_neocities(clave)
    except ErrorDeNeocities as e:
        print(f"\n  {e}")
        if e.tipo == "clave":
            print("  Vuelve a ponerla con:  python herramientas/1-publicar/subir-neocities.py --clave")
        print()
        return 1

    print("  Mirando lo que hay aquí…")
    aqui = archivos_del_sitio()
    nuevos, cambiados = [], []
    for ruta, local in aqui.items():
        if ruta not in alli:
            nuevos.append((ruta, local))
        elif alli[ruta] != huella(local):
            cambiados.append((ruta, local))
    sobran = sorted(r for r in alli if r not in aqui and r != "index.html")
    lista = nuevos + cambiados
    # Con cuenta gratis, lo que Neocities no deja subir se aparta.
    apartados = []
    try:
        de_pago = bool(llamar(clave, "GET", "/info").get("info", {}).get("supporter"))
    except ErrorDeNeocities:
        de_pago = False
    if not de_pago:
        apartados = [(r, l) for r, l in lista if Path(r).suffix.lower() in SOLO_CON_CUENTA_DE_PAGO]
        lista = [x for x in lista if x not in apartados]
        nuevos = [x for x in nuevos if x not in apartados]
    peso = sum(local.stat().st_size for _, local in lista)

    print(f"\n  En tu ordenador: {len(aqui)} archivos. En Neocities: {len(alli)}.")
    print(f"  Nuevos: {len(nuevos)}. Cambiados: {len(cambiados)}. Iguales: {len(aqui) - len(lista) - len(apartados)}.")
    if lista:
        print(f"  A subir: {len(lista)} ({megas(peso)}).")
        for ruta, _ in lista[:40]:
            print("    " + ("+ " if (ruta, aqui[ruta]) in nuevos else "~ ") + ruta)
        if len(lista) > 40:
            print(f"    … y {len(lista) - 40} más.")
    if apartados:
        print(f"\n  Sin subir, porque tu cuenta de Neocities es gratis y no los admite: {len(apartados)}.")
        for ruta, _ in apartados:
            print("    · " + ruta)
    if sobran:
        print(f"\n  En Neocities hay {cuantos(len(sobran), 'archivo que ya no está', 'archivos que ya no están')} aquí"
              + (":" if con_borrar else " (se quedan; para borrarlos, --borrar)."))
        if con_borrar:
            for ruta in sobran[:60]:
                print("    - " + ruta)
            if len(sobran) > 60:
                print(f"    … y {len(sobran) - 60} más.")

    if ensayo:
        print("\n  Era un ensayo: no se ha subido ni borrado nada.\n")
        return 0
    if not lista and not (con_borrar and sobran):
        print("\n  Neocities ya está al día. Nada que subir.\n")
        return 0

    rechazados = []
    if lista:
        if not preguntar("\n  ¿Subo " + ("ese archivo" if len(lista) == 1 else f"esos {len(lista)} archivos") + "? (s/n): "):
            print("  Vale, no se ha subido nada.\n")
            return 0
        print()
        try:
            rechazados = subir(clave, lista)
        except ErrorDeNeocities as e:
            print(f"\n  Se ha parado: {e}")
            print("  Lo ya subido, subido está. Vuelve a lanzarlo y seguirá con lo que falte.\n")
            return 1
    if con_borrar and sobran:
        if preguntar("\n  ¿Borro de Neocities " + ("ese archivo" if len(sobran) == 1 else f"esos {len(sobran)} archivos")
                     + "? No se puede deshacer allí (s/n): "):
            try:
                borrar(clave, sobran)
                print(f"  Borrados {len(sobran)}.")
            except ErrorDeNeocities as e:
                print(f"  No se ha podido borrar: {e}")
        else:
            print("  Vale, no se ha borrado nada.")

    if rechazados:
        print(f"\n  Neocities no ha querido {len(rechazados)}:")
        for ruta, por_que in rechazados:
            print(f"    {ruta}: {por_que}")
        print("  (Las cuentas gratis no admiten algunos tipos de archivo, como los vídeos.)")
    print(f"\n  Listo: {len(lista) - len(rechazados)} subidos.\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(principal(sys.argv[1:]))
    except KeyboardInterrupt:
        print("\n  Parado. Lo ya subido, subido está.\n")
        sys.exit(1)
