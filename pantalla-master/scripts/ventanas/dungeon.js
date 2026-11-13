// =========================================
// LA VENTANA «dungeon» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

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
    const DUNGEON_TAMANOS = [["5", ocT("pequeño (5 salas)")], ["8", ocT("mediano (8 salas)")], ["12", ocT("grande (12 salas)")]];
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
        const azar = (a, b) => a + PM.tiradaSuelta("1d" + (b - a + 1)) - 1;
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
                    const dentro = !cavernas || (i === s.cx && j === s.cy) || dx * dx + dy * dy <= 0.75 + PM.tiradaSuelta("1d40") / 100;
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
            if (PM.tiradaSuelta("1d2") === 1) {
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
                    if (cavernas && PM.tiradaSuelta("1d3") === 1) {
                        const [di, dj] = PM.alAzar([[1, 0], [0, 1], [-1, 0], [0, -1]]);
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
                const r = PM.tiradaSuelta("1d20");
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
                ctx.fillText({ secreta: ocT("S"), cerrada: ocT("C"), atrancada: ocT("A") }[p.tipo], x + c / 2, y + c / 2 + 1);
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
        dentro.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Cargando…")));
        Promise.all([PM.pedir(PM.TABLAS), PM.pedir(PM.BESTIARIO), PM.pedir(PM.TIENDA)]).then(([tablas, best, tienda]) => {
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
            const tema = PM.elegirDe("master-dungeon-tema-" + m.id, ocT("qué es"), Object.keys(t.temas).map((k) => [k, t.temas[k].emoji + " " +
                t.temas[k].nombre]), d.tema || "cripta");
            const tamano = PM.elegirDe("master-dungeon-tam-" + m.id, ocT("tamaño"), DUNGEON_TAMANOS, d.salas || "8");
            const enParty = PM.estado.modulos.filter((x) => x.tipo === "party").reduce((n, x) => n + ((x.datos && x.datos.pjs) || []).length, 0);
            const numero = (id, texto, valor, min, max) => {
                const caja = PM.crear("div", "master-campo");
                const et = PM.crear("label", "oc-dados-etiqueta", texto);
                const x = PM.crear("input", "master-elegir");
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
            const nivel = numero("master-dungeon-nivel-", ocT("nivel de la party"), d.nivel || 3, 1, 20);
            const pjs = numero("master-dungeon-pjs-", ocT("cuántos PJ"), d.pjs || enParty || 4, 1, 10);
            const estilo = PM.elegirDe("master-dungeon-estilo-" + m.id, ocT("estilo del mapa"), [["", ocT("según el sitio")], ["salas", ocT("salas y puertas")],
                ["cavernas", ocT("cavernas")]], d.estilo || "");
            const fila = PM.crear("div", "master-encuentro-fila");
            fila.append(tema, tamano, nivel, pjs, estilo);
            // El del máster (todo) o el de los jugadores (lo descubierto).
            const vista = PM.botonesDe(ocT("qué mapa se ve"), [["master", ocT("🧙 el del máster")], ["jugadores", ocT("👥 el de los jugadores")]],
                d.vista || "master", (v) => {
                    d.vista = v;
                    PM.guardar();
                    pintar();
                });
            const mapaLienzo = PM.crear("canvas", "master-dungeon-mapa");
            mapaLienzo.setAttribute("role", "img");
            const salasLista = PM.crear("ol", "master-dungeon-salas");
            salasLista.setAttribute("aria-label", ocT("Las salas"));
            const botones = PM.crear("div", "master-notas-botones");

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
                    const x = PM.alAzar(libres.length ? libres : lista);
                    usadas.add(x);
                    return x;
                };
                const salas = mapa.salas.map((s, i) => {
                    const ultima = i === mapa.salas.length - 1;
                    const sala = { que: unaDe(tm.salas), detalle: PM.alAzar(tm.detalles) };
                    const tirada = i === 0 ? 6 : PM.tiradaSuelta("1d6");
                    if (ultima || tirada <= 2 || tirada === 4) {
                        const enc = PM.hacerEncuentro(bichos, "", d.nivel, d.pjs, ultima ? 0.6 : 0.3);
                        sala.bichos = enc.grupos;
                        sala.hacen = enc.hacen;
                    }
                    if (tirada === 3 || (tirada === 5 && PM.tiradaSuelta("1d2") === 1)) {
                        const tr = PM.alAzar(t.trampas);
                        sala.trampa = { nombre: tr.nombre, texto: tr.texto.replace(/\{cd\}/g, cd).replace(/\{dano\}/g, dano) };
                    }
                    if (ultima || tirada === 4 || tirada === 5) {
                        sala.botin = PM.hacerBotin(tienda.objetos, franja, ultima || tirada === 5 ? "tesoro" : "uno");
                        sala.donde = PM.alAzar(t.tesoros_sala);
                    }
                    return sala;
                });
                d.mapa = mapa;
                d.contenido = salas;
                PM.guardar();
                pintar();
                PM.avisar(ocT("Dungeon nuevo: {nombre} de {n} salas.", { nombre: tm.nombre, n: salas.length }));
            };
            const botinTexto = (r) => {
                const partes = r.monedas.filter((x) => x[1]).map((x) => x[1].toLocaleString(window.ocLocale) + " " + x[0]);
                r.cosas.forEach((c) => partes.push(ocT("{n} ({valor} po)", { n: (c.n > 1 ? ocT("{n} × ", { n: c.n }) : "") + c.texto, valor: c.valor })));
                return partes.join(", ");
            };
            function pintar() {
                if (!d.mapa) {
                    mapaLienzo.hidden = true;
                    salasLista.replaceChildren(PM.crear("li", "oc-vacio", ocT("Elige y pulsa «generar».")));
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
                    const li = PM.crear("li", "master-dungeon-sala");
                    const h = PM.crear("h3", "master-dungeon-sala-titulo", ocT("Sala {n}{n2}{n3}", { n: i + 1, n2: i === 0 ? ocT(" (entrada)") : "", n3: i === d.contenido.length - 1 ? ocT(" (la última)") : "" }));
                    const desc = PM.crear("p", "", ocT("Es {que}; {detalle}.", { que: s.que, detalle: s.detalle }));
                    // ¿La han descubierto ya? (Sale en el mapa de los jugadores.)
                    const etVista = PM.crear("label", "master-nombres-apellido");
                    const caja = PM.crear("input");
                    caja.type = "checkbox";
                    caja.checked = d.vistas.indexOf(i) >= 0;
                    caja.addEventListener("change", () => {
                        d.vistas = d.vistas.filter((x) => x !== i).concat(caja.checked ? [i] : []);
                        PM.guardar();
                        pintarVista();
                        PM.avisar(ocT("Sala {n}{n2}", { n: i + 1, n2: caja.checked ? ocT(" descubierta.") : ocT(" tapada.") }));
                    });
                    etVista.append(caja, document.createTextNode(ocT(" descubierta (sale en el mapa de los jugadores)")));
                    li.append(h, desc, etVista);
                    if (s.bichos && s.bichos.length) {
                        const p = PM.crear("p", "master-dungeon-cosa");
                        p.append(PM.crear("strong", "", ocT("Monstruos: ")));
                        s.bichos.forEach((g, k) => {
                            const b = porEn[g.en];
                            if (!b) {
                                return;
                            }
                            if (k) {
                                p.appendChild(document.createTextNode(ocT(" y ")));
                            }
                            const ver = PM.botonDe("master-botin-objeto", (g.n > 1 ? ocT("{n} × ", { n: g.n }) : "") + b.nombre, () => PM.abrirBicho(b, ver, best.fuente),
                                ocT("Ver {nombre}", { nombre: b.nombre }));
                            p.appendChild(ver);
                        });
                        p.appendChild(document.createTextNode(ocT(" (están {hacen}).", { hacen: s.hacen })));
                        const ini = PM.botonDe("oc-vida-accion", ocT("⚔️ a la iniciativa"), () => {
                            const entran = [];
                            s.bichos.forEach((g) => {
                                const b = porEn[g.en];
                                for (let k = 0; k < g.n && b; k++) {
                                    entran.push(PM.meterEnIniciativa(PM.iniDeBicho(b),
                                        (nombres, renombrar) => PM.conNumero(b.nombre, nombres, renombrar), b.nombre));
                                }
                            });
                            PM.avisar(ocT("A la iniciativa: {join}.", { join: entran.filter(Boolean).join(", ") }));
                        }, ocT("Los monstruos de la sala {n} a la iniciativa", { n: i + 1 }));
                        li.append(p, ini);
                    }
                    if (s.trampa) {
                        const p = PM.crear("p", "master-dungeon-cosa");
                        p.append(PM.crear("strong", "", ocT("Trampa: {nombre}. ", { nombre: s.trampa.nombre })), document.createTextNode(s.trampa.texto));
                        if (window.ocDadosEnTexto) {
                            window.ocDadosEnTexto(p);
                        }
                        li.appendChild(p);
                    }
                    if (s.botin) {
                        const p = PM.crear("p", "master-dungeon-cosa");
                        p.append(PM.crear("strong", "", ocT("Botín ({donde}): ", { donde: s.donde })), document.createTextNode(botinTexto(s.botin)));
                        s.botin.objetos.forEach((en) => {
                            const o = objetos[en];
                            if (!o) {
                                return;
                            }
                            p.appendChild(document.createTextNode(", "));
                            const ver = PM.botonDe("master-botin-objeto", "✨ " + o.nombre, () => PM.abrirObjeto(o, ver, tienda.fuente), ocT("Ver {nombre}", { nombre: o.nombre }));
                            p.appendChild(ver);
                        });
                        p.appendChild(document.createTextNode("."));
                        li.appendChild(p);
                    }
                    if (!s.bichos && !s.trampa && !s.botin) {
                        li.appendChild(PM.crear("p", "master-dungeon-cosa", ocT("No hay nada más (o eso parece).")));
                    }
                    // Sus puertas especiales (cerradas, atrancadas, secretas).
                    (d.mapa.puertas || []).filter((pu) => pu.sala === i && pu.tipo !== "normal").forEach((pu) => {
                        const pas = d.mapa.pasillos[pu.pasillo] || {};
                        const otra = pas.a === i ? pas.b : pas.a;
                        const p = PM.crear("p", "master-dungeon-cosa");
                        const que = {
                            cerrada: ocT("Puerta cerrada con llave hacia la sala {n}: se abre con herramientas de ladrón (Destreza CD {cd}) o se echa abajo (Fuerza (Atletismo) CD {n2}).", { n: otra + 1, cd: pu.cd, n2: pu.cd + 2 }),
                            atrancada: ocT("Puerta atrancada por el otro lado (hacia la sala {n}): Fuerza (Atletismo) CD {cd} para forzarla; hace ruido.", { n: otra + 1, cd: pu.cd }),
                            secreta: ocT("Puerta secreta a un pasillo oculto que lleva a la sala {n}: Sabiduría (Percepción) CD {cd} para verla.", { n: otra + 1, cd: pu.cd }),
                        }[pu.tipo];
                        p.append(PM.crear("strong", "", "🚪 "), document.createTextNode(que));
                        li.appendChild(p);
                        if (pu.tipo === "secreta") {
                            const etE = PM.crear("label", "master-nombres-apellido");
                            const enc = PM.crear("input");
                            enc.type = "checkbox";
                            enc.checked = d.encontrados.indexOf(pu.pasillo) >= 0;
                            enc.addEventListener("change", () => {
                                d.encontrados = d.encontrados.filter((x) => x !== pu.pasillo).concat(enc.checked ? [pu.pasillo] : []);
                                PM.guardar();
                                pintarVista();
                                PM.avisar(enc.checked ? ocT("Pasillo secreto encontrado.") : ocT("Pasillo secreto escondido otra vez."));
                            });
                            etE.append(enc, document.createTextNode(ocT(" la han encontrado")));
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
                const tm = t.temas[d.tema] || { nombre: ocT("dungeon") };
                mapaLienzo.setAttribute("aria-label", deJugadores ? ocT("Mapa de los jugadores: se ven {n} de {n2} salas, sin números ni secretos.", { n: d.vistas.length, n2: d.mapa.salas.length }) : ocT("Mapa de {nombre}: {length} salas numeradas unidas por pasillos; la 1 es la entrada. Lo que hay en cada una, en la lista de debajo.", { nombre: tm.nombre, length: d.mapa.salas.length }));
            }
            const boton = PM.botonDe("oc-vida-accion es-principal master-nombres-generar", ocT("🎲 generar dungeon"), generar);
            const alDibujo = PM.botonDe("oc-vida-accion", ocT("🎨 al dibujo"), () => {
                const l = PM.crear("canvas");
                pintarMapa(l, d.mapa);
                PM.anadir("dibujo", { titulo: "mapa: " + ((t.temas[d.tema] || {}).nombre || "dungeon"), w: 900, h: 700,
                    datos: { ancho: l.width, alto: l.height, capas: [{ id: "c1", tipo: "capa", nombre: ocT("mapa"), visible: true, opacidad: 100,
                        imagen: l.toDataURL("image/png") }, { id: "c2", tipo: "capa", nombre: ocT("notas"), visible: true, opacidad: 100, imagen: "" }],
                    activa: "c2", rejilla: { ver: false, tipo: "cuadrada", tam: DUNGEON_CELDA, color: "#000000", opacidad: 40 } } });
            }, ocT("Pasar el mapa a una ventana de dibujo, para pintar encima"));
            const copiar = PM.botonDe("oc-vida-accion", ocT("⧉ copiar las salas"), () => PM.copiarTexto(Array.from(salasLista.children).map((li) => li.innerText)
                .join("\n\n"), ocT("Copiado el dungeon.")), ocT("Copiar las salas (texto)"));
            // La imagen del mapa: copiarla (para pegarla en otro sitio) o
            // descargarla en PNG.
            const copiarImagen = PM.botonDe("oc-vida-accion", ocT("🖼️ copiar la imagen"), () => {
                if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) {
                    PM.avisar(ocT("Este navegador no deja copiar imágenes: descárgala."));
                    return;
                }
                mapaLienzo.toBlob((blob) => {
                    navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
                        .then(() => PM.avisar(ocT("Copiada la imagen del mapa.")))
                        .catch(() => PM.avisar(ocT("No se ha podido copiar la imagen: descárgala.")));
                }, "image/png");
            }, ocT("Copiar la imagen del mapa"));
            const bajarImagen = PM.botonDe("oc-vida-accion", ocT("⬇ descargar la imagen"), () => {
                const a = PM.crear("a");
                a.href = mapaLienzo.toDataURL("image/png");
                a.download = "dungeon-" + (d.tema || "mapa") + ".png";
                document.body.appendChild(a);
                a.click();
                a.remove();
                PM.avisar(ocT("Descargado: {download}.", { download: a.download }));
            }, ocT("Descargar la imagen del mapa (PNG)"));
            const ensenar = PM.botonDe("oc-vida-accion es-principal", ocT("👁️ enseñar a la mesa"), () => {
                const l = PM.crear("canvas", "master-dungeon-mapa es-grande");
                pintarMapa(l, d.mapa, { jugadores: true, vistas: d.vistas, encontrados: d.encontrados });
                l.setAttribute("role", "img");
                l.setAttribute("aria-label", ocT("Mapa de los jugadores: lo descubierto."));
                window.ocVentana.abrir({ titulo: ocT("el mapa"), cuerpo: l, vuelta: ensenar, clase: "es-ancha" });
            }, ocT("Enseñar en grande el mapa de los jugadores (solo lo descubierto)"));
            const descubrir = PM.botonDe("oc-vida-accion", ocT("☀️ descubrir todas"), () => {
                d.vistas = d.mapa.salas.map((x, i) => i);
                PM.guardar();
                pintar();
                PM.avisar(ocT("Todas las salas descubiertas."));
            });
            const tapar = PM.botonDe("oc-vida-accion", ocT("🌑 tapar todas"), () => {
                d.vistas = [0];
                PM.guardar();
                pintar();
                PM.avisar(ocT("Tapadas todas menos la entrada."));
            });
            botones.append(ensenar, copiarImagen, bajarImagen, alDibujo, copiar, descubrir, tapar);
            const leyenda = PM.crear("p", "oc-hoja-nota master-dungeon-leyenda",
                ocT("Puertas: C cerrada con llave, A atrancada, S secreta; a rayas rojas, el pasillo secreto. Copiar y descargar, el mapa que se ve."));
            const arriba = PM.crear("div", "master-nombres-form");
            arriba.append(fila, boton, vista);
            dentro.replaceChildren(arriba, mapaLienzo, leyenda, botones, salasLista,
                PM.crear("p", "oc-hoja-nota master-fuente", ocT("Salas, trampas, gemas y arte: tablas propias. Monstruos y objetos: SRD 5.2 (CC BY 4.0).")));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("No he podido cargar las tablas.")));
        });
    }

    Object.assign(PM, { montarDungeon });
})();
