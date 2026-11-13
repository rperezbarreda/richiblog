// =========================================
// LA VENTANA «tabla» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // ---- UNA TABLA PARA TIRAR: una cosa por línea; «tirar» saca una al
    // azar (encuentros, nombres, el tiempo que hace…) ----
    function montarTabla(dentro, m) {
        m.datos = m.datos || {};
        const etX = PM.crear("label", "oc-dados-etiqueta", ocT("lo que puede salir (una cosa por línea)"));
        const texto = PM.crear("textarea", "oc-notas-texto es-corta");
        texto.id = "master-tabla-texto-" + m.id;
        texto.rows = 6;
        texto.value = m.datos.texto || "";
        etX.htmlFor = texto.id;
        const sale = PM.crear("p", "master-tabla-sale");
        sale.setAttribute("role", "status");
        let espera = 0;
        const alEscribir = () => {
            clearTimeout(espera);
            espera = setTimeout(() => {
                m.datos.texto = texto.value;
                PM.guardar();
            }, 400);
        };
        texto.addEventListener("input", alEscribir);
        const tirar = PM.botonDe("oc-vida-accion es-principal", ocT("🎲 tirar en la tabla"), () => {
            const cosas = texto.value.split("\n").map((x) => x.trim()).filter(Boolean);
            if (!cosas.length) {
                sale.textContent = ocT("Escribe primero lo que puede salir.");
                return;
            }
            const u = new Uint32Array(1);
            crypto.getRandomValues(u);
            const i = u[0] % cosas.length;
            sale.textContent = "";
            setTimeout(() => {
                sale.textContent = ocT("{n} de {n2}: {n3}", { n: i + 1, n2: cosas.length, n3: cosas[i] });
            }, 50);
        });
        dentro.append(etX, texto, tirar, sale);
    }

    Object.assign(PM, { montarTabla });
})();
