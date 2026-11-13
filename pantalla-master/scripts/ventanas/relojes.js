// =========================================
// LA VENTANA «relojes» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    function dibujoReloj(partes, llenas, alPinchar) {
        const svg = document.createElementNS(PM.SVG, "svg");
        svg.setAttribute("viewBox", "-52 -52 104 104");
        svg.setAttribute("class", "master-reloj-dibujo");
        svg.setAttribute("aria-hidden", "true");
        for (let i = 0; i < partes; i++) {
            const a0 = (i / partes) * Math.PI * 2 - Math.PI / 2;
            const a1 = ((i + 1) / partes) * Math.PI * 2 - Math.PI / 2;
            const trozo = document.createElementNS(PM.SVG, "path");
            trozo.setAttribute("d", "M0 0 L" + (48 * Math.cos(a0)).toFixed(2) + " " + (48 * Math.sin(a0)).toFixed(2) + " A48 48 0 0 1 "
                + (48 * Math.cos(a1)).toFixed(2) + " " + (48 * Math.sin(a1)).toFixed(2) + " Z");
            trozo.setAttribute("class", "master-reloj-trozo" + (i < llenas ? " es-lleno" : ""));
            trozo.addEventListener("click", () => alPinchar(i));
            svg.appendChild(trozo);
        }
        return svg;
    }

    function montarRelojes(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        d.relojes = Array.isArray(d.relojes) ? d.relojes : [];
        const lista = PM.crear("ul", "master-relojes");
        lista.setAttribute("aria-label", ocT("Relojes"));
        const pintar = () => {
            lista.replaceChildren(...d.relojes.map((r, i) => {
                const li = PM.crear("li", "master-reloj" + (r.llenas >= r.partes ? " es-lleno" : ""));
                const nombre = PM.crear("input", "master-elegir master-reloj-nombre");
                nombre.value = r.nombre;
                nombre.setAttribute("aria-label", ocT("Nombre del reloj"));
                nombre.addEventListener("change", () => {
                    r.nombre = nombre.value.trim() || "reloj";
                    PM.guardar();
                });
                const poner = (n) => {
                    const antes = r.llenas;
                    r.llenas = Math.min(r.partes, Math.max(0, n));
                    PM.guardar();
                    pintar();
                    const foco = lista.children[i] && lista.children[i].querySelector(n > antes ? ".es-mas" : ".es-menos");
                    if (foco) {
                        foco.focus();
                    }
                    PM.avisar(ocT("{nombre}: {llenas} de {partes}{n}", { nombre: r.nombre, llenas: r.llenas, partes: r.partes, n: r.llenas >= r.partes ? ocT(". ¡Lleno!") : "." }));
                };
                const barra = PM.crear("div", "master-reloj-cuenta");
                barra.setAttribute("role", "meter");
                barra.setAttribute("aria-valuemin", "0");
                barra.setAttribute("aria-valuemax", String(r.partes));
                barra.setAttribute("aria-valuenow", String(r.llenas));
                barra.setAttribute("aria-label", r.nombre);
                barra.append(dibujoReloj(r.partes, r.llenas, (j) => poner(j + 1 === r.llenas ? j : j + 1)),
                    PM.crear("span", "master-reloj-numero", r.llenas + "/" + r.partes));
                const menos = PM.botonDe("master-pestana-mando es-menos", "−", () => poner(r.llenas - 1), ocT("Vaciar un trozo de {nombre}", { nombre: r.nombre }));
                const mas = PM.botonDe("master-pestana-mando es-mas", "+", () => poner(r.llenas + 1), ocT("Llenar un trozo de {nombre}", { nombre: r.nombre }));
                menos.disabled = r.llenas <= 0;
                mas.disabled = r.llenas >= r.partes;
                const partes = PM.crear("select", "master-postit-elegir");
                partes.setAttribute("aria-label", ocT("Trozos de {nombre}", { nombre: r.nombre }));
                [4, 6, 8, 10, 12].forEach((n) => {
                    const o = PM.crear("option", "", ocT("{n} trozos", { n: n }));
                    o.value = n;
                    partes.appendChild(o);
                });
                partes.value = r.partes;
                partes.addEventListener("change", () => {
                    r.partes = parseInt(partes.value, 10);
                    r.llenas = Math.min(r.llenas, r.partes);
                    PM.guardar();
                    pintar();
                });
                const quitar = PM.botonDe("master-nombre-boton", "✕", () => {
                    d.relojes.splice(i, 1);
                    PM.guardar();
                    pintar();
                    PM.avisar(ocT("Quitado: {nombre}.", { nombre: r.nombre }));
                    nuevoNombre.focus();
                }, ocT("Quitar el reloj {nombre}", { nombre: r.nombre }));
                const mandos = PM.crear("div", "master-reloj-mandos");
                mandos.append(menos, mas, partes, quitar);
                li.append(nombre, barra, mandos);
                return li;
            }));
            if (!d.relojes.length) {
                lista.appendChild(PM.crear("li", "oc-vacio", ocT("Sin relojes todavía.")));
            }
        };
        const form = PM.crear("form", "master-reloj-nuevo");
        const nuevoNombre = PM.crear("input", "master-elegir");
        nuevoNombre.placeholder = ocT("la guardia llega, el ritual se completa…");
        nuevoNombre.setAttribute("aria-label", ocT("Nombre del reloj nuevo"));
        const nuevoPartes = PM.crear("select", "master-postit-elegir");
        nuevoPartes.setAttribute("aria-label", ocT("Trozos del reloj nuevo"));
        [4, 6, 8, 10, 12].forEach((n) => {
            const o = PM.crear("option", "", ocT("{n} trozos", { n: n }));
            o.value = n;
            nuevoPartes.appendChild(o);
        });
        nuevoPartes.value = "6";
        const anadirReloj = PM.crear("button", "oc-vida-accion es-principal", ocT("＋ reloj"));
        anadirReloj.type = "submit";
        form.append(nuevoNombre, nuevoPartes, anadirReloj);
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const r = { nombre: nuevoNombre.value.trim() || ocT("reloj {n}", { n: d.relojes.length + 1 }), partes: parseInt(nuevoPartes.value, 10), llenas: 0 };
            d.relojes.push(r);
            nuevoNombre.value = "";
            PM.guardar();
            pintar();
            PM.avisar(ocT("Reloj nuevo: {nombre}, de {partes} trozos.", { nombre: r.nombre, partes: r.partes }));
        });
        dentro.append(form, lista);
        pintar();
    }

    Object.assign(PM, { montarRelojes });
})();
