// =========================================
// LA VENTANA «conjuros» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    function montarConjuros(dentro, m) {
        dentro.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Cargando los conjuros…")));
        PM.pedir(PM.CONJUROS_SRD).then((datos) => {
            const conjuros = (datos.conjuros || []).map((c) => ({ c, buscar: PM.llano(c.nombre + " " + c.en + " " + c.escuela) }));
            const fila = PM.crear("div", "master-tienda-campos");
            const campo = (control, texto, id) => {
                const caja = PM.crear("div", "master-tienda-campo" + (control.tagName === "INPUT" ? " es-ancho" : ""));
                const et = PM.crear("label", "oc-dados-etiqueta", texto);
                control.id = id + m.id;
                et.htmlFor = control.id;
                caja.append(et, control);
                fila.appendChild(caja);
                return control;
            };
            const elegir = (opciones) => {
                const sel = PM.crear("select", "oc-dados-elegir");
                opciones.forEach(([v, t]) => {
                    const o = PM.crear("option", "", t);
                    o.value = v;
                    sel.appendChild(o);
                });
                return sel;
            };
            const input = PM.crear("input", "oc-dados-texto");
            input.type = "search";
            input.placeholder = ocT("bola de fuego, fireball…");
            const nivel = campo(elegir([["", ocT("todos")], ["0", ocT("trucos")]].concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [String(n), ocT("nivel {n}", { n: n })]))),
                ocT("nivel"), "master-conjuros-nivel-");
            const escuelas = Array.from(new Set(conjuros.map((x) => x.c.escuela))).sort();
            const escuela = campo(elegir([["", ocT("todas")]].concat(escuelas.map((e) => [e, e]))), ocT("escuela"), "master-conjuros-escuela-");
            const clases = Array.from(new Set(conjuros.flatMap((x) => x.c.clases || []))).sort();
            const clase = campo(elegir([["", ocT("todas")]].concat(clases.map((e) => [e, e]))), ocT("clase"), "master-conjuros-clase-");
            campo(input, ocT("buscar"), "master-conjuros-");
            const cuantos = PM.crear("p", "oc-hoja-nota");
            cuantos.setAttribute("role", "status");
            const lista = PM.crear("ul", "master-conjuros");
            const pintar = () => {
                const q = PM.llano(input.value.trim());
                const n = nivel.value === "" ? null : parseInt(nivel.value, 10);
                const salen = conjuros.filter((x) => (!q || x.buscar.includes(q)) && (n === null || x.c.nivel === n)
                    && (!escuela.value || x.c.escuela === escuela.value) && (!clase.value || (x.c.clases || []).indexOf(clase.value) >= 0));
                lista.replaceChildren(...salen.slice(0, 80).map((x) => {
                    const li = PM.crear("li");
                    const b = PM.botonDe("master-conjuro", "", () => PM.abrirConjuro(x.c, b, datos.fuente));
                    b.setAttribute("aria-haspopup", "dialog");
                    b.append(PM.crear("span", "master-conjuro-nombre", x.c.nombre),
                        PM.crear("span", "master-conjuro-datos", [PM.nivelDe(x.c), x.c.escuela, x.c.tiempo].join(" · ")
                            + (x.c.ingles ? ocT(" · (en inglés)") : "")));
                    li.appendChild(b);
                    return li;
                }));
                cuantos.textContent = salen.length ? salen.length + (salen.length === 1 ? ocT(" conjuro") : ocT(" conjuros"))
                    + (salen.length > 80 ? ocT(" (salen los 80 primeros)") : "") : ocT("Ningún conjuro con eso.");
            };
            let espera = 0;
            input.addEventListener("input", () => {
                clearTimeout(espera);
                espera = setTimeout(pintar, 150);
            });
            [nivel, escuela, clase].forEach((c) => c.addEventListener("change", pintar));
            dentro.replaceChildren(fila, cuantos, lista, PM.crear("p", "oc-hoja-nota master-fuente", datos.fuente || ""));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("No he podido cargar los conjuros.")));
        });
    }

    Object.assign(PM, { montarConjuros });
})();
