/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/recetas.js
*/
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
        casillas[0].focus();
    });
    caja.hidden = false;
    contar();
}());
