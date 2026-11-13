// =========================================
// LA VENTANA «inventario» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    const ORO_DE_MONEDA = { pc: 0.01, pp: 0.1, pe: 0.5, po: 1, pt: 10 };

    function montarInventario(dentro, m) {
        const uid = "master-inv-" + m.id;
        const pintar = () => {
            dentro.replaceChildren(PM.crear("p", "oc-hoja-nota", ocT("Cargando…")));
            PM.pedir(PM.TIENDA).catch(() => ({ objetos: [] })).then((tienda) => {
                const inv = PM.inventarioParty();
                const objetosSrd = {};
                (tienda.objetos || []).forEach((o) => {
                    objetosSrd[PM.llano(o.nombre)] = o;
                });
                // El dinero: cinco casillas y el total en oro.
                const din = PM.crear("fieldset", "master-creador-grupo");
                din.appendChild(PM.crear("legend", "", ocT("💰 Dinero de la party")));
                const fila = PM.crear("div", "master-inv-monedas");
                const total = PM.crear("p", "oc-hoja-nota");
                const pintarTotal = () => {
                    const po = PM.MONEDAS_PJ.reduce((s, [k]) => s + (PM.numPj(inv.dinero[k]) || 0) * ORO_DE_MONEDA[k], 0);
                    total.textContent = ocT("En total: {toLocaleString} po", { toLocaleString: (Math.round(po * 100) / 100).toLocaleString("es-ES") });
                };
                PM.MONEDAS_PJ.forEach(([k, abr, nom]) => {
                    const lab = PM.crear("label", "master-inv-moneda");
                    const x = PM.crear("input", "master-party-input");
                    x.type = "number";
                    x.min = 0;
                    x.inputMode = "numeric";
                    x.value = PM.numPj(inv.dinero[k]) || "";
                    x.setAttribute("aria-label", ocT("Monedas de {nom}", { nom: nom }));
                    x.addEventListener("change", () => {
                        inv.dinero[k] = PM.numPj(x.value) || 0;
                        PM.guardar();
                        pintarTotal();
                    });
                    lab.append(PM.crear("span", "master-party-et", abr), x);
                    fila.appendChild(lab);
                });
                pintarTotal();
                din.append(fila, total);
                // Añadir: nombre (con los del SRD sugeridos) y cuántos.
                const form = PM.crear("form", "master-pj-anadir");
                const nom = PM.crear("input", "oc-dados-texto");
                nom.id = uid + "-nombre";
                nom.autocomplete = "off";
                const dl = PM.crear("datalist");
                dl.id = uid + "-lista";
                (tienda.objetos || []).forEach((o) => {
                    const op = PM.crear("option");
                    op.value = o.nombre;
                    dl.appendChild(op);
                });
                nom.setAttribute("list", dl.id);
                const etN = PM.crear("label", "oc-dados-etiqueta", ocT("añadir un objeto"));
                etN.htmlFor = nom.id;
                const cant = PM.crear("input", "master-party-input");
                cant.type = "number";
                cant.min = 1;
                cant.value = 1;
                cant.id = uid + "-cant";
                const etC = PM.crear("label", "oc-dados-etiqueta", ocT("cuántos"));
                etC.htmlFor = cant.id;
                const ok = PM.crear("button", "oc-vida-accion", ocT("＋ añadir"));
                ok.type = "submit";
                form.append(etN, nom, dl, etC, cant, ok);
                form.addEventListener("submit", (e) => {
                    e.preventDefault();
                    const v = nom.value.trim();
                    if (!v) {
                        nom.focus();
                        return;
                    }
                    const s = objetosSrd[PM.llano(v)];
                    const n2 = PM.numPj(cant.value) || 1;
                    const ya = inv.objetos.find((x) => PM.llano(x.nombre) === PM.llano(s ? s.nombre : v));
                    if (ya) {
                        ya.cant = (PM.numPj(ya.cant) || 1) + n2;
                    } else {
                        inv.objetos.push({ id: PM.nuevoIdPj(), nombre: s ? s.nombre : v, cant: n2 });
                    }
                    PM.guardar();
                    PM.avisarPjs(m.id);
                    pintar();
                    PM.avisar(ocT("Añadido: {n} ×{n2}.", { n: s ? s.nombre : v, n2: n2 }));
                    const nuevoNom = document.getElementById(uid + "-nombre");
                    if (nuevoNom) {
                        nuevoNom.focus();
                    }
                });
                // La lista.
                const ul = PM.crear("ul", "master-inv-lista");
                ul.setAttribute("aria-label", ocT("Inventario común de la party"));
                inv.objetos.forEach((o) => {
                    const li = PM.crear("li", "master-inv-objeto");
                    const s = objetosSrd[PM.llano(o.nombre)];
                    const nombre = s ? PM.botonDe("master-conjuro-boton", o.nombre, () => PM.abrirObjeto(s, nombre, tienda.fuente))
                        : PM.crear("span", "master-inv-nombre", o.nombre);
                    const menos = PM.botonDe("master-docs-mando", "−", () => {
                        o.cant = Math.max(0, (PM.numPj(o.cant) || 1) - 1);
                        if (!o.cant) {
                            inv.objetos.splice(inv.objetos.indexOf(o), 1);
                            PM.avisar(ocT("Gastado: {nombre}.", { nombre: o.nombre }));
                        }
                        PM.guardar();
                        pintar();
                    }, ocT("Uno menos de {nombre}", { nombre: o.nombre }));
                    const cuantos = PM.crear("span", "master-inv-cant", ocT("×{n}", { n: PM.numPj(o.cant) || 1 }));
                    const mas = PM.botonDe("master-docs-mando", "＋", () => {
                        o.cant = (PM.numPj(o.cant) || 1) + 1;
                        PM.guardar();
                        cuantos.textContent = ocT("×{cant}", { cant: o.cant });
                    }, ocT("Uno más de {nombre}", { nombre: o.nombre }));
                    const dar = PM.crear("select", "master-elegir master-inv-dar");
                    dar.setAttribute("aria-label", ocT("Dar {nombre} a…", { nombre: o.nombre }));
                    [["", ocT("dar a…")]].concat((PM.todo.pjs || []).map((p) => [p.id, p.nombre || ocT("sin nombre")])).forEach(([v, tx]) => {
                        const op = PM.crear("option", "", tx);
                        op.value = v;
                        dar.appendChild(op);
                    });
                    dar.disabled = !(PM.todo.pjs || []).length;
                    dar.addEventListener("change", () => {
                        const p = (PM.todo.pjs || []).find((x) => x.id === dar.value);
                        if (!p) {
                            return;
                        }
                        PM.normalizarPj(p);
                        p.objetos.push({ nombre: o.nombre, cant: 1, equipado: false });
                        o.cant = (PM.numPj(o.cant) || 1) - 1;
                        if (o.cant <= 0) {
                            inv.objetos.splice(inv.objetos.indexOf(o), 1);
                        }
                        PM.guardar();
                        PM.avisarPjs(m.id);
                        PM.avisar(ocT("{nombre}: se lo queda {nombre2}.", { nombre: o.nombre, nombre2: p.nombre }));
                        pintar();
                    });
                    let seguro = false;
                    const quitar = PM.botonDe("master-docs-mando", "✕", () => {
                        if (!seguro) {
                            seguro = true;
                            quitar.classList.add("es-seguro");
                            PM.avisar(ocT("Pulsa otra vez para quitar {nombre}.", { nombre: o.nombre }));
                            return;
                        }
                        inv.objetos.splice(inv.objetos.indexOf(o), 1);
                        PM.guardar();
                        pintar();
                        PM.avisar(ocT("Quitado: {nombre}.", { nombre: o.nombre }));
                    }, ocT("Quitar {nombre}", { nombre: o.nombre }));
                    li.append(nombre, menos, cuantos, mas, dar, quitar);
                    ul.appendChild(li);
                });
                const vacio = PM.crear("p", "oc-vacio", ocT("La party no lleva nada en común todavía."));
                vacio.hidden = !!inv.objetos.length;
                const notas = PM.crear("textarea", "oc-notas-texto es-corta");
                notas.id = uid + "-notas";
                notas.rows = 3;
                notas.value = inv.notas || "";
                const etNotas = PM.crear("label", "oc-dados-etiqueta", ocT("notas (dónde lo guardan, quién lo carga…)"));
                etNotas.htmlFor = notas.id;
                let espera = 0;
                notas.addEventListener("input", () => {
                    inv.notas = notas.value;
                    clearTimeout(espera);
                    espera = setTimeout(PM.guardar, 400);
                });
                dentro.replaceChildren(din, form, vacio, ul, etNotas, notas);
            });
        };
        pintar();
        PM.mientrasEste(dentro, "master:pjs", (e) => {
            if (!(e.detail && e.detail.desde === m.id) && !dentro.contains(document.activeElement)) {
                pintar();
            }
        });
    }

    Object.assign(PM, { montarInventario });
})();
