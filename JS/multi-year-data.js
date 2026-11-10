
/*
 * Multi-Year Data Compatibility Layer
 */

(function () {
    "use strict";

    if (!window.AcademicYear) {
        console.error(
            "MultiYearData requires academic-year.js."
        );
        return;
    }

    const AcademicYear = window.AcademicYear;

    // Save the existing fetch implementation.
    const originalFetch = window.fetch.bind(window);

    const cache = new Map();

    const historicalFolder = "/Data/all-historical/";

    const historicalFiles = {
        overall: historicalFolder + "overall.csv",
        placements: historicalFolder + "placements.xlsx",
        statistics: historicalFolder + "epp_statistics.csv",
        endorsements:
            historicalFolder +
            "completers_and_admissions_by_endorsements.xlsx"
    };

    // ==================================================
    // ACADEMIC YEAR SELECTION
    // ==================================================

    function getSelection() {
        const allHistorical =
            typeof AcademicYear.isAllHistorical === "function"
                ? AcademicYear.isAllHistorical()
                : (
                    typeof AcademicYear.isAllHistoric === "function"
                        ? AcademicYear.isAllHistoric()
                        : false
                );

        const availableYears = Array.isArray(
            AcademicYear.years
        )
            ? AcademicYear.years.slice()
            : [
                "2021-2022",
                "2022-2023",
                "2023-2024",
                "2024-2025"
            ];

        let years = [];

        if (allHistorical) {
            years = availableYears.slice();
        } else if (
            typeof AcademicYear.getSelectedYears === "function"
        ) {
            years = AcademicYear.getSelectedYears();
        }

        if (!Array.isArray(years)) {
            years = [];
        }

        years = availableYears.filter(function (year) {
            return years.includes(year);
        });

        if (!allHistorical && years.length === 0) {
            years = [
                AcademicYear.defaultYear || "2024-2025"
            ];
        }

        return {
            years: years,
            allHistorical: allHistorical,
            multiYear:
                allHistorical || years.length > 1
        };
    }

    function getSelectionKey() {
        const selection = getSelection();

        return selection.allHistorical
            ? "all"
            : selection.years.join(",");
    }

    // ==================================================
    // GENERAL HELPERS
    // ==================================================

    function clean(value) {
        return value === null || value === undefined
            ? ""
            : String(value).trim();
    }

    function normalizeYear(value) {
        const text = clean(value)
            .replace(/[–—]/g, "-")
            .replace(/\s+/g, "");

        const match = text.match(
            /(20\d{2})[-/](20\d{2}|\d{2})/
        );

        if (!match) {
            return "";
        }

        const first = match[1];

        const second = match[2].length === 2
            ? first.slice(0, 2) + match[2]
            : match[2];

        return first + "-" + second;
    }

    function normalizeHeader(value) {
        return clean(value)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
    }

    function findYearColumn(headers) {
        const preferred = [
            "School Year",
            "Academic Year",
            "AcademicYear",
            "Placement Year",
            "Reporting Year",
            "Year"
        ];

        for (const candidate of preferred) {
            const found = headers.find(function (header) {
                return normalizeHeader(header) ===
                    normalizeHeader(candidate);
            });

            if (found !== undefined) {
                return found;
            }
        }

        return headers.find(function (header) {
            return /(^|[^a-z])year([^a-z]|$)/i.test(
                clean(header)
            );
        }) || null;
    }

    function toNumber(value) {
        if (
            value === null ||
            value === undefined ||
            clean(value) === ""
        ) {
            return null;
        }

        const text = clean(value)
            .replace(/,/g, "")
            .replace(/^\$/, "");

        const number = Number(text);

        return Number.isFinite(number)
            ? number
            : null;
    }

    function remember(key, loader) {
        if (!cache.has(key)) {
            const promise = Promise.resolve()
                .then(loader)
                .catch(function (error) {
                    cache.delete(key);
                    throw error;
                });

            cache.set(key, promise);
        }

        return cache.get(key);
    }

    async function getText(path) {
        return remember(
            "text:" + path,
            async function () {
                const response = await originalFetch(path);

                if (!response.ok) {
                    throw new Error(
                        "Unable to load " + path +
                        " (HTTP " + response.status + ")"
                    );
                }

                return response.text();
            }
        );
    }

    async function getBuffer(path) {
        return remember(
            "buffer:" + path,
            async function () {
                const response = await originalFetch(path);

                if (!response.ok) {
                    throw new Error(
                        "Unable to load " + path +
                        " (HTTP " + response.status + ")"
                    );
                }

                return response.arrayBuffer();
            }
        );
    }

    // ==================================================
    // CSV PARSER
    // ==================================================

    function parseCSV(text) {
        const lines = [];
        let row = [];
        let cell = "";
        let quoted = false;

        text = String(text || "").replace(/^\uFEFF/, "");

        for (let i = 0; i < text.length; i++) {
            const character = text[i];
            const next = text[i + 1];

            if (character === '"') {
                if (quoted && next === '"') {
                    cell += '"';
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (character === "," && !quoted) {
                row.push(cell.trim());
                cell = "";
            } else if (
                (character === "\n" || character === "\r") &&
                !quoted
            ) {
                if (
                    character === "\r" &&
                    next === "\n"
                ) {
                    i++;
                }

                row.push(cell.trim());
                cell = "";

                if (row.some(value => value !== "")) {
                    lines.push(row);
                }

                row = [];
            } else {
                cell += character;
            }
        }

        row.push(cell.trim());

        if (row.some(value => value !== "")) {
            lines.push(row);
        }

        if (lines.length === 0) {
            return {
                headers: [],
                rows: []
            };
        }

        const headers = lines[0].map(clean);

        const rows = lines.slice(1).map(function (cells) {
            const record = {};

            headers.forEach(function (header, index) {
                record[header] = cells[index] ?? "";
            });

            return record;
        });

        return {
            headers: headers,
            rows: rows
        };
    }

    function encodeCSVCell(value) {
        const text = clean(value);

        if (/[",\r\n]/.test(text)) {
            return '"' + text.replace(/"/g, '""') + '"';
        }

        return text;
    }

    function makeCSV(headers, rows) {
        const output = [];

        output.push(
            headers.map(encodeCSVCell).join(",")
        );

        rows.forEach(function (row) {
            output.push(
                headers.map(function (header) {
                    return encodeCSVCell(row[header]);
                }).join(",")
            );
        });

        return output.join("\r\n") + "\r\n";
    }

    function filterRowsByYear(headers, rows) {
        const selection = getSelection();

        if (selection.allHistorical) {
            return rows;
        }

        const yearColumn = findYearColumn(headers);

        if (!yearColumn) {
            throw new Error(
                "Historical data is missing a year column. " +
                "Available columns: " + headers.join(", ")
            );
        }

        const selected = new Set(selection.years);

        return rows.filter(function (row) {
            return selected.has(
                normalizeYear(row[yearColumn])
            );
        });
    }

    // ==================================================
    // OVERALL PROGRAM REACH
    // ==================================================

    async function loadOverallText() {
        const selection = getSelection();

        if (!selection.multiYear) {
            const year = selection.years[0];

            return getText(
                "/Data/overall/" + year + ".csv"
            );
        }

        return remember(
            "overall:" + getSelectionKey(),
            async function () {
                const text = await getText(
                    historicalFiles.overall
                );

                if (selection.allHistorical) {
                    return text;
                }

                const parsed = parseCSV(text);

                const rows = filterRowsByYear(
                    parsed.headers,
                    parsed.rows
                );

                return makeCSV(
                    parsed.headers,
                    rows
                );
            }
        );
    }

    // ==================================================
    // EPP STATISTICS
    // ==================================================

    async function loadEPPStatisticsText() {
        const selection = getSelection();

        if (!selection.multiYear) {
            return getText(
                "/Data/" +
                selection.years[0] +
                "/epp_statistics.csv"
            );
        }

        return remember(
            "statistics:" + getSelectionKey(),
            async function () {
                const text = await getText(
                    historicalFiles.statistics
                );

                const parsed = parseCSV(text);

                const categoryColumn =
                    parsed.headers.find(function (header) {
                        return normalizeHeader(header) ===
                            "categoryname";
                    });

                const valueColumn =
                    parsed.headers.find(function (header) {
                        return normalizeHeader(header) ===
                            normalizeHeader(
                                "Number of EPP Candidates Admitted this school year"
                            );
                    });

                const yearColumn = findYearColumn(
                    parsed.headers
                );

                if (
                    !categoryColumn ||
                    !valueColumn ||
                    !yearColumn
                ) {
                    throw new Error(
                        "Unexpected EPP statistics columns: " +
                        parsed.headers.join(", ")
                    );
                }

                const selectedRows = filterRowsByYear(
                    parsed.headers,
                    parsed.rows
                );

                const grouped = new Map();

                selectedRows.forEach(function (row) {
                    const category = clean(
                        row[categoryColumn]
                    );

                    if (!category) {
                        return;
                    }

                    // Do not pool medians, averages or rates.
                    if (
                        /median|gpa|average|percent|rate/i.test(
                            category
                        )
                    ) {
                        return;
                    }

                    const value = toNumber(
                        row[valueColumn]
                    );

                    if (value === null) {
                        return;
                    }

                    const key = category.toLowerCase();

                    if (!grouped.has(key)) {
                        grouped.set(
                            key,
                            Object.assign({}, row, {
                                [valueColumn]: 0,
                                [yearColumn]:
                                    selection.allHistorical
                                        ? "All Historical Data"
                                        : selection.years.join("; ")
                            })
                        );
                    }

                    const result = grouped.get(key);

                    result[valueColumn] += value;
                });

                return makeCSV(
                    parsed.headers,
                    Array.from(grouped.values())
                );
            }
        );
    }

    // ==================================================
    // XLSX LIBRARY
    // ==================================================

    let xlsxPromise = null;

    function ensureXLSX() {
        if (window.XLSX) {
            return Promise.resolve(window.XLSX);
        }

        if (xlsxPromise) {
            return xlsxPromise;
        }

        xlsxPromise = new Promise(function (
            resolve,
            reject
        ) {
            const script = document.createElement(
                "script"
            );

            script.src =
                "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";

            script.onload = function () {
                if (window.XLSX) {
                    resolve(window.XLSX);
                } else {
                    reject(
                        new Error(
                            "SheetJS loaded without XLSX."
                        )
                    );
                }
            };

            script.onerror = function () {
                reject(
                    new Error(
                        "Unable to load SheetJS."
                    )
                );
            };

            document.head.appendChild(script);
        });

        return xlsxPromise;
    }

    // ==================================================
    // STUDENT TEACHING PLACEMENTS
    // ==================================================

    async function loadPlacementsArrayBuffer() {
        const selection = getSelection();

        if (!selection.multiYear) {
            return getBuffer(
                "/Data/" +
                selection.years[0] +
                "/placements.xlsx"
            );
        }

        return remember(
            "placements:" + getSelectionKey(),
            async function () {
                const buffer = await getBuffer(
                    historicalFiles.placements
                );

                if (selection.allHistorical) {
                    return buffer;
                }

                const XLSX = await ensureXLSX();

                const workbook = XLSX.read(
                    buffer,
                    { type: "array" }
                );

                const firstSheetName =
                    workbook.SheetNames[0];

                if (!firstSheetName) {
                    throw new Error(
                        "Placements workbook has no sheets."
                    );
                }

                const sheet = workbook.Sheets[
                    firstSheetName
                ];

                const rows = XLSX.utils.sheet_to_json(
                    sheet,
                    {
                        header: 1,
                        defval: "",
                        raw: false
                    }
                );

                let headerIndex = -1;
                let yearIndex = -1;

                for (
                    let i = 0;
                    i < Math.min(rows.length, 15);
                    i++
                ) {
                    const headers = rows[i].map(clean);

                    const yearColumn = findYearColumn(
                        headers
                    );

                    if (yearColumn) {
                        headerIndex = i;
                        yearIndex = headers.indexOf(
                            yearColumn
                        );
                        break;
                    }
                }

                if (headerIndex < 0) {
                    throw new Error(
                        "Historical placements.xlsx is missing " +
                        "a School Year or Academic Year column."
                    );
                }

                const selected = new Set(
                    selection.years
                );

                const filteredRows = rows
                    .slice(headerIndex + 1)
                    .filter(function (row) {
                        return selected.has(
                            normalizeYear(
                                row[yearIndex]
                            )
                        );
                    });

                const outputRows = rows
                    .slice(0, headerIndex + 1)
                    .concat(filteredRows);

                workbook.Sheets[firstSheetName] =
                    XLSX.utils.aoa_to_sheet(
                        outputRows
                    );

                return XLSX.write(
                    workbook,
                    {
                        bookType: "xlsx",
                        type: "array"
                    }
                );
            }
        );
    }

    // ==================================================
    // ENDORSEMENT HISTORICAL WORKBOOK
    // ==================================================

    async function loadEndorsements() {
        const selection = getSelection();

        if (!selection.multiYear) {
            if (
                window.EndorsementData &&
                typeof window.EndorsementData.load === "function"
            ) {
                return window.EndorsementData.load();
            }

            throw new Error(
                "EndorsementData.load is unavailable."
            );
        }

        return remember(
            "endorsements:" + getSelectionKey(),
            async function () {
                const XLSX = await ensureXLSX();

                const buffer = await getBuffer(
                    historicalFiles.endorsements
                );

                const workbook = XLSX.read(
                    buffer,
                    { type: "array" }
                );

                const combined = new Map();

                function addSheet(sheetName, metric) {
                    const actualSheetName =
                        workbook.SheetNames.find(
                            name =>
                                name.toLowerCase() ===
                                sheetName.toLowerCase()
                        );

                    if (!actualSheetName) {
                        throw new Error(
                            "Missing endorsement sheet: " +
                            sheetName
                        );
                    }

                    const rows = XLSX.utils.sheet_to_json(
                        workbook.Sheets[actualSheetName],
                        {
                            header: 1,
                            defval: "",
                            raw: false
                        }
                    );

                    const headerIndex = rows.findIndex(
                        function (row) {
                            return /endorsement/i.test(
                                clean(row[0])
                            ) && row.some(
                                cell => normalizeYear(cell)
                            );
                        }
                    );

                    if (headerIndex < 0) {
                        throw new Error(
                            "Cannot find year headers in " +
                            actualSheetName
                        );
                    }

                    const headers = rows[headerIndex];

                    const yearIndices = [];

                    if (selection.allHistorical) {
                        headers.forEach(
                            function (header, index) {
                                if (normalizeYear(header)) {
                                    yearIndices.push(index);
                                }
                            }
                        );
                    } else {
                        selection.years.forEach(
                            function (year) {
                                const index =
                                    headers.findIndex(
                                        header =>
                                            normalizeYear(header) ===
                                            year
                                    );

                                if (index < 0) {
                                    throw new Error(
                                        "Year " + year +
                                        " not found in " +
                                        actualSheetName
                                    );
                                }

                                yearIndices.push(index);
                            }
                        );
                    }

                    rows.slice(headerIndex + 1)
                        .forEach(function (row) {
                            const name = clean(row[0])
                                .replace(/\s+/g, " ");

                            if (!name) {
                                return;
                            }

                            const key = name.toLowerCase();

                            if (!combined.has(key)) {
                                combined.set(key, {
                                    name: name,
                                    admitted: null,
                                    completers: null
                                });
                            }

                            let total = 0;
                            let hasValue = false;

                            yearIndices.forEach(
                                function (index) {
                                    const value = toNumber(
                                        row[index]
                                    );

                                    if (value !== null) {
                                        total += value;
                                        hasValue = true;
                                    }
                                }
                            );

                            const item = combined.get(key);

                            if (hasValue) {
                                item[metric] =
                                    (item[metric] ?? 0) +
                                    total;
                            }
                        });
                }

                addSheet(
                    "Completers by Program",
                    "completers"
                );

                addSheet(
                    "Admitted by Program",
                    "admitted"
                );

                return {
                    year: getSelectionKey(),
                    sourceType: "xlsx",
                    sourcePath:
                        historicalFiles.endorsements,
                    data: Array.from(
                        combined.values()
                    )
                };
            }
        );
    }

    // ==================================================
    // EXISTING FILE PATH COMPATIBILITY
    // ==================================================

    function classifyDataRequest(input) {
        let url;

        try {
            url = typeof input === "string"
                ? input
                : input.url;

            const pathname = new URL(
                url,
                window.location.href
            ).pathname.toLowerCase();

            if (!pathname.includes("/data/")) {
                return null;
            }

            if (
                /\/overall\.csv$/.test(pathname) ||
                /\/overall\/[^/]+\.csv$/.test(pathname)
            ) {
                return "overall";
            }

            if (/\/placements\.xlsx$/.test(pathname)) {
                return "placements";
            }

            if (/\/epp_statistics\.csv$/.test(pathname)) {
                return "statistics";
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    function annualPath(type, year) {
        if (type === "overall") {
            return "/Data/overall/" + year + ".csv";
        }

        if (type === "placements") {
            return "/Data/" + year + "/placements.xlsx";
        }

        if (type === "statistics") {
            return "/Data/" + year + "/epp_statistics.csv";
        }

        return "";
    }

    window.fetch = async function (input, options) {
        const method = clean(
            (options && options.method) ||
            (input && input.method) ||
            "GET"
        ).toUpperCase();

        if (method !== "GET") {
            return originalFetch(input, options);
        }

        const type = classifyDataRequest(input);

        if (!type) {
            return originalFetch(input, options);
        }

        const selection = getSelection();

        if (!selection.multiYear) {
            return originalFetch(
                annualPath(
                    type,
                    selection.years[0]
                ),
                options
            );
        }

        try {
            if (type === "overall") {
                const text = await loadOverallText();

                return new Response(text, {
                    status: 200,
                    headers: {
                        "Content-Type":
                            "text/csv; charset=utf-8"
                    }
                });
            }

            if (type === "statistics") {
                const text =
                    await loadEPPStatisticsText();

                return new Response(text, {
                    status: 200,
                    headers: {
                        "Content-Type":
                            "text/csv; charset=utf-8"
                    }
                });
            }

            if (type === "placements") {
                const buffer =
                    await loadPlacementsArrayBuffer();

                return new Response(buffer, {
                    status: 200,
                    headers: {
                        "Content-Type":
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    }
                });
            }
        } catch (error) {
            console.error(
                "Multi-year data request failed:",
                type,
                error
            );

            throw error;
        }

        return originalFetch(input, options);
    };

    // ==================================================
    // PREVENT MULTIPLE ANNUAL REQUESTS
    // ==================================================

    if (
        typeof AcademicYear.getOverallDataPaths ===
        "function"
    ) {
        const previous =
            AcademicYear.getOverallDataPaths.bind(
                AcademicYear
            );

        AcademicYear.getOverallDataPaths =
            function (...args) {
                if (getSelection().multiYear) {
                    return [
                        historicalFiles.overall
                    ];
                }

                return previous(...args);
            };
    }

    if (
        typeof AcademicYear.getDataPaths === "function"
    ) {
        const previous =
            AcademicYear.getDataPaths.bind(
                AcademicYear
            );

        AcademicYear.getDataPaths =
            function (filename, ...args) {
                if (
                    getSelection().multiYear &&
                    typeof filename === "string"
                ) {
                    const baseName =
                        filename.split("/").pop();

                    if (
                        [
                            "placements.xlsx",
                            "epp_statistics.csv",
                            "completers_and_admissions_by_endorsements.xlsx"
                        ].includes(baseName)
                    ) {
                        return [
                            historicalFolder + baseName
                        ];
                    }
                }

                return previous(filename, ...args);
            };
    }

    // ==================================================
    // PATCH EXISTING ENDORSEMENT LOADER
    // ==================================================

    function patchEndorsementLoader() {
        const loader = window.EndorsementData;

        if (
            !loader ||
            typeof loader.load !== "function" ||
            loader.__multiYearWrapped
        ) {
            return;
        }

        const previousLoad = loader.load;

        loader.load = function (...args) {
            if (!getSelection().multiYear) {
                return previousLoad.apply(
                    this,
                    args
                );
            }

            return loadEndorsements();
        };

        loader.__multiYearWrapped = true;
    }

    // ==================================================
    // MULTI-YEAR MEDIAN GPA
    // ==================================================

    function setupMedianGPADisplay() {
        const element = document.getElementById(
            "medianGpa"
        );

        if (!element || !getSelection().multiYear) {
            return;
        }

        const desiredText = "View yearly data";

        function applyLabel() {
            if (
                element.textContent.trim() !==
                desiredText
            ) {
                element.textContent = desiredText;
            }

            element.style.fontSize = "13px";
            element.style.whiteSpace = "nowrap";
        }

        const observer = new MutationObserver(
            applyLabel
        );

        observer.observe(element, {
            childList: true,
            characterData: true,
            subtree: true
        });

        applyLabel();
    }

    patchEndorsementLoader();

    document.addEventListener(
        "DOMContentLoaded",
        function () {
            patchEndorsementLoader();
            setupMedianGPADisplay();
        }
    );

    // ==================================================
    // PUBLIC API
    // ==================================================

    window.MultiYearData = {
        getSelection: getSelection,
        getSelectedYears: function () {
            return getSelection().years;
        },
        isAllHistorical: function () {
            return getSelection().allHistorical;
        },
        isMultiYear: function () {
            return getSelection().multiYear;
        },
        loadOverallText: loadOverallText,
        loadEPPStatisticsText:
            loadEPPStatisticsText,
        loadPlacementsArrayBuffer:
            loadPlacementsArrayBuffer,
        loadEndorsements: loadEndorsements
    };

    console.info(
        "MultiYearData ready:",
        getSelection()
    );

})();
