/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/botones-ventana.js
*/
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
