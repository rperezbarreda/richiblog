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
    const PHI = (1 + Math.sqrt(5)) / 2;
    const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const suma = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const por = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
    const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const unitario = (a) => por(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
    function caras(vertices) {
        const salida = [];
        const vistas = new Set();
        const n = vertices.length;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                for (let k = j + 1; k < n; k++) {
                    let normal = cruz(resta(vertices[j], vertices[i]), resta(vertices[k], vertices[i]));
                    if (Math.hypot(normal[0], normal[1], normal[2]) < 1e-6) {
                        continue;
                    }
                    normal = unitario(normal);
                    let d = punto(normal, vertices[i]);
                    let encima = 0;
                    let debajo = 0;
                    vertices.forEach((v) => {
                        const s = punto(normal, v) - d;
                        if (s > 1e-4) {
                            encima++;
                        } else if (s < -1e-4) {
                            debajo++;
                        }
                    });
                    if (encima && debajo) {
                        continue;
                    }
                    if (encima) {
                        normal = por(normal, -1);
                        d = -d;
                    }
                    const en = [];
                    vertices.forEach((v, x) => {
                        if (Math.abs(punto(normal, v) - d) < 1e-4) {
                            en.push(x);
                        }
                    });
                    const clave = en.slice().sort((a, b) => a - b).join(",");
                    if (vistas.has(clave)) {
                        continue;
                    }
                    vistas.add(clave);
                    const centro = por(en.reduce((s, x) => suma(s, vertices[x]), [0, 0, 0]), 1 / en.length);
                    const ref = unitario(resta(vertices[en[0]], centro));
                    const otro = cruz(normal, ref);
                    en.sort((a, b) => {
                        const pa = resta(vertices[a], centro);
                        const pb = resta(vertices[b], centro);
                        return Math.atan2(punto(pa, otro), punto(pa, ref)) - Math.atan2(punto(pb, otro), punto(pb, ref));
                    });
                    let radio = Infinity;
                    en.forEach((x, m) => {
                        const a = vertices[x];
                        const b = vertices[en[(m + 1) % en.length]];
                        const lado = unitario(resta(b, a));
                        const p = resta(centro, a);
                        const dist = Math.hypot(...resta(p, por(lado, punto(p, lado))));
                        radio = Math.min(radio, dist);
                    });
                    salida.push({ idx: en, normal, centro, arriba: ref, derecha: cruz(ref, normal), radio });
                }
            }
        }
        return salida;
    }
    function vertices(tipo) {
        const s = [-1, 1];
        if (tipo === 4) {
            return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
        }
        if (tipo === 6 || tipo === "F") {
            return s.flatMap((x) => s.flatMap((y) => s.map((z) => [x, y, z])));
        }
        if (tipo === 8) {
            return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
        }
        if (tipo === 10) {
            const z0 = 0.105;
            const corona = (i, z, giro) => [Math.cos((i * 72 + giro) * Math.PI / 180),
                Math.sin((i * 72 + giro) * Math.PI / 180), z];
            const a0 = corona(0, z0, 0);
            const b0 = corona(0, -z0, 36);
            const a1 = corona(1, z0, 0);
            const n = cruz(resta(b0, a0), resta(a1, a0));
            const punta = z0 + (n[0] * a0[0] + n[1] * a0[1]) / n[2];
            const vs = [[0, 0, punta], [0, 0, -punta]];
            for (let i = 0; i < 5; i++) {
                vs.push(corona(i, z0, 0), corona(i, -z0, 36));
            }
            return vs;
        }
        if (tipo === 12) {
            const vs = s.flatMap((x) => s.flatMap((y) => s.map((z) => [x, y, z])));
            s.forEach((a) => s.forEach((b) => {
                vs.push([0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [a * PHI, 0, b / PHI]);
            }));
            return vs;
        }
        if (tipo === 20) {
            const vs = [];
            s.forEach((a) => s.forEach((b) => {
                vs.push([0, a, b * PHI], [a, b * PHI, 0], [a * PHI, 0, b]);
            }));
            return vs;
        }
        const vs = [];
        for (let i = 0; i < 16; i++) {
            const a = i * Math.PI / 8;
            vs.push([Math.cos(a), Math.sin(a), 0.16], [Math.cos(a), Math.sin(a), -0.16]);
        }
        return vs;
    }
    const SOLIDOS = {};
    function solido(tipo) {
        if (!SOLIDOS[tipo]) {
            const vs = vertices(tipo);
            const r = Math.max(...vs.map((v) => Math.hypot(v[0], v[1], v[2])));
            const escalados = vs.map((v) => por(v, 1 / r));
            const todas = caras(escalados);
            const numeradas = tipo === 2 ? todas.filter((c) => c.idx.length > 4) : todas;
            SOLIDOS[tipo] = { vertices: escalados, caras: todas, numeradas };
        }
        return SOLIDOS[tipo];
    }
    function etiquetas(dado) {
        if (dado.caras === "F") {
            return ["+", "+", "−", "−", "", ""];
        }
        if (dado.caras === "decenas") {
            return ["00", "10", "20", "30", "40", "50", "60", "70", "80", "90"];
        }
        if (dado.caras === "unidades") {
            return ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
        }
        return Array.from({ length: dado.caras }, (_, i) => String(i + 1));
    }
    function tipoDe(caras) {
        if (caras === "decenas" || caras === "unidades") {
            return 10;
        }
        return [2, 4, 6, 8, 10, 12, 20, "F"].includes(caras) ? caras : 6;
    }
    function girar(eje, angulo) {
        const [x, y, z] = unitario(eje);
        const c = Math.cos(angulo);
        const s = Math.sin(angulo);
        const t = 1 - c;
        return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y],
            [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
            [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
    }
    const aplicar = (m, v) => [punto(m[0], v), punto(m[1], v), punto(m[2], v)];
    function componer(a, b) {
        return a.map((fila) => [0, 1, 2].map((j) => fila[0] * b[0][j] + fila[1] * b[1][j] + fila[2] * b[2][j]));
    }
    const ASPECTOS = {
        tema: { nombre: "el del tema" },
        hueso: { nombre: "hueso", cuerpo: [236, 226, 200], tinta: [52, 38, 28], borde: [140, 118, 92],
            fuente: "Georgia, serif" },
        obsidiana: { nombre: "obsidiana", cuerpo: [30, 26, 38], tinta: [228, 186, 84], borde: [150, 120, 60],
            acabado: "brillo", fuente: "Georgia, serif" },
        sangre: { nombre: "sangre", cuerpo: [112, 8, 22], tinta: [248, 228, 205], borde: [50, 0, 8], acabado: "brillo" },
        oro: { nombre: "oro", cuerpo: [214, 166, 58], tinta: [74, 44, 6], borde: [128, 86, 14], acabado: "metal" },
        plata: { nombre: "plata", cuerpo: [192, 198, 208], tinta: [32, 36, 48], borde: [96, 100, 116], acabado: "metal" },
        cristal: { nombre: "cristal", cuerpo: [110, 196, 255], tinta: [255, 255, 255], borde: [225, 246, 255],
            acabado: "cristal" },
        marmol: { nombre: "mármol", cuerpo: [238, 236, 232], tinta: [34, 34, 42], borde: [150, 150, 162],
            acabado: "vetas", vetas: [128, 128, 142] },
        madera: { nombre: "madera", cuerpo: [158, 104, 60], tinta: [248, 234, 205], borde: [86, 52, 24],
            acabado: "madera", vetas: [112, 70, 38], fuente: "Georgia, serif" },
        galaxia: { nombre: "galaxia", cuerpo: [44, 22, 86], tinta: [255, 238, 176], borde: [156, 118, 255],
            acabado: "galaxia" },
        neon: { nombre: "neón", cuerpo: [16, 14, 24], tinta: [70, 255, 210], borde: [70, 255, 210], acabado: "neon" },
        arcoiris: { nombre: "arcoíris", tinta: [255, 255, 255], borde: [255, 255, 255], acabado: "arcoiris" },
    };
    function hsl(h) {
        const f = (n) => {
            const k = (n + h / 30) % 12;
            return Math.round(255 * (0.5 - 0.42 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
        };
        return [f(0), f(8), f(4)];
    }
    function azarFijo(semilla) {
        let a = semilla >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let x = Math.imul(a ^ (a >>> 15), 1 | a);
            x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
            return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
        };
    }
    let lienzo = null;
    let ctx = null;
    let dados = [];
    let empieza = 0;
    let pedido = 0;
    let sucia = null;
    let esperas = [];
    let ultimoFotograma = 0;
    let lento = 0;
    let fuenteActual = "";
    const RUEDA = 1100;
    const QUIETOS = 1700;
    const SE_VA = 450;
    function colorDe(nombre, porDefecto) {
        const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || porDefecto;
        ctx.fillStyle = "#000";
        ctx.fillStyle = valor;
        const hex = ctx.fillStyle;
        const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
        if (m) {
            return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
        }
        const n = (hex.match(/[\d.]+/g) || [0, 0, 0]).map(Number);
        return n.slice(0, 3);
    }
    function montar() {
        lienzo = document.createElement("canvas");
        lienzo.className = "oc-dados-3d";
        lienzo.setAttribute("aria-hidden", "true");
        document.body.appendChild(lienzo);
        ctx = lienzo.getContext("2d");
    }
    function medir() {
        const dpr = window.devicePixelRatio || 1;
        lienzo.width = Math.round(window.innerWidth * dpr);
        lienzo.height = Math.round(window.innerHeight * dpr);
        lienzo.style.width = window.innerWidth + "px";
        lienzo.style.height = window.innerHeight + "px";
        fuenteActual = "";
        return dpr;
    }
    function zona() {
        const ventana = document.getElementById("oc-dados");
        const ancho = window.innerWidth;
        let x = ancho / 2;
        if (ventana && !ventana.hidden && ancho > 700) {
            const r = ventana.getBoundingClientRect();
            x = r.left + r.width / 2 > ancho / 2 ? r.left / 2 : (r.right + ancho) / 2;
        }
        return { x, y: window.innerHeight * 0.55 };
    }
    function lanzar(lista, aspecto) {
        const piel = ASPECTOS[aspecto] || ASPECTOS.tema;
        if (!lista || !lista.length) {
            return;
        }
        if (!lienzo) {
            montar();
        }
        medir();
        const raiz = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const visibles = lista.slice(0, 20);
        const lado = Math.max(34, Math.min(60, raiz * 2.6, (window.innerWidth - 40) / 7 / 1.7));
        const porFila = Math.max(1, Math.min(visibles.length, Math.floor(Math.min(window.innerWidth - 40, 760)
            / (lado * 2.4))));
        const filas = Math.ceil(visibles.length / porFila);
        const centro = zona();
        const tema = {
            cuerpo: colorDe("--yellow", "#f5d76e"),
            tinta: colorDe("--yellow-contrast", "#1a1423"),
        };
        dados = visibles.map((d, i) => {
            const tipo = tipoDe(d.caras);
            const s = solido(tipo);
            const nombres = etiquetas(d);
            const final = Math.floor(Math.random() * s.numeradas.length);
            const valor = d.caras === "F" && String(d.valor) === "0" ? "" : String(d.valor);
            let resto = nombres.slice();
            const cual = resto.indexOf(valor);
            if (cual >= 0) {
                resto.splice(cual, 1);
            }
            resto = resto.sort(() => Math.random() - 0.5);
            const letras = new Map();
            s.numeradas.forEach((c, j) => {
                letras.set(c, j === final ? valor : (resto.pop() || ""));
            });
            const cara = s.numeradas[final];
            const derecha = cruz(cara.arriba, cara.normal);
            const deFrente = [derecha, cara.arriba, cara.normal];
            const inclinado = componer(componer(girar([1, 0, 0], -0.32), girar([0, 1, 0], (Math.random() - 0.5) * 0.6)),
                componer(girar([0, 0, 1], (Math.random() - 0.5) * 0.35), deFrente));
            const fila = Math.floor(i / porFila);
            const enFila = Math.min(porFila, visibles.length - fila * porFila);
            const destino = {
                x: centro.x + (i % porFila - (enFila - 1) / 2) * lado * 2.4,
                y: centro.y + (fila - (filas - 1) / 2) * lado * 2.5,
            };
            let color = piel.cuerpo || tema.cuerpo;
            let tinta = piel.tinta || tema.tinta;
            let borde = piel.borde || tema.tinta;
            if (piel.acabado === "arcoiris") {
                color = hsl((i * 360) / Math.max(1, visibles.length));
            }
            if (d.color === "vampiro" && !piel.cuerpo && piel.acabado !== "arcoiris") {
                color = [34, 30, 40];
                tinta = [255, 255, 255];
                borde = tinta;
            }
            let acabado = piel.acabado || "liso";
            if (d.color === "hambre") {
                color = [196, 18, 34];
                tinta = [255, 255, 255];
                borde = [90, 0, 10];
                acabado = "brillo";
            }
            return {
                s, letras, final: inclinado, destino, lado: lado * (tipo === 4 ? 1.15 : tipo === 2 ? 0.95 : 1),
                desde: { x: destino.x + (Math.random() - 0.5) * 500, y: destino.y - 260 - Math.random() * 160 },
                eje: [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5],
                vueltas: (3 + Math.random() * 2.5) * Math.PI * 2,
                retraso: i * 35, color, tinta, borde, acabado, tipo, numero: i,
                fuente: piel.fuente || "system-ui, sans-serif", vetas: piel.vetas,
            };
        });
        const margen = lado * 2.2;
        const xs = dados.flatMap((d) => [d.desde.x, d.destino.x]);
        const ys = dados.flatMap((d) => [d.desde.y - 130, d.destino.y]);
        sucia = { x: Math.min(...xs) - margen, y: Math.min(...ys) - margen,
            x2: Math.max(...xs) + margen, y2: Math.max(...ys) + margen };
        esperas.forEach(clearTimeout);
        esperas = [];
        lienzo.classList.remove("se-va");
        borrar(true);
        empieza = performance.now();
        ultimoFotograma = 0;
        lento = 0;
        cancelAnimationFrame(pedido);
        pedido = requestAnimationFrame(pintar);
    }
    function borrar(todo) {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        if (todo || !sucia) {
            ctx.clearRect(0, 0, lienzo.width, lienzo.height);
            return;
        }
        ctx.clearRect(sucia.x * dpr, sucia.y * dpr, (sucia.x2 - sucia.x) * dpr, (sucia.y2 - sucia.y) * dpr);
    }
    function preparar() {
        [4, 6, 8, 10, 12, 20, 2].forEach(solido);
    }
    const LUZ = unitario([-0.45, 0.6, 0.85]);
    const MEDIO = unitario(suma(LUZ, [0, 0, 1]));
    function pintar(ahora) {
        const dpr = window.devicePixelRatio || 1;
        if (lienzo.width !== Math.round(window.innerWidth * dpr)) {
            medir();
        }
        if (ultimoFotograma && ahora - ultimoFotograma > 30) {
            lento++;
        }
        ultimoFotograma = ahora;
        borrar(false);
        const pasado = ahora - empieza;
        const rodando = RUEDA + dados.length * 35;
        const ligero = lento >= 3;
        dados.forEach((d) => pintarDado(d, Math.min(1, Math.max(0, (pasado - d.retraso) / RUEDA)), dpr, ligero));
        if (pasado < rodando) {
            pedido = requestAnimationFrame(pintar);
            return;
        }
        esperas.push(setTimeout(() => lienzo.classList.add("se-va"), QUIETOS));
        esperas.push(setTimeout(() => {
            borrar(true);
            lienzo.classList.remove("se-va");
            dados = [];
        }, QUIETOS + SE_VA));
    }
    function pintarDado(d, t, dpr, ligero) {
        const suave = 1 - Math.pow(1 - t, 3);
        const bote = Math.abs(Math.sin(t * Math.PI * 2.6)) * Math.pow(1 - t, 2) * 120;
        const x = d.desde.x + (d.destino.x - d.desde.x) * suave;
        const y = d.desde.y + (d.destino.y - d.desde.y) * Math.min(1, t * 1.6) - bote;
        const giro = componer(girar(d.eje, d.vueltas * (1 - suave)), d.final);
        const foco = d.lado * 7;
        const proyectar = (v) => {
            const p = aplicar(giro, v);
            const k = foco / (foco - p[2] * d.lado);
            return [(x + p[0] * d.lado * k) * dpr, (y - p[1] * d.lado * k) * dpr];
        };
        const quieto = t >= 1;
        if (!ligero || quieto) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
            ctx.beginPath();
            ctx.ellipse(d.destino.x * dpr, (d.destino.y + d.lado * 1.05) * dpr, d.lado * (0.9 - bote / 400) * dpr,
                d.lado * 0.22 * dpr, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        const puntos = d.s.vertices.map(proyectar);
        const rgb = (c, a) => (a === undefined ? "rgb(" : "rgba(") + c.map((x) => Math.max(0, Math.min(255, Math.round(x))))
            .join(",") + (a === undefined ? ")" : "," + a + ")");
        const sencillo = ligero && !quieto;
        const acabado = sencillo ? "liso" : d.acabado;
        const cristal = acabado === "cristal";
        const orden = cristal ? d.s.caras.map((c) => [c, aplicar(giro, c.normal)]).sort((p, q) => p[1][2] - q[1][2])
            : d.s.caras.map((c) => [c, aplicar(giro, c.normal)]);
        orden.forEach(([c, n], j) => {
            const deFrente = n[2] > 0.01;
            if (!deFrente && !cristal) {
                return;
            }
            const luz = 0.42 + 0.58 * Math.max(0, punto(n, LUZ));
            const brillo = Math.pow(Math.max(0, punto(n, MEDIO)), 22);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.beginPath();
            c.idx.forEach((v, m) => (m ? ctx.lineTo(...puntos[v]) : ctx.moveTo(...puntos[v])));
            ctx.closePath();
            const base = d.color.map((x) => x * luz);
            if (acabado === "metal") {
                const a = puntos[c.idx[0]];
                const b = puntos[c.idx[Math.floor(c.idx.length / 2)]];
                const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
                g.addColorStop(0, rgb(d.color.map((x) => x + (255 - x) * 0.6 * luz)));
                g.addColorStop(0.55, rgb(base));
                g.addColorStop(1, rgb(d.color.map((x) => x * 0.38)));
                ctx.fillStyle = g;
            } else if (cristal) {
                ctx.fillStyle = rgb(base.map((x) => x + 255 * brillo * 0.7), deFrente ? 0.42 : 0.18);
            } else if (acabado === "galaxia") {
                const o = proyectar(c.centro);
                const g = ctx.createRadialGradient(o[0], o[1], 0, o[0], o[1], d.lado * 0.9 * dpr);
                g.addColorStop(0, rgb([d.color[0] * 2.2 * luz, d.color[1] * 1.6 * luz, d.color[2] * 1.9 * luz]));
                g.addColorStop(1, rgb([6, 4, 18]));
                ctx.fillStyle = g;
            } else {
                const reflejo = acabado === "brillo" || acabado === "neon" ? brillo * 0.55 : brillo * 0.12;
                ctx.fillStyle = rgb(base.map((x) => x + 255 * reflejo));
            }
            ctx.fill();
            const enSuPlano = () => {
                const o = proyectar(c.centro);
                const ex = proyectar(suma(c.centro, por(c.derecha, 0.01)));
                const ey = proyectar(suma(c.centro, por(c.arriba, -0.01)));
                ctx.setTransform(ex[0] - o[0], ex[1] - o[1], ey[0] - o[0], ey[1] - o[1], o[0], o[1]);
            };
            if (deFrente && !ligero && ["vetas", "madera", "galaxia"].includes(d.acabado)) {
                ctx.save();
                ctx.clip();
                enSuPlano();
                const azar = azarFijo(d.numero * 97 + j * 13 + 7);
                const r = c.radio * 160;
                if (d.acabado !== "galaxia") {
                    const madera = d.acabado === "madera";
                    ctx.strokeStyle = rgb(d.vetas.map((x) => x * luz), madera ? 0.55 : 0.7);
                    for (let k = 0; k < (madera ? 7 : 3); k++) {
                        ctx.lineWidth = (madera ? 2 + azar() * 3 : 1 + azar() * 2.5) * 1;
                        ctx.beginPath();
                        const y0 = madera ? -r + (k + azar() * 0.6) * (2 * r / 7) : (azar() - 0.5) * 2 * r;
                        ctx.moveTo(-r * 1.2, y0);
                        ctx.bezierCurveTo(-r * 0.4, y0 + (azar() - 0.5) * r * (madera ? 0.4 : 1.4),
                            r * 0.4, y0 + (azar() - 0.5) * r * (madera ? 0.4 : 1.4), r * 1.2,
                            y0 + (azar() - 0.5) * r * (madera ? 0.3 : 1));
                        ctx.stroke();
                    }
                } else {
                    for (let k = 0; k < 14; k++) {
                        ctx.fillStyle = "rgba(255, 255, 255, " + (0.4 + azar() * 0.6).toFixed(2) + ")";
                        ctx.beginPath();
                        ctx.arc((azar() - 0.5) * 2 * r, (azar() - 0.5) * 2 * r, 1 + azar() * 2.4, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                ctx.restore();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.beginPath();
                c.idx.forEach((v, m) => (m ? ctx.lineTo(...puntos[v]) : ctx.moveTo(...puntos[v])));
                ctx.closePath();
            }
            ctx.lineWidth = (d.acabado === "neon" ? 2.2 : 1.5) * dpr;
            ctx.lineJoin = "round";
            ctx.strokeStyle = rgb(d.borde, d.acabado === "neon" || cristal ? (deFrente ? 0.95 : 0.35) : 0.75);
            if (d.acabado === "neon" && !ligero) {
                ctx.shadowColor = rgb(d.borde);
                ctx.shadowBlur = 9 * dpr;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
            const texto = d.letras.get(c);
            if (!deFrente || !texto || n[2] < 0.3 || (ligero && !quieto)) {
                return;
            }
            enSuPlano();
            const tam = c.radio * (texto.length > 1 ? 0.95 : 1.25) * 100;
            const fuente = "700 " + Math.round(tam) + "px " + d.fuente;
            if (fuente !== fuenteActual) {
                ctx.font = fuente;
                fuenteActual = fuente;
            }
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = rgb(d.tinta);
            if (d.acabado === "neon" && !ligero) {
                ctx.shadowColor = rgb(d.tinta);
                ctx.shadowBlur = 8 * dpr;
            }
            ctx.fillText(texto, 0, tam * 0.05);
            if ((texto === "6" || texto === "9") && d.tipo !== 6) {
                ctx.fillRect(-tam * 0.28, tam * 0.42, tam * 0.56, tam * 0.08);
            }
            ctx.shadowBlur = 0;
        });
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    function aspectos() {
        return Object.keys(ASPECTOS).map((k) => [k, ASPECTOS[k].nombre]);
    }
    window.ocDados3d = { lanzar, preparar, aspectos };
})();
(function () {
    const marcas = Array.from(document.querySelectorAll(".oc-dado[data-dados]"));
    const sitioDelBoton = document.querySelector("[data-oc-botones]");
    if (!marcas.length && !sitioDelBoton) {
        return;
    }
    const CARAS = [2, 4, 6, 8, 10, 12, 20, 100];
    const SISTEMA = (sitioDelBoton && sitioDelBoton.dataset.ocSistema) || "dnd5e";
    const menosMovimiento = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const estado = { mano: {}, modo: "normal", tiradas: [], cuenta: 0, sonido: leer("richi-dados-sonido") !== "no",
        tresD: leer("richi-dados-3d") ? leer("richi-dados-3d") === "si" : !menosMovimiento,
        aspecto: leer("richi-dados-aspecto") || "",
        aspectoDelPersonaje: (sitioDelBoton && sitioDelBoton.dataset.ocAspecto) || "",
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
    function formulaParaVer(formula) {
        return String(formula).replace(/\s*\[([^\]]+)\]/g, " $1").replace(/\+/g, " + ").replace(/-/g, " − ")
            .replace(/\s+/g, " ").trim();
    }
    function claveDeTipo(tipo) {
        return String(tipo).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
    }
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
        const dados3d = [];
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
                d20.valores.forEach((v) => dados3d.push({ caras: 20, valor: v }));
                total += t.signo * d20.queda;
                partes.push(d20);
                return;
            }
            const salen = [];
            for (let i = 0; i < t.cuantos; i++) {
                const x = t.caras === "F" ? alAzar(3) - 2 : alAzar(t.caras);
                salen.push(t.caras === "F" ? ["−", "0", "+"][x + 1] : x);
                if (t.caras === 100) {
                    dados3d.push({ caras: "decenas", valor: String(Math.floor((x % 100) / 10) * 10).padStart(2, "0") },
                        { caras: "unidades", valor: x % 10 });
                } else {
                    dados3d.push({ caras: t.caras, valor: t.caras === "F" ? salen[salen.length - 1] : x });
                }
                total += t.signo * x;
                sumar(t.tipo, t.signo * x);
            }
            partes.push({ texto: signo + t.cuantos + "d" + t.caras + " [" + salen.join(", ") + "]" });
        });
        const r = guardarTirada({ que: que || "tirada", formula: String(formula), total, partes, d20, tipos, dados3d });
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
        enTresD(r.dados3d);
        sonar();
        if (r.critico || r.pifia) {
            sonarFinal(r.critico);
        }
        anadir(r);
        return r;
    }
    function enTresD(lista) {
        if (estado.tresD && lista && lista.length && window.ocDados3d) {
            try {
                window.ocDados3d.lanzar(lista, estado.aspecto || estado.aspectoDelPersonaje || "tema");
            } catch (e) {
            }
        }
    }
    const ESCALERA = { 8: "Legendario", 7: "Épico", 6: "Fantástico", 5: "Soberbio", 4: "Grande", 3: "Bueno",
        2: "Normal", 1: "Mediano", 0: "Mediocre", "-1": "Malo", "-2": "Terrible" };
    function escalera(n) {
        return ESCALERA[Math.max(-2, Math.min(8, n))] || "";
    }
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
            unidad: exitos === 1 ? "éxito" : "éxitos", partes: [], d20: null,
            dados3d: normales.map((v) => ({ caras: 10, valor: v, color: "vampiro" }))
                .concat(deHambre.map((v) => ({ caras: 10, valor: v, color: "hambre" }))) });
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
    function tirarCyberpunk(base, que, formula) {
        const d = alAzar(10);
        const otro = d === 10 || d === 1 ? alAzar(10) : 0;
        const dado = d === 10 ? d + otro : d === 1 ? d - otro : d;
        const r = guardarTirada({ que: que || "tirada", formula, total: dado + base, partes: [], d20: null,
            dados3d: [{ caras: 10, valor: d }].concat(otro ? [{ caras: 10, valor: otro }] : []) });
        r.desglose = "1d10 [" + d + (d === 10 ? " + " + otro : d === 1 ? " − " + otro : "") + "]"
            + (base ? (base > 0 ? " + " : " − ") + Math.abs(base) : "");
        r.formulaVista = "1d10" + (base ? (base > 0 ? " + " : " − ") + Math.abs(base) : "");
        r.critico = d === 10;
        r.pifia = d === 1;
        r.nota = d === 10 ? "¡crítico! (+" + otro + ")" : d === 1 ? "pifia (−" + otro + ")" : "";
        return terminar(r);
    }
    function ponerModo(d20, modo) {
        const b = alAzar(20);
        d20.valores = [d20.valores[0], b];
        d20.modo = modo;
        d20.queda = modo === "ventaja" ? Math.max(d20.valores[0], b) : Math.min(d20.valores[0], b);
    }
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
    function dicho(r) {
        return r.que + ": " + r.total + (r.unidad ? " " + r.unidad : "") + (r.nota ? ", " + r.nota : "");
    }
    function cambiarModo(r, modo) {
        if (!r.d20 || r.d20.modo !== "normal") {
            return;
        }
        const antes = r.d20.queda;
        ponerModo(r.d20, modo);
        enTresD(r.d20.valores.map((v) => ({ caras: 20, valor: v })));
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
        const tresD = botonDe("oc-dados-mando es-3d", "3D", () => {
            estado.tresD = !estado.tresD;
            tresD.setAttribute("aria-pressed", estado.tresD ? "true" : "false");
            const fila = document.getElementById("oc-dados-aspecto");
            if (fila) {
                fila.parentNode.hidden = !estado.tresD;
            }
            guardar("richi-dados-3d", estado.tresD ? "si" : "no");
        }, "Dados en 3D");
        tresD.setAttribute("aria-pressed", estado.tresD ? "true" : "false");
        const cerrar = botonDe("oc-dados-mando", "✕", () => abrir(false, true), "Cerrar los dados");
        const mandos = crear("div", "oc-dados-mandos");
        mandos.append(tresD, sonido, cerrar);
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
        if (SISTEMA === "fate" || SISTEMA === "cpred") {
            const fate = SISTEMA === "fate";
            acciones.appendChild(botonDe("oc-dados-tirar es-del-sistema", fate ? "tirar 4dF" : "tirar 1d10", () => {
                const mod = modificador();
                tirar(fate ? "4dF" + (mod ? (mod > 0 ? "+" : "") + mod : "") : "cp:" + mod, fate ? "4dF" : "1d10");
            }, fate ? "Tirar 4dF más el modificador" : "Tirar 1d10 más el modificador (con críticos y pifias)"));
        }
        const reserva = SISTEMA === "vtm5" ? montarReserva() : null;
        const filaAspecto = crear("div", "oc-dados-fila");
        const etiquetaAspecto = crear("label", "oc-dados-etiqueta", "aspecto");
        const elegirAspecto = crear("select", "oc-dados-elegir");
        elegirAspecto.id = "oc-dados-aspecto";
        etiquetaAspecto.htmlFor = elegirAspecto.id;
        const propio = ((window.ocDados3d && window.ocDados3d.aspectos()) || [])
            .find((x) => x[0] === estado.aspectoDelPersonaje);
        const deCada = crear("option", "", propio ? "el de este personaje (" + propio[1] + ")" : "el de cada personaje");
        deCada.value = "";
        elegirAspecto.appendChild(deCada);
        ((window.ocDados3d && window.ocDados3d.aspectos()) || []).forEach(([clave, nombre]) => {
            const o = crear("option", "", nombre);
            o.value = clave;
            elegirAspecto.appendChild(o);
        });
        elegirAspecto.value = estado.aspecto;
        elegirAspecto.addEventListener("change", () => {
            estado.aspecto = elegirAspecto.value;
            guardar("richi-dados-aspecto", estado.aspecto);
            enTresD([{ caras: 20, valor: 20 }]);
        });
        filaAspecto.append(etiquetaAspecto, elegirAspecto);
        filaAspecto.hidden = !estado.tresD;
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
            cuerpo.append(reserva, bandeja, manoTexto, fila, acciones, filaAspecto, cabeza, historial, aviso);
        } else {
            cuerpo.append(bandeja, manoTexto, fila, modos, acciones, filaAspecto, cabeza, historial, aviso);
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
    function ponerEnReserva(b) {
        const tipo = b.dataset.reserva === "habilidad" ? "habilidad" : "atributo";
        estado.reserva[tipo] = [b.dataset.que, parseInt(b.dataset.valor || "0", 10) || 0];
        pintarReserva();
        if (ventana.hidden) {
            abrir(true, false);
        }
        avisar("Reserva: " + textoDeReserva() + ". Tírala con «tirar reserva», en los dados.");
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
        if (si && estado.tresD && window.ocDados3d) {
            (window.requestIdleCallback || setTimeout)(() => window.ocDados3d.preparar());
        }
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
    if (estado.tresD && window.ocDados3d) {
        (window.requestIdleCallback || setTimeout)(() => window.ocDados3d.preparar());
    }
    if (sitioDelBoton) {
        boton = crear("button", "oc-boton oc-boton-dados");
        boton.type = "button";
        boton.title = "Lanzador de dados";
        boton.append(silueta(20), crear("span", "visually-hidden", "dados"));
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
