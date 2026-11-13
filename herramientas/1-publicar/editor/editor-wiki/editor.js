// =========================================
// EL EDITOR DE LA WEB — lo común
// =========================================
// Habla con herramientas/1-publicar/editor/editor-wiki.py. Aquí está lo que
// usan todas las vistas (solo una a la vista): el menú y «Estás en», los
// avisos, el proceso largo con su barra y pasar a la web. Lo de cada
// apartado está en su archivo: mapas.js (los mapas de las campañas),
// escribir.js y redactor.js (las entradas) y fichas.js (las fichas).
// (La wiki de Cralëa se fue a su propio repo, wiki_cralea.)
// Todo lo que llega del servidor se pone con textContent: un nombre con <
// dentro no es HTML.

const TOKEN_EDITOR = (document.querySelector('meta[name="editor-token"]') || {}).content || "";

const $ = (sel, dentro) => (dentro || document).querySelector(sel);

// CÓMO SE VE EL EDITOR: la letra, en pasos (el 1 es lo normal), y el
// contraste alto (negro, blanco y amarillo). Se guarda en este navegador
// y se pone nada más cargar, antes que lo demás.
const PASOS_DE_LETRA_EDITOR = [0.9, 1, 1.12, 1.25, 1.4, 1.6, 1.8, 2];
const AJUSTES_DE_VISTA_EDITOR = "editor-web-vista";

function leerVistaEditor() {
    try {
        return Object.assign({ letra: 1, contraste: false, sonido: false },
            JSON.parse(localStorage.getItem(AJUSTES_DE_VISTA_EDITOR) || "{}"));
    } catch (e) {
        return { letra: 1, contraste: false, sonido: false };
    }
}

function ponerVistaEditor(vista) {
    const paso = Math.max(0, Math.min(PASOS_DE_LETRA_EDITOR.length - 1, Number(vista.letra) || 0));
    document.documentElement.style.fontSize = (112.5 * PASOS_DE_LETRA_EDITOR[paso]) + "%";
    if (vista.contraste) {
        document.documentElement.setAttribute("data-contraste", "alto");
    } else {
        document.documentElement.removeAttribute("data-contraste");
    }
    try {
        localStorage.setItem(AJUSTES_DE_VISTA_EDITOR, JSON.stringify({ letra: paso, contraste: !!vista.contraste,
            sonido: !!vista.sonido }));
    } catch (e) {
        // Sin almacenamiento: vale para esta vez.
    }
    return paso;
}

ponerVistaEditor(leerVistaEditor());

function ajustesDeVistaEditor() {
    const contraste = $("[data-boton-contraste]");
    contraste.setAttribute("aria-pressed", leerVistaEditor().contraste ? "true" : "false");
    document.querySelectorAll("[data-letra]").forEach((b) => b.addEventListener("click", () => {
        const vista = leerVistaEditor();
        vista.letra = Number(vista.letra) + Number(b.getAttribute("data-letra"));
        const paso = ponerVistaEditor(vista);
        avisarEditor("Letra al " + Math.round(PASOS_DE_LETRA_EDITOR[paso] * 100) + " %.");
    }));
    contraste.addEventListener("click", () => {
        const vista = leerVistaEditor();
        vista.contraste = !vista.contraste;
        ponerVistaEditor(vista);
        contraste.setAttribute("aria-pressed", vista.contraste ? "true" : "false");
    });
    // EL AVISO SONORO: al acabar algo largo (guardar y pasar a la web,
    // generar, repasar), dos notas que suben si ha ido bien y dos que bajan
    // si algo ha fallado. Apagado de serie; al encenderlo suena una vez,
    // para saber cómo es.
    const sonido = $("[data-boton-sonido]");
    const pintarSonido = (si) => {
        sonido.setAttribute("aria-pressed", si ? "true" : "false");
        sonido.querySelector("[data-sonido-icono]").textContent = si ? "🔔" : "🔕";
    };
    pintarSonido(leerVistaEditor().sonido);
    sonido.addEventListener("click", () => {
        const vista = leerVistaEditor();
        vista.sonido = !vista.sonido;
        ponerVistaEditor(vista);
        pintarSonido(vista.sonido);
        avisarEditor(vista.sonido ? "Aviso sonoro encendido: sonará al acabar lo que tarda." : "Aviso sonoro apagado.");
        if (vista.sonido) {
            sonarEditor(true, true);
        }
    });
}

// Dos notas con el oscilador del navegador (sin archivos de sonido).
let audioEditor = null;

function sonarEditor(bien, aunqueEsteApagado) {
    if (!aunqueEsteApagado && !leerVistaEditor().sonido) {
        return;
    }
    try {
        audioEditor = audioEditor || new (window.AudioContext || window.webkitAudioContext)();
        const notas = bien ? [660, 880] : [440, 294];
        notas.forEach((frecuencia, i) => {
            const osc = audioEditor.createOscillator();
            const volumen = audioEditor.createGain();
            const empieza = audioEditor.currentTime + i * 0.18;
            osc.type = "sine";
            osc.frequency.value = frecuencia;
            volumen.gain.setValueAtTime(0.0001, empieza);
            volumen.gain.exponentialRampToValueAtTime(0.25, empieza + 0.02);
            volumen.gain.exponentialRampToValueAtTime(0.0001, empieza + 0.16);
            osc.connect(volumen).connect(audioEditor.destination);
            osc.start(empieza);
            osc.stop(empieza + 0.17);
        });
    } catch (e) {
        // Sin sonido en este navegador: no pasa nada.
    }
}

// =========================================
// LA VENTANA DEL PROCESO (flotante)
// =========================================
// Mientras las herramientas trabajan (guardar y pasar a la web, generar,
// repasar…), una ventana flotante abajo a la derecha enseña todo lo que
// van diciendo, línea a línea (lo apunta el servidor en «registro»: se
// pide por trozos, desde la línea que ya se tiene), con la fase y la
// barra. Se queda al acabar, con cómo ha ido, hasta que se cierra. Se
// puede plegar, copiar lo dicho y moverla arrastrando su barra (se
// recuerda dónde). Para el lector: la fase se anuncia (aria-live); las
// líneas no, que serían cientos: están en el recuadro, que se puede
// recorrer con el teclado.
const PROCESO_EDITOR = { caja: null, desde: 0, siguiendo: true };
const SITIO_DEL_PROCESO_EDITOR = "editor-web-proceso";

function montarProcesoEditor() {
    if (PROCESO_EDITOR.caja) {
        return PROCESO_EDITOR.caja;
    }
    const caja = crearEditor("div", "proceso");
    caja.setAttribute("role", "region");
    caja.setAttribute("aria-labelledby", "proceso-titulo");
    const barra = crearEditor("div", "proceso-barra");
    const titulo = crearEditor("h2", "proceso-titulo", "proceso.log");
    titulo.id = "proceso-titulo";
    barra.appendChild(titulo);
    const botones = crearEditor("div", "proceso-botones");
    const plegar = crearEditor("button", "", "Plegar");
    plegar.type = "button";
    plegar.setAttribute("aria-expanded", "true");
    const copiar = crearEditor("button", "", "Copiar");
    copiar.type = "button";
    const cerrar = crearEditor("button", "", "✕");
    cerrar.type = "button";
    cerrar.setAttribute("aria-label", "Cerrar la ventana del proceso");
    [plegar, copiar, cerrar].forEach((b) => botones.appendChild(b));
    barra.appendChild(botones);
    caja.appendChild(barra);
    const cuerpo = crearEditor("div", "proceso-cuerpo");
    const fase = crearEditor("p", "proceso-fase");
    fase.setAttribute("aria-live", "polite");
    const progreso = document.createElement("progress");
    progreso.max = 100;
    progreso.value = 0;
    progreso.setAttribute("aria-label", "Cuánto va");
    const log = crearEditor("pre", "proceso-log");
    log.tabIndex = 0;
    log.setAttribute("aria-label", "Lo que van diciendo las herramientas");
    [fase, progreso, log].forEach((x) => cuerpo.appendChild(x));
    caja.appendChild(cuerpo);
    document.body.appendChild(caja);
    PROCESO_EDITOR.caja = caja;
    Object.assign(PROCESO_EDITOR, { fase, progreso, log, cuerpo, plegar });

    plegar.addEventListener("click", () => {
        const abierta = plegar.getAttribute("aria-expanded") === "true";
        plegar.setAttribute("aria-expanded", abierta ? "false" : "true");
        plegar.textContent = abierta ? "Desplegar" : "Plegar";
        cuerpo.hidden = abierta;
    });
    copiar.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(log.textContent);
            avisarEditor("Copiado lo que han dicho las herramientas.");
        } catch (e) {
            avisarEditor("No he podido copiarlo.", true);
        }
    });
    cerrar.addEventListener("click", () => {
        caja.hidden = true;
        const vuelta = $("[data-aviso]");
        if (vuelta) {
            vuelta.setAttribute("tabindex", "-1");
            vuelta.focus();
        }
    });
    // Si subes por lo dicho, deja de bajar solo hasta que vuelvas abajo.
    log.addEventListener("scroll", () => {
        PROCESO_EDITOR.siguiendo = log.scrollTop + log.clientHeight >= log.scrollHeight - 8;
    });
    // Arrastrando la barra (no sus botones), a donde se quiera.
    let agarre = null;
    barra.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button")) {
            return;
        }
        const r = caja.getBoundingClientRect();
        agarre = { x: e.clientX - r.left, y: e.clientY - r.top };
        barra.setPointerCapture(e.pointerId);
    });
    barra.addEventListener("pointermove", (e) => {
        if (!agarre) {
            return;
        }
        colocarProcesoEditor(e.clientX - agarre.x, e.clientY - agarre.y);
    });
    barra.addEventListener("pointerup", () => {
        if (!agarre) {
            return;
        }
        agarre = null;
        try {
            localStorage.setItem(SITIO_DEL_PROCESO_EDITOR, JSON.stringify({ x: caja.offsetLeft, y: caja.offsetTop }));
        } catch (e) {
            // Sin almacenamiento: vale para esta vez.
        }
    });
    try {
        const sitio = JSON.parse(localStorage.getItem(SITIO_DEL_PROCESO_EDITOR) || "null");
        if (sitio) {
            colocarProcesoEditor(sitio.x, sitio.y);
        }
    } catch (e) {
        // Donde sale de serie.
    }
    return caja;
}

function colocarProcesoEditor(x, y) {
    const caja = PROCESO_EDITOR.caja;
    const maxX = Math.max(0, window.innerWidth - caja.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - 60);
    caja.style.left = Math.max(0, Math.min(maxX, x)) + "px";
    caja.style.top = Math.max(0, Math.min(maxY, y)) + "px";
    caja.style.right = "auto";
    caja.style.bottom = "auto";
}

function empezarProcesoEditor(titulo) {
    const caja = montarProcesoEditor();
    caja.hidden = false;
    caja.classList.remove("es-bien", "es-mal");
    PROCESO_EDITOR.desde = 0;
    PROCESO_EDITOR.siguiendo = true;
    PROCESO_EDITOR.log.textContent = "";
    PROCESO_EDITOR.progreso.value = 0;
    PROCESO_EDITOR.fase.textContent = titulo || "Empezando…";
}

// Lo que ha llegado en una pregunta de cómo va: la fase, cuánto y las
// líneas nuevas (desde PROCESO_EDITOR.desde).
function ponerProcesoEditor(estado, segundos) {
    if (!PROCESO_EDITOR.caja) {
        return;
    }
    const porcentaje = Math.max(0, Math.min(100, Number(estado.porcentaje) || 0));
    PROCESO_EDITOR.progreso.value = porcentaje;
    const fase = (estado.fase || "Pasando") + "…";
    // Solo cuando cambia de fase: si no, el lector la repetiría sin parar.
    if (!PROCESO_EDITOR.fase.textContent.startsWith(fase)) {
        PROCESO_EDITOR.fase.textContent = fase;
    }
    PROCESO_EDITOR.fase.dataset.segundos = segundos;
    if (Array.isArray(estado.lineas) && estado.lineas.length) {
        PROCESO_EDITOR.log.appendChild(document.createTextNode(estado.lineas.join("\n") + "\n"));
        if (PROCESO_EDITOR.siguiendo) {
            PROCESO_EDITOR.log.scrollTop = PROCESO_EDITOR.log.scrollHeight;
        }
    }
    if (typeof estado.total === "number") {
        PROCESO_EDITOR.desde = estado.total;
    }
}

function acabarProcesoEditor(resultado) {
    const bien = !(resultado && resultado.error);
    if (PROCESO_EDITOR.caja) {
        PROCESO_EDITOR.progreso.value = 100;
        PROCESO_EDITOR.caja.classList.add(bien ? "es-bien" : "es-mal");
        PROCESO_EDITOR.fase.textContent = bien ? "✓ Terminado, todo bien." : "✗ " + (resultado.error || "Algo ha fallado.");
    }
    sonarEditor(bien);
}

function crearEditor(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) {
        el.className = clase;
    }
    if (texto !== undefined) {
        el.textContent = texto;
    }
    return el;
}

async function pedirEditor(ruta, cuerpo) {
    const opciones = { headers: { "X-Editor": TOKEN_EDITOR } };
    if (cuerpo !== undefined) {
        opciones.method = "POST";
        opciones.headers["Content-Type"] = "application/json";
        opciones.body = JSON.stringify(cuerpo);
    }
    try {
        const respuesta = await fetch(ruta, opciones);
        return await respuesta.json();
    } catch (error) {
        return { error: "No hay respuesta del editor. ¿Sigue abierta la ventana donde lo arrancaste?" };
    }
}

function avisarEditor(texto, error, salida) {
    // Editando un mapa, una entrada o unas fichas, los avisos van en la
    // barra de abajo (la que esté a la vista), junto a «Guardar»: arriba
    // empujarían lo de debajo (y, al final de una página larga, no se
    // verían).
    const enBarra = document.querySelector(".barra:not([hidden]) [data-aviso-barra]");
    const aviso = enBarra || $("[data-aviso]");
    document.querySelectorAll("[data-aviso], [data-aviso-barra]").forEach((otro) => {
        if (otro !== aviso) {
            otro.textContent = "";
        }
    });
    aviso.textContent = texto || "";
    aviso.classList.toggle("es-error", !!error);
    if (salida) {
        const mas = crearEditor("details", "salida-mas");
        mas.appendChild(crearEditor("summary", "", "Lo que han dicho las herramientas"));
        mas.appendChild(crearEditor("pre", "salida", salida));
        if (error) {
            mas.open = true;
        }
        aviso.appendChild(mas);
    }
}

function irAEditor(vista) {
    // Lo de escribir.js y fichas.js (se cargan después; están si existen).
    const escribiendo = typeof estadoEscribir !== "undefined" ? estadoEscribir : null;
    if (vista !== "entrada" && escribiendo && escribiendo.cambiado
        && !window.confirm("Hay cambios sin guardar en lo que estabas escribiendo. ¿Salir igualmente?")) {
        return;
    }
    const fichas = typeof estadoFichas !== "undefined" ? estadoFichas : null;
    if (vista !== "fichas" && fichas && fichas.cambiado
        && !window.confirm("Hay cambios sin guardar en las fichas. ¿Salir igualmente?")) {
        return;
    }
    if (vista !== "entrada" && escribiendo) {
        escribiendo.cambiado = false;
    }
    if (vista !== "fichas" && fichas) {
        fichas.cambiado = false;
    }
    // El mapa que se está editando (lo lleva mapas.js).
    const mapa = window.estadoMapa;
    if (vista !== "mapa" && mapa && mapa.cambiado
        && !window.confirm("Hay cambios sin guardar en este mapa. ¿Salir igualmente?")) {
        return;
    }
    if (vista !== "mapa" && mapa) {
        mapa.cambiado = false;
    }
    document.body.classList.toggle("en-mapa", vista === "mapa");
    medirCabeceraEditor();
    const barraMapa = $("[data-barra-mapa]");
    if (barraMapa) {
        barraMapa.hidden = vista !== "mapa";
    }
    document.querySelectorAll("[data-vista]").forEach((v) => {
        v.hidden = v.getAttribute("data-vista") !== vista;
    });
    $("[data-barra-entrada]").hidden = vista !== "entrada";
    $("[data-barra-fichas]").hidden = vista !== "fichas";
    // En el menú, el apartado en el que estás, también dentro de él (unas
    // fichas de Rol siguen siendo Rol): aria-current, y se ve marcado.
    const apartado = apartadoDeVistaEditor(vista);
    document.querySelectorAll(".menu [data-ir]").forEach((b) => {
        if (b.getAttribute("data-ir") === apartado) {
            b.setAttribute("aria-current", b.getAttribute("data-ir") === vista ? "page" : "true");
        } else {
            b.removeAttribute("aria-current");
        }
    });
    ESTADO_DONDE_EDITOR.vista = vista;
    pintarDondeEditor();
    avisarEditor("");
    const titulo = $('[data-vista="' + vista + '"] h1');
    if (titulo) {
        titulo.setAttribute("tabindex", "-1");
        titulo.focus();
    }
    window.scrollTo(0, 0);
}

// ---- EL MENÚ Y «ESTÁS EN» ----
// Las vistas de dentro de un apartado (escribir una entrada, unas fichas,
// un mapa…), con su apartado y, si lo hay, el paso de en medio (un mapa
// cuelga de «Los mapas de las campañas», que cuelga de Campañas).
const VISTAS_DE_DENTRO_EDITOR = {
    "nueva-entrada": ["escribir"],
    entrada: ["escribir"],
    mapas: ["campanas"],
    mapa: ["campanas", "mapas"],
};
// Las fichas son de un apartado u otro según la colección (fichas.js).
const APARTADO_DE_FICHAS_EDITOR = { escribir: "escribir", campanas: "campanas", recursos: "rol", personajes: "rol",
    rincon: "rincon" };
const ESTADO_DONDE_EDITOR = { vista: "inicio" };

function caminoDeVistaEditor(vista) {
    if (vista === "fichas" && typeof estadoFichas !== "undefined") {
        const col = (estadoFichas.colecciones || []).find((c) => c.id === estadoFichas.id);
        return [APARTADO_DE_FICHAS_EDITOR[col && col.apartado] || "inicio"];
    }
    return VISTAS_DE_DENTRO_EDITOR[vista] || [];
}

function apartadoDeVistaEditor(vista) {
    return caminoDeVistaEditor(vista)[0] || vista;
}

// El nombre de una vista, el de su título (sin el emoji, que es de adorno).
function nombreDeVistaEditor(vista) {
    const boton = document.querySelector('.menu [data-ir="' + vista + '"] .menu-texto');
    if (boton) {
        return boton.textContent.trim();
    }
    const titulo = $('[data-vista="' + vista + '"] h1');
    if (!titulo) {
        return vista;
    }
    const copia = titulo.cloneNode(true);
    copia.querySelectorAll('[aria-hidden="true"]').forEach((x) => x.remove());
    return copia.textContent.trim() || vista;
}

// «Estás en: Inicio › Rol › Mis personajes»: cada paso de antes es un
// botón para volver; el último, donde estás (aria-current), no se pulsa.
function pintarDondeEditor() {
    const vista = ESTADO_DONDE_EDITOR.vista;
    const caja = $("[data-donde]");
    const lista = $("[data-donde-lista]");
    if (!caja || !lista) {
        return;
    }
    lista.textContent = "";
    // En un mapa (a pantalla completa, sin la cabecera) ya está su «← Los
    // mapas». En el inicio dice solo «Inicio».
    caja.hidden = vista === "mapa";
    const pasos = vista === "inicio" ? ["inicio"]
        : ["inicio"].concat(caminoDeVistaEditor(vista).filter((v) => v !== "inicio"), [vista]);
    pasos.forEach((paso, i) => {
        const li = document.createElement("li");
        if (i === pasos.length - 1) {
            const aqui = crearEditor("span", "donde-aqui", nombreDeVistaEditor(paso));
            aqui.setAttribute("aria-current", "page");
            li.appendChild(aqui);
        } else {
            const b = crearEditor("button", "donde-paso", nombreDeVistaEditor(paso));
            b.type = "button";
            b.addEventListener("click", () => irAEditor(paso));
            li.appendChild(b);
        }
        lista.appendChild(li);
    });
    medirCabeceraEditor();
}

// La cabecera es fija: el cuerpo deja su alto arriba (y lo que se pega
// arriba al bajar, como la barra de botones del redactor, se pone debajo).
// Se vuelve a medir cuando cambia (la letra).
function medirCabeceraEditor() {
    const cabecera = $("[data-cabecera]");
    if (!cabecera) {
        return;
    }
    const alto = document.body.classList.contains("en-mapa") ? 0 : cabecera.offsetHeight;
    document.documentElement.style.setProperty("--alto-cabecera", alto + "px");
}

function empezarMenuEditor() {
    // «Saltar al menú»: al botón del apartado en el que estás.
    $("[data-saltar-menu]").addEventListener("click", (e) => {
        e.preventDefault();
        const primero = document.querySelector('.menu [aria-current]') || document.querySelector(".menu button");
        if (primero) {
            primero.focus();
        }
    });
    // Alt+1 … Alt+9: cada apartado, en el orden del menú (con e.code, que
    // es la tecla y no lo que escribe: con Alt, en algunos teclados, la
    // tecla 1 escribe «|» o «¡»).
    const apartados = [...document.querySelectorAll(".menu [data-ir]")];
    document.addEventListener("keydown", (e) => {
        const n = /^Digit([1-9])$/.exec(e.code || "");
        if (!n || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
            return;
        }
        const b = apartados[Number(n[1]) - 1];
        if (b) {
            e.preventDefault();
            b.click();
        }
    });
    // Los títulos que se ponen después (unas fichas, una página): «Estás
    // en» se repinta cuando cambian.
    const vigia = new MutationObserver(pintarDondeEditor);
    document.querySelectorAll("[data-vista] h1").forEach((h) => vigia.observe(h, { childList: true,
        characterData: true, subtree: true }));
    if (window.ResizeObserver) {
        new ResizeObserver(medirCabeceraEditor).observe($("[data-cabecera]"));
    }
    // Al abrir, «Inicio» ya marcado (si se abre en otro apartado, ir a él
    // lo cambia).
    const inicio = document.querySelector('.menu [data-ir="inicio"]');
    if (inicio && !document.querySelector(".menu [aria-current]")) {
        inicio.setAttribute("aria-current", "page");
    }
    window.addEventListener("resize", medirCabeceraEditor);
    medirCabeceraEditor();
}

// ---- PASAR A LA WEB, CON SU BARRA ----
// El servidor pasa lo de la web en otro hilo (un mapa de campaña y sus
// generadores); aquí se le pregunta cómo va cada
// poco y se enseña en una barra (un <progress> de verdad, que lo lee el
// lector de pantalla). Mientras tanto el aviso lleva aria-busy, para que
// el lector no cante cada porcentaje: dice el resultado al final.
// Devuelve lo que devolvía /api/pasar: {ok, salida, url} o {error, salida}.
async function pasarALaWebEditor(cuerpo) {
    const empezado = await pedirEditor("/api/pasar", cuerpo);
    if (empezado.error) {
        return empezado;
    }
    avisarEditor("Guardado. Pasándolo a la web…");
    const aviso = !$('[data-vista="mapa"]').hidden && $("[data-aviso-mapa]") ? $("[data-aviso-mapa]") : $("[data-aviso]");
    aviso.setAttribute("aria-busy", "true");
    const caja = crearEditor("div", "progreso");
    const etiqueta = crearEditor("span", "progreso-fase", "Empezando…");
    etiqueta.id = "progreso-fase";
    const barra = document.createElement("progress");
    barra.max = 100;
    barra.value = 0;
    barra.setAttribute("aria-labelledby", "progreso-fase");
    const cifra = crearEditor("span", "progreso-cifra", "0%");
    cifra.setAttribute("aria-hidden", "true");
    caja.appendChild(etiqueta);
    caja.appendChild(barra);
    caja.appendChild(cifra);
    aviso.appendChild(caja);
    const empieza = Date.now();
    let estado = {};
    empezarProcesoEditor("Pasándolo a la web…");
    for (;;) {
        await new Promise((r) => setTimeout(r, 400));
        estado = await pedirEditor("/api/pasar/estado?desde=" + PROCESO_EDITOR.desde);
        ponerProcesoEditor(estado, Math.round((Date.now() - empieza) / 1000));
        if (estado.error && !("terminado" in estado)) {
            break;
        }
        const porcentaje = Math.max(0, Math.min(100, Number(estado.porcentaje) || 0));
        barra.value = porcentaje;
        cifra.textContent = porcentaje + "%";
        const segundos = Math.round((Date.now() - empieza) / 1000);
        etiqueta.textContent = (estado.fase || "Pasando") + "… (" + segundos + " s)";
        if (estado.terminado && estado.resultado) {
            break;
        }
    }
    aviso.removeAttribute("aria-busy");
    acabarProcesoEditor(estado.resultado || estado);
    return estado.resultado || estado;
}

// ---- AL EMPEZAR ----
async function empezarEditor() {
    ajustesDeVistaEditor();
    empezarMenuEditor();
    document.querySelectorAll("[data-ir]").forEach((b) => {
        b.addEventListener("click", () => irAEditor(b.getAttribute("data-ir")));
    });
    window.addEventListener("beforeunload", (e) => {
        if ((window.estadoMapa && window.estadoMapa.cambiado)
            || (typeof estadoEscribir !== "undefined" && estadoEscribir.cambiado)
            || (typeof estadoFichas !== "undefined" && estadoFichas.cambiado)) {
            e.preventDefault();
            e.returnValue = "";
        }
    });
    // «editor-wiki.py --en escribir» (lo que usa el menú) lo abre ya en ese
    // apartado: va detrás de la dirección, con #.
    const vista = decodeURIComponent(location.hash.slice(1)).replace(/[^a-z-]/g, "");
    const ir = vista ? document.querySelector('.menu [data-ir="' + vista + '"]') : null;
    if (ir) {
        ir.click();
    }
}


empezarEditor();
