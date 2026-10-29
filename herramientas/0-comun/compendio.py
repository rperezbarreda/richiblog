# =========================================
# EL COMPENDIO DE D&D DE MIS PERSONAJES
# =========================================
# Lo que se cuenta de cada conjuro, objeto, rasgo o acción (sus datos y su
# texto) está UNA VEZ, compartido por todos mis personajes, en un JSON por
# cada cosa:
#
#     datos/personajes/compendio/conjuros.json
#     datos/personajes/compendio/objetos.json     (también las armas)
#     datos/personajes/compendio/rasgos.json      (de raza, de clase, dotes)
#     datos/personajes/compendio/acciones.json    (las de clase, raza…)
#
# Cada uno es {"<tipo>": [{"nombre": …, "datos": …, "texto": …}, …]}:
#   · nombre: como sale en la ficha («Bola de fuego»). Se busca sin mirar
#     mayúsculas ni tildes, y sin lo de entre paréntesis del final.
#   · datos: lo de las pastillitas, separado por «·» («Nivel 3 ·
#     Evocación · 1 acción · 45 m · V, S, M (guano) · Instantáneo»).
#   · texto: lo que hace, con formato (Markdown).
# Si cambias una, cambia en TODAS las fichas que la tengan. Se pueden
# editar a mano o en el editor (Rol → «Compendio: …»).
#
# En cada personaje se queda solo lo suyo: de dónde le viene cada cosa
# («Origen: Hechicero, nivel 3») en su campo «descripciones»; y si allí
# escribes también un texto, ese manda para ese personaje (para cambiarle
# algo solo a él).
#
# Lo usan generar-personajes.py (para pintar las fichas) y el editor
# (importar de D&D Beyond añade al compendio lo que aún no está, sin
# tocar lo que ya hay).

import json
import re
import unicodedata

from comun import RAIZ

CARPETA = RAIZ / "datos" / "personajes" / "compendio"
TIPOS = ("conjuros", "objetos", "rasgos", "acciones")


def llano(texto):
    texto = unicodedata.normalize("NFD", str(texto or "")).lower()
    return " ".join("".join(ch for ch in texto if unicodedata.category(ch) != "Mn").split())


def archivo(tipo):
    return CARPETA / ("%s.json" % tipo)


def leer(tipo):
    """La lista de un tipo, tal cual está en su JSON."""
    try:
        datos = json.loads(archivo(tipo).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    lista = datos.get(tipo) if isinstance(datos, dict) else None
    return [x for x in lista or [] if isinstance(x, dict) and str(x.get("nombre") or "").strip()]


def guardar(tipo, lista):
    CARPETA.mkdir(parents=True, exist_ok=True)
    lista = sorted(lista, key=lambda x: llano(x.get("nombre")))
    texto = json.dumps({tipo: lista}, ensure_ascii=False, indent=4) + "\n"
    archivo(tipo).write_text(texto, encoding="utf-8")


def por_nombre(tipo):
    """{nombre sin tildes: entrada} de un tipo."""
    salida = {}
    for x in leer(tipo):
        salida.setdefault(llano(x["nombre"]), x)
    return salida


def anadir(tipo, entradas):
    """Añade las que no están (por el nombre); las que ya están no se
    tocan. Devuelve cuántas ha añadido."""
    lista = leer(tipo)
    ya = {llano(x["nombre"]) for x in lista}
    nuevas = 0
    for x in entradas:
        nombre = str(x.get("nombre") or "").strip()
        if not nombre or llano(nombre) in ya:
            continue
        ya.add(llano(nombre))
        lista.append({"nombre": nombre, "datos": str(x.get("datos") or "").strip(),
                      "texto": str(x.get("texto") or "").strip()})
        nuevas += 1
    if nuevas:
        guardar(tipo, lista)
    return nuevas


def tipo_de_datos(datos):
    """Por sus datos, si es un conjuro («Truco», «Nivel 3…») o un objeto
    (una rareza, «lo lleva puesto», un tipo de objeto); si no, None."""
    trozos = [llano(x) for x in str(datos or "").split("·") if x.strip()]
    if trozos and (trozos[0] == "truco" or re.match(r"^nivel \d", trozos[0])):
        return "conjuros"
    if any(x in ("comun", "poco comun", "raro", "muy raro", "legendario", "artefacto", "lo lleva puesto")
           or "sintoniz" in x for x in trozos):
        return "objetos"
    return None
