// =========================================
// COMPONENTE: LIGHTBOX (visor de imágenes en modal)
// =========================================
// Cualquier imagen envuelta así se puede ampliar al hacer clic:
//   <button class="lightbox-trigger" type="button">
//       <img src="..." alt="...">
//   </button>
// Usa delegación de eventos, así que funciona en cualquier página
// que cargue este script, sin tener que engancharse imagen a imagen.
//
// GALERÍAS: si los botones están dentro de algo con data-visor-grupo
// (las capturas de la pantalla de máster en «recursos de rol»), el visor
// pone ‹ anterior y siguiente ›, dice «3 de 8» y se pasa con las flechas
// del teclado. El pie de cada foto sale de data-pie del botón (si no
// tiene, solo la cuenta).

let lightboxOverlay = null;
let lightboxImage = null;
let lightboxLastTrigger = null;
let lightboxGrupo = [];
let lightboxPos = 0;
let lightboxPie = null;
let lightboxAnterior = null;
let lightboxSiguiente = null;

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
        if (!lightboxOverlay || lightboxOverlay.hidden) {
            return;
        }
        if (event.key === "Escape") {
            // Que no cierre también la ventana de debajo (una galería
            // dentro de una ventana modal): el Escape es solo para esto.
            event.preventDefault();
            closeLightbox();
        } else if (lightboxGrupo.length > 1 && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
            event.preventDefault();
            moverLightbox(event.key === "ArrowLeft" ? -1 : 1);
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

    // Para las galerías: anterior, siguiente y el pie («3 de 8 · …»).
    lightboxAnterior = document.createElement("button");
    lightboxAnterior.type = "button";
    lightboxAnterior.className = "lightbox-paso lightbox-anterior";
    lightboxAnterior.setAttribute("aria-label", "Imagen anterior");
    lightboxAnterior.textContent = "‹";
    lightboxAnterior.addEventListener("click", () => moverLightbox(-1));
    lightboxSiguiente = document.createElement("button");
    lightboxSiguiente.type = "button";
    lightboxSiguiente.className = "lightbox-paso lightbox-siguiente";
    lightboxSiguiente.setAttribute("aria-label", "Imagen siguiente");
    lightboxSiguiente.textContent = "›";
    lightboxSiguiente.addEventListener("click", () => moverLightbox(1));
    lightboxPie = document.createElement("p");
    lightboxPie.className = "lightbox-pie";
    lightboxPie.setAttribute("aria-live", "polite");

    const marco = document.createElement("div");
    marco.className = "lightbox-marco";
    marco.appendChild(lightboxImage);
    marco.appendChild(lightboxPie);

    lightboxOverlay.appendChild(closeBtn);
    lightboxOverlay.appendChild(lightboxAnterior);
    lightboxOverlay.appendChild(marco);
    lightboxOverlay.appendChild(lightboxSiguiente);
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

    const grupo = trigger.closest("[data-visor-grupo]");
    lightboxGrupo = grupo ? Array.from(grupo.querySelectorAll(".lightbox-trigger")) : [trigger];
    lightboxPos = Math.max(0, lightboxGrupo.indexOf(trigger));
    const varias = lightboxGrupo.length > 1;
    lightboxAnterior.hidden = !varias;
    lightboxSiguiente.hidden = !varias;
    ponerLightbox(trigger);
    lightboxOverlay.hidden = false;
    document.body.classList.add("lightbox-open");
    lightboxLastTrigger = trigger;

    // Después de mostrarlo: marcar inerte lo de detrás mientras el
    // propio visor sigue oculto dejaría el foco sin sitio a donde ir.
    setBackgroundInert(true);

    const closeBtn = lightboxOverlay.querySelector(".lightbox-close");
    closeBtn.focus();
}

// Pone en el visor la imagen de ese botón (y su pie, en las galerías).
function ponerLightbox(trigger) {
    const img = trigger.querySelector("img");
    if (!img) {
        return;
    }
    // Si el botón trae una versión grande aparte (galería del santuario,
    // donde lo que se ve en la rejilla es una miniatura), se amplía esa.
    // Si no, la propia imagen, como en el resto del sitio.
    lightboxImage.src = imagenSeguraLightbox(
        trigger.dataset.completa || img.currentSrc || img.src
    );
    lightboxImage.alt = img.alt || "";
    const pie = (trigger.dataset.pie || "").trim();
    if (lightboxGrupo.length > 1) {
        lightboxPie.textContent = lightboxPos + 1 + " de " + lightboxGrupo.length + (pie ? " · " + pie : "");
    } else {
        lightboxPie.textContent = pie;
    }
    lightboxPie.hidden = !lightboxPie.textContent;
}

// Anterior (-1) o siguiente (1), dando la vuelta al llegar al final. Al
// cerrar, el foco vuelve a la miniatura de la última que se vio.
function moverLightbox(paso) {
    if (lightboxGrupo.length < 2) {
        return;
    }
    lightboxPos = (lightboxPos + paso + lightboxGrupo.length) % lightboxGrupo.length;
    lightboxLastTrigger = lightboxGrupo[lightboxPos];
    ponerLightbox(lightboxLastTrigger);
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
    lightboxGrupo = [];
    document.body.classList.remove("lightbox-open");

    if (lightboxLastTrigger) {
        lightboxLastTrigger.focus();
        lightboxLastTrigger = null;
    }
}
