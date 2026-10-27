/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/personajes.js
*/
const ocPestanas = document.querySelector("[data-oc-pestanas]");
const ocPanel = document.querySelector("[data-oc-panel]");
const ocSubpestanas = document.querySelector("[data-oc-subpestanas]");
const ocSubpanel = document.querySelector("[data-oc-subpanel]");
if (ocPestanas && ocPanel) {
    montarPestanasDePersonaje(ocPestanas, ocPanel, { apartado: "data-oc-apartado", prefijo: "oc-pestana-",
        clase: "oc-pestana", lista: "oc-pestanas-lista", conDireccion: true });
}
if (ocSubpestanas && ocSubpanel) {
    montarPestanasDePersonaje(ocSubpestanas, ocSubpanel, { apartado: "data-oc-subapartado",
        prefijo: "oc-subpestana-", clase: "oc-subpestana", lista: "oc-subpestanas-lista", conDireccion: false,
        vertical: true });
}
function montarPestanasDePersonaje(menu, panel, o) {
    const enlaces = Array.from(menu.querySelectorAll("[data-oc-pestana]"));
    const apartados = enlaces.map((a) => panel.querySelector("[" + o.apartado + "='" + a.dataset.ocPestana + "']"));
    if (!enlaces.length || apartados.some((x) => !x)) {
        return;
    }
    const lista = document.createElement("div");
    lista.className = o.lista;
    lista.setAttribute("role", "tablist");
    lista.setAttribute("aria-label", menu.getAttribute("aria-label") || "Apartados");
    if (o.vertical) {
        lista.setAttribute("aria-orientation", "vertical");
    }
    const botones = enlaces.map((a, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = o.clase;
        b.id = o.prefijo + a.dataset.ocPestana;
        [...a.childNodes].forEach((n) => b.appendChild(n.cloneNode(true)));
        b.setAttribute("role", "tab");
        b.setAttribute("aria-controls", apartados[i].id);
        b.dataset.ocPestana = a.dataset.ocPestana;
        lista.appendChild(b);
        return b;
    });
    menu.replaceWith(lista);
    panel.classList.add("con-pestanas");
    apartados.forEach((ap, i) => {
        ap.setAttribute("role", "tabpanel");
        ap.setAttribute("aria-labelledby", botones[i].id);
        ap.tabIndex = 0;
    });
    function elegir(i, conFoco, apuntar) {
        botones.forEach((b, j) => {
            const es = j === i;
            b.setAttribute("aria-selected", es ? "true" : "false");
            b.tabIndex = es ? 0 : -1;
            apartados[j].hidden = !es;
        });
        if (conFoco) {
            botones[i].focus();
        }
        if (apuntar && o.conDireccion) {
            try {
                history.replaceState(null, "", "#" + apartados[i].id);
            } catch (error) {
            }
        }
    }
    botones.forEach((b, i) => {
        b.addEventListener("click", () => elegir(i, false, true));
        b.addEventListener("keydown", (evento) => {
            const ultimo = botones.length - 1;
            const a = {
                ArrowRight: i === ultimo ? 0 : i + 1,
                ArrowLeft: i === 0 ? ultimo : i - 1,
                ArrowDown: o.vertical ? (i === ultimo ? 0 : i + 1) : undefined,
                ArrowUp: o.vertical ? (i === 0 ? ultimo : i - 1) : undefined,
                Home: 0,
                End: ultimo,
            }[evento.key];
            if (a === undefined) {
                return;
            }
            evento.preventDefault();
            elegir(a, true, true);
        });
    });
    function desdeLaDireccion() {
        const pedido = decodeURIComponent((location.hash || "").slice(1));
        const i = apartados.findIndex((ap) => ap.id === pedido);
        return i < 0 ? 0 : i;
    }
    if (o.conDireccion) {
        window.addEventListener("hashchange", () => elegir(desdeLaDireccion(), false, false));
        elegir(desdeLaDireccion(), false, false);
    } else {
        elegir(0, false, false);
    }
}
(function () {
    const marcas = Array.from(document.querySelectorAll(".oc-dado[data-dados]"));
    const sitioDelBoton = document.querySelector("[data-oc-botones]");
    if (!marcas.length && !sitioDelBoton) {
        return;
    }
    const CARAS = [4, 6, 8, 10, 12, 20, 100];
    const estado = { mano: {}, modo: "normal", tiradas: [], cuenta: 0, sonido: leer("richi-dados-sonido") !== "no" };
    function leer(clave) {
        try {
            return localStorage.getItem(clave);
        } catch (e) {
            return null;
        }
    }
    function guardar(clave, valor) {
        try {
            localStorage.setItem(clave, valor);
        } catch (e) {
        }
    }
    function alAzar(caras) {
        const u = new Uint32Array(1);
        const tope = Math.floor(0x100000000 / caras) * caras;
        do {
            crypto.getRandomValues(u);
        } while (u[0] >= tope);
        return (u[0] % caras) + 1;
    }
    let audio = null;
    function sonar() {
        if (!estado.sonido) {
            return;
        }
        try {
            audio = audio || new (window.AudioContext || window.webkitAudioContext)();
            if (audio.state === "suspended") {
                audio.resume();
            }
            const largo = Math.floor(audio.sampleRate * 0.03);
            const ruido = audio.createBuffer(1, largo, audio.sampleRate);
            const datos = ruido.getChannelData(0);
            for (let i = 0; i < largo; i++) {
                datos[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / largo, 3);
            }
            let cuando = audio.currentTime + 0.01;
            for (let n = 0; n < 7; n++) {
                const golpe = audio.createBufferSource();
                golpe.buffer = ruido;
                const filtro = audio.createBiquadFilter();
                filtro.type = "bandpass";
                filtro.frequency.value = 1800 + Math.random() * 2200;
                filtro.Q.value = 3;
                const volumen = audio.createGain();
                volumen.gain.value = 0.55 * Math.pow(0.78, n);
                golpe.connect(filtro).connect(volumen).connect(audio.destination);
                golpe.start(cuando);
                cuando += 0.035 + n * 0.018 + Math.random() * 0.02;
            }
        } catch (e) {
        }
    }
    function trozosDe(formula) {
        const trozos = [];
        const texto = String(formula).replace(/−/g, "-").replace(/\s+/g, "");
        const patron = /([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/g;
        let m;
        while ((m = patron.exec(texto))) {
            if (m[3]) {
                trozos.push({ signo: m[1] === "-" ? -1 : 1, cuantos: Math.min(parseInt(m[2] || "1", 10), 100),
                    caras: parseInt(m[3], 10) });
            } else {
                trozos.push({ signo: m[4] === "-" ? -1 : 1, fijo: parseInt(m[5], 10) });
            }
        }
        return trozos;
    }
    function tirar(formula, que) {
        const trozos = trozosDe(formula);
        if (!trozos.length) {
            return null;
        }
        const d20s = trozos.filter((t) => t.caras === 20).reduce((n, t) => n + t.cuantos, 0);
        const conVentaja = estado.modo !== "normal" && d20s === 1;
        let total = 0;
        let natural = null;
        const partes = [];
        trozos.forEach((t) => {
            if (t.fijo !== undefined) {
                total += t.signo * t.fijo;
                partes.push((t.signo < 0 ? "− " : "+ ") + t.fijo);
                return;
            }
            const salen = [];
            for (let i = 0; i < t.cuantos; i++) {
                if (t.caras === 20 && conVentaja) {
                    const a = alAzar(20);
                    const b = alAzar(20);
                    const queda = estado.modo === "ventaja" ? Math.max(a, b) : Math.min(a, b);
                    salen.push(queda + " (" + a + " y " + b + ", " + estado.modo + ")");
                    total += t.signo * queda;
                    natural = queda;
                } else {
                    const x = alAzar(t.caras);
                    salen.push(String(x));
                    total += t.signo * x;
                    if (t.caras === 20 && t.cuantos === 1) {
                        natural = x;
                    }
                }
            }
            partes.push((partes.length ? (t.signo < 0 ? "− " : "+ ") : (t.signo < 0 ? "− " : ""))
                + t.cuantos + "d" + t.caras + " [" + salen.join(", ") + "]");
        });
        estado.cuenta += 1;
        const r = { id: estado.cuenta, que: que || "tirada", formula: String(formula), total,
            desglose: partes.join(" "), critico: d20s === 1 && natural === 20,
            pifia: d20s === 1 && natural === 1 };
        sonar();
        anadir(r);
        return r;
    }
    const SILUETAS = {
        4: '<polygon points="12,3 22,20 2,20"/><path d="M12 3 L12 20"/>',
        6: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/>',
        8: '<polygon points="12,2 21,12 12,22 3,12"/><path d="M3 12 H21"/>',
        10: '<polygon points="12,2 21,10 12,22 3,10"/><path d="M3 10 L12 14 L21 10 M12 14 V22"/>',
        12: '<polygon points="12,2 21.5,9 18,20.5 6,20.5 2.5,9"/><polygon points="12,7 16.5,10.5 15,16 9,16 7.5,10.5"/>',
        20: '<polygon points="12,2 21,7 21,17 12,22 3,17 3,7"/><polygon points="12,7 17,15.5 7,15.5"/>',
        100: '<polygon points="7,3 12,9 7,21 2,9"/><polygon points="17,3 22,9 17,21 12,9"/>',
    };
    function silueta(caras) {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("class", "oc-dados-silueta");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        svg.innerHTML = SILUETAS[caras];
        return svg;
    }
    let ventana = null;
    let boton = null;
    let historial = null;
    let aviso = null;
    let manoTexto = null;
    let tirarBoton = null;
    let modInput = null;
    let borrarTodo = null;
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
    function modificador() {
        return parseInt(modInput.value || "0", 10) || 0;
    }
    function formulaDeLaMano() {
        const trozos = CARAS.filter((c) => estado.mano[c]).sort((a, b) => b - a)
            .map((c) => estado.mano[c] + "d" + c);
        let texto = trozos.join(" + ");
        const mod = modificador();
        if (mod) {
            texto += (mod > 0 ? " + " : " − ") + Math.abs(mod);
        }
        return texto;
    }
    function pintarMano() {
        const hay = CARAS.some((c) => estado.mano[c]);
        manoTexto.textContent = hay ? formulaDeLaMano() : "elige los dados de arriba";
        tirarBoton.disabled = !hay;
    }
    function montar() {
        ventana = crear("div", "oc-dados");
        ventana.id = "oc-dados";
        ventana.setAttribute("role", "region");
        ventana.setAttribute("aria-label", "Lanzador de dados");
        ventana.hidden = true;
        const barra = crear("div", "oc-dados-barra");
        barra.title = "Arrástrala para moverla";
        const titulo = crear("h2", "oc-dados-titulo");
        const emoji = crear("span", "oc-dados-emoji", "🎲");
        emoji.setAttribute("aria-hidden", "true");
        titulo.append(emoji, document.createTextNode("dados.exe"));
        const sonido = botonDe("oc-dados-mando", estado.sonido ? "🔊" : "🔇", () => {
            estado.sonido = !estado.sonido;
            sonido.textContent = estado.sonido ? "🔊" : "🔇";
            sonido.setAttribute("aria-pressed", estado.sonido ? "true" : "false");
            guardar("richi-dados-sonido", estado.sonido ? "si" : "no");
        }, "Sonido al tirar");
        sonido.setAttribute("aria-pressed", estado.sonido ? "true" : "false");
        const cerrar = botonDe("oc-dados-mando", "✕", () => abrir(false, true), "Cerrar los dados");
        const mandos = crear("div", "oc-dados-mandos");
        mandos.append(sonido, cerrar);
        barra.append(titulo, mandos);
        arrastrable(barra);
        const cuerpo = crear("div", "oc-dados-cuerpo");
        const bandeja = crear("div", "oc-dados-bandeja");
        bandeja.setAttribute("role", "group");
        bandeja.setAttribute("aria-label", "Añadir dados");
        CARAS.forEach((c) => {
            const b = botonDe("oc-dados-cara", undefined, () => {
                estado.mano[c] = (estado.mano[c] || 0) + 1;
                pintarMano();
            }, "Añadir un d" + c);
            b.append(silueta(c), crear("span", "oc-dados-cara-nombre", "d" + c));
            bandeja.appendChild(b);
        });
        manoTexto = crear("p", "oc-dados-mano");
        const fila = crear("div", "oc-dados-fila");
        const etiqueta = crear("label", "oc-dados-etiqueta", "modificador");
        modInput = crear("input", "oc-dados-mod");
        modInput.type = "number";
        modInput.id = "oc-dados-mod";
        modInput.value = "0";
        modInput.step = "1";
        etiqueta.htmlFor = modInput.id;
        modInput.addEventListener("input", pintarMano);
        const cambiar = (n) => {
            modInput.value = String(modificador() + n);
            pintarMano();
        };
        const menos = botonDe("oc-dados-paso", "−", () => cambiar(-1), "Restar 1 al modificador");
        const mas = botonDe("oc-dados-paso", "+", () => cambiar(1), "Sumar 1 al modificador");
        const caja = crear("div", "oc-dados-mod-caja");
        caja.append(menos, modInput, mas);
        fila.append(etiqueta, caja);
        const modos = crear("div", "oc-dados-modos");
        modos.setAttribute("role", "group");
        modos.setAttribute("aria-label", "Ventaja o desventaja (para lo que se tira con un d20)");
        const botonesModo = ["normal", "ventaja", "desventaja"].map((m) => {
            const b = botonDe("oc-dados-modo", m, () => {
                estado.modo = m;
                botonesModo.forEach((x) => x.setAttribute("aria-pressed", x.textContent === m ? "true" : "false"));
            });
            b.setAttribute("aria-pressed", m === estado.modo ? "true" : "false");
            modos.appendChild(b);
            return b;
        });
        const acciones = crear("div", "oc-dados-acciones");
        tirarBoton = botonDe("oc-dados-tirar", "tirar", () => tirar(formulaDeLaMano(), "bandeja"));
        const vaciar = botonDe("oc-dados-vaciar", "vaciar", () => {
            estado.mano = {};
            modInput.value = "0";
            pintarMano();
        }, "Vaciar la bandeja");
        acciones.append(tirarBoton, vaciar);
        const cabeza = crear("div", "oc-dados-cabeza-historial");
        cabeza.appendChild(crear("h3", "oc-dados-subtitulo", "tiradas"));
        borrarTodo = botonDe("oc-dados-borrar-todo", "borrar todo", () => {
            estado.tiradas = [];
            pintarHistorial();
            avisar("Tiradas borradas.");
        }, "Borrar todas las tiradas");
        cabeza.appendChild(borrarTodo);
        historial = crear("ol", "oc-dados-historial");
        aviso = crear("p", "visually-hidden");
        aviso.setAttribute("role", "status");
        cuerpo.append(bandeja, manoTexto, fila, modos, acciones, cabeza, historial, aviso);
        ventana.append(barra, cuerpo);
        ventana.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                abrir(false, true);
            }
        });
        document.body.appendChild(ventana);
        colocarDondeEstaba();
        pintarMano();
        pintarHistorial();
    }
    function dejarDentro(x, y) {
        const ancho = ventana.offsetWidth;
        const alto = ventana.offsetHeight;
        return [Math.min(Math.max(0, x), Math.max(0, window.innerWidth - ancho)),
            Math.min(Math.max(0, y), Math.max(0, window.innerHeight - Math.min(alto, 60)))];
    }
    function ponerEn(x, y) {
        const [a, b] = dejarDentro(x, y);
        ventana.style.left = a + "px";
        ventana.style.top = b + "px";
        ventana.style.right = "auto";
        ventana.style.bottom = "auto";
        ventana.style.maxHeight = Math.max(200, window.innerHeight - b - 12) + "px";
        return [a, b];
    }
    function colocarDondeEstaba() {
        const sitio = (leer("richi-dados-sitio") || "").split(",").map(Number);
        if (sitio.length === 2 && sitio.every(Number.isFinite)) {
            ventana.dataset.sitio = sitio.join(",");
        }
    }
    function arrastrable(barra) {
        let desde = null;
        barra.addEventListener("pointerdown", (e) => {
            if (e.button !== 0 || e.target.closest("button")) {
                return;
            }
            const caja = ventana.getBoundingClientRect();
            desde = { x: e.clientX - caja.left, y: e.clientY - caja.top };
            barra.setPointerCapture(e.pointerId);
            ventana.classList.add("se-mueve");
            e.preventDefault();
        });
        barra.addEventListener("pointermove", (e) => {
            if (desde) {
                ponerEn(e.clientX - desde.x, e.clientY - desde.y);
            }
        });
        const soltar = () => {
            if (!desde) {
                return;
            }
            desde = null;
            ventana.classList.remove("se-mueve");
            guardar("richi-dados-sitio", parseInt(ventana.style.left, 10) + "," + parseInt(ventana.style.top, 10));
        };
        barra.addEventListener("pointerup", soltar);
        barra.addEventListener("pointercancel", soltar);
        window.addEventListener("resize", () => {
            if (!ventana.hidden && ventana.style.left) {
                ponerEn(parseInt(ventana.style.left, 10), parseInt(ventana.style.top, 10));
            }
        });
    }
    function abrir(si, devolverFoco) {
        ventana.hidden = !si;
        if (si && ventana.dataset.sitio) {
            const [x, y] = ventana.dataset.sitio.split(",").map(Number);
            delete ventana.dataset.sitio;
            ponerEn(x, y);
        } else if (si && ventana.style.left) {
            ponerEn(parseInt(ventana.style.left, 10), parseInt(ventana.style.top, 10));
        }
        if (boton) {
            boton.setAttribute("aria-expanded", si ? "true" : "false");
            if (!si && devolverFoco) {
                boton.focus();
            }
        }
    }
    function avisar(texto) {
        aviso.textContent = "";
        setTimeout(() => {
            aviso.textContent = texto;
        }, 50);
    }
    function anadir(r) {
        if (ventana.hidden) {
            abrir(true, false);
        }
        estado.tiradas.unshift(r);
        estado.tiradas = estado.tiradas.slice(0, 30);
        pintarHistorial();
        avisar(r.que + ": " + r.total + (r.critico ? ", ¡20 natural!" : "") + (r.pifia ? ", 1 natural" : "")
            + ". " + r.desglose);
    }
    function pintarHistorial() {
        historial.replaceChildren(...estado.tiradas.map((r, i) => {
            const li = crear("li", "oc-dados-tirada" + (r.critico ? " es-critico" : "") + (r.pifia ? " es-pifia" : ""));
            li.dataset.id = r.id;
            const cabeza = crear("p", "oc-dados-que");
            cabeza.append(crear("span", "oc-dados-que-nombre", r.que),
                crear("span", "oc-dados-formula", r.formula.replace(/-/g, "−")));
            const total = crear("p", "oc-dados-total", String(r.total));
            if (r.critico || r.pifia) {
                total.appendChild(crear("span", "oc-dados-natural", r.critico ? "¡20 natural!" : "1 natural"));
            }
            const botones = crear("div", "oc-dados-tirada-botones");
            botones.append(
                botonDe("oc-dados-repetir", "↻ repetir", () => tirar(r.formula, r.que), "Repetir: " + r.que),
                botonDe("oc-dados-quitar", "✕", () => quitar(r.id, i), "Borrar esta tirada: " + r.que + ", " + r.total));
            li.append(cabeza, total, crear("p", "oc-dados-desglose", r.desglose), botones);
            return li;
        }));
        borrarTodo.disabled = !estado.tiradas.length;
    }
    function quitar(id, i) {
        estado.tiradas = estado.tiradas.filter((r) => r.id !== id);
        pintarHistorial();
        avisar("Tirada borrada.");
        const quedan = historial.querySelectorAll(".oc-dados-quitar");
        (quedan[Math.min(i, quedan.length - 1)] || tirarBoton).focus();
    }
    montar();
    if (sitioDelBoton) {
        boton = crear("button", "oc-boton oc-boton-dados");
        boton.type = "button";
        boton.title = "Lanzador de dados";
        const dibujo = crear("span", "oc-boton-dados-emoji", "🎲");
        dibujo.setAttribute("aria-hidden", "true");
        boton.append(dibujo, crear("span", "visually-hidden", "dados"));
        boton.setAttribute("aria-controls", "oc-dados");
        boton.setAttribute("aria-expanded", "false");
        boton.addEventListener("click", () => abrir(ventana.hidden, false));
        sitioDelBoton.appendChild(boton);
    }
    marcas.forEach((m) => {
        const b = crear("button", "oc-dado");
        b.type = "button";
        b.dataset.dados = m.dataset.dados;
        b.dataset.que = m.dataset.que || "";
        b.innerHTML = m.innerHTML;
        b.setAttribute("aria-label", m.textContent.trim() + ", tirar " + (m.dataset.que || m.dataset.dados)
            + " (" + m.dataset.dados.replace(/-/g, " menos ") + ")");
        b.title = "Tirar " + m.dataset.dados;
        b.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            tirar(b.dataset.dados, b.dataset.que);
        });
        m.replaceWith(b);
    });
})();
