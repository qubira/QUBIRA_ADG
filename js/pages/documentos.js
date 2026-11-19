/* Registro de documentos (CODIFICACION.md, fase 2)
   - Registro: búsqueda por código nuevo o anterior, título o detalle.
   - Pendientes: lo que me toca revisar o aprobar, y lo observado que debo corregir.
   - Configuración: datos de la empresa y catálogo de tipos (firmante, activo).
   El código lo asigna siempre el servidor al Emitir. */
import { api } from '../api.js';
import { getUser } from '../state.js';
import { pageHeader, spinner, showModal, closeModal, toast, icon, fmtDate, fmtDateTime } from '../utils.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ESTADO_COLOR = {
  BORRADOR: 'bg-gray-100 text-gray-600', 'EN RUTA': 'bg-blue-100 text-blue-700', OBSERVADO: 'bg-amber-100 text-amber-700',
  APROBADO: 'bg-green-100 text-green-700', EMITIDA: 'bg-green-100 text-green-700', VIGENTE: 'bg-green-100 text-green-700',
  ACEPTADA: 'bg-emerald-100 text-emerald-800', ACTIVO: 'bg-green-100 text-green-700', ABIERTO: 'bg-blue-100 text-blue-700',
  ARCHIVADO: 'bg-slate-200 text-slate-700', CERRADO: 'bg-slate-200 text-slate-700', INACTIVO: 'bg-slate-200 text-slate-700',
  ANULADO: 'bg-red-100 text-red-700', RECHAZADO: 'bg-red-100 text-red-700',
};
const ACCION_TXT = { CREA: 'Creó', REVISA: 'Revisó', OBSERVA: 'Observó', APRUEBA: 'Aprobó', RECHAZA: 'Rechazó', ARCHIVA: 'Archivó', ANULA: 'Anuló' };
const PENDIENTE_TXT = { REVISA: 'Revisión', APRUEBA: 'Aprobación' };
// Tipos que se emiten desde este registro; los demás los emite su módulo (constancias en ORH, proformas y clientes en ODN…)
const TIPOS_REGISTRO = ['INF', 'MEM', 'PLN', 'SOL', 'ACT', 'CTR', 'CLG', 'FMT'];

let cat = null;               // { tipos, areas, empresa }
let tab = 'registro';
let filtros = { buscar: '', area: '', tipo: '', estado: '', anio: '' };
let filas = [];

const badge = e => `<span class="badge ${ESTADO_COLOR[e] || 'bg-gray-100 text-gray-600'}">${esc(e)}</span>`;
const codigoTxt = d => d.codigo ? `${esc(d.codigo)}${['PRF', 'FMT'].includes(String(d.tipo).trim()) ? ` <span class="text-gray-400">v${d.version}</span>` : ''}` : '<span class="text-gray-400 italic">BORRADOR</span>';
const tipoNombre = s => (cat.tipos.find(t => t.sigla === String(s).trim()) || {}).nombre || s;
const areaNombre = s => (cat.areas.find(a => a.sigla === s) || {}).nombre || s;

export async function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-8">${pageHeader('Registro de documentos', 'Códigos ÁREA-TIPO-AÑO-NÚMERO de todas las áreas · el número lo asigna el servidor al emitir',
    `<button id="doc-externo" class="btn-secondary">${icon('upload_file', 18)} Registrar documento externo</button>
     <button id="doc-nuevo" class="btn-primary">${icon('add', 18)} Nuevo documento</button>`)}
    <div class="flex gap-1 border-b border-gray-200 mb-5" id="doc-tabs">
      ${[['registro', 'Registro'], ['pendientes', 'Pendientes de mi aprobación'], ['config', 'Configuración']].map(([k, l]) =>
        `<button data-tab="${k}" class="px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}">${l}<span id="doc-tab-n-${k}"></span></button>`).join('')}
    </div>
    <div id="doc-body">${spinner()}</div></div>`;
  main.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
  document.getElementById('doc-nuevo').addEventListener('click', () => abrirNuevo());
  document.getElementById('doc-externo').addEventListener('click', abrirExterno);
  try {
    if (!cat) cat = await api.get('/documentos/catalogo');
    contarPendientes();
    if (tab === 'registro') await pintarRegistro();
    else if (tab === 'pendientes') await pintarPendientes();
    else pintarConfig();
  } catch (e) {
    document.getElementById('doc-body').innerHTML = `<div class="card p-8 text-center text-red-600">${esc(e.message)}</div>`;
  }
}

async function contarPendientes() {
  try {
    const r = await api.get('/documentos/pendientes');
    const n = r.data.length + r.observados.length;
    const el = document.getElementById('doc-tab-n-pendientes');
    if (el && n) el.innerHTML = ` <span class="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-xs">${n}</span>`;
  } catch { /* sin bandeja */ }
}

/* ─── Registro ─────────────────────────────────────────────────────── */
async function pintarRegistro() {
  const body = document.getElementById('doc-body');
  const anios = [...new Set([new Date().getFullYear(), new Date().getFullYear() - 1])];
  const estados = Object.keys(ESTADO_COLOR);
  body.innerHTML = `
    <div class="card p-4 mb-4 grid grid-cols-1 md:grid-cols-6 gap-3">
      <input id="f-buscar" class="input md:col-span-2" placeholder="Código, código anterior, título…" value="${esc(filtros.buscar)}">
      <select id="f-area" class="input"><option value="">Todas las áreas</option>${cat.areas.map(a => `<option value="${a.sigla}" ${filtros.area === a.sigla ? 'selected' : ''}>${a.sigla} · ${esc(a.nombre)}</option>`).join('')}</select>
      <select id="f-tipo" class="input"><option value="">Todos los tipos</option>${cat.tipos.map(t => `<option value="${t.sigla}" ${filtros.tipo === t.sigla ? 'selected' : ''}>${t.sigla} · ${esc(t.nombre)}</option>`).join('')}</select>
      <select id="f-estado" class="input"><option value="">Todos los estados</option>${estados.map(e => `<option ${filtros.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select>
      <select id="f-anio" class="input"><option value="">Todos los años</option>${anios.map(a => `<option ${String(filtros.anio) === String(a) ? 'selected' : ''}>${a}</option>`).join('')}</select>
    </div>
    <div id="doc-tabla">${spinner()}</div>`;
  let t;
  const leer = () => { filtros = { buscar: val('f-buscar'), area: val('f-area'), tipo: val('f-tipo'), estado: val('f-estado'), anio: val('f-anio') }; cargarTabla(); };
  body.querySelector('#f-buscar').addEventListener('input', () => { clearTimeout(t); t = setTimeout(leer, 300); });
  ['f-area', 'f-tipo', 'f-estado', 'f-anio'].forEach(id => body.querySelector('#' + id).addEventListener('change', leer));
  await cargarTabla();
}
const val = id => document.getElementById(id).value.trim();

async function cargarTabla() {
  const cont = document.getElementById('doc-tabla');
  if (!cont) return;
  const r = await api.get('/documentos', filtros);
  filas = r.data;
  cont.innerHTML = tabla(filas, 'Todavía no hay documentos con estos filtros.');
  enlazarFilas(cont);
}

function tabla(lista, vacio) {
  if (!lista.length) return `<div class="card p-10 text-center text-gray-400">${vacio}</div>`;
  return `<div class="card overflow-x-auto"><table class="w-full text-sm">
    <thead><tr class="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
      <th class="px-4 py-3">Código</th><th class="px-4 py-3">Título</th><th class="px-4 py-3">Tipo</th><th class="px-4 py-3">Área</th>
      <th class="px-4 py-3">Estado</th><th class="px-4 py-3">Emitido</th><th class="px-4 py-3">Creó</th></tr></thead>
    <tbody>${lista.map(d => `<tr class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" data-doc="${esc(d.codigo || d.id)}">
      <td class="px-4 py-3 font-mono text-xs whitespace-nowrap">${codigoTxt(d)}${d.codigo_anterior ? `<div class="text-gray-400 font-sans">antes ${esc(d.codigo_anterior)}</div>` : ''}</td>
      <td class="px-4 py-3">${esc(d.titulo)}${d.detalle ? `<div class="text-xs text-gray-400">${esc(d.detalle)}</div>` : ''}</td>
      <td class="px-4 py-3 whitespace-nowrap">${esc(tipoNombre(d.tipo))}</td>
      <td class="px-4 py-3">${esc(d.area)}</td>
      <td class="px-4 py-3">${badge(d.estado)}${d.pendiente ? `<div class="text-xs text-gray-400 mt-1">${PENDIENTE_TXT[d.pendiente.accion] || ''} de ${esc(d.pendiente.area)}</div>` : ''}</td>
      <td class="px-4 py-3 whitespace-nowrap">${d.emitido_en ? fmtDate(d.emitido_en) : '—'}</td>
      <td class="px-4 py-3 text-gray-500">${esc(d.creado_por)}</td></tr>`).join('')}</tbody></table></div>`;
}
function enlazarFilas(cont) {
  cont.querySelectorAll('[data-doc]').forEach(tr => tr.addEventListener('click', () => abrirDetalle(tr.dataset.doc)));
}

/* ─── Pendientes ───────────────────────────────────────────────────── */
async function pintarPendientes() {
  const body = document.getElementById('doc-body');
  const r = await api.get('/documentos/pendientes');
  body.innerHTML = `
    <h3 class="font-semibold text-gray-700 mb-2">Me toca revisar o aprobar (${r.data.length})</h3>
    <div id="pend-1" class="mb-6">${tabla(r.data, 'No tienes documentos pendientes.')}</div>
    <h3 class="font-semibold text-gray-700 mb-2">Observados que debo corregir (${r.observados.length})</h3>
    <div id="pend-2">${tabla(r.observados, 'No tienes documentos observados.')}</div>`;
  enlazarFilas(body);
}

/* ─── Detalle y acciones ───────────────────────────────────────────── */
async function abrirDetalle(codigo) {
  showModal('Documento', spinner(), 'xl');
  let d;
  try { d = (await api.get('/documentos/por-codigo/' + encodeURIComponent(codigo))).data; }
  catch (e) { document.getElementById('modal-body').innerHTML = `<p class="text-red-600">${esc(e.message)}</p>`; return; }
  const yo = (getUser() || {}).username || '';
  const tipo = cat.tipos.find(t => t.sigla === String(d.tipo).trim()) || {};
  const mio = String(d.creado_por).toLowerCase() === yo.toLowerCase();
  const acciones = [];
  const btn = (accion, texto, cls = 'btn-secondary') => acciones.push(`<button class="${cls}" data-act="${accion}">${texto}</button>`);
  if (d.estado === 'BORRADOR' && mio) { btn('emitir', 'Emitir (asignar código)', 'btn-primary'); btn('eliminar', 'Eliminar borrador', 'btn-danger'); }
  if (d.estado === 'EN RUTA' && d.pendiente && !mio) { // nadie revisa ni aprueba lo que creó
    if (d.pendiente.accion === 'REVISA') btn('REVISA', 'Revisado ✓', 'btn-primary');
    if (d.pendiente.accion === 'APRUEBA') btn('APRUEBA', 'Aprobar ✓', 'btn-primary');
    btn('OBSERVA', 'Observar');
    if (d.pendiente.accion === 'APRUEBA') btn('RECHAZA', 'Rechazar', 'btn-danger');
  }
  if (d.estado === 'OBSERVADO' && mio) btn('reenviar', 'Corregido: reenviar', 'btn-primary');
  if (d.estado === 'APROBADO') btn('ARCHIVA', 'Archivar');
  if (tipo.clase === 'VERSIONADO' && ['EMITIDA', 'VIGENTE'].includes(d.estado)) btn('version', 'Nueva versión');
  if (tipo.sigla === 'PRF' && d.estado === 'EMITIDA') btn('aceptar', 'Aceptada por el cliente', 'btn-primary');
  if (tipo.clase === 'REGISTRO') {
    if (d.estado === 'ACTIVO') btn('INACTIVO', 'Desactivar'); if (d.estado === 'INACTIVO') btn('ACTIVO', 'Activar');
    if (d.estado === 'ABIERTO') btn('CERRADO', 'Cerrar caso'); if (d.estado === 'CERRADO') btn('ABIERTO', 'Reabrir');
  }
  if (tipo.clase === 'DOCUMENTO' && d.codigo && !['ANULADO', 'RECHAZADO'].includes(d.estado)) btn('reemplazar', 'Reemplazar por uno nuevo');
  if (tipo.clase !== 'REGISTRO' && d.codigo && !['ANULADO', 'RECHAZADO'].includes(d.estado)) btn('anular', 'Anular', 'btn-danger');
  if (d.codigo) btn('imprimir', `${icon('print', 16)} Hoja de ruta`);

  const ruta = (d.ruta || []).slice().sort((a, b) => a.ronda - b.ronda || (a.fecha ? 0 : 1) - (b.fecha ? 0 : 1) || new Date(a.fecha || 0) - new Date(b.fecha || 0) || a.orden - b.orden);
  document.querySelector('#modal-container h3').textContent = d.codigo || 'Borrador';
  document.getElementById('modal-body').innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <div class="md:col-span-2">
        <p class="text-lg font-semibold text-gray-900">${esc(d.titulo)}</p>
        <p class="text-sm text-gray-500">${esc(tipoNombre(d.tipo))}${d.detalle ? ' · ' + esc(d.detalle) : ''} · ${esc(areaNombre(d.area))} (${esc(d.area)})</p>
        ${d.version > 1 || tipo.clase === 'VERSIONADO' ? `<p class="text-sm text-gray-500">Versión ${d.version}${d.version_aceptada ? ` · aceptada v${d.version_aceptada}` : ''}</p>` : ''}
      </div>
      <div class="text-right">${badge(d.estado)}<p class="text-xs text-gray-400 mt-2">Creó ${esc(d.creado_por)} · ${fmtDateTime(d.creado_en)}</p></div>
    </div>
    <div class="flex flex-wrap gap-2 mb-4 text-xs">
      ${d.codigo_anterior ? `<span class="badge bg-gray-100 text-gray-600">Código anterior: ${esc(d.codigo_anterior)}</span>` : ''}
      ${d.reemplaza_a ? `<span class="badge bg-gray-100 text-gray-600">Reemplaza a ${esc(d.reemplaza_a)}</span>` : ''}
      ${d.reemplazado_por ? `<span class="badge bg-red-50 text-red-700">Anulado – reemplazado por ${esc(d.reemplazado_por)}</span>` : ''}
      ${d.motivo_anulacion && !d.reemplazado_por ? `<span class="badge bg-red-50 text-red-700">Motivo: ${esc(d.motivo_anulacion)}</span>` : ''}
      ${d.referencia ? `<span class="badge bg-gray-100 text-gray-600">Referencia: ${esc(d.referencia)}${d.referencia_version ? ' v' + d.referencia_version : ''}</span>` : ''}
      ${d.formato_codigo ? `<span class="badge bg-gray-100 text-gray-600">Formato ${esc(d.formato_codigo)}${d.formato_version ? ' v' + d.formato_version : ''}</span>` : ''}
      ${d.area_destino ? `<span class="badge bg-gray-100 text-gray-600">Destino: ${esc(d.area_destino)}</span>` : ''}
      ${/^https:\/\//i.test(d.enlace_externo || '') ? `<a class="badge bg-blue-50 text-blue-700" href="${esc(d.enlace_externo)}" target="_blank" rel="noopener">Abrir en Drive ↗</a>` : ''}
    </div>
    <h4 class="text-sm font-semibold text-gray-700 mb-2">Ruta</h4>
    <ol class="border-l-2 border-gray-200 ml-2 mb-4">${ruta.map(p => `
      <li class="ml-4 mb-3 relative">
        <span class="absolute -left-[23px] top-1 w-3 h-3 rounded-full ${p.fecha ? (['RECHAZA', 'ANULA'].includes(p.accion) ? 'bg-red-500' : p.accion === 'OBSERVA' ? 'bg-amber-500' : 'bg-green-500') : 'bg-gray-300'}"></span>
        <p class="text-sm"><b>${esc(p.area)}</b> · ${p.fecha ? `${ACCION_TXT[p.accion] || p.accion} ${esc(p.usuario_nombre || p.usuario || '')}${p.usuario_cargo ? ` <span class="text-gray-400">(${esc(p.usuario_cargo)})</span>` : ''}` : `<span class="text-gray-400">Pendiente: ${PENDIENTE_TXT[p.accion] || p.accion}${p.nivel_min ? ` (N${p.nivel_min} o superior)` : ''}</span>`}</p>
        ${p.fecha ? `<p class="text-xs text-gray-400">${fmtDateTime(p.fecha)}${p.motivo ? ` · ${esc(p.motivo)}` : ''}</p>` : ''}
        ${p.comentario ? `<p class="text-xs text-gray-600 mt-0.5">“${esc(p.comentario)}”</p>` : ''}
      </li>`).join('') || '<li class="ml-4 text-sm text-gray-400">Sin pasos todavía (borrador).</li>'}</ol>
    ${acciones.length ? `<div class="border-t border-gray-100 pt-3">
      <textarea id="act-comentario" class="input w-full mb-3" rows="2" placeholder="Comentario (obligatorio para observar, rechazar o anular)"></textarea>
      <div class="flex flex-wrap gap-2">${acciones.join('')}</div></div>` : ''}`;
  document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => accion(d, b.dataset.act)));
}

async function accion(d, act) {
  const comentario = (document.getElementById('act-comentario') || {}).value || '';
  const cod = encodeURIComponent(d.codigo || '');
  try {
    let r;
    if (act === 'emitir') r = await api.post(`/documentos/${d.id}/emitir`);
    else if (act === 'eliminar') { await api.delete(`/documentos/${d.id}`); toast('Borrador eliminado'); closeModal(); return render(); }
    else if (['REVISA', 'APRUEBA', 'OBSERVA', 'RECHAZA', 'ARCHIVA'].includes(act)) r = await api.post(`/documentos/${cod}/ruta`, { accion: act, comentario });
    else if (act === 'reenviar') r = await api.post(`/documentos/${cod}/reenviar`, { comentario });
    else if (act === 'version') r = await api.post(`/documentos/${cod}/version`, { comentario });
    else if (act === 'aceptar') r = await api.post(`/documentos/${cod}/aceptar`);
    else if (['ACTIVO', 'INACTIVO', 'ABIERTO', 'CERRADO'].includes(act)) r = await api.post(`/documentos/${cod}/estado`, { estado: act, comentario });
    else if (act === 'anular') {
      if (!comentario.trim()) { toast('Escribe el motivo de la anulación en el comentario', 'error'); return; }
      r = await api.post(`/documentos/${cod}/anular`, { motivo: comentario });
    } else if (act === 'reemplazar') { closeModal(); return abrirNuevo({ tipo: String(d.tipo).trim(), area: d.area, titulo: d.titulo, detalle: d.detalle, reemplaza_a: d.codigo }); }
    else if (act === 'imprimir') return imprimir(d.codigo);
    toast(r && r.data && r.data.codigo && act === 'emitir' ? `Emitido: ${r.data.codigo}` : 'Listo');
    abrirDetalle(r && r.data && r.data.codigo ? r.data.codigo : (d.codigo || d.id));
    contarPendientes();
    if (tab === 'registro') cargarTabla(); else if (tab === 'pendientes') pintarPendientes();
  } catch (e) { toast(e.message, 'error'); }
}

/* ─── Nuevo documento ──────────────────────────────────────────────── */
function abrirNuevo(pre = {}) {
  const tipos = cat.tipos.filter(t => t.activo && TIPOS_REGISTRO.includes(t.sigla));
  const opt = (lista, sel) => lista.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const areas = cat.areas.map(a => [a.sigla, `${a.sigla} · ${a.nombre}`]);
  showModal(pre.reemplaza_a ? `Reemplazar ${esc(pre.reemplaza_a)}` : 'Nuevo documento', `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div><label class="label">Tipo</label><select id="n-tipo" class="input w-full" ${pre.reemplaza_a ? 'disabled' : ''}>${opt(tipos.map(t => [t.sigla, `${t.sigla} · ${t.nombre}`]), pre.tipo || 'INF')}</select></div>
      <div><label class="label">Área dueña</label><select id="n-area" class="input w-full" ${pre.reemplaza_a ? 'disabled' : ''}>${opt(areas, pre.area || 'ADG')}</select></div>
      <div class="md:col-span-2"><label class="label">Título</label><input id="n-titulo" class="input w-full" value="${esc(pre.titulo || '')}"></div>
      <div class="md:col-span-2"><label class="label">Detalle <span class="text-gray-400 font-normal">(Calidad, Seguridad, Laboral, Proyecto, Externo, Adenda…)</span></label><input id="n-detalle" class="input w-full" value="${esc(pre.detalle || '')}"></div>
      <div id="n-destino-box" class="hidden"><label class="label">Área destino</label><select id="n-destino" class="input w-full"><option value="">—</option>${opt(areas, '')}</select></div>
      <div id="n-elevar-box" class="hidden flex items-end"><label class="text-sm flex items-center gap-2"><input type="checkbox" id="n-elevar"> Elevar a la Alta Dirección (ADG aprueba al final)</label></div>
      <div id="n-rev-box" class="hidden md:col-span-2">
        <label class="label">Áreas que revisan <span class="text-gray-400 font-normal">(opcional · en el orden en que las marques)</span></label>
        <div class="flex flex-wrap gap-2" id="n-revisores">${cat.areas.map(a => `<label class="text-xs flex items-center gap-1 px-2 py-1 border border-gray-200 rounded-lg cursor-pointer"><input type="checkbox" value="${esc(a.sigla)}"> ${esc(a.sigla)}</label>`).join('')}</div>
        <p class="text-xs text-gray-500 mt-1" id="n-ruta-previa"></p>
      </div>
      <div><label class="label">Código anterior <span class="text-gray-400 font-normal">(opcional, si ya tenía uno)</span></label><input id="n-anterior" class="input w-full" placeholder="IT000027 - IE"></div>
      <div><label class="label">Referencia <span class="text-gray-400 font-normal">(opcional: contrato original, proforma…)</span></label><input id="n-ref" class="input w-full" placeholder="ODN-PRF-2026-001"></div>
      <div><label class="label">Enlace al documento <span class="text-gray-400 font-normal">(Drive, opcional)</span></label><input id="n-enlace" class="input w-full" placeholder="https://drive.google.com/…"></div>
    </div>
    <p class="text-xs text-gray-500 mt-3">El código se asigna al <b>Emitir</b>. Un borrador no lleva código y solo quien lo creó puede eliminarlo.</p>`, 'lg', `
    <div class="flex justify-end gap-2"><button id="n-borrador" class="btn-secondary">Guardar borrador</button><button id="n-emitir" class="btn-primary">Emitir</button></div>`);
  // Áreas revisoras en el orden en que se marcan
  const orden = [];
  const rutaPrevia = () => {
    const area = val('n-area'), elevar = document.getElementById('n-elevar').checked;
    const revs = orden.filter(a => a !== area);
    document.getElementById('n-ruta-previa').textContent = revs.length
      ? `Ruta: ${area} crea → ${revs.map(a => a + ' revisa').join(' → ')} → ${elevar ? 'ADG' : area} aprueba`
      : 'Sin áreas revisoras: se usa la ruta por defecto del tipo.';
  };
  document.querySelectorAll('#n-revisores input').forEach(ch => ch.addEventListener('change', () => {
    const i = orden.indexOf(ch.value);
    if (ch.checked && i < 0) orden.push(ch.value); else if (!ch.checked && i >= 0) orden.splice(i, 1);
    rutaPrevia();
  }));
  const ver = () => {
    const t = val('n-tipo');
    document.getElementById('n-destino-box').classList.toggle('hidden', t !== 'SOL');
    document.getElementById('n-elevar-box').classList.toggle('hidden', !['INF', 'PLN'].includes(t));
    document.getElementById('n-rev-box').classList.toggle('hidden', !['INF', 'PLN'].includes(t));
    rutaPrevia();
  };
  document.getElementById('n-tipo').addEventListener('change', ver);
  document.getElementById('n-area').addEventListener('change', rutaPrevia);
  document.getElementById('n-elevar').addEventListener('change', rutaPrevia);
  ver();
  const enviar = async emitir => {
    const t = val('n-tipo');
    const body = { tipo: t, area: val('n-area'), titulo: val('n-titulo'), detalle: val('n-detalle'), area_destino: val('n-destino'),
      elevar_adg: ['INF', 'PLN'].includes(t) && document.getElementById('n-elevar').checked, referencia: val('n-ref'), enlace_externo: val('n-enlace'),
      codigo_anterior: val('n-anterior'), revisores: ['INF', 'PLN'].includes(t) ? orden.filter(a => a !== val('n-area')) : [], reemplaza_a: pre.reemplaza_a, emitir };
    try {
      const r = await api.post('/documentos', body);
      toast(r.data.codigo ? `Emitido: ${r.data.codigo}` : 'Borrador guardado');
      closeModal(); tab = 'registro'; await render(); abrirDetalle(r.data.codigo || r.data.id);
    } catch (e) { toast(e.message, 'error'); }
  };
  document.getElementById('n-borrador').addEventListener('click', () => enviar(false));
  document.getElementById('n-emitir').addEventListener('click', () => enviar(true));
}

/* ─── Documento externo ────────────────────────────────────────────── */
function abrirExterno() {
  const opt = lista => lista.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  showModal('Registrar documento externo', `
    <p class="text-sm text-gray-500 mb-3">Para documentos Word o PDF hechos fuera del sistema. Reciben un número nuevo; el año es el de la fecha del documento original. Se guarda solo la ficha y el enlace a Drive.</p>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div><label class="label">Área</label><select id="x-area" class="input w-full">${opt(cat.areas.map(a => [a.sigla, `${a.sigla} · ${a.nombre}`]))}</select></div>
      <div><label class="label">Tipo</label><select id="x-tipo" class="input w-full">${opt(cat.tipos.filter(t => t.activo).map(t => [t.sigla, `${t.sigla} · ${t.nombre}`]))}</select></div>
      <div class="md:col-span-2"><label class="label">Título</label><input id="x-titulo" class="input w-full"></div>
      <div><label class="label">Detalle</label><input id="x-detalle" class="input w-full"></div>
      <div><label class="label">Fecha del documento original</label><input id="x-fecha" type="date" class="input w-full"></div>
      <div><label class="label">Código antiguo</label><input id="x-anterior" class="input w-full" placeholder="IT000026 - PT"></div>
      <div><label class="label">Enlace a Drive</label><input id="x-enlace" class="input w-full" placeholder="https://drive.google.com/…"></div>
    </div>`, 'lg', `<div class="flex justify-end"><button id="x-guardar" class="btn-primary">Registrar y asignar código</button></div>`);
  document.getElementById('x-guardar').addEventListener('click', async () => {
    try {
      const r = await api.post('/documentos/externo', { area: val('x-area'), tipo: val('x-tipo'), titulo: val('x-titulo'), detalle: val('x-detalle'),
        fecha_documento: val('x-fecha'), codigo_anterior: val('x-anterior'), enlace_externo: val('x-enlace') });
      toast(`Registrado: ${r.data.codigo}`); closeModal(); tab = 'registro'; await render(); abrirDetalle(r.data.codigo);
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* ─── Configuración: empresa y tipos ───────────────────────────────── */
function rutaTexto(t) {
  const def = t.ruta_defecto || [];
  const txt = pasos => (pasos.length ? pasos.map(p => `${p.area === 'DUENA' ? 'Área' : p.area === 'DESTINO' ? 'Destino' : p.area} ${p.accion === 'REVISA' ? 'revisa' : 'aprueba'}${p.nivel_min ? ' (N' + p.nivel_min + ')' : ''}`).join(' → ') : 'Se emite directo');
  if (Array.isArray(def)) return 'Crea → ' + txt(def);
  return Object.entries(def).map(([a, p]) => `<div><b>${a === '*' ? 'Otras' : a}:</b> crea → ${txt(p)}</div>`).join('');
}

function pintarConfig() {
  const e = cat.empresa || {};
  const body = document.getElementById('doc-body');
  body.innerHTML = `
    <div class="card p-5 mb-5">
      <h3 class="font-semibold text-gray-800 mb-1">Datos de la empresa</h3>
      <p class="text-sm text-gray-500 mb-4">Se imprimen en las constancias y en los membretes. Cuando QUBIRA S.A.C. tenga su RUC 20, se cambia solo aquí.</p>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div><label class="label">Razón social</label><input id="e-razon" class="input w-full" value="${esc(e.razon_social || '')}"></div>
        <div><label class="label">RUC</label><input id="e-ruc" class="input w-full" value="${esc(e.ruc || '')}" maxlength="11"></div>
        <div><label class="label">Dirección</label><input id="e-dir" class="input w-full" value="${esc(e.direccion || '')}"></div>
        <div><label class="label">Página de verificación</label><input id="e-verif" class="input w-full" value="${esc(e.sitio_verificacion || '')}"></div>
      </div>
      <div class="mt-3 text-right"><button id="e-guardar" class="btn-primary">Guardar datos de la empresa</button></div>
    </div>
    <div class="card overflow-x-auto">
      <div class="p-5 pb-2"><h3 class="font-semibold text-gray-800">Catálogo de tipos</h3>
        <p class="text-sm text-gray-500">La clase y si lleva año se bloquean cuando el tipo ya tiene códigos. El firmante se usa en los modelos que lo imprimen (constancias).</p></div>
      <table class="w-full text-sm"><thead><tr class="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
        <th class="px-4 py-2">Tipo</th><th class="px-4 py-2">Clase</th><th class="px-4 py-2">Año</th><th class="px-4 py-2">Ruta por defecto</th><th class="px-4 py-2">Firmante</th><th class="px-4 py-2">Activo</th><th></th></tr></thead>
        <tbody>${cat.tipos.map(t => `<tr class="border-b border-gray-50 align-top" data-tipo="${t.sigla}">
          <td class="px-4 py-2 whitespace-nowrap"><b>${t.sigla}</b> · ${esc(t.nombre)}</td>
          <td class="px-4 py-2 text-xs">${t.clase}</td><td class="px-4 py-2 text-xs">${t.lleva_anio ? 'Sí' : 'No'}</td>
          <td class="px-4 py-2 text-xs text-gray-600">${rutaTexto(t)}${t.emite_nivel_min ? `<div class="text-gray-400">Emite: N${t.emite_nivel_min} o superior</div>` : ''}</td>
          <td class="px-4 py-2"><input class="input text-xs w-40 mb-1" data-f="fnombre" placeholder="Nombre" value="${esc((t.firmante || {}).nombre || '')}"><input class="input text-xs w-40" data-f="fcargo" placeholder="Cargo" value="${esc((t.firmante || {}).cargo || '')}"></td>
          <td class="px-4 py-2"><input type="checkbox" data-f="activo" ${t.activo ? 'checked' : ''}></td>
          <td class="px-4 py-2"><button class="btn-secondary text-xs" data-guardar="${t.sigla}">Guardar</button></td></tr>`).join('')}</tbody></table>
    </div>`;
  document.getElementById('e-guardar').addEventListener('click', async () => {
    try {
      const r = await api.put('/documentos/empresa', { razon_social: val('e-razon'), ruc: val('e-ruc'), direccion: val('e-dir'), sitio_verificacion: val('e-verif') });
      cat.empresa = r.data; toast('Datos de la empresa guardados');
    } catch (err) { toast(err.message, 'error'); }
  });
  body.querySelectorAll('[data-guardar]').forEach(b => b.addEventListener('click', async () => {
    const tr = b.closest('tr'), f = n => tr.querySelector(`[data-f="${n}"]`);
    const nombre = f('fnombre').value.trim(), cargo = f('fcargo').value.trim();
    try {
      await api.put('/documentos/tipos/' + b.dataset.guardar, { firmante: nombre ? { nombre, cargo } : null, activo: f('activo').checked });
      cat = await api.get('/documentos/catalogo'); toast('Tipo actualizado');
    } catch (err) { toast(err.message, 'error'); }
  }));
}

/* ─── Plantilla común de impresión: membrete, ruta, firmas y leyendas ─ */
async function imprimir(codigo) {
  let m;
  try { m = (await api.get('/documentos/membrete/' + encodeURIComponent(codigo))).data; } catch (e) { toast(e.message, 'error'); return; }
  const w = window.open('', '_blank');
  if (!w) { toast('Permite las ventanas emergentes para imprimir', 'error'); return; }
  const firma = f => `<div class="firma"><div class="linea"></div><b>${esc(f.nombre)}</b><span>${esc(f.cargo || '')}</span>
    <small>${f.accion === 'CREA' ? 'Elaboró' : f.accion === 'REVISA' ? 'Revisó' : 'Aprobó'} · ${esc(f.area)} · ${new Date(f.fecha).toLocaleDateString('es-PE')}</small>${f.motivo ? `<small class="mot">${esc(f.motivo)}</small>` : ''}</div>`;
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(m.codigo)}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    body { font-family: Inter, Arial, sans-serif; color: #1f2937; margin: 0; }
    @media screen { body { max-width: 210mm; margin: 0 auto; padding: 16mm; background: #fff; box-shadow: 0 0 0 100vmax #f3f4f6; } }
    .memb { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #12286e; padding-bottom: 10px; }
    .memb img { height: 38px; } .memb .emp { text-align: right; font-size: 11px; color: #6b7280; } .memb .emp b { display: block; font-size: 15px; color: #12286e; letter-spacing: 1px; }
    .enc { margin: 14px 0 4px; font-size: 13px; font-weight: 700; color: #12286e; } .ruta { font-size: 11px; color: #6b7280; margin-bottom: 18px; }
    h1 { font-size: 20px; margin: 24px 0 6px; } .sub { color: #6b7280; font-size: 13px; margin: 0 0 18px; }
    .ley { display: inline-block; font-size: 11px; padding: 3px 8px; border-radius: 4px; background: #f3f4f6; margin: 0 6px 6px 0; } .ley.anul { background: #fee2e2; color: #991b1b; font-weight: 700; }
    .cuerpo { min-height: 120mm; border: 1px dashed #e5e7eb; border-radius: 6px; padding: 12px; color: #9ca3af; font-size: 12px; margin: 14px 0 24px; }
    .firmas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; } .firma { text-align: center; font-size: 11px; } .firma .linea { border-top: 1px solid #12286e; margin: 38px 10px 6px; }
    .firma b, .firma span, .firma small { display: block; } .firma span { color: #6b7280; } .firma small { color: #9ca3af; margin-top: 2px; } .firma .mot { color: #b45309; }
    .pie { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 9px; color: #12286e; font-weight: 700; }
  </style></head><body>
    <div class="memb"><img src="https://raw.githubusercontent.com/qubira/IMAGENES/main/logo2.png" alt=""><div class="emp"><b>${esc(m.empresa.razonSocial || 'QUBIRA')}</b>RUC ${esc(m.empresa.ruc || '')}</div></div>
    <div class="enc">${esc(m.encabezado)}</div>
    ${m.lineaRuta ? `<div class="ruta">${esc(m.lineaRuta)}</div>` : ''}
    <h1>${esc(m.titulo)}</h1><p class="sub">${esc(m.tipo.nombre)}${m.detalle ? ' · ' + esc(m.detalle) : ''}</p>
    ${m.leyendas.map(l => `<span class="ley ${/^Anulado/.test(l) ? 'anul' : ''}">${esc(l)}</span>`).join('')}
    <div class="cuerpo">Contenido del documento (adjunto o en el enlace registrado).</div>
    <div class="firmas">${m.firmas.map(firma).join('')}</div>
    <div class="pie">${esc(m.empresa.razonSocial || '')} · RUC ${esc(m.empresa.ruc || '')} · ${esc(m.empresa.direccion || '')}</div>
    <script>window.onload = () => setTimeout(() => window.print(), 300);<\/script>
  </body></html>`);
  w.document.close();
}
