// =========================================
// LA VENTANA «pnj» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // «posadero|posadera»: la forma de su género (n, cualquiera de las dos).
    const segunGenero = (texto, genero) => {
        const [m, f] = String(texto).split("|");
        if (f === undefined) {
            return m;
        }
        return genero === "f" ? f : genero === "m" ? m : PM.alAzar([m, f]);
    };

    // ---- PNJ RÁPIDOS: nombre (del generador de nombres), especie,
    // oficio, aspecto, carácter, manía al hablar, qué quiere y un secreto.
    // Cada cosa se puede volver a tirar suelta (🎲); ☆ lo guarda. ----
    const PNJ_CAMPOS = [["oficio", ocT("Oficio"), "oficios"], ["aspecto", ocT("Aspecto"), "aspecto"], ["rasgo", ocT("Carácter"), "rasgos"],
        ["mania", ocT("Al hablar"), "manias"], ["quiere", ocT("Quiere"), "quiere"], ["secreto", ocT("Secreto"), "secretos"]];

    function montarPnj(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Cargando…")));
        Promise.all([PM.pedir(PM.TABLAS), PM.pedir(PM.NOMBRES)]).then(([tablas, nombres]) => {
            const d = m.datos;
            const t = tablas.pnj;
            const especie = PM.elegirDe("master-pnj-especie-" + m.id, ocT("especie"),
                [["", ocT("al azar")]].concat(Object.keys(nombres.especies).map((k) => [k, nombres.especies[k].nombre])), d.especie || "");
            const genero = PM.botonesDe(ocT("género"), [["cualquiera", ocT("cualquiera")], ["f", "♀"], ["m", "♂"], ["n", ocT("⚪ neutro")]],
                d.genero || "cualquiera", (v) => {
                    d.genero = v;
                    PM.guardar();
                });
            const etGen = PM.crear("p", "oc-dados-etiqueta", ocT("género"));
            etGen.setAttribute("aria-hidden", "true");
            const nuevo = () => {
                const esp = especie.elegir.value || PM.alAzar(Object.keys(nombres.especies));
                const g = genero.valor() === "cualquiera" ? PM.alAzar(["f", "m", "n"]) : genero.valor();
                const p = { nombre: PM.nombreDe(nombres, esp, g, true), especie: nombres.especies[esp].nombre, genero: g };
                PNJ_CAMPOS.forEach(([k, , lista]) => {
                    p[k] = segunGenero(PM.alAzar(t[lista]), g);
                });
                return p;
            };
            const ficha = PM.crear("div", "master-pnj");
            ficha.setAttribute("aria-live", "polite");
            const guardados = PM.crear("ul", "master-pnj-guardados");
            guardados.setAttribute("aria-label", ocT("PNJ guardados"));
            const tituloG = PM.crear("h3", "master-nombres-titulo", ocT("⭐ guardados"));
            const texto = (p) => p.nombre + " (" + p.especie + ")\n" + PNJ_CAMPOS.map(([k, n]) => n + ": " + p[k]).join("\n");
            const pintarFicha = () => {
                const p = d.pnj;
                ficha.replaceChildren();
                if (!p) {
                    ficha.appendChild(PM.crear("p", "oc-vacio", ocT("Pulsa «generar».")));
                    return;
                }
                const cab = PM.crear("div", "master-pnj-cabeza");
                const h = PM.crear("h3", "master-pnj-nombre", p.nombre);
                cab.append(h, PM.crear("span", "master-pnj-especie", p.especie + " · " + ({ f: "♀", m: "♂", n: "neutro" }[p.genero] || "")));
                const dl = PM.crear("dl", "master-pnj-datos");
                PNJ_CAMPOS.forEach(([k, nombre, lista]) => {
                    const dd = PM.crear("dd", "", p[k]);
                    const otra = PM.botonDe("master-nombre-boton", "🎲", () => {
                        p[k] = segunGenero(PM.alAzar(t[lista]), p.genero);
                        PM.guardar();
                        pintarFicha();
                        PM.avisar(nombre + ": " + p[k] + ".");
                    }, ocT("Otro valor para {toLowerCase}", { toLowerCase: nombre.toLowerCase() }));
                    otra.title = ocT("Otro");
                    dd.appendChild(otra);
                    dl.append(PM.crear("dt", "", nombre), dd);
                });
                const botones = PM.crear("div", "master-pnj-botones");
                botones.append(
                    PM.botonDe("oc-vida-accion", ocT("☆ guardar"), () => {
                        d.guardados = (d.guardados || []).concat([Object.assign({}, p)]);
                        PM.guardar();
                        pintarGuardados();
                        PM.avisar(ocT("Guardado: {nombre}.", { nombre: p.nombre }));
                    }, ocT("Guardar a {nombre}", { nombre: p.nombre })),
                    PM.botonDe("oc-vida-accion", ocT("⧉ copiar"), () => PM.copiarTexto(texto(p), ocT("Copiado: {nombre}.", { nombre: p.nombre })), ocT("Copiar a {nombre}", { nombre: p.nombre })));
                ficha.append(cab, dl, botones);
            };
            const pintarGuardados = () => {
                const lista = d.guardados || [];
                guardados.replaceChildren(...lista.map((p, i) => {
                    const li = PM.crear("li", "master-nombre");
                    const ver = PM.botonDe("master-botin-objeto", p.nombre + " · " + p.oficio, () => {
                        d.pnj = Object.assign({}, p);
                        PM.guardar();
                        pintarFicha();
                        PM.avisar(ocT("PNJ: {nombre}, {oficio}.", { nombre: p.nombre, oficio: p.oficio }));
                    }, ocT("Ver a {nombre}", { nombre: p.nombre }));
                    const quitar = PM.botonDe("master-nombre-boton", "✕", () => {
                        lista.splice(i, 1);
                        PM.guardar();
                        pintarGuardados();
                        PM.avisar(ocT("Quitado: {nombre}.", { nombre: p.nombre }));
                    }, ocT("Quitar a {nombre} de guardados", { nombre: p.nombre }));
                    li.append(ver, quitar);
                    return li;
                }));
                tituloG.hidden = guardados.hidden = !lista.length;
            };
            const generar = PM.botonDe("oc-vida-accion es-principal master-nombres-generar", ocT("🎲 generar PNJ"), () => {
                d.especie = especie.elegir.value;
                d.pnj = nuevo();
                PM.guardar();
                pintarFicha();
                PM.avisar(ocT("PNJ: {nombre}, {oficio}.", { nombre: d.pnj.nombre, oficio: d.pnj.oficio }));
            });
            const arriba = PM.crear("div", "master-nombres-form");
            arriba.append(especie, etGen, genero, generar);
            dentro.replaceChildren(arriba, ficha, tituloG, guardados);
            pintarFicha();
            pintarGuardados();
        }).catch(() => {
            dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("No he podido cargar las tablas.")));
        });
    }

    Object.assign(PM, { montarPnj });
})();
