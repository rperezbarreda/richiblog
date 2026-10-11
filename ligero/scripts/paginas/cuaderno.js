/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/cuaderno.js
*/
const CUADERNO_HOJA_MINIMA_REM = 22;
const CUADERNO_LISTADO_URL = "/datos/notas_rol/notas-rol.json";
initializeCuaderno();
function initializeCuaderno() {
    const cuaderno = document.querySelector(".cuaderno");
    if (!cuaderno) {
        return;
    }
    const sePliega = elNavegadorSabePlegar();
    if (!sePliega) {
        document.documentElement.setAttribute("data-sin-plegar", "");
    } else {
        montarPlegarTodo(cuaderno);
        prepararImpresionCuaderno();
    }
    nombrarHojas(cuaderno);
    montarPasarPagina(cuaderno);
    montarPieDeNotas();
    montarTokensDeNpcs(cuaderno);
}
function nombrarHojas(cuaderno) {
    const hojas = [...cuaderno.querySelectorAll(".cuaderno-hoja")];
    hojas.forEach((hoja, i) => {
        const cuerpo = hoja.querySelector(".cuaderno-hoja-cuerpo");
        if (!cuerpo) {
            return;
        }
        const marca = hoja.querySelector(".cuaderno-hoja-numero");
        const numero = (marca && marca.textContent.trim()) || String(i + 1);
        cuerpo.setAttribute("aria-label", "Hoja " + numero + ", con scroll");
    });
}
function montarPasarPagina(cuaderno) {
    const hojas = [...cuaderno.children].filter((h) =>
        h.classList.contains("cuaderno-hoja")
    );
    if (hojas.length < 2) {
        return;
    }
    const columna = cuaderno.closest(".cuaderno-columna");
    if (!columna) {
        return;
    }
    const barra = document.createElement("div");
    barra.className = "cuaderno-paginacion";
    barra.setAttribute("role", "group");
    barra.setAttribute("aria-label", "Pasar página del cuaderno");
    const atras = botonDePagina("hoja anterior", "hacia-atras", true);
    const cuenta = document.createElement("p");
    cuenta.className = "cuaderno-paginacion-cuenta";
    cuenta.setAttribute("role", "status");
    const adelante = botonDePagina("hoja siguiente", "hacia-delante", false);
    barra.appendChild(atras);
    barra.appendChild(cuenta);
    barra.appendChild(adelante);
    columna.appendChild(barra);
    let cara = 0;
    function porCara() {
        const estilo = getComputedStyle(cuaderno);
        if (estilo.getPropertyValue("--paginar").trim() === "0") {
            return 0;
        }
        const hueco = parseFloat(estilo.columnGap) || 0;
        const rem =
            parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const minima = CUADERNO_HOJA_MINIMA_REM * rem;
        return cuaderno.clientWidth >= minima * 2 + hueco ? 2 : 1;
    }
    function repartir() {
        const cuantas = porCara();
        if (!cuantas) {
            cuaderno.classList.remove("is-paginado");
            hojas.forEach((h) => {
                h.hidden = false;
            });
            barra.hidden = true;
            return;
        }
        const caras = Math.ceil(hojas.length / cuantas);
        if (caras < 2) {
            cuaderno.classList.add("is-paginado");
            hojas.forEach((h) => {
                h.hidden = false;
            });
            barra.hidden = true;
            return;
        }
        cara = Math.min(cara, caras - 1);
        cuaderno.classList.add("is-paginado");
        barra.hidden = false;
        const desde = cara * cuantas;
        const hasta = Math.min(desde + cuantas, hojas.length);
        hojas.forEach((hoja, i) => {
            hoja.hidden = i < desde || i >= hasta;
        });
        atras.disabled = cara === 0;
        adelante.disabled = cara >= caras - 1;
        cuenta.textContent =
            hasta - desde === 1
                ? `hoja ${desde + 1} de ${hojas.length}`
                : `hojas ${desde + 1} y ${hasta} de ${hojas.length}`;
    }
    let reloj = 0;
    function quitarGiro(hoja) {
        hoja.classList.remove("bisagra-izquierda", "bisagra-derecha");
    }
    function animarPaso(visibles, sentido) {
        cuaderno.classList.remove("is-pasando");
        visibles.forEach(quitarGiro);
        void cuaderno.offsetWidth;
        cuaderno.classList.add("is-pasando");
        visibles.forEach((hoja, i) => {
            if (visibles.length > 1) {
                hoja.classList.add(i === 0 ? "bisagra-derecha" : "bisagra-izquierda");
            } else {
                hoja.classList.add(sentido > 0 ? "bisagra-izquierda" : "bisagra-derecha");
            }
        });
        clearTimeout(reloj);
        reloj = setTimeout(() => {
            cuaderno.classList.remove("is-pasando");
            visibles.forEach(quitarGiro);
        }, 500);
    }
    function mover(cuanto) {
        cara += cuanto;
        repartir();
        const visibles = hojas.filter((h) => !h.hidden);
        visibles.forEach((h) => {
            const cuerpo = h.querySelector(".cuaderno-hoja-cuerpo");
            if (cuerpo) {
                cuerpo.scrollTop = 0;
            }
        });
        animarPaso(visibles, cuanto);
    }
    atras.addEventListener("click", () => mover(-1));
    adelante.addEventListener("click", () => mover(1));
    repartir();
    let espera = 0;
    const volverAMirar = () => {
        clearTimeout(espera);
        espera = setTimeout(repartir, 120);
    };
    window.addEventListener("resize", volverAMirar);
    document.addEventListener("ajustes:actualizar", volverAMirar);
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(repartir).catch(() => {});
    }
    window.addEventListener("beforeprint", () => {
        hojas.forEach((h) => {
            h.hidden = false;
        });
    });
    window.addEventListener("afterprint", repartir);
}
function botonDePagina(nombre, sentido, flechaDelante) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "cuaderno-paginacion-boton";
    const flecha = document.createElement("span");
    flecha.className = "cuaderno-paginacion-flecha " + sentido;
    flecha.setAttribute("aria-hidden", "true");
    const texto = document.createElement("span");
    texto.textContent = nombre;
    if (flechaDelante) {
        boton.appendChild(flecha);
        boton.appendChild(texto);
    } else {
        boton.appendChild(texto);
        boton.appendChild(flecha);
    }
    return boton;
}
async function montarPieDeNotas() {
    const pie = document.querySelector("[data-cuaderno-pie]");
    if (!pie) {
        return;
    }
    const fuente = (pie.getAttribute("data-campana-datos") || "").trim();
    if (!fuente || typeof window.pedirDatos !== "function") {
        return;
    }
    let campana = null;
    let publicadas = [];
    try {
        const respuesta = await window.pedirDatos(fuente);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        campana = await respuesta.json();
        const listado = await window.pedirDatos(CUADERNO_LISTADO_URL);
        if (listado.ok) {
            const items = await listado.json();
            publicadas = Array.isArray(items) ? items : [];
        }
    } catch (error) {
        return;
    }
    const sesiones = (Array.isArray(campana.sesiones) ? campana.sesiones : [])
        .filter((s) => s && s.url)
        .sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));
    const aqui = sinExtensionCuaderno(window.location.pathname);
    const donde = sesiones.findIndex(
        (s) => sinExtensionCuaderno(s.url) === aqui
    );
    if (donde === -1) {
        return;
    }
    const porUrl = {};
    publicadas.forEach((item) => {
        porUrl[sinExtensionCuaderno(item && item.url)] = item;
    });
    const vecina = (paso) => {
        for (let i = donde + paso; i >= 0 && i < sesiones.length; i += paso) {
            const suya = porUrl[sinExtensionCuaderno(sesiones[i].url)];
            if (suya) {
                return { sesion: sesiones[i], publicada: suya };
            }
        }
        return null;
    };
    const anterior = vecina(-1);
    const siguiente = vecina(1);
    const pdf = (sesiones[donde].pdf || "").toString().trim();
    if (pdf && /^https?:\/\//i.test(pdf)) {
        pie.appendChild(botonDePdf(pdf));
    }
    const reparto = (campana.npcs || "").toString().trim();
    if (reparto && /^\//.test(reparto)) {
        pie.appendChild(botonDeReparto(reparto));
    }
    if (anterior || siguiente) {
        pie.appendChild(navDeSaltos(anterior, siguiente));
    }
}
function sinExtensionCuaderno(ruta) {
    return (ruta || "").toString().trim().replace(/\.html$/, "").replace(/\/+$/, "");
}
function botonDePdf(url) {
    const enlace = document.createElement("a");
    enlace.className = "cuaderno-pdf";
    enlace.href = rutaSeguraCuaderno(url);
    enlace.target = "_blank";
    enlace.rel = "noopener";
    const flecha = document.createElement("span");
    flecha.className = "cuaderno-pdf-flecha";
    flecha.setAttribute("aria-hidden", "true");
    flecha.textContent = "↓";
    enlace.appendChild(flecha);
    const texto = document.createElement("span");
    texto.textContent = "descargar las notas en PDF";
    enlace.appendChild(texto);
    return enlace;
}
function botonDeReparto(url) {
    const enlace = document.createElement("a");
    enlace.className = "cuaderno-pdf";
    enlace.href = url;
    const flecha = document.createElement("span");
    flecha.className = "cuaderno-pdf-flecha";
    flecha.setAttribute("aria-hidden", "true");
    flecha.textContent = "→";
    enlace.appendChild(flecha);
    const texto = document.createElement("span");
    texto.textContent = "npcs";
    enlace.appendChild(texto);
    return enlace;
}
function navDeSaltos(anterior, siguiente) {
    const nav = document.createElement("nav");
    nav.className = "cuaderno-saltos";
    nav.setAttribute("aria-label", "Otras sesiones de la campaña");
    if (anterior) {
        nav.appendChild(unSalto(anterior, "anterior"));
    }
    if (siguiente) {
        nav.appendChild(unSalto(siguiente, "siguiente"));
    }
    return nav;
}
function unSalto(cual, sentido) {
    const sesion = cual.sesion;
    const publicada = cual.publicada;
    const enlace = document.createElement("a");
    enlace.className = "cuaderno-salto";
    enlace.href = rutaSeguraCuaderno(sesion.url);
    enlace.rel = sentido === "anterior" ? "prev" : "next";
    const flecha = document.createElement("span");
    flecha.className = "cuaderno-salto-flecha";
    flecha.setAttribute("aria-hidden", "true");
    flecha.textContent = sentido === "anterior" ? "←" : "→";
    enlace.appendChild(flecha);
    const texto = document.createElement("span");
    texto.className = "cuaderno-salto-texto";
    const etiqueta = document.createElement("span");
    etiqueta.className = "cuaderno-salto-cual";
    etiqueta.textContent = "sesión " + sentido;
    texto.appendChild(etiqueta);
    const nombre = document.createElement("span");
    nombre.className = "cuaderno-salto-nombre";
    nombre.textContent = nombreDeSesion(sesion, publicada);
    texto.appendChild(nombre);
    enlace.appendChild(texto);
    return enlace;
}
function rutaSeguraCuaderno(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "#";
}
function nombreDeSesion(sesion, publicada) {
    const puesto = ((publicada && publicada.title) || "").toString().trim();
    if (puesto) {
        return puesto;
    }
    const numero = Number(sesion.numero) || 0;
    const corto = (sesion.titulo || "").toString().trim();
    return "Sesión " + numero + (corto ? " — " + corto : "");
}
function elNavegadorSabePlegar() {
    try {
        const prueba = document.createElement("details");
        if (!("open" in prueba)) {
            return false;
        }
        prueba.innerHTML = "<summary>a</summary>b";
        prueba.style.cssText =
            "position:absolute;left:-9999px;top:0;visibility:hidden";
        document.body.appendChild(prueba);
        const plegado = prueba.offsetHeight;
        prueba.open = true;
        const abierto = prueba.offsetHeight;
        prueba.remove();
        return abierto > plegado;
    } catch (error) {
        return false;
    }
}
function montarPlegarTodo(cuaderno) {
    const escenas = [...cuaderno.querySelectorAll(".cuaderno-escena")];
    if (escenas.length < 2) {
        const escrito = document.querySelector("[data-plegar-todo]");
        if (escrito) {
            escrito.remove();
        }
        return;
    }
    const barra = document.querySelector(".cuaderno-post-header-meta");
    if (!barra) {
        return;
    }
    let boton = barra.querySelector("[data-plegar-todo]");
    if (!boton) {
        boton = document.createElement("button");
        boton.type = "button";
        boton.className = "cuaderno-plegar-todo";
        const flecha = document.createElement("span");
        flecha.className = "cuaderno-plegar-todo-flecha";
        flecha.setAttribute("aria-hidden", "true");
        boton.appendChild(flecha);
        boton.appendChild(document.createElement("span"));
        const volver = barra.querySelector(".cuaderno-post-back");
        barra.insertBefore(boton, volver || null);
    }
    boton.setAttribute("aria-pressed", "false");
    const nombre = boton.querySelector("span:not(.cuaderno-plegar-todo-flecha)");
    const ponerNombre = () => {
        const plegadas = escenas.every((escena) => !escena.open);
        boton.setAttribute("aria-pressed", plegadas ? "true" : "false");
        nombre.textContent = plegadas
            ? "desplegar las escenas"
            : "plegar las escenas";
    };
    boton.addEventListener("click", () => {
        const plegarlas = escenas.some((escena) => escena.open);
        escenas.forEach((escena) => {
            escena.open = !plegarlas;
        });
        ponerNombre();
    });
    escenas.forEach((escena) => {
        escena.addEventListener("toggle", ponerNombre);
    });
    ponerNombre();
}
function prepararImpresionCuaderno() {
    let cerradas = [];
    const antes = () => {
        cerradas = [...document.querySelectorAll(".cuaderno-escena")].filter(
            (escena) => !escena.open
        );
        cerradas.forEach((escena) => {
            escena.open = true;
        });
    };
    const despues = () => {
        cerradas.forEach((escena) => {
            escena.open = false;
        });
        cerradas = [];
    };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", despues);
    if (typeof window.matchMedia === "function") {
        const papel = window.matchMedia("print");
        const cambio = (evento) => (evento.matches ? antes() : despues());
        if (typeof papel.addEventListener === "function") {
            papel.addEventListener("change", cambio);
        }
    }
}
async function montarTokensDeNpcs(cuaderno) {
    const articulo = cuaderno.closest("[data-campana]") || document.querySelector("[data-campana]");
    const clave = ((articulo && articulo.getAttribute("data-campana")) || "").trim();
    if (!/^[a-z0-9_-]+$/i.test(clave) || typeof window.pedirDatos !== "function") {
        return;
    }
    const pedir = async (url) => {
        try {
            const respuesta = await window.pedirDatos(url);
            return respuesta.ok ? await respuesta.json() : null;
        } catch (error) {
            return null;
        }
    };
    const [reparto, campana] = await Promise.all([
        pedir("/datos/notas_rol/npcs-" + clave + ".json"),
        pedir("/datos/notas_rol/campana-" + clave + ".json"),
    ]);
    const datosNpc = reparto && typeof reparto === "object" ? reparto : {};
    if (campana && Array.isArray(campana.sesiones)) {
        datosNpc.sesiones = campana.sesiones;
    }
    const npcs = Array.isArray(datosNpc.personajes) ? datosNpc.personajes : [];
    const mesa = campana && typeof personajesDe === "function"
        ? personajesDe(campana.personajes) : [];
    const npcQueSea = buscadorDeNpcs(npcs);
    const pjQueSea = buscadorDeNpcs(mesa);
    const puedeAbrir = window.ventanaModal && typeof window.ventanaModal.abrir === "function";
    let globo = null;
    let esconderLuego = null;
    let vueltaDeFicha = null;
    const hayFichaAbierta = () => !!document.querySelector('[role="dialog"]:not([hidden])');
    const esconder = () => {
        clearTimeout(esconderLuego);
        if (globo) {
            globo.hidden = true;
        }
        document.querySelectorAll(".cuaderno-npc.esta-mirandose").forEach((uno) =>
            uno.classList.remove("esta-mirandose"));
    };
    const esconderEnUnRato = () => {
        clearTimeout(esconderLuego);
        esconderLuego = setTimeout(esconder, 180);
    };
    const ensenar = (nombre, cara) => {
        if (!globo) {
            globo = globoDeNpc();
            globo.addEventListener("mouseenter", () => clearTimeout(esconderLuego));
            globo.addEventListener("mouseleave", esconderEnUnRato);
        }
        esconder();
        rellenarGloboDeNpc(globo, cara);
        nombre.classList.add("esta-mirandose");
        globo.hidden = false;
        colocarGloboDeNpc(globo, nombre);
    };
    cuaderno.querySelectorAll("strong").forEach((nombre) => {
        const deLaMesa = [...nombre.classList].some((clase) => clase.indexOf("pj-") === 0);
        const quien = deLaMesa ? pjQueSea(nombre.textContent) : npcQueSea(nombre.textContent);
        if (!quien) {
            return;
        }
        const cara = {
            nombre: quien.nombre,
            token: quien.token_mini || quien.token,
            tokenGrande: quien.token,
            que: deLaMesa ? quien.extra : quien.que,
        };
        nombre.classList.add("cuaderno-npc");
        let objetivo = nombre;
        if (puedeAbrir) {
            const boton = nombre;
            boton.setAttribute("role", "button");
            boton.setAttribute("tabindex", "0");
            boton.setAttribute("aria-haspopup", "dialog");
            const que = (cara.que || "").toString().trim();
            boton.setAttribute("aria-label",
                (quien.nombre || "").toString().trim() + (que ? ", " + que : "") + ". Abre su ficha");
            boton.addEventListener("keydown", (evento) => {
                if (evento.key === "Enter" || evento.key === " " || evento.key === "Spacebar") {
                    evento.preventDefault();
                    boton.click();
                }
            });
            boton.addEventListener("click", () => {
                esconder();
                vueltaDeFicha = boton;
                if (deLaMesa && typeof abrirLaFichaDeUnPj === "function") {
                    abrirLaFichaDeUnPj(quien, boton);
                } else if (!deLaMesa && typeof abrirFichaNpc === "function") {
                    abrirFichaNpc(quien, datosNpc, boton);
                }
            });
            boton.addEventListener("focus", () => {
                if (vueltaDeFicha !== boton && boton.matches(":focus-visible")) {
                    ensenar(nombre, cara);
                }
            });
            boton.addEventListener("blur", () => {
                if (vueltaDeFicha === boton && !hayFichaAbierta()) {
                    vueltaDeFicha = null;
                }
                esconderEnUnRato();
            });
            objetivo = boton;
        }
        objetivo.addEventListener("mouseenter", () => {
            if (vueltaDeFicha !== objetivo) {
                ensenar(nombre, cara);
            }
        });
        objetivo.addEventListener("mouseleave", () => {
            if (vueltaDeFicha === objetivo && !hayFichaAbierta()) {
                vueltaDeFicha = null;
            }
            esconderEnUnRato();
        });
    });
    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && globo && !globo.hidden) {
            esconder();
        }
    });
    window.addEventListener("scroll", esconder, true);
    window.addEventListener("resize", esconder);
}
function buscadorDeNpcs(gente) {
    const plano = (texto) => (texto || "").toString()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/\s+/g, " ").trim();
    const enteros = new Map();
    const dePila = new Map();
    gente.forEach((npc) => {
        if (!npc || !(npc.nombre || "").toString().trim()) {
            return;
        }
        const entero = plano(npc.nombre);
        if (!enteros.has(entero)) {
            enteros.set(entero, npc);
        }
        const primero = entero.split(" ")[0];
        if (primero !== entero) {
            dePila.set(primero, dePila.has(primero) ? null : npc);
        }
    });
    return (texto) => {
        const buscado = plano(texto);
        if (enteros.has(buscado)) {
            return enteros.get(buscado);
        }
        return dePila.get(buscado) || null;
    };
}
function globoDeNpc() {
    const globo = document.createElement("div");
    globo.className = "cuaderno-npc-globo";
    globo.setAttribute("aria-hidden", "true");
    globo.hidden = true;
    const marco = document.createElement("span");
    marco.className = "cuaderno-npc-marco";
    globo.appendChild(marco);
    const nombre = document.createElement("span");
    nombre.className = "cuaderno-npc-nombre";
    globo.appendChild(nombre);
    const que = document.createElement("span");
    que.className = "cuaderno-npc-que";
    globo.appendChild(que);
    document.body.appendChild(globo);
    return globo;
}
function rellenarGloboDeNpc(globo, npc) {
    const marco = globo.querySelector(".cuaderno-npc-marco");
    marco.textContent = "";
    const ruta = imagenSeguraCuaderno(npc.token);
    if (ruta) {
        const img = document.createElement("img");
        img.className = "cuaderno-npc-img";
        img.src = imagenSeguraCuaderno(ruta);
        img.alt = "";
        img.decoding = "async";
        const grande = imagenSeguraCuaderno(npc.tokenGrande);
        if (grande && grande !== ruta) {
            img.addEventListener("error", () => {
                img.src = grande;
            }, { once: true });
        }
        marco.appendChild(img);
    } else {
        const inicial = document.createElement("span");
        inicial.className = "cuaderno-npc-inicial";
        inicial.textContent = (npc.nombre || "?").toString().trim().charAt(0).toUpperCase();
        marco.appendChild(inicial);
    }
    globo.querySelector(".cuaderno-npc-nombre").textContent = (npc.nombre || "").toString().trim();
    const que = (npc.que || "").toString().trim();
    const linea = globo.querySelector(".cuaderno-npc-que");
    linea.textContent = que;
    linea.hidden = !que;
}
function colocarGloboDeNpc(globo, nombre) {
    const sitio = nombre.getBoundingClientRect();
    const ancho = globo.offsetWidth;
    const alto = globo.offsetHeight;
    const margen = 8;
    let izquierda = sitio.left + sitio.width / 2 - ancho / 2;
    izquierda = Math.max(margen, Math.min(izquierda, window.innerWidth - ancho - margen));
    let arriba = sitio.bottom + margen;
    if (arriba + alto > window.innerHeight - margen) {
        arriba = Math.max(margen, sitio.top - alto - margen);
    }
    globo.style.left = Math.round(izquierda) + "px";
    globo.style.top = Math.round(arriba) + "px";
}
function imagenSeguraCuaderno(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "";
}
