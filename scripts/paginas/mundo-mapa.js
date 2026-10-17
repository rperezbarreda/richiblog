// =========================================
// EL MAPA DE UN MUNDO
// =========================================
// El zoom, el arrastre y las capas de la página de un mapa
// (web/wiki/mapa_<loquesea>.html, que escribe
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
        dibujo: dibujo,
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
    window.addEventListener("resize", () => {
        escalarPinesDeMapa(mando);
        mejorarImagenDeMapa(mando);
        pintarEscalaDeMapa(mando);
    });

    prepararArrastreDeMapa(mando);
    prepararCapasDeMapa(caja);
    mejorarImagenDeMapa(mando);
    prepararRegionesDeMapa(caja);
    prepararGloboDeMapa(mando);
    prepararSitiosDeMapa();
    prepararEscalaDeMapa(mando);
    prepararMedirDeMapa(mando);
    prepararLeyendaDeMapa(mando);
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
    // De cerca (al 200% o más) se escriben también los nombres de los
    // pueblos, las fortalezas…: con el mapa entero serían una sopa.
    lienzo.classList.toggle("esta-cerca", ahora >= 1.995);

    if (Math.abs(ahora - antes) > 0.0005) {
        const cuanto = ahora / antes;
        lienzo.scrollLeft = puntoX * cuanto - haciaX;
        lienzo.scrollTop = puntoY * cuanto - haciaY;
    }

    escalarPinesDeMapa(mando);
    mejorarImagenDeMapa(mando);
    pintarEscalaDeMapa(mando);

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
    apagarConCasilla(caja, "[data-mapa-lineas]", ".mapa-lineas");
    apagarConCasilla(caja, "[data-mapa-nombres]", ".mapa-pin-nombre, .mapa-textos");
    prepararNivelesDeMapa(caja);
}

// PAÍSES O REGIONES. En un mapa con las dos cosas (ver niveles() en
// herramientas/3-generadores/mundo_mapas.py) se ve una u otra: una región
// pintada encima tapa a sus países. Los países que no son de ninguna
// región (una isla independiente) llevan es-suelto y salen también con
// las regiones, que si no se quedaría un hueco en el mapa.
function prepararNivelesDeMapa(caja) {
    const casillas = [...caja.querySelectorAll("[data-mapa-nivel-casilla]")];
    const regiones = caja.querySelector('[data-mapa-nivel="regiones"]');
    const paises = caja.querySelector('[data-mapa-nivel="paises"]');
    const dibujos = caja.querySelector(".mapa-dibujos");
    if (!casillas.length || !regiones || !paises) {
        return;
    }
    const aplicar = () => {
        const marcada = casillas.find((c) => c.checked);
        const cual = marcada ? marcada.value : "paises";
        // «todo»: las dos a la vez; las de dentro (los países) van
        // pintadas después, encima de las grandes.
        regiones.classList.toggle("es-apagada", cual !== "regiones" && cual !== "todo");
        paises.classList.toggle("es-apagada", cual === "nada");
        paises.classList.toggle("es-solo-sueltos", cual === "regiones");
        if (dibujos) {
            dibujos.classList.toggle("es-apagada", cual === "nada");
        }
    };
    casillas.forEach((casilla) => casilla.addEventListener("change", aplicar));
    aplicar();
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
    const dibujo = mando.caja.querySelector(".mapa-svg");
    if (!dibujo) {
        return;
    }
    // Los pines y también las flechas de las rutas, que llevan su giro.
    const grupo = mando.caja.querySelector(".mapa-pines");
    const radio = parseFloat(dibujo.getAttribute("data-mapa-radio")
        || (grupo && grupo.getAttribute("data-mapa-radio"))) || 0;
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
    dibujo.querySelectorAll("[data-mapa-xy]").forEach((pin) => {
        const sitio = pin.getAttribute("data-mapa-xy");
        const giro = pin.getAttribute("data-mapa-giro");
        pin.setAttribute("transform", "translate(" + sitio + ")" + (giro ? " rotate(" + giro + ")" : "")
            + " scale(" + cuanto.toFixed(3) + ")");
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
    // La bandera del país, si tiene, arriba del todo. Con su ancho y su
    // alto puestos: si no, el globo se coloca antes de que llegue la imagen
    // y al llegar crece y se sale por el borde.
    const bandera = banderaSeguraDeMapa(sitio.getAttribute("data-mapa-bandera"));
    if (bandera) {
        const img = document.createElement("img");
        img.className = "mapa-globo-bandera";
        img.src = bandera;
        img.alt = "";
        img.width = 120;
        img.height = 80;
        globo.appendChild(img);
    }
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

// Solo una dirección de esta web ("/imagenes/…"): lo que acaba en un src
// se comprueba siempre, aunque lo escriba el generador.
function banderaSeguraDeMapa(url) {
    const limpia = (url || "").toString().trim();
    return /^\/(?!\/)/.test(limpia) ? limpia : "";
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


// =========================================
// LA IMAGEN GRANDE, SOLO CUANDO HACE FALTA
// =========================================
// El dibujo del mapa llega en pequeño (1280 de ancho: un cuarto de lo que
// pesa el de 2560, ver preparar_capas en generar-mundo.py), que es lo que
// se ve en un móvil y en la mayoría de pantallas con el mapa entero. En
// cuanto lo que se pinta pide más puntos de los que tiene —al acercar el
// mapa, o en una pantalla muy grande o de mucha densidad— se baja el
// grande por detrás y se cambia cuando ya ha llegado, para que no se quede
// en blanco mientras tanto.
function mejorarImagenDeMapa(mando) {
    const pide = mando.lienzo.clientWidth * (mando.zoom || 1) * (window.devicePixelRatio || 1);
    mando.lienzo.querySelectorAll(".mapa-capa-img[data-mapa-grande]").forEach((imagen) => {
        if (imagen.dataset.mapaCambiando || pide <= 1280 * 1.15) {
            return;
        }
        const grande = banderaSeguraDeMapa(imagen.getAttribute("data-mapa-grande"));
        if (!grande) {
            return;
        }
        imagen.dataset.mapaCambiando = "1";
        const antes = new Image();
        antes.onload = () => {
            imagen.setAttribute("href", grande);
            imagen.removeAttribute("data-mapa-grande");
        };
        antes.onerror = () => {
            delete imagen.dataset.mapaCambiando;
        };
        antes.src = grande;
    });
}


// =========================================
// LA ESCALA Y MEDIR
// =========================================
// Si el mapa tiene escala (la pone el editor de mapas: el SVG la trae en
// data-mapa-escala-px, -distancia y -unidad), una BARRA DE ESCALA COMO LA
// DE UN MAPA DE VERDAD: a tramos blancos y negros, con sus rayitas y sus
// números (0, la mitad y el total). Va abajo a la izquierda de la ventana
// del mapa, quieta aunque el mapa se mueva, y se rehace con el zoom: mide
// siempre un número redondo (1, 2 o 5 por diez a la lo que sea) de unos
// 180 píxeles de pantalla. La de dentro del SVG (la que se ve sin
// JavaScript, que crece con el zoom y se sale) se esconde.
//
// Y MEDIR: con el botón «medir» pulsado, cada clic en el mapa pone un
// punto (también encima de un sitio, que entonces no lleva a su página) y
// abajo dice cuánto hay y los días de viaje. Los puntos llevan
// data-mapa-xy, así que miden lo mismo a cualquier zoom, como los pines.

function escalaDelMapa(mando) {
    const d = mando.dibujo;
    const px = parseFloat(d.getAttribute("data-mapa-escala-px"));
    const distancia = parseFloat(d.getAttribute("data-mapa-escala-distancia"));
    if (!px || !distancia) {
        return null;
    }
    let viaje = {};
    try {
        viaje = JSON.parse(d.getAttribute("data-mapa-viaje") || "{}") || {};
    } catch (error) {
        viaje = {};
    }
    return { porPixel: distancia / px, unidad: d.getAttribute("data-mapa-escala-unidad") || "", viaje };
}

function cifraDeMapa(n) {
    return Number(n).toLocaleString("es-ES", { maximumFractionDigits: 1 });
}

// Cuántos píxeles de pantalla mide una unidad del mapa ahora mismo.
function pantallaPorUnidadDeMapa(mando) {
    const d = mando.dibujo;
    const caja = d.getBoundingClientRect();
    const lados = (d.getAttribute("viewBox") || "").split(/[\s,]+/);
    const ancho = parseFloat(lados[2]);
    const alto = parseFloat(lados[3]);
    if (!ancho || !alto || !caja.width) {
        return 0;
    }
    return Math.min(caja.width, caja.height * (ancho / alto)) / ancho;
}

function svgDeMapa(etiqueta, atributos) {
    // (El espacio de nombres escrito aquí y no en una constante de arriba:
    // el mapa se prepara nada más cargar este archivo, antes de llegar a
    // las constantes del final.)
    const el = document.createElementNS("http://www.w3.org/2000/svg", etiqueta);
    Object.keys(atributos || {}).forEach((k) => el.setAttribute(k, String(atributos[k])));
    return el;
}

function prepararEscalaDeMapa(mando) {
    mando.escala = escalaDelMapa(mando);
    if (!mando.escala) {
        return;
    }
    mando.caja.classList.add("tiene-escala-viva");
    const barra = document.createElement("div");
    barra.className = "mapa-escala-viva";
    barra.setAttribute("aria-hidden", "true");
    mando.caja.appendChild(barra);
    mando.barraDeEscala = barra;
}

function pintarEscalaDeMapa(mando) {
    const barra = mando.barraDeEscala;
    const escala = mando.escala;
    if (!barra || !escala) {
        return;
    }
    const porUnidad = pantallaPorUnidadDeMapa(mando);
    if (!porUnidad) {
        return;
    }
    // Lo que mide un píxel de pantalla, y el número redondo que cabe en
    // unos 180.
    const porPantalla = escala.porPixel / porUnidad;
    const deseado = 180 * porPantalla;
    const potencia = Math.pow(10, Math.floor(Math.log10(deseado)));
    const valor = [5, 2, 1].map((m) => m * potencia).find((v) => v <= deseado);
    const largo = valor / porPantalla;
    const margen = 12;
    const unidad = escala.unidad ? " " + escala.unidad : "";
    const ancho = largo + margen * 2 + 10 + unidad.length * 8;
    const svg = svgDeMapa("svg", { width: Math.ceil(ancho), height: 52, viewBox: "0 0 " + Math.ceil(ancho) + " 52" });
    const y = 30;
    const alto = 8;
    // Cuatro tramos, blanco y negro a turnos, con un borde: la barra de
    // los mapas de papel.
    for (let i = 0; i < 4; i++) {
        svg.appendChild(svgDeMapa("rect", {
            x: margen + largo * i / 4, y, width: largo / 4, height: alto,
            class: i % 2 ? "mapa-escala-tramo es-oscuro" : "mapa-escala-tramo",
        }));
    }
    svg.appendChild(svgDeMapa("rect", { x: margen, y, width: largo, height: alto, class: "mapa-escala-borde" }));
    // Las rayitas: largas en el principio, la mitad y el final; cortas en
    // los cuartos.
    [0, 1, 2, 3, 4].forEach((i) => {
        const x = margen + largo * i / 4;
        const larga = i % 2 === 0;
        svg.appendChild(svgDeMapa("line", {
            x1: x, x2: x, y1: y - (larga ? 8 : 4), y2: y + alto, class: "mapa-escala-raya",
        }));
    });
    // Los números encima de las rayas largas, y la unidad detrás de la
    // barra.
    [[0, "0"], [2, cifraDeMapa(valor / 2)], [4, cifraDeMapa(valor)]].forEach(([i, texto]) => {
        const letrero = svgDeMapa("text", {
            x: margen + largo * i / 4, y: y - 11, class: "mapa-escala-letra", "text-anchor": "middle",
        });
        letrero.textContent = texto;
        svg.appendChild(letrero);
    });
    if (unidad) {
        const letrero = svgDeMapa("text", { x: margen + largo + 8, y: y + alto, class: "mapa-escala-letra" });
        letrero.textContent = unidad.trim();
        svg.appendChild(letrero);
    }
    barra.replaceChildren(svg);
}

function diasDeViajeDeMapa(distancia, porDia) {
    const dias = distancia / porDia;
    if (dias < 1) {
        const horas = Math.max(1, Math.round(dias * 8));
        return horas === 1 ? "una hora" : "unas " + horas + " horas";
    }
    const medios = Math.round(dias * 2) / 2;
    const enteros = Math.floor(medios);
    const conMedio = medios !== enteros;
    if (enteros === 1) {
        return conMedio ? "un día y medio" : "un día";
    }
    return enteros + (conMedio ? " días y medio" : " días");
}

function prepararMedirDeMapa(mando) {
    const boton = mando.caja.querySelector("[data-mapa-medir]");
    const borrar = mando.caja.querySelector("[data-mapa-medir-borrar]");
    const salida = mando.caja.querySelector("[data-mapa-medida]");
    if (!boton || !mando.escala) {
        return;
    }
    boton.hidden = false;
    // «Borrar» siempre a la vista (apagado sin medida) y lo medido ENCIMA
    // del mapa, abajo: si aparecieran en la fila de los mandos, la fila
    // crecería y el mapa bajaría justo mientras se está pulsando en él.
    borrar.hidden = false;
    mando.caja.appendChild(salida);
    salida.classList.add("es-encima");
    const medida = { activa: false, puntos: [], grupo: null };
    const radio = parseFloat(mando.dibujo.getAttribute("data-mapa-radio")) || 10;

    const pintar = () => {
        if (medida.grupo) {
            medida.grupo.remove();
            medida.grupo = null;
        }
        borrar.disabled = !medida.puntos.length;
        if (!medida.puntos.length) {
            salida.textContent = medida.activa ? "Pulsa en el mapa de un sitio a otro." : "";
            return;
        }
        const grupo = svgDeMapa("g", { class: "mapa-medida-dibujo" });
        const d = medida.puntos.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join("");
        grupo.appendChild(svgDeMapa("path", { d, class: "mapa-medida-borde" }));
        grupo.appendChild(svgDeMapa("path", { d, class: "mapa-medida-raya" }));
        medida.puntos.forEach((p) => {
            const xy = p.x.toFixed(1) + "," + p.y.toFixed(1);
            const punto = svgDeMapa("circle", { r: (radio * 0.4).toFixed(1), class: "mapa-medida-punto",
                "data-mapa-xy": xy, transform: "translate(" + xy + ")" });
            grupo.appendChild(punto);
        });
        mando.dibujo.appendChild(grupo);
        medida.grupo = grupo;
        escalarPinesDeMapa(mando);
        let pixeles = 0;
        for (let i = 1; i < medida.puntos.length; i++) {
            pixeles += Math.hypot(medida.puntos[i].x - medida.puntos[i - 1].x, medida.puntos[i].y - medida.puntos[i - 1].y);
        }
        if (medida.puntos.length < 2) {
            salida.textContent = "Ahora pulsa en el siguiente punto.";
            return;
        }
        const e = mando.escala;
        const distancia = pixeles * e.porPixel;
        let texto = "Distancia: " + cifraDeMapa(distancia) + (e.unidad ? " " + e.unidad : "");
        const viaje = Object.keys(e.viaje).filter((como) => e.viaje[como] > 0);
        if (viaje.length) {
            texto += ". " + viaje.map((como) => como.charAt(0).toUpperCase() + como.slice(1) + ": "
                + diasDeViajeDeMapa(distancia, e.viaje[como])).join(" · ");
        }
        salida.textContent = texto + ".";
    };

    const activar = (si) => {
        medida.activa = si;
        boton.setAttribute("aria-pressed", si ? "true" : "false");
        mando.lienzo.classList.toggle("esta-midiendo", si);
        if (mando.globo) {
            mando.globo.hidden = true;
        }
        pintar();
    };

    boton.addEventListener("click", () => activar(!medida.activa));
    borrar.addEventListener("click", () => {
        medida.puntos = [];
        pintar();
    });
    // En captura y en el lienzo: llega antes que el enlace del sitio, que
    // midiendo no tiene que llevar a ninguna parte. (Si se ha arrastrado,
    // el arrastre ya se ha comido el clic.)
    mando.lienzo.addEventListener("click", (evento) => {
        if (!medida.activa) {
            return;
        }
        evento.preventDefault();
        evento.stopPropagation();
        const matriz = mando.dibujo.getScreenCTM();
        if (!matriz) {
            return;
        }
        const punto = mando.dibujo.createSVGPoint();
        punto.x = evento.clientX;
        punto.y = evento.clientY;
        const p = punto.matrixTransform(matriz.inverse());
        medida.puntos.push({ x: p.x, y: p.y });
        pintar();
    }, true);
    mando.lienzo.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && medida.activa) {
            activar(false);
        }
    });
}


// =========================================
// LA LEYENDA, FLOTANTE
// =========================================
// Sin JavaScript la leyenda va debajo del mapa, a la vista. Con él, es un
// panel encima del mapa, arriba a la derecha (justo debajo de los
// mandos), que abre y cierra el botón «leyenda»; Esc también lo cierra.

function prepararLeyendaDeMapa(mando) {
    const boton = mando.caja.querySelector("[data-mapa-leyenda-boton]");
    const panel = mando.caja.querySelector("[data-mapa-leyenda]");
    if (!boton || !panel) {
        return;
    }
    boton.hidden = false;
    panel.classList.add("es-flotante");
    panel.hidden = true;
    const colocar = () => {
        const mandos = mando.caja.querySelector("[data-mapa-mandos]");
        panel.style.top = ((mandos ? mandos.offsetHeight : 0) + 10) + "px";
        panel.style.maxHeight = Math.max(160, mando.lienzo.clientHeight - 20) + "px";
    };
    const poner = (abierta) => {
        panel.hidden = !abierta;
        boton.setAttribute("aria-expanded", abierta ? "true" : "false");
        if (abierta) {
            colocar();
        }
    };
    boton.addEventListener("click", () => poner(panel.hidden));
    window.addEventListener("resize", () => {
        if (!panel.hidden) {
            colocar();
        }
    });
    mando.caja.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && !panel.hidden) {
            poner(false);
            boton.focus();
        }
    });
}
