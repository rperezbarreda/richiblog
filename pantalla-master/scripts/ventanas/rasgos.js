// =========================================
// LA VENTANA «rasgos» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // El buscador de rasgos y dotes (un widget, como el de conjuros).
    function montarRasgos(dentro, m) {
        dentro.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Cargando los rasgos…")));
        const pintarTodo = () => PM.pedir(PM.RASGOS_SRD).then((datos) => {
            const todos = (datos.rasgos || []).map((r) => ({ r, buscar: PM.llano(r.nombre + " " + r.en + " " + (r.de || "") + " " + r.tipo) }));
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
            const tipos = Array.from(new Set(todos.map((x) => x.r.tipo))).sort();
            const tipo = campo(elegir([["", ocT("todos")]].concat(tipos.map((t) => [t, t]))), ocT("qué"), "master-rasgos-tipo-");
            const des = Array.from(new Set(todos.filter((x) => x.r.tipo !== "rasgo de clase" || !/\(/.test(x.r.de))
                .flatMap((x) => String(x.r.de || "").replace(/ \(.*$/, "").split(/,\s*/)).filter((d) => d && d !== "dote"))).sort((a, b) =>
                a.localeCompare(b, "es"));
            const de = campo(elegir([["", ocT("todas")]].concat(des.map((t) => [t, t]))), ocT("clase o especie"), "master-rasgos-de-");
            const input = campo(Object.assign(PM.crear("input", "oc-dados-texto"), { type: "search", placeholder: ocT("furia, alerta, sneak attack…") }),
                ocT("buscar"), "master-rasgos-");
            const cuantos = PM.crear("p", "oc-hoja-nota");
            cuantos.setAttribute("role", "status");
            const lista = PM.crear("ul", "master-conjuros");
            lista.setAttribute("aria-label", ocT("Rasgos y dotes"));
            const pintar = () => {
                const q = PM.llano(input.value.trim());
                const d = PM.llano(de.value);
                const salen = todos.filter((x) => (!q || x.buscar.includes(q)) && (!tipo.value || x.r.tipo === tipo.value)
                    && (!d || PM.llano(x.r.de || "").includes(d)));
                lista.replaceChildren(...salen.slice(0, 80).map((x) => {
                    const li = PM.crear("li");
                    const b = PM.botonDe("master-conjuro", "", () => PM.abrirRasgo(x.r, b, datos.fuente));
                    b.setAttribute("aria-haspopup", "dialog");
                    b.append(PM.crear("span", "master-conjuro-nombre", x.r.nombre), PM.crear("span", "master-conjuro-datos",
                        PM.datosRasgo(x.r).join(" · ") + (x.r.propio ? ocT(" · 🛠️ tuyo") : "")));
                    li.appendChild(b);
                    return li;
                }));
                cuantos.textContent = salen.length ? salen.length + (salen.length === 1 ? ocT(" resultado") : ocT(" resultados"))
                    + (salen.length > 80 ? ocT(" (salen los 80 primeros)") : "") : ocT("Nada con eso.");
            };
            let espera = 0;
            input.addEventListener("input", () => {
                clearTimeout(espera);
                espera = setTimeout(pintar, 150);
            });
            [tipo, de].forEach((c) => c.addEventListener("change", pintar));
            dentro.replaceChildren(fila, cuantos, lista, PM.crear("p", "oc-hoja-nota master-fuente", datos.fuente || ""));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("No he podido cargar los rasgos.")));
        });
        pintarTodo();
        PM.mientrasEste(dentro, "master:propios", () => {
            if (!dentro.contains(document.activeElement)) {
                pintarTodo();
            }
        });
    }

    Object.assign(PM, { montarRasgos });
})();
