/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/personajes.js
*/
(function () {
    const menu = document.querySelector("[data-oc-menu]");
    const panel = document.querySelector("[data-oc-panel]");
    const contenedor = document.querySelector("[data-oc-partes]");
    if (!menu || !panel || !contenedor) {
        return;
    }
    const partes = Array.from(contenedor.querySelectorAll("[data-oc-parte]"));
    const ficha = document.getElementById("oc-ficha");
    const enlaces = Array.from(menu.querySelectorAll("a[data-oc-ir]"));
    if (!partes.length) {
        return;
    }
    partes.forEach((p) => {
        p.tabIndex = -1;
    });
    let botonFicha = null;
    const enlaceFicha = menu.querySelector("a[data-oc-grupo]");
    const sub = document.getElementById("oc-menu-ficha");
    if (enlaceFicha && sub) {
        botonFicha = document.createElement("button");
        botonFicha.type = "button";
        botonFicha.className = enlaceFicha.className + " oc-menu-abrir";
        [...enlaceFicha.childNodes].forEach((n) => botonFicha.appendChild(n.cloneNode(true)));
        const flecha = document.createElement("span");
        flecha.className = "oc-menu-flecha";
        flecha.setAttribute("aria-hidden", "true");
        botonFicha.appendChild(flecha);
        botonFicha.setAttribute("aria-controls", sub.id);
        enlaceFicha.replaceWith(botonFicha);
        botonFicha.addEventListener("click", () => {
            const abrir = botonFicha.getAttribute("aria-expanded") !== "true";
            abrirFicha(abrir);
            if (abrir && !(ficha && ficha.contains(actual()))) {
                const primera = sub.querySelector("a[data-oc-ir]");
                if (primera) {
                    mostrar(primera.dataset.ocIr, false, true);
                }
            }
        });
    }
    function abrirFicha(si) {
        if (!botonFicha) {
            return;
        }
        botonFicha.setAttribute("aria-expanded", si ? "true" : "false");
        sub.hidden = !si;
        flechaDe(botonFicha).textContent = si ? "−" : "+";
    }
    function flechaDe(b) {
        return b.querySelector(".oc-menu-flecha");
    }
    let elegida = null;
    function actual() {
        return elegida;
    }
    function mostrar(id, conFoco, apuntar) {
        let parte = document.getElementById(id);
        if (!parte || !partes.includes(parte)) {
            parte = partes[0];
        }
        elegida = parte;
        const enFicha = !!(ficha && ficha.contains(parte));
        partes.forEach((p) => {
            p.hidden = p !== parte;
        });
        if (ficha) {
            ficha.hidden = !enFicha;
        }
        Array.from(contenedor.children).forEach((x) => {
            if (x !== ficha) {
                x.hidden = x !== parte;
            }
        });
        enlaces.forEach((a) => {
            if (a.dataset.ocIr === parte.id) {
                a.setAttribute("aria-current", "true");
            } else {
                a.removeAttribute("aria-current");
            }
        });
        if (botonFicha) {
            botonFicha.classList.toggle("es-la-de-ahora", enFicha);
            if (enFicha) {
                abrirFicha(true);
            }
        }
        contenedor.scrollTop = 0;
        if (conFoco) {
            parte.focus({ preventScroll: true });
        }
        if (apuntar) {
            try {
                history.replaceState(null, "", "#" + parte.id);
            } catch (error) {
            }
        }
    }
    enlaces.forEach((a) => {
        a.addEventListener("click", (e) => {
            e.preventDefault();
            mostrar(a.dataset.ocIr, true, true);
        });
    });
    function desdeLaDireccion() {
        const pedido = decodeURIComponent((location.hash || "").slice(1));
        if (pedido === "oc-ficha" && sub) {
            const primera = sub.querySelector("a[data-oc-ir]");
            return primera ? primera.dataset.ocIr : "";
        }
        return pedido;
    }
    panel.classList.add("con-menu");
    abrirFicha(false);
    window.addEventListener("hashchange", () => mostrar(desdeLaDireccion(), false, false));
    mostrar(desdeLaDireccion(), false, false);
})();
document.querySelectorAll(".oc-ataques th[data-oc-desc]").forEach((th) => {
    const fila = document.getElementById(th.dataset.ocDesc);
    if (!fila) {
        return;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "oc-ataque-abrir";
    const flecha = document.createElement("span");
    flecha.className = "oc-desplegable-flecha";
    flecha.setAttribute("aria-hidden", "true");
    flecha.textContent = "▸";
    b.append(flecha, document.createTextNode(th.textContent));
    b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-controls", fila.id);
    th.replaceChildren(b);
    fila.hidden = true;
    b.addEventListener("click", () => {
        const abrir = fila.hidden;
        fila.hidden = !abrir;
        b.setAttribute("aria-expanded", abrir ? "true" : "false");
    });
});
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
    function sonarFinal(critico) {
        if (!estado.sonido || !audio) {
            return;
        }
        try {
            const notas = critico ? [523, 659, 784, 1047] : [392, 349, 311, 233];
            const empieza = audio.currentTime + 0.42;
            notas.forEach((frecuencia, i) => {
                const osc = audio.createOscillator();
                const volumen = audio.createGain();
                const t = empieza + i * (critico ? 0.09 : 0.16);
                osc.type = critico ? "triangle" : "sawtooth";
                osc.frequency.setValueAtTime(frecuencia, t);
                if (!critico && i === notas.length - 1) {
                    osc.frequency.exponentialRampToValueAtTime(frecuencia * 0.8, t + 0.45);
                }
                const largo = critico ? (i === notas.length - 1 ? 0.5 : 0.14) : (i === notas.length - 1 ? 0.55 : 0.18);
                volumen.gain.setValueAtTime(0.0001, t);
                volumen.gain.exponentialRampToValueAtTime(critico ? 0.22 : 0.09, t + 0.02);
                volumen.gain.exponentialRampToValueAtTime(0.0001, t + largo);
                osc.connect(volumen).connect(audio.destination);
                osc.start(t);
                osc.stop(t + largo + 0.02);
            });
        } catch (e) {
        }
    }
    function trozosDe(formula) {
        const trozos = [];
        const texto = String(formula).replace(/−/g, "-");
        const segmentos = [];
        const conTipo = /([^\[\]]*)\[([^\]]+)\]/g;
        let m;
        let fin = 0;
        while ((m = conTipo.exec(texto))) {
            segmentos.push([m[1], m[2]]);
            fin = conTipo.lastIndex;
        }
        segmentos.push([texto.slice(fin), ""]);
        const patron = /([+-]?)\s*(\d*)d(\d+)|([+-]?)\s*(\d+)/g;
        segmentos.forEach(([trozo, tipo]) => {
            patron.lastIndex = 0;
            while ((m = patron.exec(trozo))) {
                if (m[3]) {
                    trozos.push({ signo: m[1] === "-" ? -1 : 1, cuantos: Math.min(parseInt(m[2] || "1", 10), 100),
                        caras: parseInt(m[3], 10), tipo });
                } else {
                    trozos.push({ signo: m[4] === "-" ? -1 : 1, fijo: parseInt(m[5], 10), tipo });
                }
            }
        });
        return trozos;
    }
    function formulaParaVer(formula) {
        return String(formula).replace(/\s*\[([^\]]+)\]/g, " $1").replace(/\+/g, " + ").replace(/-/g, " − ")
            .replace(/\s+/g, " ").trim();
    }
    function claveDeTipo(tipo) {
        return String(tipo).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
    }
    function tirar(formula, que) {
        const trozos = trozosDe(formula);
        if (!trozos.length) {
            return null;
        }
        const d20s = trozos.filter((t) => t.caras === 20).reduce((n, t) => n + t.cuantos, 0);
        let total = 0;
        const partes = [];
        let d20 = null;
        const tipos = [];
        const sumar = (tipo, n) => {
            if (!tipo) {
                return;
            }
            const ya = tipos.find((x) => x.tipo === tipo);
            if (ya) {
                ya.total += n;
            } else {
                tipos.push({ tipo, total: n });
            }
        };
        trozos.forEach((t) => {
            const signo = partes.length ? (t.signo < 0 ? "− " : "+ ") : (t.signo < 0 ? "− " : "");
            if (t.fijo !== undefined) {
                total += t.signo * t.fijo;
                sumar(t.tipo, t.signo * t.fijo);
                partes.push({ texto: (t.signo < 0 ? "− " : "+ ") + t.fijo });
                return;
            }
            if (t.caras === 20 && d20s === 1) {
                const a = alAzar(20);
                d20 = { d20: true, prefijo: signo, signo: t.signo, valores: [a], modo: "normal", queda: a };
                if (estado.modo !== "normal") {
                    ponerModo(d20, estado.modo);
                }
                total += t.signo * d20.queda;
                partes.push(d20);
                return;
            }
            const salen = [];
            for (let i = 0; i < t.cuantos; i++) {
                const x = alAzar(t.caras);
                salen.push(x);
                total += t.signo * x;
                sumar(t.tipo, t.signo * x);
            }
            partes.push({ texto: signo + t.cuantos + "d" + t.caras + " [" + salen.join(", ") + "]" });
        });
        estado.cuenta += 1;
        const r = { id: estado.cuenta, que: que || "tirada", formula: String(formula), total, partes, d20, tipos };
        acabar(r);
        sonar();
        if (r.critico || r.pifia) {
            sonarFinal(r.critico);
        }
        anadir(r);
        return r;
    }
    function ponerModo(d20, modo) {
        const b = alAzar(20);
        d20.valores = [d20.valores[0], b];
        d20.modo = modo;
        d20.queda = modo === "ventaja" ? Math.max(d20.valores[0], b) : Math.min(d20.valores[0], b);
    }
    function acabar(r) {
        r.desglose = r.partes.map((p) => {
            if (!p.d20) {
                return p.texto;
            }
            return p.prefijo + "1d20 [" + (p.modo === "normal" ? p.queda
                : p.queda + " (" + p.valores.join(" y ") + ", " + p.modo + ")") + "]";
        }).join(" ");
        r.critico = !!r.d20 && r.d20.queda === 20;
        r.pifia = !!r.d20 && r.d20.queda === 1;
    }
    function cambiarModo(r, modo) {
        if (!r.d20 || r.d20.modo !== "normal") {
            return;
        }
        const antes = r.d20.queda;
        ponerModo(r.d20, modo);
        r.total += r.d20.signo * (r.d20.queda - antes);
        acabar(r);
        sonar();
        if (r.critico || r.pifia) {
            sonarFinal(r.critico);
        }
        pintarHistorial();
        avisar(r.que + " con " + modo + ": " + r.total + (r.critico ? ", ¡20 natural!" : "")
            + (r.pifia ? ", pifia, 1 natural" : "") + ". " + r.desglose);
        const li = historial.querySelector('[data-id="' + r.id + '"] .oc-dados-repetir');
        if (li) {
            li.focus();
        }
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
    const celdas = {};
    function cambiarDado(c, n, volverA) {
        const enPasos = celdas[c].pasos.contains(document.activeElement);
        estado.mano[c] = Math.max(0, Math.min(99, (estado.mano[c] || 0) + n));
        if (!estado.mano[c]) {
            delete estado.mano[c];
        }
        pintarMano();
        if (!estado.mano[c] && enPasos) {
            volverA.focus();
        }
        avisar(estado.mano[c] ? "Llevas " + estado.mano[c] + "d" + c + "." : "Sin d" + c + ".");
    }
    function pintarMano() {
        CARAS.forEach((c) => {
            const x = celdas[c];
            if (!x) {
                return;
            }
            const n = estado.mano[c] || 0;
            x.celda.classList.toggle("tiene", n > 0);
            x.cuantos.textContent = n ? "×" + n : "";
            x.pasos.hidden = !n;
            x.boton.setAttribute("aria-label", "Añadir un d" + c + (n ? " (hay " + n + ")" : ""));
        });
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
            const celda = crear("div", "oc-dados-celda");
            const b = botonDe("oc-dados-cara", undefined, () => cambiarDado(c, 1, b), "Añadir un d" + c);
            const cuantos = crear("span", "oc-dados-cuantos");
            cuantos.setAttribute("aria-hidden", "true");
            b.append(silueta(c), crear("span", "oc-dados-cara-nombre", "d" + c), cuantos);
            const pasos = crear("div", "oc-dados-cara-pasos");
            pasos.hidden = true;
            pasos.append(
                botonDe("oc-dados-cara-paso", "−", () => cambiarDado(c, -1, b), "Quitar un d" + c),
                botonDe("oc-dados-cara-paso", "+", () => cambiarDado(c, 1, b), "Añadir otro d" + c));
            celda.append(b, pasos);
            celdas[c] = { celda, boton: b, cuantos, pasos };
            bandeja.appendChild(celda);
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
            avisar("Bandeja vacía.");
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
        avisar(r.que + ": " + r.total + (r.critico ? ", ¡20 natural!" : "") + (r.pifia ? ", pifia, 1 natural" : "")
            + (r.tipos.length ? " (" + r.tipos.map((x) => x.total + " " + x.tipo).join(", ") + ")" : "")
            + ". " + r.desglose);
    }
    function pintarHistorial() {
        historial.replaceChildren(...estado.tiradas.map((r, i) => {
            const li = crear("li", "oc-dados-tirada" + (r.critico ? " es-critico" : "") + (r.pifia ? " es-pifia" : ""));
            li.dataset.id = r.id;
            const cabeza = crear("p", "oc-dados-que");
            cabeza.append(crear("span", "oc-dados-que-nombre", r.que),
                crear("span", "oc-dados-formula", formulaParaVer(r.formula)));
            const total = crear("p", "oc-dados-total", String(r.total));
            if (r.critico || r.pifia) {
                total.appendChild(crear("span", "oc-dados-natural", r.critico ? "¡20 natural!" : "pifia (1 natural)"));
            }
            const tipos = crear("p", "oc-dados-tipos");
            (r.tipos || []).forEach((x) => {
                tipos.appendChild(crear("span", "oc-dano oc-dano-" + claveDeTipo(x.tipo), x.total + " " + x.tipo));
            });
            const botones = crear("div", "oc-dados-tirada-botones");
            if (r.d20 && r.d20.modo === "normal") {
                botones.append(
                    botonDe("oc-dados-ventaja", "▲ ventaja", () => cambiarModo(r, "ventaja"),
                        "Añadir ventaja a: " + r.que + ", " + r.total),
                    botonDe("oc-dados-ventaja", "▼ desventaja", () => cambiarModo(r, "desventaja"),
                        "Añadir desventaja a: " + r.que + ", " + r.total));
            }
            botones.append(
                botonDe("oc-dados-repetir", "↻ repetir", () => tirar(r.formula, r.que), "Repetir: " + r.que),
                botonDe("oc-dados-quitar", "✕", () => quitar(r.id, i), "Borrar esta tirada: " + r.que + ", " + r.total));
            li.append(cabeza, total);
            if (tipos.childNodes.length) {
                li.appendChild(tipos);
            }
            li.append(crear("p", "oc-dados-desglose", r.desglose), botones);
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
            + " (" + formulaParaVer(m.dataset.dados).replace(/−/g, "menos") + ")");
        b.title = "Tirar " + formulaParaVer(m.dataset.dados);
        m.replaceWith(b);
    });
    document.addEventListener("click", (e) => {
        const b = e.target.closest("button.oc-dado");
        if (!b) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        tirar(b.dataset.dados, b.dataset.que);
    });
})();
document.querySelectorAll("[data-oc-casillas]").forEach((grupo) => {
    const que = grupo.dataset.ocCasillas;
    const sueltas = Array.from(grupo.querySelectorAll(".oc-casilla"));
    sueltas.forEach((s, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "oc-casilla";
        b.setAttribute("aria-pressed", "false");
        b.setAttribute("aria-label", que + ": " + (i + 1) + " de " + sueltas.length + ", gastado");
        b.addEventListener("click", () => {
            b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
        });
        s.replaceWith(b);
    });
});
(function () {
    const conVentana = document.querySelectorAll("details[data-oc-modal]");
    if (!conVentana.length) {
        return;
    }
    const fondo = document.createElement("div");
    fondo.className = "oc-modal-fondo";
    fondo.hidden = true;
    const ventana = document.createElement("div");
    ventana.className = "oc-modal";
    ventana.setAttribute("role", "dialog");
    ventana.setAttribute("aria-modal", "true");
    const cerrar = document.createElement("button");
    cerrar.type = "button";
    cerrar.className = "oc-modal-cerrar";
    cerrar.setAttribute("aria-label", "Cerrar");
    cerrar.textContent = "✕";
    const cuerpo = document.createElement("div");
    cuerpo.className = "oc-modal-cuerpo";
    ventana.append(cerrar, cuerpo);
    fondo.appendChild(ventana);
    document.body.appendChild(fondo);
    let vuelta = null;
    function abrir(detalles) {
        const carta = detalles.querySelector(".oc-carta");
        if (!carta) {
            return;
        }
        const copia = carta.cloneNode(true);
        copia.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
        const titulo = copia.querySelector(".oc-carta-titulo");
        if (titulo) {
            titulo.id = "oc-modal-titulo";
            ventana.setAttribute("aria-labelledby", "oc-modal-titulo");
        }
        ventana.classList.toggle("es-objeto", detalles.dataset.ocModal === "objeto");
        cuerpo.replaceChildren(copia);
        vuelta = detalles.querySelector("summary");
        fondo.hidden = false;
        cuerpo.scrollTop = 0;
        cerrar.focus();
    }
    function cerrarla() {
        if (fondo.hidden) {
            return;
        }
        fondo.hidden = true;
        cuerpo.replaceChildren();
        if (vuelta) {
            vuelta.focus();
        }
    }
    conVentana.forEach((d) => {
        const s = d.querySelector("summary");
        s.setAttribute("aria-haspopup", "dialog");
        s.addEventListener("click", (e) => {
            e.preventDefault();
            abrir(d);
        });
    });
    cerrar.addEventListener("click", cerrarla);
    fondo.addEventListener("click", (e) => {
        if (e.target === fondo) {
            cerrarla();
        }
    });
    ventana.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            e.stopPropagation();
            cerrarla();
            return;
        }
        if (e.key !== "Tab") {
            return;
        }
        const enfocables = Array.from(ventana.querySelectorAll("button, a[href], [tabindex]:not([tabindex='-1'])"))
            .filter((x) => !x.disabled && x.offsetParent !== null);
        if (!enfocables.length) {
            return;
        }
        const primero = enfocables[0];
        const ultimo = enfocables[enfocables.length - 1];
        if (e.shiftKey && document.activeElement === primero) {
            e.preventDefault();
            ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
            e.preventDefault();
            primero.focus();
        }
    });
})();
