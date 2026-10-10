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
// =========================================
// CARGADOR GENÉRICO DE COMPONENTES
// =========================================
// Se encarga solo de pedir el fragmento HTML e inyectarlo en el
// contenedor indicado. No sabe nada sobre sidebar, quotes, ni
// ningún componente concreto — cada uno le pasa su propia
// función "onLoaded" para inicializarse después de inyectarse.
//
// Uso:
//   loadComponent("mi-contenedor", "/components/mi-cosa.html", () => {
//       inicializarMiCosa();
//   });
//
// CUIDADO CON EL AVISO: NO SE DA ANTES DE TIEMPO
// ----------------------------------------------
// El aviso de "ya está puesto" (onLoaded, y el sidebar:loaded que manda
// barra-lateral.js) espera a que el navegador haya terminado de leer la
// página. No es una manía: media docena de scripts se enganchan a ese
// aviso —el de los ajustes, el del tema, el del gatín, el de los
// enlaces de fuera— y todos van con defer, o sea que se ejecutan uno
// detrás de otro al final.
//
// Desde que el menú se pide en el <head> (ver actualizar-cabeceras.py),
// el trozo de HTML puede estar ya aquí cuando arranca barra-lateral.js.
// Si el aviso saliera en ese mismo momento, saldría ENTRE un script y el
// siguiente: los que vinieran detrás todavía no se habrían enganchado y
// se lo perderían. Pasó, y de la peor manera posible: el botón de
// accesibilidad aparecía pero no abría nada.
//
// Esperando a DOMContentLoaded no hay carrera que valga: para entonces
// se han ejecutado todos los scripts con defer, estén o no listos los
// fragmentos.

async function loadComponent(elementId, file, onLoaded) {
    const container = document.getElementById(elementId);
    if (!container) {
        return;
    }

    try {
        // ¿Lo pidió ya cargador-scripts.js nada más empezar? La barra
        // lateral sí: la pide él, antes de que el navegador termine de
        // leer la página, porque es lo primero que hace falta ver. Si
        // está, aquí no se pide nada; se espera a lo que ya venía de
        // camino. Si no (cualquier otro fragmento, o si aquello falló),
        // se pide ahora como siempre.
        const adelanto = window.adelantoDeFragmentos || {};
        let html = adelanto[file] ? await adelanto[file] : null;

        if (html === null) {
            // Con su versión en la dirección: si no, al cambiar la
            // barra lateral quien ya había entrado seguía viendo la de
            // antes (ver el comentario de cargador-scripts.js).
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

// La espera de arriba. Se prepara AQUÍ, al cargarse este archivo, y no
// dentro de loadComponent(): este archivo va con defer, así que esto
// corre seguro antes de que la página esté leída y el apunte llega a
// tiempo.
//
// Ojo con document.readyState, que para esto engaña: pasa a
// "interactive" en cuanto se acaba de leer el HTML, o sea ANTES de que
// se ejecuten los scripts con defer. Preguntarle si vale "loading" daba
// que no cuando todavía quedaban scripts por correr, que es justo el
// caso que esto quiere evitar. Solo "complete" (que llega más tarde, con
// las imágenes) es una respuesta de fiar.
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
// =========================================
// INICIALIZAR SIDEBAR
// =========================================

function initializeSidebar() {
    initializeDropdowns();
    initializeActivePage();
    initializeScrollFade();
    initializeMobileToggle();
}

// =========================================
// CAJÓN MÓVIL (ABRIR / CERRAR)
// =========================================

function initializeMobileToggle() {
    const toggle = document.getElementById("sidebar-toggle");
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (!toggle || !sidebar || !backdrop) {
        return;
    }

    const setBackgroundInert = (isInert) => {
        // Mientras el menú está abierto, el resto de la página queda
        // tapado por el fondo oscurecido: con "inert" dejan de poder
        // recibir foco por teclado (antes el Tab se "escapaba" hacia
        // contenido invisible) y los lectores de pantalla lo ignoran.
        //
        // Se marca TODO lo que cuelga de <body> menos el propio menú
        // (que vive dentro de #sidebar-container junto con la barra
        // superior y el fondo oscurecido). Antes esto se hacía a mano
        // elemento por elemento —main y las citas— y se quedaban
        // fuera el aviso emergente y el enlace de "saltar al
        // contenido", a los que el tabulador seguía llegando por
        // detrás del cajón. Hecho así, cualquier cosa que se añada
        // más adelante al body queda cubierta sola.
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

    // Si se pasa a un enlace del menú en móvil, cerrar el cajón.
    sidebar.querySelectorAll("nav a[href]").forEach((link) => {
        link.addEventListener("click", closeSidebar);
    });

    // Si la ventana deja de ser móvil estando el cajón abierto, limpiar el estado.
    window.addEventListener("resize", () => {
        if (window.innerWidth > 860 && sidebar.classList.contains("open")) {
            closeSidebar();
        }
    });
}

// =========================================
// DEGRADADO DE SCROLL
// =========================================

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

    // Abrir/cerrar un submenu cambia la altura del contenido,
    // así que también hay que recalcular en cada click.
    navEl.addEventListener("click", () => {
        // Esperamos a que el DOM aplique el cambio de "open".
        requestAnimationFrame(updateFade);
    });
}

// =========================================
// MENÚS DESPLEGABLES
// =========================================

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

// =========================================
// ACTUALIZAR FLECHA
// =========================================

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


// =========================================
// PÁGINA ACTIVA
// =========================================

// Marca un enlace del menú como el actual y le quita la marca a los
// demás.
//
// La clase "active" es solo el color; quien usa lector de pantalla no
// ve colores, así que además se pone aria-current, que es lo que hace
// que el lector diga "página actual" al pasar por ese enlace.
//
//   - "page"  -> el enlace lleva justo a esta página.
//   - "true"  -> el enlace lleva a la sección en la que estamos (por
//                ejemplo una entrada suelta dentro de /blog/): es el
//                sitio donde estamos, pero no exactamente esa página.
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

    // 1. Coincidencia exacta: siempre tiene prioridad.
    let bestMatch = candidates.find((item) => item.linkPath === currentPath) || null;
    let tipo = bestMatch ? "page" : "true";

    // 2. Si no hay match exacto, usamos la carpeta más específica que
    //    contenga la página actual (así páginas nuevas dentro de una
    //    carpeta, aunque no tengan su propio link, marcan activo el
    //    link de esa sección).
    if (!bestMatch) {
        candidates.forEach((item) => {
            // "/" (home, páginas sueltas en la raíz) queda fuera:
            // sería demasiado genérico y "atraparía" cualquier página.
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

// =========================================
// OBTENER RUTA DEL ENLACE
// =========================================

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


// =========================================
// NORMALIZAR RUTAS
// =========================================

function normalizePath(path) {
    if (!path) {
        return "/";
    }
    // Eliminar "/" final excepto si es la raíz
    if (path.length > 1 && path.endsWith("/")) {
        path = path.slice(0, -1);
    }
    // index.html y raíz representan la misma página
    if (path.endsWith("/index.html")) {
        path = path.replace("/index.html", "/");
    }
    if (path === "index.html") {
        path = "/";
    }
    return path;
}

// =========================================
// CARPETA DE UNA RUTA
// =========================================

function getFolderPath(path) {
    const idx = path.lastIndexOf("/");
    if (idx <= 0) {
        return "/";
    }
    return path.slice(0, idx + 1);
}

// =========================================
// ¿LA RUTA ACTUAL ESTÁ DENTRO DE ESA CARPETA?
// =========================================

function isInsideFolder(currentPath, folderPath) {
    return (currentPath + "/").startsWith(folderPath);
}

// =========================================
// ABRIR PADRES DE UN ENLACE ACTIVO
// =========================================

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

// =========================================
// MARCAR ENLACES AL HACER CLICK
// =========================================

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


// =========================================
// CARGAR SIDEBAR
// =========================================

loadComponent("sidebar-container", "/fragmentos/barra-lateral.html", () => {
    initializeSidebar();

    // Avisamos a quien esté escuchando (p.ej. tema.js)
    // de que el sidebar ya está en el DOM.
    document.dispatchEvent(new CustomEvent("sidebar:loaded"));
});

/* ======== /scripts/componentes/gatin-random.js ======== */
// =========================================
// COMPONENTE: GATÍN ALEATORIO (barra lateral)
// =========================================
// Enseña una foto al azar del santuario —de Tali o de Regis— debajo
// de la navegación. Al ser un sitio estático, cada enlace recarga la
// página entera: no hace falta ningún temporizador ni nada raro, con
// elegir una foto distinta en cada carga ya cambia sola al navegar.
//
// Lee el mismo datos/fotos-santuarios.json que la galería, así que las
// fotos nuevas que genere herramientas/2-imagenes/generar-galeria.py aparecen
// aquí solas, sin tocar este archivo.
//
// La miniatura es la que se ve; la foto grande solo se descarga si
// alguien la amplía, igual que en la galería. El visor ya escucha
// clics en cualquier .lightbox-trigger del documento (ver
// scripts/componentes/visor-imagenes.js), así que no hay que engancharlo aquí.
//
// El botón 🔁 saca otra foto sin recargar: el listado se queda en
// memoria desde la primera vez, así que no vuelve a pedir el JSON.

const GATIN_FOTOS_URL = "/datos/fotos-santuarios.json";
// Se recuerda la última foto enseñada para no repetirla en la
// siguiente página: con dos o tres fotos, el azar puro repite
// demasiado y parece que el cuadro esté roto.
const GATIN_ULTIMA_CLAVE = "richi-gatin-ultimo";

// Icono de recargar, dibujado a mano en SVG en vez de usar un emoji o
// un carácter tipo ↻. Con un glifo, el dibujo sale de la fuente que
// tenga instalada quien visita la web: si no es la misma que aquí, el
// navegador lo sustituye por otra y el icono cae descentrado dentro de
// su propio hueco, sin que haya forma de arreglarlo desde el CSS —
// centrar la caja no centra el dibujo. Así se ve exactamente igual en
// todas partes, no hay que subir ningún archivo más y toma el color
// del botón con currentColor, así que cambia solo con el tema y al
// pasar el ratón.
//
// La geometría está calculada para que la tinta quede centrada en el
// lienzo de 24x24: el centro real del dibujo cae en (12.00, 12.00).
const ICONO_RECARGAR =
    '<svg class="gatin-random-reload-icono" viewBox="0 0 24 24"' +
    ' aria-hidden="true" focusable="false">' +
    '<path d="M19.37 12.82A7.4 7.4 0 1 1 14.53 6.51" fill="none"' +
    ' stroke="currentColor" stroke-width="2.9" stroke-linecap="round"/>' +
    '<path d="M18.85 8.08L12.65 9.34L14.91 3.13Z" fill="currentColor"/>' +
    "</svg>";

// El menú se inyecta por fetch (ver scripts/componentes/cargador-fragmentos.js), así que
// este script se ejecuta antes de que exista el hueco donde va.
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
        return; // se queda oculto, sin hueco vacío ni mensaje de error
    }

    if (fotos.length === 0) {
        return;
    }

    cuerpo.innerHTML = gatinAHtml();
    pintarFoto(cuerpo, elegirFoto(fotos));
    caja.hidden = false;

    const recargar = cuerpo.querySelector("[data-gatin-reload]");
    if (recargar) {
        // Con una sola foto el botón no haría nada: mejor no enseñarlo.
        if (fotos.length < 2) {
            recargar.remove();
        } else {
            recargar.addEventListener("click", () => {
                pintarFoto(cuerpo, elegirFoto(fotos));
            });
        }
    }
}

// Cambia la foto de la ventanita sin tocar el resto del HTML: así el
// botón de recargar no se rehace en cada clic y no pierde el foco del
// teclado a mitad de uso.
function pintarFoto(cuerpo, item) {
    const boton = cuerpo.querySelector(".gatin-random-foto");
    const img = boton && boton.querySelector("img");
    if (!boton || !img) {
        return;
    }

    const carpeta = "/imagenes/santuarios/" + encodeURIComponent(item.gato) + "/";
    img.src = carpeta + encodeURIComponent(item.foto.mini || item.foto.archivo);
    img.alt = item.foto.alt || "Foto del santuario";
    // La foto grande va aparte: el visor la lee de aquí en vez de
    // ampliar la miniatura, que se vería borrosa.
    boton.dataset.completa = carpeta + encodeURIComponent(item.foto.archivo);

    recordarFoto(item);
}

// De { tali: [...], regis: [...] } a una sola lista donde cada foto
// se lleva de quién es, que es lo que hace falta para la ruta.
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
    // Si solo hay una foto no queda otra que repetirla.
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

// sessionStorage puede fallar (ventana privada, permisos del
// navegador). No es nada crítico, así que si peta se sigue adelante y
// como mucho se repite una foto.
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
        /* sin memoria: solo significa que puede repetirse una foto */
    }
}

// Solo el armazón: la foto concreta la rellena pintarFoto(), que
// escribe src/alt por propiedades y no por HTML, así que aquí no hay
// nada que escapar.
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
// =========================================
// TEMA (CUATRO)
// =========================================
// Los botones viven dentro de la ventana de accesibilidad, que va en
// fragmentos/barra-lateral.html y se carga por fetch, así que se espera
// al evento "sidebar:loaded" en vez de dar por hecho que ya están.
//
// LOS SEIS
//     oscuro           el de siempre: morado y amarillo
//     claro            el de siempre en claro: crema y rojo
//     oscuro-puro      negro y blanco, nada más
//     claro-puro       blanco y negro, nada más
//     terminal-verde   fósforo verde sobre negro
//     terminal-rojo    lo mismo en rojo
//
// Los dos puros son un modo de alto contraste: TODO lo que no es el
// fondo va del mismo blanco (o negro), incluido lo que normalmente es
// amarillo o gris. Se pierde la diferencia entre el texto principal y
// lo secundario, y entre el acento y el texto, y es a propósito: quien
// enciende esto quiere que no haya medias tintas.
//
// Un botón por tema y no unos pocos que alternen: con seis opciones,
// alternar obliga a adivinar a dónde te lleva cada pulsación. Y cada
// botón va pintado con los colores de SU tema, para saber lo que te vas
// a encontrar antes de pulsarlo.
//
// "oscuro" es el de fábrica y NO se guarda ni se escribe en el <html>:
// se guarda quitando el atributo, igual que el resto de ajustes.

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

// Lo que se escribe en data-theme para cada uno. El de fábrica no
// escribe nada. "light" se queda con su nombre de siempre para no
// romper lo guardado de quien ya había elegido el tema claro antes de
// que hubiera cuatro.
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

// =========================================
// TEMA ACTUAL
// =========================================

// Se lee del <html>, que es la única verdad: da igual si lo puso el
// trocito del <head> al arrancar o alguien aquí hace un momento.
// EL TEMA QUE TOCA CUANDO NADIE HA ELEGIDO. Lo decide el aparato: si
// tiene el modo claro puesto, la web arranca en claro. Antes arrancaba
// siempre en oscuro, y quien tiene el móvil en claro porque ve mejor así
// se encontraba una web oscura sin haber pedido nada.
//
// Esto NO se guarda: mientras no se toque el mando del tema, la web
// sigue a lo que diga el sistema, y si un día cambia, cambia con él.
// El trocito que va en el <head> de cada página hace esto mismo antes
// del primer pintado; aquí está para el botón de "dejarlo todo como
// estaba", que tiene que saber a dónde volver.
function temaDelSistema() {
    try {
        return window.matchMedia("(prefers-color-scheme: light)").matches
            ? "claro"
            : "oscuro";
    } catch (error) {
        return "oscuro";
    }
}

// Borra lo elegido y vuelve a dejar que mande el aparato. Lo usa el
// botón de "dejarlo todo como estaba" de la ventana de accesibilidad.
function olvidarTemaGuardado() {
    try {
        localStorage.removeItem(THEME_STORAGE_KEY);
    } catch (error) {
        // Ver saveTheme().
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

// =========================================
// GUARDAR PREFERENCIA
// =========================================

// AQUÍ EL OSCURO SÍ SE GUARDA, y es la única excepción a la regla del
// resto de ajustes (donde lo de fábrica se borra en vez de guardarse).
//
// El motivo es que desde que la web hace caso al modo claro u oscuro
// del sistema, "no hay nada guardado" ya no quiere decir "quiere el
// oscuro": quiere decir "todavía no ha elegido, que decida su aparato".
// Borrando la clave al elegir el oscuro, quien tuviera el sistema en
// claro y pulsara "oscuro" se encontraba la web en claro otra vez al
// recargar, con su elección por el suelo.
//
// Así que: clave vacía = manda el sistema; clave puesta = manda quien
// la puso, sea el tema que sea. Lo de borrar se lo queda el botón de
// "dejarlo todo como estaba", que es donde tiene sentido.
function saveTheme(theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
        // localStorage puede fallar (modo privado, cuota, etc.)
        // No es crítico: el tema seguirá aplicado en esta página.
    }
}

// =========================================
// AVISAR AL RESTO DE LA PÁGINA DEL CAMBIO
// =========================================
// Cualquier elemento sensible al tema (no solo los botones) puede
// escuchar "theme:changed" en vez de depender de este fichero.

function dispatchThemeChanged(theme) {
    document.dispatchEvent(
        new CustomEvent("theme:changed", { detail: { theme } })
    );
}

// =========================================
// COLOR DE LA BARRA DEL NAVEGADOR
// =========================================
// En el móvil, la franja de arriba (y la de abajo en Android) se pinta
// con el color de <meta name="theme-color">. El valor de arranque lo
// pone cada página en su <head>; aquí solo se cambia al elegir otro
// tema, para que la franja no se quede del color del anterior.
//
// Son los mismos colores que --purple en estilos/base.css: si alguna
// vez cambias un fondo allí, cámbialo aquí y en el <head> de las
// páginas (la plantilla de herramientas ya los lleva).

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

// =========================================
// IMAGEN DEL PNGTUBER (portada)
// =========================================

// El dibujo está en tres tamaños por tema (412, 620 y 1161 de ancho);
// el navegador elige el que le toca con el srcset y el sizes que lleva
// puestos en index.html. Al cambiar de tema hay que cambiar los tres,
// no solo el src: con el srcset viejo el navegador se quedaba con la
// imagen del otro tema, porque el srcset manda sobre el src.
//
// Solo hay dos dibujos, el claro y el oscuro, así que los temas puros
// se reparten el que les toca por el fondo que tienen.
function updatePngPerson(theme) {
    const img = document.getElementById("pngperson-img");
    if (!img) {
        return;
    }
    // El tranquilo también lleva el dibujo claro: su fondo es papel
    // roto, y encima el dibujo de fondo oscuro se recorta como una
    // pegatina mal puesta.
    const esClaro =
        theme === "claro" || theme === "claro-puro" || theme === "tranquilo";
    const base = esClaro
        ? "/imagenes/main/pngtuber_white_theme"
        : "/imagenes/main/pngtuber_dark_theme";
    img.srcset = `${base}-412.webp 412w, ${base}-620.webp 620w, ${base}.webp 1161w`;
    img.src = `${base}.webp`;
}

/* ======== /scripts/componentes/ajustes.js ======== */
// =========================================
// COMPONENTE: LA VENTANA DE ACCESIBILIDAD
// =========================================
// El botón "Aa" abre una ventana con todo lo que se puede tocar para
// ver mejor la web: el tamaño del texto, la separación entre líneas, la
// letra, el tema y el brillito del cursor. Debajo hay un trozo de texto
// de ejemplo que se mueve a la vez que los mandos, para ir viendo lo
// que se elige sin tener que cerrar y mirar.
//
// Sustituye a scripts/componentes/texto-tamano.js, que era solo el
// panelito del tamaño.
//
// CÓMO CAMBIA TODO A LA VEZ
// -------------------------
// Ninguno de estos mandos toca una regla de CSS. Cada uno cambia una
// sola cosa en el <html>, y el CSS hace el resto:
//     --escala           multiplica el tamaño de raíz (base.css)
//     data-interlineado  la separación del texto largo (ajustes.css)
//     data-letra         cambia las cinco fuentes de golpe (base.css)
//     data-theme         el tema, de siempre (tema.js)
//     data-crt           el filtro CRT (ajustes.css)
//     data-voz           a qué velocidad lee (leer-en-voz.js)
//     data-movimiento    para lo que parpadea (sin-movimiento.css)
// Como los tamaños del sitio van en rem, con la escala crece todo solo.
//
// QUIÉN LO PINTA LA PRIMERA VEZ
// -----------------------------
// Este archivo va con defer, o sea que llega tarde: si esperara a
// ejecutarse aquí, la página se pintaría con los ajustes de fábrica y
// daría un salto al llegar. Lo que lee lo guardado y lo deja puesto
// ANTES del primer pintado es scripts/cargador-scripts.js, que va sin
// defer en el <head>. Aquí solo se monta el mando.
//
// POR QUÉ UN <dialog> Y NO UNA CAJA CUALQUIERA
// --------------------------------------------
// Con showModal() el navegador hace solo lo que a mano sale mal cuatro
// veces de cinco: oscurece el fondo (::backdrop), atrapa el tabulador
// dentro, cierra con Escape, deja inerte el resto de la página para
// quien usa lector de pantalla y devuelve el foco al botón al cerrar.
//
// OJO CON LOS NOMBRES
// -------------------
// Aquí no hay módulos: todos los scripts comparten el mismo ámbito
// global y dos funciones con el mismo nombre se pisan (ya pasó con una
// mover()). Por eso todo lo de aquí lleva "ajustes" en el nombre. Se
// comprueba con herramientas/4-comprobar/nombres-repetidos.py.

// Los cinco tamaños, del más pequeño al más grande. El 1 es el de
// siempre y está en la lista a propósito: se vuelve a él con el −, sin
// tener que acordarse de ningún número.
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

// Los mandos de la velocidad de la voz están en dos sitios: aquí dentro
// y debajo del botón de escuchar de cada entrada. Cuando cambian allí,
// avisan con esto para que los de aquí se marquen igual (y al revés, que
// lo manda engancharAjustesOpciones). Los dos leen el <html>, así que no
// hay dos verdades: solo hay que volver a pintar.
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

    // Lo primero, antes de enganchar nada: armar el panel. En el HTML
    // solo vienen las filas de mandos; la caja que las agrupa, la
    // muestra y la nota del final se montan aquí.
    armarAjustesPanel(ventana);

    abrir.addEventListener("click", abrirAjustes);

    const cerrar = ventana.querySelector("[data-ajustes-cerrar]");
    if (cerrar) {
        cerrar.addEventListener("click", cerrarAjustes);
    }

    // Pulsar en el fondo oscurecido cierra, como en cualquier ventana
    // de este tipo. El ::backdrop no recibe clics por su cuenta: lo que
    // llega es un clic en el propio <dialog> pero fuera de su contenido,
    // así que se compara con el rectángulo de la caja.
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

    // ---- tamaño ----
    AJUSTES.rango = ventana.querySelector("[data-tamano-rango]");
    AJUSTES.paso = pasoDeAjustes(leerAjuste(AJUSTES_GUARDADO_TAMANO, NaN, true));
    if (AJUSTES.rango) {
        // "input" y no "change": así el texto crece mientras se arrastra
        // y mientras se pulsan las flechas, que es justo lo que hace
        // falta para ir viendo cómo queda.
        AJUSTES.rango.addEventListener("input", () => {
            aplicarAjustesTamano(Number(AJUSTES.rango.value), true);
        });
    }
    aplicarAjustesTamano(AJUSTES.paso, false);

    // ---- separación entre líneas y letra ----
    engancharAjustesOpciones("interlineado");
    engancharAjustesOpciones("letra");
    engancharAjustesOpciones("voz");
    engancharAjustesOpciones("movimiento");
    pintarAjustesOpciones();

    // ---- el filtro CRT ----
    // El botón se marca con data-crt-boton y NO con data-crt a secas:
    // ese otro es el que lleva el <html> cuando el filtro está puesto,
    // y un querySelector("[data-crt]") suelto encontraría antes el
    // <html> que el botón.
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
    // showModal() es lo bueno: oscurece el fondo, atrapa el tabulador,
    // cierra con Escape y deja inerte el resto de la página.
    // Pero si el navegador no sabe de <dialog> —pasa, y cuando pasa el
    // panel NO está escondido: se queda dibujado en medio de la página
    // desde que se carga, que es como se descubrió esto— no hay método
    // que llamar. Ahí se abre a mano: el atributo open lo enseña y
    // .ajustes-a-mano (en la hoja de estilos) lo pone centrado encima de
    // la página con su propio fondo oscuro.
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

// Cerrar, sepa el navegador de <dialog> o no.
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
    // close() ya devuelve el foco solo; a mano hay que hacerlo.
    if (AJUSTES.abrir && typeof ventana.close !== "function") {
        AJUSTES.abrir.focus();
    }
}

// =========================================
// ARMAR EL PANEL
// =========================================
// En fragmentos/barra-lateral.html solo vienen las filas de mandos. La
// caja que las agrupa (.ajustes-lista), la ventanita de la muestra
// (ejemplo.txt) y la nota del final se montan aquí.
//
// POR QUÉ AQUÍ Y NO EN EL HTML
// ----------------------------
// Ese fragmento se pide aparte y se guarda en la caché del navegador.
// Una copia vieja arriba, o un archivo que no se copió al mover la
// carpeta, y lo que falta es justo el final del panel: la muestra y la
// nota. Pasó, y costó cuatro vueltas verlo, porque el panel seguía
// funcionando y no había nada que pareciera roto. El script y la hoja
// de estilos van siempre a la vez, así que montándolo aquí el panel
// llega entero o no llega.
//
// La caja de los mandos se reaprovecha si ya está; la muestra y la nota
// se tiran y se vuelven a montar siempre (ver por qué, más abajo).
function armarAjustesPanel(ventana) {
    const cuerpo = ventana.querySelector(".ajustes-cuerpo");
    if (!cuerpo) {
        return;
    }

    // ---- la caja de los mandos ----
    // Hace falta para que la columna de la izquierda pueda desplazarse
    // ella sola sin llevarse la de la derecha por delante.
    let lista = cuerpo.querySelector(".ajustes-lista");
    if (!lista) {
        lista = document.createElement("div");
        lista.className = "ajustes-lista";
        // Se mete delante de la primera fila y luego se van metiendo
        // dentro todas: así no hay que acordarse de cuántas hay.
        const filas = cuerpo.querySelectorAll(":scope > .ajustes-fila");
        if (!filas.length) {
            return;
        }
        cuerpo.insertBefore(lista, filas[0]);
        filas.forEach((fila) => lista.appendChild(fila));
    }

    // ---- los dos mandos del final, si no estuvieran ----
    // Mismo criterio que la muestra, la nota y el botón de reiniciar: lo
    // que monta este archivo llega siempre. Si el fragmento que ha
    // llegado es una copia vieja —guardada en la caché del navegador, o
    // simplemente un archivo de hace dos versiones— se queda a medias
    // justo por el final, que es donde viven estos dos. Pasó: el filtro
    // CRT salía como "FILTRO" a secas, sin el ON/OFF, y la fila de
    // animaciones no salía en absoluto.
    //
    // Si el fragmento SÍ los trae, estas dos no tocan nada.
    arreglarAjustesCrt(lista);
    if (!lista.querySelector("[data-movimiento]")) {
        lista.appendChild(armarAjustesMovimiento());
    }

    // ---- la columna de la derecha: la muestra y la nota ----
    // Las dos juntas en una caja porque en escritorio son UNA columna, y
    // una fila flexible con tres cajas dentro saldrían tres columnas.
    //
    // SE TIRA LO QUE HAYA Y SE VUELVE A MONTAR, en vez de reaprovecharlo
    // si ya está. Suena a desperdicio y no lo es: lo que puede haber ahí
    // es una muestra de una versión vieja del fragmento, guardada en la
    // caché del navegador, con otra forma y sin la barra de ejemplo.txt.
    // Dejándola, el panel salía medio nuevo y medio viejo —que es
    // justamente el lío del que viene todo esto—; tirándola, lo que se
    // ve es siempre lo que dice este archivo.
    cuerpo.querySelectorAll(".ajustes-lado, .ajustes-ejemplo, .ajustes-pie")
        .forEach((viejo) => viejo.remove());

    const lado = document.createElement("div");
    lado.className = "ajustes-lado";
    lado.appendChild(armarAjustesEjemplo());

    // El botón de dejarlo todo como estaba, debajo de la muestra. Estaba
    // al final de la lista de mandos y en escritorio esa lista se
    // desplaza, así que había que bajar hasta abajo del todo para dar
    // con él —y es justo el botón al que se recurre cuando uno ya no
    // sabe qué ha tocado.
    //
    // Se MONTA aquí, no se mueve desde el HTML, por lo mismo que la
    // muestra y la nota: una copia vieja del fragmento en la caché del
    // navegador dejaba el panel a medias y el botón no aparecía por
    // ningún lado. Lo que monta este archivo llega siempre.
    // Quien le engancha el clic (initializeAjustes, más arriba) lo busca
    // por todo el panel después de esto, así que lo encuentra igual.
    const viejoReiniciar = cuerpo.querySelector("[data-ajustes-reiniciar]");
    if (viejoReiniciar) {
        const fila = viejoReiniciar.closest(".ajustes-fila") || viejoReiniciar;
        fila.remove();
    }
    lado.appendChild(armarAjustesReiniciar());

    lado.appendChild(armarAjustesPie());
    cuerpo.appendChild(lado);

    // Para que botones-ventana.js le ponga los −■✕ a la ventanita y
    // ventanas-plegables.js le monte el mando de plegar: los dos ya han
    // repasado la página cuando esto corre.
    document.dispatchEvent(new CustomEvent("ventanas:actualizar"));
}

// EL BOTÓN DEL FILTRO CRT, CON SU ON/OFF
//
// El botón dice "FILTRO CRT: OFF" y lo que cambia al pulsarlo es solo el
// trocito del final, que va en su propio <span data-crt-estado> (ver
// pintarAjustesCrt, más abajo: reescribir el texto entero se llevaba por
// delante el <abbr> que explica qué es CRT).
//
// Si ese trocito no está —fragmento viejo—, pintarAjustesCrt no encuentra
// dónde escribir y el botón se queda diciendo "FILTRO" para siempre, sin
// que nada parezca roto. Así que aquí se rehace la etiqueta entera.
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


// LA FILA DE LAS ANIMACIONES
//
// "normal" o "sin animaciones". Lo que hace está en
// estilos/componentes/sin-movimiento.css; aquí solo se monta la fila por
// si el fragmento no la trae. Quien le engancha el clic es
// engancharAjustesOpciones("movimiento"), que corre después de esto.
//
// El <p> del nombre lleva id y el grupo lo apunta con aria-labelledby:
// así un lector de pantalla dice "animaciones, grupo" al entrar en los
// dos botones, en vez de soltar "normal" sin decir normal de qué.
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
        // El marcado de verdad lo pone pintarAjustesOpciones() en cuanto
        // termina de armarse el panel; esto es solo para no dejarlo sin
        // atributo mientras tanto.
        boton.setAttribute("aria-pressed", "false");
        boton.textContent = etiqueta;
        mandos.appendChild(boton);
    });

    fila.appendChild(mandos);
    return fila;
}


// La muestra, en una ventana falsa de las del sitio.
//
// No necesita ni una línea más de JavaScript para cambiar: está dentro
// de la página, así que hereda el tamaño, la letra y la separación como
// todo lo demás y se mueve a la vez que se tocan los mandos.
//
// QUÉ LLEVA DENTRO, y por qué cada cosa:
//   · El titular en la fuente de los títulos, el párrafo en la de leer
//     y la línea de la fecha en la monoespaciada: son las tres letras
//     del sitio, y el mando de "la letra" las cambia las tres a la vez.
//   · Negrita, cursiva y un enlace, que es lo que de verdad aparece
//     dentro de una entrada y lo que peor se lee cuando una fuente no
//     acompaña: una cursiva mala se nota antes que un texto normal malo.
//   · Los dos botones del sitio, el macizo y el hueco. Son los dos
//     únicos colores que hay, y en los temas de alto contraste y en los
//     de terminal es donde más cambian.
//   · Y un muestrario de letras y signos: el pangrama en español —que
//     lleva todas las letras y además tildes, eñe y la u con diéresis—
//     y una tira de caracteres comunes, repetida en la fuente de leer y
//     en la monoespaciada. Es lo que hace falta para decidir si una
//     fuente vale: con "Llegó a mi vida en diciembre" no se ve si el
//     signo de interrogación de apertura está bien dibujado.
//
// NADA DE AQUÍ DENTRO SE PUEDE PULSAR, y es a propósito. Los botones y
// el enlace son <span>, no <button> ni <a>: todo esto va dentro de un
// aria-hidden, y un elemento al que se llega con el tabulador pero que
// un lector de pantalla no anuncia es de los peores fallos que hay.
// Siendo <span> no hay nada que enfocar y el dibujo es el mismo.
//
// El aria-hidden va en el CUERPO y no en la ventana entera: el texto de
// muestra no es nada que haya que leer —quien escucha la página ya
// tiene el nombre de cada mando—, pero el nombre de la ventana sí se
// anuncia, y dentro hay un botón de plegar, que escondido de los
// lectores de pantalla pero alcanzable con el tabulador es justo lo que
// no se debe hacer.

// La tira de caracteres comunes del muestrario. Está aquí arriba y no
// dentro de la función para no tenerla escrita dos veces: se usa en la
// fuente de leer y en la monoespaciada.
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

    // ---- el titular ----
    const como = document.createElement("p");
    como.className = "ajustes-ejemplo-titulo";
    como.textContent = "así se va a ver";
    dentro.appendChild(como);

    // ---- el párrafo, con negrita, cursiva y enlace ----
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

    // ---- el muestrario de caracteres ----
    const letras = document.createElement("p");
    letras.className = "ajustes-ejemplo-letras";
    letras.textContent = AJUSTES_CARACTERES;
    dentro.appendChild(letras);

    const letrasMono = document.createElement("p");
    letrasMono.className = "ajustes-ejemplo-letras ajustes-ejemplo-letras-mono";
    letrasMono.textContent = AJUSTES_CARACTERES;
    dentro.appendChild(letrasMono);

    // ---- los dos botones ----
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

    // ---- la línea de datos, en monoespaciada ----
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

// El botón de volver a lo de fábrica, con su aviso al lado.
//
// La flecha de deshacer va en <svg> y no en un carácter (↺) ni en una
// imagen: lo mismo que el resto de los iconos del sitio. Un carácter lo
// dibuja la fuente de quien visita y sale de cualquier tamaño y
// descentrado, y una imagen es un archivo más que pedir. Así toma el
// color del texto del botón y crece con él.
//
// El aviso lleva role="status" para que, al pulsar, un lector de
// pantalla lo lea solo: si no, el único indicio de que ha pasado algo es
// que la página cambia de aspecto, y quien lo pulsa puede no estar
// viéndola.
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

// =========================================
// LO GUARDADO
// =========================================

// Leer y escribir en el almacén del navegador puede fallar: navegando
// en privado, o con las cookies de sitio bloqueadas, tira una
// excepción. Si pasa, los ajustes valen igual para esta visita y lo
// único que se pierde es que se recuerden.
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
        // Lo de fábrica no se guarda: se borra. Así quien no ha tocado
        // nada y quien ha vuelto al normal están igual, y el día que
        // cambie lo de fábrica les vale a los dos.
        if (esElDeSiempre) {
            localStorage.removeItem(clave);
        } else {
            localStorage.setItem(clave, String(valor));
        }
    } catch (error) {
        // Ver arriba.
    }
}

// =========================================
// EL TAMAÑO
// =========================================

// El paso de la lista que corresponde a una escala guardada. Si lo
// guardado no es ninguno de los cinco (una visita vieja, o alguien
// tocando el almacén a mano), se coge el más cercano en vez de tirarlo:
// el texto grande de quien lo necesita no se pierde por un decimal.
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
        // El deslizador va de 0 a 4, que no le dice nada a quien escucha
        // la página: lo que se anuncia es el porcentaje.
        AJUSTES.rango.setAttribute("aria-valuetext", `${Math.round(escala * 100)}%`);
    }
    const valor = AJUSTES.ventana.querySelector("[data-tamano-valor]");
    if (valor) {
        valor.textContent = `${Math.round(escala * 100)}%`;
    }
}

// =========================================
// LA SEPARACIÓN Y LA LETRA
// =========================================
// Los dos funcionan igual —una fila de botones de los que solo uno
// está pulsado— así que comparten código. Lo único que cambia es dónde
// se escribe lo elegido: la separación en una variable de CSS y la
// letra en un atributo del <html>.

function engancharAjustesOpciones(cual) {
    AJUSTES.ventana.querySelectorAll(`[data-${cual}]`).forEach((boton) => {
        boton.addEventListener("click", () => {
            ponerAjuste(cual, boton.getAttribute(`data-${cual}`), true);
            pintarAjustesOpciones();
            // La velocidad de la voz tiene unos botones gemelos debajo
            // del de escuchar, en las entradas y los relatos. Con esto
            // se marcan igual que éstos (y al revés: ellos avisan con
            // el mismo evento). Lo escucha
            // scripts/componentes/leer-en-voz.js.
            document.dispatchEvent(new CustomEvent("ajustes:actualizar"));
        });
    });
}

// Los dos escriben lo mismo: un atributo en el <html>. Vacío quiere
// decir "lo de siempre", y entonces el atributo se quita en vez de
// quedarse puesto a vacío, que es lo que miran los selectores del CSS.
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

// Marca como pulsado el botón que coincide con lo que hay puesto ahora
// mismo en el <html>, que es la única verdad: así da igual si lo puso
// el cargador al arrancar o alguien aquí hace un momento.
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

// =========================================
// EL FILTRO DE PANTALLA VIEJA
// =========================================
// Rayas horizontales y las esquinas apagadas, como un monitor de tubo.
// No hay ni un elemento para esto: lo dibuja un ::after del propio <html>
// (ver estilos/componentes/ajustes.css), así que funciona en todas las
// páginas —el 404 incluido, que no tiene barra lateral— sin tener que
// meter un div en ninguna parte.
//
// Va apagado de fábrica a propósito: unas rayas encima del texto le
// quitan contraste, y esta web se ha medido entera para que no le falte.
// Quien lo encienda sabe lo que hace.

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
    // Solo se cambia el ON/OFF, no el texto entero: dentro hay un
    // <abbr> explicando qué es CRT, y reescribiendo el textContent del
    // botón se lo llevaba por delante en cuanto se encendía la primera
    // vez (y encima solo entonces, que son los fallos que no se ven).
    const estado = boton.querySelector("[data-crt-estado]");
    if (estado) {
        estado.textContent = encendido ? "ON" : "OFF";
    }
}

// =========================================
// DEJARLO TODO COMO ESTABA
// =========================================
// Con ocho mandos aquí dentro es fácil acabar en una combinación rara y
// no acordarse de qué se tocó. Esto los devuelve todos de una vez.
//
// El del rastro del cursor es el único que no se toca desde aquí: lo
// lleva scripts/componentes/rastro-cursor.js con su propia tecla
// guardada, así que en vez de meter mano en sus cosas se le da al botón
// como lo daría una persona. Es un poco rodeo, pero es la frontera
// limpia: cada componente sigue siendo el dueño de lo suyo.

function reiniciarAjustes() {
    aplicarAjustesTamano(AJUSTES_TAMANOS.indexOf(1), true);
    ponerAjuste("interlineado", "", true);
    ponerAjuste("letra", "", true);
    ponerAjuste("voz", "", true);
    ponerAjuste("movimiento", "", true);
    ponerAjustesCrt(false, true);
    pintarAjustesOpciones();
    document.dispatchEvent(new CustomEvent("ajustes:actualizar"));

    // El tema. Antes esto pulsaba el botón del oscuro, pero "como
    // estaba" ya no es el oscuro: desde que la web hace caso al modo
    // claro u oscuro del aparato, lo de fábrica es "que decida el
    // sistema". Pulsar un botón dejaría una elección guardada, que es
    // justo lo contrario de lo que promete este botón. Lo hace
    // scripts/tema.js, que es quien sabe del tema.
    if (typeof olvidarTemaGuardado === "function") {
        olvidarTemaGuardado();
    }

    // Y el brillito, que viene encendido de fábrica.
    const brillito = document.getElementById("cursor-trail-toggle");
    if (brillito && brillito.getAttribute("aria-pressed") === "false") {
        brillito.click();
    }

    // Un aviso que se lee solo: si no, quien no ve la página no tiene
    // forma de saber que ha pasado algo.
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
// =========================================
// COMPONENTE: LA LUPA DEL MENÚ
// =========================================
// El botón de "buscar" del final del menú abre una ventana con el campo
// de búsqueda. Está en todas las páginas, así que desde cualquier sitio
// se puede buscar sin volver a la portada.
//
// AQUÍ NO SE BUSCA NADA. El formulario de dentro es un formulario de
// verdad (action + method="get") y al enviarlo se va a
// /web/buscar/buscar.html?q=loquesea, que es la página que pide el
// listado y pinta los resultados. Dos motivos:
//
//   - El listado con el texto de toda la web son 57 KB y van a más.
//     Cargarlo en todas las páginas por si alguien busca sería pagarlo
//     siempre para usarlo casi nunca.
//   - Así la búsqueda funciona aunque este archivo no llegue a
//     ejecutarse: el <dialog> no se abriría, pero el formulario sigue
//     siendo un formulario.
//
// POR QUÉ UN <dialog> Y NO UN DESPLEGABLE: con showModal() el navegador
// se encarga solo de oscurecer el fondo, atrapar el tabulador dentro,
// cerrar con Escape, dejar inerte el resto de la página para los
// lectores de pantalla y devolver el foco al botón al cerrar. Lo mismo
// que la ventana de accesibilidad, y por lo mismo.
//
// OJO CON LOS NOMBRES: todos los scripts comparten el mismo ámbito
// global, así que lo de aquí lleva "lupa" en el nombre. Se comprueba con
// herramientas/4-comprobar/nombres-repetidos.py.

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

    // Pulsar en el fondo oscurecido cierra, que es lo que todo el mundo
    // intenta. El clic en el ::backdrop le llega al propio <dialog>, así
    // que basta con mirar si lo pulsado es él y no algo de dentro.
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
    // El foco al campo, no al primer trasto de la ventana: quien abre
    // esto viene a escribir. Se hace aquí y no con autofocus en el HTML
    // porque ese atributo en un <dialog> no se porta igual en todos los
    // navegadores, y además dispararía al cargar la página.
    const campo = LUPA.ventana.querySelector(".buscar-form-campo");
    if (campo) {
        campo.focus();
        campo.select();
    }
}

/* ======== /scripts/componentes/botones-ventana.js ======== */
// =========================================
// COMPONENTE: BOTONES DE VENTANA (−◼✖)
// =========================================
// Bloque decorativo repetido en la cabecera de cada tarjeta y en la
// ventana principal de las páginas sencillas. En vez de copiar los
// mismos 3 <span> en cada sitio, cualquier contenedor marcado con
// [data-window-controls] recibe aquí su contenido automáticamente.
//
// Ejemplo de uso en el HTML:
//   <div class="window-controls window-controls-small" data-window-controls aria-hidden="true"></div>
// (las clases deciden el tamaño/posición vía CSS; este script solo
// rellena los botones de dentro)

// Los tres símbolos van dibujados en SVG y no como caracteres (−, ◼,
// ✖). Con un carácter, el dibujo sale de la fuente que tenga instalada
// quien visita la web: si no es la misma que aquí, el navegador la
// sustituye por otra y el símbolo cambia de tamaño y cae descentrado
// dentro de su cuadradito, sin que haya forma de arreglarlo desde el
// CSS — centrar la caja no centra la tinta. Ya pasó con el botón de
// recargar del gatín. Así se ve exactamente igual en todas partes y no
// hay que subir ningún archivo más.
//
// La geometría está calculada para que la tinta quede centrada en el
// lienzo de 24x24, y el color sale de currentColor, así que sigue al
// tema y a las cabeceras invertidas (las fichas de los gatos, las
// entradas del blog) sin tener que repetir nada.
const WINDOW_CONTROLS_ICONOS = {
    // Minimizar: una raya. Centrada, como estaba el "−" de antes.
    minimizar:
        '<rect x="4" y="10.75" width="16" height="2.5" rx="0.6" fill="currentColor"/>',
    // Maximizar: el cuadrado macizo del "◼".
    // 13 y no 11 de lado: con 11 el cuadrado se veía más pequeño que la
    // raya (16 de ancho) y que el aspa, y los tres tienen que pesar lo
    // mismo en la fila.
    maximizar: '<rect x="5.5" y="5.5" width="13" height="13" fill="currentColor"/>',
    // Cerrar: las dos aspas del "✖".
    cerrar:
        '<path d="M5.5 5.5L18.5 18.5M18.5 5.5L5.5 18.5" fill="none"' +
        ' stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
};

// Qué hace cada uno. Lo recoge scripts/componentes/ventanas-plegables.js
// por delegación, mirando este data-ventana-accion: minimizar pliega la
// ventana de verdad, maximizar la devuelve a su tamaño, y cerrar se
// queda de adorno con sus brillos (chispas-botones.js).
//
// Siguen siendo <span> y no <button> a propósito: el contenedor va con
// aria-hidden="true" —son tres dibujos, lo que hay que leer ya lo dice
// el título de la barra— y dentro de algo escondido para un lector de
// pantalla no puede haber nada que reciba el foco. El mando de verdad,
// el que se usa con el teclado, es el botón que cubre toda la barra y lo
// pone ventanas-plegables.js.
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

// La barra lateral se inyecta por fetch después de que corra esto, así
// que lo que venga dentro (la cabecera del gatín aleatorio) se queda
// sin rellenar. Al avisar de que ya está en el DOM se repasa otra vez;
// volver a pintar los que ya estaban no cambia nada.
document.addEventListener("sidebar:loaded", initializeWindowControlsComponent);

// Y lo mismo con las ventanas que se pintan más tarde desde un JSON (los
// bloques del changelog): quien las pinta avisa con este evento y aquí
// se rellenan sus botones.
document.addEventListener("ventanas:actualizar", initializeWindowControlsComponent);

function initializeWindowControlsComponent() {
    document.querySelectorAll("[data-window-controls]").forEach((mount) => {
        mount.innerHTML = WINDOW_CONTROLS_MARKUP;
    });
}

/* ======== /scripts/componentes/ventanas-plegables.js ======== */
// =========================================
// COMPONENTE: VENTANAS QUE SE PLIEGAN
// =========================================
// Las barras de título de las ventanas falsas llevaban tres botones de
// adorno (−■✕). Dos de ellos ya hacen lo que dicen: el − pliega la
// ventana y deja solo la barra, y el ■ la devuelve a su tamaño. El ✕ se
// queda de broma, con sus brillos (scripts/componentes/chispas-botones.js).
//
// No hay que tocar el HTML de ninguna página: aquí se buscan todas las
// barras de título que hay (son tres clases, las de siempre) y se les
// monta el mando encima. Si algún día aparece otra clase de barra, se
// añade a VENTANA_BARRAS y ya está.
//
// CÓMO SE PULSA
//   - Toda la barra responde, no solo los cuadraditos: en el móvil son
//     13 px de lado y es lo que pedía Richi. La barra entera alterna
//     entre plegada y abierta.
//   - El − pliega y el ■ abre, cada uno lo suyo (no alternan), que es
//     como se porta la barra de título de una ventana de verdad.
//   - Con el teclado: el mando es un <button> que cubre la barra, así
//     que se llega con el tabulador y se pulsa con Enter o espacio.
//
// LO QUE SE VE Y LO QUE SE OYE
// El esconder lo hace el CSS (estilos/componentes/ventanas-plegables.css)
// a partir de [data-plegada="si"]. Aquí solo se pone y se quita ese
// atributo, y se mantiene al día el aria-expanded del mando, que es lo
// que le dice a un lector de pantalla si la ventana está abierta o
// contraída. Al plegar, lo de dentro se esconde con display: none, así
// que desaparece también para quien escucha la página: no se queda
// leyendo una lista que no está a la vista.
//
// NO SE GUARDA NADA. Al recargar, todas las ventanas vuelven a estar
// abiertas: plegar es para quitarse algo de en medio un rato, no un
// ajuste. Si alguna vez se quisiera recordar, iría en localStorage con
// el mismo patrón que el tema y el tamaño del texto.

// Las tres barras de título del sitio: las tarjetas de casi todas las
// páginas, la ventanita del gatín de la barra lateral y la ficha de un
// gato. Todas tienen la misma forma: un encabezado y los −■✕, dentro de
// un contenedor que es la ventana.
const VENTANA_BARRAS =
    ".recent-entries-header, .gatin-random-header, .pet-window-header";

// Para los id= de los títulos que no tengan: el mando los necesita para
// poder decir cómo se llama la ventana que abre y cierra.
let ventanaContador = 0;

prepararVentanasPlegables();

// La barra lateral llega por fetch después de que corra esto, así que la
// ventanita del gatín que viene dentro se queda sin mando hasta que
// avisan de que ya está en el DOM.
document.addEventListener("sidebar:loaded", prepararVentanasPlegables);

// Y lo mismo con las ventanas que se pintan desde un JSON (los bloques
// del changelog, las categorías de recomendaciones): quien las pinta
// avisa con este evento, el mismo que usa botones-ventana.js para
// rellenarles los −■✕.
document.addEventListener("ventanas:actualizar", prepararVentanasPlegables);

document.addEventListener("click", alPulsarEnVentana);

function prepararVentanasPlegables() {
    document.querySelectorAll(VENTANA_BARRAS).forEach(prepararVentana);
}

function prepararVentana(barra) {
    // Las ventanas pintadas desde un JSON hacen que esto se repase
    // varias veces; a las que ya tienen mando se las deja en paz para no
    // acabar con tres botones encima de la misma barra.
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
        // El nombre del mando es el título de la ventana, y apuntado con
        // aria-labelledby y no copiado: hay títulos que cambian mientras
        // se usa la página (el del diario va por meses) y así el nombre
        // cambia con ellos sin tener que enterarse nadie.
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

    // Cada cuadradito, lo suyo. El de cerrar no pliega nada: se pulsa,
    // salen los brillos y la ventana se queda como estaba.
    const boton = evento.target.closest("[data-ventana-accion]");
    const accion = boton ? boton.dataset.ventanaAccion : "";
    if (accion === "cerrar") {
        return;
    }
    if (accion === "plegar" || accion === "desplegar") {
        plegarVentana(ventana, accion === "plegar");
        return;
    }

    // Y si no se ha pulsado un cuadradito, se ha pulsado la barra: se
    // alterna. Salvo que ahí hubiera algo que ya hace lo suyo (un enlace
    // o un botón de los de dentro); el mando que cubre la barra es un
    // botón también, pero ese sí alterna.
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
    // :scope > para no pisar el mando de una ventana que estuviera
    // metida dentro de otra.
    const mando = ventana.querySelector(
        ":scope > .ventana-barra > .ventana-barra-mando"
    );
    if (mando) {
        mando.setAttribute("aria-expanded", plegada ? "false" : "true");
    }
}

// =========================================
// SOLTARLA DE LA FILA O DE LA COLUMNA
// =========================================
// Esconder lo de dentro no basta: muchas de estas ventanas están en una
// fila o en una columna que las estira, y plegadas se quedarían igual de
// altas pero vacías. Las dos tarjetas de la portada van a la misma
// altura (align-items: stretch en una fila), y la ficha de un gato crece
// para llenar su columna (flex: 1 1 0%).
//
// Esto NO se puede escribir en el CSS: lo que hay que deshacer depende de
// en qué dirección estire el contenedor, y una hoja de estilos no puede
// preguntarlo. En una fila estira a lo alto y se arregla con align-self;
// en una columna estira a lo largo y lo que hay que tocar es el flex. Y
// la misma regla no vale para las dos: un align-self: start en una
// columna encogería la ventana a lo ANCHO, que es justo lo que no
// queremos. Así que se mira el contenedor y se pone lo que toque, y al
// desplegar se quita y vuelve a mandar el CSS de la página.
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
        // "0 0 auto" y no solo flex-grow: 0, porque varias de estas
        // ventanas vienen con flex-basis: 0 y, sin crecer, se quedarían
        // literalmente en cero de alto. Con basis auto miden lo que mide
        // la barra, que es lo que hay dentro.
        ventana.style.flex = "0 0 auto";
    } else {
        // Filas y rejillas: en las dos, align-self es el eje de arriba
        // abajo. Lo de ancho no se toca, que ahí no sobra nada.
        ventana.style.alignSelf = "start";
    }
}

/* ======== /scripts/componentes/rastro-cursor.js ======== */
// =========================================
// RASTRO DE PARTÍCULAS DEL CURSOR
// =========================================
// Efecto puramente decorativo: al mover el ratón, va dejando
// pequeñas partículas que se desvanecen. Se puede activar/desactivar
// con el botón del sidebar (persistido en localStorage), y se
// respeta "prefers-reduced-motion" por encima de cualquier preferencia
// guardada.

const CURSOR_TRAIL_STORAGE_KEY = "richi-cursor-trail";
const CURSOR_TRAIL_MIN_DISTANCE = 24; // px mínimos entre partículas
const CURSOR_TRAIL_LIFETIME = 700; // ms, debe coincidir con la animación CSS
const CURSOR_TRAIL_OFFSET_Y = 16; // px hacia abajo, para que parezca estela
const CURSOR_TRAIL_EMOJIS = ["✦","🟐","✵","⛤","★", "☆", "✦", "✧", "✪", "✫", "✬", "✭", "✮", "✯", "✰", "✱", "✲", "✳", "✴", "✵", "✶", "✷", "✸", "✹", "✺", "✻", "✼", "✽", "❂"];

let cursorTrailEnabled = true;
let lastParticleX = null;
let lastParticleY = null;

document.addEventListener("sidebar:loaded", initializeCursorTrailToggle);

initializeCursorTrail();

// =========================================
// INICIALIZAR
// =========================================

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

// =========================================
// GENERAR PARTÍCULAS
// =========================================

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

// =========================================
// BOTÓN DE ACTIVAR/DESACTIVAR
// =========================================

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

// =========================================
// GUARDAR / LEER PREFERENCIA
// =========================================

function saveCursorTrailPreference(enabled) {
    try {
        // Encendido es lo de fábrica, y lo de fábrica no se guarda: se
        // borra la clave. Así quien no ha tocado nada y quien lo ha
        // vuelto a encender quedan igual, y el botón de "dejarlo todo
        // como estaba" de la ventana de accesibilidad no deja ni rastro
        // en el almacén. Es la misma regla que sigue guardarAjuste() en
        // scripts/componentes/ajustes.js.
        if (enabled) {
            localStorage.removeItem(CURSOR_TRAIL_STORAGE_KEY);
        } else {
            localStorage.setItem(CURSOR_TRAIL_STORAGE_KEY, "false");
        }
    } catch (error) {
        // localStorage puede fallar (modo privado, cuota, etc.)
        // No es crítico: el efecto seguirá aplicado en esta página.
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
// =========================================
// BOTONES DE VENTANA — PEQUEÑO ESTALLIDO AL PULSARLOS
// =========================================
// De los botones "−■✕" de las cabeceras, el de cerrar sigue siendo
// decorativo (no cierra nada de verdad), así que a ese le añadimos un
// efecto divertido al pulsarlo, reutilizando el mismo tipo de partícula
// que ya usa el botón de inspiración.
//
// Los otros dos ya hacen lo que dicen desde que existe
// scripts/componentes/ventanas-plegables.js: plegar la ventana y
// devolverla a su tamaño. Esos no sueltan brillos, que la respuesta a
// pulsarlos es la propia ventana plegándose.
//
// Se usa delegación de eventos en "document" para que funcione con
// cualquier botón de ventana de cualquier página, sin tener que
// engancharse uno a uno ni preocuparse de los que se cargan luego
// (como los del sidebar).

const WINDOW_BTN_SYMBOLS = ["✨", "⭐", "✦", "✧"];
const WINDOW_BTN_PARTICLES = 10;
const WINDOW_BTN_LIFETIME = 700; // ms, debe coincidir con la animación CSS

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
        // El de cerrar, siempre. Los de minimizar y maximizar, solo si
        // están en un sitio donde no hay nada que plegar: el 404 lleva
        // los −■✕ sueltos sobre la pantalla entera, sin barra de título,
        // y ahí los tres siguen siendo de adorno.
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
// =========================================
// COMPONENTE: LOS ENLACES QUE SALEN DE LA WEB
// =========================================
// Marca con una flechita los enlaces que llevan a otra web, para saber
// antes de pulsar que te vas de aquí.
//
// POR QUÉ NO BASTA CON LA FLECHITA
// --------------------------------
// Las reglas de accesibilidad piden dos cosas que un dibujo solo no
// cumple:
//
//   - Que el aviso no dependa SOLO de ver algo. Quien escucha la página
//     no ve ninguna flecha, así que a cada enlace se le añade un trocito
//     de texto escondido a la vista —"(enlace externo)"— que sí se lee
//     en voz alta y pasa a formar parte del nombre del enlace.
//
//   - Que si el enlace abre otra pestaña se avise antes, no después
//     (WCAG 3.2.5): un cambio de contexto que no esperas deja perdido a
//     cualquiera, y más a quien navega con lector de pantalla o con la
//     pantalla muy ampliada, que puede ni enterarse de que ha cambiado
//     de ventana. Por eso esos dicen además "se abre en otra pestaña".
//
// Y LA FLECHITA, ¿POR QUÉ ASÍ?
// ----------------------------
// Va de fondo con una máscara y no como carácter ni como texto de un
// ::after. Dos razones: un carácter lo dibuja la fuente que tenga quien
// visita la web y sale de cualquier tamaño y descentrado (ya pasó con
// los botones de las ventanas), y el contenido de un ::after lo leen en
// voz alta algunos lectores de pantalla, que anunciarían "flecha hacia
// el noreste" en medio de cada frase. Con máscara el dibujo toma el
// color del texto (currentColor) y no lo lee nadie.
//
// QUÉ NO SE MARCA
// ---------------
// Los enlaces que son solo un icono (los de redes sociales): ahí la
// flecha se amontona con el dibujo y no se entiende. Esos llevan solo el
// aviso escondido, que es lo que de verdad hace falta.
//
// OJO CON LOS NOMBRES: todos los scripts comparten el mismo ámbito
// global, así que lo de aquí lleva "fuera" en el nombre. Se comprueba
// con herramientas/4-comprobar/nombres-repetidos.py.

initializeEnlacesFuera();
vigilarEnlacesFuera();

function initializeEnlacesFuera() {
    document.querySelectorAll("a[href]").forEach(marcarEnlaceFuera);
}

// POR QUÉ UN VIGILANTE Y NO UNA LISTA DE AVISOS
// ---------------------------------------------
// Media web se pinta sola después de que esto corra: la barra lateral, el
// listado del blog, el de relatos, las novedades de la portada, el
// buscador, los filtros... Son seis o siete scripts distintos, y de esos
// solo tres avisan con un evento. Ir detrás de cada uno sería dejar el
// aviso de "enlace externo" dependiendo de que nadie se olvide de avisar
// el día que añada un listado nuevo —y ya pasó: los enlaces a la tienda
// de la portada se quedaron sin marcar—.
//
// Así que en vez de esperar avisos se vigila el documento: cada vez que
// aparece algo nuevo se repasan los enlaces. Se desconecta mientras
// repasa porque el repaso mete un <span> dentro de cada enlace, y eso es
// un cambio más que lo despertaría otra vez en bucle. Y se agrupa con
// requestAnimationFrame: pintar una lista de treinta entradas son
// treinta avisos seguidos y un solo repaso al final.
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

    // El aviso para quien escucha. Va dentro del enlace para que forme
    // parte de su nombre: lo que se anuncia pasa a ser "Pexels, enlace
    // externo, se abre en otra pestaña".
    //
    // Antes de añadir nada se mira lo que ya pone: varios enlaces de la
    // web llevan escrito a mano un "(se abre en otra pestaña)" desde
    // hace tiempo, y sin esta comprobación se oía dos veces seguidas.
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

    // Y la flechita, solo si el enlace tiene texto. En uno que es solo un
    // icono no cabe y no se entiende.
    if (tieneTextoFuera(enlace)) {
        enlace.classList.add("enlace-fuera");
    }
}

function saleDeLaWeb(enlace) {
    const destino = enlace.getAttribute("href") || "";
    // Anclas, correos, teléfonos y rutas de esta misma web: no salen.
    if (!/^https?:/i.test(destino)) {
        return false;
    }
    try {
        const suyo = new URL(destino, window.location.href).host;
        return sinWww(suyo) !== sinWww(window.location.host);
    } catch (error) {
        // Una dirección que no se puede leer no se marca.
        return false;
    }
}

// richi.blog y www.richi.blog son la misma web, aunque para el navegador
// sean dos nombres distintos. Sin esto, un enlace escrito a mano con la
// dirección completa —de los que hay en el mapa del sitio— se anunciaría
// como "enlace externo" estando dentro de casa.
function sinWww(host) {
    return host.replace(/^www\./i, "");
}

// Si lo único que hay dentro es un dibujo (un SVG, una imagen) no hay
// texto que acompañar con la flecha. El texto escondido que se acaba de
// añadir no cuenta, claro.
function tieneTextoFuera(enlace) {
    const copia = enlace.cloneNode(true);
    copia.querySelectorAll(".visually-hidden").forEach((n) => n.remove());
    return (copia.textContent || "").trim().length > 0;
}

/* ======== /scripts/componentes/visor-imagenes.js ======== */
// =========================================
// COMPONENTE: LIGHTBOX (visor de imágenes en modal)
// =========================================
// Cualquier imagen envuelta así se puede ampliar al hacer clic:
//   <button class="lightbox-trigger" type="button">
//       <img src="..." alt="...">
//   </button>
// Usa delegación de eventos, así que funciona en cualquier página
// que cargue este script, sin tener que engancharse imagen a imagen.

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

// El visor se anuncia como diálogo modal (role="dialog" +
// aria-modal="true"), pero eso por sí solo no impide que el tabulador
// se vaya al contenido de detrás: hay que dejarlo inerte, igual que
// hace el menú lateral al abrirse. Sin esto, tabular dentro del visor
// paseaba por los enlaces de la página tapada, que ni se ven.
// Al cerrar no vale con poner inert = false en todo: puede haber algo
// de detrás que YA estuviera inerte antes de abrir el visor y que deba
// seguir estándolo. Pasa de verdad con el gatín aleatorio del menú: en
// móvil se puede ampliar su foto con el cajón abierto, y el cajón ya
// había dejado inerte el resto de la página. Si al cerrar la foto se
// limpiara todo, el tabulador se escaparía al contenido que tapa el
// cajón. Por eso se apunta qué se ha tocado y solo se deshace eso.
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

    // Si el botón trae una versión grande aparte (galería del santuario,
    // donde lo que se ve en la rejilla es una miniatura), se amplía esa.
    // Si no, la propia imagen, como en el resto del sitio.
    lightboxImage.src = imagenSeguraLightbox(
        trigger.dataset.completa || img.currentSrc || img.src
    );
    lightboxImage.alt = img.alt || "";
    lightboxOverlay.hidden = false;
    document.body.classList.add("lightbox-open");
    lightboxLastTrigger = trigger;

    // Después de mostrarlo: marcar inerte lo de detrás mientras el
    // propio visor sigue oculto dejaría el foco sin sitio a donde ir.
    setBackgroundInert(true);

    const closeBtn = lightboxOverlay.querySelector(".lightbox-close");
    closeBtn.focus();
}

// La dirección sale de un data- del HTML y de la propia imagen, que las
// escribes tú, pero acaba en un src: se comprueba cómo empieza, igual
// que en el resto del sitio. Vale una dirección de esta web (una "/" que
// no sea "//", que sería otra web), una http(s) entera o un data: de
// imagen. Lo demás no se pone.
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
    // Se devuelve la página antes de esconder el visor y de mover el
    // foco: si no, el elemento que abrió la imagen seguiría inerte y
    // no podría recibirlo.
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
// =========================================
// COMPONENTE: AVISO EMERGENTE
// =========================================
// Ventanita que aparece sola al entrar, se cierra con su botón o con
// Escape, y no vuelve a salir para ese visitante (se recuerda en
// localStorage, que no es una cookie: no viaja al servidor, solo vive
// en el propio navegador).
//
// Antes esto era exclusivo de la portada. Ahora cualquier página puede
// tener el suyo, y puede haber varios en la misma página: cada uno se
// recuerda por separado gracias a su propia clave.
//
// Ejemplo de uso en el HTML:
//   <div class="notice" data-notice data-notice-key="richi-lo-que-sea"
//        role="dialog" aria-labelledby="mi-titulo" hidden>
//       <div class="recent-entries-header">
//           <h2 id="mi-titulo">un aviso</h2>
//           <div class="window-controls window-controls-small" data-window-controls aria-hidden="true"></div>
//       </div>
//       <div class="notice-body">
//           <p>...</p>
//           <button type="button" class="notice-dismiss" data-notice-dismiss>entendido</button>
//       </div>
//   </div>
//
// data-notice-key es obligatoria: sin ella el aviso saldría en cada
// visita porque no habría dónde apuntar que ya se ha cerrado.
//
// Y si algún día CAMBIAS el texto de un aviso por algo que la gente
// deba leer de verdad, cámbiale también la clave (por ejemplo
// añadiéndole un -2 al final): quien ya lo hubiera cerrado se quedaría
// con el texto viejo para siempre, porque lo que se guarda es "este
// aviso ya lo ha visto", no qué ponía.

const NOTICE_DELAY = 700; // ms antes de aparecer

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
        // Si localStorage no está disponible (p. ej. navegación privada
        // estricta), simplemente se mostrará cada vez: no es grave.
    }

    if (alreadySeen) {
        return;
    }

    // El texto del aviso puede no caber en ventanas bajas (un portátil
    // de 768px de alto, por ejemplo). En ese caso el cuerpo se desplaza,
    // pero un corte limpio no se ve como "hay más": esta clase pinta un
    // degradado al final, igual que hace el menú lateral con su lista.
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
            // Sin localStorage, se volverá a mostrar en la próxima visita.
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
// =========================================
// COMPONENTE: BOTÓN "VOLVER ARRIBA" (solo móvil)
// =========================================
// Botón flotante abajo a la derecha que devuelve la página al principio.
// Solo se ve en móvil (lo decide el CSS) y solo cuando ya se ha bajado
// un poco: arriba del todo no pinta nada y taparía contenido.
//
// Lo del contenedor tiene truco. En este sitio la página NO se desplaza
// con la ventana: <body> está fijo a la altura de la pantalla y quien
// se desplaza es la sección de contenido (main > section), que es
// distinta en cada página (.home-page, .character-sheet, .relato-page…).
// Por eso el botón busca esa sección en vez de mirar window.scrollY,
// que aquí siempre vale 0.

const SUBIR_UMBRAL = 240; // píxeles bajados antes de que aparezca

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

// La sección de contenido de la página. El resto de cosas que también
// se desplazan (la lista de entradas de la portada, el cuerpo de una
// tarjeta...) se quedan fuera a propósito: el botón es para la página,
// no para una ventanita suelta de dentro.
function buscarContenedor() {
    return document.querySelector("main > section") || document.querySelector("main");
}

function actualizarSubir() {
    if (!subirBoton || !subirContenedor) {
        return;
    }
    const bajado = subirContenedor.scrollTop > SUBIR_UMBRAL;
    subirBoton.classList.toggle("is-visible", bajado);
    // Cuando no se ve, tampoco debe poder recibir el foco con el
    // tabulador ni que lo lea un lector de pantalla.
    subirBoton.inert = !bajado;
}

function volverArriba() {
    const sinAnimacion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    subirContenedor.scrollTo({ top: 0, behavior: sinAnimacion ? "auto" : "smooth" });

    // Además de mover la vista, se mueve el foco al principio: si no,
    // quien navegue con teclado seguiría donde estaba y el siguiente
    // tabulador le devolvería abajo. El tabindex se pone y se quita
    // para no dejar la sección enfocable para siempre.
    // Si ya es enfocable no se toca: teclado-scroll.js le pone
    // tabindex="0" a esta misma sección para que se pueda desplazar con
    // el teclado, y ponerle aquí un -1 y quitarlo después lo dejaba sin
    // atributo — es decir, volvía a no poder moverse con las flechas.
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
// =========================================
// COMPONENTE: SCROLL CON TECLADO
// =========================================
// Arregla un agujero gordo de accesibilidad de este sitio.
//
// Aquí la página NO se desplaza con la ventana: <body> está fijo a la
// altura de la pantalla y quien scrollea es la sección de contenido
// (main > section, que es .home-page, .character-sheet, .relato-page…).
// El navegador solo mueve con el teclado el contenedor que tiene el
// foco, y esa sección no se podía enfocar, así que —comprobado en las
// cuatro vistas— la barra espaciadora, AvPág, RePág, las flechas y
// Inicio/Fin no movían la página ni un píxel. Con teclado solo se
// podía avanzar tabulando de enlace en enlace, y el texto de una
// entrada larga, que no tiene enlaces, era inalcanzable.
//
// Se arregla por dos vías, a propósito:
//
//   1. La sección pasa a ser una región enfocable con nombre (igual
//      que las listas con scroll de la portada, que ya lo eran), así
//      que aparece en el recorrido del tabulador y un lector de
//      pantalla la anuncia como lo que es: una zona que se desplaza.
//      Solo se marca si de verdad hay algo que desplazar, para no
//      añadir una parada de tabulador que no sirve de nada.
//
//   2. Un manejador de teclado en el documento mueve la zona que toca
//      sin esperar a que nadie tabule: en cuanto se carga la página,
//      las teclas de siempre funcionan. Se llama a preventDefault()
//      para que el navegador no vuelva a mover lo mismo por su cuenta
//      y el salto quede del doble.
//
// Qué zona se mueve: la que contiene el foco. Si estás dentro de una
// tarjeta con scroll propio, se mueve esa tarjeta; si no, la página.
// Así las flechas hacen lo que uno espera en cada sitio.

const TECLADO_SALTO_LINEA = 0.12; // parte de la altura visible por flecha
const TECLADO_SALTO_PAGINA = 0.9; // parte de la altura visible por AvPág

// Escribiendo no se toca nada: ahí las teclas son del campo.
const TECLADO_ESCRIBIENDO = ["INPUT", "TEXTAREA", "SELECT"];
// La barra espaciadora activa botones, enlaces y <summary>: si el foco
// está en uno de esos, mandan ellos.
const TECLADO_PULSABLES = ["BUTTON", "A", "SUMMARY", "INPUT", "TEXTAREA", "SELECT", "OPTION"];

let tecladoMarcada = null; // la zona que ahora mismo lleva el rótulo

initializeTecladoScroll();

function initializeTecladoScroll() {
    if (!document.querySelector("main")) {
        return;
    }

    marcarRegion();
    // Los listados se rellenan por fetch, así que al arrancar puede que
    // todavía no haya contenido suficiente para desplazar nada.
    window.setTimeout(marcarRegion, 900);
    window.addEventListener("resize", marcarRegion, { passive: true });
    window.addEventListener("load", marcarRegion);

    document.addEventListener("keydown", manejarTecla);
}

// Cuál es "la página" depende de la vista. Normalmente es la sección de
// contenido (main > section), pero en las entradas de blog y en los
// relatos esa sección está a overflow: hidden y quien se desplaza es la
// caja del texto de dentro. En vez de dar por hecho una de las dos, se
// mira cuál puede desplazarse de verdad en este momento.
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

    // La caja con scroll más grande que haya dentro: la del texto.
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

// Enfocable y con nombre solo mientras haya algo que desplazar.
function marcarRegion() {
    const pagina = buscarPagina();
    if (tecladoMarcada && tecladoMarcada !== pagina) {
        desmarcar(tecladoMarcada);
        tecladoMarcada = null;
    }
    if (!pagina) {
        return;
    }
    // Las cajas que ya venían rotuladas a mano en el HTML (las listas
    // de la portada) se dejan como estaban.
    if (pagina.getAttribute("role") === "region" && pagina !== tecladoMarcada) {
        return;
    }
    if (pagina.getAttribute("tabindex") === null) {
        pagina.setAttribute("tabindex", "0");
    }
    pagina.setAttribute("role", "region");
    pagina.setAttribute("aria-label", "Contenido de la página, con scroll");
    tecladoMarcada = pagina;
}

function desmarcar(zona) {
    // Ojo: subir.js pone y quita un tabindex="-1" temporal para
    // llevarse el foco; ese no se toca.
    if (zona.getAttribute("tabindex") === "0") {
        zona.removeAttribute("tabindex");
    }
    zona.removeAttribute("role");
    zona.removeAttribute("aria-label");
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

    // Con el visor de imágenes abierto las teclas son suyas (Esc lo
    // cierra) y detrás no debe moverse nada.
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

// La zona con scroll más cercana al foco; si no hay ninguna, la página.
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
