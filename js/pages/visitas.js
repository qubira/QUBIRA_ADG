import { api }      from '../api.js';
import { getUser }  from '../state.js';
import { pageHeader, spinner, icon, showModal } from '../utils.js';

const QUALIFYING_CARGOS = ['SUPERVISOR', 'COORDINADOR', 'GERENTE'];
const EVENT_TYPES = [
  ['page_view', 'Vista de página'],
  ['case_click', 'Click en caso de éxito'],
  ['whatsapp_click', 'Click en WhatsApp'],
  ['chatbot_open', 'Abrió el chatbot'],
  ['chatbot_message', 'Mensaje al chatbot'],
  ['scroll_depth', 'Scroll'],
  ['time_on_page', 'Tiempo en página'],
  ['outbound_click', 'Click a link externo'],
  ['nav_click', 'Click en navegación'],
];
const EVENT_COLOR = {
  page_view: 'bg-gray-100 text-gray-600', case_click: 'bg-green-100 text-green-700',
  whatsapp_click: 'bg-green-100 text-green-700', chatbot_open: 'bg-amber-100 text-amber-700',
  chatbot_message: 'bg-amber-100 text-amber-700',
  scroll_depth: 'bg-gray-100 text-gray-600', time_on_page: 'bg-gray-100 text-gray-600',
  outbound_click: 'bg-amber-100 text-amber-700', nav_click: 'bg-gray-100 text-gray-600',
};
const DONUT_COLORS = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];
const DEVICE_ICON = { 'Móvil': 'smartphone', 'Tablet': 'tablet_mac', 'Escritorio': 'computer', 'Desconocido': 'public' };
const TIMELINE_ICON = {
  page_view: 'visibility', case_click: 'open_in_new', whatsapp_click: 'chat',
  chatbot_open: 'smart_toy', chatbot_message: 'forum',
  scroll_depth: 'leaderboard', time_on_page: 'schedule', outbound_click: 'open_in_new', nav_click: 'touch_app',
};

let _tab = 'sessions'; // 'sessions' | 'events'
let _metricsTab = 'resumen'; // 'resumen' | 'adquisicion' | 'comportamiento'
let _days = 30;
let _summary = null;

let _sRows = [];
let _sTotal = 0;
let _sOffset = 0;
const S_PAGE_SIZE = 30;
let _sFilters = { q: '', only_leads: false };

let _rows = [];
let _total = 0;
let _offset = 0;
const PAGE_SIZE = 50;
let _filters = { event_type: '', date_from: '', date_to: '', q: '' };

function canViewAnalytics() {
  const u = getUser();
  if (!u) return false;
  if ((u.nivel_acceso || 0) >= 100) return true;
  return QUALIFYING_CARGOS.includes(String(u.cargo || '').toUpperCase());
}

export function render() {
  const c = document.getElementById('main');
  if (!canViewAnalytics()) {
    c.innerHTML = `<div class="p-8">
      ${pageHeader('Visitas', '')}
      <div class="card p-8 text-center text-gray-400">No tienes permiso para ver las estadísticas del sitio.</div>
    </div>`;
    return;
  }
  c.innerHTML = `<div class="p-6 max-w-7xl mx-auto">
    ${pageHeader('Visitas', 'Cómo interactúan los visitantes con el sitio público de QUBIRA')}
    <div id="visitas-page">${spinner()}</div>
  </div>`;
  _offset = 0;
  _sOffset = 0;
  loadAll();
}

function sessionParams() {
  return {
    days: _days,
    q: _sFilters.q || undefined,
    only_leads: _sFilters.only_leads ? 1 : undefined,
    limit: S_PAGE_SIZE, offset: _sOffset,
  };
}

function eventParams() {
  return {
    event_type: _filters.event_type || undefined,
    date_from: _filters.date_from || undefined,
    date_to: _filters.date_to || undefined,
    q: _filters.q || undefined,
    limit: PAGE_SIZE, offset: _offset,
  };
}

async function loadAll() {
  try {
    const [summary, sessions] = await Promise.all([
      api.get('/analytics/summary', { days: _days }),
      api.get('/analytics/sessions', sessionParams()),
    ]);
    _summary = summary;
    _sRows = sessions.rows;
    _sTotal = sessions.total;
    renderPage();
  } catch (err) {
    const c = document.getElementById('visitas-page');
    if (c) c.innerHTML = `<p class="text-center text-red-400 py-16">${esc(err.message || 'No se pudo cargar Visitas')}</p>`;
  }
}

async function reloadSessions(append = false) {
  try {
    const data = await api.get('/analytics/sessions', sessionParams());
    _sRows = append ? [..._sRows, ...data.rows] : data.rows;
    _sTotal = data.total;
    renderSessionsTable();
    renderSessionsFooter();
  } catch (err) { /* la tabla se queda como estaba si falla un refresco de filtro */ }
}

async function reloadEvents(append = false) {
  try {
    const data = await api.get('/analytics/events', eventParams());
    _rows = append ? [..._rows, ...data.rows] : data.rows;
    _total = data.total;
    renderEventsTable();
    renderEventsFooter();
  } catch (err) { /* la tabla se queda como estaba si falla un refresco de filtro */ }
}

function renderPage() {
  const c = document.getElementById('visitas-page');
  if (!c) return;
  c.innerHTML = rangeHtml() + metricsTabsHtml() + metricsContentHtml() + tabsHtml();
  document.getElementById('vis-range')?.addEventListener('change', e => { _days = Number(e.target.value); _sOffset = 0; _offset = 0; loadAll(); });
  wireMetricsTabs();
  wireTabs();
  if (_tab === 'sessions') {
    renderSessionsTable();
    renderSessionsFooter();
    wireSessionFilters();
  } else {
    if (_rows.length === 0 && _total === 0) reloadEvents();
    else { renderEventsTable(); renderEventsFooter(); }
    wireFilters();
  }
}

function rangeHtml() {
  return `
  <div class="flex items-center gap-2 mb-4">
    <span class="text-sm text-gray-500">Rango de las estadísticas:</span>
    <select id="vis-range" class="input w-auto">
      <option value="7"  ${_days === 7 ? 'selected' : ''}>Últimos 7 días</option>
      <option value="30" ${_days === 30 ? 'selected' : ''}>Últimos 30 días</option>
      <option value="90" ${_days === 90 ? 'selected' : ''}>Últimos 90 días</option>
    </select>
  </div>`;
}

function statCard(iconName, label, value, color, sub = '') {
  return `<div class="card p-5">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-sm text-gray-500">${label}</p>
        <p class="text-3xl font-bold text-gray-900 mt-1">${value}</p>
        ${sub ? `<p class="text-xs text-gray-400 mt-1">${sub}</p>` : ''}
      </div>
      <div class="w-11 h-11 rounded-xl flex items-center justify-center ${color} text-white shrink-0">${icon(iconName, 22)}</div>
    </div>
  </div>`;
}

function metricsTabsHtml() {
  const tabs = [
    ['resumen', 'Resumen', 'bar_chart'],
    ['adquisicion', 'Adquisición', 'public'],
    ['comportamiento', 'Comportamiento', 'bolt'],
  ];
  return `
  <div class="flex gap-2 mb-6 flex-wrap">
    ${tabs.map(([key, label, ic]) => `
      <button id="vis-mtab-${key}" class="${_metricsTab === key ? 'btn-primary' : 'btn-secondary'} text-sm px-3 py-2 inline-flex items-center gap-1.5">${icon(ic, 17)} ${label}</button>`).join('')}
  </div>`;
}

function wireMetricsTabs() {
  ['resumen', 'adquisicion', 'comportamiento'].forEach(key => {
    document.getElementById('vis-mtab-' + key)?.addEventListener('click', () => {
      if (_metricsTab === key) return;
      _metricsTab = key;
      renderPage();
    });
  });
}

function metricsContentHtml() {
  if (_metricsTab === 'adquisicion') return adquisicionHtml();
  if (_metricsTab === 'comportamiento') return comportamientoHtml();
  return resumenHtml();
}

function sectionHeading(iconName, title, desc) {
  return `
  <div class="flex items-start gap-3 mb-4">
    <div class="w-9 h-9 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center shrink-0">${icon(iconName, 19)}</div>
    <div>
      <h2 class="text-base font-bold text-gray-900">${title}</h2>
      <p class="text-sm text-gray-500 mt-0.5 max-w-lg">${desc}</p>
    </div>
  </div>`;
}

function resumenHtml() {
  const s = _summary;
  return `
  ${sectionHeading('bar_chart', 'Resumen', 'Panorama general del tráfico e interacciones del sitio en el rango seleccionado.')}
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
    ${statCard('visibility', 'Vistas de página', s.total_views, 'bg-primary-600', `últimos ${s.days} días`)}
    ${statCard('groups', 'Visitantes únicos', s.unique_visitors, 'bg-green-500', `${s.new_visitors ?? 0} nuevos · ${s.returning_visitors ?? 0} recurrentes`)}
    ${statCard('local_fire_department', 'Leads calientes', s.hot_leads ?? 0, 'bg-red-500', 'escribieron o mandaron WhatsApp')}
    ${statCard('chat', 'Clicks en WhatsApp', s.whatsapp_clicks, 'bg-green-500', 'flotante + botones de contacto')}
  </div>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    ${statCard('person_add', 'Visitantes nuevos', s.new_visitors ?? 0, 'bg-primary-600', 'primera vez en este rango')}
    ${statCard('how_to_reg', 'Recurrentes', s.returning_visitors ?? 0, 'bg-amber-500', 'ya habían visitado antes')}
    ${statCard('schedule', 'Tiempo promedio en página', formatSeconds(s.avg_time_on_page_seconds), 'bg-primary-600', 'mientras la pestaña estaba visible')}
    ${statCard('bolt', 'Tasa de interacción', `${s.engagement_rate ?? 0}%`, 'bg-green-500', `${s.engaged_sessions ?? 0} de ${s.total_sessions ?? 0} sesiones`)}
  </div>
  <div class="card p-5">
    <h3 class="font-semibold text-gray-900 mb-3">Vistas de página por día (${s.days} días)</h3>
    ${(s.views_by_day || []).length === 0
      ? '<p class="text-center text-gray-400 py-10 text-sm">Sin vistas registradas en este rango.</p>'
      : singleBarChart(s.views_by_day, { key: 'total' })}
  </div>`;
}

function adquisicionHtml() {
  const s = _summary;
  const channels = s.channels || [];
  const channelLegend = channels.map((c, i) => `
    <div class="flex items-center gap-2 text-sm py-1" style="min-width:180px">
      <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${DONUT_COLORS[i % DONUT_COLORS.length]}"></span>
      <span class="text-gray-700 flex-1">${esc(c.channel)}</span>
      <span class="text-gray-400 tabular-nums">${c.total}</span>
    </div>`).join('');
  const campaignRows = (s.top_campaigns || []).map(c => ({ label: `${c.utm_campaign} · ${c.utm_source || ''}`, value: c.sessions }));
  const referrerRows = (s.top_referrers || []).map(r => ({ label: referrerHost(r.referrer), value: r.total, title: r.referrer }));

  return `
  ${sectionHeading('public', 'Adquisición', 'De dónde vienen tus visitantes: canales de tráfico, campañas de marketing y sitios que refieren.')}
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <div class="card p-5">
      <h3 class="font-semibold text-gray-900 mb-3">Canales de tráfico</h3>
      <div class="flex items-center gap-5 flex-wrap">
        ${channels.length === 0
          ? '<p class="text-sm text-gray-400">Sin datos en este rango.</p>'
          : donutChart(channels.map(c => ({ label: c.channel, value: c.total })), { holeLabel: 'sesiones' })}
        <div class="flex flex-col">${channelLegend}</div>
      </div>
    </div>
    <div class="card p-5">
      <h3 class="font-semibold text-gray-900 mb-3">Campañas (UTM)</h3>
      ${barListHtml(campaignRows, 'Sin campañas registradas en este rango.')}
    </div>
  </div>
  <div class="card p-5">
    <h3 class="font-semibold text-gray-900 mb-3">De dónde llegan</h3>
    ${barListHtml(referrerRows, 'Sin referencias externas en este rango (entran directo).')}
  </div>`;
}

function comportamientoHtml() {
  const s = _summary;
  const cases = s.top_cases || [];
  const caseLegend = cases.map((c, i) => `
    <div class="flex items-center gap-2 text-sm py-1" style="min-width:180px">
      <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${DONUT_COLORS[i % DONUT_COLORS.length]}"></span>
      <span class="text-gray-700 flex-1">${esc(c.case_name)}</span>
      <span class="text-gray-400 tabular-nums">${c.total}</span>
    </div>`).join('');
  const devices = s.device_breakdown || [];
  const deviceLegend = devices.map((d, i) => `
    <div class="flex items-center gap-2 text-sm py-1" style="min-width:150px">
      <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${DONUT_COLORS[i % DONUT_COLORS.length]}"></span>
      <span class="text-gray-700 flex-1 flex items-center gap-1.5">${icon(DEVICE_ICON[d.device] || 'public', 15)}${esc(d.device)}</span>
      <span class="text-gray-400 tabular-nums">${d.total}</span>
    </div>`).join('');
  const pageRows = (s.top_pages || []).map(p => ({ label: p.page, value: p.total }));
  const navRows = (s.top_nav_clicks || []).map(n => ({ label: n.seccion, value: n.total }));
  const outboundRows = (s.top_outbound_clicks || []).map(o => ({ label: o.destino, value: o.total }));

  return `
  ${sectionHeading('bolt', 'Comportamiento', 'Qué tan lejos llegan los visitantes en la página y con qué elementos interactúan.')}
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <div class="card p-5">
      <h3 class="font-semibold text-gray-900 mb-3">Profundidad de scroll</h3>
      ${funnelHtml(s.scroll_depth || [])}
    </div>
    <div class="card p-5">
      <h3 class="font-semibold text-gray-900 mb-3">Páginas más vistas</h3>
      ${barListHtml(pageRows, 'Sin datos en este rango.')}
    </div>
    <div class="card p-5">
      <h3 class="font-semibold text-gray-900 mb-3">Casos de éxito más clickeados</h3>
      <div class="flex items-center gap-5 flex-wrap">
        ${cases.length === 0
          ? '<p class="text-sm text-gray-400">Sin clicks todavía en este rango.</p>'
          : donutChart(cases.map(c => ({ label: c.case_name, value: c.total })), { holeLabel: 'clicks' })}
        <div class="flex flex-col">${caseLegend}</div>
      </div>
    </div>
    <div class="card p-5">
      <h3 class="font-semibold text-gray-900 mb-3">Dispositivos</h3>
      <div class="flex items-center gap-5 flex-wrap">
        ${devices.length === 0
          ? '<p class="text-sm text-gray-400">Sin datos en este rango.</p>'
          : donutChart(devices.map(d => ({ label: d.device, value: d.total })), { holeLabel: 'visitas' })}
        <div class="flex flex-col">${deviceLegend}</div>
      </div>
    </div>
  </div>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div class="card p-5">
      <h3 class="font-semibold text-gray-900 mb-3">Clicks en navegación</h3>
      ${barListHtml(navRows, 'Sin clicks de navegación en este rango.')}
    </div>
    <div class="card p-5">
      <h3 class="font-semibold text-gray-900 mb-3">Clicks a links externos</h3>
      ${barListHtml(outboundRows, 'Sin clicks a sitios externos en este rango.')}
    </div>
  </div>`;
}

function formatSeconds(totalSeconds) {
  const s = Math.round(totalSeconds || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

/* ── Gráficos SVG minimalistas, sin librerías — mismo criterio que el
   resto de Qubira (ver charts.js en QUBIRA_DST); acá se portan las dos
   funciones que hacen falta, con los colores de Tailwind de este panel
   en vez de custom properties (ADG no usa var(--...), es Tailwind puro). */
function fmtDayLabel(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function singleBarChart(data, { key, color = '#2563eb', width = 900, height = 160 } = {}) {
  const pad = { top: 8, right: 8, bottom: 22, left: 30 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const maxVal = Math.max(1, ...data.map(d => d[key] || 0));
  const n = Math.max(1, data.length);
  const groupW = chartW / n;
  const barW = Math.max(3, groupW * 0.55);

  let bars = '', labels = '';
  data.forEach((d, i) => {
    const x0 = pad.left + i * groupW + (groupW - barW) / 2;
    const h = ((d[key] || 0) / maxVal) * chartH;
    bars += `<rect x="${x0}" y="${pad.top + chartH - h}" width="${barW}" height="${h}" fill="${color}" rx="1.5"><title>${d[key] || 0}</title></rect>`;
    const showLabel = n <= 10 || i % Math.ceil(n / 10) === 0 || i === n - 1;
    if (showLabel) labels += `<text x="${x0 + barW / 2}" y="${height - 4}" text-anchor="middle" font-size="10" fill="#9ca3af">${fmtDayLabel(d.dia)}</text>`;
  });
  const zeroLine = `<line x1="${pad.left}" y1="${pad.top + chartH}" x2="${width - pad.right}" y2="${pad.top + chartH}" stroke="#e5e7eb" stroke-width="1"/>`;
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img">${zeroLine}${bars}${labels}</svg>`;
}

function donutChart(data, { size = 150, colors = DONUT_COLORS, holeLabel = '' } = {}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const holeSize = Math.round(size * 0.6);
  const holeInset = Math.round((size - holeSize) / 2);
  let background = '#f3f4f6';
  if (total > 0) {
    let acc = 0;
    const stops = data.map((d, i) => {
      const start = (acc / total) * 360;
      acc += d.value;
      const end = (acc / total) * 360;
      return `${colors[i % colors.length]} ${start}deg ${end}deg`;
    });
    background = `conic-gradient(${stops.join(', ')})`;
  }
  return `
    <div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${background};flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,.08)">
      <div style="position:absolute;inset:${holeInset}px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center">
        <span style="font-size:${Math.round(size * 0.16)}px;font-weight:800;color:#111827;line-height:1">${total}</span>
        <span style="font-size:${Math.round(size * 0.075)}px;color:#9ca3af;margin-top:3px;text-transform:uppercase;letter-spacing:.04em">${holeLabel}</span>
      </div>
    </div>`;
}

/* Lista de ranking con barra proporcional al valor máximo — reemplaza
   los divide-y de solo texto para que las listas "top N" se vean como
   en un dashboard real en vez de una tabla plana. */
function barListHtml(rows, emptyText) {
  if (!rows || rows.length === 0) {
    return `<p class="text-sm text-gray-400">${emptyText}</p>`;
  }
  const max = Math.max(1, ...rows.map(r => r.value));
  return `<div class="flex flex-col gap-3">${rows.map((r, i) => {
    const pct = Math.round((r.value / max) * 100);
    return `
    <div>
      <div class="flex justify-between text-sm mb-1">
        <span class="text-gray-700 truncate"${r.title ? ` title="${esc(r.title)}"` : ''}>${esc(r.label)}</span>
        <span class="text-gray-500 font-semibold tabular-nums shrink-0 ml-2">${r.value}</span>
      </div>
      <div class="bg-gray-100 rounded-md h-2 overflow-hidden">
        <div class="h-full rounded-md" style="width:${pct}%;background:${DONUT_COLORS[i % DONUT_COLORS.length]}"></div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

/* Embudo real: cada escalón se dibuja como una barra centrada cuyo
   ancho es proporcional al primer paso (25% de scroll = 100% de la
   base), con el % de caída respecto al escalón anterior en medio. */
function funnelHtml(scrollDepth) {
  const order = ['25', '50', '75', '100'];
  const byDepth = Object.fromEntries((scrollDepth || []).map(r => [String(r.depth), Number(r.sessions) || 0]));
  const values = order.map(d => byDepth[d] || 0);
  if (!values.some(v => v > 0)) {
    return '<p class="text-sm text-gray-400">Sin datos de scroll en este rango.</p>';
  }
  const base = values[0] > 0 ? values[0] : Math.max(...values, 1);
  return `<div class="flex flex-col items-center">${order.map((d, i) => {
    const val = values[i];
    const pctOfBase = Math.round((val / base) * 100);
    const prevVal = i > 0 ? values[i - 1] : null;
    const drop = (prevVal && prevVal > 0) ? Math.round(((prevVal - val) / prevVal) * 100) : null;
    return `
    ${drop !== null ? `<div class="text-xs text-gray-400 py-1.5">▼ ${drop}% de caída respecto al paso anterior</div>` : ''}
    <div class="w-full flex justify-center">
      <div class="h-11 rounded-lg flex items-center justify-center text-white text-sm font-bold px-3" style="width:${Math.max(pctOfBase, 12)}%;background:${DONUT_COLORS[i % DONUT_COLORS.length]}">${val} sesiones</div>
    </div>
    <div class="w-full flex justify-between text-xs text-gray-400 mt-1 mb-1">
      <span>${d}% de la página</span><span>${pctOfBase}% del primer paso</span>
    </div>`;
  }).join('')}</div>`;
}

function tabsHtml() {
  return `
  <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
    <div class="flex gap-2">
      <button id="vis-tab-sessions" class="${_tab === 'sessions' ? 'btn-primary' : 'btn-secondary'} text-sm px-3 py-2 inline-flex items-center gap-1.5">${icon('groups', 17)} Sesiones</button>
      <button id="vis-tab-events" class="${_tab === 'events' ? 'btn-primary' : 'btn-secondary'} text-sm px-3 py-2 inline-flex items-center gap-1.5">${icon('list_alt', 17)} Eventos crudos</button>
    </div>
  </div>
  <div id="vis-tab-body">${_tab === 'sessions' ? sessionsShellHtml() : eventsShellHtml()}</div>`;
}

function wireTabs() {
  document.getElementById('vis-tab-sessions')?.addEventListener('click', () => { if (_tab !== 'sessions') { _tab = 'sessions'; renderPage(); } });
  document.getElementById('vis-tab-events')?.addEventListener('click', () => { if (_tab !== 'events') { _tab = 'events'; renderPage(); } });
}

// ─── Sesiones (viaje del visitante) ────────────────────────────────────────

function sessionsShellHtml() {
  return `
  <div class="flex flex-wrap items-center gap-3 mb-4">
    <input id="vis-s-q" class="input w-auto" placeholder="Buscar caso, página, origen..." value="${esc(_sFilters.q)}">
    <label class="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
      <input type="checkbox" id="vis-s-leads" ${_sFilters.only_leads ? 'checked' : ''}> Solo leads calientes 🔥
    </label>
  </div>
  <div id="sessions-table-wrap"></div>
  <div class="flex items-center justify-between mt-4 text-sm text-gray-500">
    <span id="sessions-count"></span>
    <button id="sessions-load-more" class="btn-secondary text-xs px-3 py-1.5" style="display:none">Cargar más</button>
  </div>`;
}

function referrerHost(ref) {
  if (!ref) return '—';
  try { return new URL(ref).hostname; } catch { return ref.slice(0, 40); }
}

function sessionRowHtml(r) {
  const cases = (r.cases || []).slice(0, 2).map(c => `<span class="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full mr-1">${esc(c)}</span>`).join('');
  const casesExtra = (r.cases || []).length > 2 ? `<span class="inline-block bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">+${r.cases.length - 2}</span>` : '';
  return `
  <div class="grid grid-cols-[150px_180px_80px_130px_1fr_100px_100px_110px_90px] gap-3 px-4 py-2.5 text-sm items-center vis-session-row cursor-pointer hover:bg-gray-50" data-session="${esc(r.session_id)}">
    <span class="text-gray-500 text-xs">${fmtDateTime(r.last_seen)}</span>
    <span class="text-gray-700 text-xs flex items-center gap-1.5">${icon(DEVICE_ICON[r.device] || 'public', 16)} ${esc(r.device)} · ${esc(r.browser)}</span>
    <span class="text-gray-500 text-xs">${r.page_views}</span>
    <span class="text-gray-500 text-xs truncate" title="${esc(r.entry_page || '')} → ${esc(r.exit_page || '')}">${esc(r.channel || 'Directo')}</span>
    <span class="truncate">${cases || '<span class="text-gray-300 text-xs">—</span>'}${casesExtra}</span>
    <span class="text-gray-500 text-xs">${r.whatsapp_clicks > 0 ? `${icon('chat', 14)} ${r.whatsapp_clicks}` : '—'}</span>
    <span class="text-gray-500 text-xs">${r.chatbot_messages > 0 ? `${icon('forum', 14)} ${r.chatbot_messages}` : '—'}</span>
    <span class="text-gray-500 text-xs">${r.time_on_page_seconds != null ? formatSeconds(r.time_on_page_seconds) : '—'}${r.scroll_max ? ` · ${r.scroll_max}%` : ''}</span>
    <span>${r.is_lead ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">🔥 Lead</span>' : ''}</span>
  </div>`;
}

function renderSessionsTable() {
  const wrap = document.getElementById('sessions-table-wrap');
  if (!wrap) return;
  if (_sRows.length === 0) {
    wrap.innerHTML = `<div class="card p-8 text-center text-gray-400 text-sm">Sin sesiones en este rango</div>`;
    return;
  }
  wrap.innerHTML = `
  <div class="card divide-y divide-gray-100">
    <div class="grid grid-cols-[150px_180px_80px_130px_1fr_100px_100px_110px_90px] gap-3 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
      <span>Última visita</span><span>Dispositivo</span><span>Páginas</span><span>Canal</span><span>Casos vistos</span><span>WhatsApp</span><span>Chatbot</span><span>Tiempo/Scroll</span><span></span>
    </div>
    ${_sRows.map(sessionRowHtml).join('')}
  </div>`;
  wrap.querySelectorAll('.vis-session-row').forEach(el => {
    el.addEventListener('click', () => openSessionTimeline(el.dataset.session));
  });
}

function renderSessionsFooter() {
  const count = document.getElementById('sessions-count');
  const more = document.getElementById('sessions-load-more');
  if (count) count.textContent = `${_sRows.length} de ${_sTotal} sesiones`;
  if (more) {
    more.style.display = _sRows.length < _sTotal ? 'inline-flex' : 'none';
    more.onclick = () => { _sOffset += S_PAGE_SIZE; reloadSessions(true); };
  }
}

function wireSessionFilters() {
  let qDebounce;
  document.getElementById('vis-s-q')?.addEventListener('input', e => {
    clearTimeout(qDebounce);
    qDebounce = setTimeout(() => { _sFilters.q = e.target.value; _sOffset = 0; reloadSessions(); }, 350);
  });
  document.getElementById('vis-s-leads')?.addEventListener('change', e => {
    _sFilters.only_leads = e.target.checked; _sOffset = 0; reloadSessions();
  });
}

async function openSessionTimeline(sessionId) {
  showModal('Recorrido del visitante', `<div id="vis-timeline-body"><p class="text-sm text-gray-400">Cargando recorrido…</p></div>`, 'lg');
  try {
    const data = await api.get(`/analytics/sessions/${encodeURIComponent(sessionId)}/timeline`);
    const body = document.getElementById('vis-timeline-body');
    if (!body) return;
    if (!data.events.length) {
      body.innerHTML = `<p class="text-sm text-gray-400">Sin eventos para esta sesión.</p>`;
      return;
    }
    const header = `
      <div class="flex flex-wrap gap-4 px-3 py-2.5 bg-gray-50 rounded-xl mb-4 text-sm text-gray-500">
        <span class="flex items-center gap-1.5">${icon(DEVICE_ICON[data.device] || 'public', 16)} ${esc(data.device || '—')}</span>
        <span>${esc(data.browser || '—')}</span>
        <span>${esc(data.os || '—')}</span>
        <span class="flex items-center gap-1.5">${icon('place', 16)} ${esc(data.ip_address || '—')}</span>
      </div>`;
    const items = data.events.map(ev => `
      <div class="flex gap-3 py-2.5 border-b border-gray-100 last:border-0">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${EVENT_COLOR[ev.event_type] || 'bg-gray-100 text-gray-600'}">${icon(TIMELINE_ICON[ev.event_type] || 'bolt', 16)}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <strong class="text-sm text-gray-900">${esc(ev.event_label)}</strong>
            <span class="text-xs text-gray-400">${fmtDateTime(ev.created_at)}</span>
          </div>
          ${(ev.case_name || ev.label) ? `<p class="text-sm text-gray-500 mt-0.5 break-words">${esc(ev.case_name || ev.label)}</p>` : ''}
          ${ev.page ? `<p class="text-xs text-gray-400 mt-0.5">${esc(ev.page)}</p>` : ''}
        </div>
      </div>`).join('');
    body.innerHTML = header + `<div>${items}</div>`;
  } catch (err) {
    const body = document.getElementById('vis-timeline-body');
    if (body) body.innerHTML = `<p class="text-sm text-red-500">${esc(err.message || 'Error al cargar el recorrido')}</p>`;
  }
}

// ─── Eventos crudos (tabla plana, como antes) ──────────────────────────────

function eventsShellHtml() {
  return `
  <div class="flex flex-wrap items-center gap-3 mb-4">
    <select id="vis-f-type" class="input w-auto">
      <option value="">Todos los eventos</option>
      ${EVENT_TYPES.map(([k, l]) => `<option value="${k}" ${_filters.event_type === k ? 'selected' : ''}>${l}</option>`).join('')}
    </select>
    <input type="date" id="vis-f-date-from" class="input w-auto" value="${_filters.date_from}">
    <input type="date" id="vis-f-date-to" class="input w-auto" value="${_filters.date_to}">
    <input id="vis-f-q" class="input w-auto" placeholder="Buscar caso, página, origen..." value="${esc(_filters.q)}">
  </div>
  <div id="visitas-table-wrap"></div>
  <div class="flex items-center justify-between mt-4 text-sm text-gray-500">
    <span id="visitas-count"></span>
    <button id="visitas-load-more" class="btn-secondary text-xs px-3 py-1.5" style="display:none">Cargar más</button>
  </div>`;
}

function rowHtml(r) {
  const badge = EVENT_COLOR[r.event_type] || 'bg-gray-100 text-gray-600';
  const detail = r.case_name || r.label || '—';
  const detailShort = detail.length > 60 ? detail.slice(0, 60) + '…' : detail;
  return `
  <div class="grid grid-cols-[150px_170px_1fr_120px_130px_110px] gap-3 px-4 py-2.5 text-sm items-center">
    <span class="text-gray-500 text-xs">${fmtDateTime(r.created_at)}</span>
    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge} w-fit">${esc(r.event_label)}</span>
    <span class="text-gray-700 text-xs truncate" title="${esc(detail)}">${esc(detailShort)}</span>
    <span class="text-gray-500 text-xs truncate">${esc(r.page || '—')}</span>
    <span class="text-gray-500 text-xs truncate" title="${esc(r.referrer || '')}">${esc(referrerHost(r.referrer))}</span>
    <span class="text-gray-400 text-xs">${esc(r.ip_address || '—')}</span>
  </div>`;
}

function renderEventsTable() {
  const wrap = document.getElementById('visitas-table-wrap');
  if (!wrap) return;
  if (_rows.length === 0) {
    wrap.innerHTML = `<div class="card p-8 text-center text-gray-400 text-sm">Sin eventos en este rango</div>`;
    return;
  }
  wrap.innerHTML = `
  <div class="card divide-y divide-gray-100">
    <div class="grid grid-cols-[150px_170px_1fr_120px_130px_110px] gap-3 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
      <span>Fecha</span><span>Evento</span><span>Detalle</span><span>Página</span><span>Origen</span><span>IP</span>
    </div>
    ${_rows.map(rowHtml).join('')}
  </div>`;
}

function renderEventsFooter() {
  const count = document.getElementById('visitas-count');
  const more = document.getElementById('visitas-load-more');
  if (count) count.textContent = `${_rows.length} de ${_total}`;
  if (more) more.style.display = _rows.length < _total ? 'inline-flex' : 'none';
}

function wireFilters() {
  document.getElementById('vis-f-type')?.addEventListener('change', e => { _filters.event_type = e.target.value; _offset = 0; reloadEvents(); });
  document.getElementById('vis-f-date-from')?.addEventListener('change', e => { _filters.date_from = e.target.value; _offset = 0; reloadEvents(); });
  document.getElementById('vis-f-date-to')?.addEventListener('change', e => { _filters.date_to = e.target.value; _offset = 0; reloadEvents(); });
  let qDebounce;
  document.getElementById('vis-f-q')?.addEventListener('input', e => {
    clearTimeout(qDebounce);
    qDebounce = setTimeout(() => { _filters.q = e.target.value; _offset = 0; reloadEvents(); }, 350);
  });
  document.getElementById('visitas-load-more')?.addEventListener('click', () => { _offset += PAGE_SIZE; reloadEvents(true); });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
