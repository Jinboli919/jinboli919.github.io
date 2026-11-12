
(function () {
    "use strict";

    // ==========================================
    // ACADEMIC YEAR CONFIGURATION
    // ==========================================

    const AVAILABLE_YEARS = [
        "2021-2022",
        "2022-2023",
        "2023-2024",
        "2024-2025",
        "2025-2026"
    ];

    const DEFAULT_YEAR = "2024-2025";

    // Internal value stays "all" to preserve
    // compatibility with existing links.
    const ALL_HISTORICAL = "all";

    // Display label used throughout the website.
    const ALL_HISTORICAL_LABEL =
        "All Historical Data";

    // Actual folder name in Data/.
    const HISTORICAL_FOLDER =
        "all-historical";

    const STORAGE_KEY =
        "coe-dashboard-academic-years";

    const LEGACY_STORAGE_KEY =
        "coe-dashboard-academic-year";

    const nativeFetch = window.fetch.bind(window);

    const pickers = [];

    let openPicker = null;


    // ==========================================
    // LEAFLET MAP DOUBLE-CLICK PROTECTION
    // Preserve existing behavior.
    // ==========================================

    const dashboardMapIds = new Set([
        "map",
        "overallMap"
    ]);

    function isDashboardMapEvent(event) {
        const target = event.target;

        return (
            target instanceof Element &&
            Boolean(
                target.closest("#map, #overallMap")
            )
        );
    }

    document.addEventListener(
        "click",
        function (event) {
            if (
                event.detail >= 2 &&
                isDashboardMapEvent(event)
            ) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        },
        true
    );

    document.addEventListener(
        "dblclick",
        function (event) {
            if (isDashboardMapEvent(event)) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        },
        true
    );

    if (
        window.L &&
        L.Map &&
        typeof L.Map.addInitHook === "function"
    ) {
        L.Map.addInitHook(function () {
            const container = this.getContainer();

            if (
                container &&
                dashboardMapIds.has(container.id) &&
                this.doubleClickZoom
            ) {
                this.doubleClickZoom.disable();
            }
        });
    }


    // ==========================================
    // YEAR VALIDATION
    // ==========================================

    function isValidYear(year) {
        return AVAILABLE_YEARS.includes(year);
    }

    function normalizeSelection(input) {
        let values = [];

        if (Array.isArray(input)) {
            values = input;
        } else if (typeof input === "string") {
            values = input.split(",");
        }

        values = values.map(value =>
            String(value).trim()
        );

        if (values.includes(ALL_HISTORICAL)) {
            return [ALL_HISTORICAL];
        }

        const selected = new Set(
            values.filter(isValidYear)
        );

        return AVAILABLE_YEARS.filter(year =>
            selected.has(year)
        );
    }

    function selectionsEqual(first, second) {
        return (
            JSON.stringify(first) ===
            JSON.stringify(second)
        );
    }


    // ==========================================
    // LOCAL STORAGE
    // ==========================================

    function readStoredSelection() {
        try {
            const saved = localStorage.getItem(
                STORAGE_KEY
            );

            if (saved) {
                const parsed = JSON.parse(saved);

                const normalized =
                    normalizeSelection(parsed);

                if (normalized.length > 0) {
                    return normalized;
                }
            }

            const legacyYear =
                localStorage.getItem(
                    LEGACY_STORAGE_KEY
                );

            if (isValidYear(legacyYear)) {
                return [legacyYear];
            }

        } catch (error) {
            // Continue with default year.
        }

        return [];
    }

    function storeSelection(selection) {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(selection)
            );

            // Preserve compatibility with
            // existing single-year code.
            if (
                selection.length === 1 &&
                isValidYear(selection[0])
            ) {
                localStorage.setItem(
                    LEGACY_STORAGE_KEY,
                    selection[0]
                );
            }

        } catch (error) {
            // Dashboard can work without storage.
        }
    }


    // ==========================================
    // READ SELECTED YEARS
    //
    // Priority:
    // 1. ?years=...
    // 2. ?year=...
    // 3. localStorage
    // 4. default year
    // ==========================================

    function getSelection() {
        const url = new URL(
            window.location.href
        );

        if (url.searchParams.has("years")) {
            const value =
                url.searchParams.get("years") || "";

            const selection =
                normalizeSelection(value);

            if (selection.length > 0) {
                storeSelection(selection);
                return selection;
            }
        }

        const legacyURLYear =
            url.searchParams.get("year");

        if (isValidYear(legacyURLYear)) {
            const selection = [legacyURLYear];

            storeSelection(selection);

            return selection;
        }

        const stored = readStoredSelection();

        if (stored.length > 0) {
            return stored;
        }

        return [DEFAULT_YEAR];
    }


    // ==========================================
    // PUBLIC YEAR SELECTION HELPERS
    // ==========================================

    function getSelectedYears() {
        const selection = getSelection();

        if (
            selection.includes(
                ALL_HISTORICAL
            )
        ) {
            return [];
        }

        return selection.slice();
    }

    function isAllHistoric() {
        return getSelection().includes(
            ALL_HISTORICAL
        );
    }

    // Additional readable alias.
    function isAllHistorical() {
        return isAllHistoric();
    }

    // Backward-compatible single-year API.
    //
    // Existing pages can continue using it.
    // Multi-year loaders should use
    // getSelectedYears() and isAllHistorical().

    function getSelectedYear() {
        const years = getSelectedYears();

        return years.length > 0
            ? years[0]
            : DEFAULT_YEAR;
    }


    // ==========================================
    // YEAR LABELS
    // ==========================================

    function formatYear(year) {
        if (year === ALL_HISTORICAL) {
            return ALL_HISTORICAL_LABEL;
        }

        return year
            ? String(year).replace("-", "–")
            : "";
    }

    function getSelectionLabel(
        selection = getSelection(),
        fullFormat = false
    ) {
        if (
            selection.includes(
                ALL_HISTORICAL
            )
        ) {
            return ALL_HISTORICAL_LABEL;
        }

        if (selection.length === 1) {
            const label = formatYear(
                selection[0]
            );

            return fullFormat
                ? `${label} Academic Year`
                : label;
        }

        if (selection.length === 2) {
            return selection
                .map(formatYear)
                .join(", ");
        }

        return `${selection.length} Academic Years`;
    }


    // ==========================================
    // DATA PATHS
    //
    // Single year:
    // /Data/2024-2025/placements.xlsx
    //
    // All Historical Data:
    // /Data/all-historical/placements.xlsx
    // ==========================================

    function getDataPath(fileName, year) {
        let selectedYear = year;

        if (selectedYear === undefined) {
            selectedYear = isAllHistorical()
                ? ALL_HISTORICAL
                : getSelectedYear();
        }

        const folder =
            selectedYear === ALL_HISTORICAL
                ? HISTORICAL_FOLDER
                : selectedYear;

        return `/Data/${folder}/${fileName}`;
    }

    function getDataPaths(fileName) {
        if (isAllHistorical()) {
            return [
                getDataPath(
                    fileName,
                    ALL_HISTORICAL
                )
            ];
        }

        return getSelectedYears().map(year =>
            getDataPath(fileName, year)
        );
    }

    // Overall has a different annual
    // folder structure from EPP/Placements.
    //
    // Annual:
    // /Data/overall/2024-2025.csv
    //
    // Historical:
    // /Data/all-historical/overall.csv

    function getOverallDataPaths() {
        if (isAllHistorical()) {
            return [
                `/Data/${HISTORICAL_FOLDER}/overall.csv`
            ];
        }

        return getSelectedYears().map(year =>
            `/Data/overall/${year}.csv`
        );
    }


    // ==========================================
    // UPDATE SELECTED YEARS
    // ==========================================

    function setSelectedYears(input) {
        const selection =
            normalizeSelection(input);

        if (selection.length === 0) {
            return false;
        }

        const current = getSelection();

        if (selectionsEqual(current, selection)) {
            syncPickers();
            return true;
        }

        storeSelection(selection);

        const url = new URL(
            window.location.href
        );

        url.searchParams.delete("year");

        url.searchParams.set(
            "years",
            selection.includes(ALL_HISTORICAL)
                ? ALL_HISTORICAL
                : selection.join(",")
        );

        // Homepage keeps its existing
        // in-place update behavior.
        if (
            document.querySelector(".home-page")
        ) {
            window.history.replaceState(
                window.history.state,
                "",
                url.toString()
            );

            syncPickers();

            document.dispatchEvent(
                new CustomEvent(
                    "academic-year-changed",
                    {
                        detail: {
                            year: getSelectedYear(),
                            years: getSelectedYears(),
                            allHistoric:
                                isAllHistorical(),
                            allHistorical:
                                isAllHistorical()
                        }
                    }
                )
            );

            return true;
        }

        // Other pages reload when the
        // academic year selection changes.
        window.location.href = url.toString();

        return true;
    }

    function setSelectedYear(year) {
        if (!isValidYear(year)) {
            return false;
        }

        return setSelectedYears([year]);
    }


    // ==========================================
    // SYNC LEGACY SELECT ELEMENTS
    // ==========================================

    function syncNativeSelect(select) {
        const selection = getSelection();

        select.value =
            selection.includes(ALL_HISTORICAL)
                ? ALL_HISTORICAL
                : selection[0];
    }

    function syncPickers() {
        pickers.forEach(picker => {
            syncNativeSelect(picker.select);

            picker.label.textContent =
                getSelectionLabel(
                    getSelection(),
                    picker.fullFormat
                );
        });
    }


    // ==========================================
    // CHECKBOX DROPDOWN
    // ==========================================

    function createButton(text, className) {
        const button =
            document.createElement("button");

        button.type = "button";
        button.className = className;
        button.textContent = text;

        return button;
    }

    function createCheckboxRow(
        text,
        value,
        onChange
    ) {
        const row =
            document.createElement("label");

        row.className = "ay-picker__option";

        const checkbox =
            document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.value = value;

        const label =
            document.createElement("span");

        label.textContent = text;

        row.appendChild(checkbox);
        row.appendChild(label);

        checkbox.addEventListener(
            "change",
            () => onChange(checkbox.checked)
        );

        return {
            row,
            checkbox
        };
    }


    // ==========================================
    // INITIALIZE EACH ACADEMIC YEAR SELECTOR
    // ==========================================

    function populateSelect(select) {
        if (!select) {
            return;
        }

        const fullFormat =
            select.dataset.yearFormat === "full";

        // Keep the original select for
        // compatibility with existing code.
        select.innerHTML = "";

        const allOption =
            document.createElement("option");

        allOption.value = ALL_HISTORICAL;

        allOption.textContent =
            ALL_HISTORICAL_LABEL;

        select.appendChild(allOption);

        AVAILABLE_YEARS.forEach(year => {
            const option =
                document.createElement("option");

            option.value = year;

            option.textContent =
                fullFormat
                    ? `${formatYear(year)} Academic Year`
                    : formatYear(year);

            select.appendChild(option);
        });

        syncNativeSelect(select);

        select.style.display = "none";
        select.tabIndex = -1;

        select.setAttribute(
            "aria-hidden",
            "true"
        );

        const wrapper =
            document.createElement("div");

        wrapper.className = "ay-picker";

        const trigger = createButton(
            "",
            "ay-picker__trigger"
        );

        const triggerLabel =
            document.createElement("span");

        triggerLabel.className =
            "ay-picker__trigger-label";

        const caret =
            document.createElement("span");

        caret.className =
            "ay-picker__caret";

        caret.setAttribute(
            "aria-hidden",
            "true"
        );

        trigger.appendChild(triggerLabel);
        trigger.appendChild(caret);

        trigger.setAttribute(
            "aria-haspopup",
            "true"
        );

        trigger.setAttribute(
            "aria-expanded",
            "false"
        );

        trigger.setAttribute(
            "aria-label",
            "Select academic years"
        );

        const baseId =
            select.id ||
            `academicYear${pickers.length + 1}`;

        trigger.id = `${baseId}Button`;

        wrapper.appendChild(trigger);

        select.insertAdjacentElement(
            "afterend",
            wrapper
        );

        const associatedLabel =
            document.querySelector(
                `label[for="${baseId}"]`
            );

        if (associatedLabel) {
            associatedLabel.htmlFor =
                trigger.id;
        }

        // Keep the dropdown outside header
        // containers to prevent clipping.
        const panel =
            document.createElement("div");

        panel.className =
            "ay-picker__menu";

        panel.id = `${baseId}Menu`;
        panel.hidden = true;

        trigger.setAttribute(
            "aria-controls",
            panel.id
        );

        const heading =
            document.createElement("div");

        heading.className =
            "ay-picker__heading";

        heading.textContent =
            "Select Academic Years";

        panel.appendChild(heading);

        let pendingSelection = getSelection();

        // --------------------------------------
        // ALL HISTORICAL DATA OPTION
        // --------------------------------------

        const allRow = createCheckboxRow(
            ALL_HISTORICAL_LABEL,
            ALL_HISTORICAL,
            checked => {
                pendingSelection = checked
                    ? [ALL_HISTORICAL]
                    : [];

                refreshPending();
            }
        );

        allRow.row.classList.add(
            "ay-picker__option--all"
        );

        panel.appendChild(allRow.row);

        const divider =
            document.createElement("div");

        divider.className =
            "ay-picker__divider";

        panel.appendChild(divider);

        // --------------------------------------
        // INDIVIDUAL ACADEMIC YEARS
        // --------------------------------------

        const yearCheckboxes = new Map();

        AVAILABLE_YEARS.forEach(year => {
            const row = createCheckboxRow(
                formatYear(year),
                year,
                checked => {
                    const selected = new Set(
                        pendingSelection.filter(
                            item =>
                                item !== ALL_HISTORICAL
                        )
                    );

                    if (checked) {
                        selected.add(year);
                    } else {
                        selected.delete(year);
                    }

                    pendingSelection =
                        AVAILABLE_YEARS.filter(
                            item => selected.has(item)
                        );

                    refreshPending();
                }
            );

            yearCheckboxes.set(
                year,
                row.checkbox
            );

            panel.appendChild(row.row);
        });

        // --------------------------------------
        // COMPATIBILITY ACTIONS
        //
        // Existing CSS hides this section.
        // The original functionality remains.
        // --------------------------------------

        const tools =
            document.createElement("div");

        tools.className =
            "ay-picker__tools";

        const selectAllButton =
            createButton(
                "Select all years",
                "ay-picker__text-button"
            );

        const resetButton =
            createButton(
                "Reset",
                "ay-picker__text-button"
            );

        tools.appendChild(selectAllButton);
        tools.appendChild(resetButton);

        panel.appendChild(tools);

        // --------------------------------------
        // CANCEL / APPLY
        // --------------------------------------

        const footer =
            document.createElement("div");

        footer.className =
            "ay-picker__footer";

        const cancelButton =
            createButton(
                "Cancel",
                "ay-picker__cancel"
            );

        const applyButton =
            createButton(
                "Apply",
                "ay-picker__apply"
            );

        footer.appendChild(cancelButton);
        footer.appendChild(applyButton);

        panel.appendChild(footer);

        document.body.appendChild(panel);


        // ======================================
        // REFRESH CHECKBOX STATE
        // ======================================

        function refreshPending() {
            const isAll =
                pendingSelection.includes(
                    ALL_HISTORICAL
                );

            allRow.checkbox.checked = isAll;

            yearCheckboxes.forEach(
                (checkbox, year) => {
                    checkbox.checked =
                        !isAll &&
                        pendingSelection.includes(
                            year
                        );
                }
            );

            applyButton.disabled =
                pendingSelection.length === 0;
        }


        // ======================================
        // DROPDOWN POSITION
        // ======================================

        function positionPanel() {
            if (panel.hidden) {
                return;
            }

            const rect =
                trigger.getBoundingClientRect();

            const width = Math.min(
                320,
                window.innerWidth - 24
            );

            panel.style.width = `${width}px`;

            panel.style.maxHeight =
                `${Math.max(
                    160,
                    window.innerHeight - 24
                )}px`;

            const left = Math.max(
                12,
                Math.min(
                    rect.left,
                    window.innerWidth -
                        width -
                        12
                )
            );

            const panelHeight =
                panel.offsetHeight;

            const spaceBelow =
                window.innerHeight -
                rect.bottom;

            let top;

            if (
                spaceBelow < panelHeight + 12 &&
                rect.top > spaceBelow
            ) {
                top =
                    rect.top -
                    panelHeight -
                    8;
            } else {
                top = rect.bottom + 8;
            }

            top = Math.max(
                12,
                Math.min(
                    top,
                    window.innerHeight -
                        panelHeight -
                        12
                )
            );

            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
        }


        // ======================================
        // OPEN / CLOSE DROPDOWN
        // ======================================

        function closePanel() {
            panel.hidden = true;

            trigger.setAttribute(
                "aria-expanded",
                "false"
            );

            if (openPicker === picker) {
                openPicker = null;
            }
        }

        function openPanel() {
            if (
                openPicker &&
                openPicker !== picker
            ) {
                openPicker.close();
            }

            pendingSelection =
                getSelection().slice();

            refreshPending();

            panel.hidden = false;

            trigger.setAttribute(
                "aria-expanded",
                "true"
            );

            openPicker = picker;

            positionPanel();
        }

        const picker = {
            select,
            wrapper,
            panel,
            label: triggerLabel,
            fullFormat,
            close: closePanel,
            position: positionPanel
        };


        // ======================================
        // BUTTON EVENTS
        // ======================================

        trigger.addEventListener(
            "click",
            () => {
                if (panel.hidden) {
                    openPanel();
                } else {
                    closePanel();
                }
            }
        );

        selectAllButton.addEventListener(
            "click",
            () => {
                pendingSelection =
                    AVAILABLE_YEARS.slice();

                refreshPending();
            }
        );

        resetButton.addEventListener(
            "click",
            () => {
                pendingSelection = [
                    DEFAULT_YEAR
                ];

                refreshPending();
            }
        );

        cancelButton.addEventListener(
            "click",
            closePanel
        );

        applyButton.addEventListener(
            "click",
            () => {
                if (
                    pendingSelection.length === 0
                ) {
                    return;
                }

                const selection =
                    pendingSelection.slice();

                closePanel();

                setSelectedYears(selection);
            }
        );

        pickers.push(picker);

        syncPickers();
    }


    // ==========================================
    // GLOBAL DROPDOWN EVENTS
    // ==========================================

    document.addEventListener(
        "pointerdown",
        event => {
            if (!openPicker) {
                return;
            }

            const insideTrigger =
                openPicker.wrapper.contains(
                    event.target
                );

            const insideMenu =
                openPicker.panel.contains(
                    event.target
                );

            if (
                !insideTrigger &&
                !insideMenu
            ) {
                openPicker.close();
            }
        }
    );

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Escape" &&
                openPicker
            ) {
                openPicker.close();
            }
        }
    );

    window.addEventListener(
        "resize",
        () => {
            if (openPicker) {
                openPicker.position();
            }
        }
    );

    window.addEventListener(
        "scroll",
        () => {
            if (openPicker) {
                openPicker.position();
            }
        },
        true
    );


    // ==========================================
    // EXISTING DATA REQUEST COMPATIBILITY
    //
    // Keep legacy single-file requests
    // working while page-specific loaders
    // are upgraded for multiple years.
    // ==========================================

    function rewriteDataRequest(input) {
        if (typeof input !== "string") {
            return input;
        }

        const requestURL = new URL(
            input,
            window.location.href
        );

        const pathname = requestURL.pathname;

        if (
            pathname ===
            "/Data/epp_statistics.csv"
        ) {
            return getDataPath(
                "epp_statistics.csv"
            );
        }

        if (
            pathname ===
            "/Data/epp_statistics-all-endorsements.csv"
        ) {
            return getDataPath(
                "epp_statistics-all-endorsements.csv"
            );
        }

        if (
            pathname ===
            "/Data/placements.xlsx"
        ) {
            return getDataPath(
                "placements.xlsx"
            );
        }

        return input;
    }

    window.fetch = function (input, init) {
        return nativeFetch(
            rewriteDataRequest(input),
            init
        );
    };


    // ==========================================
    // PUBLIC API
    // ==========================================

    window.AcademicYear = {
        years: AVAILABLE_YEARS,

        defaultYear: DEFAULT_YEAR,

        // Keep original API name for
        // backward compatibility.
        allHistoricValue: ALL_HISTORICAL,

        // New readable aliases.
        allHistoricalValue: ALL_HISTORICAL,

        allHistoricalLabel:
            ALL_HISTORICAL_LABEL,

        historicalFolder:
            HISTORICAL_FOLDER,

        getSelectedYear,
        setSelectedYear,

        getSelectedYears,
        setSelectedYears,

        isAllHistoric,
        isAllHistorical,

        getSelectionLabel,

        formatYear,

        getDataPath,
        getDataPaths,

        getOverallDataPaths
    };


    // ==========================================
    // INITIALIZATION
    // ==========================================

    function initialize() {
        document
            .querySelectorAll(
                "[data-academic-year-select]"
            )
            .forEach(populateSelect);
    }

    if (
        document.readyState === "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );
    } else {
        initialize();
    }

})();
