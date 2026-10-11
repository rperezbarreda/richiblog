/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/ventana-modal.js
*/
const MODAL = {
    caja: null,
    devolverA: null,
    inertados: [],
    clase: "",
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
    if (!MODAL.devolverA) {
        MODAL.devolverA = ajustes.devolverA || null;
    }
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
    fondoInerteModal(false);
    MODAL.caja.hidden = true;
    document.body.classList.remove("modal-abierta");
    if (MODAL.devolverA && typeof MODAL.devolverA.focus === "function") {
        MODAL.devolverA.focus();
    }
    MODAL.devolverA = null;
}
