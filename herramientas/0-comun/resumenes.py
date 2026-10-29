#!/usr/bin/env python3
# =========================================
# EL RESUMEN DE UNA SESIÓN, SACADO DE SUS NOTAS
# =========================================
# Para el botón «resumen» de cada sesión en el índice de la campaña. No
# se inventa nada: se lee lo escrito y se queda, de cada escena, su
# nombre y la primera frase de lo que pasó; y de cada caja de «Lo que
# descubrimos», lo primero que se descubrió. Una línea por cosa:
#
#     Las ventas de Denelia: Viajando en la Gran Caravana hemos llegado…
#     Lo que descubrimos: Su líder es algún tipo de hechicero…
#
# Lo usan generar-posts.py (al publicar, y cada vez que se pasan los
# generadores mientras el resumen sea el automático) y el editor (el
# botón «Rehacer el resumen automático»). Si se escribe a mano en el
# editor, ya no se toca solo.

import html
import re
from html.parser import HTMLParser

# Lo más largo que puede ser una línea antes de cortarla con «…».
LARGO_DE_LINEA = 220


class _Escenas(HTMLParser):
    """Recoge, en orden: ("escena", nombre, primer texto) y
    ("descubrimiento", primer texto). Lo de los comentarios no cuenta (la
    plantilla lleva ejemplos en ellos: HTMLParser ya los salta)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.cosas = []
        self.pila = []
        self.escena = None        # {"nombre": "", "texto": ""}
        self.en_nombre = False
        self.en_cuerpo = 0        # profundidad dentro del cuerpo de la escena
        self.descubrimiento = None
        self.leyendo = None       # dónde va el texto que llega: la lista de trozos

    def handle_starttag(self, tag, attrs):
        clases = (dict(attrs).get("class") or "").split()
        self.pila.append((tag, clases))
        if "cuaderno-escena" in clases:
            self.escena = {"nombre": [], "texto": None, "descubrimientos": []}
        elif "cuaderno-escena-nombre" in clases and self.escena is not None:
            self.en_nombre = True
        elif "cuaderno-descubrimiento" in clases:
            self.descubrimiento = {"texto": None}
        elif tag in ("li", "p") and self.leyendo is None:
            # El primer párrafo o punto con texto: de la caja de
            # descubrimientos si se está dentro de una, si no de la escena.
            if self.descubrimiento is not None and self.descubrimiento["texto"] is None:
                self.descubrimiento["texto"] = []
                self.leyendo = (self.descubrimiento["texto"], len(self.pila))
            elif (self.escena is not None and self.escena["texto"] is None and self.descubrimiento is None
                  and not self.en_nombre and "cuaderno-objetos" not in self._clases_de_arriba()):
                self.escena["texto"] = []
                self.leyendo = (self.escena["texto"], len(self.pila))

    def _clases_de_arriba(self):
        return [c for _, clases in self.pila for c in clases]

    def handle_endtag(self, tag):
        if self.leyendo and len(self.pila) == self.leyendo[1]:
            leido = " ".join("".join(self.leyendo[0]).split())
            self.leyendo = None
            # «Examinamos los cuerpos, obtenemos:» presenta una lista: no
            # dice qué pasó. Se sigue con el siguiente punto.
            if leido.endswith(":") or not leido:
                if self.descubrimiento is not None and self.descubrimiento["texto"] is not None:
                    self.descubrimiento["texto"] = None
                elif self.escena is not None:
                    self.escena["texto"] = None
        cerrada = None
        while self.pila:
            arriba, clases = self.pila.pop()
            if arriba == tag:
                cerrada = clases
                break
        if cerrada is None:
            return
        if "cuaderno-escena-nombre" in cerrada:
            self.en_nombre = False
        elif "cuaderno-descubrimiento" in cerrada and self.descubrimiento is not None:
            if self.descubrimiento["texto"]:
                cosa = ("descubrimiento", "", _una_frase("".join(self.descubrimiento["texto"])))
                # Dentro de una escena, va detrás de ella (que todavía no
                # se ha cerrado); fuera, en su sitio.
                (self.escena["descubrimientos"] if self.escena is not None else self.cosas).append(cosa)
            self.descubrimiento = None
        elif "cuaderno-escena" in cerrada and self.escena is not None:
            nombre = " ".join("".join(self.escena["nombre"]).split())
            texto = _una_frase("".join(self.escena["texto"] or []))
            if nombre or texto:
                self.cosas.append(("escena", nombre, texto))
            self.cosas.extend(self.escena["descubrimientos"])
            self.escena = None

    def handle_data(self, datos):
        if self.en_nombre and self.escena is not None:
            self.escena["nombre"].append(datos)
        elif self.leyendo is not None:
            self.leyendo[0].append(datos)


def _una_frase(texto):
    """La primera frase (hasta el primer punto que acaba una frase), y si
    pasa de LARGO_DE_LINEA, cortada en una palabra con «…»."""
    texto = " ".join(html.unescape(texto).split())
    if not texto:
        return ""
    m = re.search(r"^(.+?[.!?…])(\s|$)", texto)
    frase = m.group(1) if m and len(m.group(1)) >= 25 else texto
    if len(frase) > LARGO_DE_LINEA:
        frase = frase[:LARGO_DE_LINEA].rsplit(" ", 1)[0].rstrip(",;:") + "…"
    elif frase[-1] in ",;:":
        frase = frase[:-1].rstrip() + "…"
    return frase


def resumen_de_notas(html_de_las_notas):
    """El resumen de unas notas (el HTML de la página entera o solo el del
    cuaderno), como texto: una línea por escena y por descubrimiento."""
    lector = _Escenas()
    lector.feed(html_de_las_notas or "")
    lector.close()
    lineas = []
    for clase, nombre, texto in lector.cosas:
        if clase == "descubrimiento":
            lineas.append("Lo que descubrimos: " + texto)
        elif nombre and texto:
            lineas.append(nombre + ": " + texto)
        else:
            lineas.append(nombre or texto)
    return "\n".join(l for l in lineas if l.strip())
