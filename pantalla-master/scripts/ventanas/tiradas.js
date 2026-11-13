// =========================================
// LA VENTANA «tiradas» de la pantalla de máster: el registro de las
// tiradas de los dados (las mismas que en su ventana), aparte, para
// tenerlo siempre a la vista. Lo da window.ocDados.registro (personajes.js),
// que avisa de cada cambio con «oc-dados:registro».
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    function montarTiradas(dentro) {
        const caja = PM.crear("div");
        const lista = PM.crear("ol", "oc-dados-historial");
        lista.setAttribute("aria-label", ocT("Registro de tiradas"));
        const mandos = PM.crear("div", "master-creador-barra");
        const borrar = PM.botonDe("oc-vida-accion", ocT("🗑️ borrar todas"), () => {
            window.ocDados.borrarRegistro();
        }, ocT("Borrar todas las tiradas del registro"));
        const dados = PM.botonDe("oc-vida-accion", ocT("🎲 abrir los dados"), () => {
            const b = document.querySelector(".oc-boton-dados");
            if (b) {
                b.click();
            }
        });
        mandos.append(dados, borrar);
        function pintar() {
            if (!window.ocDados || !window.ocDados.registro) {
                lista.replaceChildren(PM.crear("li", "oc-vacio", ocT("Los dados no están disponibles.")));
                return;
            }
            const filas = window.ocDados.registro((i) => {
                // Al borrar una, el foco a la que queda en su sitio.
                const quedan = lista.querySelectorAll(".oc-dados-quitar");
                (quedan[Math.min(i, quedan.length - 1)] || dados).focus();
            });
            lista.replaceChildren(...filas);
            if (!filas.length) {
                lista.appendChild(PM.crear("li", "oc-vacio", ocT("Aún no hay tiradas. Tira con 🎲 (o la tecla D) y salen aquí.")));
            }
            borrar.disabled = !filas.length;
        }
        caja.append(mandos, lista);
        dentro.appendChild(caja);
        pintar();
        PM.mientrasEste(dentro, "oc-dados:registro", pintar);
    }

    Object.assign(PM, { montarTiradas });
})();
