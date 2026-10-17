/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/mundo-mapa.js
*/
const ZOOMS_DE_MAPA = [1, 1.5, 2, 3, 4, 6];
const ZOOM_MAXIMO_DE_MAPA = 6;
const PIN_EN_PANTALLA = 15;
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
        }
    });
    window.addEventListener("resize", () => {
        margenDeMapa(mando);
        alturaDelMenuDeMapa(mando);
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
    prepararRutaDeMapa(mando);
    fijarMigasDeMapa();
    ponerZoomDeMapa(mando, 1);
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
function ponerZoomDeMapa(mando, quiere, anclaX, anclaY) {
    const lienzo = mando.lienzo;
    const antes = mando.zoom || 1;
    const ahora = Math.max(1, Math.min(ZOOM_MAXIMO_DE_MAPA, quiere || 1));
    const caja = lienzo.getBoundingClientRect();
    const haciaX = anclaX === undefined ? lienzo.clientWidth / 2 : anclaX - caja.left;
    const haciaY = anclaY === undefined ? lienzo.clientHeight / 2 : anclaY - caja.top;
    const puntoX = lienzo.scrollLeft + haciaX;
    const puntoY = lienzo.scrollTop + haciaY;
    const antesMargen = mando.margen || { x: 0, y: 0 };
    mando.zoom = ahora;
    lienzo.style.setProperty("--mapa-zoom", ahora);
    const margen = margenDeMapa(mando);
    lienzo.classList.toggle("se-puede-arrastrar", ahora > 1.0005);
    lienzo.classList.toggle("esta-cerca", ahora >= 1.995);
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
        mando.mas.disabled = ahora >= ZOOM_MAXIMO_DE_MAPA - 0.0005;
    }
    if (mando.ajustar) {
        mando.ajustar.disabled = abajo;
    }
}
function alturaDelMenuDeMapa(mando) {
    const menu = mando.caja.querySelector("[data-mapa-mandos]");
    if (!menu) {
        return;
    }
    const alLado = menu.offsetTop === mando.lienzo.offsetTop && menu.offsetLeft < mando.lienzo.offsetLeft;
    menu.style.maxHeight = alLado ? Math.max(260, mando.lienzo.offsetHeight) + "px" : "";
}
function margenDeMapa(mando) {
    const lienzo = mando.lienzo;
    const margen = mando.zoom > 1.0005
        ? { x: Math.round(lienzo.clientWidth / 3), y: Math.round(lienzo.clientHeight / 3) }
        : { x: 0, y: 0 };
    mando.margen = margen;
    mando.dibujo.style.margin = margen.y + "px " + margen.x + "px";
    return margen;
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
    apagarConCasilla(caja, "[data-mapa-nombres]", ".mapa-pin-nombre, .mapa-textos");
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
            : [...caja.querySelectorAll(".mapa-dibujos > .es-zona-" + clase)];
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
    const cuanto = Math.max(0.15, Math.min(8, PIN_EN_PANTALLA / (radio * porUnidad)));
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
    panel.hidden = true;
    panel.tabIndex = 0;
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
            poner(false);
            boton.focus();
        }
    });
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
    ayuda.textContent = "Elige de dónde a dónde, o pulsa dos sitios en el mapa.";
    panel.appendChild(ayuda);
    const lista = (texto, id) => {
        const etiqueta = document.createElement("label");
        etiqueta.className = "mapa-ruta-campo";
        etiqueta.htmlFor = id;
        etiqueta.textContent = texto;
        const elegir = document.createElement("select");
        elegir.id = id;
        const nada = document.createElement("option");
        nada.value = "";
        nada.textContent = "— elige un sitio —";
        elegir.appendChild(nada);
        red.sitios.forEach((s, i) => {
            const opcion = document.createElement("option");
            opcion.value = String(i);
            opcion.textContent = s[1];
            elegir.appendChild(opcion);
        });
        etiqueta.appendChild(elegir);
        panel.appendChild(etiqueta);
        return elegir;
    };
    const desde = lista("Desde", "mapa-ruta-desde");
    const hasta = lista("Hasta", "mapa-ruta-hasta");
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
    let dibujoDeRuta = null;
    const borrarDibujo = () => {
        if (dibujoDeRuta) {
            dibujoDeRuta.remove();
            dibujoDeRuta = null;
        }
    };
    const pintar = () => {
        borrarDibujo();
        const a = red.sitios[Number(desde.value)];
        const b = red.sitios[Number(hasta.value)];
        quitar.disabled = !desde.value && !hasta.value;
        alReves.disabled = !desde.value || !hasta.value;
        if (!desde.value || !hasta.value) {
            salida.textContent = desde.value || hasta.value ? "Ahora elige el otro sitio." : "";
            return;
        }
        if (a[0] === b[0]) {
            salida.textContent = "Elige dos sitios distintos.";
            return;
        }
        const camino = caminoMasCortoDeMapa(red, a[0], b[0]);
        if (!camino) {
            salida.textContent = "No hay camino de " + a[1] + " a " + b[1] + " por los caminos del mapa.";
            return;
        }
        const g = svgDeMapa("g", { class: "mapa-ruta-dibujo" });
        const d = camino.puntos.map((n, i) => (i ? "L" : "M") + red.p[2 * n] + " " + red.p[2 * n + 1]).join("");
        g.appendChild(svgDeMapa("path", { d, class: "mapa-ruta-borde" }));
        g.appendChild(svgDeMapa("path", { d, class: "mapa-ruta-raya" }));
        [[a[0], ""], [b[0], " es-final"]].forEach(([n, clase]) => {
            const xy = red.p[2 * n] + "," + red.p[2 * n + 1];
            g.appendChild(svgDeMapa("circle", { r: (radio * 0.5).toFixed(1), class: "mapa-ruta-punto" + clase,
                "data-mapa-xy": xy, transform: "translate(" + xy + ")" }));
        });
        const pines = mando.dibujo.querySelector(".mapa-pines");
        mando.dibujo.insertBefore(g, pines || null);
        dibujoDeRuta = g;
        escalarPinesDeMapa(mando);
        let texto = "De " + a[1] + " a " + b[1] + " por los caminos";
        const e = mando.escala;
        if (e) {
            const distancia = camino.largo * e.porPixel;
            texto += ": " + cifraDeMapa(distancia) + (e.unidad ? " " + e.unidad : "") + ".";
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
            if (s[0] !== a[0] && s[0] !== b[0] && !enMedio.has(s[0])) {
                enMedio.set(s[0], s[1]);
            }
        });
        const paso = camino.puntos.filter((n) => enMedio.has(n)).map((n) => enMedio.get(n));
        texto += paso.length ? " Se pasa por " + paso.join(", ") + "." : " Sin pasar por ningún otro sitio.";
        salida.textContent = texto;
    };
    const medir = mando.caja.querySelector("[data-mapa-medir]");
    const abrir = (si) => {
        panel.hidden = !si;
        boton.setAttribute("aria-pressed", si ? "true" : "false");
        mando.lienzo.classList.toggle("esta-trazando-ruta", si);
        if (dibujoDeRuta) {
            dibujoDeRuta.classList.toggle("es-apagada", !si);
        }
        if (si && medir && medir.getAttribute("aria-pressed") === "true") {
            medir.click();
        }
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
    desde.addEventListener("change", pintar);
    hasta.addEventListener("change", pintar);
    alReves.addEventListener("click", () => {
        [desde.value, hasta.value] = [hasta.value, desde.value];
        pintar();
    });
    quitar.addEventListener("click", () => {
        desde.value = "";
        hasta.value = "";
        pintar();
        desde.focus();
    });
    mando.caja.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && !panel.hidden && panel.contains(document.activeElement)) {
            abrir(false);
            boton.focus();
        }
    });
    mando.lienzo.addEventListener("click", (evento) => {
        if (panel.hidden) {
            return;
        }
        const sitio = evento.target.closest ? evento.target.closest("[data-mapa-sitio]") : null;
        const cual = sitio ? sitio.getAttribute("data-mapa-sitio") : "";
        const i = red.sitios.findIndex((s) => s[2] === cual);
        if (i < 0) {
            return;
        }
        evento.preventDefault();
        evento.stopPropagation();
        if (!desde.value || (desde.value && hasta.value)) {
            desde.value = String(i);
            hasta.value = "";
        } else {
            hasta.value = String(i);
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
