// =========================================
// LA VENTANA «dibujo» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

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
    const DIBUJO_COLORES = [["#1d1b26", ocT("negro")], ["#ffffff", ocT("blanco")], ["#c62828", ocT("rojo")], ["#1565c0", ocT("azul")],
        ["#2e7d32", ocT("verde")], ["#ef6c00", ocT("naranja")], ["#6a1b9a", ocT("morado")], ["#8d6e63", ocT("marrón")], ["#fdd835", ocT("amarillo")],
        ["#9e9e9e", ocT("gris")]];
    // [id, emoji, nombre, tecla]
    const DIBUJO_HERRAMIENTAS = [["lapiz", "✏️", "Lápiz", "b"], ["goma", "🧽", "Goma", "e"], ["bote", "🪣", ocT("Bote de pintura"), "g"],
        ["seleccionar", "⬚", ocT("Seleccionar y mover"), "m"], ["cuentagotas", "💧", ocT("Cuentagotas (coger un color)"), "i"],
        ["linea", "╱", ocT("Línea recta"), "l"], ["rectangulo", "▭", "Rectángulo", "u"], ["elipse", "◯", "Elipse", "o"],
        ["texto", "T", "Texto", "t"]];
    const DIBUJO_FUENTES = [["Pangolin", ocT("a mano")], ["Space Grotesk", ocT("normal")], ["Georgia, serif", ocT("con serifa")],
        ["DM Mono", ocT("de máquina")], ["Jersey 10", ocT("de píxeles")]];

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
            d.capas = [{ id: nuevoId(), tipo: "capa", nombre: ocT("capa 1"), visible: true, opacidad: 100, imagen: d.imagen || "" }];
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
        const marco = PM.crear("div", "master-dibujo-marco");
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
            encima.setAttribute("aria-label", ocT("Dibujo{n}. Se dibuja con el ratón, el dedo o un lápiz; Ctrl+V pega una imagen.", { n: d.desc ? ": " + d.desc : ocT(" (sin descripción)") }));
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
        // Las capas tocadas, a sus imágenes (ya, sin esperar).
        const volcar = () => {
            clearTimeout(espera);
            tocadas.forEach((x) => {
                const b = buscar(x);
                if (b && lienzos[x]) {
                    b.n.imagen = fotoDe(lienzos[x]);
                }
            });
            tocadas.clear();
            pintarMinis();
            d.activa = activa;
        };
        const guardarDibujo = (id) => {
            if (id) {
                tocadas.add(id);
            }
            clearTimeout(espera);
            espera = setTimeout(() => {
                volcar();
                if (!PM.guardar()) {
                    PM.avisar(ocT("No se ha podido guardar el dibujo: no cabe. Quita alguna imagen o capa, o descárgalo."));
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
                PM.avisar(ocT("Elige una capa (no una carpeta) para pintar."));
                return null;
            }
            let ve = true;
            let b = buscar(c.id);
            while (b) {
                ve = ve && b.n.visible;
                b = b.padre ? buscar(b.padre.id) : null;
            }
            if (!ve) {
                PM.avisar(ocT("La capa «{nombre}» está escondida: enséñala para pintar en ella.", { nombre: c.nombre }));
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
            const caja = PM.crear("textarea", "master-dibujo-texto");
            caja.rows = 1;
            caja.setAttribute("aria-label", ocT("Texto para el dibujo (Intro lo pone; Esc lo quita)"));
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
                PM.avisar(ocT("Texto puesto: {replace}.", { replace: texto.replace(/\n/g, " ") }));
            });
        }

        // DOS DEDOS sobre el dibujo: pellizco para el zoom y, a la vez,
        // moverse por él (un dedo dibuja). Si el segundo llega cuando el
        // primero ya había empezado a pintar, eso se deshace. Mientras se
        // pinta con un lápiz, la palma no pinta. Va antes que lo del ratón
        // (en captura) y, cuando es suyo, no lo deja pasar.
        const toques = new Map();
        let dosDedos = null;
        // Lo que se desplaza de lado (el visor del dibujo) y lo que se
        // desplaza hacia abajo (la ventana, o la página) no tiene por qué
        // ser lo mismo: en cada eje, lo primero que de verdad se desplaza.
        const cajaDelDibujo = (eje) => {
            for (let x = marco.parentElement; x && x !== document.body; x = x.parentElement) {
                const sobra = eje === "x" ? x.scrollWidth > x.clientWidth + 1 : x.scrollHeight > x.clientHeight + 1;
                if (sobra && /(auto|scroll)/.test(getComputedStyle(x)[eje === "x" ? "overflowX" : "overflowY"])) {
                    return x;
                }
            }
            return document.scrollingElement;
        };
        const entreDedos = () => {
            const [a, b] = Array.from(toques.values());
            return { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1 };
        };
        const deshacerEmpezado = () => {
            if (gesto && (gesto.que === "trazo" || gesto.que === "figura")) {
                const x = atras.pop();
                if (x && lienzos[x.id]) {
                    const c = lienzos[x.id].getContext("2d");
                    c.globalCompositeOperation = "source-over";
                    c.putImageData(x.px, 0, 0);
                }
                figura = null;
                pintarMandos();
            }
            gesto = null;
            repintar();
        };
        encima.addEventListener("pointerdown", (e) => {
            if (e.pointerType !== "touch") {
                return;
            }
            if (gesto && gesto.tipo === "pen") {
                e.stopImmediatePropagation();
                return;
            }
            toques.set(e.pointerId, [e.clientX, e.clientY]);
            try {
                encima.setPointerCapture(e.pointerId);
            } catch (err) {
                // Sin captura: se pierde al salir del lienzo.
            }
            if (toques.size === 2 && !dosDedos) {
                e.preventDefault();
                e.stopImmediatePropagation();
                deshacerEmpezado();
                const c = entreDedos();
                const r = marco.getBoundingClientRect();
                dosDedos = { d: c.d, z: zoomD, fx: (c.x - r.left) / r.width, fy: (c.y - r.top) / r.height };
            } else if (toques.size > 1) {
                e.stopImmediatePropagation();
            }
        }, true);
        encima.addEventListener("pointermove", (e) => {
            if (toques.has(e.pointerId)) {
                toques.set(e.pointerId, [e.clientX, e.clientY]);
            }
            if (dosDedos) {
                e.stopImmediatePropagation();
                if (toques.size !== 2) {
                    return;
                }
                const c = entreDedos();
                const z = Math.min(ZOOMS_DIBUJO[ZOOMS_DIBUJO.length - 1], Math.max(ZOOMS_DIBUJO[0],
                    Math.round(dosDedos.z * c.d / dosDedos.d * 100) / 100));
                if (z !== zoomD) {
                    zoomD = z;
                    marco.style.width = z === 1 ? "" : (z * 100) + "%";
                    valorZoom.textContent = Math.round(z * 100) + " %";
                }
                // Lo que estaba entre los dedos, que siga entre los dedos.
                const r = marco.getBoundingClientRect();
                cajaDelDibujo("x").scrollLeft += r.left + dosDedos.fx * r.width - c.x;
                cajaDelDibujo("y").scrollTop += r.top + dosDedos.fy * r.height - c.y;
            } else if (gesto && gesto.id !== undefined && e.pointerId !== gesto.id) {
                e.stopImmediatePropagation();
            }
        }, true);
        const dedoFuera = (e) => {
            toques.delete(e.pointerId);
            if (dosDedos) {
                e.stopImmediatePropagation();
                if (toques.size < 2) {
                    dosDedos = null;
                    ponerZoomD(zoomD, true);
                }
            } else if (gesto && gesto.id !== undefined && e.pointerId !== gesto.id) {
                e.stopImmediatePropagation();
            }
        };
        encima.addEventListener("pointerup", dedoFuera, true);
        encima.addEventListener("pointercancel", dedoFuera, true);

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
                PM.avisar(ocT("Color cogido: {color}.", { color: color }));
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
        encima.addEventListener("pointerdown", (e) => {
            if (gesto && gesto.id === undefined) {
                gesto.id = e.pointerId;
                gesto.tipo = e.pointerType;
            }
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
                PM.avisar(ocT("Seleccionado. Arrástralo o muévelo con las flechas; las asas o + y − cambian el tamaño; Supr lo borra, Esc lo suelta."));
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
                PM.avisar(ocT("Tamaño: {round} × {round2}.", { round: Math.round(w), round2: Math.round(h) }));
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
                PM.avisar(ocT("Borrado lo seleccionado."));
                return;
            }
            if (sel && e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                quitarSeleccion();
                PM.avisar(ocT("Selección soltada."));
                return;
            }
            const h = DIBUJO_HERRAMIENTAS.find((x) => x[3] === k);
            if (h) {
                e.preventDefault();
                elegirHerramienta(h[0]);
                PM.avisar(h[2] + ".");
            }
        });

        // PEGAR O ARRASTRAR IMÁGENES: en una capa nueva, encogidas para que
        // quepan (como mucho el 80 % del lienzo), y seleccionadas para
        // moverlas.
        const pegar = (archivo, x, y) => {
            if (!archivo || !/^image\//.test(archivo.type)) {
                PM.avisar(ocT("Eso no es una imagen."));
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
                    PM.avisar(ocT("Imagen pegada en una capa nueva, seleccionada para moverla."));
                };
                img.onerror = () => PM.avisar(ocT("No he podido abrir esa imagen."));
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
        const barra = PM.crear("div", "master-postit-barra es-dibujo");
        barra.setAttribute("role", "toolbar");
        barra.setAttribute("aria-label", ocT("Herramientas del dibujo"));
        const grupo = (...cosas) => {
            const g = PM.crear("span", "master-postit-grupo");
            g.append(...cosas);
            barra.appendChild(g);
            return g;
        };
        const botonesH = DIBUJO_HERRAMIENTAS.map(([id, emoji, nombre, tecla]) => {
            const b = PM.botonDe("master-postit-boton", emoji, () => elegirHerramienta(id), nombre);
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
            PM.guardar();
        }
        grupo(...botonesH);
        // Los colores: los de siempre y el selector del navegador.
        const muestras = DIBUJO_COLORES.map(([hex, nombre]) => {
            const b = PM.botonDe("master-postit-boton master-dibujo-color", "", () => {
                ponerColor(hex);
                if (herramienta === "goma" || herramienta === "seleccionar" || herramienta === "cuentagotas") {
                    elegirHerramienta("lapiz");
                }
            }, ocT("Color {nombre}", { nombre: nombre }));
            b.title = nombre;
            b.dataset.hex = hex;
            b.style.setProperty("--muestra", hex);
            return b;
        });
        const elegirColor = PM.crear("input", "master-dibujo-selector");
        elegirColor.type = "color";
        elegirColor.title = ocT("Cualquier color");
        elegirColor.setAttribute("aria-label", ocT("Elegir cualquier color"));
        elegirColor.addEventListener("input", () => ponerColor(elegirColor.value));
        function ponerColor(hex) {
            color = hex.toLowerCase();
            d.color = color;
            elegirColor.value = color;
            muestras.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.hex === color)));
            PM.guardar();
        }
        grupo(...muestras);
        const conSelector = grupo(elegirColor);
        conSelector.classList.add("es-selector");
        // ---- LAS OPCIONES (arriba del lienzo, como el Paint): las de la
        // herramienta (grosor; letra y tamaño del texto; margen del bote) y
        // deshacer, imagen, descargar y rejilla. ----
        const opciones = PM.crear("div", "master-dibujo-opciones");
        opciones.setAttribute("role", "toolbar");
        opciones.setAttribute("aria-label", ocT("Opciones del dibujo"));
        const deslizador = (texto, min, max, valor, alCambiar, unidad) => {
            const et = PM.crear("label", "master-dibujo-deslizador");
            const r = PM.crear("input");
            r.type = "range";
            r.min = min;
            r.max = max;
            r.value = valor;
            const v = PM.crear("span", "master-dibujo-valor", valor + (unidad || ""));
            v.setAttribute("aria-hidden", "true");
            r.setAttribute("aria-valuetext", valor + (unidad || ""));
            r.addEventListener("input", () => {
                v.textContent = r.value + (unidad || "");
                r.setAttribute("aria-valuetext", r.value + (unidad || ""));
                alCambiar(parseInt(r.value, 10));
            });
            et.append(PM.crear("span", "oc-dados-etiqueta", texto), r, v);
            return et;
        };
        const opGrosor = deslizador(ocT("grosor"), 1, 80, grosor, (x) => {
            grosor = x;
            d.grosor = x;
            PM.guardar();
        }, " px");
        let margenBote = parseInt(d.margen, 10) || 40;
        const opMargen = deslizador(ocT("margen del bote"), 0, 160, margenBote, (x) => {
            margenBote = x;
            d.margen = x;
            PM.guardar();
        });
        opMargen.title = ocT("Cuánto se puede parecer un color al de donde pinchas para que también se rellene");
        // El texto: letra, tamaño y negrita.
        d.texto = Object.assign({ fuente: "Pangolin", tam: 40, negrita: false }, d.texto || {});
        const opTexto = PM.crear("span", "master-dibujo-optexto");
        const fuente = PM.crear("select", "master-postit-elegir");
        fuente.setAttribute("aria-label", ocT("Letra del texto"));
        DIBUJO_FUENTES.forEach(([f, n]) => {
            const o = PM.crear("option", "", n);
            o.value = f;
            fuente.appendChild(o);
        });
        fuente.value = d.texto.fuente;
        const tamTexto = PM.crear("input", "master-dibujo-numero");
        tamTexto.type = "number";
        tamTexto.min = 8;
        tamTexto.max = 300;
        tamTexto.value = d.texto.tam;
        tamTexto.setAttribute("aria-label", ocT("Tamaño del texto"));
        tamTexto.title = ocT("Tamaño del texto");
        const negrita = PM.botonDe("master-postit-boton es-negrita", "B", () => {
            d.texto.negrita = !d.texto.negrita;
            negrita.setAttribute("aria-pressed", String(d.texto.negrita));
            PM.guardar();
        }, ocT("Texto en negrita"));
        negrita.setAttribute("aria-pressed", String(!!d.texto.negrita));
        fuente.addEventListener("change", () => {
            d.texto.fuente = fuente.value;
            PM.guardar();
        });
        tamTexto.addEventListener("change", () => {
            d.texto.tam = Math.min(300, Math.max(8, parseInt(tamTexto.value, 10) || 40));
            PM.guardar();
        });
        opTexto.append(fuente, tamTexto, negrita);
        const pintarOpciones = () => {
            opGrosor.hidden = ["lapiz", "goma", "linea", "rectangulo", "elipse"].indexOf(herramienta) < 0;
            opMargen.hidden = herramienta !== "bote";
            opTexto.hidden = herramienta !== "texto";
        };
        const deshacer = PM.botonDe("master-postit-boton", "↶", () => volverA(atras, adelante), ocT("Deshacer"));
        const rehacer = PM.botonDe("master-postit-boton", "↷", () => volverA(adelante, atras), ocT("Rehacer"));
        deshacer.title = ocT("Deshacer (Ctrl+Z)");
        rehacer.title = ocT("Rehacer (Ctrl+Y)");
        const archivo = PM.crear("input");
        archivo.type = "file";
        archivo.accept = "image/*";
        archivo.hidden = true;
        archivo.addEventListener("change", () => {
            pegar(archivo.files && archivo.files[0]);
            archivo.value = "";
        });
        const imagen = PM.botonDe("master-postit-boton", "🖼️", () => archivo.click(), ocT("Poner una imagen"));
        imagen.title = ocT("Poner una imagen en una capa nueva (o pégala con Ctrl+V)");
        const bajar = PM.botonDe("master-postit-boton", "⬇", () => {
            soltarFlotante();
            const l = lienzoNuevo(ANCHO, ALTO);
            const c = l.getContext("2d");
            componer(c, false);
            if (d.rejilla.ver && d.rejilla.bajar) {
                pintarRejilla(c, d.rejilla);
            }
            const a = PM.crear("a");
            a.href = l.toDataURL("image/png");
            a.download = (m.titulo || "dibujo").replace(/[^\p{L}\p{N}]+/gu, "-") + ".png";
            document.body.appendChild(a);
            a.click();
            a.remove();
            PM.avisar(ocT("Descargado: {download}.", { download: a.download }));
        }, ocT("Descargar el dibujo"));
        bajar.title = ocT("Descargar como PNG (todas las capas que se ven)");
        const aJugadores = PM.botonDe("master-postit-boton", "📺", () => {
            soltarFlotante();
            const l = lienzoNuevo(ANCHO, ALTO);
            const c = l.getContext("2d");
            componer(c, false);
            if (d.rejilla.ver && d.rejilla.bajar) {
                pintarRejilla(c, d.rejilla);
            }
            l.toBlob((blob) => {
                if (blob) {
                    PM.mostrarAJugadores({ modo: "imagen", titulo: "" }, blob).then(() => PM.avisar(ocT("Los jugadores ven el dibujo.")));
                }
            }, "image/png");
        }, ocT("Enseñar este dibujo en la pantalla de jugadores"));
        aJugadores.title = ocT("Enseñar el dibujo en la pantalla de jugadores (lo que se ve ahora)");
        const botonRejilla = PM.crear("button", "master-postit-boton", "#");
        botonRejilla.type = "button";
        botonRejilla.setAttribute("aria-label", ocT("Rejilla de rol"));
        botonRejilla.title = ocT("Enseñar o esconder la rejilla");

        // GUARDAR EN DOCUMENTOS: el dibujo entero (con sus capas), para
        // abrirlo otra vez desde «documentos» y seguir dibujando.
        const aDocs = PM.botonDe("master-postit-boton", "📁", () => {
            soltarFlotante();
            volcar();
            PM.guardarEnDocumentos(aDocs, d.doc, () => {
                const copia = JSON.parse(JSON.stringify(d));
                delete copia.doc;
                delete copia.zoom;
                return { tipo: "dibujo", titulo: m.titulo || "dibujo", datos: copia };
            }, (id) => {
                d.doc = id;
            });
        }, ocT("Guardar en documentos (con sus capas)"));
        aDocs.title = ocT("Guardar en documentos (con sus capas)");
        aDocs.setAttribute("aria-haspopup", "dialog");

        // EL ZOOM DEL LIENZO (d.zoom): − 100 % +, y Ctrl + rueda encima. A
        // más del 100 %, el lienzo se desliza dentro de su visor.
        const ZOOMS_DIBUJO = [0.5, 0.75, 1, 1.5, 2, 3, 4];
        // Con los botones va de uno en uno de la lista; con el pellizco,
        // cualquiera entre el primero y el último.
        const zoomGuardado = Number(d.zoom);
        let zoomD = zoomGuardado >= ZOOMS_DIBUJO[0] && zoomGuardado <= ZOOMS_DIBUJO[ZOOMS_DIBUJO.length - 1] ? zoomGuardado : 1;
        const visor = PM.crear("div", "master-dibujo-visor");
        const valorZoom = PM.botonDe("master-postit-boton master-dibujo-zoom-valor", "100 %", () => ponerZoomD(1, true),
            ocT("Zoom del lienzo al 100 %"));
        const menosZoom = PM.botonDe("master-postit-boton", "－", () => pasoZoomD(-1), ocT("Alejar el lienzo"));
        const masZoom = PM.botonDe("master-postit-boton", "＋", () => pasoZoomD(1), ocT("Acercar el lienzo"));
        menosZoom.title = ocT("Alejar (Ctrl + rueda)");
        masZoom.title = ocT("Acercar (Ctrl + rueda)");
        function ponerZoomD(z, decirlo) {
            zoomD = z;
            d.zoom = z === 1 ? undefined : z;
            marco.style.width = z === 1 ? "" : (z * 100) + "%";
            valorZoom.textContent = Math.round(z * 100) + " %";
            valorZoom.setAttribute("aria-label", ocT("Zoom del lienzo: {round} % (pulsa para el 100 %)", { round: Math.round(z * 100) }));
            menosZoom.disabled = z <= ZOOMS_DIBUJO[0];
            masZoom.disabled = z >= ZOOMS_DIBUJO[ZOOMS_DIBUJO.length - 1];
            pintarEncima();
            PM.guardar();
            if (decirlo) {
                PM.avisar(ocT("Zoom del lienzo: {round} %.", { round: Math.round(z * 100) }));
            }
        }
        const pasoZoomD = (s) => {
            const sig = s > 0 ? ZOOMS_DIBUJO.find((x) => x > zoomD) : ZOOMS_DIBUJO.slice().reverse().find((x) => x < zoomD);
            if (sig) {
                ponerZoomD(sig, true);
            }
        };
        encima.addEventListener("wheel", (e) => {
            if (!e.ctrlKey) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            pasoZoomD(e.deltaY < 0 ? 1 : -1);
        }, { passive: false });

        // Debajo de las herramientas de pintar: deshacer, el zoom y la
        // rejilla, y lo de guardar (imagen, descargar y documentos).
        const titulado = (texto, ...cosas) => {
            const g = grupo(...cosas);
            g.setAttribute("role", "group");
            g.setAttribute("aria-label", texto);
            return g;
        };
        titulado(ocT("Deshacer y rehacer"), deshacer, rehacer);
        titulado(ocT("Zoom del lienzo"), menosZoom, masZoom);
        titulado(ocT("Zoom actual"), valorZoom).classList.add("es-selector");
        titulado(ocT("Rejilla"), botonRejilla);
        titulado(ocT("Guardar"), imagen, bajar, aDocs, aJugadores).classList.add("es-guardar");
        opciones.append(opGrosor, opMargen, opTexto);

        // ---- LAS CAPAS (a la derecha) ----
        const panel = PM.crear("div", "master-dibujo-panel");
        const tituloCapas = PM.crear("h3", "master-dibujo-titulo", ocT("capas"));
        const listaCapas = PM.crear("ul", "master-dibujo-capas");
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
        listaCapas.setAttribute("aria-label", ocT("Capas y carpetas (la de arriba se ve encima)"));
        function nuevaCapa(nombre) {
            const c = { id: nuevoId(), tipo: "capa", nombre: nombre || ocT("capa {n}", { n: Object.keys(lienzos).length + 1 }), visible: true,
                opacidad: 100, imagen: "" };
            lienzos[c.id] = lienzoNuevo(ANCHO, ALTO);
            // Encima de la activa, en su misma carpeta.
            const b = buscar(activa);
            const lista = b ? b.lista : d.capas;
            lista.splice(b ? lista.indexOf(b.n) : 0, 0, c);
            activa = c.id;
            d.activa = activa;
            pintarCapas();
            PM.guardar();
            return c;
        }
        const masCapa = PM.botonDe("oc-vida-accion", ocT("＋ capa"), () => {
            const c = nuevaCapa();
            PM.avisar(ocT("Capa nueva: {nombre}.", { nombre: c.nombre }));
        }, ocT("Capa nueva"));
        const masCarpeta = PM.botonDe("oc-vida-accion", ocT("📁 carpeta"), () => {
            const n = { id: nuevoId(), tipo: "carpeta", nombre: "carpeta", visible: true, opacidad: 100, abierta: true, hijos: [] };
            const b = buscar(activa);
            const lista = b ? b.lista : d.capas;
            lista.splice(b ? lista.indexOf(b.n) : 0, 0, n);
            activa = n.id;
            pintarCapas();
            PM.guardar();
            PM.avisar(ocT("Carpeta nueva. Mete capas en ella con «⇥ a la carpeta»."));
        }, ocT("Carpeta nueva"));
        const nuevas = PM.crear("div", "master-dibujo-nuevas");
        nuevas.append(masCapa, masCarpeta);
        const fila = (n, nivel) => {
            const li = PM.crear("li", "master-dibujo-capa" + (n.id === activa ? " es-activa" : "") + (n.tipo === "carpeta" ? " es-carpeta" : ""));
            li.style.setProperty("--nivel", nivel);
            const ojo = PM.botonDe("master-nombre-boton", n.visible ? "👁" : "—", () => {
                n.visible = !n.visible;
                pintarCapas();
                repintar();
                PM.guardar();
                PM.avisar((n.visible ? ocT("Se ve: ") : ocT("Escondida: ")) + n.nombre + ".");
            }, (n.visible ? ocT("Esconder ") : ocT("Enseñar ")) + n.nombre);
            ojo.setAttribute("aria-pressed", String(!!n.visible));
            ojo.title = n.visible ? "Esconder" : "Enseñar";
            li.appendChild(ojo);
            if (n.tipo === "carpeta") {
                const plegar = PM.botonDe("master-nombre-boton", n.abierta ? "▾" : "▸", () => {
                    n.abierta = !n.abierta;
                    pintarCapas();
                    PM.guardar();
                }, ocT("{n}la carpeta {nombre}", { n: n.abierta ? ocT("Cerrar ") : ocT("Abrir "), nombre: n.nombre }));
                plegar.setAttribute("aria-expanded", String(!!n.abierta));
                li.appendChild(plegar);
            }
            const nombre = PM.botonDe("master-dibujo-capa-nombre", (n.tipo === "carpeta" ? "📁 " : "") + n.nombre, () => {
                soltarFlotante();
                sel = null;
                activa = n.id;
                d.activa = activa;
                pintarCapas();
                repintar();
                PM.guardar();
            }, (n.tipo === "carpeta" ? ocT("Carpeta ") : ocT("Capa ")) + n.nombre + (n.visible ? "" : ocT(" (escondida)")));
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
        const mandos = PM.crear("div", "master-dibujo-mandos");
        const mando = (texto, nombre, f) => {
            const b = PM.botonDe("master-postit-boton", texto, f, nombre);
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
            PM.guardar();
            PM.avisar((paso < 0 ? ocT("Subida: ") : ocT("Bajada: ")) + b.n.nombre + ".");
        };
        const subir = mando("↑", ocT("Subir (que se vea más encima)"), () => mover(-1));
        const bajarCapa = mando("↓", ocT("Bajar (que se vea más debajo)"), () => mover(1));
        const aCarpeta = mando("⇥", ocT("Meterla en la carpeta de encima"), () => {
            const b = buscar(activa);
            if (!b) {
                return;
            }
            const i = b.lista.indexOf(b.n);
            const carpeta = b.lista.slice(0, i).reverse().find((x) => x.tipo === "carpeta" && x !== b.n);
            if (!carpeta) {
                PM.avisar(ocT("No hay ninguna carpeta encima de esta, al mismo nivel."));
                return;
            }
            b.lista.splice(i, 1);
            carpeta.hijos.push(b.n);
            carpeta.abierta = true;
            pintarCapas();
            repintar();
            PM.guardar();
            PM.avisar(ocT("{nombre} va ahora en la carpeta {nombre2}.", { nombre: b.n.nombre, nombre2: carpeta.nombre }));
        });
        const fuera = mando("⇤", ocT("Sacarla de su carpeta"), () => {
            const b = buscar(activa);
            if (!b || !b.padre) {
                return;
            }
            const arriba = buscar(b.padre.id);
            b.lista.splice(b.lista.indexOf(b.n), 1);
            arriba.lista.splice(arriba.lista.indexOf(b.padre), 0, b.n);
            pintarCapas();
            repintar();
            PM.guardar();
            PM.avisar(ocT("{nombre} ya no va en {nombre2}.", { nombre: b.n.nombre, nombre2: b.padre.nombre }));
        });
        const renombrar = mando("✎", ocT("Cambiarle el nombre"), () => {
            const b = buscar(activa);
            if (!b) {
                return;
            }
            const campo = PM.crear("input", "master-elegir master-dibujo-renombrar");
            campo.value = b.n.nombre;
            campo.setAttribute("aria-label", ocT("Nombre de {nombre}", { nombre: b.n.nombre }));
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
                    PM.guardar();
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
        const duplicar = mando("⧉", ocT("Duplicar la capa"), () => {
            const c = capaActiva();
            if (!c) {
                PM.avisar(ocT("Solo se pueden duplicar capas."));
                return;
            }
            soltarFlotante();
            const original = lienzos[c.id];
            const copia = nuevaCapa(ocT("{nombre} (copia)", { nombre: c.nombre }));
            lienzos[copia.id].getContext("2d").drawImage(original, 0, 0);
            copia.opacidad = c.opacidad;
            guardarDibujo(copia.id);
            pintarCapas();
            repintar();
        });
        let seguro = false;
        const borrarCapa = mando("🗑️", ocT("Borrar la capa o carpeta"), () => {
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
                PM.avisar(ocT("Tiene que quedar al menos una capa."));
                return;
            }
            if (!seguro) {
                seguro = true;
                borrarCapa.textContent = "⚠️";
                borrarCapa.setAttribute("aria-label", ocT("¿Seguro? Pulsa otra vez para borrar {nombre}", { nombre: b.n.nombre }));
                PM.avisar(ocT("Pulsa otra vez para borrar {nombre}{n}. No se puede deshacer.", { nombre: b.n.nombre, n: b.n.tipo === "carpeta" ? ocT(" y todo lo que tiene") : "" }));
                setTimeout(() => {
                    seguro = false;
                    borrarCapa.textContent = "🗑️";
                    borrarCapa.setAttribute("aria-label", ocT("Borrar la capa o carpeta"));
                }, 4000);
                return;
            }
            seguro = false;
            borrarCapa.textContent = "🗑️";
            borrarCapa.setAttribute("aria-label", ocT("Borrar la capa o carpeta"));
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
            PM.guardar();
            PM.avisar(ocT("Borrada: {nombre}.", { nombre: b.n.nombre }));
        });
        const etOpa = PM.crear("label", "oc-dados-etiqueta master-dibujo-opacidad");
        const opacidad = PM.crear("input");
        opacidad.type = "range";
        opacidad.min = 0;
        opacidad.max = 100;
        opacidad.step = 5;
        const valorOpa = PM.crear("span", "", "");
        etOpa.append(document.createTextNode(ocT("opacidad ")), valorOpa, opacidad);
        opacidad.addEventListener("input", () => {
            const b = buscar(activa);
            if (!b) {
                return;
            }
            b.n.opacidad = parseInt(opacidad.value, 10);
            valorOpa.textContent = b.n.opacidad + " %";
            repintar();
            PM.guardar();
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
                        const vacia = PM.crear("li", "master-dibujo-capa es-vacia", ocT("(vacía)"));
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
        const rejilla = PM.crear("div", "master-dibujo-rejilla");
        // Los ajustes, plegados; «#» en la barra la enseña o la esconde.
        const tituloR = PM.crear("h3", "master-dibujo-titulo");
        const plegarR = PM.botonDe("master-dibujo-plegar", ocT("{n} rejilla de rol", { n: d.rejilla.abierta ? "▾" : "▸" }), () => {
            d.rejilla.abierta = !d.rejilla.abierta;
            plegarR.textContent = ocT("{n} rejilla de rol", { n: d.rejilla.abierta ? "▾" : "▸" });
            plegarR.setAttribute("aria-expanded", String(!!d.rejilla.abierta));
            ajustesR.hidden = !d.rejilla.abierta;
            PM.guardar();
        });
        plegarR.setAttribute("aria-expanded", String(!!d.rejilla.abierta));
        tituloR.appendChild(plegarR);
        const ajustesR = PM.crear("div", "master-dibujo-ajustes");
        ajustesR.hidden = !d.rejilla.abierta;
        const caja = (texto, control) => {
            const et = PM.crear("label", "master-dibujo-campo");
            et.append(PM.crear("span", "oc-dados-etiqueta", texto), control);
            return et;
        };
        const ver = PM.crear("input");
        ver.type = "checkbox";
        ver.checked = !!d.rejilla.ver;
        const etVer = PM.crear("label", "master-nombres-apellido");
        etVer.append(ver, document.createTextNode(ocT(" enseñar la rejilla")));
        const tipo = PM.crear("select", "master-elegir");
        [["cuadrada", "cuadrada"], ["hex", "hexagonal"]].forEach(([v, n]) => {
            const o = PM.crear("option", "", n);
            o.value = v;
            tipo.appendChild(o);
        });
        tipo.value = d.rejilla.tipo;
        const tam = PM.crear("input", "master-elegir");
        tam.type = "number";
        tam.min = 10;
        tam.max = 250;
        tam.step = 5;
        tam.value = d.rejilla.tam;
        const colorR = PM.crear("input", "master-dibujo-selector");
        colorR.type = "color";
        colorR.value = d.rejilla.color;
        const opaR = PM.crear("input");
        opaR.type = "range";
        opaR.min = 10;
        opaR.max = 100;
        opaR.step = 5;
        opaR.value = d.rejilla.opacidad;
        const bajarR = PM.crear("input");
        bajarR.type = "checkbox";
        bajarR.checked = !!d.rejilla.bajar;
        const etBajar = PM.crear("label", "master-nombres-apellido");
        etBajar.append(bajarR, document.createTextNode(ocT(" en la imagen al descargar")));
        const cambiarRejilla = () => {
            Object.assign(d.rejilla, { ver: ver.checked, tipo: tipo.value, tam: Math.min(250, Math.max(10, parseInt(tam.value, 10) || 50)),
                color: colorR.value, opacidad: parseInt(opaR.value, 10), bajar: bajarR.checked });
            opaR.setAttribute("aria-valuetext", opaR.value + " %");
            botonRejilla.setAttribute("aria-pressed", String(ver.checked));
            repintar();
            PM.guardar();
        };
        [ver, tipo, tam, colorR, opaR, bajarR].forEach((x) => x.addEventListener(x.type === "range" || x.type === "color" ? "input" : "change",
            cambiarRejilla));
        ajustesR.append(etVer, caja(ocT("forma"), tipo), caja(ocT("casilla (de 1000 de ancho)"), tam), caja("color", colorR),
            caja(ocT("cuánto se ve"), opaR), etBajar);
        rejilla.append(tituloR, ajustesR);
        botonRejilla.addEventListener("click", () => {
            ver.checked = !ver.checked;
            cambiarRejilla();
            PM.avisar(ver.checked ? ocT("Rejilla a la vista.") : ocT("Rejilla escondida."));
        });
        botonRejilla.setAttribute("aria-pressed", String(!!d.rejilla.ver));
        // ---- EL TAMAÑO DEL LIENZO (plegado): unos cuantos ya hechos o el
        // que se quiera, y si lo dibujado se estira o se queda como está
        // (y se recorta o sobra sitio). ----
        const tamanoL = PM.crear("div", "master-dibujo-rejilla");
        const tituloT = PM.crear("h3", "master-dibujo-titulo");
        const ajustesT = PM.crear("div", "master-dibujo-ajustes");
        ajustesT.hidden = true;
        const plegarT = PM.botonDe("master-dibujo-plegar", ocT("▸ tamaño del lienzo"), () => {
            ajustesT.hidden = !ajustesT.hidden;
            plegarT.textContent = ocT("{n} tamaño del lienzo", { n: ajustesT.hidden ? "▸" : "▾" });
            plegarT.setAttribute("aria-expanded", String(!ajustesT.hidden));
        });
        plegarT.setAttribute("aria-expanded", "false");
        tituloT.appendChild(plegarT);
        const hechos = PM.crear("select", "master-elegir");
        [["", ocT("a medida")], ["1000x750", ocT("normal (1000 × 750)")], ["1200x1200", ocT("cuadrado (1200 × 1200)")],
            ["1600x900", ocT("panorámico (1600 × 900)")], ["750x1000", ocT("de pie (750 × 1000)")], ["2000x1500", ocT("grande (2000 × 1500)")]]
            .forEach(([v, n]) => {
                const o = PM.crear("option", "", n);
                o.value = v;
                hechos.appendChild(o);
            });
        const numero = (valor) => {
            const x = PM.crear("input", "master-elegir");
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
        const estirar = PM.crear("input");
        estirar.type = "checkbox";
        const etEstirar = PM.crear("label", "master-nombres-apellido");
        etEstirar.append(estirar, document.createTextNode(ocT(" estirar lo dibujado")));
        const cambiarT = PM.botonDe("oc-vida-accion", ocT("↔ cambiar el tamaño"), () => {
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
            PM.avisar(ocT("El lienzo mide ahora {w} × {h}. (Esto no se deshace.)", { w: w, h: h }));
        });
        ajustesT.append(caja(ocT("ya hecho"), hechos), caja(ocT("ancho"), anchoT), caja(ocT("alto"), altoT), etEstirar, cambiarT);
        tamanoL.append(tituloT, ajustesT);
        panel.append(tituloCapas, nuevas, listaCapas, mandos, etOpa, rejilla, tamanoL);

        // Lo que es el dibujo, para quien no lo ve.
        const etD = PM.crear("label", "oc-dados-etiqueta", ocT("de qué es (para el lector de pantalla)"));
        const desc = PM.crear("input", "master-elegir");
        desc.id = "master-dibujo-desc-" + m.id;
        desc.value = d.desc || "";
        etD.htmlFor = desc.id;
        desc.addEventListener("input", () => {
            d.desc = desc.value;
            etiqueta();
            PM.guardar();
        });

        // Como el Paint: herramientas a la izquierda, el lienzo en medio y
        // las capas a la derecha (debajo, si no cabe).
        const centro = PM.crear("div", "master-dibujo-centro");
        visor.appendChild(marco);
        centro.append(opciones, visor);
        const zona = PM.crear("div", "master-dibujo-zona");
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
        ponerZoomD(zoomD, false);
        vista.width = encima.width = ANCHO;
        vista.height = encima.height = ALTO;
        pintarCapas();
        repintar();
    }

    Object.assign(PM, { montarDibujo });
})();
