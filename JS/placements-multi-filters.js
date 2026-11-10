(function () {
    "use strict";

    // ==================================================
    // PLACEMENTS MULTI-SELECT FILTERS
    // Six multi-select fields + ZIP search
    // ==================================================

    const DEFINITIONS = [
        {
            key: "program",
            label: "Program",
            column: "Program",
            all: "All Programs"
        },
        {
            key: "grade",
            label: "Grade Level",
            column: "Grade Level",
            all: "All Grade Levels"
        },
        {
            key: "placementType",
            label: "Placement Type",
            column: "Placement Type",
            all: "All Placement Types"
        },
        {
            key: "division",
            label: "School Division",
            column: "School Division",
            all: "All School Divisions"
        },
        {
            key: "school",
            label: "School Name",
            column: "School Name",
            all: "All Schools"
        },
        {
            key: "county",
            label: "County / City",
            column: null,
            all: "All Locations"
        }
    ];

    const SEARCH_DEFINITIONS = [
        ...DEFINITIONS,
        {
            key: "zip",
            label: "ZIP Code"
        }
    ];

    const selections = {};

    SEARCH_DEFINITIONS.forEach(function (definition) {
        selections[definition.key] = new Set();
    });

    const options = {};

    let root = null;
    let searchInput = null;
    let searchResults = null;
    let chipsContainer = null;

    let onChange = function () {};
    let onReset = function () {};

    let openMenuKey = null;
    let firstSearchMatch = null;

    function clean(value) {
        return String(value ?? "").trim();
    }

    function normalize(value) {
        return clean(value).toLowerCase();
    }

    function normalizeZIP(value) {
        const text = clean(value);

        if (!text) {
            return "";
        }

        const match = text.match(/\d{5}/);

        if (match) {
            return match[0];
        }

        return /^\d{1,4}$/.test(text)
            ? text.padStart(5, "0")
            : text;
    }

    function escapeHTML(value) {
        return clean(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function sortOptions(items) {
        return items.sort(function (a, b) {
            return a.label.localeCompare(
                b.label,
                undefined,
                {
                    numeric: true,
                    sensitivity: "base"
                }
            );
        });
    }

    function getDefinition(key) {
        return SEARCH_DEFINITIONS.find(
            function (definition) {
                return definition.key === key;
            }
        );
    }

    function buildOptions(data, counties) {
        DEFINITIONS.forEach(function (definition) {
            if (definition.key === "county") {
                return;
            }

            const values = new Set();

            data.forEach(function (row) {
                const value = clean(
                    row[definition.column]
                );

                if (value) {
                    values.add(value);
                }
            });

            options[definition.key] = sortOptions(
                Array.from(values).map(
                    function (value) {
                        return {
                            value: value,
                            label: value,
                            type: ""
                        };
                    }
                )
            );
        });

        const countyMap = new Map();

        counties.forEach(function (entry) {
            const props =
                entry.feature.properties || {};

            const code = clean(
                props.GEOID ||
                (
                    clean(props.STATE) +
                    clean(props.COUNTY)
                )
            );

            const name = clean(props.NAME);

            if (!code || !name) {
                return;
            }

            const isCity =
                Number(props.COUNTY) >= 500;

            const suffix = isCity
                ? "city"
                : "County";

            const label =
                new RegExp(
                    "(county|city)$",
                    "i"
                ).test(name)
                    ? name
                    : name + " " + suffix;

            countyMap.set(code, {
                value: code,
                label: label,
                type: isCity
                    ? "Independent City"
                    : "County"
            });
        });

        options.county = sortOptions(
            Array.from(countyMap.values())
        );

        const zips = new Set();

        data.forEach(function (row) {
            const zip = normalizeZIP(
                row["School ZIP Code"]
            );

            if (zip) {
                zips.add(zip);
            }
        });

        options.zip = sortOptions(
            Array.from(zips).map(
                function (zip) {
                    return {
                        value: zip,
                        label: zip,
                        type: ""
                    };
                }
            )
        );
    }

    function installStyles() {
        if (
            document.getElementById(
                "placementsMultiFilterStyles"
            )
        ) {
            return;
        }

        const style = document.createElement(
            "style"
        );

        style.id = "placementsMultiFilterStyles";

        style.textContent = `
            #student-placement-dashboard .filter-panel {
                overflow: visible;
            }

            #student-placement-dashboard .filter-grid {
                display: grid;
                grid-template-columns:
                    repeat(6, minmax(0, 1fr));
                gap: 12px;
                align-items: end;
            }

            #student-placement-dashboard .pmf-field {
                position: relative;
                min-width: 0;
            }

            #student-placement-dashboard .pmf-field.is-open {
                z-index: 50;
            }

            #student-placement-dashboard .pmf-label {
                display: block;
                margin: 0 0 6px;
                font-size: 11px;
                font-weight: 650;
                color: #55515d;
            }

            #student-placement-dashboard .pmf-trigger {
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                width: 100%;
                min-height: 43px;
                padding: 8px 10px;
                border: 1px solid #ded2ed;
                border-radius: 10px;
                background: #fff;
                color: #450084;
                font: inherit;
                font-size: 11px;
                font-weight: 650;
                text-align: left;
                cursor: pointer;
            }

            #student-placement-dashboard .pmf-trigger:hover,
            #student-placement-dashboard .pmf-trigger[aria-expanded="true"] {
                border-color: #8752ba;
                box-shadow: 0 0 0 2px rgba(69,0,132,.07);
            }

            #student-placement-dashboard .pmf-trigger-text {
                min-width: 0;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }

            #student-placement-dashboard .pmf-chevron {
                flex: 0 0 auto;
                font-size: 15px;
                font-weight: 400;
            }

            #student-placement-dashboard .pmf-menu {
                position: absolute;
                top: calc(100% + 7px);
                left: 0;
                width: max(270px, 100%);
                max-width: min(350px, 90vw);
                box-sizing: border-box;
                padding: 11px;
                border: 1px solid #e3d3f0;
                border-radius: 12px;
                background: white;
                box-shadow: 0 12px 28px rgba(45,20,70,.15);
                z-index: 3000;
            }

            #student-placement-dashboard .pmf-menu[hidden],
            #student-placement-dashboard .pmf-results[hidden],
            #student-placement-dashboard .pmf-chips[hidden],
            #student-placement-dashboard .pmf-search-clear[hidden] {
                display: none !important;
            }

            #student-placement-dashboard .pmf-menu-actions {
                display: flex;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 9px;
            }

            #student-placement-dashboard .pmf-small-button {
                padding: 6px 9px;
                border: 1px solid #e3d3f0;
                border-radius: 7px;
                background: white;
                color: #450084;
                font: inherit;
                font-size: 10px;
                font-weight: 650;
                cursor: pointer;
            }

            #student-placement-dashboard .pmf-small-button:hover {
                background: #f4eef9;
            }

            #student-placement-dashboard .pmf-menu-search {
                box-sizing: border-box;
                width: 100%;
                height: 34px;
                margin-bottom: 8px;
                padding: 0 10px;
                border: 1px solid #e3d3f0;
                border-radius: 7px;
                background: #fff;
                font: inherit;
                font-size: 11px;
            }

            #student-placement-dashboard .pmf-options {
                max-height: 235px;
                overflow-y: auto;
            }

            #student-placement-dashboard .pmf-option {
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
                min-height: 32px;
                padding: 7px;
                border: 0;
                border-radius: 7px;
                background: transparent;
                color: #34303b;
                font: inherit;
                font-size: 11px;
                text-align: left;
                cursor: pointer;
            }

            #student-placement-dashboard .pmf-option:hover,
            #student-placement-dashboard .pmf-option[aria-checked="true"] {
                background: #f4eef9;
            }

            #student-placement-dashboard .pmf-check {
                display: grid;
                place-items: center;
                width: 14px;
                height: 14px;
                flex: 0 0 auto;
                border: 1px solid #b5a4c6;
                border-radius: 4px;
                color: transparent;
                font-size: 10px;
            }

            #student-placement-dashboard .pmf-option[aria-checked="true"] .pmf-check {
                border-color: #450084;
                background: #450084;
                color: white;
            }

            #student-placement-dashboard .pmf-option-name {
                min-width: 0;
                flex: 1;
                overflow-wrap: anywhere;
            }

            #student-placement-dashboard .pmf-option-type {
                color: #8d8396;
                font-size: 9px;
            }

            #student-placement-dashboard .pmf-empty {
                padding: 12px 6px;
                color: #8d8396;
                font-size: 11px;
            }

            #student-placement-dashboard .pmf-search-area {
                grid-column: span 2;
                position: relative;
                min-width: 0;
            }

            #student-placement-dashboard .pmf-search-shell {
                display: flex;
                align-items: center;
                gap: 6px;
                height: 43px;
                box-sizing: border-box;
                padding: 0 10px;
                border: 1px solid #ded2ed;
                border-radius: 10px;
                background: white;
            }

            #student-placement-dashboard .pmf-search-shell:focus-within {
                border-color: #8752ba;
                box-shadow: 0 0 0 2px rgba(69,0,132,.07);
            }

            #student-placement-dashboard #dashboardSearch {
                flex: 1;
                min-width: 0;
                width: 100%;
                height: 100%;
                padding: 0;
                border: 0;
                outline: 0;
                background: transparent;
                box-shadow: none;
                font: inherit;
                font-size: 11px;
            }

            #student-placement-dashboard .pmf-search-clear {
                flex: 0 0 auto;
                border: 0;
                background: transparent;
                color: #817789;
                cursor: pointer;
            }

            #student-placement-dashboard .pmf-results {
                position: absolute;
                top: calc(100% + 7px);
                left: 0;
                width: min(390px, 90vw);
                max-height: 290px;
                overflow-y: auto;
                box-sizing: border-box;
                padding: 8px;
                border: 1px solid #e3d3f0;
                border-radius: 12px;
                background: white;
                box-shadow: 0 12px 28px rgba(45,20,70,.15);
                z-index: 3001;
            }

            #student-placement-dashboard .pmf-result {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
                width: 100%;
                padding: 9px;
                border: 0;
                border-radius: 7px;
                background: transparent;
                color: #30283a;
                font: inherit;
                font-size: 11px;
                text-align: left;
                cursor: pointer;
            }

            #student-placement-dashboard .pmf-result:hover,
            #student-placement-dashboard .pmf-result:focus-visible {
                background: #f4eef9;
            }

            #student-placement-dashboard .pmf-result-category {
                flex: 0 0 auto;
                color: #80728c;
                font-size: 9px;
            }

            #student-placement-dashboard .pmf-reset-area {
                min-width: 0;
            }

            #student-placement-dashboard #resetFilters {
                width: 100%;
                min-height: 43px;
                padding: 8px;
                font-size: 11px;
            }

            #student-placement-dashboard .pmf-chips {
                grid-column: span 3;
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 5px;
                min-height: 43px;
            }

            #student-placement-dashboard .pmf-chip {
                max-width: 220px;
                padding: 6px 8px;
                border: 1px solid #e3d3f0;
                border-radius: 7px;
                background: #f8f5fb;
                color: #450084;
                font: inherit;
                font-size: 10px;
                cursor: pointer;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            @media (max-width: 1100px) {
                #student-placement-dashboard .filter-grid {
                    grid-template-columns:
                        repeat(3, minmax(0, 1fr));
                }

                #student-placement-dashboard .pmf-chips {
                    grid-column: 1 / -1;
                }
            }

            @media (max-width: 650px) {
                #student-placement-dashboard .filter-grid {
                    grid-template-columns:
                        repeat(2, minmax(0, 1fr));
                }

                #student-placement-dashboard .pmf-search-area {
                    grid-column: 1 / -1;
                }

                #student-placement-dashboard .pmf-chips {
                    grid-column: 1 / -1;
                }

                #student-placement-dashboard .pmf-menu {
                    width: min(310px, 90vw);
                }
            }
        `;

        document.head.appendChild(style);
    }

    function buildMarkup() {
        const filters = DEFINITIONS.map(
            function (definition) {
                const key = definition.key;

                return `
                    <div class="pmf-field"
                         data-pmf-field="${key}">
                        <span class="pmf-label">
                            ${escapeHTML(definition.label)}
                        </span>

                        <button
                            type="button"
                            class="pmf-trigger"
                            data-pmf-trigger="${key}"
                            aria-expanded="false"
                            aria-label="${escapeHTML(definition.label)} filter"
                        >
                            <span
                                class="pmf-trigger-text"
                                data-pmf-summary="${key}"
                            >
                                ${escapeHTML(definition.all)}
                            </span>

                            <span class="pmf-chevron"
                                  aria-hidden="true">⌄</span>
                        </button>

                        <div
                            class="pmf-menu"
                            data-pmf-menu="${key}"
                            hidden
                        >
                            <div class="pmf-menu-actions">
                                <button
                                    type="button"
                                    class="pmf-small-button"
                                    data-pmf-all="${key}"
                                >Select All</button>

                                <button
                                    type="button"
                                    class="pmf-small-button"
                                    data-pmf-clear="${key}"
                                >Clear</button>
                            </div>

                            <input
                                type="search"
                                class="pmf-menu-search"
                                data-pmf-menu-search="${key}"
                                aria-label="Search ${escapeHTML(definition.label)} options"
                                placeholder="Find an option..."
                                autocomplete="off"
                            >

                            <div
                                class="pmf-options"
                                data-pmf-options="${key}"
                            ></div>
                        </div>
                    </div>
                `;
            }
        ).join("");

        root.innerHTML = `
            ${filters}

            <div class="pmf-search-area">
                <label
                    class="pmf-label"
                    for="dashboardSearch"
                >Search filters / ZIP</label>

                <div class="pmf-search-shell">
                    <span aria-hidden="true">⌕</span>

                    <input
                        type="search"
                        id="dashboardSearch"
                        placeholder="Search an option or ZIP code..."
                        autocomplete="off"
                    >

                    <button
                        type="button"
                        class="pmf-search-clear"
                        data-pmf-search-clear
                        aria-label="Clear search"
                        hidden
                    >×</button>
                </div>

                <div
                    class="pmf-results"
                    id="placementSearchResults"
                    hidden
                ></div>
            </div>

            <div class="pmf-reset-area">
                <span class="pmf-label">Reset</span>

                <button
                    type="button"
                    id="resetFilters"
                    class="reset-button"
                >Reset Filters</button>
            </div>

            <div
                class="pmf-chips"
                id="placementActiveFilterChips"
                hidden
            ></div>
        `;

        searchInput = root.querySelector(
            "#dashboardSearch"
        );

        searchResults = root.querySelector(
            "#placementSearchResults"
        );

        chipsContainer = root.querySelector(
            "#placementActiveFilterChips"
        );
    }

    function getVisibleOptions(key) {
        const input = root.querySelector(
            `[data-pmf-menu-search="${key}"]`
        );

        const query = normalize(
            input ? input.value : ""
        );

        return (options[key] || []).filter(
            function (option) {
                return (
                    !query ||
                    normalize(option.label).includes(query)
                );
            }
        );
    }

    function renderMenu(key) {
        const container = root.querySelector(
            `[data-pmf-options="${key}"]`
        );

        if (!container) {
            return;
        }

        const visible = getVisibleOptions(key);

        if (visible.length === 0) {
            container.innerHTML = `
                <div class="pmf-empty">
                    No matching options
                </div>
            `;

            return;
        }

        container.innerHTML = visible.map(
            function (option) {
                const checked = selections[key].has(
                    option.value
                );

                return `
                    <button
                        type="button"
                        class="pmf-option"
                        role="checkbox"
                        aria-checked="${checked}"
                        data-pmf-option-key="${key}"
                        data-pmf-option-value="${escapeHTML(option.value)}"
                    >
                        <span class="pmf-check">✓</span>

                        <span class="pmf-option-name">
                            ${escapeHTML(option.label)}
                        </span>

                        <span class="pmf-option-type">
                            ${escapeHTML(option.type || "")}
                        </span>
                    </button>
                `;
            }
        ).join("");
    }

    function closeMenus() {
        openMenuKey = null;

        root.querySelectorAll(
            "[data-pmf-menu]"
        ).forEach(function (menu) {
            menu.hidden = true;
        });

        root.querySelectorAll(
            "[data-pmf-trigger]"
        ).forEach(function (button) {
            button.setAttribute(
                "aria-expanded",
                "false"
            );
        });

        root.querySelectorAll(
            ".pmf-field"
        ).forEach(function (field) {
            field.classList.remove("is-open");
        });
    }

    function toggleMenu(key) {
        const alreadyOpen = openMenuKey === key;

        closeMenus();
        hideSearchResults();

        if (alreadyOpen) {
            return;
        }

        openMenuKey = key;

        const menu = root.querySelector(
            `[data-pmf-menu="${key}"]`
        );

        const trigger = root.querySelector(
            `[data-pmf-trigger="${key}"]`
        );

        menu.hidden = false;

        trigger.setAttribute(
            "aria-expanded",
            "true"
        );

        trigger.closest(
            ".pmf-field"
        ).classList.add("is-open");

        renderMenu(key);
    }

    function getOptionLabel(key, value) {
        const match = (options[key] || []).find(
            function (option) {
                return option.value === value;
            }
        );

        return match ? match.label : value;
    }

    function updateSummaries() {
        DEFINITIONS.forEach(function (definition) {
            const values = selections[definition.key];

            const summary = root.querySelector(
                `[data-pmf-summary="${definition.key}"]`
            );

            if (!summary) {
                return;
            }

            if (values.size === 0) {
                summary.textContent = definition.all;
            } else if (values.size === 1) {
                summary.textContent = getOptionLabel(
                    definition.key,
                    Array.from(values)[0]
                );
            } else {
                summary.textContent =
                    `${values.size} selected`;
            }
        });

        const chips = [];

        SEARCH_DEFINITIONS.forEach(
            function (definition) {
                selections[definition.key].forEach(
                    function (value) {
                        chips.push(`
                            <button
                                type="button"
                                class="pmf-chip"
                                data-pmf-remove-key="${definition.key}"
                                data-pmf-remove-value="${escapeHTML(value)}"
                                title="Remove this selection"
                            >
                                ${escapeHTML(definition.label)}:
                                ${escapeHTML(
                                    getOptionLabel(
                                        definition.key,
                                        value
                                    )
                                )}
                                ×
                            </button>
                        `);
                    }
                );
            }
        );

        chipsContainer.hidden = chips.length === 0;
        chipsContainer.innerHTML = chips.join("");
    }

    function hideSearchResults() {
        if (searchResults) {
            searchResults.hidden = true;
        }

        firstSearchMatch = null;
    }

    function clearSearch() {
        searchInput.value = "";

        const clearButton = root.querySelector(
            "[data-pmf-search-clear]"
        );

        clearButton.hidden = true;

        hideSearchResults();
    }

    function notifyChange() {
        clearSearch();
        updateSummaries();

        if (openMenuKey) {
            renderMenu(openMenuKey);
        }

        onChange();
    }

    function renderSearchResults() {
        const query = normalize(searchInput.value);

        root.querySelector(
            "[data-pmf-search-clear]"
        ).hidden = !query;

        if (!query) {
            hideSearchResults();
            return;
        }

        const tokens = query.split(/\s+/).filter(Boolean);
        const matches = [];

        SEARCH_DEFINITIONS.forEach(
            function (definition) {
                (options[definition.key] || []).forEach(
                    function (option) {
                        const searchable = normalize(
                            option.label + " " +
                            definition.label
                        );

                        if (
                            tokens.every(function (token) {
                                return searchable.includes(token);
                            })
                        ) {
                            matches.push({
                                key: definition.key,
                                label: option.label,
                                value: option.value,
                                category: definition.label
                            });
                        }
                    }
                );
            }
        );

        firstSearchMatch = matches[0] || null;

        if (matches.length === 0) {
            searchResults.innerHTML = `
                <div class="pmf-empty">
                    No matching filter options or ZIP codes
                </div>
            `;
        } else {
            searchResults.innerHTML = matches
                .slice(0, 60)
                .map(function (match) {
                    const selected =
                        selections[match.key].has(
                            match.value
                        );

                    return `
                        <button
                            type="button"
                            class="pmf-result"
                            data-pmf-result-key="${match.key}"
                            data-pmf-result-value="${escapeHTML(match.value)}"
                        >
                            <span>
                                ${escapeHTML(match.label)}
                                ${selected ? " ✓" : ""}
                            </span>

                            <span class="pmf-result-category">
                                ${escapeHTML(match.category)}
                            </span>
                        </button>
                    `;
                })
                .join("");
        }

        searchResults.hidden = false;
        closeMenus();
    }

    function addSearchResult(key, value) {
        if (!selections[key]) {
            return;
        }

        selections[key].add(value);
        notifyChange();
    }

    function resetAll() {
        Object.values(selections).forEach(
            function (set) {
                set.clear();
            }
        );

        root.querySelectorAll(
            "[data-pmf-menu-search]"
        ).forEach(function (input) {
            input.value = "";
        });

        closeMenus();
        clearSearch();
        updateSummaries();

        onReset();
    }

    function attachEvents() {
        root.addEventListener(
            "click",
            function (event) {
                const trigger = event.target.closest(
                    "[data-pmf-trigger]"
                );

                if (trigger) {
                    toggleMenu(
                        trigger.dataset.pmfTrigger
                    );
                    return;
                }

                const selectAll = event.target.closest(
                    "[data-pmf-all]"
                );

                if (selectAll) {
                    const key =
                        selectAll.dataset.pmfAll;

                    getVisibleOptions(key).forEach(
                        function (option) {
                            selections[key].add(
                                option.value
                            );
                        }
                    );

                    notifyChange();
                    return;
                }

                const clear = event.target.closest(
                    "[data-pmf-clear]"
                );

                if (clear) {
                    selections[
                        clear.dataset.pmfClear
                    ].clear();

                    notifyChange();
                    return;
                }

                const option = event.target.closest(
                    "[data-pmf-option-key]"
                );

                if (option) {
                    const key =
                        option.dataset.pmfOptionKey;

                    const value =
                        option.dataset.pmfOptionValue;

                    if (selections[key].has(value)) {
                        selections[key].delete(value);
                    } else {
                        selections[key].add(value);
                    }

                    notifyChange();
                    return;
                }

                const result = event.target.closest(
                    "[data-pmf-result-key]"
                );

                if (result) {
                    addSearchResult(
                        result.dataset.pmfResultKey,
                        result.dataset.pmfResultValue
                    );
                    return;
                }

                const remove = event.target.closest(
                    "[data-pmf-remove-key]"
                );

                if (remove) {
                    selections[
                        remove.dataset.pmfRemoveKey
                    ].delete(
                        remove.dataset.pmfRemoveValue
                    );

                    notifyChange();
                    return;
                }

                if (
                    event.target.closest(
                        "[data-pmf-search-clear]"
                    )
                ) {
                    clearSearch();
                    searchInput.focus();
                    return;
                }

                if (
                    event.target.closest(
                        "#resetFilters"
                    )
                ) {
                    resetAll();
                }
            }
        );

        root.addEventListener(
            "input",
            function (event) {
                const menuSearch = event.target.closest(
                    "[data-pmf-menu-search]"
                );

                if (menuSearch) {
                    renderMenu(
                        menuSearch.dataset.pmfMenuSearch
                    );
                }
            }
        );

        searchInput.addEventListener(
            "input",
            renderSearchResults
        );

        searchInput.addEventListener(
            "keydown",
            function (event) {
                if (
                    event.key === "Enter" &&
                    firstSearchMatch
                ) {
                    event.preventDefault();

                    addSearchResult(
                        firstSearchMatch.key,
                        firstSearchMatch.value
                    );
                }

                if (event.key === "Escape") {
                    hideSearchResults();
                }
            }
        );

        document.addEventListener(
            "pointerdown",
            function (event) {
                if (!root.contains(event.target)) {
                    closeMenus();
                    hideSearchResults();
                    return;
                }

                if (
                    !event.target.closest(
                        ".pmf-field"
                    )
                ) {
                    closeMenus();
                }

                if (
                    !event.target.closest(
                        ".pmf-search-area"
                    )
                ) {
                    hideSearchResults();
                }
            }
        );

        document.addEventListener(
            "keydown",
            function (event) {
                if (event.key === "Escape") {
                    closeMenus();
                    hideSearchResults();
                }
            }
        );
    }

    function initialize(config) {
        root = document.querySelector(
            "#student-placement-dashboard .filter-grid"
        );

        if (!root) {
            throw new Error(
                "Placements filter grid not found."
            );
        }

        onChange = config.onChange ||
            function () {};

        onReset = config.onReset ||
            function () {};

        buildOptions(
            config.data || [],
            config.counties || []
        );

        installStyles();
        buildMarkup();
        root.setAttribute("data-pmf-ready", "true");
        attachEvents();

        DEFINITIONS.forEach(function (definition) {
            renderMenu(definition.key);
        });

        updateSummaries();
    }

    function matches(row, resolveCountyID) {
        for (const definition of DEFINITIONS) {
            const selected = selections[
                definition.key
            ];

            if (selected.size === 0) {
                continue;
            }

            let value;

            if (definition.key === "county") {
                const zip = normalizeZIP(
                    row["School ZIP Code"]
                );

                value = resolveCountyID(zip);
            } else {
                value = clean(
                    row[definition.column]
                );
            }

            if (!selected.has(value)) {
                return false;
            }
        }

        if (selections.zip.size > 0) {
            const zip = normalizeZIP(
                row["School ZIP Code"]
            );

            if (!selections.zip.has(zip)) {
                return false;
            }
        }

        return true;
    }

    window.PlacementMultiFilters = {
        initialize: initialize,
        matches: matches,
        resetAll: resetAll
    };

})();
