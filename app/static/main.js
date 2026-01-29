import { Calendar } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";

let selectedRange = null;
let selectedTimeType = "available";
let calendarInstance = null;
let calendarRange = null;
let calendarDebug = false;
let memberNameById = {};
let autoSyncTimer = null;
let calendarReady = false;
let pendingScrollTime = null;
let calendarColors = {};

function applyTheme(theme) {
  const root = document.documentElement;
  if (!root) return;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  const sunIcons = document.querySelectorAll("[data-theme-icon='sun']");
  const moonIcons = document.querySelectorAll("[data-theme-icon='moon']");
  if (theme === "dark") {
    sunIcons.forEach(function (icon) { icon.classList.remove("hidden"); });
    moonIcons.forEach(function (icon) { icon.classList.add("hidden"); });
  } else {
    sunIcons.forEach(function (icon) { icon.classList.add("hidden"); });
    moonIcons.forEach(function (icon) { icon.classList.remove("hidden"); });
  }
}

function setTheme(theme) {
  try {
    localStorage.setItem("theme", theme);
  } catch (e) {}
  applyTheme(theme);
  if (calendarInstance) {
    if (theme === "dark") {
      calendarInstance.el.classList.add("fc-theme-dark");
    } else {
      calendarInstance.el.classList.remove("fc-theme-dark");
    }
    calendarInstance.updateSize();
  }
}

window.setTheme = setTheme;

function copyText(text) {
  if (!text) return;
  navigator.clipboard.writeText(text);
}

let dialogResolve = null;
function showAppDialog(message) {
  const dialog = document.getElementById("appDialog");
  const text = document.getElementById("appDialogMessage");
  const okBtn = document.getElementById("appDialogOk");
  const cancelBtn = document.getElementById("appDialogCancel");
  if (!dialog || !text || !okBtn) return;
  text.textContent = message || "";
  okBtn.textContent = "OK";
  dialog.dataset.mode = "alert";
  if (cancelBtn) cancelBtn.classList.add("hidden");
  dialogResolve = null;
  if (dialog.showModal) dialog.showModal();
}

function showAppConfirm(message) {
  return new Promise((resolve) => {
    const dialog = document.getElementById("appDialog");
    const text = document.getElementById("appDialogMessage");
    const okBtn = document.getElementById("appDialogOk");
    const cancelBtn = document.getElementById("appDialogCancel");
    if (!dialog || !text || !okBtn || !cancelBtn) return resolve(false);
    text.textContent = message || "";
    okBtn.textContent = "Confirm";
    dialog.dataset.mode = "confirm";
    cancelBtn.classList.remove("hidden");
    dialogResolve = resolve;
    if (dialog.showModal) dialog.showModal();
  });
}

async function syncMe() {
  if (window.__DEMO__) {
    showToast("Demo mode • Sync simulated", "success");
    return;
  }
  try {
    const r = await fetch("/api/sync/me", { method: "POST" });
    if (!r.ok) {
      const text = await r.text();
      console.error("Sync failed:", r.status, text);
      showToast(`Sync failed (${r.status})`, "error");
      return;
    }
    const j = await r.json();
    if (j && j.ok) {
      showToast(`Synced calendar • ${j.busy_blocks} busy blocks`, "success");
      if (calendarInstance) {
        calendarInstance.removeAllEvents();
      }
      if (window.refreshCalendarEvents) {
        await window.refreshCalendarEvents();
      }
    } else {
      showToast("Sync failed. Try again.", "error");
    }
  } catch (e) {
    console.error("Sync failed:", e);
    showToast("Sync failed. Try again.", "error");
  }
}

// Expose handlers used by inline HTML attributes when bundled as a module.
window.syncMe = syncMe;

function setAutoSync(minutes, options = {}) {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }
  const mins = Number(minutes || 0);
  const silent = options.silent === true;
  try {
    localStorage.setItem("autoSyncMinutes", String(mins));
  } catch (e) {}
  if (mins > 0) {
    autoSyncTimer = setInterval(() => {
      syncMe();
    }, mins * 60 * 1000);
    if (!silent) showToast(`Auto-sync set to every ${mins} minutes`, "success");
  } else {
    if (!silent) showToast("Auto-sync disabled", "success");
  }
}

function setAutoSyncFromDialog() {
  const select = document.getElementById("syncInterval");
  if (!select) return;
  setAutoSync(select.value, { silent: false });
  showToast("Updated sync settings", "success");
}

window.setAutoSyncFromDialog = setAutoSyncFromDialog;

function getSelectedCalendarIds() {
  const container = document.getElementById("syncCalendars");
  if (!container) return [];
  const inputs = Array.from(container.querySelectorAll("input[type='checkbox'][data-calendar-id]"));
  return inputs.filter((input) => input.checked).map((input) => input.getAttribute("data-calendar-id"));
}

async function loadSyncCalendars() {
  const container = document.getElementById("syncCalendars");
  if (!container) return;
  if (window.__DEMO__) {
    container.innerHTML = `
      <label class="calendar-select-item">
        <input type="checkbox" checked disabled data-calendar-id="primary">
        <span class="calendar-select-name">Primary Calendar</span>
      </label>
      <label class="calendar-select-item">
        <input type="checkbox" checked disabled data-calendar-id="work">
        <span class="calendar-select-name">Work</span>
      </label>
      <div class="calendar-select-hint">Demo mode: calendar selection is disabled.</div>
    `;
    return;
  }
  container.innerHTML = `<div class="calendar-select-empty">Loading calendars…</div>`;
  try {
    const r = await fetch("/api/calendars");
    if (!r.ok) {
      container.innerHTML = `<div class="calendar-select-empty">Unable to load calendars.</div>`;
      return;
    }
    const j = await r.json();
    const items = (j && j.calendars) || [];
    if (!items.length) {
      container.innerHTML = `<div class="calendar-select-empty">No calendars found.</div>`;
      return;
    }
    container.innerHTML = items.map((c) => {
      const label = c.primary ? `${c.summary} (Primary)` : c.summary;
      const checked = c.selected ? "checked" : "";
      const disabled = c.accessRole === "none" ? "disabled" : "";
      return `
        <label class="calendar-select-item">
          <input type="checkbox" ${checked} ${disabled} data-calendar-id="${c.id}">
          <span class="calendar-select-name">${label}</span>
        </label>
      `;
    }).join("");
  } catch (e) {
    container.innerHTML = `<div class="calendar-select-empty">Unable to load calendars.</div>`;
  }
}

async function saveCalendarSelection() {
  if (window.__DEMO__) {
    showToast("Demo mode • Selection not saved", "success");
    return;
  }
  const selected = getSelectedCalendarIds();
  if (!selected.length) {
    showToast("Select at least one calendar", "error");
    return;
  }
  try {
    const r = await fetch("/api/calendars/selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendar_ids: selected })
    });
    if (!r.ok) {
      showToast("Unable to save calendars", "error");
      return;
    }
    showToast("Saved calendars", "success");
  } catch (e) {
    showToast("Unable to save calendars", "error");
  }
}

async function saveCalendarsAndSync() {
  await saveCalendarSelection();
  await syncMe();
}

window.saveCalendarSelection = saveCalendarSelection;
window.saveCalendarsAndSync = saveCalendarsAndSync;
window.loadSyncCalendars = loadSyncCalendars;

let __exportPalette = [];
let __exportMembers = [];

function openExportDialog(groupId) {
  if (window.__DEMO__) {
    showToast("Demo mode • Export disabled", "error");
    return;
  }
  const dialog = document.getElementById("exportCalendarDialog");
  if (!dialog) return;
  dialog.dataset.groupId = groupId || "";
  const status = document.getElementById("exportCalendarStatus");
  if (status) status.textContent = "Loading export settings...";
  const list = document.getElementById("exportMemberColors");
  if (list) list.innerHTML = "";
  const createBtn = document.getElementById("exportCreateBtn");
  const updateBtn = document.getElementById("exportUpdateBtn");
  if (createBtn) createBtn.disabled = true;
  if (updateBtn) updateBtn.disabled = true;
  dialog.showModal();
  loadExportOptions(groupId);
}

async function loadExportOptions(groupId) {
  const status = document.getElementById("exportCalendarStatus");
  try {
    const r = await fetch(`/api/groups/${groupId}/export/google/options`);
    if (!r.ok) {
      if (status) status.textContent = "Connect Google Calendar to export.";
      return;
    }
    const data = await r.json();
    if (!data || !data.ok) {
      if (status) status.textContent = "Unable to load export settings.";
      return;
    }
    __exportPalette = data.colors || [];
    __exportMembers = data.members || [];
    const nameInput = document.getElementById("exportCalendarName");
    if (nameInput) nameInput.value = data.calendar?.name || data.defaults?.name || "";
    const tzSelect = document.getElementById("exportCalendarTimezone");
    if (tzSelect && data.calendar?.timezone) {
      tzSelect.value = data.calendar.timezone;
    } else if (tzSelect && data.defaults?.timezone) {
      tzSelect.value = data.defaults.timezone;
    }
    const createBtn = document.getElementById("exportCreateBtn");
    const updateBtn = document.getElementById("exportUpdateBtn");
    const isAdmin = !!data.is_admin;
    const hasSynced = !!data.synced;
    if (createBtn) {
      createBtn.disabled = !isAdmin;
      createBtn.textContent = hasSynced ? "Create new synced calendar" : "Create synced calendar";
      createBtn.onclick = () => submitExportCalendar("create");
    }
    if (updateBtn) {
      updateBtn.disabled = !isAdmin || !hasSynced;
      updateBtn.onclick = () => submitExportCalendar("update");
    }
    if (status) {
      if (!isAdmin) {
        status.textContent = "Only admins can export calendars for this group.";
      } else if (hasSynced) {
        status.textContent = "This group already has a synced calendar. Update it or create a new one.";
      } else {
        status.textContent = "No synced calendar yet. Create one to share the group schedule.";
      }
    }
    renderExportMemberColors();
  } catch (e) {
    console.error("Export options failed:", e);
    if (status) status.textContent = "Unable to load export settings.";
  }
}

function renderExportMemberColors() {
  const list = document.getElementById("exportMemberColors");
  if (!list) return;
  list.innerHTML = "";
  if (!__exportMembers.length) {
    list.innerHTML = "<p class=\"text-sm text-slate-400\">No members found.</p>";
    return;
  }
  __exportMembers.forEach((member) => {
    const row = document.createElement("div");
    row.className = "export-member-row";
    row.dataset.userId = member.user_id;
    row.dataset.selectedColor = member.color_id || "";

    const name = document.createElement("div");
    name.className = "export-member-name";
    name.textContent = member.name || "Member";

    const palette = document.createElement("div");
    palette.className = "export-color-palette";
    __exportPalette.forEach((color) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "export-color-chip";
      btn.style.background = color.background || "#999";
      btn.style.color = color.foreground || "#111";
      btn.dataset.colorId = color.id;
      if (String(color.id) === String(member.color_id)) {
        btn.classList.add("is-selected");
      }
      btn.title = `Color ${color.id}`;
      btn.onclick = () => {
        row.dataset.selectedColor = color.id;
        palette.querySelectorAll(".export-color-chip").forEach((chip) => chip.classList.remove("is-selected"));
        btn.classList.add("is-selected");
      };
      palette.appendChild(btn);
    });

    row.appendChild(name);
    row.appendChild(palette);
    list.appendChild(row);
  });
}

async function submitExportCalendar(action) {
  const dialog = document.getElementById("exportCalendarDialog");
  const groupId = dialog?.dataset.groupId;
  if (!groupId) return;
  const nameInput = document.getElementById("exportCalendarName");
  const tzSelect = document.getElementById("exportCalendarTimezone");
  const inviteMembers = document.getElementById("exportInviteMembers");
  const overwrite = document.getElementById("exportOverwrite");
  const payload = {
    action,
    name: nameInput?.value || "",
    timezone: tzSelect?.value || "",
    invite_members: inviteMembers ? inviteMembers.checked : true,
    overwrite: overwrite ? overwrite.checked : true,
    member_colors: {},
  };
  document.querySelectorAll("#exportMemberColors .export-member-row").forEach((row) => {
    const userId = row.dataset.userId;
    const colorId = row.dataset.selectedColor;
    if (userId && colorId) {
      payload.member_colors[userId] = colorId;
    }
  });
  try {
    const r = await fetch(`/api/groups/${groupId}/export/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const text = await r.text();
      console.error("Export failed:", r.status, text);
      showToast("Export failed. Check permissions.", "error");
      return;
    }
    const j = await r.json();
    if (j && j.ok) {
      showToast(j.created ? "Synced calendar created" : "Synced calendar updated", "success");
      dialog?.close();
    } else {
      showToast("Export failed. Try again.", "error");
    }
  } catch (e) {
    console.error("Export failed:", e);
    showToast("Export failed. Try again.", "error");
  }
}

window.openExportDialog = openExportDialog;
window.exportGroupCalendar = openExportDialog;

async function leaveGroup(groupId) {
  if (!groupId) return;
  const ok = await showAppConfirm("Leave this group?");
  if (!ok) return;
  try {
    const r = await fetch(`/groups/${groupId}/leave`, { method: "POST" });
    if (!r.ok) {
      showToast("Unable to leave group", "error");
      return;
    }
    window.location.reload();
  } catch (e) {
    showToast("Unable to leave group", "error");
  }
}

window.leaveGroup = leaveGroup;

async function regenerateJoinCode(groupId) {
  if (!groupId) return;
  try {
    const r = await fetch(`/groups/${groupId}/join-code/regenerate`, { method: "POST" });
    if (!r.ok) {
      showToast("Unable to regenerate join code", "error");
      return;
    }
    const j = await r.json();
    if (j && j.join_code) {
      const input = document.getElementById("groupJoinCode");
      if (input) input.value = j.join_code;
      showToast("Join code regenerated", "success");
    }
  } catch (e) {
    showToast("Unable to regenerate join code", "error");
  }
}

window.regenerateJoinCode = regenerateJoinCode;

async function promoteMember(groupId, userId) {
  if (!groupId || !userId) return;
  const ok = await showAppConfirm("Make this member an admin?");
  if (!ok) return;
  try {
    const r = await fetch(`/api/groups/${groupId}/members/${userId}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" })
    });
    if (!r.ok) {
      showToast("Unable to update role", "error");
      return;
    }
    showToast("Member promoted to admin", "success");
    window.location.reload();
  } catch (e) {
    showToast("Unable to update role", "error");
  }
}

window.promoteMember = promoteMember;

async function debugPost(url, body) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : "{}"
    });
    if (!r.ok) {
      showToast(`Debug action failed (${r.status})`, "error");
      return false;
    }
    showToast("Debug action complete", "success");
    return true;
  } catch (e) {
    showToast("Debug action failed", "error");
    return false;
  }
}

function getDebugGroupId() {
  const select = document.getElementById("debugGroupSelect");
  if (!select) return null;
  const value = select.value;
  return value ? Number(value) : null;
}

window.debugSyncNow = function () {
  syncMe();
};
window.debugResetCalendarSelection = function () {
  debugPost("/api/debug/reset/calendar-selection");
};
window.debugClearBusy = function () {
  debugPost("/api/debug/clear/busy");
};
window.debugClearSpecials = function () {
  const groupId = getDebugGroupId();
  debugPost("/api/debug/clear/specials", groupId ? { group_id: groupId } : {});
};
window.debugClearProposals = function () {
  const groupId = getDebugGroupId();
  debugPost("/api/debug/clear/proposals", groupId ? { group_id: groupId } : {});
};
window.debugClearInvites = function () {
  const groupId = getDebugGroupId();
  debugPost("/api/debug/clear/invites", groupId ? { group_id: groupId } : {});
};
window.debugLeaveGroup = function () {
  const groupId = getDebugGroupId();
  if (!groupId) return;
  if (!confirm("Leave this group?")) return;
  debugPost("/api/debug/leave/group", { group_id: groupId });
};
window.debugDeleteGroup = async function () {
  const groupId = getDebugGroupId();
  if (!groupId) return;
  const ok = await showAppConfirm("Delete this group? This cannot be undone.");
  if (!ok) return;
  debugPost("/api/debug/delete/group", { group_id: groupId });
};
window.debugOpenGroup = function () {
  const groupId = getDebugGroupId();
  if (!groupId) return;
  window.location.href = `/groups/${groupId}`;
};
window.debugEnsureDemo = function () {
  debugPost("/api/debug/ensure-demo");
};
window.debugClearAll = async function () {
  const ok = await showAppConfirm("Clear all your cached/special/proposal data?");
  if (!ok) return;
  debugPost("/api/debug/clear/all");
};
window.debugClearAutoSync = function () {
  try {
    localStorage.removeItem("autoSyncMinutes");
  } catch (e) {}
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }
  showToast("Auto-sync cleared", "success");
};
window.debugSetTheme = function (theme) {
  setTheme(theme);
};
window.debugClearTheme = function () {
  try {
    localStorage.removeItem("theme");
  } catch (e) {}
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(prefersDark ? "dark" : "light");
  showToast("Theme preference cleared", "success");
};

async function createInvite(groupId) {
  if (window.__DEMO__) {
    const input = document.getElementById("inviteLink");
    if (input) input.value = `${window.location.origin}/invite/demo-token`;
    showToast("Demo invite link created", "success");
    return;
  }
  const days = parseInt(document.getElementById("inviteDays").value || "7", 10);
  const r = await fetch(`/groups/${groupId}/invite/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ days: String(days) })
  });
  const j = await r.json();
  const input = document.getElementById("inviteLink");
  if (input && j.share_url) {
    input.value = j.share_url;
  }
}

window.createInvite = createInvite;

async function copyInviteLink(groupId, btn) {
  const input = document.getElementById("inviteLink");
  let copied = false;
  if (input && input.value) {
    navigator.clipboard.writeText(input.value);
    copied = true;
  } else {
    await createInvite(groupId);
    if (input && input.value) {
      navigator.clipboard.writeText(input.value);
      copied = true;
    }
  }
  if (copied && btn) {
    const copyIcon = btn.querySelector(".copy-icon");
    const checkIcon = btn.querySelector(".check-icon");
    if (copyIcon && checkIcon) {
      copyIcon.classList.add("hidden");
      checkIcon.classList.remove("hidden");
      setTimeout(function () {
        copyIcon.classList.remove("hidden");
        checkIcon.classList.add("hidden");
      }, 2000);
    }
  }
  if (copied) {
    showToast("Copied invite code", "success");
  }
}

window.copyInviteLink = copyInviteLink;

function showToast(message, tone) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  const base =
    "px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 animate-[fadeIn_0.2s_ease]";
  const style =
    tone === "success"
      ? "bg-white/90 backdrop-blur border-green-200 text-green-700 dark:bg-slate-900/90 dark:border-green-500/30 dark:text-green-300"
      : "bg-white/90 backdrop-blur border-red-200 text-red-700 dark:bg-slate-900/90 dark:border-red-500/30 dark:text-red-300";
  toast.className = `${base} ${style}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("opacity-0");
    toast.style.transition = "opacity 0.2s ease";
    setTimeout(() => toast.remove(), 200);
  }, 2400);
}

function copyWithFeedback(btn, text) {
  if (!btn) return;
  navigator.clipboard.writeText(text || "");
  const copyIcon = btn.querySelector(".copy-icon");
  const checkIcon = btn.querySelector(".check-icon");
  if (copyIcon && checkIcon) {
    copyIcon.classList.add("hidden");
    checkIcon.classList.remove("hidden");
    setTimeout(() => {
      copyIcon.classList.remove("hidden");
      checkIcon.classList.add("hidden");
    }, 2000);
  }
  showToast("Copied invite code", "success");
}

function setTimeType(kind) {
  selectedTimeType = kind;
  updateTimeTypeUI();
}

window.setTimeType = setTimeType;

function updateTimeTypeUI() {
  document.querySelectorAll("[data-time-type]").forEach(function (btn) {
    const type = btn.getAttribute("data-time-type");
    if (type === selectedTimeType) {
      btn.classList.add("is-active");
    } else {
      btn.classList.remove("is-active");
    }
  });
}

function buildIso(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const d = new Date(`${dateStr}T${timeStr}`);
  return d.toISOString();
}

function formatCalendarDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  if (value.toString) return new Date(value.toString());
  return new Date(value);
}

async function submitAddTime(groupId) {
  if (!window.__DEMO__ && (!groupId || groupId === 0 || groupId === "0")) {
    showToast("Please log in to add time ranges.", "error");
    return;
  }
  const date = document.getElementById("timeDate")?.value;
  const start = document.getElementById("timeStart")?.value;
  const end = document.getElementById("timeEnd")?.value;
  let startIso = buildIso(date, start);
  let endIso = buildIso(date, end);

  if (!startIso || !endIso) {
    if (!selectedRange) {
      showAppDialog("Select a time range on the calendar or fill the form.");
      return;
    }
    startIso = selectedRange.startStr;
    endIso = selectedRange.endStr;
  }

  const kind = selectedTimeType === "blocked" ? "block_off" : "available";
  if (window.__DEMO__) {
    const startDate = startIso ? new Date(startIso) : selectedRange?.start;
    const endDate = endIso ? new Date(endIso) : selectedRange?.end;
    if (calendarInstance && startDate && endDate) {
      const color = kind === "block_off" ? (calendarColors.blocked || { main: "#ef4444", text: "#fee2e2" }) : (calendarColors.available || { main: "#0d9488", text: "#ccfbf1" });
      calendarInstance.addEvent({
        id: `demo-special-${Date.now()}`,
        title: kind === "block_off" ? "Blocked" : "Available",
        start: formatCalendarDate(startDate),
        end: formatCalendarDate(endDate),
        backgroundColor: color.main,
        borderColor: color.main,
        textColor: color.text,
        extendedProps: { type: "special", kind }
      });
      showToast("Demo event added", "success");
    }
    const timeDateField = document.getElementById("timeDate");
    const timeStartField = document.getElementById("timeStart");
    const timeEndField = document.getElementById("timeEnd");
    if (timeDateField) timeDateField.value = "";
    if (timeStartField) timeStartField.value = "";
    if (timeEndField) timeEndField.value = "";
    selectedRange = null;
    document.getElementById("addTimeDialog")?.close();
    return;
  }
  await fetch(`/api/groups/${groupId}/special`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, start: startIso, end: endIso })
  });
  const timeDateField = document.getElementById("timeDate");
  const timeStartField = document.getElementById("timeStart");
  const timeEndField = document.getElementById("timeEnd");
  if (timeDateField) timeDateField.value = "";
  if (timeStartField) timeStartField.value = "";
  if (timeEndField) timeEndField.value = "";
  selectedRange = null;
  document.getElementById("addTimeDialog")?.close();
  showToast("Added time range", "success");
  if (window.refreshCalendarEvents) await window.refreshCalendarEvents();
}

window.submitAddTime = submitAddTime;


async function submitProposal(groupId) {
  if (!window.__DEMO__ && (!groupId || groupId === 0 || groupId === "0")) {
    showToast("Please log in to propose a meetup.", "error");
    return;
  }
  const date = document.getElementById("proposalDate")?.value;
  const start = document.getElementById("proposalStart")?.value;
  const end = document.getElementById("proposalEnd")?.value;
  let startIso = buildIso(date, start);
  let endIso = buildIso(date, end);

  if (!startIso || !endIso) {
    if (!selectedRange) {
      showAppDialog("Select a time range on the calendar or fill the form.");
      return;
    }
    startIso = selectedRange.startStr;
    endIso = selectedRange.endStr;
  }

  const location = document.getElementById("meetLoc")?.value;
  const description = document.getElementById("meetDesc")?.value;
  const r = await fetch(`/api/groups/${groupId}/proposal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start: startIso, end: endIso, location, description })
  });
  const j = await r.json();
  if (j && Array.isArray(j.conflicts) && j.conflicts.length) {
    const names = j.conflicts.map(function (c) { return c.name || c.email || "member"; });
    showToast(`Conflicts with: ${names.join(", ")}`, "error");
  } else if (j && j.ok) {
    showToast("Meetup proposed", "success");
  }
  const proposalDateField = document.getElementById("proposalDate");
  const proposalStartField = document.getElementById("proposalStart");
  const proposalEndField = document.getElementById("proposalEnd");
  if (proposalDateField) proposalDateField.value = "";
  if (proposalStartField) proposalStartField.value = "";
  if (proposalEndField) proposalEndField.value = "";
  const locField = document.getElementById("meetLoc");
  if (locField) locField.value = "";
  const descField = document.getElementById("meetDesc");
  if (descField) descField.value = "";
  selectedRange = null;
  document.getElementById("proposalDialog")?.close();
  if (window.refreshCalendarEvents) await window.refreshCalendarEvents();
}

window.submitProposal = submitProposal;

async function addSpecial(kind) {
  if (window.__DEMO__) {
    if (!calendarInstance) return;
    const start = selectedRange ? selectedRange.start : new Date();
    const end = selectedRange ? selectedRange.end : new Date(Date.now() + 60 * 60 * 1000);
    const color = kind === "block_off" ? (calendarColors.blocked || { main: "#ef4444", text: "#fee2e2" }) : (calendarColors.available || { main: "#0d9488", text: "#ccfbf1" });
    calendarInstance.addEvent({
      id: `special-demo-${Date.now()}`,
      title: kind === "block_off" ? "Blocked" : "Available",
      start: formatCalendarDate(start),
      end: formatCalendarDate(end),
      backgroundColor: color.main,
      borderColor: color.main,
      textColor: color.text,
      extendedProps: { type: "special", kind }
    });
    showToast("Added time range", "success");
    return;
  }
  if (!selectedRange) {
    showAppDialog("Select a time range on the calendar first.");
    return;
  }
  const r = await fetch(`/api/groups/${window.__GROUP_ID__}/special`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, start: selectedRange.startStr, end: selectedRange.endStr })
  });
  await r.json();
  if (window.refreshCalendarEvents) await window.refreshCalendarEvents();
}

window.addSpecial = addSpecial;

async function proposeMeetup() {
  if (window.__DEMO__) {
    if (!window.__CAL__) return;
    const start = selectedRange ? selectedRange.start : new Date(Date.now() + 2 * 60 * 60 * 1000);
    const end = selectedRange ? selectedRange.end : new Date(Date.now() + 3 * 60 * 60 * 1000);
    window.__CAL__.addEvent({
      title: "Proposed Meetup",
      start,
      end,
      backgroundColor: "rgba(99, 102, 241, 0.2)",
      borderColor: "rgb(99, 102, 241)",
      textColor: "rgb(79, 70, 229)"
    });
    showToast("Demo proposal sent", "success");
    return;
  }
  if (!selectedRange) {
    showAppDialog("Select a time range on the calendar first.");
    return;
  }
  const location = document.getElementById("meetLoc").value;
  const description = document.getElementById("meetDesc").value;

  const r = await fetch(`/api/groups/${window.__GROUP_ID__}/proposal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start: selectedRange.startStr, end: selectedRange.endStr, location, description })
  });
  const j = await r.json();
  if (j && Array.isArray(j.conflicts) && j.conflicts.length) {
    const names = j.conflicts.map(function (c) { return c.name || c.email || "member"; });
    showToast(`Conflicts with: ${names.join(", ")}`, "error");
  } else if (j && j.ok) {
    showToast("Proposal sent", "success");
  }
  window.__CAL__.refetchEvents();
}

document.addEventListener("DOMContentLoaded", async function () {
  window.__DEMO__ = document.body?.dataset?.demo === "1";
  calendarDebug = document.body?.dataset?.calDebug === "1";
  const debugLog = function (...args) {
    if (!calendarDebug) return;
    console.log("[CalendarDebug]", ...args);
  };
  let storedTheme = null;
  try {
    storedTheme = localStorage.getItem("theme");
  } catch (e) {
    storedTheme = null;
  }
  if (storedTheme) {
    applyTheme(storedTheme);
  } else {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }

  const toggle = document.getElementById("themeToggle");
  const toggleMobile = document.getElementById("themeToggleMobile");
  const handleToggle = function () {
    const isDark = document.documentElement.classList.contains("dark");
    const next = isDark ? "light" : "dark";
    try {
      localStorage.setItem("theme", next);
    } catch (e) {}
    applyTheme(next);
    if (calendarInstance) {
      if (next === "dark") {
        calendarInstance.el.classList.add("fc-theme-dark");
      } else {
        calendarInstance.el.classList.remove("fc-theme-dark");
      }
      calendarInstance.updateSize();
    }
  };
  if (toggle) toggle.addEventListener("click", handleToggle);
  if (toggleMobile) toggleMobile.addEventListener("click", handleToggle);

  const syncIntervalSelect = document.getElementById("syncInterval");
  if (syncIntervalSelect) {
    let stored = 0;
    try {
      stored = Number(localStorage.getItem("autoSyncMinutes") || "0");
    } catch (e) {
      stored = 0;
    }
    if (!Number.isNaN(stored)) {
      syncIntervalSelect.value = String(stored);
      if (stored > 0) setAutoSync(stored, { silent: true });
    }
  }

  const mobileToggle = document.getElementById("mobileMenuToggle");
  const mobileMenu = document.getElementById("mobileMenu");
  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener("click", function () {
      mobileMenu.classList.toggle("hidden");
      const openIcon = mobileToggle.querySelector("[data-menu-icon='open']");
      const closeIcon = mobileToggle.querySelector("[data-menu-icon='close']");
      if (openIcon && closeIcon) {
        openIcon.classList.toggle("hidden");
        closeIcon.classList.toggle("hidden");
      }
    });
  }

  document.querySelectorAll("[data-dialog-open]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const targetId = btn.getAttribute("data-dialog-open");
      if (!targetId) return;
      if (targetId === "syncDialog") {
        loadSyncCalendars();
      }
      if (targetId === "addTimeDialog") {
        updateTimeTypeUI();
      }
      const dialog = document.getElementById(targetId);
      if (dialog && dialog.showModal) dialog.showModal();
    });
  });

  document.querySelectorAll("[data-dialog-close]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const dialog = btn.closest("dialog");
      if (dialog && dialog.close) dialog.close();
    });
  });

  document.querySelectorAll("dialog").forEach(function (dialog) {
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog && dialog.close) {
        dialog.close();
      }
    });
  });

  const appDialog = document.getElementById("appDialog");
  const appDialogCancel = document.getElementById("appDialogCancel");
  const appDialogOk = document.getElementById("appDialogOk");
  if (appDialog && appDialogCancel && appDialogOk) {
    appDialogCancel.addEventListener("click", function () {
      if (dialogResolve) dialogResolve(false);
      dialogResolve = null;
      appDialog.close();
    });
    appDialogOk.addEventListener("click", function () {
      if (dialogResolve) dialogResolve(true);
      dialogResolve = null;
      appDialog.close();
    });
  }

  document.addEventListener("click", function (event) {
    const btn = event.target.closest("button");
    if (!btn) return;
    const message = btn.getAttribute("data-toast");
    if (message) showToast(message, "success");
  });

  document.querySelectorAll("[data-copy-btn]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      copyWithFeedback(btn, btn.getAttribute("data-copy-value") || "");
    });
  });

  const params = new URLSearchParams(window.location.search);
  const toast = params.get("toast");
  const name = params.get("name");
  if (toast) {
    if (toast === "settings_saved") showToast("Settings saved", "success");
    if (toast === "group_settings_saved") showToast("Group settings saved", "success");
    if (toast === "group_created") showToast(`Created group "${name || ""}"`.trim(), "success");
    if (toast === "group_joined") showToast(`Joined group "${name || ""}"`.trim(), "success");
    params.delete("toast");
    params.delete("name");
    const newQuery = params.toString();
    const newUrl = `${window.location.pathname}${newQuery ? "?" + newQuery : ""}`;
    window.history.replaceState({}, "", newUrl);
  }

  const el = document.getElementById("calendar");
  if (!el) return;

  const groupId = el.getAttribute("data-group-id");
  const isDemo = el.getAttribute("data-demo") === "1" || groupId === "0";
  window.__DEMO__ = window.__DEMO__ || isDemo;

  function toZonedDateTime(iso) {
    if (!iso) return null;
    return iso;
  }

  function temporalToIso(dateLike) {
    if (!dateLike) return null;
    if (dateLike instanceof Date) return dateLike.toISOString();
    if (typeof dateLike === "string") return dateLike;
    if (dateLike.toISOString) return dateLike.toISOString();
    return String(dateLike);
  }

  async function loadCalendars() {
    if (isDemo) {
      debugLog("Loading demo calendars");
      calendarColors = {
        available: { main: "#0d9488", text: "#ccfbf1" },
        blocked: { main: "#ef4444", text: "#fee2e2" },
        proposal: { main: "#f97316", text: "#ffedd5" }
      };
      return calendarColors;
    }
    const r = await fetch(`/api/groups/${groupId}/members`);
    const members = await r.json();
    memberNameById = {};
    calendarColors = {
      available: { main: "#0d9488", text: "#ccfbf1" },
      blocked: { main: "#ef4444", text: "#fee2e2" },
      proposal: { main: "#f97316", text: "#ffedd5" }
    };
    members.forEach((m) => {
      const key = `member${m.user_id}`;
      const color = m.color || "#64748b";
      memberNameById[m.user_id] = m.name || m.email || `Member ${m.user_id}`;
      calendarColors[key] = {
        main: color,
        text: "#e2e8f0"
      };
    });
    debugLog("Loaded calendars", calendarColors);
    return calendarColors;
  }

  function mapApiEvents(apiEvents) {
    const normalEvents = [];
    const backgroundEvents = [];
    debugLog("Raw API events", apiEvents);
    const normalizeId = (rawId, fallback) => {
      const base = String(rawId || fallback || "");
      if (!base) return `evt_${Math.random().toString(36).slice(2, 10)}`;
      return base.replace(/[^a-zA-Z0-9_-]/g, "_");
    };
    const getColor = (key) => calendarColors[key] || { main: "#64748b", text: "#e2e8f0" };
    apiEvents.forEach((ev) => {
      const start = toZonedDateTime(ev.start);
      const end = toZonedDateTime(ev.end);
      if (!start || !end) return;
      const type = ev.extendedProps?.type;
      if (type === "busy") {
        const userId = ev.extendedProps?.user_id;
        const name = memberNameById[userId] || `Member ${userId || ""}`.trim();
        const color = getColor(userId ? `member${userId}` : "available");
        normalEvents.push({
          id: normalizeId(ev.id, `busy_${userId}_${Date.parse(start) || Date.now()}`),
          title: `Busy - ${name}`,
          start,
          end,
          backgroundColor: color.main,
          borderColor: color.main,
          textColor: color.text,
          extendedProps: { type: "busy" }
        });
        return;
      }
      if (type === "special") {
        const kind = ev.extendedProps?.kind === "block_off" ? "blocked" : "available";
        const color = getColor(kind);
        normalEvents.push({
          id: normalizeId(ev.id, `special_${Date.parse(start) || Date.now()}`),
          title: ev.title || "Special",
          start,
          end,
          backgroundColor: color.main,
          borderColor: color.main,
          textColor: color.text,
          extendedProps: { type: "special", kind: ev.extendedProps?.kind }
        });
        return;
      }
      if (type === "proposal") {
        const color = getColor("proposal");
        normalEvents.push({
          id: normalizeId(ev.id, `proposal_${Date.parse(start) || Date.now()}`),
          title: ev.title || "Meetup Proposal",
          start,
          end,
          backgroundColor: color.main,
          borderColor: color.main,
          textColor: color.text,
          extendedProps: { type: "proposal" }
        });
        return;
      }
      const color = getColor("available");
      normalEvents.push({
        id: normalizeId(ev.id, `event_${Date.parse(start) || Date.now()}`),
        title: ev.title || "Event",
        start,
        end,
        backgroundColor: color.main,
        borderColor: color.main,
        textColor: color.text
      });
    });
    debugLog("Mapped events", { normal: normalEvents.length, background: backgroundEvents.length, normalEvents, backgroundEvents });
    return { normalEvents, backgroundEvents };
  }

  async function fetchEventsForRange(start, end) {
    const startIso = temporalToIso(start);
    const endIso = temporalToIso(end);
    if (!startIso || !endIso) return { normalEvents: [], backgroundEvents: [] };
    debugLog("Fetching events", { start: startIso, end: endIso });
    const url = `/api/groups/${groupId}/events?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`;
    const r = await fetch(url);
    const j = await r.json();
    return mapApiEvents(j || []);
  }

  window.refreshCalendarEvents = async function () {
    if (calendarInstance) {
      calendarInstance.refetchEvents();
    }
  };

  await loadCalendars();

  function resolveTimezone(raw) {
    if (!raw) return "local";
    const trimmed = raw.trim();
    if (trimmed === "UTC" || trimmed === "GMT") return "UTC";
    const offsetMatch = trimmed.match(/^(?:UTC|GMT)\s*([+-]\d{1,2})(?::?(\d{2}))?$/i);
    if (offsetMatch) {
      const sign = offsetMatch[1].startsWith("-") ? "-" : "+";
      const hh = offsetMatch[1].replace("+", "").replace("-", "").padStart(2, "0");
      const mm = (offsetMatch[2] || "00").padStart(2, "0");
      if (mm !== "00") return "UTC";
      const etcSign = sign === "+" ? "-" : "+";
      return `Etc/GMT${etcSign}${parseInt(hh, 10)}`;
    }
    if (/^[+-]\d{1,2}(:?\d{2})?$/.test(trimmed)) {
      const normalized = trimmed.replace(/^([+-]\d{1,2})(\d{2})$/, "$1:$2");
      const parts = normalized.split(":");
      const hh = parts[0].replace("+", "").replace("-", "").padStart(2, "0");
      const sign = parts[0].startsWith("-") ? "-" : "+";
      const mm = (parts[1] || "00").padStart(2, "0");
      if (mm !== "00") return "UTC";
      const etcSign = sign === "+" ? "-" : "+";
      return `Etc/GMT${etcSign}${parseInt(hh, 10)}`;
    }
    return trimmed;
  }

  const calendarTimezone = resolveTimezone(el?.dataset?.timezone || "");

  function demoZdt(offsetDays, hour, minute) {
    const base = new Date();
    base.setHours(hour, minute, 0, 0);
    base.setDate(base.getDate() + offsetDays);
    return base;
  }

  const demoAvailable = calendarColors.available || { main: "#0d9488", text: "#ccfbf1" };
  const demoBlocked = calendarColors.blocked || { main: "#ef4444", text: "#fee2e2" };
  const demoProposal = calendarColors.proposal || { main: "#f97316", text: "#ffedd5" };

  const demoEvents = [
    {
      id: "demo-available",
      title: "Available - You",
      start: demoZdt(0, 13, 30),
      end: demoZdt(0, 16, 0),
      backgroundColor: demoAvailable.main,
      borderColor: demoAvailable.main,
      textColor: demoAvailable.text
    },
    {
      id: "demo-blocked",
      title: "Blocked - Sarah",
      start: demoZdt(0, 18, 0),
      end: demoZdt(0, 20, 0),
      backgroundColor: demoBlocked.main,
      borderColor: demoBlocked.main,
      textColor: demoBlocked.text
    },
    {
      id: "demo-proposal",
      title: "Proposed: Team Lunch",
      start: demoZdt(1, 12, 0),
      end: demoZdt(1, 13, 30),
      backgroundColor: demoProposal.main,
      borderColor: demoProposal.main,
      textColor: demoProposal.text
    }
  ];
  debugLog("Demo events", demoEvents);

  const isMobile = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
  const defaultView = isMobile ? "timeGridDay" : "timeGridWeek";
  const viewButtons = isMobile ? "timeGridDay,listWeek" : "timeGridWeek,timeGridDay,dayGridMonth,listWeek";

  function scrollToFirstEvent(events) {
    if (!calendarInstance || !events || !events.length) return;
    const sorted = events.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
    const first = sorted[0];
    if (!first || !first.start) return;
    const dt = new Date(first.start);
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    const timeStr = `${hh}:${mm}:00`;
    if (!calendarReady) {
      pendingScrollTime = timeStr;
      return;
    }
    try {
      calendarInstance.scrollToTime(timeStr);
    } catch (e) {
      pendingScrollTime = timeStr;
    }
  }

  calendarInstance = new Calendar(el, {
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    initialView: defaultView,
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: viewButtons
    },
    height: "auto",
    nowIndicator: true,
    editable: false,
    selectable: false,
    timeZone: calendarTimezone || "local",
    events: async function (info, successCallback, failureCallback) {
      calendarRange = info;
      debugLog("Range update", info);
      if (isDemo) {
        scrollToFirstEvent(demoEvents);
        successCallback(demoEvents);
        return;
      }
      try {
        const data = await fetchEventsForRange(info.start, info.end);
        scrollToFirstEvent(data.normalEvents);
        successCallback(data.normalEvents);
      } catch (e) {
        failureCallback(e);
      }
    },
    dateClick: function (info) {
      if (!info || !info.date) return;
      const startDate = info.date;
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      selectedRange = {
        start: startDate,
        end: endDate,
        startStr: startDate.toISOString(),
        endStr: endDate.toISOString()
      };
    },
    eventContent: function (arg) {
      const title = arg.event.title || "";
      const timeText = arg.timeText ? `<div class="fc-event-time">${arg.timeText}</div>` : "";
      return { html: `<div class="fc-event-main"><div class="fc-event-title">${title}</div>${timeText}</div>` };
    }
  });

  calendarInstance.render();
  calendarReady = true;
  if (pendingScrollTime && calendarInstance) {
    try {
      calendarInstance.scrollToTime(pendingScrollTime);
    } catch (e) {}
    pendingScrollTime = null;
  }
  debugLog("Calendar rendered", calendarInstance);
  const themeIsDark = document.documentElement.classList.contains("dark");
  if (calendarInstance) {
    calendarInstance.setOption("themeSystem", "standard");
    if (themeIsDark) {
      calendarInstance.el.classList.add("fc-theme-dark");
    } else {
      calendarInstance.el.classList.remove("fc-theme-dark");
    }
    calendarInstance.updateSize();
  }

  // Timezone selector removed
});
