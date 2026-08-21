import { api }      from '../api.js';
import { toast, confirmModal, pageHeader, spinner, icon } from '../utils.js';

let _docTypes = [];

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-3xl mx-auto" id="config-page">${spinner()}</div>`;
  load();
}

function load() {
  api.get('/document-types').then(data => {
    _docTypes = data;
    renderPage();
  }).catch(() => {
    const c = document.getElementById('config-page');
    if (c) c.innerHTML = '<p class="text-center text-gray-400 py-16">Error al cargar la configuración</p>';
  });
}

function renderPage() {
  const c = document.getElementById('config-page');
  if (!c) return;

  c.innerHTML = `
    ${pageHeader('Configuración', 'Tipos de documento personalizados')}

    <div class="card p-5 mb-5">
      <h3 class="font-semibold text-gray-900 mb-1">Agregar nuevo tipo de documento</h3>
      <p class="text-xs text-gray-500 mb-3">Se agrega a la lista del formulario "Nuevo Proyecto" (junto a DNI, CE, Pasaporte y RUC).</p>
      <div class="flex gap-2">
        <input id="new-doc-type" class="input flex-1" placeholder="Ej: Carné de Extranjería">
        <button id="add-doc-type-btn" class="btn-primary shrink-0">${icon('add',18)} Agregar</button>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-100">
        <h3 class="font-semibold text-gray-900">Tipos de documento agregados</h3>
      </div>
      ${_docTypes.length === 0
        ? '<p class="text-center text-gray-400 py-10 text-sm">Todavía no agregaste ningún tipo de documento personalizado</p>'
        : `<div class="divide-y divide-gray-50">${_docTypes.map(docTypeRow).join('')}</div>`}
    </div>`;

  document.getElementById('add-doc-type-btn').addEventListener('click', addDocType);
  document.getElementById('new-doc-type').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addDocType(); }
  });

  document.querySelectorAll('.dt-edit').forEach(btn => {
    btn.addEventListener('click', () => editDocType(btn.dataset.id, btn.dataset.label));
  });
  document.querySelectorAll('.dt-del').forEach(btn => {
    btn.addEventListener('click', () => deleteDocType(btn.dataset.id, btn.dataset.label));
  });
}

function docTypeRow(d) {
  return `
  <div class="flex items-center justify-between px-5 py-3">
    <p class="text-sm text-gray-800">${esc(d.label)}</p>
    <div class="flex gap-1">
      <button class="dt-edit p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" data-id="${d.id}" data-label="${esc(d.label)}">
        ${icon('edit', 16)}
      </button>
      <button class="dt-del p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600" data-id="${d.id}" data-label="${esc(d.label)}">
        ${icon('delete', 16)}
      </button>
    </div>
  </div>`;
}

async function addDocType() {
  const input = document.getElementById('new-doc-type');
  const label = input.value.trim();
  if (!label) return;
  try {
    await api.post('/document-types', { label });
    toast('Tipo de documento agregado');
    input.value = '';
    load();
  } catch (err) { toast(err.message || 'Error al agregar', 'error'); }
}

async function editDocType(id, current) {
  const label = prompt('Editar tipo de documento:', current);
  if (!label || !label.trim() || label.trim() === current) return;
  try {
    await api.put(`/document-types/${id}`, { label: label.trim() });
    toast('Tipo de documento actualizado');
    load();
  } catch (err) { toast(err.message || 'Error al actualizar', 'error'); }
}

async function deleteDocType(id, label) {
  if (!(await confirmModal(`¿Eliminar el tipo de documento "${label}"? Los proyectos que ya lo usan no se ven afectados.`))) return;
  try {
    await api.delete(`/document-types/${id}`);
    toast('Tipo de documento eliminado');
    load();
  } catch (err) { toast(err.message || 'Error al eliminar', 'error'); }
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
