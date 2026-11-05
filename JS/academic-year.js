
(function () {
    "use strict";

    // ==========================================
    // ACADEMIC YEAR CONFIGURATION
    // ==========================================

    const AVAILABLE_YEARS = [
        "2021-2022",
        "2022-2023",
        "2023-2024",
        "2024-2025"
    ];

    const DEFAULT_YEAR = "2024-2025";

    const STORAGE_KEY =
        "coe-dashboard-academic-year";

    const nativeFetch =
        window.fetch.bind(window);


    // ==========================================
    // LEAFLET MAP DOUBLE-CLICK PROTECTION
    //
    // Placements: #map
    // Overall:    #overallMap
    //
    // The first click keeps its original behavior.
    // The second click and the native dblclick
    // event are blocked to avoid repeated zooming.
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
                target.closest(
                    "#map, #overallMap"
                )
            )
        );
    }

    // Ignore only the second click in a double-click.
    // The first click still selects the bubble/county.

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

    // Block native double-click events on both maps.

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

    // Also disable the built-in Leaflet handler
    // when either dashboard map is initialized.
    // This does not affect other maps or EPP charts.

    if (
        window.L &&
        L.Map &&
        typeof L.Map.addInitHook === "function"
    ) {
        L.Map.addInitHook(function () {
            const container =
                this.getContainer();

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


    // ==========================================
    // LOCAL STORAGE
    // ==========================================

    function readStoredYear() {
        try {
            return localStorage.getItem(
                STORAGE_KEY
            );
        } catch (error) {
            return null;
        }
    }


    function storeYear(year) {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                year
            );
        } catch (error) {
            // The dashboard can still operate
            // without localStorage.
        }
    }


    // ==========================================
    // GET CURRENT ACADEMIC YEAR
    // ==========================================

    function getSelectedYear() {
        const url = new URL(
            window.location.href
        );

        const yearFromURL =
            url.searchParams.get("year");

        if (isValidYear(yearFromURL)) {
            storeYear(yearFromURL);
            return yearFromURL;
        }

        const storedYear = readStoredYear();

        if (isValidYear(storedYear)) {
            return storedYear;
        }

        return DEFAULT_YEAR;
    }


    // ==========================================
    // FORMAT YEAR
    // ==========================================

    function formatYear(year) {
        return year
            ? year.replace("-", "–")
            : "";
    }


    // ==========================================
    // DATA PATH
    // ==========================================

    function getDataPath(
        fileName,
        year = getSelectedYear()
    ) {
        return `/Data/${year}/${fileName}`;
    }


    // ==========================================
    // SET SELECTED YEAR
    //
    // HOME PAGE:
    // Update in place without reloading.
    //
    // OTHER PAGES:
    // Preserve original navigation behavior.
    // ==========================================

    function setSelectedYear(year) {
        if (!isValidYear(year)) {
            return;
        }

        storeYear(year);

        const url = new URL(
            window.location.href
        );

        url.searchParams.set(
            "year",
            year
        );

        // NEW:
        // Do not reload the homepage.
        // Preserve all dashboard cards.

        if (
            document.querySelector(".home-page")
        ) {
            window.history.replaceState(
                window.history.state,
                "",
                url.toString()
            );

            // Notify homepage preview scripts
            // that the selected year has changed.

            document.dispatchEvent(
                new CustomEvent(
                    "academic-year-changed",
                    {
                        detail: {
                            year: year
                        }
                    }
                )
            );

            return;
        }

        // Existing behavior:
        // EPP and Placements pages reload
        // when academic year changes.

        window.location.href =
            url.toString();
    }


    // ==========================================
    // POPULATE YEAR SELECT
    // ==========================================

    function populateSelect(select) {
        if (!select) {
            return;
        }

        const selectedYear =
            getSelectedYear();

        const fullLabel =
            select.dataset.yearFormat === "full";

        select.innerHTML = "";

        AVAILABLE_YEARS.forEach(year => {
            const option =
                document.createElement("option");

            option.value = year;

            option.textContent =
                fullLabel
                    ? `${formatYear(year)} Academic Year`
                    : formatYear(year);

            option.selected =
                year === selectedYear;

            select.appendChild(option);
        });

        select.addEventListener(
            "change",
            event => {
                setSelectedYear(
                    event.target.value
                );
            }
        );
    }


    // ==========================================
    // COMPATIBILITY WITH EXISTING DATA PATHS
    // ==========================================

    function rewriteDataRequest(input) {
        if (
            typeof input !== "string"
        ) {
            return input;
        }

        const requestURL = new URL(
            input,
            window.location.href
        );

        const pathname =
            requestURL.pathname;

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


    // ==========================================
    // EXISTING FETCH COMPATIBILITY
    // ==========================================

    window.fetch = function (
        input,
        init
    ) {
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

        getSelectedYear,

        setSelectedYear,

        formatYear,

        getDataPath
    };


    // ==========================================
    // INITIALIZATION
    // ==========================================

    document.addEventListener(
        "DOMContentLoaded",
        () => {
            document
                .querySelectorAll(
                    "[data-academic-year-select]"
                )
                .forEach(
                    populateSelect
                );
        }
    );

})();
