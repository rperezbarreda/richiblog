/* ARCHIVO GENERADO — NO LO EDITES.
   Lo escribe herramientas/3-generadores/actualizar-cabeceras.py
   pegando los archivos de abajo, que son los que lleva TODA
   página del sitio. Para cambiar algo se toca el archivo de
   verdad y se vuelve a pasar la herramienta.

   fuente: /scripts/componentes/cargador-fragmentos.js
   fuente: /scripts/componentes/barra-lateral.js
   fuente: /scripts/componentes/gatin-random.js
   fuente: /scripts/tema.js
   fuente: /scripts/componentes/ajustes.js
   fuente: /scripts/componentes/buscar-lupa.js
   fuente: /scripts/componentes/botones-ventana.js
   fuente: /scripts/componentes/ventanas-plegables.js
   fuente: /scripts/componentes/rastro-cursor.js
   fuente: /scripts/componentes/chispas-botones.js
   fuente: /scripts/componentes/enlaces-fuera.js
   fuente: /scripts/componentes/visor-imagenes.js
   fuente: /scripts/componentes/aviso.js
   fuente: /scripts/componentes/subir.js
   fuente: /scripts/componentes/teclado-scroll.js
*/

/* ======== /scripts/componentes/cargador-fragmentos.js ======== */
async function loadComponent(elementId, file, onLoaded) {
    const container = document.getElementById(elementId);
    if (!container) {
        return;
    }
    try {
        const adelanto = window.adelantoDeFragmentos || {};
        let html = adelanto[file] ? await adelanto[file] : null;
        if (html === null) {
            const response = await fetch(window.conVersion(file));
            if (!response.ok) {
                throw new Error(`No se pudo cargar ${file}`);
            }
            html = await response.text();
        }
        container.innerHTML = html;
        if (typeof onLoaded === "function") {
            await cuandoEsteLeidaLaPagina();
            onLoaded();
        }
    } catch (error) {
        console.error(`Error cargando el componente (${file}):`, error);
    }
}
const FRAGMENTOS_PAGINA_LEIDA = new Promise((seguir) => {
    if (document.readyState === "complete") {
        seguir();
        return;
    }
    document.addEventListener("DOMContentLoaded", seguir, { once: true });
});
function cuandoEsteLeidaLaPagina() {
    return FRAGMENTOS_PAGINA_LEIDA;
}

/* ======== /scripts/componentes/barra-lateral.js ======== */
function initializeSidebar() {
    initializeDropdowns();
    initializeActivePage();
    initializeScrollFade();
    initializeMobileToggle();
    prepararPlegarLateral();
}
const LATERAL_GUARDADO = "richi-lateral";
function prepararPlegarLateral() {
    const boton = document.getElementById("lateral-plegar");
    if (!boton) {
        return;
    }
    const raiz = document.documentElement;
    const ponerEstado = () => {
        const plegada = raiz.classList.contains("lateral-plegada");
        boton.setAttribute("aria-expanded", plegada ? "false" : "true");
        boton.title = plegada ? "Desplegar el menú" : "Plegar el menú";
    };
    ponerEstado();
    boton.addEventListener("click", () => {
        const plegada = raiz.classList.toggle("lateral-plegada");
        ponerEstado();
        try {
            if (plegada) {
                localStorage.setItem(LATERAL_GUARDADO, "plegada");
            } else {
                localStorage.removeItem(LATERAL_GUARDADO);
            }
        } catch (error) {
        }
        window.dispatchEvent(new Event("resize"));
    });
}
function initializeMobileToggle() {
    const toggle = document.getElementById("sidebar-toggle");
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (!toggle || !sidebar || !backdrop) {
        return;
    }
    const setBackgroundInert = (isInert) => {
        const shell = sidebar.closest("body > *");
        Array.from(document.body.children).forEach((el) => {
            if (el === shell) {
                return;
            }
            el.inert = isInert;
        });
    };
    const openSidebar = () => {
        sidebar.classList.add("open");
        backdrop.hidden = false;
        toggle.setAttribute("aria-expanded", "true");
        setBackgroundInert(true);
        const firstLink = sidebar.querySelector("a[href]");
        if (firstLink) {
            firstLink.focus();
        }
    };
    const closeSidebar = () => {
        sidebar.classList.remove("open");
        backdrop.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        setBackgroundInert(false);
    };
    toggle.addEventListener("click", () => {
        if (sidebar.classList.contains("open")) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });
    backdrop.addEventListener("click", closeSidebar);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && sidebar.classList.contains("open")) {
            closeSidebar();
            toggle.focus();
        }
    });
    sidebar.querySelectorAll("nav a[href]").forEach((link) => {
        link.addEventListener("click", closeSidebar);
    });
    window.addEventListener("resize", () => {
        if (window.innerWidth > 860 && sidebar.classList.contains("open")) {
            closeSidebar();
        }
    });
}
function initializeScrollFade() {
    const navEl = document.querySelector(".sidebar nav");
    const topEl = document.querySelector(".sidebar-top");
    if (!navEl || !topEl) {
        return;
    }
    const updateFade = () => {
        const isScrollable = navEl.scrollHeight > navEl.clientHeight + 1;
        topEl.classList.toggle("has-scroll", isScrollable);
    };
    updateFade();
    navEl.addEventListener("scroll", updateFade);
    window.addEventListener("resize", updateFade);
    navEl.addEventListener("click", () => {
        requestAnimationFrame(updateFade);
    });
}
function initializeDropdowns() {
    const toggles = document.querySelectorAll(".nav-toggle");
    toggles.forEach((toggle) => {
        toggle.addEventListener("click", () => {
            const group = toggle.closest(".nav-group");
            if (!group) {
                return;
            }
            group.classList.toggle("open");
            updateArrow(toggle, group);
        });
    });
}
function updateArrow(toggle, group) {
    const arrow = toggle.querySelector(".arrow");
    const isOpen = group.classList.contains("open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (!arrow) {
        return;
    }
    if (isOpen) {
        arrow.textContent = "−";
    } else {
        arrow.textContent = "+";
    }
}
function marcarComoActual(enlaceActual, todos, tipo) {
    todos.forEach((enlace) => {
        enlace.classList.remove("active");
        enlace.removeAttribute("aria-current");
    });
    if (!enlaceActual) {
        return;
    }
    enlaceActual.classList.add("active");
    enlaceActual.setAttribute("aria-current", tipo || "page");
}
function initializeActivePage() {
    const links = document.querySelectorAll(".sidebar a[href]");
    const currentPath = normalizePath(window.location.pathname);
    const candidates = [];
    links.forEach((link) => {
        const href = link.getAttribute("href");
        if (!href || href.startsWith("#")) {
            return;
        }
        const linkPath = getLinkPath(href);
        if (!linkPath) {
            return;
        }
        candidates.push({ link, linkPath, folderPath: getFolderPath(linkPath) });
    });
    let bestMatch = candidates.find((item) => item.linkPath === currentPath) || null;
    let tipo = bestMatch ? "page" : "true";
    if (!bestMatch) {
        candidates.forEach((item) => {
            if (item.folderPath === "/") {
                return;
            }
            if (isInsideFolder(currentPath, item.folderPath)) {
                if (!bestMatch || item.folderPath.length > bestMatch.folderPath.length) {
                    bestMatch = item;
                }
            }
        });
    }
    if (bestMatch) {
        marcarComoActual(bestMatch.link, links, tipo);
        openParentMenus(bestMatch.link);
    }
}
function getLinkPath(href) {
    try {
        const url = new URL(
            href,
            window.location.href
        );
        return normalizePath(url.pathname);
    } catch (error) {
        return null;
    }
}
function normalizePath(path) {
    if (!path) {
        return "/";
    }
    if (path.length > 1 && path.endsWith("/")) {
        path = path.slice(0, -1);
    }
    if (path.endsWith("/index.html")) {
        path = path.replace("/index.html", "/");
    }
    if (path === "index.html") {
        path = "/";
    }
    return path;
}
function getFolderPath(path) {
    const idx = path.lastIndexOf("/");
    if (idx <= 0) {
        return "/";
    }
    return path.slice(0, idx + 1);
}
function isInsideFolder(currentPath, folderPath) {
    return (currentPath + "/").startsWith(folderPath);
}
function openParentMenus(link) {
    let parent = link.parentElement;
    while (parent) {
        if (parent.classList.contains("nav-group")) {
            parent.classList.add("open");
            const toggle = parent.querySelector(
                ":scope > .nav-toggle"
            );
            if (toggle) {
                updateArrow(toggle, parent);
            }
        }
        parent = parent.parentElement;
    }
}
function initializeNavigation() {
    const links = document.querySelectorAll(
        ".sidebar a[href]"
    );
    links.forEach((link) => {
        link.addEventListener("click", () => {
            marcarComoActual(link, links, "page");
            openParentMenus(link);
        });
    });
}
loadComponent("sidebar-container", "/fragmentos/barra-lateral.html", () => {
    initializeSidebar();
    document.dispatchEvent(new CustomEvent("sidebar:loaded"));
});

/* ======== /scripts/componentes/gatin-random.js ======== */
const GATIN_FOTOS_URL = "/datos/mi_rincon/fotos-santuarios.json";
const GATIN_ULTIMA_CLAVE = "richi-gatin-ultimo";
const ICONO_RECARGAR =
    '<svg class="gatin-random-reload-icono" viewBox="0 0 24 24"' +
    ' aria-hidden="true" focusable="false">' +
    '<path d="M19.37 12.82A7.4 7.4 0 1 1 14.53 6.51" fill="none"' +
    ' stroke="currentColor" stroke-width="2.9" stroke-linecap="round"/>' +
    '<path d="M18.85 8.08L12.65 9.34L14.91 3.13Z" fill="currentColor"/>' +
    "</svg>";
document.addEventListener("sidebar:loaded", initializeGatinRandom);
async function initializeGatinRandom() {
    const caja = document.querySelector("[data-gatin-random]");
    const cuerpo = caja && caja.querySelector("[data-gatin-body]");
    if (!caja || !cuerpo) {
        return;
    }
    let fotos = [];
    try {
        const respuesta = await window.pedirDatos(GATIN_FOTOS_URL);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        fotos = aplanarFotos(await respuesta.json());
    } catch (error) {
        return;
    }
    if (fotos.length === 0) {
        return;
    }
    cuerpo.innerHTML = gatinAHtml();
    pintarFoto(cuerpo, elegirFoto(fotos));
    caja.hidden = false;
    const recargar = cuerpo.querySelector("[data-gatin-reload]");
    if (recargar) {
        if (fotos.length < 2) {
            recargar.remove();
        } else {
            recargar.addEventListener("click", () => {
                pintarFoto(cuerpo, elegirFoto(fotos));
            });
        }
    }
}
function pintarFoto(cuerpo, item) {
    const boton = cuerpo.querySelector(".gatin-random-foto");
    const img = boton && boton.querySelector("img");
    if (!boton || !img) {
        return;
    }
    const carpeta = "/imagenes/santuarios/" + encodeURIComponent(item.gato) + "/";
    img.src = carpeta + encodeURIComponent(item.foto.mini || item.foto.archivo);
    img.alt = item.foto.alt || "Foto del santuario";
    boton.dataset.completa = carpeta + encodeURIComponent(item.foto.archivo);
    recordarFoto(item);
}
function aplanarFotos(datos) {
    if (!datos || typeof datos !== "object") {
        return [];
    }
    return Object.keys(datos).reduce((lista, gato) => {
        if (Array.isArray(datos[gato])) {
            datos[gato].forEach((foto) => {
                if (foto && foto.archivo) {
                    lista.push({ gato: gato, foto: foto });
                }
            });
        }
        return lista;
    }, []);
}
function elegirFoto(fotos) {
    const anterior = leerUltimaFoto();
    const candidatas =
        fotos.length > 1
            ? fotos.filter((item) => claveDeFoto(item) !== anterior)
            : fotos;
    const utiles = candidatas.length > 0 ? candidatas : fotos;
    return utiles[Math.floor(Math.random() * utiles.length)];
}
function claveDeFoto(item) {
    return item.gato + "/" + item.foto.archivo;
}
function leerUltimaFoto() {
    try {
        return sessionStorage.getItem(GATIN_ULTIMA_CLAVE);
    } catch (error) {
        return null;
    }
}
function recordarFoto(item) {
    try {
        sessionStorage.setItem(GATIN_ULTIMA_CLAVE, claveDeFoto(item));
    } catch (error) {
    }
}
function gatinAHtml() {
    return (
        '<button type="button" class="lightbox-trigger gatin-random-foto">' +
        '<img src="" alt="" decoding="async">' +
        "</button>" +
        '<button type="button" class="gatin-random-reload" data-gatin-reload>' +
        ICONO_RECARGAR +
        '<span class="visually-hidden">Ver otra foto</span>' +
        "</button>"
    );
}

/* ======== /scripts/tema.js ======== */
const THEME_STORAGE_KEY = "richi-theme";
const TEMAS = [
    "oscuro",
    "claro",
    "oscuro-puro",
    "claro-puro",
    "tranquilo",
    "tranquilo-oscuro",
    "terminal-verde",
    "terminal-azul",
    "terminal-rojo",
    "terminal-ambar",
];
const TEMA_ATRIBUTO = {
    oscuro: "",
    claro: "light",
    "oscuro-puro": "puro-oscuro",
    "claro-puro": "puro-claro",
    tranquilo: "tranquilo",
    "tranquilo-oscuro": "tranquilo-oscuro",
    "terminal-verde": "terminal-verde",
    "terminal-azul": "terminal-azul",
    "terminal-rojo": "terminal-rojo",
    "terminal-ambar": "terminal-ambar",
};
document.addEventListener("sidebar:loaded", initializeThemeToggle);
document.addEventListener("theme:changed", (event) => {
    updatePngPerson(event.detail.theme);
    updateThemeColor(event.detail.theme);
});
function initializeThemeToggle() {
    const botones = document.querySelectorAll("[data-tema]");
    if (!botones.length) {
        return;
    }
    botones.forEach((boton) => {
        boton.addEventListener("click", () => {
            ponerTema(boton.getAttribute("data-tema"));
        });
    });
    pintarTemaElegido();
}
function ponerTema(tema) {
    if (TEMAS.indexOf(tema) === -1) {
        return;
    }
    const atributo = TEMA_ATRIBUTO[tema];
    if (atributo) {
        document.documentElement.setAttribute("data-theme", atributo);
    } else {
        document.documentElement.removeAttribute("data-theme");
    }
    saveTheme(tema);
    pintarTemaElegido();
    dispatchThemeChanged(tema);
}
function pintarTemaElegido() {
    const ahora = getCurrentTheme();
    document.querySelectorAll("[data-tema]").forEach((boton) => {
        boton.setAttribute(
            "aria-pressed",
            boton.getAttribute("data-tema") === ahora ? "true" : "false"
        );
    });
}
function temaDelSistema() {
    try {
        return window.matchMedia("(prefers-color-scheme: light)").matches
            ? "claro"
            : "oscuro";
    } catch (error) {
        return "oscuro";
    }
}
function olvidarTemaGuardado() {
    try {
        localStorage.removeItem(THEME_STORAGE_KEY);
    } catch (error) {
    }
    const tema = temaDelSistema();
    const atributo = TEMA_ATRIBUTO[tema];
    if (atributo) {
        document.documentElement.setAttribute("data-theme", atributo);
    } else {
        document.documentElement.removeAttribute("data-theme");
    }
    pintarTemaElegido();
    dispatchThemeChanged(tema);
}
function getCurrentTheme() {
    const atributo = document.documentElement.getAttribute("data-theme") || "";
    const encontrado = TEMAS.filter((t) => TEMA_ATRIBUTO[t] === atributo);
    return encontrado.length ? encontrado[0] : "oscuro";
}
function saveTheme(theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
    }
}
function dispatchThemeChanged(theme) {
    document.dispatchEvent(
        new CustomEvent("theme:changed", { detail: { theme } })
    );
}
const COLOR_BARRA = {
    oscuro: "#12091c",
    claro: "#f3e1d6",
    "oscuro-puro": "#000000",
    "claro-puro": "#ffffff",
    tranquilo: "#f2efe9",
    "tranquilo-oscuro": "#1b1e22",
    "terminal-verde": "#000000",
    "terminal-azul": "#000000",
    "terminal-rojo": "#000000",
    "terminal-ambar": "#000000",
};
function updateThemeColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        return;
    }
    meta.setAttribute("content", COLOR_BARRA[theme] || COLOR_BARRA.oscuro);
}
function updatePngPerson(theme) {
    const img = document.getElementById("pngperson-img");
    if (!img) {
        return;
    }
    const esClaro =
        theme === "claro" || theme === "claro-puro" || theme === "tranquilo";
    const base = esClaro
        ? "/imagenes/main/pngtuber_white_theme"
        : "/imagenes/main/pngtuber_dark_theme";
    img.srcset = `${base}-412.webp 412w, ${base}-620.webp 620w, ${base}.webp 1161w`;
    img.src = `${base}.webp`;
}

/* ======== /scripts/componentes/ajustes.js ======== */
const AJUSTES_TAMANOS = [0.9, 1, 1.15, 1.3, 1.5];
const AJUSTES_GUARDADO_TAMANO = "richi-texto";
const AJUSTES_GUARDADO_INTERLINEADO = "richi-interlineado";
const AJUSTES_GUARDADO_LETRA = "richi-letra";
const AJUSTES_GUARDADO_CRT = "richi-crt";
const AJUSTES_GUARDADO_VOZ = "richi-voz";
const AJUSTES_GUARDADO_MOVIMIENTO = "richi-movimiento";
const AJUSTES = {
    ventana: null,
    abrir: null,
    rango: null,
    paso: 1,
    avisoReloj: 0,
};
document.addEventListener("sidebar:loaded", initializeAjustes);
document.addEventListener("ajustes:actualizar", () => {
    if (AJUSTES.ventana) {
        pintarAjustesOpciones();
    }
});
function initializeAjustes() {
    const ventana = document.querySelector("[data-ajustes]");
    const abrir = document.querySelector("[data-ajustes-abrir]");
    if (!ventana || !abrir || AJUSTES.ventana) {
        return;
    }
    AJUSTES.ventana = ventana;
    AJUSTES.abrir = abrir;
    armarAjustesPanel(ventana);
    abrir.addEventListener("click", abrirAjustes);
    const cerrar = ventana.querySelector("[data-ajustes-cerrar]");
    if (cerrar) {
        cerrar.addEventListener("click", cerrarAjustes);
    }
    ventana.addEventListener("click", (evento) => {
        if (evento.target !== ventana) {
            return;
        }
        const caja = ventana.getBoundingClientRect();
        const dentro =
            evento.clientX >= caja.left && evento.clientX <= caja.right &&
            evento.clientY >= caja.top && evento.clientY <= caja.bottom;
        if (!dentro) {
            cerrarAjustes();
        }
    });
    AJUSTES.rango = ventana.querySelector("[data-tamano-rango]");
    AJUSTES.paso = pasoDeAjustes(leerAjuste(AJUSTES_GUARDADO_TAMANO, NaN, true));
    if (AJUSTES.rango) {
        AJUSTES.rango.addEventListener("input", () => {
            aplicarAjustesTamano(Number(AJUSTES.rango.value), true);
        });
    }
    aplicarAjustesTamano(AJUSTES.paso, false);
    engancharAjustesOpciones("interlineado");
    engancharAjustesOpciones("letra");
    engancharAjustesOpciones("voz");
    engancharAjustesOpciones("movimiento");
    pintarAjustesOpciones();
    const reiniciar = ventana.querySelector("[data-ajustes-reiniciar]");
    if (reiniciar) {
        reiniciar.addEventListener("click", reiniciarAjustes);
    }
    const crt = ventana.querySelector("[data-crt-boton]");
    if (crt) {
        crt.addEventListener("click", () => {
            ponerAjustesCrt(document.documentElement.dataset.crt !== "si", true);
        });
        pintarAjustesCrt();
    }
}
function abrirAjustes() {
    if (AJUSTES.ventana.open) {
        return;
    }
    if (typeof AJUSTES.ventana.showModal === "function") {
        AJUSTES.ventana.showModal();
        return;
    }
    AJUSTES.ventana.setAttribute("open", "");
    AJUSTES.ventana.classList.add("ajustes-a-mano");
    document.addEventListener("keydown", cerrarAjustesConEscape);
}
function cerrarAjustesConEscape(evento) {
    if (evento.key === "Escape" || evento.key === "Esc") {
        cerrarAjustes();
    }
}
function cerrarAjustes() {
    const ventana = AJUSTES.ventana;
    if (!ventana) {
        return;
    }
    if (typeof ventana.close === "function") {
        ventana.close();
    } else {
        ventana.removeAttribute("open");
    }
    ventana.classList.remove("ajustes-a-mano");
    document.removeEventListener("keydown", cerrarAjustesConEscape);
    if (AJUSTES.abrir && typeof ventana.close !== "function") {
        AJUSTES.abrir.focus();
    }
}
function armarAjustesPanel(ventana) {
    const cuerpo = ventana.querySelector(".ajustes-cuerpo");
    if (!cuerpo) {
        return;
    }
    let lista = cuerpo.querySelector(".ajustes-lista");
    if (!lista) {
        lista = document.createElement("div");
        lista.className = "ajustes-lista";
        const filas = cuerpo.querySelectorAll(":scope > .ajustes-fila");
        if (!filas.length) {
            return;
        }
        cuerpo.insertBefore(lista, filas[0]);
        filas.forEach((fila) => lista.appendChild(fila));
    }
    arreglarAjustesCrt(lista);
    if (!lista.querySelector("[data-movimiento]")) {
        lista.appendChild(armarAjustesMovimiento());
    }
    cuerpo.querySelectorAll(".ajustes-lado, .ajustes-ejemplo, .ajustes-pie")
        .forEach((viejo) => viejo.remove());
    const lado = document.createElement("div");
    lado.className = "ajustes-lado";
    lado.appendChild(armarAjustesEjemplo());
    const viejoReiniciar = cuerpo.querySelector("[data-ajustes-reiniciar]");
    if (viejoReiniciar) {
        const fila = viejoReiniciar.closest(".ajustes-fila") || viejoReiniciar;
        fila.remove();
    }
    lado.appendChild(armarAjustesReiniciar());
    lado.appendChild(armarAjustesPie());
    cuerpo.appendChild(lado);
    document.dispatchEvent(new CustomEvent("ventanas:actualizar"));
}
function arreglarAjustesCrt(lista) {
    const boton = lista.querySelector("[data-crt-boton]");
    if (!boton || boton.querySelector("[data-crt-estado]")) {
        return;
    }
    let texto = boton.querySelector(".ajustes-crt-texto");
    if (!texto) {
        texto = document.createElement("span");
        texto.className = "ajustes-crt-texto";
        boton.appendChild(texto);
    }
    texto.textContent = "FILTRO ";
    const sigla = document.createElement("abbr");
    sigla.title =
        "Cathode Ray Tube: los monitores de tubo de antes, con sus rayas " +
        "y las esquinas apagadas";
    sigla.textContent = "CRT";
    texto.appendChild(sigla);
    texto.appendChild(document.createTextNode(": "));
    const estado = document.createElement("span");
    estado.setAttribute("data-crt-estado", "");
    estado.textContent = "OFF";
    texto.appendChild(estado);
}
function armarAjustesMovimiento() {
    const fila = document.createElement("div");
    fila.className = "ajustes-fila";
    const nombre = document.createElement("p");
    nombre.className = "ajustes-nombre";
    nombre.id = "ajustes-movimiento-nombre";
    nombre.textContent = "animaciones";
    fila.appendChild(nombre);
    const mandos = document.createElement("div");
    mandos.className = "ajustes-mandos";
    mandos.setAttribute("role", "group");
    mandos.setAttribute("aria-labelledby", nombre.id);
    [
        ["", "normal"],
        ["quieto", "sin animaciones"],
    ].forEach(([valor, etiqueta]) => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "ajustes-opcion";
        boton.setAttribute("data-movimiento", valor);
        boton.setAttribute("aria-pressed", "false");
        boton.textContent = etiqueta;
        mandos.appendChild(boton);
    });
    fila.appendChild(mandos);
    return fila;
}
const AJUSTES_CARACTERES =
    "abc def ghi jkl mno pqrs tuv wxyz " +
    "ABC DEF GHI JKL MNO PQRS TUV WXYZ " +
    "0123456789 !\"§ $%& /() =?* '<> #|; ²³~ @`´ ©«» ¤¼× {}";
function armarAjustesEjemplo() {
    const caja = document.createElement("div");
    caja.className = "ajustes-ejemplo";
    const barra = document.createElement("div");
    barra.className = "recent-entries-header";
    const titulo = document.createElement("h2");
    titulo.textContent = "ejemplo.txt";
    const mandos = document.createElement("div");
    mandos.className = "window-controls window-controls-small";
    mandos.setAttribute("data-window-controls", "");
    mandos.setAttribute("aria-hidden", "true");
    barra.appendChild(titulo);
    barra.appendChild(mandos);
    caja.appendChild(barra);
    const dentro = document.createElement("div");
    dentro.className = "ajustes-ejemplo-cuerpo";
    dentro.setAttribute("aria-hidden", "true");
    const como = document.createElement("p");
    como.className = "ajustes-ejemplo-titulo";
    como.textContent = "así se va a ver";
    dentro.appendChild(como);
    const texto = document.createElement("p");
    texto.className = "ajustes-ejemplo-texto";
    texto.appendChild(document.createTextNode("«El veloz murciélago hindú comía feliz cardillo y kiwi.» Esto va en "));
    const negrita = document.createElement("strong");
    negrita.textContent = "negrita";
    texto.appendChild(negrita);
    texto.appendChild(document.createTextNode(", esto en "));
    const cursiva = document.createElement("em");
    cursiva.textContent = "cursiva";
    texto.appendChild(cursiva);
    texto.appendChild(document.createTextNode(" y esto es "));
    const enlace = document.createElement("span");
    enlace.className = "ajustes-ejemplo-enlace";
    enlace.textContent = "un enlace";
    texto.appendChild(enlace);
    texto.appendChild(document.createTextNode("."));
    dentro.appendChild(texto);
    const letras = document.createElement("p");
    letras.className = "ajustes-ejemplo-letras";
    letras.textContent = AJUSTES_CARACTERES;
    dentro.appendChild(letras);
    const letrasMono = document.createElement("p");
    letrasMono.className = "ajustes-ejemplo-letras ajustes-ejemplo-letras-mono";
    letrasMono.textContent = AJUSTES_CARACTERES;
    dentro.appendChild(letrasMono);
    const botones = document.createElement("p");
    botones.className = "ajustes-ejemplo-botones";
    const macizo = document.createElement("span");
    macizo.className = "ajustes-ejemplo-boton ajustes-ejemplo-boton-macizo";
    macizo.textContent = "botón macizo";
    const hueco = document.createElement("span");
    hueco.className = "ajustes-ejemplo-boton";
    hueco.textContent = "botón hueco";
    botones.appendChild(macizo);
    botones.appendChild(hueco);
    dentro.appendChild(botones);
    const datos = document.createElement("p");
    datos.className = "ajustes-ejemplo-datos";
    datos.appendChild(document.createTextNode("28 sept 2026 · 3 min · "));
    const etiqueta = document.createElement("span");
    etiqueta.className = "entry-tag";
    etiqueta.textContent = "diario";
    datos.appendChild(etiqueta);
    dentro.appendChild(datos);
    caja.appendChild(dentro);
    return caja;
}
function armarAjustesReiniciar() {
    const fila = document.createElement("div");
    fila.className = "ajustes-fila ajustes-fila-reiniciar";
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "ajustes-reiniciar";
    boton.setAttribute("data-ajustes-reiniciar", "");
    const icono = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icono.setAttribute("class", "ajustes-reiniciar-icono");
    icono.setAttribute("viewBox", "0 0 24 24");
    icono.setAttribute("aria-hidden", "true");
    icono.setAttribute("focusable", "false");
    [
        "M4.5 10.5A8 8 0 1 1 5.6 16",
        "M3.4 4.6v6h6",
    ].forEach((d) => {
        const trazo = document.createElementNS("http://www.w3.org/2000/svg", "path");
        trazo.setAttribute("d", d);
        trazo.setAttribute("fill", "none");
        trazo.setAttribute("stroke", "currentColor");
        trazo.setAttribute("stroke-width", "2.4");
        trazo.setAttribute("stroke-linecap", "round");
        trazo.setAttribute("stroke-linejoin", "round");
        icono.appendChild(trazo);
    });
    boton.appendChild(icono);
    const nombre = document.createElement("span");
    nombre.textContent = "reiniciar cambios";
    boton.appendChild(nombre);
    fila.appendChild(boton);
    const aviso = document.createElement("p");
    aviso.className = "ajustes-reiniciar-aviso";
    aviso.setAttribute("role", "status");
    aviso.setAttribute("data-ajustes-reiniciado", "");
    aviso.hidden = true;
    aviso.textContent = "Listo: todo ha vuelto a como venía de fábrica.";
    fila.appendChild(aviso);
    return fila;
}
function armarAjustesPie() {
    const pie = document.createElement("p");
    pie.className = "ajustes-pie";
    pie.appendChild(
        document.createTextNode(
            "Lo elegido se queda guardado en este navegador para la próxima visita. "
        )
    );
    const enlace = document.createElement("a");
    enlace.href = "/web/accesibilidad/accesibilidad.html";
    enlace.textContent = "Más sobre la accesibilidad de la web";
    pie.appendChild(enlace);
    return pie;
}
function leerAjuste(clave, porDefecto, esNumero) {
    try {
        const valor = localStorage.getItem(clave);
        if (valor === null) {
            return porDefecto;
        }
        return esNumero ? parseFloat(valor) : valor;
    } catch (error) {
        return porDefecto;
    }
}
function guardarAjuste(clave, valor, esElDeSiempre) {
    try {
        if (esElDeSiempre) {
            localStorage.removeItem(clave);
        } else {
            localStorage.setItem(clave, String(valor));
        }
    } catch (error) {
    }
}
function pasoDeAjustes(escala) {
    if (!isFinite(escala) || escala <= 0) {
        return AJUSTES_TAMANOS.indexOf(1);
    }
    let mejor = 0;
    for (let i = 1; i < AJUSTES_TAMANOS.length; i += 1) {
        if (Math.abs(AJUSTES_TAMANOS[i] - escala) < Math.abs(AJUSTES_TAMANOS[mejor] - escala)) {
            mejor = i;
        }
    }
    return mejor;
}
function aplicarAjustesTamano(paso, guardar) {
    paso = Math.min(AJUSTES_TAMANOS.length - 1, Math.max(0, Math.round(paso) || 0));
    AJUSTES.paso = paso;
    const escala = AJUSTES_TAMANOS[paso];
    document.documentElement.style.setProperty("--escala", escala);
    if (guardar) {
        guardarAjuste(AJUSTES_GUARDADO_TAMANO, escala, escala === 1);
    }
    if (AJUSTES.rango) {
        AJUSTES.rango.value = String(paso);
        AJUSTES.rango.setAttribute("aria-valuetext", `${Math.round(escala * 100)}%`);
    }
    const valor = AJUSTES.ventana.querySelector("[data-tamano-valor]");
    if (valor) {
        valor.textContent = `${Math.round(escala * 100)}%`;
    }
}
function engancharAjustesOpciones(cual) {
    AJUSTES.ventana.querySelectorAll(`[data-${cual}]`).forEach((boton) => {
        boton.addEventListener("click", () => {
            ponerAjuste(cual, boton.getAttribute(`data-${cual}`), true);
            pintarAjustesOpciones();
            document.dispatchEvent(new CustomEvent("ajustes:actualizar"));
        });
    });
}
function ponerAjuste(cual, valor, guardar) {
    const raiz = document.documentElement;
    if (valor) {
        raiz.setAttribute(`data-${cual}`, valor);
    } else {
        raiz.removeAttribute(`data-${cual}`);
    }
    if (guardar) {
        const claves = {
            interlineado: AJUSTES_GUARDADO_INTERLINEADO,
            letra: AJUSTES_GUARDADO_LETRA,
            voz: AJUSTES_GUARDADO_VOZ,
            movimiento: AJUSTES_GUARDADO_MOVIMIENTO,
        };
        guardarAjuste(claves[cual], valor, !valor);
    }
}
function pintarAjustesOpciones() {
    const raiz = document.documentElement;
    const ahora = {
        interlineado: raiz.getAttribute("data-interlineado") || "",
        letra: raiz.getAttribute("data-letra") || "",
        voz: raiz.getAttribute("data-voz") || "",
        movimiento: raiz.getAttribute("data-movimiento") || "",
    };
    ["interlineado", "letra", "voz", "movimiento"].forEach((cual) => {
        AJUSTES.ventana.querySelectorAll(`[data-${cual}]`).forEach((boton) => {
            const suyo = boton.getAttribute(`data-${cual}`);
            boton.setAttribute("aria-pressed", suyo === ahora[cual] ? "true" : "false");
        });
    });
}
function ponerAjustesCrt(encendido, guardar) {
    const raiz = document.documentElement;
    if (encendido) {
        raiz.dataset.crt = "si";
    } else {
        delete raiz.dataset.crt;
    }
    if (guardar) {
        guardarAjuste(AJUSTES_GUARDADO_CRT, "si", !encendido);
    }
    pintarAjustesCrt();
}
function pintarAjustesCrt() {
    const boton = AJUSTES.ventana.querySelector("[data-crt-boton]");
    if (!boton) {
        return;
    }
    const encendido = document.documentElement.dataset.crt === "si";
    boton.setAttribute("aria-pressed", encendido ? "true" : "false");
    boton.setAttribute(
        "aria-label",
        encendido
            ? "Quitar el filtro CRT"
            : "Poner el filtro CRT"
    );
    const estado = boton.querySelector("[data-crt-estado]");
    if (estado) {
        estado.textContent = encendido ? "ON" : "OFF";
    }
}
function reiniciarAjustes() {
    aplicarAjustesTamano(AJUSTES_TAMANOS.indexOf(1), true);
    ponerAjuste("interlineado", "", true);
    ponerAjuste("letra", "", true);
    ponerAjuste("voz", "", true);
    ponerAjuste("movimiento", "", true);
    ponerAjustesCrt(false, true);
    pintarAjustesOpciones();
    document.dispatchEvent(new CustomEvent("ajustes:actualizar"));
    if (typeof olvidarTemaGuardado === "function") {
        olvidarTemaGuardado();
    }
    const brillito = document.getElementById("cursor-trail-toggle");
    if (brillito && brillito.getAttribute("aria-pressed") === "false") {
        brillito.click();
    }
    const aviso = AJUSTES.ventana.querySelector("[data-ajustes-reiniciado]");
    if (aviso) {
        aviso.hidden = false;
        window.clearTimeout(AJUSTES.avisoReloj);
        AJUSTES.avisoReloj = window.setTimeout(() => {
            aviso.hidden = true;
        }, 4000);
    }
}

/* ======== /scripts/componentes/buscar-lupa.js ======== */
const LUPA = {
    ventana: null,
    boton: null,
};
document.addEventListener("sidebar:loaded", initializeBuscarLupa);
function initializeBuscarLupa() {
    const boton = document.querySelector("[data-buscar-lupa]");
    const ventana = document.querySelector("[data-buscar-modal]");
    if (!boton || !ventana || LUPA.ventana) {
        return;
    }
    LUPA.boton = boton;
    LUPA.ventana = ventana;
    boton.addEventListener("click", abrirLupa);
    const cerrar = ventana.querySelector("[data-buscar-modal-cerrar]");
    if (cerrar) {
        cerrar.addEventListener("click", () => ventana.close());
    }
    ventana.addEventListener("click", (evento) => {
        if (evento.target === ventana) {
            ventana.close();
        }
    });
}
function abrirLupa() {
    if (LUPA.ventana.open) {
        return;
    }
    LUPA.ventana.showModal();
    const campo = LUPA.ventana.querySelector(".buscar-form-campo");
    if (campo) {
        campo.focus();
        campo.select();
    }
}

/* ======== /scripts/componentes/botones-ventana.js ======== */
const WINDOW_CONTROLS_ICONOS = {
    minimizar:
        '<rect x="4" y="10.75" width="16" height="2.5" rx="0.6" fill="currentColor"/>',
    maximizar: '<rect x="5.5" y="5.5" width="13" height="13" fill="currentColor"/>',
    cerrar:
        '<path d="M5.5 5.5L18.5 18.5M18.5 5.5L5.5 18.5" fill="none"' +
        ' stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
};
const WINDOW_CONTROLS_ACCIONES = {
    minimizar: "plegar",
    maximizar: "desplegar",
    cerrar: "cerrar",
};
const WINDOW_CONTROLS_MARKUP = Object.keys(WINDOW_CONTROLS_ICONOS)
    .map(
        (nombre) =>
            '<span class="window-btn" data-ventana-accion="' +
            WINDOW_CONTROLS_ACCIONES[nombre] +
            '">' +
            '<svg class="window-btn-icono" viewBox="0 0 24 24" aria-hidden="true"' +
            ' focusable="false">' +
            WINDOW_CONTROLS_ICONOS[nombre] +
            "</svg></span>"
    )
    .join("");
initializeWindowControlsComponent();
document.addEventListener("sidebar:loaded", initializeWindowControlsComponent);
document.addEventListener("ventanas:actualizar", initializeWindowControlsComponent);
function initializeWindowControlsComponent() {
    document.querySelectorAll("[data-window-controls]").forEach((mount) => {
        mount.innerHTML = WINDOW_CONTROLS_MARKUP;
    });
}

/* ======== /scripts/componentes/ventanas-plegables.js ======== */
const VENTANA_BARRAS =
    ".recent-entries-header, .gatin-random-header, .pet-window-header";
let ventanaContador = 0;
prepararVentanasPlegables();
document.addEventListener("sidebar:loaded", prepararVentanasPlegables);
document.addEventListener("ventanas:actualizar", prepararVentanasPlegables);
document.addEventListener("click", alPulsarEnVentana);
function prepararVentanasPlegables() {
    document.querySelectorAll(VENTANA_BARRAS).forEach(prepararVentana);
}
function prepararVentana(barra) {
    if (barra.dataset.ventanaLista === "si") {
        return;
    }
    const ventana = barra.parentElement;
    if (!ventana) {
        return;
    }
    barra.dataset.ventanaLista = "si";
    barra.classList.add("ventana-barra");
    ventana.classList.add("ventana-plegable");
    const titulo = barra.querySelector("h1, h2, h3, h4, h5, h6");
    const mando = document.createElement("button");
    mando.type = "button";
    mando.className = "ventana-barra-mando";
    mando.dataset.ventanaMando = "si";
    mando.setAttribute("aria-expanded", "true");
    if (titulo) {
        mando.setAttribute("aria-labelledby", idDeTituloDeVentana(titulo));
    } else {
        mando.setAttribute("aria-label", "plegar o abrir esta ventana");
    }
    barra.appendChild(mando);
}
function idDeTituloDeVentana(titulo) {
    if (titulo.id) {
        return titulo.id;
    }
    let id = "";
    do {
        ventanaContador += 1;
        id = "ventana-titulo-" + ventanaContador;
    } while (document.getElementById(id));
    titulo.id = id;
    return id;
}
function alPulsarEnVentana(evento) {
    const barra = evento.target.closest(".ventana-barra");
    if (!barra) {
        return;
    }
    const ventana = barra.parentElement;
    if (!ventana || !ventana.classList.contains("ventana-plegable")) {
        return;
    }
    const boton = evento.target.closest("[data-ventana-accion]");
    const accion = boton ? boton.dataset.ventanaAccion : "";
    if (accion === "cerrar") {
        return;
    }
    if (accion === "plegar" || accion === "desplegar") {
        plegarVentana(ventana, accion === "plegar");
        return;
    }
    const suyo = evento.target.closest("a, button, input, select, textarea");
    if (suyo && suyo.dataset.ventanaMando !== "si") {
        return;
    }
    plegarVentana(ventana, ventana.dataset.plegada !== "si");
}
function plegarVentana(ventana, plegada) {
    if (plegada) {
        ventana.dataset.plegada = "si";
    } else {
        delete ventana.dataset.plegada;
    }
    soltarVentana(ventana, plegada);
    const mando = ventana.querySelector(
        ":scope > .ventana-barra > .ventana-barra-mando"
    );
    if (mando) {
        mando.setAttribute("aria-expanded", plegada ? "false" : "true");
    }
}
function soltarVentana(ventana, plegada) {
    if (!plegada) {
        ventana.style.alignSelf = "";
        ventana.style.flex = "";
        return;
    }
    const padre = ventana.parentElement;
    const comoVa = padre ? getComputedStyle(padre) : null;
    const esFlex =
        comoVa && (comoVa.display === "flex" || comoVa.display === "inline-flex");
    if (esFlex && comoVa.flexDirection.indexOf("column") === 0) {
        ventana.style.flex = "0 0 auto";
    } else {
        ventana.style.alignSelf = "start";
    }
}

/* ======== /scripts/componentes/rastro-cursor.js ======== */
const CURSOR_TRAIL_STORAGE_KEY = "richi-cursor-trail";
const CURSOR_TRAIL_MIN_DISTANCE = 24;
const CURSOR_TRAIL_LIFETIME = 700;
const CURSOR_TRAIL_OFFSET_Y = 16;
const CURSOR_TRAIL_EMOJIS = ["✦","🟐","✵","⛤","★", "☆", "✦", "✧", "✪", "✫", "✬", "✭", "✮", "✯", "✰", "✱", "✲", "✳", "✴", "✵", "✶", "✷", "✸", "✹", "✺", "✻", "✼", "✽", "❂"];
let cursorTrailEnabled = true;
let lastParticleX = null;
let lastParticleY = null;
document.addEventListener("sidebar:loaded", initializeCursorTrailToggle);
initializeCursorTrail();
function initializeCursorTrail() {
    if (prefersReducedMotion()) {
        cursorTrailEnabled = false;
    } else {
        const saved = readSavedPreference();
        if (saved !== null) {
            cursorTrailEnabled = saved;
        }
    }
    document.addEventListener("mousemove", handleMouseMove);
}
function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function handleMouseMove(event) {
    if (!cursorTrailEnabled) {
        return;
    }
    if (lastParticleX !== null) {
        const dx = event.clientX - lastParticleX;
        const dy = event.clientY - lastParticleY;
        if (Math.sqrt(dx * dx + dy * dy) < CURSOR_TRAIL_MIN_DISTANCE) {
            return;
        }
    }
    lastParticleX = event.clientX;
    lastParticleY = event.clientY;
    spawnParticle(event.clientX, event.clientY);
}
function spawnParticle(x, y) {
    const particle = document.createElement("span");
    particle.className = "cursor-particle";
    particle.textContent =
        CURSOR_TRAIL_EMOJIS[Math.floor(Math.random() * CURSOR_TRAIL_EMOJIS.length)];
    particle.style.left = `${x}px`;
    particle.style.top = `${y + CURSOR_TRAIL_OFFSET_Y}px`;
    particle.style.fontSize = `${10 + Math.random() * 6}px`;
    particle.setAttribute("aria-hidden", "true");
    document.body.appendChild(particle);
    window.setTimeout(() => {
        particle.remove();
    }, CURSOR_TRAIL_LIFETIME);
}
function initializeCursorTrailToggle() {
    const button = document.getElementById("cursor-trail-toggle");
    if (!button) {
        return;
    }
    applyCursorTrailState(button);
    button.addEventListener("click", () => {
        cursorTrailEnabled = !cursorTrailEnabled;
        applyCursorTrailState(button);
        saveCursorTrailPreference(cursorTrailEnabled);
    });
}
function applyCursorTrailState(button) {
    button.setAttribute("aria-pressed", cursorTrailEnabled ? "true" : "false");
    button.setAttribute(
        "aria-label",
        cursorTrailEnabled
            ? "Desactivar el rastro del cursor"
            : "Activar el rastro del cursor"
    );
    const text = button.querySelector(".cursor-trail-toggle-text");
    if (text) {
        text.textContent = cursorTrailEnabled ? "BRILLITO: ON" : "BRILLITO: OFF";
    }
}
function saveCursorTrailPreference(enabled) {
    try {
        if (enabled) {
            localStorage.removeItem(CURSOR_TRAIL_STORAGE_KEY);
        } else {
            localStorage.setItem(CURSOR_TRAIL_STORAGE_KEY, "false");
        }
    } catch (error) {
    }
}
function readSavedPreference() {
    try {
        const saved = localStorage.getItem(CURSOR_TRAIL_STORAGE_KEY);
        return saved === null ? null : saved === "true";
    } catch (error) {
        return null;
    }
}

/* ======== /scripts/componentes/chispas-botones.js ======== */
const WINDOW_BTN_SYMBOLS = ["✨", "⭐", "✦", "✧"];
const WINDOW_BTN_PARTICLES = 10;
const WINDOW_BTN_LIFETIME = 700;
initializeWindowBtnEffects();
function initializeWindowBtnEffects() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }
    document.addEventListener("click", (event) => {
        const button = event.target.closest(".window-btn");
        if (!button) {
            return;
        }
        const enBarra = button.closest(".ventana-barra");
        if (enBarra && button.dataset.ventanaAccion !== "cerrar") {
            return;
        }
        spawnWindowBtnBurst(event.clientX, event.clientY);
    });
}
function spawnWindowBtnBurst(x, y) {
    for (let i = 0; i < WINDOW_BTN_PARTICLES; i++) {
        const angle = (Math.PI * 2 * i) / WINDOW_BTN_PARTICLES;
        const distance = 30 + Math.random() * 30;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        spawnWindowBtnParticle(x, y, dx, dy);
    }
}
function spawnWindowBtnParticle(x, y, dx, dy) {
    const particle = document.createElement("span");
    particle.className = "firework-particle";
    particle.textContent =
        WINDOW_BTN_SYMBOLS[Math.floor(Math.random() * WINDOW_BTN_SYMBOLS.length)];
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.fontSize = "0.75rem";
    particle.style.setProperty("--dx", `${dx}px`);
    particle.style.setProperty("--dy", `${dy}px`);
    particle.setAttribute("aria-hidden", "true");
    document.body.appendChild(particle);
    window.setTimeout(() => {
        particle.remove();
    }, WINDOW_BTN_LIFETIME);
}

/* ======== /scripts/componentes/enlaces-fuera.js ======== */
initializeEnlacesFuera();
vigilarEnlacesFuera();
function initializeEnlacesFuera() {
    document.querySelectorAll("a[href]").forEach(marcarEnlaceFuera);
}
function vigilarEnlacesFuera() {
    if (typeof MutationObserver !== "function") {
        return;
    }
    let pendiente = false;
    const vigilante = new MutationObserver(() => {
        if (pendiente) {
            return;
        }
        pendiente = true;
        window.requestAnimationFrame(() => {
            pendiente = false;
            vigilante.disconnect();
            initializeEnlacesFuera();
            encender();
        });
    });
    function encender() {
        vigilante.observe(document.body, { childList: true, subtree: true });
    }
    encender();
}
function marcarEnlaceFuera(enlace) {
    if (enlace.dataset.fueraVisto === "si") {
        return;
    }
    enlace.dataset.fueraVisto = "si";
    if (!saleDeLaWeb(enlace)) {
        return;
    }
    const yaDice = (enlace.textContent || "").toLowerCase();
    const avisaDePestana = yaDice.indexOf("pestaña") !== -1 || yaDice.indexOf("ventana") !== -1;
    const avisaDeFuera = yaDice.indexOf("externo") !== -1;
    const partes = [];
    if (!avisaDeFuera) {
        partes.push("enlace externo");
    }
    if (enlace.target === "_blank" && !avisaDePestana) {
        partes.push("se abre en otra pestaña");
    }
    if (partes.length) {
        const aviso = document.createElement("span");
        aviso.className = "visually-hidden";
        aviso.textContent = " (" + partes.join(", ") + ")";
        enlace.appendChild(aviso);
    }
    if (tieneTextoFuera(enlace)) {
        enlace.classList.add("enlace-fuera");
    }
}
function saleDeLaWeb(enlace) {
    const destino = enlace.getAttribute("href") || "";
    if (!/^https?:/i.test(destino)) {
        return false;
    }
    try {
        const suyo = new URL(destino, window.location.href).host;
        return sinWww(suyo) !== sinWww(window.location.host);
    } catch (error) {
        return false;
    }
}
function sinWww(host) {
    return host.replace(/^www\./i, "");
}
function tieneTextoFuera(enlace) {
    const copia = enlace.cloneNode(true);
    copia.querySelectorAll(".visually-hidden").forEach((n) => n.remove());
    return (copia.textContent || "").trim().length > 0;
}

/* ======== /scripts/componentes/visor-imagenes.js ======== */
let lightboxOverlay = null;
let lightboxImage = null;
let lightboxLastTrigger = null;
initializeLightbox();
function initializeLightbox() {
    document.addEventListener("click", (event) => {
        const trigger = event.target.closest(".lightbox-trigger");
        if (trigger) {
            openLightbox(trigger);
            return;
        }
        if (event.target.closest(".lightbox-close") || event.target === lightboxOverlay) {
            closeLightbox();
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && lightboxOverlay) {
            closeLightbox();
        }
    });
}
function ensureOverlay() {
    if (lightboxOverlay) {
        return;
    }
    lightboxOverlay = document.createElement("div");
    lightboxOverlay.className = "lightbox-overlay";
    lightboxOverlay.setAttribute("role", "dialog");
    lightboxOverlay.setAttribute("aria-modal", "true");
    lightboxOverlay.setAttribute("aria-label", "Imagen ampliada");
    lightboxOverlay.hidden = true;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "lightbox-close";
    closeBtn.setAttribute("aria-label", "Cerrar imagen ampliada");
    closeBtn.textContent = "✕";
    lightboxImage = document.createElement("img");
    lightboxImage.className = "lightbox-image";
    lightboxImage.alt = "";
    lightboxOverlay.appendChild(closeBtn);
    lightboxOverlay.appendChild(lightboxImage);
    document.body.appendChild(lightboxOverlay);
}
let lightboxInertados = [];
function setBackgroundInert(isInert) {
    if (isInert) {
        lightboxInertados = Array.from(document.body.children).filter(
            (el) => el !== lightboxOverlay && !el.inert
        );
        lightboxInertados.forEach((el) => {
            el.inert = true;
        });
        return;
    }
    lightboxInertados.forEach((el) => {
        el.inert = false;
    });
    lightboxInertados = [];
}
function openLightbox(trigger) {
    const img = trigger.querySelector("img");
    if (!img) {
        return;
    }
    ensureOverlay();
    lightboxImage.src = imagenSeguraLightbox(
        trigger.dataset.completa || img.currentSrc || img.src
    );
    lightboxImage.alt = img.alt || "";
    lightboxOverlay.hidden = false;
    document.body.classList.add("lightbox-open");
    lightboxLastTrigger = trigger;
    setBackgroundInert(true);
    const closeBtn = lightboxOverlay.querySelector(".lightbox-close");
    closeBtn.focus();
}
function imagenSeguraLightbox(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)
        || /^data:image\//i.test(limpia)) {
        return limpia;
    }
    return "";
}
function closeLightbox() {
    if (!lightboxOverlay || lightboxOverlay.hidden) {
        return;
    }
    setBackgroundInert(false);
    lightboxOverlay.hidden = true;
    lightboxImage.src = "";
    document.body.classList.remove("lightbox-open");
    if (lightboxLastTrigger) {
        lightboxLastTrigger.focus();
        lightboxLastTrigger = null;
    }
}

/* ======== /scripts/componentes/aviso.js ======== */
const NOTICE_DELAY = 700;
initializeNoticeComponent();
function initializeNoticeComponent() {
    document.querySelectorAll("[data-notice]").forEach(setUpNotice);
}
function setUpNotice(notice) {
    const storageKey = notice.getAttribute("data-notice-key");
    const dismissBtn = notice.querySelector("[data-notice-dismiss]");
    if (!storageKey || !dismissBtn) {
        return;
    }
    let alreadySeen = false;
    try {
        alreadySeen = localStorage.getItem(storageKey) === "true";
    } catch (error) {
    }
    if (alreadySeen) {
        return;
    }
    const cuerpo = notice.querySelector(".notice-body");
    const revisarScroll = () => {
        if (!cuerpo) {
            return;
        }
        const quedaPorVer = cuerpo.scrollHeight - cuerpo.clientHeight - cuerpo.scrollTop;
        notice.classList.toggle("has-scroll", quedaPorVer > 4);
    };
    window.setTimeout(() => {
        notice.hidden = false;
        revisarScroll();
    }, NOTICE_DELAY);
    if (cuerpo) {
        cuerpo.addEventListener("scroll", revisarScroll, { passive: true });
        window.addEventListener("resize", revisarScroll, { passive: true });
    }
    const closeNotice = () => {
        notice.hidden = true;
        try {
            localStorage.setItem(storageKey, "true");
        } catch (error) {
        }
    };
    dismissBtn.addEventListener("click", closeNotice);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !notice.hidden) {
            closeNotice();
        }
    });
}

/* ======== /scripts/componentes/subir.js ======== */
const SUBIR_UMBRAL = 240;
let subirBoton = null;
let subirContenedor = null;
const SUBIR_ICONO =
    '<svg class="subir-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M12 20V6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path d="M5.5 12.5L12 6L18.5 12.5" fill="none" stroke="currentColor" stroke-width="2.6"' +
    ' stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";
initializeSubir();
function initializeSubir() {
    subirContenedor = buscarContenedor();
    if (!subirContenedor) {
        return;
    }
    subirBoton = document.createElement("button");
    subirBoton.type = "button";
    subirBoton.className = "subir";
    subirBoton.innerHTML = SUBIR_ICONO + '<span class="visually-hidden">Volver arriba</span>';
    subirBoton.addEventListener("click", volverArriba);
    document.body.appendChild(subirBoton);
    subirContenedor.addEventListener("scroll", actualizarSubir, { passive: true });
    window.addEventListener("resize", actualizarSubir, { passive: true });
    actualizarSubir();
}
function buscarContenedor() {
    return document.querySelector("main > section") || document.querySelector("main");
}
function actualizarSubir() {
    if (!subirBoton || !subirContenedor) {
        return;
    }
    const bajado = subirContenedor.scrollTop > SUBIR_UMBRAL;
    subirBoton.classList.toggle("is-visible", bajado);
    subirBoton.inert = !bajado;
}
function volverArriba() {
    const sinAnimacion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    subirContenedor.scrollTo({ top: 0, behavior: sinAnimacion ? "auto" : "smooth" });
    const yaEnfocable = subirContenedor.getAttribute("tabindex") !== null;
    if (!yaEnfocable) {
        subirContenedor.setAttribute("tabindex", "-1");
        subirContenedor.addEventListener(
            "blur",
            () => subirContenedor.removeAttribute("tabindex"),
            { once: true }
        );
    }
    subirContenedor.focus({ preventScroll: true });
}

/* ======== /scripts/componentes/teclado-scroll.js ======== */
const TECLADO_SALTO_LINEA = 0.12;
const TECLADO_SALTO_PAGINA = 0.9;
const TECLADO_ESCRIBIENDO = ["INPUT", "TEXTAREA", "SELECT"];
const TECLADO_PULSABLES = ["BUTTON", "A", "SUMMARY", "INPUT", "TEXTAREA", "SELECT", "OPTION"];
const TECLADO_CON_PAPEL = ["UL", "OL", "DL", "TABLE"];
const TECLADO_ENFOCABLE =
    'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
let tecladoMarcada = null;
initializeTecladoScroll();
function initializeTecladoScroll() {
    if (!document.querySelector("main")) {
        return;
    }
    const marcarTodo = () => {
        marcarRegion();
        marcarCajas();
    };
    marcarTodo();
    window.setTimeout(marcarTodo, 900);
    window.addEventListener("resize", marcarTodo, { passive: true });
    window.addEventListener("load", marcarTodo);
    document.addEventListener("keydown", manejarTecla);
}
function buscarPagina() {
    const seccion = document.querySelector("main > section");
    if (seccion && puedeDesplazarse(seccion)) {
        return seccion;
    }
    const principal = document.querySelector("main");
    if (!principal) {
        return null;
    }
    if (puedeDesplazarse(principal)) {
        return principal;
    }
    let mejor = null;
    principal.querySelectorAll("*").forEach((nodo) => {
        if (!puedeDesplazarse(nodo)) {
            return;
        }
        if (!mejor || nodo.clientHeight > mejor.clientHeight) {
            mejor = nodo;
        }
    });
    return mejor;
}
function marcarRegion() {
    const pagina = buscarPagina();
    if (tecladoMarcada && tecladoMarcada !== pagina) {
        desmarcar(tecladoMarcada);
        tecladoMarcada = null;
    }
    if (!pagina) {
        return;
    }
    if (pagina.getAttribute("role") === "region" && pagina !== tecladoMarcada) {
        return;
    }
    marcar(pagina, "Contenido de la página, con scroll");
    tecladoMarcada = pagina;
}
function marcar(zona, nombre) {
    if (zona.getAttribute("tabindex") === null) {
        zona.setAttribute("tabindex", "0");
    }
    if (TECLADO_CON_PAPEL.indexOf(zona.tagName) === -1 && !zona.hasAttribute("role")) {
        zona.setAttribute("role", "region");
        zona.setAttribute("data-teclado-rol", "");
    }
    if (!zona.hasAttribute("aria-label") && !zona.hasAttribute("aria-labelledby")) {
        zona.setAttribute("aria-label", nombre);
        zona.setAttribute("data-teclado-nombre", "");
    }
    zona.setAttribute("data-teclado-marca", "");
}
function desmarcar(zona) {
    if (zona.getAttribute("tabindex") === "0") {
        zona.removeAttribute("tabindex");
    }
    if (zona.hasAttribute("data-teclado-rol")) {
        zona.removeAttribute("role");
    }
    if (zona.hasAttribute("data-teclado-nombre")) {
        zona.removeAttribute("aria-label");
    }
    zona.removeAttribute("data-teclado-rol");
    zona.removeAttribute("data-teclado-nombre");
    zona.removeAttribute("data-teclado-marca");
}
function marcarCajas() {
    const principal = document.querySelector("main");
    if (!principal) {
        return;
    }
    principal.querySelectorAll("[data-teclado-marca]").forEach((zona) => {
        if (zona !== tecladoMarcada && !puedeDesplazarse(zona)) {
            desmarcar(zona);
        }
    });
    principal.querySelectorAll("*").forEach((zona) => {
        if (zona === tecladoMarcada || zona.hasAttribute("data-teclado-marca")) {
            return;
        }
        if (!puedeDesplazarse(zona) && !seSaleDeLado(zona)) {
            return;
        }
        if (zona.getAttribute("tabindex") !== null || zona.querySelector(TECLADO_ENFOCABLE)) {
            return;
        }
        marcar(zona, nombreDeCaja(zona));
    });
}
function nombreDeCaja(zona) {
    if (zona.querySelector("table") || zona.tagName === "TABLE") {
        const leyenda = zona.querySelector("caption");
        let titulo = leyenda ? leyenda.textContent.trim() : "";
        for (let antes = zona.previousElementSibling; !titulo && antes; antes = antes.previousElementSibling) {
            if (/^H[2-6]$/.test(antes.tagName)) {
                titulo = antes.textContent.trim();
            }
        }
        return titulo ? "Tabla: " + titulo + ", con scroll" : "Tabla, con scroll";
    }
    const ventana = zona.closest(".recent-entries, .character-card");
    const titulo = ventana && ventana.querySelector("h2, h3");
    const texto = titulo ? titulo.textContent.trim() : "";
    return texto ? texto + ", con scroll" : "Zona con scroll";
}
function seSaleDeLado(elemento) {
    if (!elemento || elemento.scrollWidth - elemento.clientWidth <= 1) {
        return false;
    }
    const como = window.getComputedStyle(elemento).overflowX;
    return como === "auto" || como === "scroll";
}
function manejarTecla(evento) {
    if (evento.defaultPrevented || evento.ctrlKey || evento.metaKey || evento.altKey) {
        return;
    }
    const destino = evento.target;
    const etiqueta = destino && destino.tagName ? destino.tagName : "";
    if (TECLADO_ESCRIBIENDO.indexOf(etiqueta) !== -1) {
        return;
    }
    if (destino && destino.isContentEditable) {
        return;
    }
    const visor = document.querySelector(".lightbox-overlay:not([hidden])");
    if (visor) {
        return;
    }
    const zona = buscarZona(destino);
    if (!zona) {
        return;
    }
    const alto = zona.clientHeight;
    let salto = null;
    switch (evento.key) {
        case "ArrowDown":
            salto = Math.max(40, Math.round(alto * TECLADO_SALTO_LINEA));
            break;
        case "ArrowUp":
            salto = -Math.max(40, Math.round(alto * TECLADO_SALTO_LINEA));
            break;
        case "PageDown":
            salto = Math.round(alto * TECLADO_SALTO_PAGINA);
            break;
        case "PageUp":
            salto = -Math.round(alto * TECLADO_SALTO_PAGINA);
            break;
        case " ":
        case "Spacebar":
            if (TECLADO_PULSABLES.indexOf(etiqueta) !== -1) {
                return;
            }
            if (destino && destino.getAttribute && destino.getAttribute("role") === "button") {
                return;
            }
            salto = Math.round(alto * TECLADO_SALTO_PAGINA) * (evento.shiftKey ? -1 : 1);
            break;
        case "Home":
            evento.preventDefault();
            mover(zona, -zona.scrollTop);
            return;
        case "End":
            evento.preventDefault();
            mover(zona, zona.scrollHeight - zona.clientHeight - zona.scrollTop);
            return;
        default:
            return;
    }
    evento.preventDefault();
    mover(zona, salto);
}
function buscarZona(destino) {
    let nodo = destino && destino.nodeType === 1 ? destino : null;
    while (nodo && nodo !== document.body) {
        if (puedeDesplazarse(nodo)) {
            return nodo;
        }
        nodo = nodo.parentElement;
    }
    return buscarPagina();
}
function puedeDesplazarse(elemento) {
    if (!elemento || elemento.scrollHeight - elemento.clientHeight <= 4) {
        return false;
    }
    const como = window.getComputedStyle(elemento).overflowY;
    return como === "auto" || como === "scroll";
}
function mover(zona, salto) {
    if (salto === 0) {
        return;
    }
    const sinAnimacion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    zona.scrollBy({ top: salto, behavior: sinAnimacion ? "auto" : "smooth" });
}
