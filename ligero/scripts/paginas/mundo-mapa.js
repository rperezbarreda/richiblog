/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/mundo-mapa.js
*/
const ZOOMS_DE_MAPA = [1, 1.5, 2, 3, 4, 6, 8, 12, 16];
const ZOOM_MAXIMO_DE_MAPA = 6;
const PIN_EN_PANTALLA = 15;
const TIPOS_DE_SITIO_DE_MAPA = [["capital", "capitales"], ["ciudad", "ciudades"], ["pueblo", "pueblos"],
    ["fortaleza", "fortalezas"], ["ruina", "ruinas"], ["puerto", "puertos"], ["templo", "templos"],
    ["torre", "torres"], ["cueva", "cuevas"], ["mina", "minas"], ["puente", "puentes"], ["batalla", "batallas"],
    ["mazmorra", "mazmorras"], ["campamento", "campamentos"], ["", "sin tipo"]];
const MEMORIA_DE_PANELES_DE_MAPA = "mapa-paneles";
const ANCHO_ESTRECHO_DE_MAPA = 700;
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
        cerca: parseFloat(dibujo.getAttribute("data-mapa-cerca")) || 2,
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
    lienzo.addEventListener("wheel", (evento) => {
        if (evento.shiftKey) {
            return;
        }
        const cuanto = ruedaDeMapa(evento);
        if (cuanto > 0 && mando.zoom <= 1.0005) {
            return;
        }
        evento.preventDefault();
        const paso = Math.max(0.5, Math.min(2, Math.exp(-cuanto / 500)));
        ponerZoomDeMapa(mando, mando.zoom * paso, evento.clientX, evento.clientY);
    }, { passive: false });
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
    window.addEventListener("resize", () => rehacerMapa(mando));
    prepararInterfazDeMapa(mando);
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
    prepararBuscadorDeMapa(mando);
    fijarMigasDeMapa();
    ponerZoomDeMapa(mando, 1);
    centrarMapa(mando);
}
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
function ponerZoomDeMapa(mando, quiere, anclaX, anclaY) {
    const lienzo = mando.lienzo;
    const antes = mando.zoom || 1;
    const ahora = Math.max(1, Math.min(mando.maximo || ZOOM_MAXIMO_DE_MAPA, quiere || 1));
    const caja = lienzo.getBoundingClientRect();
    const haciaX = anclaX === undefined ? lienzo.clientWidth / 2 : anclaX - caja.left;
    const haciaY = anclaY === undefined ? lienzo.clientHeight / 2 : anclaY - caja.top;
    const puntoX = lienzo.scrollLeft + haciaX;
    const puntoY = lienzo.scrollTop + haciaY;
    const antesMargen = mando.margen || { x: 0, y: 0 };
    mando.zoom = ahora;
    lienzo.style.setProperty("--mapa-zoom", ahora);
    const margen = margenDeMapa(mando);
    lienzo.classList.toggle("se-puede-arrastrar", ahora > 1.0005 || conMargenDeMapa());
    lienzo.classList.toggle("esta-cerca", ahora >= (mando.cerca || 2) - 0.005);
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
    const abajo = ahora <= 1.0005;
    if (mando.menos) {
        mando.menos.disabled = abajo;
    }
    if (mando.mas) {
        mando.mas.disabled = ahora >= (mando.maximo || ZOOM_MAXIMO_DE_MAPA) - 0.0005;
    }
    if (mando.ajustar) {
        mando.ajustar.disabled = abajo && !conMargenDeMapa();
    }
}
function alturaDelMenuDeMapa(mando) {
    const menu = mando.caja.querySelector("[data-mapa-mandos]");
    if (!menu) {
        return;
    }
    if (mando.interfaz) {
        const estrecha = window.innerWidth < ANCHO_ESTRECHO_DE_MAPA && !mando.aPantalla;
        mando.caja.classList.toggle("es-estrecha", estrecha);
        if (mando.pilaDeZoom) {
            mando.caja.insertBefore(mando.pilaDeZoom, estrecha ? mando.lienzo : mando.lienzo.nextSibling);
        }
        mando.caja.querySelectorAll(".mapa-panel").forEach((panel) => {
            panel.style.maxHeight = "";
            if (!estrecha && panel.colocarEnElMapa) {
                panel.colocarEnElMapa();
            }
        });
        return;
    }
    const alLado = menu.offsetTop === mando.lienzo.offsetTop && menu.offsetLeft < mando.lienzo.offsetLeft;
    menu.style.maxHeight = alLado ? Math.max(260, mando.lienzo.offsetHeight) + "px" : "";
}
function rehacerMapa(mando) {
    margenDeMapa(mando);
    alturaDelMenuDeMapa(mando);
    escalarPinesDeMapa(mando);
    mejorarImagenDeMapa(mando);
    pintarEscalaDeMapa(mando);
}
function memoriaDePanelesDeMapa() {
    try {
        const m = JSON.parse(window.localStorage.getItem(MEMORIA_DE_PANELES_DE_MAPA) || "null");
        return m && typeof m === "object" ? m : {};
    } catch (error) {
        return {};
    }
}
function apuntarPanelDeMapa(clave, sitio) {
    const m = memoriaDePanelesDeMapa();
    m[clave] = sitio;
    try {
        window.localStorage.setItem(MEMORIA_DE_PANELES_DE_MAPA, JSON.stringify(m));
    } catch (error) {
    }
}
function botonDeMapa(clase, icono, texto, soloIcono) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = clase;
    const dibujo = document.createElement("span");
    dibujo.className = "mapa-icono";
    dibujo.setAttribute("aria-hidden", "true");
    dibujo.textContent = icono;
    boton.appendChild(dibujo);
    if (soloIcono) {
        boton.setAttribute("aria-label", texto);
        boton.title = texto;
    } else {
        boton.appendChild(document.createTextNode(texto));
    }
    return boton;
}
function hacerPanelDeMapa(mando, panel, clave, titulo, pastilla, alCambiar) {
    panel.classList.add("mapa-panel");
    panel.hidden = true;
    panel.setAttribute("role", "region");
    const cabeza = document.createElement("div");
    cabeza.className = "mapa-panel-cabeza";
    const asa = document.createElement("button");
    asa.type = "button";
    asa.className = "mapa-panel-asa";
    asa.setAttribute("aria-label", "Mover el panel «" + titulo + "» (arrástralo, o con las flechas)");
    asa.title = "Arrastra para moverlo";
    asa.textContent = "⠿";
    const nombre = document.createElement("h2");
    nombre.className = "mapa-panel-titulo";
    nombre.id = "mapa-panel-" + clave;
    nombre.textContent = titulo;
    const cerrar = document.createElement("button");
    cerrar.type = "button";
    cerrar.className = "mapa-panel-cerrar";
    cerrar.setAttribute("aria-label", "Cerrar «" + titulo + "»");
    cerrar.textContent = "×";
    cabeza.appendChild(asa);
    cabeza.appendChild(nombre);
    cabeza.appendChild(cerrar);
    const cuerpo = document.createElement("div");
    cuerpo.className = "mapa-panel-cuerpo";
    [...panel.childNodes].forEach((hijo) => cuerpo.appendChild(hijo));
    panel.appendChild(cabeza);
    panel.appendChild(cuerpo);
    panel.setAttribute("aria-labelledby", nombre.id);
    cuerpo.querySelectorAll(":scope > .mapa-sitios-titulo").forEach((h) => h.remove());
    const recordado = memoriaDePanelesDeMapa()[clave];
    const sitio = recordado && Number.isFinite(recordado.x) && Number.isFinite(recordado.y) ? recordado : null;
    const colocar = (x, y) => {
        const lienzo = mando.lienzo;
        const maxX = Math.max(0, lienzo.offsetLeft + lienzo.clientWidth - panel.offsetWidth - 6);
        const maxY = Math.max(0, lienzo.offsetTop + lienzo.clientHeight - Math.min(panel.offsetHeight, 120));
        const nx = Math.min(Math.max(lienzo.offsetLeft + 6, x), maxX);
        const ny = Math.min(Math.max(lienzo.offsetTop + 6, y), maxY);
        panel.style.left = nx + "px";
        panel.style.top = ny + "px";
        panel.style.right = "auto";
        panel.style.maxHeight = Math.max(140, lienzo.offsetTop + lienzo.clientHeight - ny - 8) + "px";
        return { x: nx, y: ny };
    };
    panel.colocarEnElMapa = () => {
        if (mando.caja.classList.contains("es-estrecha")) {
            panel.style.left = "";
            panel.style.top = "";
            panel.style.maxHeight = "";
            return;
        }
        if (panel.hidden) {
            return;
        }
        const arriba = mando.caja.querySelector(".mapa-ui-arriba");
        const salidaY = (arriba ? arriba.offsetTop + arriba.offsetHeight : mando.lienzo.offsetTop) + 8;
        const salidaX = clave === "leyenda" ? mando.lienzo.offsetLeft + mando.lienzo.clientWidth - panel.offsetWidth - 70
            : mando.lienzo.offsetLeft + 10;
        const actual = panel.dataset.x ? { x: Number(panel.dataset.x), y: Number(panel.dataset.y) } : sitio;
        const puesto = colocar(actual ? actual.x : salidaX, actual ? actual.y : (clave === "leyenda" ? 10 : salidaY));
        panel.dataset.x = puesto.x;
        panel.dataset.y = puesto.y;
    };
    let arrastre = null;
    cabeza.addEventListener("pointerdown", (evento) => {
        if (evento.button !== 0 || evento.target.closest(".mapa-panel-cerrar") || mando.caja.classList.contains("es-estrecha")) {
            return;
        }
        arrastre = { id: evento.pointerId, x: evento.clientX, y: evento.clientY,
            desdeX: panel.offsetLeft, desdeY: panel.offsetTop };
        try {
            cabeza.setPointerCapture(evento.pointerId);
        } catch (error) {
        }
        panel.classList.add("se-esta-moviendo");
        evento.preventDefault();
    });
    cabeza.addEventListener("pointermove", (evento) => {
        if (!arrastre || evento.pointerId !== arrastre.id) {
            return;
        }
        const puesto = colocar(arrastre.desdeX + evento.clientX - arrastre.x, arrastre.desdeY + evento.clientY - arrastre.y);
        panel.dataset.x = puesto.x;
        panel.dataset.y = puesto.y;
    });
    const soltar = () => {
        if (arrastre) {
            arrastre = null;
            panel.classList.remove("se-esta-moviendo");
            apuntarPanelDeMapa(clave, { x: Number(panel.dataset.x), y: Number(panel.dataset.y) });
        }
    };
    cabeza.addEventListener("pointerup", soltar);
    cabeza.addEventListener("pointercancel", soltar);
    asa.addEventListener("keydown", (evento) => {
        const flechas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (!flechas[evento.key] || mando.caja.classList.contains("es-estrecha")) {
            return;
        }
        evento.preventDefault();
        const paso = evento.shiftKey ? 60 : 20;
        const puesto = colocar(panel.offsetLeft + flechas[evento.key][0] * paso, panel.offsetTop + flechas[evento.key][1] * paso);
        panel.dataset.x = puesto.x;
        panel.dataset.y = puesto.y;
        apuntarPanelDeMapa(clave, puesto);
    });
    const poner = (abierto) => {
        panel.hidden = !abierto;
        if (pastilla) {
            pastilla.setAttribute("aria-expanded", abierto ? "true" : "false");
        }
        if (abierto) {
            alturaDelMenuDeMapa(mando);
            panel.colocarEnElMapa();
        }
        if (alCambiar) {
            alCambiar(abierto);
        }
    };
    if (pastilla) {
        pastilla.setAttribute("aria-controls", panel.id || (panel.id = "mapa-panel-de-" + clave));
        pastilla.setAttribute("aria-expanded", "false");
        pastilla.addEventListener("click", () => {
            poner(panel.hidden);
            if (!panel.hidden) {
                const primero = panel.querySelector("input, select, button:not(.mapa-panel-asa):not(.mapa-panel-cerrar), summary");
                (primero || cerrar).focus();
            }
        });
    }
    cerrar.addEventListener("click", () => {
        poner(false);
        if (pastilla) {
            pastilla.focus();
        }
    });
    panel.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") {
            evento.preventDefault();
            poner(false);
            if (pastilla) {
                pastilla.focus();
            }
        }
    });
    return poner;
}
function prepararInterfazDeMapa(mando) {
    const menu = mando.caja.querySelector("[data-mapa-mandos]");
    if (!menu) {
        return;
    }
    mando.interfaz = true;
    mando.caja.classList.add("con-interfaz");
    const arriba = document.createElement("div");
    arriba.className = "mapa-ui-arriba";
    const buscador = document.createElement("div");
    buscador.className = "mapa-buscador";
    buscador.setAttribute("role", "search");
    arriba.appendChild(buscador);
    const pastillas = document.createElement("div");
    pastillas.className = "mapa-pastillas";
    pastillas.setAttribute("role", "group");
    pastillas.setAttribute("aria-label", "Herramientas del mapa");
    arriba.appendChild(pastillas);
    mando.caja.insertBefore(arriba, mando.lienzo);
    mando.buscador = buscador;
    mando.pastillas = pastillas;
    const pila = document.createElement("div");
    pila.className = "mapa-ui-zoom";
    pila.setAttribute("role", "group");
    pila.setAttribute("aria-label", "Zoom del mapa");
    const ajustar = mando.ajustar;
    if (ajustar) {
        ajustar.className = "mapa-redondo";
        ajustar.innerHTML = '<span class="mapa-icono" aria-hidden="true">⤢</span>';
        ajustar.setAttribute("aria-label", "Ver el mapa entero");
        ajustar.title = "Ver el mapa entero (0)";
        pila.appendChild(ajustar);
    }
    if (mando.mas) {
        mando.mas.className = "mapa-redondo es-arriba";
        mando.mas.title = "Acercar (+)";
        pila.appendChild(mando.mas);
    }
    if (mando.cifra) {
        mando.cifra.className = "mapa-zoom-cifra";
        pila.appendChild(mando.cifra);
    }
    if (mando.menos) {
        mando.menos.className = "mapa-redondo es-abajo";
        mando.menos.title = "Alejar (−)";
        pila.appendChild(mando.menos);
    }
    mando.caja.insertBefore(pila, mando.lienzo.nextSibling);
    mando.pilaDeZoom = pila;
    const zoomViejo = menu.querySelector(".mapa-zoom");
    if (zoomViejo) {
        zoomViejo.remove();
    }
    const capas = botonDeMapa("mapa-pastilla", "◧", "capas");
    pastillas.appendChild(capas);
    const deLeyenda = menu.querySelector("[data-mapa-leyenda-boton]");
    if (deLeyenda) {
        deLeyenda.className = "mapa-pastilla";
        deLeyenda.innerHTML = '<span class="mapa-icono" aria-hidden="true">≡</span>leyenda';
        pastillas.appendChild(deLeyenda);
    }
    const medir = menu.querySelector(".mapa-medir");
    if (medir) {
        medir.querySelectorAll(".mapa-boton").forEach((b) => {
            b.className = "mapa-pastilla";
        });
        const deMedir = medir.querySelector("[data-mapa-medir]");
        if (deMedir) {
            deMedir.innerHTML = '<span class="mapa-icono" aria-hidden="true">📏</span>medir';
        }
        const borrar = medir.querySelector("[data-mapa-medir-borrar]");
        if (borrar) {
            borrar.innerHTML = '<span class="mapa-icono" aria-hidden="true">⌫</span>borrar la medida';
        }
        pastillas.appendChild(medir);
    }
    const deRuta = menu.querySelector("[data-mapa-ruta-boton]");
    if (deRuta) {
        deRuta.className = "mapa-redondo mapa-boton-ruta";
        deRuta.innerHTML = '<span class="mapa-icono" aria-hidden="true">⇄</span>';
        deRuta.setAttribute("aria-label", "Ruta por los caminos");
        deRuta.title = "Ruta por los caminos";
        buscador.appendChild(deRuta);
    }
    menu.classList.add("mapa-panel-capas");
    menu.id = "mapa-panel-de-capas";
    mando.caja.insertBefore(menu, arriba.nextSibling);
    mando.abrirCapas = hacerPanelDeMapa(mando, menu, "capas", "Capas", capas);
    alturaDelMenuDeMapa(mando);
}
function prepararPantallaCompletaDeMapa(mando) {
    const zoom = mando.pilaDeZoom || mando.caja.querySelector(".mapa-zoom");
    if (!zoom) {
        return;
    }
    const boton = botonDeMapa("mapa-redondo", "⛶", "Pantalla completa", true);
    boton.setAttribute("aria-pressed", "false");
    zoom.prepend(boton);
    const poner = (si) => {
        mando.caja.classList.toggle("es-pantalla-completa", si);
        document.documentElement.classList.toggle("con-mapa-a-pantalla", si);
        boton.setAttribute("aria-pressed", si ? "true" : "false");
        boton.setAttribute("aria-label", si ? "Salir de pantalla completa (Esc)" : "Pantalla completa");
        boton.title = boton.getAttribute("aria-label");
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
        poner(false);
        boton.focus();
    });
}
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
        lienzo.style.height = window.innerHeight + "px";
    } else if (hay && ancho && alto) {
        const tope = parseFloat(getComputedStyle(lienzo).maxHeight) || Infinity;
        const quiere = Math.min(lienzo.clientWidth * alto / ancho, tope);
        lienzo.style.height = Math.round(quiere) + "px";
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
function centrarMapa(mando) {
    const m = mando.margen || { x: 0, y: 0 };
    const caja = mando.dibujo.getBoundingClientRect();
    const lienzo = mando.lienzo;
    lienzo.scrollLeft = m.x + (caja.width - lienzo.clientWidth) / 2;
    lienzo.scrollTop = m.y + (caja.height - lienzo.clientHeight) / 2;
}
function prepararArrastreDeMapa(mando) {
    const lienzo = mando.lienzo;
    let arrastre = null;
    let comerElClic = false;
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
        if (!arrastre.movido && Math.abs(vaX) + Math.abs(vaY) < 6) {
            return;
        }
        if (!arrastre.movido) {
            arrastre.movido = true;
            lienzo.classList.add("esta-arrastrando");
            if (mando.globo) {
                mando.globo.hidden = true;
            }
            try {
                lienzo.setPointerCapture(arrastre.id);
            } catch (error) {
            }
        }
        lienzo.scrollLeft = arrastre.desdeX - vaX;
        lienzo.scrollTop = arrastre.desdeY - vaY;
        evento.preventDefault();
    });
    const soltar = () => {
        if (arrastre && arrastre.movido) {
            comerElClic = true;
        }
        arrastre = null;
        lienzo.classList.remove("esta-arrastrando");
    };
    lienzo.addEventListener("pointerup", soltar);
    lienzo.addEventListener("pointercancel", soltar);
    window.addEventListener("blur", soltar);
    lienzo.addEventListener("click", (evento) => {
        if (comerElClic) {
            comerElClic = false;
            evento.preventDefault();
            evento.stopPropagation();
        }
    }, true);
}
function prepararCapasDeMapa(caja) {
    caja.querySelectorAll("[data-mapa-capa-casilla]").forEach((casilla) => {
        const cual = casilla.getAttribute("data-mapa-capa-casilla");
        casilla.addEventListener("change", () => {
            caja.querySelectorAll("[data-mapa-capa]").forEach((capa) => {
                if (capa.getAttribute("data-mapa-capa") === cual) {
                    capa.classList.toggle("es-apagada", !casilla.checked);
                }
            });
        });
    });
}
function prepararRegionesDeMapa(caja) {
    apagarConCasilla(caja, "[data-mapa-regiones]", ".mapa-dibujos, .mapa-formas");
    apagarConCasilla(caja, "[data-mapa-pines]", ".mapa-pines");
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
function tipoDePinDeMapa(pin) {
    const tipo = TIPOS_DE_SITIO_DE_MAPA.find(([clave]) => clave && pin.classList.contains("es-" + clave));
    return tipo ? tipo[0] : "";
}
function prepararFiltrosDeSitiosDeMapa(mando) {
    const menu = mando.caja.querySelector("[data-mapa-mandos]");
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
    const como = [["ambos", "símbolo y nombre"], ["simbolo", "solo el símbolo"], ["nombre", "solo el nombre"]]
        .map(([valor, texto], i) => casilla("radio", "mapa-pines-como", valor, i === 0, texto));
    como.forEach(({ etiqueta, entrada }) => {
        grupo.appendChild(etiqueta);
        entrada.addEventListener("change", () => {
            lienzo.classList.toggle("pines-solo-simbolo", entrada.value === "simbolo" && entrada.checked);
            lienzo.classList.toggle("pines-solo-nombre", entrada.value === "nombre" && entrada.checked);
        });
    });
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
function escalarPinesDeMapa(mando) {
    const dibujo = mando.caja.querySelector(".mapa-svg");
    if (!dibujo) {
        return;
    }
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
        if (va && va.closest && va.closest("[data-mapa-sitio]") === quien(evento)) {
            return;
        }
        globo.hidden = true;
    });
    mando.lienzo.addEventListener("mouseleave", () => { globo.hidden = true; });
    mando.lienzo.addEventListener("wheel", () => { globo.hidden = true; }, { passive: true });
    window.addEventListener("scroll", () => { globo.hidden = true; }, { passive: true });
}
function llenarGloboDeMapa(globo, sitio) {
    globo.textContent = "";
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
function banderaSeguraDeMapa(url) {
    const limpia = (url || "").toString().trim();
    return /^\/(?!\/)/.test(limpia) ? limpia : "";
}
function moverGloboDeMapa(mando, x, y) {
    const globo = mando.globo;
    const caja = mando.caja.getBoundingClientRect();
    const suyo = globo.getBoundingClientRect();
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
            mejorarImagenDeMapa(mando);
        };
        antes.onerror = () => {
            delete imagen.dataset.mapaCambiando;
        };
        antes.src = otra;
    });
}
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
    for (let i = 0; i < 4; i++) {
        svg.appendChild(svgDeMapa("rect", {
            x: margen + largo * i / 4, y, width: largo / 4, height: alto,
            class: i % 2 ? "mapa-escala-tramo es-oscuro" : "mapa-escala-tramo",
        }));
    }
    svg.appendChild(svgDeMapa("rect", { x: margen, y, width: largo, height: alto, class: "mapa-escala-borde" }));
    [0, 1, 2, 3, 4].forEach((i) => {
        const x = margen + largo * i / 4;
        const larga = i % 2 === 0;
        svg.appendChild(svgDeMapa("line", {
            x1: x, x2: x, y1: y - (larga ? 8 : 4), y2: y + alto, class: "mapa-escala-raya",
        }));
    });
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
    borrar.hidden = !!mando.interfaz;
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
        if (mando.interfaz) {
            borrar.hidden = !si && !medida.puntos.length;
        }
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
function prepararLeyendaDeMapa(mando) {
    const boton = mando.caja.querySelector("[data-mapa-leyenda-boton]");
    const panel = mando.caja.querySelector("[data-mapa-leyenda]");
    if (!boton || !panel) {
        return;
    }
    boton.hidden = false;
    panel.classList.add("es-flotante");
    panel.tabIndex = 0;
    if (mando.interfaz) {
        mando.caja.insertBefore(panel, mando.lienzo);
        hacerPanelDeMapa(mando, panel, "leyenda", "Leyenda", boton);
        return;
    }
    panel.hidden = true;
    const poner = (abierta) => {
        panel.hidden = !abierta;
        boton.setAttribute("aria-expanded", abierta ? "true" : "false");
    };
    boton.addEventListener("click", () => poner(panel.hidden));
}
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
function caminoMasCortoDeMapa(red, desde, hasta) {
    const lejos = new Array(red.vecinos.length).fill(Infinity);
    const antes = new Array(red.vecinos.length).fill(-1);
    const hecho = new Array(red.vecinos.length).fill(false);
    lejos[desde] = 0;
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
function prepararBuscadorDeMapa(mando) {
    const caja = mando.buscador;
    if (!caja) {
        return;
    }
    const porNombre = new Map();
    mando.dibujo.querySelectorAll("[data-mapa-sitio][data-mapa-nombre]").forEach((el) => {
        const nombre = (el.getAttribute("data-mapa-nombre") || "").trim();
        if (nombre && !porNombre.has(nombre.toLowerCase())) {
            porNombre.set(nombre.toLowerCase(), { nombre, el });
        }
    });
    const lupa = document.createElement("span");
    lupa.className = "mapa-icono mapa-buscador-lupa";
    lupa.setAttribute("aria-hidden", "true");
    lupa.textContent = "⌕";
    const etiqueta = document.createElement("label");
    etiqueta.className = "visually-hidden";
    etiqueta.htmlFor = "mapa-buscar";
    etiqueta.textContent = "Buscar en el mapa";
    const entrada = document.createElement("input");
    entrada.id = "mapa-buscar";
    entrada.type = "search";
    entrada.placeholder = "Buscar en el mapa";
    entrada.autocomplete = "off";
    entrada.spellcheck = false;
    const lista = document.createElement("datalist");
    lista.id = "mapa-buscar-lista";
    [...porNombre.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).forEach(({ nombre }) => {
        const opcion = document.createElement("option");
        opcion.value = nombre;
        lista.appendChild(opcion);
    });
    entrada.setAttribute("list", lista.id);
    const aviso = document.createElement("p");
    aviso.className = "visually-hidden";
    aviso.setAttribute("role", "status");
    caja.prepend(lista);
    caja.prepend(entrada);
    caja.prepend(etiqueta);
    caja.prepend(lupa);
    caja.appendChild(aviso);
    if (!porNombre.size) {
        caja.hidden = true;
        return;
    }
    const ir = () => {
        const hallado = porNombre.get(entrada.value.trim().toLowerCase());
        if (!hallado) {
            return false;
        }
        irASitioDeMapa(mando, hallado.el);
        aviso.textContent = hallado.nombre + ", en el centro del mapa.";
        return true;
    };
    entrada.addEventListener("change", ir);
    entrada.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter") {
            evento.preventDefault();
            if (!ir()) {
                aviso.textContent = "No hay nada que se llame así: elige uno de la lista.";
            }
        }
    });
}
function irASitioDeMapa(mando, el) {
    const lados = (mando.dibujo.getAttribute("viewBox") || "").split(/[\s,]+/).map(parseFloat);
    let x;
    let y;
    let zoom;
    const xy = el.getAttribute("data-mapa-xy");
    if (xy) {
        [x, y] = xy.split(",").map(parseFloat);
        const regional = el.classList.contains("es-regional");
        const importante = el.classList.contains("es-capital") || el.classList.contains("es-ciudad");
        zoom = regional ? (importante ? 3 : Math.max(mando.cerca || 2, 4)) : Math.max(mando.zoom, 2);
    } else {
        let caja;
        try {
            caja = el.getBBox();
        } catch (error) {
            return;
        }
        x = caja.x + caja.width / 2;
        y = caja.y + caja.height / 2;
        const cabe = Math.min(lados[2] / Math.max(caja.width, 1), lados[3] / Math.max(caja.height, 1));
        zoom = Math.max(1, cabe * 0.6);
    }
    ponerZoomDeMapa(mando, Math.min(zoom, mando.maximo || ZOOM_MAXIMO_DE_MAPA));
    escalarPinesDeMapa(mando);
    const matriz = mando.dibujo.getScreenCTM && mando.dibujo.getScreenCTM();
    if (matriz) {
        const punto = mando.dibujo.createSVGPoint();
        punto.x = x;
        punto.y = y;
        const enPantalla = punto.matrixTransform(matriz);
        const ventana = mando.lienzo.getBoundingClientRect();
        mando.lienzo.scrollLeft += enPantalla.x - (ventana.left + ventana.width / 2);
        mando.lienzo.scrollTop += enPantalla.y - (ventana.top + ventana.height / 2);
    }
    const todos = mando.dibujo.querySelectorAll('[data-mapa-sitio="' + el.getAttribute("data-mapa-sitio") + '"]');
    todos.forEach((uno) => uno.classList.add("esta-mirado"));
    setTimeout(() => todos.forEach((uno) => uno.classList.remove("esta-mirado")), 2500);
}
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
function tramoMasCercanoDeMapa(red, x, y) {
    let mejor = null;
    for (let n = 0; n < red.vecinos.length; n++) {
        const ax = red.p[2 * n];
        const ay = red.p[2 * n + 1];
        red.vecinos[n].forEach(([m]) => {
            if (m < n) {
                return;
            }
            const bx = red.p[2 * m];
            const by = red.p[2 * m + 1];
            const dx = bx - ax;
            const dy = by - ay;
            const largo = dx * dx + dy * dy;
            const s = largo ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / largo)) : 0;
            const px = ax + dx * s;
            const py = ay + dy * s;
            const lejos = Math.hypot(px - x, py - y);
            if (!mejor || lejos < mejor.lejos) {
                mejor = { px, py, lejos, opciones: [{ nodo: n, extra: Math.hypot(px - ax, py - ay) },
                    { nodo: m, extra: Math.hypot(px - bx, py - by) }] };
            }
        });
    }
    return mejor;
}
function prepararRutaDeMapa(mando) {
    const boton = mando.caja.querySelector("[data-mapa-ruta-boton]");
    const red = leerRedDeMapa(mando.dibujo);
    if (!boton || !red || red.sitios.length < 2) {
        return;
    }
    boton.hidden = false;
    const radio = parseFloat(mando.dibujo.getAttribute("data-mapa-radio")) || 10;
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
    if (mando.interfaz) {
        mando.caja.insertBefore(panel, mando.lienzo);
    } else {
        boton.after(panel);
    }
    const extremos = { desde: null, hasta: null };
    const deSitio = (s) => ({ nombre: s[1], x: red.p[2 * s[0]], y: red.p[2 * s[0] + 1], px: red.p[2 * s[0]],
        py: red.p[2 * s[0] + 1], campo: 0, opciones: [{ nodo: s[0], extra: 0 }] });
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
        const cerca = tramoMasCercanoDeMapa(red, x, y);
        if (!cerca) {
            return null;
        }
        const junto = cercaDe(x, y);
        return { nombre: "un punto del mapa" + (junto ? " (cerca de " + junto + ")" : ""), x, y, px: cerca.px,
            py: cerca.py, campo: cerca.lejos, opciones: cerca.opciones };
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
    const pintarCampoATraves = (a, b, recta) => {
        const g = svgDeMapa("g", { class: "mapa-ruta-dibujo" });
        g.appendChild(svgDeMapa("path", { class: "mapa-ruta-campo es-recta", d: "M" + a.x + " " + a.y + "L" + b.x + " " + b.y }));
        [[a, ""], [b, " es-final"]].forEach(([x, clase]) => {
            const xy = x.x + "," + x.y;
            g.appendChild(svgDeMapa("circle", { r: (radio * 0.5).toFixed(1), class: "mapa-ruta-punto" + clase,
                "data-mapa-xy": xy, transform: "translate(" + xy + ")" }));
        });
        const pines = mando.dibujo.querySelector(".mapa-pines");
        mando.dibujo.insertBefore(g, pines || null);
        dibujoDeRuta = g;
        escalarPinesDeMapa(mando);
        let texto = "De " + a.nombre + " a " + b.nombre + ", campo a través, en línea recta (no hay ningún camino más"
            + " cerca que el otro punto)";
        const e = mando.escala;
        if (e) {
            const distancia = recta * e.porPixel;
            texto += ": " + cifraDeMapa(distancia) + (e.unidad ? " " + e.unidad : "") + ".";
            const viaje = Object.keys(e.viaje).filter((como) => e.viaje[como] > 0);
            if (viaje.length) {
                texto += " " + viaje.map((como) => como.charAt(0).toUpperCase() + como.slice(1) + ": "
                    + diasDeViajeDeMapa(distancia, e.viaje[como])).join(" · ") + ".";
            }
        } else {
            texto += ".";
        }
        salida.textContent = texto;
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
        const mismoSitio = !a.campo && !b.campo && a.opciones[0].nodo === b.opciones[0].nodo;
        if (mismoSitio) {
            salida.textContent = "Elige dos sitios distintos.";
            return;
        }
        const recta = Math.hypot(a.x - b.x, a.y - b.y);
        const suelto = a.campo > 0 || b.campo > 0;
        if (suelto && (a.campo >= recta || b.campo >= recta)) {
            pintarCampoATraves(a, b, recta);
            return;
        }
        let mejor = null;
        a.opciones.forEach((oa) => {
            b.opciones.forEach((ob) => {
                const c = oa.nodo === ob.nodo ? { puntos: [oa.nodo], largo: 0 } : caminoMasCortoDeMapa(red, oa.nodo, ob.nodo);
                if (c && (!mejor || oa.extra + c.largo + ob.extra < mejor.total)) {
                    mejor = { puntos: c.puntos, total: oa.extra + c.largo + ob.extra };
                }
            });
        });
        if (!mejor) {
            if (suelto) {
                pintarCampoATraves(a, b, recta);
            } else {
                salida.textContent = "No hay camino de " + a.nombre + " a " + b.nombre + " por los caminos del mapa.";
            }
            return;
        }
        const camino = mejor;
        const g = svgDeMapa("g", { class: "mapa-ruta-dibujo" });
        const d = "M" + a.px + " " + a.py + camino.puntos.map((n) => "L" + red.p[2 * n] + " " + red.p[2 * n + 1]).join("")
            + "L" + b.px + " " + b.py;
        g.appendChild(svgDeMapa("path", { d, class: "mapa-ruta-borde" }));
        g.appendChild(svgDeMapa("path", { d, class: "mapa-ruta-raya" }));
        [a, b].forEach((x) => {
            if (x.campo > 0) {
                g.appendChild(svgDeMapa("path", { class: "mapa-ruta-campo",
                    d: "M" + x.x + " " + x.y + "L" + x.px + " " + x.py }));
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
        const campo = a.campo + b.campo;
        let texto = "De " + a.nombre + " a " + b.nombre + " por los caminos";
        const e = mando.escala;
        if (e) {
            const distancia = (camino.total + campo) * e.porPixel;
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
        const extremosDeLaRed = [camino.puntos[0], camino.puntos[camino.puntos.length - 1]];
        const enMedio = new Map();
        red.sitios.forEach((s) => {
            const esUnExtremo = (s[0] === extremosDeLaRed[0] && !a.campo) || (s[0] === extremosDeLaRed[1] && !b.campo);
            if (!esUnExtremo && !enMedio.has(s[0])) {
                enMedio.set(s[0], s[1]);
            }
        });
        const paso = camino.puntos.filter((n) => enMedio.has(n)).map((n) => enMedio.get(n));
        texto += paso.length ? " Se pasa por " + paso.join(", ") + "." : " Sin pasar por ningún otro sitio.";
        salida.textContent = texto;
    };
    const medir = mando.caja.querySelector("[data-mapa-medir]");
    const alCambiar = (si) => {
        boton.setAttribute("aria-pressed", si ? "true" : "false");
        mando.lienzo.classList.toggle("esta-trazando-ruta", si);
        if (dibujoDeRuta) {
            dibujoDeRuta.classList.toggle("es-apagada", !si);
        }
        if (si && medir && medir.getAttribute("aria-pressed") === "true") {
            medir.click();
        }
    };
    let abrir;
    if (mando.interfaz) {
        abrir = hacerPanelDeMapa(mando, panel, "ruta", "Ruta por los caminos", boton, alCambiar);
    } else {
        abrir = (si) => {
            panel.hidden = !si;
            alCambiar(si);
        };
        boton.addEventListener("click", () => {
            abrir(panel.hidden);
            if (!panel.hidden) {
                desde.focus();
            }
        });
    }
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
    mando.lienzo.addEventListener("click", (evento) => {
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
