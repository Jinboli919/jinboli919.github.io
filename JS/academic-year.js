(function () {

    "use strict";


    const AVAILABLE_YEARS = [
        "2021-2022",
        "2022-2023",
        "2023-2024",
        "2024-2025"
    ];


    const DEFAULT_YEAR =
        "2024-2025";


    const STORAGE_KEY =
        "coe-dashboard-academic-year";


    const nativeFetch =
        window.fetch.bind(
            window
        );


    function isValidYear(
        year
    ) {

        return AVAILABLE_YEARS.includes(
            year
        );

    }


    function readStoredYear() {

        try {

            return localStorage.getItem(
                STORAGE_KEY
            );

        }
        catch (error) {

            return null;

        }

    }


    function storeYear(
        year
    ) {

        try {

            localStorage.setItem(
                STORAGE_KEY,
                year
            );

        }
        catch (error) {

            return;

        }

    }


    function getSelectedYear() {

        const url =
            new URL(
                window.location.href
            );


        const yearFromURL =
            url.searchParams.get(
                "year"
            );


        if (
            isValidYear(
                yearFromURL
            )
        ) {

            storeYear(
                yearFromURL
            );


            return yearFromURL;

        }


        const storedYear =
            readStoredYear();


        if (
            isValidYear(
                storedYear
            )
        ) {

            return storedYear;

        }


        return DEFAULT_YEAR;

    }


    function formatYear(
        year
    ) {

        if (
            !year
        ) {

            return "";

        }


        return year.replace(
            "-",
            "–"
        );

    }


    function getDataPath(
        fileName,
        year = getSelectedYear()
    ) {

        return (
            `/Data/${year}/${fileName}`
        );

    }


    function setSelectedYear(
        year
    ) {

        if (
            !isValidYear(
                year
            )
        ) {

            return;

        }


        storeYear(
            year
        );


        const url =
            new URL(
                window.location.href
            );


        url.searchParams.set(
            "year",
            year
        );


        window.location.href =
            url.toString();

    }


    function populateSelect(
        select
    ) {

        if (
            !select
        ) {

            return;

        }


        const selectedYear =
            getSelectedYear();


        const fullLabel =
            select.dataset.yearFormat ===
            "full";


        select.innerHTML =
            "";


        AVAILABLE_YEARS.forEach(
            year => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    year;


                option.textContent =
                    fullLabel
                        ? `${formatYear(year)} Academic Year`
                        : formatYear(year);


                option.selected =
                    year ===
                    selectedYear;


                select.appendChild(
                    option
                );

            }
        );


        select.addEventListener(
            "change",
            event => {

                setSelectedYear(
                    event.target.value
                );

            }
        );

    }


    function rewriteDataRequest(
        input
    ) {

        if (
            typeof input !==
            "string"
        ) {

            return input;

        }


        const requestURL =
            new URL(
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


    window.fetch =
        function (
            input,
            init
        ) {

            return nativeFetch(
                rewriteDataRequest(
                    input
                ),
                init
            );

        };


    window.AcademicYear = {

        years:
            AVAILABLE_YEARS,

        defaultYear:
            DEFAULT_YEAR,

        getSelectedYear,

        setSelectedYear,

        formatYear,

        getDataPath

    };


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