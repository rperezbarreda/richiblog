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
    const boton = (texto, ayuda, alPulsar, estado) => {
        const b = crearEditor("button", "redactor-boton", texto);
        b.type = "button";
        // El nombre es lo que se lee en el botón; lo de más (y el atajo),
        // en el title, que el lector de pantalla da como descripción.
        if (ayuda !== texto) {
            b.title = ayuda;
        }
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

    boton("Negrita", "Negrita (Ctrl+B)", () => hacer("bold"), "bold");
    boton("Cursiva", "Cursiva (Ctrl+I)", () => hacer("italic"), "italic");
    boton("Tachado", "Tachado", () => hacer("strikeThrough"), "strikeThrough");
    boton("Código", "Código, en una frase", () => yo.envolver("code"));
    if (!o.enLinea) {
        grupo();
        boton("Párrafo", "Texto normal", () => hacer("formatBlock", "<p>"), "p");
        boton("Título", "Título de apartado", () => hacer("formatBlock", "<h2>"), "h2");
        boton("Subtítulo", "Título de algo dentro de un apartado", () => hacer("formatBlock", "<h3>"), "h3");
        grupo();
        boton("• Lista", "Lista de puntos", () => hacer("insertUnorderedList"), "insertUnorderedList");
        boton("1. Lista", "Lista numerada", () => hacer("insertOrderedList"), "insertOrderedList");
        boton("Cita", "Cita", () => hacer("formatBlock", "<blockquote>"), "blockquote");
        boton("Código en bloque", "Código en bloque (sale tal cual, con sus espacios)",
            () => hacer("formatBlock", "<pre>"), "pre");
    }
    grupo();
    boton("Enlace", "Poner un enlace (Ctrl+K)", () => abrirPanel("enlace"));
    boton("Quitar enlace", "Quitar el enlace", () => hacer("unlink"));
    if (!o.enLinea) {
        if (o.imagenes) {
            boton("Imagen", "Meter una imagen en el texto", () => abrirPanel("imagen"));
        }
        boton("Tabla", "Meter una tabla", () => abrirPanel("tabla"));
        boton("Raya", "Una raya para separar (un corte fuerte)", () => hacer("insertHorizontalRule"));
    }
    (o.extras || []).forEach((x) => {
        if (x.separar) {
            grupo();
        }
        if (x.elemento) {
            barra.appendChild(x.elemento);
            return;
        }
        boton(x.texto, x.ayuda || x.texto, () => x.hacer(yo));
    });
    grupo();
    boton("Deshacer", "Deshacer (Ctrl+Z)", () => hacer("undo"));
    boton("Rehacer", "Rehacer (Ctrl+Y)", () => hacer("redo"));
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
        });
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
