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
#     CÁMBIALO SI QUIERES (para traducirlo): las fichas salen con el nuevo.
#   · original: como lo llama D&D Beyond («Fireball»). Lo pone el
#     importador y NO SE CAMBIA: es por lo que se sabe que «Fireball» es
#     tu «Bola de fuego» al importar otra vez (o un personaje nuevo), que
#     así sale ya con tu nombre y no se añade otra vez en inglés.
#   · otros_nombres: los nombres que ha tenido antes (los apunta solo el
#     editor al cambiarle el nombre). Una ficha que aún diga uno de esos,
#     o el original, sale con el de ahora.
#   · imagen (solo los objetos): la suya, para el inventario de todas las
#     fichas que lo tengan (manda sobre la que se baje de D&D Beyond).
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


def nombres(x):
    """Todos los nombres de una entrada: el de ahora, el de D&D Beyond y
    los que tuvo antes (sin repetir; el de ahora, el primero)."""
    salida = []
    for n in [x.get("nombre"), x.get("original")] + list(x.get("otros_nombres") or []):
        n = str(n or "").strip()
        if n and llano(n) not in {llano(y) for y in salida}:
            salida.append(n)
    return salida


def por_nombre(tipo):
    """{nombre sin tildes: entrada} de un tipo: por el nombre de ahora y
    también por el original y los de antes (el de ahora manda)."""
    lista = leer(tipo)
    salida = {}
    for x in lista:
        salida.setdefault(llano(x["nombre"]), x)
    for x in lista:
        for n in nombres(x)[1:]:
            salida.setdefault(llano(n), x)
    return salida


def renombres():
    """{nombre sin tildes: nombre de ahora}: el de ahora (así una ficha que
    lo escriba con otras mayúsculas o sin tildes sale como en el
    compendio), y el de D&D Beyond y los de antes de cada entrada (de todos
    los tipos). Si un nombre viejo de una es el de ahora de otra, manda el
    de ahora."""
    salida = {}
    todas = [x for tipo in TIPOS for x in leer(tipo)]
    for x in todas:
        salida.setdefault(llano(x["nombre"]), x["nombre"])
    for x in todas:
        for n in nombres(x)[1:]:
            salida.setdefault(llano(n), x["nombre"])
    return salida


def anadir(tipo, entradas):
    """Añade las que no están (por cualquiera de sus nombres); las que ya
    están no se tocan. Devuelve cuántas ha añadido."""
    lista = leer(tipo)
    ya = {llano(n) for x in lista for n in nombres(x)}
    nuevas = 0
    for x in entradas:
        nombre = str(x.get("nombre") or "").strip()
        original = str(x.get("original") or "").strip()
        if not nombre or llano(nombre) in ya or (original and llano(original) in ya):
            continue
        ya.update({llano(nombre), llano(original)} - {""})
        nueva = {"nombre": nombre}
        if original:
            nueva["original"] = original
        nueva.update({"datos": str(x.get("datos") or "").strip(), "texto": str(x.get("texto") or "").strip()})
        lista.append(nueva)
        nuevas += 1
    if nuevas:
        guardar(tipo, lista)
    return nuevas


# =========================================
# LOS NOMBRES DE UN PERSONAJE, CON LOS DEL COMPENDIO
# =========================================
# Si en el compendio le has cambiado el nombre a algo («Starry Wisp» ->
# «Luciérnaga estelar»), en la ficha de cada personaje que lo tenga se
# cambia también, en los sitios donde va un nombre: los conjuros
# («Truco: Starry Wisp»), los objetos («Ring of the Ram [equipado]»), los
# ataques («Garrote: +6, …»), las acciones («Acción: Lay on Hands Pool (25
# usos…)»), los rasgos («- **Feat** (…)») y las descripciones («##
# Starry Wisp», «Origen: Por Star Map (…)», «Origen: Objeto: …»). Solo si
# el nombre es ENTERO el de antes (no se toca una palabra suelta dentro de
# un texto). Lo usan generar-personajes.py (las fichas salen siempre con
# los nombres de ahora) y el editor (al guardar el compendio, y en los
# personajes que importa).

def _cambiar_nombre(nombre, mapa):
    """El nombre de ahora de «nombre» (o el mismo). Prueba entero y, si no,
    quitando lo de entre paréntesis del final («Lay on Hands Pool (25
    usos, descanso largo)»), que se queda detrás."""
    resto = ""
    actual = nombre
    while actual.strip():
        nuevo = mapa.get(llano(actual.strip()))
        if nuevo:
            sobra = actual[len(actual.rstrip()):]
            return nuevo + sobra + resto
        m = re.match(r"^(.*?)(\s*\([^()]*\))$", actual)
        if not m:
            break
        actual, resto = m.group(1), m.group(2) + resto
    return nombre


def _linea(linea, mapa, con_prefijo):
    """Una línea de lista: «Prefijo: Nombre…» (conjuros, acciones),
    «Nombre: …» (ataques) o «Nombre [lo que sea] ×2» (objetos)."""
    if con_prefijo == "antes":
        prefijo, dos, nombre = linea.partition(": ")
        if not dos:
            return linea
        return prefijo + dos + _cambiar_nombre(nombre, mapa)
    if con_prefijo == "ataque":
        nombre, dos, resto = linea.partition(":")
        return _cambiar_nombre(nombre, mapa) + dos + resto if dos else _cambiar_nombre(linea, mapa)
    m = re.match(r"^(.*?)(\s*(?:\[[^\]]*\])?\s*(?:[×x]\s*\d+)?\s*)$", linea)
    nombre, cola = (m.group(1), m.group(2)) if m else (linea, "")
    return _cambiar_nombre(nombre, mapa) + cola


def traducir_personaje(p, mapa=None):
    """Cambia en el personaje «p» (un dict de personajes.json) los nombres
    de antes por los de ahora. Devuelve cuántos ha cambiado."""
    mapa = renombres() if mapa is None else mapa
    if not mapa or not isinstance(p, dict):
        return 0
    cambios = [0]

    def lista(clave, modo):
        v = p.get(clave)
        if isinstance(v, list):
            nueva = [_linea(x, mapa, modo) if isinstance(x, str) else x for x in v]
        elif isinstance(v, str) and v.strip():
            nueva = "\n".join(_linea(x, mapa, modo) for x in v.split("\n"))
        else:
            return
        if nueva != v:
            cambios[0] += sum(1 for a, b in zip(v if isinstance(v, list) else v.split("\n"),
                                                nueva if isinstance(nueva, list) else nueva.split("\n")) if a != b)
            p[clave] = nueva

    lista("conjuros", "antes")
    lista("acciones", "antes")
    lista("ataques", "ataque")
    lista("objetos", "objeto")

    def en_texto(clave, patron, grupo):
        v = p.get(clave)
        if not isinstance(v, str):
            return

        def una(m):
            nuevo = _cambiar_nombre(m.group(grupo), mapa)
            if nuevo == m.group(grupo):
                return m.group(0)
            cambios[0] += 1
            return m.group(0)[:m.start(grupo) - m.start(0)] + nuevo + m.group(0)[m.end(grupo) - m.start(0):]
        p[clave] = re.sub(patron, una, v)

    # Rasgos: «- **Nombre** (…)» o «- **Nombre.** Lo que hace.»
    en_texto("rasgos", r"\*\*([^*\n]+?)\.?\*\*", 1)
    en_texto("descripciones", r"(?m)^## (.+?)\s*$", 1)
    en_texto("descripciones", r"(?m)^(?:Origen|origen)\s*:\s*Por (.+?) \((?=[^()]*\)\s*$)", 1)
    en_texto("descripciones", r"(?m)^(?:Origen|origen)\s*:\s*Objeto: (.+?)\s*$", 1)
    return cambios[0]


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
