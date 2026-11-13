// =========================================
// LA VENTANA «musica» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    const minutos = (s) => (isFinite(s) ? Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0") : "0:00");
    // «1:30», «90» o «1:30.5» → segundos (0 si está en blanco, null si no se entiende).
    function segundosDe(texto) {
        const t = String(texto || "").trim().replace(",", ".");
        if (!t) {
            return 0;
        }
        const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(t);
        if (!m) {
            return null;
        }
        return Math.round(((parseInt(m[1] || "0", 10) * 60) + parseFloat(m[2])) * 10) / 10;
    }

    function montarMusica(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        d.plegadas = Array.isArray(d.plegadas) ? d.plegadas : [];
        d.modo = ["una", "carpeta", "nada"].includes(d.modo) ? d.modo : "carpeta";
        PM.MUSICA.modo = d.modo;
        PM.MUSICA.aleatorio = !!d.aleatorio;
        PM.MUSICA.fundido = PM.FUNDIDOS.includes(d.fundido) ? d.fundido : 2;
        PM.MUSICA.agachar = PM.AGACHAR.some((x) => x[0] === d.agachar) ? d.agachar : 0.4;
        const mu = PM.musicaDe();
        if (!window.Audio) {
            dentro.appendChild(PM.crear("p", "oc-vacio", ocT("Este navegador no puede poner música.")));
            return;
        }
        // EL REPRODUCTOR.
        const repro = PM.crear("div", "master-musica-repro");
        const ahora = PM.crear("p", "master-musica-ahora");
        const mandos = PM.crear("div", "master-musica-mandos");
        const ant = PM.botonDe("master-musica-mando", "⏮", PM.musicaAnterior, ocT("Anterior"));
        const tocar = PM.botonDe("master-musica-mando es-grande", "▶", PM.musicaAlternar, ocT("Reproducir"));
        const sig = PM.botonDe("master-musica-mando", "⏭", () => PM.musicaSiguiente(false), ocT("Siguiente"));
        const parar = PM.botonDe("master-musica-mando", "■", () => {
            PM.musicaParar(true);
            PM.avisar(ocT("Música parada."));
        }, ocT("Parar"));
        const barra = PM.crear("input", "master-musica-barra");
        barra.type = "range";
        barra.min = 0;
        barra.max = 1000;
        barra.value = 0;
        barra.setAttribute("aria-label", ocT("Por dónde va"));
        // Mientras se arrastra con el ratón o el dedo, no se repinta (si no,
        // salta); al soltar, vuelve a seguir a la canción.
        let arrastrando = false;
        barra.addEventListener("pointerdown", () => {
            arrastrando = true;
        });
        const soltar = () => {
            arrastrando = false;
        };
        barra.addEventListener("pointerup", soltar);
        barra.addEventListener("pointercancel", soltar);
        barra.addEventListener("change", soltar);
        barra.addEventListener("input", () => {
            const a = PM.MUSICA.audio;
            if (a && isFinite(a.duration)) {
                a.currentTime = a.duration * barra.value / 1000;
            }
        });
        const tiempo = PM.crear("span", "master-musica-tiempo", "0:00 / 0:00");
        tiempo.setAttribute("aria-hidden", "true");
        mandos.append(ant, tocar, sig, parar, barra, tiempo);
        // Volumen y cómo se repite.
        const abajo = PM.crear("div", "master-ambiente-arriba");
        const etV = PM.crear("label", "master-ambiente-general");
        const vol = PM.crear("input");
        vol.type = "range";
        vol.min = 0;
        vol.max = 100;
        vol.value = d.vol === undefined ? 80 : d.vol;
        vol.setAttribute("aria-label", ocT("Volumen de la música"));
        vol.setAttribute("aria-valuetext", vol.value + " %");
        etV.append(PM.crear("span", "", ocT("🔊 volumen")), vol);
        const ponerVol = () => {
            PM.MUSICA.volumen = vol.value / 100;
            PM.musicaVol();
        };
        vol.addEventListener("input", () => {
            d.vol = Number(vol.value);
            vol.setAttribute("aria-valuetext", vol.value + " %");
            ponerVol();
            PM.guardar();
        });
        const modos = PM.crear("div", "master-musica-modos");
        modos.setAttribute("role", "group");
        modos.setAttribute("aria-label", ocT("Repetir"));
        const botonesModo = [["una", ocT("🔂 la canción")], ["carpeta", ocT("🔁 la carpeta")], ["nada", ocT("➡️ sin repetir")]].map(([v, t]) => {
            const b = PM.botonDe("master-musica-modo", t, () => {
                d.modo = v;
                PM.MUSICA.modo = v;
                PM.musicaBucle();
                PM.guardar();
                pintarModo();
                PM.avisar(v === "una" ? ocT("Se repite la canción.") : v === "carpeta" ? ocT("Se repite la carpeta entera.") : ocT("Sin repetir: al acabar la carpeta, se para."));
            });
            b.dataset.modo = v;
            return b;
        });
        modos.append(...botonesModo);
        function pintarModo() {
            botonesModo.forEach((b) => b.setAttribute("aria-pressed", b.dataset.modo === d.modo ? "true" : "false"));
        }
        // Sacar el reproductor a su ventana (para compartirla en Discord
        // u OBS sin enseñar la pantalla).
        const fuera = PM.botonDe("oc-vida-accion", ocT("🪟 en otra ventana"), () => {
            const w = window.open("reproductor.html", "pantalla-master-reproductor", "popup,width=440,height=640");
            if (w) {
                w.focus();
                PM.avisar(ocT("El reproductor, en su ventana: compártela en Discord u OBS. La música sigue sonando aquí."));
            } else {
                PM.avisar(ocT("El navegador no ha dejado abrir la ventana: permite las ventanas emergentes de esta página."));
            }
        }, ocT("Abrir el reproductor en una ventana aparte (para compartirla en Discord u OBS)"));
        // 🔀 aleatorio, el fundido y cuánto baja con los efectos.
        const alAzar = PM.botonDe("master-musica-modo", ocT("🔀 aleatorio"), () => {
            PM.musicaAjustar({ aleatorio: !PM.MUSICA.aleatorio });
            PM.avisar(PM.MUSICA.aleatorio ? ocT("En aleatorio.") : ocT("En orden."));
        }, ocT("Aleatorio"));
        const elegirAjuste = (id, texto, opciones, valor, cambio) => {
            const caja = PM.crear("label", "master-musica-ajuste");
            const sel = PM.crear("select", "oc-dados-elegir");
            sel.id = id + m.id;
            opciones.forEach(([v, t]) => {
                const o = PM.crear("option", "", t);
                o.value = String(v);
                sel.appendChild(o);
            });
            sel.value = String(valor);
            sel.addEventListener("change", () => cambio(Number(sel.value)));
            caja.append(PM.crear("span", "", texto), sel);
            caja.sel = sel;
            return caja;
        };
        const fundidoS = elegirAjuste("master-musica-fundido-", ocT("🌫️ fundido"), PM.FUNDIDOS.map((x) => [x, x ? x + " s" : ocT("sin fundido")]),
            PM.MUSICA.fundido, (v) => PM.musicaAjustar({ fundido: v }));
        const agacharS = elegirAjuste("master-musica-agachar-", ocT("💥 con efectos"), PM.AGACHAR, PM.MUSICA.agachar,
            (v) => PM.musicaAjustar({ agachar: v }));
        const ajustes = PM.crear("div", "master-musica-ajustes");
        ajustes.append(alAzar, fundidoS, agacharS);
        abajo.append(etV, modos, fuera);
        repro.append(ahora, mandos, abajo, ajustes);

        // LAS CARPETAS Y CANCIONES.
        const herramientas = PM.crear("div", "master-musica-herramientas");
        const nuevaCarpeta = PM.botonDe("oc-vida-accion", ocT("＋ 📁 carpeta"), () => formulario({ tipo: "carpeta", padre: "" }),
            ocT("Nueva carpeta"));
        const subirRaiz = PM.botonDe("oc-vida-accion", ocT("＋ 🎵 canciones"), () => subirA(""), ocT("Añadir canciones (te pregunto la carpeta)"));
        // Dos vistas: TARJETAS (como un panel de sonidos: cada carpeta y
        // canción, un botón grande con su imagen o su emoji) y LISTA (el
        // árbol). Se recuerda en d.vista.
        const vistas = PM.crear("div", "master-musica-modos");
        vistas.setAttribute("role", "group");
        vistas.setAttribute("aria-label", ocT("Vista"));
        const botonesVista = [["tarjetas", ocT("▦ tarjetas")], ["lista", ocT("☰ lista")]].map(([v, t]) => {
            const b = PM.botonDe("master-musica-modo", t, () => {
                d.vista = v;
                PM.guardar();
                pintarArbol();
            });
            b.dataset.vista = v;
            return b;
        });
        vistas.append(...botonesVista);
        herramientas.append(nuevaCarpeta, subirRaiz, vistas);
        // 🔍 BUSCAR una canción en todas las carpetas.
        const busca = PM.crear("div", "master-musica-busca");
        const buscar = PM.crear("input", "oc-dados-texto");
        buscar.type = "search";
        buscar.id = "master-musica-buscar-" + m.id;
        buscar.placeholder = ocT("🔍 buscar una canción…");
        buscar.autocomplete = "off";
        const etBusca = PM.crear("label", "visually-hidden", ocT("Buscar una canción"));
        etBusca.htmlFor = buscar.id;
        busca.append(etBusca, buscar);
        const resultados = PM.crear("ul", "master-musica-resultados");
        resultados.setAttribute("aria-label", ocT("Canciones encontradas"));
        resultados.hidden = true;
        const cuantos = PM.crear("p", "visually-hidden");
        cuantos.setAttribute("role", "status");
        buscar.addEventListener("input", () => pintarArbol());
        // Canciones que llegan de fuera («Abrir con», en la app de Android).
        PM.mientrasEste(dentro, "master:musica", () => pintarArbol());
        buscar.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && buscar.value) {
                e.preventDefault();
                buscar.value = "";
                pintarArbol();
            }
        });
        const rutaDe = (id) => {
            const pasos = [];
            let x = mu.carpetas.find((c) => c.id === id);
            while (x) {
                pasos.unshift(x.nombre);
                x = mu.carpetas.find((c) => c.id === x.padre);
            }
            return pasos.join(" › ");
        };
        function pintarResultados(q) {
            const vistas2 = mu.canciones.filter((c) => PM.llano(c.nombre + " " + rutaDe(c.carpeta || "")).includes(q)).slice(0, 60);
            resultados.replaceChildren(...vistas2.map((c) => {
                const li = PM.crear("li", "master-musica-cancion");
                const b = PM.botonDe("master-musica-tocar", "", () => {
                    const actual = PM.musicaActual();
                    if (actual && actual.id === c.id) {
                        PM.musicaAlternar();
                        return;
                    }
                    const cola = PM.cancionesDe(c.carpeta || "");
                    PM.musicaPoner(cola, cola.indexOf(c), c.carpeta || "");
                    PM.avisar(ocT("Suena: {nombre}.", { nombre: c.nombre }));
                });
                b.dataset.cancion = c.id;
                const em = PM.crear("span", "master-ambiente-emoji", c.icono || "🎵");
                em.setAttribute("aria-hidden", "true");
                const ruta = rutaDe(c.carpeta || "");
                b.append(em, PM.crear("span", "", c.nombre), PM.crear("span", "master-musica-cuenta", ruta ? " · 📁 " + ruta : ""));
                li.append(b, PM.botonDe("master-docs-mando", "✎", () => formulario({ tipo: "cancion", id: c.id }),
                    ocT("Cambiar el nombre, la carpeta o los puntos de {nombre}", { nombre: c.nombre })));
                return li;
            }));
            if (!vistas2.length) {
                resultados.appendChild(PM.crear("li", "oc-vacio", ocT("Ninguna canción con eso.")));
            }
            cuantos.textContent = vistas2.length + (vistas2.length === 1 ? ocT(" canción encontrada.") : ocT(" canciones encontradas."));
        }
        const form = PM.crear("form", "master-musica-form");
        form.hidden = true;
        const arbol = PM.crear("ul", "master-musica-arbol");
        arbol.setAttribute("aria-label", ocT("Carpetas y canciones"));
        const vacio = PM.crear("p", "oc-hoja-nota", ocT("Aún no hay canciones. Haz carpetas (por ejemplo «combate» o «tabernas», con subcarpetas) y añade tus audios."));
        const subir = PM.crear("input");
        subir.type = "file";
        subir.accept = "audio/*";
        subir.multiple = true;
        subir.hidden = true;
        let destino = "";
        // Las canciones van siempre en una carpeta: sin ella, se pregunta
        // (una de las que hay o una nueva) y luego se eligen los audios.
        function subirA(carpeta) {
            if (carpeta) {
                destino = carpeta;
                subir.click();
                return;
            }
            volverA = document.activeElement;
            const titulo = PM.crear("p", "master-musica-form-titulo", ocT("＋ 🎵 ¿en qué carpeta van?"));
            const nueva = "__nueva";
            const donde = PM.elegirDe("master-musica-destino", ocT("carpeta"), opcionesDeCarpeta("").slice(1)
                .concat([[nueva, ocT("＋ 📁 una carpeta nueva…")]]), mu.carpetas.length ? opcionesDeCarpeta("")[1][0] : nueva);
            const etN = PM.crear("label", "oc-dados-etiqueta", ocT("nombre de la carpeta nueva"));
            const nombre = PM.crear("input", "oc-dados-texto");
            nombre.id = "master-musica-destino-nombre";
            nombre.maxLength = 80;
            nombre.autocomplete = "off";
            etN.htmlFor = nombre.id;
            const cajaN = PM.crear("div", "master-campo");
            cajaN.append(etN, nombre);
            const verNueva = () => {
                cajaN.hidden = donde.elegir.value !== nueva;
            };
            donde.elegir.addEventListener("change", verNueva);
            verNueva();
            const ok = PM.crear("button", "oc-vida-accion es-principal", ocT("🎵 elegir los audios"));
            ok.type = "submit";
            const fila = PM.crear("div", "master-musica-form-botones");
            fila.append(ok, PM.botonDe("oc-vida-accion", ocT("cancelar"), cerrar));
            form.replaceChildren(titulo, donde, cajaN, fila);
            form.onsubmit = (e) => {
                e.preventDefault();
                let id = donde.elegir.value;
                if (id === nueva) {
                    const n = nombre.value.trim();
                    if (!n) {
                        PM.avisar(ocT("Ponle un nombre a la carpeta."));
                        nombre.focus();
                        return;
                    }
                    id = PM.idDoc("m");
                    mu.carpetas.push({ id, nombre: n, padre: "" });
                    PM.guardar();
                    pintarArbol();
                    PM.avisar(ocT("Carpeta creada: {n}.", { n: n }));
                }
                form.hidden = true;
                destino = id;
                subir.click();
            };
            form.onkeydown = (e) => {
                if (e.key === "Escape") {
                    e.preventDefault();
                    cerrar();
                }
            };
            form.hidden = false;
            donde.elegir.focus();
        }
        subir.addEventListener("change", () => {
            const fs = Array.from(subir.files || []);
            subir.value = "";
            const buenos = fs.filter((f) => /^audio\//.test(f.type) && f.size <= PM.MAX_ARCHIVO);
            if (buenos.length < fs.length) {
                PM.avisar(ocT("Sólo audios de hasta 50 MB cada uno."));
            }
            Promise.all(buenos.map((f) => {
                const id = PM.idDoc("a");
                return PM.archivoGuardar(id, f).then(() => {
                    mu.canciones.push({ id, archivo: id, nombre: f.name.replace(/\.[^.]+$/, "").slice(0, 80) || ocT("canción"),
                        carpeta: destino || "" });
                });
            })).then(() => {
                if (!buenos.length) {
                    return;
                }
                d.plegadas = d.plegadas.filter((x) => x !== destino);
                PM.guardar();
                pintarArbol();
                PM.avisar(ocT("Añadidas {n} canciones (con ✎ les cambias el nombre). Se quedan sólo en este dispositivo (⚙ → exportar para no perderlas).", { n: buenos.length }));
            }).catch(() => PM.avisar(ocT("No se han podido guardar (¿no queda sitio en el navegador?).")));
        });
        // Las carpetas para elegir dónde va algo (sin la propia ni las de dentro).
        function opcionesDeCarpeta(sin) {
            const salida = [["", ocT("— ninguna (arriba del todo)")]];
            const meter = (padre, nivel) => mu.carpetas.filter((c) => (c.padre || "") === padre && c.id !== sin).forEach((c) => {
                salida.push([c.id, "  ".repeat(nivel) + "📁 " + c.nombre]);
                meter(c.id, nivel + 1);
            });
            meter("", 0);
            return salida;
        }
        // Crear o cambiar una carpeta o una canción: el nombre y dónde va.
        let volverA = null;
        function formulario(x) {
            volverA = document.activeElement;
            const esCarpeta = x.tipo === "carpeta";
            const cosa = x.id ? (esCarpeta ? mu.carpetas : mu.canciones).find((c) => c.id === x.id) : null;
            const titulo = PM.crear("p", "master-musica-form-titulo", cosa ? "✎ " + cosa.nombre : ocT("＋ 📁 nueva carpeta"));
            const et = PM.crear("label", "oc-dados-etiqueta", "nombre");
            const input = PM.crear("input", "oc-dados-texto");
            input.id = "master-musica-nombre";
            input.maxLength = 80;
            input.autocomplete = "off";
            input.value = cosa ? cosa.nombre : "";
            et.htmlFor = input.id;
            const sitios = opcionesDeCarpeta(esCarpeta && cosa ? cosa.id : "");
            if (!esCarpeta && cosa && cosa.carpeta && sitios.length > 1) {
                sitios.shift();
            }
            const donde = PM.elegirDe("master-musica-donde", esCarpeta ? ocT("dentro de") : ocT("en la carpeta"), sitios,
                cosa ? (esCarpeta ? cosa.padre : cosa.carpeta) || "" : x.padre || "");
            const ok = PM.crear("button", "oc-vida-accion es-principal", ocT("✓ guardar"));
            ok.type = "submit";
            const no = PM.botonDe("oc-vida-accion", ocT("cancelar"), cerrar);
            const fila = PM.crear("div", "master-musica-form-botones");
            fila.append(ok, no);
            // Los puntos de inicio y final de una canción (para saltarse
            // una intro larga o un silencio al final).
            const puntos = PM.crear("fieldset", "master-musica-puntos");
            const campos = {};
            if (!esCarpeta && cosa) {
                const suena = () => PM.musicaActual() && PM.musicaActual().id === cosa.id && PM.MUSICA.audio;
                puntos.appendChild(PM.crear("legend", "", ocT("⏱ por dónde empieza y acaba (min:seg)")));
                [["inicio", ocT("empieza en"), "0:00"], ["fin", ocT("acaba en"), ocT("hasta el final")]].forEach(([k, t, ph]) => {
                    const caja = PM.crear("div", "master-musica-punto");
                    const etP = PM.crear("label", "oc-dados-etiqueta", t);
                    const inp = PM.crear("input", "oc-dados-texto");
                    inp.id = "master-musica-" + k + "-" + m.id;
                    inp.inputMode = "decimal";
                    inp.autocomplete = "off";
                    inp.placeholder = ph;
                    inp.value = cosa[k] ? minutos(cosa[k]) : "";
                    etP.htmlFor = inp.id;
                    const yaB = PM.botonDe("master-docs-mando es-texto", ocT("⏱ ahora"), () => {
                        if (!suena()) {
                            PM.avisar(ocT("Pon esta canción para coger el punto por donde va."));
                            return;
                        }
                        inp.value = minutos(PM.MUSICA.audio.currentTime);
                        PM.avisar(t + ": " + inp.value + ".");
                    }, t + ocT(": por donde va ahora la canción"));
                    caja.append(etP, inp, yaB);
                    puntos.appendChild(caja);
                    campos[k] = inp;
                });
            }
            form.replaceChildren(titulo, et, input, donde);
            if (campos.inicio) {
                form.appendChild(puntos);
            }
            form.appendChild(fila);
            form.onsubmit = (e) => {
                e.preventDefault();
                const nombre = input.value.trim();
                if (!nombre) {
                    PM.avisar(ocT("Ponle un nombre."));
                    input.focus();
                    return;
                }
                const sitio = donde.elegir.value;
                let id = x.id;
                if (campos.inicio) {
                    const ini = segundosDe(campos.inicio.value);
                    const fin = segundosDe(campos.fin.value);
                    if (ini === null || fin === null) {
                        PM.avisar(ocT("Escribe los puntos como 1:30 (minutos y segundos) o déjalos en blanco."));
                        (ini === null ? campos.inicio : campos.fin).focus();
                        return;
                    }
                    if (fin && fin <= ini + 1) {
                        PM.avisar(ocT("El final tiene que ir después del inicio."));
                        campos.fin.focus();
                        return;
                    }
                    ["inicio", "fin"].forEach((k, i) => {
                        const v = [ini, fin][i];
                        if (v) {
                            cosa[k] = v;
                        } else {
                            delete cosa[k];
                        }
                    });
                    PM.musicaBucle();
                }
                if (cosa) {
                    cosa.nombre = nombre;
                    cosa[esCarpeta ? "padre" : "carpeta"] = sitio;
                } else {
                    id = PM.idDoc("m");
                    mu.carpetas.push({ id, nombre, padre: sitio });
                }
                d.plegadas = d.plegadas.filter((p) => p !== sitio);
                PM.guardar();
                form.hidden = true;
                pintarArbol();
                PM.avisar((cosa ? ocT("Guardado: ") : ocT("Carpeta creada: ")) + nombre + ".");
                const b = dentro.querySelector("[data-foco='" + id + "']:not([hidden] *)");
                (b || nuevaCarpeta).focus();
            };
            form.onkeydown = (e) => {
                if (e.key === "Escape") {
                    e.preventDefault();
                    cerrar();
                }
            };
            form.hidden = false;
            input.focus();
        }
        function cerrar() {
            form.hidden = true;
            if (volverA && volverA.isConnected) {
                volverA.focus();
            } else {
                nuevaCarpeta.focus();
            }
        }
        // Borrar con dos pulsaciones.
        function botonQuitar(nombre, hacer) {
            let seguro = false;
            const b = PM.botonDe("master-docs-mando", "✕", () => {
                if (!seguro) {
                    seguro = true;
                    b.classList.add("es-seguro");
                    PM.avisar(ocT("Pulsa otra vez para quitar {nombre}.", { nombre: nombre }));
                    return;
                }
                hacer();
            }, ocT("Quitar {nombre}", { nombre: nombre }));
            return b;
        }
        function quitarCarpeta(c) {
            const ids = [];
            const juntar = (id) => {
                ids.push(id);
                mu.carpetas.filter((x) => x.padre === id).forEach((x) => juntar(x.id));
            };
            juntar(c.id);
            const fuera = mu.canciones.filter((x) => ids.includes(x.carpeta));
            fuera.forEach((x) => PM.archivoBorrar(x.archivo));
            if (fuera.some((x) => PM.musicaActual() && PM.musicaActual().id === x.id)) {
                PM.musicaParar();
            }
            mu.canciones = mu.canciones.filter((x) => !ids.includes(x.carpeta));
            mu.carpetas = mu.carpetas.filter((x) => !ids.includes(x.id));
            PM.guardar();
            pintarArbol();
            PM.avisar(ocT("Quitada la carpeta {nombre}{n}", { nombre: c.nombre, n: fuera.length ? ocT(" y sus {n} canciones.", { n: fuera.length }) : "." }));
            nuevaCarpeta.focus();
        }
        function filaCancion(c) {
            const li = PM.crear("li", "master-musica-cancion");
            const b = PM.botonDe("master-musica-tocar", "", () => {
                const cola = PM.cancionesDe(c.carpeta || "");
                PM.musicaPoner(cola, cola.indexOf(c), c.carpeta || "");
                PM.avisar(ocT("Suena: {nombre}.", { nombre: c.nombre }));
            });
            b.dataset.foco = c.id;
            b.dataset.cancion = c.id;
            const em = PM.crear("span", "master-ambiente-emoji", "🎵");
            em.setAttribute("aria-hidden", "true");
            b.append(em, PM.crear("span", "", c.nombre));
            const editar = PM.botonDe("master-docs-mando", "✎", () => formulario({ tipo: "cancion", id: c.id }),
                ocT("Cambiar el nombre, la carpeta o los puntos de {nombre}", { nombre: c.nombre }));
            const quitar = botonQuitar(c.nombre, () => {
                if (PM.musicaActual() && PM.musicaActual().id === c.id) {
                    PM.musicaParar();
                }
                PM.archivoBorrar(c.archivo);
                mu.canciones = mu.canciones.filter((x) => x !== c);
                PM.guardar();
                pintarArbol();
                PM.avisar(ocT("Quitada: {nombre}.", { nombre: c.nombre }));
                nuevaCarpeta.focus();
            });
            li.append(b, editar, quitar);
            return li;
        }
        function filaCarpeta(c) {
            const li = PM.crear("li", "master-musica-carpeta");
            const cab = PM.crear("div", "master-musica-cabeza");
            const abierta = !d.plegadas.includes(c.id);
            const total = PM.cancionesDe(c.id).length;
            const dentroUl = PM.crear("ul", "master-musica-dentro");
            dentroUl.id = "master-musica-" + m.id + "-" + c.id;
            dentroUl.hidden = !abierta;
            const plegar = PM.botonDe("master-musica-plegar", "", () => {
                const ya = d.plegadas.includes(c.id);
                d.plegadas = ya ? d.plegadas.filter((x) => x !== c.id) : d.plegadas.concat(c.id);
                dentroUl.hidden = !ya;
                plegar.setAttribute("aria-expanded", ya ? "true" : "false");
                PM.guardar();
            });
            plegar.dataset.foco = c.id;
            plegar.setAttribute("aria-expanded", abierta ? "true" : "false");
            plegar.setAttribute("aria-controls", dentroUl.id);
            const flecha = PM.crear("span", "master-musica-flecha", "▸");
            flecha.setAttribute("aria-hidden", "true");
            plegar.append(flecha, PM.crear("span", "", "📁 " + c.nombre), PM.crear("span", "master-musica-cuenta", " (" + total + ")"));
            const tocarC = PM.botonDe("master-docs-mando", "▶", () => {
                const cola = PM.cancionesDe(c.id);
                if (!cola.length) {
                    PM.avisar(ocT("La carpeta {nombre} está vacía.", { nombre: c.nombre }));
                    return;
                }
                PM.musicaCarpeta(cola, c.id);
                PM.avisar(ocT("Suena la carpeta {nombre}: {n} canciones.", { nombre: c.nombre, n: cola.length }));
            }, ocT("Reproducir la carpeta {nombre}", { nombre: c.nombre }));
            const mas = PM.botonDe("master-docs-mando es-texto", "＋🎵", () => subirA(c.id), ocT("Añadir canciones a {nombre}", { nombre: c.nombre }));
            const sub = PM.botonDe("master-docs-mando es-texto", "＋📁", () => formulario({ tipo: "carpeta", padre: c.id }),
                ocT("Nueva subcarpeta en {nombre}", { nombre: c.nombre }));
            const editar = PM.botonDe("master-docs-mando", "✎", () => formulario({ tipo: "carpeta", id: c.id }),
                ocT("Cambiar el nombre o el sitio de {nombre}", { nombre: c.nombre }));
            cab.append(plegar, tocarC, mas, sub, editar, botonQuitar(ocT("la carpeta {nombre}", { nombre: c.nombre }), () => quitarCarpeta(c)));
            dentroUl.append(...ramas(c.id));
            li.append(cab, dentroUl);
            return li;
        }
        const ramas = (padre) => mu.carpetas.filter((c) => (c.padre || "") === padre).map(filaCarpeta)
            .concat(mu.canciones.filter((c) => (c.carpeta || "") === padre).map(filaCancion));
        // ---- LA VISTA DE TARJETAS: la carpeta en la que se está (con su
        // camino arriba para volver), sus subcarpetas y sus canciones. Al
        // pulsar una carpeta se entra; ▶ la pone entera. Al pulsar una
        // canción suena (o se pausa, si ya sonaba). 🎨 le pone un emoji o
        // una imagen tuya. ----
        const tarjetas = PM.crear("div", "master-musica-tarjetas-caja");
        const camino = PM.crear("nav", "master-musica-camino");
        camino.setAttribute("aria-label", ocT("Dónde estás"));
        const rejilla = PM.crear("ul", "master-musica-tarjetas");
        const enCarpeta = PM.crear("div", "master-creador-barra");
        tarjetas.append(camino, enCarpeta, rejilla);
        function aspecto(cosa, emojiDe) {
            const caja = PM.crear("span", "master-musica-icono");
            caja.setAttribute("aria-hidden", "true");
            if (cosa.imagen) {
                const img = PM.crear("img");
                img.alt = "";
                PM.imagenMusica(cosa.imagen).then((u) => {
                    if (u) {
                        const archivoBlob = u;
                        img.src = archivoBlob;
                    } else {
                        caja.textContent = cosa.icono || emojiDe;
                    }
                });
                caja.appendChild(img);
            } else {
                caja.textContent = cosa.icono || emojiDe;
            }
            return caja;
        }
        function pintarTarjetas() {
            const aqui = d.carpeta && mu.carpetas.find((c) => c.id === d.carpeta) ? d.carpeta : "";
            // El camino: 🏠 › Combate › Jefes.
            const pasos = [];
            let x = mu.carpetas.find((c) => c.id === aqui);
            while (x) {
                pasos.unshift(x);
                x = mu.carpetas.find((c) => c.id === x.padre);
            }
            const ir = (id, texto, actual) => {
                const b = PM.botonDe("master-musica-paso", texto, () => {
                    d.carpeta = id;
                    PM.guardar();
                    pintarArbol();
                    const p = camino.querySelector("[aria-current]");
                    (rejilla.querySelector("button") || p || nuevaCarpeta).focus();
                });
                if (actual) {
                    b.setAttribute("aria-current", "location");
                }
                return b;
            };
            camino.replaceChildren(ir("", ocT("🏠 toda la música"), !aqui), ...pasos.flatMap((c, i) => [PM.crear("span", "master-musica-sep",
                "›"), ir(c.id, c.nombre, i === pasos.length - 1)]));
            camino.querySelectorAll(".master-musica-sep").forEach((sp) => sp.setAttribute("aria-hidden", "true"));
            // Lo de esta carpeta.
            const todas = PM.cancionesDe(aqui);
            const aquiNombre = aqui ? mu.carpetas.find((c) => c.id === aqui).nombre : ocT("toda la música");
            enCarpeta.replaceChildren(PM.botonDe("oc-vida-accion", "▶ " + (aqui ? ocT("esta carpeta") : "todo"), () => {
                if (!todas.length) {
                    PM.avisar(ocT("Aquí no hay canciones."));
                    return;
                }
                PM.musicaCarpeta(todas, aqui);
                PM.avisar(ocT("Suena {aquiNombre}: {n} canciones.", { aquiNombre: aquiNombre, n: todas.length }));
            }, ocT("Poner {aquiNombre} entera ({n} canciones)", { aquiNombre: aquiNombre, n: todas.length })),
            PM.botonDe("oc-vida-accion", ocT("＋ 🎵 aquí"), () => subirA(aqui), aqui ? ocT("Añadir canciones a {aquiNombre}", { aquiNombre: aquiNombre }) : ocT("Añadir canciones (te pregunto la carpeta)")),
            PM.botonDe("oc-vida-accion", ocT("＋ 📁 aquí"), () => formulario({ tipo: "carpeta", padre: aqui }), ocT("Nueva carpeta en {aquiNombre}", { aquiNombre: aquiNombre })));
            rejilla.setAttribute("aria-label", ocT("Carpetas y canciones de {aquiNombre}", { aquiNombre: aquiNombre }));
            const items = [];
            mu.carpetas.filter((c) => (c.padre || "") === aqui).forEach((c) => {
                const li = PM.crear("li", "master-musica-tarjeta es-carpeta");
                const n = PM.cancionesDe(c.id).length;
                const b = PM.botonDe("master-musica-tarjeta-boton", "", () => {
                    d.carpeta = c.id;
                    PM.guardar();
                    pintarArbol();
                    (rejilla.querySelector("button") || camino.querySelector("[aria-current]")).focus();
                }, ocT("Abrir la carpeta {nombre} ({n} canciones)", { nombre: c.nombre, n: n }));
                b.dataset.foco = c.id;
                b.append(aspecto(c, "📁"), PM.crear("span", "master-musica-tarjeta-nombre", c.nombre), PM.crear("span",
                    "master-musica-cuenta", n + (n === 1 ? ocT(" canción") : ocT(" canciones"))));
                const mandos2 = PM.crear("div", "master-musica-tarjeta-mandos");
                mandos2.append(PM.botonDe("master-docs-mando", "▶", () => {
                    const cola = PM.cancionesDe(c.id);
                    if (!cola.length) {
                        PM.avisar(ocT("La carpeta {nombre} está vacía.", { nombre: c.nombre }));
                        return;
                    }
                    PM.musicaCarpeta(cola, c.id);
                    PM.avisar(ocT("Suena la carpeta {nombre}.", { nombre: c.nombre }));
                }, ocT("Poner la carpeta {nombre} entera", { nombre: c.nombre })), PM.botonDe("master-docs-mando", "🎨", () => cambiarAspecto(c, "carpeta"),
                    ocT("Poner un emoji o una imagen a {nombre}", { nombre: c.nombre })), PM.botonDe("master-docs-mando", "✎", () => formulario({ tipo: "carpeta",
                    id: c.id }), ocT("Cambiar el nombre o el sitio de {nombre}", { nombre: c.nombre })), botonQuitar(ocT("la carpeta {nombre}", { nombre: c.nombre }),
                    () => quitarCarpeta(c)));
                li.append(b, mandos2);
                items.push(li);
            });
            mu.canciones.filter((c) => (c.carpeta || "") === aqui).forEach((c) => {
                const li = PM.crear("li", "master-musica-tarjeta");
                const b = PM.botonDe("master-musica-tarjeta-boton", "", () => {
                    const actual = PM.musicaActual();
                    if (actual && actual.id === c.id && PM.MUSICA.audio) {
                        PM.musicaAlternar();
                        return;
                    }
                    const cola = PM.cancionesDe(c.carpeta || "");
                    PM.musicaPoner(cola, cola.indexOf(c), c.carpeta || "");
                    PM.avisar(ocT("Suena: {nombre}.", { nombre: c.nombre }));
                });
                b.dataset.foco = c.id;
                b.dataset.cancion = c.id;
                b.append(aspecto(c, "🎵"), PM.crear("span", "master-musica-tarjeta-nombre", c.nombre));
                const mandos2 = PM.crear("div", "master-musica-tarjeta-mandos");
                mandos2.append(PM.botonDe("master-docs-mando", "🎨", () => cambiarAspecto(c, "cancion"), ocT("Poner un emoji o una imagen a {nombre}", { nombre: c.nombre })), PM.botonDe("master-docs-mando", "✎", () => formulario({ tipo: "cancion", id: c.id }),
                    ocT("Cambiar el nombre, la carpeta o los puntos de {nombre}", { nombre: c.nombre })), botonQuitar(c.nombre, () => {
                    if (PM.musicaActual() && PM.musicaActual().id === c.id) {
                        PM.musicaParar();
                    }
                    PM.archivoBorrar(c.archivo);
                    if (c.imagen) {
                        PM.archivoBorrar(c.imagen);
                    }
                    mu.canciones = mu.canciones.filter((x) => x !== c);
                    PM.guardar();
                    pintarArbol();
                    PM.avisar(ocT("Quitada: {nombre}.", { nombre: c.nombre }));
                    nuevaCarpeta.focus();
                }));
                li.append(b, mandos2);
                items.push(li);
            });
            rejilla.replaceChildren(...items);
            if (!items.length) {
                rejilla.appendChild(PM.crear("li", "oc-vacio", ocT("Carpeta vacía: añade canciones o subcarpetas con los botones de arriba.")));
            }
        }
        function cambiarAspecto(cosa, tipo) {
            PM.dialogoAspecto(cosa, ocT("aspecto de {nombre}{n}", { nombre: cosa.nombre, n: tipo === "carpeta" ? ocT(" (carpeta)") : "" }), () => {
                PM.guardar();
                pintarArbol();
                const b = dentro.querySelector("[data-foco='" + cosa.id + "']:not([hidden] *)");
                if (b) {
                    b.focus();
                }
            });
        }

        function pintarArbol() {
            const enTarjetas = d.vista !== "lista";
            botonesVista.forEach((b) => b.setAttribute("aria-pressed", b.dataset.vista === (enTarjetas ? "tarjetas" : "lista")
                ? "true" : "false"));
            const hay = mu.carpetas.length || mu.canciones.length;
            if (enTarjetas) {
                arbol.replaceChildren();
                pintarTarjetas();
            } else {
                arbol.replaceChildren(...ramas(""));
            }
            const q = PM.llano(buscar.value.trim());
            arbol.hidden = !hay || enTarjetas || !!q;
            tarjetas.hidden = !hay || !enTarjetas || !!q;
            vacio.hidden = !!hay;
            busca.hidden = !mu.canciones.length;
            resultados.hidden = !q;
            if (q) {
                pintarResultados(q);
            } else {
                cuantos.textContent = "";
            }
            pintar();
        }
        // Lo que suena ahora, por dónde va y qué canción está marcada.
        function pintar() {
            if (!dentro.isConnected) {
                return;
            }
            const c = PM.musicaActual();
            const a = PM.MUSICA.audio;
            const suena = !!(c && a && !a.paused);
            const carpeta = c && mu.carpetas.find((x) => x.id === PM.MUSICA.origen);
            ahora.textContent = c ? ocT("{n} ({n2} de {n3})", { n: (suena ? "▶ " : "⏸ ") + c.nombre + (carpeta ? " · 📁 " + carpeta.nombre : ""), n2: PM.MUSICA.pos + 1, n3: PM.MUSICA.cola.length }) : ocT("Nada sonando.");
            tocar.textContent = suena ? "⏸" : "▶";
            tocar.setAttribute("aria-label", suena ? "Pausa" : "Reproducir");
            // Lo que se cambie desde la ventana aparte (volumen y repetir).
            if (document.activeElement !== vol && Math.round(PM.MUSICA.volumen * 100) !== Number(vol.value)) {
                vol.value = Math.round(PM.MUSICA.volumen * 100);
            }
            d.modo = PM.MUSICA.modo;
            pintarModo();
            alAzar.setAttribute("aria-pressed", PM.MUSICA.aleatorio ? "true" : "false");
            if (document.activeElement !== fundidoS.sel) {
                fundidoS.sel.value = String(PM.MUSICA.fundido);
            }
            if (document.activeElement !== agacharS.sel) {
                agacharS.sel.value = String(PM.MUSICA.agachar);
            }
            const dur = a && isFinite(a.duration) ? a.duration : 0;
            const t = a && c ? a.currentTime : 0;
            if (!arrastrando) {
                barra.value = dur ? Math.round(t / dur * 1000) : 0;
            }
            barra.setAttribute("aria-valuetext", minutos(t) + ocT(" de ") + minutos(dur));
            tiempo.textContent = minutos(t) + " / " + minutos(dur);
            dentro.querySelectorAll("[data-cancion]").forEach((b) => {
                const es = !!c && b.dataset.cancion === c.id;
                b.closest("li").classList.toggle("es-sonando", es);
                if (es) {
                    b.setAttribute("aria-current", "true");
                } else {
                    b.removeAttribute("aria-current");
                }
            });
        }
        PM.MUSICA.alCambiar = pintar;
        ponerVol();
        const nota = PM.crear("p", "oc-hoja-nota master-fuente", ocT("Tus canciones (y sus imágenes) se quedan sólo en este dispositivo: no se suben a ningún sitio. Para no perderlas (o llevarlas a otro ordenador), ⚙ → exportar. Siguen sonando al cambiar de pestaña; al quitar esta ventana, se paran."));
        dentro.append(repro, herramientas, busca, cuantos, form, vacio, resultados, tarjetas, arbol, subir, nota);
        pintarModo();
        pintarArbol();
    }

    Object.assign(PM, { montarMusica });
})();
