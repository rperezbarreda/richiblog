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
        document.write('<script defer src="' + src + '"></' + 'script>');
    }

    const isHome = path === "/" || path === "/index";
    const isSobreMi = path.includes("/sobre_mi/");
    const isContacto = path.includes("/contacto/");
    const isBlogArchive = /\/blog\/\d+\/index_\d+$/.test(path);
    const isDiario = path.endsWith("/blog/diario");
    const isRol = path.includes("/mis_movidas/rol/");
    const isRelatosList = path.endsWith("/mis_movidas/relatos/index_relatos");
    // Solo las fichas de cada gato: el índice de santuarios no tiene galería.
    const isFichaSantuario = /\/santuarios\/[^/]+\/[^/]+$/.test(path);
    const isNotFound = path.endsWith("/not_found");
    // Páginas de lectura: una entrada del blog (no el archivo del año)
    // o un relato (no su índice). Ahí va la ventana de "sigue leyendo".
    const isLectura =
        (/\/blog\/\d+\//.test(path) && !isBlogArchive) ||
        (path.includes("/mis_movidas/relatos/") && !isRelatosList);

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
        script("/scripts/componentes/filtros.js");
    } else if (isRelatosList) {
        // Antes que relatos.js: así el componente ya está escuchando
        // cuando el listado termina de pintarse y avisa.
        script("/scripts/componentes/filtros.js");
        script("/scripts/paginas/relatos.js");
    } else if (isLectura) {
        script("/scripts/paginas/otras-entradas.js");
    } else if (isFichaSantuario) {
        script("/scripts/paginas/santuarios.js");
    }
})();
