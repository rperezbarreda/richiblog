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
        "/fragmentos/barra-lateral.html": "049bc769",
        "/fragmentos/frases.html": "81a36459",
        "/scripts/componentes/aviso.js": "7b9fce19",
        "/scripts/componentes/barra-lateral.js": "da4175b8",
        "/scripts/componentes/botones-ventana.js": "c77fe3fa",
        "/scripts/componentes/buscador.js": "e2007b48",
        "/scripts/componentes/cargador-fragmentos.js": "11a98bcb",
        "/scripts/componentes/chispas-botones.js": "ced17e38",
        "/scripts/componentes/filtros.js": "ed75481d",
        "/scripts/componentes/frases.js": "999803de",
        "/scripts/componentes/gatin-random.js": "212dad18",
        "/scripts/componentes/lectura.js": "55ef46ad",
        "/scripts/componentes/rastro-cursor.js": "3ca8334c",
        "/scripts/componentes/subir.js": "2e242c61",
        "/scripts/componentes/teclado-scroll.js": "5847ef8b",
        "/scripts/componentes/texto-tamano.js": "0ff087da",
        "/scripts/componentes/visor-imagenes.js": "48184405",
        "/scripts/paginas/changelog.js": "b47d27a6",
        "/scripts/paginas/diario.js": "a145507e",
        "/scripts/paginas/entradas-blog.js": "57493648",
        "/scripts/paginas/guestbook-texto.js": "5ef34bf3",
        "/scripts/paginas/guestbook.js": "4d3c0d57",
        "/scripts/paginas/mapa.js": "98984720",
        "/scripts/paginas/novedades.js": "4d11ce1e",
        "/scripts/paginas/otras-entradas.js": "44aaa9e9",
        "/scripts/paginas/relatos.js": "9307705c",
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

// =========================================
// EL TAMAÑO DEL TEXTO, ANTES DE PINTAR
// =========================================
// El mando "Aa" guarda en qué tamaño quiere leerse la web, y hay que
// ponerlo ANTES del primer pintado: si esperáramos al script del mando
// (que va con defer, o sea al final), la página se pintaría a tamaño
// normal y daría un salto al llegar. Es lo mismo que hace el trocito
// del tema en el <head> de cada página, y por eso vive aquí, que es lo
// único que se ejecuta pronto y en todas las páginas a la vez.
//
// Aquí solo se comprueba que lo guardado esté dentro de lo razonable;
// la lista de tamaños de verdad está en
// scripts/componentes/texto-tamano.js, que es quien la maneja.
(function aplicarTamanoGuardado() {
    try {
        var escala = parseFloat(localStorage.getItem("richi-texto"));
        if (escala >= 0.9 && escala <= 1.5) {
            document.documentElement.style.setProperty("--escala", escala);
        }
    } catch (error) {
        // Navegando en privado no se puede leer. Se queda el de siempre.
    }
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
    // El changelog no está en el menú: se llega desde el botón de la
    // portada. Aquí da igual, el JS se carga por la ruta.
    const isChangelog = path.includes("/changelog/");
    const isMapa = path.includes("/mapa/");
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
    // El mando "Aa" del tamaño del texto: su HTML va con el resto del
    // armazón, en fragmentos/barra-lateral.html, así que lo lleva
    // cualquier página que tenga barra lateral. En el 404, que no la
    // tiene, no sale el mando, pero el tamaño elegido se respeta igual
    // (lo pone la escala de aquí arriba).
    script("/scripts/componentes/texto-tamano.js");
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
        // Antes que entradas-blog.js: cuando el archivo termina de
        // pintarse le pide al buscador que aplique lo que venga en
        // ?buscar=, así que tiene que estar ya cargado.
        script("/scripts/componentes/buscador.js");
        script("/scripts/paginas/entradas-blog.js");
    } else if (isDiario) {
        script("/scripts/paginas/diario.js");
    } else if (isRol) {
        // Antes que rol.js, igual que en relatos: así los componentes
        // ya están escuchando cuando el portfolio termina de pintarse y
        // avisa de que hay categorías nuevas que contar.
        script("/scripts/componentes/buscador.js");
        script("/scripts/componentes/filtros.js");
        script("/scripts/paginas/rol.js");
    } else if (isRelatosList) {
        // Antes que relatos.js: así los componentes ya están
        // escuchando cuando el listado termina de pintarse y avisa.
        script("/scripts/componentes/buscador.js");
        script("/scripts/componentes/filtros.js");
        script("/scripts/paginas/relatos.js");
        // La tarjeta del reto que va encima del listado.
        script("/scripts/paginas/reto.js");
    } else if (isReto) {
        script("/scripts/paginas/reto.js");
    } else if (isLectura) {
        // Antes que otras-entradas.js: ese avisa con la ficha de esta
        // entrada en cuanto le llega el listado, y lectura.js tiene que
        // estar ya escuchando.
        script("/scripts/componentes/lectura.js");
        script("/scripts/paginas/otras-entradas.js");
    } else if (isFichaSantuario) {
        script("/scripts/paginas/santuarios.js");
    } else if (isChangelog) {
        script("/scripts/paginas/changelog.js");
    } else if (isMapa) {
        // Antes que mapa.js, como en el archivo del blog: la tabla se
        // pinta sola cuando llega el JSON y ahí mismo le pide al
        // buscador que aplique lo que venga en ?buscar=.
        script("/scripts/componentes/buscador.js");
        script("/scripts/paginas/mapa.js");
    }
})();
