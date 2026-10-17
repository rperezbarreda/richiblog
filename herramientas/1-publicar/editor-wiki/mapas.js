// =========================================
// EL EDITOR DE LA WIKI — los mapas
// =========================================
// Dos vistas: la lista de mapas (con el formulario para hacer uno nuevo) y
// el editor de un mapa. El mapa es un SVG con el viewBox del lienzo del
// .cmap (sus coordenadas son píxeles de la imagen), así que acercar y
// moverse es cambiar el viewBox. Lo que mide lo mismo en pantalla a
// cualquier zoom (los sitios, los puntos para arrastrar, las flechas, el
// grosor de las rayas) se escala al revés: con scale() y con
// vector-effect: non-scaling-stroke. Los textos sueltos («Mar de las
// Brumas») son del mapa: crecen con el zoom, como en la web.
//
// El .cmap se guarda ENTERO: llega del servidor, se cambian aquí solo las
// cosas que se tocan (label, targetPage, kind, color, x/y, points, size,
// angle, taper, scale) y vuelve tal cual con lo que traiga de Chronicler.
// El formato está explicado en herramientas/3-generadores/mundo_mapas.py.
// Usa $, crearEditor, pedirEditor, avisarEditor e irAEditor de editor.js.

const SVG_MAPA = "http://www.w3.org/2000/svg";
// [valor, nombre, símbolo, color de la bola]. Los mismos que
// TIPOS_DE_PIN en mundo_mapas.py.
const TIPOS_DE_SITIO = [
    ["capital", "Capital", "★", "#f5ce6c"],
    ["ciudad", "Ciudad", "◉", "#f4f1f7"],
    ["pueblo", "Pueblo", "●", "#e0c9a6"],
    ["fortaleza", "Fortaleza", "♜", "#b9b3c2"],
    ["ruina", "Ruina", "✕", "#8d8478"],
    ["puerto", "Puerto", "⚓", "#ece6f2"],
    ["templo", "Templo", "⛩", "#ece6f2"],
    ["torre", "Torre", "♖", "#ece6f2"],
    ["cueva", "Cueva", "⌓", "#ece6f2"],
    ["mina", "Mina", "⛏", "#ece6f2"],
    ["puente", "Puente", "⌒", "#ece6f2"],
    ["batalla", "Campo de batalla", "⚔", "#ece6f2"],
    ["mazmorra", "Mazmorra", "☠", "#ece6f2"],
    ["campamento", "Campamento", "⛺", "#ece6f2"],
];
const LETRA_DE_SIMBOLOS = '"Segoe UI Symbol", "Noto Sans Symbols 2", "Noto Sans Symbols", "DejaVu Sans", sans-serif';
// Las rayas y cómo se pintan: los mismos colores y trazos que la web
// (estilos/paginas/mundo-mapa.css). ancho y borde en píxeles de pantalla.
const TIPOS_DE_RAYA = [
    ["camino", "Camino"], ["rio", "Río"], ["frontera", "Frontera"],
    ["maritima", "Ruta marítima"], ["muralla", "Muralla"], ["ruta", "Ruta de viaje"],
];
const ESTILO_DE_RAYA = {
    camino: { color: "#f0dfb4", ancho: 3.5, borde: 6.5, trazos: [10, 7] },
    rio: { color: "#4aa3df", ancho: 4.5, borde: 7, trazos: null },
    frontera: { color: "#8e1b3b", ancho: 3, borde: 6, colorBorde: "#f4f1f7", trazos: [12, 5, 2, 5], corte: "butt",
        bordeConTrazos: true },
    maritima: { color: "#e6f4ff", ancho: 4, borde: 6.5, trazos: [0.5, 8], bordeConTrazos: true },
    muralla: { color: "#a39a90", ancho: 6, borde: 9, trazos: null, corte: "butt" },
    ruta: { color: "#e8446f", ancho: 3.5, borde: 6, trazos: [9, 6], flechas: true },
};
// El tamaño de un texto suelto: el lado largo del mapa entre esto.
const TAMANOS_DE_TEXTO = [["grande", "Grande", 45], ["mediano", "Mediano", 70], ["pequeno", "Pequeño", 110]];
// Los colores que van tomando las regiones nuevas, uno detrás de otro.
const COLORES_DE_REGION = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22", "#1abc9c"];
// Cuánto se anda en un día, según la unidad de la escala (se puede
// cambiar en el panel de medir).
const VIAJE_POR_UNIDAD = { leguas: { "a pie": 8, "a caballo": 12 }, km: { "a pie": 30, "a caballo": 50 },
    millas: { "a pie": 20, "a caballo": 30 } };
const PASOS_QUE_SE_RECUERDAN = 80;

const estadoMapa = {
    archivo: "", datos: null, imagenes: {}, url: "", cambiado: false, guardando: false,
    herramienta: "elegir", elegido: null, dibujo: null, vista: null, capasOcultas: {},
    arrastre: null, cuantasRegiones: 0, iman: null, sinIman: false, medida: [], ratonMedida: null,
    ultimoCampo: null,
};
window.estadoMapa = estadoMapa;
const historiaMapa = { atras: [], adelante: [] };

function svgMapa(etiqueta, atributos) {
    const el = document.createElementNS(SVG_MAPA, etiqueta);
    Object.entries(atributos || {}).forEach(([k, v]) => el.setAttribute(k, String(v)));
    return el;
}

function idNuevoMapa() {
    const bytes = new Uint8Array(8);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function redondoMapa(n) {
    return Math.round(n * 10) / 10;
}

function cifraMapa(n, decimales) {
    return Number(n).toLocaleString("es-ES", { maximumFractionDigits: decimales === undefined ? 1 : decimales });
}

function tipoDeSitioMapa(kind) {
    return TIPOS_DE_SITIO.find((t) => t[0] === kind) || null;
}

function estiloDeRaya(kind) {
    return ESTILO_DE_RAYA[kind] || ESTILO_DE_RAYA.camino;
}

function tamanoDeTexto(cosa) {
    const t = TAMANOS_DE_TEXTO.find((x) => x[0] === cosa.size) || TAMANOS_DE_TEXTO[1];
    const d = estadoMapa.datos;
    return Math.max(d.width, d.height) / t[2];
}

// ---- LA LISTA DE MAPAS ----
async function pintarListaDeMapas() {
    const lista = $("[data-mapas-lista]");
    const hay = await pedirEditor("/api/mapas");
    lista.textContent = "";
    if (hay.error) {
        avisarEditor(hay.error, true);
        return;
    }
    if (!hay.mapas.length) {
        lista.appendChild(crearEditor("li", "", "Aún no hay ninguno."));
        return;
    }
    hay.mapas.forEach((m) => {
        const li = document.createElement("li");
        const texto = crearEditor("span");
        texto.appendChild(crearEditor("span", "faltan-nombre", m.titulo));
        texto.appendChild(document.createTextNode(" "));
        const cuenta = [m.pines + (m.pines === 1 ? " sitio" : " sitios"),
            m.regiones + (m.regiones === 1 ? " región" : " regiones"),
            m.rayas + (m.rayas === 1 ? " camino, río…" : " caminos, ríos…")].join(" · ");
        texto.appendChild(crearEditor("span", "faltan-veces",
            (m.pagina ? "de " + m.pagina + " · " : "") + cuenta));
        const boton = crearEditor("button", "", "Editar");
        boton.type = "button";
        boton.setAttribute("aria-label", "Editar " + m.titulo);
        boton.addEventListener("click", () => abrirMapa(m.archivo));
        li.appendChild(texto);
        li.appendChild(boton);
        lista.appendChild(li);
    });
}

// En la página que se está escribiendo: su mapa, o cómo hacerle uno.
function pintarMapasDePagina(pagina) {
    const caja = $("[data-pagina-mapas]");
    caja.textContent = "";
    (pagina.mapas || []).forEach((m) => {
        const boton = crearEditor("button", "", "🗺 Editar su mapa: " + m.titulo);
        boton.type = "button";
        boton.addEventListener("click", () => abrirMapa(m.archivo));
        caja.appendChild(boton);
    });
    if (!(pagina.mapas || []).length) {
        const boton = crearEditor("button", "", "🗺 Hacerle un mapa");
        boton.type = "button";
        boton.addEventListener("click", () => {
            irAEditor("mapas");
            if (!$('[data-vista="mapas"]').hidden) {
                pintarListaDeMapas();
                $("#mapa-nuevo-pagina").value = pagina.nombre;
                $("#mapa-nuevo-titulo").focus();
            }
        });
        caja.appendChild(boton);
    }
}
window.pintarMapasDePagina = pintarMapasDePagina;

function leerImagenMapa(input) {
    return new Promise((resolver) => {
        const elegido = input.files && input.files[0];
        if (!elegido) {
            resolver(null);
            return;
        }
        const lector = new FileReader();
        lector.onload = () => resolver({ archivo: elegido.name, datos: lector.result });
        lector.onerror = () => resolver(null);
        lector.readAsDataURL(elegido);
    });
}

async function hacerMapaNuevo() {
    const archivo = $("#mapa-nuevo-archivo");
    const ruta = $("#mapa-nuevo-ruta").value.trim();
    const imagen = await leerImagenMapa(archivo);
    if (!imagen && !ruta) {
        avisarEditor("Falta la imagen del mapa: elígela o pega su ruta.", true);
        $("#mapa-nuevo-ruta").focus();
        return;
    }
    const boton = $('[data-mapa-nuevo] button[type="submit"]');
    boton.disabled = true;
    avisarEditor("Preparando la imagen y el mapa…");
    const hecho = await pedirEditor("/api/mapa/nuevo", Object.assign({
        pagina: $("#mapa-nuevo-pagina").value.trim(), titulo: $("#mapa-nuevo-titulo").value.trim(),
    }, imagen || { ruta }));
    boton.disabled = false;
    if (hecho.error) {
        avisarEditor(hecho.error, true);
        return;
    }
    $("[data-mapa-nuevo]").reset();
    $("[data-mapa-nuevo-elegida]").textContent = "";
    ponerMapa(hecho.mapa);
    irAEditor("mapa");
    avisarEditor("Hecho: " + hecho.mapa.archivo + ". Ya puedes poner sitios y pintar.");
}

// ---- ABRIR UN MAPA ----
async function abrirMapa(archivo) {
    if (estadoMapa.cambiado && estadoMapa.archivo !== archivo
        && !window.confirm("Hay cambios sin guardar en este mapa. ¿Abrir el otro igualmente?")) {
        return;
    }
    const mapa = await pedirEditor("/api/mapa?archivo=" + encodeURIComponent(archivo));
    if (mapa.error) {
        avisarEditor(mapa.error, true);
        return;
    }
    estadoMapa.cambiado = false;
    ponerMapa(mapa);
    irAEditor("mapa");
}

function completarDatosMapa(d) {
    ["pins", "shapes", "lines", "layers"].forEach((k) => {
        if (!Array.isArray(d[k])) {
            d[k] = [];
        }
    });
    // Los textos sueltos son de esta web: si el mapa no tiene, la lista no
    // se escribe en el archivo hasta que haya alguno (ver guardarMapa).
    if (!Array.isArray(d.labels)) {
        d.labels = [];
    }
    return d;
}

function ponerMapa(mapa) {
    const d = completarDatosMapa(mapa.datos);
    Object.assign(estadoMapa, {
        archivo: mapa.archivo, datos: d, imagenes: mapa.imagenes || {}, url: mapa.url || "",
        cambiado: false, elegido: null, dibujo: null, capasOcultas: {}, cuantasRegiones: d.shapes.length,
        medida: [], ratonMedida: null, iman: null, ultimoCampo: null,
    });
    historiaMapa.atras = [];
    historiaMapa.adelante = [];
    pintarBotonesDeHistoria();
    // Las capas que estaban apagadas al guardar en Chronicler, apagadas aquí
    // también (se pueden encender en «El mapa en sí»).
    d.layers.forEach((c) => {
        if (c.visible === false) {
            estadoMapa.capasOcultas[c.id] = true;
        }
    });
    pintarDatosGenerales();
    pintarVerMapa();
    pintarCapasMapa();
    // La vista, entera; y luego el dibujo.
    estadoMapa.vista = null;
    pintarTodoElMapa();
    pintarMedida();
    requestAnimationFrame(ajustarMapa);
}

function pintarDatosGenerales() {
    const d = estadoMapa.datos;
    $("[data-mapa-archivo]").textContent = "En wiki/" + estadoMapa.archivo + " · " + d.width + " × " + d.height + " px";
    $("#mapa-titulo").value = d.title || "";
    $("#mapa-pagina").value = d.page || "";
    $("[data-mapa-cambiar-imagen]").hidden = d.layers.length !== 1;
    pintarTituloMapa();
}

function pintarTituloMapa() {
    $("[data-mapa-titulo]").textContent = estadoMapa.datos.title || estadoMapa.archivo;
}

function pintarVerMapa() {
    const ver = $("[data-mapa-ver]");
    ver.hidden = !estadoMapa.url;
    ver.href = estadoMapa.url || "#";
}

function pintarCapasMapa() {
    const caja = $("[data-mapa-capas]");
    caja.textContent = "";
    const capas = estadoMapa.datos.layers;
    $("[data-mapa-capas-caja]").hidden = capas.length < 2;
    capas.forEach((c, i) => {
        const etiqueta = crearEditor("label", "opcion");
        const casilla = document.createElement("input");
        casilla.type = "checkbox";
        casilla.checked = !estadoMapa.capasOcultas[c.id];
        casilla.addEventListener("change", () => {
            estadoMapa.capasOcultas[c.id] = !casilla.checked;
            pintarFondoMapa();
        });
        etiqueta.appendChild(casilla);
        etiqueta.appendChild(document.createTextNode(c.name || "Capa " + (i + 1)));
        caja.appendChild(etiqueta);
    });
}

// ---- DESHACER Y REHACER ----
// Antes de cada cambio se apunta cómo estaba el mapa entero (en texto: así
// no hay que andar copiando cosas por dentro). Lo que se cambia a golpes
// seguidos —escribir un nombre letra a letra, mover un sitio con las
// flechas— es UN paso: lleva una «clave» y mientras sea la misma no se
// apunta otro.
function apuntarPaso(clave) {
    if (!estadoMapa.datos) {
        return;
    }
    if (clave && estadoMapa.ultimoCampo === clave) {
        return;
    }
    estadoMapa.ultimoCampo = clave || null;
    historiaMapa.atras.push(JSON.stringify(estadoMapa.datos));
    // Sin pasarse: en el mapamundi cada paso es casi un par de megas.
    let total = historiaMapa.atras.reduce((s, x) => s + x.length, 0);
    while (historiaMapa.atras.length > PASOS_QUE_SE_RECUERDAN || (total > 60e6 && historiaMapa.atras.length > 3)) {
        total -= historiaMapa.atras.shift().length;
    }
    historiaMapa.adelante = [];
    estadoMapa.cambiado = true;
    pintarBotonesDeHistoria();
}

function pintarBotonesDeHistoria() {
    $("[data-mapa-deshacer]").disabled = !historiaMapa.atras.length;
    $("[data-mapa-rehacer]").disabled = !historiaMapa.adelante.length;
}

function volverAlPaso(desde, hacia, que) {
    if (!desde.length || !estadoMapa.datos) {
        return;
    }
    if (estadoMapa.dibujo) {
        cancelarDibujo();
    }
    hacia.push(JSON.stringify(estadoMapa.datos));
    const anterior = estadoMapa.datos;
    estadoMapa.datos = completarDatosMapa(JSON.parse(desde.pop()));
    estadoMapa.cambiado = true;
    estadoMapa.ultimoCampo = null;
    const el = estadoMapa.elegido;
    if (el && !estadoMapa.datos[el.lista][el.i]) {
        estadoMapa.elegido = null;
    }
    pintarDatosGenerales();
    if (anterior.width !== estadoMapa.datos.width || anterior.height !== estadoMapa.datos.height
        || JSON.stringify(anterior.layers) !== JSON.stringify(estadoMapa.datos.layers)) {
        pintarTodoElMapa();
        ajustarMapa();
    } else {
        pintarCosasMapa();
    }
    pintarPropiedadesMapa();
    pintarMedida();
    pintarBotonesDeHistoria();
    avisarEditor(que);
}

function deshacerMapa() {
    volverAlPaso(historiaMapa.atras, historiaMapa.adelante,
        historiaMapa.atras.length ? "Deshecho." : "");
}

function rehacerMapa() {
    volverAlPaso(historiaMapa.adelante, historiaMapa.atras,
        historiaMapa.adelante.length ? "Rehecho." : "");
}

// ---- LA VISTA: ACERCAR Y MOVERSE ----
function lienzoMapa() {
    return $("[data-mapa-lienzo]");
}

function svgDelMapa() {
    return $("[data-mapa-svg]");
}

// Cuántas unidades del mapa mide un píxel de la pantalla.
function escalaMapa() {
    const lienzo = lienzoMapa();
    const v = estadoMapa.vista;
    if (!v || !lienzo.clientWidth) {
        return 1;
    }
    return Math.max(v.w / lienzo.clientWidth, v.h / lienzo.clientHeight);
}

function ponerVistaMapa(v) {
    const d = estadoMapa.datos;
    // No más lejos que el mapa entero (con un margen) ni más cerca que
    // un píxel de la imagen en ocho de la pantalla.
    const lienzo = lienzoMapa();
    const proporcion = lienzo.clientHeight ? lienzo.clientWidth / lienzo.clientHeight : 1.6;
    const w = Math.min(Math.max(v.w, 40), Math.max(d.width, d.height * proporcion) * 1.5);
    const h = w / proporcion;
    const cx = Math.min(Math.max(v.x + v.w / 2, 0), d.width);
    const cy = Math.min(Math.max(v.y + v.h / 2, 0), d.height);
    estadoMapa.vista = { x: cx - w / 2, y: cy - h / 2, w, h };
    svgDelMapa().setAttribute("viewBox", [estadoMapa.vista.x, estadoMapa.vista.y, w, h].map(redondoMapa).join(" "));
    const entero = Math.max(d.width / lienzo.clientWidth, d.height / lienzo.clientHeight) || 1;
    $("[data-mapa-cuanto]").textContent = Math.round((entero / escalaMapa()) * 100) + "%";
    escalarMarcasMapa();
}

function ajustarMapa() {
    const d = estadoMapa.datos;
    if (!d) {
        return;
    }
    const lienzo = lienzoMapa();
    const proporcion = lienzo.clientHeight ? lienzo.clientWidth / lienzo.clientHeight : 1.6;
    const w = Math.max(d.width, d.height * proporcion);
    ponerVistaMapa({ x: (d.width - w) / 2, y: (d.height - w / proporcion) / 2, w, h: w / proporcion });
}

function acercarMapa(factor, hacia) {
    const v = estadoMapa.vista;
    if (!v) {
        return;
    }
    const centro = hacia || { x: v.x + v.w / 2, y: v.y + v.h / 2 };
    const w = v.w / factor;
    const h = v.h / factor;
    ponerVistaMapa({
        x: centro.x - (centro.x - v.x) / factor, y: centro.y - (centro.y - v.y) / factor, w, h,
    });
}

function moverVistaMapa(dx, dy) {
    const v = estadoMapa.vista;
    ponerVistaMapa({ x: v.x + dx, y: v.y + dy, w: v.w, h: v.h });
}

// Del ratón al mapa.
function puntoDelMapa(e) {
    const svg = svgDelMapa();
    const punto = svg.createSVGPoint();
    punto.x = e.clientX;
    punto.y = e.clientY;
    const matriz = svg.getScreenCTM();
    if (!matriz) {
        return { x: 0, y: 0 };
    }
    const p = punto.matrixTransform(matriz.inverse());
    return { x: p.x, y: p.y };
}

// Lo que se pone en el mapa, dentro del mapa: pulsar en la franja de
// fuera (la que queda al verlo entero) no deja nada colgando fuera.
function dentroDelMapa(p) {
    const d = estadoMapa.datos;
    return { x: redondoMapa(Math.min(Math.max(p.x, 0), d.width)), y: redondoMapa(Math.min(Math.max(p.y, 0), d.height)) };
}

function centroDeLaVista() {
    const v = estadoMapa.vista;
    return { x: v.x + v.w / 2, y: v.y + v.h / 2 };
}

// ---- EL IMÁN ----
// Lo que se pone cerca (a menos de 12 píxeles de pantalla) de un sitio o de
// un punto de una región o una raya se pone JUSTO ahí; y si no hay punto
// cerca pero sí un borde, encima del borde. Así un camino llega de verdad
// a la ciudad, un río acaba en la costa de la región y dos regiones
// vecinas comparten los puntos de la frontera. evitar: lo que se está
// moviendo, para que no se enganche a sí mismo.
function imantar(p, evitar) {
    if (!$("#mapa-iman").checked || estadoMapa.sinIman || !estadoMapa.datos) {
        return { p, pegado: false };
    }
    const d = estadoMapa.datos;
    const r = 12 * escalaMapa();
    let mejor = null;
    let lejos = r;
    const mirar = (q) => {
        const dist = Math.hypot(q.x - p.x, q.y - p.y);
        if (dist < lejos) {
            lejos = dist;
            mejor = q;
        }
    };
    const esEvitado = (lista, i, n) => evitar && evitar.lista === lista && evitar.i === i
        && (evitar.n === undefined || evitar.n === n);
    d.pins.forEach((s, i) => {
        if (!esEvitado("pins", i)) {
            mirar(s);
        }
    });
    ["shapes", "lines"].forEach((lista) => {
        d[lista].forEach((c, i) => (c.points || []).forEach((q, n) => {
            if (!esEvitado(lista, i, n)) {
                mirar(q);
            }
        }));
    });
    (estadoMapa.dibujo ? estadoMapa.dibujo.puntos.slice(0, -1) : []).forEach(mirar);
    if (mejor) {
        return { p: { x: mejor.x, y: mejor.y }, pegado: "punto" };
    }
    // Un borde: el punto más cercano de cada tramo.
    let sobre = null;
    lejos = r;
    ["shapes", "lines"].forEach((lista) => {
        d[lista].forEach((c, i) => {
            if (evitar && evitar.lista === lista && evitar.i === i) {
                return;
            }
            const puntos = c.points || [];
            const cuantos = lista === "shapes" ? puntos.length : puntos.length - 1;
            for (let n = 0; n < cuantos; n++) {
                const a = puntos[n];
                const b = puntos[(n + 1) % puntos.length];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const largo = dx * dx + dy * dy;
                if (!largo) {
                    continue;
                }
                const f = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / largo));
                const q = { x: a.x + dx * f, y: a.y + dy * f };
                const dist = Math.hypot(q.x - p.x, q.y - p.y);
                if (dist < lejos) {
                    lejos = dist;
                    sobre = q;
                }
            }
        });
    });
    if (sobre) {
        return { p: { x: redondoMapa(sobre.x), y: redondoMapa(sobre.y) }, pegado: "borde" };
    }
    return { p, pegado: false };
}

// ---- PINTAR ----
// Capas del SVG, de abajo arriba: las imágenes, las regiones, las rayas,
// los textos, los sitios, lo que se está dibujando (o midiendo) y los
// puntos para arrastrar.
function pintarTodoElMapa() {
    const svg = svgDelMapa();
    svg.textContent = "";
    ["fondo", "regiones", "rayas", "textos", "sitios", "dibujo", "asas"].forEach((g) => {
        svg.appendChild(svgMapa("g", { "data-capa-mapa": g }));
    });
    pintarFondoMapa();
    pintarCosasMapa();
}

function capaMapa(nombre) {
    return svgDelMapa().querySelector('[data-capa-mapa="' + nombre + '"]');
}

const CAPA_DE_LISTA = { shapes: "regiones", lines: "rayas", labels: "textos", pins: "sitios" };

function pintarFondoMapa() {
    const g = capaMapa("fondo");
    const d = estadoMapa.datos;
    g.textContent = "";
    g.appendChild(svgMapa("rect", { x: 0, y: 0, width: d.width, height: d.height, class: "mapa-ed-papel" }));
    d.layers.slice().sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0)).forEach((c) => {
        const url = estadoMapa.imagenes[c.image];
        if (!url || estadoMapa.capasOcultas[c.id]) {
            return;
        }
        const img = svgMapa("image", {
            x: 0, y: 0, width: d.width, height: d.height, preserveAspectRatio: "none",
            opacity: typeof c.opacity === "number" ? c.opacity : 1,
        });
        img.setAttribute("href", url);
        g.appendChild(img);
    });
}

function trazoMapa(puntos, cerrado) {
    if (!puntos.length) {
        return "";
    }
    return puntos.map((p, i) => (i ? "L" : "M") + redondoMapa(p.x) + " " + redondoMapa(p.y)).join("")
        + (cerrado ? "Z" : "");
}

function pintarCosasMapa() {
    Object.values(CAPA_DE_LISTA).forEach((g) => {
        capaMapa(g).textContent = "";
    });
    const d = estadoMapa.datos;
    Object.keys(CAPA_DE_LISTA).forEach((lista) => {
        d[lista].forEach((c, i) => capaMapa(CAPA_DE_LISTA[lista]).appendChild(dibujoDeCosa(lista, c, i)));
    });
    pintarAsasMapa();
    escalarMarcasMapa();
    pintarListaDeCosas();
}

// Vuelve a pintar una sola cosa (mientras se arrastra: el mapamundi
// tiene miles de puntos y no se puede rehacer entero a cada movimiento).
function repintarCosa(lista, i) {
    const viejo = svgDelMapa().querySelector('[data-lista="' + lista + '"][data-i="' + i + '"]');
    const nuevo = dibujoDeCosa(lista, estadoMapa.datos[lista][i], i);
    if (viejo) {
        viejo.replaceWith(nuevo);
    }
    pintarAsasMapa();
    escalarMarcasMapa();
}

// LO QUE SE ANDA HASTA CADA PUNTO de una raya, y el punto que está a tanto
// del principio (con hacia dónde va la raya ahí, en grados).
function largosMapa(puntos) {
    const acumulado = [0];
    for (let i = 1; i < puntos.length; i++) {
        acumulado.push(acumulado[i - 1] + Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].y - puntos[i - 1].y));
    }
    return acumulado;
}

function puntoALoLargo(puntos, acumulado, s) {
    for (let i = 1; i < puntos.length; i++) {
        if (acumulado[i] >= s || i === puntos.length - 1) {
            const a = puntos[i - 1];
            const b = puntos[i];
            const tramo = (acumulado[i] - acumulado[i - 1]) || 1;
            const f = Math.max(0, Math.min(1, (s - acumulado[i - 1]) / tramo));
            return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f,
                giro: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
        }
    }
    return { x: puntos[0].x, y: puntos[0].y, giro: 0 };
}

// Un río que se ensancha: en ocho trozos, del más fino (donde nace, el
// primer punto) al más gordo (la desembocadura). Como _rio_que_se_ensancha
// en mundo_mapas.py.
function tramosDeRio(puntos, cuantos) {
    const n = cuantos || 8;
    const acumulado = largosMapa(puntos);
    const total = acumulado[acumulado.length - 1];
    if (!total) {
        return [];
    }
    const tramos = [];
    for (let k = 0; k < n; k++) {
        const a = total * k / n;
        const b = total * (k + 1) / n;
        const medio = puntos.filter((p, i) => acumulado[i] > a && acumulado[i] < b);
        tramos.push({ puntos: [puntoALoLargo(puntos, acumulado, a)].concat(medio, [puntoALoLargo(puntos, acumulado, b)]),
            grueso: 2 + 5.5 * (k + 0.5) / n });
    }
    return tramos;
}

// Las flechas de una ruta de viaje: tantas como quepan (una cada nueve
// radios de pin de la web), a lo largo y mirando hacia el final.
function flechasDeRaya(puntos) {
    const d = estadoMapa.datos;
    const acumulado = largosMapa(puntos);
    const total = acumulado[acumulado.length - 1];
    if (!total) {
        return [];
    }
    const radio = Math.max(8, Math.round(d.width / 60));
    const cuantas = Math.max(1, Math.min(12, Math.round(total / (radio * 9))));
    const salida = [];
    for (let j = 0; j < cuantas; j++) {
        salida.push(puntoALoLargo(puntos, acumulado, total * (j + 0.5) / cuantas));
    }
    return salida;
}

function dibujoDeCosa(lista, cosa, i) {
    const elegido = estadoMapa.elegido && estadoMapa.elegido.lista === lista && estadoMapa.elegido.i === i;
    const g = svgMapa("g", { "data-lista": lista, "data-i": i, class: "mapa-ed-cosa" + (elegido ? " es-elegida" : "") });
    if (lista === "shapes") {
        const color = cosa.color || "#f5ce6c";
        g.appendChild(svgMapa("path", {
            d: trazoMapa(cosa.points || [], true), fill: color, "fill-opacity": cosa.label || cosa.targetPage ? 0.35 : 0.18,
            stroke: elegido ? "#ffffff" : color, "stroke-width": elegido ? 4 : 2, "vector-effect": "non-scaling-stroke",
            class: "mapa-ed-region",
        }));
    } else if (lista === "lines") {
        dibujarRayaSvg(g, cosa, elegido);
    } else if (lista === "labels") {
        const tam = tamanoDeTexto(cosa);
        const texto = svgMapa("text", {
            class: "mapa-ed-texto" + (cosa.label ? "" : " es-vacio"), x: cosa.x, y: cosa.y, "font-size": redondoMapa(tam),
            "stroke-width": redondoMapa(tam * 0.16), "text-anchor": "middle", "dominant-baseline": "central",
            fill: cosa.color || "#f4ecd8", stroke: elegido ? "#f5ce6c" : "#1b1020",
        });
        if (cosa.angle) {
            texto.setAttribute("transform", "rotate(" + cosa.angle + " " + cosa.x + " " + cosa.y + ")");
        }
        texto.textContent = cosa.label || "(escribe el texto)";
        g.appendChild(texto);
    } else {
        const tipo = tipoDeSitioMapa(cosa.kind);
        const marca = svgMapa("g", { class: "mapa-ed-marca", "data-x": cosa.x, "data-y": cosa.y });
        const fondo = cosa.color || (tipo ? tipo[3] : "#e74c3c");
        if (cosa.kind === "fortaleza") {
            marca.appendChild(svgMapa("rect", {
                x: -11, y: -11, width: 22, height: 22, fill: fondo, stroke: elegido ? "#ffffff" : "#1b1020",
                "stroke-width": elegido ? 4 : 2.5,
            }));
        } else {
            marca.appendChild(svgMapa("circle", {
                r: 12, fill: fondo, stroke: elegido ? "#ffffff" : "#1b1020", "stroke-width": elegido ? 4 : 2.5,
                "stroke-dasharray": cosa.kind === "ruina" ? "4 3" : "none",
            }));
        }
        const letra = svgMapa("text", { class: "mapa-ed-letra", "text-anchor": "middle", "dominant-baseline": "central" });
        letra.textContent = tipo ? tipo[2] + "︎" : (cosa.icon || "");
        marca.appendChild(letra);
        if (cosa.label) {
            const nombre = svgMapa("text", { class: "mapa-ed-nombre", x: 17, y: 0, "dominant-baseline": "central" });
            nombre.textContent = cosa.label;
            marca.appendChild(nombre);
        }
        g.appendChild(marca);
    }
    if (cosa.label || cosa.targetPage) {
        const titulo = svgMapa("title");
        titulo.textContent = cosa.label || cosa.targetPage;
        g.appendChild(titulo);
    }
    return g;
}

function dibujarRayaSvg(g, cosa, elegido) {
    const estilo = estiloDeRaya(cosa.kind);
    const puntos = cosa.points || [];
    const d = trazoMapa(puntos, false);
    const comun = { fill: "none", "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke", "pointer-events": "none" };
    // Una raya gorda y transparente debajo, para acertarle con el ratón.
    g.appendChild(svgMapa("path", {
        d, fill: "none", stroke: "transparent", "stroke-width": 18, "vector-effect": "non-scaling-stroke",
        "pointer-events": "stroke",
    }));
    const color = cosa.color || estilo.color;
    const borde = elegido ? "#ffffff" : (estilo.colorBorde || "#1b1020");
    if (cosa.kind === "rio" && cosa.taper !== false && puntos.length >= 2) {
        const tramos = tramosDeRio(puntos);
        tramos.forEach((t) => g.appendChild(svgMapa("path", Object.assign({
            d: trazoMapa(t.puntos, false), stroke: borde, "stroke-width": t.grueso + 3, "stroke-linecap": "round",
        }, comun))));
        tramos.forEach((t) => g.appendChild(svgMapa("path", Object.assign({
            d: trazoMapa(t.puntos, false), stroke: color, "stroke-width": t.grueso, "stroke-linecap": "round",
        }, comun))));
    } else {
        const corte = estilo.corte || "round";
        g.appendChild(svgMapa("path", Object.assign({
            d, stroke: borde, "stroke-width": estilo.borde, "stroke-linecap": corte,
            "stroke-dasharray": estilo.bordeConTrazos && estilo.trazos ? estilo.trazos.join(" ") : "none",
        }, comun)));
        g.appendChild(svgMapa("path", Object.assign({
            d, stroke: color, "stroke-width": estilo.ancho, "stroke-linecap": corte,
            "stroke-dasharray": estilo.trazos ? estilo.trazos.join(" ") : "none",
        }, comun)));
    }
    if (estilo.flechas && puntos.length >= 2) {
        flechasDeRaya(puntos).forEach((f) => {
            const flecha = svgMapa("g", { class: "mapa-ed-marca mapa-ed-flecha", "data-x": f.x, "data-y": f.y,
                "data-giro": redondoMapa(f.giro) });
            flecha.appendChild(svgMapa("path", { d: "M-8 -6 L8 0 L-8 6 Z", fill: color, stroke: "#1b1020",
                "stroke-width": 1.5 }));
            g.appendChild(flecha);
        });
    }
}

// Los puntos de la región o la raya elegida: uno por esquina, para
// arrastrarlo, y uno pequeño entre cada dos, para meter uno nuevo.
function pintarAsasMapa() {
    const g = capaMapa("asas");
    if (!g) {
        return;
    }
    g.textContent = "";
    const el = estadoMapa.elegido;
    if (!el || el.lista === "pins" || el.lista === "labels" || estadoMapa.herramienta !== "elegir") {
        return;
    }
    const cosa = estadoMapa.datos[el.lista][el.i];
    const puntos = cosa.points || [];
    // En una región de miles de puntos no caben: se avisa en el panel.
    if (puntos.length > 400) {
        return;
    }
    const cerrado = el.lista === "shapes";
    puntos.forEach((p, n) => {
        const siguiente = puntos[n + 1] || (cerrado ? puntos[0] : null);
        if (siguiente) {
            g.appendChild(svgMapa("g", { class: "mapa-ed-marca mapa-ed-medio", "data-medio": n,
                "data-x": (p.x + siguiente.x) / 2, "data-y": (p.y + siguiente.y) / 2 }))
                .appendChild(svgMapa("circle", { r: 5 }));
        }
    });
    puntos.forEach((p, n) => {
        g.appendChild(svgMapa("g", { class: "mapa-ed-marca mapa-ed-asa" + (n === 0 && !cerrado ? " es-principio" : ""),
            "data-asa": n, "data-x": p.x, "data-y": p.y }))
            .appendChild(svgMapa("circle", { r: 8 }));
    });
}

// Lo que mide lo mismo a cualquier zoom: los sitios, las flechas y los
// puntos.
function escalarMarcasMapa() {
    const s = escalaMapa();
    svgDelMapa().querySelectorAll(".mapa-ed-marca").forEach((m) => {
        const giro = m.getAttribute("data-giro");
        m.setAttribute("transform", "translate(" + m.getAttribute("data-x") + " " + m.getAttribute("data-y")
            + ")" + (giro ? " rotate(" + giro + ")" : "") + " scale(" + s + ")");
    });
    pintarDibujoMapa();
}

// ---- LA LISTA DE LO QUE HAY ----
function nombreDeCosa(lista, cosa) {
    const nombre = cosa.label || cosa.targetPage || "";
    let que;
    if (lista === "pins") {
        const tipo = tipoDeSitioMapa(cosa.kind);
        que = tipo ? tipo[1].toLowerCase() : "sitio";
    } else if (lista === "lines") {
        const tipo = TIPOS_DE_RAYA.find((t) => t[0] === cosa.kind) || TIPOS_DE_RAYA[0];
        que = tipo[1].toLowerCase();
    } else if (lista === "labels") {
        que = "texto";
    } else {
        que = "región";
    }
    return { nombre, que };
}

function pintarListaDeCosas() {
    const caja = $("[data-mapa-cosas]");
    caja.textContent = "";
    const d = estadoMapa.datos;
    const grupos = [["pins", "Sitios"], ["lines", "Caminos, ríos y rayas"], ["labels", "Textos"], ["shapes", "Regiones"]];
    let alguna = false;
    grupos.forEach(([lista, titulo]) => {
        if (!d[lista].length) {
            return;
        }
        alguna = true;
        const sinNombre = d[lista].filter((c) => !c.label && !c.targetPage).length;
        caja.appendChild(crearEditor("h3", "mapa-cosas-titulo", titulo + " (" + d[lista].length + ")"));
        const ul = crearEditor("ul", "mapa-cosas");
        d[lista].forEach((cosa, i) => {
            const { nombre, que } = nombreDeCosa(lista, cosa);
            // Las regiones sin nombre del mapamundi son el dibujo (costas,
            // fronteras): se cuentan, pero no se listan una a una.
            if (!nombre && lista === "shapes" && sinNombre > 12) {
                return;
            }
            const li = document.createElement("li");
            const boton = crearEditor("button", "mapa-cosa");
            boton.type = "button";
            const elegido = estadoMapa.elegido && estadoMapa.elegido.lista === lista && estadoMapa.elegido.i === i;
            boton.setAttribute("aria-pressed", elegido ? "true" : "false");
            const tipo = lista === "pins" ? tipoDeSitioMapa(cosa.kind) : null;
            if (tipo) {
                boton.appendChild(crearEditor("span", "mapa-cosa-marca es-" + tipo[0], tipo[2] + "︎"))
                    .setAttribute("aria-hidden", "true");
            }
            boton.appendChild(crearEditor("span", "mapa-cosa-nombre", nombre || "(sin nombre)"));
            boton.appendChild(crearEditor("span", "mapa-cosa-que", que));
            boton.addEventListener("click", () => {
                elegirCosa(lista, i);
                irACosa(lista, i);
            });
            li.appendChild(boton);
            ul.appendChild(li);
        });
        if (lista === "shapes" && sinNombre > 12) {
            ul.appendChild(crearEditor("li", "ayuda", "Y " + sinNombre
                + " sin nombre (el dibujo: costas y fronteras). Se eligen pulsándolas en el mapa."));
        }
        caja.appendChild(ul);
    });
    if (!alguna) {
        caja.appendChild(crearEditor("p", "ayuda", "Aún nada. Elige «Poner un sitio» y pulsa en el mapa."));
    }
}

function irACosa(lista, i) {
    const cosa = estadoMapa.datos[lista][i];
    const puntos = lista === "pins" || lista === "labels" ? [cosa] : cosa.points || [];
    if (!puntos.length) {
        return;
    }
    const xs = puntos.map((p) => p.x);
    const ys = puntos.map((p) => p.y);
    const v = estadoMapa.vista;
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const ancho = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * v.w / v.h);
    // Si no cabe, se aleja hasta que quepa; si cabe, solo se centra.
    const w = ancho * 1.3 > v.w ? ancho * 1.3 : v.w;
    const h = w * v.h / v.w;
    ponerVistaMapa({ x: cx - w / 2, y: cy - h / 2, w, h });
}

// ---- ELEGIR, Y LO ELEGIDO ----
function elegirCosa(lista, i) {
    estadoMapa.elegido = lista ? { lista, i } : null;
    estadoMapa.ultimoCampo = null;
    pintarCosasMapa();
    pintarPropiedadesMapa();
}

function cosaElegida() {
    const el = estadoMapa.elegido;
    return el ? estadoMapa.datos[el.lista][el.i] : null;
}

function pintarPropiedadesMapa() {
    const cosa = cosaElegida();
    $("[data-mapa-nada]").hidden = !!cosa;
    $("[data-mapa-propiedades]").hidden = !cosa;
    if (!cosa) {
        return;
    }
    const lista = estadoMapa.elegido.lista;
    const { que } = nombreDeCosa(lista, cosa);
    $("[data-mapa-que]").textContent = que[0].toUpperCase() + que.slice(1);
    $("[data-mapa-p-nombre-que]").textContent = lista === "labels" ? "Texto" : "Nombre";
    $("#mapa-p-nombre").value = cosa.label || "";
    $("#mapa-p-pagina").value = cosa.targetPage || "";
    const tipo = $("#mapa-p-tipo");
    tipo.textContent = "";
    let opciones = [];
    if (lista === "pins") {
        opciones = [["", "Sin tipo (chincheta redonda)"]].concat(TIPOS_DE_SITIO.map((t) => [t[0], t[2] + " " + t[1]]));
    } else if (lista === "lines") {
        opciones = TIPOS_DE_RAYA;
    } else if (lista === "labels") {
        opciones = TAMANOS_DE_TEXTO;
    }
    opciones.forEach((o) => {
        const opcion = document.createElement("option");
        opcion.value = o[0];
        opcion.textContent = o[1];
        tipo.appendChild(opcion);
    });
    tipo.value = lista === "labels" ? (cosa.size || "mediano") : (cosa.kind || (lista === "lines" ? "camino" : ""));
    $("[data-mapa-p-tipo-que]").textContent = lista === "labels" ? "Tamaño" : "Qué es";
    $('[data-mapa-p-caja="kind"]').hidden = lista === "shapes";
    $('[data-mapa-p-caja="pagina"]').hidden = lista === "labels";
    $('[data-mapa-p-caja="xy"]').hidden = lista !== "pins" && lista !== "labels";
    $('[data-mapa-p-caja="giro"]').hidden = lista !== "labels";
    $('[data-mapa-p-caja="taper"]').hidden = !(lista === "lines" && cosa.kind === "rio");
    if (lista === "pins" || lista === "labels") {
        $("#mapa-p-x").value = Math.round(cosa.x);
        $("#mapa-p-y").value = Math.round(cosa.y);
    }
    if (lista === "labels") {
        $("#mapa-p-giro").value = cosa.angle || 0;
        $("[data-mapa-p-giro-cifra]").textContent = (cosa.angle || 0) + "°";
    }
    $('[data-mapa-p="taper"]').checked = cosa.taper !== false;
    const conColor = $('[data-mapa-p="con-color"]');
    conColor.checked = !!cosa.color;
    $("#mapa-p-color").value = /^#[0-9a-f]{6}$/i.test(cosa.color || "") ? cosa.color : "#e74c3c";
    $("#mapa-p-color").hidden = !cosa.color;
    const puntos = (cosa.points || []).length;
    let ayuda = "";
    if (lista === "shapes" || lista === "lines") {
        ayuda = puntos + " puntos. " + (puntos > 400
            ? "Son demasiados para arrastrarlos uno a uno: se puede cambiar el nombre, la página y el color."
            : "Con «Elegir y mover»: arrastra un punto para moverlo, arrastra uno de los pequeños para añadir"
              + " otro y pulsa dos veces en uno para quitarlo.");
        if (lista === "lines") {
            ayuda += " Va del punto con borde amarillo (el principio) al último.";
        }
    }
    $("[data-mapa-p-puntos]").textContent = ayuda;
}

function cambiarPropiedadMapa(campo, valor) {
    const cosa = cosaElegida();
    if (!cosa) {
        return;
    }
    const el = estadoMapa.elegido;
    apuntarPaso("campo-" + campo + "-" + el.lista + "-" + el.i);
    if (campo === "x" || campo === "y") {
        const n = Number(valor);
        if (!Number.isFinite(n) || valor === "") {
            return;
        }
        cosa[campo] = redondoMapa(n);
    } else if (campo === "angle") {
        const n = Number(valor) || 0;
        if (n) {
            cosa.angle = n;
        } else {
            delete cosa.angle;
        }
        $("[data-mapa-p-giro-cifra]").textContent = n + "°";
    } else if (campo === "taper") {
        if (valor) {
            delete cosa.taper;
        } else {
            cosa.taper = false;
        }
    } else if (campo === "con-color") {
        if (valor) {
            cosa.color = $("#mapa-p-color").value;
        } else {
            delete cosa.color;
        }
        $("#mapa-p-color").hidden = !valor;
    } else if (campo === "kind" && el.lista === "labels") {
        cosa.size = valor || "mediano";
    } else if (valor) {
        cosa[campo] = valor;
    } else {
        delete cosa[campo];
    }
    estadoMapa.cambiado = true;
    repintarCosa(el.lista, el.i);
    if (campo === "label" || campo === "kind" || campo === "targetPage") {
        pintarListaDeCosas();
        if (campo === "kind") {
            $("[data-mapa-que]").textContent = nombreDeCosa(el.lista, cosa).que.replace(/^./, (c) => c.toUpperCase());
            $('[data-mapa-p-caja="taper"]').hidden = !(el.lista === "lines" && cosa.kind === "rio");
        }
    }
}

function borrarElegido() {
    const el = estadoMapa.elegido;
    if (!el) {
        return;
    }
    const cosa = cosaElegida();
    const { nombre, que } = nombreDeCosa(el.lista, cosa);
    apuntarPaso();
    estadoMapa.datos[el.lista].splice(el.i, 1);
    estadoMapa.elegido = null;
    pintarCosasMapa();
    pintarPropiedadesMapa();
    avisarEditor("Borrado: " + que + (nombre ? " «" + nombre + "»" : "") + ". (Ctrl+Z lo trae de vuelta.)");
    lienzoMapa().focus({ preventScroll: true });
}

// ---- LAS HERRAMIENTAS ----
const INSTRUCCIONES_MAPA = {
    elegir: "Pulsa un sitio, un texto, una región o una raya para elegirlo. Los sitios y los textos se arrastran;"
        + " en las regiones y las rayas se arrastran sus puntos. Arrastrando en un hueco te mueves por el mapa.",
    pin: "Pulsa en el mapa donde va el sitio. Luego escribe su nombre a la derecha.",
    region: "Pulsa punto a punto el borde de la región. Para cerrarla, pulsa en el primero, pulsa dos veces"
        + " o «Terminar el dibujo».",
    raya: "Pulsa punto a punto por donde va, desde el principio (un río, desde donde nace; una ruta, desde"
        + " donde sale). Para acabar, pulsa dos veces o «Terminar el dibujo».",
    texto: "Pulsa en el mapa donde va el texto («Mar de las Brumas»). Luego escríbelo a la derecha, y elige su"
        + " tamaño y su giro.",
    medir: "Pulsa de un sitio a otro, punto a punto, por donde se iría. A la derecha sale cuánto hay.",
};
const INSTRUCCIONES_A_MANO = "Aprieta y arrastra por donde va; al soltar, se acaba.";
const HERRAMIENTAS_DE_DIBUJO = ["region", "raya"];

function ponerHerramienta(herramienta) {
    cancelarDibujo();
    estadoMapa.herramienta = herramienta;
    estadoMapa.iman = null;
    const radio = document.querySelector('input[name="herramienta"][value="' + herramienta + '"]');
    if (radio) {
        radio.checked = true;
    }
    document.querySelectorAll(".herramienta").forEach((h) => {
        h.classList.toggle("es-elegida", !!h.querySelector("input:checked"));
    });
    const dibuja = HERRAMIENTAS_DE_DIBUJO.includes(herramienta);
    $('[data-mapa-solo="pin"]').hidden = herramienta !== "pin";
    $('[data-mapa-solo="raya"]').hidden = herramienta !== "raya";
    $('[data-mapa-solo="dibujo"]').hidden = !dibuja;
    $("[data-mapa-medir]").hidden = herramienta !== "medir";
    $("[data-mapa-instrucciones]").textContent = dibuja && $("#mapa-mano").checked
        ? INSTRUCCIONES_A_MANO : INSTRUCCIONES_MAPA[herramienta];
    lienzoMapa().classList.toggle("es-dibujo", herramienta !== "elegir");
    pintarAsasMapa();
    escalarMarcasMapa();
}

function empezarDibujo() {
    const h = estadoMapa.herramienta;
    estadoMapa.dibujo = { lista: h === "region" ? "shapes" : "lines",
        kind: h === "region" ? "" : $("#mapa-tipo-raya").value, puntos: [], raton: null };
    mandosDeDibujo();
}

function mandosDeDibujo() {
    const dibujo = estadoMapa.dibujo;
    const hay = !!dibujo && dibujo.puntos.length > 0;
    // Escondidos sin dejar de ocupar su sitio: si aparecieran de golpe, el
    // mapa bajaría justo mientras se está pulsando en él.
    ["[data-mapa-terminar]", "[data-mapa-cancelar]", "[data-mapa-quitar-punto]"].forEach((s) => {
        $(s).classList.toggle("es-guardado", !hay);
    });
}

// Lo que se está dibujando o midiendo, y el aro del imán.
function pintarDibujoMapa() {
    const g = capaMapa("dibujo");
    if (!g) {
        return;
    }
    g.textContent = "";
    const s = escalaMapa();
    const dibujo = estadoMapa.dibujo;
    if (dibujo && dibujo.puntos.length) {
        const puntos = dibujo.raton ? dibujo.puntos.concat([dibujo.raton]) : dibujo.puntos;
        g.appendChild(svgMapa("path", {
            d: trazoMapa(puntos, false), fill: dibujo.lista === "shapes" ? "rgba(245,206,108,0.25)" : "none",
            stroke: "#ffffff", "stroke-width": 3, "stroke-dasharray": "8 5", "vector-effect": "non-scaling-stroke",
            class: "mapa-ed-dibujo",
        }));
        dibujo.puntos.forEach((p, n) => {
            g.appendChild(svgMapa("circle", {
                cx: p.x, cy: p.y, r: (n === 0 && dibujo.lista === "shapes" ? 9 : 5) * s,
                fill: n === 0 ? "#f5ce6c" : "#ffffff", stroke: "#1b1020", "stroke-width": 2,
                "vector-effect": "non-scaling-stroke", class: "mapa-ed-dibujo",
            }));
        });
    }
    const medida = estadoMapa.herramienta === "medir" ? estadoMapa.medida : [];
    if (medida.length) {
        const puntos = estadoMapa.ratonMedida ? medida.concat([estadoMapa.ratonMedida]) : medida;
        g.appendChild(svgMapa("path", {
            d: trazoMapa(puntos, false), fill: "none", stroke: "#1b1020", "stroke-width": 6,
            "vector-effect": "non-scaling-stroke", "stroke-linecap": "round", class: "mapa-ed-dibujo",
        }));
        g.appendChild(svgMapa("path", {
            d: trazoMapa(puntos, false), fill: "none", stroke: "#f5ce6c", "stroke-width": 3, "stroke-dasharray": "10 6",
            "vector-effect": "non-scaling-stroke", "stroke-linecap": "round", class: "mapa-ed-dibujo",
        }));
        medida.forEach((p) => g.appendChild(svgMapa("circle", {
            cx: p.x, cy: p.y, r: 5 * s, fill: "#f5ce6c", stroke: "#1b1020", "stroke-width": 2,
            "vector-effect": "non-scaling-stroke", class: "mapa-ed-dibujo",
        })));
    }
    if (estadoMapa.iman) {
        g.appendChild(svgMapa("circle", {
            cx: estadoMapa.iman.x, cy: estadoMapa.iman.y, r: 11 * s, fill: "none", stroke: "#f5ce6c",
            "stroke-width": 3, "vector-effect": "non-scaling-stroke", class: "mapa-ed-dibujo",
        }));
    }
}

function anadirPuntoDibujo(crudo) {
    if (!estadoMapa.dibujo) {
        empezarDibujo();
    }
    const dibujo = estadoMapa.dibujo;
    const s = escalaMapa();
    // Pulsar en el primero cierra la región (antes que el imán, que lo
    // pegaría al primero igual).
    const primero = dibujo.puntos[0];
    if (dibujo.lista === "shapes" && dibujo.puntos.length >= 3
        && Math.hypot(primero.x - crudo.x, primero.y - crudo.y) < 12 * s) {
        terminarDibujo();
        return;
    }
    const p = imantar(crudo).p;
    const ultimo = dibujo.puntos[dibujo.puntos.length - 1];
    // El segundo clic de un doble clic cae en el mismo sitio: no es otro punto.
    if (ultimo && Math.hypot(ultimo.x - p.x, ultimo.y - p.y) < 4 * s) {
        return;
    }
    dibujo.puntos.push(dentroDelMapa(p));
    mandosDeDibujo();
    pintarDibujoMapa();
}

function quitarUltimoPunto() {
    const dibujo = estadoMapa.dibujo;
    if (dibujo && dibujo.puntos.length) {
        dibujo.puntos.pop();
        mandosDeDibujo();
        pintarDibujoMapa();
    }
}

function cancelarDibujo() {
    estadoMapa.dibujo = null;
    mandosDeDibujo();
    pintarDibujoMapa();
}

// Quita los puntos de más de un dibujo a mano alzada: los que casi están en
// línea recta con los de al lado (Ramer-Douglas-Peucker, como el generador).
function simplificarMapa(puntos, tolerancia) {
    if (puntos.length < 3) {
        return puntos;
    }
    const [a, b] = [puntos[0], puntos[puntos.length - 1]];
    let lejos = 0;
    let cual = 0;
    const largo = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    for (let i = 1; i < puntos.length - 1; i++) {
        const p = puntos[i];
        const distancia = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) / largo;
        if (distancia > lejos) {
            lejos = distancia;
            cual = i;
        }
    }
    if (lejos <= tolerancia) {
        return [a, b];
    }
    return simplificarMapa(puntos.slice(0, cual + 1), tolerancia).slice(0, -1)
        .concat(simplificarMapa(puntos.slice(cual), tolerancia));
}

function terminarDibujo(aMano) {
    const dibujo = estadoMapa.dibujo;
    if (!dibujo) {
        return;
    }
    let puntos = dibujo.puntos;
    if (aMano) {
        puntos = simplificarMapa(puntos, 1.5 * escalaMapa());
        // A mano, el imán solo para los dos extremos: el camino que acaba
        // en la ciudad.
        if (puntos.length >= 2) {
            puntos[puntos.length - 1] = dentroDelMapa(imantar(puntos[puntos.length - 1]).p);
        }
    }
    const falta = dibujo.lista === "shapes" ? 3 : 2;
    if (puntos.length < falta) {
        avisarEditor(dibujo.lista === "shapes" ? "Una región necesita por lo menos tres puntos."
            : "Una raya necesita por lo menos dos puntos.", true);
        return;
    }
    apuntarPaso();
    const cosa = { id: idNuevoMapa() };
    if (dibujo.lista === "shapes") {
        cosa.type = "polygon";
        cosa.points = puntos;
        cosa.color = COLORES_DE_REGION[estadoMapa.cuantasRegiones % COLORES_DE_REGION.length];
        estadoMapa.cuantasRegiones += 1;
        const capa = estadoMapa.datos.layers[0];
        if (capa && capa.id) {
            cosa.layerId = capa.id;
        }
    } else {
        cosa.kind = dibujo.kind || "camino";
        cosa.points = puntos;
    }
    estadoMapa.datos[dibujo.lista].push(cosa);
    const lista = dibujo.lista;
    cancelarDibujo();
    estadoMapa.iman = null;
    elegirCosa(lista, estadoMapa.datos[lista].length - 1);
    avisarEditor((lista === "shapes" ? "Región" : nombreDeCosa("lines", cosa).que.replace(/^./, (c) => c.toUpperCase()))
        + " hecha (" + puntos.length + " puntos). Ponle nombre a la derecha.");
    $("#mapa-p-nombre").focus({ preventScroll: true });
}

function ponerSitio(crudo) {
    const tipo = $("#mapa-tipo-nuevo").value;
    const sitio = dentroDelMapa(imantar(crudo).p);
    apuntarPaso();
    const cosa = { id: idNuevoMapa(), x: sitio.x, y: sitio.y, label: "" };
    if (tipo) {
        cosa.kind = tipo;
    }
    estadoMapa.datos.pins.push(cosa);
    estadoMapa.iman = null;
    elegirCosa("pins", estadoMapa.datos.pins.length - 1);
    avisarEditor("Sitio puesto. Escribe su nombre (y, si tiene, la página a la que lleva).");
    $("#mapa-p-nombre").focus({ preventScroll: true });
}

function ponerTexto(p) {
    const sitio = dentroDelMapa(p);
    apuntarPaso();
    estadoMapa.datos.labels.push({ id: idNuevoMapa(), x: sitio.x, y: sitio.y, label: "", size: "mediano" });
    elegirCosa("labels", estadoMapa.datos.labels.length - 1);
    avisarEditor("Texto puesto. Escríbelo a la derecha.");
    $("#mapa-p-nombre").focus({ preventScroll: true });
}

// ---- MEDIR ----
// Una raya de varios tramos, que no se guarda: solo dice cuánto mide. Con
// escala, en leguas (o en lo que sea) y en días de viaje; sin ella, en
// píxeles del mapa. La escala sí se guarda en el .cmap ("scale") y la web
// pinta con ella una barra de escala.
function largoDeMedida(puntos) {
    const a = largosMapa(puntos);
    return a[a.length - 1] || 0;
}

function enUnidades(pixeles) {
    const e = estadoMapa.datos.scale;
    if (!e || !e.pixels || !e.distance) {
        return null;
    }
    return pixeles * e.distance / e.pixels;
}

function diasDeViaje(distancia, porDia) {
    const dias = distancia / porDia;
    if (dias < 1) {
        const horas = Math.max(1, Math.round(dias * 8));
        return horas === 1 ? "una hora" : "unas " + horas + " horas";
    }
    const medios = Math.round(dias * 2) / 2;
    const enteros = Math.floor(medios);
    const conMedio = medios !== enteros;
    if (enteros === 1) {
        return conMedio ? "un día y medio" : "un día";
    }
    return enteros + (conMedio ? " días y medio" : " días");
}

function textoDeDistancia(pixeles) {
    const e = estadoMapa.datos.scale;
    const unidades = enUnidades(pixeles);
    if (unidades === null) {
        return cifraMapa(pixeles, 0) + " píxeles del mapa";
    }
    let texto = cifraMapa(unidades) + " " + (e.unit || "");
    const viaje = Object.entries(e.travel || {}).filter(([, v]) => typeof v === "number" && v > 0);
    if (viaje.length && unidades > 0) {
        texto += ". " + viaje.map(([como, v]) => como[0].toUpperCase() + como.slice(1) + ": " + diasDeViaje(unidades, v))
            .join(" · ");
    }
    return texto;
}

function pintarMedida() {
    if (!estadoMapa.datos) {
        return;
    }
    const medida = estadoMapa.medida;
    const total = largoDeMedida(medida);
    $("[data-mapa-medida]").textContent = medida.length < 2
        ? "Pulsa en el mapa de un sitio a otro."
        : "Distancia: " + textoDeDistancia(total) + ".";
    $("[data-mapa-medida-raton]").textContent = "";
    const e = estadoMapa.datos.scale;
    $("[data-mapa-escala-ahora]").textContent = e && e.pixels && e.distance
        ? "Ahora: " + cifraMapa(e.pixels, 0) + " píxeles del mapa son " + cifraMapa(e.distance) + " " + (e.unit || "")
            + ". Para cambiarla, mide un tramo que conozcas, escribe cuánto es y «Usar como escala»."
        : "Sin escala: las distancias salen en píxeles del mapa. Mide un tramo que conozcas (de una ciudad a otra),"
            + " escribe cuánto es y pulsa «Usar como escala».";
    if (e && e.unit) {
        $("#mapa-escala-unidad").value = e.unit;
    }
    const viaje = (e && e.travel) || {};
    document.querySelectorAll("[data-mapa-viaje-como]").forEach((campo) => {
        const v = viaje[campo.getAttribute("data-mapa-viaje-como")];
        campo.value = typeof v === "number" ? v : "";
        campo.disabled = !e;
    });
    $("[data-mapa-escala-quitar]").disabled = !e;
    pintarDibujoMapa();
}

function anadirPuntoMedida(crudo) {
    const p = dentroDelMapa(imantar(crudo).p);
    const ultimo = estadoMapa.medida[estadoMapa.medida.length - 1];
    if (ultimo && Math.hypot(ultimo.x - p.x, ultimo.y - p.y) < 2 * escalaMapa()) {
        return;
    }
    estadoMapa.medida.push(p);
    pintarMedida();
}

function ponerEscala() {
    const pixeles = largoDeMedida(estadoMapa.medida);
    const cuanto = Number(String($("#mapa-escala-cuanto").value).replace(",", "."));
    const unidad = $("#mapa-escala-unidad").value.trim() || "leguas";
    if (pixeles <= 0) {
        avisarEditor("Primero mide en el mapa un tramo del que sepas cuánto es.", true);
        return;
    }
    if (!Number.isFinite(cuanto) || cuanto <= 0) {
        avisarEditor("Escribe cuánto es lo medido (un número).", true);
        $("#mapa-escala-cuanto").focus();
        return;
    }
    apuntarPaso();
    const antes = estadoMapa.datos.scale || {};
    const viaje = antes.unit === unidad && antes.travel ? antes.travel
        : Object.assign({}, VIAJE_POR_UNIDAD[unidad.toLowerCase()] || {});
    estadoMapa.datos.scale = { pixels: redondoMapa(pixeles), distance: cuanto, unit: unidad, travel: viaje };
    pintarMedida();
    avisarEditor("Escala puesta: " + cifraMapa(pixeles, 0) + " píxeles del mapa son " + cifraMapa(cuanto) + " " + unidad
        + ". En la web sale una barra de escala.");
}

function cambiarViaje(campo) {
    const e = estadoMapa.datos.scale;
    if (!e) {
        return;
    }
    const como = campo.getAttribute("data-mapa-viaje-como");
    apuntarPaso("viaje-" + como);
    const n = Number(String(campo.value).replace(",", "."));
    e.travel = Object.assign({}, e.travel);
    if (Number.isFinite(n) && n > 0) {
        e.travel[como] = n;
    } else {
        delete e.travel[como];
    }
    const total = largoDeMedida(estadoMapa.medida);
    $("[data-mapa-medida]").textContent = estadoMapa.medida.length < 2 ? "Pulsa en el mapa de un sitio a otro."
        : "Distancia: " + textoDeDistancia(total) + ".";
}

function quitarEscala() {
    if (!estadoMapa.datos.scale) {
        return;
    }
    apuntarPaso();
    delete estadoMapa.datos.scale;
    pintarMedida();
    avisarEditor("Escala quitada.");
}

// ---- EL RATÓN ----
function alApretarEnElMapa(e) {
    if (!estadoMapa.datos || (e.button !== 0 && e.button !== 1)) {
        return;
    }
    estadoMapa.sinIman = e.altKey;
    const svg = svgDelMapa();
    const p = puntoDelMapa(e);
    const inicio = { x: e.clientX, y: e.clientY, p, vista: Object.assign({}, estadoMapa.vista) };
    // Con el botón de en medio, o en un hueco con «Elegir y mover»: moverse.
    const asa = e.target.closest("[data-asa]");
    const medio = e.target.closest("[data-medio]");
    const cosa = e.target.closest("[data-lista]");
    const h = estadoMapa.herramienta;
    if (e.button === 1 || (h === "elegir" && !asa && !medio && !cosa)) {
        estadoMapa.arrastre = { que: "vista", inicio, movido: false };
    } else if (h === "elegir" && asa && esDobleEnAsa(asa)) {
        quitarPuntoMapa(Number(asa.getAttribute("data-asa")));
        return;
    } else if (h === "elegir" && (asa || medio)) {
        const el = estadoMapa.elegido;
        const puntos = estadoMapa.datos[el.lista][el.i].points;
        let n;
        let apuntado = false;
        if (medio) {
            apuntarPaso();
            apuntado = true;
            n = Number(medio.getAttribute("data-medio")) + 1;
            puntos.splice(n, 0, dentroDelMapa(p));
            repintarCosa(el.lista, el.i);
        } else {
            n = Number(asa.getAttribute("data-asa"));
        }
        estadoMapa.arrastre = { que: "punto", n, inicio, movido: false, apuntado };
    } else if (h === "elegir" && cosa) {
        const lista = cosa.getAttribute("data-lista");
        const i = Number(cosa.getAttribute("data-i"));
        elegirCosa(lista, i);
        const movible = lista === "pins" || lista === "labels";
        estadoMapa.arrastre = movible
            ? { que: "sitio", lista, inicio, desde: { x: estadoMapa.datos[lista][i].x, y: estadoMapa.datos[lista][i].y },
                movido: false }
            : { que: "vista", inicio, movido: false, cosa: true };
    } else if (HERRAMIENTAS_DE_DIBUJO.includes(h) && $("#mapa-mano").checked) {
        empezarDibujo();
        estadoMapa.dibujo.puntos.push(dentroDelMapa(imantar(p).p));
        estadoMapa.arrastre = { que: "mano", inicio, movido: false };
    } else {
        estadoMapa.arrastre = { que: "clic", inicio, movido: false };
    }
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
}

function alMoverEnElMapa(e) {
    const a = estadoMapa.arrastre;
    const dibujo = estadoMapa.dibujo;
    estadoMapa.sinIman = e.altKey;
    const h = estadoMapa.herramienta;
    if (!a) {
        // Sin arrastrar: dónde caería lo siguiente (con el imán).
        if (h === "elegir") {
            return;
        }
        const pegado = imantar(puntoDelMapa(e));
        estadoMapa.iman = pegado.pegado ? pegado.p : null;
        if (dibujo && dibujo.puntos.length) {
            dibujo.raton = pegado.p;
        }
        if (h === "medir" && estadoMapa.medida.length) {
            estadoMapa.ratonMedida = pegado.p;
            const tramo = largoDeMedida([estadoMapa.medida[estadoMapa.medida.length - 1], pegado.p]);
            $("[data-mapa-medida-raton]").textContent = "Hasta el ratón, " + textoDeDistancia(tramo) + " más.";
        }
        pintarDibujoMapa();
        return;
    }
    const lienzo = lienzoMapa();
    const dx = e.clientX - a.inicio.x;
    const dy = e.clientY - a.inicio.y;
    if (!a.movido && Math.hypot(dx, dy) < 4) {
        return;
    }
    a.movido = true;
    if (a.que === "vista") {
        const s = Math.max(a.inicio.vista.w / lienzo.clientWidth, a.inicio.vista.h / lienzo.clientHeight);
        ponerVistaMapa({ x: a.inicio.vista.x - dx * s, y: a.inicio.vista.y - dy * s, w: a.inicio.vista.w, h: a.inicio.vista.h });
        return;
    }
    const p = puntoDelMapa(e);
    const el = estadoMapa.elegido;
    if ((a.que === "sitio" || a.que === "punto") && !a.apuntado) {
        apuntarPaso();
        a.apuntado = true;
    }
    if (a.que === "sitio") {
        const sitio = estadoMapa.datos[a.lista][el.i];
        const quiere = { x: a.desde.x + p.x - a.inicio.p.x, y: a.desde.y + p.y - a.inicio.p.y };
        const pegado = a.lista === "pins" ? imantar(quiere, { lista: "pins", i: el.i }) : { p: quiere, pegado: false };
        estadoMapa.iman = pegado.pegado ? pegado.p : null;
        Object.assign(sitio, dentroDelMapa(pegado.p));
        repintarCosa(a.lista, el.i);
    } else if (a.que === "punto") {
        const pegado = imantar(p, { lista: el.lista, i: el.i, n: a.n });
        estadoMapa.iman = pegado.pegado ? pegado.p : null;
        estadoMapa.datos[el.lista][el.i].points[a.n] = dentroDelMapa(pegado.p);
        repintarCosa(el.lista, el.i);
    } else if (a.que === "mano" && dibujo) {
        const ultimo = dibujo.puntos[dibujo.puntos.length - 1];
        if (Math.hypot(ultimo.x - p.x, ultimo.y - p.y) > 3 * escalaMapa()) {
            dibujo.puntos.push(dentroDelMapa(p));
            pintarDibujoMapa();
        }
    }
}

function alSoltarEnElMapa(e) {
    const a = estadoMapa.arrastre;
    estadoMapa.arrastre = null;
    if (!a) {
        return;
    }
    const h = estadoMapa.herramienta;
    if (a.que === "sitio" || a.que === "punto") {
        estadoMapa.iman = null;
        pintarDibujoMapa();
        if (a.movido) {
            pintarPropiedadesMapa();
        }
    } else if (a.que === "mano") {
        terminarDibujo(true);
    } else if (a.que === "vista" && !a.movido && h === "elegir" && !a.cosa) {
        // Un clic en un hueco: soltar lo elegido.
        if (estadoMapa.elegido) {
            elegirCosa(null);
        }
    } else if (a.que === "clic" && !a.movido) {
        if (h === "pin") {
            ponerSitio(a.inicio.p);
        } else if (h === "texto") {
            ponerTexto(a.inicio.p);
        } else if (h === "medir") {
            anadirPuntoMedida(a.inicio.p);
        } else {
            anadirPuntoDibujo(a.inicio.p);
        }
    }
}

// Dos pulsaciones seguidas en el mismo punto de una región o una raya. (No
// vale el dblclick: mientras se arrastra, el SVG se queda con el ratón y el
// doble clic le llega a él, no al punto.)
let ultimaAsaMapa = { n: -1, cuando: 0 };

function esDobleEnAsa(asa) {
    const n = Number(asa.getAttribute("data-asa"));
    const ahora = Date.now();
    const doble = ultimaAsaMapa.n === n && ahora - ultimaAsaMapa.cuando < 450;
    ultimaAsaMapa = doble ? { n: -1, cuando: 0 } : { n, cuando: ahora };
    return doble;
}

function quitarPuntoMapa(n) {
    const el = estadoMapa.elegido;
    if (!el || el.lista === "pins" || el.lista === "labels") {
        return;
    }
    const puntos = estadoMapa.datos[el.lista][el.i].points;
    if (puntos.length <= (el.lista === "shapes" ? 3 : 2)) {
        avisarEditor("No le quedan puntos que quitar: si sobra entera, bórrala.", true);
        return;
    }
    apuntarPaso();
    puntos.splice(n, 1);
    repintarCosa(el.lista, el.i);
    pintarPropiedadesMapa();
}

function alDobleClicEnElMapa() {
    if (HERRAMIENTAS_DE_DIBUJO.includes(estadoMapa.herramienta) && estadoMapa.dibujo) {
        terminarDibujo();
    }
}

function alGirarLaRueda(e) {
    if (!estadoMapa.datos) {
        return;
    }
    e.preventDefault();
    acercarMapa(e.deltaY < 0 ? 1.25 : 0.8, puntoDelMapa(e));
}

// ---- EL TECLADO (con el mapa elegido) ----
function alPulsarEnElMapa(e) {
    if (!estadoMapa.datos) {
        return;
    }
    const v = estadoMapa.vista;
    const paso = (e.shiftKey ? 0.25 : 0.08);
    const flechas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const el = estadoMapa.elegido;
    const h = estadoMapa.herramienta;
    if (flechas[e.key]) {
        e.preventDefault();
        const [fx, fy] = flechas[e.key];
        if (el && (el.lista === "pins" || el.lista === "labels") && h === "elegir") {
            const sitio = estadoMapa.datos[el.lista][el.i];
            const s = escalaMapa() * (e.shiftKey ? 20 : 4);
            apuntarPaso("mover-" + el.lista + "-" + el.i);
            Object.assign(sitio, dentroDelMapa({ x: sitio.x + fx * s, y: sitio.y + fy * s }));
            repintarCosa(el.lista, el.i);
            pintarPropiedadesMapa();
        } else {
            moverVistaMapa(fx * v.w * paso, fy * v.h * paso);
        }
    } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        acercarMapa(1.25);
    } else if (e.key === "-") {
        e.preventDefault();
        acercarMapa(0.8);
    } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (h === "pin") {
            ponerSitio(centroDeLaVista());
        } else if (h === "texto") {
            ponerTexto(centroDeLaVista());
        } else if (h === "medir") {
            anadirPuntoMedida(centroDeLaVista());
        } else if (h !== "elegir") {
            anadirPuntoDibujo(centroDeLaVista());
        }
    } else if (e.key === "End") {
        e.preventDefault();
        terminarDibujo();
    } else if (e.key === "Escape") {
        if (estadoMapa.dibujo) {
            cancelarDibujo();
        } else if (h === "medir" && estadoMapa.medida.length) {
            empezarOtraMedida();
        } else if (el) {
            elegirCosa(null);
        }
    } else if ((e.key === "Delete" || e.key === "Backspace") && el) {
        e.preventDefault();
        borrarElegido();
    }
}

function empezarOtraMedida() {
    estadoMapa.medida = [];
    estadoMapa.ratonMedida = null;
    pintarMedida();
}

// ---- CAMBIAR LA IMAGEN (con el mismo encuadre) ----
async function cambiarImagenMapa(input) {
    const imagen = await leerImagenMapa(input);
    input.value = "";
    if (!imagen) {
        return;
    }
    avisarEditor("Preparando la imagen…");
    // («archivo» es el nombre de la imagen elegida; el mapa va en «mapa».)
    const hecha = await pedirEditor("/api/mapa/imagen", Object.assign({ mapa: estadoMapa.archivo }, imagen));
    if (hecha.error) {
        avisarEditor(hecha.error, true);
        return;
    }
    apuntarPaso();
    const d = estadoMapa.datos;
    // Lo puesto, a la medida nueva: si la imagen es el doble de grande,
    // cada coordenada, el doble (y la escala, igual).
    const fx = hecha.ancho / d.width;
    const fy = hecha.alto / d.height;
    const escalar = (p) => {
        p.x = redondoMapa(p.x * fx);
        p.y = redondoMapa(p.y * fy);
    };
    d.pins.forEach(escalar);
    d.labels.forEach(escalar);
    d.shapes.concat(d.lines).forEach((c) => (c.points || []).forEach(escalar));
    if (d.scale && d.scale.pixels) {
        d.scale.pixels = redondoMapa(d.scale.pixels * (fx + fy) / 2);
    }
    d.width = hecha.ancho;
    d.height = hecha.alto;
    d.layers[0].image = hecha.nombre;
    estadoMapa.imagenes[hecha.nombre] = hecha.url;
    estadoMapa.medida = [];
    pintarDatosGenerales();
    pintarTodoElMapa();
    ajustarMapa();
    pintarPropiedadesMapa();
    pintarMedida();
    const raro = Math.abs(fx - fy) > 0.02 ? " OJO: no tiene la misma forma que la otra, así que lo puesto se ha estirado." : "";
    avisarEditor("Imagen cambiada: " + hecha.nombre + " (" + hecha.ancho + " × " + hecha.alto + ")." + raro
        + " Recuerda guardar.", !!raro);
}

// ---- DESCARGAR LA IMAGEN, CON TODO LO PUESTO ----
// Un PNG del tamaño del mapa: las capas que se ven aquí y, encima, las
// regiones (con su nombre en medio), las rayas, los textos, los sitios con
// su símbolo y su nombre y la barra de escala. Se pinta en un <canvas> a
// partir de los datos, no del SVG de la pantalla: así los tamaños van en
// proporción al mapa y no al zoom de ahora. Sale lo que hay en el editor,
// aunque no esté guardado.
function cargarImagenMapa(url) {
    return new Promise((resolver) => {
        const img = new Image();
        img.onload = () => resolver(img);
        img.onerror = () => resolver(null);
        img.src = url;
    });
}

function centroDeRegion(puntos) {
    // El centro de la caja; si cae fuera (una región en forma de C), el
    // punto medio de la fila horizontal más larga que la cruce por en medio.
    const xs = puntos.map((p) => p.x);
    const ys = puntos.map((p) => p.y);
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const cortes = [];
    puntos.forEach((a, i) => {
        const b = puntos[(i + 1) % puntos.length];
        if ((a.y > cy) !== (b.y > cy)) {
            cortes.push(a.x + (cy - a.y) * (b.x - a.x) / (b.y - a.y));
        }
    });
    cortes.sort((a, b) => a - b);
    let mejor = null;
    for (let i = 0; i + 1 < cortes.length; i += 2) {
        if (!mejor || cortes[i + 1] - cortes[i] > mejor[1] - mejor[0]) {
            mejor = [cortes[i], cortes[i + 1]];
        }
    }
    return { x: mejor ? (mejor[0] + mejor[1]) / 2 : (Math.min(...xs) + Math.max(...xs)) / 2, y: cy };
}

function letreroMapa(ctx, texto, x, y, k, tamano, alinear, estilo) {
    ctx.font = (estilo || "") + "700 " + Math.round(tamano * k) + 'px "Space Grotesk", system-ui, "Segoe UI", sans-serif';
    ctx.textAlign = alinear || "left";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4 * k;
    ctx.strokeStyle = "#1b1020";
    ctx.strokeText(texto, x, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(texto, x, y);
}

function rayaEnLienzo(ctx, puntos, k) {
    ctx.beginPath();
    puntos.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
}

function pintarRayaEnLienzo(ctx, l, k) {
    const puntos = l.points || [];
    if (puntos.length < 2) {
        return;
    }
    const estilo = estiloDeRaya(l.kind);
    const color = l.color || estilo.color;
    ctx.lineJoin = "round";
    if (l.kind === "rio" && l.taper !== false) {
        const tramos = tramosDeRio(puntos);
        ctx.lineCap = "round";
        ctx.setLineDash([]);
        [[estilo.colorBorde || "#1b1020", 3], [color, 0]].forEach(([pintura, mas]) => {
            tramos.forEach((t) => {
                rayaEnLienzo(ctx, t.puntos, k);
                ctx.strokeStyle = pintura;
                ctx.lineWidth = (t.grueso + mas) * k;
                ctx.stroke();
            });
        });
    } else {
        ctx.lineCap = estilo.corte || "round";
        const trazos = estilo.trazos ? estilo.trazos.map((x) => x * k) : [];
        rayaEnLienzo(ctx, puntos, k);
        ctx.setLineDash(estilo.bordeConTrazos ? trazos : []);
        ctx.strokeStyle = estilo.colorBorde || "#1b1020";
        ctx.lineWidth = estilo.borde * k;
        ctx.stroke();
        ctx.setLineDash(trazos);
        ctx.strokeStyle = color;
        ctx.lineWidth = estilo.ancho * k;
        ctx.stroke();
        ctx.setLineDash([]);
    }
    if (estilo.flechas) {
        // Del tamaño de las de la pantalla con el mapa entero.
        const r = 8 * k;
        flechasDeRaya(puntos).forEach((f) => {
            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.giro * Math.PI / 180);
            ctx.beginPath();
            ctx.moveTo(-r, -r * 0.75);
            ctx.lineTo(r, 0);
            ctx.lineTo(-r, r * 0.75);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.lineWidth = 1.5 * k;
            ctx.strokeStyle = "#1b1020";
            ctx.stroke();
            ctx.restore();
        });
    }
}

function barraDeEscalaEnLienzo(ctx, d, k) {
    const e = d.scale;
    if (!e || !e.pixels || !e.distance) {
        return;
    }
    // Como _barra_de_escala en mundo_mapas.py: un número redondo de
    // alrededor de un sexto del mapa, abajo a la izquierda.
    const porPixel = e.distance / e.pixels;
    const deseado = d.width / 6 * porPixel;
    const potencia = Math.pow(10, Math.floor(Math.log10(deseado)));
    const valor = [5, 2, 1].map((m) => m * potencia).find((v) => v <= deseado);
    const largo = valor / porPixel;
    const base = Math.max(d.width, d.height);
    const x0 = d.width / 40;
    const y0 = d.height - d.height / 22;
    const alto = base / 200;
    ctx.fillStyle = "rgba(27,16,32,0.55)";
    ctx.fillRect(x0 - alto * 0.6, y0 - alto * 0.6, largo + alto * 1.2, alto * 2.2);
    ctx.fillStyle = "#f4ecd8";
    ctx.fillRect(x0, y0, largo / 2, alto);
    ctx.fillStyle = "#1b1020";
    ctx.fillRect(x0 + largo / 2, y0, largo / 2, alto);
    ctx.strokeStyle = "#f4ecd8";
    ctx.lineWidth = k;
    ctx.strokeRect(x0 + largo / 2, y0, largo / 2, alto);
    ctx.font = "700 " + Math.round(base / 60) + 'px "Space Grotesk", system-ui, sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    ctx.lineWidth = base / 60 * 0.2;
    ctx.strokeStyle = "#1b1020";
    const texto = cifraMapa(valor, 2) + (e.unit ? " " + e.unit : "");
    ctx.strokeText(texto, x0, y0 - alto * 1.6);
    ctx.fillStyle = "#f4ecd8";
    ctx.fillText(texto, x0, y0 - alto * 1.6);
}

async function descargarImagenMapa() {
    const d = estadoMapa.datos;
    if (!d) {
        return;
    }
    avisarEditor("Preparando la imagen…");
    // El lienzo, del tamaño del mapa (con un tope: un PNG de 8000 px no
    // lo abre casi nada).
    const tope = 8192;
    const f = Math.min(1, tope / Math.max(d.width, d.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(d.width * f);
    lienzo.height = Math.round(d.height * f);
    const ctx = lienzo.getContext("2d");
    ctx.scale(f, f);
    // Lo que en pantalla mide «un píxel», aquí mide k: un mapa de 1400 px
    // lleva las rayas y los sitios como se ven en el editor al verlo entero.
    const k = Math.max(d.width, d.height) / 1400;

    ctx.fillStyle = "#241a2e";
    ctx.fillRect(0, 0, d.width, d.height);
    const capas = d.layers.slice().sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0));
    for (const c of capas) {
        const url = estadoMapa.imagenes[c.image];
        if (!url || estadoMapa.capasOcultas[c.id]) {
            continue;
        }
        const img = await cargarImagenMapa(url);
        if (img) {
            ctx.globalAlpha = typeof c.opacity === "number" ? c.opacity : 1;
            ctx.drawImage(img, 0, 0, d.width, d.height);
            ctx.globalAlpha = 1;
        }
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Las regiones.
    d.shapes.forEach((s) => {
        const puntos = s.points || [];
        if (puntos.length < 3) {
            return;
        }
        const color = s.color || "#f5ce6c";
        rayaEnLienzo(ctx, puntos, k);
        ctx.closePath();
        ctx.globalAlpha = s.label || s.targetPage ? 0.35 : 0.18;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * k;
        ctx.stroke();
        ctx.globalAlpha = 1;
    });

    // Las rayas.
    d.lines.forEach((l) => pintarRayaEnLienzo(ctx, l, k));

    // Los textos sueltos, del tamaño del mapa y girados.
    d.labels.forEach((t) => {
        if (!t.label) {
            return;
        }
        const tam = tamanoDeTexto(t);
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate((t.angle || 0) * Math.PI / 180);
        ctx.font = "italic 700 " + Math.round(tam) + "px Georgia, \"Times New Roman\", serif";
        if ("letterSpacing" in ctx) {
            ctx.letterSpacing = Math.round(tam * 0.12) + "px";
        }
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.lineWidth = tam * 0.16;
        ctx.strokeStyle = "#1b1020";
        ctx.strokeText(t.label, 0, 0);
        ctx.fillStyle = t.color || "#f4ecd8";
        ctx.fillText(t.label, 0, 0);
        ctx.restore();
    });

    // Los nombres de las regiones, en medio, en cursiva para no
    // confundirlos con los de los sitios. Si en medio hay un sitio (con su
    // nombre al lado), el de la región se baja o se sube hasta un hueco.
    const ocupado = d.pins.map((p) => {
        ctx.font = "700 " + Math.round(15 * k) + 'px "Space Grotesk", system-ui, sans-serif';
        const ancho = p.label ? ctx.measureText(p.label).width + 22 * k : 0;
        return { x1: p.x - 14 * k, x2: p.x + 14 * k + ancho, y1: p.y - 14 * k, y2: p.y + 14 * k };
    });
    d.shapes.forEach((s) => {
        if (!s.label || (s.points || []).length < 3) {
            return;
        }
        const c = centroDeRegion(s.points);
        ctx.font = "italic 700 " + Math.round(18 * k) + 'px "Space Grotesk", system-ui, sans-serif';
        const medio = ctx.measureText(s.label).width / 2;
        const choca = (y) => ocupado.some((o) => o.x1 < c.x + medio && o.x2 > c.x - medio
            && o.y1 < y + 12 * k && o.y2 > y - 12 * k);
        let y = c.y;
        for (let n = 1; n <= 8 && choca(y); n++) {
            y = c.y + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 26 * k;
        }
        ocupado.push({ x1: c.x - medio, x2: c.x + medio, y1: y - 12 * k, y2: y + 12 * k });
        letreroMapa(ctx, s.label, c.x, y, k, 18, "center", "italic ");
    });

    // Los sitios: su símbolo y su nombre a la derecha.
    d.pins.forEach((p) => {
        const tipo = tipoDeSitioMapa(p.kind);
        const r = 12 * k;
        ctx.fillStyle = p.color || (tipo ? tipo[3] : "#e74c3c");
        ctx.strokeStyle = "#1b1020";
        ctx.lineWidth = 2.5 * k;
        ctx.setLineDash(p.kind === "ruina" ? [4 * k, 3 * k] : []);
        ctx.beginPath();
        if (p.kind === "fortaleza") {
            ctx.rect(p.x - r * 0.92, p.y - r * 0.92, r * 1.84, r * 1.84);
        } else {
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        const simbolo = tipo ? tipo[2] + "︎" : (p.icon || "");
        if (simbolo) {
            ctx.fillStyle = "#1b1020";
            ctx.font = "700 " + Math.round(13 * k) + "px " + LETRA_DE_SIMBOLOS;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(simbolo, p.x, p.y + k);
        }
        if (p.label) {
            letreroMapa(ctx, p.label, p.x + r + 5 * k, p.y, k, 15);
        }
    });

    barraDeEscalaEnLienzo(ctx, d, k);

    lienzo.toBlob((blob) => {
        if (!blob) {
            avisarEditor("No se ha podido hacer la imagen (¿el mapa es demasiado grande?).", true);
            return;
        }
        const nombre = (d.title || estadoMapa.archivo.split("/").pop().replace(/\.cmap$/i, "") || "mapa")
            .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\- ]+/g, "").trim()
            .replace(/\s+/g, "_").toLowerCase() || "mapa";
        const enlace = document.createElement("a");
        enlace.href = URL.createObjectURL(blob);
        enlace.download = nombre + ".png";
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(enlace.href), 10000);
        avisarEditor("Imagen descargada: " + nombre + ".png (" + lienzo.width + " × " + lienzo.height
            + " px). Va con lo que hay ahora en el editor, esté guardado o no.");
    }, "image/png");
}

// ---- GUARDAR ----
async function guardarMapa(yPasar) {
    if (!estadoMapa.datos || estadoMapa.guardando) {
        return;
    }
    if (estadoMapa.dibujo && estadoMapa.dibujo.puntos.length) {
        avisarEditor("Hay un dibujo a medias: termínalo o cancélalo antes de guardar.", true);
        return;
    }
    estadoMapa.guardando = true;
    const botones = document.querySelectorAll("[data-mapa-guardar], [data-mapa-pasar]");
    botones.forEach((b) => {
        b.disabled = true;
    });
    avisarEditor("Guardando…");
    // Los textos sin escribir no se guardan; y si no hay ninguno, la
    // lista tampoco (un mapa de Chronicler se queda como estaba).
    const datos = Object.assign({}, estadoMapa.datos);
    datos.labels = datos.labels.filter((t) => (t.label || "").trim());
    if (!datos.labels.length) {
        delete datos.labels;
    }
    const hecho = await pedirEditor("/api/mapa/guardar", { archivo: estadoMapa.archivo, datos });
    if (hecho.error) {
        avisarEditor(hecho.error, true);
    } else {
        estadoMapa.cambiado = false;
        if (!yPasar) {
            avisarEditor("Guardado en wiki/" + estadoMapa.archivo + ".");
        } else {
            avisarEditor("Guardado. Pasando la wiki a la web (tarda un poco)…");
            const pasado = await pedirEditor("/api/pasar", { mapa: estadoMapa.archivo });
            if (pasado.error) {
                avisarEditor(pasado.error, true, pasado.salida);
            } else {
                estadoMapa.url = pasado.url || estadoMapa.url;
                pintarVerMapa();
                avisarEditor(estadoMapa.url ? "Guardado y pasado a la web. Ya puedes verlo con «Ver el mapa»."
                    : "Guardado y pasado a la web.", false, pasado.salida);
            }
        }
    }
    botones.forEach((b) => {
        b.disabled = false;
    });
    estadoMapa.guardando = false;
}

// ---- AL EMPEZAR ----
function opcionesMapa(select, lista, conSimbolo) {
    lista.forEach((t) => {
        const o = document.createElement("option");
        o.value = t[0];
        o.textContent = conSimbolo ? t[2] + " " + t[1] : t[1];
        select.appendChild(o);
    });
}

function escribiendoEnUnaCasilla() {
    const activo = document.activeElement;
    if (!activo) {
        return false;
    }
    if (activo.tagName === "TEXTAREA") {
        return true;
    }
    return activo.tagName === "INPUT" && !["checkbox", "radio", "range", "button", "file", "color"].includes(activo.type);
}

function empezarMapas() {
    opcionesMapa($("[data-mapa-tipos-pin]"), TIPOS_DE_SITIO, true);
    $("[data-mapa-tipos-pin]").value = "ciudad";
    opcionesMapa($("[data-mapa-tipos-raya]"), TIPOS_DE_RAYA, false);

    document.querySelectorAll('[data-ir="mapas"]').forEach((b) => b.addEventListener("click", pintarListaDeMapas));
    $("[data-mapa-nuevo]").addEventListener("submit", (e) => {
        e.preventDefault();
        hacerMapaNuevo();
    });
    $("#mapa-nuevo-archivo").addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0];
        $("[data-mapa-nuevo-elegida]").textContent = f ? "Elegida: " + f.name : "";
    });
    document.querySelectorAll('input[name="herramienta"]').forEach((r) => {
        r.addEventListener("change", () => ponerHerramienta(r.value));
    });
    $("#mapa-mano").addEventListener("change", () => ponerHerramienta(estadoMapa.herramienta));
    document.querySelectorAll("[data-mapa-zoom]").forEach((b) => {
        b.addEventListener("click", () => acercarMapa(b.getAttribute("data-mapa-zoom") === "1" ? 1.5 : 1 / 1.5));
    });
    $("[data-mapa-ajustar]").addEventListener("click", ajustarMapa);
    $("[data-mapa-deshacer]").addEventListener("click", deshacerMapa);
    $("[data-mapa-rehacer]").addEventListener("click", rehacerMapa);
    $("[data-mapa-terminar]").addEventListener("click", () => terminarDibujo());
    $("[data-mapa-cancelar]").addEventListener("click", cancelarDibujo);
    $("[data-mapa-quitar-punto]").addEventListener("click", quitarUltimoPunto);
    $("[data-mapa-borrar]").addEventListener("click", borrarElegido);
    $("[data-mapa-medir-otra]").addEventListener("click", empezarOtraMedida);
    $("[data-mapa-escala-poner]").addEventListener("click", ponerEscala);
    $("[data-mapa-escala-quitar]").addEventListener("click", quitarEscala);
    document.querySelectorAll("[data-mapa-viaje-como]").forEach((campo) => {
        campo.addEventListener("input", () => cambiarViaje(campo));
        campo.addEventListener("blur", () => {
            estadoMapa.ultimoCampo = null;
        });
    });

    const svg = svgDelMapa();
    svg.addEventListener("pointerdown", alApretarEnElMapa);
    svg.addEventListener("pointermove", alMoverEnElMapa);
    svg.addEventListener("pointerup", alSoltarEnElMapa);
    svg.addEventListener("pointercancel", () => {
        estadoMapa.arrastre = null;
    });
    svg.addEventListener("pointerleave", () => {
        if (estadoMapa.dibujo) {
            estadoMapa.dibujo.raton = null;
        }
        estadoMapa.ratonMedida = null;
        estadoMapa.iman = null;
        pintarDibujoMapa();
    });
    svg.addEventListener("dblclick", alDobleClicEnElMapa);
    svg.addEventListener("auxclick", (e) => e.preventDefault());
    lienzoMapa().addEventListener("wheel", alGirarLaRueda, { passive: false });
    lienzoMapa().addEventListener("keydown", alPulsarEnElMapa);
    window.addEventListener("resize", () => {
        if (estadoMapa.vista && !$('[data-vista="mapa"]').hidden) {
            ponerVistaMapa(estadoMapa.vista);
        }
    });

    // Lo elegido: cada casilla cambia lo suyo al escribir. Al salir de una
    // casilla se cierra su paso de «deshacer».
    document.querySelectorAll("[data-mapa-p]").forEach((campo) => {
        const que = campo.getAttribute("data-mapa-p");
        const tipo = campo.type === "checkbox" || campo.tagName === "SELECT" ? "change" : "input";
        campo.addEventListener(tipo, () => {
            if (que === "con-color" || que === "taper") {
                cambiarPropiedadMapa(que, campo.checked);
            } else {
                cambiarPropiedadMapa(que, ["x", "y", "angle"].includes(que) ? campo.value : campo.value.trim());
            }
        });
        campo.addEventListener("blur", () => {
            estadoMapa.ultimoCampo = null;
        });
    });
    $("#mapa-p-nombre").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            lienzoMapa().focus({ preventScroll: true });
        }
    });
    document.querySelectorAll("[data-mapa-general]").forEach((campo) => {
        campo.addEventListener("input", () => {
            const que = campo.getAttribute("data-mapa-general");
            const valor = campo.value.trim();
            apuntarPaso("general-" + que);
            if (valor) {
                estadoMapa.datos[que] = valor;
            } else {
                delete estadoMapa.datos[que];
            }
            if (que === "title") {
                pintarTituloMapa();
            }
        });
        campo.addEventListener("blur", () => {
            estadoMapa.ultimoCampo = null;
        });
    });
    $("#mapa-otra-imagen").addEventListener("change", (e) => cambiarImagenMapa(e.target));

    $("[data-mapa-guardar]").addEventListener("click", () => guardarMapa(false));
    $("[data-mapa-descargar]").addEventListener("click", descargarImagenMapa);
    $("[data-mapa-pasar]").addEventListener("click", () => guardarMapa(true));
    document.addEventListener("keydown", (e) => {
        if ($('[data-vista="mapa"]').hidden || !(e.ctrlKey || e.metaKey)) {
            return;
        }
        const tecla = e.key.toLowerCase();
        if (tecla === "s") {
            e.preventDefault();
            guardarMapa(false);
        } else if ((tecla === "z" || tecla === "y") && !escribiendoEnUnaCasilla()) {
            // En una casilla de texto, Ctrl+Z deshace lo escrito en ella
            // (lo del navegador); fuera, deshace en el mapa.
            e.preventDefault();
            if (tecla === "y" || e.shiftKey) {
                rehacerMapa();
            } else {
                deshacerMapa();
            }
        }
    });
    ponerHerramienta("elegir");
}

empezarMapas();
