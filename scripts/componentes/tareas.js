// =========================================
// COMPONENTE: LISTAS DE COSAS PENDIENTES
// =========================================
// Cualquier <ul class="cuaderno-tareas"> se convierte en una lista que
// se puede ir marcando:
//
//     <ul class="cuaderno-tareas">
//         <li>Lo que queda por hacer.</li>
//         <li class="hecho">Y esto ya está hecho.</li>
//     </ul>
//
// Cada cosa sale con su casilla delante, debajo se pone la cuenta de "x
// de y hechas" y, si lo marcado no coincide con lo escrito, un "volver a
// lo escrito" para deshacerlo.
//
// Estaba dentro de scripts/paginas/cuaderno.js, que es donde se estrenó
// (el post-it de una partida de rol). Se sacó aquí el día que la página
// de "en lo que ando" quiso la misma nota: una cosa que usan dos páginas
// distintas ya no es de ninguna de las dos.
//
// SIN JAVASCRIPT la lista se sigue viendo con sus casillas, marcadas o
// no según lo que ponga el archivo: las dibuja el CSS
// (estilos/componentes/postit.css). Esto solo añade poder marcarlas.
//
// LO QUE SE MARCA SE GUARDA EN ESTE NAVEGADOR Y NADA MÁS
// -----------------------------------------------------
// La página es un archivo HTML escrito a mano: lo que ve quien entra en
// la web es lo que ponga ahí (un <li class="hecho">). Marcar una casilla
// aquí no cambia el archivo —no puede—, así que se guarda en el
// localStorage del navegador de quien la marca.
//
// Eso está bien pensado, no es una limitación disimulada: la lista de
// pendientes de una partida es de quien la escribió, y que alguien de
// fuera marque una casilla no tiene que cambiársela a nadie más. Y para
// Richi vale igual: va marcando según se resuelven las cosas y al
// terminar lo pasa al archivo, o no.
//
// Para que no haya dudas de qué es qué, cuando lo marcado aquí no
// coincide con lo escrito sale un "volver a lo escrito" debajo de la
// lista. Si coincide, no sale: no habría nada que deshacer.
//
// OJO CON LOS NOMBRES: todos los scripts comparten el mismo ámbito
// global. Se comprueba con herramientas/4-comprobar/nombres-repetidos.py.

// La clave con la que se guarda. Lleva la dirección de la página dentro
// para que dos páginas no se pisen lo marcado.
const CUADERNO_CLAVE = "richi-tareas";

// Se guarda {texto de la tarea: true/false} y no la posición en la lista,
// a propósito: si se añade una tarea nueva a mitad de la lista, por
// posición se correría todo y aparecerían marcadas las que no son. Por
// texto, lo peor que pasa es que al reescribir una tarea vuelva a como
// está en el archivo, que es exactamente lo que tiene que pasar.
montarTareas();

// Y otra vez cuando una página termine de pintar su lista. En las notas de
// una partida la lista está escrita en el HTML y con la primera vez basta;
// en "en lo que ando" sale de un JSON que llega después, así que esa
// página avisa cuando ya está puesta. Las listas que ya tengan su casilla
// se saltan, así que avisar de más no hace nada.
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
        // role="status" para que, al marcar una casilla, un lector de
        // pantalla lea la cuenta nueva sin que haya que ir a buscarla.
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
            // El foco se queda en el aire al esconderse el botón que se
            // acaba de pulsar: se lleva a la primera casilla, que es lo
            // más cercano y lo siguiente que se va a tocar.
            if (fichas.length) {
                fichas[0].casilla.focus();
            }
        });

        repasar();
        lista.parentNode.insertBefore(pie, lista.nextSibling);
        // Una lista sin nombre delante no se distingue de otra en el
        // mismo archivo; la cuenta lleva el número por si hay dos.
        if (listas.length > 1) {
            cuenta.id = "cuaderno-tareas-cuenta-" + (numero + 1);
        }
    });
}

// Una tarea: se envuelve lo que haya escrito en un <label> con su casilla
// delante, para poder marcarla. Lo escrito no se toca —puede llevar
// <strong>, <em> o un enlace dentro—: se mueve entero.
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


// =========================================
// LO MARCADO, GUARDADO
// =========================================
// Todo entre try/catch: en una ventana privada, o con el almacenamiento
// bloqueado, localStorage no falla al leerlo sino al tocarlo, y una
// página que se cae entera porque no ha podido recordar una casilla
// marcada no tiene ninguna gracia.

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

// Lo que coincide con el archivo NO se guarda, se borra: así, el día que
// se pase lo marcado al archivo, lo guardado aquí se queda vacío solo y
// no hay una copia vieja esperando a contradecirlo.
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
        // Sin guardar, pero la casilla se queda marcada hasta recargar.
    }
}
