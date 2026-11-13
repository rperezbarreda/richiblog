// =========================================
// LA VENTANA «ficha» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // UNA FICHA EN EL TABLERO (📌): un conjuro, una regla (del SRD o
    // propia) o un objeto, en su ventana. «datos»: {que, id}.
    function montarFicha(dentro, m) {
        m.datos = m.datos || {};
        const que = m.datos.que;
        const id = m.datos.id;
        const poner = (x) => dentro.replaceChildren(x || PM.crear("p", "oc-vacio", ocT("Ya no está.")));
        dentro.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Cargando…")));
        if (que === "propia") {
            const pintar = () => {
                const r = PM.leerHomebrew().find((x) => x.id === id);
                poner(r ? PM.markdown(r.texto) : null);
            };
            pintar();
            PM.mientrasEste(dentro, "master:homebrew", pintar);
            return;
        }
        if (que === "otro") {
            const pintar = () => {
                const x = PM.leerPropios().otros.find((y) => y.id === id);
                const caja = x ? PM.crear("div") : null;
                if (x) {
                    caja.append(PM.crear("p", "oc-hoja-nota", PM.verDato(x.cat)), PM.markdown(x.texto), PM.crear("p", "oc-hoja-nota master-fuente", PM.fuenteDe(x)));
                }
                poner(caja);
            };
            pintar();
            PM.mientrasEste(dentro, "master:propios", pintar);
            return;
        }
        if (que === "rasgo") {
            PM.pedir(PM.RASGOS_SRD).then((datos) => {
                const r = (datos.rasgos || []).find((x) => PM.idRasgo(x) === id);
                poner(r ? PM.cuerpoRasgo(r, datos.fuente) : null);
            }).catch(() => poner(null));
            return;
        }
        const ruta = { conjuro: PM.CONJUROS_SRD, regla: PM.REGLAS,
            objeto: "datos/personajes/compendio/tienda.json" }[que];
        if (!ruta) {
            poner(null);
            return;
        }
        PM.pedir(ruta).then((datos) => {
            if (que === "conjuro") {
                const c = (datos.conjuros || []).find((x) => x.en === id);
                poner(c ? PM.cuerpoConjuro(c, datos.fuente) : null);
            } else if (que === "regla") {
                // Por su id (o por el nombre, en las de antes).
                const r = (datos.reglas || []).find((x) => x.id === id) || (datos.reglas || []).find((x) => x.nombre === id
                    || (x.original && x.original.nombre === id));
                const t = r ? PM.markdown(r.texto) : null;
                if (t && window.ocDadosEnTexto) {
                    window.ocDadosEnTexto(t);
                }
                poner(t);
            } else {
                const o = (datos.objetos || []).find((x) => x.en === id);
                poner(o ? PM.datosObjeto(o) : null);
            }
        }).catch(() => poner(PM.crear("p", "oc-vacio", ocT("No he podido cargarlo."))));
    }

    Object.assign(PM, { montarFicha });
})();
