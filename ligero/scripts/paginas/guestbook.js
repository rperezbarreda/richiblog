/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/guestbook.js
*/
const GUESTBOOK_API_URL = "https://script.google.com/macros/s/AKfycbwaIGmfuZD_-efthh5lGWpYE32A24Q9X6Z24I1WK3yaP21EorLSPVyo2Iy-iWwCAlBx/exec";
initializeGuestbook();
function initializeGuestbook() {
    const form = document.getElementById("guestbook-form");
    const entriesList = document.getElementById("guestbook-entries");
    if (!form || !entriesList) {
        return;
    }
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
function parseDateValue(rawDate) {
    const text = rawDate.toString().trim();
    const manual = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (manual) {
        const [, day, month, year] = manual;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }
    return new Date(text);
}
async function handleSubmit(form, entriesList) {
    const nameInput = form.querySelector("#guestbook-name");
    const editor = form.querySelector("#guestbook-message");
    const honeypot = form.querySelector("#guestbook-website");
    const submitBtn = form.querySelector(".guestbook-submit");
    const name = nameInput.value.trim();
    const message = marcasGuestbook(editor);
    if (honeypot && honeypot.value.trim() !== "") {
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
    limpiarErroresGuestbook(form);
    submitBtn.disabled = true;
    setStatus(form, "Enviando…", "");
    try {
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
            if (!form.querySelector('[aria-invalid="true"]')) {
                setStatus(form, "", "");
            }
        });
    });
}
