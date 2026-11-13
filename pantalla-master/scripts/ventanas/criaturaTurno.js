// =========================================
// LA VENTANA «criaturaTurno» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // 🐲 LA CRIATURA DEL TURNO: el perfil de quien tiene el turno. Un
    // monstruo, su bloque del bestiario (por «bicho», o por su nombre sin el
    // número: «Lobo 2» es un Lobo); un personaje de la party, su ficha
    // resumida. Si el turno es de un grupo, se elige quién de ellos.
    function montarCriaturaTurno(dentro, m) {
        m.datos = m.datos || {};
        const T = window.ocTurnos;
        let pintado = "";
        function pintar(forzar) {
            const d = T.leer();
            const turno = d.modo === "combate" ? T.delTurno(d, T.inicioDe(d, Math.max(0, Math.min(d.turno, d.lista.length - 1)))) : [];
            if (!turno.length) {
                if (pintado !== "-") {
                    pintado = "-";
                    dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("Nadie tiene el turno. Empieza el combate en ⏱️ iniciativa (o en ⏩ turnos) y aquí sale el perfil de a quien le toque.")));
                }
                return;
            }
            const elegido = turno.find((c) => c.id === m.datos.cual) || turno[0];
            // Si se cambia su nombre, su iniciativa, su CA o sus estados, se
            // vuelve a pintar; los PG, solos (más abajo).
            const clave = turno.map((c) => c.id).join(",") + "|" + elegido.id + "|"
                + JSON.stringify([elegido.nombre, elegido.ini, elegido.ca, elegido.temp, elegido.marcas || [],
                    elegido.pj && T.caido(elegido) ? elegido.muerte || {} : null]);
            if (clave === pintado && !forzar) {
                // El mismo turno: sólo los PG (de la iniciativa).
                const pg = dentro.querySelector("[data-pg-turno]");
                if (pg && elegido.pg !== "" && elegido.pg !== undefined) {
                    pg.textContent = String(elegido.pg);
                }
                return;
            }
            pintado = clave;
            const caja = PM.crear("div", "master-turno-criatura");
            if (turno.length > 1) {
                const cuales = PM.crear("div", "master-opciones");
                cuales.setAttribute("role", "group");
                cuales.setAttribute("aria-label", ocT("Quién de su turno"));
                turno.forEach((c) => {
                    const b = PM.botonDe("master-opcion", c.nombre, () => {
                        m.datos.cual = c.id;
                        PM.guardar();
                        pintar(true);
                    });
                    b.setAttribute("aria-pressed", String(c === elegido));
                    cuales.appendChild(b);
                });
                caja.appendChild(cuales);
            }
            const pj = elegido.pj ? (PM.todo.pjs || []).find((x) => x.id === elegido.pj) : null;
            if (pj) {
                const cabezaPj = PM.crear("div", "master-turnos-fila es-ahora");
                cabezaPj.style.setProperty("--turno-color", PM.colorIni(elegido));
                cabezaPj.append(PM.crear("strong", "master-turnos-nombre", elegido.nombre), PM.datosIni(elegido, true),
                    PM.mandosDe(elegido, dentro));
                caja.appendChild(cabezaPj);
                // A 0 PG: sus salvaciones de muerte.
                const muerte = T.muerte(elegido.id);
                if (muerte) {
                    caja.appendChild(muerte);
                }
                caja.appendChild(resumenPj(PM.normalizarPj(pj), elegido));
                dentro.replaceChildren(caja);
                return;
            }
            caja.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Cargando…")));
            dentro.replaceChildren(caja);
            PM.pedir(PM.BESTIARIO).then((datos) => {
                if (pintado !== clave) {
                    return;
                }
                const bichos = datos.monstruos || [];
                const sinNumero = PM.llano(String(elegido.nombre || "").replace(/\s+\d+$/, ""));
                const b = bichos.find((x) => elegido.bicho && (x.en === elegido.bicho || x.nombre === elegido.bicho))
                    || bichos.find((x) => PM.llano(x.nombre) === sinNumero || PM.llano(x.en || "") === sinNumero);
                caja.lastChild.remove();
                const cabeza = PM.crear("div", "master-turnos-fila es-ahora");
                cabeza.style.setProperty("--turno-color", PM.colorIni(elegido));
                cabeza.append(PM.crear("strong", "master-turnos-nombre", elegido.nombre), PM.datosIni(elegido, true),
                    PM.mandosDe(elegido, dentro));
                const pgChapa = Array.from(cabeza.querySelectorAll(".master-turnos-chapa")).find((x) => /^PG/.test(x.textContent));
                if (pgChapa) {
                    pgChapa.lastChild.remove();
                    const v = PM.crear("span", "", String(elegido.pg));
                    v.dataset.pgTurno = "";
                    pgChapa.append(document.createTextNode(" "), v);
                }
                caja.appendChild(cabeza);
                if (!b) {
                    caja.appendChild(PM.crear("p", "oc-vacio", ocT("«{nombre}» no está en el bestiario. Si es un monstruo, ponlo en la iniciativa desde el bestiario («⚔️ a la iniciativa») y aquí saldrá su perfil.", { nombre: elegido.nombre })));
                    return;
                }
                const usos = m.datos.usos && m.datos.usos[elegido.id] ? m.datos.usos[elegido.id] : {};
                const guardado = { usos, pestana: 0, parte: 0, guardar() {
                    m.datos.usos = { [elegido.id]: guardado.usos };
                    PM.guardar();
                } };
                caja.appendChild(PM.perfil(b, datos.fuente, null, guardado));
            }).catch(() => {
                caja.replaceChildren(PM.crear("p", "oc-vacio", ocT("No he podido cargar el bestiario.")));
            });
        }
        pintar(true);
        PM.mientrasEste(dentro, "oc-iniciativa:guardada", () => pintar(false));
        PM.mientrasEste(dentro, "oc-iniciativa:cambio", () => pintar(false));
        PM.mientrasEste(dentro, "oc-iniciativa:iconos", () => pintar(true));
        PM.mientrasEste(dentro, "master:pjs", () => {
            pintado = "";
            pintar(true);
        });
    }
    // La ficha resumida de un PJ (para la criatura del turno): quién es, sus
    // PG y CA, sus salvaciones, sus ataques y sus conjuros, con sus tiradas.
    function resumenPj(pj, enIni) {
        const caja = PM.crear("div", "master-turno-pj");
        const quien = pj.nombre || "PJ";
        const car = (k) => PM.numPj(pj[k]);
        const prof = PM.competenciaPj(pj);
        const cabeza = PM.crear("div", "master-turnos-fila es-ahora");
        cabeza.style.setProperty("--turno-color", PM.colorIni(enIni || { tipo: "personaje" }));
        const nombre = PM.crear("strong", "master-turnos-nombre", quien);
        cabeza.appendChild(nombre);
        const queEs = [pj.raza, pj.clase, PM.numPj(pj.nivel) ? ocT("nivel {numPj}", { numPj: PM.numPj(pj.nivel) }) : ""].filter(Boolean).join(" · ");
        if (queEs) {
            cabeza.appendChild(PM.crear("span", "master-pj-que", queEs));
        }
        const pgV = enIni && enIni.pg !== "" && enIni.pg !== undefined ? enIni.pg : PM.numPj(pj.pg) === null ? PM.numPj(pj.pgmax) : PM.numPj(pj.pg);
        const datos = PM.crear("div", "master-turnos-datos");
        [["PG", pgV, PM.numPj(pj.pgmax)], ["CA", pj.ca], [ocT("vel."), pj.velocidad]].forEach(([k, v, max]) => {
            if (v === "" || v === undefined || v === null) {
                return;
            }
            const chapa = PM.crear("span", "master-turnos-chapa");
            const valor = PM.crear("span", "", String(v));
            if (k === "PG") {
                valor.dataset.pgTurno = "";
            }
            chapa.append(PM.crear("span", "master-turnos-chapa-et", k), document.createTextNode(" "), valor,
                document.createTextNode(max !== null && max !== undefined ? " / " + max : ""));
            datos.appendChild(chapa);
        });
        cabeza.appendChild(datos);
        caja.appendChild(cabeza);
        // Salvaciones (las competentes, marcadas).
        const salv = PM.crear("ul", "master-pj-caracteristicas");
        salv.setAttribute("aria-label", ocT("Salvaciones de {quien}", { quien: quien }));
        PM.SALVACIONES_PJ.forEach((k) => {
            const n = car(k);
            if (n === null) {
                return;
            }
            const comp = pj.salvaciones.includes(k);
            const li = PM.crear("li", "master-pj-c" + (comp ? " es-competente" : ""));
            li.append(PM.crear("span", "master-party-et", (comp ? "● " : "○ ") + PM.CAR_ABR[k]), PM.dadoPj(PM.modDe(n) + (comp ? prof : 0),
                ocT("Salvación de {n} de {quien}", { n: PM.CAR_VER[k], quien: quien })));
            salv.appendChild(li);
        });
        caja.append(PM.crear("h3", "master-pj-titulo", ocT("🛡️ Salvaciones")), salv);
        if (pj.ataques.length) {
            const ul = PM.crear("ul", "master-pj-lista");
            ul.setAttribute("aria-label", ocT("Ataques de {quien}", { quien: quien }));
            pj.ataques.forEach((a) => {
                const li = PM.crear("li");
                li.appendChild(PM.crear("span", "", a.nombre || "—"));
                const b = PM.numPj(String(a.bono || "").replace("−", "-"));
                if (b !== null) {
                    li.appendChild(PM.dadoPj(b, ocT("{n} · ataque", { n: a.nombre || "ataque" })));
                }
                const dm = /^(\d+d\d+(?:\s*[+−-]\s*\d+)?)\s*(.*)$/.exec(String(a.dano || "").trim());
                if (dm && window.ocDadoBoton) {
                    li.append(window.ocDadoBoton(dm[1], dm[1].replace(/\s+/g, "").replace("−", "-"), ocT("{n} · daño", { n: a.nombre || "ataque" })),
                        PM.crear("span", "master-pj-marca", dm[2] || ""));
                } else if (a.dano) {
                    li.appendChild(PM.crear("span", "master-pj-marca", a.dano));
                }
                ul.appendChild(li);
            });
            caja.append(PM.crear("h3", "master-pj-titulo", ocT("⚔️ Ataques")), ul);
        }
        const conjuros = PM.crear("div");
        caja.appendChild(conjuros);
        if (pj.conjuros.length) {
            PM.pedir(PM.CONJUROS_SRD).then((conj) => {
                const srd = {};
                (conj.conjuros || []).forEach((c) => {
                    srd[PM.llano(c.nombre)] = c;
                });
                const aptitud = pj.aptitud;
                conjuros.appendChild(PM.crear("h3", "master-pj-titulo", ocT("✨ Conjuros")));
                if (aptitud && car(aptitud) !== null) {
                    const bono = PM.modDe(car(aptitud)) + prof;
                    const dl = PM.crear("p", "master-turnos-datos");
                    const cd = PM.crear("span", "master-turnos-chapa");
                    cd.append(PM.crear("span", "master-turnos-chapa-et", ocT("CD")), document.createTextNode(" " + (8 + bono)));
                    const at = PM.crear("span", "master-turnos-chapa");
                    at.append(PM.crear("span", "master-turnos-chapa-et", ocT("ataque")), document.createTextNode(" "),
                        PM.dadoPj(bono, ocT("Ataque de conjuro de {quien}", { quien: quien })));
                    dl.append(cd, at);
                    conjuros.appendChild(dl);
                }
                const todos = PM.conjurosPj(pj, srd);
                const nvs = Array.from(new Set(todos.map((c) => c.nivel))).sort((a, b) => (a === null) - (b === null) || a - b);
                nvs.forEach((n) => {
                    const ul = PM.crear("ul", "master-pj-lista");
                    ul.setAttribute("aria-label", ocT("{n} de {quien}", { n: n === null ? ocT("Otros conjuros") : n === 0 ? "Trucos" : ocT("Conjuros de nivel {n}", { n: n }), quien: quien }));
                    todos.filter((c) => c.nivel === n).forEach((c) => {
                        const li = PM.crear("li");
                        li.appendChild(PM.conjuroPj(c.nombre, srd, conj.fuente));
                        ul.appendChild(li);
                    });
                    conjuros.append(PM.crear("p", "master-pj-marca", n === null ? "otros" : n === 0 ? "trucos" : ocT("nivel {n}", { n: n })), ul);
                });
            }).catch(() => {});
        }
        caja.appendChild(PM.botonDe("oc-vida-accion", ocT("📖 su ficha entera"), () => PM.abrirFichaPj(pj, quien), ocT("Abrir la ficha entera de {quien}", { quien: quien })));
        return caja;
    }

    Object.assign(PM, { montarCriaturaTurno });
})();
