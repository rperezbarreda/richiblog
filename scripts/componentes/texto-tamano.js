// =========================================
// COMPONENTE: TAMAÑO DEL TEXTO
// =========================================
// El botón "Aa" de arriba a la derecha. Al pulsarlo se abre con un + y
// un − que hacen el texto de TODA la web más grande o más pequeño, y el
// tamaño elegido se queda guardado para la próxima visita.
//
// CÓMO SE HACE GRANDE TODO A LA VEZ
// ---------------------------------
// No se toca ni un tamaño de letra. Se cambia una sola cosa: la
// variable --escala de :root, por la que se multiplica el tamaño de
// raíz (ver estilos/base.css). Como en este sitio los tamaños van en
// rem —los 171 font-size del CSS menos uno—, todo lo demás sale solo.
//
// QUIÉN LO PINTA LA PRIMERA VEZ
// -----------------------------
// Este script va con defer, así que llega tarde: si esperara a ejecutar
// aquí, la página se pintaría a tamaño normal y daría un salto. Lo que
// lee lo guardado y pone la escala antes del primer pintado es
// scripts/cargador-scripts.js, que va sin defer en el <head>. Aquí solo
// se monta el mando.
//
// OJO CON LOS NOMBRES
// -------------------
// Aquí no hay módulos: todos los scripts del sitio comparten el mismo
// ámbito global, así que dos funciones con el mismo nombre en archivos
// distintos se pisan. Esto ya pasó: este archivo tenía una mover() y
// se cargaba antes que teclado-scroll.js, que tiene la suya; ganaba la
// última y el + del tamaño acababa llamando a la del scroll. Por eso
// todo lo de aquí lleva "tamano" en el nombre. Se comprueba con
// herramientas/nombres-repetidos.py.
//
// EL MANDO
// --------
// El HTML está en fragmentos/barra-lateral.html (con el resto del
// armazón que llevan todas las páginas), así que esto espera al
// "sidebar:loaded" igual que el botón del tema.

// Los cinco tamaños, del más pequeño al más grande. El 1 es el de
// siempre y está a propósito en la lista: se vuelve a él con el −, sin
// tener que acordarse de ningún número.
const TAMANOS = [0.9, 1, 1.15, 1.3, 1.5];
const TAMANO_GUARDADO = "richi-texto";

const TAMANO = {
    caja: null,
    boton: null,
    panel: null,
    menos: null,
    mas: null,
    valor: null,
    paso: 1,
};

document.addEventListener("sidebar:loaded", initializeTamano);

function initializeTamano() {
    const caja = document.querySelector("[data-tamano]");
    if (!caja || TAMANO.caja) {
        return;
    }

    TAMANO.caja = caja;
    TAMANO.boton = caja.querySelector("[data-tamano-boton]");
    TAMANO.panel = caja.querySelector("[data-tamano-panel]");
    TAMANO.menos = caja.querySelector("[data-tamano-menos]");
    TAMANO.mas = caja.querySelector("[data-tamano-mas]");
    TAMANO.valor = caja.querySelector("[data-tamano-valor]");
    if (!TAMANO.boton || !TAMANO.panel) {
        return;
    }

    TAMANO.paso = pasoDeTamano(escalaDeTamanoGuardada());
    aplicarTamano(TAMANO.paso, false);

    TAMANO.boton.addEventListener("click", () => abrirTamano(!tamanoAbierto()));
    if (TAMANO.menos) {
        TAMANO.menos.addEventListener("click", () => moverTamano(-1));
    }
    if (TAMANO.mas) {
        TAMANO.mas.addEventListener("click", () => moverTamano(1));
    }

    // Escape cierra sin tener que buscar el botón, y el foco vuelve a
    // él: si se quedara dentro de algo que acaba de desaparecer, el
    // teclado se queda sin sitio.
    TAMANO.caja.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && tamanoAbierto()) {
            evento.preventDefault();
            abrirTamano(false);
            TAMANO.boton.focus();
        }
    });

    // Pulsar fuera lo cierra, como los desplegables del menú. Se mira
    // en la fase de captura para que también cuente un clic en algo
    // que se quite de en medio después.
    document.addEventListener("click", (evento) => {
        if (tamanoAbierto() && !TAMANO.caja.contains(evento.target)) {
            abrirTamano(false);
        }
    });

    // Al irse el foco del mando entero (con el tabulador) también se
    // cierra: quedaría abierto detrás de donde se está escribiendo.
    document.addEventListener("focusin", (evento) => {
        if (tamanoAbierto() && !TAMANO.caja.contains(evento.target)) {
            abrirTamano(false);
        }
    });
}

function tamanoAbierto() {
    return TAMANO.boton.getAttribute("aria-expanded") === "true";
}

function abrirTamano(abrir) {
    TAMANO.boton.setAttribute("aria-expanded", abrir ? "true" : "false");
    TAMANO.panel.hidden = !abrir;
}

// =========================================
// EL TAMAÑO
// =========================================

function escalaDeTamanoGuardada() {
    try {
        return parseFloat(localStorage.getItem(TAMANO_GUARDADO));
    } catch (error) {
        return NaN;
    }
}

// El paso de la lista que corresponde a una escala guardada. Si lo
// guardado no es ninguno de los cinco (una visita vieja, o alguien
// tocando el almacén a mano), se coge el más cercano en vez de tirarlo:
// el texto grande de alguien que lo necesita no se pierde por un
// decimal.
function pasoDeTamano(escala) {
    if (!isFinite(escala) || escala <= 0) {
        return TAMANOS.indexOf(1);
    }
    let mejor = 0;
    for (let i = 1; i < TAMANOS.length; i += 1) {
        if (Math.abs(TAMANOS[i] - escala) < Math.abs(TAMANOS[mejor] - escala)) {
            mejor = i;
        }
    }
    return mejor;
}

function moverTamano(cuanto) {
    const siguiente = Math.min(TAMANOS.length - 1, Math.max(0, TAMANO.paso + cuanto));
    if (siguiente === TAMANO.paso) {
        return;
    }
    TAMANO.paso = siguiente;
    aplicarTamano(siguiente, true);
}

function aplicarTamano(paso, guardar) {
    const escala = TAMANOS[paso];
    document.documentElement.style.setProperty("--escala", escala);

    if (guardar) {
        try {
            // El tamaño de siempre no se guarda: se borra. Así quien no
            // ha tocado nada y quien ha vuelto al normal están igual, y
            // el día que cambie el tamaño base de la web les vale a los
            // dos.
            if (escala === 1) {
                localStorage.removeItem(TAMANO_GUARDADO);
            } else {
                localStorage.setItem(TAMANO_GUARDADO, String(escala));
            }
        } catch (error) {
            // Navegando en privado no se puede guardar. El tamaño vale
            // igual para esta visita.
        }
    }

    pintarTamano();
}

function pintarTamano() {
    const porcentaje = Math.round(TAMANOS[TAMANO.paso] * 100);
    if (TAMANO.valor) {
        TAMANO.valor.textContent = `${porcentaje}%`;
    }
    // En los extremos los botones se quedan apagados con aria-disabled
    // y no con disabled: así se siguen alcanzando con el tabulador y el
    // foco no se cae al cuerpo de la página justo al llegar al tope.
    if (TAMANO.menos) {
        TAMANO.menos.setAttribute("aria-disabled", TAMANO.paso === 0 ? "true" : "false");
    }
    if (TAMANO.mas) {
        TAMANO.mas.setAttribute(
            "aria-disabled",
            TAMANO.paso === TAMANOS.length - 1 ? "true" : "false"
        );
    }
}
