const STATISTICS_PATH =
    window.AcademicYear.getDataPath(
        "epp_statistics.csv"
    );


const CHART_FONT_FAMILY =
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';


const BRAND_STYLES =
    getComputedStyle(
        document.documentElement
    );


const JMU_PURPLE =
    BRAND_STYLES
        .getPropertyValue(
            "--jmu-purple"
        )
        .trim()
    ||
    "#450084";


const JMU_GOLD =
    BRAND_STYLES
        .getPropertyValue(
            "--jmu-gold"
        )
        .trim()
    ||
    "#dfd2aa";


const JMU_GOLD_BORDER =
    JMU_GOLD;


const JMU_GOLD_TEXT =
    JMU_GOLD;


let statisticsData = [];

let endorsementData = [];

let endorsementMode =
    "admitted";

let endorsementDataLoaded =
    false;

let endorsementChart =
    null;

let bodyBubbleTooltip =
    null;

let bubbleResizeTimer =
    null;


document.addEventListener(
    "DOMContentLoaded",
    () => {

        createBodyBubbleTooltip();

        setupEndorsementControls();

        updateEndorsementModeClasses();

        window.addEventListener(
            "resize",
            handleResize
        );

        loadStatisticsData();

        loadEndorsementData();

    }
);


async function loadStatisticsData() {

    try {

        const statisticsText =
            await fetchText(
                STATISTICS_PATH
            );


        statisticsData =
            parseCSV(
                statisticsText
            );


        normalizeData();

        renderOverview();

    }
    catch (
        error
    ) {

        console.error(
            "Unable to load EPP statistics data:",
            error
        );

    }

}


async function loadEndorsementData() {

    try {

        if (
            !window.EndorsementData
        ) {

            throw new Error(
                "endorsement-data.js is not loaded."
            );

        }


        const result =
            await window.EndorsementData.load();


        endorsementData =
            result.data.map(
                item => ({

                    name:
                        cleanEndorsementName(
                            item.name
                        ),

                    admitted:
                        normalizeMetricValue(
                            item.admitted
                        ),

                    completers:
                        normalizeMetricValue(
                            item.completers
                        )

                })
            );


        endorsementDataLoaded =
            true;


        updateEndorsementViews();

    }
    catch (
        error
    ) {

        endorsementData =
            [];

        endorsementDataLoaded =
            false;


        console.warn(
            "Endorsement data is not available for this academic year:",
            error
        );


        updateEndorsementViews();

    }

}


async function fetchText(
    path
) {

    const response =
        await fetch(
            path
        );


    if (
        !response.ok
    ) {

        throw new Error(
            `Unable to load ${path}`
        );

    }


    return await response.text();

}


function parseCSV(
    text
) {

    const rows =
        [];

    let row =
        [];

    let value =
        "";

    let insideQuotes =
        false;


    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        const character =
            text[i];

        const nextCharacter =
            text[
                i + 1
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

                i++;

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

                i++;

            }


            row.push(
                value.trim()
            );


            value =
                "";


            if (
                row.some(
                    cell =>
                        cell !==
                        ""
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
        value.length >
        0
        ||
        row.length >
        0
    ) {

        row.push(
            value.trim()
        );


        if (
            row.some(
                cell =>
                    cell !==
                    ""
            )
        ) {

            rows.push(
                row
            );

        }

    }


    if (
        rows.length <
        2
    ) {

        return [];

    }


    const headers =
        rows[0].map(
            header =>
                header.trim()
        );


    return rows
        .slice(
            1
        )
        .map(
            cells => {

                const record =
                    {};


                headers.forEach(
                    (
                        header,
                        index
                    ) => {

                        record[
                            header
                        ] =
                            cells[
                                index
                            ]
                            ??
                            "";

                    }
                );


                return record;

            }
        );

}


function normalizeData() {

    statisticsData =
        statisticsData.map(
            row => ({

                schoolYear:
                    row[
                        "School Year"
                    ],

                institution:
                    row[
                        "Institution Name"
                    ],

                category:
                    row[
                        "Category Name"
                    ],

                value:
                    Number(
                        row[
                            "Number of EPP Candidates Admitted this school year"
                        ]
                    ) || 0

            })
        );

}


function normalizeMetricValue(
    value
) {

    if (
        value ===
        null
        ||
        value ===
        undefined
        ||
        value ===
        ""
    ) {

        return null;

    }


    const numeric =
        Number(
            value
        );


    return Number.isFinite(
        numeric
    )
        ?
        numeric
        :
        null;

}


function cleanEndorsementName(
    name
) {

    if (
        !name
    ) {

        return "";

    }


    return String(
        name
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


function getStatistic(
    categoryName
) {

    const match =
        statisticsData.find(
            item =>
                String(
                    item.category ||
                    ""
                )
                    .toLowerCase()
                ===
                categoryName
                    .toLowerCase()
        );


    return match
        ?
        match.value
        :
        0;

}


function renderOverview() {

    const female =
        getStatistic(
            "Female"
        );

    const male =
        getStatistic(
            "Male"
        );

    const genderTotal =
        female +
        male;

    const femalePercent =
        percentage(
            female,
            genderTotal
        );

    const malePercent =
        percentage(
            male,
            genderTotal
        );


    setText(
        "femaleValue",
        formatNumber(
            female
        )
    );

    setText(
        "maleValue",
        formatNumber(
            male
        )
    );

    setText(
        "genderTotal",
        formatNumber(
            genderTotal
        )
    );

    setText(
        "femalePercent",
        `${femalePercent.toFixed(1)}%`
    );

    setText(
        "malePercent",
        `${malePercent.toFixed(1)}%`
    );


    animateWidth(
        "femaleBar",
        femalePercent
    );

    animateWidth(
        "maleBar",
        malePercent
    );


    const inState =
        getStatistic(
            "In-State"
        );

    const outState =
        getStatistic(
            "Out-of-State"
        );

    const residencyTotal =
        inState +
        outState;

    const inStatePercent =
        percentage(
            inState,
            residencyTotal
        );

    const outStatePercent =
        percentage(
            outState,
            residencyTotal
        );


    setText(
        "inStateValue",
        formatNumber(
            inState
        )
    );

    setText(
        "outStateValue",
        formatNumber(
            outState
        )
    );

    setText(
        "residencyTotal",
        formatNumber(
            residencyTotal
        )
    );

    setText(
        "inStatePercent",
        `${inStatePercent.toFixed(1)}%`
    );

    setText(
        "outStatePercent",
        `${outStatePercent.toFixed(1)}%`
    );


    animateWidth(
        "inStateBar",
        inStatePercent
    );

    animateWidth(
        "outStateBar",
        outStatePercent
    );


    const fullTime =
        getStatistic(
            "Full Time"
        );

    const partTime =
        getStatistic(
            "Part Time"
        );

    const enrollmentMaximum =
        Math.max(
            fullTime,
            partTime,
            1
        );


    setText(
        "fullTimeValue",
        formatNumber(
            fullTime
        )
    );

    setText(
        "partTimeValue",
        formatNumber(
            partTime
        )
    );


    animateWidth(
        "fullTimeBar",
        percentage(
            fullTime,
            enrollmentMaximum
        )
    );

    animateWidth(
        "partTimeBar",
        percentage(
            partTime,
            enrollmentMaximum
        )
    );


    const gpa =
        getStatistic(
            "Median GPA"
        );


    setText(
        "medianGpa",
        Number.isInteger(
            gpa
        )
            ?
            gpa.toFixed(
                1
            )
            :
            gpa.toString()
    );

}


function setupEndorsementControls() {

    document
        .getElementById(
            "endorsementSearch"
        )
        .addEventListener(
            "input",
            updateEndorsementViews
        );


    document
        .getElementById(
            "topNSelect"
        )
        .addEventListener(
            "change",
            updateEndorsementViews
        );


    document
        .getElementById(
            "includeZeros"
        )
        .addEventListener(
            "change",
            updateEndorsementViews
        );


    document
        .querySelectorAll(
            ".metric-mode-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        setEndorsementMode(
                            button.dataset.mode
                        );

                    }
                );

            }
        );

}


function updateEndorsementModeClasses() {

    document.body.classList.remove(
        "epp-mode-admitted",
        "epp-mode-completers",
        "epp-mode-compare"
    );


    document.body.classList.add(
        `epp-mode-${endorsementMode}`
    );

}


function setEndorsementMode(
    mode
) {

    if (
        ![
            "admitted",
            "completers",
            "compare"
        ].includes(
            mode
        )
    ) {

        return;

    }


    endorsementMode =
        mode;


    updateEndorsementModeClasses();


    document
        .querySelectorAll(
            ".metric-mode-button"
        )
        .forEach(
            button => {

                const active =
                    button.dataset.mode
                    ===
                    endorsementMode;


                button.classList.toggle(
                    "is-active",
                    active
                );


                button.setAttribute(
                    "aria-pressed",
                    active
                        ?
                        "true"
                        :
                        "false"
                );

            }
        );


    const legend =
        document.getElementById(
            "barModeLegend"
        );


    if (
        legend
    ) {

        legend.hidden =
            endorsementMode !==
            "compare";

    }


    updateBubbleDescription();

    updateEndorsementViews();

}


function updateBubbleDescription() {

    let text =
        "Hover over a bubble to explore endorsement details. Bubble size represents admitted candidate counts.";


    if (
        endorsementMode ===
        "completers"
    ) {

        text =
            "Hover over a bubble to explore endorsement details. Bubble size represents completer counts.";

    }


    if (
        endorsementMode ===
        "compare"
    ) {

        text =
            "Each bubble is split into two equal halves: purple on the left represents admitted candidates and gold on the right represents completers. Bubble size reflects the larger reported counts.";

    }


    setText(
        "bubbleVisualizationDescription",
        text
    );

}


function getFilteredEndorsements() {

    const searchValue =
        document
            .getElementById(
                "endorsementSearch"
            )
            .value
            .trim()
            .toLowerCase();


    const topNValue =
        document
            .getElementById(
                "topNSelect"
            )
            .value;


    const includeZeros =
        document
            .getElementById(
                "includeZeros"
            )
            .checked;


    let filtered =
        endorsementData.filter(
            item => {

                const searchMatch =
                    !searchValue
                    ||
                    item.name
                        .toLowerCase()
                        .includes(
                            searchValue
                        );


                return (
                    searchMatch
                    &&
                    shouldIncludeEndorsement(
                        item,
                        includeZeros
                    )
                );

            }
        );


    filtered.sort(
        (
            first,
            second
        ) =>
            getSortValue(
                second
            )
            -
            getSortValue(
                first
            )
    );


    if (
        topNValue !==
        "all"
    ) {

        filtered =
            filtered.slice(
                0,
                Number(
                    topNValue
                )
            );

    }


    return filtered;

}


function shouldIncludeEndorsement(
    item,
    includeZeros
) {

    if (
        endorsementMode ===
        "admitted"
    ) {

        if (
            item.admitted ===
            null
        ) {

            return false;

        }


        return (
            includeZeros
            ||
            item.admitted >
            0
        );

    }


    if (
        endorsementMode ===
        "completers"
    ) {

        if (
            item.completers ===
            null
        ) {

            return false;

        }


        return (
            includeZeros
            ||
            item.completers >
            0
        );

    }


    const hasAnyValue =
        item.admitted !==
        null
        ||
        item.completers !==
        null;


    if (
        !hasAnyValue
    ) {

        return false;

    }


    if (
        includeZeros
    ) {

        return true;

    }


    return (
        (
            item.admitted !==
            null
            &&
            item.admitted >
            0
        )
        ||
        (
            item.completers !==
            null
            &&
            item.completers >
            0
        )
    );

}


function getSortValue(
    item
) {

    if (
        endorsementMode ===
        "admitted"
    ) {

        return item.admitted ??
            -1;

    }


    if (
        endorsementMode ===
        "completers"
    ) {

        return item.completers ??
            -1;

    }


    return Math.max(
        item.admitted ??
        -1,
        item.completers ??
        -1
    );

}


function getBubbleMagnitude(
    item
) {

    if (
        endorsementMode ===
        "admitted"
    ) {

        return Math.max(
            item.admitted ??
            0,
            0
        );

    }


    if (
        endorsementMode ===
        "completers"
    ) {

        return Math.max(
            item.completers ??
            0,
            0
        );

    }


    return Math.max(
        item.admitted ??
        0,
        item.completers ??
        0
    );

}


function updateEndorsementViews() {

    if (
        !endorsementDataLoaded
    ) {

        setText(
            "endorsementCount",
            "—"
        );

        setText(
            "largestEndorsementCount",
            "—"
        );

        setText(
            "endorsementTotal",
            "—"
        );

        setText(
            "resultsLabel",
            "Data not available"
        );


        resetBubbleDetail();

        showDataError();

        return;

    }


    const filtered =
        getFilteredEndorsements();


    updateEndorsementSummary();


    renderEndorsementBarChart(
        filtered
    );


    renderBubbleChart(
        filtered
    );


    updateResultLabel(
        filtered.length
    );


    resetBubbleDetail();

}


function updateEndorsementSummary() {

    if (
        endorsementMode ===
        "admitted"
    ) {

        const reported =
            endorsementData.filter(
                item =>
                    item.admitted !==
                    null
            );


        const values =
            reported.map(
                item =>
                    item.admitted
            );


        setText(
            "endorsementCount",
            formatNumber(
                reported.length
            )
        );


        setText(
            "summarySecondLabel",
            "Highest admitted"
        );


        setText(
            "largestEndorsementCount",
            formatNumber(
                values.length
                    ?
                    Math.max(
                        ...values
                    )
                    :
                    0
            )
        );


        setText(
            "summaryThirdLabel",
            "Total admitted"
        );


        setText(
            "endorsementTotal",
            formatNumber(
                sumValues(
                    values
                )
            )
        );


        return;

    }


    if (
        endorsementMode ===
        "completers"
    ) {

        const reported =
            endorsementData.filter(
                item =>
                    item.completers !==
                    null
            );


        const values =
            reported.map(
                item =>
                    item.completers
            );


        setText(
            "endorsementCount",
            formatNumber(
                reported.length
            )
        );


        setText(
            "summarySecondLabel",
            "Highest completers"
        );


        setText(
            "largestEndorsementCount",
            formatNumber(
                values.length
                    ?
                    Math.max(
                        ...values
                    )
                    :
                    0
            )
        );


        setText(
            "summaryThirdLabel",
            "Total completers"
        );


        setText(
            "endorsementTotal",
            formatNumber(
                sumValues(
                    values
                )
            )
        );


        return;

    }


    const reported =
        endorsementData.filter(
            item =>
                item.admitted !==
                null
                ||
                item.completers !==
                null
        );


    setText(
        "endorsementCount",
        formatNumber(
            reported.length
        )
    );


    setText(
        "summarySecondLabel",
        "Total admitted"
    );


    setText(
        "largestEndorsementCount",
        formatNumber(
            sumMetric(
                "admitted"
            )
        )
    );


    setText(
        "summaryThirdLabel",
        "Total completers"
    );


    setText(
        "endorsementTotal",
        formatNumber(
            sumMetric(
                "completers"
            )
        )
    );

}


function sumMetric(
    metric
) {

    return endorsementData.reduce(
        (
            total,
            item
        ) => {

            const value =
                item[
                    metric
                ];


            return value ===
                null
                ?
                total
                :
                total +
                value;

        },
        0
    );

}


function sumValues(
    values
) {

    return values.reduce(
        (
            total,
            value
        ) =>
            total +
            value,
        0
    );

}


function updateResultLabel(
    count
) {

    const topN =
        document
            .getElementById(
                "topNSelect"
            )
            .value;


    const search =
        document
            .getElementById(
                "endorsementSearch"
            )
            .value
            .trim();


    let label;


    if (
        search
    ) {

        label =
            `${count} result${count === 1 ? "" : "s"}`;

    }

    else if (
        topN ===
        "all"
    ) {

        label =
            `Showing ${count}`;

    }

    else {

        label =
            `Showing top ${count}`;

    }


    setText(
        "resultsLabel",
        label
    );

}


function renderEndorsementBarChart(
    data
) {

    const element =
        document.getElementById(
            "endorsementBarChart"
        );


    if (
        !endorsementChart
    ) {

        endorsementChart =
            echarts.init(
                element,
                null,
                {
                    renderer:
                        "canvas"
                }
            );

    }


    if (
        data.length ===
        0
    ) {

        endorsementChart.clear();


        endorsementChart.setOption(
            createEmptyChartOption()
        );


        return;

    }


    if (
        endorsementMode ===
        "compare"
    ) {

        renderCompareBarChart(
            data
        );


        return;

    }


    renderSingleMetricBarChart(
        data
    );

}


function createEmptyChartOption() {

    return {

        textStyle: {

            fontFamily:
                CHART_FONT_FAMILY

        },

        title: {

            text:
                "No matching endorsements",

            left:
                "center",

            top:
                "middle",

            textStyle: {

                color:
                    "#8f939c",

                fontFamily:
                    CHART_FONT_FAMILY,

                fontSize:
                    13,

                fontWeight:
                    500

            }

        },

        xAxis: {
            show:
                false
        },

        yAxis: {
            show:
                false
        },

        series:
            []

    };

}


function getBaseBarChartOption(
    data
) {

    return {

        animationDuration:
            550,

        textStyle: {

            fontFamily:
                CHART_FONT_FAMILY

        },

        grid: {

            left:
                220,

            right:
                62,

            top:
                endorsementMode ===
                "compare"
                    ?
                    38
                    :
                    18,

            bottom:
                30

        },

        xAxis: {

            type:
                "value",

            min:
                0,

            axisLine: {
                show:
                    false
            },

            axisTick: {
                show:
                    false
            },

            splitLine: {

                lineStyle: {
                    color:
                        "#f0f0f2"
                }

            },

            axisLabel: {

                color:
                    "#8f939c",

                fontFamily:
                    CHART_FONT_FAMILY,

                fontSize:
                    12

            }

        },

        yAxis: {

            type:
                "category",

            inverse:
                true,

            data:
                data.map(
                    item =>
                        item.name
                ),

            axisLine: {
                show:
                    false
            },

            axisTick: {
                show:
                    false
            },

            axisLabel: {

                color:
                    "#5d616b",

                fontFamily:
                    CHART_FONT_FAMILY,

                fontSize:
                    12,

                width:
                    195,

                overflow:
                    "truncate",

                margin:
                    12

            }

        }

    };

}


function renderSingleMetricBarChart(
    data
) {

    const metric =
        endorsementMode;

    const admittedMode =
        metric ===
        "admitted";

    const label =
        admittedMode
            ?
            "Admitted"
            :
            "Completers";


    const option =
        getBaseBarChartOption(
            data
        );


    option.tooltip = {

        trigger:
            "axis",

        axisPointer: {

            type:
                "shadow",

            shadowStyle: {

                color:
                    "rgba(69, 0, 132, 0.035)"

            }

        },

        confine:
            true,

        extraCssText:
            "min-width:320px;max-width:420px;white-space:normal;",

        backgroundColor:
            "rgba(28,25,31,0.96)",

        borderWidth:
            0,

        textStyle: {

            color:
                "#ffffff",

            fontFamily:
                CHART_FONT_FAMILY,

            fontSize:
                13

        },

        formatter:
            params => {

                const item =
                    data[
                        params[0]
                            .dataIndex
                    ];


                return `
                    <div style="
                        min-width:300px;
                        max-width:390px;
                        line-height:1.5;
                        white-space:normal;
                        font-family:${CHART_FONT_FAMILY};
                    ">

                        <div style="
                            font-weight:700;
                            margin-bottom:6px;
                            white-space:normal;
                            overflow-wrap:anywhere;
                        ">
                            ${escapeHTML(
                                item.name
                            )}
                        </div>

                        <div>
                            ${label}:
                            <strong>
                                ${formatMetricValue(
                                    item[
                                        metric
                                    ]
                                )}
                            </strong>
                        </div>

                    </div>
                `;

            }

    };


    option.series = [

        {

            name:
                label,

            type:
                "bar",

            data:
                data.map(
                    item =>
                        item[
                            metric
                        ]
                ),

            barMaxWidth:
                18,

            showBackground:
                true,

            backgroundStyle: {

                color:
                    "#f3f1f5",

                borderRadius:
                    20

            },

            itemStyle: {

                borderRadius:
                    [
                        0,
                        6,
                        6,
                        0
                    ],

                color:
                    admittedMode
                        ?
                        JMU_PURPLE
                        :
                        JMU_GOLD,

                borderColor:
                    admittedMode
                        ?
                        JMU_PURPLE
                        :
                        JMU_GOLD_BORDER,

                borderWidth:
                    admittedMode
                        ?
                        0
                        :
                        1

            },

            label: {

                show:
                    true,

                position:
                    "right",

                color:
                    admittedMode
                        ?
                        JMU_PURPLE
                        :
                        JMU_GOLD_TEXT,

                fontSize:
                    12,

                formatter:
                    params =>
                        params.value ===
                        null
                            ?
                            ""
                            :
                            formatNumber(
                                params.value
                            )

            }

        }

    ];


    endorsementChart.setOption(
        option,
        true
    );

}


function renderCompareBarChart(
    data
) {

    const option =
        getBaseBarChartOption(
            data
        );


    option.tooltip = {

        trigger:
            "axis",

        axisPointer: {

            type:
                "shadow",

            shadowStyle: {

                color:
                    "rgba(69, 0, 132, 0.035)"

            }

        },

        confine:
            true,

        extraCssText:
            "min-width:330px;max-width:430px;white-space:normal;",

        backgroundColor:
            "rgba(28,25,31,0.96)",

        borderWidth:
            0,

        textStyle: {

            color:
                "#ffffff",

            fontFamily:
                CHART_FONT_FAMILY,

            fontSize:
                13

        },

        formatter:
            params => {

                const item =
                    data[
                        params[0]
                            .dataIndex
                    ];


                return createCompareTooltipHTML(
                    item
                );

            }

    };


    option.series = [

        {

            name:
                "Admitted",

            type:
                "bar",

            data:
                data.map(
                    item =>
                        item.admitted
                ),

            barWidth:
                9,

            barGap:
                "35%",

            barCategoryGap:
                "44%",

            itemStyle: {

                color:
                    JMU_PURPLE,

                borderRadius:
                    [
                        0,
                        5,
                        5,
                        0
                    ]

            },

            emphasis: {

                focus:
                    "none",

                itemStyle: {

                    color:
                        JMU_PURPLE,

                    opacity:
                        1

                }

            },

            label: {

                show:
                    true,

                position:
                    "right",

                distance:
                    4,

                color:
                    JMU_PURPLE,

                fontSize:
                    10,

                formatter:
                    params =>
                        params.value ===
                        null
                            ?
                            ""
                            :
                            formatNumber(
                                params.value
                            )

            },

            z:
                2

        },

        {

            name:
                "Completers",

            type:
                "bar",

            data:
                data.map(
                    item =>
                        item.completers
                ),

            barWidth:
                9,

            barGap:
                "35%",

            barCategoryGap:
                "44%",

            itemStyle: {

                color:
                    JMU_GOLD,

                borderColor:
                    JMU_GOLD,

                borderWidth:
                    1,

                borderRadius:
                    [
                        0,
                        5,
                        5,
                        0
                    ]

            },

            emphasis: {

                focus:
                    "none",

                itemStyle: {

                    color:
                        JMU_GOLD,

                    borderColor:
                        JMU_GOLD,

                    borderWidth:
                        1,

                    opacity:
                        1

                }

            },

            label: {

                show:
                    true,

                position:
                    "right",

                distance:
                    4,

                color:
                    JMU_GOLD,

                fontSize:
                    10,

                formatter:
                    params =>
                        params.value ===
                        null
                            ?
                            ""
                            :
                            formatNumber(
                                params.value
                            )

            },

            z:
                2

        }

    ];


    endorsementChart.setOption(
        option,
        true
    );

}


function createBodyBubbleTooltip() {

    const existing =
        document.querySelector(
            ".body-bubble-tooltip"
        );


    if (
        existing
    ) {

        existing.remove();

    }


    bodyBubbleTooltip =
        document.createElement(
            "div"
        );


    bodyBubbleTooltip.className =
        "body-bubble-tooltip";


    document.body.appendChild(
        bodyBubbleTooltip
    );

}


function renderBubbleChart(
    data
) {

    const container =
        document.getElementById(
            "endorsementBubbleChart"
        );


    container.innerHTML =
        "";


    const visibleData =
        data.slice(
            0,
            12
        );


    if (
        visibleData.length ===
        0
    ) {

        renderBubbleEmptyState(
            container
        );


        return;

    }


    const width =
        container.clientWidth;

    const height =
        container.clientHeight;


    if (
        width <=
        20
        ||
        height <=
        20
    ) {

        return;

    }


    const bubbles =
        createBubbleGeometry(
            visibleData,
            width,
            height
        );


    solveBubblePacking(
        bubbles,
        width,
        height
    );


    bubbles.forEach(
        bubble => {

            container.appendChild(
                createBubbleElement(
                    bubble
                )
            );

        }
    );

}


function createBubbleGeometry(
    data,
    width,
    height
) {

    const magnitudes =
        data.map(
            item =>
                getBubbleMagnitude(
                    item
                )
        );


    const totalValue =
        magnitudes.reduce(
            (
                total,
                value
            ) =>
                total
                +
                Math.max(
                    value,
                    0
                ),
            0
        );


    const targetFill =
        data.length <=
        10
            ?
            0.24
            :
            0.21;


    let scale =
        Math.sqrt(
            (
                width
                *
                height
                *
                targetFill
            )
            /
            (
                Math.PI
                *
                Math.max(
                    totalValue,
                    1
                )
            )
        );


    const maximumValue =
        Math.max(
            ...magnitudes,
            1
        );


    const theoreticalLargestRadius =
        Math.sqrt(
            maximumValue
        )
        *
        scale;


    const allowedMaximumRadius =
        Math.min(
            width,
            height
        )
        *
        0.18;


    if (
        theoreticalLargestRadius
        >
        allowedMaximumRadius
    ) {

        scale *=
            allowedMaximumRadius
            /
            theoreticalLargestRadius;

    }


    const minimumRadius =
        endorsementMode ===
        "compare"
            ?
            28
            :
            (
                data.length <=
                10
                    ?
                    24
                    :
                    19
            );


    return data.map(
        (
            item,
            index
        ) => {

            const radius =
                Math.max(
                    minimumRadius,
                    Math.sqrt(
                        Math.max(
                            getBubbleMagnitude(
                                item
                            ),
                            0
                        )
                    )
                    *
                    scale
                );


            const angle =
                index
                *
                2.399963229728653;


            const spiralDistance =
                22
                +
                Math.sqrt(
                    index
                )
                *
                45;


            return {

                item,

                r:
                    radius,

                x:
                    width
                    /
                    2
                    +
                    Math.cos(
                        angle
                    )
                    *
                    spiralDistance,

                y:
                    height
                    /
                    2
                    +
                    Math.sin(
                        angle
                    )
                    *
                    spiralDistance

            };

        }
    );

}


function solveBubblePacking(
    bubbles,
    width,
    height
) {

    const padding =
        9;

    const boundaryPadding =
        14;

    const centerX =
        width
        /
        2;

    const centerY =
        height
        /
        2;


    bubbles.sort(
        (
            first,
            second
        ) =>
            second.r
            -
            first.r
    );


    if (
        bubbles.length >
        0
    ) {

        bubbles[0].x =
            centerX;

        bubbles[0].y =
            centerY;

    }


    for (
        let iteration =
            0;
        iteration <
        700;
        iteration++
    ) {

        const attraction =
            0.0043;


        bubbles.forEach(
            (
                bubble,
                index
            ) => {

                const weight =
                    index ===
                    0
                        ?
                        0.08
                        :
                        1;


                bubble.x +=
                    (
                        centerX
                        -
                        bubble.x
                    )
                    *
                    attraction
                    *
                    weight;


                bubble.y +=
                    (
                        centerY
                        -
                        bubble.y
                    )
                    *
                    attraction
                    *
                    weight;

            }
        );


        for (
            let i =
                0;
            i <
            bubbles.length;
            i++
        ) {

            for (
                let j =
                    i + 1;
                j <
                bubbles.length;
                j++
            ) {

                const first =
                    bubbles[
                        i
                    ];

                const second =
                    bubbles[
                        j
                    ];


                let dx =
                    second.x
                    -
                    first.x;

                let dy =
                    second.y
                    -
                    first.y;


                let distance =
                    Math.sqrt(
                        dx
                        *
                        dx
                        +
                        dy
                        *
                        dy
                    );


                const requiredDistance =
                    first.r
                    +
                    second.r
                    +
                    padding;


                if (
                    distance <
                    0.001
                ) {

                    dx =
                        Math.random()
                        -
                        0.5;

                    dy =
                        Math.random()
                        -
                        0.5;


                    distance =
                        Math.sqrt(
                            dx
                            *
                            dx
                            +
                            dy
                            *
                            dy
                        );

                }


                if (
                    distance <
                    requiredDistance
                ) {

                    const overlap =
                        requiredDistance
                        -
                        distance;


                    const nx =
                        dx
                        /
                        distance;

                    const ny =
                        dy
                        /
                        distance;


                    const totalRadius =
                        first.r
                        +
                        second.r;


                    const firstShare =
                        second.r
                        /
                        totalRadius;

                    const secondShare =
                        first.r
                        /
                        totalRadius;


                    first.x -=
                        nx
                        *
                        overlap
                        *
                        firstShare
                        *
                        0.52;


                    first.y -=
                        ny
                        *
                        overlap
                        *
                        firstShare
                        *
                        0.52;


                    second.x +=
                        nx
                        *
                        overlap
                        *
                        secondShare
                        *
                        0.52;


                    second.y +=
                        ny
                        *
                        overlap
                        *
                        secondShare
                        *
                        0.52;

                }

            }

        }


        bubbles.forEach(
            bubble => {

                bubble.x =
                    clamp(
                        bubble.x,
                        bubble.r
                        +
                        boundaryPadding,
                        width
                        -
                        bubble.r
                        -
                        boundaryPadding
                    );


                bubble.y =
                    clamp(
                        bubble.y,
                        bubble.r
                        +
                        boundaryPadding,
                        height
                        -
                        bubble.r
                        -
                        boundaryPadding
                    );

            }
        );

    }

}


function createBubbleElement(
    bubble
) {

    const element =
        document.createElement(
            "div"
        );


    element.className =
        `endorsement-bubble mode-${endorsementMode}`;


    if (
        bubble.r >=
        58
    ) {

        element.classList.add(
            "bubble-large"
        );

    }

    else if (
        bubble.r <
        35
    ) {

        element.classList.add(
            "bubble-small"
        );

    }


    const diameter =
        bubble.r
        *
        2;


    element.style.width =
        `${diameter}px`;

    element.style.height =
        `${diameter}px`;

    element.style.left =
        `${bubble.x - bubble.r}px`;

    element.style.top =
        `${bubble.y - bubble.r}px`;


    if (
        endorsementMode ===
        "compare"
    ) {

        renderCompareBubbleContent(
            element,
            bubble.item
        );

    }

    else {

        renderSingleBubbleContent(
            element,
            bubble.item,
            bubble.r
        );

    }


    element.addEventListener(
        "mouseenter",
        event => {

            activateBubble(
                element,
                bubble.item
            );


            showBubbleTooltip(
                bubble.item,
                event
            );

        }
    );


    element.addEventListener(
        "mousemove",
        event => {

            positionBubbleTooltip(
                event
            );

        }
    );


    element.addEventListener(
        "mouseleave",
        () => {

            deactivateBubble(
                element
            );


            hideBubbleTooltip();

        }
    );


    element.tabIndex =
        0;


    element.setAttribute(
        "role",
        "button"
    );


    element.setAttribute(
        "aria-label",
        createBubbleAriaLabel(
            bubble.item
        )
    );


    element.addEventListener(
        "focus",
        event => {

            activateBubble(
                element,
                bubble.item
            );


            showBubbleTooltip(
                bubble.item,
                event
            );

        }
    );


    element.addEventListener(
        "blur",
        () => {

            deactivateBubble(
                element
            );


            hideBubbleTooltip();

        }
    );


    return element;

}


function renderSingleBubbleContent(
    element,
    item,
    radius
) {

    const metric =
        endorsementMode;

    const value =
        item[
            metric
        ];


    if (
        metric ===
        "admitted"
    ) {

        const maximum =
            Math.max(
                ...endorsementData.map(
                    entry =>
                        entry.admitted
                        ??
                        0
                ),
                1
            );


        const normalized =
            (
                value
                ??
                0
            )
            /
            maximum;


        const lightness =
            50
            -
            normalized
            *
            17;


        element.style.setProperty(
            "--bubble-lightness",
            `${lightness}%`
        );

    }


    const showName =
        radius >=
        40;


    element.innerHTML =
        `
            <span class="bubble-number">
                ${formatMetricValue(
                    value
                )}
            </span>

            ${
                showName
                    ?
                    `
                        <span class="bubble-name">
                            ${escapeHTML(
                                shortName(
                                    item.name
                                )
                            )}
                        </span>
                    `
                    :
                    ""
            }
        `;

}


function renderCompareBubbleContent(
    element,
    item
) {

    element.innerHTML =
        `
            <div class="compare-half compare-admitted-half">

                <span class="compare-metric-label">
                    A
                </span>

                <strong>
                    ${formatMetricValue(
                        item.admitted
                    )}
                </strong>

            </div>

            <div class="compare-half compare-completers-half">

                <span class="compare-metric-label">
                    C
                </span>

                <strong>
                    ${formatMetricValue(
                        item.completers
                    )}
                </strong>

            </div>

            <span class="compare-bubble-name">
                ${escapeHTML(
                    shortName(
                        item.name
                    )
                )}
            </span>
        `;

}


function createBubbleAriaLabel(
    item
) {

    if (
        endorsementMode ===
        "admitted"
    ) {

        return (
            `${item.name}: ${formatMetricValue(item.admitted)} admitted`
        );

    }


    if (
        endorsementMode ===
        "completers"
    ) {

        return (
            `${item.name}: ${formatMetricValue(item.completers)} completers`
        );

    }


    return (
        `${item.name}: ${formatMetricValue(item.admitted)} admitted, ${formatMetricValue(item.completers)} completers`
    );

}


function activateBubble(
    element,
    item
) {

    const container =
        document.getElementById(
            "endorsementBubbleChart"
        );


    container.classList.add(
        "is-exploring"
    );


    container
        .querySelectorAll(
            ".endorsement-bubble"
        )
        .forEach(
            bubble =>
                bubble.classList.remove(
                    "active"
                )
        );


    element.classList.add(
        "active"
    );


    updateBubbleDetail(
        item
    );

}


function deactivateBubble(
    element
) {

    const container =
        document.getElementById(
            "endorsementBubbleChart"
        );


    element.classList.remove(
        "active"
    );


    container.classList.remove(
        "is-exploring"
    );

}


function showBubbleTooltip(
    item,
    event
) {

    if (
        !bodyBubbleTooltip
    ) {

        return;

    }


    if (
        endorsementMode ===
        "compare"
    ) {

        bodyBubbleTooltip.innerHTML =
            createCompareTooltipHTML(
                item
            );

    }

    else if (
        endorsementMode ===
        "completers"
    ) {

        bodyBubbleTooltip.innerHTML =
            `
                <span class="tooltip-title">
                    ${escapeHTML(
                        item.name
                    )}
                </span>

                <div class="tooltip-row">

                    <span>
                        Completers
                    </span>

                    <strong>
                        ${formatMetricValue(
                            item.completers
                        )}
                    </strong>

                </div>
            `;

    }

    else {

        bodyBubbleTooltip.innerHTML =
            `
                <span class="tooltip-title">
                    ${escapeHTML(
                        item.name
                    )}
                </span>

                <div class="tooltip-row tooltip-row-admitted">

                    <span>
                        Admitted candidates
                    </span>

                    <strong>
                        ${formatMetricValue(
                            item.admitted
                        )}
                    </strong>

                </div>
            `;

    }


    bodyBubbleTooltip.style.display =
        "block";


    positionBubbleTooltip(
        event
    );

}


function createCompareTooltipHTML(
    item
) {

    return `
        <div style="
            min-width:260px;
            max-width:320px;
            line-height:1.5;
            white-space:normal;
            font-family:${CHART_FONT_FAMILY};
        ">

            <span
                class="tooltip-title"
                style="
                    color:#ffffff;
                    white-space:normal;
                    overflow-wrap:anywhere;
                "
            >
                ${escapeHTML(
                    item.name
                )}
            </span>

            <div
                class="tooltip-row tooltip-row-admitted"
                style="
                    display:flex;
                    align-items:baseline;
                    justify-content:space-between;
                    gap:22px;
                    color:rgba(255,255,255,0.78);
                "
            >

                <span>
                    Admitted
                </span>

                <strong
                    style="
                        color:#ffffff;
                    "
                >
                    ${formatMetricValue(
                        item.admitted
                    )}
                </strong>

            </div>

            <div
                class="tooltip-row tooltip-row-completers"
                style="
                    display:flex;
                    align-items:baseline;
                    justify-content:space-between;
                    gap:22px;
                    color:${JMU_GOLD};
                "
            >

                <span
                    style="
                        color:${JMU_GOLD};
                    "
                >
                    Completers
                </span>

                <strong
                    style="
                        color:${JMU_GOLD};
                    "
                >
                    ${formatMetricValue(
                        item.completers
                    )}
                </strong>

            </div>

        </div>
    `;

}


function positionBubbleTooltip(
    event
) {

    if (
        !bodyBubbleTooltip
        ||
        bodyBubbleTooltip.style.display ===
        "none"
    ) {

        return;

    }


    let mouseX =
        event.clientX;

    let mouseY =
        event.clientY;


    if (
        typeof mouseX !==
        "number"
        ||
        typeof mouseY !==
        "number"
    ) {

        const bounds =
            event.target
                .getBoundingClientRect();


        mouseX =
            bounds.right;

        mouseY =
            bounds.top
            +
            bounds.height
            /
            2;

    }


    const margin =
        14;

    const viewportPadding =
        12;


    const tooltipRect =
        bodyBubbleTooltip
            .getBoundingClientRect();


    let left =
        mouseX
        +
        margin;

    let top =
        mouseY
        +
        margin;


    if (
        left
        +
        tooltipRect.width
        >
        window.innerWidth
        -
        viewportPadding
    ) {

        left =
            mouseX
            -
            tooltipRect.width
            -
            margin;

    }


    if (
        top
        +
        tooltipRect.height
        >
        window.innerHeight
        -
        viewportPadding
    ) {

        top =
            mouseY
            -
            tooltipRect.height
            -
            margin;

    }


    bodyBubbleTooltip.style.left =
        `${Math.max(
            viewportPadding,
            left
        )}px`;


    bodyBubbleTooltip.style.top =
        `${Math.max(
            viewportPadding,
            top
        )}px`;

}


function hideBubbleTooltip() {

    if (
        bodyBubbleTooltip
    ) {

        bodyBubbleTooltip.style.display =
            "none";

    }

}


function updateBubbleDetail(
    item
) {

    const detail =
        document.getElementById(
            "bubbleDetail"
        );


    detail.classList.add(
        "has-selection"
    );


    detail.classList.remove(
        "detail-mode-admitted",
        "detail-mode-completers",
        "detail-mode-compare"
    );


    const valueElement =
        document.getElementById(
            "bubbleDetailValue"
        );


    valueElement.classList.toggle(
        "compare-value",
        endorsementMode ===
        "compare"
    );


    setText(
        "bubbleDetailName",
        item.name
    );


    if (
        endorsementMode ===
        "admitted"
    ) {

        detail.classList.add(
            "detail-mode-admitted"
        );


        setText(
            "bubbleDetailDescription",
            "Admitted candidates reported for this endorsement area."
        );


        valueElement.textContent =
            formatMetricValue(
                item.admitted
            );


        return;

    }


    if (
        endorsementMode ===
        "completers"
    ) {

        detail.classList.add(
            "detail-mode-completers"
        );


        setText(
            "bubbleDetailDescription",
            "Completers reported for this endorsement area."
        );


        valueElement.textContent =
            formatMetricValue(
                item.completers
            );


        return;

    }


    detail.classList.add(
        "detail-mode-compare"
    );


    setText(
        "bubbleDetailDescription",
        `${formatMetricValue(item.admitted)} admitted · ${formatMetricValue(item.completers)} completers`
    );


    valueElement.innerHTML =
        `<span class="compare-value-admitted">${formatMetricValue(item.admitted)}</span><span class="compare-value-divider"> / </span><span class="compare-value-completers">${formatMetricValue(item.completers)}</span>`;

}


function resetBubbleDetail() {

    const detail =
        document.getElementById(
            "bubbleDetail"
        );


    if (
        !detail
    ) {

        return;

    }


    detail.classList.remove(
        "has-selection",
        "detail-mode-admitted",
        "detail-mode-completers",
        "detail-mode-compare"
    );


    if (
        endorsementMode ===
        "completers"
    ) {

        detail.classList.add(
            "detail-mode-completers"
        );

    }


    if (
        endorsementMode ===
        "compare"
    ) {

        detail.classList.add(
            "detail-mode-compare"
        );

    }


    const valueElement =
        document.getElementById(
            "bubbleDetailValue"
        );


    if (
        valueElement
    ) {

        valueElement.classList.remove(
            "compare-value"
        );


        valueElement.textContent =
            "—";

    }


    setText(
        "bubbleDetailName",
        "Select an endorsement bubble"
    );


    setText(
        "bubbleDetailDescription",
        "Hover over any bubble above to view the full endorsement name and reported count."
    );

}


function renderBubbleEmptyState(
    container
) {

    const empty =
        document.createElement(
            "div"
        );


    empty.className =
        "bubble-empty-state";


    empty.innerHTML =
        `
            <strong>
                No matching endorsements
            </strong>

            <span>
                Try adjusting the search or display filters.
            </span>
        `;


    container.appendChild(
        empty
    );

}


function shortName(
    name
) {

    const substitutions =
        {

            "Elementary Education PreK-6":
                "Elementary",

            "Admin and Supervision PreK-12":
                "Admin & Supervision",

            "Reading Specialist":
                "Reading",

            "Early/Primary Education PreK-3":
                "Early / Primary",

            "Early Childhood Special Education":
                "Early Childhood",

            "Special Education - General Curriculum K-12":
                "SPED General",

            "Special Education - Adapted Curriculum K-12":
                "SPED Adapted",

            "History and Social Sciences":
                "History & Social Sciences",

            "Health and Physical Educ. PreK-12":
                "Health & PE"

        };


    if (
        substitutions[
            name
        ]
    ) {

        return substitutions[
            name
        ];

    }


    if (
        name.length <=
        20
    ) {

        return name;

    }


    return (
        name.slice(
            0,
            18
        )
        +
        "…"
    );

}


function handleResize() {

    if (
        !endorsementDataLoaded
    ) {

        return;

    }


    if (
        endorsementChart
    ) {

        endorsementChart.resize();

    }


    clearTimeout(
        bubbleResizeTimer
    );


    bubbleResizeTimer =
        setTimeout(
            () => {

                renderBubbleChart(
                    getFilteredEndorsements()
                );

            },
            140
        );

}


function percentage(
    value,
    total
) {

    if (
        !total
    ) {

        return 0;

    }


    return (
        value
        /
        total
    )
    *
    100;

}


function formatMetricValue(
    value
) {

    if (
        value ===
        null
        ||
        value ===
        undefined
    ) {

        return "—";

    }


    return formatNumber(
        value
    );

}


function formatNumber(
    value
) {

    return Number(
        value
    ).toLocaleString(
        "en-US"
    );

}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (
        element
    ) {

        element.textContent =
            value;

    }

}


function animateWidth(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (
        !element
    ) {

        return;

    }


    requestAnimationFrame(
        () => {

            element.style.width =
                `${clamp(
                    value,
                    0,
                    100
                )}%`;

        }
    );

}


function clamp(
    value,
    minimum,
    maximum
) {

    return Math.min(
        maximum,
        Math.max(
            minimum,
            value
        )
    );

}


function escapeHTML(
    value
) {

    return String(
        value
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


function showDataError() {

    if (
        endorsementChart
    ) {

        endorsementChart.dispose();

        endorsementChart =
            null;

    }


    const barChart =
        document.getElementById(
            "endorsementBarChart"
        );

    const bubbleChart =
        document.getElementById(
            "endorsementBubbleChart"
        );


    const message =
        `
            <div style="
                display:grid;
                place-items:center;
                height:100%;
                color:#8b8f98;
                font-size:13px;
                text-align:center;
                padding:30px;
                font-family:${CHART_FONT_FAMILY};
            ">

                Endorsement data is not available
                for this academic year.

            </div>
        `;


    if (
        barChart
    ) {

        barChart.innerHTML =
            message;

    }


    if (
        bubbleChart
    ) {

        bubbleChart.innerHTML =
            message;

    }

}