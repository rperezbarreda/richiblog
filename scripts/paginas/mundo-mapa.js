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
const ZOOMS_DE_MAPA = [1, 1.5, 2, 3, 4, 6, 8, 12, 16];
// El tope de siempre; un mapa puede pedir más (el mapamundi con lo de los
// mapas regionales dentro: data-mapa-zoom-maximo en su SVG).
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

// Los tipos de sitio, con su nombre en plural, para el filtro «tipos de
// sitio» (prepararFiltrosDeSitiosDeMapa). Los mismos que TIPOS_DE_PIN de
// mundo_mapas.py, en su orden; "" son los que no tienen tipo.
const TIPOS_DE_SITIO_DE_MAPA = [["capital", "capitales"], ["ciudad", "ciudades"], ["pueblo", "pueblos"],
    ["fortaleza", "fortalezas"], ["ruina", "ruinas"], ["puerto", "puertos"], ["templo", "templos"],
    ["torre", "torres"], ["cueva", "cuevas"], ["mina", "minas"], ["puente", "puentes"], ["batalla", "batallas"],
    ["mazmorra", "mazmorras"], ["campamento", "campamentos"], ["", "sin tipo"]];

// Lo que se recuerda de los mandos (plegados, cerrados), en el navegador.
const MEMORIA_DE_MANDOS_DE_MAPA = "mapa-mandos";

// Las clases de zona del desplegable «zonas» (prepararZonasDeMapa), con su
// nombre en plural. Aquí arriba por lo mismo que PIN_EN_PANTALLA.
const CLASES_DE_ZONA_DE_MAPA = [["vecino", "países vecinos"], ["provincia", "provincias y comarcas"], ["lago", "lagos"],
    ["mar", "mares"], ["bosque", "bosques"], ["montana", "montañas"], ["desierto", "desiertos"],
    ["pantano", "pantanos y ciénagas"], ["valle", "valles y llanuras"], ["otra", "otras regiones"]];

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
        maximo: parseFloat(dibujo.getAttribute("data-mapa-zoom-maximo")) || ZOOM_MAXIMO_DE_MAPA,
        // Desde qué zoom se escriben los nombres de los pueblos y demás.
        cerca: parseFloat(dibujo.getAttribute("data-mapa-cerca")) || 2,
        // Lo que mide un pin en pantalla (el mapamundi con lo regional
        // dentro los lleva más pequeños: data-mapa-pin).
        pin: parseFloat(dibujo.getAttribute("data-mapa-pin")) || PIN_EN_PANTALLA,
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
        mando.ajustar.addEventListener("click", () => {
            ponerZoomDeMapa(mando, 1);
            centrarMapa(mando);
        });
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
            centrarMapa(mando);
        }
    });

    // Al cambiar de tamaño la ventana cambia cuánto mide una unidad del
    // mapa en pantalla, así que los pines hay que volver a ajustarlos.
    window.addEventListener("resize", () => rehacerMapa(mando));

    prepararMandosFlotantesDeMapa(mando);
    prepararPantallaCompletaDeMapa(mando);
    prepararArrastreDeMapa(mando);
    prepararCapasDeMapa(caja);
    mejorarImagenDeMapa(mando);
    prepararRegionesDeMapa(caja);
    prepararFiltrosDeSitiosDeMapa(mando);
    prepararGloboDeMapa(mando);
    prepararSitiosDeMapa();
    prepararEscalaDeMapa(mando);
    prepararMedirDeMapa(mando);
    prepararLeyendaDeMapa(mando);
    prepararRutaDeMapa(mando);
    fijarMigasDeMapa();
    ponerZoomDeMapa(mando, 1);
    centrarMapa(mando);
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
        destino = ZOOMS_DE_MAPA.find((z) => z > ahora + 0.001 && z <= mando.maximo);
        if (destino === undefined) {
            destino = mando.maximo;
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
    const ahora = Math.max(1, Math.min(mando.maximo || ZOOM_MAXIMO_DE_MAPA, quiere || 1));

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
    // EL MARGEN DE ALREDEDOR (ver margenDeMapa): el punto se cuenta desde
    // el dibujo, sin él, y después se le suma el nuevo.
    const antesMargen = mando.margen || { x: 0, y: 0 };

    mando.zoom = ahora;
    lienzo.style.setProperty("--mapa-zoom", ahora);
    const margen = margenDeMapa(mando);
    lienzo.classList.toggle("se-puede-arrastrar", ahora > 1.0005 || conMargenDeMapa());
    // De cerca (al 200% o más) se escriben también los nombres de los
    // pueblos, las fortalezas…: con el mapa entero serían una sopa.
    lienzo.classList.toggle("esta-cerca", ahora >= (mando.cerca || 2) - 0.005);
    // A medio camino (desde el 200%): en el mapamundi, las capitales y las
    // ciudades de los mapas regionales; los demás sitios, ya de cerca.
    lienzo.classList.toggle("esta-medio", ahora >= 1.995);

    if (Math.abs(ahora - antes) > 0.0005) {
        const cuanto = ahora / antes;
        lienzo.scrollLeft = (puntoX - antesMargen.x) * cuanto + margen.x - haciaX;
        lienzo.scrollTop = (puntoY - antesMargen.y) * cuanto + margen.y - haciaY;
    }

    escalarPinesDeMapa(mando);
    mejorarImagenDeMapa(mando);
    pintarEscalaDeMapa(mando);
    alturaDelMenuDeMapa(mando);

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
        mando.mas.disabled = ahora >= (mando.maximo || ZOOM_MAXIMO_DE_MAPA) - 0.0005;
    }
    if (mando.ajustar) {
        // Al 100% con margen también vale: vuelve a centrar el mapa.
        mando.ajustar.disabled = abajo && !conMargenDeMapa();
    }
}


// EL MENÚ DE LA IZQUIERDA (pantallas anchas) mide lo que el mapa, y si no
// le cabe lo de dentro, se desplaza: así la caja acaba donde acaba el mapa
// y la barra de escala (abajo, encima del mapa) no se queda colgando debajo.
// Con el menú encima del mapa (pantallas estrechas) no se toca.
// (Con los mandos flotando encima del mapa, lo alto que pueden ponerse:
// lo del mapa, menos un hueco abajo para la barra de escala.)
function alturaDelMenuDeMapa(mando) {
    const menu = mando.caja.querySelector("[data-mapa-mandos]");
    if (!menu) {
        return;
    }
    if (mando.flotantes) {
        // Flotan donde hay sitio: en pantallas anchas y a pantalla
        // completa. En una estrecha el mapa mide poco de alto y lo
        // taparían: ahí van encima del mapa, como siempre.
        const flota = window.innerWidth >= 861 || !!mando.aPantalla;
        mando.caja.classList.toggle("con-mandos-flotantes", flota);
        menu.style.top = flota ? (mando.lienzo.offsetTop + 10) + "px" : "";
        menu.style.maxHeight = flota ? Math.max(120, mando.lienzo.clientHeight - 70) + "px" : "";
        return;
    }
    const alLado = menu.offsetTop === mando.lienzo.offsetTop && menu.offsetLeft < mando.lienzo.offsetLeft;
    menu.style.maxHeight = alLado ? Math.max(260, mando.lienzo.offsetHeight) + "px" : "";
}

// Todo lo que depende de lo que mide la ventana del mapa, otra vez (al
// cambiar el tamaño de la ventana y al entrar o salir de pantalla
// completa).
function rehacerMapa(mando) {
    margenDeMapa(mando);
    alturaDelMenuDeMapa(mando);
    escalarPinesDeMapa(mando);
    mejorarImagenDeMapa(mando);
    pintarEscalaDeMapa(mando);
}


// =========================================
// LOS MANDOS, EN UNA VENTANA FLOTANTE
// =========================================
// Con JavaScript, los mandos (zoom, leyenda, medir, ruta, qué se ve, los
// filtros) flotan encima del mapa, arriba a la izquierda, y el mapa ocupa
// todo el ancho (en pantallas estrechas no: ahí el mapa mide poco de alto
// y van encima de él, salvo a pantalla completa; ver alturaDelMenuDeMapa). Llevan una cabecera con dos botones: PLEGAR (se queda la
// cabecera y el zoom; vuelve a desplegarse con el mismo botón) y CERRAR
// (desaparecen; un botón «mandos» en la esquina los trae de vuelta). Se
// recuerda cómo se dejaron (en el navegador); la primera vez, plegados,
// que desplegados tapan un buen trozo del mapa. Sin sticky: absolute
// dentro de la caja del mapa.

function memoriaDeMandosDeMapa() {
    try {
        const m = JSON.parse(window.localStorage.getItem(MEMORIA_DE_MANDOS_DE_MAPA) || "null");
        return m && typeof m === "object" ? m : null;
    } catch (error) {
        return null;
    }
}

function prepararMandosFlotantesDeMapa(mando) {
    const menu = mando.caja.querySelector("[data-mapa-mandos]");
    if (!menu) {
        return;
    }
    mando.flotantes = true;
    menu.id = menu.id || "mapa-mandos";
    const zoom = menu.querySelector(".mapa-zoom");
    const cuerpo = document.createElement("div");
    cuerpo.className = "mapa-mandos-cuerpo";
    cuerpo.id = "mapa-mandos-cuerpo";
    [...menu.children].forEach((hijo) => {
        if (hijo !== zoom) {
            cuerpo.appendChild(hijo);
        }
    });
    const cabeza = document.createElement("div");
    cabeza.className = "mapa-mandos-cabeza";
    const titulo = document.createElement("span");
    titulo.className = "mapa-capas-titulo mapa-mandos-titulo";
    titulo.textContent = "mandos";
    const plegar = document.createElement("button");
    plegar.type = "button";
    plegar.className = "mapa-boton";
    plegar.setAttribute("aria-controls", cuerpo.id);
    const cerrar = document.createElement("button");
    cerrar.type = "button";
    cerrar.className = "mapa-boton";
    cerrar.setAttribute("aria-label", "Cerrar los mandos");
    cerrar.textContent = "×";
    cabeza.appendChild(titulo);
    cabeza.appendChild(plegar);
    cabeza.appendChild(cerrar);
    menu.prepend(cabeza);
    menu.appendChild(cuerpo);
    menu.setAttribute("role", "region");
    menu.setAttribute("aria-label", "Mandos del mapa");
    // El botón para traerlos de vuelta, en la esquina del mapa.
    const abrir = document.createElement("button");
    abrir.type = "button";
    abrir.className = "mapa-boton mapa-mandos-abrir";
    abrir.setAttribute("aria-controls", menu.id);
    abrir.innerHTML = '<span aria-hidden="true">☰</span> mandos';
    abrir.hidden = true;
    menu.after(abrir);

    const memoria = memoriaDeMandosDeMapa();
    const estado = {
        // De salida, plegados (con la cabecera y el zoom): desplegados
        // tapan un buen trozo del mapa. Luego, como se dejaron.
        plegado: memoria ? !!memoria.plegado : true,
        cerrado: memoria ? !!memoria.cerrado : false,
    };
    const apuntar = () => {
        try {
            window.localStorage.setItem(MEMORIA_DE_MANDOS_DE_MAPA, JSON.stringify(estado));
        } catch (error) {
            // Se recuerda mientras esté abierta la página.
        }
    };
    const poner = () => {
        cuerpo.hidden = estado.plegado;
        plegar.setAttribute("aria-expanded", estado.plegado ? "false" : "true");
        plegar.setAttribute("aria-label", estado.plegado ? "Desplegar los mandos" : "Plegar los mandos");
        plegar.textContent = estado.plegado ? "▸" : "▾";
        menu.hidden = estado.cerrado;
        abrir.hidden = !estado.cerrado;
        abrir.setAttribute("aria-expanded", estado.cerrado ? "false" : "true");
        alturaDelMenuDeMapa(mando);
    };
    plegar.addEventListener("click", () => {
        estado.plegado = !estado.plegado;
        apuntar();
        poner();
    });
    cerrar.addEventListener("click", () => {
        estado.cerrado = true;
        apuntar();
        poner();
        abrir.focus();
    });
    abrir.addEventListener("click", () => {
        estado.cerrado = false;
        apuntar();
        poner();
        plegar.focus();
    });
    poner();
}


// =========================================
// A PANTALLA COMPLETA
// =========================================
// Un botón junto al zoom: la caja del mapa pasa a ocupar toda la ventana
// (position: fixed, por encima de todo; la página de detrás no se mueve)
// y el mapa, todo lo alto. Esc (o el mismo botón) vuelve. No usa la
// pantalla completa del navegador: así funciona igual en todos y no
// esconde la barra de tareas sin avisar.

function prepararPantallaCompletaDeMapa(mando) {
    const zoom = mando.caja.querySelector(".mapa-zoom");
    if (!zoom) {
        return;
    }
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "mapa-boton mapa-boton-ancho";
    boton.setAttribute("aria-pressed", "false");
    boton.innerHTML = '<span aria-hidden="true">⛶</span> pantalla completa';
    zoom.appendChild(boton);
    const poner = (si) => {
        mando.caja.classList.toggle("es-pantalla-completa", si);
        document.documentElement.classList.toggle("con-mapa-a-pantalla", si);
        boton.setAttribute("aria-pressed", si ? "true" : "false");
        boton.innerHTML = si ? '<span aria-hidden="true">⛶</span> salir de pantalla completa'
            : '<span aria-hidden="true">⛶</span> pantalla completa';
        mando.aPantalla = si;
        const antes = mando.zoom;
        rehacerMapa(mando);
        ponerZoomDeMapa(mando, antes);
    };
    boton.addEventListener("click", () => poner(!mando.aPantalla));
    document.addEventListener("keydown", (evento) => {
        if (evento.key !== "Escape" || !mando.aPantalla || evento.defaultPrevented) {
            return;
        }
        // Primero se cierra lo que esté abierto encima (la leyenda, la
        // ruta): eso lo hacen ellos, y marcan el Esc como usado.
        poner(false);
        boton.focus();
    });
}


// UN MARGEN ALREDEDOR DEL DIBUJO: así el mapa se puede llevar más allá
// de sus bordes (lo de fuera se queda del color del fondo) y un sitio de la
// orilla se puede poner en medio de la ventana. Un tercio de la ventana
// por cada lado. TAMBIÉN AL 100% con ratón: el mapa sale entero y
// centrado (centrarMapa), y se arrastra igual. En pantallas táctiles, al
// 100% no: ahí el dedo tiene que mover la página, no el mapa.
//
// Para que al 100% se siga viendo el mapa entero, la ventana mide lo que
// el dibujo a ese tamaño (si no, el margen de arriba y abajo la estiraría
// hasta su tope y saldrían dos franjas vacías); y con zoom no cambia de
// alto, así que el mapa no salta al acercarse.
function conMargenDeMapa() {
    return !!(window.matchMedia && window.matchMedia("(pointer: fine)").matches);
}

function margenDeMapa(mando) {
    const lienzo = mando.lienzo;
    const lados = (mando.dibujo.getAttribute("viewBox") || "").split(/[\s,]+/);
    const ancho = parseFloat(lados[2]);
    const alto = parseFloat(lados[3]);
    const hay = mando.zoom > 1.0005 || conMargenDeMapa();
    if (mando.aPantalla) {
        // A pantalla completa, la ventana del mapa es la pantalla entera.
        lienzo.style.height = window.innerHeight + "px";
    } else if (hay && ancho && alto) {
        const tope = parseFloat(getComputedStyle(lienzo).maxHeight) || Infinity;
        const quiere = Math.min(lienzo.clientWidth * alto / ancho, tope);
        lienzo.style.height = Math.round(quiere) + "px";
        // Y lo que se coman las barras de desplazamiento, que si no el
        // dibujo entero no cabe por un pelo.
        const barras = lienzo.offsetHeight - lienzo.clientHeight;
        if (barras > 0) {
            lienzo.style.height = Math.round(Math.min(quiere + barras, tope)) + "px";
        }
    } else {
        lienzo.style.height = "";
    }
    const margen = hay ? { x: Math.round(lienzo.clientWidth / 3), y: Math.round(lienzo.clientHeight / 3) } : { x: 0, y: 0 };
    mando.margen = margen;
    mando.dibujo.style.margin = margen.y + "px " + margen.x + "px";
    return margen;
}

// El mapa entero en medio de la ventana (al empezar y al «ajustar»).
function centrarMapa(mando) {
    const m = mando.margen || { x: 0, y: 0 };
    const caja = mando.dibujo.getBoundingClientRect();
    const lienzo = mando.lienzo;
    lienzo.scrollLeft = m.x + (caja.width - lienzo.clientWidth) / 2;
    lienzo.scrollTop = m.y + (caja.height - lienzo.clientHeight) / 2;
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
    // Las rayas, por grupos: caminos, ríos y otras, cada uno con su casilla.
    caja.querySelectorAll("[data-mapa-lineas]").forEach((casilla) => {
        const grupo = casilla.getAttribute("data-mapa-lineas");
        if (/^[a-z]+$/.test(grupo)) {
            apagarConCasilla(caja, '[data-mapa-lineas="' + grupo + '"]', ".mapa-lineas.es-" + grupo);
        }
    });
    apagarConCasilla(caja, "[data-mapa-nombres]", ".mapa-textos");
    apagarConCasilla(caja, "[data-mapa-zonas-regionales]", ".mapa-zonas-regionales");
    apagarConCasilla(caja, "[data-mapa-rosa]", ".mapa-rosa");
    prepararNivelesDeMapa(caja);
    prepararZonasDeMapa(caja);
}

// LAS ZONAS, UNA A UNA O POR CLASES. Un desplegable («zonas») con una
// casilla por clase de zona (lagos, bosques, países vecinos…) y, debajo de
// cada una, otra por cada zona con nombre: se apagan sueltas o la clase
// entera (también las de sin nombre, que son dibujo). Si una clase tiene
// unas sí y otras no, su casilla sale a medias.
// (Las clases y sus nombres, en CLASES_DE_ZONA_DE_MAPA, arriba del todo.)

function prepararZonasDeMapa(caja) {
    const desplegable = caja.querySelector("[data-mapa-zonas]");
    const dentro = caja.querySelector("[data-mapa-zonas-dentro]");
    if (!desplegable || !dentro) {
        return;
    }
    const formas = [...caja.querySelectorAll(".mapa-forma[data-mapa-zona]")];
    let cuantas = 0;
    CLASES_DE_ZONA_DE_MAPA.forEach(([clase, nombre]) => {
        const suyas = formas.filter((f) => f.getAttribute("data-mapa-zona") === clase);
        // Las de sin nombre de esa clase (el dibujo y su trama).
        const dibujo = clase === "otra"
            ? [...caja.querySelectorAll(".mapa-dibujos > .mapa-dibujo:not([class*='es-zona-'])")]
            : [...caja.querySelectorAll(".mapa-dibujos > .es-zona-" + clase + ", .mapa-zonas-regionales > .es-zona-" + clase)];
        if (!suyas.length && !dibujo.length) {
            return;
        }
        cuantas += 1;
        const grupo = document.createElement("div");
        grupo.className = "mapa-zonas-grupo";
        const todas = document.createElement("label");
        todas.className = "mapa-capa-casilla es-clase";
        const casillaClase = document.createElement("input");
        casillaClase.type = "checkbox";
        casillaClase.checked = true;
        todas.appendChild(casillaClase);
        todas.appendChild(document.createTextNode(" " + nombre + " (" + (suyas.length + dibujo.length) + ")"));
        grupo.appendChild(todas);
        const sueltas = [];
        // Una forma puede salir dos veces (si lleva a una página y a otro
        // mapa), así que se agrupan por su nombre.
        const porNombre = new Map();
        suyas.forEach((f) => {
            const n = f.getAttribute("data-mapa-nombre") || "";
            if (!porNombre.has(n)) {
                porNombre.set(n, []);
            }
            porNombre.get(n).push(f);
        });
        const lista = document.createElement("ul");
        lista.className = "mapa-zonas-lista";
        [...porNombre.keys()].sort((a, b) => a.localeCompare(b, "es")).forEach((n) => {
            const li = document.createElement("li");
            const etiqueta = document.createElement("label");
            etiqueta.className = "mapa-capa-casilla";
            const casilla = document.createElement("input");
            casilla.type = "checkbox";
            casilla.checked = true;
            etiqueta.appendChild(casilla);
            etiqueta.appendChild(document.createTextNode(" " + n));
            li.appendChild(etiqueta);
            lista.appendChild(li);
            sueltas.push({ casilla, formas: porNombre.get(n) });
        });
        if (sueltas.length) {
            grupo.appendChild(lista);
        }
        dentro.appendChild(grupo);
        const ponerClase = () => {
            const encendidas = sueltas.filter((s) => s.casilla.checked).length;
            casillaClase.indeterminate = sueltas.length > 0 && encendidas > 0 && encendidas < sueltas.length;
            if (sueltas.length) {
                casillaClase.checked = encendidas === sueltas.length;
            }
        };
        sueltas.forEach((s) => {
            s.casilla.addEventListener("change", () => {
                s.formas.forEach((f) => f.classList.toggle("es-oculta", !s.casilla.checked));
                ponerClase();
            });
        });
        casillaClase.addEventListener("change", () => {
            const si = casillaClase.checked;
            casillaClase.indeterminate = false;
            sueltas.forEach((s) => {
                s.casilla.checked = si;
                s.formas.forEach((f) => f.classList.toggle("es-oculta", !si));
            });
            dibujo.forEach((d) => d.classList.toggle("es-oculta", !si));
        });
    });
    desplegable.hidden = cuantas === 0;
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
// LOS SITIOS: CÓMO SE VEN Y CUÁLES
// =========================================
// En los mandos, un grupo «sitios»: si se ven con su símbolo y su nombre,
// solo el símbolo o solo el nombre; un desplegable «tipos de sitio» con
// una casilla por cada tipo que haya en el mapa (con cuántos); y un atajo,
// «solo países y capitales», que deja los países y solo las capitales (y
// vuelve a dejarlo todo al pulsarlo otra vez). Lo hacen clases: en el
// lienzo, pines-solo-simbolo y pines-solo-nombre; en cada pin que no
// toca, es-filtrada.

function tipoDePinDeMapa(pin) {
    const tipo = TIPOS_DE_SITIO_DE_MAPA.find(([clave]) => clave && pin.classList.contains("es-" + clave));
    return tipo ? tipo[0] : "";
}

function prepararFiltrosDeSitiosDeMapa(mando) {
    const menu = mando.caja.querySelector(".mapa-mandos-cuerpo") || mando.caja.querySelector("[data-mapa-mandos]");
    const pines = [...mando.dibujo.querySelectorAll(".mapa-pin")];
    if (!menu || !pines.length) {
        return;
    }
    const lienzo = mando.lienzo;
    const grupo = document.createElement("fieldset");
    grupo.className = "mapa-capas mapa-filtro-sitios";
    const leyenda = document.createElement("legend");
    leyenda.className = "mapa-capas-titulo";
    leyenda.textContent = "sitios";
    grupo.appendChild(leyenda);
    const casilla = (tipo, nombre, valor, marcada, texto) => {
        const etiqueta = document.createElement("label");
        etiqueta.className = "mapa-capa-casilla";
        const entrada = document.createElement("input");
        entrada.type = tipo;
        if (nombre) {
            entrada.name = nombre;
        }
        entrada.value = valor;
        entrada.checked = marcada;
        etiqueta.appendChild(entrada);
        etiqueta.appendChild(document.createTextNode(" " + texto));
        return { etiqueta, entrada };
    };
    // Cómo se ven.
    const como = [["ambos", "símbolo y nombre"], ["simbolo", "solo el símbolo"], ["nombre", "solo el nombre"]]
        .map(([valor, texto], i) => casilla("radio", "mapa-pines-como", valor, i === 0, texto));
    como.forEach(({ etiqueta, entrada }) => {
        grupo.appendChild(etiqueta);
        entrada.addEventListener("change", () => {
            lienzo.classList.toggle("pines-solo-simbolo", entrada.value === "simbolo" && entrada.checked);
            lienzo.classList.toggle("pines-solo-nombre", entrada.value === "nombre" && entrada.checked);
        });
    });
    // Cuáles: por tipos.
    const porTipo = new Map();
    pines.forEach((pin) => {
        const tipo = tipoDePinDeMapa(pin);
        porTipo.set(tipo, (porTipo.get(tipo) || 0) + 1);
    });
    const tipos = TIPOS_DE_SITIO_DE_MAPA.filter(([clave]) => porTipo.has(clave));
    const casillasDeTipo = [];
    const aplicar = () => {
        const fuera = new Set(casillasDeTipo.filter((c) => !c.checked).map((c) => c.value));
        pines.forEach((pin) => pin.classList.toggle("es-filtrada", fuera.has(tipoDePinDeMapa(pin))));
    };
    if (tipos.length > 1) {
        const desplegable = document.createElement("details");
        desplegable.className = "mapa-zonas mapa-tipos-de-sitio";
        const resumen = document.createElement("summary");
        resumen.className = "mapa-capas-titulo";
        resumen.textContent = "tipos de sitio";
        desplegable.appendChild(resumen);
        const dentro = document.createElement("div");
        dentro.className = "mapa-zonas-dentro";
        tipos.forEach(([clave, plural]) => {
            const { etiqueta, entrada } = casilla("checkbox", "", clave, true, plural + " (" + porTipo.get(clave) + ")");
            entrada.addEventListener("change", aplicar);
            casillasDeTipo.push(entrada);
            dentro.appendChild(etiqueta);
        });
        desplegable.appendChild(dentro);
        grupo.appendChild(desplegable);
    }
    // El atajo: solo los países y las capitales.
    if (porTipo.has("capital") && casillasDeTipo.length) {
        const atajo = document.createElement("button");
        atajo.type = "button";
        atajo.className = "mapa-boton mapa-boton-ancho";
        atajo.setAttribute("aria-pressed", "false");
        atajo.textContent = "solo países y capitales";
        atajo.addEventListener("click", () => {
            const si = atajo.getAttribute("aria-pressed") !== "true";
            atajo.setAttribute("aria-pressed", si ? "true" : "false");
            casillasDeTipo.forEach((c) => {
                c.checked = !si || c.value === "capital";
            });
            aplicar();
            const paises = mando.caja.querySelector('[data-mapa-nivel-casilla][value="paises"]');
            if (si && paises && !paises.checked) {
                paises.checked = true;
                paises.dispatchEvent(new Event("change"));
            }
        });
        grupo.appendChild(atajo);
    }
    const ver = menu.querySelector(".mapa-capas");
    if (ver) {
        ver.after(grupo);
    } else {
        menu.appendChild(grupo);
    }
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
    const cuanto = Math.max(0.05, Math.min(8, (mando.pin || PIN_EN_PANTALLA) / (radio * porUnidad)));
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
//
// Y si la capa tiene además una versión MÁXIMA (data-mapa-maxima: hasta
// 8192 de lado, solo cuando la original es mucho más grande, como un
// mapamundi ampliado con IA), al acercarse más allá de lo que da la de
// 2560 se cambia por esa, del mismo modo.
function mejorarImagenDeMapa(mando) {
    const pide = mando.lienzo.clientWidth * (mando.zoom || 1) * (window.devicePixelRatio || 1);
    mando.lienzo.querySelectorAll(".mapa-capa-img").forEach((imagen) => {
        if (imagen.dataset.mapaCambiando) {
            return;
        }
        let cual = "";
        if (imagen.hasAttribute("data-mapa-grande") && pide > 1280 * 1.15) {
            cual = "data-mapa-grande";
        } else if (!imagen.hasAttribute("data-mapa-grande") && imagen.hasAttribute("data-mapa-maxima")
            && pide > 2560 * 1.15) {
            cual = "data-mapa-maxima";
        }
        const otra = cual ? banderaSeguraDeMapa(imagen.getAttribute(cual)) : "";
        if (!otra) {
            return;
        }
        imagen.dataset.mapaCambiando = "1";
        const antes = new Image();
        antes.onload = () => {
            imagen.setAttribute("href", otra);
            imagen.removeAttribute(cual);
            delete imagen.dataset.mapaCambiando;
            // Si ya se está más cerca de lo que da esta, la siguiente.
            mejorarImagenDeMapa(mando);
        };
        antes.onerror = () => {
            delete imagen.dataset.mapaCambiando;
        };
        antes.src = otra;
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
    // Puede ser más alta que el mapa y desplazarse: así se llega con el
    // teclado (y se desplaza con las flechas).
    panel.tabIndex = 0;
    // Arriba a la derecha DEL MAPA: con los mandos encima (pantallas
    // estrechas) o al lado (anchas), lo que mida el lienzo desde arriba.
    const colocar = () => {
        panel.style.top = (mando.lienzo.offsetTop + 10) + "px";
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
            evento.preventDefault();
            poner(false);
            boton.focus();
        }
    });
}


// =========================================
// LA RUTA POR LOS CAMINOS
// =========================================
// El SVG trae la red de caminos (data-mapa-red, la hace
// _red_de_caminos en mundo_mapas.py): los puntos ("p": x, y, x, y…), los
// tramos ("a": de qué punto a qué punto) y los sitios con nombre que están
// en ella ("s": [punto, nombre, id del sitio]). Con el botón «ruta» se abre
// un panel arriba a la izquierda con dos listas, desde y hasta (o se
// pulsan dos sitios en el mapa), y se pinta el camino más corto (Dijkstra)
// con lo que mide, los días de viaje si el mapa tiene escala y los sitios
// por los que se pasa, que es lo que lo hace útil también sin verlo.

function leerRedDeMapa(dibujo) {
    try {
        const red = JSON.parse(dibujo.getAttribute("data-mapa-red") || "null");
        if (!red || !Array.isArray(red.p) || !Array.isArray(red.a) || !Array.isArray(red.s)) {
            return null;
        }
        const cuantos = Math.floor(red.p.length / 2);
        const vecinos = Array.from({ length: cuantos }, () => []);
        for (let i = 0; i + 1 < red.a.length; i += 2) {
            const a = red.a[i];
            const b = red.a[i + 1];
            if (a < cuantos && b < cuantos) {
                const largo = Math.hypot(red.p[2 * a] - red.p[2 * b], red.p[2 * a + 1] - red.p[2 * b + 1]);
                vecinos[a].push([b, largo]);
                vecinos[b].push([a, largo]);
            }
        }
        return { p: red.p, vecinos, sitios: red.s.filter((s) => Array.isArray(s) && s[0] < cuantos) };
    } catch (error) {
        return null;
    }
}

// El camino más corto de un punto a otro: la lista de puntos y lo que mide
// (en píxeles del mapa), o null si no hay.
function caminoMasCortoDeMapa(red, desde, hasta) {
    const lejos = new Array(red.vecinos.length).fill(Infinity);
    const antes = new Array(red.vecinos.length).fill(-1);
    const hecho = new Array(red.vecinos.length).fill(false);
    lejos[desde] = 0;
    // Un montón (de lo más cercano a lo más lejano) hecho a mano.
    const monton = [[0, desde]];
    const subir = () => {
        let i = monton.length - 1;
        while (i > 0) {
            const padre = (i - 1) >> 1;
            if (monton[padre][0] <= monton[i][0]) {
                break;
            }
            [monton[padre], monton[i]] = [monton[i], monton[padre]];
            i = padre;
        }
    };
    const sacar = () => {
        const primero = monton[0];
        const ultimo = monton.pop();
        if (monton.length) {
            monton[0] = ultimo;
            let i = 0;
            for (;;) {
                const a = 2 * i + 1;
                const b = a + 1;
                let menor = i;
                if (a < monton.length && monton[a][0] < monton[menor][0]) {
                    menor = a;
                }
                if (b < monton.length && monton[b][0] < monton[menor][0]) {
                    menor = b;
                }
                if (menor === i) {
                    break;
                }
                [monton[menor], monton[i]] = [monton[i], monton[menor]];
                i = menor;
            }
        }
        return primero;
    };
    while (monton.length) {
        const [d, n] = sacar();
        if (hecho[n]) {
            continue;
        }
        hecho[n] = true;
        if (n === hasta) {
            break;
        }
        red.vecinos[n].forEach(([m, largo]) => {
            if (d + largo < lejos[m]) {
                lejos[m] = d + largo;
                antes[m] = n;
                monton.push([lejos[m], m]);
                subir();
            }
        });
    }
    if (!Number.isFinite(lejos[hasta])) {
        return null;
    }
    const puntos = [];
    for (let n = hasta; n !== -1; n = antes[n]) {
        puntos.unshift(n);
    }
    return { puntos, largo: lejos[hasta] };
}

// LOS DOS EXTREMOS DE LA RUTA. Cada uno es { nodo, nombre, x, y, campo }:
// el punto de la red donde se engancha, cómo se llama, dónde está, y lo
// que hay campo a través hasta el camino (0 si es un sitio de la red).
// Se eligen escribiendo (un buscador con la lista de los sitios: se
// escribe un trozo y sale lo que coincide) o pulsando en el mapa: un sitio,
// o CUALQUIER punto, que se engancha al punto de camino más cercano.

function puntoDelMapaDeMapa(mando, evento) {
    const svg = mando.dibujo;
    const matriz = svg.getScreenCTM && svg.getScreenCTM();
    if (!matriz) {
        return null;
    }
    const punto = svg.createSVGPoint();
    punto.x = evento.clientX;
    punto.y = evento.clientY;
    const p = punto.matrixTransform(matriz.inverse());
    return { x: p.x, y: p.y };
}

function nodoMasCercanoDeMapa(red, x, y) {
    let mejor = -1;
    let lejos = Infinity;
    for (let n = 0; n < red.vecinos.length; n++) {
        if (!red.vecinos[n].length) {
            continue;
        }
        const d = Math.hypot(red.p[2 * n] - x, red.p[2 * n + 1] - y);
        if (d < lejos) {
            lejos = d;
            mejor = n;
        }
    }
    return mejor < 0 ? null : { nodo: mejor, lejos };
}

function prepararRutaDeMapa(mando) {
    const boton = mando.caja.querySelector("[data-mapa-ruta-boton]");
    const red = leerRedDeMapa(mando.dibujo);
    if (!boton || !red || red.sitios.length < 2) {
        return;
    }
    boton.hidden = false;
    const radio = parseFloat(mando.dibujo.getAttribute("data-mapa-radio")) || 10;

    // EL PANEL, en los mandos, justo debajo del botón. Lo hace esto: sin
    // JavaScript no hay rutas que calcular.
    const panel = document.createElement("section");
    panel.className = "mapa-ruta";
    panel.id = "mapa-ruta";
    panel.hidden = true;
    panel.setAttribute("aria-labelledby", "mapa-ruta-titulo");
    const titulo = document.createElement("h2");
    titulo.className = "mapa-sitios-titulo";
    titulo.id = "mapa-ruta-titulo";
    titulo.textContent = "Ruta por los caminos";
    panel.appendChild(titulo);
    const ayuda = document.createElement("p");
    ayuda.className = "mapa-ruta-salida";
    ayuda.textContent = "Escribe de dónde a dónde (sale la lista de sitios), o pulsa dos puntos en el mapa:"
        + " un sitio o cualquier sitio, que se va al camino más cercano.";
    panel.appendChild(ayuda);
    // La lista de los sitios con nombre, para los dos buscadores (sin
    // repetidos: un sitio puede estar en la red dos veces).
    const nombres = new Map();
    red.sitios.forEach((s) => {
        if (!nombres.has(s[1].toLowerCase())) {
            nombres.set(s[1].toLowerCase(), s);
        }
    });
    const opciones = document.createElement("datalist");
    opciones.id = "mapa-ruta-sitios";
    [...nombres.values()].sort((a, b) => a[1].localeCompare(b[1], "es")).forEach((s) => {
        const opcion = document.createElement("option");
        opcion.value = s[1];
        opciones.appendChild(opcion);
    });
    panel.appendChild(opciones);
    const buscador = (texto, id) => {
        const etiqueta = document.createElement("label");
        etiqueta.className = "mapa-ruta-campo";
        etiqueta.htmlFor = id;
        etiqueta.textContent = texto;
        const entrada = document.createElement("input");
        entrada.id = id;
        entrada.type = "search";
        entrada.setAttribute("list", opciones.id);
        entrada.autocomplete = "off";
        entrada.spellcheck = false;
        entrada.placeholder = "escribe un sitio…";
        etiqueta.appendChild(entrada);
        panel.appendChild(etiqueta);
        return entrada;
    };
    const desde = buscador("Desde", "mapa-ruta-desde");
    const hasta = buscador("Hasta", "mapa-ruta-hasta");
    const botones = document.createElement("div");
    botones.className = "mapa-ruta-botones";
    const alReves = document.createElement("button");
    alReves.type = "button";
    alReves.className = "mapa-boton mapa-boton-ancho";
    alReves.textContent = "⇅ al revés";
    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "mapa-boton mapa-boton-ancho";
    quitar.textContent = "quitar la ruta";
    botones.appendChild(alReves);
    botones.appendChild(quitar);
    panel.appendChild(botones);
    const salida = document.createElement("p");
    salida.className = "mapa-ruta-salida";
    salida.setAttribute("role", "status");
    panel.appendChild(salida);
    boton.after(panel);

    // Los extremos elegidos.
    const extremos = { desde: null, hasta: null };
    const deSitio = (s) => ({ nodo: s[0], nombre: s[1], x: red.p[2 * s[0]], y: red.p[2 * s[0] + 1], campo: 0 });
    const cercaDe = (x, y) => {
        let mejor = null;
        red.sitios.forEach((s) => {
            const d = Math.hypot(red.p[2 * s[0]] - x, red.p[2 * s[0] + 1] - y);
            if (!mejor || d < mejor.d) {
                mejor = { d, nombre: s[1] };
            }
        });
        return mejor ? mejor.nombre : "";
    };
    const deUnPunto = (x, y) => {
        const cerca = nodoMasCercanoDeMapa(red, x, y);
        if (!cerca) {
            return null;
        }
        const junto = cercaDe(x, y);
        return { nodo: cerca.nodo, nombre: "un punto del mapa" + (junto ? " (cerca de " + junto + ")" : ""), x, y,
            campo: cerca.lejos };
    };
    const leerBuscador = (entrada, cual) => {
        const valor = entrada.value.trim().toLowerCase();
        if (!valor) {
            extremos[cual] = null;
            return;
        }
        const s = nombres.get(valor);
        if (s) {
            extremos[cual] = deSitio(s);
        } else if (!(extremos[cual] && extremos[cual].nombre.toLowerCase() === valor)) {
            extremos[cual] = null;
        }
    };

    let dibujoDeRuta = null;
    const borrarDibujo = () => {
        if (dibujoDeRuta) {
            dibujoDeRuta.remove();
            dibujoDeRuta = null;
        }
    };
    const distanciaEscrita = (pixeles) => {
        const e = mando.escala;
        return e ? cifraDeMapa(pixeles * e.porPixel) + (e.unidad ? " " + e.unidad : "") : "";
    };

    const pintar = () => {
        borrarDibujo();
        const a = extremos.desde;
        const b = extremos.hasta;
        quitar.disabled = !a && !b && !desde.value && !hasta.value;
        alReves.disabled = !a || !b;
        if (!a || !b) {
            const escrito = (desde.value.trim() && !a) || (hasta.value.trim() && !b);
            salida.textContent = escrito ? "No encuentro ese sitio: elige uno de la lista que sale al escribir."
                : (a || b ? "Ahora el otro extremo." : "");
            return;
        }
        if (a.nodo === b.nodo && !a.campo && !b.campo) {
            salida.textContent = "Elige dos sitios distintos.";
            return;
        }
        const camino = a.nodo === b.nodo ? { puntos: [a.nodo], largo: 0 } : caminoMasCortoDeMapa(red, a.nodo, b.nodo);
        if (!camino) {
            salida.textContent = "No hay camino de " + a.nombre + " a " + b.nombre + " por los caminos del mapa.";
            return;
        }
        // El dibujo, debajo de los sitios (que se sigan viendo y pulsando):
        // la ruta y, a trazos, lo de campo a través hasta el camino.
        const g = svgDeMapa("g", { class: "mapa-ruta-dibujo" });
        const d = camino.puntos.map((n, i) => (i ? "L" : "M") + red.p[2 * n] + " " + red.p[2 * n + 1]).join("");
        g.appendChild(svgDeMapa("path", { d, class: "mapa-ruta-borde" }));
        g.appendChild(svgDeMapa("path", { d, class: "mapa-ruta-raya" }));
        [a, b].forEach((x) => {
            if (x.campo > 0) {
                g.appendChild(svgDeMapa("path", { class: "mapa-ruta-campo",
                    d: "M" + x.x + " " + x.y + "L" + red.p[2 * x.nodo] + " " + red.p[2 * x.nodo + 1] }));
            }
        });
        [[a, ""], [b, " es-final"]].forEach(([x, clase]) => {
            const xy = x.x + "," + x.y;
            g.appendChild(svgDeMapa("circle", { r: (radio * 0.5).toFixed(1), class: "mapa-ruta-punto" + clase,
                "data-mapa-xy": xy, transform: "translate(" + xy + ")" }));
        });
        const pines = mando.dibujo.querySelector(".mapa-pines");
        mando.dibujo.insertBefore(g, pines || null);
        dibujoDeRuta = g;
        escalarPinesDeMapa(mando);
        // Lo que se dice: cuánto, cuántos días y por dónde se pasa.
        const campo = a.campo + b.campo;
        let texto = "De " + a.nombre + " a " + b.nombre + " por los caminos";
        const e = mando.escala;
        if (e) {
            const distancia = (camino.largo + campo) * e.porPixel;
            texto += ": " + cifraDeMapa(distancia) + (e.unidad ? " " + e.unidad : "")
                + (campo > 0 ? " (" + distanciaEscrita(campo) + " campo a través hasta el camino)" : "") + ".";
            const viaje = Object.keys(e.viaje).filter((como) => e.viaje[como] > 0);
            if (viaje.length) {
                texto += " " + viaje.map((como) => como.charAt(0).toUpperCase() + como.slice(1) + ": "
                    + diasDeViajeDeMapa(distancia, e.viaje[como])).join(" · ") + ".";
            }
        } else {
            texto += ".";
        }
        const enMedio = new Map();
        red.sitios.forEach((s) => {
            if (s[0] !== a.nodo && s[0] !== b.nodo && !enMedio.has(s[0])) {
                enMedio.set(s[0], s[1]);
            }
        });
        const paso = camino.puntos.filter((n) => enMedio.has(n)).map((n) => enMedio.get(n));
        texto += paso.length ? " Se pasa por " + paso.join(", ") + "." : " Sin pasar por ningún otro sitio.";
        salida.textContent = texto;
    };

    const medir = mando.caja.querySelector("[data-mapa-medir]");
    // ENCENDIDA O APAGADA: apagada, se cierra el panel y la ruta pintada
    // se esconde (no se pierde: al encenderla vuelve).
    const abrir = (si) => {
        panel.hidden = !si;
        boton.setAttribute("aria-pressed", si ? "true" : "false");
        mando.lienzo.classList.toggle("esta-trazando-ruta", si);
        if (dibujoDeRuta) {
            dibujoDeRuta.classList.toggle("es-apagada", !si);
        }
        // Midiendo y trazando a la vez, cada clic serían las dos cosas.
        if (si && medir && medir.getAttribute("aria-pressed") === "true") {
            medir.click();
        }
        alturaDelMenuDeMapa(mando);
    };
    boton.addEventListener("click", () => {
        abrir(panel.hidden);
        if (!panel.hidden) {
            desde.focus();
        }
    });
    if (medir) {
        medir.addEventListener("click", () => {
            if (medir.getAttribute("aria-pressed") === "true" && !panel.hidden) {
                abrir(false);
            }
        });
    }
    [[desde, "desde"], [hasta, "hasta"]].forEach(([entrada, cual]) => {
        entrada.addEventListener("input", () => {
            leerBuscador(entrada, cual);
            if (extremos[cual] || !entrada.value) {
                pintar();
            }
        });
        entrada.addEventListener("change", () => {
            leerBuscador(entrada, cual);
            pintar();
        });
    });
    alReves.addEventListener("click", () => {
        [extremos.desde, extremos.hasta] = [extremos.hasta, extremos.desde];
        [desde.value, hasta.value] = [hasta.value, desde.value];
        pintar();
    });
    quitar.addEventListener("click", () => {
        extremos.desde = null;
        extremos.hasta = null;
        desde.value = "";
        hasta.value = "";
        pintar();
        desde.focus();
    });
    mando.caja.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && !panel.hidden && panel.contains(document.activeElement)) {
            evento.preventDefault();
            abrir(false);
            boton.focus();
        }
    });
    // Con el panel abierto, pulsar en el mapa elige un extremo (el primero,
    // «desde»; el segundo, «hasta»; el tercero empieza otra) en vez de
    // llevar a la página del sitio. Un sitio de la red, ese; cualquier otro
    // punto, el camino más cercano. En captura, antes que el enlace.
    mando.lienzo.addEventListener("click", (evento) => {
        // (Un clic que es el final de un arrastre ya lo ha marcado como
        // usado prepararArrastreDeMapa: eso no elige nada.)
        if (panel.hidden || evento.defaultPrevented) {
            return;
        }
        const sitio = evento.target.closest ? evento.target.closest("[data-mapa-sitio]") : null;
        const cual = sitio ? sitio.getAttribute("data-mapa-sitio") : "";
        const enLaRed = cual ? red.sitios.find((s) => s[2] === cual) : null;
        let extremo = enLaRed ? deSitio(enLaRed) : null;
        if (!extremo) {
            const p = puntoDelMapaDeMapa(mando, evento);
            extremo = p ? deUnPunto(p.x, p.y) : null;
        }
        if (!extremo) {
            return;
        }
        evento.preventDefault();
        evento.stopPropagation();
        if (!extremos.desde || extremos.hasta) {
            extremos.desde = extremo;
            extremos.hasta = null;
            desde.value = extremo.nombre;
            hasta.value = "";
        } else {
            extremos.hasta = extremo;
            hasta.value = extremo.nombre;
        }
        pintar();
    }, true);
    pintar();
}


// =========================================
// LAS MIGAS, FIJAS ARRIBA
// =========================================
// Al bajar por la página, las migas (Wiki Cralëa › … › Reino de Prunia ›
// Mapa) se quedan arriba, para poder volver al país en cualquier momento.
// Sin sticky (no va en el navegador de Richi): cuando su sitio se sale
// por arriba, pasan a position: fixed en lo alto de la caja que se
// desplaza (.home), con su ancho; y dejan en su sitio un hueco de su alto
// para que lo de debajo no salte.

function fijarMigasDeMapa() {
    const migas = document.querySelector(".mundo-migas");
    if (!migas) {
        return;
    }
    const home = migas.closest(".home");
    const hueco = document.createElement("div");
    hueco.className = "mundo-migas-hueco";
    migas.before(hueco);
    hueco.appendChild(migas);
    const colocar = () => {
        // Arriba del todo de lo que se ve: el borde de .home si es ella la
        // que se desplaza; si no (en un móvil se desplaza la página), la
        // ventana.
        const seDesplaza = home && home.scrollHeight > home.clientHeight + 1
            && /(auto|scroll)/.test(getComputedStyle(home).overflowY);
        const arriba = seDesplaza ? Math.max(0, home.getBoundingClientRect().top) : 0;
        const sitio = hueco.getBoundingClientRect();
        const fija = sitio.top < arriba;
        if (fija) {
            hueco.style.minHeight = migas.offsetHeight + "px";
            migas.classList.add("es-fija");
            migas.style.top = arriba + "px";
            migas.style.left = sitio.left + "px";
            // De lado a lado de la página (con el mismo margen a los dos
            // lados), no lo que mida su hueco, que es más estrecho.
            const caja = home ? home.getBoundingClientRect() : { left: 0, right: window.innerWidth };
            const margen = Math.max(0, sitio.left - caja.left);
            migas.style.width = Math.max(sitio.width, caja.right - caja.left - 2 * margen) + "px";
        } else {
            migas.classList.remove("es-fija");
            hueco.style.minHeight = "";
            migas.style.top = "";
            migas.style.left = "";
            migas.style.width = "";
        }
    };
    if (home) {
        home.addEventListener("scroll", colocar, { passive: true });
    }
    window.addEventListener("scroll", colocar, { passive: true });
    window.addEventListener("resize", colocar);
    colocar();
}
