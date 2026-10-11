// =========================================
// LO QUE TIENE QUE PASAR ANTES DE PINTAR
// =========================================
// Este archivo es el único JS CON ARCHIVO PROPIO que se ejecuta sin
// "defer", o sea el único que retrasa el primer pintado. Por eso lleva
// dentro solo dos cosas, y las dos tienen que pasar antes de que se vea
// nada:
//
//   1. La lista de versiones (el ?v= anticaché) y window.conVersion(),
//      que es lo que usan los pocos archivos que se piden ya dentro del
//      navegador.
//   2. Los ajustes de accesibilidad guardados (tamaño del texto, letra,
//      separación entre líneas, filtro CRT): si llegaran con el resto
//      de scripts, la página se pintaría a tamaño normal y daría un
//      salto delante de los ojos de quien justamente necesita que no.
//
// (La barra lateral se pide incluso antes que esto: con un <script> de
// una línea escrito en el <head> de cada página, delante del CSS. Está
// explicado en herramientas/3-generadores/actualizar-cabeceras.py.)
//
// LO QUE ANTES ESTABA AQUÍ Y YA NO
// --------------------------------
// Este archivo también repartía el JS de cada página: miraba la URL y
// escribía con document.write() los <script defer> que tocaban. Ahora
// esa lista la escribe herramientas/3-generadores/actualizar-cabeceras.py en el
// <head> de cada página, igual que ya hacía con el CSS.
//
// El motivo es medido: mientras los scripts los pedía este archivo, el
// navegador no se enteraba de que existían hasta haberlo bajado y
// ejecutado, así que no empezaban a bajarse hasta los 814 ms (con la
// red frenada a 3G). Escritos en el <head> empiezan a los 190, con el
// CSS. "defer" nunca retrasó el pintado —ese era el argumento para
// dejarlo así—, pero sí retrasaba todo lo que se puede tocar: el menú
// tardaba millón y medio de milisegundos en aparecer.
//
// De regalo se fue un apaño feo: este archivo tenía que adivinar qué
// tipo de página era quitándole el ".html" a la URL, porque Neocities
// sirve las páginas con y sin extensión, y alguna se quedaba sin su JS.
// Escrito en cada página, eso no puede pasar.

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
// La lista de abajo la escribe herramientas/3-generadores/actualizar-cabeceras.py,
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
        "/fragmentos/barra-lateral.html": "e6721b10",
        "/fragmentos/frases.html": "2720019e",
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
// las listas de verdad están en scripts/componentes/ajustes.js, que es
// quien maneja los mandos.
(function aplicarAjustesGuardados() {
    var raiz = document.documentElement;
    try {
        var escala = parseFloat(localStorage.getItem("richi-texto"));
        if (escala >= 0.9 && escala <= 1.5) {
            raiz.style.setProperty("--escala", escala);
        }

        // La separación entre líneas del texto largo. Se comprueba
        // contra la lista en vez de contra un intervalo porque un valor
        // raro aquí no haría nada visible y luego el mando no sabría
        // qué botón marcar.
        var linea = localStorage.getItem("richi-interlineado");
        if (linea === "amplio" || linea === "muy-amplio") {
            raiz.setAttribute("data-interlineado", linea);
        }

        // La letra. Este es el que MÁS falta que se ponga pronto: si
        // llegara con el resto de scripts, la página se pintaría entera
        // con una fuente y saltaría a la otra delante de los ojos.
        if (localStorage.getItem("richi-letra") === "legible") {
            raiz.setAttribute("data-letra", "legible");
        }

        // Y el filtro de pantalla vieja, por lo mismo: encendiéndolo
        // tarde se vería la página limpia y de pronto llena de rayas.
        if (localStorage.getItem("richi-crt") === "si") {
            raiz.setAttribute("data-crt", "si");
        }

        // Dejarlo todo quieto. Éste también corre prisa: puesto tarde,
        // se vería arrancar el parpadeo y pararse justo delante, que es
        // peor que no pararlo.
        if (localStorage.getItem("richi-movimiento") === "quieto") {
            raiz.setAttribute("data-movimiento", "quieto");
        }

        // La velocidad de la voz no cambia nada de lo que se ve, pero se
        // deja puesta aquí con el resto para que el mando la encuentre
        // ya aplicada y marque el botón que toca.
        var voz = localStorage.getItem("richi-voz");
        if (voz === "lenta" || voz === "rapida") {
            raiz.setAttribute("data-voz", voz);
        }
    } catch (error) {
        // Navegando en privado no se puede leer. Se queda lo de siempre.
    }
})();
