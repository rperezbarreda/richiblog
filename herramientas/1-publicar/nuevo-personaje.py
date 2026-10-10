#!/usr/bin/env python3
# =========================================
# AÑADIR GENTE AL «NPC» DE UNA CAMPAÑA
# =========================================
# Rellena datos/npcs-<campaña>.json, que es de donde sale la rejilla
# de tokens de web/notas_rol/<campaña>/npcs_<campaña>.html. Es lo
# mismo que editar ese archivo a mano, pero sin pelearse con las comas y
# las comillas, y comprobando de paso que las fotos existen y que la
# sesión que dices es una de verdad.
#
# CÓMO USARLO
# -----------
# Desde la carpeta raíz del sitio, al terminar de pasar unas notas a
# limpio:
#
#     python herramientas/1-publicar/nuevo-personaje.py
#
# Te pregunta de qué campaña (si solo hay una, ni eso) y luego va campo a
# campo. Al guardar pregunta si quieres meter a otro, así que para los
# seis o siete que salen en una partida basta con pasarlo una vez.
#
# Si ya sabes de qué campaña es, te ahorras la primera pregunta:
#
#     python herramientas/1-publicar/nuevo-personaje.py --campana ragna
#
# Y si lo sabes TODO, lo añade sin preguntar nada (cómodo para meter
# varios seguidos desde el historial de la terminal):
#
#     python herramientas/1-publicar/nuevo-personaje.py --campana ragna \
#            --nombre "Rukkus" --grupo "Sirevia" \
#            --que "Humano, cazador" --donde "el Sueño del Elemental" \
#            --relacion neutral --estado vivo --sesion 1 \
#            --nota "Nos avisó de que nos anduviéramos con ojo con Apaaka." \
#            --token rukkus-token.webp --ilustracion rukkus.webp
#
# LAS FOTOS NO SE TOCAN: se apuntan.
# Las preparas tú (cuadrada la del token, de pie 3x4 la ilustración) y las
# dejas en imagenes/notas_rol/<campaña>/; esto solo escribe la ruta y te
# avisa si el archivo no está. Para convertirlas a WebP y dejarlas del
# peso que toca:
#
#     python herramientas/2-imagenes/optimizar-imagenes.py
#
# Las dos son opcionales: mientras no estén, en la web sale la inicial del
# nombre dentro del marco.
#
# AL TERMINAR PASA EL BUSCADOR, y nada más. La página dla página de npcs
# lee el JSON tal cual, así que ahí se ve al momento; lo que sí hay que
# rehacer es datos/buscador.json, porque ese es un archivo generado y sin
# pasarlo buscar un nombre nuevo no encontraría nada.

import sys
from pathlib import Path

# comun.py vive un piso más arriba, en herramientas/, y Python solo busca
# los imports en la carpeta del propio archivo. Sin esta línea, al estar
# esto dentro de una subcarpeta, "from comun import ..." no lo encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import argparse

from comun import (
    RAIZ,
    elegir,
    elegir_campana,
    escribir_json,
    leer_json,
    pasar_generadores,
    preguntar,
)
# Para poder pegar la ruta de una imagen que tengas por ahí fuera y que se
# traiga sola, en vez de copiarla, renombrarla y convertirla a mano antes
# de volver aquí. Lo de verdad está en herramientas/imagenes.py.
from imagenes import SITIOS, nombre_para, parece_de_fuera, traer

# Las palabras que la web pinta con marquita de color (ver NPC_TONOS en
# scripts/paginas/npcs-rol.js). No son obligatorias: puedes escribir
# la que quieras y sale igual, con la marca en gris. Están aquí para
# ofrecerlas en el menú y no tener que acordarse de cómo se escriben.
RELACIONES = ["aliado", "aliada", "neutral", "enemigo", "enemiga", "desconocida"]
ESTADOS = ["vivo", "viva", "muerto", "muerta", "desaparecido", "desaparecida",
           "desconocido"]

SI = ("s", "si", "sí")


def json_de(clave):
    return RAIZ / "datos" / f"npcs-{clave}.json"


def carpeta_de_fotos(clave):
    return f"/imagenes/notas_rol/{clave}/"


# =========================================
# EL ARCHIVO DE LA CAMPAÑA
# =========================================
# Si todavía no existe se crea con lo que ya sabemos de la campaña, para
# no empezar con un archivo vacío que haya que rellenar a mano.

def cargar_reparto(clave, campana):
    archivo = json_de(clave)
    datos = leer_json(archivo, None)
    if isinstance(datos, dict):
        datos.setdefault("personajes", [])
        return archivo, datos, False

    datos = {
        "campana": clave,
        "nombre": (campana.get("nombre") or "").strip(),
        "pagina": (campana.get("npcs") or "").strip()
        or f"/web/notas_rol/{clave}/personajes_{clave}.html",
        "intro": "La gente que nos vamos encontrando por el camino.",
        "personajes": [],
    }
    return archivo, datos, True


def avisar_de_la_pagina(clave, campana):
    """Un reparto sin su página no se ve en ninguna parte. Como esto se
    puede estrenar en una campaña que todavía no la tenga, se dice lo que
    falta en vez de guardar en silencio en un archivo que nadie lee."""
    pagina = RAIZ / "web" / "notas_rol" / clave / f"personajes_{clave}.html"
    if pagina.is_file() and (campana.get("npcs") or "").strip():
        return
    print("\n  OJO: esta campaña todavía no tiene su página de npcs.")
    if not pagina.is_file():
        print(f"     Falta  {pagina.relative_to(RAIZ)}")
        print("     Cópiala de herramientas/plantillas/npcs-rol.html y")
        print("     cambia los {{...}} por los de esta campaña.")
    if not (campana.get("npcs") or "").strip():
        print(f'     Y añade a datos/campana-{clave}.json esta línea:')
        print(f'         "npcs": "/web/notas_rol/{clave}/personajes_{clave}.html",')
    print("     Lo que apuntes aquí se guarda igual y aparecerá en cuanto esté.")


# =========================================
# LAS PREGUNTAS
# =========================================

def grupos_de(reparto):
    """Los grupos que ya existen, en el orden en que aparecen. En ese
    orden a propósito: es el mismo en el que salen en la página, así que
    el menú se parece a lo que ya se está viendo."""
    vistos = []
    for quien in reparto.get("personajes") or []:
        for grupo in grupos_de_uno(quien):
            if grupo and grupo not in vistos:
                vistos.append(grupo)
    return vistos


def grupos_de_uno(quien):
    """Los grupos de una persona, siempre como lista. Admite las tres
    formas con las que uno lo escribiría sin pensar: "categoria" con una
    palabra, "categoria" con una lista y "categorias" en plural. Lo mismo
    que hace gruposDeNpc() en scripts/paginas/npcs-rol.js."""
    crudo = quien.get("categorias", quien.get("categoria"))
    lista = crudo if isinstance(crudo, list) else [crudo]
    return [(c or "").strip() for c in lista if (c or "").strip()]


# UNO PUEDE ESTAR EN VARIOS GRUPOS, y entonces su token sale en todos
# ellos (no es una copia: es la misma ficha). Por eso esto pregunta en
# bucle hasta que se da un Enter en blanco, en vez de preguntar una vez:
# la tabernera de Sirevia que luego se une a la caravana se busca en los
# dos sitios, y acordarse de eso al apuntarla es más fácil que volver.
#
# Desde la terminal, --grupo se puede repetir:
#     --grupo Sirevia --grupo "la Gran Caravana"
def pedir_grupos(args, reparto):
    if args.grupo:
        return [g.strip() for g in args.grupo if g.strip()] or ["sin clasificar"]

    conocidos = grupos_de(reparto)
    puestos = []
    while True:
        if not conocidos:
            dicho = preguntar(
                "Grupo (la caravana, Sirevia, los bandidos…)", "sin clasificar"
            ).strip()
        else:
            titulo = (
                "¿De qué grupo es?"
                if not puestos
                else "¿De algún grupo más? (Enter en blanco para terminar)"
            )
            # Sin valor por defecto cuando ya hay uno puesto: si no, dar un
            # Enter elegiría el primero de la lista otra vez en vez de
            # terminar, que es lo que uno espera al darlo.
            dicho = elegir(titulo, conocidos, por_defecto="" if puestos else "1").strip()
        if not dicho:
            break
        if dicho not in puestos:
            puestos.append(dicho)
            if dicho not in conocidos:
                conocidos.append(dicho)
        else:
            print(f"  Ya estaba en «{dicho}».")
        if not conocidos:
            break
    return puestos or ["sin clasificar"]


def colocar_en_apartado(reparto, grupos):
    """Si la campaña tiene apartados (regiones que agrupan varios grupos:
    «Sirevia» con Sirevia, los bandidos y Chitxia) y acaba de salir un
    grupo que no está en ninguno, se pregunta dónde va.

    Se pregunta y no se adivina: un grupo nuevo puede ser de una región
    que ya existe o una región nueva, y eso no se deduce del nombre. Si
    la campaña no tiene apartados no se pregunta nada: la página los
    enseña sueltos, que es como estaba antes de que existieran."""
    apartados = reparto.get("apartados")
    if not isinstance(apartados, list) or not apartados:
        return
    dentro = {
        str(c).strip().lower()
        for uno in apartados if isinstance(uno, dict)
        for c in (uno.get("categorias") or [])
    }
    nombres = [str(uno.get("nombre") or "").strip()
               for uno in apartados if isinstance(uno, dict)]
    nombres = [n for n in nombres if n]
    for grupo in grupos:
        if grupo.strip().lower() in dentro:
            continue
        print(f"\n  «{grupo}» no está en ningún apartado de los que tienes.")
        donde = elegir("¿En cuál lo meto? (o escribe uno nuevo, o Enter para dejarlo suelto)",
                       nombres, por_defecto="").strip()
        if not donde:
            continue
        for uno in apartados:
            if isinstance(uno, dict) and str(uno.get("nombre") or "").strip() == donde:
                uno.setdefault("categorias", []).append(grupo)
                break
        else:
            apartados.append({"nombre": donde, "categorias": [grupo]})
            nombres.append(donde)
        dentro.add(grupo.strip().lower())


def pedir_de_una_lista(dado, titulo, opciones, por_defecto):
    """Un menú con las palabras de siempre, pero dejando escribir otra:
    el JSON lo escribes tú y la web pinta cualquier cosa que le pongas."""
    if dado is not None:
        return dado.strip()
    elegida = elegir(titulo, opciones).strip()
    return elegida or por_defecto


def pedir_notas(args):
    """Una por línea, hasta que des un Enter en blanco. Cada una sale como
    un punto de la lista de su ficha."""
    if args.nota:
        return [n.strip() for n in args.nota if n.strip()]
    print("\n  Lo que sepamos de él, una cosa por línea.")
    print("  (Enter en blanco para terminar; si no sabes nada, Enter y ya)")
    notas = []
    while True:
        linea = preguntar(f"  · nota {len(notas) + 1}")
        if not linea:
            return notas
        notas.append(linea)


def pedir_foto(dada, titulo, clave, quien, sitio):
    """Admite dos cosas y hace lo que toque con cada una:

      - EL NOMBRE DE UN ARCHIVO QUE YA ESTÁ DENTRO ("sigil_tkn.webp"):
        se apunta la ruta y ya. Si no está, se avisa y se guarda igual,
        que es muy normal apuntar a la gente el día de la partida y
        buscar los retratos otro día.

      - LA RUTA DE UNA IMAGEN DE TU ORDENADOR, tal y como la copias del
        explorador ("e:\rpere\Descargas\sigil.jpg"): se TRAE al sitio.
        Se convierte a WebP, se deja al tamaño que toca, se recorta a
        cuadrado si es un token y se guarda en imagenes/notas_rol/<campaña>
        con el nombre de quien sea. Lo tuyo se queda donde estaba.

    Antes esto era copiar, renombrar, convertir y volver aquí a escribir
    la ruta a mano, y por el camino se colaban JPG de cuatro megas."""
    nombre = (dada if dada is not None else preguntar(titulo)).strip()
    if not nombre:
        return ""

    # ¿Es de fuera? Entonces se trae, y lo que se apunta es dónde ha
    # quedado. Si falla, se dice por qué y no se apunta nada: una ruta de
    # tu disco duro dentro del JSON no le sirve a nadie que entre a la web.
    if parece_de_fuera(nombre):
        ajustes = SITIOS[sitio]
        ruta, aviso = traer(
            nombre,
            ajustes["carpeta"].format(campana=clave),
            nombre_para(quien, ajustes["sufijo"]),
            lado=ajustes["lado"], cuadrada=ajustes["cuadrada"],
        )
        if not ruta:
            print(f"     No he podido traerla: {aviso}")
            print("     Se queda sin foto; puedes traerla luego con:")
            print("        python herramientas/2-imagenes/traer-imagen.py")
            return ""
        print(f"     Traída a {ruta}  ({aviso})")
        return ruta

    if not nombre.startswith("/"):
        nombre = carpeta_de_fotos(clave) + nombre.lstrip("/")
    if not (RAIZ / nombre.lstrip("/")).is_file():
        print(f"     OJO: no encuentro {nombre}.")
        print("     Se apunta igual; hasta que la subas saldrá la inicial.")
    return nombre


def sesiones_de(campana):
    numeros = []
    for sesion in campana.get("sesiones") or []:
        if isinstance(sesion, dict):
            try:
                numeros.append(int(sesion.get("numero")))
            except (TypeError, ValueError):
                continue
    return sorted(set(numeros))


def pedir_sesion(args, campana):
    """En qué sesión apareció. Por defecto, la última que haya: a esto se
    llega al terminar de pasar a limpio una partida, y la gente que se
    apunta es justo la que ha salido en ella."""
    numeros = sesiones_de(campana)
    ultima = str(numeros[-1]) if numeros else ""
    crudo = args.sesion if args.sesion is not None else preguntar(
        "¿En qué sesión aparece? (Enter para saltar)", ultima
    )
    crudo = str(crudo).strip()
    if not crudo:
        return None
    try:
        numero = int(crudo)
    except ValueError:
        print(f"     {crudo!r} no es un número de sesión; lo dejo en blanco.")
        return None
    if numeros and numero not in numeros:
        print(f"     OJO: la campaña no tiene ninguna sesión {numero}"
              f" (hay: {', '.join(str(n) for n in numeros)}).")
        print("     Se apunta igual, pero en su ficha no saldrá enlazada.")
    return numero


def pedir_personaje(args, reparto, campana, clave):
    nombre = (args.nombre or "").strip() or preguntar("Nombre")
    while not nombre:
        print("     Hace falta un nombre: es lo único obligatorio.")
        nombre = preguntar("Nombre")

    ya = [
        (q.get("nombre") or "").strip().lower()
        for q in reparto.get("personajes") or []
    ]
    if nombre.lower() in ya:
        print(f"\n  Ya hay alguien que se llama {nombre!r} en esta campaña.")
        if preguntar("¿Lo añado igual? (s/N)", "n").lower() not in SI:
            return None

    grupos = pedir_grupos(args, reparto)
    colocar_en_apartado(reparto, grupos)
    # Con uno solo se escribe en singular, que es como está el resto del
    # archivo y como se lee mejor; con varios, en plural y como lista.
    quien = {"nombre": nombre}
    if len(grupos) == 1:
        quien["categoria"] = grupos[0]
    else:
        quien["categorias"] = grupos

    que = args.que if args.que is not None else preguntar(
        "Qué es (raza, oficio, clase… Enter para saltar)"
    )
    quien["que"] = que.strip()

    donde = args.donde if args.donde is not None else preguntar(
        "Dónde se le conoció o dónde está (Enter para saltar)"
    )
    quien["donde"] = donde.strip()

    quien["relacion"] = pedir_de_una_lista(
        args.relacion, "¿Cómo se lleva con el grupo?", RELACIONES, "desconocida"
    )
    quien["estado"] = pedir_de_una_lista(
        args.estado, "¿Cómo está?", ESTADOS, "desconocido"
    )

    # Las dos fotos van siempre en el archivo, aunque estén en blanco: así
    # se ve de un vistazo a quién le falta retrato al abrir el JSON, que es
    # mejor que tener que acordarse de que ese campo puede no estar.
    quien["token"] = pedir_foto(
        args.token,
        "Token para la rejilla (archivo, o la ruta donde la tengas; Enter para saltar)",
        clave, quien["nombre"], "npc-token",
    )
    quien["ilustracion"] = pedir_foto(
        args.ilustracion,
        "Ilustración para su ficha (archivo o ruta; Enter para saltar)",
        clave, quien["nombre"], "npc-ficha",
    )

    quien["notas"] = pedir_notas(args)

    sesion = pedir_sesion(args, campana)
    if sesion is not None:
        quien["primera"] = sesion
    return quien


def resumen(quien):
    print(f"\n  {quien['nombre']}  →  {', '.join(grupos_de_uno(quien))}")
    for campo, etiqueta in (
        ("que", "qué es"),
        ("donde", "dónde"),
        ("relacion", "con el grupo"),
        ("estado", "estado"),
        ("token", "token"),
        ("ilustracion", "ilustración"),
    ):
        if (quien.get(campo) or "").strip():
            print(f"     {etiqueta}: {quien[campo]}")
    if quien.get("primera"):
        print(f"     aparece en: sesión {quien['primera']}")
    for nota in quien.get("notas") or []:
        print(f"     · {nota}")


# =========================================

def main():
    parser = argparse.ArgumentParser(
        description="Añade gente al npcs de una campaña de rol."
    )
    parser.add_argument("--campana", help="la clave de la campaña (ragna, …)")
    parser.add_argument("--nombre")
    parser.add_argument("--grupo", action="append",
                        help="su categoría: la caravana, Sirevia… "
                             "se puede repetir para meterlo en varias")
    parser.add_argument("--que", help="raza, oficio o clase")
    parser.add_argument("--donde", help="dónde se le conoció o dónde está")
    parser.add_argument("--relacion", help="aliado, neutral, enemigo…")
    parser.add_argument("--estado", help="vivo, muerto, desaparecido…")
    parser.add_argument("--token", help="archivo del token de la rejilla")
    parser.add_argument("--ilustracion", help="archivo de la ilustración grande")
    parser.add_argument("--nota", action="append",
                        help="una nota; se puede repetir")
    parser.add_argument("--sesion", help="número de la sesión en la que aparece")
    args = parser.parse_args()

    archivo_campana, campana = elegir_campana(
        args.campana, "¿De qué campaña es?"
    )
    if not campana:
        return 1
    clave = (campana.get("clave") or "").strip()
    if not clave:
        print(f"  A {archivo_campana.relative_to(RAIZ)} le falta la \"clave\".")
        return 1

    archivo, reparto, nuevo = cargar_reparto(clave, campana)
    print(f"\n  QUIÉN ES QUIÉN — {(campana.get('nombre') or clave).upper()}")
    if nuevo:
        print(f"  (empezando {archivo.relative_to(RAIZ)} desde cero)")
        avisar_de_la_pagina(clave, campana)
    else:
        cuantos = len(reparto.get("personajes") or [])
        print(f"  ({cuantos} ficha(s) ya apuntada(s))")

    # Si vienen todos los datos por la línea de órdenes, se añade uno y se
    # sale sin preguntar nada: es lo que hace falta para meter varios
    # seguidos desde el historial de la terminal.
    de_una = bool(args.nombre)
    anadidos = 0
    while True:
        quien = pedir_personaje(args, reparto, campana, clave)
        if quien:
            reparto.setdefault("personajes", []).append(quien)
            escribir_json(archivo, reparto)
            anadidos += 1
            resumen(quien)
            print(f"\n  Guardado en {archivo.relative_to(RAIZ)}")
        if de_una:
            break
        print()
        if preguntar("¿Añado a alguien más? (S/n)", "s").lower() not in SI:
            break
        # A partir del segundo, las respuestas de la línea de órdenes ya
        # se usaron: si no se limpiaran, el segundo saldría con el nombre
        # del primero.
        for campo in ("nombre", "grupo", "que", "donde", "relacion", "estado",
                      "token", "ilustracion", "nota", "sesion"):
            setattr(args, campo, None)

    if not anadidos:
        print("\n  No he añadido a nadie.")
        return 0

    print(f"\n  {anadidos} ficha(s) nueva(s).")
    print("  Ya se ven en la página; paso el buscador para que también")
    print("  se encuentren buscando su nombre.")
    pasar_generadores(("3-generadores/generar-buscador.py",))
    return 0


if __name__ == "__main__":
    sys.exit(main())
