// =========================================
// LA PANTALLA DE MÁSTER (web/pantalla_master/pantalla_master.html)
// =========================================
// Un lienzo con ventanas, como el escritorio de un ordenador viejo: cada
// una es un MÓDULO (la iniciativa, las reglas, las condiciones, el
// buscador de conjuros, el bestiario, la tienda, la party, las notas,
// una tarjeta propia o una tabla para tirar). Los dados no son una
// ventana: van en el lanzador pegado a la derecha (el botón redondo de
// abajo a la derecha, o la tecla D; ver personajes.js). Empieza vacía: se añaden con «＋ añadir» (que también
// ordena o las quita todas), se mueven arrastrando su barra (o con las
// flechas, desde su ⠿), cambian de tamaño por la esquina de abajo a la
// derecha, se les cambia el título y el color con ✎ (o con doble clic en
// el título), se pliegan con − y se quitan con ✕. Todo se guarda en el
// navegador («richi-master»): qué hay, dónde, de qué tamaño, con qué
// título y color, y lo que tenga dentro (lo de las tarjetas y las tablas).
//
// En el móvil (hasta 860 px) no hay lienzo: van una debajo de otra, en el
// orden en que estén (de arriba abajo y de izquierda a derecha).
//
// Lo de dentro de cada módulo sale de personajes.js (window.ocMontar:
// iniciativa, reglas, notas; window.ocDados; window.ocVentana), que se
// carga antes.

(function () {
    const lienzo = document.querySelector("[data-master-lienzo]");
    const barra = document.querySelector("[data-master-barra]");
    if (!lienzo || !barra || !window.ocMontar) {
        return;
    }
    const CLAVE = "richi-master";
    const enMovil = window.matchMedia ? window.matchMedia("(max-width: 860px)") : { matches: false };

    function crear(tag, clase, texto) {
        const x = document.createElement(tag);
        if (clase) {
            x.className = clase;
        }
        if (texto !== undefined) {
            x.textContent = texto;
        }
        return x;
    }

    function botonDe(clase, texto, alPulsar, etiqueta) {
        const b = crear("button", clase, texto);
        b.type = "button";
        if (etiqueta) {
            b.setAttribute("aria-label", etiqueta);
        }
        b.addEventListener("click", alPulsar);
        return b;
    }

    const aviso = crear("p", "visually-hidden");
    aviso.setAttribute("role", "status");
    document.body.appendChild(aviso);

    function avisar(texto) {
        aviso.textContent = "";
        setTimeout(() => {
            aviso.textContent = texto;
        }, 50);
    }

    const llano = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

    // ---- UN MARKDOWN PEQUEÑITO (para las reglas, los conjuros y las
    // tarjetas): párrafos, listas con «- », «## títulos», **negrita** y
    // *cursiva*. Todo con nodos de texto: nada se pega como HTML. ----
    function enLinea(texto) {
        const nodos = [];
        const patron = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
        let fin = 0;
        let m;
        while ((m = patron.exec(texto))) {
            if (m.index > fin) {
                nodos.push(document.createTextNode(texto.slice(fin, m.index)));
            }
            nodos.push(crear(m[1] ? "strong" : "em", "", m[1] || m[2]));
            fin = patron.lastIndex;
        }
        if (fin < texto.length) {
            nodos.push(document.createTextNode(texto.slice(fin)));
        }
        return nodos;
    }

    function markdown(texto) {
        const caja = crear("div", "oc-texto");
        let lista = null;
        let parrafo = [];
        const cerrarParrafo = () => {
            if (parrafo.length) {
                const p = crear("p");
                p.append(...enLinea(parrafo.join(" ")));
                caja.appendChild(p);
                parrafo = [];
            }
        };
        let tabla = null;
        String(texto || "").split("\n").forEach((linea) => {
            const l = linea.trim();
            // Las tablas: «| a | b |» por fila (la primera, la cabecera).
            if (/^\|.*\|$/.test(l)) {
                // La raya de debajo de la cabecera («| --- | --- |»), fuera.
                if (/^\|[\s:|-]+\|$/.test(l)) {
                    return;
                }
                cerrarParrafo();
                lista = null;
                const celdas = l.slice(1, -1).split("|").map((c) => c.trim());
                if (!tabla) {
                    tabla = crear("table", "master-tabla-texto");
                    const tr = crear("tr");
                    celdas.forEach((c) => {
                        const th = crear("th");
                        th.scope = "col";
                        th.append(...enLinea(c));
                        tr.appendChild(th);
                    });
                    const thead = crear("thead");
                    thead.appendChild(tr);
                    tabla.append(thead, crear("tbody"));
                    caja.appendChild(tabla);
                    return;
                }
                const tr = crear("tr");
                celdas.forEach((c) => {
                    const td = crear("td");
                    td.append(...enLinea(c));
                    tr.appendChild(td);
                });
                tabla.querySelector("tbody").appendChild(tr);
                return;
            }
            tabla = null;
            if (/^[-*] /.test(l)) {
                cerrarParrafo();
                if (!lista) {
                    lista = crear("ul");
                    caja.appendChild(lista);
                }
                const li = crear("li");
                li.append(...enLinea(l.slice(2)));
                lista.appendChild(li);
                return;
            }
            lista = null;
            if (!l) {
                cerrarParrafo();
                return;
            }
            if (/^#{1,6} /.test(l)) {
                cerrarParrafo();
                const h = crear("h4", "oc-hoja-subtitulo");
                h.append(...enLinea(l.replace(/^#+ /, "")));
                caja.appendChild(h);
                return;
            }
            parrafo.push(l);
        });
        cerrarParrafo();
        if (window.ocDadosEnTexto) {
            window.ocDadosEnTexto(caja);
        }
        return caja;
    }

    // Los JSON de la web, una vez cada uno.
    const pedidos = {};

    function pedir(ruta) {
        if (!pedidos[ruta]) {
            pedidos[ruta] = fetch(ruta).then((r) => {
                if (!r.ok) {
                    throw new Error(r.status);
                }
                return r.json();
            });
        }
        const k = PROPIOS_EN[ruta];
        if (!k) {
            return pedidos[ruta];
        }
        // Con lo tuyo (si hay) al final.
        return pedidos[ruta].then((d) => {
            const tuyos = leerPropios()[k];
            if (!tuyos.length) {
                return d;
            }
            const x = Object.assign({}, d);
            x[k] = (d[k] || []).concat(tuyos);
            return x;
        });
    }

    // ---- LO TUYO: monstruos, objetos, conjuros y otras cosas (especies,
    // dotes…) que crea cada uno (de otros manuales o inventados). Se
    // guardan sólo en este navegador («richi-master-propios»: {monstruos,
    // objetos, conjuros, otros}), los mismos en todas las campañas, y se
    // mezclan con los del SRD al pedir sus archivos: así salen en el
    // bestiario, los encuentros, la tienda, el botín, los conjuros y el
    // buscador sin tocar nada más. Cada uno lleva «propio: true». ----
    const CLAVE_PROPIOS = "richi-master-propios";
    const PROPIOS_EN = { "datos/personajes/compendio/bestiario.json": "monstruos",
        "datos/personajes/compendio/conjuros-srd.json": "conjuros", "datos/personajes/compendio/tienda.json": "objetos",
        "datos/personajes/compendio/rasgos-srd.json": "rasgos" };

    function leerPropios() {
        let x = {};
        try {
            x = JSON.parse(localStorage.getItem(CLAVE_PROPIOS) || "{}") || {};
        } catch (e) {
            x = {};
        }
        ["monstruos", "objetos", "conjuros", "rasgos", "otros"].forEach((k) => {
            x[k] = Array.isArray(x[k]) ? x[k] : [];
        });
        return x;
    }

    function guardarPropios(p) {
        try {
            localStorage.setItem(CLAVE_PROPIOS, JSON.stringify(p));
        } catch (e) {
            return false;
        }
        document.dispatchEvent(new Event("master:propios"));
        return true;
    }

    // De dónde sale (en vez del crédito del SRD).
    const fuenteDe = (x, f) => (x && x.propio ? "🛠️ Creado por ti" + (x.libro ? " · " + x.libro : "")
        + ". Se guarda sólo en este navegador." : f);

    // EL TRADUCTOR DE TÉRMINOS: pasa al español (el del SRD 5.2 en
    // español) lo que se repite en los bloques de estadísticas y las
    // reglas en inglés: tipos, tamaños, daños, estados, características,
    // habilidades, sentidos, escuelas, rarezas, «Melee Attack Roll:»,
    // «Hit:»… El resto del texto (las frases) se queda como está.
    const T_CARACT = [["Strength", "Fuerza"], ["Dexterity", "Destreza"], ["Constitution", "Constitución"],
        ["Intelligence", "Inteligencia"], ["Wisdom", "Sabiduría"], ["Charisma", "Carisma"]];
    const T_TAMANOS = [["Tiny", "Diminuto"], ["Small", "Pequeño"], ["Medium", "Mediano"], ["Large", "Grande"],
        ["Huge", "Enorme"], ["Gargantuan", "Gargantuesco"]];
    const T_TIPOS = [["Aberration", "Aberración"], ["Beast", "Bestia"], ["Celestial", "Celestial"], ["Construct", "Autómata"],
        ["Dragon", "Dragón"], ["Elemental", "Elemental"], ["Fey", "Feérico"], ["Fiend", "Infernal"], ["Giant", "Gigante"],
        ["Humanoid", "Humanoide"], ["Monstrosity", "Monstruosidad"], ["Ooze", "Cieno"], ["Plant", "Planta"],
        ["Undead", "Muerto viviente"], ["Swarm", "Enjambre"]];
    const T_DANOS = [["Acid", "ácido"], ["Bludgeoning", "contundente"], ["Cold", "frío"], ["Fire", "fuego"], ["Force", "fuerza"],
        ["Lightning", "relámpago"], ["Necrotic", "necrótico"], ["Piercing", "perforante"], ["Poison", "veneno"],
        ["Psychic", "psíquico"], ["Radiant", "radiante"], ["Slashing", "cortante"], ["Thunder", "trueno"]];
    const T_ESTADOS = [["Blinded", "cegado"], ["Charmed", "hechizado"], ["Deafened", "ensordecido"], ["Exhaustion", "agotamiento"],
        ["Frightened", "asustado"], ["Grappled", "agarrado"], ["Incapacitated", "incapacitado"], ["Invisible", "invisible"],
        ["Paralyzed", "paralizado"], ["Petrified", "petrificado"], ["Poisoned", "envenenado"], ["Prone", "derribado"],
        ["Restrained", "apresado"], ["Stunned", "aturdido"], ["Unconscious", "inconsciente"]];
    const T_FRASES = [
        [/\*Melee or Ranged Attack Roll:\*/g, "*Ataque cuerpo a cuerpo o a distancia:*"],
        [/\*Melee Attack Roll:\*/g, "*Ataque cuerpo a cuerpo:*"], [/\*Ranged Attack Roll:\*/g, "*Ataque a distancia:*"],
        [/\*Melee Weapon Attack:\*/g, "*Ataque cuerpo a cuerpo:*"], [/\*Ranged Weapon Attack:\*/g, "*Ataque a distancia:*"],
        [/\*Melee Spell Attack:\*/g, "*Ataque cuerpo a cuerpo:*"], [/\*Ranged Spell Attack:\*/g, "*Ataque a distancia:*"],
        [/\*Hit or Miss:\*/g, "*Impacto o fallo:*"], [/\*Hit:\*/g, "*Impacto:*"], [/\*Miss:\*/g, "*Fallo:*"],
        [/\*Failure or Success:\*/g, "*Fallo o éxito:*"], [/\*Success or Failure:\*/g, "*Éxito o fallo:*"],
        [/\*First Failure:\*/g, "*Primer fallo:*"], [/\*Second Failure:\*/g, "*Segundo fallo:*"],
        [/\*Failure:\*/g, "*Fallo:*"], [/\*Success:\*/g, "*Éxito:*"], [/\*Trigger:\*/g, "*Desencadenante:*"],
        [/\*Response:\*/g, "*Respuesta:*"], [/\*Legendary Action Uses:\*/g, "*Usos de acción legendaria:*"],
        [/\bHit: /g, "Impacto: "], [/\bMelee Attack Roll: /g, "Ataque cuerpo a cuerpo: "], [/\bRanged Attack Roll: /g, "Ataque a distancia: "],
        [/\breach (\d+) ft\./g, "alcance $1 ft."], [/\brange (\d+(?:\/\d+)?) ft\./g, "distancia $1 ft."],
        [/\bMultiattack\b/g, "Ataque múltiple"], [/\bLegendary Resistance\b/g, "Resistencia legendaria"],
        [/\bSpellcasting\b/g, "Lanzamiento de conjuros"], [/\bAmphibious\b/g, "Anfibio"],
        [/\bRecharge (\d)/g, "Recarga $1"], [/(\d+)\/Day\b/g, "$1/día"], [/\/Day Each\b/g, "/día cada uno"],
        [/\bAt Will\b/g, "A voluntad"], [/\bin Lair\b/g, "en su guarida"],
        [/\bDC (\d+)/g, "CD $1"], [/\bPassive Perception (\d+)/gi, "Percepción pasiva $1"],
        [/\bProficiency Bonus\b|\bPB\b/g, "BC"], [/\bXP\b/g, "PX"],
        [/\bHit Points\b/g, "puntos de golpe"], [/\bTemporary Hit Points\b/g, "puntos de golpe temporales"],
        [/\bHit Point\b/g, "punto de golpe"], [/\bArmor Class\b/g, "Clase de Armadura"], [/\bAC\b/g, "CA"],
        [/\bAdvantage\b/g, "ventaja"], [/\bDisadvantage\b/g, "desventaja"],
        [/\bBonus Action\b/g, "acción adicional"], [/\bReaction\b/g, "reacción"],
        [/\b(\d+) feet\b/g, "$1 pies"], [/\b(\d+)-foot\b/g, "de $1 pies"],
        [/\bDarkvision\b/gi, "visión en la oscuridad"], [/\bBlindsight\b/gi, "vista ciega"],
        [/\bTremorsense\b/gi, "sentido de la vibración"], [/\bTruesight\b/gi, "visión verdadera"],
        [/\bFly (\d+)/gi, "vuelo $1"], [/\bSwim (\d+)/gi, "nado $1"], [/\bClimb (\d+)/gi, "trepar $1"],
        [/\bBurrow (\d+)/gi, "excavar $1"], [/\(hover\)/g, "(levitar)"],
        [/\bLawful Good\b/gi, "legal bueno"], [/\bNeutral Good\b/gi, "neutral bueno"], [/\bChaotic Good\b/gi, "caótico bueno"],
        [/\bLawful Neutral\b/gi, "legal neutral"], [/\bChaotic Neutral\b/gi, "caótico neutral"],
        [/\bLawful Evil\b/gi, "legal malvado"], [/\bNeutral Evil\b/gi, "neutral malvado"], [/\bChaotic Evil\b/gi, "caótico malvado"],
        [/\bUnaligned\b/gi, "sin alineamiento"],
        [/\bAnimal Handling\b/g, "Trato con animales"], [/\bSleight of Hand\b/g, "Juego de manos"],
        [/\bAcrobatics\b/g, "Acrobacias"], [/\bArcana\b/g, "Arcanos"], [/\bAthletics\b/g, "Atletismo"],
        [/\bDeception\b/g, "Engaño"], [/\bHistory\b/g, "Historia"], [/\bInsight\b/g, "Perspicacia"],
        [/\bIntimidation\b/g, "Intimidación"], [/\bInvestigation\b/g, "Investigación"], [/\bMedicine\b/g, "Medicina"],
        [/\bNature\b/g, "Naturaleza"], [/\bPerception\b/g, "Percepción"], [/\bPerformance\b/g, "Interpretación"],
        [/\bPersuasion\b/g, "Persuasión"], [/\bReligion\b/g, "Religión"], [/\bStealth\b/g, "Sigilo"],
        [/\bSurvival\b/g, "Supervivencia"],
        [/\bStr\b/g, "Fue"], [/\bDex\b/g, "Des"], [/\bWis\b/g, "Sab"], [/\bCha\b/g, "Car"],
        [/\bAbjuration\b/g, "Abjuración"], [/\bConjuration\b/g, "Conjuración"], [/\bDivination\b/g, "Adivinación"],
        [/\bEnchantment\b/g, "Encantamiento"], [/\bEvocation\b/g, "Evocación"], [/\bIllusion\b/g, "Ilusionismo"],
        [/\bNecromancy\b/g, "Nigromancia"], [/\bTransmutation\b/g, "Transmutación"],
        [/\bConcentration, up to (\d+) minutes?\b/gi, (x, n) => "Concentración, hasta " + n + (n === "1" ? " minuto" : " minutos")],
        [/\bConcentration, up to (\d+) hours?\b/gi, (x, n) => "Concentración, hasta " + n + (n === "1" ? " hora" : " horas")],
        [/\bInstantaneous\b/gi, "Instantánea"], [/\bUntil Dispelled\b/gi, "Hasta que se disipe"],
        [/^Self\b/g, "Personal"], [/^Touch$/g, "Toque"], [/\bSight\b/g, "Vista"], [/\bUnlimited\b/g, "Ilimitado"],
        [/\b(\d+) actions?\b/gi, (x, n) => n + (n === "1" ? " acción" : " acciones")], [/^Action$/g, "1 acción"],
        [/\b(\d+) minutes?\b/g, (x, n) => n + (n === "1" ? " minuto" : " minutos")],
        [/\b(\d+) hours?\b/g, (x, n) => n + (n === "1" ? " hora" : " horas")],
        [/\b(\d+) days?\b/g, (x, n) => n + (n === "1" ? " día" : " días")],
        [/\b(\d+) rounds?\b/g, (x, n) => n + (n === "1" ? " asalto" : " asaltos")],
        [/\bRequires Attunement\b/gi, "requiere sintonía"], [/\bWondrous Item\b/gi, "objeto maravilloso"],
        [/\bVery Rare\b/g, "muy rara"], [/\bUncommon\b/g, "poco común"], [/\bLegendary\b/g, "legendaria"],
        [/\bArtifact\b/g, "artefacto"], [/\bRare\b/g, "rara"], [/\bCommon\b/g, "común"],
        [/\bBard\b/g, "bardo"], [/\bCleric\b/g, "clérigo"], [/\bDruid\b/g, "druida"], [/\bPaladin\b/g, "paladín"],
        [/\bRanger\b/g, "explorador"], [/\bSorcerer\b/g, "hechicero"], [/\bWarlock\b/g, "brujo"], [/\bWizard\b/g, "mago"],
    ].concat(T_CARACT.map(([en, es]) => [new RegExp("\\*" + en + " Saving Throw:\\*", "gi"), "*Tirada de salvación de " + es + ":*"]),
        T_CARACT.map(([en, es]) => [new RegExp("\\b" + en + " saving throws?\\b", "gi"), "tirada de salvación de " + es]),
        T_CARACT.map(([en, es]) => [new RegExp("\\b" + en + " \\(([A-Z][a-z]+(?: [A-Z][a-z]+)*)\\) check\\b", "g"),
            "prueba de " + es + " ($1)"]),
        T_CARACT.map(([en, es]) => [new RegExp("\\b" + en + " check\\b", "g"), "prueba de " + es]),
        T_CARACT.map(([en, es]) => [new RegExp("\\b" + en + "\\b", "g"), es]),
        // «7 (2d6) Fire damage» → «7 (2d6) de daño de fuego».
        T_DANOS.map(([en, es]) => [new RegExp("\\) " + en + " damage\\b", "gi"),
            ") de daño " + (/^(contundente|cortante|perforante|necrótico|psíquico|radiante)$/.test(es) ? "" : "de ") + es]),
        T_DANOS.map(([en, es]) => [new RegExp("\\b" + en + " damage\\b", "gi"), "daño " +
            (/^(contundente|cortante|perforante|necrótico|psíquico|radiante)$/.test(es) ? "" : "de ") + es]),
        T_DANOS.map(([en, es]) => [new RegExp("\\b" + en + "\\b", "g"), es]),
        T_ESTADOS.map(([en, es]) => [new RegExp("\\b" + en + "\\b", "g"), es]),
        [[/\bsaving throws?\b/gi, "tirada de salvación"], [/\battack rolls?\b/gi, "tirada de ataque"],
            [/\bability checks?\b/gi, "prueba de característica"], [/\bthe (\S+) condition\b/g, "el estado $1"]]);

    function traducir(texto) {
        let t = String(texto || "");
        if (!t) {
            return t;
        }
        T_FRASES.forEach(([re, por]) => {
            t = t.replace(re, por);
        });
        return t;
    }

    // «Large Dragon (Chromatic)» → «Dragón (Chromatic) Grande»; si ya
    // está en español, tal cual.
    function traducirTipo(texto) {
        // (En 2014 iba en minúsculas: «Medium monstrosity».)
        const may = String(texto || "").trim().replace(/\b(tiny|small|medium|large|huge|gargantuan|aberration|beast|celestial|construct|dragon|elemental|fey|fiend|giant|humanoid|monstrosity|ooze|plant|undead|swarm)\b/g,
            (w) => w.charAt(0).toUpperCase() + w.slice(1));
        const m = /^(Tiny|Small|Medium|Large|Huge|Gargantuan)(?: or (Tiny|Small|Medium|Large|Huge|Gargantuan))? ([A-Za-z]+)(.*)$/
            .exec(may);
        if (!m) {
            return traducir(texto);
        }
        const tam = (x) => (T_TAMANOS.find(([en]) => en === x) || [x, x])[1];
        const tipo = (T_TIPOS.find(([en]) => en === m[3]) || [m[3], m[3]])[1];
        return tipo + traducir(m[4]) + " " + tam(m[1]) + (m[2] ? " o " + tam(m[2]) : "");
    }

    // ---- LAS REGLAS (o solo las de un grupo: las condiciones son
    // «Estados» y las acciones, «Acciones») ----
    // ---- LAS REGLAS PROPIAS (homebrew): las de tu mesa, guardadas en el
    // navegador («richi-master-homebrew»: [{id, nombre, icono, texto}]),
    // las mismas en todos los perfiles. Salen en su ventana, al final de
    // «todas las reglas» y en el buscador de arriba. ----
    const CLAVE_HOMEBREW = "richi-master-homebrew";
    const CLAVE_IMAGENES = "richi-master-imagenes";
    const CLAVE_PLANTILLAS = "richi-master-plantillas";

    function leerHomebrew() {
        try {
            const x = JSON.parse(localStorage.getItem(CLAVE_HOMEBREW) || "[]");
            return Array.isArray(x) ? x : [];
        } catch (e) {
            return [];
        }
    }

    function guardarHomebrew(lista) {
        try {
            localStorage.setItem(CLAVE_HOMEBREW, JSON.stringify(lista));
        } catch (e) {
            // Sin almacenamiento: solo mientras esté abierta.
        }
        document.dispatchEvent(new CustomEvent("master:homebrew"));
    }

    // Escucha un evento mientras «dentro» siga en la página.
    function mientrasEste(dentro, evento, alPasar) {
        let puesta = false;
        const f = (e) => {
            if (dentro.isConnected) {
                puesta = true;
                alPasar(e);
            } else if (puesta) {
                document.removeEventListener(evento, f);
            }
        };
        document.addEventListener(evento, f);
    }

    // Una regla en su ventana (las del SRD y las propias).
    function abrirRegla(r, vuelta, fuente) {
        const cuerpo = crear("div", "oc-regla-ventana");
        if (r.icono) {
            const grande = crear("p", "oc-regla-ventana-dibujo", r.icono);
            grande.setAttribute("aria-hidden", "true");
            cuerpo.appendChild(grande);
        }
        if (r.grupo) {
            cuerpo.appendChild(crear("p", "oc-hoja-nota", r.grupo + (r.alias ? " · también: " + r.alias : "")));
        }
        cuerpo.appendChild(markdown(r.texto));
        if (fuente) {
            cuerpo.appendChild(crear("p", "oc-hoja-nota master-fuente", fuente));
        }
        if (window.ocDadosEnTexto) {
            window.ocDadosEnTexto(cuerpo);
        }
        const fijar = botonDe("oc-vida-accion", "📌 al tablero", () => {
            cerrar();
            anadir("ficha", { titulo: r.nombre, datos: { que: r.propia ? "propia" : "regla", id: r.id || r.nombre } });
        }, "Poner " + r.nombre + " en el tablero");
        cuerpo.appendChild(fijar);
        const cerrar = window.ocVentana.abrir({ titulo: r.nombre, cuerpo, vuelta, clase: "es-regla" });
    }

    function montarReglas(dentro, m, soloGrupo) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando las reglas…"));
        pedir("datos/personajes/reglas-dnd.json").then((datos) => {
            const pintar = () => {
                const propias = soloGrupo ? [] : leerHomebrew().map((r) => Object.assign({ grupo: "🏠 Reglas propias" }, r));
                const reglas = (datos.reglas || []).filter((r) => !soloGrupo || r.grupo === soloGrupo).concat(propias);
                const caja = crear("div", "oc-reglas");
                const grupos = {};
                const plegados = m.datos.plegados || [];
                reglas.forEach((r) => {
                    if (!grupos[r.grupo]) {
                        const g = crear("div", "oc-reglas-grupo");
                        const lista = crear("ul", "oc-reglas-lista");
                        lista.id = "master-reglas-" + m.id + "-" + Object.keys(grupos).length;
                        if (!soloGrupo) {
                            // Cada grupo se pliega y despliega con su título.
                            const h = crear("h3", "oc-reglas-titulo master-reglas-plegable");
                            const b = botonDe("master-reglas-grupo", "", () => {
                                const abierto = b.getAttribute("aria-expanded") === "true";
                                b.setAttribute("aria-expanded", abierto ? "false" : "true");
                                lista.hidden = abierto;
                                m.datos.plegados = abierto ? (m.datos.plegados || []).concat(r.grupo)
                                    : (m.datos.plegados || []).filter((x) => x !== r.grupo);
                                guardar();
                            });
                            const flecha = crear("span", "master-reglas-flecha", "▸");
                            flecha.setAttribute("aria-hidden", "true");
                            b.append(flecha, document.createTextNode(r.grupo));
                            const plegado = plegados.indexOf(r.grupo) >= 0;
                            b.setAttribute("aria-expanded", plegado ? "false" : "true");
                            b.setAttribute("aria-controls", lista.id);
                            lista.hidden = plegado;
                            h.appendChild(b);
                            g.appendChild(h);
                        }
                        g.appendChild(lista);
                        caja.appendChild(g);
                        grupos[r.grupo] = lista;
                    }
                    const li = crear("li", "oc-regla");
                    const detalles = crear("details");
                    const resumen = crear("summary");
                    if (r.icono) {
                        resumen.appendChild(crear("span", "oc-regla-icono", r.icono));
                    }
                    resumen.appendChild(crear("span", "oc-regla-nombre", r.nombre + (r.alias ? " (" + r.alias + ")" : "")));
                    detalles.append(resumen, markdown(r.texto));
                    li.appendChild(detalles);
                    grupos[r.grupo].appendChild(li);
                });
                dentro.replaceChildren(caja);
                window.ocMontar.reglas(caja, "master-buscar-" + m.id);
                // Al buscar, se ven todos los grupos (los plegados también).
                const buscar = caja.querySelector("input[type=search]");
                if (buscar) {
                    buscar.addEventListener("input", () => {
                        const hay = !!buscar.value.trim();
                        caja.querySelectorAll(".master-reglas-grupo").forEach((b) => {
                            const lista = document.getElementById(b.getAttribute("aria-controls"));
                            lista.hidden = !hay && b.getAttribute("aria-expanded") === "false";
                        });
                    });
                }
                if (datos.fuente) {
                    dentro.appendChild(crear("p", "oc-hoja-nota master-fuente", datos.fuente));
                }
            };
            pintar();
            if (!soloGrupo) {
                mientrasEste(dentro, "master:homebrew", pintar);
            }
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar las reglas."));
        });
    }

    function montarHomebrew(dentro) {
        const lista = crear("ul", "master-homebrew");
        lista.setAttribute("aria-label", "Reglas propias");
        const vacio = crear("p", "oc-vacio", "Todavía no hay reglas propias.");
        // El formulario: para una nueva o para cambiar una.
        const form = crear("form", "master-homebrew-form");
        form.hidden = true;
        const campo = (id, texto, etiqueta) => {
            const et = crear("label", "oc-dados-etiqueta", texto);
            const x = crear(etiqueta || "input", "oc-dados-texto" + (etiqueta === "textarea" ? " oc-notas-texto" : ""));
            x.id = "master-homebrew-" + id;
            et.htmlFor = x.id;
            if (etiqueta !== "textarea") {
                x.autocomplete = "off";
            }
            form.append(et, x);
            return x;
        };
        const nombre = campo("nombre", "nombre");
        nombre.maxLength = 60;
        nombre.required = true;
        const icono = campo("icono", "dibujo (un emoji, si quieres)");
        icono.maxLength = 4;
        icono.placeholder = "🍺";
        const texto = campo("texto", "la regla (con **negrita**, *cursiva*, «- » para listas y «| a | b |» para tablas)",
            "textarea");
        texto.rows = 8;
        const botones = crear("div", "master-anadir-otras");
        const listo = crear("button", "oc-vida-accion es-principal", "guardar");
        listo.type = "submit";
        let editando = null;
        const cancelar = botonDe("oc-vida-accion", "cancelar", () => cerrarForm());
        botones.append(listo, cancelar);
        form.appendChild(botones);
        const nueva = botonDe("oc-vida-accion es-principal", "＋ regla propia", () => abrirForm(null));
        function abrirForm(r) {
            editando = r;
            nombre.value = r ? r.nombre : "";
            icono.value = r ? r.icono || "" : "";
            texto.value = r ? r.texto : "";
            form.hidden = false;
            nueva.hidden = true;
            nombre.focus();
        }
        function cerrarForm() {
            form.hidden = true;
            nueva.hidden = false;
            nueva.focus();
        }
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const todas = leerHomebrew();
            const datos = { nombre: nombre.value.trim(), icono: icono.value.trim(), texto: texto.value.trim() };
            if (!datos.nombre) {
                nombre.focus();
                return;
            }
            if (editando) {
                const i = todas.findIndex((x) => x.id === editando.id);
                if (i >= 0) {
                    todas[i] = Object.assign(todas[i], datos);
                }
            } else {
                todas.push(Object.assign({ id: "h" + Date.now().toString(36) }, datos));
            }
            guardarHomebrew(todas);
            avisar("Guardada: " + datos.nombre + ".");
            cerrarForm();
        });
        const pintar = () => {
            const todas = leerHomebrew();
            lista.replaceChildren(...todas.map((r) => {
                const li = crear("li", "master-homebrew-regla");
                const ver = botonDe("oc-regla-boton", "", () => abrirRegla(Object.assign({ propia: true,
                    grupo: "🏠 Reglas propias" }, r), ver));
                ver.setAttribute("aria-haspopup", "dialog");
                const d = crear("span", "oc-regla-dibujo", r.icono || "🏠");
                d.setAttribute("aria-hidden", "true");
                ver.append(d, crear("span", "oc-regla-texto", r.nombre));
                const cambiar = botonDe("master-party-quitar", "✎", () => abrirForm(r), "Cambiar " + r.nombre);
                let seguro = false;
                const quitar = botonDe("master-party-quitar", "✕", () => {
                    if (!seguro) {
                        seguro = true;
                        quitar.setAttribute("aria-label", "¿Seguro? Pulsa otra vez para borrar " + r.nombre);
                        avisar("Pulsa otra vez para borrar " + r.nombre + ".");
                        return;
                    }
                    guardarHomebrew(leerHomebrew().filter((x) => x.id !== r.id));
                    avisar("Borrada: " + r.nombre + ".");
                    nueva.focus();
                }, "Borrar " + r.nombre);
                li.append(ver, cambiar, quitar);
                return li;
            }));
            vacio.hidden = !!todas.length;
        };
        mientrasEste(dentro, "master:homebrew", pintar);
        dentro.append(lista, vacio, nueva, form);
        pintar();
    }

    // ---- LOS CONJUROS: los 339 del SRD 5.2 (D&D 2024), en
    // datos/personajes/compendio/conjuros-srd.json. Cada uno abre su
    // ventana (abrirConjuro), desde el buscador o desde un monstruo. ----
    const CONJUROS_SRD = "datos/personajes/compendio/conjuros-srd.json";
    const nivelDe = (c) => (c.nivel ? "Nivel " + c.nivel : "Truco");

    function abrirConjuro(c, vuelta, fuente) {
        const cuerpo = cuerpoConjuro(c, fuente);
        const fijar = botonDe("oc-vida-accion", "📌 al tablero", () => {
            cerrar();
            anadir("ficha", { titulo: c.nombre, datos: { que: "conjuro", id: c.en } });
        }, "Poner " + c.nombre + " en el tablero");
        cuerpo.appendChild(fijar);
        const cerrar = window.ocVentana.abrir({ titulo: c.nombre, cuerpo, vuelta, clase: "es-regla" });
    }

    function cuerpoConjuro(c, fuenteSrd) {
        const fuente = fuenteDe(c, fuenteSrd);
        const cuerpo = crear("div", "oc-regla-ventana");
        const chapas = crear("ul", "oc-desplegable-datos");
        [nivelDe(c), c.escuela, c.ritual ? "ritual" : "", c.conc ? "concentración" : ""].filter(Boolean)
            .forEach((t) => chapas.appendChild(crear("li", "", t)));
        const dl = crear("dl", "master-bicho-datos");
        [["Lanzamiento", c.tiempo], ["Alcance", c.alcance], ["Componentes", c.comp], ["Duración", c.dur],
            ["Clases", (c.clases || []).join(", ")]].forEach(([k, v]) => {
            if (v) {
                dl.append(crear("dt", "", k), crear("dd", "", v));
            }
        });
        cuerpo.append(chapas, dl);
        if (c.ingles) {
            cuerpo.appendChild(crear("p", "oc-hoja-nota", "Este todavía no está traducido: va en inglés."));
        }
        cuerpo.appendChild(markdown(c.texto));
        if (c.superior) {
            cuerpo.appendChild(markdown(c.superior));
        }
        if (fuente) {
            cuerpo.appendChild(crear("p", "oc-hoja-nota master-fuente", fuente));
        }
        if (window.ocDadosEnTexto) {
            window.ocDadosEnTexto(cuerpo);
        }
        return cuerpo;
    }

    // ---- LAS IMÁGENES de monstruos y objetos: la que pongas tú, un
    // archivo de tu dispositivo guardado en él (IndexedDB, como los
    // documentos). En «richi-master-imagenes» queda {"monstruo:Aboleth":
    // "archivo:<id>"}. Las de antes (un enlace https) se siguen viendo si
    // hay conexión. ----
    function urlImagenSegura(u) {
        const x = String(u || "").trim();
        return /^https:\/\/[^\s"'<>()\\]+$/.test(x) ? x : "";
    }

    function leerImagenes() {
        try {
            return JSON.parse(localStorage.getItem(CLAVE_IMAGENES) || "{}") || {};
        } catch (e) {
            return {};
        }
    }

    function guardarImagenes(todas) {
        try {
            localStorage.setItem(CLAVE_IMAGENES, JSON.stringify(todas));
        } catch (e) {
            // Sin almacenamiento: se ve igual, sin guardar.
        }
    }

    // La imagen de una clave en un <img> (con su dirección blob: o https).
    function ponerImagenGuardada(img, valor) {
        const v = String(valor || "");
        if (v.indexOf("archivo:") === 0) {
            return archivoLeer(v.slice(8)).then((blob) => {
                if (!blob) {
                    return false;
                }
                const archivoBlob = URL.createObjectURL(blob);
                img.src = archivoBlob;
                return true;
            }).catch(() => false);
        }
        const bien = urlImagenSegura(v);
        if (bien) {
            img.src = urlImagenSegura(bien);
        }
        return Promise.resolve(!!bien);
    }

    function panelImagen(clave, nombre) {
        const caja = crear("div", "master-imagen");
        const img = crear("img", "master-imagen-propia");
        img.alt = "Tu imagen de " + nombre;
        img.hidden = true;
        const subir = crear("input");
        subir.type = "file";
        subir.accept = "image/*";
        subir.hidden = true;
        const poner = botonDe("oc-vida-accion", "🖼️ poner una imagen", () => subir.click(), "Poner una imagen de " + nombre
            + " (de tu dispositivo)");
        const grande = botonDe("oc-vida-accion", "🔍 en grande", () => {
            const g = crear("img", "master-imagen-grande");
            g.alt = img.alt;
            ponerImagenGuardada(g, leerImagenes()[clave]);
            window.ocVentana.abrir({ titulo: nombre, cuerpo: g, vuelta: grande, clase: "es-ancha" });
        }, "Ver tu imagen de " + nombre + " en grande");
        const quitar = botonDe("oc-vida-accion", "✕ quitar", () => {
            const todas = leerImagenes();
            const v = String(todas[clave] || "");
            if (v.indexOf("archivo:") === 0) {
                archivoBorrar(v.slice(8));
            }
            delete todas[clave];
            guardarImagenes(todas);
            pintar();
            avisar("Imagen quitada.");
            poner.focus();
        }, "Quitar tu imagen de " + nombre);
        const botones = crear("div", "master-imagen-botones");
        botones.append(poner, grande, quitar);
        const nota = crear("p", "oc-hoja-nota", "Una imagen de tu dispositivo: se queda sólo en él (⚙ → exportar para llevarla).");
        function pintar() {
            const v = leerImagenes()[clave];
            img.removeAttribute("src");
            img.hidden = true;
            grande.hidden = true;
            quitar.hidden = true;
            if (!v) {
                return;
            }
            ponerImagenGuardada(img, v).then((hay) => {
                img.hidden = !hay;
                grande.hidden = !hay;
                quitar.hidden = false;
            });
        }
        subir.addEventListener("change", () => {
            const f = subir.files && subir.files[0];
            subir.value = "";
            if (!f || !/^image\//.test(f.type) || f.size > MAX_ARCHIVO) {
                avisar("Sólo imágenes de hasta 50 MB.");
                return;
            }
            const id = idDoc("a");
            archivoGuardar(id, f).then(() => {
                const todas = leerImagenes();
                const v = String(todas[clave] || "");
                if (v.indexOf("archivo:") === 0) {
                    archivoBorrar(v.slice(8));
                }
                todas[clave] = "archivo:" + id;
                guardarImagenes(todas);
                pintar();
                avisar("Imagen puesta.");
            }).catch(() => avisar("No se ha podido guardar la imagen."));
        });
        caja.append(img, botones, subir, nota);
        pintar();
        return caja;
    }

    // Lo de un objeto (de tienda.json): sus datos y qué hace.
    function datosObjeto(o) {
        const cuerpo = crear("div", "master-objeto");
        const dl = crear("dl", "master-bicho-datos");
        const fila = (que, valor) => {
            if (valor) {
                dl.append(crear("dt", "", que), crear("dd", "", String(valor)));
            }
        };
        fila("Categoría", o.cat);
        fila("Rareza", o.rareza);
        fila("Sintonía", o.sint ? "la requiere" : "");
        fila("Detalles", o.det);
        fila("Peso", o.peso);
        fila("Nota", o.nota);
        fila("Precio", o.cp ? moneda(o.cp) : "");
        fila("Se vende en", (o.tiendas || []).join(", ").toLowerCase());
        fila("En inglés", o.en);
        cuerpo.appendChild(dl);
        if (o.texto) {
            const que = markdown(o.texto);
            que.classList.add("master-objeto-texto");
            cuerpo.appendChild(que);
            if (window.ocDadosEnTexto) {
                window.ocDadosEnTexto(que);
            }
            enlazarConjuros(que);
        }
        cuerpo.append(crear("h3", "master-imagen-titulo", "🖼️ imagen"), panelImagen("objeto:" + o.en, o.nombre));
        return cuerpo;
    }

    function abrirObjeto(o, vuelta, fuenteSrd) {
        const fuente = fuenteDe(o, fuenteSrd);
        const cuerpo = datosObjeto(o);
        if (fuente) {
            cuerpo.appendChild(crear("p", "oc-hoja-nota master-fuente", fuente));
        }
        cuerpo.appendChild(botonDe("oc-vida-accion", "📌 al tablero", () => {
            cerrar();
            anadir("ficha", { titulo: o.nombre, datos: { que: "objeto", id: o.en } });
        }, "Poner " + o.nombre + " en el tablero"));
        const cerrar = window.ocVentana.abrir({ titulo: o.nombre, cuerpo, vuelta, clase: "es-regla" });
    }

    // UNA FICHA EN EL TABLERO (📌): un conjuro, una regla (del SRD o
    // propia) o un objeto, en su ventana. «datos»: {que, id}.
    function montarFicha(dentro, m) {
        m.datos = m.datos || {};
        const que = m.datos.que;
        const id = m.datos.id;
        const poner = (x) => dentro.replaceChildren(x || crear("p", "oc-vacio", "Ya no está."));
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        if (que === "propia") {
            const pintar = () => {
                const r = leerHomebrew().find((x) => x.id === id);
                poner(r ? markdown(r.texto) : null);
            };
            pintar();
            mientrasEste(dentro, "master:homebrew", pintar);
            return;
        }
        if (que === "otro") {
            const pintar = () => {
                const x = leerPropios().otros.find((y) => y.id === id);
                const caja = x ? crear("div") : null;
                if (x) {
                    caja.append(crear("p", "oc-hoja-nota", x.cat), markdown(x.texto), crear("p", "oc-hoja-nota master-fuente", fuenteDe(x)));
                }
                poner(caja);
            };
            pintar();
            mientrasEste(dentro, "master:propios", pintar);
            return;
        }
        if (que === "rasgo") {
            pedir(RASGOS_SRD).then((datos) => {
                const r = (datos.rasgos || []).find((x) => idRasgo(x) === id);
                poner(r ? cuerpoRasgo(r, datos.fuente) : null);
            }).catch(() => poner(null));
            return;
        }
        const ruta = { conjuro: CONJUROS_SRD, regla: "datos/personajes/reglas-dnd.json",
            objeto: "datos/personajes/compendio/tienda.json" }[que];
        if (!ruta) {
            poner(null);
            return;
        }
        pedir(ruta).then((datos) => {
            if (que === "conjuro") {
                const c = (datos.conjuros || []).find((x) => x.en === id);
                poner(c ? cuerpoConjuro(c, datos.fuente) : null);
            } else if (que === "regla") {
                const r = (datos.reglas || []).find((x) => x.nombre === id);
                const t = r ? markdown(r.texto) : null;
                if (t && window.ocDadosEnTexto) {
                    window.ocDadosEnTexto(t);
                }
                poner(t);
            } else {
                const o = (datos.objetos || []).find((x) => x.en === id);
                poner(o ? datosObjeto(o) : null);
            }
        }).catch(() => poner(crear("p", "oc-vacio", "No he podido cargarlo.")));
    }

    // Un botón con el nombre de un conjuro que abre su ventana.
    function botonConjuro(c, texto, fuente) {
        const b = botonDe("master-conjuro-enlace", texto || c.nombre, () => abrirConjuro(c, b, fuente));
        b.setAttribute("aria-haspopup", "dialog");
        return b;
    }

    // En un texto ya montado, cada nombre de conjuro en cursiva
    // («*Bola de fuego*») pasa a ser su botón.
    function enlazarConjuros(raiz) {
        pedir(CONJUROS_SRD).then((datos) => {
            const porNombre = {};
            (datos.conjuros || []).forEach((c) => {
                porNombre[llano(c.nombre)] = c;
            });
            raiz.querySelectorAll("em").forEach((em) => {
                const c = porNombre[llano(em.textContent.trim())];
                if (c && !em.closest("button")) {
                    const b = botonConjuro(c, em.textContent, datos.fuente);
                    em.replaceWith(b);
                }
            });
        }).catch(() => {
            // Sin los conjuros: se quedan en cursiva.
        });
    }

    // ---- LOS RASGOS Y DOTES: los del SRD 5.2 (de clase, de especie y
    // dotes), en datos/personajes/compendio/rasgos-srd.json, y los tuyos
    // (＋ compendio → rasgos y dotes). En la ficha, cada rasgo en negrita
    // («- **Furia** (Bárbaro)») se abre con su texto. ----
    const RASGOS_SRD = "datos/personajes/compendio/rasgos-srd.json";
    const idRasgo = (r) => (r.propio ? r.id : r.en + "|" + r.de);
    const datosRasgo = (r) => [r.tipo, r.de && r.de !== "dote" ? r.de : "", r.nivel ? "nivel " + r.nivel : ""].filter(Boolean);

    function cuerpoRasgo(r, fuenteSrd) {
        const cuerpo = crear("div", "oc-regla-ventana");
        const chapas = crear("ul", "oc-desplegable-datos");
        datosRasgo(r).forEach((t) => chapas.appendChild(crear("li", "", t)));
        const t = markdown(r.texto || "");
        enlazarConjuros(t);
        cuerpo.append(chapas, t);
        const fuente = fuenteDe(r, fuenteSrd);
        if (fuente) {
            cuerpo.appendChild(crear("p", "oc-hoja-nota master-fuente", fuente));
        }
        return cuerpo;
    }

    function abrirRasgo(r, vuelta, fuente) {
        const cuerpo = cuerpoRasgo(r, fuente);
        cuerpo.appendChild(botonDe("oc-vida-accion", "📌 al tablero", () => {
            cerrar();
            anadir("ficha", { titulo: r.nombre, datos: { que: "rasgo", id: idRasgo(r) } });
        }, "Poner " + r.nombre + " en el tablero"));
        const cerrar = window.ocVentana.abrir({ titulo: r.nombre, cuerpo, vuelta, clase: "es-regla" });
    }

    // El rasgo de ese nombre (en español o en inglés, sin lo de entre
    // paréntesis); si hay varios (los de cada clase), el de su clase o especie.
    function rasgoDe(lista, nombre, pista) {
        const limpio = (t) => llano(String(t || "").replace(/\s*\([^)]*\)\s*$/, "").replace(/^\d+:\s*/, "").trim());
        const n = limpio(nombre);
        if (!n) {
            return null;
        }
        const salen = lista.filter((r) => limpio(r.nombre) === n || limpio(r.en) === n || llano(r.nombre) === llano(nombre));
        if (salen.length < 2) {
            return salen[0] || null;
        }
        const p = llano(pista || "");
        return salen.find((r) => r.propio) || salen.find((r) => p && llano(r.de || "").split(/[ ,()]+/).some((w) => w.length > 3
            && p.includes(w))) || salen[0];
    }

    // En un texto ya montado, cada nombre en negrita que sea un rasgo o
    // una dote pasa a ser su botón («pista»: la clase y la especie del PJ).
    function enlazarRasgos(raiz, pista) {
        pedir(RASGOS_SRD).then((datos) => {
            const lista = datos.rasgos || [];
            raiz.querySelectorAll("strong").forEach((st) => {
                const r = !st.closest("button") && rasgoDe(lista, st.textContent, pista);
                if (r) {
                    const b = botonDe("master-conjuro-enlace master-rasgo-enlace", st.textContent, () => abrirRasgo(r, b, datos.fuente));
                    b.setAttribute("aria-haspopup", "dialog");
                    st.replaceWith(b);
                }
            });
        }).catch(() => {
            // Sin el compendio: se quedan en negrita.
        });
    }

    // El buscador de rasgos y dotes (un widget, como el de conjuros).
    function montarRasgos(dentro, m) {
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando los rasgos…"));
        const pintarTodo = () => pedir(RASGOS_SRD).then((datos) => {
            const todos = (datos.rasgos || []).map((r) => ({ r, buscar: llano(r.nombre + " " + r.en + " " + (r.de || "") + " " + r.tipo) }));
            const fila = crear("div", "master-tienda-campos");
            const campo = (control, texto, id) => {
                const caja = crear("div", "master-tienda-campo" + (control.tagName === "INPUT" ? " es-ancho" : ""));
                const et = crear("label", "oc-dados-etiqueta", texto);
                control.id = id + m.id;
                et.htmlFor = control.id;
                caja.append(et, control);
                fila.appendChild(caja);
                return control;
            };
            const elegir = (opciones) => {
                const sel = crear("select", "oc-dados-elegir");
                opciones.forEach(([v, t]) => {
                    const o = crear("option", "", t);
                    o.value = v;
                    sel.appendChild(o);
                });
                return sel;
            };
            const tipos = Array.from(new Set(todos.map((x) => x.r.tipo))).sort();
            const tipo = campo(elegir([["", "todos"]].concat(tipos.map((t) => [t, t]))), "qué", "master-rasgos-tipo-");
            const des = Array.from(new Set(todos.filter((x) => x.r.tipo !== "rasgo de clase" || !/\(/.test(x.r.de))
                .flatMap((x) => String(x.r.de || "").replace(/ \(.*$/, "").split(/,\s*/)).filter((d) => d && d !== "dote"))).sort((a, b) =>
                a.localeCompare(b, "es"));
            const de = campo(elegir([["", "todas"]].concat(des.map((t) => [t, t]))), "clase o especie", "master-rasgos-de-");
            const input = campo(Object.assign(crear("input", "oc-dados-texto"), { type: "search", placeholder: "furia, alerta, sneak attack…" }),
                "buscar", "master-rasgos-");
            const cuantos = crear("p", "oc-hoja-nota");
            cuantos.setAttribute("role", "status");
            const lista = crear("ul", "master-conjuros");
            lista.setAttribute("aria-label", "Rasgos y dotes");
            const pintar = () => {
                const q = llano(input.value.trim());
                const d = llano(de.value);
                const salen = todos.filter((x) => (!q || x.buscar.includes(q)) && (!tipo.value || x.r.tipo === tipo.value)
                    && (!d || llano(x.r.de || "").includes(d)));
                lista.replaceChildren(...salen.slice(0, 80).map((x) => {
                    const li = crear("li");
                    const b = botonDe("master-conjuro", "", () => abrirRasgo(x.r, b, datos.fuente));
                    b.setAttribute("aria-haspopup", "dialog");
                    b.append(crear("span", "master-conjuro-nombre", x.r.nombre), crear("span", "master-conjuro-datos",
                        datosRasgo(x.r).join(" · ") + (x.r.propio ? " · 🛠️ tuyo" : "")));
                    li.appendChild(b);
                    return li;
                }));
                cuantos.textContent = salen.length ? salen.length + (salen.length === 1 ? " resultado" : " resultados")
                    + (salen.length > 80 ? " (salen los 80 primeros)" : "") : "Nada con eso.";
            };
            let espera = 0;
            input.addEventListener("input", () => {
                clearTimeout(espera);
                espera = setTimeout(pintar, 150);
            });
            [tipo, de].forEach((c) => c.addEventListener("change", pintar));
            dentro.replaceChildren(fila, cuantos, lista, crear("p", "oc-hoja-nota master-fuente", datos.fuente || ""));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar los rasgos."));
        });
        pintarTodo();
        mientrasEste(dentro, "master:propios", () => {
            if (!dentro.contains(document.activeElement)) {
                pintarTodo();
            }
        });
    }

    function montarConjuros(dentro, m) {
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando los conjuros…"));
        pedir(CONJUROS_SRD).then((datos) => {
            const conjuros = (datos.conjuros || []).map((c) => ({ c, buscar: llano(c.nombre + " " + c.en + " " + c.escuela) }));
            const fila = crear("div", "master-tienda-campos");
            const campo = (control, texto, id) => {
                const caja = crear("div", "master-tienda-campo" + (control.tagName === "INPUT" ? " es-ancho" : ""));
                const et = crear("label", "oc-dados-etiqueta", texto);
                control.id = id + m.id;
                et.htmlFor = control.id;
                caja.append(et, control);
                fila.appendChild(caja);
                return control;
            };
            const elegir = (opciones) => {
                const sel = crear("select", "oc-dados-elegir");
                opciones.forEach(([v, t]) => {
                    const o = crear("option", "", t);
                    o.value = v;
                    sel.appendChild(o);
                });
                return sel;
            };
            const input = crear("input", "oc-dados-texto");
            input.type = "search";
            input.placeholder = "bola de fuego, fireball…";
            const nivel = campo(elegir([["", "todos"], ["0", "trucos"]].concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [String(n), "nivel " + n]))),
                "nivel", "master-conjuros-nivel-");
            const escuelas = Array.from(new Set(conjuros.map((x) => x.c.escuela))).sort();
            const escuela = campo(elegir([["", "todas"]].concat(escuelas.map((e) => [e, e]))), "escuela", "master-conjuros-escuela-");
            const clases = Array.from(new Set(conjuros.flatMap((x) => x.c.clases || []))).sort();
            const clase = campo(elegir([["", "todas"]].concat(clases.map((e) => [e, e]))), "clase", "master-conjuros-clase-");
            campo(input, "buscar", "master-conjuros-");
            const cuantos = crear("p", "oc-hoja-nota");
            cuantos.setAttribute("role", "status");
            const lista = crear("ul", "master-conjuros");
            const pintar = () => {
                const q = llano(input.value.trim());
                const n = nivel.value === "" ? null : parseInt(nivel.value, 10);
                const salen = conjuros.filter((x) => (!q || x.buscar.includes(q)) && (n === null || x.c.nivel === n)
                    && (!escuela.value || x.c.escuela === escuela.value) && (!clase.value || (x.c.clases || []).indexOf(clase.value) >= 0));
                lista.replaceChildren(...salen.slice(0, 80).map((x) => {
                    const li = crear("li");
                    const b = botonDe("master-conjuro", "", () => abrirConjuro(x.c, b, datos.fuente));
                    b.setAttribute("aria-haspopup", "dialog");
                    b.append(crear("span", "master-conjuro-nombre", x.c.nombre),
                        crear("span", "master-conjuro-datos", [nivelDe(x.c), x.c.escuela, x.c.tiempo].join(" · ")
                            + (x.c.ingles ? " · (en inglés)" : "")));
                    li.appendChild(b);
                    return li;
                }));
                cuantos.textContent = salen.length ? salen.length + (salen.length === 1 ? " conjuro" : " conjuros")
                    + (salen.length > 80 ? " (salen los 80 primeros)" : "") : "Ningún conjuro con eso.";
            };
            let espera = 0;
            input.addEventListener("input", () => {
                clearTimeout(espera);
                espera = setTimeout(pintar, 150);
            });
            [nivel, escuela, clase].forEach((c) => c.addEventListener("change", pintar));
            dentro.replaceChildren(fila, cuantos, lista, crear("p", "oc-hoja-nota master-fuente", datos.fuente || ""));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar los conjuros."));
        });
    }

    // ---- LA FICHA DE UN PJ: en su ventana del tablero, con pestañas
    // (como los monstruos): habilidades, armas, hechizos, historia,
    // relaciones y extra. Todo lo escribe el máster (los PJ son de la
    // campaña, todo.pjs); los números salen de la party. Los apuntes del
    // máster (miedos, secretos, relaciones, ganchos…) van en pj.apuntes. ----
    const HABILIDADES_PJ = [["Acrobacias", "des"], ["Atletismo", "fue"], ["Conocimiento arcano", "int", "arcan"], ["Engaño", "car"],
        ["Historia", "int"], ["Interpretación", "car"], ["Intimidación", "car"], ["Investigación", "int"], ["Juego de manos", "des"],
        ["Medicina", "sab"], ["Naturaleza", "int"], ["Percepción", "sab"], ["Perspicacia", "sab"], ["Persuasión", "car"],
        ["Religión", "int"], ["Sigilo", "des"], ["Supervivencia", "sab"], ["Trato con animales", "sab"]];
    const NOMBRES_CAR = { fue: "Fuerza", des: "Destreza", con: "Constitución", int: "Inteligencia", sab: "Sabiduría", car: "Carisma" };

    function nuevoIdPj() {
        const u = new Uint32Array(2);
        crypto.getRandomValues(u);
        return "pj" + u[0].toString(36) + u[1].toString(36);
    }

    // Sus hechizos: [{nivel, nombre}] (el nivel, del SRD si está).
    function conjurosPj(pj, srd) {
        return (pj.conjuros || []).map((n) => ({ nivel: srd[llano(n)] ? srd[llano(n)].nivel : null, nombre: n }));
    }

    // Un hechizo: el del SRD (o uno tuyo), con su ventana; si no, el nombre.
    function conjuroPj(nombre, srd, fuente) {
        const c = srd[llano(nombre)];
        return c ? botonConjuro(c, nombre, fuente) : crear("span", "", nombre);
    }

    // Unas pestañas (role="tablist", con las flechas, Inicio y Fin):
    // «paneles» [[título, panel]]; alElegir(i) al cambiar.
    function pestanasDe(paneles, etiqueta, uid, alElegir) {
        const lista = crear("div", "master-bicho-pestanas");
        lista.setAttribute("role", "tablist");
        lista.setAttribute("aria-label", etiqueta);
        const tabs = paneles.map(([titulo, panel], i) => {
            const t = botonDe("master-bicho-pestana", titulo, () => elegir(i, false));
            t.setAttribute("role", "tab");
            t.id = uid + "-t" + i;
            panel.id = uid + "-p" + i;
            panel.classList.add("master-bicho-panel");
            t.setAttribute("aria-controls", panel.id);
            panel.setAttribute("role", "tabpanel");
            panel.setAttribute("aria-labelledby", t.id);
            panel.tabIndex = 0;
            t.addEventListener("keydown", (e) => {
                const d = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: paneles.length - 1 - i }[e.key];
                if (d === undefined) {
                    return;
                }
                e.preventDefault();
                elegir((i + d + paneles.length) % paneles.length, true);
            });
            lista.appendChild(t);
            return t;
        });
        function elegir(i, foco) {
            tabs.forEach((t, j) => {
                t.setAttribute("aria-selected", j === i ? "true" : "false");
                t.tabIndex = j === i ? 0 : -1;
            });
            paneles.forEach(([, panel], j) => {
                panel.hidden = j !== i;
            });
            if (foco) {
                tabs[i].focus();
            }
            if (alElegir) {
                alElegir(i);
            }
        }
        return { lista, elegir };
    }

    // Abre (o trae delante) la ficha de un PJ de la party.
    function abrirFichaPj(pj, quien) {
        if (!pj.id) {
            pj.id = nuevoIdPj();
            guardar();
        }
        const ya = estado.modulos.find((x) => x.tipo === "pj" && x.datos && x.datos.pj === pj.id);
        if (ya && ya.grupo && !ya.delante) {
            verEnGrupo(ya, false);
        }
        if (ya && ya.el) {
            alFrente(ya);
            ya.el.scrollIntoView({ block: "nearest" });
            (ya.el.querySelector("[role=tab][aria-selected=true]") || ya.el).focus();
            return;
        }
        anadir("pj", { titulo: quien, datos: { pj: pj.id } });
    }

    // ---- LOS PERSONAJES (todo.pjs): la ficha de D&D entera de cada uno.
    // Se crean en la party («＋ personaje») o se traen de D&D Beyond; los
    // mismos en la party, en su ficha y en el inventario común. Cuando
    // cambian, «master:pjs» (con quién lo cambió, para no repintarse a sí
    // mismo). ----
    const SALVACIONES_PJ = ["fue", "des", "con", "int", "sab", "car"];
    const NIVELES_COMP = ["", "competente", "pericia"];
    const MONEDAS_PJ = [["pc", "pc", "cobre"], ["pp", "pp", "plata"], ["pe", "pe", "electro"], ["po", "po", "oro"], ["pt", "ppt", "platino"]];
    const ORO_DE_MONEDA = { pc: 0.01, pp: 0.1, pe: 0.5, po: 1, pt: 10 };
    const avisarPjs = (desde) => document.dispatchEvent(new CustomEvent("master:pjs", { detail: { desde } }));
    // LA PARTY Y LA INICIATIVA, A LA PAR: lo que se cambia en una (los PG)
    // se apunta en la otra.
    document.addEventListener("oc-iniciativa:pg", (e) => {
        const pj = todo && todo.pjs.find((x) => x.id === (e.detail || {}).pj);
        if (!pj || String(pj.pg) === String(e.detail.pg)) {
            return;
        }
        pj.pg = e.detail.pg;
        guardar();
        avisarPjs("ini");
    });
    document.addEventListener("master:pjs", (e) => {
        if ((e.detail || {}).desde === "ini" || !todo) {
            return;
        }
        let ini;
        try {
            ini = JSON.parse(localStorage.getItem("richi-oc-iniciativa") || "null");
        } catch (err) {
            ini = null;
        }
        if (!ini || !Array.isArray(ini.lista)) {
            return;
        }
        let cambia = false;
        ini.lista.forEach((c) => {
            const pj = c.pj && todo.pjs.find((x) => x.id === c.pj);
            if (!pj) {
                return;
            }
            const pg = numPj(pj.pg) === null ? "" : numPj(pj.pg);
            const ca = parseInt(pj.ca, 10) || "";
            if (pg !== "" && pg !== c.pg) {
                c.pg = pg;
                cambia = true;
            }
            if (ca !== "" && ca !== c.ca) {
                c.ca = ca;
                cambia = true;
            }
        });
        if (cambia) {
            try {
                localStorage.setItem("richi-oc-iniciativa", JSON.stringify(ini));
            } catch (err) {
                return;
            }
            document.dispatchEvent(new CustomEvent("oc-iniciativa:cambio"));
        }
    });

    // Lo de antes (texto suelto) a lo de ahora (listas y marcas).
    function normalizarPj(pj) {
        pj.id = pj.id || nuevoIdPj();
        if (!Array.isArray(pj.salvaciones)) {
            const t = llano(pj.salvacionesTxt || "");
            pj.salvaciones = SALVACIONES_PJ.filter((k) => t && (t.includes(llano(NOMBRES_CAR[k])) || new RegExp("\\b" + k + "\\b").test(t)));
        }
        if (!pj.habilidades || typeof pj.habilidades !== "object" || Array.isArray(pj.habilidades)) {
            const comp = String(pj.habilidadesTxt || "").split(",").map((s) => llano(s.trim())).filter(Boolean);
            pj.habilidades = {};
            HABILIDADES_PJ.forEach(([nombre, , clave]) => {
                const busca = clave || llano(nombre);
                const suya = comp.find((c) => c.startsWith(busca) || c.includes(busca));
                if (suya) {
                    pj.habilidades[nombre] = /pericia|experto|expertise/.test(suya) ? 2 : 1;
                }
            });
        }
        if (pj.rasgos === undefined && pj.rasgosTxt) {
            pj.rasgos = pj.rasgosTxt;
        }
        if (pj.historia === undefined && pj.historiaTxt) {
            pj.historia = pj.historiaTxt;
        }
        ["ataques", "objetos", "pnjs", "acciones"].forEach((k) => {
            pj[k] = Array.isArray(pj[k]) ? pj[k] : [];
        });
        ["espacios", "dinero", "apuntes"].forEach((k) => {
            pj[k] = pj[k] && typeof pj[k] === "object" && !Array.isArray(pj[k]) ? pj[k] : {};
        });
        pj.conjuros = Array.isArray(pj.conjuros) ? pj.conjuros : [];
        return pj;
    }

    const numPj = (v) => {
        const n = parseInt(v, 10);
        return isNaN(n) ? null : n;
    };
    const modDe = (n) => Math.floor((n - 10) / 2);
    const signo = (n) => (n >= 0 ? "+" : "−") + Math.abs(n);
    const competenciaPj = (pj) => 2 + Math.floor((Math.max(1, numPj(pj.nivel) || 1) - 1) / 4);
    function bonoHabPj(pj, nombre) {
        const h = HABILIDADES_PJ.find((x) => x[0] === nombre);
        const c = h ? numPj(pj[h[1]]) : null;
        if (c === null) {
            return null;
        }
        return modDe(c) + competenciaPj(pj) * ((pj.habilidades || {})[nombre] || 0);
    }
    // Las pasivas: 10 + su bono (o lo que se apuntara a mano antes).
    function pasivaPj(pj, clave) {
        const nombre = { per: "Percepción", inv: "Investigación", persp: "Perspicacia" }[clave];
        const b = bonoHabPj(pj, nombre);
        return b === null ? numPj(pj[clave]) : 10 + b;
    }
    const dadoPj = (n, que) => (window.ocDadoBoton ? window.ocDadoBoton(signo(n), "1d20" + (n >= 0 ? "+" : "") + n, que)
        : document.createTextNode(signo(n)));

    function nuevoPj(datos) {
        const pj = normalizarPj(Object.assign({ nombre: "Personaje nuevo", nivel: 1, fue: 10, des: 10, con: 10, int: 10, sab: 10,
            car: 10 }, datos || {}));
        todo.pjs = todo.pjs || [];
        todo.pjs.push(pj);
        guardar();
        avisarPjs("");
        return pj;
    }

    // ---- LOS PX Y SUBIR DE NIVEL. Los PX que hacen falta para cada nivel
    // (2 a 20). Al repartir, se avisa de quién puede subir; al subir, se
    // apuntan los rasgos de clase del SRD de ese nivel. ----
    const PX_NIVEL = [300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000,
        225000, 265000, 305000, 355000];
    const pxParaSubir = (pj) => PX_NIVEL[Math.min(19, Math.max(1, numPj(pj.nivel) || 1)) - 1];
    const puedeSubir = (pj) => (numPj(pj.nivel) || 1) < 20 && (numPj(pj.px) || 0) >= pxParaSubir(pj);
    // Los rasgos de clase del SRD de un nivel (los de su clase y, si la
    // tiene, su subclase).
    function rasgosDeNivel(lista, clase, nivel) {
        const cl = llano(clase || "");
        const base = cl.split(/[ (/]+/)[0];
        return lista.filter((r) => {
            if (r.tipo !== "rasgo de clase" || r.nivel !== nivel || /^subclase de /i.test(r.nombre)) {
                return false;
            }
            const m = /^(.*?)(?: \((.*)\))?$/.exec(r.de || "") || [];
            return base && llano(m[1] || "") === base && (!m[2] || cl.includes(llano(m[2])));
        });
    }
    function subirNivel(pj) {
        const nuevo = Math.min(20, (numPj(pj.nivel) || 1) + 1);
        pj.nivel = nuevo;
        return pedir(RASGOS_SRD).catch(() => ({ rasgos: [] })).then((datos) => {
            const nuevos = rasgosDeNivel(datos.rasgos || [], pj.clase, nuevo).filter((r) => !llano(pj.rasgos || "")
                .includes("**" + llano(r.nombre) + "**"));
            if (nuevos.length) {
                pj.rasgos = (String(pj.rasgos || "").replace(/\s+$/, "") + "\n" + nuevos.map((r) => "- **" + r.nombre + "** (" + r.de
                    + ", nivel " + nuevo + ")").join("\n")).trim();
            }
            guardar();
            avisarPjs("");
            return nuevos;
        });
    }
    // Repartir PX entre la party (a partes iguales, o a los elegidos).
    function darPx(total, ids, vuelta) {
        const pjs = (todo.pjs || []).filter((pj) => !ids || ids.includes(pj.id));
        if (!pjs.length || !(total > 0)) {
            return;
        }
        const cada = Math.floor(total / pjs.length);
        pjs.forEach((pj) => {
            pj.px = (numPj(pj.px) || 0) + cada;
        });
        guardar();
        avisarPjs("");
        const suben = pjs.filter(puedeSubir);
        avisar(cada.toLocaleString("es-ES") + " PX para cada uno (" + pjs.length + ")." + (suben.length ? " Pueden subir de nivel: "
            + suben.map((pj) => pj.nombre).join(", ") + "." : ""));
        if (suben.length && vuelta) {
            verSubidas(suben, vuelta);
        }
    }
    function verSubidas(suben, vuelta) {
        const cuerpo = crear("div", "master-subidas");
        cuerpo.appendChild(crear("p", "", "Tienen PX para subir de nivel:"));
        const ul = crear("ul", "master-subidas-lista");
        suben.forEach((pj) => {
            const li = crear("li");
            const que = crear("span", "", (pj.nombre || "Sin nombre") + ": nivel " + (numPj(pj.nivel) || 1) + " → "
                + ((numPj(pj.nivel) || 1) + 1) + " ");
            const b = botonDe("oc-vida-accion es-principal", "⬆ subir", () => {
                b.disabled = true;
                subirNivel(pj).then((nuevos) => {
                    que.textContent = (pj.nombre || "Sin nombre") + ": ya es nivel " + pj.nivel + ". ";
                    b.remove();
                    li.appendChild(crear("span", "oc-hoja-nota", nuevos.length ? "Rasgos nuevos: " + nuevos.map((r) => r.nombre).join(", ")
                        + ". Súbele los PG máximos a mano (✎ editar ficha)." : "Súbele los PG máximos a mano (✎ editar ficha)."));
                    avisar((pj.nombre || "") + " sube a nivel " + pj.nivel + ".");
                    li.tabIndex = -1;
                    li.focus();
                });
            }, "Subir a " + (pj.nombre || "este personaje") + " a nivel " + ((numPj(pj.nivel) || 1) + 1));
            li.append(que, b);
            ul.appendChild(li);
        });
        cuerpo.appendChild(ul);
        window.ocVentana.abrir({ titulo: "subir de nivel", cuerpo, vuelta });
    }

    // LA FOTO de un personaje: la suya (guardada en este dispositivo) o,
    // si sólo se trajo su enlace, la de la web (con conexión).
    function fotoPj(pj, clase, alt) {
        if (!pj.foto && !pj.fotoUrl) {
            return null;
        }
        const img = crear("img", clase);
        img.alt = alt || "";
        img.decoding = "async";
        img.addEventListener("error", () => img.remove());
        if (pj.foto) {
            imagenMusica(pj.foto).then((u) => {
                if (u) {
                    img.src = u;
                } else {
                    img.remove();
                }
            });
        } else {
            img.src = pj.fotoUrl;
        }
        return img;
    }
    // La foto que traen D&D Beyond, Nivel20 o Foundry: se guarda con el
    // personaje (con el programa, que puede pedirla; o si viene dentro).
    function guardarFotoImportada(nuevo) {
        const u = String(nuevo.fotoUrl || "");
        let blob = null;
        if (/^data:image\/(png|jpe?g|webp|gif);base64,/.test(u)) {
            try {
                const [cab, datos] = u.split(",");
                const bin = atob(datos);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) {
                    bytes[i] = bin.charCodeAt(i);
                }
                blob = Promise.resolve(new Blob([bytes], { type: cab.slice(5, cab.indexOf(";")) }));
            } catch (e) {
                blob = null;
            }
        } else if (/^https:\/\//.test(u) && EN_CARPETA) {
            blob = fetch("__imagen?url=" + encodeURIComponent(u), { cache: "no-store" }).then((r) => (r.ok ? r.blob() : null));
        }
        if (!/^https:\/\//.test(u)) {
            delete nuevo.fotoUrl;
        }
        if (!blob) {
            return Promise.resolve();
        }
        return blob.then((b) => {
            if (!b || !/^image\//.test(b.type) || b.size > 10 * 1024 * 1024) {
                return null;
            }
            const id = idDoc("f");
            return archivoGuardar(id, b).then(() => {
                nuevo.foto = id;
                delete nuevo.fotoUrl;
            });
        }).catch(() => null);
    }

    function montarPj(dentro, m) {
        m.datos = m.datos || {};
        const pj = (todo.pjs || []).find((x) => x.id === m.datos.pj);
        if (!pj) {
            dentro.appendChild(crear("p", "oc-vacio", "Este personaje ya no está en la party de esta campaña."));
            return;
        }
        normalizarPj(pj);
        const repintar = () => {
            dentro.replaceChildren();
            montarPj(dentro, m);
        };
        mientrasEste(dentro, "master:pjs", (e) => {
            if (!(e.detail && e.detail.desde === m.id) && !dentro.querySelector(".master-creador-form")) {
                repintar();
            }
        });
        if (m.datos.editar) {
            delete m.datos.editar;
            guardar();
            editarPj(dentro, m, pj, repintar);
            return;
        }
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        Promise.all([pedir(CONJUROS_SRD), pedir(TIENDA).catch(() => ({ objetos: [] }))]).then(([conj, tienda]) => {
            const srd = {};
            (conj.conjuros || []).forEach((c) => {
                srd[llano(c.nombre)] = c;
            });
            const objetosSrd = {};
            (tienda.objetos || []).forEach((o) => {
                objetosSrd[llano(o.nombre)] = o;
            });
            const apuntes = pj.apuntes;
            const uid = "master-pj-" + m.id;
            const quien = pj.nombre || "PJ";
            const car = (k) => numPj(pj[k]);
            const prof = competenciaPj(pj);
            let espera = 0;
            const cambiado = () => {
                guardar();
                avisarPjs(m.id);
            };
            const area = (obj, clave, texto, filas, alCambiar) => {
                const caja = crear("div", "master-campo");
                const et = crear("label", "oc-dados-etiqueta", texto);
                const t = crear("textarea", "oc-notas-texto es-corta");
                t.id = uid + "-" + clave;
                et.htmlFor = t.id;
                t.rows = filas || 4;
                t.value = obj[clave] || "";
                t.addEventListener("input", () => {
                    obj[clave] = t.value;
                    clearTimeout(espera);
                    espera = setTimeout(guardar, 400);
                    if (alCambiar) {
                        alCambiar();
                    }
                });
                caja.append(et, t);
                return caja;
            };
            const titulo = (panel, texto) => panel.appendChild(crear("h3", "master-pj-titulo", texto));
            const listaDe = (cosas, etiqueta) => {
                const ul = crear("ul", "master-pj-lista");
                if (etiqueta) {
                    ul.setAttribute("aria-label", etiqueta);
                }
                cosas.forEach((x) => {
                    const li = crear("li");
                    li.append(...[].concat(x));
                    ul.appendChild(li);
                });
                return ul;
            };
            const datosDe = (filas) => {
                const dl = crear("dl", "master-pj-datos");
                filas.filter(([, v]) => v !== null && v !== undefined && v !== "").forEach(([k, v]) => {
                    const dd = crear("dd");
                    dd.append(...[].concat(typeof v === "string" || typeof v === "number" ? String(v) : v));
                    dl.append(crear("dt", "", k), dd);
                });
                return dl;
            };
            const texto = (t) => {
                const x = markdown(t || "");
                if (window.ocDadosEnTexto) {
                    window.ocDadosEnTexto(x);
                }
                enlazarConjuros(x);
                return x;
            };

            // CABECERA: quién es, sus botones y lo que no hay que olvidar.
            const cabeza = crear("div", "master-pj-cabeza");
            const foto = fotoPj(pj, "master-pj-foto", "");
            if (foto) {
                const verFoto = botonDe("master-pj-foto-boton", "", () => {
                    const grande = fotoPj(pj, "master-pj-foto-grande", "Retrato de " + quien);
                    window.ocVentana.abrir({ titulo: quien, cuerpo: grande, vuelta: verFoto });
                }, "Ver la foto de " + quien);
                verFoto.appendChild(foto);
                cabeza.appendChild(verFoto);
            }
            const queEs = [pj.raza, pj.clase, numPj(pj.nivel) ? "nivel " + numPj(pj.nivel) : "", pj.trasfondoNombre, pj.alineamiento]
                .filter(Boolean).join(" · ");
            cabeza.appendChild(crear("p", "master-pj-que", queEs || "Sin raza ni clase todavía: pulsa «✎ editar ficha»."));
            const botones = crear("div", "master-creador-barra");
            const editarB = botonDe("oc-vida-accion es-principal", "✎ editar ficha", () => editarPj(dentro, m, pj, repintar),
                "Editar la ficha de " + quien);
            const ddb = botonDe("oc-vida-accion", "📥 actualizar", () => abrirImportarPj(ddb, pj),
                "Actualizar a " + quien + " desde D&D Beyond, Nivel20 o Foundry VTT");
            ddb.setAttribute("aria-haspopup", "dialog");
            const ini = botonDe("oc-vida-accion", "＋ iniciativa", () => {
                const n = meterEnIniciativa(iniDePj(pj, quien));
                avisar(n ? "A la iniciativa: " + n + "." : quien + " ya está en la iniciativa.");
            }, "Poner a " + quien + " en la iniciativa (tira su iniciativa)");
            botones.append(editarB, ddb, ini);
            cabeza.appendChild(botones);
            const recordar = crear("p", "master-pj-recordar");
            const pintarRecordar = () => {
                recordar.replaceChildren(crear("strong", "", "😨 Miedos: "), document.createTextNode(apuntes.miedos || ""));
                recordar.hidden = !(apuntes.miedos || "").trim();
            };
            pintarRecordar();
            cabeza.appendChild(recordar);

            // 1. FICHA: lo de combate, las características (con su
            // salvación), las habilidades y las pasivas.
            const panelFicha = crear("div");
            const pgCaja = crear("span", "master-pj-pg");
            const pgInput = crear("input", "master-party-input");
            pgInput.type = "number";
            pgInput.inputMode = "numeric";
            pgInput.value = numPj(pj.pg) === null ? (numPj(pj.pgmax) === null ? "" : numPj(pj.pgmax)) : numPj(pj.pg);
            pgInput.setAttribute("aria-label", "Puntos de golpe actuales de " + quien);
            pgInput.addEventListener("change", () => {
                pj.pg = numPj(pgInput.value);
                cambiado();
            });
            pgCaja.append(pgInput, document.createTextNode(numPj(pj.pgmax) !== null ? " / " + numPj(pj.pgmax) : ""));
            const d = car("des");
            panelFicha.appendChild(datosDe([["CA", pj.ca], ["PG", pgCaja], ["PG temporales", numPj(pj.pgtemp) || ""],
                ["Iniciativa", d !== null ? dadoPj(modDe(d), "Iniciativa de " + quien) : ""], ["Velocidad", pj.velocidad],
                ["Competencia", signo(prof)], ["Dados de golpe", pj.dadosGolpe]]));
            const cars = crear("ul", "master-pj-caracteristicas");
            cars.setAttribute("aria-label", "Características y salvaciones de " + quien);
            SALVACIONES_PJ.forEach((k) => {
                const n = car(k);
                if (n === null) {
                    return;
                }
                const comp = pj.salvaciones.includes(k);
                const li = crear("li", "master-pj-c" + (comp ? " es-competente" : ""));
                li.append(crear("span", "master-party-et", NOMBRES_CAR[k]), crear("span", "master-party-valor", String(n)),
                    dadoPj(modDe(n), NOMBRES_CAR[k] + " de " + quien));
                const s = crear("span", "master-pj-salv");
                s.append(crear("span", "", (comp ? "● " : "○ ") + "salvación "), dadoPj(modDe(n) + (comp ? prof : 0),
                    "Salvación de " + NOMBRES_CAR[k] + " de " + quien));
                if (comp) {
                    s.title = "Competente en la salvación";
                }
                li.appendChild(s);
                cars.appendChild(li);
            });
            panelFicha.appendChild(cars);
            titulo(panelFicha, "🎯 Habilidades");
            panelFicha.appendChild(listaDe(HABILIDADES_PJ.filter(([, k]) => car(k) !== null).map(([nombre, k]) => {
                const nv = pj.habilidades[nombre] || 0;
                return [crear("span", "master-pj-marca-comp", nv === 2 ? "◆" : nv === 1 ? "●" : "○"),
                    crear("span", "", nombre + " (" + k.toUpperCase() + ")" + (nv ? " · " + NIVELES_COMP[nv] : "")),
                    dadoPj(bonoHabPj(pj, nombre), nombre + " de " + quien)];
            }), "Habilidades de " + quien));
            panelFicha.appendChild(datosDe([["👁️ Percepción pasiva", pasivaPj(pj, "per")], ["🔍 Investigación pasiva",
                pasivaPj(pj, "inv")], ["💭 Perspicacia pasiva", pasivaPj(pj, "persp")], ["Sentidos", pj.sentidos],
                ["Defensas", pj.defensas]]));

            // 2. COMBATE: los ataques (bono y daño, con sus dados) y las
            // acciones.
            const panelCombate = crear("div");
            if (pj.ataques.length) {
                const tabla = crear("table", "master-informe-tabla master-pj-ataques");
                tabla.appendChild(crear("caption", "visually-hidden", "Ataques de " + quien));
                const cab = crear("tr");
                ["Ataque", "Bono", "Daño"].forEach((t) => {
                    const th = crear("th", "", t);
                    th.scope = "col";
                    cab.appendChild(th);
                });
                const thead = crear("thead");
                thead.appendChild(cab);
                const tbody = crear("tbody");
                pj.ataques.forEach((a) => {
                    const tr = crear("tr");
                    const th = crear("th", "", a.nombre || "—");
                    th.scope = "row";
                    const b = numPj(String(a.bono || "").replace("−", "-"));
                    const tdB = crear("td");
                    tdB.appendChild(b === null ? document.createTextNode(a.bono || "") : dadoPj(b, a.nombre + " · ataque"));
                    const tdD = crear("td");
                    const dm = /^(\d+d\d+(?:\s*[+−-]\s*\d+)?)\s*(.*)$/.exec(String(a.dano || "").trim());
                    if (dm && window.ocDadoBoton) {
                        tdD.append(window.ocDadoBoton(dm[1], dm[1].replace(/\s+/g, "").replace("−", "-"), a.nombre + " · daño"),
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
                panelCombate.appendChild(crear("p", "oc-vacio", "Sin ataques apuntados (se ponen en «✎ editar ficha»)."));
            }
            if (pj.acciones.length) {
                titulo(panelCombate, "🌀 Acciones");
                panelCombate.appendChild(listaDe(pj.acciones.map((a) => a), "Acciones de " + quien));
            }
            if ((pj.armasTxt || "").trim()) {
                panelCombate.appendChild(area(pj, "armasTxt", "apuntes de armas (de antes)", 3));
            }

            // 3. CONJUROS: aptitud, CD y ataque; los espacios (casillas que
            // se gastan) y la lista por nivel; cada uno se abre.
            const panelConj = crear("div");
            const aptitud = pj.aptitud;
            if (aptitud && car(aptitud) !== null) {
                const bono = modDe(car(aptitud)) + prof;
                panelConj.appendChild(datosDe([["Aptitud", NOMBRES_CAR[aptitud] || aptitud], ["CD de salvación", 8 + bono],
                    ["Ataque de conjuro", dadoPj(bono, "Ataque de conjuro de " + quien)]]));
            }
            const niveles = Object.keys(pj.espacios).filter((n) => (numPj(pj.espacios[n].max) || 0) > 0).sort((a, b) => a - b);
            if (niveles.length) {
                titulo(panelConj, "🔮 Espacios de conjuro");
                const ul = crear("ul", "master-pj-espacios");
                ul.setAttribute("aria-label", "Espacios de conjuro de " + quien);
                niveles.forEach((n) => {
                    const e = pj.espacios[n];
                    const li = crear("li");
                    const grupo = crear("span", "master-pj-casillas");
                    grupo.setAttribute("role", "group");
                    grupo.setAttribute("aria-label", "Nivel " + n);
                    for (let i = 0; i < numPj(e.max); i++) {
                        const c = crear("input");
                        c.type = "checkbox";
                        c.checked = i < (numPj(e.usados) || 0);
                        c.setAttribute("aria-label", "Espacio " + (i + 1) + " de nivel " + n + (c.checked ? ", gastado" : ""));
                        c.addEventListener("change", () => {
                            e.usados = Array.from(grupo.querySelectorAll("input")).filter((x) => x.checked).length;
                            c.setAttribute("aria-label", "Espacio " + (i + 1) + " de nivel " + n + (c.checked ? ", gastado" : ""));
                            guardar();
                        });
                        grupo.appendChild(c);
                    }
                    li.append(crear("span", "master-pj-marca", "nivel " + n), grupo);
                    ul.appendChild(li);
                });
                const descanso = botonDe("oc-vida-accion", "↺ descanso largo", () => {
                    niveles.forEach((n) => {
                        pj.espacios[n].usados = 0;
                    });
                    guardar();
                    ul.querySelectorAll("input").forEach((c) => {
                        c.checked = false;
                    });
                    avisar("Espacios de conjuro recuperados.");
                }, "Recuperar todos los espacios de conjuro de " + quien);
                panelConj.append(ul, descanso);
            }
            const listaConj = crear("div");
            const nuevoConj = crear("input", "oc-dados-texto");
            const pintarConj = () => {
                listaConj.replaceChildren();
                const todos = conjurosPj(pj, srd);
                if (!todos.length) {
                    listaConj.appendChild(crear("p", "oc-vacio", "No tiene conjuros apuntados."));
                }
                const nvs = Array.from(new Set(todos.map((c) => c.nivel))).sort((a, b) => (a === null) - (b === null) || a - b);
                nvs.forEach((n) => {
                    titulo(listaConj, n === null ? "Otros" : n === 0 ? "Trucos" : "Nivel " + n);
                    listaConj.appendChild(listaDe(todos.filter((c) => c.nivel === n).map((c) => [conjuroPj(c.nombre, srd, conj.fuente),
                        botonDe("master-party-quitar", "✕", () => {
                            pj.conjuros = pj.conjuros.filter((x) => x !== c.nombre);
                            guardar();
                            pintarConj();
                            avisar("Quitado: " + c.nombre + ".");
                            nuevoConj.focus();
                        }, "Quitar " + c.nombre)]), (n === null ? "Otros conjuros" : n === 0 ? "Trucos" : "Conjuros de nivel " + n)
                        + " de " + quien));
                });
            };
            const form = crear("form", "master-pj-anadir");
            const et = crear("label", "oc-dados-etiqueta", "añadir un conjuro (los del SRD y los tuyos salen solos)");
            nuevoConj.id = uid + "-conj";
            et.htmlFor = nuevoConj.id;
            nuevoConj.autocomplete = "off";
            const dl = crear("datalist");
            dl.id = uid + "-conj-lista";
            (conj.conjuros || []).forEach((c) => {
                const o = crear("option");
                o.value = c.nombre;
                dl.appendChild(o);
            });
            nuevoConj.setAttribute("list", dl.id);
            const anadirB = crear("button", "oc-vida-accion", "＋ añadir");
            anadirB.type = "submit";
            form.append(et, nuevoConj, dl, anadirB);
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                const v = nuevoConj.value.trim();
                if (!v) {
                    return;
                }
                const c = srd[llano(v)];
                pj.conjuros = pj.conjuros.concat(c ? c.nombre : v);
                nuevoConj.value = "";
                guardar();
                pintarConj();
                avisar("Añadido: " + (c ? c.nombre : v) + ".");
            });
            panelConj.append(form, listaConj);
            pintarConj();

            // 4. INVENTARIO: lo suyo (lo del SRD se abre) y su dinero; cada
            // cosa se puede pasar al inventario común de la party.
            const panelInv = crear("div");
            const listaInv = crear("ul", "master-pj-lista");
            listaInv.setAttribute("aria-label", "Inventario de " + quien);
            const pintarInv = () => {
                listaInv.replaceChildren(...pj.objetos.map((o, i) => {
                    const li = crear("li");
                    const srdO = objetosSrd[llano(o.nombre)];
                    const nombre = srdO ? botonDe("master-conjuro-boton", o.nombre, () => abrirObjeto(srdO, li.firstChild, tienda.fuente))
                        : crear("span", "", o.nombre);
                    li.append(nombre, crear("span", "master-pj-marca", "×" + (numPj(o.cant) || 1) + (o.equipado ? " · equipado" : "")));
                    li.appendChild(botonDe("master-party-quitar", "→ party", () => {
                        const inv = inventarioParty();
                        const ya = inv.objetos.find((x) => llano(x.nombre) === llano(o.nombre));
                        if (ya) {
                            ya.cant = (numPj(ya.cant) || 1) + (numPj(o.cant) || 1);
                        } else {
                            inv.objetos.push({ id: nuevoIdPj(), nombre: o.nombre, cant: numPj(o.cant) || 1 });
                        }
                        pj.objetos.splice(i, 1);
                        guardar();
                        avisarPjs("");
                        avisar(o.nombre + ": al inventario de la party.");
                    }, "Pasar " + o.nombre + " al inventario común de la party"));
                    return li;
                }));
                if (!pj.objetos.length) {
                    listaInv.appendChild(crear("li", "oc-vacio", "Sin objetos apuntados (se ponen en «✎ editar ficha»)."));
                }
            };
            pintarInv();
            const monedas = MONEDAS_PJ.filter(([k]) => numPj(pj.dinero[k])).map(([k, abr]) => numPj(pj.dinero[k]) + " " + abr);
            panelInv.append(listaInv, datosDe([["💰 Dinero", monedas.join(", ") || "nada"]]));
            if ((pj.objetosTxt || "").trim()) {
                panelInv.appendChild(area(pj, "objetosTxt", "apuntes de objetos (de antes)", 3));
            }

            // 5. RASGOS: rasgos y dotes, competencias e idiomas.
            const panelRasgos = crear("div");
            const exportarR = botonDe("oc-vida-accion", "⬇ exportar rasgos (.json)", () => {
                pedir(RASGOS_SRD).catch(() => ({ rasgos: [] })).then((datos) => {
                    const pista = (pj.clase || "") + " " + (pj.raza || "");
                    const lineas = String(pj.rasgos || "").split("\n").map((l) => l.trim()).filter(Boolean);
                    const rasgos = lineas.map((l) => {
                        const m2 = /^[-*•]?\s*(?:\*\*(.+?)\*\*|([^(]+?))\s*(?:\((.*)\))?\s*$/.exec(l) || [];
                        const nombre = (m2[1] || m2[2] || l).trim();
                        const r = rasgoDe(datos.rasgos || [], nombre, pista);
                        const o = { nombre, de: (m2[3] || "").trim() };
                        if (r) {
                            Object.assign(o, { tipo: r.tipo, en: r.en, texto: r.texto, fuente: r.propio ? fuenteDe(r) : "SRD 5.2 (CC BY 4.0)" });
                        }
                        return o;
                    });
                    bajarJson({ personaje: pj.nombreCompleto || pj.nombre, clase: pj.clase || "", especie: pj.raza || "",
                        nivel: numPj(pj.nivel), rasgos, competencias: pj.competencias || "", idiomas: pj.idiomas || "" },
                    "rasgos-" + llano(pj.nombre || "pj").replace(/[^a-z0-9]+/g, "-") + ".json");
                    avisar("Bajados los rasgos de " + quien + " (" + rasgos.length + ").");
                });
            }, "Bajar los rasgos y dotes de " + quien + " a un archivo .json");
            const barraR = crear("div", "master-creador-barra");
            barraR.appendChild(exportarR);
            if ((pj.rasgos || "").trim()) {
                const tr = texto(pj.rasgos);
                enlazarRasgos(tr, (pj.clase || "") + " " + (pj.raza || ""));
                panelRasgos.append(crear("p", "oc-hoja-nota", "Pulsa un rasgo para leerlo (los del SRD y los tuyos)."), tr, barraR);
            } else {
                panelRasgos.appendChild(crear("p", "oc-vacio", "Sin rasgos apuntados."));
            }
            panelRasgos.appendChild(datosDe([["Competencias", pj.competencias], ["Idiomas", pj.idiomas]]));

            // 6. HISTORIA: cómo es y de dónde viene (se escribe aquí mismo).
            const panelHist = crear("div");
            panelHist.append(area(pj, "aspecto", "aspecto (cómo es)", 3), area(pj, "personalidad", "personalidad", 2),
                area(pj, "ideales", "ideales", 2), area(pj, "vinculos", "vínculos", 2), area(pj, "defectos", "defectos", 2),
                area(pj, "historia", "su historia", 8));
            if ((pj.trasfondo || "").trim()) {
                panelHist.appendChild(area(pj, "trasfondo", "trasfondo (de antes)", 3));
            }

            // 7. PNJ Y NOTAS: la gente que conoce y lo que apunta el jugador.
            const panelPnj = crear("div");
            const listaPnj = crear("ul", "master-pj-pnjs");
            listaPnj.setAttribute("aria-label", "PNJ que conoce " + quien);
            const formPnj = crear("form", "master-pj-anadir");
            const pnjNombre = crear("input", "oc-dados-texto");
            const pnjRel = crear("input", "oc-dados-texto");
            const pintarPnj = () => {
                listaPnj.replaceChildren(...pj.pnjs.map((p, i) => {
                    const li = crear("li");
                    const cab2 = crear("p", "master-pj-pnj");
                    cab2.append(crear("strong", "", p.nombre), document.createTextNode(p.relacion ? " · " + p.relacion : ""));
                    const nota = crear("textarea", "oc-notas-texto es-corta");
                    nota.rows = 2;
                    nota.value = p.nota || "";
                    nota.setAttribute("aria-label", "Nota sobre " + p.nombre);
                    nota.addEventListener("input", () => {
                        p.nota = nota.value;
                        clearTimeout(espera);
                        espera = setTimeout(guardar, 400);
                    });
                    const q = botonDe("master-party-quitar", "✕", () => {
                        pj.pnjs.splice(i, 1);
                        guardar();
                        pintarPnj();
                        pnjNombre.focus();
                        avisar("Quitado: " + p.nombre + ".");
                    }, "Quitar a " + p.nombre);
                    cab2.appendChild(q);
                    li.append(cab2, nota);
                    return li;
                }));
            };
            [[pnjNombre, "nombre del PNJ"], [pnjRel, "quién es para él (amigo, rival, deudor…)"]].forEach(([x, t], i) => {
                x.id = uid + "-pnj" + i;
                x.autocomplete = "off";
                const e2 = crear("label", "oc-dados-etiqueta", t);
                e2.htmlFor = x.id;
                formPnj.append(e2, x);
            });
            const pnjB = crear("button", "oc-vida-accion", "＋ PNJ");
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
                guardar();
                pintarPnj();
                pnjNombre.focus();
            });
            pintarPnj();
            titulo(panelPnj, "👥 PNJ que conoce");
            panelPnj.append(listaPnj, formPnj);
            titulo(panelPnj, "📝 Notas");
            panelPnj.appendChild(area(pj, "notas", "notas del personaje (misiones, pistas, lo que recuerda…)", 6));

            // 8. MÁSTER: lo que sólo ve el máster.
            const panelMaster = crear("div");
            panelMaster.append(area(apuntes, "miedos", "miedos (salen arriba, en todas las pestañas)", 2, pintarRecordar),
                area(apuntes, "secretos", "secretos (sólo para el máster)", 3), area(apuntes, "ganchos", "ganchos para la historia", 3),
                area(apuntes, "relaciones", "relaciones (con otros PJ, facciones…)", 3), area(apuntes, "deudas",
                    "deudas, promesas y rencores", 2), area(apuntes, "notas", "otras notas", 3));

            const paneles = [["📋 ficha", panelFicha], ["⚔️ combate", panelCombate], ["✨ conjuros", panelConj],
                ["🎒 inventario", panelInv], ["⭐ rasgos", panelRasgos], ["📜 historia", panelHist], ["👥 PNJ y notas", panelPnj],
                ["🎭 máster", panelMaster]];
            const { lista, elegir } = pestanasDe(paneles, "Ficha de " + quien, uid, (i) => {
                m.datos.pestana = i;
                guardar();
            });
            dentro.replaceChildren(cabeza, lista, ...paneles.map(([, x]) => x));
            elegir(Math.min(m.datos.pestana || 0, paneles.length - 1), false);
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar su ficha."));
        });
    }

    // EL FORMULARIO DE LA FICHA: todo lo que no se escribe en las
    // pestañas (los números, las competencias, los ataques, los objetos,
    // los conjuros…). Al guardar, la ficha (y la party) se repintan.
    function editarPj(dentro, m, pj, alTerminar) {
        const uid = "master-pjf-" + m.id;
        const form = crear("form", "master-creador-form");
        // Por pestañas, como la ficha: cada grupo va a la suya.
        const pF = crear("div");
        const pC = crear("div");
        const pM = crear("div");
        const pI = crear("div");
        const pR = crear("div");
        let destino = pF;
        let n = 0;
        function campo(caja, etiqueta, valor, op) {
            const o = op || {};
            n += 1;
            const id = uid + "-c" + n;
            const et = crear("label", "oc-dados-etiqueta", etiqueta);
            et.htmlFor = id;
            let x;
            if (o.opciones) {
                x = crear("select", "master-elegir");
                o.opciones.forEach(([v, t]) => {
                    const op2 = crear("option", "", t);
                    op2.value = v;
                    x.appendChild(op2);
                });
                x.value = valor === undefined || valor === null ? "" : String(valor);
            } else if (o.filas) {
                x = crear("textarea", "oc-dados-texto master-creador-area");
                x.rows = o.filas;
                x.value = valor || "";
            } else {
                x = crear("input", "oc-dados-texto");
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
            const div = crear("div", "master-creador-campo" + (o.ancho ? " es-ancho" : ""));
            div.append(et, x);
            caja.appendChild(div);
            return x;
        }
        function grupo(titulo) {
            const fs = crear("fieldset", "master-creador-grupo");
            fs.appendChild(crear("legend", "", titulo));
            const rejilla = crear("div", "master-creador-rejilla");
            fs.appendChild(rejilla);
            destino.appendChild(fs);
            return rejilla;
        }
        // Filas repetibles (ataques, objetos): cada una con sus campos y ✕.
        function filasDe(titulo, lista, campos, nueva) {
            const fs = crear("fieldset", "master-creador-grupo");
            fs.appendChild(crear("legend", "", titulo));
            const ol = crear("ol", "master-creador-entradas");
            const filas = [];
            const fila = (x, foco) => {
                const li = crear("li", "master-pjf-fila");
                const ins = campos.map(([clave, et, op]) => {
                    if (op && op.casilla) {
                        const lab = crear("label", "master-creador-check");
                        const c = crear("input");
                        c.type = "checkbox";
                        c.checked = !!x[clave];
                        lab.append(c, " " + et);
                        li.appendChild(lab);
                        return [clave, c];
                    }
                    return [clave, campo(li, et, x[clave], op)];
                });
                const reg = { li, ins };
                const q = botonDe("master-docs-mando", "✕", () => {
                    filas.splice(filas.indexOf(reg), 1);
                    li.remove();
                    mas.focus();
                }, "Quitar esta fila de " + titulo.toLowerCase());
                li.appendChild(q);
                filas.push(reg);
                ol.appendChild(li);
                if (foco) {
                    ins[0][1].focus();
                }
            };
            lista.forEach((x) => fila(x));
            const mas = botonDe("oc-vida-accion", "＋ añadir", () => fila(nueva(), true), "Añadir a " + titulo.toLowerCase());
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
        const fsFoto = crear("fieldset", "master-creador-grupo master-pjf-foto");
        fsFoto.appendChild(crear("legend", "", "Foto"));
        const vistaFoto = crear("div", "master-pjf-foto-vista");
        let fotoNueva = null;
        let sinFoto = false;
        let urlNueva = "";
        const pintarFoto = () => {
            vistaFoto.replaceChildren();
            if (fotoNueva) {
                const img = crear("img", "master-pj-foto");
                img.alt = "La foto nueva";
                img.src = urlNueva;
                vistaFoto.appendChild(img);
            } else if (!sinFoto && (pj.foto || pj.fotoUrl)) {
                vistaFoto.appendChild(fotoPj(pj, "master-pj-foto", "La foto de ahora"));
            } else {
                vistaFoto.appendChild(crear("p", "oc-hoja-nota", "Sin foto."));
            }
            quitarFoto.hidden = !(fotoNueva || (!sinFoto && (pj.foto || pj.fotoUrl)));
        };
        const subirFoto = crear("input");
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
                avisar("Tiene que ser una imagen de hasta 10 MB.");
                return;
            }
            if (urlNueva) {
                URL.revokeObjectURL(urlNueva);
            }
            fotoNueva = f;
            urlNueva = URL.createObjectURL(f);
            sinFoto = false;
            pintarFoto();
            avisar("Foto elegida: se guarda al pulsar «✓ guardar».");
        });
        const elegirFoto = botonDe("oc-vida-accion", "📷 elegir foto", () => subirFoto.click(), "Elegir una foto de " + (pj.nombre
            || "este personaje") + " (de tu dispositivo)");
        const quitarFoto = botonDe("oc-vida-accion", "✕ quitar", () => {
            fotoNueva = null;
            sinFoto = true;
            pintarFoto();
            elegirFoto.focus();
        }, "Quitar la foto");
        const botonesFoto = crear("div", "master-creador-barra");
        botonesFoto.append(elegirFoto, quitarFoto);
        fsFoto.append(vistaFoto, botonesFoto, subirFoto);
        pintarFoto();
        pF.appendChild(fsFoto);
        const b = grupo("Quién es");
        const nombre = campo(b, "nombre", pj.nombre);
        const completo = campo(b, "nombre completo", pj.nombreCompleto, { ayuda: "opcional" });
        const jugador = campo(b, "jugador", pj.jugador, { ayuda: "quién lo lleva" });
        const raza = campo(b, "especie", pj.raza);
        const clase = campo(b, "clase (y subclase)", pj.clase);
        const nivel = campo(b, "nivel", pj.nivel, { tipo: "number", min: 1, max: 20 });
        const fondo = campo(b, "trasfondo", pj.trasfondoNombre);
        const alin = campo(b, "alineamiento", pj.alineamiento);
        const pxC = campo(b, "PX (experiencia)", pj.px, { tipo: "number", min: 0 });
        destino = pC;
        const c = grupo("Combate");
        const ca = campo(c, "CA", pj.ca);
        const pgmax = campo(c, "PG máximos", pj.pgmax, { tipo: "number" });
        const pg = campo(c, "PG actuales", pj.pg, { tipo: "number" });
        const pgtemp = campo(c, "PG temporales", pj.pgtemp, { tipo: "number" });
        const vel = campo(c, "velocidad", pj.velocidad, { ayuda: "30 pies" });
        const dg = campo(c, "dados de golpe", pj.dadosGolpe, { ayuda: "3d8" });
        destino = pF;
        const cs = grupo("Características");
        const cars = {};
        SALVACIONES_PJ.forEach((k) => {
            cars[k] = campo(cs, NOMBRES_CAR[k], pj[k], { tipo: "number", min: 1, max: 30 });
        });
        const fsS = crear("fieldset", "master-creador-grupo");
        fsS.appendChild(crear("legend", "", "Salvaciones con competencia"));
        const cajaS = crear("div", "master-creador-casillas");
        const salv = SALVACIONES_PJ.map((k) => {
            const lab = crear("label", "master-creador-check");
            const x = crear("input");
            x.type = "checkbox";
            x.checked = pj.salvaciones.includes(k);
            lab.append(x, " " + NOMBRES_CAR[k]);
            cajaS.appendChild(lab);
            return [k, x];
        });
        fsS.appendChild(cajaS);
        pF.appendChild(fsS);
        const hs = grupo("Habilidades");
        destino = pC;
        const habs = HABILIDADES_PJ.map(([nom, k]) => [nom, campo(hs, nom + " (" + k.toUpperCase() + ")", pj.habilidades[nom] || 0,
            { opciones: [["0", "—"], ["1", "competente"], ["2", "pericia"]] })]);
        const leerAtaques = filasDe("Ataques", pj.ataques, [["nombre", "arma o ataque"], ["bono", "bono", { ayuda: "+5" }],
            ["dano", "daño", { ayuda: "1d8+3 cortante" }]], () => ({ nombre: "", bono: "", dano: "" }));
        const acc = campo(grupo("Acciones especiales"), "una por línea", pj.acciones.join("\n"), { filas: 3, ancho: true,
            ayuda: "Acción adicional: Forma salvaje (2 usos, descanso corto)" });
        destino = pM;
        const mg = grupo("Magia");
        const apt = campo(mg, "aptitud mágica", pj.aptitud || "", { opciones: [["", "ninguna"]].concat(SALVACIONES_PJ.map((k) =>
            [k, NOMBRES_CAR[k]])) });
        const espacios = {};
        for (let i = 1; i <= 9; i++) {
            espacios[i] = campo(mg, "espacios de nivel " + i, (pj.espacios[i] || {}).max || "", { tipo: "number", max: 9 });
        }
        const conjs = campo(grupo("Conjuros"), "uno por línea (los del SRD se enlazan solos)", pj.conjuros.join("\n"),
            { filas: 6, ancho: true });
        destino = pI;
        const leerObjetos = filasDe("Inventario", pj.objetos, [["nombre", "objeto"], ["cant", "cantidad", { tipo: "number" }],
            ["equipado", "equipado", { casilla: true }]], () => ({ nombre: "", cant: 1, equipado: false }));
        const din = grupo("Dinero");
        const monedas = {};
        MONEDAS_PJ.forEach(([k, abr, nom]) => {
            monedas[k] = campo(din, nom + " (" + abr + ")", pj.dinero[k] || "", { tipo: "number", max: 9999999 });
        });
        destino = pR;
        const ot = grupo("Rasgos y competencias");
        const rasgos = campo(ot, "rasgos y dotes", pj.rasgos, { filas: 6, ancho: true,
            ayuda: "- **Visión en la oscuridad** (especie)\n- **Ataque furtivo** (Pícaro, nivel 1)" });
        // Añadirlos del SRD (o de los tuyos): uno a uno, o todos los de su
        // clase (hasta su nivel) y su especie.
        const cajaSrd = crear("div", "master-pjf-srd");
        const etSrd = crear("label", "oc-dados-etiqueta", "añadir uno del SRD o de los tuyos");
        const buscaSrd = crear("input", "oc-dados-texto");
        buscaSrd.id = uid + "-srd";
        buscaSrd.setAttribute("list", uid + "-srd-lista");
        buscaSrd.autocomplete = "off";
        buscaSrd.placeholder = "Furia, Alerta, Linaje feérico…";
        etSrd.htmlFor = buscaSrd.id;
        const listaSrd = crear("datalist");
        listaSrd.id = uid + "-srd-lista";
        let todosRasgos = [];
        pedir(RASGOS_SRD).then((datos) => {
            todosRasgos = (datos.rasgos || []).filter((r) => r.tipo !== "habilidad");
            const vistos = new Set();
            listaSrd.replaceChildren(...todosRasgos.filter((r) => {
                const k = r.nombre + "|" + r.de;
                const ya = vistos.has(k);
                vistos.add(k);
                return !ya;
            }).map((r) => {
                const o = crear("option");
                o.value = r.nombre + (r.de && r.de !== "dote" ? " — " + r.de : "");
                return o;
            }));
        }).catch(() => null);
        const lineaDe = (r) => "- **" + r.nombre + "** (" + (r.tipo === "rasgo de clase" ? r.de + (r.nivel ? ", nivel " + r.nivel : "")
            : r.tipo === "rasgo de especie" ? (r.de.split(/,\s*/).find((d) => llano(raza.value).includes(llano(d))) || r.de.split(",")[0])
                : r.tipo) + ")";
        const yaEsta = (r) => String(rasgos.value).split("\n").some((l) => llano(l).includes("**" + llano(r.nombre) + "**"));
        const poner = (lista) => {
            const nuevas = lista.filter((r) => !yaEsta(r)).map(lineaDe);
            if (nuevas.length) {
                rasgos.value = (rasgos.value.trim() ? rasgos.value.replace(/\s+$/, "") + "\n" : "") + nuevas.join("\n");
            }
            return nuevas.length;
        };
        const anadirUno = botonDe("oc-vida-accion", "＋ añadir", () => {
            const [n, de] = buscaSrd.value.split(" — ");
            const r = todosRasgos.find((x) => llano(x.nombre) === llano(n || "") && (!de || x.de === de.trim()))
                || rasgoDe(todosRasgos, n || "", clase.value + " " + raza.value);
            if (!r) {
                avisar("No encuentro «" + buscaSrd.value + "» entre los rasgos y dotes.");
                buscaSrd.focus();
                return;
            }
            avisar(poner([r]) ? "Añadido: " + r.nombre + "." : r.nombre + " ya estaba.");
            buscaSrd.value = "";
            buscaSrd.focus();
        }, "Añadir a la lista de rasgos el que has escrito");
        buscaSrd.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                anadirUno.click();
            }
        });
        const deSuClase = botonDe("oc-vida-accion", "＋ los de su clase y especie", () => {
            const cl = llano(clase.value);
            const base = cl.split(/[ (/]+/)[0];
            const nv = Number(nivel.value) || 1;
            const es = llano(raza.value);
            const vistos = new Set();
            const elegidos = todosRasgos.filter((r) => {
                if (r.tipo === "rasgo de clase") {
                    const m = /^(.*?)(?: \((.*)\))?$/.exec(r.de || "") || [];
                    return base && llano(m[1] || "") === base && (r.nivel || 0) <= nv && (!m[2] || cl.includes(llano(m[2])))
                        && !/^subclase de /i.test(r.nombre);
                }
                if (r.tipo === "rasgo de especie") {
                    const k = llano(r.nombre.replace(/\s*\(.*$/, ""));
                    const ok = es && !/:/.test(r.nombre) && llano(r.de || "").split(/,\s*/).some((d) => d && es.includes(d)) && !vistos.has(k);
                    if (ok) {
                        vistos.add(k);
                    }
                    return ok;
                }
                return false;
            }).sort((a, b) => (a.tipo === b.tipo ? (a.nivel || 0) - (b.nivel || 0) : a.tipo === "rasgo de especie" ? -1 : 1));
            if (!elegidos.length) {
                avisar("No encuentro rasgos del SRD para «" + (clase.value || "sin clase") + "» y «" + (raza.value || "sin especie")
                    + "». Mira la clase y la especie (en 📋 ficha).");
                return;
            }
            const n = poner(elegidos);
            avisar(n ? "Añadidos " + n + " rasgos (repásalos: los de elegir una opción, como el linaje, van todos)." : "Ya estaban todos.");
        }, "Añadir los rasgos del SRD de su clase (hasta su nivel) y de su especie");
        const filaSrd = crear("div", "master-creador-barra");
        filaSrd.append(anadirUno, deSuClase);
        cajaSrd.append(etSrd, buscaSrd, listaSrd, filaSrd);
        ot.appendChild(cajaSrd);
        const comp = campo(ot, "competencias (armas, armaduras, herramientas)", pj.competencias, { ancho: true });
        const idiomas = campo(ot, "idiomas", pj.idiomas, { ancho: true });
        const sentidos = campo(ot, "sentidos", pj.sentidos, { ancho: true, ayuda: "Visión en la oscuridad 60 pies" });
        const defensas = campo(ot, "resistencias e inmunidades", pj.defensas, { ancho: true });
        const final = crear("div", "master-creador-barra master-creador-final");
        const ok = crear("button", "oc-vida-accion es-principal", "✓ guardar");
        ok.type = "submit";
        const no = botonDe("oc-vida-accion", "cancelar", () => alTerminar());
        final.append(ok, no);
        const paneles = [["📋 ficha", pF], ["⚔️ combate", pC], ["✨ conjuros", pM], ["🎒 inventario", pI], ["⭐ rasgos", pR]];
        const { lista: pestanas, elegir } = pestanasDe(paneles, "Editar la ficha de " + (pj.nombre || "personaje"), uid + "-tab",
            (i) => {
                m.datos.pestana = i;
            });
        form.append(crear("h3", "master-creador-titulo", "✎ " + (pj.nombre || "personaje")), pestanas, ...paneles.map(([, x]) => x),
            final);
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            ok.disabled = true;
            const idFoto = fotoNueva ? idDoc("f") : "";
            (fotoNueva ? archivoGuardar(idFoto, fotoNueva) : Promise.resolve()).then(() => {
                if (fotoNueva || sinFoto) {
                    if (pj.foto) {
                        archivoBorrar(pj.foto);
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
                avisar("No se ha podido guardar la foto (¿no queda sitio?).");
            });
        });
        function guardarFicha() {
            pj.nombre = nombre.value.trim() || pj.nombre || "Sin nombre";
            pj.nombreCompleto = completo.value.trim();
            pj.jugador = jugador.value.trim();
            pj.raza = raza.value.trim();
            pj.clase = clase.value.trim();
            pj.nivel = numPj(nivel.value);
            pj.trasfondoNombre = fondo.value.trim();
            pj.alineamiento = alin.value.trim();
            pj.px = numPj(pxC.value) || 0;
            pj.ca = ca.value.trim();
            pj.pgmax = numPj(pgmax.value);
            pj.pg = numPj(pg.value) === null ? pj.pgmax : numPj(pg.value);
            pj.pgtemp = numPj(pgtemp.value);
            pj.velocidad = vel.value.trim();
            pj.dadosGolpe = dg.value.trim();
            SALVACIONES_PJ.forEach((k) => {
                pj[k] = numPj(cars[k].value);
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
                const max = numPj(espacios[i].value);
                if (max) {
                    pj.espacios[i] = { max, usados: Math.min(max, numPj((antes[i] || {}).usados) || 0) };
                }
            }
            pj.conjuros = conjs.value.split("\n").map((s) => s.trim()).filter(Boolean);
            pj.objetos = leerObjetos().filter((o) => o.nombre).map((o) => ({ nombre: o.nombre, cant: numPj(o.cant) || 1,
                equipado: !!o.equipado }));
            pj.dinero = {};
            MONEDAS_PJ.forEach(([k]) => {
                if (numPj(monedas[k].value)) {
                    pj.dinero[k] = numPj(monedas[k].value);
                }
            });
            pj.rasgos = rasgos.value;
            pj.competencias = comp.value.trim();
            pj.idiomas = idiomas.value.trim();
            pj.sentidos = sentidos.value.trim();
            pj.defensas = defensas.value.trim();
            m.titulo = pj.nombre;
            ponerTitulo(m);
            guardar();
            avisarPjs(m.id);
            avisar("Ficha guardada: " + pj.nombre + ".");
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

    // ---- DE D&D BEYOND: el personaje (su JSON) a una ficha de aquí. Lo
    // suyo (números, competencias, conjuros, objetos, dinero, historia) y
    // los rasgos y conjuros POR SU NOMBRE (no se traen los textos de los
    // libros). Los nombres, al español con datos/personajes/dnd-es.json y
    // los del SRD. Es la misma cuenta que el editor del blog
    // (herramientas/1-publicar/editor/dndbeyond.py). ----
    const CAR_DDB = { strength: "fue", dexterity: "des", constitution: "con", intelligence: "int", wisdom: "sab", charisma: "car" };
    const CAR_NUM = { 1: "fue", 2: "des", 3: "con", 4: "int", 5: "sab", 6: "car" };
    const ALIN_DDB = { 1: "Legal bueno", 2: "Neutral bueno", 3: "Caótico bueno", 4: "Legal neutral", 5: "Neutral", 6: "Caótico neutral",
        7: "Legal malvado", 8: "Neutral malvado", 9: "Caótico malvado" };
    const ACCION_DDB = { 1: "Acción", 3: "Acción adicional", 4: "Reacción", 6: "Minutos", 7: "Horas", 8: "Especial" };
    const RECARGA_DDB = { 1: "descanso corto", 2: "descanso largo", 3: "al amanecer", 4: "otra" };
    const SOBRAN_DDB = ["ability score increase", "ability score increases", "ability score improvement", "age", "size", "speed", "languages",
        "proficiencies", "hit points", "alignment", "creature type", "equipment"];
    const HAB_DDB_A_PJ = { Arcanos: "Conocimiento arcano" };

    function traductorDdb() {
        return Promise.all([pedir("datos/personajes/dnd-es.json").catch(() => ({})), pedir(CONJUROS_SRD).catch(() => ({})),
            pedir(TIENDA).catch(() => ({}))]).then(([es, conj, tienda]) => {
            const clave = (t) => String(t || "").trim().toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ");
            const tabla = {};
            [(es.terminos || {}), (es.conjuros || {})].forEach((o) => Object.keys(o).forEach((k) => {
                tabla[clave(k)] = o[k];
            }));
            (conj.conjuros || []).forEach((c) => {
                if (c.en && !c.propio) {
                    tabla[clave(c.en)] = c.nombre;
                }
            });
            (tienda.objetos || []).forEach((o) => {
                if (o.en && !o.propio) {
                    tabla[clave(o.en)] = o.nombre;
                }
            });
            const sin = [];
            const t = (x) => {
                const s = String(x || "").trim();
                if (!s) {
                    return "";
                }
                const h = tabla[clave(s)];
                if (h) {
                    return h;
                }
                const coma = s.split(",");
                if (coma.length > 1 && tabla[clave(coma[0])] && /^\s*\+\d+\s*$/.test(coma.slice(1).join(","))) {
                    return tabla[clave(coma[0])] + "," + coma.slice(1).join(",");
                }
                if (!sin.includes(s)) {
                    sin.push(s);
                }
                return s;
            };
            t.sin = sin;
            t.habilidades = es.habilidades || {};
            return t;
        });
    }

    function deDdb(crudo, t) {
        const d = crudo && crudo.data && crudo.data.stats ? crudo.data : crudo;
        if (!d || !Array.isArray(d.stats)) {
            throw new Error("Eso no parece la ficha de un personaje de D&D Beyond.");
        }
        const avisos = [];
        const inventario = Array.isArray(d.inventory) ? d.inventory : [];
        const puestos = new Set(inventario.filter((i) => i.equipped && (!(i.definition || {}).canAttune || i.isAttuned))
            .map((i) => (i.definition || {}).id));
        const cuentan = [];
        Object.keys(d.modifiers || {}).forEach((origen) => (d.modifiers[origen] || []).forEach((mm) => {
            if (mm && (origen !== "item" || puestos.has(mm.componentId))) {
                cuentan.push(mm);
            }
        }));
        // Características (con lo que suman raza, dotes, objetos…).
        const base = {};
        (d.stats || []).forEach((s) => {
            base[s.id] = s.value || 10;
        });
        (d.bonusStats || []).forEach((s) => {
            base[s.id] = (base[s.id] || 10) + (s.value || 0);
        });
        const minimo = {};
        cuentan.forEach((mm) => {
            const sub = String(mm.subType || "");
            const k = sub.endsWith("-score") ? CAR_DDB[sub.slice(0, -6)] : null;
            const i = k ? Number(Object.keys(CAR_NUM).find((n) => CAR_NUM[n] === k)) : null;
            if (!i) {
                return;
            }
            if (mm.type === "bonus") {
                base[i] = (base[i] || 10) + (mm.value || 0);
            } else if (mm.type === "set") {
                minimo[i] = Math.max(minimo[i] || 0, mm.value || 0);
            }
        });
        (d.overrideStats || []).forEach((s) => {
            if (s.value) {
                base[s.id] = s.value;
            }
        });
        const pj = {};
        Object.keys(CAR_NUM).forEach((i) => {
            pj[CAR_NUM[i]] = Math.max(base[i] || 10, minimo[i] || 0);
        });
        const mods = {};
        Object.keys(CAR_NUM).forEach((i) => {
            mods[CAR_NUM[i]] = modDe(pj[CAR_NUM[i]]);
        });
        const clases = (d.classes || []).filter(Boolean);
        const nivel = clases.reduce((s, c) => s + (Number(c.level) || 0), 0) || 1;
        const comp = 2 + Math.floor((Math.min(nivel, 20) - 1) / 4);
        pj.nombreCompleto = String(d.name || "").trim();
        pj.nombre = pj.nombreCompleto.split(" ")[0] || "Sin nombre";
        const raza = (d.race || {}).fullName || (d.race || {}).baseName || "";
        pj.raza = t(raza);
        pj.clase = clases.map((c) => {
            const sub = (c.subclassDefinition || {}).name;
            return t((c.definition || {}).name) + (sub ? " (" + t(sub) + ")" : "") + (clases.length > 1 ? " " + (c.level || 0) : "");
        }).join(" / ");
        pj.nivel = nivel;
        // Puntos de golpe.
        let pg = d.overrideHitPoints;
        if (!pg) {
            pg = (d.baseHitPoints || 0) + (d.bonusHitPoints || 0) + mods.con * nivel;
            cuentan.forEach((mm) => {
                if (mm.type === "bonus" && mm.subType === "hit-points-per-level") {
                    pg += (mm.value || 0) * nivel;
                } else if (mm.type === "bonus" && mm.subType === "hit-points") {
                    pg += mm.value || 0;
                }
            });
        }
        pj.pgmax = pg;
        pj.pg = Math.max(0, pg - (d.removedHitPoints || 0));
        pj.pgtemp = d.temporaryHitPoints || null;
        // CA: armadura y escudo puestos, y lo que sumen los objetos.
        let armadura = null;
        let escudo = 0;
        inventario.forEach((i) => {
            const df = i.definition || {};
            if (!i.equipped || !df.armorClass) {
                return;
            }
            if (df.armorTypeId === 4) {
                escudo += df.armorClass;
            } else if ([1, 2, 3].includes(df.armorTypeId)) {
                armadura = df;
            }
        });
        let ca = armadura ? armadura.armorClass + { 1: mods.des, 2: Math.min(2, mods.des), 3: 0 }[armadura.armorTypeId] : 10 + mods.des;
        ca += escudo + cuentan.filter((mm) => mm.type === "bonus" && mm.subType === "armor-class").reduce((s, mm) => s + (mm.value || 0), 0);
        pj.ca = String(ca);
        if (!armadura && clases.some((c) => /barbarian|monk/i.test((c.definition || {}).name || ""))) {
            avisos.push("La CA puede ser otra: «Defensa sin armadura» no la cuento. Repásala.");
        }
        let pies = ((((d.race || {}).weightSpeeds || {}).normal || {}).walk) || 30;
        cuentan.forEach((mm) => {
            if (mm.type === "set" && mm.subType === "innate-speed-walking" && mm.value) {
                pies = Math.max(pies, mm.value);
            }
        });
        cuentan.forEach((mm) => {
            if (mm.type === "bonus" && mm.subType === "speed" && mm.value) {
                pies += mm.value;
            }
        });
        pj.velocidad = pies + " pies";
        pj.dadosGolpe = clases.filter((c) => (c.definition || {}).hitDice).map((c) => (c.level || 0) + "d" + c.definition.hitDice).join(" + ");
        // Competencias.
        pj.salvaciones = [];
        pj.habilidades = {};
        const idiomas = [];
        const otras = [];
        cuentan.forEach((mm) => {
            const sub = String(mm.subType || "");
            const nombre = mm.friendlySubtypeName || sub.replace(/-/g, " ");
            if (mm.type === "proficiency" && sub.endsWith("-saving-throws")) {
                const k = CAR_DDB[sub.slice(0, -"-saving-throws".length)];
                if (k && !pj.salvaciones.includes(k)) {
                    pj.salvaciones.push(k);
                }
            } else if ((mm.type === "proficiency" || mm.type === "expertise") && t.habilidades[sub]) {
                const h = HAB_DDB_A_PJ[t.habilidades[sub]] || t.habilidades[sub];
                pj.habilidades[h] = Math.max(pj.habilidades[h] || 0, mm.type === "expertise" ? 2 : 1);
            } else if (mm.type === "language") {
                const x = t(nombre);
                if (!idiomas.includes(x)) {
                    idiomas.push(x);
                }
            } else if (mm.type === "proficiency" && sub !== "self" && !sub.endsWith("saving-throws")) {
                const x = t(nombre);
                if (!otras.includes(x)) {
                    otras.push(x);
                }
            }
        });
        pj.idiomas = idiomas.join(", ");
        pj.competencias = otras.join(", ");
        // Magia.
        const lanza = clases.find((c) => (c.definition || {}).canCastSpells);
        pj.espacios = {};
        if (lanza) {
            pj.aptitud = CAR_NUM[(lanza.definition || {}).spellCastingAbilityId] || "";
            const tabla = (((lanza.definition || {}).spellRules || {}).levelSpellSlots) || [];
            const nc = Number(lanza.level) || 0;
            if (clases.length === 1 && tabla[nc]) {
                tabla[nc].forEach((x, i) => {
                    if (x) {
                        pj.espacios[i + 1] = { max: x, usados: 0 };
                    }
                });
            } else if (clases.length > 1) {
                avisos.push("Lleva varias clases: los espacios de conjuro los tienes que poner tú.");
            }
            (d.spellSlots || []).forEach((s) => {
                if (pj.espacios[s.level] && s.used) {
                    pj.espacios[s.level].usados = Math.min(s.used, pj.espacios[s.level].max);
                }
            });
        }
        const vistos = new Set();
        const conjuros = [];
        const todosC = [].concat(...(d.classSpells || []).map((cs) => cs.spells || []), ...Object.values(d.spells || {}).map((l) => l || []));
        todosC.forEach((s) => {
            const df = (s || {}).definition || {};
            if (df.name && !vistos.has(df.name)) {
                vistos.add(df.name);
                conjuros.push([Number(df.level) || 0, t(df.name)]);
            }
        });
        pj.conjuros = conjuros.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1], "es")).map((x) => x[1]);
        // Ataques: las armas puestas.
        pj.ataques = inventario.filter((i) => i.equipped && ((i.definition || {}).damage || {}).diceString).map((i) => {
            const df = i.definition;
            const props = (df.properties || []).map((p) => String(p.name || "").toLowerCase());
            let c = df.attackType === 2 ? mods.des : mods.fue;
            if (props.includes("finesse")) {
                c = Math.max(mods.fue, mods.des);
            }
            return { nombre: t(df.name), bono: signo(comp + c), dano: df.damage.diceString + (c ? signo(c).replace("−", "-") : "") + " "
                + t(df.damageType || "").toLowerCase() };
        });
        pj.objetos = inventario.filter((i) => (i.definition || {}).name).map((i) => ({ nombre: t(i.definition.name),
            cant: Number(i.quantity) || 1, equipado: !!i.equipped }));
        const mon = d.currencies || {};
        pj.dinero = {};
        [["cp", "pc"], ["sp", "pp"], ["ep", "pe"], ["gp", "po"], ["pp", "pt"]].forEach(([en, es]) => {
            if (mon[en]) {
                pj.dinero[es] = mon[en];
            }
        });
        // Rasgos y dotes, por su nombre.
        const rasgos = [];
        (((d.race || {}).racialTraits) || []).forEach((r) => {
            const nm = ((r || {}).definition || {}).name;
            if (nm && !SOBRAN_DDB.includes(nm.toLowerCase())) {
                rasgos.push("- **" + t(nm) + "** (especie)");
            }
        });
        clases.forEach((c) => (c.classFeatures || []).forEach((f) => {
            const df = (f || {}).definition || {};
            if (df.name && (Number(df.requiredLevel) || 1) <= (Number(c.level) || 0) && !SOBRAN_DDB.includes(df.name.toLowerCase())
                && df.name !== "TBD" && !/^core .* traits$| subclass$|ability score improvement/i.test(df.name)) {
                rasgos.push("- **" + t(df.name) + "** (" + t((c.definition || {}).name) + ", nivel " + (df.requiredLevel || 1) + ")");
            }
        }));
        (d.feats || []).forEach((f) => {
            const nm = ((f || {}).definition || {}).name;
            if (nm) {
                rasgos.push("- **" + t(nm) + "** (dote)");
            }
        });
        pj.rasgos = Array.from(new Set(rasgos)).join("\n");
        // Acciones con usos.
        pj.acciones = [];
        Object.values(d.actions || {}).forEach((l) => (l || []).forEach((a) => {
            const nm = String((a || {}).name || "").trim();
            if (!nm) {
                return;
            }
            const usos = (a.limitedUse || {}).maxUses;
            const rec = RECARGA_DDB[(a.limitedUse || {}).resetType] || "";
            const x = (ACCION_DDB[(a.activation || {}).activationType] || "Otras") + ": " + t(nm)
                + (usos ? " (" + usos + (usos === 1 ? " uso" : " usos") + (rec ? ", " + rec : "") + ")" : "");
            if (!pj.acciones.includes(x)) {
                pj.acciones.push(x);
            }
        }));
        // Sentidos y defensas.
        const SENT = { darkvision: "Visión en la oscuridad", blindsight: "Vista ciega", tremorsense: "Sentido de la vibración",
            truesight: "Visión verdadera" };
        const DEF = { resistance: "Resistencia", immunity: "Inmunidad", vulnerability: "Vulnerabilidad" };
        const sentidos = [];
        const defensas = {};
        cuentan.forEach((mm) => {
            const sub = String(mm.subType || "");
            if ((mm.type === "set-base" || mm.type === "sense") && SENT[sub] && mm.value) {
                const x = SENT[sub] + " " + mm.value + " pies";
                if (!sentidos.includes(x)) {
                    sentidos.push(x);
                }
            } else if (DEF[mm.type]) {
                const x = t(sub.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())).toLowerCase();
                defensas[DEF[mm.type]] = defensas[DEF[mm.type]] || [];
                if (!defensas[DEF[mm.type]].includes(x)) {
                    defensas[DEF[mm.type]].push(x);
                }
            }
        });
        pj.sentidos = sentidos.join(", ");
        pj.defensas = Object.keys(defensas).map((k) => k + ": " + defensas[k].join(", ")).join("; ");
        // Trasfondo, cómo es e historia (lo escrito a mano, tal cual).
        const fondo = ((d.background || {}).definition || {}).name;
        pj.trasfondoNombre = fondo ? t(fondo) : "";
        pj.alineamiento = ALIN_DDB[d.alignmentId] || "";
        const aspecto = [["Edad", d.age], ["Altura", d.height], ["Peso", d.weight], ["Ojos", d.eyes], ["Pelo", d.hair], ["Piel", d.skin]]
            .filter(([, v]) => v).map(([k, v]) => k + ": " + v);
        pj.aspecto = aspecto.join(" · ");
        const tr = d.traits || {};
        pj.personalidad = String(tr.personalityTraits || "").trim();
        pj.ideales = String(tr.ideals || "").trim();
        pj.vinculos = String(tr.bonds || "").trim();
        pj.defectos = String(tr.flaws || "").trim();
        pj.historia = String((d.notes || {}).backstory || "").trim();
        pj.fotoUrl = String(((d.decorations || {}).avatarUrl) || d.avatarUrl || "");
        pj.dndbeyond = d.readonlyUrl || (d.id ? "https://www.dndbeyond.com/characters/" + d.id : "");
        if (t.sin.length) {
            avisos.push("Sin traducir (cámbialo a mano si quieres): " + t.sin.slice(0, 30).join("; ") + (t.sin.length > 30 ? "…" : ""));
        }
        return { pj, avisos };
    }

    // NIVEL20: su página de personaje (el HTML, ya en español). Se leen
    // los números, competencias, ataques, objetos, conjuros y los rasgos
    // por su nombre; sus textos de reglas no.
    const CAR_N20 = { fue: "fue", des: "des", con: "con", int: "int", sab: "sab", car: "car" };
    function deNivel20(doc, url) {
        const txt = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
        const num = (x) => {
            const m = /[-−+]?\d+/.exec(String(x || "").replace("−", "-"));
            return m ? parseInt(m[0].replace("−", "-"), 10) : null;
        };
        const desc = doc.querySelector(".character-desc");
        const info = doc.querySelector("#panel-info");
        if (!desc || !info) {
            throw new Error("Eso no parece la página de un personaje de Nivel20.");
        }
        const avisos = [];
        const pj = {};
        const filas = desc.querySelectorAll(".col-12");
        pj.nombreCompleto = txt(desc.querySelector("h4")) || "Sin nombre";
        pj.nombre = pj.nombreCompleto.split(" ")[0];
        const razaEl = desc.querySelector("a[href*='field=race']");
        pj.raza = txt(razaEl);
        let claseTxt = "";
        if (filas[1]) {
            claseTxt = txt(filas[1]).replace(pj.raza, "").trim();
        }
        pj.nivel = num(txt(filas[2])) || 1;
        // Características y los números de arriba.
        info.querySelectorAll(".ability-box.with-value").forEach((b) => {
            const k = llano(txt(b.querySelector(".name"))).slice(0, 3);
            if (CAR_N20[k]) {
                pj[CAR_N20[k]] = num(txt(b.querySelector(".value"))) || 10;
            }
        });
        info.querySelectorAll(".ability-box:not(.with-value)").forEach((b) => {
            const nombre = llano(txt(b.querySelector(".name")));
            const v = b.querySelector(".modifier");
            if (nombre.startsWith("puntos")) {
                pj.pgmax = num(txt(v));
                pj.pg = pj.pgmax;
            } else if (nombre.startsWith("clase de")) {
                pj.ca = String(num(txt(v)) || "");
            } else if (nombre.startsWith("velocidad")) {
                const d = v && v.querySelector("[data-value]");
                pj.velocidad = (d ? parseFloat(d.getAttribute("data-value")) : num(txt(v))) + " pies";
            }
        });
        const comp = 2 + Math.floor((Math.min(pj.nivel, 20) - 1) / 4);
        const modDeCar = (k) => modDe(pj[k] || 10);
        // Salvaciones: las que llevan el círculo relleno (o, si no, las que suman la competencia).
        pj.salvaciones = [];
        info.querySelectorAll("a[href*='category=saving_throws']").forEach((a) => {
            const k = (/field=(\w+)/.exec(a.getAttribute("href")) || [])[1];
            if (!CAR_N20[k]) {
                return;
            }
            const icono = a.querySelector(".proficiency-icon");
            const total = num(txt(a.closest(".table-row") && a.closest(".table-row").querySelector(".numeric-val")));
            const si = icono ? /\bfa-circle\b/.test(icono.className) && !/fa-circle-o/.test(icono.className)
                : total !== null && total - modDeCar(k) >= comp;
            if (si) {
                pj.salvaciones.push(k);
            }
        });
        // Habilidades: competente o pericia, según lo que suman.
        pj.habilidades = {};
        info.querySelectorAll("a[href*='category=skills']").forEach((a) => {
            const nombre = txt(a.querySelector(".table-cell")).replace(/\s*\(.*\)\s*$/, "");
            const h = HABILIDADES_PJ.find(([n, , clave]) => llano(n) === llano(nombre) || (clave && llano(nombre).startsWith(clave))
                || llano(n).slice(0, 5) === llano(nombre).slice(0, 5));
            const total = num(txt(a.querySelector(".numeric-val")));
            if (!h || total === null) {
                return;
            }
            const veces = Math.round((total - modDeCar(h[1])) / comp);
            if (veces >= 1) {
                pj.habilidades[h[0]] = Math.min(2, veces);
            }
        });
        // Otras competencias e idiomas.
        const otras = [];
        info.querySelectorAll(".card-body li").forEach((li) => {
            txt(li).split(/,\s*| y /).map((s) => s.trim()).filter(Boolean).forEach((s) => {
                if (!otras.includes(s)) {
                    otras.push(s);
                }
            });
        });
        pj.competencias = otras.join(", ");
        // Ataques: la tabla de la primera pestaña.
        pj.ataques = [];
        info.querySelectorAll("table tbody tr").forEach((tr) => {
            const td = tr.querySelectorAll("td");
            if (td.length >= 3 && txt(td[0])) {
                pj.ataques.push({ nombre: txt(td[0]), bono: txt(td[1]).replace("-", "−"), dano: txt(td[2]).replace(/\s*\+\s*/g, "+")
                    .replace(/(\d)\s+([A-Za-zÁÉÍÓÚáéíóúñ])/, "$1 $2").toLowerCase() });
            }
        });
        // Trasfondo y alineamiento.
        const fondo = doc.querySelector("#panel-background");
        if (fondo) {
            fondo.querySelectorAll("h4").forEach((h) => {
                const m = /^Trasfondo:\s*(.+)$/.exec(txt(h));
                if (m) {
                    pj.trasfondoNombre = m[1];
                }
            });
            fondo.querySelectorAll("p").forEach((p) => {
                const s = p.querySelector("strong");
                if (s && /^Alineamiento$/i.test(txt(s))) {
                    pj.alineamiento = txt(p).replace(txt(s), "").replace(/^[\s.:]+/, "");
                }
            });
        }
        // Rasgos, por su nombre y de dónde vienen; la subclase, a la clase.
        const rasgos = [];
        let subclase = "";
        const feats = doc.querySelector("#panel-feats");
        if (feats) {
            // En orden: cada cabecera (especie, clase, subclase) y sus rasgos.
            let origen = "rasgo";
            feats.querySelectorAll("h3, h4:not(.card-title), .font-weight-bold.ellipsize").forEach((e) => {
                if (/^H[34]$/.test(e.tagName)) {
                    origen = txt(e.querySelector("a")) || txt(e) || origen;
                    if (e.tagName === "H4" && !subclase) {
                        subclase = origen;
                    }
                    return;
                }
                rasgos.push("- **" + txt(e) + "** (" + origen + ")");
            });
        }
        pj.rasgos = Array.from(new Set(rasgos)).join("\n");
        pj.clase = claseTxt.replace(/\s+\d+\s*$/, "") + (subclase ? " (" + subclase + ")" : "");
        if (/\//.test(claseTxt)) {
            pj.clase = claseTxt;
            avisos.push("Lleva varias clases: repasa los espacios de conjuro.");
        }
        // Objetos: los equipados y los demás.
        pj.objetos = [];
        const items = doc.querySelector("#panel-items");
        if (items) {
            items.querySelectorAll(".accordion-wrapper").forEach((w) => {
                const lista = w.querySelector("#collapse_items, .collapse-child");
                if (!lista) {
                    return;
                }
                const grupo = llano(txt(w.querySelector(".accordion-title")));
                lista.querySelectorAll(".accordion-wrapper").forEach((o) => {
                    const nombre = txt(o.querySelector(".accordion-title"));
                    if (!nombre) {
                        return;
                    }
                    const cant = /^(.*?)\s*(?:\(|x\s*)(\d+)\)?$/i.exec(nombre);
                    pj.objetos.push({ nombre: cant ? cant[1] : nombre, cant: cant ? Number(cant[2]) : 1, equipado: grupo.startsWith("equipado") });
                });
            });
        }
        // Magia: aptitud, espacios y la lista de conjuros.
        pj.espacios = {};
        pj.conjuros = [];
        const magia = doc.querySelector("#panel-magic");
        if (magia) {
            magia.querySelectorAll(".ability-box").forEach((b) => {
                const n = llano(txt(b.querySelector(".name")));
                if (n.startsWith("caracteristica magica")) {
                    const v = llano(txt(b.querySelector(".modifier")));
                    pj.aptitud = Object.keys(NOMBRES_CAR).find((k) => llano(NOMBRES_CAR[k]) === v) || "";
                } else if (n.startsWith("espacios de conjuro")) {
                    b.querySelectorAll(".row > .col").forEach((c) => {
                        const nv = num(txt(c.querySelector(".name")).replace(/nivel/i, ""));
                        const x = num(txt(c.querySelector(".modifier")));
                        if (nv && x) {
                            pj.espacios[nv] = { max: x, usados: 0 };
                        }
                    });
                }
            });
            const vistos = [];
            magia.querySelectorAll(".spell-row").forEach((r) => {
                const n = txt(r.querySelector("strong"));
                const nivel = /truco/i.test(txt(r.querySelector(".xcol-md-1, .col-3"))) ? 0 : num(txt(r.querySelector(".xcol-md-1, .col-3"))) || 0;
                if (n && !vistos.some((v) => v[1] === n)) {
                    vistos.push([nivel, n]);
                }
            });
            pj.conjuros = vistos.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1], "es")).map((x) => x[1]);
            if (magia.querySelector(".load-more-container button")) {
                avisos.push("Nivel20 enseña los conjuros por partes: si te falta alguno, añádelo a mano.");
            }
        }
        const og = doc.querySelector("meta[property='og:image']");
        const ogUrl = og ? og.getAttribute("content") || "" : "";
        pj.fotoUrl = /^https:\/\//.test(ogUrl) && !/default-portrait/.test(ogUrl) ? ogUrl : "";
        pj.nivel20 = url || "";
        return { pj, avisos };
    }

    // FOUNDRY VTT: el JSON de un actor de dnd5e (clic derecho → exportar).
    // Lo que sale de sus números se calcula; los rasgos y conjuros, por su
    // nombre (traducido si es del SRD).
    const CAR_FVTT = { str: "fue", dex: "des", con: "con", int: "int", wis: "sab", cha: "car" };
    const HAB_FVTT = { acr: "Acrobacias", ani: "Trato con animales", arc: "Conocimiento arcano", ath: "Atletismo", dec: "Engaño",
        his: "Historia", ins: "Perspicacia", itm: "Intimidación", inv: "Investigación", med: "Medicina", nat: "Naturaleza",
        prc: "Percepción", prf: "Interpretación", per: "Persuasión", rel: "Religión", slt: "Juego de manos", ste: "Sigilo",
        sur: "Supervivencia" };
    const IDIOMAS_FVTT = { common: "Común", dwarvish: "Enano", elvish: "Élfico", giant: "Gigante", gnomish: "Gnomo", goblin: "Goblin",
        halfling: "Mediano", orc: "Orco", abyssal: "Abisal", celestial: "Celestial", deep: "Habla profunda", draconic: "Dracónico",
        infernal: "Infernal", primordial: "Primordial", sylvan: "Silvano", undercommon: "Infracomún", druidic: "Druídico",
        cant: "Jerga de ladrones", sign: "Lenguaje de signos común" };
    const COMP_FVTT = { sim: "Armas sencillas", mar: "Armas marciales", lgt: "Armadura ligera", med: "Armadura intermedia",
        hvy: "Armadura pesada", shl: "Escudos" };
    const DANO_FVTT = { acid: "ácido", bludgeoning: "contundente", cold: "frío", fire: "fuego", force: "fuerza", lightning: "relámpago",
        necrotic: "necrótico", piercing: "perforante", poison: "veneno", psychic: "psíquico", radiant: "radiante", slashing: "cortante",
        thunder: "trueno" };
    const ALIN_FVTT = { lg: "Legal bueno", ng: "Neutral bueno", cg: "Caótico bueno", ln: "Legal neutral", tn: "Neutral", n: "Neutral",
        cn: "Caótico neutral", le: "Legal malvado", ne: "Neutral malvado", ce: "Caótico malvado" };
    // Espacios de un lanzador completo por nivel (1–20) y del brujo.
    const ESPACIOS_COMPLETO = [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
        [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
        [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
        [4, 3, 3, 3, 3, 2, 2, 1, 1]];

    // Una cuenta sencilla (+ − × ÷ y paréntesis), sin eval.
    function cuentaSencilla(texto) {
        const tok = String(texto).replace(/\s+/g, "").match(/\d+(?:\.\d+)?|[-+*/()]/g) || [];
        let i = 0;
        const factor = () => {
            const x = tok[i++];
            if (x === "(") {
                const v = suma();
                i++;
                return v;
            }
            if (x === "-") {
                return -factor();
            }
            if (x === "+") {
                return factor();
            }
            const n = parseFloat(x);
            if (isNaN(n)) {
                throw new Error("cuenta");
            }
            return n;
        };
        const producto = () => {
            let v = factor();
            while (tok[i] === "*" || tok[i] === "/") {
                v = tok[i++] === "*" ? v * factor() : v / factor();
            }
            return v;
        };
        const suma = () => {
            let v = producto();
            while (tok[i] === "+" || tok[i] === "-") {
                v = tok[i++] === "+" ? v + producto() : v - producto();
            }
            return v;
        };
        const v = suma();
        return i === tok.length && isFinite(v) ? Math.floor(v) : null;
    }

    function deFoundry(actor, t) {
        const s = actor && actor.system;
        if (!s || !s.abilities || !Array.isArray(actor.items)) {
            throw new Error("Eso no parece un personaje exportado de Foundry VTT.");
        }
        if (actor.type && actor.type !== "character" && actor.type !== "npc") {
            throw new Error("Ese JSON de Foundry no es un personaje.");
        }
        const avisos = [];
        const items = actor.items;
        const de = (tipo) => items.filter((i) => i.type === tipo);
        const sis = (i) => i.system || {};
        const puesto = (i) => sis(i).equipped !== false && (!sis(i).attunement || sis(i).attunement === "optional" || sis(i).attuned
            || sis(i).attunement === 0 || sis(i).attunement === "");
        const pj = {};
        // Características, con los efectos (de objetos puestos) que las cambian.
        Object.keys(CAR_FVTT).forEach((k) => {
            pj[CAR_FVTT[k]] = Number(((s.abilities[k] || {}).value)) || 10;
        });
        let caExtra = 0;
        const efectos = (actor.effects || []).slice();
        items.forEach((i) => (i.effects || []).forEach((e) => {
            if (e.transfer !== false && puesto(i)) {
                efectos.push(e);
            }
        }));
        efectos.filter((e) => !e.disabled).forEach((e) => (e.changes || []).forEach((c) => {
            const m = /^system\.abilities\.(\w+)\.value$/.exec(c.key || "");
            const v = Number(c.value);
            if (m && CAR_FVTT[m[1]] && !isNaN(v)) {
                const k = CAR_FVTT[m[1]];
                pj[k] = { 2: pj[k] + v, 3: Math.min(pj[k], v), 4: Math.max(pj[k], v), 5: v }[c.mode] || pj[k];
            } else if (c.key === "system.attributes.ac.bonus" && !isNaN(v)) {
                caExtra += v;
            }
        }));
        const mods = {};
        Object.keys(CAR_FVTT).forEach((k) => {
            mods[CAR_FVTT[k]] = modDe(pj[CAR_FVTT[k]]);
        });
        // Clases, nivel y subclase.
        const clases = de("class");
        const subclases = de("subclass");
        const nivel = clases.reduce((n, c) => n + (Number(sis(c).levels) || 0), 0) || Number((s.details || {}).level) || 1;
        const comp = 2 + Math.floor((Math.min(nivel, 20) - 1) / 4);
        pj.nombreCompleto = String(actor.name || "").trim() || "Sin nombre";
        pj.nombre = pj.nombreCompleto.split(" ")[0];
        pj.nivel = nivel;
        pj.clase = clases.map((c) => {
            const sub = subclases.find((x) => sis(x).classIdentifier === sis(c).identifier);
            return t(c.name) + (sub ? " (" + t(sub.name) + ")" : "") + (clases.length > 1 ? " " + (sis(c).levels || 0) : "");
        }).join(" / ");
        const raza = de("race")[0];
        pj.raza = raza ? t(raza.name) : t(typeof (s.details || {}).race === "string" && !/^[A-Za-z0-9]{16}$/.test(s.details.race)
            ? s.details.race : "");
        const fondo = de("background")[0];
        pj.trasfondoNombre = fondo ? t(fondo.name) : "";
        // Puntos de golpe: los suyos o, si no hay máximo apuntado, de sus dados.
        const at = s.attributes || {};
        const hp = at.hp || {};
        let pgmax = Number(hp.max) || 0;
        if (!pgmax) {
            clases.forEach((c) => {
                const dado = Number(String((sis(c).hd || {}).denomination || sis(c).hitDice || "d8").replace("d", "")) || 8;
                const av = Object.values(sis(c).advancement || {}).find((a) => a && a.type === "HitPoints");
                const valores = (av && av.value) || {};
                for (let n = 1; n <= (Number(sis(c).levels) || 0); n++) {
                    const v = valores[n];
                    const media = Math.floor(dado / 2) + 1;
                    pgmax += v === "max" ? dado : Number(v) ? Number(v) : v === "avg" ? media : n === 1 && c === clases[0] ? dado : media;
                }
            });
            pgmax += mods.con * nivel + (Number((hp.bonuses || {}).level) || 0) * nivel + (Number((hp.bonuses || {}).overall) || 0);
        }
        pj.pgmax = pgmax || null;
        pj.pg = hp.value !== null && hp.value !== undefined ? Number(hp.value) : pgmax;
        pj.pgtemp = Number(hp.temp) || null;
        pj.dadosGolpe = clases.map((c) => (sis(c).levels || 0) + String((sis(c).hd || {}).denomination || sis(c).hitDice || "")).join(" + ");
        // CA: armadura y escudo puestos, y sus fórmulas; la mejor.
        const ac = at.ac || {};
        const puestos = items.filter((i) => i.type === "equipment" && sis(i).equipped);
        const armadura = puestos.find((i) => ["light", "medium", "heavy"].includes((sis(i).type || {}).value) && (sis(i).armor || {}).value);
        const escudo = puestos.filter((i) => (sis(i).type || {}).value === "shield")
            .reduce((n, i) => n + (Number((sis(i).armor || {}).value) || 0) + (Number((sis(i).armor || {}).magicalBonus) || 0), 0);
        const baseArm = armadura ? (Number(sis(armadura).armor.value) || 0) + (Number(sis(armadura).armor.magicalBonus) || 0) : 10;
        const tope = armadura ? (sis(armadura).armor.dex !== null && sis(armadura).armor.dex !== undefined && sis(armadura).armor.dex !== ""
            ? Number(sis(armadura).armor.dex) : { light: 99, medium: 2, heavy: 0 }[sis(armadura).type.value]) : 99;
        const desCa = Math.min(mods.des, tope);
        let ca;
        if (ac.override || (ac.calc === "flat" && ac.flat)) {
            ca = Number(ac.override || ac.flat);
        } else {
            const opciones = [baseArm + desCa];
            const formulas = (ac.formulas || []).map((f) => f.formula).concat(ac.calc === "custom" && ac.formula ? [ac.formula] : [])
                .concat({ mage: ["13 + @abilities.dex.mod"], unarmoredMonk: ["10 + @abilities.dex.mod + @abilities.wis.mod"],
                    unarmoredBarb: ["10 + @abilities.dex.mod + @abilities.con.mod"], draconic: ["13 + @abilities.dex.mod"],
                    natural: [String(ac.flat || 10)] }[ac.calc] || []);
            formulas.forEach((f) => {
                const x = cuentaSencilla(String(f).replace(/@attributes\.ac\.armor/g, baseArm).replace(/@attributes\.ac\.dex/g, desCa)
                    .replace(/@abilities\.(\w+)\.mod/g, (m, k) => (CAR_FVTT[k] ? mods[CAR_FVTT[k]] : 0)).replace(/@prof/g, comp)
                    .replace(/@attributes\.ac\.shield/g, 0));
                if (x !== null && (!armadura || !/^(mage|unarmored|draconic)/.test(ac.calc || ""))) {
                    opciones.push(x);
                }
            });
            ca = Math.max(...opciones) + escudo;
        }
        pj.ca = String(ca + caExtra);
        // Velocidad y sentidos.
        const mov = at.movement || {};
        const pies = Number(mov.walk) || Number((mov.speeds || {}).walk) || Number(((sis(raza || {}).movement || {}).walk))
            || Number((((sis(raza || {}).movement || {}).speeds || {}).walk)) || 30;
        pj.velocidad = pies + " pies";
        const SENT = { darkvision: "Visión en la oscuridad", blindsight: "Vista ciega", tremorsense: "Sentido de la vibración",
            truesight: "Visión verdadera" };
        const sentidos = [];
        [(at.senses || {}), (at.senses || {}).ranges || {}, (sis(raza || {}).senses || {}), ((sis(raza || {}).senses || {}).ranges || {})]
            .forEach((o) => Object.keys(SENT).forEach((k) => {
                const x = SENT[k] + " " + o[k] + " pies";
                if (Number(o[k]) && !sentidos.some((y) => y.startsWith(SENT[k]))) {
                    sentidos.push(x);
                }
            }));
        pj.sentidos = sentidos.join(", ");
        // Competencias.
        pj.salvaciones = Object.keys(CAR_FVTT).filter((k) => Number((s.abilities[k] || {}).proficient) >= 1).map((k) => CAR_FVTT[k]);
        pj.habilidades = {};
        Object.keys(s.skills || {}).forEach((k) => {
            const v = Math.floor(Number((s.skills[k] || {}).value) || 0);
            if (HAB_FVTT[k] && v >= 1) {
                pj.habilidades[HAB_FVTT[k]] = Math.min(2, v);
            }
        });
        const tr = s.traits || {};
        const lista = (o, mapa) => ((o || {}).value || []).map((x) => (mapa && mapa[x]) || t(x)).concat(String((o || {}).custom || "")
            .split(";").map((x) => x.trim()).filter(Boolean));
        pj.idiomas = lista(tr.languages, IDIOMAS_FVTT).join(", ");
        const otras = lista(tr.armorProf, COMP_FVTT).concat(lista(tr.weaponProf, COMP_FVTT))
            .concat(de("tool").filter((i) => Number(sis(i).proficient) >= 1 || sis(i).proficient === undefined).map((i) => t(i.name)));
        pj.competencias = Array.from(new Set(otras)).join(", ");
        const DEF = [["dr", "Resistencia"], ["di", "Inmunidad"], ["dv", "Vulnerabilidad"], ["ci", "Inmune a"]];
        pj.defensas = DEF.map(([k, n]) => [n, lista(tr[k], DANO_FVTT)]).filter(([, l]) => l.length).map(([n, l]) => n + ": " + l.join(", "))
            .join("; ");
        // Magia: aptitud, espacios (los suyos o los de su clase) y conjuros.
        pj.aptitud = CAR_FVTT[at.spellcasting] || "";
        pj.espacios = {};
        const sp = s.spells || {};
        let nivelLanzador = 0;
        clases.forEach((c) => {
            const pr = (sis(c).spellcasting || {}).progression;
            const n = Number(sis(c).levels) || 0;
            const nuevas = ((sis(c).source || {}).rules) === "2024";
            nivelLanzador += pr === "full" ? n : pr === "half" ? (nuevas ? Math.ceil(n / 2) : Math.floor(n / 2))
                : pr === "third" ? Math.floor(n / 3) : pr === "artificer" ? Math.ceil(n / 2) : 0;
        });
        for (let n = 1; n <= 9; n++) {
            const x = sp["spell" + n] || {};
            const max = x.override !== null && x.override !== undefined && x.override !== "" ? Number(x.override)
                : (ESPACIOS_COMPLETO[Math.min(20, nivelLanzador) - 1] || [])[n - 1] || Number(x.max) || 0;
            if (max) {
                const quedan = x.value !== null && x.value !== undefined ? Number(x.value) : max;
                pj.espacios[n] = { max, usados: Math.max(0, Math.min(max, max - quedan)) };
            }
        }
        const pacto = sp.pact || {};
        if (Number(pacto.max) || Number(pacto.override)) {
            avisos.push("Tiene espacios de pacto (" + (pacto.override || pacto.max) + "): apúntalos tú si los quieres en la ficha.");
        }
        const conjuros = [];
        de("spell").forEach((i) => {
            const x = sis(i);
            const prep = x.preparation || {};
            const metodo = x.method || prep.mode || "";
            const listo = Number(x.level) === 0 || Number(x.prepared) >= 1 || prep.prepared || ["always", "innate", "pact", "atwill", "ritual"]
                .includes(metodo) || (metodo === "spell" && x.prepared === undefined && prep.prepared === undefined);
            const n = t(i.name);
            if (listo && !conjuros.some((c) => c[1] === n)) {
                conjuros.push([Number(x.level) || 0, n]);
            }
        });
        pj.conjuros = conjuros.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1], "es")).map((c) => c[1]);
        // Ataques: las armas puestas.
        const armasComp = ((tr.weaponProf || {}).value) || [];
        pj.ataques = de("weapon").filter((i) => sis(i).equipped).map((i) => {
            const x = sis(i);
            const tipo = (x.type || {}).value || "";
            const props = x.properties || [];
            let k = x.ability && CAR_FVTT[x.ability] ? CAR_FVTT[x.ability] : /R$/.test(tipo) ? "des" : "fue";
            if (!x.ability && props.includes("fin")) {
                k = mods.des > mods.fue ? "des" : "fue";
            }
            const cat = /^simple/.test(tipo) ? "sim" : /^martial/.test(tipo) ? "mar" : "";
            const competente = x.proficient !== null && x.proficient !== undefined && x.proficient !== "" ? Number(x.proficient) >= 1
                : !!cat && (armasComp.includes(cat) || armasComp.includes((x.type || {}).baseItem));
            const magia = Number(x.magicalBonus) || 0;
            const base = (x.damage || {}).base || {};
            const dado = base.custom && base.custom.enabled ? String(base.custom.formula || "") : base.denomination
                ? (base.number || 1) + "d" + base.denomination : "";
            const extra = mods[k] + magia;
            const tiposD = (base.types || []).map((d) => DANO_FVTT[d] || t(d)).join(" o ");
            return { nombre: t(i.name), bono: signo((competente ? comp : 0) + mods[k] + magia),
                dano: (dado || "1") + (extra ? signo(extra).replace("−", "-") : "") + (tiposD ? " " + tiposD : "") };
        });
        // Objetos (con lo que lleva en las mochilas) y dinero.
        pj.objetos = items.filter((i) => ["weapon", "equipment", "consumable", "tool", "loot", "container", "backpack"].includes(i.type))
            .filter((i) => !/^unarmed strike$/i.test(i.name)).map((i) => ({ nombre: t(i.name), cant: Number(sis(i).quantity) || 1,
                equipado: !!sis(i).equipped }));
        const mon = s.currency || {};
        pj.dinero = {};
        [["cp", "pc"], ["sp", "pp"], ["ep", "pe"], ["gp", "po"], ["pp", "pt"]].forEach(([en, es]) => {
            if (Number(mon[en])) {
                pj.dinero[es] = Number(mon[en]);
            }
        });
        // Rasgos y dotes, por su nombre y de dónde vienen.
        const DE = { race: pj.raza || "especie", class: "clase", feat: "dote", background: pj.trasfondoNombre || "trasfondo",
            monster: "monstruo", supernaturalGift: "don", enchantment: "encantamiento" };
        pj.rasgos = Array.from(new Set(de("feat").map((i) => "- **" + t(i.name) + "** (" + (DE[(sis(i).type || {}).value] || "rasgo") + ")")))
            .join("\n");
        // Cómo es y su historia (lo escrito a mano, sin el HTML).
        const det = s.details || {};
        const llanoHtml = (h) => {
            const d = new DOMParser().parseFromString(String(h || ""), "text/html");
            d.querySelectorAll("p, br, li, h1, h2, h3, h4").forEach((e) => e.append("\n"));
            return (d.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
        };
        pj.alineamiento = ALIN_FVTT[llano(det.alignment || "").replace(/[^a-z]/g, "")] || String(det.alignment || "");
        pj.aspecto = [["Edad", det.age], ["Altura", det.height], ["Peso", det.weight], ["Ojos", det.eyes], ["Pelo", det.hair],
            ["Piel", det.skin], ["Género", det.gender], ["Fe", det.faith]].filter(([, v]) => v).map(([k, v]) => k + ": " + v).join(" · ")
            + (det.appearance ? (det.age || det.height ? "\n" : "") + llanoHtml(det.appearance) : "");
        pj.personalidad = llanoHtml(det.trait);
        pj.ideales = llanoHtml(det.ideal);
        pj.vinculos = llanoHtml(det.bond);
        pj.defectos = llanoHtml(det.flaw);
        pj.historia = llanoHtml((det.biography || {}).value);
        const img = String(actor.img || "");
        pj.fotoUrl = /^(https:\/\/|data:image\/)/.test(img) ? img : "";
        if (img && !pj.fotoUrl && !/mystery-man|systems\/dnd5e\/|icons\//.test(img)) {
            avisos.push("Su foto se queda en tu Foundry: ponla con «✎ editar ficha» → 📷.");
        }
        if (t.sin.length) {
            avisos.push("Sin traducir (cámbialo a mano si quieres): " + t.sin.slice(0, 30).join("; ") + (t.sin.length > 30 ? "…" : ""));
        }
        return { pj, avisos };
    }

    // LA VENTANITA DE IMPORTAR un personaje: de D&D Beyond (enlace o
    // JSON), de Nivel20 (enlace o su página guardada) o de Foundry VTT (el
    // JSON exportado). Con el ejecutable, los enlaces se traen solos. Con
    // «pj», se actualiza ese (sin tocar sus notas, PNJ ni apuntes del
    // máster); sin él, se crea uno nuevo y se abre su ficha.
    const ORIGENES_PJ = { ddb: "D&D Beyond", nivel20: "Nivel20", foundry: "Foundry VTT" };

    function traerDeNivel20(ruta) {
        return fetch("__nivel20?ruta=" + encodeURIComponent(ruta), { cache: "no-store" }).then((r) => {
            if (r.status === 404 || r.status === 403 || r.status === 401) {
                throw new Error("Nivel20 no me deja verla (" + r.status + "). ¿Es pública la ficha?");
            }
            if (!r.ok) {
                throw new Error("No he podido hablar con Nivel20 (" + r.status + "). Prueba con su página guardada.");
            }
            return r.text();
        });
    }

    // Lo que Nivel20 enseña «por partes» (los conjuros tras «Ver más»):
    // con el ejecutable, se piden las demás páginas.
    function conjurosQueFaltanN20(doc, ruta) {
        const pedidas = [];
        doc.querySelectorAll(".spell-list-panel[data-profession-id]").forEach((panel) => {
            const mas = panel.querySelector(".load-more-container [data-page]");
            if (!mas) {
                return;
            }
            const prof = panel.getAttribute("data-profession-id");
            const una = (pag) => traerDeNivel20(ruta + "/spell_list?query=&profession_id=" + encodeURIComponent(prof) + "&list=known&page=" + pag)
                .then((html) => {
                    const trozo = new DOMParser().parseFromString(html, "text/html");
                    const filas = trozo.querySelectorAll(".spell-row");
                    filas.forEach((f) => panel.appendChild(document.adoptNode(f)));
                    if (filas.length && trozo.querySelector("[data-page]") && pag < 12) {
                        return una(pag + 1);
                    }
                    return null;
                });
            pedidas.push(una(Number(mas.getAttribute("data-page")) || 2).then(() => mas.closest(".load-more-container").remove()));
        });
        return Promise.all(pedidas).catch(() => null);
    }

    // De lo pegado (o del archivo), qué es y su personaje.
    function leerPjDe(texto, t) {
        const v = String(texto || "").trim();
        const ddbNum = /dndbeyond\.com\/(?:profile\/[^/]+\/)?characters\/(\d{4,})|^(\d{4,12})$/.exec(v);
        const n20 = /nivel20\.com(\/games\/[a-z0-9-]+\/characters\/[a-z0-9-]+)/i.exec(v);
        if (v.charAt(0) === "{" || v.charAt(0) === "[") {
            let datos;
            try {
                datos = JSON.parse(v);
            } catch (e) {
                return Promise.reject(new Error("Eso no se puede leer: ¿está entero el JSON?"));
            }
            if (datos && datos.system && datos.system.abilities) {
                return Promise.resolve(Object.assign(deFoundry(datos, t), { origen: "foundry" }));
            }
            return Promise.resolve(Object.assign(deDdb(datos, t), { origen: "ddb" }));
        }
        if (/<html|character-desc|<div/i.test(v)) {
            const doc = new DOMParser().parseFromString(v, "text/html");
            const canon = doc.querySelector("link[rel=canonical], meta[property='og:url']");
            const url = canon ? canon.getAttribute("href") || canon.getAttribute("content") : "";
            const r = deNivel20(doc, url);
            r.avisos = r.avisos.map((a) => (/por partes/.test(a) ? a + " (con el programa, pegando el enlace, se traen todos)" : a));
            return Promise.resolve(Object.assign(r, { origen: "nivel20" }));
        }
        if (n20) {
            if (!EN_CARPETA) {
                return Promise.reject(new Error("Desde el navegador no puedo preguntar a Nivel20: guarda su página (Ctrl+S) y elígela"
                    + " con «📄 desde un archivo», o usa el programa."));
            }
            const ruta = n20[1].toLowerCase();
            return traerDeNivel20(ruta).then((html) => {
                const doc = new DOMParser().parseFromString(html, "text/html");
                return conjurosQueFaltanN20(doc, ruta).then(() => Object.assign(deNivel20(doc, "https://nivel20.com" + ruta),
                    { origen: "nivel20" }));
            });
        }
        if (ddbNum) {
            if (!EN_CARPETA) {
                return Promise.reject(new Error("Desde el navegador no puedo preguntar a D&D Beyond: pega el JSON."));
            }
            return fetch("__ddb?id=" + (ddbNum[1] || ddbNum[2]), { cache: "no-store" }).then((r) => {
                if (r.status === 403 || r.status === 404 || r.status === 401) {
                    throw new Error("D&D Beyond no me deja verla (" + r.status + "). ¿Es pública la ficha?");
                }
                if (!r.ok) {
                    throw new Error("No he podido hablar con D&D Beyond (" + r.status + "). Prueba a pegar el JSON.");
                }
                return r.json();
            }).then((datos) => Object.assign(deDdb(datos, t), { origen: "ddb" }));
        }
        return Promise.reject(new Error("No reconozco eso: pega el enlace de la ficha, su JSON o la página de Nivel20."));
    }

    function abrirImportarPj(vuelta, pj) {
        const cuerpo = crear("form", "master-pegar");
        const ayuda = crear("ul", "master-importar-de");
        [["D&D Beyond", EN_CARPETA ? "el enlace de la ficha (tiene que ser pública) o su JSON"
            : "el JSON de character-service.dndbeyond.com/character/v5/character/ + su número (ficha pública)"],
        ["Nivel20", EN_CARPETA ? "el enlace de la ficha (pública)" : "su página guardada (Ctrl+S → «sólo HTML») con «📄 desde un archivo»"],
        ["Foundry VTT", "el JSON del personaje (clic derecho en el actor → «Exportar datos»), con «📄 desde un archivo»"]]
            .forEach(([de, como]) => {
                const li = crear("li");
                li.append(crear("strong", "", de + ": "), document.createTextNode(como + "."));
                ayuda.appendChild(li);
            });
        cuerpo.append(crear("p", "oc-hoja-nota", "Puedes traerlo de:"), ayuda);
        const et = crear("label", "oc-dados-etiqueta", "enlace, JSON o página");
        const area = crear("textarea", "oc-dados-texto master-pegar-area");
        area.id = "master-importar-texto";
        area.rows = 4;
        et.htmlFor = area.id;
        const estado = crear("p", "oc-hoja-nota");
        estado.setAttribute("role", "status");
        const ok = crear("button", "oc-vida-accion es-principal", "📥 traer");
        ok.type = "submit";
        const archivo = crear("input");
        archivo.type = "file";
        archivo.accept = ".json,.html,.htm,application/json,text/html";
        archivo.hidden = true;
        const elegir = botonDe("oc-vida-accion", "📄 desde un archivo", () => archivo.click(),
            "Elegir un archivo: el JSON de Foundry o de D&D Beyond, o la página guardada de Nivel20");
        const fila = crear("div", "master-creador-barra");
        fila.append(ok, elegir);
        cuerpo.append(et, area, fila, archivo, estado, crear("p", "oc-hoja-nota", "Se traen sus números, competencias, conjuros,"
            + " objetos, dinero e historia, y los rasgos por su nombre (no sus textos). Se queda en este dispositivo."));
        const traer = (texto) => {
            ok.disabled = true;
            elegir.disabled = true;
            estado.textContent = "Trayendo…";
            traductorDdb().then((t) => leerPjDe(texto, t)).then((r) => {
                if (pj && (pj.foto || pj.fotoUrl)) {
                    delete r.pj.fotoUrl;
                    return r;
                }
                return guardarFotoImportada(r.pj).then(() => r);
            }).then(({ pj: nuevo, avisos, origen }) => {
                let quien;
                if (pj) {
                    const guarda = { id: pj.id, apuntes: pj.apuntes, notas: pj.notas, pnjs: pj.pnjs };
                    if (pj.foto || pj.fotoUrl) {
                        Object.assign(guarda, { foto: pj.foto, fotoUrl: pj.fotoUrl });
                    }
                    Object.assign(pj, nuevo, guarda);
                    normalizarPj(pj);
                    guardar();
                    avisarPjs("");
                    quien = pj;
                } else {
                    quien = nuevoPj(nuevo);
                }
                cerrar();
                if (!pj) {
                    abrirFichaPj(quien, quien.nombre);
                }
                avisar("Traído de " + ORIGENES_PJ[origen] + ": " + quien.nombre + "." + (avisos.length ? " " + avisos.join(" ") : ""));
            }).catch((err) => {
                ok.disabled = false;
                elegir.disabled = false;
                estado.textContent = "⚠️ " + (err && err.message && !/JSON/.test(err.name) ? err.message
                    : "Eso no se puede leer: ¿está entero?");
            });
        };
        cuerpo.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!area.value.trim()) {
                area.focus();
                return;
            }
            traer(area.value);
        });
        archivo.addEventListener("change", () => {
            const f = archivo.files && archivo.files[0];
            archivo.value = "";
            if (!f) {
                return;
            }
            if (f.size > 30 * 1024 * 1024) {
                estado.textContent = "⚠️ Ese archivo es demasiado grande.";
                return;
            }
            f.text().then(traer);
        });
        const cerrar = window.ocVentana.abrir({ titulo: pj ? "actualizar la ficha" : "traer un personaje", cuerpo, vuelta, foco: area });
    }

    // ---- EL INVENTARIO COMÚN DE LA PARTY (todo.inventario): lo que llevan
    // entre todos (lo del SRD se abre), su dinero, y «dar a…» un PJ. ----
    function inventarioParty() {
        todo.inventario = todo.inventario && Array.isArray(todo.inventario.objetos) ? todo.inventario
            : { objetos: [], dinero: {}, notas: "" };
        todo.inventario.dinero = todo.inventario.dinero || {};
        return todo.inventario;
    }

    function montarInventario(dentro, m) {
        const uid = "master-inv-" + m.id;
        const pintar = () => {
            dentro.replaceChildren(crear("p", "oc-hoja-nota", "Cargando…"));
            pedir(TIENDA).catch(() => ({ objetos: [] })).then((tienda) => {
                const inv = inventarioParty();
                const objetosSrd = {};
                (tienda.objetos || []).forEach((o) => {
                    objetosSrd[llano(o.nombre)] = o;
                });
                // El dinero: cinco casillas y el total en oro.
                const din = crear("fieldset", "master-creador-grupo");
                din.appendChild(crear("legend", "", "💰 Dinero de la party"));
                const fila = crear("div", "master-inv-monedas");
                const total = crear("p", "oc-hoja-nota");
                const pintarTotal = () => {
                    const po = MONEDAS_PJ.reduce((s, [k]) => s + (numPj(inv.dinero[k]) || 0) * ORO_DE_MONEDA[k], 0);
                    total.textContent = "En total: " + (Math.round(po * 100) / 100).toLocaleString("es-ES") + " po";
                };
                MONEDAS_PJ.forEach(([k, abr, nom]) => {
                    const lab = crear("label", "master-inv-moneda");
                    const x = crear("input", "master-party-input");
                    x.type = "number";
                    x.min = 0;
                    x.inputMode = "numeric";
                    x.value = numPj(inv.dinero[k]) || "";
                    x.setAttribute("aria-label", "Monedas de " + nom);
                    x.addEventListener("change", () => {
                        inv.dinero[k] = numPj(x.value) || 0;
                        guardar();
                        pintarTotal();
                    });
                    lab.append(crear("span", "master-party-et", abr), x);
                    fila.appendChild(lab);
                });
                pintarTotal();
                din.append(fila, total);
                // Añadir: nombre (con los del SRD sugeridos) y cuántos.
                const form = crear("form", "master-pj-anadir");
                const nom = crear("input", "oc-dados-texto");
                nom.id = uid + "-nombre";
                nom.autocomplete = "off";
                const dl = crear("datalist");
                dl.id = uid + "-lista";
                (tienda.objetos || []).forEach((o) => {
                    const op = crear("option");
                    op.value = o.nombre;
                    dl.appendChild(op);
                });
                nom.setAttribute("list", dl.id);
                const etN = crear("label", "oc-dados-etiqueta", "añadir un objeto");
                etN.htmlFor = nom.id;
                const cant = crear("input", "master-party-input");
                cant.type = "number";
                cant.min = 1;
                cant.value = 1;
                cant.id = uid + "-cant";
                const etC = crear("label", "oc-dados-etiqueta", "cuántos");
                etC.htmlFor = cant.id;
                const ok = crear("button", "oc-vida-accion", "＋ añadir");
                ok.type = "submit";
                form.append(etN, nom, dl, etC, cant, ok);
                form.addEventListener("submit", (e) => {
                    e.preventDefault();
                    const v = nom.value.trim();
                    if (!v) {
                        nom.focus();
                        return;
                    }
                    const s = objetosSrd[llano(v)];
                    const n2 = numPj(cant.value) || 1;
                    const ya = inv.objetos.find((x) => llano(x.nombre) === llano(s ? s.nombre : v));
                    if (ya) {
                        ya.cant = (numPj(ya.cant) || 1) + n2;
                    } else {
                        inv.objetos.push({ id: nuevoIdPj(), nombre: s ? s.nombre : v, cant: n2 });
                    }
                    guardar();
                    avisarPjs(m.id);
                    pintar();
                    avisar("Añadido: " + (s ? s.nombre : v) + " ×" + n2 + ".");
                    const nuevoNom = document.getElementById(uid + "-nombre");
                    if (nuevoNom) {
                        nuevoNom.focus();
                    }
                });
                // La lista.
                const ul = crear("ul", "master-inv-lista");
                ul.setAttribute("aria-label", "Inventario común de la party");
                inv.objetos.forEach((o) => {
                    const li = crear("li", "master-inv-objeto");
                    const s = objetosSrd[llano(o.nombre)];
                    const nombre = s ? botonDe("master-conjuro-boton", o.nombre, () => abrirObjeto(s, nombre, tienda.fuente))
                        : crear("span", "master-inv-nombre", o.nombre);
                    const menos = botonDe("master-docs-mando", "−", () => {
                        o.cant = Math.max(0, (numPj(o.cant) || 1) - 1);
                        if (!o.cant) {
                            inv.objetos.splice(inv.objetos.indexOf(o), 1);
                            avisar("Gastado: " + o.nombre + ".");
                        }
                        guardar();
                        pintar();
                    }, "Uno menos de " + o.nombre);
                    const cuantos = crear("span", "master-inv-cant", "×" + (numPj(o.cant) || 1));
                    const mas = botonDe("master-docs-mando", "＋", () => {
                        o.cant = (numPj(o.cant) || 1) + 1;
                        guardar();
                        cuantos.textContent = "×" + o.cant;
                    }, "Uno más de " + o.nombre);
                    const dar = crear("select", "master-elegir master-inv-dar");
                    dar.setAttribute("aria-label", "Dar " + o.nombre + " a…");
                    [["", "dar a…"]].concat((todo.pjs || []).map((p) => [p.id, p.nombre || "sin nombre"])).forEach(([v, tx]) => {
                        const op = crear("option", "", tx);
                        op.value = v;
                        dar.appendChild(op);
                    });
                    dar.disabled = !(todo.pjs || []).length;
                    dar.addEventListener("change", () => {
                        const p = (todo.pjs || []).find((x) => x.id === dar.value);
                        if (!p) {
                            return;
                        }
                        normalizarPj(p);
                        p.objetos.push({ nombre: o.nombre, cant: 1, equipado: false });
                        o.cant = (numPj(o.cant) || 1) - 1;
                        if (o.cant <= 0) {
                            inv.objetos.splice(inv.objetos.indexOf(o), 1);
                        }
                        guardar();
                        avisarPjs(m.id);
                        avisar(o.nombre + ": se lo queda " + p.nombre + ".");
                        pintar();
                    });
                    let seguro = false;
                    const quitar = botonDe("master-docs-mando", "✕", () => {
                        if (!seguro) {
                            seguro = true;
                            quitar.classList.add("es-seguro");
                            avisar("Pulsa otra vez para quitar " + o.nombre + ".");
                            return;
                        }
                        inv.objetos.splice(inv.objetos.indexOf(o), 1);
                        guardar();
                        pintar();
                        avisar("Quitado: " + o.nombre + ".");
                    }, "Quitar " + o.nombre);
                    li.append(nombre, menos, cuantos, mas, dar, quitar);
                    ul.appendChild(li);
                });
                const vacio = crear("p", "oc-vacio", "La party no lleva nada en común todavía.");
                vacio.hidden = !!inv.objetos.length;
                const notas = crear("textarea", "oc-notas-texto es-corta");
                notas.id = uid + "-notas";
                notas.rows = 3;
                notas.value = inv.notas || "";
                const etNotas = crear("label", "oc-dados-etiqueta", "notas (dónde lo guardan, quién lo carga…)");
                etNotas.htmlFor = notas.id;
                let espera = 0;
                notas.addEventListener("input", () => {
                    inv.notas = notas.value;
                    clearTimeout(espera);
                    espera = setTimeout(guardar, 400);
                });
                dentro.replaceChildren(din, form, vacio, ul, etNotas, notas);
            });
        };
        pintar();
        mientrasEste(dentro, "master:pjs", (e) => {
            if (!(e.detail && e.detail.desde === m.id) && !dentro.contains(document.activeElement)) {
                pintar();
            }
        });
    }

    // ---- LA PARTY: los jugadores, a mano y deprisa: nombre, clase, PG,
    // CA, las seis características (su bono tira 1d20+bono) y las
    // pasivas (Percepción, Investigación y Perspicacia). ----
    const CARACTERISTICAS = ["FUE", "DES", "CON", "INT", "SAB", "CAR"];
    const PASIVAS = [["per", "Percepción pasiva", "👁️"], ["inv", "Investigación pasiva", "🔍"],
        ["persp", "Perspicacia pasiva", "💭"]];

    function montarParty(dentro, m) {
        m.datos = m.datos || {};
        // Los PJ son de la campaña (todo.pjs), no de esta ventana.
        const pjsDe = () => todo.pjs;
        const numero = (v) => (v === "" || v === undefined || v === null || isNaN(parseInt(v, 10)) ? "" : parseInt(v, 10));
        const mod = (n) => Math.floor((n - 10) / 2);
        const conSigno = (n) => (n >= 0 ? "+" : "−") + Math.abs(n);
        const quienEs = (pj, i) => pj.nombre || "jugador " + (i + 1);
        const uid = "master-party-" + m.id;

        pjsDe().forEach((pj) => {
            pj.id = pj.id || nuevoIdPj();
        });
        // ---- las pestañas: la lista (para mirar), el editor y los
        // hechizos de todos ----
        const panelLista = crear("div");
        const panelEditor = crear("div");
        const panelConjuros = crear("div");
        const { lista: pestanas, elegir } = pestanasDe([["👥 la party", panelLista], ["✏️ editar", panelEditor],
            ["✨ hechizos", panelConjuros]], "Party", uid, (i) => {
            m.datos.pestana = i;
            guardar();
            [pintarLista, pintarEditor, pintarConjuros][i]();
        });

        // ---- LOS HECHIZOS DE TODOS: por jugador; cada uno se abre ----
        function pintarConjuros() {
            panelConjuros.replaceChildren(crear("p", "oc-hoja-nota", "Cargando…"));
            pedir(CONJUROS_SRD).then((conj) => {
                const srd = {};
                (conj.conjuros || []).forEach((c) => {
                    srd[llano(c.nombre)] = c;
                });
                panelConjuros.replaceChildren();
                let alguno = false;
                pjsDe().forEach((pj, i) => {
                    const todos = conjurosPj(pj, srd).sort((x, y) => (x.nivel === null) - (y.nivel === null) || x.nivel - y.nivel);
                    if (!todos.length) {
                        return;
                    }
                    alguno = true;
                    panelConjuros.appendChild(crear("h3", "master-pj-titulo", quienEs(pj, i)));
                    const ul = crear("ul", "master-pj-lista");
                    ul.setAttribute("aria-label", "Hechizos de " + quienEs(pj, i));
                    todos.forEach((c) => {
                        const li = crear("li");
                        li.append(crear("span", "master-pj-marca", c.nivel === null ? "¿?" : c.nivel === 0 ? "truco" : "nv " + c.nivel),
                            conjuroPj(c.nombre, srd, conj.fuente));
                        ul.appendChild(li);
                    });
                    panelConjuros.appendChild(ul);
                });
                if (!alguno) {
                    panelConjuros.appendChild(crear("p", "oc-vacio", "Nadie tiene hechizos apuntados (se ponen en la ficha de cada uno)."));
                }
            }).catch(() => panelConjuros.replaceChildren(crear("p", "oc-vacio", "No he podido cargar los hechizos.")));
        }

        // ---- LA LISTA: de un vistazo, sin campos; con sus dados y «a la
        // iniciativa» (tira 1d20 + su bono de Destreza) ----
        const alIni = (pj, i) => {
            return meterEnIniciativa(iniDePj(pj, quienEs(pj, i)));
        };
        // Crear (una ficha vacía, abierta para rellenar) o importar uno.
        const crearPj = crear("div", "master-creador-barra");
        const nuevoB = botonDe("oc-vida-accion es-principal", "＋ personaje", () => {
            const pj = nuevoPj();
            anadir("pj", { titulo: pj.nombre, datos: { pj: pj.id, editar: true } });
        }, "Crear un personaje nuevo (con su ficha, para rellenar)");
        const ddbB = botonDe("oc-vida-accion", "📥 importar", () => abrirImportarPj(ddbB),
            "Importar un personaje de D&D Beyond, Nivel20 o Foundry VTT");
        ddbB.setAttribute("aria-haspopup", "dialog");
        crearPj.append(nuevoB, ddbB);
        function pintarLista() {
            const pjs = pjsDe();
            panelLista.replaceChildren(crearPj);
            if (!pjs.length) {
                panelLista.appendChild(crear("p", "oc-vacio", "Todavía no hay personajes: crea uno o impórtalo (D&D Beyond,"
                    + " Nivel20 o Foundry VTT)."));
                return;
            }
            const todos = botonDe("oc-vida-accion es-principal", "⚔️ todos a la iniciativa", () => {
                const entran = pjs.map((pj, i) => alIni(pj, i)).filter(Boolean);
                avisar(entran.length ? "A la iniciativa: " + entran.join(", ") + "." : "Ya estaban todos en la iniciativa.");
            }, "Poner a toda la party en la iniciativa (tira su iniciativa)");
            const resumen = crear("p", "master-party-resumen");
            const trozos = PASIVAS.map(([k, texto]) => {
                const con = pjs.filter((pj) => pasivaPj(normalizarPj(pj), k) !== null);
                if (!con.length) {
                    return "";
                }
                const mejor = con.reduce((a, b) => (pasivaPj(b, k) > pasivaPj(a, k) ? b : a));
                return texto.replace(" pasiva", "") + " " + pasivaPj(mejor, k) + " (" + (mejor.nombre || "sin nombre") + ")";
            }).filter(Boolean);
            resumen.textContent = trozos.length ? "La más alta: " + trozos.join(" · ") : "";
            resumen.hidden = !trozos.length;
            const ul = crear("ul", "master-party es-lista");
            ul.dataset.queSolo = "si";
            ul.setAttribute("aria-label", "Jugadores");
            pjs.forEach((pj, i) => {
                const quien = quienEs(pj, i);
                const li = crear("li", "master-party-pj es-lista");
                const cabeza = crear("div", "master-party-cabeza");
                const nombre = crear("p", "master-party-nombre");
                const cara = fotoPj(pj, "master-party-foto", "");
                if (cara) {
                    nombre.appendChild(cara);
                }
                nombre.appendChild(crear("strong", "", quien));
                if (pj.clase) {
                    nombre.appendChild(crear("span", "master-party-clase", pj.clase));
                }
                const ini = botonDe("oc-vida-accion", "＋ iniciativa", () => {
                    const n = alIni(pj, i);
                    avisar(n ? "A la iniciativa: " + n + "." : quien + " ya está en la iniciativa.");
                }, "Poner a " + quien + " en la iniciativa (tira su iniciativa)");
                const ficha = botonDe("oc-vida-accion", "📖 ficha", () => abrirFichaPj(pj, quien),
                    "Abrir la ficha de " + quien + " (habilidades, armas, hechizos, historia…)");
                const botones = crear("div", "master-pj-botones");
                botones.append(ficha, ini);
                if (puedeSubir(pj)) {
                    const sube = botonDe("oc-vida-accion es-principal", "⬆ nivel " + ((numPj(pj.nivel) || 1) + 1), () => verSubidas([pj], sube),
                        quien + " tiene PX para subir a nivel " + ((numPj(pj.nivel) || 1) + 1));
                    sube.setAttribute("aria-haspopup", "dialog");
                    botones.prepend(sube);
                }
                cabeza.append(nombre, botones);
                const vitales = crear("dl", "master-party-vitales");
                const vital = (et, valor, titulo) => {
                    if (valor === "" || valor === undefined) {
                        return;
                    }
                    const dt = crear("dt", "", et);
                    dt.title = titulo;
                    vitales.append(dt, crear("dd", "", String(valor)));
                };
                const pgAhora = numero(pj.pg) !== "" ? numero(pj.pg) : numero(pj.pgmax);
                vital("PG", pgAhora === "" ? "—" : pgAhora + (numero(pj.pgmax) !== "" ? " / " + numero(pj.pgmax) : "")
                    + (numero(pj.pgtemp) ? " (+" + numero(pj.pgtemp) + " temp.)" : ""), "Puntos de golpe");
                vital("CA", numero(pj.ca), "Clase de armadura");
                vital("PX", (numPj(pj.px) || 0).toLocaleString("es-ES") + ((numPj(pj.nivel) || 1) < 20 ? " / "
                    + pxParaSubir(pj).toLocaleString("es-ES") : ""), "Puntos de experiencia (y los que necesita para subir)");
                PASIVAS.forEach(([k, texto, emoji]) => vital(emoji, pasivaPj(pj, k) === null ? "" : pasivaPj(pj, k), texto));
                vitales.querySelectorAll("dt").forEach((dt) => {
                    if (/\p{Extended_Pictographic}/u.test(dt.textContent)) {
                        const t = dt.title;
                        const e = dt.textContent;
                        dt.textContent = "";
                        const em = crear("span", "", e);
                        em.setAttribute("aria-hidden", "true");
                        dt.append(em, crear("span", "visually-hidden", t));
                    }
                });
                const car = crear("ul", "master-party-caracteristicas");
                car.setAttribute("aria-label", "Características de " + quien);
                CARACTERISTICAS.forEach((k) => {
                    const n = numero(pj[k.toLowerCase()]);
                    if (n === "") {
                        return;
                    }
                    const c = crear("li", "master-party-c");
                    c.appendChild(crear("span", "master-party-et", k));
                    c.appendChild(crear("span", "master-party-valor", String(n)));
                    c.appendChild(window.ocDadoBoton ? window.ocDadoBoton(conSigno(mod(n)), "1d20" + (mod(n) >= 0 ? "+" : "")
                        + mod(n), k + " de " + quien) : document.createTextNode(conSigno(mod(n))));
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
            const grupo = crear("form", "master-party-grupo");
            const etG = crear("label", "oc-dados-etiqueta", "🎲 tirada de grupo");
            const queG = crear("select", "oc-dados-elegir");
            queG.id = "master-party-grupo-" + m.id;
            etG.htmlFor = queG.id;
            const opc = (v, t, padre) => {
                const o = crear("option", "", t);
                o.value = v;
                padre.appendChild(o);
            };
            const gS = crear("optgroup");
            gS.label = "salvaciones";
            Object.keys(NOMBRES_CAR).forEach((k) => opc("s:" + k, "salvación de " + NOMBRES_CAR[k], gS));
            const gH = crear("optgroup");
            gH.label = "habilidades";
            HABILIDADES_PJ.forEach(([n]) => opc("h:" + n, n, gH));
            const gC = crear("optgroup");
            gC.label = "características";
            Object.keys(NOMBRES_CAR).forEach((k) => opc("c:" + k, NOMBRES_CAR[k], gC));
            queG.append(gS, gH, gC);
            queG.value = "h:Percepción";
            const tirarG = crear("button", "oc-vida-accion es-principal", "tirar");
            tirarG.type = "submit";
            const resultadoG = crear("ol", "master-party-grupo-resultado");
            resultadoG.setAttribute("aria-label", "Resultados de la tirada de grupo");
            resultadoG.hidden = true;
            const vivoG = crear("p", "visually-hidden");
            vivoG.setAttribute("aria-live", "polite");
            grupo.addEventListener("submit", (e) => {
                e.preventDefault();
                if (!window.ocDados) {
                    return;
                }
                const [tipo, k] = queG.value.split(/:(.*)/);
                const textoQue = queG.options[queG.selectedIndex].textContent;
                const filas = pjs.map((pj, i) => {
                    normalizarPj(pj);
                    let bono = 0;
                    if (tipo === "h") {
                        bono = bonoHabPj(pj, k);
                    } else {
                        const n = numPj(pj[k]);
                        bono = (n === null ? 0 : modDe(n)) + (tipo === "s" && (pj.salvaciones || []).includes(k) ? competenciaPj(pj) : 0);
                    }
                    bono = bono === null ? 0 : bono;
                    const r = window.ocDados.tirar("1d20" + (bono ? (bono > 0 ? "+" : "") + bono : ""), textoQue + " de " + quienEs(pj, i));
                    return { quien: quienEs(pj, i), total: r ? r.total : 0, d20: r && r.d20 ? r.d20.queda : null, bono };
                }).sort((a, b) => b.total - a.total);
                resultadoG.replaceChildren(...filas.map((f) => {
                    const li = crear("li", f.d20 === 20 ? "es-critico" : f.d20 === 1 ? "es-pifia" : "");
                    li.append(crear("strong", "", String(f.total)), document.createTextNode(" " + f.quien + " (d20"
                        + (f.d20 !== null ? " " + f.d20 : "") + " " + signo(f.bono) + ")" + (f.d20 === 20 ? " ¡20!" : f.d20 === 1 ? " ¡1!" : "")));
                    return li;
                }));
                resultadoG.hidden = false;
                vivoG.textContent = textoQue + ": " + filas.map((f) => f.quien + " " + f.total).join(", ") + ".";
            });
            grupo.append(etG, queG, tirarG);
            const pxForm = crear("form", "master-party-grupo");
            const etPx = crear("label", "oc-dados-etiqueta", "🏆 repartir PX (a partes iguales)");
            const pxIn = crear("input", "oc-dados-texto");
            pxIn.type = "number";
            pxIn.min = "1";
            pxIn.inputMode = "numeric";
            pxIn.id = "master-party-px-" + m.id;
            pxIn.placeholder = "PX en total";
            etPx.htmlFor = pxIn.id;
            const darB = crear("button", "oc-vida-accion es-principal", "repartir");
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
                darPx(n, null, darB);
            });
            panelLista.append(todos, grupo, resultadoG, vivoG, pxForm, resumen, ul);
        }

        // ---- EL EDITOR: una tarjeta con campos por jugador ----
        const lista = crear("ul", "master-party");
        lista.setAttribute("aria-label", "Jugadores (editar)");
        lista.dataset.queSolo = "si";
        const campo = (pj, i, clave, texto, tipo, clase) => {
            const et = crear("label", "master-party-campo" + (clase ? " " + clase : ""));
            et.appendChild(crear("span", "master-party-et", texto));
            const input = crear("input", "master-party-input");
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
                guardar();
                avisarPjs(m.id);
            });
            et.appendChild(input);
            return et;
        };
        const vacio = crear("p", "oc-vacio", "Todavía no hay jugadores.");
        const nuevo = botonDe("oc-vida-accion es-principal", "＋ personaje", () => {
            nuevoPj({ nombre: "" });
            pintarEditor();
            const inputs = lista.querySelectorAll(".es-nombre input");
            inputs[inputs.length - 1].focus();
        }, "Añadir un jugador");
        function pintarEditor(foco) {
            lista.replaceChildren(...pjsDe().map((pj, i) => {
                const li = crear("li", "master-party-pj");
                const quien = quienEs(pj, i);
                const arriba = crear("div", "master-party-fila");
                arriba.append(campo(pj, i, "nombre", "nombre", "text", "es-nombre"), campo(pj, i, "raza", "especie", "text", "es-clase"),
                    campo(pj, i, "clase", "clase", "text", "es-clase"), campo(pj, i, "nivel", "nv"), campo(pj, i, "pg", "PG"), campo(pj, i, "pgmax", "máx"), campo(pj, i, "ca", "CA"));
                let seguro = false;
                const quitar = botonDe("master-party-quitar", "✕", () => {
                    if (!seguro) {
                        seguro = true;
                        quitar.setAttribute("aria-label", "¿Seguro? Pulsa otra vez para quitar a " + quien);
                        avisar("Pulsa otra vez para quitar a " + quien + ".");
                        return;
                    }
                    pjsDe().splice(i, 1);
                    guardar();
                    pintarEditor(Math.min(i, pjsDe().length - 1));
                    avisar("Quitado: " + quien + ".");
                }, "Quitar a " + quien);
                arriba.appendChild(quitar);
                const car = crear("div", "master-party-fila");
                CARACTERISTICAS.forEach((k) => {
                    const c = crear("div", "master-party-car");
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
        mientrasEste(dentro, "master:pjs", () => {
            if (!dentro.contains(document.activeElement) || panelLista.contains(document.activeElement)) {
                [pintarLista, pintarEditor, pintarConjuros][m.datos.pestana || 0]();
            }
        });
        elegir(typeof m.datos.pestana === "number" ? Math.min(m.datos.pestana, 2) : 0, false);
    }

    // ---- UN POST-IT: texto con formato, como en un procesador de textos
    // (negrita, cursiva, subrayado, tachado, títulos, listas, citas,
    // alineación, colores y resaltado), con su barra de herramientas.
    // «✏️ editar» lo abre para escribir; «listo» lo deja para leer (y
    // entonces los dados del texto se tiran). Se guarda como HTML limpio
    // (m.datos.html; los de antes, en Markdown, se pasan solos). ----
    const ETIQUETAS_POSTIT = ["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "H3", "H4", "UL", "OL",
        "LI", "BLOCKQUOTE", "SPAN", "MARK", "HR"];
    // Los tamaños de letra de la barra, en «em» (relativos a la letra de
    // alrededor: las palabras «large» y compañía van por su cuenta).
    const TAMANOS_LETRA = { 1: "0.7em", 2: "0.8em", 3: "1em", 4: "1.2em", 5: "1.4em", 6: "1.9em", 7: "2.4em" };
    const TAMANOS_PALABRA = { "x-small": "0.7em", small: "0.8em", medium: "1em", large: "1.2em", "x-large": "1.4em",
        "xx-large": "1.9em", "xxx-large": "2.4em" };

    // Solo lo que hace la barra: lo demás (scripts, enlaces, imágenes,
    // estilos raros pegados de otra web) se quita o se queda en texto.
    function sanearHtml(html) {
        const caja = document.createElement("template");
        caja.innerHTML = String(html || "");
        const limpiar = (nodo) => {
            Array.from(nodo.childNodes).forEach((n) => {
                if (n.nodeType === 3) {
                    return;
                }
                if (n.nodeType !== 1) {
                    n.remove();
                    return;
                }
                let tag = n.tagName === "FONT" ? "SPAN" : n.tagName;
                if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "TEMPLATE"].indexOf(tag) >= 0) {
                    n.remove();
                    return;
                }
                limpiar(n);
                if (ETIQUETAS_POSTIT.indexOf(tag) < 0) {
                    tag = /^(H1|H2|H5|H6)$/.test(tag) ? "H3" : null;
                    if (!tag) {
                        n.replaceWith(...n.childNodes);
                        return;
                    }
                }
                const nuevo = document.createElement(tag);
                const st = n.style || {};
                const color = n.getAttribute && n.getAttribute("color");
                const estilos = [];
                if (st.color || color) {
                    estilos.push("color: " + (st.color || color));
                }
                if (st.backgroundColor) {
                    estilos.push("background-color: " + st.backgroundColor);
                }
                if (st.textAlign && /^(left|center|right|justify)$/.test(st.textAlign)) {
                    estilos.push("text-align: " + st.textAlign);
                }
                const tam = TAMANOS_PALABRA[st.fontSize] || st.fontSize || TAMANOS_LETRA[n.getAttribute && n.getAttribute("size")] || "";
                if (/^(0\.7|0\.8|1|1\.2|1\.4|1\.9|2\.4)em$/.test(tam)) {
                    estilos.push("font-size: " + tam);
                }
                if (st.marginLeft && /^\d+(\.\d+)?(px|em)$/.test(st.marginLeft)) {
                    estilos.push("margin-left: " + st.marginLeft);
                }
                if (estilos.length) {
                    nuevo.setAttribute("style", estilos.join("; "));
                }
                nuevo.append(...n.childNodes);
                n.replaceWith(nuevo);
            });
        };
        limpiar(caja.content);
        return caja.innerHTML;
    }

    const COLORES_LETRA = [["", "la del tema"], ["#d23b3b", "rojo"], ["#e07a1f", "naranja"], ["#2f9e4f", "verde"],
        ["#3b7ddd", "azul"], ["#8e5bd6", "morado"]];
    const COLORES_RESALTE = [["", "sin resaltar"], ["#ffe873", "amarillo"], ["#8fe8a2", "verde"], ["#7fdcff", "celeste"],
        ["#ffa6d5", "rosa"], ["#ffb870", "naranja"]];

    // EL EDITOR CON FORMATO (como un procesador de textos), el de los
    // post-its y las notas: una barra de herramientas y un texto
    // editable. «alCambiar()» avisa de cada cambio; .leer() da el HTML
    // ya saneado.
    function editorRico(etiquetaTexto, alCambiar) {
        const area = crear("div", "oc-texto master-postit es-editable");
        area.contentEditable = "true";
        area.setAttribute("role", "textbox");
        area.setAttribute("aria-multiline", "true");
        area.setAttribute("aria-label", etiquetaTexto);
        // ---- la barra de herramientas ----
        const barra = crear("div", "master-postit-barra");
        barra.setAttribute("role", "toolbar");
        barra.setAttribute("aria-label", "Formato del texto");
        const estados = [];
        const orden = (cmd, valor) => {
            area.focus();
            try {
                document.execCommand("styleWithCSS", false, cmd === "hiliteColor" || cmd === "foreColor" || cmd === "fontSize");
            } catch (e) {
                // Navegadores sin styleWithCSS: da igual.
            }
            document.execCommand(cmd, false, valor);
            if (cmd === "fontSize") {
                // De «x-large» (que no depende de la letra de alrededor) a «em».
                area.querySelectorAll("[style*='font-size']").forEach((x) => {
                    if (TAMANOS_PALABRA[x.style.fontSize]) {
                        x.style.fontSize = TAMANOS_PALABRA[x.style.fontSize];
                    }
                });
            }
            alEscribir();
            repintarEstados();
        };
        const herramienta = (texto, etiqueta, cmd, valor, clase, atajo) => {
            const b = botonDe("master-postit-boton" + (clase ? " " + clase : ""), texto, () => orden(cmd, valor), etiqueta);
            b.title = etiqueta + (atajo ? " (" + atajo + ")" : "");
            // Que pulsar no quite la selección del texto.
            b.addEventListener("mousedown", (e) => e.preventDefault());
            if (["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList",
                "justifyLeft", "justifyCenter", "justifyRight"].indexOf(cmd) >= 0) {
                b.setAttribute("aria-pressed", "false");
                estados.push([b, cmd]);
            }
            return b;
        };
        const grupo = (...hijos) => {
            const g = crear("span", "master-postit-grupo");
            g.append(...hijos);
            return g;
        };
        const elegir = (etiqueta, opciones, cmd, nombre) => {
            const sel = crear("select", "master-postit-elegir");
            sel.setAttribute("aria-label", nombre);
            sel.title = nombre;
            const primera = crear("option", "", etiqueta);
            primera.value = "-";
            sel.appendChild(primera);
            opciones.forEach(([hex, nombre]) => {
                const o = crear("option", "", nombre);
                o.value = hex;
                sel.appendChild(o);
            });
            sel.addEventListener("change", () => {
                if (sel.value === "-") {
                    return;
                }
                if (cmd === "hiliteColor") {
                    // Resaltar: el fondo claro y la letra oscura (que se
                    // lea en todos los temas).
                    orden("hiliteColor", sel.value || "transparent");
                    if (sel.value) {
                        orden("foreColor", "#14101a");
                    }
                } else if (sel.value) {
                    orden("foreColor", sel.value);
                } else {
                    orden("removeFormat");
                }
                sel.value = "-";
            });
            return sel;
        };
        const parrafo = crear("select", "master-postit-elegir");
        parrafo.setAttribute("aria-label", "Tipo de párrafo");
        parrafo.title = "Tipo de párrafo";
        [["P", "párrafo"], ["H3", "título"], ["H4", "subtítulo"], ["BLOCKQUOTE", "cita"]].forEach(([v, n]) => {
            const o = crear("option", "", n);
            o.value = v;
            parrafo.appendChild(o);
        });
        parrafo.addEventListener("change", () => orden("formatBlock", parrafo.value));
        const tamano = crear("select", "master-postit-elegir");
        tamano.setAttribute("aria-label", "Tamaño de la letra");
        tamano.title = "Tamaño de la letra";
        [["-", "🗚 tamaño"], ["2", "pequeña"], ["3", "normal"], ["5", "grande"], ["6", "enorme"]].forEach(([v, n]) => {
            const o = crear("option", "", n);
            o.value = v;
            tamano.appendChild(o);
        });
        tamano.addEventListener("change", () => {
            if (tamano.value !== "-") {
                orden("fontSize", tamano.value);
            }
            tamano.value = "-";
        });
        barra.append(
            grupo(herramienta("B", "Negrita", "bold", null, "es-negrita", "Ctrl+B"),
                herramienta("I", "Cursiva", "italic", null, "es-cursiva", "Ctrl+I"),
                herramienta("U", "Subrayado", "underline", null, "es-subrayado", "Ctrl+U"),
                herramienta("S", "Tachado", "strikeThrough", null, "es-tachado")),
            grupo(parrafo),
            grupo(tamano),
            grupo(herramienta("•", "Lista", "insertUnorderedList"), herramienta("1.", "Lista numerada", "insertOrderedList"),
                herramienta("→", "Más sangría", "indent"), herramienta("←", "Menos sangría", "outdent")),
            grupo(herramienta("⇤", "Alinear a la izquierda", "justifyLeft"), herramienta("↔", "Centrar", "justifyCenter"),
                herramienta("⇥", "Alinear a la derecha", "justifyRight")),
            grupo(elegir("🎨 letra", COLORES_LETRA, "foreColor", "Color de la letra"), elegir("🖍️ resaltar", COLORES_RESALTE, "hiliteColor", "Resaltar")),
            grupo(herramienta("―", "Línea de separación", "insertHorizontalRule"), herramienta("⌫", "Quitar el formato", "removeFormat"), herramienta("↶", "Deshacer", "undo", null, "", "Ctrl+Z"),
                herramienta("↷", "Rehacer", "redo", null, "", "Ctrl+Y")));
        // Las flechas mueven el foco por la barra (como en un procesador).
        barra.addEventListener("keydown", (e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" || e.target.tagName === "SELECT") {
                return;
            }
            const todos = Array.from(barra.querySelectorAll("button, select"));
            const i = todos.indexOf(e.target);
            if (i >= 0) {
                e.preventDefault();
                todos[(i + (e.key === "ArrowRight" ? 1 : -1) + todos.length) % todos.length].focus();
            }
        });
        function repintarEstados() {
            estados.forEach(([b, cmd]) => {
                let si = false;
                try {
                    si = document.queryCommandState(cmd);
                } catch (e) {
                    si = false;
                }
                b.setAttribute("aria-pressed", si ? "true" : "false");
            });
            let bloque = "P";
            try {
                bloque = String(document.queryCommandValue("formatBlock") || "p").toUpperCase();
            } catch (e) {
                bloque = "P";
            }
            parrafo.value = ["H3", "H4", "BLOCKQUOTE"].indexOf(bloque) >= 0 ? bloque : "P";
        }
        const alSeleccionar = () => {
            if (!area.isConnected && barra.dataset.montado) {
                document.removeEventListener("selectionchange", alSeleccionar);
                return;
            }
            barra.dataset.montado = "1";
            if (!area.hidden && area.contains(document.getSelection().anchorNode)) {
                repintarEstados();
            }
        };
        document.addEventListener("selectionchange", alSeleccionar);
        function alEscribir() {
            alCambiar();
        }
        area.addEventListener("input", alEscribir);
        // Lo pegado, sin el formato de fuera (sí con saltos de línea).
        area.addEventListener("paste", (e) => {
            const texto = e.clipboardData && e.clipboardData.getData("text/plain");
            if (texto !== undefined && texto !== null) {
                e.preventDefault();
                document.execCommand("insertText", false, texto);
            }
        });
        return { area, barra, leer: () => sanearHtml(area.innerHTML) };
    }

    function montarTarjeta(dentro, m) {
        m.datos = m.datos || {};
        if (m.datos.html === undefined && m.datos.texto) {
            m.datos.html = sanearHtml(markdown(m.datos.texto).innerHTML);
        }
        const ver = crear("div", "oc-texto master-postit");
        let espera = 0;
        const { area, barra, leer } = editorRico("Texto del post-it", () => {
            clearTimeout(espera);
            espera = setTimeout(() => {
                m.datos.html = leer();
                delete m.datos.texto;
                guardar();
            }, 400);
        });
        area.hidden = true;
        barra.hidden = true;
        const pintar = () => {
            ver.innerHTML = sanearHtml(m.datos.html || "");
            if (!ver.textContent.trim()) {
                ver.replaceChildren(crear("p", "oc-vacio", "Vacío: pulsa «editar» y escribe lo que quieras tener a mano."));
            } else if (window.ocDadosEnTexto) {
                window.ocDadosEnTexto(ver);
            }
        };
        const boton = botonDe("oc-vida-accion", "✏️ editar", () => {
            const editando = area.hidden;
            if (editando) {
                area.innerHTML = sanearHtml(m.datos.html || "") || "<p><br></p>";
                area.hidden = false;
                barra.hidden = false;
                ver.hidden = true;
                boton.textContent = "✔ listo";
                area.focus();
            } else {
                clearTimeout(espera);
                m.datos.html = leer();
                delete m.datos.texto;
                guardar();
                area.hidden = true;
                barra.hidden = true;
                ver.hidden = false;
                boton.textContent = "✏️ editar";
                pintar();
                boton.focus();
            }
        });
        boton.classList.add("master-postit-editar");
        dentro.append(barra, ver, area, boton);
        pintar();
    }

    // ---- LAS NOTAS DEL MÁSTER: el editor con formato siempre abierto,
    // con «poner la fecha», «descargar» (un .html que abre Word o el
    // navegador) y «borrar». Lo de antes (texto suelto de ocPartida,
    // «notas») pasa solo la primera vez. ----
    function montarNotas(dentro, m) {
        m.datos = m.datos || {};
        if (m.datos.html === undefined) {
            const antes = window.ocPartida && window.ocPartida.leer ? window.ocPartida.leer("notas", "") : "";
            m.datos.html = antes ? sanearHtml(markdown(antes).innerHTML) : "";
        }
        let espera = 0;
        const { area, barra, leer } = editorRico("Notas del máster (se guardan solas)", () => {
            clearTimeout(espera);
            espera = setTimeout(() => {
                m.datos.html = leer();
                guardar();
            }, 400);
        });
        area.classList.add("es-notas");
        area.innerHTML = sanearHtml(m.datos.html) || "<p><br></p>";
        const fecha = botonDe("oc-vida-accion", "📅 poner la fecha", () => {
            const hoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
            const h = crear("h3", "", hoy);
            const p = crear("p");
            p.appendChild(crear("br"));
            area.append(h, p);
            m.datos.html = leer();
            guardar();
            area.focus();
            const rango = document.createRange();
            rango.setStart(p, 0);
            rango.collapse(true);
            const sel = document.getSelection();
            sel.removeAllRanges();
            sel.addRange(rango);
            avisar("Fecha puesta: " + hoy + ".");
        });
        const aDocs = botonDe("oc-vida-accion", "📁 guardar en documentos", () => {
            m.datos.html = leer();
            guardarEnDocumentos(aDocs, m.datos.doc, () => ({ tipo: "nota", titulo: "notas de la sesión", html: leer() }), (id) => {
                m.datos.doc = id;
            });
        });
        aDocs.setAttribute("aria-haspopup", "dialog");
        const bajar = botonDe("oc-vida-accion", "💾 descargar", () => {
            const pagina = "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><title>Notas del máster</title></head><body>" +
                leer() + "</body></html>";
            const a = crear("a");
            // Una dirección blob: que hace el propio navegador con el archivo.
            const archivoBlob = URL.createObjectURL(new Blob([pagina], { type: "text/html;charset=utf-8" }));
            a.href = archivoBlob;
            a.download = "notas-del-master-" + new Date().toISOString().slice(0, 10) + ".html";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(archivoBlob), 1000);
            avisar("Descargado: " + a.download + " (se abre con Word o el navegador).");
        }, "Descargar las notas (.html, con su formato)");
        let seguro = false;
        const borrar = botonDe("oc-vida-accion", "🗑️ borrar", () => {
            if (!seguro) {
                seguro = true;
                borrar.textContent = "🗑️ ¿seguro? pulsa otra vez";
                setTimeout(() => {
                    seguro = false;
                    borrar.textContent = "🗑️ borrar";
                }, 4000);
                return;
            }
            seguro = false;
            borrar.textContent = "🗑️ borrar";
            area.innerHTML = "<p><br></p>";
            m.datos.html = "";
            guardar();
            avisar("Notas borradas.");
        });
        const botones = crear("div", "master-notas-botones");
        botones.append(fecha, aDocs, bajar, borrar);
        dentro.append(barra, area, botones);
    }

    // ---- EL GENERADOR DE NOMBRES: personajes por especie y género (de
    // sílabas, con su apellido) y lugares (pueblos, tabernas, parajes y
    // mazmorras), de datos/personajes/compendio/nombres.json. Cada nombre,
    // con «copiar». ----
    const NOMBRES = "datos/personajes/compendio/nombres.json";

    function alAzar(lista) {
        const u = new Uint32Array(1);
        crypto.getRandomValues(u);
        return lista[u[0] % lista.length];
    }

    function nombreDe(datos, especie, genero, conApellido) {
        const e = datos.especies[especie];
        const g = genero === "cualquiera" ? alAzar(["m", "f", "n"]) : genero;
        let nombre = alAzar(e.ini) + alAzar(e[g]);
        // Los tiflin, a veces, con un nombre de virtud.
        if (especie === "tiflin" && alAzar([0, 0, 1])) {
            nombre = alAzar(datos.virtudes);
        }
        nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
        const ap = datos.apellidos[e.apellido];
        if (conApellido && ap) {
            const a = alAzar(ap.ini) + alAzar(ap.fin);
            nombre += " " + a.charAt(0).toUpperCase() + a.slice(1);
        }
        return nombre;
    }

    function lugarDe(datos, tipo) {
        const l = datos.lugares[tipo];
        if (tipo === "taberna") {
            const [sust, g] = alAzar(l.sust);
            const adj = alAzar(l.adj);
            return sust + " " + (g === "f" ? adj[1] : adj[0]);
        }
        if (tipo === "pueblo" && alAzar([0, 1])) {
            return alAzar(l.pre) + alAzar(l.adj);
        }
        return alAzar(l.base) + " " + alAzar(l.de);
    }

    // Un grupo de botones que se comportan como opciones (uno pulsado):
    // «opciones» [[valor, texto]], «alCambiar(valor)». Devuelve la caja,
    // con .valor() para leerlo.
    function botonesDe(etiqueta, opciones, valor, alCambiar) {
        const caja = crear("div", "master-opciones");
        caja.setAttribute("role", "group");
        caja.setAttribute("aria-label", etiqueta);
        let actual = valor;
        const botones = opciones.map(([v, texto]) => {
            const b = botonDe("master-opcion", texto, () => {
                actual = v;
                botones.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
                alCambiar(v);
            });
            b.setAttribute("aria-pressed", String(v === valor));
            return b;
        });
        caja.append(...botones);
        caja.valor = () => actual;
        return caja;
    }

    // Un desplegable con su etiqueta encima.
    function elegirDe(id, texto, opciones, valor) {
        const caja = crear("div", "master-campo");
        const et = crear("label", "oc-dados-etiqueta", texto);
        const x = crear("select", "master-elegir");
        x.id = id;
        et.htmlFor = x.id;
        opciones.forEach(([v, n]) => {
            const o = crear("option", "", n);
            o.value = v;
            x.appendChild(o);
        });
        x.value = valor;
        caja.append(et, x);
        caja.elegir = x;
        return caja;
    }

    function copiarTexto(texto, aviso) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(texto).then(() => avisar(aviso || "Copiado.")).catch(() => avisar("No se ha podido copiar."));
        }
    }

    // Un lugar en otro idioma: el nombre en español, sin «de», «la»…, y
    // cada palabra a una del idioma (siempre la misma, como en las notas).
    function lugarEn(nombre, idioma) {
        const sin = nombre.split(/\s+/).filter((p) => !/^(de|del|la|el|los|las|y|en)$/i.test(p)).join(" ");
        const n = inventar(sin, idioma, 3).replace(/(^|\s)(\p{Ll})/gu, (x, a, b) => a + b.toUpperCase());
        return { n, es: nombre, idioma: idioma.id };
    }

    function montarNombres(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        Promise.all([pedir(NOMBRES), pedir(IDIOMAS)]).then(([datos, lenguas]) => {
            const d = m.datos;
            const otras = lenguas.idiomas.filter((x) => x.id !== "comun");
            const lenguaDe = (id) => otras.find((x) => x.id === id);
            // Lo que sale y lo guardado: un texto, o {n, es, idioma} si es
            // un lugar en otro idioma.
            const nombreDe_ = (x) => (typeof x === "string" ? x : x.n);
            const tipos = [["personaje", "👤 personaje"]].concat(Object.keys(datos.lugares)
                .map((k) => [k, ({ pueblo: "🏘️ ", taberna: "🍺 ", region: "🏔️ ", mazmorra: "🕳️ " }[k] || "") + datos.lugares[k].nombre]));
            const que = elegirDe("master-nombres-que-" + m.id, "qué", tipos, d.que || "personaje");
            const especie = elegirDe("master-nombres-especie-" + m.id, "especie",
                Object.keys(datos.especies).map((k) => [k, datos.especies[k].nombre]), d.especie || "humano");
            const genero = botonesDe("género", [["cualquiera", "cualquiera"], ["f", "♀ femenino"], ["m", "♂ masculino"],
                ["n", "⚪ neutro"]], d.genero || "cualquiera", (v) => {
                d.genero = v;
                guardar();
            });
            const lengua = elegirDe("master-nombres-lengua-" + m.id, "en qué idioma",
                [["", "común (en español)"]].concat(otras.map((x) => [x.id, x.nombre])), d.lengua || "");
            const etAp = crear("label", "master-nombres-apellido");
            const ap = crear("input");
            ap.type = "checkbox";
            ap.checked = d.apellido !== false;
            etAp.append(ap, document.createTextNode(" con apellido"));
            const persona = crear("div", "master-nombres-persona");
            const etGen = crear("p", "oc-dados-etiqueta", "género");
            etGen.setAttribute("aria-hidden", "true");
            persona.append(especie, etAp, etGen, genero);
            const generar = botonDe("oc-vida-accion es-principal master-nombres-generar", "🎲 generar 8", () => {
                Object.assign(d, { que: que.elegir.value, especie: especie.elegir.value, genero: genero.valor(),
                    apellido: ap.checked, lengua: lengua.elegir.value });
                const salen = new Map();
                const enOtra = d.que !== "personaje" && lenguaDe(d.lengua);
                for (let i = 0; i < 40 && salen.size < 8; i++) {
                    const x = d.que === "personaje" ? nombreDe(datos, d.especie, d.genero, d.apellido)
                        : lugarDe(datos, d.que);
                    const sale = enOtra ? lugarEn(x, enOtra) : x;
                    salen.set(nombreDe_(sale), sale);
                }
                d.salen = Array.from(salen.values());
                guardar();
                pintar();
                avisar(d.salen.length + " nombres nuevos.");
            });
            const lista = crear("ul", "master-nombres");
            lista.setAttribute("aria-label", "Nombres que han salido");
            const guardadosT = crear("h3", "master-nombres-titulo", "⭐ guardados");
            const guardados = crear("ul", "master-nombres es-guardados");
            guardados.setAttribute("aria-label", "Nombres guardados");
            const fila = (x, guardado) => {
                const n = nombreDe_(x);
                const li = crear("li", "master-nombre");
                const texto = crear("span", "master-nombre-texto", n);
                const otra = typeof x === "string" ? null : lenguaDe(x.idioma);
                if (otra) {
                    const glifos = crear("span", "master-nombre-glifos es-" + otra.id, aSuAlfabeto(n, otra));
                    glifos.setAttribute("aria-hidden", "true");
                    texto.append(glifos, crear("span", "master-nombre-es", "«" + x.es + "» en " + otra.nombre.toLowerCase()));
                }
                li.appendChild(texto);
                const marcar = botonDe("master-nombre-boton", guardado ? "✕" : "☆", () => {
                    d.guardados = (d.guardados || []).filter((y) => nombreDe_(y) !== n);
                    if (!guardado) {
                        d.guardados.push(x);
                    }
                    guardar();
                    pintar();
                    avisar(guardado ? "Quitado: " + n + "." : "Guardado: " + n + ".");
                }, (guardado ? "Quitar de guardados: " : "Guardar: ") + n);
                marcar.title = guardado ? "Quitar" : "Guardar";
                const copiar = botonDe("master-nombre-boton", "⧉", () => copiarTexto(n, "Copiado: " + n + "."), "Copiar " + n);
                copiar.title = "Copiar";
                li.append(marcar, copiar);
                return li;
            };
            const pintar = () => {
                const ya = new Set((d.guardados || []).map(nombreDe_));
                lista.replaceChildren(...(d.salen || []).filter((x) => !ya.has(nombreDe_(x))).map((x) => fila(x, false)));
                if (!lista.children.length) {
                    lista.appendChild(crear("li", "oc-vacio", d.salen ? "Todos guardados. Genera más." : "Pulsa «generar»."));
                }
                guardados.replaceChildren(...(d.guardados || []).map((n) => fila(n, true)));
                guardadosT.hidden = guardados.hidden = !guardados.children.length;
            };
            const ajustar = () => {
                persona.hidden = que.elegir.value !== "personaje";
                lengua.hidden = !persona.hidden;
            };
            que.elegir.addEventListener("change", ajustar);
            const arriba = crear("div", "master-nombres-form");
            arriba.append(que, persona, lengua, generar);
            dentro.replaceChildren(arriba, lista, guardadosT, guardados);
            ajustar();
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar los nombres."));
        });
    }

    // ---- NOTAS EN OTROS IDIOMAS: se escribe (o se saca al azar) lo que
    // pone y se ve en el alfabeto de ese idioma, para enseñárselo a la
    // mesa. Los idiomas, sus letras y sus sílabas, en
    // datos/personajes/compendio/idiomas.json; las letras son fuentes Noto
    // (OFL) de escrituras reales, en tipografias/noto-*.woff2. Dos formas:
    // «letra a letra» (se puede descifrar) o «palabras inventadas» (cada
    // palabra pasa a una del idioma, siempre la misma). ----
    const IDIOMAS = "datos/personajes/compendio/idiomas.json";
    const NOTAS_AL_AZAR = [
        "Nos vemos en {taberna} cuando suene la {hora} campanada. Ven solo.",
        "{nombre} sabe lo que hiciste. Paga {numero} piezas de oro o hablará.",
        "La entrada está bajo {pueblo}. No pises la tercera losa.",
        "Aquí yace {nombre}, que entró sin llamar.",
        "Prohibido el paso. Los intrusos serán devorados.",
        "El cargamento cruza {region} dentro de {numero} días. Que nadie lo vea.",
        "Si lees esto, ya es tarde.",
        "No te fíes de {nombre}. Lleva el anillo.",
        "{nombre}: la llave está en {mazmorra}. Quema esta nota.",
        "Tres pasos al norte, dos al este, y cava.",
        "Hemos perdido a {numero}. Los túneles cambian de sitio.",
        "Por orden de {nombre}, nadie sale de {pueblo} hasta la luna nueva.",
        "Lo que duerme bajo {region} no debe despertar.",
        "Debo {numero} monedas en {taberna}. Si no vuelvo, que las pague {nombre}.",
        "Al portador: dadle cama, comida y silencio.",
        "Cuidado: el puente no aguanta a más de dos.",
        "La puerta solo se abre a quien dice su nombre verdadero.",
        "{nombre} no murió en {mazmorra}. Lo he visto en {pueblo}.",
    ];

    // Un número que sale siempre igual para el mismo texto.
    function huella(texto) {
        let h = 2166136261;
        for (let i = 0; i < texto.length; i++) {
            h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
        }
        return h >>> 0;
    }

    // Cada palabra, a una inventada con las sílabas del idioma.
    // «tope»: las sílabas que puede tener cada palabra, como mucho.
    function inventar(texto, idioma, tope) {
        return texto.replace(/[\p{L}]+/gu, (palabra) => {
            let h = huella(idioma.id + ":" + palabra.toLowerCase());
            const siguiente = () => {
                h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
                return h;
            };
            const n = Math.min(tope || 99, Math.max(1, Math.round(palabra.length / 3)));
            let sale = "";
            let antes = -1;
            for (let i = 0; i < n; i++) {
                // Sin repetir la sílaba de antes («ululul», no).
                let j = siguiente() % idioma.silabas.length;
                if (j === antes) {
                    j = (j + 1) % idioma.silabas.length;
                }
                antes = j;
                sale += idioma.silabas[j];
            }
            const mayus = palabra.charAt(0) !== palabra.charAt(0).toLowerCase();
            return mayus ? sale.charAt(0).toUpperCase() + sale.slice(1) : sale;
        });
    }

    // Las letras (a-z y ñ) a las del alfabeto del idioma.
    function aSuAlfabeto(texto, idioma) {
        if (!idioma.glifos) {
            return texto;
        }
        const glifos = Array.from(idioma.glifos);
        return Array.from(texto.replace(/ñ/gi, "\u0000").normalize("NFD").replace(/[̀-ͯ]/g, ""))
            .map((c) => {
                if (c === "\u0000") {
                    return glifos[26];
                }
                const i = c.toLowerCase().charCodeAt(0) - 97;
                return i >= 0 && i < 26 ? glifos[i] : c;
            }).join("");
    }

    function notaAlAzar(nombres) {
        const lugar = (t) => lugarDe(nombres, t);
        return alAzar(NOTAS_AL_AZAR).replace(/\{(\w+)\}/g, (x, que) => {
            if (que === "nombre") {
                return nombreDe(nombres, alAzar(Object.keys(nombres.especies)), "cualquiera", alAzar([true, false]));
            }
            if (que === "numero") {
                return String(alAzar([2, 3, 5, 7, 12, 20, 50, 100]));
            }
            if (que === "hora") {
                return alAzar(["primera", "tercera", "sexta", "novena", "duodécima"]);
            }
            return nombres.lugares[que] ? lugar(que) : x;
        });
    }

    // La nota escrita en una imagen PNG (para enseñarla o pasarla).
    function notaEnImagen(texto, idioma, familia) {
        const tam = 44;
        const fuente = tam + "px \"" + familia + "\", \"Pangolin\", sans-serif";
        return document.fonts.load(fuente, texto).then(() => {
            const lienzo = document.createElement("canvas");
            const ctx = lienzo.getContext("2d");
            ctx.font = fuente;
            const ancho = 900;
            const lineas = [];
            texto.split("\n").forEach((parrafo) => {
                let linea = "";
                parrafo.split(" ").forEach((p) => {
                    const prueba = linea ? linea + " " + p : p;
                    if (linea && ctx.measureText(prueba).width > ancho) {
                        lineas.push(linea);
                        linea = p;
                    } else {
                        linea = prueba;
                    }
                });
                lineas.push(linea);
            });
            const alto = Math.round(tam * 1.6);
            lienzo.width = ancho + 120;
            lienzo.height = lineas.length * alto + 120;
            ctx.fillStyle = "#efe2bf";
            ctx.fillRect(0, 0, lienzo.width, lienzo.height);
            ctx.strokeStyle = "#8a6a3a";
            ctx.lineWidth = 6;
            ctx.strokeRect(12, 12, lienzo.width - 24, lienzo.height - 24);
            ctx.fillStyle = "#3b2a17";
            ctx.font = fuente;
            ctx.textBaseline = "top";
            lineas.forEach((l, i) => ctx.fillText(l, 60, 60 + i * alto));
            return new Promise((hecho) => lienzo.toBlob(hecho, "image/png"));
        }).then((blob) => {
            const a = crear("a");
            const archivoBlob = URL.createObjectURL(blob);
            a.href = archivoBlob;
            a.download = "nota-" + idioma.id + ".png";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(archivoBlob), 1000);
            avisar("Descargada la imagen: " + a.download + ".");
        });
    }

    // El alfabeto de referencia de un idioma: cada letra con su símbolo.
    // El símbolo, escondido al lector de pantalla (no dice nada); la
    // letra, no.
    function claveDe(idioma, clase) {
        const lista = crear("ul", "master-idioma-clave " + clase + " es-" + idioma.id);
        lista.setAttribute("aria-label", "Alfabeto " + idioma.nombre.toLowerCase());
        const glifos = Array.from(idioma.glifos || "");
        "abcdefghijklmnopqrstuvwxyzñ".split("").forEach((letra, i) => {
            const li = crear("li", "master-idioma-letra");
            const g = crear("span", "master-idioma-glifo", glifos[i] || "");
            g.setAttribute("aria-hidden", "true");
            li.append(g, crear("span", "master-idioma-latina", letra));
            lista.appendChild(li);
        });
        return lista;
    }

    function montarIdiomas(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        Promise.all([pedir(IDIOMAS), pedir(NOMBRES)]).then(([datos, nombres]) => {
            const d = m.datos;
            const de = (id) => datos.idiomas.find((x) => x.id === id) || datos.idiomas[1];
            const idioma = elegirDe("master-idioma-que-" + m.id, "idioma",
                datos.idiomas.map((x) => [x.id, x.nombre + " (" + x.alfabeto + ")"]), de(d.idioma).id);
            const como = botonesDe("cómo se escribe", [["letras", "🔤 letra a letra"], ["inventado", "🗣️ palabras inventadas"]],
                d.como || "letras", (v) => {
                    d.como = v;
                    guardar();
                    pintar();
                });
            como.title = "Letra a letra: se puede descifrar. Palabras inventadas: cada palabra pasa a una de ese idioma.";
            const etT = crear("label", "oc-dados-etiqueta", "lo que pone");
            const texto = crear("textarea", "oc-notas-texto es-corta");
            texto.id = "master-idioma-texto-" + m.id;
            texto.rows = 3;
            texto.value = d.texto || "";
            etT.htmlFor = texto.id;
            const azar = botonDe("oc-vida-accion", "🎲 nota al azar", () => {
                texto.value = notaAlAzar(nombres);
                d.texto = texto.value;
                guardar();
                pintar();
                avisar("Nota nueva: " + texto.value);
            });
            const hoja = crear("div", "master-idioma-hoja");
            hoja.setAttribute("role", "img");
            const dice = crear("p", "master-idioma-dice");
            const ver = crear("label", "master-nombres-apellido");
            const verCaja = crear("input");
            verCaja.type = "checkbox";
            verCaja.checked = d.ver !== false;
            ver.append(verCaja, document.createTextNode(" ver lo que pone debajo"));
            const tam = d.tam || 2;
            hoja.style.setProperty("--tam", tam + "rem");
            const cambiaTam = (mas) => {
                d.tam = Math.min(4, Math.max(1, (d.tam || 2) + mas));
                hoja.style.setProperty("--tam", d.tam + "rem");
                guardar();
                avisar("Tamaño " + Math.round(d.tam * 50) + " %.");
            };
            const menos = botonDe("master-nombre-boton", "A−", () => cambiaTam(-0.25), "Letra más pequeña");
            const mas = botonDe("master-nombre-boton", "A+", () => cambiaTam(0.25), "Letra más grande");
            const escrito = () => {
                const id = de(idioma.elegir.value);
                const palabras = (d.como || "letras") === "inventado" ? inventar(texto.value, id) : texto.value;
                return { id, palabras, letras: aSuAlfabeto(palabras, id) };
            };
            const ensenar = botonDe("oc-vida-accion es-principal", "👁️ enseñar", () => {
                const e = escrito();
                const grande = crear("div", "master-idioma-hoja es-grande es-" + e.id.id);
                grande.textContent = e.letras;
                grande.setAttribute("role", "img");
                grande.setAttribute("aria-label", "Nota en " + e.id.nombre + ". Pone: " + texto.value);
                window.ocVentana.abrir({ titulo: "Nota en " + e.id.nombre.toLowerCase(), cuerpo: grande, vuelta: ensenar,
                    clase: "es-ancha" });
            }, "Enseñar la nota en grande");
            const copiar = botonDe("oc-vida-accion", "⧉ copiar", () => copiarTexto(escrito().letras, "Copiada la nota."),
                "Copiar la nota en su alfabeto");
            const imagen = botonDe("oc-vida-accion", "🖼️ imagen", () => {
                const e = escrito();
                notaEnImagen(e.letras || " ", e.id, e.id.glifos ? "Richi " + e.id.fuente : "Pangolin")
                    .catch(() => avisar("No se ha podido hacer la imagen."));
            }, "Descargar la nota como imagen");
            const clave = crear("div", "master-idioma-panel");
            clave.id = "master-idioma-clave-" + m.id;
            const verClave = botonDe("oc-vida-accion", "🔑 alfabeto", () => {
                d.clave = !d.clave;
                guardar();
                pintar();
            }, "Alfabeto de referencia");
            verClave.setAttribute("aria-controls", clave.id);
            const pintarClave = (id) => {
                verClave.hidden = !id.glifos;
                verClave.setAttribute("aria-expanded", String(!!d.clave));
                clave.hidden = !d.clave || !id.glifos;
                if (clave.hidden) {
                    clave.replaceChildren();
                    return;
                }
                const grande = botonDe("oc-vida-accion", "👁️ enseñar el alfabeto", () => {
                    window.ocVentana.abrir({ titulo: "Alfabeto " + id.nombre.toLowerCase() + " (" + id.alfabeto + ")",
                        cuerpo: claveDe(id, "es-grande"), vuelta: grande, clase: "es-ancha" });
                });
                clave.replaceChildren(claveDe(id, ""), grande);
                if (Array.from(new Set(Array.from(id.glifos))).length < 27) {
                    clave.insertBefore(crear("p", "oc-hoja-nota", "Este alfabeto tiene menos símbolos: algunas letras comparten el mismo."),
                        grande);
                }
            };
            const pintar = () => {
                const e = escrito();
                pintarClave(e.id);
                hoja.className = "master-idioma-hoja es-" + e.id.id;
                hoja.textContent = e.letras || "…";
                hoja.setAttribute("aria-label", "Nota en " + e.id.nombre + " (" + e.id.alfabeto + "). Pone: " +
                    (texto.value || "nada todavía"));
                dice.replaceChildren();
                if (verCaja.checked && texto.value) {
                    dice.append(crear("strong", "", "Pone: "), document.createTextNode(texto.value));
                    if (e.palabras !== texto.value) {
                        dice.append(crear("br"), crear("strong", "", "Suena: "), document.createTextNode(e.palabras));
                    }
                }
                dice.hidden = !dice.childNodes.length;
            };
            let espera = 0;
            texto.addEventListener("input", () => {
                pintar();
                clearTimeout(espera);
                espera = setTimeout(() => {
                    d.texto = texto.value;
                    guardar();
                }, 400);
            });
            idioma.elegir.addEventListener("change", () => {
                d.idioma = idioma.elegir.value;
                guardar();
                pintar();
            });
            verCaja.addEventListener("change", () => {
                d.ver = verCaja.checked;
                guardar();
                pintar();
            });
            const arriba = crear("div", "master-nombres-form");
            arriba.append(idioma, como);
            const escribir = crear("div", "master-idioma-escribir");
            escribir.append(etT, texto, azar);
            const tamanos = crear("div", "master-idioma-tam");
            tamanos.setAttribute("role", "group");
            tamanos.setAttribute("aria-label", "Tamaño de la letra");
            tamanos.append(menos, mas);
            const botones = crear("div", "master-idioma-botones");
            botones.append(ensenar, copiar, imagen, verClave, tamanos);
            dentro.replaceChildren(arriba, escribir, hoja, ver, dice, botones, clave);
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar los idiomas."));
        });
    }

    // ---- BOTÍN Y ENCUENTROS: generadores PROPIOS (las tablas de la DMG y
    // la Xanathar's no son del SRD). Las monedas, gemas y obras de arte,
    // en tablas inventadas aquí; los objetos mágicos y los monstruos, del
    // SRD (tienda.json y bestiario.json). ----
    const TIENDA = "datos/personajes/compendio/tienda.json";
    const BESTIARIO = "datos/personajes/compendio/bestiario.json";
    const FRANJAS = [["0", "VD 0–4"], ["1", "VD 5–10"], ["2", "VD 11–16"], ["3", "VD 17 o más"]];

    // «3d6» a un número, sin pasar por el registro de tiradas.
    function tiradaSuelta(formula) {
        const m = /^(\d+)d(\d+)$/.exec(formula);
        if (!m) {
            return parseInt(formula, 10) || 0;
        }
        const u = new Uint32Array(parseInt(m[1], 10));
        crypto.getRandomValues(u);
        return Array.from(u).reduce((t, x) => t + (x % parseInt(m[2], 10)) + 1, 0);
    }

    // Monedas: [moneda, dados, por cuánto se multiplica], por franja.
    const BOTIN_MONEDAS = {
        uno: [[["pp", "3d6", 1], ["po", "1d6", 1]], [["pp", "2d6", 10], ["po", "4d6", 1]],
            [["po", "2d6", 10], ["ppt", "1d6", 1]], [["po", "4d6", 10], ["ppt", "2d6", 1]]],
        tesoro: [[["pc", "2d6", 100], ["pp", "2d6", 100], ["po", "2d6", 20]],
            [["pp", "2d6", 100], ["po", "4d6", 100], ["ppt", "1d6", 10]],
            [["po", "4d6", 500], ["ppt", "2d6", 50]], [["po", "6d6", 2000], ["ppt", "4d6", 500]]],
    };
    const BOTIN_GEMAS = {
        10: ["ágata", "cuarzo azul", "hematites", "lapislázuli", "malaquita", "obsidiana", "ojo de tigre", "turquesa"],
        50: ["calcedonia", "citrino", "cornalina", "jaspe sanguíneo", "ónice", "piedra de luna", "cuarzo rosa", "circón"],
        100: ["ámbar", "amatista", "coral rojo", "granate", "jade", "perla", "espinela", "turmalina"],
        500: ["aguamarina", "alejandrita", "perla negra", "peridoto", "topacio dorado", "espinela azul"],
        1000: ["ópalo negro", "ópalo de fuego", "zafiro azul", "esmeralda", "zafiro estrella", "rubí estrella"],
        5000: ["diamante", "rubí sangre", "zafiro negro", "jacinto", "esmeralda sin defecto"],
    };
    const BOTIN_ARTE = {
        25: ["un aguamanil de cobre con asas de serpiente", "una baraja de naipes pintados a mano",
            "un espejo de mano con marco de plata", "una figurita de hueso tallado de un búho", "un par de dados de marfil",
            "un incensario de latón", "un pañuelo de seda bordado", "una pipa de brezo con boquilla de ámbar"],
        250: ["una copa de plata con incrustaciones de ámbar", "un tapiz pequeño de una cacería",
            "un broche de oro con forma de hoja", "una caja de música de nogal", "una máscara ceremonial de bronce",
            "un catalejo de latón grabado", "un anillo de sello de oro", "un cuadro al óleo de un puerto"],
        750: ["una corona de plata con perlas", "un cáliz de oro con granates", "una daga ceremonial con empuñadura de jade",
            "un tablero de ajedrez de ébano y marfil", "un collar de cuentas de amatista",
            "una estatuilla de oro de un dragón dormido"],
        2500: ["un brazalete de platino con zafiros", "un ídolo de jade del tamaño de un puño",
            "una diadema de oro con esmeraldas", "un relicario de oro con un retrato en miniatura",
            "un tapiz enorme tejido con hilo de oro"],
        7500: ["una corona de oro con rubíes", "un cetro de platino con un diamante en la punta",
            "una armadura ceremonial dorada, de adorno", "una estatua de mithral de una diosa",
            "un huevo de oro con joyas incrustadas"],
    };
    // En un tesoro, por franja: cuántas gemas u obras de arte, de qué
    // valores, y cuántos objetos mágicos y de qué rareza (con su peso).
    const BOTIN_TESORO = [
        { cuantas: "1d4", gemas: [10, 50], arte: [25], magicos: "1d4", menos: 1,
            rarezas: [["común", 30], ["poco común", 70]] },
        { cuantas: "1d6", gemas: [50, 100], arte: [250], magicos: "1d4", menos: 0,
            rarezas: [["poco común", 55], ["rara", 40], ["muy rara", 5]] },
        { cuantas: "1d6", gemas: [500, 1000], arte: [750, 2500], magicos: "1d4", menos: -1,
            rarezas: [["poco común", 20], ["rara", 50], ["muy rara", 25], ["legendaria", 5]] },
        { cuantas: "2d4", gemas: [1000, 5000], arte: [2500, 7500], magicos: "1d6", menos: -1,
            rarezas: [["rara", 25], ["muy rara", 45], ["legendaria", 30]] },
    ];
    const VALOR_MONEDA = { pc: 1, pp: 10, pe: 50, po: 100, ppt: 1000 };

    function conPeso(lista) {
        const total = lista.reduce((t, x) => t + x[1], 0);
        let r = tiradaSuelta("1d" + total);
        for (const [x, p] of lista) {
            r -= p;
            if (r <= 0) {
                return x;
            }
        }
        return lista[0][0];
    }

    function hacerBotin(objetos, franja, tipo) {
        const sale = { monedas: [], cosas: [], objetos: [] };
        BOTIN_MONEDAS[tipo][franja].forEach(([k, dados, por]) => {
            sale.monedas.push([k, tiradaSuelta(dados) * por]);
        });
        const t = BOTIN_TESORO[franja];
        const magicos = objetos.filter((o) => o.rareza && o.rareza !== "artefacto");
        const unObjeto = () => {
            const rareza = conPeso(t.rarezas);
            const de = magicos.filter((o) => o.rareza === rareza);
            return de.length ? alAzar(de).en : null;
        };
        if (tipo === "tesoro") {
            const que = tiradaSuelta("1d6");
            if (que >= 3) {
                const gemas = que <= 4;
                const valor = alAzar(gemas ? t.gemas : t.arte);
                const n = tiradaSuelta(t.cuantas);
                const lista = (gemas ? BOTIN_GEMAS : BOTIN_ARTE)[valor];
                const cuantas = {};
                for (let i = 0; i < n; i++) {
                    const x = alAzar(lista);
                    cuantas[x] = (cuantas[x] || 0) + 1;
                }
                Object.keys(cuantas).forEach((x) => sale.cosas.push({ que: gemas ? "gema" : "arte", texto: x, n: cuantas[x], valor }));
            }
            const n = Math.max(0, tiradaSuelta(t.magicos) - t.menos);
            for (let i = 0; i < n; i++) {
                const o = unObjeto();
                if (o) {
                    sale.objetos.push(o);
                }
            }
        } else if (tiradaSuelta("1d20") === 20) {
            // Uno de cada veinte lleva encima algo mágico.
            const o = unObjeto();
            if (o) {
                sale.objetos.push(o);
            }
        }
        return sale;
    }

    function montarBotin(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        pedir(TIENDA).then((tienda) => {
            const d = m.datos;
            const porEn = {};
            tienda.objetos.forEach((o) => {
                porEn[o.en] = o;
            });
            const franja = elegirDe("master-botin-franja-" + m.id, "de quién (su valor de desafío)", FRANJAS, d.franja || "0");
            const tipo = botonesDe("qué", [["uno", "👤 lo que lleva encima uno"], ["tesoro", "💎 un tesoro"]], d.tipo || "tesoro",
                (v) => {
                    d.tipo = v;
                    guardar();
                });
            const sale = crear("div", "master-botin");
            sale.setAttribute("aria-live", "polite");
            const texto = () => {
                const r = d.sale;
                const lineas = [];
                if (!r) {
                    return "";
                }
                lineas.push("Monedas: " + r.monedas.filter((x) => x[1]).map((x) => x[1].toLocaleString("es-ES") + " " + x[0]).join(", "));
                r.cosas.forEach((c) => lineas.push((c.n > 1 ? c.n + " × " : "") + c.texto + " (" + c.valor.toLocaleString("es-ES") +
                    " po" + (c.n > 1 ? " cada " + (c.que === "gema" ? "una" : "uno") : "") + ")"));
                r.objetos.forEach((en) => lineas.push((porEn[en] || { nombre: en }).nombre));
                return lineas.join("\n");
            };
            const pintar = () => {
                const r = d.sale;
                sale.replaceChildren();
                if (!r) {
                    sale.appendChild(crear("p", "oc-vacio", "Elige y pulsa «generar»."));
                    return;
                }
                const lista = crear("ul", "master-botin-lista");
                const monedas = r.monedas.filter((x) => x[1]);
                const li = crear("li", "master-botin-cosa es-monedas");
                li.append(crear("span", "master-botin-icono", "🪙"), crear("span", "",
                    monedas.map((x) => x[1].toLocaleString("es-ES") + " " + x[0]).join(" · ")));
                li.querySelector("span:last-child").setAttribute("aria-label", "Monedas: " + monedas.map((x) =>
                    x[1].toLocaleString("es-ES") + " " + (MONEDAS.find((y) => y[0] === x[0]) || [0, x[0]])[1]).join(", "));
                lista.appendChild(li);
                r.cosas.forEach((c) => {
                    const x = crear("li", "master-botin-cosa");
                    x.append(crear("span", "master-botin-icono", c.que === "gema" ? "💎" : "🏺"),
                        crear("span", "", (c.n > 1 ? c.n + " × " : "") + c.texto),
                        crear("span", "master-botin-valor", c.valor.toLocaleString("es-ES") + " po" + (c.n > 1 ? " c/u" : "")));
                    lista.appendChild(x);
                });
                r.objetos.forEach((en) => {
                    const o = porEn[en];
                    if (!o) {
                        return;
                    }
                    const x = crear("li", "master-botin-cosa es-magico");
                    const b = botonDe("master-botin-objeto", o.nombre, () => abrirObjeto(o, b, tienda.fuente), "Ver " + o.nombre);
                    x.append(crear("span", "master-botin-icono", "✨"), b, crear("span", "master-botin-valor", o.rareza));
                    lista.appendChild(x);
                });
                let total = monedas.reduce((t, x) => t + x[1] * VALOR_MONEDA[x[0]], 0) / 100;
                r.cosas.forEach((c) => {
                    total += c.n * c.valor;
                });
                sale.append(lista, crear("p", "master-botin-total", "Monedas, gemas y arte: unas " +
                    Math.round(total).toLocaleString("es-ES") + " po" + (r.objetos.length ? ", más " + r.objetos.length +
                    (r.objetos.length > 1 ? " objetos mágicos." : " objeto mágico.") : ".")));
            };
            const generar = botonDe("oc-vida-accion es-principal master-nombres-generar", "🎲 generar botín", () => {
                d.franja = franja.elegir.value;
                d.tipo = tipo.valor();
                d.sale = hacerBotin(tienda.objetos, parseInt(d.franja, 10), d.tipo);
                guardar();
                pintar();
                avisar("Botín nuevo: " + texto().replace(/\n/g, ". ") + ".");
            });
            const copiar = botonDe("oc-vida-accion", "⧉ copiar", () => copiarTexto(texto(), "Copiado el botín."), "Copiar el botín");
            const arriba = crear("div", "master-nombres-form");
            arriba.append(franja, tipo, generar);
            dentro.replaceChildren(arriba, sale, copiar,
                crear("p", "oc-hoja-nota master-fuente", "Monedas, gemas y arte: tablas propias. Objetos: SRD 5.2 (CC BY 4.0)."));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar los objetos."));
        });
    }

    // ENCUENTROS: monstruos del SRD de un hábitat que quepan en lo que
    // aguanta la party. El presupuesto, una cuenta propia: por cada PJ,
    // los PX de un monstruo de VD igual a su nivel, por 0,25 (bajo), 0,4
    // (moderado) o 0,6 (alto).
    const DIFICULTADES = [["baja", "baja", 0.25], ["moderada", "moderada", 0.4], ["alta", "alta", 0.6]];
    const QUE_HACEN = ["acampando alrededor de una hoguera", "de caza", "peleándose entre ellos", "persiguiendo a alguien",
        "vigilando algo que no quieren que se vea", "durmiendo (casi todos)", "de paso, sin prisa", "preparando una emboscada",
        "huyendo de algo peor", "repartiéndose un botín", "perdidos", "buscando a los PJ"];
    // Los PX de un monstruo de VD 1 a 20 (los de sus perfiles del SRD).
    const PX_POR_VD = [200, 450, 700, 1100, 1800, 2300, 2900, 3900, 5000, 5900, 7200, 8400, 10000, 11500, 13000, 15000, 18000,
        20000, 22000, 25000];
    const pxDe = (b) => {
        const m = /\(([\d.]+) PX/.exec(b.vd || "");
        return m ? parseInt(m[1].replace(/\./g, ""), 10) : 0;
    };
    const vdNum = (vd) => (vd.indexOf("/") >= 0 ? 1 / parseInt(vd.split("/")[1], 10) : parseFloat(vd));

    // Lo que aguanta cada PJ según su nivel (baja, moderada, alta).
    const PX_PJ = [[50, 75, 100], [100, 150, 200], [150, 225, 400], [250, 375, 500], [500, 750, 1100], [600, 1000, 1400],
        [750, 1300, 1700], [1000, 1700, 2100], [1300, 2000, 2600], [1600, 2300, 3100], [1900, 2900, 4100], [2200, 3700, 4700],
        [2600, 4200, 5400], [2900, 4900, 6200], [3300, 5400, 7800], [3800, 6100, 9800], [4500, 7200, 11700], [5000, 8700, 14200],
        [5500, 10700, 17200], [6400, 13200, 22000]];
    const presupuestosDe = (niveles) => [0, 1, 2].map((i) => niveles.reduce((t, n) => t + PX_PJ[Math.min(20, Math.max(1, n)) - 1][i], 0));
    function hacerEncuentro(bichos, habitat, nivel, pjs, factor, fijo) {
        const presupuesto = fijo || Math.round(pjs * PX_POR_VD[Math.min(20, Math.max(1, nivel)) - 1] * factor);
        const de = bichos.filter((b) => pxDe(b) && (habitat === "" || (b.habitat || []).some((h) => h === habitat || h === "cualquiera"))
            && vdNum(b.cr) <= nivel + 3);
        const grupos = [];
        let queda = presupuesto;
        for (let intento = 0; intento < 2 && queda > presupuesto * 0.15; intento++) {
            const minimo = intento ? 0 : presupuesto * 0.2;
            const caben = de.filter((b) => pxDe(b) <= queda && pxDe(b) >= minimo && !grupos.some((g) => g.en === b.en));
            if (!caben.length) {
                break;
            }
            const b = alAzar(caben);
            const n = tiradaSuelta("1d" + Math.min(6, Math.floor(queda / pxDe(b))));
            grupos.push({ en: b.en, n });
            queda -= n * pxDe(b);
        }
        return { presupuesto, grupos, hacen: alAzar(QUE_HACEN) };
    }

    function montarEncuentros(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        pedir(BESTIARIO).then((datos) => {
            const d = m.datos;
            const bichos = datos.monstruos;
            const porEn = {};
            bichos.forEach((b) => {
                porEn[b.en] = b;
            });
            const habitats = Array.from(new Set(bichos.flatMap((b) => b.habitat || []))).filter((h) => h !== "cualquiera")
                .sort((a, b) => a.localeCompare(b, "es"));
            const habitat = elegirDe("master-encuentro-habitat-" + m.id, "dónde",
                [["", "cualquier sitio"]].concat(habitats.map((h) => [h, h])), d.habitat || "");
            const enParty = estado.modulos.filter((x) => x.tipo === "party")
                .reduce((t, x) => t + ((x.datos && x.datos.pjs) || []).length, 0);
            const numero = (id, texto, valor, min, max) => {
                const caja = crear("div", "master-campo");
                const et = crear("label", "oc-dados-etiqueta", texto);
                const x = crear("input", "master-elegir");
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
            const nivel = numero("master-encuentro-nivel-", "nivel de la party", d.nivel || 3, 1, 20);
            const pjs = numero("master-encuentro-pjs-", "cuántos PJ" + (enParty ? " (en la party hay " + enParty + ")" : ""),
                d.pjs || enParty || 4, 1, 10);
            const fila = crear("div", "master-encuentro-fila");
            fila.append(nivel, pjs);
            // Con la party de la campaña: sus niveles de verdad.
            const nivelesParty = () => (todo.pjs || []).map((pj) => numPj(pj.nivel) || 1);
            const conParty = crear("label", "master-encuentro-party");
            const conPartyC = crear("input");
            conPartyC.type = "checkbox";
            conPartyC.checked = d.conParty !== undefined ? !!d.conParty : nivelesParty().length > 0;
            const conPartyT = crear("span");
            conParty.append(conPartyC, conPartyT);
            const pintarParty = () => {
                const nv = nivelesParty();
                conPartyC.disabled = !nv.length;
                if (!nv.length) {
                    conPartyC.checked = false;
                }
                conPartyT.textContent = nv.length ? " con la party de la campaña (" + nv.length + " PJ, niveles " + nv.join(", ") + ")"
                    : " con la party de la campaña (no hay nadie todavía)";
                fila.hidden = conPartyC.checked;
            };
            conPartyC.addEventListener("change", () => {
                d.conParty = conPartyC.checked;
                guardar();
                pintarParty();
            });
            pintarParty();
            mientrasEste(dentro, "master:pjs", pintarParty);
            const dificultad = botonesDe("dificultad", DIFICULTADES.map((x) => [x[0], x[1]]), d.dificultad || "moderada", (v) => {
                d.dificultad = v;
                guardar();
            });
            const etDif = crear("p", "oc-dados-etiqueta", "dificultad");
            etDif.setAttribute("aria-hidden", "true");
            const sale = crear("div", "master-botin");
            sale.setAttribute("aria-live", "polite");
            const pintar = () => {
                const r = d.sale;
                sale.replaceChildren();
                if (!r) {
                    sale.appendChild(crear("p", "oc-vacio", "Elige y pulsa «generar»."));
                    return;
                }
                if (!r.grupos.length) {
                    sale.appendChild(crear("p", "oc-vacio", "No cabe ningún monstruo de ese sitio. Prueba con otro o sube la dificultad."));
                    return;
                }
                const lista = crear("ul", "master-botin-lista");
                let px = 0;
                r.grupos.forEach((g) => {
                    const b = porEn[g.en];
                    if (!b) {
                        return;
                    }
                    px += g.n * pxDe(b);
                    const li = crear("li", "master-botin-cosa");
                    const ver = botonDe("master-botin-objeto", (g.n > 1 ? g.n + " × " : "") + b.nombre, () => abrirBicho(b, ver, datos.fuente),
                        "Ver " + b.nombre);
                    li.append(tokenDe(b), ver, crear("span", "master-botin-valor", "VD " + b.cr + " · " +
                        (g.n * pxDe(b)).toLocaleString("es-ES") + " PX"));
                    lista.appendChild(li);
                });
                const todos = botonDe("oc-vida-accion es-principal", "⚔️ todos a la iniciativa", () => {
                    const entran = [];
                    r.grupos.forEach((g) => {
                        const b = porEn[g.en];
                        for (let i = 0; i < g.n && b; i++) {
                            entran.push(meterEnIniciativa(iniDeBicho(b),
                                (nombres, renombrar) => conNumero(b.nombre, nombres, renombrar)));
                        }
                    });
                    avisar("A la iniciativa: " + entran.filter(Boolean).join(", ") + ".");
                });
                // Qué tal le va a la party de verdad (si la hay).
                const nv = nivelesParty();
                let cuanDificil = "";
                if (nv.length) {
                    const [baja, mod, alta] = presupuestosDe(nv);
                    cuanDificil = " Para tu party (" + nv.length + " PJ): " + (px <= baja ? "baja" : px <= mod ? "moderada" : px <= alta
                        ? "alta" : "más que alta, ¡ojo!") + " (baja " + baja.toLocaleString("es-ES") + " · moderada "
                        + mod.toLocaleString("es-ES") + " · alta " + alta.toLocaleString("es-ES") + ").";
                }
                const darPxB = botonDe("oc-vida-accion", "🏆 dar sus PX a la party", () => darPx(px, null, darPxB),
                    "Repartir los " + px.toLocaleString("es-ES") + " PX de este encuentro entre la party");
                darPxB.hidden = !nv.length;
                const botonesE = crear("div", "master-creador-barra");
                botonesE.append(todos, darPxB);
                sale.append(crear("p", "master-encuentro-hacen", "Están " + r.hacen + "."), lista,
                    crear("p", "master-botin-total", px.toLocaleString("es-ES") + " PX de " +
                        r.presupuesto.toLocaleString("es-ES") + " que aguanta la party." + cuanDificil), botonesE);
            };
            const generar = botonDe("oc-vida-accion es-principal master-nombres-generar", "🎲 generar encuentro", () => {
                d.habitat = habitat.elegir.value;
                d.nivel = Math.min(20, Math.max(1, parseInt(nivel.elegir.value, 10) || 1));
                d.pjs = Math.min(10, Math.max(1, parseInt(pjs.elegir.value, 10) || 1));
                d.dificultad = dificultad.valor();
                const f = (DIFICULTADES.find((x) => x[0] === d.dificultad) || DIFICULTADES[1])[2];
                const nv = conPartyC.checked ? nivelesParty() : [];
                const iDif = Math.max(0, DIFICULTADES.findIndex((x) => x[0] === d.dificultad));
                d.sale = nv.length ? hacerEncuentro(bichos, d.habitat, Math.round(nv.reduce((a, b) => a + b, 0) / nv.length), nv.length, f,
                    presupuestosDe(nv)[iDif]) : hacerEncuentro(bichos, d.habitat, d.nivel, d.pjs, f);
                guardar();
                pintar();
                avisar(d.sale.grupos.length ? "Encuentro: " + d.sale.grupos.map((g) => g.n + " " + (porEn[g.en] || {}).nombre)
                    .join(" y ") + ", " + d.sale.hacen + "." : "No cabe ningún monstruo.");
            });
            const arriba = crear("div", "master-nombres-form");
            arriba.append(habitat, conParty, fila, etDif, dificultad, generar);
            dentro.replaceChildren(arriba, sale, crear("p", "oc-hoja-nota master-fuente",
                "Monstruos: SRD 5.2 (CC BY 4.0). La dificultad, con la party, según los PX que aguanta cada PJ por su nivel; sin ella, una cuenta"
                + " propia aproximada."));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar el bestiario."));
        });
    }

    // ---- EL DIBUJO: un Paint con capas. A la izquierda, las
    // herramientas (lápiz, goma, bote, seleccionar y mover, cuentagotas,
    // línea, rectángulo y elipse), los colores (los de siempre y uno a
    // elegir) y los grosores; en medio, el lienzo; a la derecha, las capas
    // y carpetas (como el Photoshop) y la rejilla de rol.
    //
    // Cómo va: cada capa es un <canvas> de DIBUJO_ANCHO × DIBUJO_ALTO,
    // transparente; lo que se ve es «vista», que pinta el papel y encima
    // las capas visibles (de abajo arriba). Lo que se está haciendo (la
    // selección, la línea que aún no se ha soltado, la rejilla) va en
    // «encima», otro canvas pegado sobre la vista, que es el que recibe
    // el ratón o el dedo. Se guarda en m.datos: «capas» (el árbol: capas
    // y carpetas, la de arriba primero; cada capa con su imagen WebP),
    // «activa», «rejilla» y las herramientas. ----
    const DIBUJO_ANCHO = 1000;
    const DIBUJO_ALTO = 750;
    const DIBUJO_PAPEL = "#fdfaf0";
    const DIBUJO_COLORES = [["#1d1b26", "negro"], ["#ffffff", "blanco"], ["#c62828", "rojo"], ["#1565c0", "azul"],
        ["#2e7d32", "verde"], ["#ef6c00", "naranja"], ["#6a1b9a", "morado"], ["#8d6e63", "marrón"], ["#fdd835", "amarillo"],
        ["#9e9e9e", "gris"]];
    // [id, emoji, nombre, tecla]
    const DIBUJO_HERRAMIENTAS = [["lapiz", "✏️", "Lápiz", "b"], ["goma", "🧽", "Goma", "e"], ["bote", "🪣", "Bote de pintura", "g"],
        ["seleccionar", "⬚", "Seleccionar y mover", "m"], ["cuentagotas", "💧", "Cuentagotas (coger un color)", "i"],
        ["linea", "╱", "Línea recta", "l"], ["rectangulo", "▭", "Rectángulo", "u"], ["elipse", "◯", "Elipse", "o"],
        ["texto", "T", "Texto", "t"]];
    const DIBUJO_FUENTES = [["Pangolin", "a mano"], ["Space Grotesk", "normal"], ["Georgia, serif", "con serifa"],
        ["DM Mono", "de máquina"], ["Jersey 10", "de píxeles"]];

    // Solo imágenes metidas en la propia dirección (data:image/…): lo
    // único que lee el dibujo (lo que guarda él y los archivos que se
    // pegan). Cualquier otra cosa, nada.
    function imagenSegura(url) {
        return /^data:image\/(png|jpeg|gif|webp|bmp|svg\+xml|avif);base64,[A-Za-z0-9+/=]+$/.test(String(url || "")) ? url : "";
    }

    function lienzoNuevo(ancho, alto) {
        const c = document.createElement("canvas");
        c.width = ancho || DIBUJO_ANCHO;
        c.height = alto || DIBUJO_ALTO;
        return c;
    }

    // «#rrggbb» a [r, g, b].
    const rgbDe = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

    // EL BOTE: rellena la zona del mismo color (con algo de margen) que
    // hay alrededor del punto, en los píxeles de «datos» (ImageData).
    function rellenar(datos, x, y, color, margen) {
        const w = datos.width;
        const h = datos.height;
        const px = datos.data;
        const i0 = (y * w + x) * 4;
        const base = [px[i0], px[i0 + 1], px[i0 + 2], px[i0 + 3]];
        const [r, g, b] = rgbDe(color);
        if (base[0] === r && base[1] === g && base[2] === b && base[3] === 255) {
            return false;
        }
        margen = margen === undefined ? 40 : margen;
        const igual = (i) => Math.abs(px[i] - base[0]) <= margen && Math.abs(px[i + 1] - base[1]) <= margen &&
            Math.abs(px[i + 2] - base[2]) <= margen && Math.abs(px[i + 3] - base[3]) <= margen;
        const hecho = new Uint8Array(w * h);
        const pila = [[x, y]];
        while (pila.length) {
            let [cx, cy] = pila.pop();
            while (cx >= 0 && !hecho[cy * w + cx] && igual((cy * w + cx) * 4)) {
                cx--;
            }
            cx++;
            let arriba = false;
            let abajo = false;
            while (cx < w && !hecho[cy * w + cx] && igual((cy * w + cx) * 4)) {
                const i = (cy * w + cx) * 4;
                px[i] = r;
                px[i + 1] = g;
                px[i + 2] = b;
                px[i + 3] = 255;
                hecho[cy * w + cx] = 1;
                if (cy > 0) {
                    const sigue = !hecho[(cy - 1) * w + cx] && igual(((cy - 1) * w + cx) * 4);
                    if (sigue && !arriba) {
                        pila.push([cx, cy - 1]);
                    }
                    arriba = sigue;
                }
                if (cy < h - 1) {
                    const sigue = !hecho[(cy + 1) * w + cx] && igual(((cy + 1) * w + cx) * 4);
                    if (sigue && !abajo) {
                        pila.push([cx, cy + 1]);
                    }
                    abajo = sigue;
                }
                cx++;
            }
        }
        return true;
    }

    // LA REJILLA: cuadrada o de hexágonos, con su tamaño de casilla.
    function pintarRejilla(ctx, r) {
        const t = Math.max(10, parseInt(r.tam, 10) || 50);
        ctx.save();
        ctx.globalAlpha = Math.min(1, Math.max(0.05, (parseInt(r.opacidad, 10) || 40) / 100));
        ctx.strokeStyle = /^#[0-9a-f]{6}$/i.test(r.color || "") ? r.color : "#000000";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (r.tipo === "hex") {
            // Hexágonos con la punta arriba, de «t» de ancho.
            const radio = t / Math.sqrt(3);
            const alto = radio * 1.5;
            for (let fila = -1; fila * alto < ctx.canvas.height + alto; fila++) {
                for (let col = -1; col * t < ctx.canvas.width + t; col++) {
                    const cx = col * t + (fila % 2 ? t / 2 : 0);
                    const cy = fila * alto;
                    for (let k = 0; k <= 6; k++) {
                        const a = Math.PI / 180 * (60 * k - 90);
                        const x = cx + radio * Math.cos(a);
                        const y = cy + radio * Math.sin(a);
                        if (k) {
                            ctx.lineTo(x, y);
                        } else {
                            ctx.moveTo(x, y);
                        }
                    }
                }
            }
        } else {
            for (let x = 0; x <= ctx.canvas.width; x += t) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, ctx.canvas.height);
            }
            for (let y = 0; y <= ctx.canvas.height; y += t) {
                ctx.moveTo(0, y);
                ctx.lineTo(ctx.canvas.width, y);
            }
        }
        ctx.stroke();
        ctx.restore();
    }

    function montarDibujo(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        // El tamaño del lienzo (se puede cambiar: «tamaño del lienzo»).
        let ANCHO = Math.min(3000, Math.max(200, parseInt(d.ancho, 10) || DIBUJO_ANCHO));
        let ALTO = Math.min(3000, Math.max(200, parseInt(d.alto, 10) || DIBUJO_ALTO));
        let cuenta = 1;
        const nuevoId = () => "c" + Date.now().toString(36) + (cuenta++);
        // Lo de antes (una sola imagen): pasa a ser la primera capa.
        if (!Array.isArray(d.capas)) {
            d.capas = [{ id: nuevoId(), tipo: "capa", nombre: "capa 1", visible: true, opacidad: 100, imagen: d.imagen || "" }];
            delete d.imagen;
        }
        d.rejilla = Object.assign({ ver: false, tipo: "cuadrada", tam: 50, color: "#000000", opacidad: 40, bajar: false },
            d.rejilla || {});
        // Todo lo del árbol, recorrido: [nodo, lista en la que está, padre].
        const recorrer = (f, lista = d.capas, padre = null) => {
            for (const n of lista) {
                if (f(n, lista, padre) === false) {
                    return false;
                }
                if (n.tipo === "carpeta" && recorrer(f, n.hijos, n) === false) {
                    return false;
                }
            }
            return true;
        };
        const buscar = (id) => {
            let sale = null;
            recorrer((n, lista, padre) => {
                if (n.id === id) {
                    sale = { n, lista, padre };
                    return false;
                }
                return true;
            });
            return sale;
        };
        const lienzos = {};
        recorrer((n) => {
            if (n.tipo === "carpeta") {
                n.hijos = n.hijos || [];
            } else {
                lienzos[n.id] = lienzoNuevo(ANCHO, ALTO);
            }
        });
        let activa = buscar(d.activa) ? d.activa : null;
        if (!activa) {
            recorrer((n) => {
                if (n.tipo === "capa") {
                    activa = n.id;
                    return false;
                }
                return true;
            });
        }

        // LOS DOS LIENZOS: la vista y lo de encima.
        const marco = crear("div", "master-dibujo-marco");
        const vista = lienzoNuevo(ANCHO, ALTO);
        vista.className = "master-dibujo";
        const encima = lienzoNuevo(ANCHO, ALTO);
        encima.className = "master-dibujo-encima";
        encima.tabIndex = 0;
        encima.setAttribute("role", "img");
        marco.append(vista, encima);
        const cv = vista.getContext("2d");
        const ce = encima.getContext("2d");
        const etiqueta = () => {
            encima.setAttribute("aria-label", "Dibujo" + (d.desc ? ": " + d.desc : " (sin descripción)") +
                ". Se dibuja con el ratón, el dedo o un lápiz; Ctrl+V pega una imagen.");
        };
        etiqueta();

        let herramienta = DIBUJO_HERRAMIENTAS.some((h) => h[0] === d.herramienta) ? d.herramienta : "lapiz";
        let color = /^#[0-9a-f]{6}$/i.test(d.color || "") ? d.color : DIBUJO_COLORES[0][0];
        let grosor = parseInt(d.grosor, 10) || 8;
        let sel = null; // {x, y, w, h}
        let flotante = null; // {lienzo, x, y, w, h}: lo seleccionado, levantado
        let figura = null; // la línea o la figura que aún no se ha soltado

        // Lo que se ve: el papel y las capas visibles (de abajo arriba).
        const componer = (ctx, conFlotante) => {
            ctx.globalAlpha = 1;
            ctx.fillStyle = DIBUJO_PAPEL;
            ctx.fillRect(0, 0, ANCHO, ALTO);
            const pintar = (lista, alfa) => {
                for (let i = lista.length - 1; i >= 0; i--) {
                    const n = lista[i];
                    if (!n.visible) {
                        continue;
                    }
                    const a = alfa * (n.opacidad === undefined ? 1 : n.opacidad / 100);
                    if (n.tipo === "carpeta") {
                        pintar(n.hijos, a);
                        continue;
                    }
                    ctx.globalAlpha = a;
                    ctx.drawImage(lienzos[n.id], 0, 0);
                    if (conFlotante && flotante && n.id === activa) {
                        ctx.drawImage(flotante.lienzo, flotante.x, flotante.y, flotante.w, flotante.h);
                    }
                }
            };
            pintar(d.capas, 1);
            ctx.globalAlpha = 1;
        };
        // Lo de encima: la rejilla, la figura a medias y la selección.
        const pintarEncima = () => {
            ce.clearRect(0, 0, ANCHO, ALTO);
            if (d.rejilla.ver) {
                pintarRejilla(ce, d.rejilla);
            }
            if (figura) {
                trazarFigura(ce, figura);
            }
            if (sel) {
                ce.save();
                ce.lineWidth = 2;
                ce.setLineDash([8, 6]);
                ce.strokeStyle = "#000000";
                ce.strokeRect(sel.x, sel.y, sel.w, sel.h);
                ce.lineDashOffset = 7;
                ce.strokeStyle = "#ffffff";
                ce.strokeRect(sel.x, sel.y, sel.w, sel.h);
                // Las asas para cambiar el tamaño.
                if (herramienta === "seleccionar") {
                    const t = tolerancia() * 0.9;
                    ce.setLineDash([]);
                    ce.lineWidth = 2;
                    asas().forEach(([, x, y]) => {
                        ce.fillStyle = "#ffffff";
                        ce.fillRect(x - t / 2, y - t / 2, t, t);
                        ce.strokeStyle = "#000000";
                        ce.strokeRect(x - t / 2, y - t / 2, t, t);
                    });
                }
                ce.restore();
            }
        };
        let pendiente = 0;
        const repintar = () => {
            if (pendiente) {
                return;
            }
            pendiente = requestAnimationFrame(() => {
                pendiente = 0;
                componer(cv, true);
                pintarEncima();
            });
        };

        // GUARDAR (las capas tocadas, como WebP con su transparencia).
        const tocadas = new Set();
        let espera = 0;
        const fotoDe = (c) => {
            const webp = c.toDataURL("image/webp", 0.9);
            return webp.indexOf("data:image/webp") === 0 ? webp : c.toDataURL("image/png");
        };
        // Las capas tocadas, a sus imágenes (ya, sin esperar).
        const volcar = () => {
            clearTimeout(espera);
            tocadas.forEach((x) => {
                const b = buscar(x);
                if (b && lienzos[x]) {
                    b.n.imagen = fotoDe(lienzos[x]);
                }
            });
            tocadas.clear();
            pintarMinis();
            d.activa = activa;
        };
        const guardarDibujo = (id) => {
            if (id) {
                tocadas.add(id);
            }
            clearTimeout(espera);
            espera = setTimeout(() => {
                volcar();
                if (!guardar()) {
                    avisar("No se ha podido guardar el dibujo: no cabe. Quita alguna imagen o capa, o descárgalo.");
                }
            }, 400);
        };

        // DESHACER: por capa, cómo estaban sus píxeles antes de cada cambio.
        const atras = [];
        const adelante = [];
        const recordar = (id) => {
            if (!lienzos[id]) {
                return;
            }
            atras.push({ id, px: lienzos[id].getContext("2d").getImageData(0, 0, ANCHO, ALTO) });
            if (atras.length > 20) {
                atras.shift();
            }
            adelante.length = 0;
            pintarMandos();
        };
        const volverA = (de, a) => {
            soltarFlotante(false);
            while (de.length) {
                const x = de.pop();
                if (!lienzos[x.id]) {
                    continue;
                }
                const c = lienzos[x.id].getContext("2d");
                a.push({ id: x.id, px: c.getImageData(0, 0, ANCHO, ALTO) });
                c.putImageData(x.px, 0, 0);
                guardarDibujo(x.id);
                break;
            }
            sel = null;
            repintar();
            pintarMandos();
        };

        const capaActiva = () => {
            const b = buscar(activa);
            return b && b.n.tipo === "capa" ? b.n : null;
        };
        // ¿Se puede pintar en la activa? (No, si está escondida ella o su
        // carpeta: se avisa.)
        const sePuede = () => {
            const c = capaActiva();
            if (!c) {
                avisar("Elige una capa (no una carpeta) para pintar.");
                return null;
            }
            let ve = true;
            let b = buscar(c.id);
            while (b) {
                ve = ve && b.n.visible;
                b = b.padre ? buscar(b.padre.id) : null;
            }
            if (!ve) {
                avisar("La capa «" + c.nombre + "» está escondida: enséñala para pintar en ella.");
                return null;
            }
            return c;
        };

        const punto = (e) => {
            const r = encima.getBoundingClientRect();
            return [Math.round((e.clientX - r.left) * ANCHO / r.width), Math.round((e.clientY - r.top) * ALTO / r.height)];
        };
        // Las ocho asas de la selección: [cuál, x, y]. «tolerancia»: cuánto
        // mide un asa en píxeles del lienzo (unos 14 de pantalla).
        const tolerancia = () => 14 * ANCHO / Math.max(1, encima.getBoundingClientRect().width);
        const asas = () => {
            if (!sel) {
                return [];
            }
            const { x, y, w, h } = sel;
            return [["nw", x, y], ["n", x + w / 2, y], ["ne", x + w, y], ["e", x + w, y + h / 2], ["se", x + w, y + h],
                ["s", x + w / 2, y + h], ["sw", x, y + h], ["w", x, y + h / 2]];
        };
        const asaEn = (p) => {
            const t = tolerancia();
            const a = asas().find(([, x, y]) => Math.abs(p[0] - x) <= t && Math.abs(p[1] - y) <= t);
            return a ? a[0] : null;
        };
        const dentroDe = (p, s) => s && p[0] >= s.x && p[0] <= s.x + s.w && p[1] >= s.y && p[1] <= s.y + s.h;
        // Una figura (línea, rectángulo o elipse) de «a» a «b».
        function trazarFigura(ctx, f) {
            ctx.save();
            ctx.strokeStyle = f.color;
            ctx.lineWidth = f.grosor;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            const [x0, y0] = f.a;
            const [x1, y1] = f.b;
            if (f.que === "linea") {
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
            } else if (f.que === "rectangulo") {
                ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
            } else {
                ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
            }
            ctx.stroke();
            ctx.restore();
        }

        // LA SELECCIÓN: levantar lo seleccionado (para moverlo) y dejarlo.
        const levantar = () => {
            const c = sePuede();
            if (!c || !sel || flotante) {
                return !!flotante;
            }
            recordar(c.id);
            const l = lienzoNuevo(ANCHO, ALTO);
            l.width = Math.max(1, sel.w);
            l.height = Math.max(1, sel.h);
            const capa = lienzos[c.id].getContext("2d");
            l.getContext("2d").drawImage(lienzos[c.id], sel.x, sel.y, sel.w, sel.h, 0, 0, sel.w, sel.h);
            capa.clearRect(sel.x, sel.y, sel.w, sel.h);
            flotante = { lienzo: l, x: sel.x, y: sel.y, w: sel.w, h: sel.h, capa: c.id };
            return true;
        };
        function soltarFlotante(dejar) {
            if (!flotante) {
                return;
            }
            if (dejar !== false && lienzos[flotante.capa]) {
                lienzos[flotante.capa].getContext("2d").drawImage(flotante.lienzo, flotante.x, flotante.y, flotante.w, flotante.h);
                guardarDibujo(flotante.capa);
            }
            flotante = null;
        }
        const quitarSeleccion = () => {
            soltarFlotante();
            sel = null;
            repintar();
        };

        // EL TEXTO: al pinchar sale un cuadro para escribir encima del
        // lienzo, donde se ha pinchado; Intro (o pinchar fuera) lo deja
        // en la capa, Mayús+Intro hace otra línea y Esc lo deja estar.
        let escribiendo = null;
        const letraDe = () => (d.texto.negrita ? "bold " : "") + d.texto.tam + "px " +
            (d.texto.fuente.indexOf(",") >= 0 ? d.texto.fuente : "\"" + d.texto.fuente + "\"");
        function empezarTexto(c, p) {
            acabarTexto(true);
            const caja = crear("textarea", "master-dibujo-texto");
            caja.rows = 1;
            caja.setAttribute("aria-label", "Texto para el dibujo (Intro lo pone; Esc lo quita)");
            const k = encima.getBoundingClientRect().width / ANCHO;
            caja.style.left = (p[0] / ANCHO * 100) + "%";
            caja.style.top = (p[1] / ALTO * 100) + "%";
            caja.style.font = (d.texto.negrita ? "bold " : "") + (d.texto.tam * k) + "px " +
                (d.texto.fuente.indexOf(",") >= 0 ? d.texto.fuente : "\"" + d.texto.fuente + "\"");
            caja.style.color = color;
            marco.appendChild(caja);
            escribiendo = { caja, capa: c.id, x: p[0], y: p[1], color };
            caja.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    acabarTexto(true);
                    encima.focus();
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    acabarTexto(false);
                    encima.focus();
                }
            });
            caja.addEventListener("input", () => {
                caja.rows = Math.max(1, caja.value.split("\n").length);
            });
            caja.addEventListener("blur", () => setTimeout(() => acabarTexto(true), 0));
            setTimeout(() => caja.focus(), 0);
        }
        function acabarTexto(dejar) {
            if (!escribiendo) {
                return;
            }
            const e = escribiendo;
            escribiendo = null;
            const texto = e.caja.value;
            e.caja.remove();
            if (!dejar || !texto.trim() || !lienzos[e.capa]) {
                return;
            }
            recordar(e.capa);
            const letra = letraDe();
            const tam = d.texto.tam;
            // La letra tiene que estar cargada para pintarla en el canvas.
            const cargada = document.fonts && document.fonts.load ? document.fonts.load(letra, texto) : Promise.resolve();
            cargada.catch(() => {}).then(() => {
                if (!lienzos[e.capa]) {
                    return;
                }
                const ctx = lienzos[e.capa].getContext("2d");
                ctx.save();
                ctx.font = letra;
                ctx.fillStyle = e.color;
                ctx.textBaseline = "top";
                texto.split("\n").forEach((linea, i) => ctx.fillText(linea, e.x, e.y + i * tam * 1.25));
                ctx.restore();
                guardarDibujo(e.capa);
                repintar();
                avisar("Texto puesto: " + texto.replace(/\n/g, " ") + ".");
            });
        }

        // EL RATÓN (o el dedo, o el lápiz) sobre el lienzo.
        let gesto = null;
        encima.addEventListener("pointerdown", (e) => {
            if (e.button !== 0 && e.pointerType === "mouse") {
                return;
            }
            e.preventDefault();
            encima.focus();
            const p = punto(e);
            if (herramienta === "cuentagotas") {
                componer(cv, true);
                const px = cv.getImageData(Math.min(ANCHO - 1, Math.max(0, p[0])), Math.min(ALTO - 1, Math.max(0, p[1])),
                    1, 1).data;
                ponerColor("#" + [px[0], px[1], px[2]].map((x) => x.toString(16).padStart(2, "0")).join(""));
                avisar("Color cogido: " + color + ".");
                elegirHerramienta("lapiz");
                return;
            }
            if (herramienta === "seleccionar") {
                encima.setPointerCapture(e.pointerId);
                const asa = asaEn(p);
                if (asa && levantar()) {
                    gesto = { que: "tamano", asa, desde: p, antes: Object.assign({}, sel) };
                } else if (dentroDe(p, sel) && levantar()) {
                    gesto = { que: "mover", desde: p, x: flotante.x, y: flotante.y, sx: sel.x, sy: sel.y };
                } else {
                    soltarFlotante();
                    sel = null;
                    gesto = { que: "elegir", desde: p };
                }
                repintar();
                return;
            }
            soltarFlotante();
            sel = null;
            const c = sePuede();
            if (!c) {
                return;
            }
            if (herramienta === "texto") {
                empezarTexto(c, p);
                return;
            }
            if (herramienta === "bote") {
                const x = Math.min(ANCHO - 1, Math.max(0, p[0]));
                const y = Math.min(ALTO - 1, Math.max(0, p[1]));
                const ctx = lienzos[c.id].getContext("2d");
                const datos = ctx.getImageData(0, 0, ANCHO, ALTO);
                const antes = ctx.getImageData(0, 0, ANCHO, ALTO);
                if (rellenar(datos, x, y, color, margenBote)) {
                    atras.push({ id: c.id, px: antes });
                    adelante.length = 0;
                    ctx.putImageData(datos, 0, 0);
                    guardarDibujo(c.id);
                    pintarMandos();
                    repintar();
                }
                return;
            }
            encima.setPointerCapture(e.pointerId);
            recordar(c.id);
            if (herramienta === "lapiz" || herramienta === "goma") {
                const ctx = lienzos[c.id].getContext("2d");
                ctx.globalCompositeOperation = herramienta === "goma" ? "destination-out" : "source-over";
                ctx.strokeStyle = color;
                ctx.lineWidth = herramienta === "goma" ? grosor * 3 : grosor;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.beginPath();
                ctx.moveTo(p[0], p[1]);
                ctx.lineTo(p[0] + 0.1, p[1] + 0.1);
                ctx.stroke();
                gesto = { que: "trazo", ultimo: p, ctx, capa: c.id };
            } else {
                figura = { que: herramienta, a: p, b: p, color, grosor };
                gesto = { que: "figura", capa: c.id };
            }
            repintar();
        });
        const CURSOR_ASA = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize",
            e: "ew-resize", w: "ew-resize" };
        encima.addEventListener("pointermove", (e) => {
            if (!gesto) {
                if (herramienta === "seleccionar") {
                    const p = punto(e);
                    const asa = asaEn(p);
                    encima.style.cursor = asa ? CURSOR_ASA[asa] : dentroDe(p, sel) ? "move" : "";
                }
                return;
            }
            const eventos = gesto.que === "trazo" && e.getCoalescedEvents ? e.getCoalescedEvents() : [];
            const p = punto(e);
            if (gesto.que === "trazo") {
                const ctx = gesto.ctx;
                ctx.beginPath();
                ctx.moveTo(gesto.ultimo[0], gesto.ultimo[1]);
                (eventos.length ? eventos : [e]).forEach((x) => {
                    gesto.ultimo = punto(x);
                    ctx.lineTo(gesto.ultimo[0], gesto.ultimo[1]);
                });
                ctx.stroke();
            } else if (gesto.que === "figura") {
                figura.b = p;
            } else if (gesto.que === "elegir") {
                const [x0, y0] = gesto.desde;
                const x = Math.max(0, Math.min(x0, p[0]));
                const y = Math.max(0, Math.min(y0, p[1]));
                sel = { x, y, w: Math.min(ANCHO, Math.max(x0, p[0])) - x, h: Math.min(ALTO, Math.max(y0, p[1])) - y };
            } else if (gesto.que === "tamano") {
                // Cambiar el tamaño desde un asa (con Mayús, sin deformar).
                const a = gesto.antes;
                const dx = p[0] - gesto.desde[0];
                const dy = p[1] - gesto.desde[1];
                let { x, y, w, h } = a;
                if (gesto.asa.indexOf("w") >= 0) {
                    x = Math.min(a.x + a.w - 4, a.x + dx);
                    w = a.x + a.w - x;
                }
                if (gesto.asa.indexOf("e") >= 0) {
                    w = Math.max(4, a.w + dx);
                }
                if (gesto.asa.indexOf("n") >= 0) {
                    y = Math.min(a.y + a.h - 4, a.y + dy);
                    h = a.y + a.h - y;
                }
                if (gesto.asa.indexOf("s") >= 0) {
                    h = Math.max(4, a.h + dy);
                }
                if (e.shiftKey && gesto.asa.length === 2) {
                    const k = Math.max(w / a.w, h / a.h);
                    const nw = a.w * k;
                    const nh = a.h * k;
                    x = gesto.asa.indexOf("w") >= 0 ? a.x + a.w - nw : a.x;
                    y = gesto.asa.indexOf("n") >= 0 ? a.y + a.h - nh : a.y;
                    w = nw;
                    h = nh;
                }
                sel = { x, y, w, h };
                Object.assign(flotante, { x, y, w, h });
            } else if (gesto.que === "mover") {
                const dx = p[0] - gesto.desde[0];
                const dy = p[1] - gesto.desde[1];
                flotante.x = gesto.x + dx;
                flotante.y = gesto.y + dy;
                sel.x = gesto.sx + dx;
                sel.y = gesto.sy + dy;
            }
            repintar();
        });
        const acabar = () => {
            if (!gesto) {
                return;
            }
            if (gesto.que === "trazo") {
                gesto.ctx.globalCompositeOperation = "source-over";
                guardarDibujo(gesto.capa);
            } else if (gesto.que === "figura") {
                trazarFigura(lienzos[gesto.capa].getContext("2d"), figura);
                figura = null;
                guardarDibujo(gesto.capa);
            } else if (gesto.que === "elegir" && sel && (sel.w < 3 || sel.h < 3)) {
                sel = null;
            } else if (gesto.que === "elegir" && sel) {
                avisar("Seleccionado. Arrástralo o muévelo con las flechas; las asas o + y − cambian el tamaño; Supr lo borra, Esc lo suelta.");
            }
            gesto = null;
            repintar();
        };
        encima.addEventListener("pointerup", acabar);
        encima.addEventListener("pointercancel", acabar);

        // EL TECLADO, con el foco en el lienzo: las herramientas con su
        // letra (como el Photoshop), Ctrl+Z / Ctrl+Y, y la selección con
        // las flechas, Supr y Esc.
        encima.addEventListener("keydown", (e) => {
            const k = e.key.toLowerCase();
            if ((e.ctrlKey || e.metaKey) && (k === "z" || k === "y")) {
                e.preventDefault();
                if (k === "z" && !e.shiftKey) {
                    volverA(atras, adelante);
                } else {
                    volverA(adelante, atras);
                }
                return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) {
                return;
            }
            if (sel && /^Arrow/.test(e.key)) {
                e.preventDefault();
                if (!levantar()) {
                    return;
                }
                const paso = e.shiftKey ? 10 : 1;
                const dx = { ArrowLeft: -paso, ArrowRight: paso }[e.key] || 0;
                const dy = { ArrowUp: -paso, ArrowDown: paso }[e.key] || 0;
                flotante.x += dx;
                flotante.y += dy;
                sel.x += dx;
                sel.y += dy;
                repintar();
                return;
            }
            if (sel && (e.key === "+" || e.key === "-")) {
                // Más grande o más pequeño (un 10 %), desde el centro.
                e.preventDefault();
                if (!levantar()) {
                    return;
                }
                const k = e.key === "+" ? 1.1 : 1 / 1.1;
                const w = Math.max(4, sel.w * k);
                const h = Math.max(4, sel.h * k);
                sel = { x: sel.x + (sel.w - w) / 2, y: sel.y + (sel.h - h) / 2, w, h };
                Object.assign(flotante, sel);
                repintar();
                avisar("Tamaño: " + Math.round(w) + " × " + Math.round(h) + ".");
                return;
            }
            if (sel && (e.key === "Delete" || e.key === "Backspace")) {
                e.preventDefault();
                if (flotante) {
                    flotante = null;
                } else {
                    const c = sePuede();
                    if (c) {
                        recordar(c.id);
                        lienzos[c.id].getContext("2d").clearRect(sel.x, sel.y, sel.w, sel.h);
                        guardarDibujo(c.id);
                    }
                }
                sel = null;
                repintar();
                avisar("Borrado lo seleccionado.");
                return;
            }
            if (sel && e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                quitarSeleccion();
                avisar("Selección soltada.");
                return;
            }
            const h = DIBUJO_HERRAMIENTAS.find((x) => x[3] === k);
            if (h) {
                e.preventDefault();
                elegirHerramienta(h[0]);
                avisar(h[2] + ".");
            }
        });

        // PEGAR O ARRASTRAR IMÁGENES: en una capa nueva, encogidas para que
        // quepan (como mucho el 80 % del lienzo), y seleccionadas para
        // moverlas.
        const pegar = (archivo, x, y) => {
            if (!archivo || !/^image\//.test(archivo.type)) {
                avisar("Eso no es una imagen.");
                return;
            }
            const lector = new FileReader();
            lector.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const escala = Math.min(1, ANCHO * 0.8 / img.width, ALTO * 0.8 / img.height);
                    const w = Math.round(img.width * escala);
                    const h = Math.round(img.height * escala);
                    const cx = x === undefined ? ANCHO / 2 : x;
                    const cy = y === undefined ? ALTO / 2 : y;
                    const px = Math.round(Math.max(0, Math.min(ANCHO - w, cx - w / 2)));
                    const py = Math.round(Math.max(0, Math.min(ALTO - h, cy - h / 2)));
                    soltarFlotante();
                    const c = nuevaCapa("imagen");
                    lienzos[c.id].getContext("2d").drawImage(img, px, py, w, h);
                    guardarDibujo(c.id);
                    elegirHerramienta("seleccionar");
                    sel = { x: px, y: py, w, h };
                    repintar();
                    avisar("Imagen pegada en una capa nueva, seleccionada para moverla.");
                };
                img.onerror = () => avisar("No he podido abrir esa imagen.");
                img.src = imagenSegura(lector.result);
            };
            lector.readAsDataURL(archivo);
        };
        const alPegar = (e) => {
            if (!dentro.isConnected) {
                document.removeEventListener("paste", alPegar);
                return;
            }
            if (!dentro.contains(document.activeElement) || document.activeElement.matches("input, textarea")) {
                return;
            }
            const archivo = Array.from((e.clipboardData && e.clipboardData.files) || [])[0];
            if (archivo) {
                e.preventDefault();
                pegar(archivo);
            }
        };
        document.addEventListener("paste", alPegar);
        encima.addEventListener("dragover", (e) => {
            e.preventDefault();
            marco.classList.add("es-encima");
        });
        encima.addEventListener("dragleave", () => marco.classList.remove("es-encima"));
        encima.addEventListener("drop", (e) => {
            e.preventDefault();
            marco.classList.remove("es-encima");
            const [x, y] = punto(e);
            pegar(Array.from(e.dataTransfer.files || [])[0], x, y);
        });

        // ---- LA BARRA DE LA IZQUIERDA ----
        const barra = crear("div", "master-postit-barra es-dibujo");
        barra.setAttribute("role", "toolbar");
        barra.setAttribute("aria-label", "Herramientas del dibujo");
        const grupo = (...cosas) => {
            const g = crear("span", "master-postit-grupo");
            g.append(...cosas);
            barra.appendChild(g);
            return g;
        };
        const botonesH = DIBUJO_HERRAMIENTAS.map(([id, emoji, nombre, tecla]) => {
            const b = botonDe("master-postit-boton", emoji, () => elegirHerramienta(id), nombre);
            b.title = nombre + " (" + tecla.toUpperCase() + ")";
            b.setAttribute("aria-keyshortcuts", tecla.toUpperCase());
            b.dataset.herramienta = id;
            return b;
        });
        function elegirHerramienta(h) {
            if (h !== "seleccionar") {
                quitarSeleccion();
            }
            herramienta = h;
            d.herramienta = h;
            botonesH.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.herramienta === h)));
            encima.dataset.herramienta = h;
            pintarOpciones();
            acabarTexto(true);
            guardar();
        }
        grupo(...botonesH);
        // Los colores: los de siempre y el selector del navegador.
        const muestras = DIBUJO_COLORES.map(([hex, nombre]) => {
            const b = botonDe("master-postit-boton master-dibujo-color", "", () => {
                ponerColor(hex);
                if (herramienta === "goma" || herramienta === "seleccionar" || herramienta === "cuentagotas") {
                    elegirHerramienta("lapiz");
                }
            }, "Color " + nombre);
            b.title = nombre;
            b.dataset.hex = hex;
            b.style.setProperty("--muestra", hex);
            return b;
        });
        const elegirColor = crear("input", "master-dibujo-selector");
        elegirColor.type = "color";
        elegirColor.title = "Cualquier color";
        elegirColor.setAttribute("aria-label", "Elegir cualquier color");
        elegirColor.addEventListener("input", () => ponerColor(elegirColor.value));
        function ponerColor(hex) {
            color = hex.toLowerCase();
            d.color = color;
            elegirColor.value = color;
            muestras.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.hex === color)));
            guardar();
        }
        grupo(...muestras);
        const conSelector = grupo(elegirColor);
        conSelector.classList.add("es-selector");
        // ---- LAS OPCIONES (arriba del lienzo, como el Paint): las de la
        // herramienta (grosor; letra y tamaño del texto; margen del bote) y
        // deshacer, imagen, descargar y rejilla. ----
        const opciones = crear("div", "master-dibujo-opciones");
        opciones.setAttribute("role", "toolbar");
        opciones.setAttribute("aria-label", "Opciones del dibujo");
        const deslizador = (texto, min, max, valor, alCambiar, unidad) => {
            const et = crear("label", "master-dibujo-deslizador");
            const r = crear("input");
            r.type = "range";
            r.min = min;
            r.max = max;
            r.value = valor;
            const v = crear("span", "master-dibujo-valor", valor + (unidad || ""));
            v.setAttribute("aria-hidden", "true");
            r.setAttribute("aria-valuetext", valor + (unidad || ""));
            r.addEventListener("input", () => {
                v.textContent = r.value + (unidad || "");
                r.setAttribute("aria-valuetext", r.value + (unidad || ""));
                alCambiar(parseInt(r.value, 10));
            });
            et.append(crear("span", "oc-dados-etiqueta", texto), r, v);
            return et;
        };
        const opGrosor = deslizador("grosor", 1, 80, grosor, (x) => {
            grosor = x;
            d.grosor = x;
            guardar();
        }, " px");
        let margenBote = parseInt(d.margen, 10) || 40;
        const opMargen = deslizador("margen del bote", 0, 160, margenBote, (x) => {
            margenBote = x;
            d.margen = x;
            guardar();
        });
        opMargen.title = "Cuánto se puede parecer un color al de donde pinchas para que también se rellene";
        // El texto: letra, tamaño y negrita.
        d.texto = Object.assign({ fuente: "Pangolin", tam: 40, negrita: false }, d.texto || {});
        const opTexto = crear("span", "master-dibujo-optexto");
        const fuente = crear("select", "master-postit-elegir");
        fuente.setAttribute("aria-label", "Letra del texto");
        DIBUJO_FUENTES.forEach(([f, n]) => {
            const o = crear("option", "", n);
            o.value = f;
            fuente.appendChild(o);
        });
        fuente.value = d.texto.fuente;
        const tamTexto = crear("input", "master-dibujo-numero");
        tamTexto.type = "number";
        tamTexto.min = 8;
        tamTexto.max = 300;
        tamTexto.value = d.texto.tam;
        tamTexto.setAttribute("aria-label", "Tamaño del texto");
        tamTexto.title = "Tamaño del texto";
        const negrita = botonDe("master-postit-boton es-negrita", "B", () => {
            d.texto.negrita = !d.texto.negrita;
            negrita.setAttribute("aria-pressed", String(d.texto.negrita));
            guardar();
        }, "Texto en negrita");
        negrita.setAttribute("aria-pressed", String(!!d.texto.negrita));
        fuente.addEventListener("change", () => {
            d.texto.fuente = fuente.value;
            guardar();
        });
        tamTexto.addEventListener("change", () => {
            d.texto.tam = Math.min(300, Math.max(8, parseInt(tamTexto.value, 10) || 40));
            guardar();
        });
        opTexto.append(fuente, tamTexto, negrita);
        const pintarOpciones = () => {
            opGrosor.hidden = ["lapiz", "goma", "linea", "rectangulo", "elipse"].indexOf(herramienta) < 0;
            opMargen.hidden = herramienta !== "bote";
            opTexto.hidden = herramienta !== "texto";
        };
        const deshacer = botonDe("master-postit-boton", "↶", () => volverA(atras, adelante), "Deshacer");
        const rehacer = botonDe("master-postit-boton", "↷", () => volverA(adelante, atras), "Rehacer");
        deshacer.title = "Deshacer (Ctrl+Z)";
        rehacer.title = "Rehacer (Ctrl+Y)";
        const archivo = crear("input");
        archivo.type = "file";
        archivo.accept = "image/*";
        archivo.hidden = true;
        archivo.addEventListener("change", () => {
            pegar(archivo.files && archivo.files[0]);
            archivo.value = "";
        });
        const imagen = botonDe("master-postit-boton", "🖼️", () => archivo.click(), "Poner una imagen");
        imagen.title = "Poner una imagen en una capa nueva (o pégala con Ctrl+V)";
        const bajar = botonDe("master-postit-boton", "⬇", () => {
            soltarFlotante();
            const l = lienzoNuevo(ANCHO, ALTO);
            const c = l.getContext("2d");
            componer(c, false);
            if (d.rejilla.ver && d.rejilla.bajar) {
                pintarRejilla(c, d.rejilla);
            }
            const a = crear("a");
            a.href = l.toDataURL("image/png");
            a.download = (m.titulo || "dibujo").replace(/[^\p{L}\p{N}]+/gu, "-") + ".png";
            document.body.appendChild(a);
            a.click();
            a.remove();
            avisar("Descargado: " + a.download + ".");
        }, "Descargar el dibujo");
        bajar.title = "Descargar como PNG (todas las capas que se ven)";
        const aJugadores = botonDe("master-postit-boton", "📺", () => {
            soltarFlotante();
            const l = lienzoNuevo(ANCHO, ALTO);
            const c = l.getContext("2d");
            componer(c, false);
            if (d.rejilla.ver && d.rejilla.bajar) {
                pintarRejilla(c, d.rejilla);
            }
            l.toBlob((blob) => {
                if (blob) {
                    mostrarAJugadores({ modo: "imagen", titulo: "" }, blob).then(() => avisar("Los jugadores ven el dibujo."));
                }
            }, "image/png");
        }, "Enseñar este dibujo en la pantalla de jugadores");
        aJugadores.title = "Enseñar el dibujo en la pantalla de jugadores (lo que se ve ahora)";
        const botonRejilla = crear("button", "master-postit-boton", "#");
        botonRejilla.type = "button";
        botonRejilla.setAttribute("aria-label", "Rejilla de rol");
        botonRejilla.title = "Enseñar o esconder la rejilla";

        // GUARDAR EN DOCUMENTOS: el dibujo entero (con sus capas), para
        // abrirlo otra vez desde «documentos» y seguir dibujando.
        const aDocs = botonDe("master-postit-boton", "📁", () => {
            soltarFlotante();
            volcar();
            guardarEnDocumentos(aDocs, d.doc, () => {
                const copia = JSON.parse(JSON.stringify(d));
                delete copia.doc;
                delete copia.zoom;
                return { tipo: "dibujo", titulo: m.titulo || "dibujo", datos: copia };
            }, (id) => {
                d.doc = id;
            });
        }, "Guardar en documentos (con sus capas)");
        aDocs.title = "Guardar en documentos (con sus capas)";
        aDocs.setAttribute("aria-haspopup", "dialog");

        // EL ZOOM DEL LIENZO (d.zoom): − 100 % +, y Ctrl + rueda encima. A
        // más del 100 %, el lienzo se desliza dentro de su visor.
        const ZOOMS_DIBUJO = [0.5, 0.75, 1, 1.5, 2, 3, 4];
        let zoomD = ZOOMS_DIBUJO.indexOf(Number(d.zoom)) >= 0 ? Number(d.zoom) : 1;
        const visor = crear("div", "master-dibujo-visor");
        const valorZoom = botonDe("master-postit-boton master-dibujo-zoom-valor", "100 %", () => ponerZoomD(1, true),
            "Zoom del lienzo al 100 %");
        const menosZoom = botonDe("master-postit-boton", "－", () => pasoZoomD(-1), "Alejar el lienzo");
        const masZoom = botonDe("master-postit-boton", "＋", () => pasoZoomD(1), "Acercar el lienzo");
        menosZoom.title = "Alejar (Ctrl + rueda)";
        masZoom.title = "Acercar (Ctrl + rueda)";
        function ponerZoomD(z, decirlo) {
            zoomD = z;
            d.zoom = z === 1 ? undefined : z;
            marco.style.width = z === 1 ? "" : (z * 100) + "%";
            valorZoom.textContent = Math.round(z * 100) + " %";
            valorZoom.setAttribute("aria-label", "Zoom del lienzo: " + Math.round(z * 100) + " % (pulsa para el 100 %)");
            menosZoom.disabled = z <= ZOOMS_DIBUJO[0];
            masZoom.disabled = z >= ZOOMS_DIBUJO[ZOOMS_DIBUJO.length - 1];
            pintarEncima();
            guardar();
            if (decirlo) {
                avisar("Zoom del lienzo: " + Math.round(z * 100) + " %.");
            }
        }
        const pasoZoomD = (s) => {
            const sig = s > 0 ? ZOOMS_DIBUJO.find((x) => x > zoomD) : ZOOMS_DIBUJO.slice().reverse().find((x) => x < zoomD);
            if (sig) {
                ponerZoomD(sig, true);
            }
        };
        encima.addEventListener("wheel", (e) => {
            if (!e.ctrlKey) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            pasoZoomD(e.deltaY < 0 ? 1 : -1);
        }, { passive: false });

        // Debajo de las herramientas de pintar: deshacer, el zoom y la
        // rejilla, y lo de guardar (imagen, descargar y documentos).
        const titulado = (texto, ...cosas) => {
            const g = grupo(...cosas);
            g.setAttribute("role", "group");
            g.setAttribute("aria-label", texto);
            return g;
        };
        titulado("Deshacer y rehacer", deshacer, rehacer);
        titulado("Zoom del lienzo", menosZoom, masZoom);
        titulado("Zoom actual", valorZoom).classList.add("es-selector");
        titulado("Rejilla", botonRejilla);
        titulado("Guardar", imagen, bajar, aDocs, aJugadores).classList.add("es-guardar");
        opciones.append(opGrosor, opMargen, opTexto);

        // ---- LAS CAPAS (a la derecha) ----
        const panel = crear("div", "master-dibujo-panel");
        const tituloCapas = crear("h3", "master-dibujo-titulo", "capas");
        const listaCapas = crear("ul", "master-dibujo-capas");
        // Las miniaturas de cada capa, para repintarlas al guardar.
        let minis = {};
        function pintarMinis() {
            Object.keys(minis).forEach((id) => {
                if (!lienzos[id]) {
                    return;
                }
                const mc = minis[id].getContext("2d");
                mc.fillStyle = DIBUJO_PAPEL;
                mc.fillRect(0, 0, 40, 30);
                const k = Math.min(40 / ANCHO, 30 / ALTO);
                mc.drawImage(lienzos[id], (40 - ANCHO * k) / 2, (30 - ALTO * k) / 2, ANCHO * k, ALTO * k);
            });
        }
        listaCapas.setAttribute("aria-label", "Capas y carpetas (la de arriba se ve encima)");
        function nuevaCapa(nombre) {
            const c = { id: nuevoId(), tipo: "capa", nombre: nombre || "capa " + (Object.keys(lienzos).length + 1), visible: true,
                opacidad: 100, imagen: "" };
            lienzos[c.id] = lienzoNuevo(ANCHO, ALTO);
            // Encima de la activa, en su misma carpeta.
            const b = buscar(activa);
            const lista = b ? b.lista : d.capas;
            lista.splice(b ? lista.indexOf(b.n) : 0, 0, c);
            activa = c.id;
            d.activa = activa;
            pintarCapas();
            guardar();
            return c;
        }
        const masCapa = botonDe("oc-vida-accion", "＋ capa", () => {
            const c = nuevaCapa();
            avisar("Capa nueva: " + c.nombre + ".");
        }, "Capa nueva");
        const masCarpeta = botonDe("oc-vida-accion", "📁 carpeta", () => {
            const n = { id: nuevoId(), tipo: "carpeta", nombre: "carpeta", visible: true, opacidad: 100, abierta: true, hijos: [] };
            const b = buscar(activa);
            const lista = b ? b.lista : d.capas;
            lista.splice(b ? lista.indexOf(b.n) : 0, 0, n);
            activa = n.id;
            pintarCapas();
            guardar();
            avisar("Carpeta nueva. Mete capas en ella con «⇥ a la carpeta».");
        }, "Carpeta nueva");
        const nuevas = crear("div", "master-dibujo-nuevas");
        nuevas.append(masCapa, masCarpeta);
        const fila = (n, nivel) => {
            const li = crear("li", "master-dibujo-capa" + (n.id === activa ? " es-activa" : "") + (n.tipo === "carpeta" ? " es-carpeta" : ""));
            li.style.setProperty("--nivel", nivel);
            const ojo = botonDe("master-nombre-boton", n.visible ? "👁" : "—", () => {
                n.visible = !n.visible;
                pintarCapas();
                repintar();
                guardar();
                avisar((n.visible ? "Se ve: " : "Escondida: ") + n.nombre + ".");
            }, (n.visible ? "Esconder " : "Enseñar ") + n.nombre);
            ojo.setAttribute("aria-pressed", String(!!n.visible));
            ojo.title = n.visible ? "Esconder" : "Enseñar";
            li.appendChild(ojo);
            if (n.tipo === "carpeta") {
                const plegar = botonDe("master-nombre-boton", n.abierta ? "▾" : "▸", () => {
                    n.abierta = !n.abierta;
                    pintarCapas();
                    guardar();
                }, (n.abierta ? "Cerrar " : "Abrir ") + "la carpeta " + n.nombre);
                plegar.setAttribute("aria-expanded", String(!!n.abierta));
                li.appendChild(plegar);
            }
            const nombre = botonDe("master-dibujo-capa-nombre", (n.tipo === "carpeta" ? "📁 " : "") + n.nombre, () => {
                soltarFlotante();
                sel = null;
                activa = n.id;
                d.activa = activa;
                pintarCapas();
                repintar();
                guardar();
            }, (n.tipo === "carpeta" ? "Carpeta " : "Capa ") + n.nombre + (n.visible ? "" : " (escondida)"));
            if (n.id === activa) {
                nombre.setAttribute("aria-current", "true");
            }
            if (n.tipo === "capa" && lienzos[n.id]) {
                const mini = lienzoNuevo(ANCHO, ALTO);
                mini.width = 40;
                mini.height = 30;
                mini.className = "master-dibujo-mini";
                mini.setAttribute("aria-hidden", "true");
                minis[n.id] = mini;
                nombre.prepend(mini);
            }
            li.appendChild(nombre);
            return li;
        };
        // Lo que se puede hacer con la activa: subir, bajar, meterla en la
        // carpeta de encima, sacarla, renombrar, duplicar, opacidad, borrar.
        const mandos = crear("div", "master-dibujo-mandos");
        const mando = (texto, nombre, f) => {
            const b = botonDe("master-postit-boton", texto, f, nombre);
            b.title = nombre;
            mandos.appendChild(b);
            return b;
        };
        const mover = (paso) => {
            const b = buscar(activa);
            if (!b) {
                return;
            }
            const i = b.lista.indexOf(b.n);
            const j = i + paso;
            if (j < 0 || j >= b.lista.length) {
                return;
            }
            b.lista.splice(i, 1);
            b.lista.splice(j, 0, b.n);
            pintarCapas();
            repintar();
            guardar();
            avisar((paso < 0 ? "Subida: " : "Bajada: ") + b.n.nombre + ".");
        };
        const subir = mando("↑", "Subir (que se vea más encima)", () => mover(-1));
        const bajarCapa = mando("↓", "Bajar (que se vea más debajo)", () => mover(1));
        const aCarpeta = mando("⇥", "Meterla en la carpeta de encima", () => {
            const b = buscar(activa);
            if (!b) {
                return;
            }
            const i = b.lista.indexOf(b.n);
            const carpeta = b.lista.slice(0, i).reverse().find((x) => x.tipo === "carpeta" && x !== b.n);
            if (!carpeta) {
                avisar("No hay ninguna carpeta encima de esta, al mismo nivel.");
                return;
            }
            b.lista.splice(i, 1);
            carpeta.hijos.push(b.n);
            carpeta.abierta = true;
            pintarCapas();
            repintar();
            guardar();
            avisar(b.n.nombre + " va ahora en la carpeta " + carpeta.nombre + ".");
        });
        const fuera = mando("⇤", "Sacarla de su carpeta", () => {
            const b = buscar(activa);
            if (!b || !b.padre) {
                return;
            }
            const arriba = buscar(b.padre.id);
            b.lista.splice(b.lista.indexOf(b.n), 1);
            arriba.lista.splice(arriba.lista.indexOf(b.padre), 0, b.n);
            pintarCapas();
            repintar();
            guardar();
            avisar(b.n.nombre + " ya no va en " + b.padre.nombre + ".");
        });
        const renombrar = mando("✎", "Cambiarle el nombre", () => {
            const b = buscar(activa);
            if (!b) {
                return;
            }
            const campo = crear("input", "master-elegir master-dibujo-renombrar");
            campo.value = b.n.nombre;
            campo.setAttribute("aria-label", "Nombre de " + b.n.nombre);
            const actual = listaCapas.querySelector(".es-activa .master-dibujo-capa-nombre");
            if (!actual) {
                return;
            }
            actual.replaceWith(campo);
            campo.focus();
            campo.select();
            let hecho = false;
            const acabarNombre = (vale) => {
                if (hecho) {
                    return;
                }
                hecho = true;
                if (vale && campo.value.trim()) {
                    b.n.nombre = campo.value.trim().slice(0, 40);
                    guardar();
                }
                pintarCapas();
                renombrar.focus();
            };
            campo.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    acabarNombre(true);
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    acabarNombre(false);
                }
            });
            campo.addEventListener("blur", () => acabarNombre(true));
        });
        const duplicar = mando("⧉", "Duplicar la capa", () => {
            const c = capaActiva();
            if (!c) {
                avisar("Solo se pueden duplicar capas.");
                return;
            }
            soltarFlotante();
            const original = lienzos[c.id];
            const copia = nuevaCapa(c.nombre + " (copia)");
            lienzos[copia.id].getContext("2d").drawImage(original, 0, 0);
            copia.opacidad = c.opacidad;
            guardarDibujo(copia.id);
            pintarCapas();
            repintar();
        });
        let seguro = false;
        const borrarCapa = mando("🗑️", "Borrar la capa o carpeta", () => {
            const b = buscar(activa);
            if (!b) {
                return;
            }
            let capas = 0;
            recorrer((n) => {
                capas += n.tipo === "capa" ? 1 : 0;
            });
            const dentroHay = [];
            recorrer((n) => {
                if (n.tipo === "capa") {
                    dentroHay.push(n.id);
                }
            }, b.n.tipo === "carpeta" ? b.n.hijos : [b.n]);
            if (capas - dentroHay.length < 1) {
                avisar("Tiene que quedar al menos una capa.");
                return;
            }
            if (!seguro) {
                seguro = true;
                borrarCapa.textContent = "⚠️";
                borrarCapa.setAttribute("aria-label", "¿Seguro? Pulsa otra vez para borrar " + b.n.nombre);
                avisar("Pulsa otra vez para borrar " + b.n.nombre + (b.n.tipo === "carpeta" ? " y todo lo que tiene" : "") +
                    ". No se puede deshacer.");
                setTimeout(() => {
                    seguro = false;
                    borrarCapa.textContent = "🗑️";
                    borrarCapa.setAttribute("aria-label", "Borrar la capa o carpeta");
                }, 4000);
                return;
            }
            seguro = false;
            borrarCapa.textContent = "🗑️";
            borrarCapa.setAttribute("aria-label", "Borrar la capa o carpeta");
            soltarFlotante(false);
            sel = null;
            const i = b.lista.indexOf(b.n);
            b.lista.splice(i, 1);
            dentroHay.forEach((id) => {
                delete lienzos[id];
            });
            const siguiente = b.lista[Math.min(i, b.lista.length - 1)] || b.padre;
            activa = siguiente ? siguiente.id : null;
            if (!activa) {
                recorrer((n) => {
                    if (n.tipo === "capa") {
                        activa = n.id;
                        return false;
                    }
                    return true;
                });
            }
            d.activa = activa;
            pintarCapas();
            repintar();
            guardar();
            avisar("Borrada: " + b.n.nombre + ".");
        });
        const etOpa = crear("label", "oc-dados-etiqueta master-dibujo-opacidad");
        const opacidad = crear("input");
        opacidad.type = "range";
        opacidad.min = 0;
        opacidad.max = 100;
        opacidad.step = 5;
        const valorOpa = crear("span", "", "");
        etOpa.append(document.createTextNode("opacidad "), valorOpa, opacidad);
        opacidad.addEventListener("input", () => {
            const b = buscar(activa);
            if (!b) {
                return;
            }
            b.n.opacidad = parseInt(opacidad.value, 10);
            valorOpa.textContent = b.n.opacidad + " %";
            repintar();
            guardar();
        });
        function pintarMandos() {
            deshacer.disabled = !atras.length;
            rehacer.disabled = !adelante.length;
            const b = buscar(activa);
            const i = b ? b.lista.indexOf(b.n) : -1;
            subir.disabled = !b || i <= 0;
            bajarCapa.disabled = !b || i >= b.lista.length - 1;
            aCarpeta.disabled = !b || !b.lista.slice(0, i).some((x) => x.tipo === "carpeta");
            fuera.disabled = !b || !b.padre;
            renombrar.disabled = !b;
            duplicar.disabled = !b || b.n.tipo !== "capa";
            borrarCapa.disabled = !b;
            opacidad.disabled = !b;
            opacidad.value = b ? (b.n.opacidad === undefined ? 100 : b.n.opacidad) : 100;
            valorOpa.textContent = opacidad.value + " %";
            opacidad.setAttribute("aria-valuetext", opacidad.value + " %");
        }
        function pintarCapas() {
            const filas = [];
            const pasar = (lista, nivel) => lista.forEach((n) => {
                filas.push(fila(n, nivel));
                if (n.tipo === "carpeta" && n.abierta) {
                    pasar(n.hijos, nivel + 1);
                    if (!n.hijos.length) {
                        const vacia = crear("li", "master-dibujo-capa es-vacia", "(vacía)");
                        vacia.style.setProperty("--nivel", nivel + 1);
                        filas.push(vacia);
                    }
                }
            });
            minis = {};
            pasar(d.capas, 0);
            listaCapas.replaceChildren(...filas);
            pintarMinis();
            pintarMandos();
        }
        // ---- LA REJILLA ----
        const rejilla = crear("div", "master-dibujo-rejilla");
        // Los ajustes, plegados; «#» en la barra la enseña o la esconde.
        const tituloR = crear("h3", "master-dibujo-titulo");
        const plegarR = botonDe("master-dibujo-plegar", (d.rejilla.abierta ? "▾" : "▸") + " rejilla de rol", () => {
            d.rejilla.abierta = !d.rejilla.abierta;
            plegarR.textContent = (d.rejilla.abierta ? "▾" : "▸") + " rejilla de rol";
            plegarR.setAttribute("aria-expanded", String(!!d.rejilla.abierta));
            ajustesR.hidden = !d.rejilla.abierta;
            guardar();
        });
        plegarR.setAttribute("aria-expanded", String(!!d.rejilla.abierta));
        tituloR.appendChild(plegarR);
        const ajustesR = crear("div", "master-dibujo-ajustes");
        ajustesR.hidden = !d.rejilla.abierta;
        const caja = (texto, control) => {
            const et = crear("label", "master-dibujo-campo");
            et.append(crear("span", "oc-dados-etiqueta", texto), control);
            return et;
        };
        const ver = crear("input");
        ver.type = "checkbox";
        ver.checked = !!d.rejilla.ver;
        const etVer = crear("label", "master-nombres-apellido");
        etVer.append(ver, document.createTextNode(" enseñar la rejilla"));
        const tipo = crear("select", "master-elegir");
        [["cuadrada", "cuadrada"], ["hex", "hexagonal"]].forEach(([v, n]) => {
            const o = crear("option", "", n);
            o.value = v;
            tipo.appendChild(o);
        });
        tipo.value = d.rejilla.tipo;
        const tam = crear("input", "master-elegir");
        tam.type = "number";
        tam.min = 10;
        tam.max = 250;
        tam.step = 5;
        tam.value = d.rejilla.tam;
        const colorR = crear("input", "master-dibujo-selector");
        colorR.type = "color";
        colorR.value = d.rejilla.color;
        const opaR = crear("input");
        opaR.type = "range";
        opaR.min = 10;
        opaR.max = 100;
        opaR.step = 5;
        opaR.value = d.rejilla.opacidad;
        const bajarR = crear("input");
        bajarR.type = "checkbox";
        bajarR.checked = !!d.rejilla.bajar;
        const etBajar = crear("label", "master-nombres-apellido");
        etBajar.append(bajarR, document.createTextNode(" en la imagen al descargar"));
        const cambiarRejilla = () => {
            Object.assign(d.rejilla, { ver: ver.checked, tipo: tipo.value, tam: Math.min(250, Math.max(10, parseInt(tam.value, 10) || 50)),
                color: colorR.value, opacidad: parseInt(opaR.value, 10), bajar: bajarR.checked });
            opaR.setAttribute("aria-valuetext", opaR.value + " %");
            botonRejilla.setAttribute("aria-pressed", String(ver.checked));
            repintar();
            guardar();
        };
        [ver, tipo, tam, colorR, opaR, bajarR].forEach((x) => x.addEventListener(x.type === "range" || x.type === "color" ? "input" : "change",
            cambiarRejilla));
        ajustesR.append(etVer, caja("forma", tipo), caja("casilla (de 1000 de ancho)", tam), caja("color", colorR),
            caja("cuánto se ve", opaR), etBajar);
        rejilla.append(tituloR, ajustesR);
        botonRejilla.addEventListener("click", () => {
            ver.checked = !ver.checked;
            cambiarRejilla();
            avisar(ver.checked ? "Rejilla a la vista." : "Rejilla escondida.");
        });
        botonRejilla.setAttribute("aria-pressed", String(!!d.rejilla.ver));
        // ---- EL TAMAÑO DEL LIENZO (plegado): unos cuantos ya hechos o el
        // que se quiera, y si lo dibujado se estira o se queda como está
        // (y se recorta o sobra sitio). ----
        const tamanoL = crear("div", "master-dibujo-rejilla");
        const tituloT = crear("h3", "master-dibujo-titulo");
        const ajustesT = crear("div", "master-dibujo-ajustes");
        ajustesT.hidden = true;
        const plegarT = botonDe("master-dibujo-plegar", "▸ tamaño del lienzo", () => {
            ajustesT.hidden = !ajustesT.hidden;
            plegarT.textContent = (ajustesT.hidden ? "▸" : "▾") + " tamaño del lienzo";
            plegarT.setAttribute("aria-expanded", String(!ajustesT.hidden));
        });
        plegarT.setAttribute("aria-expanded", "false");
        tituloT.appendChild(plegarT);
        const hechos = crear("select", "master-elegir");
        [["", "a medida"], ["1000x750", "normal (1000 × 750)"], ["1200x1200", "cuadrado (1200 × 1200)"],
            ["1600x900", "panorámico (1600 × 900)"], ["750x1000", "de pie (750 × 1000)"], ["2000x1500", "grande (2000 × 1500)"]]
            .forEach(([v, n]) => {
                const o = crear("option", "", n);
                o.value = v;
                hechos.appendChild(o);
            });
        const numero = (valor) => {
            const x = crear("input", "master-elegir");
            x.type = "number";
            x.min = 200;
            x.max = 3000;
            x.step = 50;
            x.value = valor;
            return x;
        };
        const anchoT = numero(ANCHO);
        const altoT = numero(ALTO);
        hechos.value = hechos.querySelector("option[value='" + ANCHO + "x" + ALTO + "']") ? ANCHO + "x" + ALTO : "";
        hechos.addEventListener("change", () => {
            if (hechos.value) {
                [anchoT.value, altoT.value] = hechos.value.split("x");
            }
        });
        const estirar = crear("input");
        estirar.type = "checkbox";
        const etEstirar = crear("label", "master-nombres-apellido");
        etEstirar.append(estirar, document.createTextNode(" estirar lo dibujado"));
        const cambiarT = botonDe("oc-vida-accion", "↔ cambiar el tamaño", () => {
            const w = Math.min(3000, Math.max(200, parseInt(anchoT.value, 10) || ANCHO));
            const h = Math.min(3000, Math.max(200, parseInt(altoT.value, 10) || ALTO));
            if (w === ANCHO && h === ALTO) {
                return;
            }
            acabarTexto(true);
            soltarFlotante();
            sel = null;
            Object.keys(lienzos).forEach((id) => {
                const nuevo = lienzoNuevo(w, h);
                if (estirar.checked) {
                    nuevo.getContext("2d").drawImage(lienzos[id], 0, 0, w, h);
                } else {
                    nuevo.getContext("2d").drawImage(lienzos[id], 0, 0);
                }
                lienzos[id] = nuevo;
                tocadas.add(id);
            });
            ANCHO = w;
            ALTO = h;
            d.ancho = w;
            d.alto = h;
            [vista, encima].forEach((c) => {
                c.width = w;
                c.height = h;
            });
            atras.length = 0;
            adelante.length = 0;
            guardarDibujo();
            pintarCapas();
            repintar();
            avisar("El lienzo mide ahora " + w + " × " + h + ". (Esto no se deshace.)");
        });
        ajustesT.append(caja("ya hecho", hechos), caja("ancho", anchoT), caja("alto", altoT), etEstirar, cambiarT);
        tamanoL.append(tituloT, ajustesT);
        panel.append(tituloCapas, nuevas, listaCapas, mandos, etOpa, rejilla, tamanoL);

        // Lo que es el dibujo, para quien no lo ve.
        const etD = crear("label", "oc-dados-etiqueta", "de qué es (para el lector de pantalla)");
        const desc = crear("input", "master-elegir");
        desc.id = "master-dibujo-desc-" + m.id;
        desc.value = d.desc || "";
        etD.htmlFor = desc.id;
        desc.addEventListener("input", () => {
            d.desc = desc.value;
            etiqueta();
            guardar();
        });

        // Como el Paint: herramientas a la izquierda, el lienzo en medio y
        // las capas a la derecha (debajo, si no cabe).
        const centro = crear("div", "master-dibujo-centro");
        visor.appendChild(marco);
        centro.append(opciones, visor);
        const zona = crear("div", "master-dibujo-zona");
        zona.append(barra, centro, panel);
        // Si la ventana es estrecha, las herramientas pasan arriba, en
        // fila, y las capas abajo: se ve bien a cualquier tamaño.
        if (window.ResizeObserver) {
            const mirar = new ResizeObserver(() => {
                zona.classList.toggle("es-estrecha", zona.clientWidth < 620);
            });
            mirar.observe(zona);
        }
        dentro.append(zona, archivo, etD, desc);

        // Cargar las capas guardadas (de una en una) y pintar.
        const cargas = [];
        recorrer((n) => {
            if (n.tipo === "capa" && n.imagen) {
                cargas.push(new Promise((hecho) => {
                    const img = new Image();
                    img.onload = () => {
                        lienzos[n.id].getContext("2d").drawImage(img, 0, 0, ANCHO, ALTO);
                        hecho();
                    };
                    img.onerror = hecho;
                    img.src = imagenSegura(n.imagen);
                }));
            }
        });
        Promise.all(cargas).then(() => {
            pintarCapas();
            repintar();
        });
        elegirHerramienta(herramienta);
        ponerColor(color);
        ponerZoomD(zoomD, false);
        vista.width = encima.width = ANCHO;
        vista.height = encima.height = ALTO;
        pintarCapas();
        repintar();
    }

    // ---- LAS TABLAS PROPIAS (datos/personajes/compendio/master-tablas.json):
    // PNJ, dungeons y calendarios. Todo inventado aquí. ----
    const TABLAS = "datos/personajes/compendio/master-tablas.json";

    // «posadero|posadera»: la forma de su género (n, cualquiera de las dos).
    const segunGenero = (texto, genero) => {
        const [m, f] = String(texto).split("|");
        if (f === undefined) {
            return m;
        }
        return genero === "f" ? f : genero === "m" ? m : alAzar([m, f]);
    };

    // ---- PNJ RÁPIDOS: nombre (del generador de nombres), especie,
    // oficio, aspecto, carácter, manía al hablar, qué quiere y un secreto.
    // Cada cosa se puede volver a tirar suelta (🎲); ☆ lo guarda. ----
    const PNJ_CAMPOS = [["oficio", "Oficio", "oficios"], ["aspecto", "Aspecto", "aspecto"], ["rasgo", "Carácter", "rasgos"],
        ["mania", "Al hablar", "manias"], ["quiere", "Quiere", "quiere"], ["secreto", "Secreto", "secretos"]];

    function montarPnj(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        Promise.all([pedir(TABLAS), pedir(NOMBRES)]).then(([tablas, nombres]) => {
            const d = m.datos;
            const t = tablas.pnj;
            const especie = elegirDe("master-pnj-especie-" + m.id, "especie",
                [["", "al azar"]].concat(Object.keys(nombres.especies).map((k) => [k, nombres.especies[k].nombre])), d.especie || "");
            const genero = botonesDe("género", [["cualquiera", "cualquiera"], ["f", "♀"], ["m", "♂"], ["n", "⚪ neutro"]],
                d.genero || "cualquiera", (v) => {
                    d.genero = v;
                    guardar();
                });
            const etGen = crear("p", "oc-dados-etiqueta", "género");
            etGen.setAttribute("aria-hidden", "true");
            const nuevo = () => {
                const esp = especie.elegir.value || alAzar(Object.keys(nombres.especies));
                const g = genero.valor() === "cualquiera" ? alAzar(["f", "m", "n"]) : genero.valor();
                const p = { nombre: nombreDe(nombres, esp, g, true), especie: nombres.especies[esp].nombre, genero: g };
                PNJ_CAMPOS.forEach(([k, , lista]) => {
                    p[k] = segunGenero(alAzar(t[lista]), g);
                });
                return p;
            };
            const ficha = crear("div", "master-pnj");
            ficha.setAttribute("aria-live", "polite");
            const guardados = crear("ul", "master-pnj-guardados");
            guardados.setAttribute("aria-label", "PNJ guardados");
            const tituloG = crear("h3", "master-nombres-titulo", "⭐ guardados");
            const texto = (p) => p.nombre + " (" + p.especie + ")\n" + PNJ_CAMPOS.map(([k, n]) => n + ": " + p[k]).join("\n");
            const pintarFicha = () => {
                const p = d.pnj;
                ficha.replaceChildren();
                if (!p) {
                    ficha.appendChild(crear("p", "oc-vacio", "Pulsa «generar»."));
                    return;
                }
                const cab = crear("div", "master-pnj-cabeza");
                const h = crear("h3", "master-pnj-nombre", p.nombre);
                cab.append(h, crear("span", "master-pnj-especie", p.especie + " · " + ({ f: "♀", m: "♂", n: "neutro" }[p.genero] || "")));
                const dl = crear("dl", "master-pnj-datos");
                PNJ_CAMPOS.forEach(([k, nombre, lista]) => {
                    const dd = crear("dd", "", p[k]);
                    const otra = botonDe("master-nombre-boton", "🎲", () => {
                        p[k] = segunGenero(alAzar(t[lista]), p.genero);
                        guardar();
                        pintarFicha();
                        avisar(nombre + ": " + p[k] + ".");
                    }, "Otro valor para " + nombre.toLowerCase());
                    otra.title = "Otro";
                    dd.appendChild(otra);
                    dl.append(crear("dt", "", nombre), dd);
                });
                const botones = crear("div", "master-pnj-botones");
                botones.append(
                    botonDe("oc-vida-accion", "☆ guardar", () => {
                        d.guardados = (d.guardados || []).concat([Object.assign({}, p)]);
                        guardar();
                        pintarGuardados();
                        avisar("Guardado: " + p.nombre + ".");
                    }, "Guardar a " + p.nombre),
                    botonDe("oc-vida-accion", "⧉ copiar", () => copiarTexto(texto(p), "Copiado: " + p.nombre + "."), "Copiar a " + p.nombre));
                ficha.append(cab, dl, botones);
            };
            const pintarGuardados = () => {
                const lista = d.guardados || [];
                guardados.replaceChildren(...lista.map((p, i) => {
                    const li = crear("li", "master-nombre");
                    const ver = botonDe("master-botin-objeto", p.nombre + " · " + p.oficio, () => {
                        d.pnj = Object.assign({}, p);
                        guardar();
                        pintarFicha();
                        avisar("PNJ: " + p.nombre + ", " + p.oficio + ".");
                    }, "Ver a " + p.nombre);
                    const quitar = botonDe("master-nombre-boton", "✕", () => {
                        lista.splice(i, 1);
                        guardar();
                        pintarGuardados();
                        avisar("Quitado: " + p.nombre + ".");
                    }, "Quitar a " + p.nombre + " de guardados");
                    li.append(ver, quitar);
                    return li;
                }));
                tituloG.hidden = guardados.hidden = !lista.length;
            };
            const generar = botonDe("oc-vida-accion es-principal master-nombres-generar", "🎲 generar PNJ", () => {
                d.especie = especie.elegir.value;
                d.pnj = nuevo();
                guardar();
                pintarFicha();
                avisar("PNJ: " + d.pnj.nombre + ", " + d.pnj.oficio + ".");
            });
            const arriba = crear("div", "master-nombres-form");
            arriba.append(especie, etGen, genero, generar);
            dentro.replaceChildren(arriba, ficha, tituloG, guardados);
            pintarFicha();
            pintarGuardados();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar las tablas."));
        });
    }

    // ---- LOS RELOJES (de progreso): un círculo partido en 4 a 12 trozos
    // que se van llenando (una amenaza que avanza, una cuenta atrás…).
    // Varios por ventana; − y + (o pinchar en un trozo) los mueven. ----
    const SVG = "http://www.w3.org/2000/svg";

    function dibujoReloj(partes, llenas, alPinchar) {
        const svg = document.createElementNS(SVG, "svg");
        svg.setAttribute("viewBox", "-52 -52 104 104");
        svg.setAttribute("class", "master-reloj-dibujo");
        svg.setAttribute("aria-hidden", "true");
        for (let i = 0; i < partes; i++) {
            const a0 = (i / partes) * Math.PI * 2 - Math.PI / 2;
            const a1 = ((i + 1) / partes) * Math.PI * 2 - Math.PI / 2;
            const trozo = document.createElementNS(SVG, "path");
            trozo.setAttribute("d", "M0 0 L" + (48 * Math.cos(a0)).toFixed(2) + " " + (48 * Math.sin(a0)).toFixed(2) + " A48 48 0 0 1 " +
                (48 * Math.cos(a1)).toFixed(2) + " " + (48 * Math.sin(a1)).toFixed(2) + " Z");
            trozo.setAttribute("class", "master-reloj-trozo" + (i < llenas ? " es-lleno" : ""));
            trozo.addEventListener("click", () => alPinchar(i));
            svg.appendChild(trozo);
        }
        return svg;
    }

    function montarRelojes(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        d.relojes = Array.isArray(d.relojes) ? d.relojes : [];
        const lista = crear("ul", "master-relojes");
        lista.setAttribute("aria-label", "Relojes");
        const pintar = () => {
            lista.replaceChildren(...d.relojes.map((r, i) => {
                const li = crear("li", "master-reloj" + (r.llenas >= r.partes ? " es-lleno" : ""));
                const nombre = crear("input", "master-elegir master-reloj-nombre");
                nombre.value = r.nombre;
                nombre.setAttribute("aria-label", "Nombre del reloj");
                nombre.addEventListener("change", () => {
                    r.nombre = nombre.value.trim() || "reloj";
                    guardar();
                });
                const poner = (n) => {
                    const antes = r.llenas;
                    r.llenas = Math.min(r.partes, Math.max(0, n));
                    guardar();
                    pintar();
                    const foco = lista.children[i] && lista.children[i].querySelector(n > antes ? ".es-mas" : ".es-menos");
                    if (foco) {
                        foco.focus();
                    }
                    avisar(r.nombre + ": " + r.llenas + " de " + r.partes + (r.llenas >= r.partes ? ". ¡Lleno!" : "."));
                };
                const barra = crear("div", "master-reloj-cuenta");
                barra.setAttribute("role", "meter");
                barra.setAttribute("aria-valuemin", "0");
                barra.setAttribute("aria-valuemax", String(r.partes));
                barra.setAttribute("aria-valuenow", String(r.llenas));
                barra.setAttribute("aria-label", r.nombre);
                barra.append(dibujoReloj(r.partes, r.llenas, (j) => poner(j + 1 === r.llenas ? j : j + 1)),
                    crear("span", "master-reloj-numero", r.llenas + "/" + r.partes));
                const menos = botonDe("master-pestana-mando es-menos", "−", () => poner(r.llenas - 1), "Vaciar un trozo de " + r.nombre);
                const mas = botonDe("master-pestana-mando es-mas", "+", () => poner(r.llenas + 1), "Llenar un trozo de " + r.nombre);
                menos.disabled = r.llenas <= 0;
                mas.disabled = r.llenas >= r.partes;
                const partes = crear("select", "master-postit-elegir");
                partes.setAttribute("aria-label", "Trozos de " + r.nombre);
                [4, 6, 8, 10, 12].forEach((n) => {
                    const o = crear("option", "", n + " trozos");
                    o.value = n;
                    partes.appendChild(o);
                });
                partes.value = r.partes;
                partes.addEventListener("change", () => {
                    r.partes = parseInt(partes.value, 10);
                    r.llenas = Math.min(r.llenas, r.partes);
                    guardar();
                    pintar();
                });
                const quitar = botonDe("master-nombre-boton", "✕", () => {
                    d.relojes.splice(i, 1);
                    guardar();
                    pintar();
                    avisar("Quitado: " + r.nombre + ".");
                    nuevoNombre.focus();
                }, "Quitar el reloj " + r.nombre);
                const mandos = crear("div", "master-reloj-mandos");
                mandos.append(menos, mas, partes, quitar);
                li.append(nombre, barra, mandos);
                return li;
            }));
            if (!d.relojes.length) {
                lista.appendChild(crear("li", "oc-vacio", "Sin relojes todavía."));
            }
        };
        const form = crear("form", "master-reloj-nuevo");
        const nuevoNombre = crear("input", "master-elegir");
        nuevoNombre.placeholder = "la guardia llega, el ritual se completa…";
        nuevoNombre.setAttribute("aria-label", "Nombre del reloj nuevo");
        const nuevoPartes = crear("select", "master-postit-elegir");
        nuevoPartes.setAttribute("aria-label", "Trozos del reloj nuevo");
        [4, 6, 8, 10, 12].forEach((n) => {
            const o = crear("option", "", n + " trozos");
            o.value = n;
            nuevoPartes.appendChild(o);
        });
        nuevoPartes.value = "6";
        const anadirReloj = crear("button", "oc-vida-accion es-principal", "＋ reloj");
        anadirReloj.type = "submit";
        form.append(nuevoNombre, nuevoPartes, anadirReloj);
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const r = { nombre: nuevoNombre.value.trim() || "reloj " + (d.relojes.length + 1), partes: parseInt(nuevoPartes.value, 10), llenas: 0 };
            d.relojes.push(r);
            nuevoNombre.value = "";
            guardar();
            pintar();
            avisar("Reloj nuevo: " + r.nombre + ", de " + r.partes + " trozos.");
        });
        dentro.append(form, lista);
        pintar();
    }

    // ---- EL CALENDARIO de la partida: gregoriano, el de Harptos (el de
    // los Reinos Olvidados: meses de 30 días, decanarios y fiestas; los
    // nombres, en master-tablas.json) o uno propio (meses y días de la
    // semana a mano: el de Cralëa, por ejemplo). Con la fecha y la hora de
    // la partida (y botones para que pase el tiempo) y apuntes por día. ----
    const MESES_GREGORIANO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
        "noviembre", "diciembre"];
    const SEMANA_GREGORIANO = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

    function montarCalendario(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        pedir(TABLAS).then((tablas) => {
            const d = m.datos;
            const hoyReal = new Date();
            d.tipo = d.tipo || "gregoriano";
            d.propio = Object.assign({ nombre: "propio", anio: "", meses: "Primero: 30\nSegundo: 30\nTercero: 30\nCuarto: 30",
                semana: "uno, dos, tres, cuatro, cinco, seis, siete" }, d.propio || {});
            d.apuntes = d.apuntes || {};
            const harptos = tablas.calendarios.harptos;
            // Los meses de un año (con sus días; las fiestas, de 1 día).
            const mesesDe = (anio) => {
                if (d.tipo === "gregoriano") {
                    return MESES_GREGORIANO.map((nombre, i) => ({ nombre, dias: new Date(anio, i + 1, 0).getDate() }));
                }
                if (d.tipo === "harptos") {
                    return harptos.meses.filter((x) => !x.cada || anio % x.cada === 0);
                }
                return d.propio.meses.split("\n").map((l) => l.split(":")).filter((x) => x[0].trim())
                    .map(([nombre, dias]) => ({ nombre: nombre.trim(), dias: Math.max(1, Math.min(100, parseInt(dias, 10) || 30)) }));
            };
            const semana = () => (d.tipo === "gregoriano" ? SEMANA_GREGORIANO : d.tipo === "harptos" ? harptos.dias
                : d.propio.semana.split(",").map((x) => x.trim()).filter(Boolean));
            const sufijo = () => (d.tipo === "harptos" ? " " + harptos.anio : d.tipo === "propio" && d.propio.anio ? " " + d.propio.anio : "");
            // Qué día de la semana es (0…): el gregoriano, por el de verdad;
            // el de Harptos, el decanario empieza cada mes; el propio, seguido.
            const diaSemana = (f) => {
                if (d.tipo === "gregoriano") {
                    return (new Date(f.anio, f.mes, f.dia).getDay() + 6) % 7;
                }
                if (d.tipo === "harptos") {
                    return (f.dia - 1) % 10;
                }
                const meses = mesesDe(f.anio);
                const largo = meses.reduce((t, x) => t + x.dias, 0);
                let n = (f.anio - 1) * largo;
                for (let i = 0; i < f.mes; i++) {
                    n += meses[i].dias;
                }
                n += f.dia - 1;
                const s = semana().length || 7;
                return ((n % s) + s) % s;
            };
            const arreglar = (f) => {
                const meses = mesesDe(f.anio);
                f.mes = Math.min(Math.max(0, f.mes), meses.length - 1);
                f.dia = Math.min(Math.max(1, f.dia), meses[f.mes].dias);
                return f;
            };
            if (!d.fecha) {
                d.fecha = d.tipo === "gregoriano" ? { anio: hoyReal.getFullYear(), mes: hoyReal.getMonth(), dia: hoyReal.getDate() }
                    : { anio: 1492, mes: 0, dia: 1 };
                d.hora = 8;
            }
            arreglar(d.fecha);
            d.viendo = d.viendo || { anio: d.fecha.anio, mes: d.fecha.mes };
            const clave = (f) => d.tipo + ":" + f.anio + "-" + f.mes + "-" + f.dia;
            const nombreFecha = (f) => {
                const mes = mesesDe(f.anio)[f.mes];
                if (mes.fiesta) {
                    return mes.nombre + " de " + f.anio + sufijo();
                }
                const dia = d.tipo === "gregoriano" ? ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"][diaSemana(f)]
                    + " " + f.dia : d.tipo === "harptos" ? "día " + f.dia : f.dia + " (" + semana()[diaSemana(f)] + ")";
                return dia + " de " + mes.nombre + " de " + f.anio + sufijo();
            };
            const momento = (h) => (h < 6 ? "de madrugada" : h < 12 ? "por la mañana" : h < 14 ? "a mediodía" : h < 20 ? "por la tarde"
                : "por la noche");
            // Que pase el tiempo (en horas; con días si se pasa de 24).
            const pasar = (horas) => {
                let h = (d.hora || 0) + horas;
                let dias = Math.floor(h / 24);
                h = ((h % 24) + 24) % 24;
                d.hora = h;
                const f = d.fecha;
                while (dias > 0) {
                    f.dia++;
                    if (f.dia > mesesDe(f.anio)[f.mes].dias) {
                        f.dia = 1;
                        f.mes++;
                        if (f.mes >= mesesDe(f.anio).length) {
                            f.mes = 0;
                            f.anio++;
                        }
                    }
                    dias--;
                }
                while (dias < 0) {
                    f.dia--;
                    if (f.dia < 1) {
                        f.mes--;
                        if (f.mes < 0) {
                            f.anio--;
                            f.mes = mesesDe(f.anio).length - 1;
                        }
                        f.dia = mesesDe(f.anio)[f.mes].dias;
                    }
                    dias++;
                }
                d.viendo = { anio: f.anio, mes: f.mes };
                guardar();
                pintar();
                avisar("Ahora: " + nombreFecha(f) + ", a las " + d.hora + ":00 (" + momento(d.hora) + ").");
                // Para los efectos con duración (que cuentan las horas).
                document.dispatchEvent(new CustomEvent("master:tiempo", { detail: { horas } }));
            };
            // ARRIBA: qué calendario, la fecha de la partida y el tiempo.
            const tipo = elegirDe("master-cal-tipo-" + m.id, "calendario", [["gregoriano", "gregoriano"], ["harptos", harptos.nombre],
                ["propio", "propio"]], d.tipo);
            tipo.elegir.addEventListener("change", () => {
                d.tipo = tipo.elegir.value;
                d.fecha = d.tipo === "gregoriano" ? { anio: hoyReal.getFullYear(), mes: hoyReal.getMonth(), dia: hoyReal.getDate() }
                    : { anio: d.tipo === "harptos" ? 1492 : 1, mes: 0, dia: 1 };
                d.viendo = { anio: d.fecha.anio, mes: d.fecha.mes };
                guardar();
                pintar();
                avisar("Calendario " + tipo.elegir.selectedOptions[0].textContent + ".");
            });
            const ahora = crear("p", "master-cal-ahora");
            ahora.setAttribute("aria-live", "polite");
            const tiempo = crear("div", "master-cal-tiempo");
            tiempo.setAttribute("role", "group");
            tiempo.setAttribute("aria-label", "Que pase el tiempo");
            [["−1 día", -24], ["+1 h", 1], ["+8 h (descanso largo)", 8], ["+1 día", 24], ["+1 semana", 0]].forEach(([texto, h]) => {
                tiempo.appendChild(botonDe("oc-vida-accion", texto, () => pasar(h || 24 * (semana().length || 7))));
            });
            // EL PROPIO: meses (uno por línea, «nombre: días»), días de la
            // semana y lo que va detrás del año.
            const propio = crear("div", "master-cal-propio");
            const etMeses = crear("label", "oc-dados-etiqueta", "meses (uno por línea: «nombre: días»)");
            const meses = crear("textarea", "oc-notas-texto es-corta");
            meses.id = "master-cal-meses-" + m.id;
            etMeses.htmlFor = meses.id;
            meses.value = d.propio.meses;
            const etSemana = crear("label", "oc-dados-etiqueta", "días de la semana (separados por comas)");
            const sem = crear("input", "master-elegir");
            sem.id = "master-cal-semana-" + m.id;
            etSemana.htmlFor = sem.id;
            sem.value = d.propio.semana;
            const etAnio = crear("label", "oc-dados-etiqueta", "detrás del año (DEM, AEM…)");
            const anio = crear("input", "master-elegir");
            anio.id = "master-cal-anio-" + m.id;
            etAnio.htmlFor = anio.id;
            anio.value = d.propio.anio;
            const etNum = crear("label", "oc-dados-etiqueta", "año de la partida");
            const numAnio = crear("input", "master-elegir");
            numAnio.type = "number";
            numAnio.id = "master-cal-num-" + m.id;
            etNum.htmlFor = numAnio.id;
            const usar = botonDe("oc-vida-accion", "✔ usar", () => {
                Object.assign(d.propio, { meses: meses.value, semana: sem.value, anio: anio.value.trim() });
                d.fecha.anio = parseInt(numAnio.value, 10) || d.fecha.anio;
                arreglar(d.fecha);
                d.viendo = { anio: d.fecha.anio, mes: d.fecha.mes };
                guardar();
                pintar();
                avisar("Calendario propio puesto.");
            });
            propio.append(etMeses, meses, etSemana, sem, etAnio, anio, etNum, numAnio, usar);
            // EL MES: en rejilla, con ‹ › para cambiar de mes.
            const cabeza = crear("div", "master-cal-cabeza");
            const titulo = crear("h3", "master-cal-mes");
            titulo.setAttribute("aria-live", "polite");
            const verMes = (paso) => {
                let { anio: a, mes: me } = d.viendo;
                me += paso;
                if (me < 0) {
                    a--;
                    me = mesesDe(a).length - 1;
                } else if (me >= mesesDe(a).length) {
                    a++;
                    me = 0;
                }
                d.viendo = { anio: a, mes: me };
                guardar();
                pintarMes();
            };
            const antes = botonDe("master-pestana-mando", "‹", () => verMes(-1), "Mes anterior");
            const despues = botonDe("master-pestana-mando", "›", () => verMes(1), "Mes siguiente");
            const volver = botonDe("oc-vida-accion", "hoy", () => {
                d.viendo = { anio: d.fecha.anio, mes: d.fecha.mes };
                guardar();
                pintarMes();
            }, "Volver al mes de la partida");
            cabeza.append(antes, titulo, despues, volver);
            const rejilla = crear("table", "master-cal-rejilla");
            // El día elegido y sus apuntes.
            let elegido = Object.assign({}, d.fecha);
            const etDia = crear("label", "oc-dados-etiqueta");
            const apunte = crear("textarea", "oc-notas-texto es-corta");
            apunte.id = "master-cal-apunte-" + m.id;
            etDia.htmlFor = apunte.id;
            apunte.rows = 3;
            const esHoy = botonDe("oc-vida-accion", "📍 que la partida esté en este día", () => {
                d.fecha = Object.assign({}, elegido);
                guardar();
                pintar();
                avisar("La partida está en " + nombreFecha(d.fecha) + ".");
            });
            let espera = 0;
            apunte.addEventListener("input", () => {
                clearTimeout(espera);
                espera = setTimeout(() => {
                    if (apunte.value.trim()) {
                        d.apuntes[clave(elegido)] = apunte.value;
                    } else {
                        delete d.apuntes[clave(elegido)];
                    }
                    guardar();
                    pintarMes();
                }, 400);
            });
            const pintarDia = () => {
                etDia.textContent = "apuntes del " + nombreFecha(elegido);
                apunte.value = d.apuntes[clave(elegido)] || "";
            };
            function pintarMes() {
                const { anio: a, mes: me } = d.viendo;
                const lista = mesesDe(a);
                const mes = lista[Math.min(me, lista.length - 1)];
                titulo.textContent = mes.nombre + " de " + a + sufijo();
                const dias = semana();
                const cols = Math.max(1, dias.length);
                const cab = crear("tr");
                dias.forEach((x) => cab.appendChild(crear("th", "", x)));
                const filas = [cab];
                let fila = crear("tr");
                const hueco = mes.fiesta ? 0 : diaSemana({ anio: a, mes: me, dia: 1 });
                for (let i = 0; i < hueco; i++) {
                    fila.appendChild(crear("td"));
                }
                for (let dia = 1; dia <= mes.dias; dia++) {
                    const f = { anio: a, mes: me, dia };
                    const td = crear("td");
                    const b = botonDe("master-cal-dia", String(dia), () => {
                        elegido = f;
                        pintarMes();
                        pintarDia();
                        apunte.focus();
                    }, nombreFecha(f) + (d.apuntes[clave(f)] ? " (con apuntes)" : ""));
                    if (a === d.fecha.anio && me === d.fecha.mes && dia === d.fecha.dia) {
                        b.classList.add("es-hoy");
                        b.setAttribute("aria-current", "date");
                    }
                    if (a === elegido.anio && me === elegido.mes && dia === elegido.dia) {
                        b.classList.add("es-elegido");
                    }
                    if (d.apuntes[clave(f)]) {
                        b.classList.add("con-apunte");
                    }
                    td.appendChild(b);
                    fila.appendChild(td);
                    if (fila.children.length === cols || mes.fiesta) {
                        filas.push(fila);
                        fila = crear("tr");
                    }
                }
                if (fila.children.length) {
                    filas.push(fila);
                }
                rejilla.replaceChildren(...filas);
                rejilla.setAttribute("aria-label", titulo.textContent);
            }
            function pintar() {
                // La fecha, en texto, para quien la quiera (la línea temporal).
                d.textoHoy = nombreFecha(d.fecha);
                ahora.replaceChildren(crear("strong", "", "En la partida: "), document.createTextNode(nombreFecha(d.fecha) + ", a las " +
                    (d.hora || 0) + ":00 (" + momento(d.hora || 0) + ")"));
                propio.hidden = d.tipo !== "propio";
                numAnio.value = d.fecha.anio;
                elegido = Object.assign({}, d.fecha);
                pintarMes();
                pintarDia();
            }
            const arriba = crear("div", "master-nombres-form");
            arriba.append(tipo, propio, ahora, tiempo);
            dentro.replaceChildren(arriba, cabeza, rejilla, etDia, apunte, esHoy);
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar los calendarios."));
        });
    }

    // ---- EL GENERADOR DE DUNGEONS: un mapa sencillo en cuadrícula (salas
    // y pasillos al azar) y, para cada sala, qué es, un detalle, y lo que
    // hay: monstruos del SRD (con la cuenta de los encuentros), una trampa
    // (tablas propias) o un botín (el del generador de botín). El mapa va
    // en un canvas (de colores fijos, como un pergamino) y la lista de
    // salas es lo que lee el lector de pantalla. «🎨 al dibujo» lo pasa a
    // una ventana de dibujo, con su rejilla, para pintar encima. ----
    const DUNGEON_ANCHO = 48;
    const DUNGEON_ALTO = 36;
    const DUNGEON_CELDA = 20;
    const DUNGEON_TAMANOS = [["5", "pequeño (5 salas)"], ["8", "mediano (8 salas)"], ["12", "grande (12 salas)"]];
    // La trampa según el nivel: CD y daño (cuenta propia).
    const DUNGEON_TRAMPA = [[4, 12, "2d10"], [10, 14, "4d10"], [16, 16, "8d10"], [99, 18, "10d10"]];

    // EL MAPA: salas al azar en una cuadrícula de 48 × 36 sin que se
    // toquen, unidas por pasillos en L (cada una con la siguiente y una o
    // dos más; la primera de esas, SECRETA). Estilo «salas» (rectángulos,
    // con puertas: normales, cerradas con llave, atrancadas o secretas) o
    // «cavernas» (manchas irregulares y pasillos que se ensanchan, sin
    // puertas). En «filas», cada casilla: 0 roca, 1 sala, 2 pasillo, 3
    // pasillo secreto; en «zonas», de qué sala es (en base 36; «.» ninguna).
    function hacerMapa(salasQuiero, estilo, cds) {
        const celdas = Array.from({ length: DUNGEON_ALTO }, () => new Array(DUNGEON_ANCHO).fill(0));
        const zonas = Array.from({ length: DUNGEON_ALTO }, () => new Array(DUNGEON_ANCHO).fill("."));
        const salas = [];
        const azar = (a, b) => a + tiradaSuelta("1d" + (b - a + 1)) - 1;
        const cavernas = estilo === "cavernas";
        for (let intento = 0; intento < 400 && salas.length < salasQuiero; intento++) {
            const w = azar(4, cavernas ? 10 : 9);
            const h = azar(3, cavernas ? 8 : 7);
            const x = azar(1, DUNGEON_ANCHO - w - 2);
            const y = azar(1, DUNGEON_ALTO - h - 2);
            if (salas.some((s) => x < s.x + s.w + 2 && s.x < x + w + 2 && y < s.y + s.h + 2 && s.y < y + h + 2)) {
                continue;
            }
            salas.push({ x, y, w, h });
        }
        salas.sort((a, b) => (a.x + a.w / 2) - (b.x + b.w / 2));
        salas.forEach((s, n) => {
            const rx = s.w / 2;
            const ry = s.h / 2;
            s.cx = Math.floor(s.x + rx);
            s.cy = Math.floor(s.y + ry);
            for (let j = s.y; j < s.y + s.h; j++) {
                for (let i = s.x; i < s.x + s.w; i++) {
                    // En las cavernas, una mancha: una elipse con los bordes
                    // mordidos al azar (el centro, siempre).
                    const dx = (i + 0.5 - s.x - rx) / rx;
                    const dy = (j + 0.5 - s.y - ry) / ry;
                    const dentro = !cavernas || (i === s.cx && j === s.cy) || dx * dx + dy * dy <= 0.75 + tiradaSuelta("1d40") / 100;
                    if (dentro) {
                        celdas[j][i] = 1;
                        zonas[j][i] = n.toString(36);
                    }
                }
            }
        });
        const pasillos = [];
        const puertas = [];
        const pasillo = (a, b, secreto) => {
            const sa = salas[a];
            const sb = salas[b];
            const [x0, y0, x1, y1] = [sa.cx, sa.cy, sb.cx, sb.cy];
            const camino = [];
            const tramo = (desde, hasta, fijo, horizontal) => {
                const paso = desde <= hasta ? 1 : -1;
                for (let k = desde; k !== hasta + paso; k += paso) {
                    camino.push(horizontal ? [k, fijo] : [fijo, k]);
                }
            };
            if (tiradaSuelta("1d2") === 1) {
                tramo(x0, x1, y0, true);
                tramo(y0, y1, x1, false);
            } else {
                tramo(y0, y1, x0, false);
                tramo(x0, x1, y1, true);
            }
            const celdasP = [];
            const n = pasillos.length;
            camino.forEach(([i, j], k) => {
                if (celdas[j][i] !== 1) {
                    // Todo lo que pisa fuera de las salas (también lo que ya
                    // era de otro pasillo): así se ve entero.
                    celdasP.push([i, j]);
                }
                if (celdas[j][i] === 0) {
                    celdas[j][i] = secreto ? 3 : 2;
                    // En las cavernas, a veces se ensancha.
                    if (cavernas && tiradaSuelta("1d3") === 1) {
                        const [di, dj] = alAzar([[1, 0], [0, 1], [-1, 0], [0, -1]]);
                        const ni = i + di;
                        const nj = j + dj;
                        if (ni > 0 && nj > 0 && ni < DUNGEON_ANCHO - 1 && nj < DUNGEON_ALTO - 1 && celdas[nj][ni] === 0) {
                            celdas[nj][ni] = secreto ? 3 : 2;
                            celdasP.push([ni, nj]);
                        }
                    }
                }
                // Las puertas: donde el camino sale de una sala o entra en
                // ella (la casilla de fuera). En las cavernas no hay.
                if (cavernas || celdas[j][i] === 1) {
                    return;
                }
                // Una por cada punta del pasillo (al salir de «a» y al entrar
                // en «b»), no en las salas que cruza por el camino.
                const vecinas = [camino[k - 1], camino[k + 1]].filter(Boolean);
                const sala = vecinas.find(([vi, vj]) => zonas[vj][vi] !== "." && [a, b].indexOf(parseInt(zonas[vj][vi], 36)) >= 0);
                if (!sala || puertas.some((p) => (p.x === i && p.y === j) ||
                    (p.pasillo === n && p.sala === parseInt(zonas[sala[1]][sala[0]], 36)))) {
                    return;
                }
                let tipo = "normal";
                const r = tiradaSuelta("1d20");
                if (secreto) {
                    tipo = "secreta";
                } else if (r >= 17) {
                    tipo = "cerrada";
                } else if (r >= 15) {
                    tipo = "atrancada";
                }
                puertas.push({ x: i, y: j, tipo, cd: cds[tipo] || 0, sala: parseInt(zonas[sala[1]][sala[0]], 36),
                    vertical: sala[1] === j, pasillo: n });
            });
            pasillos.push({ a, b, secreto: !!secreto, celdas: celdasP });
        };
        for (let i = 1; i < salas.length; i++) {
            pasillo(i - 1, i, false);
        }
        for (let k = 0; k < Math.min(2, salas.length - 2); k++) {
            const a = azar(0, salas.length - 1);
            let b = azar(0, salas.length - 2);
            b = b >= a ? b + 1 : b;
            pasillo(a, b, k === 0);
        }
        // En las cavernas, se suaviza: la roca rodeada de suelo pasa a ser
        // suelo (así no quedan picos sueltos).
        if (cavernas) {
            for (let vuelta = 0; vuelta < 2; vuelta++) {
                const antes = celdas.map((f) => f.slice());
                for (let j = 1; j < DUNGEON_ALTO - 1; j++) {
                    for (let i = 1; i < DUNGEON_ANCHO - 1; i++) {
                        if (antes[j][i] !== 0) {
                            continue;
                        }
                        let suelo = 0;
                        for (let dj = -1; dj <= 1; dj++) {
                            for (let di = -1; di <= 1; di++) {
                                suelo += antes[j + dj][i + di] === 1 || antes[j + dj][i + di] === 2 ? 1 : 0;
                            }
                        }
                        if (suelo >= 5) {
                            celdas[j][i] = 2;
                            const cerca = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].find(([a, b]) => zonas[b][a] !== ".");
                            if (cerca) {
                                celdas[j][i] = 1;
                                zonas[j][i] = zonas[cerca[1]][cerca[0]];
                            }
                        }
                    }
                }
            }
        }
        return { estilo: cavernas ? "cavernas" : "salas", filas: celdas.map((f) => f.join("")), zonas: zonas.map((f) => f.join("")),
            salas: salas.map(({ x, y, w, h, cx, cy }) => ({ x, y, w, h, cx, cy })), pasillos, puertas };
    }

    // EL MAPA EN UN CANVAS (de colores fijos, como un pergamino). Para el
    // máster, todo: los números, la entrada, los pasillos secretos (a rayas
    // rojas) y las puertas con lo que son. Para los jugadores («vistas»:
    // las salas descubiertas; «encontrados»: los pasillos secretos que ya
    // se saben), solo lo descubierto, sin números ni secretos.
    function pintarMapa(lienzoMapa, mapa, op) {
        op = op || {};
        const jug = !!op.jugadores;
        const vistas = new Set(op.vistas || []);
        const encontrados = new Set(op.encontrados || []);
        const c = DUNGEON_CELDA;
        lienzoMapa.width = DUNGEON_ANCHO * c;
        lienzoMapa.height = DUNGEON_ALTO * c;
        const ctx = lienzoMapa.getContext("2d");
        ctx.fillStyle = "#3a332b";
        ctx.fillRect(0, 0, lienzoMapa.width, lienzoMapa.height);
        // Qué se ve: en el del máster, todo.
        const pasilloVisto = (p, i) => (!p.secreto || encontrados.has(i)) && (vistas.has(p.a) || vistas.has(p.b));
        const vista = new Set();
        if (jug) {
            (mapa.pasillos || []).forEach((p, i) => {
                if (pasilloVisto(p, i)) {
                    p.celdas.forEach(([x, y]) => vista.add(x + "," + y));
                }
            });
        }
        const seVe = (i, j, v) => {
            if (!jug) {
                return true;
            }
            if (v === "1") {
                return vistas.has(parseInt(mapa.zonas[j][i], 36));
            }
            return vista.has(i + "," + j);
        };
        const pisables = [];
        mapa.filas.forEach((fila, j) => {
            Array.from(fila).forEach((v, i) => {
                if (v === "0" || !seVe(i, j, v)) {
                    return;
                }
                ctx.fillStyle = v === "1" ? "#efe2bf" : v === "3" && !jug ? "#e3c3a8" : "#d9c79c";
                ctx.fillRect(i * c, j * c, c, c);
                pisables.push([i, j, v]);
            });
        });
        ctx.strokeStyle = "rgba(59, 42, 23, 0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        pisables.forEach(([i, j]) => ctx.rect(i * c + 0.5, j * c + 0.5, c - 1, c - 1));
        ctx.stroke();
        // Los pasillos secretos, a rayas rojas (solo el máster).
        if (!jug) {
            ctx.strokeStyle = "#a3261a";
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            pisables.filter((x) => x[2] === "3").forEach(([i, j]) => ctx.strokeRect(i * c + 3, j * c + 3, c - 6, c - 6));
            ctx.setLineDash([]);
        }
        // Las puertas.
        (mapa.puertas || []).forEach((p) => {
            const secreta = p.tipo === "secreta";
            if (jug && (!vista.has(p.x + "," + p.y) || (secreta && !encontrados.has(p.pasillo)))) {
                return;
            }
            const x = p.x * c;
            const y = p.y * c;
            ctx.fillStyle = secreta && !jug ? "#a3261a" : "#6b4423";
            if (p.vertical) {
                ctx.fillRect(x + c * 0.35, y + 1, c * 0.3, c - 2);
            } else {
                ctx.fillRect(x + 1, y + c * 0.35, c - 2, c * 0.3);
            }
            // Lo que es (solo el máster): C cerrada con llave, A atrancada,
            // S secreta.
            if (!jug && p.tipo !== "normal") {
                ctx.fillStyle = "#1d1b26";
                ctx.fillRect(x + c * 0.15, y + c * 0.15, c * 0.7, c * 0.7);
                ctx.font = "bold " + Math.round(c * 0.6) + "px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "#fdfaf0";
                ctx.fillText({ secreta: "S", cerrada: "C", atrancada: "A" }[p.tipo], x + c / 2, y + c / 2 + 1);
            }
        });
        if (jug) {
            return;
        }
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        mapa.salas.forEach((s, i) => {
            const x = (s.cx + 0.5) * c;
            const y = (s.cy + 0.5) * c;
            ctx.fillStyle = "#7a1c12";
            ctx.beginPath();
            ctx.arc(x, y, c * 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#fdfaf0";
            ctx.font = "bold " + Math.round(c * 0.85) + "px sans-serif";
            ctx.fillText(String(i + 1), x, y + 1);
        });
        if (mapa.salas[0]) {
            const s = mapa.salas[0];
            ctx.fillStyle = "#2e7d32";
            ctx.font = "bold " + Math.round(c * 0.7) + "px sans-serif";
            ctx.fillText("entrada", (s.x + s.w / 2) * c, (s.y + s.h) * c - c * 0.6);
        }
    }

    function montarDungeon(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        Promise.all([pedir(TABLAS), pedir(BESTIARIO), pedir(TIENDA)]).then(([tablas, best, tienda]) => {
            const d = m.datos;
            const t = tablas.dungeon;
            const porEn = {};
            best.monstruos.forEach((b) => {
                porEn[b.en] = b;
            });
            const objetos = {};
            tienda.objetos.forEach((o) => {
                objetos[o.en] = o;
            });
            const tema = elegirDe("master-dungeon-tema-" + m.id, "qué es", Object.keys(t.temas).map((k) => [k, t.temas[k].emoji + " " +
                t.temas[k].nombre]), d.tema || "cripta");
            const tamano = elegirDe("master-dungeon-tam-" + m.id, "tamaño", DUNGEON_TAMANOS, d.salas || "8");
            const enParty = estado.modulos.filter((x) => x.tipo === "party").reduce((n, x) => n + ((x.datos && x.datos.pjs) || []).length, 0);
            const numero = (id, texto, valor, min, max) => {
                const caja = crear("div", "master-campo");
                const et = crear("label", "oc-dados-etiqueta", texto);
                const x = crear("input", "master-elegir");
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
            const nivel = numero("master-dungeon-nivel-", "nivel de la party", d.nivel || 3, 1, 20);
            const pjs = numero("master-dungeon-pjs-", "cuántos PJ", d.pjs || enParty || 4, 1, 10);
            const estilo = elegirDe("master-dungeon-estilo-" + m.id, "estilo del mapa", [["", "según el sitio"], ["salas", "salas y puertas"],
                ["cavernas", "cavernas"]], d.estilo || "");
            const fila = crear("div", "master-encuentro-fila");
            fila.append(tema, tamano, nivel, pjs, estilo);
            // El del máster (todo) o el de los jugadores (lo descubierto).
            const vista = botonesDe("qué mapa se ve", [["master", "🧙 el del máster"], ["jugadores", "👥 el de los jugadores"]],
                d.vista || "master", (v) => {
                    d.vista = v;
                    guardar();
                    pintar();
                });
            const mapaLienzo = crear("canvas", "master-dungeon-mapa");
            mapaLienzo.setAttribute("role", "img");
            const salasLista = crear("ol", "master-dungeon-salas");
            salasLista.setAttribute("aria-label", "Las salas");
            const botones = crear("div", "master-notas-botones");

            const generar = () => {
                d.tema = tema.elegir.value;
                d.salas = tamano.elegir.value;
                d.nivel = Math.min(20, Math.max(1, parseInt(nivel.elegir.value, 10) || 1));
                d.pjs = Math.min(10, Math.max(1, parseInt(pjs.elegir.value, 10) || 1));
                const tm = t.temas[d.tema];
                d.estilo = estilo.elegir.value;
                const [, cdBase] = DUNGEON_TRAMPA.find((x) => d.nivel <= x[0]);
                const mapa = hacerMapa(parseInt(d.salas, 10), d.estilo || (d.tema === "cueva" ? "cavernas" : "salas"),
                    { cerrada: cdBase + 1, atrancada: cdBase + 2, secreta: cdBase });
                d.vistas = [0];
                d.encontrados = [];
                // Los monstruos que pegan con el sitio (por tipo y hábitat);
                // si son pocos, también los de su hábitat.
                let bichos = best.monstruos.filter((b) => tm.tipos.some((x) => b.tipo.indexOf(x) === 0) &&
                    (!tm.habitat || (b.habitat || []).some((h) => h === tm.habitat || h === "cualquiera")));
                if (bichos.length < 8) {
                    bichos = best.monstruos.filter((b) => tm.tipos.some((x) => b.tipo.indexOf(x) === 0));
                }
                const franja = d.nivel <= 4 ? 0 : d.nivel <= 10 ? 1 : d.nivel <= 16 ? 2 : 3;
                const [, cd, dano] = DUNGEON_TRAMPA.find((x) => d.nivel <= x[0]);
                const usadas = new Set();
                const unaDe = (lista) => {
                    const libres = lista.filter((x) => !usadas.has(x));
                    const x = alAzar(libres.length ? libres : lista);
                    usadas.add(x);
                    return x;
                };
                const salas = mapa.salas.map((s, i) => {
                    const ultima = i === mapa.salas.length - 1;
                    const sala = { que: unaDe(tm.salas), detalle: alAzar(tm.detalles) };
                    const tirada = i === 0 ? 6 : tiradaSuelta("1d6");
                    if (ultima || tirada <= 2 || tirada === 4) {
                        const enc = hacerEncuentro(bichos, "", d.nivel, d.pjs, ultima ? 0.6 : 0.3);
                        sala.bichos = enc.grupos;
                        sala.hacen = enc.hacen;
                    }
                    if (tirada === 3 || (tirada === 5 && tiradaSuelta("1d2") === 1)) {
                        const tr = alAzar(t.trampas);
                        sala.trampa = { nombre: tr.nombre, texto: tr.texto.replace(/\{cd\}/g, cd).replace(/\{dano\}/g, dano) };
                    }
                    if (ultima || tirada === 4 || tirada === 5) {
                        sala.botin = hacerBotin(tienda.objetos, franja, ultima || tirada === 5 ? "tesoro" : "uno");
                        sala.donde = alAzar(t.tesoros_sala);
                    }
                    return sala;
                });
                d.mapa = mapa;
                d.contenido = salas;
                guardar();
                pintar();
                avisar("Dungeon nuevo: " + tm.nombre + " de " + salas.length + " salas.");
            };
            const botinTexto = (r) => {
                const partes = r.monedas.filter((x) => x[1]).map((x) => x[1].toLocaleString("es-ES") + " " + x[0]);
                r.cosas.forEach((c) => partes.push((c.n > 1 ? c.n + " × " : "") + c.texto + " (" + c.valor + " po)"));
                return partes.join(", ");
            };
            function pintar() {
                if (!d.mapa) {
                    mapaLienzo.hidden = true;
                    salasLista.replaceChildren(crear("li", "oc-vacio", "Elige y pulsa «generar»."));
                    botones.hidden = true;
                    leyenda.hidden = true;
                    return;
                }
                mapaLienzo.hidden = false;
                botones.hidden = false;
                d.vistas = d.vistas || [0];
                d.encontrados = d.encontrados || [];
                const deJugadores = d.vista === "jugadores";
                pintarVista();
                leyenda.hidden = deJugadores || d.mapa.estilo === "cavernas";
                descubrir.hidden = tapar.hidden = !deJugadores;
                salasLista.replaceChildren(...d.contenido.map((s, i) => {
                    const li = crear("li", "master-dungeon-sala");
                    const h = crear("h3", "master-dungeon-sala-titulo", "Sala " + (i + 1) + (i === 0 ? " (entrada)" : "") +
                        (i === d.contenido.length - 1 ? " (la última)" : ""));
                    const desc = crear("p", "", "Es " + s.que + "; " + s.detalle + ".");
                    // ¿La han descubierto ya? (Sale en el mapa de los jugadores.)
                    const etVista = crear("label", "master-nombres-apellido");
                    const caja = crear("input");
                    caja.type = "checkbox";
                    caja.checked = d.vistas.indexOf(i) >= 0;
                    caja.addEventListener("change", () => {
                        d.vistas = d.vistas.filter((x) => x !== i).concat(caja.checked ? [i] : []);
                        guardar();
                        pintarVista();
                        avisar("Sala " + (i + 1) + (caja.checked ? " descubierta." : " tapada."));
                    });
                    etVista.append(caja, document.createTextNode(" descubierta (sale en el mapa de los jugadores)"));
                    li.append(h, desc, etVista);
                    if (s.bichos && s.bichos.length) {
                        const p = crear("p", "master-dungeon-cosa");
                        p.append(crear("strong", "", "Monstruos: "));
                        s.bichos.forEach((g, k) => {
                            const b = porEn[g.en];
                            if (!b) {
                                return;
                            }
                            if (k) {
                                p.appendChild(document.createTextNode(" y "));
                            }
                            const ver = botonDe("master-botin-objeto", (g.n > 1 ? g.n + " × " : "") + b.nombre, () => abrirBicho(b, ver, best.fuente),
                                "Ver " + b.nombre);
                            p.appendChild(ver);
                        });
                        p.appendChild(document.createTextNode(" (están " + s.hacen + ")."));
                        const ini = botonDe("oc-vida-accion", "⚔️ a la iniciativa", () => {
                            const entran = [];
                            s.bichos.forEach((g) => {
                                const b = porEn[g.en];
                                for (let k = 0; k < g.n && b; k++) {
                                    entran.push(meterEnIniciativa(iniDeBicho(b),
                                        (nombres, renombrar) => conNumero(b.nombre, nombres, renombrar)));
                                }
                            });
                            avisar("A la iniciativa: " + entran.filter(Boolean).join(", ") + ".");
                        }, "Los monstruos de la sala " + (i + 1) + " a la iniciativa");
                        li.append(p, ini);
                    }
                    if (s.trampa) {
                        const p = crear("p", "master-dungeon-cosa");
                        p.append(crear("strong", "", "Trampa: " + s.trampa.nombre + ". "), document.createTextNode(s.trampa.texto));
                        if (window.ocDadosEnTexto) {
                            window.ocDadosEnTexto(p);
                        }
                        li.appendChild(p);
                    }
                    if (s.botin) {
                        const p = crear("p", "master-dungeon-cosa");
                        p.append(crear("strong", "", "Botín (" + s.donde + "): "), document.createTextNode(botinTexto(s.botin)));
                        s.botin.objetos.forEach((en) => {
                            const o = objetos[en];
                            if (!o) {
                                return;
                            }
                            p.appendChild(document.createTextNode(", "));
                            const ver = botonDe("master-botin-objeto", "✨ " + o.nombre, () => abrirObjeto(o, ver, tienda.fuente), "Ver " + o.nombre);
                            p.appendChild(ver);
                        });
                        p.appendChild(document.createTextNode("."));
                        li.appendChild(p);
                    }
                    if (!s.bichos && !s.trampa && !s.botin) {
                        li.appendChild(crear("p", "master-dungeon-cosa", "No hay nada más (o eso parece)."));
                    }
                    // Sus puertas especiales (cerradas, atrancadas, secretas).
                    (d.mapa.puertas || []).filter((pu) => pu.sala === i && pu.tipo !== "normal").forEach((pu) => {
                        const pas = d.mapa.pasillos[pu.pasillo] || {};
                        const otra = pas.a === i ? pas.b : pas.a;
                        const p = crear("p", "master-dungeon-cosa");
                        const que = {
                            cerrada: "Puerta cerrada con llave hacia la sala " + (otra + 1) + ": se abre con herramientas de ladrón (Destreza CD " +
                                pu.cd + ") o se echa abajo (Fuerza (Atletismo) CD " + (pu.cd + 2) + ").",
                            atrancada: "Puerta atrancada por el otro lado (hacia la sala " + (otra + 1) + "): Fuerza (Atletismo) CD " + pu.cd +
                                " para forzarla; hace ruido.",
                            secreta: "Puerta secreta a un pasillo oculto que lleva a la sala " + (otra + 1) + ": Sabiduría (Percepción) CD " +
                                pu.cd + " para verla.",
                        }[pu.tipo];
                        p.append(crear("strong", "", "🚪 "), document.createTextNode(que));
                        li.appendChild(p);
                        if (pu.tipo === "secreta") {
                            const etE = crear("label", "master-nombres-apellido");
                            const enc = crear("input");
                            enc.type = "checkbox";
                            enc.checked = d.encontrados.indexOf(pu.pasillo) >= 0;
                            enc.addEventListener("change", () => {
                                d.encontrados = d.encontrados.filter((x) => x !== pu.pasillo).concat(enc.checked ? [pu.pasillo] : []);
                                guardar();
                                pintarVista();
                                avisar(enc.checked ? "Pasillo secreto encontrado." : "Pasillo secreto escondido otra vez.");
                            });
                            etE.append(enc, document.createTextNode(" la han encontrado"));
                            li.appendChild(etE);
                        }
                    });
                    return li;
                }));
            }
            // El mapa que toca (el del máster o el de los jugadores).
            function pintarVista() {
                // (Los de antes no tienen zonas: solo el del máster.)
                const deJugadores = d.vista === "jugadores" && !!d.mapa.zonas;
                pintarMapa(mapaLienzo, d.mapa, deJugadores ? { jugadores: true, vistas: d.vistas, encontrados: d.encontrados } : {});
                const tm = t.temas[d.tema] || { nombre: "dungeon" };
                mapaLienzo.setAttribute("aria-label", deJugadores ? "Mapa de los jugadores: se ven " + d.vistas.length + " de " +
                    d.mapa.salas.length + " salas, sin números ni secretos." : "Mapa de " + tm.nombre + ": " + d.mapa.salas.length +
                    " salas numeradas unidas por pasillos; la 1 es la entrada. Lo que hay en cada una, en la lista de debajo.");
            }
            const boton = botonDe("oc-vida-accion es-principal master-nombres-generar", "🎲 generar dungeon", generar);
            const alDibujo = botonDe("oc-vida-accion", "🎨 al dibujo", () => {
                const l = crear("canvas");
                pintarMapa(l, d.mapa);
                anadir("dibujo", { titulo: "mapa: " + ((t.temas[d.tema] || {}).nombre || "dungeon"), w: 900, h: 700,
                    datos: { ancho: l.width, alto: l.height, capas: [{ id: "c1", tipo: "capa", nombre: "mapa", visible: true, opacidad: 100,
                        imagen: l.toDataURL("image/png") }, { id: "c2", tipo: "capa", nombre: "notas", visible: true, opacidad: 100, imagen: "" }],
                    activa: "c2", rejilla: { ver: false, tipo: "cuadrada", tam: DUNGEON_CELDA, color: "#000000", opacidad: 40 } } });
            }, "Pasar el mapa a una ventana de dibujo, para pintar encima");
            const copiar = botonDe("oc-vida-accion", "⧉ copiar las salas", () => copiarTexto(Array.from(salasLista.children).map((li) => li.innerText)
                .join("\n\n"), "Copiado el dungeon."), "Copiar las salas (texto)");
            // La imagen del mapa: copiarla (para pegarla en otro sitio) o
            // descargarla en PNG.
            const copiarImagen = botonDe("oc-vida-accion", "🖼️ copiar la imagen", () => {
                if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) {
                    avisar("Este navegador no deja copiar imágenes: descárgala.");
                    return;
                }
                mapaLienzo.toBlob((blob) => {
                    navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
                        .then(() => avisar("Copiada la imagen del mapa."))
                        .catch(() => avisar("No se ha podido copiar la imagen: descárgala."));
                }, "image/png");
            }, "Copiar la imagen del mapa");
            const bajarImagen = botonDe("oc-vida-accion", "⬇ descargar la imagen", () => {
                const a = crear("a");
                a.href = mapaLienzo.toDataURL("image/png");
                a.download = "dungeon-" + (d.tema || "mapa") + ".png";
                document.body.appendChild(a);
                a.click();
                a.remove();
                avisar("Descargado: " + a.download + ".");
            }, "Descargar la imagen del mapa (PNG)");
            const ensenar = botonDe("oc-vida-accion es-principal", "👁️ enseñar a la mesa", () => {
                const l = crear("canvas", "master-dungeon-mapa es-grande");
                pintarMapa(l, d.mapa, { jugadores: true, vistas: d.vistas, encontrados: d.encontrados });
                l.setAttribute("role", "img");
                l.setAttribute("aria-label", "Mapa de los jugadores: lo descubierto.");
                window.ocVentana.abrir({ titulo: "el mapa", cuerpo: l, vuelta: ensenar, clase: "es-ancha" });
            }, "Enseñar en grande el mapa de los jugadores (solo lo descubierto)");
            const descubrir = botonDe("oc-vida-accion", "☀️ descubrir todas", () => {
                d.vistas = d.mapa.salas.map((x, i) => i);
                guardar();
                pintar();
                avisar("Todas las salas descubiertas.");
            });
            const tapar = botonDe("oc-vida-accion", "🌑 tapar todas", () => {
                d.vistas = [0];
                guardar();
                pintar();
                avisar("Tapadas todas menos la entrada.");
            });
            botones.append(ensenar, copiarImagen, bajarImagen, alDibujo, copiar, descubrir, tapar);
            const leyenda = crear("p", "oc-hoja-nota master-dungeon-leyenda",
                "Puertas: C cerrada con llave, A atrancada, S secreta; a rayas rojas, el pasillo secreto. Copiar y descargar, el mapa que se ve.");
            const arriba = crear("div", "master-nombres-form");
            arriba.append(fila, boton, vista);
            dentro.replaceChildren(arriba, mapaLienzo, leyenda, botones, salasLista,
                crear("p", "oc-hoja-nota master-fuente", "Salas, trampas, gemas y arte: tablas propias. Monstruos y objetos: SRD 5.2 (CC BY 4.0)."));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar las tablas."));
        });
    }

    // ---- LOS EFECTOS CON DURACIÓN: «Bendecir en Thia, 1 minuto»,
    // «Armadura de mago, 8 horas»… Se cuentan en segundos de juego (una
    // ronda, 6) y se descuentan solos: con las rondas de la iniciativa (el
    // evento «oc-iniciativa:guardada» de personajes.js) y con el tiempo
    // del calendario («master:tiempo»); también a mano. Escribiendo el
    // nombre de un conjuro del SRD, se pone solo su duración. ----
    const UNIDADES = [["rondas", "rondas", 6], ["minutos", "minutos", 60], ["horas", "horas", 3600], ["dias", "días", 86400]];

    // «Concentración, hasta 10 minutos» → {n: 10, unidad: "minutos", conc}.
    function duracionDe(texto) {
        const t = llano(texto);
        const m = /(\d+)\s*(asalto|ronda|minuto|hora|dia)/.exec(t);
        if (!m) {
            return null;
        }
        const unidad = { asalto: "rondas", ronda: "rondas", minuto: "minutos", hora: "horas", dia: "dias" }[m[2]];
        return { n: parseInt(m[1], 10), unidad, conc: t.indexOf("concentracion") >= 0 };
    }

    function cuantoQueda(seg) {
        if (seg <= 0) {
            return "se ha acabado";
        }
        if (seg < 60) {
            const r = Math.ceil(seg / 6);
            return r + (r === 1 ? " ronda" : " rondas");
        }
        if (seg < 3600) {
            const mi = Math.ceil(seg / 60);
            return mi + (mi === 1 ? " minuto" : " minutos") + (mi <= 10 ? " (" + Math.ceil(seg / 6) + " rondas)" : "");
        }
        if (seg < 86400) {
            const minutos = Math.ceil(seg / 60);
            const h = Math.floor(minutos / 60);
            const mi = minutos % 60;
            return h + " h" + (mi ? " " + mi + " min" : "");
        }
        const horas = Math.ceil(seg / 3600);
        const di = Math.floor(horas / 24);
        const h = horas % 24;
        return di + (di === 1 ? " día" : " días") + (h ? " " + h + " h" : "");
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
        const form = crear("form", "master-efecto-nuevo");
        const etN = crear("label", "oc-dados-etiqueta", "qué es (un conjuro del SRD pone su duración)");
        const nombre = crear("input", "master-elegir");
        nombre.id = "master-efecto-nombre-" + m.id;
        etN.htmlFor = nombre.id;
        nombre.placeholder = "Bendecir, Armadura de mago, veneno…";
        const lista = crear("datalist");
        lista.id = "master-efecto-conjuros-" + m.id;
        nombre.setAttribute("list", lista.id);
        const sobre = elegirDe("master-efecto-sobre-" + m.id, "sobre quién", [["", "—"]], "");
        const numero = crear("input", "master-elegir");
        numero.type = "number";
        numero.min = 1;
        numero.value = 1;
        numero.setAttribute("aria-label", "Cuánto dura");
        const unidad = crear("select", "master-elegir");
        unidad.setAttribute("aria-label", "En qué");
        UNIDADES.forEach(([v, n]) => {
            const o = crear("option", "", n);
            o.value = v;
            unidad.appendChild(o);
        });
        unidad.value = "minutos";
        const etDura = crear("p", "oc-dados-etiqueta", "cuánto dura");
        etDura.setAttribute("aria-hidden", "true");
        const dura = crear("div", "master-efecto-dura");
        dura.append(numero, unidad);
        const etConc = crear("label", "master-nombres-apellido");
        const conc = crear("input");
        conc.type = "checkbox";
        etConc.append(conc, document.createTextNode(" de concentración"));
        const anadirE = crear("button", "oc-vida-accion es-principal", "＋ efecto");
        anadirE.type = "submit";
        form.append(etN, nombre, lista, sobre, etDura, dura, etConc, anadirE);
        let conjuros = [];
        pedir(CONJUROS_SRD).then((c) => {
            conjuros = c.conjuros || [];
            conjuros.filter((x) => duracionDe(x.dur || "")).forEach((x) => {
                const o = crear("option");
                o.value = x.nombre;
                lista.appendChild(o);
            });
        }).catch(() => {});
        nombre.addEventListener("change", () => {
            const c = conjuros.find((x) => llano(x.nombre) === llano(nombre.value));
            const du = c && duracionDe(c.dur || "");
            if (du) {
                numero.value = du.n;
                unidad.value = du.unidad;
                conc.checked = du.conc;
                avisar(c.nombre + ": " + c.dur + ".");
            }
        });
        // Los de la iniciativa, para «sobre quién».
        const pintarQuien = () => {
            const ahora = sobre.elegir.value;
            const nombres = (leerIni().lista || []).map((x) => x.nombre);
            sobre.elegir.replaceChildren(...[["", "—"]].concat(nombres.map((x) => [x, x])).map(([v, n]) => {
                const o = crear("option", "", n);
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
            guardar();
            pintar();
            avisar("Efecto: " + ef.nombre + (ef.sobre ? " en " + ef.sobre : "") + ", " + cuantoQueda(seg) + ".");
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
            guardar();
            pintar();
            if (acaban.length) {
                avisar("Se acaba: " + acaban.join(", ") + ".");
            } else if (porque) {
                avisar(porque);
            }
        };
        const aMano = crear("div", "master-cal-tiempo");
        aMano.setAttribute("role", "group");
        aMano.setAttribute("aria-label", "Que pase el tiempo a mano");
        [["+1 ronda", 6], ["+1 minuto", 60], ["+10 minutos", 600], ["+1 hora", 3600]].forEach(([t, seg]) => {
            aMano.appendChild(botonDe("oc-vida-accion", t, () => pasar(seg, "Pasa " + t.slice(1) + ".")));
        });
        const listaE = crear("ul", "master-efectos");
        listaE.setAttribute("aria-label", "Efectos");
        const quitarAcabados = botonDe("oc-vida-accion", "🧹 quitar los acabados", () => {
            d.efectos = d.efectos.filter((x) => x.quedan > 0);
            guardar();
            pintar();
            avisar("Quitados los que se habían acabado.");
        });
        function pintar() {
            listaE.replaceChildren(...d.efectos.map((ef, i) => {
                const li = crear("li", "master-efecto" + (ef.quedan <= 0 ? " es-acabado" : ""));
                const cab = crear("p", "master-efecto-nombre");
                cab.append(crear("strong", "", ef.nombre), document.createTextNode((ef.sobre ? " · " + ef.sobre : "") + (ef.conc ? " · 🧠 concentración" : "")));
                const barra = crear("div", "master-efecto-barra");
                barra.setAttribute("role", "meter");
                barra.setAttribute("aria-valuemin", "0");
                barra.setAttribute("aria-valuemax", String(ef.total));
                barra.setAttribute("aria-valuenow", String(ef.quedan));
                barra.setAttribute("aria-valuetext", "Queda: " + cuantoQueda(ef.quedan));
                barra.setAttribute("aria-label", ef.nombre);
                const lleno = crear("span", "master-efecto-lleno");
                lleno.style.setProperty("--parte", Math.round(100 * ef.quedan / Math.max(1, ef.total)) + "%");
                barra.appendChild(lleno);
                const queda = crear("p", "master-efecto-queda", ef.quedan > 0 ? "Queda: " + cuantoQueda(ef.quedan) : "⌛ Se ha acabado");
                const quitar = botonDe("master-nombre-boton", "✕", () => {
                    d.efectos.splice(i, 1);
                    guardar();
                    pintar();
                    avisar("Quitado: " + ef.nombre + ".");
                    nombre.focus();
                }, "Quitar " + ef.nombre);
                const fila = crear("div", "master-efecto-fila");
                fila.append(cab, quitar);
                li.append(fila, barra, queda);
                return li;
            }));
            if (!d.efectos.length) {
                listaE.appendChild(crear("li", "oc-vacio", "Sin efectos. Añade uno arriba."));
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
                pasar((r - antes) * 6, "Ronda " + r + ".");
            } else {
                guardar();
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
        const etTiempo = crear("p", "oc-hoja-nota", "Se descuentan solos con las rondas de la iniciativa y el tiempo del calendario; o a mano:");
        dentro.append(form, etTiempo, aMano, listaE, quitarAcabados);
        pintarQuien();
        pintar();
    }

    // ---- NEGOCIOS: tabernas y posadas, tiendas y servicios, según lo
    // buenos que sean (pobre, modesta, acomodada, lujosa): nombre (del
    // generador o con el nombre de quien lo lleva), ambiente, quién está
    // al frente (un PNJ rápido), lo que vende con su precio, servicios y
    // un gancho. La taberna, con su carta, sus habitaciones y un rumor
    // (master-tablas.json, «taberna»); las tiendas venden los objetos del
    // SRD de tienda.json (lo de su tienda, hasta un tope según lo buenas
    // que sean; la de magia, hasta una rareza) y el resto es de tablas
    // propias (master-tablas.json, «negocios»). Se copia, se guarda como
    // texto o como imagen. ----
    function descargarArchivo(blob, archivo) {
        const a = crear("a");
        const archivoBlob = URL.createObjectURL(blob);
        a.href = archivoBlob;
        a.download = archivo;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(archivoBlob), 1000);
        avisar("Descargado: " + archivo + ".");
    }

    const precioDe = (cp) => (cp ? moneda(cp) : "a convenir");

    // Un negocio de antes (sólo taberna, en m.datos.taberna) al de ahora.
    function negocioDeTaberna(x) {
        return {
            tipo: "taberna", calidad: x.calidad, nombre: x.nombre, emoji: "🍺", ambiente: x.ambiente, quien: x.quien,
            destacado: ["⭐ Especialidad de la casa:", x.especialidad[0] + " — " + moneda(x.especialidad[1])],
            secciones: [{ titulo: "🍷 Bebidas", filas: x.bebidas }, { titulo: "🍲 Comidas", filas: x.comidas },
                { titulo: "🛏️ Habitaciones (por noche)", filas: x.habitaciones }],
            gancho: ["👂 Se oye que", x.rumor + "."],
        };
    }

    function negocioEnTexto(x, nombreTipo) {
        const lineas = [x.nombre + " — " + nombreTipo + " (" + x.calidad + ")", "",
            x.ambiente.charAt(0).toUpperCase() + x.ambiente.slice(1) + ".", "Al frente: " + x.quien + "."];
        if (x.destacado) {
            lineas.push("", x.destacado.join(" "));
        }
        x.secciones.forEach((s) => {
            lineas.push("", s.titulo.replace(/^\S+\s/u, "").toUpperCase());
            s.filas.forEach(([n, cp, extra]) => lineas.push("· " + n + ": " + precioDe(cp) + (extra ? " (" + extra + ")" : "")));
        });
        lineas.push("", x.gancho.join(" "));
        return lineas.join("\n");
    }

    // La ficha en un canvas de colores fijos (pergamino), para bajarla.
    function negocioEnLienzo(x, nombreTipo) {
        const lienzo = crear("canvas");
        const ctx = lienzo.getContext("2d");
        const ancho = 820;
        const margen = 54;
        const util = ancho - margen * 2;
        const letra = (tam, estilo) => estilo + " " + tam + "px Georgia, 'Times New Roman', serif";
        const pasos = [];
        let y = margen;
        const trocear = (texto, max) => {
            const salen = [];
            let linea = "";
            texto.split(" ").forEach((p) => {
                const prueba = linea ? linea + " " + p : p;
                if (linea && ctx.measureText(prueba).width > max) {
                    salen.push(linea);
                    linea = p;
                } else {
                    linea = prueba;
                }
            });
            salen.push(linea);
            return salen;
        };
        const parrafo = (texto, tam, estilo, color) => {
            ctx.font = letra(tam, estilo);
            trocear(texto, util).forEach((l) => {
                pasos.push({ texto: l, x: margen, y, font: ctx.font, color });
                y += Math.round(tam * 1.4);
            });
        };
        parrafo(x.emoji + " " + x.nombre, 34, "bold", "#3b2a17");
        parrafo(nombreTipo + " · " + x.calidad, 18, "italic", "#6b4e2a");
        y += 10;
        parrafo(x.ambiente.charAt(0).toUpperCase() + x.ambiente.slice(1) + ". Al frente: " + x.quien + ".", 18, "normal", "#3b2a17");
        if (x.destacado) {
            y += 6;
            parrafo(x.destacado.join(" "), 18, "bold", "#3b2a17");
        }
        x.secciones.forEach((s) => {
            y += 18;
            parrafo(s.titulo, 22, "bold", "#7a1f12");
            pasos.push({ raya: true, y: y - 4 });
            y += 6;
            s.filas.forEach(([n, cp, extra]) => {
                ctx.font = letra(18, "bold");
                const precio = precioDe(cp);
                const anchoPrecio = ctx.measureText(precio).width;
                ctx.font = letra(18, "normal");
                const lineas = trocear(n, util - anchoPrecio - 24);
                pasos.push({ texto: precio, x: ancho - margen, y, font: letra(18, "bold"), color: "#3b2a17", derecha: true });
                lineas.forEach((l) => {
                    pasos.push({ texto: l, x: margen, y, font: letra(18, "normal"), color: "#3b2a17" });
                    y += 26;
                });
                if (extra) {
                    ctx.font = letra(15, "italic");
                    trocear(extra, util - anchoPrecio - 24).forEach((l) => {
                        pasos.push({ texto: l, x: margen + 14, y, font: ctx.font, color: "#6b4e2a" });
                        y += 21;
                    });
                }
                y += 4;
            });
        });
        y += 14;
        parrafo(x.gancho.join(" "), 18, "italic", "#3b2a17");
        lienzo.width = ancho;
        lienzo.height = y + margen;
        ctx.fillStyle = "#efe2bf";
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);
        ctx.strokeStyle = "#8a6a3a";
        ctx.lineWidth = 6;
        ctx.strokeRect(14, 14, lienzo.width - 28, lienzo.height - 28);
        ctx.textBaseline = "top";
        pasos.forEach((p) => {
            if (p.raya) {
                ctx.strokeStyle = "#8a6a3a";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(margen, p.y);
                ctx.lineTo(ancho - margen, p.y);
                ctx.stroke();
                return;
            }
            ctx.font = p.font;
            ctx.fillStyle = p.color;
            ctx.textAlign = p.derecha ? "right" : "left";
            ctx.fillText(p.texto, p.x, p.y);
        });
        return lienzo;
    }

    // Servicios de lanzamiento de conjuros (SRD 5.2), en pc, por nivel.
    const PRECIO_CONJURO = [3000, 5000, 20000, 30000, 200000, 200000, 2000000, 2000000, 2000000, 10000000];

    function montarNegocio(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        Promise.all([pedir(TABLAS), pedir(NOMBRES), pedir(TIENDA), pedir(CONJUROS_SRD)]).then(([tablas, nombres, tienda, conjuros]) => {
            const d = m.datos;
            if (d.taberna && !d.negocio) {
                d.negocio = negocioDeTaberna(d.taberna);
                delete d.taberna;
            }
            const t = tablas.taberna;
            const N = tablas.negocios;
            const tipo = elegirDe("master-negocio-tipo-" + m.id, "qué negocio",
                Object.keys(N.tipos).map((k) => [k, N.tipos[k].emoji + " " + N.tipos[k].nombre]), d.tipo || "taberna");
            tipo.elegir.addEventListener("change", () => {
                d.tipo = tipo.elegir.value;
                guardar();
            });
            const calidad = botonesDe("lo bueno que es", Object.keys(N.calidades).map((k) => [k, k]),
                d.calidad || "modesta", (v) => {
                    d.calidad = v;
                    guardar();
                });
            const etCal = crear("p", "oc-dados-etiqueta", "lo bueno que es");
            etCal.setAttribute("aria-hidden", "true");
            const sale = crear("div", "master-negocio");
            sale.setAttribute("aria-live", "polite");
            const variosDe = (lista, n) => {
                const copia = lista.slice();
                const salen = [];
                while (copia.length && salen.length < n) {
                    salen.push(copia.splice(tiradaSuelta("1d" + copia.length) - 1, 1)[0]);
                }
                return salen;
            };
            const objetoDe = (nombre) => (tienda.objetos || []).find((o) => o.nombre === nombre);
            const conjuroDe = (en) => (conjuros.conjuros || []).find((c) => c.en === en);
            const fila = (o) => [o.nombre, o.cp, o.rareza || "", "o"];
            const asalariados = { cualificado: "Skilled Hireling", sin: "Untrained Hireling", mensajero: "Messenger" };
            // Los servicios: asalariados y conjuros (tabla «Servicios de
            // lanzamiento de conjuros» del SRD, más lo que cueste el
            // componente), hasta el nivel que haya según lo bueno que sea.
            const servicios = (tp, nivel) => {
                const filas = (tp.asalariados || []).map((k) => (tienda.objetos || []).find((o) => o.en === asalariados[k]))
                    .filter(Boolean).map(fila);
                (tp.conjuros || []).map(conjuroDe).filter((c) => c && c.nivel <= nivel).forEach((c) => {
                    const componente = /(\d[\d.]*) po/.exec(c.comp || "");
                    const extra = componente ? Number(componente[1].replace(/\./g, "")) * 100 : 0;
                    filas.push(["Lanzar " + c.nombre, PRECIO_CONJURO[c.nivel] + extra, (c.nivel ? "nivel " + c.nivel : "truco") +
                        (extra ? "; con el componente (" + moneda(extra) + ")" : ""), "c:" + c.en]);
                });
                return filas;
            };
            const generar = () => {
                const k = tipo.elegir.value;
                const tp = N.tipos[k];
                const cal = calidad.valor();
                const nc = N.calidades[cal];
                const g = alAzar(["f", "m"]);
                const especie = alAzar(Object.keys(nombres.especies));
                const dueno = nombreDe(nombres, especie, g, false);
                const quien = dueno + " (" + nombres.especies[especie].nombre + "), que " + alAzar(tablas.pnj.rasgos);
                const caro = (a, b) => a.cp - b.cp;
                if (k === "taberna") {
                    const tc = t.calidades[cal];
                    const deLaTaberna = (tienda.objetos || []).filter((o) => (o.tiendas || []).includes("Taberna"));
                    const deSuNivel = (o) => !/\(/.test(o.nombre) || /\(jarra|hogaza|cuña|1 día|botella\)/.test(o.nombre) ||
                        tc.estilos.some((e) => o.nombre.endsWith("(" + e + ")"));
                    const fino = cal === "acomodada" || cal === "lujosa";
                    const comer = deLaTaberna.filter((o) => o.cat !== "alojamiento" && deSuNivel(o) && (fino || o.en !== "Fine Wine (bottle)"))
                        .sort(caro).map(fila);
                    const dormir = deLaTaberna.filter((o) => o.cat === "alojamiento" && deSuNivel(o)).sort(caro).map(fila);
                    const rumor = alAzar(t.rumores);
                    d.negocio = {
                        tipo: k, calidad: cal, nombre: lugarDe(nombres, "taberna"), emoji: tp.emoji, ambiente: alAzar(tc.ambiente), quien,
                        destacado: null, secciones: [{ titulo: "🍺 Comida y bebida", filas: comer },
                            { titulo: "🛏️ Alojamiento (por noche)", filas: dormir },
                            { titulo: "🛠️ Servicios", filas: servicios(tp, nc.nivel) }],
                        gancho: ["👂 Se oye que", rumor + "."],
                    };
                } else {
                    let nombre;
                    if (alAzar([0, 1])) {
                        const [sust, gs] = alAzar(tp.sust);
                        const adj = alAzar(nombres.lugares.taberna.adj);
                        nombre = sust + " " + (gs === "f" ? adj[1] : adj[0]);
                    } else {
                        nombre = alAzar(tp.plantillas).replace("{d}", dueno);
                    }
                    const secciones = [];
                    const hay = (tienda.objetos || []).filter((o) => o.cp && (tp.objetos ? tp.objetos.includes(o.nombre)
                        : (o.tiendas || []).includes(tp.tienda)) && (k === "magia"
                        ? RAREZAS.indexOf(o.rareza) > -1 && RAREZAS.indexOf(o.rareza) < nc.rareza : !nc.tope || o.cp <= nc.tope));
                    if (hay.length) {
                        secciones.push({ titulo: "🛒 Lo que vende", filas: variosDe(hay, nc.cuantos).sort(caro).map(fila) });
                    }
                    const sv = servicios(tp, nc.nivel);
                    if (sv.length) {
                        secciones.push({ titulo: "🛠️ Servicios", filas: sv });
                    }
                    const gancho = alAzar(tp.ganchos);
                    d.negocio = {
                        tipo: k, calidad: cal, nombre, emoji: tp.emoji, ambiente: alAzar(tp.ambiente) + "; " + alAzar(nc.ambiente), quien,
                        destacado: null, secciones, gancho: ["🪝 Gancho:", gancho.charAt(0).toUpperCase() + gancho.slice(1) + "."],
                    };
                }
                guardar();
                pintar();
                avisar(tp.nombre.charAt(0).toUpperCase() + tp.nombre.slice(1) + ": " + d.negocio.nombre + ".");
            };
            const nombreTipo = () => (N.tipos[(d.negocio || {}).tipo] || N.tipos.taberna).nombre;
            const carta = (s) => {
                const sec = crear("div", "master-negocio-carta");
                sec.appendChild(crear("h4", "master-negocio-titulo", s.titulo));
                const dl = crear("dl", "master-negocio-lista");
                s.filas.forEach(([n, cp, extra, ref]) => {
                    const dt = crear("dt");
                    const c = typeof ref === "string" && ref.startsWith("c:") ? conjuroDe(ref.slice(2)) : null;
                    const o = !c && ref ? objetoDe(n) : null;
                    if (c) {
                        const ver = botonDe("master-botin-objeto", n, () => abrirConjuro(c, ver, conjuros.fuente), "Ver el conjuro " + c.nombre);
                        dt.appendChild(ver);
                    } else if (o) {
                        const ver = botonDe("master-botin-objeto", n, () => abrirObjeto(o, ver, tienda.fuente), "Ver " + n);
                        dt.appendChild(ver);
                    } else {
                        dt.textContent = n;
                    }
                    if (extra) {
                        dt.appendChild(crear("span", "master-negocio-extra", extra));
                    }
                    dl.append(dt, crear("dd", "", precioDe(cp)));
                });
                sec.appendChild(dl);
                return sec;
            };
            const acciones = crear("div", "master-negocio-acciones");
            function pintar() {
                const x = d.negocio;
                sale.replaceChildren();
                acciones.hidden = !x;
                if (!x) {
                    sale.appendChild(crear("p", "oc-vacio", "Elige el negocio, cómo es y pulsa «generar»."));
                    return;
                }
                const cab = crear("h3", "master-negocio-nombre", x.emoji + " " + x.nombre);
                const sub = crear("p", "master-negocio-tipo", nombreTipo() + " · " + x.calidad);
                const amb = crear("p", "master-negocio-ambiente", x.ambiente.charAt(0).toUpperCase() + x.ambiente.slice(1) +
                    ". Al frente: " + x.quien + ".");
                sale.append(cab, sub, amb);
                if (x.destacado) {
                    const esp = crear("p", "master-negocio-ambiente");
                    esp.append(crear("strong", "", x.destacado[0] + " "), document.createTextNode(x.destacado[1]));
                    sale.appendChild(esp);
                }
                x.secciones.forEach((s) => sale.appendChild(carta(s)));
                const gancho = crear("p", "master-negocio-ambiente");
                gancho.append(crear("strong", "", x.gancho[0] + " "), document.createTextNode(x.gancho[1]));
                sale.appendChild(gancho);
            }
            const archivo = (ext) => (d.negocio.nombre || "negocio").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() + "." + ext;
            acciones.append(
                botonDe("oc-vida-accion", "⧉ copiar", () => copiarTexto(negocioEnTexto(d.negocio, nombreTipo()), "Copiado."),
                    "Copiar el negocio como texto"),
                botonDe("oc-vida-accion", "📄 guardar como texto", () => descargarArchivo(new Blob([negocioEnTexto(d.negocio,
                    nombreTipo())], { type: "text/plain;charset=utf-8" }), archivo("txt"))),
                botonDe("oc-vida-accion", "🖼️ guardar como imagen", () => negocioEnLienzo(d.negocio, nombreTipo())
                    .toBlob((blob) => descargarArchivo(blob, archivo("png")), "image/png")));
            const boton = botonDe("oc-vida-accion es-principal master-nombres-generar", "🎲 generar negocio", generar);
            const arriba = crear("div", "master-nombres-form");
            arriba.append(tipo, etCal, calidad, boton);
            dentro.replaceChildren(arriba, sale, acciones, crear("p", "oc-hoja-nota master-fuente",
                "Lo que venden, los servicios y sus precios: SRD 5.2 (CC BY 4.0). Nombres, ambientes, rumores y ganchos: tablas propias."));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar las tablas."));
        });
    }

    // ---- UNA TABLA PARA TIRAR: una cosa por línea; «tirar» saca una al
    // azar (encuentros, nombres, el tiempo que hace…) ----
    function montarTabla(dentro, m) {
        m.datos = m.datos || {};
        const etX = crear("label", "oc-dados-etiqueta", "lo que puede salir (una cosa por línea)");
        const texto = crear("textarea", "oc-notas-texto es-corta");
        texto.id = "master-tabla-texto-" + m.id;
        texto.rows = 6;
        texto.value = m.datos.texto || "";
        etX.htmlFor = texto.id;
        const sale = crear("p", "master-tabla-sale");
        sale.setAttribute("role", "status");
        let espera = 0;
        const alEscribir = () => {
            clearTimeout(espera);
            espera = setTimeout(() => {
                m.datos.texto = texto.value;
                guardar();
            }, 400);
        };
        texto.addEventListener("input", alEscribir);
        const tirar = botonDe("oc-vida-accion es-principal", "🎲 tirar en la tabla", () => {
            const cosas = texto.value.split("\n").map((x) => x.trim()).filter(Boolean);
            if (!cosas.length) {
                sale.textContent = "Escribe primero lo que puede salir.";
                return;
            }
            const u = new Uint32Array(1);
            crypto.getRandomValues(u);
            const i = u[0] % cosas.length;
            sale.textContent = "";
            setTimeout(() => {
                sale.textContent = (i + 1) + " de " + cosas.length + ": " + cosas[i];
            }, 50);
        });
        dentro.append(etX, texto, tirar, sale);
    }

    // ---- EL BESTIARIO: los monstruos del SRD 5.2 (D&D 2024), traducidos
    // (datos/personajes/compendio/bestiario.json). Se buscan por nombre
    // (en español o en inglés), VD y tipo; cada uno abre su perfil en una
    // ventana, con «＋ a la iniciativa» (tira su iniciativa y lo apunta con
    // su CA y sus PG en «richi-oc-iniciativa»). ----
    const VDS = ["0", "1/8", "1/4", "1/2"].concat(Array.from({ length: 30 }, (x, i) => String(i + 1)));

    // «Lobo», y si ya hay uno, «Lobo 1» y «Lobo 2» (y «Lobo 3»…). «lista»
    // son los nombres que ya hay; «renombrar(viejo, nuevo)» cambia el que
    // estaba sin número.
    function conNumero(base, nombres, renombrar) {
        const patron = new RegExp("^" + base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?: (\\d+))?$");
        const iguales = nombres.map((n) => patron.exec(n)).filter(Boolean);
        if (!iguales.length) {
            return base;
        }
        let mayor = Math.max(0, ...iguales.map((x) => parseInt(x[1] || "0", 10)));
        if (iguales.some((x) => !x[1]) && renombrar) {
            // El que no tenía número, el 1 (o el siguiente, si ya hay un 1).
            const ya = iguales.some((x) => x[1] === "1");
            renombrar(base, base + " " + (ya ? mayor + 1 : 1));
            mayor = ya ? mayor + 1 : Math.max(mayor, 1);
        }
        return base + " " + (mayor + 1);
    }

    // Apuntar a alguien en la iniciativa («richi-oc-iniciativa»): tira
    // 1d20 + su bono y avisa a la ventana de la iniciativa. «c»: {nombre,
    // bono, ca, pg, color}. Devuelve el nombre con el que entra, o null.
    function meterEnIniciativa(c, numerar) {
        const CLAVE_INI = "richi-oc-iniciativa";
        let datos = { lista: [], turno: -1, ronda: 1 };
        try {
            datos = Object.assign(datos, JSON.parse(localStorage.getItem(CLAVE_INI) || "{}"));
        } catch (e) {
            // Sin almacenamiento: no se puede apuntar.
        }
        const nombres = datos.lista.map((x) => x.nombre);
        let nombre = c.nombre;
        if (numerar) {
            nombre = numerar(nombres, (viejo, nuevo) => {
                datos.lista.forEach((x) => {
                    if (x.nombre === viejo) {
                        x.nombre = nuevo;
                    }
                });
            });
        } else if (nombres.indexOf(nombre) >= 0) {
            return null;
        }
        const bono = parseInt(c.bono, 10) || 0;
        const r = window.ocDados ? window.ocDados.tirar("1d20" + (bono ? (bono > 0 ? "+" : "") + bono : ""),
            "iniciativa de " + nombre) : null;
        const entra = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nombre, color: c.color,
            ini: r ? r.total : 10 + bono, ca: parseInt(c.ca, 10) || "", pg: c.pg === undefined ? "" : c.pg };
        // De la party (para llevar sus PG a su ficha), sus acciones
        // legendarias y su bono a la salvación de Constitución (concentración).
        ["pj", "leg", "con"].forEach((k) => {
            if (c[k] !== undefined && c[k] !== "" && c[k] !== null) {
                entra[k] = c[k];
            }
        });
        datos.lista.push(entra);
        try {
            localStorage.setItem(CLAVE_INI, JSON.stringify(datos));
        } catch (e) {
            // Sin almacenamiento: da igual.
        }
        document.dispatchEvent(new CustomEvent("oc-iniciativa:cambio"));
        return nombre;
    }

    // Lo que la iniciativa necesita de un monstruo: sus legendarias y su
    // salvación de Constitución.
    function iniDeBicho(b) {
        const leg = (b.legendarias && b.legendarias.length) ? parseInt((/Usos de acción legendaria:\*? (\d+)/.exec(b.legInfo || "")
            || [])[1], 10) || 3 : 0;
        const salv = /Con ([+−-]\d+)/.exec(b.salv || "");
        const con = salv ? parseInt(salv[1].replace("−", "-"), 10) : b.car && b.car.Con ? modDe(Number(b.car.Con)) : undefined;
        return { nombre: b.nombre, bono: b.ini, ca: b.ca, pg: b.pg || "", color: "#d23b3b", leg: leg || undefined, con };
    }
    // Y de un PJ: su ficha (para sus PG) y su salvación de Constitución.
    function iniDePj(pj, nombre) {
        const d = numPj(pj.des);
        const con = numPj(pj.con);
        const salvaCon = (pj.salvaciones || []).includes("con");
        return { nombre, bono: d === null ? 0 : modDe(d), ca: pj.ca, pg: numPj(pj.pg) === null ? numPj(pj.pgmax) : numPj(pj.pg),
            color: "#3fae5a", pj: pj.id, con: con === null ? undefined : modDe(con) + (salvaCon ? competenciaPj(pj) : 0) };
    }

    function aLaIniciativa(b, boton, nombreBase) {
        // Una del tablero va con su nombre («Lobo 2», «Elminster») si no
        // está ya; si no, con número si se repite (Lobo 1, Lobo 2…).
        const nombre = meterEnIniciativa(Object.assign(iniDeBicho(b), { nombre: nombreBase || b.nombre }), (nombres, renombrar) => (nombreBase && nombres.indexOf(nombreBase) < 0 ? nombreBase
            : conNumero(b.nombre, nombres, renombrar)));
        avisar("A la iniciativa: " + nombre + ".");
        if (boton) {
            boton.focus();
        }
    }

    // Un «Des +3, Sab +6» con cada bono como botón que tira 1d20+bono.
    function bonosQueSeTiran(texto, que) {
        const dd = crear("dd", "master-bicho-bonos");
        texto.split(/,\s*/).forEach((trozo, i) => {
            const m = /^(.*?)\s*([+−-]\d+)$/.exec(trozo);
            if (i) {
                dd.appendChild(document.createTextNode(", "));
            }
            if (!m || !window.ocDadoBoton) {
                dd.appendChild(document.createTextNode(trozo));
                return;
            }
            dd.appendChild(document.createTextNode(m[1] + " "));
            const n = parseInt(m[2].replace("−", "-"), 10);
            dd.appendChild(window.ocDadoBoton(m[2], "1d20" + (n >= 0 ? "+" : "") + n, que + " de " + m[1]));
        });
        return dd;
    }

    // LAS CASILLAS DE USOS: un cuadrado por uso (marcado = gastado), que
    // se marca y desmarca al pulsarlo. «usos» guarda cuántos lleva
    // gastados cada cosa (en una criatura del tablero, en su ventana; en
    // la ventana del bestiario, solo mientras está abierta).
    function casillas(usos, clave, n, que, alCambiar) {
        const caja = crear("span", "master-usos");
        caja.setAttribute("role", "group");
        caja.setAttribute("aria-label", "Usos de " + que);
        const pintar = () => {
            caja.replaceChildren(...Array.from({ length: n }, (x, i) => {
                const gastado = i < (usos[clave] || 0);
                const b = botonDe("master-uso", "", () => {
                    usos[clave] = gastado ? i : i + 1;
                    pintar();
                    alCambiar();
                    caja.querySelectorAll(".master-uso")[i].focus();
                    avisar(que + ": " + (usos[clave] || 0) + " de " + n + " gastados.");
                }, que + ", uso " + (i + 1) + " de " + n);
                b.setAttribute("aria-pressed", gastado ? "true" : "false");
                return b;
            }));
        };
        caja.repintar = pintar;
        pintar();
        return caja;
    }

    // Las acciones de ataque, en tabla (como en las fichas): ataque, bono,
    // alcance y daño; lo que hace además, debajo del daño.
    function tablaDeAtaques(lista) {
        const filas = [];
        lista.forEach((r) => {
            const m = /^\*(Ataque[^:*]*):\* ([+−-]\d+), ([^*]+?) \*Impacto:\* (.*)$/s.exec(r.t);
            if (!m) {
                return;
            }
            const resto = m[4];
            const corte = resto.search(/\.(\s|$)/);
            filas.push({ r, tipo: m[1].replace(/^Ataque /, ""), bono: m[2], alcance: m[3],
                dano: corte >= 0 ? resto.slice(0, corte + 1) : resto, efecto: corte >= 0 ? resto.slice(corte + 1).trim() : "" });
        });
        if (!filas.length) {
            return null;
        }
        const tabla = crear("table", "master-ataques");
        tabla.appendChild(crear("caption", "visually-hidden", "Ataques"));
        const cab = crear("tr");
        ["Ataque", "Bono", "Alcance", "Daño"].forEach((t) => {
            const th = crear("th", "", t);
            th.scope = "col";
            cab.appendChild(th);
        });
        const thead = crear("thead");
        thead.appendChild(cab);
        const tbody = crear("tbody");
        filas.forEach((x) => {
            const tr = crear("tr");
            const th = crear("th", "master-ataque-nombre");
            th.scope = "row";
            th.append(crear("strong", "", x.r.n), crear("span", "master-ataque-tipo", x.tipo));
            const n = parseInt(x.bono.replace("−", "-"), 10);
            const tdB = crear("td");
            tdB.appendChild(window.ocDadoBoton ? window.ocDadoBoton(x.bono, "1d20" + (n >= 0 ? "+" : "") + n, x.r.n + " · ataque")
                : document.createTextNode(x.bono));
            const tdA = crear("td", "", x.alcance);
            const tdD = crear("td", "master-ataque-dano");
            // «10 (2d6 + 3) de daño cortante.»: el dado, grande y entero
            // (sin que el paréntesis se quede colgando), y al lado la media
            // y el tipo; el efecto, debajo.
            const d = /^(\d+) \(([^()]+)\) (?:de )?daño (?:de )?([^.,]+?)([.,].*)?$/s.exec(x.dano.trim());
            if (d && window.ocDadoBoton) {
                const linea = crear("p", "master-ataque-dado");
                linea.append(window.ocDadoBoton(d[2], d[2].replace(/\s+/g, "").replace("−", "-"), x.r.n + " · daño"),
                    crear("span", "master-ataque-media", " " + d[3] + " · media " + d[1]));
                tdD.appendChild(linea);
                if (window.ocDadosEnTexto) {
                    window.ocDadosEnTexto(linea.lastChild);
                }
                const resto = ((d[4] || "").replace(/^[.,]\s*/, "") + (x.efecto ? "\n\n" + x.efecto : "")).trim();
                if (resto) {
                    tdD.appendChild(markdown(resto));
                }
            } else {
                tdD.appendChild(markdown(x.dano + (x.efecto ? "\n\n" + x.efecto : "")));
            }
            tr.append(th, tdB, tdA, tdD);
            tbody.appendChild(tr);
        });
        tabla.append(thead, tbody);
        // En una caja que mira su ancho: estrecha, cada ataque en tarjeta.
        const caja = crear("div", "master-ataques-caja");
        caja.appendChild(tabla);
        caja.atacantes = filas.map((x) => x.r);
        return caja;
    }

    // EL PERFIL DE UN MONSTRUO, por pestañas: estadísticas, rasgos,
    // acciones (los ataques en tabla), bonus, reacciones, legendarias y
    // hechizos. Con casillas para lo que se gasta: lo que se recarga (con
    // «🎲» para tirar la recarga), lo de x/día, las acciones legendarias y
    // los conjuros de x/día.
    function perfil(b, fuente, alTablero, guardado) {
        const f = fuenteDe(b, fuente);
        // El nombre que tiene en el tablero (se cambia con ✎: el «Mago»
        // puede ser Elminster); si no, el suyo.
        const quien = () => (guardado && guardado.nombre && guardado.nombre()) || b.nombre;
        const usos = (guardado && guardado.usos) || {};
        const alCambiar = () => {
            if (guardado) {
                guardado.usos = usos;
                guardado.guardar();
            }
        };
        const repintables = [];
        const caja = crear("div", "master-bicho");
        const tipo = crear("p", "master-bicho-tipo", b.tipo + ", " + b.alin);
        const cabeza = crear("div", "master-bicho-cabeza");
        cabeza.append(tokenDe(b, true), tipo);
        caja.appendChild(cabeza);
        if (guardado && guardado.nombre) {
            // En el tablero, qué es de verdad (si se le ha cambiado el
            // nombre) y un botón para cambiárselo.
            const cambiar = botonDe("master-bicho-renombrar", "✎ nombre", () => guardado.renombrar(cambiar),
                "Cambiar el nombre de " + quien());
            cambiar.setAttribute("aria-haspopup", "dialog");
            tipo.prepend(crear("strong", "", b.nombre + " · "));
            tipo.appendChild(cambiar);
        }
        const fila = (dl, que, valor) => {
            if (valor === undefined || valor === "") {
                return;
            }
            dl.append(crear("dt", "", que), crear("dd", "", String(valor)));
        };
        const sumar = botonDe("oc-vida-accion es-principal", "＋ a la iniciativa", () => aLaIniciativa(b, sumar, quien()),
            "Añadir " + quien() + " a la iniciativa (tira su iniciativa)");
        const botones = crear("div", "master-bicho-botones");
        botones.appendChild(sumar);
        if (alTablero) {
            botones.appendChild(botonDe("oc-vida-accion", "📌 al tablero", alTablero, "Poner " + b.nombre + " en el tablero, como una ventana"));
        }
        const recuperar = botonDe("oc-vida-accion", "↺ recuperar usos", () => {
            Object.keys(usos).forEach((k) => delete usos[k]);
            repintables.forEach((r) => r.repintar());
            alCambiar();
            avisar("Usos recuperados.");
        }, "Recuperar todos los usos (descanso largo)");
        botones.appendChild(recuperar);
        caja.appendChild(botones);

        // ---- estadísticas ----
        const stats = crear("div", "master-bicho-panel");
        const arriba = crear("dl", "master-bicho-datos");
        fila(arriba, "CA", b.ca);
        fila(arriba, "Iniciativa", b.ini);
        fila(arriba, "PG", b.pg + (b.pgf ? " (" + b.pgf + ")" : ""));
        fila(arriba, "Velocidad", b.vel);
        const tabla = crear("table", "master-bicho-car");
        tabla.appendChild(crear("caption", "visually-hidden", "Características"));
        const cab = crear("tr");
        const val = crear("tr");
        Object.keys(b.car).forEach((k) => {
            const th = crear("th", "", k);
            th.scope = "col";
            cab.appendChild(th);
            const n = b.car[k];
            const mo = Math.floor((n - 10) / 2);
            const td = crear("td", "", n + " ");
            const bono = (mo >= 0 ? "+" : "−") + Math.abs(mo);
            td.appendChild(window.ocDadoBoton ? window.ocDadoBoton("(" + bono + ")", "1d20" + (mo >= 0 ? "+" : "") + mo,
                "prueba de " + k) : document.createTextNode("(" + bono + ")"));
            val.appendChild(td);
        });
        const thead = crear("thead");
        thead.appendChild(cab);
        const tbody = crear("tbody");
        tbody.appendChild(val);
        tabla.append(thead, tbody);
        const abajo = crear("dl", "master-bicho-datos");
        if (b.salv) {
            abajo.append(crear("dt", "", "Salvaciones"), bonosQueSeTiran(b.salv, "salvación"));
        }
        if (b.hab) {
            abajo.append(crear("dt", "", "Habilidades"), bonosQueSeTiran(b.hab, "prueba"));
        }
        fila(abajo, "Vulnerabilidades", b.vuln);
        fila(abajo, "Resistencias", b.res);
        fila(abajo, "Inmunidades", [b.inm, b.inmE].filter(Boolean).join("; "));
        fila(abajo, "Equipo", b.equipo);
        fila(abajo, "Sentidos", b.sent);
        fila(abajo, "Idiomas", b.idio);
        fila(abajo, "VD", b.vd);
        fila(abajo, "Hábitat", (b.habitat || []).join(", "));
        stats.append(arriba, tabla, abajo);

        // Un rasgo o acción: su nombre en negrita (con sus casillas si se
        // gasta) y su texto.
        const entrada = (r, seccion) => {
            const div = crear("div", "master-bicho-entrada");
            const cabeza = crear("p", "master-bicho-nombre");
            cabeza.appendChild(crear("strong", "", r.n));
            const rec = /Recarga (\d)(?:–6)?/.exec(r.n);
            const dia = /\((\d+)\/día/.exec(r.n);
            if (rec) {
                const clave = seccion + ":" + r.n;
                const c = casillas(usos, clave, 1, r.n, alCambiar);
                repintables.push(c);
                const desde = parseInt(rec[1], 10);
                const tirarRecarga = botonDe("master-recarga", "🎲 recarga", () => {
                    const t = window.ocDados ? window.ocDados.tirar("1d6", "recarga de " + r.n) : null;
                    if (t && t.total >= desde) {
                        usos[clave] = 0;
                        c.repintar();
                        alCambiar();
                        avisar(r.n + ": recargada (" + t.total + ").");
                    } else if (t) {
                        avisar(r.n + ": sin recargar (" + t.total + ").");
                    }
                }, "Tirar la recarga de " + r.n + " (" + desde + " o más en 1d6)");
                cabeza.append(c, tirarRecarga);
            } else if (dia) {
                const c = casillas(usos, seccion + ":" + r.n, parseInt(dia[1], 10), r.n, alCambiar);
                repintables.push(c);
                cabeza.appendChild(c);
            }
            div.append(cabeza, markdown(r.t));
            return div;
        };
        const paneles = [["estadísticas", stats]];
        if (b.rasgos && b.rasgos.length) {
            const panel = crear("div", "master-bicho-panel");
            b.rasgos.forEach((r) => panel.appendChild(entrada(r, "rasgos")));
            paneles.push(["rasgos", panel]);
        }
        // LAS ACCIONES: acciones, adicionales, reacciones y legendarias en
        // una pestaña, con un desplegable para elegir cuáles se ven.
        const partes = [];
        [["acciones", "acciones"], ["adicionales", "acciones adicionales"], ["reacciones", "reacciones"],
            ["legendarias", "legendarias"]].forEach(([k, titulo]) => {
            if (!b[k] || !b[k].length) {
                return;
            }
            const parte = crear("div", "master-bicho-parte");
            let lista = b[k];
            if (k === "legendarias" && b.legInfo) {
                const cuantas = parseInt((/Usos de acción legendaria:\* (\d+)/.exec(b.legInfo) || [])[1], 10) || 3;
                const p = crear("p", "master-bicho-nombre");
                p.appendChild(crear("strong", "", "Usos"));
                const c = casillas(usos, "legendarias", cuantas, "acciones legendarias", alCambiar);
                repintables.push(c);
                p.appendChild(c);
                parte.append(p, markdown(b.legInfo));
            }
            if (k === "acciones" || k === "adicionales") {
                const t = tablaDeAtaques(lista);
                if (t) {
                    parte.appendChild(t);
                    lista = lista.filter((r) => t.atacantes.indexOf(r) < 0);
                }
            }
            lista.forEach((r) => parte.appendChild(entrada(r, k)));
            partes.push([titulo, parte]);
        });
        const uid = "bicho-" + Math.random().toString(36).slice(2, 8);
        if (partes.length) {
            const panel = crear("div", "master-bicho-panel");
            let deAhora = (guardado && guardado.parte) || 0;
            if (deAhora >= partes.length) {
                deAhora = 0;
            }
            if (partes.length > 1) {
                const fila = crear("div", "master-bicho-ver");
                const etVer = crear("label", "oc-dados-etiqueta", "ver");
                const ver = crear("select", "oc-dados-elegir");
                ver.id = uid + "-ver";
                etVer.htmlFor = ver.id;
                partes.forEach(([titulo], i) => {
                    const o = crear("option", "", titulo);
                    o.value = String(i);
                    ver.appendChild(o);
                });
                ver.value = String(deAhora);
                ver.addEventListener("change", () => {
                    const i = parseInt(ver.value, 10) || 0;
                    partes.forEach(([, parte], j) => {
                        parte.hidden = j !== i;
                    });
                    if (guardado) {
                        guardado.parte = i;
                        guardado.guardar();
                    }
                });
                fila.append(etVer, ver);
                panel.appendChild(fila);
            }
            partes.forEach(([, parte], j) => {
                parte.hidden = j !== deAhora;
                panel.appendChild(parte);
            });
            paneles.push(["acciones", panel]);
        }
        if (b.conjuros) {
            const panel = crear("div", "master-bicho-panel");
            panel.appendChild(markdown(b.conjuros.t));
            panel.appendChild(crear("p", "oc-hoja-nota", "Se lanzan como " + b.conjuros.donde + "."));
            b.conjuros.listas.forEach((l, i) => {
                const div = crear("div", "master-bicho-entrada");
                const cabeza = crear("p", "master-bicho-nombre");
                cabeza.appendChild(crear("strong", "", l.et));
                if (l.usos && !l.cada) {
                    const c = casillas(usos, "conj:" + i, l.usos, l.et, alCambiar);
                    repintables.push(c);
                    cabeza.appendChild(c);
                }
                const ul = crear("ul", "master-bicho-conjuros");
                l.conj.forEach((cj) => {
                    const li = crear("li");
                    const nombre = crear("span", "master-bicho-conjuro", cj.es);
                    nombre.dataset.en = cj.en || "";
                    li.appendChild(nombre);
                    if (cj.nota) {
                        li.appendChild(document.createTextNode(" " + cj.nota));
                    }
                    if (l.usos && l.cada) {
                        const c = casillas(usos, "conj:" + i + ":" + cj.es, l.usos, cj.es, alCambiar);
                        repintables.push(c);
                        li.appendChild(c);
                    }
                    ul.appendChild(li);
                });
                div.append(cabeza, ul);
                panel.appendChild(div);
            });
            // Cada conjuro, a su ventana.
            pedir(CONJUROS_SRD).then((datos) => {
                const porEn = {};
                (datos.conjuros || []).forEach((c) => {
                    porEn[c.en] = c;
                });
                panel.querySelectorAll(".master-bicho-conjuro").forEach((sp) => {
                    const c = porEn[sp.dataset.en];
                    if (c) {
                        sp.replaceWith(botonConjuro(c, sp.textContent, datos.fuente));
                    }
                });
            }).catch(() => {});
            paneles.push(["hechizos", panel]);
        }

        paneles.push(["imagen", panelImagen("monstruo:" + b.en, b.nombre)]);

        // LAS PESTAÑAS: estadísticas, rasgos, acciones, hechizos (las que
        // tenga) e imagen, con las flechas para ir de una a otra.
        let actual = (guardado && guardado.pestana) || 0;
        if (actual >= paneles.length) {
            actual = 0;
        }
        const lista = crear("div", "master-bicho-pestanas");
        lista.setAttribute("role", "tablist");
        lista.setAttribute("aria-label", "Partes del perfil de " + quien());
        const pestanas = paneles.map(([titulo, panel], i) => {
            const t = botonDe("master-bicho-pestana", titulo, () => elegir(i, false));
            t.setAttribute("role", "tab");
            t.id = uid + "-t" + i;
            panel.id = uid + "-p" + i;
            t.setAttribute("aria-controls", panel.id);
            panel.setAttribute("role", "tabpanel");
            panel.setAttribute("aria-labelledby", t.id);
            panel.tabIndex = 0;
            t.addEventListener("keydown", (e) => {
                const d = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: paneles.length - 1 - i }[e.key];
                if (d === undefined) {
                    return;
                }
                e.preventDefault();
                elegir((i + d + paneles.length) % paneles.length, true);
            });
            lista.appendChild(t);
            return t;
        });
        function elegir(i, foco) {
            actual = i;
            pestanas.forEach((t, j) => {
                t.setAttribute("aria-selected", j === i ? "true" : "false");
                t.tabIndex = j === i ? 0 : -1;
            });
            paneles.forEach(([, panel], j) => {
                panel.hidden = j !== i;
            });
            if (foco) {
                pestanas[i].focus();
            }
            if (guardado) {
                guardado.pestana = i;
                guardado.guardar();
            }
        }
        caja.appendChild(lista);
        paneles.forEach(([, panel]) => caja.appendChild(panel));
        elegir(actual, false);
        enlazarConjuros(caja);
        if (f) {
            caja.appendChild(crear("p", "oc-hoja-nota master-fuente", f));
        }
        return caja;
    }

    // Una criatura del bestiario puesta en el tablero (📌): su perfil en
    // una ventana, a mano durante el combate.
    function montarCriatura(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        pedir("datos/personajes/compendio/bestiario.json").then((datos) => {
            const b = (datos.monstruos || []).find((x) => x.en === m.datos.en);
            const guardado = { usos: m.datos.usos || {}, pestana: m.datos.pestana || 0, parte: m.datos.parte || 0,
                guardar() {
                    m.datos.usos = guardado.usos;
                    m.datos.pestana = guardado.pestana;
                    m.datos.parte = guardado.parte;
                    guardar();
                },
                // Su nombre es el título de la ventana (✎ nombre lo cambia,
                // como el ✎ de la barra).
                nombre: () => m.titulo || (b && b.nombre) || "",
                renombrar: (vuelta) => personalizar(m, vuelta) };
            const pintarla = () => {
                const foco = dentro.contains(document.activeElement) ? document.activeElement.className : "";
                dentro.replaceChildren(b ? perfil(b, "", null, guardado) : crear("p", "oc-vacio", "No encuentro esa criatura."));
                const otro = foco && dentro.querySelector("." + foco.split(" ")[0]);
                if (otro) {
                    otro.focus();
                }
            };
            m.alRenombrar = pintarla;
            pintarla();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar el bestiario."));
        });
    }

    // EL TOKEN DE UN MONSTRUO: una ficha redonda hecha aquí (no son las
    // ilustraciones de 5e.tools, que no se pueden copiar), con el dibujo de
    // su tipo, el borde del color de su tipo y más grande cuanto mayor es.
    const TOKENS = { Aberración: ["👁️", "#8e5bd6"], Bestia: ["🐾", "#3fae5a"], Celestial: ["😇", "#e6c229"],
        Autómata: ["⚙️", "#8a8a99"], Dragón: ["🐉", "#d23b3b"], Elemental: ["🌪️", "#3bb3c9"], Feérico: ["🧚", "#e05aa8"],
        Infernal: ["😈", "#b3261e"], Gigante: ["🗿", "#a06a3b"], Humanoide: ["🧑", "#3b7ddd"], Monstruosidad: ["🦂", "#e88a2a"],
        Muerto: ["💀", "#5f6b7a"], Enjambre: ["🐝", "#9a8a2a"], Planta: ["🌿", "#2f9e4f"], Cieno: ["🫧", "#5aa88f"] };
    const TAMANOS = { Diminuto: 1, Diminutos: 1, Diminutas: 1, Pequeño: 2, Mediano: 3, Grande: 4, Enorme: 5, Gargantuesco: 6 };

    function tokenDe(b, grande) {
        const tipo = b.tipo.split(" (")[0].split(" ")[0];
        const [emoji, color] = TOKENS[tipo] || ["❔", "#8a8a99"];
        const tam = TAMANOS[b.tipo.split(" ").pop()] || 3;
        const t = crear("span", "master-token es-tam-" + tam + (grande ? " es-grande" : ""), emoji);
        t.style.setProperty("--token", color);
        t.setAttribute("aria-hidden", "true");
        return t;
    }

    // Un monstruo en su ventana, con «📌 al tablero» (que lo deja como
    // ventana, con número si ya hay otro igual: Lobo 1, Lobo 2…).
    function abrirBicho(b, vuelta, fuente) {
        const cerrar = window.ocVentana.abrir({ titulo: b.nombre, vuelta, clase: "es-regla",
            cuerpo: perfil(b, fuente, () => {
                cerrar();
                const titulo = conNumero(b.nombre, estado.modulos.filter((m) => m.tipo === "criatura")
                    .map((m) => m.titulo || ""), (viejo, nuevo) => {
                    estado.modulos.forEach((m) => {
                        if (m.tipo === "criatura" && m.titulo === viejo) {
                            m.titulo = nuevo;
                            ponerTitulo(m);
                        }
                    });
                });
                anadir("criatura", { titulo, datos: { en: b.en }, w: 440, h: 520 });
            }) });
    }

    function montarBestiario(dentro, m) {
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando el bestiario…"));
        pedir("datos/personajes/compendio/bestiario.json").then((datos) => {
            const bichos = (datos.monstruos || []).map((b) => ({ b, buscar: llano(b.nombre + " " + b.en + " " + b.tipo) }));
            const fila = crear("div", "master-conjuros-buscar es-bestiario");
            const et = crear("label", "oc-dados-etiqueta", "buscar");
            const input = crear("input", "oc-dados-texto");
            input.type = "search";
            input.id = "master-bichos-" + m.id;
            input.placeholder = "goblin, dragón, owlbear…";
            et.htmlFor = input.id;
            const etVd = crear("label", "oc-dados-etiqueta", "VD");
            const vd = crear("select", "oc-dados-elegir");
            vd.id = "master-bichos-vd-" + m.id;
            etVd.htmlFor = vd.id;
            [""].concat(VDS).forEach((v) => {
                const o = crear("option", "", v || "todos");
                o.value = v;
                vd.appendChild(o);
            });
            const etTipo = crear("label", "oc-dados-etiqueta", "tipo");
            const tipo = crear("select", "oc-dados-elegir");
            tipo.id = "master-bichos-tipo-" + m.id;
            etTipo.htmlFor = tipo.id;
            const tipos = Array.from(new Set(bichos.map((x) => x.b.tipo.split(/[ (]/)[0]))).sort();
            [""].concat(tipos).forEach((v) => {
                const o = crear("option", "", v || "todos");
                o.value = v;
                tipo.appendChild(o);
            });
            const cuantos = crear("p", "oc-hoja-nota");
            cuantos.setAttribute("role", "status");
            const lista = crear("ul", "master-conjuros");
            fila.append(et, input, etVd, vd, etTipo, tipo);
            const pintar = () => {
                const q = llano(input.value.trim());
                const salen = bichos.filter((x) => (!q || x.buscar.includes(q)) && (!vd.value || x.b.cr === vd.value)
                    && (!tipo.value || x.b.tipo.indexOf(tipo.value) === 0));
                lista.replaceChildren(...salen.slice(0, 60).map((x) => {
                    const li = crear("li");
                    const b = botonDe("master-conjuro", "", () => abrirBicho(x.b, b, datos.fuente));
                    b.setAttribute("aria-haspopup", "dialog");
                    b.classList.add("con-token");
                    b.append(tokenDe(x.b), crear("span", "master-conjuro-nombre", x.b.nombre),
                        crear("span", "master-conjuro-datos", "VD " + x.b.cr + " · " + x.b.tipo + " · CA " + parseInt(x.b.ca, 10)
                            + " · " + x.b.pg + " PG"));
                    li.appendChild(b);
                    return li;
                }));
                cuantos.textContent = salen.length ? salen.length + (salen.length === 1 ? " monstruo" : " monstruos")
                    + (salen.length > 60 ? " (salen los 60 primeros)" : "") : "Ningún monstruo con eso.";
            };
            let espera = 0;
            input.addEventListener("input", () => {
                clearTimeout(espera);
                espera = setTimeout(pintar, 150);
            });
            vd.addEventListener("change", pintar);
            tipo.addEventListener("change", pintar);
            dentro.replaceChildren(fila, cuantos, lista, crear("p", "oc-hoja-nota master-fuente", datos.fuente || ""));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar el bestiario."));
        });
    }

    // ---- LA TIENDA: los objetos del SRD 5.2 con su precio
    // (datos/personajes/compendio/tienda.json), por tienda, categoría y
    // rareza, con los precios al gusto (de saldo… abusivos) y un «surtido
    // al azar» que se queda guardado (lo que hay hoy en esa tienda). ----
    const RAREZAS = ["común", "poco común", "rara", "muy rara", "legendaria"];

    function moneda(cp) {
        const total = Math.round(cp);
        const po = Math.floor(total / 100);
        const pp = Math.floor((total % 100) / 10);
        const pc = total % 10;
        const trozos = [];
        if (po) {
            trozos.push(po.toLocaleString("es-ES") + " po");
        }
        if (pp) {
            trozos.push(pp + " pp");
        }
        if (pc || !trozos.length) {
            trozos.push(pc + " pc");
        }
        return trozos.join(" ");
    }

    function montarTienda(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", "Abriendo la tienda…"));
        pedir("datos/personajes/compendio/tienda.json").then((datos) => {
            const objetos = (datos.objetos || []).map((o) => ({ o, buscar: llano(o.nombre + " " + o.en + " " + o.cat) }));
            const elegir = (id, texto, opciones, valor) => {
                const et = crear("label", "oc-dados-etiqueta", texto);
                const sel = crear("select", "oc-dados-elegir");
                sel.id = id + m.id;
                et.htmlFor = sel.id;
                opciones.forEach(([v, t]) => {
                    const op = crear("option", "", t);
                    op.value = v;
                    sel.appendChild(op);
                });
                sel.value = valor || "";
                return [et, sel];
            };
            const [etTienda, tienda] = elegir("master-tienda-", "tienda",
                [["", "todas"]].concat((datos.tiendas || []).map((t) => [t, t])), m.datos.tienda);
            const [etCat, cat] = elegir("master-tienda-cat-", "categoría", [["", "todas"]], "");
            const [etRareza, rareza] = elegir("master-tienda-rareza-", "rareza",
                [["", "todas"]].concat(RAREZAS.map((r) => [r, r])), m.datos.rareza);
            // El precio de la tienda, en %: 100 es lo normal; 80, un 20 % más
            // barato; 150, la mitad más caro. (Lo de antes, ×1,5…, pasa a %.)
            if (m.datos.porc === undefined && m.datos.precio) {
                m.datos.porc = Math.round(parseFloat(m.datos.precio) * 100) || 100;
            }
            const etPrecio = crear("label", "oc-dados-etiqueta", "precios (%)");
            const precio = crear("input", "oc-dados-texto");
            precio.type = "number";
            precio.min = "0";
            precio.max = "1000";
            precio.step = "5";
            precio.inputMode = "numeric";
            precio.value = String(m.datos.porc || 100);
            precio.id = "master-tienda-precio-" + m.id;
            precio.setAttribute("aria-describedby", "master-tienda-precio-ayuda-" + m.id);
            etPrecio.htmlFor = precio.id;
            const ayudaPrecio = crear("p", "oc-hoja-nota master-tienda-ayuda", "100 = normal; 80 = un 20 % más barato; 150 = la mitad más caro.");
            ayudaPrecio.id = "master-tienda-precio-ayuda-" + m.id;
            const etBuscar = crear("label", "oc-dados-etiqueta", "buscar");
            const buscar = crear("input", "oc-dados-texto");
            buscar.type = "search";
            buscar.id = "master-tienda-buscar-" + m.id;
            buscar.placeholder = "cuerda, poción, espada…";
            etBuscar.htmlFor = buscar.id;
            const campos = crear("div", "master-tienda-campos");
            [[etTienda, tienda], [etCat, cat], [etRareza, rareza], [etPrecio, precio], [etBuscar, buscar]].forEach(([e, c]) => {
                const caja = crear("div", "master-tienda-campo" + (c === buscar ? " es-ancho" : ""));
                caja.append(e, c);
                if (c === precio) {
                    caja.appendChild(ayudaPrecio);
                }
                campos.appendChild(caja);
            });
            // El surtido: unos cuantos al azar de lo que se ve (y se guarda).
            const cuantosAzar = crear("input", "oc-dados-texto master-tienda-cuantos");
            cuantosAzar.type = "number";
            cuantosAzar.min = "1";
            cuantosAzar.max = "40";
            cuantosAzar.value = String(m.datos.cuantos || 8);
            cuantosAzar.id = "master-tienda-cuantos-" + m.id;
            const etCuantos = crear("label", "oc-dados-etiqueta", "cuántos");
            etCuantos.htmlFor = cuantosAzar.id;
            const azar = botonDe("oc-vida-accion es-principal", "🎲 surtido al azar", () => {
                const n = Math.max(1, Math.min(40, parseInt(cuantosAzar.value, 10) || 8));
                const pool = filtrados(false).slice();
                const u = new Uint32Array(pool.length);
                crypto.getRandomValues(u);
                for (let i = pool.length - 1; i > 0; i -= 1) {
                    const j = u[i] % (i + 1);
                    [pool[i], pool[j]] = [pool[j], pool[i]];
                }
                m.datos.surtido = pool.slice(0, n).map((x) => x.o.en);
                m.datos.cuantos = n;
                guardar();
                pintar();
                avisar("Surtido nuevo: " + m.datos.surtido.length + " objetos.");
            });
            const todo = botonDe("oc-vida-accion", "ver todo", () => {
                delete m.datos.surtido;
                guardar();
                pintar();
                avisar("Se ve todo.");
            });
            const surtidoFila = crear("div", "master-tienda-azar");
            const cajaCuantos = crear("div", "master-tienda-campo");
            cajaCuantos.append(etCuantos, cuantosAzar);
            surtidoFila.append(cajaCuantos, azar, todo);
            const cuantos = crear("p", "oc-hoja-nota");
            cuantos.setAttribute("role", "status");
            const tabla = crear("table", "master-tienda-tabla");
            const cap = crear("caption", "visually-hidden", "Objetos y precios");
            const cab = crear("tr");
            [["Objeto", ""], ["Precio", "es-precio"]].forEach(([t, c]) => {
                const th = crear("th", c, t);
                th.scope = "col";
                cab.appendChild(th);
            });
            const thead = crear("thead");
            thead.appendChild(cab);
            const cuerpo = crear("tbody");
            tabla.append(cap, thead, cuerpo);

            function filtrados(conSurtido) {
                const q = llano(buscar.value.trim());
                const enSurtido = conSurtido && m.datos.surtido ? new Set(m.datos.surtido) : null;
                return objetos.filter((x) => (!tienda.value || x.o.tiendas.indexOf(tienda.value) >= 0)
                    && (!cat.value || x.o.cat === cat.value) && (!rareza.value || x.o.rareza === rareza.value)
                    && (!q || x.buscar.includes(q)) && (!enSurtido || enSurtido.has(x.o.en)));
            }

            // Las categorías que hay en la tienda elegida.
            function categorias() {
                const antes = cat.value;
                const hay = Array.from(new Set(objetos.filter((x) => !tienda.value || x.o.tiendas.indexOf(tienda.value) >= 0)
                    .map((x) => x.o.cat))).sort();
                cat.replaceChildren(...[["", "todas"]].concat(hay.map((c) => [c, c])).map(([v, t]) => {
                    const op = crear("option", "", t);
                    op.value = v;
                    return op;
                }));
                cat.value = hay.indexOf(antes) >= 0 ? antes : "";
            }

            const porcentaje = () => Math.max(0, parseFloat(precio.value) || 0) / 100 || (precio.value === "0" ? 0 : 1);

            // La ventana de cada objeto: sus datos, el precio de lista, el de
            // la tienda y el regateo (un % propio, con lo que queda).
            function ficha(o, vuelta) {
                const cuerpo = datosObjeto(Object.assign({}, o, { cp: 0 }));
                if (o.cp) {
                    const precios = crear("dl", "master-bicho-datos master-objeto-precios");
                    const tiendaP = Math.round(porcentaje() * 100);
                    precios.append(crear("dt", "", "De lista"), crear("dd", "", moneda(o.cp)),
                        crear("dt", "", "En esta tienda (" + tiendaP + " %)"), crear("dd", "", moneda(o.cp * porcentaje())));
                    const form = crear("form", "master-regateo");
                    const et = crear("label", "oc-dados-etiqueta", "regatear: precio final (%)");
                    const pct = crear("input", "oc-dados-texto");
                    pct.type = "number";
                    pct.min = "0";
                    pct.max = "1000";
                    pct.step = "5";
                    pct.inputMode = "numeric";
                    pct.id = "master-regateo-" + m.id;
                    pct.value = String(tiendaP);
                    et.htmlFor = pct.id;
                    const queda = crear("p", "master-regateo-queda");
                    queda.setAttribute("aria-live", "polite");
                    const echar = () => {
                        const v = Math.max(0, parseFloat(pct.value) || 0);
                        queda.textContent = "Queda en " + moneda(o.cp * v / 100) + " (" + v + " % del precio de lista).";
                    };
                    pct.addEventListener("input", echar);
                    const rapidos = crear("div", "master-regateo-rapidos");
                    [-20, -10, -5, 5, 10, 20].forEach((d) => {
                        rapidos.appendChild(botonDe("oc-vida-accion", (d > 0 ? "+" : "−") + Math.abs(d) + " %", () => {
                            pct.value = String(Math.max(0, (parseFloat(pct.value) || 0) + d));
                            echar();
                        }, (d > 0 ? "Subir " : "Bajar ") + Math.abs(d) + " puntos"));
                    });
                    form.addEventListener("submit", (e) => {
                        e.preventDefault();
                        echar();
                    });
                    form.append(et, pct, rapidos, queda);
                    echar();
                    cuerpo.append(precios, form);
                } else {
                    cuerpo.appendChild(crear("p", "oc-hoja-nota", "No tiene precio: lo pone el DM."));
                }
                cuerpo.appendChild(crear("p", "oc-hoja-nota master-fuente", datos.fuente || ""));
                window.ocVentana.abrir({ titulo: o.nombre, cuerpo, vuelta, clase: "es-regla" });
            }

            function pintar() {
                const veces = porcentaje();
                const salen = filtrados(true);
                todo.hidden = !m.datos.surtido;
                cuerpo.replaceChildren(...salen.slice(0, 100).map((x) => {
                    const tr = crear("tr");
                    const td = crear("td");
                    const b = botonDe("master-tienda-nombre", x.o.nombre, () => ficha(x.o, b));
                    b.setAttribute("aria-haspopup", "dialog");
                    td.appendChild(b);
                    const extra = [x.o.cat, x.o.rareza, x.o.sint ? "requiere sintonía" : "", x.o.det, x.o.peso, x.o.nota]
                        .filter(Boolean).join(" · ");
                    td.appendChild(crear("span", "master-tienda-datos", extra));
                    const tdP = crear("td", "es-precio", x.o.cp ? moneda(x.o.cp * veces) : "—");
                    tr.append(td, tdP);
                    return tr;
                }));
                cuantos.textContent = (m.datos.surtido ? "Surtido de hoy: " : "") + (salen.length
                    ? salen.length + (salen.length === 1 ? " objeto" : " objetos") + (salen.length > 100 ? " (salen los 100 primeros)" : "")
                    : "Nada con eso.");
            }

            const alCambiar = () => {
                m.datos.tienda = tienda.value;
                m.datos.rareza = rareza.value;
                m.datos.porc = parseFloat(precio.value) || 0;
                delete m.datos.precio;
                guardar();
                pintar();
            };
            tienda.addEventListener("change", () => {
                categorias();
                alCambiar();
            });
            [cat, rareza].forEach((c) => c.addEventListener("change", alCambiar));
            precio.addEventListener("input", alCambiar);
            let espera = 0;
            buscar.addEventListener("input", () => {
                clearTimeout(espera);
                espera = setTimeout(pintar, 150);
            });
            categorias();
            dentro.replaceChildren(campos, surtidoFila, cuantos, tabla, crear("p", "oc-hoja-nota master-fuente", datos.fuente || ""));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido abrir la tienda."));
        });
    }

    // ---- EL CONVERSOR DE MONEDAS: cuánto es en cada moneda, y repartir
    // entre varios (1 ppt = 10 po; 1 po = 2 pe = 10 pp = 100 pc). ----
    const MONEDAS = [["ppt", "platino", 1000], ["po", "oro", 100], ["pe", "electro", 50], ["pp", "plata", 10], ["pc", "cobre", 1]];

    function enMonedas(cp, conPlatino) {
        const trozos = [];
        let resto = Math.floor(cp);
        MONEDAS.filter((x) => x[0] !== "pe" && (conPlatino || x[0] !== "ppt")).forEach(([k, , v]) => {
            const n = Math.floor(resto / v);
            resto -= n * v;
            if (n) {
                trozos.push(n.toLocaleString("es-ES") + " " + k);
            }
        });
        return trozos.join(" ") || "0 pc";
    }

    function montarMonedas(dentro, m) {
        m.datos = m.datos || {};
        const form = crear("form", "master-monedas");
        const campos = {};
        MONEDAS.forEach(([k, nombre]) => {
            const caja = crear("div", "master-tienda-campo");
            const et = crear("label", "oc-dados-etiqueta", k + " (" + nombre + ")");
            const i = crear("input", "oc-dados-texto");
            i.type = "number";
            i.min = "0";
            i.inputMode = "numeric";
            i.id = "master-monedas-" + k + "-" + m.id;
            i.value = m.datos[k] ? String(m.datos[k]) : "";
            et.htmlFor = i.id;
            caja.append(et, i);
            form.appendChild(caja);
            campos[k] = i;
        });
        const entreCaja = crear("div", "master-tienda-campo");
        const etEntre = crear("label", "oc-dados-etiqueta", "repartir entre");
        const entre = crear("input", "oc-dados-texto");
        entre.type = "number";
        entre.min = "1";
        entre.inputMode = "numeric";
        entre.id = "master-monedas-entre-" + m.id;
        entre.value = String(m.datos.entre || 1);
        etEntre.htmlFor = entre.id;
        entreCaja.append(etEntre, entre);
        form.appendChild(entreCaja);
        const salida = crear("dl", "master-bicho-datos master-monedas-salida");
        salida.setAttribute("aria-live", "polite");
        const vaciar = botonDe("oc-vida-accion", "🗑️ vaciar", () => {
            MONEDAS.forEach(([k]) => {
                campos[k].value = "";
            });
            calcular();
            campos.po.focus();
        });
        function calcular() {
            let cp = 0;
            MONEDAS.forEach(([k, , v]) => {
                const n = Math.max(0, parseFloat(campos[k].value) || 0);
                m.datos[k] = n;
                cp += n * v;
            });
            const n = Math.max(1, parseInt(entre.value, 10) || 1);
            m.datos.entre = n;
            guardar();
            const filas = [["Total", enMonedas(cp, true)], ["En oro", (cp / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " po"],
                ["En plata", (cp / 10).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " pp"],
                ["En cobre", cp.toLocaleString("es-ES") + " pc"]];
            if (n > 1) {
                const cada = Math.floor(cp / n);
                filas.push(["Para cada uno (" + n + ")", enMonedas(cada, false)]);
                if (cp - cada * n) {
                    filas.push(["Sobra", enMonedas(cp - cada * n, false)]);
                }
            }
            salida.replaceChildren(...filas.flatMap(([a, b]) => [crear("dt", "", a), crear("dd", "", b)]));
        }
        form.addEventListener("input", calcular);
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            calcular();
        });
        dentro.append(form, salida, vaciar);
        calcular();
    }

    // LOS MÓDULOS QUE HAY: su nombre, su dibujo, cómo se montan, su
    // tamaño al añadirlos y si solo puede haber uno.
    // ---- LOS DOCUMENTOS: carpetas y notas propias (con formato, como un
    // Word), de cada campaña (todo.docs: {carpetas: [{id, nombre, padre}],
    // notas: [{id, titulo, carpeta, html, cambiada}]}). La ventana
    // «documentos» enseña las carpetas (se abren y se cierran), crea,
    // renombra, mueve y borra, y busca en los nombres y en lo escrito;
    // cada nota se abre en su ventana del tablero («documento»). Cada cambio
    // avisa con «master:documentos». ----
    const docsDe = () => {
        todo.docs = todo.docs || { carpetas: [], notas: [] };
        return todo.docs;
    };
    const idDoc = (pre) => pre + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const avisarDocs = () => document.dispatchEvent(new CustomEvent("master:documentos"));
    // El texto de una nota (sin formato), para buscar.
    function textoDeHtml(html) {
        const t = document.createElement("template");
        t.innerHTML = sanearHtml(html);
        return (t.content.textContent || "").replace(/\s+/g, " ").trim();
    }
    // «Carpeta / subcarpeta» de una carpeta (o «documentos», la raíz).
    function rutaDe(idCarpeta) {
        const { carpetas } = docsDe();
        const trozos = [];
        let c = carpetas.find((x) => x.id === idCarpeta);
        while (c && trozos.length < 20) {
            trozos.unshift(c.nombre);
            c = carpetas.find((x) => x.id === c.padre);
        }
        return trozos.length ? trozos.join(" / ") : "documentos";
    }
    // Todas las carpetas de dentro (para no meter una carpeta en sí misma).
    function dentroDe(idCarpeta) {
        const { carpetas } = docsDe();
        const salen = [idCarpeta];
        for (let i = 0; i < salen.length; i += 1) {
            carpetas.filter((c) => c.padre === salen[i]).forEach((c) => salen.push(c.id));
        }
        return salen;
    }
    // Las carpetas como opciones de un desplegable, con sangría.
    function opcionesCarpetas(sin) {
        const { carpetas } = docsDe();
        const salen = [["", "📁 documentos (fuera de carpetas)"]];
        const bajar = (padre, nivel) => carpetas.filter((c) => (c.padre || null) === padre && sin.indexOf(c.id) < 0)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).forEach((c) => {
                salen.push([c.id, "  ".repeat(nivel) + "📁 " + c.nombre]);
                bajar(c.id, nivel + 1);
            });
        bajar(null, 1);
        return salen;
    }

    // ---- LOS ARCHIVOS de los documentos (imágenes y PDF subidos): en
    // IndexedDB («richi-master-archivos», almacén «archivos»: id → Blob),
    // que cabe mucho más que lo demás. El documento sólo lleva su id
    // ({tipo: "archivo", archivo, mime, tamano}). Los enlaces (una imagen
    // o un PDF de otra web) son {tipo: "enlace", url, clase}. ----
    const BASE_ARCHIVOS = "richi-master-archivos";
    const MAX_ARCHIVO = 50 * 1024 * 1024;
    function baseArchivos() {
        return new Promise((hecho, fallo) => {
            if (!window.indexedDB) {
                fallo(new Error("sin IndexedDB"));
                return;
            }
            const pet = indexedDB.open(BASE_ARCHIVOS, 1);
            pet.onupgradeneeded = () => pet.result.createObjectStore("archivos");
            pet.onsuccess = () => hecho(pet.result);
            pet.onerror = () => fallo(pet.error);
        });
    }
    // Una operación en el almacén: «hacer(almacen)» devuelve la petición.
    const enArchivos = (modo, hacer) => baseArchivos().then((db) => new Promise((hecho, fallo) => {
        const tx = db.transaction("archivos", modo);
        const pet = hacer(tx.objectStore("archivos"));
        tx.oncomplete = () => hecho(pet && pet.result);
        tx.onerror = () => fallo(tx.error);
        tx.onabort = () => fallo(tx.error);
    }));
    // Los del navegador (IndexedDB).
    const idbGuardar = (id, blob) => enArchivos("readwrite", (a) => a.put(blob, id));
    const idbLeer = (id) => enArchivos("readonly", (a) => a.get(id));
    const idbTodos = () => enArchivos("readonly", (a) => a.getAllKeys()).then((ids) =>
        Promise.all((ids || []).map((id) => idbLeer(id).then((blob) => [id, blob]))));
    // CON EL EJECUTABLE, en su carpeta «mis-datos/archivos» (como lo demás:
    // ver arranque.js y lanzador/almacen.go).
    const EN_CARPETA = !!(window.ocAlmacen && window.ocAlmacen.enCarpeta);
    const rutaArchivo = (id) => "__archivos/" + encodeURIComponent(id);
    const carpetaGuardar = (id, blob) => fetch(rutaArchivo(id), { method: "PUT", body: blob,
        headers: { "Content-Type": blob.type || "application/octet-stream" } }).then((r) => {
        if (!r.ok) {
            throw new Error("no se ha guardado");
        }
    });
    const carpetaLeer = (id) => fetch(rutaArchivo(id), { cache: "no-store" }).then((r) => (r.ok ? r.blob() : undefined));
    const archivoGuardar = (id, blob) => (EN_CARPETA ? carpetaGuardar(id, blob) : idbGuardar(id, blob));
    const archivoLeer = (id) => (EN_CARPETA ? carpetaLeer(id) : idbLeer(id));
    const archivoBorrar = (id) => (EN_CARPETA ? fetch(rutaArchivo(id), { method: "DELETE" }).catch(() => {})
        : enArchivos("readwrite", (a) => a.delete(id)).catch(() => {}));
    const todosLosArchivos = () => (EN_CARPETA ? fetch("__archivos", { cache: "no-store" }).then((r) => r.json())
        .then((lista) => Promise.all(lista.map((x) => carpetaLeer(x.id).then((blob) => [x.id, blob])))) : idbTodos());
    const tamanoBonito = (b) => (b > 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
    // Un Blob a «data:…» (para exportar) y de vuelta (sin fetch: la página
    // no deja pedir direcciones data:).
    const blobADatos = (blob) => new Promise((hecho) => {
        const r = new FileReader();
        r.onload = () => hecho(r.result);
        r.readAsDataURL(blob);
    });
    function datosABlob(datos) {
        const m = /^data:([^;,]+)(;base64)?,(.*)$/.exec(datos || "");
        if (!m || !m[2]) {
            return null;
        }
        const bin = atob(m[3]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
            bytes[i] = bin.charCodeAt(i);
        }
        return new Blob([bytes], { type: m[1] });
    }
    // Una dirección para un enlace: https, o un blob: del propio
    // navegador (los archivos subidos); si no, a ninguna parte.
    function direccionSegura(h) {
        return /^blob:https?:\/\/[^\s"'<>]+$/.test(String(h || "")) ? h : urlImagenSegura(h) || "#";
    }
    const iconoDoc = (n) => (n.tipo === "dibujo" ? "🖼️" : n.tipo === "archivo" ? (/pdf/.test(n.mime || "") ? "📕" : "🏞️")
        : n.tipo === "enlace" ? (n.clase === "pdf" ? "🔗📕" : "🔗🏞️") : "📄");

    function abrirDocumento(id) {
        const n = docsDe().notas.find((x) => x.id === id);
        const esDibujo = n && n.tipo === "dibujo";
        const ya = estado.modulos.find((x) => x.datos && (esDibujo ? x.tipo === "dibujo" && x.datos.doc === id
            : x.tipo === "documento" && x.datos.nota === id));
        if (ya && ya.grupo && !ya.delante) {
            verEnGrupo(ya, false);
        }
        if (ya && ya.el) {
            alFrente(ya);
            ya.el.scrollIntoView({ block: "nearest" });
            focoDe(ya).focus();
            return;
        }
        if (esDibujo) {
            // Una copia, para dibujar en ella (y «📁» la guarda encima).
            anadir("dibujo", { titulo: n.titulo, datos: Object.assign(JSON.parse(JSON.stringify(n.datos || {})), { doc: id }) });
            return;
        }
        anadir("documento", { titulo: n ? n.titulo : "", datos: { nota: id } });
    }

    // Un nombre (de carpeta o nota) en una ventanita: «alGuardar(nombre,
    // carpeta)»; con «carpetas», también dónde va.
    function pedirNombreDoc(titulo, valor, vuelta, alGuardar, conCarpeta) {
        const cuerpo = crear("form", "master-personalizar");
        const et = crear("label", "oc-dados-etiqueta", "nombre");
        const input = crear("input", "oc-dados-texto");
        input.id = "master-doc-nombre";
        input.value = valor || "";
        input.maxLength = 80;
        input.autocomplete = "off";
        et.htmlFor = input.id;
        cuerpo.append(et, input);
        let donde = null;
        if (conCarpeta) {
            donde = elegirDe("master-doc-donde", "dentro de", opcionesCarpetas(conCarpeta.sin), conCarpeta.valor || "");
            cuerpo.appendChild(donde);
        }
        const listo = crear("button", "oc-vida-accion es-principal", "guardar");
        listo.type = "submit";
        cuerpo.appendChild(listo);
        cuerpo.addEventListener("submit", (e) => {
            e.preventDefault();
            const n = input.value.trim();
            if (!n) {
                input.focus();
                return;
            }
            cerrar();
            alGuardar(n, donde ? donde.elegir.value || null : null);
        });
        const cerrar = window.ocVentana.abrir({ titulo, cuerpo, vuelta, foco: input });
    }

    // GUARDAR EN DOCUMENTOS (desde las notas y el dibujo): «actual», el
    // documento del que viene (si viene de uno: guardar encima o como uno
    // nuevo); «hacer()» da lo que se guarda ({tipo, titulo, html} o {tipo:
    // "dibujo", titulo, datos}); «alGuardar(id)», el nuevo. Si no cabe en
    // el almacenamiento del navegador, no se guarda y se avisa.
    function guardarEnDocumentos(vuelta, actual, hacer, alGuardar) {
        const docs = docsDe();
        const ya = actual ? docs.notas.find((x) => x.id === actual) : null;
        const cabe = (deshacer) => {
            if (guardar()) {
                return true;
            }
            deshacer();
            guardar();
            avisar("No cabe en el almacenamiento del navegador: descárgalo o borra algún documento grande.");
            return false;
        };
        const nuevo = () => pedirNombreDoc("guardar en documentos", ya ? ya.titulo + " (copia)" : hacer().titulo, vuelta, (nombre, carpeta) => {
            const n = Object.assign({ id: idDoc("n"), carpeta, cambiada: Date.now() }, hacer(), { titulo: nombre });
            docs.notas.push(n);
            if (!cabe(() => docs.notas.splice(docs.notas.indexOf(n), 1))) {
                return;
            }
            alGuardar(n.id);
            guardar();
            avisarDocs();
            avisar("Guardado en 📁 " + rutaDe(carpeta) + ": " + nombre + ".");
        }, { sin: [], valor: (ya && ya.carpeta) || "" });
        if (!ya) {
            nuevo();
            return;
        }
        const cuerpo = crear("div", "master-docs-guardar");
        cuerpo.appendChild(crear("p", "", "Viene de «" + ya.titulo + "» (📁 " + rutaDe(ya.carpeta) + ")."));
        const botones = crear("div", "master-docs-botones");
        const encima = botonDe("oc-vida-accion es-principal", "💾 guardar encima", () => {
            const antes = Object.assign({}, ya);
            Object.assign(ya, hacer(), { titulo: ya.titulo, cambiada: Date.now() });
            cerrar();
            if (cabe(() => {
                Object.keys(ya).forEach((k) => delete ya[k]);
                Object.assign(ya, antes);
            })) {
                avisarDocs();
                avisar("Guardado: " + ya.titulo + ".");
            }
        });
        const otro = botonDe("oc-vida-accion", "📄 guardar como uno nuevo…", () => {
            cerrar();
            nuevo();
        });
        botones.append(encima, otro);
        cuerpo.appendChild(botones);
        const cerrar = window.ocVentana.abrir({ titulo: "guardar en documentos", cuerpo, vuelta });
    }

    function montarDocumentos(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        d.abiertas = Array.isArray(d.abiertas) ? d.abiertas : [];
        const uid = "master-docs-" + m.id;
        // Dónde se crean las nuevas: la carpeta elegida (o la raíz).
        let aqui = d.aqui || null;
        const etBuscar = crear("label", "oc-dados-etiqueta", "buscar en los nombres y en lo escrito");
        const buscar = crear("input", "oc-dados-texto");
        buscar.type = "search";
        buscar.id = uid + "-buscar";
        buscar.placeholder = "taberna, Elara, deuda…";
        buscar.autocomplete = "off";
        etBuscar.htmlFor = buscar.id;
        const donde = crear("p", "master-docs-donde");
        const nuevaCarpeta = botonDe("oc-vida-accion", "＋ 📁 carpeta", () => {
            pedirNombreDoc("carpeta nueva", "", nuevaCarpeta, (n) => {
                const c = { id: idDoc("c"), nombre: n, padre: aqui };
                docsDe().carpetas.push(c);
                if (aqui && d.abiertas.indexOf(aqui) < 0) {
                    d.abiertas.push(aqui);
                }
                guardar();
                avisarDocs();
                avisar("Carpeta nueva: " + n + ".");
            });
        });
        const nuevaNota = botonDe("oc-vida-accion es-principal", "＋ 📄 nota", () => {
            const n = { id: idDoc("n"), titulo: "nota sin título", carpeta: aqui, html: "", cambiada: Date.now() };
            docsDe().notas.push(n);
            if (aqui && d.abiertas.indexOf(aqui) < 0) {
                d.abiertas.push(aqui);
            }
            guardar();
            avisarDocs();
            abrirDocumento(n.id);
        });
        // SUBIR imágenes o PDF (uno o varios), a la carpeta de ahora.
        const subir = crear("input");
        subir.type = "file";
        subir.accept = "image/*,application/pdf";
        subir.multiple = true;
        subir.hidden = true;
        const nuevoArchivo = botonDe("oc-vida-accion", "＋ 📎 archivo", () => subir.click(), "Subir una imagen o un PDF");
        nuevoArchivo.title = "Una imagen o un PDF de tu ordenador (se guarda en este navegador)";
        subir.addEventListener("change", () => {
            const lista = Array.from(subir.files || []);
            subir.value = "";
            const valen = lista.filter((f) => /^image\/|^application\/pdf$/.test(f.type) && f.size <= MAX_ARCHIVO);
            if (valen.length < lista.length) {
                avisar("Sólo imágenes y PDF de hasta 50 MB.");
            }
            Promise.all(valen.map((f) => {
                const id = idDoc("a");
                return archivoGuardar(id, f).then(() => {
                    docsDe().notas.push({ id: idDoc("n"), tipo: "archivo", titulo: f.name.replace(/\.[^.]+$/, "") || f.name, carpeta: aqui,
                        archivo: id, mime: f.type, tamano: f.size, cambiada: Date.now() });
                    return f.name;
                });
            })).then((nombres) => {
                if (!nombres.length) {
                    return;
                }
                if (aqui && d.abiertas.indexOf(aqui) < 0) {
                    d.abiertas.push(aqui);
                }
                guardar();
                avisarDocs();
                avisar("Subido a 📁 " + rutaDe(aqui) + ": " + nombres.join(", ") + ". Se queda sólo en este navegador: para no"
                    + " perderlo, ⚙ → exportar.");
            }).catch(() => avisar("No se ha podido guardar el archivo (este navegador no deja, o no cabe)."));
        });
        const botones = crear("div", "master-docs-botones");
        botones.append(nuevaNota, nuevaCarpeta, nuevoArchivo, subir);
        // Dónde se quedan las cosas (no en la web).
        const privado = crear("p", "oc-hoja-nota master-docs-aviso");
        privado.append(crear("strong", "", "🔒 Todo se queda en este navegador: "),
            document.createTextNode("las notas, los dibujos y lo que subes no se suben a la web ni los ve nadie más. Tampoco pasan"
                + " solos a otro ordenador, y se pierden si se borran los datos del navegador: para guardarlos o llevarlos, ⚙ →"
                + " exportar (y luego importar)."));

        const arbol = crear("div", "master-docs-arbol");
        const cuantos = crear("p", "visually-hidden");
        cuantos.setAttribute("role", "status");

        // Un botón pequeño de las filas (✎ y ✕).
        const mando = (texto, etiqueta, alPulsar) => {
            const b = botonDe("master-docs-mando", texto, alPulsar, etiqueta);
            b.title = etiqueta;
            return b;
        };
        // Borrar pide pulsar dos veces.
        const borrador = (etiqueta, alBorrar) => {
            let seguro = false;
            const b = mando("✕", etiqueta, () => {
                if (!seguro) {
                    seguro = true;
                    b.classList.add("es-seguro");
                    b.setAttribute("aria-label", "¿Seguro? Pulsa otra vez: " + etiqueta);
                    avisar("Pulsa otra vez para borrar.");
                    return;
                }
                alBorrar();
            });
            return b;
        };
        const filaNota = (n, conRuta, trozo) => {
            const li = crear("li", "master-docs-fila es-nota");
            const abrir = botonDe("master-docs-abrir", "", () => abrirDocumento(n.id), "Abrir la nota " + n.titulo);
            const em = crear("span", "master-docs-icono", iconoDoc(n));
            em.setAttribute("aria-hidden", "true");
            abrir.append(em, crear("span", "master-docs-nombre", n.titulo));
            if (n.tipo === "dibujo") {
                abrir.setAttribute("aria-label", "Abrir el dibujo " + n.titulo);
            } else if (n.tipo === "archivo" || n.tipo === "enlace") {
                abrir.setAttribute("aria-label", "Abrir " + (n.tipo === "enlace" ? "el enlace " : (/pdf/.test(n.mime || "")
                    ? "el PDF " : "la imagen ")) + n.titulo);
            }
            if (conRuta) {
                abrir.appendChild(crear("span", "master-docs-ruta", rutaDe(n.carpeta)));
            }
            if (trozo) {
                abrir.appendChild(crear("span", "master-docs-trozo", trozo));
            }
            const quitar = borrador("Borrar la nota " + n.titulo, () => {
                docsDe().notas = docsDe().notas.filter((x) => x !== n);
                if (n.tipo === "archivo" && n.archivo) {
                    archivoBorrar(n.archivo);
                }
                // Sus ventanas, fuera.
                estado.modulos.filter((x) => x.tipo === "documento" && x.datos && x.datos.nota === n.id).forEach((x) => {
                    x.datos.nota = null;
                });
                estado.modulos.filter((x) => x.datos && x.datos.doc === n.id).forEach((x) => {
                    delete x.datos.doc;
                });
                guardar();
                avisarDocs();
                avisar("Borrada la nota " + n.titulo + ".");
                buscar.focus();
            });
            li.append(abrir, quitar);
            return li;
        };
        const lista = (padre, nivel) => {
            const { carpetas, notas } = docsDe();
            const ul = crear("ul", "master-docs-lista");
            carpetas.filter((c) => (c.padre || null) === padre).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).forEach((c) => {
                const li = crear("li", "master-docs-fila es-carpeta");
                const abierta = d.abiertas.indexOf(c.id) >= 0;
                const b = botonDe("master-docs-abrir", "", () => {
                    const i = d.abiertas.indexOf(c.id);
                    if (i >= 0 && aqui === c.id) {
                        d.abiertas.splice(i, 1);
                    } else if (i < 0) {
                        d.abiertas.push(c.id);
                    }
                    aqui = c.id;
                    d.aqui = aqui;
                    guardar();
                    pintar(c.id);
                });
                b.setAttribute("aria-expanded", abierta ? "true" : "false");
                b.dataset.carpeta = c.id;
                if (aqui === c.id) {
                    b.setAttribute("aria-current", "true");
                }
                const em = crear("span", "master-docs-icono", abierta ? "📂" : "📁");
                em.setAttribute("aria-hidden", "true");
                const n = notas.filter((x) => x.carpeta === c.id).length;
                b.append(em, crear("span", "master-docs-nombre", c.nombre), crear("span", "master-docs-ruta", n + (n === 1 ? " documento" : " documentos")));
                const cambiar = mando("✎", "Renombrar o mover la carpeta " + c.nombre, () => {
                    pedirNombreDoc("carpeta", c.nombre, cambiar, (nombre, padreNuevo) => {
                        c.nombre = nombre;
                        c.padre = padreNuevo;
                        guardar();
                        avisarDocs();
                    }, { sin: dentroDe(c.id), valor: c.padre || "" });
                });
                cambiar.setAttribute("aria-haspopup", "dialog");
                const quitar = borrador("Borrar la carpeta " + c.nombre + " (lo de dentro sube un nivel)", () => {
                    const docs = docsDe();
                    docs.carpetas.filter((x) => x.padre === c.id).forEach((x) => {
                        x.padre = c.padre || null;
                    });
                    docs.notas.filter((x) => x.carpeta === c.id).forEach((x) => {
                        x.carpeta = c.padre || null;
                    });
                    docs.carpetas = docs.carpetas.filter((x) => x !== c);
                    if (aqui === c.id) {
                        aqui = c.padre || null;
                        d.aqui = aqui;
                    }
                    guardar();
                    avisarDocs();
                    avisar("Borrada la carpeta " + c.nombre + "; lo de dentro, un nivel más arriba.");
                    buscar.focus();
                });
                li.append(b, cambiar, quitar);
                if (abierta) {
                    li.appendChild(lista(c.id, nivel + 1));
                }
                ul.appendChild(li);
            });
            notas.filter((x) => (x.carpeta || null) === padre).sort((a, b) => a.titulo.localeCompare(b.titulo, "es"))
                .forEach((x) => ul.appendChild(filaNota(x)));
            return ul;
        };
        // Un trozo de lo escrito alrededor de lo que se busca.
        const trozoDe = (texto, q) => {
            let plano = "";
            const mapa = [];
            Array.from(texto).forEach((ch, i) => {
                Array.from(llano(ch)).forEach((x) => {
                    plano += x;
                    mapa.push(i);
                });
            });
            const k = plano.indexOf(q);
            if (k < 0) {
                return "";
            }
            const letras = Array.from(texto);
            const a = Math.max(0, mapa[k] - 40);
            const b = Math.min(letras.length, mapa[Math.min(mapa.length - 1, k + q.length)] + 60);
            return (a ? "…" : "") + letras.slice(a, b).join("") + (b < letras.length ? "…" : "");
        };
        function pintar(foco) {
            const q = llano(buscar.value.trim());
            donde.replaceChildren(crear("strong", "", "Las nuevas van en: "), document.createTextNode("📁 " + rutaDe(aqui)));
            if (aqui) {
                const raiz = botonDe("master-docs-mando es-texto", "↑ fuera", () => {
                    aqui = null;
                    d.aqui = null;
                    guardar();
                    pintar();
                }, "Que las nuevas vayan fuera de las carpetas");
                donde.append(" ", raiz);
            }
            const docs = docsDe();
            if (!q) {
                arbol.replaceChildren(docs.carpetas.length || docs.notas.length ? lista(null, 0)
                    : crear("p", "oc-vacio", "Todavía no hay nada: crea una nota o una carpeta, o sube una imagen o un PDF."));
                cuantos.textContent = "";
            } else {
                const ul = crear("ul", "master-docs-lista");
                let n = 0;
                docs.carpetas.filter((c) => llano(c.nombre).includes(q)).forEach((c) => {
                    n += 1;
                    const li = crear("li", "master-docs-fila es-carpeta");
                    const b = botonDe("master-docs-abrir", "", () => {
                        // A la carpeta: sin buscar, abierta (y las de fuera).
                        let x = c;
                        while (x) {
                            if (d.abiertas.indexOf(x.id) < 0) {
                                d.abiertas.push(x.id);
                            }
                            x = docs.carpetas.find((y) => y.id === x.padre);
                        }
                        aqui = c.id;
                        d.aqui = aqui;
                        buscar.value = "";
                        guardar();
                        pintar(c.id);
                    });
                    const em = crear("span", "master-docs-icono", "📁");
                    em.setAttribute("aria-hidden", "true");
                    b.append(em, crear("span", "master-docs-nombre", c.nombre), crear("span", "master-docs-ruta", rutaDe(c.padre)));
                    li.appendChild(b);
                    ul.appendChild(li);
                });
                docs.notas.forEach((x) => {
                    const enNombre = llano(x.titulo).includes(q);
                    const trozo = trozoDe(x.tipo === "dibujo" ? (x.datos && x.datos.desc) || "" : x.tipo === "enlace" ? x.url || ""
                        : x.tipo === "archivo" ? "" : textoDeHtml(x.html), q);
                    if (enNombre || trozo) {
                        n += 1;
                        ul.appendChild(filaNota(x, true, trozo));
                    }
                });
                arbol.replaceChildren(n ? ul : crear("p", "oc-vacio", "Nada con eso."));
                cuantos.textContent = n ? n + (n === 1 ? " resultado" : " resultados") : "Nada con eso.";
            }
            if (foco) {
                const b = arbol.querySelector("[data-carpeta='" + foco + "']");
                if (b) {
                    b.focus();
                }
            }
        }
        let espera = 0;
        buscar.addEventListener("input", () => {
            clearTimeout(espera);
            espera = setTimeout(() => pintar(), 150);
        });
        dentro.append(etBuscar, buscar, botones, privado, donde, cuantos, arbol);
        pintar();
        mientrasEste(dentro, "master:documentos", () => pintar());
    }

    // Lo de dentro de un archivo o un enlace: la imagen (con su texto
    // alternativo, el nombre), o el PDF en un marco (los subidos: el visor
    // del navegador) y, siempre, abrirlo en otra pestaña y descargarlo.
    function montarArchivoDoc(n) {
        const caja = crear("div", "master-doc-archivo");
        const mandos = crear("div", "master-docs-botones");
        const enlace = (texto, href, etiqueta, descargar) => {
            const a = crear("a", "oc-vida-accion", texto);
            a.href = direccionSegura(href);
            if (descargar) {
                a.download = descargar;
            } else {
                a.target = "_blank";
                a.rel = "noopener noreferrer";
            }
            a.setAttribute("aria-label", etiqueta);
            return a;
        };
        if (n.tipo === "enlace") {
            const u = urlImagenSegura(n.url);
            if (!u) {
                caja.appendChild(crear("p", "oc-vacio", "La dirección no vale."));
                return caja;
            }
            if (n.clase === "pdf") {
                caja.appendChild(crear("p", "oc-hoja-nota", "Los PDF de otras webs no se pueden ver aquí dentro: se abren en otra pestaña."));
            } else {
                const img = crear("img", "master-doc-imagen");
                img.alt = n.titulo;
                img.referrerPolicy = "no-referrer";
                img.loading = "lazy";
                img.src = urlImagenSegura(n.url);
                img.addEventListener("error", () => img.replaceWith(crear("p", "oc-vacio", "No se ha podido cargar la imagen.")));
                caja.appendChild(img);
            }
            mandos.appendChild(enlace("↗ abrir el original", u, "Abrir " + n.titulo + " en otra pestaña"));
            caja.appendChild(mandos);
            return caja;
        }
        caja.appendChild(crear("p", "oc-hoja-nota", "Cargando…"));
        archivoLeer(n.archivo).then((blob) => {
            if (!blob) {
                caja.replaceChildren(crear("p", "oc-vacio", "El archivo no está en este navegador (¿se importó sin él, o se borró?)."));
                return;
            }
            // Una dirección blob: que hace el propio navegador con el archivo.
            const archivoBlob = URL.createObjectURL(blob);
            const esPdf = /pdf/.test(blob.type || n.mime || "");
            caja.replaceChildren();
            if (esPdf) {
                const marco = crear("iframe", "master-doc-pdf");
                marco.title = "PDF: " + n.titulo;
                marco.src = archivoBlob;
                caja.appendChild(marco);
            } else {
                const img = crear("img", "master-doc-imagen");
                img.alt = n.titulo;
                img.src = archivoBlob;
                caja.appendChild(img);
            }
            const ext = esPdf ? ".pdf" : "." + ((blob.type.split("/")[1] || "png").replace("jpeg", "jpg").replace("svg+xml", "svg"));
            mandos.append(enlace("↗ abrir en otra pestaña", archivoBlob, "Abrir " + n.titulo + " en otra pestaña"),
                enlace("⬇ descargar", archivoBlob, "Descargar " + n.titulo, (n.titulo || "archivo").replace(/[^\p{L}\p{N} _-]+/gu, "") + ext));
            caja.appendChild(mandos);
        }).catch(() => caja.replaceChildren(crear("p", "oc-vacio", "Este navegador no deja leer los archivos guardados.")));
        return caja;
    }

    // UNA NOTA, en su ventana: el título, en qué carpeta va y lo escrito
    // (con la barra de formato). Se guarda sola.
    function montarDocumento(dentro, m) {
        m.datos = m.datos || {};
        const n = docsDe().notas.find((x) => x.id === m.datos.nota && x.tipo !== "dibujo");
        const esNota = n && n.tipo !== "archivo" && n.tipo !== "enlace";
        // Para el lector, qué es (dos con el mismo nombre no se confunden).
        const h2 = m.el && m.el.querySelector(".master-ventana-titulo");
        if (n && h2 && !h2.querySelector(".visually-hidden")) {
            h2.appendChild(crear("span", "visually-hidden", n.tipo === "enlace" ? " (enlace)" : n.tipo === "archivo"
                ? (/pdf/.test(n.mime || "") ? " (PDF)" : " (imagen)") : " (nota)"));
        }
        if (!n) {
            dentro.appendChild(crear("p", "oc-vacio", "Esta nota ya no está (se ha borrado, o es de otra campaña)."));
            return;
        }
        const uid = "master-doc-" + m.id;
        const fila = crear("div", "master-doc-cabeza");
        const etT = crear("label", "oc-dados-etiqueta", "título");
        const titulo = crear("input", "oc-dados-texto");
        titulo.id = uid + "-titulo";
        titulo.value = n.titulo;
        titulo.maxLength = 80;
        titulo.autocomplete = "off";
        etT.htmlFor = titulo.id;
        const cajaT = crear("div", "master-campo");
        cajaT.append(etT, titulo);
        const carpeta = elegirDe(uid + "-carpeta", "carpeta", opcionesCarpetas([]), n.carpeta || "");
        fila.append(cajaT, carpeta);
        const cuando = crear("p", "oc-hoja-nota master-doc-cuando");
        const pintarCuando = () => {
            cuando.textContent = (esNota ? "Cambiada: " : "Añadido: ") + new Date(n.cambiada || Date.now()).toLocaleString("es-ES",
                { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) + " · en 📁 " + rutaDe(n.carpeta) +
                (n.tamano ? " · " + tamanoBonito(n.tamano) : "");
        };
        pintarCuando();
        let espera = 0;
        if (!esNota) {
            const ver = montarArchivoDoc(n);
            titulo.addEventListener("input", () => {
                n.titulo = titulo.value.trim() || "sin nombre";
                m.titulo = n.titulo;
                ponerTitulo(m);
                clearTimeout(espera);
                espera = setTimeout(() => {
                    guardar();
                    avisarDocs();
                }, 400);
            });
            carpeta.elegir.addEventListener("change", () => {
                n.carpeta = carpeta.elegir.value || null;
                pintarCuando();
                guardar();
                avisarDocs();
                avisar("Ahora en: " + rutaDe(n.carpeta) + ".");
            });
            dentro.append(fila, cuando, ver);
            return;
        }
        const { area, barra, leer } = editorRico("Lo que pone la nota " + n.titulo + " (se guarda sola)", () => {
            clearTimeout(espera);
            espera = setTimeout(() => {
                n.html = leer();
                n.cambiada = Date.now();
                pintarCuando();
                guardar();
                avisarDocs();
            }, 500);
        });
        area.classList.add("es-notas");
        area.innerHTML = sanearHtml(n.html) || "<p><br></p>";
        titulo.addEventListener("input", () => {
            n.titulo = titulo.value.trim() || "nota sin título";
            n.cambiada = Date.now();
            m.titulo = n.titulo;
            ponerTitulo(m);
            clearTimeout(espera);
            espera = setTimeout(() => {
                guardar();
                avisarDocs();
            }, 400);
        });
        carpeta.elegir.addEventListener("change", () => {
            n.carpeta = carpeta.elegir.value || null;
            n.cambiada = Date.now();
            pintarCuando();
            guardar();
            avisarDocs();
            avisar("Ahora en: " + rutaDe(n.carpeta) + ".");
        });
        // Si cambian las carpetas (en «documentos»), el desplegable al día.
        mientrasEste(dentro, "master:documentos", () => {
            if (!docsDe().notas.includes(n)) {
                dentro.replaceChildren(crear("p", "oc-vacio", "Esta nota se ha borrado."));
                return;
            }
            const valor = n.carpeta || "";
            carpeta.elegir.replaceChildren(...opcionesCarpetas([]).map(([v, t]) => {
                const o = crear("option", "", t);
                o.value = v;
                return o;
            }));
            carpeta.elegir.value = valor;
        });
        dentro.append(fila, cuando, barra, area);
    }

    // ---- EL SONIDO AMBIENTE: grabaciones de verdad, en bucle, de la
    // biblioteca de sonidos de Google (Google Sound Library, CC BY 4.0):
    // se oyen desde sus servidores (actions.google.com), no se alojan
    // aquí. Se mezclan (cada uno con su volumen), siguen sonando al cambiar
    // de pestaña y se paran al quitar la ventana. También los propios: un
    // audio del ordenador, en bucle, guardado en este navegador (IndexedDB,
    // como los documentos). ----
    // Las grabaciones van en la carpeta sonidos/ de la app (las de la
    // Google Sound Library, CC BY 4.0, con su misma ruta: sonidos/weather/
    // rain_on_roof.ogg). Sólo salen las que estén: sonidos/indice.json
    // (lo escribe herramientas/precache.py) dice cuáles hay.
    const SONIDOS_DE = "sonidos/";
    let sonidosHay = new Set();
    const sonidosListos = fetch("sonidos/indice.json").then((r) => (r.ok ? r.json() : { rutas: [] })).then((x) => {
        sonidosHay = new Set(Array.isArray(x.rutas) ? x.rutas : []);
    }).catch(() => {});
    const sonidoEsta = (rutas) => rutas.every((r) => sonidosHay.has(r));
    const SONIDOS = [["lluvia", "🌧️", "lluvia", ["weather/rain_on_roof"]],
        ["tormenta", "⛈️", "tormenta", ["weather/thunderstorm_long"]],
        ["viento", "💨", "viento", ["weather/strong_wind"]],
        ["hoguera", "🔥", "hoguera", ["ambiences/fire"]],
        ["rio", "🏞️", "río", ["water/small_stream_flowing"]],
        ["mar", "🌊", "mar", ["water/waves_crashing_on_rock_beach"]],
        ["carro", "🐴", "carro en marcha", ["transportation/horse_and_carriage"]],
        ["mercado", "🛒", "mercado", ["ambiences/small_outdoor_marketplace"]],
        ["taberna", "🍺", "taberna", ["crowds/murmuring_and_talking_men"]],
        ["noche", "🦗", "noche", ["ambiences/outside_night"]],
        ["bosque", "🐦", "bosque", ["ambiences/spring_day_forest"]],
        ["mazmorra", "🕳️", "mazmorra (viento y goteo)", ["horror/hallow_wind", "water/water_leak"]],
        ["barco", "⛵", "barco (madera que cruje)", ["transportation/wood_creak_on_old_ship_series"]],
        ["granja", "🐓", "granja", ["ambiences/morning_farm"]]];
    // Sólo las de esa biblioteca.
    function urlSonidoSegura(ruta) {
        const u = SONIDOS_DE + ruta + ".ogg";
        return /^sonidos\/[a-z_]+\/[a-z0-9_]+\.ogg$/.test(u) ? u : "";
    }
    // El motor: uno para toda la página. «activos»: id → {parar, volumen}.
    const AMBIENTE = { ctx: null, general: null, nivel: 0.8, activos: {}, vigila: 0 };
    // Web Audio, sólo para los sonidos propios (se descodifican aquí).
    function motorAudio() {
        if (!AMBIENTE.ctx) {
            const C = window.AudioContext || window.webkitAudioContext;
            AMBIENTE.ctx = new C();
            AMBIENTE.general = AMBIENTE.ctx.createGain();
            AMBIENTE.general.gain.value = AMBIENTE.nivel;
            AMBIENTE.general.connect(AMBIENTE.ctx.destination);
        }
        if (AMBIENTE.ctx.state === "suspended") {
            AMBIENTE.ctx.resume();
        }
        return AMBIENTE;
    }
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
        if (AMBIENTE.activos[id]) {
            return;
        }
        const audios = rutas.map((r) => {
            const a = new Audio();
            a.loop = true;
            a.preload = "auto";
            a.volume = 0;
            a.src = urlSonidoSegura(r);
            a.addEventListener("error", () => {
                if (AMBIENTE.activos[id]) {
                    callar(id);
                    alFallar();
                }
            });
            a.play().catch(() => {
                if (AMBIENTE.activos[id]) {
                    callar(id);
                    alFallar();
                }
            });
            return a;
        });
        let mio = vol;
        fundir(audios, mio * AMBIENTE.nivel);
        AMBIENTE.activos[id] = {
            volumen(v) {
                mio = v === undefined ? mio : v;
                audios.forEach((a) => {
                    a.volume = Math.max(0, Math.min(1, mio * AMBIENTE.nivel));
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
        const A = motorAudio();
        if (AMBIENTE.activos[id]) {
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
        AMBIENTE.activos[id] = {
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
        AMBIENTE.nivel = v;
        if (AMBIENTE.general) {
            AMBIENTE.general.gain.setTargetAtTime(v, AMBIENTE.ctx.currentTime, 0.1);
        }
        Object.values(AMBIENTE.activos).forEach((x) => x.volumen());
    }
    function callar(id) {
        const x = AMBIENTE.activos[id];
        if (x) {
            x.parar();
            delete AMBIENTE.activos[id];
        }
    }
    const callarTodo = () => Object.keys(AMBIENTE.activos).forEach(callar);
    // Si ya no queda ninguna ventana de sonido en la campaña, silencio.
    function vigilarAmbiente() {
        if (AMBIENTE.vigila) {
            return;
        }
        AMBIENTE.vigila = setInterval(() => {
            const hay = todo.perfiles.some((pf) => pf.modulos.some((x) => x.tipo === "ambiente"));
            if (!hay || !Object.keys(AMBIENTE.activos).length) {
                if (!hay) {
                    callarTodo();
                }
                clearInterval(AMBIENTE.vigila);
                AMBIENTE.vigila = 0;
            }
        }, 1500);
    }

    function montarAmbiente(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        d.vol = d.vol || {};
        d.propios = Array.isArray(d.propios) ? d.propios : [];
        if (!window.Audio) {
            dentro.appendChild(crear("p", "oc-vacio", "Este navegador no puede poner sonidos."));
            return;
        }
        // EL VOLUMEN GENERAL y parar todo.
        const arriba = crear("div", "master-ambiente-arriba");
        const etG = crear("label", "master-ambiente-general");
        const general = crear("input");
        general.type = "range";
        general.min = 0;
        general.max = 100;
        general.value = d.general === undefined ? 80 : d.general;
        general.setAttribute("aria-label", "Volumen general");
        general.setAttribute("aria-valuetext", general.value + " %");
        etG.append(crear("span", "", "🔊 general"), general);
        const ponerGeneral = () => volumenGeneral(general.value / 100);
        AMBIENTE.nivel = general.value / 100;
        general.addEventListener("input", () => {
            d.general = Number(general.value);
            general.setAttribute("aria-valuetext", general.value + " %");
            ponerGeneral();
            guardar();
        });
        const parar = botonDe("oc-vida-accion", "■ silencio", () => {
            callarTodo();
            d.sonando = [];
            guardar();
            pintar();
            avisar("Silencio.");
        }, "Parar todos los sonidos");
        arriba.append(etG, parar);
        // Lo que sonaba antes de recargar (el navegador no deja que suene
        // solo: hay que pulsar).
        const volver = botonDe("oc-vida-accion es-principal", "", () => {
            (d.sonando || []).forEach((id) => encender(id));
            volver.hidden = true;
            pintar();
        });
        const lista = crear("ul", "master-ambiente-lista");
        lista.setAttribute("aria-label", "Sonidos");
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
                motorAudio();
                return archivoLeer(p.archivo).then((blob) => (blob ? blob.arrayBuffer() : null)).then((buf) => (buf
                    ? AMBIENTE.ctx.decodeAudioData(buf) : null)).then((audio) => {
                    if (!audio) {
                        avisar("Ese sonido ya no está en este navegador.");
                        return;
                    }
                    sonarPropio(id, audio, vol);
                    d.sonando = Array.from(new Set((d.sonando || []).concat(id)));
                    guardar();
                    pintar();
                }).catch(() => avisar("No se ha podido poner ese sonido."));
            }
            const s = SONIDOS.find((x) => x[0] === id);
            if (s) {
                sonarGrabacion(id, s[3], vol, () => {
                    d.sonando = (d.sonando || []).filter((x) => x !== id);
                    guardar();
                    pintar();
                    avisar("No se ha podido poner «" + s[2] + "»: ¿hay conexión a internet?");
                });
                d.sonando = Array.from(new Set((d.sonando || []).concat(id)));
                guardar();
            }
            return Promise.resolve();
        }
        function fila(id) {
            const [emoji, nombre] = datosDe(id);
            const li = crear("li", "master-ambiente-fila");
            const b = botonDe("master-ambiente-boton", "", () => {
                if (AMBIENTE.activos[id]) {
                    callar(id);
                    d.sonando = (d.sonando || []).filter((x) => x !== id);
                    guardar();
                    avisar("Parado: " + nombre + ".");
                } else {
                    encender(id);
                    avisar("Suena: " + nombre + ".");
                }
                pintar();
            });
            b.append(iconoSonido("amb:" + id, emoji), crear("span", "", nombre));
            const r = crear("input", "master-ambiente-volumen");
            r.type = "range";
            r.min = 0;
            r.max = 100;
            r.value = d.vol[id] === undefined ? 70 : d.vol[id];
            r.setAttribute("aria-label", "Volumen de " + nombre);
            r.setAttribute("aria-valuetext", r.value + " %");
            r.addEventListener("input", () => {
                d.vol[id] = Number(r.value);
                r.setAttribute("aria-valuetext", r.value + " %");
                const x = AMBIENTE.activos[id];
                if (x) {
                    x.volumen(r.value / 100);
                }
                guardar();
            });
            li.append(b, r, botonAspectoSonido("amb:" + id, emoji, nombre, b));
            if (id.indexOf("propio-") === 0) {
                const p = d.propios.find((x) => "propio-" + x.id === id);
                let seguro = false;
                const quitar = botonDe("master-docs-mando master-ambiente-quitar", "✕", () => {
                    if (!seguro) {
                        seguro = true;
                        quitar.classList.add("es-seguro");
                        avisar("Pulsa otra vez para quitar " + nombre + ".");
                        return;
                    }
                    callar(id);
                    archivoBorrar(p.archivo);
                    olvidarAspecto("amb:" + id);
                    d.propios = d.propios.filter((x) => x !== p);
                    guardar();
                    pintarFilas();
                    avisar("Quitado: " + nombre + ".");
                    otro.focus();
                }, "Quitar el sonido " + nombre);
                li.appendChild(quitar);
            }
            filas.push({ id, b, li });
            return li;
        }
        function pintarFilas() {
            filas.length = 0;
            lista.replaceChildren(...SONIDOS.filter((x) => sonidoEsta(x[3])).map(([id]) => fila(id)),
                ...d.propios.map((p) => fila("propio-" + p.id)));
            sinGrabaciones.hidden = SONIDOS.some((x) => sonidoEsta(x[3]));
            pintar();
        }
        function pintar() {
            filas.forEach(({ id, b, li }) => {
                const suena = !!AMBIENTE.activos[id];
                b.setAttribute("aria-pressed", suena ? "true" : "false");
                li.classList.toggle("es-sonando", suena);
            });
            const antes = (d.sonando || []).filter((id) => !AMBIENTE.activos[id] && datosDe(id).length);
            volver.textContent = "▶ volver a poner lo de antes (" + antes.map((id) => datosDe(id)[1]).join(", ") + ")";
            volver.hidden = !antes.length || Object.keys(AMBIENTE.activos).length > 0;
        }
        // LOS PROPIOS: un audio del ordenador, en bucle.
        const subir = crear("input");
        subir.type = "file";
        subir.accept = "audio/*";
        subir.hidden = true;
        const otro = botonDe("oc-vida-accion", "＋ 🎵 tu sonido", () => subir.click(), "Añadir un sonido tuyo (un audio, en bucle)");
        otro.title = "Un audio de tu ordenador, en bucle (se queda sólo en este navegador)";
        subir.addEventListener("change", () => {
            const f = subir.files && subir.files[0];
            subir.value = "";
            if (!f || !/^audio\//.test(f.type) || f.size > MAX_ARCHIVO) {
                avisar("Sólo audios de hasta 50 MB.");
                return;
            }
            const id = idDoc("a");
            archivoGuardar(id, f).then(() => {
                d.propios.push({ id, archivo: id, nombre: f.name.replace(/\.[^.]+$/, "").slice(0, 40) || "sonido" });
                guardar();
                pintarFilas();
                avisar("Añadido: " + f.name + ". Se queda sólo en este navegador (⚙ → exportar para no perderlo).");
            }).catch(() => avisar("No se ha podido guardar el sonido."));
        });
        const nota = crear("p", "oc-hoja-nota master-fuente");
        const enlaceG = crear("a", "", "Google Sound Library");
        enlaceG.href = "https://developers.google.com/assistant/tools/sound-library";
        enlaceG.target = "_blank";
        enlaceG.rel = "noopener noreferrer";
        enlaceG.setAttribute("aria-label", "Google Sound Library (se abre en otra pestaña)");
        nota.append("Grabaciones de la ", enlaceG, " (Google, CC BY 4.0), incluidas en la app: suenan sin conexión. Se mezclan"
            + " y siguen sonando al cambiar de pestaña; al quitar esta ventana, se paran. Los tuyos se quedan sólo en este"
            + " dispositivo.");
        const sinGrabaciones = crear("p", "oc-vacio", "Aún no hay grabaciones incluidas en la app. Añade las tuyas con «＋ 🎵 tu"
            + " sonido».");
        sinGrabaciones.hidden = true;
        dentro.append(arriba, volver, sinGrabaciones, lista, otro, subir, nota);
        pintarFilas();
        sonidosListos.then(pintarFilas);
    }

    // ---- EFECTOS DE SONIDO: suenan una vez al pulsar (una puerta que cruje,
    // un tajo, un conjuro, un grito…). Grabaciones de la misma biblioteca
    // (Google Sound Library, CC BY 4.0), enlazadas, no alojadas; y los
    // tuyos, guardados sólo en este navegador. ----
    const EFECTOS_SONOROS = [
        ["🚪 Puertas y cerrojos", [["🚪", "puerta que cruje", "doors/creaking_wooden_door"],
            ["🚪", "abrir una puerta", "doors/wood_door_open"], ["💥", "portazo", "doors/wood_door_close_hard"],
            ["🏰", "portón pesado", "doors/heavy_door_close"], ["✊", "llamar a la puerta", "doors/knock_on_wooden_door"],
            ["🗝️", "llave en la cerradura", "doors/key_in_lock"], ["🔒", "puerta cerrada (forcejeo)", "doors/locked_doorknob_jiggle"],
            ["🔩", "cerrojo", "doors/deadbolt_lock"], ["📦", "tapa de cofre", "doors/lid_close_wood"]]],
        ["⚔️ Combate", [["🌬️", "tajo al aire", "horror/swoosh"], ["🪓", "hachazo", "impacts/chop"],
            ["🔨", "golpe de maza", "impacts/hit_with_club"], ["🛡️", "golpe en el escudo", "impacts/metal_strike_on_wood"],
            ["⚔️", "choque de metal", "impacts/metal_crash"], ["🗡️", "estocada", "horror/puncture_pop"],
            ["🥩", "golpe en carne", "horror/meat_punch"], ["👊", "puñetazos", "impacts/body_punch_series"],
            ["🦴", "hueso roto", "horror/leg_bone_break"], ["🔪", "arma que cae", "impacts/knife_drop"],
            ["⛓️", "cadenas", "impacts/chain_jingle"], ["💣", "cañonazo", "weapons/howitzer_cannon_fire"]]],
        ["✨ Magia y explosiones", [["⚡", "rayo", "science_fiction/alien_beam"], ["🌀", "portal", "science_fiction/sci_fi_vortex"],
            ["🔮", "encantamiento", "science_fiction/windchime_drone"], ["🌫️", "susurro mágico", "science_fiction/dream_breath"],
            ["📉", "conjuro que se apaga", "science_fiction/high_to_low_sweep"], ["👁️", "presagio", "science_fiction/forboding_resonance"],
            ["💨", "nube de humo", "weapons/smoke_bomb"], ["🔥", "bola de fuego", "weapons/explosion_hiss_bop_bang"],
            ["💥", "explosión lejana", "weapons/big_explosion_distant"], ["🌩️", "trueno", "weather/thunder_crack"],
            ["🪨", "derrumbe", "impacts/rubble_crash"], ["🪟", "cristal que estalla", "impacts/glass_shatters_into_debris"]]],
        ["😱 Gritos y voces", [["😱", "grito de muerte", "human_voices/death_impact_yell_single"],
            ["😵", "varios gritos", "human_voices/death_impact_yell_multiple"], ["💀", "último aliento", "human_voices/death_rattle_breath"],
            ["📣", "grito de guerra", "crowds/battle_cry_high_pitch"], ["🙌", "gente que grita", "crowds/human_group_cry_out"],
            ["😠", "multitud enfadada", "crowds/voices_angry"], ["🎉", "vítores", "crowds/battle_crowd_celebration"],
            ["🤕", "heridos que gimen", "crowds/battle_agony_moans"], ["😏", "risita", "human_voices/male_chuckling"],
            ["😂", "carcajada", "human_voices/man_laugh_and_knee_slap"]]],
        ["🐺 Monstruos y animales", [["🧟", "zombi", "horror/aggressive_zombie_snarls"],
            ["👹", "rugido de monstruo", "horror/female_monster_growls"], ["😾", "gruñido", "horror/monster_alien_growl_tense"],
            ["🐍", "siseo", "horror/monster_alien_grunt_hiss"], ["🐕", "perro que gruñe", "animals/dog_growling"],
            ["🪱", "cascabel de serpiente", "animals/animal_hiss_and_rattle"], ["🦉", "búho", "animals/owl_hooting"],
            ["🐦", "cuervo", "animals/crow_call"], ["🐝", "enjambre", "animals/swarming_bees"],
            ["🐙", "tentáculo", "animals/tentacle_flop_down"], ["🐀", "ratas", "animals/mouse_squeaking"],
            ["🐎", "caballos", "transportation/horse_team"]]],
        ["🎲 Otros", [["🪙", "monedas", "impacts/loose_change_on_wood"], ["🥂", "brindis", "impacts/silverware_on_glass_toast"],
            ["🌲", "rama que se parte", "impacts/forest_wood_snapping"], ["🪵", "crujido de madera", "impacts/stress_creak"],
            ["⚰️", "tierra sobre un ataúd", "impacts/dirt_on_coffin_lid"], ["💦", "algo cae al agua", "water/rocks_into_water"]]],
    ];
    // Lo que está sonando ahora (para pararlo todo de golpe).
    const EFECTOS_SUENAN = new Set();
    let salidaEfectos = null;
    function tocarEfecto(ruta, vol, alAcabar) {
        const a = new Audio();
        a.preload = "auto";
        a.volume = Math.max(0, Math.min(1, vol));
        a.src = urlSonidoSegura(ruta);
        const fin = () => {
            EFECTOS_SUENAN.delete(a);
            efectosCambian();
            alAcabar();
        };
        a.addEventListener("ended", fin);
        EFECTOS_SUENAN.add(a);
        efectosCambian();
        return a.play().catch((e) => {
            fin();
            throw e;
        });
    }
    // Los propios: descodificados con Web Audio (sin pasar por la red).
    function tocarEfectoPropio(audio, vol, alAcabar) {
        const A = motorAudio();
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
            EFECTOS_SUENAN.delete(x);
            efectosCambian();
            alAcabar();
        });
        EFECTOS_SUENAN.add(x);
        efectosCambian();
        s.start();
    }

    function montarSonidos(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        d.propios = Array.isArray(d.propios) ? d.propios : [];
        if (!window.Audio) {
            dentro.appendChild(crear("p", "oc-vacio", "Este navegador no puede poner sonidos."));
            return;
        }
        const arriba = crear("div", "master-ambiente-arriba");
        const etG = crear("label", "master-ambiente-general");
        const general = crear("input");
        general.type = "range";
        general.min = 0;
        general.max = 100;
        general.value = d.general === undefined ? 80 : d.general;
        general.setAttribute("aria-label", "Volumen de los efectos");
        general.setAttribute("aria-valuetext", general.value + " %");
        etG.append(crear("span", "", "🔊 volumen"), general);
        general.addEventListener("input", () => {
            d.general = Number(general.value);
            general.setAttribute("aria-valuetext", general.value + " %");
            guardar();
        });
        const parar = botonDe("oc-vida-accion", "■ parar", () => {
            EFECTOS_SUENAN.forEach((a) => a.pause());
            EFECTOS_SUENAN.clear();
            efectosCambian();
            dentro.querySelectorAll(".master-ambiente-fila.es-sonando").forEach((li) => li.classList.remove("es-sonando"));
            avisar("Parados los efectos.");
        }, "Parar los efectos que estén sonando");
        arriba.append(etG, parar);
        const vol = () => general.value / 100;
        function tarjeta(emoji, nombre, alPulsar, clave) {
            const li = crear("li", "master-ambiente-fila");
            const b = botonDe("master-ambiente-boton", "", () => {
                li.classList.add("es-sonando");
                alPulsar(() => li.classList.remove("es-sonando"));
            });
            b.append(iconoSonido(clave, emoji), crear("span", "", nombre));
            li.append(b, botonAspectoSonido(clave, emoji, nombre, b));
            return li;
        }
        // Cada sección se pliega (y se acuerda: d.plegadas).
        d.plegadas = Array.isArray(d.plegadas) ? d.plegadas : [];
        function seccion(titulo, ...cosas) {
            const h = crear("h3", "master-sonidos-seccion");
            const caja = crear("div", "master-sonidos-caja");
            caja.id = "master-sonidos-" + m.id + "-" + titulo.replace(/[^a-z]/gi, "").toLowerCase();
            const abierta = !d.plegadas.includes(titulo);
            caja.hidden = !abierta;
            const b = botonDe("master-sonidos-plegar", "", () => {
                const ya = d.plegadas.includes(titulo);
                d.plegadas = ya ? d.plegadas.filter((x) => x !== titulo) : d.plegadas.concat(titulo);
                caja.hidden = !ya;
                b.setAttribute("aria-expanded", ya ? "true" : "false");
                guardar();
            });
            b.setAttribute("aria-expanded", abierta ? "true" : "false");
            b.setAttribute("aria-controls", caja.id);
            const flecha = crear("span", "master-musica-flecha", "▸");
            flecha.setAttribute("aria-hidden", "true");
            b.append(flecha, crear("span", "", titulo));
            h.appendChild(b);
            caja.append(...cosas);
            return [h, caja];
        }
        const partes = crear("div");
        const sinEfectos = crear("p", "oc-vacio", "Aún no hay grabaciones incluidas en la app. Añade las tuyas abajo, en «Los tuyos».");
        sinEfectos.hidden = true;
        sonidosListos.then(() => EFECTOS_SONOROS.forEach(([tituloS, todos]) => {
            const lista = todos.filter((x) => sonidoEsta([x[2]]));
            if (!lista.length) {
                return;
            }
            const titulo = tituloS;
            const ul = crear("ul", "master-ambiente-lista master-sonidos-lista");
            ul.setAttribute("aria-label", titulo.replace(/^\S+\s/, ""));
            lista.forEach(([emoji, nombre, ruta]) => {
                ul.appendChild(tarjeta(emoji, nombre, (acabar) => {
                    tocarEfecto(ruta, vol(), acabar).catch(() => {
                        acabar();
                        avisar("No se ha podido poner «" + nombre + "».");
                    });
                }, "efe:" + ruta));
            });
            partes.append(...seccion(titulo, ul));
        })).then(() => {
            sinEfectos.hidden = !!partes.childElementCount;
        });
        // LOS PROPIOS.
        const listaP = crear("ul", "master-ambiente-lista master-sonidos-lista");
        listaP.setAttribute("aria-label", "Los tuyos");
        const vacioP = crear("p", "oc-hoja-nota", "Aún no hay. Añade un audio de tu ordenador: sonará una vez al pulsarlo.");
        function pintarPropios() {
            listaP.replaceChildren(...d.propios.map((p) => {
                const li = tarjeta("🎵", p.nombre, (acabar) => {
                    motorAudio();
                    archivoLeer(p.archivo).then((blob) => (blob ? blob.arrayBuffer() : null)).then((buf) => (buf
                        ? AMBIENTE.ctx.decodeAudioData(buf) : null)).then((audio) => {
                        if (!audio) {
                            acabar();
                            avisar("Ese sonido ya no está en este navegador.");
                            return;
                        }
                        tocarEfectoPropio(audio, vol(), acabar);
                    }).catch(() => {
                        acabar();
                        avisar("No se ha podido poner ese sonido.");
                    });
                }, "prop:" + p.id);
                let seguro = false;
                const quitar = botonDe("master-docs-mando master-ambiente-quitar", "✕", () => {
                    if (!seguro) {
                        seguro = true;
                        quitar.classList.add("es-seguro");
                        avisar("Pulsa otra vez para quitar " + p.nombre + ".");
                        return;
                    }
                    archivoBorrar(p.archivo);
                    olvidarAspecto("prop:" + p.id);
                    d.propios = d.propios.filter((x) => x !== p);
                    guardar();
                    pintarPropios();
                    avisar("Quitado: " + p.nombre + ".");
                    otro.focus();
                }, "Quitar el sonido " + p.nombre);
                li.appendChild(quitar);
                return li;
            }));
            listaP.hidden = !d.propios.length;
            vacioP.hidden = !!d.propios.length;
        }
        const subir = crear("input");
        subir.type = "file";
        subir.accept = "audio/*";
        subir.hidden = true;
        const otro = botonDe("oc-vida-accion", "＋ 🎵 tu efecto", () => subir.click(), "Añadir un efecto tuyo (un audio que suena una vez)");
        otro.title = "Un audio de tu ordenador (se queda sólo en este navegador)";
        subir.addEventListener("change", () => {
            const f = subir.files && subir.files[0];
            subir.value = "";
            if (!f || !/^audio\//.test(f.type) || f.size > MAX_ARCHIVO) {
                avisar("Sólo audios de hasta 50 MB.");
                return;
            }
            const id = idDoc("a");
            archivoGuardar(id, f).then(() => {
                d.propios.push({ id, archivo: id, nombre: f.name.replace(/\.[^.]+$/, "").slice(0, 40) || "sonido" });
                guardar();
                pintarPropios();
                avisar("Añadido: " + f.name + ". Se queda sólo en este navegador (⚙ → exportar para no perderlo).");
            }).catch(() => avisar("No se ha podido guardar el sonido."));
        });
        const nota = crear("p", "oc-hoja-nota master-fuente");
        const enlaceG = crear("a", "", "Google Sound Library");
        enlaceG.href = "https://developers.google.com/assistant/tools/sound-library";
        enlaceG.target = "_blank";
        enlaceG.rel = "noopener noreferrer";
        enlaceG.setAttribute("aria-label", "Google Sound Library (se abre en otra pestaña)");
        nota.append("Grabaciones de la ", enlaceG, " (Google, CC BY 4.0), incluidas en la app: suenan sin conexión. Cada una"
            + " suena una vez; se pueden pisar unas con otras. Los tuyos se quedan sólo en este dispositivo.");
        dentro.append(arriba, sinEfectos, partes, ...seccion("🎵 Los tuyos", vacioP, listaP, otro, subir), nota);
        pintarPropios();
    }

    // ---- LA MÚSICA: las canciones de cada uno (audios del ordenador,
    // guardados sólo en este navegador, en IndexedDB como los documentos),
    // en carpetas y subcarpetas de la campaña (todo.musica: {carpetas:
    // [{id, nombre, padre}], canciones: [{id, archivo, nombre, carpeta}]}).
    // Una canción o una carpeta entera (con sus subcarpetas), en bucle o
    // no. Un reproductor para toda la página: sigue sonando al cambiar de
    // pestaña y se para al quitar la ventana. ----
    function musicaDe() {
        todo.musica = todo.musica || { carpetas: [], canciones: [] };
        return todo.musica;
    }
    const MUSICA = { audio: null, cola: [], pos: -1, modo: "carpeta", origen: "", alCambiar: null, vigila: 0, url: "", volumen: 0.8,
        // fade: el fundido (0-1); duck: lo que se baja con los efectos (0-1).
        fade: 1, duck: 1, fundido: 2, agachar: 0.4, aleatorio: false, orden: null, cambio: 0, saliendo: false, acabando: false };
    // El volumen que suena: el elegido × el fundido × lo bajado por efectos.
    function musicaVol() {
        if (MUSICA.audio) {
            MUSICA.audio.volume = Math.max(0, Math.min(1, MUSICA.volumen * MUSICA.fade * MUSICA.duck));
        }
    }
    // Lleva MUSICA[prop] («fade» o «duck») hasta «hasta» en ms milisegundos.
    const RAMPAS = {};
    function rampa(prop, hasta, ms, luego) {
        clearInterval(RAMPAS[prop]);
        RAMPAS[prop] = 0;
        const desde = MUSICA[prop];
        if (ms <= 0 || Math.abs(desde - hasta) < 0.01) {
            MUSICA[prop] = hasta;
            musicaVol();
            if (luego) {
                luego();
            }
            return;
        }
        const t0 = performance.now();
        RAMPAS[prop] = setInterval(() => {
            const f = Math.min(1, (performance.now() - t0) / ms);
            MUSICA[prop] = desde + (hasta - desde) * f;
            musicaVol();
            if (f >= 1) {
                clearInterval(RAMPAS[prop]);
                RAMPAS[prop] = 0;
                if (luego) {
                    luego();
                }
            }
        }, 40);
    }
    const msFundido = () => MUSICA.fundido * 1000;
    // Bajar la música mientras suena algún efecto (y subirla al acabar).
    let esperaEfectos = 0;
    function efectosCambian() {
        clearTimeout(esperaEfectos);
        if (EFECTOS_SUENAN.size && MUSICA.agachar < 1) {
            rampa("duck", MUSICA.agachar, 250);
        } else {
            esperaEfectos = setTimeout(() => {
                if (!EFECTOS_SUENAN.size) {
                    rampa("duck", 1, 900);
                }
            }, 300);
        }
    }
    // Una carpeta entera: desde la primera o, en aleatorio, desde una al azar.
    function musicaCarpeta(cola, origen) {
        MUSICA.orden = null;
        musicaPoner(cola, MUSICA.aleatorio ? Math.floor(Math.random() * cola.length) : 0, origen);
    }
    // Pausa y vuelta, con fundido.
    function musicaPausar() {
        const a = MUSICA.audio;
        if (a && !a.paused) {
            MUSICA.pausando = true;
            rampa("fade", 0, msFundido(), () => {
                MUSICA.pausando = false;
                a.pause();
            });
        }
    }
    function musicaReanudar() {
        const a = MUSICA.audio;
        if (!a) {
            return;
        }
        MUSICA.pausando = false;
        if (a.paused && msFundido()) {
            clearInterval(RAMPAS.fade);
            MUSICA.fade = 0;
            musicaVol();
        }
        a.play().then(() => rampa("fade", 1, msFundido())).catch(() => {});
    }
    // Las canciones de una carpeta, en el orden en que se ven: las de sus
    // subcarpetas y luego las suyas. Sin carpeta («»): todas.
    function cancionesDe(carpeta) {
        const mu = musicaDe();
        const propias = mu.canciones.filter((c) => (c.carpeta || "") === carpeta);
        const hijas = mu.carpetas.filter((c) => (c.padre || "") === carpeta);
        return [].concat(...hijas.map((h) => cancionesDe(h.id)), propias);
    }
    function musicaAviso() {
        if (MUSICA.alCambiar) {
            MUSICA.alCambiar();
        }
        contarMusica(false);
    }
    // ▶/⏸ (o, sin nada en la cola, todo desde el principio).
    function musicaAlternar() {
        if (!MUSICA.cola.length) {
            const todas = cancionesDe("");
            if (todas.length) {
                musicaCarpeta(todas, "");
            } else {
                avisar("Aún no hay canciones.");
            }
        } else if (MUSICA.audio.paused || MUSICA.pausando) {
            musicaReanudar();
        } else {
            musicaPausar();
        }
    }
    // El volumen y cómo se repite: en el reproductor y en las ventanas de
    // música (se guardan en ellas).
    const FUNDIDOS = [0, 1, 2, 3, 5];
    const AGACHAR = [[1, "no se baja"], [0.6, "baja un poco"], [0.4, "baja bastante"], [0.15, "baja mucho"]];
    // El bucle de una canción: el del navegador (sin cortes) si se repite
    // entera; con puntos de inicio o final, lo hace musicaAlAcabar.
    function musicaBucle() {
        const c = musicaActual();
        if (MUSICA.audio) {
            MUSICA.audio.loop = MUSICA.modo === "una" && !(c && (c.inicio || c.fin));
        }
    }
    function musicaAjustar(cambio) {
        if (cambio.volumen !== undefined) {
            MUSICA.volumen = Math.max(0, Math.min(1, Number(cambio.volumen) || 0));
            musicaVol();
        }
        if (cambio.modo && ["una", "carpeta", "nada"].includes(cambio.modo)) {
            MUSICA.modo = cambio.modo;
            musicaBucle();
        }
        if (cambio.aleatorio !== undefined) {
            MUSICA.aleatorio = !!cambio.aleatorio;
            MUSICA.orden = null;
        }
        if (cambio.fundido !== undefined && FUNDIDOS.includes(Number(cambio.fundido))) {
            MUSICA.fundido = Number(cambio.fundido);
        }
        if (cambio.agachar !== undefined && AGACHAR.some((x) => x[0] === Number(cambio.agachar))) {
            MUSICA.agachar = Number(cambio.agachar);
            efectosCambian();
        }
        todo.perfiles.forEach((pf) => pf.modulos.filter((x) => x.tipo === "musica").forEach((x) => {
            x.datos = x.datos || {};
            x.datos.vol = Math.round(MUSICA.volumen * 100);
            x.datos.modo = MUSICA.modo;
            x.datos.aleatorio = MUSICA.aleatorio;
            x.datos.fundido = MUSICA.fundido;
            x.datos.agachar = MUSICA.agachar;
        }));
        guardar();
        musicaAviso();
    }

    // EL REPRODUCTOR EN SU VENTANA (reproductor.html): para compartirla en
    // Discord u OBS sin enseñar la pantalla. La música sigue sonando aquí;
    // por el canal «pantalla-master-musica» se le cuenta cómo va y ella
    // manda las órdenes.
    const CANAL_MUSICA = "BroadcastChannel" in window ? new BroadcastChannel("pantalla-master-musica") : null;
    let contadoMusica = 0;
    let esperaMusica = 0;
    const PORTADA = { id: "", url: "" };
    function contarMusica(ya) {
        if (!CANAL_MUSICA) {
            return;
        }
        const ahora = Date.now();
        if (!ya && ahora - contadoMusica < 250) {
            clearTimeout(esperaMusica);
            esperaMusica = setTimeout(() => contarMusica(true), 260);
            return;
        }
        contadoMusica = ahora;
        const c = musicaActual();
        const a = MUSICA.audio;
        const mu = musicaDe();
        const carpeta = c && mu.carpetas.find((x) => x.id === (c.carpeta || ""));
        const conImagen = c && (c.imagen ? c : carpeta && carpeta.imagen ? carpeta : null);
        const idImagen = conImagen ? conImagen.imagen : "";
        if (idImagen !== PORTADA.id) {
            PORTADA.id = idImagen;
            PORTADA.url = "";
            if (idImagen) {
                imagenMusica(idImagen).then((u) => {
                    if (PORTADA.id === idImagen) {
                        PORTADA.url = u || "";
                        contarMusica(true);
                    }
                });
            }
        }
        CANAL_MUSICA.postMessage({ t: "estado", nombre: c ? c.nombre : "", carpeta: carpeta ? carpeta.nombre : "",
            suena: !!(c && a && !a.paused), pos: MUSICA.pos, total: MUSICA.cola.length, actual: a && c ? a.currentTime : 0,
            duracion: a && c && isFinite(a.duration) ? a.duration : 0, volumen: MUSICA.volumen, modo: MUSICA.modo,
            imagen: PORTADA.url, icono: (c && c.icono) || (carpeta && carpeta.icono) || "🎵", aleatorio: MUSICA.aleatorio,
            tema: document.documentElement.getAttribute("data-theme") || "" });
    }
    if (CANAL_MUSICA) {
        CANAL_MUSICA.addEventListener("message", (ev) => {
            const m = ev.data || {};
            if (m.t === "hola") {
                contarMusica(true);
            } else if (m.t === "tocar") {
                musicaAlternar();
            } else if (m.t === "siguiente") {
                musicaSiguiente(false);
            } else if (m.t === "anterior") {
                musicaAnterior();
            } else if (m.t === "parar") {
                musicaParar(true);
            } else if (m.t === "aleatorio") {
                musicaAjustar({ aleatorio: !MUSICA.aleatorio });
            } else if (m.t === "ir" && MUSICA.audio && isFinite(MUSICA.audio.duration)) {
                MUSICA.audio.currentTime = MUSICA.audio.duration * Math.max(0, Math.min(1, Number(m.f) || 0));
            } else if (m.t === "volumen") {
                musicaAjustar({ volumen: m.v });
            } else if (m.t === "modo") {
                musicaAjustar({ modo: m.m });
            }
        });
        document.addEventListener("theme:changed", () => contarMusica(true));
    }
    function musicaParar(conFundido) {
        const a = MUSICA.audio;
        if (conFundido && a && !a.paused && msFundido()) {
            const tok = ++MUSICA.cambio;
            // Mientras se apaga, como en pausa (no salta a la siguiente).
            MUSICA.pausando = true;
            rampa("fade", 0, msFundido(), () => {
                if (tok === MUSICA.cambio) {
                    musicaParar(false);
                }
            });
            return;
        }
        MUSICA.cambio++;
        clearInterval(RAMPAS.fade);
        MUSICA.pausando = false;
        if (MUSICA.audio) {
            MUSICA.audio.pause();
            MUSICA.audio.removeAttribute("src");
            MUSICA.audio.load();
        }
        if (MUSICA.url) {
            URL.revokeObjectURL(MUSICA.url);
            MUSICA.url = "";
        }
        MUSICA.cola = [];
        MUSICA.pos = -1;
        musicaAviso();
    }
    const musicaActual = () => MUSICA.cola[MUSICA.pos] || null;
    function musicaPoner(cola, pos, origen) {
        const c = cola[pos];
        if (!c) {
            musicaParar();
            return;
        }
        if (!MUSICA.audio) {
            MUSICA.audio = new Audio();
            MUSICA.audio.preload = "auto";
            musicaVol();
            MUSICA.audio.addEventListener("ended", musicaAlAcabar);
            MUSICA.audio.addEventListener("timeupdate", () => {
                musicaVigilarFin();
                musicaAviso();
            });
            MUSICA.audio.addEventListener("play", musicaAviso);
            MUSICA.audio.addEventListener("pause", musicaAviso);
            MUSICA.audio.addEventListener("loadedmetadata", musicaAviso);
        }
        if (cola !== MUSICA.cola) {
            MUSICA.orden = null;
        }
        const antes = MUSICA.audio;
        const sonaba = !antes.paused && MUSICA.cola.length && MUSICA.fade > 0.05;
        MUSICA.cola = cola;
        MUSICA.pos = pos;
        MUSICA.origen = origen;
        const tok = ++MUSICA.cambio;
        // Si sonaba algo, primero se va apagando; luego entra la nueva.
        if (sonaba && msFundido()) {
            rampa("fade", 0, msFundido(), () => {
                if (tok === MUSICA.cambio) {
                    cargar();
                }
            });
            musicaAviso();
            return;
        }
        cargar();
        musicaAviso();
        function cargar() {
        archivoLeer(c.archivo).then((blob) => {
            if (tok !== MUSICA.cambio) {
                return;
            }
            if (!blob) {
                avisar("«" + c.nombre + "» ya no está en este navegador.");
                return;
            }
            if (MUSICA.url) {
                URL.revokeObjectURL(MUSICA.url);
            }
            // Una dirección blob: que hace el propio navegador con el archivo.
            const archivoBlob = URL.createObjectURL(blob);
            MUSICA.url = archivoBlob;
            clearInterval(RAMPAS.fade);
            MUSICA.fade = msFundido() ? 0 : 1;
            MUSICA.pausando = false;
            MUSICA.saliendo = false;
            MUSICA.acabando = false;
            musicaVol();
            MUSICA.audio.src = archivoBlob;
            // Su punto de inicio (si tiene): se pone antes de empezar.
            if (c.inicio) {
                MUSICA.audio.currentTime = c.inicio;
                MUSICA.audio.addEventListener("loadedmetadata", () => {
                    if (MUSICA.audio.currentTime < c.inicio - 0.5) {
                        MUSICA.audio.currentTime = c.inicio;
                    }
                }, { once: true });
            }
            musicaBucle();
            return MUSICA.audio.play().then(() => {
                rampa("fade", 1, msFundido());
                vigilarMusica();
                musicaAviso();
            });
        }).catch(() => avisar("No se ha podido poner «" + c.nombre + "»."));
        }
    }
    // Hacia el final (el suyo o el que le has puesto), se va apagando; al
    // llegar al punto final, se pasa a lo siguiente.
    function musicaVigilarFin() {
        const a = MUSICA.audio;
        const c = musicaActual();
        if (!a || !c || a.paused || a.loop || MUSICA.acabando || MUSICA.pausando) {
            return;
        }
        const dur = isFinite(a.duration) ? a.duration : 0;
        const fin = c.fin && (!dur || c.fin < dur) ? c.fin : dur;
        if (!fin) {
            return;
        }
        const queda = fin - a.currentTime;
        if (c.fin && fin < dur && queda <= 0.05) {
            musicaAlAcabar();
        } else if (MUSICA.fundido && !MUSICA.saliendo && queda <= MUSICA.fundido && queda > 0) {
            MUSICA.saliendo = true;
            rampa("fade", 0, queda * 1000);
        } else if (MUSICA.saliendo && queda > MUSICA.fundido + 0.3) {
            // Se ha vuelto atrás con la barra.
            MUSICA.saliendo = false;
            rampa("fade", 1, 300);
        }
    }
    function musicaAlAcabar() {
        const a = MUSICA.audio;
        const c = musicaActual();
        if (!a || !c || MUSICA.acabando) {
            return;
        }
        MUSICA.acabando = true;
        if (MUSICA.modo === "una") {
            a.currentTime = c.inicio || 0;
            MUSICA.acabando = false;
            MUSICA.saliendo = false;
            a.play().then(() => rampa("fade", 1, msFundido())).catch(() => {});
            return;
        }
        musicaSiguiente(true);
    }
    // En aleatorio: un orden barajado de la cola (que empieza por la que suena).
    function ordenAleatorio(primera) {
        const resto = MUSICA.cola.map((x, i) => i).filter((i) => i !== primera);
        for (let i = resto.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [resto[i], resto[j]] = [resto[j], resto[i]];
        }
        return [primera].concat(resto);
    }
    // La siguiente (al acabar una, o con ⏭). Al final de la carpeta:
    // vuelve a empezar si se repite la carpeta; si no, se para.
    function musicaSiguiente(alAcabar) {
        if (!MUSICA.cola.length) {
            return;
        }
        const n = MUSICA.cola.length;
        let i;
        let fuera;
        if (MUSICA.aleatorio && n > 1) {
            if (!MUSICA.orden || MUSICA.orden.length !== n || !MUSICA.orden.includes(MUSICA.pos)) {
                MUSICA.orden = ordenAleatorio(MUSICA.pos);
            }
            const k = MUSICA.orden.indexOf(MUSICA.pos) + 1;
            fuera = k >= n;
            if (fuera) {
                // Otra vuelta, barajada de nuevo (sin repetir la última).
                MUSICA.orden = ordenAleatorio(MUSICA.pos).slice(1);
                MUSICA.orden.push(MUSICA.pos);
                i = MUSICA.orden[0];
            } else {
                i = MUSICA.orden[k];
            }
        } else {
            i = MUSICA.pos + 1;
            fuera = i >= n;
            if (fuera) {
                i = 0;
            }
        }
        if (fuera && MUSICA.modo !== "carpeta" && alAcabar) {
            MUSICA.audio.pause();
            MUSICA.audio.currentTime = (musicaActual() && musicaActual().inicio) || 0;
            MUSICA.acabando = false;
            MUSICA.saliendo = false;
            musicaAviso();
            return;
        }
        musicaPoner(MUSICA.cola, i, MUSICA.origen);
    }
    function musicaAnterior() {
        if (!MUSICA.cola.length) {
            return;
        }
        const c = musicaActual();
        if (MUSICA.audio.currentTime > ((c && c.inicio) || 0) + 3) {
            MUSICA.audio.currentTime = (c && c.inicio) || 0;
            return;
        }
        const n = MUSICA.cola.length;
        let i = (MUSICA.pos - 1 + n) % n;
        if (MUSICA.aleatorio && MUSICA.orden && MUSICA.orden.includes(MUSICA.pos)) {
            i = MUSICA.orden[(MUSICA.orden.indexOf(MUSICA.pos) - 1 + n) % n];
        }
        musicaPoner(MUSICA.cola, i, MUSICA.origen);
    }
    function vigilarMusica() {
        if (MUSICA.vigila) {
            return;
        }
        MUSICA.vigila = setInterval(() => {
            const hay = todo.perfiles.some((pf) => pf.modulos.some((x) => x.tipo === "musica"));
            if (!hay || !MUSICA.cola.length) {
                if (!hay) {
                    musicaParar();
                }
                clearInterval(MUSICA.vigila);
                MUSICA.vigila = 0;
            }
        }, 1500);
    }
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

    // 🎨 EL ASPECTO de una tarjeta (música, sonido ambiente, efectos): un
    // emoji (escrito o de los de muestra) o una imagen tuya (en el
    // dispositivo, como los demás archivos). Cambia cosa.icono y
    // cosa.imagen, y al guardar llama a alGuardar().
    const EMOJIS_MUSICA = ["⚔️", "🐉", "🍺", "🌲", "🏰", "🌊", "🔥", "🌙", "👻", "🎻", "🥁", "⛪", "🏴‍☠️", "❄️", "🌋", "🕯️",
        "💀", "🎪", "🛡️", "👑", "🌧️", "🐺", "✨", "🎵"];
    function dialogoAspecto(cosa, titulo, alGuardar) {
        const vuelta = document.activeElement;
        const cuerpo = crear("form", "master-pegar");
        const et = crear("label", "oc-dados-etiqueta", "emoji (o escribe el tuyo)");
        const input = crear("input", "oc-dados-texto");
        input.id = "master-musica-emoji";
        input.maxLength = 8;
        input.value = cosa.icono || "";
        input.autocomplete = "off";
        et.htmlFor = input.id;
        const muestras = crear("div", "master-musica-emojis");
        muestras.setAttribute("role", "group");
        muestras.setAttribute("aria-label", "Emojis de muestra");
        EMOJIS_MUSICA.forEach((e2) => muestras.appendChild(botonDe("master-musica-emoji", e2, () => {
            input.value = e2;
            input.focus();
        }, "Usar " + e2)));
        const subirImg = crear("input");
        subirImg.type = "file";
        subirImg.accept = "image/*";
        subirImg.hidden = true;
        const estado = crear("p", "oc-hoja-nota", cosa.imagen ? "Tiene una imagen tuya (va por delante del emoji)." : "Sin imagen.");
        estado.setAttribute("role", "status");
        let imagen = cosa.imagen || "";
        let nuevaImagen = null;
        const ponerImg = botonDe("oc-vida-accion", "🖼️ poner una imagen", () => subirImg.click(), "Poner una imagen de tu dispositivo");
        const quitarImg = botonDe("oc-vida-accion", "✕ quitar la imagen", () => {
            imagen = "";
            nuevaImagen = null;
            estado.textContent = "Sin imagen (se verá el emoji).";
        });
        subirImg.addEventListener("change", () => {
            const f = subirImg.files && subirImg.files[0];
            subirImg.value = "";
            if (!f || !/^image\//.test(f.type) || f.size > 10 * 1024 * 1024) {
                estado.textContent = "Sólo imágenes de hasta 10 MB.";
                return;
            }
            nuevaImagen = f;
            estado.textContent = "Imagen elegida: " + f.name + ". Pulsa «✓ guardar».";
        });
        const fila = crear("div", "master-creador-barra");
        fila.append(ponerImg, quitarImg, subirImg);
        const ok = crear("button", "oc-vida-accion es-principal", "✓ guardar");
        ok.type = "submit";
        cuerpo.append(et, input, muestras, fila, estado, ok);
        cuerpo.addEventListener("submit", (e) => {
            e.preventDefault();
            const fin = () => {
                cosa.icono = input.value.trim();
                cerrar();
                alGuardar();
                avisar("Aspecto guardado: " + cosa.nombre + ".");
            };
            const antes = cosa.imagen;
            if (nuevaImagen) {
                const id = idDoc("a");
                archivoGuardar(id, nuevaImagen).then(() => {
                    if (antes) {
                        archivoBorrar(antes);
                    }
                    cosa.imagen = id;
                    fin();
                }).catch(() => {
                    estado.textContent = "No se ha podido guardar la imagen.";
                });
            } else {
                if (antes && !imagen) {
                    archivoBorrar(antes);
                    delete cosa.imagen;
                }
                fin();
            }
        });
        const cerrar = window.ocVentana.abrir({ titulo, cuerpo, vuelta, foco: input });
    }

    // EL ASPECTO DE LOS SONIDOS (ambiente y efectos): {«amb:lluvia» o
    // «efe:doors/creaking_wooden_door»: {icono, imagen}}, en una clave
    // propia (va en ⚙ → exportar), igual en todas las campañas.
    const CLAVE_ASPECTOS = "richi-master-aspectos";
    function leerAspectos() {
        try {
            return JSON.parse(localStorage.getItem(CLAVE_ASPECTOS) || "{}") || {};
        } catch (e) {
            return {};
        }
    }
    // Al quitar un sonido tuyo, su aspecto (y su imagen) se van con él.
    function olvidarAspecto(clave) {
        const t = leerAspectos();
        if (!t[clave]) {
            return;
        }
        if (t[clave].imagen) {
            archivoBorrar(t[clave].imagen);
        }
        delete t[clave];
        try {
            localStorage.setItem(CLAVE_ASPECTOS, JSON.stringify(t));
        } catch (e) {
            // sin sitio: no pasa nada, sólo queda una entrada de sobra
        }
    }
    // El icono de una tarjeta de sonido: su imagen, su emoji o el de serie.
    function iconoSonido(clave, emoji) {
        const a = leerAspectos()[clave] || {};
        const em = crear("span", "master-ambiente-emoji");
        em.setAttribute("aria-hidden", "true");
        if (a.imagen) {
            const img = crear("img");
            img.alt = "";
            imagenMusica(a.imagen).then((u) => {
                if (u) {
                    img.src = u;
                } else {
                    em.textContent = a.icono || emoji;
                }
            });
            em.appendChild(img);
        } else {
            em.textContent = a.icono || emoji;
        }
        return em;
    }
    // 🎨 en una tarjeta de sonido: cambia su aspecto y repinta su icono.
    function botonAspectoSonido(clave, emoji, nombre, boton) {
        return botonDe("master-docs-mando master-ambiente-aspecto", "🎨", () => {
            const todos = leerAspectos();
            const cosa = Object.assign({ nombre }, todos[clave] || {});
            dialogoAspecto(cosa, "aspecto de " + nombre, () => {
                const t = leerAspectos();
                if (cosa.icono || cosa.imagen) {
                    t[clave] = { icono: cosa.icono || "", imagen: cosa.imagen || "" };
                } else {
                    delete t[clave];
                }
                try {
                    localStorage.setItem(CLAVE_ASPECTOS, JSON.stringify(t));
                } catch (e) {
                    avisar("No se ha podido guardar.");
                }
                const viejo = boton.querySelector(".master-ambiente-emoji");
                viejo.replaceWith(iconoSonido(clave, emoji));
                boton.focus();
            });
        }, "Poner un emoji o una imagen a " + nombre);
    }

    const IMAGENES_MUSICA = new Map();
    function imagenMusica(id) {
        if (!IMAGENES_MUSICA.has(id)) {
            IMAGENES_MUSICA.set(id, archivoLeer(id).then((blob) => (blob ? URL.createObjectURL(blob) : "")).catch(() => ""));
        }
        return IMAGENES_MUSICA.get(id);
    }

    function montarMusica(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        d.plegadas = Array.isArray(d.plegadas) ? d.plegadas : [];
        d.modo = ["una", "carpeta", "nada"].includes(d.modo) ? d.modo : "carpeta";
        MUSICA.modo = d.modo;
        MUSICA.aleatorio = !!d.aleatorio;
        MUSICA.fundido = FUNDIDOS.includes(d.fundido) ? d.fundido : 2;
        MUSICA.agachar = AGACHAR.some((x) => x[0] === d.agachar) ? d.agachar : 0.4;
        const mu = musicaDe();
        if (!window.Audio) {
            dentro.appendChild(crear("p", "oc-vacio", "Este navegador no puede poner música."));
            return;
        }
        // EL REPRODUCTOR.
        const repro = crear("div", "master-musica-repro");
        const ahora = crear("p", "master-musica-ahora");
        const mandos = crear("div", "master-musica-mandos");
        const ant = botonDe("master-musica-mando", "⏮", musicaAnterior, "Anterior");
        const tocar = botonDe("master-musica-mando es-grande", "▶", musicaAlternar, "Reproducir");
        const sig = botonDe("master-musica-mando", "⏭", () => musicaSiguiente(false), "Siguiente");
        const parar = botonDe("master-musica-mando", "■", () => {
            musicaParar(true);
            avisar("Música parada.");
        }, "Parar");
        const barra = crear("input", "master-musica-barra");
        barra.type = "range";
        barra.min = 0;
        barra.max = 1000;
        barra.value = 0;
        barra.setAttribute("aria-label", "Por dónde va");
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
            const a = MUSICA.audio;
            if (a && isFinite(a.duration)) {
                a.currentTime = a.duration * barra.value / 1000;
            }
        });
        const tiempo = crear("span", "master-musica-tiempo", "0:00 / 0:00");
        tiempo.setAttribute("aria-hidden", "true");
        mandos.append(ant, tocar, sig, parar, barra, tiempo);
        // Volumen y cómo se repite.
        const abajo = crear("div", "master-ambiente-arriba");
        const etV = crear("label", "master-ambiente-general");
        const vol = crear("input");
        vol.type = "range";
        vol.min = 0;
        vol.max = 100;
        vol.value = d.vol === undefined ? 80 : d.vol;
        vol.setAttribute("aria-label", "Volumen de la música");
        vol.setAttribute("aria-valuetext", vol.value + " %");
        etV.append(crear("span", "", "🔊 volumen"), vol);
        const ponerVol = () => {
            MUSICA.volumen = vol.value / 100;
            musicaVol();
        };
        vol.addEventListener("input", () => {
            d.vol = Number(vol.value);
            vol.setAttribute("aria-valuetext", vol.value + " %");
            ponerVol();
            guardar();
        });
        const modos = crear("div", "master-musica-modos");
        modos.setAttribute("role", "group");
        modos.setAttribute("aria-label", "Repetir");
        const botonesModo = [["una", "🔂 la canción"], ["carpeta", "🔁 la carpeta"], ["nada", "➡️ sin repetir"]].map(([v, t]) => {
            const b = botonDe("master-musica-modo", t, () => {
                d.modo = v;
                MUSICA.modo = v;
                musicaBucle();
                guardar();
                pintarModo();
                avisar(v === "una" ? "Se repite la canción." : v === "carpeta" ? "Se repite la carpeta entera." : "Sin repetir: al acabar la carpeta, se para.");
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
        const fuera = botonDe("oc-vida-accion", "🪟 en otra ventana", () => {
            const w = window.open("reproductor.html", "pantalla-master-reproductor", "popup,width=440,height=640");
            if (w) {
                w.focus();
                avisar("El reproductor, en su ventana: compártela en Discord u OBS. La música sigue sonando aquí.");
            } else {
                avisar("El navegador no ha dejado abrir la ventana: permite las ventanas emergentes de esta página.");
            }
        }, "Abrir el reproductor en una ventana aparte (para compartirla en Discord u OBS)");
        // 🔀 aleatorio, el fundido y cuánto baja con los efectos.
        const alAzar = botonDe("master-musica-modo", "🔀 aleatorio", () => {
            musicaAjustar({ aleatorio: !MUSICA.aleatorio });
            avisar(MUSICA.aleatorio ? "En aleatorio." : "En orden.");
        }, "Aleatorio");
        const elegirAjuste = (id, texto, opciones, valor, cambio) => {
            const caja = crear("label", "master-musica-ajuste");
            const sel = crear("select", "oc-dados-elegir");
            sel.id = id + m.id;
            opciones.forEach(([v, t]) => {
                const o = crear("option", "", t);
                o.value = String(v);
                sel.appendChild(o);
            });
            sel.value = String(valor);
            sel.addEventListener("change", () => cambio(Number(sel.value)));
            caja.append(crear("span", "", texto), sel);
            caja.sel = sel;
            return caja;
        };
        const fundidoS = elegirAjuste("master-musica-fundido-", "🌫️ fundido", FUNDIDOS.map((x) => [x, x ? x + " s" : "sin fundido"]),
            MUSICA.fundido, (v) => musicaAjustar({ fundido: v }));
        const agacharS = elegirAjuste("master-musica-agachar-", "💥 con efectos", AGACHAR, MUSICA.agachar,
            (v) => musicaAjustar({ agachar: v }));
        const ajustes = crear("div", "master-musica-ajustes");
        ajustes.append(alAzar, fundidoS, agacharS);
        abajo.append(etV, modos, fuera);
        repro.append(ahora, mandos, abajo, ajustes);

        // LAS CARPETAS Y CANCIONES.
        const herramientas = crear("div", "master-musica-herramientas");
        const nuevaCarpeta = botonDe("oc-vida-accion", "＋ 📁 carpeta", () => formulario({ tipo: "carpeta", padre: "" }),
            "Nueva carpeta");
        const subirRaiz = botonDe("oc-vida-accion", "＋ 🎵 canciones", () => subirA(""), "Añadir canciones (te pregunto la carpeta)");
        // Dos vistas: TARJETAS (como un panel de sonidos: cada carpeta y
        // canción, un botón grande con su imagen o su emoji) y LISTA (el
        // árbol). Se recuerda en d.vista.
        const vistas = crear("div", "master-musica-modos");
        vistas.setAttribute("role", "group");
        vistas.setAttribute("aria-label", "Vista");
        const botonesVista = [["tarjetas", "▦ tarjetas"], ["lista", "☰ lista"]].map(([v, t]) => {
            const b = botonDe("master-musica-modo", t, () => {
                d.vista = v;
                guardar();
                pintarArbol();
            });
            b.dataset.vista = v;
            return b;
        });
        vistas.append(...botonesVista);
        herramientas.append(nuevaCarpeta, subirRaiz, vistas);
        // 🔍 BUSCAR una canción en todas las carpetas.
        const busca = crear("div", "master-musica-busca");
        const buscar = crear("input", "oc-dados-texto");
        buscar.type = "search";
        buscar.id = "master-musica-buscar-" + m.id;
        buscar.placeholder = "🔍 buscar una canción…";
        buscar.autocomplete = "off";
        const etBusca = crear("label", "visually-hidden", "Buscar una canción");
        etBusca.htmlFor = buscar.id;
        busca.append(etBusca, buscar);
        const resultados = crear("ul", "master-musica-resultados");
        resultados.setAttribute("aria-label", "Canciones encontradas");
        resultados.hidden = true;
        const cuantos = crear("p", "visually-hidden");
        cuantos.setAttribute("role", "status");
        buscar.addEventListener("input", () => pintarArbol());
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
            const vistas2 = mu.canciones.filter((c) => llano(c.nombre + " " + rutaDe(c.carpeta || "")).includes(q)).slice(0, 60);
            resultados.replaceChildren(...vistas2.map((c) => {
                const li = crear("li", "master-musica-cancion");
                const b = botonDe("master-musica-tocar", "", () => {
                    const actual = musicaActual();
                    if (actual && actual.id === c.id) {
                        musicaAlternar();
                        return;
                    }
                    const cola = cancionesDe(c.carpeta || "");
                    musicaPoner(cola, cola.indexOf(c), c.carpeta || "");
                    avisar("Suena: " + c.nombre + ".");
                });
                b.dataset.cancion = c.id;
                const em = crear("span", "master-ambiente-emoji", c.icono || "🎵");
                em.setAttribute("aria-hidden", "true");
                const ruta = rutaDe(c.carpeta || "");
                b.append(em, crear("span", "", c.nombre), crear("span", "master-musica-cuenta", ruta ? " · 📁 " + ruta : ""));
                li.append(b, botonDe("master-docs-mando", "✎", () => formulario({ tipo: "cancion", id: c.id }),
                    "Cambiar el nombre, la carpeta o los puntos de " + c.nombre));
                return li;
            }));
            if (!vistas2.length) {
                resultados.appendChild(crear("li", "oc-vacio", "Ninguna canción con eso."));
            }
            cuantos.textContent = vistas2.length + (vistas2.length === 1 ? " canción encontrada." : " canciones encontradas.");
        }
        const form = crear("form", "master-musica-form");
        form.hidden = true;
        const arbol = crear("ul", "master-musica-arbol");
        arbol.setAttribute("aria-label", "Carpetas y canciones");
        const vacio = crear("p", "oc-hoja-nota", "Aún no hay canciones. Haz carpetas (por ejemplo «combate» o «tabernas»,"
            + " con subcarpetas) y añade tus audios.");
        const subir = crear("input");
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
            const titulo = crear("p", "master-musica-form-titulo", "＋ 🎵 ¿en qué carpeta van?");
            const nueva = "__nueva";
            const donde = elegirDe("master-musica-destino", "carpeta", opcionesDeCarpeta("").slice(1)
                .concat([[nueva, "＋ 📁 una carpeta nueva…"]]), mu.carpetas.length ? opcionesDeCarpeta("")[1][0] : nueva);
            const etN = crear("label", "oc-dados-etiqueta", "nombre de la carpeta nueva");
            const nombre = crear("input", "oc-dados-texto");
            nombre.id = "master-musica-destino-nombre";
            nombre.maxLength = 80;
            nombre.autocomplete = "off";
            etN.htmlFor = nombre.id;
            const cajaN = crear("div", "master-campo");
            cajaN.append(etN, nombre);
            const verNueva = () => {
                cajaN.hidden = donde.elegir.value !== nueva;
            };
            donde.elegir.addEventListener("change", verNueva);
            verNueva();
            const ok = crear("button", "oc-vida-accion es-principal", "🎵 elegir los audios");
            ok.type = "submit";
            const fila = crear("div", "master-musica-form-botones");
            fila.append(ok, botonDe("oc-vida-accion", "cancelar", cerrar));
            form.replaceChildren(titulo, donde, cajaN, fila);
            form.onsubmit = (e) => {
                e.preventDefault();
                let id = donde.elegir.value;
                if (id === nueva) {
                    const n = nombre.value.trim();
                    if (!n) {
                        avisar("Ponle un nombre a la carpeta.");
                        nombre.focus();
                        return;
                    }
                    id = idDoc("m");
                    mu.carpetas.push({ id, nombre: n, padre: "" });
                    guardar();
                    pintarArbol();
                    avisar("Carpeta creada: " + n + ".");
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
            const buenos = fs.filter((f) => /^audio\//.test(f.type) && f.size <= MAX_ARCHIVO);
            if (buenos.length < fs.length) {
                avisar("Sólo audios de hasta 50 MB cada uno.");
            }
            Promise.all(buenos.map((f) => {
                const id = idDoc("a");
                return archivoGuardar(id, f).then(() => {
                    mu.canciones.push({ id, archivo: id, nombre: f.name.replace(/\.[^.]+$/, "").slice(0, 80) || "canción",
                        carpeta: destino || "" });
                });
            })).then(() => {
                if (!buenos.length) {
                    return;
                }
                d.plegadas = d.plegadas.filter((x) => x !== destino);
                guardar();
                pintarArbol();
                avisar("Añadidas " + buenos.length + " canciones (con ✎ les cambias el nombre). Se quedan sólo en este"
                    + " dispositivo (⚙ → exportar para no perderlas).");
            }).catch(() => avisar("No se han podido guardar (¿no queda sitio en el navegador?)."));
        });
        // Las carpetas para elegir dónde va algo (sin la propia ni las de dentro).
        function opcionesDeCarpeta(sin) {
            const salida = [["", "— ninguna (arriba del todo)"]];
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
            const titulo = crear("p", "master-musica-form-titulo", cosa ? "✎ " + cosa.nombre : "＋ 📁 nueva carpeta");
            const et = crear("label", "oc-dados-etiqueta", "nombre");
            const input = crear("input", "oc-dados-texto");
            input.id = "master-musica-nombre";
            input.maxLength = 80;
            input.autocomplete = "off";
            input.value = cosa ? cosa.nombre : "";
            et.htmlFor = input.id;
            const sitios = opcionesDeCarpeta(esCarpeta && cosa ? cosa.id : "");
            if (!esCarpeta && cosa && cosa.carpeta && sitios.length > 1) {
                sitios.shift();
            }
            const donde = elegirDe("master-musica-donde", esCarpeta ? "dentro de" : "en la carpeta", sitios,
                cosa ? (esCarpeta ? cosa.padre : cosa.carpeta) || "" : x.padre || "");
            const ok = crear("button", "oc-vida-accion es-principal", "✓ guardar");
            ok.type = "submit";
            const no = botonDe("oc-vida-accion", "cancelar", cerrar);
            const fila = crear("div", "master-musica-form-botones");
            fila.append(ok, no);
            // Los puntos de inicio y final de una canción (para saltarse
            // una intro larga o un silencio al final).
            const puntos = crear("fieldset", "master-musica-puntos");
            const campos = {};
            if (!esCarpeta && cosa) {
                const suena = () => musicaActual() && musicaActual().id === cosa.id && MUSICA.audio;
                puntos.appendChild(crear("legend", "", "⏱ por dónde empieza y acaba (min:seg)"));
                [["inicio", "empieza en", "0:00"], ["fin", "acaba en", "hasta el final"]].forEach(([k, t, ph]) => {
                    const caja = crear("div", "master-musica-punto");
                    const etP = crear("label", "oc-dados-etiqueta", t);
                    const inp = crear("input", "oc-dados-texto");
                    inp.id = "master-musica-" + k + "-" + m.id;
                    inp.inputMode = "decimal";
                    inp.autocomplete = "off";
                    inp.placeholder = ph;
                    inp.value = cosa[k] ? minutos(cosa[k]) : "";
                    etP.htmlFor = inp.id;
                    const yaB = botonDe("master-docs-mando es-texto", "⏱ ahora", () => {
                        if (!suena()) {
                            avisar("Pon esta canción para coger el punto por donde va.");
                            return;
                        }
                        inp.value = minutos(MUSICA.audio.currentTime);
                        avisar(t + ": " + inp.value + ".");
                    }, t + ": por donde va ahora la canción");
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
                    avisar("Ponle un nombre.");
                    input.focus();
                    return;
                }
                const sitio = donde.elegir.value;
                let id = x.id;
                if (campos.inicio) {
                    const ini = segundosDe(campos.inicio.value);
                    const fin = segundosDe(campos.fin.value);
                    if (ini === null || fin === null) {
                        avisar("Escribe los puntos como 1:30 (minutos y segundos) o déjalos en blanco.");
                        (ini === null ? campos.inicio : campos.fin).focus();
                        return;
                    }
                    if (fin && fin <= ini + 1) {
                        avisar("El final tiene que ir después del inicio.");
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
                    musicaBucle();
                }
                if (cosa) {
                    cosa.nombre = nombre;
                    cosa[esCarpeta ? "padre" : "carpeta"] = sitio;
                } else {
                    id = idDoc("m");
                    mu.carpetas.push({ id, nombre, padre: sitio });
                }
                d.plegadas = d.plegadas.filter((p) => p !== sitio);
                guardar();
                form.hidden = true;
                pintarArbol();
                avisar((cosa ? "Guardado: " : "Carpeta creada: ") + nombre + ".");
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
            const b = botonDe("master-docs-mando", "✕", () => {
                if (!seguro) {
                    seguro = true;
                    b.classList.add("es-seguro");
                    avisar("Pulsa otra vez para quitar " + nombre + ".");
                    return;
                }
                hacer();
            }, "Quitar " + nombre);
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
            fuera.forEach((x) => archivoBorrar(x.archivo));
            if (fuera.some((x) => musicaActual() && musicaActual().id === x.id)) {
                musicaParar();
            }
            mu.canciones = mu.canciones.filter((x) => !ids.includes(x.carpeta));
            mu.carpetas = mu.carpetas.filter((x) => !ids.includes(x.id));
            guardar();
            pintarArbol();
            avisar("Quitada la carpeta " + c.nombre + (fuera.length ? " y sus " + fuera.length + " canciones." : "."));
            nuevaCarpeta.focus();
        }
        function filaCancion(c) {
            const li = crear("li", "master-musica-cancion");
            const b = botonDe("master-musica-tocar", "", () => {
                const cola = cancionesDe(c.carpeta || "");
                musicaPoner(cola, cola.indexOf(c), c.carpeta || "");
                avisar("Suena: " + c.nombre + ".");
            });
            b.dataset.foco = c.id;
            b.dataset.cancion = c.id;
            const em = crear("span", "master-ambiente-emoji", "🎵");
            em.setAttribute("aria-hidden", "true");
            b.append(em, crear("span", "", c.nombre));
            const editar = botonDe("master-docs-mando", "✎", () => formulario({ tipo: "cancion", id: c.id }),
                "Cambiar el nombre, la carpeta o los puntos de " + c.nombre);
            const quitar = botonQuitar(c.nombre, () => {
                if (musicaActual() && musicaActual().id === c.id) {
                    musicaParar();
                }
                archivoBorrar(c.archivo);
                mu.canciones = mu.canciones.filter((x) => x !== c);
                guardar();
                pintarArbol();
                avisar("Quitada: " + c.nombre + ".");
                nuevaCarpeta.focus();
            });
            li.append(b, editar, quitar);
            return li;
        }
        function filaCarpeta(c) {
            const li = crear("li", "master-musica-carpeta");
            const cab = crear("div", "master-musica-cabeza");
            const abierta = !d.plegadas.includes(c.id);
            const total = cancionesDe(c.id).length;
            const dentroUl = crear("ul", "master-musica-dentro");
            dentroUl.id = "master-musica-" + m.id + "-" + c.id;
            dentroUl.hidden = !abierta;
            const plegar = botonDe("master-musica-plegar", "", () => {
                const ya = d.plegadas.includes(c.id);
                d.plegadas = ya ? d.plegadas.filter((x) => x !== c.id) : d.plegadas.concat(c.id);
                dentroUl.hidden = !ya;
                plegar.setAttribute("aria-expanded", ya ? "true" : "false");
                guardar();
            });
            plegar.dataset.foco = c.id;
            plegar.setAttribute("aria-expanded", abierta ? "true" : "false");
            plegar.setAttribute("aria-controls", dentroUl.id);
            const flecha = crear("span", "master-musica-flecha", "▸");
            flecha.setAttribute("aria-hidden", "true");
            plegar.append(flecha, crear("span", "", "📁 " + c.nombre), crear("span", "master-musica-cuenta", " (" + total + ")"));
            const tocarC = botonDe("master-docs-mando", "▶", () => {
                const cola = cancionesDe(c.id);
                if (!cola.length) {
                    avisar("La carpeta " + c.nombre + " está vacía.");
                    return;
                }
                musicaCarpeta(cola, c.id);
                avisar("Suena la carpeta " + c.nombre + ": " + cola.length + " canciones.");
            }, "Reproducir la carpeta " + c.nombre);
            const mas = botonDe("master-docs-mando es-texto", "＋🎵", () => subirA(c.id), "Añadir canciones a " + c.nombre);
            const sub = botonDe("master-docs-mando es-texto", "＋📁", () => formulario({ tipo: "carpeta", padre: c.id }),
                "Nueva subcarpeta en " + c.nombre);
            const editar = botonDe("master-docs-mando", "✎", () => formulario({ tipo: "carpeta", id: c.id }),
                "Cambiar el nombre o el sitio de " + c.nombre);
            cab.append(plegar, tocarC, mas, sub, editar, botonQuitar("la carpeta " + c.nombre, () => quitarCarpeta(c)));
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
        const tarjetas = crear("div", "master-musica-tarjetas-caja");
        const camino = crear("nav", "master-musica-camino");
        camino.setAttribute("aria-label", "Dónde estás");
        const rejilla = crear("ul", "master-musica-tarjetas");
        const enCarpeta = crear("div", "master-creador-barra");
        tarjetas.append(camino, enCarpeta, rejilla);
        function aspecto(cosa, emojiDe) {
            const caja = crear("span", "master-musica-icono");
            caja.setAttribute("aria-hidden", "true");
            if (cosa.imagen) {
                const img = crear("img");
                img.alt = "";
                imagenMusica(cosa.imagen).then((u) => {
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
                const b = botonDe("master-musica-paso", texto, () => {
                    d.carpeta = id;
                    guardar();
                    pintarArbol();
                    const p = camino.querySelector("[aria-current]");
                    (rejilla.querySelector("button") || p || nuevaCarpeta).focus();
                });
                if (actual) {
                    b.setAttribute("aria-current", "location");
                }
                return b;
            };
            camino.replaceChildren(ir("", "🏠 toda la música", !aqui), ...pasos.flatMap((c, i) => [crear("span", "master-musica-sep",
                "›"), ir(c.id, c.nombre, i === pasos.length - 1)]));
            camino.querySelectorAll(".master-musica-sep").forEach((sp) => sp.setAttribute("aria-hidden", "true"));
            // Lo de esta carpeta.
            const todas = cancionesDe(aqui);
            const aquiNombre = aqui ? mu.carpetas.find((c) => c.id === aqui).nombre : "toda la música";
            enCarpeta.replaceChildren(botonDe("oc-vida-accion", "▶ " + (aqui ? "esta carpeta" : "todo"), () => {
                if (!todas.length) {
                    avisar("Aquí no hay canciones.");
                    return;
                }
                musicaCarpeta(todas, aqui);
                avisar("Suena " + aquiNombre + ": " + todas.length + " canciones.");
            }, "Poner " + aquiNombre + " entera (" + todas.length + " canciones)"),
            botonDe("oc-vida-accion", "＋ 🎵 aquí", () => subirA(aqui), aqui ? "Añadir canciones a " + aquiNombre : "Añadir canciones (te pregunto la carpeta)"),
            botonDe("oc-vida-accion", "＋ 📁 aquí", () => formulario({ tipo: "carpeta", padre: aqui }), "Nueva carpeta en " + aquiNombre));
            rejilla.setAttribute("aria-label", "Carpetas y canciones de " + aquiNombre);
            const items = [];
            mu.carpetas.filter((c) => (c.padre || "") === aqui).forEach((c) => {
                const li = crear("li", "master-musica-tarjeta es-carpeta");
                const n = cancionesDe(c.id).length;
                const b = botonDe("master-musica-tarjeta-boton", "", () => {
                    d.carpeta = c.id;
                    guardar();
                    pintarArbol();
                    (rejilla.querySelector("button") || camino.querySelector("[aria-current]")).focus();
                }, "Abrir la carpeta " + c.nombre + " (" + n + " canciones)");
                b.dataset.foco = c.id;
                b.append(aspecto(c, "📁"), crear("span", "master-musica-tarjeta-nombre", c.nombre), crear("span",
                    "master-musica-cuenta", n + (n === 1 ? " canción" : " canciones")));
                const mandos2 = crear("div", "master-musica-tarjeta-mandos");
                mandos2.append(botonDe("master-docs-mando", "▶", () => {
                    const cola = cancionesDe(c.id);
                    if (!cola.length) {
                        avisar("La carpeta " + c.nombre + " está vacía.");
                        return;
                    }
                    musicaCarpeta(cola, c.id);
                    avisar("Suena la carpeta " + c.nombre + ".");
                }, "Poner la carpeta " + c.nombre + " entera"), botonDe("master-docs-mando", "🎨", () => cambiarAspecto(c, "carpeta"),
                    "Poner un emoji o una imagen a " + c.nombre), botonDe("master-docs-mando", "✎", () => formulario({ tipo: "carpeta",
                    id: c.id }), "Cambiar el nombre o el sitio de " + c.nombre), botonQuitar("la carpeta " + c.nombre,
                    () => quitarCarpeta(c)));
                li.append(b, mandos2);
                items.push(li);
            });
            mu.canciones.filter((c) => (c.carpeta || "") === aqui).forEach((c) => {
                const li = crear("li", "master-musica-tarjeta");
                const b = botonDe("master-musica-tarjeta-boton", "", () => {
                    const actual = musicaActual();
                    if (actual && actual.id === c.id && MUSICA.audio) {
                        musicaAlternar();
                        return;
                    }
                    const cola = cancionesDe(c.carpeta || "");
                    musicaPoner(cola, cola.indexOf(c), c.carpeta || "");
                    avisar("Suena: " + c.nombre + ".");
                });
                b.dataset.foco = c.id;
                b.dataset.cancion = c.id;
                b.append(aspecto(c, "🎵"), crear("span", "master-musica-tarjeta-nombre", c.nombre));
                const mandos2 = crear("div", "master-musica-tarjeta-mandos");
                mandos2.append(botonDe("master-docs-mando", "🎨", () => cambiarAspecto(c, "cancion"), "Poner un emoji o una imagen a "
                    + c.nombre), botonDe("master-docs-mando", "✎", () => formulario({ tipo: "cancion", id: c.id }),
                    "Cambiar el nombre, la carpeta o los puntos de " + c.nombre), botonQuitar(c.nombre, () => {
                    if (musicaActual() && musicaActual().id === c.id) {
                        musicaParar();
                    }
                    archivoBorrar(c.archivo);
                    if (c.imagen) {
                        archivoBorrar(c.imagen);
                    }
                    mu.canciones = mu.canciones.filter((x) => x !== c);
                    guardar();
                    pintarArbol();
                    avisar("Quitada: " + c.nombre + ".");
                    nuevaCarpeta.focus();
                }));
                li.append(b, mandos2);
                items.push(li);
            });
            rejilla.replaceChildren(...items);
            if (!items.length) {
                rejilla.appendChild(crear("li", "oc-vacio", "Carpeta vacía: añade canciones o subcarpetas con los botones de arriba."));
            }
        }
        function cambiarAspecto(cosa, tipo) {
            dialogoAspecto(cosa, "aspecto de " + cosa.nombre + (tipo === "carpeta" ? " (carpeta)" : ""), () => {
                guardar();
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
            const q = llano(buscar.value.trim());
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
            const c = musicaActual();
            const a = MUSICA.audio;
            const suena = !!(c && a && !a.paused);
            const carpeta = c && mu.carpetas.find((x) => x.id === MUSICA.origen);
            ahora.textContent = c ? (suena ? "▶ " : "⏸ ") + c.nombre + (carpeta ? " · 📁 " + carpeta.nombre : "")
                + " (" + (MUSICA.pos + 1) + " de " + MUSICA.cola.length + ")" : "Nada sonando.";
            tocar.textContent = suena ? "⏸" : "▶";
            tocar.setAttribute("aria-label", suena ? "Pausa" : "Reproducir");
            // Lo que se cambie desde la ventana aparte (volumen y repetir).
            if (document.activeElement !== vol && Math.round(MUSICA.volumen * 100) !== Number(vol.value)) {
                vol.value = Math.round(MUSICA.volumen * 100);
            }
            d.modo = MUSICA.modo;
            pintarModo();
            alAzar.setAttribute("aria-pressed", MUSICA.aleatorio ? "true" : "false");
            if (document.activeElement !== fundidoS.sel) {
                fundidoS.sel.value = String(MUSICA.fundido);
            }
            if (document.activeElement !== agacharS.sel) {
                agacharS.sel.value = String(MUSICA.agachar);
            }
            const dur = a && isFinite(a.duration) ? a.duration : 0;
            const t = a && c ? a.currentTime : 0;
            if (!arrastrando) {
                barra.value = dur ? Math.round(t / dur * 1000) : 0;
            }
            barra.setAttribute("aria-valuetext", minutos(t) + " de " + minutos(dur));
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
        MUSICA.alCambiar = pintar;
        ponerVol();
        const nota = crear("p", "oc-hoja-nota master-fuente", "Tus canciones (y sus imágenes) se quedan sólo en este dispositivo: no"
            + " se suben a ningún sitio. Para no perderlas (o llevarlas a otro ordenador), ⚙ → exportar. Siguen sonando al cambiar de pestaña;"
            + " al quitar esta ventana, se paran.");
        dentro.append(repro, herramientas, busca, cuantos, form, vacio, resultados, tarjetas, arbol, subir, nota);
        pintarModo();
        pintarArbol();
    }

    // ---- 🛠️ TUS CREACIONES: crear, cambiar, copiar (de uno del SRD),
    // importar y exportar lo tuyo (leerPropios). Se abre con el ＋ de al
    // lado del buscador. Una lista por pestaña y, al crear o cambiar, su
    // formulario en la misma ventana. ----
    const CR_LISTA = ["0", "1/8", "1/4", "1/2"].concat(Array.from({ length: 30 }, (x, i) => String(i + 1)));
    const CR_PX = { 0: 10, "1/8": 25, "1/4": 50, "1/2": 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900,
        9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000,
        20: 25000, 21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000 };
    function vdDe(cr) {
        const n = cr.indexOf("/") > 0 ? 0 : parseInt(cr, 10) || 0;
        const bc = n < 5 ? 2 : Math.min(9, 2 + Math.ceil((n - 4) / 4));
        return cr + " (" + (CR_PX[cr] || 0).toLocaleString("es-ES") + " PX; BC +" + bc + ")";
    }
    const PROPIO_TIPOS = ["Aberración", "Autómata", "Bestia", "Celestial", "Cieno", "Dragón", "Elemental", "Enjambre", "Feérico",
        "Gigante", "Humanoide", "Infernal", "Monstruosidad", "Muerto viviente", "Planta"];
    const PROPIO_TAMANOS = ["Diminuto", "Pequeño", "Mediano", "Grande", "Enorme", "Gargantuesco", "Pequeño o Mediano"];
    const PROPIO_ALIN = ["legal bueno", "neutral bueno", "caótico bueno", "legal neutral", "neutral", "caótico neutral",
        "legal malvado", "neutral malvado", "caótico malvado", "sin alineamiento"];
    const PROPIO_HABITATS = ["ártico", "bajo el agua", "bosque", "ciudad", "colinas", "costa", "cualquiera", "desierto",
        "montañas", "pantano", "praderas", "Infraoscuridad", "Feywild", "Shadowfell", "plano Etéreo", "planos elementales",
        "planos inferiores", "planos superiores", "Abismo", "Nueve Infiernos"];
    const PROPIO_ESCUELAS = ["Abjuración", "Adivinación", "Conjuración", "Encantamiento", "Evocación", "Ilusionismo", "Nigromancia",
        "Transmutación"];
    const PROPIO_CLASES = ["bardo", "brujo", "clérigo", "druida", "explorador", "hechicero", "mago", "paladín"];
    const PROPIO_RAREZAS = ["común", "poco común", "rara", "muy rara", "legendaria", "artefacto"];
    const PROPIO_TIENDAS = ["Tienda general", "Herrería y armería", "Herramientas e instrumentos", "Alquimista y herbolario",
        "Templo", "Arcanista", "Taberna", "Establos y transportes", "Tienda de magia"];
    const PROPIO_CATS = ["objeto maravilloso", "arma", "armadura", "escudo", "poción", "anillo", "varita", "bastón", "cetro",
        "pergamino", "munición", "equipo", "herramienta", "instrumento", "comida y bebida", "montura", "vehículo"];
    const PROPIO_RASGOS = ["rasgo de clase", "rasgo de especie", "dote de origen", "dote general", "estilo de combate", "don épico",
        "rasgo de trasfondo", "otro rasgo"];
    const PROPIO_OTROS = ["especie", "trasfondo", "dote", "clase", "subclase", "rasgo de clase", "regla", "lugar", "deidad", "otro"];
    const SECCIONES_BICHO = [["rasgos", "Rasgos"], ["acciones", "Acciones"], ["adicionales", "Acciones adicionales"],
        ["reacciones", "Reacciones"], ["legendarias", "Acciones legendarias"]];

    // Lo que entra (de un archivo o del formulario), limpio: sólo lo que
    // se usa, textos con tope y números de verdad. Sin nombre, nada.
    function limpiarPropio(tipo, x) {
        if (!x || typeof x !== "object") {
            return null;
        }
        const txt = (v, max) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, max || 400).trim() : "");
        const num = (v, min, max, def) => {
            const n = Number(v);
            return isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : def;
        };
        const nombre = txt(x.nombre, 120);
        if (!nombre) {
            return null;
        }
        const o = { id: /^p[a-z0-9]{4,20}$/.test(x.id || "") ? x.id : idDoc("p"), propio: true, nombre,
            en: txt(x.en, 120) || nombre, libro: txt(x.libro, 160) };
        const entradas = (v) => (Array.isArray(v) ? v : []).slice(0, 60).map((r) => ({ n: txt(r && r.n, 160), t: txt(r && r.t, 6000) }))
            .filter((r) => r.n || r.t);
        if (tipo === "monstruos") {
            ["tipo", "alin", "ca", "ini", "pgf", "vel", "salv", "hab", "vuln", "res", "inm", "inmE", "sent", "idio", "equipo"].forEach((k) => {
                const v = txt(x[k], 600);
                if (v) {
                    o[k] = v;
                }
            });
            o.tipo = o.tipo || "Monstruosidad Mediano";
            o.alin = o.alin || "neutral";
            o.ca = o.ca || "10";
            o.vel = o.vel || "30 ft.";
            o.pg = num(x.pg, 1, 9999, 10);
            const c = x.car && typeof x.car === "object" ? x.car : {};
            o.car = {};
            ["Fue", "Des", "Con", "Int", "Sab", "Car"].forEach((k) => {
                o.car[k] = num(c[k], 1, 30, 10);
            });
            o.cr = CR_LISTA.includes(String(x.cr)) ? String(x.cr) : "1";
            o.vd = txt(x.vd, 120) || vdDe(o.cr);
            if (!o.ini) {
                const d = Math.floor((o.car.Des - 10) / 2);
                o.ini = (d >= 0 ? "+" : "−") + Math.abs(d) + " (" + (10 + d) + ")";
            }
            o.sent = o.sent || "Percepción pasiva " + (10 + Math.floor((o.car.Sab - 10) / 2));
            o.idio = o.idio || "—";
            o.habitat = (Array.isArray(x.habitat) ? x.habitat : []).map((h) => txt(h, 60)).filter(Boolean).slice(0, 20);
            SECCIONES_BICHO.forEach(([k]) => {
                const l = entradas(x[k]);
                if (l.length) {
                    o[k] = l;
                }
            });
            o.acciones = o.acciones || [];
            const li = txt(x.legInfo, 2000);
            if (li && o.legendarias) {
                o.legInfo = li;
            }
        } else if (tipo === "objetos") {
            o.cat = txt(x.cat, 80) || "objeto maravilloso";
            const r = txt(x.rareza, 40);
            if (r) {
                o.rareza = r;
            }
            if (x.sint) {
                o.sint = 1;
            }
            ["det", "peso", "nota"].forEach((k) => {
                const v = txt(x[k], 300);
                if (v) {
                    o[k] = v;
                }
            });
            o.cp = num(x.cp, 0, 1e9, 0);
            o.tiendas = (Array.isArray(x.tiendas) ? x.tiendas : []).filter((t) => PROPIO_TIENDAS.includes(t));
            o.texto = txt(x.texto, 12000);
        } else if (tipo === "conjuros") {
            o.nivel = num(x.nivel, 0, 9, 1);
            o.escuela = txt(x.escuela, 40) || "Evocación";
            ["tiempo", "alcance", "comp", "dur"].forEach((k) => {
                o[k] = txt(x[k], 300) || "—";
            });
            o.clases = (Array.isArray(x.clases) ? x.clases : []).map((c) => txt(c, 40).toLowerCase()).filter(Boolean).slice(0, 20);
            if (x.ritual) {
                o.ritual = true;
            }
            if (x.conc) {
                o.conc = true;
            }
            o.texto = txt(x.texto, 12000);
            const s = txt(x.superior, 4000);
            if (s) {
                o.superior = s;
            }
        } else if (tipo === "rasgos") {
            o.tipo = txt(x.tipo, 60) || "dote";
            o.de = txt(x.de, 120);
            const nv = num(x.nivel, 0, 20, 0);
            if (nv) {
                o.nivel = nv;
            }
            o.texto = txt(x.texto, 20000);
        } else {
            o.cat = txt(x.cat, 60) || "otro";
            o.texto = txt(x.texto, 20000);
        }
        return o;
    }

    // Lo mismo, con los términos en inglés pasados al español.
    const T_CATS = { ring: "anillo", weapon: "arma", armor: "armadura", "light armor": "armadura ligera",
        "medium armor": "armadura intermedia", "heavy armor": "armadura pesada", shield: "escudo", potion: "poción", rod: "cetro",
        scroll: "pergamino", staff: "bastón", wand: "varita", ammunition: "munición", "wondrous item": "objeto maravilloso",
        "adventuring gear": "equipo", tool: "herramienta", "artisan's tools": "herramienta de artesano", instrument: "instrumento",
        "spellcasting focus": "canalizador", mount: "montura", vehicle: "vehículo", "food and drink": "comida y bebida" };
    function traducirPropio(tipo, o) {
        const x = JSON.parse(JSON.stringify(o));
        Object.keys(x).forEach((k) => {
            if (typeof x[k] === "string" && !["id", "nombre", "en", "libro", "cr"].includes(k)) {
                const cat = k === "cat" && tipo === "objetos" && T_CATS[x[k].trim().toLowerCase()];
                x[k] = cat || (k === "tipo" && tipo === "monstruos" ? traducirTipo(x[k]) : traducir(x[k]));
            }
        });
        SECCIONES_BICHO.forEach(([k]) => {
            if (Array.isArray(x[k])) {
                x[k] = x[k].map((r) => ({ n: traducir(r.n), t: traducir(r.t) }));
            }
        });
        if (Array.isArray(x.clases)) {
            x.clases = x.clases.map((c) => traducir(c.charAt(0).toUpperCase() + c.slice(1)).toLowerCase());
        }
        return x;
    }

    // Que no se repita el «en» (es por lo que se encuentra cada uno).
    function enUnico(tipo, o, srd) {
        const usados = new Set(srd.map((x) => x.en).concat(leerPropios()[tipo].filter((x) => x.id !== o.id).map((x) => x.en)));
        let en = o.en;
        let n = 2;
        while (usados.has(en)) {
            en = o.en + " (" + n + ")";
            n += 1;
        }
        o.en = en;
        return o;
    }

    // Una de las «otras cosas» (especie, dote…) en su ventana.
    function abrirOtro(x, vuelta) {
        const cuerpo = crear("div", "oc-regla-ventana");
        cuerpo.appendChild(crear("p", "oc-hoja-nota", x.cat));
        const t = markdown(x.texto);
        cuerpo.appendChild(t);
        if (window.ocDadosEnTexto) {
            window.ocDadosEnTexto(t);
        }
        enlazarConjuros(t);
        cuerpo.appendChild(crear("p", "oc-hoja-nota master-fuente", fuenteDe(x)));
        cuerpo.appendChild(botonDe("oc-vida-accion", "📌 al tablero", () => {
            cerrar();
            anadir("ficha", { titulo: x.nombre, datos: { que: "otro", id: x.id } });
        }, "Poner " + x.nombre + " en el tablero"));
        const cerrar = window.ocVentana.abrir({ titulo: x.nombre, cuerpo, vuelta, clase: "es-regla" });
    }

    // Un archivo para bajar (con una dirección blob: del propio navegador).
    function bajarJson(datos, nombre) {
        const a = crear("a");
        const archivoBlob = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 1)], { type: "application/json" }));
        a.href = archivoBlob;
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(archivoBlob), 1000);
    }

    // La plantilla: un ejemplo de cada (inventados), con todos los campos.
    const PLANTILLA_PROPIOS = { pantallaDeMasterPropios: 1,
        ayuda: "Rellena las listas y cárgalo con ⬆ importar. Sólo «nombre» es obligatorio. Los textos admiten *cursiva* y **negrita**. Los ataques, con el formato «*Ataque cuerpo a cuerpo:* +4, alcance 5 ft. *Impacto:* 5 (1d6 + 2) de daño cortante.» salen en tabla con sus dados. Si algo va en inglés, se traducen los términos de reglas al importar.",
        monstruos: [{ nombre: "Rata de alcantarilla gigante", en: "Giant Sewer Rat", libro: "inventado", tipo: "Bestia Pequeño",
            alin: "sin alineamiento", ca: "12", pg: 9, pgf: "2d6 + 2", vel: "30 ft., trepar 20 ft.",
            car: { Fue: 7, Des: 15, Con: 12, Int: 2, Sab: 10, Car: 4 }, hab: "Sigilo +4", sent: "visión en la oscuridad 60 ft.; Percepción pasiva 10",
            idio: "—", cr: "1/4", habitat: ["ciudad"],
            rasgos: [{ n: "Olfato agudo", t: "La rata tiene ventaja en las pruebas de Sabiduría (Percepción) que dependen del olfato." }],
            acciones: [{ n: "Mordisco", t: "*Ataque cuerpo a cuerpo:* +4, alcance 5 ft. *Impacto:* 4 (1d4 + 2) de daño perforante. Si el objetivo es una criatura, *Tirada de salvación de Constitución:* CD 11. *Fallo:* queda envenenado hasta el final de su siguiente turno." }],
            reacciones: [{ n: "Escabullirse", t: "*Desencadenante:* Una criatura falla un ataque contra la rata. *Respuesta:* La rata se mueve 10 ft. sin provocar ataques de oportunidad." }] }],
        objetos: [{ nombre: "Farol del vigía", en: "Watchman's Lantern", libro: "inventado", cat: "objeto maravilloso", rareza: "poco común",
            sint: false, cp: 25000, peso: "2 lb.", tiendas: ["Tienda de magia"],
            texto: "Mientras está encendido, las criaturas invisibles a 30 ft. o menos del farol dejan ver su silueta. Se enciende y se apaga con una acción adicional." }],
        conjuros: [{ nombre: "Paso de niebla gris", en: "Grey Mist Step", libro: "inventado", nivel: 2, escuela: "Conjuración",
            tiempo: "1 acción adicional", alcance: "Personal", comp: "V", dur: "Instantánea", clases: ["brujo", "hechicero", "mago"],
            ritual: false, conc: false, texto: "Te envuelve una niebla gris y te teletransportas hasta 30 ft. a un espacio desocupado que veas. Cada criatura a 5 ft. del sitio del que te vas recibe 1d6 de daño de frío.",
            superior: "**Con un espacio de nivel superior.** El daño aumenta en 1d6 por cada nivel por encima de 2." }],
        rasgos: [{ nombre: "Marinero curtido", en: "Seasoned Sailor", libro: "inventado", tipo: "dote general", de: "dote",
            texto: "**Piernas de mar.** No tienes desventaja por el balanceo de un barco.\n\n**Nudos.** Tienes ventaja en las pruebas para atar o desatar nudos." }],
        otros: [{ nombre: "Dote: Centinela del puerto", libro: "inventado", cat: "dote",
            texto: "*Requisito: nivel 4 o más.*\n\n**Ojo de marino.** Tienes ventaja en las pruebas de Sabiduría (Percepción) en barcos y muelles.\n\n**Amarre firme.** No pueden derribarte mientras estés sobre una cubierta." }] };


    // ---- PEGAR UN BLOQUE: lo copiado de una página (D&D Beyond, un PDF…),
    // como texto, a los campos de un monstruo, un objeto o un conjuro. Sale
    // en inglés o en español, con el formato de 2024 o el de 2014; lo que
    // no se reconoce se queda en el texto para repasarlo a mano. Después
    // pasa por traducirPropio() si está marcado «traducir». ----
    const RE_ETIQUETAS_ATAQUE = /(^|[\s.])((?:Melee or Ranged|Melee|Ranged) (?:Attack Roll|Weapon Attack|Spell Attack)|Hit or Miss|Hit|Miss|Failure or Success|Success or Failure|First Failure|Second Failure|Failure|Success|Trigger|Response|(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw|Ataque (?:cuerpo a cuerpo|a distancia)(?: o a distancia)?|Impacto|Fallo|Éxito|Desencadenante|Respuesta|Tirada de salvación de \S+):(?!\*)/g;
    function marcarEtiquetas(t) {
        return t.replace(RE_ETIQUETAS_ATAQUE, (x, antes, et) => antes + "*" + et + ":*")
            .replace(/(\*(?:Melee|Ranged)[^*]*:\*\s*[+\-−–]\d+) to hit/g, "$1");
    }
    const lineasDe = (texto) => String(texto || "").replace(/ /g, " ").split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim())
        .filter(Boolean);
    // Una entrada «Nombre. Texto» (o «Nombre (Recarga 5–6). Texto»).
    const RE_ENTRADA = /^([A-ZÁÉÍÓÚÑ][^.:]{0,70}?(?: \([^)]{1,40}\))?)\. (.+)$/;
    const CARACT_EN = { str: "Fue", dex: "Des", con: "Con", int: "Int", wis: "Sab", cha: "Car", fue: "Fue", des: "Des",
        sab: "Sab", car: "Car" };

    function leerBloqueMonstruo(texto) {
        const lineas = lineasDe(texto);
        const o = { nombre: lineas[0] || "", car: {} };
        if (!lineas.length) {
            return o;
        }
        let i = 1;
        // «Small Fey (Goblinoid), Chaotic Neutral»
        if (lineas[1] && /,/.test(lineas[1]) && !/^(AC|Armor Class|CA|Clase de Armadura)\b/i.test(lineas[1])) {
            const coma = lineas[1].lastIndexOf(",");
            o.tipo = lineas[1].slice(0, coma).trim();
            o.alin = lineas[1].slice(coma + 1).trim();
            i = 2;
        }
        // Las características: «Str 8 −1 −1» (2024) o «STR 8 (−1)» (2014),
        // en una línea o en varias.
        const todo = lineas.join(" ");
        const salv = [];
        let m;
        const re24 = /\b(Str|Dex|Con|Int|Wis|Cha|Fue|Des|Sab|Car)\s+(\d{1,2})\s+([+\-−–]\d+)\s+([+\-−–]\d+)/gi;
        while ((m = re24.exec(todo))) {
            const k = CARACT_EN[m[1].toLowerCase()];
            o.car[k] = Number(m[2]);
            const num = (x) => parseInt(x.replace(/[−–]/, "-"), 10);
            if (num(m[4]) !== num(m[3])) {
                salv.push(k + " " + (num(m[4]) >= 0 ? "+" : "−") + Math.abs(num(m[4])));
            }
        }
        if (Object.keys(o.car).length < 6) {
            const re14 = /\b(STR|DEX|CON|INT|WIS|CHA|FUE|DES|SAB|CAR)\s+(\d{1,2})\s*\(\s*[+\-−–]?\d+\s*\)/gi;
            while ((m = re14.exec(todo))) {
                o.car[CARACT_EN[m[1].toLowerCase()]] = Number(m[2]);
            }
        }
        if (Object.keys(o.car).length < 6) {
            // La tabla de 2014 con las seis cabeceras juntas y luego los seis valores.
            const t = /\bSTR\s+DEX\s+CON\s+INT\s+WIS\s+CHA\b\s*((?:\d{1,2}\s*\(\s*[+\-−–]?\d+\s*\)\s*){6})/i.exec(todo);
            if (t) {
                const vals = t[1].match(/\d{1,2}(?=\s*\()/g);
                ["Fue", "Des", "Con", "Int", "Sab", "Car"].forEach((k, j) => {
                    o.car[k] = Number(vals[j]);
                });
            }
        }
        if (salv.length) {
            o.salv = salv.join(", ");
        }
        const campos = [
            [/^(?:AC|Armor Class|CA|Clase de Armadura)\s+(.+?)(?:\s+(?:Initiative|Iniciativa)\s+(.+))?$/i, (x) => {
                o.ca = x[1];
                if (x[2]) {
                    o.ini = x[2];
                }
            }],
            [/^(?:Initiative|Iniciativa)\s+(.+)$/i, (x) => {
                o.ini = x[1];
            }],
            [/^(?:HP|Hit Points|PG|Puntos de golpe)\s+(\d+)\s*(?:\((.+)\))?/i, (x) => {
                o.pg = Number(x[1]);
                o.pgf = x[2] || "";
            }],
            [/^(?:Speed|Velocidad)\s+(.+)$/i, (x) => {
                o.vel = x[1];
            }],
            [/^(?:Saving Throws|Tiradas de salvación|Salvaciones)\s+(.+)$/i, (x) => {
                o.salv = x[1];
            }],
            [/^(?:Skills|Habilidades)\s+(.+)$/i, (x) => {
                o.hab = x[1];
            }],
            [/^(?:Damage Vulnerabilities|Vulnerabilities|Vulnerabilidades)\s+(.+)$/i, (x) => {
                o.vuln = x[1];
            }],
            [/^(?:Damage Resistances|Resistances|Resistencias)\s+(.+)$/i, (x) => {
                o.res = x[1];
            }],
            [/^(?:Damage Immunities)\s+(.+)$/i, (x) => {
                o.inm = x[1];
            }],
            [/^(?:Condition Immunities)\s+(.+)$/i, (x) => {
                o.inmE = x[1];
            }],
            [/^(?:Immunities|Inmunidades)\s+(.+)$/i, (x) => {
                // 2024: «Poison, Psychic; Charmed, Poisoned» (daños; estados).
                const [dano, estados] = x[1].split(";");
                o.inm = (dano || "").trim();
                if (estados) {
                    o.inmE = estados.trim();
                }
            }],
            [/^(?:Gear|Equipment|Equipo)\s+(.+)$/i, (x) => {
                o.equipo = x[1];
            }],
            [/^(?:Senses|Sentidos)\s+(.+)$/i, (x) => {
                o.sent = x[1];
            }],
            [/^(?:Languages|Idiomas)\s+(.+)$/i, (x) => {
                o.idio = x[1];
            }],
            [/^(?:CR|Challenge|VD|Desafío)\s+(\d+(?:\/\d)?)/i, (x) => {
                o.cr = x[1];
            }],
        ];
        const SECCIONES = { traits: "rasgos", rasgos: "rasgos", actions: "acciones", acciones: "acciones",
            "bonus actions": "adicionales", "acciones adicionales": "adicionales", reactions: "reacciones", reacciones: "reacciones",
            "legendary actions": "legendarias", "acciones legendarias": "legendarias" };
        let seccion = null;
        let ultima = null;
        for (; i < lineas.length; i += 1) {
            const l = lineas[i];
            const cab = SECCIONES[l.toLowerCase().replace(/[:.]$/, "")];
            if (cab) {
                seccion = cab;
                ultima = null;
                continue;
            }
            if (/^(Lair Actions|Mythic Actions|Regional Effects|Acciones de guarida)$/i.test(l)) {
                seccion = "fuera";
                continue;
            }
            if (seccion === "fuera" || /^(STR|DEX|CON|INT|WIS|CHA|MOD|SAVE|Str|Dex|Con|Int|Wis|Cha)\b(\s+(DEX|CON|INT|WIS|CHA|SAVE))*$/.test(l)
                || /^[+\-−–]?\d+(\s*\([+\-−–]?\d+\))?$/.test(l)) {
                continue;
            }
            if (!seccion) {
                const c = campos.find(([re]) => re.test(l));
                if (c) {
                    c[1](c[0].exec(l));
                    continue;
                }
                if (/^(Str|Dex|Con|Int|Wis|Cha)\s+\d/i.test(l)) {
                    continue;
                }
                if (!o.cr && !o.ca) {
                    continue;
                }
                // Tras los datos y antes de «Actions»: rasgos (en 2014 no
                // llevan título).
                if (o.cr || o.idio || o.sent) {
                    seccion = "rasgos";
                } else {
                    continue;
                }
            }
            if (seccion === "legendarias" && /^(Legendary Action Uses|Usos de acción legendaria)[:\s]/i.test(l)) {
                o.legInfo = l.replace(/^(Legendary Action Uses|Usos de acción legendaria):?/i, (x, et) => "*" + et + ":*");
                continue;
            }
            if (seccion === "legendarias" && /can take \d+ legendary actions/i.test(l)) {
                o.legInfo = l;
                continue;
            }
            const e = RE_ENTRADA.exec(l);
            if (e && !/^(Hit|Miss|Failure|Success|Trigger|Response|Impacto|Fallo|Éxito)\b/.test(e[1])) {
                ultima = { n: e[1], t: marcarEtiquetas(e[2]) };
                o[seccion] = (o[seccion] || []).concat(ultima);
            } else if (ultima) {
                ultima.t += "\n\n" + marcarEtiquetas(l);
            } else {
                ultima = { n: "", t: marcarEtiquetas(l) };
                o[seccion] = (o[seccion] || []).concat(ultima);
            }
        }
        return o;
    }

    function leerBloqueConjuro(texto) {
        const lineas = lineasDe(texto);
        const o = { nombre: lineas[0] || "", clases: [] };
        const resto = [];
        const ETIQ = /^(Casting Time|Range(?:\/Area)?|Components|Duration|Level|School|Classes|Tiempo de lanzamiento|Lanzamiento|Alcance|Componentes|Duración)\s*:?\s*(.*)$/i;
        let superior = false;
        for (let i = 1; i < lineas.length; i += 1) {
            const l = lineas[i];
            let m = /^Level (\d) (\w+)(?: \(([^)]*)\))?/i.exec(l) || /^Nivel (\d),? (\w+)(?: \(([^)]*)\))?/i.exec(l);
            if (m && o.nivel === undefined) {
                o.nivel = Number(m[1]);
                o.escuela = m[2];
                o.clases = (m[3] || "").split(",").map((c) => c.trim()).filter(Boolean);
                continue;
            }
            m = /^(\w+) Cantrip(?: \(([^)]*)\))?/i.exec(l) || /^(\d)(?:st|nd|rd|th)-level (\w+)( \(ritual\))?/i.exec(l);
            if (m && o.nivel === undefined) {
                if (/cantrip/i.test(l)) {
                    o.nivel = 0;
                    o.escuela = m[1];
                    o.clases = (m[2] || "").split(",").map((c) => c.trim()).filter(Boolean);
                } else {
                    o.nivel = Number(m[1]);
                    o.escuela = m[2];
                    o.ritual = !!m[3];
                }
                continue;
            }
            m = ETIQ.exec(l);
            if (m) {
                let valor = m[2];
                if (!valor && i + 1 < lineas.length && !ETIQ.test(lineas[i + 1])) {
                    i += 1;
                    valor = lineas[i];
                }
                const et = m[1].toLowerCase();
                if (/casting|lanzamiento/.test(et)) {
                    o.tiempo = valor.replace(/\bor Ritual\b/i, () => {
                        o.ritual = true;
                        return "";
                    }).trim().replace(/^(Action|Bonus Action|Reaction)\b/i, "1 $1");
                } else if (/range|alcance/.test(et)) {
                    o.alcance = valor;
                } else if (/comp/.test(et)) {
                    o.comp = valor;
                } else if (/dur/.test(et)) {
                    o.dur = valor;
                    o.conc = /concentra/i.test(valor);
                } else if (/class/.test(et)) {
                    o.clases = valor.split(",").map((c) => c.trim()).filter(Boolean);
                } else if (/level/.test(et) && /^\d|cantrip/i.test(valor)) {
                    o.nivel = /cantrip/i.test(valor) ? 0 : parseInt(valor, 10);
                } else if (/school/.test(et)) {
                    o.escuela = valor;
                }
                continue;
            }
            if (/^(Using a Higher-Level Spell Slot|At Higher Levels|Cantrip Upgrade|Con un espacio de nivel superior|Mejora del truco)[.:]/i.test(l)) {
                superior = true;
                o.superior = "**" + l.replace(/^([^.:]+[.:])/, "$1**");
                continue;
            }
            if (superior) {
                o.superior += "\n\n" + l;
            } else {
                resto.push(l);
            }
        }
        o.texto = resto.join("\n\n");
        o.clases = o.clases.map((c) => c.toLowerCase());
        return o;
    }

    function leerBloqueObjeto(texto) {
        const lineas = lineasDe(texto);
        const o = { nombre: lineas[0] || "" };
        let i = 1;
        // «Wondrous Item, Rare (Requires Attunement)»
        const l = lineas[1] || "";
        if (/,|\bRequires Attunement\b|\b(Common|Uncommon|Rare|Very Rare|Legendary|Artifact)\b/i.test(l)) {
            const sint = /\((?:Requires|Requiere) (?:Attunement|sintonía)[^)]*\)/i;
            o.sint = sint.test(l);
            const sin = l.replace(sint, "").trim();
            const rar = /\b(Very Rare|Uncommon|Common|Rare|Legendary|Artifact|muy rara|poco común|común|rara|legendaria|artefacto)\b/i.exec(sin);
            if (rar) {
                o.rareza = rar[1];
            }
            o.cat = sin.split(/,|\(/)[0].trim();
            i = 2;
        }
        o.texto = lineas.slice(i).join("\n\n");
        return o;
    }

    // LA GUÍA: cómo copiar un bloque de D&D Beyond (o de un PDF) y pegarlo.
    function abrirGuiaPegar(vuelta) {
        const cuerpo = crear("div", "master-guia");
        const paso = (n, titulo, ...cosas) => {
            const sec = crear("section", "master-guia-paso");
            const h = crear("h3", "master-guia-titulo");
            h.append(crear("span", "master-guia-numero", String(n)), document.createTextNode(titulo));
            sec.append(h, ...cosas);
            cuerpo.appendChild(sec);
        };
        const p = (t) => crear("p", "", t);
        const img = (src, alt) => {
            const i = crear("img", "master-guia-imagen");
            i.src = src;
            i.alt = alt;
            i.loading = "lazy";
            return i;
        };
        // El dibujo del paso 2: un bloque de un monstruo inventado, con lo
        // que hay que seleccionar marcado.
        const bloque = crear("div", "master-guia-bloque");
        bloque.setAttribute("role", "img");
        bloque.setAttribute("aria-label", "Ejemplo: un bloque de estadísticas seleccionado entero, desde el nombre del monstruo"
            + " hasta la última acción.");
        const filas = [["es-nombre", "Rata de alcantarilla gigante"], ["es-cursiva", "Small Beast, Unaligned"],
            ["", "AC 12   Initiative +2 (12)"], ["", "HP 9 (2d6 + 2)"], ["", "Speed 30 ft., Climb 20 ft."],
            ["es-tabla", "Str 7 −2 −2 · Dex 15 +2 +2 · Con 12 +1 +1 …"], ["", "Senses Darkvision 60 ft.; Passive Perception 10"],
            ["", "CR 1/4 (XP 50; PB +2)"], ["es-seccion", "Actions"],
            ["", "Bite. Melee Attack Roll: +4, reach 5 ft. Hit: 4 (1d4 + 2) Piercing damage."]];
        filas.forEach(([c, t]) => {
            const f = crear("p", "master-guia-fila " + c, t);
            f.setAttribute("aria-hidden", "true");
            bloque.appendChild(f);
        });
        const desde = crear("span", "master-guia-marca es-desde", "▶ desde aquí");
        const hasta = crear("span", "master-guia-marca es-hasta", "hasta aquí ◀");
        desde.setAttribute("aria-hidden", "true");
        hasta.setAttribute("aria-hidden", "true");
        bloque.prepend(desde);
        bloque.appendChild(hasta);
        cuerpo.appendChild(p("Para traer a tu mesa monstruos, objetos y conjuros de los libros que tienes en D&D Beyond (o de"
            + " un PDF tuyo) sin escribirlos campo a campo. Se quedan sólo en este dispositivo."));
        paso(1, "Ábrelo en D&D Beyond", p("Entra con tu cuenta y abre la página del monstruo, el objeto o el conjuro (de un libro"
            + " que tengas)."));
        paso(2, "Selecciona el bloque entero y cópialo", p("Arrastra desde el nombre hasta el final de la última acción (o del"
            + " texto, en un objeto o un conjuro) y cópialo: Ctrl + C (en un Mac, ⌘ + C; en una tablet, mantén pulsado →"
            + " Copiar)."), bloque, p("Si se cuela algo de más (botones, notas), no pasa nada: lo que no se reconoce se salta o"
            + " se queda en el texto para repasarlo."));
        paso(3, "Pégalo aquí", p("En 🛠️ tus creaciones, en la pestaña que toque (🐉 monstruos, 💰 objetos o ✨ conjuros), pulsa"
            + " «📋 pegar un bloque», pega con Ctrl + V y pulsa «✓ rellenar»."), img("imagenes/guia/pegar.webp",
            "La ventana «pegar un bloque» con el texto de un monstruo pegado y el botón «rellenar»."));
        paso(4, "Repásalo y guarda", p("Se abre el formulario ya relleno, con los términos de reglas pasados al español si está"
            + " marcado «🌐 traducir» (las frases se quedan en inglés: cámbialas si quieres). Mira el tipo, el tamaño y el VD,"
            + " pon de qué libro sale y pulsa «✓ guardar»."), img("imagenes/guia/formulario.webp",
            "El formulario de un monstruo relleno solo: nombre, tipo, tamaño, VD, CA, PG y sus acciones."));
        paso(5, "Ya está en tu mesa", p("Sale en el bestiario, los encuentros, el buscador… como los del SRD, con «🛠️ tuyo». Los"
            + " ataques, en su tabla con los dados para tirar."), img("imagenes/guia/resultado.webp",
            "El monstruo en su ventana, con la tabla de ataques y los dados."));
        window.ocVentana.abrir({ titulo: "cómo pegar desde D&D Beyond", cuerpo, vuelta, clase: "es-ancha" });
    }

    function montarCreador(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        const TIPOS = [["monstruos", "🐉 monstruos", "monstruo"], ["objetos", "💰 objetos", "objeto"], ["conjuros", "✨ conjuros", "conjuro"],
            ["rasgos", "⭐ rasgos y dotes", "rasgo"], ["otros", "📜 más cosas", "cosa"]];
        const RUTA_DE = { monstruos: "datos/personajes/compendio/bestiario.json", objetos: "datos/personajes/compendio/tienda.json",
            conjuros: "datos/personajes/compendio/conjuros-srd.json", rasgos: RASGOS_SRD };
        const uid = "master-creador-" + m.id;
        // Lo del SRD de cada tipo (para copiar uno y para que no se repitan).
        const srd = { monstruos: [], objetos: [], conjuros: [], rasgos: [], otros: [] };
        const cargado = Promise.all(Object.keys(RUTA_DE).map((k) => pedidos[RUTA_DE[k]] || pedir(RUTA_DE[k]))).then((xs) => {
            Object.keys(RUTA_DE).forEach((k, i) => {
                srd[k] = (xs[i][k] || []).filter((x) => !x.propio);
            });
        }).catch(() => {});

        // ARRIBA: el aviso, importar, exportar y la plantilla.
        const vista = crear("div", "master-creador-vista");
        const nota = crear("p", "oc-hoja-nota", "Monstruos, objetos, conjuros y más cosas de otros manuales (cópialos de tu libro)"
            + " o inventados. Salen en el bestiario, los encuentros, la tienda, el botín, los conjuros y el buscador, como los del SRD."
            + " Se quedan sólo en este navegador: no se suben a la web. Para no perderlos o pasárselos a otro máster, ⬇ exportar.");
        const barra = crear("div", "master-creador-barra");
        const archivo = crear("input");
        archivo.type = "file";
        archivo.accept = ".json,application/json";
        archivo.hidden = true;
        const importar = botonDe("oc-vida-accion", "⬆ importar .json", () => archivo.click(), "Importar creaciones desde un archivo .json");
        const exportar = botonDe("oc-vida-accion", "⬇ exportar", () => {
            const p = leerPropios();
            const n = p.monstruos.length + p.objetos.length + p.conjuros.length + p.rasgos.length + p.otros.length;
            if (!n) {
                avisar("Aún no hay nada tuyo que exportar.");
                return;
            }
            bajarJson(Object.assign({ pantallaDeMasterPropios: 1 }, p), "mis-creaciones-" + new Date().toISOString().slice(0, 10) + ".json");
            avisar("Exportadas " + n + " creaciones.");
        }, "Exportar todas tus creaciones a un archivo .json");
        const plantilla = botonDe("oc-vida-accion", "📄 plantilla", () => {
            bajarJson(PLANTILLA_PROPIOS, "plantilla-creaciones.json");
            avisar("Bajada la plantilla, con un ejemplo de cada.");
        }, "Bajar una plantilla .json de ejemplo para rellenar");
        const etTr = crear("label", "master-creador-check");
        const conTraducir = crear("input");
        conTraducir.type = "checkbox";
        conTraducir.checked = d.traducir !== false;
        conTraducir.addEventListener("change", () => {
            d.traducir = conTraducir.checked;
            guardar();
        });
        etTr.append(conTraducir, " 🌐 traducir los términos al importar");
        barra.append(importar, exportar, plantilla, etTr, archivo);
        archivo.addEventListener("change", () => {
            const f = archivo.files && archivo.files[0];
            archivo.value = "";
            if (!f) {
                return;
            }
            const informe = { archivo: f.name, error: "", tipos: {} };
            Promise.all([f.text(), cargado]).then(([texto]) => {
                let datos = null;
                try {
                    datos = JSON.parse(texto);
                } catch (e) {
                    informe.error = "No es un .json válido (no se puede leer).";
                    return;
                }
                if (!datos || typeof datos !== "object" || Array.isArray(datos) || !TIPOS.some(([k]) => Array.isArray(datos[k]))) {
                    informe.error = "No tiene el formato de la plantilla: no trae ninguna lista «monstruos», «objetos»,"
                        + " «conjuros», «rasgos» ni «otros». Mira la 📄 plantilla para ver cómo tiene que ser.";
                    return;
                }
                const p = leerPropios();
                TIPOS.forEach(([k, titulo]) => {
                    const lista = Array.isArray(datos[k]) ? datos[k] : [];
                    if (!lista.length) {
                        return;
                    }
                    const t = { titulo, nuevos: [], cambiados: [], saltados: 0, demasiados: Math.max(0, lista.length - 2000) };
                    informe.tipos[k] = t;
                    lista.slice(0, 2000).forEach((x) => {
                        let o = limpiarPropio(k, x);
                        if (!o) {
                            t.saltados += 1;
                            return;
                        }
                        if (conTraducir.checked) {
                            o = traducirPropio(k, o);
                        }
                        const i = p[k].findIndex((y) => y.id === o.id);
                        if (i >= 0) {
                            p[k][i] = o;
                            t.cambiados.push(o.nombre);
                        } else {
                            p[k].push(o);
                            t.nuevos.push(o.nombre);
                        }
                        if (k !== "otros") {
                            const usados = new Set(srd[k].map((y) => y.en).concat(p[k].filter((y) => y !== o).map((y) => y.en)));
                            let en = o.en;
                            let n = 2;
                            while (usados.has(en)) {
                                en = o.en + " (" + n + ")";
                                n += 1;
                            }
                            o.en = en;
                        }
                    });
                });
                const total = Object.values(informe.tipos).reduce((n, t) => n + t.nuevos.length + t.cambiados.length, 0);
                if (!total) {
                    informe.error = "No había nada que se pudiera importar: a todo le faltaba el nombre o no se entendía.";
                    return;
                }
                if (!guardarPropios(p)) {
                    informe.error = "No se ha podido guardar: no queda sitio en este navegador. No se ha importado nada.";
                    return;
                }
                pintarListas();
            }).catch(() => {
                informe.error = informe.error || "No se ha podido leer el archivo.";
            }).then(() => verInforme(informe));
        });

        // LA VENTANA CON CÓMO HA IDO LA IMPORTACIÓN: qué ha entrado (nuevo
        // o cambiado), qué se ha saltado y por qué; o el error, si no ha
        // entrado nada.
        function verInforme(informe) {
            const cuerpo = crear("div", "master-informe");
            const tipos = Object.values(informe.tipos);
            const nuevos = tipos.reduce((n, t) => n + t.nuevos.length, 0);
            const cambiados = tipos.reduce((n, t) => n + t.cambiados.length, 0);
            const bien = !informe.error;
            const estado = crear("p", "master-informe-estado " + (bien ? "es-bien" : "es-mal"),
                bien ? "✅ Importado: " + nuevos + (nuevos === 1 ? " nuevo" : " nuevos")
                    + (cambiados ? " y " + cambiados + (cambiados === 1 ? " cambiado" : " cambiados") : "") + "."
                    : "⚠️ No se ha importado nada.");
            cuerpo.append(estado, crear("p", "oc-hoja-nota", "Archivo: " + informe.archivo));
            if (!bien) {
                cuerpo.appendChild(crear("p", "", informe.error));
            } else {
                const tabla = crear("table", "master-informe-tabla");
                tabla.appendChild(crear("caption", "visually-hidden", "Resumen de la importación"));
                const cab = crear("tr");
                ["qué", "nuevos", "cambiados", "saltados"].forEach((x) => {
                    const th = crear("th", "", x);
                    th.scope = "col";
                    cab.appendChild(th);
                });
                const thead = crear("thead");
                thead.appendChild(cab);
                const tbody = crear("tbody");
                tipos.forEach((t) => {
                    const tr = crear("tr");
                    const th = crear("th", "", t.titulo);
                    th.scope = "row";
                    tr.append(th, crear("td", "", String(t.nuevos.length)), crear("td", "", String(t.cambiados.length)),
                        crear("td", "", String(t.saltados + t.demasiados)));
                    tbody.appendChild(tr);
                });
                tabla.append(thead, tbody);
                cuerpo.appendChild(tabla);
                const saltados = tipos.reduce((n, t) => n + t.saltados, 0);
                const demasiados = tipos.reduce((n, t) => n + t.demasiados, 0);
                if (saltados) {
                    cuerpo.appendChild(crear("p", "oc-hoja-nota", "Saltados: " + saltados + " sin nombre o que no se entendían."));
                }
                if (demasiados) {
                    cuerpo.appendChild(crear("p", "oc-hoja-nota", "Sólo entran 2.000 de cada tipo por archivo: " + demasiados
                        + " se han quedado fuera."));
                }
                tipos.forEach((t) => {
                    const lista = t.nuevos.concat(t.cambiados);
                    if (!lista.length) {
                        return;
                    }
                    const det = crear("details", "master-informe-detalle");
                    det.appendChild(crear("summary", "", t.titulo + ": " + lista.length));
                    const ul = crear("ul");
                    lista.slice(0, 200).forEach((nombre) => ul.appendChild(crear("li", "", nombre)));
                    if (lista.length > 200) {
                        ul.appendChild(crear("li", "", "…y " + (lista.length - 200) + " más."));
                    }
                    det.appendChild(ul);
                    cuerpo.appendChild(det);
                });
                if (conTraducir.checked) {
                    cuerpo.appendChild(crear("p", "oc-hoja-nota", "🌐 Con los términos de reglas pasados al español."));
                }
            }
            avisar(estado.textContent);
            window.ocVentana.abrir({ titulo: "importar: " + (bien ? "hecho" : "no ha podido ser"), cuerpo, vuelta: importar });
        }

        // LAS LISTAS, una por pestaña.
        const listas = {};
        const filtros = {};
        const paneles = TIPOS.map(([k, titulo, uno]) => {
            const panel = crear("div", "master-creador-panel");
            const botones = crear("div", "master-creador-barra");
            botones.appendChild(botonDe("oc-vida-accion es-principal", "＋ " + uno + " nuevo", () => editar(k, null), "Crear " +
                (k === "otros" ? "una cosa nueva (especie, dote…)" : "un " + uno + " nuevo")));
            if (k !== "otros" && k !== "rasgos") {
                const pegar = botonDe("oc-vida-accion", "📋 pegar un bloque", () => abrirPegar(k, pegar),
                    "Pegar un bloque copiado (de D&D Beyond, un PDF…) para rellenar " + (k === "monstruos" ? "un monstruo"
                        : k === "objetos" ? "un objeto" : "un conjuro"));
                pegar.setAttribute("aria-haspopup", "dialog");
                const guia = botonDe("oc-vida-accion", "❓ cómo", () => abrirGuiaPegar(guia), "Cómo pegar desde D&D Beyond (guía)");
                guia.setAttribute("aria-haspopup", "dialog");
                botones.append(pegar, guia);
            }
            if (k !== "otros") {
                // Partir de uno del SRD (para hacer una versión).
                const sel = crear("select", "master-elegir");
                sel.id = uid + "-base-" + k;
                const etSel = crear("label", "oc-dados-etiqueta", "o partir de uno del SRD");
                etSel.htmlFor = sel.id;
                cargado.then(() => {
                    const clave = (x) => (k === "rasgos" ? x.en + "|" + x.de : x.en);
                    sel.replaceChildren(...srd[k].slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((x) => {
                        const o = crear("option", "", x.nombre + (k === "rasgos" && x.de && x.de !== "dote" ? " (" + x.de + ")" : ""));
                        o.value = clave(x);
                        return o;
                    }));
                });
                const copiar = botonDe("oc-vida-accion", "⧉ copiar", () => {
                    const base = srd[k].find((x) => (k === "rasgos" ? x.en + "|" + x.de : x.en) === sel.value);
                    if (base) {
                        const x = JSON.parse(JSON.stringify(base));
                        delete x.ilus;
                        delete x.ilusDe;
                        x.libro = "";
                        x.nombre = base.nombre + " (versión)";
                        x.en = base.en + " (versión)";
                        editar(k, x, true);
                    }
                }, "Copiar el elegido para hacer tu versión");
                const caja = crear("div", "master-creador-base");
                caja.append(etSel, sel, copiar);
                botones.appendChild(caja);
            }
            const etF = crear("label", "oc-dados-etiqueta", "buscar entre los tuyos");
            const filtro = crear("input", "oc-dados-texto");
            filtro.type = "search";
            filtro.id = uid + "-filtro-" + k;
            etF.htmlFor = filtro.id;
            filtro.addEventListener("input", () => pintarLista(k));
            filtros[k] = filtro;
            const ul = crear("ul", "master-creador-lista");
            ul.setAttribute("aria-label", titulo.replace(/^\S+\s/, "") + " tuyos");
            listas[k] = ul;
            panel.append(botones, etF, filtro, ul);
            if (k === "rasgos") {
                // Los del SRD (rasgos de clase y especie, dotes y
                // habilidades), para leerlos aquí mismo.
                const srdCaja = crear("details", "master-creador-srd");
                const resumen = crear("summary", "", "📖 los del SRD");
                const etS = crear("label", "oc-dados-etiqueta", "buscar entre los del SRD");
                const buscaS = crear("input", "oc-dados-texto");
                buscaS.type = "search";
                buscaS.id = uid + "-srd-" + k;
                etS.htmlFor = buscaS.id;
                const ulS = crear("ul", "master-conjuros");
                ulS.setAttribute("aria-label", "Rasgos, dotes y habilidades del SRD");
                const pintarS = () => {
                    const q = llano(buscaS.value.trim());
                    const salen = srd.rasgos.filter((r) => !q || llano(r.nombre + " " + r.en + " " + r.de + " " + r.tipo).includes(q));
                    ulS.replaceChildren(...salen.slice(0, 120).map((r) => {
                        const li = crear("li");
                        const b = botonDe("master-conjuro", "", () => abrirRasgo(r, b, ""));
                        b.setAttribute("aria-haspopup", "dialog");
                        b.append(crear("span", "master-conjuro-nombre", r.nombre), crear("span", "master-conjuro-datos",
                            datosRasgo(r).join(" · ")));
                        li.appendChild(b);
                        return li;
                    }));
                    resumen.textContent = "📖 los del SRD (" + srd.rasgos.length + ")" + (q ? " · " + salen.length + " con eso" : "");
                };
                buscaS.addEventListener("input", pintarS);
                cargado.then(pintarS);
                srdCaja.append(resumen, etS, buscaS, ulS);
                panel.appendChild(srdCaja);
            }
            return [titulo, panel];
        });
        // La primera pestaña: cómo añadir cosas (el tutorial).
        paneles.unshift(["❓ cómo añadir", panelTutorial()]);
        const elegido = Math.min(d.pestana || 0, paneles.length - 1);
        const { lista: pestanas, elegir } = pestanasDe(paneles, "Qué crear", uid, (i) => {
            d.pestana = i;
            guardar();
        });
        vista.append(nota, barra, pestanas, ...paneles.map(([, x]) => x));
        const editor = crear("form", "master-creador-form");
        editor.hidden = true;
        dentro.append(vista, editor);

        function panelTutorial() {
            const panel = crear("div", "master-creador-panel master-guia");
            const paso = (n, titulo, ...cosas) => {
                const sec = crear("section", "master-guia-paso");
                const h = crear("h3", "master-guia-titulo");
                h.append(crear("span", "master-guia-numero", String(n)), document.createTextNode(titulo));
                sec.append(h, ...cosas);
                panel.appendChild(sec);
            };
            const p = (html) => {
                const x = crear("p");
                x.innerHTML = sanearHtml(html);
                return x;
            };
            const ir = (i, texto) => botonDe("oc-vida-accion", texto, () => elegir(i, true));
            panel.appendChild(p("Aquí amplías los compendios con lo tuyo: monstruos, objetos, conjuros y más cosas (especies,"
                + " dotes, trasfondos…), inventados o pasados de tus libros. Después salen en toda la app como los del SRD."));
            const irA = crear("div", "master-creador-barra");
            irA.append(ir(1, "🐉 monstruos"), ir(2, "💰 objetos"), ir(3, "✨ conjuros"), ir(4, "📜 más cosas"));
            paso(1, "Elige qué quieres añadir", p("Cada tipo tiene su pestaña aquí arriba, con la lista de lo que ya has añadido."),
                irA);
            const guia = botonDe("oc-vida-accion", "❓ cómo pegar desde D&D Beyond", () => abrirGuiaPegar(guia));
            guia.setAttribute("aria-haspopup", "dialog");
            paso(2, "Añádelo de una de estas tres formas", p("<strong>＋ nuevo</strong>: rellenas el formulario desde cero.<br>"
                + "<strong>⧉ copiar</strong> (partir de uno del SRD): una copia para hacer tu versión, con otros números o"
                + " ataques.<br><strong>📋 pegar un bloque</strong>: pegas el bloque copiado de D&D Beyond o de un PDF y el"
                + " formulario se rellena solo."), guia);
            paso(3, "Repásalo y guarda", p("En el formulario, mira sobre todo el tipo, el tamaño y el VD (los encuentros los"
                + " usan), pon <strong>de dónde sale</strong> y pulsa <strong>✓ guardar</strong>. Si algo viene en inglés,"
                + " <strong>🌐 traducir términos</strong> pasa al español los de reglas (daños, estados, «Melee Attack Roll»…)."),
                img2("imagenes/guia/formulario.webp", "El formulario de un monstruo relleno."));
            paso(4, "Muchos a la vez: importar", p("Baja la <strong>📄 plantilla</strong> (un ejemplo de cada), rellénala y"
                + " cárgala con <strong>⬆ importar .json</strong>: una ventana te dice qué ha entrado y qué no."
                + " <strong>⬇ exportar</strong> guarda todo lo tuyo en un archivo, para tener copia o pasárselo a otro máster."));
            paso(5, "Dónde sale", p("En el bestiario, los encuentros, la tienda y los negocios, el botín, los conjuros, la party"
                + " y el buscador, con «🛠️ tuyo». Los ataques, en su tabla con los dados."),
                img2("imagenes/guia/resultado.webp", "Un monstruo añadido, en su ventana con la tabla de ataques."));
            paso(6, "Sólo en este dispositivo", p("Lo que añades se queda aquí: no se sube a ningún sitio. Los mismos en todas tus"
                + " campañas."));
            return panel;
        }
        function img2(src, alt) {
            const i = crear("img", "master-guia-imagen");
            i.src = src;
            i.alt = alt;
            i.loading = "lazy";
            return i;
        }

        function detalleDe(k, x) {
            if (k === "monstruos") {
                return "VD " + x.cr + " · " + x.tipo;
            }
            if (k === "objetos") {
                return x.cat + (x.rareza ? " · " + x.rareza : "");
            }
            if (k === "conjuros") {
                return nivelDe(x) + " · " + x.escuela;
            }
            if (k === "rasgos") {
                return datosRasgo(x).join(" · ");
            }
            return x.cat;
        }
        function abrirUno(k, x, vuelta) {
            pedir(RUTA_DE[k] || "datos/personajes/compendio/tienda.json").then((datos) => {
                if (k === "monstruos") {
                    abrirBicho(x, vuelta, datos.fuente);
                } else if (k === "objetos") {
                    abrirObjeto(x, vuelta, datos.fuente);
                } else if (k === "conjuros") {
                    abrirConjuro(x, vuelta, datos.fuente);
                } else if (k === "rasgos") {
                    abrirRasgo(x, vuelta, datos.fuente);
                } else {
                    abrirOtro(x, vuelta);
                }
            }).catch(() => (k === "otros" ? abrirOtro(x, vuelta) : avisar("No he podido cargarlo.")));
        }
        function pintarLista(k) {
            const ul = listas[k];
            const q = llano(filtros[k].value.trim());
            const todos = leerPropios()[k].slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
            const salen = todos.filter((x) => !q || llano(x.nombre + " " + x.en + " " + (x.libro || "")).includes(q));
            ul.replaceChildren(...salen.map((x) => {
                const li = crear("li", "master-creador-fila");
                const ver = botonDe("master-creador-ver", "", () => abrirUno(k, x, ver));
                ver.dataset.id = x.id;
                ver.setAttribute("aria-haspopup", "dialog");
                ver.append(crear("span", "master-creador-nombre", x.nombre), crear("span", "master-creador-detalle",
                    detalleDe(k, x) + (x.libro ? " · " + x.libro : "")));
                const cambiar = botonDe("master-docs-mando", "✎", () => editar(k, x), "Cambiar " + x.nombre);
                const duplicar = botonDe("master-docs-mando", "⧉", () => {
                    const y = JSON.parse(JSON.stringify(x));
                    delete y.id;
                    y.nombre = x.nombre + " (copia)";
                    y.en = x.en + " (copia)";
                    editar(k, y, true);
                }, "Hacer una copia de " + x.nombre);
                let seguro = false;
                const quitar = botonDe("master-docs-mando", "✕", () => {
                    if (!seguro) {
                        seguro = true;
                        quitar.classList.add("es-seguro");
                        avisar("Pulsa otra vez para quitar " + x.nombre + ".");
                        return;
                    }
                    const p = leerPropios();
                    p[k] = p[k].filter((y) => y.id !== x.id);
                    guardarPropios(p);
                    pintarLista(k);
                    avisar("Quitado: " + x.nombre + ".");
                    filtros[k].focus();
                }, "Quitar " + x.nombre);
                li.append(ver, cambiar, duplicar, quitar);
                return li;
            }));
            if (!salen.length) {
                ul.appendChild(crear("li", "oc-vacio", todos.length ? "Nada con eso." : "Aún no hay. Crea uno, copia uno del SRD"
                    + " o importa un .json."));
            }
        }
        function pintarListas() {
            TIPOS.forEach(([k]) => pintarLista(k));
        }

        // EL FORMULARIO (crear o cambiar).
        let n = 0;
        function campo(caja, etiqueta, valor, op) {
            const o = op || {};
            n += 1;
            const id = uid + "-c" + n;
            const et = crear("label", "oc-dados-etiqueta", etiqueta);
            et.htmlFor = id;
            let x;
            if (o.opciones) {
                x = crear("select", "master-elegir");
                const lista = o.opciones.slice();
                if (valor && !lista.includes(valor)) {
                    lista.push(valor);
                }
                lista.forEach((v) => {
                    const op2 = crear("option", "", Array.isArray(v) ? v[1] : v || "—");
                    op2.value = Array.isArray(v) ? v[0] : v;
                    x.appendChild(op2);
                });
                x.value = valor === undefined ? "" : String(valor);
            } else if (o.filas) {
                x = crear("textarea", "oc-dados-texto master-creador-area");
                x.rows = o.filas;
                x.value = valor || "";
            } else {
                x = crear("input", "oc-dados-texto");
                x.type = o.tipo || "text";
                if (o.tipo === "number") {
                    x.min = o.min === undefined ? 0 : o.min;
                    x.max = o.max === undefined ? 99999 : o.max;
                    x.step = o.paso || 1;
                }
                x.value = valor === undefined || valor === null ? "" : String(valor);
                x.autocomplete = "off";
                if (o.lista) {
                    const dl = crear("datalist");
                    dl.id = id + "-l";
                    o.lista.forEach((v) => {
                        const op2 = crear("option");
                        op2.value = v;
                        dl.appendChild(op2);
                    });
                    x.setAttribute("list", dl.id);
                    caja.appendChild(dl);
                }
            }
            x.id = id;
            if (o.ayuda) {
                x.placeholder = o.ayuda;
            }
            if (o.obligatorio) {
                x.required = true;
                x.setAttribute("aria-required", "true");
            }
            const div = crear("div", "master-creador-campo" + (o.ancho ? " es-ancho" : ""));
            div.append(et, x);
            caja.appendChild(div);
            return x;
        }
        function grupo(titulo) {
            const fs = crear("fieldset", "master-creador-grupo");
            fs.appendChild(crear("legend", "", titulo));
            const rejilla = crear("div", "master-creador-rejilla");
            fs.appendChild(rejilla);
            editor.appendChild(fs);
            return rejilla;
        }
        function marcasDe(titulo, opciones, marcadas) {
            const fs = crear("fieldset", "master-creador-grupo");
            fs.appendChild(crear("legend", "", titulo));
            const caja = crear("div", "master-creador-casillas");
            const cajas = opciones.map((v) => {
                const et = crear("label", "master-creador-check");
                const c = crear("input");
                c.type = "checkbox";
                c.value = v;
                c.checked = (marcadas || []).includes(v);
                et.append(c, " " + v);
                caja.appendChild(et);
                return c;
            });
            fs.appendChild(caja);
            editor.appendChild(fs);
            return () => cajas.filter((c) => c.checked).map((c) => c.value);
        }
        // Una lista de entradas (rasgos, acciones…): nombre y texto, con
        // ＋ y ✕.
        function entradas(titulo, lista, conAtaque) {
            const fs = crear("fieldset", "master-creador-grupo");
            fs.appendChild(crear("legend", "", titulo));
            const ul = crear("ol", "master-creador-entradas");
            const filas = [];
            const fila = (r, foco) => {
                const li = crear("li", "master-creador-entrada");
                const nom = campo(li, "nombre", r.n);
                const tex = campo(li, "texto", r.t, { filas: 3, ancho: true });
                const quitar = botonDe("master-docs-mando", "✕", () => {
                    filas.splice(filas.indexOf(x), 1);
                    li.remove();
                    mas.focus();
                    avisar("Quitado de " + titulo.toLowerCase() + ".");
                }, "Quitar esta entrada de " + titulo.toLowerCase());
                li.appendChild(quitar);
                const x = { nom, tex };
                filas.push(x);
                ul.appendChild(li);
                if (foco) {
                    nom.focus();
                }
            };
            (lista || []).forEach((r) => fila(r));
            const botones = crear("div", "master-creador-barra");
            const mas = botonDe("oc-vida-accion", "＋ añadir", () => fila({ n: "", t: "" }, true), "Añadir a " + titulo.toLowerCase());
            botones.appendChild(mas);
            if (conAtaque) {
                botones.appendChild(botonDe("oc-vida-accion", "＋ ataque", () => fila({ n: "Ataque",
                    t: "*Ataque cuerpo a cuerpo:* +4, alcance 5 ft. *Impacto:* 5 (1d6 + 2) de daño cortante." }, true),
                "Añadir un ataque (con el formato que sale en tabla)"));
                botones.appendChild(botonDe("oc-vida-accion", "＋ salvación", () => fila({ n: "Aliento",
                    t: "*Tirada de salvación de Destreza:* CD 13, cada criatura en un cono de 15 ft. *Fallo:* 14 (4d6) de daño de fuego. *Éxito:* la mitad del daño." }, true),
                "Añadir un efecto con tirada de salvación"));
            }
            fs.append(ul, botones);
            editor.appendChild(fs);
            return () => filas.map((x) => ({ n: x.nom.value.trim(), t: x.tex.value.trim() })).filter((r) => r.n || r.t);
        }
        let volverA = null;
        // Pegar un bloque y, con lo que se entienda, el formulario relleno.
        function abrirPegar(k, vuelta) {
            const cuerpo = crear("form", "master-pegar");
            const et = crear("label", "oc-dados-etiqueta", "pega aquí el bloque");
            const area = crear("textarea", "oc-dados-texto master-pegar-area");
            area.id = uid + "-pegar";
            area.rows = 14;
            area.placeholder = k === "monstruos" ? "Goblin Warrior\nSmall Fey (Goblinoid), Chaotic Neutral\nAC 15  Initiative +2…"
                : k === "conjuros" ? "Fireball\nLevel 3 Evocation (Sorcerer, Wizard)\nCasting Time: Action…"
                    : "Bag of Holding\nWondrous Item, Uncommon\nThis bag has…";
            et.htmlFor = area.id;
            const nota = crear("p", "oc-hoja-nota", conTraducir.checked ? "🌐 Los términos de reglas en inglés se pasan al español."
                : "Tal cual (sin traducir: está desmarcado «🌐 traducir»).");
            const ok = crear("button", "oc-vida-accion es-principal", "✓ rellenar");
            ok.type = "submit";
            const guia = botonDe("oc-vida-accion", "❓ cómo", () => abrirGuiaPegar(guia), "Cómo pegar desde D&D Beyond (guía)");
            const fila = crear("div", "master-creador-barra");
            fila.append(ok, guia);
            cuerpo.append(et, area, nota, fila);
            cuerpo.addEventListener("submit", (e) => {
                e.preventDefault();
                if (!area.value.trim()) {
                    avisar("Pega primero el bloque.");
                    area.focus();
                    return;
                }
                let x = k === "monstruos" ? leerBloqueMonstruo(area.value) : k === "conjuros" ? leerBloqueConjuro(area.value)
                    : leerBloqueObjeto(area.value);
                if (conTraducir.checked) {
                    x = traducirPropio(k, x);
                }
                cerrarPegar();
                editar(k, x, true);
                avisar("Relleno con lo pegado: repásalo y guarda.");
            });
            const cerrarPegar = window.ocVentana.abrir({ titulo: "pegar un bloque", cuerpo, vuelta, foco: area });
        }

        function editar(k, x, esNuevo) {
            volverA = document.activeElement;
            const actual = x && !esNuevo ? x : null;
            const v = x || {};
            n = 0;
            editor.replaceChildren();
            const uno = TIPOS.find((t) => t[0] === k)[2];
            editor.appendChild(crear("h3", "master-creador-titulo", actual ? "✎ " + actual.nombre : "＋ " + (k === "otros" ? "cosa nueva"
                : uno + " nuevo")));
            const base = grupo("Lo básico");
            const nombre = campo(base, "nombre (en español)", v.nombre, { obligatorio: true });
            const en = k === "otros" ? null : campo(base, "nombre original", v.en === v.nombre ? "" : v.en, { ayuda: "opcional" });
            const libro = campo(base, "de dónde sale", v.libro, { ayuda: "Monster Manual 2025, p. 12 · inventado…" });
            const leer = { comun: () => ({ nombre: nombre.value, en: (en && en.value.trim()) || nombre.value, libro: libro.value }) };
            if (k === "monstruos") {
                const t = /^(.+?)(?: \(([^)]*)\))? ((?:Diminuto|Pequeño|Mediano|Grande|Enorme|Gargantuesco)(?: o \S+)?)$/
                    .exec(v.tipo || "") || [];
                const tipo = campo(base, "tipo", t[1] || (v.tipo ? v.tipo : "Monstruosidad"), { opciones: PROPIO_TIPOS });
                const etiqueta = campo(base, "etiqueta", t[2] || "", { ayuda: "opcional: goblinoide…" });
                const tam = campo(base, "tamaño", t[3] || (v.tipo ? "" : "Mediano"), { opciones: PROPIO_TAMANOS });
                const alin = campo(base, "alineamiento", v.alin || "neutral", { opciones: PROPIO_ALIN });
                const cr = campo(base, "VD", v.cr || "1", { opciones: CR_LISTA });
                const comb = grupo("Combate");
                const ca = campo(comb, "CA", v.ca, { ayuda: "15 (cota de mallas)" });
                const pg = campo(comb, "PG", v.pg, { tipo: "number", min: 1 });
                const pgf = campo(comb, "dados de PG", v.pgf, { ayuda: "4d8 + 4" });
                const ini = campo(comb, "iniciativa", v.ini, { ayuda: "vacío: la de su Destreza" });
                const vel = campo(comb, "velocidad", v.vel, { ayuda: "30 ft., vuelo 60 ft.", ancho: true });
                const ca2 = grupo("Características");
                const car = {};
                ["Fue", "Des", "Con", "Int", "Sab", "Car"].forEach((c) => {
                    car[c] = campo(ca2, c, (v.car || {})[c] || 10, { tipo: "number", min: 1, max: 30 });
                });
                const mas = grupo("Más datos");
                const otros = {};
                [["salv", "salvaciones", "Des +5, Sab +3"], ["hab", "habilidades", "Percepción +4, Sigilo +6"],
                    ["vuln", "vulnerabilidades", "fuego"], ["res", "resistencias", "frío; contundente"],
                    ["inm", "inmunidades al daño", "veneno"], ["inmE", "inmunidades a estados", "envenenado, asustado"],
                    ["sent", "sentidos", "visión en la oscuridad 60 ft.; Percepción pasiva 12"], ["idio", "idiomas", "común, dracónico"],
                    ["equipo", "equipo", "espada larga, escudo"]].forEach(([c, et, ayuda]) => {
                    otros[c] = campo(mas, et, v[c], { ayuda, ancho: true });
                });
                const habitat = marcasDe("Hábitat (para los encuentros)", PROPIO_HABITATS, v.habitat);
                const secc = {};
                SECCIONES_BICHO.forEach(([c, titulo]) => {
                    secc[c] = entradas(titulo, v[c], c === "acciones" || c === "adicionales" || c === "legendarias");
                });
                const legInfo = campo(grupo("Uso de las legendarias (si tiene)"), "cómo se usan", v.legInfo, { filas: 2, ancho: true,
                    ayuda: "*Usos de acción legendaria:* 3. Justo después del turno de otra criatura, puede gastar un uso…" });
                leer.resto = () => {
                    const o = { tipo: tipo.value + (etiqueta.value.trim() ? " (" + etiqueta.value.trim() + ")" : "") + " " + tam.value,
                        alin: alin.value, cr: cr.value, vd: v.cr === cr.value ? v.vd : "", ca: ca.value, pg: pg.value, pgf: pgf.value,
                        ini: ini.value, vel: vel.value, car: {}, habitat: habitat(), legInfo: legInfo.value };
                    Object.keys(car).forEach((c) => {
                        o.car[c] = car[c].value;
                    });
                    Object.keys(otros).forEach((c) => {
                        o[c] = otros[c].value;
                    });
                    Object.keys(secc).forEach((c) => {
                        o[c] = secc[c]();
                    });
                    return o;
                };
            } else if (k === "objetos") {
                const cat = campo(base, "categoría", v.cat || "objeto maravilloso", { lista: PROPIO_CATS });
                const rareza = campo(base, "rareza", v.rareza || "", { opciones: [["", "— (no mágico)"]].concat(PROPIO_RAREZAS) });
                const precio = campo(base, "precio (po)", v.cp ? v.cp / 100 : "", { tipo: "number", paso: "any" });
                const peso = campo(base, "peso", v.peso, { ayuda: "2 lb." });
                const det = campo(base, "detalles", v.det, { ayuda: "1d8 cortante, versátil…", ancho: true });
                const nota2 = campo(base, "nota", v.nota, { ancho: true });
                const etS = crear("label", "master-creador-check");
                const sint = crear("input");
                sint.type = "checkbox";
                sint.checked = !!v.sint;
                etS.append(sint, " requiere sintonía");
                base.appendChild(etS);
                const tiendas = marcasDe("Se vende en (para la tienda y los negocios)", PROPIO_TIENDAS, v.tiendas);
                const texto = campo(grupo("Qué hace"), "texto", v.texto, { filas: 8, ancho: true,
                    ayuda: "Admite *cursiva* y **negrita**; los conjuros en cursiva se enlazan." });
                leer.resto = () => ({ cat: cat.value, rareza: rareza.value, cp: Math.round((Number(precio.value) || 0) * 100),
                    peso: peso.value, det: det.value, nota: nota2.value, sint: sint.checked, tiendas: tiendas(), texto: texto.value });
            } else if (k === "conjuros") {
                const nivel = campo(base, "nivel", v.nivel === undefined ? 1 : v.nivel, { opciones: [["0", "truco"]]
                    .concat(Array.from({ length: 9 }, (x2, i) => [String(i + 1), "nivel " + (i + 1)])) });
                const escuela = campo(base, "escuela", v.escuela || "Evocación", { opciones: PROPIO_ESCUELAS });
                const tiempo = campo(base, "lanzamiento", v.tiempo, { ayuda: "1 acción" });
                const alcance = campo(base, "alcance", v.alcance, { ayuda: "60 ft." });
                const comp = campo(base, "componentes", v.comp, { ayuda: "V, S, M (una pluma)" });
                const dur = campo(base, "duración", v.dur, { ayuda: "Concentración, hasta 1 minuto" });
                const marcas = crear("div", "master-creador-barra");
                const caja = (texto, valor) => {
                    const et = crear("label", "master-creador-check");
                    const c = crear("input");
                    c.type = "checkbox";
                    c.checked = !!valor;
                    et.append(c, " " + texto);
                    marcas.appendChild(et);
                    return c;
                };
                const ritual = caja("ritual", v.ritual);
                const conc = caja("concentración", v.conc);
                base.appendChild(marcas);
                const otrasClases = (v.clases || []).filter((c) => !PROPIO_CLASES.includes(c));
                const clases = marcasDe("Clases", PROPIO_CLASES, v.clases);
                const mas = campo(grupo("Otras clases o subclases"), "separadas por comas", otrasClases.join(", "), { ancho: true });
                const tx = grupo("Qué hace");
                const texto = campo(tx, "texto", v.texto, { filas: 8, ancho: true });
                const superior = campo(tx, "a nivel superior / mejora del truco", v.superior, { filas: 2, ancho: true });
                leer.resto = () => ({ nivel: nivel.value, escuela: escuela.value, tiempo: tiempo.value, alcance: alcance.value,
                    comp: comp.value, dur: dur.value, ritual: ritual.checked, conc: conc.checked,
                    clases: clases().concat(mas.value.split(",").map((c) => c.trim()).filter(Boolean)), texto: texto.value,
                    superior: superior.value });
            } else if (k === "rasgos") {
                const tipo = campo(base, "qué es", v.tipo || "dote general", { opciones: PROPIO_RASGOS.map((t) => [t, t]) });
                const de = campo(base, "de quién (clase, subclase o especie)", v.de === "dote" ? "" : v.de, { ayuda: "Pícaro (Ladrón) · Elfo" });
                const nivel = campo(base, "nivel (si es de clase)", v.nivel || "", { tipo: "number", min: 0, max: 20 });
                const texto = campo(grupo("Qué hace"), "texto", v.texto, { filas: 10, ancho: true,
                    ayuda: "Admite **negrita**, *cursiva* (los conjuros en cursiva se enlazan), listas con «- » y párrafos." });
                leer.resto = () => ({ tipo: tipo.value, de: de.value.trim() || (/dote|estilo|don/.test(tipo.value) ? "dote" : ""),
                    nivel: nivel.value, texto: texto.value });
            } else {
                const cat = campo(base, "qué es", v.cat || "dote", { lista: PROPIO_OTROS });
                const texto = campo(grupo("Texto"), "texto", v.texto, { filas: 12, ancho: true,
                    ayuda: "Admite **negrita**, *cursiva*, listas con «- » y párrafos." });
                leer.resto = () => ({ cat: cat.value, texto: texto.value });
            }
            // Los botones, abajo.
            const botones = crear("div", "master-creador-barra master-creador-final");
            const ok = crear("button", "oc-vida-accion es-principal", "✓ guardar");
            ok.type = "submit";
            const traducirB = botonDe("oc-vida-accion", "🌐 traducir términos", () => {
                editor.querySelectorAll("input[type=text], input:not([type]), textarea").forEach((c) => {
                    if (c !== nombre && c !== en && c !== libro) {
                        c.value = traducir(c.value);
                    }
                });
                if (k === "monstruos") {
                    avisar("Términos traducidos. El tipo y el tamaño, en sus desplegables.");
                } else {
                    avisar("Términos traducidos (las frases se quedan como estaban).");
                }
            }, "Traducir al español los términos de reglas en inglés de este formulario");
            const no = botonDe("oc-vida-accion", "cancelar", cerrar);
            botones.append(ok, traducirB, no);
            editor.appendChild(botones);
            editor.onsubmit = (e) => {
                e.preventDefault();
                if (!nombre.value.trim()) {
                    avisar("Ponle un nombre.");
                    nombre.focus();
                    return;
                }
                const datos = Object.assign(leer.comun(), leer.resto());
                if (actual) {
                    datos.id = actual.id;
                }
                const o = limpiarPropio(k, datos);
                if (k !== "otros") {
                    enUnico(k, o, srd[k]);
                }
                const p = leerPropios();
                const i = p[k].findIndex((y) => y.id === o.id);
                if (i >= 0) {
                    p[k][i] = o;
                } else {
                    p[k].push(o);
                }
                if (!guardarPropios(p)) {
                    avisar("No se ha podido guardar: ¿no queda sitio en el navegador?");
                    return;
                }
                cerrar(o.id);
                avisar("Guardado: " + o.nombre + ".");
            };
            editor.onkeydown = (e) => {
                if (e.key === "Escape" && e.target.tagName !== "SELECT") {
                    e.preventDefault();
                    cerrar();
                }
            };
            vista.hidden = true;
            editor.hidden = false;
            dentro.scrollTop = 0;
            nombre.focus();
        }
        function cerrar(idNuevo) {
            editor.hidden = true;
            editor.replaceChildren();
            vista.hidden = false;
            pintarListas();
            const b = idNuevo && vista.querySelector(".master-creador-ver[data-id='" + idNuevo + "']");
            if (b) {
                b.focus();
            } else if (volverA && volverA.isConnected) {
                volverA.focus();
            }
        }
        pintarListas();
        elegir(elegido, false);
        mientrasEste(dentro, "master:propios", () => {
            if (editor.hidden) {
                pintarListas();
            }
        });
    }

    // ---- EL COMPENDIO: añadir monstruos, objetos, conjuros… es una
    // pantalla aparte (el ＋ de arriba a la izquierda), encima del tablero,
    // con montarCreador() dentro y su tutorial. Lo que recuerda (la pestaña,
    // «traducir»), en «richi-master-compendio». ----
    const CLAVE_COMPENDIO = "richi-master-compendio";
    const CLAVE_RECARGA = "richi-master-recarga";
    function abrirCompendio(vuelta) {
        if (document.querySelector(".master-compendio")) {
            return;
        }
        let datos = {};
        try {
            datos = JSON.parse(localStorage.getItem(CLAVE_COMPENDIO) || "{}") || {};
        } catch (e) {
            datos = {};
        }
        const m = { id: "compendio", datos };
        const fondo = crear("div", "master-compendio");
        fondo.setAttribute("role", "dialog");
        fondo.setAttribute("aria-modal", "true");
        fondo.setAttribute("aria-labelledby", "master-compendio-titulo");
        const cabeza = crear("div", "master-compendio-cabeza");
        const titulo = crear("h2", "master-compendio-titulo", "＋ añadir al compendio");
        titulo.id = "master-compendio-titulo";
        const volver = botonDe("oc-vida-accion", "✕ volver al tablero", cerrar, "Cerrar el compendio y volver al tablero");
        volver.title = "Volver al tablero (Esc)";
        cabeza.append(titulo, volver);
        const cuerpo = crear("div", "master-compendio-cuerpo");
        fondo.append(cabeza, cuerpo);
        const principal = document.querySelector(".app-principal") || lienzo.closest("main");
        if (principal) {
            principal.inert = true;
        }
        document.body.appendChild(fondo);
        let cambiado = false;
        const alCambiar = () => {
            cambiado = true;
        };
        document.addEventListener("master:propios", alCambiar);
        montarCreador(cuerpo, m);
        function recordar() {
            try {
                localStorage.setItem(CLAVE_COMPENDIO, JSON.stringify({ pestana: m.datos.pestana || 0, traducir: m.datos.traducir }));
            } catch (e) {
                // Sin almacenamiento: no se recuerda.
            }
        }
        function cerrar() {
            recordar();
            if (principal) {
                principal.inert = false;
            }
            fondo.remove();
            document.removeEventListener("master:propios", alCambiar);
            // Al salir, la app se vuelve a cargar (como con F5), para que lo
            // nuevo salga en todas partes. Se guarda antes, y al volver no se
            // pregunta la campaña: sigue la misma.
            avisar("Recargando…");
            try {
                sessionStorage.setItem(CLAVE_RECARGA, "1");
            } catch (e) {
                // Sin sessionStorage: al volver se pregunta la campaña.
            }
            guardar();
            Promise.resolve(window.ocAlmacen && window.ocAlmacen.guardarYa ? window.ocAlmacen.guardarYa() : null)
                .catch(() => null).then(() => location.reload());
            if (cambiado && vuelta && vuelta.isConnected) {
                vuelta.focus();
            }
        }
        fondo.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !e.defaultPrevented) {
                e.preventDefault();
                cerrar();
            } else if (e.key === "Tab") {
                const cosas = Array.from(fondo.querySelectorAll("button, input, select, textarea, [href], [tabindex='0']"))
                    .filter((x) => !x.disabled && x.offsetParent);
                const i = cosas.indexOf(document.activeElement);
                if (e.shiftKey && i <= 0) {
                    e.preventDefault();
                    cosas[cosas.length - 1].focus();
                } else if (!e.shiftKey && i === cosas.length - 1) {
                    e.preventDefault();
                    cosas[0].focus();
                }
            }
        });
        fondo.addEventListener("change", recordar);
        fondo.addEventListener("click", () => setTimeout(recordar, 0));
        const tab = fondo.querySelector("[role=tab][aria-selected=true]");
        (tab || volver).focus();
        avisar("Compendio abierto. Esc para volver al tablero.");
    }

    // ---- LA PANTALLA DE JUGADORES (jugadores.html): una ventana aparte
    // para la tele, Discord u OBS con sólo lo que se elige aquí (en la
    // ventana «📺 jugadores» o con 📺 en un dibujo). Lo que se enseña va en
    // la campaña («jugadores»: modo, titulo, texto, imagen, conPg). ----
    const CANAL_JUG = "BroadcastChannel" in window ? new BroadcastChannel("pantalla-master-jugadores") : null;
    const IMAGEN_JUG = { id: "", url: "" };
    const datosJug = () => {
        todo.jugadores = todo.jugadores || {};
        const j = todo.jugadores;
        ["modo", "titulo", "texto", "imagen"].forEach((k) => {
            j[k] = j[k] || (k === "modo" ? "espera" : "");
        });
        j.conPg = !!j.conPg;
        return j;
    };
    function iniParaJugadores(conPg) {
        let ini;
        try {
            ini = JSON.parse(localStorage.getItem("richi-oc-iniciativa") || "{}");
        } catch (e) {
            ini = {};
        }
        const lista = (ini.lista || []).map((c) => {
            const pj = c.pj && (todo.pjs || []).find((x) => x.id === c.pj);
            const o = { nombre: c.nombre, color: c.color, marcas: (c.marcas || []).map((mk) => mk.t) };
            if (conPg && pj) {
                o.pg = c.pg;
                o.pgmax = numPj(pj.pgmax) || "";
            }
            return o;
        });
        return { lista, turno: ini.turno, ronda: ini.ronda || 1, combate: ini.modo === "combate" };
    }
    function contarJugadores() {
        if (!CANAL_JUG || !todo) {
            return;
        }
        const j = datosJug();
        const mandar = () => CANAL_JUG.postMessage({ t: "estado", modo: j.modo, titulo: j.titulo, texto: j.texto,
            imagen: IMAGEN_JUG.url, ini: j.modo === "iniciativa" ? iniParaJugadores(j.conPg) : null,
            tema: document.documentElement.getAttribute("data-theme") || "" });
        if (j.imagen && j.imagen !== IMAGEN_JUG.id) {
            IMAGEN_JUG.id = j.imagen;
            IMAGEN_JUG.url = "";
            imagenMusica(j.imagen).then((u) => {
                IMAGEN_JUG.url = u || "";
                mandar();
            });
            return;
        }
        if (!j.imagen) {
            IMAGEN_JUG.id = "";
            IMAGEN_JUG.url = "";
        }
        mandar();
    }
    // Cambiar lo que ven («imagen»: un Blob, que se guarda como archivo).
    function mostrarAJugadores(cambio, imagen) {
        const j = datosJug();
        const hecho = () => {
            Object.assign(j, cambio);
            guardar();
            contarJugadores();
            document.dispatchEvent(new CustomEvent("master:jugadores"));
        };
        if (imagen) {
            const id = idDoc("j");
            const viejo = j.imagen;
            return archivoGuardar(id, imagen).then(() => {
                if (viejo) {
                    archivoBorrar(viejo);
                }
                cambio.imagen = id;
                hecho();
            }).catch(() => avisar("No se ha podido guardar la imagen."));
        }
        hecho();
        return Promise.resolve();
    }
    function abrirJugadores() {
        const w = window.open("jugadores.html", "pantalla-master-jugadores", "popup,width=1100,height=720");
        if (w) {
            w.focus();
            avisar("Pantalla de jugadores abierta: llévala a la tele o compártela.");
        } else {
            avisar("El navegador no ha dejado abrir la ventana: permite las ventanas emergentes de esta página.");
        }
    }
    if (CANAL_JUG) {
        CANAL_JUG.addEventListener("message", (ev) => {
            if ((ev.data || {}).t === "hola") {
                contarJugadores();
            }
        });
        ["oc-iniciativa:guardada", "oc-iniciativa:cambio", "theme:changed"].forEach((ev) => document.addEventListener(ev, () => {
            if (ev === "theme:changed" || (todo && datosJug().modo === "iniciativa")) {
                contarJugadores();
            }
        }));
    }

    function montarJugadores(dentro, m) {
        const j = datosJug();
        const abrir = botonDe("oc-vida-accion es-principal", "🪟 abrir la pantalla de jugadores", abrirJugadores,
            "Abrir la pantalla de jugadores (una ventana aparte para la tele, Discord u OBS)");
        const ahora = crear("p", "master-jug-ahora");
        ahora.setAttribute("aria-live", "polite");
        const MODOS = [["espera", "⏸ espera"], ["imagen", "🖼️ imagen"], ["texto", "📜 texto"], ["iniciativa", "⏱️ iniciativa"]];
        const modos = crear("div", "master-musica-modos");
        modos.setAttribute("role", "group");
        modos.setAttribute("aria-label", "Qué ven los jugadores");
        const bModos = MODOS.map(([v, t]) => {
            const b = botonDe("master-musica-modo", t, () => mostrarAJugadores({ modo: v }).then(pintar));
            b.dataset.modo = v;
            modos.appendChild(b);
            return b;
        });
        const campoDe = (texto, control, id) => {
            const caja = crear("div", "master-campo");
            const et = crear("label", "oc-dados-etiqueta", texto);
            control.id = id + m.id;
            et.htmlFor = control.id;
            caja.append(et, control);
            return caja;
        };
        const tit = crear("input", "oc-dados-texto");
        tit.maxLength = 120;
        tit.autocomplete = "off";
        tit.placeholder = "La cripta olvidada";
        const txt = crear("textarea", "oc-dados-texto");
        txt.rows = 5;
        txt.placeholder = "Lo que leen (admite **negrita**, *cursiva* y listas «- »). En espera: lo que se ve en grande.";
        const poner = crear("button", "oc-vida-accion es-principal", "📺 enseñar el título y el texto");
        poner.type = "submit";
        const form = crear("form", "master-jug-form");
        form.append(campoDe("título (arriba, en grande; opcional)", tit, "master-jug-titulo-"), campoDe("texto", txt, "master-jug-texto-"),
            poner);
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            mostrarAJugadores({ titulo: tit.value.trim(), texto: txt.value, modo: j.modo === "imagen" || j.modo === "iniciativa" ? j.modo
                : txt.value.trim() ? "texto" : "espera" }).then(pintar);
            avisar("Enseñado.");
        });
        const archivo = crear("input");
        archivo.type = "file";
        archivo.accept = "image/*";
        archivo.hidden = true;
        archivo.addEventListener("change", () => {
            const f = archivo.files && archivo.files[0];
            archivo.value = "";
            if (!f || !/^image\//.test(f.type)) {
                return;
            }
            mostrarAJugadores({ modo: "imagen" }, f).then(pintar);
        });
        const elegirImg = botonDe("oc-vida-accion", "🖼️ enseñar una imagen", () => archivo.click(),
            "Enseñar una imagen de tu dispositivo a los jugadores");
        const etPg = crear("label", "master-jug-pg");
        const conPg = crear("input");
        conPg.type = "checkbox";
        conPg.checked = !!j.conPg;
        conPg.addEventListener("change", () => mostrarAJugadores({ conPg: conPg.checked }));
        etPg.append(conPg, document.createTextNode(" en la iniciativa, los PG de la party (nunca los de los monstruos)"));
        const botones = crear("div", "master-creador-barra");
        botones.append(elegirImg, archivo);
        function pintar() {
            bModos.forEach((b) => b.setAttribute("aria-pressed", b.dataset.modo === j.modo ? "true" : "false"));
            const t = (MODOS.find((x) => x[0] === j.modo) || MODOS[0])[1];
            ahora.textContent = "Ahora ven: " + t + (j.titulo ? " · «" + j.titulo + "»" : "") + (j.modo === "imagen" && !j.imagen
                ? " (todavía no hay imagen: elige una o usa 📺 en un dibujo)" : "");
            if (document.activeElement !== tit) {
                tit.value = j.titulo || "";
            }
            if (document.activeElement !== txt) {
                txt.value = j.texto || "";
            }
        }
        dentro.replaceChildren(abrir, ahora, modos, botones, form, etPg, crear("p", "oc-hoja-nota", "Lo que elijas aquí es lo único"
            + " que se ve en esa ventana: cambia de tablero tranquilamente. En un 🎨 dibujo, 📺 lo manda tal cual (sin las capas"
            + " escondidas)."));
        pintar();
        mientrasEste(dentro, "master:jugadores", pintar);
    }

    // ---- TABLAS ALEATORIAS PROPIAS: una entrada por línea («3× » delante
    // para que salga más; «{2d6}» dentro se tira al salir). Para todas las
    // campañas («richi-master-tablas»). ----
    const CLAVE_TABLAS = "richi-master-tablas";
    const leerTablas = () => {
        try {
            const x = JSON.parse(localStorage.getItem(CLAVE_TABLAS) || "[]");
            return Array.isArray(x) ? x : [];
        } catch (e) {
            return [];
        }
    };
    const guardarTablas = (x) => {
        try {
            localStorage.setItem(CLAVE_TABLAS, JSON.stringify(x));
        } catch (e) {
            avisar("No se ha podido guardar la tabla.");
        }
        document.dispatchEvent(new CustomEvent("master:tablas"));
    };
    const entradasDe = (t) => String(t.texto || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const m = /^(\d+)\s*[×x]\s+(.*)$/i.exec(l);
        return m ? { peso: Math.max(1, Math.min(100, parseInt(m[1], 10))), t: m[2] } : { peso: 1, t: l };
    });
    function tirarTabla(t) {
        const es = entradasDe(t);
        const total = es.reduce((a, e) => a + e.peso, 0);
        if (!total) {
            return null;
        }
        const r = window.ocDados ? window.ocDados.tirar("1d" + total, t.nombre) : null;
        let n = r ? r.total : 1 + Math.floor(Math.random() * total);
        const e = es.find((x) => {
            n -= x.peso;
            return n <= 0;
        }) || es[es.length - 1];
        // Los dados de dentro: «{2d6}», «{1d4+1}».
        const texto = e.t.replace(/\{(\d*d\d+(?:[+-]\d+)?)\}/gi, (x, f) => String(tiradaSuelta(f.toLowerCase().startsWith("d") ? "1" + f : f)));
        return { texto, n: r ? r.total : null, de: total };
    }
    function montarTablas(dentro, m) {
        const d = m.datos = m.datos || {};
        d.hist = Array.isArray(d.hist) ? d.hist : [];
        const sel = crear("select", "oc-dados-elegir");
        sel.id = "master-tablas-" + m.id;
        const etSel = crear("label", "oc-dados-etiqueta", "tabla");
        etSel.htmlFor = sel.id;
        const tirar = crear("button", "oc-vida-accion es-principal", "🎲 tirar");
        tirar.type = "submit";
        const fila = crear("form", "master-tablas-fila");
        fila.append(etSel, sel, tirar);
        const sale = crear("p", "master-tablas-sale");
        sale.setAttribute("aria-live", "polite");
        const hist = crear("ol", "master-tablas-hist");
        hist.setAttribute("aria-label", "Lo que ha salido antes");
        const nueva = botonDe("oc-vida-accion", "＋ tabla nueva", () => editar(null), "Crear una tabla nueva");
        const editarB = botonDe("oc-vida-accion", "✎ editar", () => editar(leerTablas().find((t) => t.id === sel.value)), "Editar la tabla elegida");
        const quitar = botonDe("oc-vida-accion", "🗑️ quitar", () => {
            const t = leerTablas().find((x) => x.id === sel.value);
            if (!t) {
                return;
            }
            if (quitar.dataset.seguro !== "1") {
                quitar.dataset.seguro = "1";
                quitar.textContent = "🗑️ ¿seguro? pulsa otra vez";
                return;
            }
            delete quitar.dataset.seguro;
            quitar.textContent = "🗑️ quitar";
            guardarTablas(leerTablas().filter((x) => x.id !== t.id));
            avisar("Quitada la tabla «" + t.nombre + "».");
        }, "Quitar la tabla elegida");
        const botones = crear("div", "master-creador-barra");
        botones.append(nueva, editarB, quitar);
        const form = crear("form", "master-tablas-editar");
        form.hidden = true;
        function editar(t) {
            const nombre = crear("input", "oc-dados-texto");
            nombre.id = "master-tablas-nombre-" + m.id;
            nombre.maxLength = 80;
            nombre.value = t ? t.nombre : "";
            nombre.placeholder = "Rumores de la taberna";
            const etN = crear("label", "oc-dados-etiqueta", "nombre");
            etN.htmlFor = nombre.id;
            const texto = crear("textarea", "oc-dados-texto");
            texto.id = "master-tablas-texto-" + m.id;
            texto.rows = 8;
            texto.value = t ? t.texto : "";
            texto.placeholder = "El molinero esconde algo.\n2× Han visto lobos en el camino del norte.\nUn mercader paga {2d6} po por noticias.";
            const etT = crear("label", "oc-dados-etiqueta", "una entrada por línea («3× » delante: sale más; «{2d6}»: se tira)");
            etT.htmlFor = texto.id;
            const ok = crear("button", "oc-vida-accion es-principal", "✓ guardar");
            ok.type = "submit";
            const no = botonDe("oc-vida-accion", "cancelar", () => {
                form.hidden = true;
                (t ? editarB : nueva).focus();
            });
            const barra = crear("div", "master-creador-barra");
            barra.append(ok, no);
            form.replaceChildren(etN, nombre, etT, texto, barra);
            form.onsubmit = (e) => {
                e.preventDefault();
                const n = nombre.value.trim();
                if (!n || !entradasDe({ texto: texto.value }).length) {
                    avisar("Ponle nombre y al menos una entrada.");
                    (n ? texto : nombre).focus();
                    return;
                }
                const todas = leerTablas();
                const id = t ? t.id : idDoc("t");
                const x = { id, nombre: n, texto: texto.value };
                const i = todas.findIndex((y) => y.id === id);
                if (i >= 0) {
                    todas[i] = x;
                } else {
                    todas.push(x);
                }
                d.tabla = id;
                guardar();
                form.hidden = true;
                guardarTablas(todas);
                avisar("Tabla guardada: " + n + " (" + entradasDe(x).length + " entradas).");
                tirar.focus();
            };
            form.hidden = false;
            nombre.focus();
        }
        fila.addEventListener("submit", (e) => {
            e.preventDefault();
            const t = leerTablas().find((x) => x.id === sel.value);
            if (!t) {
                avisar("Primero crea una tabla.");
                return;
            }
            const r = tirarTabla(t);
            if (!r) {
                return;
            }
            d.tabla = t.id;
            d.hist.unshift((r.n ? r.n + "/" + r.de + " · " : "") + t.nombre + ": " + r.texto);
            d.hist = d.hist.slice(0, 12);
            guardar();
            pintarHist();
            sale.replaceChildren(crear("span", "master-tablas-de", t.nombre + (r.n ? " (" + r.n + " de " + r.de + ")" : "")),
                crear("strong", "", r.texto));
        });
        const pintarHist = () => {
            hist.replaceChildren(...d.hist.slice(1).map((h) => crear("li", "", h)));
            hist.hidden = d.hist.length < 2;
        };
        function pintar() {
            const ts = leerTablas();
            sel.replaceChildren(...ts.map((t) => {
                const o = crear("option", "", t.nombre + " (" + entradasDe(t).length + ")");
                o.value = t.id;
                return o;
            }));
            if (ts.some((t) => t.id === d.tabla)) {
                sel.value = d.tabla;
            }
            fila.hidden = !ts.length;
            editarB.hidden = !ts.length;
            quitar.hidden = !ts.length;
            if (!ts.length) {
                sale.textContent = "Todavía no tienes tablas: crea una (rumores, clima, encuentros de una zona…).";
            }
        }
        dentro.replaceChildren(fila, sale, hist, botones, form);
        pintar();
        pintarHist();
        mientrasEste(dentro, "master:tablas", pintar);
    }

    // ---- LA LÍNEA TEMPORAL de la campaña: lo que pasa (sesiones y
    // sucesos) en orden, con cuándo (a mano o la fecha del calendario). ----
    function fechaDelCalendario() {
        for (const pf of todo.perfiles) {
            const c = pf.modulos.find((x) => x.tipo === "calendario" && x.datos && x.datos.textoHoy);
            if (c) {
                return c.datos.textoHoy;
            }
        }
        return "";
    }
    function montarLinea(dentro, m) {
        todo.linea = Array.isArray(todo.linea) ? todo.linea : [];
        const form = crear("form", "master-linea-form");
        const campoDe = (texto, control, id) => {
            const caja = crear("div", "master-campo");
            const et = crear("label", "oc-dados-etiqueta", texto);
            control.id = id + m.id;
            et.htmlFor = control.id;
            caja.append(et, control);
            return caja;
        };
        const cuando = crear("input", "oc-dados-texto");
        cuando.maxLength = 80;
        cuando.placeholder = "Sesión 4 · 3 de Mirtul de 1492";
        const hoy = botonDe("oc-vida-accion", "📅 la del calendario", () => {
            const f = fechaDelCalendario();
            if (f) {
                cuando.value = f;
            } else {
                avisar("No hay ningún calendario con fecha en los tableros.");
            }
        }, "Poner la fecha de la partida del calendario");
        const titulo = crear("input", "oc-dados-texto");
        titulo.maxLength = 120;
        titulo.placeholder = "Llegan a Phandalin";
        const texto = crear("textarea", "oc-dados-texto");
        texto.rows = 3;
        texto.placeholder = "Qué pasó (opcional)";
        const sesion = crear("label", "master-linea-sesion");
        const sesionC = crear("input");
        sesionC.type = "checkbox";
        sesion.append(sesionC, document.createTextNode(" es una sesión (resumen de la partida)"));
        const ok = crear("button", "oc-vida-accion es-principal", "＋ apuntar");
        ok.type = "submit";
        const filaC = crear("div", "master-linea-cuando");
        filaC.append(campoDe("cuándo", cuando, "master-linea-cuando-"), hoy);
        form.append(filaC, campoDe("qué", titulo, "master-linea-titulo-"), campoDe("detalles", texto, "master-linea-texto-"), sesion, ok);
        let editando = null;
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!titulo.value.trim()) {
                avisar("Ponle qué pasó.");
                titulo.focus();
                return;
            }
            const x = { id: editando ? editando.id : idDoc("l"), cuando: cuando.value.trim(), titulo: titulo.value.trim(),
                texto: texto.value.trim(), sesion: sesionC.checked };
            if (editando) {
                Object.assign(editando, x);
            } else {
                todo.linea.push(x);
            }
            editando = null;
            ok.textContent = "＋ apuntar";
            titulo.value = "";
            texto.value = "";
            sesionC.checked = false;
            guardar();
            pintar();
            avisar("Apuntado: " + x.titulo + ".");
            titulo.focus();
        });
        const buscar = crear("input", "oc-dados-texto");
        buscar.type = "search";
        buscar.placeholder = "buscar en la línea…";
        buscar.addEventListener("input", () => pintar());
        const copiar = botonDe("oc-vida-accion", "⧉ copiar como texto", () => copiarTexto(todo.linea.map((x) => "- " + (x.cuando ? "**"
            + x.cuando + "** · " : "") + (x.sesion ? "🎲 " : "") + x.titulo + (x.texto ? ": " + x.texto.replace(/\n+/g, " ") : ""))
            .join("\n"), "Copiada la línea temporal."), "Copiar la línea temporal como texto");
        const ol = crear("ol", "master-linea");
        ol.setAttribute("aria-label", "Línea temporal");
        function pintar() {
            const q = llano(buscar.value.trim());
            const ver = todo.linea.filter((x) => !q || llano(x.cuando + " " + x.titulo + " " + x.texto).includes(q));
            ol.replaceChildren(...ver.map((x) => {
                const i = todo.linea.indexOf(x);
                const li = crear("li", "master-linea-paso" + (x.sesion ? " es-sesion" : ""));
                const cab = crear("p", "master-linea-cab");
                if (x.cuando) {
                    cab.appendChild(crear("span", "master-linea-cuandoes", x.cuando));
                }
                cab.appendChild(crear("strong", "", (x.sesion ? "🎲 " : "") + x.titulo));
                li.appendChild(cab);
                if (x.texto) {
                    li.appendChild(markdown(x.texto));
                }
                const mandos = crear("div", "master-linea-mandos");
                mandos.append(botonDe("master-docs-mando", "↑", () => mover(i, -1), "Subir: " + x.titulo),
                    botonDe("master-docs-mando", "↓", () => mover(i, 1), "Bajar: " + x.titulo),
                    botonDe("master-docs-mando", "✎", () => {
                        editando = x;
                        cuando.value = x.cuando;
                        titulo.value = x.titulo;
                        texto.value = x.texto;
                        sesionC.checked = !!x.sesion;
                        ok.textContent = "✓ guardar el cambio";
                        titulo.focus();
                    }, "Cambiar: " + x.titulo),
                    botonDe("master-docs-mando", "✕", () => {
                        todo.linea.splice(i, 1);
                        guardar();
                        pintar();
                        avisar("Quitado: " + x.titulo + ".");
                    }, "Quitar: " + x.titulo));
                li.appendChild(mandos);
                return li;
            }));
            if (!ver.length) {
                ol.appendChild(crear("li", "oc-vacio", todo.linea.length ? "Nada con eso." : "Todavía no hay nada: apunta la primera sesión."));
            }
        }
        function mover(i, paso) {
            const j = i + paso;
            if (j < 0 || j >= todo.linea.length) {
                return;
            }
            const [x] = todo.linea.splice(i, 1);
            todo.linea.splice(j, 0, x);
            guardar();
            pintar();
            const b = ol.querySelectorAll(".master-linea-paso")[j];
            if (b) {
                b.querySelectorAll("button")[paso < 0 ? 0 : 1].focus();
            }
        }
        const etB = crear("label", "visually-hidden", "Buscar en la línea temporal");
        buscar.id = "master-linea-buscar-" + m.id;
        etB.htmlFor = buscar.id;
        const barra = crear("div", "master-creador-barra");
        barra.append(etB, buscar, copiar);
        dentro.replaceChildren(form, barra, ol);
        pintar();
    }

    // ---- EL MAPA DE RELACIONES de la campaña: quién es quién (PNJ, PJ,
    // facciones, lugares) y cómo se llevan, con un dibujo que se ordena
    // arrastrando y la misma información en una lista. ----
    const TIPOS_NODO = [["pnj", "🧑", "PNJ"], ["pj", "🛡️", "PJ"], ["faccion", "🏰", "facción"], ["lugar", "📍", "lugar"],
        ["otro", "✳️", "otro"]];
    const TIPOS_LAZO = [["aliado", "es aliado de", "#3fae5a"], ["enemigo", "es enemigo de", "#d23b3b"], ["familia", "es familia de", "#e6c229"],
        ["trabaja", "trabaja para", "#3b7ddd"], ["ama", "está enamorado de", "#e05aa8"], ["desconfia", "desconfía de", "#e88a2a"],
        ["otro", "está relacionado con", "#8a8a99"]];
    function montarRelaciones(dentro, m) {
        const r = todo.relaciones = todo.relaciones || {};
        r.nodos = Array.isArray(r.nodos) ? r.nodos : [];
        r.lazos = Array.isArray(r.lazos) ? r.lazos : [];
        const NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("class", "master-rel-mapa");
        svg.setAttribute("viewBox", "0 0 1000 640");
        svg.setAttribute("aria-hidden", "true");
        const tipoN = (k) => TIPOS_NODO.find((t) => t[0] === k) || TIPOS_NODO[4];
        const tipoL = (k) => TIPOS_LAZO.find((t) => t[0] === k) || TIPOS_LAZO[6];
        const nodo = (id) => r.nodos.find((n) => n.id === id);
        function colocar(n) {
            const i = r.nodos.indexOf(n);
            const a = i * 2.39996;
            n.x = Math.round(500 + Math.cos(a) * (120 + (i % 4) * 60));
            n.y = Math.round(320 + Math.sin(a) * (90 + (i % 4) * 45));
        }
        function dibujar() {
            const el = (tag, at) => {
                const x = document.createElementNS(NS, tag);
                Object.keys(at).forEach((k) => x.setAttribute(k, at[k]));
                return x;
            };
            const cosas = [];
            r.lazos.forEach((l) => {
                const a = nodo(l.de);
                const b = nodo(l.a);
                if (!a || !b) {
                    return;
                }
                const col = tipoL(l.tipo)[2];
                cosas.push(el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: col, "stroke-width": 4, "marker-end": "" }));
                const t = el("text", { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 6, "text-anchor": "middle", class: "master-rel-lazo-texto" });
                t.textContent = l.texto || tipoL(l.tipo)[1].replace(/^(es|está) /, "");
                cosas.push(t);
            });
            r.nodos.forEach((n) => {
                const g = el("g", { class: "master-rel-nodo", transform: "translate(" + n.x + " " + n.y + ")" });
                g.appendChild(el("circle", { r: 40, class: "master-rel-circulo es-" + n.tipo }));
                const e = el("text", { y: 12, "text-anchor": "middle", class: "master-rel-emoji" });
                e.textContent = tipoN(n.tipo)[1];
                const t = el("text", { y: 68, "text-anchor": "middle", class: "master-rel-nombre" });
                t.textContent = n.nombre;
                g.append(e, t);
                g.addEventListener("pointerdown", (ev) => arrastrar(ev, n, g));
                cosas.push(g);
            });
            svg.replaceChildren(...cosas);
        }
        function arrastrar(ev, n, g) {
            ev.preventDefault();
            const caja = svg.getBoundingClientRect();
            const escala = 1000 / caja.width;
            const mover = (e) => {
                n.x = Math.max(40, Math.min(960, Math.round((e.clientX - caja.left) * escala)));
                n.y = Math.max(40, Math.min(600, Math.round((e.clientY - caja.top) * escala)));
                dibujar();
            };
            const soltar = () => {
                document.removeEventListener("pointermove", mover);
                document.removeEventListener("pointerup", soltar);
                guardar();
            };
            document.addEventListener("pointermove", mover);
            document.addEventListener("pointerup", soltar);
        }
        // Añadir: alguien o algo, y un lazo entre dos.
        const elegir = (opciones, id, texto) => {
            const sel = crear("select", "oc-dados-elegir");
            sel.id = id + m.id;
            opciones.forEach(([v, t]) => {
                const o = crear("option", "", t);
                o.value = v;
                sel.appendChild(o);
            });
            const caja = crear("div", "master-campo");
            const et = crear("label", "oc-dados-etiqueta", texto);
            et.htmlFor = sel.id;
            caja.append(et, sel);
            caja.sel = sel;
            return caja;
        };
        const formN = crear("form", "master-rel-form");
        const nombreN = crear("input", "oc-dados-texto");
        nombreN.id = "master-rel-nombre-" + m.id;
        nombreN.maxLength = 60;
        nombreN.placeholder = "Sildar, los Capas Rojas, Phandalin…";
        const etN = crear("label", "oc-dados-etiqueta", "quién o qué");
        etN.htmlFor = nombreN.id;
        const cajaN = crear("div", "master-campo");
        cajaN.append(etN, nombreN);
        const tipoNsel = elegir(TIPOS_NODO.map(([k, e, t]) => [k, e + " " + t]), "master-rel-tipo-", "es");
        const okN = crear("button", "oc-vida-accion es-principal", "＋ añadir");
        okN.type = "submit";
        const party = botonDe("oc-vida-accion", "🛡️ ＋ la party", () => {
            let n = 0;
            (todo.pjs || []).forEach((pj) => {
                if (pj.nombre && !r.nodos.some((x) => x.pjId === pj.id)) {
                    const x = { id: idDoc("n"), nombre: pj.nombre, tipo: "pj", pjId: pj.id };
                    r.nodos.push(x);
                    colocar(x);
                    n++;
                }
            });
            guardar();
            pintar();
            avisar(n ? "Añadidos " + n + " PJ." : "La party ya estaba.");
        }, "Añadir a los PJ de la party");
        formN.append(cajaN, tipoNsel, okN, party);
        formN.addEventListener("submit", (e) => {
            e.preventDefault();
            const nm = nombreN.value.trim();
            if (!nm) {
                nombreN.focus();
                return;
            }
            const x = { id: idDoc("n"), nombre: nm, tipo: tipoNsel.sel.value };
            r.nodos.push(x);
            colocar(x);
            nombreN.value = "";
            guardar();
            pintar();
            avisar("Añadido: " + nm + ".");
            nombreN.focus();
        });
        const formL = crear("form", "master-rel-form");
        const deSel = elegir([], "master-rel-de-", "de");
        const tipoLsel = elegir(TIPOS_LAZO.map(([k, t]) => [k, t]), "master-rel-lazo-", "es");
        const aSel = elegir([], "master-rel-a-", "a");
        const notaL = crear("input", "oc-dados-texto");
        notaL.id = "master-rel-nota-" + m.id;
        notaL.maxLength = 60;
        notaL.placeholder = "le debe dinero, su hermana…";
        const etL = crear("label", "oc-dados-etiqueta", "en corto (opcional)");
        etL.htmlFor = notaL.id;
        const cajaL = crear("div", "master-campo");
        cajaL.append(etL, notaL);
        const okL = crear("button", "oc-vida-accion es-principal", "＋ unir");
        okL.type = "submit";
        formL.append(deSel, tipoLsel, aSel, cajaL, okL);
        formL.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!deSel.sel.value || !aSel.sel.value || deSel.sel.value === aSel.sel.value) {
                avisar("Elige a dos distintos.");
                return;
            }
            r.lazos.push({ id: idDoc("z"), de: deSel.sel.value, a: aSel.sel.value, tipo: tipoLsel.sel.value, texto: notaL.value.trim() });
            notaL.value = "";
            guardar();
            pintar();
            avisar("Unidos: " + nodo(r.lazos[r.lazos.length - 1].de).nombre + " y " + nodo(r.lazos[r.lazos.length - 1].a).nombre + ".");
        });
        // La lista (lo mismo que el dibujo, para leerlo y quitar).
        const lista = crear("ul", "master-rel-lista");
        lista.setAttribute("aria-label", "Relaciones");
        function pintar() {
            const ops = r.nodos.map((n) => [n.id, tipoN(n.tipo)[1] + " " + n.nombre]);
            [deSel.sel, aSel.sel].forEach((sel, k) => {
                const antes = sel.value;
                sel.replaceChildren(...ops.map(([v, t]) => {
                    const o = crear("option", "", t);
                    o.value = v;
                    return o;
                }));
                if (ops.some((o) => o[0] === antes)) {
                    sel.value = antes;
                } else if (ops[k]) {
                    sel.value = ops[k][0];
                }
            });
            formL.hidden = r.nodos.length < 2;
            lista.replaceChildren(...r.nodos.map((n) => {
                const li = crear("li", "master-rel-quien");
                const cab = crear("p", "master-rel-cab");
                cab.append(crear("strong", "", tipoN(n.tipo)[1] + " " + n.nombre), crear("span", "oc-hoja-nota", " (" + tipoN(n.tipo)[2] + ")"),
                    botonDe("master-docs-mando", "✕", () => {
                        r.nodos = r.nodos.filter((x) => x !== n);
                        r.lazos = r.lazos.filter((l) => l.de !== n.id && l.a !== n.id);
                        guardar();
                        pintar();
                        avisar("Quitado: " + n.nombre + " (y sus lazos).");
                    }, "Quitar a " + n.nombre + " y sus lazos"));
                li.appendChild(cab);
                const suyos = r.lazos.filter((l) => l.de === n.id || l.a === n.id);
                if (suyos.length) {
                    const ul = crear("ul", "master-rel-lazos");
                    suyos.forEach((l) => {
                        const otro = nodo(l.de === n.id ? l.a : l.de);
                        if (!otro) {
                            return;
                        }
                        const lli = crear("li");
                        const marca = crear("span", "master-rel-marca");
                        marca.style.backgroundColor = tipoL(l.tipo)[2];
                        marca.setAttribute("aria-hidden", "true");
                        const frase = l.de === n.id ? tipoL(l.tipo)[1] + " " + otro.nombre : otro.nombre + " " + tipoL(l.tipo)[1] + " " + n.nombre;
                        lli.append(marca, document.createTextNode(" " + frase + (l.texto ? " — " + l.texto : "") + " "),
                            botonDe("master-docs-mando", "✕", () => {
                                r.lazos = r.lazos.filter((x) => x !== l);
                                guardar();
                                pintar();
                                avisar("Quitado el lazo.");
                            }, "Quitar el lazo: " + n.nombre + " y " + otro.nombre));
                        ul.appendChild(lli);
                    });
                    li.appendChild(ul);
                }
                return li;
            }));
            if (!r.nodos.length) {
                lista.appendChild(crear("li", "oc-vacio", "Todavía no hay nadie: añade PNJ, facciones, lugares o la party."));
            }
            dibujar();
        }
        r.nodos.forEach((n) => {
            if (typeof n.x !== "number") {
                colocar(n);
            }
        });
        dentro.replaceChildren(formN, formL, svg, crear("p", "oc-hoja-nota", "Arrastra los círculos para ordenarlos. Debajo, lo mismo"
            + " en una lista."), lista);
        pintar();
    }

    const MODULOS = {
        iniciativa: { nombre: "iniciativa", emoji: "⏱️", grupo: "combate", unico: true, w: 420, h: 520,
            desc: "El orden de turnos, con rondas, PG y marcas.",
            montar: (d) => window.ocMontar.iniciativa(d, { suelta: true, traerParty: () => {
                const leer = () => {
                    try {
                        return JSON.parse(localStorage.getItem("richi-oc-iniciativa") || "{}").lista || [];
                    } catch (e) {
                        return [];
                    }
                };
                const ya = leer().map((x) => x.pj);
                return todo.pjs.filter((pj) => !ya.includes(pj.id)).map((pj, i) => meterEnIniciativa(iniDePj(normalizarPj(pj),
                    pj.nombre || "jugador " + (i + 1)))).filter(Boolean).join(", ");
            } }) },
        condiciones: { nombre: "condiciones", emoji: "🙈", grupo: "combate", unico: true, w: 460, h: 420,
            desc: "Los estados: agarrado, cegado, derribado…", montar: (d, m) => montarReglas(d, m, "Estados") },
        acciones: { nombre: "acciones", emoji: "⚔️", grupo: "combate", unico: true, w: 460, h: 420,
            desc: "Lo que se puede hacer en un turno.", montar: (d, m) => montarReglas(d, m, "Acciones") },
        reglas: { nombre: "todas las reglas", emoji: "📚", grupo: "consulta", unico: true, w: 480, h: 520,
            desc: "Las reglas del SRD 5.2, por temas.", montar: (d, m) => montarReglas(d, m, null) },
        homebrew: { nombre: "reglas propias", emoji: "🏠", grupo: "consulta", unico: true, w: 460, h: 460,
            desc: "Las reglas de tu mesa (homebrew).", montar: montarHomebrew },
        rasgos: { nombre: "rasgos, dotes y habilidades", emoji: "⭐", grupo: "consulta", unico: true, w: 440, h: 520,
            desc: "Los rasgos de clase y especie, las dotes y las habilidades del SRD, y los tuyos.", montar: montarRasgos },
        conjuros: { nombre: "conjuros", emoji: "✨", grupo: "consulta", unico: true, w: 420, h: 480,
            desc: "Los 339 del SRD, por nivel, escuela y clase.", montar: montarConjuros },
        bestiario: { nombre: "bestiario", emoji: "🐉", grupo: "consulta", unico: true, w: 460, h: 520,
            desc: "Los 330 monstruos del SRD, con su perfil.", montar: montarBestiario },
        party: { nombre: "party (jugadores)", emoji: "🛡️", grupo: "mesa", unico: true, w: 600, h: 440,
            desc: "Los personajes de los jugadores: de un vistazo, sus hechizos y su ficha entera (con pestañas).", montar: montarParty },
        tienda: { nombre: "tienda", emoji: "💰", grupo: "mundo", w: 520, h: 560, desc: "Precios, rarezas y regateo.",
            montar: montarTienda },
        monedas: { nombre: "conversor de monedas", emoji: "🪙", grupo: "mundo", w: 420, h: 440,
            desc: "Cambiar y repartir el botín.", montar: montarMonedas },
        nombres: { nombre: "generador de nombres", emoji: "🎭", grupo: "mundo", w: 440, h: 560,
            desc: "Personajes por especie y género, y lugares.", montar: montarNombres },
        botin: { nombre: "botín", emoji: "💰", grupo: "mundo", w: 440, h: 560,
            desc: "Monedas, gemas, arte y objetos mágicos según el VD.", montar: montarBotin },
        encuentros: { nombre: "encuentros", emoji: "🗺️", grupo: "combate", w: 440, h: 620,
            desc: "Monstruos del SRD por hábitat para tu party.", montar: montarEncuentros },
        pnj: { nombre: "PNJ rápidos", emoji: "🧑", grupo: "mundo", w: 460, h: 620,
            desc: "Un PNJ con oficio, aspecto, carácter, manía, lo que quiere y un secreto.", montar: montarPnj },
        dungeon: { nombre: "generador de dungeons", emoji: "🗝️", grupo: "mundo", w: 680, h: 780,
            desc: "Un mapa en cuadrícula con sus salas, monstruos, trampas y botín.", montar: montarDungeon },
        calendario: { nombre: "calendario", emoji: "📅", grupo: "mundo", w: 520, h: 720,
            desc: "Gregoriano, el de Harptos o uno propio, con la hora y apuntes.", montar: montarCalendario },
        efectos: { nombre: "efectos con duración", emoji: "⌛", grupo: "combate", w: 460, h: 620,
            desc: "Bendecir 1 minuto, Armadura de mago 8 horas…: se descuentan solos.", montar: montarEfectos },
        taberna: { nombre: "negocios", emoji: "🏪", grupo: "mundo", w: 500, h: 760,
            desc: "Tabernas y posadas, tiendas, templos, establos…: con lo que venden, sus precios y un gancho.", montar: montarNegocio },
        ambiente: { nombre: "sonido ambiente", emoji: "🎧", grupo: "mesa", unico: true, w: 440, h: 640,
            desc: "Lluvia, viento, hoguera, mercado, carro…: grabaciones de verdad en bucle, mezcladas (y tus audios).",
            montar: montarAmbiente },
        sonidos: { nombre: "efectos de sonido", emoji: "🔔", grupo: "mesa", unico: true, w: 560, h: 680,
            desc: "Puertas, tajos, conjuros, gritos, monstruos…: suenan una vez al pulsar (y tus audios).",
            montar: montarSonidos },
        tablas: { nombre: "tablas aleatorias", emoji: "🎲", grupo: "mundo", w: 460, h: 560,
            desc: "Tus tablas (rumores, clima, encuentros de una zona…) y tirarlas con un clic.", montar: montarTablas },
        linea: { nombre: "línea temporal", emoji: "🗓️", grupo: "apuntes", unico: true, w: 520, h: 680,
            desc: "Las sesiones y lo que pasa en la campaña, en orden y con su fecha.", montar: montarLinea },
        relaciones: { nombre: "mapa de relaciones", emoji: "🕸️", grupo: "apuntes", unico: true, w: 760, h: 760,
            desc: "PNJ, facciones, lugares y la party, y cómo se llevan.", montar: montarRelaciones },
        jugadores: { nombre: "pantalla de jugadores", emoji: "📺", grupo: "mesa", unico: true, w: 460, h: 620,
            desc: "Una ventana aparte para la tele, Discord u OBS con sólo lo que tú elijas.", montar: montarJugadores },
        musica: { nombre: "música", emoji: "🎶", grupo: "mesa", unico: true, w: 560, h: 720,
            desc: "Tus canciones en carpetas y subcarpetas: una en bucle o la carpeta entera (se quedan en tu navegador).",
            montar: montarMusica },
        relojes: { nombre: "relojes", emoji: "⏳", grupo: "mesa", w: 440, h: 480,
            desc: "Relojes de progreso: amenazas que avanzan, cuentas atrás…", montar: montarRelojes },
        idiomas: { nombre: "notas en otros idiomas", emoji: "🪶", grupo: "mundo", w: 480, h: 680,
            desc: "Escribe una nota y mírala en élfico, enano, infernal…", montar: montarIdiomas },
        tarjeta: { nombre: "post-it", emoji: "🗒️", grupo: "apuntes", w: 420, h: 340,
            desc: "Un texto con formato: negrita, listas, colores…", montar: montarTarjeta },
        dibujo: { nombre: "dibujo", emoji: "🎨", grupo: "apuntes", w: 900, h: 660,
            desc: "Un Paint con capas, bote, selección y rejilla de rol.", montar: montarDibujo },
        notas: { nombre: "notas", emoji: "📝", grupo: "apuntes", unico: true, w: 520, h: 480,
            desc: "Las notas de la sesión, con formato (como un Word).", montar: montarNotas },
        documentos: { nombre: "documentos", emoji: "🗂️", grupo: "apuntes", w: 420, h: 560,
            desc: "Tus carpetas y notas: búscalas (nombre y contenido) y ábrelas en el tablero.", montar: montarDocumentos },
        tabla: { nombre: "tabla para tirar", emoji: "🔮", grupo: "apuntes", w: 360, h: 380,
            desc: "Una lista de la que sale una cosa al azar.", montar: montarTabla },
        criatura: { nombre: "criatura", emoji: "🐾", oculto: true, w: 440, h: 520, montar: montarCriatura },
        ficha: { nombre: "ficha", emoji: "📖", oculto: true, w: 420, h: 420, montar: montarFicha },
        pj: { nombre: "ficha de personaje", emoji: "🧝", oculto: true, w: 620, h: 720, montar: montarPj },
        inventario: { nombre: "inventario de la party", emoji: "🎒", grupo: "mesa", unico: true, w: 520, h: 600,
            desc: "Lo que lleva la party en común y su dinero; «dar a…» un personaje.", montar: montarInventario },
        documento: { nombre: "nota", emoji: "📄", oculto: true, w: 560, h: 560, montar: montarDocumento },
    };
    const GRUPOS = [["combate", "⚔️ combate"], ["consulta", "📚 consulta"], ["mesa", "🛡️ la mesa"], ["mundo", "🌍 el mundo"],
        ["apuntes", "🗒️ apuntes"]];

    // ---- EL ESTADO (lo que se guarda) ----
    // Los colores de las ventanas, como post-its: fijos, iguales en todos
    // los temas de la web (la barra de ese color con letra oscura).
    const COLORES = [["", "sin color"], ["amarillo", "amarillo", "#ffe873"], ["naranja", "naranja", "#ffb870"],
        ["melocoton", "melocotón", "#ffcfa8"], ["rojo", "rojo", "#ff8f8f"], ["coral", "coral", "#ff7f6e"], ["rosa", "rosa", "#ffa6d5"],
        ["fucsia", "fucsia", "#ff6fcf"], ["morado", "morado", "#c9a2ff"], ["lavanda", "lavanda", "#ddd0ff"], ["azul", "azul", "#8fb8ff"],
        ["celeste", "celeste", "#7fdcff"], ["turquesa", "turquesa", "#5fe0c8"], ["menta", "menta", "#b8f5d0"], ["verde", "verde", "#8fe8a2"],
        ["lima", "lima", "#d4f27a"], ["arena", "arena", "#e8d8b0"], ["marron", "marrón", "#c9a37a"], ["gris", "gris", "#c9c9d1"],
        ["blanco", "blanco", "#f7f5f0"]];
    // Un color: el de la lista o uno propio («#rrggbb», del selector).
    const hexPropio = (c) => (/^#[0-9a-f]{6}$/i.test(c || "") ? c.toLowerCase() : "");
    const hexDe = (color) => hexPropio(color) || (COLORES.find((c) => c[0] === color) || [])[2] || "";
    // La tinta que se lee encima de un color: casi negra o blanca, según
    // lo claro que sea (luminancia relativa, como el contraste de la WCAG).
    function tintaDe(hex) {
        const lin = (i) => {
            const v = parseInt(hex.slice(i, i + 2), 16) / 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        const l = 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
        return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? "#14101a" : "#ffffff";
    }
    // Los colores del tablero (el fondo del lienzo de cada perfil), como
    // tapetes: fijos, iguales en todos los temas (o uno propio). Las rayas
    // de la cuadrícula, claras u oscuras según el fondo. La pestaña de
    // arriba se pinta del mismo color.
    const TABLEROS = [["", "el del tema"], ["tapete", "tapete verde", "#1f4d36"], ["bosque", "bosque", "#2d5a27"],
        ["musgo", "musgo", "#4a5d23"], ["vino", "rojo vino", "#5a1f2a"], ["carmesi", "carmesí", "#8b1e2d"],
        ["teja", "teja", "#9c4a2f"], ["noche", "azul noche", "#1d2b4f"], ["oceano", "océano", "#1f5f7a"],
        ["madera", "madera", "#5b3b22"], ["pizarra", "pizarra", "#2f3438"], ["ceniza", "ceniza", "#5c5c66"],
        ["negro", "negro", "#121212"], ["uva", "morado", "#3d2552"], ["pergamino", "pergamino", "#e8dcc0"],
        ["arena", "arena", "#d9c7a3"], ["crema", "crema", "#f4ecd8"], ["cielo", "cielo", "#bfd6e6"], ["menta", "menta", "#cde8d5"]];
    const hexTablero = (c) => hexPropio(c) || (TABLEROS.find((x) => x[0] === c) || [])[2] || "";
    // Las pestañas: los colores de los tableros y los de las ventanas.
    const COLORES_PESTANA = [["", "sin color"]].concat(TABLEROS.slice(1),
        COLORES.slice(1).filter((c) => !TABLEROS.some((t) => t[0] === c[0])));
    const hexPestana = (c) => hexPropio(c) || (COLORES_PESTANA.find((x) => x[0] === c) || [])[2] || "";
    // La de antes (sin su color propio) lleva el de su tablero.
    const colorDePestana = (pf) => (pf.colorPestana !== undefined ? pf.colorPestana : pf.color || "");

    // Las muestras de color de un formulario, con «otro» (el selector del
    // sistema) al final: «lista» [[valor, nombre, hex]]; devuelve el
    // grupo, con .valor() para leer el elegido.
    function muestrasDe(leyenda, lista, valor, idOtro) {
        const grupo = crear("fieldset", "master-colores");
        grupo.appendChild(crear("legend", "oc-dados-etiqueta", leyenda));
        let elegido = valor || "";
        const otro = crear("input", "master-color-otro");
        const marcar = () => muestras.forEach((x) => x.setAttribute("aria-pressed", x.dataset.valor === elegido ? "true" : "false"));
        const muestras = lista.map(([v, nombre, hex]) => {
            const b = botonDe("master-color" + (v ? "" : " es-ninguno"), "", () => {
                elegido = v;
                marcar();
            }, nombre);
            b.dataset.valor = v;
            b.title = nombre;
            if (hex) {
                b.style.backgroundColor = hex;
            }
            grupo.appendChild(b);
            return b;
        });
        const etOtro = crear("label", "master-color-otro-caja");
        otro.type = "color";
        otro.id = idOtro;
        otro.value = hexPropio(elegido) || "#8fb8ff";
        etOtro.htmlFor = otro.id;
        etOtro.append(otro, crear("span", "", "🎨 otro"));
        otro.addEventListener("input", () => {
            elegido = otro.value;
            marcar();
        });
        grupo.appendChild(etOtro);
        marcar();
        grupo.valor = () => elegido;
        return grupo;
    }

    // LAS PESTAÑAS DE SERIE: las que trae una campaña nueva y las
    // plantillas de «＋» (la disposición de Richi: cada pestaña, el color
    // de su tablero, el de su pestaña (null: el del tablero) y sus ventanas
    // [tipo, x, y, ancho, alto, color, plegada, escala, grupo, delante],
    // sin lo que tienen dentro).
    const PERFILES_DE_SERIE = [
        ["⭐home", "#000000", "", [
            ["acciones", 1261, 15, 596, 712, "#ad1f1f", 1, 1, "gm90", 0], ["reglas", 1263, 118, 595, 706, "naranja", 1, 1, "gm89", 0],
            ["conjuros", 1261, 15, 596, 712, "celeste", 1, 1, "gm90", 0], ["notas", 6, 14, 1234, 792, "#1b1818", 0, 1, "gm49", 1],
            ["homebrew", 1263, 118, 595, 706, "blanco", 1, 1, "gm89", 0], ["calendario", 1263, 118, 595, 706, "gris", 1, 0.8, "gm89", 1],
            ["bestiario", 1258, 221, 600, 440, "#151619", 1, 1, "gm82", 0], ["party", 1258, 221, 600, 440, "rosa", 1, 1, "gm82", 1],
            ["dibujo", 6, 14, 1234, 792, "blanco", 0, 1, "gm49", 0], ["condiciones", 1261, 15, 596, 712, "coral", 1, 1, "gm90", 0],
            ["rasgos", 1261, 15, 596, 712, "amarillo", 1, 1, "gm90", 1]
        ]],
        ["📝notas", "noche", "oceano", [
            ["dibujo", 438, 17, 1318, 862, "arena", 0, 1, "gm76", 1], ["tarjeta", 7, 568, 381, 319, "amarillo", 0, 1, "gm77", 0],
            ["idiomas", 438, 17, 1318, 862, "", 0, 1, "gm76", 0], ["tarjeta", 7, 568, 381, 319, "verde", 0, 1, "gm77", 0],
            ["tarjeta", 7, 568, 381, 319, "celeste", 0, 1, "gm77", 0], ["tarjeta", 7, 568, 381, 319, "coral", 0, 1, "gm77", 1],
            ["documentos", 1, 10, 401, 548, "", 0, 1], ["notas", 438, 17, 1318, 862, "#575b60", 0, 1, "gm76", 0]
        ]],
        ["❌combate", "vino", "carmesi", [
            ["iniciativa", 7, 11, 391, 835, "#ca1c1c", 0, 1, "gm43", 1], ["condiciones", 1356, 15, 476, 776, "morado", 0, 1, "gm46", 1],
            ["acciones", 1356, 15, 476, 776, "fucsia", 0, 1, "gm46", 0], ["bestiario", 553, 18, 612, 630, "#000000", 0, 1, "gm72", 1],
            ["relojes", 7, 11, 391, 835, "lavanda", 0, 1, "gm43", 0], ["encuentros", 553, 18, 612, 630, "turquesa", 0, 1, "gm72", 0],
            ["party", 553, 18, 612, 630, "blanco", 0, 1, "gm72", 0]
        ]],
        ["💰tiendas", "uva", "arena", [
            ["tienda", 0, 0, 553, 836, "coral", 0, 1], ["monedas", 1416, 0, 420, 440, "amarillo", 0, 1],
            ["taberna", 621, 0, 662, 635, "morado", 0, 1]
        ]],
        ["🧙‍♂️npcs", "bosque", null, [
            ["nombres", 1352, 9, 460, 620, "azul", 0, 1, "gm70", 1], ["pnj", 1352, 9, 460, 620, "marron", 0, 1, "gm70", 0],
            ["bestiario", 1, 0, 457, 554, "rojo", 0, 1], ["tarjeta", 619, 21, 594, 505, "amarillo", 0, 1, "gm75", 1],
            ["tarjeta", 619, 21, 594, 505, "turquesa", 0, 1, "gm75", 0], ["tarjeta", 619, 21, 594, 505, "azul", 0, 1, "gm75", 0],
            ["tarjeta", 619, 21, 594, 505, "morado", 0, 1, "gm75", 0], ["tarjeta", 619, 21, 594, 505, "coral", 0, 1, "gm75", 0]
        ]],
        ["🛡️party", "verde", null, [
            ["party", 0, 0, 640, 720, "verde", 0, 1], ["inventario", 1327, 6, 520, 720, "melocoton", 0, 1]
        ]],
        ["🎲generadores", "pizarra", null, [
            ["dungeon", 0, 0, 1355, 870, "gris", 0, 1], ["botin", 1392, 4, 440, 456, "naranja", 0, 1],
            ["nombres", 1395, 481, 439, 256, "verde", 0, 1]
        ]],
        ["🎵música", "", "uva", [
            ["musica", 5, 24, 785, 878, "celeste", 0, 1], ["sonidos", 813, 23, 560, 680, "marron", 0, 1],
            ["ambiente", 1401, 20, 432, 688, "azul", 0, 1]
        ]]
    ];
    function perfilesDeSerie() {
        return PERFILES_DE_SERIE.map(([nombre, color, colorPestana, ventanas]) => ({ nombre, color,
            colorPestana: colorPestana === null ? color : colorPestana,
            modulos: ventanas.filter((v) => MODULOS[v[0]]).map(([tipo, x, y, w, h, c, plegado, escala, grupo, delante]) => Object.assign(
                { tipo, x, y, w, h, color: c, plegado: !!plegado, escala }, grupo ? { grupo, delante: !!delante } : {})) }));
    }

    // CAMPAÑAS: configuraciones separadas (dos campañas, dos partys que
    // no se mezclan). Cada una con sus PERFILES (las pestañas de arriba,
    // cada uno con sus ventanas) y su party (pjs). «todo» es la campaña
    // de ahora y «estado», su perfil a la vista.
    let todas = null;
    try {
        todas = JSON.parse(localStorage.getItem(CLAVE) || "null");
    } catch (e) {
        todas = null;
    }
    if (todas && Array.isArray(todas.modulos) && !todas.perfiles && !todas.campanas) {
        // Lo de antes de las pestañas: su primera pestaña.
        todas = { perfiles: [{ id: "p1", nombre: "principal", modulos: todas.modulos }], activo: "p1" };
    }
    if (todas && Array.isArray(todas.perfiles) && !todas.campanas) {
        // Lo de antes de las campañas: todo en la primera.
        todas = { activa: "c1", campanas: [{ id: "c1", nombre: "mi campaña", activo: todas.activo, perfiles: todas.perfiles }] };
    }
    // La primera vez (sin nada guardado) no hay campañas: la entrada obliga
    // a crear una. Mientras, una de relleno que no se guarda.
    const sinCampanas = !todas || !Array.isArray(todas.campanas) || !todas.campanas.length;
    let sinGuardarTodavia = sinCampanas;
    if (sinCampanas) {
        todas = { activa: "c1", campanas: [{ id: "c1", nombre: "mi campaña", perfiles: perfilesDeSerie() }] };
    }
    let siguienteId = 1;
    let siguientePerfil = 1;
    let siguienteCampana = 1;
    todas.campanas.forEach((c) => {
        c.id = c.id || "c" + siguienteCampana;
        siguienteCampana = Math.max(siguienteCampana, parseInt(String(c.id).slice(1), 10) + 1 || siguienteCampana);
        c.nombre = c.nombre || "campaña";
        c.perfiles = Array.isArray(c.perfiles) && c.perfiles.length ? c.perfiles : perfilesDeSerie();
        c.pjs = Array.isArray(c.pjs) ? c.pjs : [];
        c.docs = c.docs && Array.isArray(c.docs.carpetas) && Array.isArray(c.docs.notas) ? c.docs : { carpetas: [], notas: [] };
        c.musica = c.musica && Array.isArray(c.musica.carpetas) && Array.isArray(c.musica.canciones) ? c.musica : undefined;
        c.perfiles.forEach((pf) => {
            pf.id = pf.id || "p" + siguientePerfil;
            siguientePerfil = Math.max(siguientePerfil, parseInt(String(pf.id).slice(1), 10) + 1 || siguientePerfil);
            pf.nombre = pf.nombre || "perfil";
            pf.modulos = (Array.isArray(pf.modulos) ? pf.modulos : []).filter((m) => MODULOS[m.tipo]);
            pf.modulos.forEach((m) => {
                // Las tarjetas y tablas de antes tenían el título dentro.
                if (!m.titulo && m.datos && m.datos.titulo) {
                    m.titulo = m.datos.titulo;
                }
                m.color = hexDe(m.color) ? m.color : "";
                m.id = m.id || "m" + siguienteId++;
                siguienteId = Math.max(siguienteId, parseInt(String(m.id).slice(1), 10) + 1 || siguienteId);
                // La party de antes iba en su ventana: ahora es de la
                // campaña (la misma en todos sus perfiles).
                if (m.tipo === "party" && m.datos && Array.isArray(m.datos.pjs)) {
                    m.datos.pjs.forEach((pj) => {
                        if (!c.pjs.some((x) => x === pj || (pj.id && x.id === pj.id))) {
                            c.pjs.push(pj);
                        }
                    });
                    delete m.datos.pjs;
                }
            });
        });
    });
    // Los grupos de ventanas que se hayan quedado con una sola (o sin la
    // de delante), arreglados.
    todas.campanas.forEach((c) => c.perfiles.forEach((pf) => {
        const grupos = {};
        pf.modulos.filter((m) => m.grupo).forEach((m) => {
            (grupos[m.grupo] = grupos[m.grupo] || []).push(m);
        });
        Object.values(grupos).forEach((g) => {
            if (g.length < 2) {
                delete g[0].grupo;
                delete g[0].delante;
            } else if (!g.some((m) => m.delante)) {
                g[0].delante = true;
            } else {
                g.filter((m) => m.delante).slice(1).forEach((m) => {
                    m.delante = false;
                });
            }
        });
    }));
    let todo = todas.campanas.find((c) => c.id === todas.activa) || todas.campanas[0];
    let estado = todo.perfiles.find((pf) => pf.id === todo.activo) || todo.perfiles[0];

    function guardar() {
        if (sinGuardarTodavia) {
            return true;
        }
        todo.activo = estado.id;
        const salida = { activa: todo.id, campanas: todas.campanas.map((c) => ({ id: c.id, nombre: c.nombre, activo: c.activo,
            pjs: c.pjs, docs: c.docs, musica: c.musica, inventario: c.inventario, conParty: c.conParty, jugadores: c.jugadores, linea: c.linea, relaciones: c.relaciones, perfiles: c.perfiles.map((pf) => ({ id: pf.id, nombre: pf.nombre, color: pf.color || "",
                colorPestana: pf.colorPestana, zoom: pf.zoom || 1,
                modulos: pf.modulos.map((m) => ({ id: m.id, tipo: m.tipo, x: m.x, y: m.y, w: m.w, h: m.h,
                    titulo: m.titulo || "", color: m.color || "", plegado: !!m.plegado,
                    escala: m.escala || 1, grupo: m.grupo || undefined, delante: m.grupo ? !!m.delante : undefined,
                    datos: m.datos })) })) })) };
        try {
            localStorage.setItem(CLAVE, JSON.stringify(salida));
            return true;
        } catch (e) {
            // Sin almacenamiento (o lleno): se usa igual, sin guardar.
            return false;
        }
    }

    // ---- LAS VENTANAS ----
    let encima = 10;

    // EL ZOOM del tablero (zoom de CSS en el lienzo; por perfil, en
    // «zoom»). El ancho del lienzo, en sus píxeles: con zoom de menos cabe
    // más; con zoom de más, el de siempre (y se desliza de lado).
    const zoomAhora = () => (enMovil.matches || !HAY_ZOOM ? 1 : estado.zoom || 1);
    function anchoLienzo() {
        return Math.max(lienzo.clientWidth, Math.round(lienzo.getBoundingClientRect().width));
    }

    // Lo más a la derecha que puede ir una ventana (que no se salga del
    // lienzo).
    function topeX(m) {
        return Math.max(0, anchoLienzo() - m.w - 4);
    }

    function ponerTitulo(m) {
        if (m.el) {
            const n = m.el.querySelector(".master-ventana-nombre");
            if (n) {
                n.textContent = m.titulo || MODULOS[m.tipo].nombre;
            }
        }
    }

    function ponerColor(m) {
        if (!m.el) {
            return;
        }
        m.el.classList.toggle("con-color", !!m.color);
        if (m.color) {
            m.el.style.setProperty("--postit", hexDe(m.color));
            m.el.style.setProperty("--postit-tinta", tintaDe(hexDe(m.color)));
        } else {
            m.el.style.removeProperty("--postit");
            m.el.style.removeProperty("--postit-tinta");
        }
    }

    // ✎: una ventanita para cambiarle el título y el color.
    // EL TAMAÑO DEL CONTENIDO de una ventana (m.escala, de 0,6 a 2): zoom
    // de CSS en su cuerpo, así crece todo (letra, botones y dibujos).
    function ponerEscala(m) {
        const e = Math.min(2, Math.max(0.6, Math.round((m.escala || 1) * 10) / 10));
        m.escala = e === 1 ? undefined : e;
        if (m.cuerpo) {
            m.cuerpo.style.zoom = e === 1 ? "" : String(e);
        }
        return e;
    }

    function personalizar(m, vuelta) {
        const def = MODULOS[m.tipo];
        const cuerpo = crear("form", "master-personalizar");
        const et = crear("label", "oc-dados-etiqueta", "título");
        const input = crear("input", "oc-dados-texto");
        input.id = "master-personalizar-" + m.id;
        input.value = m.titulo || "";
        input.placeholder = def.nombre;
        input.maxLength = 60;
        input.autocomplete = "off";
        et.htmlFor = input.id;
        const grupo = muestrasDe("color", COLORES, m.color || "", "master-personalizar-otro-" + m.id);
        // El tamaño de lo de dentro: se ve al momento.
        const tam = crear("fieldset", "master-colores master-escala");
        tam.appendChild(crear("legend", "oc-dados-etiqueta", "tamaño del contenido"));
        const valor = crear("output", "master-escala-valor", Math.round((m.escala || 1) * 100) + " %");
        const paso = (d) => {
            m.escala = (m.escala || 1) + d;
            const e = ponerEscala(m);
            valor.textContent = Math.round(e * 100) + " %";
            menos.disabled = e <= 0.6;
            mas.disabled = e >= 2;
            guardar();
            avisar("Contenido al " + Math.round(e * 100) + " %.");
        };
        const menos = botonDe("master-pestana-mando", "A−", () => paso(-0.1), "Contenido más pequeño");
        const mas = botonDe("master-pestana-mando", "A+", () => paso(0.1), "Contenido más grande");
        const igual = botonDe("oc-vida-accion", "100 %", () => paso(1 - (m.escala || 1)), "Contenido a su tamaño normal");
        menos.disabled = (m.escala || 1) <= 0.6;
        mas.disabled = (m.escala || 1) >= 2;
        tam.append(menos, valor, mas, igual);
        const listo = crear("button", "oc-vida-accion es-principal", "guardar");
        listo.type = "submit";
        // En pestañas, como un navegador: título, color y tamaño.
        const pTitulo = crear("div");
        pTitulo.append(et, input);
        const pColor = crear("div");
        pColor.appendChild(grupo);
        const pTam = crear("div");
        pTam.appendChild(tam);
        // Agrupar (lo mismo que soltarla sobre otra, con el teclado).
        const pGrupo = crear("div");
        const otras = estado.modulos.filter((x) => x !== m && (!x.grupo || x.delante) && (!m.grupo || x.grupo !== m.grupo));
        if (otras.length) {
            const con = elegirDe("master-agrupar-" + m.id, "juntarla en pestañas con", otras.map((x) => [x.id, MODULOS[x.tipo].emoji + " "
                + nombreDeVentana(x) + (x.grupo ? " (y las de su grupo)" : "")]), otras[0].id);
            const juntar = botonDe("oc-vida-accion", "🗂️ agrupar", () => {
                const d = estado.modulos.find((x) => x.id === con.elegir.value);
                cerrar();
                if (d) {
                    agrupar(m, d);
                }
            });
            pGrupo.append(con, juntar);
        } else {
            pGrupo.appendChild(crear("p", "oc-hoja-nota", "No hay otras ventanas en esta pestaña."));
        }
        if (m.grupo) {
            pGrupo.appendChild(botonDe("oc-vida-accion", "⇱ sacarla del grupo", () => {
                cerrar();
                sacarDelGrupo(m);
            }));
        }
        pGrupo.appendChild(crear("p", "oc-hoja-nota", "También: mantén pulsada su barra y suéltala sobre la barra de otra."));
        const { lista: pestanas, elegir } = pestanasDe([["📝 título", pTitulo], ["🎨 color", pColor], ["🔠 tamaño", pTam],
            ["🗂️ agrupar", pGrupo]], "Opciones de la ventana", "master-personalizar-" + m.id);
        cuerpo.append(pestanas, pTitulo, pColor, pTam, pGrupo, listo);
        elegir(0, false);
        cuerpo.addEventListener("submit", (e) => {
            e.preventDefault();
            m.titulo = input.value.trim();
            m.color = grupo.valor();
            ponerTitulo(m);
            ponerColor(m);
            guardar();
            cerrar();
            if (m.grupo) {
                // Sus pestañas (en todas las del grupo), con el nombre y
                // el color nuevos.
                delGrupo(m).forEach((x) => {
                    x.el = null;
                });
                pintarTodo();
                focoDe(m).focus();
            }
            if (m.alRenombrar) {
                m.alRenombrar();
            }
            avisar("Guardado.");
        });
        const cerrar = window.ocVentana.abrir({ titulo: "opciones de la ventana", cuerpo, vuelta, foco: input });
    }

    function colocar(m) {
        if (m.grupo && m.delante) {
            delGrupo(m).forEach((x) => {
                if (x !== m) {
                    Object.assign(x, { x: m.x, y: m.y, w: m.w, h: m.h });
                }
            });
        }
        if (enMovil.matches) {
            m.el.style.left = "";
            m.el.style.top = "";
            m.el.style.width = "";
            m.el.style.height = "";
            return;
        }
        m.el.style.left = m.x + "px";
        m.el.style.top = m.y + "px";
        m.el.style.width = m.w + "px";
        m.el.style.height = m.plegado ? "" : m.h + "px";
    }

    function alFrente(m) {
        encima += 1;
        m.el.style.zIndex = String(encima);
    }

    // Lo que hay que mantener pulsada la barra para cogerla (ms).
    const ESPERA_COGER = 350;

    // ---- LOS GRUPOS: ventanas juntas en una, con pestañas (soltando una
    // sobre la barra de otra, o «agrupar» en su ✎). Cada una sigue siendo
    // suya (m.grupo, el mismo en todas; m.delante, la que se ve) y
    // comparten sitio, tamaño y plegado. ----
    const delGrupo = (m) => (m.grupo ? estado.modulos.filter((x) => x.grupo === m.grupo) : [m]);
    // Lo que se enfoca de una ventana: su nombre o, en un grupo, su pestaña.
    const focoDe = (m) => m.el.querySelector(".master-grupo-pestana[aria-selected='true']") || m.el.querySelector(".master-ventana-nombre");
    // Moverla con las flechas (con Mayús, más deprisa; con Alt, el tamaño).
    function moverConTeclas(m, e) {
        const paso = e.shiftKey ? 60 : 20;
        const d = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
        if (!d || enMovil.matches) {
            return false;
        }
        e.preventDefault();
        if (e.altKey) {
            m.w = Math.max(240, Math.min(anchoLienzo() - m.x - 4, m.w + d[0]));
            m.h = Math.max(120, m.h + d[1]);
            avisar(m.w + " por " + m.h + " píxeles.");
        } else {
            m.x = Math.min(topeX(m), Math.max(0, m.x + d[0]));
            m.y = Math.max(0, m.y + d[1]);
        }
        colocar(m);
        crecerLienzo();
        guardar();
        return true;
    }
    const nombreDeVentana = (m) => m.titulo || MODULOS[m.tipo].nombre;
    function verEnGrupo(m, foco) {
        const todas = delGrupo(m);
        const antes = todas.find((x) => x.delante) || todas[0];
        todas.forEach((x) => {
            Object.assign(x, { x: antes.x, y: antes.y, w: antes.w, h: antes.h, plegado: !!antes.plegado, delante: x === m });
            if (x.el) {
                x.el.hidden = !x.delante;
                if (x.pintarPlegado) {
                    x.pintarPlegado();
                }
                colocar(x);
            }
        });
        if (m.el) {
            alFrente(m);
            if (foco) {
                m.el.querySelector(".master-grupo-pestana[aria-selected='true']").focus();
            }
        }
        guardar();
    }
    function agrupar(m, destino) {
        const g = destino.grupo || "g" + destino.id;
        const juntas = delGrupo(destino).concat(delGrupo(m).filter((x) => x.grupo !== g || !destino.grupo));
        juntas.forEach((x) => {
            Object.assign(x, { grupo: g, x: destino.x, y: destino.y, w: destino.w, h: destino.h, plegado: !!destino.plegado,
                delante: x === m });
            x.el = null;
        });
        pintarTodo();
        guardar();
        alFrente(m);
        m.el.querySelector(".master-grupo-pestana[aria-selected='true']").focus();
        avisar("Juntas en pestañas: " + juntas.map(nombreDeVentana).join(", ") + ".");
    }
    function sacarDelGrupo(m, sitio) {
        const resto = delGrupo(m).filter((x) => x !== m);
        delete m.grupo;
        delete m.delante;
        if (sitio) {
            m.x = Math.min(topeX(m), Math.max(0, sitio.x));
            m.y = Math.max(0, sitio.y);
        } else {
            m.x = Math.min(topeX(m), m.x + 40);
            m.y += 40;
        }
        if (resto.length === 1) {
            delete resto[0].grupo;
            delete resto[0].delante;
        } else {
            resto[0].delante = true;
        }
        [m].concat(resto).forEach((x) => {
            x.el = null;
        });
        pintarTodo();
        guardar();
        alFrente(m);
        focoDe(m).focus();
        avisar("Sacada del grupo: " + nombreDeVentana(m) + ".");
    }
    // SEPARAR ARRASTRANDO: mantener pulsada la pestaña de una ventana de un
    // grupo la coge; soltada fuera de la barra, sale del grupo (donde se
    // suelta); sobre la barra de otra ventana, se junta con esa. Soltar no
    // cuenta como pulsar (pestanaSoltada).
    let pestanaSoltada = false;
    function cogerDelGrupo(e, t, x, v, cabeza) {
        if (enMovil.matches || e.button > 0) {
            return;
        }
        e.stopPropagation();
        const x0 = e.clientX;
        const y0 = e.clientY;
        const quieto = (ev) => {
            if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 8) {
                dejar();
            }
        };
        const dejar = () => {
            clearTimeout(reloj);
            document.removeEventListener("pointermove", quieto);
            document.removeEventListener("pointerup", dejar);
            document.removeEventListener("pointercancel", dejar);
        };
        const reloj = setTimeout(() => {
            dejar();
            try {
                t.setPointerCapture(e.pointerId);
            } catch (err) {
                // Sin captura: siguen llegando al documento.
            }
            pestanaSoltada = true;
            t.classList.add("es-cogida");
            let destino = null;
            let fuera = false;
            const marcar = (d) => {
                if (destino && destino.el) {
                    destino.el.classList.remove("es-destino");
                }
                destino = d;
                if (destino) {
                    destino.el.classList.add("es-destino");
                }
            };
            const mover = (ev) => {
                const r = cabeza.getBoundingClientRect();
                fuera = ev.clientY < r.top - 16 || ev.clientY > r.bottom + 16 || ev.clientX < r.left - 16 || ev.clientX > r.right + 16;
                v.classList.toggle("es-saliendo", fuera);
                const d = ventanaBajo(ev.clientX, ev.clientY, v);
                if (d !== destino) {
                    marcar(d);
                }
            };
            const soltar = (ev) => {
                document.removeEventListener("pointermove", mover);
                document.removeEventListener("pointerup", soltar);
                document.removeEventListener("pointercancel", soltar);
                t.classList.remove("es-cogida");
                v.classList.remove("es-saliendo");
                const d = destino;
                marcar(null);
                setTimeout(() => {
                    pestanaSoltada = false;
                }, 0);
                if (d) {
                    sacarDelGrupo(x);
                    agrupar(x, d);
                } else if (fuera) {
                    // Donde se suelta: la barra, bajo el puntero.
                    const r = lienzo.getBoundingClientRect();
                    const z = zoomAhora();
                    sacarDelGrupo(x, { x: Math.round((ev.clientX - r.left + lienzo.scrollLeft) / z) - 60,
                        y: Math.round((ev.clientY - r.top) / z) - 16 });
                }
            };
            document.addEventListener("pointermove", mover);
            document.addEventListener("pointerup", soltar);
            document.addEventListener("pointercancel", soltar);
        }, ESPERA_COGER);
        document.addEventListener("pointermove", quieto);
        document.addEventListener("pointerup", dejar);
        document.addEventListener("pointercancel", dejar);
    }

    // La ventana (de otra) cuya barra o pestañas están en ese punto.
    function ventanaBajo(x, y, yo) {
        const el = document.elementsFromPoint(x, y).find((e) => e.closest(".master-ventana-barra, .master-grupo-pestanas")
            && !yo.contains(e));
        const v = el && el.closest(".master-ventana");
        return v ? estado.modulos.find((m) => m.el === v && !v.hidden) : null;
    }

    function ventanaDe(m) {
        const def = MODULOS[m.tipo];
        m.w = m.w || def.w;
        m.h = m.h || def.h;
        m.x = Math.max(0, m.x || 0);
        m.y = Math.max(0, m.y || 0);
        const v = crear("div", "master-ventana oc-hoja-caja");
        v.setAttribute("role", "region");
        v.hidden = !!m.grupo && !m.delante;
        const cabeza = crear("div", "recent-entries-header master-ventana-barra");
        // Que no le monte encima su mando ventanas-plegables.js (taparía
        // los ✎ − ✕ y estas ya se pliegan con su −).
        cabeza.dataset.ventanaLista = "si";
        const titulo = crear("h2", "oc-hoja-titulo master-ventana-titulo");
        const idTitulo = "master-titulo-" + m.id;
        titulo.id = idTitulo;
        v.setAttribute("aria-labelledby", idTitulo);
        const em = crear("span", "oc-hoja-emoji", def.emoji);
        em.setAttribute("aria-hidden", "true");
        // El nombre es un botón que pliega y despliega la ventana (como en
        // el resto de la web).
        const nombre = botonDe("master-ventana-nombre", m.titulo || def.nombre, () => {
            if (v.dataset.recienMovida) {
                delete v.dataset.recienMovida;
                return;
            }
            plegar.click();
        });
        titulo.append(em, nombre);
        nombre.title = "Clic: plegar o desplegar · mantener pulsado: moverla · flechas: moverla (con Alt, el tamaño)";
        // Con el teclado, las flechas en su nombre la mueven (con Mayús,
        // más deprisa; con Alt, cambian su tamaño).
        nombre.addEventListener("keydown", (e) => moverConTeclas(m, e));
        const pintarPlegado = () => {
            cuerpo.hidden = !!m.plegado;
            plegar.textContent = m.plegado ? "+" : "−";
            plegar.setAttribute("aria-expanded", m.plegado ? "false" : "true");
            nombre.setAttribute("aria-expanded", m.plegado ? "false" : "true");
            v.classList.toggle("es-plegada", !!m.plegado);
        };
        m.pintarPlegado = pintarPlegado;
        const plegar = botonDe("master-ventana-mando", m.plegado ? "+" : "−", () => {
            m.plegado = !m.plegado;
            // En un grupo, todas a la vez.
            delGrupo(m).forEach((x) => {
                x.plegado = m.plegado;
                if (x.pintarPlegado) {
                    x.pintarPlegado();
                }
            });
            colocar(m);
            crecerLienzo();
            guardar();
        }, "Plegar o desplegar");
        plegar.setAttribute("aria-expanded", m.plegado ? "false" : "true");
        nombre.setAttribute("aria-expanded", m.plegado ? "false" : "true");
        const quitar = botonDe("master-ventana-mando", "✕", () => {
            const resto = delGrupo(m).filter((x) => x !== m);
            estado.modulos = estado.modulos.filter((x) => x !== m);
            v.remove();
            if (m.grupo) {
                // Las que quedan del grupo: la siguiente, delante (y si
                // sólo queda una, sola).
                if (resto.length === 1) {
                    delete resto[0].grupo;
                    delete resto[0].delante;
                } else {
                    resto[0].delante = true;
                }
                resto.forEach((x) => {
                    x.el = null;
                });
                pintarTodo();
            }
            guardar();
            avisar("Quitado: " + (m.titulo || def.nombre) + ".");
            const sigue = resto[0] && resto[0].el;
            (sigue ? focoDe(resto[0]) : botonAnadir).focus();
        }, "Quitar esta ventana");
        const cambiar = botonDe("master-ventana-mando", "✎", () => personalizar(m, cambiar),
            "Opciones: título, color y tamaño del contenido");
        cambiar.title = "Título, color y tamaño del contenido";
        cambiar.setAttribute("aria-haspopup", "dialog");
        const mandos = crear("div", "master-ventana-mandos");
        mandos.append(cambiar, plegar, quitar);
        cabeza.append(titulo, mandos);
        // EN UN GRUPO: las pestañas son la barra (una por ventana; la de
        // ahora, con su nombre; las demás, sólo el icono). Pulsar otra la
        // trae delante (y la de ahora, la pliega); con las flechas, Inicio
        // y Fin se va de una a otra (con Mayús + flechas se mueve el grupo,
        // con Alt + Mayús, su tamaño). Mantener pulsada una y sacarla de
        // la barra la separa (y soltarla sobre otra ventana, la junta con
        // esa).
        if (m.grupo) {
            cabeza.classList.add("es-grupo");
            titulo.classList.add("visually-hidden");
            titulo.replaceChildren(document.createTextNode(nombreDeVentana(m)));
            const tiras = crear("div", "master-grupo-pestanas");
            tiras.setAttribute("role", "tablist");
            tiras.setAttribute("aria-label", "Ventanas juntas");
            const juntas = delGrupo(m);
            juntas.forEach((x, i) => {
                const d = MODULOS[x.tipo];
                const ahora = x === m;
                const t = botonDe("master-grupo-pestana", "", () => {
                    if (pestanaSoltada) {
                        return;
                    }
                    if (ahora) {
                        plegar.click();
                    } else {
                        verEnGrupo(x, true);
                    }
                });
                const e2 = crear("span", "master-grupo-emoji", d.emoji);
                e2.setAttribute("aria-hidden", "true");
                t.append(e2, crear("span", "master-grupo-nombre", nombreDeVentana(x)));
                t.title = nombreDeVentana(x) + (ahora ? " (clic: plegar; mantener y sacar: separarla)" : " (mantener y sacar: separarla)");
                t.setAttribute("role", "tab");
                // El nombre entero, también en las que sólo enseñan el icono.
                t.setAttribute("aria-label", nombreDeVentana(x));
                t.setAttribute("aria-selected", ahora ? "true" : "false");
                t.setAttribute("aria-controls", "master-cuerpo-" + x.id);
                t.tabIndex = ahora ? 0 : -1;
                if (x.color) {
                    t.classList.add("con-color");
                    t.style.setProperty("--pestana-color", hexDe(x.color));
                    t.style.setProperty("--pestana-tinta", tintaDe(hexDe(x.color)));
                }
                t.addEventListener("keydown", (ev) => {
                    if (ev.shiftKey && moverConTeclas(m, ev)) {
                        return;
                    }
                    const paso = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: juntas.length - 1 - i }[ev.key];
                    if (paso === undefined) {
                        return;
                    }
                    ev.preventDefault();
                    verEnGrupo(juntas[(i + paso + juntas.length) % juntas.length], true);
                });
                t.addEventListener("pointerdown", (ev) => cogerDelGrupo(ev, t, x, v, cabeza));
                tiras.appendChild(t);
            });
            cabeza.insertBefore(tiras, mandos);
            // Si no caben con su nombre, las de detrás, sólo con el icono.
            const ajustar = () => {
                tiras.classList.remove("es-apretadas");
                if (tiras.scrollWidth > tiras.clientWidth + 1) {
                    tiras.classList.add("es-apretadas");
                }
            };
            if (window.ResizeObserver) {
                new ResizeObserver(ajustar).observe(tiras);
            }
            requestAnimationFrame(ajustar);
        }
        const cuerpo = crear("div", "oc-hoja-dentro master-ventana-cuerpo");
        cuerpo.id = "master-cuerpo-" + m.id;
        nombre.setAttribute("aria-controls", cuerpo.id);
        plegar.setAttribute("aria-controls", cuerpo.id);
        cuerpo.hidden = !!m.plegado;
        m.cuerpo = cuerpo;
        ponerEscala(m);
        v.classList.toggle("es-plegada", !!m.plegado);
        // El tamaño, por la esquina de abajo a la derecha: con el ratón, el
        // dedo o el lápiz (en las tabletas no vale el «resize» de CSS).
        const esquina = crear("span", "master-ventana-tamano");
        esquina.setAttribute("aria-hidden", "true");
        esquina.title = "Arrastra para cambiar el tamaño";
        esquina.addEventListener("pointerdown", (e) => {
            if (enMovil.matches || m.plegado || e.button > 0) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            alFrente(m);
            const w0 = v.offsetWidth;
            const h0 = v.offsetHeight;
            v.classList.add("es-arrastrada");
            arrastrar(e, esquina, (dx, dy) => {
                m.w = Math.max(240, Math.min(anchoLienzo() - m.x - 4, Math.round(w0 + dx)));
                m.h = Math.max(120, Math.round(h0 + dy));
                colocar(m);
            }, () => v.classList.remove("es-arrastrada"));
        });
        v.append(cabeza, cuerpo, esquina);
        m.el = v;
        ponerColor(m);
        // LA BARRA: un clic la pliega o despliega; mantenerla pulsada un
        // momento (ESPERA_COGER) la coge (reborde a rayas) y se mueve
        // hasta soltar. Si el puntero se va antes, no pasa nada.
        cabeza.addEventListener("pointerdown", (e) => {
            if (enMovil.matches || e.button > 0 || e.target.closest(".master-ventana-mandos, .master-grupo-pestana")) {
                return;
            }
            alFrente(m);
            const x0 = e.clientX;
            const y0 = e.clientY;
            const quieto = (ev) => {
                if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 8) {
                    dejar();
                }
            };
            const dejar = () => {
                clearTimeout(reloj);
                document.removeEventListener("pointermove", quieto);
                document.removeEventListener("pointerup", dejar);
                document.removeEventListener("pointercancel", dejar);
            };
            const reloj = setTimeout(() => {
                dejar();
                const mx = m.x;
                const my = m.y;
                v.dataset.recienMovida = "si";
                v.classList.add("es-arrastrada", "es-cogida");
                // Soltarla sobre la barra de otra: se juntan en pestañas
                // (la de debajo se marca mientras).
                let destino = null;
                const marcar = (d) => {
                    if (destino && destino.el) {
                        destino.el.classList.remove("es-destino");
                    }
                    destino = d;
                    if (destino) {
                        destino.el.classList.add("es-destino");
                    }
                };
                arrastrar(e, cabeza, (dx, dy, ev) => {
                    m.x = Math.min(topeX(m), Math.max(0, mx + dx));
                    m.y = Math.max(0, my + dy);
                    colocar(m);
                    const d = ventanaBajo(ev.clientX, ev.clientY, v);
                    if (d !== destino && !(d && m.grupo && d.grupo === m.grupo)) {
                        marcar(d);
                    }
                }, () => {
                    v.classList.remove("es-arrastrada", "es-cogida");
                    setTimeout(() => delete v.dataset.recienMovida, 0);
                    if (destino) {
                        const d = destino;
                        marcar(null);
                        agrupar(m, d);
                    }
                });
            }, ESPERA_COGER);
            document.addEventListener("pointermove", quieto);
            document.addEventListener("pointerup", dejar);
            document.addEventListener("pointercancel", dejar);
        });
        // Un clic en la barra (fuera de sus botones) también la pliega.
        cabeza.addEventListener("click", (e) => {
            if (e.target.closest("button")) {
                return;
            }
            if (v.dataset.recienMovida) {
                delete v.dataset.recienMovida;
                return;
            }
            plegar.click();
        });
        // Que mantener el dedo no saque el menú del sistema.
        cabeza.addEventListener("contextmenu", (e) => {
            if (!enMovil.matches) {
                e.preventDefault();
            }
        });
        v.addEventListener("pointerdown", () => alFrente(m));
        colocar(m);
        def.montar(cuerpo, m);
        return v;
    }

    // El lienzo, tan alto como lo que tiene más un margen holgado (para
    // que haya sitio donde soltar sin que salte). «soloCrecer»: mientras
    // se arrastra, crece pero no encoge; al soltar, encoge despacio (con
    // la transición del CSS).
    function crecerLienzo(soloCrecer) {
        if (enMovil.matches) {
            lienzo.style.height = "";
            return;
        }
        const fondo = Math.max(480, ...estado.modulos.map((m) => m.y + (m.plegado ? 60 : m.h) + 240));
        const ahora = parseInt(lienzo.style.height, 10) || 0;
        if (!soloCrecer || fondo > ahora) {
            lienzo.style.height = fondo + "px";
        }
    }

    // Lo que hace scroll alrededor del lienzo (la página o su caja).
    function scrollDe(el) {
        for (let p = el.parentElement; p; p = p.parentElement) {
            const o = getComputedStyle(p).overflowY;
            if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) {
                return p;
            }
        }
        return document.scrollingElement || document.documentElement;
    }

    // ARRASTRAR (mover o cambiar el tamaño): sigue al puntero con
    // requestAnimationFrame (un cambio por fotograma, sin tirones), hace
    // scroll solo cerca del borde de arriba o de abajo y va agrandando el
    // lienzo. «alMover(dx, dy)» recibe lo movido desde el principio
    // (contando el scroll).
    function arrastrar(e, origen, alMover, alSoltar) {
        const caja = scrollDe(lienzo);
        const esPagina = caja === document.scrollingElement || caja === document.documentElement;
        const scroll0 = caja.scrollTop;
        const x0 = e.clientX;
        const y0 = e.clientY;
        let ultimo = e;
        let pendiente = 0;
        let vivo = true;
        try {
            origen.setPointerCapture(e.pointerId);
        } catch (err) {
            // Sin captura: siguen llegando al documento.
        }
        const paso = () => {
            pendiente = 0;
            if (!vivo) {
                return;
            }
            // Cerca del borde de la caja que hace scroll, se desliza.
            const r = esPagina ? { top: 0, bottom: window.innerHeight } : caja.getBoundingClientRect();
            const margen = 48;
            let velocidad = 0;
            if (ultimo.clientY > r.bottom - margen) {
                velocidad = Math.ceil((ultimo.clientY - (r.bottom - margen)) / 4);
            } else if (ultimo.clientY < r.top + margen && caja.scrollTop > 0) {
                velocidad = -Math.ceil(((r.top + margen) - ultimo.clientY) / 4);
            }
            if (velocidad) {
                caja.scrollTop += velocidad;
            }
            // Lo movido en la pantalla, en píxeles del lienzo (con el zoom).
            const z = zoomAhora();
            alMover(Math.round((ultimo.clientX - x0) / z), Math.round((ultimo.clientY - y0 + caja.scrollTop - scroll0) / z), ultimo);
            crecerLienzo(true);
            if (velocidad) {
                pendiente = requestAnimationFrame(paso);
            }
        };
        const mover = (ev) => {
            ultimo = ev;
            if (!pendiente) {
                pendiente = requestAnimationFrame(paso);
            }
        };
        const soltar = () => {
            vivo = false;
            cancelAnimationFrame(pendiente);
            document.removeEventListener("pointermove", mover);
            document.removeEventListener("pointerup", soltar);
            document.removeEventListener("pointercancel", soltar);
            alSoltar(ultimo);
            crecerLienzo();
            guardar();
        };
        document.addEventListener("pointermove", mover);
        document.addEventListener("pointerup", soltar);
        document.addEventListener("pointercancel", soltar);
    }

    function pintarTodo() {
        // En el móvil, en orden de lectura (de arriba abajo y de izquierda
        // a derecha); en el ordenador, también (así el tabulador va igual).
        const orden = estado.modulos.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
        lienzo.replaceChildren(...orden.map((m) => m.el || ventanaDe(m)));
        orden.forEach(colocar);
        crecerLienzo();
    }

    // ---- EL BUSCADOR DE ARRIBA: busca a la vez en los conjuros, los
    // monstruos, las reglas (las del SRD y las propias) y los objetos; lo
    // elegido se abre en su ventana, con «📌 al tablero». Es un combobox:
    // con las flechas se va por los resultados e Intro abre. ----
    let indice = null;
    // Si cambia lo tuyo, el índice se vuelve a hacer.
    document.addEventListener("master:propios", () => {
        indice = null;
    });

    function cargarIndice() {
        if (!indice) {
            indice = Promise.all([pedir(CONJUROS_SRD), pedir("datos/personajes/compendio/bestiario.json"),
                pedir("datos/personajes/reglas-dnd.json"), pedir("datos/personajes/compendio/tienda.json"),
                pedir(RASGOS_SRD).catch(() => ({ rasgos: [] }))])
                .then(([conj, best, reg, tienda, ras]) => {
                    const cosas = [];
                    const deRasgos = [];
                    const vistos = new Set();
                    (ras.rasgos || []).filter((r) => {
                        const k = llano(r.nombre);
                        const ya = vistos.has(k) && !r.propio;
                        vistos.add(k);
                        return !ya;
                    }).forEach((r) => deRasgos.push({ tipo: "rasgo", emoji: "⭐", nombre: r.nombre,
                        detalle: datosRasgo(r).join(" · ") + (r.propio ? " · 🛠️ tuyo" : ""), buscar: llano(r.nombre + " " + r.en),
                        abrir: (v) => abrirRasgo(r, v, ras.fuente) }));
                    (conj.conjuros || []).forEach((c) => cosas.push({ tipo: "conjuro", emoji: "✨", nombre: c.nombre,
                        detalle: nivelDe(c) + " · " + c.escuela + (c.propio ? " · 🛠️ tuyo" : ""), buscar: llano(c.nombre + " " + c.en),
                        abrir: (v) => abrirConjuro(c, v, conj.fuente) }));
                    (best.monstruos || []).forEach((b) => cosas.push({ tipo: "monstruo", emoji: tokenDe(b).textContent, nombre: b.nombre,
                        detalle: "VD " + b.cr + " · " + b.tipo + (b.propio ? " · 🛠️ tuyo" : ""), buscar: llano(b.nombre + " " + b.en),
                        abrir: (v) => abrirBicho(b, v, best.fuente) }));
                    (reg.reglas || []).forEach((r) => cosas.push({ tipo: "regla", emoji: r.icono || "📚", nombre: r.nombre,
                        detalle: "Regla · " + r.grupo, buscar: llano(r.nombre + " " + (r.alias || "")),
                        abrir: (v) => abrirRegla(r, v, reg.fuente) }));
                    (tienda.objetos || []).forEach((o) => cosas.push({ tipo: "objeto", emoji: "💰", nombre: o.nombre,
                        detalle: "Objeto · " + o.cat + (o.rareza ? " · " + o.rareza : "") + (o.propio ? " · 🛠️ tuyo" : ""), buscar: llano(o.nombre + " " + o.en),
                        abrir: (v) => abrirObjeto(o, v, tienda.fuente) }));
                    return cosas.concat(deRasgos);
                });
        }
        return indice;
    }

    function montarBuscador() {
        const caja = crear("div", "master-buscador");
        caja.setAttribute("role", "search");
        const et = crear("label", "visually-hidden", "Buscar conjuros, monstruos, reglas, objetos, rasgos o dotes");
        const input = crear("input", "master-buscador-texto");
        input.type = "search";
        input.id = "master-buscador";
        input.placeholder = "buscar: bola de fuego, goblin, derribado…";
        input.autocomplete = "off";
        input.setAttribute("role", "combobox");
        input.setAttribute("aria-autocomplete", "list");
        input.setAttribute("aria-expanded", "false");
        input.setAttribute("aria-controls", "master-buscador-lista");
        et.htmlFor = input.id;
        const lista = crear("ul", "master-buscador-lista");
        lista.id = "master-buscador-lista";
        lista.setAttribute("role", "listbox");
        lista.setAttribute("aria-label", "Resultados");
        lista.hidden = true;
        const cuantos = crear("p", "visually-hidden");
        cuantos.setAttribute("role", "status");
        let salen = [];
        let activo = -1;
        const cerrarLista = () => {
            lista.hidden = true;
            input.setAttribute("aria-expanded", "false");
            input.removeAttribute("aria-activedescendant");
            activo = -1;
        };
        const marcar = (i) => {
            activo = i;
            lista.querySelectorAll("[role=option]").forEach((o, j) => o.setAttribute("aria-selected", j === i ? "true" : "false"));
            const o = lista.querySelectorAll("[role=option]")[i];
            if (o) {
                input.setAttribute("aria-activedescendant", o.id);
                o.scrollIntoView({ block: "nearest" });
            }
        };
        const abrir = (x) => {
            cerrarLista();
            x.abrir(input);
        };
        let espera = 0;
        const buscar = () => {
            const q = llano(input.value.trim());
            if (q.length < 2) {
                cerrarLista();
                cuantos.textContent = "";
                return;
            }
            cargarIndice().then((cosas) => {
                const propias = leerHomebrew().map((r) => ({ tipo: "propia", emoji: r.icono || "🏠", nombre: r.nombre,
                    detalle: "Regla propia", buscar: llano(r.nombre),
                    abrir: (v) => abrirRegla(Object.assign({ propia: true, grupo: "🏠 Reglas propias" }, r), v) }));
                const otras = leerPropios().otros.map((x) => ({ tipo: "otro", emoji: "📜", nombre: x.nombre,
                    detalle: x.cat + " · 🛠️ tuyo", buscar: llano(x.nombre + " " + x.cat), abrir: (v) => abrirOtro(x, v) }));
                const todas = propias.concat(otras, cosas);
                // Primero lo que empieza por lo buscado; luego lo que lo lleva.
                const empieza = todas.filter((x) => x.buscar.startsWith(q));
                const lleva = todas.filter((x) => !x.buscar.startsWith(q) && x.buscar.includes(q));
                salen = empieza.concat(lleva).slice(0, 12);
                lista.replaceChildren(...salen.map((x, i) => {
                    const li = crear("li", "master-buscador-opcion");
                    li.id = "master-buscador-o" + i;
                    li.setAttribute("role", "option");
                    li.setAttribute("aria-selected", "false");
                    const em = crear("span", "master-buscador-emoji", x.emoji);
                    em.setAttribute("aria-hidden", "true");
                    li.append(em, crear("span", "master-buscador-nombre", x.nombre), crear("span", "master-buscador-detalle",
                        x.detalle));
                    li.addEventListener("mousedown", (e) => e.preventDefault());
                    li.addEventListener("click", () => abrir(x));
                    return li;
                }));
                if (!salen.length) {
                    const li = crear("li", "master-buscador-nada", "Nada con eso.");
                    lista.appendChild(li);
                }
                lista.hidden = false;
                input.setAttribute("aria-expanded", "true");
                activo = -1;
                cuantos.textContent = salen.length ? salen.length + (salen.length === 1 ? " resultado" : " resultados")
                    + "; con las flechas se elige" : "Nada con eso.";
            });
        };
        input.addEventListener("input", () => {
            clearTimeout(espera);
            espera = setTimeout(buscar, 120);
        });
        input.addEventListener("focus", () => cargarIndice());
        input.addEventListener("keydown", (e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                if (lista.hidden || !salen.length) {
                    return;
                }
                e.preventDefault();
                marcar((activo + (e.key === "ArrowDown" ? 1 : -1) + salen.length) % salen.length);
            } else if (e.key === "Enter") {
                if (salen.length && !lista.hidden) {
                    e.preventDefault();
                    abrir(salen[Math.max(0, activo)]);
                }
            } else if (e.key === "Escape" && !lista.hidden) {
                e.preventDefault();
                e.stopPropagation();
                cerrarLista();
            }
        });
        input.addEventListener("blur", () => setTimeout(cerrarLista, 150));
        caja.append(et, input, lista, cuantos);
        return caja;
    }

    // ---- EL BOTÓN DE AÑADIR (y el de los dados, que pone personajes.js).
    // Su ventana tiene también «ordenar» y «quitar todas». ----
    let pestanaAnadir = 0;
    const botonAnadir = botonDe("oc-vida-accion es-principal", "＋ añadir", () => {
        const cuerpo = crear("div", "master-anadir");
        // Un filtro arriba y las ventanas por grupos, como tarjetas con su
        // dibujo, su nombre y para qué son.
        const etFiltro = crear("label", "oc-dados-etiqueta", "filtrar");
        const filtro = crear("input", "oc-dados-texto");
        filtro.type = "search";
        filtro.id = "master-anadir-filtro";
        filtro.placeholder = "dados, monstruos, nombres…";
        filtro.autocomplete = "off";
        etFiltro.htmlFor = filtro.id;
        const cuantas = crear("p", "visually-hidden");
        cuantas.setAttribute("role", "status");
        cuerpo.append(etFiltro, filtro, cuantas);
        const tarjetas = [];
        // Una pestaña por grupo (como un navegador) y «⚙️ más» (ordenar,
        // quitar todas, exportar e importar). Al filtrar, salen todas las
        // que valen, de todos los grupos, sin pestañas.
        const paneles = GRUPOS.map(([grupo, titulo]) => {
            const seccion = crear("div", "master-anadir-grupo");
            const lista = crear("ul", "master-anadir-lista");
            lista.setAttribute("aria-label", titulo);
            Object.keys(MODULOS).filter((tipo) => MODULOS[tipo].grupo === grupo).forEach((tipo) => {
                const def = MODULOS[tipo];
                const ya = def.unico && estado.modulos.some((m) => m.tipo === tipo);
                const li = crear("li");
                const b = botonDe("master-anadir-tarjeta", "", () => {
                    cerrar();
                    anadir(tipo);
                });
                const em = crear("span", "master-anadir-emoji", def.emoji);
                em.setAttribute("aria-hidden", "true");
                const nombre = crear("span", "master-anadir-nombre", def.nombre);
                const desc = crear("span", "master-anadir-desc", ya ? "Ya está en el tablero." : def.desc);
                b.append(em, nombre, desc);
                b.disabled = ya;
                li.appendChild(b);
                lista.appendChild(li);
                tarjetas.push({ li, seccion, b, nombre: llano(def.nombre), texto: llano(def.nombre + " " + def.desc + " " + titulo) });
            });
            seccion.appendChild(lista);
            return [titulo, seccion];
        });
        const { lista: pestanasAnadir, elegir: elegirAnadir } = pestanasDe(paneles, "Grupos de ventanas", "master-anadir",
            (i) => {
                pestanaAnadir = i;
            });
        cuerpo.appendChild(pestanasAnadir);
        paneles.forEach(([, x]) => cuerpo.appendChild(x));
        filtro.addEventListener("input", () => {
            const q = llano(filtro.value.trim());
            let n = 0;
            tarjetas.forEach((t) => {
                t.li.hidden = !!q && !t.texto.includes(q);
                n += t.li.hidden ? 0 : 1;
            });
            cuantas.textContent = q ? (n ? n + (n === 1 ? " ventana" : " ventanas") : "Ninguna con eso.") : "";
            // Filtrando: todos los grupos a la vista, sin pestañas.
            pestanasAnadir.hidden = !!q;
            if (q) {
                paneles.forEach(([, x]) => {
                    x.hidden = !x.querySelector("li:not([hidden])");
                });
            } else {
                elegirAnadir(pestanaAnadir, false);
            }
        });
        filtro.addEventListener("keydown", (e) => {
            // Intro: la primera que queda, mejor una que lo tenga en el
            // nombre («botín» es el botín, no el conversor que lo reparte).
            if (e.key === "Enter") {
                const q = llano(filtro.value.trim());
                const quedan = tarjetas.filter((t) => !t.li.hidden && !t.seccion.hidden && !t.b.disabled);
                const t = quedan.find((x) => q && x.nombre.includes(q)) || quedan[0];
                const b = t && t.b;
                if (b) {
                    e.preventDefault();
                    b.click();
                }
            }
        });
        elegirAnadir(Math.min(pestanaAnadir, paneles.length - 1), false);
        const cerrar = window.ocVentana.abrir({ titulo: "añadir una ventana", cuerpo, vuelta: botonAnadir, foco: filtro,
            clase: "es-ancha" });
    });
    botonAnadir.setAttribute("aria-haspopup", "dialog");

    // ---- EXPORTAR E IMPORTAR: todo lo de la pantalla de máster (los
    // perfiles con sus ventanas, la iniciativa, las marcas propias y las
    // tiradas guardadas) a un archivo .json, y de vuelta. Para guardarlo,
    // pasarlo a otro navegador o compartir un tablero montado. ----
    const CLAVES = (k) => k === CLAVE || k === CLAVE_HOMEBREW || k === CLAVE_IMAGENES || k === CLAVE_PLANTILLAS || k === CLAVE_PROPIOS || k === CLAVE_ASPECTOS || k === CLAVE_TABLAS || /^richi-oc-(iniciativa|marcas|partida-pantalla-master)/.test(k);

    function copias(alTerminar) {
        const caja = crear("div", "master-anadir-otras");
        const exportar = botonDe("oc-vida-accion", "⬇ exportar", () => {
            guardar();
            const claves = {};
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (CLAVES(k)) {
                        claves[k] = localStorage.getItem(k);
                    }
                }
            } catch (e) {
                avisar("Este navegador no deja leer lo guardado.");
                return;
            }
            const datos = { pantallaDeMaster: 1, fecha: new Date().toISOString(), claves };
            // Con los archivos de los documentos (imágenes y PDF), en «data:».
            todosLosArchivos().catch(() => []).then((lista) => Promise.all(lista.filter(([, b]) => b)
                .map(([id, b]) => blobADatos(b).then((x) => [id, x])))).then((lista) => {
                if (lista.length) {
                    datos.archivos = {};
                    lista.forEach(([id, x]) => {
                        datos.archivos[id] = x;
                    });
                }
                const a = crear("a");
                // Una dirección blob: que hace el propio navegador con el archivo.
                const archivoBlob = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 1)], { type: "application/json" }));
                a.href = archivoBlob;
                a.download = "pantalla-de-master-" + new Date().toISOString().slice(0, 10) + ".json";
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(archivoBlob), 1000);
                avisar("Exportado: " + a.download + (lista.length ? " (con " + lista.length + " archivos)." : "."));
            });
        }, "Exportar todo a un archivo");
        exportar.title = "Guarda los perfiles, sus ventanas y la iniciativa en un archivo .json";
        const archivo = crear("input");
        archivo.type = "file";
        archivo.accept = ".json,application/json";
        archivo.hidden = true;
        let seguro = false;
        const importar = botonDe("oc-vida-accion", "⬆ importar", () => {
            if (!seguro) {
                seguro = true;
                importar.textContent = "⬆ ¿reemplazar todo? pulsa otra vez";
                return;
            }
            archivo.click();
        }, "Importar desde un archivo (reemplaza lo de ahora)");
        importar.title = "Carga un archivo exportado; reemplaza lo que hay ahora";
        archivo.addEventListener("change", () => {
            const f = archivo.files && archivo.files[0];
            if (!f) {
                return;
            }
            f.text().then((texto) => {
                const datos = JSON.parse(texto);
                if (!datos || datos.pantallaDeMaster !== 1 || typeof datos.claves !== "object") {
                    throw new Error("no es");
                }
                Object.keys(datos.claves).filter(CLAVES).forEach((k) => {
                    localStorage.setItem(k, String(datos.claves[k]));
                });
                const archivos = datos.archivos && typeof datos.archivos === "object" ? Object.keys(datos.archivos) : [];
                return Promise.all(archivos.map((id) => {
                    const blob = /^a[a-z0-9]+$/.test(id) ? datosABlob(datos.archivos[id]) : null;
                    return blob ? archivoGuardar(id, blob).catch(() => {}) : null;
                })).then(() => (window.ocAlmacen ? window.ocAlmacen.guardarYa() : null)).then(() => {
                    alTerminar();
                    location.reload();
                });
            }).catch(() => {
                avisar("Ese archivo no es una exportación de la pantalla de máster.");
                importar.textContent = "⬆ importar";
                seguro = false;
            });
        });
        caja.append(exportar, importar, archivo);
        return caja;
    }

    function anadir(tipo, extra) {
        const def = MODULOS[tipo];
        const w = (extra && extra.w) || def.w;
        const h = (extra && extra.h) || def.h;
        const sitio = enMovil.matches ? { x: 0, y: 0 } : hueco(w, h);
        const m = Object.assign({ id: "m" + siguienteId++, tipo, x: sitio.x, y: sitio.y, w, h }, extra || {});
        estado.modulos.push(m);
        pintarTodo();
        guardar();
        alFrente(m);
        m.el.scrollIntoView({ block: "nearest" });
        const primero = m.el.querySelector(".master-ventana-cuerpo button, .master-ventana-cuerpo input, .master-ventana-cuerpo textarea")
            || m.el.querySelector(".master-ventana-nombre");
        primero.focus();
        avisar("Añadido: " + (m.titulo || def.nombre) + ".");
    }

    // EL PRIMER HUECO LIBRE para una ventana de w × h: empezando por lo
    // que se ve ahora del lienzo (de arriba abajo y de izquierda a
    // derecha), sin pisar ninguna; si no cabe en ningún sitio, debajo de
    // todo. Así añadir no estira el lienzo si hay sitio.
    function hueco(w, h) {
        const ancho = Math.max(w, anchoLienzo() - 4);
        const ocupado = estado.modulos.map((m) => ({ x: m.x, y: m.y, w: m.w, h: m.plegado ? 60 : m.h }));
        const libre = (x, y) => ocupado.every((o) => x + w + 16 <= o.x || o.x + o.w + 16 <= x || y + h + 16 <= o.y
            || o.y + o.h + 16 <= y);
        const fondo = ocupado.reduce((a, o) => Math.max(a, o.y + o.h), 0);
        const visto = Math.max(0, Math.round(-lienzo.getBoundingClientRect().top / zoomAhora() / 20) * 20);
        const filas = [];
        for (let y = visto; y <= fondo; y += 20) {
            filas.push(y);
        }
        for (let y = 0; y < visto; y += 20) {
            filas.push(y);
        }
        for (const y of filas) {
            for (let x = 0; x + w <= ancho; x += 20) {
                if (libre(x, y)) {
                    return { x, y };
                }
            }
        }
        return { x: 0, y: ocupado.length ? fondo + 20 : 0 };
    }

    // En filas, una al lado de otra hasta el ancho del lienzo.
    function ordenar() {
        const ancho = Math.max(400, anchoLienzo());
        let x = 0;
        let y = 0;
        let alto = 0;
        estado.modulos.filter((m) => !m.grupo || m.delante).forEach((m) => {
            if (x + m.w > ancho && x > 0) {
                x = 0;
                y += alto + 20;
                alto = 0;
            }
            m.x = x;
            m.y = y;
            x += m.w + 20;
            alto = Math.max(alto, m.plegado ? 60 : m.h);
            colocarGrupo(m);
        });
    }
    // Las de un grupo, donde la de delante (sin pintar).
    function colocarGrupo(m) {
        delGrupo(m).forEach((x) => {
            Object.assign(x, { x: m.x, y: m.y, w: m.w, h: m.h });
        });
    }

    // ---- LAS PESTAÑAS (los perfiles): cambiar de una a otra (también con
    // las flechas), «＋» para una nueva, ✎ para renombrar la de ahora y ✕
    // para cerrarla (pide pulsar dos veces; la última no se cierra). ----
    const pestanas = crear("div", "master-pestanas");
    const tablist = crear("div", "master-pestanas-lista");
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", "Perfiles de la pantalla de máster");
    lienzo.setAttribute("role", "tabpanel");

    // Los mandos del zoom (− 100 % +): el del medio lo deja en 100 %.
    const HAY_ZOOM = !!(window.CSS && CSS.supports && CSS.supports("zoom", "2"));
    const menosZoom = botonDe("master-pestana-mando", "－", () => pasoZoom(-1), "Alejar el tablero");
    const masZoom = botonDe("master-pestana-mando", "＋", () => pasoZoom(1), "Acercar el tablero");
    const botonZoom = botonDe("master-zoom-valor", "100 %", () => ponerZoom(1, true), "Dejar el zoom del tablero en 100 %");
    menosZoom.title = "Alejar (Ctrl + rueda)";
    masZoom.title = "Acercar (Ctrl + rueda)";
    botonZoom.title = "Volver al 100 %";
    // Ctrl + rueda (o el pellizco del panel táctil) sobre el tablero.
    lienzo.addEventListener("wheel", (e) => {
        if (!e.ctrlKey || !HAY_ZOOM || enMovil.matches) {
            return;
        }
        e.preventDefault();
        ponerZoom((estado.zoom || 1) * Math.exp(-e.deltaY * 0.002), false);
        clearTimeout(lienzo.esperaZoom);
        lienzo.esperaZoom = setTimeout(() => ponerZoom(estado.zoom, true), 300);
    }, { passive: false });
    // El pellizco con dos dedos en el fondo del tablero (en la tableta).
    const dedos = new Map();
    let pellizco = null;
    lienzo.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "touch" || e.target !== lienzo || !HAY_ZOOM || enMovil.matches) {
            return;
        }
        dedos.set(e.pointerId, [e.clientX, e.clientY]);
        if (dedos.size === 2) {
            const [a, b] = Array.from(dedos.values());
            pellizco = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: estado.zoom || 1 };
        }
    });
    lienzo.addEventListener("pointermove", (e) => {
        if (!dedos.has(e.pointerId)) {
            return;
        }
        dedos.set(e.pointerId, [e.clientX, e.clientY]);
        if (pellizco && dedos.size === 2) {
            const [a, b] = Array.from(dedos.values());
            ponerZoom(pellizco.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pellizco.d, false);
        }
    });
    const sinDedo = (e) => {
        if (dedos.delete(e.pointerId) && pellizco && dedos.size < 2) {
            pellizco = null;
            ponerZoom(estado.zoom, true);
        }
    };
    lienzo.addEventListener("pointerup", sinDedo);
    lienzo.addEventListener("pointercancel", sinDedo);

    function colorTablero() {
        const t = hexTablero(estado.color);
        lienzo.classList.toggle("con-tablero", !!t);
        if (t) {
            const claro = tintaDe(t) !== "#ffffff";
            lienzo.style.setProperty("--tablero", t);
            lienzo.style.setProperty("--tablero-raya", claro ? "rgba(0, 0, 0, 0.14)" : "rgba(255, 255, 255, 0.1)");
        } else {
            lienzo.style.removeProperty("--tablero");
            lienzo.style.removeProperty("--tablero-raya");
        }
        ponerZoom(estado.zoom || 1, false);
    }

    // Los niveles de zoom, y ponerlo (con aviso si lo ha pedido alguien).
    const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
    function ponerZoom(z, decirlo) {
        z = Math.min(2, Math.max(0.25, Math.round(z * 100) / 100));
        estado.zoom = z;
        lienzo.style.zoom = zoomAhora() === 1 ? "" : String(zoomAhora());
        if (botonZoom) {
            botonZoom.textContent = Math.round(z * 100) + " %";
            menosZoom.disabled = z <= ZOOMS[0];
            masZoom.disabled = z >= ZOOMS[ZOOMS.length - 1];
        }
        crecerLienzo();
        if (decirlo) {
            guardar();
            avisar("Zoom del tablero: " + Math.round(z * 100) + " %.");
        }
    }
    const pasoZoom = (sentido) => {
        const z = estado.zoom || 1;
        const sig = sentido > 0 ? ZOOMS.find((x) => x > z + 0.001) : ZOOMS.slice().reverse().find((x) => x < z - 0.001);
        ponerZoom(sig || z, true);
    };

    function activar(pf, foco) {
        // Las ventanas del que se deja se desmontan: al volver se montan
        // de nuevo con lo guardado (así la iniciativa o las notas de dos
        // perfiles nunca se pisan).
        estado.modulos.forEach((m) => {
            m.el = null;
        });
        estado = pf;
        guardar();
        colorTablero();
        pintarPestanas(foco);
        pintarTodo();
    }

    function pintarPestanas(foco) {
        tablist.replaceChildren(...todo.perfiles.map((pf, i) => {
            const b = botonDe("master-pestana", pf.nombre, () => {
                if (pestanaMovida) {
                    return;
                }
                if (pf !== estado) {
                    activar(pf, true);
                    avisar("Perfil: " + pf.nombre + ".");
                }
            });
            b.setAttribute("role", "tab");
            b.id = "master-pestana-" + pf.id;
            b.setAttribute("aria-controls", lienzo.id || (lienzo.id = "master-lienzo"));
            const activa = pf === estado;
            b.setAttribute("aria-selected", activa ? "true" : "false");
            b.tabIndex = activa ? 0 : -1;
            b.addEventListener("keydown", (e) => {
                // Alt + ← →: moverla de sitio.
                if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
                    e.preventDefault();
                    moverPestana(pf, e.key === "ArrowLeft" ? -1 : 1);
                    return;
                }
                if (e.key === "Delete") {
                    e.preventDefault();
                    cerrarPerfil(pf, b);
                    return;
                }
                const d = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: todo.perfiles.length - 1 - i }[e.key];
                if (d === undefined) {
                    return;
                }
                e.preventDefault();
                const otro = todo.perfiles[(i + d + todo.perfiles.length) % todo.perfiles.length];
                activar(otro, true);
            });
            b.addEventListener("dblclick", () => renombrar());
            b.addEventListener("pointerdown", (e) => cogerPestana(e, b));
            b.addEventListener("contextmenu", (e) => e.preventDefault());
            b.setAttribute("aria-keyshortcuts", "Delete");
            const hex = hexPestana(colorDePestana(pf));
            if (hex) {
                b.classList.add("con-color");
                b.style.setProperty("--pestana-color", hex);
                b.style.setProperty("--pestana-tinta", tintaDe(hex));
            }
            // Su ✕, para el ratón y el dedo (fuera del orden del tabulador y
            // escondida al lector: con el teclado, Supr en la pestaña).
            const x = crear("button", "master-pestana-cerrar", "✕");
            x.type = "button";
            x.tabIndex = -1;
            x.setAttribute("aria-hidden", "true");
            x.title = "Cerrar «" + pf.nombre + "» (pulsa dos veces)";
            x.hidden = todo.perfiles.length < 2;
            x.addEventListener("click", (e) => {
                e.stopPropagation();
                cerrarPerfil(pf, x);
            });
            const caja = crear("div", "master-pestana-caja" + (activa ? " es-elegida" : ""));
            caja.setAttribute("role", "none");
            caja.dataset.perfil = pf.id;
            caja.append(b, x);
            return caja;
        }));
        lienzo.setAttribute("aria-labelledby", "master-pestana-" + estado.id);
        const activa = tablist.querySelector(".es-elegida");
        // Que se vea la elegida (sin mover la página arriba y abajo).
        const izq = activa.offsetLeft - tablist.offsetLeft;
        if (izq < tablist.scrollLeft) {
            tablist.scrollLeft = izq;
        } else if (izq + activa.offsetWidth > tablist.scrollLeft + tablist.clientWidth) {
            tablist.scrollLeft = izq + activa.offsetWidth - tablist.clientWidth;
        }
        pintarFlechas();
        if (foco) {
            activa.querySelector("[role=tab]").focus();
        }
    }

    // MOVER LAS PESTAÑAS: mantener pulsada una (ESPERA_COGER) la coge
    // (reborde a rayas) y se arrastra a su sitio entre las demás (cerca
    // de los bordes, la fila se desliza); al soltar se queda ahí. Si el
    // puntero se va antes, no pasa nada (y soltar no cuenta como pulsar).
    // Con el teclado, Alt + ← →.
    let pestanaMovida = false;
    function moverPestana(pf, paso) {
        const i = todo.perfiles.indexOf(pf);
        const k = Math.max(0, Math.min(todo.perfiles.length - 1, i + paso));
        if (k === i) {
            return;
        }
        todo.perfiles.splice(i, 1);
        todo.perfiles.splice(k, 0, pf);
        guardar();
        pintarPestanas(false);
        document.getElementById("master-pestana-" + pf.id).focus();
        avisar(pf.nombre + ": pestaña " + (k + 1) + " de " + todo.perfiles.length + ".");
    }
    function cogerPestana(e, b) {
        if (e.button > 0 || todo.perfiles.length < 2) {
            return;
        }
        const x0 = e.clientX;
        const y0 = e.clientY;
        const quieto = (ev) => {
            if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 8) {
                dejar();
            }
        };
        const dejar = () => {
            clearTimeout(reloj);
            document.removeEventListener("pointermove", quieto);
            document.removeEventListener("pointerup", dejar);
            document.removeEventListener("pointercancel", dejar);
        };
        const reloj = setTimeout(() => {
            dejar();
            arrastrarPestana(e, b);
        }, ESPERA_COGER);
        document.addEventListener("pointermove", quieto);
        document.addEventListener("pointerup", dejar);
        document.addEventListener("pointercancel", dejar);
    }
    function arrastrarPestana(e, b) {
        try {
            b.setPointerCapture(e.pointerId);
        } catch (err) {
            // Sin captura: siguen llegando al documento.
        }
        pestanaMovida = true;
        b.classList.add("es-cogida");
        const yo = b.parentNode;
        let x = e.clientX;
        let rueda = 0;
        const colocarla = () => {
            const otras = Array.from(tablist.children).filter((o) => o !== yo);
            const antes = otras.find((o) => {
                const r = o.getBoundingClientRect();
                return x < r.left + r.width / 2;
            });
            if (antes) {
                if (yo.nextSibling !== antes) {
                    tablist.insertBefore(yo, antes);
                }
            } else if (tablist.lastChild !== yo) {
                tablist.appendChild(yo);
            }
        };
        // Cerca de los bordes de la fila, se desliza sola.
        const deslizar = () => {
            rueda = 0;
            const r = tablist.getBoundingClientRect();
            const v = x > r.right - 32 ? 8 : x < r.left + 32 ? -8 : 0;
            if (v && (v > 0 ? tablist.scrollLeft + tablist.clientWidth < tablist.scrollWidth : tablist.scrollLeft > 0)) {
                tablist.scrollLeft += v;
                colocarla();
                rueda = requestAnimationFrame(deslizar);
            }
        };
        const mover = (ev) => {
            x = ev.clientX;
            colocarla();
            if (!rueda) {
                rueda = requestAnimationFrame(deslizar);
            }
        };
        const soltar = () => {
            cancelAnimationFrame(rueda);
            document.removeEventListener("pointermove", mover);
            document.removeEventListener("pointerup", soltar);
            document.removeEventListener("pointercancel", soltar);
            b.classList.remove("es-cogida");
            const orden = Array.from(tablist.children).map((o) => o.dataset.perfil);
            const pf = todo.perfiles.find((x2) => x2.id === yo.dataset.perfil);
            todo.perfiles.sort((p1, p2) => orden.indexOf(p1.id) - orden.indexOf(p2.id));
            guardar();
            // Después del clic que viene con soltar (que no cuenta).
            setTimeout(() => {
                pestanaMovida = false;
                pintarPestanas(false);
                if (pf) {
                    avisar(pf.nombre + ": pestaña " + (todo.perfiles.indexOf(pf) + 1) + " de " + todo.perfiles.length + ".");
                }
            }, 0);
        };
        document.addEventListener("pointermove", mover);
        document.addEventListener("pointerup", soltar);
        document.addEventListener("pointercancel", soltar);
    }

    function renombrar() {
        const cuerpo = crear("form", "master-personalizar");
        const et = crear("label", "oc-dados-etiqueta", "nombre del perfil");
        // Dos colores, por separado: el de la pestaña y el del fondo del
        // tablero.
        const grupoPestana = muestrasDe("color de la pestaña", COLORES_PESTANA, colorDePestana(estado), "master-perfil-otro-pestana");
        const grupo = muestrasDe("color del fondo del tablero", TABLEROS, estado.color || "", "master-perfil-otro");
        const input = crear("input", "oc-dados-texto");
        input.id = "master-perfil-nombre";
        input.value = estado.nombre;
        input.maxLength = 30;
        input.autocomplete = "off";
        et.htmlFor = input.id;
        const listo = crear("button", "oc-vida-accion es-principal", "guardar");
        listo.type = "submit";
        const comoPlantilla = botonDe("oc-vida-accion", "💾 guardar como plantilla", () => {
            const lista = leerPlantillas();
            lista.push({ id: Date.now().toString(36), nombre: input.value.trim() || estado.nombre,
                ventanas: estado.modulos.map((x) => ({ tipo: x.tipo, x: x.x, y: x.y, w: x.w, h: x.h, titulo: x.titulo || "",
                    color: x.color || "", escala: x.escala || 1, plegado: !!x.plegado, grupo: x.grupo, delante: x.delante })) });
            guardarPlantillas(lista);
            avisar("Guardada la plantilla «" + (input.value.trim() || estado.nombre) + "»: sale al crear un perfil con ＋.");
        }, "Guardar las ventanas de este perfil como plantilla");
        comoPlantilla.title = "Las ventanas, donde están, sin lo que tienen dentro";
        const cerrarEsta = botonDe("oc-vida-accion", "🗑️ cerrar esta pestaña", () => {
            if (porCerrar !== estado) {
                cerrarEsta.textContent = "🗑️ ¿seguro? pulsa otra vez";
            } else {
                cerrar();
            }
            cerrarPerfil(estado, null);
        });
        cerrarEsta.disabled = todo.perfiles.length < 2;
        const botonesPerfil = crear("div", "master-notas-botones");
        botonesPerfil.append(listo, comoPlantilla, cerrarEsta);
        cuerpo.append(et, input, grupoPestana, grupo, botonesPerfil);
        cuerpo.addEventListener("submit", (e) => {
            e.preventDefault();
            estado.nombre = input.value.trim() || estado.nombre;
            estado.color = grupo.valor();
            estado.colorPestana = grupoPestana.valor();
            colorTablero();
            guardar();
            cerrar();
            pintarPestanas(true);
            avisar("Perfil: " + estado.nombre + ".");
        });
        const cerrar = window.ocVentana.abrir({ titulo: "nombre y colores de la pestaña", cuerpo, vuelta: botonRenombrar, foco: input });
    }

    // LAS PLANTILLAS DE PERFIL: las de aquí (unas ventanas que se ponen
    // ordenadas) y las propias («💾 guardar como plantilla» en el ✎ del
    // perfil: sus ventanas, donde estaban, sin lo que tienen dentro;
    // «richi-master-plantillas»).
    const PLANTILLAS = [["vacio", "⬜ vacío", "Sin ventanas.", -1]].concat(PERFILES_DE_SERIE.map(([nombre, color, , ventanas], i) =>
        ["serie" + i, nombre, ventanas.length + " ventanas, donde van" + (color ? " · tablero " +
            ((TABLEROS.find((t) => t[0] === color) || [])[1] || color) : "") + ".", i]));
    const leerPlantillas = () => {
        try {
            const x = JSON.parse(localStorage.getItem(CLAVE_PLANTILLAS) || "[]");
            return Array.isArray(x) ? x : [];
        } catch (e) {
            return [];
        }
    };
    const guardarPlantillas = (lista) => {
        try {
            localStorage.setItem(CLAVE_PLANTILLAS, JSON.stringify(lista));
        } catch (e) {
            avisar("No se ha podido guardar la plantilla.");
        }
    };

    function perfilNuevo() {
        const cuerpo = crear("form", "master-personalizar");
        const et = crear("label", "oc-dados-etiqueta", "nombre del perfil");
        const input = crear("input", "oc-dados-texto");
        input.id = "master-perfil-nuevo";
        input.value = "perfil " + (todo.perfiles.length + 1);
        input.maxLength = 30;
        input.autocomplete = "off";
        et.htmlFor = input.id;
        // Si no se le pone nombre, el de la plantilla.
        let nombreTocado = false;
        input.addEventListener("input", () => {
            nombreTocado = true;
        });
        const grupo = crear("fieldset", "master-plantillas");
        grupo.appendChild(crear("legend", "oc-dados-etiqueta", "con qué ventanas"));
        const propias = leerPlantillas();
        const opcion = (valor, nombre, desc, borrable) => {
            const caja = crear("div", "master-plantilla");
            const radio = crear("input");
            radio.type = "radio";
            radio.name = "master-plantilla";
            radio.value = valor;
            radio.id = "master-plantilla-" + valor;
            const lab = crear("label", "master-plantilla-texto");
            lab.htmlFor = radio.id;
            lab.append(crear("strong", "", nombre), crear("span", "", desc));
            caja.append(radio, lab);
            if (borrable) {
                const quitar = botonDe("master-nombre-boton", "✕", () => {
                    guardarPlantillas(leerPlantillas().filter((x) => x.id !== borrable));
                    caja.remove();
                    avisar("Plantilla quitada: " + nombre + ".");
                }, "Quitar la plantilla " + nombre);
                caja.appendChild(quitar);
            }
            grupo.appendChild(caja);
            return radio;
        };
        const radios = PLANTILLAS.map(([v, n, desc]) => opcion(v, n, desc));
        propias.forEach((pl) => radios.push(opcion("propia-" + pl.id, "💾 " + pl.nombre, pl.ventanas.length + " ventanas, donde las dejaste.",
            pl.id)));
        radios[0].checked = true;
        const listo = crear("button", "oc-vida-accion es-principal", "＋ crear");
        listo.type = "submit";
        cuerpo.append(et, input, grupo, listo);
        cuerpo.addEventListener("submit", (e) => {
            e.preventDefault();
            const elegida = (grupo.querySelector("input:checked") || radios[0]).value;
            const pf = { id: "p" + siguientePerfil++, nombre: input.value.trim() || "perfil " + (todo.perfiles.length + 1), modulos: [] };
            const propia = propias.find((x) => "propia-" + x.id === elegida);
            if (propia) {
                pf.modulos = propia.ventanas.filter((v) => MODULOS[v.tipo]).map((v) => Object.assign({}, v, { id: "m" + siguienteId++ }));
            } else {
                const pl = PLANTILLAS.find((x) => x[0] === elegida) || PLANTILLAS[0];
                if (pl[3] >= 0) {
                    const de = perfilesDeSerie()[pl[3]];
                    pf.modulos = de.modulos.map((m) => Object.assign(m, { id: "m" + siguienteId++ }));
                    pf.color = de.color;
                    pf.colorPestana = de.colorPestana;
                    if (!nombreTocado) {
                        pf.nombre = de.nombre;
                    }
                }
            }
            cerrar();
            todo.perfiles.push(pf);
            activar(pf, true);
            avisar("Perfil nuevo: " + pf.nombre + (pf.modulos.length ? ", con " + pf.modulos.length + " ventanas." : "."));
        });
        const cerrar = window.ocVentana.abrir({ titulo: "perfil nuevo", cuerpo, vuelta: botonNueva, foco: input });
    }

    const botonNueva = botonDe("master-pestana-mando", "＋", () => perfilNuevo(), "Perfil nuevo");
    botonNueva.title = "Perfil nuevo";
    const botonRenombrar = botonDe("master-pestana-mando", "✎", renombrar, "Nombre y colores de esta pestaña");
    botonRenombrar.title = "Nombre, color de la pestaña y fondo del tablero";
    botonRenombrar.setAttribute("aria-haspopup", "dialog");
    // CERRAR UNA PESTAÑA (la ✕ de cada una, Supr o «cerrar» en su ✎):
    // pide pulsar dos veces; la última no se cierra.
    let porCerrar = null;
    let esperaCerrar = 0;
    function cerrarPerfil(pf, quien) {
        if (todo.perfiles.length < 2) {
            avisar("Es la única pestaña: no se puede cerrar.");
            return;
        }
        if (porCerrar !== pf) {
            porCerrar = pf;
            if (quien) {
                quien.classList.add("es-seguro");
            }
            avisar("Pulsa otra vez para cerrar la pestaña " + pf.nombre + " y sus ventanas.");
            clearTimeout(esperaCerrar);
            esperaCerrar = setTimeout(() => {
                porCerrar = null;
                tablist.querySelectorAll(".es-seguro").forEach((x) => x.classList.remove("es-seguro"));
            }, 4000);
            return;
        }
        porCerrar = null;
        clearTimeout(esperaCerrar);
        const i = todo.perfiles.indexOf(pf);
        todo.perfiles.splice(i, 1);
        pf.modulos.forEach((m) => {
            m.el = null;
        });
        if (pf === estado) {
            estado = todo.perfiles[Math.max(0, i - 1)];
            colorTablero();
            pintarTodo();
        }
        guardar();
        pintarPestanas(true);
        avisar("Cerrada: " + pf.nombre + ".");
    }
    const mandosPestanas = crear("div", "master-pestanas-mandos");
    mandosPestanas.append(botonNueva, botonRenombrar);

    // LAS PESTAÑAS NO CRECEN SIN FIN: caben en un ancho fijo; si hay más,
    // se deslizan de lado con ‹ ›, y todo queda en una sola barra.
    const desliza = (s) => {
        const reducir = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        tablist.scrollBy({ left: s * Math.max(120, Math.round(tablist.clientWidth * 0.7)), behavior: reducir ? "auto" : "smooth" });
    };
    const flechaIzq = botonDe("master-pestana-mando master-pestanas-flecha", "‹", () => desliza(-1), "Ver las pestañas de la izquierda");
    const flechaDer = botonDe("master-pestana-mando master-pestanas-flecha", "›", () => desliza(1), "Ver las pestañas de la derecha");
    flechaIzq.title = "Pestañas de la izquierda";
    flechaDer.title = "Pestañas de la derecha";
    function pintarFlechas() {
        const sobra = tablist.scrollWidth > tablist.clientWidth + 1;
        flechaIzq.hidden = !sobra;
        flechaDer.hidden = !sobra;
        flechaIzq.disabled = tablist.scrollLeft <= 0;
        flechaDer.disabled = tablist.scrollLeft + tablist.clientWidth >= tablist.scrollWidth - 1;
    }
    tablist.addEventListener("scroll", pintarFlechas, { passive: true });
    if (window.ResizeObserver) {
        new ResizeObserver(pintarFlechas).observe(tablist);
    }
    const marco = crear("div", "master-pestanas-marco");
    marco.append(flechaIzq, tablist, flechaDer);

    // ---- LAS CAMPAÑAS: el botón de la izquierda del todo. Cada campaña
    // tiene sus pestañas, sus ventanas y su party (no se mezclan): se
    // cambia de una a otra, se crea una nueva, se renombra o se borra. ----
    const botonCampana = botonDe("master-campana", "", () => verCampanas());
    botonCampana.setAttribute("aria-haspopup", "dialog");
    botonCampana.setAttribute("aria-keyshortcuts", "C");
    function pintarCampana() {
        botonCampana.textContent = "📚";
        botonCampana.setAttribute("aria-label", "Campaña: " + todo.nombre + " (cambiar de campaña)");
        botonCampana.title = "Campaña: " + todo.nombre + " — cambiar, crear o renombrar";
    }
    function activarCampana(c) {
        estado.modulos.forEach((m) => {
            m.el = null;
        });
        todo = c;
        estado = c.perfiles.find((pf) => pf.id === c.activo) || c.perfiles[0];
        guardar();
        colorTablero();
        pintarCampana();
        pintarPestanas(false);
        pintarTodo();
        avisar("Campaña: " + c.nombre + ".");
    }
    // EL TABLERO DE TUTORIAL: unos post-its que explican las opciones. Va
    // el primero en cada campaña nueva (se puede quitar como cualquiera).
    const TUTORIAL = [
        ["👋 Bienvenida", "amarillo", "<p>Esto es tu <strong>pantalla de máster</strong>: un tablero con ventanas que pones, mueves y"
            + " quitas a tu gusto.</p><ul><li>Las <strong>pestañas de arriba</strong> son tus tableros (por ejemplo, uno para"
            + " combate y otro para la ciudad).</li><li>Cada ventana es una herramienta: la iniciativa, el bestiario, las"
            + " reglas, notas…</li><li>Este tablero es el tutorial: cuando ya no lo necesites, quítalo con <strong>✎</strong>"
            + " (arriba, junto a las pestañas).</li></ul>"],
        ["🪟 Las ventanas", "celeste", "<ul><li><strong>Toca la barra</strong> de una ventana para plegarla o desplegarla.</li>"
            + "<li><strong>Mantén pulsada la barra</strong> y arrastra para moverla.</li><li>La esquina de abajo a la derecha"
            + " cambia su <strong>tamaño</strong>.</li><li><strong>✎</strong> le cambia el nombre, el color y el tamaño de la"
            + " letra; <strong>−</strong> la pliega y <strong>✕</strong> la quita.</li><li>Suelta una ventana sobre la barra"
            + " de otra y se <strong>juntan en pestañas</strong>; ⇱ la vuelve a sacar.</li></ul>"],
        ["🗂️ Tableros y campañas", "verde", "<ul><li><strong>＋</strong> (junto a las pestañas) crea un tablero nuevo, vacío o"
            + " desde una plantilla; <strong>✎</strong> cambia el de ahora: nombre, colores o quitarlo.</li><li>Mantén pulsada"
            + " una pestaña para <strong>cambiarla de sitio</strong>.</li><li><strong>📚</strong> son tus campañas: cada una con"
            + " sus tableros, su party y sus documentos, sin mezclarse.</li></ul>"],
        ["🧰 Añadir herramientas", "naranja", "<p>El botón <strong>🧰</strong> (arriba a la izquierda) abre todas las"
            + " ventanas que puedes poner, por grupos:</p><ul><li><strong>combate</strong>: iniciativa, condiciones,"
            + " encuentros…</li><li><strong>consulta</strong>: reglas, conjuros, bestiario, tienda…</li>"
            + "<li><strong>mesa</strong>: la party, sonido ambiente, efectos de sonido, música…</li><li><strong>mundo</strong>:"
            + " generadores de nombres, PNJ, dungeons, negocios, botín…</li><li><strong>apuntes</strong>: post-its, dibujo,"
            + " documentos…</li></ul>"],
        ["🔍 Buscar, crear y ajustes", "morado", "<ul><li>El <strong>buscador</strong> de arriba encuentra conjuros,"
            + " monstruos, reglas, objetos, rasgos, dotes y habilidades a la vez (también lo que añadas tú).</li>"
            + "<li><strong>⚙</strong>: zoom, ordenar o quitar ventanas, atajos y las <strong>copias de seguridad</strong>"
            + " (exportar e importar).</li><li><strong>Aa</strong>: tamaño del texto, letra más legible y los"
            + " temas de color.</li></ul>"],
        ["🛠️ Crear contenido nuevo", "turquesa", "<p>El botón <strong>🛠️</strong> (arriba a la izquierda, junto a 📚) abre"
            + " el <strong>compendio</strong>: ahí añades monstruos, objetos, conjuros y más cosas (especies, dotes…).</p><ul>"
            + "<li><strong>＋ nuevo</strong>: rellenas un formulario.</li><li><strong>⧉ copiar</strong> uno del SRD y"
            + " cambiarlo, para tu versión.</li><li><strong>📋 pegar un bloque</strong> copiado de D&amp;D Beyond o de un PDF:"
            + " el formulario se rellena solo.</li><li><strong>⬆ importar</strong> muchos a la vez con la plantilla.</li></ul>"
            + "<p>Luego salen en el bestiario, los encuentros, la tienda, los conjuros y el buscador, con «🛠️ tuyo». Su"
            + " primera pestaña, <strong>❓ cómo añadir</strong>, lo explica paso a paso.</p>"],
        ["🎲 Los dados", "rosa", "<ul><li>El <strong>botón redondo</strong> de abajo a la derecha (o la tecla"
            + " <strong>D</strong>) abre los dados; pulsándolo otra vez se pliegan.</li><li>Toca los dados que quieras,"
            + " pon el modificador y <strong>tirar</strong>. Con ventaja o desventaja, el d20 se tira dos veces.</li>"
            + "<li>Las últimas tiradas quedan debajo, para repetirlas.</li><li>En las fichas, los números con dados también"
            + " se tiran tocándolos: prueba aquí con 1d20+5.</li></ul>"],
        ["💾 Tus datos", "gris", "<ul><li>Todo lo que haces se guarda <strong>sólo en este dispositivo</strong>: no se"
            + " sube a ningún sitio.</li><li>Si borras los datos del navegador, se pierde: haz de vez en cuando una copia con"
            + " <strong>⚙ → exportar</strong>.</li><li>Para llevarlo a otro dispositivo: exportar aquí e"
            + " <strong>importar</strong> allí.</li></ul>"],
        ["⌨️ Atajos", "azul", "<p>Con teclado va todo más rápido (pulsa <strong>?</strong> para verlos todos):</p><ul>"
            + "<li><strong>/</strong> buscar · <strong>A</strong> añadir una ventana · <strong>N</strong> post-it nuevo</li>"
            + "<li><strong>D</strong> dados · <strong>I</strong> iniciativa · <strong>C</strong> campañas</li>"
            + "<li><strong>[</strong> y <strong>]</strong> tablero anterior y siguiente</li><li><strong>+</strong> y"
            + " <strong>−</strong> zoom del tablero</li></ul>"],
    ];
    // Los tableros de tutorial de antes: la nota nueva del compendio, y la
    // de «buscar» sin lo del ＋ de al lado del buscador (que ya no está).
    function ponerAlDiaTutorial() {
        const nueva = TUTORIAL.find((t) => t[0] === "🛠️ Crear contenido nuevo");
        const buscar = TUTORIAL.find((t) => t[0] === "🔍 Buscar, crear y ajustes");
        let algo = false;
        todas.campanas.forEach((c) => c.perfiles.filter((pf) => pf.nombre === "📖 tutorial").forEach((pf) => {
            pf.modulos.filter((m) => m.tipo === "tarjeta" && m.titulo === "🔍 Buscar, crear y ajustes" && m.datos
                && /tus\s+creaciones/.test(m.datos.html || "")).forEach((m) => {
                m.datos.html = buscar[2];
                algo = true;
            });
            if (!pf.modulos.some((m) => m.titulo === nueva[0])) {
                const y = Math.max(0, ...pf.modulos.map((m) => m.y + m.h)) + 20;
                pf.modulos.push({ id: "m" + siguienteId++, tipo: "tarjeta", x: 10, y, w: 410, h: 540, titulo: nueva[0],
                    color: nueva[1], plegado: false, escala: 1, datos: { html: nueva[2] } });
                algo = true;
            }
        }));
        if (algo) {
            guardar();
        }
    }
    // Las campañas de antes: su tablero de la party (una sola vez).
    function ponerTableroParty() {
        let algo = false;
        todas.campanas.forEach((c) => {
            if (c.conParty) {
                return;
            }
            c.conParty = true;
            algo = true;
            if (c.perfiles.some((pf) => /party/i.test(pf.nombre))) {
                return;
            }
            const plantilla = perfilesDeSerie().find((pf) => /party/.test(pf.nombre));
            if (plantilla) {
                plantilla.id = "p" + siguientePerfil++;
                plantilla.modulos.forEach((mm) => {
                    mm.id = "m" + siguienteId++;
                });
                const i = c.perfiles.findIndex((pf) => /combate/.test(pf.nombre));
                c.perfiles.splice(i >= 0 ? i + 1 : c.perfiles.length, 0, plantilla);
            }
        });
        if (algo) {
            guardar();
        }
    }
    function perfilTutorial() {
        return { nombre: "📖 tutorial", color: "", colorPestana: "",
            modulos: TUTORIAL.map(([titulo, color, html], i) => ({ tipo: "tarjeta", x: (i % 4) * 430, y: Math.floor(i / 4) * 560,
                w: 410, h: 540, titulo, color, plegado: false, escala: 1, datos: { html } })) };
    }
    // Una campaña nueva: el tutorial y luego las plantillas de tableros.
    function crearCampana(nombre) {
        const c = { id: "c" + siguienteCampana++, nombre: nombre || "campaña " + (todas.campanas.length + 1), pjs: [],
            perfiles: [perfilTutorial()].concat(perfilesDeSerie()).map((pf) => Object.assign(pf, { id: "p" + siguientePerfil++,
                modulos: pf.modulos.map((m) => Object.assign(m, { id: "m" + siguienteId++ })) })) };
        c.activo = c.perfiles[0].id;
        c.conParty = true;
        return c;
    }

    // LICENCIAS Y CRÉDITOS: lo que hay que decir del SRD, los sonidos, las
    // letras y la propia app. Salen en la entrada y en ⚙ opciones, con
    // enlaces para verlas en la web.
    const CREDITOS = [
        ["📖 Reglas, monstruos, conjuros, objetos, rasgos y dotes", "Este trabajo incluye material del System Reference"
            + " Document 5.2 («SRD 5.2») de Wizards of the Coast LLC, disponible en dndbeyond.com/srd. El SRD 5.2 tiene licencia"
            + " Creative Commons Reconocimiento 4.0 Internacional (CC BY 4.0). Está traducido al español: no es una traducción"
            + " oficial. Los rasgos y dotes se han preparado a partir de 5e-bits/5e-database (MIT).",
        [["el SRD 5.2", "https://www.dndbeyond.com/srd"], ["la licencia CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/deed.es"],
            ["5e-database", "https://github.com/5e-bits/5e-database"]]],
        ["🔊 Sonidos", "Las grabaciones de sonido ambiente y efectos (cuando vienen con la app) son de la Google Sound Library,"
            + " con licencia CC BY 4.0. Tus propios audios son tuyos y se quedan en tu dispositivo.",
        [["Google Sound Library", "https://developers.google.com/assistant/tools/sound-library"],
            ["la licencia CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/deed.es"]]],
        ["🔤 Tipografías", "Space Grotesk, DM Mono, Jersey 10, Pangolin, Atkinson Hyperlegible y Noto, con licencia SIL Open Font"
            + " License 1.1.", [["la licencia OFL", "https://openfontlicense.org"]]],
        ["🧩 La app", "Pantalla de máster, de Richi (rperezbarreda). El código tiene licencia MIT. Dungeons & Dragons y D&D son"
            + " marcas de Wizards of the Coast; esta app no está afiliada ni respaldada por ellos.",
        [["la licencia MIT", "https://opensource.org/license/mit"]]]
    ];
    function cuerpoCreditos() {
        const cuerpo = crear("div", "master-creditos");
        CREDITOS.forEach(([titulo, texto, enlaces]) => {
            const sec = crear("div", "master-creditos-seccion");
            sec.append(crear("h3", "master-creditos-titulo", titulo), crear("p", "", texto));
            const fila = crear("div", "master-creditos-enlaces");
            enlaces.forEach(([nombre, url]) => {
                const a = crear("a", "oc-vida-accion", "🌐 " + nombre);
                a.href = url;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                a.setAttribute("aria-label", "Ver " + nombre + " en la web (se abre aparte)");
                fila.appendChild(a);
            });
            sec.appendChild(fila);
            cuerpo.appendChild(sec);
        });
        return cuerpo;
    }
    function verCreditos(vuelta) {
        window.ocVentana.abrir({ titulo: "licencias y créditos", cuerpo: cuerpoCreditos(), vuelta, clase: "es-ancha" });
    }

    // LA ENTRADA: al abrir la app, con qué campaña se juega (como un
    // inicio de sesión). Sin ninguna, hay que crear una para empezar.
    function verEntrada() {
        const fondo = crear("div", "master-entrada");
        fondo.setAttribute("role", "dialog");
        fondo.setAttribute("aria-modal", "true");
        fondo.setAttribute("aria-labelledby", "master-entrada-titulo");
        const caja = crear("div", "master-entrada-caja");
        const icono = crear("img", "master-entrada-icono");
        icono.src = "imagenes/icono.svg";
        icono.alt = "";
        const titulo = crear("h2", "master-entrada-titulo", "Pantalla de máster");
        titulo.id = "master-entrada-titulo";
        caja.append(icono, titulo);
        const principal = document.querySelector(".app-principal") || lienzo.closest("main");
        const dados = document.querySelector(".oc-boton-dados");
        const fuera = [principal, dados].filter(Boolean);
        fuera.forEach((x) => {
            x.inert = true;
        });
        function entrar(c) {
            fuera.forEach((x) => {
                x.inert = false;
            });
            fondo.remove();
            if (c !== todo || sinGuardarTodavia) {
                activarCampana(c);
            } else {
                avisar("Campaña: " + c.nombre + ".");
            }
            const p = document.getElementById("master-pestana-" + estado.id);
            (p || botonCampana).focus();
        }
        if (!sinGuardarTodavia) {
            caja.appendChild(crear("p", "master-entrada-texto", "¿Con qué campaña jugáis hoy?"));
            const ul = crear("ul", "master-entrada-lista");
            ul.setAttribute("aria-label", "Tus campañas");
            todas.campanas.forEach((c) => {
                const li = crear("li");
                const b = botonDe("master-entrada-campana", "", () => entrar(c));
                b.append(crear("span", "master-entrada-nombre", "📚 " + c.nombre), crear("span", "master-entrada-detalle",
                    c.perfiles.length + (c.perfiles.length === 1 ? " tablero" : " tableros") + " · " + c.pjs.length
                    + (c.pjs.length === 1 ? " personaje" : " personajes") + (c === todo ? " · la última" : "")));
                li.appendChild(b);
                ul.appendChild(li);
            });
            caja.appendChild(ul);
        } else {
            caja.appendChild(crear("p", "master-entrada-texto", "¡Hola! Para empezar, crea tu primera campaña: ponle el nombre"
                + " que quieras (lo puedes cambiar luego)."));
        }
        const form = crear("form", "master-entrada-form");
        const et = crear("label", "oc-dados-etiqueta", sinGuardarTodavia ? "nombre de la campaña" : "o crea una nueva");
        const input = crear("input", "oc-dados-texto");
        input.id = "master-entrada-nombre";
        input.maxLength = 40;
        input.autocomplete = "off";
        input.placeholder = "La maldición de la torre, Los de los martes…";
        if (sinGuardarTodavia) {
            input.required = true;
            input.setAttribute("aria-required", "true");
        }
        et.htmlFor = input.id;
        const crearB = crear("button", "oc-vida-accion es-principal", "＋ crear y empezar");
        crearB.type = "submit";
        form.append(et, input, crearB, crear("p", "oc-hoja-nota", "Viene con un tablero de tutorial que explica las opciones,"
            + " y con tableros de ejemplo para combate, tiendas, PNJ…"));
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const n = input.value.trim();
            if (!n) {
                avisar("Ponle un nombre a la campaña.");
                input.focus();
                return;
            }
            const c = crearCampana(n);
            if (sinGuardarTodavia) {
                todas.campanas = [c];
                sinGuardarTodavia = false;
            } else {
                todas.campanas.push(c);
            }
            entrar(c);
            avisar("Campaña creada: " + n + ". Empieza por el tablero «tutorial».");
        });
        caja.appendChild(form);
        // Con el ejecutable, la carpeta empieza vacía; si este navegador tiene
        // lo de una versión de antes, se puede traer (no se trae solo).
        let antes = null;
        try {
            antes = window.ocAlmacen && window.ocAlmacen.vacio && window.ocAlmacen.navegador.getItem(CLAVE);
        } catch (e) {
            antes = null;
        }
        if (antes) {
            const caja2 = crear("div", "master-entrada-traer");
            const traerB = botonDe("oc-vida-accion", "📥 traer lo de antes", () => {
                traerB.disabled = true;
                const nav = window.ocAlmacen.navegador;
                for (let i = 0; i < nav.length; i++) {
                    const k = nav.key(i);
                    if (/^richi-/.test(k)) {
                        localStorage.setItem(k, nav.getItem(k));
                    }
                }
                idbTodos().catch(() => []).then((xs) => Promise.all(xs.filter((x) => x[1]).map(([id, blob]) => carpetaGuardar(id, blob))))
                    .then(() => window.ocAlmacen.guardarYa()).then(() => location.reload())
                    .catch(() => {
                        traerB.disabled = false;
                        avisar("No se ha podido traer todo.");
                    });
            });
            caja2.append(crear("p", "oc-hoja-nota", "Este ordenador tiene guardado lo de una versión anterior de la pantalla"
                + " (en el navegador). Esta carpeta empieza vacía; si quieres seguir con aquello, tráelo aquí:"), traerB);
            caja.appendChild(caja2);
        }
        if (sinGuardarTodavia) {
            const traer = crear("div", "master-entrada-traer");
            traer.append(crear("p", "oc-hoja-nota", "¿Tienes una copia de seguridad (de esta app o de la pantalla de máster del"
                + " blog)? Impórtala:"), copias(() => {}));
            traer.querySelectorAll("button").forEach((b) => {
                if (/exportar/.test(b.textContent)) {
                    b.remove();
                }
            });
            caja.appendChild(traer);
        }
        caja.appendChild(crear("p", "oc-hoja-nota master-entrada-privado", EN_CARPETA
            ? "🔒 Todo se guarda en la carpeta «mis-datos», junto al programa." : "🔒 Todo se guarda sólo en este dispositivo."));
        // El aviso de licencias, plegado (también en ⚙ opciones).
        const avisoLic = crear("details", "master-entrada-licencias");
        avisoLic.append(crear("summary", "", "📜 Incluye material del SRD 5.2 de Wizards of the Coast (CC BY 4.0) · licencias y"
            + " créditos"), cuerpoCreditos());
        caja.appendChild(avisoLic);
        fondo.appendChild(caja);
        fondo.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                if (!sinGuardarTodavia) {
                    entrar(todo);
                }
            } else if (e.key === "Tab") {
                // El foco se queda dentro.
                const cosas = Array.from(fondo.querySelectorAll("button, input, [href], summary")).filter((x) => !x.disabled
                    && x.offsetParent);
                if (!cosas.length) {
                    return;
                }
                const i = cosas.indexOf(document.activeElement);
                if (e.shiftKey && i <= 0) {
                    e.preventDefault();
                    cosas[cosas.length - 1].focus();
                } else if (!e.shiftKey && i === cosas.length - 1) {
                    e.preventDefault();
                    cosas[0].focus();
                }
            }
        });
        document.body.appendChild(fondo);
        (fondo.querySelector(".master-entrada-campana") || input).focus();
    }

    function verCampanas() {
        const cuerpo = crear("div", "master-campanas");
        cuerpo.appendChild(crear("p", "oc-hoja-nota", "Cada campaña tiene sus pestañas, sus ventanas y su party: no se mezclan."));
        const ul = crear("ul", "master-anadir-lista");
        ul.setAttribute("aria-label", "Campañas");
        todas.campanas.forEach((c) => {
            const li = crear("li");
            const ahora = c === todo;
            const b = botonDe("master-anadir-tarjeta", "", () => {
                cerrar();
                if (!ahora) {
                    activarCampana(c);
                }
                botonCampana.focus();
            });
            const em = crear("span", "master-anadir-emoji", ahora ? "📖" : "📚");
            em.setAttribute("aria-hidden", "true");
            b.append(em, crear("span", "master-anadir-nombre", c.nombre), crear("span", "master-anadir-desc",
                c.perfiles.length + (c.perfiles.length === 1 ? " pestaña" : " pestañas") + " · " + c.pjs.length +
                (c.pjs.length === 1 ? " personaje" : " personajes") + (ahora ? " · la de ahora" : "")));
            if (ahora) {
                b.setAttribute("aria-current", "true");
            }
            li.appendChild(b);
            ul.appendChild(li);
        });
        const formulario = (id, texto, valor, boton, alHacer) => {
            const f = crear("form", "master-campana-form");
            const et = crear("label", "oc-dados-etiqueta", texto);
            const input = crear("input", "oc-dados-texto");
            input.id = id;
            input.value = valor;
            input.maxLength = 40;
            input.autocomplete = "off";
            et.htmlFor = input.id;
            const b = crear("button", "oc-vida-accion", boton);
            b.type = "submit";
            f.append(et, input, b);
            f.addEventListener("submit", (e) => {
                e.preventDefault();
                alHacer(input.value.trim());
            });
            return f;
        };
        const nueva = formulario("master-campana-nueva", "campaña nueva", "campaña " + (todas.campanas.length + 1), "＋ crear", (n) => {
            const c = crearCampana(n);
            todas.campanas.push(c);
            cerrar();
            activarCampana(c);
            botonCampana.focus();
        });
        const renombrarla = formulario("master-campana-nombre", "nombre de esta campaña", todo.nombre, "guardar", (n) => {
            if (!n) {
                return;
            }
            todo.nombre = n;
            guardar();
            pintarCampana();
            cerrar();
            botonCampana.focus();
            avisar("Campaña: " + n + ".");
        });
        let seguro = false;
        const borrar = botonDe("oc-vida-accion", "🗑️ borrar esta campaña", () => {
            if (!seguro) {
                seguro = true;
                borrar.textContent = "🗑️ ¿seguro? se borran sus pestañas, ventanas y party: pulsa otra vez";
                return;
            }
            const i = todas.campanas.indexOf(todo);
            const nombre = todo.nombre;
            todas.campanas.splice(i, 1);
            cerrar();
            activarCampana(todas.campanas[Math.max(0, i - 1)]);
            botonCampana.focus();
            avisar("Borrada la campaña " + nombre + ".");
        });
        borrar.disabled = todas.campanas.length < 2;
        cuerpo.append(ul, nueva, renombrarla, borrar);
        const cerrar = window.ocVentana.abrir({ titulo: "campañas", cuerpo, vuelta: botonCampana, clase: "es-ancha" });
    }
    pintarCampana();
    // LA BARRA, como un navegador: a la izquierda, pegado al tablero, 🧰
    // (añadir una ventana), 📚 (la campaña), las pestañas (cada una con
    // su ✕), ＋ y ✎; a la derecha, en su caja, el buscador, 🔍 y ⚙ (las
    // opciones: zoom, dados, atajos, ordenar, quitar, exportar e
    // importar).
    botonAnadir.className = "master-pestana-mando master-herramientas";
    botonAnadir.textContent = "🧰";
    botonAnadir.setAttribute("aria-label", "Añadir una ventana (herramientas)");
    botonAnadir.setAttribute("aria-keyshortcuts", "A");
    botonAnadir.title = "Herramientas: añadir una ventana (A)";
    // ＋: el compendio (añadir monstruos, objetos, conjuros…), aparte.
    const botonCompendio = botonDe("master-crear", "🛠️", () => abrirCompendio(botonCompendio),
        "Añadir al compendio: monstruos, objetos, conjuros…");
    botonCompendio.title = "Añadir al compendio: monstruos, objetos, conjuros y más (con tutorial)";
    botonCompendio.setAttribute("aria-haspopup", "dialog");
    pestanas.append(botonAnadir, botonCampana, botonCompendio, marco, mandosPestanas);

    const mandos = crear("div", "master-barra-mandos");
    const zoomCaja = crear("div", "master-zoom");
    zoomCaja.setAttribute("role", "group");
    zoomCaja.setAttribute("aria-label", "Zoom del tablero");
    zoomCaja.append(menosZoom, botonZoom, masZoom);
    zoomCaja.hidden = !HAY_ZOOM;
    const buscador = montarBuscador();
    const botonBuscar = botonDe("master-pestana-mando master-buscar", "🔍", () => {
        const input = document.getElementById("master-buscador");
        input.focus();
        // Con algo escrito, que salgan (otra vez) los resultados.
        if (input.value.trim()) {
            input.dispatchEvent(new Event("input", { bubbles: true }));
        }
    }, "Buscar");
    botonBuscar.title = "Buscar (/)";
    const botonOpciones = botonDe("master-pestana-mando master-opciones-boton", "⚙", () => verOpciones(), "Opciones del tablero");
    botonOpciones.title = "Opciones: zoom, dados, atajos, ordenar, exportar…";
    botonOpciones.setAttribute("aria-haspopup", "dialog");
    mandos.append(buscador, botonBuscar, botonOpciones);
    barra.prepend(pestanas, mandos);

    function verOpciones() {
        const cuerpo = crear("div", "master-opciones-tablero");
        const fila = (titulo, ...cosas) => {
            const sec = crear("div", "master-opciones-fila");
            sec.append(crear("h3", "master-opciones-titulo", titulo), ...cosas);
            cuerpo.appendChild(sec);
        };
        if (HAY_ZOOM && !enMovil.matches) {
            fila("Zoom del tablero", zoomCaja);
        }
        const accion = (texto, alPulsar) => botonDe("oc-vida-accion", texto, () => {
            cerrar();
            alPulsar();
        });
        const herramientas = crear("div", "master-anadir-otras");
        herramientas.append(accion("🎲 dados (D)", () => {
            const d = document.querySelector(".oc-boton-dados");
            if (d) {
                d.click();
            }
        }), accion("⌨ atajos de teclado (?)", () => verAtajos()));
        fila("A mano", herramientas);
        if (estado.modulos.length) {
            const otras = crear("div", "master-anadir-otras");
            let seguro = false;
            const vaciar = botonDe("oc-vida-accion", "🗑️ quitar todas", () => {
                if (!seguro) {
                    seguro = true;
                    vaciar.textContent = "🗑️ ¿seguro? pulsa otra vez";
                    return;
                }
                cerrar();
                estado.modulos = [];
                pintarTodo();
                guardar();
                avisar("Pestaña vacía.");
            });
            otras.append(accion("▦ ordenar las ventanas", () => {
                ordenar();
                pintarTodo();
                guardar();
                avisar("Ordenadas.");
            }), vaciar);
            fila("Las ventanas de esta pestaña", otras);
        }
        fila("Copia de seguridad", copias(() => cerrar()));
        const lic = crear("div", "master-anadir-otras");
        const web = crear("a", "oc-vida-accion", "🌐 el SRD en la web");
        web.href = "https://www.dndbeyond.com/srd";
        web.target = "_blank";
        web.rel = "noopener noreferrer";
        web.setAttribute("aria-label", "Ver el SRD 5.2 en la web (se abre aparte)");
        lic.append(accion("📜 licencias y créditos", () => verCreditos(botonOpciones)), web);
        fila("Licencias y créditos", crear("p", "oc-hoja-nota", "SRD 5.2 de Wizards of the Coast (CC BY 4.0), sonidos de la Google"
            + " Sound Library (CC BY 4.0), tipografías OFL y la app con licencia MIT."), lic);
        const cerrar = window.ocVentana.abrir({ titulo: "opciones", cuerpo, vuelta: botonOpciones });
    }

    // ---- LOS ATAJOS DE TECLADO (fuera de los campos de texto y sin
    // ventana modal abierta): «?» o ⌨ los enseña todos. ----
    const ATAJOS = [
        ["El tablero", [["/", "ir al buscador"], ["A", "añadir una ventana"], ["N", "post-it nuevo"], ["D", "los dados"],
            ["I", "la iniciativa (la abre si no está)"], ["+ / −", "acercar o alejar el tablero"], ["0", "el tablero al 100 %"],
            ["[ / ]", "perfil anterior o siguiente"], ["Alt + ← / Alt + →", "mover la pestaña elegida"],
            ["mantener pulsada una pestaña", "arrastrarla a otro sitio"], ["C", "campañas (cambiar, crear…)"],
            ["?", "estos atajos"]]],
        ["Las ventanas", [["clic en la barra", "plegarla o desplegarla"], ["mantener pulsada la barra", "cogerla y moverla"],
            ["soltarla sobre la barra de otra", "juntarlas en pestañas (⇱ la saca)"],
            ["Intro en el nombre", "plegarla o desplegarla"], ["flechas en el nombre", "moverla (con Mayús, más deprisa)"],
            ["Alt + flechas en el nombre", "cambiar su tamaño"], ["Esc", "cerrar una ventana modal"]]],
        ["El dibujo (con el foco en el lienzo)", [["B", "lápiz"], ["E", "goma"], ["G", "bote"], ["M", "seleccionar y mover"],
            ["I", "cuentagotas"], ["L", "línea"], ["U", "rectángulo"], ["O", "elipse"], ["T", "texto"], ["Ctrl+Z / Ctrl+Y", "deshacer y rehacer"],
            ["flechas", "mover la selección (Mayús: de 10 en 10)"], ["+ / −", "agrandar o encoger la selección"],
            ["Supr", "borrar la selección"], ["Esc", "soltar la selección"], ["Ctrl+V", "pegar una imagen"]]],
        ["Post-its y notas", [["Ctrl+B / I / U", "negrita, cursiva, subrayado"], ["Ctrl+Z / Ctrl+Y", "deshacer y rehacer"],
            ["← → en la barra", "ir de un botón a otro"]]],
        ["El buscador", [["↓ ↑", "por los resultados"], ["Intro", "abrir el elegido"], ["Esc", "cerrar"]]],
    ];

    function verAtajos() {
        const cuerpo = crear("div", "master-atajos");
        ATAJOS.forEach(([titulo, lista]) => {
            cuerpo.appendChild(crear("h3", "master-atajos-titulo", titulo));
            const dl = crear("dl", "master-atajos-lista");
            lista.forEach(([tecla, que]) => {
                const dt = crear("dt");
                tecla.split(" / ").forEach((t, i) => {
                    if (i) {
                        dt.appendChild(document.createTextNode(" / "));
                    }
                    dt.appendChild(crear("kbd", "", t));
                });
                dl.append(dt, crear("dd", "", que));
            });
            cuerpo.appendChild(dl);
        });
        window.ocVentana.abrir({ titulo: "atajos de teclado", cuerpo, vuelta: botonOpciones, clase: "es-ancha" });
    }

    document.addEventListener("keydown", (e) => {
        if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || !lienzo.isConnected) {
            return;
        }
        const t = e.target;
        if (t && t.closest && t.closest("input, textarea, select, canvas, [contenteditable='true']")) {
            return;
        }
        if (window.ventanaModal && window.ventanaModal.abierta && window.ventanaModal.abierta()) {
            return;
        }
        const tecla = e.key;
        const hacer = {
            "/": () => {
                const b = document.getElementById("master-buscador");
                if (b) {
                    b.focus();
                }
            },
            "?": verAtajos,
            a: () => botonAnadir.click(),
            n: () => anadir("tarjeta"),
            d: () => {
                const b = document.querySelector(".oc-boton-dados");
                if (b) {
                    b.click();
                }
            },
            i: () => {
                const m = estado.modulos.find((x) => x.tipo === "iniciativa");
                if (m && m.el) {
                    alFrente(m);
                    m.el.scrollIntoView({ block: "nearest" });
                    if (m.grupo && !m.delante) {
                        verEnGrupo(m, false);
                    }
                    focoDe(m).focus();
                } else {
                    anadir("iniciativa");
                }
            },
            "+": () => pasoZoom(1),
            "=": () => pasoZoom(1),
            "-": () => pasoZoom(-1),
            "0": () => ponerZoom(1, true),
            c: verCampanas,
            "[": () => cambiarPerfil(-1),
            "]": () => cambiarPerfil(1),
        }[tecla.length === 1 ? tecla.toLowerCase() : tecla];
        if (hacer) {
            e.preventDefault();
            hacer();
        }
    });

    function cambiarPerfil(paso) {
        const i = todo.perfiles.indexOf(estado);
        const pf = todo.perfiles[(i + paso + todo.perfiles.length) % todo.perfiles.length];
        if (pf !== estado) {
            activar(pf, true);
            avisar("Perfil: " + pf.nombre + ".");
        }
    }

    ponerAlDiaTutorial();
    ponerTableroParty();
    lienzo.classList.add("con-lienzo");
    colorTablero();
    pintarPestanas(false);
    pintarTodo();
    // Al abrir: con qué campaña (o crear la primera). Si es la recarga al
    // salir del compendio, se sigue con la que estaba.
    let recargado = false;
    try {
        recargado = sessionStorage.getItem(CLAVE_RECARGA) === "1";
        sessionStorage.removeItem(CLAVE_RECARGA);
    } catch (e) {
        recargado = false;
    }
    if (!recargado || !todas.campanas.length) {
        verEntrada();
    }
    if (enMovil.addEventListener) {
        enMovil.addEventListener("change", pintarTodo);
    }
})();
