const storageKey = 'northline-studio-organizer-items';
const apiPath = '/api/items';
const sharedBoardEnabled = window.location.protocol === 'http:' || window.location.protocol === 'https:';
const defaultItems = [
  {
    type: 'text',
    title: 'Welcome to Northline Studio',
    body: 'Use the buttons above to collect notes, images, links, sketches, and other studio materials.'
  }
];

let items = loadItems();

const itemList = document.querySelector('#itemList');
const itemCount = document.querySelector('#itemCount');
const resetButton = document.querySelector('#resetButton');
const syncStatus = document.querySelector('#syncStatus');
const emptyState = document.querySelector('#emptyState');
const searchInput = document.querySelector('#searchInput');
const imageInput = document.querySelector('#imageInput');
const textDialog = document.querySelector('#textDialog');
const sketchDialog = document.querySelector('#sketchDialog');
const projectDialog = document.querySelector('#projectDialog');
const dialogTitle = document.querySelector('#dialogTitle');
const itemTitle = document.querySelector('#itemTitle');
const itemBody = document.querySelector('#itemBody');
const projectTitle = document.querySelector('#projectTitle');
const projectBody = document.querySelector('#projectBody');
const projectTasks = document.querySelector('#projectTasks');
const sketchCanvas = document.querySelector('#sketchCanvas');
const clearSketch = document.querySelector('#clearSketch');
const sketchColor = document.querySelector('#sketchColor');
const colorSwatches = document.querySelectorAll('.color-swatch');

let activeDialogType = 'text';
let isDrawing = false;
let activeSketchColor = '#1d2528';
let lastSharedPayload = '';
let isSavingSharedBoard = false;
let pendingSharedSave = false;

function loadItems() {
  const savedItems = localStorage.getItem(storageKey);
  if (!savedItems) return [...defaultItems];

  try {
    const parsedItems = JSON.parse(savedItems);
    return Array.isArray(parsedItems) ? parsedItems : [...defaultItems];
  } catch {
    return [...defaultItems];
  }
}

function saveItems() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    window.alert('The browser could not save this item. Try using a smaller image or sketch.');
  }

  saveSharedItems();
}

function updateSyncStatus(text) {
  syncStatus.textContent = text;
}

async function loadSharedItems() {
  if (!sharedBoardEnabled) return;

  try {
    const response = await fetch(apiPath, { cache: 'no-store' });
    if (!response.ok) throw new Error('Shared board unavailable');

    const sharedItems = await response.json();
    if (!Array.isArray(sharedItems)) throw new Error('Shared board data is invalid');

    items = sharedItems;
    lastSharedPayload = JSON.stringify(items);
    localStorage.setItem(storageKey, lastSharedPayload);
    updateSyncStatus('Shared board');
    renderItems();
  } catch {
    updateSyncStatus('Local board');
  }
}

async function saveSharedItems() {
  if (!sharedBoardEnabled) return;
  if (isSavingSharedBoard) {
    pendingSharedSave = true;
    return;
  }

  const payload = JSON.stringify(items);
  if (payload === lastSharedPayload) return;

  isSavingSharedBoard = true;
  try {
    const response = await fetch(apiPath, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });
    if (!response.ok) throw new Error('Shared board save failed');

    lastSharedPayload = payload;
    updateSyncStatus('Shared board');
  } catch {
    updateSyncStatus('Not synced');
  } finally {
    isSavingSharedBoard = false;
    if (pendingSharedSave) {
      pendingSharedSave = false;
      saveSharedItems();
    }
  }
}

async function refreshSharedItems() {
  if (!sharedBoardEnabled || isSavingSharedBoard) return;

  try {
    const response = await fetch(apiPath, { cache: 'no-store' });
    if (!response.ok) throw new Error('Shared board unavailable');

    const sharedItems = await response.json();
    const payload = JSON.stringify(sharedItems);
    if (!Array.isArray(sharedItems) || payload === lastSharedPayload) return;

    items = sharedItems;
    lastSharedPayload = payload;
    localStorage.setItem(storageKey, payload);
    updateSyncStatus('Shared board');
    renderItems();
  } catch {
    updateSyncStatus('Local board');
  }
}

function resetItems() {
  const shouldReset = window.confirm('Reset the organizer and clear saved items?');
  if (!shouldReset) return;

  items = [...defaultItems];
  searchInput.value = '';
  saveItems();
  renderItems();
}

function itemLabel(type) {
  return {
    text: 'Text',
    image: 'Image',
    link: 'Link',
    sketch: 'Sketch',
    other: 'Other',
    project: 'Project'
  }[type];
}

function matchesSearch(item, query) {
  const taskText = Array.isArray(item.tasks) ? item.tasks.map((task) => task.text).join(' ') : '';
  const haystack = `${item.type} ${item.title} ${item.body || ''} ${item.url || ''} ${taskText}`.toLowerCase();
  return haystack.includes(query);
}

function projectPercent(item) {
  if (!Array.isArray(item.tasks) || item.tasks.length === 0) return 0;
  const completedTasks = item.tasks.filter((task) => task.done).length;
  return Math.round((completedTasks / item.tasks.length) * 100);
}

function renderProject(item, card) {
  const percent = projectPercent(item);

  const progress = document.createElement('div');
  progress.className = 'project-progress';

  const progressRow = document.createElement('div');
  progressRow.className = 'project-progress-row';
  const progressLabel = document.createElement('span');
  const progressValue = document.createElement('span');
  progressLabel.textContent = 'Progress';
  progressValue.textContent = `${percent}%`;
  progressRow.append(progressLabel, progressValue);

  const progressTrack = document.createElement('div');
  progressTrack.className = 'progress-track';

  const progressFill = document.createElement('div');
  progressFill.className = 'progress-fill';
  progressFill.style.setProperty('--progress', `${percent}%`);

  progressTrack.append(progressFill);
  progress.append(progressRow, progressTrack);
  card.append(progress);

  if (!Array.isArray(item.tasks) || item.tasks.length === 0) return;

  const checklist = document.createElement('ul');
  checklist.className = 'project-checklist';

  item.tasks.forEach((task, taskIndex) => {
    const taskItem = document.createElement('li');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    const text = document.createElement('span');

    checkbox.type = 'checkbox';
    checkbox.checked = task.done;
    checkbox.addEventListener('change', () => {
      task.done = checkbox.checked;
      saveItems();
      renderItems();
    });

    text.textContent = task.text || `Task ${taskIndex + 1}`;
    label.append(checkbox, text);
    taskItem.append(label);
    checklist.append(taskItem);
  });

  card.append(checklist);
}

function deleteItem(item) {
  const shouldDelete = window.confirm(`Delete "${item.title}" from the organizer?`);
  if (!shouldDelete) return;

  items = items.filter((savedItem) => savedItem !== item);
  saveItems();
  renderItems();
}

function renderItems() {
  const query = searchInput.value.trim().toLowerCase();
  const visibleItems = items.filter((item) => matchesSearch(item, query));

  itemList.innerHTML = '';
  visibleItems.forEach((item) => {
    const li = document.createElement('li');
    li.className = `item-card ${item.type}`;

    const itemTop = document.createElement('div');
    itemTop.className = 'item-top';

    const meta = document.createElement('div');
    meta.className = 'item-meta';
    meta.textContent = itemLabel(item.type);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-item';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => deleteItem(item));

    const title = document.createElement('h3');
    title.className = 'item-title';
    title.textContent = item.title;

    const body = document.createElement('p');
    body.className = 'item-body';
    body.textContent = item.body || '';

    itemTop.append(meta, deleteButton);
    li.append(itemTop, title);

    if (item.url && item.type === 'link') {
      const linkBody = document.createElement('p');
      linkBody.className = 'item-body';
      const link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = item.url;
      linkBody.append(link);
      li.append(linkBody);
    } else {
      li.append(body);
    }

    if (item.image) {
      const image = document.createElement('img');
      image.src = item.image;
      image.alt = item.title;
      li.append(image);
    }

    if (item.type === 'project') {
      renderProject(item, li);
    }

    itemList.append(li);
  });

  itemCount.textContent = `${visibleItems.length} ${visibleItems.length === 1 ? 'item' : 'items'}`;
  emptyState.classList.toggle('hidden', visibleItems.length > 0);
}

function openTextDialog(type) {
  activeDialogType = type;
  dialogTitle.textContent = type === 'other' ? 'Add Other Item' : 'Enter Text';
  itemTitle.value = '';
  itemBody.value = '';
  textDialog.showModal();
  itemTitle.focus();
}

function addTextItem(event) {
  event.preventDefault();

  items.unshift({
    type: activeDialogType,
    title: itemTitle.value.trim(),
    body: itemBody.value.trim()
  });

  saveItems();
  textDialog.close();
  renderItems();
}

function addLink() {
  const url = window.prompt('Paste a studio link');
  if (!url) return;

  const title = window.prompt('Name this link') || 'Studio Link';
  items.unshift({
    type: 'link',
    title: title.trim(),
    url: url.trim(),
    body: url.trim()
  });
  saveItems();
  renderItems();
}

function openProjectDialog() {
  projectTitle.value = '';
  projectBody.value = '';
  projectTasks.value = '';
  projectDialog.showModal();
  projectTitle.focus();
}

function addProject(event) {
  event.preventDefault();

  const tasks = projectTasks.value
    .split('\n')
    .map((task) => task.trim())
    .filter(Boolean)
    .map((task) => ({ text: task, done: false }));

  items.unshift({
    type: 'project',
    title: projectTitle.value.trim(),
    body: projectBody.value.trim(),
    tasks
  });

  saveItems();
  projectDialog.close();
  renderItems();
}

function setupCanvas() {
  const context = sketchCanvas.getContext('2d');
  context.lineWidth = 4;
  context.lineCap = 'round';
  context.strokeStyle = activeSketchColor;

  function setSketchColor(color) {
    activeSketchColor = color;
    context.strokeStyle = activeSketchColor;
    sketchColor.value = activeSketchColor;

    colorSwatches.forEach((swatch) => {
      swatch.classList.toggle('selected', swatch.dataset.color === activeSketchColor);
    });
  }

  function positionFromEvent(event) {
    const rect = sketchCanvas.getBoundingClientRect();
    const scaleX = sketchCanvas.width / rect.width;
    const scaleY = sketchCanvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  sketchCanvas.addEventListener('pointerdown', (event) => {
    isDrawing = true;
    sketchCanvas.setPointerCapture(event.pointerId);
    context.strokeStyle = activeSketchColor;
    const point = positionFromEvent(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
  });

  sketchCanvas.addEventListener('pointermove', (event) => {
    if (!isDrawing) return;
    const point = positionFromEvent(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  });

  sketchCanvas.addEventListener('pointerup', () => {
    isDrawing = false;
  });

  clearSketch.addEventListener('click', () => {
    context.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
  });

  colorSwatches.forEach((swatch) => {
    swatch.addEventListener('click', () => setSketchColor(swatch.dataset.color));
  });

  sketchColor.addEventListener('input', () => setSketchColor(sketchColor.value));
}

document.querySelectorAll('.tool-button').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'text') openTextDialog('text');
    if (action === 'image') imageInput.click();
    if (action === 'link') addLink();
    if (action === 'sketch') sketchDialog.showModal();
    if (action === 'other') openTextDialog('other');
    if (action === 'project') openProjectDialog();
  });
});

imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener('load', () => {
    items.unshift({
      type: 'image',
      title: file.name,
      body: 'Uploaded image',
      image: reader.result
    });
    saveItems();
    imageInput.value = '';
    renderItems();
  });
  reader.readAsDataURL(file);
});

textDialog.addEventListener('close', () => {
  itemTitle.value = '';
  itemBody.value = '';
});

textDialog.querySelector('form').addEventListener('submit', addTextItem);
textDialog.querySelector('.secondary-button').addEventListener('click', () => textDialog.close());

sketchDialog.querySelector('form').addEventListener('submit', (event) => {
  event.preventDefault();
  items.unshift({
    type: 'sketch',
    title: 'Sketch',
    body: 'Saved drawing',
    image: sketchCanvas.toDataURL('image/png')
  });
  saveItems();
  sketchCanvas.getContext('2d').clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
  sketchDialog.close();
  renderItems();
});

sketchDialog.querySelector('[value="cancel"]').addEventListener('click', () => sketchDialog.close());
projectDialog.querySelector('form').addEventListener('submit', addProject);
projectDialog.querySelector('.secondary-button').addEventListener('click', () => projectDialog.close());
searchInput.addEventListener('input', renderItems);
resetButton.addEventListener('click', resetItems);

setupCanvas();
renderItems();
loadSharedItems();
if (sharedBoardEnabled) {
  window.setInterval(refreshSharedItems, 2500);
}
