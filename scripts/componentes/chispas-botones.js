// =========================================
// BOTONES DE VENTANA — PEQUEÑO ESTALLIDO AL PULSARLOS
// =========================================
// De los botones "−■✕" de las cabeceras, el de cerrar sigue siendo
// decorativo (no cierra nada de verdad), así que a ese le añadimos un
// efecto divertido al pulsarlo, reutilizando el mismo tipo de partícula
// que ya usa el botón de inspiración.
//
// Los otros dos ya hacen lo que dicen desde que existe
// scripts/componentes/ventanas-plegables.js: plegar la ventana y
// devolverla a su tamaño. Esos no sueltan brillos, que la respuesta a
// pulsarlos es la propia ventana plegándose.
//
// Se usa delegación de eventos en "document" para que funcione con
// cualquier botón de ventana de cualquier página, sin tener que
// engancharse uno a uno ni preocuparse de los que se cargan luego
// (como los del sidebar).

const WINDOW_BTN_SYMBOLS = ["✨", "⭐", "✦", "✧"];
const WINDOW_BTN_PARTICLES = 10;
const WINDOW_BTN_LIFETIME = 700; // ms, debe coincidir con la animación CSS

initializeWindowBtnEffects();

function initializeWindowBtnEffects() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    document.addEventListener("click", (event) => {
        const button = event.target.closest(".window-btn");
        if (!button) {
            return;
        }
        // El de cerrar, siempre. Los de minimizar y maximizar, solo si
        // están en un sitio donde no hay nada que plegar: el 404 lleva
        // los −■✕ sueltos sobre la pantalla entera, sin barra de título,
        // y ahí los tres siguen siendo de adorno.
        const enBarra = button.closest(".ventana-barra");
        if (enBarra && button.dataset.ventanaAccion !== "cerrar") {
            return;
        }
        spawnWindowBtnBurst(event.clientX, event.clientY);
    });
}

function spawnWindowBtnBurst(x, y) {
    for (let i = 0; i < WINDOW_BTN_PARTICLES; i++) {
        const angle = (Math.PI * 2 * i) / WINDOW_BTN_PARTICLES;
        const distance = 30 + Math.random() * 30;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        spawnWindowBtnParticle(x, y, dx, dy);
    }
}

function spawnWindowBtnParticle(x, y, dx, dy) {
    const particle = document.createElement("span");
    particle.className = "firework-particle";
    particle.textContent =
        WINDOW_BTN_SYMBOLS[Math.floor(Math.random() * WINDOW_BTN_SYMBOLS.length)];
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.fontSize = "0.75rem";
    particle.style.setProperty("--dx", `${dx}px`);
    particle.style.setProperty("--dy", `${dy}px`);
    particle.setAttribute("aria-hidden", "true");
    document.body.appendChild(particle);

    window.setTimeout(() => {
        particle.remove();
    }, WINDOW_BTN_LIFETIME);
}
