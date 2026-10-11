/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/santuarios.js
*/
const GALERIA_URL = "/datos/mi_rincon/fotos-santuarios.json";
initializeGaleria();
async function initializeGaleria() {
    const contenedor = document.querySelector("[data-galeria]");
    if (!contenedor) {
        return;
    }
    const gato = contenedor.getAttribute("data-galeria");
    try {
        const respuesta = await window.pedirDatos(GALERIA_URL);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        const todas = await respuesta.json();
        const fotos = Array.isArray(todas[gato]) ? todas[gato] : [];
        if (fotos.length === 0) {
            contenedor.innerHTML =
                '<p class="galeria-vacia">Todavía no hay fotos por aquí.</p>';
            return;
        }
        contenedor.innerHTML = fotos.map((foto) => fotoAHtml(foto, gato)).join("");
    } catch (error) {
        contenedor.innerHTML =
            '<p class="galeria-vacia">No se han podido cargar las fotos ahora mismo.</p>';
    }
}
function fotoAHtml(foto, gato) {
    const carpeta = `/imagenes/santuarios/${encodeURIComponent(gato)}/`;
    const mini = carpeta + encodeURIComponent(foto.mini || foto.archivo);
    const grande = carpeta + encodeURIComponent(foto.archivo);
    const alt = escapeHtml(foto.alt || "");
    const escala = 600 / Math.max(foto.ancho || 600, foto.alto || 600);
    const ancho = Math.round((foto.ancho || 600) * Math.min(1, escala));
    const alto = Math.round((foto.alto || 600) * Math.min(1, escala));
    return (
        '<button type="button" class="lightbox-trigger"' +
        ` data-completa="${escapeHtml(grande)}">` +
        `<img src="${escapeHtml(mini)}" alt="${alt}"` +
        ` width="${ancho}" height="${alto}" loading="lazy" decoding="async">` +
        "</button>"
    );
}
function escapeHtml(text) {
    return (text === null || text === undefined ? "" : text.toString())
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
