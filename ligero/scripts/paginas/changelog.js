/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/changelog.js
*/
const CHANGELOG_URL = "/datos/sitio/changelog.json";
initializeChangelog();
async function initializeChangelog() {
    const caja = document.querySelector("[data-changelog]");
    if (!caja) {
        return;
    }
    try {
        const respuesta = await window.pedirDatos(CHANGELOG_URL);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        const datos = await respuesta.json();
        const bloques = (Array.isArray(datos) ? datos : []).filter(
            (bloque) => bloque && Array.isArray(bloque.cosas) && bloque.cosas.length
        );
        if (bloques.length === 0) {
            caja.innerHTML =
                '<p class="entries-empty">Todavía no hay nada apuntado por aquí.</p>';
            return;
        }
        bloques.sort((a, b) => fechaChangelog(b.fecha) - fechaChangelog(a.fecha));
        caja.innerHTML = bloques.map(bloqueAHtml).join("");
        document.dispatchEvent(new CustomEvent("ventanas:actualizar"));
    } catch (error) {
        caja.innerHTML =
            '<p class="entries-error">No se ha podido cargar el changelog ahora mismo.</p>';
    }
}
function bloqueAHtml(bloque) {
    const cuando = fechaChangelog(bloque.fecha);
    const legible = isNaN(cuando.getTime())
        ? escapeChangelog(bloque.fecha || "")
        : cuando.toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "short",
              year: "numeric",
          });
    const titulo = (bloque.titulo || "").trim();
    return (
        '<section class="changelog-bloque">' +
        '<div class="recent-entries-header">' +
        `<h2><time datetime="${escapeChangelog(isoChangelog(bloque.fecha))}">${legible}</time></h2>` +
        '<div class="window-controls window-controls-small" data-window-controls aria-hidden="true"></div>' +
        "</div>" +
        '<div class="changelog-bloque-cuerpo">' +
        (titulo ? `<p class="changelog-titulo">${escapeChangelog(titulo)}</p>` : "") +
        '<ul class="changelog-cosas">' +
        bloque.cosas
            .map((cosa) => `<li>${escapeChangelog((cosa || "").toString().trim())}</li>`)
            .join("") +
        "</ul></div></section>"
    );
}
function fechaChangelog(cruda) {
    const partes = (cruda || "").split("-");
    if (partes.length !== 3) {
        return new Date(NaN);
    }
    const [dia, mes, anyo] = partes.map(Number);
    return new Date(anyo, mes - 1, dia);
}
function isoChangelog(cruda) {
    const partes = (cruda || "").split("-");
    if (partes.length !== 3) {
        return "";
    }
    const [dia, mes, anyo] = partes;
    return `${anyo}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}
function escapeChangelog(texto) {
    return (texto === null || texto === undefined ? "" : texto.toString())
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
