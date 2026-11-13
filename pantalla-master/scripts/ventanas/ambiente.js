// =========================================
// LA VENTANA «ambiente» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    const SONIDOS = [["lluvia", "🌧️", "lluvia", ["weather/rain_on_roof"]],
        ["tormenta", "⛈️", "tormenta", ["weather/thunderstorm_long"]],
        ["viento", "💨", "viento", ["weather/strong_wind"]],
        ["hoguera", "🔥", "hoguera", ["ambiences/fire"]],
        ["rio", "🏞️", "río", ["water/small_stream_flowing"]],
        ["mar", "🌊", "mar", ["water/waves_crashing_on_rock_beach"]],
        ["carro", "🐴", ocT("carro en marcha"), ["transportation/horse_and_carriage"]],
        ["mercado", "🛒", "mercado", ["ambiences/small_outdoor_marketplace"]],
        ["taberna", "🍺", "taberna", ["crowds/murmuring_and_talking_men"]],
        ["noche", "🦗", "noche", ["ambiences/outside_night"]],
        ["bosque", "🐦", "bosque", ["ambiences/spring_day_forest"]],
        ["mazmorra", "🕳️", ocT("mazmorra (viento y goteo)"), ["horror/hallow_wind", "water/water_leak"]],
        ["barco", "⛵", ocT("barco (madera que cruje)"), ["transportation/wood_creak_on_old_ship_series"]],
        ["granja", "🐓", "granja", ["ambiences/morning_farm"]]];
    // Subir o bajar el volumen de unos <audio> poco a poco.
    function fundir(audios, hasta, alAcabar) {
        const pasos = 12;
        const desde = audios.map((a) => a.volume);
        let i = 0;
        const t = setInterval(() => {
            i += 1;
            audios.forEach((a, k) => {
                a.volume = Math.max(0, Math.min(1, desde[k] + (hasta - desde[k]) * i / pasos));
            });
            if (i >= pasos) {
                clearInterval(t);
                if (alAcabar) {
                    alAcabar();
                }
            }
        }, 50);
    }
    // Una grabación de la biblioteca (o varias a la vez), en bucle.
    function sonarGrabacion(id, rutas, vol, alFallar) {
        if (PM.AMBIENTE.activos[id]) {
            return;
        }
        const audios = rutas.map((r) => {
            const a = new Audio();
            a.loop = true;
            a.preload = "auto";
            a.volume = 0;
            a.src = PM.urlSonidoSegura(r);
            a.addEventListener("error", () => {
                if (PM.AMBIENTE.activos[id]) {
                    callar(id);
                    alFallar();
                }
            });
            a.play().catch(() => {
                if (PM.AMBIENTE.activos[id]) {
                    callar(id);
                    alFallar();
                }
            });
            return a;
        });
        let mio = vol;
        fundir(audios, mio * PM.AMBIENTE.nivel);
        PM.AMBIENTE.activos[id] = {
            volumen(v) {
                mio = v === undefined ? mio : v;
                audios.forEach((a) => {
                    a.volume = Math.max(0, Math.min(1, mio * PM.AMBIENTE.nivel));
                });
            },
            parar() {
                fundir(audios, 0, () => audios.forEach((a) => {
                    a.pause();
                    a.removeAttribute("src");
                    a.load();
                }));
            },
        };
        vigilarAmbiente();
    }
    // Un sonido propio (descodificado con Web Audio: bucle sin cortes).
    function sonarPropio(id, audio, vol) {
        const A = PM.motorAudio();
        if (PM.AMBIENTE.activos[id]) {
            return;
        }
        const salida = A.ctx.createGain();
        salida.gain.value = 0;
        salida.connect(A.general);
        salida.gain.setTargetAtTime(vol, A.ctx.currentTime, 0.3);
        const s = A.ctx.createBufferSource();
        s.buffer = audio;
        s.loop = true;
        s.connect(salida);
        s.start();
        PM.AMBIENTE.activos[id] = {
            volumen(v) {
                if (v !== undefined) {
                    salida.gain.setTargetAtTime(v, A.ctx.currentTime, 0.1);
                }
            },
            parar() {
                salida.gain.setTargetAtTime(0, A.ctx.currentTime, 0.2);
                setTimeout(() => {
                    try {
                        s.stop();
                    } catch (e) {
                        // Ya parado.
                    }
                    salida.disconnect();
                }, 900);
            },
        };
        vigilarAmbiente();
    }
    function volumenGeneral(v) {
        PM.AMBIENTE.nivel = v;
        if (PM.AMBIENTE.general) {
            PM.AMBIENTE.general.gain.setTargetAtTime(v, PM.AMBIENTE.ctx.currentTime, 0.1);
        }
        Object.values(PM.AMBIENTE.activos).forEach((x) => x.volumen());
    }
    function callar(id) {
        const x = PM.AMBIENTE.activos[id];
        if (x) {
            x.parar();
            delete PM.AMBIENTE.activos[id];
        }
    }
    const callarTodo = () => Object.keys(PM.AMBIENTE.activos).forEach(callar);
    // Si ya no queda ninguna ventana de sonido en la campaña, silencio.
    function vigilarAmbiente() {
        if (PM.AMBIENTE.vigila) {
            return;
        }
        PM.AMBIENTE.vigila = setInterval(() => {
            const hay = PM.todo.perfiles.some((pf) => pf.modulos.some((x) => x.tipo === "ambiente"));
            if (!hay || !Object.keys(PM.AMBIENTE.activos).length) {
                if (!hay) {
                    callarTodo();
                }
                clearInterval(PM.AMBIENTE.vigila);
                PM.AMBIENTE.vigila = 0;
            }
        }, 1500);
    }

    function montarAmbiente(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        d.vol = d.vol || {};
        d.propios = Array.isArray(d.propios) ? d.propios : [];
        if (!window.Audio) {
            dentro.appendChild(PM.crear("p", "oc-vacio", ocT("Este navegador no puede poner sonidos.")));
            return;
        }
        // EL VOLUMEN GENERAL y parar todo.
        const arriba = PM.crear("div", "master-ambiente-arriba");
        const etG = PM.crear("label", "master-ambiente-general");
        const general = PM.crear("input");
        general.type = "range";
        general.min = 0;
        general.max = 100;
        general.value = d.general === undefined ? 80 : d.general;
        general.setAttribute("aria-label", ocT("Volumen general"));
        general.setAttribute("aria-valuetext", general.value + " %");
        etG.append(PM.crear("span", "", ocT("🔊 general")), general);
        const ponerGeneral = () => volumenGeneral(general.value / 100);
        PM.AMBIENTE.nivel = general.value / 100;
        general.addEventListener("input", () => {
            d.general = Number(general.value);
            general.setAttribute("aria-valuetext", general.value + " %");
            ponerGeneral();
            PM.guardar();
        });
        const parar = PM.botonDe("oc-vida-accion", ocT("■ silencio"), () => {
            callarTodo();
            d.sonando = [];
            PM.guardar();
            pintar();
            PM.avisar(ocT("Silencio."));
        }, ocT("Parar todos los sonidos"));
        arriba.append(etG, parar);
        // Lo que sonaba antes de recargar (el navegador no deja que suene
        // solo: hay que pulsar).
        const volver = PM.botonDe("oc-vida-accion es-principal", "", () => {
            (d.sonando || []).forEach((id) => encender(id));
            volver.hidden = true;
            pintar();
        });
        const lista = PM.crear("ul", "master-ambiente-lista");
        lista.setAttribute("aria-label", ocT("Sonidos"));
        const filas = [];
        const datosDe = (id) => {
            const p = d.propios.find((x) => "propio-" + x.id === id);
            return p ? ["🎵", p.nombre] : (SONIDOS.find((s) => s[0] === id) || []).slice(1, 3);
        };
        function encender(id) {
            const vol = (d.vol[id] === undefined ? 70 : d.vol[id]) / 100;
            ponerGeneral();
            const p = d.propios.find((x) => "propio-" + x.id === id);
            if (p) {
                PM.motorAudio();
                return PM.archivoLeer(p.archivo).then((blob) => (blob ? blob.arrayBuffer() : null)).then((buf) => (buf
                    ? PM.AMBIENTE.ctx.decodeAudioData(buf) : null)).then((audio) => {
                    if (!audio) {
                        PM.avisar(ocT("Ese sonido ya no está en este navegador."));
                        return;
                    }
                    sonarPropio(id, audio, vol);
                    d.sonando = Array.from(new Set((d.sonando || []).concat(id)));
                    PM.guardar();
                    pintar();
                }).catch(() => PM.avisar(ocT("No se ha podido poner ese sonido.")));
            }
            const s = SONIDOS.find((x) => x[0] === id);
            if (s) {
                sonarGrabacion(id, s[3], vol, () => {
                    d.sonando = (d.sonando || []).filter((x) => x !== id);
                    PM.guardar();
                    pintar();
                    PM.avisar(ocT("No se ha podido poner «{n}»: ¿hay conexión a internet?", { n: s[2] }));
                });
                d.sonando = Array.from(new Set((d.sonando || []).concat(id)));
                PM.guardar();
            }
            return Promise.resolve();
        }
        function fila(id) {
            const [emoji, nombre] = datosDe(id);
            const li = PM.crear("li", "master-ambiente-fila");
            const b = PM.botonDe("master-ambiente-boton", "", () => {
                if (PM.AMBIENTE.activos[id]) {
                    callar(id);
                    d.sonando = (d.sonando || []).filter((x) => x !== id);
                    PM.guardar();
                    PM.avisar(ocT("Parado: {nombre}.", { nombre: nombre }));
                } else {
                    encender(id);
                    PM.avisar(ocT("Suena: {nombre}.", { nombre: nombre }));
                }
                pintar();
            });
            b.append(PM.iconoSonido("amb:" + id, emoji), PM.crear("span", "", nombre));
            const r = PM.crear("input", "master-ambiente-volumen");
            r.type = "range";
            r.min = 0;
            r.max = 100;
            r.value = d.vol[id] === undefined ? 70 : d.vol[id];
            r.setAttribute("aria-label", ocT("Volumen de {nombre}", { nombre: nombre }));
            r.setAttribute("aria-valuetext", r.value + " %");
            r.addEventListener("input", () => {
                d.vol[id] = Number(r.value);
                r.setAttribute("aria-valuetext", r.value + " %");
                const x = PM.AMBIENTE.activos[id];
                if (x) {
                    x.volumen(r.value / 100);
                }
                PM.guardar();
            });
            li.append(b, r, PM.botonAspectoSonido("amb:" + id, emoji, nombre, b));
            if (id.indexOf("propio-") === 0) {
                const p = d.propios.find((x) => "propio-" + x.id === id);
                let seguro = false;
                const quitar = PM.botonDe("master-docs-mando master-ambiente-quitar", "✕", () => {
                    if (!seguro) {
                        seguro = true;
                        quitar.classList.add("es-seguro");
                        PM.avisar(ocT("Pulsa otra vez para quitar {nombre}.", { nombre: nombre }));
                        return;
                    }
                    callar(id);
                    PM.archivoBorrar(p.archivo);
                    PM.olvidarAspecto("amb:" + id);
                    d.propios = d.propios.filter((x) => x !== p);
                    PM.guardar();
                    pintarFilas();
                    PM.avisar(ocT("Quitado: {nombre}.", { nombre: nombre }));
                    otro.focus();
                }, ocT("Quitar el sonido {nombre}", { nombre: nombre }));
                li.appendChild(quitar);
            }
            filas.push({ id, b, li });
            return li;
        }
        function pintarFilas() {
            filas.length = 0;
            lista.replaceChildren(...SONIDOS.filter((x) => PM.sonidoEsta(x[3])).map(([id]) => fila(id)),
                ...d.propios.map((p) => fila("propio-" + p.id)));
            sinGrabaciones.hidden = SONIDOS.some((x) => PM.sonidoEsta(x[3]));
            pintar();
        }
        function pintar() {
            filas.forEach(({ id, b, li }) => {
                const suena = !!PM.AMBIENTE.activos[id];
                b.setAttribute("aria-pressed", suena ? "true" : "false");
                li.classList.toggle("es-sonando", suena);
            });
            const antes = (d.sonando || []).filter((id) => !PM.AMBIENTE.activos[id] && datosDe(id).length);
            volver.textContent = ocT("▶ volver a poner lo de antes ({join})", { join: antes.map((id) => datosDe(id)[1]).join(", ") });
            volver.hidden = !antes.length || Object.keys(PM.AMBIENTE.activos).length > 0;
        }
        // LOS PROPIOS: un audio del ordenador, en bucle.
        const subir = PM.crear("input");
        subir.type = "file";
        subir.accept = "audio/*";
        subir.hidden = true;
        const otro = PM.botonDe("oc-vida-accion", ocT("＋ 🎵 tu sonido"), () => subir.click(), ocT("Añadir un sonido tuyo (un audio, en bucle)"));
        otro.title = ocT("Un audio de tu ordenador, en bucle (se queda sólo en este navegador)");
        subir.addEventListener("change", () => {
            const f = subir.files && subir.files[0];
            subir.value = "";
            if (!f || !/^audio\//.test(f.type) || f.size > PM.MAX_ARCHIVO) {
                PM.avisar(ocT("Sólo audios de hasta 50 MB."));
                return;
            }
            const id = PM.idDoc("a");
            PM.archivoGuardar(id, f).then(() => {
                d.propios.push({ id, archivo: id, nombre: f.name.replace(/\.[^.]+$/, "").slice(0, 40) || "sonido" });
                PM.guardar();
                pintarFilas();
                PM.avisar(ocT("Añadido: {name}. Se queda sólo en este navegador (⚙ → exportar para no perderlo).", { name: f.name }));
            }).catch(() => PM.avisar(ocT("No se ha podido guardar el sonido.")));
        });
        const nota = PM.crear("p", "oc-hoja-nota master-fuente");
        const enlaceG = PM.crear("a", "", ocT("Google Sound Library"));
        enlaceG.href = "https://developers.google.com/assistant/tools/sound-library";
        enlaceG.target = "_blank";
        enlaceG.rel = "noopener noreferrer";
        enlaceG.setAttribute("aria-label", ocT("Google Sound Library (se abre en otra pestaña)"));
        nota.append(ocT("Grabaciones de la "), enlaceG, ocT(" (Google, CC BY 4.0), incluidas en la app: suenan sin conexión. Se mezclan y siguen sonando al cambiar de pestaña; al quitar esta ventana, se paran. Los tuyos se quedan sólo en este dispositivo."));
        const sinGrabaciones = PM.crear("p", "oc-vacio", ocT("Aún no hay grabaciones incluidas en la app. Añade las tuyas con «＋ 🎵 tu sonido»."));
        sinGrabaciones.hidden = true;
        dentro.append(arriba, volver, sinGrabaciones, lista, otro, subir, nota);
        pintarFilas();
        PM.sonidosListos.then(pintarFilas);
    }

    Object.assign(PM, { montarAmbiente });
})();
