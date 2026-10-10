// =========================================
// EL MAPA DE UN MUNDO
// =========================================
// El zoom, el arrastre y las capas de la página de un mapa
// (web/mundo/mapa_<loquesea>.html, que escribe
// herramientas/3-generadores/generar-mundo.py a partir de un .cmap de
// Chronicler).
//
// ESTO ES UN AÑADIDO, NO EL MAPA. El mapa es un SVG que está en el HTML:
// se ve, se pulsa y se imprime sin que esto se ejecute, y la lista de
// sitios de debajo es el mapa en texto y tampoco necesita nada. Si este
// archivo no llega, lo único que falta es poder acercarse y apagar capas,
// y los mandos ni se pintan (los esconde mundo-mapa.css con html:not(.js)).
//
// EL ZOOM ES UNA ANCHURA. No hay transformaciones ni matrices: el lienzo
// es una caja con overflow: auto y el SVG mide
// "calc(100% * var(--mapa-zoom))". Al poner el zoom a 2, el dibujo mide el
// doble que su ventana y aparecen las barras de desplazamiento. Lo bueno
// de hacerlo así es todo lo que sale gratis: el dedo, la rueda del ratón,
// las barras, las flechas del teclado y el "desplazar hasta aquí" del
// navegador funcionan solos, porque es un desplazamiento de los de
// siempre y no un invento.
//
// OJO CON LOS NOMBRES: todos los scripts comparten el mismo ámbito global,
// así que lo de aquí lleva "Mapa" en el nombre. Se comprueba con
// herramientas/4-comprobar/nombres-repetidos.py.

// Los saltos del zoom de los BOTONES. Empiezan en 1, que es "el mapa
// entero y nada de barras": por debajo no se baja porque no tendría
// sentido dejar huecos a los lados. La rueda del ratón no va a saltos,
// va suave, pero se mueve entre los mismos topes.
const ZOOMS_DE_MAPA = [1, 1.5, 2, 3, 4, 6];
const ZOOM_MAXIMO_DE_MAPA = 6;

// El radio que se quiere ver de un pin, en píxeles de pantalla (ver
// escalarPinesDeMapa, abajo). Está AQUÍ ARRIBA y no al lado de la función
// que lo usa por un motivo concreto: una función se puede llamar desde
// antes de donde está escrita, pero un const no existe hasta que se llega
// a su línea. Escrito abajo, la primera llamada —que sale de la línea 30 y
// pico, al arrancar— petaba con "Cannot access before initialization", y
// lo hacía A MEDIAS: el zoom se quedaba sin cifra y sin botones apagados,
// pero el mapa se veía, así que no parecía roto.
const PIN_EN_PANTALLA = 15;

initializeMundoMapa();

function initializeMundoMapa() {
    const caja = document.querySelector("[data-mapa]");
    const lienzo = caja && caja.querySelector("[data-mapa-lienzo]");
    const dibujo = lienzo && lienzo.querySelector(".mapa-svg");
    if (!caja || !lienzo || !dibujo) {
        return;
    }

    const mando = {
        caja: caja,
        lienzo: lienzo,
        zoom: 1,
        cifra: caja.querySelector("[data-mapa-cifra]"),
        mas: caja.querySelector("[data-mapa-mas]"),
        menos: caja.querySelector("[data-mapa-menos]"),
        ajustar: caja.querySelector("[data-mapa-ajustar]"),
    };

    if (mando.mas) {
        mando.mas.addEventListener("click", () => moverZoomDeMapa(mando, 1));
    }
    if (mando.menos) {
        mando.menos.addEventListener("click", () => moverZoomDeMapa(mando, -1));
    }
    if (mando.ajustar) {
        mando.ajustar.addEventListener("click", () => ponerZoomDeMapa(mando, 1));
    }

    // LA RUEDA DEL RATÓN. Hacia arriba acerca, hacia abajo aleja, y lo
    // hace HACIA DONDE ESTÁ EL PUNTERO, que es lo que hace que no te
    // pierdas: el sitio que estabas mirando se queda donde está.
    //
    // Con dos escapes, porque una rueda que no mueve la página es de las
    // cosas que más molestan de un mapa metido en un texto: con el mapa
    // ya entero (zoom 1) la rueda hacia abajo mueve la PÁGINA, como en
    // cualquier otro sitio; y con la tecla de mayúsculas pulsada la rueda
    // mueve el mapa de lado, que es lo que hace el navegador de por sí.
    lienzo.addEventListener("wheel", (evento) => {
        if (evento.shiftKey) {
            return;
        }
        const cuanto = ruedaDeMapa(evento);
        if (cuanto > 0 && mando.zoom <= 1.0005) {
            return;
        }
        evento.preventDefault();
        // Una rueda de ratón normal manda 100 por muesca; eso es un 22%
        // de zoom por muesca, que medido es un paso que se sigue con la
        // vista y no marea.
        const paso = Math.max(0.5, Math.min(2, Math.exp(-cuanto / 500)));
        ponerZoomDeMapa(mando, mando.zoom * paso, evento.clientX, evento.clientY);
    }, { passive: false });

    // Con el foco en el mapa: más y menos para el zoom, y el 0 para
    // volver a verlo entero. Las flechas no hacen falta: una caja que se
    // desplaza y tiene el foco ya se mueve con ellas, y hacerlo a mano
    // sería quitarle al navegador algo que hace mejor.
    lienzo.addEventListener("keydown", (evento) => {
        if (evento.ctrlKey || evento.metaKey || evento.altKey) {
            return;
        }
        if (evento.key === "+" || evento.key === "=") {
            evento.preventDefault();
            moverZoomDeMapa(mando, 1);
        } else if (evento.key === "-" || evento.key === "_") {
            evento.preventDefault();
            moverZoomDeMapa(mando, -1);
        } else if (evento.key === "0") {
            evento.preventDefault();
            ponerZoomDeMapa(mando, 1);
        }
    });

    // Al cambiar de tamaño la ventana cambia cuánto mide una unidad del
    // mapa en pantalla, así que los pines hay que volver a ajustarlos.
    window.addEventListener("resize", () => escalarPinesDeMapa(mando));

    prepararArrastreDeMapa(mando);
    prepararCapasDeMapa(caja);
    prepararRegionesDeMapa(caja);
    prepararGloboDeMapa(mando);
    prepararSitiosDeMapa();
    ponerZoomDeMapa(mando, 1);
}


// Lo que ha movido la rueda, en píxeles, venga del ratón que venga: hay
// ruedas que cuentan por líneas y hay quien tiene el ratón puesto en
// páginas enteras.
function ruedaDeMapa(evento) {
    const cuanto = evento.deltaY || 0;
    if (evento.deltaMode === 1) {
        return cuanto * 16;
    }
    if (evento.deltaMode === 2) {
        return cuanto * 400;
    }
    return cuanto;
}


// =========================================
// EL ZOOM
// =========================================

// Los botones van al siguiente salto de la lista por encima (o por debajo)
// de donde esté el zoom. Así los botones y la rueda son lo mismo: la rueda
// puede dejarlo en 237%, y el botón de acercar lleva al 300%.
function moverZoomDeMapa(mando, hacia) {
    const ahora = mando.zoom || 1;
    let destino;
    if (hacia > 0) {
        destino = ZOOMS_DE_MAPA.find((z) => z > ahora + 0.001);
        if (destino === undefined) {
            destino = ZOOM_MAXIMO_DE_MAPA;
        }
    } else {
        const menores = ZOOMS_DE_MAPA.filter((z) => z < ahora - 0.001);
        destino = menores.length ? menores[menores.length - 1] : 1;
    }
    ponerZoomDeMapa(mando, destino);
}

// quiere: cuánto zoom. anclaX/anclaY: el punto de la PANTALLA que tiene
// que quedarse donde está (el puntero del ratón). Sin ancla, el centro.
function ponerZoomDeMapa(mando, quiere, anclaX, anclaY) {
    const lienzo = mando.lienzo;
    const antes = mando.zoom || 1;
    const ahora = Math.max(1, Math.min(ZOOM_MAXIMO_DE_MAPA, quiere || 1));

    // DÓNDE SE ESTABA MIRANDO, para seguir mirando ahí después. Sin esto,
    // al acercar el mapa salta a la esquina de arriba a la izquierda y hay
    // que buscar otra vez dónde estabas.
    //
    // La cuenta sale de que el dibujo mide "el ancho del lienzo por el
    // zoom": al pasar de un zoom a otro, todo lo de dentro se multiplica
    // por lo mismo, así que un punto que estaba a X del borde pasa a estar
    // a X por ese mismo número.
    const caja = lienzo.getBoundingClientRect();
    const haciaX = anclaX === undefined ? lienzo.clientWidth / 2 : anclaX - caja.left;
    const haciaY = anclaY === undefined ? lienzo.clientHeight / 2 : anclaY - caja.top;
    const puntoX = lienzo.scrollLeft + haciaX;
    const puntoY = lienzo.scrollTop + haciaY;

    mando.zoom = ahora;
    lienzo.style.setProperty("--mapa-zoom", ahora);
    lienzo.classList.toggle("se-puede-arrastrar", ahora > 1.0005);

    if (Math.abs(ahora - antes) > 0.0005) {
        const cuanto = ahora / antes;
        lienzo.scrollLeft = puntoX * cuanto - haciaX;
        lienzo.scrollTop = puntoY * cuanto - haciaY;
    }

    escalarPinesDeMapa(mando);

    if (mando.cifra) {
        mando.cifra.textContent = Math.round(ahora * 100) + "%";
    }
    // Un botón que no puede hacer nada se apaga: pulsar "alejar" con el
    // mapa ya entero y que no pase nada parece que esté roto.
    const abajo = ahora <= 1.0005;
    if (mando.menos) {
        mando.menos.disabled = abajo;
    }
    if (mando.mas) {
        mando.mas.disabled = ahora >= ZOOM_MAXIMO_DE_MAPA - 0.0005;
    }
    if (mando.ajustar) {
        mando.ajustar.disabled = abajo;
    }
}


// =========================================
// ARRASTRAR
// =========================================
// Solo con el ratón. Con el dedo NO se toca nada: la caja ya se desplaza
// sola, y meterse en medio de eso es cargarse el impulso, el rebote y el
// pellizco para hacer zoom, que el navegador hace mejor.

function prepararArrastreDeMapa(mando) {
    const lienzo = mando.lienzo;
    let arrastre = null;
    let comerElClic = false;

    // EL ARRASTRE DEL NAVEGADOR, FUERA. Medido: sin esto el arrastre no
    // funcionaba donde hay imagen de fondo, y sí donde no la había. El
    // motivo es que al apretar encima de una imagen (o de un enlace) el
    // navegador empieza SU arrastre, el de llevarse la imagen a otra
    // ventana, y entonces manda un pointercancel que corta el nuestro a
    // medias. Aquí el mapa no se lleva a ninguna parte: se mueve.
    lienzo.addEventListener("dragstart", (evento) => evento.preventDefault());

    lienzo.addEventListener("pointerdown", (evento) => {
        if (evento.pointerType !== "mouse" || evento.button !== 0) {
            return;
        }
        arrastre = {
            id: evento.pointerId,
            x: evento.clientX,
            y: evento.clientY,
            desdeX: lienzo.scrollLeft,
            desdeY: lienzo.scrollTop,
            movido: false,
        };
    });

    lienzo.addEventListener("pointermove", (evento) => {
        if (!arrastre || evento.pointerId !== arrastre.id) {
            return;
        }
        const vaX = evento.clientX - arrastre.x;
        const vaY = evento.clientY - arrastre.y;
        // Un margen antes de empezar: un clic con la mano poco firme se
        // mueve dos píxeles, y eso tiene que seguir siendo un clic.
        if (!arrastre.movido && Math.abs(vaX) + Math.abs(vaY) < 6) {
            return;
        }
        if (!arrastre.movido) {
            arrastre.movido = true;
            lienzo.classList.add("esta-arrastrando");
            if (mando.globo) {
                // Arrastrando no se está mirando ningún sitio: el globo
                // iría dando tumbos por encima del mapa.
                mando.globo.hidden = true;
            }
            // Para que al salirse del mapa con el botón pulsado siga
            // arrastrando en vez de quedarse a medias.
            try {
                lienzo.setPointerCapture(arrastre.id);
            } catch (error) {
                // Si el navegador no deja capturar el puntero, se arrastra
                // igual mientras el ratón esté encima: no es grave.
            }
        }
        lienzo.scrollLeft = arrastre.desdeX - vaX;
        lienzo.scrollTop = arrastre.desdeY - vaY;
        evento.preventDefault();
    });

    const soltar = () => {
        if (arrastre && arrastre.movido) {
            // Se ha arrastrado desde encima de una región, que es un
            // enlace: hay que comerse el clic que viene detrás para no
            // acabar en otra página sin querer.
            comerElClic = true;
        }
        arrastre = null;
        lienzo.classList.remove("esta-arrastrando");
    };
    lienzo.addEventListener("pointerup", soltar);
    lienzo.addEventListener("pointercancel", soltar);
    window.addEventListener("blur", soltar);

    // En captura: hay que llegar ANTES que el enlace de la región.
    lienzo.addEventListener("click", (evento) => {
        if (comerElClic) {
            comerElClic = false;
            evento.preventDefault();
            evento.stopPropagation();
        }
    }, true);
}


// =========================================
// LAS CAPAS
// =========================================

function prepararCapasDeMapa(caja) {
    caja.querySelectorAll("[data-mapa-capa-casilla]").forEach((casilla) => {
        const cual = casilla.getAttribute("data-mapa-capa-casilla");
        casilla.addEventListener("change", () => {
            // Con getAttribute y no con un selector de atributo armado a
            // mano: un identificador del .cmap puede llevar cualquier
            // cosa dentro, y entonces el selector no valdría.
            caja.querySelectorAll("[data-mapa-capa]").forEach((capa) => {
                if (capa.getAttribute("data-mapa-capa") === cual) {
                    capa.classList.toggle("es-apagada", !casilla.checked);
                }
            });
        });
    });
}


// =========================================
// LAS REGIONES
// =========================================
// Apagarlas deja ver la imagen del mapa limpia, que es para lo que está:
// un mapa dibujado a mano ya trae sus fronteras pintadas, y las manchas de
// color por encima tapan justo lo que se quiere mirar. Los sitios no se
// pierden al apagarlas, que para eso está la lista de abajo.

function prepararRegionesDeMapa(caja) {
    apagarConCasilla(caja, "[data-mapa-regiones]", ".mapa-dibujos, .mapa-formas");
    apagarConCasilla(caja, "[data-mapa-pines]", ".mapa-pines");
}

function apagarConCasilla(caja, cual, selector) {
    const casilla = caja.querySelector(cual);
    if (!casilla) {
        return;
    }
    const capas = [...caja.querySelectorAll(selector)];
    casilla.addEventListener("change", () => {
        capas.forEach((capa) => capa.classList.toggle("es-apagada", !casilla.checked));
    });
}


// =========================================
// EL TAMAÑO DE LOS PINES
// =========================================
// Una chincheta no es geografía: es un señalador, y tiene que medir lo
// mismo en pantalla pase lo que pase. En el SVG está dibujada en unidades
// del mapa, así que el zoom la engorda con todo lo demás: al 600% tapaba
// medio continente.
//
// La cuenta es la de siempre: cuántos píxeles de pantalla mide una unidad
// del mapa ahora mismo, y cuánto hay que encoger (o estirar) el pin para
// que acabe midiendo PIN_EN_PANTALLA. Cada pin lleva su sitio en
// data-mapa-xy y se vuelve a escribir su transform con el scale detrás.
//
// Sin JavaScript no pasa nada: el pin se queda del tamaño con el que está
// dibujado, que es el que le toca con el mapa entero.

function escalarPinesDeMapa(mando) {
    const grupo = mando.caja.querySelector(".mapa-pines");
    const dibujo = mando.caja.querySelector(".mapa-svg");
    if (!grupo || !dibujo) {
        return;
    }
    const radio = parseFloat(grupo.getAttribute("data-mapa-radio")) || 0;
    const caja = dibujo.getBoundingClientRect();
    const lados = (dibujo.getAttribute("viewBox") || "").split(/[\s,]+/);
    const ancho = parseFloat(lados[2]);
    const alto = parseFloat(lados[3]);
    if (!radio || !ancho || !alto || !caja.width) {
        return;
    }
    // El dibujo se encaja dentro de su caja guardando la proporción
    // (preserveAspectRatio), así que lo que mide de verdad es lo que
    // quepa: a lo ancho o a lo alto, lo que primero toque.
    const anchoReal = Math.min(caja.width, caja.height * (ancho / alto));
    const porUnidad = anchoReal / ancho;
    const cuanto = Math.max(0.15, Math.min(8, PIN_EN_PANTALLA / (radio * porUnidad)));
    grupo.querySelectorAll("[data-mapa-xy]").forEach((pin) => {
        const sitio = pin.getAttribute("data-mapa-xy");
        pin.setAttribute("transform", "translate(" + sitio + ") scale(" + cuanto.toFixed(3) + ")");
    });
}


// =========================================
// EL GLOBO
// =========================================
// Al pasar por encima de una región o de un pin, una ventanita con su
// nombre y con a dónde lleva.
//
// Lo hace el navegador por su cuenta con el <title> del SVG, pero ese
// globo es el del sistema: tarda un segundo en salir, sale en la
// tipografía del sistema operativo, no se puede leer de un vistazo y no
// cabe más que una línea. Así que cuando hay JavaScript se quitan los
// <title> —si no, saldrían los dos— y se enseña éste, que es HTML normal:
// la tipografía del sitio, el color del tema y sitio para decir que el
// sitio lleva a otro mapa o que todavía no tiene página.
//
// Va con aria-hidden porque no cuenta nada nuevo: lo mismo está en la
// lista de abajo, que es la que se recorre con el teclado.

function prepararGloboDeMapa(mando) {
    const dibujo = mando.caja.querySelector(".mapa-svg");
    if (!dibujo) {
        return;
    }
    dibujo.querySelectorAll("title").forEach((viejo) => viejo.remove());

    const globo = document.createElement("div");
    globo.className = "mapa-globo";
    globo.setAttribute("aria-hidden", "true");
    globo.hidden = true;
    mando.caja.appendChild(globo);
    mando.globo = globo;

    const quien = (evento) => {
        const donde = evento.target;
        return donde && donde.closest ? donde.closest("[data-mapa-sitio]") : null;
    };

    dibujo.addEventListener("mouseover", (evento) => {
        const sitio = quien(evento);
        if (!sitio) {
            return;
        }
        llenarGloboDeMapa(globo, sitio);
        globo.hidden = false;
        moverGloboDeMapa(mando, evento.clientX, evento.clientY);
    });

    dibujo.addEventListener("mousemove", (evento) => {
        if (!globo.hidden) {
            moverGloboDeMapa(mando, evento.clientX, evento.clientY);
        }
    });

    dibujo.addEventListener("mouseout", (evento) => {
        const va = evento.relatedTarget;
        // De un trozo del mismo sitio a otro (del círculo al emoji) no es
        // salirse: solo se esconde cuando de verdad se ha ido.
        if (va && va.closest && va.closest("[data-mapa-sitio]") === quien(evento)) {
            return;
        }
        globo.hidden = true;
    });

    // Y fuera en cuanto pase cualquier otra cosa: al salir del mapa, al
    // empezar a arrastrar o al mover la página con la rueda, un globo
    // flotando donde ya no hay nada debajo es un fantasma.
    mando.lienzo.addEventListener("mouseleave", () => { globo.hidden = true; });
    mando.lienzo.addEventListener("wheel", () => { globo.hidden = true; }, { passive: true });
    window.addEventListener("scroll", () => { globo.hidden = true; }, { passive: true });
}

function llenarGloboDeMapa(globo, sitio) {
    globo.textContent = "";
    const icono = sitio.getAttribute("data-mapa-icono");
    if (icono) {
        const trozo = document.createElement("span");
        trozo.className = "mapa-globo-icono";
        trozo.textContent = icono;
        globo.appendChild(trozo);
    }
    const nombre = document.createElement("strong");
    nombre.className = "mapa-globo-nombre";
    nombre.textContent = sitio.getAttribute("data-mapa-nombre") || "";
    globo.appendChild(nombre);
    const que = sitio.getAttribute("data-mapa-que");
    if (que) {
        const linea = document.createElement("span");
        linea.className = "mapa-globo-que";
        linea.textContent = que;
        globo.appendChild(linea);
    }
}

function moverGloboDeMapa(mando, x, y) {
    const globo = mando.globo;
    const caja = mando.caja.getBoundingClientRect();
    const suyo = globo.getBoundingClientRect();
    // Pegado al puntero, pero sin salirse de la caja del mapa por ningún
    // lado: en el borde derecho se pone a la izquierda del puntero, y
    // abajo del todo, encima.
    let izquierda = x - caja.left + 16;
    let arriba = y - caja.top + 18;
    if (izquierda + suyo.width > caja.width - 6) {
        izquierda = Math.max(6, x - caja.left - suyo.width - 12);
    }
    if (arriba + suyo.height > caja.height - 6) {
        arriba = Math.max(6, y - caja.top - suyo.height - 12);
    }
    globo.style.left = Math.round(izquierda) + "px";
    globo.style.top = Math.round(arriba) + "px";
}


// =========================================
// LA LISTA Y EL DIBUJO, QUE SON LO MISMO
// =========================================
// Al pasar por una fila de la lista —con el ratón o con el tabulador— se
// enciende su región en el mapa. Es lo que hace que la lista no parezca un
// apéndice: se ve que cada nombre es un sitio del dibujo.

function prepararSitiosDeMapa() {
    const lista = document.querySelector(".mapa-sitios");
    const dibujo = document.querySelector(".mapa-svg");
    if (!lista || !dibujo) {
        return;
    }

    const mirar = (evento, si) => {
        const fila = evento.target.closest ? evento.target.closest("[data-mapa-sitio]") : null;
        if (!fila) {
            return;
        }
        const cual = fila.getAttribute("data-mapa-sitio");
        dibujo.querySelectorAll("[data-mapa-sitio]").forEach((forma) => {
            if (forma.getAttribute("data-mapa-sitio") === cual) {
                forma.classList.toggle("esta-mirado", si);
            }
        });
    };

    lista.addEventListener("mouseover", (evento) => mirar(evento, true));
    lista.addEventListener("mouseout", (evento) => mirar(evento, false));
    lista.addEventListener("focusin", (evento) => mirar(evento, true));
    lista.addEventListener("focusout", (evento) => mirar(evento, false));
}
