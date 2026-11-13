// =========================================
// LA VENTANA «encuentros» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // ENCUENTROS: monstruos del SRD de un hábitat que quepan en lo que
    // aguanta la party. El presupuesto, una cuenta propia: por cada PJ,
    // los PX de un monstruo de VD igual a su nivel, por 0,25 (bajo), 0,4
    // (moderado) o 0,6 (alto).
    const DIFICULTADES = [["baja", ocT("baja"), 0.25], ["moderada", ocT("moderada"), 0.4], ["alta", ocT("alta"), 0.6]];

    // Lo que aguanta cada PJ según su nivel (baja, moderada, alta).
    const PX_PJ = [[50, 75, 100], [100, 150, 200], [150, 225, 400], [250, 375, 500], [500, 750, 1100], [600, 1000, 1400],
        [750, 1300, 1700], [1000, 1700, 2100], [1300, 2000, 2600], [1600, 2300, 3100], [1900, 2900, 4100], [2200, 3700, 4700],
        [2600, 4200, 5400], [2900, 4900, 6200], [3300, 5400, 7800], [3800, 6100, 9800], [4500, 7200, 11700], [5000, 8700, 14200],
        [5500, 10700, 17200], [6400, 13200, 22000]];
    const presupuestosDe = (niveles) => [0, 1, 2].map((i) => niveles.reduce((t, n) => t + PX_PJ[Math.min(20, Math.max(1, n)) - 1][i], 0));

    function montarEncuentros(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Cargando…")));
        PM.pedir(PM.BESTIARIO).then((datos) => {
            const d = m.datos;
            const bichos = datos.monstruos;
            const porEn = {};
            bichos.forEach((b) => {
                porEn[b.en] = b;
            });
            const habitats = Array.from(new Set(bichos.flatMap((b) => b.habitat || []))).filter((h) => h !== "cualquiera")
                .sort((a, b) => PM.verDato(a).localeCompare(PM.verDato(b), window.ocLocale));
            const habitat = PM.elegirDe("master-encuentro-habitat-" + m.id, ocT("dónde"),
                [["", ocT("cualquier sitio")]].concat(habitats.map((h) => [h, PM.verDato(h)])), d.habitat || "");
            const enParty = PM.estado.modulos.filter((x) => x.tipo === "party")
                .reduce((t, x) => t + ((x.datos && x.datos.pjs) || []).length, 0);
            const numero = (id, texto, valor, min, max) => {
                const caja = PM.crear("div", "master-campo");
                const et = PM.crear("label", "oc-dados-etiqueta", texto);
                const x = PM.crear("input", "master-elegir");
                x.type = "number";
                x.min = min;
                x.max = max;
                x.value = valor;
                x.id = id + m.id;
                et.htmlFor = x.id;
                caja.append(et, x);
                caja.elegir = x;
                return caja;
            };
            const nivel = numero("master-encuentro-nivel-", ocT("nivel de la party"), d.nivel || 3, 1, 20);
            const pjs = numero("master-encuentro-pjs-", ocT("cuántos PJ{n}", { n: enParty ? ocT(" (en la party hay {enParty})", { enParty: enParty }) : "" }),
                d.pjs || enParty || 4, 1, 10);
            const fila = PM.crear("div", "master-encuentro-fila");
            fila.append(nivel, pjs);
            // Con la party de la campaña: sus niveles de verdad.
            const nivelesParty = () => (PM.todo.pjs || []).map((pj) => PM.numPj(pj.nivel) || 1);
            const conParty = PM.crear("label", "master-encuentro-party");
            const conPartyC = PM.crear("input");
            conPartyC.type = "checkbox";
            conPartyC.checked = d.conParty !== undefined ? !!d.conParty : nivelesParty().length > 0;
            const conPartyT = PM.crear("span");
            conParty.append(conPartyC, conPartyT);
            const pintarParty = () => {
                const nv = nivelesParty();
                conPartyC.disabled = !nv.length;
                if (!nv.length) {
                    conPartyC.checked = false;
                }
                conPartyT.textContent = nv.length ? ocT(" con la party de la campaña ({n} PJ, niveles {join})", { n: nv.length, join: nv.join(", ") })
                    : ocT(" con la party de la campaña (no hay nadie todavía)");
                fila.hidden = conPartyC.checked;
            };
            conPartyC.addEventListener("change", () => {
                d.conParty = conPartyC.checked;
                PM.guardar();
                pintarParty();
            });
            pintarParty();
            PM.mientrasEste(dentro, "master:pjs", pintarParty);
            const dificultad = PM.botonesDe(ocT("dificultad"), DIFICULTADES.map((x) => [x[0], x[1]]), d.dificultad || "moderada", (v) => {
                d.dificultad = v;
                PM.guardar();
            });
            const etDif = PM.crear("p", "oc-dados-etiqueta", ocT("dificultad"));
            etDif.setAttribute("aria-hidden", "true");
            const sale = PM.crear("div", "master-botin");
            sale.setAttribute("aria-live", "polite");
            const pintar = () => {
                const r = d.sale;
                sale.replaceChildren();
                if (!r) {
                    sale.appendChild(PM.crear("p", "oc-vacio", ocT("Elige y pulsa «generar».")));
                    return;
                }
                if (!r.grupos.length) {
                    sale.appendChild(PM.crear("p", "oc-vacio", ocT("No cabe ningún monstruo de ese sitio. Prueba con otro o sube la dificultad.")));
                    return;
                }
                const lista = PM.crear("ul", "master-botin-lista");
                let px = 0;
                r.grupos.forEach((g) => {
                    const b = porEn[g.en];
                    if (!b) {
                        return;
                    }
                    px += g.n * PM.pxDe(b);
                    const li = PM.crear("li", "master-botin-cosa");
                    const ver = PM.botonDe("master-botin-objeto", (g.n > 1 ? ocT("{n} × ", { n: g.n }) : "") + b.nombre, () => PM.abrirBicho(b, ver, datos.fuente),
                        ocT("Ver {nombre}", { nombre: b.nombre }));
                    li.append(PM.tokenDe(b), ver, PM.crear("span", "master-botin-valor", ocT("VD {cr} · {toLocaleString} PX", { cr: b.cr, toLocaleString: (g.n * PM.pxDe(b)).toLocaleString(window.ocLocale) })));
                    lista.appendChild(li);
                });
                const todos = PM.botonDe("oc-vida-accion es-principal", ocT("⚔️ todos a la iniciativa"), () => {
                    const entran = [];
                    r.grupos.forEach((g) => {
                        const b = porEn[g.en];
                        for (let i = 0; i < g.n && b; i++) {
                            entran.push(PM.meterEnIniciativa(PM.iniDeBicho(b),
                                (nombres, renombrar) => PM.conNumero(b.nombre, nombres, renombrar), b.nombre));
                        }
                    });
                    PM.avisar(ocT("A la iniciativa: {join}.", { join: entran.filter(Boolean).join(", ") }));
                });
                // Qué tal le va a la party de verdad (si la hay).
                const nv = nivelesParty();
                let cuanDificil = "";
                if (nv.length) {
                    const [baja, mod, alta] = presupuestosDe(nv);
                    cuanDificil = ocT(" Para tu party ({n} PJ): {n2} (baja {toLocaleString} · moderada {toLocaleString2} · alta {toLocaleString3}).", { n: nv.length, n2: px <= baja ? ocT("baja") : px <= mod ? ocT("moderada") : px <= alta
                        ? ocT("alta") : ocT("más que alta, ¡ojo!"), toLocaleString: baja.toLocaleString(window.ocLocale), toLocaleString2: mod.toLocaleString(window.ocLocale), toLocaleString3: alta.toLocaleString(window.ocLocale) });
                }
                const darPxB = PM.botonDe("oc-vida-accion", ocT("🏆 dar sus PX a la party"), () => PM.darPx(px, null, darPxB),
                    ocT("Repartir los {toLocaleString} PX de este encuentro entre la party", { toLocaleString: px.toLocaleString(window.ocLocale) }));
                darPxB.hidden = !nv.length;
                const botonesE = PM.crear("div", "master-creador-barra");
                botonesE.append(todos, darPxB);
                sale.append(PM.crear("p", "master-encuentro-hacen", ocT("Están {hacen}.", { hacen: r.hacen })), lista,
                    PM.crear("p", "master-botin-total", ocT("{toLocaleString} PX de {toLocaleString2} que aguanta la party.{cuanDificil}", { toLocaleString: px.toLocaleString(window.ocLocale), toLocaleString2: r.presupuesto.toLocaleString(window.ocLocale), cuanDificil: cuanDificil })), botonesE);
            };
            const generar = PM.botonDe("oc-vida-accion es-principal master-nombres-generar", ocT("🎲 generar encuentro"), () => {
                d.habitat = habitat.elegir.value;
                d.nivel = Math.min(20, Math.max(1, parseInt(nivel.elegir.value, 10) || 1));
                d.pjs = Math.min(10, Math.max(1, parseInt(pjs.elegir.value, 10) || 1));
                d.dificultad = dificultad.valor();
                const f = (DIFICULTADES.find((x) => x[0] === d.dificultad) || DIFICULTADES[1])[2];
                const nv = conPartyC.checked ? nivelesParty() : [];
                const iDif = Math.max(0, DIFICULTADES.findIndex((x) => x[0] === d.dificultad));
                d.sale = nv.length ? PM.hacerEncuentro(bichos, d.habitat, Math.round(nv.reduce((a, b) => a + b, 0) / nv.length), nv.length, f,
                    presupuestosDe(nv)[iDif]) : PM.hacerEncuentro(bichos, d.habitat, d.nivel, d.pjs, f);
                PM.guardar();
                pintar();
                PM.avisar(d.sale.grupos.length ? ocT("Encuentro: {join}, {hacen}.", { join: d.sale.grupos.map((g) => g.n + " " + (porEn[g.en] || {}).nombre)
                    .join(ocT(" y ")), hacen: d.sale.hacen }) : ocT("No cabe ningún monstruo."));
            });
            const arriba = PM.crear("div", "master-nombres-form");
            arriba.append(habitat, conParty, fila, etDif, dificultad, generar);
            dentro.replaceChildren(arriba, sale, PM.crear("p", "oc-hoja-nota master-fuente",
                ocT("Monstruos: SRD 5.2 (CC BY 4.0). La dificultad, con la party, según los PX que aguanta cada PJ por su nivel; sin ella, una cuenta propia aproximada.")));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("No he podido cargar el bestiario.")));
        });
    }

    Object.assign(PM, { montarEncuentros });
})();
