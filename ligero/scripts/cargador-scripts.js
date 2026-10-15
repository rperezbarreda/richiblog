/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/cargador-scripts.js
*/
(function versionesDeArchivos() {
    const VERSIONES = {
        "/fragmentos/barra-lateral.html": "d9a306ce",
        "/fragmentos/frases.html": "2720019e",
    };
    window.conVersion = function (ruta) {
        const version = VERSIONES[ruta];
        return version ? ruta + "?v=" + version : ruta;
    };
    window.pedirDatos = function (ruta) {
        return fetch(ruta, { cache: "no-cache" });
    };
})();
(function aplicarAjustesGuardados() {
    var raiz = document.documentElement;
    try {
        var escala = parseFloat(localStorage.getItem("richi-texto"));
        if (escala >= 0.9 && escala <= 1.5) {
            raiz.style.setProperty("--escala", escala);
        }
        var linea = localStorage.getItem("richi-interlineado");
        if (linea === "amplio" || linea === "muy-amplio") {
            raiz.setAttribute("data-interlineado", linea);
        }
        if (localStorage.getItem("richi-letra") === "legible") {
            raiz.setAttribute("data-letra", "legible");
        }
        if (localStorage.getItem("richi-crt") === "si") {
            raiz.setAttribute("data-crt", "si");
        }
        if (localStorage.getItem("richi-movimiento") === "quieto") {
            raiz.setAttribute("data-movimiento", "quieto");
        }
        var voz = localStorage.getItem("richi-voz");
        if (voz === "lenta" || voz === "rapida") {
            raiz.setAttribute("data-voz", voz);
        }
    } catch (error) {
    }
})();
