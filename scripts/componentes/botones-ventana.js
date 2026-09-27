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

const WINDOW_CONTROLS_MARKUP = Object.keys(WINDOW_CONTROLS_ICONOS)
    .map(
        (nombre) =>
            '<span class="window-btn">' +
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
