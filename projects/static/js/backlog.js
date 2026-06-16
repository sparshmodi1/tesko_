/* TESKO - BACKLOG */

const backlogFilters = {
    query: "",
    type: "all"
};

const BACKLOG_CHECKED_KEY = "tesko.backlog.checkedIssueIds";

const themeIcons = {
    light: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 10.2A5.8 5.8 0 0 1 5.8 2.5 5.8 5.8 0 1 0 13.5 10.2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    dark: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3.2" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.2v1.5M8 13.3v1.5M1.2 8h1.5M13.3 8h1.5M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
};

function openEditModal(id, title, type, priority, status, assigneeId, estimate, description) {
  document.getElementById('editTitle').value       = title;
  document.getElementById('editType').value        = type;
  document.getElementById('editPriority').value    = priority;
  document.getElementById('editStatus').value      = status;
  document.getElementById('editAssignee').value    = assigneeId;
  document.getElementById('editEstimate').value    = estimate;
  document.getElementById('editDescription').value = description;
  document.getElementById('editForm').action       = `/task/${id}/edit/`;
  document.getElementById('editModal').classList.remove('hidden');
}
function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById("themeBtn");

    body.classList.toggle("light-theme");

    if (body.classList.contains("light-theme")) {
        btn.textContent = "⏾";
        localStorage.setItem("theme", "light");
    } else {
        btn.textContent = "☀";
        localStorage.setItem("theme", "dark");
    }
}

window.addEventListener("load", function () {
    const savedTheme = localStorage.getItem("theme");
    const btn = document.getElementById("themeBtn");

    if (!btn) return;

    if (savedTheme === "light") {
        document.body.classList.add("light-theme");
        btn.textContent = "⏾";
    } else {
        btn.textContent = "☀";
    }
});

function toggleSection(id) {
    const body = document.getElementById(id);
    const chev = document.getElementById("chev-" + id);

    if (!body) return;

    const isOpen = !body.classList.contains("collapsed");
    body.classList.toggle("collapsed", isOpen);

    if (chev) {
        chev.style.transform = isOpen ? "rotate(-90deg)" : "rotate(0deg)";
    }
}

function filterBacklog(query) {
    backlogFilters.query = query.toLowerCase().trim();
    applyBacklogFilters();
}

function filterByType(type) {
    backlogFilters.type = type;
    applyBacklogFilters();
}

function applyBacklogFilters() {
    document.querySelectorAll("#backlogBody .bl-row").forEach((row) => {
        const matchesQuery = row.textContent.toLowerCase().includes(backlogFilters.query);
        const matchesType = backlogFilters.type === "all" || row.dataset.type === backlogFilters.type;
        row.hidden = !(matchesQuery && matchesType);
    });
}

function getCheckedBacklogIds() {
    try {
        return new Set(JSON.parse(localStorage.getItem(BACKLOG_CHECKED_KEY) || "[]"));
    } catch (error) {
        return new Set();
    }
}

function saveCheckedBacklogIds(ids) {
    localStorage.setItem(BACKLOG_CHECKED_KEY, JSON.stringify(Array.from(ids)));
}

function initBacklogChecks() {
    const checkedIds = getCheckedBacklogIds();
    const currentIds = new Set();

    document.querySelectorAll("#backlogBody .bl-row").forEach((row) => {
        const taskId = row.dataset.taskId;
        const checkbox = row.querySelector(".bl-check");

        if (!taskId || !checkbox) return;

        currentIds.add(taskId);
        checkbox.checked = checkedIds.has(taskId);

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                checkedIds.add(taskId);
            } else {
                checkedIds.delete(taskId);
            }

            saveCheckedBacklogIds(checkedIds);
        });
    });

    Array.from(checkedIds).forEach((taskId) => {
        if (!currentIds.has(taskId)) checkedIds.delete(taskId);
    });

    saveCheckedBacklogIds(checkedIds);
}

function getCsrfToken() {
    const tokenInput = document.querySelector("[name=csrfmiddlewaretoken]");
    return tokenInput ? tokenInput.value : "";
}

function updateBacklogIssueCounts() {
    const count = document.querySelectorAll("#backlogBody .bl-row").length;
    const label = count + " issue" + (count === 1 ? "" : "s");

    const subtitle = document.querySelector(".board-subtitle");
    const sectionCount = document.getElementById("backlogCount");
    const navBadge = document.querySelector(".nav-badge");

    if (subtitle) subtitle.textContent = label;
    if (sectionCount) sectionCount.textContent = label;
    if (navBadge) navBadge.textContent = count;
}

function removeCheckedBacklogId(taskId) {
    const checkedIds = getCheckedBacklogIds();
    checkedIds.delete(String(taskId));
    saveCheckedBacklogIds(checkedIds);
}

function ensureBacklogEmptyState() {
    const body = document.getElementById("backlogBody");
    if (!body || body.querySelector(".bl-row")) return;

    body.innerHTML = '<tr class="bl-empty-row"><td colspan="8">No backlog issues yet.</td></tr>';
}

function deleteBacklogTask(button) {
    const row = button.closest(".bl-row");
    if (!row) return;

    const issueId = row.querySelector(".bl-id")?.textContent?.trim() || "this issue";
    if (!confirm("Delete " + issueId + "? This cannot be undone.")) return;

    button.disabled = true;
    button.textContent = "Deleting";

    fetch(row.dataset.deleteUrl, {
        method: "POST",
        headers: {
            "X-CSRFToken": getCsrfToken(),
            "X-Requested-With": "XMLHttpRequest"
        }
    })
        .then((response) => {
            if (!response.ok) throw new Error("Delete failed");
            removeCheckedBacklogId(row.dataset.taskId);
            row.remove();
            updateBacklogIssueCounts();
            ensureBacklogEmptyState();
            applyBacklogFilters();
        })
        .catch(() => {
            button.disabled = false;
            button.textContent = "Delete";
            alert("Could not delete the backlog issue. Please try again.");
        });
}

document.addEventListener("DOMContentLoaded", initBacklogChecks);
