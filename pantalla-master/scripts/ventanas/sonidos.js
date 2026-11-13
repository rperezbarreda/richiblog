// =========================================
// LA VENTANA «sonidos» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // ---- EFECTOS DE SONIDO: suenan una vez al pulsar (una puerta que cruje,
    // un tajo, un conjuro, un grito…). Grabaciones de la misma biblioteca
    // (Google Sound Library, CC BY 4.0), enlazadas, no alojadas; y los
    // tuyos, guardados sólo en este navegador. ----
    const EFECTOS_SONOROS = [
        ["🚪 Puertas y cerrojos", [["🚪", ocT("puerta que cruje"), "doors/creaking_wooden_door"],
            ["🚪", ocT("abrir una puerta"), "doors/wood_door_open"], ["💥", "portazo", "doors/wood_door_close_hard"],
            ["🏰", ocT("portón pesado"), "doors/heavy_door_close"], ["✊", ocT("llamar a la puerta"), "doors/knock_on_wooden_door"],
            ["🗝️", ocT("llave en la cerradura"), "doors/key_in_lock"], ["🔒", ocT("puerta cerrada (forcejeo)"), "doors/locked_doorknob_jiggle"],
            ["🔩", "cerrojo", "doors/deadbolt_lock"], ["📦", ocT("tapa de cofre"), "doors/lid_close_wood"]]],
        ["⚔️ Combate", [["🌬️", ocT("tajo al aire"), "horror/swoosh"], ["🪓", "hachazo", "impacts/chop"],
            ["🔨", ocT("golpe de maza"), "impacts/hit_with_club"], ["🛡️", ocT("golpe en el escudo"), "impacts/metal_strike_on_wood"],
            ["⚔️", ocT("choque de metal"), "impacts/metal_crash"], ["🗡️", "estocada", "horror/puncture_pop"],
            ["🥩", ocT("golpe en carne"), "horror/meat_punch"], ["👊", "puñetazos", "impacts/body_punch_series"],
            ["🦴", ocT("hueso roto"), "horror/leg_bone_break"], ["🔪", ocT("arma que cae"), "impacts/knife_drop"],
            ["⛓️", "cadenas", "impacts/chain_jingle"], ["💣", "cañonazo", "weapons/howitzer_cannon_fire"]]],
        ["✨ Magia y explosiones", [["⚡", "rayo", "science_fiction/alien_beam"], ["🌀", "portal", "science_fiction/sci_fi_vortex"],
            ["🔮", "encantamiento", "science_fiction/windchime_drone"], ["🌫️", ocT("susurro mágico"), "science_fiction/dream_breath"],
            ["📉", ocT("conjuro que se apaga"), "science_fiction/high_to_low_sweep"], ["👁️", "presagio", "science_fiction/forboding_resonance"],
            ["💨", ocT("nube de humo"), "weapons/smoke_bomb"], ["🔥", ocT("bola de fuego"), "weapons/explosion_hiss_bop_bang"],
            ["💥", ocT("explosión lejana"), "weapons/big_explosion_distant"], ["🌩️", "trueno", "weather/thunder_crack"],
            ["🪨", "derrumbe", "impacts/rubble_crash"], ["🪟", ocT("cristal que estalla"), "impacts/glass_shatters_into_debris"]]],
        ["😱 Gritos y voces", [["😱", ocT("grito de muerte"), "human_voices/death_impact_yell_single"],
            ["😵", ocT("varios gritos"), "human_voices/death_impact_yell_multiple"], ["💀", ocT("último aliento"), "human_voices/death_rattle_breath"],
            ["📣", ocT("grito de guerra"), "crowds/battle_cry_high_pitch"], ["🙌", ocT("gente que grita"), "crowds/human_group_cry_out"],
            ["😠", ocT("multitud enfadada"), "crowds/voices_angry"], ["🎉", "vítores", "crowds/battle_crowd_celebration"],
            ["🤕", ocT("heridos que gimen"), "crowds/battle_agony_moans"], ["😏", "risita", "human_voices/male_chuckling"],
            ["😂", "carcajada", "human_voices/man_laugh_and_knee_slap"]]],
        ["🐺 Monstruos y animales", [["🧟", "zombi", "horror/aggressive_zombie_snarls"],
            ["👹", ocT("rugido de monstruo"), "horror/female_monster_growls"], ["😾", "gruñido", "horror/monster_alien_growl_tense"],
            ["🐍", "siseo", "horror/monster_alien_grunt_hiss"], ["🐕", ocT("perro que gruñe"), "animals/dog_growling"],
            ["🪱", ocT("cascabel de serpiente"), "animals/animal_hiss_and_rattle"], ["🦉", "búho", "animals/owl_hooting"],
            ["🐦", "cuervo", "animals/crow_call"], ["🐝", "enjambre", "animals/swarming_bees"],
            ["🐙", "tentáculo", "animals/tentacle_flop_down"], ["🐀", "ratas", "animals/mouse_squeaking"],
            ["🐎", "caballos", "transportation/horse_team"]]],
        ["🎲 Otros", [["🪙", "monedas", "impacts/loose_change_on_wood"], ["🥂", "brindis", "impacts/silverware_on_glass_toast"],
            ["🌲", ocT("rama que se parte"), "impacts/forest_wood_snapping"], ["🪵", ocT("crujido de madera"), "impacts/stress_creak"],
            ["⚰️", ocT("tierra sobre un ataúd"), "impacts/dirt_on_coffin_lid"], ["💦", ocT("algo cae al agua"), "water/rocks_into_water"]]],
    ];
    let salidaEfectos = null;
    function tocarEfecto(ruta, vol, alAcabar) {
        const a = new Audio();
        a.preload = "auto";
        a.volume = Math.max(0, Math.min(1, vol));
        a.src = PM.urlSonidoSegura(ruta);
        const fin = () => {
            PM.EFECTOS_SUENAN.delete(a);
            PM.efectosCambian();
            alAcabar();
        };
        a.addEventListener("ended", fin);
        PM.EFECTOS_SUENAN.add(a);
        PM.efectosCambian();
        return a.play().catch((e) => {
            fin();
            throw e;
        });
    }
    // Los propios: descodificados con Web Audio (sin pasar por la red).
    function tocarEfectoPropio(audio, vol, alAcabar) {
        const A = PM.motorAudio();
        if (!salidaEfectos) {
            salidaEfectos = A.ctx.createGain();
            salidaEfectos.connect(A.ctx.destination);
        }
        salidaEfectos.gain.value = vol;
        const s = A.ctx.createBufferSource();
        s.buffer = audio;
        s.connect(salidaEfectos);
        const x = { pause: () => {
            try {
                s.stop();
            } catch (e) {
                // Ya parado.
            }
        } };
        s.addEventListener("ended", () => {
            PM.EFECTOS_SUENAN.delete(x);
            PM.efectosCambian();
            alAcabar();
        });
        PM.EFECTOS_SUENAN.add(x);
        PM.efectosCambian();
        s.start();
    }

    function montarSonidos(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        d.propios = Array.isArray(d.propios) ? d.propios : [];
        if (!window.Audio) {
            dentro.appendChild(PM.crear("p", "oc-vacio", ocT("Este navegador no puede poner sonidos.")));
            return;
        }
        const arriba = PM.crear("div", "master-ambiente-arriba");
        const etG = PM.crear("label", "master-ambiente-general");
        const general = PM.crear("input");
        general.type = "range";
        general.min = 0;
        general.max = 100;
        general.value = d.general === undefined ? 80 : d.general;
        general.setAttribute("aria-label", ocT("Volumen de los efectos"));
        general.setAttribute("aria-valuetext", general.value + " %");
        etG.append(PM.crear("span", "", ocT("🔊 volumen")), general);
        general.addEventListener("input", () => {
            d.general = Number(general.value);
            general.setAttribute("aria-valuetext", general.value + " %");
            PM.guardar();
        });
        const parar = PM.botonDe("oc-vida-accion", ocT("■ parar"), () => {
            PM.EFECTOS_SUENAN.forEach((a) => a.pause());
            PM.EFECTOS_SUENAN.clear();
            PM.efectosCambian();
            dentro.querySelectorAll(".master-ambiente-fila.es-sonando").forEach((li) => li.classList.remove("es-sonando"));
            PM.avisar(ocT("Parados los efectos."));
        }, ocT("Parar los efectos que estén sonando"));
        arriba.append(etG, parar);
        const vol = () => general.value / 100;
        function tarjeta(emoji, nombre, alPulsar, clave) {
            const li = PM.crear("li", "master-ambiente-fila");
            const b = PM.botonDe("master-ambiente-boton", "", () => {
                li.classList.add("es-sonando");
                alPulsar(() => li.classList.remove("es-sonando"));
            });
            b.append(PM.iconoSonido(clave, emoji), PM.crear("span", "", nombre));
            li.append(b, PM.botonAspectoSonido(clave, emoji, nombre, b));
            return li;
        }
        // Cada sección se pliega (y se acuerda: d.plegadas).
        d.plegadas = Array.isArray(d.plegadas) ? d.plegadas : [];
        function seccion(titulo, ...cosas) {
            const h = PM.crear("h3", "master-sonidos-seccion");
            const caja = PM.crear("div", "master-sonidos-caja");
            caja.id = "master-sonidos-" + m.id + "-" + titulo.replace(/[^a-z]/gi, "").toLowerCase();
            const abierta = !d.plegadas.includes(titulo);
            caja.hidden = !abierta;
            const b = PM.botonDe("master-sonidos-plegar", "", () => {
                const ya = d.plegadas.includes(titulo);
                d.plegadas = ya ? d.plegadas.filter((x) => x !== titulo) : d.plegadas.concat(titulo);
                caja.hidden = !ya;
                b.setAttribute("aria-expanded", ya ? "true" : "false");
                PM.guardar();
            });
            b.setAttribute("aria-expanded", abierta ? "true" : "false");
            b.setAttribute("aria-controls", caja.id);
            const flecha = PM.crear("span", "master-musica-flecha", "▸");
            flecha.setAttribute("aria-hidden", "true");
            b.append(flecha, PM.crear("span", "", titulo));
            h.appendChild(b);
            caja.append(...cosas);
            return [h, caja];
        }
        const partes = PM.crear("div");
        const sinEfectos = PM.crear("p", "oc-vacio", ocT("Aún no hay grabaciones incluidas en la app. Añade las tuyas abajo, en «Los tuyos»."));
        sinEfectos.hidden = true;
        PM.sonidosListos.then(() => EFECTOS_SONOROS.forEach(([tituloS, todos]) => {
            const lista = todos.filter((x) => PM.sonidoEsta([x[2]]));
            if (!lista.length) {
                return;
            }
            const titulo = tituloS;
            const ul = PM.crear("ul", "master-ambiente-lista master-sonidos-lista");
            ul.setAttribute("aria-label", titulo.replace(/^\S+\s/, ""));
            lista.forEach(([emoji, nombre, ruta]) => {
                ul.appendChild(tarjeta(emoji, nombre, (acabar) => {
                    tocarEfecto(ruta, vol(), acabar).catch(() => {
                        acabar();
                        PM.avisar(ocT("No se ha podido poner «{nombre}».", { nombre: nombre }));
                    });
                }, "efe:" + ruta));
            });
            partes.append(...seccion(titulo, ul));
        })).then(() => {
            sinEfectos.hidden = !!partes.childElementCount;
        });
        // LOS PROPIOS.
        const listaP = PM.crear("ul", "master-ambiente-lista master-sonidos-lista");
        listaP.setAttribute("aria-label", ocT("Los tuyos"));
        const vacioP = PM.crear("p", "oc-hoja-nota", ocT("Aún no hay. Añade un audio de tu ordenador: sonará una vez al pulsarlo."));
        function pintarPropios() {
            listaP.replaceChildren(...d.propios.map((p) => {
                const li = tarjeta("🎵", p.nombre, (acabar) => {
                    PM.motorAudio();
                    PM.archivoLeer(p.archivo).then((blob) => (blob ? blob.arrayBuffer() : null)).then((buf) => (buf
                        ? PM.AMBIENTE.ctx.decodeAudioData(buf) : null)).then((audio) => {
                        if (!audio) {
                            acabar();
                            PM.avisar(ocT("Ese sonido ya no está en este navegador."));
                            return;
                        }
                        tocarEfectoPropio(audio, vol(), acabar);
                    }).catch(() => {
                        acabar();
                        PM.avisar(ocT("No se ha podido poner ese sonido."));
                    });
                }, "prop:" + p.id);
                let seguro = false;
                const quitar = PM.botonDe("master-docs-mando master-ambiente-quitar", "✕", () => {
                    if (!seguro) {
                        seguro = true;
                        quitar.classList.add("es-seguro");
                        PM.avisar(ocT("Pulsa otra vez para quitar {nombre}.", { nombre: p.nombre }));
                        return;
                    }
                    PM.archivoBorrar(p.archivo);
                    PM.olvidarAspecto("prop:" + p.id);
                    d.propios = d.propios.filter((x) => x !== p);
                    PM.guardar();
                    pintarPropios();
                    PM.avisar(ocT("Quitado: {nombre}.", { nombre: p.nombre }));
                    otro.focus();
                }, ocT("Quitar el sonido {nombre}", { nombre: p.nombre }));
                li.appendChild(quitar);
                return li;
            }));
            listaP.hidden = !d.propios.length;
            vacioP.hidden = !!d.propios.length;
        }
        const subir = PM.crear("input");
        subir.type = "file";
        subir.accept = "audio/*";
        subir.hidden = true;
        const otro = PM.botonDe("oc-vida-accion", ocT("＋ 🎵 tu efecto"), () => subir.click(), ocT("Añadir un efecto tuyo (un audio que suena una vez)"));
        otro.title = ocT("Un audio de tu ordenador (se queda sólo en este navegador)");
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
                pintarPropios();
                PM.avisar(ocT("Añadido: {name}. Se queda sólo en este navegador (⚙ → exportar para no perderlo).", { name: f.name }));
            }).catch(() => PM.avisar(ocT("No se ha podido guardar el sonido.")));
        });
        const nota = PM.crear("p", "oc-hoja-nota master-fuente");
        const enlaceG = PM.crear("a", "", ocT("Google Sound Library"));
        enlaceG.href = "https://developers.google.com/assistant/tools/sound-library";
        enlaceG.target = "_blank";
        enlaceG.rel = "noopener noreferrer";
        enlaceG.setAttribute("aria-label", ocT("Google Sound Library (se abre en otra pestaña)"));
        nota.append(ocT("Grabaciones de la "), enlaceG, ocT(" (Google, CC BY 4.0), incluidas en la app: suenan sin conexión. Cada una suena una vez; se pueden pisar unas con otras. Los tuyos se quedan sólo en este dispositivo."));
        dentro.append(arriba, sinEfectos, partes, ...seccion(ocT("🎵 Los tuyos"), vacioP, listaP, otro, subir), nota);
        pintarPropios();
    }

    Object.assign(PM, { montarSonidos });
})();
