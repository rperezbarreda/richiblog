// =========================================
// LA VENTANA «turnos» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // Pasar de turno desde cualquier ventana (y decirlo).
    function pasarTurno(paso) {
        const T = window.ocTurnos;
        const d = T.leer();
        if (!d.lista.length) {
            return;
        }
        const { turno, acabadas } = T.pasar(d, paso);
        T.guardar(d, true);
        PM.avisar(ocT("Ronda {ronda}: le toca a {nombresDe}.{n}", { ronda: d.ronda, nombresDe: T.nombresDe(turno), n: acabadas.length ? ocT(" Se acaba: {join}.", { join: acabadas.join(", ") }) : "" }));
    }
    // Abrir (o traer) la iniciativa: en un modo, en su hueco si lo tiene.
    function irAIniciativa() {
        const ya = PM.estado.modulos.find((x) => x.tipo === "iniciativa");
        if (ya && ya.el) {
            if (ya.grupo && !ya.delante) {
                PM.verEnGrupo(ya, false);
            }
            PM.focoDe(ya).focus();
            return;
        }
        PM.anadir("iniciativa");
    }

    // A dónde vuelve el foco al cerrar: a su botón, aunque la ventana se
    // haya vuelto a pintar (la criatura del turno tarda un poco: lo espera).
    function volverA(dentro, que, id) {
        const buscar = () => dentro.querySelector("[data-" + que + '="' + CSS.escape(id) + '"]');
        return { focus: () => {
            const b = buscar();
            if (b) {
                b.focus();
                return;
            }
            setTimeout(() => {
                const otro = buscar();
                if (otro) {
                    otro.focus();
                }
            }, 400);
        } };
    }
    // ✎ en cada uno: su nombre, iniciativa, PG, CA y estados (en la ventana
    // de la iniciativa: window.ocTurnos.editar). Al cerrar, el foco vuelve
    // a su ✎ aunque la lista se haya vuelto a pintar.
    function botonEditar(c, dentro) {
        const id = c.id;
        const b = PM.botonDe("master-turnos-editar", "✎", () => window.ocTurnos.editar(id, volverA(dentro, "editar", id)), ocT("Editar a {nombre}: PG, iniciativa, nombre y estados", { nombre: c.nombre }));
        b.dataset.editar = id;
        b.title = ocT("Editar: PG, iniciativa, nombre y estados");
        b.setAttribute("aria-haspopup", "dialog");
        return b;
    }

    // ❤️ en cada uno: daño, cura o vida temporal (window.ocTurnos.vida).
    function botonVida(c, dentro) {
        const id = c.id;
        const b = PM.botonDe("master-turnos-editar es-vida", "❤️", () => window.ocTurnos.vida(id, volverA(dentro, "vida", id)), ocT("Daño, cura o vida temporal a {nombre}", { nombre: c.nombre }));
        b.dataset.vida = id;
        b.title = ocT("Daño, cura o vida temporal");
        b.setAttribute("aria-haspopup", "dialog");
        return b;
    }
    // Los dos, juntos, arriba a la derecha de su fila.
    function mandosDe(c, dentro) {
        const caja = PM.crear("div", "master-turnos-uno");
        caja.append(botonVida(c, dentro), botonEditar(c, dentro));
        return caja;
    }

    // ⏩ TURNOS: a quién le toca, en grande (él o su grupo), los que van
    // después (dando la vuelta, con la ronda que empieza) y pasar de turno.
    function montarTurnos(dentro) {
        const T = window.ocTurnos;
        const caja = PM.crear("div", "master-turnos");
        const ronda = PM.crear("p", "master-turnos-ronda");
        const ahora = PM.crear("div", "master-turnos-ahora");
        const lista = PM.crear("ol", "master-turnos-lista");
        lista.setAttribute("aria-label", ocT("Los que van después"));
        const mandos = PM.crear("div", "master-turnos-mandos");
        // 🔔: con o sin sonido al pasar de turno y de ronda.
        const sonido = PM.botonDe("oc-vida-accion master-turnos-sonido", "", () => {
            try {
                localStorage.setItem("richi-oc-iniciativa-sonido", T.conSonido() ? "no" : "si");
            } catch (e) {
                // Sin guardar: nada.
            }
            pintarSonido();
            PM.avisar(T.conSonido() ? ocT("Con sonido al pasar de turno.") : ocT("Sin sonido al pasar de turno."));
        });
        const pintarSonido = () => {
            sonido.textContent = T.conSonido() ? "🔔" : "🔕";
            sonido.setAttribute("aria-label", ocT("Sonido al pasar de turno y de ronda"));
            sonido.setAttribute("aria-pressed", String(T.conSonido()));
            sonido.title = T.conSonido() ? ocT("Con sonido (pulsa para quitarlo)") : ocT("Sin sonido (pulsa para ponerlo)");
        };
        pintarSonido();
        // ⏭️: saltarse a los caídos (los que no son de la party, a 0 PG).
        const saltar = PM.botonDe("oc-vida-accion master-turnos-sonido oc-ini-saltar", "⏭️", () => {
            const d = T.leer();
            d.saltarCaidos = !d.saltarCaidos;
            T.guardar(d, true);
            PM.avisar(d.saltarCaidos ? ocT("Al pasar de turno, se salta a los que no son de la party y están a 0 PG.")
                : ocT("Al pasar de turno, no se salta a nadie."));
        }, ocT("Saltar a los caídos"));
        saltar.title = ocT("Saltarse en los turnos a los que no son de la party y están a 0 PG");
        mandos.append(PM.botonDe("oc-vida-accion", ocT("◀ anterior turno"), () => pasarTurno(-1), ocT("Volver al turno anterior")),
            PM.botonDe("oc-vida-accion es-principal", ocT("siguiente turno ▶"), () => pasarTurno(1), ocT("Pasar al siguiente turno")), sonido, saltar);
        function pintar() {
            const d = T.leer();
            if (!d.lista.length) {
                caja.replaceChildren(PM.crear("p", "oc-vacio", ocT("No hay nadie en la iniciativa. Añádelos en ⏱️ iniciativa, o con «⚔️ a la iniciativa» en el bestiario, los encuentros y la party.")), PM.botonDe("oc-vida-accion", ocT("⏱️ ir a la iniciativa"),
                    irAIniciativa));
                return;
            }
            if (d.modo !== "combate") {
                const orden = PM.crear("ol", "master-turnos-lista");
                orden.setAttribute("aria-label", ocT("El orden, de momento"));
                d.lista.forEach((c) => {
                    const li = PM.crear("li", "master-turnos-fila");
                    li.style.setProperty("--turno-color", PM.colorIni(c));
                    li.append(PM.crear("span", "master-turnos-nombre", c.nombre), PM.datosIni(c, true), mandosDe(c, dentro));
                    orden.appendChild(li);
                });
                caja.replaceChildren(PM.crear("p", "oc-hoja-nota", ocT("El combate no ha empezado ({n}{n2}", { n: d.lista.length, n2: d.lista.length === 1 ? ocT(" en la iniciativa).") : ocT(" en la iniciativa).") })),
                PM.botonDe("oc-vida-accion es-principal", ocT("⚔️ empezar el combate"), () => {
                    const x = T.leer();
                    T.empezar(x);
                    T.guardar(x, true);
                    PM.avisar(ocT("¡Combate! Ronda 1: le toca a {nombresDe}.", { nombresDe: T.nombresDe(T.delTurno(x, 0)) }));
                }), orden);
                return;
            }
            if (d.turno < 0 || d.turno >= d.lista.length) {
                d.turno = 0;
            }
            d.turno = T.inicioDe(d, d.turno);
            const turno = T.delTurno(d, d.turno);
            saltar.setAttribute("aria-pressed", String(!!d.saltarCaidos));
            ronda.textContent = ocT("Ronda {ronda}", { ronda: d.ronda });
            ahora.replaceChildren(PM.crear("p", "master-turnos-le", ocT("le toca a")), ...turno.map((c) => {
                const fila = PM.crear("div", "master-turnos-fila es-ahora");
                fila.style.setProperty("--turno-color", PM.colorIni(c));
                fila.append(PM.crear("strong", "master-turnos-nombre", c.nombre), PM.datosIni(c, true), mandosDe(c, dentro));
                // Un PJ a 0 PG: sus salvaciones de muerte.
                const muerte = T.muerte(c.id);
                if (muerte) {
                    fila.appendChild(muerte);
                }
                return fila;
            }));
            // Los demás turnos, en orden, desde el siguiente (los de la
            // ronda que viene, con su separador).
            const filas = [];
            let i = T.finDe(d, d.turno) + 1;
            let dadaVuelta = false;
            for (;;) {
                if (i >= d.lista.length) {
                    if (dadaVuelta || d.turno === 0) {
                        break;
                    }
                    dadaVuelta = true;
                    i = 0;
                    filas.push(PM.crear("li", "master-turnos-separa", ocT("ronda {n}", { n: d.ronda + 1 })));
                }
                if (i === d.turno) {
                    break;
                }
                const cs = T.delTurno(d, i);
                const li = PM.crear("li", "master-turnos-fila");
                li.style.setProperty("--turno-color", PM.colorIni(cs[0]));
                li.append(PM.crear("span", "master-turnos-nombre", T.nombresDe(cs)), cs.length === 1 ? PM.datosIni(cs[0], true)
                    : PM.crear("span", "master-turnos-chapa", ocT("{n} a la vez", { n: cs.length })));
                if (cs.length === 1) {
                    li.appendChild(mandosDe(cs[0], dentro));
                } else {
                    // Un grupo: un ✎ con el nombre de cada uno.
                    const cada = PM.crear("div", "master-turnos-cada");
                    cs.forEach((c) => {
                        const b = botonEditar(c, dentro);
                        b.textContent = "✎ " + c.nombre;
                        cada.append(botonVida(c, dentro), b);
                    });
                    li.appendChild(cada);
                }
                filas.push(li);
                i = T.finDe(d, i) + 1;
            }
            lista.replaceChildren(...filas);
            caja.replaceChildren(ronda, ahora, lista, mandos);
        }
        dentro.appendChild(caja);
        pintar();
        PM.mientrasEste(dentro, "oc-iniciativa:guardada", pintar);
        PM.mientrasEste(dentro, "oc-iniciativa:cambio", pintar);
        PM.mientrasEste(dentro, "oc-iniciativa:iconos", pintar);
    }

    Object.assign(PM, { montarTurnos, botonEditar, mandosDe });
})();
