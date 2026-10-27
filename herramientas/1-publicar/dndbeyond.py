#!/usr/bin/env python3
# =========================================
# TRAER UN PERSONAJE DE D&D BEYOND (en español)
# =========================================
# Lo usa el editor, en Rol → «Mis personajes», con el botón «Importar de
# D&D Beyond» de cada personaje: rellena su ficha (lo de la pestaña
# «ficha» y el post-it) con lo que tenga en D&D Beyond, pasado al español
# con herramientas/dnd_es.py. No guarda nada: deja las casillas rellenas
# para que las repases y guardes tú.
#
# DE DÓNDE LO SACA. Vale cualquiera de estas tres cosas:
#   · el enlace de la ficha: https://www.dndbeyond.com/characters/12345678
#   · solo el número: 12345678
#   · el JSON entero, pegado (si no se puede bajar: ábrelo en el navegador
#     en https://character-service.dndbeyond.com/character/v5/character/
#     12345678, copia todo y pégalo).
# Para bajarlo, la ficha tiene que ser PÚBLICA en D&D Beyond (en la ficha:
# Manage → Character Settings → Character Privacy: Public).
#
# LO QUE CALCULA, con lo que trae: las características (con lo que suman la
# raza, el trasfondo, las dotes y los objetos), los puntos de golpe, la CA
# (armadura y escudo puestos, y lo que sumen los objetos: repásala, que
# los rasgos de clase como «Defensa sin armadura» no los cuenta), la
# velocidad en metros, las salvaciones y habilidades en las que es
# competente (y con pericia), los idiomas y demás competencias, la aptitud
# mágica, los espacios de conjuro (los de la tabla de su clase), los
# conjuros por nivel, las armas que lleva puestas como ataques, los
# objetos, el dinero, y los rasgos y dotes por su nombre.
#
# Probarlo sin editor (con un JSON guardado o un número):
#     python herramientas/1-publicar/dndbeyond.py ficha.json

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dnd_es import CARACTERISTICA_DE_NOMBRE, CARACTERISTICAS, HABILIDADES, Traductor  # noqa: E402

URL_DE_LA_API = "https://character-service.dndbeyond.com/character/v5/character/%s"

# Lo que no aporta nada como rasgo (ya sale en otro sitio de la ficha).
RASGOS_QUE_SOBRAN = {"ability score increase", "ability score improvement", "age", "size", "speed", "languages",
                     "proficiencies", "hit points", "alignment", "creature type", "equipment"}

ALINEAMIENTOS = {1: "Legal bueno", 2: "Neutral bueno", 3: "Caótico bueno", 4: "Legal neutral", 5: "Neutral",
                 6: "Caótico neutral", 7: "Legal malvado", 8: "Neutral malvado", 9: "Caótico malvado"}


class ErrorDeImportacion(Exception):
    pass


# =========================================
# CONSEGUIR EL JSON
# =========================================

def obtener(texto):
    """El personaje (el «data» del JSON de D&D Beyond) a partir de un
    enlace, un número o el JSON pegado."""
    texto = str(texto or "").strip()
    if not texto:
        raise ErrorDeImportacion("Pega el enlace de la ficha de D&D Beyond (o su número, o el JSON).")
    if texto.startswith("{"):
        try:
            crudo = json.loads(texto)
        except ValueError:
            raise ErrorDeImportacion("Lo pegado empieza como un JSON pero no lo entiendo: ¿está entero?")
    else:
        numero = re.search(r"(?:characters?/|^)(\d{4,})", texto)
        if not numero:
            raise ErrorDeImportacion("No encuentro el número del personaje en eso. Vale el enlace de la ficha"
                                     " (dndbeyond.com/characters/12345678) o el número solo.")
        peticion = urllib.request.Request(URL_DE_LA_API % numero.group(1), headers={
            "User-Agent": "Mozilla/5.0 (editor de richi.blog)", "Accept": "application/json"})
        try:
            with urllib.request.urlopen(peticion, timeout=20) as respuesta:
                crudo = json.loads(respuesta.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            if error.code in (401, 403, 404):
                raise ErrorDeImportacion("D&D Beyond no me deja verlo (%d). ¿Es pública la ficha? En la ficha:"
                                         " Manage → Character Settings → Character Privacy: Public." % error.code)
            raise ErrorDeImportacion("D&D Beyond ha contestado con un error (%d)." % error.code)
        except (urllib.error.URLError, OSError, ValueError) as error:
            raise ErrorDeImportacion("No he podido hablar con D&D Beyond (%s). Si no hay manera, pega el JSON"
                                     " entero." % getattr(error, "reason", error))
    datos = crudo.get("data", crudo) if isinstance(crudo, dict) else None
    if not isinstance(datos, dict) or not datos.get("stats"):
        raise ErrorDeImportacion("Eso no parece la ficha de un personaje de D&D Beyond.")
    return datos


# =========================================
# DE D&D BEYOND A LA FICHA DEL SITIO
# =========================================

def _modificadores(d):
    return [m for lista in (d.get("modifiers") or {}).values() for m in (lista or []) if isinstance(m, dict)]


def _objetos_puestos(d):
    """Los id de los objetos que lleva puestos (y sintonizados si lo
    piden): solo lo que suman ESOS cuenta."""
    puestos = set()
    for i in d.get("inventory") or []:
        defin = i.get("definition") or {}
        if i.get("equipped") and (not defin.get("canAttune") or i.get("isAttuned")):
            puestos.add(defin.get("id"))
    return puestos


def _cuentan(d):
    """Los modificadores que cuentan: los de raza, clase, trasfondo, dotes y
    condiciones siempre; los de objetos, solo de los que lleva puestos."""
    puestos = _objetos_puestos(d)
    salida = []
    for origen, lista in (d.get("modifiers") or {}).items():
        for m in lista or []:
            if origen == "item" and m.get("componentId") not in puestos:
                continue
            salida.append(m)
    return salida


def puntuaciones(d):
    base = {s["id"]: s.get("value") or 10 for s in d.get("stats") or []}
    extra = {s["id"]: s.get("value") or 0 for s in d.get("bonusStats") or []}
    fijas = {s["id"]: s.get("value") for s in d.get("overrideStats") or [] if s.get("value")}
    suma = {i: 0 for i in range(1, 7)}
    minimo = {i: 0 for i in range(1, 7)}
    for m in _cuentan(d):
        sub = str(m.get("subType") or "")
        if not sub.endswith("-score"):
            continue
        i = CARACTERISTICA_DE_NOMBRE.get(sub[:-len("-score")])
        if not i:
            continue
        if m.get("type") == "bonus":
            suma[i] += m.get("value") or 0
        elif m.get("type") == "set":
            minimo[i] = max(minimo[i], m.get("value") or 0)
    salida = {}
    for i in range(1, 7):
        valor = fijas.get(i) or (base.get(i, 10) + extra.get(i, 0) + suma[i])
        salida[i] = max(valor, minimo[i])
    return salida


def mod(valor):
    return (valor - 10) // 2


def con_signo(n):
    return ("+%d" % n) if n >= 0 else ("−%d" % -n)


def a_ficha(d, traducir=None):
    """El personaje de D&D Beyond como las casillas de «Mis personajes».
    Devuelve (campos, avisos)."""
    t = traducir or Traductor()
    avisos = []
    stats = puntuaciones(d)
    mods = {i: mod(v) for i, v in stats.items()}
    clases = [c for c in d.get("classes") or [] if isinstance(c, dict)]
    nivel = sum(int(c.get("level") or 0) for c in clases) or 1
    comp = 2 + (min(nivel, 20) - 1) // 4
    modificadores = _cuentan(d)

    campos = {"nombre_completo": str(d.get("name") or "").strip()}
    campos["nombre"] = campos["nombre_completo"].split(" ")[0] if campos["nombre_completo"] else ""
    raza = (d.get("race") or {}).get("fullName") or (d.get("race") or {}).get("baseName") or ""
    campos["raza"] = t(raza)
    partes = []
    for c in clases:
        nombre = t((c.get("definition") or {}).get("name"))
        sub = (c.get("subclassDefinition") or {}).get("name")
        texto = nombre + (" (%s)" % t(sub) if sub else "")
        if len(clases) > 1:
            texto += " %d" % int(c.get("level") or 0)
        partes.append(texto)
    campos["clase"] = " / ".join(partes)
    campos["nivel"] = nivel
    for i, (clave, _) in CARACTERISTICAS.items():
        campos[clave] = stats[i]

    # PUNTOS DE GOLPE: los de la tirada, más la Constitución por nivel, más
    # lo que sumen dotes y rasgos (por nivel o de una vez).
    if d.get("overrideHitPoints"):
        pg = d["overrideHitPoints"]
    else:
        pg = (d.get("baseHitPoints") or 0) + (d.get("bonusHitPoints") or 0) + mods[3] * nivel
        for m in modificadores:
            if m.get("type") == "bonus" and m.get("subType") == "hit-points-per-level":
                pg += (m.get("value") or 0) * nivel
            elif m.get("type") == "bonus" and m.get("subType") == "hit-points":
                pg += m.get("value") or 0
    campos["pg"] = str(pg)

    # LA CLASE DE ARMADURA: la armadura puesta (ligera: toda la Destreza;
    # intermedia: hasta +2; pesada: nada), el escudo, y lo que sumen los
    # objetos puestos. Sin armadura, 10 + Destreza.
    armadura, escudo = None, 0
    for i in d.get("inventory") or []:
        defin = i.get("definition") or {}
        if not i.get("equipped") or not defin.get("armorClass"):
            continue
        if defin.get("armorTypeId") == 4:
            escudo += defin["armorClass"]
        elif defin.get("armorTypeId") in (1, 2, 3):
            armadura = defin
    if armadura:
        des = {1: mods[2], 2: min(2, mods[2]), 3: 0}[armadura["armorTypeId"]]
        ca = armadura["armorClass"] + des
    else:
        ca = 10 + mods[2]
    ca += escudo + sum(m.get("value") or 0 for m in modificadores
                       if m.get("type") == "bonus" and m.get("subType") == "armor-class")
    campos["ca"] = str(ca)
    nombres_de_clase = {str((c.get("definition") or {}).get("name") or "").lower() for c in clases}
    if not armadura and nombres_de_clase & {"barbarian", "monk"}:
        avisos.append("La CA puede ser otra: «Defensa sin armadura» no la cuento. Repásala.")

    pies = (((d.get("race") or {}).get("weightSpeeds") or {}).get("normal") or {}).get("walk") or 30
    campos["velocidad"] = ("%g m" % round(pies * 0.3, 1)).replace(".", ",")
    dados = []
    for c in clases:
        caras = (c.get("definition") or {}).get("hitDice")
        if caras:
            dados.append("%dd%d" % (int(c.get("level") or 0), caras))
    campos["dados_golpe"] = " + ".join(dados)

    # COMPETENCIAS: salvaciones, habilidades (con pericia), idiomas y lo demás.
    salvaciones, habilidades, pericias, idiomas, otras = [], [], set(), [], []
    for m in modificadores:
        tipo, sub = m.get("type"), str(m.get("subType") or "")
        nombre = m.get("friendlySubtypeName") or sub.replace("-", " ").title()
        if tipo == "proficiency" and sub.endswith("-saving-throws"):
            i = CARACTERISTICA_DE_NOMBRE.get(sub[:-len("-saving-throws")])
            if i and CARACTERISTICAS[i][1] not in salvaciones:
                salvaciones.append(CARACTERISTICAS[i][1])
        elif tipo in ("proficiency", "expertise") and sub in HABILIDADES:
            if HABILIDADES[sub] not in habilidades:
                habilidades.append(HABILIDADES[sub])
            if tipo == "expertise":
                pericias.add(HABILIDADES[sub])
        elif tipo == "language":
            nombre = t(nombre)
            if nombre not in idiomas:
                idiomas.append(nombre)
        elif tipo == "proficiency" and sub not in ("self",) and not sub.endswith("saving-throws"):
            nombre = t(nombre)
            if nombre not in otras:
                otras.append(nombre)
    campos["salvaciones"] = ", ".join(i for _, i in sorted(
        (n, CARACTERISTICAS[n][1]) for n in range(1, 7) if CARACTERISTICAS[n][1] in salvaciones))
    campos["habilidades"] = [h + (" (pericia)" if h in pericias else "") for h in sorted(habilidades)]
    campos["competencias"] = ["Idiomas: " + ", ".join(idiomas)] if idiomas else []
    campos["competencias"] += otras

    # LA MAGIA: la característica de su clase (la primera que lance), los
    # espacios de su tabla y los conjuros, por nivel y sin repetir.
    lanzadora = next((c for c in clases if (c.get("definition") or {}).get("canCastSpells")), None)
    if lanzadora:
        apt = (lanzadora.get("definition") or {}).get("spellCastingAbilityId")
        if apt in CARACTERISTICAS:
            campos["aptitud_magica"] = CARACTERISTICAS[apt][0]
        tabla = ((lanzadora.get("definition") or {}).get("spellRules") or {}).get("levelSpellSlots") or []
        nivel_clase = int(lanzadora.get("level") or 0)
        if len(clases) == 1 and 0 <= nivel_clase < len(tabla):
            campos["espacios"] = ["%d.º: %d" % (n + 1, x) for n, x in enumerate(tabla[nivel_clase]) if x]
        elif len(clases) > 1:
            avisos.append("Lleva varias clases: los espacios de conjuro los tienes que poner tú.")
    conjuros, vistos = [], set()
    listas = [s for cs in d.get("classSpells") or [] for s in (cs.get("spells") or [])]
    listas += [s for lista in (d.get("spells") or {}).values() for s in (lista or [])]
    for s in listas:
        defin = (s or {}).get("definition") or {}
        if not defin.get("name") or defin["name"] in vistos:
            continue
        vistos.add(defin["name"])
        nivel_c = int(defin.get("level") or 0)
        conjuros.append((nivel_c, "%s: %s" % ("Truco" if nivel_c == 0 else nivel_c, t(defin["name"]))))
    campos["conjuros"] = [c for _, c in sorted(conjuros, key=lambda x: (x[0], x[1]))]

    # LOS ATAQUES: las armas que lleva puestas, con su bono y su daño.
    ataques = []
    for i in d.get("inventory") or []:
        defin = i.get("definition") or {}
        dano = (defin.get("damage") or {}).get("diceString")
        if not i.get("equipped") or not dano:
            continue
        props = {str(p.get("name") or "").lower() for p in defin.get("properties") or []}
        distancia = defin.get("attackType") == 2
        car = mods[2] if distancia else mods[1]
        if "finesse" in props:
            car = max(mods[1], mods[2])
        ataques.append("%s: %s, %s%s %s" % (t(defin.get("name")), con_signo(comp + car), dano,
                                            con_signo(car) if car else "", t(defin.get("damageType") or "").lower()))
    campos["ataques"] = ataques

    # LOS OBJETOS Y EL DINERO.
    objetos = []
    for i in d.get("inventory") or []:
        defin = i.get("definition") or {}
        if not defin.get("name"):
            continue
        cuantos = int(i.get("quantity") or 0)
        objetos.append(t(defin["name"]) + (" ×%d" % cuantos if cuantos > 1 else ""))
    campos["objetos"] = objetos
    monedas = d.get("currencies") or {}
    dinero = ["%d %s" % (monedas[k], t(k)) for k in ("pp", "gp", "ep", "sp", "cp") if monedas.get(k)]
    campos["dinero"] = ", ".join(dinero)

    # LOS RASGOS Y LAS DOTES, por su nombre (las descripciones de D&D
    # Beyond vienen en inglés y con HTML: se escriben a mano si se quieren).
    rasgos = []
    for r in ((d.get("race") or {}).get("racialTraits") or []):
        nombre = ((r or {}).get("definition") or {}).get("name")
        if nombre and nombre.lower() not in RASGOS_QUE_SOBRAN:
            rasgos.append(("de raza", t(nombre)))
    for c in clases:
        for f in c.get("classFeatures") or []:
            defin = (f or {}).get("definition") or {}
            if defin.get("name") and int(defin.get("requiredLevel") or 1) <= int(c.get("level") or 0) \
                    and defin["name"].lower() not in RASGOS_QUE_SOBRAN:
                rasgos.append(("de clase", t(defin["name"])))
    for f in d.get("feats") or []:
        nombre = ((f or {}).get("definition") or {}).get("name")
        if nombre:
            rasgos.append(("dote", t(nombre)))
    vistos_r, lineas = set(), []
    for de, nombre in rasgos:
        if nombre not in vistos_r:
            vistos_r.add(nombre)
            lineas.append("- **%s** (%s)" % (nombre, de))
    trasfondo = ((d.get("background") or {}).get("definition") or {}).get("name")
    if trasfondo:
        lineas.insert(0, "**Trasfondo:** %s" % t(trasfondo))
    alineamiento = ALINEAMIENTOS.get(d.get("alignmentId"))
    if alineamiento:
        lineas.insert(1 if trasfondo else 0, "**Alineamiento:** %s" % alineamiento)
    # Trasfondo y alineamiento, cada uno en su párrafo; los rasgos, en lista.
    cabeza = [l for l in lineas if not l.startswith("- ")]
    lista = [l for l in lineas if l.startswith("- ")]
    campos["rasgos"] = "\n\n".join(cabeza + (["\n".join(lista)] if lista else []))

    # Lo que no se ha podido traducir: para cambiarlo a mano.
    if t.sin_traducir:
        avisos.append("Sin traducir (cámbialo a mano, o apúntalo en herramientas/dnd-es-propias.json para la"
                      " próxima): " + "; ".join(t.sin_traducir[:40]) + ("…" if len(t.sin_traducir) > 40 else ""))
    retrato = ((d.get("decorations") or {}).get("avatarUrl") or "").strip()
    return campos, avisos, retrato


def main():
    if len(sys.argv) < 2:
        print(__doc__ or "Uso: dndbeyond.py ficha.json | 12345678")
        return
    origen = sys.argv[1]
    texto = Path(origen).read_text(encoding="utf-8") if Path(origen).is_file() else origen
    try:
        campos, avisos, _ = a_ficha(obtener(texto))
    except ErrorDeImportacion as error:
        print("  " + str(error))
        sys.exit(1)
    print(json.dumps(campos, ensure_ascii=False, indent=2))
    for aviso in avisos:
        print("  · " + aviso)


if __name__ == "__main__":
    main()
