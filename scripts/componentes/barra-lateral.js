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
