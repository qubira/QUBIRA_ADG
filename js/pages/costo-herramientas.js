import { api }      from '../api.js';
import { toast, showModal, closeModal, pageHeader, spinner, icon } from '../utils.js';

let _techCatalog = { language: [], tool: [] };

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-5xl mx-auto" id="costo-herramientas-page">${spinner()}</div>`;
  load();
}

function load() {
  Promise.all([
    api.get('/technology-catalog', { category: 'language' }),
    api.get('/technology-catalog', { category: 'tool' }),
  ]).then(([langs, tools]) => {
    _techCatalog = { language: langs, tool: tools };
    renderPage();
  }).catch(() => {
    const c = document.getElementById('costo-herramientas-page');
    if (c) c.innerHTML = '<p class="text-center text-gray-400 py-16">Error al cargar las tecnologías</p>';
  });
}

function renderPage() {
  const c = document.getElementById('costo-herramientas-page');
  if (!c) return;

  c.innerHTML = `
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Costo por OPP HERRAMIENTAS</h1>
        <p class="text-sm text-gray-500 mt-1">Lista reutilizable de lenguajes y herramientas con costos y márgenes de propuesta definidos para OPP.</p>
      </div>
      <div>
        <button type="button" id="open-tech-cost-btn" class="btn-primary flex items-center gap-2">
          ${icon('payments', 18)} Herramientas Costo
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
      ${techPreviewColumn('Lenguajes', 'language')}
      ${techPreviewColumn('Herramientas', 'tool')}
    </div>`;

  document.getElementById('open-tech-cost-btn').addEventListener('click', openTechCostModal);
}

function techPreviewColumn(label, category) {
  const items = _techCatalog[category] || [];
  return `
  <div class="card p-5">
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-semibold text-gray-900">${label}</h3>
      <span class="text-xs text-gray-400 font-medium">${items.length} registrado${items.length === 1 ? '' : 's'}</span>
    </div>
    <div class="divide-y divide-gray-50 max-h-[32rem] overflow-y-auto">
      ${items.length === 0
        ? '<p class="text-xs text-gray-400 py-4 text-center">Sin registrar</p>'
        : items.map(techRowPreview).join('')}
    </div>
  </div>`;
}

function techRowPreview(t) {
  const avatar = t.image_url
    ? `<img src="${esc(t.image_url)}" class="w-7 h-7 rounded object-cover shrink-0" alt="">`
    : `<span class="w-7 h-7 rounded bg-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0">${esc((t.name || '?').charAt(0).toUpperCase())}</span>`;
  return `
  <div class="flex items-center gap-3 py-2.5">
    ${avatar}
    <p class="text-sm font-medium text-gray-800 flex-1 truncate">${esc(t.name)}</p>
    ${t.costo != null && t.costo !== '' ? `<span class="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded">S/ ${Number(t.costo).toFixed(2)}</span>` : ''}
  </div>`;
}

function fmtS(v) {
  return v == null || v === '' ? '—' : `S/ ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function openTechCostModal() {
  showModal('Herramientas Costo', `
    <p class="text-xs text-gray-500 mb-4">Costo de referencia y margen (S/) que se suma al costo para armar el rango de precio de propuesta. Los cambios se guardan automáticamente al salir de cada campo.</p>
    <div class="space-y-6">
      ${techCostSection('Lenguajes', 'language')}
      ${techCostSection('Herramientas', 'tool')}
    </div>
  `, '2xl', `
    <div class="flex justify-end">
      <button type="button" id="tech-cost-close" class="btn-secondary">Cerrar</button>
    </div>
  `);
  document.getElementById('tech-cost-close').addEventListener('click', () => {
    closeModal();
    renderPage();
  });
  wireTechCostModal();
}

function techCostSection(label, category) {
  const items = _techCatalog[category] || [];
  return `
  <div>
    <h4 class="font-semibold text-gray-900 mb-2">${label}</h4>
    ${items.length === 0 ? '<p class="text-xs text-gray-400 py-3">Sin registrar</p>' : `
    <div class="overflow-x-auto border border-gray-100 rounded-xl">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            <th class="text-left px-3 py-2 font-medium" colspan="2">Herramienta</th>
            <th class="text-left px-3 py-2 font-medium">Costo (S/)</th>
            <th class="text-left px-3 py-2 font-medium">Margen mín (S/)</th>
            <th class="text-left px-3 py-2 font-medium">Margen máx (S/)</th>
            <th class="text-left px-3 py-2 font-medium">Propuesta (S/)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          ${items.map(t => techCostRow(t, category)).join('')}
        </tbody>
      </table>
    </div>`}
  </div>`;
}

function techCostRow(t, category) {
  const avatar = t.image_url
    ? `<img src="${esc(t.image_url)}" class="w-6 h-6 rounded object-cover shrink-0" alt="">`
    : `<span class="w-6 h-6 rounded bg-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0">${esc((t.name || '?').charAt(0).toUpperCase())}</span>`;
  return `
  <tr data-tc-row="${esc(t.id)}" data-category="${category}">
    <td class="px-3 py-2 w-9">${avatar}</td>
    <td class="px-3 py-2 text-gray-800 whitespace-nowrap font-medium">${esc(t.name)}</td>
    <td class="px-3 py-2"><input type="number" step="0.01" min="0" class="input text-xs py-1.5 w-24 tc-input" data-field="costo" value="${t.costo ?? ''}"></td>
    <td class="px-3 py-2"><input type="number" step="0.01" min="0" class="input text-xs py-1.5 w-24 tc-input" data-field="margen_min" value="${t.margen_min ?? ''}"></td>
    <td class="px-3 py-2"><input type="number" step="0.01" min="0" class="input text-xs py-1.5 w-24 tc-input" data-field="margen_max" value="${t.margen_max ?? ''}"></td>
    <td class="px-3 py-2 text-xs text-gray-600 whitespace-nowrap tc-propuesta font-semibold">${propuestaLabel(t)}</td>
  </tr>`;
}

function propuestaLabel(t) {
  if (t.costo == null || t.costo === '') return '—';
  const costo = Number(t.costo) || 0;
  const min = costo + (Number(t.margen_min) || 0);
  const max = costo + (Number(t.margen_max) || 0);
  return `${fmtS(min)} – ${fmtS(max)}`;
}

function wireTechCostModal() {
  document.querySelectorAll('#modal-body [data-tc-row]').forEach(row => {
    const id = row.dataset.tcRow;
    const category = row.dataset.category;
    const inputs = row.querySelectorAll('.tc-input');
    const propuestaEl = row.querySelector('.tc-propuesta');
    const currentValues = () => ({
      costo: row.querySelector('[data-field="costo"]').value,
      margen_min: row.querySelector('[data-field="margen_min"]').value,
      margen_max: row.querySelector('[data-field="margen_max"]').value,
    });
    const updatePropuesta = () => { propuestaEl.textContent = propuestaLabel(currentValues()); };
    inputs.forEach(inp => {
      inp.addEventListener('input', updatePropuesta);
      inp.addEventListener('blur', () => saveTechCostRow(id, category, currentValues(), row));
    });
  });
}

async function saveTechCostRow(id, category, values, row) {
  try {
    await api.put(`/technology-catalog/${id}/cost`, values);
    const list = _techCatalog[category] || [];
    const item = list.find(x => x.id === id);
    if (item) Object.assign(item, {
      costo: values.costo === '' ? null : Number(values.costo),
      margen_min: values.margen_min === '' ? null : Number(values.margen_min),
      margen_max: values.margen_max === '' ? null : Number(values.margen_max),
    });
    row?.classList.add('bg-green-50');
    setTimeout(() => row?.classList.remove('bg-green-50'), 700);
  } catch (err) { toast(err.message || 'No se pudo guardar el costo', 'error'); }
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
