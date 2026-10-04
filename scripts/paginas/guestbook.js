// =========================================
// GUESTBOOK — envío y lectura vía Google Apps Script
// =========================================
// Este guestbook necesita una Google Sheet + un Google Apps Script
// publicado como "Web App" que haga de API intermedia (Google Sheets
// no se puede leer/escribir directamente desde el navegador). Los
// pasos para montar esa parte están explicados aparte; aquí solo se
// PIDE esa URL una vez la tengas.
//
// IMPORTANTE: sustituye el valor de aquí abajo por la URL que te da
// Google al publicar el script (termina en "/exec").
const GUESTBOOK_API_URL = "https://script.google.com/macros/s/AKfycbwaIGmfuZD_-efthh5lGWpYE32A24Q9X6Z24I1WK3yaP21EorLSPVyo2Iy-iWwCAlBx/exec";

initializeGuestbook();

function initializeGuestbook() {
    const form = document.getElementById("guestbook-form");
    const entriesList = document.getElementById("guestbook-entries");
    if (!form || !entriesList) {
        return;
    }

    // El cuadro de escribir con negrita/cursiva/tachado vive en
    // scripts/paginas/guestbook-texto.js, que se carga antes que este.
    montarEditorGuestbook(
        document.getElementById("guestbook-message"),
        form.querySelector(".guestbook-toolbar"),
        document.getElementById("guestbook-contador")
    );

    const isConfigured = GUESTBOOK_API_URL.startsWith("http");

    if (!isConfigured) {
        renderNotConfigured(entriesList);
        disableForm(form, "El guestbook todavía no está conectado.");
        return;
    }

    loadEntries(entriesList);

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        handleSubmit(form, entriesList);
    });

    engancharLimpiezaGuestbook(form);
}

function disableForm(form, reason) {
    const submitBtn = form.querySelector(".guestbook-submit");
    if (submitBtn) {
        submitBtn.disabled = true;
    }
    setStatus(form, reason, "error");
}

function renderNotConfigured(entriesList) {
    entriesList.innerHTML =
        '<li class="guestbook-entries-error">El guestbook todavía no está conectado a ninguna hoja de cálculo.</li>';
}

async function loadEntries(entriesList) {
    try {
        const response = await fetch(GUESTBOOK_API_URL, { method: "GET" });
        if (!response.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        const data = await response.json();
        renderEntries(entriesList, Array.isArray(data) ? data : []);
    } catch (error) {
        entriesList.innerHTML =
            '<li class="guestbook-entries-error">No se han podido cargar los mensajes ahora mismo. Prueba a recargar la página.</li>';
    }
}

function renderEntries(entriesList, entries) {
    if (entries.length === 0) {
        entriesList.innerHTML =
            '<li class="guestbook-entries-empty">Todavía no hay mensajes — ¡sé la primera persona en firmar!</li>';
        return;
    }

    // más recientes primero
    const sorted = entries.slice().reverse();

    entriesList.textContent = "";
    sorted.forEach((entry) => entriesList.appendChild(entryToElement(entry)));
}

function prependEntry(entriesList, entry) {
    const placeholder = entriesList.querySelector(
        ".guestbook-entries-empty, .guestbook-entries-loading, .guestbook-entries-error"
    );
    if (placeholder) {
        placeholder.remove();
    }
    entriesList.insertBefore(entryToElement(entry), entriesList.firstChild);
}

// Se construye nodo a nodo en vez de pegar una cadena de HTML. El
// mensaje lo pinta pintarMensajeGuestbook (guestbook-texto.js), que
// entiende las marcas de negrita/cursiva/tachado y mete el texto como
// texto: por ahí no puede colarse HTML de nadie.
function entryToElement(entry) {
    const li = crear("li", "guestbook-entry");

    const cabecera = crear("div", "guestbook-entry-header");
    cabecera.appendChild(crear("span", "guestbook-entry-name", entry.name || "Anónimo"));
    cabecera.appendChild(crear("span", "guestbook-entry-date", formatDate(entry.date)));
    li.appendChild(cabecera);

    const mensaje = crear("p", "guestbook-entry-message");
    pintarMensajeGuestbook(mensaje, entry.message || "");
    li.appendChild(mensaje);

    const respuesta = replyToElement(entry);
    if (respuesta) {
        li.appendChild(respuesta);
    }

    return li;
}

// Responder a un mensaje no se hace desde la web: se escribe la
// respuesta a mano en la columna "Respuesta" de esa fila de la hoja
// de cálculo (y, si quieres, la fecha en "Fecha respuesta"). Si esa
// celda está vacía, aquí no se pinta nada y el mensaje se ve igual
// que siempre. La fecha es opcional por separado: si hay respuesta
// pero no fecha, se pinta la respuesta sin fecha.
// La respuesta admite las mismas marcas que los mensajes, así que se
// puede poner algo en *negrita* desde la propia hoja.
function replyToElement(entry) {
    const reply = (entry.reply || "").toString().trim();
    if (!reply) {
        return null;
    }

    const caja = crear("div", "guestbook-reply");
    const cabecera = crear("div", "guestbook-reply-header");
    cabecera.appendChild(crear("span", "guestbook-reply-name", "↪ richi responde"));

    const fecha = formatDate(entry.replyDate);
    if (fecha) {
        cabecera.appendChild(crear("span", "guestbook-reply-date", fecha));
    }
    caja.appendChild(cabecera);

    const texto = crear("p", "guestbook-reply-message");
    pintarMensajeGuestbook(texto, reply);
    caja.appendChild(texto);

    return caja;
}

function crear(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) {
        nodo.className = clase;
    }
    if (texto !== undefined) {
        nodo.textContent = texto;
    }
    return nodo;
}

function formatDate(rawDate) {
    if (!rawDate) {
        return "";
    }
    const parsed = parseDateValue(rawDate);
    if (isNaN(parsed.getTime())) {
        return "";
    }
    return parsed.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

// Las celdas de fecha de la hoja llegan como texto ISO, que Date
// entiende sin ayuda. Pero la fecha de respuesta se escribe a mano,
// y si se teclea como texto suelto ("15/09/2026") Date la leería al
// revés (mes/día) o directamente no la entendería: ese caso se
// parsea aparte para que dé igual cómo la escribas.
function parseDateValue(rawDate) {
    const text = rawDate.toString().trim();
    const manual = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (manual) {
        const [, day, month, year] = manual;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }
    return new Date(text);
}

// Aquí había un escapeHtml que ya no hace falta: los mensajes no se
// pegan como cadena de HTML, se construyen nodo a nodo (ver
// entryToElement y pintarMensajeGuestbook). El texto va siempre como
// texto, así que no hay nada que escapar.

async function handleSubmit(form, entriesList) {
    const nameInput = form.querySelector("#guestbook-name");
    const editor = form.querySelector("#guestbook-message");
    const honeypot = form.querySelector("#guestbook-website");
    const submitBtn = form.querySelector(".guestbook-submit");

    const name = nameInput.value.trim();
    // Con las marcas puestas (*negrita*), que es lo que se guarda.
    const message = marcasGuestbook(editor);

    if (honeypot && honeypot.value.trim() !== "") {
        // Un campo que ningún humano debería rellenar: tratamos el
        // envío como spam y no hacemos nada, sin dar pistas al bot.
        setStatus(form, "¡Gracias por tu mensaje!", "success");
        vaciarFormulario(form);
        return;
    }

    if (!name || !message) {
        marcarErroresGuestbook(form, {
            nombre: !name
                ? "Falta tu nombre. Puede ser el que quieras: un apodo vale."
                : "",
            mensaje: !message
                ? "Falta el mensaje. Escribe lo que quieras dejarme, aunque sea una línea."
                : "",
        });
        return;
    }

    // Si llega aquí es que ya está todo: se limpian las marcas de la
    // vez anterior antes de enviar.
    limpiarErroresGuestbook(form);

    submitBtn.disabled = true;
    setStatus(form, "Enviando…", "");

    try {
        // Los Web Apps de Google Apps Script no gestionan bien el
        // preflight CORS, así que se manda como "no-cors": el envío
        // funciona pero no podemos leer la respuesta. Por eso el
        // mensaje se añade aquí mismo de forma optimista, y luego se
        // vuelve a pedir la lista completa para quedar sincronizados.
        await fetch(GUESTBOOK_API_URL, {
            method: "POST",
            mode: "no-cors",
            body: new URLSearchParams({ name, message }),
        });

        setStatus(form, "¡Gracias por firmar el guestbook!", "success");
        vaciarFormulario(form);

        const optimisticEntry = { name, message, date: new Date().toISOString() };
        prependEntry(entriesList, optimisticEntry);
        window.setTimeout(() => loadEntries(entriesList), 1500);
    } catch (error) {
        setStatus(form, "No se ha podido enviar. Prueba de nuevo en un momento.", "error");
    } finally {
        submitBtn.disabled = false;
    }
}

// form.reset() vacía los <input>, pero no un cuadro editable: ese hay
// que limpiarlo a mano, y de paso volver a poner el contador.
function vaciarFormulario(form) {
    form.reset();
    const editor = form.querySelector("#guestbook-message");
    if (editor) {
        editor.textContent = "";
        actualizarContador(editor, document.getElementById("guestbook-contador"));
    }
    const barra = form.querySelector(".guestbook-toolbar");
    if (barra) {
        barra.querySelectorAll("[data-formato]").forEach((b) =>
            b.setAttribute("aria-pressed", "false")
        );
    }
}

function setStatus(form, text, kind) {
    const status = form.querySelector("#guestbook-status");
    if (!status) {
        return;
    }
    status.textContent = text;
    status.classList.remove("is-error", "is-success");
    if (kind === "error") {
        status.classList.add("is-error");
    } else if (kind === "success") {
        status.classList.add("is-success");
    }
}


// =========================================
// LOS AVISOS DE CADA CAMPO
// =========================================
// Antes, al darle a enviar con algo sin rellenar, salía un único
// "Rellena tu nombre y un mensaje antes de enviar" debajo del botón,
// dijera lo que dijera el formulario. Tres problemas, y los tres son de
// los que más cuestan a quien no ve la pantalla:
//
//   - No decía CUÁL de los dos faltaba. Si habías escrito el mensaje y
//     te habías dejado el nombre, el aviso te hacía repasar los dos.
//   - No decía QUÉ HACER. "Falta tu nombre" a secas tampoco ayuda a
//     quien no sabe si vale un apodo.
//   - El aviso salía al final del formulario, lejos del campo, y el
//     foco se quedaba donde estaba: con el lector de pantalla oías que
//     algo iba mal y tenías que ir a buscarlo a ciegas.
//
// Ahora cada campo tiene su propio aviso debajo, enlazado con
// aria-describedby desde el campo (así se lee al llegar a él, no solo
// al aparecer), el campo se marca con aria-invalid —que es lo que hace
// que un lector diga "no válido" al pasar por encima— y el foco se va
// al primero que falte. Las pautas 3.3.1 y 3.3.3 de la WCAG piden
// exactamente esas dos cosas: decir cuál es el error y sugerir cómo
// arreglarlo.
//
// El aviso de abajo del botón se queda, pero resumiendo: es el que
// anuncia el role="status" para quien no estuviera mirando.
function marcarErroresGuestbook(form, errores) {
    const campos = camposDeGuestbook(form);
    let primero = null;

    Object.keys(campos).forEach((cual) => {
        const campo = campos[cual].campo;
        const aviso = campos[cual].aviso;
        const texto = errores[cual] || "";
        if (!campo || !aviso) {
            return;
        }
        aviso.textContent = texto;
        aviso.hidden = !texto;
        if (texto) {
            campo.setAttribute("aria-invalid", "true");
            if (!primero) {
                primero = campo;
            }
        } else {
            campo.removeAttribute("aria-invalid");
        }
    });

    const cuantos = Object.keys(errores).filter((k) => errores[k]).length;
    setStatus(
        form,
        cuantos > 1
            ? "Faltan dos cosas por rellenar; te las marco abajo."
            : "Falta una cosa por rellenar; te la marco abajo.",
        "error"
    );

    // El foco al primero que falte, para no tener que buscarlo. Se hace
    // después del aviso para que el lector de pantalla cuente primero
    // lo que pasa y luego dónde ha aterrizado.
    if (primero) {
        primero.focus();
    }
}

function limpiarErroresGuestbook(form) {
    const campos = camposDeGuestbook(form);
    Object.keys(campos).forEach((cual) => {
        if (campos[cual].campo) {
            campos[cual].campo.removeAttribute("aria-invalid");
        }
        if (campos[cual].aviso) {
            campos[cual].aviso.textContent = "";
            campos[cual].aviso.hidden = true;
        }
    });
}

function camposDeGuestbook(form) {
    return {
        nombre: {
            campo: form.querySelector("#guestbook-name"),
            aviso: form.querySelector("#guestbook-name-error"),
        },
        mensaje: {
            campo: form.querySelector("#guestbook-message"),
            aviso: form.querySelector("#guestbook-message-error"),
        },
    };
}

// En cuanto se empieza a escribir, la marca se va: dejar un campo en
// rojo mientras lo estás arreglando es decirle a alguien que se ha
// equivocado cuando ya está corrigiéndolo.
function engancharLimpiezaGuestbook(form) {
    const campos = camposDeGuestbook(form);
    Object.keys(campos).forEach((cual) => {
        const campo = campos[cual].campo;
        const aviso = campos[cual].aviso;
        if (!campo || !aviso) {
            return;
        }
        campo.addEventListener("input", () => {
            if (campo.getAttribute("aria-invalid") !== "true") {
                return;
            }
            campo.removeAttribute("aria-invalid");
            aviso.textContent = "";
            aviso.hidden = true;

            // Y cuando ya no queda ninguno marcado, se borra también el
            // resumen de debajo del botón: dejarlo diciendo "falta una
            // cosa" cuando ya está todo puesto es peor que no decir
            // nada, sobre todo para quien solo tiene ese texto.
            if (!form.querySelector('[aria-invalid="true"]')) {
                setStatus(form, "", "");
            }
        });
    });
}
