/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/tareas.js
*/
const CUADERNO_CLAVE = "richi-tareas";
montarTareas();
document.addEventListener("tareas:actualizar", montarTareas);
function montarTareas() {
    const listas = [...document.querySelectorAll(".cuaderno-tareas")].filter(
        (lista) => !lista.querySelector(".cuaderno-tarea")
    );
    if (!listas.length) {
        return;
    }
    const guardado = leerTareasGuardadas();
    listas.forEach((lista, numero) => {
        const tareas = [...lista.children].filter((li) => li.tagName === "LI");
        if (!tareas.length) {
            return;
        }
        const pie = document.createElement("p");
        pie.className = "cuaderno-tareas-pie";
        const cuenta = document.createElement("span");
        cuenta.setAttribute("role", "status");
        pie.appendChild(cuenta);
        const deshacer = document.createElement("button");
        deshacer.type = "button";
        deshacer.className = "cuaderno-tareas-deshacer";
        deshacer.textContent = "volver a lo escrito";
        deshacer.hidden = true;
        pie.appendChild(deshacer);
        const fichas = tareas.map((li) => prepararTarea(li, guardado));
        const repasar = () => {
            const hechas = fichas.filter((f) => f.li.classList.contains("hecho"));
            cuenta.textContent =
                fichas.length === 1
                    ? hechas.length + " de 1 hecha"
                    : hechas.length + " de " + fichas.length + " hechas";
            deshacer.hidden = !fichas.some(
                (f) => f.li.classList.contains("hecho") !== f.escrito
            );
        };
        fichas.forEach((ficha) => {
            ficha.casilla.addEventListener("change", () => {
                ficha.li.classList.toggle("hecho", ficha.casilla.checked);
                guardarTarea(ficha.clave, ficha.casilla.checked, ficha.escrito);
                repasar();
            });
        });
        deshacer.addEventListener("click", () => {
            fichas.forEach((ficha) => {
                ficha.casilla.checked = ficha.escrito;
                ficha.li.classList.toggle("hecho", ficha.escrito);
                guardarTarea(ficha.clave, ficha.escrito, ficha.escrito);
            });
            repasar();
            if (fichas.length) {
                fichas[0].casilla.focus();
            }
        });
        repasar();
        lista.parentNode.insertBefore(pie, lista.nextSibling);
        if (listas.length > 1) {
            cuenta.id = "cuaderno-tareas-cuenta-" + (numero + 1);
        }
    });
}
function prepararTarea(li, guardado) {
    const escrito = li.classList.contains("hecho");
    const clave = (li.textContent || "").replace(/\s+/g, " ").trim();
    const etiqueta = document.createElement("label");
    etiqueta.className = "cuaderno-tarea";
    const casilla = document.createElement("input");
    casilla.type = "checkbox";
    casilla.className = "cuaderno-tarea-casilla";
    etiqueta.appendChild(casilla);
    while (li.firstChild) {
        etiqueta.appendChild(li.firstChild);
    }
    li.appendChild(etiqueta);
    const marcada = Object.prototype.hasOwnProperty.call(guardado, clave)
        ? !!guardado[clave]
        : escrito;
    casilla.checked = marcada;
    li.classList.toggle("hecho", marcada);
    return { li, casilla, clave, escrito };
}
function claveDeLaPagina() {
    try {
        return CUADERNO_CLAVE + ":" + window.location.pathname;
    } catch (error) {
        return CUADERNO_CLAVE;
    }
}
function leerTareasGuardadas() {
    try {
        const crudo = localStorage.getItem(claveDeLaPagina());
        const datos = crudo ? JSON.parse(crudo) : null;
        return datos && typeof datos === "object" && !Array.isArray(datos)
            ? datos
            : {};
    } catch (error) {
        return {};
    }
}
function guardarTarea(clave, marcada, escrito) {
    try {
        const datos = leerTareasGuardadas();
        if (marcada === escrito) {
            delete datos[clave];
        } else {
            datos[clave] = marcada;
        }
        if (Object.keys(datos).length) {
            localStorage.setItem(claveDeLaPagina(), JSON.stringify(datos));
        } else {
            localStorage.removeItem(claveDeLaPagina());
        }
    } catch (error) {
    }
}
