/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/subir.js
*/
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
