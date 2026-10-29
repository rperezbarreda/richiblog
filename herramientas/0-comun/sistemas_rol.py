# =========================================
# LOS SISTEMAS DE ROL DE MIS PERSONAJES
# =========================================
# Mis personajes pueden ser de D&D 5e (lo de siempre: su pestaña «ficha»
# con todo lo de D&D) o de otro sistema. Lo dice su campo «sistema»:
#
#     (vacío) o "dnd5e"   D&D 5e
#     "vtm5"              Vampiro: la Mascarada, 5.ª edición
#     "fate"              Fate (Básico / Acelerado)
#     "cpred"             Cyberpunk RED
#     "generico"          cualquier otro: la hoja genérica
#
# Los que no son de D&D comparten LA HOJA GENÉRICA, que son unos pocos
# campos de texto, uno por cosa, y cada sistema los pinta a su manera
# (generar-personajes.py: hoja_de_otro_sistema):
#
#   conceptos   lo que le define, «Etiqueta: texto» por línea («Clan:
#               Toreador», «Concepto principal: …», «Rol: Netrunner»).
#   atributos   «Nombre: valor» por línea; «## Grupo» encima de unos para
#               agruparlos («## Físicos»).
#   pericias    las habilidades, igual: «Pelea: 3». Si detrás del nombre
#               va entre paréntesis un atributo, la tirada suma los dos:
#               «Pelea (DES): 4» (Cyberpunk RED). Lo que vaya detrás del
#               número es una nota: «Atletismo: 2 (escalar)».
#   recursos    lo que se gasta y se marca jugando, «Nombre: valor»:
#                 «Salud: 0/7»      7 casillas (0 marcadas) que se marcan
#                                   al pulsarlas (si son más de 12, sale
#                                   el número: «PG: 40/40»);
#                 «Recuperación: 3» un número;
#                 «Consecuencia leve (2): un ojo morado»  un texto.
#   armas       «Nombre: daño; lo demás» por línea («Pistola pesada: 3d6;
#               CdF 2»). Los dados del daño se tiran al pulsarlos.
#   poderes     con formato (Markdown); cada «## Apartado» sale en su
#               ventanita (disciplinas, proezas, ciberware, ventajas…).
#   equipo      un objeto por línea.
#   tirada      solo en la genérica: con qué se tira («1d20», «2d6»,
#               «1d100»); a eso se le suma el atributo o la habilidad.
#
# Al elegir un sistema en el editor, lo que esté vacío se rellena con su
# PLANTILLA (los atributos, las habilidades y los recursos de ese juego),
# para no tener que escribirlos. Los nombres son los míos en español: se
# pueden cambiar en la ficha (o aquí, para los que se hagan después).
#
# CÓMO SE TIRA EN CADA UNO (scripts/paginas/personajes.js):
#   · Vampiro V5: al pulsar un atributo o una habilidad, va a la RESERVA
#     de la ventana de dados (un atributo + una habilidad, más los dados
#     que se sumen o resten) y se tira con su botón: tantos d10 como
#     puntos, los de HAMBRE (el recurso «Hambre») en rojo. Éxito con 6 o
#     más; cada pareja de dieces, dos éxitos de más (crítico; sucio si uno
#     es de hambre); un 1 en uno de hambre avisa de fallo bestial.
#   · Fate: 4dF + la habilidad (cada dado, −, 0 o +), con el nombre de la
#     escalera («+3, Bueno»).
#   · Cyberpunk RED: 1d10 + el atributo + la habilidad. Un 10 tira otro
#     d10 y lo suma (crítico); un 1 tira otro y lo resta (pifia).
#   · La genérica: la «tirada» + el atributo o la habilidad.

import re

SISTEMAS = {
    "dnd5e": {"nombre": "D&D 5e", "corto": "D&D 5e"},
    "vtm5": {
        "nombre": "Vampiro: la Mascarada V5", "corto": "Vampiro V5", "nivel": "generación",
        "valores": "puntos", "maximo": 5, "poderes": ("🩸", "disciplinas", "disciplinas.vtm"),
        "vitales": (("Salud", "❤️", "SAL"), ("Voluntad", "🧠", "VOL")),
        # Las casillas de estas se marcan con tres estados: libre, daño
        # superficial (/) y agravado (✕).
        "de_tres": ("salud", "voluntad"),
        "hambre": "hambre",
    },
    "fate": {
        "nombre": "Fate", "corto": "Fate", "nivel": "",
        "valores": "escalera", "poderes": ("⭐", "proezas", "proezas.fate"),
        "vitales": (("Puntos de destino", "✨", "PD"), ("Recuperación", "🔄", "REC")),
    },
    "cpred": {
        "nombre": "Cyberpunk RED", "corto": "Cyberpunk RED", "nivel": "rango",
        "valores": "numeros", "poderes": ("🦾", "ciberware", "ciberware.sys"),
        "vitales": (("PG", "❤️", "PG"), ("Blindaje (cuerpo)", "🛡️", "BLI")),
        "largos": {"INT": "Inteligencia", "REF": "Reflejos", "DES": "Destreza", "TEC": "Técnica",
                   "FRI": "Frialdad", "VOL": "Voluntad", "SUE": "Suerte", "MOV": "Movimiento",
                   "TCO": "Tipo corporal", "EMP": "Empatía"},
    },
    "generico": {
        "nombre": "Otro sistema", "corto": "", "nivel": "nivel",
        "valores": "numeros", "poderes": ("✨", "poderes", "poderes.txt"),
        "vitales": (),
    },
}

# La escalera de Fate.
ESCALERA_FATE = {8: "Legendario", 7: "Épico", 6: "Fantástico", 5: "Soberbio", 4: "Grande", 3: "Bueno",
                 2: "Normal", 1: "Mediano", 0: "Mediocre", -1: "Malo", -2: "Terrible"}


def _lineas(*bloques):
    return "\n".join(bloques)


PLANTILLAS = {
    "vtm5": {
        "conceptos": _lineas("Concepto: ", "Clan: ", "Depredador: ", "Sire: ", "Ambición: ", "Deseo: "),
        "atributos": _lineas(
            "## Físicos", "Fuerza: 1", "Destreza: 1", "Resistencia: 1",
            "## Sociales", "Carisma: 1", "Manipulación: 1", "Compostura: 1",
            "## Mentales", "Inteligencia: 1", "Astucia: 1", "Resolución: 1"),
        "pericias": _lineas(
            "## Físicas", "Armas cuerpo a cuerpo: 0", "Armas de fuego: 0", "Artesanía: 0", "Atletismo: 0",
            "Conducir: 0", "Latrocinio: 0", "Pelea: 0", "Sigilo: 0", "Supervivencia: 0",
            "## Sociales", "Callejeo: 0", "Etiqueta: 0", "Interpretación: 0", "Intimidación: 0", "Liderazgo: 0",
            "Perspicacia: 0", "Persuasión: 0", "Subterfugio: 0", "Trato con animales: 0",
            "## Mentales", "Academicismo: 0", "Ciencia: 0", "Consciencia: 0", "Finanzas: 0", "Investigación: 0",
            "Medicina: 0", "Ocultismo: 0", "Política: 0", "Tecnología: 0"),
        "recursos": _lineas("Salud: 0/4", "Voluntad: 0/2", "Hambre: 1/5", "Humanidad: 7/10",
                            "Potencia de sangre: 1"),
        "poderes": _lineas("## Disciplinas", "- **Disciplina** ●: su poder", "",
                           "## Ventajas y defectos", "- **Ventaja** ●: lo que es", "",
                           "## Convicciones y piedras de toque", "- **Convicción:** su piedra de toque"),
    },
    "fate": {
        "conceptos": _lineas("Concepto principal: ", "Complicación: ", "Aspecto: ", "Aspecto: ", "Aspecto: "),
        "pericias": _lineas(
            "Atletismo: 0", "Robo: 0", "Contactos: 0", "Artesanía: 0", "Engaño: 0", "Conducir: 0",
            "Empatía: 0", "Pelea: 0", "Investigar: 0", "Saber: 0", "Percepción: 0", "Físico: 0",
            "Provocar: 0", "Relacionarse: 0", "Recursos: 0", "Disparar: 0", "Sigilo: 0", "Voluntad: 0"),
        "recursos": _lineas("Puntos de destino: 3/3", "Recuperación: 3", "Estrés físico: 0/2",
                            "Estrés mental: 0/2", "Consecuencia leve (2): ", "Consecuencia moderada (4): ",
                            "Consecuencia grave (6): "),
        "poderes": _lineas("## Proezas", "- **Nombre:** Como soy…, obtengo un +2 a … cuando …"),
    },
    "cpred": {
        "conceptos": _lineas("Rol: ", "Habilidad de rol: ", "Origen cultural: ", "Estilo: ", "Motivación: "),
        "atributos": _lineas("INT: 5", "REF: 5", "DES: 5", "TEC: 5", "FRI: 5", "VOL: 5", "SUE: 5", "MOV: 5",
                             "TCO: 5", "EMP: 5"),
        "pericias": _lineas(
            "## Conciencia", "Concentración (VOL): 2", "Esconder/revelar objeto (INT): 0",
            "Leer los labios (INT): 0", "Percepción (INT): 2", "Rastrear (INT): 0",
            "## Cuerpo", "Atletismo (DES): 2", "Contorsionismo (DES): 0", "Bailar (DES): 0",
            "Resistencia (VOL): 0", "Resistir tortura/drogas (VOL): 0", "Sigilo (DES): 2",
            "## Control", "Conducir vehículo terrestre (REF): 0", "Pilotar vehículo aéreo (REF): 0",
            "Pilotar vehículo marítimo (REF): 0", "Montar (REF): 0",
            "## Educación", "Contabilidad (INT): 0", "Cuidado de animales (INT): 0", "Burocracia (INT): 0",
            "Negocios (INT): 0", "Composición (INT): 0", "Criminología (INT): 0", "Criptografía (INT): 0",
            "Deducción (INT): 0", "Educación (INT): 2", "Juego (INT): 0", "Idioma: jerga callejera (INT): 2",
            "Buscar en bibliotecas (INT): 0", "Conocimiento local (INT): 2", "Ciencia (INT): 0",
            "Táctica (INT): 0", "Supervivencia (INT): 0",
            "## Lucha", "Pelea (DES): 2", "Evasión (DES): 2", "Artes marciales (DES): 0",
            "Armas cuerpo a cuerpo (DES): 0",
            "## Interpretación", "Actuar (FRI): 0", "Tocar un instrumento (TEC): 0",
            "## Armas a distancia", "Tiro con arco (REF): 0", "Autofuego (REF): 0", "Pistola (REF): 0",
            "Arma pesada (REF): 0", "Arma de hombro (REF): 0",
            "## Social", "Soborno (FRI): 0", "Conversación (EMP): 2", "Percepción humana (EMP): 2",
            "Interrogatorio (FRI): 0", "Persuasión (FRI): 2", "Arreglarse (FRI): 0", "Callejeo (FRI): 0",
            "Comercio (FRI): 0", "Vestuario y estilo (FRI): 0",
            "## Técnica", "Tecnología básica (TEC): 0", "Cibertecnología (TEC): 0", "Demoliciones (TEC): 0",
            "Electrónica y seguridad (TEC): 0", "Primeros auxilios (TEC): 2", "Falsificación (TEC): 0",
            "Tecnología de vehículos (TEC): 0", "Paramedicina (TEC): 0", "Forzar cerraduras (TEC): 0",
            "Robar (TEC): 0", "Tecnología de armas (TEC): 0"),
        "recursos": _lineas("PG: 40/40", "Herida grave: 20", "Salvación contra muerte: 5", "Humanidad: 50/50",
                            "Suerte: 0/5", "Blindaje (cabeza): 11", "Blindaje (cuerpo): 11"),
        "armas": "Pistola pesada: 3d6; CdF 2, cargador 8",
        "poderes": _lineas("## Ciberware", "- **Neuroenlace:** lo que hace", "",
                           "## Habilidad de rol", "- **Nombre (rango 4):** lo que hace"),
    },
    "generico": {
        "conceptos": "Concepto: ",
        "recursos": "Vida: 0/10",
        "tirada": "1d20",
    },
}

# Los campos de la hoja genérica, en su orden.
CAMPOS = ("conceptos", "atributos", "pericias", "recursos", "armas", "poderes", "equipo", "tirada")


def sistema_de(p):
    """La clave del sistema de un personaje («dnd5e» si no tiene)."""
    s = str((p or {}).get("sistema") or "").strip().lower()
    return s if s in SISTEMAS else "dnd5e"


def es_dnd(p):
    return sistema_de(p) == "dnd5e"


def bloques(texto):
    """«## Grupo» y «Nombre: valor» por línea -> [(grupo, [(nombre,
    valor), …]), …]. Lo de antes del primer «##» va en un grupo sin
    nombre. Una línea sin «:» es un nombre sin valor."""
    salida = [["", []]]
    # El editor los guarda como lista (una línea cada uno); a mano, puede
    # ser un texto con saltos de línea.
    lineas = texto if isinstance(texto, list) else str(texto or "").split("\n")
    for linea in lineas:
        linea = str(linea).strip()
        if not linea:
            continue
        if linea.startswith("##"):
            salida.append([linea.lstrip("#").strip(), []])
            continue
        nombre, dos, valor = linea.rpartition(":") if ":" in linea and _es_valor(linea.rpartition(":")[2]) \
            else linea.partition(":")
        if not dos:
            nombre, valor = linea, ""
        nombre = nombre.strip().lstrip("-*• ").strip()
        if nombre:
            salida[-1][1].append((nombre, valor.strip()))
    return [(g, cosas) for g, cosas in salida if cosas]


def _es_valor(texto):
    """Si lo de detrás del último «:» empieza por un número (para que
    «Idioma: jerga callejera (INT): 2» parta por el último)."""
    return bool(re.match(r"^\s*[+−-]?\d", texto))


def valor_y_nota(valor):
    """«3 (escalar)» -> (3, "escalar"); «+2» -> (2, ""); «Toreador» ->
    (None, "Toreador")."""
    m = re.match(r"^\s*([+−-]?\d+)\s*(.*)$", str(valor or ""))
    if not m:
        return None, str(valor or "").strip()
    return int(m.group(1).replace("−", "-")), m.group(2).strip().strip("()").strip()


def atributo_de(nombre):
    """«Pelea (DES)» -> ("Pelea", "DES"); «Pelea» -> ("Pelea", "")."""
    m = re.match(r"^(.*?)\s*\(([^()]+)\)\s*$", nombre)
    return (m.group(1).strip(), m.group(2).strip()) if m else (nombre, "")


def marcador(valor):
    """«2/5» -> (2, 5); «3» -> (None, 3); lo demás, None."""
    m = re.match(r"^\s*(\d+)\s*/\s*(\d+)\s*$", str(valor or ""))
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.match(r"^\s*(\d+)\s*$", str(valor or ""))
    return (None, int(m.group(1))) if m else None


def escalera(n):
    """+3 -> «+3, Bueno»."""
    signo = "+%d" % n if n >= 0 else "−%d" % -n
    nombre = ESCALERA_FATE.get(max(-2, min(8, n)), "")
    return signo, nombre
