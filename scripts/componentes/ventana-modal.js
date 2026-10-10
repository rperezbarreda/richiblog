// =========================================
// COMPONENTE: VENTANA MODAL
// =========================================
// Una ventana que se abre ENCIMA de la página, con su barra de título y
// su ✕, y que deja lo de detrás inerte mientras está abierta. La usan la
// ficha de un NPC, la mesa de una campaña y el botín.
//
// Estaba dentro de la página de npcs, que es donde se estrenó. Se sacó
// aquí el día que el índice de una campaña quiso dos ventanas iguales:
// una cosa que usan tres sitios ya no es de ninguno de ellos. Y había un
// motivo de más para sacarla: el foco, el inert y el Escape son
// exactamente la parte que no conviene escribir tres veces, porque las
// tres saldrían un poco distintas y dos de ellas, mal.
//
// CÓMO SE USA
// -----------
//     window.ventanaModal.abrir({
//         titulo: "botin.lst",       // lo que pone la barra
//         clase: "modal-botin",      // opcional, para darle estilo
//         llenar: (cuerpo) => { ... },   // mete ahí lo que sea
//         foco: elemento,            // opcional: a dónde va el foco
//         devolverA: boton,          // a dónde vuelve el foco al cerrar
//     });
//
//     window.ventanaModal.cerrar();
//     window.ventanaModal.abierta();   // ¿hay alguna abierta?
//
// "llenar" recibe el cuerpo ya vacío y lo llena. Puede devolver un
// elemento, y entonces ése es el que recibe el foco; si no devuelve
// nada, el foco va a la ✕.
//
// NO ES UN <dialog>, y no es purismo: la ventana de accesibilidad se hizo
// en su día con <dialog> y en el navegador de Richi salía dibujada en
// mitad de la página desde que cargaba, detrás del contenido. Esto es lo
// mismo que hace el visor de imágenes (visor-imagenes.js), que lleva
// meses funcionando.
//
// SOLO HAY UNA. Abrir otra con una abierta cambia lo que hay dentro y
// deja el foco de vuelta donde dijera la primera. Es a propósito: dos
// ventanas encima de otra son dos trampas de foco anidadas, y de ahí no
// se sale con el teclado.
//
// OJO CON LOS NOMBRES: todos los scripts comparten el mismo ámbito
// global. Se comprueba con herramientas/4-comprobar/nombres-repetidos.py.

const MODAL = {
    caja: null,       // el fondo oscuro con la ventana dentro
    devolverA: null,  // el botón que la abrió
    inertados: [],    // lo que se dejó inerte al abrir
    clase: "",        // la clase que le puso quien la abrió
};

window.ventanaModal = {
    abrir: abrirVentanaModal,
    cerrar: cerrarVentanaModal,
    abierta: () => !!MODAL.caja && !MODAL.caja.hidden,
};

function asegurarVentanaModal() {
    if (MODAL.caja) {
        return;
    }
    MODAL.caja = document.createElement("div");
    MODAL.caja.className = "modal";
    MODAL.caja.setAttribute("role", "dialog");
    MODAL.caja.setAttribute("aria-modal", "true");
    MODAL.caja.setAttribute("aria-labelledby", "modal-titulo");
    MODAL.caja.hidden = true;

    const ventana = document.createElement("div");
    ventana.className = "modal-ventana";

    const barra = document.createElement("div");
    barra.className = "modal-barra";
    const titulo = document.createElement("p");
    titulo.className = "modal-archivo";
    titulo.id = "modal-titulo";
    titulo.setAttribute("data-modal-titulo", "");
    barra.appendChild(titulo);

    const cerrar = document.createElement("button");
    cerrar.type = "button";
    cerrar.className = "modal-cerrar";
    cerrar.setAttribute("data-modal-cerrar", "");
    cerrar.setAttribute("aria-label", "Cerrar la ventana");
    cerrar.textContent = "✕";
    cerrar.addEventListener("click", cerrarVentanaModal);
    barra.appendChild(cerrar);
    ventana.appendChild(barra);

    const cuerpo = document.createElement("div");
    cuerpo.className = "modal-cuerpo";
    cuerpo.setAttribute("data-modal-cuerpo", "");
    ventana.appendChild(cuerpo);

    MODAL.caja.appendChild(ventana);

    // Pulsar FUERA de la ventana cierra. Se mira el propio fondo y no
    // "¿está dentro?" porque el clic en la ventana no llega aquí si se ha
    // soltado el ratón sobre un texto seleccionado.
    MODAL.caja.addEventListener("click", (evento) => {
        if (evento.target === MODAL.caja) {
            cerrarVentanaModal();
        }
    });
    document.body.appendChild(MODAL.caja);

    document.addEventListener("keydown", (evento) => {
        if (window.ventanaModal.abierta() && evento.key === "Escape") {
            cerrarVentanaModal();
        }
    });
}

// Lo de detrás, inerte mientras está abierta: role="dialog" y aria-modal
// avisan a un lector de pantalla, pero no impiden que el tabulador se
// pasee por los enlaces de la página tapada. Al cerrar solo se deshace lo
// que se tocó aquí, porque puede haber algo que YA estuviera inerte antes
// (el cajón del menú en móvil, por ejemplo).
function fondoInerteModal(inerte) {
    if (inerte) {
        MODAL.inertados = Array.from(document.body.children).filter(
            (el) => el !== MODAL.caja && !el.inert
        );
        MODAL.inertados.forEach((el) => {
            el.inert = true;
        });
        return;
    }
    MODAL.inertados.forEach((el) => {
        el.inert = false;
    });
    MODAL.inertados = [];
}

function abrirVentanaModal(opciones) {
    const ajustes = opciones || {};
    asegurarVentanaModal();

    MODAL.caja.querySelector("[data-modal-titulo]").textContent =
        (ajustes.titulo || "").toString().trim();

    // La clase de la anterior se quita: si no, abrir la mesa después del
    // botín dejaría la ventana con los estilos de las dos.
    if (MODAL.clase) {
        MODAL.caja.classList.remove(MODAL.clase);
    }
    MODAL.clase = (ajustes.clase || "").toString().trim();
    if (MODAL.clase) {
        MODAL.caja.classList.add(MODAL.clase);
    }

    const cuerpo = MODAL.caja.querySelector("[data-modal-cuerpo]");
    cuerpo.textContent = "";
    cuerpo.scrollTop = 0;
    let pedido = null;
    if (typeof ajustes.llenar === "function") {
        pedido = ajustes.llenar(cuerpo);
    }

    MODAL.caja.hidden = false;
    document.body.classList.add("modal-abierta");
    // Si ya había una abierta se queda el sitio al que volvía la primera:
    // es de donde salió la persona, y es a donde espera volver.
    if (!MODAL.devolverA) {
        MODAL.devolverA = ajustes.devolverA || null;
    }
    // Después de enseñarla: dejar inerte lo de detrás mientras la ventana
    // sigue oculta dejaría el foco sin sitio a donde ir.
    fondoInerteModal(true);

    const donde = ajustes.foco || pedido;
    if (donde && typeof donde.focus === "function") {
        donde.focus();
    } else {
        MODAL.caja.querySelector("[data-modal-cerrar]").focus();
    }
    return cuerpo;
}

function cerrarVentanaModal() {
    if (!window.ventanaModal.abierta()) {
        return;
    }
    // Se devuelve la página ANTES de esconder la ventana y de mover el
    // foco: si no, el botón que la abrió seguiría inerte y no podría
    // recibirlo.
    fondoInerteModal(false);
    MODAL.caja.hidden = true;
    document.body.classList.remove("modal-abierta");
    if (MODAL.devolverA && typeof MODAL.devolverA.focus === "function") {
        MODAL.devolverA.focus();
    }
    MODAL.devolverA = null;
}
