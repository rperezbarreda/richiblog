#!/usr/bin/env python3
"""Lee el formato de Chronicler: el frontmatter y el Markdown.

QUÉ ES ESTO
-----------
Chronicler (la aplicación de wiki donde está escrito el mundo) guarda cada
página como un archivo .md con dos partes:

    ---
    title: Valderín
    tags: [ciudad, comercio]
    ---

    El cuerpo, en **Markdown**, con [[enlaces a otras páginas]].

Esto convierte las dos partes: el frontmatter a un diccionario y el cuerpo
a HTML. Lo usa herramientas/3-generadores/generar-mundo.py, que es quien
decide qué hacer con el resultado.

POR QUÉ ESTÁ ESCRITO A MANO Y NO CON UNA LIBRERÍA
-------------------------------------------------
Por lo mismo que el resto del sitio: aquí no hay ni una dependencia, y no
la va a haber por esto. Instalar PyYAML y un parser de Markdown sería
pedirle a quien use esto que mantenga dos librerías más, y el día que una
cambie de versión se rompe la web.

A cambio, ESTO NO ENTIENDE TODO EL MARKDOWN NI TODO EL YAML: entiende el
trozo que usa Chronicler, que está documentado y es acotado. Lo que no
sepa convertir NO lo adivina: lo deja como está y lo apunta en una lista
de avisos, para que al pasar el generador salga por pantalla y se vea.
Eso es a propósito: una conversión que se calla lo que no ha entendido es
peor que una que falla, porque el agujero aparece meses después.

LO QUE ENTIENDE
---------------
Del frontmatter: valores sueltos, listas en una línea ([a, b]), listas de
listas (para los carruseles con pie de foto), textos de varias líneas
(clave: |) y el bloque "layout" de la infobox.

Del cuerpo: encabezados, negrita, cursiva, tachado, código, citas, listas
(anidadas), tablas con alineación, reglas, enlaces y imágenes de Markdown,
wikilinks en sus cuatro formas, imágenes ![[asi]], spoilers ||asi||,
inserciones de página y notas al pie.

TODO EL TEXTO SE ESCAPA ANTES DE CONVERTIRLO. Las etiquetas HTML se meten
después, una a una, sobre texto que ya no puede ser HTML. Es la misma
regla que sigue el JavaScript del sitio y la razón de que esto no sea una
forma de colar código en la web escribiendo una página del mundo.
"""

import html
import re


# =========================================
# AVISOS
# =========================================
# Lo que esto no ha sabido convertir. Se vacía al empezar cada archivo y lo
# recoge quien llama, para poder decir en qué página estaba.

class Avisos:
    def __init__(self):
        self.lista = []

    def di(self, que, donde=""):
        self.lista.append((que, donde))

    def __bool__(self):
        return bool(self.lista)


# =========================================
# EL FRONTMATTER
# =========================================

RE_FRONTMATTER = re.compile(r"\A---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|\Z)", re.S)

# Las opciones de {{insert: …}} que sabemos pintar, con su clase escrita
# entera (ver el porqué donde se usan).
OPCIONES_DE_INSERCION = {
    "centered": "es-centered",
    "borderless": "es-borderless",
}


# LAS NOTAS ESCONDIDAS: <!-- lo que sea --> en el cuerpo de una página no
# sale en la web. Es lo que usan las plantillas de página
# (wiki/_system/templates/) para decir qué va en cada apartado sin que se
# publique, igual que los comentarios ocultos de las wikis de verdad. Se
# quitan aquí, antes de nada, para que tampoco cuenten como el primer
# párrafo (el resumen de la portada y del buscador).
RE_NOTA_EN_SU_LINEA = re.compile(r"^[ \t]*<!--.*?-->[ \t]*(?:\n|\Z)", re.S | re.M)
RE_NOTA_ESCONDIDA = re.compile(r"<!--.*?-->", re.S)


def sin_notas_escondidas(texto):
    """Primero las que ocupan sus propias líneas (se van con su salto de
    línea, para no dejar huecos) y luego las que van en medio de una frase."""
    return RE_NOTA_ESCONDIDA.sub("", RE_NOTA_EN_SU_LINEA.sub("", texto))


RE_ENCABEZADO = re.compile(r"^(#{1,6})\s+\S")


def sin_apartados_vacios(texto):
    """LOS APARTADOS SIN NADA NO SALEN. Una plantilla trae todos los
    apartados que suele tener esa clase de página (Historia, Geografía,
    Rumores y leyendas…), y hasta que se escriben están vacíos: un título
    con nada debajo, y el mismo título en el cuadro de contenido. Un
    apartado se queda si debajo tiene algo antes del siguiente título de
    su nivel o de uno más alto; si solo tiene un subapartado con algo, se
    queda también, porque ese algo es suyo."""
    lineas = texto.split("\n")
    titulos = []          # (índice, nivel)
    en_codigo = False
    for i, linea in enumerate(lineas):
        if linea.strip().startswith("```"):
            en_codigo = not en_codigo
            continue
        if not en_codigo:
            m = RE_ENCABEZADO.match(linea)
            if m:
                titulos.append((i, len(m.group(1))))
    if not titulos:
        return texto
    fuera = set()
    for n, (i, nivel) in enumerate(titulos):
        fin = len(lineas)
        for j, otro in titulos[n + 1:]:
            if otro <= nivel:
                fin = j
                break
        dentro = [k for k in range(i + 1, fin)
                  if lineas[k].strip() and not any(k == t for t, _ in titulos)]
        if not dentro:
            fuera.add(i)
    return "\n".join(l for k, l in enumerate(lineas) if k not in fuera)


def partir(texto):
    """(frontmatter como texto, cuerpo). Sin frontmatter, el primero es ''.
    El cuerpo, ya sin las notas escondidas ni los apartados vacíos."""
    m = RE_FRONTMATTER.match(texto)
    if not m:
        return "", sin_apartados_vacios(sin_notas_escondidas(texto))
    return m.group(1), sin_apartados_vacios(sin_notas_escondidas(texto[m.end():]))


def leer_frontmatter(crudo, avisos=None):
    """El frontmatter a un diccionario, conservando el orden en que está
    escrito: ese orden es el que manda en la infobox.

    Entiende lo que escribe Chronicler y nada más:

        clave: valor                      un valor suelto
        clave: 'con [[enlaces]] dentro'   entre comillas, para no romper el YAML
        clave: [a, b]                     una lista en la misma línea
        clave: [[a.jpg, "pie"], [b, "x"]] una lista de listas (el carrusel)
        clave: |                          un texto de varias líneas, sangrado
          lo que sea
        layout:                           la única lista de bloques que hay
          - type: header
            text: Lo que sea
    """
    datos = {}
    lineas = crudo.split("\n")
    i = 0
    while i < len(lineas):
        linea = lineas[i]
        if not linea.strip() or linea.lstrip().startswith("#"):
            i += 1
            continue
        if linea[:1] in (" ", "\t"):
            # Una línea sangrada aquí arriba es la continuación de algo que
            # ya se ha comido quien la abrió; si llega hasta aquí, sobra.
            if avisos:
                avisos.di("línea sangrada que no cuelga de ninguna clave", linea.strip()[:50])
            i += 1
            continue

        if ":" not in linea:
            if avisos:
                avisos.di("línea del frontmatter sin dos puntos", linea.strip()[:50])
            i += 1
            continue

        clave, _, resto = linea.partition(":")
        clave = clave.strip()
        resto = resto.strip()

        # clave: |   -> un texto de varias líneas, todas sangradas
        if resto in ("|", "|-", ">", ">-"):
            trozos = []
            i += 1
            while i < len(lineas) and (not lineas[i].strip() or lineas[i][:1] in (" ", "\t")):
                trozos.append(re.sub(r"^[ \t]{1,4}", "", lineas[i]))
                i += 1
            junto = "\n".join(trozos).strip("\n")
            # Con ">" los saltos de línea se juntan en un párrafo; con "|"
            # se quedan como están.
            datos[clave] = re.sub(r"\s*\n\s*", " ", junto) if resto.startswith(">") else junto
            continue

        # layout:   -> la lista de reglas de la infobox
        if clave == "layout" and not resto:
            reglas, i = _leer_lista_de_bloques(lineas, i + 1, avisos)
            datos["layout"] = reglas
            continue

        if not resto:
            # clave:   sin nada detrás. Puede ser una lista con guiones.
            if i + 1 < len(lineas) and lineas[i + 1].lstrip().startswith("- "):
                items, i = _leer_lista_con_guiones(lineas, i + 1)
                datos[clave] = items
                continue
            datos[clave] = ""
            i += 1
            continue

        datos[clave] = _valor(resto)
        i += 1
    return datos


def _leer_lista_con_guiones(lineas, i):
    items = []
    while i < len(lineas) and lineas[i].lstrip().startswith("- "):
        items.append(_valor(lineas[i].lstrip()[2:].strip()))
        i += 1
    return items, i


def _leer_lista_de_bloques(lineas, i, avisos=None):
    """La lista de reglas de "layout": cada una empieza por "- " y sigue con
    líneas sangradas de "clave: valor"."""
    reglas = []
    actual = None
    while i < len(lineas):
        linea = lineas[i]
        if linea.strip() and not linea[:1] in (" ", "\t"):
            break  # se acabó el bloque: otra clave de primer nivel
        pelada = linea.strip()
        if not pelada:
            i += 1
            continue
        if pelada.startswith("- "):
            actual = {}
            reglas.append(actual)
            pelada = pelada[2:].strip()
        if actual is None:
            if avisos:
                avisos.di("regla de layout sin guion delante", pelada[:50])
            i += 1
            continue
        if ":" in pelada:
            c, _, v = pelada.partition(":")
            actual[c.strip()] = _valor(v.strip())
        elif avisos:
            avisos.di("línea de layout que no entiendo", pelada[:50])
        i += 1
    return reglas, i


def _valor(texto):
    """Un valor del frontmatter: una lista, un texto entre comillas o un
    texto suelto."""
    texto = texto.strip()
    if not texto:
        return ""
    # Entre comillas: se queda tal cual lo de dentro. Esto es lo que usa
    # Chronicler para meter [[enlaces]] o barras sin romper el YAML, así
    # que hay que mirarlo ANTES que los corchetes.
    if len(texto) >= 2 and texto[0] == texto[-1] and texto[0] in "'\"":
        return texto[1:-1]
    if texto.startswith("[") and texto.endswith("]"):
        return _lista(texto[1:-1])
    return texto


def _lista(dentro):
    """Los elementos de una lista escrita en una línea, respetando los
    corchetes de dentro (las sublistas del carrusel) y las comillas."""
    items = []
    trozo = ""
    hondo = 0
    comilla = ""
    for c in dentro:
        if comilla:
            if c == comilla:
                comilla = ""
            trozo += c
            continue
        if c in "'\"":
            comilla = c
            trozo += c
            continue
        if c == "[":
            hondo += 1
        elif c == "]":
            hondo -= 1
        if c == "," and hondo == 0:
            items.append(trozo)
            trozo = ""
            continue
        trozo += c
    if trozo.strip():
        items.append(trozo)
    return [_valor(t) for t in items]


# =========================================
# EL CUERPO: DE MARKDOWN A HTML
# =========================================
# Por bloques primero (encabezados, listas, tablas, citas…) y dentro de
# cada uno, por trozos (negrita, enlaces, spoilers…).
#
# EL ORDEN IMPORTA Y ES SIEMPRE EL MISMO:
#   1. se escapa TODO el texto, así que a partir de aquí no hay HTML;
#   2. se apartan los trozos que no se tocan (el código, los wikilinks) y
#      en su sitio se deja una marca;
#   3. se convierte lo demás;
#   4. se devuelven los trozos apartados a su marca, ya convertidos.
#
# El paso 2 es el que evita el error clásico: que un asterisco dentro de un
# bloque de código se convierta en cursiva, o que las comillas de un
# enlace se escapen dos veces.

# La marca que se deja en el hueco de un trozo apartado. Lleva caracteres
# que no se escriben a mano (U+E000 es de uso privado) para que no pueda
# salir del propio texto de una página.
MARCA = "{}"
RE_MARCA = re.compile("(\\d+)")


class Guardados:
    """Los trozos apartados, por número."""

    def __init__(self):
        self.trozos = []

    def guarda(self, html_ya_hecho):
        self.trozos.append(html_ya_hecho)
        return MARCA.format(len(self.trozos) - 1)

    def devuelve(self, texto):
        # En bucle: un trozo guardado puede contener otra marca dentro (un
        # wikilink cuyo texto es una imagen, por ejemplo).
        for _ in range(6):
            nuevo = RE_MARCA.sub(lambda m: self.trozos[int(m.group(1))], texto)
            if nuevo == texto:
                return nuevo
            texto = nuevo
        return texto


class Conversor:
    """Convierte el cuerpo de una página.

    Hace falta una clase y no una función suelta porque la conversión
    necesita saber cosas de fuera del archivo: qué páginas existen (para
    pintar en rojo los enlaces a las que no), dónde están las imágenes y
    qué páginas se han enlazado (para los backlinks).

    enlace_a(nombre)  -> (direccion, existe)  lo decide quien llama
    imagen_a(nombre)  -> direccion o ""
    """

    def __init__(self, enlace_a, imagen_a, avisos=None, inserta=None):
        self.enlace_a = enlace_a
        self.imagen_a = imagen_a
        # "avisos if avisos is not None" y NO "avisos or Avisos()": la
        # clase Avisos tiene un __bool__ que dice si TIENE avisos, así que
        # una recién creada (y vacía) vale False y el "or" se la cargaba,
        # creando otra en su lugar. Resultado: todo lo que no se entendía
        # se apuntaba en una lista que no miraba nadie, y el generador
        # decía "todo convertido" tan tranquilo. Justo lo que esto
        # pretendía evitar.
        self.avisos = avisos if avisos is not None else Avisos()
        self.inserta = inserta
        self.enlaces = []      # a qué páginas apunta ésta
        self.notas = []        # las notas al pie, en orden
        self.desnivel = 1      # lo pone a_html() al mirar el archivo

    # ---- lo de fuera ----

    def a_html(self, cuerpo):
        g = Guardados()
        # El <h1> de la página es su título, que lo pone la plantilla, así
        # que lo de dentro del cuerpo tiene que empezar en <h2>. Y empieza
        # en <h2> SEA CUAL SEA el nivel con el que esté escrito: en
        # Chronicler el título va en el frontmatter, así que los apartados
        # suelen escribirse con "##", y mapearlos a <h3> dejaría un hueco
        # en la jerarquía (un h3 colgando de un h1). Lo que se mira es el
        # nivel MÁS ALTO que use el archivo, y ése pasa a ser el h2.
        self.desnivel = self._desnivel(cuerpo)
        bloques = self._bloques(cuerpo, g)
        salida = "\n".join(bloques)
        if self.notas:
            salida += "\n" + self._pie_de_notas(g)
        return g.devuelve(salida)

    # ---- bloques ----

    def _bloques(self, cuerpo, g):
        lineas = cuerpo.replace("\r\n", "\n").split("\n")
        salida = []
        i = 0
        parrafo = []

        def cerrar():
            if parrafo:
                texto = "\n".join(parrafo).strip()
                if texto:
                    salida.append("<p>" + self._trozos(texto, g) + "</p>")
                parrafo.clear()

        while i < len(lineas):
            linea = lineas[i]
            pelada = linea.strip()

            if not pelada:
                cerrar()
                i += 1
                continue

            # ``` un bloque de código ```
            if pelada.startswith("```"):
                cerrar()
                idioma = pelada[3:].strip()
                dentro = []
                i += 1
                while i < len(lineas) and not lineas[i].strip().startswith("```"):
                    dentro.append(lineas[i])
                    i += 1
                i += 1
                clase = ' class="lenguaje-' + _slug_corto(idioma) + '"' if idioma else ""
                salida.append("<pre><code%s>%s</code></pre>"
                              % (clase, html.escape("\n".join(dentro))))
                continue

            # HTML escrito a mano: las galerías y los carruseles de
            # Chronicler son <div class="gallery"> y compañía. Se pasa tal
            # cual PERO solo lo que esté en la lista blanca de abajo: lo de
            # fuera de ella se escapa y sale como texto. El mundo lo
            # escribes tú, pero un <script> aquí sería un <script> en la
            # web, y eso no se deja a la buena voluntad.
            if pelada.startswith("<"):
                cerrar()
                dentro, i = self._html_crudo(lineas, i)
                salida.append(dentro)
                continue

            # # Encabezados
            m = re.match(r"^(#{1,6})\s+(.*)$", pelada)
            if m:
                cerrar()
                nivel = len(m.group(1))
                etiqueta = "h%d" % min(6, max(2, nivel + self.desnivel))
                texto = self._trozos(m.group(2).strip(), g)
                ancla = _slug_corto(re.sub(RE_MARCA, "", m.group(2)))
                salida.append('<%s id="%s">%s</%s>' % (etiqueta, ancla, texto, etiqueta))
                i += 1
                continue

            # --- una raya
            if re.match(r"^(-{3,}|\*{3,}|_{3,})$", pelada):
                cerrar()
                salida.append("<hr>")
                i += 1
                continue

            # > una cita
            if pelada.startswith(">"):
                cerrar()
                dentro = []
                while i < len(lineas) and lineas[i].strip().startswith(">"):
                    dentro.append(re.sub(r"^\s*>\s?", "", lineas[i]))
                    i += 1
                salida.append("<blockquote>%s</blockquote>"
                              % "\n".join(self._bloques("\n".join(dentro), g)))
                continue

            # | una tabla |
            if pelada.startswith("|") and i + 1 < len(lineas) \
                    and re.match(r"^\s*\|[\s:|-]+\|\s*$", lineas[i + 1]):
                cerrar()
                tabla, i = self._tabla(lineas, i, g)
                salida.append(tabla)
                continue

            # - una lista   /   1. una lista numerada
            if re.match(r"^([-*+]|\d+[.)])\s+", pelada):
                cerrar()
                lista, i = self._lista(lineas, i, g, sangria=len(linea) - len(linea.lstrip()))
                salida.append(lista)
                continue

            # [^1]: una nota al pie
            m = re.match(r"^\[\^([^\]]+)\]:\s*(.*)$", pelada)
            if m:
                cerrar()
                self.notas.append((m.group(1), m.group(2)))
                i += 1
                continue

            parrafo.append(linea)
            i += 1

        cerrar()
        return salida

    def _desnivel(self, cuerpo):
        """Cuánto hay que sumarle a cada encabezado para que el primero
        caiga en <h2>. Los que están dentro de un bloque de código no
        cuentan: ahí una almohadilla es una almohadilla."""
        sin_codigo = re.sub(r"^```.*?^```", "", cuerpo, flags=re.S | re.M)
        niveles = [len(m.group(1)) for m in
                   re.finditer(r"^(#{1,6})\s+\S", sin_codigo, re.M)]
        return 2 - min(niveles) if niveles else 1

    # ---- las piezas de bloque ----

    # Lo que se deja pasar del HTML escrito a mano. Son las etiquetas con
    # las que Chronicler monta galerías, carruseles y textos que rodean una
    # imagen; de todo lo demás no hay ningún ejemplo en su documentación y
    # no hay motivo para abrirle la puerta.
    ETIQUETAS_OK = {"div", "figure", "figcaption", "span", "br", "p",
                    "h2", "h3", "h4", "em", "strong", "small"}
    CLASES_OK = {"gallery", "carousel", "tabbed", "float-container",
                 "float-left", "float-right", "small", "large",
                 "portrait", "landscape",
                 # Las piezas que pone el generador en su sitio (ver
                 # con_piezas en generar-mundo.py).
                 "pieza-relaciones", "pieza-panteon", "pieza-diccionario",
                 "pieza-conversor", "pieza-nombres"}

    def _html_crudo(self, lineas, i):
        """Un trozo de HTML escrito a mano en la página: se recoge hasta la
        línea en blanco y se pasa por la lista blanca."""
        dentro = []
        while i < len(lineas) and lineas[i].strip():
            dentro.append(lineas[i])
            i += 1
        crudo = "\n".join(dentro)
        g = Guardados()
        # Lo de dentro puede llevar ![[imágenes]] y **negritas**: se
        # convierten como en cualquier otro sitio, pero sin envolverlo en
        # un <p>, que rompería la galería.
        convertido = self._trozos(crudo, g, escapar=False)
        return g.devuelve(self._cerner(convertido)), i

    def _cerner(self, texto):
        """Deja las etiquetas de la lista blanca y escapa las demás."""
        def una(m):
            entera, cierre, nombre, resto = m.group(0), m.group(1), m.group(2).lower(), m.group(3)
            if nombre not in self.ETIQUETAS_OK:
                self.avisos.di("etiqueta HTML que no dejo pasar", "<" + nombre + ">")
                return html.escape(entera)
            if cierre:
                return "</%s>" % nombre
            clases = re.findall(r'class\s*=\s*"([^"]*)"', resto)
            buenas = []
            for c in " ".join(clases).split():
                if c in self.CLASES_OK:
                    buenas.append(c)
                else:
                    self.avisos.di("clase que no dejo pasar", c)
            # Se tira TODO lo demás del atributo: un style, un onclick o un
            # id no hacen falta para una galería y sí harían falta para
            # colar algo.
            return "<%s%s>" % (nombre, ' class="%s"' % " ".join(buenas) if buenas else "")
        return re.sub(r"<(/?)([A-Za-z][\w-]*)((?:\s[^<>]*)?)/?>", una, texto)

    def _tabla(self, lineas, i, g):
        def celdas(linea):
            fila = linea.strip()
            if fila.startswith("|"):
                fila = fila[1:]
            if fila.endswith("|"):
                fila = fila[:-1]
            # La barra escapada (\|) es un carácter, no un separador: es lo
            # que usa Chronicler para meter un [[enlace|con texto]] dentro
            # de una tabla.
            trozos = re.split(r"(?<!\\)\|", fila)
            return [t.strip().replace("\\|", "|") for t in trozos]

        cabecera = celdas(lineas[i])
        alineacion = []
        for c in celdas(lineas[i + 1]):
            izq, der = c.startswith(":"), c.endswith(":")
            alineacion.append("center" if izq and der else "right" if der
                              else "left" if izq else "")
        i += 2
        filas = []
        while i < len(lineas) and lineas[i].strip().startswith("|"):
            filas.append(celdas(lineas[i]))
            i += 1

        def pinta(etiqueta, valores):
            trozos = []
            for n, v in enumerate(valores):
                a = alineacion[n] if n < len(alineacion) else ""
                estilo = ' class="al-%s"' % a if a else ""
                trozos.append("<%s%s>%s</%s>" % (etiqueta, estilo, self._trozos(v, g), etiqueta))
            return "<tr>" + "".join(trozos) + "</tr>"

        salida = ["<div class=\"mundo-tabla\"><table>"]
        salida.append("<thead>" + pinta("th", cabecera) + "</thead>")
        if filas:
            salida.append("<tbody>" + "".join(pinta("td", f) for f in filas) + "</tbody>")
        salida.append("</table></div>")
        return "".join(salida), i

    def _lista(self, lineas, i, g, sangria):
        """Una lista, con las de dentro. La sangría manda: dos espacios más
        que la de arriba es una lista dentro de la anterior."""
        primera = lineas[i].strip()
        numerada = bool(re.match(r"^\d+[.)]\s+", primera))
        items = []
        while i < len(lineas):
            linea = lineas[i]
            if not linea.strip():
                # Una línea en blanco corta la lista salvo que lo de después
                # siga sangrado dentro de ella.
                if i + 1 < len(lineas) and lineas[i + 1].strip() and \
                        (len(lineas[i + 1]) - len(lineas[i + 1].lstrip())) > sangria:
                    i += 1
                    continue
                break
            suya = len(linea) - len(linea.lstrip())
            if suya < sangria:
                break
            m = re.match(r"^([-*+]|\d+[.)])\s+(.*)$", linea.strip())
            if suya == sangria and m:
                items.append([m.group(2)])
                i += 1
                continue
            if not items:
                break
            if suya > sangria and re.match(r"^([-*+]|\d+[.)])\s+", linea.strip()):
                dentro, i = self._lista(lineas, i, g, sangria=suya)
                items[-1].append(("lista", dentro))
                continue
            items[-1].append(linea.strip())
            i += 1

        etiqueta = "ol" if numerada else "ul"
        trozos = []
        for item in items:
            texto = []
            extra = []
            for parte in item:
                if isinstance(parte, tuple):
                    extra.append(parte[1])
                else:
                    texto.append(parte)
            trozos.append("<li>" + self._trozos(" ".join(texto).strip(), g)
                          + "".join(extra) + "</li>")
        return "<%s>%s</%s>" % (etiqueta, "".join(trozos), etiqueta), i

    def _pie_de_notas(self, g):
        filas = []
        for marca, texto in self.notas:
            filas.append('<li id="nota-%s">%s <a class="mundo-nota-vuelta" href="#vuelta-%s"'
                         ' aria-label="Volver al texto">↩</a></li>'
                         % (_slug_corto(marca), self._trozos(texto, g), _slug_corto(marca)))
        return ('<div class="mundo-notas"><h2>Notas</h2><ol>%s</ol></div>'
                % "".join(filas))

    # ---- trozos de dentro de una línea ----

    def _trozos(self, texto, g, escapar=True):
        if escapar:
            texto = html.escape(texto, quote=False)
        else:
            # Ya viene con el HTML de la galería dentro: se escapan solo los
            # & sueltos, para no romper las entidades que pueda haber.
            texto = re.sub(r"&(?![A-Za-z#][A-Za-z0-9]{1,8};)", "&amp;", texto)

        # 1. El código, lo primero: dentro no se toca nada.
        texto = re.sub(r"`([^`]+)`",
                       lambda m: g.guarda("<code>" + m.group(1) + "</code>"), texto)

        # 2. Las inserciones de página: {{insert: Nombre | title="x" | hidden}}
        texto = re.sub(r"\{\{\s*insert\s*:\s*([^}]+)\}\}",
                       lambda m: g.guarda(self._insercion(m.group(1))), texto)

        # 3. Las imágenes ![[archivo.webp]] y ![[archivo.webp|texto alternativo]]
        texto = re.sub(r"!\[\[([^\]\|]+)(?:\|([^\]]*))?\]\]",
                       lambda m: g.guarda(self._imagen(m.group(1), m.group(2))), texto)

        # 4. Los wikilinks, en sus cuatro formas. Después de las imágenes,
        #    porque [[Página|![[foto.webp]]]] lleva una dentro.
        texto = re.sub(r"\[\[([^\]\|#]+)(?:#([^\]\|]+))?(?:\\?\|([^\]]*))?\]\]",
                       lambda m: g.guarda(self._enlace(m.group(1), m.group(2), m.group(3))),
                       texto)

        # 5. Las imágenes y enlaces de Markdown de toda la vida.
        texto = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)",
                       lambda m: g.guarda(self._imagen_suelta(m.group(2), m.group(1))), texto)
        texto = re.sub(r"\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)",
                       lambda m: g.guarda(self._enlace_suelto(m.group(2), m.group(1))), texto)

        # 6. Las notas al pie.
        texto = re.sub(r"\[\^([^\]]+)\]",
                       lambda m: g.guarda(
                           '<sup class="mundo-nota"><a id="vuelta-%s" href="#nota-%s">%s</a></sup>'
                           % (_slug_corto(m.group(1)), _slug_corto(m.group(1)),
                              html.escape(m.group(1)))), texto)

        # 7. Los spoilers ||así||, ANTES que la cursiva: con dos barras no
        #    hay confusión posible, y después ya no quedan barras sueltas.
        texto = re.sub(r"\|\|(.+?)\|\|",
                       lambda m: '<span class="mundo-spoiler" tabindex="0" role="button">'
                                 + m.group(1) + "</span>", texto, flags=re.S)

        # 8. Y lo de siempre. El orden entre ellos también importa: dos
        #    asteriscos antes que uno, o "**a**" saldría como cursiva de
        #    "*a*".
        texto = re.sub(r"(?<!\w)\*\*(?=\S)(.+?)(?<=\S)\*\*(?!\w)", r"<strong>\1</strong>", texto)
        texto = re.sub(r"(?<!\w)__(?=\S)(.+?)(?<=\S)__(?!\w)", r"<strong>\1</strong>", texto)
        texto = re.sub(r"(?<!\w)\*(?=\S)([^*]+?)(?<=\S)\*(?!\w)", r"<em>\1</em>", texto)
        texto = re.sub(r"(?<!\w)_(?=\S)([^_]+?)(?<=\S)_(?!\w)", r"<em>\1</em>", texto)
        texto = re.sub(r"~~(?=\S)(.+?)(?<=\S)~~", r"<del>\1</del>", texto)

        # 9. Lo que Chronicler sabe hacer y esto no: se deja como está y se
        #    apunta, en vez de convertirlo a medias.
        if re.search(r"(?<!\\)\$\$?[^$]+\$\$?", texto):
            self.avisos.di("fórmulas con $…$ (KaTeX): salen como texto", texto.strip()[:60])

        # 10. La barra invertida de escape, al final: hasta aquí ha servido
        #     para que un * o un | no contaran.
        texto = re.sub(r"\\([\\`*_{}\[\]()#+\-.!|~])", r"\1", texto)
        return texto

    def _insercion(self, crudo):
        trozos = [t.strip() for t in re.split(r"(?<!\\)\|", crudo)]
        nombre = trozos[0].strip()
        titulo = ""
        clases = ["mundo-insercion"]
        for opcion in trozos[1:]:
            m = re.match(r'title\s*=\s*&quot;(.*)&quot;$', opcion) or \
                re.match(r'title\s*=\s*"(.*)"$', opcion)
            if m:
                titulo = m.group(1)
                continue
            # Las clases van ESCRITAS ENTERAS y no pegadas con un "+":
            # escritas a trozos ("es-" + opcion) no se encuentran
            # buscándolas, y el repaso de clases CSS sin usar las daba por
            # muertas estando vivas.
            if opcion in OPCIONES_DE_INSERCION:
                clases.append(OPCIONES_DE_INSERCION[opcion])
                continue
            if opcion == "hidden":
                # En Chronicler, "hidden" hace que la inserción salga
                # plegada y se abra pulsando. Aquí no: una página dentro de
                # otra se lee seguida, y esconderla detrás de un botón en
                # una web que también se imprime es perderla. Se avisa en
                # vez de hacerla desaparecer sin decir nada.
                self.avisos.di("inserción «hidden»: aquí sale abierta", nombre[:40])
                continue
            if opcion:
                self.avisos.di("opción de inserción que no conozco", opcion[:40])
        if self.inserta is None:
            self.avisos.di("inserción de página sin nada que insertar", nombre[:40])
            return ""
        return self.inserta(nombre, titulo, clases)

    def _imagen(self, nombre, alterno):
        ruta = self.imagen_a(nombre.strip())
        if not ruta:
            self.avisos.di("imagen que no encuentro", nombre.strip())
            return '<span class="mundo-falta">falta la imagen «%s»</span>' % html.escape(nombre.strip())
        return self._imagen_suelta(ruta, alterno or "")

    def _imagen_suelta(self, ruta, alterno):
        if not _direccion_segura(ruta):
            # Una imagen DE LA BÓVEDA, pero nombrada a la manera de
            # Markdown: ![pie](_imagenes/mapas/mapamundi.webp). No es una
            # dirección de la web, es un archivo de al lado, así que se
            # busca igual que si estuviera escrita ![[así]].
            dentro = self.imagen_a((ruta or "").strip())
            if dentro:
                ruta = dentro
        if not _direccion_segura(ruta):
            self.avisos.di("dirección de imagen que no vale", ruta[:60])
            return ""
        return ('<img class="mundo-img" src="%s" alt="%s" loading="lazy" decoding="async">'
                % (html.escape(ruta, quote=True), html.escape(alterno or "", quote=True)))

    def _enlace(self, pagina, ancla, texto):
        pagina = pagina.strip()
        destino, existe = self.enlace_a(pagina)
        self.enlaces.append(pagina)
        if ancla:
            destino += "#" + _slug_corto(ancla)
        visible = texto if texto is not None and texto != "" else pagina
        if not existe:
            # Un enlace a una página que todavía no está escrita. Se queda
            # como texto con una marca, no como enlace: un enlace que no
            # lleva a ninguna parte es peor que ninguno. Es el "enlace
            # rojo" de las wikis de siempre.
            return ('<span class="mundo-enlace-vacio" title="Todavía no hay página de «%s»">%s</span>'
                    % (html.escape(pagina, quote=True), visible))
        return '<a class="mundo-enlace" href="%s">%s</a>' % (html.escape(destino, quote=True), visible)

    def _enlace_suelto(self, destino, texto):
        if not _direccion_segura(destino):
            self.avisos.di("dirección de enlace que no vale", destino[:60])
            return texto
        fuera = ' class="mundo-enlace enlace-fuera" target="_blank" rel="noopener noreferrer"' \
            if destino.startswith("http") else ' class="mundo-enlace"'
        return '<a%s href="%s">%s</a>' % (fuera, html.escape(destino, quote=True), texto)


# =========================================
# PIEZAS SUELTAS
# =========================================

def _direccion_segura(url):
    """Lo mismo que hace el JavaScript del sitio: una dirección de aquí
    (que empiece por "/" pero no por "//"), una http(s), un correo o un
    ancla. Lo demás —"javascript:", "data:"— no es una dirección."""
    limpia = (url or "").strip()
    return bool(re.match(r"^/(?!/)", limpia) or
                re.match(r"^(https?://|mailto:|#)", limpia, re.I))


def _slug_corto(texto):
    """"El Río Lento" -> "el_rio_lento". Para las direcciones de las
    páginas y las anclas de los encabezados."""
    import unicodedata
    plano = "".join(c for c in unicodedata.normalize("NFD", (texto or "").lower())
                    if unicodedata.category(c) != "Mn")
    return re.sub(r"^_+|_+$", "", re.sub(r"[^a-z0-9]+", "_", plano)) or "pagina"
