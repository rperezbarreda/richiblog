// =========================================
// EL EDITOR DE TEXTO (como en un procesador de textos)
// =========================================
// Lo usan las entradas, los relatos y las notas de las partidas
// (escribir.js). Se escribe y se ve cómo queda: con botones (y sus atajos)
// para negrita, cursiva, títulos, listas, citas, enlaces, imágenes,
// tablas… y por detrás sale el mismo HTML que se escribiría a mano en la
// entrada (el de herramientas/5-consulta/ejemplo-formatos.html).
//
// CÓMO: una caja con contenteditable y document.execCommand, que es lo que
// entiende el navegador de Richi sin nada instalado. Lo que sale se pasa
// por limpiarRedactor: <b> pasa a <strong>, <i> a <em>, los <div> a
// párrafos, y se quita lo que no tiene que estar (estilos pegados de otra
// web, spans, <font>…). Lo que se PEGA, igual. Y el servidor lo vuelve a
// mirar al guardar (editor_web.limpiar).
//
// Sin <dialog>: para un enlace, una imagen o una tabla se abre un panel
// debajo de los botones, en su sitio.

const ETIQUETAS_DEL_REDACTOR = {
    // etiqueta: atributos que se quedan
    p: [], h2: [], h3: [], h4: [], strong: [], em: [], s: [], code: [], pre: [], br: [], hr: [],
    a: ["href", "target", "rel"], ul: [], ol: [], li: [], blockquote: [], figure: [], figcaption: [],
    img: ["src", "alt", "width", "height", "loading", "decoding"], table: [], thead: [], tbody: [], tr: [],
    th: [], td: [], sub: [], sup: [],
};
// Lo que se cambia por otra cosa al limpiar.
const CAMBIOS_DEL_REDACTOR = { b: "strong", i: "em", strike: "s", del: "s", h1: "h2", h5: "h4", h6: "h4" };
const BLOQUES_DEL_REDACTOR = ["p", "h2", "h3", "h4", "ul", "ol", "pre", "blockquote", "figure", "table", "hr"];
let cuentaDeRedactores = 0;
// Las barras de botones que se van con el texto al bajar (ver
// seguirConLaBarra, al final).
const BARRAS_QUE_SIGUEN = [];

// LOS ICONOS DE LOS BOTONES, como los de un procesador de textos. Cada uno,
// lo de dentro de un <svg viewBox="0 0 24 24">: rayas del color del texto
// (stroke) y, las letras, un <text>. El nombre del botón lo lleva su
// aria-label, y lo que hace sale en un globo al pasar por encima o al
// llegar con el tabulador (data-ayuda; ver .redactor-boton en editor.css).
const LETRA_DEL_REDACTOR = (letra, mas) => '<text x="12" y="19" text-anchor="middle" font-size="21" '
    + 'font-family="Georgia, serif" fill="currentColor" stroke="none" ' + (mas || "") + ">" + letra + "</text>";
const ICONOS_DEL_REDACTOR = {
    negrita: LETRA_DEL_REDACTOR("B", 'font-weight="700"'),
    cursiva: LETRA_DEL_REDACTOR("I", 'font-style="italic" font-weight="700"'),
    tachado: LETRA_DEL_REDACTOR("S", 'font-weight="700"') + '<path d="M3 12.5h18"/>',
    codigo: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
    parrafo: LETRA_DEL_REDACTOR("¶", 'font-weight="700"'),
    titulo: LETRA_DEL_REDACTOR("T", 'font-weight="700" font-size="21"'),
    subtitulo: LETRA_DEL_REDACTOR("T", 'font-weight="700" font-size="14"') + '<path d="M6 21h12" opacity="0.6"/>',
    lista: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1.4" fill="currentColor"/>'
        + '<circle cx="4" cy="12" r="1.4" fill="currentColor"/><circle cx="4" cy="18" r="1.4" fill="currentColor"/>',
    numerada: '<path d="M10 6h11M10 12h11M10 18h11"/><g stroke-width="1.5"><path d="M2.8 4.6l1.5-.8v4.4"/>'
        + '<path d="M2.6 11a1.3 1.3 0 0 1 2.5.5c0 .8-2.5 2.4-2.5 2.4h2.6"/>'
        + '<path d="M2.6 16.2h2.4l-1.3 1.5a1.3 1.3 0 1 1-1.2 1.9"/></g>',
    cita: '<text x="12" y="25" text-anchor="middle" font-size="32" font-weight="700" font-family="Georgia, serif" '
        + 'fill="currentColor" stroke="none">\u201C</text>',
    bloque: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 9l-3 3 3 3M14 9l3 3-3 3"/>',
    enlace: '<path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/>'
        + '<path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/>',
    sinEnlace: '<path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/>'
        + '<path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/><path d="M3 3l18 18"/>',
    imagen: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/>'
        + '<path d="M21 16l-6-6L5 20"/>',
    tabla: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
    raya: '<path d="M3 12h18" stroke-width="2.6"/><path d="M6 6h12M6 18h12" opacity="0.45"/>',
    deshacer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    rehacer: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    html: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8.5 9l-3 3 3 3M15.5 9l3 3-3 3M13.2 8l-2.4 8"/>',
    npcNuevo: '<circle cx="10" cy="8" r="4"/><path d="M2 21a8 8 0 0 1 14.5-4.6"/><path d="M19 14v7M15.5 17.5h7"/>',
    personaje: '<circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21a8 8 0 0 1 16 0z" fill="currentColor"/>',
    alguien: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    lugar: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    objetos: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    carpeta: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
    wikiEnlace: '<path d="M7 4H4v16h3M17 4h3v16h-3"/><path d="M10 12h4"/>',
};

// Un icono, para meterlo en un botón (lo lee el aria-label, no él).
function iconoRedactor(nombre) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", "redactor-icono");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.innerHTML = ICONOS_DEL_REDACTOR[nombre] || "";
    return svg;
}

// Un botón de icono: se lee «texto» (y el atajo, si lo hay en la ayuda);
// en pantalla, el icono y, encima, el globo con la ayuda entera.
function botonDeIconoRedactor(texto, ayuda, icono) {
    const b = crearEditor("button", "redactor-boton");
    b.type = "button";
    const atajo = (ayuda || "").match(/\((Ctrl\+[^)]+)\)/);
    b.setAttribute("aria-label", texto + (atajo ? " (" + atajo[1] + ")" : ""));
    if (atajo) {
        b.setAttribute("aria-keyshortcuts", atajo[1].replace("Ctrl", "Control"));
    }
    b.dataset.ayuda = ayuda || texto;
    // El globo, que no se salga de la pantalla: cerca de un borde, pegado
    // a ese lado del botón en vez de centrado.
    const colocarGlobo = () => {
        const r = b.getBoundingClientRect();
        b.classList.toggle("globo-a-la-izquierda", r.left + r.width / 2 > window.innerWidth - 150);
        b.classList.toggle("globo-a-la-derecha", r.left + r.width / 2 < 150);
    };
    b.addEventListener("mouseenter", colocarGlobo);
    b.addEventListener("focus", colocarGlobo);
    if (icono && ICONOS_DEL_REDACTOR[icono]) {
        b.classList.add("es-icono");
        b.appendChild(iconoRedactor(icono));
    } else {
        // Sin icono, su nombre escrito (y entonces el nombre es lo que se ve).
        b.removeAttribute("aria-label");
        b.textContent = texto;
    }
    return b;
}

// Una dirección que vale en un enlace o en una imagen: de la web (/…), de
// fuera (https://…), un #ancla o un correo.
function direccionBuenaRedactor(url) {
    return /^(https?:\/\/|\/(?!\/)|#|mailto:)/i.test((url || "").trim());
}

// El HTML de fuera (el de la página, o lo pegado) como nodos de verdad,
// pero sin que se ejecute nada: se lee en un documento aparte.
function leerHtmlRedactor(html) {
    const doc = new DOMParser().parseFromString("<body>" + (html || "") + "</body>", "text/html");
    return doc.body;
}

// LIMPIAR: deja solo lo de ETIQUETAS_DEL_REDACTOR (y las clases que diga
// «clases», para las notas: pj-verde, cuaderno-objetos…), con sus
// atributos buenos. Lo demás se desenvuelve (se queda lo de dentro).
function limpiarRedactor(raiz, clases) {
    const clasesBuenas = clases || /^$/;
    const limpiarUno = (nodo) => {
        [...nodo.childNodes].forEach((hijo) => {
            if (hijo.nodeType === Node.COMMENT_NODE) {
                hijo.remove();
                return;
            }
            if (hijo.nodeType !== Node.ELEMENT_NODE) {
                return;
            }
            let nombre = hijo.tagName.toLowerCase();
            if (["script", "style", "iframe", "object", "embed", "meta", "link", "form", "input", "button",
                "textarea", "select", "template", "svg", "math"].includes(nombre)) {
                hijo.remove();
                return;
            }
            if (nombre === "div" && hijo.parentNode === raiz) {
                nombre = "p";
            }
            if (CAMBIOS_DEL_REDACTOR[nombre]) {
                nombre = CAMBIOS_DEL_REDACTOR[nombre];
            }
            // Un <span> que viene de pegar con negrita o cursiva por estilo.
            if (nombre === "span" && !(hijo.className && clasesBuenas.test(hijo.className))) {
                const peso = hijo.style && hijo.style.fontWeight;
                const estilo = hijo.style && hijo.style.fontStyle;
                if (peso === "bold" || Number(peso) >= 600) {
                    nombre = "strong";
                } else if (estilo === "italic") {
                    nombre = "em";
                }
            }
            if (!ETIQUETAS_DEL_REDACTOR[nombre] && !(nombre === "span" && hijo.className
                && clasesBuenas.test(hijo.className))) {
                limpiarUno(hijo);
                if (nombre === "div" || nombre === "section" || nombre === "article") {
                    // Un bloque dentro de otro: lo de dentro, en párrafos.
                    const p = document.createElement("p");
                    while (hijo.firstChild) {
                        p.appendChild(hijo.firstChild);
                    }
                    hijo.replaceWith(p);
                } else {
                    hijo.replaceWith(...hijo.childNodes);
                }
                return;
            }
            let nuevo = hijo;
            if (nombre !== hijo.tagName.toLowerCase()) {
                nuevo = document.createElement(nombre);
                while (hijo.firstChild) {
                    nuevo.appendChild(hijo.firstChild);
                }
                hijo.replaceWith(nuevo);
            }
            const buenos = ETIQUETAS_DEL_REDACTOR[nombre] || [];
            const clase = (hijo.getAttribute("class") || "").split(/\s+/).filter((c) => clasesBuenas.test(c)).join(" ");
            // Los valores, antes de vaciar: si no cambia de etiqueta, «nuevo»
            // es el mismo elemento y se quedaría sin ellos.
            const antes = {};
            buenos.forEach((a) => {
                antes[a] = hijo.getAttribute(a);
            });
            [...nuevo.attributes].forEach((a) => nuevo.removeAttribute(a.name));
            buenos.forEach((a) => {
                const valor = antes[a];
                if (valor === null) {
                    return;
                }
                if ((a === "href" || a === "src") && !direccionBuenaRedactor(valor)) {
                    return;
                }
                nuevo.setAttribute(a, valor);
            });
            if (clase) {
                nuevo.setAttribute("class", clase);
            }
            limpiarUno(nuevo);
        });
    };
    limpiarUno(raiz);
    // Lo que se ha quedado suelto arriba (texto, una negrita…), en párrafos.
    let suelto = null;
    [...raiz.childNodes].forEach((hijo) => {
        const esBloque = hijo.nodeType === Node.ELEMENT_NODE && BLOQUES_DEL_REDACTOR.includes(hijo.tagName.toLowerCase());
        if (esBloque) {
            suelto = null;
            return;
        }
        if (hijo.nodeType === Node.TEXT_NODE && !hijo.textContent.trim() && !suelto) {
            hijo.remove();
            return;
        }
        if (hijo.nodeType === Node.ELEMENT_NODE && hijo.tagName === "BR" && !suelto) {
            hijo.remove();
            return;
        }
        if (!suelto) {
            suelto = document.createElement("p");
            hijo.before(suelto);
        }
        suelto.appendChild(hijo);
    });
    // Los párrafos vacíos (los <p><br></p> que deja el navegador), fuera.
    raiz.querySelectorAll("p, h2, h3, h4, li, blockquote").forEach((b) => {
        if (!b.textContent.trim() && !b.querySelector("img")) {
            b.remove();
        }
    });
    // Un <br> al final de un párrafo no hace nada; fuera también.
    raiz.querySelectorAll("p > br:last-child, li > br:last-child").forEach((br) => br.remove());
    return raiz;
}

// El HTML limpio, un bloque por línea (así se lee bien si se abre el
// archivo a mano).
function htmlDelRedactor(raiz) {
    return [...raiz.childNodes].map((n) => (n.nodeType === Node.ELEMENT_NODE ? n.outerHTML : n.textContent.trim()))
        .filter(Boolean).join("\n");
}

// UN EDITOR. opciones:
//   etiqueta   el texto de su etiqueta (lo que lee el lector de pantalla)
//   enLinea    solo cosas de dentro de un párrafo (para un pie de foto)
//   clases     las clases que se quedan (una expresión regular)
//   extras     botones de más: [{texto, ayuda, hacer(redactor)}]
//   imagenes   {sitio, campos} para subir imágenes; sin esto, no hay botón
//   enlaces    (enlazables) => grupos para el buscador de [[ (ver
//              buscadorDeEnlaceRedactor); sin esto, las páginas de la wiki
// Devuelve {caja, ponerHTML, darHTML, foco, alCambiar}.
function crearRedactor(opciones) {
    cuentaDeRedactores += 1;
    const n = cuentaDeRedactores;
    const o = opciones || {};
    const caja = crearEditor("div", "redactor" + (o.enLinea ? " es-en-linea" : ""));
    const barra = crearEditor("div", "redactor-botones");
    barra.setAttribute("role", "toolbar");
    barra.setAttribute("aria-label", "Formato: " + (o.etiqueta || "texto"));
    const panel = crearEditor("div", "redactor-panel");
    panel.hidden = true;
    const area = crearEditor("div", "redactor-area" + (o.grande ? " es-grande" : ""));
    area.contentEditable = "true";
    area.setAttribute("role", "textbox");
    area.setAttribute("aria-multiline", o.enLinea ? "false" : "true");
    area.setAttribute("aria-label", o.etiqueta || "Texto");
    area.spellcheck = true;
    area.lang = "es";
    const fuente = document.createElement("textarea");
    fuente.className = "redactor-fuente";
    fuente.hidden = true;
    fuente.spellcheck = false;
    fuente.setAttribute("aria-label", (o.etiqueta || "Texto") + ", en HTML");
    caja.appendChild(barra);
    seguirConLaBarra(barra, caja);
    caja.appendChild(panel);
    caja.appendChild(area);
    caja.appendChild(fuente);

    const yo = { caja, area, alCambiar: null };
    let guardada = null;
    const avisar = () => {
        if (yo.alCambiar) {
            yo.alCambiar();
        }
    };
    const recordarSeleccion = () => {
        const sel = window.getSelection();
        if (sel.rangeCount && area.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            guardada = sel.getRangeAt(0).cloneRange();
        }
    };
    // Lo elegido antes de ir a un botón o a un panel. Si el foco sigue en
    // el texto (un atajo de teclado), la selección de ahora es la buena: la
    // guardada puede ir una letra por detrás.
    const volverASeleccion = () => {
        if (document.activeElement === area) {
            return;
        }
        area.focus({ preventScroll: true });
        if (guardada) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(guardada);
        }
    };
    const hacer = (orden, valor) => {
        volverASeleccion();
        document.execCommand("styleWithCSS", false, false);
        document.execCommand(orden, false, valor === undefined ? null : valor);
        recordarSeleccion();
        pintarEstado();
        avisar();
    };
    const meterHtml = (html) => {
        volverASeleccion();
        document.execCommand("insertHTML", false, html);
        recordarSeleccion();
        avisar();
    };
    // Una cosa que va sola, entre párrafos (una imagen, una tabla): no en
    // el sitio del cursor, que puede estar a mitad de una frase o de un
    // punto de una lista (el navegador la partiría en dos y la imagen se
    // saldría de su <figure>), sino DETRÁS del párrafo, la lista o lo que
    // sea donde está el cursor. Si está en una línea vacía, en su lugar.
    const meterBloque = (html) => {
        volverASeleccion();
        const sel = window.getSelection();
        let nodo = sel.rangeCount && area.contains(sel.anchorNode) ? sel.anchorNode : null;
        while (nodo && nodo.parentNode !== area) {
            nodo = nodo.parentNode;
        }
        // Con el cursor justo detrás, el navegador lo vuelve a meter en lo
        // de antes (en el último punto de la lista): por eso se pone ahí una
        // línea vacía de usar y tirar y se cambia por lo que va.
        const rango = document.createRange();
        if (nodo && nodo.nodeType === 1 && !nodo.textContent.trim() && !nodo.querySelector("img, table, hr")) {
            rango.selectNode(nodo);
        } else {
            const hueco = document.createElement("p");
            hueco.appendChild(document.createElement("br"));
            if (nodo) {
                nodo.after(hueco);
            } else {
                area.appendChild(hueco);
            }
            rango.selectNode(hueco);
        }
        sel.removeAllRanges();
        sel.addRange(rango);
        document.execCommand("insertHTML", false, html);
        recordarSeleccion();
        avisar();
    };
    yo.hacer = hacer;
    yo.meterHtml = meterHtml;
    // Un elemento donde está el cursor, y el cursor detrás (fuera de él).
    // Con el DOM y no con insertHTML, que se come el espacio de antes.
    yo.meterNodo = (nodo) => {
        volverASeleccion();
        const sel = window.getSelection();
        if (!sel.rangeCount || !area.contains(sel.anchorNode)) {
            area.appendChild(nodo);
        } else {
            const rango = sel.getRangeAt(0);
            rango.deleteContents();
            rango.insertNode(nodo);
        }
        const tope = document.createTextNode("\u200B");
        nodo.after(tope);
        const nuevo = document.createRange();
        nuevo.setStart(tope, 1);
        nuevo.collapse(true);
        sel.removeAllRanges();
        sel.addRange(nuevo);
        recordarSeleccion();
        avisar();
    };
    yo.recordar = recordarSeleccion;
    // Lo elegido, envuelto en una etiqueta (con su clase).
    // siNada: si no hay nada elegido, se mete ese texto ya envuelto
    // (el nombre de un personaje, por ejemplo).
    // detras: después, el cursor detrás (y no lo envuelto elegido).
    yo.envolver = (etiqueta, clase, siNada, detras) => {
        volverASeleccion();
        const sel = window.getSelection();
        if (!sel.rangeCount || (sel.isCollapsed && !siNada) || !area.contains(sel.anchorNode)) {
            avisarEditor("Primero elige (marca) el texto al que se lo quieres poner.", true);
            return;
        }
        const rango = sel.getRangeAt(0);
        const el = document.createElement(etiqueta);
        if (clase) {
            el.className = clase;
        }
        const vacia = sel.isCollapsed || !!detras;
        const sinElegir = sel.isCollapsed;
        el.appendChild(sinElegir ? document.createTextNode(siNada) : rango.extractContents());
        // Lo de dentro sin las mismas marcas (no <strong> dentro de <strong>).
        el.querySelectorAll(etiqueta).forEach((x) => x.replaceWith(...x.childNodes));
        rango.insertNode(el);
        sel.removeAllRanges();
        const nuevo = document.createRange();
        if (vacia) {
            // Se sigue escribiendo detrás, fuera de la marca: el navegador
            // metería lo siguiente dentro, así que va un carácter invisible
            // de tope (darHTML lo quita).
            const tope = document.createTextNode("\u200B");
            el.after(tope);
            nuevo.setStart(tope, 1);
            nuevo.collapse(true);
        } else {
            nuevo.selectNodeContents(el);
        }
        sel.addRange(nuevo);
        recordarSeleccion();
        avisar();
    };

    // ---- LOS BOTONES ----
    const botones = [];
    const boton = (texto, ayuda, alPulsar, estado, icono) => {
        const b = botonDeIconoRedactor(texto, ayuda, icono);
        if (estado) {
            b.setAttribute("aria-pressed", "false");
            b.dataset.estado = estado;
        }
        // Que pulsar el botón no le quite la selección al texto.
        b.addEventListener("mousedown", (e) => e.preventDefault());
        b.addEventListener("click", alPulsar);
        barra.appendChild(b);
        botones.push(b);
        return b;
    };
    const grupo = () => barra.appendChild(crearEditor("span", "redactor-hueco")).setAttribute("aria-hidden", "true");

    boton("Negrita", "Negrita (Ctrl+B)", () => hacer("bold"), "bold", "negrita");
    boton("Cursiva", "Cursiva (Ctrl+I)", () => hacer("italic"), "italic", "cursiva");
    boton("Tachado", "Tachado", () => hacer("strikeThrough"), "strikeThrough", "tachado");
    boton("Código", "Código, en una frase", () => yo.envolver("code"), null, "codigo");
    if (!o.enLinea) {
        grupo();
        boton("Párrafo", "Párrafo: texto normal", () => hacer("formatBlock", "<p>"), "p", "parrafo");
        boton("Título", "Título de apartado", () => hacer("formatBlock", "<h2>"), "h2", "titulo");
        boton("Subtítulo", "Subtítulo: algo dentro de un apartado", () => hacer("formatBlock", "<h3>"), "h3", "subtitulo");
        grupo();
        boton("Lista", "Lista de puntos", () => hacer("insertUnorderedList"), "insertUnorderedList", "lista");
        boton("Lista numerada", "Lista numerada", () => hacer("insertOrderedList"), "insertOrderedList", "numerada");
        boton("Cita", "Cita", () => hacer("formatBlock", "<blockquote>"), "blockquote", "cita");
        boton("Código en bloque", "Código en bloque (sale tal cual, con sus espacios)",
            () => hacer("formatBlock", "<pre>"), "pre", "bloque");
    }
    grupo();
    boton("Enlace", "Poner un enlace (Ctrl+K)", () => abrirPanel("enlace"), null, "enlace");
    boton("Quitar enlace", "Quitar el enlace", () => hacer("unlink"), null, "sinEnlace");
    if (!o.enLinea) {
        if (o.imagenes) {
            boton("Imagen", "Meter una imagen en el texto", () => abrirPanel("imagen"), null, "imagen");
        }
        boton("Tabla", "Meter una tabla", () => abrirPanel("tabla"), null, "tabla");
        boton("Raya", "Una raya para separar (un corte fuerte)", () => hacer("insertHorizontalRule"), null, "raya");
    }
    (o.extras || []).forEach((x) => {
        if (x.separar) {
            grupo();
        }
        if (x.elemento) {
            barra.appendChild(x.elemento);
            return;
        }
        boton(x.texto, x.ayuda || x.texto, () => x.hacer(yo), null, x.icono);
    });
    grupo();
    boton("Deshacer", "Deshacer (Ctrl+Z)", () => hacer("undo"), null, "deshacer");
    boton("Rehacer", "Rehacer (Ctrl+Y)", () => hacer("redo"), null, "rehacer");
    if (!o.enLinea) {
        const verHtml = boton("Ver el HTML", "Ver (y cambiar) el HTML de este texto", () => {
            const enHtml = fuente.hidden;
            if (enHtml) {
                fuente.value = yo.darHTML();
                fuente.style.height = Math.max(area.offsetHeight, 240) + "px";
            } else {
                yo.ponerHTML(fuente.value);
                avisar();
            }
            fuente.hidden = !enHtml;
            area.hidden = enHtml;
            verHtml.setAttribute("aria-pressed", enHtml ? "true" : "false");
            botones.forEach((b) => {
                if (b !== verHtml) {
                    b.disabled = enHtml;
                }
            });
            (enHtml ? fuente : area).focus();
        }, null, "html");
        verHtml.setAttribute("aria-pressed", "false");
        fuente.addEventListener("input", avisar);
    }

    // Qué está puesto donde está el cursor (negrita, título…): el botón
    // sale pulsado.
    const pintarEstado = () => {
        if (document.activeElement !== area) {
            return;
        }
        let bloque = "";
        try {
            bloque = String(document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>]/g, "");
        } catch (error) {
            bloque = "";
        }
        botones.forEach((b) => {
            const e = b.dataset.estado;
            if (!e) {
                return;
            }
            let si = false;
            if (["p", "h2", "h3", "blockquote", "pre"].includes(e)) {
                si = bloque === e;
            } else {
                try {
                    si = document.queryCommandState(e);
                } catch (error) {
                    si = false;
                }
            }
            b.setAttribute("aria-pressed", si ? "true" : "false");
        });
    };
    document.addEventListener("selectionchange", () => {
        if (document.activeElement === area) {
            recordarSeleccion();
            pintarEstado();
        }
    });

    // ---- LOS PANELES (enlace, imagen, tabla) ----
    const cerrarPanel = (volver) => {
        panel.hidden = true;
        panel.textContent = "";
        if (volver) {
            volverASeleccion();
        }
    };
    const campoDelPanel = (texto, tipo, valor) => {
        const id = "redactor-" + n + "-" + texto.replace(/\W+/g, "-").toLowerCase();
        const c = crearEditor("div", "campo");
        const l = crearEditor("label", "", texto);
        l.htmlFor = id;
        const i = document.createElement("input");
        i.id = id;
        i.type = tipo || "text";
        i.value = valor || "";
        i.autocomplete = "off";
        c.appendChild(l);
        c.appendChild(i);
        panel.appendChild(c);
        return i;
    };
    const botonesDelPanel = (texto, alAceptar) => {
        const fila = crearEditor("div", "fila");
        const si = crearEditor("button", "principal", texto);
        si.type = "button";
        const no = crearEditor("button", "", "Cancelar");
        no.type = "button";
        si.addEventListener("click", alAceptar);
        no.addEventListener("click", () => cerrarPanel(true));
        fila.appendChild(si);
        fila.appendChild(no);
        panel.appendChild(fila);
        panel.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                cerrarPanel(true);
            } else if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "file") {
                e.preventDefault();
                alAceptar();
            }
        });
        return si;
    };
    // Un panel hecho por quien lo pide (los botones de más): rellenar(panel,
    // cerrar). Lo elegido en el texto se guarda antes.
    yo.panel = (rellenar) => {
        recordarSeleccion();
        panel.textContent = "";
        panel.hidden = false;
        rellenar(panel, (volver) => cerrarPanel(volver));
    };
    yo.elegido = () => (guardada ? guardada.toString() : "");
    const abrirPanel = (que) => {
        recordarSeleccion();
        panel.textContent = "";
        panel.hidden = false;
        if (que === "enlace") {
            const actual = guardada && (guardada.commonAncestorContainer.nodeType === 1
                ? guardada.commonAncestorContainer : guardada.commonAncestorContainer.parentNode).closest("a");
            panel.appendChild(crearEditor("p", "ayuda", "A otra página de la web: empieza por / (/web/blog/…)."
                + " A otra web: la dirección entera (https://…), y se abre en otra pestaña."));
            const url = campoDelPanel("Dirección del enlace", "text", actual ? actual.getAttribute("href") : "");
            botonesDelPanel("Poner el enlace", () => {
                const valor = url.value.trim();
                if (!direccionBuenaRedactor(valor)) {
                    avisarEditor("La dirección tiene que empezar por / (de la web) o por https://.", true);
                    url.focus();
                    return;
                }
                cerrarPanel(true);
                if (guardada && guardada.collapsed && !actual) {
                    // Sin texto elegido: el enlace con la dirección por texto.
                    const a = document.createElement("a");
                    a.href = valor;
                    a.textContent = valor;
                    meterHtml(a.outerHTML);
                } else {
                    hacer("createLink", valor);
                }
                // Los de fuera, en otra pestaña (y sin dejar a la otra web
                // tocar esta, como pide ejemplo-formatos.html).
                area.querySelectorAll("a[href]").forEach((a) => {
                    if (/^https?:\/\//i.test(a.getAttribute("href"))) {
                        a.setAttribute("target", "_blank");
                        a.setAttribute("rel", "noopener noreferrer");
                    } else {
                        a.removeAttribute("target");
                        a.removeAttribute("rel");
                    }
                });
                avisar();
            });
            url.focus();
        } else if (que === "tabla") {
            const filas = campoDelPanel("Filas (sin contar la de los títulos)", "number", "2");
            const columnas = campoDelPanel("Columnas", "number", "3");
            filas.min = "1";
            columnas.min = "1";
            botonesDelPanel("Meter la tabla", () => {
                const f = Math.max(1, Math.min(40, Number(filas.value) || 2));
                const c = Math.max(1, Math.min(10, Number(columnas.value) || 3));
                const titulos = "<tr>" + Array.from({ length: c }, (_, i) => "<th>Título " + (i + 1) + "</th>").join("") + "</tr>";
                const cuerpo = Array.from({ length: f }, () => "<tr>" + "<td>…</td>".repeat(c) + "</tr>").join("");
                cerrarPanel(true);
                meterBloque("<table><tbody>" + titulos + cuerpo + "</tbody></table><p><br></p>");
            });
            filas.focus();
        } else if (que === "imagen") {
            panel.appendChild(crearEditor("p", "ayuda", "Se trae a la web en WebP y a su tamaño, sin los datos del"
                + " móvil (como traer-imagen.py)."));
            const subir = crearEditor("div", "campo");
            const id = "redactor-" + n + "-archivo";
            const l = crearEditor("label", "", "La imagen");
            l.htmlFor = id;
            const archivo = document.createElement("input");
            archivo.type = "file";
            archivo.accept = "image/*";
            archivo.id = id;
            subir.appendChild(l);
            subir.appendChild(archivo);
            panel.appendChild(subir);
            const alt = campoDelPanel("Qué se ve (para quien no la ve; vacío si es de adorno)");
            const pie = campoDelPanel("Pie de foto (opcional)");
            const si = botonesDelPanel("Meter la imagen", async () => {
                const elegido = archivo.files && archivo.files[0];
                if (!elegido) {
                    avisarEditor("Elige primero la imagen.", true);
                    archivo.focus();
                    return;
                }
                si.disabled = true;
                avisarEditor("Trayendo la imagen…");
                const datos = await new Promise((r) => {
                    const lector = new FileReader();
                    lector.onload = () => r(lector.result);
                    lector.onerror = () => r("");
                    lector.readAsDataURL(elegido);
                });
                const hecha = await pedirEditor("/api/web/imagen", Object.assign({ archivo: elegido.name, datos,
                    nombre: elegido.name.replace(/\.[^.]+$/, "") }, o.imagenes()));
                si.disabled = false;
                if (hecha.error) {
                    avisarEditor(hecha.error, true);
                    return;
                }
                const img = document.createElement("img");
                img.src = hecha.ruta;
                img.alt = alt.value.trim();
                if (hecha.ancho) {
                    img.setAttribute("width", hecha.ancho);
                    img.setAttribute("height", hecha.alto);
                }
                img.setAttribute("loading", "lazy");
                img.setAttribute("decoding", "async");
                const figura = document.createElement("figure");
                figura.appendChild(img);
                if (pie.value.trim()) {
                    figura.appendChild(crearEditor("figcaption", "", pie.value.trim()));
                }
                cerrarPanel(true);
                meterBloque(figura.outerHTML + "<p><br></p>");
                avisarEditor("Imagen puesta: " + hecha.ruta + " (" + hecha.aviso + ").");
            });
            archivo.focus();
        }
    };

    // ---- EL TECLADO Y LO PEGADO ----
    area.addEventListener("keydown", (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) {
            if (o.enLinea && e.key === "Enter") {
                e.preventDefault();
            }
            return;
        }
        const tecla = e.key.toLowerCase();
        if (tecla === "b") {
            e.preventDefault();
            hacer("bold");
        } else if (tecla === "i") {
            e.preventDefault();
            hacer("italic");
        } else if (tecla === "k") {
            e.preventDefault();
            abrirPanel("enlace");
        }
    });
    // [[ : el buscador de lo enlazable, debajo de los botones.
    area.addEventListener("input", async (e) => {
        if (o.enLinea || e.inputType !== "insertText" || e.data !== "[") {
            return;
        }
        const sel = window.getSelection();
        if (!sel.rangeCount) {
            return;
        }
        const r = sel.getRangeAt(0);
        const nodo = r.startContainer;
        const donde = r.startOffset;
        if (nodo.nodeType !== 3 || nodo.nodeValue.slice(Math.max(0, donde - 2), donde) !== "[[") {
            return;
        }
        const quitar = document.createRange();
        quitar.setStart(nodo, donde - 2);
        quitar.setEnd(nodo, donde);
        quitar.deleteContents();
        recordarSeleccion();
        const datos = await enlazablesWeb();
        const grupos = (o.enlaces || gruposDeEnlaceRedactor)(datos);
        buscadorDeEnlaceRedactor(panel, grupos, (c) => {
            volverASeleccion();
            c.poner(yo);
            recordarSeleccion();
            avisar();
        }, (porSalir) => {
            if (!porSalir) {
                volverASeleccion();
                document.execCommand("insertText", false, "[[");
            }
        });
    });
    area.addEventListener("paste", (e) => {
        const datos = e.clipboardData;
        if (!datos) {
            return;
        }
        e.preventDefault();
        const html = datos.getData("text/html");
        let limpio;
        if (html) {
            const raiz = limpiarRedactor(leerHtmlRedactor(html), o.clases);
            limpio = o.enLinea ? raiz.textContent : htmlDelRedactor(raiz);
        } else {
            const texto = datos.getData("text/plain") || "";
            if (o.enLinea) {
                limpio = texto.replace(/\s+/g, " ");
            } else {
                // Texto suelto: cada línea en blanco, un párrafo nuevo.
                limpio = texto.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean)
                    .map((t) => "<p>" + t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                        .replace(/\n/g, "<br>") + "</p>").join("");
            }
        }
        if (o.enLinea) {
            document.execCommand("insertText", false, limpio);
        } else {
            document.execCommand("insertHTML", false, limpio);
        }
        avisar();
    });
    area.addEventListener("input", avisar);
    area.addEventListener("focus", () => {
        document.execCommand("defaultParagraphSeparator", false, "p");
    });

    // ---- METER Y SACAR EL HTML ----
    yo.ponerHTML = (html) => {
        const raiz = leerHtmlRedactor(html);
        if (o.enLinea) {
            limpiarRedactor(raiz, o.clases);
            area.replaceChildren(...(raiz.firstElementChild && raiz.childNodes.length === 1
                && raiz.firstElementChild.tagName === "P" ? raiz.firstElementChild.childNodes : raiz.childNodes));
        } else {
            limpiarRedactor(raiz, o.clases);
            area.replaceChildren(...raiz.childNodes);
            if (!area.firstChild) {
                area.appendChild(document.createElement("p")).appendChild(document.createElement("br"));
            }
        }
        fuente.value = "";
    };
    yo.darHTML = () => {
        if (!fuente.hidden) {
            yo.ponerHTML(fuente.value);
        }
        const copia = leerHtmlRedactor(area.innerHTML.replace(/\u200B/g, ""));
        // Los espacios duros que mete el navegador al escribir dos seguidos
        // o al final de una línea: espacios normales (menos en el código).
        const paseo = document.createTreeWalker(copia, NodeFilter.SHOW_TEXT);
        for (let t = paseo.nextNode(); t; t = paseo.nextNode()) {
            if (!(t.parentNode.closest && t.parentNode.closest("pre"))) {
                t.nodeValue = t.nodeValue.replace(/\u00a0/g, " ");
            }
        }
        if (o.enLinea) {
            const raiz = limpiarRedactor(copia, o.clases);
            const p = raiz.querySelector("p");
            return (p ? p.innerHTML : raiz.innerHTML).trim();
        }
        return htmlDelRedactor(limpiarRedactor(copia, o.clases));
    };
    yo.foco = () => area.focus();
    if (!o.enLinea) {
        // Debajo: cuántas palabras, cuánto se tarda en leer y lo que
        // conviene repasar.
        const cuenta = contadorDeTextoRedactor(() => area.innerText || "", () => {
            const avisos = [];
            const texto = area.innerText || "";
            const dobles = (texto.match(/\S[ \u00a0]{2,}(?=\S)/g) || []).length;
            if (dobles) {
                avisos.push({ texto: dobles === 1 ? "1 doble espacio" : dobles + " dobles espacios", arreglar: () => {
                    const paseo = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
                    for (let t = paseo.nextNode(); t; t = paseo.nextNode()) {
                        if (!t.parentNode.closest("pre")) {
                            t.nodeValue = t.nodeValue.replace(/(\S)[ \u00a0]{2,}(?=\S)/g, "$1 ");
                        }
                    }
                    avisar();
                }, comoArreglar: "Quitar los dobles espacios" });
            }
            const sueltas = (texto.match(/<\/?[a-zA-Z][^>]{0,30}>|(^|[^<\w])\/[a-z]{1,10}>/g) || []).length;
            if (sueltas) {
                avisos.push({ texto: sueltas === 1 ? "1 trozo de etiqueta HTML en el texto (como «/p>»)"
                    : sueltas + " trozos de etiquetas HTML en el texto (como «/p>»)" });
            }
            const sinAlt = [...area.querySelectorAll("img")].filter((i) => !(i.getAttribute("alt") || "").trim()).length;
            if (sinAlt) {
                avisos.push({ texto: sinAlt === 1 ? "1 imagen sin descripción (si no es de adorno, ponle una)"
                    : sinAlt + " imágenes sin descripción (si no son de adorno, pónselas)" });
            }
            const sinDireccion = [...area.querySelectorAll("a")].filter((a) => {
                const h = (a.getAttribute("href") || "").trim();
                return !h || h === "#" || h === "https://" || h === "http://";
            }).length;
            if (sinDireccion) {
                avisos.push({ texto: sinDireccion === 1 ? "1 enlace sin dirección" : sinDireccion + " enlaces sin dirección" });
            }
            return avisos;
        });
        caja.appendChild(cuenta.caja);
        area.addEventListener("input", cuenta.pedir);
        yo.contar = cuenta.pedir;
        setTimeout(cuenta.pedir, 0);
    }
    return yo;
}

// EL CONTADOR Y LO QUE CONVIENE REPASAR, debajo de un texto. Se pone al
// día un poco después de dejar de escribir (no a cada letra). Lo de
// repasar es una lista; lo que se puede arreglar solo lleva su botón.
// La ortografía la marca el propio navegador (subrayado en rojo; clic
// derecho para ver cómo se escribe).
//   leer      () => el texto
//   revisar   () => [{texto, arreglar?, comoArreglar?}]
function contadorDeTextoRedactor(leer, revisar) {
    const caja = crearEditor("div", "redactor-cuenta");
    const linea = crearEditor("p", "redactor-cuenta-linea");
    const lista = crearEditor("ul", "redactor-cuenta-avisos");
    caja.appendChild(linea);
    caja.appendChild(lista);
    let espera = null;
    const pintar = () => {
        const palabras = (leer().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length;
        const minutos = Math.max(1, Math.round(palabras / 200));
        linea.textContent = palabras === 1 ? "1 palabra" : palabras + " palabras · " + minutos + " min de lectura";
        lista.textContent = "";
        revisar().forEach((a) => {
            const li = crearEditor("li", "", "Ojo: " + a.texto + ".");
            if (a.arreglar) {
                const b = crearEditor("button", "", a.comoArreglar || "Arreglarlo");
                b.type = "button";
                b.addEventListener("click", () => {
                    a.arreglar();
                    pintar();
                    avisarEditor("Arreglado.");
                });
                li.appendChild(document.createTextNode(" "));
                li.appendChild(b);
            }
            lista.appendChild(li);
        });
    };
    const pedir = () => {
        clearTimeout(espera);
        espera = setTimeout(pintar, 600);
    };
    return { caja, pedir, pintar };
}

// =========================================
// LOS MISMOS BOTONES, PARA UN TEXTO EN MARKDOWN
// =========================================
// Las páginas de la wiki (y el texto de un evento de la línea de tiempo)
// se escriben en el Markdown de Chronicler: **negrita**, ## Título, - lista…
// Ahí no se ve cómo queda, pero los botones son los mismos: ponen las
// marcas alrededor de lo elegido, o al principio de las líneas. Van con
// insertText, que es lo que deja deshacerlo con Ctrl+Z.
//   area     el <textarea>
//   nombre   de qué es (para el nombre de la barra)
//   alCambiar
//   opciones  {imagenes: () => {sitio, campos}} para el botón de meter una
//             imagen (a qué carpeta va: ver SITIOS en herramientas/
//             imagenes.py); sin esto, no hay botón
function crearBarraMarkdown(area, nombre, alCambiar, opciones) {
    const o = opciones || {};
    const barra = crearEditor("div", "redactor-botones barra-markdown");
    barra.setAttribute("role", "toolbar");
    barra.setAttribute("aria-label", "Formato: " + (nombre || "texto"));
    barra.setAttribute("aria-controls", area.id);
    const avisar = () => {
        if (alCambiar) {
            alCambiar();
        }
    };
    // Cambia del carácter a al b por texto, y deja elegido de selA a selB
    // (contados desde a).
    const poner = (a, b, texto, selA, selB) => {
        area.focus();
        area.setSelectionRange(a, b);
        if (!document.execCommand("insertText", false, texto)) {
            area.setRangeText(texto, a, b, "end");
            area.dispatchEvent(new Event("input", { bubbles: true }));
        }
        area.setSelectionRange(a + (selA === undefined ? texto.length : selA),
            a + (selB === undefined ? texto.length : selB));
        avisar();
    };
    // **así**: alrededor de lo elegido; sin nada elegido, las marcas con el
    // cursor en medio. Si ya las tenía, se las quita.
    const envolver = (marca) => {
        const a = area.selectionStart;
        const b = area.selectionEnd;
        const v = area.value;
        const dentro = v.slice(a, b);
        if (v.slice(a - marca.length, a) === marca && v.slice(b, b + marca.length) === marca) {
            poner(a - marca.length, b + marca.length, dentro, 0, dentro.length);
            return;
        }
        if (dentro.startsWith(marca) && dentro.endsWith(marca) && dentro.length >= marca.length * 2) {
            const sin = dentro.slice(marca.length, dentro.length - marca.length);
            poner(a, b, sin, 0, sin.length);
            return;
        }
        poner(a, b, marca + dentro + marca, marca.length, marca.length + dentro.length);
    };
    // Las líneas tocadas por lo elegido, enteras.
    const lineas = () => {
        const v = area.value;
        const a = v.lastIndexOf("\n", area.selectionStart - 1) + 1;
        let b = v.indexOf("\n", area.selectionEnd - (area.selectionEnd > area.selectionStart ? 1 : 0));
        b = b === -1 ? v.length : b;
        return { a, b, filas: v.slice(a, b).split("\n") };
    };
    const SIN_MARCA = /^(\s*)(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/;
    // Cada línea, con su marca delante (y sin la que tuviera). Si todas
    // tenían ya esa misma, se les quita: el botón va y viene.
    const alPrincipio = (marca) => {
        const { a, b, filas } = lineas();
        if (!filas.some((f) => f.trim())) {
            // Una línea en blanco: la marca, y a escribir detrás.
            const sola = typeof marca === "function" ? marca(1) : marca;
            poner(a, b, filas.join("\n") + sola);
            return;
        }
        const tienen = filas.filter((f) => f.trim()).every((f) => {
            const m = f.match(SIN_MARCA);
            return m && (typeof marca === "function" ? /^\d+[.)]\s+$/.test(m[2]) : m[2].trim() === marca.trim());
        });
        let n = 0;
        const nuevas = filas.map((f) => {
            if (!f.trim()) {
                return f;
            }
            const limpia = f.replace(SIN_MARCA, "$1");
            if (tienen || !marca) {
                return limpia;
            }
            n += 1;
            return (typeof marca === "function" ? marca(n) : marca) + limpia.trimStart();
        });
        const texto = nuevas.join("\n");
        poner(a, b, texto, 0, texto.length);
    };
    // Un trozo que va solo en su línea (una tabla, una raya).
    const bloque = (texto) => {
        const a = area.selectionStart;
        const v = area.value;
        const antes = a === 0 || v[a - 1] === "\n" ? (a > 1 && v[a - 2] !== "\n" ? "\n" : "") : "\n\n";
        const despues = v[area.selectionEnd] === "\n" ? "\n" : "\n\n";
        poner(a, area.selectionEnd, antes + texto + despues);
    };
    const enlaceWeb = () => {
        const a = area.selectionStart;
        const b = area.selectionEnd;
        const dentro = area.value.slice(a, b);
        if (/^https?:\/\/\S+$/.test(dentro)) {
            // Lo elegido es la dirección: falta lo que se lee.
            poner(a, b, "[texto](" + dentro + ")", 1, 6);
            return;
        }
        const leer = dentro || "texto";
        poner(a, b, "[" + leer + "](https://)", leer.length + 3, leer.length + 11);
    };
    const boton = (texto, ayuda, icono, alPulsar) => {
        const b = botonDeIconoRedactor(texto, ayuda, icono);
        b.addEventListener("mousedown", (e) => e.preventDefault());
        b.addEventListener("click", alPulsar);
        barra.appendChild(b);
        return b;
    };
    const grupo = () => barra.appendChild(crearEditor("span", "redactor-hueco")).setAttribute("aria-hidden", "true");

    boton("Negrita", "Negrita (Ctrl+B): **así**", "negrita", () => envolver("**"));
    boton("Cursiva", "Cursiva (Ctrl+I): *así*", "cursiva", () => envolver("*"));
    boton("Tachado", "Tachado: ~~así~~", "tachado", () => envolver("~~"));
    boton("Código", "Código, en una frase: `así`", "codigo", () => envolver("`"));
    grupo();
    boton("Párrafo", "Párrafo: quita el título, la lista o la cita de la línea", "parrafo", () => alPrincipio(""));
    boton("Título", "Título de apartado: ## al principio", "titulo", () => alPrincipio("## "));
    boton("Subtítulo", "Subtítulo: ### al principio", "subtitulo", () => alPrincipio("### "));
    grupo();
    boton("Lista", "Lista de puntos: - al principio de cada línea", "lista", () => alPrincipio("- "));
    boton("Lista numerada", "Lista numerada: 1. 2. 3.", "numerada", () => alPrincipio((n) => n + ". "));
    boton("Cita", "Cita: > al principio", "cita", () => alPrincipio("> "));
    grupo();
    boton("Enlace a una web", "Enlace a una web: [lo que se lee](dirección). Para otra página de la wiki, "
        + "el buscador de «Enlazar una página»", "enlace", enlaceWeb);
    if (o.imagenes) {
        boton("Imagen", "Meter una imagen (se guarda en su carpeta, en WebP y a su tamaño)", "imagen",
            () => imagenMarkdown());
    }
    boton("Tabla", "Meter una tabla", "tabla",
        () => bloque("| Columna | Columna |\n| --- | --- |\n|  |  |"));
    boton("Raya", "Una raya para separar: ---", "raya", () => bloque("---"));
    grupo();
    boton("Deshacer", "Deshacer (Ctrl+Z)", "deshacer", () => {
        area.focus();
        document.execCommand("undo");
        avisar();
    });
    boton("Rehacer", "Rehacer (Ctrl+Y)", "rehacer", () => {
        area.focus();
        document.execCommand("redo");
        avisar();
    });
    // Debajo del recuadro, el contador y lo que conviene repasar.
    const cuenta = contadorDeTextoRedactor(() => area.value, () => {
        const avisos = [];
        const v = area.value;
        const dobles = (v.match(/\S {2,}(?=\S)/g) || []).length;
        if (dobles) {
            avisos.push({ texto: dobles === 1 ? "1 doble espacio" : dobles + " dobles espacios", arreglar: () => {
                poner(0, area.value.length, area.value.replace(/(\S) {2,}(?=\S)/g, "$1 "), 0, 0);
            }, comoArreglar: "Quitar los dobles espacios" });
        }
        const abren = (v.match(/\[\[/g) || []).length;
        const cierran = (v.match(/\]\]/g) || []).length;
        if (abren !== cierran) {
            avisos.push({ texto: "un [[enlace]] sin cerrar (" + abren + " «[[» y " + cierran + " «]]»)" });
        }
        if ((v.match(/\*\*/g) || []).length % 2) {
            avisos.push({ texto: "una **negrita** sin cerrar" });
        }
        return avisos;
    });
    area.addEventListener("input", cuenta.pedir);
    // Al bajar por un texto largo, la barra va contigo (cuando ya esté en
    // la página: se espera a que se ponga encima del recuadro).
    requestAnimationFrame(() => {
        seguirConLaBarra(barra, area);
        if (area.parentNode) {
            area.after(cuenta.caja);
            cuenta.pintar();
        }
    });
    // [[ : el buscador de páginas de la wiki, debajo de los botones; pone
    // [[Nombre]].
    const buscar = crearEditor("div", "redactor-panel");
    buscar.hidden = true;
    requestAnimationFrame(() => barra.after(buscar));
    area.addEventListener("input", async (e) => {
        if (e.inputType !== "insertText" || e.data !== "[") {
            return;
        }
        const fin = area.selectionStart;
        if (area.value.slice(Math.max(0, fin - 2), fin) !== "[[") {
            return;
        }
        const datos = await enlazablesWeb();
        buscadorDeEnlaceRedactor(buscar, [paginasParaEnlazarRedactor(datos)], (c) => {
            poner(fin - 2, fin, "[[" + c.texto + "]]");
        }, () => {
            area.focus();
            area.setSelectionRange(fin, fin);
        });
    });
    // METER UNA IMAGEN: se elige del ordenador, se trae a su carpeta (en
    // WebP, a su tamaño y sin los datos del móvil, como traer-imagen.py) y
    // se pone ![[nombre.webp|lo que se ve]] en su propia línea, con el pie
    // en cursiva debajo si lo tiene. Sale en el mismo hueco que el buscador
    // de [[ (debajo de los botones, y pegado a ellos si van contigo).
    const imagenMarkdown = () => {
        const a = area.selectionStart;
        const b = area.selectionEnd;
        buscar.textContent = "";
        buscar.hidden = false;
        const dentro = crearEditor("div", "");
        buscar.appendChild(dentro);
        const cerrar = (volver) => {
            buscar.hidden = true;
            buscar.textContent = "";
            if (volver) {
                area.focus();
                area.setSelectionRange(a, b);
            }
        };
        dentro.appendChild(crearEditor("p", "ayuda", "Se guarda en su carpeta, en WebP y a su tamaño, sin los"
            + " datos del móvil."));
        const campo = (texto, tipo, sufijo) => {
            const c = crearEditor("div", "campo");
            const l = crearEditor("label", "", texto);
            const i = document.createElement("input");
            i.type = tipo;
            i.id = (area.id || "texto") + "-imagen-" + sufijo;
            i.autocomplete = "off";
            l.htmlFor = i.id;
            c.appendChild(l);
            c.appendChild(i);
            dentro.appendChild(c);
            return i;
        };
        const archivo = campo("La imagen", "file", "archivo");
        archivo.accept = "image/*";
        const alt = campo("Qué se ve (para quien no la ve; vacío si es de adorno)", "text", "alt");
        const pie = campo("Pie de foto (opcional)", "text", "pie");
        const fila = crearEditor("div", "fila");
        const si = crearEditor("button", "principal", "Meter la imagen");
        si.type = "button";
        const no = crearEditor("button", "", "Cancelar");
        no.type = "button";
        fila.appendChild(si);
        fila.appendChild(no);
        dentro.appendChild(fila);
        no.addEventListener("click", () => cerrar(true));
        dentro.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cerrar(true);
            }
        });
        si.addEventListener("click", async () => {
            const elegido = archivo.files && archivo.files[0];
            if (!elegido) {
                avisarEditor("Elige primero la imagen.", true);
                archivo.focus();
                return;
            }
            si.disabled = true;
            avisarEditor("Trayendo la imagen…");
            const datos = await new Promise((r) => {
                const lector = new FileReader();
                lector.onload = () => r(lector.result);
                lector.onerror = () => r("");
                lector.readAsDataURL(elegido);
            });
            const hecha = await pedirEditor("/api/web/imagen", Object.assign({ archivo: elegido.name, datos,
                nombre: elegido.name.replace(/\.[^.]+$/, "") }, o.imagenes()));
            si.disabled = false;
            if (!hecha || hecha.error) {
                avisarEditor((hecha && hecha.error) || "No se ha podido traer la imagen.", true);
                return;
            }
            // Ni corchetes ni barras ni saltos: romperían el ![[…]].
            const limpio = (s, fuera) => s.replace(fuera, " ").replace(/\s+/g, " ").trim();
            const queSeVe = limpio(alt.value, /[[\]|\n]/g);
            const elPie = limpio(pie.value, /[*\n]/g);
            const nombreDeArchivo = String(hecha.ruta).split("/").pop();
            cerrar(false);
            area.focus();
            area.setSelectionRange(a, b);
            bloque("![[" + nombreDeArchivo + (queSeVe ? "|" + queSeVe : "") + "]]" + (elPie ? "\n*" + elPie + "*" : ""));
            avisarEditor("Imagen puesta: " + hecha.ruta + " (" + hecha.aviso + ").");
        });
        archivo.focus();
    };
    // Los atajos de siempre, también aquí.
    area.addEventListener("keydown", (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) {
            return;
        }
        const tecla = e.key.toLowerCase();
        if (tecla === "b" || tecla === "i") {
            e.preventDefault();
            envolver(tecla === "b" ? "**" : "*");
        }
    });
    return barra;
}

// =========================================
// LA BARRA VA CONTIGO
// =========================================
// En un texto largo, al bajar, los botones se quedarían arriba, fuera de la
// pantalla. En cuanto su barra se va por arriba y el texto sigue a la vista
// (escribiendo en él o no: basta con bajar por la página), la barra se queda
// pegada arriba de la pantalla, del ancho del texto, hasta que el texto se
// acaba. Como los textos no se pisan, solo va contigo la del que tienes a
// la altura de arriba de la pantalla.
// Con position: fixed y JavaScript, no con sticky (que en el navegador de
// Richi no va fino). En su sitio queda un hueco de su alto, para que el
// texto no salte.
//   barra   la barra de botones
//   campo   hasta dónde llega (el redactor entero, o el <textarea>)
function seguirConLaBarra(barra, campo) {
    if (barra.hueco) {
        return;
    }
    const hueco = crearEditor("div", "barra-hueco");
    hueco.setAttribute("aria-hidden", "true");
    barra.before(hueco);
    barra.hueco = hueco;
    BARRAS_QUE_SIGUEN.push({ barra, campo });
}

function colocarBarrasRedactor() {
    // Las de lo que ya no está (otra página abierta), fuera de la lista.
    for (let i = BARRAS_QUE_SIGUEN.length - 1; i >= 0; i -= 1) {
        if (!BARRAS_QUE_SIGUEN[i].barra.isConnected && BARRAS_QUE_SIGUEN[i].campo.dataset.visto) {
            BARRAS_QUE_SIGUEN.splice(i, 1);
        }
    }
    BARRAS_QUE_SIGUEN.forEach((b) => {
        const { barra, campo } = b;
        const hueco = barra.hueco;
        if (!barra.isConnected || !hueco || !hueco.isConnected) {
            return;
        }
        campo.dataset.visto = "1";
        const arriba = hueco.getBoundingClientRect();
        const abajo = campo.getBoundingClientRect().bottom;
        const alto = barra.offsetHeight;
        const pegar = arriba.top < 0 && abajo > alto + 48;
        if (pegar) {
            if (!barra.classList.contains("va-contigo")) {
                hueco.style.height = alto + "px";
                barra.classList.add("va-contigo");
            }
            barra.style.left = arriba.left + "px";
            barra.style.width = arriba.width + "px";
            // Lo que abren sus botones (enlace, imagen, tabla, el buscador
            // de [[) sale justo debajo de ella, también pegado (en el CSS,
            // .va-contigo + .redactor-panel): así abrirlo no te sube al
            // principio del texto.
            const caja = barra.parentNode;
            caja.style.setProperty("--contigo-izq", arriba.left + "px");
            caja.style.setProperty("--contigo-ancho", arriba.width + "px");
            caja.style.setProperty("--contigo-alto", barra.offsetHeight + "px");
        } else if (barra.classList.contains("va-contigo")) {
            barra.classList.remove("va-contigo");
            barra.style.left = "";
            barra.style.width = "";
            hueco.style.height = "";
        }
    });
}

(() => {
    let pedido = false;
    const pedir = () => {
        if (pedido) {
            return;
        }
        pedido = true;
        requestAnimationFrame(() => {
            pedido = false;
            colocarBarrasRedactor();
        });
    };
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
    // Lo que se escribe hace crecer el texto: también cuenta.
    document.addEventListener("input", pedir);
})();

// =========================================
// [[ PARA ENLAZAR, MIENTRAS SE ESCRIBE
// =========================================
// Escribir [[ en un texto abre, debajo de sus botones, un buscador: las
// páginas de la wiki (y, en las notas de una partida, los personajes de la
// mesa y los NPC de la campaña). Se escribe un trozo del nombre, flechas
// arriba y abajo para elegir, Enter para ponerlo y Escape para dejarlo como
// estaba. Lo que se pone depende de dónde se escribe: un enlace en una
// entrada, el nombre de su color o en negrita en las notas, [[Nombre]] en la
// wiki. Lo enlazable lo da editor_web.enlazables (se pide una vez y se
// guarda un minuto).
const ENLAZABLES_WEB = { datos: null, cuando: 0 };

async function enlazablesWeb() {
    if (!ENLAZABLES_WEB.datos || Date.now() - ENLAZABLES_WEB.cuando > 60000) {
        const datos = await pedirEditor("/api/web/enlazables");
        if (!datos.error) {
            ENLAZABLES_WEB.datos = datos;
            ENLAZABLES_WEB.cuando = Date.now();
        }
    }
    return ENLAZABLES_WEB.datos || { paginas: [], npcs: {} };
}

// dentro: dónde se pinta; grupos: [{nombre, cosas: [{texto, detalle}]}];
// alElegir(cosa) y alCancelar().
let cuentaDeBuscadoresDeEnlace = 0;
function buscadorDeEnlaceRedactor(dentro, grupos, alElegir, alCancelar) {
    cuentaDeBuscadoresDeEnlace += 1;
    const id = "buscar-enlace-" + cuentaDeBuscadoresDeEnlace;
    dentro.textContent = "";
    dentro.hidden = false;
    const l = crearEditor("label", "", "Enlazar a… (escribe un trozo del nombre; Enter para ponerlo, Escape para dejarlo)");
    l.htmlFor = id;
    const busca = document.createElement("input");
    busca.id = id;
    busca.autocomplete = "off";
    busca.spellcheck = false;
    busca.setAttribute("role", "combobox");
    busca.setAttribute("aria-expanded", "true");
    busca.setAttribute("aria-autocomplete", "list");
    busca.setAttribute("aria-controls", id + "-lista");
    const lista = crearEditor("ul", "buscar-enlace-lista");
    lista.id = id + "-lista";
    lista.setAttribute("role", "listbox");
    lista.setAttribute("aria-label", "Lo que cuadra");
    const cuantas = crearEditor("p", "ayuda");
    cuantas.setAttribute("aria-live", "polite");
    dentro.appendChild(l);
    dentro.appendChild(busca);
    dentro.appendChild(cuantas);
    dentro.appendChild(lista);
    const todas = [];
    grupos.forEach((g) => g.cosas.forEach((c) => todas.push(Object.assign({ grupo: g.nombre }, c))));
    let vistas = [];
    let activa = 0;
    const llano = (t) => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const pintar = () => {
        const q = llano(busca.value.trim());
        vistas = todas.filter((c) => !q || llano(c.texto).includes(q))
            .sort((a, b) => (llano(a.texto).startsWith(q) ? 0 : 1) - (llano(b.texto).startsWith(q) ? 0 : 1)).slice(0, 12);
        activa = Math.min(activa, Math.max(0, vistas.length - 1));
        lista.textContent = "";
        vistas.forEach((c, i) => {
            const li = crearEditor("li", "buscar-enlace-cosa");
            li.id = id + "-" + i;
            li.setAttribute("role", "option");
            li.setAttribute("aria-selected", i === activa ? "true" : "false");
            li.appendChild(crearEditor("span", "faltan-nombre", c.texto));
            li.appendChild(crearEditor("span", "faltan-veces", " " + c.grupo + (c.detalle ? " · " + c.detalle : "")));
            li.addEventListener("mousedown", (e) => e.preventDefault());
            li.addEventListener("click", () => elegir(i));
            lista.appendChild(li);
        });
        if (vistas.length) {
            busca.setAttribute("aria-activedescendant", id + "-" + activa);
        } else {
            busca.removeAttribute("aria-activedescendant");
        }
        cuantas.textContent = vistas.length ? vistas.length + (vistas.length === 1 ? " cosa" : " cosas")
            + ". La primera: " + vistas[activa].texto + "." : "Nada con eso. Escape para dejarlo.";
    };
    let hecho = false;
    const cerrar = () => {
        hecho = true;
        dentro.textContent = "";
        dentro.hidden = true;
    };
    const elegir = (i) => {
        const c = vistas[i];
        if (!c) {
            return;
        }
        cerrar();
        alElegir(c);
    };
    busca.addEventListener("input", () => {
        activa = 0;
        pintar();
    });
    busca.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (vistas.length) {
                activa = (activa + (e.key === "ArrowDown" ? 1 : vistas.length - 1)) % vistas.length;
                pintar();
                cuantas.textContent = vistas[activa].texto + " (" + vistas[activa].grupo + ").";
            }
        } else if (e.key === "Enter") {
            e.preventDefault();
            elegir(activa);
        } else if (e.key === "Escape") {
            e.preventDefault();
            cerrar();
            alCancelar();
        }
    });
    busca.addEventListener("blur", () => setTimeout(() => {
        if (!hecho && !dentro.contains(document.activeElement)) {
            cerrar();
            alCancelar(true);
        }
    }, 150));
    pintar();
    busca.focus();
}

// Lo de siempre: las páginas de la wiki, como enlace.
function gruposDeEnlaceRedactor(datos) {
    return [paginasParaEnlazarRedactor(datos)];
}

function paginasParaEnlazarRedactor(datos) {
    return { nombre: "Página de la wiki", cosas: (datos.paginas || []).map((p) => ({ texto: p.nombre, detalle: p.que,
        poner: (r) => {
            const a = document.createElement("a");
            a.setAttribute("href", p.url);
            a.textContent = p.nombre;
            r.meterNodo(a);
        } })) };
}
