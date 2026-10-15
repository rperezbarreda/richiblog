/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/mundo-mapa.js
*/
const ZOOMS_DE_MAPA = [1, 1.5, 2, 3, 4, 6];
const ZOOM_MAXIMO_DE_MAPA = 6;
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
    window.addEventListener("resize", () => escalarPinesDeMapa(mando));
    prepararArrastreDeMapa(mando);
    prepararCapasDeMapa(caja);
    prepararRegionesDeMapa(caja);
    prepararGloboDeMapa(mando);
    prepararSitiosDeMapa();
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
    prepararNivelesDeMapa(caja);
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
        regiones.classList.toggle("es-apagada", cual !== "regiones");
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
    const anchoReal = Math.min(caja.width, caja.height * (ancho / alto));
    const porUnidad = anchoReal / ancho;
    const cuanto = Math.max(0.15, Math.min(8, PIN_EN_PANTALLA / (radio * porUnidad)));
    grupo.querySelectorAll("[data-mapa-xy]").forEach((pin) => {
        const sitio = pin.getAttribute("data-mapa-xy");
        pin.setAttribute("transform", "translate(" + sitio + ") scale(" + cuanto.toFixed(3) + ")");
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
