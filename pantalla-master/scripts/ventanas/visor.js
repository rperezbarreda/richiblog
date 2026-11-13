// =========================================
// LA VENTANA «visor» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // 🧝 EL VISOR DE LA PARTY: arriba, los personajes (uno se elige); abajo,
    // su ficha como el visor del blog (montarPj con «visor»).
    function montarVisor(dentro, m) {
        m.datos = m.datos || {};
        const elegir = PM.crear("div", "master-visor-elegir");
        elegir.setAttribute("role", "group");
        elegir.setAttribute("aria-label", ocT("Personajes de la party"));
        const ficha = PM.crear("div", "master-visor-ficha");
        let pintadoDe = null;
        function pintar() {
            const pjs = PM.todo.pjs || [];
            if (!pjs.length) {
                pintadoDe = null;
                const importar = PM.botonDe("oc-vida-accion", ocT("📥 importar"), () => PM.abrirImportarPj(importar),
                    ocT("Traer un personaje de D&D Beyond, Nivel20 o Foundry VTT"));
                importar.setAttribute("aria-haspopup", "dialog");
                const otras = PM.crear("div", "master-anadir-otras");
                otras.append(PM.botonDe("oc-vida-accion es-principal", ocT("＋ personaje"), () => {
                    const pj = PM.nuevoPj({ nombre: "" });
                    m.datos.pj = pj.id;
                    m.datos.editar = true;
                    PM.guardar();
                    pintar();
                }, ocT("Añadir un personaje a la party")), importar);
                dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("Todavía no hay personajes en la party.")), otras);
                return;
            }
            pjs.forEach(PM.normalizarPj);
            const pj = pjs.find((x) => x.id === m.datos.pj) || pjs[0];
            m.datos.pj = pj.id;
            const foco = elegir.contains(document.activeElement);
            // Cada personaje, su botón; al final, ＋ uno nuevo, ✎ (editar la
            // ficha del elegido), 🗑 (quitarlo, pulsando dos veces) y 📥
            // importar.
            const avisarCambio = () => document.dispatchEvent(new CustomEvent("master:pjs", { detail: {} }));
            const quienDe = (x) => x.nombre || ocT("jugador {n}", { n: pjs.indexOf(x) + 1 });
            const elegido = quienDe(pj);
            const nuevo = PM.botonDe("master-visor-mas", "＋", () => {
                const n = PM.nuevoPj({ nombre: "" });
                m.datos.pj = n.id;
                m.datos.editar = true;
                pintadoDe = null;
                PM.guardar();
                // (nuevoPj ya ha avisado: aquí, sólo pintar con su ficha
                // abierta para escribirla.)
                pintar();
            }, ocT("Añadir un personaje nuevo a la party"));
            nuevo.title = ocT("Personaje nuevo");
            const editar = PM.botonDe("master-visor-mas", "✎", () => {
                m.datos.editar = true;
                pintadoDe = null;
                PM.guardar();
                pintar();
            }, ocT("Editar la ficha de {quien}", { quien: elegido }));
            editar.title = ocT("Editar la ficha de {quien}", { quien: elegido });
            let seguro = false;
            const quitar = PM.botonDe("master-visor-mas", "🗑", () => {
                if (!seguro) {
                    seguro = true;
                    quitar.classList.add("es-seguro");
                    quitar.setAttribute("aria-label", ocT("¿Seguro? Pulsa otra vez para quitar a {quien}", { quien: elegido }));
                    PM.avisar(ocT("Pulsa otra vez para quitar a {quien}.", { quien: elegido }));
                    return;
                }
                PM.todo.pjs = (PM.todo.pjs || []).filter((y) => y.id !== pj.id);
                delete m.datos.pj;
                pintadoDe = null;
                PM.guardar();
                avisarCambio();
                PM.avisar(ocT("Quitado de la party: {quien}.", { quien: elegido }));
                const otro = elegir.querySelector(".master-visor-pj");
                (otro || dentro.querySelector("button")).focus();
            }, ocT("Quitar a {quien} de la party", { quien: elegido }));
            quitar.title = ocT("Quitar a {quien} de la party", { quien: elegido });
            const importar = PM.botonDe("master-visor-mas", "📥", () => PM.abrirImportarPj(importar),
                ocT("Importar un personaje de D&D Beyond, Nivel20 o Foundry VTT"));
            importar.title = ocT("Importar un personaje");
            importar.setAttribute("aria-haspopup", "dialog");
            elegir.replaceChildren(...pjs.map((x) => {
                const quien = quienDe(x);
                const b = PM.botonDe("master-visor-pj", "", () => {
                    if (m.datos.pj === x.id) {
                        return;
                    }
                    m.datos.pj = x.id;
                    PM.guardar();
                    pintar();
                    PM.avisar(ocT("Ficha de {quien}.", { quien: quien }));
                });
                const foto = PM.fotoPj(x, "master-visor-mini", "");
                const ini = PM.crear("span", "master-visor-mini", (quien.trim()[0] || "?").toUpperCase());
                ini.setAttribute("aria-hidden", "true");
                b.append(foto || ini, document.createTextNode(quien));
                b.setAttribute("aria-pressed", String(x === pj));
                return b;
            }), nuevo, editar, quitar, importar);
            if (foco) {
                elegir.querySelector("[aria-pressed=true]").focus();
            }
            if (!dentro.contains(elegir)) {
                dentro.replaceChildren(elegir, ficha);
            }
            if (pintadoDe !== pj.id) {
                pintadoDe = pj.id;
                ficha.replaceChildren();
                PM.montarPj(ficha, m, { visor: true });
            }
        }
        pintar();
        // Si cambia la party (uno nuevo, otro nombre, se va alguien), los
        // botones de arriba; la ficha se repinta sola.
        PM.mientrasEste(dentro, "master:pjs", () => {
            if (!(PM.todo.pjs || []).some((x) => x.id === m.datos.pj)) {
                pintadoDe = null;
            }
            pintar();
        });
    }

    Object.assign(PM, { montarVisor });
})();
