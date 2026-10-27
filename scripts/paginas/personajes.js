// =========================================
// LA FICHA DE UNO DE MIS PERSONAJES: LAS PESTAÑAS
// =========================================
// La página la escribe entera generar-personajes.py: los cuatro apartados
// (historia, npcs, imágenes y extra) uno debajo de otro, y encima unos
// enlaces para saltar a cada uno. Así se lee todo aunque esto no cargue.
//
// Con esto, los enlaces pasan a ser PESTAÑAS de las de verdad (role=tab,
// con las flechas, Inicio y Fin para moverse entre ellas, como manda el
// patrón de ARIA) y solo se ve el apartado elegido. El elegido va en la
// dirección (#oc-imagenes…), así que un enlace a una pestaña abre esa, y
// atrás y adelante del navegador también cambian de pestaña.

const ocPestanas = document.querySelector("[data-oc-pestanas]");
const ocPanel = document.querySelector("[data-oc-panel]");

// LAS SUBPESTAÑAS de la pestaña «ficha» (estadísticas, equipamiento,
// magia, rasgos): lo mismo, pero dentro de ella y sin tocar la dirección
// (la dirección dice la pestaña de arriba).
const ocSubpestanas = document.querySelector("[data-oc-subpestanas]");
const ocSubpanel = document.querySelector("[data-oc-subpanel]");

if (ocPestanas && ocPanel) {
    montarPestanasDePersonaje(ocPestanas, ocPanel, { apartado: "data-oc-apartado", prefijo: "oc-pestana-",
        clase: "oc-pestana", lista: "oc-pestanas-lista", conDireccion: true });
}
if (ocSubpestanas && ocSubpanel) {
    montarPestanasDePersonaje(ocSubpestanas, ocSubpanel, { apartado: "data-oc-subapartado",
        prefijo: "oc-subpestana-", clase: "oc-subpestana", lista: "oc-subpestanas-lista", conDireccion: false });
}

function montarPestanasDePersonaje(menu, panel, o) {
    const enlaces = Array.from(menu.querySelectorAll("[data-oc-pestana]"));
    const apartados = enlaces.map((a) => panel.querySelector("[" + o.apartado + "='" + a.dataset.ocPestana + "']"));
    if (!enlaces.length || apartados.some((x) => !x)) {
        return;
    }

    // Cada enlace se cambia por un botón: una pestaña no lleva a ningún
    // sitio, cambia lo que se ve.
    const lista = document.createElement("div");
    lista.className = o.lista;
    lista.setAttribute("role", "tablist");
    lista.setAttribute("aria-label", menu.getAttribute("aria-label") || "Apartados");
    const botones = enlaces.map((a, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = o.clase;
        b.id = o.prefijo + a.dataset.ocPestana;
        b.textContent = a.textContent;
        b.setAttribute("role", "tab");
        b.setAttribute("aria-controls", apartados[i].id);
        b.dataset.ocPestana = a.dataset.ocPestana;
        lista.appendChild(b);
        return b;
    });
    // El <nav> ya no hace falta como zona de navegación: se queda la lista.
    menu.replaceWith(lista);
    panel.classList.add("con-pestanas");

    apartados.forEach((ap, i) => {
        ap.setAttribute("role", "tabpanel");
        ap.setAttribute("aria-labelledby", botones[i].id);
        ap.tabIndex = 0;
    });

    function elegir(i, conFoco, apuntar) {
        botones.forEach((b, j) => {
            const es = j === i;
            b.setAttribute("aria-selected", es ? "true" : "false");
            b.tabIndex = es ? 0 : -1;
            apartados[j].hidden = !es;
        });
        if (conFoco) {
            botones[i].focus();
        }
        if (apuntar && o.conDireccion) {
            try {
                history.replaceState(null, "", "#" + apartados[i].id);
            } catch (error) {
                // Sin historial (un archivo abierto a pelo): da igual.
            }
        }
    }

    botones.forEach((b, i) => {
        b.addEventListener("click", () => elegir(i, false, true));
        b.addEventListener("keydown", (evento) => {
            const ultimo = botones.length - 1;
            const a = {
                ArrowRight: i === ultimo ? 0 : i + 1,
                ArrowLeft: i === 0 ? ultimo : i - 1,
                Home: 0,
                End: ultimo,
            }[evento.key];
            if (a === undefined) {
                return;
            }
            evento.preventDefault();
            elegir(a, true, true);
        });
    });

    function desdeLaDireccion() {
        const pedido = decodeURIComponent((location.hash || "").slice(1));
        const i = apartados.findIndex((ap) => ap.id === pedido);
        return i < 0 ? 0 : i;
    }

    if (o.conDireccion) {
        window.addEventListener("hashchange", () => elegir(desdeLaDireccion(), false, false));
        elegir(desdeLaDireccion(), false, false);
    } else {
        elegir(0, false, false);
    }
}
