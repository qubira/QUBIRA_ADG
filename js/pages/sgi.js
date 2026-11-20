/* Sistema de gestión integrado (ISO) (componente compartido de la API) */
export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-6xl mx-auto"><div id="sgi"></div></div>`;
  const el = document.getElementById('sgi');
  const dibujar = () => window.qbSgi.render(el, { token: () => localStorage.getItem('token') });
  if (window.qbSgi) dibujar();
  else { el.textContent = 'Cargando el sistema de gestión…'; document.addEventListener('qb-sgi-listo', dibujar, { once: true }); }
}
