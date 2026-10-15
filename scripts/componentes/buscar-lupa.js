// =========================================
// COMPONENTE: LA LUPA DEL MENÚ
// =========================================
// El botón de "buscar" (flotante en escritorio, al final del menú en
// el móvil) abre una ventana con el campo
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
};

document.addEventListener("sidebar:loaded", initializeBuscarLupa);

function initializeBuscarLupa() {
    // Hay DOS botones: el flotante de escritorio (debajo del de plegar la
    // barra) y el del final del menú, que es el del móvil. Solo se ve uno
    // cada vez (lo decide el CSS) y los dos abren la misma ventana.
    const botones = document.querySelectorAll("[data-buscar-lupa]");
    const ventana = document.querySelector("[data-buscar-modal]");
    if (!botones.length || !ventana || LUPA.ventana) {
        return;
    }
    LUPA.ventana = ventana;

    botones.forEach((boton) => boton.addEventListener("click", abrirLupa));

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
