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
            if (!ETIQUETAS_DEL_REDACTOR[nombre] && !(nombre === "span" && clasesBuenas.test(hijo.className || ""))) {
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
            [...nuevo.attributes].forEach((a) => nuevo.removeAttribute(a.name));
            buenos.forEach((a) => {
                const valor = hijo.getAttribute(a);
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
    seguirConLaBarra(barra, caja, caja);
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
    yo.hacer = hacer;
    yo.meterHtml = meterHtml;
    yo.recordar = recordarSeleccion;
    // Lo elegido, envuelto en una etiqueta (con su clase).
    // siNada: si no hay nada elegido, se mete ese texto ya envuelto
    // (el nombre de un personaje, por ejemplo).
    yo.envolver = (etiqueta, clase, siNada) => {
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
        const vacia = sel.isCollapsed;
        el.appendChild(vacia ? document.createTextNode(siNada) : rango.extractContents());
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
                meterHtml("<table><tbody>" + titulos + cuerpo + "</tbody></table><p><br></p>");
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
                meterHtml(figura.outerHTML + "<p><br></p>");
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
        if (o.enLinea) {
            const raiz = limpiarRedactor(copia, o.clases);
            const p = raiz.querySelector("p");
            return (p ? p.innerHTML : raiz.innerHTML).trim();
        }
        return htmlDelRedactor(limpiarRedactor(copia, o.clases));
    };
    yo.foco = () => area.focus();
    return yo;
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
function crearBarraMarkdown(area, nombre, alCambiar) {
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
    // Al bajar por un texto largo, la barra va contigo (cuando ya esté en
    // la página: se espera a que se ponga encima del recuadro).
    requestAnimationFrame(() => seguirConLaBarra(barra, area, [area, barra]));
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
// Escribiendo en un texto largo, al bajar, los botones se quedarían arriba,
// fuera de la pantalla. Mientras el foco está en ese texto (o en sus
// botones) y su barra se ha ido por arriba, la barra se queda pegada
// arriba de la pantalla, del ancho del texto, hasta que el texto se acaba.
// Con position: fixed y JavaScript, no con sticky (que en el navegador de
// Richi no va fino). En su sitio queda un hueco de su alto, para que el
// texto no salte.
//   barra   la barra de botones
//   campo   hasta dónde llega (el redactor entero, o el <textarea>)
//   foco    dónde tiene que estar el foco (un elemento o una lista)
function seguirConLaBarra(barra, campo, foco) {
    if (barra.hueco) {
        return;
    }
    const hueco = crearEditor("div", "barra-hueco");
    hueco.setAttribute("aria-hidden", "true");
    barra.before(hueco);
    barra.hueco = hueco;
    BARRAS_QUE_SIGUEN.push({ barra, campo, foco: [].concat(foco) });
}

function colocarBarrasRedactor() {
    const activo = document.activeElement;
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
        const conFoco = b.foco.some((f) => f && f.contains(activo));
        const arriba = hueco.getBoundingClientRect();
        const abajo = campo.getBoundingClientRect().bottom;
        const alto = barra.offsetHeight;
        const pegar = conFoco && arriba.top < 0 && abajo > alto + 48;
        if (pegar) {
            if (!barra.classList.contains("va-contigo")) {
                hueco.style.height = alto + "px";
                barra.classList.add("va-contigo");
            }
            barra.style.left = arriba.left + "px";
            barra.style.width = arriba.width + "px";
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
    document.addEventListener("focusin", pedir);
    document.addEventListener("focusout", () => setTimeout(pedir, 0));
    // Lo que se escribe hace crecer el texto: también cuenta.
    document.addEventListener("input", pedir);
})();
