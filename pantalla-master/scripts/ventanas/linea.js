// =========================================
// LA VENTANA «linea» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // ---- LA LÍNEA TEMPORAL de la campaña: lo que pasa (sesiones y
    // sucesos) en orden, con cuándo (a mano o la fecha del calendario). ----
    function fechaDelCalendario() {
        for (const pf of PM.todo.perfiles) {
            const c = pf.modulos.find((x) => x.tipo === "calendario" && x.datos && x.datos.textoHoy);
            if (c) {
                return c.datos.textoHoy;
            }
        }
        return "";
    }
    function montarLinea(dentro, m) {
        PM.todo.linea = Array.isArray(PM.todo.linea) ? PM.todo.linea : [];
        const form = PM.crear("form", "master-linea-form");
        const campoDe = (texto, control, id) => {
            const caja = PM.crear("div", "master-campo");
            const et = PM.crear("label", "oc-dados-etiqueta", texto);
            control.id = id + m.id;
            et.htmlFor = control.id;
            caja.append(et, control);
            return caja;
        };
        const cuando = PM.crear("input", "oc-dados-texto");
        cuando.maxLength = 80;
        cuando.placeholder = ocT("Sesión 4 · 3 de Mirtul de 1492");
        const hoy = PM.botonDe("oc-vida-accion", ocT("📅 la del calendario"), () => {
            const f = fechaDelCalendario();
            if (f) {
                cuando.value = f;
            } else {
                PM.avisar(ocT("No hay ningún calendario con fecha en los tableros."));
            }
        }, ocT("Poner la fecha de la partida del calendario"));
        const titulo = PM.crear("input", "oc-dados-texto");
        titulo.maxLength = 120;
        titulo.placeholder = ocT("Llegan a Phandalin");
        const texto = PM.crear("textarea", "oc-dados-texto");
        texto.rows = 3;
        texto.placeholder = ocT("Qué pasó (opcional)");
        const sesion = PM.crear("label", "master-linea-sesion");
        const sesionC = PM.crear("input");
        sesionC.type = "checkbox";
        sesion.append(sesionC, document.createTextNode(ocT(" es una sesión (resumen de la partida)")));
        const ok = PM.crear("button", "oc-vida-accion es-principal", ocT("＋ apuntar"));
        ok.type = "submit";
        const filaC = PM.crear("div", "master-linea-cuando");
        filaC.append(campoDe(ocT("cuándo"), cuando, "master-linea-cuando-"), hoy);
        form.append(filaC, campoDe(ocT("qué"), titulo, "master-linea-titulo-"), campoDe(ocT("detalles"), texto, "master-linea-texto-"), sesion, ok);
        let editando = null;
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!titulo.value.trim()) {
                PM.avisar(ocT("Ponle qué pasó."));
                titulo.focus();
                return;
            }
            const x = { id: editando ? editando.id : PM.idDoc("l"), cuando: cuando.value.trim(), titulo: titulo.value.trim(),
                texto: texto.value.trim(), sesion: sesionC.checked };
            if (editando) {
                Object.assign(editando, x);
            } else {
                PM.todo.linea.push(x);
            }
            editando = null;
            ok.textContent = ocT("＋ apuntar");
            titulo.value = "";
            texto.value = "";
            sesionC.checked = false;
            PM.guardar();
            pintar();
            PM.avisar(ocT("Apuntado: {titulo}.", { titulo: x.titulo }));
            titulo.focus();
        });
        const buscar = PM.crear("input", "oc-dados-texto");
        buscar.type = "search";
        buscar.placeholder = ocT("buscar en la línea…");
        buscar.addEventListener("input", () => pintar());
        const copiar = PM.botonDe("oc-vida-accion", ocT("⧉ copiar como texto"), () => PM.copiarTexto(PM.todo.linea.map((x) => "- " + (x.cuando ? "**"
            + x.cuando + "** · " : "") + (x.sesion ? "🎲 " : "") + x.titulo + (x.texto ? ": " + x.texto.replace(/\n+/g, " ") : ""))
            .join("\n"), ocT("Copiada la línea temporal.")), ocT("Copiar la línea temporal como texto"));
        const ol = PM.crear("ol", "master-linea");
        ol.setAttribute("aria-label", ocT("Línea temporal"));
        function pintar() {
            const q = PM.llano(buscar.value.trim());
            const ver = PM.todo.linea.filter((x) => !q || PM.llano(x.cuando + " " + x.titulo + " " + x.texto).includes(q));
            ol.replaceChildren(...ver.map((x) => {
                const i = PM.todo.linea.indexOf(x);
                const li = PM.crear("li", "master-linea-paso" + (x.sesion ? " es-sesion" : ""));
                const cab = PM.crear("p", "master-linea-cab");
                if (x.cuando) {
                    cab.appendChild(PM.crear("span", "master-linea-cuandoes", x.cuando));
                }
                cab.appendChild(PM.crear("strong", "", (x.sesion ? "🎲 " : "") + x.titulo));
                li.appendChild(cab);
                if (x.texto) {
                    li.appendChild(PM.markdown(x.texto));
                }
                const mandos = PM.crear("div", "master-linea-mandos");
                mandos.append(PM.botonDe("master-docs-mando", "↑", () => mover(i, -1), ocT("Subir: {titulo}", { titulo: x.titulo })),
                    PM.botonDe("master-docs-mando", "↓", () => mover(i, 1), ocT("Bajar: {titulo}", { titulo: x.titulo })),
                    PM.botonDe("master-docs-mando", "✎", () => {
                        editando = x;
                        cuando.value = x.cuando;
                        titulo.value = x.titulo;
                        texto.value = x.texto;
                        sesionC.checked = !!x.sesion;
                        ok.textContent = ocT("✓ guardar el cambio");
                        titulo.focus();
                    }, ocT("Cambiar: {titulo}", { titulo: x.titulo })),
                    PM.botonDe("master-docs-mando", "✕", () => {
                        PM.todo.linea.splice(i, 1);
                        PM.guardar();
                        pintar();
                        PM.avisar(ocT("Quitado: {titulo}.", { titulo: x.titulo }));
                    }, ocT("Quitar: {titulo}", { titulo: x.titulo })));
                li.appendChild(mandos);
                return li;
            }));
            if (!ver.length) {
                ol.appendChild(PM.crear("li", "oc-vacio", PM.todo.linea.length ? ocT("Nada con eso.") : ocT("Todavía no hay nada: apunta la primera sesión.")));
            }
        }
        function mover(i, paso) {
            const j = i + paso;
            if (j < 0 || j >= PM.todo.linea.length) {
                return;
            }
            const [x] = PM.todo.linea.splice(i, 1);
            PM.todo.linea.splice(j, 0, x);
            PM.guardar();
            pintar();
            const b = ol.querySelectorAll(".master-linea-paso")[j];
            if (b) {
                b.querySelectorAll("button")[paso < 0 ? 0 : 1].focus();
            }
        }
        const etB = PM.crear("label", "visually-hidden", ocT("Buscar en la línea temporal"));
        buscar.id = "master-linea-buscar-" + m.id;
        etB.htmlFor = buscar.id;
        const barra = PM.crear("div", "master-creador-barra");
        barra.append(etB, buscar, copiar);
        dentro.replaceChildren(form, barra, ol);
        pintar();
    }

    Object.assign(PM, { montarLinea });
})();
