import { api }      from '../api.js';
import { toast, showModal, closeModal, spinner, icon } from '../utils.js';

let _techCatalog = { language: [], tool: [] };

function thumbUrl(url, size = 64) {
  if (!url) return '';
  if (typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes('/image/upload/') && !url.includes('/image/upload/w_')) {
    return url.replace('/image/upload/', `/image/upload/w_${size},h_${size},c_fit,f_auto,q_auto/`);
  }
  return url;
}

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
    ? `<div class="w-8 h-8 rounded-lg bg-white border border-gray-200/80 p-1 flex items-center justify-center shrink-0 shadow-sm"><img src="${esc(thumbUrl(t.image_url, 64))}" class="max-w-full max-h-full object-contain" alt="${esc(t.name)}"></div>`
    : `<span class="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0 shadow-sm">${esc((t.name || '?').charAt(0).toUpperCase())}</span>`;
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
  const langCount = (_techCatalog.language || []).length;
  const toolCount = (_techCatalog.tool || []).length;
  const totalCount = langCount + toolCount;

  showModal('Herramientas Costo', `
    <!-- Encabezado fijo con descripción, pestañas y búsqueda inteligente -->
    <div class="sticky -top-4 -mx-6 px-6 pt-4 pb-3 bg-white border-b border-gray-100 z-20 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)] mb-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <p class="text-xs text-gray-500 max-w-xl">Costo de referencia y margen (S/) para armar el rango de propuesta. Se guarda automáticamente al salir del campo.</p>
        <div class="flex items-center gap-1.5 shrink-0 bg-gray-100 p-1 rounded-lg">
          <button type="button" class="tc-tab-btn px-2.5 py-1 text-xs font-semibold rounded-md bg-white shadow-sm text-gray-900 transition-all" data-tab="all">
            Todos (<span id="tc-count-all">${totalCount}</span>)
          </button>
          <button type="button" class="tc-tab-btn px-2.5 py-1 text-xs font-semibold rounded-md text-gray-600 hover:text-gray-900 transition-all" data-tab="language">
            Lenguajes (<span id="tc-count-language">${langCount}</span>)
          </button>
          <button type="button" class="tc-tab-btn px-2.5 py-1 text-xs font-semibold rounded-md text-gray-600 hover:text-gray-900 transition-all" data-tab="tool">
            Herramientas (<span id="tc-count-tool">${toolCount}</span>)
          </button>
        </div>
      </div>
      <!-- Búsqueda inteligente -->
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          ${icon('search', 18)}
        </div>
        <input type="text" id="tc-search-input" autocomplete="off"
          placeholder="Búsqueda inteligente: escribe el nombre de un lenguaje o herramienta (ej: React, Python, Docker, .NET...)"
          class="input pl-9 pr-9 py-2 text-xs w-full bg-gray-50 hover:bg-white focus:bg-white border-gray-200 transition-all rounded-lg">
        <button type="button" id="tc-search-clear" class="hidden absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer" title="Limpiar búsqueda">
          ${icon('close', 16)}
        </button>
      </div>
    </div>

    <div class="space-y-6">
      <div id="tc-section-language">
        ${techCostSection('Lenguajes', 'language')}
      </div>
      <div id="tc-section-tool">
        ${techCostSection('Herramientas', 'tool')}
      </div>
      <div id="tc-empty-all" class="hidden text-center py-10 text-gray-400 text-sm bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
        <p class="font-medium text-gray-600">No se encontraron tecnologías que coincidan con la búsqueda</p>
        <p class="text-xs text-gray-400 mt-1">Prueba con otro término o limpia el buscador.</p>
      </div>
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
    <div class="overflow-x-auto border border-gray-100 rounded-xl" id="tc-table-wrap-${category}">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            <th class="text-left px-4 py-2.5 font-medium">Herramienta</th>
            <th class="text-left px-3 py-2.5 font-medium">Costo (S/)</th>
            <th class="text-left px-3 py-2.5 font-medium">Margen mín (S/)</th>
            <th class="text-left px-3 py-2.5 font-medium">Margen máx (S/)</th>
            <th class="text-left px-3 py-2.5 font-medium">Propuesta (S/)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          ${items.map(t => techCostRow(t, category)).join('')}
        </tbody>
      </table>
    </div>
    <div id="tc-empty-${category}" class="hidden py-6 text-center text-xs text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 mt-2">
      No se encontraron ${label.toLowerCase()} que coincidan con el filtro.
    </div>`}
  </div>`;
}

function techCostRow(t, category) {
  const avatar = t.image_url
    ? `<div class="w-8 h-8 rounded-lg bg-white border border-gray-200/80 p-1 flex items-center justify-center shrink-0 shadow-sm"><img src="${esc(thumbUrl(t.image_url, 64))}" class="max-w-full max-h-full object-contain" alt="${esc(t.name)}"></div>`
    : `<span class="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0 shadow-sm">${esc((t.name || '?').charAt(0).toUpperCase())}</span>`;
  const cVal = t.costo ?? '';
  const minVal = t.margen_min ?? '';
  const maxVal = t.margen_max ?? '';
  return `
  <tr data-tc-row="${esc(t.id)}" data-category="${category}" data-name="${esc((t.name || '').toLowerCase())}">
    <td class="px-4 py-2">
      <div class="flex items-center gap-3">
        ${avatar}
        <span class="text-gray-800 whitespace-nowrap font-medium tc-item-name">${esc(t.name)}</span>
      </div>
    </td>
    <td class="px-3 py-2"><input type="number" step="0.01" min="0" class="input text-xs py-1.5 w-24 tc-input" data-field="costo" data-initial="${cVal}" value="${cVal}"></td>
    <td class="px-3 py-2"><input type="number" step="0.01" min="0" class="input text-xs py-1.5 w-24 tc-input" data-field="margen_min" data-initial="${minVal}" value="${minVal}"></td>
    <td class="px-3 py-2"><input type="number" step="0.01" min="0" class="input text-xs py-1.5 w-24 tc-input" data-field="margen_max" data-initial="${maxVal}" value="${maxVal}"></td>
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

function getRowValues(row) {
  return {
    costo: row.querySelector('[data-field="costo"]')?.value ?? '',
    margen_min: row.querySelector('[data-field="margen_min"]')?.value ?? '',
    margen_max: row.querySelector('[data-field="margen_max"]')?.value ?? '',
  };
}

function wireTechCostModal() {
  const modalBody = document.getElementById('modal-body');
  if (!modalBody) return;

  let currentTab = 'all';
  let currentSearch = '';

  function applyFilter() {
    const q = currentSearch.trim().toLowerCase();
    let totalVisible = 0;
    let langVisible = 0;
    let toolVisible = 0;

    const rows = modalBody.querySelectorAll('[data-tc-row]');
    rows.forEach(row => {
      const name = row.dataset.name || '';
      const cat = row.dataset.category;
      const matchesQuery = !q || name.includes(q);
      const matchesTab = (currentTab === 'all' || cat === currentTab);

      if (matchesQuery) {
        if (cat === 'language') langVisible++;
        if (cat === 'tool') toolVisible++;
        totalVisible++;
      }

      row.style.display = (matchesQuery && matchesTab) ? '' : 'none';
    });

    // Actualizar contadores en pestañas
    const countAll = document.getElementById('tc-count-all');
    const countLang = document.getElementById('tc-count-language');
    const countTool = document.getElementById('tc-count-tool');
    const origLang = (_techCatalog.language || []).length;
    const origTool = (_techCatalog.tool || []).length;

    if (countAll) countAll.textContent = q ? totalVisible : origLang + origTool;
    if (countLang) countLang.textContent = q ? langVisible : origLang;
    if (countTool) countTool.textContent = q ? toolVisible : origTool;

    // Secciones y mensajes de vacíos
    const secLang = document.getElementById('tc-section-language');
    const secTool = document.getElementById('tc-section-tool');
    const emptyAll = document.getElementById('tc-empty-all');
    const wrapLang = document.getElementById('tc-table-wrap-language');
    const wrapTool = document.getElementById('tc-table-wrap-tool');
    const emptyLang = document.getElementById('tc-empty-language');
    const emptyTool = document.getElementById('tc-empty-tool');

    if (secLang) secLang.style.display = (currentTab === 'all' || currentTab === 'language') ? '' : 'none';
    if (secTool) secTool.style.display = (currentTab === 'all' || currentTab === 'tool') ? '' : 'none';

    if (wrapLang) wrapLang.style.display = langVisible > 0 ? '' : 'none';
    if (emptyLang) emptyLang.style.display = (q && langVisible === 0) ? '' : 'none';

    if (wrapTool) wrapTool.style.display = toolVisible > 0 ? '' : 'none';
    if (emptyTool) emptyTool.style.display = (q && toolVisible === 0) ? '' : 'none';

    if (emptyAll) {
      const tabTotal = currentTab === 'language' ? langVisible : (currentTab === 'tool' ? toolVisible : totalVisible);
      emptyAll.classList.toggle('hidden', !q || tabTotal > 0);
    }
  }

  // 1. Pestañas de filtrado (Todos / Lenguajes / Herramientas)
  modalBody.querySelectorAll('.tc-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      modalBody.querySelectorAll('.tc-tab-btn').forEach(b => {
        b.classList.remove('bg-white', 'shadow-sm', 'text-gray-900');
        b.classList.add('text-gray-600');
      });
      btn.classList.add('bg-white', 'shadow-sm', 'text-gray-900');
      btn.classList.remove('text-gray-600');
      applyFilter();
    });
  });

  // 2. Buscador inteligente en tiempo real
  const searchInput = document.getElementById('tc-search-input');
  const searchClear = document.getElementById('tc-search-clear');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentSearch = searchInput.value;
      if (searchClear) searchClear.classList.toggle('hidden', !currentSearch);
      applyFilter();
    });
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        currentSearch = '';
        if (searchClear) searchClear.classList.add('hidden');
        applyFilter();
      }
    });
  }
  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      currentSearch = '';
      searchClear.classList.add('hidden');
      applyFilter();
    });
  }

  // 2. Delegación de eventos (ultra liviano: 1 listener para input y 1 para focusout)
  modalBody.addEventListener('input', e => {
    const input = e.target.closest('.tc-input');
    if (!input) return;
    const row = input.closest('[data-tc-row]');
    if (!row) return;
    const propuestaEl = row.querySelector('.tc-propuesta');
    if (propuestaEl) propuestaEl.textContent = propuestaLabel(getRowValues(row));
  });

  modalBody.addEventListener('focusout', e => {
    const input = e.target.closest('.tc-input');
    if (!input) return;
    const row = input.closest('[data-tc-row]');
    if (!row) return;

    // Solo guardar si algún valor cambió respecto al inicial
    const current = getRowValues(row);
    const cInput = row.querySelector('[data-field="costo"]');
    const minInput = row.querySelector('[data-field="margen_min"]');
    const maxInput = row.querySelector('[data-field="margen_max"]');
    if (
      current.costo === cInput.dataset.initial &&
      current.margen_min === minInput.dataset.initial &&
      current.margen_max === maxInput.dataset.initial
    ) {
      return;
    }

    const id = row.dataset.tcRow;
    const category = row.dataset.category;
    saveTechCostRow(id, category, current, row, [cInput, minInput, maxInput]);
  });
}

async function saveTechCostRow(id, category, values, row, inputs) {
  try {
    await api.put(`/technology-catalog/${id}/cost`, values);
    if (inputs) {
      inputs[0].dataset.initial = values.costo;
      inputs[1].dataset.initial = values.margen_min;
      inputs[2].dataset.initial = values.margen_max;
    }
    const list = _techCatalog[category] || [];
    const item = list.find(x => x.id === id);
    if (item) Object.assign(item, {
      costo: values.costo === '' ? null : Number(values.costo),
      margen_min: values.margen_min === '' ? null : Number(values.margen_min),
      margen_max: values.margen_max === '' ? null : Number(values.margen_max),
    });
    row?.classList.add('bg-green-50');
    setTimeout(() => row?.classList.remove('bg-green-50'), 600);
  } catch (err) { toast(err.message || 'No se pudo guardar el costo', 'error'); }
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
