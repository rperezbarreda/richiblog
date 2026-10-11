/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/ventanas-plegables.js
*/
const VENTANA_BARRAS =
    ".recent-entries-header, .gatin-random-header, .pet-window-header";
let ventanaContador = 0;
prepararVentanasPlegables();
document.addEventListener("sidebar:loaded", prepararVentanasPlegables);
document.addEventListener("ventanas:actualizar", prepararVentanasPlegables);
document.addEventListener("click", alPulsarEnVentana);
function prepararVentanasPlegables() {
    document.querySelectorAll(VENTANA_BARRAS).forEach(prepararVentana);
}
function prepararVentana(barra) {
    if (barra.dataset.ventanaLista === "si") {
        return;
    }
    const ventana = barra.parentElement;
    if (!ventana) {
        return;
    }
    barra.dataset.ventanaLista = "si";
    barra.classList.add("ventana-barra");
    ventana.classList.add("ventana-plegable");
    const titulo = barra.querySelector("h1, h2, h3, h4, h5, h6");
    const mando = document.createElement("button");
    mando.type = "button";
    mando.className = "ventana-barra-mando";
    mando.dataset.ventanaMando = "si";
    mando.setAttribute("aria-expanded", "true");
    if (titulo) {
        mando.setAttribute("aria-labelledby", idDeTituloDeVentana(titulo));
    } else {
        mando.setAttribute("aria-label", "plegar o abrir esta ventana");
    }
    barra.appendChild(mando);
}
function idDeTituloDeVentana(titulo) {
    if (titulo.id) {
        return titulo.id;
    }
    let id = "";
    do {
        ventanaContador += 1;
        id = "ventana-titulo-" + ventanaContador;
    } while (document.getElementById(id));
    titulo.id = id;
    return id;
}
function alPulsarEnVentana(evento) {
    const barra = evento.target.closest(".ventana-barra");
    if (!barra) {
        return;
    }
    const ventana = barra.parentElement;
    if (!ventana || !ventana.classList.contains("ventana-plegable")) {
        return;
    }
    const boton = evento.target.closest("[data-ventana-accion]");
    const accion = boton ? boton.dataset.ventanaAccion : "";
    if (accion === "cerrar") {
        return;
    }
    if (accion === "plegar" || accion === "desplegar") {
        plegarVentana(ventana, accion === "plegar");
        return;
    }
    const suyo = evento.target.closest("a, button, input, select, textarea");
    if (suyo && suyo.dataset.ventanaMando !== "si") {
        return;
    }
    plegarVentana(ventana, ventana.dataset.plegada !== "si");
}
function plegarVentana(ventana, plegada) {
    if (plegada) {
        ventana.dataset.plegada = "si";
    } else {
        delete ventana.dataset.plegada;
    }
    soltarVentana(ventana, plegada);
    const mando = ventana.querySelector(
        ":scope > .ventana-barra > .ventana-barra-mando"
    );
    if (mando) {
        mando.setAttribute("aria-expanded", plegada ? "false" : "true");
    }
}
function soltarVentana(ventana, plegada) {
    if (!plegada) {
        ventana.style.alignSelf = "";
        ventana.style.flex = "";
        return;
    }
    const padre = ventana.parentElement;
    const comoVa = padre ? getComputedStyle(padre) : null;
    const esFlex =
        comoVa && (comoVa.display === "flex" || comoVa.display === "inline-flex");
    if (esFlex && comoVa.flexDirection.indexOf("column") === 0) {
        ventana.style.flex = "0 0 auto";
    } else {
        ventana.style.alignSelf = "start";
    }
}
