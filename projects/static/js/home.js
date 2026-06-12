let draggedCard = null;
let currentCardEl = null;
let taskCounter = 6;


/* ── DRAG & DROP ─────────────────────── */
function drag(e) {
  draggedCard = e.currentTarget;
  draggedCard.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

document.addEventListener('dragend', () => {
  if (draggedCard) draggedCard.classList.remove('dragging');
  document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
});

document.querySelectorAll('.kanban-col').forEach(col => {
  col.addEventListener('dragenter', () => col.classList.add('drag-over'));
  col.addEventListener('dragleave', (e) => {
    if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
  });
});

function drop(e, colId) {
  e.preventDefault();
  if (!draggedCard) return;
  const target = document.getElementById('cards-' + colId);
  target.appendChild(draggedCard);
  draggedCard.dataset.col = colId;
  draggedCard.classList.remove('dragging');
  document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
  updateCounts();
  showToast('Task moved to ' + colId
    .replace('inprogress', 'In Progress')
    .replace('inreview',   'In Review')
    .replace('todo',       'To Do')
    .replace('done',       'Done'));
  draggedCard = null;
}

function updateCounts() {
  ['todo', 'inprogress', 'inreview', 'done'].forEach(col => {
    const count = document.querySelectorAll(`#cards-${col} .kanban-card`).length;
    document.getElementById('count-' + col).textContent = count;
  });
}


/* ── WORKSPACE DROPDOWN ──────────────── */
const pill     = document.getElementById('wsPill');
const dropdown = document.getElementById('wsDropdown');

// Teleport dropdown to <body> on first use so it's never clipped by sidebar
let teleported = false;
function ensureTeleported() {
  if (teleported) return;
  document.body.appendChild(dropdown);
  teleported = true;
}

function positionDropdown() {
  const rect = pill.getBoundingClientRect();
  dropdown.style.top  = (rect.bottom + 8) + 'px';
  dropdown.style.left = rect.left + 'px';
}

pill.addEventListener('click', (e) => {
  e.stopPropagation();
  ensureTeleported();
  const isOpen = dropdown.classList.contains('visible');
  if (!isOpen) positionDropdown();
  dropdown.classList.toggle('visible', !isOpen);
  pill.classList.toggle('open', !isOpen);
});

// Close on outside click
document.addEventListener('click', (e) => {
  if (!dropdown.contains(e.target) && !pill.contains(e.target)) {
    dropdown.classList.remove('visible');
    pill.classList.remove('open');
  }
});

// Prevent dropdown from closing itself
dropdown.addEventListener('click', (e) => e.stopPropagation());

// Re-position on scroll/resize so it never drifts
window.addEventListener('resize', () => {
  if (dropdown.classList.contains('visible')) positionDropdown();
});
window.addEventListener('scroll', () => {
  if (dropdown.classList.contains('visible')) positionDropdown();
}, true);


/* ── SEARCH / FILTER ─────────────────── */
function filterCards(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('.kanban-card').forEach(card => {
    const title = card.querySelector('.card-title').textContent.toLowerCase();
    card.style.display = title.includes(q) ? '' : 'none';
  });
}

function filterByAssignee(userId) {
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  event.currentTarget.classList.add('active');

  const allTasks = document.querySelectorAll('.kanban-card');
  let counts = { todo: 0, in_progress: 0, done: 0, in_review: 0, total: 0 };

  allTasks.forEach(task => {
    const match = userId === 'all' || task.dataset.assigneeId === String(userId);
    task.style.display = match ? 'block' : 'none';
    if (match) {
      counts.total++;
      const col = task.dataset.col;
      if (counts[col] !== undefined) counts[col]++;
    }
  });

  document.querySelector('.count-total').textContent    = counts.total;
  document.querySelector('.count-todo').textContent     = counts.todo;
  document.querySelector('.count-progress').textContent = counts.in_progress;
  document.querySelector('.count-review').textContent   = counts.in_review;
  document.querySelector('.count-done').textContent     = counts.done;

  document.querySelector('.badge-todo').textContent     = counts.todo;
  document.querySelector('.badge-progress').textContent = counts.in_progress;
  document.querySelector('.badge-done').textContent     = counts.done;
  document.querySelector('.badge-review').textContent   = counts.in_review;
}


/* ── VIEW TOGGLE ─────────────────────── */
function switchView(view) {
  document.getElementById('boardView').classList.toggle('hidden', view !== 'board');
  document.getElementById('listView').classList.toggle('hidden',  view !== 'list');
  document.getElementById('btnBoard').classList.toggle('active',  view === 'board');
  document.getElementById('btnList').classList.toggle('active',   view === 'list');
}


/* ── THEME ───────────────────────────── */
function toggleTheme() {
  const body = document.body;
  const btn  = document.getElementById('themeBtn');
  body.classList.toggle('light-theme');
  if (body.classList.contains('light-theme')) {
    btn.textContent = '⏾';
    localStorage.setItem('theme', 'light');
  } else {
    btn.textContent = '☀';
    localStorage.setItem('theme', 'dark');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme');
  const btn = document.getElementById('themeBtn');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    btn.textContent = '⏾';
  } else {
    btn.textContent = '☀';
  }
});


/* ── CARD DATA ───────────────────────── */
const cardData = {
  t1: { id:'TES-001', title:'Setup authentication with Django and Email',    type:'Feature', assignee:'J', av:'av-blue',  name:'James', status:'todo',       priority:'Medium' },
  t2: { id:'TES-002', title:"Design Tesko's signup page",                    type:'Design',  assignee:'M', av:'av-green', name:'Maria', status:'todo',       priority:'Low'    },
  t3: { id:'TES-003', title:'Fix POST method issue on the registration form', type:'Bug',     assignee:'J', av:'av-blue',  name:'James', status:'inprogress', priority:'High'   },
  t4: { id:'TES-004', title:'Update Terms of Service checkbox styling',       type:'Task',    assignee:'S', av:'av-red',   name:'Sam',   status:'inreview',   priority:'Low'    },
  t5: { id:'TES-005', title:'Create database models for Workspaces',          type:'Feature', assignee:'M', av:'av-green', name:'Maria', status:'done',       priority:'Medium' },
};


/* ── DELETE TASK ─────────────────────── */
function deleteTask() {
  const taskId = document.getElementById('modalTaskId').value;
  if (!confirm('Delete this task? This cannot be undone.')) return;

  fetch(`/task/${taskId}/delete/`, {
    method: 'POST',
    headers: { 'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value }
  })
  .then(res => {
    if (res.ok) {
      const card = document.querySelector(`[data-id="TES-${String(taskId).padStart(3,'0')}"]`);
      const col  = card?.dataset.col;
      card?.remove();
      closeCardModal();

      if (col) {
        const colCount = document.getElementById(`count-${col}`);
        if (colCount) colCount.textContent = parseInt(colCount.textContent) - 1;
      }

      const total = document.querySelector('.count-total');
      if (total) total.textContent = parseInt(total.textContent) - 1;

      const statMap = {
        'todo':        '.count-todo',
        'in_progress': '.count-progress',
        'in_review':   '.count-review',
        'done':        '.count-done',
      };
      if (col && statMap[col]) {
        const el = document.querySelector(statMap[col]);
        if (el) el.textContent = parseInt(el.textContent) - 1;
      }
    }
  });
}


/* ── OPEN / CLOSE CARD MODAL ─────────── */
function openCard(el) {
  currentCardEl = el;
  const form = document.getElementById('cardEditForm');

  document.getElementById('modalTaskId').value   = el.dataset.id.replace('TES-', '');
  document.getElementById('modalId').textContent = el.dataset.id;
  document.getElementById('modalTitle').textContent =
    el.querySelector('.card-title').textContent;
  document.getElementById('modalTag').textContent =
    el.querySelector('.tag').textContent;

  if (form && el.dataset.saveUrl) form.action = el.dataset.saveUrl;

  const statusField      = document.getElementById('id_status');
  const typeField        = document.getElementById('id_type');
  const assigneeField    = document.getElementById('id_assignee');
  const descriptionField = document.getElementById('id_description');

  if (statusField)      statusField.value      = el.dataset.col         || 'todo';
  if (typeField)        typeField.value        = el.dataset.type        || 'task';
  if (assigneeField)    assigneeField.value    = el.dataset.assigneeId  || '';
  if (descriptionField) descriptionField.value = el.dataset.description || '';

  initStatusCard(el.dataset.col || 'todo');
  document.getElementById('cardModal').classList.remove('hidden');
}

function closeCardModal() {
  document.getElementById('cardModal').classList.add('hidden');
}

function closeModal(e) {
  if (e.target === document.getElementById('cardModal')) closeCardModal();
}

function saveCard() {
  showToast('Changes saved');
  closeCardModal();
}


/* ── CREATE MODAL ────────────────────── */
function openCreateModal() {
  document.getElementById('createModal').classList.remove('hidden');
}

function closeCreateModal(e) {
  if (!e || e.target === document.getElementById('createModal')) {
    document.getElementById('createModal').classList.add('hidden');
  }
}

function createTask() {
  const title = document.getElementById('newTitle').value.trim();
  if (!title) { document.getElementById('newTitle').focus(); return; }

  const status         = document.getElementById('newStatus').value;
  const type           = document.getElementById('newType').value;
  const select         = document.getElementById('newAssignee');
  const assigneeId     = select.value;
  const assigneeName   = select.selectedOptions[0]?.dataset.name    || '';
  const assigneeInitial= select.selectedOptions[0]?.dataset.initial || '';

  const colors  = ['av-blue', 'av-green', 'av-red', 'av-orange', 'av-purple'];
  const avClass = assigneeId ? colors[parseInt(assigneeId) % colors.length] : 'av-blue';

  const id   = 'TES-00' + taskCounter++;
  const card = document.createElement('div');

  card.className          = 'kanban-card';
  card.draggable          = true;
  card.dataset.id         = 't' + taskCounter;
  card.dataset.assigneeId = assigneeId;
  card.dataset.assignee   = assigneeInitial;
  card.dataset.col        = status;
  card.onclick            = function () { openCard(this); };
  card.addEventListener('dragstart', drag);

  card.innerHTML = `
    <div class="card-priority prio-medium"></div>
    <p class="card-title">${escapeHTML(title)}</p>
    <div class="card-meta">
      <span class="tag tag-${type}">${capitalize(type)}</span>
      <div class="card-footer-row">
        <span class="card-id">${id}</span>
        <div class="avatar ${avClass} av-sm">${assigneeInitial}</div>
      </div>
    </div>`;

  cardData['t' + taskCounter] = {
    id, title, type: capitalize(type),
    assigneeId, assignee: assigneeInitial,
    name: assigneeName, av: avClass, status, priority: 'Medium'
  };

  document.getElementById('cards-' + status).appendChild(card);
  updateCounts();
  closeCreateModal();
  document.getElementById('newTitle').value = '';
  document.getElementById('newDesc').value  = '';
  showToast('Task created ' + id);
}

function quickAdd(col) {
  document.getElementById('newStatus').value = col;
  openCreateModal();
}


/* ── NOTIFICATIONS ───────────────────── */
let notifOpen = false;

function toggleNotif() {
  notifOpen = !notifOpen;
  document.getElementById('notifDropdown').classList.toggle('hidden', !notifOpen);
}

document.addEventListener('click', (e) => {
  if (notifOpen && !e.target.closest('.notif-btn') && !e.target.closest('.notif-dropdown')) {
    notifOpen = false;
    document.getElementById('notifDropdown').classList.add('hidden');
  }
});


/* ── COMMENTS ────────────────────────── */
function addComment() {
  const inp  = document.getElementById('commentInput');
  const text = inp.value.trim();
  if (!text) return;

  const list = document.getElementById('commentList');
  const item = document.createElement('div');
  item.className = 'comment-item';
  item.innerHTML = `
    <div class="avatar av-blue av-sm">J</div>
    <div class="comment-body">
      <span class="comment-author">James</span>
      <p class="comment-text">${escapeHTML(text)}</p>
    </div>`;

  list.appendChild(item);
  inp.value = '';
  list.scrollTop = list.scrollHeight;
}


/* ── TOAST ───────────────────────────── */
function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className   = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}


/* ── UTILS ───────────────────────────── */
function escapeHTML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}


/* ── STATUS CARD (modal) ─────────────── */
let currentStatus = null;
const progressMap = { todo: 0, in_progress: 50, in_review: 80, done: 100 };

function switchStatus(status) {
  if (currentStatus === status) return;

  document.querySelectorAll('.sc-tab').forEach(t => {
    t.classList.toggle('sc-active', t.dataset.status === status);
  });

  if (currentStatus) {
    const old = document.getElementById('sc-' + currentStatus);
    if (old) {
      old.classList.remove('sc-visible');
      old.classList.add('sc-exit');
      setTimeout(() => old.classList.remove('sc-exit'), 260);
    }
  }

  setTimeout(() => {
    const next = document.getElementById('sc-' + status);
    if (next) {
      next.classList.add('sc-visible');
      setTimeout(() => {
        const fill = next.querySelector('.sc-fill');
        if (fill) fill.style.width = progressMap[status] + '%';
      }, 60);
    }
  }, currentStatus ? 180 : 0);

  currentStatus = status;
}

function initStatusCard(status) {
  currentStatus = null;
  document.querySelectorAll('.sc-body').forEach(b => {
    b.classList.remove('sc-visible', 'sc-exit');
    const fill = b.querySelector('.sc-fill');
    if (fill) fill.style.width = '0%';
  });
  switchStatus(status || 'todo');
}