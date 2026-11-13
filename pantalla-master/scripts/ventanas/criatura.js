// =========================================
// LA VENTANA «criatura» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // Una criatura del bestiario puesta en el tablero (📌): su perfil en
    // una ventana, a mano durante el combate.
    function montarCriatura(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Cargando…")));
        PM.pedir("datos/personajes/compendio/bestiario.json").then((datos) => {
            const b = (datos.monstruos || []).find((x) => x.en === m.datos.en);
            const guardado = { usos: m.datos.usos || {}, pestana: m.datos.pestana || 0, parte: m.datos.parte || 0,
                guardar() {
                    m.datos.usos = guardado.usos;
                    m.datos.pestana = guardado.pestana;
                    m.datos.parte = guardado.parte;
                    PM.guardar();
                },
                // Su nombre es el título de la ventana (✎ nombre lo cambia,
                // como el ✎ de la barra).
                nombre: () => m.titulo || (b && b.nombre) || "",
                renombrar: (vuelta) => PM.personalizar(m, vuelta) };
            const pintarla = () => {
                const foco = dentro.contains(document.activeElement) ? document.activeElement.className : "";
                dentro.replaceChildren(b ? PM.perfil(b, "", null, guardado) : PM.crear("p", "oc-vacio", ocT("No encuentro esa criatura.")));
                const otro = foco && dentro.querySelector("." + foco.split(" ")[0]);
                if (otro) {
                    otro.focus();
                }
            };
            m.alRenombrar = pintarla;
            pintarla();
        }).catch(() => {
            dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("No he podido cargar el bestiario.")));
        });
    }

    Object.assign(PM, { montarCriatura });
})();
