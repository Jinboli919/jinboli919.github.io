
(function () {
    "use strict";

    // ==================================================
    // CONFIGURATION
    // ==================================================

    const DEFAULT_CONFIG = {
        placementsURL: "Data/placements.xlsx",
        zipCoordinatesURL: "Data/zip_coordinates.csv",
        initialMapCenter: [38.45, -78.87],
        initialMapZoom: 8,

        virginiaCountiesURL:
            "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/19/query" +
            "?where=STATE%3D%2751%27" +
            "&outFields=NAME,GEOID,STATE,COUNTY" +
            "&returnGeometry=true" +
            "&outSR=4326" +
            "&f=geojson"
    };

    const CONFIG = Object.assign(
        {},
        DEFAULT_CONFIG,
        window.STUDENT_PLACEMENT_DASHBOARD_CONFIG || {}
    );

    // ==================================================
    // MAP
    // ==================================================

    const map = L.map("map", {
        minZoom: 3,
        maxZoom: 18
    }).setView(
        CONFIG.initialMapCenter,
        CONFIG.initialMapZoom
    );

    map.createPane("heatPane");
    map.getPane("heatPane").style.zIndex = 400;
    map.getPane("heatPane").style.pointerEvents = "none";

    map.createPane("countyPane");
    map.getPane("countyPane").style.zIndex = 430;
    map.getPane("countyPane").style.pointerEvents = "none";

    map.createPane("bubblePane");
    map.getPane("bubblePane").style.zIndex = 500;

    L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        {
            maxZoom: 19,
            attribution: "Tiles &copy; Esri"
        }
    ).addTo(map);

    // ==================================================
    // GLOBAL STATE
    // ==================================================

    let allPlacementData = [];
    let filteredPlacementData = [];
    let allZIPCoordinates = {};
    let currentMapPoints = [];

    let countyLayer = null;
    let heatLayer = null;
    let currentCountyEntry = null;

    let isHoveringBubble = false;
    let activeBubbleTooltipMarker = null;

    let detailMode = "zip";
    let selectedZIP = null;
    let selectedCountyEntry = null;

    const detailFilters = {
        program: "",
        gradeLevel: "",
        placementType: "",
        schoolCity: "",
        schoolDivision: "",
        schoolName: ""
    };

    const countyEntries = [];
    const bubbleMarkersByZIP = new Map();
    const administrativeAreaCache = new Map();
    const detailCharts = [];

    const bubbleLayer = L.layerGroup().addTo(map);

    // ==================================================
    // MAP LOADING NOTICE
    // ==================================================

    function setPlacementMapLoading(
        message,
        isError = false
    ) {
        const notice = document.getElementById(
            "placementMapLoading"
        );

        if (!notice) {
            return;
        }

        notice.hidden = !message;

        if (message) {
            notice.textContent = message;

            notice.style.color = isError
                ? "#b42318"
                : "#450084";
        }
    }

    // ==================================================
    // HEAT LAYER VISIBILITY
    // ==================================================

    function syncHeatLayerVisibility() {
        const heatPane = map.getPane("heatPane");

        if (!heatPane) {
            return;
        }

        heatPane.style.visibility =
            map.getZoom() <= CONFIG.initialMapZoom
                ? "visible"
                : "hidden";
    }

    // ==================================================
    // TOOLTIP CLEANUP
    // ==================================================

    function closeActiveBubbleTooltip() {
        const active = activeBubbleTooltipMarker;

        activeBubbleTooltipMarker = null;
        isHoveringBubble = false;

        if (active) {
            active.closeTooltip();
        }
    }

    // ==================================================
    // COLORS
    // ==================================================

    const MAP_COLOR_STOPS = [
        { position: 0.00, color: "#3568A8" },
        { position: 0.12, color: "#4388BE" },
        { position: 0.25, color: "#55A8C2" },
        { position: 0.38, color: "#69C1B2" },
        { position: 0.52, color: "#A2D18E" },
        { position: 0.66, color: "#DDD970" },
        { position: 0.79, color: "#F2B35F" },
        { position: 0.90, color: "#ED8455" },
        { position: 1.00, color: "#D95757" }
    ];

    const CHART_COLORS = [
        "#5470C6",
        "#91CC75",
        "#FAC858",
        "#EE6666",
        "#73C0DE",
        "#3BA272",
        "#FC8452",
        "#9A60B4",
        "#EA7CCC",
        "#6B8EBA"
    ];

    const HEAT_GRADIENT = {};

    MAP_COLOR_STOPS.forEach(function (stop) {
        HEAT_GRADIENT[stop.position] = stop.color;
    });

    // ==================================================
    // DATA HELPERS
    // ==================================================

    function cleanValue(value) {
        if (value === undefined || value === null) {
            return "";
        }

        return String(value).trim();
    }

    function normalizeZIP(value) {
        const cleaned = cleanValue(value);

        if (!cleaned) {
            return "";
        }

        return cleaned.padStart(5, "0");
    }

    function normalizeSearchText(value) {
        return cleanValue(value).toLowerCase();
    }

    function escapeHTML(value) {
        return cleanValue(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getUniqueColumnValues(data, columnName) {
        const values = new Set();

        data.forEach(function (row) {
            const value = cleanValue(row[columnName]);

            if (value) {
                values.add(value);
            }
        });

        return Array.from(values).sort(function (a, b) {
            return a.localeCompare(b, undefined, {
                numeric: true,
                sensitivity: "base"
            });
        });
    }

    function countUniqueStudents(data) {
        const students = new Set();

        data.forEach(function (row) {
            const ID = cleanValue(row.ID);

            if (ID) {
                students.add(ID);
            }
        });

        return students.size;
    }

    function countUniqueZIPs(data) {
        const zips = new Set();

        data.forEach(function (row) {
            const zip = normalizeZIP(
                row["School ZIP Code"]
            );

            if (zip) {
                zips.add(zip);
            }
        });

        return zips.size;
    }

    function countUniqueStudentsByCategory(
        data,
        columnName
    ) {
        const groups = {};

        data.forEach(function (row) {
            const category = cleanValue(
                row[columnName]
            );

            const studentID = cleanValue(row.ID);

            if (!category || !studentID) {
                return;
            }

            if (!groups[category]) {
                groups[category] = new Set();
            }

            groups[category].add(studentID);
        });

        return Object.keys(groups)
            .map(function (name) {
                return {
                    name: name,
                    value: groups[name].size
                };
            })
            .sort(function (a, b) {
                return b.value - a.value;
            });
    }

    // ==================================================
    // MAIN FILTER OPTIONS
    // ==================================================

    function populateSelect(selectID, values) {
        const select = document.getElementById(
            selectID
        );

        if (!select) {
            return;
        }

        while (select.options.length > 1) {
            select.remove(1);
        }

        values.forEach(function (value) {
            const option = document.createElement(
                "option"
            );

            option.value = value;
            option.textContent = value;

            select.appendChild(option);
        });
    }

    function populateDashboardFilters(data) {
        populateSelect(
            "programFilter",
            getUniqueColumnValues(data, "Program")
        );

        populateSelect(
            "gradeFilter",
            getUniqueColumnValues(data, "Grade Level")
        );

        populateSelect(
            "placementTypeFilter",
            getUniqueColumnValues(data, "Placement Type")
        );

        populateSelect(
            "divisionFilter",
            getUniqueColumnValues(data, "School Division")
        );

        populateSelect(
            "schoolFilter",
            getUniqueColumnValues(data, "School Name")
        );
    }

    function updateFilterVisualState(selectElement) {
        if (!selectElement) {
            return;
        }

        const isDefault =
            selectElement.value === "";

        selectElement.classList.toggle(
            "filter-default",
            isDefault
        );

        selectElement.classList.toggle(
            "filter-active",
            !isDefault
        );
    }

    function updateAllFilterVisualStates() {
        [
            "programFilter",
            "gradeFilter",
            "placementTypeFilter",
            "divisionFilter",
            "schoolFilter"
        ].forEach(function (filterID) {
            updateFilterVisualState(
                document.getElementById(filterID)
            );
        });
    }

    function rowMatchesSearch(row, searchText) {
        const normalizedSearch =
            normalizeSearchText(searchText);

        if (!normalizedSearch) {
            return true;
        }

        const searchTokens = normalizedSearch
            .split(/\s+/)
            .filter(Boolean);

        const searchableText = [
            cleanValue(row["Program"]),
            cleanValue(row["Grade Level"]),
            cleanValue(row["Placement Type"]),
            normalizeZIP(row["School ZIP Code"]),
            cleanValue(row["School City"]),
            cleanValue(row["School Division"]),
            cleanValue(row["School Name"])
        ].join(" ").toLowerCase();

        return searchTokens.every(function (token) {
            return searchableText.includes(token);
        });
    }

    function filterPlacementData() {
        const program =
            document.getElementById("programFilter").value;

        const grade =
            document.getElementById("gradeFilter").value;

        const placementType =
            document.getElementById("placementTypeFilter").value;

        const division =
            document.getElementById("divisionFilter").value;

        const school =
            document.getElementById("schoolFilter").value;

        const search =
            document.getElementById("dashboardSearch").value;

        return allPlacementData.filter(function (row) {
            const programMatch =
                !program ||
                cleanValue(row["Program"]) === program;

            const gradeMatch =
                !grade ||
                cleanValue(row["Grade Level"]) === grade;

            const placementTypeMatch =
                !placementType ||
                cleanValue(row["Placement Type"]) ===
                    placementType;

            const divisionMatch =
                !division ||
                cleanValue(row["School Division"]) === division;

            const schoolMatch =
                !school ||
                cleanValue(row["School Name"]) === school;

            const searchMatch =
                rowMatchesSearch(row, search);

            return (
                programMatch &&
                gradeMatch &&
                placementTypeMatch &&
                divisionMatch &&
                schoolMatch &&
                searchMatch
            );
        });
    }

    function updateDashboardKPIs(data, locationCount) {
        document.getElementById(
            "kpiStudents"
        ).textContent = countUniqueStudents(data);

        document.getElementById(
            "kpiLocations"
        ).textContent = locationCount;

        document.getElementById(
            "kpiDivisions"
        ).textContent =
            getUniqueColumnValues(
                data,
                "School Division"
            ).length;

        document.getElementById(
            "kpiPrograms"
        ).textContent =
            getUniqueColumnValues(
                data,
                "Program"
            ).length;
    }

    // ==================================================
    // BUBBLE COLORS
    // ==================================================

    function hexToRGB(hex) {
        const cleanHex = hex.replace("#", "");

        return {
            r: parseInt(cleanHex.substring(0, 2), 16),
            g: parseInt(cleanHex.substring(2, 4), 16),
            b: parseInt(cleanHex.substring(4, 6), 16)
        };
    }

    function RGBToHex(r, g, b) {
        return "#" + [r, g, b]
            .map(function (value) {
                return Math.round(value)
                    .toString(16)
                    .padStart(2, "0");
            })
            .join("");
    }

    function getColorForRatio(ratio) {
        ratio = Math.max(0, Math.min(1, ratio));

        for (
            let i = 0;
            i < MAP_COLOR_STOPS.length - 1;
            i++
        ) {
            const left = MAP_COLOR_STOPS[i];
            const right = MAP_COLOR_STOPS[i + 1];

            if (
                ratio >= left.position &&
                ratio <= right.position
            ) {
                const localRatio =
                    (ratio - left.position) /
                    (right.position - left.position);

                const leftRGB = hexToRGB(left.color);
                const rightRGB = hexToRGB(right.color);

                return RGBToHex(
                    leftRGB.r +
                        (rightRGB.r - leftRGB.r) * localRatio,

                    leftRGB.g +
                        (rightRGB.g - leftRGB.g) * localRatio,

                    leftRGB.b +
                        (rightRGB.b - leftRGB.b) * localRatio
                );
            }
        }

        return MAP_COLOR_STOPS[
            MAP_COLOR_STOPS.length - 1
        ].color;
    }

    function normalizeColorValue(
        value,
        minValue,
        maxValue
    ) {
        if (maxValue === minValue) {
            return 0.5;
        }

        return (
            (Math.sqrt(value) - Math.sqrt(minValue)) /
            (Math.sqrt(maxValue) - Math.sqrt(minValue))
        );
    }

    // ==================================================
    // BUBBLE SIZE
    // ==================================================

    function getBubbleRadius(
        studentCount,
        minStudents,
        maxStudents
    ) {
        const minRadius = 7;
        let maxRadius;

        if (maxStudents <= 5) {
            maxRadius = 14;
        } else if (maxStudents <= 25) {
            maxRadius = 16;
        } else if (maxStudents <= 100) {
            maxRadius = 19;
        } else {
            maxRadius = 21;
        }

        if (maxStudents === minStudents) {
            return (minRadius + maxRadius) / 2;
        }

        const normalized =
            (Math.sqrt(studentCount) - Math.sqrt(minStudents)) /
            (Math.sqrt(maxStudents) - Math.sqrt(minStudents));

        return minRadius +
            (maxRadius - minRadius) * normalized;
    }

    // ==================================================
    // COUNTY/CITY STYLES
    // ==================================================

    function getCountyDefaultStyle() {
        return {
            color: "#64748b",
            weight: 0.35,
            opacity: 0.58,
            fill: true,
            fillColor: "#73A3BE",
            fillOpacity: 0.004
        };
    }

    function getCountyHoverStyle() {
        return {
            color: "#426783",
            weight: 0.95,
            opacity: 0.95,
            fillColor: "#74A7C5",
            fillOpacity: 0.12
        };
    }

    function getCountySelectedStyle() {
        return {
            color: "#3f6f8c",
            weight: 1.25,
            opacity: 1,
            fillColor: "#6fa7c5",
            fillOpacity: 0.10
        };
    }

    function restoreCountyEntryStyle(entry) {
        if (!entry) {
            return;
        }

        if (selectedCountyEntry === entry) {
            entry.layer.setStyle(
                getCountySelectedStyle()
            );
        } else {
            entry.layer.setStyle(
                getCountyDefaultStyle()
            );
        }
    }

    function updateSelectedCountyHighlight() {
        countyEntries.forEach(function (entry) {
            entry.layer.setStyle(
                getCountyDefaultStyle()
            );
        });

        if (selectedCountyEntry) {
            selectedCountyEntry.layer.setStyle(
                getCountySelectedStyle()
            );
        }
    }

    const countyHoverTooltip = L.tooltip({
        direction: "top",
        offset: [0, -10],
        opacity: 0.98,
        className: "county-tooltip"
    });

    // ==================================================
    // LOAD VIRGINIA COUNTY/CITY BOUNDARIES
    // ==================================================

    const countyDataPromise =
        fetch(CONFIG.virginiaCountiesURL)

            .then(function (response) {
                return response.json();
            })

            .then(function (data) {
                countyLayer = L.geoJSON(data, {
                    pane: "countyPane",
                    interactive: false,
                    style: getCountyDefaultStyle,

                    onEachFeature: function (
                        feature,
                        layer
                    ) {
                        countyEntries.push({
                            feature: feature,
                            layer: layer,
                            bounds: layer.getBounds()
                        });
                    }
                }).addTo(map);

                return data;
            })

            .catch(function (error) {
                console.error(
                    "Failed to load Virginia administrative boundaries:",
                    error
                );

                return null;
            });

    function findCountyEntry(
        latitude,
        longitude
    ) {
        if (
            countyEntries.length === 0 ||
            typeof turf === "undefined"
        ) {
            return null;
        }

        const latlng = L.latLng(
            latitude,
            longitude
        );

        const point = turf.point([
            longitude,
            latitude
        ]);

        for (const entry of countyEntries) {
            if (!entry.bounds.contains(latlng)) {
                continue;
            }

            try {
                if (
                    turf.booleanPointInPolygon(
                        point,
                        entry.feature
                    )
                ) {
                    return entry;
                }
            } catch (error) {
                console.warn(
                    "County geometry test failed:",
                    error
                );
            }
        }

        return null;
    }

    function findAdministrativeArea(
        latitude,
        longitude
    ) {
        const entry = findCountyEntry(
            latitude,
            longitude
        );

        if (!entry) {
            return "";
        }

        return entry.feature.properties.NAME || "";
    }

    // ==================================================
    // ORIGINAL ZIP -> ADMINISTRATIVE AREA LOGIC
    //
    // This remains unchanged.
    // ==================================================

    function getAdministrativeAreaForZIP(zip) {
        if (administrativeAreaCache.has(zip)) {
            return administrativeAreaCache.get(zip);
        }

        const coordinates = allZIPCoordinates[zip];

        if (!coordinates) {
            return "";
        }

        const area = findAdministrativeArea(
            coordinates.latitude,
            coordinates.longitude
        );

        administrativeAreaCache.set(
            zip,
            area
        );

        return area;
    }

    function getCountyEntryForZIP(zip) {
        const coordinates = allZIPCoordinates[zip];

        if (!coordinates) {
            return null;
        }

        return findCountyEntry(
            coordinates.latitude,
            coordinates.longitude
        );
    }

    // ==================================================
    // COUNTY/CITY HOVER
    // ==================================================

    function clearCountyHover() {
        if (currentCountyEntry) {
            restoreCountyEntryStyle(
                currentCountyEntry
            );
        }

        currentCountyEntry = null;

        if (map.hasLayer(countyHoverTooltip)) {
            map.removeLayer(countyHoverTooltip);
        }
    }

    function showCountyHover(entry, latlng) {
        if (!entry) {
            clearCountyHover();
            return;
        }

        if (
            currentCountyEntry &&
            currentCountyEntry !== entry
        ) {
            restoreCountyEntryStyle(
                currentCountyEntry
            );
        }

        currentCountyEntry = entry;

        entry.layer.setStyle(
            getCountyHoverStyle()
        );

        countyHoverTooltip
            .setLatLng(latlng)
            .setContent(
                entry.feature.properties.NAME
            );

        if (!map.hasLayer(countyHoverTooltip)) {
            countyHoverTooltip.addTo(map);
        }
    }

    map.on("mousemove", function (event) {
        if (isHoveringBubble) {
            return;
        }

        const entry = findCountyEntry(
            event.latlng.lat,
            event.latlng.lng
        );

        if (entry) {
            showCountyHover(
                entry,
                event.latlng
            );
        } else {
            clearCountyHover();
        }
    });

    // ==================================================
    // TOOLTIP MOUSE CLEANUP
    // ==================================================

    map.getContainer().addEventListener(
        "pointermove",
        function (event) {
            const marker =
                activeBubbleTooltipMarker;

            if (
                !marker ||
                !map.hasLayer(marker)
            ) {
                return;
            }

            const box = map.getContainer()
                .getBoundingClientRect();

            const center =
                map.latLngToContainerPoint(
                    marker.getLatLng()
                );

            const x = event.clientX - box.left;
            const y = event.clientY - box.top;

            const distance = Math.hypot(
                x - center.x,
                y - center.y
            );

            if (
                distance > marker.getRadius() + 5
            ) {
                closeActiveBubbleTooltip();
            }
        },
        {
            passive: true,
            capture: true
        }
    );

    map.getContainer().addEventListener(
        "mouseleave",
        function () {
            closeActiveBubbleTooltip();
            clearCountyHover();
        }
    );

    map.on("movestart", function () {
        closeActiveBubbleTooltip();
        clearCountyHover();
    });

    // ==================================================
    // ZOOM EVENTS
    //
    // Hide the heat layer during zoom.
    // ==================================================

    map.on("zoomstart", function () {
        closeActiveBubbleTooltip();
        clearCountyHover();

        const heatPane = map.getPane("heatPane");

        if (heatPane) {
            heatPane.style.visibility = "hidden";
        }
    });

    map.on("zoomend", function () {
        syncHeatLayerVisibility();
        updateSelectedBubbleStyles();
    });

    // ==================================================
    // ZIP AGGREGATION
    // ==================================================

    function countStudentsByZIP(data) {
        const dataByZIP = {};

        data.forEach(function (row) {
            const zip =
                normalizeZIP(
                    row["School ZIP Code"]
                );

            const studentID =
                cleanValue(row.ID);

            if (!zip || !studentID) {
                return;
            }

            if (!dataByZIP[zip]) {
                dataByZIP[zip] = {
                    students: new Set(),
                    cities: new Set(),
                    divisions: new Set(),
                    schools: new Set()
                };
            }

            dataByZIP[zip].students.add(studentID);

            const city =
                cleanValue(row["School City"]);

            const division =
                cleanValue(row["School Division"]);

            const school =
                cleanValue(row["School Name"]);

            if (city) {
                dataByZIP[zip].cities.add(city);
            }

            if (division) {
                dataByZIP[zip].divisions.add(division);
            }

            if (school) {
                dataByZIP[zip].schools.add(school);
            }
        });

        return Object.keys(dataByZIP).map(
            function (zip) {
                return {
                    ZIP: zip,

                    Students:
                        dataByZIP[zip].students.size,

                    Cities:
                        Array.from(
                            dataByZIP[zip].cities
                        ).sort(),

                    Divisions:
                        Array.from(
                            dataByZIP[zip].divisions
                        ).sort(),

                    Schools:
                        Array.from(
                            dataByZIP[zip].schools
                        ).sort()
                };
            }
        );
    }

    // ==================================================
    // ZIP COORDINATES
    // ==================================================

    async function loadZIPCoordinates() {
        const response = await fetch(
            CONFIG.zipCoordinatesURL
        );

        if (!response.ok) {
            throw new Error(
                "Could not load ZIP coordinates."
            );
        }

        const csvText = await response.text();

        const lines = csvText
            .trim()
            .split(/\r?\n/);

        const coordinates = {};

        for (
            let i = 1;
            i < lines.length;
            i++
        ) {
            const columns = lines[i]
                .trim()
                .split(",");

            if (columns.length < 3) {
                continue;
            }

            const zip =
                normalizeZIP(columns[0]);

            const latitude =
                Number(columns[1]);

            const longitude =
                Number(columns[2]);

            if (
                zip &&
                Number.isFinite(latitude) &&
                Number.isFinite(longitude)
            ) {
                coordinates[zip] = {
                    latitude: latitude,
                    longitude: longitude
                };
            }
        }

        return coordinates;
    }

    function createZIPPoints(zipSummary) {
        const points = [];

        zipSummary.forEach(function (item) {
            const coordinates =
                allZIPCoordinates[item.ZIP];

            if (!coordinates) {
                console.warn(
                    "No coordinates found for ZIP:",
                    item.ZIP
                );

                return;
            }

            points.push({
                key: item.ZIP,
                label: `ZIP ${item.ZIP}`,

                latitude:
                    coordinates.latitude,

                longitude:
                    coordinates.longitude,

                students: item.Students,
                cities: item.Cities,
                divisions: item.Divisions,
                schools: item.Schools,

                administrativeArea:
                    getAdministrativeAreaForZIP(
                        item.ZIP
                    )
            });
        });

        return points;
    }

    // ==================================================
    // MAP SUMMARY
    // ==================================================

    function updateMapSummary(data, points) {
        const element =
            document.getElementById(
                "mapSummary"
            );

        if (data.length === 0) {
            element.textContent =
                "No placements match the current filters.";

            return;
        }

        const reachedAreas = new Set();

        points.forEach(function (point) {
            const entry =
                getCountyEntryForZIP(
                    point.key
                );

            if (entry) {
                const props =
                    entry.feature.properties || {};

                const areaID = String(
                    props.GEOID ||
                    props.NAME ||
                    ""
                ).trim();

                if (areaID) {
                    reachedAreas.add(areaID);
                }
            }
        });

        element.textContent =
            `${countUniqueStudents(data)} unique students across ` +
            `${points.length} ZIP locations in ` +
            `${reachedAreas.size} Virginia counties or independent cities`;
    }

    // ==================================================
    // MAIN FILTER MAP FOCUS
    // ==================================================

    function focusMapOnPoints(points) {
        if (points.length === 0) {
            return;
        }

        if (points.length === 1) {
            map.setView(
                [
                    points[0].latitude,
                    points[0].longitude
                ],
                CONFIG.initialMapZoom,
                {
                    animate: true
                }
            );

            return;
        }

        const bounds = L.latLngBounds(
            points.map(function (point) {
                return [
                    point.latitude,
                    point.longitude
                ];
            })
        );

        map.fitBounds(bounds, {
            paddingTopLeft: [60, 60],
            paddingBottomRight: [60, 60],
            maxZoom: CONFIG.initialMapZoom,
            animate: true
        });
    }

    // ==================================================
    // UPDATED: SHARED COUNTY/CITY CAMERA
    //
    // Both of these operations call this function:
    //   1. Clicking a County/City boundary
    //   2. Clicking a ZIP bubble in that County/City
    //
    // Thus, both produce the same map center,
    // padding and zoom level.
    //
    // County: maxZoom 10
    // Independent City: maxZoom 11
    //
    // The zoom is derived from the administrative
    // boundary, rather than progressively increasing
    // from the current zoom.
    // ==================================================

    function focusCounty(entry) {
        if (!entry) {
            return;
        }

        const isCity =
            Number(
                entry.feature.properties?.COUNTY
            ) >= 500;

        map.fitBounds(
            entry.bounds,
            {
                padding: [35, 35],
                maxZoom: isCity ? 11 : 10,
                animate: true
            }
        );
    }

    // ==================================================
    // MAP LEGEND
    // ==================================================

    const densityLegend = L.control({
        position: "bottomright"
    });

    densityLegend.onAdd = function () {
        const div = L.DomUtil.create(
            "div",
            "density-legend"
        );

        div.innerHTML = `
            <div class="density-title">
                Relative student density
            </div>

            <div class="density-gradient"></div>

            <div class="density-labels">
                <span>Low</span>
                <span>High</span>
            </div>
        `;

        const gradientText = MAP_COLOR_STOPS
            .map(function (stop) {
                return `${stop.color} ${stop.position * 100}%`;
            })
            .join(", ");

        div.querySelector(
            ".density-gradient"
        ).style.background =
            `linear-gradient(to right, ${gradientText})`;

        return div;
    };

    densityLegend.addTo(map);

    // ==================================================
    // TOOLTIP CONTENT HELPERS
    // ==================================================

    function formatTooltipList(
        values,
        maxItems = 4
    ) {
        if (values.length === 0) {
            return "—";
        }

        const visible = values.slice(
            0,
            maxItems
        );

        let text = visible
            .map(escapeHTML)
            .join("<br>");

        if (values.length > maxItems) {
            text +=
                `<br><span>+${values.length - maxItems} more</span>`;
        }

        return text;
    }

    // ==================================================
    // BUBBLE TOOLTIP POSITION
    // ==================================================

    function positionBubbleTooltipSafely(bubble) {
        const tooltip = bubble.getTooltip();

        if (!tooltip) {
            return;
        }

        const latlng = bubble.getLatLng();

        const anchor =
            map.latLngToContainerPoint(
                latlng
            );

        const mapSize = map.getSize();

        const markerRadius =
            typeof bubble.getRadius === "function"
                ? bubble.getRadius()
                : 10;

        const margin = 12;
        const gap = 10;

        let tooltipWidth = 280;
        let tooltipHeight = 220;

        const element = tooltip.getElement();

        if (element) {
            const rectangle =
                element.getBoundingClientRect();

            if (rectangle.width > 0) {
                tooltipWidth = rectangle.width;
            }

            if (rectangle.height > 0) {
                tooltipHeight = rectangle.height;
            }
        }

        const topCandidate = {
            direction: "top",

            offset: [
                0,
                -(markerRadius + gap)
            ],

            box: {
                left: anchor.x - tooltipWidth / 2,
                right: anchor.x + tooltipWidth / 2,

                top:
                    anchor.y -
                    markerRadius -
                    gap -
                    tooltipHeight,

                bottom:
                    anchor.y -
                    markerRadius -
                    gap
            }
        };

        const bottomCandidate = {
            direction: "bottom",

            offset: [
                0,
                markerRadius + gap
            ],

            box: {
                left: anchor.x - tooltipWidth / 2,
                right: anchor.x + tooltipWidth / 2,

                top:
                    anchor.y +
                    markerRadius +
                    gap,

                bottom:
                    anchor.y +
                    markerRadius +
                    gap +
                    tooltipHeight
            }
        };

        const leftCandidate = {
            direction: "left",

            offset: [
                -(markerRadius + gap),
                0
            ],

            box: {
                left:
                    anchor.x -
                    markerRadius -
                    gap -
                    tooltipWidth,

                right:
                    anchor.x -
                    markerRadius -
                    gap,

                top: anchor.y - tooltipHeight / 2,
                bottom: anchor.y + tooltipHeight / 2
            }
        };

        const rightCandidate = {
            direction: "right",

            offset: [
                markerRadius + gap,
                0
            ],

            box: {
                left:
                    anchor.x +
                    markerRadius +
                    gap,

                right:
                    anchor.x +
                    markerRadius +
                    gap +
                    tooltipWidth,

                top: anchor.y - tooltipHeight / 2,
                bottom: anchor.y + tooltipHeight / 2
            }
        };

        const candidates = [
            topCandidate,
            bottomCandidate,
            leftCandidate,
            rightCandidate
        ];

        function calculateOverflow(box) {
            const overflowLeft = Math.max(
                0,
                margin - box.left
            );

            const overflowRight = Math.max(
                0,
                box.right -
                (mapSize.x - margin)
            );

            const overflowTop = Math.max(
                0,
                margin - box.top
            );

            const overflowBottom = Math.max(
                0,
                box.bottom -
                (mapSize.y - margin)
            );

            return (
                overflowLeft +
                overflowRight +
                overflowTop +
                overflowBottom
            );
        }

        candidates.forEach(function (candidate) {
            candidate.overflow =
                calculateOverflow(candidate.box);
        });

        candidates.sort(function (a, b) {
            return a.overflow - b.overflow;
        });

        const bestCandidate = candidates[0];

        tooltip.options.direction =
            bestCandidate.direction;

        tooltip.options.offset = L.point(
            bestCandidate.offset[0],
            bestCandidate.offset[1]
        );

        if (map.hasLayer(tooltip)) {
            tooltip.update();
        }
    }

    // ==================================================
    // BUBBLE HIGHLIGHT
    // ==================================================

    function updateSelectedBubbleStyles() {
        const matchingZIPs = new Set();

        const emphasizeDetailMatches =
            detailMode === "county" &&
            Boolean(selectedCountyEntry) &&
            hasActiveDetailFilters();

        if (emphasizeDetailMatches) {
            applyDetailFilters(
                getDetailBaseRows()
            ).forEach(function (row) {
                const zip = normalizeZIP(
                    row["School ZIP Code"]
                );

                if (zip) {
                    matchingZIPs.add(zip);
                }
            });
        }

        const currentZoom = map.getZoom();

        const zoomScale = Math.max(
            0.50,
            Math.min(
                1.10,
                0.82 * Math.pow(
                    1.12,
                    currentZoom - CONFIG.initialMapZoom
                )
            )
        );

        bubbleMarkersByZIP.forEach(
            function (marker, zip) {
                const selected =
                    (
                        detailMode === "zip" &&
                        zip === selectedZIP
                    ) ||
                    (
                        emphasizeDetailMatches &&
                        matchingZIPs.has(zip)
                    );

                const baseRadius =
                    marker._baseRadius ||
                    marker.getRadius();

                const displayRadius = Math.max(
                    4,
                    baseRadius * zoomScale
                );

                marker.setRadius(
                    displayRadius +
                    (selected ? 3.0 : 0)
                );

                marker.setStyle({
                    color: selected
                        ? "#450084"
                        : "#ffffff",

                    weight: selected
                        ? 3.5
                        : 1.5,

                    opacity: selected
                        ? 1
                        : 0.92,

                    fillOpacity: selected
                        ? 0.80
                        : 0.56
                });

                const markerElement =
                    marker.getElement();

                if (markerElement) {
                    markerElement.classList.toggle(
                        "is-selected",
                        selected
                    );
                }

                if (selected) {
                    marker.bringToFront();
                }
            }
        );
    }

    // ==================================================
    // DETAIL FILTERS
    // ==================================================

    function clearDetailFilters() {
        Object.keys(detailFilters).forEach(
            function (key) {
                detailFilters[key] = "";
            }
        );
    }

    function hasActiveDetailFilters() {
        return Object.values(
            detailFilters
        ).some(Boolean);
    }

    function applyDetailFilters(rows) {
        return rows.filter(function (row) {
            return (
                (
                    !detailFilters.program ||
                    cleanValue(row["Program"]) ===
                        detailFilters.program
                ) &&
                (
                    !detailFilters.gradeLevel ||
                    cleanValue(row["Grade Level"]) ===
                        detailFilters.gradeLevel
                ) &&
                (
                    !detailFilters.placementType ||
                    cleanValue(row["Placement Type"]) ===
                        detailFilters.placementType
                ) &&
                (
                    !detailFilters.schoolCity ||
                    cleanValue(row["School City"]) ===
                        detailFilters.schoolCity
                ) &&
                (
                    !detailFilters.schoolDivision ||
                    cleanValue(row["School Division"]) ===
                        detailFilters.schoolDivision
                ) &&
                (
                    !detailFilters.schoolName ||
                    cleanValue(row["School Name"]) ===
                        detailFilters.schoolName
                )
            );
        });
    }

    function setDetailFilter(key, value) {
        if (detailFilters[key] === value) {
            detailFilters[key] = "";
        } else {
            detailFilters[key] = value;
        }

        renderDetailPanel();
    }

    function getDetailBaseRows() {
        if (
            detailMode === "zip" &&
            selectedZIP
        ) {
            return filteredPlacementData.filter(
                function (row) {
                    return (
                        normalizeZIP(
                            row["School ZIP Code"]
                        ) === selectedZIP
                    );
                }
            );
        }

        if (
            detailMode === "county" &&
            selectedCountyEntry
        ) {
            const countyName =
                selectedCountyEntry
                    .feature
                    .properties
                    .NAME;

            return filteredPlacementData.filter(
                function (row) {
                    const zip = normalizeZIP(
                        row["School ZIP Code"]
                    );

                    return (
                        getAdministrativeAreaForZIP(zip) ===
                        countyName
                    );
                }
            );
        }

        return [];
    }

    function getPointsForCounty(entry) {
        if (!entry) {
            return [];
        }

        const countyName =
            entry.feature.properties.NAME;

        return currentMapPoints.filter(
            function (point) {
                return (
                    point.administrativeArea ===
                    countyName
                );
            }
        );
    }

    function chooseRepresentativeZIPForCounty(entry) {
        const points = getPointsForCounty(entry);

        if (points.length === 0) {
            return null;
        }

        const maxStudents = Math.max(
            ...points.map(function (point) {
                return point.students;
            })
        );

        const tied = points.filter(
            function (point) {
                return point.students === maxStudents;
            }
        );

        return tied[
            Math.floor(
                Math.random() * tied.length
            )
        ];
    }

    // ==================================================
    // DETAIL MODE CONTROLS
    // ==================================================

    function updateDetailModeControls() {
        const zipButton =
            document.getElementById(
                "detailModeZIP"
            );

        const countyButton =
            document.getElementById(
                "detailModeCounty"
            );

        const resetButton =
            document.getElementById(
                "resetDetails"
            );

        const hasContext =
            Boolean(
                selectedZIP ||
                selectedCountyEntry
            );

        let canZIP = false;
        let canCounty = false;

        if (selectedZIP) {
            canZIP = true;

            canCounty = Boolean(
                getCountyEntryForZIP(
                    selectedZIP
                )
            );
        }

        if (selectedCountyEntry) {
            canCounty = true;

            canZIP = Boolean(
                chooseRepresentativeZIPForCounty(
                    selectedCountyEntry
                )
            );
        }

        zipButton.disabled =
            !hasContext || !canZIP;

        countyButton.disabled =
            !hasContext || !canCounty;

        zipButton.classList.toggle(
            "is-active",
            detailMode === "zip"
        );

        countyButton.classList.toggle(
            "is-active",
            detailMode === "county"
        );

        resetButton.hidden = !hasContext;
    }

    // ==================================================
    // UPDATED: SELECT ZIP
    //
    // Clicking a ZIP bubble uses focusCounty(), the
    // SAME function used by County/City boundary clicks.
    //
    // This removes the separate 48px padding rule.
    // The map is centered on the administrative area
    // while the selected ZIP remains highlighted.
    // ==================================================

    function selectZIP(point) {
        if (!point) {
            return;
        }

        closeActiveBubbleTooltip();

        detailMode = "zip";
        selectedZIP = point.key;

        selectedCountyEntry =
            getCountyEntryForZIP(
                point.key
            );

        clearDetailFilters();
        clearCountyHover();

        updateSelectedBubbleStyles();
        updateSelectedCountyHighlight();
        updateDetailModeControls();

        renderDetailPanel();

        if (selectedCountyEntry) {
            // Identical zoom and centering behavior
            // to clicking the County/City boundary.
            focusCounty(selectedCountyEntry);
        } else {
            // Keep the previous fixed fallback for a
            // ZIP with no matched Virginia boundary.
            map.setView(
                [
                    point.latitude,
                    point.longitude
                ],
                CONFIG.initialMapZoom + 1,
                {
                    animate: false
                }
            );
        }
    }

    // ==================================================
    // COUNTY/CITY SELECTION
    // ==================================================

    function selectCounty(
        entry,
        shouldFocus = true
    ) {
        if (!entry) {
            return;
        }

        detailMode = "county";

        selectedCountyEntry = entry;
        selectedZIP = null;

        clearDetailFilters();
        clearCountyHover();

        updateSelectedBubbleStyles();
        updateSelectedCountyHighlight();
        updateDetailModeControls();

        if (shouldFocus) {
            focusCounty(entry);
        }

        renderDetailPanel();
    }

    function switchDetailMode(requestedMode) {
        if (requestedMode === detailMode) {
            return;
        }

        if (requestedMode === "county") {
            let entry = selectedCountyEntry;

            if (selectedZIP) {
                entry = getCountyEntryForZIP(
                    selectedZIP
                );
            }

            if (!entry) {
                return;
            }

            detailMode = "county";

            selectedCountyEntry = entry;
            selectedZIP = null;

            clearDetailFilters();

            updateSelectedBubbleStyles();
            updateSelectedCountyHighlight();
            updateDetailModeControls();

            focusCounty(entry);
            renderDetailPanel();

            return;
        }

        if (requestedMode === "zip") {
            if (!selectedCountyEntry) {
                return;
            }

            const point =
                chooseRepresentativeZIPForCounty(
                    selectedCountyEntry
                );

            if (!point) {
                return;
            }

            detailMode = "zip";
            selectedZIP = point.key;

            clearDetailFilters();

            updateSelectedBubbleStyles();
            updateSelectedCountyHighlight();
            updateDetailModeControls();

            renderDetailPanel();
        }
    }

    // ==================================================
    // DETAIL CHART CLEANUP
    // ==================================================

    function disposeDetailCharts() {
        while (detailCharts.length > 0) {
            const chart = detailCharts.pop();

            if (
                chart &&
                !chart.isDisposed()
            ) {
                chart.dispose();
            }
        }
    }

    // ==================================================
    // RESET DETAIL PANEL
    // ==================================================

    function resetDetailPanel() {
        disposeDetailCharts();

        selectedZIP = null;
        selectedCountyEntry = null;
        detailMode = "zip";

        clearDetailFilters();

        const title =
            document.getElementById("detailTitle");

        const body =
            document.getElementById("detailBody");

        title.textContent =
            "Select a Location";

        body.className =
            "detail-empty-state";

        body.innerHTML = `
            <div class="detail-empty-icon">
                <span>◎</span>
            </div>

            <h3>
                Explore a placement location
            </h3>

            <p>
                Select a bubble to view ZIP-level details,
                or click inside a highlighted county to
                explore county-level placement information.
            </p>
        `;

        updateSelectedBubbleStyles();
        updateSelectedCountyHighlight();
        updateDetailModeControls();
    }

    // ==================================================
    // DETAIL METADATA BUTTONS
    // ==================================================

    function createMetaButtons(values, filterKey) {
        if (values.length === 0) {
            return '<span class="detail-static-value">—</span>';
        }

        return values.map(function (value) {
            const active =
                detailFilters[filterKey] === value;

            return `
                <button
                    type="button"
                    class="detail-meta-chip ${active ? "is-active" : ""}"
                    data-detail-filter-key="${escapeHTML(filterKey)}"
                    data-detail-filter-value="${escapeHTML(value)}"
                >
                    ${escapeHTML(value)}
                </button>
            `;
        }).join("");
    }

    function renderActiveDetailFilters() {
        const labels = {
            program: "Program",
            gradeLevel: "Grade",
            placementType: "Placement Type",
            schoolCity: "City",
            schoolDivision: "Division",
            schoolName: "School"
        };

        const active = Object.keys(detailFilters)
            .filter(function (key) {
                return Boolean(detailFilters[key]);
            });

        if (active.length === 0) {
            return `
                <span class="detail-filter-empty">
                    No detail filters applied
                </span>
            `;
        }

        return active.map(function (key) {
            return `
                <button
                    type="button"
                    class="detail-filter-chip"
                    data-remove-detail-filter="${escapeHTML(key)}"
                >
                    ${escapeHTML(labels[key])}:
                    ${escapeHTML(detailFilters[key])}
                    ×
                </button>
            `;
        }).join("");
    }

    // ==================================================
    // PROGRAM DONUT CHART
    // ==================================================

    function renderDonutChart(
        containerID,
        data,
        filterKey,
        centerValue,
        emptyMessage
    ) {
        const container =
            document.getElementById(containerID);

        if (!container) {
            return;
        }

        if (typeof echarts === "undefined") {
            container.innerHTML =
                '<div class="chart-fallback">Chart library could not be loaded.</div>';
            return;
        }

        if (data.length === 0) {
            container.innerHTML =
                `<div class="chart-fallback">${escapeHTML(emptyMessage)}</div>`;
            return;
        }

        const chart = echarts.init(container);
        detailCharts.push(chart);

        chart.setOption({
            color: CHART_COLORS,
            animationDuration: 420,

            tooltip: {
                trigger: "item",
                appendToBody: true,
                confine: false,

                extraCssText:
                    "z-index: 10000; max-width: 280px; white-space: normal;",

                formatter: function (params) {
                    return (
                        `${escapeHTML(params.name)}<br>` +
                        `${params.value} unique student${params.value === 1 ? "" : "s"} ` +
                        `(${params.percent}%)`
                    );
                }
            },

            title: {
                text: String(centerValue),
                subtext: "Students",
                left: "center",
                top: "31%",

                textStyle: {
                    fontSize: 19,
                    fontWeight: 700,
                    color: "#344054"
                },

                subtextStyle: {
                    fontSize: 10,
                    color: "#98a2b3"
                }
            },

            legend: {
                type: "scroll",
                bottom: 0,
                left: "center",

                textStyle: {
                    fontSize: 9,
                    color: "#667085"
                }
            },

            series: [{
                type: "pie",
                radius: ["48%", "70%"],
                center: ["50%", "40%"],
                cursor: "pointer",
                avoidLabelOverlap: true,

                label: {
                    show: false
                },

                emphasis: {
                    scale: true,
                    scaleSize: 4
                },

                data: data
            }]
        });

        chart.on("click", function (params) {
            if (params.componentType !== "series") {
                return;
            }

            setDetailFilter(
                filterKey,
                params.name
            );
        });
    }

    // ==================================================
    // PLACEMENT TYPE HORIZONTAL BAR CHART
    // ==================================================

    function renderPlacementTypeBarChart(
        containerID,
        data,
        currentUniqueStudents
    ) {
        const container =
            document.getElementById(containerID);

        if (!container) {
            return;
        }

        if (typeof echarts === "undefined") {
            container.innerHTML =
                '<div class="chart-fallback">Chart library could not be loaded.</div>';
            return;
        }

        if (data.length === 0) {
            container.innerHTML =
                '<div class="chart-fallback">No placement-type data available.</div>';
            return;
        }

        const chart = echarts.init(container);
        detailCharts.push(chart);

        chart.setOption({
            animationDuration: 420,

            tooltip: {
                trigger: "item",
                appendToBody: true,
                confine: false,

                extraCssText:
                    "z-index: 10000; max-width: 280px; white-space: normal;",

                formatter: function (params) {
                    const percentage =
                        currentUniqueStudents > 0
                            ? params.value /
                                currentUniqueStudents * 100
                            : 0;

                    const formattedPercentage =
                        Number.isInteger(percentage)
                            ? percentage.toFixed(0)
                            : percentage.toFixed(1);

                    return (
                        `${escapeHTML(params.name)}<br>` +
                        `${params.value} unique student${params.value === 1 ? "" : "s"}` +
                        "<br>" +
                        `${formattedPercentage}% of students in current selection`
                    );
                }
            },

            grid: {
                top: 8,
                right: 34,
                bottom: 50,
                left: 110,
                containLabel: false
            },

            xAxis: {
                type: "value",
                min: 0,
                minInterval: 1,
                name: "Number of unique students",
                nameLocation: "middle",
                nameGap: 28,

                nameTextStyle: {
                    fontSize: 9,
                    color: "#8793a3",
                    fontWeight: 500
                },

                axisLine: {
                    show: true,
                    lineStyle: {
                        color: "#d5dde6",
                        width: 1,
                        type: "dashed"
                    }
                },

                axisTick: {
                    show: false
                },

                splitLine: {
                    show: false
                },

                axisLabel: {
                    fontSize: 9,
                    color: "#98a2b3"
                }
            },

            yAxis: {
                type: "category",
                inverse: true,

                data: data.map(function (item) {
                    return item.name;
                }),

                axisLine: {
                    show: true,
                    lineStyle: {
                        color: "#d5dde6",
                        width: 1,
                        type: "dashed"
                    }
                },

                axisTick: {
                    show: false
                },

                axisLabel: {
                    fontSize: 9,
                    color: "#667085",
                    width: 100,
                    overflow: "truncate"
                }
            },

            series: [{
                name: "Unique Students",
                type: "bar",
                cursor: "pointer",
                barMaxWidth: 18,

                data: data.map(function (item) {
                    return item.value;
                }),

                label: {
                    show: true,
                    position: "right",
                    distance: 5,
                    fontSize: 9,
                    color: "#667085"
                },

                itemStyle: {
                    color: "#69C1B2",
                    borderRadius: [0, 4, 4, 0]
                }
            }]
        });

        chart.on("click", function (params) {
            if (params.componentType !== "series") {
                return;
            }

            setDetailFilter(
                "placementType",
                params.name
            );
        });
    }

    // ==================================================
    // GENERAL HORIZONTAL BAR CHART
    // ==================================================

    function renderHorizontalBarChart(
        containerID,
        data,
        emptyMessage,
        filterKey
    ) {
        const container =
            document.getElementById(containerID);

        if (!container) {
            return;
        }

        if (typeof echarts === "undefined") {
            container.innerHTML =
                '<div class="chart-fallback">Chart library could not be loaded.</div>';
            return;
        }

        if (data.length === 0) {
            container.innerHTML =
                `<div class="chart-fallback">${escapeHTML(emptyMessage)}</div>`;
            return;
        }

        const chart = echarts.init(container);
        detailCharts.push(chart);

        chart.setOption({
            animationDuration: 420,

            tooltip: {
                trigger: "item",
                appendToBody: true,
                confine: false,

                extraCssText:
                    "z-index: 10000; max-width: 280px; white-space: normal;",

                formatter: function (params) {
                    return (
                        `${escapeHTML(params.name)}<br>` +
                        `${params.value} unique student${params.value === 1 ? "" : "s"}`
                    );
                }
            },

            grid: {
                top: 8,
                right: 34,
                bottom: 50,
                left: 100,
                containLabel: false
            },

            xAxis: {
                type: "value",
                min: 0,
                minInterval: 1,
                name: "Number of students",
                nameLocation: "middle",
                nameGap: 28,

                nameTextStyle: {
                    fontSize: 9,
                    color: "#8793a3"
                },

                axisLine: {
                    show: true,
                    lineStyle: {
                        color: "#d5dde6",
                        width: 1,
                        type: "dashed"
                    }
                },

                axisTick: {
                    show: false
                },

                splitLine: {
                    show: false
                },

                axisLabel: {
                    fontSize: 9,
                    color: "#98a2b3"
                }
            },

            yAxis: {
                type: "category",
                inverse: true,

                data: data.map(function (item) {
                    return item.name;
                }),

                axisLine: {
                    show: true,
                    lineStyle: {
                        color: "#d5dde6",
                        width: 1,
                        type: "dashed"
                    }
                },

                axisTick: {
                    show: false
                },

                axisLabel: {
                    fontSize: 9,
                    color: "#667085",
                    width: 90,
                    overflow: "truncate"
                }
            },

            series: [{
                name: "Students",
                type: "bar",
                cursor: "pointer",
                barMaxWidth: 18,

                data: data.map(function (item) {
                    return item.value;
                }),

                label: {
                    show: true,
                    position: "right",
                    distance: 5,
                    fontSize: 9,
                    color: "#667085"
                },

                itemStyle: {
                    color: "#5470C6",
                    borderRadius: [0, 4, 4, 0]
                }
            }]
        });

        chart.on("click", function (params) {
            if (params.componentType !== "series") {
                return;
            }

            setDetailFilter(
                filterKey,
                params.name
            );
        });
    }

    // ==================================================
    // DETAIL BODY EVENTS
    // ==================================================

    function attachDetailBodyEvents() {
        document.querySelectorAll(
            "#student-placement-dashboard .detail-meta-chip"
        ).forEach(function (button) {
            button.addEventListener(
                "click",
                function () {
                    setDetailFilter(
                        button.dataset.detailFilterKey,
                        button.dataset.detailFilterValue
                    );
                }
            );
        });

        document.querySelectorAll(
            "#student-placement-dashboard .detail-filter-chip"
        ).forEach(function (button) {
            button.addEventListener(
                "click",
                function () {
                    const key =
                        button.dataset.removeDetailFilter;

                    detailFilters[key] = "";
                    renderDetailPanel();
                }
            );
        });

        const resetLocal =
            document.getElementById(
                "resetDetailFilters"
            );

        if (resetLocal) {
            resetLocal.addEventListener(
                "click",
                function () {
                    clearDetailFilters();
                    renderDetailPanel();
                }
            );
        }

        const countyLink =
            document.getElementById(
                "detailCountyLink"
            );

        if (countyLink) {
            countyLink.addEventListener(
                "click",
                function () {
                    switchDetailMode("county");
                }
            );
        }
    }

    // ==================================================
    // RENDER DETAIL PANEL
    // ==================================================

    function renderDetailPanel() {
        disposeDetailCharts();

        const baseRows = getDetailBaseRows();

        if (baseRows.length === 0) {
            resetDetailPanel();
            return;
        }

        let detailRows =
            applyDetailFilters(baseRows);

        if (detailRows.length === 0) {
            clearDetailFilters();
            detailRows = baseRows;
        }

        const title =
            document.getElementById("detailTitle");

        const body =
            document.getElementById("detailBody");

        let administrativeArea = "";

        if (detailMode === "zip") {
            title.textContent =
                `ZIP ${selectedZIP}`;

            administrativeArea =
                getAdministrativeAreaForZIP(
                    selectedZIP
                );
        } else {
            administrativeArea =
                selectedCountyEntry
                    .feature
                    .properties
                    .NAME;

            title.textContent =
                administrativeArea;
        }

        const cities =
            getUniqueColumnValues(
                detailRows,
                "School City"
            );

        const divisions =
            getUniqueColumnValues(
                detailRows,
                "School Division"
            );

        const schools =
            getUniqueColumnValues(
                detailRows,
                "School Name"
            );

        const uniqueStudents =
            countUniqueStudents(detailRows);

        const zipLocations =
            countUniqueZIPs(detailRows);

        let countyHTML;

        if (
            detailMode === "zip" &&
            selectedCountyEntry
        ) {
            countyHTML = `
                <button
                    type="button"
                    class="detail-county-link"
                    id="detailCountyLink"
                    title="View county-level details"
                >
                    ${escapeHTML(administrativeArea)}
                </button>
            `;
        } else {
            countyHTML = `
                <span class="detail-static-value">
                    ${escapeHTML(administrativeArea || "—")}
                </span>
            `;
        }

        const countyZIPKPI =
            detailMode === "county"
                ? `
                    <div class="detail-stat">
                        <div class="detail-stat-value">
                            ${zipLocations}
                        </div>

                        <div class="detail-stat-label">
                            ZIP Code Locations
                        </div>
                    </div>
                `
                : "";

        body.className = "detail-content";

        body.innerHTML = `
            <div class="detail-location-meta">

                <div class="detail-location-row">
                    <div class="detail-location-label">
                        School City:
                    </div>

                    <div class="detail-location-value">
                        ${createMetaButtons(
                            cities,
                            "schoolCity"
                        )}
                    </div>
                </div>

                <div class="detail-location-row">
                    <div class="detail-location-label">
                        School Division:
                    </div>

                    <div class="detail-location-value">
                        ${createMetaButtons(
                            divisions,
                            "schoolDivision"
                        )}
                    </div>
                </div>

                <div class="detail-location-row">
                    <div class="detail-location-label">
                        Administrative Area:
                    </div>

                    <div class="detail-location-value">
                        ${countyHTML}
                    </div>
                </div>

            </div>

            <div
                class="detail-stat-grid
                ${detailMode === "county" ? "four-columns" : ""}"
            >
                <div class="detail-stat">
                    <div class="detail-stat-value">
                        ${uniqueStudents}
                    </div>

                    <div class="detail-stat-label">
                        Unique Students
                    </div>
                </div>

                <div class="detail-stat">
                    <div class="detail-stat-value">
                        ${schools.length}
                    </div>

                    <div class="detail-stat-label">
                        Schools
                    </div>
                </div>

                <div class="detail-stat">
                    <div class="detail-stat-value">
                        ${divisions.length}
                    </div>

                    <div class="detail-stat-label">
                        Divisions
                    </div>
                </div>

                ${countyZIPKPI}
            </div>

            <div class="detail-filter-toolbar">
                <div class="detail-filter-summary">
                    <div class="detail-filter-title">
                        Detail Filters
                    </div>

                    <div class="detail-filter-chips">
                        ${renderActiveDetailFilters()}
                    </div>
                </div>

                <button
                    type="button"
                    id="resetDetailFilters"
                    class="reset-detail-filters"
                    ${hasActiveDetailFilters() ? "" : "disabled"}
                >
                    Reset Detail Filters
                </button>
            </div>

            <section class="detail-section">
                <div class="detail-section-header">
                    <h3 class="detail-section-title">
                        Program Distribution
                    </h3>

                    <p class="detail-section-subtitle">
                        Unique students by program.
                        Click a program to filter this location.
                    </p>
                </div>

                <div
                    id="programChart"
                    class="detail-chart"
                ></div>
            </section>

            <section class="detail-section">
                <div class="detail-section-header">
                    <h3 class="detail-section-title">
                        Students by Placement Type
                    </h3>

                    <p
                        class="detail-section-subtitle placement-type-note"
                    >
                        Unique students with each placement type.
                        Students may have more than one placement type,
                        so category counts may exceed the total number
                        of unique students.
                        Click a placement type to filter this location.
                    </p>
                </div>

                <div
                    id="placementTypeChart"
                    class="detail-chart"
                ></div>
            </section>

            <section class="detail-section">
                <div class="detail-section-header">
                    <h3 class="detail-section-title">
                        Grade Level
                    </h3>

                    <p class="detail-section-subtitle">
                        Unique students by grade level.
                        Click a grade level to filter this location.
                    </p>
                </div>

                <div
                    id="gradeChart"
                    class="detail-chart"
                ></div>
            </section>

            <section class="detail-section">
                <div class="detail-section-header">
                    <h3 class="detail-section-title">
                        Schools
                    </h3>

                    <p class="detail-section-subtitle">
                        Unique students by school.
                        Click a school to filter this location.
                    </p>
                </div>

                <div
                    id="schoolChart"
                    class="detail-chart"
                ></div>
            </section>
        `;

        const programData =
            countUniqueStudentsByCategory(
                detailRows,
                "Program"
            );

        const placementTypeData =
            countUniqueStudentsByCategory(
                detailRows,
                "Placement Type"
            );

        const gradeData =
            countUniqueStudentsByCategory(
                detailRows,
                "Grade Level"
            );

        const schoolData =
            countUniqueStudentsByCategory(
                detailRows,
                "School Name"
            );

        const placementTypeChart =
            document.getElementById(
                "placementTypeChart"
            );

        if (placementTypeChart) {
            placementTypeChart.style.height =
                `${Math.max(
                    220,
                    90 + placementTypeData.length * 29
                )}px`;
        }

        const gradeChart =
            document.getElementById(
                "gradeChart"
            );

        if (gradeChart) {
            gradeChart.style.height =
                `${Math.max(
                    220,
                    90 + gradeData.length * 27
                )}px`;
        }

        const schoolChart =
            document.getElementById(
                "schoolChart"
            );

        if (schoolChart) {
            schoolChart.style.height =
                `${Math.max(
                    220,
                    90 + schoolData.length * 27
                )}px`;
        }

        attachDetailBodyEvents();

        requestAnimationFrame(function () {
            renderDonutChart(
                "programChart",
                programData,
                "program",
                uniqueStudents,
                "No program data available."
            );

            renderPlacementTypeBarChart(
                "placementTypeChart",
                placementTypeData,
                uniqueStudents
            );

            renderHorizontalBarChart(
                "gradeChart",
                gradeData,
                "No grade-level data available.",
                "gradeLevel"
            );

            renderHorizontalBarChart(
                "schoolChart",
                schoolData,
                "No school data available.",
                "schoolName"
            );
        });

        updateSelectedBubbleStyles();
        updateSelectedCountyHighlight();
        updateDetailModeControls();
    }

    // ==================================================
    // RENDER MAP POINTS
    // ==================================================

    function renderMapPoints(points) {
        closeActiveBubbleTooltip();

        if (heatLayer) {
            map.removeLayer(heatLayer);
            heatLayer = null;
        }

        bubbleLayer.clearLayers();
        bubbleMarkersByZIP.clear();

        if (points.length === 0) {
            return;
        }

        const counts = points.map(function (point) {
            return point.students;
        });

        const minStudents = Math.min(...counts);
        const maxStudents = Math.max(...counts);

        const heatData = points.map(function (point) {
            const ratio = normalizeColorValue(
                point.students,
                minStudents,
                maxStudents
            );

            return [
                point.latitude,
                point.longitude,
                0.12 + 0.88 * ratio
            ];
        });

        heatLayer = L.heatLayer(heatData, {
            pane: "heatPane",
            radius: 28,
            blur: 20,
            minOpacity: 0.12,
            max: 1,
            maxZoom: map.getMinZoom(),
            gradient: HEAT_GRADIENT
        }).addTo(map);

        points.forEach(function (point) {
            const ratio = normalizeColorValue(
                point.students,
                minStudents,
                maxStudents
            );

            const bubbleRadius = getBubbleRadius(
                point.students,
                minStudents,
                maxStudents
            );

            const bubble = L.circleMarker(
                [
                    point.latitude,
                    point.longitude
                ],
                {
                    pane: "bubblePane",
                    radius: bubbleRadius,

                    color: "#ffffff",
                    weight: 1.5,
                    opacity: 0.92,

                    fillColor: getColorForRatio(ratio),
                    fillOpacity: 0.56,

                    interactive: true,
                    bubblingMouseEvents: false,
                    className: "student-bubble"
                }
            );

            bubble._baseRadius = bubbleRadius;

            bubbleMarkersByZIP.set(
                point.key,
                bubble
            );

            bubble.bindTooltip(
                `
                    <div class="student-tooltip-content">

                        <div class="student-tooltip-title">
                            ${escapeHTML(point.label)}
                        </div>

                        <div class="student-tooltip-detail">
                            <span class="student-tooltip-label">
                                School City
                            </span>

                            <strong>
                                ${formatTooltipList(point.cities)}
                            </strong>
                        </div>

                        <div class="student-tooltip-detail">
                            <span class="student-tooltip-label">
                                School Division
                            </span>

                            <strong>
                                ${formatTooltipList(point.divisions)}
                            </strong>
                        </div>

                        <div class="student-tooltip-detail">
                            <span class="student-tooltip-label">
                                School Name
                            </span>

                            <strong>
                                ${formatTooltipList(point.schools)}
                            </strong>
                        </div>

                        <div class="student-tooltip-detail">
                            <span class="student-tooltip-label">
                                Administrative Area
                            </span>

                            <span>
                                ${escapeHTML(
                                    point.administrativeArea || "—"
                                )}
                            </span>
                        </div>

                        <div class="student-tooltip-row">
                            <span>
                                Unique Students
                            </span>

                            <strong>
                                ${point.students}
                            </strong>
                        </div>

                    </div>
                `,
                {
                    direction: "top",
                    sticky: false,
                    offset: [0, -10],
                    opacity: 1,
                    className: "student-tooltip"
                }
            );

            bubble.on("tooltipopen", function () {
                if (
                    activeBubbleTooltipMarker &&
                    activeBubbleTooltipMarker !== bubble
                ) {
                    activeBubbleTooltipMarker.closeTooltip();
                }

                activeBubbleTooltipMarker = bubble;

                positionBubbleTooltipSafely(bubble);

                requestAnimationFrame(function () {
                    const tooltip = bubble.getTooltip();

                    if (
                        tooltip &&
                        map.hasLayer(tooltip)
                    ) {
                        positionBubbleTooltipSafely(bubble);
                    }
                });
            });

            bubble.on("mouseover", function () {
                if (
                    activeBubbleTooltipMarker &&
                    activeBubbleTooltipMarker !== bubble
                ) {
                    activeBubbleTooltipMarker.closeTooltip();
                }

                activeBubbleTooltipMarker = bubble;
                isHoveringBubble = true;

                clearCountyHover();
            });

            bubble.on("mouseout", function (event) {
                if (
                    activeBubbleTooltipMarker === bubble
                ) {
                    closeActiveBubbleTooltip();
                } else {
                    bubble.closeTooltip();
                }

                const entry = findCountyEntry(
                    event.latlng.lat,
                    event.latlng.lng
                );

                if (entry) {
                    showCountyHover(
                        entry,
                        event.latlng
                    );
                } else {
                    clearCountyHover();
                }
            });

            bubble.on("tooltipclose", function () {
                if (
                    activeBubbleTooltipMarker === bubble
                ) {
                    activeBubbleTooltipMarker = null;
                    isHoveringBubble = false;
                }
            });

            bubble.on("click", function () {
                selectZIP(point);
            });

            bubble.addTo(bubbleLayer);
        });

        updateSelectedBubbleStyles();
        syncHeatLayerVisibility();
    }

    // ==================================================
    // COUNTY/CITY CLICK
    // ==================================================

    map.on("click", function (event) {
        const entry = findCountyEntry(
            event.latlng.lat,
            event.latlng.lng
        );

        if (!entry) {
            return;
        }

        selectCounty(entry, true);
    });

    // ==================================================
    // UPDATE DASHBOARD
    // ==================================================

    function updateDashboard(focusResults = false) {
        filteredPlacementData =
            filterPlacementData();

        const zipSummary =
            countStudentsByZIP(
                filteredPlacementData
            );

        const points =
            createZIPPoints(zipSummary);

        currentMapPoints = points;

        renderMapPoints(points);

        updateDashboardKPIs(
            filteredPlacementData,
            points.length
        );

        updateMapSummary(
            filteredPlacementData,
            points
        );

        if (
            selectedZIP ||
            selectedCountyEntry
        ) {
            const baseRows =
                getDetailBaseRows();

            if (baseRows.length === 0) {
                resetDetailPanel();
            } else {
                renderDetailPanel();
            }
        }

        if (focusResults) {
            focusMapOnPoints(points);
        }
    }

    // ==================================================
    // GLOBAL EVENTS
    // ==================================================

    function attachGlobalEvents() {
        const programFilter =
            document.getElementById("programFilter");

        const gradeFilter =
            document.getElementById("gradeFilter");

        const placementTypeFilter =
            document.getElementById("placementTypeFilter");

        const divisionFilter =
            document.getElementById("divisionFilter");

        const schoolFilter =
            document.getElementById("schoolFilter");

        const searchInput =
            document.getElementById("dashboardSearch");

        const resetFilters =
            document.getElementById("resetFilters");

        const resetDetails =
            document.getElementById("resetDetails");

        const ZIPModeButton =
            document.getElementById("detailModeZIP");

        const countyModeButton =
            document.getElementById("detailModeCounty");

        countyModeButton.textContent =
            "By County/City";

        countyModeButton.style.whiteSpace =
            "nowrap";

        countyModeButton.setAttribute(
            "aria-label",
            "View details by county or independent city"
        );

        const dropdownFilters = [
            programFilter,
            gradeFilter,
            placementTypeFilter,
            divisionFilter,
            schoolFilter
        ];

        updateAllFilterVisualStates();

        dropdownFilters.forEach(function (selectElement) {
            selectElement.addEventListener(
                "change",
                function () {
                    updateFilterVisualState(
                        selectElement
                    );

                    updateDashboard(true);
                }
            );
        });

        let searchTimer = null;

        searchInput.addEventListener(
            "input",
            function () {
                clearTimeout(searchTimer);

                searchTimer = setTimeout(
                    function () {
                        updateDashboard(true);
                    },
                    250
                );
            }
        );

        resetFilters.addEventListener(
            "click",
            function () {
                programFilter.value = "";
                gradeFilter.value = "";
                placementTypeFilter.value = "";
                divisionFilter.value = "";
                schoolFilter.value = "";
                searchInput.value = "";

                updateAllFilterVisualStates();

                resetDetailPanel();
                updateDashboard(false);

                map.setView(
                    CONFIG.initialMapCenter,
                    CONFIG.initialMapZoom,
                    {
                        animate: true
                    }
                );
            }
        );

        resetDetails.addEventListener(
            "click",
            function () {
                resetDetailPanel();
            }
        );

        ZIPModeButton.addEventListener(
            "click",
            function () {
                switchDetailMode("zip");
            }
        );

        countyModeButton.addEventListener(
            "click",
            function () {
                switchDetailMode("county");
            }
        );
    }

    // ==================================================
    // LOAD PLACEMENTS EXCEL
    // ==================================================

    async function loadPlacementData() {
        const response = await fetch(
            CONFIG.placementsURL
        );

        if (!response.ok) {
            throw new Error(
                "Could not load placements.xlsx"
            );
        }

        const excelFile =
            await response.arrayBuffer();

        const workbook =
            XLSX.read(excelFile);

        const worksheet =
            workbook.Sheets[
                workbook.SheetNames[0]
            ];

        return XLSX.utils.sheet_to_json(
            worksheet
        );
    }

    // ==================================================
    // RESPONSIVE MAP AND CHARTS
    // ==================================================

    const mapContainer =
        document.getElementById("map");

    if (
        typeof ResizeObserver !== "undefined"
    ) {
        const resizeObserver =
            new ResizeObserver(function () {
                map.invalidateSize();

                detailCharts.forEach(function (chart) {
                    if (
                        chart &&
                        !chart.isDisposed()
                    ) {
                        chart.resize();
                    }
                });
            });

        resizeObserver.observe(mapContainer);
    }

    // ==================================================
    // INITIALIZE DASHBOARD
    // ==================================================

    async function initializeDashboard() {
        try {
            console.log("Starting dashboard...");

            setPlacementMapLoading(
                "Loading Virginia map and program data..."
            );

            const results = await Promise.all([
                countyDataPromise,
                loadPlacementData(),
                loadZIPCoordinates()
            ]);

            allPlacementData = results[1];
            allZIPCoordinates = results[2];

            filteredPlacementData = [
                ...allPlacementData
            ];

            populateDashboardFilters(
                allPlacementData
            );

            attachGlobalEvents();
            updateDetailModeControls();

            updateDashboard(false);

            setPlacementMapLoading("");

            setTimeout(function () {
                map.invalidateSize();
            }, 0);

            console.log(
                "Dashboard initialized successfully."
            );
        } catch (error) {
            console.error(
                "Dashboard initialization failed:",
                error
            );

            setPlacementMapLoading(
                "Unable to load Virginia map and program data.",
                true
            );
        }
    }

    initializeDashboard();

})();
