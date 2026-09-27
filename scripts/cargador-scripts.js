// =========================================
// CARGA DINÁMICA DE JS SEGÚN LA URL
// =========================================
// Sustituye el bloque de <script defer> repetido en cada página. Mira
// la ruta actual y escribe solo los scripts que esa página necesita.
//
// El CSS ya no funciona así: sus <link> van escritos en el <head> de
// cada página (los pone herramientas/actualizar-cabeceras.py) porque
// medido costaba ~200 ms de pantalla en blanco tener que pedir un
// script antes de descubrir las hojas de estilo. Con el JS no pasa:
// los <script> que escribe este archivo llevan "defer", o sea que no
// retrasan el pintado, así que aquí no se gana nada por escribirlos a
// mano y sí se pierde en comodidad.
//
// IMPORTANTE: este script se ejecuta SIN "defer" y colocado justo
// donde antes iban los <script defer>, para que document.write() los
// inserte ahí mismo mientras el navegador aún está leyendo el HTML.
// Los scripts que escribe sí llevan "defer", así que se siguen
// ejecutando en orden y después de parsear todo el HTML, exactamente
// igual que si estuvieran escritos a mano. Si se moviera a "defer",
// document.write() borraría el documento entero — por eso se queda
// tal cual.

// =========================================
// VERSIONES DE LOS ARCHIVOS (ANTI-CACHÉ)
// =========================================
// El navegador se guarda el CSS y el JS para no volver a pedirlos, y
// eso está bien hasta que subes cambios: quien ya había entrado en la
// web sigue viendo los archivos viejos hasta que su navegador decida
// que han caducado, que pueden ser días. A ti te pasaba igual y lo
// tapabas con ctrl+F5; un visitante no va a hacer eso.
//
// El arreglo es que cada archivo lleve su versión en la dirección:
//   /estilos/base.css?v=8f3a1c2d
// Ese v= es un resumen del CONTENIDO del archivo, así que cambia solo
// cuando el archivo cambia de verdad. Para el navegador es otra
// dirección distinta, así que se lo baja otra vez; y los archivos que
// no has tocado conservan su v=, siguen en la caché y no se vuelven a
// pedir. Lo mejor de las dos cosas.
//
// La lista de abajo la escribe herramientas/actualizar-cabeceras.py,
// que es también quien pone el ?v= de los CSS en el <head> de cada
// página. NO LA TOQUES A MANO: pásale la herramienta después de
// cambiar cualquier CSS o JS y antes de subir a Neocities.
//
// Los JSON de /datos/ no están aquí a propósito: cambian cada vez que
// publicas algo, y acordarse de pasar la herramienta justo entonces
// sería una trampa. Esos se piden con cache: "no-cache", que obliga al
// navegador a preguntar si han cambiado antes de usar su copia.
(function versionesDeArchivos() {
    const VERSIONES = {
        // ==== generado ====
        "/fragmentos/barra-lateral.html": "d5c7d400",
        "/fragmentos/frases.html": "f5d6fe01",
        "/scripts/componentes/aviso.js": "7b9fce19",
        "/scripts/componentes/barra-lateral.js": "da4175b8",
        "/scripts/componentes/botones-ventana.js": "f5a53aa0",
        "/scripts/componentes/cargador-fragmentos.js": "11a98bcb",
        "/scripts/componentes/chispas-botones.js": "ced17e38",
        "/scripts/componentes/filtros.js": "a8f1ddaa",
        "/scripts/componentes/frases.js": "6f0bdf49",
        "/scripts/componentes/gatin-random.js": "212dad18",
        "/scripts/componentes/rastro-cursor.js": "3ca8334c",
        "/scripts/componentes/subir.js": "2e242c61",
        "/scripts/componentes/teclado-scroll.js": "5847ef8b",
        "/scripts/componentes/visor-imagenes.js": "48184405",
        "/scripts/paginas/diario.js": "f2880aea",
        "/scripts/paginas/entradas-blog.js": "ddff4a7b",
        "/scripts/paginas/guestbook-texto.js": "5ef34bf3",
        "/scripts/paginas/guestbook.js": "4d3c0d57",
        "/scripts/paginas/novedades.js": "4d11ce1e",
        "/scripts/paginas/otras-entradas.js": "316273ce",
        "/scripts/paginas/relatos.js": "510dab2f",
        "/scripts/paginas/reto.js": "f75ee6a7",
        "/scripts/paginas/rol.js": "eeaebb8f",
        "/scripts/paginas/santuarios.js": "ee3077b4",
        "/scripts/paginas/sobre-mi.js": "540d5eb5",
        "/scripts/tema.js": "341539a1",
        // ==== fin del generado ====
    };

    // Añade el ?v=... a una dirección del sitio. Si el archivo no está
    // en la lista —porque es nuevo y todavía no has pasado la
    // herramienta— devuelve la dirección tal cual: se cacheará peor,
    // pero nunca dará un 404.
    window.conVersion = function (ruta) {
        const version = VERSIONES[ruta];
        return version ? ruta + "?v=" + version : ruta;
    };

    // Para los JSON de /datos/, que cambian cada vez que publicas algo
    // y por eso no llevan ?v=. "no-cache" no quiere decir "no guardes":
    // el navegador guarda su copia igual, pero antes de usarla pregunta
    // al servidor si ha cambiado. Si no, contesta un "sigue igual" de
    // nada y se usa la copia; si sí, llega la nueva. Así una entrada
    // recién publicada se ve al momento sin pasar ninguna herramienta.
    window.pedirDatos = function (ruta) {
        return fetch(ruta, { cache: "no-cache" });
    };
})();

(function loadPageScripts() {
    // Ruta normalizada: sin ".html" al final ni "/" sobrante. Así las
    // comprobaciones de abajo funcionan igual si el servidor entrega
    // la página como /web/santuarios/tali/tali.html o como
    // /web/santuarios/tali/tali (Neocities y Cloudflare pueden servir
    // las dos formas). Sin esto, en la segunda no se cargaba el JS de
    // la página y se quedaba en "Cargando…".
    const path =
        window.location.pathname.replace(/\.html$/, "").replace(/\/+$/, "") ||
        "/";

    function script(src) {
        document.write(
            '<script defer src="' + window.conVersion(src) + '"></' + "script>"
        );
    }

    const isHome = path === "/" || path === "/index";
    const isSobreMi = path.includes("/sobre_mi/");
    const isContacto = path.includes("/contacto/");
    const isBlogArchive = /\/blog\/\d+\/index_\d+$/.test(path);
    const isDiario = path.endsWith("/blog/diario");
    const isRol = path.includes("/mis_movidas/rol/");
    const isRelatosList = path.endsWith("/mis_movidas/relatos/index_relatos");
    // La página de un reto de escritura: una subcarpeta de relatos/ con
    // su propio index_. Va comprobada ANTES que isLectura, que si no se
    // la traga (está dentro de relatos/ y no es el listado).
    const isReto = /\/mis_movidas\/relatos\/[^/]+\/index_[^/]+$/.test(path);
    // Solo las fichas de cada gato: el índice de santuarios no tiene galería.
    const isFichaSantuario = /\/santuarios\/[^/]+\/[^/]+$/.test(path);
    const isNotFound = path.endsWith("/not_found");
    // Páginas de lectura: una entrada del blog (no el archivo del año)
    // o un relato (no su índice). Ahí va la ventana de "sigue leyendo".
    const isLectura =
        (/\/blog\/\d+\//.test(path) && !isBlogArchive) ||
        (path.includes("/mis_movidas/relatos/") && !isRelatosList && !isReto);

    if (isNotFound) {
        // El 404 no lleva sidebar ni componentes de navegación.
        script("/scripts/componentes/botones-ventana.js");
        script("/scripts/componentes/rastro-cursor.js");
        script("/scripts/componentes/chispas-botones.js");
        script("/scripts/componentes/subir.js");
        script("/scripts/componentes/teclado-scroll.js");
        return;
    }

    // Base: la necesita cualquier página de contenido del sitio.
    script("/scripts/componentes/cargador-fragmentos.js");
    script("/scripts/componentes/barra-lateral.js");
    // Vive dentro de la barra lateral, así que lo lleva cualquier
    // página que la tenga (el 404 sale antes, arriba).
    script("/scripts/componentes/gatin-random.js");
    script("/scripts/tema.js");
    script("/scripts/componentes/botones-ventana.js");
    script("/scripts/componentes/rastro-cursor.js");
    script("/scripts/componentes/chispas-botones.js");
    script("/scripts/componentes/visor-imagenes.js");
    // Igual que el lightbox: va en la base para que cualquier página
    // pueda montar un aviso emergente sin tocar este archivo.
    script("/scripts/componentes/aviso.js");
    script("/scripts/componentes/subir.js");
    // Sin esto la página no se mueve con el teclado: ver el comentario
    // de arriba del propio archivo.
    script("/scripts/componentes/teclado-scroll.js");

    if (isHome) {
        script("/scripts/componentes/frases.js");
        script("/scripts/paginas/entradas-blog.js");
        script("/scripts/paginas/novedades.js");
    } else if (isSobreMi) {
        script("/scripts/paginas/sobre-mi.js");
    } else if (isContacto) {
        // Antes que guestbook.js: le da el cuadro de texto con formato
        // y el pintado seguro de los mensajes.
        script("/scripts/paginas/guestbook-texto.js");
        script("/scripts/paginas/guestbook.js");
    } else if (isBlogArchive) {
        script("/scripts/paginas/entradas-blog.js");
    } else if (isDiario) {
        script("/scripts/paginas/diario.js");
    } else if (isRol) {
        // Antes que rol.js, igual que en relatos: así el componente ya
        // está escuchando cuando el portfolio termina de pintarse y
        // avisa de que hay categorías nuevas que contar.
        script("/scripts/componentes/filtros.js");
        script("/scripts/paginas/rol.js");
    } else if (isRelatosList) {
        // Antes que relatos.js: así el componente ya está escuchando
        // cuando el listado termina de pintarse y avisa.
        script("/scripts/componentes/filtros.js");
        script("/scripts/paginas/relatos.js");
        // La tarjeta del reto que va encima del listado.
        script("/scripts/paginas/reto.js");
    } else if (isReto) {
        script("/scripts/paginas/reto.js");
    } else if (isLectura) {
        script("/scripts/paginas/otras-entradas.js");
    } else if (isFichaSantuario) {
        script("/scripts/paginas/santuarios.js");
    }
})();
