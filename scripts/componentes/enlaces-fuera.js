// =========================================
// COMPONENTE: LOS ENLACES QUE SALEN DE LA WEB
// =========================================
// Marca con una flechita los enlaces que llevan a otra web, para saber
// antes de pulsar que te vas de aquí.
//
// POR QUÉ NO BASTA CON LA FLECHITA
// --------------------------------
// Las reglas de accesibilidad piden dos cosas que un dibujo solo no
// cumple:
//
//   - Que el aviso no dependa SOLO de ver algo. Quien escucha la página
//     no ve ninguna flecha, así que a cada enlace se le añade un trocito
//     de texto escondido a la vista —"(enlace externo)"— que sí se lee
//     en voz alta y pasa a formar parte del nombre del enlace.
//
//   - Que si el enlace abre otra pestaña se avise antes, no después
//     (WCAG 3.2.5): un cambio de contexto que no esperas deja perdido a
//     cualquiera, y más a quien navega con lector de pantalla o con la
//     pantalla muy ampliada, que puede ni enterarse de que ha cambiado
//     de ventana. Por eso esos dicen además "se abre en otra pestaña".
//
// Y LA FLECHITA, ¿POR QUÉ ASÍ?
// ----------------------------
// Va de fondo con una máscara y no como carácter ni como texto de un
// ::after. Dos razones: un carácter lo dibuja la fuente que tenga quien
// visita la web y sale de cualquier tamaño y descentrado (ya pasó con
// los botones de las ventanas), y el contenido de un ::after lo leen en
// voz alta algunos lectores de pantalla, que anunciarían "flecha hacia
// el noreste" en medio de cada frase. Con máscara el dibujo toma el
// color del texto (currentColor) y no lo lee nadie.
//
// QUÉ NO SE MARCA
// ---------------
// Los enlaces que son solo un icono (los de redes sociales): ahí la
// flecha se amontona con el dibujo y no se entiende. Esos llevan solo el
// aviso escondido, que es lo que de verdad hace falta.
//
// OJO CON LOS NOMBRES: todos los scripts comparten el mismo ámbito
// global, así que lo de aquí lleva "fuera" en el nombre. Se comprueba
// con herramientas/4-comprobar/nombres-repetidos.py.

initializeEnlacesFuera();
vigilarEnlacesFuera();

function initializeEnlacesFuera() {
    document.querySelectorAll("a[href]").forEach(marcarEnlaceFuera);
}

// POR QUÉ UN VIGILANTE Y NO UNA LISTA DE AVISOS
// ---------------------------------------------
// Media web se pinta sola después de que esto corra: la barra lateral, el
// listado del blog, el de relatos, las novedades de la portada, el
// buscador, los filtros... Son seis o siete scripts distintos, y de esos
// solo tres avisan con un evento. Ir detrás de cada uno sería dejar el
// aviso de "enlace externo" dependiendo de que nadie se olvide de avisar
// el día que añada un listado nuevo —y ya pasó: los enlaces a la tienda
// de la portada se quedaron sin marcar—.
//
// Así que en vez de esperar avisos se vigila el documento: cada vez que
// aparece algo nuevo se repasan los enlaces. Se desconecta mientras
// repasa porque el repaso mete un <span> dentro de cada enlace, y eso es
// un cambio más que lo despertaría otra vez en bucle. Y se agrupa con
// requestAnimationFrame: pintar una lista de treinta entradas son
// treinta avisos seguidos y un solo repaso al final.
function vigilarEnlacesFuera() {
    if (typeof MutationObserver !== "function") {
        return;
    }
    let pendiente = false;
    const vigilante = new MutationObserver(() => {
        if (pendiente) {
            return;
        }
        pendiente = true;
        window.requestAnimationFrame(() => {
            pendiente = false;
            vigilante.disconnect();
            initializeEnlacesFuera();
            encender();
        });
    });
    function encender() {
        vigilante.observe(document.body, { childList: true, subtree: true });
    }
    encender();
}

function marcarEnlaceFuera(enlace) {
    if (enlace.dataset.fueraVisto === "si") {
        return;
    }
    enlace.dataset.fueraVisto = "si";
    if (!saleDeLaWeb(enlace)) {
        return;
    }

    // El aviso para quien escucha. Va dentro del enlace para que forme
    // parte de su nombre: lo que se anuncia pasa a ser "Pexels, enlace
    // externo, se abre en otra pestaña".
    //
    // Antes de añadir nada se mira lo que ya pone: varios enlaces de la
    // web llevan escrito a mano un "(se abre en otra pestaña)" desde
    // hace tiempo, y sin esta comprobación se oía dos veces seguidas.
    const yaDice = (enlace.textContent || "").toLowerCase();
    const avisaDePestana = yaDice.indexOf("pestaña") !== -1 || yaDice.indexOf("ventana") !== -1;
    const avisaDeFuera = yaDice.indexOf("externo") !== -1;

    const partes = [];
    if (!avisaDeFuera) {
        partes.push("enlace externo");
    }
    if (enlace.target === "_blank" && !avisaDePestana) {
        partes.push("se abre en otra pestaña");
    }
    if (partes.length) {
        const aviso = document.createElement("span");
        aviso.className = "visually-hidden";
        aviso.textContent = " (" + partes.join(", ") + ")";
        enlace.appendChild(aviso);
    }

    // Y la flechita, solo si el enlace tiene texto. En uno que es solo un
    // icono no cabe y no se entiende.
    if (tieneTextoFuera(enlace)) {
        enlace.classList.add("enlace-fuera");
    }
}

function saleDeLaWeb(enlace) {
    const destino = enlace.getAttribute("href") || "";
    // Anclas, correos, teléfonos y rutas de esta misma web: no salen.
    if (!/^https?:/i.test(destino)) {
        return false;
    }
    try {
        const suyo = new URL(destino, window.location.href).host;
        return sinWww(suyo) !== sinWww(window.location.host);
    } catch (error) {
        // Una dirección que no se puede leer no se marca.
        return false;
    }
}

// richi.blog y www.richi.blog son la misma web, aunque para el navegador
// sean dos nombres distintos. Sin esto, un enlace escrito a mano con la
// dirección completa —de los que hay en el mapa del sitio— se anunciaría
// como "enlace externo" estando dentro de casa.
function sinWww(host) {
    return host.replace(/^www\./i, "");
}

// Si lo único que hay dentro es un dibujo (un SVG, una imagen) no hay
// texto que acompañar con la flecha. El texto escondido que se acaba de
// añadir no cuenta, claro.
function tieneTextoFuera(enlace) {
    const copia = enlace.cloneNode(true);
    copia.querySelectorAll(".visually-hidden").forEach((n) => n.remove());
    return (copia.textContent || "").trim().length > 0;
}
