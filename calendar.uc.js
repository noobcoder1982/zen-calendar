(() => {
  "use strict";

  const ID = "zen-calendar-mod";

  if (document.getElementById(ID)) return;

  const state = {
    date: new Date(),
    selected: new Date(),
    events: JSON.parse(
      Services.prefs.getStringPref(
        "zen-calendar.events",
        "{}"
      )
    )
  };

  function saveEvents() {
    Services.prefs.setStringPref(
      "zen-calendar.events",
      JSON.stringify(state.events)
    );
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function key(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function monthName(date) {
    return date.toLocaleString("default", {
      month: "long"
    });
  }

  function create(tag, className, text) {
    const el = document.createElement(tag);

    if (className)
      el.className = className;

    if (text !== undefined)
      el.textContent = text;

    return el;
  }

  function render() {
    const root = document.getElementById(ID);

    if (!root)
      return;

    const calendar = root.querySelector(".zc-calendar");
    calendar.replaceChildren();

    const header = create("div", "zc-header");

    const title = create(
      "div",
      "zc-title",
      `${monthName(state.date)} ${state.date.getFullYear()}`
    );

    const controls = create("div", "zc-controls");

    const prev = create("button", "zc-nav", "‹");
    const next = create("button", "zc-nav", "›");

    prev.addEventListener("click", () => {
      state.date.setMonth(state.date.getMonth() - 1);
      render();
    });

    next.addEventListener("click", () => {
      state.date.setMonth(state.date.getMonth() + 1);
      render();
    });

    controls.append(prev, next);
    header.append(title, controls);

    const weekdays = create("div", "zc-weekdays");

    ["S", "M", "T", "W", "T", "F", "S"].forEach(day => {
      weekdays.append(
        create("div", "zc-weekday", day)
      );
    });

    const grid = create("div", "zc-grid");

    const year = state.date.getFullYear();
    const month = state.date.getMonth();

    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);

    for (let i = 0; i < first.getDay(); i++) {
      grid.append(create("div", "zc-day empty"));
    }

    for (let day = 1; day <= last.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateKey = key(date);

      const cell = create(
        "button",
        "zc-day",
        day
      );

      if (
        date.toDateString() ===
        new Date().toDateString()
      ) {
        cell.classList.add("today");
      }

      if (
        date.toDateString() ===
        state.selected.toDateString()
      ) {
        cell.classList.add("selected");
      }

      if (state.events[dateKey]) {
        cell.classList.add("has-event");

        const dot = create("span", "zc-event-dot");
        cell.append(dot);
      }

      cell.addEventListener("click", () => {
        state.selected = date;
        renderAgenda();
        render();
      });

      grid.append(cell);
    }

    calendar.append(
      header,
      weekdays,
      grid
    );

    renderAgenda();
  }

  function renderAgenda() {
    const root = document.getElementById(ID);

    if (!root)
      return;

    const agenda = root.querySelector(".zc-agenda");

    agenda.replaceChildren();

    const title = create(
      "div",
      "zc-agenda-title",
      state.selected.toLocaleDateString("default", {
        weekday: "long",
        month: "short",
        day: "numeric"
      })
    );

    agenda.append(title);

    const dateKey = key(state.selected);
    const events = state.events[dateKey] || [];

    events.forEach((event, index) => {
      const item = create("div", "zc-event");

      const dot = create("span", "zc-event-dot");

      const text = create(
        "span",
        "zc-event-text",
        event
      );

      const remove = create(
        "button",
        "zc-event-remove",
        "×"
      );

      remove.addEventListener("click", () => {
        state.events[dateKey].splice(index, 1);

        if (!state.events[dateKey].length)
          delete state.events[dateKey];

        saveEvents();
        render();
      });

      item.append(
        dot,
        text,
        remove
      );

      agenda.append(item);
    });

    const add = create(
      "button",
      "zc-add",
      "+ Add event"
    );

    add.addEventListener("click", () => {
      const event = prompt(
        "Event name"
      );

      if (!event)
        return;

      if (!state.events[dateKey])
        state.events[dateKey] = [];

      state.events[dateKey].push(event);

      saveEvents();
      render();
    });

    agenda.append(add);
  }

  function createUI() {
    const sidebar =
      document.querySelector("#zen-sidebar-tabs");

    if (!sidebar)
      return false;

    const existing =
      document.getElementById(ID);

    if (existing)
      return true;

    const root = create(
      "div",
      "",
    );

    root.id = ID;

    const button = create(
      "button",
      "zc-toggle"
    );

    const arrow = create(
      "span",
      "zc-arrow",
      "›"
    );

    const icon = create(
      "span",
      "zc-icon",
      "▦"
    );

    const label = create(
      "span",
      "zc-label",
      "Calendar"
    );

    button.append(
      arrow,
      icon,
      label
    );

    const content = create(
      "div",
      "zc-content"
    );

    const calendar = create(
      "div",
      "zc-calendar"
    );

    const agenda = create(
      "div",
      "zc-agenda"
    );

    content.append(
      calendar,
      agenda
    );

    root.append(
      button,
      content
    );

    button.addEventListener("click", () => {
      root.classList.toggle("expanded");
    });

    sidebar.parentElement.append(root);

    render();

    return true;
  }

  function init() {
    if (createUI())
      return;

    const observer =
      new MutationObserver(() => {
        if (createUI())
          observer.disconnect();
      });

    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true
      }
    );
  }

  if (
    location.href ===
    "chrome://browser/content/browser.xhtml"
  ) {
    init();
  }
})();