// =========================================
// COMPONENTE: TÍTULOS CORTADOS A LO QUE QUEPA
// =========================================
// En las dos ventanas de la portada —nuevas_entradas.txt y
// novedades.exe— cada título ocupa UNA línea y lo que no cabe se corta
// con puntos suspensivos. No es un capricho: ahí la caja es estrecha, y
// un título de 45 letras se partía en dos o tres líneas, las dos
// ventanas quedaban de alturas distintas y la fila de la portada salía
// con un escalón en medio. Desde que las listas van a dos columnas
// (@container en estilos/paginas/portada.css) hay la mitad de ancho,
// así que importa el doble.
//
// POR QUÉ SE MIDE Y NO SE CUENTAN LETRAS
// --------------------------------------
// Antes esto era un "corta a 28 letras" escrito en el código. Nunca
// podía estar bien: la letra del sitio es de ancho variable —una "i" no
// mide lo que una "W"— y, sobre todo, el hueco no es siempre el mismo.
// Medido en la portada, el hueco de un título va de 158 a 519 píxeles
// según el ancho de la pantalla, el tamaño de letra elegido en los
// ajustes (del 90% al 150%), la letra elegida y si la lista está a una
// columna o a dos. Con un número fijo, en las cajas anchas se cortaban
// títulos que cabían de sobra y en las estrechas no se cortaban bastante
// y remataba el CSS por el borde, a mitad de palabra.
//
// Así que se mide: se pregunta a la caja cuánto ancho tiene y se busca
// el corte más largo que entre. El resultado es el mismo en las dos
// ventanas, en los ocho temas y en los cinco tamaños de letra, sin
// tener que ajustar ningún número a mano.
//
// SE CORTA POR PALABRAS, no por letras: "Tomé la horrible decisión…" se
// lee como una frase a medias, que es lo que es; "Tomé la horrible
// deci…" se lee como un error. Solo si no cabe ni la primera palabra
// —un título que empieza por una palabra larguísima— se corta por
// letras, que es mejor que dejar solo los puntos.
//
// EL TÍTULO ENTERO NO SE PIERDE: el trozo que se ve lleva aria-hidden y
// al lado va el título completo escondido a la vista, así que lo que
// anuncia un lector de pantalla es el título de verdad. Cortar lo que
// se ve es una decisión de sitio; cortar lo que se oye sería esconder
// información.
//
// CUÁNDO SE REPASA
//   - Al pintar cada lista: quien la pinta llama a window.recortarTitulos
//     (scripts/paginas/entradas-blog.js y scripts/paginas/novedades.js).
//   - Cuando acaban de llegar las letras del sitio: hasta entonces se
//     mide con la letra de reserva del navegador, que no mide igual.
//   - Al cambiar el tamaño de la ventana, y al tocar cualquier ajuste
//     de accesibilidad (tamaño, letra, interlineado): los tres cambian
//     el hueco o el ancho de las letras.
//
// OJO CON LOS NOMBRES: todos los scripts comparten el mismo ámbito
// global, así que lo de aquí lleva "recorte" o "recortar" en el nombre.
// Se comprueba con herramientas/nombres-repetidos.py.

// Las cajas cuyos títulos se recortan. Solo la portada: en el listado
// del blog, en el de relatos y en el "sigue leyendo" los títulos siguen
// enteros, que ahí hay sitio y el título ES el contenido.
const RECORTE_DONDE = ".entries-projects-row .entry-preview-title";

// Un lienzo de mentira, solo para medir texto. Es la única forma de
// preguntar "cuánto mide esta frase con esta letra" sin meterla en la
// página: metiéndola, cada medida obliga al navegador a recolocar todo,
// y aquí se miden varios cortes de varios títulos cada vez.
const RECORTE_REGLA = (function regla() {
    try {
        return document.createElement("canvas").getContext("2d");
    } catch (error) {
        return null;
    }
})();

const RECORTE_PUNTOS = "…";

// Lo que se le quita al final del trozo visible antes de pegarle los
// puntos: una coma o un guion delante de "…" queda a medio escribir.
const RECORTE_SOBRAS = /[\s,.;:—–-]+$/;

window.recortarTitulos = function (raiz) {
    const donde = raiz && raiz.querySelectorAll ? raiz : document;
    donde.querySelectorAll(RECORTE_DONDE).forEach(recortarUnTitulo);
};

function recortarUnTitulo(titulo) {
    const entero = enteroDeRecorte(titulo);
    if (!entero) {
        return;
    }
    // Ventana plegada, o todavía sin pintar: no hay hueco que medir y
    // una medida contra cero lo dejaría todo en puntos suspensivos. Se
    // deja como está y ya se repasará cuando se abra.
    const hueco = titulo.clientWidth - flechaDeRecorte(titulo);
    if (hueco < 20) {
        return;
    }

    const fuente = fuenteDeRecorte(titulo);
    let visible = recorteQueCabe(entero, hueco, fuente);
    pintarRecorte(titulo, visible, entero);

    // Y el remate: la regla del lienzo no cuenta exactamente igual que
    // el navegador al colocar el texto (el espaciado entre letras, el
    // redondeo a píxeles enteros, una letra que todavía no estaba
    // cargada del todo), así que se comprueba lo PINTADO y, si aún se
    // sale, se quita otra palabra. Dos o tres vueltas como mucho; el
    // tope está para que un hueco rarísimo no deje esto dando vueltas.
    //
    // Esto vale TAMBIÉN cuando la regla ha dicho que el título cabía
    // entero (visible a null): es justo el caso en que un error de dos
    // píxeles deja la última palabra asomando, y el que se colaba antes
    // —el while pedía un "visible" que ahí no había y se saltaba la
    // comprobación entera.
    let vueltas = 0;
    while (anchoPintadoDeRecorte(titulo) > hueco + 1 && vueltas < 8) {
        vueltas += 1;
        visible = unaPalabraMenosDeRecorte(visible === null ? entero : visible);
        if (!visible) {
            break;
        }
        pintarRecorte(titulo, visible, entero);
    }
}

// Lo que mide de verdad el texto ya pintado.
//
// NO VALE scrollWidth, que es lo que uno escribiría. Con overflow:
// hidden y text-overflow: ellipsis puestos (que es como va este título,
// ver estilos/paginas/portada.css), Chrome devuelve en scrollWidth lo
// mismo que en clientWidth en cuanto le ha puesto sus puntos: el texto
// que sobra ya está recortado y para él no sobresale nada. O sea que
// justo cuando hay que arreglarlo, dice que no hay nada que arreglar.
// Así se coló "Fichas DnD 5e - Formato A5", que acababa con los puntos
// de aquí Y los del navegador seguidos: "Formato……".
// El trozo que se ve va siempre dentro de un <span> propio, y a ese sí
// se le puede preguntar cuánto ocupa.
function anchoPintadoDeRecorte(titulo) {
    const seVe = titulo.firstElementChild;
    if (!seVe) {
        return 0;
    }
    return seVe.getBoundingClientRect().width;
}

// Lo que ocupa la flechita de "este enlace sale de la web", que es un
// ::after del propio título (la pone enlaces-fuera.js poniéndole una
// clase al enlace, y la dibuja estilos/base.css). Va en la misma línea
// que el texto, así que es hueco que el título NO tiene, y la regla del
// lienzo no puede verla porque no es texto.
function flechaDeRecorte(titulo) {
    const pinta = window.getComputedStyle(titulo, "::after");
    if (!pinta || pinta.content === "none" || pinta.content === "normal") {
        return 0;
    }
    return (parseFloat(pinta.width) || 0) + (parseFloat(pinta.marginLeft) || 0);
}

// El título completo. La primera vez se lee de la propia página y se
// guarda en el elemento: a partir de ahí se trabaja siempre desde él,
// que si no, al repasar un título ya cortado se recortaría el recorte y
// cada vuelta se comería otra palabra.
function enteroDeRecorte(titulo) {
    if (titulo.dataset.recorteEntero === undefined) {
        titulo.dataset.recorteEntero = (titulo.textContent || "").trim();
    }
    return titulo.dataset.recorteEntero;
}

// La letra con la que se va a pintar, en el formato que entiende el
// lienzo. Se arma pieza a pieza y no con la propiedad "font" de golpe
// porque esa devuelve vacío en varios navegadores cuando la letra viene
// de una variable del CSS, que es justo el caso de este sitio.
function fuenteDeRecorte(titulo) {
    const como = window.getComputedStyle(titulo);
    return (
        como.fontStyle +
        " " +
        como.fontWeight +
        " " +
        como.fontSize +
        " " +
        como.fontFamily
    );
}

function anchoDeRecorte(texto, fuente) {
    if (!RECORTE_REGLA) {
        return 0;
    }
    RECORTE_REGLA.font = fuente;
    return RECORTE_REGLA.measureText(texto).width;
}

// Devuelve el trozo visible con sus puntos, o null si el título cabe
// entero y no hay nada que cortar.
function recorteQueCabe(entero, hueco, fuente) {
    if (!RECORTE_REGLA || anchoDeRecorte(entero, fuente) <= hueco) {
        return null;
    }

    // Los cortes posibles son los espacios del título, probados del
    // último al primero: el primero que entre es el trozo más largo que
    // cabe.
    for (let i = entero.length - 1; i > 0; i--) {
        if (entero[i] !== " ") {
            continue;
        }
        const trozo = entero.slice(0, i).replace(RECORTE_SOBRAS, "");
        if (trozo && anchoDeRecorte(trozo + RECORTE_PUNTOS, fuente) <= hueco) {
            return trozo + RECORTE_PUNTOS;
        }
    }

    // Ni la primera palabra cabe. Se corta por letras, que es feo pero
    // se sigue leyendo; dejar solo "…" no dice nada.
    for (let corte = entero.length - 1; corte > 0; corte--) {
        const trozo = entero.slice(0, corte);
        if (anchoDeRecorte(trozo + RECORTE_PUNTOS, fuente) <= hueco) {
            return trozo + RECORTE_PUNTOS;
        }
    }
    return RECORTE_PUNTOS;
}

// Para el remate de arriba: quitarle una palabra a un trozo que ya
// lleva puntos.
function unaPalabraMenosDeRecorte(visible) {
    const sinPuntos = visible.replace(/…$/, "");
    const espacio = sinPuntos.lastIndexOf(" ");
    if (espacio <= 0) {
        // Ya era una sola palabra: se le quita una letra.
        const corta = sinPuntos.slice(0, -1);
        return corta ? corta + RECORTE_PUNTOS : "";
    }
    return sinPuntos.slice(0, espacio).replace(RECORTE_SOBRAS, "") + RECORTE_PUNTOS;
}

// Se escribe con nodos de texto y no con innerHTML: lo que va dentro es
// el título de una entrada, que viene de un JSON, y por aquí no entra
// nada que el navegador pueda interpretar como etiquetas.
//
// Y si lo que toca poner ES YA LO QUE HAY, no se toca nada. No es por
// ahorrar: tocar el título es un cambio en la página, y de los cambios
// en la página se despiertan vigilantes que vuelven a llamar aquí (ver
// más abajo). Sin esta parada, dos componentes se pasaban la pelota
// sesenta veces por segundo.
// El trozo que se ve va SIEMPRE en su propio <span>, también cuando no
// se ha cortado nada: es el único que se puede medir (ver
// anchoPintadoDeRecorte). Lo que cambia es que, cortado, ese span se
// esconde de quien escucha (aria-hidden) y al lado va el título entero.
function pintarRecorte(titulo, visible, entero) {
    const puesto = visible === null ? "" : visible;
    if (titulo.dataset.recortePuesto === puesto) {
        return;
    }
    titulo.dataset.recortePuesto = puesto;
    titulo.textContent = "";

    const seVe = document.createElement("span");
    seVe.textContent = visible === null ? entero : visible;
    titulo.appendChild(seVe);
    if (visible === null) {
        return;
    }
    // Cortado: lo que se ve deja de contar para el nombre del enlace y
    // al lado va el título de verdad, escondido a la vista.
    seVe.setAttribute("aria-hidden", "true");
    const seOye = document.createElement("span");
    seOye.className = "visually-hidden";
    seOye.textContent = entero;
    titulo.appendChild(seOye);
}

// =========================================
// CUÁNDO SE VUELVE A REPASAR
// =========================================

// Agrupado: al arrastrar el borde de la ventana esto llegaría cientos
// de veces por segundo, y cada vuelta mide de verdad.
let recorteEspera = null;

function repasarRecortes() {
    window.clearTimeout(recorteEspera);
    recorteEspera = window.setTimeout(() => window.recortarTitulos(), 120);
}

window.addEventListener("resize", repasarRecortes);

// El tamaño del texto, la letra y el interlineado cambian lo que mide
// cada palabra y lo que mide la caja, pero no disparan "resize".
document.addEventListener("ajustes:actualizar", repasarRecortes);

// Hasta que no están las letras del sitio se mide con la de reserva del
// navegador, que no es igual de ancha: sin este repaso, los títulos
// quedaban cortados para una letra que luego no era la que se veía.
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => window.recortarTitulos());
}

// Y un vigilante sobre las dos ventanas, porque hay cosas que le crecen
// al título DESPUÉS de que esto haya medido.
//
// El caso real: la flechita de "este enlace sale de la web". La pone
// scripts/componentes/enlaces-fuera.js, que no puede saber cuándo se
// pinta una lista que viene de un JSON y por eso también vigila la
// página y repasa en el siguiente fotograma. O sea, siempre después de
// que aquí se haya medido. La flechita es un ::after de 17px que la
// regla no puede ver venir, y el único título externo de novedades.exe
// —"Fichas DnD 5e - Formato A5"— se quedaba con la flecha fuera del
// marco en cuatro de los quince casos medidos.
//
// Esto no se arregla llamando aquí más tarde "a ojo": los dos
// componentes se despiertan solos y el orden no está garantizado. Se
// arregla volviendo a medir cuando la caja cambia, sea quien sea el que
// la cambie. Y no se hace un bucle porque pintarRecorte() no toca nada
// cuando lo que toca poner es ya lo que hay: a la segunda vuelta no
// queda cambio que vigilar y se para solo.
if (typeof MutationObserver === "function") {
    const fila = document.querySelector(".entries-projects-row");
    if (fila) {
        let pendienteRecorte = false;
        const vigia = new MutationObserver(() => {
            if (pendienteRecorte) {
                return;
            }
            pendienteRecorte = true;
            window.requestAnimationFrame(() => {
                pendienteRecorte = false;
                window.recortarTitulos(fila);
            });
        });
        vigia.observe(fila, {
            childList: true,
            subtree: true,
            attributes: true,
            // Solo la clase: es lo que cambia cuando a un enlace se le
            // marca que sale de la web. Vigilar todos los atributos
            // sería despertarse también con los aria-pressed de los
            // mandos de las ventanas.
            attributeFilter: ["class"],
        });
    }
}
