// =========================================
// RASTRO DE PARTÍCULAS DEL CURSOR
// =========================================
// Efecto puramente decorativo: al mover el ratón, va dejando
// pequeñas partículas que se desvanecen. Se puede activar/desactivar
// con el botón del sidebar (persistido en localStorage), y se
// respeta "prefers-reduced-motion" por encima de cualquier preferencia
// guardada.

const CURSOR_TRAIL_STORAGE_KEY = "richi-cursor-trail";
const CURSOR_TRAIL_MIN_DISTANCE = 24; // px mínimos entre partículas
const CURSOR_TRAIL_LIFETIME = 700; // ms, debe coincidir con la animación CSS
const CURSOR_TRAIL_OFFSET_Y = 16; // px hacia abajo, para que parezca estela
const CURSOR_TRAIL_EMOJIS = ["✦","🟐","✵","⛤","★", "☆", "✦", "✧", "✪", "✫", "✬", "✭", "✮", "✯", "✰", "✱", "✲", "✳", "✴", "✵", "✶", "✷", "✸", "✹", "✺", "✻", "✼", "✽", "❂"];

let cursorTrailEnabled = true;
let lastParticleX = null;
let lastParticleY = null;

document.addEventListener("sidebar:loaded", initializeCursorTrailToggle);

initializeCursorTrail();

// =========================================
// INICIALIZAR
// =========================================

function initializeCursorTrail() {
    if (prefersReducedMotion()) {
        cursorTrailEnabled = false;
    } else {
        const saved = readSavedPreference();
        if (saved !== null) {
            cursorTrailEnabled = saved;
        }
    }

    document.addEventListener("mousemove", handleMouseMove);
}

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// =========================================
// GENERAR PARTÍCULAS
// =========================================

function handleMouseMove(event) {
    if (!cursorTrailEnabled) {
        return;
    }

    if (lastParticleX !== null) {
        const dx = event.clientX - lastParticleX;
        const dy = event.clientY - lastParticleY;
        if (Math.sqrt(dx * dx + dy * dy) < CURSOR_TRAIL_MIN_DISTANCE) {
            return;
        }
    }

    lastParticleX = event.clientX;
    lastParticleY = event.clientY;
    spawnParticle(event.clientX, event.clientY);
}

function spawnParticle(x, y) {
    const particle = document.createElement("span");
    particle.className = "cursor-particle";
    particle.textContent =
        CURSOR_TRAIL_EMOJIS[Math.floor(Math.random() * CURSOR_TRAIL_EMOJIS.length)];
    particle.style.left = `${x}px`;
    particle.style.top = `${y + CURSOR_TRAIL_OFFSET_Y}px`;
    particle.style.fontSize = `${10 + Math.random() * 6}px`;
    particle.setAttribute("aria-hidden", "true");
    document.body.appendChild(particle);

    window.setTimeout(() => {
        particle.remove();
    }, CURSOR_TRAIL_LIFETIME);
}

// =========================================
// BOTÓN DE ACTIVAR/DESACTIVAR
// =========================================

function initializeCursorTrailToggle() {
    const button = document.getElementById("cursor-trail-toggle");
    if (!button) {
        return;
    }

    applyCursorTrailState(button);

    button.addEventListener("click", () => {
        cursorTrailEnabled = !cursorTrailEnabled;
        applyCursorTrailState(button);
        saveCursorTrailPreference(cursorTrailEnabled);
    });
}

function applyCursorTrailState(button) {
    button.setAttribute("aria-pressed", cursorTrailEnabled ? "true" : "false");
    button.setAttribute(
        "aria-label",
        cursorTrailEnabled
            ? "Desactivar el rastro del cursor"
            : "Activar el rastro del cursor"
    );
    const text = button.querySelector(".cursor-trail-toggle-text");
    if (text) {
        text.textContent = cursorTrailEnabled ? "BRILLITO: ON" : "BRILLITO: OFF";
    }
}

// =========================================
// GUARDAR / LEER PREFERENCIA
// =========================================

function saveCursorTrailPreference(enabled) {
    try {
        // Encendido es lo de fábrica, y lo de fábrica no se guarda: se
        // borra la clave. Así quien no ha tocado nada y quien lo ha
        // vuelto a encender quedan igual, y el botón de "dejarlo todo
        // como estaba" de la ventana de accesibilidad no deja ni rastro
        // en el almacén. Es la misma regla que sigue guardarAjuste() en
        // scripts/componentes/ajustes.js.
        if (enabled) {
            localStorage.removeItem(CURSOR_TRAIL_STORAGE_KEY);
        } else {
            localStorage.setItem(CURSOR_TRAIL_STORAGE_KEY, "false");
        }
    } catch (error) {
        // localStorage puede fallar (modo privado, cuota, etc.)
        // No es crítico: el efecto seguirá aplicado en esta página.
    }
}

function readSavedPreference() {
    try {
        const saved = localStorage.getItem(CURSOR_TRAIL_STORAGE_KEY);
        return saved === null ? null : saved === "true";
    } catch (error) {
        return null;
    }
}
