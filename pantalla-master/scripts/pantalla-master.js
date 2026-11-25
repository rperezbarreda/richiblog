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
    // Lo compartido con las ventanas (scripts/ventanas/*.js): ver LEEME.
    const PM = window.ocPM = window.ocPM || {};
    Object.assign(PM, { aSuAlfabeto, abrirBicho, abrirConjuro, abrirFichaPj, abrirImportarPj, abrirObjeto, abrirRasgo, abrirRegla, alAzar, alFrente, anadir, avisar, bajarJson, bonoHabPj, botonAspectoSonido, botonDe, botonesDe, cancionesDe, conNumero, conjuroPj, conjurosPj, copiarTexto, crear, cuerpoConjuro, cuerpoRasgo, darPx, datosIni, datosObjeto, dialogoAspecto, editorRico, efectosCambian, elegirDe, enlazarConjuros, fotoPj, guardar, guardarEnDocumentos, hacerBotin, hacerEncuentro, iconoSonido, imagenMusica, iniDeBicho, iniDePj, inventar, inventarioParty, leerHomebrew, leerNombresTuyos, leerPropios, lugarDe, markdown, meterEnIniciativa, mientrasEste, moneda, mostrarAJugadores, motorAudio, musicaAjustar, musicaAlternar, musicaAnterior, musicaBucle, musicaCarpeta, musicaDe, musicaParar, musicaPoner, musicaSiguiente, musicaVol, nombreDe, normalizarPj, nuevoIdPj, nuevoPj, olvidarAspecto, opcionesCarpetas, pasivaPj, pedir, pedirNombreDoc, perfil, personalizar, pestanasDe, ponerTitulo, rutaDe, sanearHtml, tiradaSuelta, tokenDe, urlImagenSegura, urlSonidoSegura, verEnGrupo, verSubidas });
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
    Object.assign(PM, { llano });

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
    const REGLAS = window.ocReglas.RUTA;
    Object.assign(PM, { REGLAS });
    // LA EDICIÓN de cada campaña: 2024 (SRD 5.2, lo de siempre) o 2014 (SRD
    // 5.1: sus reglas, sus monstruos y sus conjuros, en
    // datos/personajes/compendio/2014/). Va en la campaña («edicion»; sin
    // ella, 2024), se elige al crearla y se cambia en ⚙ opciones. Lo tuyo
    // (tus monstruos, conjuros, reglas propias…) vale para las dos.
    let edicionAhora = "2024";
    const DE_2014 = { "datos/personajes/compendio/bestiario.json": "datos/personajes/compendio/2014/bestiario.json",
        "datos/personajes/compendio/conjuros-srd.json": "datos/personajes/compendio/2014/conjuros-srd.json",
        "datos/personajes/compendio/tienda.json": "datos/personajes/compendio/2014/tienda.json" };
    const NOMBRES = "datos/personajes/compendio/nombres.json";
    Object.assign(PM, { NOMBRES });

    function pedir(ruta) {
        // Las reglas, con lo que hayas cambiado (window.ocReglas, en
        // personajes.js); los nombres, igual (pedirNombres).
        if (ruta === REGLAS) {
            return window.ocReglas.cargar();
        }
        if (ruta === NOMBRES) {
            return pedirNombres();
        }
        // En una campaña de 2014, los monstruos y los conjuros del SRD 5.1.
        const real = (edicionAhora === "2014" && DE_2014[ruta]) || ruta;
        if (!pedidos[real]) {
            pedidos[real] = fetch(real).then((r) => {
                if (!r.ok) {
                    throw new Error(r.status);
                }
                return r.json().then(window.ocIdioma.datos);
            });
        }
        const k = PROPIOS_EN[ruta];
        if (!k) {
            return pedidos[real];
        }
        // Con lo tuyo (si hay) al final; sin los del SRD que has cambiado
        // (va tu versión) o borrado («ocultos»).
        return pedidos[real].then((d) => {
            const p = leerPropios();
            const tuyos = p[k];
            const fuera = new Set(((p.ocultos || {})[k] || []).concat(tuyos.filter((y) => y.cambia).map((y) => y.cambia)));
            if (!tuyos.length && !fuera.size) {
                return d;
            }
            const x = Object.assign({}, d);
            x[k] = (d[k] || []).filter((y) => !fuera.has(claveSrd(k, y))).concat(tuyos);
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
    // Cómo se reconoce uno del SRD (para cambiarlo o borrarlo): su nombre
    // original; los rasgos, además, de quién son.
    const claveSrd = (k, x) => (k === "rasgos" ? x.en + "|" + x.de : x.en);
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
    const fuenteDe = (x, f) => (x && x.propio ? (x.cambia ? ocT("✎ Cambiado por ti (del SRD){n}. Se guarda sólo en este navegador.", { n: x.libro ? " · " + x.libro : "" })
        : ocT("🛠️ Creado por ti{n}. Se guarda sólo en este navegador.", { n: x.libro ? " · " + x.libro : "" })) : f);
    Object.assign(PM, { fuenteDe });

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
        return tipo + traducir(m[4]) + " " + tam(m[1]) + (m[2] ? ocT(" o {tam}", { tam: tam(m[2]) }) : "");
    }

    // ---- LAS REGLAS (o solo las de un grupo: las condiciones son
    // «Estados» y las acciones, «Acciones») ----
    // ---- LAS REGLAS PROPIAS (homebrew): las de tu mesa, guardadas en el
    // navegador («richi-master-homebrew»: [{id, nombre, icono, texto}]),
    // las mismas en todos los perfiles. Salen en su ventana, al final de
    // «todas las reglas» y en el buscador de arriba. ----
    const CLAVE_HOMEBREW = "richi-master-homebrew";
    Object.assign(PM, { CLAVE_HOMEBREW });
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
            cuerpo.appendChild(crear("p", "oc-hoja-nota", r.grupo + (r.alias ? ocT(" · también: {alias}", { alias: r.alias }) : "")));
        }
        cuerpo.appendChild(markdown(r.texto));
        if (fuente) {
            cuerpo.appendChild(crear("p", "oc-hoja-nota master-fuente", fuente));
        }
        if (window.ocDadosEnTexto) {
            window.ocDadosEnTexto(cuerpo);
        }
        const fijar = botonDe("oc-vida-accion", ocT("📌 al tablero"), () => {
            cerrar();
            anadir("ficha", { titulo: r.nombre, datos: { que: r.propia ? "propia" : "regla", id: r.id || r.nombre } });
        }, ocT("Poner {nombre} en el tablero", { nombre: r.nombre }));
        const barra = crear("div", "master-creador-barra");
        barra.appendChild(fijar);
        // Las del JSON se pueden cambiar (y volver a como venían).
        if (r.id && !r.propia) {
            barra.appendChild(botonDe("oc-vida-accion", ocT("✎ cambiar"), () => {
                cerrar();
                editarRegla(r, vuelta);
            }, ocT("Cambiar {nombre}", { nombre: r.nombre })));
            if (r.cambiada) {
                cuerpo.appendChild(crear("p", "oc-hoja-nota", ocT("✎ Cambiada por ti (la original: «{nombre}»).", { nombre: r.original.nombre })));
                barra.appendChild(botonDe("oc-vida-accion", ocT("↺ volver a la original"), () => {
                    window.ocReglas.guardarCambio(r.id, null);
                    avisar(r.original.nombre + ocT(": otra vez como venía."));
                    cerrar();
                }, ocT("Volver a la original de {nombre}", { nombre: r.nombre })));
            }
        }
        cuerpo.appendChild(barra);
        const cerrar = window.ocVentana.abrir({ titulo: r.nombre, cuerpo, vuelta, clase: "es-regla" });
    }

    // De dónde sale una regla: las opcionales son texto propio.
    const fuenteDeRegla = (r, fuente) => (r.opcional ? ocT("Regla opcional: texto propio, no del SRD.") : fuente);

    // Cambiar una regla del JSON: lo cambiado va a «richi-master-reglas»
    // (window.ocReglas) y el archivo no se toca. Si es la de una marca de
    // la iniciativa, también su resumen corto.
    function editarRegla(r, vuelta) {
        const base = r.original || r;
        window.ocReglas.cargar().then((d) => {
            const marcas = (d.marcas || []).filter((mk) => mk.regla === r.id);
            const form = crear("form", "master-homebrew-form");
            const campo = (k, texto, etiqueta, valor) => {
                const et = crear("label", "oc-dados-etiqueta", texto);
                const x = crear(etiqueta || "input", "oc-dados-texto" + (etiqueta === "textarea" ? " oc-notas-texto" : ""));
                x.id = "master-regla-" + k;
                et.htmlFor = x.id;
                x.value = valor || "";
                if (etiqueta !== "textarea") {
                    x.autocomplete = "off";
                }
                form.append(et, x);
                return x;
            };
            const nombre = campo("nombre", ocT("nombre"), null, r.nombre);
            nombre.maxLength = 80;
            nombre.required = true;
            const icono = campo("icono", ocT("dibujo (un emoji)"), null, r.icono);
            icono.maxLength = 4;
            const alias = campo("alias", ocT("también se busca por (opcional)"), null, r.alias);
            const texto = campo("texto", ocT("la regla (con **negrita**, *cursiva*, «- » para listas y «| a | b |» para tablas)"),
                "textarea", r.texto);
            texto.rows = 10;
            const corto = marcas.length ? campo("corto", ocT("resumen corto (sale en la iniciativa al pasar por la marca {join})", { join: marcas.map((mk) => "«" + mk.marca + "»").join(", ") }), "textarea", marcas[0].corto) : null;
            if (corto) {
                corto.rows = 3;
                corto.classList.remove("oc-notas-texto");
            }
            const barra = crear("div", "master-anadir-otras");
            const listo = crear("button", "oc-vida-accion es-principal", ocT("guardar"));
            listo.type = "submit";
            barra.append(listo, botonDe("oc-vida-accion", ocT("cancelar"), () => cerrar()));
            form.append(barra, crear("p", "oc-hoja-nota", ocT("Se guarda con tus cosas (⚙ → exportar se lo lleva); el archivo de las reglas no cambia. Para dejarla como venía: «↺ volver a la original».")));
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                const n = nombre.value.trim();
                if (!n) {
                    nombre.focus();
                    return;
                }
                // Solo lo que es distinto de la original.
                const cambio = {};
                [["nombre", n], ["icono", icono.value.trim()], ["alias", alias.value.trim()], ["texto", texto.value.trim()]]
                    .forEach(([k, v]) => {
                        if (v !== String(base[k] || "")) {
                            cambio[k] = v;
                        }
                    });
                const cortoOriginal = corto ? (marcas[0].cortoOriginal !== undefined ? marcas[0].cortoOriginal : marcas[0].corto) : "";
                if (corto && corto.value.trim() && corto.value.trim() !== cortoOriginal) {
                    cambio.corto = corto.value.trim();
                }
                if (!window.ocReglas.guardarCambio(r.id, Object.keys(cambio).length ? cambio : null)) {
                    avisar(ocT("No se ha podido guardar."));
                    return;
                }
                avisar(Object.keys(cambio).length ? ocT("Guardada: {n}.", { n: n }) : n + ocT(": como venía."));
                cerrar();
            });
            const cerrar = window.ocVentana.abrir({ titulo: "✎ " + r.nombre, cuerpo: form, vuelta, clase: "es-regla" });
            nombre.focus();
        });
    }

    function montarReglas(dentro, m, soloGrupo) {
        m.datos = m.datos || {};
        dentro.appendChild(crear("p", "oc-hoja-nota", ocT("Cargando las reglas…")));
        const pintar = (datos) => {
                const propias = soloGrupo ? [] : leerHomebrew().map((r) => Object.assign({ grupo: ocT("🏠 Reglas propias"),
                    propia: true }, r));
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
                    li.dataset.id = (r.propia ? "propia:" : "") + (r.id || r.nombre);
                    const detalles = crear("details");
                    const resumen = crear("summary");
                    if (r.icono) {
                        resumen.appendChild(crear("span", "oc-regla-icono", r.icono));
                    }
                    resumen.appendChild(crear("span", "oc-regla-nombre", r.nombre + (r.alias ? " (" + r.alias + ")" : "")
                        + (r.cambiada ? " ✎" : "")));
                    detalles.append(resumen, markdown(r.texto));
                    li.appendChild(detalles);
                    grupos[r.grupo].appendChild(li);
                });
                dentro.replaceChildren(caja);
                // Cada una se abre con abrirRegla (con «✎ cambiar»).
                window.ocMontar.reglas(caja, "master-buscar-" + m.id, (id, b) => {
                    const r = reglas.find((x) => (x.propia ? "propia:" : "") + (x.id || x.nombre) === id);
                    if (r) {
                        abrirRegla(r, b, r.propia ? null : fuenteDeRegla(r, datos.fuente));
                    }
                });
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
                    dentro.appendChild(crear("p", "oc-hoja-nota master-fuente", ocT("{n} Cualquiera se cambia con «✎ cambiar» al abrirla.", { n: datos.fuente
                        + (reglas.some((r) => r.opcional) ? ocT(" Las opcionales (como el flanqueo), texto propio.") : "") })));
                }
        };
        const cargar = () => pedir(REGLAS).then(pintar).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", ocT("No he podido cargar las reglas.")));
        });
        cargar();
        mientrasEste(dentro, "oc:reglas", cargar);
        if (!soloGrupo) {
            mientrasEste(dentro, "master:homebrew", cargar);
        }
    }

    // ---- LOS CONJUROS: los 339 del SRD 5.2 (D&D 2024), en
    // datos/personajes/compendio/conjuros-srd.json. Cada uno abre su
    // ventana (abrirConjuro), desde el buscador o desde un monstruo. ----
    const CONJUROS_SRD = "datos/personajes/compendio/conjuros-srd.json";
    Object.assign(PM, { CONJUROS_SRD });
    const nivelDe = (c) => (c.nivel ? ocT("Nivel {nivel}", { nivel: c.nivel }) : "Truco");
    Object.assign(PM, { nivelDe });

    function abrirConjuro(c, vuelta, fuente) {
        const cuerpo = cuerpoConjuro(c, fuente);
        const fijar = botonDe("oc-vida-accion", ocT("📌 al tablero"), () => {
            cerrar();
            anadir("ficha", { titulo: c.nombre, datos: { que: "conjuro", id: c.en } });
        }, ocT("Poner {nombre} en el tablero", { nombre: c.nombre }));
        cuerpo.appendChild(fijar);
        const cerrar = window.ocVentana.abrir({ titulo: c.nombre, cuerpo, vuelta, clase: "es-regla" });
    }

    function cuerpoConjuro(c, fuenteSrd) {
        const fuente = fuenteDe(c, fuenteSrd);
        const cuerpo = crear("div", "oc-regla-ventana");
        const chapas = crear("ul", "oc-desplegable-datos");
        [nivelDe(c), verDato(c.escuela), c.ritual ? ocT("ritual") : "", c.conc ? ocT("concentración") : ""].filter(Boolean)
            .forEach((t) => chapas.appendChild(crear("li", "", t)));
        const dl = crear("dl", "master-bicho-datos");
        [[ocT("Lanzamiento"), c.tiempo], [ocT("Alcance"), c.alcance], [ocT("Componentes"), c.comp], [ocT("Duración"), c.dur],
            [ocT("Clases"), (c.clases || []).map(verDato).join(", ")]].forEach(([k, v]) => {
            if (v) {
                dl.append(crear("dt", "", k), crear("dd", "", v));
            }
        });
        cuerpo.append(chapas, dl);
        if (c.ingles) {
            cuerpo.appendChild(crear("p", "oc-hoja-nota", ocT("Este todavía no está traducido: va en inglés.")));
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
        img.alt = ocT("Tu imagen de {nombre}", { nombre: nombre });
        img.hidden = true;
        const subir = crear("input");
        subir.type = "file";
        subir.accept = "image/*";
        subir.hidden = true;
        const poner = botonDe("oc-vida-accion", ocT("🖼️ poner una imagen"), () => subir.click(), ocT("Poner una imagen de {nombre} (de tu dispositivo)", { nombre: nombre }));
        const grande = botonDe("oc-vida-accion", ocT("🔍 en grande"), () => {
            const g = crear("img", "master-imagen-grande");
            g.alt = img.alt;
            ponerImagenGuardada(g, leerImagenes()[clave]);
            window.ocVentana.abrir({ titulo: nombre, cuerpo: g, vuelta: grande, clase: "es-ancha" });
        }, ocT("Ver tu imagen de {nombre} en grande", { nombre: nombre }));
        const quitar = botonDe("oc-vida-accion", ocT("✕ quitar"), () => {
            const todas = leerImagenes();
            const v = String(todas[clave] || "");
            if (v.indexOf("archivo:") === 0) {
                archivoBorrar(v.slice(8));
            }
            delete todas[clave];
            guardarImagenes(todas);
            pintar();
            avisar(ocT("Imagen quitada."));
            poner.focus();
        }, ocT("Quitar tu imagen de {nombre}", { nombre: nombre }));
        const botones = crear("div", "master-imagen-botones");
        botones.append(poner, grande, quitar);
        const nota = crear("p", "oc-hoja-nota", ocT("Una imagen de tu dispositivo: se queda sólo en él (⚙ → exportar para llevarla)."));
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
                avisar(ocT("Sólo imágenes de hasta 50 MB."));
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
                avisar(ocT("Imagen puesta."));
            }).catch(() => avisar(ocT("No se ha podido guardar la imagen.")));
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
        fila(ocT("Categoría"), verDato(o.cat));
        fila(ocT("Rareza"), verDato(o.rareza));
        fila(ocT("Sintonía"), o.sint ? ocT("la requiere") : "");
        fila(ocT("Detalles"), o.det);
        fila(ocT("Peso"), o.peso);
        fila(ocT("Nota"), o.nota);
        fila(ocT("Precio"), o.cp ? moneda(o.cp) : "");
        fila(ocT("Se vende en"), (o.tiendas || []).map(verDato).join(", ").toLowerCase());
        fila(ocT("En inglés"), o.en);
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
        cuerpo.append(crear("h3", "master-imagen-titulo", ocT("🖼️ imagen")), panelImagen("objeto:" + o.en, o.nombre));
        return cuerpo;
    }

    function abrirObjeto(o, vuelta, fuenteSrd) {
        const fuente = fuenteDe(o, fuenteSrd);
        const cuerpo = datosObjeto(o);
        if (fuente) {
            cuerpo.appendChild(crear("p", "oc-hoja-nota master-fuente", fuente));
        }
        cuerpo.appendChild(botonDe("oc-vida-accion", ocT("📌 al tablero"), () => {
            cerrar();
            anadir("ficha", { titulo: o.nombre, datos: { que: "objeto", id: o.en } });
        }, ocT("Poner {nombre} en el tablero", { nombre: o.nombre })));
        const cerrar = window.ocVentana.abrir({ titulo: o.nombre, cuerpo, vuelta, clase: "es-regla" });
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
    Object.assign(PM, { RASGOS_SRD });
    const idRasgo = (r) => (r.propio ? r.id : r.en + "|" + r.de);
    Object.assign(PM, { idRasgo });
    const datosRasgo = (r) => [verDato(r.tipo), r.de && r.de !== "dote" ? verDato(r.de) : "", r.nivel ? ocT("nivel {nivel}", { nivel: r.nivel }) : ""].filter(Boolean);
    Object.assign(PM, { datosRasgo });

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
        cuerpo.appendChild(botonDe("oc-vida-accion", ocT("📌 al tablero"), () => {
            cerrar();
            anadir("ficha", { titulo: r.nombre, datos: { que: "rasgo", id: idRasgo(r) } });
        }, ocT("Poner {nombre} en el tablero", { nombre: r.nombre })));
        const cerrar = window.ocVentana.abrir({ titulo: r.nombre, cuerpo, vuelta, clase: "es-regla" });
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
    Object.assign(PM, { HABILIDADES_PJ });
    // Su nombre para enseñar (en la ficha se guardan en castellano).
    const HAB_VER = { Acrobacias: ocT("Acrobacias"), Atletismo: ocT("Atletismo"), "Conocimiento arcano": ocT("Conocimiento arcano"),
        Engaño: ocT("Engaño"), Historia: ocT("Historia"), Interpretación: ocT("Interpretación"), Intimidación: ocT("Intimidación"),
        Investigación: ocT("Investigación"), "Juego de manos": ocT("Juego de manos"), Medicina: ocT("Medicina"), Naturaleza: ocT("Naturaleza"),
        Percepción: ocT("Percepción"), Perspicacia: ocT("Perspicacia"), Persuasión: ocT("Persuasión"), Religión: ocT("Religión"),
        Sigilo: ocT("Sigilo"), Supervivencia: ocT("Supervivencia"), "Trato con animales": ocT("Trato con animales") };
    const verHab = (n) => HAB_VER[n] || n;
    Object.assign(PM, { verHab });
    const NOMBRES_CAR = { fue: "Fuerza", des: "Destreza", con: "Constitución", int: "Inteligencia", sab: "Sabiduría", car: "Carisma" };
    Object.assign(PM, { NOMBRES_CAR });
    // Lo mismo para enseñar (traducido); NOMBRES_CAR es para leer fichas en castellano.
    // Y sus abreviaturas (FUE, DES…), para enseñar.
    const CAR_ABR = { fue: ocT("FUE"), des: ocT("DES"), con: ocT("CON"), int: ocT("INT"), sab: ocT("SAB"), car: ocT("CAR") };
    Object.assign(PM, { CAR_ABR });
    const CAR_VER = { fue: ocT("Fuerza"), des: ocT("Destreza"), con: ocT("Constitución"), int: ocT("Inteligencia"), sab: ocT("Sabiduría"),
        car: ocT("Carisma") };
    Object.assign(PM, { CAR_VER });

    function nuevoIdPj() {
        const u = new Uint32Array(2);
        crypto.getRandomValues(u);
        return "pj" + u[0].toString(36) + u[1].toString(36);
    }

    // Sus hechizos: [{nivel, nombre}] (el nivel, del SRD si está).
    function conjurosPj(pj, srd) {
        return (pj.conjuros || []).map((n) => ({ nivel: deSrd(srd, n) ? deSrd(srd, n).nivel : null, nombre: n }));
    }

    // Lo del SRD con ese nombre (en un índice por llano(nombre)). Si la app
    // va en otro idioma y el nombre está guardado en castellano («Bola de
    // fuego» de una ficha de antes), también por su traducción.
    function deSrd(indice, nombre) {
        return indice[llano(nombre)] || indice[llano(window.ocTd(nombre))];
    }

    // Un hechizo: el del SRD (o uno tuyo), con su ventana; si no, el nombre.
    function conjuroPj(nombre, srd, fuente) {
        const c = deSrd(srd, nombre);
        return c ? botonConjuro(c, srd[llano(nombre)] ? nombre : c.nombre, fuente) : crear("span", "", nombre);
    }
    Object.assign(PM, { deSrd });

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
    Object.assign(PM, { SALVACIONES_PJ });
    // [clave, abreviatura, nombre] (las dos últimas, en el idioma de la app).
    const MONEDAS_PJ = [["pc", ocT("pc"), ocT("cobre")], ["pp", ocT("pp"), ocT("plata")], ["pe", ocT("pe"), ocT("electro")],
        ["po", ocT("po"), ocT("oro")], ["pt", ocT("ppt"), ocT("platino")]];
    Object.assign(PM, { MONEDAS_PJ });
    const avisarPjs = (desde) => document.dispatchEvent(new CustomEvent("master:pjs", { detail: { desde } }));
    Object.assign(PM, { avisarPjs });
    // LA PARTY Y LA INICIATIVA, A LA PAR: lo que se cambia en una (los PG)
    // se apunta en la otra.
    document.addEventListener("oc-iniciativa:pg", (e) => {
        const pj = todo && todo.pjs.find((x) => x.id === (e.detail || {}).pj);
        if (!pj) {
            return;
        }
        // Sus PG y sus salvaciones de muerte (si vienen).
        const muerte = e.detail.muerte === undefined ? pj.muerte : e.detail.muerte || undefined;
        if (String(pj.pg) === String(e.detail.pg) && JSON.stringify(pj.muerte) === JSON.stringify(muerte)) {
            return;
        }
        pj.pg = e.detail.pg;
        if (muerte) {
            pj.muerte = muerte;
        } else {
            delete pj.muerte;
        }
        guardar();
        avisarPjs("ini");
    });
    // Lo de la party a la iniciativa (sus PG, CA, PG máximos y salvaciones
    // de muerte): al cambiar la party y al empezar.
    document.addEventListener("master:pjs", (e) => {
        if ((e.detail || {}).desde !== "ini") {
            iniDesdeParty();
        }
    });
    function iniDesdeParty() {
        if (!todo || !Array.isArray(todo.pjs)) {
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
            const max = numPj(pj.pgmax);
            if (max !== null && max !== c.pgMax) {
                c.pgMax = max;
                cambia = true;
            }
            if (JSON.stringify(pj.muerte || null) !== JSON.stringify(c.muerte || null)) {
                if (pj.muerte) {
                    c.muerte = pj.muerte;
                } else {
                    delete c.muerte;
                }
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
    }

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
        ["ataques", "objetos", "pnjs", "acciones", "criaturas", "imagenes"].forEach((k) => {
            pj[k] = Array.isArray(pj[k]) ? pj[k] : [];
        });
        ["espacios", "dinero", "apuntes", "accionesDe"].forEach((k) => {
            pj[k] = pj[k] && typeof pj[k] === "object" && !Array.isArray(pj[k]) ? pj[k] : {};
        });
        pj.conjuros = Array.isArray(pj.conjuros) ? pj.conjuros : [];
        return pj;
    }

    const numPj = (v) => {
        const n = parseInt(v, 10);
        return isNaN(n) ? null : n;
    };
    Object.assign(PM, { numPj });
    const modDe = (n) => Math.floor((n - 10) / 2);
    Object.assign(PM, { modDe });
    const signo = (n) => (n >= 0 ? "+" : "−") + Math.abs(n);
    Object.assign(PM, { signo });
    const competenciaPj = (pj) => 2 + Math.floor((Math.max(1, numPj(pj.nivel) || 1) - 1) / 4);
    Object.assign(PM, { competenciaPj });
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
    Object.assign(PM, { dadoPj });

    function nuevoPj(datos) {
        const pj = normalizarPj(Object.assign({ nombre: ocT("Personaje nuevo"), nivel: 1, fue: 10, des: 10, con: 10, int: 10, sab: 10,
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
    Object.assign(PM, { pxParaSubir });
    const puedeSubir = (pj) => (numPj(pj.nivel) || 1) < 20 && (numPj(pj.px) || 0) >= pxParaSubir(pj);
    Object.assign(PM, { puedeSubir });
    // Los rasgos de clase del SRD de un nivel (los de su clase y, si la
    // tiene, su subclase).
    function rasgosDeNivel(lista, clase, nivel) {
        const cl = llano(clase || "");
        const base = cl.split(/[ (/]+/)[0];
        return lista.filter((r) => {
            if (r.tipo !== "rasgo de clase" || r.nivel !== nivel || /^subclase de /i.test(r.nombre) || / Subclass$/.test(r.en || "")) {
                return false;
            }
            // La clase de la ficha, en castellano o en el idioma de la app.
            return base && [r.de, verDato(r.de)].some((de) => {
                const m = /^(.*?)(?: \((.*)\))?$/.exec(de || "") || [];
                return llano(m[1] || "") === base && (!m[2] || cl.includes(llano(m[2])));
            });
        });
    }
    function subirNivel(pj) {
        const nuevo = Math.min(20, (numPj(pj.nivel) || 1) + 1);
        pj.nivel = nuevo;
        return pedir(RASGOS_SRD).catch(() => ({ rasgos: [] })).then((datos) => {
            const nuevos = rasgosDeNivel(datos.rasgos || [], pj.clase, nuevo).filter((r) => !llano(pj.rasgos || "")
                .includes("**" + llano(r.nombre) + "**"));
            if (nuevos.length) {
                pj.rasgos = (String(pj.rasgos || "").replace(/\s+$/, "") + "\n" + nuevos.map((r) => ocT("- **{nombre}** ({de}, nivel {nuevo})", { nombre: r.nombre, de: verDato(r.de), nuevo: nuevo })).join("\n")).trim();
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
        avisar(ocT("{toLocaleString} PX para cada uno ({n}).{n2}", { toLocaleString: cada.toLocaleString(window.ocLocale), n: pjs.length, n2: suben.length ? ocT(" Pueden subir de nivel: {join}.", { join: suben.map((pj) => pj.nombre).join(", ") }) : "" }));
        if (suben.length && vuelta) {
            verSubidas(suben, vuelta);
        }
    }
    function verSubidas(suben, vuelta) {
        const cuerpo = crear("div", "master-subidas");
        cuerpo.appendChild(crear("p", "", ocT("Tienen PX para subir de nivel:")));
        const ul = crear("ul", "master-subidas-lista");
        suben.forEach((pj) => {
            const li = crear("li");
            const que = crear("span", "", ocT("{n}: nivel {n2} → {n3} ", { n: pj.nombre || ocT("Sin nombre"), n2: numPj(pj.nivel) || 1, n3: (numPj(pj.nivel) || 1) + 1 }));
            const b = botonDe("oc-vida-accion es-principal", ocT("⬆ subir"), () => {
                b.disabled = true;
                subirNivel(pj).then((nuevos) => {
                    que.textContent = ocT("{n}: ya es nivel {nivel}. ", { n: pj.nombre || ocT("Sin nombre"), nivel: pj.nivel });
                    b.remove();
                    li.appendChild(crear("span", "oc-hoja-nota", nuevos.length ? ocT("Rasgos nuevos: {join}. Súbele los PG máximos a mano (✎ editar ficha).", { join: nuevos.map((r) => r.nombre).join(", ") }) : ocT("Súbele los PG máximos a mano (✎ editar ficha).")));
                    avisar(ocT("{n} sube a nivel {nivel}.", { n: pj.nombre || "", nivel: pj.nivel }));
                    li.tabIndex = -1;
                    li.focus();
                });
            }, ocT("Subir a {n} a nivel {n2}", { n: pj.nombre || ocT("este personaje"), n2: (numPj(pj.nivel) || 1) + 1 }));
            li.append(que, b);
            ul.appendChild(li);
        });
        cuerpo.appendChild(ul);
        window.ocVentana.abrir({ titulo: ocT("subir de nivel"), cuerpo, vuelta });
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
        } else if (/^https:\/\//.test(u) && CON_RED) {
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
            throw new Error(ocT("Eso no parece la ficha de un personaje de D&D Beyond."));
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
        pj.nombre = pj.nombreCompleto.split(" ")[0] || ocT("Sin nombre");
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
            avisos.push(ocT("La CA puede ser otra: «Defensa sin armadura» no la cuento. Repásala."));
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
        pj.velocidad = ocT("{pies} pies", { pies: pies });
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
                avisos.push(ocT("Lleva varias clases: los espacios de conjuro los tienes que poner tú."));
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
        pj.conjuros = conjuros.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1], window.ocLocale)).map((x) => x[1]);
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
                rasgos.push(ocT("- **{t}** (especie)", { t: t(nm) }));
            }
        });
        clases.forEach((c) => (c.classFeatures || []).forEach((f) => {
            const df = (f || {}).definition || {};
            if (df.name && (Number(df.requiredLevel) || 1) <= (Number(c.level) || 0) && !SOBRAN_DDB.includes(df.name.toLowerCase())
                && df.name !== "TBD" && !/^core .* traits$| subclass$|ability score improvement/i.test(df.name)) {
                rasgos.push(ocT("- **{t}** ({t2}, nivel {n})", { t: t(df.name), t2: t((c.definition || {}).name), n: df.requiredLevel || 1 }));
            }
        }));
        (d.feats || []).forEach((f) => {
            const nm = ((f || {}).definition || {}).name;
            if (nm) {
                rasgos.push(ocT("- **{t}** (dote)", { t: t(nm) }));
            }
        });
        pj.rasgos = Array.from(new Set(rasgos)).join("\n");
        // Acciones con usos.
        pj.acciones = [];
        pj.accionesDe = {};
        Object.values(d.actions || {}).forEach((l) => (l || []).forEach((a) => {
            const nm = String((a || {}).name || "").trim();
            if (!nm) {
                return;
            }
            const usos = (a.limitedUse || {}).maxUses;
            const rec = RECARGA_DDB[(a.limitedUse || {}).resetType] || "";
            const x = (ACCION_DDB[(a.activation || {}).activationType] || "Otras") + ": " + t(nm)
                + (usos ? " (" + usos + (usos === 1 ? ocT(" uso") : ocT(" usos")) + (rec ? ", " + rec : "") + ")" : "");
            if (!pj.acciones.includes(x)) {
                pj.acciones.push(x);
                // Su texto (sin el HTML), para abrirla desde la ficha.
                const desc = new DOMParser().parseFromString(String(a.description || a.snippet || ""), "text/html").body.textContent
                    .replace(/\{\{[^}]*\}\}/g, "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
                if (desc) {
                    pj.accionesDe[x] = desc;
                }
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
                const x = ocT("{n} {value} pies", { n: SENT[sub], value: mm.value });
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
        if (t.sin.length && window.ocLocale !== "en") {
            avisos.push(ocT("Sin traducir (cámbialo a mano si quieres): {join}{n}", { join: t.sin.slice(0, 30).join("; "), n: t.sin.length > 30 ? "…" : "" }));
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
            throw new Error(ocT("Eso no parece la página de un personaje de Nivel20."));
        }
        const avisos = [];
        const pj = {};
        const filas = desc.querySelectorAll(".col-12");
        pj.nombreCompleto = txt(desc.querySelector("h4")) || ocT("Sin nombre");
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
                pj.velocidad = ocT("{n} pies", { n: d ? parseFloat(d.getAttribute("data-value")) : num(txt(v)) });
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
            avisos.push(ocT("Lleva varias clases: repasa los espacios de conjuro."));
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
            pj.conjuros = vistos.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1], window.ocLocale)).map((x) => x[1]);
            if (magia.querySelector(".load-more-container button")) {
                avisos.push(ocT("Nivel20 enseña los conjuros por partes: si te falta alguno, añádelo a mano."));
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
            throw new Error(ocT("Eso no parece un personaje exportado de Foundry VTT."));
        }
        if (actor.type && actor.type !== "character" && actor.type !== "npc") {
            throw new Error(ocT("Ese JSON de Foundry no es un personaje."));
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
        pj.nombreCompleto = String(actor.name || "").trim() || ocT("Sin nombre");
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
        pj.velocidad = ocT("{pies} pies", { pies: pies });
        const SENT = { darkvision: "Visión en la oscuridad", blindsight: "Vista ciega", tremorsense: "Sentido de la vibración",
            truesight: "Visión verdadera" };
        const sentidos = [];
        [(at.senses || {}), (at.senses || {}).ranges || {}, (sis(raza || {}).senses || {}), ((sis(raza || {}).senses || {}).ranges || {})]
            .forEach((o) => Object.keys(SENT).forEach((k) => {
                const x = ocT("{n} {n2} pies", { n: SENT[k], n2: o[k] });
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
        const DEF = [["dr", "Resistencia"], ["di", "Inmunidad"], ["dv", "Vulnerabilidad"], ["ci", ocT("Inmune a")]];
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
            avisos.push(ocT("Tiene espacios de pacto ({n}): apúntalos tú si los quieres en la ficha.", { n: pacto.override || pacto.max }));
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
        pj.conjuros = conjuros.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1], window.ocLocale)).map((c) => c[1]);
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
            const tiposD = (base.types || []).map((d) => DANO_FVTT[d] || t(d)).join(ocT(" o "));
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
            avisos.push(ocT("Su foto se queda en tu Foundry: ponla con «✎ editar ficha» → 📷."));
        }
        if (t.sin.length && window.ocLocale !== "en") {
            avisos.push(ocT("Sin traducir (cámbialo a mano si quieres): {join}{n}", { join: t.sin.slice(0, 30).join("; "), n: t.sin.length > 30 ? "…" : "" }));
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
                throw new Error(ocT("Nivel20 no me deja verla ({status}). ¿Es pública la ficha?", { status: r.status }));
            }
            if (!r.ok) {
                throw new Error(ocT("No he podido hablar con Nivel20 ({status}). Prueba con su página guardada.", { status: r.status }));
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
                return Promise.reject(new Error(ocT("Eso no se puede leer: ¿está entero el JSON?")));
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
            r.avisos = r.avisos.map((a) => (/por partes/.test(a) ? ocT("{a} (con el programa o la app de Android, pegando el enlace, se traen todos)", { a: a }) : a));
            return Promise.resolve(Object.assign(r, { origen: "nivel20" }));
        }
        if (n20) {
            if (!CON_RED) {
                return Promise.reject(new Error(ocT("Desde el navegador no puedo preguntar a Nivel20: guarda su página (Ctrl+S) y elígela con «📄 desde un archivo», o usa el programa o la app de Android.")));
            }
            const ruta = n20[1].toLowerCase();
            return traerDeNivel20(ruta).then((html) => {
                const doc = new DOMParser().parseFromString(html, "text/html");
                return conjurosQueFaltanN20(doc, ruta).then(() => Object.assign(deNivel20(doc, "https://nivel20.com" + ruta),
                    { origen: "nivel20" }));
            });
        }
        if (ddbNum) {
            if (!CON_RED) {
                return Promise.reject(new Error(ocT("Desde el navegador no puedo preguntar a D&D Beyond: pega el JSON.")));
            }
            return fetch("__ddb?id=" + (ddbNum[1] || ddbNum[2]), { cache: "no-store" }).then((r) => {
                if (r.status === 403 || r.status === 404 || r.status === 401) {
                    throw new Error(ocT("D&D Beyond no me deja verla ({status}). ¿Es pública la ficha?", { status: r.status }));
                }
                if (!r.ok) {
                    throw new Error(ocT("No he podido hablar con D&D Beyond ({status}). Prueba a pegar el JSON.", { status: r.status }));
                }
                return r.json();
            }).then((datos) => Object.assign(deDdb(datos, t), { origen: "ddb" }));
        }
        return Promise.reject(new Error(ocT("No reconozco eso: pega el enlace de la ficha, su JSON o la página de Nivel20.")));
    }

    function abrirImportarPj(vuelta, pj) {
        const cuerpo = crear("form", "master-pegar");
        const ayuda = crear("ul", "master-importar-de");
        [[ocT("D&D Beyond"), CON_RED ? ocT("el enlace de la ficha (tiene que ser pública) o su JSON")
            : ocT("el JSON de character-service.dndbeyond.com/character/v5/character/ + su número (ficha pública)")],
        ["Nivel20", CON_RED ? ocT("el enlace de la ficha (pública)") : ocT("su página guardada (Ctrl+S → «sólo HTML») con «📄 desde un archivo»")],
        [ocT("Foundry VTT"), ocT("el JSON del personaje (clic derecho en el actor → «Exportar datos»), con «📄 desde un archivo»")]]
            .forEach(([de, como]) => {
                const li = crear("li");
                li.append(crear("strong", "", de + ": "), document.createTextNode(como + "."));
                ayuda.appendChild(li);
            });
        cuerpo.append(crear("p", "oc-hoja-nota", ocT("Puedes traerlo de:")), ayuda,
            crear("p", "master-importar-red", ocT("🌐 Con un enlace (D&D Beyond, Nivel20) hace falta conexión a internet: la ficha se trae de su página. Desde un archivo, no.")));
        const et = crear("label", "oc-dados-etiqueta", ocT("enlace, JSON o página"));
        const area = crear("textarea", "oc-dados-texto master-pegar-area");
        area.id = "master-importar-texto";
        area.rows = 4;
        et.htmlFor = area.id;
        // Si se trajo de un enlace, se recuerda: actualizarla es un toque.
        if (pj && pj.importadoDe) {
            area.value = pj.importadoDe;
        }
        const estado = crear("p", "oc-hoja-nota");
        estado.setAttribute("role", "status");
        const ok = crear("button", "oc-vida-accion es-principal", ocT("📥 traer"));
        ok.type = "submit";
        const archivo = crear("input");
        archivo.type = "file";
        archivo.accept = ".json,.html,.htm,application/json,text/html";
        archivo.hidden = true;
        const elegir = botonDe("oc-vida-accion", ocT("📄 desde un archivo"), () => archivo.click(),
            ocT("Elegir un archivo: el JSON de Foundry o de D&D Beyond, o la página guardada de Nivel20"));
        const fila = crear("div", "master-creador-barra");
        fila.append(ok, elegir);
        // Mientras se trae: la pantalla de carga (encima del formulario).
        const cargando = crear("div", "master-cargando");
        cargando.hidden = true;
        const rueda = crear("span", "master-cargando-rueda");
        rueda.setAttribute("aria-hidden", "true");
        const cargandoTexto = crear("p", "master-cargando-texto");
        cargando.append(rueda, cargandoTexto);
        cuerpo.append(et, area, fila, archivo, estado, cargando, crear("p", "oc-hoja-nota", ocT("Se traen sus números, competencias, conjuros, objetos, dinero e historia, y los rasgos por su nombre (no sus textos). Se queda en este dispositivo.")));
        const traer = (texto) => {
            const url = /^https?:\/\/\S+$/i.test(String(texto).trim()) ? String(texto).trim() : "";
            if (url && navigator.onLine === false) {
                estado.textContent = ocT("⚠️ No hay conexión a internet: para traerla de un enlace hace falta. Conéctate o usa «📄 desde un archivo».");
                return;
            }
            ok.disabled = true;
            elegir.disabled = true;
            estado.textContent = ocT("Trayendo…");
            cargandoTexto.textContent = url ? ocT("Trayendo la ficha de {sitio}…", { sitio: url.replace(/^https?:\/\/(www\.)?/i, "").split("/")[0] })
                : ocT("Leyendo la ficha…");
            cargando.hidden = false;
            cuerpo.setAttribute("aria-busy", "true");
            const acabar = () => {
                cargando.hidden = true;
                cuerpo.removeAttribute("aria-busy");
            };
            traductorDdb().then((t) => leerPjDe(texto, t)).then((r) => {
                if (pj && (pj.foto || pj.fotoUrl)) {
                    delete r.pj.fotoUrl;
                    return r;
                }
                return guardarFotoImportada(r.pj).then(() => r);
            }).then(({ pj: nuevo, avisos, origen }) => {
                acabar();
                let quien;
                if (url) {
                    nuevo.importadoDe = url;
                }
                if (pj) {
                    const guarda = { id: pj.id, apuntes: pj.apuntes, notas: pj.notas, pnjs: pj.pnjs, secretos: pj.secretos };
                    if (!url && pj.importadoDe) {
                        guarda.importadoDe = pj.importadoDe;
                    }
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
                avisar(ocT("Traído de {n}: {nombre}.{n2}", { n: ORIGENES_PJ[origen], nombre: quien.nombre, n2: avisos.length ? " " + avisos.join(" ") : "" }));
            }).catch((err) => {
                acabar();
                ok.disabled = false;
                elegir.disabled = false;
                estado.textContent = "⚠️ " + (url && err instanceof TypeError ? ocT("No he podido llegar a la página: ¿hay conexión a internet?")
                    : err && err.message && !/JSON/.test(err.name) ? err.message : ocT("Eso no se puede leer: ¿está entero?"));
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
                estado.textContent = ocT("⚠️ Ese archivo es demasiado grande.");
                return;
            }
            f.text().then(traer);
        });
        const cerrar = window.ocVentana.abrir({ titulo: pj ? ocT("actualizar la ficha") : ocT("traer un personaje"), cuerpo, vuelta, foco: area });
    }

    // ---- EL INVENTARIO COMÚN DE LA PARTY (todo.inventario): lo que llevan
    // entre todos (lo del SRD se abre), su dinero, y «dar a…» un PJ. ----
    function inventarioParty() {
        todo.inventario = todo.inventario && Array.isArray(todo.inventario.objetos) ? todo.inventario
            : { objetos: [], dinero: {}, notas: "" };
        todo.inventario.dinero = todo.inventario.dinero || {};
        return todo.inventario;
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

    const COLORES_LETRA = [["", ocT("la del tema")], ["#d23b3b", ocT("rojo")], ["#e07a1f", ocT("naranja")], ["#2f9e4f", ocT("verde")],
        ["#3b7ddd", ocT("azul")], ["#8e5bd6", ocT("morado")]];
    const COLORES_RESALTE = [["", ocT("sin resaltar")], ["#ffe873", ocT("amarillo")], ["#8fe8a2", ocT("verde")], ["#7fdcff", ocT("celeste")],
        ["#ffa6d5", ocT("rosa")], ["#ffb870", ocT("naranja")]];

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
        barra.setAttribute("aria-label", ocT("Formato del texto"));
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
        parrafo.setAttribute("aria-label", ocT("Tipo de párrafo"));
        parrafo.title = ocT("Tipo de párrafo");
        [["P", ocT("párrafo")], ["H3", ocT("título")], ["H4", ocT("subtítulo")], ["BLOCKQUOTE", ocT("cita")]].forEach(([v, n]) => {
            const o = crear("option", "", n);
            o.value = v;
            parrafo.appendChild(o);
        });
        parrafo.addEventListener("change", () => orden("formatBlock", parrafo.value));
        const tamano = crear("select", "master-postit-elegir");
        tamano.setAttribute("aria-label", ocT("Tamaño de la letra"));
        tamano.title = ocT("Tamaño de la letra");
        [["-", ocT("🗚 tamaño")], ["2", ocT("pequeña")], ["3", ocT("normal")], ["5", ocT("grande")], ["6", ocT("enorme")]].forEach(([v, n]) => {
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
            grupo(herramienta("B", ocT("Negrita"), "bold", null, "es-negrita", "Ctrl+B"),
                herramienta("I", ocT("Cursiva"), "italic", null, "es-cursiva", "Ctrl+I"),
                herramienta("U", ocT("Subrayado"), "underline", null, "es-subrayado", "Ctrl+U"),
                herramienta("S", ocT("Tachado"), "strikeThrough", null, "es-tachado")),
            grupo(parrafo),
            grupo(tamano),
            grupo(herramienta("•", ocT("Lista"), "insertUnorderedList"), herramienta("1.", ocT("Lista numerada"), "insertOrderedList"),
                herramienta("→", ocT("Más sangría"), "indent"), herramienta("←", ocT("Menos sangría"), "outdent")),
            grupo(herramienta("⇤", ocT("Alinear a la izquierda"), "justifyLeft"), herramienta("↔", ocT("Centrar"), "justifyCenter"),
                herramienta("⇥", ocT("Alinear a la derecha"), "justifyRight")),
            grupo(elegir(ocT("🎨 letra"), COLORES_LETRA, "foreColor", ocT("Color de la letra")), elegir(ocT("🖍️ resaltar"), COLORES_RESALTE, "hiliteColor", "Resaltar")),
            grupo(herramienta("―", ocT("Línea de separación"), "insertHorizontalRule"), herramienta("⌫", ocT("Quitar el formato"), "removeFormat"), herramienta("↶", ocT("Deshacer"), "undo", null, "", "Ctrl+Z"),
                herramienta("↷", ocT("Rehacer"), "redo", null, "", "Ctrl+Y")));
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

    // ---- EL GENERADOR DE NOMBRES: personajes por especie y género (de
    // sílabas, con su apellido) y lugares (pueblos, tabernas, parajes y
    // mazmorras), de datos/personajes/compendio/nombres.json. Cada nombre,
    // con «copiar». Y TUS TABLAS DE NOMBRES: nobles de un reino, una
    // ciudad, una cultura… (nombres enteros, uno por línea) y lo que cambies
    // de las de siempre; van en «richi-master-nombres» (pedirNombres). ----

    function alAzar(lista) {
        const u = new Uint32Array(1);
        crypto.getRandomValues(u);
        return lista[u[0] % lista.length];
    }

    // ---- TUS TABLAS DE NOMBRES («richi-master-nombres»): {propias:
    // [{id, nombre, tipo: "personaje"|"lugar", delante, f, m, n,
    // apellidos, primera, segunda}] (listas de nombres enteros), cambios:
    // {"especies/humano": {ini: […], …}, "apellidos/humano": {…},
    // "lugares/pueblo": {…}}} (lo que cambias de nombres.json; el archivo
    // no se toca). pedir(NOMBRES) da nombres.json con los cambios puestos
    // y las tuyas en «propias»: así los PNJ, los negocios y los dungeons
    // también usan lo cambiado. ----
    const CLAVE_NOMBRES = "richi-master-nombres";
    Object.assign(PM, { CLAVE_NOMBRES });
    let nombresCrudo = null;
    function leerNombresTuyos() {
        let x = {};
        try {
            x = JSON.parse(localStorage.getItem(CLAVE_NOMBRES) || "{}") || {};
        } catch (e) {
            x = {};
        }
        return { propias: Array.isArray(x.propias) ? x.propias : [], cambios: x.cambios && typeof x.cambios === "object" ? x.cambios : {} };
    }
    function pedirNombres() {
        if (!nombresCrudo) {
            nombresCrudo = fetch(NOMBRES).then((r) => {
                if (!r.ok) {
                    throw new Error(r.status);
                }
                return r.json().then(window.ocIdioma.datos).then(nombresEnSuIdioma);
            });
        }
        return nombresCrudo.then((d) => {
            const tuyo = leerNombresTuyos();
            const x = Object.assign({}, d, { propias: tuyo.propias, cambiadas: {} });
            ["especies", "apellidos", "lugares"].forEach((g) => {
                x[g] = Object.assign({}, d[g]);
            });
            Object.keys(tuyo.cambios).forEach((clave) => {
                const [g, k] = clave.split("/");
                if (x[g] && x[g][k] && tuyo.cambios[clave]) {
                    x[g][k] = Object.assign({}, x[g][k], tuyo.cambios[clave]);
                    x.cambiadas[clave] = true;
                }
            });
            x.original = d;
            return x;
        });
    }
    // «Sir | Lady»: masculino | femenino (el neutro, el último); «-»,
    // nada (para que no todos lleven título).
    function delanteDe(linea, g) {
        const partes = linea.split("|").map((s) => s.trim());
        const sale = partes.length < 2 ? partes[0] : g === "f" ? partes[1] : g === "n" ? partes[partes.length - 1] : partes[0];
        return /^[-—–]$/.test(sale) ? "" : sale;
    }
    function nombrePropio(t, genero, conApellido) {
        const hay = ["f", "m", "n"].filter((g) => (t[g] || []).length);
        if (!hay.length) {
            return "";
        }
        const g = hay.indexOf(genero) >= 0 ? genero : alAzar(hay);
        let nombre = alAzar(t[g]);
        if ((t.delante || []).length) {
            const d = delanteDe(alAzar(t.delante), g);
            nombre = d ? d + " " + nombre : nombre;
        }
        if (conApellido && (t.apellidos || []).length) {
            nombre += " " + alAzar(t.apellidos);
        }
        return nombre;
    }
    function lugarPropio(t) {
        const a = (t.primera || []).length ? alAzar(t.primera) : "";
        const b = (t.segunda || []).length ? alAzar(t.segunda) : "";
        return (a + " " + b).trim();
    }
    const propiaDe = (datos, clave) => (datos.propias || []).find((t) => "propia:" + t.id === clave);
    Object.assign(PM, { propiaDe });

    function nombreDe(datos, especie, genero, conApellido) {
        const tuya = propiaDe(datos, especie);
        if (tuya) {
            return nombrePropio(tuya, genero, conApellido);
        }
        const e = datos.especies[especie] || datos.especies.humano;
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

    // En inglés, los apellidos (sus trozos no se traducen: se pegan) salen
    // de los de «en» (nombres.json).
    function nombresEnSuIdioma(d) {
        const otro = window.ocLocale === "en" && d.en;
        if (!otro) {
            return d;
        }
        const x = Object.assign({}, d);
        x.apellidos = Object.assign({}, d.apellidos, otro.apellidos || {});
        return x;
    }
    // «El Grifo» + «Torcido» (o «La Cabra» + «Torcida»); en inglés, el
    // adjetivo va delante: «The Crooked Griffon».
    function nombreConAdjetivo(sust, g, adj) {
        const a = g === "f" ? adj[1] : adj[0];
        const m = window.ocLocale === "en" && /^The (.+)$/.exec(sust);
        return m ? "The " + a + " " + m[1] : sust + " " + a;
    }
    Object.assign(PM, { nombreConAdjetivo });
    function lugarDe(datos, tipo) {
        const tuya = propiaDe(datos, tipo);
        if (tuya) {
            return lugarPropio(tuya);
        }
        const l = datos.lugares[tipo];
        if (tipo === "taberna") {
            const [sust, g] = alAzar(l.sust);
            return nombreConAdjetivo(sust, g, alAzar(l.adj));
        }
        // «Villa» + «seca», pegados, sólo en castellano.
        if (tipo === "pueblo" && window.ocLocale !== "en" && alAzar([0, 1])) {
            return alAzar(l.pre) + alAzar(l.adj);
        }
        // («de» es fijo en los datos: se traduce al ponerlo.)
        return alAzar(l.base) + " " + verDato(alAzar(l.de));
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
            navigator.clipboard.writeText(texto).then(() => avisar(aviso || "Copiado.")).catch(() => avisar(ocT("No se ha podido copiar.")));
        }
    }

    // ---- NOTAS EN OTROS IDIOMAS: se escribe (o se saca al azar) lo que
    // pone y se ve en el alfabeto de ese idioma, para enseñárselo a la
    // mesa. Los idiomas, sus letras y sus sílabas, en
    // datos/personajes/compendio/idiomas.json; las letras son fuentes Noto
    // (OFL) de escrituras reales, en tipografias/noto-*.woff2. Dos formas:
    // «letra a letra» (se puede descifrar) o «palabras inventadas» (cada
    // palabra pasa a una del idioma, siempre la misma). ----
    const IDIOMAS = "datos/personajes/compendio/idiomas.json";
    Object.assign(PM, { IDIOMAS });

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

    // ---- BOTÍN Y ENCUENTROS: generadores PROPIOS (las tablas de la DMG y
    // la Xanathar's no son del SRD). Las monedas, gemas y obras de arte,
    // en tablas inventadas aquí; los objetos mágicos y los monstruos, del
    // SRD (tienda.json y bestiario.json). ----
    const TIENDA = "datos/personajes/compendio/tienda.json";
    Object.assign(PM, { TIENDA });
    const BESTIARIO = "datos/personajes/compendio/bestiario.json";
    Object.assign(PM, { BESTIARIO });

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
        10: [ocT("ágata"), ocT("cuarzo azul"), ocT("hematites"), ocT("lapislázuli"), ocT("malaquita"), ocT("obsidiana"), ocT("ojo de tigre"), ocT("turquesa")],
        50: [ocT("calcedonia"), ocT("citrino"), ocT("cornalina"), ocT("jaspe sanguíneo"), ocT("ónice"), ocT("piedra de luna"), ocT("cuarzo rosa"), ocT("circón")],
        100: [ocT("ámbar"), ocT("amatista"), ocT("coral rojo"), ocT("granate"), ocT("jade"), ocT("perla"), ocT("espinela"), ocT("turmalina")],
        500: [ocT("aguamarina"), ocT("alejandrita"), ocT("perla negra"), ocT("peridoto"), ocT("topacio dorado"), ocT("espinela azul")],
        1000: [ocT("ópalo negro"), ocT("ópalo de fuego"), ocT("zafiro azul"), ocT("esmeralda"), ocT("zafiro estrella"), ocT("rubí estrella")],
        5000: [ocT("diamante"), ocT("rubí sangre"), ocT("zafiro negro"), ocT("jacinto"), ocT("esmeralda sin defecto")],
    };
    const BOTIN_ARTE = {
        25: [ocT("un aguamanil de cobre con asas de serpiente"), ocT("una baraja de naipes pintados a mano"),
            ocT("un espejo de mano con marco de plata"), ocT("una figurita de hueso tallado de un búho"), ocT("un par de dados de marfil"),
            ocT("un incensario de latón"), ocT("un pañuelo de seda bordado"), ocT("una pipa de brezo con boquilla de ámbar")],
        250: [ocT("una copa de plata con incrustaciones de ámbar"), ocT("un tapiz pequeño de una cacería"),
            ocT("un broche de oro con forma de hoja"), ocT("una caja de música de nogal"), ocT("una máscara ceremonial de bronce"),
            ocT("un catalejo de latón grabado"), ocT("un anillo de sello de oro"), ocT("un cuadro al óleo de un puerto")],
        750: [ocT("una corona de plata con perlas"), ocT("un cáliz de oro con granates"), ocT("una daga ceremonial con empuñadura de jade"),
            ocT("un tablero de ajedrez de ébano y marfil"), ocT("un collar de cuentas de amatista"),
            ocT("una estatuilla de oro de un dragón dormido")],
        2500: [ocT("un brazalete de platino con zafiros"), ocT("un ídolo de jade del tamaño de un puño"),
            ocT("una diadema de oro con esmeraldas"), ocT("un relicario de oro con un retrato en miniatura"),
            ocT("un tapiz enorme tejido con hilo de oro")],
        7500: [ocT("una corona de oro con rubíes"), ocT("un cetro de platino con un diamante en la punta"),
            ocT("una armadura ceremonial dorada, de adorno"), ocT("una estatua de mithral de una diosa"),
            ocT("un huevo de oro con joyas incrustadas")],
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
    const QUE_HACEN = [ocT("acampando alrededor de una hoguera"), ocT("de caza"), ocT("peleándose entre ellos"), ocT("persiguiendo a alguien"),
        ocT("vigilando algo que no quieren que se vea"), ocT("durmiendo (casi todos)"), ocT("de paso, sin prisa"), ocT("preparando una emboscada"),
        ocT("huyendo de algo peor"), ocT("repartiéndose un botín"), ocT("perdidos"), ocT("buscando a los PJ")];
    // Los PX de un monstruo de VD 1 a 20 (los de sus perfiles del SRD).
    const PX_POR_VD = [200, 450, 700, 1100, 1800, 2300, 2900, 3900, 5000, 5900, 7200, 8400, 10000, 11500, 13000, 15000, 18000,
        20000, 22000, 25000];
    const pxDe = (b) => {
        const m = /\(([\d.]+) PX/.exec(b.vd || "");
        return m ? parseInt(m[1].replace(/\./g, ""), 10) : 0;
    };
    Object.assign(PM, { pxDe });
    const vdNum = (vd) => (vd.indexOf("/") >= 0 ? 1 / parseInt(vd.split("/")[1], 10) : parseFloat(vd));
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

    // ---- LAS TABLAS PROPIAS (datos/personajes/compendio/master-tablas.json):
    // PNJ, dungeons y calendarios. Todo inventado aquí. ----
    const TABLAS = "datos/personajes/compendio/master-tablas.json";
    Object.assign(PM, { TABLAS });

    // ---- LOS RELOJES (de progreso): un círculo partido en 4 a 12 trozos
    // que se van llenando (una amenaza que avanza, una cuenta atrás…).
    // Varios por ventana; − y + (o pinchar en un trozo) los mueven. ----
    const SVG = "http://www.w3.org/2000/svg";
    Object.assign(PM, { SVG });

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
    // «agrupar» (el nombre sin número: «Lobo»): si ya hay otros iguales
    // (Lobo 1, Lobo 2…), entra en su grupo, con su iniciativa y detrás de
    // ellos, sin tirar (en la iniciativa, 🔓 lo separa).
    function meterEnIniciativa(c, numerar, agrupar) {
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
        const patron = agrupar ? new RegExp("^" + agrupar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?: \\d+)?$") : null;
        const iguales = patron ? datos.lista.filter((x) => !x.pj && patron.test(x.nombre)) : [];
        const con = iguales.length ? iguales[iguales.length - 1] : null;
        const r = con || !window.ocDados ? null : window.ocDados.tirar("1d20" + (bono ? (bono > 0 ? "+" : "") + bono : ""),
            ocT("iniciativa de {nombre}", { nombre: nombre }));
        const entra = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nombre, color: c.color,
            ini: con ? con.ini : r ? r.total : 10 + bono, ca: parseInt(c.ca, 10) || "", pg: c.pg === undefined ? "" : c.pg };
        if (con) {
            const g = con.grupo || "g" + con.id;
            con.grupo = g;
            entra.grupo = g;
        }
        // De la party (para llevar sus PG a su ficha), sus acciones
        // legendarias y su bono a la salvación de Constitución (concentración).
        // Sus PG máximos: los suyos o, si no, con los que entra.
        entra.pgMax = numPj(c.pgMax) !== null ? numPj(c.pgMax) : numPj(entra.pg) !== null ? numPj(entra.pg) : "";
        ["pj", "leg", "con", "bicho"].forEach((k) => {
            if (c[k] !== undefined && c[k] !== "" && c[k] !== null) {
                entra[k] = c[k];
            }
        });
        if (con) {
            // Detrás del último de su grupo.
            let i = datos.lista.indexOf(con);
            while (i + 1 < datos.lista.length && datos.lista[i + 1].grupo === entra.grupo) {
                i += 1;
            }
            datos.lista.splice(i + 1, 0, entra);
        } else {
            datos.lista.push(entra);
        }
        try {
            localStorage.setItem(CLAVE_INI, JSON.stringify(datos));
        } catch (e) {
            // Sin almacenamiento: da igual.
        }
        document.dispatchEvent(new CustomEvent("oc-iniciativa:cambio"));
        return nombre;
    }

    // Cuántas acciones legendarias tiene (3 si no lo dice): en castellano
    // o en inglés, de 2024 («Usos de acción legendaria: 3») o de 2014
    // («puede realizar 3 acciones legendarias»).
    function usosLegendarios(b) {
        const m = /(?:Usos de acción legendaria|Legendary Action Uses):\*? (\d+)|(?:puede realizar|can take) (\d+) (?:acciones legendarias|legendary actions)/
            .exec(b.legInfo || "") || [];
        return parseInt(m[1] || m[2], 10) || 3;
    }
    // Lo que la iniciativa necesita de un monstruo: sus legendarias y su
    // salvación de Constitución.
    function iniDeBicho(b) {
        const leg = (b.legendarias && b.legendarias.length) ? usosLegendarios(b) : 0;
        const salv = /Con ([+−-]\d+)/.exec(b.salv || "");
        const con = salv ? parseInt(salv[1].replace("−", "-"), 10) : b.car && b.car.Con ? modDe(Number(b.car.Con)) : undefined;
        // «bicho»: quién es en el bestiario (para la ventana de la criatura
        // del turno).
        return { nombre: b.nombre, bono: b.ini, ca: b.ca, pg: b.pg || "", color: "#d23b3b", leg: leg || undefined, con,
            bicho: b.en || b.nombre };
    }
    // Y de un PJ: su ficha (para sus PG) y su salvación de Constitución.
    function iniDePj(pj, nombre) {
        const d = numPj(pj.des);
        const con = numPj(pj.con);
        const salvaCon = (pj.salvaciones || []).includes("con");
        return { nombre, bono: d === null ? 0 : modDe(d), ca: pj.ca, pg: numPj(pj.pg) === null ? numPj(pj.pgmax) : numPj(pj.pg), pgMax: numPj(pj.pgmax),
            color: "#3fae5a", pj: pj.id, con: con === null ? undefined : modDe(con) + (salvaCon ? competenciaPj(pj) : 0) };
    }

    function aLaIniciativa(b, boton, nombreBase) {
        // Una del tablero va con su nombre («Lobo 2», «Elminster») si no
        // está ya; si no, con número si se repite (Lobo 1, Lobo 2…).
        const nombre = meterEnIniciativa(Object.assign(iniDeBicho(b), { nombre: nombreBase || b.nombre }), (nombres, renombrar) => (nombreBase && nombreBase !== b.nombre && nombres.indexOf(nombreBase) < 0 ? nombreBase
            : conNumero(b.nombre, nombres, renombrar)), b.nombre);
        avisar(ocT("A la iniciativa: {nombre}.", { nombre: nombre }));
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
            dd.appendChild(window.ocDadoBoton(m[2], "1d20" + (n >= 0 ? "+" : "") + n, ocT("{que} de {n}", { que: que, n: m[1] })));
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
        caja.setAttribute("aria-label", ocT("Usos de {que}", { que: que }));
        const pintar = () => {
            caja.replaceChildren(...Array.from({ length: n }, (x, i) => {
                const gastado = i < (usos[clave] || 0);
                const b = botonDe("master-uso", "", () => {
                    usos[clave] = gastado ? i : i + 1;
                    pintar();
                    alCambiar();
                    caja.querySelectorAll(".master-uso")[i].focus();
                    avisar(ocT("{que}: {n} de {n2} gastados.", { que: que, n: usos[clave] || 0, n2: n }));
                }, ocT("{que}, uso {n} de {n2}", { que: que, n: i + 1, n2: n }));
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
            // En castellano («*Ataque cuerpo a cuerpo:* +4, alcance 5 ft.
            // *Impacto:* …») o en inglés («*Melee Attack Roll:* +4, reach 5
            // ft. *Hit:* …»).
            const m = /^\*((?:Ataque|Melee|Ranged)[^:*]*):\* ([+−-]\d+)(?: to hit)?, ([^*]+?) \*(?:Impacto|Hit):\* (.*)$/s.exec(r.t);
            if (!m) {
                return;
            }
            const resto = m[4];
            const corte = resto.search(/\.(\s|$)/);
            filas.push({ r, tipo: m[1].replace(/^Ataque /, "").replace(/ (?:Weapon |Spell )?Attack(?: Roll)?$/, ""), bono: m[2], alcance: m[3],
                dano: corte >= 0 ? resto.slice(0, corte + 1) : resto, efecto: corte >= 0 ? resto.slice(corte + 1).trim() : "" });
        });
        if (!filas.length) {
            return null;
        }
        const tabla = crear("table", "master-ataques");
        tabla.appendChild(crear("caption", "visually-hidden", ocT("Ataques")));
        const cab = crear("tr");
        [ocT("Ataque"), ocT("Bono"), ocT("Alcance"), ocT("Daño")].forEach((t) => {
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
            tdB.appendChild(window.ocDadoBoton ? window.ocDadoBoton(x.bono, "1d20" + (n >= 0 ? "+" : "") + n, ocT("{n} · ataque", { n: x.r.n }))
                : document.createTextNode(x.bono));
            const tdA = crear("td", "", x.alcance);
            const tdD = crear("td", "master-ataque-dano");
            // «10 (2d6 + 3) de daño cortante.»: el dado, grande y entero
            // (sin que el paréntesis se quede colgando), y al lado la media
            // y el tipo; el efecto, debajo.
            const d = /^(\d+) \(([^()]+)\) (?:de )?daño (?:de )?([^.,]+?)([.,].*)?$/s.exec(x.dano.trim())
                || /^(\d+) \(([^()]+)\) ([A-Za-z]+) damage([.,].*)?$/s.exec(x.dano.trim());
            if (d && window.ocDadoBoton) {
                const linea = crear("p", "master-ataque-dado");
                linea.append(window.ocDadoBoton(d[2], d[2].replace(/\s+/g, "").replace("−", "-"), ocT("{n} · daño", { n: x.r.n })),
                    crear("span", "master-ataque-media", ocT(" {n} · media {n2}", { n: d[3], n2: d[1] })));
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
        const tipo = crear("p", "master-bicho-tipo", verDato(b.tipo) + ", " + b.alin);
        const cabeza = crear("div", "master-bicho-cabeza");
        cabeza.append(tokenDe(b, true), tipo);
        caja.appendChild(cabeza);
        if (guardado && guardado.nombre) {
            // En el tablero, qué es de verdad (si se le ha cambiado el
            // nombre) y un botón para cambiárselo.
            const cambiar = botonDe("master-bicho-renombrar", ocT("✎ nombre"), () => guardado.renombrar(cambiar),
                ocT("Cambiar el nombre de {quien}", { quien: quien() }));
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
        const sumar = botonDe("oc-vida-accion es-principal", ocT("＋ a la iniciativa"), () => aLaIniciativa(b, sumar, quien()),
            ocT("Añadir {quien} a la iniciativa (tira su iniciativa)", { quien: quien() }));
        const botones = crear("div", "master-bicho-botones");
        botones.appendChild(sumar);
        if (alTablero) {
            botones.appendChild(botonDe("oc-vida-accion", ocT("📌 al tablero"), alTablero, ocT("Poner {nombre} en el tablero, como una ventana", { nombre: b.nombre })));
        }
        const recuperar = botonDe("oc-vida-accion", ocT("↺ recuperar usos"), () => {
            Object.keys(usos).forEach((k) => delete usos[k]);
            repintables.forEach((r) => r.repintar());
            alCambiar();
            avisar(ocT("Usos recuperados."));
        }, ocT("Recuperar todos los usos (descanso largo)"));
        botones.appendChild(recuperar);
        caja.appendChild(botones);

        // ---- estadísticas ----
        const stats = crear("div", "master-bicho-panel");
        const arriba = crear("dl", "master-bicho-datos");
        fila(arriba, ocT("CA"), b.ca);
        fila(arriba, ocT("Iniciativa"), b.ini);
        fila(arriba, ocT("PG"), b.pg + (b.pgf ? " (" + b.pgf + ")" : ""));
        fila(arriba, ocT("Velocidad"), b.vel);
        const tabla = crear("table", "master-bicho-car");
        tabla.appendChild(crear("caption", "visually-hidden", ocT("Características")));
        const cab = crear("tr");
        const val = crear("tr");
        Object.keys(b.car).forEach((k) => {
            const th = crear("th", "", ocT(k));
            th.scope = "col";
            cab.appendChild(th);
            const n = b.car[k];
            const mo = Math.floor((n - 10) / 2);
            const td = crear("td", "", n + " ");
            const bono = (mo >= 0 ? "+" : "−") + Math.abs(mo);
            td.appendChild(window.ocDadoBoton ? window.ocDadoBoton("(" + bono + ")", "1d20" + (mo >= 0 ? "+" : "") + mo,
                ocT("prueba de {k}", { k: ocT(k) })) : document.createTextNode("(" + bono + ")"));
            val.appendChild(td);
        });
        const thead = crear("thead");
        thead.appendChild(cab);
        const tbody = crear("tbody");
        tbody.appendChild(val);
        tabla.append(thead, tbody);
        const abajo = crear("dl", "master-bicho-datos");
        if (b.salv) {
            abajo.append(crear("dt", "", ocT("Salvaciones")), bonosQueSeTiran(b.salv, ocT("salvación")));
        }
        if (b.hab) {
            abajo.append(crear("dt", "", ocT("Habilidades")), bonosQueSeTiran(b.hab, ocT("prueba")));
        }
        fila(abajo, ocT("Vulnerabilidades"), b.vuln);
        fila(abajo, ocT("Resistencias"), b.res);
        fila(abajo, ocT("Inmunidades"), [b.inm, b.inmE].filter(Boolean).join("; "));
        fila(abajo, ocT("Equipo"), b.equipo);
        fila(abajo, ocT("Sentidos"), b.sent);
        fila(abajo, ocT("Idiomas"), b.idio);
        fila(abajo, ocT("VD"), b.vd);
        fila(abajo, ocT("Hábitat"), (b.habitat || []).map(verDato).join(", "));
        stats.append(arriba, tabla, abajo);

        // Un rasgo o acción: su nombre en negrita (con sus casillas si se
        // gasta) y su texto.
        const entrada = (r, seccion) => {
            const div = crear("div", "master-bicho-entrada");
            const cabeza = crear("p", "master-bicho-nombre");
            cabeza.appendChild(crear("strong", "", r.n));
            const rec = /(?:Recarga|Recharge) (\d)(?:–6)?/.exec(r.n);
            const dia = /\((\d+)\/(?:día|Day)/.exec(r.n);
            if (rec) {
                const clave = seccion + ":" + r.n;
                const c = casillas(usos, clave, 1, r.n, alCambiar);
                repintables.push(c);
                const desde = parseInt(rec[1], 10);
                const tirarRecarga = botonDe("master-recarga", ocT("🎲 recarga"), () => {
                    const t = window.ocDados ? window.ocDados.tirar("1d6", ocT("recarga de {n}", { n: r.n })) : null;
                    if (t && t.total >= desde) {
                        usos[clave] = 0;
                        c.repintar();
                        alCambiar();
                        avisar(ocT("{n}: recargada ({total}).", { n: r.n, total: t.total }));
                    } else if (t) {
                        avisar(ocT("{n}: sin recargar ({total}).", { n: r.n, total: t.total }));
                    }
                }, ocT("Tirar la recarga de {n} ({desde} o más en 1d6)", { n: r.n, desde: desde }));
                cabeza.append(c, tirarRecarga);
            } else if (dia) {
                const c = casillas(usos, seccion + ":" + r.n, parseInt(dia[1], 10), r.n, alCambiar);
                repintables.push(c);
                cabeza.appendChild(c);
            }
            div.append(cabeza, markdown(r.t));
            return div;
        };
        const paneles = [[ocT("estadísticas"), stats]];
        if (b.rasgos && b.rasgos.length) {
            const panel = crear("div", "master-bicho-panel");
            b.rasgos.forEach((r) => panel.appendChild(entrada(r, "rasgos")));
            paneles.push([ocT("rasgos"), panel]);
        }
        // LAS ACCIONES: acciones, adicionales, reacciones y legendarias en
        // una pestaña, con un desplegable para elegir cuáles se ven.
        const partes = [];
        [["acciones", ocT("acciones")], ["adicionales", ocT("acciones adicionales")], ["reacciones", ocT("reacciones")],
            ["legendarias", ocT("legendarias")]].forEach(([k, titulo]) => {
            if (!b[k] || !b[k].length) {
                return;
            }
            const parte = crear("div", "master-bicho-parte");
            let lista = b[k];
            if (k === "legendarias" && b.legInfo) {
                const cuantas = usosLegendarios(b);
                const p = crear("p", "master-bicho-nombre");
                p.appendChild(crear("strong", "", ocT("Usos")));
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
                const etVer = crear("label", "oc-dados-etiqueta", ocT("ver"));
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
            paneles.push([ocT("acciones"), panel]);
        }
        if (b.conjuros) {
            const panel = crear("div", "master-bicho-panel");
            panel.appendChild(markdown(b.conjuros.t));
            panel.appendChild(crear("p", "oc-hoja-nota", ocT("Se lanzan como {donde}.", { donde: verDato(b.conjuros.donde) })));
            b.conjuros.listas.forEach((l, i) => {
                const div = crear("div", "master-bicho-entrada");
                const cabeza = crear("p", "master-bicho-nombre");
                cabeza.appendChild(crear("strong", "", verDato(l.et)));
                if (l.usos && !l.cada) {
                    const c = casillas(usos, "conj:" + i, l.usos, verDato(l.et), alCambiar);
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
            paneles.push([ocT("hechizos"), panel]);
        }

        paneles.push([ocT("imagen"), panelImagen("monstruo:" + b.en, b.nombre)]);

        // LAS PESTAÑAS: estadísticas, rasgos, acciones, hechizos (las que
        // tenga) e imagen, con las flechas para ir de una a otra.
        let actual = (guardado && guardado.pestana) || 0;
        if (actual >= paneles.length) {
            actual = 0;
        }
        const lista = crear("div", "master-bicho-pestanas");
        lista.setAttribute("role", "tablist");
        lista.setAttribute("aria-label", ocT("Partes del perfil de {quien}", { quien: quien() }));
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

    // ---- TURNO A TURNO: la iniciativa vista de otra manera (para el modo
    // combate). Leen y guardan lo mismo que ⏱️ iniciativa (window.ocTurnos,
    // en personajes.js), así que pasar de turno aquí o allí es lo mismo. ----
    const colorIni = (c) => (/^#[0-9a-f]{6}$/i.test(c.color || "") ? c.color
        : { personaje: "#3fae5a", npc: "#3b7ddd", monstruo: "#d23b3b" }[c.tipo] || "#3fae5a");
    Object.assign(PM, { colorIni });
    const textoMarcaIni = (mk) => verDato(mk.t) + (mk.r ? " (" + mk.r + (mk.r === 1 ? ocT(" ronda") : ocT(" rondas")) + ")" : "");
    // Lo de un combatiente que se ve de un vistazo: iniciativa, CA, PG y
    // sus marcas (cegado, concentrado…).
    function datosIni(c, conMarcas) {
        const caja = crear("div", "master-turnos-datos");
        const temp = parseInt(c.temp, 10) > 0 ? ocT(" (+{n} temp.)", { n: c.temp }) : "";
        [[ocT("ini"), c.ini], [ocT("CA"), c.ca], [ocT("PG"), c.pg === "" || c.pg === undefined || c.pg === null ? c.pg : c.pg + temp]].forEach(([k, v]) => {
            if (v === "" || v === undefined || v === null) {
                return;
            }
            const chapa = crear("span", "master-turnos-chapa");
            chapa.append(crear("span", "master-turnos-chapa-et", k), document.createTextNode(" " + v));
            caja.appendChild(chapa);
        });
        const marcas = Array.isArray(c.marcas) ? c.marcas : [];
        // Con su dibujo y que se pulsan (las de la iniciativa: ocTurnos).
        const chapas = conMarcas && marcas.length && c.id && window.ocTurnos.chapas ? window.ocTurnos.chapas(c.id) : null;
        if (chapas) {
            caja.appendChild(chapas);
        } else if (conMarcas && marcas.length) {
            const ul = crear("ul", "oc-ini-marcas");
            ul.setAttribute("aria-label", ocT("Marcas de {nombre}", { nombre: c.nombre }));
            marcas.forEach((mk) => ul.appendChild(crear("li", "oc-ini-marca", textoMarcaIni(mk))));
            caja.appendChild(ul);
        }
        return caja;
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

    // ---- LA TIENDA: los objetos del SRD 5.2 con su precio
    // (datos/personajes/compendio/tienda.json), por tienda, categoría y
    // rareza, con los precios al gusto (de saldo… abusivos) y un «surtido
    // al azar» que se queda guardado (lo que hay hoy en esa tienda). ----
    const RAREZAS = ["común", "poco común", "rara", "muy rara", "legendaria"];
    Object.assign(PM, { RAREZAS });

    function moneda(cp) {
        const total = Math.round(cp);
        const po = Math.floor(total / 100);
        const pp = Math.floor((total % 100) / 10);
        const pc = total % 10;
        const trozos = [];
        if (po) {
            trozos.push(ocT("{toLocaleString} po", { toLocaleString: po.toLocaleString(window.ocLocale) }));
        }
        if (pp) {
            trozos.push(ocT("{pp} pp", { pp: pp }));
        }
        if (pc || !trozos.length) {
            trozos.push(ocT("{pc} pc", { pc: pc }));
        }
        return trozos.join(" ");
    }

    // ---- EL CONVERSOR DE MONEDAS: cuánto es en cada moneda, y repartir
    // entre varios (1 ppt = 10 po; 1 po = 2 pe = 10 pp = 100 pc). ----
    const MONEDAS = [["ppt", "platino", 1000], ["po", "oro", 100], ["pe", "electro", 50], ["pp", "plata", 10], ["pc", "cobre", 1]];
    Object.assign(PM, { MONEDAS });

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
    Object.assign(PM, { docsDe });
    const idDoc = (pre) => pre + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    Object.assign(PM, { idDoc });
    const avisarDocs = () => document.dispatchEvent(new CustomEvent("master:documentos"));
    Object.assign(PM, { avisarDocs });
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
    // Las carpetas como opciones de un desplegable, con sangría.
    function opcionesCarpetas(sin) {
        const { carpetas } = docsDe();
        const salen = [["", ocT("📁 documentos (fuera de carpetas)")]];
        const bajar = (padre, nivel) => carpetas.filter((c) => (c.padre || null) === padre && sin.indexOf(c.id) < 0)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, window.ocLocale)).forEach((c) => {
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
    Object.assign(PM, { MAX_ARCHIVO });
    function baseArchivos() {
        return new Promise((hecho, fallo) => {
            if (!window.indexedDB) {
                fallo(new Error(ocT("sin IndexedDB")));
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
    // Quién puede preguntar a otras webs (para importar un personaje por su
    // enlace): el programa de escritorio y la app de Android; el navegador no.
    const CON_RED = EN_CARPETA || !!window.ocAndroid;
    // Dentro de la app de Android (android/: window.ocAndroid lo pone ella).
    const EN_ANDROID = !!window.ocAndroid;
    Object.assign(PM, { EN_ANDROID });

    // LA PANTALLA ENCENDIDA durante la partida (⚙ opciones): en la app de
    // Android, con la propia app (por defecto, sí); en un navegador que
    // sepa hacerlo, con el «wake lock» (por defecto, no), y sólo mientras
    // la página está a la vista.
    const CLAVE_ENCENDIDA = "richi-master-pantalla-encendida";
    const PUEDE_ENCENDIDA = EN_ANDROID || !!(navigator.wakeLock && navigator.wakeLock.request);
    let cerrojoPantalla = null;
    function encendidaElegida() {
        let v = null;
        try {
            v = localStorage.getItem(CLAVE_ENCENDIDA);
        } catch (e) {
            v = null;
        }
        return v === null ? EN_ANDROID : v === "si";
    }
    function aplicarEncendida() {
        const si = encendidaElegida();
        if (EN_ANDROID) {
            window.ocAndroid.encendida(si);
            return;
        }
        if (!PUEDE_ENCENDIDA) {
            return;
        }
        if (si && document.visibilityState === "visible" && !cerrojoPantalla) {
            navigator.wakeLock.request("screen").then((c) => {
                cerrojoPantalla = c;
                c.addEventListener("release", () => {
                    cerrojoPantalla = null;
                });
            }).catch(() => {});
        } else if (!si && cerrojoPantalla) {
            cerrojoPantalla.release().catch(() => {});
            cerrojoPantalla = null;
        }
    }
    document.addEventListener("visibilitychange", aplicarEncendida);
    aplicarEncendida();
    const rutaArchivo = (id) => "__archivos/" + encodeURIComponent(id);
    // En la app de Android, la carpeta se escribe por su puente (android.js);
    // leer es igual que en el programa (GET __archivos).
    const carpetaGuardar = (id, blob) => (window.ocAlmacen && window.ocAlmacen.guardarArchivo
        ? window.ocAlmacen.guardarArchivo(id, blob)
        : fetch(rutaArchivo(id), { method: "PUT", body: blob,
            headers: { "Content-Type": blob.type || "application/octet-stream" } }).then((r) => {
            if (!r.ok) {
                throw new Error(ocT("no se ha guardado"));
            }
        }));
    const carpetaLeer = (id) => fetch(rutaArchivo(id), { cache: "no-store" }).then((r) => (r.ok ? r.blob() : undefined));
    const archivoGuardar = (id, blob) => (EN_CARPETA ? carpetaGuardar(id, blob) : idbGuardar(id, blob));
    Object.assign(PM, { archivoGuardar });
    const archivoLeer = (id) => (EN_CARPETA ? carpetaLeer(id) : idbLeer(id));
    Object.assign(PM, { archivoLeer });
    const archivoBorrar = (id) => (EN_CARPETA ? (window.ocAlmacen.borrarArchivo ? window.ocAlmacen.borrarArchivo(id)
        : fetch(rutaArchivo(id), { method: "DELETE" })).catch(() => {})
        : enArchivos("readwrite", (a) => a.delete(id)).catch(() => {}));
    Object.assign(PM, { archivoBorrar });
    const todosLosArchivos = () => (EN_CARPETA ? fetch("__archivos", { cache: "no-store" }).then((r) => r.json())
        .then((lista) => Promise.all(lista.map((x) => carpetaLeer(x.id).then((blob) => [x.id, blob])))) : idbTodos());
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
            donde = elegirDe("master-doc-donde", ocT("dentro de"), opcionesCarpetas(conCarpeta.sin), conCarpeta.valor || "");
            cuerpo.appendChild(donde);
        }
        const listo = crear("button", "oc-vida-accion es-principal", ocT("guardar"));
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
            avisar(ocT("No cabe en el almacenamiento del navegador: descárgalo o borra algún documento grande."));
            return false;
        };
        const nuevo = () => pedirNombreDoc(ocT("guardar en documentos"), ya ? ocT("{titulo} (copia)", { titulo: ya.titulo }) : hacer().titulo, vuelta, (nombre, carpeta) => {
            const n = Object.assign({ id: idDoc("n"), carpeta, cambiada: Date.now() }, hacer(), { titulo: nombre });
            docs.notas.push(n);
            if (!cabe(() => docs.notas.splice(docs.notas.indexOf(n), 1))) {
                return;
            }
            alGuardar(n.id);
            guardar();
            avisarDocs();
            avisar(ocT("Guardado en 📁 {rutaDe}: {nombre}.", { rutaDe: rutaDe(carpeta), nombre: nombre }));
        }, { sin: [], valor: (ya && ya.carpeta) || "" });
        if (!ya) {
            nuevo();
            return;
        }
        const cuerpo = crear("div", "master-docs-guardar");
        cuerpo.appendChild(crear("p", "", ocT("Viene de «{titulo}» (📁 {rutaDe}).", { titulo: ya.titulo, rutaDe: rutaDe(ya.carpeta) })));
        const botones = crear("div", "master-docs-botones");
        const encima = botonDe("oc-vida-accion es-principal", ocT("💾 guardar encima"), () => {
            const antes = Object.assign({}, ya);
            Object.assign(ya, hacer(), { titulo: ya.titulo, cambiada: Date.now() });
            cerrar();
            if (cabe(() => {
                Object.keys(ya).forEach((k) => delete ya[k]);
                Object.assign(ya, antes);
            })) {
                avisarDocs();
                avisar(ocT("Guardado: {titulo}.", { titulo: ya.titulo }));
            }
        });
        const otro = botonDe("oc-vida-accion", ocT("📄 guardar como uno nuevo…"), () => {
            cerrar();
            nuevo();
        });
        botones.append(encima, otro);
        cuerpo.appendChild(botones);
        const cerrar = window.ocVentana.abrir({ titulo: ocT("guardar en documentos"), cuerpo, vuelta });
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
    Object.assign(PM, { sonidosListos });
    const sonidoEsta = (rutas) => rutas.every((r) => sonidosHay.has(r));
    Object.assign(PM, { sonidoEsta });
    // Sólo las de esa biblioteca.
    function urlSonidoSegura(ruta) {
        const u = SONIDOS_DE + ruta + ".ogg";
        return /^sonidos\/[a-z_]+\/[a-z0-9_]+\.ogg$/.test(u) ? u : "";
    }
    // El motor: uno para toda la página. «activos»: id → {parar, volumen}.
    const AMBIENTE = { ctx: null, general: null, nivel: 0.8, activos: {}, vigila: 0 };
    Object.assign(PM, { AMBIENTE });
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
    // Lo que está sonando ahora (para pararlo todo de golpe).
    const EFECTOS_SUENAN = new Set();
    Object.assign(PM, { EFECTOS_SUENAN });

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
    Object.assign(PM, { MUSICA });
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
                avisar(ocT("Aún no hay canciones."));
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
    Object.assign(PM, { FUNDIDOS });
    const AGACHAR = [[1, ocT("no se baja")], [0.6, ocT("baja un poco")], [0.4, ocT("baja bastante")], [0.15, ocT("baja mucho")]];
    Object.assign(PM, { AGACHAR });
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
    Object.assign(PM, { musicaActual });
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
                avisar(ocT("«{nombre}» ya no está en este navegador.", { nombre: c.nombre }));
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
        }).catch(() => avisar(ocT("No se ha podido poner «{nombre}».", { nombre: c.nombre })));
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

    // 🎨 EL ASPECTO de una tarjeta (música, sonido ambiente, efectos): un
    // emoji (escrito o de los de muestra) o una imagen tuya (en el
    // dispositivo, como los demás archivos). Cambia cosa.icono y
    // cosa.imagen, y al guardar llama a alGuardar().
    const EMOJIS_MUSICA = ["⚔️", "🐉", "🍺", "🌲", "🏰", "🌊", "🔥", "🌙", "👻", "🎻", "🥁", "⛪", "🏴‍☠️", "❄️", "🌋", "🕯️",
        "💀", "🎪", "🛡️", "👑", "🌧️", "🐺", "✨", "🎵"];
    function dialogoAspecto(cosa, titulo, alGuardar) {
        const vuelta = document.activeElement;
        const cuerpo = crear("form", "master-pegar");
        const et = crear("label", "oc-dados-etiqueta", ocT("emoji (o escribe el tuyo)"));
        const input = crear("input", "oc-dados-texto");
        input.id = "master-musica-emoji";
        input.maxLength = 8;
        input.value = cosa.icono || "";
        input.autocomplete = "off";
        et.htmlFor = input.id;
        const muestras = crear("div", "master-musica-emojis");
        muestras.setAttribute("role", "group");
        muestras.setAttribute("aria-label", ocT("Emojis de muestra"));
        EMOJIS_MUSICA.forEach((e2) => muestras.appendChild(botonDe("master-musica-emoji", e2, () => {
            input.value = e2;
            input.focus();
        }, ocT("Usar {e2}", { e2: e2 }))));
        const subirImg = crear("input");
        subirImg.type = "file";
        subirImg.accept = "image/*";
        subirImg.hidden = true;
        const estado = crear("p", "oc-hoja-nota", cosa.imagen ? ocT("Tiene una imagen tuya (va por delante del emoji).") : ocT("Sin imagen."));
        estado.setAttribute("role", "status");
        let imagen = cosa.imagen || "";
        let nuevaImagen = null;
        const ponerImg = botonDe("oc-vida-accion", ocT("🖼️ poner una imagen"), () => subirImg.click(), ocT("Poner una imagen de tu dispositivo"));
        const quitarImg = botonDe("oc-vida-accion", ocT("✕ quitar la imagen"), () => {
            imagen = "";
            nuevaImagen = null;
            estado.textContent = ocT("Sin imagen (se verá el emoji).");
        });
        subirImg.addEventListener("change", () => {
            const f = subirImg.files && subirImg.files[0];
            subirImg.value = "";
            if (!f || !/^image\//.test(f.type) || f.size > 10 * 1024 * 1024) {
                estado.textContent = ocT("Sólo imágenes de hasta 10 MB.");
                return;
            }
            nuevaImagen = f;
            estado.textContent = ocT("Imagen elegida: {name}. Pulsa «✓ guardar».", { name: f.name });
        });
        const fila = crear("div", "master-creador-barra");
        fila.append(ponerImg, quitarImg, subirImg);
        const ok = crear("button", "oc-vida-accion es-principal", ocT("✓ guardar"));
        ok.type = "submit";
        cuerpo.append(et, input, muestras, fila, estado, ok);
        cuerpo.addEventListener("submit", (e) => {
            e.preventDefault();
            const fin = () => {
                cosa.icono = input.value.trim();
                cerrar();
                alGuardar();
                avisar(ocT("Aspecto guardado: {nombre}.", { nombre: cosa.nombre }));
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
                    estado.textContent = ocT("No se ha podido guardar la imagen.");
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
            dialogoAspecto(cosa, ocT("aspecto de {nombre}", { nombre: nombre }), () => {
                const t = leerAspectos();
                if (cosa.icono || cosa.imagen) {
                    t[clave] = { icono: cosa.icono || "", imagen: cosa.imagen || "" };
                } else {
                    delete t[clave];
                }
                try {
                    localStorage.setItem(CLAVE_ASPECTOS, JSON.stringify(t));
                } catch (e) {
                    avisar(ocT("No se ha podido guardar."));
                }
                const viejo = boton.querySelector(".master-ambiente-emoji");
                viejo.replaceWith(iconoSonido(clave, emoji));
                boton.focus();
            });
        }, ocT("Poner un emoji o una imagen a {nombre}", { nombre: nombre }));
    }

    const IMAGENES_MUSICA = new Map();
    function imagenMusica(id) {
        if (!IMAGENES_MUSICA.has(id)) {
            IMAGENES_MUSICA.set(id, archivoLeer(id).then((blob) => (blob ? URL.createObjectURL(blob) : "")).catch(() => ""));
        }
        return IMAGENES_MUSICA.get(id);
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
        return ocT("{cr} ({toLocaleString} PX; BC +{bc})", { cr: cr, toLocaleString: (CR_PX[cr] || 0).toLocaleString(window.ocLocale), bc: bc });
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
    // Los datos que se guardan en castellano (categorías, rarezas, tipos…),
    // en el idioma de la app para enseñarlos: los del compendio, con
    // window.ocTd; los que sólo salen en estas listas, aquí.
    const VER_PROPIO = { "Dragón": ocT("Dragón"), Planta: ocT("Planta"), "rasgo de trasfondo": ocT("rasgo de trasfondo"), "otro rasgo": ocT("otro rasgo"), especie: ocT("especie"),
        trasfondo: ocT("trasfondo"), clase: ocT("clase"), subclase: ocT("subclase"), regla: ocT("regla"), lugar: ocT("lugar"),
        deidad: ocT("deidad"), otro: ocT("otro") };
    function verDato(v) {
        if (typeof v !== "string") {
            return v;
        }
        const t = window.ocTd(v);
        return t !== v ? t : VER_PROPIO[v] || v;
    }
    Object.assign(PM, { verDato });
    // Los tamaños, aparte («Mediano» y «Grande» se dicen distinto en otros
    // sitios): «(tamaño)» es sólo para quien traduce.
    const TAMANO_VER = { Diminuto: ocT("Diminuto"), "Pequeño": ocT("Pequeño"), Mediano: ocT("Mediano (tamaño)"), Grande: ocT("Grande (tamaño)"),
        Enorme: ocT("Enorme"), Gargantuesco: ocT("Gargantuesco"), "Pequeño o Mediano": ocT("Pequeño o Mediano") };
    const tamanoVer = (t) => [t, (TAMANO_VER[t] || t).replace(/ \(tamaño\)$/, "").replace(/ \(size\)$/, "")];
    const SECCIONES_BICHO = [["rasgos", ocT("Rasgos")], ["acciones", ocT("Acciones")], ["adicionales", ocT("Acciones adicionales")],
        ["reacciones", ocT("Reacciones")], ["legendarias", ocT("Acciones legendarias")]];

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
        // Tu versión de uno del SRD: el que sustituye.
        if (typeof x.cambia === "string" && x.cambia.trim()) {
            o.cambia = x.cambia.slice(0, 300);
        }
        const entradas = (v) => (Array.isArray(v) ? v : []).slice(0, 60).map((r) => ({ n: txt(r && r.n, 160), t: txt(r && r.t, 6000) }))
            .filter((r) => r.n || r.t);
        if (tipo === "monstruos") {
            ["tipo", "alin", "ca", "ini", "pgf", "vel", "salv", "hab", "vuln", "res", "inm", "inmE", "sent", "idio", "equipo"].forEach((k) => {
                const v = txt(x[k], 600);
                if (v) {
                    o[k] = v;
                }
            });
            o.tipo = o.tipo || ocT("Monstruosidad Mediano");
            o.alin = o.alin || "neutral";
            o.ca = o.ca || "10";
            o.vel = o.vel || ocT("30 ft.");
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
            o.sent = o.sent || ocT("Percepción pasiva {n}", { n: 10 + Math.floor((o.car.Sab - 10) / 2) });
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
        cuerpo.appendChild(crear("p", "oc-hoja-nota", verDato(x.cat)));
        const t = markdown(x.texto);
        cuerpo.appendChild(t);
        if (window.ocDadosEnTexto) {
            window.ocDadosEnTexto(t);
        }
        enlazarConjuros(t);
        cuerpo.appendChild(crear("p", "oc-hoja-nota master-fuente", fuenteDe(x)));
        cuerpo.appendChild(botonDe("oc-vida-accion", ocT("📌 al tablero"), () => {
            cerrar();
            anadir("ficha", { titulo: x.nombre, datos: { que: "otro", id: x.id } });
        }, ocT("Poner {nombre} en el tablero", { nombre: x.nombre })));
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
        ayuda: ocT("Rellena las listas y cárgalo con ⬆ importar. Sólo «nombre» es obligatorio. Los textos admiten *cursiva* y **negrita**. Los ataques, con el formato «*Ataque cuerpo a cuerpo:* +4, alcance 5 ft. *Impacto:* 5 (1d6 + 2) de daño cortante.» salen en tabla con sus dados. Si algo va en inglés, se traducen los términos de reglas al importar."),
        monstruos: [{ nombre: ocT("Rata de alcantarilla gigante"), en: "Giant Sewer Rat", libro: "inventado", tipo: "Bestia Pequeño",
            alin: "sin alineamiento", ca: "12", pg: 9, pgf: "2d6 + 2", vel: ocT("30 ft., trepar 20 ft."),
            car: { Fue: 7, Des: 15, Con: 12, Int: 2, Sab: 10, Car: 4 }, hab: ocT("Sigilo +4"), sent: ocT("visión en la oscuridad 60 ft.; Percepción pasiva 10"),
            idio: "—", cr: "1/4", habitat: ["ciudad"],
            rasgos: [{ n: ocT("Olfato agudo"), t: ocT("La rata tiene ventaja en las pruebas de Sabiduría (Percepción) que dependen del olfato.") }],
            acciones: [{ n: "Mordisco", t: ocT("*Ataque cuerpo a cuerpo:* +4, alcance 5 ft. *Impacto:* 4 (1d4 + 2) de daño perforante. Si el objetivo es una criatura, *Tirada de salvación de Constitución:* CD 11. *Fallo:* queda envenenado hasta el final de su siguiente turno.") }],
            reacciones: [{ n: "Escabullirse", t: ocT("*Desencadenante:* Una criatura falla un ataque contra la rata. *Respuesta:* La rata se mueve 10 ft. sin provocar ataques de oportunidad.") }] }],
        objetos: [{ nombre: ocT("Farol del vigía"), en: "Watchman's Lantern", libro: "inventado", cat: "objeto maravilloso", rareza: "poco común",
            sint: false, cp: 25000, peso: ocT("2 lb."), tiendas: ["Tienda de magia"],
            texto: ocT("Mientras está encendido, las criaturas invisibles a 30 ft. o menos del farol dejan ver su silueta. Se enciende y se apaga con una acción adicional.") }],
        conjuros: [{ nombre: ocT("Paso de niebla gris"), en: "Grey Mist Step", libro: "inventado", nivel: 2, escuela: "Conjuración",
            tiempo: ocT("1 acción adicional"), alcance: "Personal", comp: "V", dur: "Instantánea", clases: ["brujo", "hechicero", "mago"],
            ritual: false, conc: false, texto: ocT("Te envuelve una niebla gris y te teletransportas hasta 30 ft. a un espacio desocupado que veas. Cada criatura a 5 ft. del sitio del que te vas recibe 1d6 de daño de frío."),
            superior: ocT("**Con un espacio de nivel superior.** El daño aumenta en 1d6 por cada nivel por encima de 2.") }],
        rasgos: [{ nombre: ocT("Marinero curtido"), en: "Seasoned Sailor", libro: "inventado", tipo: "dote general", de: "dote",
            texto: ocT("**Piernas de mar.** No tienes desventaja por el balanceo de un barco.\n\n**Nudos.** Tienes ventaja en las pruebas para atar o desatar nudos.") }],
        otros: [{ nombre: ocT("Dote: Centinela del puerto"), libro: "inventado", cat: "dote",
            texto: ocT("*Requisito: nivel 4 o más.*\n\n**Ojo de marino.** Tienes ventaja en las pruebas de Sabiduría (Percepción) en barcos y muelles.\n\n**Amarre firme.** No pueden derribarte mientras estés sobre una cubierta.") }] };


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
        bloque.setAttribute("aria-label", ocT("Ejemplo: un bloque de estadísticas seleccionado entero, desde el nombre del monstruo hasta la última acción."));
        const filas = [["es-nombre", ocT("Rata de alcantarilla gigante")], ["es-cursiva", ocT("Small Beast, Unaligned")],
            ["", ocT("AC 12   Initiative +2 (12)")], ["", ocT("HP 9 (2d6 + 2)")], ["", ocT("Speed 30 ft., Climb 20 ft.")],
            ["es-tabla", ocT("Str 7 −2 −2 · Dex 15 +2 +2 · Con 12 +1 +1 …")], ["", ocT("Senses Darkvision 60 ft.; Passive Perception 10")],
            ["", ocT("CR 1/4 (XP 50; PB +2)")], ["es-seccion", "Actions"],
            ["", ocT("Bite. Melee Attack Roll: +4, reach 5 ft. Hit: 4 (1d4 + 2) Piercing damage.")]];
        filas.forEach(([c, t]) => {
            const f = crear("p", "master-guia-fila " + c, t);
            f.setAttribute("aria-hidden", "true");
            bloque.appendChild(f);
        });
        const desde = crear("span", "master-guia-marca es-desde", ocT("▶ desde aquí"));
        const hasta = crear("span", "master-guia-marca es-hasta", ocT("hasta aquí ◀"));
        desde.setAttribute("aria-hidden", "true");
        hasta.setAttribute("aria-hidden", "true");
        bloque.prepend(desde);
        bloque.appendChild(hasta);
        cuerpo.appendChild(p(ocT("Para traer a tu mesa monstruos, objetos y conjuros de los libros que tienes en D&D Beyond (o de un PDF tuyo) sin escribirlos campo a campo. Se quedan sólo en este dispositivo.")));
        paso(1, ocT("Ábrelo en D&D Beyond"), p(ocT("Entra con tu cuenta y abre la página del monstruo, el objeto o el conjuro (de un libro que tengas).")));
        paso(2, ocT("Selecciona el bloque entero y cópialo"), p(ocT("Arrastra desde el nombre hasta el final de la última acción (o del texto, en un objeto o un conjuro) y cópialo: Ctrl + C (en un Mac, ⌘ + C; en una tablet, mantén pulsado → Copiar).")), bloque, p(ocT("Si se cuela algo de más (botones, notas), no pasa nada: lo que no se reconoce se salta o se queda en el texto para repasarlo.")));
        paso(3, ocT("Pégalo aquí"), p(ocT("En 🛠️ tus creaciones, en la pestaña que toque (🐉 monstruos, 💰 objetos o ✨ conjuros), pulsa «📋 pegar un bloque», pega con Ctrl + V y pulsa «✓ rellenar».")), img("imagenes/guia/pegar.webp",
            ocT("La ventana «pegar un bloque» con el texto de un monstruo pegado y el botón «rellenar».")));
        paso(4, ocT("Repásalo y guarda"), p(ocT("Se abre el formulario ya relleno, con los términos de reglas pasados al español si está marcado «🌐 traducir» (las frases se quedan en inglés: cámbialas si quieres). Mira el tipo, el tamaño y el VD, pon de qué libro sale y pulsa «✓ guardar».")), img("imagenes/guia/formulario.webp",
            ocT("El formulario de un monstruo relleno solo: nombre, tipo, tamaño, VD, CA, PG y sus acciones.")));
        paso(5, ocT("Ya está en tu mesa"), p(ocT("Sale en el bestiario, los encuentros, el buscador… como los del SRD, con «🛠️ tuyo». Los ataques, en su tabla con los dados para tirar.")), img("imagenes/guia/resultado.webp",
            ocT("El monstruo en su ventana, con la tabla de ataques y los dados.")));
        window.ocVentana.abrir({ titulo: ocT("cómo pegar desde D&D Beyond"), cuerpo, vuelta, clase: "es-ancha" });
    }

    function montarCreador(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        const TIPOS = [["monstruos", ocT("🐉 monstruos"), "monstruo"], ["objetos", ocT("💰 objetos"), "objeto"], ["conjuros", ocT("✨ conjuros"), "conjuro"],
            ["rasgos", ocT("⭐ rasgos y dotes"), "rasgo"], ["otros", ocT("📜 más cosas"), "cosa"]];
        const RUTA_DE = { monstruos: "datos/personajes/compendio/bestiario.json", objetos: "datos/personajes/compendio/tienda.json",
            conjuros: "datos/personajes/compendio/conjuros-srd.json", rasgos: RASGOS_SRD };
        const uid = "master-creador-" + m.id;
        // Lo del SRD de cada tipo (para copiar uno y para que no se repitan).
        const srd = { monstruos: [], objetos: [], conjuros: [], rasgos: [], otros: [] };
        // (Los originales, sin tus cambios ni tus borrados.)
        const crudo = (ruta) => pedir(ruta).then(() => pedidos[(edicionAhora === "2014" && DE_2014[ruta]) || ruta]);
        const cargado = Promise.all(Object.keys(RUTA_DE).map((k) => crudo(RUTA_DE[k]))).then((xs) => {
            Object.keys(RUTA_DE).forEach((k, i) => {
                srd[k] = (xs[i][k] || []).filter((x) => !x.propio);
            });
        }).catch(() => {});

        // ARRIBA: el aviso, importar, exportar y la plantilla.
        const vista = crear("div", "master-creador-vista");
        const nota = crear("p", "oc-hoja-nota", ocT("Monstruos, objetos, conjuros y más cosas de otros manuales (cópialos de tu libro) o inventados. Salen en el bestiario, los encuentros, la tienda, el botín, los conjuros y el buscador, como los del SRD. Se quedan sólo en este navegador: no se suben a la web. Para no perderlos o pasárselos a otro máster, ⬇ exportar."));
        const barra = crear("div", "master-creador-barra");
        const archivo = crear("input");
        archivo.type = "file";
        archivo.accept = ".json,application/json";
        archivo.hidden = true;
        const importar = botonDe("oc-vida-accion", ocT("⬆ importar .json"), () => archivo.click(), ocT("Importar creaciones desde un archivo .json"));
        const exportar = botonDe("oc-vida-accion", ocT("⬇ exportar"), () => {
            const p = leerPropios();
            const n = p.monstruos.length + p.objetos.length + p.conjuros.length + p.rasgos.length + p.otros.length;
            if (!n) {
                avisar(ocT("Aún no hay nada tuyo que exportar."));
                return;
            }
            bajarJson(Object.assign({ pantallaDeMasterPropios: 1 }, p), "mis-creaciones-" + new Date().toISOString().slice(0, 10) + ".json");
            avisar(ocT("Exportadas {n} creaciones.", { n: n }));
        }, ocT("Exportar todas tus creaciones a un archivo .json"));
        const plantilla = botonDe("oc-vida-accion", ocT("📄 plantilla"), () => {
            bajarJson(PLANTILLA_PROPIOS, "plantilla-creaciones.json");
            avisar(ocT("Bajada la plantilla, con un ejemplo de cada."));
        }, ocT("Bajar una plantilla .json de ejemplo para rellenar"));
        const etTr = crear("label", "master-creador-check");
        const conTraducir = crear("input");
        conTraducir.type = "checkbox";
        // En inglés no hay nada que traducir (los términos ya van en inglés).
        conTraducir.checked = d.traducir !== false && window.ocLocale !== "en";
        etTr.hidden = window.ocLocale === "en";
        conTraducir.addEventListener("change", () => {
            d.traducir = conTraducir.checked;
            guardar();
        });
        etTr.append(conTraducir, ocT(" 🌐 traducir los términos al importar"));
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
                    informe.error = ocT("No es un .json válido (no se puede leer).");
                    return;
                }
                if (!datos || typeof datos !== "object" || Array.isArray(datos) || !TIPOS.some(([k]) => Array.isArray(datos[k]))) {
                    informe.error = ocT("No tiene el formato de la plantilla: no trae ninguna lista «monstruos», «objetos», «conjuros», «rasgos» ni «otros». Mira la 📄 plantilla para ver cómo tiene que ser.");
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
                    informe.error = ocT("No había nada que se pudiera importar: a todo le faltaba el nombre o no se entendía.");
                    return;
                }
                if (!guardarPropios(p)) {
                    informe.error = ocT("No se ha podido guardar: no queda sitio en este navegador. No se ha importado nada.");
                    return;
                }
                pintarListas();
            }).catch(() => {
                informe.error = informe.error || ocT("No se ha podido leer el archivo.");
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
                bien ? ocT("✅ Importado: {nuevos}{n}{n2}.", { nuevos: nuevos, n: nuevos === 1 ? ocT(" nuevo") : ocT(" nuevos"), n2: cambiados ? ocT(" y {cambiados}{n}", { cambiados: cambiados, n: cambiados === 1 ? ocT(" cambiado") : ocT(" cambiados") }) : "" })
                    : ocT("⚠️ No se ha importado nada."));
            cuerpo.append(estado, crear("p", "oc-hoja-nota", ocT("Archivo: {archivo}", { archivo: informe.archivo })));
            if (!bien) {
                cuerpo.appendChild(crear("p", "", informe.error));
            } else {
                const tabla = crear("table", "master-informe-tabla");
                tabla.appendChild(crear("caption", "visually-hidden", ocT("Resumen de la importación")));
                const cab = crear("tr");
                [ocT("qué"), ocT("nuevos"), ocT("cambiados"), ocT("saltados")].forEach((x) => {
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
                    cuerpo.appendChild(crear("p", "oc-hoja-nota", ocT("Saltados: {saltados} sin nombre o que no se entendían.", { saltados: saltados })));
                }
                if (demasiados) {
                    cuerpo.appendChild(crear("p", "oc-hoja-nota", ocT("Sólo entran 2.000 de cada tipo por archivo: {demasiados} se han quedado fuera.", { demasiados: demasiados })));
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
                        ul.appendChild(crear("li", "", ocT("…y {n} más.", { n: lista.length - 200 })));
                    }
                    det.appendChild(ul);
                    cuerpo.appendChild(det);
                });
                if (conTraducir.checked) {
                    cuerpo.appendChild(crear("p", "oc-hoja-nota", ocT("🌐 Con los términos de reglas pasados al español.")));
                }
            }
            avisar(estado.textContent);
            window.ocVentana.abrir({ titulo: "importar: " + (bien ? "hecho" : ocT("no ha podido ser")), cuerpo, vuelta: importar });
        }

        // LAS LISTAS, una por pestaña.
        const listas = {};
        const filtros = {};
        const paneles = TIPOS.map(([k, titulo, uno]) => {
            const panel = crear("div", "master-creador-panel");
            const botones = crear("div", "master-creador-barra");
            botones.appendChild(botonDe("oc-vida-accion es-principal", ocT("＋ {uno} nuevo", { uno: uno }), () => editar(k, null), ocT("Crear {n}", { n: k === "otros" ? ocT("una cosa nueva (especie, dote…)") : ocT("un {uno} nuevo", { uno: uno }) })));
            if (k !== "otros" && k !== "rasgos") {
                const pegar = botonDe("oc-vida-accion", ocT("📋 pegar un bloque"), () => abrirPegar(k, pegar),
                    ocT("Pegar un bloque copiado (de D&D Beyond, un PDF…) para rellenar {n}", { n: k === "monstruos" ? ocT("un monstruo")
                        : k === "objetos" ? ocT("un objeto") : ocT("un conjuro") }));
                pegar.setAttribute("aria-haspopup", "dialog");
                const guia = botonDe("oc-vida-accion", ocT("❓ cómo"), () => abrirGuiaPegar(guia), ocT("Cómo pegar desde D&D Beyond (guía)"));
                guia.setAttribute("aria-haspopup", "dialog");
                botones.append(pegar, guia);
            }
            if (k !== "otros") {
                // Partir de uno del SRD (para hacer una versión).
                const sel = crear("select", "master-elegir");
                sel.id = uid + "-base-" + k;
                const etSel = crear("label", "oc-dados-etiqueta", ocT("o partir de uno del SRD"));
                etSel.htmlFor = sel.id;
                cargado.then(() => {
                    const clave = (x) => (k === "rasgos" ? x.en + "|" + x.de : x.en);
                    sel.replaceChildren(...srd[k].slice().sort((a, b) => a.nombre.localeCompare(b.nombre, window.ocLocale)).map((x) => {
                        const o = crear("option", "", x.nombre + (k === "rasgos" && x.de && x.de !== "dote" ? " (" + verDato(x.de) + ")" : ""));
                        o.value = clave(x);
                        return o;
                    }));
                });
                const copiar = botonDe("oc-vida-accion", ocT("⧉ copiar"), () => {
                    const base = srd[k].find((x) => (k === "rasgos" ? x.en + "|" + x.de : x.en) === sel.value);
                    if (base) {
                        const x = JSON.parse(JSON.stringify(base));
                        delete x.ilus;
                        delete x.ilusDe;
                        x.libro = "";
                        x.nombre = ocT("{nombre} (versión)", { nombre: base.nombre });
                        x.en = ocT("{en} (versión)", { en: base.en });
                        editar(k, x, true);
                    }
                }, ocT("Copiar el elegido para hacer tu versión"));
                const caja = crear("div", "master-creador-base");
                caja.append(etSel, sel, copiar);
                botones.appendChild(caja);
            }
            const etF = crear("label", "oc-dados-etiqueta", ocT("buscar entre los tuyos"));
            const filtro = crear("input", "oc-dados-texto");
            filtro.type = "search";
            filtro.id = uid + "-filtro-" + k;
            etF.htmlFor = filtro.id;
            filtro.addEventListener("input", () => pintarLista(k));
            filtros[k] = filtro;
            const ul = crear("div", "master-creador-grupos");
            ul.setAttribute("role", "region");
            ul.setAttribute("aria-label", ocT("{replace} tuyos", { replace: titulo.replace(/^\S+\s/, "") }));
            listas[k] = ul;
            panel.append(botones, etF, filtro, ul);
            if (k === "rasgos") {
                // Los del SRD (rasgos de clase y especie, dotes y
                // habilidades), para leerlos aquí mismo.
                const srdCaja = crear("details", "master-creador-srd");
                const resumen = crear("summary", "", ocT("📖 los del SRD"));
                const etS = crear("label", "oc-dados-etiqueta", ocT("buscar entre los del SRD"));
                const buscaS = crear("input", "oc-dados-texto");
                buscaS.type = "search";
                buscaS.id = uid + "-srd-" + k;
                etS.htmlFor = buscaS.id;
                const ulS = crear("ul", "master-conjuros");
                ulS.setAttribute("aria-label", ocT("Rasgos, dotes y habilidades del SRD"));
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
                    resumen.textContent = ocT("📖 los del SRD ({n}){n2}", { n: srd.rasgos.length, n2: q ? ocT(" · {n} con eso", { n: salen.length }) : "" });
                };
                buscaS.addEventListener("input", pintarS);
                cargado.then(pintarS);
                srdCaja.append(resumen, etS, buscaS, ulS);
                panel.appendChild(srdCaja);
            }
            return [titulo, panel];
        });
        // La primera pestaña: cómo añadir cosas (el tutorial). Para editar
        // o borrar, en cada pestaña un buscador con todo (del SRD y tuyo).
        const repintar = [];
        if (d.accion === "editar" || d.accion === "borrar") {
            paneles.splice(0, paneles.length, ...TIPOS.map(([k, titulo]) => [titulo, panelBuscar(k)]));
        } else {
            paneles.unshift([ocT("❓ cómo añadir"), panelTutorial()]);
        }
        const elegido = Math.min(d.pestana || 0, paneles.length - 1);
        const { lista: pestanas, elegir } = pestanasDe(paneles, ocT("Qué crear"), uid, (i) => {
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
            panel.appendChild(p(ocT("Aquí amplías los compendios con lo tuyo: monstruos, objetos, conjuros y más cosas (especies, dotes, trasfondos…), inventados o pasados de tus libros. Después salen en toda la app como los del SRD.")));
            const irA = crear("div", "master-creador-barra");
            irA.append(ir(1, ocT("🐉 monstruos")), ir(2, ocT("💰 objetos")), ir(3, ocT("✨ conjuros")), ir(4, ocT("📜 más cosas")));
            paso(1, ocT("Elige qué quieres añadir"), p(ocT("Cada tipo tiene su pestaña aquí arriba, con la lista de lo que ya has añadido.")),
                irA);
            const guia = botonDe("oc-vida-accion", ocT("❓ cómo pegar desde D&D Beyond"), () => abrirGuiaPegar(guia));
            guia.setAttribute("aria-haspopup", "dialog");
            paso(2, ocT("Añádelo de una de estas tres formas"), p(ocT("<strong>＋ nuevo</strong>: rellenas el formulario desde cero.<br><strong>⧉ copiar</strong> (partir de uno del SRD): una copia para hacer tu versión, con otros números o ataques.<br><strong>📋 pegar un bloque</strong>: pegas el bloque copiado de D&D Beyond o de un PDF y el formulario se rellena solo.")), guia);
            paso(3, ocT("Repásalo y guarda"), p(ocT("En el formulario, mira sobre todo el tipo, el tamaño y el VD (los encuentros los usan), pon <strong>de dónde sale</strong> y pulsa <strong>✓ guardar</strong>. Si algo viene en inglés, <strong>🌐 traducir términos</strong> pasa al español los de reglas (daños, estados, «Melee Attack Roll»…).")),
                img2("imagenes/guia/formulario.webp", ocT("El formulario de un monstruo relleno.")));
            paso(4, ocT("Muchos a la vez: importar"), p(ocT("Baja la <strong>📄 plantilla</strong> (un ejemplo de cada), rellénala y cárgala con <strong>⬆ importar .json</strong>: una ventana te dice qué ha entrado y qué no. <strong>⬇ exportar</strong> guarda todo lo tuyo en un archivo, para tener copia o pasárselo a otro máster.")));
            paso(5, ocT("Dónde sale"), p(ocT("En el bestiario, los encuentros, la tienda y los negocios, el botín, los conjuros, la party y el buscador, con «🛠️ tuyo». Los ataques, en su tabla con los dados.")),
                img2("imagenes/guia/resultado.webp", ocT("Un monstruo añadido, en su ventana con la tabla de ataques.")));
            paso(6, ocT("Sólo en este dispositivo"), p(ocT("Lo que añades se queda aquí: no se sube a ningún sitio. Los mismos en todas tus campañas.")));
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
                return ocT("VD {cr} · {tipo}", { cr: x.cr, tipo: verDato(x.tipo) });
            }
            if (k === "objetos") {
                return verDato(x.cat) + (x.rareza ? " · " + verDato(x.rareza) : "");
            }
            if (k === "conjuros") {
                return nivelDe(x) + " · " + verDato(x.escuela);
            }
            if (k === "rasgos") {
                return datosRasgo(x).join(" · ");
            }
            return verDato(x.cat);
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
            }).catch(() => (k === "otros" ? abrirOtro(x, vuelta) : avisar(ocT("No he podido cargarlo."))));
        }
        // LAS CATEGORÍAS: el libro de cada cosa tuya («La caldera de Tasha»,
        // «Inventado»…), las de todos los tipos, para elegir y ordenar.
        function categoriasPropias() {
            const p = leerPropios();
            const todas = new Set();
            TIPOS.forEach(([k]) => p[k].forEach((x) => {
                if ((x.libro || "").trim()) {
                    todas.add(x.libro.trim());
                }
            }));
            return Array.from(todas).sort((a, b) => a.localeCompare(b, window.ocLocale));
        }
        // Lo tuyo de una lista, por categorías: [[categoría, [cosas]], …].
        function porCategorias(lista) {
            const grupos = new Map();
            lista.forEach((x) => {
                const c = (x.libro || "").trim() || ocT("sin categoría");
                if (!grupos.has(c)) {
                    grupos.set(c, []);
                }
                grupos.get(c).push(x);
            });
            return Array.from(grupos.entries()).sort((a, b) => a[0].localeCompare(b[0], window.ocLocale));
        }
        // Un grupo con su título y su lista, plegable (el que se cierra
        // sigue cerrado al repintar).
        const cerradas = new Set();
        function grupoCategoria(titulo, filas, extra, total) {
            const caja = crear("details", "master-creador-cat-grupo");
            caja.open = !cerradas.has(titulo);
            caja.addEventListener("toggle", () => {
                cerradas[caja.open ? "delete" : "add"](titulo);
            });
            const resumen = crear("summary");
            resumen.appendChild(crear("h4", "master-creador-cat", ocT("{titulo} ({n})", { titulo, n: total || filas.length })));
            const ul = crear("ul", "master-creador-lista");
            ul.setAttribute("aria-label", titulo);
            ul.append(...filas);
            caja.append(resumen, ul);
            if (extra) {
                caja.appendChild(extra);
            }
            return caja;
        }
        // AL GUARDAR: en qué categoría (una de las tuyas, una nueva o
        // ninguna). «alElegir(categoría)».
        function elegirCategoria(actual, vuelta, alElegir) {
            const cats = categoriasPropias();
            const cuerpo = crear("form");
            const fs = crear("fieldset", "master-creador-cats");
            fs.appendChild(crear("legend", "", ocT("¿En qué categoría (de qué libro) lo guardo?")));
            const radios = [];
            const opcion = (valor, texto) => {
                const et = crear("label", "master-creador-check");
                const r = crear("input");
                r.type = "radio";
                r.name = uid + "-cat";
                r.value = valor;
                et.append(r, " " + texto);
                fs.appendChild(et);
                radios.push(r);
                return r;
            };
            cats.forEach((c) => opcion(c, "📕 " + c));
            const sin = opcion("", ocT("sin categoría"));
            const nueva = opcion("\u0000", ocT("una nueva:"));
            const etN = crear("label", "visually-hidden", ocT("nombre de la categoría nueva"));
            const nombreN = crear("input", "oc-dados-texto");
            nombreN.id = uid + "-cat-nueva";
            nombreN.autocomplete = "off";
            nombreN.placeholder = ocT("«La caldera de Tasha», «Inventado»…");
            etN.htmlFor = nombreN.id;
            nombreN.addEventListener("input", () => {
                nueva.checked = true;
            });
            fs.append(etN, nombreN);
            const ya = radios.find((r) => r.value === (actual || "").trim());
            if (ya) {
                ya.checked = true;
            } else if ((actual || "").trim()) {
                nueva.checked = true;
                nombreN.value = actual.trim();
            } else if (cats.length) {
                sin.checked = true;
            } else {
                nueva.checked = true;
            }
            const botones = crear("div", "master-creador-barra");
            const ok = crear("button", "oc-vida-accion es-principal", ocT("✓ guardar aquí"));
            ok.type = "submit";
            let cerrarV = () => {};
            botones.append(ok, botonDe("oc-vida-accion", ocT("cancelar"), () => cerrarV()));
            cuerpo.append(fs, botones);
            cuerpo.addEventListener("submit", (e) => {
                e.preventDefault();
                const elegida = radios.find((r) => r.checked);
                let cat = elegida ? elegida.value : "";
                if (cat === "\u0000") {
                    cat = nombreN.value.trim();
                    if (!cat) {
                        avisar(ocT("Escribe el nombre de la categoría nueva."));
                        nombreN.focus();
                        return;
                    }
                }
                cerrarV();
                alElegir(cat);
            });
            const foco = nueva.checked && !nombreN.value ? nombreN : radios.find((r) => r.checked);
            cerrarV = window.ocVentana.abrir({ titulo: ocT("📕 categoría"), cuerpo, vuelta, foco }) || (() => {});
        }
        // EL AVISO AL TOCAR EL SRD: antes de cambiar o borrar algo del
        // contenido de base, cuidado (se puede pedir que no salga más:
        // «richi-master-aviso-srd»).
        function conAvisoSrd(que, nombre, vuelta, hacer) {
            let saltar = false;
            try {
                saltar = localStorage.getItem("richi-master-aviso-srd") === "no";
            } catch (e) {
                saltar = false;
            }
            if (saltar) {
                hacer();
                return;
            }
            const cuerpo = crear("div");
            cuerpo.append(crear("p", "master-informe-estado es-mal", que === "borrar"
                ? ocT("⚠️ Vas a borrar «{nombre}», del contenido de base (el SRD).", { nombre })
                : ocT("⚠️ Vas a cambiar «{nombre}», del contenido de base (el SRD).", { nombre })),
            crear("p", "", ocT("Lo que cambies o borres del SRD cambia en toda la app: el bestiario, los encuentros, la tienda, los conjuros, el buscador… Ten cuidado: si te equivocas, en «✎ editar» lo puedes dejar como era (↺) y en «🗑️ borrar» recuperarlo («borrados del SRD»), pero lo que hubieras escrito en tu versión se pierde.")));
            const et = crear("label", "master-creador-check");
            const recordar = crear("input");
            recordar.type = "checkbox";
            et.append(recordar, ocT(" no volver a avisar"));
            const botones = crear("div", "master-creador-barra");
            let cerrar = () => {};
            const seguir = botonDe("oc-vida-accion es-principal", que === "borrar" ? ocT("🗑️ sí, borrar") : ocT("✎ sí, cambiar"), () => {
                if (recordar.checked) {
                    try {
                        localStorage.setItem("richi-master-aviso-srd", "no");
                    } catch (e) {
                        // Sin guardar: avisa la próxima vez.
                    }
                }
                cerrar();
                hacer();
            });
            botones.append(seguir, botonDe("oc-vida-accion", ocT("cancelar"), () => cerrar()));
            cuerpo.append(et, botones);
            cerrar = window.ocVentana.abrir({ titulo: ocT("cuidado con el SRD"), cuerpo, vuelta, foco: seguir });
        }

        function pintarLista(k) {
            const ul = listas[k];
            const q = llano(filtros[k].value.trim());
            const todos = leerPropios()[k].slice().sort((a, b) => a.nombre.localeCompare(b.nombre, window.ocLocale));
            const salen = todos.filter((x) => !q || llano(x.nombre + " " + x.en + " " + (x.libro || "")).includes(q));
            const filas = new Map();
            salen.forEach((x) => {
                const li = crear("li", "master-creador-fila");
                const ver = botonDe("master-creador-ver", "", () => abrirUno(k, x, ver));
                ver.dataset.id = x.id;
                ver.setAttribute("aria-haspopup", "dialog");
                ver.append(crear("span", "master-creador-nombre", x.nombre), crear("span", "master-creador-detalle",
                    detalleDe(k, x) + (x.libro ? " · " + x.libro : "")));
                const cambiar = botonDe("master-docs-mando", "✎", () => editar(k, x), ocT("Cambiar {nombre}", { nombre: x.nombre }));
                const duplicar = botonDe("master-docs-mando", "⧉", () => {
                    const y = JSON.parse(JSON.stringify(x));
                    delete y.id;
                    y.nombre = ocT("{nombre} (copia)", { nombre: x.nombre });
                    y.en = ocT("{en} (copia)", { en: x.en });
                    editar(k, y, true);
                }, ocT("Hacer una copia de {nombre}", { nombre: x.nombre }));
                let seguro = false;
                const quitar = botonDe("master-docs-mando", "✕", () => {
                    if (!seguro) {
                        seguro = true;
                        quitar.classList.add("es-seguro");
                        avisar(ocT("Pulsa otra vez para quitar {nombre}.", { nombre: x.nombre }));
                        return;
                    }
                    const p = leerPropios();
                    p[k] = p[k].filter((y) => y.id !== x.id);
                    guardarPropios(p);
                    pintarLista(k);
                    avisar(ocT("Quitado: {nombre}.", { nombre: x.nombre }));
                    filtros[k].focus();
                }, ocT("Quitar {nombre}", { nombre: x.nombre }));
                li.append(ver, cambiar, duplicar, quitar);
                filas.set(x, li);
            });
            // Por categorías (el libro de cada uno).
            ul.replaceChildren(...porCategorias(salen).map(([cat, xs]) => grupoCategoria("📕 " + cat, xs.map((x) => filas.get(x)))));
            if (!salen.length) {
                ul.appendChild(crear("p", "oc-vacio", todos.length ? ocT("Nada con eso.") : ocT("Aún no hay. Crea uno, copia uno del SRD o importa un .json.")));
            }
        }
        function pintarListas() {
            TIPOS.forEach(([k]) => {
                if (listas[k].isConnected) {
                    pintarLista(k);
                }
            });
            repintar.forEach((f) => f());
        }

        // EDITAR O BORRAR LO QUE YA HAY: un buscador con todo lo de su tipo
        // (del SRD y tuyo). Cambiar uno del SRD guarda tu versión («cambia»:
        // cuál sustituye), que sale en su lugar en toda la app; ↺ lo deja
        // como era. Borrar uno del SRD no lo borra del archivo: deja de
        // salir («ocultos») y se puede recuperar.
        function panelBuscar(k) {
            const borrar = d.accion === "borrar";
            const panel = crear("div", "master-creador-panel");
            panel.appendChild(crear("p", "oc-hoja-nota", borrar
                ? ocT("Busca lo que quieras quitar (del SRD o tuyo) y pulsa ✕ dos veces. Lo del SRD no se borra de verdad: deja de salir en la app, y lo recuperas abajo.")
                : ocT("Busca lo que quieras cambiar (del SRD o tuyo) y pulsa ✎. Si es del SRD, se guarda tu versión, que sale en su lugar en toda la app; ↺ lo deja como era.")));
            const etB = crear("label", "oc-dados-etiqueta", ocT("buscar"));
            const busca = crear("input", "oc-dados-texto");
            busca.type = "search";
            busca.id = uid + "-" + d.accion + "-" + k;
            busca.autocomplete = "off";
            etB.htmlFor = busca.id;
            // Y de dónde: todo, el SRD, todo lo tuyo o una categoría tuya.
            const etF = crear("label", "oc-dados-etiqueta", ocT("de dónde"));
            const filtro = crear("select", "master-elegir");
            filtro.id = busca.id + "-de";
            etF.htmlFor = filtro.id;
            const pintarFiltro = () => {
                const antes = filtro.value || "*";
                const ops = [["*", ocT("todo")], ["srd", ocT("📖 sólo el SRD")], ["tuyo", ocT("🛠️ sólo lo tuyo")]]
                    .concat(categoriasPropias().map((c) => ["cat:" + c, "📕 " + c]));
                filtro.replaceChildren(...ops.map(([v, t]) => {
                    const o = crear("option", "", t);
                    o.value = v;
                    return o;
                }));
                filtro.value = ops.some(([v]) => v === antes) ? antes : "*";
            };
            pintarFiltro();
            const buscador = crear("div", "master-creador-buscador");
            const cajaB = crear("div", "master-creador-campo");
            const cajaF = crear("div", "master-creador-campo");
            cajaB.append(etB, busca);
            cajaF.append(etF, filtro);
            buscador.append(cajaB, cajaF);
            const ul = crear("div", "master-creador-grupos");
            ul.setAttribute("role", "region");
            ul.setAttribute("aria-label", ocT("Resultados"));
            const borrados = crear("details", "master-creador-srd");
            panel.append(buscador, ul);
            if (borrar && k !== "otros") {
                panel.appendChild(borrados);
            }
            const dosVeces = (b, nombre, alSeguro) => {
                let seguro = false;
                b.addEventListener("click", () => {
                    if (!seguro) {
                        seguro = true;
                        b.classList.add("es-seguro");
                        avisar(ocT("Pulsa otra vez para seguir: {nombre}.", { nombre }));
                        return;
                    }
                    alSeguro();
                });
            };
            function guardarYPintar(p, aviso) {
                if (!guardarPropios(p)) {
                    avisar(ocT("No se ha podido guardar: ¿no queda sitio en el navegador?"));
                    return;
                }
                pintar();
                avisar(aviso);
                busca.focus();
            }
            function fila(y) {
                const li = crear("li", "master-creador-fila");
                const ver = botonDe("master-creador-ver", "", () => abrirUno(k, y, ver));
                ver.setAttribute("aria-haspopup", "dialog");
                if (y.id) {
                    ver.dataset.id = y.id;
                }
                const de = y.cambia ? ocT("✎ cambiado") : y.propio ? ocT("🛠️ tuyo") : "SRD";
                ver.append(crear("span", "master-creador-nombre", y.nombre), crear("span", "master-creador-detalle",
                    detalleDe(k, y) + " · " + de));
                li.appendChild(ver);
                if (!borrar) {
                    const cambiarB = botonDe("master-docs-mando", "✎", () => (y.propio ? editar(k, y)
                        : conAvisoSrd("editar", y.nombre, cambiarB, () => editar(k, Object.assign(JSON.parse(JSON.stringify(y)),
                            { cambia: claveSrd(k, y) })))), ocT("Cambiar {nombre}", { nombre: y.nombre }));
                    li.appendChild(cambiarB);
                    if (y.cambia) {
                        const original = botonDe("master-docs-mando", "↺", null, ocT("Dejar {nombre} como era en el SRD", { nombre: y.nombre }));
                        dosVeces(original, ocT("dejarlo como era"), () => {
                            const p = leerPropios();
                            p[k] = p[k].filter((z) => z.id !== y.id);
                            guardarYPintar(p, ocT("{nombre}, como era en el SRD.", { nombre: y.nombre }));
                        });
                        li.appendChild(original);
                    }
                    return li;
                }
                const quitar = botonDe("master-docs-mando", "✕", null, ocT("Borrar {nombre}", { nombre: y.nombre }));
                const borrarYa = () => {
                    const p = leerPropios();
                    p.ocultos = p.ocultos || {};
                    const ocultos = p.ocultos[k] = Array.isArray(p.ocultos[k]) ? p.ocultos[k] : [];
                    if (y.propio) {
                        p[k] = p[k].filter((z) => z.id !== y.id);
                    }
                    const clave = y.cambia || (!y.propio && claveSrd(k, y));
                    if (clave && !ocultos.includes(clave)) {
                        ocultos.push(clave);
                    }
                    guardarYPintar(p, ocT("Borrado: {nombre}.", { nombre: y.nombre }));
                };
                // Lo tuyo, pulsando dos veces; lo del SRD (o tu versión de
                // uno), con el aviso.
                if (y.propio && !y.cambia) {
                    dosVeces(quitar, ocT("borrar {nombre}", { nombre: y.nombre }), borrarYa);
                } else {
                    quitar.addEventListener("click", () => conAvisoSrd("borrar", y.nombre, quitar, borrarYa));
                }
                li.appendChild(quitar);
                return li;
            }
            function pintar() {
                const p = leerPropios();
                const ocultos = new Set((p.ocultos && p.ocultos[k]) || []);
                const cambios = new Map(p[k].filter((y) => y.cambia).map((y) => [y.cambia, y]));
                const todos = srd[k].filter((y) => !ocultos.has(claveSrd(k, y))).map((y) => cambios.get(claveSrd(k, y)) || y)
                    .concat(p[k].filter((y) => !y.cambia));
                pintarFiltro();
                const q = llano(busca.value.trim());
                const f = filtro.value;
                const salen = todos.filter((y) => !q || llano(y.nombre + " " + (y.en || "") + " " + (y.libro || "")).includes(q))
                    .filter((y) => f === "*" || (f === "srd" ? !y.propio : f === "tuyo" ? y.propio : y.propio && (y.libro || "").trim() === f.slice(4)))
                    .sort((a, b) => a.nombre.localeCompare(b.nombre, window.ocLocale));
                // Separados: lo tuyo primero (por categorías; con tus
                // versiones del SRD) y lo de base (el SRD, tal cual; los
                // 100 primeros).
                const base = salen.filter((y) => !y.propio);
                const tuyos = salen.filter((y) => y.propio);
                const grupos = [];
                porCategorias(tuyos).forEach(([cat, xs]) => grupos.push(grupoCategoria(ocT("🛠️ tuyo · {cat}", { cat }), xs.map(fila))));
                if (base.length) {
                    grupos.push(grupoCategoria(ocT("📖 contenido de base (SRD)"), base.slice(0, 100).map(fila), base.length > 100
                        ? crear("p", "oc-vacio", ocT("…y {n} más: escribe para encontrarlo.", { n: base.length - 100 })) : null, base.length));
                }
                ul.replaceChildren(...grupos);
                if (!salen.length) {
                    ul.appendChild(crear("p", "oc-vacio", ocT("Nada con eso.")));
                }
                // Lo borrado del SRD, para recuperarlo.
                const quitados = srd[k].filter((y) => ocultos.has(claveSrd(k, y)));
                const lista = crear("ul", "master-creador-lista");
                lista.append(...quitados.map((y) => {
                    const li = crear("li", "master-creador-fila");
                    li.append(crear("span", "master-creador-nombre", y.nombre), botonDe("master-docs-mando", "↺", () => {
                        const p2 = leerPropios();
                        p2.ocultos[k] = (p2.ocultos[k] || []).filter((c) => c !== claveSrd(k, y));
                        guardarYPintar(p2, ocT("Recuperado: {nombre}.", { nombre: y.nombre }));
                    }, ocT("Recuperar {nombre}", { nombre: y.nombre })));
                    return li;
                }));
                if (!quitados.length) {
                    lista.appendChild(crear("li", "oc-vacio", ocT("Ninguno.")));
                }
                borrados.replaceChildren(crear("summary", "", ocT("🗑️ borrados del SRD ({n})", { n: quitados.length })), lista);
            }
            busca.addEventListener("input", pintar);
            filtro.addEventListener("change", pintar);
            cargado.then(pintar);
            repintar.push(pintar);
            return panel;
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
                if (valor && !lista.some((v) => (Array.isArray(v) ? v[0] : v) === valor)) {
                    lista.push(valor);
                }
                lista.forEach((v) => {
                    const op2 = crear("option", "", Array.isArray(v) ? v[1] : verDato(v) || "—");
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
                et.append(c, " " + verDato(v));
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
                const nom = campo(li, ocT("nombre"), r.n);
                const tex = campo(li, ocT("texto"), r.t, { filas: 3, ancho: true });
                const quitar = botonDe("master-docs-mando", "✕", () => {
                    filas.splice(filas.indexOf(x), 1);
                    li.remove();
                    mas.focus();
                    avisar(ocT("Quitado de {toLowerCase}.", { toLowerCase: titulo.toLowerCase() }));
                }, ocT("Quitar esta entrada de {toLowerCase}", { toLowerCase: titulo.toLowerCase() }));
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
            const mas = botonDe("oc-vida-accion", ocT("＋ añadir"), () => fila({ n: "", t: "" }, true), ocT("Añadir a {toLowerCase}", { toLowerCase: titulo.toLowerCase() }));
            botones.appendChild(mas);
            if (conAtaque) {
                botones.appendChild(botonDe("oc-vida-accion", ocT("＋ ataque"), () => fila({ n: "Ataque",
                    t: ocT("*Ataque cuerpo a cuerpo:* +4, alcance 5 ft. *Impacto:* 5 (1d6 + 2) de daño cortante.") }, true),
                ocT("Añadir un ataque (con el formato que sale en tabla)")));
                botones.appendChild(botonDe("oc-vida-accion", ocT("＋ salvación"), () => fila({ n: "Aliento",
                    t: ocT("*Tirada de salvación de Destreza:* CD 13, cada criatura en un cono de 15 ft. *Fallo:* 14 (4d6) de daño de fuego. *Éxito:* la mitad del daño.") }, true),
                ocT("Añadir un efecto con tirada de salvación")));
            }
            fs.append(ul, botones);
            editor.appendChild(fs);
            return () => filas.map((x) => ({ n: x.nom.value.trim(), t: x.tex.value.trim() })).filter((r) => r.n || r.t);
        }
        let volverA = null;
        // Pegar un bloque y, con lo que se entienda, el formulario relleno.
        function abrirPegar(k, vuelta) {
            const cuerpo = crear("form", "master-pegar");
            const et = crear("label", "oc-dados-etiqueta", ocT("pega aquí el bloque"));
            const area = crear("textarea", "oc-dados-texto master-pegar-area");
            area.id = uid + "-pegar";
            area.rows = 14;
            area.placeholder = k === "monstruos" ? ocT("Goblin Warrior\nSmall Fey (Goblinoid), Chaotic Neutral\nAC 15  Initiative +2…")
                : k === "conjuros" ? ocT("Fireball\nLevel 3 Evocation (Sorcerer, Wizard)\nCasting Time: Action…")
                    : ocT("Bag of Holding\nWondrous Item, Uncommon\nThis bag has…");
            et.htmlFor = area.id;
            const nota = crear("p", "oc-hoja-nota", conTraducir.checked ? ocT("🌐 Los términos de reglas en inglés se pasan al español.")
                : ocT("Tal cual (sin traducir: está desmarcado «🌐 traducir»)."));
            nota.hidden = window.ocLocale === "en";
            const ok = crear("button", "oc-vida-accion es-principal", ocT("✓ rellenar"));
            ok.type = "submit";
            const guia = botonDe("oc-vida-accion", ocT("❓ cómo"), () => abrirGuiaPegar(guia), ocT("Cómo pegar desde D&D Beyond (guía)"));
            const fila = crear("div", "master-creador-barra");
            fila.append(ok, guia);
            cuerpo.append(et, area, nota, fila);
            cuerpo.addEventListener("submit", (e) => {
                e.preventDefault();
                if (!area.value.trim()) {
                    avisar(ocT("Pega primero el bloque."));
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
                avisar(ocT("Relleno con lo pegado: repásalo y guarda."));
            });
            const cerrarPegar = window.ocVentana.abrir({ titulo: ocT("pegar un bloque"), cuerpo, vuelta, foco: area });
        }

        function editar(k, x, esNuevo) {
            volverA = document.activeElement;
            const actual = x && !esNuevo ? x : null;
            const v = x || {};
            n = 0;
            editor.replaceChildren();
            const uno = TIPOS.find((t) => t[0] === k)[2];
            editor.appendChild(crear("h3", "master-creador-titulo", actual ? "✎ " + actual.nombre : "＋ " + (k === "otros" ? ocT("cosa nueva")
                : ocT("{uno} nuevo", { uno: uno }))));
            const base = grupo(ocT("Lo básico"));
            const nombre = campo(base, ocT("nombre (en español)"), v.nombre, { obligatorio: true });
            const en = k === "otros" ? null : campo(base, ocT("nombre original"), v.en === v.nombre ? "" : v.en, { ayuda: ocT("opcional") });
            // La categoría (de qué libro), al guardar: en su ventana.
            const libro = { value: v.libro || "" };
            const leer = { comun: () => ({ nombre: nombre.value, en: (en && en.value.trim()) || nombre.value, libro: libro.value }) };
            if (k === "monstruos") {
                const t = /^(.+?)(?: \(([^)]*)\))? ((?:Diminuto|Pequeño|Mediano|Grande|Enorme|Gargantuesco)(?: o \S+)?)$/
                    .exec(v.tipo || "") || [];
                const tipo = campo(base, ocT("tipo"), t[1] || (v.tipo ? v.tipo : "Monstruosidad"), { opciones: PROPIO_TIPOS });
                const etiqueta = campo(base, ocT("etiqueta"), t[2] || "", { ayuda: ocT("opcional: goblinoide…") });
                const tam = campo(base, ocT("tamaño"), t[3] || (v.tipo ? "" : "Mediano"), { opciones: PROPIO_TAMANOS.map(tamanoVer) });
                const alin = campo(base, ocT("alineamiento"), v.alin || "neutral", { opciones: PROPIO_ALIN });
                const cr = campo(base, ocT("VD"), v.cr || "1", { opciones: CR_LISTA });
                const comb = grupo(ocT("Combate"));
                const ca = campo(comb, ocT("CA"), v.ca, { ayuda: ocT("15 (cota de mallas)") });
                const pg = campo(comb, ocT("PG"), v.pg, { tipo: "number", min: 1 });
                const pgf = campo(comb, ocT("dados de PG"), v.pgf, { ayuda: "4d8 + 4" });
                const ini = campo(comb, ocT("iniciativa"), v.ini, { ayuda: ocT("vacío: la de su Destreza") });
                const vel = campo(comb, ocT("velocidad"), v.vel, { ayuda: ocT("30 ft., vuelo 60 ft."), ancho: true });
                const ca2 = grupo(ocT("Características"));
                const car = {};
                const VER_CAR = { Fue: ocT("Fue"), Des: ocT("Des"), Con: ocT("Con"), Int: ocT("Int"), Sab: ocT("Sab"), Car: ocT("Car") };
                ["Fue", "Des", "Con", "Int", "Sab", "Car"].forEach((c) => {
                    car[c] = campo(ca2, VER_CAR[c], (v.car || {})[c] || 10, { tipo: "number", min: 1, max: 30 });
                });
                const mas = grupo(ocT("Más datos"));
                const otros = {};
                [["salv", ocT("salvaciones"), ocT("Des +5, Sab +3")], ["hab", ocT("habilidades"), ocT("Percepción +4, Sigilo +6")],
                    ["vuln", ocT("vulnerabilidades"), ocT("fuego")], ["res", ocT("resistencias"), ocT("frío; contundente")],
                    ["inm", ocT("inmunidades al daño"), ocT("veneno")], ["inmE", ocT("inmunidades a estados"), ocT("envenenado, asustado")],
                    ["sent", ocT("sentidos"), ocT("visión en la oscuridad 60 ft.; Percepción pasiva 12")], ["idio", ocT("idiomas"), ocT("común, dracónico")],
                    ["equipo", ocT("equipo"), ocT("espada larga, escudo")]].forEach(([c, et, ayuda]) => {
                    otros[c] = campo(mas, et, v[c], { ayuda, ancho: true });
                });
                const habitat = marcasDe(ocT("Hábitat (para los encuentros)"), PROPIO_HABITATS, v.habitat);
                const secc = {};
                SECCIONES_BICHO.forEach(([c, titulo]) => {
                    secc[c] = entradas(titulo, v[c], c === "acciones" || c === "adicionales" || c === "legendarias");
                });
                const legInfo = campo(grupo(ocT("Uso de las legendarias (si tiene)")), ocT("cómo se usan"), v.legInfo, { filas: 2, ancho: true,
                    ayuda: ocT("*Usos de acción legendaria:* 3. Justo después del turno de otra criatura, puede gastar un uso…") });
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
                const cat = campo(base, ocT("categoría"), v.cat || "objeto maravilloso", { lista: PROPIO_CATS });
                const rareza = campo(base, ocT("rareza"), v.rareza || "", { opciones: [["", ocT("— (no mágico)")]].concat(PROPIO_RAREZAS) });
                const precio = campo(base, ocT("precio (po)"), v.cp ? v.cp / 100 : "", { tipo: "number", paso: "any" });
                const peso = campo(base, ocT("peso"), v.peso, { ayuda: ocT("2 lb.") });
                const det = campo(base, ocT("detalles"), v.det, { ayuda: ocT("1d8 cortante, versátil…"), ancho: true });
                const nota2 = campo(base, ocT("nota"), v.nota, { ancho: true });
                const etS = crear("label", "master-creador-check");
                const sint = crear("input");
                sint.type = "checkbox";
                sint.checked = !!v.sint;
                etS.append(sint, ocT(" requiere sintonía"));
                base.appendChild(etS);
                const tiendas = marcasDe(ocT("Se vende en (para la tienda y los negocios)"), PROPIO_TIENDAS, v.tiendas);
                const texto = campo(grupo(ocT("Qué hace")), ocT("texto"), v.texto, { filas: 8, ancho: true,
                    ayuda: ocT("Admite *cursiva* y **negrita**; los conjuros en cursiva se enlazan.") });
                leer.resto = () => ({ cat: cat.value, rareza: rareza.value, cp: Math.round((Number(precio.value) || 0) * 100),
                    peso: peso.value, det: det.value, nota: nota2.value, sint: sint.checked, tiendas: tiendas(), texto: texto.value });
            } else if (k === "conjuros") {
                const nivel = campo(base, ocT("nivel"), v.nivel === undefined ? 1 : v.nivel, { opciones: [["0", ocT("truco")]]
                    .concat(Array.from({ length: 9 }, (x2, i) => [String(i + 1), ocT("nivel {n}", { n: i + 1 })])) });
                const escuela = campo(base, ocT("escuela"), v.escuela || "Evocación", { opciones: PROPIO_ESCUELAS });
                const tiempo = campo(base, ocT("lanzamiento"), v.tiempo, { ayuda: ocT("1 acción") });
                const alcance = campo(base, ocT("alcance"), v.alcance, { ayuda: ocT("60 ft.") });
                const comp = campo(base, ocT("componentes"), v.comp, { ayuda: ocT("V, S, M (una pluma)") });
                const dur = campo(base, ocT("duración"), v.dur, { ayuda: ocT("Concentración, hasta 1 minuto") });
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
                const conc = caja(ocT("concentración"), v.conc);
                base.appendChild(marcas);
                const otrasClases = (v.clases || []).filter((c) => !PROPIO_CLASES.includes(c));
                const clases = marcasDe(ocT("Clases"), PROPIO_CLASES, v.clases);
                const mas = campo(grupo(ocT("Otras clases o subclases")), ocT("separadas por comas"), otrasClases.join(", "), { ancho: true });
                const tx = grupo(ocT("Qué hace"));
                const texto = campo(tx, ocT("texto"), v.texto, { filas: 8, ancho: true });
                const superior = campo(tx, ocT("a nivel superior / mejora del truco"), v.superior, { filas: 2, ancho: true });
                leer.resto = () => ({ nivel: nivel.value, escuela: escuela.value, tiempo: tiempo.value, alcance: alcance.value,
                    comp: comp.value, dur: dur.value, ritual: ritual.checked, conc: conc.checked,
                    clases: clases().concat(mas.value.split(",").map((c) => c.trim()).filter(Boolean)), texto: texto.value,
                    superior: superior.value });
            } else if (k === "rasgos") {
                const tipo = campo(base, ocT("qué es"), v.tipo || "dote general", { opciones: PROPIO_RASGOS.map((t) => [t, t]) });
                const de = campo(base, ocT("de quién (clase, subclase o especie)"), v.de === "dote" ? "" : v.de, { ayuda: ocT("Pícaro (Ladrón) · Elfo") });
                const nivel = campo(base, ocT("nivel (si es de clase)"), v.nivel || "", { tipo: "number", min: 0, max: 20 });
                const texto = campo(grupo(ocT("Qué hace")), ocT("texto"), v.texto, { filas: 10, ancho: true,
                    ayuda: ocT("Admite **negrita**, *cursiva* (los conjuros en cursiva se enlazan), listas con «- » y párrafos.") });
                leer.resto = () => ({ tipo: tipo.value, de: de.value.trim() || (/dote|estilo|don/.test(tipo.value) ? "dote" : ""),
                    nivel: nivel.value, texto: texto.value });
            } else {
                const cat = campo(base, ocT("qué es"), v.cat || "dote", { lista: PROPIO_OTROS });
                const texto = campo(grupo(ocT("Texto")), ocT("texto"), v.texto, { filas: 12, ancho: true,
                    ayuda: ocT("Admite **negrita**, *cursiva*, listas con «- » y párrafos.") });
                leer.resto = () => ({ cat: cat.value, texto: texto.value });
            }
            // Los botones, abajo.
            const botones = crear("div", "master-creador-barra master-creador-final");
            const ok = crear("button", "oc-vida-accion es-principal", ocT("✓ guardar"));
            ok.type = "submit";
            const traducirB = botonDe("oc-vida-accion", ocT("🌐 traducir términos"), () => {
                editor.querySelectorAll("input[type=text], input:not([type]), textarea").forEach((c) => {
                    if (c !== nombre && c !== en && c !== libro) {
                        c.value = traducir(c.value);
                    }
                });
                if (k === "monstruos") {
                    avisar(ocT("Términos traducidos. El tipo y el tamaño, en sus desplegables."));
                } else {
                    avisar(ocT("Términos traducidos (las frases se quedan como estaban)."));
                }
            }, ocT("Traducir al español los términos de reglas en inglés de este formulario"));
            const no = botonDe("oc-vida-accion", ocT("cancelar"), cerrar);
            traducirB.hidden = window.ocLocale === "en";
            botones.append(ok, traducirB, no);
            editor.appendChild(botones);
            editor.onsubmit = (e) => {
                e.preventDefault();
                if (!nombre.value.trim()) {
                    avisar(ocT("Ponle un nombre."));
                    nombre.focus();
                    return;
                }
                elegirCategoria(libro.value, ok, (cat) => {
                    libro.value = cat;
                    guardarYa();
                });
            };
            const guardarYa = () => {
                const datos = Object.assign(leer.comun(), leer.resto());
                if (actual) {
                    datos.id = actual.id;
                    datos.cambia = actual.cambia;
                }
                const o = limpiarPropio(k, datos);
                if (k !== "otros" && !o.cambia) {
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
                    avisar(ocT("No se ha podido guardar: ¿no queda sitio en el navegador?"));
                    return;
                }
                cerrar(o.id);
                avisar(ocT("Guardado: {nombre}.", { nombre: o.nombre }));
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
        const titulo = crear("h2", "master-compendio-titulo");
        titulo.id = "master-compendio-titulo";
        const volver = botonDe("oc-vida-accion", ocT("✕ volver al tablero"), cerrar, ocT("Cerrar el compendio y volver al tablero"));
        volver.title = ocT("Volver al tablero (Esc)");
        // Arriba a la derecha, qué hacer: añadir, editar lo que hay o borrar.
        const ACCIONES = [["anadir", ocT("＋ añadir"), ocT("＋ añadir al compendio")], ["editar", ocT("✎ editar"), ocT("✎ editar el compendio")],
            ["borrar", ocT("🗑️ borrar"), ocT("🗑️ borrar del compendio")]];
        const acciones = crear("div", "master-compendio-acciones");
        acciones.setAttribute("role", "group");
        acciones.setAttribute("aria-label", ocT("Qué hacer con el compendio"));
        const botonesAccion = ACCIONES.map(([clave, corto, largo]) => {
            const b = botonDe("master-compendio-accion", corto, () => {
                if (datos.accion !== clave) {
                    ponerAccion(clave);
                    avisar(largo + ".");
                }
            }, largo);
            b.dataset.accion = clave;
            return b;
        });
        acciones.append(...botonesAccion);
        cabeza.append(titulo, acciones, volver);
        const cuerpo = crear("div", "master-compendio-cuerpo");
        fondo.append(cabeza, cuerpo);
        function ponerAccion(clave) {
            datos.accion = ACCIONES.some((a) => a[0] === clave) ? clave : "anadir";
            titulo.textContent = ACCIONES.find((a) => a[0] === datos.accion)[2];
            botonesAccion.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.accion === datos.accion)));
            // Cada vez, uno nuevo (el de antes se va con sus escuchas).
            const dentro = crear("div");
            cuerpo.replaceChildren(dentro);
            montarCreador(dentro, m);
            recordar();
        }
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
        ponerAccion(datos.accion);
        function recordar() {
            try {
                localStorage.setItem(CLAVE_COMPENDIO, JSON.stringify({ pestana: m.datos.pestana || 0, traducir: m.datos.traducir,
                    accion: m.datos.accion }));
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
            avisar(ocT("Recargando…"));
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
        avisar(ocT("Compendio abierto. Esc para volver al tablero."));
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
    Object.assign(PM, { datosJug });
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
            }).catch(() => avisar(ocT("No se ha podido guardar la imagen.")));
        }
        hecho();
        return Promise.resolve();
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

    // ---- TABLAS ALEATORIAS PROPIAS: una entrada por línea («3× » delante
    // para que salga más; «{2d6}» dentro se tira al salir). Para todas las
    // campañas («richi-master-tablas»). ----
    const CLAVE_TABLAS = "richi-master-tablas";
    Object.assign(PM, { CLAVE_TABLAS });

    const MODULOS = {
        iniciativa: { nombre: "iniciativa", emoji: "⏱️", grupo: "combate", unico: true, w: 420, h: 520,
            desc: ocT("El orden de turnos, con rondas, PG y marcas."),
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
                    pj.nombre || ocT("jugador {n}", { n: i + 1 })))).filter(Boolean).join(", ");
            } }) },
        condiciones: { nombre: ocT("condiciones"), emoji: "🙈", grupo: "combate", unico: true, w: 460, h: 420,
            desc: ocT("Los estados: agarrado, cegado, derribado…"), montar: (d, m) => montarReglas(d, m, "Estados") },
        acciones: { nombre: "acciones", emoji: "⚔️", grupo: "combate", unico: true, w: 460, h: 420,
            desc: ocT("Lo que se puede hacer en un turno."), montar: (d, m) => montarReglas(d, m, "Acciones") },
        tiradas: { nombre: ocT("registro de tiradas"), emoji: "🎲", grupo: "mesa", unico: true, w: 380, h: 480,
            desc: ocT("Las tiradas de los dados, una debajo de otra, siempre a la vista (las mismas que en la ventana de los dados)."),
            montar: PM.montarTiradas },
        turnos: { nombre: ocT("turnos"), emoji: "⏩", grupo: "turno", unico: true, w: 380, h: 640,
            desc: ocT("A quién le toca, en grande; quién va después, y pasar al turno siguiente o al anterior."), montar: PM.montarTurnos },
        criaturaTurno: { nombre: ocT("criatura del turno"), emoji: "🐲", grupo: "turno", unico: true, w: 520, h: 640,
            desc: ocT("El perfil de quien tiene el turno: su bloque del bestiario o la ficha resumida del personaje."),
            montar: PM.montarCriaturaTurno },
        reglas: { nombre: ocT("todas las reglas"), emoji: "📚", grupo: "consulta", unico: true, w: 480, h: 520,
            desc: ocT("Las reglas del SRD 5.2, por temas."), montar: (d, m) => montarReglas(d, m, null) },
        homebrew: { nombre: ocT("reglas propias"), emoji: "🏠", grupo: "consulta", unico: true, w: 460, h: 460,
            desc: ocT("Las reglas de tu mesa (homebrew)."), montar: PM.montarHomebrew },
        rasgos: { nombre: ocT("rasgos, dotes y habilidades"), emoji: "⭐", grupo: "consulta", unico: true, w: 440, h: 520,
            desc: ocT("Los rasgos de clase y especie, las dotes y las habilidades del SRD, y los tuyos."), montar: PM.montarRasgos },
        conjuros: { nombre: "conjuros", emoji: "✨", grupo: "consulta", unico: true, w: 420, h: 480,
            desc: ocT("Los 339 del SRD, por nivel, escuela y clase."), montar: PM.montarConjuros },
        bestiario: { nombre: ocT("bestiario"), emoji: "🐉", grupo: "consulta", unico: true, w: 460, h: 520,
            desc: ocT("Los 330 monstruos del SRD, con su perfil."), montar: PM.montarBestiario },
        visor: { nombre: ocT("fichas de la party"), emoji: "🧝", grupo: "mesa", unico: true, w: 1000, h: 640,
            desc: ocT("Cada personaje con su ficha entera, como un libro: historia, ficha, criaturas, PNJ, imágenes, extra…"),
            montar: PM.montarVisor },
        party: { nombre: ocT("party (jugadores)"), emoji: "🛡️", grupo: "mesa", unico: true, w: 600, h: 440,
            desc: ocT("Los personajes de los jugadores: de un vistazo, sus hechizos y su ficha entera (con pestañas)."), montar: PM.montarParty },
        tienda: { nombre: ocT("tienda"), emoji: "💰", grupo: "mundo", w: 520, h: 560, desc: ocT("Precios, rarezas y regateo."),
            montar: PM.montarTienda },
        monedas: { nombre: ocT("conversor de monedas"), emoji: "🪙", grupo: "mundo", w: 420, h: 440,
            desc: ocT("Cambiar y repartir el botín."), montar: PM.montarMonedas },
        nombres: { nombre: ocT("generador de nombres"), emoji: "🎭", grupo: "mundo", w: 440, h: 560,
            desc: ocT("Personajes por especie y género, y lugares."), montar: PM.montarNombres },
        botin: { nombre: ocT("botín"), emoji: "💰", grupo: "mundo", w: 440, h: 560,
            desc: ocT("Monedas, gemas, arte y objetos mágicos según el VD."), montar: PM.montarBotin },
        encuentros: { nombre: ocT("encuentros"), emoji: "🗺️", grupo: "combate", w: 440, h: 620,
            desc: ocT("Monstruos del SRD por hábitat para tu party."), montar: PM.montarEncuentros },
        pnj: { nombre: ocT("PNJ rápidos"), emoji: "🧑", grupo: "mundo", w: 460, h: 620,
            desc: ocT("Un PNJ con oficio, aspecto, carácter, manía, lo que quiere y un secreto."), montar: PM.montarPnj },
        dungeon: { nombre: ocT("generador de dungeons"), emoji: "🗝️", grupo: "mundo", w: 680, h: 780,
            desc: ocT("Un mapa en cuadrícula con sus salas, monstruos, trampas y botín."), montar: PM.montarDungeon },
        calendario: { nombre: "calendario", emoji: "📅", grupo: "mundo", w: 520, h: 720,
            desc: ocT("Gregoriano, el de Harptos o uno propio, con la hora y apuntes."), montar: PM.montarCalendario },
        efectos: { nombre: ocT("efectos con duración"), emoji: "⌛", grupo: "combate", w: 460, h: 620,
            desc: ocT("Bendecir 1 minuto, Armadura de mago 8 horas…: se descuentan solos."), montar: PM.montarEfectos },
        taberna: { nombre: ocT("negocios"), emoji: "🏪", grupo: "mundo", w: 500, h: 760,
            desc: ocT("Tabernas y posadas, tiendas, templos, establos…: con lo que venden, sus precios y un gancho."), montar: PM.montarNegocio },
        ambiente: { nombre: ocT("sonido ambiente"), emoji: "🎧", grupo: "mesa", unico: true, w: 440, h: 640,
            desc: ocT("Lluvia, viento, hoguera, mercado, carro…: grabaciones de verdad en bucle, mezcladas (y tus audios)."),
            montar: PM.montarAmbiente },
        sonidos: { nombre: ocT("efectos de sonido"), emoji: "🔔", grupo: "mesa", unico: true, w: 560, h: 680,
            desc: ocT("Puertas, tajos, conjuros, gritos, monstruos…: suenan una vez al pulsar (y tus audios)."),
            montar: PM.montarSonidos },
        tablas: { nombre: ocT("tablas aleatorias"), emoji: "🎲", grupo: "mundo", w: 460, h: 560,
            desc: ocT("Tus tablas (rumores, clima, encuentros de una zona…) y tirarlas con un clic."), montar: PM.montarTablas },
        linea: { nombre: ocT("línea temporal"), emoji: "🗓️", grupo: "apuntes", unico: true, w: 520, h: 680,
            desc: ocT("Las sesiones y lo que pasa en la campaña, en orden y con su fecha."), montar: PM.montarLinea },
        relaciones: { nombre: ocT("mapa de relaciones"), emoji: "🕸️", grupo: "apuntes", unico: true, w: 760, h: 760,
            desc: ocT("PNJ, facciones, lugares y la party, y cómo se llevan."), montar: PM.montarRelaciones },
        jugadores: { nombre: ocT("pantalla de jugadores"), emoji: "📺", grupo: "mesa", unico: true, w: 460, h: 620,
            desc: ocT("Una ventana aparte para la tele, Discord u OBS con sólo lo que tú elijas."), montar: PM.montarJugadores },
        musica: { nombre: ocT("música"), emoji: "🎶", grupo: "mesa", unico: true, w: 560, h: 720,
            desc: ocT("Tus canciones en carpetas y subcarpetas: una en bucle o la carpeta entera (se quedan en tu navegador)."),
            montar: PM.montarMusica },
        relojes: { nombre: ocT("relojes"), emoji: "⏳", grupo: "mesa", w: 440, h: 480,
            desc: ocT("Relojes de progreso: amenazas que avanzan, cuentas atrás…"), montar: PM.montarRelojes },
        idiomas: { nombre: ocT("notas en otros idiomas"), emoji: "🪶", grupo: "mundo", w: 480, h: 680,
            desc: ocT("Escribe una nota y mírala en élfico, enano, infernal…"), montar: PM.montarIdiomas },
        tarjeta: { nombre: ocT("post-it"), emoji: "🗒️", grupo: "apuntes", w: 420, h: 340,
            desc: ocT("Un texto con formato: negrita, listas, colores…"), montar: PM.montarTarjeta },
        dibujo: { nombre: ocT("dibujo"), emoji: "🎨", grupo: "apuntes", w: 900, h: 660,
            desc: ocT("Un Paint con capas, bote, selección y rejilla de rol."), montar: PM.montarDibujo },
        notas: { nombre: ocT("notas"), emoji: "📝", grupo: "apuntes", unico: true, w: 520, h: 480,
            desc: ocT("Las notas de la sesión, con formato (como un Word)."), montar: PM.montarNotas },
        documentos: { nombre: ocT("documentos"), emoji: "🗂️", grupo: "apuntes", w: 420, h: 560,
            desc: ocT("Tus carpetas y notas: búscalas (nombre y contenido) y ábrelas en el tablero."), montar: PM.montarDocumentos },
        tabla: { nombre: ocT("tabla para tirar"), emoji: "🔮", grupo: "apuntes", w: 360, h: 380,
            desc: ocT("Una lista de la que sale una cosa al azar."), montar: PM.montarTabla },
        criatura: { nombre: ocT("criatura"), emoji: "🐾", oculto: true, w: 440, h: 520, montar: PM.montarCriatura },
        ficha: { nombre: ocT("ficha"), emoji: "📖", oculto: true, w: 420, h: 420, montar: PM.montarFicha },
        pj: { nombre: ocT("ficha de personaje"), emoji: "🧝", oculto: true, w: 620, h: 720, montar: PM.montarPj },
        inventario: { nombre: ocT("inventario de la party"), emoji: "🎒", grupo: "mesa", unico: true, w: 520, h: 600,
            desc: ocT("Lo que lleva la party en común y su dinero; «dar a…» un personaje."), montar: PM.montarInventario },
        documento: { nombre: ocT("nota"), emoji: "📄", oculto: true, w: 560, h: 560, montar: PM.montarDocumento },
    };
    const GRUPOS = [["combate", ocT("⚔️ combate")], ["turno", ocT("▶️ turno a turno")], ["consulta", ocT("📚 consulta")], ["mesa", ocT("🛡️ la mesa")], ["mundo", ocT("🌍 el mundo")],
        ["apuntes", ocT("🗒️ apuntes")]];

    // ---- EL ESTADO (lo que se guarda) ----
    // Los colores de las ventanas, como post-its: fijos, iguales en todos
    // los temas de la web (la barra de ese color con letra oscura).
    const COLORES = [["", ocT("sin color")], ["amarillo", ocT("amarillo"), "#ffe873"], ["naranja", ocT("naranja"), "#ffb870"],
        ["melocoton", ocT("melocotón"), "#ffcfa8"], ["rojo", ocT("rojo"), "#ff8f8f"], ["coral", ocT("coral"), "#ff7f6e"], ["rosa", ocT("rosa"), "#ffa6d5"],
        ["fucsia", ocT("fucsia"), "#ff6fcf"], ["morado", ocT("morado"), "#c9a2ff"], ["lavanda", ocT("lavanda"), "#ddd0ff"], ["azul", ocT("azul"), "#8fb8ff"],
        ["celeste", ocT("celeste"), "#7fdcff"], ["turquesa", ocT("turquesa"), "#5fe0c8"], ["menta", ocT("menta"), "#b8f5d0"], ["verde", ocT("verde"), "#8fe8a2"],
        ["lima", ocT("lima"), "#d4f27a"], ["arena", ocT("arena"), "#e8d8b0"], ["marron", ocT("marrón"), "#c9a37a"], ["gris", ocT("gris"), "#c9c9d1"],
        ["blanco", ocT("blanco"), "#f7f5f0"]];
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
    const TABLEROS = [["", ocT("el del tema")], ["tapete", ocT("tapete verde"), "#1f4d36"], ["bosque", ocT("bosque"), "#2d5a27"],
        ["musgo", ocT("musgo"), "#4a5d23"], ["vino", ocT("rojo vino"), "#5a1f2a"], ["carmesi", ocT("carmesí"), "#8b1e2d"],
        ["teja", ocT("teja"), "#9c4a2f"], ["noche", ocT("azul noche"), "#1d2b4f"], ["oceano", ocT("océano"), "#1f5f7a"],
        ["madera", ocT("madera"), "#5b3b22"], ["pizarra", ocT("pizarra"), "#2f3438"], ["ceniza", ocT("ceniza"), "#5c5c66"],
        ["negro", ocT("negro"), "#121212"], ["uva", ocT("morado"), "#3d2552"], ["pergamino", ocT("pergamino"), "#e8dcc0"],
        ["arena", ocT("arena"), "#d9c7a3"], ["crema", ocT("crema"), "#f4ecd8"], ["cielo", ocT("cielo"), "#bfd6e6"], ["menta", ocT("menta"), "#cde8d5"]];
    const hexTablero = (c) => hexPropio(c) || (TABLEROS.find((x) => x[0] === c) || [])[2] || "";
    // Las pestañas: los colores de los tableros y los de las ventanas.
    const COLORES_PESTANA = [["", ocT("sin color")]].concat(TABLEROS.slice(1),
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
        etOtro.append(otro, crear("span", "", ocT("🎨 otro")));
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
        [ocT("⭐home"), "#000000", "", [
            ["acciones", 1261, 15, 596, 712, "#ad1f1f", 1, 1, "gm90", 0], ["reglas", 1263, 118, 595, 706, "naranja", 1, 1, "gm89", 0],
            ["conjuros", 1261, 15, 596, 712, "celeste", 1, 1, "gm90", 0], ["notas", 6, 14, 1234, 792, "#1b1818", 0, 1, "gm49", 1],
            ["homebrew", 1263, 118, 595, 706, "blanco", 1, 1, "gm89", 0], ["calendario", 1263, 118, 595, 706, "gris", 1, 0.8, "gm89", 1],
            ["bestiario", 1258, 221, 600, 440, "#151619", 1, 1, "gm82", 0], ["party", 1258, 221, 600, 440, "rosa", 1, 1, "gm82", 1],
            ["dibujo", 6, 14, 1234, 792, "blanco", 0, 1, "gm49", 0], ["condiciones", 1261, 15, 596, 712, "coral", 1, 1, "gm90", 0],
            ["rasgos", 1261, 15, 596, 712, "amarillo", 1, 1, "gm90", 1]
        ]],
        [ocT("📝notas"), "noche", "oceano", [
            ["dibujo", 438, 17, 1318, 862, "arena", 0, 1, "gm76", 1], ["tarjeta", 7, 568, 381, 319, "amarillo", 0, 1, "gm77", 0],
            ["idiomas", 438, 17, 1318, 862, "", 0, 1, "gm76", 0], ["tarjeta", 7, 568, 381, 319, "verde", 0, 1, "gm77", 0],
            ["tarjeta", 7, 568, 381, 319, "celeste", 0, 1, "gm77", 0], ["tarjeta", 7, 568, 381, 319, "coral", 0, 1, "gm77", 1],
            ["documentos", 1, 10, 401, 548, "", 0, 1], ["notas", 438, 17, 1318, 862, "#575b60", 0, 1, "gm76", 0]
        ]],
        [ocT("❌combate"), "vino", "carmesi", [
            ["iniciativa", 7, 11, 391, 835, "#ca1c1c", 0, 1, "gm43", 1], ["condiciones", 1356, 15, 476, 776, "morado", 0, 1, "gm46", 1],
            ["acciones", 1356, 15, 476, 776, "fucsia", 0, 1, "gm46", 0], ["bestiario", 553, 18, 612, 630, "#000000", 0, 1, "gm72", 1],
            ["relojes", 7, 11, 391, 835, "lavanda", 0, 1, "gm43", 0], ["encuentros", 553, 18, 612, 630, "turquesa", 0, 1, "gm72", 0],
            ["party", 553, 18, 612, 630, "blanco", 0, 1, "gm72", 0]
        ]],
        [ocT("💰tiendas"), "uva", "arena", [
            ["tienda", 0, 0, 553, 836, "coral", 0, 1], ["monedas", 1416, 0, 420, 440, "amarillo", 0, 1],
            ["taberna", 621, 0, 662, 635, "morado", 0, 1]
        ]],
        [ocT("🧙‍♂️npcs"), "bosque", null, [
            ["nombres", 1352, 9, 460, 620, "azul", 0, 1, "gm70", 1], ["pnj", 1352, 9, 460, 620, "marron", 0, 1, "gm70", 0],
            ["bestiario", 1, 0, 457, 554, "rojo", 0, 1], ["tarjeta", 619, 21, 594, 505, "amarillo", 0, 1, "gm75", 1],
            ["tarjeta", 619, 21, 594, 505, "turquesa", 0, 1, "gm75", 0], ["tarjeta", 619, 21, 594, 505, "azul", 0, 1, "gm75", 0],
            ["tarjeta", 619, 21, 594, 505, "morado", 0, 1, "gm75", 0], ["tarjeta", 619, 21, 594, 505, "coral", 0, 1, "gm75", 0]
        ]],
        [ocT("🛡️party"), "verde", null, [
            ["party", 0, 0, 640, 720, "verde", 0, 1], ["inventario", 1327, 6, 520, 720, "melocoton", 0, 1]
        ]],
        [ocT("🎲generadores"), "pizarra", null, [
            ["dungeon", 0, 0, 1355, 870, "gris", 0, 1], ["botin", 1392, 4, 440, 456, "naranja", 0, 1],
            ["nombres", 1395, 481, 439, 256, "verde", 0, 1]
        ]],
        [ocT("🎵música"), "", "uva", [
            ["musica", 5, 24, 785, 878, "celeste", 0, 1], ["sonidos", 813, 23, 560, 680, "marron", 0, 1],
            ["ambiente", 1401, 20, 432, 688, "azul", 0, 1]
        ]]
    ];
    // En la app de Android, la disposición de Richi para la tableta
    // (hecha en una Galaxy Tab A7: 1333 × 800 en apaisado). Tras las
    // ventanas, el zoom del tablero si no es 100 %.
    const PERFILES_ANDROID = [
        [ocT("⭐home"), "#000000", "", [
            ["acciones", 910, 13, 596, 712, "#ad1f1f", 1, 1, "gm90", 1], ["reglas", 902, 126, 595, 706, "naranja", 1, 1, "gm89", 0],
            ["conjuros", 910, 13, 596, 712, "celeste", 1, 1, "gm90", 0], ["notas", 6, 14, 827, 547, "#1b1818", 0, 1, "gm49", 1],
            ["homebrew", 902, 126, 595, 706, "blanco", 1, 1, "gm89", 0], ["calendario", 902, 126, 595, 706, "gris", 1, 0.8, "gm89", 1],
            ["bestiario", 904, 238, 600, 440, "#151619", 0, 1, "gm82", 0], ["party", 904, 238, 600, 440, "rosa", 0, 1, "gm82", 1],
            ["dibujo", 6, 14, 827, 547, "blanco", 0, 1, "gm49", 0], ["condiciones", 910, 13, 596, 712, "coral", 1, 1, "gm90", 0],
            ["rasgos", 910, 13, 596, 712, "amarillo", 1, 1, "gm90", 0]
        ], 0.83],
        [ocT("📝notas"), "noche", "oceano", [
            ["dibujo", 375, 19, 900, 607, "arena", 0, 1, "gm76", 1], ["idiomas", 375, 19, 900, 607, "", 0, 1, "gm76", 0],
            ["documentos", 1, 10, 362, 616, "", 0, 1], ["notas", 375, 19, 900, 607, "#575b60", 0, 1, "gm76", 0]
        ]],
        [ocT("❌combate"), "vino", "carmesi", [
            ["iniciativa", 0, 0, 358, 625, "#ca1c1c", 0, 1, "gm43", 1], ["condiciones", 906, 0, 399, 609, "morado", 0, 1, "gm76", 1],
            ["acciones", 906, 0, 399, 609, "fucsia", 0, 1, "gm76", 0], ["bestiario", 390, 0, 472, 617, "#000000", 0, 1, "gm72", 1],
            ["relojes", 0, 0, 358, 625, "lavanda", 0, 1, "gm43", 0], ["encuentros", 390, 0, 472, 617, "turquesa", 0, 1, "gm72", 0],
            ["party", 390, 0, 472, 617, "blanco", 0, 1, "gm72", 0]
        ]],
        [ocT("💰tiendas"), "uva", "arena", [
            ["tienda", 0, 0, 488, 540, "coral", 0, 1, "gm81", 1], ["monedas", 0, 0, 488, 540, "amarillo", 0, 1, "gm81", 0],
            ["taberna", 532, 0, 679, 542, "morado", 0, 1]
        ]],
        [ocT("🧙‍♂️npcs"), "bosque", null, [
            ["nombres", 476, 4, 422, 549, "azul", 0, 1, "gm70", 1], ["pnj", 476, 4, 422, 549, "marron", 0, 1, "gm70", 0],
            ["bestiario", 1, 0, 457, 554, "rojo", 0, 1], ["tarjeta", 950, 12, 317, 533, "amarillo", 0, 1, "gm75", 1],
            ["tarjeta", 950, 12, 317, 533, "turquesa", 0, 1, "gm75", 0], ["tarjeta", 950, 12, 317, 533, "azul", 0, 1, "gm75", 0],
            ["tarjeta", 950, 12, 317, 533, "morado", 0, 1, "gm75", 0], ["tarjeta", 950, 12, 317, 533, "coral", 0, 1, "gm75", 0]
        ]],
        [ocT("🛡️party"), "verde", null, [
            ["party", 0, 0, 502, 645, "verde", 0, 1, "gm92", 0], ["inventario", 0, 0, 502, 645, "melocoton", 0, 1, "gm92", 1]
        ]],
        [ocT("🎲generadores"), "pizarra", null, [
            ["dungeon", 0, 0, 814, 580, "gris", 0, 1], ["botin", 865, 13, 440, 456, "naranja", 0, 1, "gm95", 0],
            ["nombres", 865, 13, 440, 456, "verde", 0, 1, "gm95", 1]
        ]],
        [ocT("🎵música"), "", "uva", [
            ["musica", 5, 24, 1173, 588, "celeste", 0, 1, "gm97", 0], ["sonidos", 5, 24, 1173, 588, "marron", 0, 1, "gm97", 1],
            ["ambiente", 5, 24, 1173, 588, "azul", 0, 1, "gm97", 0]
        ]]
    ];
    function perfilesDeSerie() {
        return (EN_ANDROID ? PERFILES_ANDROID : PERFILES_DE_SERIE).map(([nombre, color, colorPestana, ventanas, zoom]) => Object.assign({
            nombre, color,
            colorPestana: colorPestana === null ? color : colorPestana,
            modulos: ventanas.filter((v) => MODULOS[v[0]]).map(([tipo, x, y, w, h, c, plegado, escala, grupo, delante]) => Object.assign(
                { tipo, x, y, w, h, color: c, plegado: !!plegado, escala }, grupo ? { grupo, delante: !!delante } : {})) },
            zoom ? { zoom } : {}));
    }

    // LOS MODOS: además de los tableros (donde las ventanas van donde se
    // las deja), disposiciones fijas que llenan la pantalla, sin arrastrar
    // nada: una rejilla de 12 columnas × 6 filas con sus huecos, y en cada
    // hueco una ventana (o varias, en pestañas). Se cambia de modo con el
    // menú de abajo a la derecha. Un modo es como un perfil, con «rejilla»
    // (y sus ventanas, con «hueco»: su número en la rejilla); se guardan en
    // la campaña (todo.modos) y el de ahora, en todo.modoActivo.
    // Cada hueco: [columna, fila, ancho, alto] (de 1).
    const REJILLAS = {
        combate: { nombre: ocT("combate: lista, perfil y dos a la derecha"),
            huecos: [[1, 1, 3, 6], [4, 1, 5, 6], [9, 1, 4, 2], [9, 3, 4, 4]] },
        combate3: { nombre: ocT("combate: lista, perfil y pestañas"), huecos: [[1, 1, 3, 6], [4, 1, 5, 6], [9, 1, 4, 6]] },
        notas: { nombre: ocT("lateral y seis"), huecos: [[1, 1, 3, 6], [4, 1, 3, 3], [7, 1, 3, 3], [10, 1, 3, 3], [4, 4, 3, 3],
            [7, 4, 3, 3], [10, 4, 3, 3]] },
        una: { nombre: ocT("una, a toda la pantalla"), huecos: [[1, 1, 12, 6]] },
        dos: { nombre: ocT("dos columnas"), huecos: [[1, 1, 6, 6], [7, 1, 6, 6]] },
        tres: { nombre: ocT("tres columnas"), huecos: [[1, 1, 4, 6], [5, 1, 4, 6], [9, 1, 4, 6]] },
        lateral: { nombre: ocT("lateral y dos"), huecos: [[1, 1, 4, 6], [5, 1, 8, 3], [5, 4, 8, 3]] },
        cuatro: { nombre: ocT("cuatro (2 × 2)"), huecos: [[1, 1, 6, 3], [7, 1, 6, 3], [1, 4, 6, 3], [7, 4, 6, 3]] },
        seis: { nombre: ocT("seis (3 × 2)"), huecos: [[1, 1, 4, 3], [5, 1, 4, 3], [9, 1, 4, 3], [1, 4, 4, 3], [5, 4, 4, 3],
            [9, 4, 4, 3]] }
    };
    const esModo = (pf) => !!(pf && pf.rejilla);
    // Los de serie (los de Richi): [emoji, nombre, rejilla, ventanas], cada
    // ventana [tipo, hueco, color, grupo, delante].
    const MODOS_DE_SERIE = [
        ["📝", ocT("notas"), "notas", [["documentos", 0, ""], ["tarjeta", 1, "amarillo"], ["tarjeta", 2, "verde"], ["tarjeta", 3, "celeste"],
            ["tarjeta", 4, "coral"], ["tarjeta", 5, "rosa"], ["tarjeta", 6, "lima"]]],
        ["🛡️", ocT("party"), "una", [["visor", 0, "verde"]]],
        // Combate, en tres: los turnos; la criatura del turno (con la party
        // y el bestiario en pestañas); y la iniciativa con las condiciones,
        // las acciones y las reglas, en pestañas.
        ["⚔️", ocT("combate"), "combate3", [["turnos", 0, "#ca1c1c"], ["criaturaTurno", 1, "#151619", "gct", 1],
            ["party", 1, "verde", "gct", 0], ["bestiario", 1, "rojo", "gct", 0], ["iniciativa", 2, "lavanda", "gmc", 1],
            ["condiciones", 2, "morado", "gmc", 0], ["acciones", 2, "fucsia", "gmc", 0], ["reglas", 2, "naranja", "gmc", 0]]]
    ];
    // El combate de antes (cuatro huecos), tal y como venía: si nadie lo ha
    // tocado, se cambia por el de ahora.
    const COMBATE_DE_ANTES = "turnos:0,criaturaTurno:1,condiciones:2,acciones:2,reglas:2,iniciativa:3";
    function modosDeSerie() {
        return MODOS_DE_SERIE.map(([emoji, nombre, rejilla, ventanas]) => ({ nombre, emoji, rejilla,
            modulos: ventanas.filter((v) => MODULOS[v[0]]).map(([tipo, hueco, color, grupo, delante]) => Object.assign({ tipo, hueco,
                x: 0, y: 0, w: MODULOS[tipo].w, h: MODULOS[tipo].h, color, plegado: false, escala: 1 },
            grupo ? { grupo, delante: !!delante } : {})) }));
    }
    // El hueco que se está llenando (desde «＋ elegir ventana» o el ✎ de
    // una ventana de un hueco): lo usa «anadir».
    let huecoPendiente = null;

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
        todas = { perfiles: [{ id: "p1", nombre: ocT("principal"), modulos: todas.modulos }], activo: "p1" };
    }
    if (todas && Array.isArray(todas.perfiles) && !todas.campanas) {
        // Lo de antes de las campañas: todo en la primera.
        todas = { activa: "c1", campanas: [{ id: "c1", nombre: ocT("mi campaña"), activo: todas.activo, perfiles: todas.perfiles }] };
    }
    // La primera vez (sin nada guardado) no hay campañas: la entrada obliga
    // a crear una. Mientras, una de relleno que no se guarda.
    const sinCampanas = !todas || !Array.isArray(todas.campanas) || !todas.campanas.length;
    let sinGuardarTodavia = sinCampanas;
    if (sinCampanas) {
        todas = { activa: "c1", campanas: [{ id: "c1", nombre: ocT("mi campaña"), perfiles: perfilesDeSerie() }] };
    }
    let siguienteId = 1;
    let siguientePerfil = 1;
    let siguienteModo = 1;
    let siguienteCampana = 1;
    todas.campanas.forEach((c) => {
        c.id = c.id || "c" + siguienteCampana;
        siguienteCampana = Math.max(siguienteCampana, parseInt(String(c.id).slice(1), 10) + 1 || siguienteCampana);
        c.nombre = c.nombre || ocT("campaña");
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
        // Los modos (los de serie, la primera vez).
        if (!c.conModos) {
            c.modos = (Array.isArray(c.modos) ? c.modos : []).concat(modosDeSerie());
            c.conModos = true;
        }
        c.modos = (Array.isArray(c.modos) ? c.modos : []).filter((mo) => mo && typeof mo === "object");
        c.modos = c.modos.map((mo) => (mo.rejilla === "combate" && Array.isArray(mo.modulos)
            && mo.modulos.map((m) => m.tipo + ":" + m.hueco).join(",") === COMBATE_DE_ANTES
            ? Object.assign(modosDeSerie().find((x) => x.rejilla === "combate3"), { id: mo.id, nombre: mo.nombre, emoji: mo.emoji }) : mo));
        c.modos.forEach((mo) => {
            mo.id = /^o\d+$/.test(mo.id || "") ? mo.id : "o" + siguienteModo++;
            siguienteModo = Math.max(siguienteModo, parseInt(mo.id.slice(1), 10) + 1);
            mo.nombre = mo.nombre || "modo";
            mo.emoji = mo.emoji || "🧩";
            mo.rejilla = REJILLAS[mo.rejilla] ? mo.rejilla : "dos";
            const cuantos = REJILLAS[mo.rejilla].huecos.length;
            mo.modulos = (Array.isArray(mo.modulos) ? mo.modulos : []).filter((m) => MODULOS[m.tipo]);
            mo.modulos.forEach((m) => {
                m.color = hexDe(m.color) ? m.color : "";
                m.id = m.id || "m" + siguienteId++;
                siguienteId = Math.max(siguienteId, parseInt(String(m.id).slice(1), 10) + 1 || siguienteId);
                if (!(Number.isInteger(m.hueco) && m.hueco >= 0 && m.hueco < cuantos)) {
                    delete m.hueco;
                }
            });
        });
    });
    // Los grupos de ventanas que se hayan quedado con una sola (o sin la
    // de delante), arreglados.
    todas.campanas.forEach((c) => c.perfiles.concat(c.modos).forEach((pf) => {
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
    Object.defineProperty(PM, "todo", { configurable: true, get: () => todo, set: (v) => { todo = v; } });
    setTimeout(iniDesdeParty, 0);
    let estado = (todo.modoActivo && todo.modos.find((mo) => mo.id === todo.modoActivo))
        || todo.perfiles.find((pf) => pf.id === todo.activo) || todo.perfiles[0];
    Object.defineProperty(PM, "estado", { configurable: true, get: () => estado, set: (v) => { estado = v; } });

    // Lo que se guarda de una campaña (sin lo de la pantalla, como el
    // elemento de cada ventana). También lo usa duplicarCampana.
    const moduloGuardable = (m) => ({ id: m.id, tipo: m.tipo, x: m.x, y: m.y, w: m.w, h: m.h,
        titulo: m.titulo || "", color: m.color || "", plegado: !!m.plegado,
        escala: m.escala || 1, grupo: m.grupo || undefined, delante: m.grupo ? !!m.delante : undefined,
        hueco: Number.isInteger(m.hueco) ? m.hueco : undefined, datos: m.datos });
    const campanaGuardable = (c) => ({ id: c.id, nombre: c.nombre, activo: c.activo, modoActivo: c.modoActivo || "",
        pjs: c.pjs, docs: c.docs, musica: c.musica, inventario: c.inventario, conParty: c.conParty, conModos: c.conModos,
        unidades: c.unidades, edicion: c.edicion, jugadores: c.jugadores, linea: c.linea, relaciones: c.relaciones,
        perfiles: c.perfiles.map((pf) => ({ id: pf.id, nombre: pf.nombre, color: pf.color || "",
            colorPestana: pf.colorPestana, zoom: pf.zoom || 1, modulos: pf.modulos.map(moduloGuardable) })),
        modos: (c.modos || []).map((mo) => ({ id: mo.id, nombre: mo.nombre, emoji: mo.emoji, rejilla: mo.rejilla,
            modulos: mo.modulos.map(moduloGuardable) })) });
    function guardar() {
        if (sinGuardarTodavia) {
            return true;
        }
        if (esModo(estado)) {
            todo.modoActivo = estado.id;
        } else {
            todo.activo = estado.id;
            todo.modoActivo = "";
        }
        const salida = { activa: todo.id, campanas: todas.campanas.map(campanaGuardable) };
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
    const zoomAhora = () => (enMovil.matches || !HAY_ZOOM || esModo(estado) ? 1 : estado.zoom || 1);
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
                n.textContent = m.titulo || ocT(MODULOS[m.tipo].nombre);
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
        const et = crear("label", "oc-dados-etiqueta", ocT("título"));
        const input = crear("input", "oc-dados-texto");
        input.id = "master-personalizar-" + m.id;
        input.value = m.titulo || "";
        input.placeholder = ocT(def.nombre);
        input.maxLength = 60;
        input.autocomplete = "off";
        et.htmlFor = input.id;
        const grupo = muestrasDe("color", COLORES, m.color || "", "master-personalizar-otro-" + m.id);
        // El tamaño de lo de dentro: se ve al momento.
        const tam = crear("fieldset", "master-colores master-escala");
        tam.appendChild(crear("legend", "oc-dados-etiqueta", ocT("tamaño del contenido")));
        const valor = crear("output", "master-escala-valor", Math.round((m.escala || 1) * 100) + " %");
        const paso = (d) => {
            m.escala = (m.escala || 1) + d;
            const e = ponerEscala(m);
            valor.textContent = Math.round(e * 100) + " %";
            menos.disabled = e <= 0.6;
            mas.disabled = e >= 2;
            guardar();
            avisar(ocT("Contenido al {round} %.", { round: Math.round(e * 100) }));
        };
        const menos = botonDe("master-pestana-mando", ocT("A−"), () => paso(-0.1), ocT("Contenido más pequeño"));
        const mas = botonDe("master-pestana-mando", ocT("A+"), () => paso(0.1), ocT("Contenido más grande"));
        const igual = botonDe("oc-vida-accion", "100 %", () => paso(1 - (m.escala || 1)), ocT("Contenido a su tamaño normal"));
        menos.disabled = (m.escala || 1) <= 0.6;
        mas.disabled = (m.escala || 1) >= 2;
        tam.append(menos, valor, mas, igual);
        const listo = crear("button", "oc-vida-accion es-principal", ocT("guardar"));
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
            const con = elegirDe("master-agrupar-" + m.id, ocT("juntarla en pestañas con"), otras.map((x) => [x.id, MODULOS[x.tipo].emoji + " "
                + nombreDeVentana(x) + (x.grupo ? ocT(" (y las de su grupo)") : "")]), otras[0].id);
            const juntar = botonDe("oc-vida-accion", ocT("🗂️ agrupar"), () => {
                const d = estado.modulos.find((x) => x.id === con.elegir.value);
                cerrar();
                if (d) {
                    agrupar(m, d);
                }
            });
            pGrupo.append(con, juntar);
        } else {
            pGrupo.appendChild(crear("p", "oc-hoja-nota", ocT("No hay otras ventanas en esta pestaña.")));
        }
        if (m.grupo) {
            pGrupo.appendChild(botonDe("oc-vida-accion", ocT("⇱ sacarla del grupo"), () => {
                cerrar();
                sacarDelGrupo(m);
            }));
        }
        pGrupo.appendChild(crear("p", "oc-hoja-nota", ocT("También: mantén pulsada su barra y suéltala sobre la barra de otra.")));
        const opciones = [[ocT("📝 título"), pTitulo], [ocT("🎨 color"), pColor], [ocT("🔠 tamaño"), pTam], [ocT("🗂️ agrupar"), pGrupo]];
        // En un modo: cambiarla por otra, ponerle otra en pestaña, o
        // meterla en un hueco (las que van sueltas).
        if (esModo(estado)) {
            const pHueco = crear("div");
            const acciones = crear("div", "master-anadir-otras");
            if (Number.isInteger(m.hueco)) {
                pHueco.appendChild(crear("p", "oc-hoja-nota", ocT("Está en el hueco {n} de {n2} del modo «{nombre}».", { n: m.hueco + 1, n2: huecosDe(estado).length, nombre: estado.nombre })));
                acciones.append(botonDe("oc-vida-accion", ocT("🔁 cambiarla por otra"), () => {
                    cerrar();
                    elegirParaHueco({ hueco: m.hueco, reemplazar: m, vuelta: focoDe(m) });
                }), botonDe("oc-vida-accion", ocT("＋ otra aquí, en pestaña"), () => {
                    cerrar();
                    elegirParaHueco({ hueco: m.hueco, grupoCon: m, vuelta: focoDe(m) });
                }));
            } else {
                const libres = huecosDe(estado).map((h, i) => i).filter((i) => !estado.modulos.some((x) => x !== m && x.hueco === i));
                if (libres.length) {
                    const donde = elegirDe("master-a-hueco-" + m.id, ocT("a qué hueco"), libres.map((i) => [String(i), ocT("hueco {n}", { n: i + 1 })]),
                        String(libres[0]));
                    acciones.append(donde, botonDe("oc-vida-accion", ocT("📌 meterla en el hueco"), () => {
                        cerrar();
                        delGrupo(m).forEach((x) => {
                            x.hueco = Number(donde.elegir.value);
                            x.el = null;
                        });
                        pintarTodo();
                        guardar();
                        focoDe(m).focus();
                        avisar(ocT("{n}: en el hueco {n2}.", { n: nombreDeVentana(m), n2: m.hueco + 1 }));
                    }));
                } else {
                    pHueco.appendChild(crear("p", "oc-hoja-nota", ocT("Todos los huecos de este modo están llenos: júntala en pestañas con una de ellas (🗂️ agrupar).")));
                }
            }
            pHueco.appendChild(acciones);
            opciones.push([ocT("🧩 hueco"), pHueco]);
        }
        const { lista: pestanas, elegir } = pestanasDe(opciones, ocT("Opciones de la ventana"), "master-personalizar-" + m.id);
        cuerpo.append(pestanas, ...opciones.map((x) => x[1]), listo);
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
            avisar(ocT("Guardado."));
        });
        const cerrar = window.ocVentana.abrir({ titulo: ocT("opciones de la ventana"), cuerpo, vuelta, foco: input });
    }

    function colocar(m) {
        if (m.grupo && m.delante) {
            delGrupo(m).forEach((x) => {
                if (x !== m) {
                    Object.assign(x, { x: m.x, y: m.y, w: m.w, h: m.h });
                    if (Number.isInteger(m.hueco)) {
                        x.hueco = m.hueco;
                    } else {
                        delete x.hueco;
                    }
                }
            });
        }
        const deHueco = enHueco(m);
        m.el.classList.toggle("es-en-hueco", deHueco);
        if (enMovil.matches || deHueco) {
            m.el.style.left = "";
            m.el.style.top = "";
            m.el.style.width = "";
            m.el.style.height = "";
            if (deHueco) {
                const [col, fila, ancho, alto] = huecosDe(estado)[m.hueco];
                m.el.style.gridArea = fila + " / " + col + " / span " + alto + " / span " + ancho;
            } else {
                m.el.style.gridArea = "";
            }
            return;
        }
        m.el.style.gridArea = "";
        if (esModo(estado)) {
            // Suelta encima de un modo: que no se salga de la pantalla.
            const alto = lienzo.clientHeight || 600;
            m.y = Math.min(m.y, Math.max(0, alto - 160));
            m.h = Math.min(m.h, Math.max(160, alto - m.y - 8));
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
    Object.assign(PM, { focoDe });
    // Moverla con las flechas (con Mayús, más deprisa; con Alt, el tamaño).
    function moverConTeclas(m, e) {
        const paso = e.shiftKey ? 60 : 20;
        const d = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
        if (!d || enMovil.matches || enHueco(m)) {
            return false;
        }
        e.preventDefault();
        if (e.altKey) {
            m.w = Math.max(240, Math.min(anchoLienzo() - m.x - 4, m.w + d[0]));
            m.h = Math.max(120, m.h + d[1]);
            avisar(ocT("{w} por {h} píxeles.", { w: m.w, h: m.h }));
        } else {
            m.x = Math.min(topeX(m), Math.max(0, m.x + d[0]));
            m.y = Math.max(0, m.y + d[1]);
        }
        colocar(m);
        crecerLienzo();
        guardar();
        return true;
    }
    const nombreDeVentana = (m) => m.titulo || ocT(MODULOS[m.tipo].nombre);
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
            if (Number.isInteger(destino.hueco)) {
                x.hueco = destino.hueco;
            } else {
                delete x.hueco;
            }
            x.el = null;
        });
        pintarTodo();
        guardar();
        alFrente(m);
        m.el.querySelector(".master-grupo-pestana[aria-selected='true']").focus();
        avisar(ocT("Juntas en pestañas: {join}.", { join: juntas.map(nombreDeVentana).join(", ") }));
    }
    function sacarDelGrupo(m, sitio) {
        const resto = delGrupo(m).filter((x) => x !== m);
        delete m.grupo;
        delete m.delante;
        if (esModo(estado)) {
            delete m.hueco;
            const libre = huecoLibre();
            if (libre >= 0 && !sitio) {
                m.hueco = libre;
            } else if (!sitio) {
                m.x = 40;
                m.y = 40;
            }
        }
        if (Number.isInteger(m.hueco)) {
            // (va a un hueco libre)
        } else if (sitio) {
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
        avisar(ocT("Sacada del grupo: {nombreDeVentana}.", { nombreDeVentana: nombreDeVentana(m) }));
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
        const nombre = botonDe("master-ventana-nombre", m.titulo || ocT(def.nombre), () => {
            if (v.dataset.recienMovida) {
                delete v.dataset.recienMovida;
                return;
            }
            plegar.click();
        });
        titulo.append(em, nombre);
        nombre.title = Number.isInteger(m.hueco) && esModo(estado) ? ocT("Clic: plegar o desplegar")
            : ocT("Clic: plegar o desplegar · mantener pulsado: moverla · flechas: moverla (con Alt, el tamaño)");
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
        }, ocT("Plegar o desplegar"));
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
            avisar(ocT("Quitado: {n}.", { n: m.titulo || ocT(def.nombre) }));
            const sigue = resto[0] && resto[0].el;
            if (!sigue && esModo(estado) && Number.isInteger(m.hueco)) {
                pintarTodo();
                const vacio = lienzo.querySelector(".master-hueco[data-hueco='" + m.hueco + "'] button");
                (vacio || botonAnadir).focus();
                return;
            }
            (sigue ? focoDe(resto[0]) : botonAnadir).focus();
        }, ocT("Quitar esta ventana"));
        const cambiar = botonDe("master-ventana-mando", "✎", () => personalizar(m, cambiar),
            ocT("Opciones: título, color y tamaño del contenido"));
        cambiar.title = ocT("Título, color y tamaño del contenido");
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
            tiras.setAttribute("aria-label", ocT("Ventanas juntas"));
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
                t.title = nombreDeVentana(x) + (ahora ? ocT(" (clic: plegar; mantener y sacar: separarla)") : ocT(" (mantener y sacar: separarla)"));
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
        esquina.title = ocT("Arrastra para cambiar el tamaño");
        esquina.addEventListener("pointerdown", (e) => {
            if (enMovil.matches || m.plegado || e.button > 0 || enHueco(m)) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            alFrente(m);
            const w0 = v.offsetWidth;
            const h0 = v.offsetHeight;
            // El ancho del lienzo, una vez: medirlo en cada fotograma obliga
            // al navegador a recolocar la página antes de tiempo.
            const ancho = anchoLienzo();
            v.classList.add("es-arrastrada");
            arrastrar(e, esquina, (dx, dy) => {
                m.w = Math.max(240, Math.min(ancho - m.x - 4, Math.round(w0 + dx)));
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
            if (enMovil.matches || enHueco(m) || e.button > 0 || e.target.closest(".master-ventana-mandos, .master-grupo-pestana")) {
                return;
            }
            alFrente(m);
            const x0 = e.clientX;
            const y0 = e.clientY;
            // Con el dedo, más margen: nunca se queda del todo quieto.
            const margenQuieto = e.pointerType === "touch" ? 14 : 8;
            const quieto = (ev) => {
                if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > margenQuieto) {
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
                // Con el dedo, un toque de vibración: ya se puede arrastrar.
                if (e.pointerType === "touch" && navigator.vibrate) {
                    navigator.vibrate(20);
                }
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
                // Mientras se mueve, con «transform»: no recoloca la página
                // (va fluido también en tabletas modestas); al soltar, a su
                // sitio de verdad. Qué ventana hay debajo, como mucho diez
                // veces por segundo.
                let mirado = 0;
                const tope = topeX(m);
                arrastrar(e, cabeza, (dx, dy, ev) => {
                    m.x = Math.min(tope, Math.max(0, mx + dx));
                    m.y = Math.max(0, my + dy);
                    v.style.transform = "translate(" + (m.x - mx) + "px, " + (m.y - my) + "px)";
                    const ahora = performance.now();
                    if (ahora - mirado < 100) {
                        return;
                    }
                    mirado = ahora;
                    const d = ventanaBajo(ev.clientX, ev.clientY, v);
                    if (d !== destino && !(d && m.grupo && d.grupo === m.grupo)) {
                        marcar(d);
                    }
                }, (ev) => {
                    v.style.transform = "";
                    colocar(m);
                    // Lo de debajo, mirado otra vez justo donde se suelta.
                    const d = ev ? ventanaBajo(ev.clientX, ev.clientY, v) : null;
                    if (d !== destino && !(d && m.grupo && d.grupo === m.grupo)) {
                        marcar(d);
                    }
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
        // Un modo, de alto lo que queda de pantalla debajo de la barra.
        if (esModo(estado)) {
            const arriba = lienzo.getBoundingClientRect().top + window.scrollY;
            // Con el menú de los modos en su sitio (abajo), le deja hueco
            // debajo para que no tape nada.
            const menu = menuModos.isConnected && !menuModos.classList.contains("es-movido") ? menuModos.offsetHeight + 22 : 0;
            lienzo.style.height = Math.max(420, Math.round(window.innerHeight - arriba - 14 - menu)) + "px";
            return;
        }
        const fondo = Math.max(480, ...estado.modulos.map((m) => m.y + (m.plegado ? 60 : m.h) + 240));
        const ahora = parseInt(lienzo.style.height, 10) || 0;
        if (!soloCrecer) {
            lienzo.style.height = fondo + "px";
        } else if (fondo > ahora) {
            // Mientras se arrastra, a saltos: cambiar el alto recoloca todo
            // el tablero, y hacerlo en cada fotograma da tirones.
            lienzo.style.height = fondo + 400 + "px";
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
        const modo = esModo(estado);
        lienzo.classList.toggle("es-modo", modo);
        lienzo.classList.toggle("con-lienzo", !modo);
        if (modo) {
            pintarModoAhora();
            return;
        }
        // En el móvil, en orden de lectura (de arriba abajo y de izquierda
        // a derecha); en el ordenador, también (así el tabulador va igual).
        const orden = estado.modulos.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
        lienzo.replaceChildren(...orden.map((m) => m.el || ventanaDe(m)));
        orden.forEach(colocar);
        crecerLienzo();
    }
    // UN MODO: su rejilla, con las ventanas de sus huecos (en el orden de
    // lectura de la rejilla), los huecos vacíos («＋ elegir ventana») y,
    // encima, las que vayan sueltas.
    const huecosDe = (mo) => REJILLAS[mo.rejilla].huecos;
    const enHueco = (m) => esModo(estado) && Number.isInteger(m.hueco);
    function huecoLibre() {
        return huecosDe(estado).findIndex((h, i) => !estado.modulos.some((m) => m.hueco === i));
    }
    function pintarModoAhora() {
        const huecos = huecosDe(estado);
        estado.modulos.forEach((m) => {
            if (Number.isInteger(m.hueco) && m.hueco >= huecos.length) {
                delete m.hueco;
            }
        });
        const filas = [];
        huecos.forEach(([col, fila], i) => {
            const de = estado.modulos.filter((m) => m.hueco === i);
            if (de.length) {
                de.forEach((m) => filas.push([fila, col, m.el || ventanaDe(m)]));
            } else {
                filas.push([fila, col, huecoVacio(i)]);
            }
        });
        filas.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
        const sueltas = estado.modulos.filter((m) => !Number.isInteger(m.hueco)).sort((a, b) => (a.y - b.y) || (a.x - b.x));
        lienzo.replaceChildren(...filas.map((x) => x[2]), ...sueltas.map((m) => m.el || ventanaDe(m)));
        estado.modulos.forEach(colocar);
        crecerLienzo();
    }
    function huecoVacio(i) {
        const caja = crear("div", "master-hueco");
        caja.dataset.hueco = String(i);
        const [col, fila, ancho, alto] = huecosDe(estado)[i];
        caja.style.gridArea = fila + " / " + col + " / span " + alto + " / span " + ancho;
        const b = botonDe("oc-vida-accion", ocT("＋ elegir ventana"), () => elegirParaHueco({ hueco: i, vuelta: b }),
            ocT("Hueco {n} de {n2}, vacío: elegir qué ventana va aquí", { n: i + 1, n2: huecosDe(estado).length }));
        b.setAttribute("aria-haspopup", "dialog");
        caja.appendChild(b);
        return caja;
    }
    // Abrir 🧰 para llenar un hueco (o cambiar la ventana de uno, o
    // ponerle otra en pestaña).
    function elegirParaHueco(destino) {
        huecoPendiente = destino;
        botonAnadir.click();
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
    document.addEventListener("oc:reglas", () => {
        indice = null;
    });

    function cargarIndice() {
        if (!indice) {
            indice = Promise.all([pedir(CONJUROS_SRD), pedir("datos/personajes/compendio/bestiario.json"),
                pedir(REGLAS), pedir("datos/personajes/compendio/tienda.json"),
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
                        detalle: datosRasgo(r).join(" · ") + (r.propio ? ocT(" · 🛠️ tuyo") : ""), buscar: llano(r.nombre + " " + r.en),
                        abrir: (v) => abrirRasgo(r, v, ras.fuente) }));
                    (conj.conjuros || []).forEach((c) => cosas.push({ tipo: "conjuro", emoji: "✨", nombre: c.nombre,
                        detalle: nivelDe(c) + " · " + verDato(c.escuela) + (c.propio ? ocT(" · 🛠️ tuyo") : ""), buscar: llano(c.nombre + " " + c.en),
                        abrir: (v) => abrirConjuro(c, v, conj.fuente) }));
                    (best.monstruos || []).forEach((b) => cosas.push({ tipo: "monstruo", emoji: tokenDe(b).textContent, nombre: b.nombre,
                        detalle: ocT("VD {cr} · {tipo}{n}", { cr: b.cr, tipo: verDato(b.tipo), n: b.propio ? ocT(" · 🛠️ tuyo") : "" }), buscar: llano(b.nombre + " " + b.en),
                        abrir: (v) => abrirBicho(b, v, best.fuente) }));
                    (reg.reglas || []).forEach((r) => cosas.push({ tipo: "regla", emoji: r.icono || "📚", nombre: r.nombre,
                        detalle: ocT("Regla · {grupo}", { grupo: r.grupo }), buscar: llano(r.nombre + " " + (r.alias || "")),
                        abrir: (v) => abrirRegla(r, v, fuenteDeRegla(r, reg.fuente)) }));
                    (tienda.objetos || []).forEach((o) => cosas.push({ tipo: "objeto", emoji: "💰", nombre: o.nombre,
                        detalle: ocT("Objeto · {cat}{n}{n2}", { cat: verDato(o.cat), n: o.rareza ? " · " + verDato(o.rareza) : "", n2: o.propio ? ocT(" · 🛠️ tuyo") : "" }), buscar: llano(o.nombre + " " + o.en),
                        abrir: (v) => abrirObjeto(o, v, tienda.fuente) }));
                    return cosas.concat(deRasgos);
                });
        }
        return indice;
    }

    function montarBuscador() {
        const caja = crear("div", "master-buscador");
        caja.setAttribute("role", "search");
        const et = crear("label", "visually-hidden", ocT("Buscar conjuros, monstruos, reglas, objetos, rasgos o dotes"));
        const input = crear("input", "master-buscador-texto");
        input.type = "search";
        input.id = "master-buscador";
        input.placeholder = ocT("buscar: bola de fuego, goblin, derribado…");
        input.autocomplete = "off";
        input.setAttribute("role", "combobox");
        input.setAttribute("aria-autocomplete", "list");
        input.setAttribute("aria-expanded", "false");
        input.setAttribute("aria-controls", "master-buscador-lista");
        et.htmlFor = input.id;
        const lista = crear("ul", "master-buscador-lista");
        lista.id = "master-buscador-lista";
        lista.setAttribute("role", "listbox");
        lista.setAttribute("aria-label", ocT("Resultados"));
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
                    detalle: ocT("Regla propia"), buscar: llano(r.nombre),
                    abrir: (v) => abrirRegla(Object.assign({ propia: true, grupo: ocT("🏠 Reglas propias") }, r), v) }));
                const otras = leerPropios().otros.map((x) => ({ tipo: "otro", emoji: "📜", nombre: x.nombre,
                    detalle: ocT("{cat} · 🛠️ tuyo", { cat: verDato(x.cat) }), buscar: llano(x.nombre + " " + x.cat), abrir: (v) => abrirOtro(x, v) }));
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
                    const li = crear("li", "master-buscador-nada", ocT("Nada con eso."));
                    lista.appendChild(li);
                }
                lista.hidden = false;
                input.setAttribute("aria-expanded", "true");
                activo = -1;
                cuantos.textContent = salen.length ? ocT("{n}; con las flechas se elige", { n: salen.length + (salen.length === 1 ? ocT(" resultado") : ocT(" resultados")) }) : ocT("Nada con eso.");
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
    const botonAnadir = botonDe("oc-vida-accion es-principal", ocT("＋ añadir"), () => {
        const cuerpo = crear("div", "master-anadir");
        // Un filtro arriba y las ventanas por grupos, como tarjetas con su
        // dibujo, su nombre y para qué son.
        const etFiltro = crear("label", "oc-dados-etiqueta", ocT("filtrar"));
        const filtro = crear("input", "oc-dados-texto");
        filtro.type = "search";
        filtro.id = "master-anadir-filtro";
        filtro.placeholder = ocT("dados, monstruos, nombres…");
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
                const nombre = crear("span", "master-anadir-nombre", ocT(def.nombre));
                const desc = crear("span", "master-anadir-desc", ya ? ocT("Ya está en el tablero.") : def.desc);
                b.append(em, nombre, desc);
                b.disabled = ya;
                li.appendChild(b);
                lista.appendChild(li);
                tarjetas.push({ li, seccion, b, nombre: llano(ocT(def.nombre)), texto: llano(def.nombre + " " + ocT(def.nombre) + " " + def.desc + " " + titulo) });
            });
            seccion.appendChild(lista);
            return [titulo, seccion];
        });
        const { lista: pestanasAnadir, elegir: elegirAnadir } = pestanasDe(paneles, ocT("Grupos de ventanas"), "master-anadir",
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
            cuantas.textContent = q ? (n ? n + (n === 1 ? ocT(" ventana") : ocT(" ventanas")) : ocT("Ninguna con eso.")) : "";
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
        // Para un hueco de un modo: lo dice el título; si se cierra sin
        // elegir, el hueco se olvida (después de «anadir», que va antes).
        const paraHueco = huecoPendiente && esModo(estado);
        const cerrar = window.ocVentana.abrir({ titulo: paraHueco ? ocT("elegir la ventana del hueco {n} ({nombre})", { n: huecoPendiente.hueco + 1, nombre: estado.nombre }) : ocT("añadir una ventana"), cuerpo, vuelta: (paraHueco && huecoPendiente.vuelta) || botonAnadir,
        foco: filtro, clase: "es-ancha", alCerrar: () => setTimeout(() => {
            huecoPendiente = null;
        }, 0) });
    });
    botonAnadir.setAttribute("aria-haspopup", "dialog");

    // ---- EXPORTAR E IMPORTAR: todo lo de la pantalla de máster (los
    // perfiles con sus ventanas, la iniciativa, las marcas propias y las
    // tiradas guardadas) a un archivo .json, y de vuelta. Para guardarlo,
    // pasarlo a otro navegador o compartir un tablero montado. ----
    const CLAVES = (k) => k === CLAVE || k === CLAVE_HOMEBREW || k === CLAVE_IMAGENES || k === CLAVE_PLANTILLAS || k === CLAVE_PROPIOS || k === CLAVE_ASPECTOS || k === CLAVE_TABLAS || k === CLAVE_NOMBRES || k === window.ocReglas.CLAVE || k === CLAVE_ENCENDIDA || k === CLAVE_COPIA || k === "richi-master-modos-sitio" || k === "richi-master-carpeta-no" || k === "richi-master-aviso-srd" || k === "richi-idioma" || k === "richi-idioma-prueba" || /^richi-oc-(iniciativa|marcas|partida-pantalla-master)/.test(k);

    // UNA COPIA DE SEGURIDAD: lo guardado (las claves de CLAVES) y, si se
    // pide, los archivos (imágenes, PDF, música) en «data:». La usan
    // exportar, la copia automática de la app de Android (sin archivos: ya
    // están en la carpeta) y «Abrir con» (importarla).
    function datosDeCopia(conArchivos) {
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
            return Promise.reject(new Error(ocT("sin almacenamiento")));
        }
        const datos = { pantallaDeMaster: 1, fecha: new Date().toISOString(), claves };
        if (!conArchivos) {
            return Promise.resolve(datos);
        }
        return todosLosArchivos().catch(() => []).then((lista) => Promise.all(lista.filter(([, b]) => b)
            .map(([id, b]) => blobADatos(b).then((x) => [id, x])))).then((lista) => {
            if (lista.length) {
                datos.archivos = {};
                lista.forEach(([id, x]) => {
                    datos.archivos[id] = x;
                });
            }
            return datos;
        });
    }
    const esCopia = (datos) => !!datos && datos.pantallaDeMaster === 1 && !!datos.claves && typeof datos.claves === "object";
    // Importarla: reemplaza lo de ahora y recarga.
    function importarCopia(datos) {
        Object.keys(datos.claves).filter(CLAVES).forEach((k) => {
            localStorage.setItem(k, String(datos.claves[k]));
        });
        const archivos = datos.archivos && typeof datos.archivos === "object" ? Object.keys(datos.archivos) : [];
        return Promise.all(archivos.map((id) => {
            const blob = /^a[a-z0-9]+$/.test(id) ? datosABlob(datos.archivos[id]) : null;
            return blob ? archivoGuardar(id, blob).catch(() => {}) : null;
        })).then(() => (window.ocAlmacen ? window.ocAlmacen.guardarYa() : null)).then(() => {
            location.reload();
        });
    }
    // Cuándo se hizo la última copia (exportar, o la automática), para
    // recordarlo en la app de Android cuando se guarda dentro de ella.
    const CLAVE_COPIA = "richi-master-copia";
    function marcarCopia() {
        try {
            const c = JSON.parse(localStorage.getItem(CLAVE_COPIA) || "{}");
            c.ultima = Date.now();
            localStorage.setItem(CLAVE_COPIA, JSON.stringify(c));
        } catch (e) {
            // Sin guardar: se recordará otra vez.
        }
    }

    // ---- LA CARPETA ORDENADA: cuando se guarda en una carpeta (el programa
    // del ordenador o la app de Android), además de almacen.json y
    // «archivos» (lo que lee la app, con números), «ordenado»: lo mismo con
    // sus nombres, para mirarlo o llevárselo (cada campaña con sus tableros,
    // modos, personajes, documentos y música; el compendio por tipos y
    // categorías; las reglas propias; las traducciones…). La app no lo lee:
    // cambiar algo ahí no cambia la app. Se rehace cada poco, sólo lo que
    // cambia; lo que ya hay se apunta en CLAVE_ORDENADO ({ruta: huella}:
    // no va en CLAVES, porque dice qué hay en esta carpeta, no es de la
    // partida). ----
    const CLAVE_ORDENADO = "richi-master-ordenado";
    const ORDENADO = EN_CARPETA && window.ocAlmacen.ordenado ? window.ocAlmacen.ordenado : null;
    // Un nombre que valga para un archivo en cualquier sistema.
    function nombreOrdenado(t) {
        let n = String(t || "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80)
            .replace(/[. ]+$/, "");
        if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(n)) {
            n += "_";
        }
        return n || ocT("sin nombre");
    }
    const EXTENSIONES = { "image/jpeg": "jpg", "image/svg+xml": "svg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a",
        "audio/x-wav": "wav", "audio/wave": "wav", "application/pdf": "pdf", "text/plain": "txt", "text/markdown": "md" };
    const extensionDe = (tipo) => EXTENSIONES[tipo] || ((/^[a-z]+\/([a-z0-9]{2,5})$/.exec(tipo || "") || [])[1]) || "bin";
    // La huella de un texto (para saber si ha cambiado).
    function huella(t) {
        let h = 0x811c9dc5;
        for (let i = 0; i < t.length; i++) {
            h ^= t.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return (h >>> 0).toString(36) + "-" + t.length;
    }
    // Todo lo que va en «ordenado»: Map(ruta → {texto} o {archivo: id}).
    function contenidoOrdenado(archivos, traducciones) {
        const sale = new Map();
        const nombres = new Map();
        const tipos = new Map(archivos.map((a) => [a.id, a.tipo || ""]));
        const colocados = new Set();
        // Uno en su carpeta, con su nombre (y «(2)» si se repite).
        const poner = (dir, nombre, ext, valor) => {
            const base = nombreOrdenado(nombre);
            const ya = nombres.get(dir) || new Set();
            nombres.set(dir, ya);
            let n = base + (ext ? "." + ext : "");
            for (let i = 2; ya.has(n.toLowerCase()); i++) {
                n = base + " (" + i + ")" + (ext ? "." + ext : "");
            }
            ya.add(n.toLowerCase());
            sale.set((dir ? dir + "/" : "") + n, valor);
            return n;
        };
        const json = (x) => ({ texto: JSON.stringify(x, null, 2) + "\n" });
        const archivo = (dir, nombre, id) => {
            if (!tipos.has(id)) {
                return;
            }
            colocados.add(id);
            poner(dir, nombre, extensionDe(tipos.get(id)), { archivo: id });
        };
        // Las carpetas de los documentos y de la música: «Una/Otra».
        const rutaCarpeta = (carpetas, id) => {
            const trozos = [];
            let c = carpetas.find((x) => x.id === id);
            for (let i = 0; c && i < 20; i++) {
                trozos.unshift(nombreOrdenado(c.nombre));
                c = carpetas.find((x) => x.id === c.padre);
            }
            return trozos.join("/");
        };
        const leer = (k) => {
            try {
                return JSON.parse(localStorage.getItem(k) || "null");
            } catch (e) {
                return null;
            }
        };
        poner("", ocT("LEEME"), "txt", { texto: ocT("Esta carpeta es una copia de lo de la pantalla de máster con sus nombres, para mirarlo o llevártelo: cada campaña con sus tableros, modos, personajes, documentos y música; tu compendio por tipos y categorías; tus reglas propias y las traducciones.\n\nLa app no la lee: lo que cambies aquí no cambia en la app (lo que usa está en almacen.json y en la carpeta «archivos»). Se rehace sola cada poco.\n") + "\n" });
        // CADA CAMPAÑA.
        const todas2 = leer(CLAVE) || { campanas: [] };
        const dirCampana = ocT("campañas");
        (todas2.campanas || []).forEach((c) => {
            const dir = dirCampana + "/" + poner(dirCampana, c.nombre || ocT("campaña"), "", null);
            sale.delete(dir);
            const resto = Object.assign({}, c);
            ["perfiles", "modos", "pjs", "docs", "musica"].forEach((k) => delete resto[k]);
            poner(dir, ocT("campaña"), "json", json(resto));
            (c.perfiles || []).forEach((pf) => poner(dir + "/" + ocT("tableros"), pf.nombre, "json", json(pf)));
            (c.modos || []).forEach((mo) => poner(dir + "/" + ocT("modos"), ((mo.emoji || "") + " " + (mo.nombre || "")).trim(), "json", json(mo)));
            (c.pjs || []).forEach((pj) => {
                const n = poner(dir + "/" + ocT("personajes"), pj.nombre || ocT("personaje"), "json", json(pj)).replace(/\.json$/, "");
                (pj.imagenes || []).forEach((im) => archivo(dir + "/" + ocT("personajes") + "/" + n, im.titulo || ocT("imagen"), im.archivo));
            });
            const docs = c.docs || {};
            (docs.notas || []).forEach((nota) => {
                const d = dir + "/" + ocT("documentos") + (nota.carpeta ? "/" + rutaCarpeta(docs.carpetas || [], nota.carpeta) : "");
                if (nota.archivo) {
                    archivo(d, nota.titulo, nota.archivo);
                } else {
                    const t = String(nota.titulo || "").replace(/[<&]/g, (x) => (x === "<" ? "&lt;" : "&amp;"));
                    poner(d, nota.titulo, "html", { texto: "<!doctype html>\n<meta charset=\"utf-8\">\n<title>" + t + "</title>\n<h1>" + t
                        + "</h1>\n" + (nota.html || "") + "\n" });
                }
            });
            const mu = c.musica || {};
            (mu.canciones || []).forEach((cn) => archivo(dir + "/" + ocT("música") + (cn.carpeta ? "/" + rutaCarpeta(mu.carpetas || [], cn.carpeta) : ""),
                cn.nombre, cn.archivo));
        });
        // EL COMPENDIO: lo tuyo, por tipos y categorías (y tus cambios del
        // SRD aparte).
        const propios = leer(CLAVE_PROPIOS) || {};
        const TIPOS_ORDENADO = { monstruos: ocT("monstruos"), objetos: ocT("objetos"), conjuros: ocT("conjuros"), rasgos: ocT("rasgos y dotes"),
            otros: ocT("más cosas") };
        Object.keys(TIPOS_ORDENADO).forEach((k) => {
            const dir = ocT("compendio") + "/" + TIPOS_ORDENADO[k];
            (Array.isArray(propios[k]) ? propios[k] : []).forEach((x) => {
                const cat = x.cambia ? ocT("✎ cambiados del SRD") : (x.libro || "").trim() || ocT("sin categoría");
                poner(dir + "/" + nombreOrdenado(cat), x.nombre, "json", json(x));
            });
            const ocultos = propios.ocultos && Array.isArray(propios.ocultos[k]) ? propios.ocultos[k] : [];
            if (ocultos.length) {
                poner(dir, ocT("borrados del SRD"), "json", json(ocultos));
            }
        });
        // LAS REGLAS PROPIAS, en texto.
        (leer(CLAVE_HOMEBREW) || []).forEach((r) => {
            if (r && r.nombre) {
                poner(ocT("reglas propias"), ((r.icono || "") + " " + r.nombre).trim(), "md", { texto: "# " + r.nombre + "\n\n" + (r.texto || "") + "\n" });
            }
        });
        // LO DEMÁS que se guarda (las imágenes de los monstruos, las tablas,
        // la iniciativa…), tal cual, y sus archivos con su nombre.
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (CLAVES(k) && ![CLAVE, CLAVE_PROPIOS, CLAVE_HOMEBREW].includes(k)) {
                    const v = localStorage.getItem(k);
                    let x = v;
                    try {
                        x = JSON.parse(v);
                    } catch (e) {
                        x = v;
                    }
                    poner(ocT("otros"), k.replace(/^richi-(master-)?/, ""), "json", json(x));
                }
            }
        } catch (e) {
            // Sin poder leerlo: lo demás.
        }
        const imagenes = leer(CLAVE_IMAGENES) || {};
        Object.keys(imagenes).forEach((clave) => {
            const v = String(imagenes[clave] || "");
            if (v.indexOf("archivo:") === 0 && !colocados.has(v.slice(8))) {
                archivo(ocT("imágenes"), clave, v.slice(8));
            }
        });
        // Los archivos que quedan (los sonidos propios, retratos…): con el
        // nombre con el que se apuntaron, si se sabe.
        const nombreDe = new Map();
        const buscar = (x, n) => {
            if (n > 12 || !x || typeof x !== "object") {
                return;
            }
            if (typeof x.archivo === "string" && (x.titulo || x.nombre)) {
                nombreDe.set(x.archivo, x.titulo || x.nombre);
            }
            Object.keys(x).forEach((k) => buscar(x[k], n + 1));
        };
        buscar(todas2, 0);
        archivos.filter((a) => !colocados.has(a.id)).forEach((a) => archivo(ocT("archivos"), nombreDe.get(a.id) || a.id, a.id));
        // LAS TRADUCCIONES (para quien quiera ayudar: ver Aa → idioma).
        if (traducciones) {
            traducciones.forEach(([codigo, texto]) => poner(ocT("traducciones"), codigo, "json", { texto }));
            poner(ocT("traducciones"), ocT("LEEME"), "txt", { texto: ocT("Las traducciones de la app: un archivo por idioma (es.json es el original, en castellano). A la izquierda, el texto en castellano; a la derecha, su traducción (lo vacío aún no está traducido). Lo de entre llaves, {nombre} o {n}, se deja igual.\n\nPara probar la tuya: Aa → idioma → «probar un archivo de traducción». Para mandarla: a contacto@richi.blog o con un pull request en GitHub (rperezbarreda/pantalla_master, carpeta «traducciones»). ¡Gracias!\n") + "\n" });
        }
        return sale;
    }
    // Rehacer lo que haya cambiado (y quitar lo que ya no está).
    // «traducciones»: sólo la primera vez de cada sesión (son grandes).
    let ordenadoAntes = "";
    let ordenadoTraducciones = false;
    let ordenando = null;
    function ordenarCarpeta(forzar) {
        if (!ORDENADO || ordenando) {
            return ordenando || Promise.resolve();
        }
        // Si no ha cambiado nada guardado, nada.
        let ahora = "";
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (CLAVES(k)) {
                    ahora += k + "\u0000" + huella(localStorage.getItem(k) || "") + "\u0000";
                }
            }
        } catch (e) {
            return Promise.resolve();
        }
        if (!forzar && ahora === ordenadoAntes && ordenadoTraducciones) {
            return Promise.resolve();
        }
        const conTraducciones = !ordenadoTraducciones || forzar;
        const traducciones = conTraducciones ? fetch("idiomas/lista.json").then((r) => r.json())
            .then((lista) => Promise.all(lista.map((x) => fetch("traducciones/" + x.codigo + ".json").then((r) => (r.ok ? r.text() : null))
                .then((t) => [x.codigo, t]).catch(() => [x.codigo, null]))))
            .then((l) => l.filter(([, t]) => t)).catch(() => null) : Promise.resolve(null);
        ordenando = Promise.all([fetch("__archivos", { cache: "no-store" }).then((r) => r.json()).catch(() => []), traducciones])
            .then(([archivos, trad]) => {
                const sale = contenidoOrdenado(Array.isArray(archivos) ? archivos : [], trad);
                let indice = {};
                try {
                    indice = forzar ? {} : JSON.parse(localStorage.getItem(CLAVE_ORDENADO) || "{}") || {};
                } catch (e) {
                    indice = {};
                }
                const dirTrad = ocT("traducciones") + "/";
                const cola = [];
                sale.forEach((v, ruta) => {
                    const h = v.archivo ? "a:" + v.archivo : huella(v.texto);
                    if (indice[ruta] !== h) {
                        cola.push(() => (v.archivo ? ORDENADO.copiar(ruta, v.archivo) : ORDENADO.escribir(ruta, v.texto)));
                        indice[ruta] = h;
                    }
                });
                Object.keys(indice).forEach((ruta) => {
                    // Lo de antes que ya no está (las traducciones, si esta
                    // vez no se han mirado, se quedan).
                    if (!sale.has(ruta) && !(!trad && ruta.indexOf(dirTrad) === 0)) {
                        cola.push(() => ORDENADO.borrar(ruta));
                        delete indice[ruta];
                    }
                });
                if (trad) {
                    ordenadoTraducciones = true;
                }
                ordenadoAntes = ahora;
                return cola.reduce((p, f) => p.then(f).catch(() => {}), Promise.resolve()).then(() => {
                    try {
                        localStorage.setItem(CLAVE_ORDENADO, JSON.stringify(indice));
                    } catch (e) {
                        // Sin guardar: la próxima vez se mira todo.
                    }
                    return cola.length;
                });
            }).finally(() => {
                ordenando = null;
            });
        return ordenando;
    }
    if (ORDENADO) {
        setTimeout(ordenarCarpeta, 4000);
        setInterval(ordenarCarpeta, 20000);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                ordenarCarpeta();
            }
        });
    }

    function copias(alTerminar) {
        const caja = crear("div", "master-anadir-otras");
        const exportar = botonDe("oc-vida-accion", ocT("⬇ exportar"), () => {
            datosDeCopia(true).catch(() => {
                avisar(ocT("Este navegador no deja leer lo guardado."));
                return null;
            }).then((datos) => {
                if (!datos) {
                    return;
                }
                const lista = Object.keys(datos.archivos || {});
                marcarCopia();
                const a = crear("a");
                // Una dirección blob: que hace el propio navegador con el archivo.
                const archivoBlob = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 1)], { type: "application/json" }));
                a.href = archivoBlob;
                a.download = "pantalla-de-master-" + new Date().toISOString().slice(0, 10) + ".json";
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(archivoBlob), 1000);
                avisar(ocT("Exportado: {download}{n}", { download: a.download, n: lista.length ? ocT(" (con {n} archivos).", { n: lista.length }) : "." }));
            });
        }, ocT("Exportar todo a un archivo"));
        exportar.title = ocT("Guarda los perfiles, sus ventanas y la iniciativa en un archivo .json");
        const archivo = crear("input");
        archivo.type = "file";
        archivo.accept = ".json,application/json";
        archivo.hidden = true;
        let seguro = false;
        const importar = botonDe("oc-vida-accion", ocT("⬆ importar"), () => {
            if (!seguro) {
                seguro = true;
                importar.textContent = ocT("⬆ ¿reemplazar todo? pulsa otra vez");
                return;
            }
            archivo.click();
        }, ocT("Importar desde un archivo (reemplaza lo de ahora)"));
        importar.title = ocT("Carga un archivo exportado; reemplaza lo que hay ahora");
        archivo.addEventListener("change", () => {
            const f = archivo.files && archivo.files[0];
            if (!f) {
                return;
            }
            f.text().then((texto) => {
                const datos = JSON.parse(texto);
                if (!esCopia(datos)) {
                    throw new Error(ocT("no es"));
                }
                alTerminar();
                return importarCopia(datos);
            }).catch(() => {
                avisar(ocT("Ese archivo no es una exportación de la pantalla de máster."));
                importar.textContent = ocT("⬆ importar");
                seguro = false;
            });
        });
        caja.append(exportar, importar, archivo);
        return caja;
    }

    // ABRIR CON LA APP (Android: «Compartir» o «Abrir con» desde otra app;
    // los pasa android.js). Una copia de seguridad se importa (preguntando
    // antes: lo reemplaza todo), las imágenes y los PDF van a los
    // documentos (arriba del todo) y los audios a la música (a la carpeta
    // «recibidas»).
    function recibirArchivos(archivos) {
        const lista = Array.from(archivos || []);
        const json = lista.filter((f) => /json|text\/plain/.test(f.type) || /\.json$/i.test(f.name));
        const docs = lista.filter((f) => /^image\/|^application\/pdf$/.test(f.type) && f.size <= MAX_ARCHIVO);
        const audios = lista.filter((f) => /^audio\//.test(f.type) && f.size <= MAX_ARCHIVO);
        const fuera = lista.length - json.length - docs.length - audios.length;
        const hechos = { docs: [], audios: [] };
        const docsListos = Promise.all(docs.map((f) => {
            const id = idDoc("a");
            return archivoGuardar(id, f).then(() => {
                docsDe().notas.push({ id: idDoc("n"), tipo: "archivo", titulo: f.name.replace(/\.[^.]+$/, "") || f.name, carpeta: "",
                    archivo: id, mime: f.type, tamano: f.size, cambiada: Date.now() });
                hechos.docs.push(f.name);
            }).catch(() => {});
        }));
        const audiosListos = Promise.all(audios.map((f) => {
            const mu = musicaDe();
            let carpeta = mu.carpetas.find((c) => c.nombre === "recibidas" && !c.padre);
            if (!carpeta) {
                carpeta = { id: idDoc("m"), nombre: "recibidas", padre: "" };
                mu.carpetas.push(carpeta);
            }
            const id = idDoc("a");
            return archivoGuardar(id, f).then(() => {
                mu.canciones.push({ id, archivo: id, nombre: f.name.replace(/\.[^.]+$/, "").slice(0, 80) || ocT("canción"),
                    carpeta: carpeta.id });
                hechos.audios.push(f.name);
            }).catch(() => {});
        }));
        Promise.all([docsListos, audiosListos]).then(() => {
            if (docs.length || audios.length) {
                guardar();
                avisarDocs();
                document.dispatchEvent(new CustomEvent("master:musica"));
            }
            const partes = [];
            const donde = [];
            if (hechos.docs.length) {
                donde.push(ocT("{join} en 📂 documentos", { join: hechos.docs.join(", ") }));
            }
            if (hechos.audios.length) {
                donde.push(ocT("{join} en 🎵 música (carpeta «recibidas»)", { join: hechos.audios.join(", ") }));
            }
            if (donde.length) {
                partes.push(ocT("Recibido: {join}.", { join: donde.join("; ") }));
            }
            if (fuera > 0) {
                partes.push(ocT("Sólo valen imágenes, PDF y audios de hasta 50 MB, y copias de seguridad."));
            }
            if (partes.length) {
                avisar(partes.join(" "));
            }
        });
        json.slice(0, 1).forEach((f) => f.text().then((texto) => {
            const datos = JSON.parse(texto);
            if (!esCopia(datos)) {
                throw new Error(ocT("no es"));
            }
            const cuerpo = crear("div", "master-anadir-otras");
            const fecha = new Date(datos.fecha);
            const texto2 = crear("p", "oc-hoja-nota", ocT("«{name}» es una copia de seguridad{n}. Importarla reemplaza todo lo que hay ahora (haz antes una copia si no quieres perderlo).", { name: f.name, n: isNaN(fecha) ? "" : ocT(" del {toLocaleDateString}", { toLocaleDateString: fecha.toLocaleDateString(window.ocLocale, { day: "numeric", month: "long", year: "numeric" }) }) }));
            const vuelta = document.activeElement;
            let cerrar = () => {};
            const si = botonDe("oc-vida-accion", ocT("⬆ importar (reemplaza todo)"), () => {
                si.disabled = true;
                importarCopia(datos).catch(() => avisar(ocT("No se ha podido importar.")));
            });
            const no = botonDe("oc-vida-accion", ocT("cancelar"), () => cerrar());
            cuerpo.append(texto2, si, no);
            // Con la entrada abierta (al abrir la app), la pregunta va dentro
            // de ella, arriba; si no, en una ventanita.
            // (al final, donde la entrada ya ofrece importar copias).
            const entrada = document.querySelector(".master-entrada-caja");
            if (entrada) {
                const caja = crear("div", "master-entrada-traer");
                caja.setAttribute("role", "group");
                caja.setAttribute("aria-label", ocT("Importar una copia de seguridad"));
                const botones = crear("div", "master-anadir-otras");
                botones.append(si, no);
                caja.append(texto2, botones);
                entrada.insertBefore(caja, entrada.querySelector(".master-entrada-privado"));
                cerrar = () => {
                    caja.remove();
                    if (vuelta && vuelta.isConnected) {
                        vuelta.focus();
                    }
                };
                si.focus();
                return;
            }
            cerrar = window.ocVentana.abrir({ titulo: ocT("importar una copia de seguridad"), cuerpo, vuelta, foco: si });
        }).catch(() => avisar(ocT("«{name}» no es una copia de seguridad de la pantalla de máster. Si es un personaje de D&D Beyond, tráelo desde la party con «📄 desde un archivo».", { name: f.name }))));
    }

    function anadir(tipo, extra) {
        const def = MODULOS[tipo];
        const w = (extra && extra.w) || def.w;
        const h = (extra && extra.h) || def.h;
        // En un modo: al hueco que se está llenando, o al primero libre; si
        // no hay, suelta encima.
        const destino = huecoPendiente;
        huecoPendiente = null;
        let enEl = null;
        if (esModo(estado)) {
            if (destino && destino.reemplazar) {
                const viejo = destino.reemplazar;
                const resto = delGrupo(viejo).filter((x) => x !== viejo);
                estado.modulos = estado.modulos.filter((x) => x !== viejo);
                if (resto.length) {
                    enEl = { grupo: viejo.grupo, delante: !!viejo.delante, deGrupo: resto[0] };
                }
            }
            enEl = enEl || {};
            enEl.hueco = destino ? destino.hueco : huecoLibre();
        }
        const sueltas = estado.modulos.filter((x) => !Number.isInteger(x.hueco)).length;
        const sitio = enMovil.matches ? { x: 0, y: 0 } : esModo(estado) ? { x: 30 + 30 * (sueltas % 5), y: 30 + 30 * (sueltas % 5) }
            : hueco(w, h);
        const m = Object.assign({ id: "m" + siguienteId++, tipo, x: sitio.x, y: sitio.y, w, h }, extra || {});
        if (enEl && enEl.hueco >= 0) {
            m.hueco = enEl.hueco;
            if (enEl.grupo) {
                // Cambiada dentro de un grupo: ocupa su sitio en él.
                m.grupo = enEl.grupo;
                m.delante = true;
                delGrupo(enEl.deGrupo).forEach((x) => {
                    x.delante = false;
                });
                delGrupo(enEl.deGrupo).forEach((x) => {
                    x.el = null;
                });
            }
        }
        estado.modulos.push(m);
        if (m.grupo) {
            // Si el grupo se ha quedado sin la de delante, ésta.
            if (!delGrupo(m).some((x) => x.delante)) {
                m.delante = true;
            }
            if (delGrupo(m).length < 2) {
                delete m.grupo;
                delete m.delante;
            }
        }
        pintarTodo();
        if (destino && destino.grupoCon && estado.modulos.includes(destino.grupoCon)) {
            agrupar(m, destino.grupoCon);
        }
        guardar();
        alFrente(m);
        m.el.scrollIntoView({ block: "nearest" });
        const primero = m.el.querySelector(".master-ventana-cuerpo button, .master-ventana-cuerpo input, .master-ventana-cuerpo textarea")
            || m.el.querySelector(".master-ventana-nombre");
        primero.focus();
        avisar(ocT("Añadido: {n}.", { n: m.titulo || ocT(def.nombre) }));
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
    tablist.setAttribute("aria-label", ocT("Perfiles de la pantalla de máster"));
    lienzo.setAttribute("role", "tabpanel");

    // Los mandos del zoom (− 100 % +): el del medio lo deja en 100 %.
    const HAY_ZOOM = !!(window.CSS && CSS.supports && CSS.supports("zoom", "2"));
    const menosZoom = botonDe("master-pestana-mando", "－", () => pasoZoom(-1), ocT("Alejar el tablero"));
    const masZoom = botonDe("master-pestana-mando", "＋", () => pasoZoom(1), ocT("Acercar el tablero"));
    const botonZoom = botonDe("master-zoom-valor", "100 %", () => ponerZoom(1, true), ocT("Dejar el zoom del tablero en 100 %"));
    menosZoom.title = ocT("Alejar (Ctrl + rueda)");
    masZoom.title = ocT("Acercar (Ctrl + rueda)");
    botonZoom.title = ocT("Volver al 100 %");
    // Ctrl + rueda (o el pellizco del panel táctil) sobre el tablero.
    lienzo.addEventListener("wheel", (e) => {
        if (!e.ctrlKey || !HAY_ZOOM || enMovil.matches || esModo(estado)) {
            return;
        }
        e.preventDefault();
        verZoom((estado.zoom || 1) * Math.exp(-e.deltaY * 0.002));
        clearTimeout(lienzo.esperaZoom);
        lienzo.esperaZoom = setTimeout(() => ponerZoom(estado.zoom, true), 300);
    }, { passive: false });
    // El pellizco con dos dedos en el tablero (en la tableta), también
    // encima de las ventanas, menos donde el dedo ya hace otra cosa
    // (dibujar, el mapa de relaciones, mover o cambiar el tamaño de una
    // ventana, escribir). Con eventos táctiles y no de puntero: los dedos
    // nunca llegan a la vez y, si el primero ya ha empezado a desplazar el
    // tablero, el navegador cancela sus punteros pero los toques siguen
    // llegando (entonces desplaza y amplía a la vez; si aún no desplazaba,
    // sólo amplía).
    const GESTO_PROPIO = ".master-dibujo-encima, .master-rel-mapa, .master-ventana-barra, .master-ventana-tamano,"
        + " input, textarea, select, [contenteditable]";
    let pellizco = null;
    const separacion = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1;
    lienzo.addEventListener("touchstart", (e) => {
        pellizco = null;
        if (e.touches.length !== 2 || !HAY_ZOOM || enMovil.matches || esModo(estado)) {
            return;
        }
        const t = Array.from(e.touches);
        if (t.some((x) => !(x.target instanceof Element) || !lienzo.contains(x.target) || x.target.closest(GESTO_PROPIO))) {
            return;
        }
        pellizco = { d: separacion(t), z: estado.zoom || 1 };
        // Sólo mientras dura el pellizco: un «touchmove» que no es pasivo
        // hace que el navegador espere al JavaScript antes de desplazar, y
        // el desplazamiento normal con un dedo daría tirones.
        lienzo.addEventListener("touchmove", alPellizcar, { passive: false });
    }, { passive: true });
    function alPellizcar(e) {
        if (!pellizco || e.touches.length !== 2) {
            return;
        }
        if (e.cancelable) {
            e.preventDefault();
        }
        verZoom(pellizco.z * separacion(Array.from(e.touches)) / pellizco.d);
    }
    const sinDedos = (e) => {
        if (pellizco && e.touches.length < 2) {
            pellizco = null;
            lienzo.removeEventListener("touchmove", alPellizcar);
            ponerZoom(estado.zoom, true);
        }
    };
    lienzo.addEventListener("touchend", sinDedos);
    lienzo.addEventListener("touchcancel", sinDedos);

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
    // Mientras dura el gesto (la rueda o el pellizco), el zoom se enseña con
    // «transform», que no recoloca nada (va fluido también en tabletas
    // modestas); al acabar, ponerZoom lo pone de verdad, desde la misma
    // esquina, así que no salta.
    let zoomBase = 0;
    function verZoom(z) {
        z = Math.min(2, Math.max(0.25, Math.round(z * 100) / 100));
        if (!zoomBase) {
            zoomBase = zoomAhora();
            lienzo.style.transformOrigin = "0 0";
            lienzo.style.willChange = "transform";
        }
        estado.zoom = z;
        lienzo.style.transform = "scale(" + zoomAhora() / zoomBase + ")";
        if (botonZoom) {
            botonZoom.textContent = Math.round(z * 100) + " %";
        }
    }
    function ponerZoom(z, decirlo) {
        if (zoomBase) {
            zoomBase = 0;
            lienzo.style.transform = "";
            lienzo.style.transformOrigin = "";
            lienzo.style.willChange = "";
        }
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
            avisar(ocT("Zoom del tablero: {round} %.", { round: Math.round(z * 100) }));
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
        pintarModos();
    }

    function pintarPestanas(foco) {
        pintarElegirTablero();
        tablist.replaceChildren(...todo.perfiles.map((pf, i) => {
            const b = botonDe("master-pestana", pf.nombre, () => {
                if (pestanaMovida) {
                    return;
                }
                if (pf !== estado) {
                    activar(pf, true);
                    avisar(ocT("Perfil: {nombre}.", { nombre: pf.nombre }));
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
            x.title = ocT("Cerrar «{nombre}» (pulsa dos veces)", { nombre: pf.nombre });
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
        const activa = tablist.querySelector(".es-elegida");
        if (!activa) {
            // En un modo: ninguna elegida, pero se llega con el tabulador.
            const primera = tablist.querySelector("[role=tab]");
            if (primera) {
                primera.tabIndex = 0;
            }
            pintarFlechas();
            return;
        }
        lienzo.setAttribute("aria-labelledby", "master-pestana-" + estado.id);
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
        avisar(ocT("{nombre}: pestaña {n} de {length}.", { nombre: pf.nombre, n: k + 1, length: todo.perfiles.length }));
    }
    function cogerPestana(e, b) {
        if (e.button > 0 || todo.perfiles.length < 2) {
            return;
        }
        const x0 = e.clientX;
        const y0 = e.clientY;
        const margenQuieto = e.pointerType === "touch" ? 14 : 8;
        const quieto = (ev) => {
            if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > margenQuieto) {
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
            if (e.pointerType === "touch" && navigator.vibrate) {
                navigator.vibrate(20);
            }
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
        // Cogida con el dedo, que al moverlo no deslice la fila (sin coger,
        // sí: ver .master-pestana en el CSS).
        const quieta = (ev) => {
            if (ev.cancelable) {
                ev.preventDefault();
            }
        };
        b.addEventListener("touchmove", quieta, { passive: false });
        const soltarDedo = () => {
            b.removeEventListener("touchmove", quieta);
            b.removeEventListener("lostpointercapture", soltarDedo);
            document.removeEventListener("pointerup", soltarDedo);
        };
        b.addEventListener("lostpointercapture", soltarDedo);
        document.addEventListener("pointerup", soltarDedo);
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
                    avisar(ocT("{nombre}: pestaña {n} de {length}.", { nombre: pf.nombre, n: todo.perfiles.indexOf(pf) + 1, length: todo.perfiles.length }));
                }
            }, 0);
        };
        document.addEventListener("pointermove", mover);
        document.addEventListener("pointerup", soltar);
        document.addEventListener("pointercancel", soltar);
    }

    function renombrar() {
        const cuerpo = crear("form", "master-personalizar");
        const et = crear("label", "oc-dados-etiqueta", ocT("nombre del perfil"));
        // Dos colores, por separado: el de la pestaña y el del fondo del
        // tablero.
        const grupoPestana = muestrasDe(ocT("color de la pestaña"), COLORES_PESTANA, colorDePestana(estado), "master-perfil-otro-pestana");
        const grupo = muestrasDe(ocT("color del fondo del tablero"), TABLEROS, estado.color || "", "master-perfil-otro");
        const input = crear("input", "oc-dados-texto");
        input.id = "master-perfil-nombre";
        input.value = estado.nombre;
        input.maxLength = 30;
        input.autocomplete = "off";
        et.htmlFor = input.id;
        const listo = crear("button", "oc-vida-accion es-principal", ocT("guardar"));
        listo.type = "submit";
        const comoPlantilla = botonDe("oc-vida-accion", ocT("💾 guardar como plantilla"), () => {
            const lista = leerPlantillas();
            lista.push({ id: Date.now().toString(36), nombre: input.value.trim() || estado.nombre,
                ventanas: estado.modulos.map((x) => ({ tipo: x.tipo, x: x.x, y: x.y, w: x.w, h: x.h, titulo: x.titulo || "",
                    color: x.color || "", escala: x.escala || 1, plegado: !!x.plegado, grupo: x.grupo, delante: x.delante })) });
            guardarPlantillas(lista);
            avisar(ocT("Guardada la plantilla «{n}»: sale al crear un perfil con ＋.", { n: input.value.trim() || estado.nombre }));
        }, ocT("Guardar las ventanas de este perfil como plantilla"));
        comoPlantilla.title = ocT("Las ventanas, donde están, sin lo que tienen dentro");
        const cerrarEsta = botonDe("oc-vida-accion", ocT("🗑️ cerrar esta pestaña"), () => {
            if (porCerrar !== estado) {
                cerrarEsta.textContent = ocT("🗑️ ¿seguro? pulsa otra vez");
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
            avisar(ocT("Perfil: {nombre}.", { nombre: estado.nombre }));
        });
        const cerrar = window.ocVentana.abrir({ titulo: ocT("nombre y colores de la pestaña"), cuerpo, vuelta: botonRenombrar, foco: input });
    }

    // LAS PLANTILLAS DE PERFIL: las de aquí (unas ventanas que se ponen
    // ordenadas) y las propias («💾 guardar como plantilla» en el ✎ del
    // perfil: sus ventanas, donde estaban, sin lo que tienen dentro;
    // «richi-master-plantillas»).
    const PLANTILLAS = [["vacio", ocT("⬜ vacío"), ocT("Sin ventanas."), -1]].concat(PERFILES_DE_SERIE.map(([nombre, color, , ventanas], i) =>
        ["serie" + i, nombre, ocT("{n} ventanas, donde van{n2}.", { n: ventanas.length, n2: color ? ocT(" · tablero {n}", { n: (TABLEROS.find((t) => t[0] === color) || [])[1] || color }) : "" }), i]));
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
            avisar(ocT("No se ha podido guardar la plantilla."));
        }
    };

    function perfilNuevo() {
        const cuerpo = crear("form", "master-personalizar");
        const et = crear("label", "oc-dados-etiqueta", ocT("nombre del perfil"));
        const input = crear("input", "oc-dados-texto");
        input.id = "master-perfil-nuevo";
        input.value = ocT("perfil ") + (todo.perfiles.length + 1);
        input.maxLength = 30;
        input.autocomplete = "off";
        et.htmlFor = input.id;
        // Si no se le pone nombre, el de la plantilla.
        let nombreTocado = false;
        input.addEventListener("input", () => {
            nombreTocado = true;
        });
        const grupo = crear("fieldset", "master-plantillas");
        grupo.appendChild(crear("legend", "oc-dados-etiqueta", ocT("con qué ventanas")));
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
                    avisar(ocT("Plantilla quitada: {nombre}.", { nombre: nombre }));
                }, ocT("Quitar la plantilla {nombre}", { nombre: nombre }));
                caja.appendChild(quitar);
            }
            grupo.appendChild(caja);
            return radio;
        };
        const radios = PLANTILLAS.map(([v, n, desc]) => opcion(v, n, desc));
        propias.forEach((pl) => radios.push(opcion("propia-" + pl.id, "💾 " + pl.nombre, ocT("{n} ventanas, donde las dejaste.", { n: pl.ventanas.length }),
            pl.id)));
        radios[0].checked = true;
        const listo = crear("button", "oc-vida-accion es-principal", ocT("＋ crear"));
        listo.type = "submit";
        cuerpo.append(et, input, grupo, listo);
        cuerpo.addEventListener("submit", (e) => {
            e.preventDefault();
            const elegida = (grupo.querySelector("input:checked") || radios[0]).value;
            const pf = { id: "p" + siguientePerfil++, nombre: input.value.trim() || ocT("perfil {n}", { n: todo.perfiles.length + 1 }), modulos: [] };
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
            avisar(ocT("Perfil nuevo: {nombre}{n}", { nombre: pf.nombre, n: pf.modulos.length ? ocT(", con {n} ventanas.", { n: pf.modulos.length }) : "." }));
        });
        const cerrar = window.ocVentana.abrir({ titulo: ocT("perfil nuevo"), cuerpo, vuelta: botonNueva, foco: input });
    }

    const botonNueva = botonDe("master-pestana-mando", "＋", () => perfilNuevo(), ocT("Perfil nuevo"));
    botonNueva.title = ocT("Perfil nuevo");
    const botonRenombrar = botonDe("master-pestana-mando", "✎", () => (esModo(estado) ? editarModo(estado, botonRenombrar) : renombrar()),
        ocT("Nombre y colores de esta pestaña"));
    botonRenombrar.title = ocT("Nombre, color de la pestaña y fondo del tablero");
    botonRenombrar.setAttribute("aria-haspopup", "dialog");
    // CERRAR UNA PESTAÑA (la ✕ de cada una, Supr o «cerrar» en su ✎):
    // pide pulsar dos veces; la última no se cierra.
    let porCerrar = null;
    let esperaCerrar = 0;
    function cerrarPerfil(pf, quien) {
        if (todo.perfiles.length < 2) {
            avisar(ocT("Es la única pestaña: no se puede cerrar."));
            return;
        }
        if (porCerrar !== pf) {
            porCerrar = pf;
            if (quien) {
                quien.classList.add("es-seguro");
            }
            avisar(ocT("Pulsa otra vez para cerrar la pestaña {nombre} y sus ventanas.", { nombre: pf.nombre }));
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
        avisar(ocT("Cerrada: {nombre}.", { nombre: pf.nombre }));
    }
    const mandosPestanas = crear("div", "master-pestanas-mandos");
    mandosPestanas.append(botonNueva, botonRenombrar);

    // LAS PESTAÑAS NO CRECEN SIN FIN: caben en un ancho fijo; si hay más,
    // se deslizan de lado con ‹ ›, y todo queda en una sola barra.
    const desliza = (s) => {
        const reducir = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        tablist.scrollBy({ left: s * Math.max(120, Math.round(tablist.clientWidth * 0.7)), behavior: reducir ? "auto" : "smooth" });
    };
    const flechaIzq = botonDe("master-pestana-mando master-pestanas-flecha", "‹", () => desliza(-1), ocT("Ver las pestañas de la izquierda"));
    const flechaDer = botonDe("master-pestana-mando master-pestanas-flecha", "›", () => desliza(1), ocT("Ver las pestañas de la derecha"));
    flechaIzq.title = ocT("Pestañas de la izquierda");
    flechaDer.title = ocT("Pestañas de la derecha");
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
    // En vertical (estrecho), en vez de las pestañas, un desplegable con los
    // tableros: así la barra cabe en una línea. (El CSS enseña uno u otro.)
    const elegirTablero = crear("select", "master-tableros-elegir");
    elegirTablero.setAttribute("aria-label", ocT("Tablero"));
    elegirTablero.addEventListener("change", () => {
        const pf = todo.perfiles.find((x) => x.id === elegirTablero.value);
        if (pf && pf !== estado) {
            activar(pf, false);
            avisar(ocT("Perfil: {nombre}.", { nombre: pf.nombre }));
        }
    });
    function pintarElegirTablero() {
        const opciones = todo.perfiles.map((pf) => {
            const o = crear("option", "", pf.nombre);
            o.value = pf.id;
            return o;
        });
        if (esModo(estado)) {
            const o = crear("option", "", estado.emoji + " " + estado.nombre);
            o.value = "";
            o.disabled = true;
            opciones.unshift(o);
        }
        elegirTablero.replaceChildren(...opciones);
        elegirTablero.value = esModo(estado) ? "" : estado.id;
    }

    // ---- EL MENÚ DE LOS MODOS: un botón (abajo a la izquierda, o donde se
    // haya dejado) con el modo de ahora; al pulsarlo, la lista con todos los
    // modos de la campaña, «▦ tableros» para volver a las pestañas, «＋» para
    // uno nuevo y «✥ mover» para llevarlo a otro sitio con el teclado.
    // Manteniéndolo pulsado (ESPERA_COGER) se coge y se arrastra donde se
    // quiera; se recuerda («richi-master-modos-sitio»). ----
    const CLAVE_MODOS_SITIO = "richi-master-modos-sitio";
    const menuModos = crear("nav", "master-modos");
    menuModos.setAttribute("aria-label", ocT("Modos"));
    const listaModos = crear("ul", "master-modos-lista");
    listaModos.id = "master-modos-lista";
    listaModos.hidden = true;
    const abrirModos = botonDe("master-modos-abrir", "", () => {
        if (menuModos.dataset.cogido) {
            return;
        }
        verListaModos(listaModos.hidden);
    });
    abrirModos.setAttribute("aria-controls", listaModos.id);
    abrirModos.setAttribute("aria-expanded", "false");
    abrirModos.title = ocT("Los modos (mantén pulsado para moverlo)");
    menuModos.append(listaModos, abrirModos);
    function verListaModos(ver, sinFoco) {
        listaModos.hidden = !ver;
        abrirModos.setAttribute("aria-expanded", String(ver));
        menuModos.classList.toggle("es-abierto", ver);
        if (ver) {
            // Hacia arriba o hacia abajo, según dónde quepa.
            const r = menuModos.getBoundingClientRect();
            menuModos.classList.toggle("es-hacia-abajo", r.top < window.innerHeight / 2);
            const actual = listaModos.querySelector("[aria-current=true]") || listaModos.querySelector("button");
            if (actual && !sinFoco) {
                actual.focus();
            }
        }
    }
    menuModos.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !listaModos.hidden) {
            e.stopPropagation();
            verListaModos(false);
            abrirModos.focus();
        }
    });
    document.addEventListener("pointerdown", (e) => {
        if (!listaModos.hidden && !menuModos.contains(e.target)) {
            verListaModos(false);
        }
    });

    // Dónde está: guardado como su esquina de arriba a la izquierda (sin
    // salirse de la pantalla). Sin guardar, abajo a la izquierda (el CSS).
    function sitioModos() {
        try {
            const x = JSON.parse(localStorage.getItem(CLAVE_MODOS_SITIO) || "null");
            return x && isFinite(x.x) && isFinite(x.y) ? x : null;
        } catch (e) {
            return null;
        }
    }
    function ponerSitioModos(sitio, guardarlo) {
        if (esModo(estado)) {
            requestAnimationFrame(() => crecerLienzo());
        }
        if (!sitio) {
            menuModos.style.left = "";
            menuModos.style.top = "";
            menuModos.classList.remove("es-movido");
            if (guardarlo) {
                try {
                    localStorage.removeItem(CLAVE_MODOS_SITIO);
                } catch (e) {
                    // Sin guardar: vale para esta vez.
                }
            }
            return;
        }
        const w = menuModos.offsetWidth || 120;
        const h = abrirModos.offsetHeight || 44;
        const x = Math.max(4, Math.min(window.innerWidth - w - 4, Math.round(sitio.x)));
        const y = Math.max(4, Math.min(window.innerHeight - h - 4, Math.round(sitio.y)));
        menuModos.classList.add("es-movido");
        menuModos.style.left = x + "px";
        menuModos.style.top = y + "px";
        if (guardarlo) {
            try {
                localStorage.setItem(CLAVE_MODOS_SITIO, JSON.stringify({ x, y }));
            } catch (e) {
                // Sin guardar: vale para esta vez.
            }
        }
    }
    window.addEventListener("resize", () => ponerSitioModos(sitioModos(), false));
    // Cogerlo: mantener pulsado el botón (sin moverse) y arrastrar.
    abrirModos.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) {
            return;
        }
        const x0 = e.clientX;
        const y0 = e.clientY;
        const r = menuModos.getBoundingClientRect();
        let cogido = false;
        const quieto = (ev) => {
            if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 8) {
                soltar();
            }
        };
        const mover = (ev) => {
            ev.preventDefault();
            ponerSitioModos({ x: r.left + ev.clientX - x0, y: r.top + ev.clientY - y0 }, false);
        };
        const soltar = () => {
            clearTimeout(espera);
            document.removeEventListener("pointermove", quieto);
            document.removeEventListener("pointermove", mover);
            document.removeEventListener("pointerup", soltar);
            document.removeEventListener("pointercancel", soltar);
            if (cogido) {
                menuModos.classList.remove("es-cogido");
                const ahora = menuModos.getBoundingClientRect();
                ponerSitioModos({ x: ahora.left, y: ahora.top }, true);
                avisar(ocT("Menú de los modos movido."));
                // El «click» de después de soltar no abre la lista.
                setTimeout(() => {
                    delete menuModos.dataset.cogido;
                }, 0);
            }
        };
        const espera = setTimeout(() => {
            cogido = true;
            menuModos.dataset.cogido = "1";
            verListaModos(false);
            menuModos.classList.add("es-cogido");
            if (navigator.vibrate) {
                navigator.vibrate(15);
            }
            document.removeEventListener("pointermove", quieto);
            document.addEventListener("pointermove", mover);
            try {
                abrirModos.setPointerCapture(e.pointerId);
            } catch (err) {
                // Sin captura: sigue funcionando con el documento.
            }
        }, ESPERA_COGER);
        document.addEventListener("pointermove", quieto);
        document.addEventListener("pointerup", soltar);
        document.addEventListener("pointercancel", soltar);
    });
    // Con el teclado: «✥ mover» y las flechas (Mayús: más deprisa); Intro o
    // Escape lo dejan ahí.
    function moverModosConTeclado() {
        verListaModos(false);
        menuModos.classList.add("es-cogido");
        abrirModos.focus();
        avisar(ocT("Mueve el menú de los modos con las flechas; Intro o Escape para dejarlo."));
        const tecla = (e) => {
            const paso = e.shiftKey ? 60 : 15;
            const d = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
            if (d) {
                e.preventDefault();
                const r = menuModos.getBoundingClientRect();
                ponerSitioModos({ x: r.left + d[0], y: r.top + d[1] }, true);
                return;
            }
            if (e.key === "Enter" || e.key === "Escape" || e.key === "Tab") {
                if (e.key !== "Tab") {
                    e.preventDefault();
                    e.stopPropagation();
                }
                acabar();
            }
        };
        const acabar = () => {
            menuModos.classList.remove("es-cogido");
            abrirModos.removeEventListener("keydown", tecla, true);
            abrirModos.removeEventListener("blur", acabar);
            avisar(ocT("Menú de los modos colocado."));
        };
        abrirModos.addEventListener("keydown", tecla, true);
        abrirModos.addEventListener("blur", acabar);
    }

    function pintarModos() {
        const ahora = esModo(estado);
        const foco = listaModos.contains(document.activeElement) ? document.activeElement.dataset.modo : null;
        abrirModos.replaceChildren(crear("span", "master-modos-que", ahora ? estado.emoji + " " + estado.nombre : ocT("▦ tableros")),
            crear("span", "master-modos-flecha", "▾"));
        abrirModos.lastChild.setAttribute("aria-hidden", "true");
        abrirModos.setAttribute("aria-label", ocT("Modos ({que}): elegir otro", { que: ahora ? estado.nombre : ocT("tableros") }));
        const boton = (texto, alPulsar, etiqueta, actual, clave) => {
            const li = crear("li");
            const b = botonDe("master-modos-boton", texto, () => {
                verListaModos(false);
                alPulsar();
            }, etiqueta);
            if (actual) {
                b.setAttribute("aria-current", "true");
            }
            b.dataset.modo = clave;
            li.appendChild(b);
            return li;
        };
        listaModos.replaceChildren(...todo.modos.map((mo) => {
            const li = boton(mo.emoji + " " + mo.nombre, () => activarModo(mo), ocT("Modo {nombre}", { nombre: mo.nombre }), estado === mo, mo.id);
            li.firstChild.id = "master-modo-b-" + mo.id;
            // ✎: su nombre, su dibujo, su rejilla, o borrarlo.
            const cambiar = botonDe("master-modos-editar", "✎", () => {
                verListaModos(false);
                editarModo(mo, abrirModos);
            }, ocT("Cambiar o borrar el modo {nombre}", { nombre: mo.nombre }));
            cambiar.dataset.modo = "editar-" + mo.id;
            cambiar.setAttribute("aria-haspopup", "dialog");
            li.classList.add("master-modos-con-editar");
            li.appendChild(cambiar);
            return li;
        }), boton(ocT("▦ tableros"), volverATableros, ocT("Volver a los tableros (las pestañas de arriba)"), !ahora, "tableros"),
        boton(ocT("＋ modo nuevo"), () => editarModo(null, abrirModos), ocT("Crear un modo nuevo"), false, "nuevo"),
        boton(ocT("✥ mover este menú"), moverModosConTeclado, ocT("Mover este menú con las flechas"), false, "mover"));
        listaModos.querySelector("[data-modo=nuevo]").setAttribute("aria-haspopup", "dialog");
        if (sitioModos()) {
            listaModos.appendChild(boton(ocT("↺ a su sitio"), () => {
                ponerSitioModos(null, true);
                abrirModos.focus();
                avisar(ocT("Menú de los modos en su sitio: abajo a la izquierda."));
            }, ocT("Volver a poner el menú abajo a la izquierda"), false, "sitio"));
        }
        if (foco) {
            const b = listaModos.querySelector("[data-modo='" + foco + "']");
            if (b) {
                b.focus();
            }
        }
        // El lienzo: en un modo, una región con el nombre del modo; en un
        // tablero, el panel de su pestaña.
        lienzo.setAttribute("role", ahora ? "region" : "tabpanel");
        if (ahora) {
            lienzo.setAttribute("aria-label", ocT("Modo {nombre}", { nombre: estado.nombre }));
            lienzo.removeAttribute("aria-labelledby");
        } else {
            lienzo.removeAttribute("aria-label");
        }
        botonRenombrar.setAttribute("aria-label", ahora ? ocT("Nombre, dibujo y huecos de este modo") : ocT("Nombre y colores de esta pestaña"));
        botonRenombrar.title = ahora ? ocT("Este modo: nombre, dibujo y huecos") : ocT("Esta pestaña: nombre y colores");
    }
    function activarModo(mo) {
        if (estado === mo) {
            return;
        }
        activar(mo, false);
        window.scrollTo(0, 0);
        crecerLienzo();
        avisar(ocT("Modo {nombre}.", { nombre: mo.nombre }));
    }
    function volverATableros() {
        if (!esModo(estado)) {
            return;
        }
        const pf = todo.perfiles.find((x) => x.id === todo.activo) || todo.perfiles[0];
        activar(pf, false);
        avisar(ocT("Tablero: {nombre}.", { nombre: pf.nombre }));
    }
    // CREAR O CAMBIAR UN MODO: su nombre, su dibujo y su rejilla (con un
    // dibujito de cada una); al crearlo, también desde uno de serie. Al
    // cambiar la rejilla, las ventanas de los huecos que ya no hay quedan
    // sueltas encima. Borrarlo pide pulsar dos veces.
    function editarModo(mo, vuelta) {
        const nuevo = !mo;
        const cuerpo = crear("form", "master-personalizar");
        const uid = "master-modo-" + (mo ? mo.id : "nuevo");
        const campo = (texto, valor, max, sufijo) => {
            const et = crear("label", "oc-dados-etiqueta", texto);
            const x = crear("input", "oc-dados-texto");
            x.id = uid + "-" + sufijo;
            x.value = valor;
            x.maxLength = max;
            x.autocomplete = "off";
            et.htmlFor = x.id;
            cuerpo.append(et, x);
            return x;
        };
        const nombre = campo(ocT("nombre del modo"), mo ? mo.nombre : "", 24, "nombre");
        const emoji = campo(ocT("dibujo (un emoji)"), mo ? mo.emoji : "🧩", 8, "emoji");
        let desde = null;
        if (nuevo) {
            desde = elegirDe(uid + "-desde", ocT("empezar"), [["", ocT("vacío (eliges la rejilla y luego sus ventanas)")]].concat(MODOS_DE_SERIE
                .map((x, i) => [String(i), ocT("como el de serie: {n} {n2}", { n: x[0], n2: x[1] })])), "");
            cuerpo.appendChild(desde);
        }
        const rejillas = crear("fieldset", "master-colores master-rejillas");
        rejillas.appendChild(crear("legend", "oc-dados-etiqueta", ocT("huecos")));
        let elegida = mo ? mo.rejilla : "dos";
        Object.keys(REJILLAS).forEach((k) => {
            const op = crear("label", "master-rejilla");
            const radio = crear("input");
            radio.type = "radio";
            radio.name = uid + "-rejilla";
            radio.value = k;
            radio.checked = k === elegida;
            radio.addEventListener("change", () => {
                elegida = k;
            });
            const dibujo = crear("span", "master-rejilla-dibujo");
            dibujo.setAttribute("aria-hidden", "true");
            REJILLAS[k].huecos.forEach(([col, fila, ancho, alto]) => {
                const h = crear("span");
                h.style.gridArea = fila + " / " + col + " / span " + alto + " / span " + ancho;
                dibujo.appendChild(h);
            });
            op.append(radio, dibujo, crear("span", "", REJILLAS[k].nombre + " (" + REJILLAS[k].huecos.length
                + (REJILLAS[k].huecos.length === 1 ? ocT(" hueco)") : ocT(" huecos)"))));
            rejillas.appendChild(op);
        });
        cuerpo.appendChild(rejillas);
        if (desde) {
            // Con uno de serie, su rejilla.
            desde.elegir.addEventListener("change", () => {
                const x = MODOS_DE_SERIE[Number(desde.elegir.value)];
                rejillas.hidden = !!x;
                if (x) {
                    elegida = x[2];
                    if (!nombre.value.trim()) {
                        nombre.value = x[1];
                    }
                    emoji.value = x[0];
                }
            });
        }
        const botones = crear("div", "master-anadir-otras");
        const listo = crear("button", "oc-vida-accion es-principal", nuevo ? ocT("＋ crear el modo") : "guardar");
        listo.type = "submit";
        botones.appendChild(listo);
        if (!nuevo) {
            let seguro = false;
            const borrar = botonDe("oc-vida-accion", ocT("🗑️ borrar este modo"), () => {
                if (!seguro) {
                    seguro = true;
                    borrar.textContent = ocT("🗑️ ¿seguro? pulsa otra vez");
                    avisar(ocT("Pulsa otra vez para borrar el modo {nombre} (con sus ventanas).", { nombre: mo.nombre }));
                    return;
                }
                cerrar();
                todo.modos = todo.modos.filter((x) => x !== mo);
                if (estado === mo) {
                    estado.modulos.forEach((m) => {
                        m.el = null;
                    });
                    estado = todo.perfiles.find((x) => x.id === todo.activo) || todo.perfiles[0];
                    colorTablero();
                    pintarPestanas(false);
                    pintarTodo();
                }
                guardar();
                pintarModos();
                abrirModos.focus();
                avisar(ocT("Modo borrado: {nombre}.", { nombre: mo.nombre }));
            });
            botones.appendChild(borrar);
        }
        cuerpo.appendChild(botones);
        cuerpo.addEventListener("submit", (e) => {
            e.preventDefault();
            const n = nombre.value.trim();
            if (!n) {
                avisar(ocT("Ponle un nombre."));
                nombre.focus();
                return;
            }
            const dibujo = emoji.value.trim() || "🧩";
            cerrar();
            if (nuevo) {
                const serie = desde && desde.elegir.value !== "" ? modosDeSerie()[Number(desde.elegir.value)] : null;
                const x = Object.assign(serie || { rejilla: elegida, modulos: [] }, { id: "o" + siguienteModo++, nombre: n, emoji: dibujo });
                x.modulos.forEach((m) => {
                    m.id = "m" + siguienteId++;
                });
                todo.modos.push(x);
                activarModo(x);
                avisar(ocT("Modo creado: {n}{n2}", { n: n, n2: x.modulos.length ? "." : ocT(". Pulsa «＋ elegir ventana» en cada hueco.") }));
                return;
            }
            mo.nombre = n;
            mo.emoji = dibujo;
            if (elegida !== mo.rejilla) {
                mo.rejilla = elegida;
                const cuantos = REJILLAS[elegida].huecos.length;
                mo.modulos.filter((m) => Number.isInteger(m.hueco) && m.hueco >= cuantos).forEach((m, i) => {
                    delete m.hueco;
                    m.x = 30 + 30 * (i % 5);
                    m.y = 30 + 30 * (i % 5);
                });
                mo.modulos.forEach((m) => {
                    m.el = null;
                });
            }
            guardar();
            if (estado === mo) {
                pintarTodo();
            }
            pintarModos();
            avisar(ocT("Guardado: {nombre}.", { nombre: mo.nombre }));
        });
        const cerrar = window.ocVentana.abrir({ titulo: nuevo ? ocT("modo nuevo") : ocT("el modo {nombre}", { nombre: mo.nombre }), cuerpo,
            vuelta: vuelta || botonRenombrar, foco: nombre });
    }

    // ---- LAS CAMPAÑAS: el botón de la izquierda del todo. Cada campaña
    // tiene sus pestañas, sus ventanas y su party (no se mezclan): se
    // cambia de una a otra, se crea una nueva, se renombra o se borra. ----
    const botonCampana = botonDe("master-campana", "", () => verCampanas());
    botonCampana.setAttribute("aria-haspopup", "dialog");
    botonCampana.setAttribute("aria-keyshortcuts", "C");
    function pintarCampana() {
        botonCampana.textContent = "📚";
        botonCampana.setAttribute("aria-label", ocT("Campaña: {nombre} (cambiar de campaña)", { nombre: todo.nombre }));
        botonCampana.title = ocT("Campaña: {nombre} — cambiar, crear o renombrar", { nombre: todo.nombre });
        aplicarUnidades();
        aplicarEdicion();
    }
    function activarCampana(c) {
        estado.modulos.forEach((m) => {
            m.el = null;
        });
        todo = c;
        estado = (c.modoActivo && c.modos.find((mo) => mo.id === c.modoActivo)) || c.perfiles.find((pf) => pf.id === c.activo)
            || c.perfiles[0];
        guardar();
        colorTablero();
        pintarCampana();
        pintarPestanas(false);
        pintarTodo();
        pintarModos();
        avisar(ocT("Campaña: {nombre}.", { nombre: c.nombre }));
    }
    // EL TABLERO DE TUTORIAL: unos post-its que explican las opciones. Va
    // el primero en cada campaña nueva (se puede quitar como cualquiera).
    // Uno para el ordenador y otro para la tableta (la app de Android: con
    // el dedo, sin teclado), con las tarjetas en el mismo orden.
    // Las de los modos, iguales en los dos.
    const TARJETAS_MODOS = [
        [ocT("🧩 Los modos"), "lima", ocT("<p>Además de los tableros, están los <strong>modos</strong>: pantallas fijas que se llenan solas, sin arrastrar ni colocar nada (pensadas para la tablet).</p><ul><li>El menú de los modos está <strong>abajo a la izquierda</strong>: tócalo y elige un modo de la lista. <strong>Mantenlo pulsado</strong> para llevarlo a otro sitio (o «✥ mover este menú»).</li><li><strong>▦ tableros</strong> vuelve a las pestañas de siempre.</li><li>En un hueco vacío, <strong>＋ elegir ventana</strong>. En el <strong>✎</strong> de una ventana, la pestaña <strong>🧩 hueco</strong> la cambia por otra o le pone otra al lado, en pestañas.</li><li>El <strong>✎</strong> de cada modo en la lista le cambia el nombre o lo borra.</li><li><strong>＋</strong> crea un modo tuyo: vacío con la rejilla que elijas o copiando uno de serie. El <strong>✎</strong> de junto a las pestañas le cambia el nombre, el dibujo o la rejilla, o lo borra.</li></ul>")],
        [ocT("⚔️ Modo combate"), "rojo", ocT("<ul><li><strong>⏩ turnos</strong>: a quién le toca, en grande, y quién va después. <strong>◀ anterior</strong> y <strong>siguiente ▶</strong> pasan el turno (van a la par con la iniciativa).</li><li><strong>🐲 criatura del turno</strong>: el bloque del bestiario de quien le toca, o su ficha resumida si es de la party.</li><li>En pestañas: con la criatura del turno, la <strong>party</strong> y el <strong>bestiario</strong>; a la derecha, la <strong>⏱️ iniciativa</strong> con las condiciones, las acciones y las reglas.</li><li><strong>❤️</strong> en cada uno: un número y <strong>daño</strong>, <strong>cura</strong> o <strong>vida temporal</strong> (la cura no pasa de sus PG máximos). Si se estaba concentrando, salta la tirada de concentración; un PJ a 0 PG, sus <strong>salvaciones de muerte</strong>.</li><li><strong>✎</strong> cambia sus PG, su iniciativa, su nombre y sus <strong>estados</strong> (sus dibujos se pulsan para leerlos): cada criatura es única.</li><li>Suena al pasar de turno y de ronda (🔔 lo calla); <strong>⏭️</strong> se salta a los enemigos a 0 PG.</li><li>Las dos primeras también se pueden poner en cualquier tablero: <strong>🧰 → ▶️ turno a turno</strong>.</li></ul>")],
        [ocT("🛡️ Modo party"), "verde", ocT("<p><strong>🧝 Fichas de la party</strong>: elige un personaje arriba y su ficha se abre como un libro. Al final, <strong>＋</strong> añade otro, <strong>✎</strong> edita la ficha del elegido, <strong>🗑</strong> lo quita y <strong>📥</strong> lo trae de D&amp;D Beyond o Nivel20 (y se recuerda de dónde, para actualizarlo).</p><ul><li>La tarjeta: retrato, <strong>PG</strong> (se cambian ahí mismo), CA y características; a 0 PG, sus salvaciones de muerte.</li><li>Las secciones: historia, la ficha (combate, habilidades, acciones por tipo, conjuros por nivel, inventario, rasgos por especie, clase y dotes: se pulsan para leerlos), sus <strong>criaturas</strong> (compañeros y monturas, con su perfil del bestiario), PNJ y notas, <strong>imágenes</strong>, extra y lo del máster.</li><li>También está en <strong>🧰 → mesa</strong>, para ponerla en un tablero.</li></ul><p>Y el modo <strong>📝 notas</strong>: tus documentos y seis post-its.</p>")]
    ];
    // Las de los modos son más largas: van en la última fila, más altas.
    const ALTO_MODOS = 1290;
    // Lo que decían antes algunas tarjetas: si siguen así (nadie las ha
    // tocado), se cambian por lo de ahora.
    const TUTORIAL_VIEJO = {
        "🧩 Los modos": ["<p>Abajo a la derecha está el menú de los <strong>modos</strong>: pantallas que se llenan solas, sin mover ventanas.</p><ul><li><strong>⚔️ combate</strong>: a quién le toca y quién va después, el perfil de la criatura del turno, condiciones y reglas, y la iniciativa.</li><li><strong>📝 notas</strong>: tus documentos y seis post-its.</li><li><strong>🛡️ party</strong>: la ficha de cada personaje, como un libro.</li><li>En un hueco vacío, <strong>＋ elegir ventana</strong>; en el ✎ de una ventana, «🧩 hueco» la cambia por otra o le pone otra en pestaña.</li><li><strong>＋</strong> crea un modo tuyo, <strong>✎</strong> (junto a las pestañas) cambia el de ahora y <strong>▦ tableros</strong> vuelve a las pestañas.</li></ul>", "<p>Además de los tableros, están los <strong>modos</strong>: pantallas fijas que se llenan solas, sin arrastrar ni colocar nada (pensadas para la tablet).</p><ul><li>El menú de los modos está <strong>abajo a la derecha</strong>: toca uno para entrar; <strong>−</strong> lo pliega.</li><li><strong>▦ tableros</strong> vuelve a las pestañas de siempre.</li><li>En un hueco vacío, <strong>＋ elegir ventana</strong>. En el <strong>✎</strong> de una ventana, la pestaña <strong>🧩 hueco</strong> la cambia por otra o le pone otra al lado, en pestañas.</li><li><strong>＋</strong> crea un modo tuyo: vacío con la rejilla que elijas o copiando uno de serie. El <strong>✎</strong> de junto a las pestañas le cambia el nombre, el dibujo o la rejilla, o lo borra.</li></ul>", "<p>Además de los tableros, están los <strong>modos</strong>: pantallas fijas que se llenan solas, sin arrastrar ni colocar nada (pensadas para la tablet).</p><ul><li>El menú de los modos está <strong>abajo a la izquierda</strong>: tócalo y elige un modo de la lista. <strong>Mantenlo pulsado</strong> para llevarlo a otro sitio (o «✥ mover este menú»).</li><li><strong>▦ tableros</strong> vuelve a las pestañas de siempre.</li><li>En un hueco vacío, <strong>＋ elegir ventana</strong>. En el <strong>✎</strong> de una ventana, la pestaña <strong>🧩 hueco</strong> la cambia por otra o le pone otra al lado, en pestañas.</li><li><strong>＋</strong> crea un modo tuyo: vacío con la rejilla que elijas o copiando uno de serie. El <strong>✎</strong> de junto a las pestañas le cambia el nombre, el dibujo o la rejilla, o lo borra.</li></ul>"],
        "🧰 Añadir herramientas": ["<p>El botón <strong>🧰</strong> (arriba a la izquierda) abre todas las ventanas que puedes poner, por grupos:</p><ul><li><strong>combate</strong>: iniciativa, condiciones, encuentros…</li><li><strong>consulta</strong>: reglas, conjuros, bestiario, tienda…</li><li><strong>mesa</strong>: la party, sonido ambiente, efectos de sonido, música…</li><li><strong>mundo</strong>: generadores de nombres, PNJ, dungeons, negocios, botín…</li><li><strong>apuntes</strong>: post-its, dibujo, documentos…</li></ul>"],
        "🔍 Buscar, crear y ajustes": ["<ul><li>El <strong>buscador</strong> de arriba encuentra conjuros, monstruos, reglas, objetos, rasgos, dotes y habilidades a la vez (también lo que añadas tú).</li><li><strong>⚙</strong>: zoom, ordenar o quitar ventanas, atajos y las <strong>copias de seguridad</strong> (exportar e importar).</li><li><strong>Aa</strong>: tamaño del texto, letra más legible y los temas de color.</li></ul>", "<ul><li>El <strong>buscador</strong> de arriba encuentra conjuros, monstruos, reglas, objetos, rasgos, dotes y habilidades a la vez (también lo que añadas tú).</li><li><strong>⚙</strong>: zoom, ordenar o quitar ventanas, las <strong>copias de seguridad</strong>, dónde se guarda, que la pantalla no se apague y buscar actualizaciones.</li><li><strong>Aa</strong>: tamaño del texto, letra más legible y los temas de color.</li></ul>"],
        "⚔️ Modo combate": ["<ul><li><strong>⏩ turnos</strong>: a quién le toca, en grande, y quién va después. <strong>◀ anterior</strong> y <strong>siguiente ▶</strong> pasan el turno (van a la par con la iniciativa).</li><li><strong>🐲 criatura del turno</strong>: el bloque del bestiario de quien le toca, o su ficha resumida si es de la party.</li><li>En pestañas: con la criatura del turno, la <strong>party</strong> y el <strong>bestiario</strong>; a la derecha, la <strong>⏱️ iniciativa</strong> con las condiciones, las acciones y las reglas.</li><li><strong>❤️</strong> en cada uno: un número y <strong>daño</strong>, <strong>cura</strong> o <strong>vida temporal</strong>. Si se estaba concentrando, salta la tirada de concentración.</li><li><strong>✎</strong> cambia sus PG, su iniciativa, su nombre y sus <strong>estados</strong> (sus dibujos se pulsan para leerlos): cada criatura es única.</li><li>Suena al pasar de turno y de ronda (🔔 lo calla).</li><li>Las dos primeras también se pueden poner en cualquier tablero: <strong>🧰 → ▶️ turno a turno</strong>.</li></ul>", "<ul><li><strong>⏩ turnos</strong>: a quién le toca, en grande, y quién va después. <strong>◀ anterior</strong> y <strong>siguiente ▶</strong> pasan el turno (van a la par con la iniciativa).</li><li><strong>🐲 criatura del turno</strong>: el bloque del bestiario de quien le toca, o su ficha resumida si es de la party.</li><li>Las <strong>condiciones</strong> y las <strong>reglas</strong>, juntas en pestañas, y la <strong>⏱️ iniciativa</strong> para añadir o quitar a alguien.</li><li>Las dos primeras también se pueden poner en cualquier tablero: <strong>🧰 → ▶️ turno a turno</strong>.</li></ul>", "<ul><li><strong>⏩ turnos</strong>: a quién le toca, en grande, y quién va después. <strong>◀ anterior</strong> y <strong>siguiente ▶</strong> pasan el turno (van a la par con la iniciativa).</li><li><strong>🐲 criatura del turno</strong>: el bloque del bestiario de quien le toca, o su ficha resumida si es de la party.</li><li>Las <strong>condiciones</strong> y las <strong>reglas</strong>, juntas en pestañas, y la <strong>⏱️ iniciativa</strong> para añadir o quitar a alguien.</li><li><strong>✎</strong> en cada uno (en los turnos, la criatura del turno y la iniciativa) cambia sus PG, su iniciativa, su nombre y sus <strong>estados</strong>: cada criatura es única.</li><li>Las dos primeras también se pueden poner en cualquier tablero: <strong>🧰 → ▶️ turno a turno</strong>.</li></ul>"],
        "🛠️ Crear contenido nuevo": ["<p>El botón <strong>🛠️</strong> (arriba a la izquierda, junto a 📚) abre el <strong>compendio</strong>: ahí añades monstruos, objetos, conjuros y más cosas (especies, dotes…).</p><ul><li><strong>＋ nuevo</strong>: rellenas un formulario.</li><li><strong>⧉ copiar</strong> uno del SRD y cambiarlo, para tu versión.</li><li><strong>📋 pegar un bloque</strong> copiado de D&amp;D Beyond o de un PDF: el formulario se rellena solo.</li><li><strong>⬆ importar</strong> muchos a la vez con la plantilla.</li></ul><p>Arriba a la derecha eliges qué hacer: <strong>＋ añadir</strong>, <strong>✎ editar</strong> lo que ya hay (también lo del SRD: se guarda tu versión) o <strong>🗑️ borrar</strong> (lo del SRD se puede recuperar).</p><p>Luego salen en el bestiario, los encuentros, la tienda, los conjuros y el buscador, con «🛠️ tuyo». Su primera pestaña, <strong>❓ cómo añadir</strong>, lo explica paso a paso.</p>", "<p>El botón <strong>🛠️</strong> (arriba a la izquierda, junto a 📚) abre el <strong>compendio</strong>: ahí añades monstruos, objetos, conjuros y más cosas (especies, dotes…).</p><ul><li><strong>＋ nuevo</strong>: rellenas un formulario.</li><li><strong>⧉ copiar</strong> uno del SRD y cambiarlo, para tu versión.</li><li><strong>📋 pegar un bloque</strong> copiado de D&amp;D Beyond o de un PDF: el formulario se rellena solo.</li><li><strong>⬆ importar</strong> muchos a la vez con la plantilla.</li></ul><p>Luego salen en el bestiario, los encuentros, la tienda, los conjuros y el buscador, con «🛠️ tuyo». Su primera pestaña, <strong>❓ cómo añadir</strong>, lo explica paso a paso.</p>"],
        "🛡️ Modo party": ["<p><strong>🧝 Fichas de la party</strong>: elige un personaje arriba y su ficha se abre como un libro. Al lado de cada uno, <strong>✎</strong> edita su ficha y <strong>🗑</strong> lo quita; <strong>＋</strong> añade otro y <strong>📥</strong> lo trae de D&amp;D Beyond o Nivel20 (y se recuerda de dónde, para actualizarlo).</p><ul><li>La tarjeta: retrato, <strong>PG</strong> (se cambian ahí mismo), CA y características.</li><li>Las secciones: historia, la ficha (combate, habilidades, acciones, conjuros, inventario, rasgos), sus <strong>criaturas</strong> (compañeros y monturas, con su perfil del bestiario), PNJ y notas, <strong>imágenes</strong>, extra y lo del máster.</li><li>También está en <strong>🧰 → mesa</strong>, para ponerla en un tablero.</li></ul><p>Y el modo <strong>📝 notas</strong>: tus documentos y seis post-its.</p>", "<p><strong>🧝 Fichas de la party</strong>: elige un personaje arriba y su ficha se abre como un libro.</p><ul><li>La tarjeta: retrato, <strong>PG</strong> (se cambian ahí mismo), CA y características.</li><li>Las secciones: historia, la ficha (combate, habilidades, acciones, conjuros, inventario, rasgos), sus <strong>criaturas</strong> (compañeros y monturas, con su perfil del bestiario), PNJ y notas, <strong>imágenes</strong>, extra y lo del máster.</li><li>También está en <strong>🧰 → mesa</strong>, para ponerla en un tablero.</li></ul><p>Y el modo <strong>📝 notas</strong>: tus documentos y seis post-its.</p>"]
    };
    const TUTORIAL_ORDENADOR = [
        [ocT("👋 Bienvenida"), "amarillo", ocT("<p>Esto es tu <strong>pantalla de máster</strong>: un tablero con ventanas que pones, mueves y quitas a tu gusto.</p><ul><li>Las <strong>pestañas de arriba</strong> son tus tableros (por ejemplo, uno para combate y otro para la ciudad).</li><li>Cada ventana es una herramienta: la iniciativa, el bestiario, las reglas, notas…</li><li>Este tablero es el tutorial: cuando ya no lo necesites, quítalo con <strong>✎</strong> (arriba, junto a las pestañas).</li></ul>")],
        [ocT("🪟 Las ventanas"), "celeste", ocT("<ul><li><strong>Toca la barra</strong> de una ventana para plegarla o desplegarla.</li><li><strong>Mantén pulsada la barra</strong> y arrastra para moverla.</li><li>La esquina de abajo a la derecha cambia su <strong>tamaño</strong>.</li><li><strong>✎</strong> le cambia el nombre, el color y el tamaño de la letra; <strong>−</strong> la pliega y <strong>✕</strong> la quita.</li><li>Suelta una ventana sobre la barra de otra y se <strong>juntan en pestañas</strong>; ⇱ la vuelve a sacar.</li></ul>")],
        [ocT("🗂️ Tableros y campañas"), "verde", ocT("<ul><li><strong>＋</strong> (junto a las pestañas) crea un tablero nuevo, vacío o desde una plantilla; <strong>✎</strong> cambia el de ahora: nombre, colores o quitarlo.</li><li>Mantén pulsada una pestaña para <strong>cambiarla de sitio</strong>.</li><li><strong>📚</strong> son tus campañas: cada una con sus tableros, su party y sus documentos, sin mezclarse.</li></ul>")],
        [ocT("🧰 Añadir herramientas"), "naranja", ocT("<p>El botón <strong>🧰</strong> (arriba a la izquierda) abre todas las ventanas que puedes poner, por grupos:</p><ul><li><strong>combate</strong>: iniciativa, condiciones, encuentros…</li><li><strong>▶️ turno a turno</strong>: los turnos y la criatura del turno.</li><li><strong>consulta</strong>: reglas, conjuros, bestiario, tienda…</li><li><strong>mesa</strong>: la party, las fichas de la party, sonido ambiente, efectos de sonido, música…</li><li><strong>mundo</strong>: generadores de nombres, PNJ, dungeons, negocios, botín…</li><li><strong>apuntes</strong>: post-its, dibujo, documentos…</li></ul>")],
        [ocT("🔍 Buscar, crear y ajustes"), "morado", ocT("<ul><li>El <strong>buscador</strong> de arriba encuentra conjuros, monstruos, reglas, objetos, rasgos, dotes y habilidades a la vez (también lo que añadas tú).</li><li><strong>⚙</strong>: zoom, ordenar o quitar ventanas, atajos y las <strong>copias de seguridad</strong> (exportar e importar).</li><li><strong>Aa</strong>: tamaño del texto, letra más legible, los temas de color y el <strong>🌐 idioma</strong>.</li></ul>")],
        [ocT("🛠️ Crear contenido nuevo"), "turquesa", ocT("<p>El botón <strong>🛠️</strong> (arriba a la izquierda, junto a 📚) abre el <strong>compendio</strong>: ahí añades monstruos, objetos, conjuros y más cosas (especies, dotes…).</p><ul><li><strong>＋ nuevo</strong>: rellenas un formulario.</li><li><strong>⧉ copiar</strong> uno del SRD y cambiarlo, para tu versión.</li><li><strong>📋 pegar un bloque</strong> copiado de D&amp;D Beyond o de un PDF: el formulario se rellena solo.</li><li><strong>⬆ importar</strong> muchos a la vez con la plantilla.</li></ul><p>Arriba a la derecha eliges qué hacer: <strong>＋ añadir</strong>, <strong>✎ editar</strong> lo que ya hay (también lo del SRD: se guarda tu versión) o <strong>🗑️ borrar</strong> (lo del SRD se puede recuperar), con lo tuyo por categorías. Al guardar, eliges su <strong>categoría</strong> (de qué libro).</p><p>Luego salen en el bestiario, los encuentros, la tienda, los conjuros y el buscador, con «🛠️ tuyo». Su primera pestaña, <strong>❓ cómo añadir</strong>, lo explica paso a paso.</p>")],
        [ocT("🎲 Los dados"), "rosa", ocT("<ul><li>El <strong>botón redondo</strong> de abajo a la derecha (o la tecla <strong>D</strong>) abre los dados; pulsándolo otra vez se pliegan.</li><li>Toca los dados que quieras, pon el modificador y <strong>tirar</strong>. Con ventaja o desventaja, el d20 se tira dos veces.</li><li>Las últimas tiradas quedan debajo, para repetirlas.</li><li>En las fichas, los números con dados también se tiran tocándolos: prueba aquí con 1d20+5.</li></ul>")],
        [ocT("💾 Tus datos"), "gris", ocT("<ul><li>Todo lo que haces se guarda <strong>sólo en este dispositivo</strong>: no se sube a ningún sitio.</li><li>Si borras los datos del navegador, se pierde: haz de vez en cuando una copia con <strong>⚙ → exportar</strong>.</li><li>Para llevarlo a otro dispositivo: exportar aquí e <strong>importar</strong> allí.</li></ul>")],
        [ocT("⌨️ Atajos"), "azul", ocT("<p>Con teclado va todo más rápido (pulsa <strong>?</strong> para verlos todos):</p><ul><li><strong>/</strong> buscar · <strong>A</strong> añadir una ventana · <strong>N</strong> post-it nuevo</li><li><strong>D</strong> dados · <strong>I</strong> iniciativa · <strong>C</strong> campañas</li><li><strong>[</strong> y <strong>]</strong> tablero anterior y siguiente</li><li><strong>+</strong> y <strong>−</strong> zoom del tablero</li></ul>")],
        ...TARJETAS_MODOS,
    ];
    const TUTORIAL_TABLETA = [
        [ocT("👋 Bienvenida"), "amarillo", ocT("<p>Esto es tu <strong>pantalla de máster</strong>: un tablero con ventanas que pones, mueves y quitas a tu gusto.</p><ul><li>Las <strong>pestañas de arriba</strong> son tus tableros (uno para combate, otro para la ciudad…); desliza la fila con el dedo para ver todas.</li><li>Cada ventana es una herramienta: la iniciativa, el bestiario, las reglas, notas…</li><li>Este tablero es el tutorial: cuando ya no lo necesites, quítalo con <strong>✎</strong> (arriba, junto a las pestañas).</li></ul>")],
        [ocT("✋ Con el dedo"), "celeste", ocT("<ul><li><strong>Desliza</strong> para moverte por el tablero; con <strong>dos dedos</strong>, pellizcando, lo acercas o lo alejas (también en los dibujos).</li><li><strong>Toca la barra</strong> de una ventana para plegarla o desplegarla.</li><li>Para moverla, <strong>deja el dedo quieto en su barra</strong> hasta que la tablet vibre y la barra se marque, y arrastra.</li><li>La <strong>esquina de abajo a la derecha</strong> cambia su tamaño.</li><li>Suelta una ventana sobre la barra de otra y se <strong>juntan en pestañas</strong>; ⇱ la vuelve a sacar.</li><li><strong>✎</strong> le cambia el nombre, el color y la letra; <strong>−</strong> la pliega y <strong>✕</strong> la quita. El botón <strong>atrás</strong> cierra lo que tengas abierto.</li></ul>")],
        [ocT("🗂️ Tableros y campañas"), "verde", ocT("<ul><li><strong>＋</strong> (junto a las pestañas) crea un tablero nuevo, vacío o desde una plantilla; <strong>✎</strong> cambia el de ahora: nombre, colores o quitarlo.</li><li>Deja el dedo sobre una pestaña para <strong>cambiarla de sitio</strong>.</li><li><strong>📚</strong> son tus campañas: cada una con sus tableros, su party y sus documentos, sin mezclarse.</li></ul>")],
        TUTORIAL_ORDENADOR[3],
        [ocT("🔍 Buscar, crear y ajustes"), "morado", ocT("<ul><li>El <strong>buscador</strong> de arriba encuentra conjuros, monstruos, reglas, objetos, rasgos, dotes y habilidades a la vez (también lo que añadas tú).</li><li><strong>⚙</strong>: zoom, ordenar o quitar ventanas, las <strong>copias de seguridad</strong>, dónde se guarda, que la pantalla no se apague y buscar actualizaciones.</li><li><strong>Aa</strong>: tamaño del texto, letra más legible, los temas de color y el <strong>🌐 idioma</strong>.</li></ul>")],
        TUTORIAL_ORDENADOR[5],
        [ocT("🎲 Los dados"), "rosa", ocT("<ul><li>El <strong>botón redondo</strong> de abajo a la derecha abre los dados; tocándolo otra vez se pliegan.</li><li>Toca los dados que quieras, pon el modificador y <strong>tirar</strong>. Con ventaja o desventaja, el d20 se tira dos veces.</li><li>Las últimas tiradas quedan debajo, para repetirlas.</li><li>En las fichas, los números con dados también se tiran tocándolos: prueba aquí con 1d20+5.</li></ul>")],
        [ocT("💾 Tus datos"), "gris", ocT("<ul><li>Todo se guarda <strong>sólo en esta tablet</strong>: no se sube a ningún sitio.</li><li>Dentro de la app, si la desinstalas, se pierde. Mejor en una <strong>carpeta</strong> (⚙ → dónde se guarda): sigue ahí, se puede copiar al ordenador y la app deja una copia al día.</li><li>Haz de vez en cuando una copia con <strong>⚙ → exportar</strong>; para llevarlo a otro sitio, <strong>importar</strong> allí.</li><li>Desde otras apps, <strong>Compartir</strong> o <strong>Abrir con</strong> trae copias, imágenes, PDF y audios.</li></ul>")],
        [ocT("📺 En la mesa"), "azul", ocT("<ul><li>La <strong>pantalla de jugadores</strong> sale en la tele o el monitor si los conectas por cable; si no, en otra ventana, al lado si cabe.</li><li>La <strong>música</strong> sigue sonando aunque dejes la app detrás o apagues la pantalla, y los botones de volumen son los suyos.</li><li>Mientras la app está a la vista, <strong>la pantalla no se apaga</strong> (se cambia en ⚙).</li></ul>")],
        ...TARJETAS_MODOS,
    ];
    const TUTORIAL = EN_ANDROID ? TUTORIAL_TABLETA : TUTORIAL_ORDENADOR;
    // Los tableros de tutorial de antes: la nota nueva del compendio, y la
    // de «buscar» sin lo del ＋ de al lado del buscador (que ya no está).
    function ponerAlDiaTutorial() {
        const nueva = TUTORIAL.find((t) => t[0] === ocT("🛠️ Crear contenido nuevo"));
        const buscar = TUTORIAL.find((t) => t[0] === ocT("🔍 Buscar, crear y ajustes"));
        let algo = false;
        todas.campanas.forEach((c) => c.perfiles.filter((pf) => pf.nombre === "📖 tutorial").forEach((pf) => {
            // En la app de Android, las tarjetas del de ordenador que siguen
            // como venían pasan a las de la tableta (las tocadas, no).
            if (EN_ANDROID) {
                pf.modulos.forEach((m) => {
                    const i = m.tipo === "tarjeta" && m.datos ? TUTORIAL_ORDENADOR.findIndex((t) => t[2] === m.datos.html) : -1;
                    if (i >= 0 && TUTORIAL_TABLETA[i] !== TUTORIAL_ORDENADOR[i]) {
                        [m.titulo, m.color, m.datos.html] = TUTORIAL_TABLETA[i];
                        algo = true;
                    }
                });
            }
            pf.modulos.filter((m) => m.tipo === "tarjeta" && m.titulo === ocT("🔍 Buscar, crear y ajustes") && m.datos
                && /tus\s+creaciones/.test(m.datos.html || "")).forEach((m) => {
                m.datos.html = buscar[2];
                algo = true;
            });
            // Las que siguen como venían, a lo de ahora.
            pf.modulos.forEach((m) => {
                const viejas = m.tipo === "tarjeta" && m.datos && TUTORIAL_VIEJO[m.titulo];
                const ahora = viejas && viejas.includes(m.datos.html) && TUTORIAL.find((t) => t[0] === ocT(m.titulo));
                if (ahora) {
                    [m.titulo, m.color, m.datos.html] = ahora;
                    if (TARJETAS_MODOS.includes(ahora)) {
                        m.h = Math.max(m.h, ALTO_MODOS);
                    }
                    algo = true;
                }
            });
            // Las que faltan, en una fila debajo de todo.
            const y = Math.max(0, ...pf.modulos.map((m) => m.y + m.h)) + 20;
            let x = 10;
            [nueva, ...TARJETAS_MODOS].forEach((t) => {
                if (t && !pf.modulos.some((m) => m.titulo === t[0])) {
                    pf.modulos.push({ id: "m" + siguienteId++, tipo: "tarjeta", x, y, w: 410,
                        h: TARJETAS_MODOS.includes(t) ? ALTO_MODOS : 540, titulo: t[0],
                        color: t[1], plegado: false, escala: 1, datos: { html: t[2] } });
                    x += 430;
                    algo = true;
                }
            });
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
            // En filas de cuatro (en la tableta, de tres: lo que cabe).
            modulos: TUTORIAL.map(([titulo, color, html], i) => ({ tipo: "tarjeta", x: (i % (EN_ANDROID ? 3 : 4)) * 430,
                y: Math.floor(i / (EN_ANDROID ? 3 : 4)) * 560,
                w: 410, h: TARJETAS_MODOS.includes(TUTORIAL[i]) ? ALTO_MODOS : 540, titulo, color, plegado: false, escala: 1,
                datos: { html } })) };
    }
    // Una campaña nueva: el tutorial y luego las plantillas de tableros.
    function crearCampana(nombre, unidades, edicion) {
        const c = { id: "c" + siguienteCampana++, nombre: nombre || ocT("campaña {n}", { n: todas.campanas.length + 1 }), pjs: [],
            unidades: unidades === "metrico" ? "metrico" : "imperial", edicion: edicion === "2014" ? "2014" : "2024",
            perfiles: [perfilTutorial()].concat(perfilesDeSerie()).map((pf) => Object.assign(pf, { id: "p" + siguientePerfil++,
                modulos: pf.modulos.map((m) => Object.assign(m, { id: "m" + siguienteId++ })) })) };
        c.activo = c.perfiles[0].id;
        c.conParty = true;
        c.modos = modosDeSerie().map((mo) => Object.assign(mo, { id: "o" + siguienteModo++,
            modulos: mo.modulos.map((m) => Object.assign(m, { id: "m" + siguienteId++ })) }));
        c.conModos = true;
        return c;
    }

    // ---- LAS MEDIDAS DE CADA CAMPAÑA: imperial (pies, libras, millas:
    // como vienen el SRD y las tablas) o métrico (metros, kilos y
    // kilómetros, con la equivalencia de los manuales en español: 5 pies =
    // 1,5 m, 1 libra = 0,5 kg, 1 milla = 1,5 km). Va en la campaña
    // («unidades»: "imperial" o "metrico"; sin ella, imperial). Se elige al
    // crearla y se cambia en ⚙ opciones.
    // En métrico no se toca ningún dato: lo que se pinta en la pantalla se
    // pasa al vuelo (un MutationObserver sobre la página), y al volver a
    // imperial se deja como estaba. Lo que escribes tú (las notas, los
    // campos) no se toca nunca. ----
    const MEDIDAS = [["imperial", ocT("📏 imperial: pies, libras y millas")], ["metrico", ocT("📐 métrico: metros, kilos y kilómetros")]];
    const unidadesDe = (c) => (c && c.unidades === "metrico" ? "metrico" : "imperial");
    // (Sin una letra, un número ni una coma delante: «2d4 pies» se queda.)
    const NUM = "\\d+(?:[.,]\\d+)*";
    const SUELTO = "(?<![\\w.,])";
    const RE_PIES = new RegExp(SUELTO + "(" + NUM + "(?:\\s*(?:\\/|×|x|por)\\s*" + NUM + ")*)(\\s*)(?:ft\\.?(?![a-záéíóúñ])|pies\\b|pie\\b)", "gi");
    const RE_LIBRAS = new RegExp(SUELTO + "(" + NUM + ")(\\s*)(?:lb\\.?(?![a-záéíóúñ])|libras?\\b)", "gi");
    const RE_MILLAS = new RegExp(SUELTO + "(" + NUM + ")(\\s*)millas?\\b", "gi");
    function numeroLeido(x) {
        if (x.indexOf(",") >= 0) {
            return parseFloat(x.replace(/\./g, "").replace(",", "."));
        }
        return /^\d{1,3}(\.\d{3})+$/.test(x) ? parseFloat(x.replace(/\./g, "")) : parseFloat(x);
    }
    const numeroEscrito = (n) => n.toLocaleString(window.ocLocale, { maximumFractionDigits: 2 });
    const pasarNumeros = (grupo, por) => grupo.replace(new RegExp(NUM, "g"), (x) => numeroEscrito(numeroLeido(x) * por));
    function aMetrico(texto) {
        return texto.replace(RE_PIES, (x, n, esp) => pasarNumeros(n, 0.3) + (esp || " ") + "m")
            .replace(RE_LIBRAS, (x, n, esp) => pasarNumeros(n, 0.5) + (esp || " ") + "kg")
            .replace(RE_MILLAS, (x, n, esp) => pasarNumeros(n, 1.5) + (esp || " ") + "km");
    }
    // Los textos pasados: nodo → [lo de antes, lo de ahora].
    const pasados = new Map();
    let enMetrico = false;
    // (Ni lo que habla de las propias medidas: data-sin-medidas.)
    const NO_TOCAR = "script, style, textarea, [contenteditable], .master-entrada, .ajustes, [data-sin-medidas]";
    function pasarNodo(n) {
        const ya = pasados.get(n);
        if (ya && n.data === ya[1]) {
            return;
        }
        if (!/\d/.test(n.data) || !n.parentElement || n.parentElement.closest(NO_TOCAR)) {
            return;
        }
        const nuevo = aMetrico(n.data);
        if (nuevo !== n.data) {
            pasados.set(n, [n.data, nuevo]);
            n.data = nuevo;
        }
    }
    function pasarDentro(raiz) {
        if (raiz.nodeType === 3) {
            pasarNodo(raiz);
            return;
        }
        if (raiz.nodeType !== 1 || raiz.closest(NO_TOCAR)) {
            return;
        }
        const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
        const nodos = [];
        while (w.nextNode()) {
            nodos.push(w.currentNode);
        }
        nodos.forEach(pasarNodo);
    }
    const vigilante = new MutationObserver((cambios) => {
        cambios.forEach((c) => {
            if (c.type === "characterData") {
                pasarNodo(c.target);
            } else {
                c.addedNodes.forEach(pasarDentro);
            }
        });
    });
    const EDICIONES = [["2024", ocT("📕 2024 (D&D de 2024, SRD 5.2)")], ["2014", ocT("📗 2014 (D&D de 2014, SRD 5.1)")]];
    const edicionDe = (c) => (c && c.edicion === "2014" ? "2014" : "2024");
    // Al cambiar de edición: las reglas, el buscador y las ventanas, otra vez.
    function aplicarEdicion() {
        const e = edicionDe(todo);
        document.documentElement.dataset.edicion = e;
        window.ocReglas.usarEdicion(e);
        if (e === edicionAhora) {
            return;
        }
        edicionAhora = e;
        indice = null;
        estado.modulos.forEach((m) => {
            m.el = null;
        });
        pintarTodo();
    }
    function aplicarUnidades() {
        const metrico = unidadesDe(todo) === "metrico";
        document.documentElement.dataset.unidades = metrico ? "metrico" : "imperial";
        if (metrico === enMetrico) {
            return;
        }
        enMetrico = metrico;
        if (metrico) {
            pasarDentro(document.body);
            vigilante.observe(document.body, { childList: true, subtree: true, characterData: true });
        } else {
            vigilante.disconnect();
            pasados.forEach(([antes, ahora], n) => {
                if (n.isConnected && n.data === ahora) {
                    n.data = antes;
                }
            });
            pasados.clear();
        }
    }
    // Elegir las medidas o la edición (al crear una campaña): las opciones,
    // sin ninguna marcada, para que se elija. .valor() da la elegida o "".
    const elegirUnidades = (id) => elegirUna(id, ocT("¿qué medidas usáis?"), MEDIDAS);
    const elegirEdicion = (id) => elegirUna(id, ocT("¿con qué reglas jugáis?"), EDICIONES);
    function elegirUna(id, leyenda, opciones) {
        const caja = crear("fieldset", "master-unidades");
        caja.appendChild(crear("legend", "oc-dados-etiqueta", leyenda));
        const radios = opciones.map(([v, texto]) => {
            const et = crear("label", "master-unidades-opcion");
            const r = crear("input");
            r.type = "radio";
            r.name = id;
            r.value = v;
            r.id = id + "-" + v;
            et.htmlFor = r.id;
            et.append(r, document.createTextNode(" " + texto));
            caja.appendChild(et);
            return r;
        });
        caja.valor = () => (radios.find((r) => r.checked) || {}).value || "";
        caja.foco = () => radios[0].focus();
        return caja;
    }

    // LICENCIAS Y CRÉDITOS: lo que hay que decir del SRD, los sonidos, las
    // letras y la propia app. Salen en la entrada y en ⚙ opciones, con
    // enlaces para verlas en la web.
    const CREDITOS = [
        [ocT("📖 Reglas, monstruos, conjuros, objetos, rasgos y dotes"), ocT("Este trabajo incluye material del System Reference Document 5.2 («SRD 5.2») de Wizards of the Coast LLC, disponible en dndbeyond.com/srd. El SRD 5.2 tiene licencia Creative Commons Reconocimiento 4.0 Internacional (CC BY 4.0). Está traducido al español: no es una traducción oficial. Los rasgos y dotes se han preparado a partir de 5e-bits/5e-database (MIT)."),
        [[ocT("el SRD 5.2"), "https://www.dndbeyond.com/srd"], [ocT("la licencia CC BY 4.0"), "https://creativecommons.org/licenses/by/4.0/deed.es"],
            ["5e-database", "https://github.com/5e-bits/5e-database"]]],
        [ocT("📗 Reglas, monstruos, conjuros y objetos de 2014"), ocT("Esta obra incluye materiales extraídos del Documento de referencia del sistema 5.1 («SRD 5.1») de Wizards of the Coast LLC, que está disponible en https://dnd.wizards.com/es/resources/systems-reference-document. El SRD 5.1 tiene la licencia Creative Commons Atribución/Reconocimiento 4.0 Licencia Pública Internacional, que está disponible en https://creativecommons.org/licenses/by/4.0/legalcode.es."),
        [[ocT("el SRD 5.1"), "https://dnd.wizards.com/es/resources/systems-reference-document"],
            [ocT("la licencia CC BY 4.0"), "https://creativecommons.org/licenses/by/4.0/legalcode.es"]]],
        [ocT("🇬🇧 El compendio en inglés"), ocT("En inglés, las reglas, los monstruos, los conjuros, los objetos y los rasgos son el texto original del SRD 5.2 y del SRD 5.1 de Wizards of the Coast LLC (CC BY 4.0), sacado de los datos de open5e, del SRD 5.2.1 reForged y de 5e-bits/5e-database (MIT). Las tablas propias de la app están traducidas a mano."),
        [["open5e", "https://github.com/open5e/open5e-api"], ["SRD 5.2.1 reForged", "https://github.com/oldmanumby/dnd.srd.5.2"],
            ["5e-database", "https://github.com/5e-bits/5e-database"], [ocT("la licencia CC BY 4.0"), "https://creativecommons.org/licenses/by/4.0/deed.es"]]],
        [ocT("🔊 Sonidos"), ocT("Las grabaciones de sonido ambiente y efectos (cuando vienen con la app) son de la Google Sound Library, con licencia CC BY 4.0. Tus propios audios son tuyos y se quedan en tu dispositivo."),
        [[ocT("Google Sound Library"), "https://developers.google.com/assistant/tools/sound-library"],
            [ocT("la licencia CC BY 4.0"), "https://creativecommons.org/licenses/by/4.0/deed.es"]]],
        [ocT("🔤 Tipografías"), ocT("Space Grotesk, DM Mono, Jersey 10, Pangolin, Patrick Hand, Caveat, Inter, Pixelify Sans, VT323, Atkinson Hyperlegible y Noto, con licencia SIL Open Font License 1.1."), [[ocT("la licencia OFL"), "https://openfontlicense.org"]]],
        [ocT("🧩 La app"), ocT("Pantalla de máster, de Richi (rperezbarreda). El código tiene licencia MIT. Dungeons & Dragons y D&D son marcas de Wizards of the Coast; esta app no está afiliada ni respaldada por ellos."),
        [[ocT("la licencia MIT"), "https://opensource.org/license/mit"]]]
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
                a.setAttribute("aria-label", ocT("Ver {nombre} en la web (se abre aparte)", { nombre: nombre }));
                fila.appendChild(a);
            });
            sec.appendChild(fila);
            cuerpo.appendChild(sec);
        });
        return cuerpo;
    }
    function verCreditos(vuelta) {
        window.ocVentana.abrir({ titulo: ocT("licencias y créditos"), cuerpo: cuerpoCreditos(), vuelta, clase: "es-ancha" });
    }

    // LOS IDIOMAS EN LA ENTRADA: una banderita por idioma (los de
    // idiomas/lista.json). El que aún no tiene nada traducido no cambia:
    // avisa de que falta la traducción y de cómo ayudar con ella.
    const IDIOMA_EN_CASTELLANO = { es: ocT("castellano"), ca: ocT("catalán"), eu: ocT("euskera"), gl: ocT("gallego"), en: ocT("inglés") };
    const TRADUCCIONES_URL = "https://github.com/rperezbarreda/pantalla_master/tree/main/traducciones";
    // La bandera de un idioma (el dibujo está en ajustes.js: también la
    // usa Aa).
    const banderaDe = (codigo) => window.ocBandera(codigo);
    function idiomasDeEntrada(entrada) {
        const caja = crear("div", "master-entrada-idiomas");
        caja.setAttribute("role", "group");
        caja.setAttribute("aria-label", ocT("Idioma de la app"));
        const ahora = window.ocIdioma ? window.ocIdioma.codigo : "es";
        const pintar = (lista) => {
            caja.replaceChildren(...lista.map((x) => {
                const b = botonDe("master-entrada-idioma", "", () => elegirIdiomaEntrada(x, ahora, entrada, b));
                b.setAttribute("aria-pressed", x.codigo === ahora ? "true" : "false");
                const nombre = crear("span", "", x.nombre);
                nombre.lang = x.codigo;
                b.append(banderaDe(x.codigo), nombre);
                return b;
            }));
        };
        pintar([{ codigo: "es", nombre: "Castellano", interfaz: 100 }, { codigo: "ca", nombre: "Català", interfaz: 0 },
            { codigo: "en", nombre: "English", interfaz: 100 }, { codigo: "eu", nombre: "Euskara", interfaz: 0 },
            { codigo: "gl", nombre: "Galego", interfaz: 0 }]);
        fetch("idiomas/lista.json").then((r) => (r.ok ? r.json() : null)).then((lista) => {
            if (Array.isArray(lista) && lista.length) {
                pintar(lista.filter((x) => x && typeof x.codigo === "string" && typeof x.nombre === "string"));
            }
        }).catch(() => {});
        return caja;
    }
    function elegirIdiomaEntrada(x, ahora, entrada, boton) {
        if (x.codigo === ahora) {
            return;
        }
        if (x.codigo !== "es" && !(x.interfaz > 0)) {
            avisoSinTraducir(x, entrada, boton);
            return;
        }
        try {
            if (x.codigo === "es") {
                localStorage.removeItem("richi-idioma");
            } else {
                localStorage.setItem("richi-idioma", x.codigo);
            }
        } catch (e) {
            return;
        }
        avisar(ocT("Cambiando de idioma…"));
        const almacen = window.ocAlmacen;
        (almacen && almacen.guardarYa ? almacen.guardarYa().catch(() => null) : Promise.resolve()).then(() => location.reload());
    }
    // El aviso de que un idioma aún no está traducido, encima de la entrada.
    function avisoSinTraducir(x, entrada, volverA) {
        const idioma = IDIOMA_EN_CASTELLANO[x.codigo] || x.nombre;
        const fondo = crear("div", "master-entrada master-aviso-web");
        fondo.setAttribute("role", "alertdialog");
        fondo.setAttribute("aria-modal", "true");
        fondo.setAttribute("aria-labelledby", "master-sin-traducir-titulo");
        fondo.setAttribute("aria-describedby", "master-sin-traducir-texto");
        const caja = crear("div", "master-entrada-caja");
        const titulo = crear("h2", "master-entrada-titulo", ocT("Todavía sin traducir"));
        titulo.id = "master-sin-traducir-titulo";
        titulo.prepend(banderaDe(x.codigo), " ");
        const texto = crear("div");
        texto.id = "master-sin-traducir-texto";
        const correo = crear("a", "", "contacto@richi.blog");
        correo.href = "mailto:contacto@richi.blog";
        const partes = ocT("Para cualquier duda o para colaborar, escríbeme a {correo}.").split("{correo}");
        const pCorreo = crear("p", "master-entrada-texto", partes[0]);
        pCorreo.append(correo, partes.slice(1).join(""));
        texto.append(
            crear("p", "master-entrada-texto", ocT("La traducción al {idioma} aún no está hecha: de momento, la app sólo está en castellano.", { idioma })),
            crear("p", "master-entrada-texto", ocT("Si quieres ayudar a traducirla, usa las herramientas de la propia app: en Aa → 🌐 idioma eliges el idioma y, con «🧪 probar un archivo de traducción…», ves tu traducción en la app mientras la haces.")),
            crear("p", "master-entrada-texto", ocT("Toda ayuda es bienvenida: no conozco estos idiomas y no quiero usar traducciones automáticas.")),
            pCorreo);
        const ayuda = crear("a", "oc-vida-accion", ocT("📖 cómo ayudar a traducir"));
        ayuda.href = TRADUCCIONES_URL;
        ayuda.target = "_blank";
        ayuda.rel = "noopener noreferrer";
        ayuda.setAttribute("aria-label", ocT("Cómo ayudar a traducir la app (se abre aparte, en GitHub)"));
        const vale = botonDe("oc-vida-accion es-principal", ocT("entendido"), () => cerrar());
        const botones = crear("div", "master-anadir-otras");
        botones.append(vale, ayuda);
        caja.append(titulo, texto, botones);
        fondo.appendChild(caja);
        entrada.inert = true;
        function cerrar() {
            entrada.inert = false;
            fondo.remove();
            if (volverA && volverA.focus) {
                volverA.focus();
            }
        }
        fondo.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cerrar();
            } else if (e.key === "Tab") {
                const cosas = [correo, vale, ayuda];
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
        fondo.addEventListener("click", (e) => {
            if (e.target === fondo) {
                cerrar();
            }
        });
        document.body.appendChild(fondo);
        vale.focus();
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
        const titulo = crear("h2", "master-entrada-titulo", ocT("Pantalla de máster"));
        titulo.id = "master-entrada-titulo";
        caja.append(icono, titulo, idiomasDeEntrada(fondo));
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
                avisar(ocT("Campaña: {nombre}.", { nombre: c.nombre }));
            }
            const p = document.getElementById("master-pestana-" + estado.id);
            (p || botonCampana).focus();
        }
        if (!sinGuardarTodavia) {
            caja.appendChild(crear("p", "master-entrada-texto", ocT("¿Con qué campaña jugáis hoy?")));
            const ul = crear("ul", "master-entrada-lista");
            ul.setAttribute("aria-label", ocT("Tus campañas"));
            todas.campanas.forEach((c) => {
                const li = crear("li");
                const b = botonDe("master-entrada-campana", "", () => entrar(c));
                b.append(crear("span", "master-entrada-nombre", "📚 " + c.nombre), crear("span", "master-entrada-detalle",
                    c.perfiles.length + (c.perfiles.length === 1 ? ocT(" tablero") : ocT(" tableros")) + " · " + c.pjs.length
                    + (c.pjs.length === 1 ? ocT(" personaje") : ocT(" personajes")) + (c === todo ? ocT(" · la última") : "")));
                li.appendChild(b);
                ul.appendChild(li);
            });
            caja.appendChild(ul);
        } else {
            caja.appendChild(crear("p", "master-entrada-texto", ocT("¡Hola! Para empezar, crea tu primera campaña: ponle el nombre que quieras (lo puedes cambiar luego).")));
        }
        const form = crear("form", "master-entrada-form");
        const et = crear("label", "oc-dados-etiqueta", sinGuardarTodavia ? ocT("nombre de la campaña") : ocT("o crea una nueva"));
        const input = crear("input", "oc-dados-texto");
        input.id = "master-entrada-nombre";
        input.maxLength = 40;
        input.autocomplete = "off";
        input.placeholder = ocT("La maldición de la torre, Los de los martes…");
        if (sinGuardarTodavia) {
            input.required = true;
            input.setAttribute("aria-required", "true");
        }
        et.htmlFor = input.id;
        const crearB = crear("button", "oc-vida-accion es-principal", ocT("＋ crear y empezar"));
        crearB.type = "submit";
        const medidas = elegirUnidades("master-entrada-unidades");
        const edicion = elegirEdicion("master-entrada-edicion");
        form.append(et, input, edicion, medidas, crearB, crear("p", "oc-hoja-nota", ocT("Viene con un tablero de tutorial que explica las opciones, y con tableros de ejemplo para combate, tiendas, PNJ…")));
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const n = input.value.trim();
            if (!n) {
                avisar(ocT("Ponle un nombre a la campaña."));
                input.focus();
                return;
            }
            if (!edicion.valor()) {
                avisar(ocT("Elige con qué reglas jugáis: las de 2024 o las de 2014. Se puede cambiar luego en ⚙ opciones."));
                edicion.foco();
                return;
            }
            if (!medidas.valor()) {
                avisar(ocT("Elige qué medidas usáis: imperial (pies) o métrico (metros). Se puede cambiar luego en ⚙ opciones."));
                medidas.foco();
                return;
            }
            const c = crearCampana(n, medidas.valor(), edicion.valor());
            if (sinGuardarTodavia) {
                todas.campanas = [c];
                sinGuardarTodavia = false;
            } else {
                todas.campanas.push(c);
            }
            entrar(c);
            avisar(ocT("Campaña creada: {n}. Empieza por el tablero «tutorial».", { n: n }));
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
            const traerB = botonDe("oc-vida-accion", ocT("📥 traer lo de antes"), () => {
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
                        avisar(ocT("No se ha podido traer todo."));
                    });
            });
            caja2.append(crear("p", "oc-hoja-nota", EN_ANDROID
                ? ocT("Esta app tiene guardado lo de antes de elegir la carpeta (dentro de la app). La carpeta empieza vacía; si quieres seguir con aquello, tráelo aquí:")
                : ocT("Este ordenador tiene guardado lo de una versión anterior de la pantalla (en el navegador). Esta carpeta empieza vacía; si quieres seguir con aquello, tráelo aquí:")), traerB);
            caja.appendChild(caja2);
        }
        if (sinGuardarTodavia) {
            const traer = crear("div", "master-entrada-traer");
            traer.append(crear("p", "oc-hoja-nota", ocT("¿Tienes una copia de seguridad (de esta app o de la pantalla de máster del blog)? Impórtala:")), copias(() => {}));
            traer.querySelectorAll("button").forEach((b) => {
                if (/exportar/.test(b.textContent)) {
                    b.remove();
                }
            });
            caja.appendChild(traer);
        }
        // En la app de Android, guardando dentro de ella (se pierde al
        // desinstalarla): si la última copia es de hace más de dos semanas
        // (o no hay ninguna), se recuerda.
        if (EN_ANDROID && !EN_CARPETA && !sinGuardarTodavia) {
            let c = {};
            try {
                c = JSON.parse(localStorage.getItem(CLAVE_COPIA) || "{}") || {};
                if (!c.desde) {
                    c.desde = Date.now();
                    localStorage.setItem(CLAVE_COPIA, JSON.stringify(c));
                }
            } catch (e) {
                c = {};
            }
            const dias = Math.floor((Date.now() - (c.ultima || c.desde || Date.now())) / 86400000);
            if (dias >= 14) {
                const recuerdo = crear("div", "master-entrada-traer");
                const otras = crear("div", "master-anadir-otras");
                otras.append(copias(() => {}).querySelector("button"), botonDe("oc-vida-accion", ocT("📁 guardar en una carpeta"),
                    () => window.ocAndroid.elegirCarpeta()));
                recuerdo.append(crear("p", "oc-hoja-nota", ocT("{n} Lo guardas dentro de la app: si la desinstalas, se pierde. Exporta una copia, o guárdalo en una carpeta (sigue ahí aunque desinstales).", { n: c.ultima ? ocT("💾 Tu última copia de seguridad es de hace {dias} días.", { dias: dias }) : ocT("💾 Aún no has hecho ninguna copia de seguridad.") })),
                otras);
                caja.appendChild(recuerdo);
            }
        }
        caja.appendChild(crear("p", "oc-hoja-nota master-entrada-privado", EN_CARPETA && EN_ANDROID
            ? ocT("🔒 Todo se guarda en tu carpeta «{nombre}», en este dispositivo.", { nombre: window.ocAlmacen.nombre })
            : EN_CARPETA ? ocT("🔒 Todo se guarda en la carpeta «mis-datos», junto al programa.") : ocT("🔒 Todo se guarda sólo en este dispositivo.")));
        // El aviso de licencias, plegado (también en ⚙ opciones).
        const avisoLic = crear("details", "master-entrada-licencias");
        avisoLic.append(crear("summary", "", ocT("📜 Incluye material del SRD 5.2 de Wizards of the Coast (CC BY 4.0) · licencias y créditos")), cuerpoCreditos());
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
        // En la app de Android, la primera vez: antes de nada, la carpeta
        // donde se guarda todo (ordenado y a salvo aunque se desinstale).
        // Hasta elegirla (o decir que dentro de la app), sólo este paso.
        let sinCarpeta = false;
        try {
            sinCarpeta = EN_ANDROID && !EN_CARPETA && sinGuardarTodavia && localStorage.getItem("richi-master-carpeta-no") !== "si";
        } catch (e) {
            sinCarpeta = false;
        }
        if (sinCarpeta) {
            const resto = Array.from(caja.children).filter((x) => x !== icono && x !== titulo && !x.classList.contains("master-entrada-idiomas"));
            resto.forEach((x) => {
                x.hidden = true;
            });
            const paso = crear("div");
            const elegir = botonDe("oc-vida-accion es-principal", ocT("📁 elegir o crear la carpeta"), () => window.ocAndroid.elegirCarpeta());
            const dentro = botonDe("oc-vida-accion", ocT("📱 prefiero guardarlo dentro de la app"), () => {
                try {
                    localStorage.setItem("richi-master-carpeta-no", "si");
                } catch (e) {
                    // Sin guardar: se vuelve a preguntar la próxima vez.
                }
                paso.remove();
                resto.forEach((x) => {
                    x.hidden = false;
                });
                input.focus();
            });
            const botones = crear("div", "master-anadir-otras");
            botones.append(elegir, dentro);
            paso.append(crear("p", "master-entrada-texto", ocT("¡Hola! Antes de empezar, elige una carpeta para guardarlo todo (por ejemplo, «Documentos/Pantalla de máster»): tus campañas, imágenes, PDF y música, ordenados y a salvo aunque desinstales la app. También se puede copiar al ordenador.")),
                botones, crear("p", "oc-hoja-nota", ocT("Si lo guardas dentro de la app, se borra al desinstalarla. Se puede cambiar cuando quieras en ⚙ opciones.")));
            titulo.after(paso);
            elegir.focus();
        } else {
            (fondo.querySelector(".master-entrada-campana") || input).focus();
        }
        if (sinGuardarTodavia) {
            verManifiesto(fondo, () => verAvisoWeb(fondo));
        } else {
            verAvisoWeb(fondo);
        }
    }

    // EL MANIFIESTO: por qué es gratis y libre, y que está hecha con ayuda
    // de la IA. Al final de las opciones y, la primera vez, en una ventana
    // antes de crear la campaña.
    function manifiestoDe() {
        const manifiesto = crear("div", "master-manifiesto");
        [ocT("Esta aplicación es y será siempre **totalmente gratuita**, sin anuncios ni compras, y de **código libre** (licencia MIT). La he programado con ayuda de la inteligencia artificial y no me parece lícito lucrarme con ello."),
            ocT("**No recoge ningún dato**: todo lo que haces se queda en tu dispositivo, sin cuentas, sin rastreadores y sin nada que se suba a ningún sitio."),
            ocT("Está pensada para que la pueda usar **todo el mundo**: con teclado, con lector de pantalla, con el texto más grande y con temas de alto contraste. Si algo no te funciona, dímelo."),
            ocT("Te agradezco mucho que la compartas. Y si quieres aportar algo, lo mejor es que ese dinero vaya a algún **refugio de animales de tu zona**: seguro que le dan mucho mejor uso que yo."),
            ocT("Cualquiera es libre de clonar la aplicación y su código y cambiarlos a su gusto."),
            ocT("Eso sí: aunque la app permite crear y ampliar los compendios, te recomiendo **no publicar contenido de terceros** (manuales, aventuras, suplementos…). La app usa el SRD y las reglas básicas porque son de libre uso.")]
            .forEach((t) => {
                const parrafo = crear("p");
                parrafo.append(...enLinea(t));
                manifiesto.appendChild(parrafo);
            });
        // El correo, con su enlace.
        const correo = crear("a", "", "contacto@richi.blog");
        correo.href = "mailto:contacto@richi.blog";
        const partes = ocT("Ideas, fallos o ganas de colaborar: {correo}.").split("{correo}");
        const contacto = crear("p", "", partes[0]);
        contacto.append(correo, partes.slice(1).join(""));
        manifiesto.appendChild(contacto);
        const firma = crear("p", "master-manifiesto-firma", ocT("— Richi"));
        const codigo = crear("a", "oc-vida-accion", ocT("📂 el código, en GitHub"));
        codigo.href = "https://github.com/rperezbarreda/pantalla_master";
        codigo.target = "_blank";
        codigo.rel = "noopener noreferrer";
        codigo.setAttribute("aria-label", ocT("El código de la app, en GitHub (se abre aparte)"));
        manifiesto.append(firma, codigo);
        return manifiesto;
    }

    // La primera vez (sin nada guardado), antes de crear la campaña: el
    // manifiesto en su ventana, encima de la entrada. Al cerrarla, «despues».
    function verManifiesto(entrada, despues) {
        const volverA = document.activeElement;
        const fondo = crear("div", "master-entrada master-aviso-web");
        fondo.setAttribute("role", "dialog");
        fondo.setAttribute("aria-modal", "true");
        fondo.setAttribute("aria-labelledby", "master-manifiesto-titulo");
        const caja = crear("div", "master-entrada-caja");
        const titulo = crear("h2", "master-entrada-titulo", ocT("💛 Gratis, libre y hecha con IA"));
        titulo.id = "master-manifiesto-titulo";
        const vale = botonDe("oc-vida-accion es-principal", ocT("entendido"), () => cerrar());
        const botones = crear("div", "master-anadir-otras");
        botones.appendChild(vale);
        caja.append(titulo, manifiestoDe(), botones);
        fondo.appendChild(caja);
        entrada.inert = true;
        function cerrar() {
            entrada.inert = false;
            fondo.remove();
            if (volverA && volverA.focus) {
                volverA.focus();
            }
            despues();
        }
        fondo.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cerrar();
            } else if (e.key === "Tab") {
                const cosas = Array.from(fondo.querySelectorAll("a[href], button"));
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
        caja.scrollTop = 0;
        vale.focus({ preventScroll: true });
    }

    // EL AVISO DE LA WEB: al abrirla desde la web (no con el ejecutable),
    // encima de la entrada, se recomienda bajar la app. Se puede no volver
    // a enseñar.
    const CLAVE_AVISO_WEB = "richi-master-aviso-web";
    function verAvisoWeb(entrada) {
        if ((location.hostname === "127.0.0.1" && location.port === "47321") || EN_ANDROID) {
            return;
        }
        try {
            if (localStorage.getItem(CLAVE_AVISO_WEB) === "no") {
                return;
            }
        } catch (e) {
            // Sin almacenamiento: se enseña siempre.
        }
        const volverA = document.activeElement;
        const fondo = crear("div", "master-entrada master-aviso-web");
        fondo.setAttribute("role", "alertdialog");
        fondo.setAttribute("aria-modal", "true");
        fondo.setAttribute("aria-labelledby", "master-aviso-web-titulo");
        fondo.setAttribute("aria-describedby", "master-aviso-web-texto");
        const caja = crear("div", "master-entrada-caja");
        const titulo = crear("h2", "master-entrada-titulo", ocT("⬇️ Mejor, la app"));
        titulo.id = "master-aviso-web-titulo";
        const texto = crear("div");
        texto.id = "master-aviso-web-texto";
        texto.append(crear("p", "master-entrada-texto", ocT("Recomiendo descargar la aplicación en vez de usar la versión web, por el simple hecho de que la web está alojada en Cloudflare y los días de fútbol queda inutilizada.")),
        crear("p", "oc-hoja-nota", ocT("Gratis y sin conexión. Para Windows, macOS y Linux: descomprime el .zip y ábrela con doble clic. Para tablets Android: el .apk. Si ya tienes algo guardado aquí, haz una copia de seguridad (⚙ opciones) e impórtala en la app.")));
        const bajar = crear("a", "oc-vida-accion", ocT("⬇️ descargar la app"));
        bajar.href = "https://github.com/rperezbarreda/pantalla_master/releases/latest";
        bajar.target = "_blank";
        bajar.rel = "noopener noreferrer";
        bajar.setAttribute("aria-label", ocT("Descargar la app para Windows, macOS, Linux o tablets Android (se abre aparte, en GitHub)"));
        const seguir = botonDe("oc-vida-accion", ocT("seguir en la web"), () => cerrarAviso());
        const botones = crear("div", "master-anadir-otras");
        botones.append(bajar, seguir);
        const marca = crear("label", "master-aviso-web-marca");
        const casilla = crear("input");
        casilla.type = "checkbox";
        marca.append(casilla, document.createTextNode(ocT(" no volver a enseñar este aviso")));
        caja.append(titulo, texto, botones, marca);
        fondo.appendChild(caja);
        entrada.inert = true;
        function cerrarAviso() {
            if (casilla.checked) {
                try {
                    localStorage.setItem(CLAVE_AVISO_WEB, "no");
                } catch (e) {
                    // Sin almacenamiento: volverá a salir.
                }
            }
            entrada.inert = false;
            fondo.remove();
            if (volverA && volverA.focus) {
                volverA.focus();
            }
        }
        fondo.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cerrarAviso();
            } else if (e.key === "Tab") {
                const cosas = [bajar, seguir, casilla];
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
        bajar.focus();
    }

    // DUPLICAR UNA CAMPAÑA: una copia entera (tableros, ventanas, party,
    // documentos, música, línea temporal, relaciones…) con ids nuevos. Los
    // archivos que usa (imágenes, PDF, audios: «a…», «f…», «j…») se copian
    // también con id nuevo: si no, al borrar uno en una campaña se iría
    // de la otra.
    function duplicarCampana(c) {
        guardar();
        let texto = JSON.stringify(campanaGuardable(c));
        const ids = Array.from(new Set(texto.match(/\b[afj](?=[a-z0-9]*\d)[a-z0-9]{9,}\b/g) || []));
        return Promise.all(ids.map((id) => archivoLeer(id).catch(() => undefined).then((blob) => {
            if (!blob) {
                return null;
            }
            const nuevo = idDoc(id.charAt(0));
            return archivoGuardar(nuevo, blob).then(() => [id, nuevo]).catch(() => null);
        }))).then((pares) => {
            pares.filter(Boolean).forEach(([viejo, nuevo]) => {
                texto = texto.split(viejo).join(nuevo);
            });
            const x = JSON.parse(texto);
            x.id = "c" + siguienteCampana++;
            x.nombre = (ocT("{nombre} (copia)", { nombre: c.nombre })).slice(0, 40);
            const perfiles = {};
            x.perfiles.forEach((pf) => {
                const nuevo = "p" + siguientePerfil++;
                perfiles[pf.id] = nuevo;
                pf.id = nuevo;
                pf.modulos.forEach((m) => {
                    m.id = "m" + siguienteId++;
                });
            });
            x.activo = perfiles[x.activo] || x.perfiles[0].id;
            (x.modos || []).forEach((mo) => {
                mo.id = "o" + siguienteModo++;
                mo.modulos.forEach((m) => {
                    m.id = "m" + siguienteId++;
                });
            });
            x.modoActivo = "";
            todas.campanas.push(x);
            guardar();
            return x;
        });
    }

    function verCampanas() {
        const cuerpo = crear("div", "master-campanas");
        cuerpo.appendChild(crear("p", "oc-hoja-nota", ocT("Cada campaña tiene sus pestañas, sus ventanas y su party: no se mezclan.")));
        const ul = crear("ul", "master-anadir-lista");
        ul.setAttribute("aria-label", ocT("Campañas"));
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
                c.perfiles.length + (c.perfiles.length === 1 ? ocT(" pestaña") : ocT(" pestañas")) + " · " + c.pjs.length +
                (c.pjs.length === 1 ? ocT(" personaje") : ocT(" personajes")) + (ahora ? ocT(" · la de ahora") : "")));
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
        const medidasNueva = elegirUnidades("master-campana-unidades");
        const edicionNueva = elegirEdicion("master-campana-edicion");
        const nueva = formulario("master-campana-nueva", ocT("campaña nueva"), ocT("campaña {n}", { n: todas.campanas.length + 1 }), ocT("＋ crear"), (n) => {
            if (!edicionNueva.valor()) {
                avisar(ocT("Elige con qué reglas jugáis: las de 2024 o las de 2014."));
                edicionNueva.foco();
                return;
            }
            if (!medidasNueva.valor()) {
                avisar(ocT("Elige qué medidas usáis: imperial (pies) o métrico (metros)."));
                medidasNueva.foco();
                return;
            }
            const c = crearCampana(n, medidasNueva.valor(), edicionNueva.valor());
            todas.campanas.push(c);
            cerrar();
            activarCampana(c);
            botonCampana.focus();
        });
        const renombrarla = formulario("master-campana-nombre", ocT("nombre de esta campaña"), todo.nombre, "guardar", (n) => {
            if (!n) {
                return;
            }
            todo.nombre = n;
            guardar();
            pintarCampana();
            cerrar();
            botonCampana.focus();
            avisar(ocT("Campaña: {n}.", { n: n }));
        });
        let seguro = false;
        const borrar = botonDe("oc-vida-accion", ocT("🗑️ borrar esta campaña"), () => {
            if (!seguro) {
                seguro = true;
                borrar.textContent = ocT("🗑️ ¿seguro? se borran sus pestañas, ventanas y party: pulsa otra vez");
                return;
            }
            const i = todas.campanas.indexOf(todo);
            const nombre = todo.nombre;
            todas.campanas.splice(i, 1);
            cerrar();
            activarCampana(todas.campanas[Math.max(0, i - 1)]);
            botonCampana.focus();
            avisar(ocT("Borrada la campaña {nombre}.", { nombre: nombre }));
        });
        borrar.disabled = todas.campanas.length < 2;
        nueva.insertBefore(edicionNueva, nueva.querySelector("button"));
        nueva.insertBefore(medidasNueva, nueva.querySelector("button"));
        const duplicar = botonDe("oc-vida-accion", ocT("⧉ duplicar esta campaña"), () => {
            duplicar.disabled = true;
            duplicar.textContent = ocT("⧉ duplicando…");
            duplicarCampana(todo).then((x) => {
                cerrar();
                activarCampana(x);
                botonCampana.focus();
                avisar(ocT("Duplicada: ahora estás en «{nombre}» (la original sigue igual).", { nombre: x.nombre }));
            }).catch(() => {
                duplicar.disabled = false;
                duplicar.textContent = ocT("⧉ duplicar esta campaña");
                avisar(ocT("No se ha podido duplicar."));
            });
        }, ocT("Duplicar la campaña {nombre} (con sus tableros, party y documentos)", { nombre: todo.nombre }));
        const botonesC = crear("div", "master-anadir-otras");
        botonesC.append(duplicar, borrar);
        cuerpo.append(ul, nueva, renombrarla, botonesC);
        const cerrar = window.ocVentana.abrir({ titulo: ocT("campañas"), cuerpo, vuelta: botonCampana, clase: "es-ancha" });
    }
    pintarCampana();
    // LA BARRA, como un navegador: a la izquierda, pegado al tablero, 🧰
    // (añadir una ventana), 📚 (la campaña), las pestañas (cada una con
    // su ✕), ＋ y ✎; a la derecha, en su caja, el buscador, 🔍 y ⚙ (las
    // opciones: zoom, dados, atajos, ordenar, quitar, exportar e
    // importar).
    botonAnadir.className = "master-pestana-mando master-herramientas";
    botonAnadir.textContent = "🧰";
    botonAnadir.setAttribute("aria-label", ocT("Añadir una ventana (herramientas)"));
    botonAnadir.setAttribute("aria-keyshortcuts", "A");
    botonAnadir.title = ocT("Herramientas: añadir una ventana (A)");
    // ＋: el compendio (añadir monstruos, objetos, conjuros…), aparte.
    const botonCompendio = botonDe("master-crear", "🛠️", () => abrirCompendio(botonCompendio),
        ocT("Añadir al compendio: monstruos, objetos, conjuros…"));
    botonCompendio.title = ocT("Añadir al compendio: monstruos, objetos, conjuros y más (con tutorial)");
    botonCompendio.setAttribute("aria-haspopup", "dialog");
    pestanas.append(botonAnadir, botonCampana, botonCompendio, marco, elegirTablero, mandosPestanas);

    const mandos = crear("div", "master-barra-mandos");
    const zoomCaja = crear("div", "master-zoom");
    zoomCaja.setAttribute("role", "group");
    zoomCaja.setAttribute("aria-label", ocT("Zoom del tablero"));
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
    }, ocT("Buscar"));
    botonBuscar.title = ocT("Buscar (/)");
    const botonOpciones = botonDe("master-pestana-mando master-opciones-boton", "⚙", () => verOpciones(), ocT("Opciones del tablero"));
    botonOpciones.title = ocT("Opciones: zoom, dados, atajos, ordenar, exportar…");
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
        if (HAY_ZOOM && !enMovil.matches && !esModo(estado)) {
            fila(ocT("Zoom del tablero"), zoomCaja);
        }
        const accion = (texto, alPulsar) => botonDe("oc-vida-accion", texto, () => {
            cerrar();
            alPulsar();
        });
        const herramientas = crear("div", "master-anadir-otras");
        herramientas.append(accion(ocT("🎲 dados (D)"), () => {
            const d = document.querySelector(".oc-boton-dados");
            if (d) {
                d.click();
            }
        }), accion(ocT("⌨ atajos de teclado (?)"), () => verAtajos()));
        fila(ocT("A mano"), herramientas);
        if (estado.modulos.length && !esModo(estado)) {
            const otras = crear("div", "master-anadir-otras");
            let seguro = false;
            const vaciar = botonDe("oc-vida-accion", ocT("🗑️ quitar todas"), () => {
                if (!seguro) {
                    seguro = true;
                    vaciar.textContent = ocT("🗑️ ¿seguro? pulsa otra vez");
                    return;
                }
                cerrar();
                estado.modulos = [];
                pintarTodo();
                guardar();
                avisar(ocT("Pestaña vacía."));
            });
            otras.append(accion(ocT("▦ ordenar las ventanas"), () => {
                ordenar();
                pintarTodo();
                guardar();
                avisar(ocT("Ordenadas."));
            }), vaciar);
            fila(ocT("Las ventanas de esta pestaña"), otras);
        }
        const notaMedidas = crear("p", "oc-hoja-nota", ocT("En métrico, lo que sale en pantalla (monstruos, conjuros, reglas, objetos, generadores…) se pasa con la equivalencia de los manuales en español: 5 pies = 1,5 m, 1 libra = 0,5 kg, 1 milla = 1,5 km. Lo que escribes tú no se toca."));
        notaMedidas.dataset.sinMedidas = "";
        fila(ocT("Reglas de esta campaña"), botonesDe(ocT("edición"), EDICIONES, edicionDe(todo), (v) => {
            todo.edicion = v;
            guardar();
            aplicarEdicion();
            avisar(v === "2014" ? ocT("Reglas, monstruos y conjuros de 2014 (SRD 5.1).") : ocT("Reglas, monstruos y conjuros de 2024 (SRD 5.2)."));
        }), crear("p", "oc-hoja-nota", ocT("Cambia las reglas (estados, acciones, descansos…), el bestiario, los conjuros y los objetos (el equipo y los objetos mágicos de la tienda y del botín). Lo tuyo (tus monstruos, conjuros, objetos y reglas propias) sale con las dos.")));
        fila(ocT("Medidas de esta campaña"), botonesDe(ocT("medidas"), MEDIDAS, unidadesDe(todo), (v) => {
            todo.unidades = v;
            guardar();
            aplicarUnidades();
            avisar(v === "metrico" ? ocT("Medidas en metros, kilos y kilómetros.") : ocT("Medidas en pies, libras y millas."));
        }), notaMedidas);
        fila(ocT("Copia de seguridad"), copias(() => cerrar()));
        if (ORDENADO) {
            const rehacer = botonDe("oc-vida-accion", ocT("🔄 rehacerla entera"), () => {
                rehacer.disabled = true;
                avisar(ocT("Rehaciendo la carpeta «ordenado»…"));
                ordenarCarpeta(true).then((n) => {
                    rehacer.disabled = false;
                    avisar(ocT("Carpeta «ordenado» rehecha ({n} archivos).", { n: n || 0 }));
                }).catch(() => {
                    rehacer.disabled = false;
                    avisar(ocT("No se ha podido rehacer la carpeta «ordenado»."));
                });
            });
            const caja = crear("div", "master-anadir-otras");
            caja.appendChild(rehacer);
            fila(ocT("La carpeta «ordenado»"), crear("p", "oc-hoja-nota", ocT("Junto a lo que usa la app, en tu carpeta está «ordenado»: lo mismo con sus nombres, para mirarlo o llevártelo (cada campaña con sus tableros, personajes, documentos y música; tu compendio por categorías; las traducciones…). Se rehace sola; la app no la lee.")), caja);
        }
        if (EN_ANDROID) {
            // Dónde se guarda: dentro de la app o en una carpeta (como
            // «mis-datos» en el programa; ver android/…/Carpeta.java).
            const donde = crear("div", "master-anadir-otras");
            donde.append(botonDe("oc-vida-accion", EN_CARPETA ? ocT("📁 cambiar de carpeta") : ocT("📁 guardar en una carpeta"), () => {
                cerrar();
                window.ocAndroid.elegirCarpeta();
            }));
            if (EN_CARPETA) {
                donde.append(botonDe("oc-vida-accion", ocT("📱 guardarlo dentro de la app"), () => {
                    cerrar();
                    window.ocAndroid.quitarCarpeta();
                }));
            }
            fila(ocT("Dónde se guarda"), crear("p", "oc-hoja-nota", EN_CARPETA
                ? ocT("En tu carpeta «{nombre}»: almacen.json y la carpeta «archivos» (imágenes, PDF y música), como «mis-datos» en el programa del ordenador. Sigue ahí aunque desinstales la app, y se puede copiar al ordenador y al revés.", { nombre: window.ocAlmacen.nombre })
                : ocT("{n}Dentro de la app: si la desinstalas, se borra. En una carpeta (por ejemplo, «Documentos/Pantalla de máster») sigue ahí aunque desinstales la app y se puede copiar al ordenador: es como «mis-datos» en el programa.", { n: window.ocAndroid.carpetaPerdida ? ocT("La carpeta que elegiste ya no se puede usar (¿se borró o se movió?): ahora se guarda dentro de la app. ") : "" })), donde);
        }
        if (PUEDE_ENCENDIDA) {
            fila(ocT("La pantalla, durante la partida"), botonesDe(ocT("pantalla"), [["si", ocT("💡 siempre encendida")],
                ["no", ocT("se apaga como siempre")]], encendidaElegida() ? "si" : "no", (v) => {
                try {
                    localStorage.setItem(CLAVE_ENCENDIDA, v);
                } catch (e) {
                    // Sin guardar: vale para esta vez.
                }
                aplicarEncendida();
                avisar(v === "si" ? ocT("La pantalla no se apagará sola mientras la pantalla de máster esté a la vista.")
                    : ocT("La pantalla se apagará como siempre."));
            }), crear("p", "oc-hoja-nota", ocT("Con «siempre encendida», mientras la pantalla de máster está a la vista el dispositivo no se bloquea solo.")));
        }
        if (EN_ANDROID) {
            // ¿Hay versión nueva? Sólo se mira en GitHub al pulsar.
            const notaVersion = crear("p", "oc-hoja-nota", ocT("Tienes la versión {version}. Mira en GitHub si hay una nueva (sólo cuando lo pulses).", { version: window.ocAndroid.version }));
            const versiones = crear("div", "master-anadir-otras");
            const buscarVersion = botonDe("oc-vida-accion", ocT("🔄 buscar actualizaciones"), () => {
                buscarVersion.disabled = true;
                avisar(ocT("Mirando en GitHub…"));
                fetch("__actualizacion", { cache: "no-store" }).then((r) => r.json()).then((x) => {
                    buscarVersion.disabled = false;
                    let dicho;
                    if (x.error) {
                        dicho = ocT("No se ha podido mirar: {error}.", { error: x.error });
                    } else if (x.prueba) {
                        dicho = ocT("Es una versión de prueba: la última publicada es la {n}. Las de prueba se bajan de GitHub Actions.", { n: x.ultima || "?" });
                    } else if (!x.hay) {
                        dicho = ocT("Tienes la última versión ({actual}).", { actual: x.actual });
                    } else {
                        dicho = ocT("Hay una versión nueva: la {ultima} (tienes la {actual}). Bájala, ábrela y Android la instala encima, sin perder lo guardado.", { ultima: x.ultima, actual: x.actual });
                        const bajar = botonDe("oc-vida-accion", ocT("⬇️ bajar la versión {ultima}", { ultima: x.ultima }), () => {
                            window.ocAndroid.abrirFuera(x.url);
                        });
                        bajar.setAttribute("aria-label", ocT("Bajar la versión {ultima} (se abre en el navegador)", { ultima: x.ultima }));
                        versiones.querySelectorAll("[data-bajar]").forEach((b) => b.remove());
                        bajar.dataset.bajar = "";
                        versiones.append(bajar);
                    }
                    notaVersion.textContent = dicho;
                    avisar(dicho);
                }).catch(() => {
                    buscarVersion.disabled = false;
                    notaVersion.textContent = ocT("No se ha podido mirar (¿sin conexión?).");
                    avisar(notaVersion.textContent);
                });
            });
            versiones.append(buscarVersion);
            fila(ocT("Actualizaciones"), notaVersion, versiones);
        }
        // En la web (no en el ejecutable ni en la app de Android, que ya
        // son la app): de dónde bajarla para usarla sin el navegador.
        if (!(location.hostname === "127.0.0.1" && location.port === "47321") && !EN_ANDROID) {
            const bajar = crear("a", "oc-vida-accion", ocT("⬇️ descargar la app"));
            bajar.href = "https://github.com/rperezbarreda/pantalla_master/releases/latest";
            bajar.target = "_blank";
            bajar.rel = "noopener noreferrer";
            bajar.setAttribute("aria-label", ocT("Descargar la app para Windows, macOS, Linux o tablets Android (se abre aparte, en GitHub)"));
            const otras = crear("div", "master-anadir-otras");
            otras.append(bajar);
            fila(ocT("La app, sin el navegador"), crear("p", "oc-hoja-nota", ocT("Gratis y sin conexión. Para Windows, macOS y Linux: descomprime el .zip y ábrela con doble clic. Para tablets Android: el .apk. Lo guardado va en la app, no en el navegador: para llevarte lo de aquí, haz antes una copia de seguridad e impórtala allí.")), otras);
        }
        // Más cosas de rol, en el blog (se abre aparte; en Android, en el
        // navegador).
        const blog = crear("a", "oc-vida-accion", ocT("🎲 recursos de rol en richi.blog"));
        blog.href = "https://richi.blog/web/mis_movidas/rol/index_rol.html";
        blog.target = "_blank";
        blog.rel = "noopener noreferrer";
        blog.setAttribute("aria-label", ocT("Recursos de rol en richi.blog (se abre aparte, en el navegador)"));
        const masRol = crear("div", "master-anadir-otras");
        masRol.append(blog);
        fila(ocT("Más de rol"), crear("p", "oc-hoja-nota", ocT("Más cosas para tus partidas en El Blog de Richi.")), masRol);
        const lic = crear("div", "master-anadir-otras");
        const web = crear("a", "oc-vida-accion", ocT("🌐 el SRD en la web"));
        web.href = "https://www.dndbeyond.com/srd";
        web.target = "_blank";
        web.rel = "noopener noreferrer";
        web.setAttribute("aria-label", ocT("Ver el SRD 5.2 en la web (se abre aparte)"));
        lic.append(accion(ocT("📜 licencias y créditos"), () => verCreditos(botonOpciones)), web);
        fila(ocT("Licencias y créditos"), crear("p", "oc-hoja-nota", ocT("SRD 5.2 de Wizards of the Coast (CC BY 4.0), sonidos de la Google Sound Library (CC BY 4.0), tipografías OFL y la app con licencia MIT.")), lic);
        // Por qué es gratis: lo último, como una carta.
        fila(ocT("💛 Gratis y libre"), manifiestoDe());
        const cerrar = window.ocVentana.abrir({ titulo: ocT("opciones"), cuerpo, vuelta: botonOpciones });
    }

    // ---- LOS ATAJOS DE TECLADO (fuera de los campos de texto y sin
    // ventana modal abierta): «?» o ⌨ los enseña todos. ----
    const ATAJOS = [
        [ocT("El tablero"), [["/", ocT("ir al buscador")], ["A", ocT("añadir una ventana")], ["N", ocT("post-it nuevo")], ["D", ocT("los dados")],
            ["I", ocT("la iniciativa (la abre si no está)")], ["+ / −", ocT("acercar o alejar el tablero")], ["0", ocT("el tablero al 100 %")],
            ["[ / ]", ocT("perfil anterior o siguiente")], [ocT("Alt + ← / Alt + →"), ocT("mover la pestaña elegida")],
            [ocT("mantener pulsada una pestaña"), ocT("arrastrarla a otro sitio")], ["C", ocT("campañas (cambiar, crear…)")],
            ["?", ocT("estos atajos")]]],
        [ocT("Las ventanas"), [[ocT("clic en la barra"), ocT("plegarla o desplegarla")], [ocT("mantener pulsada la barra"), ocT("cogerla y moverla")],
            [ocT("soltarla sobre la barra de otra"), ocT("juntarlas en pestañas (⇱ la saca)")],
            [ocT("Intro en el nombre"), ocT("plegarla o desplegarla")], [ocT("flechas en el nombre"), ocT("moverla (con Mayús, más deprisa)")],
            [ocT("Alt + flechas en el nombre"), ocT("cambiar su tamaño")], [ocT("Esc"), ocT("cerrar una ventana modal")]]],
        [ocT("El dibujo (con el foco en el lienzo)"), [["B", ocT("lápiz")], ["E", ocT("goma")], ["G", ocT("bote")], ["M", ocT("seleccionar y mover")],
            ["I", ocT("cuentagotas")], ["L", ocT("línea")], ["U", ocT("rectángulo")], ["O", ocT("elipse")], ["T", ocT("texto")], [ocT("Ctrl+Z / Ctrl+Y"), ocT("deshacer y rehacer")],
            [ocT("flechas"), ocT("mover la selección (Mayús: de 10 en 10)")], ["+ / −", ocT("agrandar o encoger la selección")],
            [ocT("Supr"), ocT("borrar la selección")], [ocT("Esc"), ocT("soltar la selección")], ["Ctrl+V", ocT("pegar una imagen")]]],
        [ocT("Post-its y notas"), [[ocT("Ctrl+B / I / U"), ocT("negrita, cursiva, subrayado")], [ocT("Ctrl+Z / Ctrl+Y"), ocT("deshacer y rehacer")],
            [ocT("← → en la barra"), ocT("ir de un botón a otro")]]],
        [ocT("El buscador"), [["↓ ↑", ocT("por los resultados")], [ocT("Intro"), ocT("abrir el elegido")], [ocT("Esc"), ocT("cerrar")]]],
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
        window.ocVentana.abrir({ titulo: ocT("atajos de teclado"), cuerpo, vuelta: botonOpciones, clase: "es-ancha" });
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
            avisar(ocT("Perfil: {nombre}.", { nombre: pf.nombre }));
        }
    }

    ponerAlDiaTutorial();
    ponerTableroParty();
    lienzo.classList.add("con-lienzo");
    colorTablero();
    pintarPestanas(false);
    pintarTodo();
    // El menú de los modos (fuera del tablero, abajo a la derecha). Un
    // modo llena la pantalla: al cambiar su tamaño, su alto también.
    document.body.appendChild(menuModos);
    pintarModos();
    ponerSitioModos(sitioModos(), false);
    window.addEventListener("resize", () => {
        if (esModo(estado)) {
            crecerLienzo();
        }
    });
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
    // En la app de Android: lo que llegue con «Abrir con» (ahora o luego) y,
    // guardando en una carpeta, una copia automática al día en su «copias/»
    // (sin los archivos, que ya están en la carpeta; se quedan las cinco
    // últimas). Se importan como cualquier copia (⚙ → importar).
    if (EN_ANDROID) {
        window.ocRecibir = recibirArchivos;
        window.ocAndroid.hayRecibidos();
        if (EN_CARPETA && window.ocAndroid.copiaFalta()) {
            setTimeout(() => datosDeCopia(false).then((datos) => {
                if (Object.keys(datos.claves).length && window.ocAndroid.guardarCopia(JSON.stringify(datos, null, 1))) {
                    marcarCopia();
                }
            }).catch(() => {}), 3000);
        }
    }
})();
