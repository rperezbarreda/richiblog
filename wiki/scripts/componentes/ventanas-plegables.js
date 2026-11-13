// =========================================
// COMPONENTE: VENTANAS QUE SE PLIEGAN
// =========================================
// Las barras de título de las ventanas falsas llevaban tres botones de
// adorno (−■✕). Dos de ellos ya hacen lo que dicen: el − pliega la
// ventana y deja solo la barra, y el ■ la devuelve a su tamaño. El ✕ se
// queda de broma, con sus brillos (scripts/componentes/chispas-botones.js).
//
// No hay que tocar el HTML de ninguna página: aquí se buscan todas las
// barras de título que hay (son tres clases, las de siempre) y se les
// monta el mando encima. Si algún día aparece otra clase de barra, se
// añade a VENTANA_BARRAS y ya está.
//
// CÓMO SE PULSA
//   - Toda la barra responde, no solo los cuadraditos: en el móvil son
//     13 px de lado y es lo que pedía Richi. La barra entera alterna
//     entre plegada y abierta.
//   - El − pliega y el ■ abre, cada uno lo suyo (no alternan), que es
//     como se porta la barra de título de una ventana de verdad.
//   - Con el teclado: el mando es un <button> que cubre la barra, así
//     que se llega con el tabulador y se pulsa con Enter o espacio.
//
// LO QUE SE VE Y LO QUE SE OYE
// El esconder lo hace el CSS (estilos/componentes/ventanas-plegables.css)
// a partir de [data-plegada="si"]. Aquí solo se pone y se quita ese
// atributo, y se mantiene al día el aria-expanded del mando, que es lo
// que le dice a un lector de pantalla si la ventana está abierta o
// contraída. Al plegar, lo de dentro se esconde con display: none, así
// que desaparece también para quien escucha la página: no se queda
// leyendo una lista que no está a la vista.
//
// NO SE GUARDA NADA. Al recargar, todas las ventanas vuelven a estar
// abiertas: plegar es para quitarse algo de en medio un rato, no un
// ajuste. Si alguna vez se quisiera recordar, iría en localStorage con
// el mismo patrón que el tema y el tamaño del texto.

// Las tres barras de título del sitio: las tarjetas de casi todas las
// páginas, la ventanita del gatín de la barra lateral y la ficha de un
// gato. Todas tienen la misma forma: un encabezado y los −■✕, dentro de
// un contenedor que es la ventana.
const VENTANA_BARRAS =
    ".recent-entries-header, .gatin-random-header, .pet-window-header";

// Para los id= de los títulos que no tengan: el mando los necesita para
// poder decir cómo se llama la ventana que abre y cierra.
let ventanaContador = 0;

prepararVentanasPlegables();

// La barra lateral llega por fetch después de que corra esto, así que la
// ventanita del gatín que viene dentro se queda sin mando hasta que
// avisan de que ya está en el DOM.
document.addEventListener("sidebar:loaded", prepararVentanasPlegables);

// Y lo mismo con las ventanas que se pintan desde un JSON (los bloques
// del changelog, las categorías de recomendaciones): quien las pinta
// avisa con este evento, el mismo que usa botones-ventana.js para
// rellenarles los −■✕.
document.addEventListener("ventanas:actualizar", prepararVentanasPlegables);

document.addEventListener("click", alPulsarEnVentana);

function prepararVentanasPlegables() {
    document.querySelectorAll(VENTANA_BARRAS).forEach(prepararVentana);
}

function prepararVentana(barra) {
    // Las ventanas pintadas desde un JSON hacen que esto se repase
    // varias veces; a las que ya tienen mando se las deja en paz para no
    // acabar con tres botones encima de la misma barra.
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
        // El nombre del mando es el título de la ventana, y apuntado con
        // aria-labelledby y no copiado: hay títulos que cambian mientras
        // se usa la página (el del diario va por meses) y así el nombre
        // cambia con ellos sin tener que enterarse nadie.
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

    // Cada cuadradito, lo suyo. El de cerrar no pliega nada: se pulsa,
    // salen los brillos y la ventana se queda como estaba.
    const boton = evento.target.closest("[data-ventana-accion]");
    const accion = boton ? boton.dataset.ventanaAccion : "";
    if (accion === "cerrar") {
        return;
    }
    if (accion === "plegar" || accion === "desplegar") {
        plegarVentana(ventana, accion === "plegar");
        return;
    }

    // Y si no se ha pulsado un cuadradito, se ha pulsado la barra: se
    // alterna. Salvo que ahí hubiera algo que ya hace lo suyo (un enlace
    // o un botón de los de dentro); el mando que cubre la barra es un
    // botón también, pero ese sí alterna.
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
    // :scope > para no pisar el mando de una ventana que estuviera
    // metida dentro de otra.
    const mando = ventana.querySelector(
        ":scope > .ventana-barra > .ventana-barra-mando"
    );
    if (mando) {
        mando.setAttribute("aria-expanded", plegada ? "false" : "true");
    }
}

// =========================================
// SOLTARLA DE LA FILA O DE LA COLUMNA
// =========================================
// Esconder lo de dentro no basta: muchas de estas ventanas están en una
// fila o en una columna que las estira, y plegadas se quedarían igual de
// altas pero vacías. Las dos tarjetas de la portada van a la misma
// altura (align-items: stretch en una fila), y la ficha de un gato crece
// para llenar su columna (flex: 1 1 0%).
//
// Esto NO se puede escribir en el CSS: lo que hay que deshacer depende de
// en qué dirección estire el contenedor, y una hoja de estilos no puede
// preguntarlo. En una fila estira a lo alto y se arregla con align-self;
// en una columna estira a lo largo y lo que hay que tocar es el flex. Y
// la misma regla no vale para las dos: un align-self: start en una
// columna encogería la ventana a lo ANCHO, que es justo lo que no
// queremos. Así que se mira el contenedor y se pone lo que toque, y al
// desplegar se quita y vuelve a mandar el CSS de la página.
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
        // "0 0 auto" y no solo flex-grow: 0, porque varias de estas
        // ventanas vienen con flex-basis: 0 y, sin crecer, se quedarían
        // literalmente en cero de alto. Con basis auto miden lo que mide
        // la barra, que es lo que hay dentro.
        ventana.style.flex = "0 0 auto";
    } else {
        // Filas y rejillas: en las dos, align-self es el eje de arriba
        // abajo. Lo de ancho no se toca, que ahí no sobra nada.
        ventana.style.alignSelf = "start";
    }
}
