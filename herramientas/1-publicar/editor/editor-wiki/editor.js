// =========================================
// EL EDITOR DE LA WIKI — lo de la página
// =========================================
// Habla con herramientas/1-publicar/editor/editor-wiki.py, que es quien lee y
// escribe los .md. Cuatro vistas (inicio, página nueva, las que faltan y
// escribir) y solo una a la vista; las dos de los mapas están en mapas.js.
// Todo lo que llega del servidor se pone con textContent: un nombre con <
// dentro no es HTML.

const TOKEN_EDITOR = (document.querySelector('meta[name="editor-token"]') || {}).content || "";
let cuentaDeApartadosNuevos = 0;
const estadoEditor = { datos: null, pagina: null, cambiado: false, guardando: false, quitar: [] };

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
    if (vista !== "editar" && estadoEditor.cambiado
        && !window.confirm("Hay cambios sin guardar en esta página. ¿Salir igualmente?")) {
        return;
    }
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
    if (vista !== "editar") {
        estadoEditor.cambiado = false;
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
    $("[data-barra]").hidden = vista !== "editar";
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
// una página de la wiki, un mapa…), con su apartado y, si lo hay, el paso
// de en medio (un mapa cuelga de «Mapas»).
const VISTAS_DE_DENTRO_EDITOR = {
    "nueva-entrada": ["escribir"],
    entrada: ["escribir"],
    nueva: ["wiki"],
    faltan: ["wiki"],
    editar: ["wiki"],
    mapas: ["wiki"],
    mapa: ["wiki", "mapas"],
};
// Las fichas son de un apartado u otro según la colección (fichas.js).
const APARTADO_DE_FICHAS_EDITOR = { escribir: "escribir", campanas: "campanas", recursos: "rol", personajes: "rol",
    wiki: "wiki",
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
    // Alt+1 … Alt+9 y Alt+0: cada apartado, en el orden del menú (con e.code, que
    // es la tecla y no lo que escribe: con Alt, en algunos teclados, la
    // tecla 1 escribe «|» o «¡»).
    const apartados = [...document.querySelectorAll(".menu [data-ir]")];
    document.addEventListener("keydown", (e) => {
        const n = /^Digit([0-9])$/.exec(e.code || "");
        if (!n || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
            return;
        }
        // Alt+0 es el décimo.
        const b = apartados[(Number(n[1]) || 10) - 1];
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
// El servidor pasa la wiki en otro hilo; aquí se le pregunta cómo va cada
// poco y se enseña en una barra (un <progress> de verdad, que lo lee el
// lector de pantalla). Mientras tanto el aviso lleva aria-busy, para que
// el lector no cante cada porcentaje: dice el resultado al final.
// Devuelve lo que devolvía /api/pasar: {ok, salida, url} o {error, salida}.
async function pasarALaWebEditor(cuerpo) {
    const empezado = await pedirEditor("/api/pasar", cuerpo);
    if (empezado.error) {
        return empezado;
    }
    avisarEditor("Guardado. Pasando la wiki a la web…");
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
    empezarProcesoEditor("Pasando la wiki a la web…");
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
    const datos = await pedirEditor("/api/inicio");
    if (datos.error) {
        avisarEditor(datos.error, true);
        return;
    }
    estadoEditor.datos = datos;
    llenarListasEditor();
    pintarTiposEditor();
    pintarFaltanEditor();
    document.querySelectorAll("[data-ir]").forEach((b) => {
        b.addEventListener("click", () => irAEditor(b.getAttribute("data-ir")));
    });
    document.querySelectorAll('[data-ir="wiki"]').forEach((b) => b.addEventListener("click", refrescarArbolWikiEditor));
    $("[data-vista-previa-boton]").addEventListener("click", () => ponerVistaPreviaEditor($("[data-vista-previa]").hidden));
    $("[data-editar]").addEventListener("input", pedirVistaPreviaEditor);
    window.addEventListener("scroll", colocarVistaPreviaEditor, { passive: true });
    window.addEventListener("resize", colocarVistaPreviaEditor);
    // Al salir de la página, la vista previa no estrecha lo demás.
    document.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => {
        document.body.classList.remove("con-vista-previa");
    }));
    empezarMoverEditor();
    $("#wiki-arbol-buscar").addEventListener("input", pintarArbolWikiEditor);
    $("[data-apartado-nuevo-boton]").addEventListener("click", anadirApartadoEditor);
    $("#apartado-nuevo-titulo").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            anadirApartadoEditor();
        }
    });
    pintarArbolWikiEditor();
    $("[data-abrir]").addEventListener("submit", (e) => {
        e.preventDefault();
        abrirPaginaEditor($("#abrir-nombre").value);
    });
    $("[data-nueva]").addEventListener("submit", (e) => {
        e.preventDefault();
        crearPaginaEditor();
    });
    $("[data-guardar]").addEventListener("click", () => guardarEditor(false));
    $("[data-pasar]").addEventListener("click", () => guardarEditor(true));
    $("[data-campo-nuevo]").addEventListener("click", anadirCampoEditor);
    $("[data-editar]").addEventListener("input", () => {
        estadoEditor.cambiado = true;
    });
    $("[data-editar]").addEventListener("submit", (e) => e.preventDefault());
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && estadoEditor.pagina
            && !$('[data-vista="editar"]').hidden) {
            e.preventDefault();
            guardarEditor(false);
        }
    });
    window.addEventListener("beforeunload", (e) => {
        if (estadoEditor.cambiado || (window.estadoMapa && window.estadoMapa.cambiado)
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

function llenarListasEditor() {
    const paginas = $("#lista-paginas");
    paginas.textContent = "";
    estadoEditor.datos.paginas.forEach((n) => {
        const o = document.createElement("option");
        o.value = n;
        paginas.appendChild(o);
    });
    const imagenes = $("#lista-imagenes");
    imagenes.textContent = "";
    estadoEditor.datos.imagenes.forEach((n) => {
        const o = document.createElement("option");
        o.value = n;
        imagenes.appendChild(o);
    });
}

// ---- PÁGINA NUEVA ----
function pintarTiposEditor() {
    const caja = $("[data-tipos]");
    caja.textContent = "";
    const visibles = estadoEditor.datos.plantillas.filter((p) => !p.oculta);
    const todos = visibles.concat([{ id: "", nombre: "En blanco", para: "sin plantilla: solo la cabecera y un apartado", preguntas: [] }]);
    todos.forEach((p, i) => {
        const etiqueta = crearEditor("label", "tipo");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "tipo";
        radio.value = p.id;
        if (i === 0) {
            radio.checked = true;
        }
        const texto = crearEditor("span");
        texto.appendChild(crearEditor("span", "tipo-nombre", p.nombre));
        texto.appendChild(crearEditor("span", "tipo-para", p.para || ""));
        etiqueta.appendChild(radio);
        etiqueta.appendChild(texto);
        radio.addEventListener("change", () => pintarPreguntasEditor());
        caja.appendChild(etiqueta);
    });
    pintarPreguntasEditor();
}

function plantillaElegidaEditor() {
    const radio = document.querySelector('input[name="tipo"]:checked');
    const id = radio ? radio.value : "";
    document.querySelectorAll(".tipo").forEach((t) => {
        t.classList.toggle("es-elegido", !!t.querySelector("input:checked"));
    });
    return estadoEditor.datos.plantillas.find((p) => p.id === id) || null;
}

function campoTextoEditor(id, texto, ayuda, lista) {
    const caja = crearEditor("div", "campo");
    const etiqueta = crearEditor("label", "", texto);
    etiqueta.htmlFor = id;
    caja.appendChild(etiqueta);
    if (ayuda) {
        const p = crearEditor("p", "ayuda", ayuda);
        p.id = id + "-ayuda";
        caja.appendChild(p);
    }
    const input = document.createElement("input");
    input.id = id;
    input.autocomplete = "off";
    if (ayuda) {
        input.setAttribute("aria-describedby", id + "-ayuda");
    }
    if (lista) {
        input.setAttribute("list", lista);
    }
    caja.appendChild(input);
    return caja;
}

function grupoDeOpcionesEditor(nombre, leyenda, opciones, alCambiar) {
    const grupo = crearEditor("fieldset", "opciones campo");
    grupo.appendChild(crearEditor("legend", "", leyenda));
    opciones.forEach(([valor, texto], i) => {
        const etiqueta = crearEditor("label", "opcion");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = nombre;
        radio.value = valor;
        radio.checked = i === 0;
        if (alCambiar) {
            radio.addEventListener("change", alCambiar);
        }
        etiqueta.appendChild(radio);
        etiqueta.appendChild(document.createTextNode(texto));
        grupo.appendChild(etiqueta);
    });
    return grupo;
}

function pintarPreguntasEditor() {
    const caja = $("[data-preguntas]");
    caja.textContent = "";
    const p = plantillaElegidaEditor();
    if (!p) {
        // En blanco: la etiqueta (el apartado de la portada) y qué es.
        caja.appendChild(campoTextoEditor("p-_etiqueta", "Etiqueta", "El apartado de la portada: país, lugar, personaje…"));
        caja.appendChild(campoTextoEditor("p-_que", "Qué es, para la ficha", "«Reino», «Ciudad portuaria»…"));
        return;
    }
    if (p.especial === "raza") {
        const razas = estadoEditor.datos.razas;
        const opciones = [["raza", "Una raza (podrá tener subrazas)"]];
        if (razas.length) {
            opciones.push(["de", "Una subraza de una que ya hay"]);
        }
        opciones.push(["nueva", "Una subraza de una raza que aún no existe (se crea también)"]);
        const deCual = campoTextoEditor("p-_raza_de", "¿De qué raza?", "", "lista-razas");
        let lista = $("#lista-razas");
        if (!lista) {
            lista = document.createElement("datalist");
            lista.id = "lista-razas";
            document.body.appendChild(lista);
        }
        lista.textContent = "";
        razas.forEach((r) => {
            const o = document.createElement("option");
            o.value = r;
            lista.appendChild(o);
        });
        deCual.hidden = true;
        const alCambiar = () => {
            const modo = (document.querySelector('input[name="p-_raza_modo"]:checked') || {}).value;
            deCual.hidden = modo === "raza";
            $("label", deCual).textContent = modo === "nueva" ? "¿Cómo se llama la raza nueva?" : "¿De qué raza?";
            $("input", deCual).setAttribute("list", modo === "nueva" ? "" : "lista-razas");
        };
        caja.appendChild(grupoDeOpcionesEditor("p-_raza_modo", "¿Raza o subraza?", opciones, alCambiar));
        caja.appendChild(deCual);
    }
    p.preguntas.forEach((q) => {
        if (q.tipo === "elige") {
            const opciones = q.opciones.map((o) => [o.valor + "|" + o.uno, o.valor]);
            const grupo = grupoDeOpcionesEditor("p-" + q.clave, q.texto, opciones, () => {
                const elegida = (document.querySelector('input[name="p-' + q.clave + '"]:checked') || {}).value || "";
                otro.hidden = !/^otro\|/i.test(elegida);
            });
            const otro = crearEditor("div", "campo");
            otro.hidden = true;
            otro.appendChild(campoTextoEditor("p-" + q.clave + "-otro", "Escríbelo (en plural si es un apartado: «Cometas»)"));
            otro.appendChild(campoTextoEditor("p-" + q.clave + "-uno", "¿Y uno solo cómo se dice? («Cometa»)"));
            caja.appendChild(grupo);
            caja.appendChild(otro);
            otro.hidden = !/^otro$/i.test((q.opciones[0] || {}).valor || "");
        } else {
            const ayuda = q.tipo === "busca"
                ? "Escribe y elige de la lista. Si no existe, se queda escrito sin enlace." : "";
            caja.appendChild(campoTextoEditor("p-" + q.clave, q.texto.replace(/\s*\(.*?\)\s*$/, ""), ayuda,
                "lista-paginas"));
        }
    });
}

function respuestasEditor(p) {
    const r = { _subtitulo: $("#nueva-subtitulo").value.trim() };
    const valor = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    };
    if (!p) {
        r._etiqueta = valor("p-_etiqueta");
        r._que = valor("p-_que");
        return r;
    }
    if (p.especial === "raza") {
        r._raza_modo = (document.querySelector('input[name="p-_raza_modo"]:checked') || {}).value || "raza";
        r._raza_de = valor("p-_raza_de");
    }
    p.preguntas.forEach((q) => {
        if (q.tipo === "elige") {
            const elegida = (document.querySelector('input[name="p-' + q.clave + '"]:checked') || {}).value || "";
            let [v, uno] = elegida.split("|");
            if (/^otro$/i.test(v || "")) {
                v = valor("p-" + q.clave + "-otro");
                uno = valor("p-" + q.clave + "-uno") || v;
            }
            r[q.clave] = v || "";
            r[q.clave + "_uno"] = uno || v || "";
        } else {
            r[q.clave] = valor("p-" + q.clave);
        }
    });
    return r;
}

async function crearPaginaEditor() {
    const nombre = $("#nueva-nombre").value.trim();
    if (!nombre) {
        avisarEditor("Hace falta el nombre de la página.", true);
        $("#nueva-nombre").focus();
        return;
    }
    const p = plantillaElegidaEditor();
    const boton = $('[data-nueva] button[type="submit"]');
    boton.disabled = true;
    const hecho = await pedirEditor("/api/crear", {
        nombre, plantilla: p ? p.id : "", respuestas: respuestasEditor(p),
    });
    boton.disabled = false;
    if (hecho.error) {
        avisarEditor(hecho.error, true);
        return;
    }
    estadoEditor.datos.paginas.push(nombre);
    (hecho.tambien || []).forEach((a) => estadoEditor.datos.paginas.push(a.split("/").pop().replace(/\.md$/, "")));
    llenarListasEditor();
    $("[data-nueva]").reset();
    pintarTiposEditor();
    estadoEditor.datos.faltan = estadoEditor.datos.faltan.filter((f) => f.nombre.toLowerCase() !== nombre.toLowerCase());
    pintarFaltanEditor();
    await abrirPaginaEditor(nombre);
    const tambien = (hecho.tambien || []).length ? " (y también " + hecho.tambien.join(", ") + ")" : "";
    avisarEditor("Creada: " + hecho.archivo + tambien + ". Ya puedes escribirla aquí.");
}

// ---- LAS QUE FALTAN ----
function pintarFaltanEditor() {
    const lista = $("[data-faltan]");
    lista.textContent = "";
    if (!estadoEditor.datos.faltan.length) {
        lista.appendChild(crearEditor("li", "", "No falta ninguna: todo lo que se enlaza existe."));
        return;
    }
    estadoEditor.datos.faltan.forEach((f) => {
        const li = document.createElement("li");
        const texto = crearEditor("span");
        texto.appendChild(crearEditor("span", "faltan-nombre", f.nombre));
        texto.appendChild(document.createTextNode(" "));
        texto.appendChild(crearEditor("span", "faltan-veces",
            f.veces === 1 ? "la nombra 1 página" : "la nombran " + f.veces + " páginas"));
        const boton = crearEditor("button", "", "Crearla");
        boton.type = "button";
        boton.setAttribute("aria-label", "Crear " + f.nombre);
        boton.addEventListener("click", () => {
            irAEditor("nueva");
            $("#nueva-nombre").value = f.nombre;
            $("#nueva-nombre").focus();
        });
        li.appendChild(texto);
        li.appendChild(boton);
        lista.appendChild(li);
    });
}

// ---- LA VISTA PREVIA ----
// El texto de la página entera (la entradilla y cada apartado con su
// título), pasado a HTML por el servidor con el conversor de la web. En
// pantalla ancha va a la derecha, fija, y la página se estrecha; en
// estrecha, debajo de los botones. Se acuerda de si la tenías puesta.
const VISTA_PREVIA_EDITOR = { pedida: null, ultima: "" };

function cuerpoDeLaPaginaEditor() {
    const trozos = [];
    estadoEditor.pagina.apartados.forEach((a, i) => {
        const caja = document.querySelector('[data-apartado-caja="' + i + '"]');
        if (!caja) {
            return;
        }
        const texto = caja.querySelector("textarea").value;
        trozos.push((a.nivel ? a.linea + "\n\n" : "") + texto);
    });
    return trozos.join("\n\n");
}

function vistaPreviaPuesta() {
    try {
        return localStorage.getItem("editor-wiki-vista-previa") === "si";
    } catch (e) {
        return false;
    }
}

function ponerVistaPreviaEditor(si) {
    try {
        localStorage.setItem("editor-wiki-vista-previa", si ? "si" : "no");
    } catch (e) {
        // Sin almacenamiento: vale para esta vez.
    }
    $("[data-vista-previa-boton]").setAttribute("aria-pressed", si ? "true" : "false");
    $("[data-vista-previa]").hidden = !si;
    document.body.classList.toggle("con-vista-previa", si && !$('[data-vista="editar"]').hidden);
    if (si) {
        VISTA_PREVIA_EDITOR.ultima = "";
        pintarVistaPreviaEditor();
        colocarVistaPreviaEditor();
    }
}

function pedirVistaPreviaEditor() {
    if ($("[data-vista-previa]").hidden) {
        return;
    }
    clearTimeout(VISTA_PREVIA_EDITOR.pedida);
    VISTA_PREVIA_EDITOR.pedida = setTimeout(pintarVistaPreviaEditor, 700);
}

async function pintarVistaPreviaEditor() {
    if (!estadoEditor.pagina || $("[data-vista-previa]").hidden) {
        return;
    }
    const cuerpo = cuerpoDeLaPaginaEditor();
    if (cuerpo === VISTA_PREVIA_EDITOR.ultima) {
        return;
    }
    VISTA_PREVIA_EDITOR.ultima = cuerpo;
    const hecho = await pedirEditor("/api/vista-previa", { cuerpo });
    const caja = $("[data-vista-previa-cuerpo]");
    const avisos = $("[data-vista-previa-avisos]");
    avisos.textContent = "";
    if (hecho.error) {
        caja.textContent = hecho.error;
        return;
    }
    // Lo pinta el servidor con el mismo conversor que la web, que lo escapa
    // todo; aun así se lee en un documento aparte y se pasa por aquí lo
    // que hay, sin nada que se ejecute.
    const raiz = leerHtmlRedactor(hecho.html);
    raiz.querySelectorAll("script, iframe, object, embed, style").forEach((x) => x.remove());
    raiz.querySelectorAll("*").forEach((el) => {
        [...el.attributes].forEach((a) => {
            if (/^on/i.test(a.name)) {
                el.removeAttribute(a.name);
            }
        });
    });
    raiz.querySelectorAll("a[href]").forEach((a) => {
        a.target = "_blank";
        a.rel = "noopener";
    });
    caja.replaceChildren(...raiz.childNodes);
    (hecho.avisos || []).forEach((t) => avisos.appendChild(crearEditor("li", "", "Ojo: " + t)));
}

// Fija a la derecha: arriba, donde acabe la cabecera (que no se tape el
// menú); abajo, donde empiece la barra de guardar.
function colocarVistaPreviaEditor() {
    const panel = $("[data-vista-previa]");
    if (!panel || panel.hidden) {
        return;
    }
    const cabecera = document.querySelector(".cabecera").getBoundingClientRect();
    const barra = document.querySelector(".barra:not([hidden])");
    panel.style.top = Math.max(0, cabecera.bottom) + "px";
    panel.style.bottom = (barra ? barra.offsetHeight : 0) + "px";
}

// ---- MOVER O RENOMBRAR ----
function empezarMoverEditor() {
    const boton = $("[data-mover-boton]");
    boton.addEventListener("click", () => {
        if (!$("#mover-pagina").hidden) {
            cerrarMoverEditor();
            return;
        }
        const pagina = estadoEditor.pagina;
        if (!pagina) {
            return;
        }
        $("#mover-nombre").value = pagina.nombre;
        const carpeta = pagina.archivo.replace(/^wiki\//, "").split("/").slice(0, -1).join("/");
        $("#mover-carpeta").value = carpeta;
        const lista = $("#lista-carpetas-wiki");
        lista.textContent = "";
        (((estadoEditor.datos || {}).arbol || {}).carpetas || []).forEach((c) => {
            const o = document.createElement("option");
            o.value = c;
            lista.appendChild(o);
        });
        $("#mover-pagina").hidden = false;
        boton.setAttribute("aria-expanded", "true");
        $("#mover-nombre").focus();
    });
    $("[data-mover-cancelar]").addEventListener("click", () => {
        cerrarMoverEditor();
        $("[data-mover-boton]").focus();
    });
    $("[data-mover-hacer]").addEventListener("click", moverPaginaEditor);
}

function cerrarMoverEditor() {
    $("#mover-pagina").hidden = true;
    $("[data-mover-boton]").setAttribute("aria-expanded", "false");
}

async function moverPaginaEditor() {
    const pagina = estadoEditor.pagina;
    if (estadoEditor.cambiado) {
        avisarEditor("Primero guarda lo que has cambiado (o ciérrala sin guardar): luego se mueve.", true);
        return;
    }
    const nuevo = $("#mover-nombre").value.trim();
    const carpeta = $("#mover-carpeta").value.trim();
    if (!nuevo) {
        avisarEditor("Hace falta un nombre.", true);
        $("#mover-nombre").focus();
        return;
    }
    const boton = $("[data-mover-hacer]");
    ocuparWeb([boton], true);
    avisarEditor("Moviendo…");
    const hecho = await pedirEditor("/api/mover", { nombre: pagina.nombre, nuevo, carpeta });
    ocuparWeb([boton], false);
    if (hecho.error) {
        avisarEditor(hecho.error, true);
        return;
    }
    cerrarMoverEditor();
    const datos = await pedirEditor("/api/inicio");
    if (!datos.error) {
        estadoEditor.datos = datos;
        llenarListasEditor();
    }
    await abrirPaginaEditor(hecho.nombre);
    avisarEditor("Movida a " + hecho.archivo + (hecho.tocadas ? "; cambiados los enlaces en " + hecho.tocadas
        + (hecho.tocadas === 1 ? " archivo" : " archivos") : "") + ". Pasando la wiki a la web…");
    const pasado = await pasarALaWebEditor({ nombre: hecho.nombre });
    if (pasado.error) {
        avisarEditor(pasado.error, true, pasado.salida);
    } else {
        avisarEditor("Movida y pasada a la web. La dirección vieja lleva a la nueva.", false, pasado.salida);
    }
}

// ---- LAS PÁGINAS, POR CARPETAS ----
// El árbol lo pinta pintarArbolWeb (escribir.js), el mismo de «Escribir».
function pintarArbolWikiEditor() {
    const arbol = (estadoEditor.datos || {}).arbol;
    const lista = $("[data-wiki-arbol]");
    if (!arbol || !lista) {
        return;
    }
    const busca = sinTildesWeb($("#wiki-arbol-buscar").value.trim());
    const vistas = arbol.paginas.filter((p) => !busca || sinTildesWeb(p.nombre).includes(busca));
    $("[data-wiki-arbol-cuantas]").textContent = vistas.length === 1 ? "1 página" : vistas.length + " páginas";
    pintarArbolWeb(lista, vistas.map((p) => ({
        carpeta: p.carpeta ? p.carpeta.split("/") : [],
        fila: () => {
            const li = document.createElement("li");
            li.appendChild(crearEditor("span", "faltan-nombre", p.nombre));
            const b = crearEditor("button", "", "Abrir");
            b.type = "button";
            b.setAttribute("aria-label", "Abrir " + p.nombre);
            b.addEventListener("click", () => abrirPaginaEditor(p.nombre));
            li.appendChild(b);
            return li;
        },
    })), { abrirTodo: !!busca, memoria: "wiki:", unidad: ["página", "páginas"], carpetasPrimero: true, cerradasDeSalida: true,
        vacias: busca ? [] : arbol.carpetas.map((c) => c.split("/")),
        vaciaDice: "Aún no hay ninguna: las nuevas de este tipo vendrán aquí." });
}

// Al volver a la wiki, el árbol al día (puede haber páginas nuevas).
async function refrescarArbolWikiEditor() {
    const datos = await pedirEditor("/api/inicio");
    if (!datos.error) {
        estadoEditor.datos.arbol = datos.arbol;
    }
    pintarArbolWikiEditor();
}

// ---- ESCRIBIR ----
async function abrirPaginaEditor(nombre) {
    nombre = (nombre || "").trim();
    if (!nombre) {
        return;
    }
    const pagina = await pedirEditor("/api/pagina?nombre=" + encodeURIComponent(nombre));
    if (pagina.error) {
        const mas = (pagina.parecidas || []).length ? " ¿Es " + pagina.parecidas.join(", ") + "?" : "";
        avisarEditor(pagina.error + mas, true);
        return;
    }
    estadoEditor.cambiado = false;
    pintarPaginaEditor(pagina);
    irAEditor("editar");
    ponerVistaPreviaEditor(vistaPreviaPuesta());
    cerrarMoverEditor();
    // El borrador automático (escribir.js): lo de sin guardar, cada poco.
    vigilarBorradorWeb("wiki", "wiki:" + pagina.nombre, () => (estadoEditor.cambiado && estadoEditor.pagina
        && estadoEditor.pagina.nombre === pagina.nombre && !$('[data-vista="editar"]').hidden
        ? datosDeLaPaginaEditor() : null));
    await ofrecerBorradorWeb("wiki", $("[data-borrador-wiki]"), datosDeLaPaginaEditor(), ponerBorradorEditor);
}

// Lo que hay escrito ahora en la página abierta (lo que se guarda).
function datosDeLaPaginaEditor() {
    const campos = {};
    document.querySelectorAll("[data-campos] [data-clave]").forEach((el) => {
        campos[el.getAttribute("data-clave")] = el.value;
    });
    // Uno por apartado de los que había; null, el que se ha quitado.
    const apartados = estadoEditor.pagina.apartados.map(() => null);
    document.querySelectorAll("[data-apartado]").forEach((el) => {
        apartados[Number(el.getAttribute("data-apartado"))] = el.value;
    });
    return { campos, apartados, quitar: estadoEditor.quitar.slice(), nuevos: apartadosNuevosEditor() };
}

// Un borrador recuperado, encima de lo que se acaba de abrir.
function ponerBorradorEditor(d) {
    Object.entries(d.campos || {}).forEach(([clave, valor]) => {
        const el = document.querySelector('[data-campos] [data-clave="' + CSS.escape(clave) + '"]');
        if (el) {
            el.value = valor;
        } else if (valor) {
            const caja = datoEditor({ clave, valor, nombre: clave[0].toUpperCase() + clave.slice(1), imagen: false },
                "nuevo-" + clave.replace(/\W/g, ""));
            $("[data-campos]").appendChild(caja);
        }
    });
    (d.quitar || []).forEach((clave) => {
        const el = document.querySelector('[data-campos] [data-clave="' + CSS.escape(clave) + '"]');
        if (el) {
            const caja = el.closest(".dato");
            if (caja.notaDelDato) {
                caja.notaDelDato.remove();
            }
            caja.remove();
        }
        if (!estadoEditor.quitar.includes(clave)) {
            estadoEditor.quitar.push(clave);
        }
    });
    // Los añadidos, cada uno detrás del suyo.
    (d.nuevos || []).slice().reverse().forEach((x) => {
        cuentaDeApartadosNuevos += 1;
        const caja = cajaDeApartadoEditor({ id: "apartado-nuevo-" + cuentaDeApartadosNuevos, nivel: x.nivel,
            titulo: x.titulo, texto: x.texto });
        const tras = document.querySelector('[data-apartado-caja="' + x.despues + '"]');
        if (tras) {
            tras.after(caja);
        } else {
            $("[data-apartados]").appendChild(caja);
        }
    });
    pintarDondeVaElNuevoEditor();
    (d.apartados || []).forEach((texto, i) => {
        const caja = document.querySelector('[data-apartado-caja="' + i + '"]');
        if (!caja) {
            return;
        }
        if (texto === null) {
            caja.remove();
        } else {
            caja.querySelector("textarea").value = texto;
        }
    });
    estadoEditor.cambiado = true;
}

function pintarPaginaEditor(pagina) {
    estadoEditor.pagina = pagina;
    $("[data-editar-titulo]").textContent = pagina.nombre;
    $("[data-editar-archivo]").textContent = "En " + pagina.archivo;
    const ver = $("[data-ver]");
    ver.hidden = !pagina.url;
    ver.href = pagina.url || "#";
    if (window.pintarMapasDePagina) {
        window.pintarMapasDePagina(pagina);
    }

    const campos = $("[data-campos]");
    campos.textContent = "";
    estadoEditor.ultimoDato = null;
    const enlazarFicha = enlazarEditor(() => estadoEditor.ultimoDato, "ficha");
    const donde = crearEditor("span", "enlazar-donde", "Primero pulsa la casilla donde va.");
    donde.setAttribute("data-enlazar-donde", "");
    enlazarFicha.appendChild(donde);
    campos.appendChild(enlazarFicha);
    estadoEditor.quitar = [];
    pagina.campos.forEach((c, i) => {
        if (c.fija || c.clave === "title") {
            return;
        }
        let nota = null;
        if (c.nota) {
            nota = campos.appendChild(crearEditor("p", "dato-nota", c.nota));
        }
        const dato = campos.appendChild(datoEditor(c, i));
        dato.notaDelDato = nota;
    });

    const apartados = $("[data-apartados]");
    apartados.textContent = "";
    pagina.apartados.forEach((a, i) => {
        apartados.appendChild(cajaDeApartadoEditor({ id: "apartado-" + i, nivel: a.nivel, titulo: a.titulo,
            nota: a.nota, texto: a.texto, numero: i }));
    });
    // Debajo de todo: añadir uno nuevo.
    pintarDondeVaElNuevoEditor();
}

// UN APARTADO: su título (con «Quitar»), su nota, los botones y el texto.
// a: {id, nivel, titulo, nota, texto, numero} (numero: el de la página; los
// nuevos, sin él, llevan data-apartado-nuevo).
function cajaDeApartadoEditor(a) {
    const caja = crearEditor("div", "apartado");
    const id = a.id;
    if (a.numero !== undefined) {
        caja.setAttribute("data-apartado-caja", String(a.numero));
    }
    const cab = crearEditor("div", "apartado-cabeza");
    const titulo = crearEditor("label", "apartado-titulo nivel-" + a.nivel,
        a.nivel ? a.titulo : "La entradilla (el primer párrafo)");
    titulo.htmlFor = id;
    cab.appendChild(titulo);
    if (a.nivel) {
        // Quitar el apartado entero (con su título y lo que tenga dentro:
        // los ### de debajo de un ##). Uno nuevo, sin preguntar.
        const quitar = crearEditor("button", "quitar-pequeno", "Quitar");
        quitar.type = "button";
        quitar.setAttribute("aria-label", "Quitar el apartado «" + a.titulo + "»");
        quitar.addEventListener("click", () => {
            if (a.numero !== undefined) {
                quitarApartadoEditor(a.numero);
                return;
            }
            const siguiente = caja.nextElementSibling && caja.nextElementSibling.querySelector("textarea");
            caja.remove();
            estadoEditor.cambiado = true;
            pedirVistaPreviaEditor();
            pintarDondeVaElNuevoEditor();
            avisarEditor("Quitado «" + a.titulo + "» (aún no estaba guardado).");
            (siguiente || $("#apartado-nuevo-titulo")).focus();
        });
        cab.appendChild(quitar);
    }
    caja.appendChild(cab);
    let ayuda = a.nota;
    if (!a.nivel && !ayuda) {
        ayuda = "Qué es, en una o dos frases. Es lo que sale en la portada y en el buscador.";
    }
    if (ayuda) {
        const nota = crearEditor("p", "apartado-nota", ayuda);
        nota.id = id + "-nota";
        caja.appendChild(nota);
    }
    const area = document.createElement("textarea");
    area.id = id;
    area.value = a.texto || "";
    if (a.numero !== undefined) {
        area.setAttribute("data-apartado", String(a.numero));
    } else {
        caja.setAttribute("data-apartado-nuevo", "");
        caja.dataset.titulo = a.titulo;
        caja.dataset.nivel = String(a.nivel);
    }
    area.rows = Math.min(18, Math.max(4, (a.texto || "").split("\n").length + 2));
    if (ayuda) {
        area.setAttribute("aria-describedby", id + "-nota");
    }
    // Encima, los botones de formato (los mismos que en las entradas, pero
    // poniendo el Markdown de la wiki).
    // Las imágenes del texto van a la bóveda (wiki/_imagenes), como las
    // que pone Chronicler, y se nombran ![[así.webp|lo que se ve]].
    caja.appendChild(crearBarraMarkdown(area, a.nivel ? a.titulo : "la entradilla", () => {
        estadoEditor.cambiado = true;
    }, { imagenes: () => ({ sitio: "mundo" }) }));
    caja.appendChild(area);
    caja.appendChild(enlazarEditor(area, id));
    return caja;
}

// ---- AÑADIR UN APARTADO ----
// El nivel: el de los apartados que ya tiene la página (normalmente ##), o
// uno más para un subapartado. Va donde se diga: detrás de un apartado (y
// de lo que tenga dentro) o al final. Se guarda con lo demás.
function nivelBaseEditor() {
    const niveles = (estadoEditor.pagina.apartados || []).map((a) => a.nivel).filter((n) => n > 0);
    return niveles.length ? Math.min(...niveles) : 2;
}

// Las cajas que hay ahora, en orden: [{caja, titulo, nivel}].
function apartadosEnPantallaEditor() {
    return [...document.querySelectorAll("[data-apartados] > .apartado")].map((caja) => {
        if (caja.hasAttribute("data-apartado-nuevo")) {
            return { caja, titulo: caja.dataset.titulo, nivel: Number(caja.dataset.nivel) };
        }
        const a = estadoEditor.pagina.apartados[Number(caja.getAttribute("data-apartado-caja"))];
        return { caja, titulo: a.nivel ? a.titulo : "la entradilla", nivel: a.nivel };
    });
}

function pintarDondeVaElNuevoEditor() {
    const elegir = $("#apartado-nuevo-sitio");
    if (!elegir || !estadoEditor.pagina) {
        return;
    }
    const antes = elegir.value;
    elegir.textContent = "";
    const fin = document.createElement("option");
    fin.value = "fin";
    fin.textContent = "Al final";
    elegir.appendChild(fin);
    apartadosEnPantallaEditor().forEach((x, i) => {
        const o = document.createElement("option");
        o.value = String(i);
        o.textContent = "Después de «" + x.titulo + "»" + (x.nivel > nivelBaseEditor() ? " (dentro)" : "");
        elegir.appendChild(o);
    });
    if ([...elegir.options].some((o) => o.value === antes)) {
        elegir.value = antes;
    }
}

function anadirApartadoEditor() {
    const titulo = $("#apartado-nuevo-titulo").value.trim().replace(/^#+\s*/, "");
    if (!titulo || !estadoEditor.pagina) {
        avisarEditor("Escribe el título del apartado nuevo.", true);
        $("#apartado-nuevo-titulo").focus();
        return;
    }
    const nivel = nivelBaseEditor() + ($("#apartado-nuevo-sub").checked ? 1 : 0);
    const cajas = apartadosEnPantallaEditor();
    const sitio = $("#apartado-nuevo-sitio").value;
    cuentaDeApartadosNuevos += 1;
    const caja = cajaDeApartadoEditor({ id: "apartado-nuevo-" + cuentaDeApartadosNuevos, nivel, titulo, texto: "" });
    if (sitio === "fin" || !cajas[Number(sitio)]) {
        $("[data-apartados]").appendChild(caja);
    } else {
        // Detrás de ese y de lo que tenga dentro (los de más nivel).
        const i = Number(sitio);
        let ultimo = i;
        while (cajas[ultimo + 1] && cajas[i].nivel > 0 && cajas[ultimo + 1].nivel > cajas[i].nivel) {
            ultimo += 1;
        }
        cajas[ultimo].caja.after(caja);
    }
    estadoEditor.cambiado = true;
    $("#apartado-nuevo-titulo").value = "";
    pintarDondeVaElNuevoEditor();
    pedirVistaPreviaEditor();
    avisarEditor("Añadido «" + titulo + "». Escribe su texto; se guarda con lo demás.");
    caja.querySelector("textarea").focus();
}

// Los nuevos, para guardar: cada uno detrás del apartado de la página que
// tenga justo antes (despues: su número; -1, si no hay ninguno antes).
function apartadosNuevosEditor() {
    const salida = [];
    let anterior = -1;
    document.querySelectorAll("[data-apartados] > .apartado").forEach((caja) => {
        if (caja.hasAttribute("data-apartado-caja")) {
            anterior = Number(caja.getAttribute("data-apartado-caja"));
            return;
        }
        salida.push({ titulo: caja.dataset.titulo, nivel: Number(caja.dataset.nivel),
            texto: caja.querySelector("textarea").value, despues: anterior });
    });
    return salida;
}

function datoEditor(c, i) {
    const caja = crearEditor("div", "dato");
    const id = "dato-" + i;
    const cab = crearEditor("div", "dato-cabeza");
    const etiqueta = crearEditor("label", "", c.nombre);
    etiqueta.htmlFor = id;
    cab.appendChild(etiqueta);
    // Quitar el dato de la ficha (la línea del .md entera, no dejarlo vacío).
    const quitar = crearEditor("button", "quitar-pequeno", "Quitar");
    quitar.type = "button";
    quitar.setAttribute("aria-label", "Quitar el dato «" + c.nombre + "» de la ficha");
    quitar.addEventListener("click", () => quitarDatoEditor(caja, c));
    cab.appendChild(quitar);
    caja.appendChild(cab);
    const input = document.createElement("input");
    input.id = id;
    input.value = c.valor;
    input.autocomplete = "off";
    input.setAttribute("data-clave", c.clave);
    if (c.imagen) {
        input.setAttribute("list", "lista-imagenes");
    }
    caja.appendChild(input);
    if (c.imagen) {
        caja.appendChild(subirImagenEditor(input, c.clave, id));
    } else if (!["subtitle", "infobox", "tags"].includes(c.clave)) {
        // El enlace de la ficha se pone con el buscador de arriba, en la
        // última casilla en la que se haya escrito.
        input.addEventListener("focus", () => {
            estadoEditor.ultimoDato = input;
            const donde = $("[data-enlazar-donde]");
            if (donde) {
                donde.textContent = "Irá en: " + c.nombre;
            }
        });
    }
    return caja;
}

// Un trocito para poner un [[enlace]] donde está el cursor: se escribe el
// nombre (con la lista de las páginas que hay) y «Poner enlace».
function enlazarEditor(dondeVa, id) {
    // dondeVa: la casilla o el recuadro, o una función que diga cuál (el
    // de la ficha sirve para todas sus casillas).
    const destinoDe = () => (typeof dondeVa === "function" ? dondeVa() : dondeVa);
    const cursores = new WeakMap();
    const caja = crearEditor("div", "enlazar");
    const idBusca = id + "-enlace";
    const etiqueta = crearEditor("label", "", "Enlazar una página:");
    etiqueta.htmlFor = idBusca;
    const busca = document.createElement("input");
    busca.id = idBusca;
    busca.setAttribute("list", "lista-paginas");
    busca.autocomplete = "off";
    const boton = crearEditor("button", "", "Poner enlace");
    boton.type = "button";
    // Dónde estaba el cursor en cada casilla al salir de ella: el enlace va
    // ahí y no al final.
    const apuntar = (e) => {
        cursores.set(e.target, [e.target.selectionStart, e.target.selectionEnd]);
    };
    if (typeof dondeVa !== "function") {
        ["keyup", "click", "select", "blur"].forEach((t) => dondeVa.addEventListener(t, apuntar));
    } else {
        ["keyup", "click", "select", "blur"].forEach((t) => document.addEventListener(t, (e) => {
            if (e.target instanceof HTMLInputElement && e.target.hasAttribute("data-clave")) {
                apuntar(e);
            }
        }, true));
    }
    const poner = () => {
        const destino = destinoDe();
        const nombre = busca.value.trim().replace(/^\[\[|\]\]$/g, "");
        if (!destino) {
            avisarEditor("Primero pulsa la casilla de la ficha donde va el enlace.", true);
            return;
        }
        if (!nombre) {
            busca.focus();
            return;
        }
        const cursor = cursores.get(destino);
        const [a, b] = cursor || [destino.value.length, destino.value.length];
        const elegido = destino.value.slice(a, b);
        // Si había un trozo de texto elegido, se queda como lo que se lee:
        // [[Valderín|la ciudad]].
        const enlace = elegido && elegido !== nombre ? "[[" + nombre + "|" + elegido + "]]" : "[[" + nombre + "]]";
        destino.value = destino.value.slice(0, a) + enlace + destino.value.slice(b);
        const fin = a + enlace.length;
        destino.focus();
        destino.setSelectionRange(fin, fin);
        cursores.set(destino, [fin, fin]);
        busca.value = "";
        estadoEditor.cambiado = true;
        avisarEditor("Enlace puesto: " + enlace);
    };
    boton.addEventListener("click", poner);
    busca.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            poner();
        }
    });
    caja.appendChild(etiqueta);
    caja.appendChild(busca);
    caja.appendChild(boton);
    return caja;
}

function subirImagenEditor(input, clave, id) {
    const caja = crearEditor("div", "dato-imagen");
    const muestra = document.createElement("img");
    muestra.alt = "";
    const verMuestra = () => {
        const v = input.value.trim();
        const limpio = /^[\w\-. ]+\.(webp|png|jpe?g|gif|svg)$/i.test(v) ? v : "";
        muestra.hidden = !limpio;
        if (limpio) {
            const enBanderas = /^(bandera|blasón|blason|escudo)$/i.test(clave);
            muestra.src = "/wiki/_imagenes/" + (enBanderas ? "banderas/" : "") + encodeURIComponent(limpio);
            muestra.onerror = () => {
                if (enBanderas && !muestra.dataset.otra) {
                    muestra.dataset.otra = "1";
                    muestra.src = "/wiki/_imagenes/" + encodeURIComponent(limpio);
                } else {
                    muestra.hidden = true;
                }
            };
        }
    };
    input.addEventListener("change", verMuestra);
    verMuestra();
    caja.appendChild(muestra);

    const subir = crearEditor("div", "subir");
    const archivo = document.createElement("input");
    archivo.type = "file";
    archivo.accept = "image/*";
    archivo.id = id + "-subir";
    const etiqueta = crearEditor("label", "boton", "Subir una imagen de tu ordenador");
    etiqueta.htmlFor = archivo.id;
    subir.appendChild(archivo);
    subir.appendChild(etiqueta);
    caja.appendChild(subir);

    const ruta = crearEditor("div", "fila");
    const idRuta = id + "-ruta";
    const etRuta = crearEditor("label", "", "…o pega su ruta (e:\\Descargas\\mapa.png):");
    etRuta.htmlFor = idRuta;
    const campoRuta = document.createElement("input");
    campoRuta.id = idRuta;
    campoRuta.autocomplete = "off";
    const traer = crearEditor("button", "", "Traerla");
    traer.type = "button";
    ruta.appendChild(etRuta);
    ruta.appendChild(campoRuta);
    ruta.appendChild(traer);
    caja.appendChild(ruta);

    const hecha = (respuesta) => {
        if (respuesta.error) {
            avisarEditor(respuesta.error, true);
            return;
        }
        input.value = respuesta.nombre;
        estadoEditor.cambiado = true;
        if (!estadoEditor.datos.imagenes.includes(respuesta.nombre)) {
            estadoEditor.datos.imagenes.push(respuesta.nombre);
            llenarListasEditor();
        }
        verMuestra();
        avisarEditor("Imagen lista: " + respuesta.nombre + " (" + (respuesta.aviso || "") + "). Recuerda guardar.");
    };
    archivo.addEventListener("change", () => {
        const elegido = archivo.files && archivo.files[0];
        if (!elegido) {
            return;
        }
        avisarEditor("Preparando la imagen…");
        const lector = new FileReader();
        lector.onload = async () => {
            hecha(await pedirEditor("/api/imagen", {
                campo: clave, pagina: estadoEditor.pagina.nombre, archivo: elegido.name, datos: lector.result,
            }));
            archivo.value = "";
        };
        lector.readAsDataURL(elegido);
    });
    traer.addEventListener("click", async () => {
        if (!campoRuta.value.trim()) {
            campoRuta.focus();
            return;
        }
        avisarEditor("Trayendo la imagen…");
        hecha(await pedirEditor("/api/imagen", {
            campo: clave, pagina: estadoEditor.pagina.nombre, ruta: campoRuta.value.trim(),
        }));
        campoRuta.value = "";
    });
    return caja;
}

// ---- QUITAR UN DATO O UN APARTADO ----
// Se ven quitados al momento y se quitan del .md al guardar. El foco pasa
// a lo siguiente (o a lo de antes), no al principio de la página.
function quitarDatoEditor(caja, c) {
    const siguiente = caja.nextElementSibling && caja.nextElementSibling.querySelector("input")
        ? caja.nextElementSibling.querySelector("input")
        : (caja.previousElementSibling && caja.previousElementSibling.querySelector
            && caja.previousElementSibling.querySelector("input"));
    if (!estadoEditor.quitar.includes(c.clave)) {
        estadoEditor.quitar.push(c.clave);
    }
    if (caja.notaDelDato) {
        caja.notaDelDato.remove();
    }
    caja.remove();
    estadoEditor.cambiado = true;
    avisarEditor("Quitado «" + c.nombre + "». Se va del todo al guardar (para volver atrás, cierra sin guardar"
        + " o añádelo otra vez abajo).");
    if (siguiente) {
        siguiente.focus();
    }
}

function quitarApartadoEditor(i) {
    const aps = estadoEditor.pagina.apartados;
    const nivel = aps[i].nivel;
    // Los de dentro: los que vienen detrás con más nivel.
    const dentro = [];
    for (let j = i + 1; j < aps.length && aps[j].nivel > nivel; j += 1) {
        dentro.push(j);
    }
    const nombres = dentro.map((j) => aps[j].titulo).filter((t, k) => document.querySelector('[data-apartado-caja="'
        + dentro[k] + '"]'));
    if (!window.confirm("¿Quitar el apartado «" + aps[i].titulo + "» con todo su texto"
        + (nombres.length ? " (y lo que tiene dentro: " + nombres.join(", ") + ")" : "") + "?")) {
        return;
    }
    let despues = null;
    [i].concat(dentro).forEach((j) => {
        const caja = document.querySelector('[data-apartado-caja="' + j + '"]');
        if (caja) {
            despues = caja.nextElementSibling || despues;
            caja.remove();
        }
    });
    estadoEditor.cambiado = true;
    pedirVistaPreviaEditor();
    pintarDondeVaElNuevoEditor();
    avisarEditor("Quitado «" + aps[i].titulo + "». Se va del .md al guardar.");
    const foco = (despues && despues.isConnected ? despues : document.querySelector("[data-apartados] .apartado:last-child"));
    const area = foco && foco.querySelector("textarea");
    if (area) {
        area.focus();
    }
}

function anadirCampoEditor() {
    const clave = $("#campo-nuevo-clave");
    const nombre = clave.value.trim().replace(/:/g, "");
    if (!nombre || !estadoEditor.pagina) {
        clave.focus();
        return;
    }
    if (document.querySelector('[data-clave="' + CSS.escape(nombre) + '"]')) {
        avisarEditor("Ese dato ya está en la ficha.", true);
        return;
    }
    // Si se había quitado, ya no se quita: vuelve.
    estadoEditor.quitar = estadoEditor.quitar.filter((q) => q !== nombre);
    const c = { clave: nombre, valor: "", nombre: nombre[0].toUpperCase() + nombre.slice(1), imagen: false };
    const caja = datoEditor(c, "nuevo-" + Date.now());
    $("[data-campos]").appendChild(caja);
    clave.value = "";
    $("input", caja).focus();
}

async function guardarEditor(yPasar) {
    if (!estadoEditor.pagina || estadoEditor.guardando) {
        return;
    }
    estadoEditor.guardando = true;
    const botones = document.querySelectorAll("[data-guardar], [data-pasar]");
    botones.forEach((b) => {
        b.disabled = true;
    });
    const { campos, apartados, nuevos } = datosDeLaPaginaEditor();
    const quitado = estadoEditor.quitar.length > 0 || apartados.some((a) => a === null) || nuevos.length > 0;
    avisarEditor("Guardando…");
    const hecho = await pedirEditor("/api/guardar", { nombre: estadoEditor.pagina.nombre, campos, apartados,
        quitar: estadoEditor.quitar, nuevos });
    if (hecho.error) {
        avisarEditor(hecho.error, true);
    } else {
        estadoEditor.cambiado = false;
        borrarBorradorWeb("wiki");
        estadoEditor.pagina = hecho.pagina;
        if (quitado) {
            // Lo quitado cambia los números de los apartados: se pinta otra
            // vez desde lo guardado.
            const y = window.scrollY;
            pintarPaginaEditor(hecho.pagina);
            window.scrollTo(0, y);
        }
        if (!yPasar) {
            avisarEditor("Guardado en " + hecho.pagina.archivo + ".");
        } else {
            const pasado = await pasarALaWebEditor({ nombre: estadoEditor.pagina.nombre });
            if (pasado.error) {
                avisarEditor(pasado.error, true, pasado.salida);
            } else {
                const ver = $("[data-ver]");
                ver.hidden = !pasado.url;
                ver.href = pasado.url || "#";
                avisarEditor(pasado.url ? "Guardado y pasado a la web. Ya puedes verla con «Ver cómo queda»."
                    : "Guardado y pasado a la web.", false, pasado.salida);
            }
        }
    }
    botones.forEach((b) => {
        b.disabled = false;
    });
    estadoEditor.guardando = false;
}

empezarEditor();
