import "temporal-polyfill/global";
import { createCalendar, createViewWeek, createViewDay, createViewMonthGrid, createViewList } from "@schedule-x/calendar";
import { createCalendarControlsPlugin } from "@schedule-x/calendar-controls";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import { createScrollControllerPlugin } from "@schedule-x/scroll-controller";

let selectedRange = null;
let selectedTimeType = "available";
let calendarInstance = null;
let calendarControls = null;
let eventsService = null;
let calendarRange = null;
let scrollController = null;
let calendarDebug = false;
let memberNameById = {};
let autoSyncTimer = null;
let calendarReady = false;
let pendingScrollTime = null;

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
  if (window.__SXCAL__ && window.__SXCAL__.setTheme) {
    window.__SXCAL__.setTheme(theme);
  }
}

window.setTheme = setTheme;

function copyText(text) {
  if (!text) return;
  navigator.clipboard.writeText(text);
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
      if (eventsService) {
        eventsService.set([]);
        eventsService.setBackgroundEvents([]);
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

async function exportGroupCalendar(groupId) {
  if (window.__DEMO__) {
    showToast("Demo mode • Export disabled", "error");
    return;
  }
  if (!groupId) return;
  try {
    const r = await fetch(`/api/groups/${groupId}/export/google`, { method: "POST" });
    if (!r.ok) {
      const text = await r.text();
      console.error("Export failed:", r.status, text);
      showToast("Export failed. Check permissions.", "error");
      return;
    }
    const j = await r.json();
    if (j && j.ok) {
      showToast("Exported group calendar", "success");
    } else {
      showToast("Export failed. Try again.", "error");
    }
  } catch (e) {
    console.error("Export failed:", e);
    showToast("Export failed. Try again.", "error");
  }
}

window.exportGroupCalendar = exportGroupCalendar;

async function leaveGroup(groupId) {
  if (!groupId) return;
  if (!confirm("Leave this group?")) return;
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
  if (!confirm("Make this member an admin?")) return;
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
window.debugDeleteGroup = function () {
  const groupId = getDebugGroupId();
  if (!groupId) return;
  if (!confirm("Delete this group? This cannot be undone.")) return;
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
window.debugClearAll = function () {
  if (!confirm("Clear all your cached/special/proposal data?")) return;
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

function formatScheduleXDate(value) {
  if (!value) return null;
  if (typeof value === "string") {
    if (value.includes("[")) return Temporal.ZonedDateTime.from(value);
    if (value.endsWith("Z")) {
      return Temporal.ZonedDateTime.from(value.replace("Z", "+00:00[UTC]"));
    }
    return Temporal.ZonedDateTime.from(`${value}[UTC]`);
  }
  if (value instanceof Date) {
    return Temporal.ZonedDateTime.from(value.toISOString().replace("Z", "+00:00[UTC]"));
  }
  return value;
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
      alert("Select a time range on the calendar or fill the form.");
      return;
    }
    startIso = selectedRange.startStr;
    endIso = selectedRange.endStr;
  }

  const kind = selectedTimeType === "blocked" ? "block_off" : "available";
  if (window.__DEMO__) {
    if (eventsService) {
      const startDate = startIso ? new Date(startIso) : selectedRange?.start;
      const endDate = endIso ? new Date(endIso) : selectedRange?.end;
      if (startDate && endDate) {
        eventsService.add({
          id: `demo-special:${Date.now()}`,
          title: kind === "block_off" ? "Blocked" : "Available",
          start: formatScheduleXDate(startDate),
          end: formatScheduleXDate(endDate),
          calendarId: kind === "block_off" ? "blocked" : "available"
        });
        showToast("Demo event added", "success");
      }
    }
    document.getElementById("addTimeDialog")?.close();
    return;
  }
  await fetch(`/api/groups/${groupId}/special`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, start: startIso, end: endIso })
  });
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
      alert("Select a time range on the calendar or fill the form.");
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
  document.getElementById("proposalDialog")?.close();
  if (window.refreshCalendarEvents) await window.refreshCalendarEvents();
}

window.submitProposal = submitProposal;

async function addSpecial(kind) {
  if (window.__DEMO__) {
    if (!eventsService) return;
    const start = selectedRange ? selectedRange.start : new Date();
    const end = selectedRange ? selectedRange.end : new Date(Date.now() + 60 * 60 * 1000);
    eventsService.add({
      id: `special:demo:${Date.now()}`,
      title: kind === "block_off" ? "Blocked" : "Available",
      start: formatScheduleXDate(start),
      end: formatScheduleXDate(end),
      calendarId: kind === "block_off" ? "blocked" : "available"
    });
    showToast("Added time range", "success");
    return;
  }
  if (!selectedRange) {
    alert("Select a time range on the calendar first.");
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
    alert("Select a time range on the calendar first.");
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
    if (window.__SXCAL__ && window.__SXCAL__.setTheme) {
      window.__SXCAL__.setTheme(next);
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
    if (iso.includes("[")) return Temporal.ZonedDateTime.from(iso);
    if (iso.endsWith("Z")) {
      return Temporal.ZonedDateTime.from(iso.replace("Z", "+00:00[UTC]"));
    }
    return Temporal.ZonedDateTime.from(`${iso}[UTC]`);
  }

  function temporalToIso(temporalDateTime) {
    if (!temporalDateTime) return null;
    if (temporalDateTime.toInstant) {
      return temporalDateTime.toInstant().toString();
    }
    if (temporalDateTime.toString) {
      return temporalDateTime.toString();
    }
    return String(temporalDateTime);
  }

  async function loadCalendars() {
    if (isDemo) {
      debugLog("Loading demo calendars");
      return {
        available: { colorName: "available", lightColors: { main: "#0d9488", container: "#ccfbf1", onContainer: "#115e59" }, darkColors: { main: "#2dd4bf", container: "#0b1220", onContainer: "#ccfbf1" } },
        blocked: { colorName: "blocked", lightColors: { main: "#ef4444", container: "#fee2e2", onContainer: "#7f1d1d" }, darkColors: { main: "#f87171", container: "#0b1220", onContainer: "#fee2e2" } },
        proposal: { colorName: "proposal", lightColors: { main: "#f97316", container: "#ffedd5", onContainer: "#7c2d12" }, darkColors: { main: "#fb923c", container: "#0b1220", onContainer: "#ffedd5" } }
      };
    }
    const r = await fetch(`/api/groups/${groupId}/members`);
    const members = await r.json();
    memberNameById = {};
    const calendars = {
      available: { colorName: "available", lightColors: { main: "#0d9488", container: "#ccfbf1", onContainer: "#115e59" }, darkColors: { main: "#2dd4bf", container: "#0b1220", onContainer: "#ccfbf1" } },
      blocked: { colorName: "blocked", lightColors: { main: "#ef4444", container: "#fee2e2", onContainer: "#7f1d1d" }, darkColors: { main: "#f87171", container: "#0b1220", onContainer: "#fee2e2" } },
      proposal: { colorName: "proposal", lightColors: { main: "#f97316", container: "#ffedd5", onContainer: "#7c2d12" }, darkColors: { main: "#fb923c", container: "#0b1220", onContainer: "#ffedd5" } }
    };
    members.forEach((m) => {
      const key = `member${m.user_id}`;
      const color = m.color || "#64748b";
      memberNameById[m.user_id] = m.name || m.email || `Member ${m.user_id}`;
      calendars[key] = {
        colorName: key.toLowerCase(),
        lightColors: { main: color, container: "#eef2ff", onContainer: "#1f2937" },
        darkColors: { main: color, container: "#0b1220", onContainer: "#e2e8f0" }
      };
    });
    debugLog("Loaded calendars", calendars);
    return calendars;
  }

  function mapApiEvents(apiEvents) {
    const normalEvents = [];
    const backgroundEvents = [];
    debugLog("Raw API events", apiEvents);
    apiEvents.forEach((ev) => {
      const start = toZonedDateTime(ev.start);
      const end = toZonedDateTime(ev.end);
      if (!start || !end) return;
      const type = ev.extendedProps?.type;
      if (type === "busy") {
        const userId = ev.extendedProps?.user_id;
        const name = memberNameById[userId] || `Member ${userId || ""}`.trim();
        normalEvents.push({
          id: ev.id,
          title: `Busy - ${name}`,
          start,
          end,
          calendarId: userId ? `member${userId}` : "available"
        });
        return;
      }
      if (type === "special") {
        normalEvents.push({
          id: ev.id,
          title: ev.title || "Special",
          start,
          end,
          calendarId: ev.extendedProps?.kind === "block_off" ? "blocked" : "available"
        });
        return;
      }
      if (type === "proposal") {
        normalEvents.push({
          id: ev.id,
          title: ev.title || "Meetup Proposal",
          start,
          end,
          calendarId: "proposal"
        });
        return;
      }
      normalEvents.push({
        id: ev.id,
        title: ev.title || "Event",
        start,
        end,
        calendarId: "available"
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
    if (!calendarRange) return;
    const data = await fetchEventsForRange(calendarRange.start, calendarRange.end);
    if (eventsService) {
      eventsService.set(data.normalEvents);
      eventsService.setBackgroundEvents(data.backgroundEvents);
    }
  };

  eventsService = createEventsServicePlugin();
  calendarControls = createCalendarControlsPlugin();
  scrollController = createScrollControllerPlugin({ initialScroll: "08:00" });

  const calendars = await loadCalendars();

  function resolveTimezone(raw) {
    if (!raw) return Intl.DateTimeFormat().resolvedOptions().timeZone;
    const cleaned = raw.replace("GMT", "").replace("UTC", "").trim();
    if (cleaned === "+08:00" || cleaned === "+8" || cleaned === "+08") return "Asia/Singapore";
    return raw;
  }

  const calendarTimezone = resolveTimezone(el?.dataset?.timezone || "");

  function demoZdt(offsetDays, hour, minute) {
    const now = Temporal.Now.zonedDateTimeISO(calendarTimezone);
    const base = Temporal.ZonedDateTime.from({
      timeZone: now.timeZoneId,
      year: now.year,
      month: now.month,
      day: now.day,
      hour,
      minute,
      second: 0,
      millisecond: 0
    });
    return base.add({ days: offsetDays });
  }

  const demoEvents = [
    {
      id: "demo-available",
      title: "Available - You",
      start: demoZdt(0, 13, 30),
      end: demoZdt(0, 16, 0),
      calendarId: "available"
    },
    {
      id: "demo-blocked",
      title: "Blocked - Sarah",
      start: demoZdt(0, 18, 0),
      end: demoZdt(0, 20, 0),
      calendarId: "blocked"
    },
    {
      id: "demo-proposal",
      title: "Proposed: Team Lunch",
      start: demoZdt(1, 12, 0),
      end: demoZdt(1, 13, 30),
      calendarId: "proposal"
    }
  ];
  debugLog("Demo events", demoEvents);

  const viewWeek = createViewWeek ? createViewWeek() : null;
  const viewDay = createViewDay ? createViewDay() : null;
  const viewMonth = createViewMonthGrid ? createViewMonthGrid() : null;
  const viewList = createViewList ? createViewList() : null;
  const isMobile = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
  const views = (isMobile ? [viewDay, viewList] : [viewWeek, viewDay, viewMonth, viewList]).filter(Boolean);
  if (!views.length) {
    showToast("Calendar views failed to load.", "error");
    return;
  }
  const plugins = [];
  if (calendarControls) plugins.push(calendarControls);
  if (eventsService) plugins.push(eventsService);
  if (scrollController) plugins.push(scrollController);

  function scrollToFirstEvent(events) {
    if (!scrollController || !events || !events.length) return;
    const sorted = events.slice().sort((a, b) => Temporal.ZonedDateTime.compare(a.start, b.start));
    const first = sorted[0]?.start;
    if (!first) return;
    const hh = String(first.hour).padStart(2, "0");
    const mm = String(first.minute || 0).padStart(2, "0");
    const timeStr = `${hh}:${mm}`;
    if (!calendarReady) {
      pendingScrollTime = timeStr;
      return;
    }
    try {
      scrollController.scrollTo(timeStr);
    } catch (e) {
      pendingScrollTime = timeStr;
    }
  }

  const defaultView = (isMobile ? viewDay : viewWeek) ? (isMobile ? viewDay.name : viewWeek.name) : views[0].name;

  calendarInstance = createCalendar({
    selectedDate: Temporal.Now.plainDateISO(),
    defaultView,
    views,
    calendars,
    events: isDemo ? demoEvents : [],
    callbacks: {
      fetchEvents: async function (range) {
        calendarRange = range;
        debugLog("Range update", range);
        if (isDemo) {
          scrollToFirstEvent(demoEvents);
          return demoEvents;
        }
        const data = await fetchEventsForRange(range.start, range.end);
        if (eventsService) {
          eventsService.setBackgroundEvents([]);
        }
        scrollToFirstEvent(data.normalEvents);
        return data.normalEvents;
      },
      onClickDateTime: function (dateTime) {
        if (!dateTime) return;
        const startInstant = dateTime.toInstant().toString();
        const endInstant = dateTime.add({ hours: 1 }).toInstant().toString();
        selectedRange = {
          start: new Date(startInstant),
          end: new Date(endInstant),
          startStr: startInstant,
          endStr: endInstant
        };
      }
    }
  }, plugins);

  calendarInstance.render(el);
  calendarReady = true;
  if (pendingScrollTime && scrollController) {
    try {
      scrollController.scrollTo(pendingScrollTime);
    } catch (e) {}
    pendingScrollTime = null;
  }
  debugLog("Calendar rendered", calendarInstance);
  window.__SXCAL__ = calendarInstance;

  const themeIsDark = document.documentElement.classList.contains("dark");
  if (calendarInstance.setTheme) {
    calendarInstance.setTheme(themeIsDark ? "dark" : "light");
  }
  if (calendarControls && calendarTimezone) {
    calendarControls.setTimezone(calendarTimezone);
  }

  // Timezone selector removed
});
