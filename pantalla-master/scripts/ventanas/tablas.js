// =========================================
// LA VENTANA «tablas» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    const leerTablas = () => {
        try {
            const x = JSON.parse(localStorage.getItem(PM.CLAVE_TABLAS) || "[]");
            return Array.isArray(x) ? x : [];
        } catch (e) {
            return [];
        }
    };
    const guardarTablas = (x) => {
        try {
            localStorage.setItem(PM.CLAVE_TABLAS, JSON.stringify(x));
        } catch (e) {
            PM.avisar(ocT("No se ha podido guardar la tabla."));
        }
        document.dispatchEvent(new CustomEvent("master:tablas"));
    };
    const entradasDe = (t) => String(t.texto || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const m = /^(\d+)\s*[×x]\s+(.*)$/i.exec(l);
        return m ? { peso: Math.max(1, Math.min(100, parseInt(m[1], 10))), t: m[2] } : { peso: 1, t: l };
    });
    function tirarTabla(t) {
        const es = entradasDe(t);
        const total = es.reduce((a, e) => a + e.peso, 0);
        if (!total) {
            return null;
        }
        const r = window.ocDados ? window.ocDados.tirar("1d" + total, t.nombre) : null;
        let n = r ? r.total : 1 + Math.floor(Math.random() * total);
        const e = es.find((x) => {
            n -= x.peso;
            return n <= 0;
        }) || es[es.length - 1];
        // Los dados de dentro: «{2d6}», «{1d4+1}».
        const texto = e.t.replace(/\{(\d*d\d+(?:[+-]\d+)?)\}/gi, (x, f) => String(PM.tiradaSuelta(f.toLowerCase().startsWith("d") ? "1" + f : f)));
        return { texto, n: r ? r.total : null, de: total };
    }
    function montarTablas(dentro, m) {
        const d = m.datos = m.datos || {};
        d.hist = Array.isArray(d.hist) ? d.hist : [];
        const sel = PM.crear("select", "oc-dados-elegir");
        sel.id = "master-tablas-" + m.id;
        const etSel = PM.crear("label", "oc-dados-etiqueta", ocT("tabla"));
        etSel.htmlFor = sel.id;
        const tirar = PM.crear("button", "oc-vida-accion es-principal", ocT("🎲 tirar"));
        tirar.type = "submit";
        const fila = PM.crear("form", "master-tablas-fila");
        fila.append(etSel, sel, tirar);
        const sale = PM.crear("p", "master-tablas-sale");
        sale.setAttribute("aria-live", "polite");
        const hist = PM.crear("ol", "master-tablas-hist");
        hist.setAttribute("aria-label", ocT("Lo que ha salido antes"));
        const nueva = PM.botonDe("oc-vida-accion", ocT("＋ tabla nueva"), () => editar(null), ocT("Crear una tabla nueva"));
        const editarB = PM.botonDe("oc-vida-accion", ocT("✎ editar"), () => editar(leerTablas().find((t) => t.id === sel.value)), ocT("Editar la tabla elegida"));
        const quitar = PM.botonDe("oc-vida-accion", ocT("🗑️ quitar"), () => {
            const t = leerTablas().find((x) => x.id === sel.value);
            if (!t) {
                return;
            }
            if (quitar.dataset.seguro !== "1") {
                quitar.dataset.seguro = "1";
                quitar.textContent = ocT("🗑️ ¿seguro? pulsa otra vez");
                return;
            }
            delete quitar.dataset.seguro;
            quitar.textContent = ocT("🗑️ quitar");
            guardarTablas(leerTablas().filter((x) => x.id !== t.id));
            PM.avisar(ocT("Quitada la tabla «{nombre}».", { nombre: t.nombre }));
        }, ocT("Quitar la tabla elegida"));
        const botones = PM.crear("div", "master-creador-barra");
        botones.append(nueva, editarB, quitar);
        const form = PM.crear("form", "master-tablas-editar");
        form.hidden = true;
        function editar(t) {
            const nombre = PM.crear("input", "oc-dados-texto");
            nombre.id = "master-tablas-nombre-" + m.id;
            nombre.maxLength = 80;
            nombre.value = t ? t.nombre : "";
            nombre.placeholder = ocT("Rumores de la taberna");
            const etN = PM.crear("label", "oc-dados-etiqueta", "nombre");
            etN.htmlFor = nombre.id;
            const texto = PM.crear("textarea", "oc-dados-texto");
            texto.id = "master-tablas-texto-" + m.id;
            texto.rows = 8;
            texto.value = t ? t.texto : "";
            texto.placeholder = ocT("El molinero esconde algo.\n2× Han visto lobos en el camino del norte.\nUn mercader paga {2d6} po por noticias.");
            const etT = PM.crear("label", "oc-dados-etiqueta", ocT("una entrada por línea («3× » delante: sale más; «{2d6}»: se tira)"));
            etT.htmlFor = texto.id;
            const ok = PM.crear("button", "oc-vida-accion es-principal", ocT("✓ guardar"));
            ok.type = "submit";
            const no = PM.botonDe("oc-vida-accion", ocT("cancelar"), () => {
                form.hidden = true;
                (t ? editarB : nueva).focus();
            });
            const barra = PM.crear("div", "master-creador-barra");
            barra.append(ok, no);
            form.replaceChildren(etN, nombre, etT, texto, barra);
            form.onsubmit = (e) => {
                e.preventDefault();
                const n = nombre.value.trim();
                if (!n || !entradasDe({ texto: texto.value }).length) {
                    PM.avisar(ocT("Ponle nombre y al menos una entrada."));
                    (n ? texto : nombre).focus();
                    return;
                }
                const todas = leerTablas();
                const id = t ? t.id : PM.idDoc("t");
                const x = { id, nombre: n, texto: texto.value };
                const i = todas.findIndex((y) => y.id === id);
                if (i >= 0) {
                    todas[i] = x;
                } else {
                    todas.push(x);
                }
                d.tabla = id;
                PM.guardar();
                form.hidden = true;
                guardarTablas(todas);
                PM.avisar(ocT("Tabla guardada: {n} ({n2} entradas).", { n: n, n2: entradasDe(x).length }));
                tirar.focus();
            };
            form.hidden = false;
            nombre.focus();
        }
        fila.addEventListener("submit", (e) => {
            e.preventDefault();
            const t = leerTablas().find((x) => x.id === sel.value);
            if (!t) {
                PM.avisar(ocT("Primero crea una tabla."));
                return;
            }
            const r = tirarTabla(t);
            if (!r) {
                return;
            }
            d.tabla = t.id;
            d.hist.unshift((r.n ? r.n + "/" + r.de + " · " : "") + t.nombre + ": " + r.texto);
            d.hist = d.hist.slice(0, 12);
            PM.guardar();
            pintarHist();
            sale.replaceChildren(PM.crear("span", "master-tablas-de", t.nombre + (r.n ? ocT(" ({n} de {de})", { n: r.n, de: r.de }) : "")),
                PM.crear("strong", "", r.texto));
        });
        const pintarHist = () => {
            hist.replaceChildren(...d.hist.slice(1).map((h) => PM.crear("li", "", h)));
            hist.hidden = d.hist.length < 2;
        };
        function pintar() {
            const ts = leerTablas();
            sel.replaceChildren(...ts.map((t) => {
                const o = PM.crear("option", "", t.nombre + " (" + entradasDe(t).length + ")");
                o.value = t.id;
                return o;
            }));
            if (ts.some((t) => t.id === d.tabla)) {
                sel.value = d.tabla;
            }
            fila.hidden = !ts.length;
            editarB.hidden = !ts.length;
            quitar.hidden = !ts.length;
            if (!ts.length) {
                sale.textContent = ocT("Todavía no tienes tablas: crea una (rumores, clima, encuentros de una zona…).");
            }
        }
        dentro.replaceChildren(fila, sale, hist, botones, form);
        pintar();
        pintarHist();
        PM.mientrasEste(dentro, "master:tablas", pintar);
    }

    Object.assign(PM, { montarTablas });
})();
