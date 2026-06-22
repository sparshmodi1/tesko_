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

  const idMap = {
    'todo':        'todo',
    'in_progress': 'inprogress',
    'in_review':   'inreview',
    'done':        'done'
  };

  const domId = idMap[colId];
  const target = document.getElementById('cards-' + domId);
  if (!target) return;

  // animate card drop-in
  draggedCard.style.animation = 'none';
  target.appendChild(draggedCard);
  draggedCard.dataset.col = colId;
  draggedCard.classList.remove('dragging');
  requestAnimationFrame(() => {
    draggedCard.style.animation = '';
    draggedCard.style.animationName = 'cardDropIn';
    draggedCard.style.animationDuration = '.25s';
    draggedCard.style.animationTimingFunction = 'cubic-bezier(.4,0,.2,1)';
  });

  document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
  updateCounts();

  const rawId = draggedCard.dataset.id.replace('TES-', '').replace(/^0+/, '');
  fetch(`/task/${rawId}/update-status/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
    },
    body: JSON.stringify({ status: colId })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast('Moved to ' + colId
        .replace('in_progress', 'In Progress')
        .replace('in_review',   'In Review')
        .replace('todo',        'To Do')
        .replace('done',        'Done'));
    } else {
      showToast('Failed to save');
    }
  })
  .catch(() => showToast('Network error'));

  draggedCard = null;
}

function updateCounts() {
  const cols = [
    { domId: 'todo',        statKey: 'todo'        },
    { domId: 'inprogress',  statKey: 'in_progress' },
    { domId: 'inreview',    statKey: 'in_review'   },
    { domId: 'done',        statKey: 'done'        },
  ];

  let total = 0;
  cols.forEach(({ domId, statKey }) => {
    const cards = document.querySelectorAll(`#cards-${domId} .kanban-card`);
    const count = cards.length;
    total += count;

    const badge = document.getElementById('count-' + domId);
    if (badge) animateCount(badge, parseInt(badge.textContent) || 0, count);

    const statMap = {
      'todo':        '.count-todo',
      'in_progress': '.count-progress',
      'in_review':   '.count-review',
      'done':        '.count-done',
    };
    const statEl = document.querySelector(statMap[statKey]);
    if (statEl) animateCount(statEl, parseInt(statEl.textContent) || 0, count);
  });

  const totalEl = document.querySelector('.count-total');
  if (totalEl) animateCount(totalEl, parseInt(totalEl.textContent) || 0, total);
}

/* smoothly counts up/down a number */
function animateCount(el, from, to) {
  if (from === to) return;
  const dur = 300;
  const start = performance.now();
  requestAnimationFrame(function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    el.textContent = Math.round(from + (to - from) * easeOut(p));
    if (p < 1) requestAnimationFrame(tick);
  });
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }


/* ── WORKSPACE DROPDOWN ──────────────── */
const pill     = document.getElementById('wsPill');
const dropdown = document.getElementById('wsDropdown');

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

document.addEventListener('click', (e) => {
  if (!dropdown.contains(e.target) && !pill.contains(e.target)) {
    dropdown.classList.remove('visible');
    pill.classList.remove('open');
  }
});

dropdown.addEventListener('click', (e) => e.stopPropagation());

const wsSearch = document.getElementById('wsSearch');
const wsList   = document.getElementById('wsList');
if (wsSearch && wsList) {
  wsSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const items = wsList.querySelectorAll('.dd-item[data-name]');
    items.forEach(item => {
      const name  = item.dataset.name || '';
      const code  = item.dataset.code || '';
      const match = !query || name.includes(query) || code.includes(query);
      item.classList.toggle('hidden', !match);
    });
  });
}

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
    const show  = title.includes(q);
    if (show) {
      card.style.display = '';
      card.style.opacity = '1';
    } else {
      card.style.opacity = '0';
      setTimeout(() => { card.style.display = 'none'; }, 150);
    }
  });
}

/* ── VIEW TOGGLE ─────────────────────── */
function switchView(view) {
  const board = document.getElementById('boardView');
  const list  = document.getElementById('listView');
  if (board) {
    board.style.opacity = '0';
    setTimeout(() => {
      board.classList.toggle('hidden', view !== 'board');
      if (view === 'board') { board.style.opacity = '1'; }
    }, view === 'board' ? 0 : 150);
  }
  if (list) {
    list.style.opacity = '0';
    setTimeout(() => {
      list.classList.toggle('hidden', view !== 'list');
      if (view === 'list') { list.style.opacity = '1'; }
    }, view === 'list' ? 0 : 150);
  }
  document.getElementById('btnBoard')?.classList.toggle('active', view === 'board');
  document.getElementById('btnList')?.classList.toggle('active',  view === 'list');
}


/* ── THEME ───────────────────────────── */
function toggleTheme() {
  const body = document.body;
  const btn  = document.getElementById('themeBtn');
  body.classList.toggle('light-theme');

  // quick flash overlay for smooth transition feel
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;background:rgba(255,255,255,.06);animation:themeFlash .3s ease forwards';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 350);

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
    if (btn) btn.textContent = '⏾';
  } else {
    if (btn) btn.textContent = '☀';
  }

  // inject cardDropIn + themeFlash keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes cardDropIn {
      from { opacity:.5; transform: scale(.97) translateY(-6px); }
      to   { opacity:1;  transform: scale(1)   translateY(0); }
    }
    @keyframes themeFlash {
      from { opacity:1; }
      to   { opacity:0; }
    }
    .kanban-card { transition: opacity .15s ease, border-color .18s, transform .18s, box-shadow .18s; }
  `;
  document.head.appendChild(style);

  const createForm = document.getElementById('createTaskForm');
  if (createForm) {
    createForm.addEventListener('submit', function() { /* let it submit normally */ });
  }

  // stagger-in existing cards on page load
  document.querySelectorAll('.kanban-card').forEach((card, i) => {
    card.style.animationDelay = (0.28 + i * 0.05) + 's';
  });
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
      if (card) {
        card.style.transition = 'opacity .2s ease, transform .2s ease';
        card.style.opacity    = '0';
        card.style.transform  = 'scale(.95)';
        setTimeout(() => card.remove(), 220);
      }
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
  const form   = document.getElementById('cardEditForm');
  const taskId = el.dataset.id.replace('TES-', '').replace(/^0+/, '');

  document.getElementById('modalTaskId').value   = taskId;
  document.getElementById('modalId').textContent = el.dataset.id;
  document.getElementById('modalTag').textContent =
    el.querySelector('.tag').textContent;

  if (form && el.dataset.saveUrl) form.action = el.dataset.saveUrl;

  const titleField       = document.getElementById('modalTitleInput');
  const typeField        = document.getElementById('modalType');
  const descriptionField = document.getElementById('modalDesc');

  if (titleField)       titleField.value       = el.querySelector('.card-title').textContent.trim();
  if (typeField)        typeField.value        = el.dataset.type        || 'task';
  if (descriptionField) descriptionField.value = el.dataset.description || '';

  document.getElementById('cardModal').classList.remove('hidden');

  const statusField    = document.getElementById('detailStatus');
  const priorityField  = document.getElementById('detailPriority');
  const assigneeField  = document.getElementById('detailAssignee');
  const dueDateField   = document.getElementById('detailDueDate');
  const startDateField = document.getElementById('detailStartDate');
  const sprintField    = document.getElementById('detailSprint');
  const estimateField  = document.getElementById('detailEstimate');

  if (statusField)    statusField.value    = el.dataset.col      || 'todo';
  if (priorityField)  priorityField.value  = el.dataset.priority || 'medium';
  if (dueDateField)   dueDateField.value   = el.dataset.dueDate    || '';
  if (startDateField) startDateField.value = el.dataset.startDate  || '';
  if (sprintField)    sprintField.value    = el.dataset.sprint      || '';
  if (estimateField)  estimateField.value  = el.dataset.estimate   || '';

  const statusLabels   = { 'todo': 'To Do', 'in_progress': 'In Progress', 'in_review': 'In Review', 'done': 'Done' };
  const sprintLabels   = { 'sprint_1': 'Sprint 1', 'sprint_2': 'Sprint 2', 'sprint_3': 'Sprint 3' };
  const priorityLabels = { 'low': 'Low', 'medium': 'Medium', 'high': 'High' };

  const statusText    = document.getElementById('detailStatusText');
  const priorityText  = document.getElementById('detailPriorityText');
  const dueDateText   = document.getElementById('detailDueDateText');
  const startDateText = document.getElementById('detailStartDateText');
  const sprintText    = document.getElementById('detailSprintText');
  const estimateText  = document.getElementById('detailEstimateText');
  const assigneeText  = document.getElementById('detailAssigneeText');
  const reporterText  = document.getElementById('detailReporterText');
  const reporterAvatar= document.getElementById('detailReporterAvatar');

  if (statusText)    statusText.textContent    = statusLabels[el.dataset.col]        || el.dataset.col        || '—';
  if (priorityText)  priorityText.textContent  = priorityLabels[el.dataset.priority] || el.dataset.priority   || '—';
  if (dueDateText)   dueDateText.textContent   = el.dataset.dueDate    || '—';
  if (startDateText) startDateText.textContent = el.dataset.startDate  || '—';
  if (sprintText)    sprintText.textContent    = sprintLabels[el.dataset.sprint] || el.dataset.sprint || '—';
  if (estimateText)  estimateText.textContent  = el.dataset.estimate   || '—';
  if (assigneeText)  assigneeText.textContent  = el.dataset.assigneeName;
  if (reporterText)  reporterText.textContent  = el.dataset.reporterName || '—';
  if (reporterAvatar) reporterAvatar.textContent = el.dataset.reporterName
    ? el.dataset.reporterName.charAt(0).toUpperCase() : '—';

  if (assigneeField) {
    setTimeout(() => {
      assigneeField.value = el.dataset.assigneeId || '';
      const at = document.getElementById('detailAssigneeText');
      if (at) at.textContent = el.dataset.assigneeName || '—';
    }, 0);
  }

  initDetailFieldListeners(taskId);
  loadEditComments(taskId);
}

function initDetailFieldListeners(taskId) {
  const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

  document.querySelectorAll('.detail-inline-select, .detail-inline-date, .detail-inline-input')
    .forEach(el => {
      const old = el._detailChangeHandler;
      if (old) el.removeEventListener('change', old);

      const handler = async () => {
        const field = el.dataset.field;
        const value = el.value;
        try {
          const res = await fetch(`/task/${taskId}/update-field/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            body: JSON.stringify({ field, value }),
          });
          const data = await res.json();
          if (!data.success) console.error('Save failed:', data.error);
          else {
            // flash the field green briefly
            el.style.transition = 'background .15s';
            el.style.background = 'rgba(16,185,129,.12)';
            setTimeout(() => { el.style.background = ''; }, 600);
          }
        } catch (e) {
          console.error('Network error:', e);
        }
      };

      el._detailChangeHandler = handler;
      el.addEventListener('change', handler);
    });
}

function loadEditComments(taskId) {
  const list = document.getElementById('editCommentList');
  if (!list) return;

  fetch(`/task/${taskId}/comments/`)
    .then(res => res.json())
    .then(data => {
      list.innerHTML = '';
      if (data.comments && data.comments.length > 0) {
        data.comments.forEach(c => {
          const item = document.createElement('div');
          item.className = 'em-comment-item';
          item.style.cssText = 'display:flex;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);animation:cmFadeIn .2s ease';
          item.innerHTML = `
            <div class="em-comment-avatar">${c.author_initial}</div>
            <div class="em-comment-body" style="flex:1;min-width:0">
              <div class="em-comment-header">
                <span class="em-comment-name">${c.author}</span>
                <span class="em-comment-time">${c.time}</span>
              </div>
              <p class="em-comment-text">${escapeHTML(c.text)}</p>
            </div>`;
          list.appendChild(item);
        });
      } else {
        list.innerHTML = `
          <div class="em-comment-empty">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 3h16a1 1 0 011 1v10a1 1 0 01-1 1H6l-4 4V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
            <span>No comments yet. Start the conversation.</span>
          </div>`;
      }
      list.scrollTop = list.scrollHeight;
    })
    .catch(err => console.error('Error loading comments:', err));
}

function addEditComment() {
  const taskId = document.getElementById('modalTaskId').value;
  const inp    = document.getElementById('editCommentInput');
  const text   = inp.value.trim();
  if (!text || !taskId) return;

  fetch(`/task/${taskId}/comment/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
    },
    body: JSON.stringify({ text })
  })
  .then(res => res.json())
  .then(data => {
    if (data.id) { inp.value = ''; loadEditComments(taskId); }
  })
  .catch(err => console.error('Error adding comment:', err));
}

function closeCardModal() {
  const modal = document.getElementById('cardModal');
  modal.style.opacity   = '0';
  modal.style.transform = 'scale(.98)';
  modal.style.transition= 'opacity .18s ease, transform .18s ease';
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.style.opacity   = '';
    modal.style.transform = '';
    modal.style.transition= '';
  }, 190);
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
  const modal = document.getElementById('createModal');
  if (!modal) return;
  modal.classList.remove('hidden');
}

function closeCreateModal(e) {
  const modal = document.getElementById('createModal');
  if (!modal) return;
  if (!e || e.target === modal) {
    modal.style.opacity   = '0';
    modal.style.transition= 'opacity .16s ease';
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.style.opacity   = '';
      modal.style.transition= '';
    }, 170);
  }
}

function createTask() {
  const title = document.getElementById('newTitle').value.trim();
  if (!title) {
    const inp = document.getElementById('newTitle');
    inp.style.borderColor = '#ef4444';
    inp.style.boxShadow   = '0 0 0 3px rgba(239,68,68,.1)';
    inp.focus();
    setTimeout(() => { inp.style.borderColor = ''; inp.style.boxShadow = ''; }, 1200);
    return;
  }

  const status          = document.getElementById('newStatus').value;
  const type            = document.getElementById('newType').value;
  const priority        = document.getElementById('newPriority').value;
  const select          = document.getElementById('newAssignee');
  const assigneeId      = select.value;
  const assigneeName    = select.selectedOptions[0]?.dataset.name    || '';
  const assigneeInitial = select.selectedOptions[0]?.dataset.initial || '';

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
    <div class="card-priority prio-${priority}"></div>
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
    name: assigneeName, av: avClass, status, priority: capitalize(priority)
  };

  const target = document.getElementById('cards-' + status);
  if (target) {
    target.appendChild(card);
    // pop-in animation
    card.style.animation = 'cardDropIn .3s cubic-bezier(.4,0,.2,1)';
  }

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
    document.getElementById('notifDropdown')?.classList.add('hidden');
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
  item.style.animation = 'cmFadeIn .2s ease';
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
  if (existing) {
    existing.style.transition = 'opacity .15s ease';
    existing.style.opacity    = '0';
    setTimeout(() => existing.remove(), 160);
  }
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

function switchStatus(status) {
    document.querySelectorAll('.sc-tab').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.status === status)
    );
    document.querySelectorAll('.sc-body').forEach(body =>
      body.style.display = body.id === 'sc-' + status ? 'block' : 'none'
    );
    const select = document.querySelector('#id_status');
    if (select) select.value = status;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const select = document.querySelector('#id_status');
    if (select) {
      switchStatus(select.value || 'todo');
      select.addEventListener('change', e => switchStatus(e.target.value));
    }
    document.querySelectorAll('.cm-label-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.hasAttribute('disabled')) return;
        btn.classList.toggle('selected');
      });
    });
  });

  function toggleAvDropdown() {
    var drop = document.getElementById('avDropdown');
    drop.style.display = drop.style.display === 'none' ? 'block' : 'none';
  }

  document.addEventListener('click', function(e) {
    var drop = document.getElementById('avDropdown');
    var btn = document.getElementById('avMoreBtn');
    if (drop && btn && !drop.contains(e.target) && !btn.contains(e.target)) {
      drop.style.display = 'none';
    }
  });

  function filterByAssignee(event, userId, userName) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    const allTasks = document.querySelectorAll('.kanban-card');
    let counts = { todo: 0, in_progress: 0, done: 0, in_review: 0, total: 0 };

    allTasks.forEach(task => {
      const match = userId === 'all' || task.dataset.assigneeId === String(userId);
      if (match) {
        task.style.display = 'block';
        task.style.opacity = '1';
        task.style.pointerEvents = 'auto';
        counts.total++;
        const col = task.dataset.col;
        if (counts[col] !== undefined) counts[col]++;
      } else {
        task.style.display = 'none';
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