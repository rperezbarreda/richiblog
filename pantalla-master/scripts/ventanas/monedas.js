// =========================================
// LA VENTANA «monedas» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    function enMonedas(cp, conPlatino) {
        const trozos = [];
        let resto = Math.floor(cp);
        PM.MONEDAS.filter((x) => x[0] !== "pe" && (conPlatino || x[0] !== "ppt")).forEach(([k, , v]) => {
            const n = Math.floor(resto / v);
            resto -= n * v;
            if (n) {
                trozos.push(n.toLocaleString(window.ocLocale) + " " + k);
            }
        });
        return trozos.join(" ") || ocT("0 pc");
    }

    function montarMonedas(dentro, m) {
        m.datos = m.datos || {};
        const form = PM.crear("form", "master-monedas");
        const campos = {};
        PM.MONEDAS.forEach(([k, nombre]) => {
            const caja = PM.crear("div", "master-tienda-campo");
            const et = PM.crear("label", "oc-dados-etiqueta", k + " (" + nombre + ")");
            const i = PM.crear("input", "oc-dados-texto");
            i.type = "number";
            i.min = "0";
            i.inputMode = "numeric";
            i.id = "master-monedas-" + k + "-" + m.id;
            i.value = m.datos[k] ? String(m.datos[k]) : "";
            et.htmlFor = i.id;
            caja.append(et, i);
            form.appendChild(caja);
            campos[k] = i;
        });
        const entreCaja = PM.crear("div", "master-tienda-campo");
        const etEntre = PM.crear("label", "oc-dados-etiqueta", ocT("repartir entre"));
        const entre = PM.crear("input", "oc-dados-texto");
        entre.type = "number";
        entre.min = "1";
        entre.inputMode = "numeric";
        entre.id = "master-monedas-entre-" + m.id;
        entre.value = String(m.datos.entre || 1);
        etEntre.htmlFor = entre.id;
        entreCaja.append(etEntre, entre);
        form.appendChild(entreCaja);
        const salida = PM.crear("dl", "master-bicho-datos master-monedas-salida");
        salida.setAttribute("aria-live", "polite");
        const vaciar = PM.botonDe("oc-vida-accion", ocT("🗑️ vaciar"), () => {
            PM.MONEDAS.forEach(([k]) => {
                campos[k].value = "";
            });
            calcular();
            campos.po.focus();
        });
        function calcular() {
            let cp = 0;
            PM.MONEDAS.forEach(([k, , v]) => {
                const n = Math.max(0, parseFloat(campos[k].value) || 0);
                m.datos[k] = n;
                cp += n * v;
            });
            const n = Math.max(1, parseInt(entre.value, 10) || 1);
            m.datos.entre = n;
            PM.guardar();
            const filas = [["Total", enMonedas(cp, true)], [ocT("En oro"), ocT("{toLocaleString} po", { toLocaleString: (cp / 100).toLocaleString(window.ocLocale, { maximumFractionDigits: 2 }) })],
                [ocT("En plata"), ocT("{toLocaleString} pp", { toLocaleString: (cp / 10).toLocaleString(window.ocLocale, { maximumFractionDigits: 1 }) })],
                [ocT("En cobre"), ocT("{toLocaleString} pc", { toLocaleString: cp.toLocaleString(window.ocLocale) })]];
            if (n > 1) {
                const cada = Math.floor(cp / n);
                filas.push([ocT("Para cada uno ({n})", { n: n }), enMonedas(cada, false)]);
                if (cp - cada * n) {
                    filas.push(["Sobra", enMonedas(cp - cada * n, false)]);
                }
            }
            salida.replaceChildren(...filas.flatMap(([a, b]) => [PM.crear("dt", "", a), PM.crear("dd", "", b)]));
        }
        form.addEventListener("input", calcular);
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            calcular();
        });
        dentro.append(form, salida, vaciar);
        calcular();
    }

    Object.assign(PM, { montarMonedas });
})();
