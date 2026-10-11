/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/lupa.js
*/
const LA_LUPA = { capa: null, devolverA: null };
function rutaSeguraDeLaLupa(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "";
}
function abrirLaLupa(opciones) {
    const ajustes = opciones || {};
    const ruta = rutaSeguraDeLaLupa(ajustes.ruta);
    if (!ruta) {
        return false;
    }
    cerrarLaLupa();
    const texto = (ajustes.texto || "").toString().trim();
    const que = (ajustes.que === undefined || ajustes.que === null
        ? "Imagen de" : ajustes.que).toString().trim();
    const comoSeLlama = [que, texto].filter(Boolean).join(" ") || "Imagen";
    const capa = document.createElement("div");
    capa.className = "lupa";
    capa.setAttribute("role", "dialog");
    capa.setAttribute("aria-modal", "true");
    capa.setAttribute("aria-label", comoSeLlama);
    const cerrar = document.createElement("button");
    cerrar.type = "button";
    cerrar.className = "lupa-cerrar";
    cerrar.setAttribute("aria-label", "Cerrar la imagen");
    cerrar.textContent = "✕";
    cerrar.addEventListener("click", cerrarLaLupa);
    capa.appendChild(cerrar);
    const img = document.createElement("img");
    img.className = "lupa-img";
    img.src = ruta;
    img.alt = (ajustes.alt || "").toString().trim() || comoSeLlama;
    capa.appendChild(img);
    if (texto) {
        const pie = document.createElement("p");
        pie.className = "lupa-pie";
        pie.textContent = texto;
        capa.appendChild(pie);
    }
    capa.addEventListener("click", (evento) => {
        if (evento.target === capa) {
            cerrarLaLupa();
        }
    });
    document.body.appendChild(capa);
    LA_LUPA.capa = capa;
    LA_LUPA.devolverA = ajustes.devolverA || null;
    document.addEventListener("keydown", escapeDeLaLupa, true);
    cerrar.focus();
    return true;
}
function cerrarLaLupa() {
    if (!LA_LUPA.capa) {
        return;
    }
    document.removeEventListener("keydown", escapeDeLaLupa, true);
    LA_LUPA.capa.remove();
    LA_LUPA.capa = null;
    const vuelve = LA_LUPA.devolverA;
    LA_LUPA.devolverA = null;
    if (vuelve && document.contains(vuelve)) {
        vuelve.focus();
    }
}
function escapeDeLaLupa(evento) {
    if (evento.key !== "Escape" || !LA_LUPA.capa) {
        return;
    }
    evento.preventDefault();
    evento.stopPropagation();
    cerrarLaLupa();
}
window.lupa = {
    abrir: abrirLaLupa,
    cerrar: cerrarLaLupa,
    estaAbierta: () => !!LA_LUPA.capa,
};
