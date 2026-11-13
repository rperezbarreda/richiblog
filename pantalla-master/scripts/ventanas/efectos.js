// =========================================
// LA VENTANA «efectos» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // ---- LOS EFECTOS CON DURACIÓN: «Bendecir en Thia, 1 minuto»,
    // «Armadura de mago, 8 horas»… Se cuentan en segundos de juego (una
    // ronda, 6) y se descuentan solos: con las rondas de la iniciativa (el
    // evento «oc-iniciativa:guardada» de personajes.js) y con el tiempo
    // del calendario («master:tiempo»); también a mano. Escribiendo el
    // nombre de un conjuro del SRD, se pone solo su duración. ----
    const UNIDADES = [["rondas", ocT("rondas"), 6], ["minutos", ocT("minutos"), 60], ["horas", ocT("horas"), 3600], ["dias", ocT("días"), 86400]];

    // «Concentración, hasta 10 minutos» (o «Concentration, up to 10
    // minutes») → {n: 10, unidad: "minutos", conc}.
    function duracionDe(texto) {
        const t = PM.llano(texto);
        const m = /(\d+)\s*(asalto|ronda|minuto|hora|dia|round|minute|hour|day)/.exec(t);
        if (!m) {
            return null;
        }
        const unidad = { asalto: "rondas", ronda: "rondas", minuto: "minutos", hora: "horas", dia: "dias", round: "rondas",
            minute: "minutos", hour: "horas", day: "dias" }[m[2]];
        return { n: parseInt(m[1], 10), unidad, conc: /concentracion|concentration/.test(t) };
    }

    function cuantoQueda(seg) {
        if (seg <= 0) {
            return ocT("se ha acabado");
        }
        if (seg < 60) {
            const r = Math.ceil(seg / 6);
            return r + (r === 1 ? ocT(" ronda") : ocT(" rondas"));
        }
        if (seg < 3600) {
            const mi = Math.ceil(seg / 60);
            return mi + (mi === 1 ? ocT(" minuto") : ocT(" minutos")) + (mi <= 10 ? ocT(" ({ceil} rondas)", { ceil: Math.ceil(seg / 6) }) : "");
        }
        if (seg < 86400) {
            const minutos = Math.ceil(seg / 60);
            const h = Math.floor(minutos / 60);
            const mi = minutos % 60;
            return ocT("{h} h{n}", { h: h, n: mi ? ocT(" {mi} min", { mi: mi }) : "" });
        }
        const horas = Math.ceil(seg / 3600);
        const di = Math.floor(horas / 24);
        const h = horas % 24;
        return di + (di === 1 ? ocT(" día") : ocT(" días")) + (h ? ocT(" {h} h", { h: h }) : "");
    }

    function montarEfectos(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        d.efectos = Array.isArray(d.efectos) ? d.efectos : [];
        const leerIni = () => {
            try {
                return JSON.parse(localStorage.getItem("richi-oc-iniciativa") || "{}");
            } catch (e) {
                return {};
            }
        };
        if (d.ronda === undefined) {
            d.ronda = leerIni().ronda || 1;
        }
        // EL FORMULARIO: nombre (con los conjuros), sobre quién, cuánto
        // dura y si es de concentración.
        const form = PM.crear("form", "master-efecto-nuevo");
        const etN = PM.crear("label", "oc-dados-etiqueta", ocT("qué es (un conjuro del SRD pone su duración)"));
        const nombre = PM.crear("input", "master-elegir");
        nombre.id = "master-efecto-nombre-" + m.id;
        etN.htmlFor = nombre.id;
        nombre.placeholder = ocT("Bendecir, Armadura de mago, veneno…");
        const lista = PM.crear("datalist");
        lista.id = "master-efecto-conjuros-" + m.id;
        nombre.setAttribute("list", lista.id);
        const sobre = PM.elegirDe("master-efecto-sobre-" + m.id, ocT("sobre quién"), [["", "—"]], "");
        const numero = PM.crear("input", "master-elegir");
        numero.type = "number";
        numero.min = 1;
        numero.value = 1;
        numero.setAttribute("aria-label", ocT("Cuánto dura"));
        const unidad = PM.crear("select", "master-elegir");
        unidad.setAttribute("aria-label", ocT("En qué"));
        UNIDADES.forEach(([v, n]) => {
            const o = PM.crear("option", "", n);
            o.value = v;
            unidad.appendChild(o);
        });
        unidad.value = "minutos";
        const etDura = PM.crear("p", "oc-dados-etiqueta", ocT("cuánto dura"));
        etDura.setAttribute("aria-hidden", "true");
        const dura = PM.crear("div", "master-efecto-dura");
        dura.append(numero, unidad);
        const etConc = PM.crear("label", "master-nombres-apellido");
        const conc = PM.crear("input");
        conc.type = "checkbox";
        etConc.append(conc, document.createTextNode(ocT(" de concentración")));
        const anadirE = PM.crear("button", "oc-vida-accion es-principal", ocT("＋ efecto"));
        anadirE.type = "submit";
        form.append(etN, nombre, lista, sobre, etDura, dura, etConc, anadirE);
        let conjuros = [];
        PM.pedir(PM.CONJUROS_SRD).then((c) => {
            conjuros = c.conjuros || [];
            conjuros.filter((x) => duracionDe(x.dur || "")).forEach((x) => {
                const o = PM.crear("option");
                o.value = x.nombre;
                lista.appendChild(o);
            });
        }).catch(() => {});
        nombre.addEventListener("change", () => {
            const c = conjuros.find((x) => PM.llano(x.nombre) === PM.llano(nombre.value));
            const du = c && duracionDe(c.dur || "");
            if (du) {
                numero.value = du.n;
                unidad.value = du.unidad;
                conc.checked = du.conc;
                PM.avisar(c.nombre + ": " + c.dur + ".");
            }
        });
        // Los de la iniciativa, para «sobre quién».
        const pintarQuien = () => {
            const ahora = sobre.elegir.value;
            const nombres = (leerIni().lista || []).map((x) => x.nombre);
            sobre.elegir.replaceChildren(...[["", "—"]].concat(nombres.map((x) => [x, x])).map(([v, n]) => {
                const o = PM.crear("option", "", n);
                o.value = v;
                return o;
            }));
            sobre.elegir.value = nombres.indexOf(ahora) >= 0 ? ahora : "";
        };
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const n = Math.max(1, parseInt(numero.value, 10) || 1);
            const seg = n * UNIDADES.find((x) => x[0] === unidad.value)[2];
            const ef = { id: Date.now().toString(36), nombre: nombre.value.trim() || "efecto", sobre: sobre.elegir.value, quedan: seg,
                total: seg, conc: conc.checked };
            d.efectos.push(ef);
            nombre.value = "";
            conc.checked = false;
            PM.guardar();
            pintar();
            PM.avisar(ocT("Efecto: {nombre}{n}, {cuantoQueda}.", { nombre: ef.nombre, n: ef.sobre ? " en " + ef.sobre : "", cuantoQueda: cuantoQueda(seg) }));
        });
        // QUE PASE EL TIEMPO (en segundos): se descuenta a todos.
        const pasar = (seg, porque) => {
            const acaban = [];
            d.efectos.forEach((ef) => {
                if (ef.quedan > 0) {
                    ef.quedan = Math.max(0, ef.quedan - seg);
                    if (!ef.quedan) {
                        acaban.push(ef.nombre + (ef.sobre ? " en " + ef.sobre : ""));
                    }
                }
            });
            PM.guardar();
            pintar();
            if (acaban.length) {
                PM.avisar(ocT("Se acaba: {join}.", { join: acaban.join(", ") }));
            } else if (porque) {
                PM.avisar(porque);
            }
        };
        const aMano = PM.crear("div", "master-cal-tiempo");
        aMano.setAttribute("role", "group");
        aMano.setAttribute("aria-label", ocT("Que pase el tiempo a mano"));
        [[ocT("+1 ronda"), 6], [ocT("+1 minuto"), 60], [ocT("+10 minutos"), 600], [ocT("+1 hora"), 3600]].forEach(([t, seg]) => {
            aMano.appendChild(PM.botonDe("oc-vida-accion", t, () => pasar(seg, ocT("Pasa {slice}.", { slice: t.slice(1) }))));
        });
        const listaE = PM.crear("ul", "master-efectos");
        listaE.setAttribute("aria-label", ocT("Efectos"));
        const quitarAcabados = PM.botonDe("oc-vida-accion", ocT("🧹 quitar los acabados"), () => {
            d.efectos = d.efectos.filter((x) => x.quedan > 0);
            PM.guardar();
            pintar();
            PM.avisar(ocT("Quitados los que se habían acabado."));
        });
        function pintar() {
            listaE.replaceChildren(...d.efectos.map((ef, i) => {
                const li = PM.crear("li", "master-efecto" + (ef.quedan <= 0 ? " es-acabado" : ""));
                const cab = PM.crear("p", "master-efecto-nombre");
                cab.append(PM.crear("strong", "", ef.nombre), document.createTextNode((ef.sobre ? " · " + ef.sobre : "") + (ef.conc ? ocT(" · 🧠 concentración") : "")));
                const barra = PM.crear("div", "master-efecto-barra");
                barra.setAttribute("role", "meter");
                barra.setAttribute("aria-valuemin", "0");
                barra.setAttribute("aria-valuemax", String(ef.total));
                barra.setAttribute("aria-valuenow", String(ef.quedan));
                barra.setAttribute("aria-valuetext", ocT("Queda: ") + cuantoQueda(ef.quedan));
                barra.setAttribute("aria-label", ef.nombre);
                const lleno = PM.crear("span", "master-efecto-lleno");
                lleno.style.setProperty("--parte", Math.round(100 * ef.quedan / Math.max(1, ef.total)) + "%");
                barra.appendChild(lleno);
                const queda = PM.crear("p", "master-efecto-queda", ef.quedan > 0 ? ocT("Queda: {cuantoQueda}", { cuantoQueda: cuantoQueda(ef.quedan) }) : ocT("⌛ Se ha acabado"));
                const quitar = PM.botonDe("master-nombre-boton", "✕", () => {
                    d.efectos.splice(i, 1);
                    PM.guardar();
                    pintar();
                    PM.avisar(ocT("Quitado: {nombre}.", { nombre: ef.nombre }));
                    nombre.focus();
                }, ocT("Quitar {nombre}", { nombre: ef.nombre }));
                const fila = PM.crear("div", "master-efecto-fila");
                fila.append(cab, quitar);
                li.append(fila, barra, queda);
                return li;
            }));
            if (!d.efectos.length) {
                listaE.appendChild(PM.crear("li", "oc-vacio", ocT("Sin efectos. Añade uno arriba.")));
            }
            quitarAcabados.hidden = !d.efectos.some((x) => x.quedan <= 0);
        }
        // Con la iniciativa: cada ronda que pasa, 6 segundos.
        const alIni = (e) => {
            if (!dentro.isConnected) {
                document.removeEventListener("oc-iniciativa:guardada", alIni);
                document.removeEventListener("master:tiempo", alTiempo);
                return;
            }
            const r = (e.detail && e.detail.ronda) || 1;
            const antes = d.ronda || 1;
            d.ronda = r;
            pintarQuien();
            if (r > antes) {
                pasar((r - antes) * 6, ocT("Ronda {r}.", { r: r }));
            } else {
                PM.guardar();
            }
        };
        // Con el calendario: las horas que pasan.
        const alTiempo = (e) => {
            if (!dentro.isConnected) {
                return;
            }
            const h = (e.detail && e.detail.horas) || 0;
            if (h > 0) {
                pasar(h * 3600);
            }
        };
        document.addEventListener("oc-iniciativa:guardada", alIni);
        document.addEventListener("master:tiempo", alTiempo);
        document.addEventListener("oc-iniciativa:cambio", pintarQuien);
        const etTiempo = PM.crear("p", "oc-hoja-nota", ocT("Se descuentan solos con las rondas de la iniciativa y el tiempo del calendario; o a mano:"));
        dentro.append(form, etTiempo, aMano, listaE, quitarAcabados);
        pintarQuien();
        pintar();
    }

    Object.assign(PM, { montarEfectos });
})();
