
"use strict";

// =============================================
// HOMEPAGE PREVIEW INITIALIZATION
// =============================================

document.addEventListener(
    "DOMContentLoaded",
    () => {
        refreshHomePreviews();
    }
);


// =============================================
// NEW: UPDATE WHEN ACADEMIC YEAR CHANGES
// =============================================

document.addEventListener(
    "academic-year-changed",
    () => {
        refreshHomePreviews();
    }
);


// =============================================
// REFRESH HOMEPAGE PREVIEWS
// =============================================

function refreshHomePreviews() {

    // Clear old academic year statistics
    // while the new data is being loaded.

    [
        "homeCandidateTotal",
        "homeFemalePercent",
        "homeMalePercent",
        "homeInStatePercent",
        "homeMedianGPA",
        "homeEndorsementCount"
    ].forEach(id => {
        setText(id, "—");
    });


    // Reset candidate donut temporarily.

    const donut =
        document.querySelector(
            ".candidate-donut"
        );

    if (donut) {
        donut.style.background = "";
    }


    const year =
        window.AcademicYear.getSelectedYear();


    loadHomeStatisticsPreview(year);

    loadHomeEndorsementPreview(year);
}


// =============================================
// LOAD EPP STATISTICS
// =============================================

async function loadHomeStatisticsPreview(year) {

    try {

        const statisticsText =
            await fetchText(
                window.AcademicYear.getDataPath(
                    "epp_statistics.csv",
                    year
                )
            );


        const statisticsData =
            parseCSV(statisticsText);


        // Prevent older requests from overwriting
        // data for the newly selected year.

        if (
            year !==
            window.AcademicYear.getSelectedYear()
        ) {
            return;
        }


        renderHomeStatisticsPreview(
            statisticsData
        );

    }
    catch (error) {

        if (
            year !==
            window.AcademicYear.getSelectedYear()
        ) {
            return;
        }

        console.error(
            "Unable to load dashboard statistics preview data:",
            error
        );

    }

}


// =============================================
// LOAD ENDORSEMENT PREVIEW
// =============================================

async function loadHomeEndorsementPreview(year) {

    try {

        if (!window.EndorsementData) {

            throw new Error(
                "endorsement-data.js is not loaded."
            );

        }


        const result =
            await window.EndorsementData.load(year);


        if (
            year !==
            window.AcademicYear.getSelectedYear()
        ) {
            return;
        }


        setText(
            "homeEndorsementCount",
            formatNumber(
                result.data.length
            )
        );

    }
    catch (error) {

        if (
            year !==
            window.AcademicYear.getSelectedYear()
        ) {
            return;
        }

        console.warn(
            "Unable to load endorsement preview data:",
            error
        );

        setText(
            "homeEndorsementCount",
            "—"
        );

    }

}


// =============================================
// FETCH TEXT
// =============================================

async function fetchText(path) {

    const response =
        await fetch(path);

    if (!response.ok) {

        throw new Error(
            `Unable to load ${path}`
        );

    }

    return await response.text();

}


// =============================================
// PARSE CSV
// =============================================

function parseCSV(text) {

    const rows = [];

    let row = [];

    let value = "";

    let insideQuotes = false;


    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        const character = text[i];

        const nextCharacter = text[i + 1];


        if (character === '"') {

            if (
                insideQuotes &&
                nextCharacter === '"'
            ) {

                value += '"';

                i++;

            }
            else {

                insideQuotes =
                    !insideQuotes;

            }

        }

        else if (
            character === "," &&
            !insideQuotes
        ) {

            row.push(
                value.trim()
            );

            value = "";

        }

        else if (
            (
                character === "\n" ||
                character === "\r"
            ) &&
            !insideQuotes
        ) {

            if (
                character === "\r" &&
                nextCharacter === "\n"
            ) {
                i++;
            }


            row.push(
                value.trim()
            );

            value = "";


            if (
                row.some(
                    cell => cell !== ""
                )
            ) {

                rows.push(row);

            }

            row = [];

        }

        else {

            value += character;

        }

    }


    if (
        value.length > 0 ||
        row.length > 0
    ) {

        row.push(
            value.trim()
        );

        if (
            row.some(
                cell => cell !== ""
            )
        ) {
            rows.push(row);
        }

    }


    if (rows.length < 2) {
        return [];
    }


    const headers =
        rows[0].map(
            header => header.trim()
        );


    return rows
        .slice(1)
        .map(cells => {

            const record = {};

            headers.forEach(
                (header, index) => {

                    record[header] =
                        cells[index] ?? "";

                }
            );

            return record;

        });

}


// =============================================
// RENDER EPP STATISTICS
// =============================================

function renderHomeStatisticsPreview(
    statisticsData
) {

    const getStatistic =
        categoryName => {

            const match =
                statisticsData.find(
                    row =>
                        String(
                            row["Category Name"] || ""
                        )
                            .trim()
                            .toLowerCase()
                        ===
                        categoryName.toLowerCase()
                );


            return match
                ?
                Number(
                    match[
                        "Number of EPP Candidates Admitted this school year"
                    ]
                ) || 0
                :
                0;

        };


    const female =
        getStatistic("Female");

    const male =
        getStatistic("Male");

    const candidateTotal =
        female + male;


    const femalePercent =
        candidateTotal
            ? (female / candidateTotal) * 100
            : 0;

    const malePercent =
        candidateTotal
            ? (male / candidateTotal) * 100
            : 0;


    const inState =
        getStatistic("In-State");

    const outState =
        getStatistic("Out-of-State");

    const residencyTotal =
        inState + outState;


    const inStatePercent =
        residencyTotal
            ? (inState / residencyTotal) * 100
            : 0;


    const medianGPA =
        getStatistic("Median GPA");


    // Update candidate statistics.

    setText(
        "homeCandidateTotal",
        formatNumber(candidateTotal)
    );

    setText(
        "homeFemalePercent",
        `${femalePercent.toFixed(0)}%`
    );

    setText(
        "homeMalePercent",
        `${malePercent.toFixed(0)}%`
    );

    setText(
        "homeInStatePercent",
        `${inStatePercent.toFixed(1)}%`
    );

    setText(
        "homeMedianGPA",
        Number.isInteger(medianGPA)
            ? medianGPA.toFixed(1)
            : medianGPA.toString()
    );


    // Update the donut chart.

    const donut =
        document.querySelector(
            ".candidate-donut"
        );

    if (donut) {

        donut.style.background =
            `conic-gradient(
                var(--purple) 0% ${femalePercent}%,
                var(--gold) ${femalePercent}% 100%
            )`;

    }

}


// =============================================
// SET TEXT
// =============================================

function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }

}


// =============================================
// FORMAT NUMBERS
// =============================================

function formatNumber(value) {

    return Number(value).toLocaleString(
        "en-US"
    );

}
