
/*
 * Homepage Median GPA Display
 */

(function () {
    "use strict";

    const DISPLAY_TEXT = "View yearly data";

    const originalValues = new WeakMap();

    let observer = null;
    let updateScheduled = false;

    function getAcademicYearAPI() {
        return window.AcademicYear || null;
    }

    function isMultiYearSelection() {
        const api = getAcademicYearAPI();

        if (!api) {
            return false;
        }

        const allHistorical =
            (
                typeof api.isAllHistorical === "function" &&
                api.isAllHistorical()
            ) ||
            (
                typeof api.isAllHistoric === "function" &&
                api.isAllHistoric()
            );

        if (allHistorical) {
            return true;
        }

        if (
            typeof api.getSelectedYears !== "function"
        ) {
            return false;
        }

        const years = api.getSelectedYears();

        return Array.isArray(years) &&
            years.length > 1;
    }

    function normalizeText(value) {
        return String(value || "")
            .trim()
            .replace(/\s+/g, " ")
            .toLowerCase();
    }

    function isPossibleGPAValue(value) {
        const text = String(value || "").trim();

        if (text === DISPLAY_TEXT) {
            return true;
        }

        if (
            text === "--" ||
            text.toLowerCase() === "n/a"
        ) {
            return true;
        }

        if (!/^\d+(?:\.\d+)?$/.test(text)) {
            return false;
        }

        const number = Number(text);

        return Number.isFinite(number) &&
            number >= 0 &&
            number <= 4.5;
    }

    function findMedianGPAValue() {
        const labels = document.querySelectorAll(
            "span, div, p, small, strong, b"
        );

        for (const label of labels) {
            if (label.children.length > 0) {
                continue;
            }

            if (
                normalizeText(label.textContent) !==
                "median gpa"
            ) {
                continue;
            }

            let container = label.parentElement;

            for (
                let depth = 0;
                depth < 3 && container;
                depth++
            ) {
                const candidates = Array.from(
                    container.querySelectorAll(
                        "span, div, p, strong, b, h2, h3, h4"
                    )
                ).filter(function (element) {
                    return (
                        element !== label &&
                        element.children.length === 0 &&
                        isPossibleGPAValue(
                            element.textContent
                        )
                    );
                });

                if (candidates.length === 1) {
                    return candidates[0];
                }

                container = container.parentElement;
            }
        }

        return null;
    }

    function updateMedianGPA() {
        const valueElement = findMedianGPAValue();

        if (!valueElement) {
            return;
        }

        const multiYear = isMultiYearSelection();

        if (multiYear) {
            if (!originalValues.has(valueElement)) {
                originalValues.set(valueElement, {
                    text: valueElement.textContent,
                    fontSize:
                        valueElement.style.fontSize,
                    whiteSpace:
                        valueElement.style.whiteSpace,
                    lineHeight:
                        valueElement.style.lineHeight
                });
            }

            if (
                valueElement.textContent.trim() !==
                DISPLAY_TEXT
            ) {
                valueElement.textContent =
                    DISPLAY_TEXT;
            }

            valueElement.style.fontSize = "12px";
            valueElement.style.whiteSpace = "normal";
            valueElement.style.lineHeight = "1.3";

            return;
        }

        // For one selected year, allow home-preview.js
        // to show the actual GPA value.

        if (
            valueElement.textContent.trim() ===
            DISPLAY_TEXT &&
            originalValues.has(valueElement)
        ) {
            const original =
                originalValues.get(valueElement);

            valueElement.textContent =
                original.text;

            valueElement.style.fontSize =
                original.fontSize;

            valueElement.style.whiteSpace =
                original.whiteSpace;

            valueElement.style.lineHeight =
                original.lineHeight;
        }
    }

    function scheduleUpdate() {
        if (updateScheduled) {
            return;
        }

        updateScheduled = true;

        window.requestAnimationFrame(function () {
            updateScheduled = false;
            updateMedianGPA();
        });
    }

    function initialize() {
        scheduleUpdate();

        // Home preview may render after data loads.
        // Observe changes without modifying its code.

        observer = new MutationObserver(
            scheduleUpdate
        );

        observer.observe(document.body, {
            childList: true,
            characterData: true,
            subtree: true
        });

        window.addEventListener(
            "academic-year-changed",
            scheduleUpdate
        );

        window.addEventListener(
            "pageshow",
            scheduleUpdate
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );
    } else {
        initialize();
    }

})();
