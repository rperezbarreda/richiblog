// =========================================
// LA VENTANA «bestiario» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // ---- EL BESTIARIO: los monstruos del SRD 5.2 (D&D 2024), traducidos
    // (datos/personajes/compendio/bestiario.json). Se buscan por nombre
    // (en español o en inglés), VD y tipo; cada uno abre su perfil en una
    // ventana, con «＋ a la iniciativa» (tira su iniciativa y lo apunta con
    // su CA y sus PG en «richi-oc-iniciativa»). ----
    const VDS = ["0", "1/8", "1/4", "1/2"].concat(Array.from({ length: 30 }, (x, i) => String(i + 1)));

    function montarBestiario(dentro, m) {
        dentro.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Cargando el bestiario…")));
        PM.pedir("datos/personajes/compendio/bestiario.json").then((datos) => {
            const bichos = (datos.monstruos || []).map((b) => ({ b, buscar: PM.llano(b.nombre + " " + b.en + " " + b.tipo) }));
            const fila = PM.crear("div", "master-conjuros-buscar es-bestiario");
            const et = PM.crear("label", "oc-dados-etiqueta", ocT("buscar"));
            const input = PM.crear("input", "oc-dados-texto");
            input.type = "search";
            input.id = "master-bichos-" + m.id;
            input.placeholder = ocT("goblin, dragón, owlbear…");
            et.htmlFor = input.id;
            const etVd = PM.crear("label", "oc-dados-etiqueta", ocT("VD"));
            const vd = PM.crear("select", "oc-dados-elegir");
            vd.id = "master-bichos-vd-" + m.id;
            etVd.htmlFor = vd.id;
            [""].concat(VDS).forEach((v) => {
                const o = PM.crear("option", "", v || "todos");
                o.value = v;
                vd.appendChild(o);
            });
            const etTipo = PM.crear("label", "oc-dados-etiqueta", "tipo");
            const tipo = PM.crear("select", "oc-dados-elegir");
            tipo.id = "master-bichos-tipo-" + m.id;
            etTipo.htmlFor = tipo.id;
            const tipos = Array.from(new Set(bichos.map((x) => x.b.tipo.split(/[ (]/)[0]))).sort();
            [""].concat(tipos).forEach((v) => {
                const o = PM.crear("option", "", v || "todos");
                o.value = v;
                tipo.appendChild(o);
            });
            const cuantos = PM.crear("p", "oc-hoja-nota");
            cuantos.setAttribute("role", "status");
            const lista = PM.crear("ul", "master-conjuros");
            fila.append(et, input, etVd, vd, etTipo, tipo);
            const pintar = () => {
                const q = PM.llano(input.value.trim());
                const salen = bichos.filter((x) => (!q || x.buscar.includes(q)) && (!vd.value || x.b.cr === vd.value)
                    && (!tipo.value || x.b.tipo.indexOf(tipo.value) === 0));
                lista.replaceChildren(...salen.slice(0, 60).map((x) => {
                    const li = PM.crear("li");
                    const b = PM.botonDe("master-conjuro", "", () => PM.abrirBicho(x.b, b, datos.fuente));
                    b.setAttribute("aria-haspopup", "dialog");
                    b.classList.add("con-token");
                    b.append(PM.tokenDe(x.b), PM.crear("span", "master-conjuro-nombre", x.b.nombre),
                        PM.crear("span", "master-conjuro-datos", ocT("VD {cr} · {tipo} · CA {parseInt} · {pg} PG", { cr: x.b.cr, tipo: x.b.tipo, parseInt: parseInt(x.b.ca, 10), pg: x.b.pg })));
                    li.appendChild(b);
                    return li;
                }));
                cuantos.textContent = salen.length ? salen.length + (salen.length === 1 ? ocT(" monstruo") : ocT(" monstruos"))
                    + (salen.length > 60 ? ocT(" (salen los 60 primeros)") : "") : ocT("Ningún monstruo con eso.");
            };
            let espera = 0;
            input.addEventListener("input", () => {
                clearTimeout(espera);
                espera = setTimeout(pintar, 150);
            });
            vd.addEventListener("change", pintar);
            tipo.addEventListener("change", pintar);
            dentro.replaceChildren(fila, cuantos, lista, PM.crear("p", "oc-hoja-nota master-fuente", datos.fuente || ""));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("No he podido cargar el bestiario.")));
        });
    }

    Object.assign(PM, { montarBestiario });
})();
