// =========================================
// LA VENTANA «notas» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // ---- LAS NOTAS DEL MÁSTER: el editor con formato siempre abierto,
    // con «poner la fecha», «descargar» (un .html que abre Word o el
    // navegador) y «borrar». Lo de antes (texto suelto de ocPartida,
    // «notas») pasa solo la primera vez. ----
    function montarNotas(dentro, m) {
        m.datos = m.datos || {};
        if (m.datos.html === undefined) {
            const antes = window.ocPartida && window.ocPartida.leer ? window.ocPartida.leer("notas", "") : "";
            m.datos.html = antes ? PM.sanearHtml(PM.markdown(antes).innerHTML) : "";
        }
        let espera = 0;
        const { area, barra, leer } = PM.editorRico(ocT("Notas del máster (se guardan solas)"), () => {
            clearTimeout(espera);
            espera = setTimeout(() => {
                m.datos.html = leer();
                PM.guardar();
            }, 400);
        });
        area.classList.add("es-notas");
        area.innerHTML = PM.sanearHtml(m.datos.html) || "<p><br></p>";
        const fecha = PM.botonDe("oc-vida-accion", ocT("📅 poner la fecha"), () => {
            const hoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
            const h = PM.crear("h3", "", hoy);
            const p = PM.crear("p");
            p.appendChild(PM.crear("br"));
            area.append(h, p);
            m.datos.html = leer();
            PM.guardar();
            area.focus();
            const rango = document.createRange();
            rango.setStart(p, 0);
            rango.collapse(true);
            const sel = document.getSelection();
            sel.removeAllRanges();
            sel.addRange(rango);
            PM.avisar(ocT("Fecha puesta: {hoy}.", { hoy: hoy }));
        });
        const aDocs = PM.botonDe("oc-vida-accion", ocT("📁 guardar en documentos"), () => {
            m.datos.html = leer();
            PM.guardarEnDocumentos(aDocs, m.datos.doc, () => ({ tipo: "nota", titulo: ocT("notas de la sesión"), html: leer() }), (id) => {
                m.datos.doc = id;
            });
        });
        aDocs.setAttribute("aria-haspopup", "dialog");
        const bajar = PM.botonDe("oc-vida-accion", ocT("💾 descargar"), () => {
            const pagina = ocT("<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><title>Notas del máster</title></head><body>{leer}</body></html>", { leer: leer() });
            const a = PM.crear("a");
            // Una dirección blob: que hace el propio navegador con el archivo.
            const archivoBlob = URL.createObjectURL(new Blob([pagina], { type: "text/html;charset=utf-8" }));
            a.href = archivoBlob;
            a.download = "notas-del-master-" + new Date().toISOString().slice(0, 10) + ".html";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(archivoBlob), 1000);
            PM.avisar(ocT("Descargado: {download} (se abre con Word o el navegador).", { download: a.download }));
        }, ocT("Descargar las notas (.html, con su formato)"));
        let seguro = false;
        const borrar = PM.botonDe("oc-vida-accion", ocT("🗑️ borrar"), () => {
            if (!seguro) {
                seguro = true;
                borrar.textContent = ocT("🗑️ ¿seguro? pulsa otra vez");
                setTimeout(() => {
                    seguro = false;
                    borrar.textContent = ocT("🗑️ borrar");
                }, 4000);
                return;
            }
            seguro = false;
            borrar.textContent = ocT("🗑️ borrar");
            area.innerHTML = "<p><br></p>";
            m.datos.html = "";
            PM.guardar();
            PM.avisar(ocT("Notas borradas."));
        });
        const botones = PM.crear("div", "master-notas-botones");
        botones.append(fecha, aDocs, bajar, borrar);
        dentro.append(barra, area, botones);
    }

    Object.assign(PM, { montarNotas });
})();
