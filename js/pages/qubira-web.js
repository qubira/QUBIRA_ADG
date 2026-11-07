import { api }                                 from '../api.js';
import { toast, showModal, closeModal, confirmModal, pageHeader,
         spinner, icon, fmtDateTime, projectTypeBadge } from '../utils.js';

let _webCases = [];
let _allProjects = [];
let _filter = { search: '', status: 'all', view: 'preview' }; // view: 'preview' | 'list'

// Actualización automática: consulta la API y repinta solo si algo cambió
const REFRESCO_MS = 20000;
let _refresco = null;
let _firma = '';
let _turnoCarga = 0;

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const saveWebStatus = (id, body) => (api.patch ? api.patch(`/projects/${id}/web-status`, body) : api.put(`/projects/${id}/web-status`, body));

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto" id="qubira-web-page">${spinner()}</div>`;
  _firma = '';
  load();
  iniciarRefresco();
}

function iniciarRefresco() {
  detenerRefresco();
  _refresco = setInterval(refrescar, REFRESCO_MS);
  document.addEventListener('visibilitychange', refrescar);
  window.addEventListener('focus', refrescar);
}

function detenerRefresco() {
  clearInterval(_refresco);
  _refresco = null;
  document.removeEventListener('visibilitychange', refrescar);
  window.removeEventListener('focus', refrescar);
}

function refrescar() {
  if (!document.getElementById('qubira-web-page')) { detenerRefresco(); return; }
  if (document.hidden || !_firma) return;
  // No interrumpir un formulario abierto ni el desplegable de filtros
  if (document.getElementById('modal-overlay') || document.activeElement?.id === 'status-filter') return;
  load({ silencioso: true });
}

// Repinta conservando lo que el usuario está escribiendo en el buscador
function repintarConservandoBusqueda() {
  const input = document.getElementById('search-input');
  const enFoco = input && document.activeElement === input;
  const valor = input?.value, inicio = input?.selectionStart, fin = input?.selectionEnd;
  renderPage();
  const nuevo = document.getElementById('search-input');
  if (!nuevo || valor === undefined) return;
  nuevo.value = valor;
  if (enFoco) { nuevo.focus(); nuevo.setSelectionRange(inicio, fin); }
}

async function load({ silencioso = false } = {}) {
  const turno = ++_turnoCarga;
  try {
    const [webCases, allProjects] = await Promise.all([
      api.get('/projects/web-cases'),
      api.get('/projects').catch(() => _allProjects)
    ]);
    // Una carga más reciente (por ejemplo, tras guardar) manda sobre esta
    if (turno !== _turnoCarga) return;
    _allProjects = Array.isArray(allProjects) ? allProjects : [];
    const firma = JSON.stringify(webCases);
    if (silencioso && firma === _firma) return;
    _firma = firma;
    _webCases = Array.isArray(webCases) ? webCases : [];
    if (silencioso) repintarConservandoBusqueda(); else renderPage();
  } catch (err) {
    // Un fallo pasajero en segundo plano no debe borrar lo que ya se ve
    if (silencioso || turno !== _turnoCarga) return;
    const container = document.getElementById('qubira-web-page');
    if (container) {
      container.innerHTML = `
        <div class="card p-12 text-center">
          <span class="material-icons text-red-400" style="font-size:48px">error_outline</span>
          <p class="text-gray-600 font-medium mt-3">Error al cargar datos de Qubira Web</p>
          <button class="btn-primary mt-4" id="retry-load-btn">${icon('refresh', 18)} Reintentar</button>
        </div>`;
      document.getElementById('retry-load-btn')?.addEventListener('click', () => load());
    }
  }
}

function getWebUrl() {
  return (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/#cases'
    : 'https://qubira.pe/#cases';
}

function renderPage() {
  const container = document.getElementById('qubira-web-page');
  if (!container) return;

  const publishedCount = _webCases.filter(p => p.show_on_web).length;
  const withUrlCount   = _webCases.filter(p => p.website_url && p.website_url.trim()).length;
  const comercialCount = _webCases.filter(p => p.show_to_comercial).length;

  container.innerHTML = `
    ${pageHeader(
      'Qubira Web',
      'Gestión de proyectos y casos de éxito en la web principal («Casos que muestran impacto real»)',
      `
        <a href="${getWebUrl()}" target="_blank" rel="noopener noreferrer" class="btn-secondary inline-flex items-center gap-1.5">
          ${icon('open_in_new', 18)} Ver en la Web
        </a>
        <button id="publish-new-btn" class="btn-primary inline-flex items-center gap-1.5">
          ${icon('add', 20)} Publicar Proyecto en Web
        </button>
      `
    )}

    <!-- KPIs -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="card p-4 flex items-center gap-3.5 border-l-4 border-l-indigo-500">
        <div class="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
          ${icon('public', 24)}
        </div>
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Publicados en Web</p>
          <div class="flex items-baseline gap-2 mt-0.5">
            <span class="text-2xl font-bold text-gray-900">${publishedCount}</span>
            <span class="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">En vivo</span>
          </div>
        </div>
      </div>

      <div class="card p-4 flex items-center gap-3.5 border-l-4 border-l-blue-500">
        <div class="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          ${icon('folder', 24)}
        </div>
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Proyectos</p>
          <div class="flex items-baseline gap-2 mt-0.5">
            <span class="text-2xl font-bold text-gray-900">${_webCases.length}</span>
            <span class="text-xs text-gray-400">en sistema</span>
          </div>
        </div>
      </div>

      <div class="card p-4 flex items-center gap-3.5 border-l-4 border-l-emerald-500">
        <div class="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          ${icon('link', 24)}
        </div>
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Con Enlace Web</p>
          <div class="flex items-baseline gap-2 mt-0.5">
            <span class="text-2xl font-bold text-gray-900">${withUrlCount}</span>
            <span class="text-xs text-gray-400">sitios activos</span>
          </div>
        </div>
      </div>

      <div class="card p-4 flex items-center gap-3.5 border-l-4 border-l-purple-500">
        <div class="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
          ${icon('storefront', 24)}
        </div>
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">En Panel Comercial</p>
          <div class="flex items-baseline gap-2 mt-0.5">
            <span class="text-2xl font-bold text-gray-900">${comercialCount}</span>
            <span class="text-xs text-gray-400">para ventas</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Toolbar: Búsqueda, Filtros y Modo de Vista -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white p-3.5 rounded-xl border border-gray-200">
      <div class="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
        <div class="relative flex-1 min-w-[200px]">
          <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" style="font-size:18px">search</span>
          <input id="search-input" class="input pl-9 text-sm" placeholder="Buscar por nombre, código o categoría..." value="${esc(_filter.search)}">
        </div>
        <select id="status-filter" class="input w-auto text-sm">
          <option value="all" ${_filter.status === 'all' ? 'selected' : ''}>Todos los proyectos</option>
          <option value="published" ${_filter.status === 'published' ? 'selected' : ''}>Solo Publicados en Web (${publishedCount})</option>
          <option value="draft" ${_filter.status === 'draft' ? 'selected' : ''}>Sin publicar en Web (${_webCases.length - publishedCount})</option>
          <option value="with_url" ${_filter.status === 'with_url' ? 'selected' : ''}>Con URL de sitio (${withUrlCount})</option>
        </select>
      </div>

      <div class="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
        <button id="view-preview-btn" class="px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${_filter.view === 'preview' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}">
          ${icon('dashboard', 16)} Vista Tarjetas Web
        </button>
        <button id="view-list-btn" class="px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${_filter.view === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}">
          ${icon('table_rows', 16)} Lista Detallada
        </button>
      </div>
    </div>

    <!-- Contenido -->
    ${renderContent()}
  `;

  // Listeners
  document.getElementById('publish-new-btn')?.addEventListener('click', () => openPublishModal());
  document.getElementById('search-input')?.addEventListener('input', e => {
    _filter.search = e.target.value.toLowerCase();
    renderContentOnly();
  });
  document.getElementById('status-filter')?.addEventListener('change', e => {
    _filter.status = e.target.value;
    renderContentOnly();
  });
  document.getElementById('view-preview-btn')?.addEventListener('click', () => {
    _filter.view = 'preview';
    renderPage();
  });
  document.getElementById('view-list-btn')?.addEventListener('click', () => {
    _filter.view = 'list';
    renderPage();
  });

  wireActions();
}

function getFilteredCases() {
  return _webCases.filter(p => {
    if (_filter.status === 'published' && !p.show_on_web) return false;
    if (_filter.status === 'draft' && p.show_on_web) return false;
    if (_filter.status === 'with_url' && (!p.website_url || !p.website_url.trim())) return false;

    if (_filter.search) {
      const q = _filter.search;
      const match = (p.name || '').toLowerCase().includes(q)
        || (p.code || '').toLowerCase().includes(q)
        || (p.client || '').toLowerCase().includes(q)
        || (p.web_tagline || '').toLowerCase().includes(q)
        || (p.family || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}

function renderContent() {
  const filtered = getFilteredCases();
  return `<div id="web-content-area">
    ${_filter.view === 'preview' ? renderPreviewGrid(filtered) : renderTableView(filtered)}
  </div>`;
}

function renderContentOnly() {
  const area = document.getElementById('web-content-area');
  if (!area) return;
  const filtered = getFilteredCases();
  area.innerHTML = _filter.view === 'preview' ? renderPreviewGrid(filtered) : renderTableView(filtered);
  wireActions();
}

// Botón para bloquear el enlace en la web pública o dejarlo de entrada libre
function botonEnlace(p, extra = '') {
  const bloqueado = !!p.web_link_locked;
  return `<button class="toggle-link-btn px-2 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 transition-colors ${bloqueado ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-sky-100 text-sky-800 hover:bg-sky-200'} ${extra}" data-id="${p.id}" data-locked="${bloqueado}" title="${bloqueado ? 'Enlace oculto en la web pública. Clic para dar entrada libre' : 'Cualquiera puede abrir el enlace. Clic para bloquearlo por privacidad'}">
    ${icon(bloqueado ? 'lock' : 'lock_open', 12)} ${bloqueado ? 'Bloqueado' : 'Entrada libre'}
  </button>`;
}

// ─── Vista Previa de Tarjetas Web (Estilo exacto de Imagen 2) ────────────────
function renderPreviewGrid(items) {
  if (!items.length) {
    return `
      <div class="card p-12 text-center">
        <span class="material-icons text-gray-300" style="font-size:48px">public_off</span>
        <p class="text-gray-500 font-medium mt-3">No hay proyectos que coincidan con los filtros</p>
        <button id="reset-filter-btn" class="btn-secondary mt-3 text-sm">${icon('clear', 16)} Limpiar filtros</button>
      </div>`;
  }

  return `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${items.map(webCard).join('')}
    </div>
  `;
}

function webCard(p) {
  const isPublished = !!p.show_on_web;
  const metric = p.web_metric || '100%';
  const tagline = p.web_tagline || (p.project_type === 'web' ? 'Desarrollo Web' : p.project_type === 'mobile' ? 'Aplicativo Móvil' : 'Solución Digital');
  const hasUrl = p.website_url && p.website_url.trim();

  return `
    <div class="rounded-2xl overflow-hidden shadow-xl flex flex-col transition-all duration-300 hover:-translate-y-1 ${isPublished ? 'ring-2 ring-emerald-500/80 shadow-emerald-950/20' : 'opacity-85 ring-1 ring-gray-300'}" style="background: linear-gradient(180deg, #09121a 0%, #03080d 100%); min-height: 440px;">
      
      <!-- Barra de estado interna ADG -->
      <div class="px-4 py-2.5 flex items-center justify-between border-b border-gray-800 bg-gray-900/60 backdrop-blur text-xs">
        <div class="flex items-center gap-1.5 font-mono text-gray-400">
          <span>${esc(p.code)}</span>
        </div>
        <div class="flex items-center gap-2">
          ${p.show_to_comercial ? `<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-900/50 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">${icon('storefront', 12)} Comercial</span>` : ''}
          ${isPublished
            ? `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500 text-black flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-black animate-pulse"></span> PUBLICADO</span>`
            : `<span class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-800 text-gray-400">NO PUBLICADO</span>`}
        </div>
      </div>

      <!-- Tarjeta Web (Visualización exacta de la landing) -->
      <div class="p-6 flex-1 flex flex-col justify-between relative overflow-hidden">
        
        <!-- Glow ambiental suave -->
        <div class="absolute -right-16 -top-16 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Top: Nombre + Categoría -->
        <div>
          <div class="flex items-start justify-between gap-2 mb-4">
            <div>
              <h3 class="font-extrabold text-white text-base tracking-wider uppercase">${esc(p.name)}</h3>
              <p class="text-[11px] font-semibold text-emerald-400/90 tracking-wide uppercase mt-0.5 flex items-center gap-1">
                <span>✦</span> ${esc(tagline)}
              </p>
            </div>
            ${p.family ? `<span class="text-[10px] bg-gray-800/80 text-gray-400 px-2 py-0.5 rounded border border-gray-700 font-mono">${esc(p.family)}</span>` : ''}
          </div>

          <!-- Logo container -->
          <div class="w-full h-32 rounded-xl bg-white/95 border border-white/20 p-4 flex items-center justify-center my-3 shadow-inner">
            ${p.company_logo
              ? `<img src="${esc(p.company_logo)}" alt="${esc(p.name)}" class="max-h-full max-w-full object-contain">`
              : `<div class="flex flex-col items-center gap-1 text-gray-400 font-semibold text-xs">${icon('apartment', 32)}<span>Sin Logo</span></div>`}
          </div>
        </div>

        <!-- Bottom: Métrica, Descripción y Botón URL -->
        <div class="pt-2">
          <div class="text-3xl font-extrabold text-white tracking-tight mb-4 font-mono">${esc(metric)}</div>

          ${hasUrl ? `
            <a href="${esc(p.website_url)}" target="_blank" rel="noopener noreferrer" class="w-full py-2.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors">
              <span>↗ Ver sitio</span>
              <span class="text-[11px] text-gray-400 truncate max-w-[160px]">(${esc(p.website_url.replace(/^https?:\/\//, ''))})</span>
            </a>
            <div class="mt-2 text-center">${botonEnlace(p)}</div>
          ` : `
            <div class="w-full py-2 px-3 rounded-lg bg-gray-800/60 border border-dashed border-gray-700 text-gray-400 font-medium text-xs flex items-center justify-center gap-1.5">
              ${icon('link_off', 14)} Sin URL vinculada
            </div>
          `}
        </div>
      </div>

      <!-- Barra de Controles de Gestión -->
      <div class="p-3 bg-gray-950/90 border-t border-gray-800 flex items-center justify-between gap-2">
        <button class="toggle-web-btn px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${isPublished ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'}" data-id="${p.id}" data-published="${isPublished}">
          ${icon(isPublished ? 'visibility_off' : 'visibility', 15)}
          ${isPublished ? 'Despublicar' : 'Publicar'}
        </button>

        <div class="flex items-center gap-1">
          <button class="edit-web-btn p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors" data-id="${p.id}" title="Editar datos web (URL, Métrica, Impacto)">
            ${icon('edit_note', 18)}
          </button>
          <a href="#/projects/${p.id}" class="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors" title="Ver ficha completa del proyecto">
            ${icon('open_in_new', 18)}
          </a>
        </div>
      </div>

    </div>
  `;
}

// ─── Vista de Tabla Detallada ────────────────────────────────────────────────
function renderTableView(items) {
  if (!items.length) {
    return `<div class="card p-8 text-center text-gray-500">No se encontraron proyectos</div>`;
  }

  return `
    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50 text-gray-600 text-xs uppercase font-semibold border-b border-gray-200">
            <tr>
              <th class="py-3 px-4">Proyecto</th>
              <th class="py-3 px-4">Métrica</th>
              <th class="py-3 px-4">Categoría Web</th>
              <th class="py-3 px-4">URL de la Página</th>
              <th class="py-3 px-4">Visibilidad</th>
              <th class="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${items.map(p => {
              const isPub = !!p.show_on_web;
              return `
                <tr class="hover:bg-gray-50/70 transition-colors">
                  <td class="py-3 px-4">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg border border-gray-200 bg-white flex items-center justify-center p-1 shrink-0 overflow-hidden">
                        ${p.company_logo ? `<img src="${esc(p.company_logo)}" class="max-h-full max-w-full object-contain">` : icon('apartment', 20)}
                      </div>
                      <div class="min-w-0">
                        <a href="#/projects/${p.id}" class="font-semibold text-gray-900 hover:text-primary-600 block truncate">${esc(p.name)}</a>
                        <p class="text-xs text-gray-500 truncate">${esc(p.code)} · ${esc(p.client || 'Sin cliente')}</p>
                      </div>
                    </div>
                  </td>
                  <td class="py-3 px-4 font-mono font-bold text-gray-800">
                    ${esc(p.web_metric || '100%')}
                  </td>
                  <td class="py-3 px-4 text-xs text-gray-600">
                    ${esc(p.web_tagline || '—')}
                  </td>
                  <td class="py-3 px-4">
                    ${p.website_url ? `
                      <a href="${esc(p.website_url)}" target="_blank" rel="noopener noreferrer" class="text-xs text-primary-600 hover:underline flex items-center gap-1 truncate max-w-[220px]">
                        ${icon('link', 14)} ${esc(p.website_url)}
                      </a>
                      <div class="mt-1">${botonEnlace(p)}</div>
                    ` : `<span class="text-xs text-gray-400 italic">Sin URL</span>`}
                  </td>
                  <td class="py-3 px-4">
                    <div class="flex items-center gap-2">
                      <button class="toggle-web-btn px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-colors ${isPub ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}" data-id="${p.id}" data-published="${isPub}">
                        <span class="w-1.5 h-1.5 rounded-full ${isPub ? 'bg-emerald-600' : 'bg-gray-400'}"></span>
                        ${isPub ? 'Publicado' : 'No publicado'}
                      </button>
                      ${p.show_to_comercial ? `<span class="badge bg-emerald-50 text-emerald-700 text-[11px]">${icon('storefront', 12)} Comercial</span>` : ''}
                    </div>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <div class="flex items-center justify-end gap-1">
                      <button class="edit-web-btn btn-secondary text-xs py-1 px-2.5 flex items-center gap-1" data-id="${p.id}">
                        ${icon('edit', 14)} Editar Web
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── Listeners y Eventos Delegados ───────────────────────────────────────────
function wireActions() {
  document.getElementById('reset-filter-btn')?.addEventListener('click', () => {
    _filter.search = '';
    _filter.status = 'all';
    renderPage();
  });

  // Toggle Publicado en Web
  document.querySelectorAll('.toggle-web-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.preventDefault();
      const id = btn.dataset.id;
      const isCurrentlyPublished = btn.dataset.published === 'true';
      const targetState = !isCurrentlyPublished;
      const p = _webCases.find(x => String(x.id) === String(id));

      if (targetState && (!p?.website_url || !p.website_url.trim())) {
        toast('Este proyecto no tiene URL de sitio. Te recomendamos agregar su enlace web.', 'info');
      }

      try {
        btn.disabled = true;
        await saveWebStatus(id, { show_on_web: targetState });
        toast(targetState ? `Proyecto "${p?.name}" publicado en la Web` : `Proyecto "${p?.name}" despublicado de la Web`);
        load();
      } catch (err) {
        toast(err.message || 'Error al cambiar visibilidad', 'error');
        btn.disabled = false;
      }
    });
  });

  // Bloquear enlace o dejarlo de entrada libre
  document.querySelectorAll('.toggle-link-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.preventDefault();
      const bloquear = btn.dataset.locked !== 'true';
      try {
        btn.disabled = true;
        await saveWebStatus(btn.dataset.id, { web_link_locked: bloquear });
        toast(bloquear ? 'Enlace bloqueado en la web pública' : 'Enlace con entrada libre');
        load();
      } catch (err) {
        toast(err.message || 'Error al cambiar el enlace', 'error');
        btn.disabled = false;
      }
    });
  });

  // Editar Datos Web
  document.querySelectorAll('.edit-web-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const id = btn.dataset.id;
      const p = _webCases.find(x => String(x.id) === String(id));
      if (p) openEditWebModal(p);
    });
  });
}

// ─── Modal: Publicar Proyecto en Web (Seleccionando de los existentes) ────────
function openPublishModal() {
  const availableProjects = _allProjects;

  showModal('Publicar Proyecto en Qubira Web', `
    <form id="publish-web-form" class="space-y-4">
      <div>
        <label class="label font-semibold">Seleccionar Proyecto del Sistema *</label>
        <select id="project-selector" class="input" required>
          <option value="">-- Elige un proyecto para publicar --</option>
          ${availableProjects.map(p => `
            <option value="${p.id}" ${p.show_on_web ? 'data-pub="1"' : ''}>
              ${esc(p.name)} (${esc(p.code)}) ${p.show_on_web ? '✓ Ya en web' : ''}
            </option>
          `).join('')}
        </select>
        <p class="text-xs text-gray-500 mt-1">Al elegir un proyecto, jalaremos automáticamente su nombre, logo, descripción y su link de sitio web si ya lo tiene configurado.</p>
      </div>

      <div id="project-web-fields" class="space-y-4 pt-3 border-t border-gray-100 hidden">
        <!-- Logo y Nombre Previsualizado -->
        <div class="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
          <div id="modal-logo-wrap" class="w-12 h-12 rounded-lg bg-white border border-gray-200 flex items-center justify-center p-1 shrink-0 overflow-hidden">
            <span class="material-icons text-gray-400">apartment</span>
          </div>
          <div class="min-w-0 flex-1">
            <h4 id="modal-project-name" class="font-bold text-gray-900 truncate">—</h4>
            <p id="modal-project-sub" class="text-xs text-gray-500 truncate">—</p>
          </div>
        </div>

        <!-- URL del Sitio Web -->
        <div>
          <label class="label font-semibold">Link de la Página Web (URL de destino) *</label>
          <div class="relative">
            <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" style="font-size:18px">link</span>
            <input class="input pl-9" type="url" id="modal-website-url" name="website_url" required placeholder="https://ejemplo.com o https://proyecto.vercel.app">
          </div>
          <p class="text-xs text-gray-400 mt-1">Es la URL a la que dirigirá el botón «↗ Ver sitio» en el carrusel de la página web.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="label font-semibold">Métrica de Impacto</label>
            <input class="input" id="modal-web-metric" name="web_metric" value="100%" placeholder="Ej: 100%, 3x, 40%, 14·02">
            <div class="flex gap-1.5 mt-1.5">
              ${['100%', '3x', '40%', '99.9%', '24/7'].map(m => `
                <button type="button" class="metric-quick-btn text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-mono">${m}</button>
              `).join('')}
            </div>
          </div>

          <div>
            <label class="label font-semibold">Categoría / Industria Web</label>
            <input class="input" id="modal-web-tagline" name="web_tagline" placeholder="Ej: Fintech & Pagos Digitales, Salud & Bienestar">
            <p class="text-xs text-gray-400 mt-1">Etiqueta superior en la tarjeta web</p>
          </div>
        </div>


        <div class="bg-indigo-50/80 border border-indigo-200 rounded-lg p-3 text-xs text-indigo-900 flex items-start gap-2">
          ${icon('info', 18)}
          <div>
            <p class="font-semibold">Publicación instantánea</p>
            <p class="mt-0.5">Al guardar, este proyecto aparecerá de inmediato en la sección <strong>«Casos que muestran impacto real»</strong> de la web de Qubira.</p>
          </div>
        </div>
      </div>
    </form>
  `, 'lg', `
    <div class="flex justify-end gap-3">
      <button type="button" id="modal-cancel-btn" class="btn-secondary">Cancelar</button>
      <button type="submit" form="publish-web-form" id="modal-save-btn" class="btn-primary" disabled>
        ${icon('check', 18)} Guardar y Publicar
      </button>
    </div>
  `);

  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeModal);

  // Cambio en el selector de proyecto
  const selector = document.getElementById('project-selector');
  const fields = document.getElementById('project-web-fields');
  const saveBtn = document.getElementById('modal-save-btn');

  selector?.addEventListener('change', () => {
    const projId = selector.value;
    const p = _allProjects.find(x => String(x.id) === String(projId));

    if (!p) {
      fields.classList.add('hidden');
      saveBtn.disabled = true;
      return;
    }

    fields.classList.remove('hidden');
    saveBtn.disabled = false;

    // Actualizar previsualización
    document.getElementById('modal-project-name').textContent = p.name;
    document.getElementById('modal-project-sub').textContent = `${p.code} · ${p.client || 'Sin cliente'}`;

    const logoWrap = document.getElementById('modal-logo-wrap');
    if (p.company_logo) {
      logoWrap.innerHTML = `<img src="${esc(p.company_logo)}" class="max-h-full max-w-full object-contain">`;
    } else {
      logoWrap.innerHTML = icon('apartment', 24);
    }

    // Jalar campos del proyecto
    document.getElementById('modal-website-url').value = p.website_url || '';
    document.getElementById('modal-web-metric').value = p.web_metric || '100%';
    document.getElementById('modal-web-tagline').value = p.web_tagline || (p.project_type === 'web' ? 'Desarrollo Web' : p.project_type === 'mobile' ? 'Aplicativo Móvil' : 'Solución Digital');
  });

  // Botones de métrica rápida
  document.querySelectorAll('.metric-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('modal-web-metric');
      if (input) input.value = btn.textContent.trim();
    });
  });

  // Guardar publicación
  document.getElementById('publish-web-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const projId = selector.value;
    if (!projId) return;

    const website_url = document.getElementById('modal-website-url').value.trim();
    const web_metric = document.getElementById('modal-web-metric').value.trim();
    const web_tagline = document.getElementById('modal-web-tagline').value.trim();

    try {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `${icon('sync', 16)} Guardando...`;

      await saveWebStatus(projId, {
        show_on_web: true,
        website_url,
        web_metric,
        web_tagline      });

      toast('Proyecto publicado exitosamente en Qubira Web');
      closeModal();
      load();
    } catch (err) {
      toast(err.message || 'Error al publicar proyecto', 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = `${icon('check', 18)} Guardar y Publicar`;
    }
  });
}

// ─── Modal: Editar Datos Web de un Proyecto ──────────────────────────────────
function openEditWebModal(p) {
  showModal(`Editar Datos Web — ${esc(p.name)}`, `
    <form id="edit-web-form" class="space-y-4">
      <div class="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
        <div class="w-12 h-12 rounded-lg bg-white border border-gray-200 flex items-center justify-center p-1 shrink-0 overflow-hidden">
          ${p.company_logo ? `<img src="${esc(p.company_logo)}" class="max-h-full max-w-full object-contain">` : icon('apartment', 24)}
        </div>
        <div class="min-w-0 flex-1">
          <h4 class="font-bold text-gray-900 truncate">${esc(p.name)}</h4>
          <p class="text-xs text-gray-500 truncate">${esc(p.code)} · ${esc(p.client || 'Sin cliente')}</p>
        </div>
      </div>

      <!-- Publicación Toggle -->
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <label class="flex items-center gap-2.5 cursor-pointer select-none">
          <input type="checkbox" id="edit-show-on-web" ${p.show_on_web ? 'checked' : ''} class="w-4 h-4 rounded border-indigo-600 text-indigo-600 focus:ring-indigo-500">
          <div>
            <span class="text-sm font-semibold text-gray-800">Publicado en «Casos que muestran impacto real»</span>
            <p class="text-xs text-gray-500">Si está marcado, se mostrará en el carrusel de la página web principal.</p>
          </div>
        </label>
      </div>

      <!-- URL del Sitio Web -->
      <div>
        <label class="label font-semibold">Link de la Página Web (URL de destino)</label>
        <div class="relative">
          <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" style="font-size:18px">link</span>
          <input class="input pl-9" type="url" id="edit-website-url" value="${esc(p.website_url || '')}" placeholder="https://ejemplo.com o https://proyecto.vercel.app">
        </div>
        <p class="text-xs text-gray-400 mt-1">Jala automáticamente el enlace del proyecto o ingresa el enlace directo.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="label font-semibold">Métrica de Impacto</label>
          <input class="input font-mono" id="edit-web-metric" value="${esc(p.web_metric || '100%')}" placeholder="Ej: 100%, 3x, 40%">
          <div class="flex gap-1.5 mt-1.5">
            ${['100%', '3x', '40%', '99.9%', '24/7'].map(m => `
              <button type="button" class="edit-metric-btn text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-mono">${m}</button>
            `).join('')}
          </div>
        </div>

        <div>
          <label class="label font-semibold">Categoría / Industria Web</label>
          <input class="input" id="edit-web-tagline" value="${esc(p.web_tagline || '')}" placeholder="Ej: Fintech & Pagos Digitales, Salud & Bienestar">
        </div>
      </div>

    </form>
  `, 'lg', `
    <div class="flex justify-between items-center w-full">
      <a href="#/projects/${p.id}" class="btn-secondary text-xs inline-flex items-center gap-1" onclick="document.getElementById('modal-close-btn').click()">
        ${icon('open_in_new', 14)} Abrir Ficha Completa
      </a>
      <div class="flex gap-3">
        <button type="button" id="edit-modal-cancel" class="btn-secondary">Cancelar</button>
        <button type="submit" form="edit-web-form" id="edit-modal-save" class="btn-primary">Guardar Cambios</button>
      </div>
    </div>
  `);

  document.getElementById('edit-modal-cancel')?.addEventListener('click', closeModal);

  document.querySelectorAll('.edit-metric-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('edit-web-metric');
      if (input) input.value = btn.textContent.trim();
    });
  });

  document.getElementById('edit-web-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const show_on_web = document.getElementById('edit-show-on-web').checked;
    const website_url = document.getElementById('edit-website-url').value.trim();
    const web_metric = document.getElementById('edit-web-metric').value.trim();
    const web_tagline = document.getElementById('edit-web-tagline').value.trim();

    const saveBtn = document.getElementById('edit-modal-save');
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando...';

      await saveWebStatus(p.id, {
        show_on_web,
        website_url,
        web_metric,
        web_tagline      });

      toast('Datos web actualizados correctamente');
      closeModal();
      load();
    } catch (err) {
      toast(err.message || 'Error al actualizar datos web', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar Cambios';
    }
  });
}

