// =========================================
// COMPONENTE: LIGHTBOX (visor de imágenes en modal)
// =========================================
// Cualquier imagen envuelta así se puede ampliar al hacer clic:
//   <button class="lightbox-trigger" type="button">
//       <img src="..." alt="...">
//   </button>
// Usa delegación de eventos, así que funciona en cualquier página
// que cargue este script, sin tener que engancharse imagen a imagen.

let lightboxOverlay = null;
let lightboxImage = null;
let lightboxLastTrigger = null;

initializeLightbox();

function initializeLightbox() {
    document.addEventListener("click", (event) => {
        const trigger = event.target.closest(".lightbox-trigger");
        if (trigger) {
            openLightbox(trigger);
            return;
        }
        if (event.target.closest(".lightbox-close") || event.target === lightboxOverlay) {
            closeLightbox();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && lightboxOverlay) {
            closeLightbox();
        }
    });
}

function ensureOverlay() {
    if (lightboxOverlay) {
        return;
    }
    lightboxOverlay = document.createElement("div");
    lightboxOverlay.className = "lightbox-overlay";
    lightboxOverlay.setAttribute("role", "dialog");
    lightboxOverlay.setAttribute("aria-modal", "true");
    lightboxOverlay.setAttribute("aria-label", "Imagen ampliada");
    lightboxOverlay.hidden = true;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "lightbox-close";
    closeBtn.setAttribute("aria-label", "Cerrar imagen ampliada");
    closeBtn.textContent = "✕";

    lightboxImage = document.createElement("img");
    lightboxImage.className = "lightbox-image";
    lightboxImage.alt = "";

    lightboxOverlay.appendChild(closeBtn);
    lightboxOverlay.appendChild(lightboxImage);
    document.body.appendChild(lightboxOverlay);
}

// El visor se anuncia como diálogo modal (role="dialog" +
// aria-modal="true"), pero eso por sí solo no impide que el tabulador
// se vaya al contenido de detrás: hay que dejarlo inerte, igual que
// hace el menú lateral al abrirse. Sin esto, tabular dentro del visor
// paseaba por los enlaces de la página tapada, que ni se ven.
// Al cerrar no vale con poner inert = false en todo: puede haber algo
// de detrás que YA estuviera inerte antes de abrir el visor y que deba
// seguir estándolo. Pasa de verdad con el gatín aleatorio del menú: en
// móvil se puede ampliar su foto con el cajón abierto, y el cajón ya
// había dejado inerte el resto de la página. Si al cerrar la foto se
// limpiara todo, el tabulador se escaparía al contenido que tapa el
// cajón. Por eso se apunta qué se ha tocado y solo se deshace eso.
let lightboxInertados = [];

function setBackgroundInert(isInert) {
    if (isInert) {
        lightboxInertados = Array.from(document.body.children).filter(
            (el) => el !== lightboxOverlay && !el.inert
        );
        lightboxInertados.forEach((el) => {
            el.inert = true;
        });
        return;
    }

    lightboxInertados.forEach((el) => {
        el.inert = false;
    });
    lightboxInertados = [];
}

function openLightbox(trigger) {
    const img = trigger.querySelector("img");
    if (!img) {
        return;
    }
    ensureOverlay();

    // Si el botón trae una versión grande aparte (galería del santuario,
    // donde lo que se ve en la rejilla es una miniatura), se amplía esa.
    // Si no, la propia imagen, como en el resto del sitio.
    lightboxImage.src = imagenSeguraLightbox(
        trigger.dataset.completa || img.currentSrc || img.src
    );
    lightboxImage.alt = img.alt || "";
    lightboxOverlay.hidden = false;
    document.body.classList.add("lightbox-open");
    lightboxLastTrigger = trigger;

    // Después de mostrarlo: marcar inerte lo de detrás mientras el
    // propio visor sigue oculto dejaría el foco sin sitio a donde ir.
    setBackgroundInert(true);

    const closeBtn = lightboxOverlay.querySelector(".lightbox-close");
    closeBtn.focus();
}

// La dirección sale de un data- del HTML y de la propia imagen, que las
// escribes tú, pero acaba en un src: se comprueba cómo empieza, igual
// que en el resto del sitio. Vale una dirección de esta web (una "/" que
// no sea "//", que sería otra web), una http(s) entera o un data: de
// imagen. Lo demás no se pone.
function imagenSeguraLightbox(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)
        || /^data:image\//i.test(limpia)) {
        return limpia;
    }
    return "";
}

function closeLightbox() {
    if (!lightboxOverlay || lightboxOverlay.hidden) {
        return;
    }
    // Se devuelve la página antes de esconder el visor y de mover el
    // foco: si no, el elemento que abrió la imagen seguiría inerte y
    // no podría recibirlo.
    setBackgroundInert(false);

    lightboxOverlay.hidden = true;
    lightboxImage.src = "";
    document.body.classList.remove("lightbox-open");

    if (lightboxLastTrigger) {
        lightboxLastTrigger.focus();
        lightboxLastTrigger = null;
    }
}
