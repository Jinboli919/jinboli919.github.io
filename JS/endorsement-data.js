(function () {

    "use strict";


    const FILE_BASENAME =
        "completers_and_admissions_by_endorsements";


    const FILE_EXTENSIONS = [
        "xlsx",
        "csv"
    ];


    const NAME_PATTERNS = [
        /endorsement/i,
        /program/i,
        /licensure/i,
        /license/i,
        /area/i
    ];


    const ADMITTED_PATTERNS = [
        /admitted/i,
        /admission/i,
        /admit/i,
        /incoming/i,
        /enrolled/i
    ];


    const COMPLETER_PATTERNS = [
        /completers?/i,
        /completed/i,
        /completion/i,
        /graduates?/i,
        /graduated/i
    ];


    const METRIC_PATTERNS = [
        /metric/i,
        /measure/i,
        /type/i,
        /status/i,
        /category/i
    ];


    const VALUE_PATTERNS = [
        /count/i,
        /number/i,
        /total/i,
        /value/i,
        /students?/i,
        /candidates?/i
    ];


    let sheetJSLoadingPromise =
        null;


    async function load(
        year = window.AcademicYear.getSelectedYear()
    ) {

        const source =
            await loadSource(
                year
            );


        if (
            source.extension ===
            "xlsx"
        ) {

            await ensureSheetJS();


            return parseXLSX(
                source.arrayBuffer,
                year,
                source.path
            );

        }


        return parseCSVSource(
            source.text,
            year,
            source.path
        );

    }


    async function loadSource(
        year
    ) {

        const errors = [];


        for (
            const extension
            of FILE_EXTENSIONS
        ) {

            const fileName =
                `${FILE_BASENAME}.${extension}`;


            const path =
                window.AcademicYear.getDataPath(
                    fileName,
                    year
                );


            try {

                const response =
                    await fetch(
                        path
                    );


                if (
                    !response.ok
                ) {

                    errors.push(
                        `${path}: ${response.status}`
                    );


                    continue;

                }


                if (
                    extension ===
                    "xlsx"
                ) {

                    return {

                        extension,

                        path,

                        arrayBuffer:
                            await response.arrayBuffer()

                    };

                }


                return {

                    extension,

                    path,

                    text:
                        await response.text()

                };

            }
            catch (
                error
            ) {

                errors.push(
                    `${path}: ${error.message}`
                );

            }

        }


        throw new Error(
            `Unable to locate ${FILE_BASENAME}.xlsx or ${FILE_BASENAME}.csv for ${year}. ${errors.join(" | ")}`
        );

    }


    async function ensureSheetJS() {

        if (
            window.XLSX
        ) {

            return;

        }


        if (
            sheetJSLoadingPromise
        ) {

            return sheetJSLoadingPromise;

        }


        sheetJSLoadingPromise =
            new Promise(
                (
                    resolve,
                    reject
                ) => {

                    const script =
                        document.createElement(
                            "script"
                        );


                    script.src =
                        "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";


                    script.onload =
                        () => {

                            if (
                                window.XLSX
                            ) {

                                resolve();

                            }
                            else {

                                reject(
                                    new Error(
                                        "SheetJS loaded but XLSX is unavailable."
                                    )
                                );

                            }

                        };


                    script.onerror =
                        () => {

                            reject(
                                new Error(
                                    "Unable to load SheetJS."
                                )
                            );

                        };


                    document.head.appendChild(
                        script
                    );

                }
            );


        return sheetJSLoadingPromise;

    }


    function parseXLSX(
        arrayBuffer,
        year,
        sourcePath
    ) {

        const workbook =
            XLSX.read(
                arrayBuffer,
                {
                    type:
                        "array"
                }
            );


        const profiles =
            workbook.SheetNames.map(
                sheetName => {

                    const sheet =
                        workbook.Sheets[
                            sheetName
                        ];


                    const rows =
                        XLSX.utils.sheet_to_json(
                            sheet,
                            {
                                header:
                                    1,

                                defval:
                                    "",

                                raw:
                                    true
                            }
                        );


                    return {

                        name:
                            sheetName,

                        rows,

                        admittedScore:
                            getMetricScore(
                                sheetName,
                                rows,
                                ADMITTED_PATTERNS
                            ),

                        completersScore:
                            getMetricScore(
                                sheetName,
                                rows,
                                COMPLETER_PATTERNS
                            )

                    };

                }
            );


        const combinedResult =
            tryCombinedSheets(
                profiles,
                year
            );


        if (
            combinedResult
        ) {

            return {

                year,

                sourceType:
                    "xlsx",

                sourcePath,

                data:
                    finalizeData(
                        combinedResult
                    )

            };

        }


        const admittedProfile =
            chooseMetricSheet(
                profiles,
                "admittedScore"
            );


        const completersProfile =
            chooseMetricSheet(
                profiles,
                "completersScore",
                admittedProfile
            );


        if (
            !admittedProfile &&
            !completersProfile
        ) {

            throw new Error(
                "Unable to identify admitted or completer data in the workbook."
            );

        }


        const admittedRows =
            admittedProfile
                ?
                parseSingleMetricTable(
                    admittedProfile.rows,
                    year,
                    "admitted"
                )
                :
                [];


        const completerRows =
            completersProfile
                ?
                parseSingleMetricTable(
                    completersProfile.rows,
                    year,
                    "completers"
                )
                :
                [];


        return {

            year,

            sourceType:
                "xlsx",

            sourcePath,

            admittedSheet:
                admittedProfile
                    ?
                    admittedProfile.name
                    :
                    null,

            completersSheet:
                completersProfile
                    ?
                    completersProfile.name
                    :
                    null,

            data:
                mergeMetricRows(
                    admittedRows,
                    completerRows
                )

        };

    }


    function parseCSVSource(
        text,
        year,
        sourcePath
    ) {

        const rows =
            parseCSVMatrix(
                text
            );


        let data =
            parseCombinedTable(
                rows,
                year
            );


        if (
            !data
        ) {

            data =
                parseLongTable(
                    rows
                );

        }


        if (
            !data
        ) {

            throw new Error(
                "Unable to identify endorsement, admitted, and completer columns in the CSV file."
            );

        }


        return {

            year,

            sourceType:
                "csv",

            sourcePath,

            data:
                finalizeData(
                    data
                )

        };

    }


    function tryCombinedSheets(
        profiles,
        year
    ) {

        for (
            const profile
            of profiles
        ) {

            const parsed =
                parseCombinedTable(
                    profile.rows,
                    year
                );


            if (
                parsed &&
                parsed.length > 0
            ) {

                return parsed;

            }

        }


        return null;

    }


    function parseCombinedTable(
        rows,
        year
    ) {

        if (
            !rows ||
            rows.length === 0
        ) {

            return null;

        }


        const headerIndex =
            findCombinedHeaderRow(
                rows
            );


        if (
            headerIndex < 0
        ) {

            return null;

        }


        const headers =
            rows[
                headerIndex
            ] || [];


        const nameColumn =
            findHeaderColumn(
                headers,
                NAME_PATTERNS
            );


        const admittedColumn =
            findHeaderColumn(
                headers,
                ADMITTED_PATTERNS
            );


        const completersColumn =
            findHeaderColumn(
                headers,
                COMPLETER_PATTERNS
            );


        if (
            nameColumn < 0 ||
            admittedColumn < 0 ||
            completersColumn < 0
        ) {

            return null;

        }


        const result = [];


        rows
            .slice(
                headerIndex +
                1
            )
            .forEach(
                row => {

                    const name =
                        cleanEndorsementName(
                            row[
                                nameColumn
                            ]
                        );


                    if (
                        !name ||
                        isSummaryRow(
                            name
                        )
                    ) {

                        return;

                    }


                    result.push(
                        {

                            name,

                            key:
                                normalizeEndorsementKey(
                                    name
                                ),

                            admitted:
                                parseNumericValue(
                                    row[
                                        admittedColumn
                                    ]
                                ),

                            completers:
                                parseNumericValue(
                                    row[
                                        completersColumn
                                    ]
                                )

                        }
                    );

                }
            );


        return result;

    }


    function parseLongTable(
        rows
    ) {

        const headerIndex =
            findLongHeaderRow(
                rows
            );


        if (
            headerIndex < 0
        ) {

            return null;

        }


        const headers =
            rows[
                headerIndex
            ] || [];


        const nameColumn =
            findHeaderColumn(
                headers,
                NAME_PATTERNS
            );


        const metricColumn =
            findHeaderColumn(
                headers,
                METRIC_PATTERNS
            );


        let valueColumn =
            findHeaderColumn(
                headers,
                VALUE_PATTERNS
            );


        if (
            valueColumn < 0
        ) {

            valueColumn =
                findMostNumericColumn(
                    rows,
                    headerIndex,
                    [
                        nameColumn,
                        metricColumn
                    ]
                );

        }


        if (
            nameColumn < 0 ||
            metricColumn < 0 ||
            valueColumn < 0
        ) {

            return null;

        }


        const map =
            new Map();


        rows
            .slice(
                headerIndex +
                1
            )
            .forEach(
                row => {

                    const name =
                        cleanEndorsementName(
                            row[
                                nameColumn
                            ]
                        );


                    if (
                        !name ||
                        isSummaryRow(
                            name
                        )
                    ) {

                        return;

                    }


                    const metricText =
                        normalizeText(
                            row[
                                metricColumn
                            ]
                        );


                    const value =
                        parseNumericValue(
                            row[
                                valueColumn
                            ]
                        );


                    const key =
                        normalizeEndorsementKey(
                            name
                        );


                    if (
                        !map.has(
                            key
                        )
                    ) {

                        map.set(
                            key,
                            {

                                name,

                                key,

                                admitted:
                                    null,

                                completers:
                                    null

                            }
                        );

                    }


                    const item =
                        map.get(
                            key
                        );


                    if (
                        matchesAny(
                            metricText,
                            ADMITTED_PATTERNS
                        )
                    ) {

                        item.admitted =
                            addNullableValues(
                                item.admitted,
                                value
                            );

                    }


                    if (
                        matchesAny(
                            metricText,
                            COMPLETER_PATTERNS
                        )
                    ) {

                        item.completers =
                            addNullableValues(
                                item.completers,
                                value
                            );

                    }

                }
            );


        return Array.from(
            map.values()
        );

    }


    function parseSingleMetricTable(
        rows,
        year,
        metric
    ) {

        const headerIndex =
            findSingleMetricHeaderRow(
                rows,
                year,
                metric
            );


        const headers =
            rows[
                headerIndex
            ] || [];


        let nameColumn =
            findHeaderColumn(
                headers,
                NAME_PATTERNS
            );


        if (
            nameColumn < 0
        ) {

            nameColumn =
                findMostTextualColumn(
                    rows,
                    headerIndex
                );

        }


        let valueColumn =
            findYearColumn(
                headers,
                year
            );


        if (
            valueColumn < 0
        ) {

            valueColumn =
                findHeaderColumn(
                    headers,
                    metric ===
                    "admitted"
                        ?
                        ADMITTED_PATTERNS
                        :
                        COMPLETER_PATTERNS
                );

        }


        if (
            valueColumn < 0
        ) {

            valueColumn =
                findMostNumericColumn(
                    rows,
                    headerIndex,
                    [
                        nameColumn
                    ]
                );

        }


        if (
            nameColumn < 0 ||
            valueColumn < 0
        ) {

            return [];

        }


        const result = [];


        rows
            .slice(
                headerIndex +
                1
            )
            .forEach(
                row => {

                    const name =
                        cleanEndorsementName(
                            row[
                                nameColumn
                            ]
                        );


                    if (
                        !name ||
                        isSummaryRow(
                            name
                        )
                    ) {

                        return;

                    }


                    result.push(
                        {

                            name,

                            key:
                                normalizeEndorsementKey(
                                    name
                                ),

                            value:
                                parseNumericValue(
                                    row[
                                        valueColumn
                                    ]
                                )

                        }
                    );

                }
            );


        return result;

    }


    function mergeMetricRows(
        admittedRows,
        completerRows
    ) {

        const map =
            new Map();


        admittedRows.forEach(
            row => {

                const item =
                    getOrCreateItem(
                        map,
                        row
                    );


                item.admitted =
                    addNullableValues(
                        item.admitted,
                        row.value
                    );

            }
        );


        completerRows.forEach(
            row => {

                const item =
                    getOrCreateItem(
                        map,
                        row
                    );


                item.completers =
                    addNullableValues(
                        item.completers,
                        row.value
                    );

            }
        );


        return finalizeData(
            Array.from(
                map.values()
            )
        );

    }


    function getOrCreateItem(
        map,
        row
    ) {

        if (
            !map.has(
                row.key
            )
        ) {

            map.set(
                row.key,
                {

                    name:
                        row.name,

                    key:
                        row.key,

                    admitted:
                        null,

                    completers:
                        null

                }
            );

        }


        return map.get(
            row.key
        );

    }


    function finalizeData(
        data
    ) {

        const map =
            new Map();


        data.forEach(
            item => {

                const name =
                    cleanEndorsementName(
                        item.name
                    );


                if (
                    !name ||
                    isSummaryRow(
                        name
                    )
                ) {

                    return;

                }


                const key =
                    item.key ||
                    normalizeEndorsementKey(
                        name
                    );


                if (
                    !map.has(
                        key
                    )
                ) {

                    map.set(
                        key,
                        {

                            name,

                            key,

                            admitted:
                                null,

                            completers:
                                null

                        }
                    );

                }


                const target =
                    map.get(
                        key
                    );


                target.admitted =
                    addNullableValues(
                        target.admitted,
                        item.admitted
                    );


                target.completers =
                    addNullableValues(
                        target.completers,
                        item.completers
                    );

            }
        );


        return Array.from(
            map.values()
        )
            .sort(
                (
                    first,
                    second
                ) => {

                    const firstValue =
                        Math.max(
                            first.admitted ??
                            -1,
                            first.completers ??
                            -1
                        );


                    const secondValue =
                        Math.max(
                            second.admitted ??
                            -1,
                            second.completers ??
                            -1
                        );


                    return (
                        secondValue -
                        firstValue
                    );

                }
            );

    }


    function getMetricScore(
        sheetName,
        rows,
        patterns
    ) {

        let score =
            matchesAny(
                normalizeText(
                    sheetName
                ),
                patterns
            )
                ?
                20
                :
                0;


        rows
            .slice(
                0,
                8
            )
            .forEach(
                row => {

                    row.forEach(
                        cell => {

                            if (
                                matchesAny(
                                    normalizeText(
                                        cell
                                    ),
                                    patterns
                                )
                            ) {

                                score++;

                            }

                        }
                    );

                }
            );


        return score;

    }


    function chooseMetricSheet(
        profiles,
        scoreName,
        excluded = null
    ) {

        const sorted =
            profiles
                .filter(
                    profile =>
                        profile !==
                        excluded
                )
                .sort(
                    (
                        first,
                        second
                    ) =>
                        second[
                            scoreName
                        ]
                        -
                        first[
                            scoreName
                        ]
                );


        if (
            sorted.length === 0 ||
            sorted[0][
                scoreName
            ] <= 0
        ) {

            return null;

        }


        return sorted[0];

    }


    function findCombinedHeaderRow(
        rows
    ) {

        const limit =
            Math.min(
                rows.length,
                15
            );


        for (
            let index = 0;
            index < limit;
            index++
        ) {

            const row =
                rows[
                    index
                ] || [];


            const hasName =
                findHeaderColumn(
                    row,
                    NAME_PATTERNS
                ) >= 0;


            const hasAdmitted =
                findHeaderColumn(
                    row,
                    ADMITTED_PATTERNS
                ) >= 0;


            const hasCompleters =
                findHeaderColumn(
                    row,
                    COMPLETER_PATTERNS
                ) >= 0;


            if (
                hasName &&
                hasAdmitted &&
                hasCompleters
            ) {

                return index;

            }

        }


        return -1;

    }


    function findLongHeaderRow(
        rows
    ) {

        const limit =
            Math.min(
                rows.length,
                15
            );


        for (
            let index = 0;
            index < limit;
            index++
        ) {

            const row =
                rows[
                    index
                ] || [];


            if (
                findHeaderColumn(
                    row,
                    NAME_PATTERNS
                ) >= 0
                &&
                findHeaderColumn(
                    row,
                    METRIC_PATTERNS
                ) >= 0
            ) {

                return index;

            }

        }


        return -1;

    }


    function findSingleMetricHeaderRow(
        rows,
        year,
        metric
    ) {

        const limit =
            Math.min(
                rows.length,
                15
            );


        const patterns =
            metric ===
            "admitted"
                ?
                ADMITTED_PATTERNS
                :
                COMPLETER_PATTERNS;


        let bestIndex =
            0;


        let bestScore =
            -Infinity;


        for (
            let index = 0;
            index < limit;
            index++
        ) {

            const row =
                rows[
                    index
                ] || [];


            let score =
                0;


            row.forEach(
                cell => {

                    const text =
                        normalizeText(
                            cell
                        );


                    if (
                        matchesAny(
                            text,
                            NAME_PATTERNS
                        )
                    ) {

                        score +=
                            8;

                    }


                    if (
                        matchesAny(
                            text,
                            patterns
                        )
                    ) {

                        score +=
                            5;

                    }


                    if (
                        yearMatches(
                            cell,
                            year
                        )
                    ) {

                        score +=
                            8;

                    }

                }
            );


            if (
                score >
                bestScore
            ) {

                bestScore =
                    score;


                bestIndex =
                    index;

            }

        }


        return bestIndex;

    }


    function findHeaderColumn(
        row,
        patterns
    ) {

        for (
            let index = 0;
            index < row.length;
            index++
        ) {

            if (
                matchesAny(
                    normalizeText(
                        row[
                            index
                        ]
                    ),
                    patterns
                )
            ) {

                return index;

            }

        }


        return -1;

    }


    function findYearColumn(
        row,
        year
    ) {

        for (
            let index = 0;
            index < row.length;
            index++
        ) {

            if (
                yearMatches(
                    row[
                        index
                    ],
                    year
                )
            ) {

                return index;

            }

        }


        return -1;

    }


    function findMostTextualColumn(
        rows,
        headerIndex
    ) {

        const columnCount =
            getMaximumColumnCount(
                rows
            );


        let bestColumn =
            -1;


        let bestScore =
            -Infinity;


        for (
            let column = 0;
            column < columnCount;
            column++
        ) {

            let textValues =
                0;


            let numericValues =
                0;


            rows
                .slice(
                    headerIndex +
                    1
                )
                .forEach(
                    row => {

                        const value =
                            row[
                                column
                            ];


                        if (
                            isBlank(
                                value
                            )
                        ) {

                            return;

                        }


                        if (
                            parseNumericValue(
                                value
                            ) === null
                        ) {

                            textValues++;

                        }
                        else {

                            numericValues++;

                        }

                    }
                );


            const score =
                textValues *
                3
                -
                numericValues;


            if (
                score >
                bestScore
            ) {

                bestScore =
                    score;


                bestColumn =
                    column;

            }

        }


        return bestColumn;

    }


    function findMostNumericColumn(
        rows,
        headerIndex,
        excludedColumns = []
    ) {

        const columnCount =
            getMaximumColumnCount(
                rows
            );


        let bestColumn =
            -1;


        let bestCount =
            -1;


        for (
            let column = 0;
            column < columnCount;
            column++
        ) {

            if (
                excludedColumns.includes(
                    column
                )
            ) {

                continue;

            }


            let numericCount =
                0;


            rows
                .slice(
                    headerIndex +
                    1
                )
                .forEach(
                    row => {

                        if (
                            parseNumericValue(
                                row[
                                    column
                                ]
                            ) !== null
                        ) {

                            numericCount++;

                        }

                    }
                );


            if (
                numericCount >
                bestCount
            ) {

                bestCount =
                    numericCount;


                bestColumn =
                    column;

            }

        }


        return bestColumn;

    }


    function getMaximumColumnCount(
        rows
    ) {

        return Math.max(
            0,
            ...rows.map(
                row =>
                    row.length
            )
        );

    }


    function parseCSVMatrix(
        text
    ) {

        const rows = [];

        let row = [];

        let value = "";

        let insideQuotes =
            false;


        for (
            let index = 0;
            index < text.length;
            index++
        ) {

            const character =
                text[
                    index
                ];


            const nextCharacter =
                text[
                    index +
                    1
                ];


            if (
                character ===
                '"'
            ) {

                if (
                    insideQuotes &&
                    nextCharacter ===
                    '"'
                ) {

                    value +=
                        '"';


                    index++;

                }
                else {

                    insideQuotes =
                        !insideQuotes;

                }

            }

            else if (
                character ===
                ","
                &&
                !insideQuotes
            ) {

                row.push(
                    value.trim()
                );


                value =
                    "";

            }

            else if (
                (
                    character ===
                    "\n"
                    ||
                    character ===
                    "\r"
                )
                &&
                !insideQuotes
            ) {

                if (
                    character ===
                    "\r"
                    &&
                    nextCharacter ===
                    "\n"
                ) {

                    index++;

                }


                row.push(
                    value.trim()
                );


                value =
                    "";


                if (
                    row.some(
                        cell =>
                            !isBlank(
                                cell
                            )
                    )
                ) {

                    rows.push(
                        row
                    );

                }


                row =
                    [];

            }

            else {

                value +=
                    character;

            }

        }


        if (
            value !==
            ""
            ||
            row.length > 0
        ) {

            row.push(
                value.trim()
            );


            if (
                row.some(
                    cell =>
                        !isBlank(
                            cell
                        )
                )
            ) {

                rows.push(
                    row
                );

            }

        }


        return rows;

    }


    function cleanEndorsementName(
        value
    ) {

        return String(
            value ??
            ""
        )
            .replace(
                /Educatoin/gi,
                "Education"
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    }


    function normalizeEndorsementKey(
        value
    ) {

        return cleanEndorsementName(
            value
        )
            .normalize(
                "NFKD"
            )
            .toLowerCase()
            .replace(
                /&/g,
                " and "
            )
            .replace(
                /pre[\s-]?k/gi,
                " prek "
            )
            .replace(
                /[^a-z0-9]+/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    }


    function normalizeText(
        value
    ) {

        return String(
            value ??
            ""
        )
            .toLowerCase()
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    }


    function normalizeYear(
        value
    ) {

        const text =
            String(
                value ??
                ""
            )
                .replace(
                    /[–—]/g,
                    "-"
                )
                .replace(
                    /\//g,
                    "-"
                )
                .replace(
                    /academic\s*year/gi,
                    ""
                )
                .replace(
                    /\bay\b/gi,
                    ""
                )
                .replace(
                    /\s+/g,
                    ""
                )
                .trim();


        const fullMatch =
            text.match(
                /(20\d{2})-(20\d{2})/
            );


        if (
            fullMatch
        ) {

            return (
                `${fullMatch[1]}-${fullMatch[2]}`
            );

        }


        const shortMatch =
            text.match(
                /(20\d{2})-(\d{2})/
            );


        if (
            shortMatch
        ) {

            return (
                `${shortMatch[1]}-20${shortMatch[2]}`
            );

        }


        return text;

    }


    function yearMatches(
        value,
        year
    ) {

        const first =
            normalizeYear(
                value
            );


        const second =
            normalizeYear(
                year
            );


        return (
            first !==
            ""
            &&
            first ===
            second
        );

    }


    function parseNumericValue(
        value
    ) {

        if (
            typeof value ===
            "number"
            &&
            Number.isFinite(
                value
            )
        ) {

            return value;

        }


        const text =
            String(
                value ??
                ""
            )
                .replace(
                    /,/g,
                    ""
                )
                .trim();


        if (
            text ===
            ""
        ) {

            return null;

        }


        const number =
            Number(
                text
            );


        return Number.isFinite(
            number
        )
            ?
            number
            :
            null;

    }


    function matchesAny(
        text,
        patterns
    ) {

        return patterns.some(
            pattern =>
                pattern.test(
                    text
                )
        );

    }


    function isSummaryRow(
        name
    ) {

        const text =
            normalizeText(
                name
            );


        return (
            /^total\b/.test(
                text
            )
            ||
            /^grand total\b/.test(
                text
            )
        );

    }


    function isBlank(
        value
    ) {

        return String(
            value ??
            ""
        ).trim() ===
        "";

    }


    function addNullableValues(
        current,
        incoming
    ) {

        if (
            incoming ===
            null
        ) {

            return current;

        }


        if (
            current ===
            null
        ) {

            return incoming;

        }


        return (
            current +
            incoming
        );

    }


    window.EndorsementData = {

        fileBaseName:
            FILE_BASENAME,

        load,

        cleanEndorsementName,

        normalizeEndorsementKey

    };


})();