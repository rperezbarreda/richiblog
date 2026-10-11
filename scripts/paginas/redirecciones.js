// =========================================
// LAS DIRECCIONES QUE CAMBIARON DE SITIO
// =========================================
// Solo corre en la página de "esto no existe" (not_found.html), que es la
// que sirve Neocities para cualquier dirección que no encuentra. Neocities
// no deja hacer redirecciones de las de verdad, así que se hacen aquí: si
// lo que se pidió es una dirección vieja de algo que sigue existiendo con
// otro nombre, se va a la nueva sin pasar por el 404.
//
// Cada línea: [cómo empezaba, cómo empieza ahora]. Va la primera que
// cuadre, así que las concretas arriba y las generales abajo.
//
//   - La wiki se llamaba mundo/ hasta el 10-10-2026 (web/mundo/ y su
//     portada index_mundo.html).
//
// SI MUEVES OTRA COSA DE SITIO, apúntala aquí y las direcciones viejas que
// haya por ahí fuera seguirán llevando a algún sitio.
//
// La dirección nueva se arma cambiando el principio de la que se pidió y
// nada más, y solo si queda dentro de esta web: no hay forma de que un
// enlace mal intencionado mande a otra parte desde aquí.

(function () {
    const REDIRECCIONES = [
        ["/web/mundo/index_mundo.html", "/web/wiki/index_wiki.html"],
        ["/web/mundo/", "/web/wiki/"],
    ];

    const pedida = window.location.pathname;
    for (const [vieja, nueva] of REDIRECCIONES) {
        if (pedida === vieja || pedida.indexOf(vieja) === 0) {
            let destino = nueva + pedida.slice(vieja.length);
            // La portada de una carpeta, con o sin barra al final.
            if (destino === "/web/wiki/" || destino === "/web/wiki") {
                destino = "/web/wiki/index_wiki.html";
            }
            if (destino.indexOf("/") !== 0 || destino.indexOf("//") === 0 || destino === pedida) {
                return;
            }
            // replace y no assign: así el botón de atrás no vuelve a la
            // dirección vieja, que solo devolvería aquí otra vez.
            window.location.replace(destino + window.location.search + window.location.hash);
            return;
        }
    }
})();
