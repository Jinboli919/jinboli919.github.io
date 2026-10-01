document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadHomeStatisticsPreview();

        loadHomeEndorsementPreview();

    }
);



async function loadHomeStatisticsPreview() {

    try {

        const statisticsText =
            await fetchText(
                window.AcademicYear.getDataPath(
                    "epp_statistics.csv"
                )
            );


        const statisticsData =
            parseCSV(
                statisticsText
            );


        renderHomeStatisticsPreview(
            statisticsData
        );

    }
    catch (
        error
    ) {

        console.error(
            "Unable to load dashboard statistics preview data:",
            error
        );

    }

}



async function loadHomeEndorsementPreview() {

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


        setText(
            "homeEndorsementCount",
            formatNumber(
                result.data.length
            )
        );

    }
    catch (
        error
    ) {

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

    const rows = [];

    let row = [];

    let value = "";

    let insideQuotes =
        false;


    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        const character =
            text[
                i
            ];


        const nextCharacter =
            text[
                i +
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



function renderHomeStatisticsPreview(
    statisticsData
) {

    const getStatistic =
        categoryName => {

            const match =
                statisticsData.find(
                    row =>
                        String(
                            row[
                                "Category Name"
                            ] ||
                            ""
                        )
                            .trim()
                            .toLowerCase()
                        ===
                        categoryName
                            .toLowerCase()
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
        getStatistic(
            "Female"
        );


    const male =
        getStatistic(
            "Male"
        );


    const candidateTotal =
        female +
        male;


    const femalePercent =
        candidateTotal
            ?
            (
                female /
                candidateTotal
            ) *
            100
            :
            0;


    const malePercent =
        candidateTotal
            ?
            (
                male /
                candidateTotal
            ) *
            100
            :
            0;


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
        residencyTotal
            ?
            (
                inState /
                residencyTotal
            ) *
            100
            :
            0;


    const medianGPA =
        getStatistic(
            "Median GPA"
        );


    setText(
        "homeCandidateTotal",
        formatNumber(
            candidateTotal
        )
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
        Number.isInteger(
            medianGPA
        )
            ?
            medianGPA.toFixed(
                1
            )
            :
            medianGPA.toString()
    );


    const donut =
        document.querySelector(
            ".candidate-donut"
        );


    if (
        donut
    ) {

        donut.style.background =
            `conic-gradient(var(--purple) 0% ${femalePercent}%, var(--gold) ${femalePercent}% 100%)`;

    }

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



function formatNumber(
    value
) {

    return Number(
        value
    ).toLocaleString(
        "en-US"
    );

}