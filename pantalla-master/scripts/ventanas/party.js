// =========================================
// LA VENTANA «party» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // ---- LA PARTY: los jugadores, a mano y deprisa: nombre, clase, PG,
    // CA, las seis características (su bono tira 1d20+bono) y las
    // pasivas (Percepción, Investigación y Perspicacia). ----
    const CARACTERISTICAS = ["FUE", "DES", "CON", "INT", "SAB", "CAR"];
    const PASIVAS = [["per", ocT("Percepción pasiva"), "👁️"], ["inv", ocT("Investigación pasiva"), "🔍"],
        ["persp", ocT("Perspicacia pasiva"), "💭"]];

    function montarParty(dentro, m) {
        m.datos = m.datos || {};
        // Los PJ son de la campaña (todo.pjs), no de esta ventana.
        const pjsDe = () => PM.todo.pjs;
        const numero = (v) => (v === "" || v === undefined || v === null || isNaN(parseInt(v, 10)) ? "" : parseInt(v, 10));
        const mod = (n) => Math.floor((n - 10) / 2);
        const conSigno = (n) => (n >= 0 ? "+" : "−") + Math.abs(n);
        const quienEs = (pj, i) => pj.nombre || ocT("jugador {n}", { n: i + 1 });
        const uid = "master-party-" + m.id;

        pjsDe().forEach((pj) => {
            pj.id = pj.id || PM.nuevoIdPj();
        });
        // ---- las pestañas: la lista (para mirar), el editor y los
        // hechizos de todos ----
        const panelLista = PM.crear("div");
        const panelEditor = PM.crear("div");
        const panelConjuros = PM.crear("div");
        const { lista: pestanas, elegir } = PM.pestanasDe([[ocT("👥 la party"), panelLista], [ocT("✏️ editar"), panelEditor],
            [ocT("✨ hechizos"), panelConjuros]], ocT("Party"), uid, (i) => {
            m.datos.pestana = i;
            PM.guardar();
            [pintarLista, pintarEditor, pintarConjuros][i]();
        });

        // ---- LOS HECHIZOS DE TODOS: por jugador; cada uno se abre ----
        function pintarConjuros() {
            panelConjuros.replaceChildren(PM.crear("p", "oc-hoja-nota", ocT("Cargando…")));
            PM.pedir(PM.CONJUROS_SRD).then((conj) => {
                const srd = {};
                (conj.conjuros || []).forEach((c) => {
                    srd[PM.llano(c.nombre)] = c;
                });
                panelConjuros.replaceChildren();
                let alguno = false;
                pjsDe().forEach((pj, i) => {
                    const todos = PM.conjurosPj(pj, srd).sort((x, y) => (x.nivel === null) - (y.nivel === null) || x.nivel - y.nivel);
                    if (!todos.length) {
                        return;
                    }
                    alguno = true;
                    panelConjuros.appendChild(PM.crear("h3", "master-pj-titulo", quienEs(pj, i)));
                    const ul = PM.crear("ul", "master-pj-lista");
                    ul.setAttribute("aria-label", ocT("Hechizos de {quienEs}", { quienEs: quienEs(pj, i) }));
                    todos.forEach((c) => {
                        const li = PM.crear("li");
                        li.append(PM.crear("span", "master-pj-marca", c.nivel === null ? "¿?" : c.nivel === 0 ? "truco" : ocT("nv {nivel}", { nivel: c.nivel })),
                            PM.conjuroPj(c.nombre, srd, conj.fuente));
                        ul.appendChild(li);
                    });
                    panelConjuros.appendChild(ul);
                });
                if (!alguno) {
                    panelConjuros.appendChild(PM.crear("p", "oc-vacio", ocT("Nadie tiene hechizos apuntados (se ponen en la ficha de cada uno).")));
                }
            }).catch(() => panelConjuros.replaceChildren(PM.crear("p", "oc-vacio", ocT("No he podido cargar los hechizos."))));
        }

        // ---- LA LISTA: de un vistazo, sin campos; con sus dados y «a la
        // iniciativa» (tira 1d20 + su bono de Destreza) ----
        const alIni = (pj, i) => {
            return PM.meterEnIniciativa(PM.iniDePj(pj, quienEs(pj, i)));
        };
        // Crear (una ficha vacía, abierta para rellenar) o importar uno.
        const crearPj = PM.crear("div", "master-creador-barra");
        const nuevoB = PM.botonDe("oc-vida-accion es-principal", ocT("＋ personaje"), () => {
            const pj = PM.nuevoPj();
            PM.anadir("pj", { titulo: pj.nombre, datos: { pj: pj.id, editar: true } });
        }, ocT("Crear un personaje nuevo (con su ficha, para rellenar)"));
        const ddbB = PM.botonDe("oc-vida-accion", ocT("📥 importar"), () => PM.abrirImportarPj(ddbB),
            ocT("Importar un personaje de D&D Beyond, Nivel20 o Foundry VTT"));
        ddbB.setAttribute("aria-haspopup", "dialog");
        crearPj.append(nuevoB, ddbB);
        function pintarLista() {
            const pjs = pjsDe();
            panelLista.replaceChildren(crearPj);
            if (!pjs.length) {
                panelLista.appendChild(PM.crear("p", "oc-vacio", ocT("Todavía no hay personajes: crea uno o impórtalo (D&D Beyond, Nivel20 o Foundry VTT).")));
                return;
            }
            const todos = PM.botonDe("oc-vida-accion es-principal", ocT("⚔️ todos a la iniciativa"), () => {
                const entran = pjs.map((pj, i) => alIni(pj, i)).filter(Boolean);
                PM.avisar(entran.length ? ocT("A la iniciativa: {join}.", { join: entran.join(", ") }) : ocT("Ya estaban todos en la iniciativa."));
            }, ocT("Poner a toda la party en la iniciativa (tira su iniciativa)"));
            const resumen = PM.crear("p", "master-party-resumen");
            const trozos = PASIVAS.map(([k, texto]) => {
                const con = pjs.filter((pj) => PM.pasivaPj(PM.normalizarPj(pj), k) !== null);
                if (!con.length) {
                    return "";
                }
                const mejor = con.reduce((a, b) => (PM.pasivaPj(b, k) > PM.pasivaPj(a, k) ? b : a));
                return texto.replace(" pasiva", "") + " " + PM.pasivaPj(mejor, k) + " (" + (mejor.nombre || ocT("sin nombre")) + ")";
            }).filter(Boolean);
            resumen.textContent = trozos.length ? ocT("La más alta: {join}", { join: trozos.join(" · ") }) : "";
            resumen.hidden = !trozos.length;
            const ul = PM.crear("ul", "master-party es-lista");
            ul.dataset.queSolo = "si";
            ul.setAttribute("aria-label", ocT("Jugadores"));
            pjs.forEach((pj, i) => {
                const quien = quienEs(pj, i);
                const li = PM.crear("li", "master-party-pj es-lista");
                const cabeza = PM.crear("div", "master-party-cabeza");
                const nombre = PM.crear("p", "master-party-nombre");
                const cara = PM.fotoPj(pj, "master-party-foto", "");
                if (cara) {
                    nombre.appendChild(cara);
                }
                nombre.appendChild(PM.crear("strong", "", quien));
                if (pj.clase) {
                    nombre.appendChild(PM.crear("span", "master-party-clase", pj.clase));
                }
                const ini = PM.botonDe("oc-vida-accion", ocT("＋ iniciativa"), () => {
                    const n = alIni(pj, i);
                    PM.avisar(n ? ocT("A la iniciativa: {n}.", { n: n }) : ocT("{quien} ya está en la iniciativa.", { quien: quien }));
                }, ocT("Poner a {quien} en la iniciativa (tira su iniciativa)", { quien: quien }));
                const ficha = PM.botonDe("oc-vida-accion", ocT("📖 ficha"), () => PM.abrirFichaPj(pj, quien),
                    ocT("Abrir la ficha de {quien} (habilidades, armas, hechizos, historia…)", { quien: quien }));
                const botones = PM.crear("div", "master-pj-botones");
                botones.append(ficha, ini);
                if (PM.puedeSubir(pj)) {
                    const sube = PM.botonDe("oc-vida-accion es-principal", ocT("⬆ nivel {n}", { n: (PM.numPj(pj.nivel) || 1) + 1 }), () => PM.verSubidas([pj], sube),
                        ocT("{quien} tiene PX para subir a nivel {n}", { quien: quien, n: (PM.numPj(pj.nivel) || 1) + 1 }));
                    sube.setAttribute("aria-haspopup", "dialog");
                    botones.prepend(sube);
                }
                cabeza.append(nombre, botones);
                const vitales = PM.crear("dl", "master-party-vitales");
                const vital = (et, valor, titulo) => {
                    if (valor === "" || valor === undefined) {
                        return;
                    }
                    const dt = PM.crear("dt", "", et);
                    dt.title = titulo;
                    vitales.append(dt, PM.crear("dd", "", String(valor)));
                };
                const pgAhora = numero(pj.pg) !== "" ? numero(pj.pg) : numero(pj.pgmax);
                vital("PG", pgAhora === "" ? "—" : pgAhora + (numero(pj.pgmax) !== "" ? " / " + numero(pj.pgmax) : "")
                    + (numero(pj.pgtemp) ? ocT(" (+{numero} temp.)", { numero: numero(pj.pgtemp) }) : ""), ocT("Puntos de golpe"));
                vital("CA", numero(pj.ca), ocT("Clase de armadura"));
                vital("PX", (PM.numPj(pj.px) || 0).toLocaleString("es-ES") + ((PM.numPj(pj.nivel) || 1) < 20 ? " / "
                    + PM.pxParaSubir(pj).toLocaleString("es-ES") : ""), ocT("Puntos de experiencia (y los que necesita para subir)"));
                PASIVAS.forEach(([k, texto, emoji]) => vital(emoji, PM.pasivaPj(pj, k) === null ? "" : PM.pasivaPj(pj, k), texto));
                vitales.querySelectorAll("dt").forEach((dt) => {
                    if (/\p{Extended_Pictographic}/u.test(dt.textContent)) {
                        const t = dt.title;
                        const e = dt.textContent;
                        dt.textContent = "";
                        const em = PM.crear("span", "", e);
                        em.setAttribute("aria-hidden", "true");
                        dt.append(em, PM.crear("span", "visually-hidden", t));
                    }
                });
                const car = PM.crear("ul", "master-party-caracteristicas");
                car.setAttribute("aria-label", ocT("Características de {quien}", { quien: quien }));
                CARACTERISTICAS.forEach((k) => {
                    const n = numero(pj[k.toLowerCase()]);
                    if (n === "") {
                        return;
                    }
                    const c = PM.crear("li", "master-party-c");
                    c.appendChild(PM.crear("span", "master-party-et", k));
                    c.appendChild(PM.crear("span", "master-party-valor", String(n)));
                    c.appendChild(window.ocDadoBoton ? window.ocDadoBoton(conSigno(mod(n)), "1d20" + (mod(n) >= 0 ? "+" : "")
                        + mod(n), ocT("{k} de {quien}", { k: k, quien: quien })) : document.createTextNode(conSigno(mod(n))));
                    car.appendChild(c);
                });
                li.append(cabeza, vitales);
                if (car.children.length) {
                    li.appendChild(car);
                }
                ul.appendChild(li);
            });
            // TIRADA DE GRUPO: una salvación, una habilidad o la iniciativa
            // de todos a la vez (por ejemplo, Percepción para ver quién lo nota).
            const grupo = PM.crear("form", "master-party-grupo");
            const etG = PM.crear("label", "oc-dados-etiqueta", ocT("🎲 tirada de grupo"));
            const queG = PM.crear("select", "oc-dados-elegir");
            queG.id = "master-party-grupo-" + m.id;
            etG.htmlFor = queG.id;
            const opc = (v, t, padre) => {
                const o = PM.crear("option", "", t);
                o.value = v;
                padre.appendChild(o);
            };
            const gS = PM.crear("optgroup");
            gS.label = ocT("salvaciones");
            Object.keys(PM.NOMBRES_CAR).forEach((k) => opc("s:" + k, ocT("salvación de {n}", { n: PM.CAR_VER[k] }), gS));
            const gH = PM.crear("optgroup");
            gH.label = ocT("habilidades");
            PM.HABILIDADES_PJ.forEach(([n]) => opc("h:" + n, n, gH));
            const gC = PM.crear("optgroup");
            gC.label = ocT("características");
            Object.keys(PM.NOMBRES_CAR).forEach((k) => opc("c:" + k, PM.CAR_VER[k], gC));
            queG.append(gS, gH, gC);
            queG.value = "h:Percepción";
            const tirarG = PM.crear("button", "oc-vida-accion es-principal", ocT("tirar"));
            tirarG.type = "submit";
            const resultadoG = PM.crear("ol", "master-party-grupo-resultado");
            resultadoG.setAttribute("aria-label", ocT("Resultados de la tirada de grupo"));
            resultadoG.hidden = true;
            const vivoG = PM.crear("p", "visually-hidden");
            vivoG.setAttribute("aria-live", "polite");
            grupo.addEventListener("submit", (e) => {
                e.preventDefault();
                if (!window.ocDados) {
                    return;
                }
                const [tipo, k] = queG.value.split(/:(.*)/);
                const textoQue = queG.options[queG.selectedIndex].textContent;
                const filas = pjs.map((pj, i) => {
                    PM.normalizarPj(pj);
                    let bono = 0;
                    if (tipo === "h") {
                        bono = PM.bonoHabPj(pj, k);
                    } else {
                        const n = PM.numPj(pj[k]);
                        bono = (n === null ? 0 : PM.modDe(n)) + (tipo === "s" && (pj.salvaciones || []).includes(k) ? PM.competenciaPj(pj) : 0);
                    }
                    bono = bono === null ? 0 : bono;
                    const r = window.ocDados.tirar("1d20" + (bono ? (bono > 0 ? "+" : "") + bono : ""), ocT("{textoQue} de {quienEs}", { textoQue: textoQue, quienEs: quienEs(pj, i) }));
                    return { quien: quienEs(pj, i), total: r ? r.total : 0, d20: r && r.d20 ? r.d20.queda : null, bono };
                }).sort((a, b) => b.total - a.total);
                resultadoG.replaceChildren(...filas.map((f) => {
                    const li = PM.crear("li", f.d20 === 20 ? "es-critico" : f.d20 === 1 ? "es-pifia" : "");
                    li.append(PM.crear("strong", "", String(f.total)), document.createTextNode(ocT(" {quien} (d20{n} {signo}){n2}", { quien: f.quien, n: f.d20 !== null ? " " + f.d20 : "", signo: PM.signo(f.bono), n2: f.d20 === 20 ? " ¡20!" : f.d20 === 1 ? " ¡1!" : "" })));
                    return li;
                }));
                resultadoG.hidden = false;
                vivoG.textContent = textoQue + ": " + filas.map((f) => f.quien + " " + f.total).join(", ") + ".";
            });
            grupo.append(etG, queG, tirarG);
            const pxForm = PM.crear("form", "master-party-grupo");
            const etPx = PM.crear("label", "oc-dados-etiqueta", ocT("🏆 repartir PX (a partes iguales)"));
            const pxIn = PM.crear("input", "oc-dados-texto");
            pxIn.type = "number";
            pxIn.min = "1";
            pxIn.inputMode = "numeric";
            pxIn.id = "master-party-px-" + m.id;
            pxIn.placeholder = ocT("PX en total");
            etPx.htmlFor = pxIn.id;
            const darB = PM.crear("button", "oc-vida-accion es-principal", ocT("repartir"));
            darB.type = "submit";
            pxForm.append(etPx, pxIn, darB);
            pxForm.addEventListener("submit", (e) => {
                e.preventDefault();
                const n = parseInt(pxIn.value, 10);
                if (!(n > 0)) {
                    pxIn.focus();
                    return;
                }
                pxIn.value = "";
                PM.darPx(n, null, darB);
            });
            panelLista.append(todos, grupo, resultadoG, vivoG, pxForm, resumen, ul);
        }

        // ---- EL EDITOR: una tarjeta con campos por jugador ----
        const lista = PM.crear("ul", "master-party");
        lista.setAttribute("aria-label", ocT("Jugadores (editar)"));
        lista.dataset.queSolo = "si";
        const campo = (pj, i, clave, texto, tipo, clase) => {
            const et = PM.crear("label", "master-party-campo" + (clase ? " " + clase : ""));
            et.appendChild(PM.crear("span", "master-party-et", texto));
            const input = PM.crear("input", "master-party-input");
            input.type = tipo || "number";
            if (input.type === "number") {
                input.inputMode = "numeric";
            } else {
                input.autocomplete = "off";
                input.maxLength = 40;
            }
            input.id = uid + "-" + i + "-" + clave;
            input.value = pj[clave] === undefined ? "" : String(pj[clave]);
            input.addEventListener("change", () => {
                pj[clave] = input.type === "number" ? numero(input.value) : input.value.trim();
                PM.guardar();
                PM.avisarPjs(m.id);
            });
            et.appendChild(input);
            return et;
        };
        const vacio = PM.crear("p", "oc-vacio", ocT("Todavía no hay jugadores."));
        const nuevo = PM.botonDe("oc-vida-accion es-principal", ocT("＋ personaje"), () => {
            PM.nuevoPj({ nombre: "" });
            pintarEditor();
            const inputs = lista.querySelectorAll(".es-nombre input");
            inputs[inputs.length - 1].focus();
        }, ocT("Añadir un jugador"));
        function pintarEditor(foco) {
            lista.replaceChildren(...pjsDe().map((pj, i) => {
                const li = PM.crear("li", "master-party-pj");
                const quien = quienEs(pj, i);
                const arriba = PM.crear("div", "master-party-fila");
                arriba.append(campo(pj, i, "nombre", "nombre", "text", "es-nombre"), campo(pj, i, "raza", "especie", "text", "es-clase"),
                    campo(pj, i, "clase", "clase", "text", "es-clase"), campo(pj, i, "nivel", "nv"), campo(pj, i, "pg", "PG"), campo(pj, i, "pgmax", "máx"), campo(pj, i, "ca", "CA"));
                let seguro = false;
                const quitar = PM.botonDe("master-party-quitar", "✕", () => {
                    if (!seguro) {
                        seguro = true;
                        quitar.setAttribute("aria-label", ocT("¿Seguro? Pulsa otra vez para quitar a {quien}", { quien: quien }));
                        PM.avisar(ocT("Pulsa otra vez para quitar a {quien}.", { quien: quien }));
                        return;
                    }
                    pjsDe().splice(i, 1);
                    PM.guardar();
                    pintarEditor(Math.min(i, pjsDe().length - 1));
                    PM.avisar(ocT("Quitado: {quien}.", { quien: quien }));
                }, ocT("Quitar a {quien}", { quien: quien }));
                arriba.appendChild(quitar);
                const car = PM.crear("div", "master-party-fila");
                CARACTERISTICAS.forEach((k) => {
                    const c = PM.crear("div", "master-party-car");
                    c.appendChild(campo(pj, i, k.toLowerCase(), k, "number", "es-car"));
                    car.appendChild(c);
                });
                li.append(arriba, car);
                return li;
            }));
            vacio.hidden = !!pjsDe().length;
            if (typeof foco === "number") {
                const q = foco >= 0 ? lista.querySelectorAll(".master-party-quitar")[foco] : null;
                (q || nuevo).focus();
            }
        }
        panelEditor.append(lista, vacio, nuevo);
        dentro.append(pestanas, panelLista, panelEditor, panelConjuros);
        // Lo que cambie en otra ventana (una ficha, una importación…), aquí.
        PM.mientrasEste(dentro, "master:pjs", () => {
            if (!dentro.contains(document.activeElement) || panelLista.contains(document.activeElement)) {
                [pintarLista, pintarEditor, pintarConjuros][m.datos.pestana || 0]();
            }
        });
        elegir(typeof m.datos.pestana === "number" ? Math.min(m.datos.pestana, 2) : 0, false);
    }

    Object.assign(PM, { montarParty });
})();
