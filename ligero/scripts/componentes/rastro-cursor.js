/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/rastro-cursor.js
*/
const CURSOR_TRAIL_STORAGE_KEY = "richi-cursor-trail";
const CURSOR_TRAIL_MIN_DISTANCE = 24;
const CURSOR_TRAIL_LIFETIME = 700;
const CURSOR_TRAIL_OFFSET_Y = 16;
const CURSOR_TRAIL_EMOJIS = ["✦","🟐","✵","⛤","★", "☆", "✦", "✧", "✪", "✫", "✬", "✭", "✮", "✯", "✰", "✱", "✲", "✳", "✴", "✵", "✶", "✷", "✸", "✹", "✺", "✻", "✼", "✽", "❂"];
let cursorTrailEnabled = true;
let lastParticleX = null;
let lastParticleY = null;
document.addEventListener("sidebar:loaded", initializeCursorTrailToggle);
initializeCursorTrail();
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
function saveCursorTrailPreference(enabled) {
    try {
        if (enabled) {
            localStorage.removeItem(CURSOR_TRAIL_STORAGE_KEY);
        } else {
            localStorage.setItem(CURSOR_TRAIL_STORAGE_KEY, "false");
        }
    } catch (error) {
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
