// =========================================
// LA VENTANA «botin» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    const FRANJAS = [["0", ocT("VD 0–4")], ["1", ocT("VD 5–10")], ["2", ocT("VD 11–16")], ["3", ocT("VD 17 o más")]];
    const VALOR_MONEDA = { pc: 1, pp: 10, pe: 50, po: 100, ppt: 1000 };

    function montarBotin(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Cargando…")));
        PM.pedir(PM.TIENDA).then((tienda) => {
            const d = m.datos;
            const porEn = {};
            tienda.objetos.forEach((o) => {
                porEn[o.en] = o;
            });
            const franja = PM.elegirDe("master-botin-franja-" + m.id, ocT("de quién (su valor de desafío)"), FRANJAS, d.franja || "0");
            const tipo = PM.botonesDe(ocT("qué"), [["uno", ocT("👤 lo que lleva encima uno")], ["tesoro", ocT("💎 un tesoro")]], d.tipo || "tesoro",
                (v) => {
                    d.tipo = v;
                    PM.guardar();
                });
            const sale = PM.crear("div", "master-botin");
            sale.setAttribute("aria-live", "polite");
            const texto = () => {
                const r = d.sale;
                const lineas = [];
                if (!r) {
                    return "";
                }
                lineas.push(ocT("Monedas: {join}", { join: r.monedas.filter((x) => x[1]).map((x) => x[1].toLocaleString("es-ES") + " " + x[0]).join(", ") }));
                r.cosas.forEach((c) => lineas.push(ocT("{n} ({toLocaleString} po{n2})", { n: (c.n > 1 ? ocT("{n} × ", { n: c.n }) : "") + c.texto, toLocaleString: c.valor.toLocaleString("es-ES"), n2: c.n > 1 ? ocT(" cada {n}", { n: c.que === "gema" ? "una" : "uno" }) : "" })));
                r.objetos.forEach((en) => lineas.push((porEn[en] || { nombre: en }).nombre));
                return lineas.join("\n");
            };
            const pintar = () => {
                const r = d.sale;
                sale.replaceChildren();
                if (!r) {
                    sale.appendChild(PM.crear("p", "oc-vacio", ocT("Elige y pulsa «generar».")));
                    return;
                }
                const lista = PM.crear("ul", "master-botin-lista");
                const monedas = r.monedas.filter((x) => x[1]);
                const li = PM.crear("li", "master-botin-cosa es-monedas");
                li.append(PM.crear("span", "master-botin-icono", "🪙"), PM.crear("span", "",
                    monedas.map((x) => x[1].toLocaleString("es-ES") + " " + x[0]).join(" · ")));
                li.querySelector("span:last-child").setAttribute("aria-label", ocT("Monedas: {join}", { join: monedas.map((x) =>
                    x[1].toLocaleString("es-ES") + " " + (PM.MONEDAS.find((y) => y[0] === x[0]) || [0, x[0]])[1]).join(", ") }));
                lista.appendChild(li);
                r.cosas.forEach((c) => {
                    const x = PM.crear("li", "master-botin-cosa");
                    x.append(PM.crear("span", "master-botin-icono", c.que === "gema" ? "💎" : "🏺"),
                        PM.crear("span", "", (c.n > 1 ? ocT("{n} × ", { n: c.n }) : "") + c.texto),
                        PM.crear("span", "master-botin-valor", ocT("{toLocaleString} po{n}", { toLocaleString: c.valor.toLocaleString("es-ES"), n: c.n > 1 ? ocT(" c/u") : "" })));
                    lista.appendChild(x);
                });
                r.objetos.forEach((en) => {
                    const o = porEn[en];
                    if (!o) {
                        return;
                    }
                    const x = PM.crear("li", "master-botin-cosa es-magico");
                    const b = PM.botonDe("master-botin-objeto", o.nombre, () => PM.abrirObjeto(o, b, tienda.fuente), ocT("Ver {nombre}", { nombre: o.nombre }));
                    x.append(PM.crear("span", "master-botin-icono", "✨"), b, PM.crear("span", "master-botin-valor", o.rareza));
                    lista.appendChild(x);
                });
                let total = monedas.reduce((t, x) => t + x[1] * VALOR_MONEDA[x[0]], 0) / 100;
                r.cosas.forEach((c) => {
                    total += c.n * c.valor;
                });
                sale.append(lista, PM.crear("p", "master-botin-total", ocT("Monedas, gemas y arte: unas {toLocaleString} po{n}", { toLocaleString: Math.round(total).toLocaleString("es-ES"), n: r.objetos.length ? ocT(", más {n}{n2}", { n: r.objetos.length, n2: r.objetos.length > 1 ? ocT(" objetos mágicos.") : ocT(" objeto mágico.") }) : "." })));
            };
            const generar = PM.botonDe("oc-vida-accion es-principal master-nombres-generar", ocT("🎲 generar botín"), () => {
                d.franja = franja.elegir.value;
                d.tipo = tipo.valor();
                d.sale = PM.hacerBotin(tienda.objetos, parseInt(d.franja, 10), d.tipo);
                PM.guardar();
                pintar();
                PM.avisar(ocT("Botín nuevo: {replace}.", { replace: texto().replace(/\n/g, ". ") }));
            });
            const copiar = PM.botonDe("oc-vida-accion", ocT("⧉ copiar"), () => PM.copiarTexto(texto(), ocT("Copiado el botín.")), ocT("Copiar el botín"));
            const arriba = PM.crear("div", "master-nombres-form");
            arriba.append(franja, tipo, generar);
            dentro.replaceChildren(arriba, sale, copiar,
                PM.crear("p", "oc-hoja-nota master-fuente", ocT("Monedas, gemas y arte: tablas propias. Objetos: SRD 5.2 (CC BY 4.0).")));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("No he podido cargar los objetos.")));
        });
    }

    Object.assign(PM, { montarBotin });
})();
