// =========================================
// EL EDITOR DE LA WIKI — los mapas
// =========================================
// Dos vistas: la lista de mapas (con el formulario para hacer uno nuevo) y
// el editor de un mapa. El mapa es un SVG con el viewBox del lienzo del
// .cmap (sus coordenadas son píxeles de la imagen), así que acercar y
// moverse es cambiar el viewBox. Lo que mide lo mismo en pantalla a
// cualquier zoom (los sitios, los puntos para arrastrar, el grosor de las
// rayas) se escala al revés: los sitios con scale() y las rayas con
// vector-effect: non-scaling-stroke.
//
// El .cmap se guarda ENTERO: llega del servidor, se cambian aquí solo las
// cosas que se tocan (label, targetPage, kind, color, x/y, points) y vuelve
// tal cual con lo que traiga de Chronicler. Usa $, crearEditor,
// pedirEditor, avisarEditor e irAEditor de editor.js.

const SVG_MAPA = "http://www.w3.org/2000/svg";
const TIPOS_DE_SITIO = [
    ["capital", "Capital", "★", "#f5ce6c"],
    ["ciudad", "Ciudad", "◉", "#f4f1f7"],
    ["pueblo", "Pueblo", "●", "#e0c9a6"],
    ["fortaleza", "Fortaleza", "♜", "#b9b3c2"],
    ["ruina", "Ruina", "✕", "#8d8478"],
];
const TIPOS_DE_RAYA = [["camino", "Camino"], ["rio", "Río"]];
// Los colores que van tomando las regiones nuevas, uno detrás de otro.
const COLORES_DE_REGION = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22", "#1abc9c"];
const LISTAS_DEL_MAPA = { pins: "sitio", shapes: "región", lines: "raya" };

const estadoMapa = {
    archivo: "", datos: null, imagenes: {}, url: "", cambiado: false, guardando: false,
    herramienta: "elegir", elegido: null, dibujo: null, vista: null, capasOcultas: {},
    arrastre: null, cuantasRegiones: 0,
};
window.estadoMapa = estadoMapa;

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

function tipoDeSitioMapa(kind) {
    return TIPOS_DE_SITIO.find((t) => t[0] === kind) || null;
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
            m.rayas + (m.rayas === 1 ? " camino o río" : " caminos y ríos")].join(" · ");
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

function ponerMapa(mapa) {
    const d = mapa.datos;
    ["pins", "shapes", "lines", "layers"].forEach((k) => {
        if (!Array.isArray(d[k])) {
            d[k] = [];
        }
    });
    Object.assign(estadoMapa, {
        archivo: mapa.archivo, datos: d, imagenes: mapa.imagenes || {}, url: mapa.url || "",
        cambiado: false, elegido: null, dibujo: null, capasOcultas: {}, cuantasRegiones: d.shapes.length,
    });
    // Las capas que estaban apagadas al guardar en Chronicler, apagadas aquí
    // también (se pueden encender en «El mapa en sí»).
    d.layers.forEach((c) => {
        if (c.visible === false) {
            estadoMapa.capasOcultas[c.id] = true;
        }
    });
    $("[data-mapa-archivo]").textContent = "En wiki/" + mapa.archivo + " · " + d.width + " × " + d.height + " px";
    $("#mapa-titulo").value = d.title || "";
    $("#mapa-pagina").value = d.page || "";
    pintarTituloMapa();
    pintarVerMapa();
    pintarCapasMapa();
    $("[data-mapa-cambiar-imagen]").hidden = d.layers.length !== 1;
    // La vista, entera; y luego el dibujo.
    estadoMapa.vista = null;
    pintarTodoElMapa();
    requestAnimationFrame(ajustarMapa);
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
    let w = Math.min(Math.max(v.w, 40), Math.max(d.width, d.height * proporcion) * 1.5);
    const h = w / proporcion;
    const cx = Math.min(Math.max(v.x + v.w / 2, 0), d.width);
    const cy = Math.min(Math.max(v.y + v.h / 2, 0), d.height);
    estadoMapa.vista = { x: cx - w / 2, y: cy - h / 2, w, h };
    w = estadoMapa.vista.w;
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

// ---- PINTAR ----
// Capas del SVG, de abajo arriba: las imágenes, las regiones, las rayas,
// los sitios, lo que se está dibujando y los puntos para arrastrar.
function pintarTodoElMapa() {
    const svg = svgDelMapa();
    svg.textContent = "";
    ["fondo", "regiones", "rayas", "sitios", "dibujo", "asas"].forEach((g) => {
        svg.appendChild(svgMapa("g", { "data-capa-mapa": g }));
    });
    pintarFondoMapa();
    pintarCosasMapa();
}

function capaMapa(nombre) {
    return svgDelMapa().querySelector('[data-capa-mapa="' + nombre + '"]');
}

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
    ["regiones", "rayas", "sitios"].forEach((g) => {
        capaMapa(g).textContent = "";
    });
    const d = estadoMapa.datos;
    d.shapes.forEach((s, i) => capaMapa("regiones").appendChild(dibujoDeCosa("shapes", s, i)));
    d.lines.forEach((l, i) => capaMapa("rayas").appendChild(dibujoDeCosa("lines", l, i)));
    d.pins.forEach((p, i) => capaMapa("sitios").appendChild(dibujoDeCosa("pins", p, i)));
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
        const rio = cosa.kind === "rio";
        const d = trazoMapa(cosa.points || [], false);
        // Una raya gorda y transparente debajo, para acertarle con el ratón.
        g.appendChild(svgMapa("path", {
            d, fill: "none", stroke: "transparent", "stroke-width": 18, "vector-effect": "non-scaling-stroke",
            "pointer-events": "stroke",
        }));
        g.appendChild(svgMapa("path", {
            d, fill: "none", stroke: elegido ? "#ffffff" : "#1b1020", "stroke-width": rio ? 8 : 7,
            "stroke-linecap": "round", "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke",
            "pointer-events": "none",
        }));
        g.appendChild(svgMapa("path", {
            d, fill: "none", stroke: cosa.color || (rio ? "#4aa3df" : "#f0dfb4"), "stroke-width": rio ? 5 : 4,
            "stroke-dasharray": rio ? "none" : "12 8", "stroke-linecap": "round", "stroke-linejoin": "round",
            "vector-effect": "non-scaling-stroke", "pointer-events": "none",
        }));
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
        letra.textContent = tipo ? tipo[2] : (cosa.icon || "");
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

// Los puntos de la región o la raya elegida: uno por esquina, para
// arrastrarlo, y uno pequeño entre cada dos, para meter uno nuevo.
function pintarAsasMapa() {
    const g = capaMapa("asas");
    if (!g) {
        return;
    }
    g.textContent = "";
    const el = estadoMapa.elegido;
    if (!el || el.lista === "pins" || estadoMapa.herramienta !== "elegir") {
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
        g.appendChild(svgMapa("g", { class: "mapa-ed-marca mapa-ed-asa", "data-asa": n, "data-x": p.x, "data-y": p.y }))
            .appendChild(svgMapa("circle", { r: 8 }));
    });
}

// Lo que mide lo mismo a cualquier zoom: los sitios y los puntos.
function escalarMarcasMapa() {
    const s = escalaMapa();
    svgDelMapa().querySelectorAll(".mapa-ed-marca").forEach((m) => {
        m.setAttribute("transform", "translate(" + m.getAttribute("data-x") + " " + m.getAttribute("data-y")
            + ") scale(" + s + ")");
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
        que = cosa.kind === "rio" ? "río" : "camino";
    } else {
        que = "región";
    }
    return { nombre, que };
}

function pintarListaDeCosas() {
    const caja = $("[data-mapa-cosas]");
    caja.textContent = "";
    const d = estadoMapa.datos;
    const grupos = [["pins", "Sitios"], ["lines", "Caminos y ríos"], ["shapes", "Regiones"]];
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
                boton.appendChild(crearEditor("span", "mapa-cosa-marca es-" + tipo[0], tipo[2])).setAttribute("aria-hidden", "true");
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
    const puntos = lista === "pins" ? [cosa] : cosa.points || [];
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
    $("#mapa-p-nombre").value = cosa.label || "";
    $("#mapa-p-pagina").value = cosa.targetPage || "";
    const tipo = $("#mapa-p-tipo");
    tipo.textContent = "";
    const opciones = lista === "pins" ? [["", "Sin tipo (chincheta redonda)"]].concat(TIPOS_DE_SITIO)
        : lista === "lines" ? TIPOS_DE_RAYA : [];
    opciones.forEach((o) => {
        const opcion = document.createElement("option");
        opcion.value = o[0];
        opcion.textContent = o[1];
        tipo.appendChild(opcion);
    });
    tipo.value = cosa.kind || (lista === "lines" ? "camino" : "");
    $('[data-mapa-p-caja="kind"]').hidden = lista === "shapes";
    $('[data-mapa-p-caja="xy"]').hidden = lista !== "pins";
    if (lista === "pins") {
        $("#mapa-p-x").value = Math.round(cosa.x);
        $("#mapa-p-y").value = Math.round(cosa.y);
    }
    const conColor = $('[data-mapa-p="con-color"]');
    conColor.checked = !!cosa.color;
    $("#mapa-p-color").value = /^#[0-9a-f]{6}$/i.test(cosa.color || "") ? cosa.color : "#e74c3c";
    $("#mapa-p-color").hidden = !cosa.color;
    const puntos = (cosa.points || []).length;
    $("[data-mapa-p-puntos]").textContent = lista === "pins" ? ""
        : puntos + " puntos. " + (puntos > 400
            ? "Son demasiados para arrastrarlos uno a uno: se puede cambiar el nombre, la página y el color."
            : "Con «Elegir y mover»: arrastra un punto para moverlo, arrastra uno de los pequeños para añadir"
              + " otro y pulsa dos veces en uno para quitarlo.");
}

function cambiarPropiedadMapa(campo, valor) {
    const cosa = cosaElegida();
    if (!cosa) {
        return;
    }
    const el = estadoMapa.elegido;
    if (campo === "x" || campo === "y") {
        const n = Number(valor);
        if (!Number.isFinite(n)) {
            return;
        }
        cosa[campo] = redondoMapa(n);
    } else if (campo === "con-color") {
        if (valor) {
            cosa.color = $("#mapa-p-color").value;
        } else {
            delete cosa.color;
        }
        $("#mapa-p-color").hidden = !valor;
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
    estadoMapa.datos[el.lista].splice(el.i, 1);
    estadoMapa.elegido = null;
    estadoMapa.cambiado = true;
    pintarCosasMapa();
    pintarPropiedadesMapa();
    avisarEditor("Borrado: " + que + (nombre ? " «" + nombre + "»" : "") + ".");
    lienzoMapa().focus({ preventScroll: true });
}

// ---- LAS HERRAMIENTAS ----
const INSTRUCCIONES_MAPA = {
    elegir: "Pulsa un sitio, una región o una raya para elegirlo. Los sitios se arrastran; en las regiones y"
        + " las rayas se arrastran sus puntos. Arrastrando en un hueco te mueves por el mapa.",
    pin: "Pulsa en el mapa donde va el sitio. Luego escribe su nombre a la derecha.",
    region: "Pulsa punto a punto el borde de la región. Para cerrarla, pulsa en el primero, pulsa dos veces"
        + " o «Terminar el dibujo».",
    camino: "Pulsa punto a punto por donde va el camino. Para acabar, pulsa dos veces o «Terminar el dibujo».",
    rio: "Pulsa punto a punto por donde va el río, desde donde nace. Para acabar, pulsa dos veces o"
        + " «Terminar el dibujo».",
};
const INSTRUCCIONES_A_MANO = "Aprieta y arrastra por donde va; al soltar, se acaba.";

function ponerHerramienta(herramienta) {
    cancelarDibujo();
    estadoMapa.herramienta = herramienta;
    const radio = document.querySelector('input[name="herramienta"][value="' + herramienta + '"]');
    if (radio) {
        radio.checked = true;
    }
    document.querySelectorAll(".herramienta").forEach((h) => {
        h.classList.toggle("es-elegida", !!h.querySelector("input:checked"));
    });
    const dibuja = ["region", "camino", "rio"].includes(herramienta);
    $('[data-mapa-solo="pin"]').hidden = herramienta !== "pin";
    $('[data-mapa-solo="dibujo"]').hidden = !dibuja;
    $("[data-mapa-instrucciones]").textContent = dibuja && $("#mapa-mano").checked
        ? INSTRUCCIONES_A_MANO : INSTRUCCIONES_MAPA[herramienta];
    lienzoMapa().classList.toggle("es-dibujo", herramienta !== "elegir");
    pintarAsasMapa();
    escalarMarcasMapa();
}

function empezarDibujo() {
    const h = estadoMapa.herramienta;
    estadoMapa.dibujo = { lista: h === "region" ? "shapes" : "lines", kind: h, puntos: [], raton: null };
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

function pintarDibujoMapa() {
    const g = capaMapa("dibujo");
    if (!g) {
        return;
    }
    g.textContent = "";
    const dibujo = estadoMapa.dibujo;
    if (!dibujo || !dibujo.puntos.length) {
        return;
    }
    const puntos = dibujo.raton ? dibujo.puntos.concat([dibujo.raton]) : dibujo.puntos;
    const s = escalaMapa();
    g.appendChild(svgMapa("path", {
        d: trazoMapa(puntos, false), fill: dibujo.lista === "shapes" ? "rgba(245,206,108,0.25)" : "none",
        stroke: "#ffffff", "stroke-width": 3, "stroke-dasharray": "8 5", "vector-effect": "non-scaling-stroke",
        class: "mapa-ed-dibujo",
    }));
    dibujo.puntos.forEach((p, n) => {
        g.appendChild(svgMapa("circle", {
            cx: p.x, cy: p.y, r: (n === 0 && dibujo.lista === "shapes" ? 9 : 5) * s,
            fill: n === 0 ? "#f5ce6c" : "#ffffff", stroke: "#1b1020", "stroke-width": 2,
            "vector-effect": "non-scaling-stroke",
        }));
    });
}

function anadirPuntoDibujo(p) {
    if (!estadoMapa.dibujo) {
        empezarDibujo();
    }
    const dibujo = estadoMapa.dibujo;
    const ultimo = dibujo.puntos[dibujo.puntos.length - 1];
    const s = escalaMapa();
    // El segundo clic de un doble clic cae en el mismo sitio: no es otro punto.
    if (ultimo && Math.hypot(ultimo.x - p.x, ultimo.y - p.y) < 4 * s) {
        return;
    }
    // Pulsar en el primero cierra la región.
    const primero = dibujo.puntos[0];
    if (dibujo.lista === "shapes" && dibujo.puntos.length >= 3 && Math.hypot(primero.x - p.x, primero.y - p.y) < 12 * s) {
        terminarDibujo();
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
    }
    const falta = dibujo.lista === "shapes" ? 3 : 2;
    if (puntos.length < falta) {
        avisarEditor(dibujo.lista === "shapes" ? "Una región necesita por lo menos tres puntos."
            : "Una raya necesita por lo menos dos puntos.", true);
        return;
    }
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
        cosa.kind = dibujo.kind;
        cosa.points = puntos;
    }
    estadoMapa.datos[dibujo.lista].push(cosa);
    estadoMapa.cambiado = true;
    const lista = dibujo.lista;
    cancelarDibujo();
    elegirCosa(lista, estadoMapa.datos[lista].length - 1);
    avisarEditor((lista === "shapes" ? "Región" : dibujo.kind === "rio" ? "Río" : "Camino")
        + " hecho (" + puntos.length + " puntos). Ponle nombre a la derecha.");
    $("#mapa-p-nombre").focus({ preventScroll: true });
}

function ponerSitio(p) {
    const tipo = $("#mapa-tipo-nuevo").value;
    const sitio = dentroDelMapa(p);
    const cosa = { id: idNuevoMapa(), x: sitio.x, y: sitio.y, label: "" };
    if (tipo) {
        cosa.kind = tipo;
    }
    estadoMapa.datos.pins.push(cosa);
    estadoMapa.cambiado = true;
    elegirCosa("pins", estadoMapa.datos.pins.length - 1);
    avisarEditor("Sitio puesto. Escribe su nombre (y, si tiene, la página a la que lleva).");
    $("#mapa-p-nombre").focus({ preventScroll: true });
}

// ---- EL RATÓN ----
function alApretarEnElMapa(e) {
    if (!estadoMapa.datos || (e.button !== 0 && e.button !== 1)) {
        return;
    }
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
        if (medio) {
            n = Number(medio.getAttribute("data-medio")) + 1;
            puntos.splice(n, 0, dentroDelMapa(p));
            estadoMapa.cambiado = true;
            repintarCosa(el.lista, el.i);
        } else {
            n = Number(asa.getAttribute("data-asa"));
        }
        estadoMapa.arrastre = { que: "punto", n, inicio, movido: false };
    } else if (h === "elegir" && cosa) {
        const lista = cosa.getAttribute("data-lista");
        const i = Number(cosa.getAttribute("data-i"));
        elegirCosa(lista, i);
        estadoMapa.arrastre = lista === "pins"
            ? { que: "sitio", inicio, desde: { x: estadoMapa.datos.pins[i].x, y: estadoMapa.datos.pins[i].y }, movido: false }
            : { que: "vista", inicio, movido: false, cosa: true };
    } else if (h !== "elegir" && h !== "pin" && $("#mapa-mano").checked) {
        empezarDibujo();
        estadoMapa.dibujo.puntos.push(dentroDelMapa(p));
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
    if (!a) {
        if (dibujo && dibujo.puntos.length) {
            dibujo.raton = puntoDelMapa(e);
            pintarDibujoMapa();
        }
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
    if (a.que === "sitio") {
        const sitio = estadoMapa.datos.pins[el.i];
        Object.assign(sitio, dentroDelMapa({ x: a.desde.x + p.x - a.inicio.p.x, y: a.desde.y + p.y - a.inicio.p.y }));
        estadoMapa.cambiado = true;
        repintarCosa("pins", el.i);
    } else if (a.que === "punto") {
        estadoMapa.datos[el.lista][el.i].points[a.n] = dentroDelMapa(p);
        estadoMapa.cambiado = true;
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
    if (!el || el.lista === "pins") {
        return;
    }
    const puntos = estadoMapa.datos[el.lista][el.i].points;
    if (puntos.length <= (el.lista === "shapes" ? 3 : 2)) {
        avisarEditor("No le quedan puntos que quitar: si sobra entera, bórrala.", true);
        return;
    }
    puntos.splice(n, 1);
    estadoMapa.cambiado = true;
    repintarCosa(el.lista, el.i);
    pintarPropiedadesMapa();
}

function alDobleClicEnElMapa() {
    if (["region", "camino", "rio"].includes(estadoMapa.herramienta) && estadoMapa.dibujo) {
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
    if (flechas[e.key]) {
        e.preventDefault();
        const [fx, fy] = flechas[e.key];
        if (el && el.lista === "pins" && estadoMapa.herramienta === "elegir") {
            const sitio = estadoMapa.datos.pins[el.i];
            const s = escalaMapa() * (e.shiftKey ? 20 : 4);
            Object.assign(sitio, dentroDelMapa({ x: sitio.x + fx * s, y: sitio.y + fy * s }));
            estadoMapa.cambiado = true;
            repintarCosa("pins", el.i);
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
        if (estadoMapa.herramienta === "pin") {
            ponerSitio(centroDeLaVista());
        } else if (estadoMapa.herramienta !== "elegir") {
            anadirPuntoDibujo(centroDeLaVista());
        }
    } else if (e.key === "End") {
        e.preventDefault();
        terminarDibujo();
    } else if (e.key === "Escape") {
        if (estadoMapa.dibujo) {
            cancelarDibujo();
        } else if (el) {
            elegirCosa(null);
        }
    } else if ((e.key === "Delete" || e.key === "Backspace") && el) {
        e.preventDefault();
        borrarElegido();
    }
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
    const d = estadoMapa.datos;
    // Lo puesto, a la medida nueva: si la imagen es el doble de grande,
    // cada coordenada, el doble.
    const fx = hecha.ancho / d.width;
    const fy = hecha.alto / d.height;
    const escalar = (p) => {
        p.x = redondoMapa(p.x * fx);
        p.y = redondoMapa(p.y * fy);
    };
    d.pins.forEach(escalar);
    d.shapes.concat(d.lines).forEach((c) => (c.points || []).forEach(escalar));
    d.width = hecha.ancho;
    d.height = hecha.alto;
    d.layers[0].image = hecha.nombre;
    estadoMapa.imagenes[hecha.nombre] = hecha.url;
    estadoMapa.cambiado = true;
    $("[data-mapa-archivo]").textContent = "En wiki/" + estadoMapa.archivo + " · " + d.width + " × " + d.height + " px";
    pintarTodoElMapa();
    ajustarMapa();
    pintarPropiedadesMapa();
    const raro = Math.abs(fx - fy) > 0.02 ? " OJO: no tiene la misma forma que la otra, así que lo puesto se ha estirado." : "";
    avisarEditor("Imagen cambiada: " + hecha.nombre + " (" + hecha.ancho + " × " + hecha.alto + ")." + raro
        + " Recuerda guardar.", !!raro);
}

// ---- DESCARGAR LA IMAGEN, CON TODO LO PUESTO ----
// Un PNG del tamaño del mapa: las capas que se ven aquí y, encima, las
// regiones (con su nombre en medio), los caminos y ríos y los sitios con
// su símbolo y su nombre. Se pinta en un <canvas> a partir de los datos,
// no del SVG de la pantalla: así los tamaños van en proporción al mapa y
// no al zoom de ahora. Sale lo que hay en el editor, aunque no esté
// guardado.
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
    const camino = (puntos, cerrado) => {
        ctx.beginPath();
        puntos.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        if (cerrado) {
            ctx.closePath();
        }
    };
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Las regiones.
    d.shapes.forEach((s) => {
        const puntos = s.points || [];
        if (puntos.length < 3) {
            return;
        }
        const color = s.color || "#f5ce6c";
        camino(puntos, true);
        ctx.globalAlpha = s.label || s.targetPage ? 0.35 : 0.18;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * k;
        ctx.stroke();
        ctx.globalAlpha = 1;
    });

    // Los caminos y los ríos: un borde oscuro debajo y la raya encima.
    d.lines.forEach((l) => {
        const puntos = l.points || [];
        if (puntos.length < 2) {
            return;
        }
        const rio = l.kind === "rio";
        camino(puntos, false);
        ctx.setLineDash([]);
        ctx.strokeStyle = "#1b1020";
        ctx.lineWidth = (rio ? 7 : 6.5) * k;
        ctx.stroke();
        ctx.strokeStyle = l.color || (rio ? "#4aa3df" : "#f0dfb4");
        ctx.lineWidth = (rio ? 4.5 : 3.5) * k;
        ctx.setLineDash(rio ? [] : [10 * k, 7 * k]);
        ctx.stroke();
        ctx.setLineDash([]);
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
        const simbolo = tipo ? tipo[2] : (p.icon || "");
        if (simbolo) {
            ctx.fillStyle = "#1b1020";
            ctx.font = "700 " + Math.round(13 * k) + "px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(simbolo, p.x, p.y + k);
        }
        if (p.label) {
            letreroMapa(ctx, p.label, p.x + r + 5 * k, p.y, k, 15);
        }
    });

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
    const hecho = await pedirEditor("/api/mapa/guardar", { archivo: estadoMapa.archivo, datos: estadoMapa.datos });
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
function empezarMapas() {
    const tipos = $("[data-mapa-tipos-pin]");
    TIPOS_DE_SITIO.forEach(([valor, nombre, simbolo]) => {
        const o = document.createElement("option");
        o.value = valor;
        o.textContent = simbolo + " " + nombre;
        tipos.appendChild(o);
    });
    tipos.value = "ciudad";

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
    $("[data-mapa-terminar]").addEventListener("click", () => terminarDibujo());
    $("[data-mapa-cancelar]").addEventListener("click", cancelarDibujo);
    $("[data-mapa-quitar-punto]").addEventListener("click", quitarUltimoPunto);
    $("[data-mapa-borrar]").addEventListener("click", borrarElegido);

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
            pintarDibujoMapa();
        }
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

    // Lo elegido: cada casilla cambia lo suyo al escribir.
    document.querySelectorAll("[data-mapa-p]").forEach((campo) => {
        const que = campo.getAttribute("data-mapa-p");
        const tipo = campo.type === "checkbox" ? "change" : "input";
        campo.addEventListener(tipo, () => {
            if (que === "con-color") {
                cambiarPropiedadMapa(que, campo.checked);
            } else {
                cambiarPropiedadMapa(que, que === "x" || que === "y" ? campo.value : campo.value.trim());
            }
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
            if (valor) {
                estadoMapa.datos[que] = valor;
            } else {
                delete estadoMapa.datos[que];
            }
            estadoMapa.cambiado = true;
            if (que === "title") {
                pintarTituloMapa();
            }
        });
    });
    $("#mapa-otra-imagen").addEventListener("change", (e) => cambiarImagenMapa(e.target));

    $("[data-mapa-guardar]").addEventListener("click", () => guardarMapa(false));
    $("[data-mapa-descargar]").addEventListener("click", descargarImagenMapa);
    $("[data-mapa-pasar]").addEventListener("click", () => guardarMapa(true));
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && !$('[data-vista="mapa"]').hidden) {
            e.preventDefault();
            guardarMapa(false);
        }
    });
    ponerHerramienta("elegir");
}

empezarMapas();
