// =========================================
// LA VENTANA «tarjeta» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    function montarTarjeta(dentro, m) {
        m.datos = m.datos || {};
        if (m.datos.html === undefined && m.datos.texto) {
            m.datos.html = PM.sanearHtml(PM.markdown(m.datos.texto).innerHTML);
        }
        const ver = PM.crear("div", "oc-texto master-postit");
        let espera = 0;
        const { area, barra, leer } = PM.editorRico(ocT("Texto del post-it"), () => {
            clearTimeout(espera);
            espera = setTimeout(() => {
                m.datos.html = leer();
                delete m.datos.texto;
                PM.guardar();
            }, 400);
        });
        area.hidden = true;
        barra.hidden = true;
        const pintar = () => {
            ver.innerHTML = PM.sanearHtml(m.datos.html || "");
            if (!ver.textContent.trim()) {
                ver.replaceChildren(PM.crear("p", "oc-vacio", ocT("Vacío: pulsa «editar» y escribe lo que quieras tener a mano.")));
            } else if (window.ocDadosEnTexto) {
                window.ocDadosEnTexto(ver);
            }
        };
        const boton = PM.botonDe("oc-vida-accion", ocT("✏️ editar"), () => {
            const editando = area.hidden;
            if (editando) {
                area.innerHTML = PM.sanearHtml(m.datos.html || "") || "<p><br></p>";
                area.hidden = false;
                barra.hidden = false;
                ver.hidden = true;
                boton.textContent = ocT("✔ listo");
                area.focus();
            } else {
                clearTimeout(espera);
                m.datos.html = leer();
                delete m.datos.texto;
                PM.guardar();
                area.hidden = true;
                barra.hidden = true;
                ver.hidden = false;
                boton.textContent = ocT("✏️ editar");
                pintar();
                boton.focus();
            }
        });
        boton.classList.add("master-postit-editar");
        dentro.append(barra, ver, area, boton);
        pintar();
    }

    Object.assign(PM, { montarTarjeta });
})();
