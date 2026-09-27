// =========================================
// CARGADOR GENÉRICO DE COMPONENTES
// =========================================
// Se encarga solo de pedir el fragmento HTML e inyectarlo en el
// contenedor indicado. No sabe nada sobre sidebar, quotes, ni
// ningún componente concreto — cada uno le pasa su propia
// función "onLoaded" para inicializarse después de inyectarse.
//
// Uso:
//   loadComponent("mi-contenedor", "/components/mi-cosa.html", () => {
//       inicializarMiCosa();
//   });

async function loadComponent(elementId, file, onLoaded) {
    const container = document.getElementById(elementId);
    if (!container) {
        return;
    }

    try {
        // Con su versión en la dirección: si no, al cambiar la barra
        // lateral quien ya había entrado seguía viendo la de antes
        // (ver el comentario de cargador-scripts.js).
        const response = await fetch(window.conVersion(file));

        if (!response.ok) {
            throw new Error(`No se pudo cargar ${file}`);
        }

        const html = await response.text();
        container.innerHTML = html;

        if (typeof onLoaded === "function") {
            onLoaded();
        }

    } catch (error) {
        console.error(`Error cargando el componente (${file}):`, error);
    }
}
