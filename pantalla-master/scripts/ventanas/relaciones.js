// =========================================
// LA VENTANA «relaciones» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // ---- EL MAPA DE RELACIONES de la campaña: quién es quién (PNJ, PJ,
    // facciones, lugares) y cómo se llevan, con un dibujo que se ordena
    // arrastrando y la misma información en una lista. ----
    const TIPOS_NODO = [["pnj", "🧑", ocT("PNJ")], ["pj", "🛡️", ocT("PJ")], ["faccion", "🏰", ocT("facción")], ["lugar", "📍", ocT("lugar")],
        ["otro", "✳️", ocT("otro")]];
    const TIPOS_LAZO = [["aliado", ocT("es aliado de"), "#3fae5a"], ["enemigo", ocT("es enemigo de"), "#d23b3b"], ["familia", ocT("es familia de"), "#e6c229"],
        ["trabaja", ocT("trabaja para"), "#3b7ddd"], ["ama", ocT("está enamorado de"), "#e05aa8"], ["desconfia", ocT("desconfía de"), "#e88a2a"],
        ["otro", ocT("está relacionado con"), "#8a8a99"]];
    function montarRelaciones(dentro, m) {
        const r = PM.todo.relaciones = PM.todo.relaciones || {};
        r.nodos = Array.isArray(r.nodos) ? r.nodos : [];
        r.lazos = Array.isArray(r.lazos) ? r.lazos : [];
        const NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("class", "master-rel-mapa");
        svg.setAttribute("viewBox", "0 0 1000 640");
        svg.setAttribute("aria-hidden", "true");
        const tipoN = (k) => TIPOS_NODO.find((t) => t[0] === k) || TIPOS_NODO[4];
        const tipoL = (k) => TIPOS_LAZO.find((t) => t[0] === k) || TIPOS_LAZO[6];
        const nodo = (id) => r.nodos.find((n) => n.id === id);
        function colocar(n) {
            const i = r.nodos.indexOf(n);
            const a = i * 2.39996;
            n.x = Math.round(500 + Math.cos(a) * (120 + (i % 4) * 60));
            n.y = Math.round(320 + Math.sin(a) * (90 + (i % 4) * 45));
        }
        function dibujar() {
            const el = (tag, at) => {
                const x = document.createElementNS(NS, tag);
                Object.keys(at).forEach((k) => x.setAttribute(k, at[k]));
                return x;
            };
            const cosas = [];
            r.lazos.forEach((l) => {
                const a = nodo(l.de);
                const b = nodo(l.a);
                if (!a || !b) {
                    return;
                }
                const col = tipoL(l.tipo)[2];
                cosas.push(el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: col, "stroke-width": 4, "marker-end": "" }));
                const t = el("text", { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 6, "text-anchor": "middle", class: "master-rel-lazo-texto" });
                t.textContent = l.texto || tipoL(l.tipo)[1].replace(/^(es|está) /, "");
                cosas.push(t);
            });
            r.nodos.forEach((n) => {
                const g = el("g", { class: "master-rel-nodo", transform: "translate(" + n.x + " " + n.y + ")" });
                g.appendChild(el("circle", { r: 40, class: "master-rel-circulo es-" + n.tipo }));
                const e = el("text", { y: 12, "text-anchor": "middle", class: "master-rel-emoji" });
                e.textContent = tipoN(n.tipo)[1];
                const t = el("text", { y: 68, "text-anchor": "middle", class: "master-rel-nombre" });
                t.textContent = n.nombre;
                g.append(e, t);
                g.addEventListener("pointerdown", (ev) => arrastrar(ev, n, g));
                cosas.push(g);
            });
            svg.replaceChildren(...cosas);
        }
        function arrastrar(ev, n, g) {
            ev.preventDefault();
            const caja = svg.getBoundingClientRect();
            const escala = 1000 / caja.width;
            const mover = (e) => {
                n.x = Math.max(40, Math.min(960, Math.round((e.clientX - caja.left) * escala)));
                n.y = Math.max(40, Math.min(600, Math.round((e.clientY - caja.top) * escala)));
                dibujar();
            };
            const soltar = () => {
                document.removeEventListener("pointermove", mover);
                document.removeEventListener("pointerup", soltar);
                PM.guardar();
            };
            document.addEventListener("pointermove", mover);
            document.addEventListener("pointerup", soltar);
        }
        // Añadir: alguien o algo, y un lazo entre dos.
        const elegir = (opciones, id, texto) => {
            const sel = PM.crear("select", "oc-dados-elegir");
            sel.id = id + m.id;
            opciones.forEach(([v, t]) => {
                const o = PM.crear("option", "", t);
                o.value = v;
                sel.appendChild(o);
            });
            const caja = PM.crear("div", "master-campo");
            const et = PM.crear("label", "oc-dados-etiqueta", texto);
            et.htmlFor = sel.id;
            caja.append(et, sel);
            caja.sel = sel;
            return caja;
        };
        const formN = PM.crear("form", "master-rel-form");
        const nombreN = PM.crear("input", "oc-dados-texto");
        nombreN.id = "master-rel-nombre-" + m.id;
        nombreN.maxLength = 60;
        nombreN.placeholder = ocT("Sildar, los Capas Rojas, Phandalin…");
        const etN = PM.crear("label", "oc-dados-etiqueta", ocT("quién o qué"));
        etN.htmlFor = nombreN.id;
        const cajaN = PM.crear("div", "master-campo");
        cajaN.append(etN, nombreN);
        const tipoNsel = elegir(TIPOS_NODO.map(([k, e, t]) => [k, e + " " + t]), "master-rel-tipo-", "es");
        const okN = PM.crear("button", "oc-vida-accion es-principal", ocT("＋ añadir"));
        okN.type = "submit";
        const party = PM.botonDe("oc-vida-accion", ocT("🛡️ ＋ la party"), () => {
            let n = 0;
            (PM.todo.pjs || []).forEach((pj) => {
                if (pj.nombre && !r.nodos.some((x) => x.pjId === pj.id)) {
                    const x = { id: PM.idDoc("n"), nombre: pj.nombre, tipo: "pj", pjId: pj.id };
                    r.nodos.push(x);
                    colocar(x);
                    n++;
                }
            });
            PM.guardar();
            pintar();
            PM.avisar(n ? ocT("Añadidos {n} PJ.", { n: n }) : ocT("La party ya estaba."));
        }, ocT("Añadir a los PJ de la party"));
        formN.append(cajaN, tipoNsel, okN, party);
        formN.addEventListener("submit", (e) => {
            e.preventDefault();
            const nm = nombreN.value.trim();
            if (!nm) {
                nombreN.focus();
                return;
            }
            const x = { id: PM.idDoc("n"), nombre: nm, tipo: tipoNsel.sel.value };
            r.nodos.push(x);
            colocar(x);
            nombreN.value = "";
            PM.guardar();
            pintar();
            PM.avisar(ocT("Añadido: {nm}.", { nm: nm }));
            nombreN.focus();
        });
        const formL = PM.crear("form", "master-rel-form");
        const deSel = elegir([], "master-rel-de-", "de");
        const tipoLsel = elegir(TIPOS_LAZO.map(([k, t]) => [k, t]), "master-rel-lazo-", "es");
        const aSel = elegir([], "master-rel-a-", "a");
        const notaL = PM.crear("input", "oc-dados-texto");
        notaL.id = "master-rel-nota-" + m.id;
        notaL.maxLength = 60;
        notaL.placeholder = ocT("le debe dinero, su hermana…");
        const etL = PM.crear("label", "oc-dados-etiqueta", ocT("en corto (opcional)"));
        etL.htmlFor = notaL.id;
        const cajaL = PM.crear("div", "master-campo");
        cajaL.append(etL, notaL);
        const okL = PM.crear("button", "oc-vida-accion es-principal", ocT("＋ unir"));
        okL.type = "submit";
        formL.append(deSel, tipoLsel, aSel, cajaL, okL);
        formL.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!deSel.sel.value || !aSel.sel.value || deSel.sel.value === aSel.sel.value) {
                PM.avisar(ocT("Elige a dos distintos."));
                return;
            }
            r.lazos.push({ id: PM.idDoc("z"), de: deSel.sel.value, a: aSel.sel.value, tipo: tipoLsel.sel.value, texto: notaL.value.trim() });
            notaL.value = "";
            PM.guardar();
            pintar();
            PM.avisar(ocT("Unidos: {nombre} y {nombre2}.", { nombre: nodo(r.lazos[r.lazos.length - 1].de).nombre, nombre2: nodo(r.lazos[r.lazos.length - 1].a).nombre }));
        });
        // La lista (lo mismo que el dibujo, para leerlo y quitar).
        const lista = PM.crear("ul", "master-rel-lista");
        lista.setAttribute("aria-label", ocT("Relaciones"));
        function pintar() {
            const ops = r.nodos.map((n) => [n.id, tipoN(n.tipo)[1] + " " + n.nombre]);
            [deSel.sel, aSel.sel].forEach((sel, k) => {
                const antes = sel.value;
                sel.replaceChildren(...ops.map(([v, t]) => {
                    const o = PM.crear("option", "", t);
                    o.value = v;
                    return o;
                }));
                if (ops.some((o) => o[0] === antes)) {
                    sel.value = antes;
                } else if (ops[k]) {
                    sel.value = ops[k][0];
                }
            });
            formL.hidden = r.nodos.length < 2;
            lista.replaceChildren(...r.nodos.map((n) => {
                const li = PM.crear("li", "master-rel-quien");
                const cab = PM.crear("p", "master-rel-cab");
                cab.append(PM.crear("strong", "", tipoN(n.tipo)[1] + " " + n.nombre), PM.crear("span", "oc-hoja-nota", " (" + tipoN(n.tipo)[2] + ")"),
                    PM.botonDe("master-docs-mando", "✕", () => {
                        r.nodos = r.nodos.filter((x) => x !== n);
                        r.lazos = r.lazos.filter((l) => l.de !== n.id && l.a !== n.id);
                        PM.guardar();
                        pintar();
                        PM.avisar(ocT("Quitado: {nombre} (y sus lazos).", { nombre: n.nombre }));
                    }, ocT("Quitar a {nombre} y sus lazos", { nombre: n.nombre })));
                li.appendChild(cab);
                const suyos = r.lazos.filter((l) => l.de === n.id || l.a === n.id);
                if (suyos.length) {
                    const ul = PM.crear("ul", "master-rel-lazos");
                    suyos.forEach((l) => {
                        const otro = nodo(l.de === n.id ? l.a : l.de);
                        if (!otro) {
                            return;
                        }
                        const lli = PM.crear("li");
                        const marca = PM.crear("span", "master-rel-marca");
                        marca.style.backgroundColor = tipoL(l.tipo)[2];
                        marca.setAttribute("aria-hidden", "true");
                        const frase = l.de === n.id ? tipoL(l.tipo)[1] + " " + otro.nombre : otro.nombre + " " + tipoL(l.tipo)[1] + " " + n.nombre;
                        lli.append(marca, document.createTextNode(" " + frase + (l.texto ? " — " + l.texto : "") + " "),
                            PM.botonDe("master-docs-mando", "✕", () => {
                                r.lazos = r.lazos.filter((x) => x !== l);
                                PM.guardar();
                                pintar();
                                PM.avisar(ocT("Quitado el lazo."));
                            }, ocT("Quitar el lazo: {nombre} y {nombre2}", { nombre: n.nombre, nombre2: otro.nombre })));
                        ul.appendChild(lli);
                    });
                    li.appendChild(ul);
                }
                return li;
            }));
            if (!r.nodos.length) {
                lista.appendChild(PM.crear("li", "oc-vacio", ocT("Todavía no hay nadie: añade PNJ, facciones, lugares o la party.")));
            }
            dibujar();
        }
        r.nodos.forEach((n) => {
            if (typeof n.x !== "number") {
                colocar(n);
            }
        });
        dentro.replaceChildren(formN, formL, svg, PM.crear("p", "oc-hoja-nota", ocT("Arrastra los círculos para ordenarlos. Debajo, lo mismo en una lista.")), lista);
        pintar();
    }

    Object.assign(PM, { montarRelaciones });
})();
