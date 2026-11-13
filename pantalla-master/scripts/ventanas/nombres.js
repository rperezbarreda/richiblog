// =========================================
// LA VENTANA «nombres» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    function guardarNombresTuyos(x) {
        try {
            localStorage.setItem(PM.CLAVE_NOMBRES, JSON.stringify(x));
        } catch (e) {
            PM.avisar(ocT("No se ha podido guardar."));
            return false;
        }
        document.dispatchEvent(new CustomEvent("master:nombres"));
        return true;
    }
    const listaDe = (texto) => String(texto || "").split("\n").map((l) => l.trim()).filter(Boolean);

    // Un lugar en otro idioma: el nombre en español, sin «de», «la»…, y
    // cada palabra a una del idioma (siempre la misma, como en las notas).
    function lugarEn(nombre, idioma) {
        const sin = nombre.split(/\s+/).filter((p) => !/^(de|del|la|el|los|las|y|en)$/i.test(p)).join(" ");
        const n = PM.inventar(sin, idioma, 3).replace(/(^|\s)(\p{Ll})/gu, (x, a, b) => a + b.toUpperCase());
        return { n, es: nombre, idioma: idioma.id };
    }

    // Los nombres de los campos de nombres.json, para cambiarlos.
    const CAMPOS_NOMBRES = { ini: ocT("principios (sílabas)"), f: ocT("finales femeninos"), m: ocT("finales masculinos"), n: ocT("finales neutros"),
        fin: ocT("segunda parte"), pre: ocT("principio (va pegado al final)"), adj: ocT("final (va pegado al principio)"),
        base: ocT("lo primero"), de: ocT("lo de después"), sust: ocT("el nombre y su género («La Jarra | f»)") };
    const CAMPOS_TABERNA = { adj: ocT("lo de después, masculino | femenino («Dorado | Dorada»)") };

    function montarNombres(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        dentro.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Cargando…")));
        let lenguas = null;
        // Al guardar una tabla se vuelve a montar todo: el foco, a «generar».
        let alGenerar = false;
        const cargar = () => Promise.all([PM.pedir(PM.NOMBRES), lenguas || PM.pedir(PM.IDIOMAS)]).then(([datos, l]) => {
            lenguas = l;
            montar(datos);
        }).catch(() => {
            dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("No he podido cargar los nombres.")));
        });
        function montar(datos) {
            const otras = lenguas.idiomas.filter((x) => x.id !== "comun");
            const lenguaDe = (id) => otras.find((x) => x.id === id);
            const tuyas = datos.propias || [];
            const conTuyas = (tipo) => tuyas.filter((x) => x.tipo === tipo).map((x) => ["propia:" + x.id, "⭐ " + x.nombre]);
            // Lo que sale y lo guardado: un texto, o {n, es, idioma} si es
            // un lugar en otro idioma.
            const nombreDe_ = (x) => (typeof x === "string" ? x : x.n);
            const tipos = [["personaje", ocT("👤 personaje")]].concat(Object.keys(datos.lugares)
                .map((k) => [k, ({ pueblo: "🏘️ ", taberna: "🍺 ", region: "🏔️ ", mazmorra: "🕳️ " }[k] || "") + datos.lugares[k].nombre]),
            conTuyas("lugar"));
            const vale = (lista, v) => (lista.some((x) => x[0] === v) ? v : lista[0][0]);
            const que = PM.elegirDe("master-nombres-que-" + m.id, ocT("qué"), tipos, vale(tipos, d.que || "personaje"));
            const especies = Object.keys(datos.especies).map((k) => [k, datos.especies[k].nombre]).concat(conTuyas("personaje"));
            const especie = PM.elegirDe("master-nombres-especie-" + m.id, ocT("especie (o tu tabla)"), especies,
                vale(especies, d.especie || "humano"));
            const genero = PM.botonesDe(ocT("género"), [["cualquiera", ocT("cualquiera")], ["f", ocT("♀ femenino")], ["m", ocT("♂ masculino")],
                ["n", ocT("⚪ neutro")]], d.genero || "cualquiera", (v) => {
                d.genero = v;
                PM.guardar();
            });
            const lengua = PM.elegirDe("master-nombres-lengua-" + m.id, ocT("en qué idioma"),
                [["", ocT("común (en español)")]].concat(otras.map((x) => [x.id, x.nombre])), d.lengua || "");
            const etAp = PM.crear("label", "master-nombres-apellido");
            const ap = PM.crear("input");
            ap.type = "checkbox";
            ap.checked = d.apellido !== false;
            etAp.append(ap, document.createTextNode(ocT(" con apellido")));
            const persona = PM.crear("div", "master-nombres-persona");
            const etGen = PM.crear("p", "oc-dados-etiqueta", ocT("género"));
            etGen.setAttribute("aria-hidden", "true");
            persona.append(especie, etAp, etGen, genero);
            const recordar = () => Object.assign(d, { que: que.elegir.value, especie: especie.elegir.value, genero: genero.valor(),
                apellido: ap.checked, lengua: lengua.elegir.value });
            const generar = PM.botonDe("oc-vida-accion es-principal master-nombres-generar", ocT("🎲 generar 8"), () => {
                recordar();
                const salen = new Map();
                const enOtra = d.que !== "personaje" && lenguaDe(d.lengua);
                for (let i = 0; i < 40 && salen.size < 8; i++) {
                    const x = d.que === "personaje" ? PM.nombreDe(datos, d.especie, d.genero, d.apellido)
                        : PM.lugarDe(datos, d.que);
                    if (!x) {
                        continue;
                    }
                    const sale = enOtra ? lugarEn(x, enOtra) : x;
                    salen.set(nombreDe_(sale), sale);
                }
                d.salen = Array.from(salen.values());
                PM.guardar();
                pintar();
                PM.avisar(ocT("{n} nombres nuevos.", { n: d.salen.length }));
            });
            const lista = PM.crear("ul", "master-nombres");
            lista.setAttribute("aria-label", ocT("Nombres que han salido"));
            const guardadosT = PM.crear("h3", "master-nombres-titulo", ocT("⭐ guardados"));
            const guardados = PM.crear("ul", "master-nombres es-guardados");
            guardados.setAttribute("aria-label", ocT("Nombres guardados"));
            const fila = (x, guardado) => {
                const n = nombreDe_(x);
                const li = PM.crear("li", "master-nombre");
                const texto = PM.crear("span", "master-nombre-texto", n);
                const otra = typeof x === "string" ? null : lenguaDe(x.idioma);
                if (otra) {
                    const glifos = PM.crear("span", "master-nombre-glifos es-" + otra.id, PM.aSuAlfabeto(n, otra));
                    glifos.setAttribute("aria-hidden", "true");
                    texto.append(glifos, PM.crear("span", "master-nombre-es", ocT("«{es}» en {toLowerCase}", { es: x.es, toLowerCase: otra.nombre.toLowerCase() })));
                }
                li.appendChild(texto);
                const marcar = PM.botonDe("master-nombre-boton", guardado ? "✕" : "☆", () => {
                    d.guardados = (d.guardados || []).filter((y) => nombreDe_(y) !== n);
                    if (!guardado) {
                        d.guardados.push(x);
                    }
                    PM.guardar();
                    pintar();
                    PM.avisar(guardado ? ocT("Quitado: {n}.", { n: n }) : ocT("Guardado: {n}.", { n: n }));
                }, (guardado ? ocT("Quitar de guardados: ") : ocT("Guardar: ")) + n);
                marcar.title = guardado ? ocT("Quitar") : ocT("Guardar");
                const copiar = PM.botonDe("master-nombre-boton", "⧉", () => PM.copiarTexto(n, ocT("Copiado: {n}.", { n: n })), ocT("Copiar {n}", { n: n }));
                copiar.title = ocT("Copiar");
                li.append(marcar, copiar);
                return li;
            };
            const pintar = () => {
                const ya = new Set((d.guardados || []).map(nombreDe_));
                lista.replaceChildren(...(d.salen || []).filter((x) => !ya.has(nombreDe_(x))).map((x) => fila(x, false)));
                if (!lista.children.length) {
                    lista.appendChild(PM.crear("li", "oc-vacio", d.salen ? ocT("Todos guardados. Genera más.") : ocT("Pulsa «generar».")));
                }
                guardados.replaceChildren(...(d.guardados || []).map((n) => fila(n, true)));
                guardadosT.hidden = guardados.hidden = !guardados.children.length;
            };

            // ---- TUS TABLAS: crear una, cambiar la elegida (la tuya o una
            // de las de siempre) y quitar la tuya. ----
            const elegida = () => (que.elegir.value === "personaje" ? especie.elegir.value : que.elegir.value);
            const nueva = PM.botonDe("oc-vida-accion", ocT("＋ tabla de nombres"), () => editarTuya(null), ocT("Crear una tabla de nombres tuya"));
            const cambiar = PM.botonDe("oc-vida-accion", ocT("✎ cambiar esta"), () => {
                const k = elegida();
                const tuya = PM.propiaDe(datos, k);
                if (tuya) {
                    editarTuya(tuya);
                } else {
                    editarDeSiempre(k);
                }
            }, ocT("Cambiar la tabla elegida"));
            const original = PM.botonDe("oc-vida-accion", ocT("↺ como venía"), () => {
                const tuyo = PM.leerNombresTuyos();
                claves(elegida()).forEach((c) => delete tuyo.cambios[c]);
                alGenerar = true;
                guardarNombresTuyos(tuyo);
                PM.avisar(ocT("Otra vez como venía."));
            }, ocT("Dejar la tabla elegida como venía"));
            const quitar = PM.botonDe("oc-vida-accion", ocT("🗑️ quitar"), () => {
                const tuya = PM.propiaDe(datos, elegida());
                if (!tuya) {
                    return;
                }
                if (quitar.dataset.seguro !== "1") {
                    quitar.dataset.seguro = "1";
                    quitar.textContent = ocT("🗑️ ¿seguro? pulsa otra vez");
                    return;
                }
                const tuyo = PM.leerNombresTuyos();
                tuyo.propias = tuyo.propias.filter((x) => x.id !== tuya.id);
                alGenerar = true;
                guardarNombresTuyos(tuyo);
                PM.avisar(ocT("Quitada la tabla «{nombre}».", { nombre: tuya.nombre }));
            }, ocT("Quitar tu tabla elegida"));
            const barra = PM.crear("div", "master-creador-barra");
            barra.append(nueva, cambiar, original, quitar);
            const form = PM.crear("form", "master-tablas-editar");
            form.hidden = true;
            // Las claves de «cambios» de una de las de siempre.
            function claves(k) {
                if (que.elegir.value !== "personaje") {
                    return ["lugares/" + k];
                }
                const e = datos.especies[k];
                return ["especies/" + k].concat(e && e.apellido ? ["apellidos/" + e.apellido] : []);
            }
            const ajustarBarra = () => {
                const k = elegida();
                const tuya = !!PM.propiaDe(datos, k);
                quitar.hidden = !tuya;
                delete quitar.dataset.seguro;
                quitar.textContent = ocT("🗑️ quitar");
                original.hidden = tuya || !claves(k).some((c) => datos.cambiadas && datos.cambiadas[c]);
            };
            // Un textarea (una cosa por línea) con su etiqueta.
            const area = (id, texto, valor, filas) => {
                const et = PM.crear("label", "oc-dados-etiqueta", texto);
                const x = PM.crear("textarea", "oc-dados-texto");
                x.id = "master-nombres-" + id + "-" + m.id;
                x.rows = filas || 4;
                x.value = valor || "";
                et.htmlFor = x.id;
                form.append(et, x);
                return x;
            };
            const cerrarForm = (vuelta) => {
                form.hidden = true;
                form.replaceChildren();
                (vuelta || cambiar).focus();
            };
            const botonesForm = (vuelta) => {
                const ok = PM.crear("button", "oc-vida-accion es-principal", ocT("✓ guardar"));
                ok.type = "submit";
                const b = PM.crear("div", "master-creador-barra");
                b.append(ok, PM.botonDe("oc-vida-accion", ocT("cancelar"), () => cerrarForm(vuelta)));
                form.appendChild(b);
            };
            function editarTuya(t) {
                form.replaceChildren(PM.crear("h3", "master-nombres-titulo", t ? "✎ " + t.nombre : ocT("＋ tabla de nombres")));
                const etN = PM.crear("label", "oc-dados-etiqueta", ocT("nombre de la tabla"));
                const nombre = PM.crear("input", "oc-dados-texto");
                nombre.id = "master-nombres-tnombre-" + m.id;
                nombre.maxLength = 60;
                nombre.placeholder = ocT("Nobles de Cralea");
                nombre.value = t ? t.nombre : "";
                etN.htmlFor = nombre.id;
                let tipo = t ? t.tipo : (que.elegir.value === "personaje" ? "personaje" : "lugar");
                const tipoB = PM.botonesDe(ocT("de qué es"), [["personaje", ocT("👤 personas")], ["lugar", ocT("🏘️ lugares")]], tipo, (v) => {
                    tipo = v;
                    ajustarTipo();
                });
                form.append(etN, nombre, tipoB);
                const j = (k) => (t && t[k] ? t[k].join("\n") : "");
                const persona = [area("delante", ocT("delante, si quieres (títulos: «Sir | Lady» = masculino | femenino; «-» = sin título)"),
                    j("delante"), 3),
                    area("f", ocT("nombres femeninos (uno por línea)"), j("f")), area("m", ocT("nombres masculinos"), j("m")),
                    area("n", ocT("nombres neutros (si quieres)"), j("n"), 3), area("apellidos", ocT("apellidos o casas (si quieres)"), j("apellidos"))];
                const lugar = [area("primera", ocT("nombres o primera parte (uno por línea)"), j("primera")),
                    area("segunda", ocT("segunda parte, si quieres (se pone detrás: «del Norte»)"), j("segunda"))];
                // Cada textarea va con su etiqueta justo delante.
                const ajustarTipo = () => {
                    persona.forEach((x) => {
                        x.hidden = x.previousSibling.hidden = tipo !== "personaje";
                    });
                    lugar.forEach((x) => {
                        x.hidden = x.previousSibling.hidden = tipo !== "lugar";
                    });
                };
                ajustarTipo();
                botonesForm(t ? cambiar : nueva);
                form.onsubmit = (e) => {
                    e.preventDefault();
                    const n = nombre.value.trim();
                    const x = { id: t ? t.id : PM.idDoc("n"), nombre: n, tipo };
                    const campos = tipo === "personaje" ? [["delante", 0], ["f", 1], ["m", 2], ["n", 3], ["apellidos", 4]]
                        : [["primera", 0], ["segunda", 1]];
                    campos.forEach(([k, i]) => {
                        x[k] = listaDe((tipo === "personaje" ? persona : lugar)[i].value);
                    });
                    const hay = tipo === "personaje" ? x.f.length + x.m.length + x.n.length : x.primera.length;
                    if (!n || !hay) {
                        PM.avisar(n ? (tipo === "personaje" ? ocT("Pon al menos un nombre.") : ocT("Pon al menos un nombre o una primera parte."))
                            : ocT("Ponle nombre a la tabla."));
                        (n ? (tipo === "personaje" ? persona[1] : lugar[0]) : nombre).focus();
                        return;
                    }
                    const tuyo = PM.leerNombresTuyos();
                    const i = tuyo.propias.findIndex((y) => y.id === x.id);
                    if (i >= 0) {
                        tuyo.propias[i] = x;
                    } else {
                        tuyo.propias.push(x);
                    }
                    if (tipo === "personaje") {
                        d.que = "personaje";
                        d.especie = "propia:" + x.id;
                    } else {
                        d.que = "propia:" + x.id;
                    }
                    PM.guardar();
                    alGenerar = true;
                    if (guardarNombresTuyos(tuyo)) {
                        PM.avisar(ocT("Tabla guardada: {n}.", { n: n }));
                    }
                };
                form.hidden = false;
                nombre.focus();
            }
            // Una de las de siempre (sílabas y trozos de nombres.json): cada
            // lista, un textarea; se guarda solo lo que cambia.
            // Las segundas partes («del Roble») son fijas en los datos: se
            // enseñan en el idioma de la app.
            const verDe = (campo, e) => (campo === "de" && typeof e === "string" ? PM.verDato(e) : e);
            function editarDeSiempre(k) {
                const esPersona = que.elegir.value === "personaje";
                const partes = claves(k).map((c) => {
                    const [g, kk] = c.split("/");
                    return { c, g, actual: datos[g][kk], orig: datos.original[g][kk] };
                }).filter((x) => x.actual);
                const titulo = esPersona ? datos.especies[k].nombre : datos.lugares[k].nombre;
                form.replaceChildren(PM.crear("h3", "master-nombres-titulo", ocT("✎ {titulo} (la de siempre)", { titulo: titulo })),
                    PM.crear("p", "oc-hoja-nota", ocT("Una cosa por línea. Lo cambiado se guarda con tus cosas y lo usan también los PNJ, los negocios y los dungeons; «↺ como venía» lo deshace.{n}", { n: esPersona ? ocT(" Los apellidos son de todas las especies que los comparten.") : "" })));
                const campos = [];
                partes.forEach((p) => {
                    Object.keys(p.actual).forEach((campo) => {
                        const v = p.actual[campo];
                        if (!Array.isArray(v)) {
                            return;
                        }
                        const pares = v.some(Array.isArray);
                        const etiqueta = (p.g === "apellidos" ? ocT("apellido: ") : "") + ((k === "taberna" && CAMPOS_TABERNA[campo])
                            || (p.g === "apellidos" && campo === "ini" ? ocT("primera parte") : CAMPOS_NOMBRES[campo]) || campo);
                        const x = area(p.c.replace("/", "-") + "-" + campo, etiqueta,
                            v.map((e) => (Array.isArray(e) ? e.join(" | ") : verDe(campo, e))).join("\n"), Math.round(Math.min(6, Math.max(3, v.length / 4))));
                        campos.push({ p, campo, pares, x });
                    });
                });
                botonesForm(cambiar);
                form.onsubmit = (e) => {
                    e.preventDefault();
                    const tuyo = PM.leerNombresTuyos();
                    for (const f of campos) {
                        const lista = listaDe(f.x.value).map((l) => (f.pares ? l.split("|").map((s) => s.trim()) : l));
                        if (!lista.length || (f.pares && lista.some((x) => x.length < 2))) {
                            PM.avisar(lista.length ? ocT("En «{textContent}», cada línea con sus dos partes: «a | b».", { textContent: f.x.previousSibling.textContent })
                                : ocT("«{textContent}» no puede quedarse vacío.", { textContent: f.x.previousSibling.textContent }));
                            f.x.focus();
                            return;
                        }
                        const igual = JSON.stringify(lista) === JSON.stringify(f.p.orig[f.campo].map((e) => verDe(f.campo, e)));
                        const c = tuyo.cambios[f.p.c] = tuyo.cambios[f.p.c] || {};
                        if (igual) {
                            delete c[f.campo];
                        } else {
                            c[f.campo] = lista;
                        }
                    }
                    Object.keys(tuyo.cambios).forEach((c) => {
                        if (!Object.keys(tuyo.cambios[c]).length) {
                            delete tuyo.cambios[c];
                        }
                    });
                    alGenerar = true;
                    if (guardarNombresTuyos(tuyo)) {
                        PM.avisar(ocT("Guardado: {titulo}.", { titulo: titulo }));
                    }
                };
                form.hidden = false;
                const primero = form.querySelector("textarea");
                if (primero) {
                    primero.focus();
                }
            }

            const ajustar = () => {
                persona.hidden = que.elegir.value !== "personaje";
                lengua.hidden = !persona.hidden;
                // Las tuyas de personas: el apellido, solo si tienen.
                const tuya = PM.propiaDe(datos, especie.elegir.value);
                etAp.hidden = !!tuya && !(tuya.apellidos || []).length;
                ajustarBarra();
            };
            que.elegir.addEventListener("change", () => {
                recordar();
                PM.guardar();
                ajustar();
            });
            especie.elegir.addEventListener("change", () => {
                recordar();
                PM.guardar();
                ajustar();
            });
            const arriba = PM.crear("div", "master-nombres-form");
            arriba.append(que, persona, lengua, generar);
            dentro.replaceChildren(arriba, lista, guardadosT, guardados, barra, form);
            ajustar();
            pintar();
            if (alGenerar) {
                alGenerar = false;
                generar.focus();
            }
        }
        cargar();
        PM.mientrasEste(dentro, "master:nombres", cargar);
    }

    Object.assign(PM, { montarNombres });
})();
