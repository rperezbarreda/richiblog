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
//
// Y 3. Las OTRAS cajas con scroll (una tarjeta de «sobre mí» con más texto
// del que cabe, una tabla de la wiki más ancha que el móvil): si dentro no
// hay nada que se pueda enfocar, el tabulador no entra y con el teclado no
// hay forma de ver lo que queda escondido. A ésas se les da también un
// tabindex y un nombre, mientras tengan algo que desplazar.
//
// UNA LISTA SIGUE SIENDO UNA LISTA. Si lo que se desplaza es un <ul> (el
// mes del archivo del blog, las tareas del post-it), NO se le pone
// role="region": ese rol le quitaba lo de ser lista, y un lector de
// pantalla dejaba de decir «lista, 6 elementos». Lleva solo el tabindex y
// el nombre, que en una lista también valen.

const TECLADO_SALTO_LINEA = 0.12; // parte de la altura visible por flecha
const TECLADO_SALTO_PAGINA = 0.9; // parte de la altura visible por AvPág

// Escribiendo no se toca nada: ahí las teclas son del campo.
const TECLADO_ESCRIBIENDO = ["INPUT", "TEXTAREA", "SELECT"];
// La barra espaciadora activa botones, enlaces y <summary>: si el foco
// está en uno de esos, mandan ellos.
const TECLADO_PULSABLES = ["BUTTON", "A", "SUMMARY", "INPUT", "TEXTAREA", "SELECT", "OPTION"];
// Lo que ya tiene su papel y no se le cambia por "region".
const TECLADO_CON_PAPEL = ["UL", "OL", "DL", "TABLE"];
// Lo que se puede enfocar: si una caja ya tiene algo de esto dentro, el
// tabulador entra solo y no hace falta tocarla.
const TECLADO_ENFOCABLE =
    'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

let tecladoMarcada = null; // la zona que ahora mismo lleva el rótulo

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
    // Los listados se rellenan por fetch, así que al arrancar puede que
    // todavía no haya contenido suficiente para desplazar nada.
    window.setTimeout(marcarTodo, 900);
    window.addEventListener("resize", marcarTodo, { passive: true });
    window.addEventListener("load", marcarTodo);

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
    marcar(pagina, "Contenido de la página, con scroll");
    tecladoMarcada = pagina;
}

// Pone tabindex, nombre y —si no es una lista o una tabla— el rol de
// región. Apunta lo que ha puesto para quitar luego eso y nada más.
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
    // Ojo: subir.js pone y quita un tabindex="-1" temporal para
    // llevarse el foco; ese no se toca.
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

// Las demás cajas con scroll de dentro de <main> a las que el tabulador
// no llega. El nombre sale del título de su ventana si lo tiene
// («sobre_mi.txt, con scroll»); si es una tabla, «Tabla, con scroll».
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
        return "Tabla, con scroll";
    }
    const ventana = zona.closest(".recent-entries, .character-card");
    const titulo = ventana && ventana.querySelector("h2, h3");
    const texto = titulo ? titulo.textContent.trim() : "";
    return texto ? texto + ", con scroll" : "Zona con scroll";
}

// Las tablas anchas se desplazan de lado, no de arriba abajo. Aquí sin
// margen de tolerancia: lo que se sale de lado es texto que no se ve.
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
