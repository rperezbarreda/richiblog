// =========================================
// COMPONENTE: AVISO EMERGENTE
// =========================================
// Ventanita que aparece sola al entrar, se cierra con su botón o con
// Escape, y no vuelve a salir para ese visitante (se recuerda en
// localStorage, que no es una cookie: no viaja al servidor, solo vive
// en el propio navegador).
//
// Antes esto era exclusivo de la portada. Ahora cualquier página puede
// tener el suyo, y puede haber varios en la misma página: cada uno se
// recuerda por separado gracias a su propia clave.
//
// Ejemplo de uso en el HTML:
//   <div class="notice" data-notice data-notice-key="richi-lo-que-sea"
//        role="dialog" aria-labelledby="mi-titulo" hidden>
//       <div class="recent-entries-header">
//           <h2 id="mi-titulo">un aviso</h2>
//           <div class="window-controls window-controls-small" data-window-controls aria-hidden="true"></div>
//       </div>
//       <div class="notice-body">
//           <p>...</p>
//           <button type="button" class="notice-dismiss" data-notice-dismiss>entendido</button>
//       </div>
//   </div>
//
// data-notice-key es obligatoria: sin ella el aviso saldría en cada
// visita porque no habría dónde apuntar que ya se ha cerrado.
//
// Y si algún día CAMBIAS el texto de un aviso por algo que la gente
// deba leer de verdad, cámbiale también la clave (por ejemplo
// añadiéndole un -2 al final): quien ya lo hubiera cerrado se quedaría
// con el texto viejo para siempre, porque lo que se guarda es "este
// aviso ya lo ha visto", no qué ponía.

const NOTICE_DELAY = 700; // ms antes de aparecer

initializeNoticeComponent();

function initializeNoticeComponent() {
    document.querySelectorAll("[data-notice]").forEach(setUpNotice);
}

function setUpNotice(notice) {
    const storageKey = notice.getAttribute("data-notice-key");
    const dismissBtn = notice.querySelector("[data-notice-dismiss]");
    if (!storageKey || !dismissBtn) {
        return;
    }

    let alreadySeen = false;
    try {
        alreadySeen = localStorage.getItem(storageKey) === "true";
    } catch (error) {
        // Si localStorage no está disponible (p. ej. navegación privada
        // estricta), simplemente se mostrará cada vez: no es grave.
    }

    if (alreadySeen) {
        return;
    }

    // El texto del aviso puede no caber en ventanas bajas (un portátil
    // de 768px de alto, por ejemplo). En ese caso el cuerpo se desplaza,
    // pero un corte limpio no se ve como "hay más": esta clase pinta un
    // degradado al final, igual que hace el menú lateral con su lista.
    const cuerpo = notice.querySelector(".notice-body");
    const revisarScroll = () => {
        if (!cuerpo) {
            return;
        }
        const quedaPorVer = cuerpo.scrollHeight - cuerpo.clientHeight - cuerpo.scrollTop;
        notice.classList.toggle("has-scroll", quedaPorVer > 4);
    };

    window.setTimeout(() => {
        notice.hidden = false;
        revisarScroll();
    }, NOTICE_DELAY);

    if (cuerpo) {
        cuerpo.addEventListener("scroll", revisarScroll, { passive: true });
        window.addEventListener("resize", revisarScroll, { passive: true });
    }

    const closeNotice = () => {
        notice.hidden = true;
        try {
            localStorage.setItem(storageKey, "true");
        } catch (error) {
            // Sin localStorage, se volverá a mostrar en la próxima visita.
        }
    };

    dismissBtn.addEventListener("click", closeNotice);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !notice.hidden) {
            closeNotice();
        }
    });
}
