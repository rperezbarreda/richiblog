/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/enlaces-fuera.js
*/
initializeEnlacesFuera();
vigilarEnlacesFuera();
function initializeEnlacesFuera() {
    document.querySelectorAll("a[href]").forEach(marcarEnlaceFuera);
}
function vigilarEnlacesFuera() {
    if (typeof MutationObserver !== "function") {
        return;
    }
    let pendiente = false;
    const vigilante = new MutationObserver(() => {
        if (pendiente) {
            return;
        }
        pendiente = true;
        window.requestAnimationFrame(() => {
            pendiente = false;
            vigilante.disconnect();
            initializeEnlacesFuera();
            encender();
        });
    });
    function encender() {
        vigilante.observe(document.body, { childList: true, subtree: true });
    }
    encender();
}
function marcarEnlaceFuera(enlace) {
    if (enlace.dataset.fueraVisto === "si") {
        return;
    }
    enlace.dataset.fueraVisto = "si";
    if (!saleDeLaWeb(enlace)) {
        return;
    }
    const yaDice = (enlace.textContent || "").toLowerCase();
    const avisaDePestana = yaDice.indexOf("pestaña") !== -1 || yaDice.indexOf("ventana") !== -1;
    const avisaDeFuera = yaDice.indexOf("externo") !== -1;
    const partes = [];
    if (!avisaDeFuera) {
        partes.push("enlace externo");
    }
    if (enlace.target === "_blank" && !avisaDePestana) {
        partes.push("se abre en otra pestaña");
    }
    if (partes.length) {
        const aviso = document.createElement("span");
        aviso.className = "visually-hidden";
        aviso.textContent = " (" + partes.join(", ") + ")";
        enlace.appendChild(aviso);
    }
    if (tieneTextoFuera(enlace)) {
        enlace.classList.add("enlace-fuera");
    }
}
function saleDeLaWeb(enlace) {
    const destino = enlace.getAttribute("href") || "";
    if (!/^https?:/i.test(destino)) {
        return false;
    }
    try {
        const suyo = new URL(destino, window.location.href).host;
        return sinWww(suyo) !== sinWww(window.location.host);
    } catch (error) {
        return false;
    }
}
function sinWww(host) {
    return host.replace(/^www\./i, "");
}
function tieneTextoFuera(enlace) {
    const copia = enlace.cloneNode(true);
    copia.querySelectorAll(".visually-hidden").forEach((n) => n.remove());
    return (copia.textContent || "").trim().length > 0;
}
