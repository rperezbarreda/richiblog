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
// Los emblemas: [valor, nombre] de la forma y [valor, nombre, cuánto más
// grande que un sitio] del tamaño. Los mismos que FORMAS_DE_EMBLEMA y
// TAMANOS_DE_EMBLEMA en mundo_mapas.py.
const FORMAS_DE_EMBLEMA = [["", "Con su símbolo"], ["tipo", "Emblema con la forma de su tipo"],
    ["escudo", "Escudo"], ["bandera", "Bandera"], ["redondo", "Medallón (círculo)"], ["cuadrado", "Cuadrado"],
    ["rombo", "Rombo"], ["hexagono", "Hexágono"], ["octogono", "Octógono"], ["triangulo", "Triángulo"],
    ["triangulo-abajo", "Triángulo hacia abajo"], ["casa", "Casa"], ["torre", "Torre"], ["cupula", "Cúpula"],
    ["pildora", "Píldora"], ["estrella", "Estrella"], ["cruz", "Cruz"]];
// La forma de cada tipo de sitio (FORMA_POR_TIPO en mundo_mapas.py): la de
// su símbolo y la de su emblema con «la forma de su tipo».
const FORMA_POR_TIPO = { capital: "escudo", ciudad: "hexagono", pueblo: "redondo", fortaleza: "cuadrado",
    ruina: "rombo", puerto: "octogono", templo: "casa", torre: "torre", cueva: "cupula", mina: "triangulo-abajo",
    puente: "pildora", batalla: "estrella", mazmorra: "cruz", campamento: "triangulo" };
const TAMANOS_DE_EMBLEMA = [["pequeno", "Pequeño", 0.8], ["mediano", "Mediano", 1.2], ["grande", "Grande", 1.7]];
const LETRA_DE_SIMBOLOS = '"Segoe UI Symbol", "Noto Sans Symbols 2", "Noto Sans Symbols", "DejaVu Sans", sans-serif';
// Las rayas y cómo se pintan: los mismos colores y trazos que la web
// (estilos/paginas/mundo-mapa.css). ancho y borde en píxeles de pantalla.
const TIPOS_DE_RAYA = [
    ["camino", "Camino principal"], ["sendero", "Sendero"], ["rio", "Río"], ["frontera", "Frontera"],
    ["maritima", "Ruta marítima"], ["muralla", "Muralla"], ["ruta", "Ruta de viaje"],
];
const ESTILO_DE_RAYA = {
    camino: { color: "#f0dfb4", ancho: 4.5, borde: 7.5, trazos: null },
    sendero: { color: "#e2cf9f", ancho: 2.5, borde: 4.5, trazos: [5, 5] },
    rio: { color: "#4aa3df", ancho: 4.5, borde: 7, trazos: null },
    frontera: { color: "#8e1b3b", ancho: 3, borde: 6, colorBorde: "#f4f1f7", trazos: [12, 5, 2, 5], corte: "butt",
        bordeConTrazos: true },
    maritima: { color: "#e6f4ff", ancho: 4, borde: 6.5, trazos: [0.5, 8], bordeConTrazos: true },
    muralla: { color: "#a39a90", ancho: 6, borde: 9, trazos: null, corte: "butt" },
    ruta: { color: "#e8446f", ancho: 3.5, borde: 6, trazos: [9, 6], flechas: true },
};
// El tamaño de los textos de antes (el lado largo del mapa entre esto); los
// de ahora lo llevan en píxeles del mapa ("fontSize").
const TAMANOS_DE_TEXTO = [["grande", "Grande", 45], ["mediano", "Mediano", 70], ["pequeno", "Pequeño", 110]];
// Las letras de los textos: [clave, nombre, familia, grosor]. Las mismas
// que .mapa-texto.es-letra-… en estilos/paginas/mundo-mapa.css.
const LETRAS_DE_TEXTO = [
    ["antigua", "Antigua (Georgia)", 'Georgia, "Times New Roman", serif', 700],
    ["elegante", "Elegante (Palatino)", '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif', 700],
    ["legible", "Muy legible (Atkinson)", '"Atkinson Hyperlegible", system-ui, sans-serif', 700],
    ["moderna", "Moderna (Space Grotesk)", '"Space Grotesk", system-ui, sans-serif', 600],
    ["a-mano", "A mano (Pangolin)", '"Pangolin", cursive', 400],
    ["pixel", "De videojuego (Jersey 10)", '"Jersey 10", monospace', 400],
    ["maquina", "De máquina (DM Mono)", '"DM Mono", monospace', 500],
];
// Los colores que van tomando las regiones nuevas, uno detrás de otro.
const COLORES_DE_REGION = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22", "#1abc9c"];
// Las clases de zona: [valor, nombre, color si la zona no trae uno]. Las
// mismas que TIPOS_DE_ZONA en mundo_mapas.py; cada una con su trama
// (tramaDeZona) y lo tapada que va (la de mundo-mapa.css).
const TIPOS_DE_ZONA = [["vecino", "País vecino", "#9a8fb0"], ["provincia", "Provincia o comarca", "#f5ce6c"],
    ["lago", "Lago", "#3f8fd2"], ["mar", "Mar", "#2f6fb0"], ["bosque", "Bosque", "#2e7d32"],
    ["montana", "Montaña", "#8d6e63"], ["desierto", "Desierto", "#e0c27a"],
    ["pantano", "Pantano o ciénaga", "#6b7d3a"], ["valle", "Valle o llanura", "#9ccc65"]];
const OPACIDAD_DE_ZONA = { vecino: 0.3, provincia: 0.07, lago: 0.42, mar: 0.42, bosque: 0.3, montana: 0.3,
    desierto: 0.3, pantano: 0.3, valle: 0.3 };
// Cuánto se anda en un día, según la unidad de la escala (se puede
// cambiar en el panel de medir).
const VIAJE_POR_UNIDAD = { leguas: { "a pie": 8, "a caballo": 12 }, km: { "a pie": 30, "a caballo": 50 },
    millas: { "a pie": 20, "a caballo": 30 } };
const PASOS_QUE_SE_RECUERDAN = 80;

const estadoMapa = {
    archivo: "", datos: null, imagenes: {}, url: "", cambiado: false, guardando: false,
    herramienta: "elegir", elegido: null, dibujo: null, vista: null, capasOcultas: {},
    arrastre: null, cuantasRegiones: 0, iman: null, sinIman: false, medida: [], tramoEscala: [], ratonMedida: null,
    ultimoCampo: null, varios: [], curvaPara: null, cajaEleccion: null, portapapeles: [], colorNuevo: {},
    paneo: null, habiaElegido: false,
};

// EL COLOR DE LO NUEVO: al cambiarle el color a algo (un sitio, una raya,
// una región, un texto), lo siguiente que se ponga de esa clase sale de
// ese color, hasta que se le quite (en la paleta, «Como su tipo»). Se
// recuerda en el navegador (si deja).
const LISTA_DE_HERRAMIENTA = { pin: "pins", raya: "lines", region: "shapes", texto: "labels" };
try {
    const guardado = JSON.parse(window.localStorage.getItem("mapa-color-nuevo") || "{}");
    if (guardado && typeof guardado === "object") {
        Object.keys(guardado).forEach((k) => {
            if (/^#[0-9a-f]{6}$/i.test(guardado[k])) {
                estadoMapa.colorNuevo[k] = guardado[k];
            }
        });
    }
} catch (error) {
    // Sin almacenamiento, se recuerda mientras esté abierta la página.
}

function apuntarColorNuevo(lista, color) {
    if (color) {
        estadoMapa.colorNuevo[lista] = color;
    } else {
        delete estadoMapa.colorNuevo[lista];
    }
    try {
        window.localStorage.setItem("mapa-color-nuevo", JSON.stringify(estadoMapa.colorNuevo));
    } catch (error) {
        // Igual que arriba.
    }
    pintarColorNuevo();
}

function conColorNuevo(lista, cosa) {
    if (estadoMapa.colorNuevo[lista]) {
        cosa.color = estadoMapa.colorNuevo[lista];
    }
    return cosa;
}

// En la paleta: de qué color sale lo que se ponga con esta herramienta.
function pintarColorNuevo() {
    const caja = $("[data-mapa-color-nuevo]");
    if (!caja) {
        return;
    }
    const color = estadoMapa.colorNuevo[LISTA_DE_HERRAMIENTA[estadoMapa.herramienta]];
    caja.hidden = !color;
    if (color) {
        $("[data-mapa-color-muestra]").style.background = color;
        $("[data-mapa-color-nombre]").textContent = color;
    }
}
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

function tipoDeZonaMapa(kind) {
    return TIPOS_DE_ZONA.find((t) => t[0] === kind) || null;
}

function estiloDeRaya(kind) {
    return ESTILO_DE_RAYA[kind] || ESTILO_DE_RAYA.camino;
}

// El estilo de UNA raya: el de su tipo con lo que tenga propio encima
// (grosor "width", tipo de trazo "dash" y separación "gap", como
// _estilo_de_raya en mundo_mapas.py).
function estiloDeLaRaya(cosa) {
    const base = estiloDeRaya(cosa.kind);
    const w = Number(cosa.width) > 0 ? Number(cosa.width) : base.ancho;
    const estilo = Object.assign({}, base, { ancho: w, borde: w + (base.borde - base.ancho) });
    const hueco = Number(cosa.gap) > 0 ? Number(cosa.gap) : 2 * w;
    if (cosa.dash === "solid") {
        estilo.trazos = null;
    } else if (cosa.dash === "dashed") {
        estilo.trazos = [3 * w, hueco];
    } else if (cosa.dash === "dotted") {
        estilo.trazos = [0.1, hueco];
        estilo.corte = "round";
    } else if (cosa.dash === "dashdot") {
        estilo.trazos = [3 * w, hueco, 0.1, hueco];
        estilo.corte = "round";
    } else if (Number(cosa.gap) > 0) {
        estilo.trazos = [3 * w, hueco];
    }
    if (cosa.dash) {
        // El borde oscuro, seguido: con trazos propios, punteado no se ve.
        estilo.bordeConTrazos = false;
    }
    return estilo;
}

function tamanoDeTexto(cosa) {
    if (Number(cosa.fontSize) > 0) {
        return Number(cosa.fontSize);
    }
    const t = TAMANOS_DE_TEXTO.find((x) => x[0] === cosa.size) || TAMANOS_DE_TEXTO[1];
    const d = estadoMapa.datos;
    return Math.max(d.width, d.height) / t[2];
}

// El contorno de un emblema de «radio» r centrado en (0, 0) (como
// _forma_de_emblema en mundo_mapas.py) y lo que baja por debajo.
function formaDeEmblema(forma, r, tipo) {
    const c = (n) => redondoMapa(n);
    const poligono = (puntos) => "M" + puntos.map((p) => c(p[0]) + " " + c(p[1])).join(" L") + " Z";
    if (forma === "tipo") {
        forma = FORMA_POR_TIPO[tipo] || "redondo";
    }
    if (forma === "bandera") {
        return { d: poligono([[-1.3 * r, -0.9 * r], [1.3 * r, -0.9 * r], [1.3 * r, 0.9 * r], [-1.3 * r, 0.9 * r]]),
            bajo: 0.9 * r };
    }
    if (forma === "redondo") {
        return { d: "M" + c(-1.2 * r) + " 0 A" + c(1.2 * r) + " " + c(1.2 * r) + " 0 1 0 " + c(1.2 * r) + " 0 A"
            + c(1.2 * r) + " " + c(1.2 * r) + " 0 1 0 " + c(-1.2 * r) + " 0 Z", bajo: 1.2 * r };
    }
    if (forma === "cuadrado") {
        const a = 1.05 * r;
        return { d: poligono([[-a, -a], [a, -a], [a, a], [-a, a]]), bajo: a };
    }
    if (forma === "rombo") {
        return { d: poligono([[0, -1.4 * r], [1.2 * r, 0], [0, 1.4 * r], [-1.2 * r, 0]]), bajo: 1.4 * r };
    }
    if (forma === "hexagono" || forma === "octogono") {
        const lados = forma === "hexagono" ? 6 : 8;
        const giro = lados === 6 ? -90 : -67.5;
        const radio = (lados === 6 ? 1.25 : 1.2) * r;
        const puntos = [];
        for (let k = 0; k < lados; k++) {
            const angulo = (giro + k * 360 / lados) * Math.PI / 180;
            puntos.push([radio * Math.cos(angulo), radio * Math.sin(angulo)]);
        }
        return { d: poligono(puntos), bajo: Math.max(...puntos.map((p) => p[1])) };
    }
    if (forma === "triangulo") {
        return { d: poligono([[0, -1.45 * r], [1.35 * r, 0.95 * r], [-1.35 * r, 0.95 * r]]), bajo: 0.95 * r };
    }
    if (forma === "triangulo-abajo") {
        return { d: poligono([[-1.35 * r, -0.95 * r], [1.35 * r, -0.95 * r], [0, 1.45 * r]]), bajo: 1.45 * r };
    }
    if (forma === "casa") {
        return { d: poligono([[-1.05 * r, 1.05 * r], [-1.05 * r, -0.2 * r], [0, -1.35 * r], [1.05 * r, -0.2 * r],
            [1.05 * r, 1.05 * r]]), bajo: 1.05 * r };
    }
    if (forma === "torre") {
        return { d: poligono([[-0.8 * r, 1.2 * r], [-0.8 * r, -1.35 * r], [0.8 * r, -1.35 * r], [0.8 * r, 1.2 * r]]),
            bajo: 1.2 * r };
    }
    if (forma === "cupula") {
        return { d: "M" + c(-1.2 * r) + " " + c(0.9 * r) + " V0 A" + c(1.2 * r) + " " + c(1.2 * r) + " 0 0 1 "
            + c(1.2 * r) + " 0 V" + c(0.9 * r) + " Z", bajo: 0.9 * r };
    }
    if (forma === "pildora") {
        return { d: "M" + c(-0.6 * r) + " " + c(-0.8 * r) + " H" + c(0.6 * r) + " A" + c(0.8 * r) + " " + c(0.8 * r)
            + " 0 0 1 " + c(0.6 * r) + " " + c(0.8 * r) + " H" + c(-0.6 * r) + " A" + c(0.8 * r) + " " + c(0.8 * r)
            + " 0 0 1 " + c(-0.6 * r) + " " + c(-0.8 * r) + " Z", bajo: 0.8 * r };
    }
    if (forma === "estrella") {
        const puntos = [];
        for (let k = 0; k < 8; k++) {
            const largo = (k % 2 ? 0.6 : 1.45) * r;
            const angulo = (-90 + k * 45) * Math.PI / 180;
            puntos.push([largo * Math.cos(angulo), largo * Math.sin(angulo)]);
        }
        return { d: poligono(puntos), bajo: 1.45 * r };
    }
    if (forma === "cruz") {
        const a = 0.45 * r;
        const b = 1.3 * r;
        return { d: poligono([[-a, -b], [a, -b], [a, -a], [b, -a], [b, a], [a, a], [a, b], [-a, b], [-a, a], [-b, a],
            [-b, -a], [-a, -a]]), bajo: b };
    }
    return { d: "M" + c(-1.1 * r) + " " + c(-1.3 * r) + " H" + c(1.1 * r) + " V0 C" + c(1.1 * r) + " " + c(0.9 * r) + " "
        + c(0.4 * r) + " " + c(1.15 * r) + " 0 " + c(1.35 * r) + " C" + c(-0.4 * r) + " " + c(1.15 * r) + " "
        + c(-1.1 * r) + " " + c(0.9 * r) + " " + c(-1.1 * r) + " 0 Z", bajo: 1.35 * r };
}

// El contorno de la bola de un sitio con su símbolo (sin emblema): la
// capital y el pueblo, un círculo; la fortaleza, un cuadrado; los demás,
// la forma de su tipo (hexágono la ciudad, rombo la ruina…). Como
// _simbolo_de_pin en mundo_mapas.py.
function bolaDeSitio(tipo, r) {
    if (!tipo || tipo === "capital" || tipo === "pueblo") {
        return null;
    }
    if (tipo === "fortaleza") {
        return formaDeEmblema("cuadrado", r * 0.88).d;
    }
    return formaDeEmblema("tipo", r * 0.82, tipo).d;
}

// LA TRAMA DE UNA CLASE DE ZONA (como _trama en mundo_mapas.py): lo de
// dentro de un cuadro de lado s, que se repite encima del color de la zona.
function tramaDeZona(tipo, s) {
    const c = (n) => Math.round(n * 100) / 100;
    const g = c(s * 0.07);
    const oscura = ' stroke="#1b1020" stroke-opacity="0.5" fill="none" stroke-width="' + g + '" stroke-linecap="round"';
    const camino = (d, resto) => '<path d="' + d + '"' + resto + "></path>";
    if (tipo === "vecino") {
        return camino("M0 " + c(s) + " L" + c(s) + " 0 M" + c(-s / 4) + " " + c(s / 4) + " L" + c(s / 4) + " " + c(-s / 4)
            + " M" + c(s * 3 / 4) + " " + c(s * 5 / 4) + " L" + c(s * 5 / 4) + " " + c(s * 3 / 4), oscura);
    }
    if (tipo === "lago" || tipo === "mar") {
        const ola = (x, y) => "M" + c(x) + " " + c(y) + " q" + c(s * 0.12) + " " + c(-s * 0.12) + " " + c(s * 0.24)
            + " 0 t" + c(s * 0.24) + " 0";
        return camino(ola(s * 0.05, s * 0.3) + " " + ola(s * 0.5, s * 0.78),
            ' stroke="#ffffff" stroke-opacity="0.6" fill="none" stroke-width="' + g + '" stroke-linecap="round"');
    }
    if (tipo === "bosque") {
        const arbol = (x, y) => "M" + c(x) + " " + c(y - s * 0.16) + " l" + c(s * 0.11) + " " + c(s * 0.22) + " l"
            + c(-s * 0.22) + " 0 Z M" + c(x) + " " + c(y + s * 0.06) + " l0 " + c(s * 0.08);
        return camino(arbol(s * 0.25, s * 0.3) + " " + arbol(s * 0.75, s * 0.8), ' stroke="#1b1020" stroke-opacity="0.55"'
            + ' fill="#1b1020" fill-opacity="0.3" stroke-width="' + g + '" stroke-linejoin="round"');
    }
    if (tipo === "montana") {
        const monte = (x, y) => "M" + c(x - s * 0.18) + " " + c(y + s * 0.1) + " l" + c(s * 0.18) + " " + c(-s * 0.22)
            + " l" + c(s * 0.18) + " " + c(s * 0.22);
        return camino(monte(s * 0.25, s * 0.3) + " " + monte(s * 0.75, s * 0.8), oscura + ' stroke-linejoin="round"');
    }
    if (tipo === "desierto") {
        return [[0.15, 0.2], [0.55, 0.12], [0.35, 0.5], [0.8, 0.45], [0.12, 0.78], [0.6, 0.85]].map(([x, y]) =>
            '<circle cx="' + c(x * s) + '" cy="' + c(y * s) + '" r="' + c(s * 0.063) + '" fill="#1b1020"'
            + ' fill-opacity="0.45"></circle>').join("");
    }
    if (tipo === "pantano") {
        const mata = (x, y) => "M" + c(x - s * 0.14) + " " + c(y) + " l" + c(s * 0.28) + " 0 M" + c(x) + " " + c(y)
            + " l0 " + c(-s * 0.16) + " M" + c(x - s * 0.07) + " " + c(y) + " l" + c(-s * 0.05) + " " + c(-s * 0.11)
            + " M" + c(x + s * 0.07) + " " + c(y) + " l" + c(s * 0.05) + " " + c(-s * 0.11);
        return camino(mata(s * 0.25, s * 0.35) + " " + mata(s * 0.75, s * 0.85), oscura);
    }
    if (tipo === "valle") {
        const hierba = (x, y) => "M" + c(x - s * 0.07) + " " + c(y - s * 0.1) + " l" + c(s * 0.07) + " " + c(s * 0.1)
            + " l" + c(s * 0.07) + " " + c(-s * 0.1);
        return camino(hierba(s * 0.3, s * 0.3) + " " + hierba(s * 0.8, s * 0.75), oscura);
    }
    return "";
}

function ladoDeTrama() {
    const d = estadoMapa.datos;
    return Math.max(d.width, d.height) / 90;
}

// UN TEXTO SOBRE UNA CURVA: sus puntos suavizados (Catmull-Rom, como
// _curva_suave en mundo_mapas.py), del derecho (de izquierda a derecha,
// que si no el texto sale cabeza abajo). Devuelve el "d" del SVG y unos
// cuantos puntos a lo largo, para pintarlo en el lienzo de la descarga.
function curvaSuaveMapa(puntos) {
    const p = puntos[puntos.length - 1].x < puntos[0].x ? puntos.slice().reverse() : puntos;
    const r = redondoMapa;
    if (p.length === 2) {
        return { d: "M" + r(p[0].x) + " " + r(p[0].y) + " L" + r(p[1].x) + " " + r(p[1].y), muestras: p.slice() };
    }
    let d = "M" + r(p[0].x) + " " + r(p[0].y);
    const muestras = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
        const p0 = p[Math.max(0, i - 1)];
        const p1 = p[i];
        const p2 = p[i + 1];
        const p3 = p[Math.min(p.length - 1, i + 2)];
        const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
        const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
        d += " C" + r(c1.x) + " " + r(c1.y) + " " + r(c2.x) + " " + r(c2.y) + " " + r(p2.x) + " " + r(p2.y);
        for (let k = 1; k <= 12; k++) {
            const f = k / 12;
            const g = 1 - f;
            muestras.push({
                x: g * g * g * p1.x + 3 * g * g * f * c1.x + 3 * g * f * f * c2.x + f * f * f * p2.x,
                y: g * g * g * p1.y + 3 * g * g * f * c1.y + 3 * g * f * f * c2.y + f * f * f * p2.y,
            });
        }
    }
    return { d, muestras };
}

// El punto de en medio de la curva (a lo largo): es el «x, y» del texto,
// el que se ve en el panel y el que se lleva el ratón al arrastrarlo.
function centroDeCurva(puntos) {
    const m = curvaSuaveMapa(puntos).muestras;
    const acumulado = largosMapa(m);
    const medio = puntoALoLargo(m, acumulado, acumulado[acumulado.length - 1] / 2);
    return { x: redondoMapa(medio.x), y: redondoMapa(medio.y) };
}

function tieneCurva(cosa) {
    return !!cosa && Array.isArray(cosa.points) && cosa.points.length >= 2;
}

// LA ROSA DE LOS VIENTOS (como _rosa en mundo_mapas.py): dónde va y sus
// piezas, para pintarla igual en el SVG del editor y en la descarga.
function rosaDeLosVientos(rincon, ancho, alto) {
    const r = Math.max(ancho, alto) / 18;
    const margen = r * 1.45;
    const x = /izquierda$/.test(rincon) ? margen : ancho - margen;
    const y = /^arriba/.test(rincon) ? margen : alto - margen;
    const piezas = [
        { circulo: r * 0.8, relleno: "#1b1020", opacidad: 0.35 },
        { circulo: r * 0.78, raya: "#d8b25a", grueso: r * 0.035 },
        { circulo: r * 0.68, raya: "#f4ecd8", grueso: r * 0.015, opacidad: 0.8 },
    ];
    [[0.58, 0.11, [45, 135, 225, 315]], [1, 0.15, [0, 90, 180, 270]]].forEach(([largo, anchoPunta, giros]) => {
        giros.forEach((giro) => {
            const a = (giro - 90) * Math.PI / 180;
            const punta = [largo * r * Math.cos(a), largo * r * Math.sin(a)];
            const lado = [anchoPunta * r * Math.cos(a + Math.PI / 2), anchoPunta * r * Math.sin(a + Math.PI / 2)];
            [["#f4ecd8", 1], ["#b8892f", -1]].forEach(([color, signo]) => {
                piezas.push({ poligono: [[0, 0], punta, [signo * lado[0], signo * lado[1]]], relleno: color, raya: "#1b1020",
                    grueso: r * 0.012 });
            });
        });
    });
    piezas.push({ circulo: r * 0.07, relleno: "#d8b25a", raya: "#1b1020", grueso: r * 0.012 });
    [["N", 0, 0.34], ["E", 90, 0.24], ["S", 180, 0.24], ["O", 270, 0.24]].forEach(([letra, giro, tam]) => {
        const a = (giro - 90) * Math.PI / 180;
        const lejos = r + r * tam * 0.75;
        piezas.push({ letra, x: lejos * Math.cos(a), y: lejos * Math.sin(a), tam: r * tam });
    });
    return { x, y, piezas };
}

function rosaDelMapa() {
    const d = estadoMapa.datos;
    const rincon = typeof d.compass === "string" ? d.compass : "";
    return /^(arriba|abajo)-(izquierda|derecha)$/.test(rincon) ? rosaDeLosVientos(rincon, d.width, d.height) : null;
}

function pintarRosaMapa() {
    const g = capaMapa("rosa");
    if (!g) {
        return;
    }
    g.textContent = "";
    const rosa = rosaDelMapa();
    if (!rosa) {
        return;
    }
    const dentro = svgMapa("g", { transform: "translate(" + redondoMapa(rosa.x) + " " + redondoMapa(rosa.y) + ")",
        "pointer-events": "none" });
    rosa.piezas.forEach((p) => {
        let el;
        if (p.circulo) {
            el = svgMapa("circle", { r: redondoMapa(p.circulo), fill: p.relleno || "none" });
        } else if (p.poligono) {
            el = svgMapa("path", { d: "M" + p.poligono.map((q) => redondoMapa(q[0]) + " " + redondoMapa(q[1])).join(" L") + " Z",
                fill: p.relleno, "stroke-linejoin": "round" });
        } else {
            el = svgMapa("text", { x: redondoMapa(p.x), y: redondoMapa(p.y), "font-size": redondoMapa(p.tam),
                "text-anchor": "middle", "dominant-baseline": "central", fill: "#f4ecd8", stroke: "#1b1020",
                "stroke-width": redondoMapa(p.tam * 0.18), "paint-order": "stroke", "font-weight": 700,
                "font-family": "Georgia, serif" });
            el.textContent = p.letra;
        }
        if (p.raya) {
            el.setAttribute("stroke", p.raya);
            el.setAttribute("stroke-width", redondoMapa(p.grueso));
        }
        if (p.opacidad) {
            el.setAttribute("opacity", p.opacidad);
        }
        dentro.appendChild(el);
    });
    g.appendChild(dentro);
}

function radioDeEmblema(cosa) {
    const t = TAMANOS_DE_EMBLEMA.find((x) => x[0] === cosa.size) || TAMANOS_DE_EMBLEMA[1];
    return 12 * t[2];
}

// Lo que se coge y se arrastra entero (y se mueve con las flechas).
function esMovible(lista) {
    return lista === "pins" || lista === "labels" || lista === "emblems";
}

function letraDeTexto(cosa) {
    return LETRAS_DE_TEXTO.find((l) => l[0] === cosa.font) || LETRAS_DE_TEXTO[0];
}

// El área de una región (para pintar primero las grandes: ver
// pintarCosasMapa).
function areaMapa(puntos) {
    let doble = 0;
    puntos.forEach((a, i) => {
        const b = puntos[(i + 1) % puntos.length];
        doble += a.x * b.y - b.x * a.y;
    });
    return Math.abs(doble) / 2;
}

function regionesDeGrandeAPequena() {
    const formas = estadoMapa.datos.shapes;
    return formas.map((s, i) => [i, areaMapa(s.points || [])]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
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
    // Por carpetas, como están en wiki/ (el mapamundi, suelto arriba).
    pintarArbolWeb(lista, hay.mapas.map((m) => ({ carpeta: m.archivo.split("/").slice(0, -1), fila: () => {
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
        return li;
    } })), { memoria: "mapas:", unidad: ["mapa", "mapas"] });
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
    const aEscala = $("#mapa-nuevo-escala").checked;
    if (aEscala) {
        avisarEditor("Buscándolo en el mapamundi y ampliándolo" + ($("#mapa-nuevo-ia").checked ? " con IA" : "")
            + "… (puede tardar un poco)");
    }
    const hecho = await pedirEditor("/api/mapa/nuevo", Object.assign({
        pagina: $("#mapa-nuevo-pagina").value.trim(), titulo: $("#mapa-nuevo-titulo").value.trim(),
        escala_comun: aEscala, ia: $("#mapa-nuevo-ia").checked, modelo: $("#mapa-nuevo-modelo").value,
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
    avisarEditor("Hecho: " + hecho.mapa.archivo + ". " + (hecho.aviso ? hecho.aviso + " " : "")
        + "Ya puedes poner sitios y pintar.", /OJO|No lo he puesto/.test(hecho.aviso || ""));
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
    if (!Array.isArray(d.emblems)) {
        d.emblems = [];
    }
    return d;
}

// LOS EMBLEMAS SUELTOS DE ANTES ("emblems") pasan a ser sitios que se ven
// como emblema: un sitio con su tipo (para la leyenda y la lista) y su
// aspecto. El tipo se adivina por el tamaño (grande, capital; mediano,
// ciudad; pequeño, pueblo) y se puede cambiar. Devuelve cuántos.
function pasarEmblemasASitios(d) {
    const viejos = Array.isArray(d.emblems) ? d.emblems : [];
    const tipoPorTamano = { grande: "capital", mediano: "ciudad", pequeno: "pueblo" };
    viejos.forEach((em) => {
        const sitio = Object.assign({}, em);
        sitio.shape = em.shape || "escudo";
        sitio.size = em.size || "mediano";
        if (!sitio.kind) {
            sitio.kind = tipoPorTamano[sitio.size] || "ciudad";
        }
        d.pins.push(sitio);
    });
    d.emblems = [];
    return viejos.length;
}

function ponerMapa(mapa) {
    const d = completarDatosMapa(mapa.datos);
    const pasados = pasarEmblemasASitios(d);
    Object.assign(estadoMapa, {
        archivo: mapa.archivo, datos: d, imagenes: mapa.imagenes || {}, url: mapa.url || "",
        cambiado: false, elegido: null, dibujo: null, capasOcultas: {}, cuantasRegiones: d.shapes.length,
        medida: [], tramoEscala: [], ratonMedida: null, iman: null, ultimoCampo: null, varios: [], curvaPara: null,
        cajaEleccion: null,
    });
    // El tamaño de los textos nuevos, de salida: el de un texto mediano.
    $("#mapa-tamano-nuevo").value = Math.round(Math.max(d.width, d.height) / 70);
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
    if (pasados) {
        estadoMapa.cambiado = true;
        setTimeout(() => avisarEditor(pasados + " emblemas sueltos son ahora sitios que se ven como emblema (en la"
            + " lista, «Sitios»). Su tipo se ha puesto por el tamaño: grande, capital; mediano, ciudad; pequeño,"
            + " pueblo. Cámbialo si no es. Se guarda al guardar."), 0);
    }
}

function pintarDatosGenerales() {
    const d = estadoMapa.datos;
    $("[data-mapa-archivo]").textContent = "En wiki/" + estadoMapa.archivo + " · " + d.width + " × " + d.height + " px";
    $("#mapa-titulo").value = d.title || "";
    $("#mapa-pagina").value = d.page || "";
    $("#mapa-rosa").value = typeof d.compass === "string" ? d.compass : "";
    $("[data-mapa-cambiar-imagen]").hidden = d.layers.length !== 1;
    pintarTituloMapa();
    pintarMundoDelMapa();
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
    estadoMapa.varios = estadoMapa.varios.filter((v) => estadoMapa.datos[v.lista][v.i]);
    if (estadoMapa.varios.length < 2) {
        estadoMapa.varios = [];
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
    // No más lejos que tres veces el mapa entero ni más cerca que un píxel
    // de la imagen en ocho de la pantalla.
    const lienzo = lienzoMapa();
    const proporcion = lienzo.clientHeight ? lienzo.clientWidth / lienzo.clientHeight : 1.6;
    const w = Math.min(Math.max(v.w, 40), Math.max(d.width, d.height * proporcion) * 3);
    const h = w / proporcion;
    // El mapa se puede llevar más allá de sus bordes (queda un reborde
    // oscuro alrededor), pero no tanto que se pierda: siempre se ve por lo
    // menos un trocito (el centro de la vista, como mucho a casi media
    // pantalla de fuera).
    const cx = Math.min(Math.max(v.x + v.w / 2, -w * 0.45), d.width + w * 0.45);
    const cy = Math.min(Math.max(v.y + v.h / 2, -h * 0.45), d.height + h * 0.45);
    estadoMapa.vista = { x: cx - w / 2, y: cy - h / 2, w, h };
    svgDelMapa().setAttribute("viewBox", [estadoMapa.vista.x, estadoMapa.vista.y, w, h].map(redondoMapa).join(" "));
    const entero = Math.max(d.width / lienzo.clientWidth, d.height / lienzo.clientHeight) || 1;
    $("[data-mapa-cuanto]").textContent = Math.round((entero / escalaMapa()) * 100) + "%";
    if (!$("[data-mapa-panel=\"descargar\"]").hidden) {
        pintarMedidaDeDescarga();
    }
    escalarMarcasMapa();
}

// «Verlo entero»: el mapa entero en el hueco que dejan los paneles
// abiertos (si al quitarlos queda muy poco, como en un móvil, en toda la
// pantalla).
function huecoLibreMapa() {
    const r = lienzoMapa().getBoundingClientRect();
    let izquierda = 0;
    let derecha = 0;
    document.querySelectorAll(".mapa-columna").forEach((c) => {
        if (!c.querySelector(".mapa-panel:not([hidden]):not(.es-suelto)")) {
            return;
        }
        const rc = c.getBoundingClientRect();
        if (c.classList.contains("es-izquierda")) {
            izquierda = Math.max(0, rc.right - r.left);
        } else {
            derecha = Math.max(0, r.right - rc.left);
        }
    });
    if (r.width - izquierda - derecha < r.width * 0.4) {
        izquierda = 0;
        derecha = 0;
    }
    // Las pastillas de arriba flotan encima del mapa: lo de debajo no cuenta.
    const pastillas = $("[data-mapa-arriba]").getBoundingClientRect();
    let arriba = Math.max(0, pastillas.bottom - r.top);
    if (r.height - arriba < r.height * 0.5) {
        arriba = 0;
    }
    return { izquierda, derecha, arriba, ancho: r.width, alto: r.height };
}

function ajustarMapa() {
    const d = estadoMapa.datos;
    const hueco = huecoLibreMapa();
    if (!d || !hueco.ancho || !hueco.alto) {
        return;
    }
    const libre = Math.max(hueco.ancho - hueco.izquierda - hueco.derecha - 24, 40);
    // Píxeles de pantalla por píxel del mapa.
    const k = Math.min(libre / d.width, Math.max(hueco.alto - hueco.arriba - 24, 40) / d.height);
    const w = hueco.ancho / k;
    const h = hueco.alto / k;
    const centro = hueco.izquierda + (hueco.ancho - hueco.izquierda - hueco.derecha) / 2;
    const centroY = hueco.arriba + (hueco.alto - hueco.arriba) / 2;
    ponerVistaMapa({ x: d.width / 2 - centro / k, y: d.height / 2 - centroY / k, w, h });
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
    // Las tramas de las clases de zona (olas, árboles…), una vez.
    const defs = svgMapa("defs");
    const s = ladoDeTrama();
    defs.innerHTML = TIPOS_DE_ZONA.map((z) => '<pattern id="ed-trama-' + z[0] + '" patternUnits="userSpaceOnUse" width="'
        + redondoMapa(s) + '" height="' + redondoMapa(s) + '">' + tramaDeZona(z[0], s) + "</pattern>").join("");
    svg.appendChild(defs);
    ["fondo", "regiones", "rayas", "puentes", "textos", "rosa", "emblemas", "sitios", "dibujo", "asas"].forEach((g) => {
        svg.appendChild(svgMapa("g", { "data-capa-mapa": g }));
    });
    pintarFondoMapa();
    pintarCosasMapa();
    pintarRosaMapa();
}

function capaMapa(nombre) {
    return svgDelMapa().querySelector('[data-capa-mapa="' + nombre + '"]');
}

const CAPA_DE_LISTA = { shapes: "regiones", lines: "rayas", labels: "textos", emblems: "emblemas", pins: "sitios" };

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
    // Las regiones, DE LA MÁS GRANDE A LA MÁS PEQUEÑA: en SVG lo último
    // queda encima, así que una zona dentro de otra se ve y se puede
    // pulsar (en el orden del archivo, la grande se la tragaba).
    regionesDeGrandeAPequena().forEach((i) => capaMapa("regiones").appendChild(dibujoDeCosa("shapes", d.shapes[i], i)));
    Object.keys(CAPA_DE_LISTA).filter((l) => l !== "shapes").forEach((lista) => {
        d[lista].forEach((c, i) => capaMapa(CAPA_DE_LISTA[lista]).appendChild(dibujoDeCosa(lista, c, i)));
    });
    pintarPuentesMapa();
    pedirRepasoMapa();
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
    if (lista === "lines") {
        pedirPuentesMapa();
    }
    pedirRepasoMapa();
    pintarAsasMapa();
    escalarMarcasMapa();
}

// ---- LOS PUENTES ----
// Donde un camino o un sendero cruza un río se pinta un puente, solo, sin
// poner nada: no se guarda en el .cmap, se calcula cada vez (aquí, en la
// imagen descargada y en la web, mundo_mapas.py, con la misma cuenta).
// Cuenta como cruce el que pasa de un lado al otro del río: un camino que
// acaba en la orilla, o que la toca y vuelve, no lleva puente. Dos
// cruces muy juntos del mismo camino son un solo puente.
const RAYAS_CON_PUENTE = ["camino", "sendero"];

function puentesDelMapa(lineas) {
    const caja = (puntos) => {
        const xs = puntos.map((p) => p.x);
        const ys = puntos.map((p) => p.y);
        return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
    };
    const seCruzan = (a, b) => a.x1 <= b.x2 && b.x1 <= a.x2 && a.y1 <= b.y2 && b.y1 <= a.y2;
    // De qué lado de la raya c→d cae p (lo que cae encima, del lado de +).
    const lado = (c, d, p) => ((d.x - c.x) * (p.y - c.y) - (d.y - c.y) * (p.x - c.x) >= 0 ? 1 : -1);
    const rios = lineas.filter((l) => l.kind === "rio" && (l.points || []).length >= 2)
        .map((l) => ({ l, caja: caja(l.points), largos: largosMapa(l.points) }));
    const puentes = [];
    lineas.forEach((camino) => {
        const pc = camino.points || [];
        if (!RAYAS_CON_PUENTE.includes(camino.kind) || pc.length < 2 || !rios.length) {
            return;
        }
        const cajaCamino = caja(pc);
        const cruces = [];
        rios.forEach(({ l: rio, caja: cajaRio, largos }) => {
            if (!seCruzan(cajaCamino, cajaRio)) {
                return;
            }
            const pr = rio.points;
            const total = largos[largos.length - 1] || 1;
            for (let i = 1; i < pc.length; i++) {
                const a = pc[i - 1];
                const b = pc[i];
                const tramo = { x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) };
                for (let j = 1; j < pr.length; j++) {
                    const c = pr[j - 1];
                    const d = pr[j];
                    if (!seCruzan(tramo, { x1: Math.min(c.x, d.x), y1: Math.min(c.y, d.y), x2: Math.max(c.x, d.x),
                        y2: Math.max(c.y, d.y) })) {
                        continue;
                    }
                    if (lado(c, d, a) === lado(c, d, b) || lado(a, b, c) === lado(a, b, d)) {
                        continue;
                    }
                    const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
                    const s = den ? ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den : 0;
                    const p = { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s };
                    const enElRio = (largos[j - 1] + Math.hypot(p.x - c.x, p.y - c.y)) / total;
                    cruces.push({ p, giro: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, rio, enElRio,
                        lejos: largosHastaMapa(pc, i - 1) + Math.hypot(p.x - a.x, p.y - a.y) });
                }
            }
        });
        // Los que caen en el mismo punto (un vértice encima del río): si
        // son pares, el camino toca y vuelve; si nones, cruza.
        const sueltos = [];
        cruces.forEach((x) => {
            const igual = sueltos.find((y) => Math.hypot(y.p.x - x.p.x, y.p.y - x.p.y) < 0.01);
            if (igual) {
                igual.veces += 1;
            } else {
                sueltos.push(Object.assign(x, { veces: 1 }));
            }
        });
        const fin = pc[pc.length - 1];
        const ultimos = [];
        sueltos.filter((x) => x.veces % 2 === 1).sort((x, y) => x.lejos - y.lejos).forEach((x) => {
            const pr = x.rio.points;
            const enUnExtremo = [pc[0], fin, pr[0], pr[pr.length - 1]].some((q) => Math.hypot(q.x - x.p.x, q.y - x.p.y) < 0.5);
            const anterior = ultimos[ultimos.length - 1];
            if (enUnExtremo || (anterior && x.lejos - anterior.lejos < 1)) {
                return;
            }
            ultimos.push(x);
        });
        ultimos.forEach((x) => {
            const estiloRio = estiloDeLaRaya(x.rio);
            let ancho = estiloRio.ancho;
            if (x.rio.taper !== false && !(x.rio.dash && x.rio.dash !== "solid")) {
                const k = Math.min(7, Math.floor(x.enElRio * 8));
                const propio = Number(x.rio.width) > 0 ? Number(x.rio.width) : 0;
                ancho = propio ? propio * (0.45 + 1.15 * (k + 0.5) / 8) : 2 + 5.5 * (k + 0.5) / 8;
            }
            puentes.push({ x: x.p.x, y: x.p.y, giro: x.giro, sendero: camino.kind === "sendero",
                color: camino.color || estiloDeLaRaya(camino).color, rio: ancho });
        });
    });
    return puentes;
}

function largosHastaMapa(puntos, n) {
    let s = 0;
    for (let i = 1; i <= n; i++) {
        s += Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].y - puntos[i - 1].y);
    }
    return s;
}

// La forma del puente, en píxeles de pantalla y a lo largo del camino (x):
// el tablero del color del camino, tapando el río, y los pretiles oscuros
// a los lados, abiertos en las puntas.
function formaDePuente(puente) {
    const largo = Math.max(10, puente.rio / 2 + 6);
    const ancho = puente.sendero ? 4 : 5;
    const abre = 3.5;
    return {
        largo, ancho,
        pretiles: "M" + (-largo - abre) + " " + (-ancho - abre) + "L" + (-largo) + " " + (-ancho) + "L" + largo + " "
            + (-ancho) + "L" + (largo + abre) + " " + (-ancho - abre) + "M" + (-largo - abre) + " " + (ancho + abre) + "L"
            + (-largo) + " " + ancho + "L" + largo + " " + ancho + "L" + (largo + abre) + " " + (ancho + abre),
    };
}

function pintarPuentesMapa() {
    estadoMapa.puentesPedidos = false;
    const g = capaMapa("puentes");
    if (!g) {
        return;
    }
    g.textContent = "";
    const todos = puentesDelMapa(estadoMapa.datos.lines);
    estadoMapa.puentes = todos;
    pintarCuentaDePuentes();
    todos.forEach((puente) => {
        const forma = formaDePuente(puente);
        const marca = svgMapa("g", { class: "mapa-ed-marca mapa-ed-puente", "data-x": redondoMapa(puente.x),
            "data-y": redondoMapa(puente.y), "data-giro": redondoMapa(puente.giro) });
        marca.appendChild(svgMapa("rect", { x: -forma.largo, y: -forma.ancho, width: 2 * forma.largo,
            height: 2 * forma.ancho, fill: puente.color }));
        marca.appendChild(svgMapa("path", { d: forma.pretiles, fill: "none", stroke: "#1b1020", "stroke-width": 2.5,
            "stroke-linecap": "round", "stroke-linejoin": "round" }));
        g.appendChild(marca);
    });
}

// LOS SITIOS «PUENTE» QUE SOBRAN: los puestos a mano antes de que los
// puentes salieran solos. Sin nombre y encima de un puente automático (a
// menos de un 1,25% del lado largo del mapa) no dicen nada más; con
// nombre se quedan (un puente con historia sale en la lista y en la web).
function pinesDePuenteQueSobran() {
    const d = estadoMapa.datos;
    const cerca = Math.max(d.width, d.height) / 80;
    const puentes = estadoMapa.puentes || [];
    const salen = [];
    d.pins.forEach((p, i) => {
        if (p.kind === "puente" && !(p.label || "").trim() && !p.targetPage
            && puentes.some((q) => Math.hypot(q.x - p.x, q.y - p.y) <= cerca)) {
            salen.push(i);
        }
    });
    return salen;
}

function pintarCuentaDePuentes() {
    const n = (estadoMapa.puentes || []).length;
    $("[data-mapa-puentes-cuantos]").textContent = "Los puentes salen solos donde un camino o un sendero cruza un río: "
        + (n ? (n === 1 ? "hay 1" : "hay " + n) + " en este mapa." : "en este mapa, ninguno todavía.");
    const sobran = pinesDePuenteQueSobran().length;
    const boton = $("[data-mapa-quitar-pines-puente]");
    boton.hidden = !sobran;
    boton.textContent = "Quitar " + (sobran === 1 ? "el sitio «Puente» sin nombre que ya pinta uno solo"
        : "los " + sobran + " sitios «Puente» sin nombre que ya pintan solos");
}

function quitarPinesDePuente() {
    const salen = pinesDePuenteQueSobran();
    if (!salen.length) {
        return;
    }
    apuntarPaso();
    salen.reverse().forEach((i) => estadoMapa.datos.pins.splice(i, 1));
    estadoMapa.elegido = null;
    estadoMapa.varios = [];
    pintarCosasMapa();
    pintarPropiedadesMapa();
    avisarEditor("Quitados " + salen.length + (salen.length === 1 ? " sitio «Puente»." : " sitios «Puente».")
        + " Se guarda al guardar; Ctrl+Z los trae de vuelta.");
}

// ---- EL REPASO ----
// Lo que se ha quedado suelto, en el panel «Repaso»: sitios y textos sin
// nombre, caminos que acaban casi en un sitio o casi en otro camino (y no
// se tocan: la ruta de la web no pasaría por ahí), regiones sin página y
// enlaces a páginas que no existen. Cada aviso lleva a lo suyo (lo elige
// y lo centra) y los caminos que casi llegan se arreglan con un botón.
// Se rehace al abrir el panel y cada vez que cambia algo, si está abierto.
const RAYAS_QUE_LLEGAN = ["camino", "sendero"];

function paginasDeLaWiki() {
    // (estadoEditor es de editor.js: un const, no cuelga de window)
    const datos = typeof estadoEditor !== "undefined" && estadoEditor.datos;
    const lista = (datos && datos.paginas) || [];
    return new Set(lista.map((n) => String(n).trim().toLowerCase()));
}

// El punto más cercano a p de una raya: { x, y, distancia }.
function puntoMasCercanoDeRaya(puntos, p) {
    let mejor = null;
    for (let i = 1; i < puntos.length; i++) {
        const a = puntos[i - 1];
        const b = puntos[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const largo = dx * dx + dy * dy;
        const s = largo ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / largo)) : 0;
        const q = { x: a.x + dx * s, y: a.y + dy * s };
        const distancia = Math.hypot(q.x - p.x, q.y - p.y);
        if (!mejor || distancia < mejor.distancia) {
            mejor = Object.assign(q, { distancia });
        }
    }
    return mejor;
}

// «cerca de Pozovalor»: el sitio con nombre más cercano, para saber de
// cuál se habla sin mirar el mapa.
function cercaDeMapa(p) {
    let mejor = null;
    estadoMapa.datos.pins.forEach((s) => {
        if (!(s.label || "").trim()) {
            return;
        }
        const distancia = Math.hypot(s.x - p.x, s.y - p.y);
        if (!mejor || distancia < mejor.distancia) {
            mejor = { nombre: s.label.trim(), distancia };
        }
    });
    return mejor ? "cerca de " + mejor.nombre : "";
}

function sitioDeAviso(lista, cosa) {
    if (esMovible(lista)) {
        return { x: cosa.x, y: cosa.y };
    }
    const puntos = cosa.points || [];
    if (lista === "shapes" && puntos.length >= 3) {
        return centroDeRegion(puntos);
    }
    return puntos[Math.floor(puntos.length / 2)] || { x: 0, y: 0 };
}

function repasoDelMapa() {
    const d = estadoMapa.datos;
    const paginas = paginasDeLaWiki();
    const hayPaginas = paginas.size > 0;
    const cerca = Math.max(d.width, d.height) / 60;
    // Lo que la web ya cuenta como el mismo punto (junto en
    // _red_de_caminos, mundo_mapas.py): tan cerca no se nota.
    const tocan = Math.max(d.width, d.height) / 400;
    const grupos = [];
    const grupo = (titulo, ayuda) => {
        const g = { titulo, ayuda, avisos: [] };
        grupos.push(g);
        return g;
    };
    const conNombre = (lista, cosa, i) => {
        const { nombre, que } = nombreDeCosa(lista, cosa);
        const donde = cercaDeMapa(sitioDeAviso(lista, cosa));
        return { lista, i, texto: (nombre ? "«" + nombre + "», " + que : que[0].toUpperCase() + que.slice(1))
            + (donde ? ", " + donde : "") };
    };

    const sinNombre = grupo("Sitios sin nombre", "No salen en la lista de la web ni en el globo al pasar por encima.");
    d.pins.forEach((p, i) => {
        if (!(p.label || "").trim() && !p.targetPage && p.kind !== "puente") {
            sinNombre.avisos.push(conNombre("pins", p, i));
        }
    });
    const textos = grupo("Textos vacíos", "Un texto sin letras no se ve: escríbelo o bórralo.");
    d.labels.forEach((x, i) => {
        if (!(x.label || "").trim()) {
            textos.avisos.push(conNombre("labels", x, i));
        }
    });

    const casi = grupo("Caminos que casi llegan", "Acaban muy cerca de un sitio o de otro camino pero sin tocarlo: la"
        + " ruta de la web no pasaría por ahí. «Llevarlo» pone la punta justo encima.");
    d.lines.forEach((l, i) => {
        const puntos = l.points || [];
        if (!RAYAS_QUE_LLEGAN.includes(l.kind || "camino") || puntos.length < 2) {
            return;
        }
        [0, puntos.length - 1].forEach((n) => {
            const punta = puntos[n];
            // El camino más cercano a esa punta: si ya lo toca, está unido
            // (un cruce) y no hay nada que avisar.
            let otro = null;
            d.lines.forEach((m, j) => {
                if (j === i || !RAYAS_QUE_LLEGAN.includes(m.kind || "camino") || (m.points || []).length < 2) {
                    return;
                }
                const q = puntoMasCercanoDeRaya(m.points, punta);
                if (q && (!otro || q.distancia < otro.q.distancia)) {
                    otro = { m, q };
                }
            });
            if (otro && otro.q.distancia <= tocan) {
                return;
            }
            // El sitio más cercano a esa punta.
            let sitio = null;
            // (Los sitios «Puente» no: ahora los puentes salen solos, y
            // donde se juntan dos caminos se mira abajo, camino con camino.)
            d.pins.forEach((s) => {
                if (s.kind === "puente") {
                    return;
                }
                const distancia = Math.hypot(s.x - punta.x, s.y - punta.y);
                if (!sitio || distancia < sitio.distancia) {
                    sitio = { s, distancia };
                }
            });
            if (sitio && sitio.distancia <= tocan) {
                return;
            }
            const { nombre, que } = nombreDeCosa("lines", l);
            const cual = (nombre ? "«" + nombre + "», " + que : que[0].toUpperCase() + que.slice(1));
            const extremo = n === 0 ? "empieza" : "acaba";
            if (sitio && sitio.distancia <= cerca) {
                const destino = (sitio.s.label || "").trim() || nombreDeCosa("pins", sitio.s).que;
                casi.avisos.push({ lista: "lines", i, texto: cual + ": " + extremo + " a " + Math.round(sitio.distancia)
                    + " px de " + destino + ", sin tocarlo.",
                arreglo: { texto: "Llevarlo hasta " + destino, n, a: { x: sitio.s.x, y: sitio.s.y } } });
                return;
            }
            if (otro && otro.q.distancia > tocan && otro.q.distancia <= cerca / 2) {
                const deOtro = nombreDeCosa("lines", otro.m);
                const aQuien = deOtro.nombre ? "«" + deOtro.nombre + "»" : "otro " + deOtro.que;
                casi.avisos.push({ lista: "lines", i, texto: cual + (cercaDeMapa(punta) ? " (" + cercaDeMapa(punta) + ")" : "")
                    + ": " + extremo + " a " + Math.round(otro.q.distancia) + " px de " + aQuien + ", sin juntarse.",
                arreglo: { texto: "Juntarlo con " + aQuien, n, a: { x: redondoMapa(otro.q.x), y: redondoMapa(otro.q.y) } } });
            }
        });
    });

    const regiones = grupo("Regiones sin página", hayPaginas
        ? "Ni llevan a una página («Lleva a la página») ni se llaman como ninguna de la wiki. Los bosques, lagos y"
            + " demás zonas no siempre la necesitan." : "");
    d.shapes.forEach((r, i) => {
        if (r.targetPage) {
            return;
        }
        const nombre = (r.label || "").trim();
        if (!nombre || (hayPaginas && !paginas.has(nombre.toLowerCase()))) {
            const aviso = conNombre("shapes", r, i);
            if (nombre) {
                aviso.texto += " (no hay ninguna página «" + nombre + "»)";
            }
            regiones.avisos.push(aviso);
        }
    });
    const rotos = grupo("Enlaces a páginas que no existen", "Llevan a una página que todavía no está en la wiki: en la web"
        + " salen como enlace pendiente. Escríbela o cambia «Lleva a la página».");
    if (hayPaginas) {
        ["pins", "lines", "shapes"].forEach((lista) => {
            d[lista].forEach((c, i) => {
                if (c.targetPage && !paginas.has(String(c.targetPage).trim().toLowerCase())) {
                    const aviso = conNombre(lista, c, i);
                    aviso.texto += " → «" + c.targetPage + "»";
                    rotos.avisos.push(aviso);
                }
            });
        });
    }
    return grupos.filter((g) => g.avisos.length);
}

function pintarRepasoMapa() {
    estadoMapa.repasoPedido = false;
    const caja = $("[data-mapa-repaso]");
    if (!estadoMapa.datos || $("[data-mapa-panel=\"repaso\"]").hidden) {
        return;
    }
    const grupos = repasoDelMapa();
    const total = grupos.reduce((s, g) => s + g.avisos.length, 0);
    $("[data-mapa-repaso-resumen]").textContent = total
        ? (total === 1 ? "Hay 1 cosa suelta." : "Hay " + total + " cosas sueltas.") + " Pulsa una para ir a ella."
        : "Nada suelto: todo tiene nombre, los caminos llegan y las regiones tienen página.";
    // Lo que estaba plegado se queda plegado al rehacerlo.
    const plegados = new Set([...caja.querySelectorAll("details:not([open])")].map((x) => x.getAttribute("data-grupo")));
    caja.textContent = "";
    grupos.forEach((g) => {
        const det = document.createElement("details");
        det.className = "mapa-repaso-grupo";
        det.setAttribute("data-grupo", g.titulo);
        det.open = !plegados.has(g.titulo);
        const sum = document.createElement("summary");
        sum.textContent = g.titulo + " (" + g.avisos.length + ")";
        det.appendChild(sum);
        if (g.ayuda) {
            const ayuda = document.createElement("p");
            ayuda.className = "ayuda";
            ayuda.textContent = g.ayuda;
            det.appendChild(ayuda);
        }
        const ul = document.createElement("ul");
        ul.className = "mapa-repaso-lista";
        g.avisos.forEach((a) => {
            const li = document.createElement("li");
            const ir = document.createElement("button");
            ir.type = "button";
            ir.className = "mapa-repaso-ir";
            ir.textContent = a.texto;
            ir.addEventListener("click", () => {
                irACosa(a.lista, a.i);
                elegirCosa(a.lista, a.i);
            });
            li.appendChild(ir);
            if (a.arreglo) {
                const arreglar = document.createElement("button");
                arreglar.type = "button";
                arreglar.textContent = a.arreglo.texto;
                arreglar.addEventListener("click", () => {
                    apuntarPaso();
                    estadoMapa.datos.lines[a.i].points[a.arreglo.n] = { x: a.arreglo.a.x, y: a.arreglo.a.y };
                    repintarCosa("lines", a.i);
                    avisarEditor("Hecho: " + a.arreglo.texto.toLowerCase() + ". (Ctrl+Z lo deshace.)");
                    pintarRepasoMapa();
                    const primero = $("[data-mapa-repaso] button");
                    (primero || $("[data-mapa-pestana=\"repaso\"]")).focus();
                });
                li.appendChild(arreglar);
            }
            ul.appendChild(li);
        });
        det.appendChild(ul);
        caja.appendChild(det);
    });
}

function pedirRepasoMapa() {
    if (estadoMapa.repasoPedido || $("[data-mapa-panel=\"repaso\"]").hidden) {
        return;
    }
    estadoMapa.repasoPedido = true;
    setTimeout(pintarRepasoMapa, 300);
}

// Mientras se arrastra un punto, los puentes se rehacen una vez por
// fotograma como mucho.
function pedirPuentesMapa() {
    if (estadoMapa.puentesPedidos) {
        return;
    }
    estadoMapa.puentesPedidos = true;
    requestAnimationFrame(() => {
        pintarPuentesMapa();
        escalarMarcasMapa();
    });
}

function puentesEnLienzo(ctx, d, k) {
    puentesDelMapa(d.lines).forEach((puente) => {
        const forma = formaDePuente(puente);
        ctx.save();
        ctx.translate(puente.x, puente.y);
        ctx.rotate(puente.giro * Math.PI / 180);
        ctx.scale(k, k);
        ctx.fillStyle = puente.color;
        ctx.fillRect(-forma.largo, -forma.ancho, 2 * forma.largo, 2 * forma.ancho);
        ctx.strokeStyle = "#1b1020";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.setLineDash([]);
        ctx.stroke(new Path2D(forma.pretiles));
        ctx.restore();
    });
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
function tramosDeRio(puntos, cuantos, ancho) {
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
            grueso: ancho ? ancho * (0.45 + 1.15 * (k + 0.5) / n) : 2 + 5.5 * (k + 0.5) / n });
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
    const elegido = estaElegida(lista, i);
    const g = svgMapa("g", { "data-lista": lista, "data-i": i, class: "mapa-ed-cosa" + (elegido ? " es-elegida" : "") });
    if (lista === "shapes") {
        // Con su clase de zona: su color si no trae, lo tapada que va, la
        // raya a trazos (vecinos y provincias) y su trama encima.
        const zona = tipoDeZonaMapa(cosa.kind);
        const color = cosa.color || (zona ? zona[2] : "#f5ce6c");
        const d = trazoMapa(cosa.points || [], true);
        g.appendChild(svgMapa("path", {
            d, fill: color,
            "fill-opacity": zona ? Math.max(0.12, OPACIDAD_DE_ZONA[zona[0]]) : (cosa.label || cosa.targetPage ? 0.35 : 0.18),
            stroke: elegido ? "#ffffff" : color, "stroke-width": elegido ? 4 : 2, "vector-effect": "non-scaling-stroke",
            "stroke-dasharray": zona && (zona[0] === "vecino" || zona[0] === "provincia") ? "12 7" : "none",
            class: "mapa-ed-region",
        }));
        if (zona && zona[0] !== "provincia") {
            g.appendChild(svgMapa("path", { d, fill: "url(#ed-trama-" + zona[0] + ")", "pointer-events": "none" }));
        }
    } else if (lista === "lines") {
        dibujarRayaSvg(g, cosa, elegido);
    } else if (lista === "emblems" || (lista === "pins" && cosa.shape)) {
        const r = radioDeEmblema(cosa);
        const forma = formaDeEmblema(cosa.shape, r, cosa.kind);
        const marca = svgMapa("g", { class: "mapa-ed-marca mapa-ed-emblema", "data-x": cosa.x, "data-y": cosa.y });
        const recorte = "ed-emblema-" + i;
        const clip = svgMapa("clipPath", { id: recorte });
        clip.appendChild(svgMapa("path", { d: forma.d }));
        marca.appendChild(clip);
        const tipoFondo = tipoDeSitioMapa(cosa.kind);
        marca.appendChild(svgMapa("path", { d: forma.d, fill: cosa.color || (tipoFondo ? tipoFondo[3] : "#8e1b3b") }));
        const url = cosa.image ? estadoMapa.imagenes[cosa.image] : "";
        const tipo = tipoDeSitioMapa(cosa.kind);
        if (url) {
            const img = svgMapa("image", { x: -1.4 * r, y: -1.4 * r, width: 2.8 * r, height: 2.8 * r,
                preserveAspectRatio: "xMidYMid slice", "clip-path": "url(#" + recorte + ")" });
            img.setAttribute("href", url);
            marca.appendChild(img);
        } else if (tipo) {
            // Sin imagen, el símbolo de su tipo dentro.
            const letra = svgMapa("text", { class: "mapa-ed-letra", "text-anchor": "middle", "dominant-baseline": "central",
                "font-size": redondoMapa(r * 1.05) });
            letra.textContent = tipo[2] + "\uFE0E";
            marca.appendChild(letra);
        }
        marca.appendChild(svgMapa("path", { d: forma.d, fill: "none", stroke: elegido ? "#ffffff" : "#d8b25a",
            "stroke-width": elegido ? 4 : 2.5, "stroke-linejoin": "round" }));
        if (cosa.label) {
            const nombre = svgMapa("text", { class: "mapa-ed-nombre", x: 0, y: forma.bajo + 5, "text-anchor": "middle",
                "dominant-baseline": "hanging" });
            nombre.textContent = cosa.label;
            marca.appendChild(nombre);
        }
        g.appendChild(marca);
    } else if (lista === "labels") {
        const tam = tamanoDeTexto(cosa);
        const curva = tieneCurva(cosa) ? curvaSuaveMapa(cosa.points) : null;
        const texto = svgMapa("text", {
            class: "mapa-ed-texto" + (cosa.label ? "" : " es-vacio"), "font-size": redondoMapa(tam),
            "stroke-width": redondoMapa(tam * 0.16), "dominant-baseline": "central",
            fill: cosa.color || "#f4ecd8", stroke: elegido ? "#f5ce6c" : "#1b1020",
        });
        if (!curva) {
            texto.setAttribute("x", cosa.x);
            texto.setAttribute("y", cosa.y);
            texto.setAttribute("text-anchor", "middle");
        }
        if (cosa.angle && !curva) {
            texto.setAttribute("transform", "rotate(" + cosa.angle + " " + cosa.x + " " + cosa.y + ")");
        }
        // En style y no en atributos: la hoja de estilos (.mapa-ed-texto)
        // ganaría a los atributos.
        const letra = letraDeTexto(cosa);
        texto.style.fontFamily = letra[2];
        texto.style.fontWeight = String(letra[3]);
        texto.style.fontStyle = cosa.italic === false ? "normal" : "italic";
        if (curva) {
            // SOBRE SU CURVA: la curva (a la vista solo si está elegido) y
            // el texto a lo largo de ella, centrado.
            const id = "ed-curva-" + i;
            g.appendChild(svgMapa("path", { id, d: curva.d, fill: "none", stroke: elegido ? "#f5ce6c" : "none",
                "stroke-width": 2, "stroke-dasharray": "6 5", "vector-effect": "non-scaling-stroke",
                "pointer-events": "none" }));
            const enCurva = svgMapa("textPath", { href: "#" + id, startOffset: "50%", "text-anchor": "middle" });
            enCurva.textContent = cosa.label || "(escribe el texto)";
            texto.appendChild(enCurva);
        } else {
            texto.textContent = cosa.label || "(escribe el texto)";
        }
        g.appendChild(texto);
    } else {
        const tipo = tipoDeSitioMapa(cosa.kind);
        const marca = svgMapa("g", { class: "mapa-ed-marca", "data-x": cosa.x, "data-y": cosa.y });
        const fondo = cosa.color || (tipo ? tipo[3] : "#e74c3c");
        const bola = bolaDeSitio(cosa.kind, 12);
        if (bola) {
            marca.appendChild(svgMapa("path", {
                d: bola, fill: fondo, stroke: elegido ? "#ffffff" : "#1b1020", "stroke-width": elegido ? 4 : 2.5,
                "stroke-linejoin": "round", "stroke-dasharray": cosa.kind === "ruina" ? "4 3" : "none",
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
    const estilo = estiloDeLaRaya(cosa);
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
    if (cosa.kind === "rio" && cosa.taper !== false && puntos.length >= 2 && !(cosa.dash && cosa.dash !== "solid")) {
        const tramos = tramosDeRio(puntos, 8, Number(cosa.width) > 0 ? Number(cosa.width) : 0);
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
    if (!el || estadoMapa.herramienta !== "elegir") {
        return;
    }
    const cosa = estadoMapa.datos[el.lista][el.i];
    // Los sitios y los textos se arrastran enteros; un texto sobre una
    // curva, además, por los puntos de su curva.
    if (esMovible(el.lista) && !(el.lista === "labels" && tieneCurva(cosa))) {
        return;
    }
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
        que = tieneCurva(cosa) ? "texto sobre una curva" : "texto";
    } else if (lista === "emblems") {
        que = "emblema";
    } else {
        const zona = tipoDeZonaMapa(cosa.kind);
        que = zona ? zona[1].toLowerCase() : "región";
    }
    return { nombre, que };
}

// LO QUE HAY EN EL MAPA, POR CARPETAS como lo demás del editor
// (pintarArbolWeb, en escribir.js): Sitios (y dentro, cada tipo: Capital,
// Ciudad…), Emblemas, Caminos, Ríos, Otras rayas, Textos y Regiones (cada
// tipo de zona). Se despliegan y se cierran, y se acuerda; la carpeta de lo
// elegido sale abierta.
function pintarListaDeCosas() {
    const caja = $("[data-mapa-cosas]");
    caja.textContent = "";
    const d = estadoMapa.datos;
    const esCamino = (c) => c.kind === "camino" || c.kind === "sendero" || !c.kind;
    const esRio = (c) => c.kind === "rio";
    const carpetaDe = (lista, cosa) => {
        if (lista === "pins") {
            const tipo = tipoDeSitioMapa(cosa.kind);
            return ["Sitios", tipo ? tipo[1] : "Otros"];
        }
        if (lista === "shapes") {
            const zona = tipoDeZonaMapa(cosa.kind);
            return ["Regiones", zona ? zona[1] : "Sin tipo"];
        }
        if (lista === "lines") {
            return [esCamino(cosa) ? "Caminos" : esRio(cosa) ? "Ríos" : "Otras rayas"];
        }
        return [lista === "emblems" ? "Emblemas" : "Textos"];
    };
    const orden = ["pins", "emblems", "lines", "labels", "shapes"];
    const sinNombre = d.shapes.filter((c) => !c.label && !c.targetPage).length;
    const cosas = [];
    let abrir = [];
    const elegido = estadoMapa.elegido;
    orden.forEach((lista) => {
        // Las rayas, primero los caminos, luego los ríos y las demás.
        const indices = d[lista].map((c, i) => i);
        if (lista === "lines") {
            const puesto = (c) => (esCamino(c) ? 0 : esRio(c) ? 1 : 2);
            indices.sort((a, b) => puesto(d.lines[a]) - puesto(d.lines[b]) || a - b);
        }
        // Los sitios y las regiones, por su tipo, en el orden de la lista
        // de tipos (capital, ciudad, pueblo…), y los sin tipo al final.
        const tipos = lista === "pins" ? TIPOS_DE_SITIO : lista === "shapes" ? TIPOS_DE_ZONA : null;
        if (tipos) {
            const puesto = (c) => {
                const k = tipos.findIndex((t) => t[0] === c.kind);
                return k === -1 ? tipos.length : k;
            };
            indices.sort((a, b) => puesto(d[lista][a]) - puesto(d[lista][b]) || a - b);
        }
        indices.forEach((i) => {
            const cosa = d[lista][i];
            const { nombre, que } = nombreDeCosa(lista, cosa);
            // Las regiones sin nombre del mapamundi son el dibujo (costas,
            // fronteras): se cuentan aparte, no una a una.
            if (!nombre && lista === "shapes" && sinNombre > 12) {
                return;
            }
            const carpeta = carpetaDe(lista, cosa);
            if (elegido && elegido.lista === lista && elegido.i === i) {
                abrir = carpeta.map((c, k) => carpeta.slice(0, k + 1).join("/") + "/");
            }
            cosas.push({ carpeta, fila: () => {
                const li = document.createElement("li");
                const boton = crearEditor("button", "mapa-cosa");
                boton.type = "button";
                boton.setAttribute("aria-pressed", estaElegida(lista, i) ? "true" : "false");
                const tipo = lista === "pins" ? tipoDeSitioMapa(cosa.kind) : null;
                if (tipo) {
                    boton.appendChild(crearEditor("span", "mapa-cosa-marca es-" + tipo[0], tipo[2] + "︎"))
                        .setAttribute("aria-hidden", "true");
                }
                // Un sitio sin nombre se llama como su tipo («Puente»).
                const sinEl = tipo ? tipo[1] : "(sin nombre)";
                boton.appendChild(crearEditor("span", "mapa-cosa-nombre", nombre || sinEl));
                boton.appendChild(crearEditor("span", "mapa-cosa-que", que));
                // Con Mayús (o Ctrl), se añade a lo elegido o se quita.
                boton.addEventListener("click", (e) => {
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                        alternarEleccion(lista, i);
                        return;
                    }
                    elegirCosa(lista, i);
                    irACosa(lista, i);
                });
                li.appendChild(boton);
                return li;
            } });
        });
    });
    if (sinNombre > 12) {
        cosas.push({ carpeta: ["Regiones"], fila: () => crearEditor("li", "ayuda", "Y " + sinNombre
            + " sin nombre (el dibujo: costas y fronteras). Se eligen pulsándolas en el mapa.") });
    }
    if (!cosas.length) {
        caja.appendChild(crearEditor("p", "ayuda", "Aún nada. Elige «Poner un sitio» y pulsa en el mapa."));
        return;
    }
    const ul = crearEditor("ul", "mapa-cosas");
    caja.appendChild(ul);
    pintarArbolWeb(ul, cosas, { memoria: "mapa-cosas:", cerradasDeSalida: true, abrir });
}

function irACosa(lista, i) {
    const cosa = estadoMapa.datos[lista][i];
    const puntos = esMovible(lista) ? [cosa] : cosa.points || [];
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
// Una cosa (estadoMapa.elegido) o VARIAS (estadoMapa.varios, de dos en
// adelante; entonces elegido es null): con Mayús+clic se añaden y se
// quitan, y con Mayús y arrastrando en un hueco se eligen las que queden
// dentro del recuadro. Varias se mueven, se borran, se copian y se cambian
// a la vez.
function elegirCosa(lista, i) {
    estadoMapa.elegido = lista ? { lista, i } : null;
    estadoMapa.varios = [];
    estadoMapa.ultimoCampo = null;
    pintarCosasMapa();
    pintarPropiedadesMapa();
}

function estaElegida(lista, i) {
    const el = estadoMapa.elegido;
    return (!!el && el.lista === lista && el.i === i) || estadoMapa.varios.some((v) => v.lista === lista && v.i === i);
}

function listaDeElegidos() {
    if (estadoMapa.varios.length) {
        return estadoMapa.varios.slice();
    }
    return estadoMapa.elegido ? [estadoMapa.elegido] : [];
}

function elegirVarios(lista) {
    if (lista.length < 2) {
        elegirCosa(lista.length ? lista[0].lista : null, lista.length ? lista[0].i : 0);
        return;
    }
    estadoMapa.elegido = null;
    estadoMapa.varios = lista;
    estadoMapa.ultimoCampo = null;
    pintarCosasMapa();
    pintarPropiedadesMapa();
}

function alternarEleccion(lista, i) {
    const ahora = listaDeElegidos();
    const n = ahora.findIndex((v) => v.lista === lista && v.i === i);
    if (n >= 0) {
        ahora.splice(n, 1);
    } else {
        ahora.push({ lista, i });
    }
    elegirVarios(ahora);
}

// Las coordenadas de algo (para moverlo y copiarlo): su x, y y sus puntos.
function sitioDeCosa(cosa) {
    return { x: cosa.x, y: cosa.y, puntos: Array.isArray(cosa.points) ? cosa.points.map((p) => ({ x: p.x, y: p.y })) : null };
}

// Mueve algo (dx, dy) desde donde estaba (sitioDeCosa).
function moverCosaDesde(cosa, desde, dx, dy) {
    if (typeof desde.x === "number" && typeof desde.y === "number") {
        Object.assign(cosa, dentroDelMapa({ x: desde.x + dx, y: desde.y + dy }));
    }
    if (desde.puntos) {
        cosa.points = desde.puntos.map((p) => dentroDelMapa({ x: p.x + dx, y: p.y + dy }));
    }
}

function moverElegidos(dx, dy, clave) {
    const todos = listaDeElegidos();
    if (!todos.length) {
        return;
    }
    apuntarPaso(clave);
    todos.forEach(({ lista, i }) => {
        const cosa = estadoMapa.datos[lista][i];
        moverCosaDesde(cosa, sitioDeCosa(cosa), dx, dy);
    });
    pintarCosasMapa();
    pintarPropiedadesMapa();
}

function borrarElegidos() {
    const todos = listaDeElegidos();
    if (todos.length < 2) {
        borrarElegido();
        return;
    }
    apuntarPaso();
    // De atrás adelante en cada lista: así no se mueven los índices de las
    // que quedan por borrar.
    todos.sort((a, b) => (a.lista === b.lista ? b.i - a.i : a.lista < b.lista ? -1 : 1))
        .forEach(({ lista, i }) => estadoMapa.datos[lista].splice(i, 1));
    estadoMapa.varios = [];
    estadoMapa.elegido = null;
    pintarCosasMapa();
    pintarPropiedadesMapa();
    avisarEditor("Borradas " + todos.length + " cosas. (Ctrl+Z las trae de vuelta.)");
    lienzoMapa().focus({ preventScroll: true });
}

// COPIAR, PEGAR Y DUPLICAR (Ctrl+C, Ctrl+V, Ctrl+D): lo pegado sale un poco
// más abajo a la derecha, con identificadores nuevos, y queda elegido.
function copiarElegidos() {
    const todos = listaDeElegidos();
    if (!todos.length) {
        return false;
    }
    estadoMapa.portapapeles = todos.map(({ lista, i }) => ({ lista, cosa: JSON.parse(JSON.stringify(estadoMapa.datos[lista][i])) }));
    avisarEditor(todos.length === 1 ? "Copiado. Ctrl+V lo pega." : "Copiadas " + todos.length + " cosas. Ctrl+V las pega.");
    return true;
}

function pegarMapa() {
    const copias = estadoMapa.portapapeles;
    if (!copias.length || !estadoMapa.datos) {
        return;
    }
    apuntarPaso();
    const corrido = 24 * escalaMapa();
    const nuevas = copias.map(({ lista, cosa }) => {
        const copia = JSON.parse(JSON.stringify(cosa));
        copia.id = idNuevoMapa();
        moverCosaDesde(copia, sitioDeCosa(copia), corrido, corrido);
        estadoMapa.datos[lista].push(copia);
        return { lista, i: estadoMapa.datos[lista].length - 1 };
    });
    // La próxima vez, un poco más allá (pegar dos veces no las apila).
    estadoMapa.portapapeles = nuevas.map(({ lista, i }) => ({ lista, cosa: JSON.parse(JSON.stringify(estadoMapa.datos[lista][i])) }));
    elegirVarios(nuevas);
    avisarEditor(nuevas.length === 1 ? "Pegado (elegido, para moverlo)." : "Pegadas " + nuevas.length
        + " cosas (elegidas, para moverlas juntas).");
}

function duplicarElegidos() {
    const guardado = estadoMapa.portapapeles;
    if (copiarElegidos()) {
        pegarMapa();
    }
    estadoMapa.portapapeles = guardado.length ? guardado : estadoMapa.portapapeles;
}

// Lo que está dentro de un recuadro (en coordenadas del mapa): los sitios y
// los textos por su punto; las rayas y las regiones, si caben enteras.
function cosasEnElRecuadro(c) {
    const x1 = Math.min(c.x1, c.x2);
    const x2 = Math.max(c.x1, c.x2);
    const y1 = Math.min(c.y1, c.y2);
    const y2 = Math.max(c.y1, c.y2);
    const dentro = (p) => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2;
    const salen = [];
    const d = estadoMapa.datos;
    ["pins", "labels", "emblems"].forEach((lista) => d[lista].forEach((cosa, i) => {
        if (dentro(cosa)) {
            salen.push({ lista, i });
        }
    }));
    ["lines", "shapes"].forEach((lista) => d[lista].forEach((cosa, i) => {
        const puntos = cosa.points || [];
        if (puntos.length && puntos.every(dentro)) {
            salen.push({ lista, i });
        }
    }));
    return salen;
}

function cosaElegida() {
    const el = estadoMapa.elegido;
    return el ? estadoMapa.datos[el.lista][el.i] : null;
}

function pintarPropiedadesMapa() {
    const cosa = cosaElegida();
    const varios = estadoMapa.varios.length > 1;
    $("[data-mapa-nada]").hidden = !!cosa || varios;
    $("[data-mapa-propiedades]").hidden = !cosa;
    $("[data-mapa-varios]").hidden = !varios;
    // Al elegir algo (sin nada elegido antes), su panel se abre solo.
    const hay = !!cosa || varios;
    if (hay && !estadoMapa.habiaElegido) {
        abrirPanelMapa("elegido", true, true);
    }
    estadoMapa.habiaElegido = hay;
    if (varios) {
        pintarVariosMapa();
    }
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
    } else if (lista === "shapes") {
        opciones = [["", "Una región sin más"]].concat(TIPOS_DE_ZONA);
    }
    opciones.forEach((o) => {
        const opcion = document.createElement("option");
        opcion.value = o[0];
        opcion.textContent = o[1];
        tipo.appendChild(opcion);
    });
    tipo.value = cosa.kind || (lista === "lines" ? "camino" : "");
    $('[data-mapa-p-caja="kind"]').hidden = lista === "labels" || lista === "emblems";
    // Un sitio puede verse como emblema: la forma, y si la tiene, la
    // imagen y el tamaño.
    $('[data-mapa-p-caja="forma"]').hidden = lista !== "pins";
    document.querySelectorAll('[data-mapa-p-caja="emblema"]').forEach((c) => {
        c.hidden = !(lista === "pins" && cosa.shape);
    });
    if (lista === "pins") {
        $("#mapa-p-imagen").value = cosa.image || "";
        $("#mapa-p-forma").value = cosa.shape || "";
        $("#mapa-p-tamano-emblema").value = cosa.size || "mediano";
    }
    document.querySelectorAll('[data-mapa-p-caja="letra"]').forEach((c) => {
        c.hidden = lista !== "labels";
    });
    if (lista === "labels") {
        $("#mapa-p-letra").value = letraDeTexto(cosa)[0];
        $("#mapa-p-tamano").value = Math.round(tamanoDeTexto(cosa));
        $('[data-mapa-p="italic"]').checked = cosa.italic !== false;
    }
    $('[data-mapa-p-caja="pagina"]').hidden = lista === "labels";
    $('[data-mapa-p-caja="xy"]').hidden = !esMovible(lista);
    $('[data-mapa-p-caja="giro"]').hidden = lista !== "labels" || tieneCurva(cosa);
    // Un texto se puede poner sobre una curva (y quitársela).
    $('[data-mapa-p-caja="curva"]').hidden = lista !== "labels";
    $("[data-mapa-curva-quitar]").hidden = !tieneCurva(cosa);
    $("[data-mapa-curva-dibujar]").textContent = tieneCurva(cosa) ? "Dibujarle otra curva" : "Ponerlo sobre una curva";
    $('[data-mapa-p-caja="taper"]').hidden = !(lista === "lines" && cosa.kind === "rio");
    $('[data-mapa-p-caja="estilo-raya"]').hidden = lista !== "lines";
    if (lista === "lines") {
        const base = estiloDeRaya(cosa.kind);
        $("#mapa-p-grosor").value = cosa.width || "";
        $("#mapa-p-grosor").placeholder = String(base.ancho);
        $("#mapa-p-trazo").value = cosa.dash || "";
        $("#mapa-p-hueco").value = cosa.gap || "";
        $("#mapa-p-hueco").placeholder = String(2 * (Number(cosa.width) || base.ancho));
        $("[data-mapa-p-hueco]").hidden = cosa.dash === "solid";
    }
    if (esMovible(lista)) {
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
    if (lista === "labels" && tieneCurva(cosa)) {
        ayuda = "Sobre una curva de " + puntos + " puntos: arrastra el texto para moverlo entero, o los puntos de la"
            + " curva para cambiarla (los pequeños añaden otro; dos veces en uno, lo quitan).";
    } else if (lista === "shapes" || lista === "lines") {
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

// LO ELEGIDO, CUANDO SON VARIAS: cuántas y de qué, y lo que se les puede
// cambiar a la vez (el tipo de los sitios, su forma y su tamaño; el de las
// rayas; la clase de las zonas; el color).
const NOMBRES_DE_LISTA = { pins: ["sitio", "sitios"], lines: ["raya", "rayas"], shapes: ["región", "regiones"],
    labels: ["texto", "textos"], emblems: ["emblema", "emblemas"] };

function pintarVariosMapa() {
    const todos = listaDeElegidos();
    const cuenta = {};
    todos.forEach(({ lista }) => {
        cuenta[lista] = (cuenta[lista] || 0) + 1;
    });
    const partes = Object.keys(cuenta).map((l) => cuenta[l] + " " + NOMBRES_DE_LISTA[l][cuenta[l] === 1 ? 0 : 1]);
    $("[data-mapa-varios-que]").textContent = todos.length + " cosas elegidas: "
        + (partes.length > 1 ? partes.slice(0, -1).join(", ") + " y " + partes[partes.length - 1] : partes[0]) + ".";
    // Cada lista de opciones sale si hay de lo suyo, con el valor que tengan
    // todas si es el mismo (si no, «como estén»).
    const comun = (lista, campo) => {
        const valores = [...new Set(todos.filter((v) => v.lista === lista).map((v) => estadoMapa.datos[lista][v.i][campo] || ""))];
        return valores.length === 1 ? valores[0] : "*";
    };
    document.querySelectorAll("[data-mapa-v-caja]").forEach((caja) => {
        caja.hidden = !cuenta[caja.getAttribute("data-mapa-v-caja")];
    });
    $("#mapa-v-tipo").value = comun("pins", "kind");
    $("#mapa-v-forma").value = comun("pins", "shape");
    const tamano = comun("pins", "size");
    $("#mapa-v-tamano").value = tamano === "" ? "mediano" : tamano;
    $("#mapa-v-raya").value = comun("lines", "kind") || "camino";
    $("#mapa-v-zona").value = comun("shapes", "kind");
    $("[data-mapa-v-borrar]").textContent = "Borrar las " + todos.length;
}

function cambiarVariosMapa(campo, valor) {
    if (valor === "*") {
        return;
    }
    const lista = campo === "kind-raya" ? "lines" : campo === "kind-zona" ? "shapes" : "pins";
    const clave = campo.startsWith("kind") ? "kind" : campo;
    const suyos = listaDeElegidos().filter((v) => v.lista === lista).map((v) => estadoMapa.datos[lista][v.i]);
    if (!suyos.length) {
        return;
    }
    apuntarPaso();
    suyos.forEach((cosa) => {
        if (valor) {
            cosa[clave] = valor;
        } else {
            delete cosa[clave];
        }
        if (clave === "shape" && valor && !cosa.size) {
            cosa.size = "mediano";
        }
    });
    if (campo === "kind") {
        suyos.forEach(vestirCapital);
    }
    pintarCosasMapa();
    pintarPropiedadesMapa();
    avisarEditor("Cambiado en " + suyos.length + " " + NOMBRES_DE_LISTA[lista][suyos.length === 1 ? 0 : 1] + ".");
}

function colorDeVariosMapa(poner) {
    const todos = listaDeElegidos();
    apuntarPaso();
    todos.forEach(({ lista, i }) => {
        const cosa = estadoMapa.datos[lista][i];
        if (poner) {
            cosa.color = $("#mapa-v-color").value;
        } else {
            delete cosa.color;
        }
    });
    [...new Set(todos.map((v) => v.lista))].forEach((lista) => apuntarColorNuevo(lista, poner ? $("#mapa-v-color").value : ""));
    pintarCosasMapa();
    avisarEditor(poner ? "Color puesto a las " + todos.length + "." : "Quitado su color a las " + todos.length
        + " (vuelven al de su tipo).");
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
        // Un texto sobre una curva se lleva la curva entera.
        const antes = sitioDeCosa(cosa);
        cosa[campo] = redondoMapa(n);
        if (antes.puntos) {
            moverCosaDesde(cosa, antes, cosa.x - antes.x, cosa.y - antes.y);
        }
    } else if (campo === "angle") {
        const n = Number(valor) || 0;
        if (n) {
            cosa.angle = n;
        } else {
            delete cosa.angle;
        }
        $("[data-mapa-p-giro-cifra]").textContent = n + "°";
    } else if (campo === "width" || campo === "gap") {
        const n = Number(String(valor).replace(",", "."));
        if (valor === "" || !Number.isFinite(n) || n <= 0) {
            delete cosa[campo];
        } else {
            cosa[campo] = Math.round(n * 10) / 10;
        }
    } else if (campo === "fontSize") {
        const n = Number(valor);
        if (!Number.isFinite(n) || n < 1) {
            return;
        }
        cosa.fontSize = Math.round(n);
        delete cosa.size;
    } else if (campo === "italic") {
        if (valor) {
            delete cosa.italic;
        } else {
            cosa.italic = false;
        }
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
        apuntarColorNuevo(el.lista, cosa.color || "");
    } else if (valor) {
        cosa[campo] = valor;
    } else {
        delete cosa[campo];
    }
    estadoMapa.cambiado = true;
    if (campo === "color" && valor) {
        apuntarColorNuevo(el.lista, valor);
    }
    repintarCosa(el.lista, el.i);
    if (campo === "dash") {
        $("[data-mapa-p-hueco]").hidden = cosa.dash === "solid";
    }
    if (campo === "shape") {
        document.querySelectorAll('[data-mapa-p-caja="emblema"]').forEach((c) => {
            c.hidden = !cosa.shape;
        });
    }
    if (campo === "image" && valor && !estadoMapa.imagenes[valor]) {
        urlDeImagenMapa(valor).then(() => repintarCosa(el.lista, el.i));
    }
    if (campo === "label" || campo === "kind" || campo === "targetPage") {
        pintarListaDeCosas();
        if (campo === "kind") {
            vestirCapital(cosa);
            $("[data-mapa-que]").textContent = nombreDeCosa(el.lista, cosa).que.replace(/^./, (c) => c.toUpperCase());
            $('[data-mapa-p-caja="taper"]').hidden = !(el.lista === "lines" && cosa.kind === "rio");
        }
    }
}

// UN TEXTO SOBRE UNA CURVA, desde el panel: dibujarle una (la herramienta
// «Escribir» con «Sobre una curva»; al terminar, la curva es suya) o
// quitársela (vuelve a ir recto, en el centro de la curva).
function dibujarCurvaDelTexto() {
    const el = estadoMapa.elegido;
    if (!el || el.lista !== "labels") {
        return;
    }
    const i = el.i;
    $("#mapa-curva-nueva").checked = true;
    ponerHerramienta("texto");
    estadoMapa.curvaPara = i;
    elegirCosa("labels", i);
    avisarEditor("Dibuja la curva por donde va «" + (estadoMapa.datos.labels[i].label || "el texto") + "»: pulsa punto a"
        + " punto y acaba con doble clic o Fin (Esc lo cancela).");
    lienzoMapa().focus({ preventScroll: true });
}

function quitarCurvaDelTexto() {
    const cosa = cosaElegida();
    if (!cosa || !tieneCurva(cosa)) {
        return;
    }
    apuntarPaso();
    delete cosa.points;
    estadoMapa.cambiado = true;
    pintarCosasMapa();
    pintarPropiedadesMapa();
    avisarEditor("Ahora va recto (puedes girarlo con «Giro»).");
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
        + " en las regiones y las rayas se arrastran sus puntos. Arrastrando en un hueco (o con el botón de en medio) te mueves por el mapa."
        + " Con Mayús: pulsando, eliges varias cosas; arrastrando en un hueco, todo lo que quede en el recuadro.",
    pin: "Pulsa en el mapa donde va el sitio. Luego escribe su nombre en «Lo elegido».",
    region: "Pulsa punto a punto el borde de la región. Para cerrarla, pulsa en el primero, pulsa dos veces"
        + " o «Terminar el dibujo».",
    raya: "Pulsa punto a punto por donde va, desde el principio (un río, desde donde nace; una ruta, desde"
        + " donde sale). Para acabar, pulsa dos veces o «Terminar el dibujo».",
    texto: "Pulsa en el mapa donde va el texto («Mar de las Brumas»). Luego escríbelo en «Lo elegido», y elige su"
        + " tamaño y su giro.",
    curva: "Pulsa punto a punto por donde va el texto (el nombre de un río, de una cordillera): sale del derecho"
        + " vaya hacia donde vaya. Para acabar, pulsa dos veces o «Terminar el dibujo».",
    emblema: "Pulsa en el mapa donde va el emblema. Luego, en «Lo elegido», su nombre, la página a la que lleva y su"
        + " imagen: súbela, elige una de las que hay o usa la bandera o el blasón de su página.",
    medir: "Pulsa de un sitio a otro, punto a punto, por donde se iría. Aquí debajo sale cuánto hay (con la"
        + " escala, en leguas o kilómetros y en días de viaje).",
    escala: "Marca un tramo del que sepas lo que mide (de una ciudad a otra, por ejemplo): pulsa en un extremo y"
        + " en el otro. Luego escribe aquí debajo cuánto es y «Usar como escala».",
};
const INSTRUCCIONES_A_MANO = "Aprieta y arrastra por donde va; al soltar, se acaba.";
const HERRAMIENTAS_DE_DIBUJO = ["region", "raya"];

// Las que van punto a punto: la región, la raya y el texto sobre una curva.
function esDibujoMapa(h) {
    return HERRAMIENTAS_DE_DIBUJO.includes(h) || (h === "texto" && $("#mapa-curva-nueva").checked);
}

// «Tamaño» solo si el sitio nuevo va como emblema.
function pintarOpcionesDeSitio() {
    $('[data-mapa-solo="pin-emblema"]').hidden = estadoMapa.herramienta !== "pin" || !$("#mapa-forma-nueva").value;
}

function ponerHerramienta(herramienta) {
    // Un dibujo a medias con puntos de sobra se termina en vez de perderlo
    // (al pasar, por ejemplo, a «Elegir y mover» para retocarlo).
    const dibujo = estadoMapa.dibujo;
    if (dibujo && herramienta !== estadoMapa.herramienta
        && dibujo.puntos.length >= (dibujo.lista === "shapes" ? 3 : 2)) {
        terminarDibujo();
    }
    cancelarDibujo();
    estadoMapa.herramienta = herramienta;
    estadoMapa.iman = null;
    estadoMapa.cajaEleccion = null;
    const radio = document.querySelector('input[name="herramienta"][value="' + herramienta + '"]');
    if (radio) {
        radio.checked = true;
    }
    document.querySelectorAll(".herramienta").forEach((h) => {
        h.classList.toggle("es-elegida", !!h.querySelector("input:checked"));
    });
    const dibuja = esDibujoMapa(herramienta);
    document.querySelectorAll('[data-mapa-solo="pin"]').forEach((c) => {
        c.hidden = herramienta !== "pin";
    });
    $('[data-mapa-solo="raya"]').hidden = herramienta !== "raya";
    $('[data-mapa-solo="region"]').hidden = herramienta !== "region";
    document.querySelectorAll('[data-mapa-solo="texto"]').forEach((c) => {
        c.hidden = herramienta !== "texto";
    });
    pintarOpcionesDeSitio();
    pintarColorNuevo();
    $("[data-mapa-escala]").hidden = herramienta !== "escala";
    estadoMapa.ratonMedida = null;
    $('[data-mapa-solo="dibujo"]').hidden = !dibuja;
    $("[data-mapa-medir]").hidden = herramienta !== "medir";
    // Lo que se mide sale en el panel de las herramientas: a la vista.
    if (herramienta === "medir" || herramienta === "escala") {
        abrirPanelMapa("herramientas", true, true);
    }
    $("[data-mapa-instrucciones]").textContent = dibuja && $("#mapa-mano").checked
        ? INSTRUCCIONES_A_MANO : INSTRUCCIONES_MAPA[herramienta === "texto" && dibuja ? "curva" : herramienta];
    lienzoMapa().classList.toggle("es-dibujo", herramienta !== "elegir");
    pintarAsasMapa();
    escalarMarcasMapa();
}

function empezarDibujo() {
    const h = estadoMapa.herramienta;
    estadoMapa.dibujo = { lista: h === "region" ? "shapes" : h === "texto" ? "labels" : "lines",
        kind: h === "region" ? $("#mapa-tipo-zona").value : h === "texto" ? "" : $("#mapa-tipo-raya").value,
        puntos: [], raton: null };
    mandosDeDibujo();
}

function mandosDeDibujo() {
    const dibujo = estadoMapa.dibujo;
    const hay = !!dibujo && dibujo.puntos.length > 0;
    // (Están en la paleta, que va fija: aparecer y desaparecer no mueve el
    // mapa.)
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
            d: dibujo.lista === "labels" && puntos.length >= 2 ? curvaSuaveMapa(puntos).d : trazoMapa(puntos, false),
            fill: dibujo.lista === "shapes" ? "rgba(245,206,108,0.25)" : "none",
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
    const medida = medidaActual() || [];
    const deEscala = estadoMapa.herramienta === "escala";
    if (medida.length) {
        const puntos = estadoMapa.ratonMedida ? medida.concat([estadoMapa.ratonMedida]) : medida;
        g.appendChild(svgMapa("path", {
            d: trazoMapa(puntos, false), fill: "none", stroke: "#1b1020", "stroke-width": 6,
            "vector-effect": "non-scaling-stroke", "stroke-linecap": "round", class: "mapa-ed-dibujo",
        }));
        g.appendChild(svgMapa("path", {
            d: trazoMapa(puntos, false), fill: "none", stroke: deEscala ? "#5fd4e8" : "#f5ce6c", "stroke-width": 3,
            "stroke-dasharray": "10 6",
            "vector-effect": "non-scaling-stroke", "stroke-linecap": "round", class: "mapa-ed-dibujo",
        }));
        medida.forEach((p) => g.appendChild(svgMapa("circle", {
            cx: p.x, cy: p.y, r: 5 * s, fill: deEscala ? "#5fd4e8" : "#f5ce6c", stroke: "#1b1020", "stroke-width": 2,
            "vector-effect": "non-scaling-stroke", class: "mapa-ed-dibujo",
        })));
    }
    // El recuadro de elegir con Mayús.
    const caja = estadoMapa.cajaEleccion;
    if (caja) {
        g.appendChild(svgMapa("rect", {
            x: Math.min(caja.x1, caja.x2), y: Math.min(caja.y1, caja.y2), width: Math.abs(caja.x2 - caja.x1),
            height: Math.abs(caja.y2 - caja.y1), fill: "rgba(245,206,108,0.12)", stroke: "#f5ce6c", "stroke-width": 2,
            "stroke-dasharray": "8 5", "vector-effect": "non-scaling-stroke", class: "mapa-ed-dibujo",
        }));
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
    estadoMapa.curvaPara = null;
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
            : dibujo.lista === "labels" ? "La curva necesita por lo menos dos puntos."
                : "Una raya necesita por lo menos dos puntos.", true);
        return;
    }
    apuntarPaso();
    if (dibujo.lista === "labels") {
        terminarCurvaDeTexto(puntos);
        return;
    }
    const cosa = { id: idNuevoMapa() };
    if (dibujo.lista === "shapes") {
        cosa.type = "polygon";
        cosa.points = puntos;
        // Con su clase de zona, el color de la zona; si no, uno de la rueda.
        const zona = tipoDeZonaMapa(dibujo.kind);
        if (zona) {
            cosa.kind = zona[0];
            cosa.color = zona[2];
        } else {
            cosa.color = COLORES_DE_REGION[estadoMapa.cuantasRegiones % COLORES_DE_REGION.length];
            estadoMapa.cuantasRegiones += 1;
        }
        const capa = estadoMapa.datos.layers[0];
        if (capa && capa.id) {
            cosa.layerId = capa.id;
        }
    } else {
        cosa.kind = dibujo.kind || "camino";
        cosa.points = puntos;
    }
    conColorNuevo(dibujo.lista, cosa);
    estadoMapa.datos[dibujo.lista].push(cosa);
    const lista = dibujo.lista;
    cancelarDibujo();
    estadoMapa.iman = null;
    elegirCosa(lista, estadoMapa.datos[lista].length - 1);
    avisarEditor((lista === "shapes" ? "Región" : nombreDeCosa("lines", cosa).que.replace(/^./, (c) => c.toUpperCase()))
        + " hecha (" + puntos.length + " puntos). Ponle nombre en «Lo elegido».");
    $("#mapa-p-nombre").focus({ preventScroll: true });
}

// La curva de un texto: la de uno que ya estaba (dibujarCurvaDelTexto) o
// la de uno nuevo, todavía sin escribir.
function terminarCurvaDeTexto(puntos) {
    const para = estadoMapa.curvaPara;
    const centro = centroDeCurva(puntos);
    const labels = estadoMapa.datos.labels;
    cancelarDibujo();
    estadoMapa.iman = null;
    if (para !== null && labels[para]) {
        Object.assign(labels[para], centro, { points: puntos });
        delete labels[para].angle;
        ponerHerramienta("elegir");
        elegirCosa("labels", para);
        avisarEditor("Curva puesta. Arrastra sus puntos para retocarla, o el texto para moverlo entero.");
        return;
    }
    const texto = { id: idNuevoMapa(), x: centro.x, y: centro.y, points: puntos, label: "",
        font: $("#mapa-letra-nueva").value };
    const tamano = Number($("#mapa-tamano-nuevo").value);
    texto.fontSize = tamano > 0 ? Math.round(tamano) : Math.round(tamanoDeTexto({}));
    if (!$("#mapa-cursiva-nueva").checked) {
        texto.italic = false;
    }
    labels.push(conColorNuevo("labels", texto));
    elegirCosa("labels", labels.length - 1);
    avisarEditor("Curva hecha (" + puntos.length + " puntos). Escribe el texto en «Lo elegido».");
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
    const forma = $("#mapa-forma-nueva").value;
    if (forma) {
        cosa.shape = forma;
        cosa.size = $("#mapa-tamano-emblema-nuevo").value || "mediano";
    }
    estadoMapa.datos.pins.push(conColorNuevo("pins", cosa));
    estadoMapa.iman = null;
    elegirCosa("pins", estadoMapa.datos.pins.length - 1);
    vestirCapital(cosa);
    avisarEditor("Sitio puesto. Escribe su nombre (y, si tiene, la página a la que lleva).");
    $("#mapa-p-nombre").focus({ preventScroll: true });
}

function ponerTexto(p) {
    const sitio = dentroDelMapa(p);
    apuntarPaso();
    const texto = { id: idNuevoMapa(), x: sitio.x, y: sitio.y, label: "", font: $("#mapa-letra-nueva").value };
    const tamano = Number($("#mapa-tamano-nuevo").value);
    texto.fontSize = tamano > 0 ? Math.round(tamano) : Math.round(tamanoDeTexto({}));
    if (!$("#mapa-cursiva-nueva").checked) {
        texto.italic = false;
    }
    estadoMapa.datos.labels.push(conColorNuevo("labels", texto));
    elegirCosa("labels", estadoMapa.datos.labels.length - 1);
    avisarEditor("Texto puesto. Escríbelo en «Lo elegido».");
    $("#mapa-p-nombre").focus({ preventScroll: true });
}

// ---- LOS EMBLEMAS ----
// Un escudo (o una bandera, o un medallón) con una imagen dentro: la
// bandera o el blasón, subida aquí, elegida de las que hay, o la de la
// ficha de su página.
function ponerEmblema(p) {
    const sitio = dentroDelMapa(p);
    apuntarPaso();
    estadoMapa.datos.emblems.push({ id: idNuevoMapa(), x: sitio.x, y: sitio.y, label: "",
        shape: $("#mapa-forma-nueva").value, size: $("#mapa-tamano-emblema-nuevo").value });
    elegirCosa("emblems", estadoMapa.datos.emblems.length - 1);
    avisarEditor("Emblema puesto. A la derecha: su nombre, la página a la que lleva y su imagen (súbela o usa la"
        + " de su página).");
    $("#mapa-p-nombre").focus({ preventScroll: true });
}

// Dónde sirve el editor una imagen de la bóveda, por su nombre.
async function urlDeImagenMapa(nombre) {
    if (!nombre || estadoMapa.imagenes[nombre]) {
        return estadoMapa.imagenes[nombre] || "";
    }
    const hecho = await pedirEditor("/api/imagen-url?nombre=" + encodeURIComponent(nombre));
    if (hecho.url) {
        estadoMapa.imagenes[nombre] = hecho.url;
    }
    return hecho.url || "";
}

function ponerImagenDeEmblema(nombre) {
    const el = estadoMapa.elegido;
    if (!el || (el.lista !== "emblems" && el.lista !== "pins")) {
        return;
    }
    $("#mapa-p-imagen").value = nombre;
    cambiarPropiedadMapa("image", nombre);
    estadoMapa.ultimoCampo = null;
}

async function subirImagenDeEmblema(input) {
    const imagen = await leerImagenMapa(input);
    input.value = "";
    const cosa = cosaElegida();
    if (!imagen || !cosa) {
        return;
    }
    avisarEditor("Preparando la imagen…");
    const hecha = await pedirEditor("/api/mapa/emblema", Object.assign({
        nombre: cosa.label || cosa.targetPage || estadoMapa.datos.title || "emblema" }, imagen));
    if (hecha.error) {
        avisarEditor(hecha.error, true);
        return;
    }
    estadoMapa.imagenes[hecha.nombre] = hecha.url;
    // A la lista de las que hay, para poder elegirla en otros emblemas.
    const o = document.createElement("option");
    o.value = hecha.nombre;
    $("#lista-imagenes").appendChild(o);
    ponerImagenDeEmblema(hecha.nombre);
    avisarEditor("Imagen lista: " + hecha.nombre + ". Recuerda guardar.");
}

// La bandera, el blasón o el escudo de la ficha de la página del emblema.
async function usarImagenDeLaPagina() {
    const cosa = cosaElegida();
    if (!cosa) {
        return;
    }
    if (!cosa.targetPage) {
        avisarEditor("Primero escribe a qué página lleva el emblema.", true);
        $("#mapa-p-pagina").focus();
        return;
    }
    const pagina = await pedirEditor("/api/pagina?nombre=" + encodeURIComponent(cosa.targetPage));
    if (pagina.error) {
        avisarEditor(pagina.error, true);
        return;
    }
    const campo = (pagina.campos || []).find((c) => /^(bandera|blas[oó]n|escudo)$/i.test(c.clave) && c.valor);
    if (!campo) {
        avisarEditor("La ficha de " + pagina.nombre + " no tiene bandera, blasón ni escudo.", true);
        return;
    }
    const nombre = campo.valor.replace(/^!?\[\[|\]\]$/g, "").split("|")[0].trim();
    ponerImagenDeEmblema(nombre);
    await urlDeImagenMapa(nombre);
    repintarCosa(estadoMapa.elegido.lista, estadoMapa.elegido.i);
    avisarEditor("Puesta la " + campo.clave + " de " + pagina.nombre + ": " + nombre + ".");
}

// LA CAPITAL, SIEMPRE CON SU BANDERA: al poner una (o cambiar un sitio a
// capital), si no tiene imagen, se le pone de emblema (escudo, grande, si
// no tenía forma) la bandera, el blasón o el escudo de la ficha de la
// página del mapa (el reino), y si no, de la página a la que lleva.
async function vestirCapital(cosa) {
    if (!cosa || cosa.kind !== "capital" || cosa.image) {
        return;
    }
    if (!cosa.shape) {
        cosa.shape = "escudo";
        cosa.size = cosa.size || "grande";
    }
    const deDonde = [estadoMapa.datos.page, cosa.targetPage].filter(Boolean);
    let puesta = "";
    for (const nombrePagina of deDonde) {
        const pagina = await pedirEditor("/api/pagina?nombre=" + encodeURIComponent(nombrePagina));
        const campo = pagina && !pagina.error
            && (pagina.campos || []).find((c) => /^(bandera|blas[oó]n|escudo)$/i.test(c.clave) && c.valor);
        if (campo) {
            puesta = campo.valor.replace(/^!?\[\[|\]\]$/g, "").split("|")[0].trim();
            await urlDeImagenMapa(puesta);
            avisarEditor("A la capital le he puesto la " + campo.clave + " de " + pagina.nombre + ".");
            break;
        }
    }
    if (puesta && !cosa.image) {
        cosa.image = puesta;
        estadoMapa.cambiado = true;
    }
    // Se repinta y, si sigue elegida, se ponen en el panel su forma, su
    // tamaño y su imagen (solo esos campos: rehacer el panel entero le
    // quitaría el foco a lo que se esté tocando).
    const i = estadoMapa.datos.pins.indexOf(cosa);
    if (i < 0) {
        return;
    }
    repintarCosa("pins", i);
    const el = estadoMapa.elegido;
    if (el && el.lista === "pins" && el.i === i) {
        document.querySelectorAll('[data-mapa-p-caja="emblema"]').forEach((c) => {
            c.hidden = false;
        });
        $("#mapa-p-forma").value = cosa.shape;
        $("#mapa-p-tamano-emblema").value = cosa.size || "mediano";
        $("#mapa-p-imagen").value = cosa.image || "";
    }
}

// ---- MEDIR, Y PONER LA ESCALA ----
// Dos herramientas aparte. «Poner la escala»: se marca un tramo que se
// conoce y se dice cuánto es (en leguas, kilómetros o millas); eso se
// guarda en el .cmap ("scale") y la web pinta con ello una barra de
// escala. «Medir»: una raya de varios tramos, que no se guarda, que dice
// cuánto hay (con escala, en esa unidad y en días de viaje; sin ella, en
// píxeles del mapa).
const NOMBRE_DE_UNIDAD = { leguas: "leguas", km: "kilómetros", millas: "millas" };

function medidaActual() {
    const h = estadoMapa.herramienta;
    return h === "medir" ? estadoMapa.medida : h === "escala" ? estadoMapa.tramoEscala : null;
}

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

function nombreDeUnidad(unidad) {
    return NOMBRE_DE_UNIDAD[unidad] || unidad || "";
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

function textoDeDistancia(pixeles, sinViaje) {
    const e = estadoMapa.datos.scale;
    const unidades = enUnidades(pixeles);
    if (unidades === null) {
        return cifraMapa(pixeles, 0) + " píxeles del mapa";
    }
    let texto = cifraMapa(unidades) + " " + nombreDeUnidad(e.unit);
    const viaje = Object.entries(e.travel || {}).filter(([, v]) => typeof v === "number" && v > 0);
    if (!sinViaje && viaje.length && unidades > 0) {
        texto += ". " + viaje.map(([como, v]) => como[0].toUpperCase() + como.slice(1) + ": " + diasDeViaje(unidades, v))
            .join(" · ");
    }
    return texto;
}

function pintarMedida() {
    if (!estadoMapa.datos) {
        return;
    }
    const e = estadoMapa.datos.scale;
    const hayEscala = !!(e && e.pixels && e.distance);
    const textoEscala = hayEscala
        ? cifraMapa(e.pixels, 0) + " píxeles del mapa son " + cifraMapa(e.distance) + " " + nombreDeUnidad(e.unit)
        : "";
    // MEDIR
    const medida = estadoMapa.medida;
    $("[data-mapa-medida]").textContent = medida.length < 2
        ? "Pulsa en el mapa de un sitio a otro."
        : "Distancia: " + textoDeDistancia(largoDeMedida(medida)) + ".";
    $("[data-mapa-medida-raton]").textContent = "";
    $("[data-mapa-medir-escala]").textContent = hayEscala
        ? "Escala del mapa: " + textoEscala + "."
        : "Este mapa aún no tiene escala, así que se mide en píxeles. Para medir en leguas o kilómetros, ponla"
            + " antes con «Poner la escala».";
    // LA ESCALA
    $("[data-mapa-escala-ahora]").textContent = hayEscala
        ? "Ahora: " + textoEscala + ". Para cambiarla, marca otro tramo."
        : "Este mapa aún no tiene escala.";
    const tramo = estadoMapa.tramoEscala;
    $("[data-mapa-tramo]").textContent = tramo.length < 2
        ? "Pulsa en el mapa en un extremo del tramo y luego en el otro."
        : "El tramo marcado mide " + cifraMapa(largoDeMedida(tramo), 0) + " píxeles del mapa"
            + (hayEscala ? " (ahora, " + textoDeDistancia(largoDeMedida(tramo), true) + ")" : "") + ".";
    $("[data-mapa-escala-raton]").textContent = "";
    if (e && e.unit) {
        const unidad = $("#mapa-escala-unidad");
        if (![...unidad.options].some((o) => o.value === e.unit)) {
            const otra = document.createElement("option");
            otra.value = e.unit;
            otra.textContent = e.unit;
            unidad.appendChild(otra);
        }
        unidad.value = e.unit;
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
    const lista = medidaActual();
    if (!lista) {
        return;
    }
    const p = dentroDelMapa(imantar(crudo).p);
    const ultimo = lista[lista.length - 1];
    if (ultimo && Math.hypot(ultimo.x - p.x, ultimo.y - p.y) < 2 * escalaMapa()) {
        return;
    }
    // El tramo de la escala es de dos puntos: el tercero empieza otro.
    if (estadoMapa.herramienta === "escala" && lista.length >= 2) {
        lista.length = 0;
    }
    lista.push(p);
    pintarMedida();
}

function ponerEscala() {
    const pixeles = largoDeMedida(estadoMapa.tramoEscala);
    const cuanto = Number(String($("#mapa-escala-cuanto").value).replace(",", "."));
    const unidad = $("#mapa-escala-unidad").value || "leguas";
    if (pixeles <= 0) {
        avisarEditor("Primero marca en el mapa un tramo del que sepas cuánto es.", true);
        return;
    }
    if (!Number.isFinite(cuanto) || cuanto <= 0) {
        avisarEditor("Escribe cuánto es el tramo (un número).", true);
        $("#mapa-escala-cuanto").focus();
        return;
    }
    apuntarPaso();
    const antes = estadoMapa.datos.scale || {};
    const viaje = antes.unit === unidad && antes.travel ? antes.travel
        : Object.assign({}, VIAJE_POR_UNIDAD[unidad] || {});
    estadoMapa.datos.scale = { pixels: redondoMapa(pixeles), distance: cuanto, unit: unidad, travel: viaje };
    pintarMedida();
    avisarEditor("Escala puesta: " + cifraMapa(pixeles, 0) + " píxeles del mapa son " + cifraMapa(cuanto) + " "
        + nombreDeUnidad(unidad) + ". Ya puedes medir con «Medir»; en la web sale una barra de escala.");
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
// MOVERSE CON EL BOTÓN DE EN MEDIO, con cualquier herramienta y a mitad de
// lo que sea (un dibujo, arrastrando un punto o un sitio, midiendo): va
// aparte de lo que se esté haciendo (estadoMapa.paneo, no arrastre), así
// que no lo corta ni suelta lo elegido. Si se aprieta con el izquierdo ya
// apretado, el navegador no avisa con un pointerdown sino con un
// pointermove con otros botones (e.buttons: 1 el izquierdo, 4 el de en
// medio); por eso se mira en cada movimiento.
function empezarPaneo(e) {
    estadoMapa.paneo = { x: e.clientX, y: e.clientY, vista: Object.assign({}, estadoMapa.vista) };
    lienzoMapa().classList.add("es-paneo");
}

function seguirPaneo(e) {
    const pa = estadoMapa.paneo;
    const lienzo = lienzoMapa();
    const s = Math.max(pa.vista.w / lienzo.clientWidth, pa.vista.h / lienzo.clientHeight);
    ponerVistaMapa({ x: pa.vista.x - (e.clientX - pa.x) * s, y: pa.vista.y - (e.clientY - pa.y) * s,
        w: pa.vista.w, h: pa.vista.h });
}

function acabarPaneo(e) {
    estadoMapa.paneo = null;
    lienzoMapa().classList.remove("es-paneo");
    // Si se estaba moviendo el mapa con el izquierdo, sigue desde aquí.
    const a = estadoMapa.arrastre;
    if (a && a.que === "vista" && e) {
        a.inicio = Object.assign({}, a.inicio, { x: e.clientX, y: e.clientY, vista: Object.assign({}, estadoMapa.vista) });
    }
}

function alApretarEnElMapa(e) {
    if (!estadoMapa.datos || (e.button !== 0 && e.button !== 1)) {
        return;
    }
    const svg = svgDelMapa();
    if (e.button === 1) {
        // Sin quitarle el foco a nada: lo que se estaba escribiendo o
        // haciendo sigue igual.
        e.preventDefault();
        empezarPaneo(e);
        svg.setPointerCapture(e.pointerId);
        return;
    }
    // Con el izquierdo, el teclado pasa al mapa (Esc cancela el dibujo,
    // Supr borra lo elegido…), aunque se viniera de un panel.
    if (document.activeElement !== lienzoMapa()) {
        lienzoMapa().focus({ preventScroll: true });
    }
    estadoMapa.sinIman = e.altKey;
    const p = puntoDelMapa(e);
    const inicio = { x: e.clientX, y: e.clientY, p, vista: Object.assign({}, estadoMapa.vista) };
    // Con el botón de en medio, o en un hueco con «Elegir y mover»: moverse.
    const asa = e.target.closest("[data-asa]");
    const medio = e.target.closest("[data-medio]");
    const cosa = e.target.closest("[data-lista]");
    const h = estadoMapa.herramienta;
    if (e.button === 0 && h === "elegir" && e.shiftKey && !asa && !medio && !cosa) {
        // Mayús y arrastrar en un hueco: un recuadro para elegir lo de dentro.
        estadoMapa.arrastre = { que: "caja", inicio, movido: false };
    } else if (h === "elegir" && !asa && !medio && !cosa) {
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
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
            // Con Mayús (o Ctrl): se añade a lo elegido, o se quita.
            alternarEleccion(lista, i);
            e.preventDefault();
            return;
        }
        if (estadoMapa.varios.length && estaElegida(lista, i)) {
            // Una de las elegidas: se arrastran todas juntas.
            estadoMapa.arrastre = { que: "varios", inicio, movido: false,
                desde: listaDeElegidos().map((v) => ({ v, sitio: sitioDeCosa(estadoMapa.datos[v.lista][v.i]) })) };
        } else {
            elegirCosa(lista, i);
            const movible = esMovible(lista);
            estadoMapa.arrastre = movible
                ? { que: "sitio", lista, inicio, desde: sitioDeCosa(estadoMapa.datos[lista][i]), movido: false }
                : { que: "vista", inicio, movido: false, cosa: true };
        }
    } else if (esDibujoMapa(h) && $("#mapa-mano").checked) {
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
    if (e.pointerType === "mouse") {
        if (estadoMapa.paneo && !(e.buttons & 4)) {
            acabarPaneo(e);
        } else if (!estadoMapa.paneo && (e.buttons & 4)) {
            empezarPaneo(e);
        }
        // Soltado el izquierdo con el de en medio apretado: no llega un
        // pointerup (hasta soltarlos todos), así que se suelta aquí.
        if (estadoMapa.arrastre && !(e.buttons & 1)) {
            alSoltarEnElMapa(e);
        }
    }
    if (estadoMapa.paneo) {
        seguirPaneo(e);
    }
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
        const medida = medidaActual();
        if (medida && medida.length && !(h === "escala" && medida.length >= 2)) {
            estadoMapa.ratonMedida = pegado.p;
            const tramo = largoDeMedida([medida[medida.length - 1], pegado.p]);
            if (h === "medir") {
                $("[data-mapa-medida-raton]").textContent = "Hasta el ratón, " + textoDeDistancia(tramo, true) + " más.";
            } else {
                $("[data-mapa-escala-raton]").textContent = "Hasta el ratón: " + cifraMapa(tramo, 0) + " píxeles.";
            }
        } else {
            estadoMapa.ratonMedida = null;
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
        if (estadoMapa.paneo) {
            return;
        }
        lienzo.classList.add("es-paneo");
        const s = Math.max(a.inicio.vista.w / lienzo.clientWidth, a.inicio.vista.h / lienzo.clientHeight);
        ponerVistaMapa({ x: a.inicio.vista.x - dx * s, y: a.inicio.vista.y - dy * s, w: a.inicio.vista.w, h: a.inicio.vista.h });
        return;
    }
    const p = puntoDelMapa(e);
    const el = estadoMapa.elegido;
    if ((a.que === "sitio" || a.que === "punto" || a.que === "varios") && !a.apuntado) {
        apuntarPaso();
        a.apuntado = true;
    }
    if (a.que === "varios") {
        const dx = p.x - a.inicio.p.x;
        const dy = p.y - a.inicio.p.y;
        a.desde.forEach(({ v, sitio }) => {
            moverCosaDesde(estadoMapa.datos[v.lista][v.i], sitio, dx, dy);
            repintarCosa(v.lista, v.i);
        });
        return;
    }
    if (a.que === "caja") {
        estadoMapa.cajaEleccion = { x1: a.inicio.p.x, y1: a.inicio.p.y, x2: p.x, y2: p.y };
        pintarDibujoMapa();
        return;
    }
    if (a.que === "sitio") {
        const sitio = estadoMapa.datos[a.lista][el.i];
        const quiere = { x: a.desde.x + p.x - a.inicio.p.x, y: a.desde.y + p.y - a.inicio.p.y };
        const pegado = a.lista === "pins" ? imantar(quiere, { lista: "pins", i: el.i }) : { p: quiere, pegado: false };
        estadoMapa.iman = pegado.pegado ? pegado.p : null;
        Object.assign(sitio, dentroDelMapa(pegado.p));
        // Un texto sobre una curva se lleva la curva.
        if (a.desde.puntos) {
            sitio.points = a.desde.puntos.map((q) => dentroDelMapa({ x: q.x + sitio.x - a.desde.x, y: q.y + sitio.y - a.desde.y }));
        }
        repintarCosa(a.lista, el.i);
    } else if (a.que === "punto") {
        const pegado = imantar(p, { lista: el.lista, i: el.i, n: a.n });
        estadoMapa.iman = pegado.pegado ? pegado.p : null;
        const deEste = estadoMapa.datos[el.lista][el.i];
        deEste.points[a.n] = dentroDelMapa(pegado.p);
        if (el.lista === "labels") {
            Object.assign(deEste, centroDeCurva(deEste.points));
        }
        repintarCosa(el.lista, el.i);
    } else if (a.que === "mano" && dibujo && !estadoMapa.paneo) {
        const ultimo = dibujo.puntos[dibujo.puntos.length - 1];
        if (Math.hypot(ultimo.x - p.x, ultimo.y - p.y) > 3 * escalaMapa()) {
            dibujo.puntos.push(dentroDelMapa(p));
            pintarDibujoMapa();
        }
    }
}

function alSoltarEnElMapa(e) {
    if (estadoMapa.paneo && e.type === "pointerup") {
        acabarPaneo();
    }
    lienzoMapa().classList.remove("es-paneo");
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
    } else if (a.que === "varios") {
        if (a.movido) {
            pintarCosasMapa();
            pintarPropiedadesMapa();
        }
    } else if (a.que === "caja") {
        const caja = estadoMapa.cajaEleccion;
        estadoMapa.cajaEleccion = null;
        pintarDibujoMapa();
        if (a.movido && caja) {
            // Lo de dentro, con lo que ya hubiera elegido.
            const salen = cosasEnElRecuadro(caja);
            const todos = listaDeElegidos();
            salen.forEach((s) => {
                if (!todos.some((v) => v.lista === s.lista && v.i === s.i)) {
                    todos.push(s);
                }
            });
            elegirVarios(todos);
            avisarEditor(salen.length ? "En el recuadro: " + salen.length + (salen.length === 1 ? " cosa." : " cosas.")
                + " Arrástralas juntas, muévelas con las flechas o cámbialas en «Lo elegido»."
                : "En el recuadro no hay nada entero (las rayas y las regiones tienen que caber enteras).");
        } else if (estadoMapa.elegido || estadoMapa.varios.length) {
            elegirCosa(null);
        }
    } else if (a.que === "mano") {
        terminarDibujo(true);
    } else if (a.que === "vista" && !a.movido && h === "elegir" && !a.cosa) {
        // Un clic en un hueco: soltar lo elegido.
        if (estadoMapa.elegido || estadoMapa.varios.length) {
            elegirCosa(null);
        }
    } else if (a.que === "clic" && !a.movido) {
        if (h === "pin") {
            ponerSitio(a.inicio.p);
        } else if (h === "texto" && !esDibujoMapa(h)) {
            ponerTexto(a.inicio.p);
        } else if (h === "emblema") {
            ponerEmblema(a.inicio.p);
        } else if (h === "medir" || h === "escala") {
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
    if (!el || (esMovible(el.lista) && el.lista !== "labels")) {
        return;
    }
    const puntos = estadoMapa.datos[el.lista][el.i].points;
    if (puntos.length <= (el.lista === "shapes" ? 3 : 2)) {
        avisarEditor(el.lista === "labels" ? "La curva necesita dos puntos por lo menos: para que vaya recto,"
            + " «Quitar la curva»." : "No le quedan puntos que quitar: si sobra entera, bórrala.", true);
        return;
    }
    apuntarPaso();
    puntos.splice(n, 1);
    if (el.lista === "labels") {
        Object.assign(estadoMapa.datos.labels[el.i], centroDeCurva(puntos));
    }
    repintarCosa(el.lista, el.i);
    pintarPropiedadesMapa();
}

function alDobleClicEnElMapa() {
    if (esDibujoMapa(estadoMapa.herramienta) && estadoMapa.dibujo) {
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
        const s = escalaMapa() * (e.shiftKey ? 20 : 4);
        if (estadoMapa.varios.length && h === "elegir") {
            moverElegidos(fx * s, fy * s, "mover-varios");
        } else if (el && esMovible(el.lista) && h === "elegir") {
            const sitio = estadoMapa.datos[el.lista][el.i];
            apuntarPaso("mover-" + el.lista + "-" + el.i);
            moverCosaDesde(sitio, sitioDeCosa(sitio), fx * s, fy * s);
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
        } else if (h === "texto" && !esDibujoMapa(h)) {
            ponerTexto(centroDeLaVista());
        } else if (h === "emblema") {
            ponerEmblema(centroDeLaVista());
        } else if (h === "medir" || h === "escala") {
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
        } else if (medidaActual() && medidaActual().length) {
            empezarOtraMedida();
        } else if (el || estadoMapa.varios.length) {
            elegirCosa(null);
        }
    } else if ((e.key === "Delete" || e.key === "Backspace") && (el || estadoMapa.varios.length)) {
        e.preventDefault();
        borrarElegidos();
    }
}

function empezarOtraMedida() {
    const lista = medidaActual();
    if (lista) {
        lista.length = 0;
    }
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
    const raro = pasarAImagenNueva(hecha);
    avisarEditor("Imagen cambiada: " + hecha.nombre + " (" + hecha.ancho + " × " + hecha.alto + ")." + raro
        + " Recuerda guardar.", !!raro);
}

// El mapa, con otra imagen de fondo (otra medida, el mismo encuadre): lo
// puesto, a la medida nueva. Si la imagen es el doble de grande, cada
// coordenada, el doble (y la escala, igual). Su sitio en el mapamundi no
// cambia: es el mismo trozo. Devuelve un aviso si no tiene la misma forma.
function pasarAImagenNueva(hecha) {
    apuntarPaso();
    const d = estadoMapa.datos;
    const fx = hecha.ancho / d.width;
    const fy = hecha.alto / d.height;
    const escalar = (p) => {
        p.x = redondoMapa(p.x * fx);
        p.y = redondoMapa(p.y * fy);
    };
    d.pins.forEach(escalar);
    d.labels.forEach(escalar);
    d.labels.forEach((c) => (c.points || []).forEach(escalar));
    d.emblems.forEach(escalar);
    d.shapes.concat(d.lines).forEach((c) => (c.points || []).forEach(escalar));
    if (d.scale && d.scale.pixels) {
        d.scale.pixels = redondoMapa(d.scale.pixels * (fx + fy) / 2);
    }
    d.width = hecha.ancho;
    d.height = hecha.alto;
    d.layers[0].image = hecha.nombre;
    estadoMapa.imagenes[hecha.nombre] = hecha.url;
    estadoMapa.medida = [];
    estadoMapa.tramoEscala = [];
    pintarDatosGenerales();
    pintarTodoElMapa();
    ajustarMapa();
    pintarPropiedadesMapa();
    pintarMedida();
    return Math.abs(fx - fy) > 0.02 ? " OJO: no tiene la misma forma que la otra, así que lo puesto se ha estirado." : "";
}

// ---- EN EL MAPAMUNDI, Y AMPLIAR ----
// Dónde cae este mapa en el mapamundi ("world", en unidades del
// mapamundi) y a qué escala va, para poder juntarlo luego con otros: todos
// los regionales a la ESCALA COMÚN (8 píxeles por unidad del mapamundi,
// la de Prunia). Buscarlo solo (OpenCV, en el servidor), retocarlo a
// mano, llevarlo a la escala común y ampliar la imagen (con IA si está
// instalada: herramientas/mapas_mundo.py).
const MODELOS_DE_IMAGEN = [["pintado", "Pintada o con texturas (la mayoría)"], ["dibujo", "Dibujo de líneas limpias"]];
let ayudasDeMapas = null;

async function cargarAyudasDeMapas() {
    const r = await pedirEditor("/api/mapa/ayudas");
    if (r.error) {
        return;
    }
    ayudasDeMapas = r;
    const faltan = [];
    if (!r.opencv) {
        faltan.push("buscarlo en el mapamundi");
    }
    if (!r.ampliador) {
        faltan.push("ampliar con IA");
    }
    $("[data-mapa-ayudas-estado]").textContent = faltan.length
        ? "Para " + faltan.join(" y ") + " hay que instalar una vez las ayudas de los mapas (menú → Imágenes →"
            + " «Instalar las ayudas de los mapas»). Sin ellas el mapa se hace igual" + (r.ampliador ? "." : ", ampliado sin IA.")
        : "Todo a punto: lo busca en el mapamundi y lo amplía con IA hasta " + r.escala + " píxeles por unidad del mapamundi.";
    if (estadoMapa.datos) {
        pintarMundoDelMapa();
    }
}

function escalaComunMapa() {
    return (ayudasDeMapas && ayudasDeMapas.escala) || 8;
}

function ladoMaximoMapa() {
    return (ayudasDeMapas && ayudasDeMapas.lado_maximo) || 8192;
}

// Lo que mediría la imagen a la escala común (sin pasar del máximo).
function medidaComunMapa() {
    const d = estadoMapa.datos;
    const w = d.world;
    if (!w || !(w.w > 0)) {
        return null;
    }
    let ancho = Math.round(w.w * escalaComunMapa());
    if (Math.max(ancho, ancho * d.height / d.width) > ladoMaximoMapa()) {
        ancho = Math.floor(ladoMaximoMapa() * Math.min(1, d.width / d.height));
    }
    return { ancho, alto: Math.round(ancho * d.height / d.width) };
}

// El mapamundi mismo: la referencia de los demás. Sus coordenadas no
// cambian nunca (los mapas regionales guardan su sitio en ellas): al
// ampliarlo solo cambia la imagen, y no se sitúa en sí mismo.
function esElMapamundi() {
    const mundo = ayudasDeMapas && ayudasDeMapas.mapamundi;
    return !!mundo && (estadoMapa.archivo || "").toLowerCase() === String(mundo.archivo).toLowerCase();
}

function pintarMundoDelMapa(sinCasillas) {
    const d = estadoMapa.datos;
    $("[data-mapa-mundo-caja]").hidden = esElMapamundi();
    const w = d.world;
    const estado = $("[data-mapa-mundo-estado]");
    const boton = $("[data-mapa-mundo-escala]");
    if (!w || !(w.w > 0)) {
        estado.textContent = "No está situado en el mapamundi. «Buscarlo» lo encuentra solo si sale de un trozo del"
            + " mapamundi (aunque esté retocado); si está dibujado de cero, pon X, Y y el ancho a mano.";
        boton.hidden = true;
    } else {
        const escala = d.width / w.w;
        const comun = medidaComunMapa();
        const yaEsta = comun && Math.abs(comun.ancho - d.width) <= 2;
        estado.textContent = "Está en el mapamundi en " + cifraMapa(w.x, 1) + ", " + cifraMapa(w.y, 1) + " ("
            + cifraMapa(w.w, 1) + " × " + cifraMapa(w.h, 1) + " unidades). Va a " + cifraMapa(escala, 1)
            + " píxeles por unidad" + (yaEsta ? ": la escala común. Se podrá juntar con los demás."
                : "; la escala común es " + escalaComunMapa() + ".");
        boton.hidden = !comun || yaEsta;
        if (comun) {
            boton.textContent = "Llevarlo a la escala común (" + comun.ancho + " × " + comun.alto + " px)";
        }
    }
    if (!sinCasillas) {
        ["x", "y", "w"].forEach((k) => {
            $("#mapa-mundo-" + k).value = w && Number.isFinite(Number(w[k])) ? String(Math.round(w[k] * 10) / 10) : "";
        });
    }
    // La vista: el mapamundi en pequeño con el recuadro de este mapa.
    const vista = $("[data-mapa-mundo-vista]");
    const mundo = ayudasDeMapas && ayudasDeMapas.mapamundi;
    vista.hidden = !mundo || !mundo.url || !w || !(w.w > 0);
    if (!vista.hidden) {
        const img = $("[data-mapa-mundo-imagen]");
        if (img.getAttribute("src") !== mundo.url) {
            img.setAttribute("src", mundo.url);
        }
        const marco = $("[data-mapa-mundo-marco]");
        marco.style.left = (w.x / mundo.ancho * 100) + "%";
        marco.style.top = (w.y / mundo.alto * 100) + "%";
        marco.style.width = (w.w / mundo.ancho * 100) + "%";
        marco.style.height = (w.h / mundo.alto * 100) + "%";
    }
    pintarMedidaDeAmpliar();
}

function pintarMedidaDeAmpliar() {
    const d = estadoMapa.datos;
    const f = Number($("#mapa-ampliar-cuanto").value) || 2;
    if (esElMapamundi()) {
        $("[data-mapa-ampliar-medida]").textContent = "En el mapamundi solo cambia la imagen (por " + cifraMapa(f)
            + "); sus coordenadas no, así que los mapas regionales siguen en su sitio. Como mucho "
            + ladoMaximoMapa() + " píxeles de lado.";
        $("[data-mapa-ampliar]").disabled = false;
        return;
    }
    const ancho = Math.round(d.width * f);
    const alto = Math.round(d.height * f);
    const cabe = Math.max(ancho, alto) <= ladoMaximoMapa();
    $("[data-mapa-ampliar-medida]").textContent = "Ahora mide " + d.width + " × " + d.height + " px; saldría de "
        + ancho + " × " + alto + "." + (cabe ? "" : " Es demasiado: como mucho " + ladoMaximoMapa() + " de lado.");
    $("[data-mapa-ampliar]").disabled = !cabe;
}

function cambiarMundoAMano() {
    const d = estadoMapa.datos;
    const x = parseFloat($("#mapa-mundo-x").value);
    const y = parseFloat($("#mapa-mundo-y").value);
    const w = parseFloat($("#mapa-mundo-w").value);
    if (![x, y, w].every(Number.isFinite) || w <= 0) {
        return;
    }
    apuntarPaso("mundo");
    d.world = { map: (ayudasDeMapas && ayudasDeMapas.mapamundi && ayudasDeMapas.mapamundi.archivo)
        || (d.world && d.world.map) || "Mapamundi de Cralëa.cmap",
    x, y, w, h: Math.round(w * d.height / d.width * 10) / 10 };
    pintarMundoDelMapa(true);
}

async function buscarEnElMapamundi() {
    const boton = $("[data-mapa-mundo-buscar]");
    boton.disabled = true;
    avisarEditor("Buscándolo en el mapamundi…");
    const r = await pedirEditor("/api/mapa/situar", { mapa: estadoMapa.archivo, imagen: estadoMapa.datos.layers[0]
        && estadoMapa.datos.layers[0].image });
    boton.disabled = false;
    if (r.error) {
        avisarEditor(r.error, true);
        return;
    }
    apuntarPaso();
    estadoMapa.datos.world = r.world;
    pintarMundoDelMapa();
    avisarEditor("Encontrado en el mapamundi (" + r.seguridad + " puntos que coinciden). Recuerda guardar.");
}

async function ampliarImagenDelMapa(ancho, alto, ia, modelo) {
    const botones = [$("[data-mapa-ampliar]"), $("[data-mapa-mundo-escala]")];
    botones.forEach((b) => {
        b.disabled = true;
    });
    avisarEditor("Ampliando la imagen" + (ia ? " con IA" : "") + " a " + ancho + " × " + alto + "… (puede tardar un poco)");
    const hecha = await pedirEditor("/api/mapa/ampliar", { mapa: estadoMapa.archivo, ancho, alto, ia, modelo,
        imagen: estadoMapa.datos.layers[0] && estadoMapa.datos.layers[0].image });
    botones.forEach((b) => {
        b.disabled = false;
    });
    if (hecha.error) {
        avisarEditor(hecha.error, true);
        return;
    }
    const raro = pasarAImagenNueva(hecha);
    pintarMundoDelMapa();
    avisarEditor("Imagen ampliada" + (hecha.con_ia ? " con IA" : "") + ": " + hecha.nombre + " (" + hecha.ancho + " × "
        + hecha.alto + ")." + (hecha.aviso ? " " + hecha.aviso + "." : "") + raro + " Recuerda guardar.",
    !!raro || (ia && !hecha.con_ia));
}

function llevarAEscalaComun() {
    const comun = medidaComunMapa();
    if (comun) {
        ampliarImagenDelMapa(comun.ancho, comun.alto, $("#mapa-ampliar-ia").checked, $("#mapa-ampliar-modelo").value);
    }
}

async function ampliarElMapamundi(f, ia, modelo) {
    const boton = $("[data-mapa-ampliar]");
    boton.disabled = true;
    avisarEditor("Ampliando la imagen del mapamundi" + (ia ? " con IA" : "") + "… (puede tardar un poco)");
    const hecha = await pedirEditor("/api/mapa/ampliar", { mapa: estadoMapa.archivo, factor: f, ia, modelo,
        imagen: estadoMapa.datos.layers[0] && estadoMapa.datos.layers[0].image });
    boton.disabled = false;
    if (hecha.error) {
        avisarEditor(hecha.error, true);
        return;
    }
    apuntarPaso();
    estadoMapa.datos.layers[0].image = hecha.nombre;
    estadoMapa.imagenes[hecha.nombre] = hecha.url;
    pintarFondoMapa();
    avisarEditor("Imagen del mapamundi ampliada" + (hecha.con_ia ? " con IA" : "") + ": " + hecha.nombre + " ("
        + hecha.ancho + " × " + hecha.alto + "). Sus coordenadas no cambian." + (hecha.aviso ? " " + hecha.aviso + "." : "")
        + " Recuerda guardar.", ia && !hecha.con_ia);
}

function ampliarPorFactor() {
    const d = estadoMapa.datos;
    const f = Number($("#mapa-ampliar-cuanto").value) || 2;
    if (esElMapamundi()) {
        ampliarElMapamundi(f, $("#mapa-ampliar-ia").checked, $("#mapa-ampliar-modelo").value);
        return;
    }
    ampliarImagenDelMapa(Math.round(d.width * f), Math.round(d.height * f), $("#mapa-ampliar-ia").checked,
        $("#mapa-ampliar-modelo").value);
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
    const estilo = estiloDeLaRaya(l);
    const color = l.color || estilo.color;
    ctx.lineJoin = "round";
    if (l.kind === "rio" && l.taper !== false && !(l.dash && l.dash !== "solid")) {
        const tramos = tramosDeRio(puntos, 8, Number(l.width) > 0 ? Number(l.width) : 0);
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

// Un texto a lo largo de su curva, letra a letra: cada una en su punto de
// la curva y girada como va la curva ahí, centrado el conjunto (como el
// startOffset="50%" de la web). Primero todos los bordes y luego todas las
// letras, que si no el borde de una tapa a la de al lado.
function textoEnCurvaEnLienzo(ctx, t, fuente, tam) {
    const m = curvaSuaveMapa(t.points).muestras;
    const acumulado = largosMapa(m);
    const total = acumulado[acumulado.length - 1];
    ctx.save();
    ctx.font = fuente;
    if ("letterSpacing" in ctx) {
        ctx.letterSpacing = "0px";
    }
    const espacio = tam * 0.12;
    const letras = Array.from(t.label);
    const anchos = letras.map((l) => ctx.measureText(l).width + espacio);
    const todo = anchos.reduce((a, b) => a + b, 0);
    let s = total / 2 - todo / 2;
    const sitios = letras.map((l, n) => {
        const medio = s + anchos[n] / 2;
        s += anchos[n];
        return Object.assign({ l }, puntoALoLargo(m, acumulado, Math.max(0, Math.min(total, medio))));
    });
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = tam * 0.16;
    ctx.strokeStyle = "#1b1020";
    ctx.fillStyle = t.color || "#f4ecd8";
    ["stroke", "fill"].forEach((como) => {
        sitios.forEach((p) => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.giro * Math.PI / 180);
            if (como === "stroke") {
                ctx.strokeText(p.l, 0, 0);
            } else {
                ctx.fillText(p.l, 0, 0);
            }
            ctx.restore();
        });
    });
    ctx.restore();
}

// La rosa de los vientos en el lienzo (las mismas piezas que en el SVG).
function rosaEnLienzo(ctx, d) {
    const rincon = typeof d.compass === "string" ? d.compass : "";
    if (!/^(arriba|abajo)-(izquierda|derecha)$/.test(rincon)) {
        return;
    }
    const rosa = rosaDeLosVientos(rincon, d.width, d.height);
    ctx.save();
    ctx.translate(rosa.x, rosa.y);
    ctx.lineJoin = "round";
    rosa.piezas.forEach((p) => {
        ctx.globalAlpha = p.opacidad || 1;
        if (p.letra) {
            ctx.font = "700 " + Math.round(p.tam) + "px Georgia, serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = p.tam * 0.18;
            ctx.strokeStyle = "#1b1020";
            ctx.strokeText(p.letra, p.x, p.y);
            ctx.fillStyle = "#f4ecd8";
            ctx.fillText(p.letra, p.x, p.y);
            return;
        }
        ctx.beginPath();
        if (p.circulo) {
            ctx.arc(0, 0, p.circulo, 0, Math.PI * 2);
        } else {
            p.poligono.forEach((q, n) => (n ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
            ctx.closePath();
        }
        if (p.relleno) {
            ctx.fillStyle = p.relleno;
            ctx.fill();
        }
        if (p.raya) {
            ctx.strokeStyle = p.raya;
            ctx.lineWidth = p.grueso;
            ctx.stroke();
        }
    });
    ctx.restore();
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

// ---- QUÉ SALE EN LA IMAGEN DESCARGADA ----
// El panel «Descargar la imagen»: una casilla por cada cosa que tenga el
// mapa (cada capa del fondo, cada clase de región y de sitio, cada clase
// de raya, los puentes, los nombres, los textos, la escala) y la rosa en
// la esquina que se quiera. Cada casilla tiene su clave («sitio:pueblo»);
// en el navegador se recuerdan las que se QUITARON, así lo nuevo sale
// marcado. Y el recorte (entero o lo que se ve), el tamaño y el formato.
const GRUPOS_DE_RAYA_EN_DESCARGA = [
    ["caminos", "Caminos y senderos", ["camino", "sendero"]], ["rios", "Ríos", ["rio"]],
    ["fronteras", "Fronteras", ["frontera"]], ["maritimas", "Rutas marítimas", ["maritima"]],
    ["murallas", "Murallas", ["muralla"]], ["rutas", "Rutas de viaje", ["ruta"]],
];
const RINCONES_DE_ROSA = [["", "Sin rosa de los vientos"], ["arriba-izquierda", "Arriba a la izquierda"],
    ["arriba-derecha", "Arriba a la derecha"], ["abajo-izquierda", "Abajo a la izquierda"],
    ["abajo-derecha", "Abajo a la derecha"]];
const TOPE_DE_DESCARGA = 8192;
// La clase de cada cosa para las casillas (lo de un tipo que no se conoce,
// con lo «sin tipo»; una raya rara, con los caminos, como en la web).
const claveDeSitioEnDescarga = (p) => (tipoDeSitioMapa(p.kind) ? p.kind : "");
const claveDeRegionEnDescarga = (s) => (tipoDeZonaMapa(s.kind) ? s.kind : "");
const claveDeRayaEnDescarga = (l) => {
    const g = GRUPOS_DE_RAYA_EN_DESCARGA.find((x) => x[2].includes(l.kind)) || GRUPOS_DE_RAYA_EN_DESCARGA[0];
    return g[0];
};

function memoriaDeDescarga() {
    try {
        const m = JSON.parse(window.localStorage.getItem("mapa-descarga") || "{}");
        return m && typeof m === "object" ? m : {};
    } catch (error) {
        return {};
    }
}

function apuntarDescarga() {
    const quitadas = [...document.querySelectorAll("[data-descarga]")].filter((c) => !c.checked)
        .map((c) => c.getAttribute("data-descarga"));
    const viejas = memoriaDeDescarga().quitadas || [];
    // Las de otros mapas (que aquí no salen) se conservan.
    const aqui = new Set([...document.querySelectorAll("[data-descarga]")].map((c) => c.getAttribute("data-descarga")));
    const m = {
        quitadas: viejas.filter((k) => !aqui.has(k)).concat(quitadas),
        tamano: $("#mapa-descarga-tamano").value, formato: $("#mapa-descarga-formato").value,
        recorte: (document.querySelector('input[name="mapa-recorte"]:checked') || {}).value || "todo",
    };
    try {
        window.localStorage.setItem("mapa-descarga", JSON.stringify(m));
    } catch (error) {
        // Se recuerda mientras esté abierta la página.
    }
    pintarMedidaDeDescarga();
}

function pintarOpcionesDeDescarga() {
    const d = estadoMapa.datos;
    const caja = $("[data-mapa-descarga-opciones]");
    if (!d || !caja) {
        return;
    }
    const memoria = memoriaDeDescarga();
    const quitadas = new Set(memoria.quitadas || []);
    caja.textContent = "";
    let n = 0;
    const grupo = (titulo) => {
        const fs = document.createElement("fieldset");
        fs.className = "opciones campo mapa-descarga-grupo";
        const lg = document.createElement("legend");
        lg.textContent = titulo;
        fs.appendChild(lg);
        caja.appendChild(fs);
        return fs;
    };
    const casilla = (dentro, clave, texto, cuantas, deSalida) => {
        const label = document.createElement("label");
        label.className = "opcion";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.id = "mapa-descarga-" + (n += 1);
        input.setAttribute("data-descarga", clave);
        input.checked = deSalida === false ? false : !quitadas.has(clave);
        label.appendChild(input);
        label.appendChild(document.createTextNode(" " + texto + (cuantas ? " (" + cuantas + ")" : "")));
        dentro.appendChild(label);
    };
    const contar = (lista, clave) => {
        const cuenta = new Map();
        lista.forEach((c) => cuenta.set(clave(c), (cuenta.get(clave(c)) || 0) + 1));
        return cuenta;
    };

    if (d.layers.length) {
        const g = grupo("El fondo");
        d.layers.forEach((c, i) => {
            const nombre = c.name || c.title || (d.layers.length === 1 ? "La imagen del mapa" : "Capa " + (i + 1));
            casilla(g, "fondo:" + (c.id || i), nombre, 0, estadoMapa.capasOcultas[c.id] ? false : undefined);
        });
    }
    if (d.shapes.length) {
        const g = grupo("Regiones");
        contar(d.shapes, claveDeRegionEnDescarga).forEach((cuantas, kind) => {
            const zona = tipoDeZonaMapa(kind);
            casilla(g, "region:" + kind, zona ? zona[1] : "Regiones sin tipo (países, comarcas…)", cuantas);
        });
        if (d.shapes.some((s) => s.label)) {
            casilla(g, "nombres-regiones", "Sus nombres");
        }
    }
    if (d.lines.length) {
        const g = grupo("Rayas");
        GRUPOS_DE_RAYA_EN_DESCARGA.forEach(([clave, texto, kinds]) => {
            const cuantas = d.lines.filter((l) => claveDeRayaEnDescarga(l) === clave).length;
            if (cuantas) {
                casilla(g, "raya:" + clave, texto, cuantas);
            }
        });
        const puentes = puentesDelMapa(d.lines).length;
        if (puentes) {
            casilla(g, "puentes", "Puentes", puentes);
        }
    }
    const sitios = d.pins.concat(d.emblems);
    if (sitios.length) {
        const g = grupo("Sitios");
        const cuenta = contar(sitios, claveDeSitioEnDescarga);
        // En el orden de la lista de tipos (capital, ciudad, pueblo…).
        TIPOS_DE_SITIO.map((x) => x[0]).concat([""]).filter((k) => cuenta.has(k)).forEach((kind) => {
            const tipo = tipoDeSitioMapa(kind);
            casilla(g, "sitio:" + kind, tipo ? tipo[2] + " " + tipo[1] : "Sin tipo", cuenta.get(kind));
        });
        if (sitios.some((p) => p.label)) {
            casilla(g, "nombres-sitios", "Sus nombres");
        }
    }
    const g = grupo("Lo demás");
    if (d.labels.some((x) => x.label)) {
        casilla(g, "textos", "Los textos sueltos (mares, cordilleras…)", d.labels.filter((x) => x.label).length);
    }
    if (d.scale && d.scale.pixels && d.scale.distance) {
        casilla(g, "escala", "La barra de escala");
    }
    const campo = document.createElement("div");
    campo.className = "campo";
    const etiqueta = document.createElement("label");
    etiqueta.setAttribute("for", "mapa-descarga-rosa");
    etiqueta.textContent = "Rosa de los vientos";
    const rosa = document.createElement("select");
    rosa.id = "mapa-descarga-rosa";
    opcionesMapa(rosa, RINCONES_DE_ROSA, false);
    rosa.value = typeof d.compass === "string" ? d.compass : "";
    campo.appendChild(etiqueta);
    campo.appendChild(rosa);
    g.appendChild(campo);

    $("#mapa-descarga-tamano").value = memoria.tamano || "1";
    $("#mapa-descarga-formato").value = memoria.formato || "png";
    const recorte = document.querySelector('input[name="mapa-recorte"][value="' + (memoria.recorte || "todo") + '"]');
    if (recorte) {
        recorte.checked = true;
    }
    caja.querySelectorAll("[data-descarga]").forEach((c) => c.addEventListener("change", apuntarDescarga));
    pintarMedidaDeDescarga();
}

// El trozo del mapa que sale (en unidades del mapa): entero, o lo que se
// ve en pantalla sin salirse del mapa.
function marcoDeDescarga() {
    const d = estadoMapa.datos;
    const vista = (document.querySelector('input[name="mapa-recorte"]:checked') || {}).value === "vista";
    const v = estadoMapa.vista;
    if (!vista || !v) {
        return { x: 0, y: 0, w: d.width, h: d.height };
    }
    const x1 = Math.max(0, v.x);
    const y1 = Math.max(0, v.y);
    const x2 = Math.min(d.width, v.x + v.w);
    const y2 = Math.min(d.height, v.y + v.h);
    if (x2 - x1 < 1 || y2 - y1 < 1) {
        return { x: 0, y: 0, w: d.width, h: d.height };
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function escalaDeDescarga(marco) {
    const pedido = Number($("#mapa-descarga-tamano").value) || 1;
    return Math.min(pedido, TOPE_DE_DESCARGA / Math.max(marco.w, marco.h));
}

function pintarMedidaDeDescarga() {
    const caja = $("[data-mapa-descarga-medida]");
    if (!caja || !estadoMapa.datos) {
        return;
    }
    const marco = marcoDeDescarga();
    const f = escalaDeDescarga(marco);
    const pedido = Number($("#mapa-descarga-tamano").value) || 1;
    caja.textContent = "Saldrá de " + Math.round(marco.w * f) + " × " + Math.round(marco.h * f) + " píxeles"
        + (f < pedido ? " (lo más grande que se puede: " + TOPE_DE_DESCARGA + " de lado)." : ".");
}

async function descargarImagenMapa() {
    const d = estadoMapa.datos;
    if (!d) {
        return;
    }
    if (!document.querySelector("[data-descarga]")) {
        pintarOpcionesDeDescarga();
    }
    const marcadas = new Set([...document.querySelectorAll("[data-descarga]")].filter((c) => c.checked)
        .map((c) => c.getAttribute("data-descarga")));
    const ve = (clave) => marcadas.has(clave);
    const rayaSeVe = (l) => ve("raya:" + claveDeRayaEnDescarga(l));
    const sitioSeVe = (p) => ve("sitio:" + claveDeSitioEnDescarga(p));
    const regionSeVe = (s) => ve("region:" + claveDeRegionEnDescarga(s));
    const rincon = ($("#mapa-descarga-rosa") || {}).value || "";
    const formato = $("#mapa-descarga-formato").value || "png";
    avisarEditor("Preparando la imagen…");
    // El lienzo, del tamaño del trozo que sale por el tamaño pedido (con un
    // tope: un PNG de más de 8000 px no lo abre casi nada).
    const marco = marcoDeDescarga();
    const f = escalaDeDescarga(marco);
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.round(marco.w * f));
    lienzo.height = Math.max(1, Math.round(marco.h * f));
    const ctx = lienzo.getContext("2d");
    ctx.scale(f, f);
    ctx.translate(-marco.x, -marco.y);
    // Lo que en pantalla mide «un píxel», aquí mide k: un mapa de 1400 px
    // lleva las rayas y los sitios como se ven en el editor al verlo entero.
    const k = Math.max(d.width, d.height) / 1400;

    ctx.fillStyle = "#241a2e";
    ctx.fillRect(0, 0, d.width, d.height);
    const capas = d.layers.slice().sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0));
    for (const c of capas) {
        const url = estadoMapa.imagenes[c.image];
        if (!url || !ve("fondo:" + (c.id || d.layers.indexOf(c)))) {
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

    // Las tramas de las clases de zona que hay, hechas imagen para repetirlas.
    const tramas = {};
    const lado = ladoDeTrama();
    for (const z of TIPOS_DE_ZONA) {
        if (z[0] === "provincia" || !d.shapes.some((s) => s.kind === z[0] && regionSeVe(s))) {
            continue;
        }
        const dibujoTrama = '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.ceil(lado) + '" height="'
            + Math.ceil(lado) + '" viewBox="0 0 ' + lado + " " + lado + '">' + tramaDeZona(z[0], lado) + "</svg>";
        const img = await cargarImagenMapa("data:image/svg+xml;charset=utf-8," + encodeURIComponent(dibujoTrama));
        if (img) {
            tramas[z[0]] = ctx.createPattern(img, "repeat");
        }
    }

    // Las regiones, de la más grande a la más pequeña (las de dentro, encima).
    regionesDeGrandeAPequena().map((i) => d.shapes[i]).forEach((s) => {
        const puntos = s.points || [];
        if (puntos.length < 3 || !regionSeVe(s)) {
            return;
        }
        const zona = tipoDeZonaMapa(s.kind);
        const color = s.color || (zona ? zona[2] : "#f5ce6c");
        rayaEnLienzo(ctx, puntos, k);
        ctx.closePath();
        ctx.globalAlpha = zona ? Math.max(0.12, OPACIDAD_DE_ZONA[zona[0]]) : (s.label || s.targetPage ? 0.35 : 0.18);
        ctx.fillStyle = color;
        ctx.fill();
        if (zona && tramas[zona[0]]) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = tramas[zona[0]];
            ctx.fill();
        }
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * k;
        ctx.setLineDash(zona && (zona[0] === "vecino" || zona[0] === "provincia") ? [12 * k, 7 * k] : []);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
    });

    // Las rayas.
    const rayas = d.lines.filter(rayaSeVe);
    rayas.forEach((l) => pintarRayaEnLienzo(ctx, l, k));
    if (ve("puentes")) {
        // Con los caminos y los ríos que salen: sin el río, no hay puente.
        puentesEnLienzo(ctx, { lines: rayas }, k);
    }
    const textos = ve("textos") ? d.labels : [];

    // Las letras de los textos, cargadas antes de pintar (si no, el lienzo
    // las pinta con la de recambio).
    const fuenteDe = (t) => (t.italic === false ? "" : "italic ") + letraDeTexto(t)[3] + " "
        + Math.round(tamanoDeTexto(t)) + "px " + letraDeTexto(t)[2];
    try {
        await Promise.all(textos.filter((t) => t.label).map((t) => document.fonts.load(fuenteDe(t), t.label)));
    } catch (error) {
        // Sin las letras se pinta con las del sistema: no es motivo para no descargar.
    }
    // Los textos sueltos, del tamaño del mapa y girados.
    textos.forEach((t) => {
        if (!t.label) {
            return;
        }
        const tam = tamanoDeTexto(t);
        if (tieneCurva(t)) {
            textoEnCurvaEnLienzo(ctx, t, fuenteDe(t), tam);
            return;
        }
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate((t.angle || 0) * Math.PI / 180);
        ctx.font = fuenteDe(t);
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
    const conNombre = ve("nombres-sitios");
    const sitiosQueSalen = d.pins.filter(sitioSeVe);
    const ocupado = sitiosQueSalen.map((p) => {
        ctx.font = "700 " + Math.round(15 * k) + 'px "Space Grotesk", system-ui, sans-serif';
        const ancho = p.label && conNombre ? ctx.measureText(p.label).width + 22 * k : 0;
        return { x1: p.x - 14 * k, x2: p.x + 14 * k + ancho, y1: p.y - 14 * k, y2: p.y + 14 * k };
    });
    d.shapes.forEach((s) => {
        if (!ve("nombres-regiones") || !regionSeVe(s) || !s.label || (s.points || []).length < 3) {
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

    // Los sitios que se ven como emblema (y los emblemas sueltos de antes):
    // la imagen recortada con su forma (o el símbolo de su tipo), el marco
    // dorado y el nombre debajo.
    for (const em of d.emblems.filter(sitioSeVe).concat(sitiosQueSalen.filter((p) => p.shape))) {
        const r = radioDeEmblema(em) * k;
        const forma = new Path2D(formaDeEmblema(em.shape, r, em.kind).d);
        const bajo = formaDeEmblema(em.shape, r, em.kind).bajo;
        ctx.save();
        ctx.translate(em.x, em.y);
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 4 * k;
        const tipoEm = tipoDeSitioMapa(em.kind);
        ctx.fillStyle = em.color || (tipoEm ? tipoEm[3] : "#8e1b3b");
        ctx.fill(forma);
        ctx.shadowColor = "transparent";
        const url = em.image ? estadoMapa.imagenes[em.image] : "";
        const img = url ? await cargarImagenMapa(url) : null;
        if (img) {
            ctx.save();
            ctx.clip(forma);
            // «slice»: que llene la forma entera, recortando lo que sobre.
            const lado = 2.8 * r;
            const f2 = Math.max(lado / img.width, lado / img.height);
            ctx.drawImage(img, -img.width * f2 / 2, -img.height * f2 / 2, img.width * f2, img.height * f2);
            ctx.restore();
        } else if (tipoEm) {
            ctx.fillStyle = "#1b1020";
            ctx.font = "700 " + Math.round(r * 1.05) + "px " + LETRA_DE_SIMBOLOS;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(tipoEm[2] + "\uFE0E", 0, r * 0.05);
        }
        ctx.lineJoin = "round";
        ctx.lineWidth = 2.5 * k;
        ctx.strokeStyle = "#d8b25a";
        ctx.stroke(forma);
        ctx.restore();
        if (em.label && conNombre) {
            letreroMapa(ctx, em.label, em.x, em.y + bajo + 12 * k, k, 15, "center");
        }
    }

    // Los sitios: su símbolo y su nombre a la derecha.
    sitiosQueSalen.filter((p) => !p.shape).forEach((p) => {
        const tipo = tipoDeSitioMapa(p.kind);
        const r = 12 * k;
        ctx.fillStyle = p.color || (tipo ? tipo[3] : "#e74c3c");
        ctx.strokeStyle = "#1b1020";
        ctx.lineWidth = 2.5 * k;
        ctx.setLineDash(p.kind === "ruina" ? [4 * k, 3 * k] : []);
        const bola = bolaDeSitio(p.kind, r);
        if (bola) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.lineJoin = "round";
            const camino = new Path2D(bola);
            ctx.fill(camino);
            ctx.stroke(camino);
            ctx.restore();
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.setLineDash([]);
        const simbolo = tipo ? tipo[2] + "︎" : (p.icon || "");
        if (simbolo) {
            ctx.fillStyle = "#1b1020";
            ctx.font = "700 " + Math.round(13 * k) + "px " + LETRA_DE_SIMBOLOS;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(simbolo, p.x, p.y + k);
        }
        if (p.label && conNombre) {
            letreroMapa(ctx, p.label, p.x + r + 5 * k, p.y, k, 15);
        }
    });

    // La escala y la rosa, en las esquinas de lo que sale (si es un
    // recorte, en las suyas, no en las del mapa entero).
    const enElMarco = Object.assign({}, d, { width: marco.w, height: marco.h, compass: rincon });
    ctx.save();
    ctx.translate(marco.x, marco.y);
    if (ve("escala")) {
        barraDeEscalaEnLienzo(ctx, enElMarco, k);
    }
    rosaEnLienzo(ctx, enElMarco);
    ctx.restore();

    const tipos = { png: ["image/png", "png"], jpeg: ["image/jpeg", "jpg"], webp: ["image/webp", "webp"] };
    const [mime, extension] = tipos[formato] || tipos.png;
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
        enlace.download = nombre + "." + extension;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(enlace.href), 10000);
        avisarEditor("Imagen descargada: " + nombre + "." + extension + " (" + lienzo.width + " × " + lienzo.height
            + " px). Va con lo que hay ahora en el editor, esté guardado o no.");
    }, mime, 0.92);
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
    if (!datos.emblems.length) {
        delete datos.emblems;
    }
    const hecho = await pedirEditor("/api/mapa/guardar", { archivo: estadoMapa.archivo, datos });
    if (hecho.error) {
        avisarEditor(hecho.error, true);
    } else {
        estadoMapa.cambiado = false;
        if (!yPasar) {
            avisarEditor("Guardado en wiki/" + estadoMapa.archivo + ".");
        } else {
            const pasado = await pasarALaWebEditor({ mapa: estadoMapa.archivo });
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

// ---- LOS PANELES ----
// Flotan encima del mapa; cada pestaña de arriba abre y cierra el suyo (un
// botón que se queda apretado, aria-expanded), y la × o Esc dentro de él lo
// cierran. Se recuerda en el navegador cuáles estaban abiertos; los que se
// abren solos (lo elegido al elegir algo, las herramientas al medir) no
// cuentan para eso.
const PANELES_DE_SALIDA = { herramientas: true };
let panelesAbiertos = Object.assign({}, PANELES_DE_SALIDA);
try {
    const guardados = JSON.parse(window.localStorage.getItem("mapa-paneles") || "null");
    if (guardados && typeof guardados === "object") {
        panelesAbiertos = guardados;
    }
} catch (error) {
    // Sin almacenamiento: los de salida.
}

function abrirPanelMapa(clave, abrir, solo) {
    const panel = document.querySelector('[data-mapa-panel="' + clave + '"]');
    const pestana = document.querySelector('[data-mapa-pestana="' + clave + '"]');
    if (!panel || !pestana) {
        return;
    }
    panel.hidden = !abrir;
    pestana.setAttribute("aria-expanded", abrir ? "true" : "false");
    if (abrir) {
        colocarPanelMapa(panel);
    }
    if (abrir && clave === "repaso" && estadoMapa.datos) {
        pintarRepasoMapa();
    }
    if (abrir && clave === "descargar" && estadoMapa.datos) {
        pintarOpcionesDeDescarga();
    }
    // En una pantalla estrecha no caben dos: se abre uno y se cierran los
    // demás (sin olvidar cuáles se tenían abiertos en la grande).
    if (abrir && window.innerWidth < 768) {
        document.querySelectorAll("[data-mapa-panel]").forEach((otro) => {
            const suya = otro.getAttribute("data-mapa-panel");
            if (suya !== clave && !otro.hidden) {
                abrirPanelMapa(suya, false, true);
            }
        });
    }
    if (solo) {
        return;
    }
    panelesAbiertos[clave] = abrir;
    try {
        window.localStorage.setItem("mapa-paneles", JSON.stringify(panelesAbiertos));
    } catch (error) {
        // Se recuerda mientras esté abierta la página.
    }
}

// MOVER LOS PANELES, como en el mapa de la web: se arrastran por la
// cabecera (con el ratón o el dedo) o, desde su asa (⠿), con las flechas
// (Mayús: más deprisa). Uno movido se queda «suelto» (es-suelto: fixed, en
// su sitio, fuera de la columna) y se recuerda dónde; Inicio en el asa o dos
// clics en la cabecera lo devuelven a su columna, y «Paneles a su sitio»
// todos. En una pantalla estrecha no se mueven: van en su columna.
const MEMORIA_DE_SITIOS_DE_PANELES = "mapa-paneles-sitios";
let sitiosDePaneles = {};
try {
    const guardados = JSON.parse(window.localStorage.getItem(MEMORIA_DE_SITIOS_DE_PANELES) || "null");
    if (guardados && typeof guardados === "object") {
        sitiosDePaneles = guardados;
    }
} catch (error) {
    // Sin almacenamiento: todos en su columna.
}
let panelesDelante = 1;

function pantallaEstrechaMapa() {
    return window.innerWidth < 768;
}

function apuntarSitiosDePaneles() {
    try {
        window.localStorage.setItem(MEMORIA_DE_SITIOS_DE_PANELES, JSON.stringify(sitiosDePaneles));
    } catch (error) {
        // Se recuerda mientras esté abierta la página.
    }
    const boton = $("[data-mapa-recolocar]");
    if (boton) {
        boton.hidden = !Object.keys(sitiosDePaneles).length;
    }
}

// Lo de arriba y abajo que no se debe tapar: la cabecera de un panel no
// sube de las pastillas ni baja tanto que no se pueda volver a coger.
function limitesDePanelesMapa() {
    const arriba = $("[data-mapa-arriba]").getBoundingClientRect().bottom;
    const barra = $("[data-barra-mapa]");
    const abajo = barra && !barra.hidden ? barra.getBoundingClientRect().top : window.innerHeight;
    return { arriba, abajo };
}

function ponerPanelSueltoMapa(panel, x, y) {
    const limites = limitesDePanelesMapa();
    const nx = Math.min(Math.max(6, x), Math.max(6, window.innerWidth - panel.offsetWidth - 6));
    const ny = Math.min(Math.max(limites.arriba + 6, y), Math.max(limites.arriba + 6, limites.abajo - 70));
    panel.style.left = Math.round(nx) + "px";
    panel.style.top = Math.round(ny) + "px";
    panel.style.maxHeight = Math.max(120, limites.abajo - ny - 10) + "px";
    return { x: Math.round(nx), y: Math.round(ny) };
}

function traerDelanteMapa(panel) {
    document.querySelectorAll(".mapa-columna").forEach((c) => c.classList.toggle("es-delante", c.contains(panel)));
    panelesDelante += 1;
    panel.style.zIndex = String(panelesDelante);
}

function colocarPanelMapa(panel) {
    const sitio = sitiosDePaneles[panel.getAttribute("data-mapa-panel")];
    if (!sitio || pantallaEstrechaMapa() || !Number.isFinite(sitio.x) || !Number.isFinite(sitio.y)) {
        panel.classList.remove("es-suelto");
        panel.style.left = "";
        panel.style.top = "";
        panel.style.maxHeight = "";
        return;
    }
    panel.classList.add("es-suelto");
    if (!panel.hidden) {
        ponerPanelSueltoMapa(panel, sitio.x, sitio.y);
    }
}

function devolverPanelMapa(panel) {
    delete sitiosDePaneles[panel.getAttribute("data-mapa-panel")];
    apuntarSitiosDePaneles();
    colocarPanelMapa(panel);
}

function hacerPanelMovibleMapa(panel) {
    const clave = panel.getAttribute("data-mapa-panel");
    const cabeza = panel.querySelector(".mapa-panel-cabeza");
    const titulo = cabeza.querySelector("h2").textContent.trim();
    const asa = document.createElement("button");
    asa.type = "button";
    asa.className = "mapa-panel-asa";
    asa.setAttribute("aria-label", "Mover el panel «" + titulo + "» (arrástralo, o con las flechas; Inicio lo devuelve a su sitio)");
    asa.title = "Arrastra para moverlo (dos clics: a su sitio)";
    asa.textContent = "⠿";
    cabeza.insertBefore(asa, cabeza.firstChild);
    // Lo de dentro, en su propia caja que se desplaza: la cabecera (para
    // moverlo y cerrarlo) se queda siempre a la vista.
    const cuerpo = document.createElement("div");
    cuerpo.className = "mapa-panel-cuerpo";
    [...panel.childNodes].filter((hijo) => hijo !== cabeza).forEach((hijo) => cuerpo.appendChild(hijo));
    panel.appendChild(cuerpo);

    const mover = (x, y) => {
        if (!panel.classList.contains("es-suelto")) {
            // Sale de la columna justo donde estaba (x, y: su esquina).
            panel.classList.add("es-suelto");
        }
        sitiosDePaneles[clave] = ponerPanelSueltoMapa(panel, x, y);
    };
    let arrastre = null;
    cabeza.addEventListener("pointerdown", (evento) => {
        traerDelanteMapa(panel);
        if (evento.button !== 0 || evento.target.closest(".mapa-panel-cerrar") || pantallaEstrechaMapa()) {
            return;
        }
        const r = panel.getBoundingClientRect();
        arrastre = { id: evento.pointerId, x: evento.clientX, y: evento.clientY, desdeX: r.left, desdeY: r.top, movido: false };
        try {
            cabeza.setPointerCapture(evento.pointerId);
        } catch (error) {
            // Sin captura se arrastra igual mientras el puntero esté encima.
        }
        evento.preventDefault();
    });
    cabeza.addEventListener("pointermove", (evento) => {
        if (!arrastre || evento.pointerId !== arrastre.id) {
            return;
        }
        const dx = evento.clientX - arrastre.x;
        const dy = evento.clientY - arrastre.y;
        // Un clic que tiembla un poco no lo saca de su columna.
        if (!arrastre.movido && Math.abs(dx) + Math.abs(dy) < 4) {
            return;
        }
        arrastre.movido = true;
        panel.classList.add("se-esta-moviendo");
        mover(arrastre.desdeX + dx, arrastre.desdeY + dy);
    });
    const soltar = () => {
        if (!arrastre) {
            return;
        }
        if (arrastre.movido) {
            apuntarSitiosDePaneles();
        }
        arrastre = null;
        panel.classList.remove("se-esta-moviendo");
    };
    cabeza.addEventListener("pointerup", soltar);
    cabeza.addEventListener("pointercancel", soltar);
    cabeza.addEventListener("dblclick", (evento) => {
        if (!evento.target.closest(".mapa-panel-cerrar")) {
            devolverPanelMapa(panel);
        }
    });
    asa.addEventListener("keydown", (evento) => {
        if (pantallaEstrechaMapa()) {
            return;
        }
        if (evento.key === "Home") {
            evento.preventDefault();
            devolverPanelMapa(panel);
            asa.focus();
            return;
        }
        const flechas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (!flechas[evento.key]) {
            return;
        }
        evento.preventDefault();
        evento.stopPropagation();
        traerDelanteMapa(panel);
        const paso = evento.shiftKey ? 60 : 20;
        const r = panel.getBoundingClientRect();
        mover(r.left + flechas[evento.key][0] * paso, r.top + flechas[evento.key][1] * paso);
        apuntarSitiosDePaneles();
    });
}

function empezarPanelesMapa() {
    document.querySelectorAll("[data-mapa-panel]").forEach(hacerPanelMovibleMapa);
    apuntarSitiosDePaneles();
    $("[data-mapa-recolocar]").addEventListener("click", () => {
        sitiosDePaneles = {};
        apuntarSitiosDePaneles();
        document.querySelectorAll("[data-mapa-panel]").forEach(colocarPanelMapa);
        $("[data-mapa-pestana=\"herramientas\"]").focus();
    });
    // Al cambiar el tamaño de la ventana, los sueltos se quedan dentro (o
    // vuelven a su columna si la pantalla se ha quedado estrecha).
    window.addEventListener("resize", () => document.querySelectorAll("[data-mapa-panel]").forEach(colocarPanelMapa));
    document.querySelectorAll("[data-mapa-pestana]").forEach((b) => {
        const clave = b.getAttribute("data-mapa-pestana");
        abrirPanelMapa(clave, !!panelesAbiertos[clave] && (window.innerWidth >= 768 || clave === "herramientas"), true);
        b.addEventListener("click", () => abrirPanelMapa(clave, b.getAttribute("aria-expanded") !== "true"));
    });
    document.querySelectorAll("[data-mapa-cerrar]").forEach((b) => {
        b.addEventListener("click", () => {
            const clave = b.getAttribute("data-mapa-cerrar");
            abrirPanelMapa(clave, false);
            document.querySelector('[data-mapa-pestana="' + clave + '"]').focus();
        });
    });
    document.querySelectorAll("[data-mapa-panel]").forEach((panel) => {
        panel.addEventListener("keydown", (e) => {
            if (e.key !== "Escape" || e.defaultPrevented) {
                return;
            }
            e.preventDefault();
            const clave = panel.getAttribute("data-mapa-panel");
            abrirPanelMapa(clave, false);
            document.querySelector('[data-mapa-pestana="' + clave + '"]').focus();
        });
    });
    // Lo que mide la barra de arriba (crece si no cabe en una fila), para el
    // mapa y los paneles.
    const arriba = $("[data-mapa-arriba]");
    const apuntarArriba = () => {
        if (arriba.offsetHeight) {
            document.documentElement.style.setProperty("--alto-arriba", arriba.offsetHeight + "px");
        }
    };
    if (window.ResizeObserver) {
        new ResizeObserver(apuntarArriba).observe(arriba);
        // Si el mapa cambia de tamaño (la barra de arriba o la de abajo
        // crecen), la vista se rehace con el mismo zoom.
        new ResizeObserver(() => {
            if (estadoMapa.vista && lienzoMapa().clientWidth) {
                ponerVistaMapa(estadoMapa.vista);
            }
        }).observe(lienzoMapa());
    }
    window.addEventListener("resize", apuntarArriba);
}

function empezarMapas() {
    empezarPanelesMapa();
    opcionesMapa($("[data-mapa-tipos-pin]"), TIPOS_DE_SITIO, true);
    $("[data-mapa-tipos-pin]").value = "ciudad";
    opcionesMapa($("[data-mapa-tipos-raya]"), TIPOS_DE_RAYA, false);
    opcionesMapa($("[data-mapa-tipos-zona]"), [["", "Una región sin más"]].concat(TIPOS_DE_ZONA), false);
    // Lo elegido, cuando son varias: «como estén» y las opciones de siempre.
    const comoEsten = [["*", "— como estén —"]];
    opcionesMapa($("#mapa-v-tipo"), comoEsten.concat([["", "Sin tipo (chincheta redonda)"]],
        TIPOS_DE_SITIO.map((x) => [x[0], x[2] + " " + x[1]])), false);
    opcionesMapa($("#mapa-v-forma"), comoEsten.concat(FORMAS_DE_EMBLEMA), false);
    opcionesMapa($("#mapa-v-tamano"), TAMANOS_DE_EMBLEMA, false);
    opcionesMapa($("#mapa-v-raya"), TIPOS_DE_RAYA, false);
    opcionesMapa($("#mapa-v-zona"), comoEsten.concat([["", "Una región sin más"]], TIPOS_DE_ZONA), false);
    document.querySelectorAll("[data-mapa-v]").forEach((s) => {
        s.addEventListener("change", () => cambiarVariosMapa(s.getAttribute("data-mapa-v"), s.value));
    });
    $("[data-mapa-v-color]").addEventListener("click", () => colorDeVariosMapa(true));
    $("[data-mapa-v-sin-color]").addEventListener("click", () => colorDeVariosMapa(false));
    $("[data-mapa-v-duplicar]").addEventListener("click", duplicarElegidos);
    $("[data-mapa-v-borrar]").addEventListener("click", borrarElegidos);
    $("[data-mapa-curva-dibujar]").addEventListener("click", dibujarCurvaDelTexto);
    $("[data-mapa-color-olvidar]").addEventListener("click", () => {
        apuntarColorNuevo(LISTA_DE_HERRAMIENTA[estadoMapa.herramienta], "");
        avisarEditor("Lo nuevo vuelve a salir del color de su tipo.");
    });
    $("[data-mapa-curva-quitar]").addEventListener("click", quitarCurvaDelTexto);
    $("#mapa-curva-nueva").addEventListener("change", () => ponerHerramienta(estadoMapa.herramienta));
    document.querySelectorAll("[data-mapa-letras]").forEach((s) => opcionesMapa(s, LETRAS_DE_TEXTO, false));
    document.querySelectorAll("[data-mapa-formas-emblema]").forEach((s) => opcionesMapa(s, FORMAS_DE_EMBLEMA, false));
    document.querySelectorAll("[data-mapa-tamanos-emblema]").forEach((s) => {
        opcionesMapa(s, TAMANOS_DE_EMBLEMA, false);
        s.value = "mediano";
    });
    $("#mapa-p-imagen-subir").addEventListener("change", (e) => subirImagenDeEmblema(e.target));
    $("#mapa-forma-nueva").addEventListener("change", pintarOpcionesDeSitio);
    $("[data-mapa-emblema-pagina]").addEventListener("click", usarImagenDeLaPagina);
    $("[data-mapa-escala-otro]").addEventListener("click", empezarOtraMedida);
    $("[data-mapa-quitar-pines-puente]").addEventListener("click", quitarPinesDePuente);
    document.querySelectorAll("[data-mapa-modelos]").forEach((s) => opcionesMapa(s, MODELOS_DE_IMAGEN, false));
    $("[data-mapa-mundo-buscar]").addEventListener("click", buscarEnElMapamundi);
    $("[data-mapa-mundo-escala]").addEventListener("click", llevarAEscalaComun);
    $("[data-mapa-ampliar]").addEventListener("click", ampliarPorFactor);
    $("#mapa-ampliar-cuanto").addEventListener("change", pintarMedidaDeAmpliar);
    document.querySelectorAll("[data-mapa-mundo]").forEach((c) => {
        c.addEventListener("input", cambiarMundoAMano);
        c.addEventListener("blur", () => {
            estadoMapa.ultimoCampo = null;
        });
    });
    cargarAyudasDeMapas();
    // La barra de abajo crece con los avisos: lo que mide se apunta en
    // --alto-barra (hasta ahí llegan el mapa y los paneles).
    const barra = $("[data-barra-mapa]");
    const apuntarAlto = () => document.documentElement.style.setProperty("--alto-barra", barra.offsetHeight + "px");
    if (window.ResizeObserver) {
        new ResizeObserver(apuntarAlto).observe(barra);
    }
    window.addEventListener("resize", apuntarAlto);

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
        acabarPaneo();
    });
    // El botón de en medio no hace lo suyo del navegador (en Windows, la
    // flecha de desplazarse sola; en Linux, pegar) ni se lleva el foco.
    window.addEventListener("pointerup", (e) => {
        if (estadoMapa.paneo && !(e.buttons & 4)) {
            acabarPaneo(e);
        }
    });
    lienzoMapa().addEventListener("mousedown", (e) => {
        if (e.button === 1) {
            e.preventDefault();
        }
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
            if (que === "con-color" || que === "taper" || que === "italic") {
                cambiarPropiedadMapa(que, campo.checked);
            } else {
                cambiarPropiedadMapa(que, ["x", "y", "angle", "fontSize", "width", "gap"].includes(que)
                    ? campo.value : campo.value.trim());
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
            if (que === "compass") {
                pintarRosaMapa();
            }
        });
        campo.addEventListener("blur", () => {
            estadoMapa.ultimoCampo = null;
        });
    });
    $("#mapa-otra-imagen").addEventListener("change", (e) => cambiarImagenMapa(e.target));

    $("[data-mapa-guardar]").addEventListener("click", () => guardarMapa(false));
    $("[data-mapa-descargar]").addEventListener("click", descargarImagenMapa);
    document.querySelectorAll("[data-mapa-descarga-todo]").forEach((b) => b.addEventListener("click", () => {
        const si = b.getAttribute("data-mapa-descarga-todo") === "1";
        document.querySelectorAll("[data-descarga]").forEach((c) => {
            c.checked = si;
        });
        apuntarDescarga();
    }));
    ["#mapa-descarga-tamano", "#mapa-descarga-formato"].forEach((s) => $(s).addEventListener("change", apuntarDescarga));
    document.querySelectorAll('input[name="mapa-recorte"]').forEach((r) => r.addEventListener("change", apuntarDescarga));
    $("[data-mapa-pasar]").addEventListener("click", () => guardarMapa(true));
    document.addEventListener("keydown", (e) => {
        if ($('[data-vista="mapa"]').hidden || !(e.ctrlKey || e.metaKey)) {
            return;
        }
        const tecla = e.key.toLowerCase();
        if (tecla === "s") {
            e.preventDefault();
            guardarMapa(false);
        } else if ((tecla === "c" || tecla === "v" || tecla === "d") && !escribiendoEnUnaCasilla()
            && !(window.getSelection && String(window.getSelection()))) {
            // Copiar, pegar y duplicar lo elegido (fuera de las casillas: ahí
            // son los del navegador).
            if (tecla === "c" && !listaDeElegidos().length) {
                return;
            }
            e.preventDefault();
            if (tecla === "c") {
                copiarElegidos();
            } else if (tecla === "v") {
                pegarMapa();
            } else {
                duplicarElegidos();
            }
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
