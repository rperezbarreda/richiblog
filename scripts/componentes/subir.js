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
