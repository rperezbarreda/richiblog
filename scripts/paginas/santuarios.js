// =========================================
// GALERÍA DEL SANTUARIO — leída desde datos/fotos-santuarios.json
// =========================================
// La ficha de cada gato ya no lleva las fotos escritas a mano: se
// montan aquí a partir del listado que genera
// herramientas/generar-galeria.py. Para añadir fotos nuevas basta con
// dejarlas en imagenes/santuarios/<gato>/, ejecutar ese script y subir lo
// que salga — sin tocar ni una línea de HTML.
//
// La rejilla carga las MINIATURAS (unos 30 KB cada una); la foto
// grande solo se descarga si alguien la amplía. Con 35 fotos eso es
// la diferencia entre una página de 6,7 MB y una de 1 MB.
//
//   <div class="photo-gallery" data-galeria="tali"></div>

const GALERIA_URL = "/datos/fotos-santuarios.json";

initializeGaleria();

async function initializeGaleria() {
    const contenedor = document.querySelector("[data-galeria]");
    if (!contenedor) {
        return;
    }

    const gato = contenedor.getAttribute("data-galeria");

    try {
        const respuesta = await fetch(GALERIA_URL);
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

    // Proporciones de la miniatura, calculadas a partir de las de la
    // foto grande: sirven para que el navegador reserve el hueco antes
    // de descargarla y la rejilla no dé saltos al ir cargando.
    const escala = 600 / Math.max(foto.ancho || 600, foto.alto || 600);
    const ancho = Math.round((foto.ancho || 600) * Math.min(1, escala));
    const alto = Math.round((foto.alto || 600) * Math.min(1, escala));

    return (
        '<button type="button" class="lightbox-trigger"' +
        // La foto grande va aparte: el visor la lee de aquí en vez de
        // ampliar la miniatura, que se vería borrosa.
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
