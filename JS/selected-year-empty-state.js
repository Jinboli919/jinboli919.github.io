(() => {
  "use strict";

  // SELECTED_YEAR_EMPTY_STATE_V1
  // Display a friendly notice only when the selected
  // academic year's actual data file is missing.

  const MESSAGE =
    "Data for the selected academic year is currently unavailable.";

  const path = window.location.pathname;

  const page =
    /\/epp\/epp\.html$/i.test(path)
      ? "epp"
      : /\/placements\.html$/i.test(path)
        ? "placements"
        : /(?:\/|\/index\.html)$/i.test(path)
          ? "home"
          : null;

  if (!page) {
    return;
  }

  const requiredFile =
    page === "placements"
      ? "placements.xlsx"
      : "epp_statistics.csv";

  let active = false;
  let observer = null;
  let requestId = 0;

  function selectedSingleYear() {
    const api = window.AcademicYear;

    if (!api ||
        typeof api.getSelectedYears !== "function") {
      return null;
    }

    if (
      api.isAllHistorical?.() ||
      api.isAllHistoric?.()
    ) {
      return null;
    }

    const years = api.getSelectedYears();

    return Array.isArray(years) && years.length === 1
      ? years[0]
      : null;
  }

  function installStyles() {
    if (document.getElementById(
      "ayEmptyStateStyles"
    )) {
      return;
    }

    const style = document.createElement("style");
    style.id = "ayEmptyStateStyles";

    style.textContent = `
      .ay-empty-notice,
      .ay-empty-filter {
        color: #77717F !important;
        font-size: 12px !important;
        font-weight: 400 !important;
        line-height: 1.55 !important;
        letter-spacing: normal !important;
      }

      .ay-empty-notice {
        margin: 9px 0 14px !important;
      }

      body.ay-empty-year .ay-empty-dash {
        visibility: hidden !important;
      }

      body.ay-empty-year #homeCandidateTotal,
      body.ay-empty-year #homeFemalePercent,
      body.ay-empty-year #homeMalePercent,
      body.ay-empty-year #homeInStatePercent,
      body.ay-empty-year #homeMedianGPA,
      body.ay-empty-year #homeEndorsementCount {
        visibility: hidden !important;
      }

      #placementMapLoading.ay-empty-map {
        color: #77717F !important;
        background: rgba(255,255,255,.96) !important;
        border: 1px solid #E6E0EB !important;
        box-shadow: none !important;
        font-size: 12px !important;
        font-weight: 400 !important;
      }
    `;

    document.head.appendChild(style);
  }

  function addPageNotice() {
    if (page === "placements") {
      return;
    }

    if (document.getElementById(
      "ayEmptyPageNotice"
    )) {
      return;
    }

    const headingText =
      page === "home"
        ? "EPP Candidate Profile"
        : "Candidate characteristics";

    const heading = Array.from(
      document.querySelectorAll("h1,h2,h3,h4")
    ).find(element =>
      element.textContent.trim()
        .toLowerCase()
        .includes(headingText.toLowerCase())
    );

    if (!heading) {
      return;
    }

    const notice = document.createElement("p");

    notice.id = "ayEmptyPageNotice";
    notice.className = "ay-empty-notice";
    notice.textContent = MESSAGE;
    notice.setAttribute("role", "status");

    const next = heading.nextElementSibling;

    const anchor =
      next && next.tagName === "P"
        ? next
        : heading;

    anchor.insertAdjacentElement(
      "afterend",
      notice
    );
  }

  function hideEmptyNumbers() {
    if (page === "home") {
      return;
    }

    const root =
      document.querySelector("main") ||
      document.body;

    for (const element of root.querySelectorAll("*")) {
      if (
        element.children.length === 0 &&
        element.textContent.trim() === "—"
      ) {
        element.classList.add("ay-empty-dash");
      }
    }
  }

  function updatePlacementsNotice() {
    if (page !== "placements") {
      return;
    }

    const root =
      document.querySelector("main") ||
      document.body;

    // Replace the indefinitely displayed loading text.
    for (const element of root.querySelectorAll("*")) {
      if (
        element.children.length === 0 &&
        element.textContent.trim() ===
          "Filters are loading..."
      ) {
        element.textContent = MESSAGE;
        element.classList.add("ay-empty-filter");
      }
    }

    // Replace the map's red error only for a confirmed
    // missing academic-year data file.
    const mapNotice = document.getElementById(
      "placementMapLoading"
    );

    if (mapNotice) {
      if (mapNotice.textContent.trim() !== MESSAGE) {
        mapNotice.textContent = MESSAGE;
      }

      if (mapNotice.hidden) {
        mapNotice.hidden = false;
      }

      if (!mapNotice.classList.contains(
        "ay-empty-map"
      )) {
        mapNotice.classList.add("ay-empty-map");
      }
    }
  }

  function applyEmptyState() {
    if (!active) {
      return;
    }

    document.body.classList.add("ay-empty-year");

    addPageNotice();
    hideEmptyNumbers();
    updatePlacementsNotice();
  }

  function clearEmptyState() {
    active = false;

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    document.body.classList.remove(
      "ay-empty-year"
    );

    document.getElementById(
      "ayEmptyPageNotice"
    )?.remove();

    document.querySelectorAll(
      ".ay-empty-dash"
    ).forEach(element => {
      element.classList.remove("ay-empty-dash");
    });

    document.querySelectorAll(
      ".ay-empty-filter"
    ).forEach(element => {
      if (element.textContent.trim() === MESSAGE) {
        element.textContent =
          "Filters are loading...";
      }

      element.classList.remove(
        "ay-empty-filter"
      );
    });

    const mapNotice = document.getElementById(
      "placementMapLoading"
    );

    if (mapNotice) {
      mapNotice.classList.remove(
        "ay-empty-map"
      );

      if (mapNotice.textContent.trim() === MESSAGE) {
        mapNotice.hidden = true;
      }
    }
  }

  async function refresh() {
    const currentRequest = ++requestId;
    const year = selectedSingleYear();

    if (!year) {
      clearEmptyState();
      return;
    }

    const api = window.AcademicYear;

    const dataPath = api.getDataPath(
      requiredFile,
      year
    );

    let response;

    try {
      response = await fetch(dataPath, {
        method: "HEAD",
        cache: "no-store"
      });
    } catch (error) {
      // Network errors are not proof that the
      // academic-year data is unavailable.
      clearEmptyState();
      return;
    }

    if (currentRequest !== requestId) {
      return;
    }

    const missing =
      response.status === 404 ||
      response.status === 410 ||
      (
        response.ok &&
        response.headers.get("content-length") === "0"
      );

    if (!missing) {
      clearEmptyState();
      return;
    }

    active = true;
    applyEmptyState();

    if (!observer) {
      observer = new MutationObserver(
        applyEmptyState
      );

      observer.observe(document.body, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }
  }

  function initialize() {
    installStyles();
    refresh();

    window.addEventListener(
      "academic-year-changed",
      refresh
    );

    window.addEventListener(
      "pageshow",
      refresh
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
