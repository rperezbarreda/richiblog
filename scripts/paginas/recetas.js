// =========================================
// UNA RECETA: LAS CASILLAS DE LOS INGREDIENTES
// =========================================
// La página la escribe herramientas/3-generadores/generar-recetas.py, y
// cada ingrediente ya trae su casilla (sin JavaScript se marcan igual).
// Esto solo añade:
//   - que se acuerde de las marcadas (en este navegador; si no se puede
//     guardar, no pasa nada: se marcan igual y ya está),
//   - la cuenta de arriba («3 de 9 marcados») y el botón de desmarcar.
// Va todo dentro de una función para no dejar nombres sueltos: todos los
// scripts de la página comparten el mismo sitio (nombres-repetidos.py).

(function () {
    "use strict";

    const caja = document.querySelector("[data-receta-marcas]");
    if (!caja) {
        return;
    }
    const casillas = Array.from(document.querySelectorAll("[data-receta-marca]"));
    if (!casillas.length) {
        return;
    }
    const clave = "richi-receta-" + caja.getAttribute("data-receta-marcas");
    const cuenta = caja.querySelector("[data-receta-cuenta]");
    const desmarcar = caja.querySelector("[data-receta-desmarcar]");

    function leer() {
        try {
            const guardadas = JSON.parse(localStorage.getItem(clave) || "[]");
            return Array.isArray(guardadas) ? guardadas.map(String) : [];
        } catch (error) {
            return [];
        }
    }

    function guardar() {
        const marcadas = casillas.filter((c) => c.checked).map((c) => c.getAttribute("data-receta-marca"));
        try {
            if (marcadas.length) {
                localStorage.setItem(clave, JSON.stringify(marcadas));
            } else {
                localStorage.removeItem(clave);
            }
        } catch (error) {
            // Sin sitio para guardar: se quedan marcadas solo mientras
            // la página esté abierta.
        }
    }

    function contar() {
        const n = casillas.filter((c) => c.checked).length;
        cuenta.textContent = n
            ? n + " de " + casillas.length + (n === 1 ? " marcado" : " marcados")
            : "Ninguno marcado (" + casillas.length + " en total)";
        desmarcar.hidden = !n;
    }

    const guardadas = leer();
    casillas.forEach((c) => {
        c.checked = guardadas.includes(c.getAttribute("data-receta-marca"));
        c.addEventListener("change", () => {
            guardar();
            contar();
        });
    });

    desmarcar.addEventListener("click", () => {
        casillas.forEach((c) => {
            c.checked = false;
        });
        guardar();
        contar();
        // El botón se esconde al no quedar ninguna: el foco, a la primera
        // casilla, para no perderlo.
        casillas[0].focus();
    });

    caja.hidden = false;
    contar();
}());
