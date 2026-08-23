// ==UserScript==
// @name           Zen Calendar
// @version        1.3.0
// @description    Interactive sidebar calendar for Zen Browser
// @author         Abh1jeet
// @include        main
// @include        chrome://browser/content/browser.xhtml
// ==/UserScript==

(() => {
  "use strict";

  const ID = "zen-calendar-mod";

  // Prevent multiple initializations in the same window
  if (document.getElementById(ID)) return;

  // Safe preference helper with fallback
  const Prefs = {
    getString(key, defaultVal = "") {
      try {
        if (typeof Services !== "undefined" && Services.prefs) {
          return Services.prefs.getStringPref(key);
        }
      } catch (e) {}
      try {
        const stored = localStorage.getItem(key);
        if (stored !== null) return stored;
      } catch (e) {}
      return defaultVal;
    },
    setString(key, val) {
      try {
        if (typeof Services !== "undefined" && Services.prefs) {
          Services.prefs.setStringPref(key, String(val));
        }
      } catch (e) {}
      try {
        localStorage.setItem(key, String(val));
      } catch (e) {}
    },
    getBool(key, defaultVal = false) {
      try {
        if (typeof Services !== "undefined" && Services.prefs) {
          return Services.prefs.getBoolPref(key);
        }
      } catch (e) {}
      try {
        const stored = localStorage.getItem(key);
        if (stored !== null) return stored === "true";
      } catch (e) {}
      return defaultVal;
    }
  };

  // Helper date utilities
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatDateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function isSameDay(d1, d2) {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  function isToday(date) {
    return isSameDay(date, new Date());
  }

  function monthName(date) {
    return date.toLocaleString("default", { month: "long" });
  }

  function formatAgendaHeader(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const formattedDate = date.toLocaleString("default", {
      weekday: "short",
      month: "short",
      day: "numeric"
    });

    if (isSameDay(date, today)) {
      return `Today · ${formattedDate}`;
    } else if (isSameDay(date, yesterday)) {
      return `Yesterday · ${formattedDate}`;
    } else if (isSameDay(date, tomorrow)) {
      return `Tomorrow · ${formattedDate}`;
    }
    return formattedDate;
  }

  // Load initial demo events if storage is completely empty
  function getInitialEvents() {
    const raw = Prefs.getString("zen-calendar.events", "");
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = pad(now.getMonth() + 1);
    const todayKey = formatDateKey(now);

    const defaultEvents = {
      [todayKey]: [
        { id: "1", time: "10:00 AM", duration: "1h", text: "Project Review", color: "#3b82f6" },
        { id: "2", time: "02:30 PM", duration: "45m", text: "Assignment", color: "#ef4444" },
        { id: "3", time: "07:00 PM", duration: "1h", text: "Gym", color: "#22c55e" }
      ],
      [`${currentYear}-${currentMonth}-01`]: [{ id: "d1", color: "#3b82f6", text: "Planning" }],
      [`${currentYear}-${currentMonth}-13`]: [{ id: "d13", color: "#22c55e", text: "Gym Session" }],
      [`${currentYear}-${currentMonth}-14`]: [{ id: "d14", color: "#22c55e", text: "Cardio" }],
      [`${currentYear}-${currentMonth}-20`]: [{ id: "d20", color: "#ef4444", text: "Project Milestone" }],
      [`${currentYear}-${currentMonth}-21`]: [{ id: "d21", color: "#22c55e", text: "Workout" }],
      [`${currentYear}-${currentMonth}-31`]: [{ id: "d31", color: "#3b82f6", text: "Monthly Review" }]
    };

    return defaultEvents;
  }

  const state = {
    viewDate: new Date(),
    selectedDate: new Date(),
    events: getInitialEvents(),
    showModal: false,
    showMenu: false,
    selectedColor: "#3b82f6",
    suppressRender: false
  };

  function saveEvents() {
    Prefs.setString("zen-calendar.events", JSON.stringify(state.events));
  }

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  // Render Calendar Grid & Header
  function renderCalendar(container) {
    container.replaceChildren();

    // 1. Month Bar
    const monthBar = createEl("div", "zc-month-bar");
    const monthTitle = createEl(
      "div",
      "zc-month-title",
      `${monthName(state.viewDate)} ${state.viewDate.getFullYear()}`
    );
    monthTitle.title = "Click to jump to Today";
    monthTitle.addEventListener("click", () => {
      state.viewDate = new Date();
      state.selectedDate = new Date();
      render();
    });

    const navControls = createEl("div", "zc-nav-controls");
    const prevBtn = createEl("div", "zc-nav-btn", "‹");
    prevBtn.title = "Previous Month";
    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.viewDate.setMonth(state.viewDate.getMonth() - 1);
      render();
    });

    const nextBtn = createEl("div", "zc-nav-btn", "›");
    nextBtn.title = "Next Month";
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.viewDate.setMonth(state.viewDate.getMonth() + 1);
      render();
    });

    navControls.append(prevBtn, nextBtn);
    monthBar.append(monthTitle, navControls);

    // 2. Weekdays Header
    const mondayFirst = Prefs.getBool("zen-calendar.monday-start", false);
    const weekdayLabels = mondayFirst
      ? ["M", "T", "W", "T", "F", "S", "S"]
      : ["S", "M", "T", "W", "T", "F", "S"];

    const weekdaysGrid = createEl("div", "zc-weekdays");
    weekdayLabels.forEach((label) => {
      weekdaysGrid.append(createEl("div", "zc-weekday", label));
    });

    // 3. Days Grid (Full 7x6 / 7x5 month grid with prev & next dates)
    const daysGrid = createEl("div", "zc-days-grid");

    const year = state.viewDate.getFullYear();
    const month = state.viewDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const startOffset = mondayFirst
      ? (firstDayIndex === 0 ? 6 : firstDayIndex - 1)
      : firstDayIndex;

    // Previous month's trailing days
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const date = new Date(year, month - 1, dayNum);
      const cell = createDayCell(date, dayNum, true);
      daysGrid.append(cell);
    }

    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const cell = createDayCell(date, day, false);
      daysGrid.append(cell);
    }

    // Next month's leading days (fill up to complete row / grid)
    const totalRendered = startOffset + daysInMonth;
    const totalCells = totalRendered <= 35 ? 35 : 42;
    const remainingDays = totalCells - totalRendered;

    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      const cell = createDayCell(date, day, true);
      daysGrid.append(cell);
    }

    container.append(monthBar, weekdaysGrid, daysGrid);
  }

  // Create single day cell in grid
  function createDayCell(date, dayNum, isOtherMonth) {
    const cell = createEl("div", "zc-day");
    const numSpan = createEl("span", "zc-day-num", String(dayNum));
    cell.append(numSpan);

    if (isOtherMonth) {
      cell.classList.add("zc-other-month");
    }

    if (isToday(date)) {
      cell.classList.add("zc-today");
    }

    if (isSameDay(date, state.selectedDate)) {
      cell.classList.add("zc-selected");
    }

    const dateKey = formatDateKey(date);
    const dayEvents = state.events[dateKey] || [];
    
    const showDots = Prefs.getBool("zen-calendar.show-event-dots", true);

    if (showDots && dayEvents.length > 0) {
      cell.classList.add("zc-has-events");
      const dotsContainer = createEl("span", "zc-dots-container");
      
      // Render up to 3 dots with their respective colors
      dayEvents.slice(0, 3).forEach((ev) => {
        const dot = createEl("span", "zc-event-dot");
        if (ev.color) {
          dot.style.backgroundColor = ev.color;
        }
        dotsContainer.append(dot);
      });
      cell.append(dotsContainer);
    }

    cell.addEventListener("click", () => {
      state.selectedDate = date;
      if (isOtherMonth) {
        state.viewDate = new Date(date.getFullYear(), date.getMonth(), 1);
      }
      render();
    });

    return cell;
  }

  // Render Agenda list for selected date
  function renderAgenda(container) {
    container.replaceChildren();

    const header = createEl("div", "zc-agenda-header", formatAgendaHeader(state.selectedDate));
    container.append(header);

    const dateKey = formatDateKey(state.selectedDate);
    const dayEvents = state.events[dateKey] || [];

    const list = createEl("div", "zc-event-list");

    if (dayEvents.length === 0) {
      const empty = createEl("div", "zc-empty-agenda", "No events scheduled");
      list.append(empty);
    } else {
      dayEvents.forEach((ev, idx) => {
        const item = createEl("div", "zc-event-item");

        const dot = createEl("span", "zc-event-dot-indicator");
        dot.style.backgroundColor = ev.color || "#3b82f6";

        const info = createEl("div", "zc-event-info");
        const topLine = createEl("div", "zc-event-top-line");

        if (ev.time) {
          const time = createEl("span", "zc-event-time", ev.time);
          topLine.append(time);
        }

        const title = createEl("span", "zc-event-title", ev.text || "Event");
        topLine.append(title);
        info.append(topLine);

        if (ev.duration) {
          const duration = createEl("span", "zc-event-duration", ev.duration);
          info.append(duration);
        }

        const removeBtn = createEl("div", "zc-event-delete", "×");
        removeBtn.title = "Delete event";
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          state.events[dateKey].splice(idx, 1);
          if (state.events[dateKey].length === 0) {
            delete state.events[dateKey];
          }
          saveEvents();
          render();
        });

        item.append(dot, info, removeBtn);
        list.append(item);
      });
    }

    container.append(list);

    // "+ Add event" button
    const addBtn = createEl("div", "zc-add-btn");
    const plusIcon = createEl("span", "zc-add-icon", "+");
    const addLabel = createEl("span", "zc-add-label", "Add event");
    addBtn.append(plusIcon, addLabel);

    addBtn.addEventListener("click", () => {
      state.showModal = true;
      render();
    });

    container.append(addBtn);
  }

  // Render Event Creation Modal Dialog
  function renderModal(root) {
    if (!state.showModal) return;

    const overlay = createEl("div", "zc-modal-overlay");
    const modal = createEl("div", "zc-modal");

    const modalTitle = createEl("div", "zc-modal-title", "Add Event");
    const dateLabel = createEl(
      "div",
      "zc-modal-date",
      state.selectedDate.toLocaleDateString("default", {
        weekday: "short",
        month: "short",
        day: "numeric"
      })
    );

    // Title input
    const titleInput = createEl("input", "zc-modal-input");
    titleInput.type = "text";
    titleInput.placeholder = "Event title (e.g. Project Review)";
    titleInput.autofocus = true;

    // Time & Duration row
    const timeRow = createEl("div", "zc-modal-row");
    const timeInput = createEl("input", "zc-modal-input zc-half-input");
    timeInput.type = "text";
    timeInput.placeholder = "Time (e.g. 10:00 AM)";
    timeInput.value = "10:00 AM";

    const durInput = createEl("input", "zc-modal-input zc-half-input");
    durInput.type = "text";
    durInput.placeholder = "Duration (e.g. 1h, 45m)";
    durInput.value = "1h";

    timeRow.append(timeInput, durInput);

    // Color picker row
    const colorRow = createEl("div", "zc-color-row");
    const colors = [
      { name: "blue", hex: "#3b82f6" },
      { name: "red", hex: "#ef4444" },
      { name: "green", hex: "#22c55e" },
      { name: "orange", hex: "#f59e0b" },
      { name: "purple", hex: "#a855f7" },
      { name: "white", hex: "#ffffff" }
    ];

    colors.forEach((c) => {
      const colorBtn = createEl("div", "zc-color-choice");
      colorBtn.style.backgroundColor = c.hex;
      if (state.selectedColor === c.hex) {
        colorBtn.classList.add("zc-color-active");
      }
      colorBtn.addEventListener("click", () => {
        state.selectedColor = c.hex;
        modal.querySelectorAll(".zc-color-choice").forEach((b) => b.classList.remove("zc-color-active"));
        colorBtn.classList.add("zc-color-active");
      });
      colorRow.append(colorBtn);
    });

    // Actions row
    const actionsRow = createEl("div", "zc-modal-actions");
    const cancelBtn = createEl("div", "zc-btn zc-btn-secondary", "Cancel");
    cancelBtn.addEventListener("click", () => {
      state.showModal = false;
      render();
    });

    const saveBtn = createEl("div", "zc-btn zc-btn-primary", "Save Event");
    const submit = () => {
      const text = titleInput.value.trim();
      if (!text) return;

      const dateKey = formatDateKey(state.selectedDate);
      if (!state.events[dateKey]) {
        state.events[dateKey] = [];
      }

      state.events[dateKey].push({
        id: "ev_" + Date.now(),
        text: text,
        time: timeInput.value.trim(),
        duration: durInput.value.trim(),
        color: state.selectedColor
      });

      saveEvents();
      state.showModal = false;
      render();
    };

    saveBtn.addEventListener("click", submit);
    titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
      if (e.key === "Escape") {
        state.showModal = false;
        render();
      }
    });

    actionsRow.append(cancelBtn, saveBtn);

    modal.append(modalTitle, dateLabel, titleInput, timeRow, colorRow, actionsRow);
    overlay.append(modal);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        state.showModal = false;
        render();
      }
    });

    root.append(overlay);
    setTimeout(() => titleInput.focus(), 50);
  }

  // Render More Options Menu
  function renderMenu(root) {
    if (!state.showMenu) return;

    const menu = createEl("div", "zc-dropdown-menu");

    const todayOpt = createEl("div", "zc-menu-item", "Jump to Today");
    todayOpt.addEventListener("click", () => {
      state.viewDate = new Date();
      state.selectedDate = new Date();
      state.showMenu = false;
      render();
    });

    const addOpt = createEl("div", "zc-menu-item", "Add Event...");
    addOpt.addEventListener("click", () => {
      state.showMenu = false;
      state.showModal = true;
      render();
    });

    const clearOpt = createEl("div", "zc-menu-item zc-menu-danger", "Clear Today's Events");
    clearOpt.addEventListener("click", () => {
      const dateKey = formatDateKey(state.selectedDate);
      if (state.events[dateKey]) {
        delete state.events[dateKey];
        saveEvents();
      }
      state.showMenu = false;
      render();
    });

    menu.append(todayOpt, addOpt, clearOpt);
    root.append(menu);

    // Close menu when clicking outside
    const closeListener = (e) => {
      if (!menu.contains(e.target) && !e.target.closest(".zc-header-more-btn")) {
        state.showMenu = false;
        document.removeEventListener("click", closeListener);
        render();
      }
    };
    setTimeout(() => document.addEventListener("click", closeListener), 10);
  }

  // Main Render Function
  function render() {
    if (state.suppressRender) return;
    
    const root = document.getElementById(ID);
    if (!root) return;

    root.replaceChildren();

    // 1. Sleek Toggle Button (like the native Space Selector)
    const toggleBtn = createEl("div", "zc-toggle");
    const toggleLeft = createEl("div", "zc-toggle-left");
    
    // Add current date highlight (Premium Pill Badge Style)
    const todayStr = new Date().toLocaleDateString("default", { month: "short", day: "numeric" });
    const label = createEl("span", "zc-label");
    label.innerHTML = `Calendar <span class="zc-header-date" style="display: inline-flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--zc-accent) 15%, transparent); color: var(--zc-accent); font-size: 9.5px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.04em; padding: 3px 6px; border-radius: 5px; margin-left: 8px; line-height: 1;">${todayStr}</span>`;
    
    toggleLeft.append(label);

    const moreBtn = createEl("div", "zc-header-more-btn", "···");
    moreBtn.title = "Calendar Options";
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.showMenu = !state.showMenu;
      render();
    });

    toggleBtn.append(toggleLeft, moreBtn);
    root.append(toggleBtn);

    // Toggle expand/collapse when clicking header left-side
    toggleLeft.addEventListener("click", (e) => {
      e.stopPropagation();
      const expanded = root.classList.toggle("expanded");
      Prefs.setString("zen-calendar.start-expanded", String(expanded));
    });

    // 2. Expandable Content container
    const content = createEl("div", "zc-content");

    // Calendar Month & Grid Container
    const calendarContainer = createEl("div", "zc-calendar-container");
    renderCalendar(calendarContainer);
    content.append(calendarContainer);

    // Agenda Section
    const showAgenda = Prefs.getBool("zen-calendar.show-agenda", true);
    if (showAgenda) {
      const agendaContainer = createEl("div", "zc-agenda-container");
      renderAgenda(agendaContainer);
      content.append(agendaContainer);
    }

    root.append(content);

    // 3. Modals & Menus
    renderMenu(root);
    renderModal(root);
  }
  
  // Settings Apply Logic (dynamically read preferences)
  function applySettings() {
    const root = document.getElementById(ID);
    if (!root) return;

    // 1. Enabled
    const enabled = Prefs.getBool("zen-calendar.enabled", true);
    root.style.display = enabled ? "" : "none";
    if (!enabled) return;

    // 2. Compact Calendar
    const compact = Prefs.getBool("zen-calendar.compact", false);
    if (compact) {
      root.classList.add("zc-compact");
    } else {
      root.classList.remove("zc-compact");
    }

    // 3. Accent Color
    const accent = Prefs.getString("zen-calendar.accent", "blue");
    const accentMap = {
      blue: "#3b82f6",
      purple: "#a855f7",
      green: "#22c55e",
      orange: "#f59e0b",
      red: "#ef4444",
      white: "#ffffff"
    };
    
    if (accentMap[accent]) {
      root.style.setProperty("--zc-accent", accentMap[accent]);
    } else {
      root.style.removeProperty("--zc-accent");
    }

    // Trigger full re-render so components (Agenda, Event Dots, Monday Start) pick up the settings
    render();
  }

  // DOM Insertion & Initialization
  function createUI() {
    if (document.getElementById(ID)) return true;

    // Search for ideal insertion targets in Zen Browser sidebar hierarchy
    const spaceIndicator = 
      document.getElementById("zen-current-workspace-indicator-container") ||
      document.querySelector(".zen-current-workspace-indicator") ||
      document.getElementById("zen-workspaces-button") ||
      document.querySelector(".zen-workspace-tabs-section");

    const tabsWrapper = document.querySelector(
      "#zen-sidebar-tabs-wrapper, #zen-sidebar-tabs, #vertical-tabs-box, #tabbrowser-tabs"
    );
    const essentials = document.querySelector("#zen-essentials, #zen-sidebar-top-buttons");
    const sidebar = document.querySelector("#zen-sidebar, #sidebar-box, #navigator-toolbox");

    let targetParent = null;
    let nextSibling = null;

    if (tabsWrapper && tabsWrapper.parentElement) {
      targetParent = tabsWrapper.parentElement;
      nextSibling = tabsWrapper.nextSibling;
    } else if (spaceIndicator && spaceIndicator.parentElement) {
      targetParent = spaceIndicator.parentElement;
      nextSibling = spaceIndicator.nextSibling;
    } else if (essentials && essentials.parentElement) {
      targetParent = essentials.parentElement;
      nextSibling = essentials.nextElementSibling;
    } else if (sidebar) {
      targetParent = sidebar;
      nextSibling = null;
    }

    if (!targetParent) return false;

    const root = createEl("div", "");
    root.id = ID;

    if (nextSibling) {
      targetParent.insertBefore(root, nextSibling);
    } else {
      targetParent.append(root);
    }

    // Set initial expanded state from preference
    const startExpanded = Prefs.getBool("zen-calendar.start-expanded", false);
    if (startExpanded) {
      root.classList.add("expanded");
    }

    // Apply settings runs render() implicitly
    applySettings();
    return true;
  }
  
  // Preferences Observer to detect live Sine setting changes
  const prefObserver = {
    observe(subject, topic, data) {
      if (topic === "nsPref:changed" && data && data.startsWith("zen-calendar.")) {
        applySettings();
      }
    }
  };

  function init() {
    if (createUI()) {
      try {
        if (typeof Services !== "undefined" && Services.prefs) {
          Services.prefs.addObserver("zen-calendar.", prefObserver, false);
        }
      } catch(e) {}
      return;
    }

    // Observe DOM mutations until sidebar is fully mounted
    const observer = new MutationObserver(() => {
      if (createUI()) {
        try {
          if (typeof Services !== "undefined" && Services.prefs) {
            Services.prefs.addObserver("zen-calendar.", prefObserver, false);
          }
        } catch(e) {}
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // Start initialization
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    init();
  } else {
    window.addEventListener("DOMContentLoaded", init, { once: true });
  }
})();