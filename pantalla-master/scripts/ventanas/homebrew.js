// =========================================
// LA VENTANA «homebrew» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    function guardarHomebrew(lista) {
        try {
            localStorage.setItem(PM.CLAVE_HOMEBREW, JSON.stringify(lista));
        } catch (e) {
            // Sin almacenamiento: solo mientras esté abierta.
        }
        document.dispatchEvent(new CustomEvent("master:homebrew"));
    }

    function montarHomebrew(dentro) {
        const lista = PM.crear("ul", "master-homebrew");
        lista.setAttribute("aria-label", ocT("Reglas propias"));
        const vacio = PM.crear("p", "oc-vacio", ocT("Todavía no hay reglas propias."));
        // El formulario: para una nueva o para cambiar una.
        const form = PM.crear("form", "master-homebrew-form");
        form.hidden = true;
        const campo = (id, texto, etiqueta) => {
            const et = PM.crear("label", "oc-dados-etiqueta", texto);
            const x = PM.crear(etiqueta || "input", "oc-dados-texto" + (etiqueta === "textarea" ? " oc-notas-texto" : ""));
            x.id = "master-homebrew-" + id;
            et.htmlFor = x.id;
            if (etiqueta !== "textarea") {
                x.autocomplete = "off";
            }
            form.append(et, x);
            return x;
        };
        const nombre = campo("nombre", ocT("nombre"));
        nombre.maxLength = 60;
        nombre.required = true;
        const icono = campo("icono", ocT("dibujo (un emoji, si quieres)"));
        icono.maxLength = 4;
        icono.placeholder = "🍺";
        const texto = campo("texto", ocT("la regla (con **negrita**, *cursiva*, «- » para listas y «| a | b |» para tablas)"),
            "textarea");
        texto.rows = 8;
        const botones = PM.crear("div", "master-anadir-otras");
        const listo = PM.crear("button", "oc-vida-accion es-principal", ocT("guardar"));
        listo.type = "submit";
        let editando = null;
        const cancelar = PM.botonDe("oc-vida-accion", ocT("cancelar"), () => cerrarForm());
        botones.append(listo, cancelar);
        form.appendChild(botones);
        const nueva = PM.botonDe("oc-vida-accion es-principal", ocT("＋ regla propia"), () => abrirForm(null));
        function abrirForm(r) {
            editando = r;
            nombre.value = r ? r.nombre : "";
            icono.value = r ? r.icono || "" : "";
            texto.value = r ? r.texto : "";
            form.hidden = false;
            nueva.hidden = true;
            nombre.focus();
        }
        function cerrarForm() {
            form.hidden = true;
            nueva.hidden = false;
            nueva.focus();
        }
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const todas = PM.leerHomebrew();
            const datos = { nombre: nombre.value.trim(), icono: icono.value.trim(), texto: texto.value.trim() };
            if (!datos.nombre) {
                nombre.focus();
                return;
            }
            if (editando) {
                const i = todas.findIndex((x) => x.id === editando.id);
                if (i >= 0) {
                    todas[i] = Object.assign(todas[i], datos);
                }
            } else {
                todas.push(Object.assign({ id: "h" + Date.now().toString(36) }, datos));
            }
            guardarHomebrew(todas);
            PM.avisar(ocT("Guardada: {nombre}.", { nombre: datos.nombre }));
            cerrarForm();
        });
        const pintar = () => {
            const todas = PM.leerHomebrew();
            lista.replaceChildren(...todas.map((r) => {
                const li = PM.crear("li", "master-homebrew-regla");
                const ver = PM.botonDe("oc-regla-boton", "", () => PM.abrirRegla(Object.assign({ propia: true,
                    grupo: "🏠 Reglas propias" }, r), ver));
                ver.setAttribute("aria-haspopup", "dialog");
                const d = PM.crear("span", "oc-regla-dibujo", r.icono || "🏠");
                d.setAttribute("aria-hidden", "true");
                ver.append(d, PM.crear("span", "oc-regla-texto", r.nombre));
                const cambiar = PM.botonDe("master-party-quitar", "✎", () => abrirForm(r), ocT("Cambiar {nombre}", { nombre: r.nombre }));
                let seguro = false;
                const quitar = PM.botonDe("master-party-quitar", "✕", () => {
                    if (!seguro) {
                        seguro = true;
                        quitar.setAttribute("aria-label", ocT("¿Seguro? Pulsa otra vez para borrar {nombre}", { nombre: r.nombre }));
                        PM.avisar(ocT("Pulsa otra vez para borrar {nombre}.", { nombre: r.nombre }));
                        return;
                    }
                    guardarHomebrew(PM.leerHomebrew().filter((x) => x.id !== r.id));
                    PM.avisar(ocT("Borrada: {nombre}.", { nombre: r.nombre }));
                    nueva.focus();
                }, ocT("Borrar {nombre}", { nombre: r.nombre }));
                li.append(ver, cambiar, quitar);
                return li;
            }));
            vacio.hidden = !!todas.length;
        };
        PM.mientrasEste(dentro, "master:homebrew", pintar);
        dentro.append(lista, vacio, nueva, form);
        pintar();
    }

    Object.assign(PM, { montarHomebrew });
})();
