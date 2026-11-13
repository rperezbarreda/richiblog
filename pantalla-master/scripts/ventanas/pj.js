// =========================================
// LA VENTANA «pj» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // El rasgo de ese nombre (en español o en inglés, sin lo de entre
    // paréntesis); si hay varios (los de cada clase), el de su clase o especie.
    function rasgoDe(lista, nombre, pista) {
        const limpio = (t) => PM.llano(String(t || "").replace(/\s*\([^)]*\)\s*$/, "").replace(/^\d+:\s*/, "").trim());
        const n = limpio(nombre);
        if (!n) {
            return null;
        }
        // (Y por su traducción: un nombre guardado en castellano con la app en otro idioma.)
        const n2 = limpio(window.ocTd(String(nombre || "")));
        const salen = lista.filter((r) => limpio(r.nombre) === n || limpio(r.en) === n || PM.llano(r.nombre) === PM.llano(nombre)
            || limpio(r.nombre) === n2);
        if (salen.length < 2) {
            return salen[0] || null;
        }
        const p = PM.llano(pista || "");
        return salen.find((r) => r.propio) || salen.find((r) => p && PM.llano((r.de || "") + " " + PM.verDato(r.de || "")).split(/[ ,()]+/).some((w) => w.length > 3
            && p.includes(w))) || salen[0];
    }

    // En un texto ya montado, cada nombre en negrita que sea un rasgo o
    // una dote pasa a ser su botón («pista»: la clase y la especie del PJ).
    function enlazarRasgos(raiz, pista) {
        PM.pedir(PM.RASGOS_SRD).then((datos) => {
            const lista = datos.rasgos || [];
            raiz.querySelectorAll("strong").forEach((st) => {
                const r = !st.closest("button") && rasgoDe(lista, st.textContent, pista);
                if (r) {
                    const b = PM.botonDe("master-conjuro-enlace master-rasgo-enlace", st.textContent, () => PM.abrirRasgo(r, b, datos.fuente));
                    b.setAttribute("aria-haspopup", "dialog");
                    st.replaceWith(b);
                }
            });
        }).catch(() => {
            // Sin el compendio: se quedan en negrita.
        });
    }
    const NIVELES_COMP = ["", ocT("competente"), ocT("pericia")];
    // Los tipos de acción (lo de antes de «:» en pj.acciones, en llano) y
    // su título.
    const TIPOS_ACCION = [[/^accion$|^action$/, ocT("🌀 Acciones")], [/adicional|bonus/, ocT("⚡ Acciones adicionales")],
        [/^reacci|^reaction/, ocT("↩️ Reacciones")], [/^(especial|minutos|horas|otras)$/, ocT("✳️ Otras acciones")]];

    // «op.visor»: como el visor de fichas del blog (para el visor de la
    // party): a la izquierda, la tarjeta (nombre, PG, CA, retrato, nivel,
    // características) y un menú de secciones; a la derecha, la sección.
    // Los apartados de un panel (cada título y lo que va debajo hasta el
    // siguiente), plegables: un <details> abierto con el título en su
    // <summary>.
    function plegables(panel) {
        const hijos = Array.from(panel.children);
        let actual = null;
        hijos.forEach((h) => {
            if (h.matches("h3.master-pj-titulo")) {
                actual = PM.crear("details", "master-pj-plegable");
                actual.open = true;
                const resumen = PM.crear("summary");
                panel.insertBefore(actual, h);
                resumen.appendChild(h);
                actual.appendChild(resumen);
            } else if (actual) {
                actual.appendChild(h);
            }
        });
    }

    // Los rasgos de un PJ (una línea cada uno, «- **Nombre** (de dónde)»),
    // por de dónde vienen: especie, clase (cada una), trasfondo, dotes…
    // Lo de entre paréntesis que ya dice el título se quita.
    function rasgosPorOrigen(pj) {
        const grupos = new Map();
        const igual = (a, b) => a && b && PM.llano(a).trim() === PM.llano(b).trim();
        // Lo que no es un rasgo (un párrafo, una aclaración) va con el de
        // antes; si está al principio, en «Otros rasgos».
        let ultimo = null;
        String(pj.rasgos || "").split("\n").forEach((l) => {
            const mt = /^\s*[-*•]\s*\*\*(.+?)\*\*\s*(?:\((.*)\))?\s*$/.exec(l);
            if (!mt) {
                if (l.trim()) {
                    if (!ultimo) {
                        ultimo = [];
                        grupos.set(ocT("⭐ Otros rasgos"), ultimo);
                    }
                    ultimo.push(l);
                }
                return;
            }
            const de = (mt[2] || "").trim();
            const nivel = /^(.*?),\s*((?:nivel|level) \d+)$/i.exec(de);
            const llano = PM.llano(de);
            let g = ocT("⭐ Otros rasgos");
            let resto = "";
            if (nivel) {
                g = ocT("⚔️ Clase: {clase}", { clase: nivel[1] });
                resto = nivel[2];
            } else if (/^(especie|raza|race|species)$/.test(llano) || igual(de, pj.raza)) {
                g = ocT("🧬 Especie");
            } else if (/^(clase|class)$/.test(llano) || igual(de, pj.clase)) {
                g = ocT("⚔️ Clase");
            } else if (/^(trasfondo|background)$/.test(llano) || igual(de, pj.trasfondoNombre)) {
                g = ocT("📜 Trasfondo");
            } else if (/^(dote|dotes|feat)$/.test(llano)) {
                g = ocT("🎖️ Dotes");
            } else if (llano.length > 3 && PM.llano(pj.clase || "").includes(llano)) {
                g = ocT("⚔️ Clase: {clase}", { clase: de });
            } else if (de && llano !== "rasgo") {
                g = "✨ " + de;
            }
            if (!grupos.has(g)) {
                grupos.set(g, []);
            }
            ultimo = grupos.get(g);
            ultimo.push("- **" + mt[1] + "**" + (resto ? " (" + resto + ")" : ""));
        });
        return grupos;
    }

    function montarPj(dentro, m, op) {
        m.datos = m.datos || {};
        const visor = !!(op && op.visor);
        const pj = (PM.todo.pjs || []).find((x) => x.id === m.datos.pj);
        if (!pj) {
            dentro.appendChild(PM.crear("p", "oc-vacio", ocT("Este personaje ya no está en la party de esta campaña.")));
            return;
        }
        PM.normalizarPj(pj);
        // La última vez que se monta aquí manda: lo que llegue tarde de una
        // anterior (la carga de los datos) no la pisa.
        const vez = {};
        dentro.ocMontado = vez;
        const repintar = () => {
            dentro.replaceChildren();
            montarPj(dentro, m, op);
        };
        PM.mientrasEste(dentro, "master:pjs", (e) => {
            if (!(e.detail && e.detail.desde === m.id) && !dentro.querySelector(".master-creador-form")) {
                repintar();
            }
        });
        if (m.datos.editar) {
            delete m.datos.editar;
            PM.guardar();
            editarPj(dentro, m, pj, repintar);
            return;
        }
        dentro.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Cargando…")));
        Promise.all([PM.pedir(PM.CONJUROS_SRD), PM.pedir(PM.TIENDA).catch(() => ({ objetos: [] })),
            PM.pedir(PM.BESTIARIO).catch(() => ({ monstruos: [] }))]).then(([conj, tienda, bestiario]) => {
            if (dentro.ocMontado !== vez) {
                return;
            }
            const srd = {};
            (conj.conjuros || []).forEach((c) => {
                srd[PM.llano(c.nombre)] = c;
            });
            const objetosSrd = {};
            (tienda.objetos || []).forEach((o) => {
                objetosSrd[PM.llano(o.nombre)] = o;
            });
            const apuntes = pj.apuntes;
            const uid = "master-pj-" + m.id;
            const quien = pj.nombre || "PJ";
            const car = (k) => PM.numPj(pj[k]);
            const prof = PM.competenciaPj(pj);
            let espera = 0;
            const cambiado = () => {
                PM.guardar();
                PM.avisarPjs(m.id);
            };
            const area = (obj, clave, texto, filas, alCambiar) => {
                const caja = PM.crear("div", "master-campo");
                const et = PM.crear("label", "oc-dados-etiqueta", texto);
                const t = PM.crear("textarea", "oc-notas-texto es-corta");
                t.id = uid + "-" + clave;
                et.htmlFor = t.id;
                t.rows = filas || 4;
                t.value = obj[clave] || "";
                t.addEventListener("input", () => {
                    obj[clave] = t.value;
                    clearTimeout(espera);
                    espera = setTimeout(PM.guardar, 400);
                    if (alCambiar) {
                        alCambiar();
                    }
                });
                caja.append(et, t);
                return caja;
            };
            const titulo = (panel, texto) => panel.appendChild(PM.crear("h3", "master-pj-titulo", texto));
            const listaDe = (cosas, etiqueta) => {
                const ul = PM.crear("ul", "master-pj-lista");
                if (etiqueta) {
                    ul.setAttribute("aria-label", etiqueta);
                }
                cosas.forEach((x) => {
                    const li = PM.crear("li");
                    li.append(...[].concat(x));
                    ul.appendChild(li);
                });
                return ul;
            };
            const datosDe = (filas) => {
                const dl = PM.crear("dl", "master-pj-datos");
                filas.filter(([, v]) => v !== null && v !== undefined && v !== "").forEach(([k, v]) => {
                    const dd = PM.crear("dd");
                    dd.append(...[].concat(typeof v === "string" || typeof v === "number" ? String(v) : v));
                    dl.append(PM.crear("dt", "", k), dd);
                });
                return dl;
            };
            const texto = (t) => {
                const x = PM.markdown(t || "");
                if (window.ocDadosEnTexto) {
                    window.ocDadosEnTexto(x);
                }
                PM.enlazarConjuros(x);
                return x;
            };

            // CABECERA: quién es, sus botones y lo que no hay que olvidar.
            const cabeza = PM.crear("div", "master-pj-cabeza");
            const foto = PM.fotoPj(pj, "master-pj-foto", "");
            if (foto) {
                const verFoto = PM.botonDe("master-pj-foto-boton", "", () => {
                    const grande = PM.fotoPj(pj, "master-pj-foto-grande", ocT("Retrato de {quien}", { quien: quien }));
                    window.ocVentana.abrir({ titulo: quien, cuerpo: grande, vuelta: verFoto });
                }, ocT("Ver la foto de {quien}", { quien: quien }));
                verFoto.appendChild(foto);
                cabeza.appendChild(verFoto);
            }
            const queEs = [pj.raza, pj.clase, PM.numPj(pj.nivel) ? ocT("nivel {numPj}", { numPj: PM.numPj(pj.nivel) }) : "", pj.trasfondoNombre, pj.alineamiento]
                .filter(Boolean).join(" · ");
            cabeza.appendChild(PM.crear("p", "master-pj-que", queEs || ocT("Sin raza ni clase todavía: pulsa «✎ editar ficha».")));
            const botones = PM.crear("div", "master-creador-barra");
            const editarB = PM.botonDe("oc-vida-accion es-principal", ocT("✎ editar ficha"), () => editarPj(dentro, m, pj, repintar),
                ocT("Editar la ficha de {quien}", { quien: quien }));
            const ddb = PM.botonDe("oc-vida-accion", ocT("📥 actualizar"), () => PM.abrirImportarPj(ddb, pj),
                ocT("Actualizar a {quien} desde D&D Beyond, Nivel20 o Foundry VTT", { quien: quien }));
            ddb.setAttribute("aria-haspopup", "dialog");
            if (pj.importadoDe) {
                ddb.title = ocT("Se trajo de {url}: «📥 actualizar» la vuelve a traer de ahí.", { url: pj.importadoDe });
            }
            const ini = PM.botonDe("oc-vida-accion", ocT("＋ iniciativa"), () => {
                const n = PM.meterEnIniciativa(PM.iniDePj(pj, quien));
                PM.avisar(n ? ocT("A la iniciativa: {n}.", { n: n }) : ocT("{quien} ya está en la iniciativa.", { quien: quien }));
            }, ocT("Poner a {quien} en la iniciativa (tira su iniciativa)", { quien: quien }));
            botones.append(editarB, ddb, ini);
            cabeza.appendChild(botones);
            const recordar = PM.crear("p", "master-pj-recordar");
            const pintarRecordar = () => {
                recordar.replaceChildren(PM.crear("strong", "", ocT("😨 Miedos: ")), document.createTextNode(apuntes.miedos || ""));
                recordar.hidden = !(apuntes.miedos || "").trim();
            };
            pintarRecordar();
            cabeza.appendChild(recordar);
            // A 0 PG: sus salvaciones de muerte (las mismas que en la
            // iniciativa: van y vienen con pj.muerte).
            const muerteSitio = PM.crear("div", "master-pj-muerte");
            const pintarMuerte = () => {
                if (PM.numPj(pj.pg) !== 0) {
                    delete pj.muerte;
                    muerteSitio.replaceChildren();
                    muerteSitio.hidden = true;
                    return;
                }
                muerteSitio.hidden = false;
                const estado = Object.assign({ exitos: 0, fallos: 0 }, pj.muerte || {});
                muerteSitio.replaceChildren(window.ocTurnos.cajaMuerte(estado, quien, (e, revive) => {
                    if (revive) {
                        pj.pg = 1;
                        delete pj.muerte;
                        cambiado();
                        repintar();
                        return;
                    }
                    pj.muerte = { exitos: e.exitos || 0, fallos: e.fallos || 0 };
                    cambiado();
                }, "pj-" + m.id));
            };
            pintarMuerte();
            if (!visor) {
                cabeza.appendChild(muerteSitio);
            }

            // 1. FICHA: lo de combate, las características (con su
            // salvación), las habilidades y las pasivas.
            const panelFicha = PM.crear("div");
            const pgCaja = PM.crear("span", "master-pj-pg");
            const pgInput = PM.crear("input", "master-party-input");
            pgInput.type = "number";
            pgInput.inputMode = "numeric";
            pgInput.value = PM.numPj(pj.pg) === null ? (PM.numPj(pj.pgmax) === null ? "" : PM.numPj(pj.pgmax)) : PM.numPj(pj.pg);
            pgInput.setAttribute("aria-label", ocT("Puntos de golpe actuales de {quien}", { quien: quien }));
            pgInput.addEventListener("change", () => {
                pj.pg = PM.numPj(pgInput.value);
                pintarMuerte();
                cambiado();
            });
            pgCaja.append(pgInput, document.createTextNode(PM.numPj(pj.pgmax) !== null ? " / " + PM.numPj(pj.pgmax) : ""));
            const d = car("des");
            panelFicha.appendChild(datosDe([[ocT("CA"), pj.ca], [ocT("PG"), visor ? null : pgCaja], [ocT("PG temporales"), PM.numPj(pj.pgtemp) || ""],
                [ocT("Iniciativa"), d !== null ? PM.dadoPj(PM.modDe(d), ocT("Iniciativa de {quien}", { quien: quien })) : ""], [ocT("Velocidad"), pj.velocidad],
                [ocT("Competencia"), PM.signo(prof)], [ocT("Dados de golpe"), pj.dadosGolpe]]));
            const cars = PM.crear("ul", "master-pj-caracteristicas");
            cars.setAttribute("aria-label", ocT("Características y salvaciones de {quien}", { quien: quien }));
            PM.SALVACIONES_PJ.forEach((k) => {
                const n = car(k);
                if (n === null) {
                    return;
                }
                const comp = pj.salvaciones.includes(k);
                const li = PM.crear("li", "master-pj-c" + (comp ? " es-competente" : ""));
                li.append(PM.crear("span", "master-party-et", PM.CAR_VER[k]), PM.crear("span", "master-party-valor", String(n)),
                    PM.dadoPj(PM.modDe(n), ocT("{n} de {quien}", { n: PM.CAR_VER[k], quien: quien })));
                const s = PM.crear("span", "master-pj-salv");
                s.append(PM.crear("span", "", ocT("{n}salvación ", { n: comp ? "● " : "○ " })), PM.dadoPj(PM.modDe(n) + (comp ? prof : 0),
                    ocT("Salvación de {n} de {quien}", { n: PM.CAR_VER[k], quien: quien })));
                if (comp) {
                    s.title = ocT("Competente en la salvación");
                }
                li.appendChild(s);
                cars.appendChild(li);
            });
            panelFicha.appendChild(cars);
            // En el visor, las habilidades van en su sección.
            const panelHab = visor ? PM.crear("div") : panelFicha;
            titulo(panelHab, ocT("🎯 Habilidades"));
            panelHab.appendChild(listaDe(PM.HABILIDADES_PJ.filter(([, k]) => car(k) !== null).map(([nombre, k]) => {
                const nv = pj.habilidades[nombre] || 0;
                return [PM.crear("span", "master-pj-marca-comp", nv === 2 ? "◆" : nv === 1 ? "●" : "○"),
                    PM.crear("span", "", PM.verHab(nombre) + " (" + PM.CAR_ABR[k] + ")" + (nv ? " · " + NIVELES_COMP[nv] : "")),
                    PM.dadoPj(PM.bonoHabPj(pj, nombre), ocT("{nombre} de {quien}", { nombre: PM.verHab(nombre), quien: quien }))];
            }), ocT("Habilidades de {quien}", { quien: quien })));
            panelHab.appendChild(datosDe([[ocT("👁️ Percepción pasiva"), PM.pasivaPj(pj, "per")], [ocT("🔍 Investigación pasiva"),
                PM.pasivaPj(pj, "inv")], [ocT("💭 Perspicacia pasiva"), PM.pasivaPj(pj, "persp")], [ocT("Sentidos"), pj.sentidos],
                [ocT("Defensas"), pj.defensas]]));

            // 2. COMBATE: los ataques (bono y daño, con sus dados) y las
            // acciones.
            const panelCombate = PM.crear("div");
            if (pj.ataques.length) {
                const tabla = PM.crear("table", "master-informe-tabla master-pj-ataques");
                tabla.appendChild(PM.crear("caption", "visually-hidden", ocT("Ataques de {quien}", { quien: quien })));
                const cab = PM.crear("tr");
                [ocT("Ataque"), ocT("Bono"), ocT("Daño")].forEach((t) => {
                    const th = PM.crear("th", "", t);
                    th.scope = "col";
                    cab.appendChild(th);
                });
                const thead = PM.crear("thead");
                thead.appendChild(cab);
                const tbody = PM.crear("tbody");
                pj.ataques.forEach((a) => {
                    const tr = PM.crear("tr");
                    const th = PM.crear("th", "", a.nombre || "—");
                    th.scope = "row";
                    const b = PM.numPj(String(a.bono || "").replace("−", "-"));
                    const tdB = PM.crear("td");
                    tdB.appendChild(b === null ? document.createTextNode(a.bono || "") : PM.dadoPj(b, ocT("{nombre} · ataque", { nombre: a.nombre })));
                    const tdD = PM.crear("td");
                    const dm = /^(\d+d\d+(?:\s*[+−-]\s*\d+)?)\s*(.*)$/.exec(String(a.dano || "").trim());
                    if (dm && window.ocDadoBoton) {
                        tdD.append(window.ocDadoBoton(dm[1], dm[1].replace(/\s+/g, "").replace("−", "-"), ocT("{nombre} · daño", { nombre: a.nombre })),
                            document.createTextNode(dm[2] ? " " + dm[2] : ""));
                    } else {
                        tdD.textContent = a.dano || "";
                    }
                    tr.append(th, tdB, tdD);
                    tbody.appendChild(tr);
                });
                tabla.append(thead, tbody);
                panelCombate.appendChild(tabla);
            } else {
                panelCombate.appendChild(PM.crear("p", "oc-vacio", ocT("Sin ataques apuntados (se ponen en «✎ editar ficha»).")));
            }
            // Las acciones, por su tipo («Acción adicional: Nombre (usos)»):
            // cada una se abre (el rasgo del SRD o del compendio con ese
            // nombre, o lo que se trajo al importar).
            if (pj.acciones.length) {
                const grupos = new Map(TIPOS_ACCION.map(([, t]) => [t, []]));
                pj.acciones.forEach((a) => {
                    const mt = /^([^:]{1,30}):\s*(.+)$/.exec(a);
                    const tipo = mt && TIPOS_ACCION.find(([re]) => re.test(PM.llano(mt[1])));
                    const g = tipo ? tipo[1] : ocT("✳️ Otras acciones");
                    if (!grupos.has(g)) {
                        grupos.set(g, []);
                    }
                    grupos.get(g).push({ linea: a, nombre: tipo ? mt[2] : a });
                });
                grupos.forEach((lista, g) => {
                    if (!lista.length) {
                        return;
                    }
                    titulo(panelCombate, g);
                    panelCombate.appendChild(listaDe(lista.map((x) => {
                        const b = PM.botonDe("master-conjuro-enlace master-rasgo-enlace", x.nombre, () => abrirAccion(x, b));
                        b.setAttribute("aria-haspopup", "dialog");
                        return b;
                    }), ocT("{tipo} de {quien}", { tipo: g.replace(/^\S+\s/, ""), quien: quien })));
                });
            }
            function abrirAccion(x, vuelta) {
                const nombre = x.nombre.replace(/\s*\([^)]*\)\s*$/, "");
                const usos = (/\(([^)]*)\)\s*$/.exec(x.nombre) || [])[1] || "";
                PM.pedir(PM.RASGOS_SRD).catch(() => ({ rasgos: [] })).then((datos) => {
                    const r = rasgoDe(datos.rasgos || [], nombre, (pj.clase || "") + " " + (pj.raza || ""));
                    const suyo = (pj.accionesDe || {})[x.linea];
                    if (r && !suyo) {
                        PM.abrirRasgo(r, vuelta, datos.fuente);
                        return;
                    }
                    const cuerpo = PM.crear("div", "master-pj-accion");
                    cuerpo.appendChild(datosDe([[ocT("Tipo"), x.linea === x.nombre ? "" : x.linea.slice(0, x.linea.indexOf(":"))],
                        [ocT("Usos"), usos]]));
                    if (suyo) {
                        cuerpo.appendChild(texto(suyo));
                    } else if (r) {
                        cuerpo.appendChild(texto(r.texto || ""));
                    } else {
                        cuerpo.appendChild(PM.crear("p", "oc-vacio", ocT("No hay más detalle: se trajo sólo el nombre. Puedes apuntarlo en «✎ editar ficha» o crear el rasgo en el compendio.")));
                    }
                    window.ocVentana.abrir({ titulo: nombre, cuerpo, vuelta });
                });
            }
            if ((pj.armasTxt || "").trim()) {
                panelCombate.appendChild(area(pj, "armasTxt", ocT("apuntes de armas (de antes)"), 3));
            }

            // 3. CONJUROS: aptitud, CD y ataque; los espacios (casillas que
            // se gastan) y la lista por nivel; cada uno se abre.
            const panelConj = PM.crear("div");
            const aptitud = pj.aptitud;
            if (aptitud && car(aptitud) !== null) {
                const bono = PM.modDe(car(aptitud)) + prof;
                panelConj.appendChild(datosDe([[ocT("Aptitud"), PM.CAR_VER[aptitud] || aptitud], [ocT("CD de salvación"), 8 + bono],
                    [ocT("Ataque de conjuro"), PM.dadoPj(bono, ocT("Ataque de conjuro de {quien}", { quien: quien }))]]));
            }
            const niveles = Object.keys(pj.espacios).filter((n) => (PM.numPj(pj.espacios[n].max) || 0) > 0).sort((a, b) => a - b);
            if (niveles.length) {
                titulo(panelConj, ocT("🔮 Espacios de conjuro"));
                const ul = PM.crear("ul", "master-pj-espacios");
                ul.setAttribute("aria-label", ocT("Espacios de conjuro de {quien}", { quien: quien }));
                niveles.forEach((n) => {
                    const e = pj.espacios[n];
                    const li = PM.crear("li");
                    const grupo = PM.crear("span", "master-pj-casillas");
                    grupo.setAttribute("role", "group");
                    grupo.setAttribute("aria-label", ocT("Nivel {n}", { n: n }));
                    for (let i = 0; i < PM.numPj(e.max); i++) {
                        const c = PM.crear("input");
                        c.type = "checkbox";
                        c.checked = i < (PM.numPj(e.usados) || 0);
                        c.setAttribute("aria-label", ocT("Espacio {n} de nivel {n2}{n3}", { n: i + 1, n2: n, n3: c.checked ? ocT(", gastado") : "" }));
                        c.addEventListener("change", () => {
                            e.usados = Array.from(grupo.querySelectorAll("input")).filter((x) => x.checked).length;
                            c.setAttribute("aria-label", ocT("Espacio {n} de nivel {n2}{n3}", { n: i + 1, n2: n, n3: c.checked ? ocT(", gastado") : "" }));
                            PM.guardar();
                        });
                        grupo.appendChild(c);
                    }
                    li.append(PM.crear("span", "master-pj-marca", ocT("nivel {n}", { n: n })), grupo);
                    ul.appendChild(li);
                });
                const descanso = PM.botonDe("oc-vida-accion", ocT("↺ descanso largo"), () => {
                    niveles.forEach((n) => {
                        pj.espacios[n].usados = 0;
                    });
                    PM.guardar();
                    ul.querySelectorAll("input").forEach((c) => {
                        c.checked = false;
                    });
                    PM.avisar(ocT("Espacios de conjuro recuperados."));
                }, ocT("Recuperar todos los espacios de conjuro de {quien}", { quien: quien }));
                panelConj.append(ul, descanso);
            }
            const listaConj = PM.crear("div");
            const nuevoConj = PM.crear("input", "oc-dados-texto");
            const pintarConj = () => {
                listaConj.replaceChildren();
                const todos = PM.conjurosPj(pj, srd);
                if (!todos.length) {
                    listaConj.appendChild(PM.crear("p", "oc-vacio", ocT("No tiene conjuros apuntados.")));
                }
                const nvs = Array.from(new Set(todos.map((c) => c.nivel))).sort((a, b) => (a === null) - (b === null) || a - b);
                nvs.forEach((n) => {
                    titulo(listaConj, n === null ? ocT("Otros") : n === 0 ? ocT("Trucos") : ocT("Nivel {n}", { n: n })).dataset.nivel = String(n);
                    listaConj.appendChild(listaDe(todos.filter((c) => c.nivel === n).map((c) => [PM.conjuroPj(c.nombre, srd, conj.fuente),
                        PM.botonDe("master-party-quitar", "✕", () => {
                            pj.conjuros = pj.conjuros.filter((x) => x !== c.nombre);
                            PM.guardar();
                            pintarConj();
                            PM.avisar(ocT("Quitado: {nombre}.", { nombre: c.nombre }));
                            nuevoConj.focus();
                        }, ocT("Quitar {nombre}", { nombre: c.nombre }))]), ocT("{n} de {quien}", { n: n === null ? ocT("Otros conjuros") : n === 0 ? ocT("Trucos") : ocT("Conjuros de nivel {n}", { n: n }), quien: quien })));
                });
                // Cada nivel, plegable; el que se cierra sigue cerrado al
                // añadir o quitar conjuros.
                plegables(listaConj);
                listaConj.querySelectorAll(".master-pj-plegable").forEach((d) => {
                    const n = d.querySelector(".master-pj-titulo").dataset.nivel;
                    d.open = !conjCerrados.has(n);
                    d.addEventListener("toggle", () => {
                        conjCerrados[d.open ? "delete" : "add"](n);
                    });
                });
            };
            const conjCerrados = new Set();
            const form = PM.crear("form", "master-pj-anadir");
            const et = PM.crear("label", "oc-dados-etiqueta", ocT("añadir un conjuro (los del SRD y los tuyos salen solos)"));
            nuevoConj.id = uid + "-conj";
            et.htmlFor = nuevoConj.id;
            nuevoConj.autocomplete = "off";
            const dl = PM.crear("datalist");
            dl.id = uid + "-conj-lista";
            (conj.conjuros || []).forEach((c) => {
                const o = PM.crear("option");
                o.value = c.nombre;
                dl.appendChild(o);
            });
            nuevoConj.setAttribute("list", dl.id);
            const anadirB = PM.crear("button", "oc-vida-accion", ocT("＋ añadir"));
            anadirB.type = "submit";
            form.append(et, nuevoConj, dl, anadirB);
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                const v = nuevoConj.value.trim();
                if (!v) {
                    return;
                }
                const c = srd[PM.llano(v)];
                pj.conjuros = pj.conjuros.concat(c ? c.nombre : v);
                nuevoConj.value = "";
                PM.guardar();
                pintarConj();
                PM.avisar(ocT("Añadido: {n}.", { n: c ? c.nombre : v }));
            });
            panelConj.append(form, listaConj);
            pintarConj();

            // 4. INVENTARIO: lo suyo (lo del SRD se abre) y su dinero; cada
            // cosa se puede pasar al inventario común de la party.
            const panelInv = PM.crear("div");
            const listaInv = PM.crear("ul", "master-pj-lista");
            listaInv.setAttribute("aria-label", ocT("Inventario de {quien}", { quien: quien }));
            const pintarInv = () => {
                listaInv.replaceChildren(...pj.objetos.map((o, i) => {
                    const li = PM.crear("li");
                    const srdO = PM.deSrd(objetosSrd, o.nombre);
                    const nombre = srdO ? PM.botonDe("master-conjuro-boton", o.nombre, () => PM.abrirObjeto(srdO, li.firstChild, tienda.fuente))
                        : PM.crear("span", "", o.nombre);
                    li.append(nombre, PM.crear("span", "master-pj-marca", ocT("×{n}{n2}", { n: PM.numPj(o.cant) || 1, n2: o.equipado ? ocT(" · equipado") : "" })));
                    li.appendChild(PM.botonDe("master-party-quitar", ocT("→ party"), () => {
                        const inv = PM.inventarioParty();
                        const ya = inv.objetos.find((x) => PM.llano(x.nombre) === PM.llano(o.nombre));
                        if (ya) {
                            ya.cant = (PM.numPj(ya.cant) || 1) + (PM.numPj(o.cant) || 1);
                        } else {
                            inv.objetos.push({ id: PM.nuevoIdPj(), nombre: o.nombre, cant: PM.numPj(o.cant) || 1 });
                        }
                        pj.objetos.splice(i, 1);
                        PM.guardar();
                        PM.avisarPjs("");
                        PM.avisar(o.nombre + ocT(": al inventario de la party."));
                    }, ocT("Pasar {nombre} al inventario común de la party", { nombre: o.nombre })));
                    return li;
                }));
                if (!pj.objetos.length) {
                    listaInv.appendChild(PM.crear("li", "oc-vacio", ocT("Sin objetos apuntados (se ponen en «✎ editar ficha»).")));
                }
            };
            pintarInv();
            const monedas = PM.MONEDAS_PJ.filter(([k]) => PM.numPj(pj.dinero[k])).map(([k, abr]) => PM.numPj(pj.dinero[k]) + " " + abr);
            panelInv.append(listaInv, datosDe([[ocT("💰 Dinero"), monedas.join(", ") || "nada"]]));
            if ((pj.objetosTxt || "").trim()) {
                panelInv.appendChild(area(pj, "objetosTxt", ocT("apuntes de objetos (de antes)"), 3));
            }

            // 5. RASGOS: rasgos y dotes, competencias e idiomas.
            const panelRasgos = PM.crear("div");
            const exportarR = PM.botonDe("oc-vida-accion", ocT("⬇ exportar rasgos (.json)"), () => {
                PM.pedir(PM.RASGOS_SRD).catch(() => ({ rasgos: [] })).then((datos) => {
                    const pista = (pj.clase || "") + " " + (pj.raza || "");
                    const lineas = String(pj.rasgos || "").split("\n").map((l) => l.trim()).filter(Boolean);
                    const rasgos = lineas.map((l) => {
                        const m2 = /^[-*•]?\s*(?:\*\*(.+?)\*\*|([^(]+?))\s*(?:\((.*)\))?\s*$/.exec(l) || [];
                        const nombre = (m2[1] || m2[2] || l).trim();
                        const r = rasgoDe(datos.rasgos || [], nombre, pista);
                        const o = { nombre, de: (m2[3] || "").trim() };
                        if (r) {
                            Object.assign(o, { tipo: r.tipo, en: r.en, texto: r.texto, fuente: r.propio ? PM.fuenteDe(r) : ocT("SRD 5.2 (CC BY 4.0)") });
                        }
                        return o;
                    });
                    PM.bajarJson({ personaje: pj.nombreCompleto || pj.nombre, clase: pj.clase || "", especie: pj.raza || "",
                        nivel: PM.numPj(pj.nivel), rasgos, competencias: pj.competencias || "", idiomas: pj.idiomas || "" },
                    "rasgos-" + PM.llano(pj.nombre || "pj").replace(/[^a-z0-9]+/g, "-") + ".json");
                    PM.avisar(ocT("Bajados los rasgos de {quien} ({n}).", { quien: quien, n: rasgos.length }));
                });
            }, ocT("Bajar los rasgos y dotes de {quien} a un archivo .json", { quien: quien }));
            const barraR = PM.crear("div", "master-creador-barra");
            barraR.appendChild(exportarR);
            if ((pj.rasgos || "").trim()) {
                panelRasgos.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Pulsa un rasgo para leerlo (los del SRD y los tuyos).")));
                rasgosPorOrigen(pj).forEach((lineas, g) => {
                    titulo(panelRasgos, g);
                    const tr = texto(lineas.join("\n"));
                    enlazarRasgos(tr, (pj.clase || "") + " " + (pj.raza || ""));
                    panelRasgos.appendChild(tr);
                });
                panelRasgos.appendChild(barraR);
            } else {
                panelRasgos.appendChild(PM.crear("p", "oc-vacio", ocT("Sin rasgos apuntados.")));
            }
            if (pj.competencias || pj.idiomas) {
                titulo(panelRasgos, ocT("🛠️ Competencias e idiomas"));
            }
            panelRasgos.appendChild(datosDe([[ocT("Competencias"), pj.competencias], [ocT("Idiomas"), pj.idiomas]]));

            // 6. HISTORIA: primero su historia; luego cómo es, sus secretos y
            // lo extra (lugares, su gente…). Se escribe aquí mismo.
            const panelHist = PM.crear("div");
            const comoEs = [area(pj, "aspecto", ocT("aspecto (cómo es)"), 3), area(pj, "personalidad", ocT("personalidad"), 2),
                area(pj, "ideales", ocT("ideales"), 2), area(pj, "vinculos", ocT("vínculos"), 2), area(pj, "defectos", ocT("defectos"), 2)];
            if ((pj.trasfondo || "").trim()) {
                comoEs.push(area(pj, "trasfondo", ocT("trasfondo (de antes)"), 3));
            }
            titulo(panelHist, ocT("📜 Su historia"));
            panelHist.appendChild(area(pj, "historia", ocT("su historia"), 8));
            titulo(panelHist, ocT("🎭 Cómo es"));
            panelHist.append(...comoEs);
            titulo(panelHist, ocT("🤫 Secretos"));
            panelHist.appendChild(area(pj, "secretos", ocT("sus secretos (lo que esconde)"), 4));
            titulo(panelHist, ocT("📎 Extra"));
            panelHist.appendChild(area(pj, "extra", ocT("extra: lugares, su gente, ganchos, lo que quieras"), 8));

            // 7. PNJ Y NOTAS: la gente que conoce y lo que apunta el jugador.
            const panelPnj = PM.crear("div");
            const listaPnj = PM.crear("ul", "master-pj-pnjs");
            listaPnj.setAttribute("aria-label", ocT("PNJ que conoce {quien}", { quien: quien }));
            const formPnj = PM.crear("form", "master-pj-anadir");
            const pnjNombre = PM.crear("input", "oc-dados-texto");
            const pnjRel = PM.crear("input", "oc-dados-texto");
            const pintarPnj = () => {
                listaPnj.replaceChildren(...pj.pnjs.map((p, i) => {
                    const li = PM.crear("li");
                    const cab2 = PM.crear("p", "master-pj-pnj");
                    cab2.append(PM.crear("strong", "", p.nombre), document.createTextNode(p.relacion ? " · " + p.relacion : ""));
                    const nota = PM.crear("textarea", "oc-notas-texto es-corta");
                    nota.rows = 2;
                    nota.value = p.nota || "";
                    nota.setAttribute("aria-label", ocT("Nota sobre {nombre}", { nombre: p.nombre }));
                    nota.addEventListener("input", () => {
                        p.nota = nota.value;
                        clearTimeout(espera);
                        espera = setTimeout(PM.guardar, 400);
                    });
                    const q = PM.botonDe("master-party-quitar", "✕", () => {
                        pj.pnjs.splice(i, 1);
                        PM.guardar();
                        pintarPnj();
                        pnjNombre.focus();
                        PM.avisar(ocT("Quitado: {nombre}.", { nombre: p.nombre }));
                    }, ocT("Quitar a {nombre}", { nombre: p.nombre }));
                    cab2.appendChild(q);
                    li.append(cab2, nota);
                    return li;
                }));
            };
            [[pnjNombre, ocT("nombre del PNJ")], [pnjRel, ocT("quién es para él (amigo, rival, deudor…)")]].forEach(([x, t], i) => {
                x.id = uid + "-pnj" + i;
                x.autocomplete = "off";
                const e2 = PM.crear("label", "oc-dados-etiqueta", t);
                e2.htmlFor = x.id;
                formPnj.append(e2, x);
            });
            const pnjB = PM.crear("button", "oc-vida-accion", ocT("＋ PNJ"));
            pnjB.type = "submit";
            formPnj.appendChild(pnjB);
            formPnj.addEventListener("submit", (e) => {
                e.preventDefault();
                if (!pnjNombre.value.trim()) {
                    pnjNombre.focus();
                    return;
                }
                pj.pnjs.push({ nombre: pnjNombre.value.trim(), relacion: pnjRel.value.trim(), nota: "" });
                pnjNombre.value = "";
                pnjRel.value = "";
                PM.guardar();
                pintarPnj();
                pnjNombre.focus();
            });
            pintarPnj();
            titulo(panelPnj, ocT("👥 PNJ que conoce"));
            panelPnj.append(listaPnj, formPnj);
            titulo(panelPnj, ocT("📝 Notas"));
            panelPnj.appendChild(area(pj, "notas", ocT("notas del personaje (misiones, pistas, lo que recuerda…)"), 6));

            // 8. MÁSTER: lo que sólo ve el máster.
            const panelMaster = PM.crear("div");
            panelMaster.append(area(apuntes, "miedos", ocT("miedos (salen arriba, en todas las pestañas)"), 2, pintarRecordar),
                area(apuntes, "secretos", ocT("secretos (sólo para el máster)"), 3), area(apuntes, "ganchos", ocT("ganchos para la historia"), 3),
                area(apuntes, "relaciones", ocT("relaciones (con otros PJ, facciones…)"), 3), area(apuntes, "deudas",
                    ocT("deudas, promesas y rencores"), 2), area(apuntes, "notas", ocT("otras notas"), 3));

            // 9. CRIATURAS: sus familiares, compañeros animales, monturas…
            // Con un monstruo del bestiario, su perfil; si no, su nombre y
            // lo que se apunte.
            const panelCriaturas = PM.crear("div");
            const listaCri = PM.crear("div", "master-pj-criaturas");
            const bichos = bestiario.monstruos || [];
            const bichoDe = (cr) => cr.bicho && bichos.find((b) => b.en === cr.bicho || PM.llano(b.nombre) === PM.llano(cr.bicho));
            const pintarCri = () => {
                listaCri.replaceChildren(...pj.criaturas.map((cr, i) => {
                    const b = bichoDe(cr);
                    const caja = PM.crear("details", "master-pj-criatura");
                    caja.open = !!cr.abierta;
                    caja.addEventListener("toggle", () => {
                        cr.abierta = caja.open;
                        PM.guardar();
                    });
                    caja.appendChild(PM.crear("summary", "", "🐾 " + (cr.nombre || "criatura") + (b && PM.llano(b.nombre) !== PM.llano(cr.nombre || "")
                        ? " (" + b.nombre + ")" : "")));
                    if (b) {
                        const guardado = { usos: cr.usos || {}, pestana: 0, parte: 0, guardar() {
                            cr.usos = guardado.usos;
                            PM.guardar();
                        } };
                        caja.appendChild(PM.perfil(b, bestiario.fuente, null, guardado));
                    }
                    caja.appendChild(area(cr, "notas", ocT("notas sobre {n}{n2}", { n: cr.nombre || ocT("la criatura"), n2: b ? "" : ocT(" (su perfil, si no está en el bestiario)") }),
                        b ? 2 : 5));
                    caja.appendChild(PM.botonDe("oc-vida-accion", ocT("✕ quitar"), () => {
                        pj.criaturas.splice(i, 1);
                        PM.guardar();
                        pintarCri();
                        criNombre.focus();
                        PM.avisar(ocT("Quitada: {n}.", { n: cr.nombre || ocT("la criatura") }));
                    }, ocT("Quitar a {n}", { n: cr.nombre || ocT("la criatura") })));
                    return caja;
                }));
                if (!pj.criaturas.length) {
                    listaCri.appendChild(PM.crear("p", "oc-vacio", ocT("Sin criaturas (familiares, compañeros animales, monturas…).")));
                }
            };
            const formCri = PM.crear("form", "master-pj-anadir");
            const criNombre = PM.crear("input", "oc-dados-texto");
            const criBicho = PM.crear("input", "oc-dados-texto");
            const dlBichos = PM.crear("datalist");
            dlBichos.id = uid + "-bichos";
            bichos.forEach((b) => {
                const o = PM.crear("option");
                o.value = b.nombre;
                dlBichos.appendChild(o);
            });
            criBicho.setAttribute("list", dlBichos.id);
            [[criNombre, ocT("nombre (Mita, Relámpago…)")], [criBicho, ocT("qué es, del bestiario (lechuza, caballo de monta…; si no está, vacío)")]]
                .forEach(([x, t], i) => {
                    x.id = uid + "-cri" + i;
                    x.autocomplete = "off";
                    const e2 = PM.crear("label", "oc-dados-etiqueta", t);
                    e2.htmlFor = x.id;
                    formCri.append(e2, x);
                });
            const criB = PM.crear("button", "oc-vida-accion", ocT("＋ criatura"));
            criB.type = "submit";
            formCri.append(dlBichos, criB);
            formCri.addEventListener("submit", (e) => {
                e.preventDefault();
                const que = criBicho.value.trim();
                const b = que && bichos.find((x) => PM.llano(x.nombre) === PM.llano(que) || PM.llano(x.en || "") === PM.llano(que));
                const nombre = criNombre.value.trim() || (b ? b.nombre : que);
                if (!nombre) {
                    criNombre.focus();
                    return;
                }
                pj.criaturas.push({ nombre, bicho: b ? b.en || b.nombre : "", notas: b || !que ? "" : que, abierta: true });
                criNombre.value = "";
                criBicho.value = "";
                PM.guardar();
                pintarCri();
                PM.avisar(ocT("Añadida: {nombre}{n}", { nombre: nombre, n: b ? " (" + b.nombre + ")." : "." }));
            });
            panelCriaturas.append(listaCri, formCri);
            pintarCri();

            // 10. IMÁGENES: las suyas (se guardan con lo demás, como los
            // documentos), cada una con su descripción.
            const panelImg = PM.crear("div");
            const listaImg = PM.crear("ul", "master-pj-imagenes");
            listaImg.setAttribute("aria-label", ocT("Imágenes de {quien}", { quien: quien }));
            const subirImg = PM.crear("input");
            subirImg.type = "file";
            subirImg.accept = "image/*";
            subirImg.multiple = true;
            subirImg.hidden = true;
            const pintarImg = () => {
                listaImg.replaceChildren(...pj.imagenes.map((im, i) => {
                    const li = PM.crear("li");
                    const img = PM.crear("img");
                    img.alt = im.titulo || "";
                    img.decoding = "async";
                    PM.imagenMusica(im.archivo).then((u) => {
                        if (u) {
                            img.src = u;
                        }
                    });
                    const ver = PM.botonDe("master-pj-foto-boton", "", () => {
                        const grande = PM.crear("img", "master-pj-foto-grande");
                        grande.alt = im.titulo || "";
                        grande.src = img.src;
                        window.ocVentana.abrir({ titulo: im.titulo || "imagen", cuerpo: grande, vuelta: ver });
                    }, ocT("Ver en grande: {n}", { n: im.titulo || ocT("imagen {n}", { n: i + 1 }) }));
                    ver.appendChild(img);
                    const desc = PM.crear("input", "oc-dados-texto");
                    desc.value = im.titulo || "";
                    desc.placeholder = ocT("qué se ve");
                    desc.setAttribute("aria-label", ocT("Descripción de la imagen {n}", { n: i + 1 }));
                    desc.addEventListener("input", () => {
                        im.titulo = desc.value;
                        img.alt = desc.value;
                        clearTimeout(espera);
                        espera = setTimeout(PM.guardar, 400);
                    });
                    const q = PM.botonDe("master-party-quitar", "✕", () => {
                        pj.imagenes.splice(i, 1);
                        PM.archivoBorrar(im.archivo);
                        PM.guardar();
                        pintarImg();
                        PM.avisar(ocT("Imagen quitada."));
                        botonImg.focus();
                    }, ocT("Quitar la imagen {n}", { n: im.titulo || i + 1 }));
                    li.append(ver, desc, q);
                    return li;
                }));
                if (!pj.imagenes.length) {
                    listaImg.appendChild(PM.crear("li", "oc-vacio", ocT("Todavía no hay imágenes.")));
                }
            };
            const botonImg = PM.botonDe("oc-vida-accion", ocT("＋ imágenes"), () => subirImg.click(), ocT("Subir imágenes de {quien}", { quien: quien }));
            subirImg.addEventListener("change", () => {
                const fs = Array.from(subirImg.files || []);
                subirImg.value = "";
                const buenas = fs.filter((f) => /^image\//.test(f.type) && f.size <= PM.MAX_ARCHIVO);
                if (buenas.length < fs.length) {
                    PM.avisar(ocT("Sólo imágenes de hasta 50 MB."));
                }
                Promise.all(buenas.map((f) => {
                    const id = PM.idDoc("a");
                    return PM.archivoGuardar(id, f).then(() => {
                        pj.imagenes.push({ archivo: id, titulo: f.name.replace(/\.[^.]+$/, "") });
                    });
                })).then(() => {
                    if (buenas.length) {
                        PM.guardar();
                        pintarImg();
                        PM.avisar(ocT("Subidas {n}{n2}: ponles una descripción.", { n: buenas.length, n2: buenas.length === 1 ? ocT(" imagen") : ocT(" imágenes") }));
                    }
                }).catch(() => PM.avisar(ocT("No se han podido guardar (¿no queda sitio?).")));
            });
            panelImg.append(listaImg, botonImg, subirImg);
            pintarImg();

            // Cada apartado (con su título), plegable: se pulsa el título.
            [panelFicha, panelCombate, panelConj, panelInv, panelRasgos, panelHist, panelPnj].forEach(plegables);

            if (!visor) {
                const paneles = [[ocT("📋 ficha"), panelFicha], [ocT("⚔️ combate"), panelCombate], [ocT("✨ conjuros"), panelConj],
                    [ocT("🎒 inventario"), panelInv], [ocT("⭐ rasgos"), panelRasgos], [ocT("📜 historia"), panelHist], [ocT("👥 PNJ y notas"), panelPnj],
                    [ocT("🐾 criaturas"), panelCriaturas], [ocT("🖼️ imágenes"), panelImg], [ocT("🎭 máster"), panelMaster]];
                const { lista, elegir } = PM.pestanasDe(paneles, ocT("Ficha de {quien}", { quien: quien }), uid, (i) => {
                    m.datos.pestana = i;
                    PM.guardar();
                });
                dentro.replaceChildren(cabeza, lista, ...paneles.map(([, x]) => x));
                elegir(Math.min(m.datos.pestana || 0, paneles.length - 1), false);
                return;
            }

            // EL VISOR: la tarjeta de la izquierda…
            const tarjeta = PM.crear("div", "master-visor-tarjeta");
            const nombreV = PM.crear("div", "master-visor-nombre");
            nombreV.appendChild(PM.crear("h3", "master-visor-quien", quien));
            if (pj.nombreCompleto && pj.nombreCompleto !== quien) {
                nombreV.appendChild(PM.crear("p", "master-visor-completo", pj.nombreCompleto));
            }
            if (pj.clase) {
                nombreV.appendChild(PM.crear("span", "master-visor-clase", pj.clase));
            }
            const pgV = PM.crear("div", "master-visor-pg");
            const pgEt = PM.crear("label", "master-visor-et", ocT("❤️ PG"));
            pgInput.id = uid + "-pg";
            pgEt.htmlFor = pgInput.id;
            const pasoPg = (n) => {
                const ahora = PM.numPj(pgInput.value) === null ? 0 : PM.numPj(pgInput.value);
                const max = PM.numPj(pj.pgmax);
                pgInput.value = Math.max(0, max === null ? ahora + n : Math.min(max, ahora + n));
                pj.pg = PM.numPj(pgInput.value);
                pintarMuerte();
                cambiado();
                PM.avisar(ocT("{quien}: {pg} PG.", { quien: quien, pg: pj.pg }));
            };
            pgV.append(pgEt, PM.botonDe("master-pestana-mando", "−", () => pasoPg(-1), ocT("Quitar 1 PG a {quien}", { quien: quien })), pgInput,
                PM.crear("span", "master-visor-max", PM.numPj(pj.pgmax) !== null ? "/ " + PM.numPj(pj.pgmax) : ""),
                PM.botonDe("master-pestana-mando", "+", () => pasoPg(1), ocT("Sumar 1 PG a {quien}", { quien: quien })));
            const caV = PM.crear("div", "master-visor-fila");
            const caCaja = PM.crear("p", "master-visor-ca");
            caCaja.append(PM.crear("span", "master-visor-et", ocT("🛡️ CA")), PM.crear("strong", "", pj.ca === undefined || pj.ca === "" ? "—" : String(pj.ca)));
            const descansar = PM.botonDe("oc-vida-accion", ocT("🛏️ descansar"), () => {
                if (PM.numPj(pj.pgmax) !== null) {
                    pj.pg = PM.numPj(pj.pgmax);
                }
                pj.pgtemp = 0;
                Object.keys(pj.espacios).forEach((n) => {
                    pj.espacios[n].usados = 0;
                });
                cambiado();
                repintar();
                PM.avisar(ocT("{quien} descansa: PG al máximo y espacios de conjuro recuperados.", { quien: quien }));
            }, ocT("Descanso largo de {quien}: PG al máximo y espacios de conjuro recuperados", { quien: quien }));
            caV.append(caCaja, descansar);
            const retrato = PM.crear("div", "master-visor-retrato");
            const fotoV = PM.fotoPj(pj, "master-visor-foto", ocT("Retrato de {quien}", { quien: quien }));
            if (fotoV) {
                retrato.appendChild(fotoV);
            } else {
                const ini = PM.crear("span", "master-visor-inicial", (quien.trim()[0] || "?").toUpperCase());
                ini.setAttribute("aria-hidden", "true");
                retrato.appendChild(ini);
            }
            if (PM.numPj(pj.nivel)) {
                retrato.appendChild(PM.crear("span", "master-visor-clase", ocT("nivel {numPj}", { numPj: PM.numPj(pj.nivel) })));
            }
            const especie = [pj.raza, pj.subclase].filter(Boolean).join(" · ");
            const carsV = PM.crear("ul", "master-visor-cars");
            carsV.setAttribute("aria-label", ocT("Características de {quien}", { quien: quien }));
            PM.SALVACIONES_PJ.forEach((k) => {
                const n = car(k);
                if (n === null) {
                    return;
                }
                const li = PM.crear("li");
                const abr = PM.crear("abbr", "master-visor-et", PM.CAR_ABR[k]);
                abr.title = PM.CAR_VER[k];
                li.append(abr, PM.dadoPj(PM.modDe(n), ocT("{n} de {quien}", { n: PM.CAR_VER[k], quien: quien })), PM.crear("span", "master-visor-max", String(n)));
                carsV.appendChild(li);
            });
            tarjeta.append(nombreV, pgV, muerteSitio, caV, retrato);
            if (especie) {
                tarjeta.appendChild(PM.crear("p", "master-visor-especie", especie));
            }
            tarjeta.append(PM.crear("p", "master-visor-et", ocT("características")), carsV, botones, recordar);

            // …el menú de secciones y la sección elegida.
            const secciones = [["📖", ocT("historia"), panelHist], ["📋", ocT("ficha"), null, [["📊", ocT("combate"), panelFicha],
                ["🎯", ocT("habilidades"), panelHab], ["⚔️", ocT("acciones"), panelCombate], ["✨", ocT("conjuros"), panelConj],
                ["🎒", ocT("inventario"), panelInv], ["⭐", ocT("rasgos y competencias"), panelRasgos]]], ["🐾", ocT("criaturas"), panelCriaturas],
                ["👥", ocT("PNJ y notas"), panelPnj], ["🖼️", ocT("imágenes"), panelImg], ["🎭", ocT("máster"), panelMaster]];
            // (Un div con su papel, no un <section>: la base de la web le da
            // a todos alto, relleno y centrado.)
            const contenido = PM.crear("div", "master-visor-contenido");
            contenido.setAttribute("role", "region");
            const tituloSec = PM.crear("h3", "master-visor-titulo");
            tituloSec.id = uid + "-sec";
            contenido.setAttribute("aria-labelledby", tituloSec.id);
            contenido.appendChild(tituloSec);
            const menu = PM.crear("nav", "master-visor-menu");
            menu.setAttribute("aria-label", ocT("Secciones de la ficha de {quien}", { quien: quien }));
            const botonesSec = [];
            let fichaB = null;
            let subLista = null;
            const elegirSec = (clave, foco) => {
                const todas = secciones.flatMap((x) => (x[3] ? x[3] : [x]));
                const sec = todas.find((x) => x[1] === clave) || todas[0];
                todas.forEach(([, , panel]) => {
                    panel.hidden = true;
                });
                sec[2].hidden = false;
                tituloSec.textContent = sec[0] + " " + sec[1];
                botonesSec.forEach(([k, b]) => {
                    if (k === sec[1]) {
                        b.setAttribute("aria-current", "true");
                    } else {
                        b.removeAttribute("aria-current");
                    }
                });
                const enFicha = secciones[1][3].some((x) => x === sec);
                if (enFicha) {
                    subLista.hidden = false;
                    fichaB.setAttribute("aria-expanded", "true");
                }
                m.datos.seccion = sec[1];
                PM.guardar();
                if (foco) {
                    contenido.focus();
                }
            };
            const ul = PM.crear("ul");
            secciones.forEach(([emoji, nombre, panel, subs]) => {
                const li = PM.crear("li");
                const b = PM.botonDe("master-visor-sec", "", () => {
                    if (subs) {
                        const abrir = subLista.hidden;
                        subLista.hidden = !abrir;
                        b.setAttribute("aria-expanded", String(abrir));
                        if (abrir) {
                            elegirSec(subs[0][1], false);
                        }
                        return;
                    }
                    elegirSec(nombre, false);
                });
                const em = PM.crear("span", "", emoji);
                em.setAttribute("aria-hidden", "true");
                b.append(em, document.createTextNode(" " + nombre));
                li.appendChild(b);
                if (subs) {
                    fichaB = b;
                    b.setAttribute("aria-expanded", "false");
                    subLista = PM.crear("ul");
                    subLista.hidden = true;
                    subs.forEach(([e2, n2, p2]) => {
                        const li2 = PM.crear("li");
                        const b2 = PM.botonDe("master-visor-sec", "", () => elegirSec(n2, false));
                        const em2 = PM.crear("span", "", e2);
                        em2.setAttribute("aria-hidden", "true");
                        b2.append(em2, document.createTextNode(" " + n2));
                        li2.appendChild(b2);
                        subLista.appendChild(li2);
                        botonesSec.push([n2, b2]);
                        contenido.appendChild(p2);
                    });
                    b.setAttribute("aria-controls", (subLista.id = uid + "-subs"));
                    li.appendChild(subLista);
                } else {
                    botonesSec.push([nombre, b]);
                    contenido.appendChild(panel);
                }
                ul.appendChild(li);
            });
            menu.appendChild(ul);
            contenido.tabIndex = -1;
            const libro = PM.crear("div", "master-visor");
            libro.append(tarjeta, menu, contenido);
            dentro.replaceChildren(libro);
            elegirSec(m.datos.seccion || "historia", false);
        }).catch(() => {
            dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("No he podido cargar su ficha.")));
        });
    }

    // EL FORMULARIO DE LA FICHA: todo lo que no se escribe en las
    // pestañas (los números, las competencias, los ataques, los objetos,
    // los conjuros…). Al guardar, la ficha (y la party) se repintan.
    function editarPj(dentro, m, pj, alTerminar) {
        const uid = "master-pjf-" + m.id;
        const form = PM.crear("form", "master-creador-form");
        // Por pestañas, como la ficha: cada grupo va a la suya.
        const pF = PM.crear("div");
        const pC = PM.crear("div");
        const pM = PM.crear("div");
        const pI = PM.crear("div");
        const pR = PM.crear("div");
        let destino = pF;
        let n = 0;
        function campo(caja, etiqueta, valor, op) {
            const o = op || {};
            n += 1;
            const id = uid + "-c" + n;
            const et = PM.crear("label", "oc-dados-etiqueta", etiqueta);
            et.htmlFor = id;
            let x;
            if (o.opciones) {
                x = PM.crear("select", "master-elegir");
                o.opciones.forEach(([v, t]) => {
                    const op2 = PM.crear("option", "", t);
                    op2.value = v;
                    x.appendChild(op2);
                });
                x.value = valor === undefined || valor === null ? "" : String(valor);
            } else if (o.filas) {
                x = PM.crear("textarea", "oc-dados-texto master-creador-area");
                x.rows = o.filas;
                x.value = valor || "";
            } else {
                x = PM.crear("input", "oc-dados-texto");
                x.type = o.tipo || "text";
                if (o.tipo === "number") {
                    x.min = o.min === undefined ? 0 : o.min;
                    x.max = o.max === undefined ? 9999 : o.max;
                    x.inputMode = "numeric";
                }
                x.value = valor === undefined || valor === null ? "" : String(valor);
                x.autocomplete = "off";
                if (o.lista) {
                    x.setAttribute("list", o.lista);
                }
            }
            x.id = id;
            if (o.ayuda) {
                x.placeholder = o.ayuda;
            }
            const div = PM.crear("div", "master-creador-campo" + (o.ancho ? " es-ancho" : ""));
            div.append(et, x);
            caja.appendChild(div);
            return x;
        }
        function grupo(titulo) {
            const fs = PM.crear("fieldset", "master-creador-grupo");
            fs.appendChild(PM.crear("legend", "", titulo));
            const rejilla = PM.crear("div", "master-creador-rejilla");
            fs.appendChild(rejilla);
            destino.appendChild(fs);
            return rejilla;
        }
        // Filas repetibles (ataques, objetos): cada una con sus campos y ✕.
        function filasDe(titulo, lista, campos, nueva) {
            const fs = PM.crear("fieldset", "master-creador-grupo");
            fs.appendChild(PM.crear("legend", "", titulo));
            const ol = PM.crear("ol", "master-creador-entradas");
            const filas = [];
            const fila = (x, foco) => {
                const li = PM.crear("li", "master-pjf-fila");
                const ins = campos.map(([clave, et, op]) => {
                    if (op && op.casilla) {
                        const lab = PM.crear("label", "master-creador-check");
                        const c = PM.crear("input");
                        c.type = "checkbox";
                        c.checked = !!x[clave];
                        lab.append(c, " " + et);
                        li.appendChild(lab);
                        return [clave, c];
                    }
                    return [clave, campo(li, et, x[clave], op)];
                });
                const reg = { li, ins };
                const q = PM.botonDe("master-docs-mando", "✕", () => {
                    filas.splice(filas.indexOf(reg), 1);
                    li.remove();
                    mas.focus();
                }, ocT("Quitar esta fila de {toLowerCase}", { toLowerCase: titulo.toLowerCase() }));
                li.appendChild(q);
                filas.push(reg);
                ol.appendChild(li);
                if (foco) {
                    ins[0][1].focus();
                }
            };
            lista.forEach((x) => fila(x));
            const mas = PM.botonDe("oc-vida-accion", ocT("＋ añadir"), () => fila(nueva(), true), ocT("Añadir a {toLowerCase}", { toLowerCase: titulo.toLowerCase() }));
            fs.append(ol, mas);
            destino.appendChild(fs);
            return () => filas.map((r) => {
                const o = {};
                r.ins.forEach(([k, el]) => {
                    o[k] = el.type === "checkbox" ? el.checked : el.value.trim();
                });
                return o;
            });
        }
        // La foto: la suya, una nueva o ninguna (se guarda al guardar).
        const fsFoto = PM.crear("fieldset", "master-creador-grupo master-pjf-foto");
        fsFoto.appendChild(PM.crear("legend", "", ocT("Foto")));
        const vistaFoto = PM.crear("div", "master-pjf-foto-vista");
        let fotoNueva = null;
        let sinFoto = false;
        let urlNueva = "";
        const pintarFoto = () => {
            vistaFoto.replaceChildren();
            if (fotoNueva) {
                const img = PM.crear("img", "master-pj-foto");
                img.alt = ocT("La foto nueva");
                img.src = urlNueva;
                vistaFoto.appendChild(img);
            } else if (!sinFoto && (pj.foto || pj.fotoUrl)) {
                vistaFoto.appendChild(PM.fotoPj(pj, "master-pj-foto", ocT("La foto de ahora")));
            } else {
                vistaFoto.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Sin foto.")));
            }
            quitarFoto.hidden = !(fotoNueva || (!sinFoto && (pj.foto || pj.fotoUrl)));
        };
        const subirFoto = PM.crear("input");
        subirFoto.type = "file";
        subirFoto.accept = "image/*";
        subirFoto.hidden = true;
        subirFoto.addEventListener("change", () => {
            const f = subirFoto.files && subirFoto.files[0];
            subirFoto.value = "";
            if (!f) {
                return;
            }
            if (!/^image\//.test(f.type) || f.size > 10 * 1024 * 1024) {
                PM.avisar(ocT("Tiene que ser una imagen de hasta 10 MB."));
                return;
            }
            if (urlNueva) {
                URL.revokeObjectURL(urlNueva);
            }
            fotoNueva = f;
            urlNueva = URL.createObjectURL(f);
            sinFoto = false;
            pintarFoto();
            PM.avisar(ocT("Foto elegida: se guarda al pulsar «✓ guardar»."));
        });
        const elegirFoto = PM.botonDe("oc-vida-accion", ocT("📷 elegir foto"), () => subirFoto.click(), ocT("Elegir una foto de {n} (de tu dispositivo)", { n: pj.nombre
            || ocT("este personaje") }));
        const quitarFoto = PM.botonDe("oc-vida-accion", ocT("✕ quitar"), () => {
            fotoNueva = null;
            sinFoto = true;
            pintarFoto();
            elegirFoto.focus();
        }, ocT("Quitar la foto"));
        const botonesFoto = PM.crear("div", "master-creador-barra");
        botonesFoto.append(elegirFoto, quitarFoto);
        fsFoto.append(vistaFoto, botonesFoto, subirFoto);
        pintarFoto();
        pF.appendChild(fsFoto);
        const b = grupo(ocT("Quién es"));
        const nombre = campo(b, ocT("nombre"), pj.nombre);
        const completo = campo(b, ocT("nombre completo"), pj.nombreCompleto, { ayuda: ocT("opcional") });
        const jugador = campo(b, ocT("jugador"), pj.jugador, { ayuda: ocT("quién lo lleva") });
        const raza = campo(b, ocT("especie"), pj.raza);
        const clase = campo(b, ocT("clase (y subclase)"), pj.clase);
        const nivel = campo(b, ocT("nivel"), pj.nivel, { tipo: "number", min: 1, max: 20 });
        const fondo = campo(b, ocT("trasfondo"), pj.trasfondoNombre);
        const alin = campo(b, ocT("alineamiento"), pj.alineamiento);
        const pxC = campo(b, ocT("PX (experiencia)"), pj.px, { tipo: "number", min: 0 });
        destino = pC;
        const c = grupo(ocT("Combate"));
        const ca = campo(c, ocT("CA"), pj.ca);
        const pgmax = campo(c, ocT("PG máximos"), pj.pgmax, { tipo: "number" });
        const pg = campo(c, ocT("PG actuales"), pj.pg, { tipo: "number" });
        const pgtemp = campo(c, ocT("PG temporales"), pj.pgtemp, { tipo: "number" });
        const vel = campo(c, ocT("velocidad"), pj.velocidad, { ayuda: ocT("30 pies") });
        const dg = campo(c, ocT("dados de golpe"), pj.dadosGolpe, { ayuda: "3d8" });
        destino = pF;
        const cs = grupo(ocT("Características"));
        const cars = {};
        PM.SALVACIONES_PJ.forEach((k) => {
            cars[k] = campo(cs, PM.CAR_VER[k], pj[k], { tipo: "number", min: 1, max: 30 });
        });
        const fsS = PM.crear("fieldset", "master-creador-grupo");
        fsS.appendChild(PM.crear("legend", "", ocT("Salvaciones con competencia")));
        const cajaS = PM.crear("div", "master-creador-casillas");
        const salv = PM.SALVACIONES_PJ.map((k) => {
            const lab = PM.crear("label", "master-creador-check");
            const x = PM.crear("input");
            x.type = "checkbox";
            x.checked = pj.salvaciones.includes(k);
            lab.append(x, " " + PM.CAR_VER[k]);
            cajaS.appendChild(lab);
            return [k, x];
        });
        fsS.appendChild(cajaS);
        pF.appendChild(fsS);
        const hs = grupo(ocT("Habilidades"));
        destino = pC;
        const habs = PM.HABILIDADES_PJ.map(([nom, k]) => [nom, campo(hs, PM.verHab(nom) + " (" + PM.CAR_ABR[k] + ")", pj.habilidades[nom] || 0,
            { opciones: [["0", "—"], ["1", ocT("competente")], ["2", ocT("pericia")]] })]);
        const leerAtaques = filasDe(ocT("Ataques"), pj.ataques, [["nombre", ocT("arma o ataque")], ["bono", ocT("bono"), { ayuda: "+5" }],
            ["dano", ocT("daño"), { ayuda: ocT("1d8+3 cortante") }]], () => ({ nombre: "", bono: "", dano: "" }));
        const acc = campo(grupo(ocT("Acciones especiales")), ocT("una por línea"), pj.acciones.join("\n"), { filas: 3, ancho: true,
            ayuda: ocT("Acción adicional: Forma salvaje (2 usos, descanso corto)") });
        destino = pM;
        const mg = grupo(ocT("Magia"));
        const apt = campo(mg, ocT("aptitud mágica"), pj.aptitud || "", { opciones: [["", ocT("ninguna")]].concat(PM.SALVACIONES_PJ.map((k) =>
            [k, PM.CAR_VER[k]])) });
        const espacios = {};
        for (let i = 1; i <= 9; i++) {
            espacios[i] = campo(mg, ocT("espacios de nivel {i}", { i: i }), (pj.espacios[i] || {}).max || "", { tipo: "number", max: 9 });
        }
        const conjs = campo(grupo(ocT("Conjuros")), ocT("uno por línea (los del SRD se enlazan solos)"), pj.conjuros.join("\n"),
            { filas: 6, ancho: true });
        destino = pI;
        const leerObjetos = filasDe(ocT("Inventario"), pj.objetos, [["nombre", "objeto"], ["cant", "cantidad", { tipo: "number" }],
            ["equipado", "equipado", { casilla: true }]], () => ({ nombre: "", cant: 1, equipado: false }));
        const din = grupo(ocT("Dinero"));
        const monedas = {};
        PM.MONEDAS_PJ.forEach(([k, abr, nom]) => {
            monedas[k] = campo(din, nom + " (" + abr + ")", pj.dinero[k] || "", { tipo: "number", max: 9999999 });
        });
        destino = pR;
        const ot = grupo(ocT("Rasgos y competencias"));
        const rasgos = campo(ot, ocT("rasgos y dotes"), pj.rasgos, { filas: 6, ancho: true,
            ayuda: ocT("- **Visión en la oscuridad** (especie)\n- **Ataque furtivo** (Pícaro, nivel 1)") });
        // Añadirlos del SRD (o de los tuyos): uno a uno, o todos los de su
        // clase (hasta su nivel) y su especie.
        const cajaSrd = PM.crear("div", "master-pjf-srd");
        const etSrd = PM.crear("label", "oc-dados-etiqueta", ocT("añadir uno del SRD o de los tuyos"));
        const buscaSrd = PM.crear("input", "oc-dados-texto");
        buscaSrd.id = uid + "-srd";
        buscaSrd.setAttribute("list", uid + "-srd-lista");
        buscaSrd.autocomplete = "off";
        buscaSrd.placeholder = ocT("Furia, Alerta, Linaje feérico…");
        etSrd.htmlFor = buscaSrd.id;
        const listaSrd = PM.crear("datalist");
        listaSrd.id = uid + "-srd-lista";
        let todosRasgos = [];
        PM.pedir(PM.RASGOS_SRD).then((datos) => {
            todosRasgos = (datos.rasgos || []).filter((r) => r.tipo !== "habilidad");
            const vistos = new Set();
            listaSrd.replaceChildren(...todosRasgos.filter((r) => {
                const k = r.nombre + "|" + r.de;
                const ya = vistos.has(k);
                vistos.add(k);
                return !ya;
            }).map((r) => {
                const o = PM.crear("option");
                o.value = r.nombre + (r.de && r.de !== "dote" ? " — " + r.de : "");
                return o;
            }));
        }).catch(() => null);
        const lineaDe = (r) => "- **" + r.nombre + "** (" + (r.tipo === "rasgo de clase" ? r.de + (r.nivel ? ocT(", nivel {nivel}", { nivel: r.nivel }) : "")
            : r.tipo === "rasgo de especie" ? (r.de.split(/,\s*/).find((d) => PM.llano(raza.value).includes(PM.llano(d))) || r.de.split(",")[0])
                : r.tipo) + ")";
        const yaEsta = (r) => String(rasgos.value).split("\n").some((l) => PM.llano(l).includes("**" + PM.llano(r.nombre) + "**"));
        const poner = (lista) => {
            const nuevas = lista.filter((r) => !yaEsta(r)).map(lineaDe);
            if (nuevas.length) {
                rasgos.value = (rasgos.value.trim() ? rasgos.value.replace(/\s+$/, "") + "\n" : "") + nuevas.join("\n");
            }
            return nuevas.length;
        };
        const anadirUno = PM.botonDe("oc-vida-accion", ocT("＋ añadir"), () => {
            const [n, de] = buscaSrd.value.split(" — ");
            const r = todosRasgos.find((x) => PM.llano(x.nombre) === PM.llano(n || "") && (!de || x.de === de.trim()))
                || rasgoDe(todosRasgos, n || "", clase.value + " " + raza.value);
            if (!r) {
                PM.avisar(ocT("No encuentro «{value}» entre los rasgos y dotes.", { value: buscaSrd.value }));
                buscaSrd.focus();
                return;
            }
            PM.avisar(poner([r]) ? ocT("Añadido: {nombre}.", { nombre: r.nombre }) : ocT("{nombre} ya estaba.", { nombre: r.nombre }));
            buscaSrd.value = "";
            buscaSrd.focus();
        }, ocT("Añadir a la lista de rasgos el que has escrito"));
        buscaSrd.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                anadirUno.click();
            }
        });
        const deSuClase = PM.botonDe("oc-vida-accion", ocT("＋ los de su clase y especie"), () => {
            const cl = PM.llano(clase.value);
            const base = cl.split(/[ (/]+/)[0];
            const nv = Number(nivel.value) || 1;
            const es = PM.llano(raza.value);
            const vistos = new Set();
            const elegidos = todosRasgos.filter((r) => {
                if (r.tipo === "rasgo de clase") {
                    const m = /^(.*?)(?: \((.*)\))?$/.exec(r.de || "") || [];
                    return base && PM.llano(m[1] || "") === base && (r.nivel || 0) <= nv && (!m[2] || cl.includes(PM.llano(m[2])))
                        && !/^subclase de /i.test(r.nombre);
                }
                if (r.tipo === "rasgo de especie") {
                    const k = PM.llano(r.nombre.replace(/\s*\(.*$/, ""));
                    const ok = es && !/:/.test(r.nombre) && PM.llano(r.de || "").split(/,\s*/).some((d) => d && es.includes(d)) && !vistos.has(k);
                    if (ok) {
                        vistos.add(k);
                    }
                    return ok;
                }
                return false;
            }).sort((a, b) => (a.tipo === b.tipo ? (a.nivel || 0) - (b.nivel || 0) : a.tipo === "rasgo de especie" ? -1 : 1));
            if (!elegidos.length) {
                PM.avisar(ocT("No encuentro rasgos del SRD para «{n}» y «{n2}». Mira la clase y la especie (en 📋 ficha).", { n: clase.value || ocT("sin clase"), n2: raza.value || ocT("sin especie") }));
                return;
            }
            const n = poner(elegidos);
            PM.avisar(n ? ocT("Añadidos {n} rasgos (repásalos: los de elegir una opción, como el linaje, van todos).", { n: n }) : ocT("Ya estaban todos."));
        }, ocT("Añadir los rasgos del SRD de su clase (hasta su nivel) y de su especie"));
        const filaSrd = PM.crear("div", "master-creador-barra");
        filaSrd.append(anadirUno, deSuClase);
        cajaSrd.append(etSrd, buscaSrd, listaSrd, filaSrd);
        ot.appendChild(cajaSrd);
        const comp = campo(ot, ocT("competencias (armas, armaduras, herramientas)"), pj.competencias, { ancho: true });
        const idiomas = campo(ot, ocT("idiomas"), pj.idiomas, { ancho: true });
        const sentidos = campo(ot, ocT("sentidos"), pj.sentidos, { ancho: true, ayuda: ocT("Visión en la oscuridad 60 pies") });
        const defensas = campo(ot, ocT("resistencias e inmunidades"), pj.defensas, { ancho: true });
        const final = PM.crear("div", "master-creador-barra master-creador-final");
        const ok = PM.crear("button", "oc-vida-accion es-principal", ocT("✓ guardar"));
        ok.type = "submit";
        const no = PM.botonDe("oc-vida-accion", ocT("cancelar"), () => alTerminar());
        final.append(ok, no);
        const paneles = [[ocT("📋 ficha"), pF], [ocT("⚔️ combate"), pC], [ocT("✨ conjuros"), pM], [ocT("🎒 inventario"), pI], [ocT("⭐ rasgos"), pR]];
        const { lista: pestanas, elegir } = PM.pestanasDe(paneles, ocT("Editar la ficha de {n}", { n: pj.nombre || "personaje" }), uid + "-tab",
            (i) => {
                m.datos.pestana = i;
            });
        form.append(PM.crear("h3", "master-creador-titulo", "✎ " + (pj.nombre || "personaje")), pestanas, ...paneles.map(([, x]) => x),
            final);
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            ok.disabled = true;
            const idFoto = fotoNueva ? PM.idDoc("f") : "";
            (fotoNueva ? PM.archivoGuardar(idFoto, fotoNueva) : Promise.resolve()).then(() => {
                if (fotoNueva || sinFoto) {
                    if (pj.foto) {
                        PM.archivoBorrar(pj.foto);
                    }
                    pj.foto = fotoNueva ? idFoto : "";
                    delete pj.fotoUrl;
                }
                if (urlNueva) {
                    URL.revokeObjectURL(urlNueva);
                }
                guardarFicha();
            }).catch(() => {
                ok.disabled = false;
                PM.avisar(ocT("No se ha podido guardar la foto (¿no queda sitio?)."));
            });
        });
        function guardarFicha() {
            pj.nombre = nombre.value.trim() || pj.nombre || ocT("Sin nombre");
            pj.nombreCompleto = completo.value.trim();
            pj.jugador = jugador.value.trim();
            pj.raza = raza.value.trim();
            pj.clase = clase.value.trim();
            pj.nivel = PM.numPj(nivel.value);
            pj.trasfondoNombre = fondo.value.trim();
            pj.alineamiento = alin.value.trim();
            pj.px = PM.numPj(pxC.value) || 0;
            pj.ca = ca.value.trim();
            pj.pgmax = PM.numPj(pgmax.value);
            pj.pg = PM.numPj(pg.value) === null ? pj.pgmax : PM.numPj(pg.value);
            pj.pgtemp = PM.numPj(pgtemp.value);
            pj.velocidad = vel.value.trim();
            pj.dadosGolpe = dg.value.trim();
            PM.SALVACIONES_PJ.forEach((k) => {
                pj[k] = PM.numPj(cars[k].value);
            });
            pj.salvaciones = salv.filter(([, x]) => x.checked).map(([k]) => k);
            pj.habilidades = {};
            habs.forEach(([nom, x]) => {
                if (Number(x.value)) {
                    pj.habilidades[nom] = Number(x.value);
                }
            });
            pj.ataques = leerAtaques().filter((a) => a.nombre || a.dano);
            pj.acciones = acc.value.split("\n").map((s) => s.trim()).filter(Boolean);
            pj.aptitud = apt.value;
            const antes = pj.espacios;
            pj.espacios = {};
            for (let i = 1; i <= 9; i++) {
                const max = PM.numPj(espacios[i].value);
                if (max) {
                    pj.espacios[i] = { max, usados: Math.min(max, PM.numPj((antes[i] || {}).usados) || 0) };
                }
            }
            pj.conjuros = conjs.value.split("\n").map((s) => s.trim()).filter(Boolean);
            pj.objetos = leerObjetos().filter((o) => o.nombre).map((o) => ({ nombre: o.nombre, cant: PM.numPj(o.cant) || 1,
                equipado: !!o.equipado }));
            pj.dinero = {};
            PM.MONEDAS_PJ.forEach(([k]) => {
                if (PM.numPj(monedas[k].value)) {
                    pj.dinero[k] = PM.numPj(monedas[k].value);
                }
            });
            pj.rasgos = rasgos.value;
            pj.competencias = comp.value.trim();
            pj.idiomas = idiomas.value.trim();
            pj.sentidos = sentidos.value.trim();
            pj.defensas = defensas.value.trim();
            m.titulo = pj.nombre;
            PM.ponerTitulo(m);
            PM.guardar();
            PM.avisarPjs(m.id);
            PM.avisar(ocT("Ficha guardada: {nombre}.", { nombre: pj.nombre }));
            alTerminar();
        }
        form.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && e.target.tagName !== "SELECT") {
                e.preventDefault();
                alTerminar();
            }
        });
        dentro.replaceChildren(form);
        dentro.scrollTop = 0;
        const antes = m.datos.pestana || 0;
        const empieza = antes < paneles.length ? antes : 0;
        elegir(empieza, false);
        if (empieza === 0) {
            nombre.focus();
        } else {
            pestanas.querySelector("[aria-selected=true]").focus();
        }
    }

    Object.assign(PM, { montarPj });
})();
