// =========================================
// COMPONENTE: LA VENTANA DE ACCESIBILIDAD
// =========================================
// El botón "Aa" abre una ventana con todo lo que se puede tocar para
// ver mejor la web: el tamaño del texto, la separación entre líneas, la
// letra, el tema y el brillito del cursor. Debajo hay un trozo de texto
// de ejemplo que se mueve a la vez que los mandos, para ir viendo lo
// que se elige sin tener que cerrar y mirar.
//
// Sustituye a scripts/componentes/texto-tamano.js, que era solo el
// panelito del tamaño.
//
// CÓMO CAMBIA TODO A LA VEZ
// -------------------------
// Ninguno de estos mandos toca una regla de CSS. Cada uno cambia una
// sola cosa en el <html>, y el CSS hace el resto:
//     --escala           multiplica el tamaño de raíz (base.css)
//     data-interlineado  la separación del texto largo (ajustes.css)
//     data-letra         cambia las cinco fuentes de golpe (base.css)
//     data-estilo        el diseño: retro (sin él), moderno (moderno.css), windows (windows.css) o a lápiz (lapiz.css)
//     data-theme         el tema, de siempre (tema.js)
//     data-crt           el filtro CRT (ajustes.css)
//     data-voz           a qué velocidad lee (leer-en-voz.js)
//     data-movimiento    para lo que parpadea (sin-movimiento.css)
// Como los tamaños del sitio van en rem, con la escala crece todo solo.
//
// QUIÉN LO PINTA LA PRIMERA VEZ
// -----------------------------
// Este archivo va con defer, o sea que llega tarde: si esperara a
// ejecutarse aquí, la página se pintaría con los ajustes de fábrica y
// daría un salto al llegar. Lo que lee lo guardado y lo deja puesto
// ANTES del primer pintado es scripts/cargador-scripts.js, que va sin
// defer en el <head>. Aquí solo se monta el mando.
//
// POR QUÉ UN <dialog> Y NO UNA CAJA CUALQUIERA
// --------------------------------------------
// Con showModal() el navegador hace solo lo que a mano sale mal cuatro
// veces de cinco: oscurece el fondo (::backdrop), atrapa el tabulador
// dentro, cierra con Escape, deja inerte el resto de la página para
// quien usa lector de pantalla y devuelve el foco al botón al cerrar.
//
// OJO CON LOS NOMBRES
// -------------------
// Aquí no hay módulos: todos los scripts comparten el mismo ámbito
// global y dos funciones con el mismo nombre se pisan (ya pasó con una
// mover()). Por eso todo lo de aquí lleva "ajustes" en el nombre. Se
// comprueba con herramientas/4-comprobar/nombres-repetidos.py.

// Los cinco tamaños, del más pequeño al más grande. El 1 es el de
// siempre y está en la lista a propósito: se vuelve a él con el −, sin
// tener que acordarse de ningún número.
const AJUSTES_TAMANOS = [0.9, 1, 1.15, 1.3, 1.5];
const AJUSTES_GUARDADO_TAMANO = "richi-texto";
const AJUSTES_GUARDADO_INTERLINEADO = "richi-interlineado";
const AJUSTES_GUARDADO_LETRA = "richi-letra";
const AJUSTES_GUARDADO_ESTILO = "richi-estilo";
const AJUSTES_GUARDADO_CRT = "richi-crt";
const AJUSTES_GUARDADO_VOZ = "richi-voz";
const AJUSTES_GUARDADO_MOVIMIENTO = "richi-movimiento";

const AJUSTES = {
    ventana: null,
    abrir: null,
    rango: null,
    paso: 1,
    avisoReloj: 0,
};

document.addEventListener("sidebar:loaded", initializeAjustes);

// EN UNA PÁGINA SIN MENÚ (el 404) nadie avisa con sidebar:loaded: la
// ventana viene suelta (fragmentos/ajustes.html, en su propio
// contenedor), así que se arranca en cuanto la página está leída, y con
// ella los dos mandos de dentro que son de otros scripts (el color de
// tema, de tema.js, y el brillito, de rastro-cursor.js).
if (!document.getElementById("sidebar-container")) {
    document.addEventListener("DOMContentLoaded", () => {
        initializeAjustes();
        if (typeof initializeThemeToggle === "function") {
            initializeThemeToggle();
        }
        if (typeof initializeCursorTrailToggle === "function") {
            initializeCursorTrailToggle();
        }
    });
}

// Los mandos de la velocidad de la voz están en dos sitios: aquí dentro
// y debajo del botón de escuchar de cada entrada. Cuando cambian allí,
// avisan con esto para que los de aquí se marquen igual (y al revés, que
// lo manda engancharAjustesOpciones). Los dos leen el <html>, así que no
// hay dos verdades: solo hay que volver a pintar.
document.addEventListener("ajustes:actualizar", () => {
    if (AJUSTES.ventana) {
        pintarAjustesOpciones();
    }
});

function initializeAjustes() {
    const ventana = document.querySelector("[data-ajustes]");
    const abrir = document.querySelector("[data-ajustes-abrir]");
    if (!ventana || !abrir || AJUSTES.ventana) {
        return;
    }
    AJUSTES.ventana = ventana;
    AJUSTES.abrir = abrir;

    // Lo primero, antes de enganchar nada: armar el panel. En el HTML
    // solo vienen las filas de mandos; la caja que las agrupa, la
    // muestra y la nota del final se montan aquí.
    armarAjustesPanel(ventana);

    abrir.addEventListener("click", abrirAjustes);

    const cerrar = ventana.querySelector("[data-ajustes-cerrar]");
    if (cerrar) {
        cerrar.addEventListener("click", cerrarAjustes);
    }

    // Pulsar en el fondo oscurecido cierra, como en cualquier ventana
    // de este tipo. El ::backdrop no recibe clics por su cuenta: lo que
    // llega es un clic en el propio <dialog> pero fuera de su contenido,
    // así que se compara con el rectángulo de la caja.
    ventana.addEventListener("click", (evento) => {
        if (evento.target !== ventana) {
            return;
        }
        const caja = ventana.getBoundingClientRect();
        const dentro =
            evento.clientX >= caja.left && evento.clientX <= caja.right &&
            evento.clientY >= caja.top && evento.clientY <= caja.bottom;
        if (!dentro) {
            cerrarAjustes();
        }
    });

    // ---- tamaño ----
    AJUSTES.rango = ventana.querySelector("[data-tamano-rango]");
    AJUSTES.paso = pasoDeAjustes(leerAjuste(AJUSTES_GUARDADO_TAMANO, NaN, true));
    if (AJUSTES.rango) {
        // "input" y no "change": así el texto crece mientras se arrastra
        // y mientras se pulsan las flechas, que es justo lo que hace
        // falta para ir viendo cómo queda.
        AJUSTES.rango.addEventListener("input", () => {
            aplicarAjustesTamano(Number(AJUSTES.rango.value), true);
        });
    }
    aplicarAjustesTamano(AJUSTES.paso, false);

    // ---- separación entre líneas y letra ----
    engancharAjustesOpciones("interlineado");
    engancharAjustesOpciones("letra");
    engancharAjustesOpciones("estilo");
    engancharAjustesOpciones("voz");
    engancharAjustesOpciones("movimiento");
    pintarAjustesOpciones();

    // ---- el filtro CRT ----
    // El botón se marca con data-crt-boton y NO con data-crt a secas:
    // ese otro es el que lleva el <html> cuando el filtro está puesto,
    // y un querySelector("[data-crt]") suelto encontraría antes el
    // <html> que el botón.
    const reiniciar = ventana.querySelector("[data-ajustes-reiniciar]");
    if (reiniciar) {
        reiniciar.addEventListener("click", reiniciarAjustes);
    }

    const crt = ventana.querySelector("[data-crt-boton]");
    if (crt) {
        crt.addEventListener("click", () => {
            ponerAjustesCrt(document.documentElement.dataset.crt !== "si", true);
        });
        pintarAjustesCrt();
    }
}

function abrirAjustes() {
    if (AJUSTES.ventana.open) {
        return;
    }
    // showModal() es lo bueno: oscurece el fondo, atrapa el tabulador,
    // cierra con Escape y deja inerte el resto de la página.
    // Pero si el navegador no sabe de <dialog> —pasa, y cuando pasa el
    // panel NO está escondido: se queda dibujado en medio de la página
    // desde que se carga, que es como se descubrió esto— no hay método
    // que llamar. Ahí se abre a mano: el atributo open lo enseña y
    // .ajustes-a-mano (en la hoja de estilos) lo pone centrado encima de
    // la página con su propio fondo oscuro.
    if (typeof AJUSTES.ventana.showModal === "function") {
        AJUSTES.ventana.showModal();
        return;
    }
    AJUSTES.ventana.setAttribute("open", "");
    AJUSTES.ventana.classList.add("ajustes-a-mano");
    document.addEventListener("keydown", cerrarAjustesConEscape);
}

function cerrarAjustesConEscape(evento) {
    if (evento.key === "Escape" || evento.key === "Esc") {
        cerrarAjustes();
    }
}

// Cerrar, sepa el navegador de <dialog> o no.
function cerrarAjustes() {
    const ventana = AJUSTES.ventana;
    if (!ventana) {
        return;
    }
    if (typeof ventana.close === "function") {
        ventana.close();
    } else {
        ventana.removeAttribute("open");
    }
    ventana.classList.remove("ajustes-a-mano");
    document.removeEventListener("keydown", cerrarAjustesConEscape);
    // close() ya devuelve el foco solo; a mano hay que hacerlo.
    if (AJUSTES.abrir && typeof ventana.close !== "function") {
        AJUSTES.abrir.focus();
    }
}

// =========================================
// ARMAR EL PANEL
// =========================================
// En fragmentos/ajustes.html solo vienen las filas de mandos. La
// caja que las agrupa (.ajustes-lista), la ventanita de la muestra
// (ejemplo.txt) y la nota del final se montan aquí.
//
// POR QUÉ AQUÍ Y NO EN EL HTML
// ----------------------------
// Ese fragmento se pide aparte y se guarda en la caché del navegador.
// Una copia vieja arriba, o un archivo que no se copió al mover la
// carpeta, y lo que falta es justo el final del panel: la muestra y la
// nota. Pasó, y costó cuatro vueltas verlo, porque el panel seguía
// funcionando y no había nada que pareciera roto. El script y la hoja
// de estilos van siempre a la vez, así que montándolo aquí el panel
// llega entero o no llega.
//
// La caja de los mandos se reaprovecha si ya está; la muestra y la nota
// se tiran y se vuelven a montar siempre (ver por qué, más abajo).
function armarAjustesPanel(ventana) {
    const cuerpo = ventana.querySelector(".ajustes-cuerpo");
    if (!cuerpo) {
        return;
    }

    // ---- la caja de los mandos ----
    // Hace falta para que la columna de la izquierda pueda desplazarse
    // ella sola sin llevarse la de la derecha por delante.
    let lista = cuerpo.querySelector(".ajustes-lista");
    if (!lista) {
        lista = document.createElement("div");
        lista.className = "ajustes-lista";
        // Se mete delante de la primera fila y luego se van metiendo
        // dentro todas: así no hay que acordarse de cuántas hay.
        const filas = cuerpo.querySelectorAll(":scope > .ajustes-fila");
        if (!filas.length) {
            return;
        }
        cuerpo.insertBefore(lista, filas[0]);
        filas.forEach((fila) => lista.appendChild(fila));
    }

    // ---- los dos mandos del final, si no estuvieran ----
    // Mismo criterio que la muestra, la nota y el botón de reiniciar: lo
    // que monta este archivo llega siempre. Si el fragmento que ha
    // llegado es una copia vieja —guardada en la caché del navegador, o
    // simplemente un archivo de hace dos versiones— se queda a medias
    // justo por el final, que es donde viven estos dos. Pasó: el filtro
    // CRT salía como "FILTRO" a secas, sin el ON/OFF, y la fila de
    // animaciones no salía en absoluto.
    //
    // Si el fragmento SÍ los trae, estas dos no tocan nada.
    arreglarAjustesCrt(lista);
    if (!lista.querySelector("[data-idioma-fila]")) {
        lista.insertBefore(armarAjustesIdioma(), lista.firstChild);
    }
    if (!lista.querySelector("[data-movimiento]")) {
        lista.appendChild(armarAjustesMovimiento());
    }

    // ---- la columna de la derecha: la muestra y la nota ----
    // Las dos juntas en una caja porque en escritorio son UNA columna, y
    // una fila flexible con tres cajas dentro saldrían tres columnas.
    //
    // SE TIRA LO QUE HAYA Y SE VUELVE A MONTAR, en vez de reaprovecharlo
    // si ya está. Suena a desperdicio y no lo es: lo que puede haber ahí
    // es una muestra de una versión vieja del fragmento, guardada en la
    // caché del navegador, con otra forma y sin la barra de ejemplo.txt.
    // Dejándola, el panel salía medio nuevo y medio viejo —que es
    // justamente el lío del que viene todo esto—; tirándola, lo que se
    // ve es siempre lo que dice este archivo.
    cuerpo.querySelectorAll(".ajustes-lado, .ajustes-ejemplo, .ajustes-pie")
        .forEach((viejo) => viejo.remove());

    const lado = document.createElement("div");
    lado.className = "ajustes-lado";
    lado.appendChild(armarAjustesEjemplo());

    // El botón de dejarlo todo como estaba, debajo de la muestra. Estaba
    // al final de la lista de mandos y en escritorio esa lista se
    // desplaza, así que había que bajar hasta abajo del todo para dar
    // con él —y es justo el botón al que se recurre cuando uno ya no
    // sabe qué ha tocado.
    //
    // Se MONTA aquí, no se mueve desde el HTML, por lo mismo que la
    // muestra y la nota: una copia vieja del fragmento en la caché del
    // navegador dejaba el panel a medias y el botón no aparecía por
    // ningún lado. Lo que monta este archivo llega siempre.
    // Quien le engancha el clic (initializeAjustes, más arriba) lo busca
    // por todo el panel después de esto, así que lo encuentra igual.
    const viejoReiniciar = cuerpo.querySelector("[data-ajustes-reiniciar]");
    if (viejoReiniciar) {
        const fila = viejoReiniciar.closest(".ajustes-fila") || viejoReiniciar;
        fila.remove();
    }
    lado.appendChild(armarAjustesReiniciar());

    lado.appendChild(armarAjustesPie());
    cuerpo.appendChild(lado);

    // Para que botones-ventana.js le ponga los −■✕ a la ventanita y
    // ventanas-plegables.js le monte el mando de plegar: los dos ya han
    // repasado la página cuando esto corre.
    document.dispatchEvent(new CustomEvent("ventanas:actualizar"));
}

// EL BOTÓN DEL FILTRO CRT, CON SU ON/OFF
//
// El botón dice "FILTRO CRT: OFF" y lo que cambia al pulsarlo es solo el
// trocito del final, que va en su propio <span data-crt-estado> (ver
// pintarAjustesCrt, más abajo: reescribir el texto entero se llevaba por
// delante el <abbr> que explica qué es CRT).
//
// Si ese trocito no está —fragmento viejo—, pintarAjustesCrt no encuentra
// dónde escribir y el botón se queda diciendo "FILTRO" para siempre, sin
// que nada parezca roto. Así que aquí se rehace la etiqueta entera.
function arreglarAjustesCrt(lista) {
    const boton = lista.querySelector("[data-crt-boton]");
    if (!boton || boton.querySelector("[data-crt-estado]")) {
        return;
    }

    let texto = boton.querySelector(".ajustes-crt-texto");
    if (!texto) {
        texto = document.createElement("span");
        texto.className = "ajustes-crt-texto";
        boton.appendChild(texto);
    }
    texto.textContent = ocT("FILTRO ");

    const sigla = document.createElement("abbr");
    sigla.title =
        ocT("Cathode Ray Tube: los monitores de tubo de antes, con sus rayas y las esquinas apagadas");
    sigla.textContent = ocT("CRT");
    texto.appendChild(sigla);
    texto.appendChild(document.createTextNode(": "));

    const estado = document.createElement("span");
    estado.setAttribute("data-crt-estado", "");
    estado.textContent = ocT("OFF");
    texto.appendChild(estado);
}


// LA FILA DE LAS ANIMACIONES
//
// "normal" o "sin animaciones". Lo que hace está en
// estilos/componentes/sin-movimiento.css; aquí solo se monta la fila por
// si el fragmento no la trae. Quien le engancha el clic es
// engancharAjustesOpciones("movimiento"), que corre después de esto.
//
// El <p> del nombre lleva id y el grupo lo apunta con aria-labelledby:
// así un lector de pantalla dice "animaciones, grupo" al entrar en los
// dos botones, en vez de soltar "normal" sin decir normal de qué.
function armarAjustesMovimiento() {
    const fila = document.createElement("div");
    fila.className = "ajustes-fila";

    const nombre = document.createElement("p");
    nombre.className = "ajustes-nombre";
    nombre.id = "ajustes-movimiento-nombre";
    nombre.textContent = ocT("animaciones");
    fila.appendChild(nombre);

    const mandos = document.createElement("div");
    mandos.className = "ajustes-mandos";
    mandos.setAttribute("role", "group");
    mandos.setAttribute("aria-labelledby", nombre.id);

    [
        ["", "normal"],
        ["quieto", ocT("sin animaciones")],
    ].forEach(([valor, etiqueta]) => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "ajustes-opcion";
        boton.setAttribute("data-movimiento", valor);
        // El marcado de verdad lo pone pintarAjustesOpciones() en cuanto
        // termina de armarse el panel; esto es solo para no dejarlo sin
        // atributo mientras tanto.
        boton.setAttribute("aria-pressed", "false");
        boton.textContent = etiqueta;
        mandos.appendChild(boton);
    });

    fila.appendChild(mandos);
    return fila;
}


// EL IDIOMA
//
// Un botón por idioma (de idiomas/lista.json, con cuánto lleva traducido).
// Al elegir uno se guarda en «richi-idioma» y la app vuelve a arrancar: los
// textos se ponen al cargar (ver arranque.js). «🧪 probar un archivo» carga
// un traducciones/<código>.json para ver cómo queda una traducción antes de
// que esté en la app; se guarda en «richi-idioma-prueba» hasta quitarla.
const AJUSTES_TRADUCIR = "https://github.com/rperezbarreda/pantalla_master/tree/main/traducciones";

// La bandera de cada idioma, dibujada (las de catalán, euskera y gallego
// no existen como emoji). La usan Aa y la entrada de la pantalla de máster.
const AJUSTES_BANDERAS = {
    es: '<rect width="30" height="20" fill="#c60b1e"/><rect y="5" width="30" height="10" fill="#ffc400"/>',
    ca: '<rect width="30" height="20" fill="#fcdd09"/><g fill="#da121a"><rect y="2.22" width="30" height="2.22"/>'
        + '<rect y="6.67" width="30" height="2.22"/><rect y="11.11" width="30" height="2.22"/><rect y="15.56" width="30" height="2.22"/></g>',
    eu: '<rect width="30" height="20" fill="#d52b1e"/><path d="M0 0L30 20M30 0L0 20" stroke="#009b48" stroke-width="3"/>'
        + '<path d="M15 0V20M0 10H30" stroke="#fff" stroke-width="3"/>',
    gl: '<rect width="30" height="20" fill="#fff"/><path d="M0 0L30 20" stroke="#0099cc" stroke-width="4"/>'
};
window.ocBandera = function (codigo) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "oc-bandera");
    svg.setAttribute("viewBox", "0 0 30 20");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.innerHTML = (AJUSTES_BANDERAS[codigo] || '<rect width="30" height="20" fill="#888"/>')
        + '<rect x=".5" y=".5" width="29" height="19" fill="none" stroke="#000" stroke-opacity=".4"/>';
    return svg;
};

function ajustesRecargar() {
    // Que vuelva a la campaña de antes, sin pasar por la entrada.
    try {
        sessionStorage.setItem("richi-master-recarga", "1");
    } catch (e) {
        // Sin sessionStorage: pasa por la entrada, nada más.
    }
    const almacen = window.ocAlmacen;
    const esperar = almacen && almacen.guardarYa ? almacen.guardarYa().catch(() => null) : Promise.resolve();
    esperar.then(() => location.reload());
}

function armarAjustesIdioma() {
    const fila = document.createElement("div");
    fila.className = "ajustes-fila";
    fila.setAttribute("data-idioma-fila", "");

    const nombre = document.createElement("p");
    nombre.className = "ajustes-nombre";
    nombre.id = "ajustes-idioma-nombre";
    nombre.textContent = ocT("🌐 idioma");
    fila.appendChild(nombre);

    const mandos = document.createElement("div");
    mandos.className = "ajustes-mandos";
    mandos.setAttribute("role", "group");
    mandos.setAttribute("aria-labelledby", nombre.id);
    fila.appendChild(mandos);

    const ahora = window.ocIdioma ? window.ocIdioma.codigo : "es";
    const aviso = document.createElement("p");
    aviso.className = "ajustes-grupo-nota";
    aviso.setAttribute("role", "status");

    function elegir(codigo) {
        if (codigo === ahora) {
            return;
        }
        guardarAjuste("richi-idioma", codigo, codigo === "es");
        aviso.textContent = ocT("Cambiando de idioma…");
        ajustesRecargar();
    }
    function pintar(lista) {
        mandos.replaceChildren();
        lista.forEach((x) => {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "ajustes-opcion";
            boton.lang = x.codigo;
            boton.setAttribute("aria-pressed", x.codigo === ahora ? "true" : "false");
            boton.append(window.ocBandera(x.codigo), document.createTextNode(" " + x.nombre));
            if (x.codigo !== "es") {
                const cuanto = document.createElement("span");
                cuanto.lang = document.documentElement.lang;
                cuanto.textContent = ocT(" · {n} % traducido", { n: x.interfaz });
                boton.appendChild(cuanto);
            }
            boton.addEventListener("click", () => elegir(x.codigo));
            mandos.appendChild(boton);
        });
    }
    const deSerie = [{ codigo: "es", nombre: "Castellano", interfaz: 100 }];
    if (ahora !== "es") {
        deSerie.push({ codigo: ahora, nombre: ahora, interfaz: 0 });
    }
    pintar(deSerie);
    fetch("idiomas/lista.json").then((r) => (r.ok ? r.json() : null)).then((lista) => {
        if (Array.isArray(lista) && lista.length) {
            pintar(lista.filter((x) => x && typeof x.codigo === "string" && typeof x.nombre === "string"));
        }
    }).catch(() => {});

    // Probar un archivo de la carpeta «traducciones».
    const prueba = document.createElement("div");
    prueba.className = "ajustes-mandos ajustes-mandos-anchos";
    const archivo = document.createElement("input");
    archivo.type = "file";
    archivo.accept = ".json,application/json";
        archivo.hidden = true;
    const probar = document.createElement("button");
    probar.type = "button";
    probar.className = "ajustes-opcion";
    probar.textContent = ocT("🧪 probar un archivo de traducción…");
    probar.addEventListener("click", () => {
        if (ahora === "es") {
            aviso.textContent = ocT("Elige antes el idioma de la traducción que quieres probar.");
            return;
        }
        archivo.click();
    });
    archivo.addEventListener("change", () => {
        const archivos = Array.from(archivo.files || []);
        archivo.value = "";
        if (!archivos.length) {
            return;
        }
        Promise.all(archivos.map((a) => a.text().then((t) => JSON.parse(t)))).then((leidos) => {
            // Sólo lo traducido (lo vacío sale en castellano igual).
            const textos = {};
            leidos.forEach((json) => {
                if (!json || typeof json !== "object" || Array.isArray(json)) {
                    throw new Error("formato");
                }
                Object.keys(json).forEach((k) => {
                    if (typeof json[k] === "string" && json[k].trim()) {
                        textos[k] = json[k];
                    }
                });
            });
            try {
                localStorage.setItem("richi-idioma-prueba", JSON.stringify({ codigo: ahora, textos }));
            } catch (e) {
                aviso.textContent = ocT("No cabe en el almacén de este navegador.");
                return;
            }
            aviso.textContent = ocT("Traducción de prueba cargada. Volviendo a arrancar…");
            ajustesRecargar();
        }).catch(() => {
            aviso.textContent = ocT("No he podido leer ese archivo: tiene que ser uno de la carpeta «traducciones» (por ejemplo, ca.json).");
        });
    });
    prueba.append(probar, archivo);
    if (window.ocIdioma && window.ocIdioma.prueba) {
        const quitar = document.createElement("button");
        quitar.type = "button";
        quitar.className = "ajustes-opcion";
        quitar.textContent = ocT("✕ quitar la traducción de prueba");
        quitar.addEventListener("click", () => {
            guardarAjuste("richi-idioma-prueba", "", true);
            aviso.textContent = ocT("Traducción de prueba quitada. Volviendo a arrancar…");
            ajustesRecargar();
        });
        prueba.appendChild(quitar);
    }
    fila.appendChild(prueba);

    const nota = document.createElement("p");
    nota.className = "ajustes-grupo-nota";
    nota.appendChild(document.createTextNode(ocT("Las traducciones las hace la comunidad. ")));
    const enlace = document.createElement("a");
    enlace.href = AJUSTES_TRADUCIR;
    enlace.target = "_blank";
    enlace.rel = "noopener";
    enlace.textContent = ocT("Cómo ayudar a traducir la app");
    nota.appendChild(enlace);
    fila.appendChild(nota);
    fila.appendChild(aviso);
    return fila;
}


// La muestra, en una ventana falsa de las del sitio.
//
// No necesita ni una línea más de JavaScript para cambiar: está dentro
// de la página, así que hereda el tamaño, la letra y la separación como
// todo lo demás y se mueve a la vez que se tocan los mandos.
//
// QUÉ LLEVA DENTRO, y por qué cada cosa:
//   · El titular en la fuente de los títulos, el párrafo en la de leer
//     y la línea de la fecha en la monoespaciada: son las tres letras
//     del sitio, y el mando de "la letra" las cambia las tres a la vez.
//   · Negrita, cursiva y un enlace, que es lo que de verdad aparece
//     dentro de una entrada y lo que peor se lee cuando una fuente no
//     acompaña: una cursiva mala se nota antes que un texto normal malo.
//   · Los dos botones del sitio, el macizo y el hueco. Son los dos
//     únicos colores que hay, y en los temas de alto contraste y en los
//     de terminal es donde más cambian.
//   · Y un muestrario de letras y signos: el pangrama en español —que
//     lleva todas las letras y además tildes, eñe y la u con diéresis—
//     y una tira de caracteres comunes, repetida en la fuente de leer y
//     en la monoespaciada. Es lo que hace falta para decidir si una
//     fuente vale: con "Llegó a mi vida en diciembre" no se ve si el
//     signo de interrogación de apertura está bien dibujado.
//
// NADA DE AQUÍ DENTRO SE PUEDE PULSAR, y es a propósito. Los botones y
// el enlace son <span>, no <button> ni <a>: todo esto va dentro de un
// aria-hidden, y un elemento al que se llega con el tabulador pero que
// un lector de pantalla no anuncia es de los peores fallos que hay.
// Siendo <span> no hay nada que enfocar y el dibujo es el mismo.
//
// El aria-hidden va en el CUERPO y no en la ventana entera: el texto de
// muestra no es nada que haya que leer —quien escucha la página ya
// tiene el nombre de cada mando—, pero el nombre de la ventana sí se
// anuncia, y dentro hay un botón de plegar, que escondido de los
// lectores de pantalla pero alcanzable con el tabulador es justo lo que
// no se debe hacer.

// La tira de caracteres comunes del muestrario. Está aquí arriba y no
// dentro de la función para no tenerla escrita dos veces: se usa en la
// fuente de leer y en la monoespaciada.
const AJUSTES_CARACTERES =
    "abc def ghi jkl mno pqrs tuv wxyz ABC DEF GHI JKL MNO PQRS TUV WXYZ 0123456789 !\"§ $%& /() =?* '<> #|; ²³~ @`´ ©«» ¤¼× {}";

function armarAjustesEjemplo() {
    const caja = document.createElement("div");
    caja.className = "ajustes-ejemplo";

    const barra = document.createElement("div");
    barra.className = "recent-entries-header";
    const titulo = document.createElement("h2");
    titulo.textContent = "ejemplo.txt";
    const mandos = document.createElement("div");
    mandos.className = "window-controls window-controls-small";
    mandos.setAttribute("data-window-controls", "");
    mandos.setAttribute("aria-hidden", "true");
    barra.appendChild(titulo);
    barra.appendChild(mandos);
    caja.appendChild(barra);

    const dentro = document.createElement("div");
    dentro.className = "ajustes-ejemplo-cuerpo";
    dentro.setAttribute("aria-hidden", "true");

    // ---- el titular ----
    const como = document.createElement("p");
    como.className = "ajustes-ejemplo-titulo";
    como.textContent = ocT("así se va a ver");
    dentro.appendChild(como);

    // ---- el párrafo, con negrita, cursiva y enlace ----
    const texto = document.createElement("p");
    texto.className = "ajustes-ejemplo-texto";
    texto.appendChild(document.createTextNode(ocT("«El veloz murciélago hindú comía feliz cardillo y kiwi.» Esto va en ")));
    const negrita = document.createElement("strong");
    negrita.textContent = ocT("negrita");
    texto.appendChild(negrita);
    texto.appendChild(document.createTextNode(ocT(", esto en ")));
    const cursiva = document.createElement("em");
    cursiva.textContent = ocT("cursiva");
    texto.appendChild(cursiva);
    texto.appendChild(document.createTextNode(ocT(" y esto es ")));
    const enlace = document.createElement("span");
    enlace.className = "ajustes-ejemplo-enlace";
    enlace.textContent = ocT("un enlace");
    texto.appendChild(enlace);
    texto.appendChild(document.createTextNode("."));
    dentro.appendChild(texto);

    // ---- el muestrario de caracteres ----
    const letras = document.createElement("p");
    letras.className = "ajustes-ejemplo-letras";
    letras.textContent = AJUSTES_CARACTERES;
    dentro.appendChild(letras);

    const letrasMono = document.createElement("p");
    letrasMono.className = "ajustes-ejemplo-letras ajustes-ejemplo-letras-mono";
    letrasMono.textContent = AJUSTES_CARACTERES;
    dentro.appendChild(letrasMono);

    // ---- los dos botones ----
    const botones = document.createElement("p");
    botones.className = "ajustes-ejemplo-botones";
    const macizo = document.createElement("span");
    macizo.className = "ajustes-ejemplo-boton ajustes-ejemplo-boton-macizo";
    macizo.textContent = ocT("botón macizo");
    const hueco = document.createElement("span");
    hueco.className = "ajustes-ejemplo-boton";
    hueco.textContent = ocT("botón hueco");
    botones.appendChild(macizo);
    botones.appendChild(hueco);
    dentro.appendChild(botones);

    // ---- la línea de datos, en monoespaciada ----
    const datos = document.createElement("p");
    datos.className = "ajustes-ejemplo-datos";
    datos.appendChild(document.createTextNode(ocT("28 sept 2026 · 3 min · ")));
    const etiqueta = document.createElement("span");
    etiqueta.className = "entry-tag";
    etiqueta.textContent = ocT("diario");
    datos.appendChild(etiqueta);
    dentro.appendChild(datos);

    caja.appendChild(dentro);
    return caja;
}

// El botón de volver a lo de fábrica, con su aviso al lado.
//
// La flecha de deshacer va en <svg> y no en un carácter (↺) ni en una
// imagen: lo mismo que el resto de los iconos del sitio. Un carácter lo
// dibuja la fuente de quien visita y sale de cualquier tamaño y
// descentrado, y una imagen es un archivo más que pedir. Así toma el
// color del texto del botón y crece con él.
//
// El aviso lleva role="status" para que, al pulsar, un lector de
// pantalla lo lea solo: si no, el único indicio de que ha pasado algo es
// que la página cambia de aspecto, y quien lo pulsa puede no estar
// viéndola.
function armarAjustesReiniciar() {
    const fila = document.createElement("div");
    fila.className = "ajustes-fila ajustes-fila-reiniciar";

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "ajustes-reiniciar";
    boton.setAttribute("data-ajustes-reiniciar", "");

    const icono = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icono.setAttribute("class", "ajustes-reiniciar-icono");
    icono.setAttribute("viewBox", "0 0 24 24");
    icono.setAttribute("aria-hidden", "true");
    icono.setAttribute("focusable", "false");
    [
        "M4.5 10.5A8 8 0 1 1 5.6 16",
        "M3.4 4.6v6h6",
    ].forEach((d) => {
        const trazo = document.createElementNS("http://www.w3.org/2000/svg", "path");
        trazo.setAttribute("d", d);
        trazo.setAttribute("fill", "none");
        trazo.setAttribute("stroke", "currentColor");
        trazo.setAttribute("stroke-width", "2.4");
        trazo.setAttribute("stroke-linecap", "round");
        trazo.setAttribute("stroke-linejoin", "round");
        icono.appendChild(trazo);
    });
    boton.appendChild(icono);

    const nombre = document.createElement("span");
    nombre.textContent = ocT("reiniciar cambios");
    boton.appendChild(nombre);
    fila.appendChild(boton);

    const aviso = document.createElement("p");
    aviso.className = "ajustes-reiniciar-aviso";
    aviso.setAttribute("role", "status");
    aviso.setAttribute("data-ajustes-reiniciado", "");
    aviso.hidden = true;
    aviso.textContent = ocT("Listo: todo ha vuelto a como venía de fábrica.");
    fila.appendChild(aviso);

    return fila;
}

function armarAjustesPie() {
    const pie = document.createElement("p");
    pie.className = "ajustes-pie";
    pie.appendChild(
        document.createTextNode(
            ocT("Lo elegido se queda guardado en este navegador para la próxima visita. ")
        )
    );
    const enlace = document.createElement("a");
    enlace.href = "/web/accesibilidad/accesibilidad.html";
    enlace.textContent = ocT("Más sobre la accesibilidad de la web");
    pie.appendChild(enlace);
    return pie;
}

// =========================================
// LO GUARDADO
// =========================================

// Leer y escribir en el almacén del navegador puede fallar: navegando
// en privado, o con las cookies de sitio bloqueadas, tira una
// excepción. Si pasa, los ajustes valen igual para esta visita y lo
// único que se pierde es que se recuerden.
function leerAjuste(clave, porDefecto, esNumero) {
    try {
        const valor = localStorage.getItem(clave);
        if (valor === null) {
            return porDefecto;
        }
        return esNumero ? parseFloat(valor) : valor;
    } catch (error) {
        return porDefecto;
    }
}

function guardarAjuste(clave, valor, esElDeSiempre) {
    try {
        // Lo de fábrica no se guarda: se borra. Así quien no ha tocado
        // nada y quien ha vuelto al normal están igual, y el día que
        // cambie lo de fábrica les vale a los dos.
        if (esElDeSiempre) {
            localStorage.removeItem(clave);
        } else {
            localStorage.setItem(clave, String(valor));
        }
    } catch (error) {
        // Ver arriba.
    }
}

// =========================================
// EL TAMAÑO
// =========================================

// El paso de la lista que corresponde a una escala guardada. Si lo
// guardado no es ninguno de los cinco (una visita vieja, o alguien
// tocando el almacén a mano), se coge el más cercano en vez de tirarlo:
// el texto grande de quien lo necesita no se pierde por un decimal.
function pasoDeAjustes(escala) {
    if (!isFinite(escala) || escala <= 0) {
        return AJUSTES_TAMANOS.indexOf(1);
    }
    let mejor = 0;
    for (let i = 1; i < AJUSTES_TAMANOS.length; i += 1) {
        if (Math.abs(AJUSTES_TAMANOS[i] - escala) < Math.abs(AJUSTES_TAMANOS[mejor] - escala)) {
            mejor = i;
        }
    }
    return mejor;
}

function aplicarAjustesTamano(paso, guardar) {
    paso = Math.min(AJUSTES_TAMANOS.length - 1, Math.max(0, Math.round(paso) || 0));
    AJUSTES.paso = paso;
    const escala = AJUSTES_TAMANOS[paso];
    document.documentElement.style.setProperty("--escala", escala);
    if (guardar) {
        guardarAjuste(AJUSTES_GUARDADO_TAMANO, escala, escala === 1);
    }

    if (AJUSTES.rango) {
        AJUSTES.rango.value = String(paso);
        // El deslizador va de 0 a 4, que no le dice nada a quien escucha
        // la página: lo que se anuncia es el porcentaje.
        AJUSTES.rango.setAttribute("aria-valuetext", `${Math.round(escala * 100)}%`);
    }
    const valor = AJUSTES.ventana.querySelector("[data-tamano-valor]");
    if (valor) {
        valor.textContent = `${Math.round(escala * 100)}%`;
    }
}

// =========================================
// LA SEPARACIÓN Y LA LETRA
// =========================================
// Los dos funcionan igual —una fila de botones de los que solo uno
// está pulsado— así que comparten código. Lo único que cambia es dónde
// se escribe lo elegido: la separación en una variable de CSS y la
// letra en un atributo del <html>.

function engancharAjustesOpciones(cual) {
    AJUSTES.ventana.querySelectorAll(`[data-${cual}]`).forEach((boton) => {
        boton.addEventListener("click", () => {
            ponerAjuste(cual, boton.getAttribute(`data-${cual}`), true);
            pintarAjustesOpciones();
            // La velocidad de la voz tiene unos botones gemelos debajo
            // del de escuchar, en las entradas y los relatos. Con esto
            // se marcan igual que éstos (y al revés: ellos avisan con
            // el mismo evento). Lo escucha
            // scripts/componentes/leer-en-voz.js.
            document.dispatchEvent(new CustomEvent("ajustes:actualizar"));
        });
    });
}

// Los dos escriben lo mismo: un atributo en el <html>. Vacío quiere
// decir "lo de siempre", y entonces el atributo se quita en vez de
// quedarse puesto a vacío, que es lo que miran los selectores del CSS.
function ponerAjuste(cual, valor, guardar) {
    const raiz = document.documentElement;
    if (valor) {
        raiz.setAttribute(`data-${cual}`, valor);
    } else {
        raiz.removeAttribute(`data-${cual}`);
    }
    if (guardar) {
        const claves = {
            interlineado: AJUSTES_GUARDADO_INTERLINEADO,
            letra: AJUSTES_GUARDADO_LETRA,
            estilo: AJUSTES_GUARDADO_ESTILO,
            voz: AJUSTES_GUARDADO_VOZ,
            movimiento: AJUSTES_GUARDADO_MOVIMIENTO,
        };
        guardarAjuste(claves[cual], valor, !valor);
    }
}

// Marca como pulsado el botón que coincide con lo que hay puesto ahora
// mismo en el <html>, que es la única verdad: así da igual si lo puso
// el cargador al arrancar o alguien aquí hace un momento.
function pintarAjustesOpciones() {
    const raiz = document.documentElement;
    const ahora = {
        interlineado: raiz.getAttribute("data-interlineado") || "",
        letra: raiz.getAttribute("data-letra") || "",
        estilo: raiz.getAttribute("data-estilo") || "",
        voz: raiz.getAttribute("data-voz") || "",
        movimiento: raiz.getAttribute("data-movimiento") || "",
    };
    ["interlineado", "letra", "estilo", "voz", "movimiento"].forEach((cual) => {
        AJUSTES.ventana.querySelectorAll(`[data-${cual}]`).forEach((boton) => {
            const suyo = boton.getAttribute(`data-${cual}`);
            boton.setAttribute("aria-pressed", suyo === ahora[cual] ? "true" : "false");
        });
    });
}

// =========================================
// EL FILTRO DE PANTALLA VIEJA
// =========================================
// Rayas horizontales y las esquinas apagadas, como un monitor de tubo.
// No hay ni un elemento para esto: lo dibuja un ::after del propio <html>
// (ver estilos/componentes/ajustes.css), así que funciona en todas las
// páginas —el 404 incluido, que no tiene barra lateral— sin tener que
// meter un div en ninguna parte.
//
// Va apagado de fábrica a propósito: unas rayas encima del texto le
// quitan contraste, y esta web se ha medido entera para que no le falte.
// Quien lo encienda sabe lo que hace.

function ponerAjustesCrt(encendido, guardar) {
    const raiz = document.documentElement;
    if (encendido) {
        raiz.dataset.crt = "si";
    } else {
        delete raiz.dataset.crt;
    }
    if (guardar) {
        guardarAjuste(AJUSTES_GUARDADO_CRT, "si", !encendido);
    }
    pintarAjustesCrt();
}

function pintarAjustesCrt() {
    const boton = AJUSTES.ventana.querySelector("[data-crt-boton]");
    if (!boton) {
        return;
    }
    const encendido = document.documentElement.dataset.crt === "si";
    boton.setAttribute("aria-pressed", encendido ? "true" : "false");
    boton.setAttribute(
        "aria-label",
        encendido
            ? ocT("Quitar el filtro CRT")
            : ocT("Poner el filtro CRT")
    );
    // Solo se cambia el ON/OFF, no el texto entero: dentro hay un
    // <abbr> explicando qué es CRT, y reescribiendo el textContent del
    // botón se lo llevaba por delante en cuanto se encendía la primera
    // vez (y encima solo entonces, que son los fallos que no se ven).
    const estado = boton.querySelector("[data-crt-estado]");
    if (estado) {
        estado.textContent = encendido ? "ON" : "OFF";
    }
}

// =========================================
// DEJARLO TODO COMO ESTABA
// =========================================
// Con ocho mandos aquí dentro es fácil acabar en una combinación rara y
// no acordarse de qué se tocó. Esto los devuelve todos de una vez.
//
// El del rastro del cursor es el único que no se toca desde aquí: lo
// lleva scripts/componentes/rastro-cursor.js con su propia tecla
// guardada, así que en vez de meter mano en sus cosas se le da al botón
// como lo daría una persona. Es un poco rodeo, pero es la frontera
// limpia: cada componente sigue siendo el dueño de lo suyo.

function reiniciarAjustes() {
    aplicarAjustesTamano(AJUSTES_TAMANOS.indexOf(1), true);
    ponerAjuste("interlineado", "", true);
    ponerAjuste("letra", "", true);
    ponerAjuste("estilo", "", true);
    ponerAjuste("voz", "", true);
    ponerAjuste("movimiento", "", true);
    ponerAjustesCrt(false, true);
    pintarAjustesOpciones();
    document.dispatchEvent(new CustomEvent("ajustes:actualizar"));

    // El tema. Antes esto pulsaba el botón del oscuro, pero "como
    // estaba" ya no es el oscuro: desde que la web hace caso al modo
    // claro u oscuro del aparato, lo de fábrica es "que decida el
    // sistema". Pulsar un botón dejaría una elección guardada, que es
    // justo lo contrario de lo que promete este botón. Lo hace
    // scripts/tema.js, que es quien sabe del tema.
    if (typeof olvidarTemaGuardado === "function") {
        olvidarTemaGuardado();
    }

    // Y el brillito, que viene encendido de fábrica.
    const brillito = document.getElementById("cursor-trail-toggle");
    if (brillito && brillito.getAttribute("aria-pressed") === "false") {
        brillito.click();
    }

    // Un aviso que se lee solo: si no, quien no ve la página no tiene
    // forma de saber que ha pasado algo.
    const aviso = AJUSTES.ventana.querySelector("[data-ajustes-reiniciado]");
    if (aviso) {
        aviso.hidden = false;
        window.clearTimeout(AJUSTES.avisoReloj);
        AJUSTES.avisoReloj = window.setTimeout(() => {
            aviso.hidden = true;
        }, 4000);
    }
}
