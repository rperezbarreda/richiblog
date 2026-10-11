/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/redirecciones.js
*/
(function () {
    const REDIRECCIONES = [
        ["/web/mundo/index_mundo.html", "/web/wiki/index_wiki.html"],
        ["/web/mundo/", "/web/wiki/"],
    ];
    const pedida = window.location.pathname;
    for (const [vieja, nueva] of REDIRECCIONES) {
        if (pedida === vieja || pedida.indexOf(vieja) === 0) {
            let destino = nueva + pedida.slice(vieja.length);
            if (destino === "/web/wiki/" || destino === "/web/wiki") {
                destino = "/web/wiki/index_wiki.html";
            }
            if (destino.indexOf("/") !== 0 || destino.indexOf("//") === 0 || destino === pedida) {
                return;
            }
            window.location.replace(destino + window.location.search + window.location.hash);
            return;
        }
    }
})();
