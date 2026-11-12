
/*
 * Overall Program Reach — Compact Filter Layout
 */

(function () {
  "use strict";

  const STYLE_ID = "overallControlsStyles";

  const numberFormat = new Intl.NumberFormat("en-US");

  // ==========================================================
  // STYLES
  // ==========================================================

  function addStyles() {
    const previous = document.getElementById(STYLE_ID);

    if (previous) {
      previous.remove();
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      /* ==========================================
         TWO-COLUMN FILTER LAYOUT
         ========================================== */

      .orc-main-row {
        display: grid;
        grid-template-columns:
          minmax(0, 1.55fr)
          minmax(0, 1fr);
        gap: 20px;
        align-items: start;

        width: 100%;
        min-width: 0;
        flex-basis: 100%;
        grid-column: 1 / -1;
      }

      .orc-program-column,
      .orc-county-column {
        min-width: 0;
        width: 100%;
        box-sizing: border-box;
      }

      .orc-county-column {
        padding-left: 19px;
        border-left: 1px solid #e8ddef;
      }

      #overallCountyControls,
      #overallProgramKpis {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        font-family: Arial, Helvetica, sans-serif;
      }

      /* ==========================================
         COUNTY FILTER HEADER
         ========================================== */

      #overallCountyControls {
        position: relative;
        z-index: 30;
      }

      #overallCountyControls h3 {
        margin: 0;

        color: #450084;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 17px;
        font-weight: 700;
        line-height: 1.3;
      }

      #overallCountyControls .orc-description {
        margin: 5px 0 12px;

        color: #77717d;
        font-size: 11px;
        line-height: 1.5;
      }

      #overallCountyControls .orc-controls {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 7px;
      }

      /* ==========================================
         COUNTY SELECT BUTTON
         ========================================== */

      #overallCountyControls .orc-select-wrap {
        position: relative;

        flex: 0 1 176px;
        width: 176px;
        min-width: 150px;
        max-width: 100%;
      }

      #overallCountyControls .orc-select {
        box-sizing: border-box;

        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;

        width: 100%;
        height: 43px;
        padding: 6px 11px;

        border: 1px solid #dfd1ed;
        border-radius: 10px;

        background: #fff;
        color: #450084;

        font-family: inherit;
        text-align: left;
        cursor: pointer;

        transition:
          border-color .15s ease,
          background .15s ease,
          box-shadow .15s ease;
      }

      #overallCountyControls .orc-select:hover {
        border-color: #a98acb;
        background: #fcfaff;
      }

      #overallCountyControls
      .orc-select[aria-expanded="true"],
      #overallCountyControls
      .orc-select:focus-visible {
        outline: none;
        border-color: #7843aa;
        box-shadow:
          0 0 0 3px rgba(69, 0, 132, .08);
      }

      #overallCountyControls .orc-select-copy {
        display: flex;
        flex-direction: column;
        gap: 4px;

        flex: 1;
        min-width: 0;
      }

      #overallCountyControls .orc-select-caption {
        color: #6e528a;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: .075em;
        line-height: 1;
      }

      #overallCountyControls .orc-select-value {
        display: block;

        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;

        color: #450084;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.2;
      }

      #overallCountyControls .orc-chevron {
        width: 14px;
        height: 14px;
        flex-shrink: 0;

        transition: transform .15s ease;
      }

      #overallCountyControls
      .orc-select[aria-expanded="true"]
      .orc-chevron {
        transform: rotate(180deg);
      }

      /* ==========================================
         FLOATING COUNTY MENU
         ========================================== */

      #overallCountyControls .orc-menu {
        position: absolute;
        top: calc(100% + 7px);
        left: 0;
        z-index: 1000;

        box-sizing: border-box;

        width: 325px;
        max-width: calc(100vw - 45px);
        padding: 11px;

        border: 1px solid #dfd1ed;
        border-radius: 12px;

        background: #fff;

        box-shadow:
          0 12px 30px rgba(43, 20, 62, .13),
          0 2px 6px rgba(43, 20, 62, .05);
      }

      #overallCountyControls .orc-menu[hidden] {
        display: none !important;
      }

      #overallCountyControls .orc-menu-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;

        margin-bottom: 9px;
        padding-bottom: 9px;

        border-bottom: 1px solid #f0eaf4;
      }

      #overallCountyControls
      .orc-menu-actions button {
        min-height: 29px;
        padding: 6px 10px;

        border: 1px solid #e4d9ef;
        border-radius: 7px;

        background: #fff;
        color: #450084;

        font-family: inherit;
        font-size: 11px;
        font-weight: 700;

        cursor: pointer;
      }

      #overallCountyControls
      .orc-menu-actions button:hover {
        background: #f6f0fb;
      }

      #overallCountyControls .orc-menu-hint {
        margin: 0 0 8px;

        color: #89808e;
        font-size: 10px;
        line-height: 1.4;
      }

      #overallCountyControls .orc-list {
        display: flex;
        flex-direction: column;
        gap: 3px;

        max-height: 235px;
        overflow-y: auto;
        overscroll-behavior: contain;
      }

      #overallCountyControls .orc-choice {
        display: flex;
        align-items: center;
        gap: 8px;

        min-height: 32px;
        padding: 6px 8px;

        border: 1px solid transparent;
        border-radius: 7px;

        color: #403849;
        font-size: 11px;

        cursor: pointer;
      }

      #overallCountyControls .orc-choice:hover {
        background: #f8f4fc;
      }

      #overallCountyControls
      .orc-choice.is-selected {
        background: #f4ecfb;
        border-color: #e5d6f1;
      }

      #overallCountyControls .orc-choice input {
        width: 14px;
        height: 14px;
        margin: 0;
        flex-shrink: 0;

        accent-color: #450084;
        cursor: pointer;
      }

      #overallCountyControls .orc-choice-name {
        flex: 1;
        min-width: 0;
        font-weight: 600;
      }

      #overallCountyControls .orc-choice-type {
        color: #92879a;
        font-size: 9px;
        white-space: nowrap;
      }

      #overallCountyControls .orc-empty {
        padding: 13px 6px;
        color: #777;
        font-size: 11px;
        line-height: 1.5;
      }

      /* ==========================================
         COMPACT SEARCH
         ========================================== */

      #overallCountyControls .orc-search-wrap {
        position: relative;

        flex: 1 1 145px;
        min-width: 115px;
        max-width: 100%;
      }

      #overallCountyControls .orc-search-icon {
        position: absolute;
        left: 10px;
        top: 50%;

        transform: translateY(-50%);

        width: 14px;
        height: 14px;

        color: #887a95;
        pointer-events: none;
      }

      #overallCountyControls .orc-search {
        box-sizing: border-box;

        width: 100%;
        height: 43px;
        padding: 0 10px 0 31px;

        border: 1px solid #dfd1ed;
        border-radius: 9px;

        outline: none;
        background: #fff;

        color: #3a3043;
        font-family: inherit;
        font-size: 11px;

        transition:
          border-color .15s ease,
          box-shadow .15s ease;
      }

      #overallCountyControls
      .orc-search::placeholder {
        color: #9b91a3;
      }

      #overallCountyControls .orc-search:focus {
        border-color: #7843aa;
        box-shadow:
          0 0 0 3px rgba(69, 0, 132, .08);
      }

      /* ==========================================
         RESET BUTTON
         ========================================== */

      #overallCountyControls .orc-reset-button {
        box-sizing: border-box;

        flex: 0 0 62px;

        height: 43px;
        padding: 0 9px;

        border: 1px solid #dfd1ed;
        border-radius: 9px;

        background: #f8f4fc;
        color: #450084;

        font-family: inherit;
        font-size: 11px;
        font-weight: 700;

        cursor: pointer;
      }

      #overallCountyControls
      .orc-reset-button:hover {
        background: #eee3f7;
      }

      #overallCountyControls button:focus-visible {
        outline: 2px solid #7843aa;
        outline-offset: 2px;
      }

      #overallCountyControls .orc-status {
        margin: 9px 0 0;

        color: #817988;
        font-size: 10px;
        line-height: 1.5;
      }

      /* ==========================================
         KPI SECTION
         ========================================== */

      #overallProgramKpis {
        position: relative;
        z-index: 1;

        width: 100%;
        flex-basis: 100%;
        grid-column: 1 / -1;

        margin-top: 12px;
        padding-top: 12px;

        border-top: 1px solid #e8ddef;
      }

      #overallProgramKpis .orc-kpi-grid {
        display: grid;
        grid-template-columns:
          repeat(6, minmax(0, 1fr));
        gap: 10px;
      }

      #overallProgramKpis .orc-kpi-card {
        box-sizing: border-box;
        position: relative;
        overflow: hidden;

        min-width: 0;
        min-height: 109px;

        padding: 10px 12px;

        border: 1px solid #e2d6ec;
        border-top: 3px solid
          var(--program-color, #450084);
        border-radius: 10px;

        background: #fff;
      }

      /* ==========================================
         KPI CARD TOP ROW
         ========================================== */

      #overallProgramKpis .orc-kpi-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;

        min-height: 22px;
        margin-bottom: 7px;
      }

      #overallProgramKpis .orc-kpi-name {
        display: flex;
        align-items: center;
        gap: 6px;

        min-width: 0;

        color: #554563;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.3;
      }

      #overallProgramKpis .orc-kpi-dot {
        display: inline-block;

        width: 7px;
        height: 7px;
        flex-shrink: 0;

        border-radius: 50%;
      }

      /* ==========================================
         VIEW DETAILS / COMING SOON
         ========================================== */

      #overallProgramKpis .orc-kpi-details {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 3px;

        flex-shrink: 0;

        min-height: 23px;
        padding: 3px 7px;

        box-sizing: border-box;

        border: 1px solid #e2d4ee;
        border-radius: 7px;

        background: #fff;
        color: #450084;

        font-family: Arial, Helvetica, sans-serif;
        font-size: 9px;
        font-weight: 700;
        line-height: 1.2;

        text-decoration: none;
        white-space: nowrap;
      }

      #overallProgramKpis
      a.orc-kpi-details {
        cursor: pointer;
      }

      #overallProgramKpis
      a.orc-kpi-details:hover {
        background: #f4ecfb;
        border-color: #bda0d8;
        color: #450084;
        text-decoration: none;
      }

      #overallProgramKpis
      a.orc-kpi-details:focus-visible {
        outline: 2px solid #7843aa;
        outline-offset: 2px;
      }

      #overallProgramKpis
      .orc-kpi-details.is-disabled {
        border-color: #e9e3ed;
        background: #f6f4f8;
        color: #9a92a3;

        cursor: not-allowed;
        pointer-events: none;
        user-select: none;
      }

      #overallProgramKpis
      .orc-kpi-details svg {
        width: 11px;
        height: 11px;
        flex-shrink: 0;
      }

      /* ==========================================
         KPI VALUES
         ========================================== */

      #overallProgramKpis .orc-kpi-value {
        margin: 0;

        color: #450084;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 25px;
        font-weight: 700;
        line-height: 1.1;
        letter-spacing: -.025em;

        overflow-wrap: anywhere;
      }

      #overallProgramKpis .orc-kpi-label {
        margin-top: 3px;

        color: #77717c;
        font-size: 10px;
        line-height: 1.4;
      }

      #overallProgramKpis .orc-kpi-areas {
        margin-top: 8px;
        padding-top: 7px;

        border-top: 1px solid #eee7f3;

        color: #675a70;
        font-size: 10px;
        line-height: 1.35;
      }

      #overallProgramKpis .orc-kpi-empty {
        grid-column: 1 / -1;

        padding: 13px;

        border: 1px dashed #ded0eb;
        border-radius: 9px;

        color: #777;
        font-size: 11px;
      }

      /* ==========================================
         RESPONSIVE
         ========================================== */

      @media (max-width: 1150px) {
        .orc-main-row {
          grid-template-columns: minmax(0, 1fr);
          gap: 14px;
        }

        .orc-county-column {
          padding-left: 0;
          padding-top: 12px;

          border-left: none;
          border-top: 1px solid #e8ddef;
        }

        #overallCountyControls .orc-search-wrap {
          flex: 0 1 250px;
        }
      }

      @media (max-width: 950px) {
        #overallProgramKpis .orc-kpi-grid {
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
        }
      }

      @media (max-width: 650px) {
        #overallProgramKpis .orc-kpi-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 440px) {
        #overallCountyControls .orc-select-wrap,
        #overallCountyControls .orc-search-wrap {
          flex: 1 1 100%;
          width: 100%;
        }

        #overallCountyControls .orc-menu {
          width: 100%;
          max-width: 100%;
        }

        #overallProgramKpis .orc-kpi-card {
          padding: 9px;
        }

        #overallProgramKpis .orc-kpi-top {
          align-items: flex-start;
          flex-wrap: wrap;
        }

        #overallProgramKpis .orc-kpi-value {
          font-size: 23px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ==========================================================
  // FIND EXISTING PROGRAM FILTER PANEL
  // ==========================================================

  function findFilterPanel(summary) {
    let current = summary.parentElement;

    while (current && current !== document.body) {
      const programCount = current.querySelectorAll(
        "[data-overall-program]"
      ).length;

      const hasHeading = Array.from(
        current.querySelectorAll("h2, h3, h4")
      ).some(function (heading) {
        return /explore program reach/i.test(
          heading.textContent || ""
        );
      });

      if (programCount >= 5 && hasHeading) {
        return current;
      }

      current = current.parentElement;
    }

    return summary.parentElement;
  }

  // ==========================================================
  // INITIALIZATION
  // ==========================================================

  function mount() {
    const api = window.OverallReach;

    const summary = document.getElementById(
      "overallFilterSummary"
    );

    if (!api || !summary) {
      console.warn(
        "[Overall Controls] Missing OverallReach API or filter panel."
      );
      return;
    }

    if (document.getElementById(
      "overallCountyControls"
    )) {
      return;
    }

    addStyles();

    const panel = findFilterPanel(summary);

    // ========================================================
    // COUNTY FILTER HTML
    // ========================================================

    const controls = document.createElement("section");

    controls.id = "overallCountyControls";

    controls.setAttribute(
      "aria-label",
      "County and independent city filters"
    );

    controls.innerHTML = `
      <h3>County / Independent City Filter</h3>

      <p class="orc-description">
        Select locations or search by county / city name.
      </p>

      <div class="orc-controls">

        <div
          id="orcSelectWrap"
          class="orc-select-wrap"
        >

          <button
            id="orcToggle"
            class="orc-select"
            type="button"
            aria-controls="orcMenu"
            aria-expanded="false"
          >
            <span class="orc-select-copy">

              <span class="orc-select-caption">
                COUNTY / CITY
              </span>

              <span
                id="orcToggleText"
                class="orc-select-value"
              >
                All locations
              </span>

            </span>

            <svg
              class="orc-chevron"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6"></path>
            </svg>
          </button>

          <div
            id="orcMenu"
            class="orc-menu"
            hidden
          >

            <div class="orc-menu-actions">

              <button
                id="orcSelectAll"
                type="button"
              >
                Select All
              </button>

              <button
                id="orcClear"
                type="button"
              >
                Clear
              </button>

            </div>

            <p
              id="orcMenuHint"
              class="orc-menu-hint"
            >
              Select one or more counties / cities.
            </p>

            <div
              id="orcOptions"
              class="orc-list"
              role="group"
              aria-label="County and city choices"
            ></div>

          </div>
        </div>

        <div class="orc-search-wrap">

          <svg
            class="orc-search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>

          <input
            id="orcSearch"
            class="orc-search"
            type="search"
            placeholder="Search county / city..."
            aria-label="Search county or independent city"
            autocomplete="off"
          >

        </div>

        <button
          id="orcReset"
          class="orc-reset-button"
          type="button"
        >
          Reset
        </button>

      </div>

      <p
        id="orcStatus"
        class="orc-status"
        aria-live="polite"
      ></p>
    `;

    // ========================================================
    // KPI HTML
    // ========================================================

    const kpis = document.createElement("section");

    kpis.id = "overallProgramKpis";

    kpis.setAttribute(
      "aria-label",
      "Program KPIs"
    );

    kpis.innerHTML = `
      <div
        id="orcKpiGrid"
        class="orc-kpi-grid"
        aria-live="polite"
      ></div>
    `;

    // ========================================================
    // CREATE SIDE-BY-SIDE FILTER LAYOUT
    // ========================================================

    /*
     * Move the existing Program Filter DOM nodes
     * into the left column.
     *
     * Moving DOM nodes preserves their event listeners.
     * This does not recreate or replace the existing
     * program checkboxes, Select All or Clear buttons.
     */

    const mainRow = document.createElement("div");
    mainRow.className = "orc-main-row";

    const programColumn = document.createElement("div");
    programColumn.className = "orc-program-column";

    const countyColumn = document.createElement("div");
    countyColumn.className = "orc-county-column";

    const existingNodes = Array.from(
      panel.childNodes
    );

    existingNodes.forEach(function (node) {
      programColumn.appendChild(node);
    });

    countyColumn.appendChild(controls);

    mainRow.appendChild(programColumn);
    mainRow.appendChild(countyColumn);

    if (
      window.getComputedStyle(panel).display === "flex"
    ) {
      panel.style.flexWrap = "wrap";
    }

    panel.appendChild(mainRow);
    panel.appendChild(kpis);

    // ========================================================
    // ELEMENT REFERENCES
    // ========================================================

    const selectWrap = document.getElementById(
      "orcSelectWrap"
    );

    const search = document.getElementById(
      "orcSearch"
    );

    const toggle = document.getElementById(
      "orcToggle"
    );

    const toggleText = document.getElementById(
      "orcToggleText"
    );

    const reset = document.getElementById(
      "orcReset"
    );

    const menu = document.getElementById(
      "orcMenu"
    );

    const options = document.getElementById(
      "orcOptions"
    );

    const status = document.getElementById(
      "orcStatus"
    );

    const grid = document.getElementById(
      "orcKpiGrid"
    );

    const selectAll = document.getElementById(
      "orcSelectAll"
    );

    const clear = document.getElementById(
      "orcClear"
    );

    const menuHint = document.getElementById(
      "orcMenuHint"
    );

    // Empty selection means no county restriction.
    const selectedIds = new Set();

    // ========================================================
    // SEARCH HELPERS
    // ========================================================

    function normalizedSearch() {
      return search.value
        .trim()
        .toLocaleLowerCase();
    }

    function getAreas() {
      return api.getAreas();
    }

    function getSearchMatches() {
      const query = normalizedSearch();

      return getAreas().filter(function (area) {
        return (
          !query ||
          String(area.name || "")
            .toLocaleLowerCase()
            .includes(query)
        );
      });
    }

    // ========================================================
    // DROPDOWN
    // ========================================================

    function setMenuOpen(open) {
      menu.hidden = !open;

      toggle.setAttribute(
        "aria-expanded",
        String(open)
      );
    }

    function updateToggleLabel() {
      const count = selectedIds.size;

      if (count === 0) {
        toggleText.textContent = "All locations";
        toggle.title = "All counties and cities";
        return;
      }

      if (count === 1) {
        const selectedArea = getAreas().find(
          function (area) {
            return selectedIds.has(area.id);
          }
        );

        const name = selectedArea
          ? selectedArea.name
          : "1 location selected";

        toggleText.textContent = name;
        toggle.title = name;
        return;
      }

      toggleText.textContent =
        `${count} locations selected`;

      toggle.title =
        `${count} counties / cities selected`;
    }

    // ========================================================
    // APPLY FILTERS
    // ========================================================

    function applyFilters() {
      if (api.isReady()) {

        /*
         * Search and selected counties are handled
         * independently.
         *
         * When counties are selected, search only
         * finds additional counties in the dropdown.
         *
         * When nothing is selected, search may
         * filter the map directly.
         */

        const mapSearch =
          selectedIds.size > 0
            ? ""
            : search.value;

        api.setCountyFilter({
          ids: Array.from(selectedIds),
          search: mapSearch
        });
      }

      updateToggleLabel();
      renderStatus();
      renderMetrics();
    }

    // ========================================================
    // RENDER COUNTY CHOICES
    // ========================================================

    function renderChoices() {
      options.replaceChildren();

      if (!api.isReady()) {
        const message = document.createElement("p");

        message.className = "orc-empty";

        message.textContent =
          "Loading counties and cities...";

        options.appendChild(message);
        return;
      }

      const matches = getSearchMatches();

      menuHint.textContent = normalizedSearch()
        ? "Select All applies to current search matches."
        : "Select one or more counties / cities.";

      if (!matches.length) {
        const message = document.createElement("p");

        message.className = "orc-empty";

        message.textContent =
          "No matching counties or cities.";

        options.appendChild(message);
        return;
      }

      const fragment =
        document.createDocumentFragment();

      matches.forEach(function (area) {
        const label = document.createElement("label");

        label.className =
          "orc-choice" +
          (
            selectedIds.has(area.id)
              ? " is-selected"
              : ""
          );

        const checkbox = document.createElement(
          "input"
        );

        checkbox.type = "checkbox";
        checkbox.value = area.id;
        checkbox.checked = selectedIds.has(area.id);

        const name = document.createElement("span");
        name.className = "orc-choice-name";
        name.textContent = area.name;

        const type = document.createElement("span");
        type.className = "orc-choice-type";

        type.textContent = area.isCity
          ? "Independent City"
          : "County";

        checkbox.addEventListener(
          "change",
          function () {

            if (checkbox.checked) {
              selectedIds.add(area.id);
            } else {
              selectedIds.delete(area.id);
            }

            /*
             * Clear the search after selecting a
             * searched location.
             *
             * Previously selected counties remain
             * in selectedIds.
             */

            if (normalizedSearch()) {
              search.value = "";
              setMenuOpen(false);
            }

            renderChoices();
            applyFilters();
          }
        );

        label.appendChild(checkbox);
        label.appendChild(name);
        label.appendChild(type);

        fragment.appendChild(label);
      });

      options.appendChild(fragment);
    }

    // ========================================================
    // FILTER STATUS
    // ========================================================

    function renderStatus() {
      if (!api.isReady()) {
        status.textContent =
          "Loading geographic data...";
        return;
      }

      const total = getAreas().length;
      const matches = getSearchMatches().length;
      const reached = api.getMatchingAreaCount();

      const parts = [];

      if (selectedIds.size) {
        parts.push(
          `${selectedIds.size} locations selected`
        );
      } else {
        parts.push(
          `${total} locations available`
        );
      }

      if (normalizedSearch()) {
        parts.push(
          `${matches} search matches`
        );
      }

      parts.push(
        `${reached} locations reached`
      );

      status.textContent = parts.join(" · ");
    }

    // ========================================================
    // DETAILS BUTTON
    // ========================================================

    function makeDetailsControl(metric) {
      const programId = String(
        metric.id || ""
      ).trim();

      const isPlacements =
        programId.toLocaleLowerCase() ===
        "placements";

      /*
       * Only Placements has an active link.
       *
       * The existing OverallReach method uses
       * the same detailURL() function as the
       * Location Details panel.
       */

      if (
        isPlacements &&
        typeof api.getProgramDetailURL === "function"
      ) {
        const detailUrl =
          api.getProgramDetailURL(programId);

        if (detailUrl) {
          const link = document.createElement("a");

          link.className = "orc-kpi-details";
          link.textContent = "View Details";

          link.href = detailUrl;

          // Open in a NEW tab.
          link.target = "_blank";
          link.rel = "noopener noreferrer";

          link.setAttribute(
            "aria-label",
            "View Placements details in a new tab"
          );

          const arrow = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
          );

          arrow.setAttribute(
            "viewBox",
            "0 0 24 24"
          );

          arrow.setAttribute("fill", "none");
          arrow.setAttribute(
            "stroke",
            "currentColor"
          );
          arrow.setAttribute(
            "stroke-width",
            "2"
          );
          arrow.setAttribute(
            "stroke-linecap",
            "round"
          );
          arrow.setAttribute(
            "stroke-linejoin",
            "round"
          );

          const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
          );

          path.setAttribute(
            "d",
            "M7 17 17 7 M8 7h9v9"
          );

          arrow.appendChild(path);
          link.appendChild(arrow);

          /*
           * Refresh URL immediately before
           * opening the new tab.
           */

          function refreshURL() {
            const currentUrl =
              api.getProgramDetailURL(
                programId
              );

            if (currentUrl) {
              link.href = currentUrl;
            }
          }

          link.addEventListener(
            "pointerdown",
            refreshURL
          );

          link.addEventListener(
            "click",
            refreshURL
          );

          return link;
        }
      }

      /*
       * All other programs show Coming Soon.
       *
       * If Placements has no configured detail URL,
       * its View Details control is also disabled,
       * rather than navigating to an invented URL.
       */

      const disabled = document.createElement(
        "span"
      );

      disabled.className =
        "orc-kpi-details is-disabled";

      disabled.setAttribute(
        "aria-disabled",
        "true"
      );

      if (isPlacements) {
        disabled.textContent = "View Details";
        disabled.title =
          "Placements details link is unavailable.";
      } else {
        disabled.textContent = "Coming Soon";
        disabled.title =
          "Program details are coming soon.";
      }

      return disabled;
    }

    // ========================================================
    // RENDER KPI CARDS
    // ========================================================

    function renderMetrics() {
      grid.replaceChildren();

      // TF_KPI_ACTIVE_COLOR_V1
      const mainTFSelect = document.getElementById(
        "overallTeachingFellowsSubprogram"
      );

      const tfChoice = mainTFSelect?.value || "all";

      const tfColor =
        tfChoice === "Teaching Fellows - Paraprofessionals"
          ? "#147F77"
          : tfChoice === "Teaching Fellows - On-Campus"
            ? "#319A90"
            : "#168F83";

      if (!api.isReady()) {
        const message = document.createElement("p");

        message.className = "orc-kpi-empty";

        message.textContent =
          "Loading program KPIs...";

        grid.appendChild(message);
        return;
      }

      const metrics = api.getProgramMetrics();

      if (!metrics.length) {
        const message = document.createElement("p");

        message.className = "orc-kpi-empty";

        message.textContent =
          "Select a program to view its KPIs.";

        grid.appendChild(message);
        return;
      }

      const fragment =
        document.createDocumentFragment();

      metrics.forEach(function (metric) {

        const isTeachingFellows =
          metric.id === "Teaching Fellows";

        // Card container.

        const card = document.createElement(
          "article"
        );

        card.className = "orc-kpi-card";

        card.style.setProperty(
          "--program-color",
          isTeachingFellows ? tfColor : metric.color
        );

        // Top row.

        const top = document.createElement(
          "div"
        );

        top.className = "orc-kpi-top";

        const name = document.createElement(
          "div"
        );

        name.className = "orc-kpi-name";

        const dot = document.createElement(
          "span"
        );

        dot.className = "orc-kpi-dot";

        dot.style.backgroundColor =
          isTeachingFellows ? tfColor : metric.color;

        const programName =
          document.createElement("span");

        programName.textContent = metric.id;

        name.appendChild(dot);
        name.appendChild(programName);

        top.appendChild(name);

        // View Details / Coming Soon.

        if (isTeachingFellows) {
          const tfKpiSelect =
            document.createElement("select");

          tfKpiSelect.className =
            "orc-tf-kpi-select";

          tfKpiSelect.setAttribute(
            "aria-label",
            "Teaching Fellows KPI subprogram"
          );

          tfKpiSelect.title =
            "Teaching Fellows subprogram";

          tfKpiSelect.style.cssText = [
            "width:104px",
            "max-width:60%",
            "min-width:0",
            "height:24px",
            "padding:0 4px",
            "font-size:9px",
            "font-weight:700",
            "border:1px solid #dfd5e9",
            "border-radius:7px",
            "background:#fff",
            "cursor:pointer",
            "box-sizing:border-box"
          ].join(";");

          const choices = [
            ["all", "All"],
            [
              "Teaching Fellows - Paraprofessionals",
              "Paraprofessionals"
            ],
            [
              "Teaching Fellows - On-Campus",
              "On-Campus"
            ]
          ];

          choices.forEach(function ([choice, label]) {
            const option =
              document.createElement("option");

            option.value = choice;
            option.textContent = label;

            tfKpiSelect.appendChild(option);
          });

          tfKpiSelect.value = tfChoice;
          tfKpiSelect.style.color = tfColor;

          tfKpiSelect.addEventListener(
            "change",
            function () {
              const mainSelect =
                document.getElementById(
                  "overallTeachingFellowsSubprogram"
                );

              if (!mainSelect) {
                return;
              }

              mainSelect.value = tfKpiSelect.value;

              // Reuse the existing main filter event.
              mainSelect.dispatchEvent(
                new Event("change", {
                  bubbles: true
                })
              );

              // Ensure the KPI refreshes even if the
              // existing filter handler does not do so.
              renderMetrics();
            }
          );

          top.appendChild(tfKpiSelect);
        } else {
          top.appendChild(
            makeDetailsControl(metric)
          );
        }

        // Participant count.

        const value = document.createElement(
          "div"
        );

        value.className = "orc-kpi-value";

        if (isTeachingFellows) {
          value.style.color = tfColor;
        }

        value.textContent =
          numberFormat.format(
            Number(metric.participants) || 0
          );

        // Participant label.

        const label = document.createElement(
          "div"
        );

        label.className = "orc-kpi-label";
        label.textContent = "Participants";

        // Reached counties / cities.

        const areas = document.createElement(
          "div"
        );

        areas.className = "orc-kpi-areas";

        areas.textContent =
          numberFormat.format(
            Number(metric.areas) || 0
          ) +
          " counties / cities reached";

        card.appendChild(top);
        card.appendChild(value);
        card.appendChild(label);
        card.appendChild(areas);

        fragment.appendChild(card);
      });

      grid.appendChild(fragment);
    }

    // ========================================================
    // EVENTS
    // ========================================================

    const tfSubfilter = document.getElementById(
      "overallTeachingFellowsSubprogram"
    );

    if (tfSubfilter) {
      tfSubfilter.addEventListener(
        "change",
        function () {
          if (
            typeof api.setTeachingFellowsSubprogram ===
            "function"
          ) {
            api.setTeachingFellowsSubprogram(
              tfSubfilter.value
            );
          }

          applyFilters();
        }
      );
    }

    toggle.addEventListener(
      "click",
      function () {
        setMenuOpen(menu.hidden);
        renderChoices();
      }
    );

    // Search counties / cities.

    search.addEventListener(
      "input",
      function () {
        if (normalizedSearch()) {
          setMenuOpen(true);
        } else {
          setMenuOpen(false);
        }

        renderChoices();
        applyFilters();
      }
    );

    // Select All current matches.

    selectAll.addEventListener(
      "click",
      function () {
        getSearchMatches().forEach(
          function (area) {
            selectedIds.add(area.id);
          }
        );

        if (normalizedSearch()) {
          search.value = "";
          setMenuOpen(false);
        }

        renderChoices();
        applyFilters();
      }
    );

    // Clear county selections only.

    clear.addEventListener(
      "click",
      function () {
        selectedIds.clear();

        renderChoices();
        applyFilters();
      }
    );

    // Reset both search and selections.

    reset.addEventListener(
      "click",
      function () {
        selectedIds.clear();
        search.value = "";

        setMenuOpen(false);

        renderChoices();
        applyFilters();
      }
    );

    // ========================================================
    // CLOSE DROPDOWN WHEN CLICKING OUTSIDE
    // ========================================================

    document.addEventListener(
      "pointerdown",
      function (event) {
        if (
          !menu.hidden &&
          !selectWrap.contains(event.target)
        ) {
          setMenuOpen(false);
        }
      },
      true
    );

    document.addEventListener(
      "focusin",
      function (event) {
        if (
          !menu.hidden &&
          !selectWrap.contains(event.target)
        ) {
          setMenuOpen(false);
        }
      }
    );

    document.addEventListener(
      "keydown",
      function (event) {
        if (
          event.key === "Escape" &&
          !menu.hidden
        ) {
          setMenuOpen(false);
          toggle.focus();
        }
      }
    );

    // ========================================================
    // EXISTING PROGRAM FILTER CALLBACK
    // ========================================================

    window.OverallReachUI = {
      renderMetrics: function () {
        renderMetrics();
        renderStatus();
      }
    };

    // ========================================================
    // MAP DATA READY
    // ========================================================

    window.addEventListener(
      "overall-reach-ready",
      function () {
        renderChoices();
        applyFilters();
      }
    );

    // ========================================================
    // INITIAL RENDER
    // ========================================================

    renderChoices();
    updateToggleLabel();
    renderStatus();
    renderMetrics();

    if (api.isReady()) {
      applyFilters();
    }

    console.info(
      "[Overall Controls] Side-by-side filters ready."
    );
  }

  // ==========================================================
  // START
  // ==========================================================

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      mount,
      { once: true }
    );
  } else {
    mount();
  }

})();
