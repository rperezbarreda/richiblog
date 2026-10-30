// =========================================
// LA PANTALLA DE MÁSTER (web/pantalla_master/pantalla_master.html)
// =========================================
// Un lienzo con ventanas, como el escritorio de un ordenador viejo: cada
// una es un MÓDULO (la iniciativa, las reglas, las condiciones, el
// buscador de conjuros, el bestiario, la tienda, la party, los dados, el
// registro de tiradas, las notas, una tarjeta propia o una tabla para
// tirar). Empieza vacía: se añaden con «＋ añadir» (que también
// ordena o las quita todas), se mueven arrastrando su barra (o con las
// flechas, desde su ⠿), cambian de tamaño por la esquina de abajo a la
// derecha, se les cambia el título y el color con ✎ (o con doble clic en
// el título), se pliegan con − y se quitan con ✕. Todo se guarda en el
// navegador («richi-master»): qué hay, dónde, de qué tamaño, con qué
// título y color, y lo que tenga dentro (lo de las tarjetas y las tablas).
//
// En el móvil (hasta 860 px) no hay lienzo: van una debajo de otra, en el
// orden en que estén (de arriba abajo y de izquierda a derecha).
//
// Lo de dentro de cada módulo sale de personajes.js (window.ocMontar:
// iniciativa, reglas, notas; window.ocDados; window.ocVentana), que se
// carga antes.

(function () {
    const lienzo = document.querySelector("[data-master-lienzo]");
    const barra = document.querySelector("[data-master-barra]");
    if (!lienzo || !barra || !window.ocMontar) {
        return;
    }
    const CLAVE = "richi-master";
    const enMovil = window.matchMedia ? window.matchMedia("(max-width: 860px)") : { matches: false };

    function crear(tag, clase, texto) {
        const x = document.createElement(tag);
        if (clase) {
            x.className = clase;
        }
        if (texto !== undefined) {
            x.textContent = texto;
        }
        return x;
    }

    function botonDe(clase, texto, alPulsar, etiqueta) {
        const b = crear("button", clase, texto);
        b.type = "button";
        if (etiqueta) {
            b.setAttribute("aria-label", etiqueta);
        }
        b.addEventListener("click", alPulsar);
        return b;
    }

    const aviso = crear("p", "visually-hidden");
    aviso.setAttribute("role", "status");
    document.body.appendChild(aviso);

    function avisar(texto) {
        aviso.textContent = "";
        setTimeout(() => {
            aviso.textContent = texto;
        }, 50);
    }

    const llano = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

    // ---- UN MARKDOWN PEQUEÑITO (para las reglas, los conjuros y las
    // tarjetas): párrafos, listas con «- », «## títulos», **negrita** y
    // *cursiva*. Todo con nodos de texto: nada se pega como HTML. ----
    function enLinea(texto) {
        const nodos = [];
        const patron = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
        let fin = 0;
        let m;
        while ((m = patron.exec(texto))) {
            if (m.index > fin) {
                nodos.push(document.createTextNode(texto.slice(fin, m.index)));
            }
            nodos.push(crear(m[1] ? "strong" : "em", "", m[1] || m[2]));
            fin = patron.lastIndex;
        }
        if (fin < texto.length) {
            nodos.push(document.createTextNode(texto.slice(fin)));
        }
        return nodos;
    }

    function markdown(texto) {
        const caja = crear("div", "oc-texto");
        let lista = null;
        let parrafo = [];
        const cerrarParrafo = () => {
            if (parrafo.length) {
                const p = crear("p");
                p.append(...enLinea(parrafo.join(" ")));
                caja.appendChild(p);
                parrafo = [];
            }
        };
        let tabla = null;
        String(texto || "").split("\n").forEach((linea) => {
            const l = linea.trim();
            // Las tablas: «| a | b |» por fila (la primera, la cabecera).
            if (/^\|.*\|$/.test(l)) {
                // La raya de debajo de la cabecera («| --- | --- |»), fuera.
                if (/^\|[\s:|-]+\|$/.test(l)) {
                    return;
                }
                cerrarParrafo();
                lista = null;
                const celdas = l.slice(1, -1).split("|").map((c) => c.trim());
                if (!tabla) {
                    tabla = crear("table", "master-tabla-texto");
                    const tr = crear("tr");
                    celdas.forEach((c) => {
                        const th = crear("th");
                        th.scope = "col";
                        th.append(...enLinea(c));
                        tr.appendChild(th);
                    });
                    const thead = crear("thead");
                    thead.appendChild(tr);
                    tabla.append(thead, crear("tbody"));
                    caja.appendChild(tabla);
                    return;
                }
                const tr = crear("tr");
                celdas.forEach((c) => {
                    const td = crear("td");
                    td.append(...enLinea(c));
                    tr.appendChild(td);
                });
                tabla.querySelector("tbody").appendChild(tr);
                return;
            }
            tabla = null;
            if (/^[-*] /.test(l)) {
                cerrarParrafo();
                if (!lista) {
                    lista = crear("ul");
                    caja.appendChild(lista);
                }
                const li = crear("li");
                li.append(...enLinea(l.slice(2)));
                lista.appendChild(li);
                return;
            }
            lista = null;
            if (!l) {
                cerrarParrafo();
                return;
            }
            if (/^#{1,6} /.test(l)) {
                cerrarParrafo();
                const h = crear("h4", "oc-hoja-subtitulo");
                h.append(...enLinea(l.replace(/^#+ /, "")));
                caja.appendChild(h);
                return;
            }
            parrafo.push(l);
        });
        cerrarParrafo();
        if (window.ocDadosEnTexto) {
            window.ocDadosEnTexto(caja);
        }
        return caja;
    }

    // Los JSON de la web, una vez cada uno.
    const pedidos = {};

    function pedir(ruta) {
        if (!pedidos[ruta]) {
            pedidos[ruta] = fetch(ruta).then((r) => {
                if (!r.ok) {
                    throw new Error(r.status);
                }
                return r.json();
            });
        }
        return pedidos[ruta];
    }

    // ---- LAS REGLAS (o solo las de un grupo: las condiciones son
    // «Estados» y las acciones, «Acciones») ----
    // ---- LAS REGLAS PROPIAS (homebrew): las de tu mesa, guardadas en el
    // navegador («richi-master-homebrew»: [{id, nombre, icono, texto}]),
    // las mismas en todos los perfiles. Salen en su ventana, al final de
    // «todas las reglas» y en el buscador de arriba. ----
    const CLAVE_HOMEBREW = "richi-master-homebrew";
    const CLAVE_IMAGENES = "richi-master-imagenes";
    const CLAVE_PLANTILLAS = "richi-master-plantillas";

    function leerHomebrew() {
        try {
            const x = JSON.parse(localStorage.getItem(CLAVE_HOMEBREW) || "[]");
            return Array.isArray(x) ? x : [];
        } catch (e) {
            return [];
        }
    }

    function guardarHomebrew(lista) {
        try {
            localStorage.setItem(CLAVE_HOMEBREW, JSON.stringify(lista));
        } catch (e) {
            // Sin almacenamiento: solo mientras esté abierta.
        }
        document.dispatchEvent(new CustomEvent("master:homebrew"));
    }

    // Escucha un evento mientras «dentro» siga en la página.
    function mientrasEste(dentro, evento, alPasar) {
        let puesta = false;
        const f = () => {
            if (dentro.isConnected) {
                puesta = true;
                alPasar();
            } else if (puesta) {
                document.removeEventListener(evento, f);
            }
        };
        document.addEventListener(evento, f);
    }

    // Una regla en su ventana (las del SRD y las propias).
    function abrirRegla(r, vuelta, fuente) {
        const cuerpo = crear("div", "oc-regla-ventana");
        if (r.icono) {
            const grande = crear("p", "oc-regla-ventana-dibujo", r.icono);
            grande.setAttribute("aria-hidden", "true");
            cuerpo.appendChild(grande);
        }
        if (r.grupo) {
            cuerpo.appendChild(crear("p", "oc-hoja-nota", r.grupo + (r.alias ? " · también: " + r.alias : "")));
        }
        cuerpo.appendChild(markdown(r.texto));
        if (fuente) {
            cuerpo.appendChild(crear("p", "oc-hoja-nota master-fuente", fuente));
        }
        if (window.ocDadosEnTexto) {
            window.ocDadosEnTexto(cuerpo);
        }
        const fijar = botonDe("oc-vida-accion", "📌 al tablero", () => {
            cerrar();
            anadir("ficha", { titulo: r.nombre, datos: { que: r.propia ? "propia" : "regla", id: r.id || r.nombre } });
        }, "Poner " + r.nombre + " en el tablero");
        cuerpo.appendChild(fijar);
        const cerrar = window.ocVentana.abrir({ titulo: r.nombre, cuerpo, vuelta, clase: "es-regla" });
    }

    function montarReglas(dentro, m, soloGrupo) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando las reglas…"));
        pedir("/datos/personajes/reglas-dnd.json").then((datos) => {
            const pintar = () => {
                const propias = soloGrupo ? [] : leerHomebrew().map((r) => Object.assign({ grupo: "🏠 Reglas propias" }, r));
                const reglas = (datos.reglas || []).filter((r) => !soloGrupo || r.grupo === soloGrupo).concat(propias);
                const caja = crear("div", "oc-reglas");
                const grupos = {};
                const plegados = m.datos.plegados || [];
                reglas.forEach((r) => {
                    if (!grupos[r.grupo]) {
                        const g = crear("div", "oc-reglas-grupo");
                        const lista = crear("ul", "oc-reglas-lista");
                        lista.id = "master-reglas-" + m.id + "-" + Object.keys(grupos).length;
                        if (!soloGrupo) {
                            // Cada grupo se pliega y despliega con su título.
                            const h = crear("h3", "oc-reglas-titulo master-reglas-plegable");
                            const b = botonDe("master-reglas-grupo", "", () => {
                                const abierto = b.getAttribute("aria-expanded") === "true";
                                b.setAttribute("aria-expanded", abierto ? "false" : "true");
                                lista.hidden = abierto;
                                m.datos.plegados = abierto ? (m.datos.plegados || []).concat(r.grupo)
                                    : (m.datos.plegados || []).filter((x) => x !== r.grupo);
                                guardar();
                            });
                            const flecha = crear("span", "master-reglas-flecha", "▸");
                            flecha.setAttribute("aria-hidden", "true");
                            b.append(flecha, document.createTextNode(r.grupo));
                            const plegado = plegados.indexOf(r.grupo) >= 0;
                            b.setAttribute("aria-expanded", plegado ? "false" : "true");
                            b.setAttribute("aria-controls", lista.id);
                            lista.hidden = plegado;
                            h.appendChild(b);
                            g.appendChild(h);
                        }
                        g.appendChild(lista);
                        caja.appendChild(g);
                        grupos[r.grupo] = lista;
                    }
                    const li = crear("li", "oc-regla");
                    const detalles = crear("details");
                    const resumen = crear("summary");
                    if (r.icono) {
                        resumen.appendChild(crear("span", "oc-regla-icono", r.icono));
                    }
                    resumen.appendChild(crear("span", "oc-regla-nombre", r.nombre + (r.alias ? " (" + r.alias + ")" : "")));
                    detalles.append(resumen, markdown(r.texto));
                    li.appendChild(detalles);
                    grupos[r.grupo].appendChild(li);
                });
                dentro.replaceChildren(caja);
                window.ocMontar.reglas(caja, "master-buscar-" + m.id);
                // Al buscar, se ven todos los grupos (los plegados también).
                const buscar = caja.querySelector("input[type=search]");
                if (buscar) {
                    buscar.addEventListener("input", () => {
                        const hay = !!buscar.value.trim();
                        caja.querySelectorAll(".master-reglas-grupo").forEach((b) => {
                            const lista = document.getElementById(b.getAttribute("aria-controls"));
                            lista.hidden = !hay && b.getAttribute("aria-expanded") === "false";
                        });
                    });
                }
                if (datos.fuente) {
                    dentro.appendChild(crear("p", "oc-hoja-nota master-fuente", datos.fuente));
                }
            };
            pintar();
            if (!soloGrupo) {
                mientrasEste(dentro, "master:homebrew", pintar);
            }
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar las reglas."));
        });
    }

    function montarHomebrew(dentro) {
        const lista = crear("ul", "master-homebrew");
        lista.setAttribute("aria-label", "Reglas propias");
        const vacio = crear("p", "oc-vacio", "Todavía no hay reglas propias.");
        // El formulario: para una nueva o para cambiar una.
        const form = crear("form", "master-homebrew-form");
        form.hidden = true;
        const campo = (id, texto, etiqueta) => {
            const et = crear("label", "oc-dados-etiqueta", texto);
            const x = crear(etiqueta || "input", "oc-dados-texto" + (etiqueta === "textarea" ? " oc-notas-texto" : ""));
            x.id = "master-homebrew-" + id;
            et.htmlFor = x.id;
            if (etiqueta !== "textarea") {
                x.autocomplete = "off";
            }
            form.append(et, x);
            return x;
        };
        const nombre = campo("nombre", "nombre");
        nombre.maxLength = 60;
        nombre.required = true;
        const icono = campo("icono", "dibujo (un emoji, si quieres)");
        icono.maxLength = 4;
        icono.placeholder = "🍺";
        const texto = campo("texto", "la regla (con **negrita**, *cursiva*, «- » para listas y «| a | b |» para tablas)",
            "textarea");
        texto.rows = 8;
        const botones = crear("div", "master-anadir-otras");
        const listo = crear("button", "oc-vida-accion es-principal", "guardar");
        listo.type = "submit";
        let editando = null;
        const cancelar = botonDe("oc-vida-accion", "cancelar", () => cerrarForm());
        botones.append(listo, cancelar);
        form.appendChild(botones);
        const nueva = botonDe("oc-vida-accion es-principal", "＋ regla propia", () => abrirForm(null));
        function abrirForm(r) {
            editando = r;
            nombre.value = r ? r.nombre : "";
            icono.value = r ? r.icono || "" : "";
            texto.value = r ? r.texto : "";
            form.hidden = false;
            nueva.hidden = true;
            nombre.focus();
        }
        function cerrarForm() {
            form.hidden = true;
            nueva.hidden = false;
            nueva.focus();
        }
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const todas = leerHomebrew();
            const datos = { nombre: nombre.value.trim(), icono: icono.value.trim(), texto: texto.value.trim() };
            if (!datos.nombre) {
                nombre.focus();
                return;
            }
            if (editando) {
                const i = todas.findIndex((x) => x.id === editando.id);
                if (i >= 0) {
                    todas[i] = Object.assign(todas[i], datos);
                }
            } else {
                todas.push(Object.assign({ id: "h" + Date.now().toString(36) }, datos));
            }
            guardarHomebrew(todas);
            avisar("Guardada: " + datos.nombre + ".");
            cerrarForm();
        });
        const pintar = () => {
            const todas = leerHomebrew();
            lista.replaceChildren(...todas.map((r) => {
                const li = crear("li", "master-homebrew-regla");
                const ver = botonDe("oc-regla-boton", "", () => abrirRegla(Object.assign({ propia: true,
                    grupo: "🏠 Reglas propias" }, r), ver));
                ver.setAttribute("aria-haspopup", "dialog");
                const d = crear("span", "oc-regla-dibujo", r.icono || "🏠");
                d.setAttribute("aria-hidden", "true");
                ver.append(d, crear("span", "oc-regla-texto", r.nombre));
                const cambiar = botonDe("master-party-quitar", "✎", () => abrirForm(r), "Cambiar " + r.nombre);
                let seguro = false;
                const quitar = botonDe("master-party-quitar", "✕", () => {
                    if (!seguro) {
                        seguro = true;
                        quitar.setAttribute("aria-label", "¿Seguro? Pulsa otra vez para borrar " + r.nombre);
                        avisar("Pulsa otra vez para borrar " + r.nombre + ".");
                        return;
                    }
                    guardarHomebrew(leerHomebrew().filter((x) => x.id !== r.id));
                    avisar("Borrada: " + r.nombre + ".");
                    nueva.focus();
                }, "Borrar " + r.nombre);
                li.append(ver, cambiar, quitar);
                return li;
            }));
            vacio.hidden = !!todas.length;
        };
        mientrasEste(dentro, "master:homebrew", pintar);
        dentro.append(lista, vacio, nueva, form);
        pintar();
    }

    // ---- LOS CONJUROS: los 339 del SRD 5.2 (D&D 2024), en
    // datos/personajes/compendio/conjuros-srd.json. Cada uno abre su
    // ventana (abrirConjuro), desde el buscador o desde un monstruo. ----
    const CONJUROS_SRD = "/datos/personajes/compendio/conjuros-srd.json";
    const nivelDe = (c) => (c.nivel ? "Nivel " + c.nivel : "Truco");

    function abrirConjuro(c, vuelta, fuente) {
        const cuerpo = cuerpoConjuro(c, fuente);
        const fijar = botonDe("oc-vida-accion", "📌 al tablero", () => {
            cerrar();
            anadir("ficha", { titulo: c.nombre, datos: { que: "conjuro", id: c.en } });
        }, "Poner " + c.nombre + " en el tablero");
        cuerpo.appendChild(fijar);
        const cerrar = window.ocVentana.abrir({ titulo: c.nombre, cuerpo, vuelta, clase: "es-regla" });
    }

    function cuerpoConjuro(c, fuente) {
        const cuerpo = crear("div", "oc-regla-ventana");
        const chapas = crear("ul", "oc-desplegable-datos");
        [nivelDe(c), c.escuela, c.ritual ? "ritual" : "", c.conc ? "concentración" : ""].filter(Boolean)
            .forEach((t) => chapas.appendChild(crear("li", "", t)));
        const dl = crear("dl", "master-bicho-datos");
        [["Lanzamiento", c.tiempo], ["Alcance", c.alcance], ["Componentes", c.comp], ["Duración", c.dur],
            ["Clases", (c.clases || []).join(", ")]].forEach(([k, v]) => {
            if (v) {
                dl.append(crear("dt", "", k), crear("dd", "", v));
            }
        });
        cuerpo.append(chapas, dl);
        if (c.ingles) {
            cuerpo.appendChild(crear("p", "oc-hoja-nota", "Este todavía no está traducido: va en inglés."));
        }
        cuerpo.appendChild(markdown(c.texto));
        if (c.superior) {
            cuerpo.appendChild(markdown(c.superior));
        }
        if (fuente) {
            cuerpo.appendChild(crear("p", "oc-hoja-nota master-fuente", fuente));
        }
        if (window.ocDadosEnTexto) {
            window.ocDadosEnTexto(cuerpo);
        }
        return cuerpo;
    }

    // ---- LAS IMÁGENES de monstruos y objetos: la ilustración oficial NO
    // se incrusta (es de WotC y 5e.tools la tiene sin permiso): solo un
    // enlace que la abre en otra pestaña. Lo que sí se ve aquí es la
    // imagen que pongas tú (un enlace https), guardada solo en este
    // navegador («richi-master-imagenes»: {"monstruo:Aboleth": url}). ----
    function urlImagenSegura(u) {
        const x = String(u || "").trim();
        return /^https:\/\/[^\s"'<>()\\]+$/.test(x) ? x : "";
    }

    function leerImagenes() {
        try {
            return JSON.parse(localStorage.getItem(CLAVE_IMAGENES) || "{}") || {};
        } catch (e) {
            return {};
        }
    }

    // Un enlace que se abre en otra pestaña.
    function enlaceFuera(texto, href, etiqueta) {
        const a = crear("a", "", texto);
        // Solo https (las que se hacen aquí ya lo son).
        a.href = urlImagenSegura(href) || "#";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.setAttribute("aria-label", etiqueta + " (se abre en otra pestaña)");
        return a;
    }

    function panelImagen(clave, nombre, ilus, credito, en) {
        const caja = crear("div", "master-imagen");
        const oficial = crear("div", "master-imagen-oficial");
        const esBicho = clave.indexOf("monstruo:") === 0;
        // D&D Beyond: su buscador con el nombre en inglés (no se puede
        // sacar de allí la imagen; se busca a mano).
        const ddb = enlaceFuera("🔎 buscarla en D&D Beyond", "https://www.dndbeyond.com/" + (esBicho ? "monsters" : "magic-items") +
            "?filter-search=" + encodeURIComponent(en || nombre), "Buscar " + nombre + " en D&D Beyond");
        if (ilus) {
            // La vista previa, cargada de 5e.tools (que es quien la tiene);
            // pulsándola, en grande.
            const url = "https://5e.tools/img/" + encodeURI(ilus);
            const previa = crear("img", "master-imagen-previa");
            previa.alt = "Ilustración oficial de " + nombre;
            previa.referrerPolicy = "no-referrer";
            previa.loading = "lazy";
            previa.src = encodeURI(decodeURI(url));
            const verGrande = botonDe("master-imagen-boton", "", () => {
                const g = crear("img", "master-imagen-grande");
                g.alt = previa.alt;
                g.referrerPolicy = "no-referrer";
                g.src = encodeURI(decodeURI(url));
                window.ocVentana.abrir({ titulo: nombre, cuerpo: g, vuelta: verGrande, clase: "es-ancha" });
            }, "Ver en grande la ilustración oficial de " + nombre);
            verGrande.appendChild(previa);
            const sinPrevia = crear("p", "oc-vacio", "No se ha podido cargar la vista previa (¿sin conexión?). El enlace sí vale.");
            sinPrevia.hidden = true;
            previa.addEventListener("error", () => {
                verGrande.hidden = true;
                sinPrevia.hidden = false;
            });
            const enlaces = crear("p", "master-imagen-enlaces");
            enlaces.append(enlaceFuera("🖼️ abrirla en 5e.tools", url, "Abrir la ilustración oficial de " + nombre + " en 5e.tools"),
                document.createTextNode(" · "), ddb);
            oficial.append(verGrande, sinPrevia, enlaces, crear("p", "master-imagen-credito", (credito ? "Ilustración de " + credito +
                ", " : "") + "© Wizards of the Coast. Se ve desde 5e.tools; aquí no se guarda."));
        } else {
            const p = crear("p", "master-imagen-enlaces", "5e.tools no tiene ilustración de esto. ");
            p.appendChild(ddb);
            oficial.appendChild(p);
        }
        const id = "master-imagen-" + clave.replace(/[^\w]+/g, "-") + "-" + Math.random().toString(36).slice(2, 6);
        const et = crear("label", "oc-dados-etiqueta", "tu imagen (pega su enlace https)");
        const campo = crear("input", "master-elegir");
        campo.type = "url";
        campo.id = id;
        campo.placeholder = "https://…";
        et.htmlFor = campo.id;
        const img = crear("img", "master-imagen-propia");
        img.alt = "Tu imagen de " + nombre;
        img.referrerPolicy = "no-referrer";
        img.loading = "lazy";
        const fallo = crear("p", "oc-vacio", "No se ha podido cargar esa imagen (¿el enlace es de la imagen en sí?).");
        fallo.hidden = true;
        img.addEventListener("error", () => {
            if (img.getAttribute("src")) {
                fallo.hidden = false;
                img.hidden = true;
            }
        });
        img.addEventListener("load", () => {
            fallo.hidden = true;
        });
        const grande = botonDe("oc-vida-accion", "🔍 en grande", () => {
            const g = crear("img", "master-imagen-grande");
            g.alt = img.alt;
            g.referrerPolicy = "no-referrer";
            g.src = urlImagenSegura(img.getAttribute("src"));
            window.ocVentana.abrir({ titulo: nombre, cuerpo: g, vuelta: grande, clase: "es-ancha" });
        }, "Ver tu imagen de " + nombre + " en grande");
        const quitar = botonDe("oc-vida-accion", "✕ quitar", () => {
            const todas = leerImagenes();
            delete todas[clave];
            try {
                localStorage.setItem(CLAVE_IMAGENES, JSON.stringify(todas));
            } catch (e) {
                // Sin almacenamiento: da igual.
            }
            campo.value = "";
            poner("");
            avisar("Imagen quitada.");
        }, "Quitar tu imagen de " + nombre);
        const botones = crear("div", "master-imagen-botones");
        botones.append(grande, quitar);
        const poner = (url) => {
            const bien = urlImagenSegura(url);
            fallo.hidden = true;
            img.hidden = !bien;
            botones.hidden = !bien;
            if (bien) {
                img.src = urlImagenSegura(bien);
            } else {
                img.removeAttribute("src");
            }
        };
        campo.addEventListener("change", () => {
            const bien = urlImagenSegura(campo.value);
            if (campo.value.trim() && !bien) {
                avisar("Tiene que ser un enlace que empiece por https://.");
                return;
            }
            const todas = leerImagenes();
            if (bien) {
                todas[clave] = bien;
            } else {
                delete todas[clave];
            }
            try {
                localStorage.setItem(CLAVE_IMAGENES, JSON.stringify(todas));
            } catch (e) {
                // Sin almacenamiento: se ve igual, sin guardar.
            }
            poner(bien);
            avisar(bien ? "Imagen puesta." : "Imagen quitada.");
        });
        const ya = leerImagenes()[clave] || "";
        campo.value = ya;
        poner(ya);
        caja.append(oficial, et, campo, fallo, img, botones);
        return caja;
    }

    // Lo de un objeto (de tienda.json): sus datos y qué hace.
    function datosObjeto(o) {
        const cuerpo = crear("div", "master-objeto");
        const dl = crear("dl", "master-bicho-datos");
        const fila = (que, valor) => {
            if (valor) {
                dl.append(crear("dt", "", que), crear("dd", "", String(valor)));
            }
        };
        fila("Categoría", o.cat);
        fila("Rareza", o.rareza);
        fila("Sintonía", o.sint ? "la requiere" : "");
        fila("Detalles", o.det);
        fila("Peso", o.peso);
        fila("Nota", o.nota);
        fila("Precio", o.cp ? moneda(o.cp) : "");
        fila("Se vende en", (o.tiendas || []).join(", ").toLowerCase());
        fila("En inglés", o.en);
        cuerpo.appendChild(dl);
        if (o.texto) {
            const que = markdown(o.texto);
            que.classList.add("master-objeto-texto");
            cuerpo.appendChild(que);
            if (window.ocDadosEnTexto) {
                window.ocDadosEnTexto(que);
            }
            enlazarConjuros(que);
        }
        cuerpo.append(crear("h3", "master-imagen-titulo", "🖼️ imagen"), panelImagen("objeto:" + o.en, o.nombre, o.ilus, o.ilusDe, o.en));
        return cuerpo;
    }

    function abrirObjeto(o, vuelta, fuente) {
        const cuerpo = datosObjeto(o);
        if (fuente) {
            cuerpo.appendChild(crear("p", "oc-hoja-nota master-fuente", fuente));
        }
        cuerpo.appendChild(botonDe("oc-vida-accion", "📌 al tablero", () => {
            cerrar();
            anadir("ficha", { titulo: o.nombre, datos: { que: "objeto", id: o.en } });
        }, "Poner " + o.nombre + " en el tablero"));
        const cerrar = window.ocVentana.abrir({ titulo: o.nombre, cuerpo, vuelta, clase: "es-regla" });
    }

    // UNA FICHA EN EL TABLERO (📌): un conjuro, una regla (del SRD o
    // propia) o un objeto, en su ventana. «datos»: {que, id}.
    function montarFicha(dentro, m) {
        m.datos = m.datos || {};
        const que = m.datos.que;
        const id = m.datos.id;
        const poner = (x) => dentro.replaceChildren(x || crear("p", "oc-vacio", "Ya no está."));
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        if (que === "propia") {
            const pintar = () => {
                const r = leerHomebrew().find((x) => x.id === id);
                poner(r ? markdown(r.texto) : null);
            };
            pintar();
            mientrasEste(dentro, "master:homebrew", pintar);
            return;
        }
        const ruta = { conjuro: CONJUROS_SRD, regla: "/datos/personajes/reglas-dnd.json",
            objeto: "/datos/personajes/compendio/tienda.json" }[que];
        if (!ruta) {
            poner(null);
            return;
        }
        pedir(ruta).then((datos) => {
            if (que === "conjuro") {
                const c = (datos.conjuros || []).find((x) => x.en === id);
                poner(c ? cuerpoConjuro(c, datos.fuente) : null);
            } else if (que === "regla") {
                const r = (datos.reglas || []).find((x) => x.nombre === id);
                const t = r ? markdown(r.texto) : null;
                if (t && window.ocDadosEnTexto) {
                    window.ocDadosEnTexto(t);
                }
                poner(t);
            } else {
                const o = (datos.objetos || []).find((x) => x.en === id);
                poner(o ? datosObjeto(o) : null);
            }
        }).catch(() => poner(crear("p", "oc-vacio", "No he podido cargarlo.")));
    }

    // Un botón con el nombre de un conjuro que abre su ventana.
    function botonConjuro(c, texto, fuente) {
        const b = botonDe("master-conjuro-enlace", texto || c.nombre, () => abrirConjuro(c, b, fuente));
        b.setAttribute("aria-haspopup", "dialog");
        return b;
    }

    // En un texto ya montado, cada nombre de conjuro en cursiva
    // («*Bola de fuego*») pasa a ser su botón.
    function enlazarConjuros(raiz) {
        pedir(CONJUROS_SRD).then((datos) => {
            const porNombre = {};
            (datos.conjuros || []).forEach((c) => {
                porNombre[llano(c.nombre)] = c;
            });
            raiz.querySelectorAll("em").forEach((em) => {
                const c = porNombre[llano(em.textContent.trim())];
                if (c && !em.closest("button")) {
                    const b = botonConjuro(c, em.textContent, datos.fuente);
                    em.replaceWith(b);
                }
            });
        }).catch(() => {
            // Sin los conjuros: se quedan en cursiva.
        });
    }

    function montarConjuros(dentro, m) {
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando los conjuros…"));
        pedir(CONJUROS_SRD).then((datos) => {
            const conjuros = (datos.conjuros || []).map((c) => ({ c, buscar: llano(c.nombre + " " + c.en + " " + c.escuela) }));
            const fila = crear("div", "master-tienda-campos");
            const campo = (control, texto, id) => {
                const caja = crear("div", "master-tienda-campo" + (control.tagName === "INPUT" ? " es-ancho" : ""));
                const et = crear("label", "oc-dados-etiqueta", texto);
                control.id = id + m.id;
                et.htmlFor = control.id;
                caja.append(et, control);
                fila.appendChild(caja);
                return control;
            };
            const elegir = (opciones) => {
                const sel = crear("select", "oc-dados-elegir");
                opciones.forEach(([v, t]) => {
                    const o = crear("option", "", t);
                    o.value = v;
                    sel.appendChild(o);
                });
                return sel;
            };
            const input = crear("input", "oc-dados-texto");
            input.type = "search";
            input.placeholder = "bola de fuego, fireball…";
            const nivel = campo(elegir([["", "todos"], ["0", "trucos"]].concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [String(n), "nivel " + n]))),
                "nivel", "master-conjuros-nivel-");
            const escuelas = Array.from(new Set(conjuros.map((x) => x.c.escuela))).sort();
            const escuela = campo(elegir([["", "todas"]].concat(escuelas.map((e) => [e, e]))), "escuela", "master-conjuros-escuela-");
            const clases = Array.from(new Set(conjuros.flatMap((x) => x.c.clases || []))).sort();
            const clase = campo(elegir([["", "todas"]].concat(clases.map((e) => [e, e]))), "clase", "master-conjuros-clase-");
            campo(input, "buscar", "master-conjuros-");
            const cuantos = crear("p", "oc-hoja-nota");
            cuantos.setAttribute("role", "status");
            const lista = crear("ul", "master-conjuros");
            const pintar = () => {
                const q = llano(input.value.trim());
                const n = nivel.value === "" ? null : parseInt(nivel.value, 10);
                const salen = conjuros.filter((x) => (!q || x.buscar.includes(q)) && (n === null || x.c.nivel === n)
                    && (!escuela.value || x.c.escuela === escuela.value) && (!clase.value || (x.c.clases || []).indexOf(clase.value) >= 0));
                lista.replaceChildren(...salen.slice(0, 80).map((x) => {
                    const li = crear("li");
                    const b = botonDe("master-conjuro", "", () => abrirConjuro(x.c, b, datos.fuente));
                    b.setAttribute("aria-haspopup", "dialog");
                    b.append(crear("span", "master-conjuro-nombre", x.c.nombre),
                        crear("span", "master-conjuro-datos", [nivelDe(x.c), x.c.escuela, x.c.tiempo].join(" · ")
                            + (x.c.ingles ? " · (en inglés)" : "")));
                    li.appendChild(b);
                    return li;
                }));
                cuantos.textContent = salen.length ? salen.length + (salen.length === 1 ? " conjuro" : " conjuros")
                    + (salen.length > 80 ? " (salen los 80 primeros)" : "") : "Ningún conjuro con eso.";
            };
            let espera = 0;
            input.addEventListener("input", () => {
                clearTimeout(espera);
                espera = setTimeout(pintar, 150);
            });
            [nivel, escuela, clase].forEach((c) => c.addEventListener("change", pintar));
            dentro.replaceChildren(fila, cuantos, lista, crear("p", "oc-hoja-nota master-fuente", datos.fuente || ""));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar los conjuros."));
        });
    }

    // ---- LOS DADOS: los de siempre a un toque, y una fórmula a mano ----
    function montarDados(dentro, m) {
        const fila = crear("div", "master-dados");
        [4, 6, 8, 10, 12, 20, 100].forEach((c) => {
            fila.appendChild(botonDe("oc-vida-accion", "d" + c, () => {
                if (window.ocDados) {
                    window.ocDados.tirar("1d" + c, "d" + c);
                }
            }, "Tirar un d" + c));
        });
        const formula = crear("form", "master-formula");
        const et = crear("label", "oc-dados-etiqueta", "dados");
        const input = crear("input", "oc-dados-texto");
        input.id = "master-formula-" + m.id;
        input.placeholder = "2d6+3, 4d6, 1d20+5…";
        input.autocomplete = "off";
        et.htmlFor = input.id;
        const tirar = crear("button", "oc-vida-accion es-principal", "tirar");
        tirar.type = "submit";
        formula.append(et, input, tirar);
        formula.addEventListener("submit", (e) => {
            e.preventDefault();
            const f = input.value.replace(/\s+/g, "");
            if (!/^[+-]?(\d*d(\d+|F)|\d+)([+-](\d*d(\d+|F)|\d+))*$/i.test(f)) {
                avisar("Escribe los dados así: 2d6+3.");
                input.focus();
                return;
            }
            if (window.ocDados) {
                window.ocDados.tirar(f, f);
            }
        });
        const nota = crear("p", "oc-hoja-nota", "Las tiradas salen en la ventana «registro de tiradas»; las guardadas y"
            + " la bandeja, en los dados de arriba.");
        dentro.append(fila, formula, nota);
    }

    // ---- EL REGISTRO DE TIRADAS: las últimas (de los dados, los
    // monstruos, la iniciativa…), la de ahora arriba; cada una con
    // «repetir» y ✕, y «borrar todo». ----
    function montarRegistro(dentro) {
        const cabeza = crear("div", "oc-dados-cabeza-historial");
        cabeza.appendChild(crear("p", "oc-hoja-nota", "La última, arriba."));
        const borrar = botonDe("oc-dados-borrar-todo", "borrar todo", () => {
            if (window.ocDados && window.ocDados.borrarRegistro) {
                window.ocDados.borrarRegistro();
            }
        }, "Borrar todas las tiradas");
        cabeza.appendChild(borrar);
        const lista = crear("ol", "oc-dados-historial master-registro");
        lista.setAttribute("aria-label", "Tiradas");
        const pintar = (foco) => {
            const filas = window.ocDados && window.ocDados.registro ? window.ocDados.registro((i) => pintar(i)) : [];
            lista.replaceChildren(...filas);
            borrar.disabled = !filas.length;
            if (typeof foco === "number") {
                const quedan = lista.querySelectorAll(".oc-dados-quitar");
                (quedan[Math.min(foco, quedan.length - 1)] || borrar).focus();
            }
        };
        // Al quitar la ventana (o cambiar de perfil), deja de escuchar.
        let puesta = false;
        const alCambiar = () => {
            if (dentro.isConnected) {
                puesta = true;
                pintar();
            } else if (puesta) {
                document.removeEventListener("oc-dados:registro", alCambiar);
            }
        };
        document.addEventListener("oc-dados:registro", alCambiar);
        dentro.append(cabeza, lista);
        pintar();
    }

    // ---- LA PARTY: los jugadores, a mano y deprisa: nombre, clase, PG,
    // CA, las seis características (su bono tira 1d20+bono) y las
    // pasivas (Percepción, Investigación y Perspicacia). ----
    const CARACTERISTICAS = ["FUE", "DES", "CON", "INT", "SAB", "CAR"];
    const PASIVAS = [["per", "Percepción pasiva", "👁️"], ["inv", "Investigación pasiva", "🔍"],
        ["persp", "Perspicacia pasiva", "💭"]];

    function montarParty(dentro, m) {
        m.datos = m.datos || {};
        m.datos.pjs = Array.isArray(m.datos.pjs) ? m.datos.pjs : [];
        const numero = (v) => (v === "" || v === undefined || v === null || isNaN(parseInt(v, 10)) ? "" : parseInt(v, 10));
        const mod = (n) => Math.floor((n - 10) / 2);
        const conSigno = (n) => (n >= 0 ? "+" : "−") + Math.abs(n);
        const quienEs = (pj, i) => pj.nombre || "jugador " + (i + 1);
        const uid = "master-party-" + m.id;

        // ---- las dos pestañas: la lista (para mirar) y el editor ----
        const pestanas = crear("div", "master-bicho-pestanas");
        pestanas.setAttribute("role", "tablist");
        pestanas.setAttribute("aria-label", "Party");
        const panelLista = crear("div", "master-bicho-panel");
        const panelEditor = crear("div", "master-bicho-panel");
        const paneles = [["👥 la party", panelLista], ["✏️ editar", panelEditor]];
        const tabs = paneles.map(([titulo, panel], i) => {
            const t = botonDe("master-bicho-pestana", titulo, () => elegir(i, false));
            t.setAttribute("role", "tab");
            t.id = uid + "-t" + i;
            panel.id = uid + "-p" + i;
            t.setAttribute("aria-controls", panel.id);
            panel.setAttribute("role", "tabpanel");
            panel.setAttribute("aria-labelledby", t.id);
            panel.tabIndex = 0;
            t.addEventListener("keydown", (e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    elegir(1 - i, true);
                }
            });
            pestanas.appendChild(t);
            return t;
        });
        function elegir(i, foco) {
            tabs.forEach((t, j) => {
                t.setAttribute("aria-selected", j === i ? "true" : "false");
                t.tabIndex = j === i ? 0 : -1;
            });
            paneles.forEach(([, panel], j) => {
                panel.hidden = j !== i;
            });
            m.datos.pestana = i;
            guardar();
            if (i === 0) {
                pintarLista();
            } else {
                pintarEditor();
            }
            if (foco) {
                tabs[i].focus();
            }
        }

        // ---- LA LISTA: de un vistazo, sin campos; con sus dados y «a la
        // iniciativa» (tira 1d20 + su bono de Destreza) ----
        const alIni = (pj, i) => {
            const des = numero(pj.des);
            const nombre = meterEnIniciativa({ nombre: quienEs(pj, i), bono: des === "" ? 0 : mod(des), ca: pj.ca,
                pg: numero(pj.pg), color: "#3fae5a" });
            return nombre;
        };
        function pintarLista() {
            const pjs = m.datos.pjs;
            panelLista.replaceChildren();
            if (!pjs.length) {
                panelLista.appendChild(crear("p", "oc-vacio", "Todavía no hay jugadores: añádelos en «editar»."));
                return;
            }
            const todos = botonDe("oc-vida-accion es-principal", "⚔️ todos a la iniciativa", () => {
                const entran = pjs.map((pj, i) => alIni(pj, i)).filter(Boolean);
                avisar(entran.length ? "A la iniciativa: " + entran.join(", ") + "." : "Ya estaban todos en la iniciativa.");
            }, "Poner a toda la party en la iniciativa (tira su iniciativa)");
            const resumen = crear("p", "master-party-resumen");
            const trozos = PASIVAS.map(([k, texto]) => {
                const con = pjs.filter((pj) => numero(pj[k]) !== "");
                if (!con.length) {
                    return "";
                }
                const mejor = con.reduce((a, b) => (numero(b[k]) > numero(a[k]) ? b : a));
                return texto.replace(" pasiva", "") + " " + numero(mejor[k]) + " (" + (mejor.nombre || "sin nombre") + ")";
            }).filter(Boolean);
            resumen.textContent = trozos.length ? "La más alta: " + trozos.join(" · ") : "";
            resumen.hidden = !trozos.length;
            const ul = crear("ul", "master-party es-lista");
            ul.dataset.queSolo = "si";
            ul.setAttribute("aria-label", "Jugadores");
            pjs.forEach((pj, i) => {
                const quien = quienEs(pj, i);
                const li = crear("li", "master-party-pj es-lista");
                const cabeza = crear("div", "master-party-cabeza");
                const nombre = crear("p", "master-party-nombre");
                nombre.appendChild(crear("strong", "", quien));
                if (pj.clase) {
                    nombre.appendChild(crear("span", "master-party-clase", pj.clase));
                }
                const ini = botonDe("oc-vida-accion", "＋ iniciativa", () => {
                    const n = alIni(pj, i);
                    avisar(n ? "A la iniciativa: " + n + "." : quien + " ya está en la iniciativa.");
                }, "Poner a " + quien + " en la iniciativa (tira su iniciativa)");
                cabeza.append(nombre, ini);
                const vitales = crear("dl", "master-party-vitales");
                const vital = (et, valor, titulo) => {
                    if (valor === "" || valor === undefined) {
                        return;
                    }
                    const dt = crear("dt", "", et);
                    dt.title = titulo;
                    vitales.append(dt, crear("dd", "", String(valor)));
                };
                vital("PG", numero(pj.pg) === "" ? "" : numero(pj.pg) + (numero(pj.pgmax) !== "" ? " / " + numero(pj.pgmax) : ""),
                    "Puntos de golpe");
                vital("CA", numero(pj.ca), "Clase de armadura");
                PASIVAS.forEach(([k, texto, emoji]) => vital(emoji, numero(pj[k]), texto));
                vitales.querySelectorAll("dt").forEach((dt) => {
                    if (/\p{Extended_Pictographic}/u.test(dt.textContent)) {
                        const t = dt.title;
                        const e = dt.textContent;
                        dt.textContent = "";
                        const em = crear("span", "", e);
                        em.setAttribute("aria-hidden", "true");
                        dt.append(em, crear("span", "visually-hidden", t));
                    }
                });
                const car = crear("ul", "master-party-caracteristicas");
                car.setAttribute("aria-label", "Características de " + quien);
                CARACTERISTICAS.forEach((k) => {
                    const n = numero(pj[k.toLowerCase()]);
                    if (n === "") {
                        return;
                    }
                    const c = crear("li", "master-party-c");
                    c.appendChild(crear("span", "master-party-et", k));
                    c.appendChild(crear("span", "master-party-valor", String(n)));
                    c.appendChild(window.ocDadoBoton ? window.ocDadoBoton(conSigno(mod(n)), "1d20" + (mod(n) >= 0 ? "+" : "")
                        + mod(n), k + " de " + quien) : document.createTextNode(conSigno(mod(n))));
                    car.appendChild(c);
                });
                li.append(cabeza, vitales);
                if (car.children.length) {
                    li.appendChild(car);
                }
                ul.appendChild(li);
            });
            panelLista.append(todos, resumen, ul);
        }

        // ---- EL EDITOR: una tarjeta con campos por jugador ----
        const lista = crear("ul", "master-party");
        lista.setAttribute("aria-label", "Jugadores (editar)");
        lista.dataset.queSolo = "si";
        const campo = (pj, i, clave, texto, tipo, clase) => {
            const et = crear("label", "master-party-campo" + (clase ? " " + clase : ""));
            et.appendChild(crear("span", "master-party-et", texto));
            const input = crear("input", "master-party-input");
            input.type = tipo || "number";
            if (input.type === "number") {
                input.inputMode = "numeric";
            } else {
                input.autocomplete = "off";
                input.maxLength = 40;
            }
            input.id = uid + "-" + i + "-" + clave;
            input.value = pj[clave] === undefined ? "" : String(pj[clave]);
            input.addEventListener("change", () => {
                pj[clave] = input.type === "number" ? numero(input.value) : input.value.trim();
                guardar();
            });
            et.appendChild(input);
            return et;
        };
        const vacio = crear("p", "oc-vacio", "Todavía no hay jugadores.");
        const nuevo = botonDe("oc-vida-accion es-principal", "＋ jugador", () => {
            m.datos.pjs.push({});
            guardar();
            pintarEditor();
            const inputs = lista.querySelectorAll(".es-nombre input");
            inputs[inputs.length - 1].focus();
        }, "Añadir un jugador");
        function pintarEditor(foco) {
            lista.replaceChildren(...m.datos.pjs.map((pj, i) => {
                const li = crear("li", "master-party-pj");
                const quien = quienEs(pj, i);
                const arriba = crear("div", "master-party-fila");
                arriba.append(campo(pj, i, "nombre", "nombre", "text", "es-nombre"), campo(pj, i, "clase", "clase", "text", "es-clase"),
                    campo(pj, i, "pg", "PG"), campo(pj, i, "pgmax", "máx"), campo(pj, i, "ca", "CA"));
                let seguro = false;
                const quitar = botonDe("master-party-quitar", "✕", () => {
                    if (!seguro) {
                        seguro = true;
                        quitar.setAttribute("aria-label", "¿Seguro? Pulsa otra vez para quitar a " + quien);
                        avisar("Pulsa otra vez para quitar a " + quien + ".");
                        return;
                    }
                    m.datos.pjs.splice(i, 1);
                    guardar();
                    pintarEditor(Math.min(i, m.datos.pjs.length - 1));
                    avisar("Quitado: " + quien + ".");
                }, "Quitar a " + quien);
                arriba.appendChild(quitar);
                const car = crear("div", "master-party-fila");
                CARACTERISTICAS.forEach((k) => {
                    const c = crear("div", "master-party-car");
                    c.appendChild(campo(pj, i, k.toLowerCase(), k, "number", "es-car"));
                    car.appendChild(c);
                });
                const pas = crear("div", "master-party-fila");
                PASIVAS.forEach(([k, texto, emoji]) => {
                    const c = campo(pj, i, k, texto, "number", "es-pasiva");
                    const et = c.querySelector(".master-party-et");
                    et.textContent = "";
                    const em = crear("span", "", emoji + " ");
                    em.setAttribute("aria-hidden", "true");
                    et.append(em, document.createTextNode(texto.replace(" pasiva", "")));
                    c.title = texto;
                    c.querySelector("input").setAttribute("aria-label", texto + " de " + quien);
                    pas.appendChild(c);
                });
                li.append(arriba, car, pas);
                return li;
            }));
            vacio.hidden = !!m.datos.pjs.length;
            if (typeof foco === "number") {
                const q = foco >= 0 ? lista.querySelectorAll(".master-party-quitar")[foco] : null;
                (q || nuevo).focus();
            }
        }
        panelEditor.append(lista, vacio, nuevo);
        dentro.append(pestanas, panelLista, panelEditor);
        elegir(typeof m.datos.pestana === "number" ? m.datos.pestana : (m.datos.pjs.length ? 0 : 1), false);
    }

    // ---- UN POST-IT: texto con formato, como en un procesador de textos
    // (negrita, cursiva, subrayado, tachado, títulos, listas, citas,
    // alineación, colores y resaltado), con su barra de herramientas.
    // «✏️ editar» lo abre para escribir; «listo» lo deja para leer (y
    // entonces los dados del texto se tiran). Se guarda como HTML limpio
    // (m.datos.html; los de antes, en Markdown, se pasan solos). ----
    const ETIQUETAS_POSTIT = ["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "H3", "H4", "UL", "OL",
        "LI", "BLOCKQUOTE", "SPAN", "MARK", "HR"];
    // Los tamaños de letra de la barra, en «em» (relativos a la letra de
    // alrededor: las palabras «large» y compañía van por su cuenta).
    const TAMANOS_LETRA = { 1: "0.7em", 2: "0.8em", 3: "1em", 4: "1.2em", 5: "1.4em", 6: "1.9em", 7: "2.4em" };
    const TAMANOS_PALABRA = { "x-small": "0.7em", small: "0.8em", medium: "1em", large: "1.2em", "x-large": "1.4em",
        "xx-large": "1.9em", "xxx-large": "2.4em" };

    // Solo lo que hace la barra: lo demás (scripts, enlaces, imágenes,
    // estilos raros pegados de otra web) se quita o se queda en texto.
    function sanearHtml(html) {
        const caja = document.createElement("template");
        caja.innerHTML = String(html || "");
        const limpiar = (nodo) => {
            Array.from(nodo.childNodes).forEach((n) => {
                if (n.nodeType === 3) {
                    return;
                }
                if (n.nodeType !== 1) {
                    n.remove();
                    return;
                }
                let tag = n.tagName === "FONT" ? "SPAN" : n.tagName;
                if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "TEMPLATE"].indexOf(tag) >= 0) {
                    n.remove();
                    return;
                }
                limpiar(n);
                if (ETIQUETAS_POSTIT.indexOf(tag) < 0) {
                    tag = /^(H1|H2|H5|H6)$/.test(tag) ? "H3" : null;
                    if (!tag) {
                        n.replaceWith(...n.childNodes);
                        return;
                    }
                }
                const nuevo = document.createElement(tag);
                const st = n.style || {};
                const color = n.getAttribute && n.getAttribute("color");
                const estilos = [];
                if (st.color || color) {
                    estilos.push("color: " + (st.color || color));
                }
                if (st.backgroundColor) {
                    estilos.push("background-color: " + st.backgroundColor);
                }
                if (st.textAlign && /^(left|center|right|justify)$/.test(st.textAlign)) {
                    estilos.push("text-align: " + st.textAlign);
                }
                const tam = TAMANOS_PALABRA[st.fontSize] || st.fontSize || TAMANOS_LETRA[n.getAttribute && n.getAttribute("size")] || "";
                if (/^(0\.7|0\.8|1|1\.2|1\.4|1\.9|2\.4)em$/.test(tam)) {
                    estilos.push("font-size: " + tam);
                }
                if (st.marginLeft && /^\d+(\.\d+)?(px|em)$/.test(st.marginLeft)) {
                    estilos.push("margin-left: " + st.marginLeft);
                }
                if (estilos.length) {
                    nuevo.setAttribute("style", estilos.join("; "));
                }
                nuevo.append(...n.childNodes);
                n.replaceWith(nuevo);
            });
        };
        limpiar(caja.content);
        return caja.innerHTML;
    }

    const COLORES_LETRA = [["", "la del tema"], ["#d23b3b", "rojo"], ["#e07a1f", "naranja"], ["#2f9e4f", "verde"],
        ["#3b7ddd", "azul"], ["#8e5bd6", "morado"]];
    const COLORES_RESALTE = [["", "sin resaltar"], ["#ffe873", "amarillo"], ["#8fe8a2", "verde"], ["#7fdcff", "celeste"],
        ["#ffa6d5", "rosa"], ["#ffb870", "naranja"]];

    // EL EDITOR CON FORMATO (como un procesador de textos), el de los
    // post-its y las notas: una barra de herramientas y un texto
    // editable. «alCambiar()» avisa de cada cambio; .leer() da el HTML
    // ya saneado.
    function editorRico(etiquetaTexto, alCambiar) {
        const area = crear("div", "oc-texto master-postit es-editable");
        area.contentEditable = "true";
        area.setAttribute("role", "textbox");
        area.setAttribute("aria-multiline", "true");
        area.setAttribute("aria-label", etiquetaTexto);
        // ---- la barra de herramientas ----
        const barra = crear("div", "master-postit-barra");
        barra.setAttribute("role", "toolbar");
        barra.setAttribute("aria-label", "Formato del texto");
        const estados = [];
        const orden = (cmd, valor) => {
            area.focus();
            try {
                document.execCommand("styleWithCSS", false, cmd === "hiliteColor" || cmd === "foreColor" || cmd === "fontSize");
            } catch (e) {
                // Navegadores sin styleWithCSS: da igual.
            }
            document.execCommand(cmd, false, valor);
            if (cmd === "fontSize") {
                // De «x-large» (que no depende de la letra de alrededor) a «em».
                area.querySelectorAll("[style*='font-size']").forEach((x) => {
                    if (TAMANOS_PALABRA[x.style.fontSize]) {
                        x.style.fontSize = TAMANOS_PALABRA[x.style.fontSize];
                    }
                });
            }
            alEscribir();
            repintarEstados();
        };
        const herramienta = (texto, etiqueta, cmd, valor, clase, atajo) => {
            const b = botonDe("master-postit-boton" + (clase ? " " + clase : ""), texto, () => orden(cmd, valor), etiqueta);
            b.title = etiqueta + (atajo ? " (" + atajo + ")" : "");
            // Que pulsar no quite la selección del texto.
            b.addEventListener("mousedown", (e) => e.preventDefault());
            if (["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList",
                "justifyLeft", "justifyCenter", "justifyRight"].indexOf(cmd) >= 0) {
                b.setAttribute("aria-pressed", "false");
                estados.push([b, cmd]);
            }
            return b;
        };
        const grupo = (...hijos) => {
            const g = crear("span", "master-postit-grupo");
            g.append(...hijos);
            return g;
        };
        const elegir = (etiqueta, opciones, cmd, nombre) => {
            const sel = crear("select", "master-postit-elegir");
            sel.setAttribute("aria-label", nombre);
            sel.title = nombre;
            const primera = crear("option", "", etiqueta);
            primera.value = "-";
            sel.appendChild(primera);
            opciones.forEach(([hex, nombre]) => {
                const o = crear("option", "", nombre);
                o.value = hex;
                sel.appendChild(o);
            });
            sel.addEventListener("change", () => {
                if (sel.value === "-") {
                    return;
                }
                if (cmd === "hiliteColor") {
                    // Resaltar: el fondo claro y la letra oscura (que se
                    // lea en todos los temas).
                    orden("hiliteColor", sel.value || "transparent");
                    if (sel.value) {
                        orden("foreColor", "#14101a");
                    }
                } else if (sel.value) {
                    orden("foreColor", sel.value);
                } else {
                    orden("removeFormat");
                }
                sel.value = "-";
            });
            return sel;
        };
        const parrafo = crear("select", "master-postit-elegir");
        parrafo.setAttribute("aria-label", "Tipo de párrafo");
        parrafo.title = "Tipo de párrafo";
        [["P", "párrafo"], ["H3", "título"], ["H4", "subtítulo"], ["BLOCKQUOTE", "cita"]].forEach(([v, n]) => {
            const o = crear("option", "", n);
            o.value = v;
            parrafo.appendChild(o);
        });
        parrafo.addEventListener("change", () => orden("formatBlock", parrafo.value));
        const tamano = crear("select", "master-postit-elegir");
        tamano.setAttribute("aria-label", "Tamaño de la letra");
        tamano.title = "Tamaño de la letra";
        [["-", "🗚 tamaño"], ["2", "pequeña"], ["3", "normal"], ["5", "grande"], ["6", "enorme"]].forEach(([v, n]) => {
            const o = crear("option", "", n);
            o.value = v;
            tamano.appendChild(o);
        });
        tamano.addEventListener("change", () => {
            if (tamano.value !== "-") {
                orden("fontSize", tamano.value);
            }
            tamano.value = "-";
        });
        barra.append(
            grupo(herramienta("B", "Negrita", "bold", null, "es-negrita", "Ctrl+B"),
                herramienta("I", "Cursiva", "italic", null, "es-cursiva", "Ctrl+I"),
                herramienta("U", "Subrayado", "underline", null, "es-subrayado", "Ctrl+U"),
                herramienta("S", "Tachado", "strikeThrough", null, "es-tachado")),
            grupo(parrafo),
            grupo(tamano),
            grupo(herramienta("•", "Lista", "insertUnorderedList"), herramienta("1.", "Lista numerada", "insertOrderedList"),
                herramienta("→", "Más sangría", "indent"), herramienta("←", "Menos sangría", "outdent")),
            grupo(herramienta("⇤", "Alinear a la izquierda", "justifyLeft"), herramienta("↔", "Centrar", "justifyCenter"),
                herramienta("⇥", "Alinear a la derecha", "justifyRight")),
            grupo(elegir("🎨 letra", COLORES_LETRA, "foreColor", "Color de la letra"), elegir("🖍️ resaltar", COLORES_RESALTE, "hiliteColor", "Resaltar")),
            grupo(herramienta("―", "Línea de separación", "insertHorizontalRule"), herramienta("⌫", "Quitar el formato", "removeFormat"), herramienta("↶", "Deshacer", "undo", null, "", "Ctrl+Z"),
                herramienta("↷", "Rehacer", "redo", null, "", "Ctrl+Y")));
        // Las flechas mueven el foco por la barra (como en un procesador).
        barra.addEventListener("keydown", (e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" || e.target.tagName === "SELECT") {
                return;
            }
            const todos = Array.from(barra.querySelectorAll("button, select"));
            const i = todos.indexOf(e.target);
            if (i >= 0) {
                e.preventDefault();
                todos[(i + (e.key === "ArrowRight" ? 1 : -1) + todos.length) % todos.length].focus();
            }
        });
        function repintarEstados() {
            estados.forEach(([b, cmd]) => {
                let si = false;
                try {
                    si = document.queryCommandState(cmd);
                } catch (e) {
                    si = false;
                }
                b.setAttribute("aria-pressed", si ? "true" : "false");
            });
            let bloque = "P";
            try {
                bloque = String(document.queryCommandValue("formatBlock") || "p").toUpperCase();
            } catch (e) {
                bloque = "P";
            }
            parrafo.value = ["H3", "H4", "BLOCKQUOTE"].indexOf(bloque) >= 0 ? bloque : "P";
        }
        const alSeleccionar = () => {
            if (!area.isConnected && barra.dataset.montado) {
                document.removeEventListener("selectionchange", alSeleccionar);
                return;
            }
            barra.dataset.montado = "1";
            if (!area.hidden && area.contains(document.getSelection().anchorNode)) {
                repintarEstados();
            }
        };
        document.addEventListener("selectionchange", alSeleccionar);
        function alEscribir() {
            alCambiar();
        }
        area.addEventListener("input", alEscribir);
        // Lo pegado, sin el formato de fuera (sí con saltos de línea).
        area.addEventListener("paste", (e) => {
            const texto = e.clipboardData && e.clipboardData.getData("text/plain");
            if (texto !== undefined && texto !== null) {
                e.preventDefault();
                document.execCommand("insertText", false, texto);
            }
        });
        return { area, barra, leer: () => sanearHtml(area.innerHTML) };
    }

    function montarTarjeta(dentro, m) {
        m.datos = m.datos || {};
        if (m.datos.html === undefined && m.datos.texto) {
            m.datos.html = sanearHtml(markdown(m.datos.texto).innerHTML);
        }
        const ver = crear("div", "oc-texto master-postit");
        let espera = 0;
        const { area, barra, leer } = editorRico("Texto del post-it", () => {
            clearTimeout(espera);
            espera = setTimeout(() => {
                m.datos.html = leer();
                delete m.datos.texto;
                guardar();
            }, 400);
        });
        area.hidden = true;
        barra.hidden = true;
        const pintar = () => {
            ver.innerHTML = sanearHtml(m.datos.html || "");
            if (!ver.textContent.trim()) {
                ver.replaceChildren(crear("p", "oc-vacio", "Vacío: pulsa «editar» y escribe lo que quieras tener a mano."));
            } else if (window.ocDadosEnTexto) {
                window.ocDadosEnTexto(ver);
            }
        };
        const boton = botonDe("oc-vida-accion", "✏️ editar", () => {
            const editando = area.hidden;
            if (editando) {
                area.innerHTML = sanearHtml(m.datos.html || "") || "<p><br></p>";
                area.hidden = false;
                barra.hidden = false;
                ver.hidden = true;
                boton.textContent = "✔ listo";
                area.focus();
            } else {
                clearTimeout(espera);
                m.datos.html = leer();
                delete m.datos.texto;
                guardar();
                area.hidden = true;
                barra.hidden = true;
                ver.hidden = false;
                boton.textContent = "✏️ editar";
                pintar();
                boton.focus();
            }
        });
        boton.classList.add("master-postit-editar");
        dentro.append(barra, ver, area, boton);
        pintar();
    }

    // ---- LAS NOTAS DEL MÁSTER: el editor con formato siempre abierto,
    // con «poner la fecha», «descargar» (un .html que abre Word o el
    // navegador) y «borrar». Lo de antes (texto suelto de ocPartida,
    // «notas») pasa solo la primera vez. ----
    function montarNotas(dentro, m) {
        m.datos = m.datos || {};
        if (m.datos.html === undefined) {
            const antes = window.ocPartida && window.ocPartida.leer ? window.ocPartida.leer("notas", "") : "";
            m.datos.html = antes ? sanearHtml(markdown(antes).innerHTML) : "";
        }
        let espera = 0;
        const { area, barra, leer } = editorRico("Notas del máster (se guardan solas)", () => {
            clearTimeout(espera);
            espera = setTimeout(() => {
                m.datos.html = leer();
                guardar();
            }, 400);
        });
        area.classList.add("es-notas");
        area.innerHTML = sanearHtml(m.datos.html) || "<p><br></p>";
        const fecha = botonDe("oc-vida-accion", "📅 poner la fecha", () => {
            const hoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
            const h = crear("h3", "", hoy);
            const p = crear("p");
            p.appendChild(crear("br"));
            area.append(h, p);
            m.datos.html = leer();
            guardar();
            area.focus();
            const rango = document.createRange();
            rango.setStart(p, 0);
            rango.collapse(true);
            const sel = document.getSelection();
            sel.removeAllRanges();
            sel.addRange(rango);
            avisar("Fecha puesta: " + hoy + ".");
        });
        const bajar = botonDe("oc-vida-accion", "💾 descargar", () => {
            const pagina = "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><title>Notas del máster</title></head><body>" +
                leer() + "</body></html>";
            const a = crear("a");
            // Una dirección blob: que hace el propio navegador con el archivo.
            const archivoBlob = URL.createObjectURL(new Blob([pagina], { type: "text/html;charset=utf-8" }));
            a.href = archivoBlob;
            a.download = "notas-del-master-" + new Date().toISOString().slice(0, 10) + ".html";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(archivoBlob), 1000);
            avisar("Descargado: " + a.download + " (se abre con Word o el navegador).");
        }, "Descargar las notas (.html, con su formato)");
        let seguro = false;
        const borrar = botonDe("oc-vida-accion", "🗑️ borrar", () => {
            if (!seguro) {
                seguro = true;
                borrar.textContent = "🗑️ ¿seguro? pulsa otra vez";
                setTimeout(() => {
                    seguro = false;
                    borrar.textContent = "🗑️ borrar";
                }, 4000);
                return;
            }
            seguro = false;
            borrar.textContent = "🗑️ borrar";
            area.innerHTML = "<p><br></p>";
            m.datos.html = "";
            guardar();
            avisar("Notas borradas.");
        });
        const botones = crear("div", "master-notas-botones");
        botones.append(fecha, bajar, borrar);
        dentro.append(barra, area, botones);
    }

    // ---- EL GENERADOR DE NOMBRES: personajes por especie y género (de
    // sílabas, con su apellido) y lugares (pueblos, tabernas, parajes y
    // mazmorras), de datos/personajes/compendio/nombres.json. Cada nombre,
    // con «copiar». ----
    const NOMBRES = "/datos/personajes/compendio/nombres.json";

    function alAzar(lista) {
        const u = new Uint32Array(1);
        crypto.getRandomValues(u);
        return lista[u[0] % lista.length];
    }

    function nombreDe(datos, especie, genero, conApellido) {
        const e = datos.especies[especie];
        const g = genero === "cualquiera" ? alAzar(["m", "f", "n"]) : genero;
        let nombre = alAzar(e.ini) + alAzar(e[g]);
        // Los tiflin, a veces, con un nombre de virtud.
        if (especie === "tiflin" && alAzar([0, 0, 1])) {
            nombre = alAzar(datos.virtudes);
        }
        nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
        const ap = datos.apellidos[e.apellido];
        if (conApellido && ap) {
            const a = alAzar(ap.ini) + alAzar(ap.fin);
            nombre += " " + a.charAt(0).toUpperCase() + a.slice(1);
        }
        return nombre;
    }

    function lugarDe(datos, tipo) {
        const l = datos.lugares[tipo];
        if (tipo === "taberna") {
            const [sust, g] = alAzar(l.sust);
            const adj = alAzar(l.adj);
            return sust + " " + (g === "f" ? adj[1] : adj[0]);
        }
        if (tipo === "pueblo" && alAzar([0, 1])) {
            return alAzar(l.pre) + alAzar(l.adj);
        }
        return alAzar(l.base) + " " + alAzar(l.de);
    }

    // Un grupo de botones que se comportan como opciones (uno pulsado):
    // «opciones» [[valor, texto]], «alCambiar(valor)». Devuelve la caja,
    // con .valor() para leerlo.
    function botonesDe(etiqueta, opciones, valor, alCambiar) {
        const caja = crear("div", "master-opciones");
        caja.setAttribute("role", "group");
        caja.setAttribute("aria-label", etiqueta);
        let actual = valor;
        const botones = opciones.map(([v, texto]) => {
            const b = botonDe("master-opcion", texto, () => {
                actual = v;
                botones.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
                alCambiar(v);
            });
            b.setAttribute("aria-pressed", String(v === valor));
            return b;
        });
        caja.append(...botones);
        caja.valor = () => actual;
        return caja;
    }

    // Un desplegable con su etiqueta encima.
    function elegirDe(id, texto, opciones, valor) {
        const caja = crear("div", "master-campo");
        const et = crear("label", "oc-dados-etiqueta", texto);
        const x = crear("select", "master-elegir");
        x.id = id;
        et.htmlFor = x.id;
        opciones.forEach(([v, n]) => {
            const o = crear("option", "", n);
            o.value = v;
            x.appendChild(o);
        });
        x.value = valor;
        caja.append(et, x);
        caja.elegir = x;
        return caja;
    }

    function copiarTexto(texto, aviso) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(texto).then(() => avisar(aviso || "Copiado.")).catch(() => avisar("No se ha podido copiar."));
        }
    }

    // Un lugar en otro idioma: el nombre en español, sin «de», «la»…, y
    // cada palabra a una del idioma (siempre la misma, como en las notas).
    function lugarEn(nombre, idioma) {
        const sin = nombre.split(/\s+/).filter((p) => !/^(de|del|la|el|los|las|y|en)$/i.test(p)).join(" ");
        const n = inventar(sin, idioma, 3).replace(/(^|\s)(\p{Ll})/gu, (x, a, b) => a + b.toUpperCase());
        return { n, es: nombre, idioma: idioma.id };
    }

    function montarNombres(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        Promise.all([pedir(NOMBRES), pedir(IDIOMAS)]).then(([datos, lenguas]) => {
            const d = m.datos;
            const otras = lenguas.idiomas.filter((x) => x.id !== "comun");
            const lenguaDe = (id) => otras.find((x) => x.id === id);
            // Lo que sale y lo guardado: un texto, o {n, es, idioma} si es
            // un lugar en otro idioma.
            const nombreDe_ = (x) => (typeof x === "string" ? x : x.n);
            const tipos = [["personaje", "👤 personaje"]].concat(Object.keys(datos.lugares)
                .map((k) => [k, ({ pueblo: "🏘️ ", taberna: "🍺 ", region: "🏔️ ", mazmorra: "🕳️ " }[k] || "") + datos.lugares[k].nombre]));
            const que = elegirDe("master-nombres-que-" + m.id, "qué", tipos, d.que || "personaje");
            const especie = elegirDe("master-nombres-especie-" + m.id, "especie",
                Object.keys(datos.especies).map((k) => [k, datos.especies[k].nombre]), d.especie || "humano");
            const genero = botonesDe("género", [["cualquiera", "cualquiera"], ["f", "♀ femenino"], ["m", "♂ masculino"],
                ["n", "⚪ neutro"]], d.genero || "cualquiera", (v) => {
                d.genero = v;
                guardar();
            });
            const lengua = elegirDe("master-nombres-lengua-" + m.id, "en qué idioma",
                [["", "común (en español)"]].concat(otras.map((x) => [x.id, x.nombre])), d.lengua || "");
            const etAp = crear("label", "master-nombres-apellido");
            const ap = crear("input");
            ap.type = "checkbox";
            ap.checked = d.apellido !== false;
            etAp.append(ap, document.createTextNode(" con apellido"));
            const persona = crear("div", "master-nombres-persona");
            const etGen = crear("p", "oc-dados-etiqueta", "género");
            etGen.setAttribute("aria-hidden", "true");
            persona.append(especie, etAp, etGen, genero);
            const generar = botonDe("oc-vida-accion es-principal master-nombres-generar", "🎲 generar 8", () => {
                Object.assign(d, { que: que.elegir.value, especie: especie.elegir.value, genero: genero.valor(),
                    apellido: ap.checked, lengua: lengua.elegir.value });
                const salen = new Map();
                const enOtra = d.que !== "personaje" && lenguaDe(d.lengua);
                for (let i = 0; i < 40 && salen.size < 8; i++) {
                    const x = d.que === "personaje" ? nombreDe(datos, d.especie, d.genero, d.apellido)
                        : lugarDe(datos, d.que);
                    const sale = enOtra ? lugarEn(x, enOtra) : x;
                    salen.set(nombreDe_(sale), sale);
                }
                d.salen = Array.from(salen.values());
                guardar();
                pintar();
                avisar(d.salen.length + " nombres nuevos.");
            });
            const lista = crear("ul", "master-nombres");
            lista.setAttribute("aria-label", "Nombres que han salido");
            const guardadosT = crear("h3", "master-nombres-titulo", "⭐ guardados");
            const guardados = crear("ul", "master-nombres es-guardados");
            guardados.setAttribute("aria-label", "Nombres guardados");
            const fila = (x, guardado) => {
                const n = nombreDe_(x);
                const li = crear("li", "master-nombre");
                const texto = crear("span", "master-nombre-texto", n);
                const otra = typeof x === "string" ? null : lenguaDe(x.idioma);
                if (otra) {
                    const glifos = crear("span", "master-nombre-glifos es-" + otra.id, aSuAlfabeto(n, otra));
                    glifos.setAttribute("aria-hidden", "true");
                    texto.append(glifos, crear("span", "master-nombre-es", "«" + x.es + "» en " + otra.nombre.toLowerCase()));
                }
                li.appendChild(texto);
                const marcar = botonDe("master-nombre-boton", guardado ? "✕" : "☆", () => {
                    d.guardados = (d.guardados || []).filter((y) => nombreDe_(y) !== n);
                    if (!guardado) {
                        d.guardados.push(x);
                    }
                    guardar();
                    pintar();
                    avisar(guardado ? "Quitado: " + n + "." : "Guardado: " + n + ".");
                }, (guardado ? "Quitar de guardados: " : "Guardar: ") + n);
                marcar.title = guardado ? "Quitar" : "Guardar";
                const copiar = botonDe("master-nombre-boton", "⧉", () => copiarTexto(n, "Copiado: " + n + "."), "Copiar " + n);
                copiar.title = "Copiar";
                li.append(marcar, copiar);
                return li;
            };
            const pintar = () => {
                const ya = new Set((d.guardados || []).map(nombreDe_));
                lista.replaceChildren(...(d.salen || []).filter((x) => !ya.has(nombreDe_(x))).map((x) => fila(x, false)));
                if (!lista.children.length) {
                    lista.appendChild(crear("li", "oc-vacio", d.salen ? "Todos guardados. Genera más." : "Pulsa «generar»."));
                }
                guardados.replaceChildren(...(d.guardados || []).map((n) => fila(n, true)));
                guardadosT.hidden = guardados.hidden = !guardados.children.length;
            };
            const ajustar = () => {
                persona.hidden = que.elegir.value !== "personaje";
                lengua.hidden = !persona.hidden;
            };
            que.elegir.addEventListener("change", ajustar);
            const arriba = crear("div", "master-nombres-form");
            arriba.append(que, persona, lengua, generar);
            dentro.replaceChildren(arriba, lista, guardadosT, guardados);
            ajustar();
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar los nombres."));
        });
    }

    // ---- NOTAS EN OTROS IDIOMAS: se escribe (o se saca al azar) lo que
    // pone y se ve en el alfabeto de ese idioma, para enseñárselo a la
    // mesa. Los idiomas, sus letras y sus sílabas, en
    // datos/personajes/compendio/idiomas.json; las letras son fuentes Noto
    // (OFL) de escrituras reales, en tipografias/noto-*.woff2. Dos formas:
    // «letra a letra» (se puede descifrar) o «palabras inventadas» (cada
    // palabra pasa a una del idioma, siempre la misma). ----
    const IDIOMAS = "/datos/personajes/compendio/idiomas.json";
    const NOTAS_AL_AZAR = [
        "Nos vemos en {taberna} cuando suene la {hora} campanada. Ven solo.",
        "{nombre} sabe lo que hiciste. Paga {numero} piezas de oro o hablará.",
        "La entrada está bajo {pueblo}. No pises la tercera losa.",
        "Aquí yace {nombre}, que entró sin llamar.",
        "Prohibido el paso. Los intrusos serán devorados.",
        "El cargamento cruza {region} dentro de {numero} días. Que nadie lo vea.",
        "Si lees esto, ya es tarde.",
        "No te fíes de {nombre}. Lleva el anillo.",
        "{nombre}: la llave está en {mazmorra}. Quema esta nota.",
        "Tres pasos al norte, dos al este, y cava.",
        "Hemos perdido a {numero}. Los túneles cambian de sitio.",
        "Por orden de {nombre}, nadie sale de {pueblo} hasta la luna nueva.",
        "Lo que duerme bajo {region} no debe despertar.",
        "Debo {numero} monedas en {taberna}. Si no vuelvo, que las pague {nombre}.",
        "Al portador: dadle cama, comida y silencio.",
        "Cuidado: el puente no aguanta a más de dos.",
        "La puerta solo se abre a quien dice su nombre verdadero.",
        "{nombre} no murió en {mazmorra}. Lo he visto en {pueblo}.",
    ];

    // Un número que sale siempre igual para el mismo texto.
    function huella(texto) {
        let h = 2166136261;
        for (let i = 0; i < texto.length; i++) {
            h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
        }
        return h >>> 0;
    }

    // Cada palabra, a una inventada con las sílabas del idioma.
    // «tope»: las sílabas que puede tener cada palabra, como mucho.
    function inventar(texto, idioma, tope) {
        return texto.replace(/[\p{L}]+/gu, (palabra) => {
            let h = huella(idioma.id + ":" + palabra.toLowerCase());
            const siguiente = () => {
                h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
                return h;
            };
            const n = Math.min(tope || 99, Math.max(1, Math.round(palabra.length / 3)));
            let sale = "";
            let antes = -1;
            for (let i = 0; i < n; i++) {
                // Sin repetir la sílaba de antes («ululul», no).
                let j = siguiente() % idioma.silabas.length;
                if (j === antes) {
                    j = (j + 1) % idioma.silabas.length;
                }
                antes = j;
                sale += idioma.silabas[j];
            }
            const mayus = palabra.charAt(0) !== palabra.charAt(0).toLowerCase();
            return mayus ? sale.charAt(0).toUpperCase() + sale.slice(1) : sale;
        });
    }

    // Las letras (a-z y ñ) a las del alfabeto del idioma.
    function aSuAlfabeto(texto, idioma) {
        if (!idioma.glifos) {
            return texto;
        }
        const glifos = Array.from(idioma.glifos);
        return Array.from(texto.replace(/ñ/gi, "\u0000").normalize("NFD").replace(/[̀-ͯ]/g, ""))
            .map((c) => {
                if (c === "\u0000") {
                    return glifos[26];
                }
                const i = c.toLowerCase().charCodeAt(0) - 97;
                return i >= 0 && i < 26 ? glifos[i] : c;
            }).join("");
    }

    function notaAlAzar(nombres) {
        const lugar = (t) => lugarDe(nombres, t);
        return alAzar(NOTAS_AL_AZAR).replace(/\{(\w+)\}/g, (x, que) => {
            if (que === "nombre") {
                return nombreDe(nombres, alAzar(Object.keys(nombres.especies)), "cualquiera", alAzar([true, false]));
            }
            if (que === "numero") {
                return String(alAzar([2, 3, 5, 7, 12, 20, 50, 100]));
            }
            if (que === "hora") {
                return alAzar(["primera", "tercera", "sexta", "novena", "duodécima"]);
            }
            return nombres.lugares[que] ? lugar(que) : x;
        });
    }

    // La nota escrita en una imagen PNG (para enseñarla o pasarla).
    function notaEnImagen(texto, idioma, familia) {
        const tam = 44;
        const fuente = tam + "px \"" + familia + "\", \"Pangolin\", sans-serif";
        return document.fonts.load(fuente, texto).then(() => {
            const lienzo = document.createElement("canvas");
            const ctx = lienzo.getContext("2d");
            ctx.font = fuente;
            const ancho = 900;
            const lineas = [];
            texto.split("\n").forEach((parrafo) => {
                let linea = "";
                parrafo.split(" ").forEach((p) => {
                    const prueba = linea ? linea + " " + p : p;
                    if (linea && ctx.measureText(prueba).width > ancho) {
                        lineas.push(linea);
                        linea = p;
                    } else {
                        linea = prueba;
                    }
                });
                lineas.push(linea);
            });
            const alto = Math.round(tam * 1.6);
            lienzo.width = ancho + 120;
            lienzo.height = lineas.length * alto + 120;
            ctx.fillStyle = "#efe2bf";
            ctx.fillRect(0, 0, lienzo.width, lienzo.height);
            ctx.strokeStyle = "#8a6a3a";
            ctx.lineWidth = 6;
            ctx.strokeRect(12, 12, lienzo.width - 24, lienzo.height - 24);
            ctx.fillStyle = "#3b2a17";
            ctx.font = fuente;
            ctx.textBaseline = "top";
            lineas.forEach((l, i) => ctx.fillText(l, 60, 60 + i * alto));
            return new Promise((hecho) => lienzo.toBlob(hecho, "image/png"));
        }).then((blob) => {
            const a = crear("a");
            const archivoBlob = URL.createObjectURL(blob);
            a.href = archivoBlob;
            a.download = "nota-" + idioma.id + ".png";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(archivoBlob), 1000);
            avisar("Descargada la imagen: " + a.download + ".");
        });
    }

    // El alfabeto de referencia de un idioma: cada letra con su símbolo.
    // El símbolo, escondido al lector de pantalla (no dice nada); la
    // letra, no.
    function claveDe(idioma, clase) {
        const lista = crear("ul", "master-idioma-clave " + clase + " es-" + idioma.id);
        lista.setAttribute("aria-label", "Alfabeto " + idioma.nombre.toLowerCase());
        const glifos = Array.from(idioma.glifos || "");
        "abcdefghijklmnopqrstuvwxyzñ".split("").forEach((letra, i) => {
            const li = crear("li", "master-idioma-letra");
            const g = crear("span", "master-idioma-glifo", glifos[i] || "");
            g.setAttribute("aria-hidden", "true");
            li.append(g, crear("span", "master-idioma-latina", letra));
            lista.appendChild(li);
        });
        return lista;
    }

    function montarIdiomas(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        Promise.all([pedir(IDIOMAS), pedir(NOMBRES)]).then(([datos, nombres]) => {
            const d = m.datos;
            const de = (id) => datos.idiomas.find((x) => x.id === id) || datos.idiomas[1];
            const idioma = elegirDe("master-idioma-que-" + m.id, "idioma",
                datos.idiomas.map((x) => [x.id, x.nombre + " (" + x.alfabeto + ")"]), de(d.idioma).id);
            const como = botonesDe("cómo se escribe", [["letras", "🔤 letra a letra"], ["inventado", "🗣️ palabras inventadas"]],
                d.como || "letras", (v) => {
                    d.como = v;
                    guardar();
                    pintar();
                });
            como.title = "Letra a letra: se puede descifrar. Palabras inventadas: cada palabra pasa a una de ese idioma.";
            const etT = crear("label", "oc-dados-etiqueta", "lo que pone");
            const texto = crear("textarea", "oc-notas-texto es-corta");
            texto.id = "master-idioma-texto-" + m.id;
            texto.rows = 3;
            texto.value = d.texto || "";
            etT.htmlFor = texto.id;
            const azar = botonDe("oc-vida-accion", "🎲 nota al azar", () => {
                texto.value = notaAlAzar(nombres);
                d.texto = texto.value;
                guardar();
                pintar();
                avisar("Nota nueva: " + texto.value);
            });
            const hoja = crear("div", "master-idioma-hoja");
            hoja.setAttribute("role", "img");
            const dice = crear("p", "master-idioma-dice");
            const ver = crear("label", "master-nombres-apellido");
            const verCaja = crear("input");
            verCaja.type = "checkbox";
            verCaja.checked = d.ver !== false;
            ver.append(verCaja, document.createTextNode(" ver lo que pone debajo"));
            const tam = d.tam || 2;
            hoja.style.setProperty("--tam", tam + "rem");
            const cambiaTam = (mas) => {
                d.tam = Math.min(4, Math.max(1, (d.tam || 2) + mas));
                hoja.style.setProperty("--tam", d.tam + "rem");
                guardar();
                avisar("Tamaño " + Math.round(d.tam * 50) + " %.");
            };
            const menos = botonDe("master-nombre-boton", "A−", () => cambiaTam(-0.25), "Letra más pequeña");
            const mas = botonDe("master-nombre-boton", "A+", () => cambiaTam(0.25), "Letra más grande");
            const escrito = () => {
                const id = de(idioma.elegir.value);
                const palabras = (d.como || "letras") === "inventado" ? inventar(texto.value, id) : texto.value;
                return { id, palabras, letras: aSuAlfabeto(palabras, id) };
            };
            const ensenar = botonDe("oc-vida-accion es-principal", "👁️ enseñar", () => {
                const e = escrito();
                const grande = crear("div", "master-idioma-hoja es-grande es-" + e.id.id);
                grande.textContent = e.letras;
                grande.setAttribute("role", "img");
                grande.setAttribute("aria-label", "Nota en " + e.id.nombre + ". Pone: " + texto.value);
                window.ocVentana.abrir({ titulo: "Nota en " + e.id.nombre.toLowerCase(), cuerpo: grande, vuelta: ensenar,
                    clase: "es-ancha" });
            }, "Enseñar la nota en grande");
            const copiar = botonDe("oc-vida-accion", "⧉ copiar", () => copiarTexto(escrito().letras, "Copiada la nota."),
                "Copiar la nota en su alfabeto");
            const imagen = botonDe("oc-vida-accion", "🖼️ imagen", () => {
                const e = escrito();
                notaEnImagen(e.letras || " ", e.id, e.id.glifos ? "Richi " + e.id.fuente : "Pangolin")
                    .catch(() => avisar("No se ha podido hacer la imagen."));
            }, "Descargar la nota como imagen");
            const clave = crear("div", "master-idioma-panel");
            clave.id = "master-idioma-clave-" + m.id;
            const verClave = botonDe("oc-vida-accion", "🔑 alfabeto", () => {
                d.clave = !d.clave;
                guardar();
                pintar();
            }, "Alfabeto de referencia");
            verClave.setAttribute("aria-controls", clave.id);
            const pintarClave = (id) => {
                verClave.hidden = !id.glifos;
                verClave.setAttribute("aria-expanded", String(!!d.clave));
                clave.hidden = !d.clave || !id.glifos;
                if (clave.hidden) {
                    clave.replaceChildren();
                    return;
                }
                const grande = botonDe("oc-vida-accion", "👁️ enseñar el alfabeto", () => {
                    window.ocVentana.abrir({ titulo: "Alfabeto " + id.nombre.toLowerCase() + " (" + id.alfabeto + ")",
                        cuerpo: claveDe(id, "es-grande"), vuelta: grande, clase: "es-ancha" });
                });
                clave.replaceChildren(claveDe(id, ""), grande);
                if (Array.from(new Set(Array.from(id.glifos))).length < 27) {
                    clave.insertBefore(crear("p", "oc-hoja-nota", "Este alfabeto tiene menos símbolos: algunas letras comparten el mismo."),
                        grande);
                }
            };
            const pintar = () => {
                const e = escrito();
                pintarClave(e.id);
                hoja.className = "master-idioma-hoja es-" + e.id.id;
                hoja.textContent = e.letras || "…";
                hoja.setAttribute("aria-label", "Nota en " + e.id.nombre + " (" + e.id.alfabeto + "). Pone: " +
                    (texto.value || "nada todavía"));
                dice.replaceChildren();
                if (verCaja.checked && texto.value) {
                    dice.append(crear("strong", "", "Pone: "), document.createTextNode(texto.value));
                    if (e.palabras !== texto.value) {
                        dice.append(crear("br"), crear("strong", "", "Suena: "), document.createTextNode(e.palabras));
                    }
                }
                dice.hidden = !dice.childNodes.length;
            };
            let espera = 0;
            texto.addEventListener("input", () => {
                pintar();
                clearTimeout(espera);
                espera = setTimeout(() => {
                    d.texto = texto.value;
                    guardar();
                }, 400);
            });
            idioma.elegir.addEventListener("change", () => {
                d.idioma = idioma.elegir.value;
                guardar();
                pintar();
            });
            verCaja.addEventListener("change", () => {
                d.ver = verCaja.checked;
                guardar();
                pintar();
            });
            const arriba = crear("div", "master-nombres-form");
            arriba.append(idioma, como);
            const escribir = crear("div", "master-idioma-escribir");
            escribir.append(etT, texto, azar);
            const tamanos = crear("div", "master-idioma-tam");
            tamanos.setAttribute("role", "group");
            tamanos.setAttribute("aria-label", "Tamaño de la letra");
            tamanos.append(menos, mas);
            const botones = crear("div", "master-idioma-botones");
            botones.append(ensenar, copiar, imagen, verClave, tamanos);
            dentro.replaceChildren(arriba, escribir, hoja, ver, dice, botones, clave);
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar los idiomas."));
        });
    }

    // ---- BOTÍN Y ENCUENTROS: generadores PROPIOS (las tablas de la DMG y
    // la Xanathar's no son del SRD). Las monedas, gemas y obras de arte,
    // en tablas inventadas aquí; los objetos mágicos y los monstruos, del
    // SRD (tienda.json y bestiario.json). ----
    const TIENDA = "/datos/personajes/compendio/tienda.json";
    const BESTIARIO = "/datos/personajes/compendio/bestiario.json";
    const FRANJAS = [["0", "VD 0–4"], ["1", "VD 5–10"], ["2", "VD 11–16"], ["3", "VD 17 o más"]];

    // «3d6» a un número, sin pasar por el registro de tiradas.
    function tiradaSuelta(formula) {
        const m = /^(\d+)d(\d+)$/.exec(formula);
        if (!m) {
            return parseInt(formula, 10) || 0;
        }
        const u = new Uint32Array(parseInt(m[1], 10));
        crypto.getRandomValues(u);
        return Array.from(u).reduce((t, x) => t + (x % parseInt(m[2], 10)) + 1, 0);
    }

    // Monedas: [moneda, dados, por cuánto se multiplica], por franja.
    const BOTIN_MONEDAS = {
        uno: [[["pp", "3d6", 1], ["po", "1d6", 1]], [["pp", "2d6", 10], ["po", "4d6", 1]],
            [["po", "2d6", 10], ["ppt", "1d6", 1]], [["po", "4d6", 10], ["ppt", "2d6", 1]]],
        tesoro: [[["pc", "2d6", 100], ["pp", "2d6", 100], ["po", "2d6", 20]],
            [["pp", "2d6", 100], ["po", "4d6", 100], ["ppt", "1d6", 10]],
            [["po", "4d6", 500], ["ppt", "2d6", 50]], [["po", "6d6", 2000], ["ppt", "4d6", 500]]],
    };
    const BOTIN_GEMAS = {
        10: ["ágata", "cuarzo azul", "hematites", "lapislázuli", "malaquita", "obsidiana", "ojo de tigre", "turquesa"],
        50: ["calcedonia", "citrino", "cornalina", "jaspe sanguíneo", "ónice", "piedra de luna", "cuarzo rosa", "circón"],
        100: ["ámbar", "amatista", "coral rojo", "granate", "jade", "perla", "espinela", "turmalina"],
        500: ["aguamarina", "alejandrita", "perla negra", "peridoto", "topacio dorado", "espinela azul"],
        1000: ["ópalo negro", "ópalo de fuego", "zafiro azul", "esmeralda", "zafiro estrella", "rubí estrella"],
        5000: ["diamante", "rubí sangre", "zafiro negro", "jacinto", "esmeralda sin defecto"],
    };
    const BOTIN_ARTE = {
        25: ["un aguamanil de cobre con asas de serpiente", "una baraja de naipes pintados a mano",
            "un espejo de mano con marco de plata", "una figurita de hueso tallado de un búho", "un par de dados de marfil",
            "un incensario de latón", "un pañuelo de seda bordado", "una pipa de brezo con boquilla de ámbar"],
        250: ["una copa de plata con incrustaciones de ámbar", "un tapiz pequeño de una cacería",
            "un broche de oro con forma de hoja", "una caja de música de nogal", "una máscara ceremonial de bronce",
            "un catalejo de latón grabado", "un anillo de sello de oro", "un cuadro al óleo de un puerto"],
        750: ["una corona de plata con perlas", "un cáliz de oro con granates", "una daga ceremonial con empuñadura de jade",
            "un tablero de ajedrez de ébano y marfil", "un collar de cuentas de amatista",
            "una estatuilla de oro de un dragón dormido"],
        2500: ["un brazalete de platino con zafiros", "un ídolo de jade del tamaño de un puño",
            "una diadema de oro con esmeraldas", "un relicario de oro con un retrato en miniatura",
            "un tapiz enorme tejido con hilo de oro"],
        7500: ["una corona de oro con rubíes", "un cetro de platino con un diamante en la punta",
            "una armadura ceremonial dorada, de adorno", "una estatua de mithral de una diosa",
            "un huevo de oro con joyas incrustadas"],
    };
    // En un tesoro, por franja: cuántas gemas u obras de arte, de qué
    // valores, y cuántos objetos mágicos y de qué rareza (con su peso).
    const BOTIN_TESORO = [
        { cuantas: "1d4", gemas: [10, 50], arte: [25], magicos: "1d4", menos: 1,
            rarezas: [["común", 30], ["poco común", 70]] },
        { cuantas: "1d6", gemas: [50, 100], arte: [250], magicos: "1d4", menos: 0,
            rarezas: [["poco común", 55], ["rara", 40], ["muy rara", 5]] },
        { cuantas: "1d6", gemas: [500, 1000], arte: [750, 2500], magicos: "1d4", menos: -1,
            rarezas: [["poco común", 20], ["rara", 50], ["muy rara", 25], ["legendaria", 5]] },
        { cuantas: "2d4", gemas: [1000, 5000], arte: [2500, 7500], magicos: "1d6", menos: -1,
            rarezas: [["rara", 25], ["muy rara", 45], ["legendaria", 30]] },
    ];
    const VALOR_MONEDA = { pc: 1, pp: 10, pe: 50, po: 100, ppt: 1000 };

    function conPeso(lista) {
        const total = lista.reduce((t, x) => t + x[1], 0);
        let r = tiradaSuelta("1d" + total);
        for (const [x, p] of lista) {
            r -= p;
            if (r <= 0) {
                return x;
            }
        }
        return lista[0][0];
    }

    function hacerBotin(objetos, franja, tipo) {
        const sale = { monedas: [], cosas: [], objetos: [] };
        BOTIN_MONEDAS[tipo][franja].forEach(([k, dados, por]) => {
            sale.monedas.push([k, tiradaSuelta(dados) * por]);
        });
        const t = BOTIN_TESORO[franja];
        const magicos = objetos.filter((o) => o.rareza && o.rareza !== "artefacto");
        const unObjeto = () => {
            const rareza = conPeso(t.rarezas);
            const de = magicos.filter((o) => o.rareza === rareza);
            return de.length ? alAzar(de).en : null;
        };
        if (tipo === "tesoro") {
            const que = tiradaSuelta("1d6");
            if (que >= 3) {
                const gemas = que <= 4;
                const valor = alAzar(gemas ? t.gemas : t.arte);
                const n = tiradaSuelta(t.cuantas);
                const lista = (gemas ? BOTIN_GEMAS : BOTIN_ARTE)[valor];
                const cuantas = {};
                for (let i = 0; i < n; i++) {
                    const x = alAzar(lista);
                    cuantas[x] = (cuantas[x] || 0) + 1;
                }
                Object.keys(cuantas).forEach((x) => sale.cosas.push({ que: gemas ? "gema" : "arte", texto: x, n: cuantas[x], valor }));
            }
            const n = Math.max(0, tiradaSuelta(t.magicos) - t.menos);
            for (let i = 0; i < n; i++) {
                const o = unObjeto();
                if (o) {
                    sale.objetos.push(o);
                }
            }
        } else if (tiradaSuelta("1d20") === 20) {
            // Uno de cada veinte lleva encima algo mágico.
            const o = unObjeto();
            if (o) {
                sale.objetos.push(o);
            }
        }
        return sale;
    }

    function montarBotin(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        pedir(TIENDA).then((tienda) => {
            const d = m.datos;
            const porEn = {};
            tienda.objetos.forEach((o) => {
                porEn[o.en] = o;
            });
            const franja = elegirDe("master-botin-franja-" + m.id, "de quién (su valor de desafío)", FRANJAS, d.franja || "0");
            const tipo = botonesDe("qué", [["uno", "👤 lo que lleva encima uno"], ["tesoro", "💎 un tesoro"]], d.tipo || "tesoro",
                (v) => {
                    d.tipo = v;
                    guardar();
                });
            const sale = crear("div", "master-botin");
            sale.setAttribute("aria-live", "polite");
            const texto = () => {
                const r = d.sale;
                const lineas = [];
                if (!r) {
                    return "";
                }
                lineas.push("Monedas: " + r.monedas.filter((x) => x[1]).map((x) => x[1].toLocaleString("es-ES") + " " + x[0]).join(", "));
                r.cosas.forEach((c) => lineas.push((c.n > 1 ? c.n + " × " : "") + c.texto + " (" + c.valor.toLocaleString("es-ES") +
                    " po" + (c.n > 1 ? " cada " + (c.que === "gema" ? "una" : "uno") : "") + ")"));
                r.objetos.forEach((en) => lineas.push((porEn[en] || { nombre: en }).nombre));
                return lineas.join("\n");
            };
            const pintar = () => {
                const r = d.sale;
                sale.replaceChildren();
                if (!r) {
                    sale.appendChild(crear("p", "oc-vacio", "Elige y pulsa «generar»."));
                    return;
                }
                const lista = crear("ul", "master-botin-lista");
                const monedas = r.monedas.filter((x) => x[1]);
                const li = crear("li", "master-botin-cosa es-monedas");
                li.append(crear("span", "master-botin-icono", "🪙"), crear("span", "",
                    monedas.map((x) => x[1].toLocaleString("es-ES") + " " + x[0]).join(" · ")));
                li.querySelector("span:last-child").setAttribute("aria-label", "Monedas: " + monedas.map((x) =>
                    x[1].toLocaleString("es-ES") + " " + (MONEDAS.find((y) => y[0] === x[0]) || [0, x[0]])[1]).join(", "));
                lista.appendChild(li);
                r.cosas.forEach((c) => {
                    const x = crear("li", "master-botin-cosa");
                    x.append(crear("span", "master-botin-icono", c.que === "gema" ? "💎" : "🏺"),
                        crear("span", "", (c.n > 1 ? c.n + " × " : "") + c.texto),
                        crear("span", "master-botin-valor", c.valor.toLocaleString("es-ES") + " po" + (c.n > 1 ? " c/u" : "")));
                    lista.appendChild(x);
                });
                r.objetos.forEach((en) => {
                    const o = porEn[en];
                    if (!o) {
                        return;
                    }
                    const x = crear("li", "master-botin-cosa es-magico");
                    const b = botonDe("master-botin-objeto", o.nombre, () => abrirObjeto(o, b, tienda.fuente), "Ver " + o.nombre);
                    x.append(crear("span", "master-botin-icono", "✨"), b, crear("span", "master-botin-valor", o.rareza));
                    lista.appendChild(x);
                });
                let total = monedas.reduce((t, x) => t + x[1] * VALOR_MONEDA[x[0]], 0) / 100;
                r.cosas.forEach((c) => {
                    total += c.n * c.valor;
                });
                sale.append(lista, crear("p", "master-botin-total", "Monedas, gemas y arte: unas " +
                    Math.round(total).toLocaleString("es-ES") + " po" + (r.objetos.length ? ", más " + r.objetos.length +
                    (r.objetos.length > 1 ? " objetos mágicos." : " objeto mágico.") : ".")));
            };
            const generar = botonDe("oc-vida-accion es-principal master-nombres-generar", "🎲 generar botín", () => {
                d.franja = franja.elegir.value;
                d.tipo = tipo.valor();
                d.sale = hacerBotin(tienda.objetos, parseInt(d.franja, 10), d.tipo);
                guardar();
                pintar();
                avisar("Botín nuevo: " + texto().replace(/\n/g, ". ") + ".");
            });
            const copiar = botonDe("oc-vida-accion", "⧉ copiar", () => copiarTexto(texto(), "Copiado el botín."), "Copiar el botín");
            const arriba = crear("div", "master-nombres-form");
            arriba.append(franja, tipo, generar);
            dentro.replaceChildren(arriba, sale, copiar,
                crear("p", "oc-hoja-nota master-fuente", "Monedas, gemas y arte: tablas propias. Objetos: SRD 5.2 (CC BY 4.0)."));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar los objetos."));
        });
    }

    // ENCUENTROS: monstruos del SRD de un hábitat que quepan en lo que
    // aguanta la party. El presupuesto, una cuenta propia: por cada PJ,
    // los PX de un monstruo de VD igual a su nivel, por 0,25 (bajo), 0,4
    // (moderado) o 0,6 (alto).
    const DIFICULTADES = [["baja", "baja", 0.25], ["moderada", "moderada", 0.4], ["alta", "alta", 0.6]];
    const QUE_HACEN = ["acampando alrededor de una hoguera", "de caza", "peleándose entre ellos", "persiguiendo a alguien",
        "vigilando algo que no quieren que se vea", "durmiendo (casi todos)", "de paso, sin prisa", "preparando una emboscada",
        "huyendo de algo peor", "repartiéndose un botín", "perdidos", "buscando a los PJ"];
    // Los PX de un monstruo de VD 1 a 20 (los de sus perfiles del SRD).
    const PX_POR_VD = [200, 450, 700, 1100, 1800, 2300, 2900, 3900, 5000, 5900, 7200, 8400, 10000, 11500, 13000, 15000, 18000,
        20000, 22000, 25000];
    const pxDe = (b) => {
        const m = /\(([\d.]+) PX/.exec(b.vd || "");
        return m ? parseInt(m[1].replace(/\./g, ""), 10) : 0;
    };
    const vdNum = (vd) => (vd.indexOf("/") >= 0 ? 1 / parseInt(vd.split("/")[1], 10) : parseFloat(vd));

    function hacerEncuentro(bichos, habitat, nivel, pjs, factor) {
        const presupuesto = Math.round(pjs * PX_POR_VD[Math.min(20, Math.max(1, nivel)) - 1] * factor);
        const de = bichos.filter((b) => pxDe(b) && (habitat === "" || (b.habitat || []).some((h) => h === habitat || h === "cualquiera"))
            && vdNum(b.cr) <= nivel + 3);
        const grupos = [];
        let queda = presupuesto;
        for (let intento = 0; intento < 2 && queda > presupuesto * 0.15; intento++) {
            const minimo = intento ? 0 : presupuesto * 0.2;
            const caben = de.filter((b) => pxDe(b) <= queda && pxDe(b) >= minimo && !grupos.some((g) => g.en === b.en));
            if (!caben.length) {
                break;
            }
            const b = alAzar(caben);
            const n = tiradaSuelta("1d" + Math.min(6, Math.floor(queda / pxDe(b))));
            grupos.push({ en: b.en, n });
            queda -= n * pxDe(b);
        }
        return { presupuesto, grupos, hacen: alAzar(QUE_HACEN) };
    }

    function montarEncuentros(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        pedir(BESTIARIO).then((datos) => {
            const d = m.datos;
            const bichos = datos.monstruos;
            const porEn = {};
            bichos.forEach((b) => {
                porEn[b.en] = b;
            });
            const habitats = Array.from(new Set(bichos.flatMap((b) => b.habitat || []))).filter((h) => h !== "cualquiera")
                .sort((a, b) => a.localeCompare(b, "es"));
            const habitat = elegirDe("master-encuentro-habitat-" + m.id, "dónde",
                [["", "cualquier sitio"]].concat(habitats.map((h) => [h, h])), d.habitat || "");
            const enParty = estado.modulos.filter((x) => x.tipo === "party")
                .reduce((t, x) => t + ((x.datos && x.datos.pjs) || []).length, 0);
            const numero = (id, texto, valor, min, max) => {
                const caja = crear("div", "master-campo");
                const et = crear("label", "oc-dados-etiqueta", texto);
                const x = crear("input", "master-elegir");
                x.type = "number";
                x.min = min;
                x.max = max;
                x.value = valor;
                x.id = id + m.id;
                et.htmlFor = x.id;
                caja.append(et, x);
                caja.elegir = x;
                return caja;
            };
            const nivel = numero("master-encuentro-nivel-", "nivel de la party", d.nivel || 3, 1, 20);
            const pjs = numero("master-encuentro-pjs-", "cuántos PJ" + (enParty ? " (en la party hay " + enParty + ")" : ""),
                d.pjs || enParty || 4, 1, 10);
            const fila = crear("div", "master-encuentro-fila");
            fila.append(nivel, pjs);
            const dificultad = botonesDe("dificultad", DIFICULTADES.map((x) => [x[0], x[1]]), d.dificultad || "moderada", (v) => {
                d.dificultad = v;
                guardar();
            });
            const etDif = crear("p", "oc-dados-etiqueta", "dificultad");
            etDif.setAttribute("aria-hidden", "true");
            const sale = crear("div", "master-botin");
            sale.setAttribute("aria-live", "polite");
            const pintar = () => {
                const r = d.sale;
                sale.replaceChildren();
                if (!r) {
                    sale.appendChild(crear("p", "oc-vacio", "Elige y pulsa «generar»."));
                    return;
                }
                if (!r.grupos.length) {
                    sale.appendChild(crear("p", "oc-vacio", "No cabe ningún monstruo de ese sitio. Prueba con otro o sube la dificultad."));
                    return;
                }
                const lista = crear("ul", "master-botin-lista");
                let px = 0;
                r.grupos.forEach((g) => {
                    const b = porEn[g.en];
                    if (!b) {
                        return;
                    }
                    px += g.n * pxDe(b);
                    const li = crear("li", "master-botin-cosa");
                    const ver = botonDe("master-botin-objeto", (g.n > 1 ? g.n + " × " : "") + b.nombre, () => abrirBicho(b, ver, datos.fuente),
                        "Ver " + b.nombre);
                    li.append(tokenDe(b), ver, crear("span", "master-botin-valor", "VD " + b.cr + " · " +
                        (g.n * pxDe(b)).toLocaleString("es-ES") + " PX"));
                    lista.appendChild(li);
                });
                const todos = botonDe("oc-vida-accion es-principal", "⚔️ todos a la iniciativa", () => {
                    const entran = [];
                    r.grupos.forEach((g) => {
                        const b = porEn[g.en];
                        for (let i = 0; i < g.n && b; i++) {
                            entran.push(meterEnIniciativa({ nombre: b.nombre, bono: b.ini, ca: b.ca, pg: b.pg || "", color: "#d23b3b" },
                                (nombres, renombrar) => conNumero(b.nombre, nombres, renombrar)));
                        }
                    });
                    avisar("A la iniciativa: " + entran.filter(Boolean).join(", ") + ".");
                });
                sale.append(crear("p", "master-encuentro-hacen", "Están " + r.hacen + "."), lista,
                    crear("p", "master-botin-total", px.toLocaleString("es-ES") + " PX de " +
                        r.presupuesto.toLocaleString("es-ES") + " que aguanta la party."), todos);
            };
            const generar = botonDe("oc-vida-accion es-principal master-nombres-generar", "🎲 generar encuentro", () => {
                d.habitat = habitat.elegir.value;
                d.nivel = Math.min(20, Math.max(1, parseInt(nivel.elegir.value, 10) || 1));
                d.pjs = Math.min(10, Math.max(1, parseInt(pjs.elegir.value, 10) || 1));
                d.dificultad = dificultad.valor();
                const f = (DIFICULTADES.find((x) => x[0] === d.dificultad) || DIFICULTADES[1])[2];
                d.sale = hacerEncuentro(bichos, d.habitat, d.nivel, d.pjs, f);
                guardar();
                pintar();
                avisar(d.sale.grupos.length ? "Encuentro: " + d.sale.grupos.map((g) => g.n + " " + (porEn[g.en] || {}).nombre)
                    .join(" y ") + ", " + d.sale.hacen + "." : "No cabe ningún monstruo.");
            });
            const arriba = crear("div", "master-nombres-form");
            arriba.append(habitat, fila, etDif, dificultad, generar);
            dentro.replaceChildren(arriba, sale, crear("p", "oc-hoja-nota master-fuente",
                "Monstruos: SRD 5.2 (CC BY 4.0). La dificultad es una cuenta propia, aproximada."));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar el bestiario."));
        });
    }

    // ---- EL DIBUJO: un Paint con capas. A la izquierda, las
    // herramientas (lápiz, goma, bote, seleccionar y mover, cuentagotas,
    // línea, rectángulo y elipse), los colores (los de siempre y uno a
    // elegir) y los grosores; en medio, el lienzo; a la derecha, las capas
    // y carpetas (como el Photoshop) y la rejilla de rol.
    //
    // Cómo va: cada capa es un <canvas> de DIBUJO_ANCHO × DIBUJO_ALTO,
    // transparente; lo que se ve es «vista», que pinta el papel y encima
    // las capas visibles (de abajo arriba). Lo que se está haciendo (la
    // selección, la línea que aún no se ha soltado, la rejilla) va en
    // «encima», otro canvas pegado sobre la vista, que es el que recibe
    // el ratón o el dedo. Se guarda en m.datos: «capas» (el árbol: capas
    // y carpetas, la de arriba primero; cada capa con su imagen WebP),
    // «activa», «rejilla» y las herramientas. ----
    const DIBUJO_ANCHO = 1000;
    const DIBUJO_ALTO = 750;
    const DIBUJO_PAPEL = "#fdfaf0";
    const DIBUJO_COLORES = [["#1d1b26", "negro"], ["#ffffff", "blanco"], ["#c62828", "rojo"], ["#1565c0", "azul"],
        ["#2e7d32", "verde"], ["#ef6c00", "naranja"], ["#6a1b9a", "morado"], ["#8d6e63", "marrón"], ["#fdd835", "amarillo"],
        ["#9e9e9e", "gris"]];
    // [id, emoji, nombre, tecla]
    const DIBUJO_HERRAMIENTAS = [["lapiz", "✏️", "Lápiz", "b"], ["goma", "🧽", "Goma", "e"], ["bote", "🪣", "Bote de pintura", "g"],
        ["seleccionar", "⬚", "Seleccionar y mover", "m"], ["cuentagotas", "💧", "Cuentagotas (coger un color)", "i"],
        ["linea", "╱", "Línea recta", "l"], ["rectangulo", "▭", "Rectángulo", "u"], ["elipse", "◯", "Elipse", "o"],
        ["texto", "T", "Texto", "t"]];
    const DIBUJO_FUENTES = [["Pangolin", "a mano"], ["Space Grotesk", "normal"], ["Georgia, serif", "con serifa"],
        ["DM Mono", "de máquina"], ["Jersey 10", "de píxeles"]];

    // Solo imágenes metidas en la propia dirección (data:image/…): lo
    // único que lee el dibujo (lo que guarda él y los archivos que se
    // pegan). Cualquier otra cosa, nada.
    function imagenSegura(url) {
        return /^data:image\/(png|jpeg|gif|webp|bmp|svg\+xml|avif);base64,[A-Za-z0-9+/=]+$/.test(String(url || "")) ? url : "";
    }

    function lienzoNuevo(ancho, alto) {
        const c = document.createElement("canvas");
        c.width = ancho || DIBUJO_ANCHO;
        c.height = alto || DIBUJO_ALTO;
        return c;
    }

    // «#rrggbb» a [r, g, b].
    const rgbDe = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

    // EL BOTE: rellena la zona del mismo color (con algo de margen) que
    // hay alrededor del punto, en los píxeles de «datos» (ImageData).
    function rellenar(datos, x, y, color, margen) {
        const w = datos.width;
        const h = datos.height;
        const px = datos.data;
        const i0 = (y * w + x) * 4;
        const base = [px[i0], px[i0 + 1], px[i0 + 2], px[i0 + 3]];
        const [r, g, b] = rgbDe(color);
        if (base[0] === r && base[1] === g && base[2] === b && base[3] === 255) {
            return false;
        }
        margen = margen === undefined ? 40 : margen;
        const igual = (i) => Math.abs(px[i] - base[0]) <= margen && Math.abs(px[i + 1] - base[1]) <= margen &&
            Math.abs(px[i + 2] - base[2]) <= margen && Math.abs(px[i + 3] - base[3]) <= margen;
        const hecho = new Uint8Array(w * h);
        const pila = [[x, y]];
        while (pila.length) {
            let [cx, cy] = pila.pop();
            while (cx >= 0 && !hecho[cy * w + cx] && igual((cy * w + cx) * 4)) {
                cx--;
            }
            cx++;
            let arriba = false;
            let abajo = false;
            while (cx < w && !hecho[cy * w + cx] && igual((cy * w + cx) * 4)) {
                const i = (cy * w + cx) * 4;
                px[i] = r;
                px[i + 1] = g;
                px[i + 2] = b;
                px[i + 3] = 255;
                hecho[cy * w + cx] = 1;
                if (cy > 0) {
                    const sigue = !hecho[(cy - 1) * w + cx] && igual(((cy - 1) * w + cx) * 4);
                    if (sigue && !arriba) {
                        pila.push([cx, cy - 1]);
                    }
                    arriba = sigue;
                }
                if (cy < h - 1) {
                    const sigue = !hecho[(cy + 1) * w + cx] && igual(((cy + 1) * w + cx) * 4);
                    if (sigue && !abajo) {
                        pila.push([cx, cy + 1]);
                    }
                    abajo = sigue;
                }
                cx++;
            }
        }
        return true;
    }

    // LA REJILLA: cuadrada o de hexágonos, con su tamaño de casilla.
    function pintarRejilla(ctx, r) {
        const t = Math.max(10, parseInt(r.tam, 10) || 50);
        ctx.save();
        ctx.globalAlpha = Math.min(1, Math.max(0.05, (parseInt(r.opacidad, 10) || 40) / 100));
        ctx.strokeStyle = /^#[0-9a-f]{6}$/i.test(r.color || "") ? r.color : "#000000";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (r.tipo === "hex") {
            // Hexágonos con la punta arriba, de «t» de ancho.
            const radio = t / Math.sqrt(3);
            const alto = radio * 1.5;
            for (let fila = -1; fila * alto < ctx.canvas.height + alto; fila++) {
                for (let col = -1; col * t < ctx.canvas.width + t; col++) {
                    const cx = col * t + (fila % 2 ? t / 2 : 0);
                    const cy = fila * alto;
                    for (let k = 0; k <= 6; k++) {
                        const a = Math.PI / 180 * (60 * k - 90);
                        const x = cx + radio * Math.cos(a);
                        const y = cy + radio * Math.sin(a);
                        if (k) {
                            ctx.lineTo(x, y);
                        } else {
                            ctx.moveTo(x, y);
                        }
                    }
                }
            }
        } else {
            for (let x = 0; x <= ctx.canvas.width; x += t) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, ctx.canvas.height);
            }
            for (let y = 0; y <= ctx.canvas.height; y += t) {
                ctx.moveTo(0, y);
                ctx.lineTo(ctx.canvas.width, y);
            }
        }
        ctx.stroke();
        ctx.restore();
    }

    function montarDibujo(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        // El tamaño del lienzo (se puede cambiar: «tamaño del lienzo»).
        let ANCHO = Math.min(3000, Math.max(200, parseInt(d.ancho, 10) || DIBUJO_ANCHO));
        let ALTO = Math.min(3000, Math.max(200, parseInt(d.alto, 10) || DIBUJO_ALTO));
        let cuenta = 1;
        const nuevoId = () => "c" + Date.now().toString(36) + (cuenta++);
        // Lo de antes (una sola imagen): pasa a ser la primera capa.
        if (!Array.isArray(d.capas)) {
            d.capas = [{ id: nuevoId(), tipo: "capa", nombre: "capa 1", visible: true, opacidad: 100, imagen: d.imagen || "" }];
            delete d.imagen;
        }
        d.rejilla = Object.assign({ ver: false, tipo: "cuadrada", tam: 50, color: "#000000", opacidad: 40, bajar: false },
            d.rejilla || {});
        // Todo lo del árbol, recorrido: [nodo, lista en la que está, padre].
        const recorrer = (f, lista = d.capas, padre = null) => {
            for (const n of lista) {
                if (f(n, lista, padre) === false) {
                    return false;
                }
                if (n.tipo === "carpeta" && recorrer(f, n.hijos, n) === false) {
                    return false;
                }
            }
            return true;
        };
        const buscar = (id) => {
            let sale = null;
            recorrer((n, lista, padre) => {
                if (n.id === id) {
                    sale = { n, lista, padre };
                    return false;
                }
                return true;
            });
            return sale;
        };
        const lienzos = {};
        recorrer((n) => {
            if (n.tipo === "carpeta") {
                n.hijos = n.hijos || [];
            } else {
                lienzos[n.id] = lienzoNuevo(ANCHO, ALTO);
            }
        });
        let activa = buscar(d.activa) ? d.activa : null;
        if (!activa) {
            recorrer((n) => {
                if (n.tipo === "capa") {
                    activa = n.id;
                    return false;
                }
                return true;
            });
        }

        // LOS DOS LIENZOS: la vista y lo de encima.
        const marco = crear("div", "master-dibujo-marco");
        const vista = lienzoNuevo(ANCHO, ALTO);
        vista.className = "master-dibujo";
        const encima = lienzoNuevo(ANCHO, ALTO);
        encima.className = "master-dibujo-encima";
        encima.tabIndex = 0;
        encima.setAttribute("role", "img");
        marco.append(vista, encima);
        const cv = vista.getContext("2d");
        const ce = encima.getContext("2d");
        const etiqueta = () => {
            encima.setAttribute("aria-label", "Dibujo" + (d.desc ? ": " + d.desc : " (sin descripción)") +
                ". Se dibuja con el ratón, el dedo o un lápiz; Ctrl+V pega una imagen.");
        };
        etiqueta();

        let herramienta = DIBUJO_HERRAMIENTAS.some((h) => h[0] === d.herramienta) ? d.herramienta : "lapiz";
        let color = /^#[0-9a-f]{6}$/i.test(d.color || "") ? d.color : DIBUJO_COLORES[0][0];
        let grosor = parseInt(d.grosor, 10) || 8;
        let sel = null; // {x, y, w, h}
        let flotante = null; // {lienzo, x, y, w, h}: lo seleccionado, levantado
        let figura = null; // la línea o la figura que aún no se ha soltado

        // Lo que se ve: el papel y las capas visibles (de abajo arriba).
        const componer = (ctx, conFlotante) => {
            ctx.globalAlpha = 1;
            ctx.fillStyle = DIBUJO_PAPEL;
            ctx.fillRect(0, 0, ANCHO, ALTO);
            const pintar = (lista, alfa) => {
                for (let i = lista.length - 1; i >= 0; i--) {
                    const n = lista[i];
                    if (!n.visible) {
                        continue;
                    }
                    const a = alfa * (n.opacidad === undefined ? 1 : n.opacidad / 100);
                    if (n.tipo === "carpeta") {
                        pintar(n.hijos, a);
                        continue;
                    }
                    ctx.globalAlpha = a;
                    ctx.drawImage(lienzos[n.id], 0, 0);
                    if (conFlotante && flotante && n.id === activa) {
                        ctx.drawImage(flotante.lienzo, flotante.x, flotante.y, flotante.w, flotante.h);
                    }
                }
            };
            pintar(d.capas, 1);
            ctx.globalAlpha = 1;
        };
        // Lo de encima: la rejilla, la figura a medias y la selección.
        const pintarEncima = () => {
            ce.clearRect(0, 0, ANCHO, ALTO);
            if (d.rejilla.ver) {
                pintarRejilla(ce, d.rejilla);
            }
            if (figura) {
                trazarFigura(ce, figura);
            }
            if (sel) {
                ce.save();
                ce.lineWidth = 2;
                ce.setLineDash([8, 6]);
                ce.strokeStyle = "#000000";
                ce.strokeRect(sel.x, sel.y, sel.w, sel.h);
                ce.lineDashOffset = 7;
                ce.strokeStyle = "#ffffff";
                ce.strokeRect(sel.x, sel.y, sel.w, sel.h);
                // Las asas para cambiar el tamaño.
                if (herramienta === "seleccionar") {
                    const t = tolerancia() * 0.9;
                    ce.setLineDash([]);
                    ce.lineWidth = 2;
                    asas().forEach(([, x, y]) => {
                        ce.fillStyle = "#ffffff";
                        ce.fillRect(x - t / 2, y - t / 2, t, t);
                        ce.strokeStyle = "#000000";
                        ce.strokeRect(x - t / 2, y - t / 2, t, t);
                    });
                }
                ce.restore();
            }
        };
        let pendiente = 0;
        const repintar = () => {
            if (pendiente) {
                return;
            }
            pendiente = requestAnimationFrame(() => {
                pendiente = 0;
                componer(cv, true);
                pintarEncima();
            });
        };

        // GUARDAR (las capas tocadas, como WebP con su transparencia).
        const tocadas = new Set();
        let espera = 0;
        const fotoDe = (c) => {
            const webp = c.toDataURL("image/webp", 0.9);
            return webp.indexOf("data:image/webp") === 0 ? webp : c.toDataURL("image/png");
        };
        const guardarDibujo = (id) => {
            if (id) {
                tocadas.add(id);
            }
            clearTimeout(espera);
            espera = setTimeout(() => {
                tocadas.forEach((x) => {
                    const b = buscar(x);
                    if (b && lienzos[x]) {
                        b.n.imagen = fotoDe(lienzos[x]);
                    }
                });
                tocadas.clear();
                pintarMinis();
                d.activa = activa;
                if (!guardar()) {
                    avisar("No se ha podido guardar el dibujo: no cabe. Quita alguna imagen o capa, o descárgalo.");
                }
            }, 400);
        };

        // DESHACER: por capa, cómo estaban sus píxeles antes de cada cambio.
        const atras = [];
        const adelante = [];
        const recordar = (id) => {
            if (!lienzos[id]) {
                return;
            }
            atras.push({ id, px: lienzos[id].getContext("2d").getImageData(0, 0, ANCHO, ALTO) });
            if (atras.length > 20) {
                atras.shift();
            }
            adelante.length = 0;
            pintarMandos();
        };
        const volverA = (de, a) => {
            soltarFlotante(false);
            while (de.length) {
                const x = de.pop();
                if (!lienzos[x.id]) {
                    continue;
                }
                const c = lienzos[x.id].getContext("2d");
                a.push({ id: x.id, px: c.getImageData(0, 0, ANCHO, ALTO) });
                c.putImageData(x.px, 0, 0);
                guardarDibujo(x.id);
                break;
            }
            sel = null;
            repintar();
            pintarMandos();
        };

        const capaActiva = () => {
            const b = buscar(activa);
            return b && b.n.tipo === "capa" ? b.n : null;
        };
        // ¿Se puede pintar en la activa? (No, si está escondida ella o su
        // carpeta: se avisa.)
        const sePuede = () => {
            const c = capaActiva();
            if (!c) {
                avisar("Elige una capa (no una carpeta) para pintar.");
                return null;
            }
            let ve = true;
            let b = buscar(c.id);
            while (b) {
                ve = ve && b.n.visible;
                b = b.padre ? buscar(b.padre.id) : null;
            }
            if (!ve) {
                avisar("La capa «" + c.nombre + "» está escondida: enséñala para pintar en ella.");
                return null;
            }
            return c;
        };

        const punto = (e) => {
            const r = encima.getBoundingClientRect();
            return [Math.round((e.clientX - r.left) * ANCHO / r.width), Math.round((e.clientY - r.top) * ALTO / r.height)];
        };
        // Las ocho asas de la selección: [cuál, x, y]. «tolerancia»: cuánto
        // mide un asa en píxeles del lienzo (unos 14 de pantalla).
        const tolerancia = () => 14 * ANCHO / Math.max(1, encima.getBoundingClientRect().width);
        const asas = () => {
            if (!sel) {
                return [];
            }
            const { x, y, w, h } = sel;
            return [["nw", x, y], ["n", x + w / 2, y], ["ne", x + w, y], ["e", x + w, y + h / 2], ["se", x + w, y + h],
                ["s", x + w / 2, y + h], ["sw", x, y + h], ["w", x, y + h / 2]];
        };
        const asaEn = (p) => {
            const t = tolerancia();
            const a = asas().find(([, x, y]) => Math.abs(p[0] - x) <= t && Math.abs(p[1] - y) <= t);
            return a ? a[0] : null;
        };
        const dentroDe = (p, s) => s && p[0] >= s.x && p[0] <= s.x + s.w && p[1] >= s.y && p[1] <= s.y + s.h;
        // Una figura (línea, rectángulo o elipse) de «a» a «b».
        function trazarFigura(ctx, f) {
            ctx.save();
            ctx.strokeStyle = f.color;
            ctx.lineWidth = f.grosor;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            const [x0, y0] = f.a;
            const [x1, y1] = f.b;
            if (f.que === "linea") {
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
            } else if (f.que === "rectangulo") {
                ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
            } else {
                ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
            }
            ctx.stroke();
            ctx.restore();
        }

        // LA SELECCIÓN: levantar lo seleccionado (para moverlo) y dejarlo.
        const levantar = () => {
            const c = sePuede();
            if (!c || !sel || flotante) {
                return !!flotante;
            }
            recordar(c.id);
            const l = lienzoNuevo(ANCHO, ALTO);
            l.width = Math.max(1, sel.w);
            l.height = Math.max(1, sel.h);
            const capa = lienzos[c.id].getContext("2d");
            l.getContext("2d").drawImage(lienzos[c.id], sel.x, sel.y, sel.w, sel.h, 0, 0, sel.w, sel.h);
            capa.clearRect(sel.x, sel.y, sel.w, sel.h);
            flotante = { lienzo: l, x: sel.x, y: sel.y, w: sel.w, h: sel.h, capa: c.id };
            return true;
        };
        function soltarFlotante(dejar) {
            if (!flotante) {
                return;
            }
            if (dejar !== false && lienzos[flotante.capa]) {
                lienzos[flotante.capa].getContext("2d").drawImage(flotante.lienzo, flotante.x, flotante.y, flotante.w, flotante.h);
                guardarDibujo(flotante.capa);
            }
            flotante = null;
        }
        const quitarSeleccion = () => {
            soltarFlotante();
            sel = null;
            repintar();
        };

        // EL TEXTO: al pinchar sale un cuadro para escribir encima del
        // lienzo, donde se ha pinchado; Intro (o pinchar fuera) lo deja
        // en la capa, Mayús+Intro hace otra línea y Esc lo deja estar.
        let escribiendo = null;
        const letraDe = () => (d.texto.negrita ? "bold " : "") + d.texto.tam + "px " +
            (d.texto.fuente.indexOf(",") >= 0 ? d.texto.fuente : "\"" + d.texto.fuente + "\"");
        function empezarTexto(c, p) {
            acabarTexto(true);
            const caja = crear("textarea", "master-dibujo-texto");
            caja.rows = 1;
            caja.setAttribute("aria-label", "Texto para el dibujo (Intro lo pone; Esc lo quita)");
            const k = encima.getBoundingClientRect().width / ANCHO;
            caja.style.left = (p[0] / ANCHO * 100) + "%";
            caja.style.top = (p[1] / ALTO * 100) + "%";
            caja.style.font = (d.texto.negrita ? "bold " : "") + (d.texto.tam * k) + "px " +
                (d.texto.fuente.indexOf(",") >= 0 ? d.texto.fuente : "\"" + d.texto.fuente + "\"");
            caja.style.color = color;
            marco.appendChild(caja);
            escribiendo = { caja, capa: c.id, x: p[0], y: p[1], color };
            caja.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    acabarTexto(true);
                    encima.focus();
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    acabarTexto(false);
                    encima.focus();
                }
            });
            caja.addEventListener("input", () => {
                caja.rows = Math.max(1, caja.value.split("\n").length);
            });
            caja.addEventListener("blur", () => setTimeout(() => acabarTexto(true), 0));
            setTimeout(() => caja.focus(), 0);
        }
        function acabarTexto(dejar) {
            if (!escribiendo) {
                return;
            }
            const e = escribiendo;
            escribiendo = null;
            const texto = e.caja.value;
            e.caja.remove();
            if (!dejar || !texto.trim() || !lienzos[e.capa]) {
                return;
            }
            recordar(e.capa);
            const letra = letraDe();
            const tam = d.texto.tam;
            // La letra tiene que estar cargada para pintarla en el canvas.
            const cargada = document.fonts && document.fonts.load ? document.fonts.load(letra, texto) : Promise.resolve();
            cargada.catch(() => {}).then(() => {
                if (!lienzos[e.capa]) {
                    return;
                }
                const ctx = lienzos[e.capa].getContext("2d");
                ctx.save();
                ctx.font = letra;
                ctx.fillStyle = e.color;
                ctx.textBaseline = "top";
                texto.split("\n").forEach((linea, i) => ctx.fillText(linea, e.x, e.y + i * tam * 1.25));
                ctx.restore();
                guardarDibujo(e.capa);
                repintar();
                avisar("Texto puesto: " + texto.replace(/\n/g, " ") + ".");
            });
        }

        // EL RATÓN (o el dedo, o el lápiz) sobre el lienzo.
        let gesto = null;
        encima.addEventListener("pointerdown", (e) => {
            if (e.button !== 0 && e.pointerType === "mouse") {
                return;
            }
            e.preventDefault();
            encima.focus();
            const p = punto(e);
            if (herramienta === "cuentagotas") {
                componer(cv, true);
                const px = cv.getImageData(Math.min(ANCHO - 1, Math.max(0, p[0])), Math.min(ALTO - 1, Math.max(0, p[1])),
                    1, 1).data;
                ponerColor("#" + [px[0], px[1], px[2]].map((x) => x.toString(16).padStart(2, "0")).join(""));
                avisar("Color cogido: " + color + ".");
                elegirHerramienta("lapiz");
                return;
            }
            if (herramienta === "seleccionar") {
                encima.setPointerCapture(e.pointerId);
                const asa = asaEn(p);
                if (asa && levantar()) {
                    gesto = { que: "tamano", asa, desde: p, antes: Object.assign({}, sel) };
                } else if (dentroDe(p, sel) && levantar()) {
                    gesto = { que: "mover", desde: p, x: flotante.x, y: flotante.y, sx: sel.x, sy: sel.y };
                } else {
                    soltarFlotante();
                    sel = null;
                    gesto = { que: "elegir", desde: p };
                }
                repintar();
                return;
            }
            soltarFlotante();
            sel = null;
            const c = sePuede();
            if (!c) {
                return;
            }
            if (herramienta === "texto") {
                empezarTexto(c, p);
                return;
            }
            if (herramienta === "bote") {
                const x = Math.min(ANCHO - 1, Math.max(0, p[0]));
                const y = Math.min(ALTO - 1, Math.max(0, p[1]));
                const ctx = lienzos[c.id].getContext("2d");
                const datos = ctx.getImageData(0, 0, ANCHO, ALTO);
                const antes = ctx.getImageData(0, 0, ANCHO, ALTO);
                if (rellenar(datos, x, y, color, margenBote)) {
                    atras.push({ id: c.id, px: antes });
                    adelante.length = 0;
                    ctx.putImageData(datos, 0, 0);
                    guardarDibujo(c.id);
                    pintarMandos();
                    repintar();
                }
                return;
            }
            encima.setPointerCapture(e.pointerId);
            recordar(c.id);
            if (herramienta === "lapiz" || herramienta === "goma") {
                const ctx = lienzos[c.id].getContext("2d");
                ctx.globalCompositeOperation = herramienta === "goma" ? "destination-out" : "source-over";
                ctx.strokeStyle = color;
                ctx.lineWidth = herramienta === "goma" ? grosor * 3 : grosor;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.beginPath();
                ctx.moveTo(p[0], p[1]);
                ctx.lineTo(p[0] + 0.1, p[1] + 0.1);
                ctx.stroke();
                gesto = { que: "trazo", ultimo: p, ctx, capa: c.id };
            } else {
                figura = { que: herramienta, a: p, b: p, color, grosor };
                gesto = { que: "figura", capa: c.id };
            }
            repintar();
        });
        const CURSOR_ASA = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize",
            e: "ew-resize", w: "ew-resize" };
        encima.addEventListener("pointermove", (e) => {
            if (!gesto) {
                if (herramienta === "seleccionar") {
                    const p = punto(e);
                    const asa = asaEn(p);
                    encima.style.cursor = asa ? CURSOR_ASA[asa] : dentroDe(p, sel) ? "move" : "";
                }
                return;
            }
            const eventos = gesto.que === "trazo" && e.getCoalescedEvents ? e.getCoalescedEvents() : [];
            const p = punto(e);
            if (gesto.que === "trazo") {
                const ctx = gesto.ctx;
                ctx.beginPath();
                ctx.moveTo(gesto.ultimo[0], gesto.ultimo[1]);
                (eventos.length ? eventos : [e]).forEach((x) => {
                    gesto.ultimo = punto(x);
                    ctx.lineTo(gesto.ultimo[0], gesto.ultimo[1]);
                });
                ctx.stroke();
            } else if (gesto.que === "figura") {
                figura.b = p;
            } else if (gesto.que === "elegir") {
                const [x0, y0] = gesto.desde;
                const x = Math.max(0, Math.min(x0, p[0]));
                const y = Math.max(0, Math.min(y0, p[1]));
                sel = { x, y, w: Math.min(ANCHO, Math.max(x0, p[0])) - x, h: Math.min(ALTO, Math.max(y0, p[1])) - y };
            } else if (gesto.que === "tamano") {
                // Cambiar el tamaño desde un asa (con Mayús, sin deformar).
                const a = gesto.antes;
                const dx = p[0] - gesto.desde[0];
                const dy = p[1] - gesto.desde[1];
                let { x, y, w, h } = a;
                if (gesto.asa.indexOf("w") >= 0) {
                    x = Math.min(a.x + a.w - 4, a.x + dx);
                    w = a.x + a.w - x;
                }
                if (gesto.asa.indexOf("e") >= 0) {
                    w = Math.max(4, a.w + dx);
                }
                if (gesto.asa.indexOf("n") >= 0) {
                    y = Math.min(a.y + a.h - 4, a.y + dy);
                    h = a.y + a.h - y;
                }
                if (gesto.asa.indexOf("s") >= 0) {
                    h = Math.max(4, a.h + dy);
                }
                if (e.shiftKey && gesto.asa.length === 2) {
                    const k = Math.max(w / a.w, h / a.h);
                    const nw = a.w * k;
                    const nh = a.h * k;
                    x = gesto.asa.indexOf("w") >= 0 ? a.x + a.w - nw : a.x;
                    y = gesto.asa.indexOf("n") >= 0 ? a.y + a.h - nh : a.y;
                    w = nw;
                    h = nh;
                }
                sel = { x, y, w, h };
                Object.assign(flotante, { x, y, w, h });
            } else if (gesto.que === "mover") {
                const dx = p[0] - gesto.desde[0];
                const dy = p[1] - gesto.desde[1];
                flotante.x = gesto.x + dx;
                flotante.y = gesto.y + dy;
                sel.x = gesto.sx + dx;
                sel.y = gesto.sy + dy;
            }
            repintar();
        });
        const acabar = () => {
            if (!gesto) {
                return;
            }
            if (gesto.que === "trazo") {
                gesto.ctx.globalCompositeOperation = "source-over";
                guardarDibujo(gesto.capa);
            } else if (gesto.que === "figura") {
                trazarFigura(lienzos[gesto.capa].getContext("2d"), figura);
                figura = null;
                guardarDibujo(gesto.capa);
            } else if (gesto.que === "elegir" && sel && (sel.w < 3 || sel.h < 3)) {
                sel = null;
            } else if (gesto.que === "elegir" && sel) {
                avisar("Seleccionado. Arrástralo o muévelo con las flechas; las asas o + y − cambian el tamaño; Supr lo borra, Esc lo suelta.");
            }
            gesto = null;
            repintar();
        };
        encima.addEventListener("pointerup", acabar);
        encima.addEventListener("pointercancel", acabar);

        // EL TECLADO, con el foco en el lienzo: las herramientas con su
        // letra (como el Photoshop), Ctrl+Z / Ctrl+Y, y la selección con
        // las flechas, Supr y Esc.
        encima.addEventListener("keydown", (e) => {
            const k = e.key.toLowerCase();
            if ((e.ctrlKey || e.metaKey) && (k === "z" || k === "y")) {
                e.preventDefault();
                if (k === "z" && !e.shiftKey) {
                    volverA(atras, adelante);
                } else {
                    volverA(adelante, atras);
                }
                return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) {
                return;
            }
            if (sel && /^Arrow/.test(e.key)) {
                e.preventDefault();
                if (!levantar()) {
                    return;
                }
                const paso = e.shiftKey ? 10 : 1;
                const dx = { ArrowLeft: -paso, ArrowRight: paso }[e.key] || 0;
                const dy = { ArrowUp: -paso, ArrowDown: paso }[e.key] || 0;
                flotante.x += dx;
                flotante.y += dy;
                sel.x += dx;
                sel.y += dy;
                repintar();
                return;
            }
            if (sel && (e.key === "+" || e.key === "-")) {
                // Más grande o más pequeño (un 10 %), desde el centro.
                e.preventDefault();
                if (!levantar()) {
                    return;
                }
                const k = e.key === "+" ? 1.1 : 1 / 1.1;
                const w = Math.max(4, sel.w * k);
                const h = Math.max(4, sel.h * k);
                sel = { x: sel.x + (sel.w - w) / 2, y: sel.y + (sel.h - h) / 2, w, h };
                Object.assign(flotante, sel);
                repintar();
                avisar("Tamaño: " + Math.round(w) + " × " + Math.round(h) + ".");
                return;
            }
            if (sel && (e.key === "Delete" || e.key === "Backspace")) {
                e.preventDefault();
                if (flotante) {
                    flotante = null;
                } else {
                    const c = sePuede();
                    if (c) {
                        recordar(c.id);
                        lienzos[c.id].getContext("2d").clearRect(sel.x, sel.y, sel.w, sel.h);
                        guardarDibujo(c.id);
                    }
                }
                sel = null;
                repintar();
                avisar("Borrado lo seleccionado.");
                return;
            }
            if (sel && e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                quitarSeleccion();
                avisar("Selección soltada.");
                return;
            }
            const h = DIBUJO_HERRAMIENTAS.find((x) => x[3] === k);
            if (h) {
                e.preventDefault();
                elegirHerramienta(h[0]);
                avisar(h[2] + ".");
            }
        });

        // PEGAR O ARRASTRAR IMÁGENES: en una capa nueva, encogidas para que
        // quepan (como mucho el 80 % del lienzo), y seleccionadas para
        // moverlas.
        const pegar = (archivo, x, y) => {
            if (!archivo || !/^image\//.test(archivo.type)) {
                avisar("Eso no es una imagen.");
                return;
            }
            const lector = new FileReader();
            lector.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const escala = Math.min(1, ANCHO * 0.8 / img.width, ALTO * 0.8 / img.height);
                    const w = Math.round(img.width * escala);
                    const h = Math.round(img.height * escala);
                    const cx = x === undefined ? ANCHO / 2 : x;
                    const cy = y === undefined ? ALTO / 2 : y;
                    const px = Math.round(Math.max(0, Math.min(ANCHO - w, cx - w / 2)));
                    const py = Math.round(Math.max(0, Math.min(ALTO - h, cy - h / 2)));
                    soltarFlotante();
                    const c = nuevaCapa("imagen");
                    lienzos[c.id].getContext("2d").drawImage(img, px, py, w, h);
                    guardarDibujo(c.id);
                    elegirHerramienta("seleccionar");
                    sel = { x: px, y: py, w, h };
                    repintar();
                    avisar("Imagen pegada en una capa nueva, seleccionada para moverla.");
                };
                img.onerror = () => avisar("No he podido abrir esa imagen.");
                img.src = imagenSegura(lector.result);
            };
            lector.readAsDataURL(archivo);
        };
        const alPegar = (e) => {
            if (!dentro.isConnected) {
                document.removeEventListener("paste", alPegar);
                return;
            }
            if (!dentro.contains(document.activeElement) || document.activeElement.matches("input, textarea")) {
                return;
            }
            const archivo = Array.from((e.clipboardData && e.clipboardData.files) || [])[0];
            if (archivo) {
                e.preventDefault();
                pegar(archivo);
            }
        };
        document.addEventListener("paste", alPegar);
        encima.addEventListener("dragover", (e) => {
            e.preventDefault();
            marco.classList.add("es-encima");
        });
        encima.addEventListener("dragleave", () => marco.classList.remove("es-encima"));
        encima.addEventListener("drop", (e) => {
            e.preventDefault();
            marco.classList.remove("es-encima");
            const [x, y] = punto(e);
            pegar(Array.from(e.dataTransfer.files || [])[0], x, y);
        });

        // ---- LA BARRA DE LA IZQUIERDA ----
        const barra = crear("div", "master-postit-barra es-dibujo");
        barra.setAttribute("role", "toolbar");
        barra.setAttribute("aria-label", "Herramientas del dibujo");
        const grupo = (...cosas) => {
            const g = crear("span", "master-postit-grupo");
            g.append(...cosas);
            barra.appendChild(g);
            return g;
        };
        const botonesH = DIBUJO_HERRAMIENTAS.map(([id, emoji, nombre, tecla]) => {
            const b = botonDe("master-postit-boton", emoji, () => elegirHerramienta(id), nombre);
            b.title = nombre + " (" + tecla.toUpperCase() + ")";
            b.setAttribute("aria-keyshortcuts", tecla.toUpperCase());
            b.dataset.herramienta = id;
            return b;
        });
        function elegirHerramienta(h) {
            if (h !== "seleccionar") {
                quitarSeleccion();
            }
            herramienta = h;
            d.herramienta = h;
            botonesH.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.herramienta === h)));
            encima.dataset.herramienta = h;
            pintarOpciones();
            acabarTexto(true);
            guardar();
        }
        grupo(...botonesH);
        // Los colores: los de siempre y el selector del navegador.
        const muestras = DIBUJO_COLORES.map(([hex, nombre]) => {
            const b = botonDe("master-postit-boton master-dibujo-color", "", () => {
                ponerColor(hex);
                if (herramienta === "goma" || herramienta === "seleccionar" || herramienta === "cuentagotas") {
                    elegirHerramienta("lapiz");
                }
            }, "Color " + nombre);
            b.title = nombre;
            b.dataset.hex = hex;
            b.style.setProperty("--muestra", hex);
            return b;
        });
        const elegirColor = crear("input", "master-dibujo-selector");
        elegirColor.type = "color";
        elegirColor.title = "Cualquier color";
        elegirColor.setAttribute("aria-label", "Elegir cualquier color");
        elegirColor.addEventListener("input", () => ponerColor(elegirColor.value));
        function ponerColor(hex) {
            color = hex.toLowerCase();
            d.color = color;
            elegirColor.value = color;
            muestras.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.hex === color)));
            guardar();
        }
        grupo(...muestras);
        const conSelector = grupo(elegirColor);
        conSelector.classList.add("es-selector");
        // ---- LAS OPCIONES (arriba del lienzo, como el Paint): las de la
        // herramienta (grosor; letra y tamaño del texto; margen del bote) y
        // deshacer, imagen, descargar y rejilla. ----
        const opciones = crear("div", "master-dibujo-opciones");
        opciones.setAttribute("role", "toolbar");
        opciones.setAttribute("aria-label", "Opciones del dibujo");
        const deslizador = (texto, min, max, valor, alCambiar, unidad) => {
            const et = crear("label", "master-dibujo-deslizador");
            const r = crear("input");
            r.type = "range";
            r.min = min;
            r.max = max;
            r.value = valor;
            const v = crear("span", "master-dibujo-valor", valor + (unidad || ""));
            v.setAttribute("aria-hidden", "true");
            r.setAttribute("aria-valuetext", valor + (unidad || ""));
            r.addEventListener("input", () => {
                v.textContent = r.value + (unidad || "");
                r.setAttribute("aria-valuetext", r.value + (unidad || ""));
                alCambiar(parseInt(r.value, 10));
            });
            et.append(crear("span", "oc-dados-etiqueta", texto), r, v);
            return et;
        };
        const opGrosor = deslizador("grosor", 1, 80, grosor, (x) => {
            grosor = x;
            d.grosor = x;
            guardar();
        }, " px");
        let margenBote = parseInt(d.margen, 10) || 40;
        const opMargen = deslizador("margen del bote", 0, 160, margenBote, (x) => {
            margenBote = x;
            d.margen = x;
            guardar();
        });
        opMargen.title = "Cuánto se puede parecer un color al de donde pinchas para que también se rellene";
        // El texto: letra, tamaño y negrita.
        d.texto = Object.assign({ fuente: "Pangolin", tam: 40, negrita: false }, d.texto || {});
        const opTexto = crear("span", "master-dibujo-optexto");
        const fuente = crear("select", "master-postit-elegir");
        fuente.setAttribute("aria-label", "Letra del texto");
        DIBUJO_FUENTES.forEach(([f, n]) => {
            const o = crear("option", "", n);
            o.value = f;
            fuente.appendChild(o);
        });
        fuente.value = d.texto.fuente;
        const tamTexto = crear("input", "master-dibujo-numero");
        tamTexto.type = "number";
        tamTexto.min = 8;
        tamTexto.max = 300;
        tamTexto.value = d.texto.tam;
        tamTexto.setAttribute("aria-label", "Tamaño del texto");
        tamTexto.title = "Tamaño del texto";
        const negrita = botonDe("master-postit-boton es-negrita", "B", () => {
            d.texto.negrita = !d.texto.negrita;
            negrita.setAttribute("aria-pressed", String(d.texto.negrita));
            guardar();
        }, "Texto en negrita");
        negrita.setAttribute("aria-pressed", String(!!d.texto.negrita));
        fuente.addEventListener("change", () => {
            d.texto.fuente = fuente.value;
            guardar();
        });
        tamTexto.addEventListener("change", () => {
            d.texto.tam = Math.min(300, Math.max(8, parseInt(tamTexto.value, 10) || 40));
            guardar();
        });
        opTexto.append(fuente, tamTexto, negrita);
        const pintarOpciones = () => {
            opGrosor.hidden = ["lapiz", "goma", "linea", "rectangulo", "elipse"].indexOf(herramienta) < 0;
            opMargen.hidden = herramienta !== "bote";
            opTexto.hidden = herramienta !== "texto";
        };
        const deshacer = botonDe("master-postit-boton", "↶", () => volverA(atras, adelante), "Deshacer");
        const rehacer = botonDe("master-postit-boton", "↷", () => volverA(adelante, atras), "Rehacer");
        deshacer.title = "Deshacer (Ctrl+Z)";
        rehacer.title = "Rehacer (Ctrl+Y)";
        const archivo = crear("input");
        archivo.type = "file";
        archivo.accept = "image/*";
        archivo.hidden = true;
        archivo.addEventListener("change", () => {
            pegar(archivo.files && archivo.files[0]);
            archivo.value = "";
        });
        const imagen = botonDe("master-postit-boton", "🖼️", () => archivo.click(), "Poner una imagen");
        imagen.title = "Poner una imagen en una capa nueva (o pégala con Ctrl+V)";
        const bajar = botonDe("master-postit-boton", "⬇", () => {
            soltarFlotante();
            const l = lienzoNuevo(ANCHO, ALTO);
            const c = l.getContext("2d");
            componer(c, false);
            if (d.rejilla.ver && d.rejilla.bajar) {
                pintarRejilla(c, d.rejilla);
            }
            const a = crear("a");
            a.href = l.toDataURL("image/png");
            a.download = (m.titulo || "dibujo").replace(/[^\p{L}\p{N}]+/gu, "-") + ".png";
            document.body.appendChild(a);
            a.click();
            a.remove();
            avisar("Descargado: " + a.download + ".");
        }, "Descargar el dibujo");
        bajar.title = "Descargar como PNG (todas las capas que se ven)";
        const botonRejilla = crear("button", "master-postit-boton", "#");
        botonRejilla.type = "button";
        botonRejilla.setAttribute("aria-label", "Rejilla de rol");
        botonRejilla.title = "Enseñar o esconder la rejilla";

        const acciones = crear("span", "master-postit-grupo master-dibujo-acciones");
        acciones.append(deshacer, rehacer, imagen, bajar, botonRejilla);
        opciones.append(opGrosor, opMargen, opTexto, acciones);

        // ---- LAS CAPAS (a la derecha) ----
        const panel = crear("div", "master-dibujo-panel");
        const tituloCapas = crear("h3", "master-dibujo-titulo", "capas");
        const listaCapas = crear("ul", "master-dibujo-capas");
        // Las miniaturas de cada capa, para repintarlas al guardar.
        let minis = {};
        function pintarMinis() {
            Object.keys(minis).forEach((id) => {
                if (!lienzos[id]) {
                    return;
                }
                const mc = minis[id].getContext("2d");
                mc.fillStyle = DIBUJO_PAPEL;
                mc.fillRect(0, 0, 40, 30);
                const k = Math.min(40 / ANCHO, 30 / ALTO);
                mc.drawImage(lienzos[id], (40 - ANCHO * k) / 2, (30 - ALTO * k) / 2, ANCHO * k, ALTO * k);
            });
        }
        listaCapas.setAttribute("aria-label", "Capas y carpetas (la de arriba se ve encima)");
        function nuevaCapa(nombre) {
            const c = { id: nuevoId(), tipo: "capa", nombre: nombre || "capa " + (Object.keys(lienzos).length + 1), visible: true,
                opacidad: 100, imagen: "" };
            lienzos[c.id] = lienzoNuevo(ANCHO, ALTO);
            // Encima de la activa, en su misma carpeta.
            const b = buscar(activa);
            const lista = b ? b.lista : d.capas;
            lista.splice(b ? lista.indexOf(b.n) : 0, 0, c);
            activa = c.id;
            d.activa = activa;
            pintarCapas();
            guardar();
            return c;
        }
        const masCapa = botonDe("oc-vida-accion", "＋ capa", () => {
            const c = nuevaCapa();
            avisar("Capa nueva: " + c.nombre + ".");
        }, "Capa nueva");
        const masCarpeta = botonDe("oc-vida-accion", "📁 carpeta", () => {
            const n = { id: nuevoId(), tipo: "carpeta", nombre: "carpeta", visible: true, opacidad: 100, abierta: true, hijos: [] };
            const b = buscar(activa);
            const lista = b ? b.lista : d.capas;
            lista.splice(b ? lista.indexOf(b.n) : 0, 0, n);
            activa = n.id;
            pintarCapas();
            guardar();
            avisar("Carpeta nueva. Mete capas en ella con «⇥ a la carpeta».");
        }, "Carpeta nueva");
        const nuevas = crear("div", "master-dibujo-nuevas");
        nuevas.append(masCapa, masCarpeta);
        const fila = (n, nivel) => {
            const li = crear("li", "master-dibujo-capa" + (n.id === activa ? " es-activa" : "") + (n.tipo === "carpeta" ? " es-carpeta" : ""));
            li.style.setProperty("--nivel", nivel);
            const ojo = botonDe("master-nombre-boton", n.visible ? "👁" : "—", () => {
                n.visible = !n.visible;
                pintarCapas();
                repintar();
                guardar();
                avisar((n.visible ? "Se ve: " : "Escondida: ") + n.nombre + ".");
            }, (n.visible ? "Esconder " : "Enseñar ") + n.nombre);
            ojo.setAttribute("aria-pressed", String(!!n.visible));
            ojo.title = n.visible ? "Esconder" : "Enseñar";
            li.appendChild(ojo);
            if (n.tipo === "carpeta") {
                const plegar = botonDe("master-nombre-boton", n.abierta ? "▾" : "▸", () => {
                    n.abierta = !n.abierta;
                    pintarCapas();
                    guardar();
                }, (n.abierta ? "Cerrar " : "Abrir ") + "la carpeta " + n.nombre);
                plegar.setAttribute("aria-expanded", String(!!n.abierta));
                li.appendChild(plegar);
            }
            const nombre = botonDe("master-dibujo-capa-nombre", (n.tipo === "carpeta" ? "📁 " : "") + n.nombre, () => {
                soltarFlotante();
                sel = null;
                activa = n.id;
                d.activa = activa;
                pintarCapas();
                repintar();
                guardar();
            }, (n.tipo === "carpeta" ? "Carpeta " : "Capa ") + n.nombre + (n.visible ? "" : " (escondida)"));
            if (n.id === activa) {
                nombre.setAttribute("aria-current", "true");
            }
            if (n.tipo === "capa" && lienzos[n.id]) {
                const mini = lienzoNuevo(ANCHO, ALTO);
                mini.width = 40;
                mini.height = 30;
                mini.className = "master-dibujo-mini";
                mini.setAttribute("aria-hidden", "true");
                minis[n.id] = mini;
                nombre.prepend(mini);
            }
            li.appendChild(nombre);
            return li;
        };
        // Lo que se puede hacer con la activa: subir, bajar, meterla en la
        // carpeta de encima, sacarla, renombrar, duplicar, opacidad, borrar.
        const mandos = crear("div", "master-dibujo-mandos");
        const mando = (texto, nombre, f) => {
            const b = botonDe("master-postit-boton", texto, f, nombre);
            b.title = nombre;
            mandos.appendChild(b);
            return b;
        };
        const mover = (paso) => {
            const b = buscar(activa);
            if (!b) {
                return;
            }
            const i = b.lista.indexOf(b.n);
            const j = i + paso;
            if (j < 0 || j >= b.lista.length) {
                return;
            }
            b.lista.splice(i, 1);
            b.lista.splice(j, 0, b.n);
            pintarCapas();
            repintar();
            guardar();
            avisar((paso < 0 ? "Subida: " : "Bajada: ") + b.n.nombre + ".");
        };
        const subir = mando("↑", "Subir (que se vea más encima)", () => mover(-1));
        const bajarCapa = mando("↓", "Bajar (que se vea más debajo)", () => mover(1));
        const aCarpeta = mando("⇥", "Meterla en la carpeta de encima", () => {
            const b = buscar(activa);
            if (!b) {
                return;
            }
            const i = b.lista.indexOf(b.n);
            const carpeta = b.lista.slice(0, i).reverse().find((x) => x.tipo === "carpeta" && x !== b.n);
            if (!carpeta) {
                avisar("No hay ninguna carpeta encima de esta, al mismo nivel.");
                return;
            }
            b.lista.splice(i, 1);
            carpeta.hijos.push(b.n);
            carpeta.abierta = true;
            pintarCapas();
            repintar();
            guardar();
            avisar(b.n.nombre + " va ahora en la carpeta " + carpeta.nombre + ".");
        });
        const fuera = mando("⇤", "Sacarla de su carpeta", () => {
            const b = buscar(activa);
            if (!b || !b.padre) {
                return;
            }
            const arriba = buscar(b.padre.id);
            b.lista.splice(b.lista.indexOf(b.n), 1);
            arriba.lista.splice(arriba.lista.indexOf(b.padre), 0, b.n);
            pintarCapas();
            repintar();
            guardar();
            avisar(b.n.nombre + " ya no va en " + b.padre.nombre + ".");
        });
        const renombrar = mando("✎", "Cambiarle el nombre", () => {
            const b = buscar(activa);
            if (!b) {
                return;
            }
            const campo = crear("input", "master-elegir master-dibujo-renombrar");
            campo.value = b.n.nombre;
            campo.setAttribute("aria-label", "Nombre de " + b.n.nombre);
            const actual = listaCapas.querySelector(".es-activa .master-dibujo-capa-nombre");
            if (!actual) {
                return;
            }
            actual.replaceWith(campo);
            campo.focus();
            campo.select();
            let hecho = false;
            const acabarNombre = (vale) => {
                if (hecho) {
                    return;
                }
                hecho = true;
                if (vale && campo.value.trim()) {
                    b.n.nombre = campo.value.trim().slice(0, 40);
                    guardar();
                }
                pintarCapas();
                renombrar.focus();
            };
            campo.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    acabarNombre(true);
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    acabarNombre(false);
                }
            });
            campo.addEventListener("blur", () => acabarNombre(true));
        });
        const duplicar = mando("⧉", "Duplicar la capa", () => {
            const c = capaActiva();
            if (!c) {
                avisar("Solo se pueden duplicar capas.");
                return;
            }
            soltarFlotante();
            const original = lienzos[c.id];
            const copia = nuevaCapa(c.nombre + " (copia)");
            lienzos[copia.id].getContext("2d").drawImage(original, 0, 0);
            copia.opacidad = c.opacidad;
            guardarDibujo(copia.id);
            pintarCapas();
            repintar();
        });
        let seguro = false;
        const borrarCapa = mando("🗑️", "Borrar la capa o carpeta", () => {
            const b = buscar(activa);
            if (!b) {
                return;
            }
            let capas = 0;
            recorrer((n) => {
                capas += n.tipo === "capa" ? 1 : 0;
            });
            const dentroHay = [];
            recorrer((n) => {
                if (n.tipo === "capa") {
                    dentroHay.push(n.id);
                }
            }, b.n.tipo === "carpeta" ? b.n.hijos : [b.n]);
            if (capas - dentroHay.length < 1) {
                avisar("Tiene que quedar al menos una capa.");
                return;
            }
            if (!seguro) {
                seguro = true;
                borrarCapa.textContent = "⚠️";
                borrarCapa.setAttribute("aria-label", "¿Seguro? Pulsa otra vez para borrar " + b.n.nombre);
                avisar("Pulsa otra vez para borrar " + b.n.nombre + (b.n.tipo === "carpeta" ? " y todo lo que tiene" : "") +
                    ". No se puede deshacer.");
                setTimeout(() => {
                    seguro = false;
                    borrarCapa.textContent = "🗑️";
                    borrarCapa.setAttribute("aria-label", "Borrar la capa o carpeta");
                }, 4000);
                return;
            }
            seguro = false;
            borrarCapa.textContent = "🗑️";
            borrarCapa.setAttribute("aria-label", "Borrar la capa o carpeta");
            soltarFlotante(false);
            sel = null;
            const i = b.lista.indexOf(b.n);
            b.lista.splice(i, 1);
            dentroHay.forEach((id) => {
                delete lienzos[id];
            });
            const siguiente = b.lista[Math.min(i, b.lista.length - 1)] || b.padre;
            activa = siguiente ? siguiente.id : null;
            if (!activa) {
                recorrer((n) => {
                    if (n.tipo === "capa") {
                        activa = n.id;
                        return false;
                    }
                    return true;
                });
            }
            d.activa = activa;
            pintarCapas();
            repintar();
            guardar();
            avisar("Borrada: " + b.n.nombre + ".");
        });
        const etOpa = crear("label", "oc-dados-etiqueta master-dibujo-opacidad");
        const opacidad = crear("input");
        opacidad.type = "range";
        opacidad.min = 0;
        opacidad.max = 100;
        opacidad.step = 5;
        const valorOpa = crear("span", "", "");
        etOpa.append(document.createTextNode("opacidad "), valorOpa, opacidad);
        opacidad.addEventListener("input", () => {
            const b = buscar(activa);
            if (!b) {
                return;
            }
            b.n.opacidad = parseInt(opacidad.value, 10);
            valorOpa.textContent = b.n.opacidad + " %";
            repintar();
            guardar();
        });
        function pintarMandos() {
            deshacer.disabled = !atras.length;
            rehacer.disabled = !adelante.length;
            const b = buscar(activa);
            const i = b ? b.lista.indexOf(b.n) : -1;
            subir.disabled = !b || i <= 0;
            bajarCapa.disabled = !b || i >= b.lista.length - 1;
            aCarpeta.disabled = !b || !b.lista.slice(0, i).some((x) => x.tipo === "carpeta");
            fuera.disabled = !b || !b.padre;
            renombrar.disabled = !b;
            duplicar.disabled = !b || b.n.tipo !== "capa";
            borrarCapa.disabled = !b;
            opacidad.disabled = !b;
            opacidad.value = b ? (b.n.opacidad === undefined ? 100 : b.n.opacidad) : 100;
            valorOpa.textContent = opacidad.value + " %";
            opacidad.setAttribute("aria-valuetext", opacidad.value + " %");
        }
        function pintarCapas() {
            const filas = [];
            const pasar = (lista, nivel) => lista.forEach((n) => {
                filas.push(fila(n, nivel));
                if (n.tipo === "carpeta" && n.abierta) {
                    pasar(n.hijos, nivel + 1);
                    if (!n.hijos.length) {
                        const vacia = crear("li", "master-dibujo-capa es-vacia", "(vacía)");
                        vacia.style.setProperty("--nivel", nivel + 1);
                        filas.push(vacia);
                    }
                }
            });
            minis = {};
            pasar(d.capas, 0);
            listaCapas.replaceChildren(...filas);
            pintarMinis();
            pintarMandos();
        }
        // ---- LA REJILLA ----
        const rejilla = crear("div", "master-dibujo-rejilla");
        // Los ajustes, plegados; «#» en la barra la enseña o la esconde.
        const tituloR = crear("h3", "master-dibujo-titulo");
        const plegarR = botonDe("master-dibujo-plegar", (d.rejilla.abierta ? "▾" : "▸") + " rejilla de rol", () => {
            d.rejilla.abierta = !d.rejilla.abierta;
            plegarR.textContent = (d.rejilla.abierta ? "▾" : "▸") + " rejilla de rol";
            plegarR.setAttribute("aria-expanded", String(!!d.rejilla.abierta));
            ajustesR.hidden = !d.rejilla.abierta;
            guardar();
        });
        plegarR.setAttribute("aria-expanded", String(!!d.rejilla.abierta));
        tituloR.appendChild(plegarR);
        const ajustesR = crear("div", "master-dibujo-ajustes");
        ajustesR.hidden = !d.rejilla.abierta;
        const caja = (texto, control) => {
            const et = crear("label", "master-dibujo-campo");
            et.append(crear("span", "oc-dados-etiqueta", texto), control);
            return et;
        };
        const ver = crear("input");
        ver.type = "checkbox";
        ver.checked = !!d.rejilla.ver;
        const etVer = crear("label", "master-nombres-apellido");
        etVer.append(ver, document.createTextNode(" enseñar la rejilla"));
        const tipo = crear("select", "master-elegir");
        [["cuadrada", "cuadrada"], ["hex", "hexagonal"]].forEach(([v, n]) => {
            const o = crear("option", "", n);
            o.value = v;
            tipo.appendChild(o);
        });
        tipo.value = d.rejilla.tipo;
        const tam = crear("input", "master-elegir");
        tam.type = "number";
        tam.min = 10;
        tam.max = 250;
        tam.step = 5;
        tam.value = d.rejilla.tam;
        const colorR = crear("input", "master-dibujo-selector");
        colorR.type = "color";
        colorR.value = d.rejilla.color;
        const opaR = crear("input");
        opaR.type = "range";
        opaR.min = 10;
        opaR.max = 100;
        opaR.step = 5;
        opaR.value = d.rejilla.opacidad;
        const bajarR = crear("input");
        bajarR.type = "checkbox";
        bajarR.checked = !!d.rejilla.bajar;
        const etBajar = crear("label", "master-nombres-apellido");
        etBajar.append(bajarR, document.createTextNode(" en la imagen al descargar"));
        const cambiarRejilla = () => {
            Object.assign(d.rejilla, { ver: ver.checked, tipo: tipo.value, tam: Math.min(250, Math.max(10, parseInt(tam.value, 10) || 50)),
                color: colorR.value, opacidad: parseInt(opaR.value, 10), bajar: bajarR.checked });
            opaR.setAttribute("aria-valuetext", opaR.value + " %");
            botonRejilla.setAttribute("aria-pressed", String(ver.checked));
            repintar();
            guardar();
        };
        [ver, tipo, tam, colorR, opaR, bajarR].forEach((x) => x.addEventListener(x.type === "range" || x.type === "color" ? "input" : "change",
            cambiarRejilla));
        ajustesR.append(etVer, caja("forma", tipo), caja("casilla (de 1000 de ancho)", tam), caja("color", colorR),
            caja("cuánto se ve", opaR), etBajar);
        rejilla.append(tituloR, ajustesR);
        botonRejilla.addEventListener("click", () => {
            ver.checked = !ver.checked;
            cambiarRejilla();
            avisar(ver.checked ? "Rejilla a la vista." : "Rejilla escondida.");
        });
        botonRejilla.setAttribute("aria-pressed", String(!!d.rejilla.ver));
        // ---- EL TAMAÑO DEL LIENZO (plegado): unos cuantos ya hechos o el
        // que se quiera, y si lo dibujado se estira o se queda como está
        // (y se recorta o sobra sitio). ----
        const tamanoL = crear("div", "master-dibujo-rejilla");
        const tituloT = crear("h3", "master-dibujo-titulo");
        const ajustesT = crear("div", "master-dibujo-ajustes");
        ajustesT.hidden = true;
        const plegarT = botonDe("master-dibujo-plegar", "▸ tamaño del lienzo", () => {
            ajustesT.hidden = !ajustesT.hidden;
            plegarT.textContent = (ajustesT.hidden ? "▸" : "▾") + " tamaño del lienzo";
            plegarT.setAttribute("aria-expanded", String(!ajustesT.hidden));
        });
        plegarT.setAttribute("aria-expanded", "false");
        tituloT.appendChild(plegarT);
        const hechos = crear("select", "master-elegir");
        [["", "a medida"], ["1000x750", "normal (1000 × 750)"], ["1200x1200", "cuadrado (1200 × 1200)"],
            ["1600x900", "panorámico (1600 × 900)"], ["750x1000", "de pie (750 × 1000)"], ["2000x1500", "grande (2000 × 1500)"]]
            .forEach(([v, n]) => {
                const o = crear("option", "", n);
                o.value = v;
                hechos.appendChild(o);
            });
        const numero = (valor) => {
            const x = crear("input", "master-elegir");
            x.type = "number";
            x.min = 200;
            x.max = 3000;
            x.step = 50;
            x.value = valor;
            return x;
        };
        const anchoT = numero(ANCHO);
        const altoT = numero(ALTO);
        hechos.value = hechos.querySelector("option[value='" + ANCHO + "x" + ALTO + "']") ? ANCHO + "x" + ALTO : "";
        hechos.addEventListener("change", () => {
            if (hechos.value) {
                [anchoT.value, altoT.value] = hechos.value.split("x");
            }
        });
        const estirar = crear("input");
        estirar.type = "checkbox";
        const etEstirar = crear("label", "master-nombres-apellido");
        etEstirar.append(estirar, document.createTextNode(" estirar lo dibujado"));
        const cambiarT = botonDe("oc-vida-accion", "↔ cambiar el tamaño", () => {
            const w = Math.min(3000, Math.max(200, parseInt(anchoT.value, 10) || ANCHO));
            const h = Math.min(3000, Math.max(200, parseInt(altoT.value, 10) || ALTO));
            if (w === ANCHO && h === ALTO) {
                return;
            }
            acabarTexto(true);
            soltarFlotante();
            sel = null;
            Object.keys(lienzos).forEach((id) => {
                const nuevo = lienzoNuevo(w, h);
                if (estirar.checked) {
                    nuevo.getContext("2d").drawImage(lienzos[id], 0, 0, w, h);
                } else {
                    nuevo.getContext("2d").drawImage(lienzos[id], 0, 0);
                }
                lienzos[id] = nuevo;
                tocadas.add(id);
            });
            ANCHO = w;
            ALTO = h;
            d.ancho = w;
            d.alto = h;
            [vista, encima].forEach((c) => {
                c.width = w;
                c.height = h;
            });
            atras.length = 0;
            adelante.length = 0;
            guardarDibujo();
            pintarCapas();
            repintar();
            avisar("El lienzo mide ahora " + w + " × " + h + ". (Esto no se deshace.)");
        });
        ajustesT.append(caja("ya hecho", hechos), caja("ancho", anchoT), caja("alto", altoT), etEstirar, cambiarT);
        tamanoL.append(tituloT, ajustesT);
        panel.append(tituloCapas, nuevas, listaCapas, mandos, etOpa, rejilla, tamanoL);

        // Lo que es el dibujo, para quien no lo ve.
        const etD = crear("label", "oc-dados-etiqueta", "de qué es (para el lector de pantalla)");
        const desc = crear("input", "master-elegir");
        desc.id = "master-dibujo-desc-" + m.id;
        desc.value = d.desc || "";
        etD.htmlFor = desc.id;
        desc.addEventListener("input", () => {
            d.desc = desc.value;
            etiqueta();
            guardar();
        });

        // Como el Paint: herramientas a la izquierda, el lienzo en medio y
        // las capas a la derecha (debajo, si no cabe).
        const centro = crear("div", "master-dibujo-centro");
        centro.append(opciones, marco);
        const zona = crear("div", "master-dibujo-zona");
        zona.append(barra, centro, panel);
        // Si la ventana es estrecha, las herramientas pasan arriba, en
        // fila, y las capas abajo: se ve bien a cualquier tamaño.
        if (window.ResizeObserver) {
            const mirar = new ResizeObserver(() => {
                zona.classList.toggle("es-estrecha", zona.clientWidth < 620);
            });
            mirar.observe(zona);
        }
        dentro.append(zona, archivo, etD, desc);

        // Cargar las capas guardadas (de una en una) y pintar.
        const cargas = [];
        recorrer((n) => {
            if (n.tipo === "capa" && n.imagen) {
                cargas.push(new Promise((hecho) => {
                    const img = new Image();
                    img.onload = () => {
                        lienzos[n.id].getContext("2d").drawImage(img, 0, 0, ANCHO, ALTO);
                        hecho();
                    };
                    img.onerror = hecho;
                    img.src = imagenSegura(n.imagen);
                }));
            }
        });
        Promise.all(cargas).then(() => {
            pintarCapas();
            repintar();
        });
        elegirHerramienta(herramienta);
        ponerColor(color);
        vista.width = encima.width = ANCHO;
        vista.height = encima.height = ALTO;
        pintarCapas();
        repintar();
    }

    // ---- LAS TABLAS PROPIAS (datos/personajes/compendio/master-tablas.json):
    // PNJ, dungeons y calendarios. Todo inventado aquí. ----
    const TABLAS = "/datos/personajes/compendio/master-tablas.json";

    // «posadero|posadera»: la forma de su género (n, cualquiera de las dos).
    const segunGenero = (texto, genero) => {
        const [m, f] = String(texto).split("|");
        if (f === undefined) {
            return m;
        }
        return genero === "f" ? f : genero === "m" ? m : alAzar([m, f]);
    };

    // ---- PNJ RÁPIDOS: nombre (del generador de nombres), especie,
    // oficio, aspecto, carácter, manía al hablar, qué quiere y un secreto.
    // Cada cosa se puede volver a tirar suelta (🎲); ☆ lo guarda. ----
    const PNJ_CAMPOS = [["oficio", "Oficio", "oficios"], ["aspecto", "Aspecto", "aspecto"], ["rasgo", "Carácter", "rasgos"],
        ["mania", "Al hablar", "manias"], ["quiere", "Quiere", "quiere"], ["secreto", "Secreto", "secretos"]];

    function montarPnj(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        Promise.all([pedir(TABLAS), pedir(NOMBRES)]).then(([tablas, nombres]) => {
            const d = m.datos;
            const t = tablas.pnj;
            const especie = elegirDe("master-pnj-especie-" + m.id, "especie",
                [["", "al azar"]].concat(Object.keys(nombres.especies).map((k) => [k, nombres.especies[k].nombre])), d.especie || "");
            const genero = botonesDe("género", [["cualquiera", "cualquiera"], ["f", "♀"], ["m", "♂"], ["n", "⚪ neutro"]],
                d.genero || "cualquiera", (v) => {
                    d.genero = v;
                    guardar();
                });
            const etGen = crear("p", "oc-dados-etiqueta", "género");
            etGen.setAttribute("aria-hidden", "true");
            const nuevo = () => {
                const esp = especie.elegir.value || alAzar(Object.keys(nombres.especies));
                const g = genero.valor() === "cualquiera" ? alAzar(["f", "m", "n"]) : genero.valor();
                const p = { nombre: nombreDe(nombres, esp, g, true), especie: nombres.especies[esp].nombre, genero: g };
                PNJ_CAMPOS.forEach(([k, , lista]) => {
                    p[k] = segunGenero(alAzar(t[lista]), g);
                });
                return p;
            };
            const ficha = crear("div", "master-pnj");
            ficha.setAttribute("aria-live", "polite");
            const guardados = crear("ul", "master-pnj-guardados");
            guardados.setAttribute("aria-label", "PNJ guardados");
            const tituloG = crear("h3", "master-nombres-titulo", "⭐ guardados");
            const texto = (p) => p.nombre + " (" + p.especie + ")\n" + PNJ_CAMPOS.map(([k, n]) => n + ": " + p[k]).join("\n");
            const pintarFicha = () => {
                const p = d.pnj;
                ficha.replaceChildren();
                if (!p) {
                    ficha.appendChild(crear("p", "oc-vacio", "Pulsa «generar»."));
                    return;
                }
                const cab = crear("div", "master-pnj-cabeza");
                const h = crear("h3", "master-pnj-nombre", p.nombre);
                cab.append(h, crear("span", "master-pnj-especie", p.especie + " · " + ({ f: "♀", m: "♂", n: "neutro" }[p.genero] || "")));
                const dl = crear("dl", "master-pnj-datos");
                PNJ_CAMPOS.forEach(([k, nombre, lista]) => {
                    const dd = crear("dd", "", p[k]);
                    const otra = botonDe("master-nombre-boton", "🎲", () => {
                        p[k] = segunGenero(alAzar(t[lista]), p.genero);
                        guardar();
                        pintarFicha();
                        avisar(nombre + ": " + p[k] + ".");
                    }, "Otro valor para " + nombre.toLowerCase());
                    otra.title = "Otro";
                    dd.appendChild(otra);
                    dl.append(crear("dt", "", nombre), dd);
                });
                const botones = crear("div", "master-pnj-botones");
                botones.append(
                    botonDe("oc-vida-accion", "☆ guardar", () => {
                        d.guardados = (d.guardados || []).concat([Object.assign({}, p)]);
                        guardar();
                        pintarGuardados();
                        avisar("Guardado: " + p.nombre + ".");
                    }, "Guardar a " + p.nombre),
                    botonDe("oc-vida-accion", "⧉ copiar", () => copiarTexto(texto(p), "Copiado: " + p.nombre + "."), "Copiar a " + p.nombre));
                ficha.append(cab, dl, botones);
            };
            const pintarGuardados = () => {
                const lista = d.guardados || [];
                guardados.replaceChildren(...lista.map((p, i) => {
                    const li = crear("li", "master-nombre");
                    const ver = botonDe("master-botin-objeto", p.nombre + " · " + p.oficio, () => {
                        d.pnj = Object.assign({}, p);
                        guardar();
                        pintarFicha();
                        avisar("PNJ: " + p.nombre + ", " + p.oficio + ".");
                    }, "Ver a " + p.nombre);
                    const quitar = botonDe("master-nombre-boton", "✕", () => {
                        lista.splice(i, 1);
                        guardar();
                        pintarGuardados();
                        avisar("Quitado: " + p.nombre + ".");
                    }, "Quitar a " + p.nombre + " de guardados");
                    li.append(ver, quitar);
                    return li;
                }));
                tituloG.hidden = guardados.hidden = !lista.length;
            };
            const generar = botonDe("oc-vida-accion es-principal master-nombres-generar", "🎲 generar PNJ", () => {
                d.especie = especie.elegir.value;
                d.pnj = nuevo();
                guardar();
                pintarFicha();
                avisar("PNJ: " + d.pnj.nombre + ", " + d.pnj.oficio + ".");
            });
            const arriba = crear("div", "master-nombres-form");
            arriba.append(especie, etGen, genero, generar);
            dentro.replaceChildren(arriba, ficha, tituloG, guardados);
            pintarFicha();
            pintarGuardados();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar las tablas."));
        });
    }

    // ---- LOS RELOJES (de progreso): un círculo partido en 4 a 12 trozos
    // que se van llenando (una amenaza que avanza, una cuenta atrás…).
    // Varios por ventana; − y + (o pinchar en un trozo) los mueven. ----
    const SVG = "http://www.w3.org/2000/svg";

    function dibujoReloj(partes, llenas, alPinchar) {
        const svg = document.createElementNS(SVG, "svg");
        svg.setAttribute("viewBox", "-52 -52 104 104");
        svg.setAttribute("class", "master-reloj-dibujo");
        svg.setAttribute("aria-hidden", "true");
        for (let i = 0; i < partes; i++) {
            const a0 = (i / partes) * Math.PI * 2 - Math.PI / 2;
            const a1 = ((i + 1) / partes) * Math.PI * 2 - Math.PI / 2;
            const trozo = document.createElementNS(SVG, "path");
            trozo.setAttribute("d", "M0 0 L" + (48 * Math.cos(a0)).toFixed(2) + " " + (48 * Math.sin(a0)).toFixed(2) + " A48 48 0 0 1 " +
                (48 * Math.cos(a1)).toFixed(2) + " " + (48 * Math.sin(a1)).toFixed(2) + " Z");
            trozo.setAttribute("class", "master-reloj-trozo" + (i < llenas ? " es-lleno" : ""));
            trozo.addEventListener("click", () => alPinchar(i));
            svg.appendChild(trozo);
        }
        return svg;
    }

    function montarRelojes(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        d.relojes = Array.isArray(d.relojes) ? d.relojes : [];
        const lista = crear("ul", "master-relojes");
        lista.setAttribute("aria-label", "Relojes");
        const pintar = () => {
            lista.replaceChildren(...d.relojes.map((r, i) => {
                const li = crear("li", "master-reloj" + (r.llenas >= r.partes ? " es-lleno" : ""));
                const nombre = crear("input", "master-elegir master-reloj-nombre");
                nombre.value = r.nombre;
                nombre.setAttribute("aria-label", "Nombre del reloj");
                nombre.addEventListener("change", () => {
                    r.nombre = nombre.value.trim() || "reloj";
                    guardar();
                });
                const poner = (n) => {
                    const antes = r.llenas;
                    r.llenas = Math.min(r.partes, Math.max(0, n));
                    guardar();
                    pintar();
                    const foco = lista.children[i] && lista.children[i].querySelector(n > antes ? ".es-mas" : ".es-menos");
                    if (foco) {
                        foco.focus();
                    }
                    avisar(r.nombre + ": " + r.llenas + " de " + r.partes + (r.llenas >= r.partes ? ". ¡Lleno!" : "."));
                };
                const barra = crear("div", "master-reloj-cuenta");
                barra.setAttribute("role", "meter");
                barra.setAttribute("aria-valuemin", "0");
                barra.setAttribute("aria-valuemax", String(r.partes));
                barra.setAttribute("aria-valuenow", String(r.llenas));
                barra.setAttribute("aria-label", r.nombre);
                barra.append(dibujoReloj(r.partes, r.llenas, (j) => poner(j + 1 === r.llenas ? j : j + 1)),
                    crear("span", "master-reloj-numero", r.llenas + "/" + r.partes));
                const menos = botonDe("master-pestana-mando es-menos", "−", () => poner(r.llenas - 1), "Vaciar un trozo de " + r.nombre);
                const mas = botonDe("master-pestana-mando es-mas", "+", () => poner(r.llenas + 1), "Llenar un trozo de " + r.nombre);
                menos.disabled = r.llenas <= 0;
                mas.disabled = r.llenas >= r.partes;
                const partes = crear("select", "master-postit-elegir");
                partes.setAttribute("aria-label", "Trozos de " + r.nombre);
                [4, 6, 8, 10, 12].forEach((n) => {
                    const o = crear("option", "", n + " trozos");
                    o.value = n;
                    partes.appendChild(o);
                });
                partes.value = r.partes;
                partes.addEventListener("change", () => {
                    r.partes = parseInt(partes.value, 10);
                    r.llenas = Math.min(r.llenas, r.partes);
                    guardar();
                    pintar();
                });
                const quitar = botonDe("master-nombre-boton", "✕", () => {
                    d.relojes.splice(i, 1);
                    guardar();
                    pintar();
                    avisar("Quitado: " + r.nombre + ".");
                    nuevoNombre.focus();
                }, "Quitar el reloj " + r.nombre);
                const mandos = crear("div", "master-reloj-mandos");
                mandos.append(menos, mas, partes, quitar);
                li.append(nombre, barra, mandos);
                return li;
            }));
            if (!d.relojes.length) {
                lista.appendChild(crear("li", "oc-vacio", "Sin relojes todavía."));
            }
        };
        const form = crear("form", "master-reloj-nuevo");
        const nuevoNombre = crear("input", "master-elegir");
        nuevoNombre.placeholder = "la guardia llega, el ritual se completa…";
        nuevoNombre.setAttribute("aria-label", "Nombre del reloj nuevo");
        const nuevoPartes = crear("select", "master-postit-elegir");
        nuevoPartes.setAttribute("aria-label", "Trozos del reloj nuevo");
        [4, 6, 8, 10, 12].forEach((n) => {
            const o = crear("option", "", n + " trozos");
            o.value = n;
            nuevoPartes.appendChild(o);
        });
        nuevoPartes.value = "6";
        const anadirReloj = crear("button", "oc-vida-accion es-principal", "＋ reloj");
        anadirReloj.type = "submit";
        form.append(nuevoNombre, nuevoPartes, anadirReloj);
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const r = { nombre: nuevoNombre.value.trim() || "reloj " + (d.relojes.length + 1), partes: parseInt(nuevoPartes.value, 10), llenas: 0 };
            d.relojes.push(r);
            nuevoNombre.value = "";
            guardar();
            pintar();
            avisar("Reloj nuevo: " + r.nombre + ", de " + r.partes + " trozos.");
        });
        dentro.append(form, lista);
        pintar();
    }

    // ---- EL CALENDARIO de la partida: gregoriano, el de Harptos (el de
    // los Reinos Olvidados: meses de 30 días, decanarios y fiestas; los
    // nombres, en master-tablas.json) o uno propio (meses y días de la
    // semana a mano: el de Cralëa, por ejemplo). Con la fecha y la hora de
    // la partida (y botones para que pase el tiempo) y apuntes por día. ----
    const MESES_GREGORIANO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
        "noviembre", "diciembre"];
    const SEMANA_GREGORIANO = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

    function montarCalendario(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        pedir(TABLAS).then((tablas) => {
            const d = m.datos;
            const hoyReal = new Date();
            d.tipo = d.tipo || "gregoriano";
            d.propio = Object.assign({ nombre: "propio", anio: "", meses: "Primero: 30\nSegundo: 30\nTercero: 30\nCuarto: 30",
                semana: "uno, dos, tres, cuatro, cinco, seis, siete" }, d.propio || {});
            d.apuntes = d.apuntes || {};
            const harptos = tablas.calendarios.harptos;
            // Los meses de un año (con sus días; las fiestas, de 1 día).
            const mesesDe = (anio) => {
                if (d.tipo === "gregoriano") {
                    return MESES_GREGORIANO.map((nombre, i) => ({ nombre, dias: new Date(anio, i + 1, 0).getDate() }));
                }
                if (d.tipo === "harptos") {
                    return harptos.meses.filter((x) => !x.cada || anio % x.cada === 0);
                }
                return d.propio.meses.split("\n").map((l) => l.split(":")).filter((x) => x[0].trim())
                    .map(([nombre, dias]) => ({ nombre: nombre.trim(), dias: Math.max(1, Math.min(100, parseInt(dias, 10) || 30)) }));
            };
            const semana = () => (d.tipo === "gregoriano" ? SEMANA_GREGORIANO : d.tipo === "harptos" ? harptos.dias
                : d.propio.semana.split(",").map((x) => x.trim()).filter(Boolean));
            const sufijo = () => (d.tipo === "harptos" ? " " + harptos.anio : d.tipo === "propio" && d.propio.anio ? " " + d.propio.anio : "");
            // Qué día de la semana es (0…): el gregoriano, por el de verdad;
            // el de Harptos, el decanario empieza cada mes; el propio, seguido.
            const diaSemana = (f) => {
                if (d.tipo === "gregoriano") {
                    return (new Date(f.anio, f.mes, f.dia).getDay() + 6) % 7;
                }
                if (d.tipo === "harptos") {
                    return (f.dia - 1) % 10;
                }
                const meses = mesesDe(f.anio);
                const largo = meses.reduce((t, x) => t + x.dias, 0);
                let n = (f.anio - 1) * largo;
                for (let i = 0; i < f.mes; i++) {
                    n += meses[i].dias;
                }
                n += f.dia - 1;
                const s = semana().length || 7;
                return ((n % s) + s) % s;
            };
            const arreglar = (f) => {
                const meses = mesesDe(f.anio);
                f.mes = Math.min(Math.max(0, f.mes), meses.length - 1);
                f.dia = Math.min(Math.max(1, f.dia), meses[f.mes].dias);
                return f;
            };
            if (!d.fecha) {
                d.fecha = d.tipo === "gregoriano" ? { anio: hoyReal.getFullYear(), mes: hoyReal.getMonth(), dia: hoyReal.getDate() }
                    : { anio: 1492, mes: 0, dia: 1 };
                d.hora = 8;
            }
            arreglar(d.fecha);
            d.viendo = d.viendo || { anio: d.fecha.anio, mes: d.fecha.mes };
            const clave = (f) => d.tipo + ":" + f.anio + "-" + f.mes + "-" + f.dia;
            const nombreFecha = (f) => {
                const mes = mesesDe(f.anio)[f.mes];
                if (mes.fiesta) {
                    return mes.nombre + " de " + f.anio + sufijo();
                }
                const dia = d.tipo === "gregoriano" ? ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"][diaSemana(f)]
                    + " " + f.dia : d.tipo === "harptos" ? "día " + f.dia : f.dia + " (" + semana()[diaSemana(f)] + ")";
                return dia + " de " + mes.nombre + " de " + f.anio + sufijo();
            };
            const momento = (h) => (h < 6 ? "de madrugada" : h < 12 ? "por la mañana" : h < 14 ? "a mediodía" : h < 20 ? "por la tarde"
                : "por la noche");
            // Que pase el tiempo (en horas; con días si se pasa de 24).
            const pasar = (horas) => {
                let h = (d.hora || 0) + horas;
                let dias = Math.floor(h / 24);
                h = ((h % 24) + 24) % 24;
                d.hora = h;
                const f = d.fecha;
                while (dias > 0) {
                    f.dia++;
                    if (f.dia > mesesDe(f.anio)[f.mes].dias) {
                        f.dia = 1;
                        f.mes++;
                        if (f.mes >= mesesDe(f.anio).length) {
                            f.mes = 0;
                            f.anio++;
                        }
                    }
                    dias--;
                }
                while (dias < 0) {
                    f.dia--;
                    if (f.dia < 1) {
                        f.mes--;
                        if (f.mes < 0) {
                            f.anio--;
                            f.mes = mesesDe(f.anio).length - 1;
                        }
                        f.dia = mesesDe(f.anio)[f.mes].dias;
                    }
                    dias++;
                }
                d.viendo = { anio: f.anio, mes: f.mes };
                guardar();
                pintar();
                avisar("Ahora: " + nombreFecha(f) + ", a las " + d.hora + ":00 (" + momento(d.hora) + ").");
                // Para los efectos con duración (que cuentan las horas).
                document.dispatchEvent(new CustomEvent("master:tiempo", { detail: { horas } }));
            };
            // ARRIBA: qué calendario, la fecha de la partida y el tiempo.
            const tipo = elegirDe("master-cal-tipo-" + m.id, "calendario", [["gregoriano", "gregoriano"], ["harptos", harptos.nombre],
                ["propio", "propio"]], d.tipo);
            tipo.elegir.addEventListener("change", () => {
                d.tipo = tipo.elegir.value;
                d.fecha = d.tipo === "gregoriano" ? { anio: hoyReal.getFullYear(), mes: hoyReal.getMonth(), dia: hoyReal.getDate() }
                    : { anio: d.tipo === "harptos" ? 1492 : 1, mes: 0, dia: 1 };
                d.viendo = { anio: d.fecha.anio, mes: d.fecha.mes };
                guardar();
                pintar();
                avisar("Calendario " + tipo.elegir.selectedOptions[0].textContent + ".");
            });
            const ahora = crear("p", "master-cal-ahora");
            ahora.setAttribute("aria-live", "polite");
            const tiempo = crear("div", "master-cal-tiempo");
            tiempo.setAttribute("role", "group");
            tiempo.setAttribute("aria-label", "Que pase el tiempo");
            [["−1 día", -24], ["+1 h", 1], ["+8 h (descanso largo)", 8], ["+1 día", 24], ["+1 semana", 0]].forEach(([texto, h]) => {
                tiempo.appendChild(botonDe("oc-vida-accion", texto, () => pasar(h || 24 * (semana().length || 7))));
            });
            // EL PROPIO: meses (uno por línea, «nombre: días»), días de la
            // semana y lo que va detrás del año.
            const propio = crear("div", "master-cal-propio");
            const etMeses = crear("label", "oc-dados-etiqueta", "meses (uno por línea: «nombre: días»)");
            const meses = crear("textarea", "oc-notas-texto es-corta");
            meses.id = "master-cal-meses-" + m.id;
            etMeses.htmlFor = meses.id;
            meses.value = d.propio.meses;
            const etSemana = crear("label", "oc-dados-etiqueta", "días de la semana (separados por comas)");
            const sem = crear("input", "master-elegir");
            sem.id = "master-cal-semana-" + m.id;
            etSemana.htmlFor = sem.id;
            sem.value = d.propio.semana;
            const etAnio = crear("label", "oc-dados-etiqueta", "detrás del año (DEM, AEM…)");
            const anio = crear("input", "master-elegir");
            anio.id = "master-cal-anio-" + m.id;
            etAnio.htmlFor = anio.id;
            anio.value = d.propio.anio;
            const etNum = crear("label", "oc-dados-etiqueta", "año de la partida");
            const numAnio = crear("input", "master-elegir");
            numAnio.type = "number";
            numAnio.id = "master-cal-num-" + m.id;
            etNum.htmlFor = numAnio.id;
            const usar = botonDe("oc-vida-accion", "✔ usar", () => {
                Object.assign(d.propio, { meses: meses.value, semana: sem.value, anio: anio.value.trim() });
                d.fecha.anio = parseInt(numAnio.value, 10) || d.fecha.anio;
                arreglar(d.fecha);
                d.viendo = { anio: d.fecha.anio, mes: d.fecha.mes };
                guardar();
                pintar();
                avisar("Calendario propio puesto.");
            });
            propio.append(etMeses, meses, etSemana, sem, etAnio, anio, etNum, numAnio, usar);
            // EL MES: en rejilla, con ‹ › para cambiar de mes.
            const cabeza = crear("div", "master-cal-cabeza");
            const titulo = crear("h3", "master-cal-mes");
            titulo.setAttribute("aria-live", "polite");
            const verMes = (paso) => {
                let { anio: a, mes: me } = d.viendo;
                me += paso;
                if (me < 0) {
                    a--;
                    me = mesesDe(a).length - 1;
                } else if (me >= mesesDe(a).length) {
                    a++;
                    me = 0;
                }
                d.viendo = { anio: a, mes: me };
                guardar();
                pintarMes();
            };
            const antes = botonDe("master-pestana-mando", "‹", () => verMes(-1), "Mes anterior");
            const despues = botonDe("master-pestana-mando", "›", () => verMes(1), "Mes siguiente");
            const volver = botonDe("oc-vida-accion", "hoy", () => {
                d.viendo = { anio: d.fecha.anio, mes: d.fecha.mes };
                guardar();
                pintarMes();
            }, "Volver al mes de la partida");
            cabeza.append(antes, titulo, despues, volver);
            const rejilla = crear("table", "master-cal-rejilla");
            // El día elegido y sus apuntes.
            let elegido = Object.assign({}, d.fecha);
            const etDia = crear("label", "oc-dados-etiqueta");
            const apunte = crear("textarea", "oc-notas-texto es-corta");
            apunte.id = "master-cal-apunte-" + m.id;
            etDia.htmlFor = apunte.id;
            apunte.rows = 3;
            const esHoy = botonDe("oc-vida-accion", "📍 que la partida esté en este día", () => {
                d.fecha = Object.assign({}, elegido);
                guardar();
                pintar();
                avisar("La partida está en " + nombreFecha(d.fecha) + ".");
            });
            let espera = 0;
            apunte.addEventListener("input", () => {
                clearTimeout(espera);
                espera = setTimeout(() => {
                    if (apunte.value.trim()) {
                        d.apuntes[clave(elegido)] = apunte.value;
                    } else {
                        delete d.apuntes[clave(elegido)];
                    }
                    guardar();
                    pintarMes();
                }, 400);
            });
            const pintarDia = () => {
                etDia.textContent = "apuntes del " + nombreFecha(elegido);
                apunte.value = d.apuntes[clave(elegido)] || "";
            };
            function pintarMes() {
                const { anio: a, mes: me } = d.viendo;
                const lista = mesesDe(a);
                const mes = lista[Math.min(me, lista.length - 1)];
                titulo.textContent = mes.nombre + " de " + a + sufijo();
                const dias = semana();
                const cols = Math.max(1, dias.length);
                const cab = crear("tr");
                dias.forEach((x) => cab.appendChild(crear("th", "", x)));
                const filas = [cab];
                let fila = crear("tr");
                const hueco = mes.fiesta ? 0 : diaSemana({ anio: a, mes: me, dia: 1 });
                for (let i = 0; i < hueco; i++) {
                    fila.appendChild(crear("td"));
                }
                for (let dia = 1; dia <= mes.dias; dia++) {
                    const f = { anio: a, mes: me, dia };
                    const td = crear("td");
                    const b = botonDe("master-cal-dia", String(dia), () => {
                        elegido = f;
                        pintarMes();
                        pintarDia();
                        apunte.focus();
                    }, nombreFecha(f) + (d.apuntes[clave(f)] ? " (con apuntes)" : ""));
                    if (a === d.fecha.anio && me === d.fecha.mes && dia === d.fecha.dia) {
                        b.classList.add("es-hoy");
                        b.setAttribute("aria-current", "date");
                    }
                    if (a === elegido.anio && me === elegido.mes && dia === elegido.dia) {
                        b.classList.add("es-elegido");
                    }
                    if (d.apuntes[clave(f)]) {
                        b.classList.add("con-apunte");
                    }
                    td.appendChild(b);
                    fila.appendChild(td);
                    if (fila.children.length === cols || mes.fiesta) {
                        filas.push(fila);
                        fila = crear("tr");
                    }
                }
                if (fila.children.length) {
                    filas.push(fila);
                }
                rejilla.replaceChildren(...filas);
                rejilla.setAttribute("aria-label", titulo.textContent);
            }
            function pintar() {
                ahora.replaceChildren(crear("strong", "", "En la partida: "), document.createTextNode(nombreFecha(d.fecha) + ", a las " +
                    (d.hora || 0) + ":00 (" + momento(d.hora || 0) + ")"));
                propio.hidden = d.tipo !== "propio";
                numAnio.value = d.fecha.anio;
                elegido = Object.assign({}, d.fecha);
                pintarMes();
                pintarDia();
            }
            const arriba = crear("div", "master-nombres-form");
            arriba.append(tipo, propio, ahora, tiempo);
            dentro.replaceChildren(arriba, cabeza, rejilla, etDia, apunte, esHoy);
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar los calendarios."));
        });
    }

    // ---- EL GENERADOR DE DUNGEONS: un mapa sencillo en cuadrícula (salas
    // y pasillos al azar) y, para cada sala, qué es, un detalle, y lo que
    // hay: monstruos del SRD (con la cuenta de los encuentros), una trampa
    // (tablas propias) o un botín (el del generador de botín). El mapa va
    // en un canvas (de colores fijos, como un pergamino) y la lista de
    // salas es lo que lee el lector de pantalla. «🎨 al dibujo» lo pasa a
    // una ventana de dibujo, con su rejilla, para pintar encima. ----
    const DUNGEON_ANCHO = 48;
    const DUNGEON_ALTO = 36;
    const DUNGEON_CELDA = 20;
    const DUNGEON_TAMANOS = [["5", "pequeño (5 salas)"], ["8", "mediano (8 salas)"], ["12", "grande (12 salas)"]];
    // La trampa según el nivel: CD y daño (cuenta propia).
    const DUNGEON_TRAMPA = [[4, 12, "2d10"], [10, 14, "4d10"], [16, 16, "8d10"], [99, 18, "10d10"]];

    // EL MAPA: salas al azar en una cuadrícula de 48 × 36 sin que se
    // toquen, unidas por pasillos en L (cada una con la siguiente y una o
    // dos más; la primera de esas, SECRETA). Estilo «salas» (rectángulos,
    // con puertas: normales, cerradas con llave, atrancadas o secretas) o
    // «cavernas» (manchas irregulares y pasillos que se ensanchan, sin
    // puertas). En «filas», cada casilla: 0 roca, 1 sala, 2 pasillo, 3
    // pasillo secreto; en «zonas», de qué sala es (en base 36; «.» ninguna).
    function hacerMapa(salasQuiero, estilo, cds) {
        const celdas = Array.from({ length: DUNGEON_ALTO }, () => new Array(DUNGEON_ANCHO).fill(0));
        const zonas = Array.from({ length: DUNGEON_ALTO }, () => new Array(DUNGEON_ANCHO).fill("."));
        const salas = [];
        const azar = (a, b) => a + tiradaSuelta("1d" + (b - a + 1)) - 1;
        const cavernas = estilo === "cavernas";
        for (let intento = 0; intento < 400 && salas.length < salasQuiero; intento++) {
            const w = azar(4, cavernas ? 10 : 9);
            const h = azar(3, cavernas ? 8 : 7);
            const x = azar(1, DUNGEON_ANCHO - w - 2);
            const y = azar(1, DUNGEON_ALTO - h - 2);
            if (salas.some((s) => x < s.x + s.w + 2 && s.x < x + w + 2 && y < s.y + s.h + 2 && s.y < y + h + 2)) {
                continue;
            }
            salas.push({ x, y, w, h });
        }
        salas.sort((a, b) => (a.x + a.w / 2) - (b.x + b.w / 2));
        salas.forEach((s, n) => {
            const rx = s.w / 2;
            const ry = s.h / 2;
            s.cx = Math.floor(s.x + rx);
            s.cy = Math.floor(s.y + ry);
            for (let j = s.y; j < s.y + s.h; j++) {
                for (let i = s.x; i < s.x + s.w; i++) {
                    // En las cavernas, una mancha: una elipse con los bordes
                    // mordidos al azar (el centro, siempre).
                    const dx = (i + 0.5 - s.x - rx) / rx;
                    const dy = (j + 0.5 - s.y - ry) / ry;
                    const dentro = !cavernas || (i === s.cx && j === s.cy) || dx * dx + dy * dy <= 0.75 + tiradaSuelta("1d40") / 100;
                    if (dentro) {
                        celdas[j][i] = 1;
                        zonas[j][i] = n.toString(36);
                    }
                }
            }
        });
        const pasillos = [];
        const puertas = [];
        const pasillo = (a, b, secreto) => {
            const sa = salas[a];
            const sb = salas[b];
            const [x0, y0, x1, y1] = [sa.cx, sa.cy, sb.cx, sb.cy];
            const camino = [];
            const tramo = (desde, hasta, fijo, horizontal) => {
                const paso = desde <= hasta ? 1 : -1;
                for (let k = desde; k !== hasta + paso; k += paso) {
                    camino.push(horizontal ? [k, fijo] : [fijo, k]);
                }
            };
            if (tiradaSuelta("1d2") === 1) {
                tramo(x0, x1, y0, true);
                tramo(y0, y1, x1, false);
            } else {
                tramo(y0, y1, x0, false);
                tramo(x0, x1, y1, true);
            }
            const celdasP = [];
            const n = pasillos.length;
            camino.forEach(([i, j], k) => {
                if (celdas[j][i] !== 1) {
                    // Todo lo que pisa fuera de las salas (también lo que ya
                    // era de otro pasillo): así se ve entero.
                    celdasP.push([i, j]);
                }
                if (celdas[j][i] === 0) {
                    celdas[j][i] = secreto ? 3 : 2;
                    // En las cavernas, a veces se ensancha.
                    if (cavernas && tiradaSuelta("1d3") === 1) {
                        const [di, dj] = alAzar([[1, 0], [0, 1], [-1, 0], [0, -1]]);
                        const ni = i + di;
                        const nj = j + dj;
                        if (ni > 0 && nj > 0 && ni < DUNGEON_ANCHO - 1 && nj < DUNGEON_ALTO - 1 && celdas[nj][ni] === 0) {
                            celdas[nj][ni] = secreto ? 3 : 2;
                            celdasP.push([ni, nj]);
                        }
                    }
                }
                // Las puertas: donde el camino sale de una sala o entra en
                // ella (la casilla de fuera). En las cavernas no hay.
                if (cavernas || celdas[j][i] === 1) {
                    return;
                }
                // Una por cada punta del pasillo (al salir de «a» y al entrar
                // en «b»), no en las salas que cruza por el camino.
                const vecinas = [camino[k - 1], camino[k + 1]].filter(Boolean);
                const sala = vecinas.find(([vi, vj]) => zonas[vj][vi] !== "." && [a, b].indexOf(parseInt(zonas[vj][vi], 36)) >= 0);
                if (!sala || puertas.some((p) => (p.x === i && p.y === j) ||
                    (p.pasillo === n && p.sala === parseInt(zonas[sala[1]][sala[0]], 36)))) {
                    return;
                }
                let tipo = "normal";
                const r = tiradaSuelta("1d20");
                if (secreto) {
                    tipo = "secreta";
                } else if (r >= 17) {
                    tipo = "cerrada";
                } else if (r >= 15) {
                    tipo = "atrancada";
                }
                puertas.push({ x: i, y: j, tipo, cd: cds[tipo] || 0, sala: parseInt(zonas[sala[1]][sala[0]], 36),
                    vertical: sala[1] === j, pasillo: n });
            });
            pasillos.push({ a, b, secreto: !!secreto, celdas: celdasP });
        };
        for (let i = 1; i < salas.length; i++) {
            pasillo(i - 1, i, false);
        }
        for (let k = 0; k < Math.min(2, salas.length - 2); k++) {
            const a = azar(0, salas.length - 1);
            let b = azar(0, salas.length - 2);
            b = b >= a ? b + 1 : b;
            pasillo(a, b, k === 0);
        }
        // En las cavernas, se suaviza: la roca rodeada de suelo pasa a ser
        // suelo (así no quedan picos sueltos).
        if (cavernas) {
            for (let vuelta = 0; vuelta < 2; vuelta++) {
                const antes = celdas.map((f) => f.slice());
                for (let j = 1; j < DUNGEON_ALTO - 1; j++) {
                    for (let i = 1; i < DUNGEON_ANCHO - 1; i++) {
                        if (antes[j][i] !== 0) {
                            continue;
                        }
                        let suelo = 0;
                        for (let dj = -1; dj <= 1; dj++) {
                            for (let di = -1; di <= 1; di++) {
                                suelo += antes[j + dj][i + di] === 1 || antes[j + dj][i + di] === 2 ? 1 : 0;
                            }
                        }
                        if (suelo >= 5) {
                            celdas[j][i] = 2;
                            const cerca = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].find(([a, b]) => zonas[b][a] !== ".");
                            if (cerca) {
                                celdas[j][i] = 1;
                                zonas[j][i] = zonas[cerca[1]][cerca[0]];
                            }
                        }
                    }
                }
            }
        }
        return { estilo: cavernas ? "cavernas" : "salas", filas: celdas.map((f) => f.join("")), zonas: zonas.map((f) => f.join("")),
            salas: salas.map(({ x, y, w, h, cx, cy }) => ({ x, y, w, h, cx, cy })), pasillos, puertas };
    }

    // EL MAPA EN UN CANVAS (de colores fijos, como un pergamino). Para el
    // máster, todo: los números, la entrada, los pasillos secretos (a rayas
    // rojas) y las puertas con lo que son. Para los jugadores («vistas»:
    // las salas descubiertas; «encontrados»: los pasillos secretos que ya
    // se saben), solo lo descubierto, sin números ni secretos.
    function pintarMapa(lienzoMapa, mapa, op) {
        op = op || {};
        const jug = !!op.jugadores;
        const vistas = new Set(op.vistas || []);
        const encontrados = new Set(op.encontrados || []);
        const c = DUNGEON_CELDA;
        lienzoMapa.width = DUNGEON_ANCHO * c;
        lienzoMapa.height = DUNGEON_ALTO * c;
        const ctx = lienzoMapa.getContext("2d");
        ctx.fillStyle = "#3a332b";
        ctx.fillRect(0, 0, lienzoMapa.width, lienzoMapa.height);
        // Qué se ve: en el del máster, todo.
        const pasilloVisto = (p, i) => (!p.secreto || encontrados.has(i)) && (vistas.has(p.a) || vistas.has(p.b));
        const vista = new Set();
        if (jug) {
            (mapa.pasillos || []).forEach((p, i) => {
                if (pasilloVisto(p, i)) {
                    p.celdas.forEach(([x, y]) => vista.add(x + "," + y));
                }
            });
        }
        const seVe = (i, j, v) => {
            if (!jug) {
                return true;
            }
            if (v === "1") {
                return vistas.has(parseInt(mapa.zonas[j][i], 36));
            }
            return vista.has(i + "," + j);
        };
        const pisables = [];
        mapa.filas.forEach((fila, j) => {
            Array.from(fila).forEach((v, i) => {
                if (v === "0" || !seVe(i, j, v)) {
                    return;
                }
                ctx.fillStyle = v === "1" ? "#efe2bf" : v === "3" && !jug ? "#e3c3a8" : "#d9c79c";
                ctx.fillRect(i * c, j * c, c, c);
                pisables.push([i, j, v]);
            });
        });
        ctx.strokeStyle = "rgba(59, 42, 23, 0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        pisables.forEach(([i, j]) => ctx.rect(i * c + 0.5, j * c + 0.5, c - 1, c - 1));
        ctx.stroke();
        // Los pasillos secretos, a rayas rojas (solo el máster).
        if (!jug) {
            ctx.strokeStyle = "#a3261a";
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            pisables.filter((x) => x[2] === "3").forEach(([i, j]) => ctx.strokeRect(i * c + 3, j * c + 3, c - 6, c - 6));
            ctx.setLineDash([]);
        }
        // Las puertas.
        (mapa.puertas || []).forEach((p) => {
            const secreta = p.tipo === "secreta";
            if (jug && (!vista.has(p.x + "," + p.y) || (secreta && !encontrados.has(p.pasillo)))) {
                return;
            }
            const x = p.x * c;
            const y = p.y * c;
            ctx.fillStyle = secreta && !jug ? "#a3261a" : "#6b4423";
            if (p.vertical) {
                ctx.fillRect(x + c * 0.35, y + 1, c * 0.3, c - 2);
            } else {
                ctx.fillRect(x + 1, y + c * 0.35, c - 2, c * 0.3);
            }
            // Lo que es (solo el máster): C cerrada con llave, A atrancada,
            // S secreta.
            if (!jug && p.tipo !== "normal") {
                ctx.fillStyle = "#1d1b26";
                ctx.fillRect(x + c * 0.15, y + c * 0.15, c * 0.7, c * 0.7);
                ctx.font = "bold " + Math.round(c * 0.6) + "px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "#fdfaf0";
                ctx.fillText({ secreta: "S", cerrada: "C", atrancada: "A" }[p.tipo], x + c / 2, y + c / 2 + 1);
            }
        });
        if (jug) {
            return;
        }
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        mapa.salas.forEach((s, i) => {
            const x = (s.cx + 0.5) * c;
            const y = (s.cy + 0.5) * c;
            ctx.fillStyle = "#7a1c12";
            ctx.beginPath();
            ctx.arc(x, y, c * 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#fdfaf0";
            ctx.font = "bold " + Math.round(c * 0.85) + "px sans-serif";
            ctx.fillText(String(i + 1), x, y + 1);
        });
        if (mapa.salas[0]) {
            const s = mapa.salas[0];
            ctx.fillStyle = "#2e7d32";
            ctx.font = "bold " + Math.round(c * 0.7) + "px sans-serif";
            ctx.fillText("entrada", (s.x + s.w / 2) * c, (s.y + s.h) * c - c * 0.6);
        }
    }

    function montarDungeon(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        Promise.all([pedir(TABLAS), pedir(BESTIARIO), pedir(TIENDA)]).then(([tablas, best, tienda]) => {
            const d = m.datos;
            const t = tablas.dungeon;
            const porEn = {};
            best.monstruos.forEach((b) => {
                porEn[b.en] = b;
            });
            const objetos = {};
            tienda.objetos.forEach((o) => {
                objetos[o.en] = o;
            });
            const tema = elegirDe("master-dungeon-tema-" + m.id, "qué es", Object.keys(t.temas).map((k) => [k, t.temas[k].emoji + " " +
                t.temas[k].nombre]), d.tema || "cripta");
            const tamano = elegirDe("master-dungeon-tam-" + m.id, "tamaño", DUNGEON_TAMANOS, d.salas || "8");
            const enParty = estado.modulos.filter((x) => x.tipo === "party").reduce((n, x) => n + ((x.datos && x.datos.pjs) || []).length, 0);
            const numero = (id, texto, valor, min, max) => {
                const caja = crear("div", "master-campo");
                const et = crear("label", "oc-dados-etiqueta", texto);
                const x = crear("input", "master-elegir");
                x.type = "number";
                x.min = min;
                x.max = max;
                x.value = valor;
                x.id = id + m.id;
                et.htmlFor = x.id;
                caja.append(et, x);
                caja.elegir = x;
                return caja;
            };
            const nivel = numero("master-dungeon-nivel-", "nivel de la party", d.nivel || 3, 1, 20);
            const pjs = numero("master-dungeon-pjs-", "cuántos PJ", d.pjs || enParty || 4, 1, 10);
            const estilo = elegirDe("master-dungeon-estilo-" + m.id, "estilo del mapa", [["", "según el sitio"], ["salas", "salas y puertas"],
                ["cavernas", "cavernas"]], d.estilo || "");
            const fila = crear("div", "master-encuentro-fila");
            fila.append(tema, tamano, nivel, pjs, estilo);
            // El del máster (todo) o el de los jugadores (lo descubierto).
            const vista = botonesDe("qué mapa se ve", [["master", "🧙 el del máster"], ["jugadores", "👥 el de los jugadores"]],
                d.vista || "master", (v) => {
                    d.vista = v;
                    guardar();
                    pintar();
                });
            const mapaLienzo = crear("canvas", "master-dungeon-mapa");
            mapaLienzo.setAttribute("role", "img");
            const salasLista = crear("ol", "master-dungeon-salas");
            salasLista.setAttribute("aria-label", "Las salas");
            const botones = crear("div", "master-notas-botones");

            const generar = () => {
                d.tema = tema.elegir.value;
                d.salas = tamano.elegir.value;
                d.nivel = Math.min(20, Math.max(1, parseInt(nivel.elegir.value, 10) || 1));
                d.pjs = Math.min(10, Math.max(1, parseInt(pjs.elegir.value, 10) || 1));
                const tm = t.temas[d.tema];
                d.estilo = estilo.elegir.value;
                const [, cdBase] = DUNGEON_TRAMPA.find((x) => d.nivel <= x[0]);
                const mapa = hacerMapa(parseInt(d.salas, 10), d.estilo || (d.tema === "cueva" ? "cavernas" : "salas"),
                    { cerrada: cdBase + 1, atrancada: cdBase + 2, secreta: cdBase });
                d.vistas = [0];
                d.encontrados = [];
                // Los monstruos que pegan con el sitio (por tipo y hábitat);
                // si son pocos, también los de su hábitat.
                let bichos = best.monstruos.filter((b) => tm.tipos.some((x) => b.tipo.indexOf(x) === 0) &&
                    (!tm.habitat || (b.habitat || []).some((h) => h === tm.habitat || h === "cualquiera")));
                if (bichos.length < 8) {
                    bichos = best.monstruos.filter((b) => tm.tipos.some((x) => b.tipo.indexOf(x) === 0));
                }
                const franja = d.nivel <= 4 ? 0 : d.nivel <= 10 ? 1 : d.nivel <= 16 ? 2 : 3;
                const [, cd, dano] = DUNGEON_TRAMPA.find((x) => d.nivel <= x[0]);
                const usadas = new Set();
                const unaDe = (lista) => {
                    const libres = lista.filter((x) => !usadas.has(x));
                    const x = alAzar(libres.length ? libres : lista);
                    usadas.add(x);
                    return x;
                };
                const salas = mapa.salas.map((s, i) => {
                    const ultima = i === mapa.salas.length - 1;
                    const sala = { que: unaDe(tm.salas), detalle: alAzar(tm.detalles) };
                    const tirada = i === 0 ? 6 : tiradaSuelta("1d6");
                    if (ultima || tirada <= 2 || tirada === 4) {
                        const enc = hacerEncuentro(bichos, "", d.nivel, d.pjs, ultima ? 0.6 : 0.3);
                        sala.bichos = enc.grupos;
                        sala.hacen = enc.hacen;
                    }
                    if (tirada === 3 || (tirada === 5 && tiradaSuelta("1d2") === 1)) {
                        const tr = alAzar(t.trampas);
                        sala.trampa = { nombre: tr.nombre, texto: tr.texto.replace(/\{cd\}/g, cd).replace(/\{dano\}/g, dano) };
                    }
                    if (ultima || tirada === 4 || tirada === 5) {
                        sala.botin = hacerBotin(tienda.objetos, franja, ultima || tirada === 5 ? "tesoro" : "uno");
                        sala.donde = alAzar(t.tesoros_sala);
                    }
                    return sala;
                });
                d.mapa = mapa;
                d.contenido = salas;
                guardar();
                pintar();
                avisar("Dungeon nuevo: " + tm.nombre + " de " + salas.length + " salas.");
            };
            const botinTexto = (r) => {
                const partes = r.monedas.filter((x) => x[1]).map((x) => x[1].toLocaleString("es-ES") + " " + x[0]);
                r.cosas.forEach((c) => partes.push((c.n > 1 ? c.n + " × " : "") + c.texto + " (" + c.valor + " po)"));
                return partes.join(", ");
            };
            function pintar() {
                if (!d.mapa) {
                    mapaLienzo.hidden = true;
                    salasLista.replaceChildren(crear("li", "oc-vacio", "Elige y pulsa «generar»."));
                    botones.hidden = true;
                    leyenda.hidden = true;
                    return;
                }
                mapaLienzo.hidden = false;
                botones.hidden = false;
                d.vistas = d.vistas || [0];
                d.encontrados = d.encontrados || [];
                const deJugadores = d.vista === "jugadores";
                pintarVista();
                leyenda.hidden = deJugadores || d.mapa.estilo === "cavernas";
                descubrir.hidden = tapar.hidden = !deJugadores;
                salasLista.replaceChildren(...d.contenido.map((s, i) => {
                    const li = crear("li", "master-dungeon-sala");
                    const h = crear("h3", "master-dungeon-sala-titulo", "Sala " + (i + 1) + (i === 0 ? " (entrada)" : "") +
                        (i === d.contenido.length - 1 ? " (la última)" : ""));
                    const desc = crear("p", "", "Es " + s.que + "; " + s.detalle + ".");
                    // ¿La han descubierto ya? (Sale en el mapa de los jugadores.)
                    const etVista = crear("label", "master-nombres-apellido");
                    const caja = crear("input");
                    caja.type = "checkbox";
                    caja.checked = d.vistas.indexOf(i) >= 0;
                    caja.addEventListener("change", () => {
                        d.vistas = d.vistas.filter((x) => x !== i).concat(caja.checked ? [i] : []);
                        guardar();
                        pintarVista();
                        avisar("Sala " + (i + 1) + (caja.checked ? " descubierta." : " tapada."));
                    });
                    etVista.append(caja, document.createTextNode(" descubierta (sale en el mapa de los jugadores)"));
                    li.append(h, desc, etVista);
                    if (s.bichos && s.bichos.length) {
                        const p = crear("p", "master-dungeon-cosa");
                        p.append(crear("strong", "", "Monstruos: "));
                        s.bichos.forEach((g, k) => {
                            const b = porEn[g.en];
                            if (!b) {
                                return;
                            }
                            if (k) {
                                p.appendChild(document.createTextNode(" y "));
                            }
                            const ver = botonDe("master-botin-objeto", (g.n > 1 ? g.n + " × " : "") + b.nombre, () => abrirBicho(b, ver, best.fuente),
                                "Ver " + b.nombre);
                            p.appendChild(ver);
                        });
                        p.appendChild(document.createTextNode(" (están " + s.hacen + ")."));
                        const ini = botonDe("oc-vida-accion", "⚔️ a la iniciativa", () => {
                            const entran = [];
                            s.bichos.forEach((g) => {
                                const b = porEn[g.en];
                                for (let k = 0; k < g.n && b; k++) {
                                    entran.push(meterEnIniciativa({ nombre: b.nombre, bono: b.ini, ca: b.ca, pg: b.pg || "", color: "#d23b3b" },
                                        (nombres, renombrar) => conNumero(b.nombre, nombres, renombrar)));
                                }
                            });
                            avisar("A la iniciativa: " + entran.filter(Boolean).join(", ") + ".");
                        }, "Los monstruos de la sala " + (i + 1) + " a la iniciativa");
                        li.append(p, ini);
                    }
                    if (s.trampa) {
                        const p = crear("p", "master-dungeon-cosa");
                        p.append(crear("strong", "", "Trampa: " + s.trampa.nombre + ". "), document.createTextNode(s.trampa.texto));
                        if (window.ocDadosEnTexto) {
                            window.ocDadosEnTexto(p);
                        }
                        li.appendChild(p);
                    }
                    if (s.botin) {
                        const p = crear("p", "master-dungeon-cosa");
                        p.append(crear("strong", "", "Botín (" + s.donde + "): "), document.createTextNode(botinTexto(s.botin)));
                        s.botin.objetos.forEach((en) => {
                            const o = objetos[en];
                            if (!o) {
                                return;
                            }
                            p.appendChild(document.createTextNode(", "));
                            const ver = botonDe("master-botin-objeto", "✨ " + o.nombre, () => abrirObjeto(o, ver, tienda.fuente), "Ver " + o.nombre);
                            p.appendChild(ver);
                        });
                        p.appendChild(document.createTextNode("."));
                        li.appendChild(p);
                    }
                    if (!s.bichos && !s.trampa && !s.botin) {
                        li.appendChild(crear("p", "master-dungeon-cosa", "No hay nada más (o eso parece)."));
                    }
                    // Sus puertas especiales (cerradas, atrancadas, secretas).
                    (d.mapa.puertas || []).filter((pu) => pu.sala === i && pu.tipo !== "normal").forEach((pu) => {
                        const pas = d.mapa.pasillos[pu.pasillo] || {};
                        const otra = pas.a === i ? pas.b : pas.a;
                        const p = crear("p", "master-dungeon-cosa");
                        const que = {
                            cerrada: "Puerta cerrada con llave hacia la sala " + (otra + 1) + ": se abre con herramientas de ladrón (Destreza CD " +
                                pu.cd + ") o se echa abajo (Fuerza (Atletismo) CD " + (pu.cd + 2) + ").",
                            atrancada: "Puerta atrancada por el otro lado (hacia la sala " + (otra + 1) + "): Fuerza (Atletismo) CD " + pu.cd +
                                " para forzarla; hace ruido.",
                            secreta: "Puerta secreta a un pasillo oculto que lleva a la sala " + (otra + 1) + ": Sabiduría (Percepción) CD " +
                                pu.cd + " para verla.",
                        }[pu.tipo];
                        p.append(crear("strong", "", "🚪 "), document.createTextNode(que));
                        li.appendChild(p);
                        if (pu.tipo === "secreta") {
                            const etE = crear("label", "master-nombres-apellido");
                            const enc = crear("input");
                            enc.type = "checkbox";
                            enc.checked = d.encontrados.indexOf(pu.pasillo) >= 0;
                            enc.addEventListener("change", () => {
                                d.encontrados = d.encontrados.filter((x) => x !== pu.pasillo).concat(enc.checked ? [pu.pasillo] : []);
                                guardar();
                                pintarVista();
                                avisar(enc.checked ? "Pasillo secreto encontrado." : "Pasillo secreto escondido otra vez.");
                            });
                            etE.append(enc, document.createTextNode(" la han encontrado"));
                            li.appendChild(etE);
                        }
                    });
                    return li;
                }));
            }
            // El mapa que toca (el del máster o el de los jugadores).
            function pintarVista() {
                // (Los de antes no tienen zonas: solo el del máster.)
                const deJugadores = d.vista === "jugadores" && !!d.mapa.zonas;
                pintarMapa(mapaLienzo, d.mapa, deJugadores ? { jugadores: true, vistas: d.vistas, encontrados: d.encontrados } : {});
                const tm = t.temas[d.tema] || { nombre: "dungeon" };
                mapaLienzo.setAttribute("aria-label", deJugadores ? "Mapa de los jugadores: se ven " + d.vistas.length + " de " +
                    d.mapa.salas.length + " salas, sin números ni secretos." : "Mapa de " + tm.nombre + ": " + d.mapa.salas.length +
                    " salas numeradas unidas por pasillos; la 1 es la entrada. Lo que hay en cada una, en la lista de debajo.");
            }
            const boton = botonDe("oc-vida-accion es-principal master-nombres-generar", "🎲 generar dungeon", generar);
            const alDibujo = botonDe("oc-vida-accion", "🎨 al dibujo", () => {
                const l = crear("canvas");
                pintarMapa(l, d.mapa);
                anadir("dibujo", { titulo: "mapa: " + ((t.temas[d.tema] || {}).nombre || "dungeon"), w: 900, h: 700,
                    datos: { ancho: l.width, alto: l.height, capas: [{ id: "c1", tipo: "capa", nombre: "mapa", visible: true, opacidad: 100,
                        imagen: l.toDataURL("image/png") }, { id: "c2", tipo: "capa", nombre: "notas", visible: true, opacidad: 100, imagen: "" }],
                    activa: "c2", rejilla: { ver: false, tipo: "cuadrada", tam: DUNGEON_CELDA, color: "#000000", opacidad: 40 } } });
            }, "Pasar el mapa a una ventana de dibujo, para pintar encima");
            const copiar = botonDe("oc-vida-accion", "⧉ copiar las salas", () => copiarTexto(Array.from(salasLista.children).map((li) => li.innerText)
                .join("\n\n"), "Copiado el dungeon."), "Copiar las salas (texto)");
            // La imagen del mapa: copiarla (para pegarla en otro sitio) o
            // descargarla en PNG.
            const copiarImagen = botonDe("oc-vida-accion", "🖼️ copiar la imagen", () => {
                if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) {
                    avisar("Este navegador no deja copiar imágenes: descárgala.");
                    return;
                }
                mapaLienzo.toBlob((blob) => {
                    navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
                        .then(() => avisar("Copiada la imagen del mapa."))
                        .catch(() => avisar("No se ha podido copiar la imagen: descárgala."));
                }, "image/png");
            }, "Copiar la imagen del mapa");
            const bajarImagen = botonDe("oc-vida-accion", "⬇ descargar la imagen", () => {
                const a = crear("a");
                a.href = mapaLienzo.toDataURL("image/png");
                a.download = "dungeon-" + (d.tema || "mapa") + ".png";
                document.body.appendChild(a);
                a.click();
                a.remove();
                avisar("Descargado: " + a.download + ".");
            }, "Descargar la imagen del mapa (PNG)");
            const ensenar = botonDe("oc-vida-accion es-principal", "👁️ enseñar a la mesa", () => {
                const l = crear("canvas", "master-dungeon-mapa es-grande");
                pintarMapa(l, d.mapa, { jugadores: true, vistas: d.vistas, encontrados: d.encontrados });
                l.setAttribute("role", "img");
                l.setAttribute("aria-label", "Mapa de los jugadores: lo descubierto.");
                window.ocVentana.abrir({ titulo: "el mapa", cuerpo: l, vuelta: ensenar, clase: "es-ancha" });
            }, "Enseñar en grande el mapa de los jugadores (solo lo descubierto)");
            const descubrir = botonDe("oc-vida-accion", "☀️ descubrir todas", () => {
                d.vistas = d.mapa.salas.map((x, i) => i);
                guardar();
                pintar();
                avisar("Todas las salas descubiertas.");
            });
            const tapar = botonDe("oc-vida-accion", "🌑 tapar todas", () => {
                d.vistas = [0];
                guardar();
                pintar();
                avisar("Tapadas todas menos la entrada.");
            });
            botones.append(ensenar, copiarImagen, bajarImagen, alDibujo, copiar, descubrir, tapar);
            const leyenda = crear("p", "oc-hoja-nota master-dungeon-leyenda",
                "Puertas: C cerrada con llave, A atrancada, S secreta; a rayas rojas, el pasillo secreto. Copiar y descargar, el mapa que se ve.");
            const arriba = crear("div", "master-nombres-form");
            arriba.append(fila, boton, vista);
            dentro.replaceChildren(arriba, mapaLienzo, leyenda, botones, salasLista,
                crear("p", "oc-hoja-nota master-fuente", "Salas, trampas, gemas y arte: tablas propias. Monstruos y objetos: SRD 5.2 (CC BY 4.0)."));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar las tablas."));
        });
    }

    // ---- LOS EFECTOS CON DURACIÓN: «Bendecir en Thia, 1 minuto»,
    // «Armadura de mago, 8 horas»… Se cuentan en segundos de juego (una
    // ronda, 6) y se descuentan solos: con las rondas de la iniciativa (el
    // evento «oc-iniciativa:guardada» de personajes.js) y con el tiempo
    // del calendario («master:tiempo»); también a mano. Escribiendo el
    // nombre de un conjuro del SRD, se pone solo su duración. ----
    const UNIDADES = [["rondas", "rondas", 6], ["minutos", "minutos", 60], ["horas", "horas", 3600], ["dias", "días", 86400]];

    // «Concentración, hasta 10 minutos» → {n: 10, unidad: "minutos", conc}.
    function duracionDe(texto) {
        const t = llano(texto);
        const m = /(\d+)\s*(asalto|ronda|minuto|hora|dia)/.exec(t);
        if (!m) {
            return null;
        }
        const unidad = { asalto: "rondas", ronda: "rondas", minuto: "minutos", hora: "horas", dia: "dias" }[m[2]];
        return { n: parseInt(m[1], 10), unidad, conc: t.indexOf("concentracion") >= 0 };
    }

    function cuantoQueda(seg) {
        if (seg <= 0) {
            return "se ha acabado";
        }
        if (seg < 60) {
            const r = Math.ceil(seg / 6);
            return r + (r === 1 ? " ronda" : " rondas");
        }
        if (seg < 3600) {
            const mi = Math.ceil(seg / 60);
            return mi + (mi === 1 ? " minuto" : " minutos") + (mi <= 10 ? " (" + Math.ceil(seg / 6) + " rondas)" : "");
        }
        if (seg < 86400) {
            const minutos = Math.ceil(seg / 60);
            const h = Math.floor(minutos / 60);
            const mi = minutos % 60;
            return h + " h" + (mi ? " " + mi + " min" : "");
        }
        const horas = Math.ceil(seg / 3600);
        const di = Math.floor(horas / 24);
        const h = horas % 24;
        return di + (di === 1 ? " día" : " días") + (h ? " " + h + " h" : "");
    }

    function montarEfectos(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        d.efectos = Array.isArray(d.efectos) ? d.efectos : [];
        const leerIni = () => {
            try {
                return JSON.parse(localStorage.getItem("richi-oc-iniciativa") || "{}");
            } catch (e) {
                return {};
            }
        };
        if (d.ronda === undefined) {
            d.ronda = leerIni().ronda || 1;
        }
        // EL FORMULARIO: nombre (con los conjuros), sobre quién, cuánto
        // dura y si es de concentración.
        const form = crear("form", "master-efecto-nuevo");
        const etN = crear("label", "oc-dados-etiqueta", "qué es (un conjuro del SRD pone su duración)");
        const nombre = crear("input", "master-elegir");
        nombre.id = "master-efecto-nombre-" + m.id;
        etN.htmlFor = nombre.id;
        nombre.placeholder = "Bendecir, Armadura de mago, veneno…";
        const lista = crear("datalist");
        lista.id = "master-efecto-conjuros-" + m.id;
        nombre.setAttribute("list", lista.id);
        const sobre = elegirDe("master-efecto-sobre-" + m.id, "sobre quién", [["", "—"]], "");
        const numero = crear("input", "master-elegir");
        numero.type = "number";
        numero.min = 1;
        numero.value = 1;
        numero.setAttribute("aria-label", "Cuánto dura");
        const unidad = crear("select", "master-elegir");
        unidad.setAttribute("aria-label", "En qué");
        UNIDADES.forEach(([v, n]) => {
            const o = crear("option", "", n);
            o.value = v;
            unidad.appendChild(o);
        });
        unidad.value = "minutos";
        const etDura = crear("p", "oc-dados-etiqueta", "cuánto dura");
        etDura.setAttribute("aria-hidden", "true");
        const dura = crear("div", "master-efecto-dura");
        dura.append(numero, unidad);
        const etConc = crear("label", "master-nombres-apellido");
        const conc = crear("input");
        conc.type = "checkbox";
        etConc.append(conc, document.createTextNode(" de concentración"));
        const anadirE = crear("button", "oc-vida-accion es-principal", "＋ efecto");
        anadirE.type = "submit";
        form.append(etN, nombre, lista, sobre, etDura, dura, etConc, anadirE);
        let conjuros = [];
        pedir(CONJUROS_SRD).then((c) => {
            conjuros = c.conjuros || [];
            conjuros.filter((x) => duracionDe(x.dur || "")).forEach((x) => {
                const o = crear("option");
                o.value = x.nombre;
                lista.appendChild(o);
            });
        }).catch(() => {});
        nombre.addEventListener("change", () => {
            const c = conjuros.find((x) => llano(x.nombre) === llano(nombre.value));
            const du = c && duracionDe(c.dur || "");
            if (du) {
                numero.value = du.n;
                unidad.value = du.unidad;
                conc.checked = du.conc;
                avisar(c.nombre + ": " + c.dur + ".");
            }
        });
        // Los de la iniciativa, para «sobre quién».
        const pintarQuien = () => {
            const ahora = sobre.elegir.value;
            const nombres = (leerIni().lista || []).map((x) => x.nombre);
            sobre.elegir.replaceChildren(...[["", "—"]].concat(nombres.map((x) => [x, x])).map(([v, n]) => {
                const o = crear("option", "", n);
                o.value = v;
                return o;
            }));
            sobre.elegir.value = nombres.indexOf(ahora) >= 0 ? ahora : "";
        };
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const n = Math.max(1, parseInt(numero.value, 10) || 1);
            const seg = n * UNIDADES.find((x) => x[0] === unidad.value)[2];
            const ef = { id: Date.now().toString(36), nombre: nombre.value.trim() || "efecto", sobre: sobre.elegir.value, quedan: seg,
                total: seg, conc: conc.checked };
            d.efectos.push(ef);
            nombre.value = "";
            conc.checked = false;
            guardar();
            pintar();
            avisar("Efecto: " + ef.nombre + (ef.sobre ? " en " + ef.sobre : "") + ", " + cuantoQueda(seg) + ".");
        });
        // QUE PASE EL TIEMPO (en segundos): se descuenta a todos.
        const pasar = (seg, porque) => {
            const acaban = [];
            d.efectos.forEach((ef) => {
                if (ef.quedan > 0) {
                    ef.quedan = Math.max(0, ef.quedan - seg);
                    if (!ef.quedan) {
                        acaban.push(ef.nombre + (ef.sobre ? " en " + ef.sobre : ""));
                    }
                }
            });
            guardar();
            pintar();
            if (acaban.length) {
                avisar("Se acaba: " + acaban.join(", ") + ".");
            } else if (porque) {
                avisar(porque);
            }
        };
        const aMano = crear("div", "master-cal-tiempo");
        aMano.setAttribute("role", "group");
        aMano.setAttribute("aria-label", "Que pase el tiempo a mano");
        [["+1 ronda", 6], ["+1 minuto", 60], ["+10 minutos", 600], ["+1 hora", 3600]].forEach(([t, seg]) => {
            aMano.appendChild(botonDe("oc-vida-accion", t, () => pasar(seg, "Pasa " + t.slice(1) + ".")));
        });
        const listaE = crear("ul", "master-efectos");
        listaE.setAttribute("aria-label", "Efectos");
        const quitarAcabados = botonDe("oc-vida-accion", "🧹 quitar los acabados", () => {
            d.efectos = d.efectos.filter((x) => x.quedan > 0);
            guardar();
            pintar();
            avisar("Quitados los que se habían acabado.");
        });
        function pintar() {
            listaE.replaceChildren(...d.efectos.map((ef, i) => {
                const li = crear("li", "master-efecto" + (ef.quedan <= 0 ? " es-acabado" : ""));
                const cab = crear("p", "master-efecto-nombre");
                cab.append(crear("strong", "", ef.nombre), document.createTextNode((ef.sobre ? " · " + ef.sobre : "") + (ef.conc ? " · 🧠 concentración" : "")));
                const barra = crear("div", "master-efecto-barra");
                barra.setAttribute("role", "meter");
                barra.setAttribute("aria-valuemin", "0");
                barra.setAttribute("aria-valuemax", String(ef.total));
                barra.setAttribute("aria-valuenow", String(ef.quedan));
                barra.setAttribute("aria-valuetext", "Queda: " + cuantoQueda(ef.quedan));
                barra.setAttribute("aria-label", ef.nombre);
                const lleno = crear("span", "master-efecto-lleno");
                lleno.style.setProperty("--parte", Math.round(100 * ef.quedan / Math.max(1, ef.total)) + "%");
                barra.appendChild(lleno);
                const queda = crear("p", "master-efecto-queda", ef.quedan > 0 ? "Queda: " + cuantoQueda(ef.quedan) : "⌛ Se ha acabado");
                const quitar = botonDe("master-nombre-boton", "✕", () => {
                    d.efectos.splice(i, 1);
                    guardar();
                    pintar();
                    avisar("Quitado: " + ef.nombre + ".");
                    nombre.focus();
                }, "Quitar " + ef.nombre);
                const fila = crear("div", "master-efecto-fila");
                fila.append(cab, quitar);
                li.append(fila, barra, queda);
                return li;
            }));
            if (!d.efectos.length) {
                listaE.appendChild(crear("li", "oc-vacio", "Sin efectos. Añade uno arriba."));
            }
            quitarAcabados.hidden = !d.efectos.some((x) => x.quedan <= 0);
        }
        // Con la iniciativa: cada ronda que pasa, 6 segundos.
        const alIni = (e) => {
            if (!dentro.isConnected) {
                document.removeEventListener("oc-iniciativa:guardada", alIni);
                document.removeEventListener("master:tiempo", alTiempo);
                return;
            }
            const r = (e.detail && e.detail.ronda) || 1;
            const antes = d.ronda || 1;
            d.ronda = r;
            pintarQuien();
            if (r > antes) {
                pasar((r - antes) * 6, "Ronda " + r + ".");
            } else {
                guardar();
            }
        };
        // Con el calendario: las horas que pasan.
        const alTiempo = (e) => {
            if (!dentro.isConnected) {
                return;
            }
            const h = (e.detail && e.detail.horas) || 0;
            if (h > 0) {
                pasar(h * 3600);
            }
        };
        document.addEventListener("oc-iniciativa:guardada", alIni);
        document.addEventListener("master:tiempo", alTiempo);
        document.addEventListener("oc-iniciativa:cambio", pintarQuien);
        const etTiempo = crear("p", "oc-hoja-nota", "Se descuentan solos con las rondas de la iniciativa y el tiempo del calendario; o a mano:");
        dentro.append(form, etTiempo, aMano, listaE, quitarAcabados);
        pintarQuien();
        pintar();
    }

    // ---- NEGOCIOS: tabernas y posadas, tiendas y servicios, según lo
    // buenos que sean (pobre, modesta, acomodada, lujosa): nombre (del
    // generador o con el nombre de quien lo lleva), ambiente, quién está
    // al frente (un PNJ rápido), lo que vende con su precio, servicios y
    // un gancho. La taberna, con su carta, sus habitaciones y un rumor
    // (master-tablas.json, «taberna»); las tiendas venden los objetos del
    // SRD de tienda.json (lo de su tienda, hasta un tope según lo buenas
    // que sean; la de magia, hasta una rareza) y el resto es de tablas
    // propias (master-tablas.json, «negocios»). Se copia, se guarda como
    // texto o como imagen. ----
    function descargarArchivo(blob, archivo) {
        const a = crear("a");
        const archivoBlob = URL.createObjectURL(blob);
        a.href = archivoBlob;
        a.download = archivo;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(archivoBlob), 1000);
        avisar("Descargado: " + archivo + ".");
    }

    const precioDe = (cp) => (cp ? moneda(cp) : "a convenir");

    // Un negocio de antes (sólo taberna, en m.datos.taberna) al de ahora.
    function negocioDeTaberna(x) {
        return {
            tipo: "taberna", calidad: x.calidad, nombre: x.nombre, emoji: "🍺", ambiente: x.ambiente, quien: x.quien,
            destacado: ["⭐ Especialidad de la casa:", x.especialidad[0] + " — " + moneda(x.especialidad[1])],
            secciones: [{ titulo: "🍷 Bebidas", filas: x.bebidas }, { titulo: "🍲 Comidas", filas: x.comidas },
                { titulo: "🛏️ Habitaciones (por noche)", filas: x.habitaciones }],
            gancho: ["👂 Se oye que", x.rumor + "."],
        };
    }

    function negocioEnTexto(x, nombreTipo) {
        const lineas = [x.nombre + " — " + nombreTipo + " (" + x.calidad + ")", "",
            x.ambiente.charAt(0).toUpperCase() + x.ambiente.slice(1) + ".", "Al frente: " + x.quien + "."];
        if (x.destacado) {
            lineas.push("", x.destacado.join(" "));
        }
        x.secciones.forEach((s) => {
            lineas.push("", s.titulo.replace(/^\S+\s/u, "").toUpperCase());
            s.filas.forEach(([n, cp, extra]) => lineas.push("· " + n + ": " + precioDe(cp) + (extra ? " (" + extra + ")" : "")));
        });
        lineas.push("", x.gancho.join(" "));
        return lineas.join("\n");
    }

    // La ficha en un canvas de colores fijos (pergamino), para bajarla.
    function negocioEnLienzo(x, nombreTipo) {
        const lienzo = crear("canvas");
        const ctx = lienzo.getContext("2d");
        const ancho = 820;
        const margen = 54;
        const util = ancho - margen * 2;
        const letra = (tam, estilo) => estilo + " " + tam + "px Georgia, 'Times New Roman', serif";
        const pasos = [];
        let y = margen;
        const trocear = (texto, max) => {
            const salen = [];
            let linea = "";
            texto.split(" ").forEach((p) => {
                const prueba = linea ? linea + " " + p : p;
                if (linea && ctx.measureText(prueba).width > max) {
                    salen.push(linea);
                    linea = p;
                } else {
                    linea = prueba;
                }
            });
            salen.push(linea);
            return salen;
        };
        const parrafo = (texto, tam, estilo, color) => {
            ctx.font = letra(tam, estilo);
            trocear(texto, util).forEach((l) => {
                pasos.push({ texto: l, x: margen, y, font: ctx.font, color });
                y += Math.round(tam * 1.4);
            });
        };
        parrafo(x.emoji + " " + x.nombre, 34, "bold", "#3b2a17");
        parrafo(nombreTipo + " · " + x.calidad, 18, "italic", "#6b4e2a");
        y += 10;
        parrafo(x.ambiente.charAt(0).toUpperCase() + x.ambiente.slice(1) + ". Al frente: " + x.quien + ".", 18, "normal", "#3b2a17");
        if (x.destacado) {
            y += 6;
            parrafo(x.destacado.join(" "), 18, "bold", "#3b2a17");
        }
        x.secciones.forEach((s) => {
            y += 18;
            parrafo(s.titulo, 22, "bold", "#7a1f12");
            pasos.push({ raya: true, y: y - 4 });
            y += 6;
            s.filas.forEach(([n, cp, extra]) => {
                ctx.font = letra(18, "bold");
                const precio = precioDe(cp);
                const anchoPrecio = ctx.measureText(precio).width;
                ctx.font = letra(18, "normal");
                const lineas = trocear(n, util - anchoPrecio - 24);
                pasos.push({ texto: precio, x: ancho - margen, y, font: letra(18, "bold"), color: "#3b2a17", derecha: true });
                lineas.forEach((l) => {
                    pasos.push({ texto: l, x: margen, y, font: letra(18, "normal"), color: "#3b2a17" });
                    y += 26;
                });
                if (extra) {
                    ctx.font = letra(15, "italic");
                    trocear(extra, util - anchoPrecio - 24).forEach((l) => {
                        pasos.push({ texto: l, x: margen + 14, y, font: ctx.font, color: "#6b4e2a" });
                        y += 21;
                    });
                }
                y += 4;
            });
        });
        y += 14;
        parrafo(x.gancho.join(" "), 18, "italic", "#3b2a17");
        lienzo.width = ancho;
        lienzo.height = y + margen;
        ctx.fillStyle = "#efe2bf";
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);
        ctx.strokeStyle = "#8a6a3a";
        ctx.lineWidth = 6;
        ctx.strokeRect(14, 14, lienzo.width - 28, lienzo.height - 28);
        ctx.textBaseline = "top";
        pasos.forEach((p) => {
            if (p.raya) {
                ctx.strokeStyle = "#8a6a3a";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(margen, p.y);
                ctx.lineTo(ancho - margen, p.y);
                ctx.stroke();
                return;
            }
            ctx.font = p.font;
            ctx.fillStyle = p.color;
            ctx.textAlign = p.derecha ? "right" : "left";
            ctx.fillText(p.texto, p.x, p.y);
        });
        return lienzo;
    }

    // Servicios de lanzamiento de conjuros (SRD 5.2), en pc, por nivel.
    const PRECIO_CONJURO = [3000, 5000, 20000, 30000, 200000, 200000, 2000000, 2000000, 2000000, 10000000];

    function montarNegocio(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        Promise.all([pedir(TABLAS), pedir(NOMBRES), pedir(TIENDA), pedir(CONJUROS_SRD)]).then(([tablas, nombres, tienda, conjuros]) => {
            const d = m.datos;
            if (d.taberna && !d.negocio) {
                d.negocio = negocioDeTaberna(d.taberna);
                delete d.taberna;
            }
            const t = tablas.taberna;
            const N = tablas.negocios;
            const tipo = elegirDe("master-negocio-tipo-" + m.id, "qué negocio",
                Object.keys(N.tipos).map((k) => [k, N.tipos[k].emoji + " " + N.tipos[k].nombre]), d.tipo || "taberna");
            tipo.elegir.addEventListener("change", () => {
                d.tipo = tipo.elegir.value;
                guardar();
            });
            const calidad = botonesDe("lo bueno que es", Object.keys(N.calidades).map((k) => [k, k]),
                d.calidad || "modesta", (v) => {
                    d.calidad = v;
                    guardar();
                });
            const etCal = crear("p", "oc-dados-etiqueta", "lo bueno que es");
            etCal.setAttribute("aria-hidden", "true");
            const sale = crear("div", "master-negocio");
            sale.setAttribute("aria-live", "polite");
            const variosDe = (lista, n) => {
                const copia = lista.slice();
                const salen = [];
                while (copia.length && salen.length < n) {
                    salen.push(copia.splice(tiradaSuelta("1d" + copia.length) - 1, 1)[0]);
                }
                return salen;
            };
            const objetoDe = (nombre) => (tienda.objetos || []).find((o) => o.nombre === nombre);
            const conjuroDe = (en) => (conjuros.conjuros || []).find((c) => c.en === en);
            const fila = (o) => [o.nombre, o.cp, o.rareza || "", "o"];
            const asalariados = { cualificado: "Skilled Hireling", sin: "Untrained Hireling", mensajero: "Messenger" };
            // Los servicios: asalariados y conjuros (tabla «Servicios de
            // lanzamiento de conjuros» del SRD, más lo que cueste el
            // componente), hasta el nivel que haya según lo bueno que sea.
            const servicios = (tp, nivel) => {
                const filas = (tp.asalariados || []).map((k) => (tienda.objetos || []).find((o) => o.en === asalariados[k]))
                    .filter(Boolean).map(fila);
                (tp.conjuros || []).map(conjuroDe).filter((c) => c && c.nivel <= nivel).forEach((c) => {
                    const componente = /(\d[\d.]*) po/.exec(c.comp || "");
                    const extra = componente ? Number(componente[1].replace(/\./g, "")) * 100 : 0;
                    filas.push(["Lanzar " + c.nombre, PRECIO_CONJURO[c.nivel] + extra, (c.nivel ? "nivel " + c.nivel : "truco") +
                        (extra ? "; con el componente (" + moneda(extra) + ")" : ""), "c:" + c.en]);
                });
                return filas;
            };
            const generar = () => {
                const k = tipo.elegir.value;
                const tp = N.tipos[k];
                const cal = calidad.valor();
                const nc = N.calidades[cal];
                const g = alAzar(["f", "m"]);
                const especie = alAzar(Object.keys(nombres.especies));
                const dueno = nombreDe(nombres, especie, g, false);
                const quien = dueno + " (" + nombres.especies[especie].nombre + "), que " + alAzar(tablas.pnj.rasgos);
                const caro = (a, b) => a.cp - b.cp;
                if (k === "taberna") {
                    const tc = t.calidades[cal];
                    const deLaTaberna = (tienda.objetos || []).filter((o) => (o.tiendas || []).includes("Taberna"));
                    const deSuNivel = (o) => !/\(/.test(o.nombre) || /\(jarra|hogaza|cuña|1 día|botella\)/.test(o.nombre) ||
                        tc.estilos.some((e) => o.nombre.endsWith("(" + e + ")"));
                    const fino = cal === "acomodada" || cal === "lujosa";
                    const comer = deLaTaberna.filter((o) => o.cat !== "alojamiento" && deSuNivel(o) && (fino || o.en !== "Fine Wine (bottle)"))
                        .sort(caro).map(fila);
                    const dormir = deLaTaberna.filter((o) => o.cat === "alojamiento" && deSuNivel(o)).sort(caro).map(fila);
                    const rumor = alAzar(t.rumores);
                    d.negocio = {
                        tipo: k, calidad: cal, nombre: lugarDe(nombres, "taberna"), emoji: tp.emoji, ambiente: alAzar(tc.ambiente), quien,
                        destacado: null, secciones: [{ titulo: "🍺 Comida y bebida", filas: comer },
                            { titulo: "🛏️ Alojamiento (por noche)", filas: dormir },
                            { titulo: "🛠️ Servicios", filas: servicios(tp, nc.nivel) }],
                        gancho: ["👂 Se oye que", rumor + "."],
                    };
                } else {
                    let nombre;
                    if (alAzar([0, 1])) {
                        const [sust, gs] = alAzar(tp.sust);
                        const adj = alAzar(nombres.lugares.taberna.adj);
                        nombre = sust + " " + (gs === "f" ? adj[1] : adj[0]);
                    } else {
                        nombre = alAzar(tp.plantillas).replace("{d}", dueno);
                    }
                    const secciones = [];
                    const hay = (tienda.objetos || []).filter((o) => o.cp && (tp.objetos ? tp.objetos.includes(o.nombre)
                        : (o.tiendas || []).includes(tp.tienda)) && (k === "magia"
                        ? RAREZAS.indexOf(o.rareza) > -1 && RAREZAS.indexOf(o.rareza) < nc.rareza : !nc.tope || o.cp <= nc.tope));
                    if (hay.length) {
                        secciones.push({ titulo: "🛒 Lo que vende", filas: variosDe(hay, nc.cuantos).sort(caro).map(fila) });
                    }
                    const sv = servicios(tp, nc.nivel);
                    if (sv.length) {
                        secciones.push({ titulo: "🛠️ Servicios", filas: sv });
                    }
                    const gancho = alAzar(tp.ganchos);
                    d.negocio = {
                        tipo: k, calidad: cal, nombre, emoji: tp.emoji, ambiente: alAzar(tp.ambiente) + "; " + alAzar(nc.ambiente), quien,
                        destacado: null, secciones, gancho: ["🪝 Gancho:", gancho.charAt(0).toUpperCase() + gancho.slice(1) + "."],
                    };
                }
                guardar();
                pintar();
                avisar(tp.nombre.charAt(0).toUpperCase() + tp.nombre.slice(1) + ": " + d.negocio.nombre + ".");
            };
            const nombreTipo = () => (N.tipos[(d.negocio || {}).tipo] || N.tipos.taberna).nombre;
            const carta = (s) => {
                const sec = crear("div", "master-negocio-carta");
                sec.appendChild(crear("h4", "master-negocio-titulo", s.titulo));
                const dl = crear("dl", "master-negocio-lista");
                s.filas.forEach(([n, cp, extra, ref]) => {
                    const dt = crear("dt");
                    const c = typeof ref === "string" && ref.startsWith("c:") ? conjuroDe(ref.slice(2)) : null;
                    const o = !c && ref ? objetoDe(n) : null;
                    if (c) {
                        const ver = botonDe("master-botin-objeto", n, () => abrirConjuro(c, ver, conjuros.fuente), "Ver el conjuro " + c.nombre);
                        dt.appendChild(ver);
                    } else if (o) {
                        const ver = botonDe("master-botin-objeto", n, () => abrirObjeto(o, ver, tienda.fuente), "Ver " + n);
                        dt.appendChild(ver);
                    } else {
                        dt.textContent = n;
                    }
                    if (extra) {
                        dt.appendChild(crear("span", "master-negocio-extra", extra));
                    }
                    dl.append(dt, crear("dd", "", precioDe(cp)));
                });
                sec.appendChild(dl);
                return sec;
            };
            const acciones = crear("div", "master-negocio-acciones");
            function pintar() {
                const x = d.negocio;
                sale.replaceChildren();
                acciones.hidden = !x;
                if (!x) {
                    sale.appendChild(crear("p", "oc-vacio", "Elige el negocio, cómo es y pulsa «generar»."));
                    return;
                }
                const cab = crear("h3", "master-negocio-nombre", x.emoji + " " + x.nombre);
                const sub = crear("p", "master-negocio-tipo", nombreTipo() + " · " + x.calidad);
                const amb = crear("p", "master-negocio-ambiente", x.ambiente.charAt(0).toUpperCase() + x.ambiente.slice(1) +
                    ". Al frente: " + x.quien + ".");
                sale.append(cab, sub, amb);
                if (x.destacado) {
                    const esp = crear("p", "master-negocio-ambiente");
                    esp.append(crear("strong", "", x.destacado[0] + " "), document.createTextNode(x.destacado[1]));
                    sale.appendChild(esp);
                }
                x.secciones.forEach((s) => sale.appendChild(carta(s)));
                const gancho = crear("p", "master-negocio-ambiente");
                gancho.append(crear("strong", "", x.gancho[0] + " "), document.createTextNode(x.gancho[1]));
                sale.appendChild(gancho);
            }
            const archivo = (ext) => (d.negocio.nombre || "negocio").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() + "." + ext;
            acciones.append(
                botonDe("oc-vida-accion", "⧉ copiar", () => copiarTexto(negocioEnTexto(d.negocio, nombreTipo()), "Copiado."),
                    "Copiar el negocio como texto"),
                botonDe("oc-vida-accion", "📄 guardar como texto", () => descargarArchivo(new Blob([negocioEnTexto(d.negocio,
                    nombreTipo())], { type: "text/plain;charset=utf-8" }), archivo("txt"))),
                botonDe("oc-vida-accion", "🖼️ guardar como imagen", () => negocioEnLienzo(d.negocio, nombreTipo())
                    .toBlob((blob) => descargarArchivo(blob, archivo("png")), "image/png")));
            const boton = botonDe("oc-vida-accion es-principal master-nombres-generar", "🎲 generar negocio", generar);
            const arriba = crear("div", "master-nombres-form");
            arriba.append(tipo, etCal, calidad, boton);
            dentro.replaceChildren(arriba, sale, acciones, crear("p", "oc-hoja-nota master-fuente",
                "Lo que venden, los servicios y sus precios: SRD 5.2 (CC BY 4.0). Nombres, ambientes, rumores y ganchos: tablas propias."));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar las tablas."));
        });
    }

    // ---- UNA TABLA PARA TIRAR: una cosa por línea; «tirar» saca una al
    // azar (encuentros, nombres, el tiempo que hace…) ----
    function montarTabla(dentro, m) {
        m.datos = m.datos || {};
        const etX = crear("label", "oc-dados-etiqueta", "lo que puede salir (una cosa por línea)");
        const texto = crear("textarea", "oc-notas-texto es-corta");
        texto.id = "master-tabla-texto-" + m.id;
        texto.rows = 6;
        texto.value = m.datos.texto || "";
        etX.htmlFor = texto.id;
        const sale = crear("p", "master-tabla-sale");
        sale.setAttribute("role", "status");
        let espera = 0;
        const alEscribir = () => {
            clearTimeout(espera);
            espera = setTimeout(() => {
                m.datos.texto = texto.value;
                guardar();
            }, 400);
        };
        texto.addEventListener("input", alEscribir);
        const tirar = botonDe("oc-vida-accion es-principal", "🎲 tirar en la tabla", () => {
            const cosas = texto.value.split("\n").map((x) => x.trim()).filter(Boolean);
            if (!cosas.length) {
                sale.textContent = "Escribe primero lo que puede salir.";
                return;
            }
            const u = new Uint32Array(1);
            crypto.getRandomValues(u);
            const i = u[0] % cosas.length;
            sale.textContent = "";
            setTimeout(() => {
                sale.textContent = (i + 1) + " de " + cosas.length + ": " + cosas[i];
            }, 50);
        });
        dentro.append(etX, texto, tirar, sale);
    }

    // ---- EL BESTIARIO: los monstruos del SRD 5.2 (D&D 2024), traducidos
    // (datos/personajes/compendio/bestiario.json). Se buscan por nombre
    // (en español o en inglés), VD y tipo; cada uno abre su perfil en una
    // ventana, con «＋ a la iniciativa» (tira su iniciativa y lo apunta con
    // su CA y sus PG en «richi-oc-iniciativa»). ----
    const VDS = ["0", "1/8", "1/4", "1/2"].concat(Array.from({ length: 30 }, (x, i) => String(i + 1)));

    // «Lobo», y si ya hay uno, «Lobo 1» y «Lobo 2» (y «Lobo 3»…). «lista»
    // son los nombres que ya hay; «renombrar(viejo, nuevo)» cambia el que
    // estaba sin número.
    function conNumero(base, nombres, renombrar) {
        const patron = new RegExp("^" + base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?: (\\d+))?$");
        const iguales = nombres.map((n) => patron.exec(n)).filter(Boolean);
        if (!iguales.length) {
            return base;
        }
        let mayor = Math.max(0, ...iguales.map((x) => parseInt(x[1] || "0", 10)));
        if (iguales.some((x) => !x[1]) && renombrar) {
            // El que no tenía número, el 1 (o el siguiente, si ya hay un 1).
            const ya = iguales.some((x) => x[1] === "1");
            renombrar(base, base + " " + (ya ? mayor + 1 : 1));
            mayor = ya ? mayor + 1 : Math.max(mayor, 1);
        }
        return base + " " + (mayor + 1);
    }

    // Apuntar a alguien en la iniciativa («richi-oc-iniciativa»): tira
    // 1d20 + su bono y avisa a la ventana de la iniciativa. «c»: {nombre,
    // bono, ca, pg, color}. Devuelve el nombre con el que entra, o null.
    function meterEnIniciativa(c, numerar) {
        const CLAVE_INI = "richi-oc-iniciativa";
        let datos = { lista: [], turno: -1, ronda: 1 };
        try {
            datos = Object.assign(datos, JSON.parse(localStorage.getItem(CLAVE_INI) || "{}"));
        } catch (e) {
            // Sin almacenamiento: no se puede apuntar.
        }
        const nombres = datos.lista.map((x) => x.nombre);
        let nombre = c.nombre;
        if (numerar) {
            nombre = numerar(nombres, (viejo, nuevo) => {
                datos.lista.forEach((x) => {
                    if (x.nombre === viejo) {
                        x.nombre = nuevo;
                    }
                });
            });
        } else if (nombres.indexOf(nombre) >= 0) {
            return null;
        }
        const bono = parseInt(c.bono, 10) || 0;
        const r = window.ocDados ? window.ocDados.tirar("1d20" + (bono ? (bono > 0 ? "+" : "") + bono : ""),
            "iniciativa de " + nombre) : null;
        datos.lista.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nombre, color: c.color,
            ini: r ? r.total : 10 + bono, ca: parseInt(c.ca, 10) || "", pg: c.pg === undefined ? "" : c.pg });
        try {
            localStorage.setItem(CLAVE_INI, JSON.stringify(datos));
        } catch (e) {
            // Sin almacenamiento: da igual.
        }
        document.dispatchEvent(new CustomEvent("oc-iniciativa:cambio"));
        return nombre;
    }

    function aLaIniciativa(b, boton, nombreBase) {
        // Una del tablero va con su nombre («Lobo 2», «Elminster») si no
        // está ya; si no, con número si se repite (Lobo 1, Lobo 2…).
        const nombre = meterEnIniciativa({ nombre: nombreBase || b.nombre, bono: b.ini, ca: b.ca, pg: b.pg || "",
            color: "#d23b3b" }, (nombres, renombrar) => (nombreBase && nombres.indexOf(nombreBase) < 0 ? nombreBase
            : conNumero(b.nombre, nombres, renombrar)));
        avisar("A la iniciativa: " + nombre + ".");
        if (boton) {
            boton.focus();
        }
    }

    // Un «Des +3, Sab +6» con cada bono como botón que tira 1d20+bono.
    function bonosQueSeTiran(texto, que) {
        const dd = crear("dd", "master-bicho-bonos");
        texto.split(/,\s*/).forEach((trozo, i) => {
            const m = /^(.*?)\s*([+−-]\d+)$/.exec(trozo);
            if (i) {
                dd.appendChild(document.createTextNode(", "));
            }
            if (!m || !window.ocDadoBoton) {
                dd.appendChild(document.createTextNode(trozo));
                return;
            }
            dd.appendChild(document.createTextNode(m[1] + " "));
            const n = parseInt(m[2].replace("−", "-"), 10);
            dd.appendChild(window.ocDadoBoton(m[2], "1d20" + (n >= 0 ? "+" : "") + n, que + " de " + m[1]));
        });
        return dd;
    }

    // LAS CASILLAS DE USOS: un cuadrado por uso (marcado = gastado), que
    // se marca y desmarca al pulsarlo. «usos» guarda cuántos lleva
    // gastados cada cosa (en una criatura del tablero, en su ventana; en
    // la ventana del bestiario, solo mientras está abierta).
    function casillas(usos, clave, n, que, alCambiar) {
        const caja = crear("span", "master-usos");
        caja.setAttribute("role", "group");
        caja.setAttribute("aria-label", "Usos de " + que);
        const pintar = () => {
            caja.replaceChildren(...Array.from({ length: n }, (x, i) => {
                const gastado = i < (usos[clave] || 0);
                const b = botonDe("master-uso", "", () => {
                    usos[clave] = gastado ? i : i + 1;
                    pintar();
                    alCambiar();
                    caja.querySelectorAll(".master-uso")[i].focus();
                    avisar(que + ": " + (usos[clave] || 0) + " de " + n + " gastados.");
                }, que + ", uso " + (i + 1) + " de " + n);
                b.setAttribute("aria-pressed", gastado ? "true" : "false");
                return b;
            }));
        };
        caja.repintar = pintar;
        pintar();
        return caja;
    }

    // Las acciones de ataque, en tabla (como en las fichas): ataque, bono,
    // alcance y daño; lo que hace además, debajo del daño.
    function tablaDeAtaques(lista) {
        const filas = [];
        lista.forEach((r) => {
            const m = /^\*(Ataque[^:*]*):\* ([+−-]\d+), ([^*]+?) \*Impacto:\* (.*)$/s.exec(r.t);
            if (!m) {
                return;
            }
            const resto = m[4];
            const corte = resto.search(/\.(\s|$)/);
            filas.push({ r, tipo: m[1].replace(/^Ataque /, ""), bono: m[2], alcance: m[3],
                dano: corte >= 0 ? resto.slice(0, corte + 1) : resto, efecto: corte >= 0 ? resto.slice(corte + 1).trim() : "" });
        });
        if (!filas.length) {
            return null;
        }
        const tabla = crear("table", "master-ataques");
        tabla.appendChild(crear("caption", "visually-hidden", "Ataques"));
        const cab = crear("tr");
        ["Ataque", "Bono", "Alcance", "Daño"].forEach((t) => {
            const th = crear("th", "", t);
            th.scope = "col";
            cab.appendChild(th);
        });
        const thead = crear("thead");
        thead.appendChild(cab);
        const tbody = crear("tbody");
        filas.forEach((x) => {
            const tr = crear("tr");
            const th = crear("th", "master-ataque-nombre");
            th.scope = "row";
            th.append(crear("strong", "", x.r.n), crear("span", "master-ataque-tipo", x.tipo));
            const n = parseInt(x.bono.replace("−", "-"), 10);
            const tdB = crear("td");
            tdB.appendChild(window.ocDadoBoton ? window.ocDadoBoton(x.bono, "1d20" + (n >= 0 ? "+" : "") + n, x.r.n + " · ataque")
                : document.createTextNode(x.bono));
            const tdA = crear("td", "", x.alcance);
            const tdD = crear("td");
            tdD.appendChild(markdown(x.dano + (x.efecto ? "\n\n" + x.efecto : "")));
            tr.append(th, tdB, tdA, tdD);
            tbody.appendChild(tr);
        });
        tabla.append(thead, tbody);
        tabla.atacantes = filas.map((x) => x.r);
        return tabla;
    }

    // EL PERFIL DE UN MONSTRUO, por pestañas: estadísticas, rasgos,
    // acciones (los ataques en tabla), bonus, reacciones, legendarias y
    // hechizos. Con casillas para lo que se gasta: lo que se recarga (con
    // «🎲» para tirar la recarga), lo de x/día, las acciones legendarias y
    // los conjuros de x/día.
    function perfil(b, f, alTablero, guardado) {
        // El nombre que tiene en el tablero (se cambia con ✎: el «Mago»
        // puede ser Elminster); si no, el suyo.
        const quien = () => (guardado && guardado.nombre && guardado.nombre()) || b.nombre;
        const usos = (guardado && guardado.usos) || {};
        const alCambiar = () => {
            if (guardado) {
                guardado.usos = usos;
                guardado.guardar();
            }
        };
        const repintables = [];
        const caja = crear("div", "master-bicho");
        const tipo = crear("p", "master-bicho-tipo", b.tipo + ", " + b.alin);
        const cabeza = crear("div", "master-bicho-cabeza");
        cabeza.append(tokenDe(b, true), tipo);
        caja.appendChild(cabeza);
        if (guardado && guardado.nombre) {
            // En el tablero, qué es de verdad (si se le ha cambiado el
            // nombre) y un botón para cambiárselo.
            const cambiar = botonDe("master-bicho-renombrar", "✎ nombre", () => guardado.renombrar(cambiar),
                "Cambiar el nombre de " + quien());
            cambiar.setAttribute("aria-haspopup", "dialog");
            tipo.prepend(crear("strong", "", b.nombre + " · "));
            tipo.appendChild(cambiar);
        }
        const fila = (dl, que, valor) => {
            if (valor === undefined || valor === "") {
                return;
            }
            dl.append(crear("dt", "", que), crear("dd", "", String(valor)));
        };
        const sumar = botonDe("oc-vida-accion es-principal", "＋ a la iniciativa", () => aLaIniciativa(b, sumar, quien()),
            "Añadir " + quien() + " a la iniciativa (tira su iniciativa)");
        const botones = crear("div", "master-bicho-botones");
        botones.appendChild(sumar);
        if (alTablero) {
            botones.appendChild(botonDe("oc-vida-accion", "📌 al tablero", alTablero, "Poner " + b.nombre + " en el tablero, como una ventana"));
        }
        const recuperar = botonDe("oc-vida-accion", "↺ recuperar usos", () => {
            Object.keys(usos).forEach((k) => delete usos[k]);
            repintables.forEach((r) => r.repintar());
            alCambiar();
            avisar("Usos recuperados.");
        }, "Recuperar todos los usos (descanso largo)");
        botones.appendChild(recuperar);
        caja.appendChild(botones);

        // ---- estadísticas ----
        const stats = crear("div", "master-bicho-panel");
        const arriba = crear("dl", "master-bicho-datos");
        fila(arriba, "CA", b.ca);
        fila(arriba, "Iniciativa", b.ini);
        fila(arriba, "PG", b.pg + (b.pgf ? " (" + b.pgf + ")" : ""));
        fila(arriba, "Velocidad", b.vel);
        const tabla = crear("table", "master-bicho-car");
        tabla.appendChild(crear("caption", "visually-hidden", "Características"));
        const cab = crear("tr");
        const val = crear("tr");
        Object.keys(b.car).forEach((k) => {
            const th = crear("th", "", k);
            th.scope = "col";
            cab.appendChild(th);
            const n = b.car[k];
            const mo = Math.floor((n - 10) / 2);
            const td = crear("td", "", n + " ");
            const bono = (mo >= 0 ? "+" : "−") + Math.abs(mo);
            td.appendChild(window.ocDadoBoton ? window.ocDadoBoton("(" + bono + ")", "1d20" + (mo >= 0 ? "+" : "") + mo,
                "prueba de " + k) : document.createTextNode("(" + bono + ")"));
            val.appendChild(td);
        });
        const thead = crear("thead");
        thead.appendChild(cab);
        const tbody = crear("tbody");
        tbody.appendChild(val);
        tabla.append(thead, tbody);
        const abajo = crear("dl", "master-bicho-datos");
        if (b.salv) {
            abajo.append(crear("dt", "", "Salvaciones"), bonosQueSeTiran(b.salv, "salvación"));
        }
        if (b.hab) {
            abajo.append(crear("dt", "", "Habilidades"), bonosQueSeTiran(b.hab, "prueba"));
        }
        fila(abajo, "Vulnerabilidades", b.vuln);
        fila(abajo, "Resistencias", b.res);
        fila(abajo, "Inmunidades", [b.inm, b.inmE].filter(Boolean).join("; "));
        fila(abajo, "Equipo", b.equipo);
        fila(abajo, "Sentidos", b.sent);
        fila(abajo, "Idiomas", b.idio);
        fila(abajo, "VD", b.vd);
        fila(abajo, "Hábitat", (b.habitat || []).join(", "));
        stats.append(arriba, tabla, abajo);

        // Un rasgo o acción: su nombre en negrita (con sus casillas si se
        // gasta) y su texto.
        const entrada = (r, seccion) => {
            const div = crear("div", "master-bicho-entrada");
            const cabeza = crear("p", "master-bicho-nombre");
            cabeza.appendChild(crear("strong", "", r.n));
            const rec = /Recarga (\d)(?:–6)?/.exec(r.n);
            const dia = /\((\d+)\/día/.exec(r.n);
            if (rec) {
                const clave = seccion + ":" + r.n;
                const c = casillas(usos, clave, 1, r.n, alCambiar);
                repintables.push(c);
                const desde = parseInt(rec[1], 10);
                const tirarRecarga = botonDe("master-recarga", "🎲 recarga", () => {
                    const t = window.ocDados ? window.ocDados.tirar("1d6", "recarga de " + r.n) : null;
                    if (t && t.total >= desde) {
                        usos[clave] = 0;
                        c.repintar();
                        alCambiar();
                        avisar(r.n + ": recargada (" + t.total + ").");
                    } else if (t) {
                        avisar(r.n + ": sin recargar (" + t.total + ").");
                    }
                }, "Tirar la recarga de " + r.n + " (" + desde + " o más en 1d6)");
                cabeza.append(c, tirarRecarga);
            } else if (dia) {
                const c = casillas(usos, seccion + ":" + r.n, parseInt(dia[1], 10), r.n, alCambiar);
                repintables.push(c);
                cabeza.appendChild(c);
            }
            div.append(cabeza, markdown(r.t));
            return div;
        };
        const paneles = [["estadísticas", stats]];
        if (b.rasgos && b.rasgos.length) {
            const panel = crear("div", "master-bicho-panel");
            b.rasgos.forEach((r) => panel.appendChild(entrada(r, "rasgos")));
            paneles.push(["rasgos", panel]);
        }
        // LAS ACCIONES: acciones, adicionales, reacciones y legendarias en
        // una pestaña, con un desplegable para elegir cuáles se ven.
        const partes = [];
        [["acciones", "acciones"], ["adicionales", "acciones adicionales"], ["reacciones", "reacciones"],
            ["legendarias", "legendarias"]].forEach(([k, titulo]) => {
            if (!b[k] || !b[k].length) {
                return;
            }
            const parte = crear("div", "master-bicho-parte");
            let lista = b[k];
            if (k === "legendarias" && b.legInfo) {
                const cuantas = parseInt((/Usos de acción legendaria:\* (\d+)/.exec(b.legInfo) || [])[1], 10) || 3;
                const p = crear("p", "master-bicho-nombre");
                p.appendChild(crear("strong", "", "Usos"));
                const c = casillas(usos, "legendarias", cuantas, "acciones legendarias", alCambiar);
                repintables.push(c);
                p.appendChild(c);
                parte.append(p, markdown(b.legInfo));
            }
            if (k === "acciones" || k === "adicionales") {
                const t = tablaDeAtaques(lista);
                if (t) {
                    parte.appendChild(t);
                    lista = lista.filter((r) => t.atacantes.indexOf(r) < 0);
                }
            }
            lista.forEach((r) => parte.appendChild(entrada(r, k)));
            partes.push([titulo, parte]);
        });
        const uid = "bicho-" + Math.random().toString(36).slice(2, 8);
        if (partes.length) {
            const panel = crear("div", "master-bicho-panel");
            let deAhora = (guardado && guardado.parte) || 0;
            if (deAhora >= partes.length) {
                deAhora = 0;
            }
            if (partes.length > 1) {
                const fila = crear("div", "master-bicho-ver");
                const etVer = crear("label", "oc-dados-etiqueta", "ver");
                const ver = crear("select", "oc-dados-elegir");
                ver.id = uid + "-ver";
                etVer.htmlFor = ver.id;
                partes.forEach(([titulo], i) => {
                    const o = crear("option", "", titulo);
                    o.value = String(i);
                    ver.appendChild(o);
                });
                ver.value = String(deAhora);
                ver.addEventListener("change", () => {
                    const i = parseInt(ver.value, 10) || 0;
                    partes.forEach(([, parte], j) => {
                        parte.hidden = j !== i;
                    });
                    if (guardado) {
                        guardado.parte = i;
                        guardado.guardar();
                    }
                });
                fila.append(etVer, ver);
                panel.appendChild(fila);
            }
            partes.forEach(([, parte], j) => {
                parte.hidden = j !== deAhora;
                panel.appendChild(parte);
            });
            paneles.push(["acciones", panel]);
        }
        if (b.conjuros) {
            const panel = crear("div", "master-bicho-panel");
            panel.appendChild(markdown(b.conjuros.t));
            panel.appendChild(crear("p", "oc-hoja-nota", "Se lanzan como " + b.conjuros.donde + "."));
            b.conjuros.listas.forEach((l, i) => {
                const div = crear("div", "master-bicho-entrada");
                const cabeza = crear("p", "master-bicho-nombre");
                cabeza.appendChild(crear("strong", "", l.et));
                if (l.usos && !l.cada) {
                    const c = casillas(usos, "conj:" + i, l.usos, l.et, alCambiar);
                    repintables.push(c);
                    cabeza.appendChild(c);
                }
                const ul = crear("ul", "master-bicho-conjuros");
                l.conj.forEach((cj) => {
                    const li = crear("li");
                    const nombre = crear("span", "master-bicho-conjuro", cj.es);
                    nombre.dataset.en = cj.en || "";
                    li.appendChild(nombre);
                    if (cj.nota) {
                        li.appendChild(document.createTextNode(" " + cj.nota));
                    }
                    if (l.usos && l.cada) {
                        const c = casillas(usos, "conj:" + i + ":" + cj.es, l.usos, cj.es, alCambiar);
                        repintables.push(c);
                        li.appendChild(c);
                    }
                    ul.appendChild(li);
                });
                div.append(cabeza, ul);
                panel.appendChild(div);
            });
            // Cada conjuro, a su ventana.
            pedir(CONJUROS_SRD).then((datos) => {
                const porEn = {};
                (datos.conjuros || []).forEach((c) => {
                    porEn[c.en] = c;
                });
                panel.querySelectorAll(".master-bicho-conjuro").forEach((sp) => {
                    const c = porEn[sp.dataset.en];
                    if (c) {
                        sp.replaceWith(botonConjuro(c, sp.textContent, datos.fuente));
                    }
                });
            }).catch(() => {});
            paneles.push(["hechizos", panel]);
        }

        paneles.push(["imagen", panelImagen("monstruo:" + b.en, b.nombre, b.ilus, b.ilusDe, b.en)]);

        // LAS PESTAÑAS: estadísticas, rasgos, acciones, hechizos (las que
        // tenga) e imagen, con las flechas para ir de una a otra.
        let actual = (guardado && guardado.pestana) || 0;
        if (actual >= paneles.length) {
            actual = 0;
        }
        const lista = crear("div", "master-bicho-pestanas");
        lista.setAttribute("role", "tablist");
        lista.setAttribute("aria-label", "Partes del perfil de " + quien());
        const pestanas = paneles.map(([titulo, panel], i) => {
            const t = botonDe("master-bicho-pestana", titulo, () => elegir(i, false));
            t.setAttribute("role", "tab");
            t.id = uid + "-t" + i;
            panel.id = uid + "-p" + i;
            t.setAttribute("aria-controls", panel.id);
            panel.setAttribute("role", "tabpanel");
            panel.setAttribute("aria-labelledby", t.id);
            panel.tabIndex = 0;
            t.addEventListener("keydown", (e) => {
                const d = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: paneles.length - 1 - i }[e.key];
                if (d === undefined) {
                    return;
                }
                e.preventDefault();
                elegir((i + d + paneles.length) % paneles.length, true);
            });
            lista.appendChild(t);
            return t;
        });
        function elegir(i, foco) {
            actual = i;
            pestanas.forEach((t, j) => {
                t.setAttribute("aria-selected", j === i ? "true" : "false");
                t.tabIndex = j === i ? 0 : -1;
            });
            paneles.forEach(([, panel], j) => {
                panel.hidden = j !== i;
            });
            if (foco) {
                pestanas[i].focus();
            }
            if (guardado) {
                guardado.pestana = i;
                guardado.guardar();
            }
        }
        caja.appendChild(lista);
        paneles.forEach(([, panel]) => caja.appendChild(panel));
        elegir(actual, false);
        enlazarConjuros(caja);
        if (f) {
            caja.appendChild(crear("p", "oc-hoja-nota master-fuente", f));
        }
        return caja;
    }

    // Una criatura del bestiario puesta en el tablero (📌): su perfil en
    // una ventana, a mano durante el combate.
    function montarCriatura(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        pedir("/datos/personajes/compendio/bestiario.json").then((datos) => {
            const b = (datos.monstruos || []).find((x) => x.en === m.datos.en);
            const guardado = { usos: m.datos.usos || {}, pestana: m.datos.pestana || 0, parte: m.datos.parte || 0,
                guardar() {
                    m.datos.usos = guardado.usos;
                    m.datos.pestana = guardado.pestana;
                    m.datos.parte = guardado.parte;
                    guardar();
                },
                // Su nombre es el título de la ventana (✎ nombre lo cambia,
                // como el ✎ de la barra).
                nombre: () => m.titulo || (b && b.nombre) || "",
                renombrar: (vuelta) => personalizar(m, vuelta) };
            const pintarla = () => {
                const foco = dentro.contains(document.activeElement) ? document.activeElement.className : "";
                dentro.replaceChildren(b ? perfil(b, "", null, guardado) : crear("p", "oc-vacio", "No encuentro esa criatura."));
                const otro = foco && dentro.querySelector("." + foco.split(" ")[0]);
                if (otro) {
                    otro.focus();
                }
            };
            m.alRenombrar = pintarla;
            pintarla();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar el bestiario."));
        });
    }

    // EL TOKEN DE UN MONSTRUO: una ficha redonda hecha aquí (no son las
    // ilustraciones de 5e.tools, que no se pueden copiar), con el dibujo de
    // su tipo, el borde del color de su tipo y más grande cuanto mayor es.
    const TOKENS = { Aberración: ["👁️", "#8e5bd6"], Bestia: ["🐾", "#3fae5a"], Celestial: ["😇", "#e6c229"],
        Autómata: ["⚙️", "#8a8a99"], Dragón: ["🐉", "#d23b3b"], Elemental: ["🌪️", "#3bb3c9"], Feérico: ["🧚", "#e05aa8"],
        Infernal: ["😈", "#b3261e"], Gigante: ["🗿", "#a06a3b"], Humanoide: ["🧑", "#3b7ddd"], Monstruosidad: ["🦂", "#e88a2a"],
        Muerto: ["💀", "#5f6b7a"], Enjambre: ["🐝", "#9a8a2a"], Planta: ["🌿", "#2f9e4f"], Cieno: ["🫧", "#5aa88f"] };
    const TAMANOS = { Diminuto: 1, Diminutos: 1, Diminutas: 1, Pequeño: 2, Mediano: 3, Grande: 4, Enorme: 5, Gargantuesco: 6 };

    function tokenDe(b, grande) {
        const tipo = b.tipo.split(" (")[0].split(" ")[0];
        const [emoji, color] = TOKENS[tipo] || ["❔", "#8a8a99"];
        const tam = TAMANOS[b.tipo.split(" ").pop()] || 3;
        const t = crear("span", "master-token es-tam-" + tam + (grande ? " es-grande" : ""), emoji);
        t.style.setProperty("--token", color);
        t.setAttribute("aria-hidden", "true");
        return t;
    }

    // Un monstruo en su ventana, con «📌 al tablero» (que lo deja como
    // ventana, con número si ya hay otro igual: Lobo 1, Lobo 2…).
    function abrirBicho(b, vuelta, fuente) {
        const cerrar = window.ocVentana.abrir({ titulo: b.nombre, vuelta, clase: "es-regla",
            cuerpo: perfil(b, fuente, () => {
                cerrar();
                const titulo = conNumero(b.nombre, estado.modulos.filter((m) => m.tipo === "criatura")
                    .map((m) => m.titulo || ""), (viejo, nuevo) => {
                    estado.modulos.forEach((m) => {
                        if (m.tipo === "criatura" && m.titulo === viejo) {
                            m.titulo = nuevo;
                            ponerTitulo(m);
                        }
                    });
                });
                anadir("criatura", { titulo, datos: { en: b.en }, w: 440, h: 520 });
            }) });
    }

    function montarBestiario(dentro, m) {
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando el bestiario…"));
        pedir("/datos/personajes/compendio/bestiario.json").then((datos) => {
            const bichos = (datos.monstruos || []).map((b) => ({ b, buscar: llano(b.nombre + " " + b.en + " " + b.tipo) }));
            const fila = crear("div", "master-conjuros-buscar es-bestiario");
            const et = crear("label", "oc-dados-etiqueta", "buscar");
            const input = crear("input", "oc-dados-texto");
            input.type = "search";
            input.id = "master-bichos-" + m.id;
            input.placeholder = "goblin, dragón, owlbear…";
            et.htmlFor = input.id;
            const etVd = crear("label", "oc-dados-etiqueta", "VD");
            const vd = crear("select", "oc-dados-elegir");
            vd.id = "master-bichos-vd-" + m.id;
            etVd.htmlFor = vd.id;
            [""].concat(VDS).forEach((v) => {
                const o = crear("option", "", v || "todos");
                o.value = v;
                vd.appendChild(o);
            });
            const etTipo = crear("label", "oc-dados-etiqueta", "tipo");
            const tipo = crear("select", "oc-dados-elegir");
            tipo.id = "master-bichos-tipo-" + m.id;
            etTipo.htmlFor = tipo.id;
            const tipos = Array.from(new Set(bichos.map((x) => x.b.tipo.split(/[ (]/)[0]))).sort();
            [""].concat(tipos).forEach((v) => {
                const o = crear("option", "", v || "todos");
                o.value = v;
                tipo.appendChild(o);
            });
            const cuantos = crear("p", "oc-hoja-nota");
            cuantos.setAttribute("role", "status");
            const lista = crear("ul", "master-conjuros");
            fila.append(et, input, etVd, vd, etTipo, tipo);
            const pintar = () => {
                const q = llano(input.value.trim());
                const salen = bichos.filter((x) => (!q || x.buscar.includes(q)) && (!vd.value || x.b.cr === vd.value)
                    && (!tipo.value || x.b.tipo.indexOf(tipo.value) === 0));
                lista.replaceChildren(...salen.slice(0, 60).map((x) => {
                    const li = crear("li");
                    const b = botonDe("master-conjuro", "", () => abrirBicho(x.b, b, datos.fuente));
                    b.setAttribute("aria-haspopup", "dialog");
                    b.classList.add("con-token");
                    b.append(tokenDe(x.b), crear("span", "master-conjuro-nombre", x.b.nombre),
                        crear("span", "master-conjuro-datos", "VD " + x.b.cr + " · " + x.b.tipo + " · CA " + parseInt(x.b.ca, 10)
                            + " · " + x.b.pg + " PG"));
                    li.appendChild(b);
                    return li;
                }));
                cuantos.textContent = salen.length ? salen.length + (salen.length === 1 ? " monstruo" : " monstruos")
                    + (salen.length > 60 ? " (salen los 60 primeros)" : "") : "Ningún monstruo con eso.";
            };
            let espera = 0;
            input.addEventListener("input", () => {
                clearTimeout(espera);
                espera = setTimeout(pintar, 150);
            });
            vd.addEventListener("change", pintar);
            tipo.addEventListener("change", pintar);
            dentro.replaceChildren(fila, cuantos, lista, crear("p", "oc-hoja-nota master-fuente", datos.fuente || ""));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar el bestiario."));
        });
    }

    // ---- LA TIENDA: los objetos del SRD 5.2 con su precio
    // (datos/personajes/compendio/tienda.json), por tienda, categoría y
    // rareza, con los precios al gusto (de saldo… abusivos) y un «surtido
    // al azar» que se queda guardado (lo que hay hoy en esa tienda). ----
    const RAREZAS = ["común", "poco común", "rara", "muy rara", "legendaria"];

    function moneda(cp) {
        const total = Math.round(cp);
        const po = Math.floor(total / 100);
        const pp = Math.floor((total % 100) / 10);
        const pc = total % 10;
        const trozos = [];
        if (po) {
            trozos.push(po.toLocaleString("es-ES") + " po");
        }
        if (pp) {
            trozos.push(pp + " pp");
        }
        if (pc || !trozos.length) {
            trozos.push(pc + " pc");
        }
        return trozos.join(" ");
    }

    function montarTienda(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Abriendo la tienda…"));
        pedir("/datos/personajes/compendio/tienda.json").then((datos) => {
            const objetos = (datos.objetos || []).map((o) => ({ o, buscar: llano(o.nombre + " " + o.en + " " + o.cat) }));
            const elegir = (id, texto, opciones, valor) => {
                const et = crear("label", "oc-dados-etiqueta", texto);
                const sel = crear("select", "oc-dados-elegir");
                sel.id = id + m.id;
                et.htmlFor = sel.id;
                opciones.forEach(([v, t]) => {
                    const op = crear("option", "", t);
                    op.value = v;
                    sel.appendChild(op);
                });
                sel.value = valor || "";
                return [et, sel];
            };
            const [etTienda, tienda] = elegir("master-tienda-", "tienda",
                [["", "todas"]].concat((datos.tiendas || []).map((t) => [t, t])), m.datos.tienda);
            const [etCat, cat] = elegir("master-tienda-cat-", "categoría", [["", "todas"]], "");
            const [etRareza, rareza] = elegir("master-tienda-rareza-", "rareza",
                [["", "todas"]].concat(RAREZAS.map((r) => [r, r])), m.datos.rareza);
            // El precio de la tienda, en %: 100 es lo normal; 80, un 20 % más
            // barato; 150, la mitad más caro. (Lo de antes, ×1,5…, pasa a %.)
            if (m.datos.porc === undefined && m.datos.precio) {
                m.datos.porc = Math.round(parseFloat(m.datos.precio) * 100) || 100;
            }
            const etPrecio = crear("label", "oc-dados-etiqueta", "precios (%)");
            const precio = crear("input", "oc-dados-texto");
            precio.type = "number";
            precio.min = "0";
            precio.max = "1000";
            precio.step = "5";
            precio.inputMode = "numeric";
            precio.value = String(m.datos.porc || 100);
            precio.id = "master-tienda-precio-" + m.id;
            precio.setAttribute("aria-describedby", "master-tienda-precio-ayuda-" + m.id);
            etPrecio.htmlFor = precio.id;
            const ayudaPrecio = crear("p", "oc-hoja-nota master-tienda-ayuda", "100 = normal; 80 = un 20 % más barato; 150 = la mitad más caro.");
            ayudaPrecio.id = "master-tienda-precio-ayuda-" + m.id;
            const etBuscar = crear("label", "oc-dados-etiqueta", "buscar");
            const buscar = crear("input", "oc-dados-texto");
            buscar.type = "search";
            buscar.id = "master-tienda-buscar-" + m.id;
            buscar.placeholder = "cuerda, poción, espada…";
            etBuscar.htmlFor = buscar.id;
            const campos = crear("div", "master-tienda-campos");
            [[etTienda, tienda], [etCat, cat], [etRareza, rareza], [etPrecio, precio], [etBuscar, buscar]].forEach(([e, c]) => {
                const caja = crear("div", "master-tienda-campo" + (c === buscar ? " es-ancho" : ""));
                caja.append(e, c);
                if (c === precio) {
                    caja.appendChild(ayudaPrecio);
                }
                campos.appendChild(caja);
            });
            // El surtido: unos cuantos al azar de lo que se ve (y se guarda).
            const cuantosAzar = crear("input", "oc-dados-texto master-tienda-cuantos");
            cuantosAzar.type = "number";
            cuantosAzar.min = "1";
            cuantosAzar.max = "40";
            cuantosAzar.value = String(m.datos.cuantos || 8);
            cuantosAzar.id = "master-tienda-cuantos-" + m.id;
            const etCuantos = crear("label", "oc-dados-etiqueta", "cuántos");
            etCuantos.htmlFor = cuantosAzar.id;
            const azar = botonDe("oc-vida-accion es-principal", "🎲 surtido al azar", () => {
                const n = Math.max(1, Math.min(40, parseInt(cuantosAzar.value, 10) || 8));
                const pool = filtrados(false).slice();
                const u = new Uint32Array(pool.length);
                crypto.getRandomValues(u);
                for (let i = pool.length - 1; i > 0; i -= 1) {
                    const j = u[i] % (i + 1);
                    [pool[i], pool[j]] = [pool[j], pool[i]];
                }
                m.datos.surtido = pool.slice(0, n).map((x) => x.o.en);
                m.datos.cuantos = n;
                guardar();
                pintar();
                avisar("Surtido nuevo: " + m.datos.surtido.length + " objetos.");
            });
            const todo = botonDe("oc-vida-accion", "ver todo", () => {
                delete m.datos.surtido;
                guardar();
                pintar();
                avisar("Se ve todo.");
            });
            const surtidoFila = crear("div", "master-tienda-azar");
            const cajaCuantos = crear("div", "master-tienda-campo");
            cajaCuantos.append(etCuantos, cuantosAzar);
            surtidoFila.append(cajaCuantos, azar, todo);
            const cuantos = crear("p", "oc-hoja-nota");
            cuantos.setAttribute("role", "status");
            const tabla = crear("table", "master-tienda-tabla");
            const cap = crear("caption", "visually-hidden", "Objetos y precios");
            const cab = crear("tr");
            [["Objeto", ""], ["Precio", "es-precio"]].forEach(([t, c]) => {
                const th = crear("th", c, t);
                th.scope = "col";
                cab.appendChild(th);
            });
            const thead = crear("thead");
            thead.appendChild(cab);
            const cuerpo = crear("tbody");
            tabla.append(cap, thead, cuerpo);

            function filtrados(conSurtido) {
                const q = llano(buscar.value.trim());
                const enSurtido = conSurtido && m.datos.surtido ? new Set(m.datos.surtido) : null;
                return objetos.filter((x) => (!tienda.value || x.o.tiendas.indexOf(tienda.value) >= 0)
                    && (!cat.value || x.o.cat === cat.value) && (!rareza.value || x.o.rareza === rareza.value)
                    && (!q || x.buscar.includes(q)) && (!enSurtido || enSurtido.has(x.o.en)));
            }

            // Las categorías que hay en la tienda elegida.
            function categorias() {
                const antes = cat.value;
                const hay = Array.from(new Set(objetos.filter((x) => !tienda.value || x.o.tiendas.indexOf(tienda.value) >= 0)
                    .map((x) => x.o.cat))).sort();
                cat.replaceChildren(...[["", "todas"]].concat(hay.map((c) => [c, c])).map(([v, t]) => {
                    const op = crear("option", "", t);
                    op.value = v;
                    return op;
                }));
                cat.value = hay.indexOf(antes) >= 0 ? antes : "";
            }

            const porcentaje = () => Math.max(0, parseFloat(precio.value) || 0) / 100 || (precio.value === "0" ? 0 : 1);

            // La ventana de cada objeto: sus datos, el precio de lista, el de
            // la tienda y el regateo (un % propio, con lo que queda).
            function ficha(o, vuelta) {
                const cuerpo = datosObjeto(Object.assign({}, o, { cp: 0 }));
                if (o.cp) {
                    const precios = crear("dl", "master-bicho-datos master-objeto-precios");
                    const tiendaP = Math.round(porcentaje() * 100);
                    precios.append(crear("dt", "", "De lista"), crear("dd", "", moneda(o.cp)),
                        crear("dt", "", "En esta tienda (" + tiendaP + " %)"), crear("dd", "", moneda(o.cp * porcentaje())));
                    const form = crear("form", "master-regateo");
                    const et = crear("label", "oc-dados-etiqueta", "regatear: precio final (%)");
                    const pct = crear("input", "oc-dados-texto");
                    pct.type = "number";
                    pct.min = "0";
                    pct.max = "1000";
                    pct.step = "5";
                    pct.inputMode = "numeric";
                    pct.id = "master-regateo-" + m.id;
                    pct.value = String(tiendaP);
                    et.htmlFor = pct.id;
                    const queda = crear("p", "master-regateo-queda");
                    queda.setAttribute("aria-live", "polite");
                    const echar = () => {
                        const v = Math.max(0, parseFloat(pct.value) || 0);
                        queda.textContent = "Queda en " + moneda(o.cp * v / 100) + " (" + v + " % del precio de lista).";
                    };
                    pct.addEventListener("input", echar);
                    const rapidos = crear("div", "master-regateo-rapidos");
                    [-20, -10, -5, 5, 10, 20].forEach((d) => {
                        rapidos.appendChild(botonDe("oc-vida-accion", (d > 0 ? "+" : "−") + Math.abs(d) + " %", () => {
                            pct.value = String(Math.max(0, (parseFloat(pct.value) || 0) + d));
                            echar();
                        }, (d > 0 ? "Subir " : "Bajar ") + Math.abs(d) + " puntos"));
                    });
                    form.addEventListener("submit", (e) => {
                        e.preventDefault();
                        echar();
                    });
                    form.append(et, pct, rapidos, queda);
                    echar();
                    cuerpo.append(precios, form);
                } else {
                    cuerpo.appendChild(crear("p", "oc-hoja-nota", "No tiene precio: lo pone el DM."));
                }
                cuerpo.appendChild(crear("p", "oc-hoja-nota master-fuente", datos.fuente || ""));
                window.ocVentana.abrir({ titulo: o.nombre, cuerpo, vuelta, clase: "es-regla" });
            }

            function pintar() {
                const veces = porcentaje();
                const salen = filtrados(true);
                todo.hidden = !m.datos.surtido;
                cuerpo.replaceChildren(...salen.slice(0, 100).map((x) => {
                    const tr = crear("tr");
                    const td = crear("td");
                    const b = botonDe("master-tienda-nombre", x.o.nombre, () => ficha(x.o, b));
                    b.setAttribute("aria-haspopup", "dialog");
                    td.appendChild(b);
                    const extra = [x.o.cat, x.o.rareza, x.o.sint ? "requiere sintonía" : "", x.o.det, x.o.peso, x.o.nota]
                        .filter(Boolean).join(" · ");
                    td.appendChild(crear("span", "master-tienda-datos", extra));
                    const tdP = crear("td", "es-precio", x.o.cp ? moneda(x.o.cp * veces) : "—");
                    tr.append(td, tdP);
                    return tr;
                }));
                cuantos.textContent = (m.datos.surtido ? "Surtido de hoy: " : "") + (salen.length
                    ? salen.length + (salen.length === 1 ? " objeto" : " objetos") + (salen.length > 100 ? " (salen los 100 primeros)" : "")
                    : "Nada con eso.");
            }

            const alCambiar = () => {
                m.datos.tienda = tienda.value;
                m.datos.rareza = rareza.value;
                m.datos.porc = parseFloat(precio.value) || 0;
                delete m.datos.precio;
                guardar();
                pintar();
            };
            tienda.addEventListener("change", () => {
                categorias();
                alCambiar();
            });
            [cat, rareza].forEach((c) => c.addEventListener("change", alCambiar));
            precio.addEventListener("input", alCambiar);
            let espera = 0;
            buscar.addEventListener("input", () => {
                clearTimeout(espera);
                espera = setTimeout(pintar, 150);
            });
            categorias();
            dentro.replaceChildren(campos, surtidoFila, cuantos, tabla, crear("p", "oc-hoja-nota master-fuente", datos.fuente || ""));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido abrir la tienda."));
        });
    }

    // ---- EL CONVERSOR DE MONEDAS: cuánto es en cada moneda, y repartir
    // entre varios (1 ppt = 10 po; 1 po = 2 pe = 10 pp = 100 pc). ----
    const MONEDAS = [["ppt", "platino", 1000], ["po", "oro", 100], ["pe", "electro", 50], ["pp", "plata", 10], ["pc", "cobre", 1]];

    function enMonedas(cp, conPlatino) {
        const trozos = [];
        let resto = Math.floor(cp);
        MONEDAS.filter((x) => x[0] !== "pe" && (conPlatino || x[0] !== "ppt")).forEach(([k, , v]) => {
            const n = Math.floor(resto / v);
            resto -= n * v;
            if (n) {
                trozos.push(n.toLocaleString("es-ES") + " " + k);
            }
        });
        return trozos.join(" ") || "0 pc";
    }

    function montarMonedas(dentro, m) {
        m.datos = m.datos || {};
        const form = crear("form", "master-monedas");
        const campos = {};
        MONEDAS.forEach(([k, nombre]) => {
            const caja = crear("div", "master-tienda-campo");
            const et = crear("label", "oc-dados-etiqueta", k + " (" + nombre + ")");
            const i = crear("input", "oc-dados-texto");
            i.type = "number";
            i.min = "0";
            i.inputMode = "numeric";
            i.id = "master-monedas-" + k + "-" + m.id;
            i.value = m.datos[k] ? String(m.datos[k]) : "";
            et.htmlFor = i.id;
            caja.append(et, i);
            form.appendChild(caja);
            campos[k] = i;
        });
        const entreCaja = crear("div", "master-tienda-campo");
        const etEntre = crear("label", "oc-dados-etiqueta", "repartir entre");
        const entre = crear("input", "oc-dados-texto");
        entre.type = "number";
        entre.min = "1";
        entre.inputMode = "numeric";
        entre.id = "master-monedas-entre-" + m.id;
        entre.value = String(m.datos.entre || 1);
        etEntre.htmlFor = entre.id;
        entreCaja.append(etEntre, entre);
        form.appendChild(entreCaja);
        const salida = crear("dl", "master-bicho-datos master-monedas-salida");
        salida.setAttribute("aria-live", "polite");
        const vaciar = botonDe("oc-vida-accion", "🗑️ vaciar", () => {
            MONEDAS.forEach(([k]) => {
                campos[k].value = "";
            });
            calcular();
            campos.po.focus();
        });
        function calcular() {
            let cp = 0;
            MONEDAS.forEach(([k, , v]) => {
                const n = Math.max(0, parseFloat(campos[k].value) || 0);
                m.datos[k] = n;
                cp += n * v;
            });
            const n = Math.max(1, parseInt(entre.value, 10) || 1);
            m.datos.entre = n;
            guardar();
            const filas = [["Total", enMonedas(cp, true)], ["En oro", (cp / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " po"],
                ["En plata", (cp / 10).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " pp"],
                ["En cobre", cp.toLocaleString("es-ES") + " pc"]];
            if (n > 1) {
                const cada = Math.floor(cp / n);
                filas.push(["Para cada uno (" + n + ")", enMonedas(cada, false)]);
                if (cp - cada * n) {
                    filas.push(["Sobra", enMonedas(cp - cada * n, false)]);
                }
            }
            salida.replaceChildren(...filas.flatMap(([a, b]) => [crear("dt", "", a), crear("dd", "", b)]));
        }
        form.addEventListener("input", calcular);
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            calcular();
        });
        dentro.append(form, salida, vaciar);
        calcular();
    }

    // LOS MÓDULOS QUE HAY: su nombre, su dibujo, cómo se montan, su
    // tamaño al añadirlos y si solo puede haber uno.
    const MODULOS = {
        iniciativa: { nombre: "iniciativa", emoji: "⏱️", grupo: "combate", unico: true, w: 420, h: 520,
            desc: "El orden de turnos, con rondas, PG y marcas.",
            montar: (d) => window.ocMontar.iniciativa(d, { suelta: true }) },
        condiciones: { nombre: "condiciones", emoji: "🙈", grupo: "combate", unico: true, w: 460, h: 420,
            desc: "Los estados: agarrado, cegado, derribado…", montar: (d, m) => montarReglas(d, m, "Estados") },
        acciones: { nombre: "acciones", emoji: "⚔️", grupo: "combate", unico: true, w: 460, h: 420,
            desc: "Lo que se puede hacer en un turno.", montar: (d, m) => montarReglas(d, m, "Acciones") },
        dados: { nombre: "dados", emoji: "🎲", grupo: "combate", w: 360, h: 230, desc: "Del d4 al d100 y fórmulas.",
            montar: montarDados },
        registro: { nombre: "registro de tiradas", emoji: "📜", grupo: "combate", unico: true, w: 340, h: 420,
            desc: "Las últimas tiradas, para repetirlas.", montar: montarRegistro },
        reglas: { nombre: "todas las reglas", emoji: "📚", grupo: "consulta", unico: true, w: 480, h: 520,
            desc: "Las reglas del SRD 5.2, por temas.", montar: (d, m) => montarReglas(d, m, null) },
        homebrew: { nombre: "reglas propias", emoji: "🏠", grupo: "consulta", unico: true, w: 460, h: 460,
            desc: "Las reglas de tu mesa (homebrew).", montar: montarHomebrew },
        conjuros: { nombre: "conjuros", emoji: "✨", grupo: "consulta", unico: true, w: 420, h: 480,
            desc: "Los 339 del SRD, por nivel, escuela y clase.", montar: montarConjuros },
        bestiario: { nombre: "bestiario", emoji: "🐉", grupo: "consulta", unico: true, w: 460, h: 520,
            desc: "Los 330 monstruos del SRD, con su perfil.", montar: montarBestiario },
        party: { nombre: "party (jugadores)", emoji: "🛡️", grupo: "mesa", unico: true, w: 600, h: 440,
            desc: "Los personajes de los jugadores, de un vistazo.", montar: montarParty },
        tienda: { nombre: "tienda", emoji: "💰", grupo: "mundo", w: 520, h: 560, desc: "Precios, rarezas y regateo.",
            montar: montarTienda },
        monedas: { nombre: "conversor de monedas", emoji: "🪙", grupo: "mundo", w: 420, h: 440,
            desc: "Cambiar y repartir el botín.", montar: montarMonedas },
        nombres: { nombre: "generador de nombres", emoji: "🎭", grupo: "mundo", w: 440, h: 560,
            desc: "Personajes por especie y género, y lugares.", montar: montarNombres },
        botin: { nombre: "botín", emoji: "💰", grupo: "mundo", w: 440, h: 560,
            desc: "Monedas, gemas, arte y objetos mágicos según el VD.", montar: montarBotin },
        encuentros: { nombre: "encuentros", emoji: "🗺️", grupo: "combate", w: 440, h: 620,
            desc: "Monstruos del SRD por hábitat para tu party.", montar: montarEncuentros },
        pnj: { nombre: "PNJ rápidos", emoji: "🧑", grupo: "mundo", w: 460, h: 620,
            desc: "Un PNJ con oficio, aspecto, carácter, manía, lo que quiere y un secreto.", montar: montarPnj },
        dungeon: { nombre: "generador de dungeons", emoji: "🗝️", grupo: "mundo", w: 680, h: 780,
            desc: "Un mapa en cuadrícula con sus salas, monstruos, trampas y botín.", montar: montarDungeon },
        calendario: { nombre: "calendario", emoji: "📅", grupo: "mundo", w: 520, h: 720,
            desc: "Gregoriano, el de Harptos o uno propio, con la hora y apuntes.", montar: montarCalendario },
        efectos: { nombre: "efectos con duración", emoji: "⌛", grupo: "combate", w: 460, h: 620,
            desc: "Bendecir 1 minuto, Armadura de mago 8 horas…: se descuentan solos.", montar: montarEfectos },
        taberna: { nombre: "negocios", emoji: "🏪", grupo: "mundo", w: 500, h: 760,
            desc: "Tabernas y posadas, tiendas, templos, establos…: con lo que venden, sus precios y un gancho.", montar: montarNegocio },
        relojes: { nombre: "relojes", emoji: "⏳", grupo: "mesa", w: 440, h: 480,
            desc: "Relojes de progreso: amenazas que avanzan, cuentas atrás…", montar: montarRelojes },
        idiomas: { nombre: "notas en otros idiomas", emoji: "🪶", grupo: "mundo", w: 480, h: 680,
            desc: "Escribe una nota y mírala en élfico, enano, infernal…", montar: montarIdiomas },
        tarjeta: { nombre: "post-it", emoji: "🗒️", grupo: "apuntes", w: 420, h: 340,
            desc: "Un texto con formato: negrita, listas, colores…", montar: montarTarjeta },
        dibujo: { nombre: "dibujo", emoji: "🎨", grupo: "apuntes", w: 900, h: 660,
            desc: "Un Paint con capas, bote, selección y rejilla de rol.", montar: montarDibujo },
        notas: { nombre: "notas", emoji: "📝", grupo: "apuntes", unico: true, w: 520, h: 480,
            desc: "Las notas de la sesión, con formato (como un Word).", montar: montarNotas },
        tabla: { nombre: "tabla para tirar", emoji: "🔮", grupo: "apuntes", w: 360, h: 380,
            desc: "Una lista de la que sale una cosa al azar.", montar: montarTabla },
        criatura: { nombre: "criatura", emoji: "🐾", oculto: true, w: 440, h: 520, montar: montarCriatura },
        ficha: { nombre: "ficha", emoji: "📖", oculto: true, w: 420, h: 420, montar: montarFicha },
    };
    const GRUPOS = [["combate", "⚔️ combate"], ["consulta", "📚 consulta"], ["mesa", "🛡️ la mesa"], ["mundo", "🌍 el mundo"],
        ["apuntes", "🗒️ apuntes"]];

    // ---- EL ESTADO (lo que se guarda) ----
    // Los colores de las ventanas, como post-its: fijos, iguales en todos
    // los temas de la web (la barra de ese color con letra oscura).
    const COLORES = [["", "sin color"], ["amarillo", "amarillo", "#ffe873"], ["naranja", "naranja", "#ffb870"],
        ["rojo", "rojo", "#ff8f8f"], ["rosa", "rosa", "#ffa6d5"], ["morado", "morado", "#c9a2ff"], ["azul", "azul", "#8fb8ff"],
        ["celeste", "celeste", "#7fdcff"], ["verde", "verde", "#8fe8a2"], ["gris", "gris", "#c9c9d1"]];
    const hexDe = (color) => (COLORES.find((c) => c[0] === color) || [])[2] || "";
    // Los colores del tablero (el fondo del lienzo de cada perfil), como
    // tapetes: fijos, iguales en todos los temas. Las rayas de la
    // cuadrícula, claras u oscuras según el fondo.
    const TABLEROS = [["", "el del tema"], ["tapete", "tapete verde", "#1f4d36"], ["vino", "rojo vino", "#5a1f2a"],
        ["noche", "azul noche", "#1d2b4f"], ["madera", "madera", "#5b3b22"], ["pizarra", "pizarra", "#2f3438"],
        ["uva", "morado", "#3d2552"], ["pergamino", "pergamino", "#e8dcc0"], ["arena", "arena", "#d9c7a3"],
        ["cielo", "cielo", "#bfd6e6"]];

    // Varios PERFILES, como pestañas de un navegador (combate, vista
    // rápida…): cada uno con sus ventanas. «estado» es el que se ve.
    let todo = null;
    try {
        todo = JSON.parse(localStorage.getItem(CLAVE) || "null");
    } catch (e) {
        todo = null;
    }
    if (todo && Array.isArray(todo.modulos) && !todo.perfiles) {
        // Lo de antes de las pestañas: su primera pestaña.
        todo = { perfiles: [{ id: "p1", nombre: "principal", modulos: todo.modulos }], activo: "p1" };
    }
    if (!todo || !Array.isArray(todo.perfiles) || !todo.perfiles.length) {
        todo = { perfiles: [{ id: "p1", nombre: "principal", modulos: [] }], activo: "p1" };
    }
    let siguienteId = 1;
    let siguientePerfil = 1;
    todo.perfiles.forEach((pf) => {
        pf.id = pf.id || "p" + siguientePerfil;
        siguientePerfil = Math.max(siguientePerfil, parseInt(String(pf.id).slice(1), 10) + 1 || siguientePerfil);
        pf.nombre = pf.nombre || "perfil";
        pf.modulos = (Array.isArray(pf.modulos) ? pf.modulos : []).filter((m) => MODULOS[m.tipo]);
        pf.modulos.forEach((m) => {
            // Las tarjetas y tablas de antes tenían el título dentro.
            if (!m.titulo && m.datos && m.datos.titulo) {
                m.titulo = m.datos.titulo;
            }
            m.color = hexDe(m.color) ? m.color : "";
            m.id = m.id || "m" + siguienteId++;
            siguienteId = Math.max(siguienteId, parseInt(String(m.id).slice(1), 10) + 1 || siguienteId);
        });
    });
    let estado = todo.perfiles.find((pf) => pf.id === todo.activo) || todo.perfiles[0];

    function guardar() {
        const salida = { activo: estado.id, perfiles: todo.perfiles.map((pf) => ({ id: pf.id, nombre: pf.nombre, color: pf.color || "",
            zoom: pf.zoom || 1,
            modulos: pf.modulos.map((m) => ({ id: m.id, tipo: m.tipo, x: m.x, y: m.y, w: m.w, h: m.h,
                titulo: m.titulo || "", color: m.color || "", plegado: !!m.plegado, movible: !!m.movible,
                escala: m.escala || 1, datos: m.datos })) })) };
        try {
            localStorage.setItem(CLAVE, JSON.stringify(salida));
            return true;
        } catch (e) {
            // Sin almacenamiento (o lleno): se usa igual, sin guardar.
            return false;
        }
    }

    // ---- LAS VENTANAS ----
    let encima = 10;

    // EL ZOOM del tablero (zoom de CSS en el lienzo; por perfil, en
    // «zoom»). El ancho del lienzo, en sus píxeles: con zoom de menos cabe
    // más; con zoom de más, el de siempre (y se desliza de lado).
    const zoomAhora = () => (enMovil.matches || !HAY_ZOOM ? 1 : estado.zoom || 1);
    function anchoLienzo() {
        return Math.max(lienzo.clientWidth, Math.round(lienzo.getBoundingClientRect().width));
    }

    // Lo más a la derecha que puede ir una ventana (que no se salga del
    // lienzo).
    function topeX(m) {
        return Math.max(0, anchoLienzo() - m.w - 4);
    }

    function ponerTitulo(m) {
        if (m.el) {
            m.el.querySelector(".master-ventana-nombre").textContent = m.titulo || MODULOS[m.tipo].nombre;
        }
    }

    function ponerColor(m) {
        if (!m.el) {
            return;
        }
        m.el.classList.toggle("con-color", !!m.color);
        if (m.color) {
            m.el.style.setProperty("--postit", hexDe(m.color));
        } else {
            m.el.style.removeProperty("--postit");
        }
    }

    // ✎: una ventanita para cambiarle el título y el color.
    // EL TAMAÑO DEL CONTENIDO de una ventana (m.escala, de 0,6 a 2): zoom
    // de CSS en su cuerpo, así crece todo (letra, botones y dibujos).
    function ponerEscala(m) {
        const e = Math.min(2, Math.max(0.6, Math.round((m.escala || 1) * 10) / 10));
        m.escala = e === 1 ? undefined : e;
        if (m.cuerpo) {
            m.cuerpo.style.zoom = e === 1 ? "" : String(e);
        }
        return e;
    }

    function personalizar(m, vuelta) {
        const def = MODULOS[m.tipo];
        const cuerpo = crear("form", "master-personalizar");
        const et = crear("label", "oc-dados-etiqueta", "título");
        const input = crear("input", "oc-dados-texto");
        input.id = "master-personalizar-" + m.id;
        input.value = m.titulo || "";
        input.placeholder = def.nombre;
        input.maxLength = 60;
        input.autocomplete = "off";
        et.htmlFor = input.id;
        const grupo = crear("fieldset", "master-colores");
        grupo.appendChild(crear("legend", "oc-dados-etiqueta", "color"));
        let elegido = m.color || "";
        const muestras = COLORES.map(([valor, nombre]) => {
            const b = botonDe("master-color" + (valor ? "" : " es-ninguno"), "", () => {
                elegido = valor;
                muestras.forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
            }, nombre);
            b.title = nombre;
            if (valor) {
                b.style.backgroundColor = hexDe(valor);
            }
            b.setAttribute("aria-pressed", valor === elegido ? "true" : "false");
            grupo.appendChild(b);
            return b;
        });
        // El tamaño de lo de dentro: se ve al momento.
        const tam = crear("fieldset", "master-colores master-escala");
        tam.appendChild(crear("legend", "oc-dados-etiqueta", "tamaño del contenido"));
        const valor = crear("output", "master-escala-valor", Math.round((m.escala || 1) * 100) + " %");
        const paso = (d) => {
            m.escala = (m.escala || 1) + d;
            const e = ponerEscala(m);
            valor.textContent = Math.round(e * 100) + " %";
            menos.disabled = e <= 0.6;
            mas.disabled = e >= 2;
            guardar();
            avisar("Contenido al " + Math.round(e * 100) + " %.");
        };
        const menos = botonDe("master-pestana-mando", "A−", () => paso(-0.1), "Contenido más pequeño");
        const mas = botonDe("master-pestana-mando", "A+", () => paso(0.1), "Contenido más grande");
        const igual = botonDe("oc-vida-accion", "100 %", () => paso(1 - (m.escala || 1)), "Contenido a su tamaño normal");
        menos.disabled = (m.escala || 1) <= 0.6;
        mas.disabled = (m.escala || 1) >= 2;
        tam.append(menos, valor, mas, igual);
        const listo = crear("button", "oc-vida-accion es-principal", "guardar");
        listo.type = "submit";
        cuerpo.append(et, input, grupo, tam, listo);
        cuerpo.addEventListener("submit", (e) => {
            e.preventDefault();
            m.titulo = input.value.trim();
            m.color = elegido;
            ponerTitulo(m);
            ponerColor(m);
            guardar();
            cerrar();
            if (m.alRenombrar) {
                m.alRenombrar();
            }
            avisar("Guardado.");
        });
        const cerrar = window.ocVentana.abrir({ titulo: "opciones de la ventana", cuerpo, vuelta, foco: input });
    }

    function colocar(m) {
        if (enMovil.matches) {
            m.el.style.left = "";
            m.el.style.top = "";
            m.el.style.width = "";
            m.el.style.height = "";
            return;
        }
        m.el.style.left = m.x + "px";
        m.el.style.top = m.y + "px";
        m.el.style.width = m.w + "px";
        m.el.style.height = m.plegado ? "" : m.h + "px";
    }

    function alFrente(m) {
        encima += 1;
        m.el.style.zIndex = String(encima);
    }

    function ventanaDe(m) {
        const def = MODULOS[m.tipo];
        m.w = m.w || def.w;
        m.h = m.h || def.h;
        m.x = Math.max(0, m.x || 0);
        m.y = Math.max(0, m.y || 0);
        const v = crear("div", "master-ventana oc-hoja-caja");
        v.setAttribute("role", "region");
        const cabeza = crear("div", "recent-entries-header master-ventana-barra");
        // Que no le monte encima su mando ventanas-plegables.js (taparía
        // los ✎ − ✕ y estas ya se pliegan con su −).
        cabeza.dataset.ventanaLista = "si";
        const titulo = crear("h2", "oc-hoja-titulo master-ventana-titulo");
        const idTitulo = "master-titulo-" + m.id;
        titulo.id = idTitulo;
        v.setAttribute("aria-labelledby", idTitulo);
        const em = crear("span", "oc-hoja-emoji", def.emoji);
        em.setAttribute("aria-hidden", "true");
        // El nombre es un botón que pliega y despliega la ventana (como en
        // el resto de la web).
        const nombre = botonDe("master-ventana-nombre", m.titulo || def.nombre, () => {
            if (v.dataset.recienMovida) {
                delete v.dataset.recienMovida;
                return;
            }
            plegar.click();
        });
        nombre.title = "Plegar o desplegar";
        titulo.append(em, nombre);
        // ✥: activa o desactiva moverla. Con él puesto, la barra se
        // arrastra (y la ventana lleva un reborde de otro color); con el
        // teclado, ✥ y las flechas (con Alt, el tamaño).
        const asa = botonDe("master-ventana-mando es-asa", "✥", () => {
            m.movible = !m.movible;
            pintarMovible();
            guardar();
            avisar(m.movible ? "Se puede mover: arrástrala por la barra o usa las flechas (con Alt, el tamaño)."
                : "Fija en su sitio.");
        }, "Poder moverla");
        const pintarMovible = () => {
            asa.setAttribute("aria-pressed", String(!!m.movible));
            asa.title = m.movible ? "Dejarla fija" : "Poder moverla (arrastrando la barra o con las flechas)";
            v.classList.toggle("es-movible", !!m.movible);
        };
        asa.addEventListener("keydown", (e) => {
            const paso = e.shiftKey ? 60 : 20;
            const d = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
            if (!d || enMovil.matches) {
                return;
            }
            e.preventDefault();
            if (!m.movible) {
                avisar("Pulsa ✥ para poder moverla.");
                return;
            }
            if (e.altKey) {
                // El tamaño: derecha e izquierda, el ancho; arriba y
                // abajo, el alto.
                m.w = Math.max(240, Math.min(anchoLienzo() - m.x - 4, m.w + d[0]));
                m.h = Math.max(120, m.h + d[1]);
                avisar(m.w + " por " + m.h + " píxeles.");
            } else {
                m.x = Math.min(topeX(m), Math.max(0, m.x + d[0]));
                m.y = Math.max(0, m.y + d[1]);
            }
            colocar(m);
            crecerLienzo();
            guardar();
        });
        const plegar = botonDe("master-ventana-mando", m.plegado ? "+" : "−", () => {
            m.plegado = !m.plegado;
            cuerpo.hidden = m.plegado;
            plegar.textContent = m.plegado ? "+" : "−";
            plegar.setAttribute("aria-expanded", m.plegado ? "false" : "true");
            nombre.setAttribute("aria-expanded", m.plegado ? "false" : "true");
            v.classList.toggle("es-plegada", m.plegado);
            colocar(m);
            crecerLienzo();
            guardar();
        }, "Plegar o desplegar");
        plegar.setAttribute("aria-expanded", m.plegado ? "false" : "true");
        nombre.setAttribute("aria-expanded", m.plegado ? "false" : "true");
        const quitar = botonDe("master-ventana-mando", "✕", () => {
            estado.modulos = estado.modulos.filter((x) => x !== m);
            v.remove();
            guardar();
            avisar("Quitado: " + (m.titulo || def.nombre) + ".");
            botonAnadir.focus();
        }, "Quitar esta ventana");
        const cambiar = botonDe("master-ventana-mando", "✎", () => personalizar(m, cambiar),
            "Opciones: título, color y tamaño del contenido");
        cambiar.title = "Título, color y tamaño del contenido";
        cambiar.setAttribute("aria-haspopup", "dialog");
        const mandos = crear("div", "master-ventana-mandos");
        mandos.append(asa, cambiar, plegar, quitar);
        cabeza.append(titulo, mandos);
        const cuerpo = crear("div", "oc-hoja-dentro master-ventana-cuerpo");
        cuerpo.id = "master-cuerpo-" + m.id;
        nombre.setAttribute("aria-controls", cuerpo.id);
        plegar.setAttribute("aria-controls", cuerpo.id);
        cuerpo.hidden = !!m.plegado;
        m.cuerpo = cuerpo;
        ponerEscala(m);
        v.classList.toggle("es-plegada", !!m.plegado);
        // El tamaño, por la esquina de abajo a la derecha: con el ratón, el
        // dedo o el lápiz (en las tabletas no vale el «resize» de CSS).
        const esquina = crear("span", "master-ventana-tamano");
        esquina.setAttribute("aria-hidden", "true");
        esquina.title = "Arrastra para cambiar el tamaño";
        esquina.addEventListener("pointerdown", (e) => {
            if (enMovil.matches || m.plegado || e.button > 0) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            alFrente(m);
            const w0 = v.offsetWidth;
            const h0 = v.offsetHeight;
            v.classList.add("es-arrastrada");
            arrastrar(e, esquina, (dx, dy) => {
                m.w = Math.max(240, Math.min(anchoLienzo() - m.x - 4, Math.round(w0 + dx)));
                m.h = Math.max(120, Math.round(h0 + dy));
                colocar(m);
            }, () => v.classList.remove("es-arrastrada"));
        });
        v.append(cabeza, cuerpo, esquina);
        m.el = v;
        ponerColor(m);
        // Arrastrar por la barra (no por sus botones, salvo ✥ y el nombre),
        // solo si se puede mover (✥).
        cabeza.addEventListener("pointerdown", (e) => {
            if (enMovil.matches || !m.movible || e.target.closest("button:not(.es-asa):not(.master-ventana-nombre)") ||
                e.button > 0) {
                return;
            }
            e.preventDefault();
            alFrente(m);
            const mx = m.x;
            const my = m.y;
            delete v.dataset.recienMovida;
            v.classList.add("es-arrastrada");
            arrastrar(e, cabeza, (dx, dy) => {
                if (Math.abs(dx) + Math.abs(dy) > 3) {
                    // Si se ha movido, soltar no cuenta como pulsar.
                    v.dataset.recienMovida = "si";
                }
                m.x = Math.min(topeX(m), Math.max(0, mx + dx));
                m.y = Math.max(0, my + dy);
                colocar(m);
            }, () => {
                v.classList.remove("es-arrastrada");
                setTimeout(() => delete v.dataset.recienMovida, 0);
            });
        });
        pintarMovible();
        v.addEventListener("pointerdown", () => alFrente(m));
        colocar(m);
        def.montar(cuerpo, m);
        return v;
    }

    // El lienzo, tan alto como lo que tiene más un margen holgado (para
    // que haya sitio donde soltar sin que salte). «soloCrecer»: mientras
    // se arrastra, crece pero no encoge; al soltar, encoge despacio (con
    // la transición del CSS).
    function crecerLienzo(soloCrecer) {
        if (enMovil.matches) {
            lienzo.style.height = "";
            return;
        }
        const fondo = Math.max(480, ...estado.modulos.map((m) => m.y + (m.plegado ? 60 : m.h) + 240));
        const ahora = parseInt(lienzo.style.height, 10) || 0;
        if (!soloCrecer || fondo > ahora) {
            lienzo.style.height = fondo + "px";
        }
    }

    // Lo que hace scroll alrededor del lienzo (la página o su caja).
    function scrollDe(el) {
        for (let p = el.parentElement; p; p = p.parentElement) {
            const o = getComputedStyle(p).overflowY;
            if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) {
                return p;
            }
        }
        return document.scrollingElement || document.documentElement;
    }

    // ARRASTRAR (mover o cambiar el tamaño): sigue al puntero con
    // requestAnimationFrame (un cambio por fotograma, sin tirones), hace
    // scroll solo cerca del borde de arriba o de abajo y va agrandando el
    // lienzo. «alMover(dx, dy)» recibe lo movido desde el principio
    // (contando el scroll).
    function arrastrar(e, origen, alMover, alSoltar) {
        const caja = scrollDe(lienzo);
        const esPagina = caja === document.scrollingElement || caja === document.documentElement;
        const scroll0 = caja.scrollTop;
        const x0 = e.clientX;
        const y0 = e.clientY;
        let ultimo = e;
        let pendiente = 0;
        let vivo = true;
        try {
            origen.setPointerCapture(e.pointerId);
        } catch (err) {
            // Sin captura: siguen llegando al documento.
        }
        const paso = () => {
            pendiente = 0;
            if (!vivo) {
                return;
            }
            // Cerca del borde de la caja que hace scroll, se desliza.
            const r = esPagina ? { top: 0, bottom: window.innerHeight } : caja.getBoundingClientRect();
            const margen = 48;
            let velocidad = 0;
            if (ultimo.clientY > r.bottom - margen) {
                velocidad = Math.ceil((ultimo.clientY - (r.bottom - margen)) / 4);
            } else if (ultimo.clientY < r.top + margen && caja.scrollTop > 0) {
                velocidad = -Math.ceil(((r.top + margen) - ultimo.clientY) / 4);
            }
            if (velocidad) {
                caja.scrollTop += velocidad;
            }
            // Lo movido en la pantalla, en píxeles del lienzo (con el zoom).
            const z = zoomAhora();
            alMover(Math.round((ultimo.clientX - x0) / z), Math.round((ultimo.clientY - y0 + caja.scrollTop - scroll0) / z));
            crecerLienzo(true);
            if (velocidad) {
                pendiente = requestAnimationFrame(paso);
            }
        };
        const mover = (ev) => {
            ultimo = ev;
            if (!pendiente) {
                pendiente = requestAnimationFrame(paso);
            }
        };
        const soltar = () => {
            vivo = false;
            cancelAnimationFrame(pendiente);
            document.removeEventListener("pointermove", mover);
            document.removeEventListener("pointerup", soltar);
            document.removeEventListener("pointercancel", soltar);
            alSoltar();
            crecerLienzo();
            guardar();
        };
        document.addEventListener("pointermove", mover);
        document.addEventListener("pointerup", soltar);
        document.addEventListener("pointercancel", soltar);
    }

    function pintarTodo() {
        // En el móvil, en orden de lectura (de arriba abajo y de izquierda
        // a derecha); en el ordenador, también (así el tabulador va igual).
        const orden = estado.modulos.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
        lienzo.replaceChildren(...orden.map((m) => m.el || ventanaDe(m)));
        orden.forEach(colocar);
        crecerLienzo();
    }

    // ---- EL BUSCADOR DE ARRIBA: busca a la vez en los conjuros, los
    // monstruos, las reglas (las del SRD y las propias) y los objetos; lo
    // elegido se abre en su ventana, con «📌 al tablero». Es un combobox:
    // con las flechas se va por los resultados e Intro abre. ----
    let indice = null;

    function cargarIndice() {
        if (!indice) {
            indice = Promise.all([pedir(CONJUROS_SRD), pedir("/datos/personajes/compendio/bestiario.json"),
                pedir("/datos/personajes/reglas-dnd.json"), pedir("/datos/personajes/compendio/tienda.json")])
                .then(([conj, best, reg, tienda]) => {
                    const cosas = [];
                    (conj.conjuros || []).forEach((c) => cosas.push({ tipo: "conjuro", emoji: "✨", nombre: c.nombre,
                        detalle: nivelDe(c) + " · " + c.escuela, buscar: llano(c.nombre + " " + c.en),
                        abrir: (v) => abrirConjuro(c, v, conj.fuente) }));
                    (best.monstruos || []).forEach((b) => cosas.push({ tipo: "monstruo", emoji: tokenDe(b).textContent, nombre: b.nombre,
                        detalle: "VD " + b.cr + " · " + b.tipo, buscar: llano(b.nombre + " " + b.en),
                        abrir: (v) => abrirBicho(b, v, best.fuente) }));
                    (reg.reglas || []).forEach((r) => cosas.push({ tipo: "regla", emoji: r.icono || "📚", nombre: r.nombre,
                        detalle: "Regla · " + r.grupo, buscar: llano(r.nombre + " " + (r.alias || "")),
                        abrir: (v) => abrirRegla(r, v, reg.fuente) }));
                    (tienda.objetos || []).forEach((o) => cosas.push({ tipo: "objeto", emoji: "💰", nombre: o.nombre,
                        detalle: "Objeto · " + o.cat + (o.rareza ? " · " + o.rareza : ""), buscar: llano(o.nombre + " " + o.en),
                        abrir: (v) => abrirObjeto(o, v, tienda.fuente) }));
                    return cosas;
                });
        }
        return indice;
    }

    function montarBuscador() {
        const caja = crear("div", "master-buscador");
        caja.setAttribute("role", "search");
        const et = crear("label", "visually-hidden", "Buscar conjuros, monstruos, reglas u objetos");
        const input = crear("input", "master-buscador-texto");
        input.type = "search";
        input.id = "master-buscador";
        input.placeholder = "🔍 buscar: bola de fuego, goblin, derribado…";
        input.autocomplete = "off";
        input.setAttribute("role", "combobox");
        input.setAttribute("aria-autocomplete", "list");
        input.setAttribute("aria-expanded", "false");
        input.setAttribute("aria-controls", "master-buscador-lista");
        et.htmlFor = input.id;
        const lista = crear("ul", "master-buscador-lista");
        lista.id = "master-buscador-lista";
        lista.setAttribute("role", "listbox");
        lista.setAttribute("aria-label", "Resultados");
        lista.hidden = true;
        const cuantos = crear("p", "visually-hidden");
        cuantos.setAttribute("role", "status");
        let salen = [];
        let activo = -1;
        const cerrarLista = () => {
            lista.hidden = true;
            input.setAttribute("aria-expanded", "false");
            input.removeAttribute("aria-activedescendant");
            activo = -1;
        };
        const marcar = (i) => {
            activo = i;
            lista.querySelectorAll("[role=option]").forEach((o, j) => o.setAttribute("aria-selected", j === i ? "true" : "false"));
            const o = lista.querySelectorAll("[role=option]")[i];
            if (o) {
                input.setAttribute("aria-activedescendant", o.id);
                o.scrollIntoView({ block: "nearest" });
            }
        };
        const abrir = (x) => {
            cerrarLista();
            x.abrir(input);
        };
        let espera = 0;
        const buscar = () => {
            const q = llano(input.value.trim());
            if (q.length < 2) {
                cerrarLista();
                cuantos.textContent = "";
                return;
            }
            cargarIndice().then((cosas) => {
                const propias = leerHomebrew().map((r) => ({ tipo: "propia", emoji: r.icono || "🏠", nombre: r.nombre,
                    detalle: "Regla propia", buscar: llano(r.nombre),
                    abrir: (v) => abrirRegla(Object.assign({ propia: true, grupo: "🏠 Reglas propias" }, r), v) }));
                const todas = propias.concat(cosas);
                // Primero lo que empieza por lo buscado; luego lo que lo lleva.
                const empieza = todas.filter((x) => x.buscar.startsWith(q));
                const lleva = todas.filter((x) => !x.buscar.startsWith(q) && x.buscar.includes(q));
                salen = empieza.concat(lleva).slice(0, 12);
                lista.replaceChildren(...salen.map((x, i) => {
                    const li = crear("li", "master-buscador-opcion");
                    li.id = "master-buscador-o" + i;
                    li.setAttribute("role", "option");
                    li.setAttribute("aria-selected", "false");
                    const em = crear("span", "master-buscador-emoji", x.emoji);
                    em.setAttribute("aria-hidden", "true");
                    li.append(em, crear("span", "master-buscador-nombre", x.nombre), crear("span", "master-buscador-detalle",
                        x.detalle));
                    li.addEventListener("mousedown", (e) => e.preventDefault());
                    li.addEventListener("click", () => abrir(x));
                    return li;
                }));
                if (!salen.length) {
                    const li = crear("li", "master-buscador-nada", "Nada con eso.");
                    lista.appendChild(li);
                }
                lista.hidden = false;
                input.setAttribute("aria-expanded", "true");
                activo = -1;
                cuantos.textContent = salen.length ? salen.length + (salen.length === 1 ? " resultado" : " resultados")
                    + "; con las flechas se elige" : "Nada con eso.";
            });
        };
        input.addEventListener("input", () => {
            clearTimeout(espera);
            espera = setTimeout(buscar, 120);
        });
        input.addEventListener("focus", () => cargarIndice());
        input.addEventListener("keydown", (e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                if (lista.hidden || !salen.length) {
                    return;
                }
                e.preventDefault();
                marcar((activo + (e.key === "ArrowDown" ? 1 : -1) + salen.length) % salen.length);
            } else if (e.key === "Enter") {
                if (salen.length && !lista.hidden) {
                    e.preventDefault();
                    abrir(salen[Math.max(0, activo)]);
                }
            } else if (e.key === "Escape" && !lista.hidden) {
                e.preventDefault();
                e.stopPropagation();
                cerrarLista();
            }
        });
        input.addEventListener("blur", () => setTimeout(cerrarLista, 150));
        caja.append(et, input, lista, cuantos);
        return caja;
    }

    // ---- EL BOTÓN DE AÑADIR (y el de los dados, que pone personajes.js).
    // Su ventana tiene también «ordenar» y «quitar todas». ----
    const botonAnadir = botonDe("oc-vida-accion es-principal", "＋ añadir", () => {
        const cuerpo = crear("div", "master-anadir");
        // Un filtro arriba y las ventanas por grupos, como tarjetas con su
        // dibujo, su nombre y para qué son.
        const etFiltro = crear("label", "oc-dados-etiqueta", "filtrar");
        const filtro = crear("input", "oc-dados-texto");
        filtro.type = "search";
        filtro.id = "master-anadir-filtro";
        filtro.placeholder = "dados, monstruos, nombres…";
        filtro.autocomplete = "off";
        etFiltro.htmlFor = filtro.id;
        const cuantas = crear("p", "visually-hidden");
        cuantas.setAttribute("role", "status");
        cuerpo.append(etFiltro, filtro, cuantas);
        const tarjetas = [];
        GRUPOS.forEach(([grupo, titulo]) => {
            const seccion = crear("div", "master-anadir-grupo");
            const h = crear("h3", "master-anadir-titulo", titulo);
            h.id = "master-anadir-" + grupo;
            const lista = crear("ul", "master-anadir-lista");
            lista.setAttribute("aria-labelledby", h.id);
            Object.keys(MODULOS).filter((tipo) => MODULOS[tipo].grupo === grupo).forEach((tipo) => {
                const def = MODULOS[tipo];
                const ya = def.unico && estado.modulos.some((m) => m.tipo === tipo);
                const li = crear("li");
                const b = botonDe("master-anadir-tarjeta", "", () => {
                    cerrar();
                    anadir(tipo);
                });
                const em = crear("span", "master-anadir-emoji", def.emoji);
                em.setAttribute("aria-hidden", "true");
                const nombre = crear("span", "master-anadir-nombre", def.nombre);
                const desc = crear("span", "master-anadir-desc", ya ? "Ya está en el tablero." : def.desc);
                b.append(em, nombre, desc);
                b.disabled = ya;
                li.appendChild(b);
                lista.appendChild(li);
                tarjetas.push({ li, seccion, b, nombre: llano(def.nombre), texto: llano(def.nombre + " " + def.desc + " " + titulo) });
            });
            seccion.append(h, lista);
            cuerpo.appendChild(seccion);
        });
        filtro.addEventListener("input", () => {
            const q = llano(filtro.value.trim());
            let n = 0;
            tarjetas.forEach((t) => {
                t.li.hidden = !!q && !t.texto.includes(q);
                n += t.li.hidden ? 0 : 1;
            });
            cuerpo.querySelectorAll(".master-anadir-grupo").forEach((sec) => {
                sec.hidden = !sec.querySelector("li:not([hidden])");
            });
            cuantas.textContent = q ? (n ? n + (n === 1 ? " ventana" : " ventanas") : "Ninguna con eso.") : "";
        });
        filtro.addEventListener("keydown", (e) => {
            // Intro: la primera que queda, mejor una que lo tenga en el
            // nombre («botín» es el botín, no el conversor que lo reparte).
            if (e.key === "Enter") {
                const q = llano(filtro.value.trim());
                const quedan = tarjetas.filter((t) => !t.li.hidden && !t.b.disabled);
                const t = quedan.find((x) => q && x.nombre.includes(q)) || quedan[0];
                const b = t && t.b;
                if (b) {
                    e.preventDefault();
                    b.click();
                }
            }
        });
        if (estado.modulos.length) {
            const otras = crear("div", "master-anadir-otras");
            const ordenarlas = botonDe("oc-vida-accion", "▦ ordenar las ventanas", () => {
                cerrar();
                ordenar();
                pintarTodo();
                guardar();
                avisar("Ordenadas.");
            });
            let seguro = false;
            const vaciar = botonDe("oc-vida-accion", "🗑️ quitar todas", () => {
                if (!seguro) {
                    seguro = true;
                    vaciar.textContent = "🗑️ ¿seguro? pulsa otra vez";
                    return;
                }
                cerrar();
                estado.modulos = [];
                pintarTodo();
                guardar();
                avisar("Pantalla vacía.");
            });
            otras.append(ordenarlas, vaciar);
            cuerpo.appendChild(otras);
        }
        cuerpo.appendChild(copias(() => cerrar()));
        const cerrar = window.ocVentana.abrir({ titulo: "añadir una ventana", cuerpo, vuelta: botonAnadir, foco: filtro,
            clase: "es-ancha" });
    });
    botonAnadir.setAttribute("aria-haspopup", "dialog");

    // ---- EXPORTAR E IMPORTAR: todo lo de la pantalla de máster (los
    // perfiles con sus ventanas, la iniciativa, las marcas propias y las
    // tiradas guardadas) a un archivo .json, y de vuelta. Para guardarlo,
    // pasarlo a otro navegador o compartir un tablero montado. ----
    const CLAVES = (k) => k === CLAVE || k === CLAVE_HOMEBREW || k === CLAVE_IMAGENES || k === CLAVE_PLANTILLAS || /^richi-oc-(iniciativa|marcas|partida-pantalla-master)/.test(k);

    function copias(alTerminar) {
        const caja = crear("div", "master-anadir-otras");
        const exportar = botonDe("oc-vida-accion", "⬇ exportar", () => {
            guardar();
            const claves = {};
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (CLAVES(k)) {
                        claves[k] = localStorage.getItem(k);
                    }
                }
            } catch (e) {
                avisar("Este navegador no deja leer lo guardado.");
                return;
            }
            const datos = { pantallaDeMaster: 1, fecha: new Date().toISOString(), claves };
            const a = crear("a");
            // Una dirección blob: que hace el propio navegador con el archivo.
            const archivoBlob = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 1)], { type: "application/json" }));
            a.href = archivoBlob;
            a.download = "pantalla-de-master-" + new Date().toISOString().slice(0, 10) + ".json";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(archivoBlob), 1000);
            avisar("Exportado: " + a.download + ".");
        }, "Exportar todo a un archivo");
        exportar.title = "Guarda los perfiles, sus ventanas y la iniciativa en un archivo .json";
        const archivo = crear("input");
        archivo.type = "file";
        archivo.accept = ".json,application/json";
        archivo.hidden = true;
        let seguro = false;
        const importar = botonDe("oc-vida-accion", "⬆ importar", () => {
            if (!seguro) {
                seguro = true;
                importar.textContent = "⬆ ¿reemplazar todo? pulsa otra vez";
                return;
            }
            archivo.click();
        }, "Importar desde un archivo (reemplaza lo de ahora)");
        importar.title = "Carga un archivo exportado; reemplaza lo que hay ahora";
        archivo.addEventListener("change", () => {
            const f = archivo.files && archivo.files[0];
            if (!f) {
                return;
            }
            f.text().then((texto) => {
                const datos = JSON.parse(texto);
                if (!datos || datos.pantallaDeMaster !== 1 || typeof datos.claves !== "object") {
                    throw new Error("no es");
                }
                Object.keys(datos.claves).filter(CLAVES).forEach((k) => {
                    localStorage.setItem(k, String(datos.claves[k]));
                });
                alTerminar();
                location.reload();
            }).catch(() => {
                avisar("Ese archivo no es una exportación de la pantalla de máster.");
                importar.textContent = "⬆ importar";
                seguro = false;
            });
        });
        caja.append(exportar, importar, archivo);
        return caja;
    }

    function anadir(tipo, extra) {
        const def = MODULOS[tipo];
        const w = (extra && extra.w) || def.w;
        const h = (extra && extra.h) || def.h;
        const sitio = enMovil.matches ? { x: 0, y: 0 } : hueco(w, h);
        const m = Object.assign({ id: "m" + siguienteId++, tipo, x: sitio.x, y: sitio.y, w, h }, extra || {});
        estado.modulos.push(m);
        pintarTodo();
        guardar();
        alFrente(m);
        m.el.scrollIntoView({ block: "nearest" });
        const primero = m.el.querySelector(".master-ventana-cuerpo button, .master-ventana-cuerpo input, .master-ventana-cuerpo textarea")
            || m.el.querySelector(".es-asa");
        primero.focus();
        avisar("Añadido: " + (m.titulo || def.nombre) + ".");
    }

    // EL PRIMER HUECO LIBRE para una ventana de w × h: empezando por lo
    // que se ve ahora del lienzo (de arriba abajo y de izquierda a
    // derecha), sin pisar ninguna; si no cabe en ningún sitio, debajo de
    // todo. Así añadir no estira el lienzo si hay sitio.
    function hueco(w, h) {
        const ancho = Math.max(w, anchoLienzo() - 4);
        const ocupado = estado.modulos.map((m) => ({ x: m.x, y: m.y, w: m.w, h: m.plegado ? 60 : m.h }));
        const libre = (x, y) => ocupado.every((o) => x + w + 16 <= o.x || o.x + o.w + 16 <= x || y + h + 16 <= o.y
            || o.y + o.h + 16 <= y);
        const fondo = ocupado.reduce((a, o) => Math.max(a, o.y + o.h), 0);
        const visto = Math.max(0, Math.round(-lienzo.getBoundingClientRect().top / zoomAhora() / 20) * 20);
        const filas = [];
        for (let y = visto; y <= fondo; y += 20) {
            filas.push(y);
        }
        for (let y = 0; y < visto; y += 20) {
            filas.push(y);
        }
        for (const y of filas) {
            for (let x = 0; x + w <= ancho; x += 20) {
                if (libre(x, y)) {
                    return { x, y };
                }
            }
        }
        return { x: 0, y: ocupado.length ? fondo + 20 : 0 };
    }

    // En filas, una al lado de otra hasta el ancho del lienzo.
    function ordenar() {
        const ancho = Math.max(400, anchoLienzo());
        let x = 0;
        let y = 0;
        let alto = 0;
        estado.modulos.forEach((m) => {
            if (x + m.w > ancho && x > 0) {
                x = 0;
                y += alto + 20;
                alto = 0;
            }
            m.x = x;
            m.y = y;
            x += m.w + 20;
            alto = Math.max(alto, m.plegado ? 60 : m.h);
        });
    }

    // ---- LAS PESTAÑAS (los perfiles): cambiar de una a otra (también con
    // las flechas), «＋» para una nueva, ✎ para renombrar la de ahora y ✕
    // para cerrarla (pide pulsar dos veces; la última no se cierra). ----
    const pestanas = crear("div", "master-pestanas");
    const tablist = crear("div", "master-pestanas-lista");
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", "Perfiles de la pantalla de máster");
    lienzo.setAttribute("role", "tabpanel");

    // Los mandos del zoom (− 100 % +): el del medio lo deja en 100 %.
    const HAY_ZOOM = !!(window.CSS && CSS.supports && CSS.supports("zoom", "2"));
    const menosZoom = botonDe("master-pestana-mando", "－", () => pasoZoom(-1), "Alejar el tablero");
    const masZoom = botonDe("master-pestana-mando", "＋", () => pasoZoom(1), "Acercar el tablero");
    const botonZoom = botonDe("master-zoom-valor", "100 %", () => ponerZoom(1, true), "Dejar el zoom del tablero en 100 %");
    menosZoom.title = "Alejar (Ctrl + rueda)";
    masZoom.title = "Acercar (Ctrl + rueda)";
    botonZoom.title = "Volver al 100 %";
    // Ctrl + rueda (o el pellizco del panel táctil) sobre el tablero.
    lienzo.addEventListener("wheel", (e) => {
        if (!e.ctrlKey || !HAY_ZOOM || enMovil.matches) {
            return;
        }
        e.preventDefault();
        ponerZoom((estado.zoom || 1) * Math.exp(-e.deltaY * 0.002), false);
        clearTimeout(lienzo.esperaZoom);
        lienzo.esperaZoom = setTimeout(() => ponerZoom(estado.zoom, true), 300);
    }, { passive: false });
    // El pellizco con dos dedos en el fondo del tablero (en la tableta).
    const dedos = new Map();
    let pellizco = null;
    lienzo.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "touch" || e.target !== lienzo || !HAY_ZOOM || enMovil.matches) {
            return;
        }
        dedos.set(e.pointerId, [e.clientX, e.clientY]);
        if (dedos.size === 2) {
            const [a, b] = Array.from(dedos.values());
            pellizco = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: estado.zoom || 1 };
        }
    });
    lienzo.addEventListener("pointermove", (e) => {
        if (!dedos.has(e.pointerId)) {
            return;
        }
        dedos.set(e.pointerId, [e.clientX, e.clientY]);
        if (pellizco && dedos.size === 2) {
            const [a, b] = Array.from(dedos.values());
            ponerZoom(pellizco.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pellizco.d, false);
        }
    });
    const sinDedo = (e) => {
        if (dedos.delete(e.pointerId) && pellizco && dedos.size < 2) {
            pellizco = null;
            ponerZoom(estado.zoom, true);
        }
    };
    lienzo.addEventListener("pointerup", sinDedo);
    lienzo.addEventListener("pointercancel", sinDedo);

    function colorTablero() {
        const t = TABLEROS.find((x) => x[0] === estado.color && x[2]);
        lienzo.classList.toggle("con-tablero", !!t);
        if (t) {
            const claro = parseInt(t[2].slice(1, 3), 16) + parseInt(t[2].slice(3, 5), 16) + parseInt(t[2].slice(5, 7), 16) > 384;
            lienzo.style.setProperty("--tablero", t[2]);
            lienzo.style.setProperty("--tablero-raya", claro ? "rgba(0, 0, 0, 0.14)" : "rgba(255, 255, 255, 0.1)");
        } else {
            lienzo.style.removeProperty("--tablero");
            lienzo.style.removeProperty("--tablero-raya");
        }
        ponerZoom(estado.zoom || 1, false);
    }

    // Los niveles de zoom, y ponerlo (con aviso si lo ha pedido alguien).
    const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
    function ponerZoom(z, decirlo) {
        z = Math.min(2, Math.max(0.25, Math.round(z * 100) / 100));
        estado.zoom = z;
        lienzo.style.zoom = zoomAhora() === 1 ? "" : String(zoomAhora());
        if (botonZoom) {
            botonZoom.textContent = Math.round(z * 100) + " %";
            menosZoom.disabled = z <= ZOOMS[0];
            masZoom.disabled = z >= ZOOMS[ZOOMS.length - 1];
        }
        crecerLienzo();
        if (decirlo) {
            guardar();
            avisar("Zoom del tablero: " + Math.round(z * 100) + " %.");
        }
    }
    const pasoZoom = (sentido) => {
        const z = estado.zoom || 1;
        const sig = sentido > 0 ? ZOOMS.find((x) => x > z + 0.001) : ZOOMS.slice().reverse().find((x) => x < z - 0.001);
        ponerZoom(sig || z, true);
    };

    function activar(pf, foco) {
        // Las ventanas del que se deja se desmontan: al volver se montan
        // de nuevo con lo guardado (así la iniciativa o las notas de dos
        // perfiles nunca se pisan).
        estado.modulos.forEach((m) => {
            m.el = null;
        });
        estado = pf;
        guardar();
        colorTablero();
        pintarPestanas(foco);
        pintarTodo();
    }

    function pintarPestanas(foco) {
        tablist.replaceChildren(...todo.perfiles.map((pf, i) => {
            const b = botonDe("master-pestana", pf.nombre, () => {
                if (pf !== estado) {
                    activar(pf, true);
                    avisar("Perfil: " + pf.nombre + ".");
                }
            });
            b.setAttribute("role", "tab");
            b.id = "master-pestana-" + pf.id;
            b.setAttribute("aria-controls", lienzo.id || (lienzo.id = "master-lienzo"));
            const activa = pf === estado;
            b.setAttribute("aria-selected", activa ? "true" : "false");
            b.tabIndex = activa ? 0 : -1;
            b.addEventListener("keydown", (e) => {
                const d = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: todo.perfiles.length - 1 - i }[e.key];
                if (d === undefined) {
                    return;
                }
                e.preventDefault();
                const otro = todo.perfiles[(i + d + todo.perfiles.length) % todo.perfiles.length];
                activar(otro, true);
            });
            b.addEventListener("dblclick", () => renombrar());
            return b;
        }));
        lienzo.setAttribute("aria-labelledby", "master-pestana-" + estado.id);
        botonCerrar.disabled = todo.perfiles.length < 2;
        if (foco) {
            tablist.querySelector('[aria-selected="true"]').focus();
        }
    }

    function renombrar() {
        const cuerpo = crear("form", "master-personalizar");
        const et = crear("label", "oc-dados-etiqueta", "nombre del perfil");
        // El color del tablero (el fondo del lienzo).
        const grupo = crear("fieldset", "master-colores");
        grupo.appendChild(crear("legend", "oc-dados-etiqueta", "color del tablero"));
        let elegido = estado.color || "";
        const muestras = TABLEROS.map(([valor, nombre, hex]) => {
            const b = botonDe("master-color" + (valor ? "" : " es-ninguno"), "", () => {
                elegido = valor;
                muestras.forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
            }, nombre);
            b.title = nombre;
            if (hex) {
                b.style.backgroundColor = hex;
            }
            b.setAttribute("aria-pressed", valor === elegido ? "true" : "false");
            grupo.appendChild(b);
            return b;
        });
        const input = crear("input", "oc-dados-texto");
        input.id = "master-perfil-nombre";
        input.value = estado.nombre;
        input.maxLength = 30;
        input.autocomplete = "off";
        et.htmlFor = input.id;
        const listo = crear("button", "oc-vida-accion es-principal", "guardar");
        listo.type = "submit";
        const comoPlantilla = botonDe("oc-vida-accion", "💾 guardar como plantilla", () => {
            const lista = leerPlantillas();
            lista.push({ id: Date.now().toString(36), nombre: input.value.trim() || estado.nombre,
                ventanas: estado.modulos.map((x) => ({ tipo: x.tipo, x: x.x, y: x.y, w: x.w, h: x.h, titulo: x.titulo || "",
                    color: x.color || "", escala: x.escala || 1, movible: !!x.movible })) });
            guardarPlantillas(lista);
            avisar("Guardada la plantilla «" + (input.value.trim() || estado.nombre) + "»: sale al crear un perfil con ＋.");
        }, "Guardar las ventanas de este perfil como plantilla");
        comoPlantilla.title = "Las ventanas, donde están, sin lo que tienen dentro";
        const botonesPerfil = crear("div", "master-notas-botones");
        botonesPerfil.append(listo, comoPlantilla);
        cuerpo.append(et, input, grupo, botonesPerfil);
        cuerpo.addEventListener("submit", (e) => {
            e.preventDefault();
            estado.nombre = input.value.trim() || estado.nombre;
            estado.color = elegido;
            colorTablero();
            guardar();
            cerrar();
            pintarPestanas(true);
            avisar("Perfil: " + estado.nombre + ".");
        });
        const cerrar = window.ocVentana.abrir({ titulo: "nombre y color del perfil", cuerpo, vuelta: botonRenombrar, foco: input });
    }

    // LAS PLANTILLAS DE PERFIL: las de aquí (unas ventanas que se ponen
    // ordenadas) y las propias («💾 guardar como plantilla» en el ✎ del
    // perfil: sus ventanas, donde estaban, sin lo que tienen dentro;
    // «richi-master-plantillas»).
    const PLANTILLAS = [["vacio", "⬜ vacío", "Sin ventanas.", []],
        ["combate", "⚔️ combate", "Iniciativa, dados, tiradas, condiciones, acciones y bestiario.",
            ["iniciativa", "dados", "registro", "condiciones", "acciones", "bestiario"]],
        ["exploracion", "🧭 exploración", "Encuentros, dados, relojes, calendario, reglas y notas.",
            ["encuentros", "dados", "relojes", "calendario", "reglas", "notas"]],
        ["social", "🗣️ rol y social", "PNJ, nombres, idiomas, tienda y notas.", ["pnj", "nombres", "idiomas", "tienda", "notas"]],
        ["preparar", "📋 preparar la sesión", "Dungeon, PNJ, botín, encuentros y un post-it.",
            ["dungeon", "pnj", "botin", "encuentros", "tarjeta"]]];
    const leerPlantillas = () => {
        try {
            const x = JSON.parse(localStorage.getItem(CLAVE_PLANTILLAS) || "[]");
            return Array.isArray(x) ? x : [];
        } catch (e) {
            return [];
        }
    };
    const guardarPlantillas = (lista) => {
        try {
            localStorage.setItem(CLAVE_PLANTILLAS, JSON.stringify(lista));
        } catch (e) {
            avisar("No se ha podido guardar la plantilla.");
        }
    };

    function perfilNuevo() {
        const cuerpo = crear("form", "master-personalizar");
        const et = crear("label", "oc-dados-etiqueta", "nombre del perfil");
        const input = crear("input", "oc-dados-texto");
        input.id = "master-perfil-nuevo";
        input.value = "perfil " + (todo.perfiles.length + 1);
        input.maxLength = 30;
        input.autocomplete = "off";
        et.htmlFor = input.id;
        const grupo = crear("fieldset", "master-plantillas");
        grupo.appendChild(crear("legend", "oc-dados-etiqueta", "con qué ventanas"));
        const propias = leerPlantillas();
        const opcion = (valor, nombre, desc, borrable) => {
            const caja = crear("div", "master-plantilla");
            const radio = crear("input");
            radio.type = "radio";
            radio.name = "master-plantilla";
            radio.value = valor;
            radio.id = "master-plantilla-" + valor;
            const lab = crear("label", "master-plantilla-texto");
            lab.htmlFor = radio.id;
            lab.append(crear("strong", "", nombre), crear("span", "", desc));
            caja.append(radio, lab);
            if (borrable) {
                const quitar = botonDe("master-nombre-boton", "✕", () => {
                    guardarPlantillas(leerPlantillas().filter((x) => x.id !== borrable));
                    caja.remove();
                    avisar("Plantilla quitada: " + nombre + ".");
                }, "Quitar la plantilla " + nombre);
                caja.appendChild(quitar);
            }
            grupo.appendChild(caja);
            return radio;
        };
        const radios = PLANTILLAS.map(([v, n, desc]) => opcion(v, n, desc));
        propias.forEach((pl) => radios.push(opcion("propia-" + pl.id, "💾 " + pl.nombre, pl.ventanas.length + " ventanas, donde las dejaste.",
            pl.id)));
        radios[0].checked = true;
        const listo = crear("button", "oc-vida-accion es-principal", "＋ crear");
        listo.type = "submit";
        cuerpo.append(et, input, grupo, listo);
        cuerpo.addEventListener("submit", (e) => {
            e.preventDefault();
            const elegida = (grupo.querySelector("input:checked") || radios[0]).value;
            const pf = { id: "p" + siguientePerfil++, nombre: input.value.trim() || "perfil " + (todo.perfiles.length + 1), modulos: [] };
            const propia = propias.find((x) => "propia-" + x.id === elegida);
            if (propia) {
                pf.modulos = propia.ventanas.filter((v) => MODULOS[v.tipo]).map((v) => Object.assign({}, v, { id: "m" + siguienteId++ }));
            } else {
                const pl = PLANTILLAS.find((x) => x[0] === elegida) || PLANTILLAS[0];
                pf.modulos = pl[3].map((tipo) => ({ id: "m" + siguienteId++, tipo, x: 0, y: 0, w: MODULOS[tipo].w, h: MODULOS[tipo].h }));
            }
            cerrar();
            todo.perfiles.push(pf);
            activar(pf, true);
            if (!propia) {
                ordenar();
                pintarTodo();
                guardar();
            }
            avisar("Perfil nuevo: " + pf.nombre + (pf.modulos.length ? ", con " + pf.modulos.length + " ventanas." : "."));
        });
        const cerrar = window.ocVentana.abrir({ titulo: "perfil nuevo", cuerpo, vuelta: botonNueva, foco: input });
    }

    const botonNueva = botonDe("master-pestana-mando", "＋", () => perfilNuevo(), "Perfil nuevo");
    botonNueva.title = "Perfil nuevo";
    const botonRenombrar = botonDe("master-pestana-mando", "✎", renombrar, "Nombre y color de este perfil");
    botonRenombrar.title = "Nombre y color de este perfil";
    botonRenombrar.setAttribute("aria-haspopup", "dialog");
    let seguroCerrar = false;
    const botonCerrar = botonDe("master-pestana-mando", "✕", () => {
        if (todo.perfiles.length < 2) {
            return;
        }
        if (!seguroCerrar) {
            seguroCerrar = true;
            botonCerrar.setAttribute("aria-label", "¿Seguro? Pulsa otra vez para cerrar " + estado.nombre);
            avisar("Pulsa otra vez para cerrar el perfil " + estado.nombre + " y sus ventanas.");
            setTimeout(() => {
                seguroCerrar = false;
                botonCerrar.setAttribute("aria-label", "Cerrar este perfil");
            }, 4000);
            return;
        }
        seguroCerrar = false;
        botonCerrar.setAttribute("aria-label", "Cerrar este perfil");
        const i = todo.perfiles.indexOf(estado);
        const nombre = estado.nombre;
        todo.perfiles.splice(i, 1);
        estado.modulos.forEach((m) => {
            m.el = null;
        });
        estado = todo.perfiles[Math.max(0, i - 1)];
        colorTablero();
        guardar();
        pintarPestanas(true);
        pintarTodo();
        avisar("Cerrado: " + nombre + ".");
    }, "Cerrar este perfil");
    botonCerrar.title = "Cerrar este perfil";
    const mandosPestanas = crear("div", "master-pestanas-mandos");
    mandosPestanas.append(botonNueva, botonRenombrar, botonCerrar);
    pestanas.append(tablist, mandosPestanas);

    // Todo en una línea: las pestañas a la izquierda; «＋ añadir» y los
    // dados (que pone personajes.js en la barra), a la derecha.
    const mandos = crear("div", "master-barra-mandos");
    const zoomCaja = crear("div", "master-zoom");
    zoomCaja.setAttribute("role", "group");
    zoomCaja.setAttribute("aria-label", "Zoom del tablero");
    zoomCaja.append(menosZoom, botonZoom, masZoom);
    zoomCaja.hidden = !HAY_ZOOM;
    const botonAtajos = botonDe("master-pestana-mando", "⌨", () => verAtajos(), "Atajos de teclado");
    botonAtajos.title = "Atajos de teclado (?)";
    botonAtajos.setAttribute("aria-haspopup", "dialog");
    botonAtajos.setAttribute("aria-keyshortcuts", "?");
    mandos.append(montarBuscador(), zoomCaja, botonAtajos, botonAnadir);
    const dados = barra.querySelector(".oc-boton-dados");
    if (dados) {
        mandos.appendChild(dados);
    }
    barra.prepend(pestanas, mandos);

    // ---- LOS ATAJOS DE TECLADO (fuera de los campos de texto y sin
    // ventana modal abierta): «?» o ⌨ los enseña todos. ----
    const ATAJOS = [
        ["El tablero", [["/", "ir al buscador"], ["A", "añadir una ventana"], ["N", "post-it nuevo"], ["D", "los dados"],
            ["I", "la iniciativa (la abre si no está)"], ["+ / −", "acercar o alejar el tablero"], ["0", "el tablero al 100 %"],
            ["[ / ]", "perfil anterior o siguiente"], ["?", "estos atajos"]]],
        ["Las ventanas", [["✥ + flechas", "moverla (con Mayús, más deprisa)"], ["✥ + Alt + flechas", "cambiar su tamaño"],
            ["Intro en el nombre", "plegarla o desplegarla"], ["Esc", "cerrar una ventana modal"]]],
        ["El dibujo (con el foco en el lienzo)", [["B", "lápiz"], ["E", "goma"], ["G", "bote"], ["M", "seleccionar y mover"],
            ["I", "cuentagotas"], ["L", "línea"], ["U", "rectángulo"], ["O", "elipse"], ["T", "texto"], ["Ctrl+Z / Ctrl+Y", "deshacer y rehacer"],
            ["flechas", "mover la selección (Mayús: de 10 en 10)"], ["+ / −", "agrandar o encoger la selección"],
            ["Supr", "borrar la selección"], ["Esc", "soltar la selección"], ["Ctrl+V", "pegar una imagen"]]],
        ["Post-its y notas", [["Ctrl+B / I / U", "negrita, cursiva, subrayado"], ["Ctrl+Z / Ctrl+Y", "deshacer y rehacer"],
            ["← → en la barra", "ir de un botón a otro"]]],
        ["El buscador", [["↓ ↑", "por los resultados"], ["Intro", "abrir el elegido"], ["Esc", "cerrar"]]],
    ];

    function verAtajos() {
        const cuerpo = crear("div", "master-atajos");
        ATAJOS.forEach(([titulo, lista]) => {
            cuerpo.appendChild(crear("h3", "master-atajos-titulo", titulo));
            const dl = crear("dl", "master-atajos-lista");
            lista.forEach(([tecla, que]) => {
                const dt = crear("dt");
                tecla.split(" / ").forEach((t, i) => {
                    if (i) {
                        dt.appendChild(document.createTextNode(" / "));
                    }
                    dt.appendChild(crear("kbd", "", t));
                });
                dl.append(dt, crear("dd", "", que));
            });
            cuerpo.appendChild(dl);
        });
        window.ocVentana.abrir({ titulo: "atajos de teclado", cuerpo, vuelta: botonAtajos, clase: "es-ancha" });
    }

    document.addEventListener("keydown", (e) => {
        if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || !lienzo.isConnected) {
            return;
        }
        const t = e.target;
        if (t && t.closest && t.closest("input, textarea, select, canvas, [contenteditable='true']")) {
            return;
        }
        if (window.ventanaModal && window.ventanaModal.abierta && window.ventanaModal.abierta()) {
            return;
        }
        const tecla = e.key;
        const hacer = {
            "/": () => {
                const b = document.getElementById("master-buscador");
                if (b) {
                    b.focus();
                }
            },
            "?": verAtajos,
            a: () => botonAnadir.click(),
            n: () => anadir("tarjeta"),
            d: () => {
                const b = document.querySelector(".oc-boton-dados");
                if (b) {
                    b.click();
                }
            },
            i: () => {
                const m = estado.modulos.find((x) => x.tipo === "iniciativa");
                if (m && m.el) {
                    alFrente(m);
                    m.el.scrollIntoView({ block: "nearest" });
                    m.el.querySelector(".master-ventana-nombre").focus();
                } else {
                    anadir("iniciativa");
                }
            },
            "+": () => pasoZoom(1),
            "=": () => pasoZoom(1),
            "-": () => pasoZoom(-1),
            "0": () => ponerZoom(1, true),
            "[": () => cambiarPerfil(-1),
            "]": () => cambiarPerfil(1),
        }[tecla.length === 1 ? tecla.toLowerCase() : tecla];
        if (hacer) {
            e.preventDefault();
            hacer();
        }
    });

    function cambiarPerfil(paso) {
        const i = todo.perfiles.indexOf(estado);
        const pf = todo.perfiles[(i + paso + todo.perfiles.length) % todo.perfiles.length];
        if (pf !== estado) {
            activar(pf, true);
            avisar("Perfil: " + pf.nombre + ".");
        }
    }

    lienzo.classList.add("con-lienzo");
    colorTablero();
    pintarPestanas(false);
    pintarTodo();
    if (enMovil.addEventListener) {
        enMovil.addEventListener("change", pintarTodo);
    }
})();
