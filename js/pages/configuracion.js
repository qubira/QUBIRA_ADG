import { api }      from '../api.js';
import { toast, confirmModal, showModal, closeModal, pageHeader, spinner, icon } from '../utils.js';

let _docTypes = [];
let _techCatalog = { language: [], tool: [] };
let _pendingCatalogImage = { language: null, tool: null };

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-5xl mx-auto" id="config-page">${spinner()}</div>`;
  load();
}

function load() {
  Promise.all([
    api.get('/document-types'),
    api.get('/technology-catalog', { category: 'language' }),
    api.get('/technology-catalog', { category: 'tool' }),
  ]).then(([docTypes, langs, tools]) => {
    _docTypes = docTypes;
    _techCatalog = { language: langs, tool: tools };
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
    ${pageHeader('Configuración', 'Tipos de documento y catálogo de tecnologías')}

    <div class="card p-5 mb-5">
      <h3 class="font-semibold text-gray-900 mb-1">Agregar nuevo tipo de documento</h3>
      <p class="text-xs text-gray-500 mb-3">Se agrega a la lista del formulario "Nuevo Proyecto" (junto a DNI, CE, Pasaporte y RUC).</p>
      <div class="flex gap-2">
        <input id="new-doc-type" class="input flex-1" placeholder="Ej: Carné de Extranjería">
        <button id="add-doc-type-btn" class="btn-primary shrink-0">${icon('add',18)} Agregar</button>
      </div>
    </div>

    <div class="card overflow-hidden mb-8">
      <div class="px-5 py-3 border-b border-gray-100">
        <h3 class="font-semibold text-gray-900">Tipos de documento agregados</h3>
      </div>
      ${_docTypes.length === 0
        ? '<p class="text-center text-gray-400 py-10 text-sm">Todavía no agregaste ningún tipo de documento personalizado</p>'
        : `<div class="divide-y divide-gray-50">${_docTypes.map(docTypeRow).join('')}</div>`}
    </div>

    <h2 class="text-lg font-bold text-gray-900 mb-1">Catálogo de Tecnologías</h2>
    <p class="text-xs text-gray-500 mb-3">Lista reutilizable de lenguajes y herramientas que aparece al agregar tecnologías a cualquier proyecto — editá el nombre o la imagen desde acá, en vez de proyecto por proyecto.</p>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      ${techCatalogColumn('Lenguajes', 'language')}
      ${techCatalogColumn('Herramientas', 'tool')}
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

  wireTechCatalog();
}

function techCatalogColumn(label, category) {
  const items = _techCatalog[category] || [];
  return `
  <div class="card p-5">
    <h3 class="font-semibold text-gray-900 mb-3">${label}</h3>
    <div class="divide-y divide-gray-50 mb-3 max-h-80 overflow-y-auto" id="cat-tech-list-${category}">
      ${items.length === 0
        ? '<p class="text-xs text-gray-400 py-3 text-center">Sin registrar</p>'
        : items.map(t => catalogTechRow(t, category)).join('')}
    </div>
    <div class="flex gap-2 items-center">
      <input type="file" accept="image/*" id="cat-tech-img-${category}" class="hidden" data-category="${category}">
      <button type="button" class="cat-tech-img-btn w-9 h-9 shrink-0 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 hover:bg-gray-100" data-category="${category}" title="Imagen (opcional)">
        <img id="cat-tech-img-preview-${category}" class="hidden w-full h-full object-cover" alt="">
        <span id="cat-tech-img-icon-${category}" class="material-icons text-gray-400" style="font-size:18px">image</span>
      </button>
      <input id="cat-tech-new-${category}" class="input text-sm flex-1" placeholder="${category === 'tool' ? 'Ej: Figma, Docker...' : 'Ej: JavaScript, Python...'}">
      <button type="button" class="btn-secondary text-xs px-3 cat-tech-add-btn" data-category="${category}">${icon('add',16)}</button>
    </div>
  </div>`;
}

function catalogTechRow(t, category) {
  const avatar = t.image_url
    ? `<img src="${t.image_url}" class="w-6 h-6 rounded object-cover shrink-0" alt="">`
    : `<span class="w-6 h-6 rounded bg-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0">${esc((t.name || '?').charAt(0).toUpperCase())}</span>`;
  return `
  <div class="flex items-center gap-3 py-2.5">
    ${avatar}
    <p class="text-sm text-gray-800 flex-1 truncate">${esc(t.name)}</p>
    <button class="cat-tech-edit p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" data-id="${t.id}" data-category="${category}" title="Editar">${icon('edit',16)}</button>
    <button class="cat-tech-del p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600" data-id="${t.id}" data-category="${category}" title="Eliminar">${icon('delete',16)}</button>
  </div>`;
}

function wireTechCatalog() {
  document.querySelectorAll('.cat-tech-img-btn').forEach(btn => {
    btn.addEventListener('click', () => document.getElementById(`cat-tech-img-${btn.dataset.category}`).click());
  });

  document.querySelectorAll('input[type="file"][id^="cat-tech-img-"]').forEach(inp => {
    inp.addEventListener('change', () => {
      const category = inp.dataset.category;
      const file = inp.files[0] || null;
      _pendingCatalogImage[category] = file;
      const preview = document.getElementById(`cat-tech-img-preview-${category}`);
      const iconEl = document.getElementById(`cat-tech-img-icon-${category}`);
      if (file) {
        preview.src = URL.createObjectURL(file);
        preview.classList.remove('hidden');
        iconEl.classList.add('hidden');
      } else {
        preview.classList.add('hidden');
        iconEl.classList.remove('hidden');
      }
    });
  });

  document.querySelectorAll('.cat-tech-add-btn').forEach(btn => {
    const category = btn.dataset.category;
    const input = document.getElementById(`cat-tech-new-${category}`);
    const submit = async () => {
      const name = input.value.trim();
      if (!name) return;
      try {
        const fd = new FormData();
        fd.append('category', category);
        fd.append('name', name);
        if (_pendingCatalogImage[category]) fd.append('image', _pendingCatalogImage[category]);
        await api.post('/technology-catalog', fd);
        _pendingCatalogImage[category] = null;
        toast('Tecnología agregada al catálogo');
        load();
      } catch (err) { toast(err.message || 'Error al agregar', 'error'); }
    };
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  });

  document.querySelectorAll('.cat-tech-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = (_techCatalog[btn.dataset.category] || []).find(x => x.id === btn.dataset.id);
      if (t) openCatalogTechEditModal(t);
    });
  });

  document.querySelectorAll('.cat-tech-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const t = (_techCatalog[btn.dataset.category] || []).find(x => x.id === btn.dataset.id);
      if (!t) return;
      if (!(await confirmModal(`¿Eliminar "${esc(t.name)}" del catálogo? Esto no afecta a los proyectos que ya la tienen agregada.`))) return;
      try {
        await api.delete(`/technology-catalog/${t.id}`);
        toast('Eliminado del catálogo');
        load();
      } catch (err) { toast(err.message || 'Error al eliminar', 'error'); }
    });
  });
}

function openCatalogTechEditModal(t) {
  let pendingFile = null;
  let clearedImage = false;

  const modal = showModal('Editar tecnología del catálogo', `
    <div class="flex flex-col items-center gap-3 mb-4">
      <div id="cat-tech-edit-dropzone" class="relative w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary-400 hover:bg-primary-50/40 transition-colors">
        <img id="cat-tech-edit-preview" src="${esc(t.image_url || '')}" class="absolute inset-0 w-full h-full object-cover bg-white ${t.image_url ? '' : 'hidden'}">
        <span id="cat-tech-edit-placeholder" class="text-gray-300 ${t.image_url ? 'hidden' : ''}">${icon('add_photo_alternate', 24)}</span>
        <input type="file" id="cat-tech-edit-file" accept="image/*" class="hidden">
      </div>
      <div class="flex items-center gap-2">
        <input type="text" id="cat-tech-edit-url" placeholder="o pega una URL de imagen" class="input text-xs py-1.5" value="${esc(t.image_url || '')}">
        <button type="button" id="cat-tech-edit-remove-img" class="btn-secondary text-xs px-2 py-1.5">Quitar</button>
      </div>
    </div>
    <label class="label">Nombre</label>
    <input type="text" id="cat-tech-edit-name" class="input" value="${esc(t.name)}">
  `, 'sm', `
    <div class="flex justify-end gap-3">
      <button type="button" id="cat-tech-edit-cancel" class="btn-secondary">Cancelar</button>
      <button type="button" id="cat-tech-edit-save" class="btn-primary">Guardar</button>
    </div>
  `);

  const dropzone = document.getElementById('cat-tech-edit-dropzone');
  const fileInput = document.getElementById('cat-tech-edit-file');
  const preview = document.getElementById('cat-tech-edit-preview');
  const placeholder = document.getElementById('cat-tech-edit-placeholder');
  const urlInput = document.getElementById('cat-tech-edit-url');

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    pendingFile = file;
    clearedImage = false;
    const reader = new FileReader();
    reader.onload = ev => {
      preview.src = ev.target.result;
      preview.classList.remove('hidden');
      placeholder.classList.add('hidden');
    };
    reader.readAsDataURL(file);
    urlInput.value = '';
  });
  urlInput.addEventListener('input', () => {
    pendingFile = null;
    const url = urlInput.value.trim();
    clearedImage = !url;
    if (url) { preview.src = url; preview.classList.remove('hidden'); placeholder.classList.add('hidden'); }
    else { preview.classList.add('hidden'); placeholder.classList.remove('hidden'); }
  });
  document.getElementById('cat-tech-edit-remove-img').addEventListener('click', () => {
    pendingFile = null;
    clearedImage = true;
    urlInput.value = '';
    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
  });

  document.getElementById('cat-tech-edit-cancel').addEventListener('click', closeModal);
  document.getElementById('cat-tech-edit-save').addEventListener('click', async () => {
    const name = document.getElementById('cat-tech-edit-name').value.trim();
    if (!name) { toast('El nombre es requerido', 'error'); return; }
    try {
      if (pendingFile) {
        const fd = new FormData();
        fd.append('name', name);
        fd.append('image', pendingFile);
        await api.put(`/technology-catalog/${t.id}`, fd);
      } else {
        const body = { name };
        if (clearedImage) body.image_url = '';
        else if (urlInput.value.trim() && urlInput.value.trim() !== (t.image_url || '')) body.image_url = urlInput.value.trim();
        await api.put(`/technology-catalog/${t.id}`, body);
      }
      closeModal();
      toast('Catálogo actualizado');
      load();
    } catch (err) { toast(err.message || 'Error', 'error'); }
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
