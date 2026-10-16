// =========================================
// COMPONENTE: ESCUCHAR LA ENTRADA
// =========================================
// Un botón al lado del tiempo de lectura, en las entradas del blog y en
// los relatos, que lee el texto en voz alta.
//
// Mientras lee, va iluminando el párrafo que suena y lo acerca si se
// había quedado fuera de la pantalla: para seguir un texto largo con la
// vista eso ayuda más que ninguna otra cosa.
//
// Lo hace el propio navegador, con la voz que tenga instalada quien
// visita la web (la misma que usan las funciones de lectura del
// sistema). NO SALE NADA DE SU ORDENADOR: no hay servidor, ni cuenta, ni
// se manda el texto a ninguna parte, y no pesa un solo byte más.
//
// SI NO HAY VOZ EN ESPAÑOL
// ------------------------
// El botón no desaparece: al pulsarlo abre una explicación de por qué no
// puede y de cómo se añade una voz en cada sistema. Un botón que se
// esconde deja a quien lo necesita sin saber que existía; uno que no
// hace nada al pulsarlo parece roto. Los pasos van en plan "abre los
// ajustes y busca voz", sin rutas de menú exactas, porque esas cambian
// con cada versión de Windows y de Android y caducarían en meses.
//
// Si el navegador es tan viejo que no tiene la función, ahí sí se
// esconde: no hay nada que explicar.
//
// LA LISTA DE VOCES LLEGA TARDE
// -----------------------------
// En Chrome getVoices() devuelve una lista vacía la primera vez y se
// rellena luego, avisando con "voiceschanged". Por eso no se decide nada
// hasta que esa lista llega (o hasta que se agota la espera): si se
// mirara solo al arrancar, en Chrome saldría siempre que no hay voces.
//
// OJO CON LOS NOMBRES
// -------------------
// Todos los scripts comparten el mismo ámbito global y dos funciones con
// el mismo nombre se pisan, así que todo lo de aquí lleva "voz" en el
// nombre. Se comprueba con herramientas/4-comprobar/nombres-repetidos.py.

const VOZ_ESPERA_VOCES = 2500;

// Lo que se multiplica la velocidad normal según lo elegido en la
// ventana de accesibilidad. Pasarse de rápido no se entiende y pasarse
// de lento cansa, así que son dos pasos cortos a cada lado.
const VOZ_VELOCIDADES = { lenta: 0.75, rapida: 1.35 };

// Los tres pasos de velocidad («lenta», normal y «rápida») son botones
// de fragmentos/texto-a-voz.html, cada uno con su data-voz-paso: los
// mismos valores que el mando de la ventana de accesibilidad (data-voz).

const VOZ = {
    cuerpo: null,
    // La ventana falsa (texto_a_voz.mp3) que envuelve los mandos.
    ventana: null,
    boton: null,
    // Los tres botones de velocidad que van debajo del de escuchar.
    velocidad: null,
    aviso: null,
    voz: null,
    leyendo: false,
    // El trozo que se está leyendo ahora mismo, para quitarle el
    // resaltado cuando pase al siguiente.
    resaltado: null,
};

initializeLeerEnVoz();

async function initializeLeerEnVoz() {
    // La entrada trae la ventana ya escrita y dormida (la copia
    // herramientas/3-generadores/generar-posts.py de
    // fragmentos/texto-a-voz.html). Si al final no se puede escuchar, sobra.
    const hueco = document.querySelector("[data-voz-esqueleto]");
    // Sin la función del navegador no hay nada que ofrecer.
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        if (hueco) {
            hueco.remove();
        }
        return;
    }
    const cuerpo = document.querySelector(".blog-post-body, .relato-post-body");
    if (!cuerpo) {
        if (hueco) {
            hueco.remove();
        }
        return;
    }
    VOZ.cuerpo = cuerpo;

    if (!(await montarBotonDeVoz())) {
        return;
    }

    buscarVozEnEspanyol();

    // Al salir de la página se corta: si no, en algunos navegadores la
    // voz sigue hablando sola mientras se navega a otra parte.
    window.addEventListener("pagehide", pararVoz);
}

// Dónde va: lo primero de la columna de la foto, que es la que acompaña
// al texto y está vacía por arriba. En la cabecera de la entrada, que es
// donde estaba antes, competía por el sitio con el título, la fecha y los
// dos atajos, y en cuanto la ventana se estrechaba la fila se partía.
//
// Se busca la COLUMNA (.blog-post-side) y no la foto (.blog-post-aside):
// la foto es un <figure>, y meterle dentro una ventana entera que no
// tiene nada que ver con la imagen ni con su pie es mentirle al que
// escucha la página, que oye "figura" y luego unos mandos de sonido.
// Siendo hermana de la foto y de otras_entradas.txt, además, le toca el
// mismo hueco de 24px que a ellas sin tener que escribir márgenes.
// Si una entrada no lleva columna, cae al principio del cuerpo.
function dondeVaElBotonDeVoz() {
    return (
        document.querySelector(".blog-post-side, .relato-post-side") ||
        document.querySelector(".blog-post-aside, .relato-post-aside") ||
        VOZ.cuerpo
    );
}

// =========================================
// SU PROPIA VENTANA: texto_a_voz.mp3
// =========================================
// El botón de escuchar y los tres de velocidad no van sueltos en la
// columna: van en una ventana falsa de las del sitio, con su barra de
// título y sus −■✕, igual que otras_entradas.txt justo debajo.
//
// No es decoración. Sueltos, eran cuatro botones flotando encima de una
// foto enmarcada y de una ventana con marco: lo único de la columna sin
// caja propia, y por eso lo que peor se encontraba. Metidos en una
// ventana que se llama texto_a_voz.mp3 se sabe de qué son los mandos
// antes de leerlos, y de paso se pliegan con el − como todo lo demás:
// quien no vaya a escuchar la entrada se los quita de en medio y deja la
// columna para la foto.
//
// La cabecera es la compartida (.recent-entries-header), así que los
// −■✕ se los rellena scripts/componentes/botones-ventana.js y el −
// la pliega de verdad (ventanas-plegables.js). A los dos hay que
// avisarlos con "ventanas:actualizar": esta ventana se monta desde JS y
// aparece después de que ellos hayan repasado la página.
async function montarBotonDeVoz() {
    if (VOZ.boton) {
        return true;
    }
    // La ventana está escrita UNA vez, en fragmentos/texto-a-voz.html. Lo
    // normal es que la página ya la traiga (ver arriba); si no la trae
    // (una entrada recién escrita a la que aún no se le han pasado los
    // generadores), se pide el fragmento y se pone en su sitio.
    let ventana = document.querySelector("[data-voz-esqueleto]");
    if (!ventana) {
        const sitio = dondeVaElBotonDeVoz();
        if (!sitio) {
            return false;
        }
        try {
            const ruta = "/fragmentos/texto-a-voz.html";
            const respuesta = await fetch(window.conVersion ? window.conVersion(ruta) : ruta);
            if (!respuesta.ok) {
                return false;
            }
            // Un archivo de esta misma web, nada que venga de fuera: se
            // lee como documento y se adopta su primer elemento.
            const leido = new DOMParser().parseFromString(await respuesta.text(), "text/html");
            ventana = leido.body.firstElementChild
                ? document.importNode(leido.body.firstElementChild, true) : null;
        } catch (error) {
            return false;
        }
        if (!ventana || !ventana.classList.contains("voz-ventana")) {
            return false;
        }
        sitio.insertBefore(ventana, sitio.firstChild);
    }

    // Despertarla: que se vea, que se lea y que se pueda pulsar.
    ventana.removeAttribute("data-voz-esqueleto");
    ventana.removeAttribute("aria-hidden");
    ventana.querySelectorAll("[tabindex='-1']").forEach((b) => b.removeAttribute("tabindex"));
    const mandos = ventana.querySelector(".window-controls");
    if (mandos) {
        mandos.setAttribute("data-window-controls", "");
        mandos.setAttribute("aria-hidden", "true");
    }
    const boton = ventana.querySelector(".voz-boton");
    if (!boton) {
        return false;
    }
    boton.addEventListener("click", alPulsarVoz);
    pintarVoz(boton, "escuchar");
    VOZ.ventana = ventana;
    VOZ.boton = boton;

    const velocidad = ventana.querySelector(".voz-velocidad");
    if (velocidad) {
        velocidad.querySelectorAll("[data-voz-paso]").forEach((b) => {
            b.addEventListener("click", () => ponerVelocidadDeVoz(b.getAttribute("data-voz-paso")));
        });
        VOZ.velocidad = velocidad;
        pintarVelocidadDeVoz();
    }
    document.dispatchEvent(new CustomEvent("ventanas:actualizar"));
    return true;
}

// =========================================
// LA VELOCIDAD, AQUÍ MISMO
// =========================================
// La velocidad se elige también en la ventana de accesibilidad, con el
// resto de ajustes, y ahí se queda: es una preferencia tuya, como el
// tamaño de la letra, y vale para todas las entradas.
//
// Pero es la única de todas que se descubre USÁNDOLA. Nadie sabe si una
// voz le va rápida hasta que la oye, y para entonces está leyendo una
// entrada, no mirando los ajustes: tener que parar, abrir la ventana,
// buscar el mando, cambiarlo y volver a darle al play es justo la clase
// de paseo que hace que la gente deje de usar una cosa. Así que los tres
// botones se repiten aquí debajo.
//
// NO ES UN AJUSTE APARTE: los dos sitios escriben lo mismo (data-voz en
// el <html>) y lo guardan en la misma clave. Cambiar aquí mueve el mando
// de la ventana y al revés, y para eso se avisan con el evento
// "ajustes:actualizar".
//
// El atributo se llama data-voz-paso y no data-voz a secas a propósito:
// data-voz es el que lleva el <html>, y un querySelectorAll("[data-voz]")
// se llevaría por delante la propia página. Es el mismo tropiezo que ya
// hubo con data-crt.
function ponerVelocidadDeVoz(valor) {
    const raiz = document.documentElement;
    if (valor) {
        raiz.setAttribute("data-voz", valor);
    } else {
        raiz.removeAttribute("data-voz");
    }
    // Guardar es cosa de la ventana de accesibilidad, que es quien sabe
    // de claves y de qué hacer si el almacén falla. Si por lo que sea no
    // está cargada, el cambio vale igual para esta visita.
    if (typeof guardarAjuste === "function") {
        guardarAjuste("richi-voz", valor, !valor);
    }
    pintarVelocidadDeVoz();
    // Para que el mando de la ventana se entere y se marque igual.
    document.dispatchEvent(new CustomEvent("ajustes:actualizar"));
}

function pintarVelocidadDeVoz() {
    if (!VOZ.velocidad) {
        return;
    }
    const ahora = document.documentElement.getAttribute("data-voz") || "";
    VOZ.velocidad.querySelectorAll("[data-voz-paso]").forEach((b) => {
        b.setAttribute(
            "aria-pressed",
            b.getAttribute("data-voz-paso") === ahora ? "true" : "false"
        );
    });
}

// Y al revés: si se cambia desde la ventana de accesibilidad, estos
// botones se vuelven a marcar solos.
document.addEventListener("ajustes:actualizar", pintarVelocidadDeVoz);

// =========================================
// LA VOZ
// =========================================

// Se queda con una voz en español. Primero una de España si la hay, y si
// no cualquier otra ("es-MX", "es-AR"...), que leer con otro acento es
// infinitamente mejor que no poder leer.
function escogerVozEnEspanyol() {
    let voces = [];
    try {
        voces = window.speechSynthesis.getVoices() || [];
    } catch (error) {
        return null;
    }
    const enEspanyol = voces.filter((v) => (v.lang || "").toLowerCase().startsWith("es"));
    if (!enEspanyol.length) {
        return null;
    }
    return (
        enEspanyol.find((v) => (v.lang || "").toLowerCase() === "es-es") || enEspanyol[0]
    );
}

function buscarVozEnEspanyol() {
    VOZ.voz = escogerVozEnEspanyol();
    if (VOZ.voz) {
        return;
    }
    // Todavía no: puede que la lista aún no haya llegado.
    const alCambiar = () => {
        VOZ.voz = escogerVozEnEspanyol();
        if (VOZ.voz) {
            window.speechSynthesis.removeEventListener("voiceschanged", alCambiar);
        }
    };
    window.speechSynthesis.addEventListener("voiceschanged", alCambiar);
    window.setTimeout(alCambiar, VOZ_ESPERA_VOCES);
}

// =========================================
// EL BOTÓN
// =========================================

function alPulsarVoz() {
    // Se vuelve a mirar aquí y no solo al arrancar: la lista de voces
    // puede haber llegado entre medias.
    if (!VOZ.voz) {
        VOZ.voz = escogerVozEnEspanyol();
    }
    if (!VOZ.voz) {
        alternarAvisoDeVoz();
        return;
    }
    if (VOZ.leyendo) {
        pararVoz();
        return;
    }
    empezarVoz();
}

function empezarVoz() {
    const texto = textoDeLaEntrada();
    if (!texto) {
        return;
    }
    // Por si quedaba algo de antes a medias.
    window.speechSynthesis.cancel();

    // Troceado por párrafos y no de una tirada: con textos largos varios
    // navegadores se cortan solos a mitad, y además así parar es
    // inmediato en vez de esperar a que termine la frase.
    const velocidad =
        VOZ_VELOCIDADES[document.documentElement.dataset.voz || ""] || 1;

    texto.forEach(({ palabras, elemento }) => {
        const frase = new SpeechSynthesisUtterance(palabras);
        frase.rate = velocidad;
        // Se va iluminando el trozo que suena. Para seguir un texto
        // largo con la vista esto ayuda más que cualquier otra cosa: no
        // hay que ir buscando por dónde iba la voz.
        frase.addEventListener("start", () => resaltarVoz(elemento));
        frase.addEventListener("end", () => {
            if (VOZ.resaltado === elemento) {
                quitarResaltadoDeVoz();
            }
        });
        // Elegir la voz a mano puede fallar en algún navegador raro. Si
        // pasa, se deja solo el idioma y que el navegador escoja él: es
        // mejor que se lea con otra voz a que no se lea nada, que es lo
        // que ocurría antes —la excepción cortaba la lectura entera y el
        // botón se quedaba como si no se hubiera pulsado.
        try {
            frase.voice = VOZ.voz;
        } catch (error) {
            // Que elija el navegador.
        }
        frase.lang = (VOZ.voz && VOZ.voz.lang) || "es-ES";
        window.speechSynthesis.speak(frase);
    });

    const ultima = window.speechSynthesis;
    VOZ.leyendo = true;
    pintarVoz(VOZ.boton, "parar");

    // Cuando se acaba todo, el botón vuelve a su sitio. No hay un evento
    // de "se acabó la cola", así que se mira de vez en cuando; es lo que
    // hay con esta API.
    //
    // Hacen falta DOS comprobaciones seguidas en silencio para darlo por
    // terminado: entre un párrafo y el siguiente hay navegadores en los
    // que "speaking" se pone en falso un instante, y con una sola mirada
    // el botón volvía a "escuchar" y se apagaba el resaltado a mitad de
    // la lectura.
    let silencios = 0;
    const vigilar = window.setInterval(() => {
        if (ultima.speaking || ultima.pending) {
            silencios = 0;
            return;
        }
        silencios += 1;
        if (silencios < 2) {
            return;
        }
        window.clearInterval(vigilar);
        VOZ.leyendo = false;
        quitarResaltadoDeVoz();
        pintarVoz(VOZ.boton, "escuchar");
    }, 500);
}

function pararVoz() {
    try {
        window.speechSynthesis.cancel();
    } catch (error) {
        // Si no se puede parar, tampoco se estaba leyendo.
    }
    quitarResaltadoDeVoz();
    VOZ.leyendo = false;
    if (VOZ.boton) {
        pintarVoz(VOZ.boton, "escuchar");
    }
}

// El texto de la entrada, párrafo a párrafo, con el elemento de cada
// uno al lado para poder iluminarlo cuando le toque sonar. Se saltan el
// índice de apartados y los pies de foto, que son navegación y notas al
// margen y oírlos en medio del relato despista más que ayuda.
function textoDeLaEntrada() {
    const trozos = [];
    VOZ.cuerpo.querySelectorAll("h2, h3, p, li, blockquote").forEach((elemento) => {
        if (elemento.closest(".lectura-indice, figcaption, .voz-aviso")) {
            return;
        }
        const palabras = (elemento.textContent || "").trim();
        if (palabras) {
            trozos.push({ palabras, elemento });
        }
    });
    return trozos;
}

// =========================================
// LO QUE SUENA, ILUMINADO
// =========================================

function resaltarVoz(elemento) {
    quitarResaltadoDeVoz();
    elemento.classList.add("voz-leyendo");
    VOZ.resaltado = elemento;

    // Y se acerca, si se había quedado fuera de la pantalla. Sin suave
    // para quien haya pedido menos movimiento: un texto largo son
    // decenas de saltos seguidos.
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
        elemento.scrollIntoView({
            block: "center",
            behavior: quieto ? "auto" : "smooth",
        });
    } catch (error) {
        // Navegadores viejos: sin acercar, pero iluminado igual.
    }
}

function quitarResaltadoDeVoz() {
    if (VOZ.resaltado) {
        VOZ.resaltado.classList.remove("voz-leyendo");
        VOZ.resaltado = null;
    }
}

function pintarVoz(boton, estado) {
    const parando = estado === "parar";
    boton.innerHTML =
        '<span class="voz-icono" aria-hidden="true">' +
        (parando ? "■" : "▶") +
        "</span>" +
        '<span class="voz-texto">' +
        (parando ? "parar" : "escuchar") +
        "</span>";
    boton.setAttribute(
        "aria-label",
        parando ? "Parar la lectura en voz alta" : "Escuchar esta entrada en voz alta"
    );
    boton.setAttribute("aria-pressed", parando ? "true" : "false");
}

// =========================================
// SI NO HAY NINGUNA VOZ INSTALADA
// =========================================

function alternarAvisoDeVoz() {
    if (VOZ.aviso) {
        const abierto = !VOZ.aviso.hidden;
        VOZ.aviso.hidden = abierto;
        VOZ.boton.setAttribute("aria-expanded", abierto ? "false" : "true");
        return;
    }

    // La explicación va en otra ventana falsa, debajo de texto_a_voz.mp3
    // y FUERA de ella: dentro, plegar los mandos se llevaría por delante
    // la explicación de por qué no funcionan, que es justo lo que hay
    // que poder leer en ese momento.
    // Lleva la cabecera de siempre, así que los −■✕ se los rellena
    // scripts/componentes/botones-ventana.js y el − la pliega de verdad
    // (ventanas-plegables.js): es un texto largo que se lee una vez, y
    // poder dejarlo recogido sin perderlo viene bien. A los dos hay que
    // avisarlos, que esta ventana aparece mucho después de que ellos
    // hayan repasado la página.
    const aviso = document.createElement("div");
    aviso.className = "voz-aviso";
    aviso.id = "voz-aviso";
    aviso.innerHTML = avisoDeVozHTML();
    (VOZ.ventana || VOZ.boton).insertAdjacentElement("afterend", aviso);
    document.dispatchEvent(new CustomEvent("ventanas:actualizar"));
    VOZ.boton.setAttribute("aria-expanded", "true");
    VOZ.boton.setAttribute("aria-controls", "voz-aviso");
    VOZ.aviso = aviso;

    const cerrar = aviso.querySelector("[data-voz-cerrar]");
    if (cerrar) {
        cerrar.addEventListener("click", () => {
            aviso.hidden = true;
            VOZ.boton.setAttribute("aria-expanded", "false");
            VOZ.boton.focus();
        });
    }
}

// Los pasos de cada sistema. A propósito SIN rutas de menú exactas: los
// ajustes de Windows y de Android cambian de sitio con cada versión y
// una ruta escrita hoy estaría mal dentro de un año. "Busca «voz»" sigue
// valiendo siempre.
function avisoDeVozHTML() {
    const pasos = [
        ["Windows", "en la configuración, busca «voz» y añade una en español."],
        ["Mac y iPhone", "Ajustes → Accesibilidad → Contenido hablado → Voces."],
        ["Android", "Ajustes → Accesibilidad, y busca «texto a voz»."],
        ["Linux", "instala speech-dispatcher con una voz en español, como espeak-ng."],
    ];
    const lista = pasos
        .map(([sistema, como]) => `<li><strong>${sistema}:</strong> ${como}</li>`)
        .join("");
    return (
        '<div class="recent-entries-header">' +
        "<h2>sin_voz.txt</h2>" +
        '<div class="window-controls window-controls-small" data-window-controls aria-hidden="true"></div>' +
        "</div>" +
        '<div class="voz-aviso-cuerpo">' +
        "<p>La lectura en voz alta la hace tu navegador con las voces de tu " +
        "sistema, y no tienes ninguna en español. Se añade una vez y vale " +
        "para todas las webs:</p>" +
        `<ul class="voz-aviso-lista">${lista}</ul>` +
        '<p class="voz-aviso-nota">Luego recarga esta página. ' +
        'En <a href="/web/accesibilidad/accesibilidad.html">accesibilidad</a> ' +
        "está lo demás que sí puedes ajustar aquí mismo.</p>" +
        '<button class="voz-aviso-cerrar" type="button" data-voz-cerrar>entendido</button>' +
        "</div>"
    );
}
