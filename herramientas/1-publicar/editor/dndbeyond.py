#!/usr/bin/env python3
# =========================================
# TRAER UN PERSONAJE DE D&D BEYOND (en español)
# =========================================
# Lo usa el editor, en Rol → «Mis personajes», con el botón «Importar de
# D&D Beyond» de cada personaje: rellena su ficha (lo de la pestaña
# «ficha» y el post-it) con lo que tenga en D&D Beyond, pasado al español
# con herramientas/0-comun/dnd_es.py. No guarda nada: deja las casillas rellenas
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
#     python herramientas/1-publicar/editor/dndbeyond.py ficha.json

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "0-comun"))

from dnd_es import CARACTERISTICA_DE_NOMBRE, CARACTERISTICAS, HABILIDADES, Traductor  # noqa: E402

URL_DE_LA_API = "https://character-service.dndbeyond.com/character/v5/character/%s"

# Lo que no aporta nada como rasgo (ya sale en otro sitio de la ficha).
RASGOS_QUE_SOBRAN = {"ability score increase", "ability score increases", "ability score improvement", "age", "size", "speed", "languages",
                     "proficiencies", "hit points", "alignment", "creature type", "equipment"}

SENTIDOS = {"darkvision": "Visión en la oscuridad", "blindsight": "Vista ciega", "tremorsense": "Sentido de la vibración",
            "truesight": "Visión verdadera"}
DEFENSAS = {"resistance": "Resistencia", "immunity": "Inmunidad", "vulnerability": "Vulnerabilidad"}
TIPOS_DE_ACCION = {1: "Acción", 3: "Acción adicional", 4: "Reacción", 6: "Minutos", 7: "Horas", 8: "Especial"}
# Cuándo se recuperan los usos (limitedUse.resetType de D&D Beyond).
RECARGAS = {1: "descanso corto", 2: "descanso largo", 3: "al amanecer", 4: "otra"}

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


def _altura(texto):
    """«5'9''» (pies y pulgadas) -> «1,75 m». Lo que no entienda, igual."""
    texto = str(texto or "").strip()
    m = re.search(r"(\d+)\s*'\s*(\d+)?", texto)
    if not m:
        return texto
    metros = int(m.group(1)) * 0.3048 + int(m.group(2) or 0) * 0.0254
    return ("%.2f m" % metros).replace(".", ",")


def _peso(texto):
    """«160» o «160 lb» (libras) -> «73 kg». Lo que no entienda, igual."""
    texto = str(texto or "").strip()
    m = re.match(r"^(\d+(?:\.\d+)?)\s*(?:lbs?\.?)?$", texto, re.I)
    return "%d kg" % round(float(m.group(1)) * 0.4536) if m else texto


def mod(valor):
    return (valor - 10) // 2


def con_signo(n):
    return ("+%d" % n) if n >= 0 else ("−%d" % -n)


# =========================================
# LAS DESCRIPCIONES (lo que sale al desplegar)
# =========================================
# De cada conjuro, acción, rasgo, dote y objeto mágico o puesto: su texto
# entero (D&D Beyond lo da en HTML y en inglés: se pasa a Markdown y se
# deja en inglés, para traducirlo a mano en el editor si se quiere), de
# dónde le viene («Hechicero, nivel 3», «Raza: Semielfo», «Dote»…) y, en
# los conjuros, sus datos (nivel, escuela, tiempo, alcance, componentes y
# duración). Todo va en el campo «descripciones», un bloque por cosa:
#     ## Escudo
#     Origen: Lista de Hechicero
#     Datos: Nivel 1 · Abjuración · 1 reacción · Personal · V, S · 1 asalto
#     El texto…
# generar-personajes.py los busca por el nombre y los pone desplegables.

from html.parser import HTMLParser  # noqa: E402

ESCUELAS = {"abjuration": "Abjuración", "conjuration": "Conjuración", "divination": "Adivinación",
            "enchantment": "Encantamiento", "evocation": "Evocación", "illusion": "Ilusión",
            "necromancy": "Nigromancia", "transmutation": "Transmutación"}
TIEMPOS = {1: ("acción", "acciones"), 3: ("acción adicional", "acciones adicionales"),
           4: ("reacción", "reacciones"), 6: ("minuto", "minutos"), 7: ("hora", "horas"),
           8: ("especial", "especial")}
UNIDADES = {"round": ("asalto", "asaltos"), "minute": ("minuto", "minutos"), "hour": ("hora", "horas"),
            "day": ("día", "días")}
AREAS = {"cone": "cono", "cube": "cubo", "cylinder": "cilindro", "line": "línea", "sphere": "esfera",
         "square": "cuadrado", "emanation": "emanación"}
RAREZAS = {"common": "común", "uncommon": "poco común", "rare": "raro", "very rare": "muy raro",
           "legendary": "legendario", "artifact": "artefacto"}
COMPONENTES = {1: "V", 2: "S", 3: "M"}
TIPOS_DE_OBJETO = {"armor": "Armadura", "weapon": "Arma", "ring": "Anillo", "wondrous item": "Objeto maravilloso",
                   "wand": "Varita", "potion": "Poción", "scroll": "Pergamino", "rod": "Vara", "staff": "Bastón",
                   "ammunition": "Munición", "gear": "Equipo", "shield": "Escudo"}


def _metros(pies):
    return ("%g m" % round((pies or 0) * 0.3, 1)).replace(".", ",")


def _plural(n, formas):
    return "%s %s" % (n, formas[0] if n == 1 else formas[1])


class _AMarkdown(HTMLParser):
    """El HTML de las descripciones de D&D Beyond, en Markdown sencillo:
    párrafos, **negrita**, *cursiva*, listas, y las tablas como listas
    («- celda · celda»)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.trozos = []
        self.lista = 0
        self.primera_celda = False
        self.celda = 0

    def _salto(self, n=2):
        texto = "".join(self.trozos).rstrip(" ")
        # Justo detrás de un «- » (un <p> dentro de un <li>): sin salto.
        if texto.endswith("-") and texto.rstrip("-").endswith(("\n", "")) and texto[-2:-1] in ("\n", ""):
            self.trozos = [texto + " "]
            return
        self.trozos = [texto + "\n" * max(0, n - (len(texto) - len(texto.rstrip("\n"))))] if texto else []

    def handle_starttag(self, tag, attrs):
        # Dentro de una celda de tabla, los párrafos no parten la línea.
        if self.celda and tag in ("p", "div", "br", "ul", "ol", "li"):
            return
        if tag in ("p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "table"):
            self._salto()
            if tag.startswith("h") and len(tag) == 2:
                self.trozos.append("**")
        elif tag in ("ul", "ol"):
            self.lista += 1
            self._salto()
        elif tag in ("li", "tr"):
            self._salto(1)
            self.trozos.append("- ")
            self.primera_celda = tag == "tr"
        elif tag in ("td", "th"):
            self.celda += 1
            if self.primera_celda:
                self.primera_celda = False
            else:
                self.trozos.append(" · ")
        elif tag == "br":
            self._salto(1)
        elif tag in ("strong", "b"):
            self.trozos.append("**")
        elif tag in ("em", "i"):
            self.trozos.append("*")

    def handle_endtag(self, tag):
        if tag in ("td", "th"):
            self.celda = max(0, self.celda - 1)
            return
        if self.celda and tag in ("p", "div", "ul", "ol", "li"):
            return
        if tag in ("p", "div", "table"):
            self._salto()
        elif tag.startswith("h") and len(tag) == 2 and tag[1].isdigit():
            self.trozos.append("**")
            self._salto()
        elif tag in ("ul", "ol"):
            self.lista = max(0, self.lista - 1)
            self._salto()
        elif tag in ("strong", "b"):
            self.trozos.append("**")
        elif tag in ("em", "i"):
            self.trozos.append("*")

    def handle_data(self, data):
        data = re.sub(r"\s+", " ", data.replace("\xa0", " "))
        # El espacio suelto entre etiquetas, justo detrás de un «- » o de
        # un salto, sobra.
        if not data.strip() and "".join(self.trozos[-1:]).endswith((" ", "\n")):
            return
        self.trozos.append(data)

    def texto(self):
        texto = "".join(self.trozos)
        # La negrita o cursiva vacía, y con espacios por dentro, fuera.
        texto = texto.replace("****", "")
        texto = re.sub(r"\*\*(\s*)(.*?)(\s*)\*\*", lambda m: m.group(1) + ("**%s**" % m.group(2) if m.group(2) else "")
                       + m.group(3), texto)
        lineas = [re.sub(r" {2,}", " ", l.strip()) for l in texto.split("\n")]
        # Nada que empiece por «## » (es como se separan los bloques).
        lineas = [("\\" + l) if l.startswith("#") else l for l in lineas]
        return re.sub(r"\n{3,}", "\n\n", "\n".join(lineas)).strip()


def html_a_markdown(html):
    p = _AMarkdown()
    try:
        p.feed(str(html or ""))
        p.close()
    except Exception:  # noqa: BLE001 (un HTML raro: mejor sin formato que nada)
        return re.sub(r"<[^>]+>", " ", str(html or "")).strip()
    return p.texto()


def _plantillas(texto, valores):
    """Las cuentas que D&D Beyond deja escritas en las descripciones
    ({{limiteduse}}, {{proficiency#signed}}, {{(classlevel/2)@rounddown}},
    {{modifier:cha}}…), hechas con los números del personaje. Lo que no
    sepa hacer se queda como «?»."""
    def una(m):
        expr = m.group(1).strip()
        formato = ""
        if "#" in expr:
            expr, formato = expr.rsplit("#", 1)
        operaciones = expr.split("@")
        expr = operaciones[0]

        def valor(mm):
            nombre = mm.group(0)
            if nombre in valores:
                return str(valores[nombre])
            raise KeyError(nombre)
        try:
            expr = re.sub(r"[a-z]+(?::[a-z]+)?", valor, expr)
            if not re.fullmatch(r"[\d+\-*/(). ]+", expr):
                return "?"
            n = eval(expr, {"__builtins__": {}}, {})  # solo números y + - * / ( )
            for op in operaciones[1:]:
                if op == "rounddown":
                    n = int(n // 1)
                elif op == "roundup":
                    n = -int(-n // 1)
                elif op.startswith("min:"):
                    n = max(n, float(op[4:]))
                elif op.startswith("max:"):
                    n = min(n, float(op[4:]))
            n = int(n) if float(n).is_integer() else round(n, 1)
        except (KeyError, ValueError, SyntaxError, ZeroDivisionError, TypeError):
            return "?"
        return con_signo(n) if formato == "signed" else str(n)
    return re.sub(r"\{\{(.*?)\}\}", una, str(texto or ""))


def _datos_de_conjuro(defin, t):
    datos = []
    nivel = int(defin.get("level") or 0)
    escuela = ESCUELAS.get(str(defin.get("school") or "").lower()) or t(defin.get("school"))
    datos.append(("Truco" if nivel == 0 else "Nivel %d" % nivel) + (" · " + escuela if escuela else ""))
    act = defin.get("activation") or {}
    if act.get("activationType") in TIEMPOS:
        datos.append(_plural(act.get("activationTime") or 1, TIEMPOS[act["activationType"]]))
    alcance = defin.get("range") or {}
    origen = str(alcance.get("origin") or "").lower()
    texto = {"self": "Personal", "touch": "Toque", "sight": "A la vista", "unlimited": "Ilimitado"}.get(origen, "")
    if origen == "ranged" and alcance.get("rangeValue"):
        texto = _metros(alcance["rangeValue"])
    if alcance.get("aoeType") and alcance.get("aoeValue"):
        area = "%s de %s" % (AREAS.get(str(alcance["aoeType"]).lower()) or t(alcance["aoeType"]).lower(),
                             _metros(alcance["aoeValue"]))
        texto = ("%s (%s)" % (texto, area)) if texto else area
    if texto:
        datos.append(texto)
    comps = [COMPONENTES[c] for c in defin.get("components") or [] if c in COMPONENTES]
    if comps:
        datos.append(", ".join(comps) + (" (%s)" % defin["componentsDescription"].strip().rstrip(".")
                                         if "M" in comps and str(defin.get("componentsDescription") or "").strip()
                                         else ""))
    dur = defin.get("duration") or {}
    tipo = str(dur.get("durationType") or "").lower()
    unidad = UNIDADES.get(str(dur.get("durationUnit") or "").lower())
    cuanto = _plural(dur.get("durationInterval") or 1, unidad) if unidad else ""
    if tipo == "instantaneous":
        datos.append("Instantáneo")
    elif tipo == "concentration":
        datos.append("Concentración, hasta %s" % cuanto if cuanto else "Concentración")
    elif tipo == "time" and cuanto:
        datos.append(cuanto)
    elif "dispel" in tipo:
        datos.append("Hasta que se disipe")
    elif tipo == "special":
        datos.append("Especial")
    if defin.get("ritual"):
        datos.append("ritual")
    return " · ".join(datos)


def _escala(defin, nivel_clase):
    """El valor de la tabla de su clase a su nivel (el dado de Ataque
    furtivo, de Artes marciales…), para {{scalevalue}}."""
    mejor = None
    for e in defin.get("levelScales") or []:
        if int(e.get("level") or 0) <= nivel_clase and (not mejor or e["level"] > mejor["level"]):
            mejor = e
    if not mejor:
        return None
    dado = mejor.get("dice") or {}
    return dado.get("diceString") or mejor.get("fixedValue") or mejor.get("description")


def descripciones_de(d, t, mods, comp, nivel):
    """Las descripciones (para el campo «descripciones») y, aparte, de
    dónde le viene cada rasgo (para ponerlo detrás en «rasgos»)."""
    clases = [c for c in d.get("classes") or [] if isinstance(c, dict)]
    base = {"characterlevel": nivel, "proficiency": comp}
    for i, (clave, _) in CARACTERISTICAS.items():
        base["modifier:%s" % clave] = mods[i]
        base["savedc:%s" % clave] = 8 + comp + mods[i]
        base["spellattack:%s" % clave] = comp + mods[i]

    # De dónde viene cada cosa, por su id en D&D Beyond.
    rasgo_de = {}     # id de rasgo de clase/raza/dote -> (nombre, origen, nivel de clase)
    raza = t((d.get("race") or {}).get("fullName") or (d.get("race") or {}).get("baseName") or "")
    for r in (d.get("race") or {}).get("racialTraits") or []:
        defin = (r or {}).get("definition") or {}
        if defin.get("id"):
            rasgo_de[defin["id"]] = (t(defin.get("name")), "Raza: %s" % raza if raza else "De su raza", nivel)
    for c in clases:
        clase = t((c.get("definition") or {}).get("name"))
        sub_id = (c.get("subclassDefinition") or {}).get("id")
        sub = t((c.get("subclassDefinition") or {}).get("name")) if sub_id else ""
        for f in c.get("classFeatures") or []:
            defin = (f or {}).get("definition") or {}
            de = sub if sub_id and defin.get("classId") == sub_id else clase
            rasgo_de[defin.get("id")] = (t(defin.get("name")), "%s, nivel %s" % (de, defin.get("requiredLevel") or 1),
                                          int(c.get("level") or 0))
    for f in d.get("feats") or []:
        defin = (f or {}).get("definition") or {}
        if defin.get("id"):
            rasgo_de[defin["id"]] = (t(defin.get("name")), "Dote", nivel)
    opcion_de = {}    # id de una opción (Metamagia: …) -> id del rasgo que la da
    for lista in (d.get("options") or {}).values():
        for o in lista or []:
            defin = (o or {}).get("definition") or {}
            if defin.get("id") and o.get("componentId"):
                opcion_de[defin["id"]] = o["componentId"]
    objeto_de = {((i or {}).get("definition") or {}).get("id"): t(((i or {}).get("definition") or {}).get("name"))
                 for i in d.get("inventory") or []}

    def por(clave_lista, componente):
        """«Por Fuente de magia (Hechicero, nivel 2)», «Objeto: …»…"""
        if clave_lista == "item":
            return "Objeto: %s" % objeto_de[componente] if objeto_de.get(componente) else "De un objeto"
        if componente in opcion_de and opcion_de[componente] in rasgo_de:
            componente = opcion_de[componente]
        if componente in rasgo_de:
            nombre, origen, _ = rasgo_de[componente]
            return "Por %s (%s)" % (nombre, origen)
        return {"race": "De su raza", "feat": "De una dote", "class": "De su clase",
                "background": "De su trasfondo"}.get(clave_lista, "")

    bloques, vistos = [], set()

    def anadir(nombre, origen, datos, html, valores=None):
        nombre = str(nombre or "").strip()
        texto = html_a_markdown(_plantillas(html, dict(base, **(valores or {}))))
        if not nombre or nombre in vistos or not (texto or origen or datos):
            return
        vistos.add(nombre)
        partes = ["## " + nombre]
        if origen:
            partes.append("Origen: " + origen)
        if datos:
            partes.append("Datos: " + datos)
        if texto:
            partes.append(texto)
        bloques.append("\n".join(partes))

    # LOS CONJUROS: los de la lista de su clase y los que le dan sus
    # rasgos, su raza, sus dotes o sus objetos.
    nombre_de_clase = {c.get("id"): t((c.get("definition") or {}).get("name")) for c in clases}
    for cs in d.get("classSpells") or []:
        for s in cs.get("spells") or []:
            defin = (s or {}).get("definition") or {}
            origen = "Lista de %s" % nombre_de_clase.get(cs.get("characterClassId"), "su clase")
            if s.get("alwaysPrepared"):
                origen += " (siempre preparado)"
            anadir(t(defin.get("name")), origen, _datos_de_conjuro(defin, t), defin.get("description"))
    for clave_lista, lista in (d.get("spells") or {}).items():
        for s in lista or []:
            defin = (s or {}).get("definition") or {}
            anadir(t(defin.get("name")), por(clave_lista, s.get("componentId")), _datos_de_conjuro(defin, t),
                   defin.get("description"))

    # LAS ACCIONES (con sus usos en las cuentas).
    for clave_lista, lista in (d.get("actions") or {}).items():
        for a in lista or []:
            usos = (a.get("limitedUse") or {}).get("maxUses")
            componente = a.get("componentId")
            nivel_c = rasgo_de.get(opcion_de.get(componente, componente), (None, None, nivel))[2]
            anadir(t(a.get("name")), por(clave_lista, componente), "",
                   a.get("description") or a.get("snippet"),
                   {"limiteduse": usos if usos else "?", "classlevel": nivel_c})

    # LOS RASGOS de raza y de clase, y las dotes.
    for r in (d.get("race") or {}).get("racialTraits") or []:
        defin = (r or {}).get("definition") or {}
        if str(defin.get("name") or "").lower() not in RASGOS_QUE_SOBRAN:
            anadir(t(defin.get("name")), rasgo_de.get(defin.get("id"), ("", ""))[1], "", defin.get("description"))
    for c in clases:
        for f in c.get("classFeatures") or []:
            defin = (f or {}).get("definition") or {}
            if int(defin.get("requiredLevel") or 1) > int(c.get("level") or 0) \
                    or str(defin.get("name") or "").lower() in RASGOS_QUE_SOBRAN or defin.get("name") == "TBD":
                continue
            valores = {"classlevel": int(c.get("level") or 0),
                       "limiteduse": (defin.get("limitedUse") or [{}])[0].get("uses", "?")
                       if isinstance(defin.get("limitedUse"), list) and defin.get("limitedUse") else "?"}
            escala = _escala(defin, int(c.get("level") or 0))
            if escala is not None:
                valores["scalevalue"] = escala
            anadir(t(defin.get("name")), rasgo_de[defin.get("id")][1], "", defin.get("description"), valores)
    for f in d.get("feats") or []:
        defin = (f or {}).get("definition") or {}
        anadir(t(defin.get("name")), "Dote", "", defin.get("description"))

    # LOS OBJETOS: los mágicos y lo que lleva puesto (armas, armadura).
    for i in d.get("inventory") or []:
        defin = (i or {}).get("definition") or {}
        if not (defin.get("magic") or (i.get("equipped") and (defin.get("armorClass") or defin.get("damage")))):
            continue
        datos = []
        tipo = str(defin.get("filterType") or defin.get("type") or "")
        if tipo:
            datos.append(TIPOS_DE_OBJETO.get(tipo.lower()) or t(tipo))
        rareza = RAREZAS.get(str(defin.get("rarity") or "").lower())
        if rareza and defin.get("magic"):
            datos.append(rareza)
        if defin.get("canAttune"):
            datos.append("sintonizado" if i.get("isAttuned") else "requiere sintonización")
        if i.get("equipped"):
            datos.append("lo lleva puesto")
        anadir(t(defin.get("name")), "", " · ".join(datos), defin.get("description"))

    origen_de_rasgo = {nombre: origen for nombre, origen, _ in rasgo_de.values()}
    return "\n\n".join(bloques), origen_de_rasgo


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
    # El enlace a su ficha en D&D Beyond (el botón «ficha dndbeyond»).
    if d.get("readonlyUrl") or d.get("id"):
        campos["dndbeyond"] = str(d.get("readonlyUrl") or "https://www.dndbeyond.com/characters/%s" % d["id"])
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
        # Detrás, si lo lleva puesto y si es mágico (en la ficha, el
        # inventario se reparte así: puesto, mágico y mochila).
        marcas = [x for x, si in (("equipado", i.get("equipped")), ("mágico", defin.get("magic"))) if si]
        objetos.append(t(defin["name"]) + (" ×%d" % cuantos if cuantos > 1 else "")
                       + (" [%s]" % ", ".join(marcas) if marcas else ""))
    campos["objetos"] = objetos
    monedas = d.get("currencies") or {}
    dinero = ["%d %s" % (monedas[k], t(k)) for k in ("pp", "gp", "ep", "sp", "cp") if monedas.get(k)]
    campos["dinero"] = ", ".join(dinero)

    # LOS RASGOS Y LAS DOTES, por su nombre.
    # Cada uno con de dónde le viene detrás: «(Hechicero, nivel 3)»,
    # «(Raza: Semielfo)», «(Dote)». Su texto, en «descripciones».
    campos["descripciones"], origen_de_rasgo = descripciones_de(d, t, mods, comp, nivel)
    rasgos = []
    for r in ((d.get("race") or {}).get("racialTraits") or []):
        nombre = ((r or {}).get("definition") or {}).get("name")
        if nombre and nombre.lower() not in RASGOS_QUE_SOBRAN:
            rasgos.append(t(nombre))
    for c in clases:
        for f in c.get("classFeatures") or []:
            defin = (f or {}).get("definition") or {}
            if defin.get("name") and int(defin.get("requiredLevel") or 1) <= int(c.get("level") or 0) \
                    and defin["name"].lower() not in RASGOS_QUE_SOBRAN and defin["name"] != "TBD":
                rasgos.append(t(defin["name"]))
    for f in d.get("feats") or []:
        nombre = ((f or {}).get("definition") or {}).get("name")
        if nombre:
            rasgos.append(t(nombre))
    # Los de relleno de las fichas de 2024 («Core Druid Traits», «Druid
    # Subclass», «… Ability Score Improvements»), fuera.
    rasgos = [r for r in rasgos if not re.search(r"^core .* traits$| subclass$|ability score improvement",
                                                 r.lower())]
    vistos_r, lineas = set(), []
    for nombre in rasgos:
        if nombre not in vistos_r:
            vistos_r.add(nombre)
            origen = origen_de_rasgo.get(nombre)
            lineas.append("- **%s**%s" % (nombre, (" (%s)" % origen) if origen else ""))
    campos["rasgos"] = "\n".join(lineas)

    # EL TRASFONDO, la apariencia y la personalidad (lo de la pestaña
    # «Background» de D&D Beyond). Lo escrito a mano allí viene en el
    # idioma en que lo escribieras: se copia tal cual.
    trasfondo = ((d.get("background") or {}).get("definition") or {}).get("name")
    campos["trasfondo"] = t(trasfondo) if trasfondo else ""
    campos["alineamiento"] = ALINEAMIENTOS.get(d.get("alignmentId"), "")
    for clave, de in (("fe", "faith"), ("edad", "age"), ("ojos", "eyes"), ("pelo", "hair"), ("piel", "skin")):
        campos[clave] = str(d.get(de) or "").strip()
    campos["altura"] = _altura(d.get("height"))
    campos["peso"] = _peso(d.get("weight"))
    rasgos_de_p = d.get("traits") or {}
    for clave, de in (("personalidad", "personalityTraits"), ("ideales", "ideals"), ("vinculos", "bonds"),
                      ("defectos", "flaws")):
        campos[clave] = str(rasgos_de_p.get(de) or "").strip()
    historia = str((d.get("notes") or {}).get("backstory") or "").strip()
    if historia:
        campos["historia"] = historia

    # LOS SENTIDOS (visión en la oscuridad…) y LAS DEFENSAS (resistencias,
    # inmunidades, vulnerabilidades), de los modificadores.
    sentidos, defensas = [], {}
    for m in modificadores:
        tipo, sub = m.get("type"), str(m.get("subType") or "")
        if tipo in ("set-base", "sense") and sub in SENTIDOS and m.get("value"):
            texto = "%s %s m" % (SENTIDOS[sub], ("%g" % round(m["value"] * 0.3, 1)).replace(".", ","))
            if texto not in sentidos:
                sentidos.append(texto)
        elif tipo in DEFENSAS:
            nombre = t(sub.replace("-", " ").title()).lower()
            defensas.setdefault(DEFENSAS[tipo], [])
            if nombre not in defensas[DEFENSAS[tipo]]:
                defensas[DEFENSAS[tipo]].append(nombre)
    campos["sentidos"] = ", ".join(sentidos)
    campos["defensas"] = ["%s: %s" % (k, ", ".join(v)) for k, v in defensas.items()]

    # LAS ACCIONES (las de clase, raza, dotes y objetos), por su tipo.
    acciones = []
    for lista_a in (d.get("actions") or {}).values():
        for a in lista_a or []:
            nombre = str((a or {}).get("name") or "").strip()
            if not nombre:
                continue
            tipo = TIPOS_DE_ACCION.get(((a.get("activation") or {}).get("activationType")), "Otras")
            usos = (a.get("limitedUse") or {}).get("maxUses")
            # Y cómo se recargan: «(2 usos, descanso largo)».
            recarga = RECARGAS.get((a.get("limitedUse") or {}).get("resetType"), "")
            texto = "%s: %s%s" % (tipo, t(nombre), " (%s %s%s)" % (usos, "uso" if usos == 1 else "usos",
                                                                  ", " + recarga if recarga else "") if usos else "")
            if texto not in acciones:
                acciones.append(texto)
    orden = list(TIPOS_DE_ACCION.values()) + ["Otras"]
    campos["acciones"] = sorted(acciones, key=lambda x: orden.index(x.split(":")[0]) if x.split(":")[0] in orden else 99)

    # Lo que no se ha podido traducir: para cambiarlo a mano.
    if t.sin_traducir:
        avisos.append("Sin traducir (cámbialo a mano, o apúntalo en herramientas/0-comun/datos/dnd-es-propias.json para la"
                      " próxima): " + "; ".join(t.sin_traducir[:40]) + ("…" if len(t.sin_traducir) > 40 else ""))
    retrato = ((d.get("decorations") or {}).get("avatarUrl") or "").strip()
    return campos, avisos, retrato


def imagenes_de_objetos(d, traducir=None):
    """{nombre del objeto (traducido, como sale en «objetos»): la URL de su
    imagen en D&D Beyond}, de los que tienen. Las baja el editor a
    imagenes/personajes/<clave>/objetos/, que es donde las busca la
    galería del inventario."""
    t = traducir or Traductor()
    salida = {}
    for i in d.get("inventory") or []:
        defin = (i or {}).get("definition") or {}
        url = str(defin.get("largeAvatarUrl") or defin.get("avatarUrl") or "").strip()
        if defin.get("name") and url.startswith("http"):
            salida.setdefault(t(defin["name"], apuntar=False), url.split("?", 1)[0])
    return salida


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
