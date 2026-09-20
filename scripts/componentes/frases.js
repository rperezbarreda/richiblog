// =========================================
// MARQUEE SIN CORTES
// =========================================
// En vez de asumir que "2 copias" del texto siempre son más
// anchas que la barra (no lo son: depende del ancho de pantalla
// y de lo largo que sea el texto), clonamos tantas copias como
// hagan falta para que la pista mida de sobra el doble de ancho
// que la barra visible. Así, al desplazar exactamente un 50%,
// siempre hay contenido idéntico detrás y el bucle no se corta.

const MARQUEE_PX_PER_SECOND = 45;

function initializeQuotesMarquee() {
    const bar = document.querySelector(".quotes-bar");
    const track = document.querySelector(".quotes-track");
    const original = document.querySelector(".quotes-content");

    if (!bar || !track || !original) {
        return;
    }

    buildTrack(bar, track, original);

    // Si la ventana cambia de tamaño (p.ej. se redimensiona el
    // navegador), recalculamos por si hacen falta más o menos copias.
    let resizeTimer = null;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => buildTrack(bar, track, original), 200);
    });
}

function buildTrack(bar, track, original) {
    // Partimos siempre de una única copia (la original, visible
    // para lectores de pantalla) y quitamos el resto de clones
    // antes de recalcular, por si esto se llama de nuevo en un resize.
    track.querySelectorAll(".quotes-content").forEach((el, index) => {
        if (index > 0) {
            el.remove();
        }
    });

    const barWidth = bar.clientWidth;
    const contentWidth = original.getBoundingClientRect().width;

    if (contentWidth === 0 || barWidth === 0) {
        return;
    }

    // Cuántas copias hacen falta para que la pista mida de sobra
    // el doble del ancho visible (con margen extra de seguridad).
    let copiesNeeded = Math.ceil((barWidth * 2.2) / contentWidth);
    if (copiesNeeded < 2) {
        copiesNeeded = 2;
    }
    // Número par, para que el 50% de translateX caiga siempre
    // justo en un límite entre repeticiones.
    if (copiesNeeded % 2 !== 0) {
        copiesNeeded += 1;
    }

    for (let i = 1; i < copiesNeeded; i++) {
        const clone = original.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
    }

    const totalWidth = contentWidth * copiesNeeded;

    // Velocidad constante en píxeles/segundo, en vez de una
    // duración fija: así el ticker se mueve siempre a la misma
    // velocidad visual, tengan más o menos copias.
    const durationSeconds = (totalWidth / 2) / MARQUEE_PX_PER_SECOND;

    const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
        track.style.animation = "none";
    } else {
        track.style.animationDuration = `${durationSeconds}s`;
    }
}

// =========================================
// CARGAR QUOTES
// =========================================

loadComponent("quotes-container", "/fragmentos/frases.html", () => {
    initializeQuotesMarquee();
});
