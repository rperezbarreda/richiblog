// =========================================
// LA FICHA DE UNO DE MIS PERSONAJES: EL MENÚ DEL RECUADRO
// =========================================
// La página la escribe entera generar-personajes.py: todas las partes
// (historia, las de la ficha —combate, habilidades…—, npcs, imágenes y
// extra) una debajo de otra, y a la izquierda un menú de enlaces para
// saltar a cada una. Así se lee todo aunque esto no cargue.
//
// Con esto, se ve SOLO LA PARTE ELEGIDA. El menú se queda de enlaces (se
// recorre con el tabulador, como el menú del sitio), con aria-current en
// el de la parte que se ve, y «ficha» pasa a ser un botón que abre y
// cierra su submenú, como los del menú del sitio (al abrirlo, enseña su
// primera parte). La parte elegida va en la dirección (#oc-ficha-combate),
// así que un enlace a una parte abre esa, y atrás y adelante del
// navegador también. Al elegir una, el foco va a ella (para el lector de
// pantalla, que empiece a leer ahí).

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

    // «ficha», de enlace a botón de abrir y cerrar su submenú.
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
        // Las de fuera de la ficha son hijas directas; la ficha es una caja
        // con sus partes dentro.
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
                // Sin historial (un archivo abierto a pelo): da igual.
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
        // Las direcciones de antes (#oc-ficha), a su primera parte.
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

// =========================================
// LA DESCRIPCIÓN DE LOS ATAQUES
// =========================================
// En la tabla de ataques, la descripción de cada uno va en una fila
// debajo (generar-personajes.py). Aquí se pliega: el nombre del ataque
// pasa a ser un botón que la abre y la cierra.

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

// =========================================
// LOS DADOS
// =========================================
// Un lanzador de dados, como el de D&D Beyond, de dos maneras:
//   · TODO LO QUE SE TIRA EN LA FICHA se puede pulsar: los bonos de las
//     habilidades y las salvaciones, el modificador de cada
//     característica, la iniciativa, el ataque de conjuro, el ataque y el
//     daño de las armas, el dado de golpe, y los dados escritos en las
//     descripciones («1d10», «8d6»). generar-personajes.py los deja
//     marcados (<span class="oc-dado" data-dados="1d20+4" data-que=
//     "sigilo">) y aquí se convierten en botones.
//   · LA BANDEJA (el botón 🎲, debajo de la foto): eliges los dados que
//     quieras (cada pulsación añade uno), el modificador (con − y +), y
//     tiras.
// Con «ventaja» o «desventaja» elegido, lo que se tire con un solo d20 se
// tira dos veces y se queda el mayor o el menor. Las tiradas salen en la
// ventanita «dados.exe» (la última arriba, en colores invertidos), cada
// una con «repetir» y su ✕ para borrarla, y «borrar todo» arriba. Al
// tirar suena un traqueteo de dados (hecho con el navegador, sin archivos;
// el 🔊 de la barra lo apaga). La ventanita se mueve arrastrándola por
// su barra y se queda donde la dejes (en este navegador). El lector de
// pantalla dice cada resultado.
// Al azar de verdad: crypto.getRandomValues.

(function () {
    const marcas = Array.from(document.querySelectorAll(".oc-dado[data-dados]"));
    const sitioDelBoton = document.querySelector("[data-oc-botones]");
    if (!marcas.length && !sitioDelBoton) {
        return;
    }
    const CARAS = [2, 4, 6, 8, 10, 12, 20, 100];
    // El sistema de juego del personaje (generar-personajes.py lo pone en
    // los botones de debajo del post-it): cambia cómo se tira (ver
    // herramientas/0-comun/sistemas_rol.py).
    const SISTEMA = (sitioDelBoton && sitioDelBoton.dataset.ocSistema) || "dnd5e";
    const estado = { mano: {}, modo: "normal", tiradas: [], cuenta: 0, sonido: leer("richi-dados-sonido") !== "no",
        reserva: { atributo: null, habilidad: null, extra: 0,
            hambre: parseInt((sitioDelBoton && sitioDelBoton.dataset.ocHambre) || "0", 10) || 0 } };

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
            // Sin almacenamiento (ventana privada…): da igual.
        }
    }

    function alAzar(caras) {
        const u = new Uint32Array(1);
        // Sin sesgo: se descarta lo que caería en el trozo que no reparte
        // igual.
        const tope = Math.floor(0x100000000 / caras) * caras;
        do {
            crypto.getRandomValues(u);
        } while (u[0] >= tope);
        return (u[0] % caras) + 1;
    }

    // ---- EL SONIDO: un traqueteo de dados, con ruido del navegador ----
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
            // Unos golpecitos cada vez más flojos y más separados, como un
            // dado que rueda y se para.
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
            // Sin sonido en este navegador: no pasa nada.
        }
    }

    // Detrás del traqueteo, si sale un 20 natural, unas notas que suben
    // (¡bien!); si sale un 1, unas que bajan (vaya…).
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
            // Sin sonido: no pasa nada.
        }
    }

    // «2d8 + 1d6 + 3», «1d20-1», «d20» -> los trozos.
    // El tipo de daño va detrás de su trozo, entre corchetes, y es de todo
    // el trozo: «1d6+2[perforante]+2d6[fuego]» son 1d6+2 perforante y 2d6
    // de fuego.
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
        const patron = /([+-]?)\s*(\d*)d(\d+|F)|([+-]?)\s*(\d+)/g;
        segmentos.forEach(([trozo, tipo]) => {
            patron.lastIndex = 0;
            while ((m = patron.exec(trozo))) {
                if (m[3]) {
                    trozos.push({ signo: m[1] === "-" ? -1 : 1, cuantos: Math.min(parseInt(m[2] || "1", 10), 100),
                        caras: m[3] === "F" ? "F" : parseInt(m[3], 10), tipo });
                } else {
                    trozos.push({ signo: m[4] === "-" ? -1 : 1, fijo: parseInt(m[5], 10), tipo });
                }
            }
        });
        return trozos;
    }

    // «1d6+2[perforante]» -> «1d6+2 perforante», para enseñarla.
    function formulaParaVer(formula) {
        return String(formula).replace(/\s*\[([^\]]+)\]/g, " $1").replace(/\+/g, " + ").replace(/-/g, " − ")
            .replace(/\s+/g, " ").trim();
    }

    // El tipo, sin tildes, para su clase de color (oc-dano-fuego…).
    function claveDeTipo(tipo) {
        return String(tipo).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
    }

    // Una tirada guarda sus trozos ya tirados («partes»): así el desglose
    // se puede volver a escribir si luego se le añade ventaja o
    // desventaja. El d20 (cuando hay uno solo) va aparte, con sus dados.
    function tirar(formula, que) {
        const especial = /^(v5|cp):(-?\d+)$/.exec(String(formula));
        if (especial) {
            return especial[1] === "v5" ? tirarReserva(parseInt(especial[2], 10), que, formula)
                : tirarCyberpunk(parseInt(especial[2], 10), que, formula);
        }
        const trozos = trozosDe(formula);
        if (!trozos.length) {
            return null;
        }
        const d20s = trozos.filter((t) => t.caras === 20).reduce((n, t) => n + t.cuantos, 0);
        let total = 0;
        const partes = [];
        let d20 = null;
        // Lo de cada tipo de daño, por separado (en el orden en que salen).
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
                // Los de Fate: −, 0 o + (−1, 0 o 1).
                const x = t.caras === "F" ? alAzar(3) - 2 : alAzar(t.caras);
                salen.push(t.caras === "F" ? ["−", "0", "+"][x + 1] : x);
                total += t.signo * x;
                sumar(t.tipo, t.signo * x);
            }
            partes.push({ texto: signo + t.cuantos + "d" + t.caras + " [" + salen.join(", ") + "]" });
        });
        const r = guardarTirada({ que: que || "tirada", formula: String(formula), total, partes, d20, tipos });
        if (trozos.some((t) => t.caras === "F")) {
            r.nota = escalera(total);
        }
        return terminar(r);
    }

    function guardarTirada(r) {
        estado.cuenta += 1;
        r.id = estado.cuenta;
        r.tipos = r.tipos || [];
        acabar(r);
        return r;
    }

    function terminar(r) {
        sonar();
        if (r.critico || r.pifia) {
            sonarFinal(r.critico);
        }
        anadir(r);
        return r;
    }

    // LA ESCALERA DE FATE (la misma que en sistemas_rol.py).
    const ESCALERA = { 8: "Legendario", 7: "Épico", 6: "Fantástico", 5: "Soberbio", 4: "Grande", 3: "Bueno",
        2: "Normal", 1: "Mediano", 0: "Mediocre", "-1": "Malo", "-2": "Terrible" };

    function escalera(n) {
        return ESCALERA[Math.max(-2, Math.min(8, n))] || "";
    }

    // VAMPIRO V5: tantos d10 como la reserva; los de hambre (los primeros
    // tantos como el hambre) van aparte. Éxito con 6 o más; cada pareja de
    // dieces, dos éxitos de más (crítico; sucio si hay un 10 de hambre);
    // un 1 de hambre: si la tirada falla, es un fallo bestial.
    function tirarReserva(cuantos, que, formula) {
        const n = Math.max(1, cuantos);
        const hambre = Math.min(estado.reserva.hambre, n);
        const normales = [];
        const deHambre = [];
        for (let i = 0; i < n; i++) {
            (i < hambre ? deHambre : normales).push(alAzar(10));
        }
        const todos = normales.concat(deHambre);
        const dieces = todos.filter((x) => x === 10).length;
        const parejas = Math.floor(dieces / 2);
        const exitos = todos.filter((x) => x >= 6).length + parejas * 2;
        const r = guardarTirada({ que: que || "reserva", formula: formula || "v5:" + n, total: exitos,
            unidad: exitos === 1 ? "éxito" : "éxitos", partes: [], d20: null });
        r.desglose = n + "d10 [" + (normales.join(", ") || "—") + "]" + (hambre ? " · hambre [" + deHambre.join(", ") + "]" : "");
        r.formulaVista = n + " dados" + (hambre ? ", " + hambre + " de hambre" : "");
        const sucio = parejas && deHambre.includes(10);
        const bestial = deHambre.includes(1);
        r.critico = parejas > 0 && !sucio;
        r.pifia = !!sucio || (bestial && !exitos);
        r.nota = [parejas ? (sucio ? "crítico sucio" : "crítico") : "",
            bestial ? (exitos ? "un 1 de hambre: si no llega, fallo bestial" : "fallo bestial") : ""]
            .filter(Boolean).join("; ");
        return terminar(r);
    }

    // CYBERPUNK RED: 1d10 + la base. Un 10 tira otro y lo suma (crítico);
    // un 1 tira otro y lo resta (pifia).
    function tirarCyberpunk(base, que, formula) {
        const d = alAzar(10);
        const otro = d === 10 || d === 1 ? alAzar(10) : 0;
        const dado = d === 10 ? d + otro : d === 1 ? d - otro : d;
        const r = guardarTirada({ que: que || "tirada", formula, total: dado + base, partes: [], d20: null });
        r.desglose = "1d10 [" + d + (d === 10 ? " + " + otro : d === 1 ? " − " + otro : "") + "]"
            + (base ? (base > 0 ? " + " : " − ") + Math.abs(base) : "");
        r.formulaVista = "1d10" + (base ? (base > 0 ? " + " : " − ") + Math.abs(base) : "");
        r.critico = d === 10;
        r.pifia = d === 1;
        r.nota = d === 10 ? "¡crítico! (+" + otro + ")" : d === 1 ? "pifia (−" + otro + ")" : "";
        return terminar(r);
    }

    // Tirar el segundo d20 y quedarse con el mayor (ventaja) o el menor.
    function ponerModo(d20, modo) {
        const b = alAzar(20);
        d20.valores = [d20.valores[0], b];
        d20.modo = modo;
        d20.queda = modo === "ventaja" ? Math.max(d20.valores[0], b) : Math.min(d20.valores[0], b);
    }

    // El desglose y si es 20 o 1 natural, de las partes.
    function acabar(r) {
        if (!r.d20 && !r.partes.length) {
            return;
        }
        r.desglose = r.partes.map((p) => {
            if (!p.d20) {
                return p.texto;
            }
            return p.prefijo + "1d20 [" + (p.modo === "normal" ? p.queda
                : p.queda + " (" + p.valores.join(" y ") + ", " + p.modo + ")") + "]";
        }).join(" ");
        r.critico = !!r.d20 && r.d20.queda === 20;
        r.pifia = !!r.d20 && r.d20.queda === 1;
        if (r.d20) {
            r.nota = r.critico ? "¡20 natural!" : r.pifia ? "pifia (1 natural)" : "";
        }
    }

    // Lo que se dice de una tirada: el total, lo que es y su nota.
    function dicho(r) {
        return r.que + ": " + r.total + (r.unidad ? " " + r.unidad : "") + (r.nota ? ", " + r.nota : "");
    }

    // Una tirada de d20 hecha en normal, pasada a ventaja o desventaja
    // desde el registro: se tira el otro d20 y se rehace la misma tirada
    // (el total, el desglose y lo de natural), en su sitio.
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
        avisar(dicho(r).replace(r.que + ":", r.que + " con " + modo + ":") + ". " + r.desglose);
        const li = historial.querySelector('[data-id="' + r.id + '"] .oc-dados-repetir');
        if (li) {
            li.focus();
        }
    }

    // ---- LOS DIBUJOS DE CADA DADO (su silueta, en SVG) ----
    const SILUETAS = {
        2: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5"/>',
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

    // ---- LA VENTANITA ----
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
        // Si se ha quitado el último, el «−» desaparece: el foco, al dado.
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

        // La barra (por ella se arrastra la ventana). Con su clase propia
        // y no la de las ventanas del sitio: esa la coge
        // ventanas-plegables.js y la convierte en un botón de plegar
        // entero, que tapaba la ✕.
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
        // Cada dado, en su casilla: el botón grande (su silueta y su
        // nombre) añade uno; en cuanto hay alguno, salen debajo, en la misma
        // casilla, «−» y «+» con cuántos hay en medio.
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

        // El modificador: el número, con − y + a los lados.
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
        // Fate y Cyberpunk RED: su tirada de siempre con el modificador.
        if (SISTEMA === "fate" || SISTEMA === "cpred") {
            const fate = SISTEMA === "fate";
            acciones.appendChild(botonDe("oc-dados-tirar es-del-sistema", fate ? "tirar 4dF" : "tirar 1d10", () => {
                const mod = modificador();
                tirar(fate ? "4dF" + (mod ? (mod > 0 ? "+" : "") + mod : "") : "cp:" + mod, fate ? "4dF" : "1d10");
            }, fate ? "Tirar 4dF más el modificador" : "Tirar 1d10 más el modificador (con críticos y pifias)"));
        }
        const reserva = SISTEMA === "vtm5" ? montarReserva() : null;

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

        if (reserva) {
            // En Vampiro la reserva va arriba (es lo que más se usa) y no
            // hay ventaja ni desventaja.
            cuerpo.append(reserva, bandeja, manoTexto, fila, acciones, cabeza, historial, aviso);
        } else {
            cuerpo.append(bandeja, manoTexto, fila, modos, acciones, cabeza, historial, aviso);
        }
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

    // ---- LA RESERVA DE VAMPIRO V5 ----
    // Un atributo y una habilidad (los de la ficha: al pulsarlos allí
    // vienen aquí), los dados que se sumen o resten y el hambre (los dados
    // de hambre, que empiezan con el recurso «Hambre» de la ficha).
    let reservaTexto = null;
    const reservaSelects = {};
    let hambreInput = null;

    function opcionesDe(tipo) {
        const vistas = new Map();
        document.querySelectorAll('.oc-dado[data-reserva="' + tipo + '"]').forEach((x) => {
            if (!vistas.has(x.dataset.que)) {
                vistas.set(x.dataset.que, parseInt(x.dataset.valor || "0", 10) || 0);
            }
        });
        return vistas;
    }

    function cuantosEnReserva() {
        const r = estado.reserva;
        return (r.atributo ? r.atributo[1] : 0) + (r.habilidad ? r.habilidad[1] : 0) + r.extra;
    }

    function textoDeReserva() {
        const r = estado.reserva;
        const trozos = [r.atributo, r.habilidad].filter(Boolean).map((x) => x[0] + " " + x[1]);
        if (r.extra) {
            trozos.push((r.extra > 0 ? "+" : "−") + Math.abs(r.extra) + " de más");
        }
        const n = Math.max(0, cuantosEnReserva());
        return (trozos.join(" + ") || "nada") + ": " + n + (n === 1 ? " dado" : " dados")
            + (n ? ", " + Math.min(r.hambre, n) + " de hambre" : "");
    }

    function pintarReserva() {
        if (!reservaTexto) {
            return;
        }
        reservaTexto.textContent = textoDeReserva();
        ["atributo", "habilidad"].forEach((tipo) => {
            reservaSelects[tipo].value = estado.reserva[tipo] ? estado.reserva[tipo][0] : "";
        });
        hambreInput.value = String(estado.reserva.hambre);
    }

    function montarReserva() {
        const caja = crear("div", "oc-dados-reserva");
        caja.setAttribute("role", "group");
        caja.setAttribute("aria-labelledby", "oc-reserva-titulo");
        const titulo = crear("h3", "oc-dados-subtitulo", "reserva");
        titulo.id = "oc-reserva-titulo";
        caja.appendChild(titulo);
        [["atributo", "atributo"], ["habilidad", "habilidad"]].forEach(([tipo, texto]) => {
            const fila = crear("div", "oc-dados-fila");
            const etiqueta = crear("label", "oc-dados-etiqueta", texto);
            const sel = crear("select", "oc-dados-elegir");
            sel.id = "oc-reserva-" + tipo;
            etiqueta.htmlFor = sel.id;
            const ninguno = crear("option", "", "— ninguno —");
            ninguno.value = "";
            sel.appendChild(ninguno);
            const opciones = opcionesDe(tipo);
            opciones.forEach((valor, nombre) => {
                const o = crear("option", "", nombre + " (" + valor + ")");
                o.value = nombre;
                sel.appendChild(o);
            });
            sel.addEventListener("change", () => {
                estado.reserva[tipo] = sel.value ? [sel.value, opciones.get(sel.value)] : null;
                pintarReserva();
            });
            reservaSelects[tipo] = sel;
            fila.append(etiqueta, sel);
            caja.appendChild(fila);
        });
        const numero = (id, texto, leer, poner, etiquetas) => {
            const fila = crear("div", "oc-dados-fila");
            const etiqueta = crear("label", "oc-dados-etiqueta", texto);
            const input = crear("input", "oc-dados-mod");
            input.type = "number";
            input.id = id;
            input.step = "1";
            input.value = String(leer());
            etiqueta.htmlFor = id;
            input.addEventListener("input", () => {
                poner(parseInt(input.value || "0", 10) || 0);
                pintarReserva();
            });
            const cambiar = (n) => {
                poner(leer() + n);
                pintarReserva();
            };
            const mandos = crear("div", "oc-dados-mod-caja");
            mandos.append(botonDe("oc-dados-paso", "−", () => cambiar(-1), etiquetas[0]), input,
                botonDe("oc-dados-paso", "+", () => cambiar(1), etiquetas[1]));
            fila.append(etiqueta, mandos);
            caja.appendChild(fila);
            return input;
        };
        numero("oc-reserva-extra", "dados de más", () => estado.reserva.extra, (n) => {
            estado.reserva.extra = Math.max(-20, Math.min(20, n));
        }, ["Un dado menos", "Un dado más"]);
        hambreInput = numero("oc-reserva-hambre", "hambre", () => estado.reserva.hambre, (n) => {
            estado.reserva.hambre = Math.max(0, Math.min(5, n));
        }, ["Un punto menos de hambre", "Un punto más de hambre"]);
        reservaTexto = crear("p", "oc-dados-mano");
        caja.appendChild(reservaTexto);
        const tirarla = botonDe("oc-dados-tirar es-del-sistema", "tirar reserva", () => {
            const r = estado.reserva;
            const que = [r.atributo, r.habilidad].filter(Boolean).map((x) => x[0]).join(" + ") || "reserva";
            tirarReserva(cuantosEnReserva(), que);
        });
        caja.appendChild(tirarla);
        pintarReserva();
        return caja;
    }

    // Un atributo o una habilidad pulsados en la ficha: a la reserva.
    function ponerEnReserva(b) {
        const tipo = b.dataset.reserva === "habilidad" ? "habilidad" : "atributo";
        estado.reserva[tipo] = [b.dataset.que, parseInt(b.dataset.valor || "0", 10) || 0];
        pintarReserva();
        if (ventana.hidden) {
            abrir(true, false);
        }
        avisar("Reserva: " + textoDeReserva() + ". Tírala con «tirar reserva», en los dados.");
    }

    // ---- MOVERLA ARRASTRANDO LA BARRA ----
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
        // Que no se salga por abajo: como mucho, hasta el borde.
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
        // Si la pantalla se hace más pequeña, que no se quede fuera.
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

    // ---- LAS TIRADAS ----
    function avisar(texto) {
        // Se vacía y se vuelve a llenar para que lo diga aunque salga lo
        // mismo que la vez anterior.
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
        avisar(dicho(r)
            + (r.tipos.length ? " (" + r.tipos.map((x) => x.total + " " + x.tipo).join(", ") + ")" : "")
            + ". " + r.desglose);
    }

    function pintarHistorial() {
        historial.replaceChildren(...estado.tiradas.map((r, i) => {
            const li = crear("li", "oc-dados-tirada" + (r.critico ? " es-critico" : "") + (r.pifia ? " es-pifia" : ""));
            li.dataset.id = r.id;
            const cabeza = crear("p", "oc-dados-que");
            cabeza.append(crear("span", "oc-dados-que-nombre", r.que),
                crear("span", "oc-dados-formula", r.formulaVista || formulaParaVer(r.formula)));
            const total = crear("p", "oc-dados-total", String(r.total));
            if (r.unidad) {
                total.appendChild(crear("span", "oc-dados-unidad", r.unidad));
            }
            if (r.nota) {
                total.appendChild(crear("span", "oc-dados-natural", r.nota));
            }
            // El daño, separado por tipo, cada uno con su color.
            const tipos = crear("p", "oc-dados-tipos");
            (r.tipos || []).forEach((x) => {
                tipos.appendChild(crear("span", "oc-dano oc-dano-" + claveDeTipo(x.tipo), x.total + " " + x.tipo));
            });
            const botones = crear("div", "oc-dados-tirada-botones");
            // Tirada de un d20 en normal: con ▲ y ▼ se le añade ventaja o
            // desventaja (sin tirar otra vez lo demás).
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
        // El foco, a la tirada que queda en su sitio (o a la de antes).
        const quedan = historial.querySelectorAll(".oc-dados-quitar");
        (quedan[Math.min(i, quedan.length - 1)] || tirarBoton).focus();
    }

    montar();

    if (sitioDelBoton) {
        // Solo el dado a la vista (que «ficha dndbeyond» quepa al lado);
        // el nombre, para el lector y al pasar por encima.
        boton = crear("button", "oc-boton oc-boton-dados");
        boton.type = "button";
        boton.title = "Lanzador de dados";
        // El dibujo, el de un d20 (el de la bandeja).
        boton.append(silueta(20), crear("span", "visually-hidden", "dados"));
        boton.setAttribute("aria-controls", "oc-dados");
        boton.setAttribute("aria-expanded", "false");
        boton.addEventListener("click", () => abrir(ventana.hidden, false));
        sitioDelBoton.appendChild(boton);
    }

    // Lo marcado en la ficha, a botones. El clic se escucha en el
    // documento (y no en cada botón) para que también tiren las copias que
    // van a las ventanas de los conjuros y los objetos.
    marcas.forEach((m) => {
        const b = crear("button", "oc-dado");
        b.type = "button";
        b.dataset.dados = m.dataset.dados;
        b.dataset.que = m.dataset.que || "";
        if (m.dataset.reserva) {
            b.dataset.reserva = m.dataset.reserva;
            b.dataset.valor = m.dataset.valor || "0";
        }
        b.innerHTML = m.innerHTML;
        if (m.dataset.reserva && SISTEMA === "vtm5") {
            b.setAttribute("aria-label", m.dataset.que + ", " + m.dataset.valor + ": a la reserva de dados");
            b.title = "A la reserva de los dados";
        } else {
            b.setAttribute("aria-label", m.textContent.trim() + ", tirar " + (m.dataset.que || m.dataset.dados)
                + " (" + formulaParaVer(m.dataset.dados).replace(/−/g, "menos") + ")");
            b.title = "Tirar " + formulaParaVer(m.dataset.dados);
        }
        m.replaceWith(b);
    });
    document.addEventListener("click", (e) => {
        const b = e.target.closest("button.oc-dado");
        if (!b) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (b.dataset.reserva && SISTEMA === "vtm5") {
            ponerEnReserva(b);
            return;
        }
        tirar(b.dataset.dados, b.dataset.que);
    });
})();

// =========================================
// LAS CASILLAS DE USOS Y DE ESPACIOS DE CONJURO
// =========================================
// Cada casilla (generar-personajes.py: casillas) pasa a ser un botón que
// se marca y se desmarca al pulsarlo, para llevar la cuenta de lo gastado
// mientras se juega. Solo en la página: no se guarda (al recargar, todas
// libres).

// Las de los recursos de otros sistemas («Salud: 1/6») pueden empezar
// marcadas (es-marcada). Las de la salud y la voluntad de Vampiro tienen
// tres estados (data-oc-estados="3"): libre, daño superficial (/) y
// agravado (✕); cada pulsación pasa al siguiente, y se dice cuál.

(function () {
    const grupos = document.querySelectorAll("[data-oc-casillas]");
    if (!grupos.length) {
        return;
    }
    const ESTADOS = ["libre", "superficial", "agravado"];
    let aviso = null;
    const avisar = (texto) => {
        if (!aviso) {
            aviso = document.createElement("p");
            aviso.className = "visually-hidden";
            aviso.setAttribute("role", "status");
            document.body.appendChild(aviso);
        }
        aviso.textContent = "";
        setTimeout(() => {
            aviso.textContent = texto;
        }, 50);
    };
    grupos.forEach((grupo) => {
        const que = grupo.dataset.ocCasillas;
        const tres = grupo.dataset.ocEstados === "3";
        const sueltas = Array.from(grupo.querySelectorAll(".oc-casilla"));
        sueltas.forEach((s, i) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "oc-casilla";
            const nombre = que + ": " + (i + 1) + " de " + sueltas.length;
            if (tres) {
                const poner = (estadoNuevo) => {
                    b.dataset.estado = estadoNuevo;
                    b.setAttribute("aria-label", nombre + ", " + estadoNuevo);
                };
                poner(s.classList.contains("es-marcada") ? "superficial" : "libre");
                b.addEventListener("click", () => {
                    poner(ESTADOS[(ESTADOS.indexOf(b.dataset.estado) + 1) % 3]);
                    avisar(b.getAttribute("aria-label"));
                });
            } else {
                b.setAttribute("aria-pressed", s.classList.contains("es-marcada") ? "true" : "false");
                b.setAttribute("aria-label", nombre + ", gastado");
                b.addEventListener("click", () => {
                    b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
                });
            }
            s.replaceWith(b);
        });
    });
})();

// =========================================
// LAS VENTANAS DE LOS CONJUROS Y DE LOS OBJETOS
// =========================================
// Un conjuro (su carta) o un objeto del inventario (en grande, con su
// descripción) se abren en una ventana por encima de todo al pulsarlos.
// Sin JavaScript son desplegables (<details>) y se ven debajo; con él, al
// pulsar su nombre se abre la ventana en vez de desplegarse. La ventana es
// modal: el foco se queda dentro (el tabulador da la vuelta), Esc o la ✕
// la cierran (también pulsar fuera) y el foco vuelve a lo que se pulsó.

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
        // Los id de la copia, fuera (no puede haber dos iguales).
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
        // El foco no sale de la ventana.
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

// =========================================
// LA FICHA EN PDF
// =========================================
// Si no hay un PDF subido (generar-personajes.py pone el enlace en
// [data-oc-botones-pdf]), un botón que la saca en PDF con el navegador:
// abre imprimir, donde se elige «Guardar como PDF». En papel sale todo,
// una parte detrás de otra (ver el @media print de personajes.css).

(function () {
    const sitio = document.querySelector("[data-oc-botones-pdf]");
    if (!sitio || sitio.querySelector(".oc-boton-pdf")) {
        return;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "oc-boton oc-boton-pdf";
    const icono = document.createElement("span");
    icono.className = "oc-boton-icono";
    icono.setAttribute("aria-hidden", "true");
    icono.textContent = "📄";
    b.append(icono, document.createTextNode(" ficha en pdf"));
    b.title = "Abre imprimir: elige «Guardar como PDF»";
    b.addEventListener("click", () => window.print());
    sitio.appendChild(b);
})();

// =========================================
// SU MÚSICA: EL REPRODUCTOR DE SPOTIFY, SI SE PIDE
// =========================================
// Cada canción o lista (generar-personajes.py: apartado_inspiracion) trae
// su enlace a Spotify; aquí se le añade «▶ escuchar aquí», que pone el
// reproductor de Spotify en su sitio. Hasta que no se pulsa no se carga
// nada de Spotify (ni sus cookies).

(function () {
    document.querySelectorAll("[data-oc-spotify]").forEach((cancion) => {
        const [tipo, id] = cancion.dataset.ocSpotify.split("/");
        if (!/^[a-z]+$/.test(tipo || "") || !/^[A-Za-z0-9]+$/.test(id || "")) {
            return;
        }
        const titulo = cancion.dataset.ocTitulo || "Spotify";
        const sitio = cancion.querySelector(".oc-cancion-botones");
        const b = document.createElement("button");
        b.type = "button";
        b.className = "oc-cancion-escuchar";
        b.textContent = "▶ escuchar aquí";
        b.setAttribute("aria-label", "Escuchar aquí: " + titulo + " (carga el reproductor de Spotify)");
        b.addEventListener("click", () => {
            const marco = document.createElement("iframe");
            marco.className = "oc-cancion-reproductor";
            marco.src = "https://open.spotify.com/embed/" + encodeURIComponent(tipo) + "/" + encodeURIComponent(id);
            marco.title = "Reproductor de Spotify: " + titulo;
            marco.height = tipo === "track" || tipo === "episode" ? "152" : "352";
            marco.loading = "lazy";
            marco.setAttribute("allow", "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture");
            cancion.querySelector(".oc-cancion-texto").appendChild(marco);
            b.remove();
            marco.focus();
        });
        sitio.prepend(b);
    });
})();
