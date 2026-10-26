/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/personajes.js
*/
const ocPestanas = document.querySelector("[data-oc-pestanas]");
const ocPanel = document.querySelector("[data-oc-panel]");
if (ocPestanas && ocPanel) {
    montarPestanasDePersonaje(ocPestanas, ocPanel);
}
function montarPestanasDePersonaje(menu, panel) {
    const enlaces = Array.from(menu.querySelectorAll("[data-oc-pestana]"));
    const apartados = enlaces.map((a) => panel.querySelector("[data-oc-apartado='" + a.dataset.ocPestana + "']"));
    if (!enlaces.length || apartados.some((x) => !x)) {
        return;
    }
    const lista = document.createElement("div");
    lista.className = "oc-pestanas-lista";
    lista.setAttribute("role", "tablist");
    lista.setAttribute("aria-label", menu.getAttribute("aria-label") || "Apartados");
    const botones = enlaces.map((a, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "oc-pestana";
        b.id = "oc-pestana-" + a.dataset.ocPestana;
        b.textContent = a.textContent;
        b.setAttribute("role", "tab");
        b.setAttribute("aria-controls", apartados[i].id);
        b.dataset.ocPestana = a.dataset.ocPestana;
        lista.appendChild(b);
        return b;
    });
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
        if (apuntar) {
            try {
                history.replaceState(null, "", "#" + apartados[i].id);
            } catch (error) {
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
    window.addEventListener("hashchange", () => elegir(desdeLaDireccion(), false, false));
    elegir(desdeLaDireccion(), false, false);
}
