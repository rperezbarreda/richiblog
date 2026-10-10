// =========================================
// COMPONENTE: LA LUPA (una imagen a pantalla completa)
// =========================================
// Una imagen, grande, encima de todo lo demás, con su nombre debajo.
//
//     window.lupa.abrir({
//         ruta: "/imagenes/notas_rol/ragna/sigil.webp",
//         texto: "Sigil",            // lo que se escribe debajo
//         que: "Retrato de",         // "Retrato de Sigil" (alt y título)
//         devolverA: boton,          // dónde dejar el foco al cerrar
//     });
//
// Se cierra con la ✕, pulsando el fondo o con Escape, y el foco vuelve a
// donde estaba.
//
// Estaba dentro de scripts/paginas/npcs-rol.js, que es donde se estrenó
// (ver el retrato de un NPC en grande). Se sacó aquí el día que el botín
// de una campaña quiso lo mismo con las fotos de los objetos: una cosa
// que usan dos páginas distintas ya no es de ninguna de las dos. Lo mismo
// que pasó con el post-it y con las listas de cosas pendientes.
//
// NO ES UNA VENTANA MODAL, y es a propósito: ventana-modal.js solo aguanta
// una abierta a la vez (dos trampas de foco una dentro de otra no sabrían
// a quién devolverle el foco), y la lupa casi siempre se abre DESDE una
// ventana ya abierta. Así que es una capa suya que se pone encima y se
// quita al cerrarse.
//
// Dos cosas que hay que hacer a mano por eso mismo:
//   · el Escape se atrapa en la fase de captura y se para ahí, para que
//     cierre la lupa y NO la ventana de debajo;
//   · la capa se crea al abrirla y se borra al cerrarla, para que no esté
//     en la página cuando la ventana modal reparte los "inert" (si no, la
//     siguiente vez nacería inerte y no se podría ni cerrar).

// LA_LUPA y abrirLaLupa, no LUPA ni abrirLupa: esos dos nombres ya los usa
// scripts/componentes/buscar-lupa.js —la lupa de BUSCAR, que no tiene nada
// que ver con ésta— y todos los scripts del sitio comparten un único sitio
// donde viven los nombres. Dos "const LUPA" en la misma página es un error
// que tumba el segundo script entero; dos funciones con el mismo nombre no
// avisan de nada y gana la del archivo que se cargue después, que es peor.
// Lo caza herramientas/4-comprobar/nombres-repetidos.py.
const LA_LUPA = { capa: null, devolverA: null };

// Lo que acaba en un src se comprueba SIEMPRE aquí, aunque quien llame ya
// lo haya comprobado: este componente lo usan dos páginas y mañana puede
// usarlo una tercera, y entonces nadie se va a acordar. Vale una dirección
// de esta web o una http(s) entera; lo demás —"javascript:", "data:",
// "//otrositio.com"— no es una dirección: es código o es irse de aquí sin
// que se note.
function rutaSeguraDeLaLupa(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "";
}

function abrirLaLupa(opciones) {
    const ajustes = opciones || {};
    const ruta = rutaSeguraDeLaLupa(ajustes.ruta);
    if (!ruta) {
        return false;
    }
    cerrarLaLupa();

    const texto = (ajustes.texto || "").toString().trim();
    const que = (ajustes.que || "Imagen de").toString().trim();
    const comoSeLlama = texto ? que + " " + texto : que;

    const capa = document.createElement("div");
    capa.className = "lupa";
    capa.setAttribute("role", "dialog");
    capa.setAttribute("aria-modal", "true");
    capa.setAttribute("aria-label", comoSeLlama);

    const cerrar = document.createElement("button");
    cerrar.type = "button";
    cerrar.className = "lupa-cerrar";
    cerrar.setAttribute("aria-label", "Cerrar la imagen");
    cerrar.textContent = "✕";
    cerrar.addEventListener("click", cerrarLaLupa);
    capa.appendChild(cerrar);

    const img = document.createElement("img");
    img.className = "lupa-img";
    img.src = ruta;
    img.alt = comoSeLlama;
    capa.appendChild(img);

    if (texto) {
        const pie = document.createElement("p");
        pie.className = "lupa-pie";
        pie.textContent = texto;
        capa.appendChild(pie);
    }

    // Pulsar el fondo cierra, como en la ventana modal.
    capa.addEventListener("click", (evento) => {
        if (evento.target === capa) {
            cerrarLaLupa();
        }
    });

    document.body.appendChild(capa);
    LA_LUPA.capa = capa;
    LA_LUPA.devolverA = ajustes.devolverA || null;
    document.addEventListener("keydown", escapeDeLaLupa, true);
    cerrar.focus();
    return true;
}

function cerrarLaLupa() {
    if (!LA_LUPA.capa) {
        return;
    }
    document.removeEventListener("keydown", escapeDeLaLupa, true);
    LA_LUPA.capa.remove();
    LA_LUPA.capa = null;
    const vuelve = LA_LUPA.devolverA;
    LA_LUPA.devolverA = null;
    // A donde se salió. Si eso ya no está (porque se cerró la ventana
    // entera mientras tanto), no se toca el foco.
    if (vuelve && document.contains(vuelve)) {
        vuelve.focus();
    }
}

function escapeDeLaLupa(evento) {
    if (evento.key !== "Escape" || !LA_LUPA.capa) {
        return;
    }
    // En captura y parando aquí: si dejara pasar la tecla, el Escape
    // llegaría también a ventana-modal.js y se cerrarían las dos cosas de
    // una vez, que no es lo que espera nadie.
    evento.preventDefault();
    evento.stopPropagation();
    cerrarLaLupa();
}

window.lupa = {
    abrir: abrirLaLupa,
    cerrar: cerrarLaLupa,
    estaAbierta: () => !!LA_LUPA.capa,
};
