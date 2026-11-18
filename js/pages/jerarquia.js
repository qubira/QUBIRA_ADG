/* Mapa jerárquico de QUBIRA (componente compartido de la API, el mismo de ORH y DST) */
export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto">
    <h1 class="text-2xl font-bold mb-1">Mapa jerárquico</h1>
    <p class="text-sm opacity-70 mb-6">Niveles, cargos, funciones y comunicación entre las áreas de QUBIRA. Los cargos se administran en ORH.</p>
    <div id="mapa-jerarquico"></div>
  </div>`;
  const el = document.getElementById('mapa-jerarquico');
  const dibujar = () => window.qbJerarquia.render(el);
  if (window.qbJerarquia) dibujar();
  else {
    el.textContent = 'Cargando el mapa jerárquico…';
    document.addEventListener('qb-jerarquia-lista', dibujar, { once: true });
  }
}
