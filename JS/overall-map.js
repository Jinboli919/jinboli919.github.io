
(() => {
  "use strict";

  // ============================================================
  // OVERALL PROGRAM REACH
  // 
  // 
  // ============================================================

  const PROGRAMS = [
    { id: "VAPSP", color: "#2563EB", page: "/vapsp.html", published: false },
    { id: "VAAPI", color: "#16A34A", page: "/vaapi.html", published: false },
    { id: "VAICC", color: "#9333EA", page: "/vaicc.html", published: false },
    { id: "CTA", color: "#F59E0B", page: "/cta.html", published: false },
    { id: "Placements", color: "#DC2626", page: "/placements.html", published: true },
    { id: "Teaching Fellows", color: "#168F83", page: "/overall.html", published: false }
  ];

  const CONFIG = {
    center: [38.45, -78.87],
    zoom: 8,
    countyZoom: 10,
    cityZoom: 13,
    detailCountyZoom: 9,
    detailCityZoom: 12,
    cityBadgeBelow: 11,

    zipURL: "/Data/zip_coordinates.csv",

    countyURL:
      "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/19/query" +
      "?where=STATE%3D%2751%27&outFields=NAME,GEOID,STATE,COUNTY" +
      "&returnGeometry=true&outSR=4326&f=geojson",

    tiles:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
  };

  const el = id => document.getElementById(id);

  const fmt = n =>
    Number(n).toLocaleString("en-US");

  const safe = value =>
    String(value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);

  // ============================================================
  // STATE
  // ============================================================

  const state = {
    map: null,
    countyLayer: null,
    bubbleLayer: null,
    bubbleRenderer: null,
    tooltip: null,

    areas: [],
    grid: new Map(),
    counts: new Map(),
    maxCount: 1,

    mapPrograms: new Set(PROGRAMS.map(p => p.id)),
    detailPrograms: new Set(PROGRAMS.map(p => p.id)),

    countyFilter: new Set(),
    countySearch: "",

    selected: null,
    hovered: null,
    focus: null,

    bubbleHover: false,
    year: "2024-2025",
    loaded: false,

    mouse: null,
    mouseFrame: 0,
    tooltipMovedAt: 0,
    moving: false,

    renderFrame: 0,
    layoutKey: "",
    markerHandles: [],
    summaryCount: 0
  };

  // ============================================================
  // DATA HELPERS
  // ============================================================

  function getYear() {
    const academicYear = window.AcademicYear;

    const selectedYears =
      academicYear?.getSelectedYears?.();

    if (
      Array.isArray(selectedYears) &&
      selectedYears.length === 1
    ) {
      return selectedYears[0];
    }

    const availableYears =
      academicYear?.years;

    return (
      new URLSearchParams(location.search).get("year") ||
      academicYear?.defaultYear ||
      (
        Array.isArray(availableYears)
          ? availableYears[availableYears.length - 1]
          : ""
      ) ||
      ""
    );
  }

  function zip5(value) {
    const x = String(value ?? "").trim();
    const match = x.match(/\d{5}/);

    return match
      ? match[0]
      : /^\d{1,4}$/.test(x)
        ? x.padStart(5, "0")
        : "";
  }

  function parseCSV(source) {
    const text =
      String(source).replace(/^\uFEFF/, "");

    const rows = [];

    let row = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];

      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (c === "," && !quoted) {
        row.push(cell.trim());
        cell = "";
      } else if (
        (c === "\n" || c === "\r") &&
        !quoted
      ) {
        if (c === "\r" && text[i + 1] === "\n") {
          i++;
        }

        row.push(cell.trim());

        if (row.some(Boolean)) {
          rows.push(row);
        }

        row = [];
        cell = "";
      } else {
        cell += c;
      }
    }

    row.push(cell.trim());

    if (row.some(Boolean)) {
      rows.push(row);
    }

    if (!rows.length) {
      return [];
    }

    const keys = rows.shift().map(x =>
      x.toLowerCase().replace(/[^a-z0-9]/g, "")
    );

    return rows.map(cells =>
      Object.fromEntries(
        keys.map((key, i) => [
          key,
          cells[i] ?? ""
        ])
      )
    );
  }

  async function getText(url) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `${url}: HTTP ${response.status}`
      );
    }

    return response.text();
  }

  async function loadSelectedOverallText() {
    const loader = window.MultiYearData;

    if (
      loader &&
      typeof loader.loadOverallText === "function"
    ) {
      return loader.loadOverallText();
    }

    // Fallback is permitted only for one academic year.
    // Multiple years require the historical data loader.

    const academicYear = window.AcademicYear;

    const selectedYears =
      academicYear?.getSelectedYears?.() || [];

    const allHistorical =
      Boolean(academicYear?.isAllHistorical?.()) ||
      Boolean(academicYear?.isAllHistoric?.());

    if (
      allHistorical ||
      (
        Array.isArray(selectedYears) &&
        selectedYears.length > 1
      )
    ) {
      throw new Error(
        "MultiYearData is unavailable. " +
        "Load academic-year.js and multi-year-data.js " +
        "before overall-map.js."
      );
    }

    const year =
      (
        Array.isArray(selectedYears) &&
        selectedYears.length
      )
        ? selectedYears[0]
        : getYear();

    if (!year) {
      throw new Error(
        "No academic year is available."
      );
    }

    return getText(
      `/Data/overall/${encodeURIComponent(year)}.csv`
    );
  }

  function notice(message, error = false) {
    const node = el("overallMapNotice");

    if (!node) return;

    node.textContent = message;
    node.hidden = !message;

    node.classList.toggle(
      "is-error",
      error
    );
  }

  const isCity = feature =>
    Number(feature.properties?.COUNTY) >= 500;

  function areaName(feature) {
    const name = String(
      feature.properties?.NAME || "Unknown"
    ).trim();

    return /\b(county|city)$/i.test(name)
      ? name
      : name + (
          isCity(feature)
            ? " City"
            : " County"
        );
  }

  function countyMatches(area) {
    if (
      state.countyFilter.size &&
      !state.countyFilter.has(area.id)
    ) {
      return false;
    }

    if (
      state.countySearch &&
      !area.name
        .toLocaleLowerCase()
        .includes(state.countySearch)
    ) {
      return false;
    }

    return true;
  }

  // ============================================================
  // SPATIAL INDEX FOR FAST COUNTY/CITY HOVER
  // ============================================================

  const GRID_DEGREES = 0.25;

  const gridCell = (y, x) => `${y}:${x}`;

  function addToGrid(area) {
    const sw = area.bounds.getSouthWest();
    const ne = area.bounds.getNorthEast();

    for (
      let y = Math.floor(sw.lat / GRID_DEGREES);
      y <= Math.floor(ne.lat / GRID_DEGREES);
      y++
    ) {
      for (
        let x = Math.floor(sw.lng / GRID_DEGREES);
        x <= Math.floor(ne.lng / GRID_DEGREES);
        x++
      ) {
        const key = gridCell(y, x);

        if (!state.grid.has(key)) {
          state.grid.set(key, []);
        }

        state.grid.get(key).push(area);
      }
    }
  }

  function areaAt(lat, lng) {
    const key = gridCell(
      Math.floor(lat / GRID_DEGREES),
      Math.floor(lng / GRID_DEGREES)
    );

    const candidates = state.grid.get(key) || [];

    const point = turf.point([lng, lat]);
    const latlng = L.latLng(lat, lng);

    // Independent Cities are checked first.

    for (const area of candidates) {
      if (
        area.bounds.contains(latlng) &&
        turf.booleanPointInPolygon(point, area.feature)
      ) {
        return area;
      }
    }

    return null;
  }

  // ============================================================
  // MAP INITIALIZATION AND EVENTS
  // ============================================================

  function initMap() {
    if (!window.L || !window.turf) {
      throw new Error(
        "Leaflet or Turf failed to load."
      );
    }

    if (!el("overallMap")) {
      throw new Error(
        "Missing #overallMap element."
      );
    }

    const map = state.map = L.map(
      "overallMap",
      {
        minZoom: 3,
        maxZoom: 18
      }
    ).setView(
      CONFIG.center,
      CONFIG.zoom
    );

    L.tileLayer(CONFIG.tiles, {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri"
    }).addTo(map);

    // County Pane

    map.createPane("overallCountyPane");

    map.getPane(
      "overallCountyPane"
    ).style.zIndex = "430";

    map.getPane(
      "overallCountyPane"
    ).style.pointerEvents = "none";

    // Bubble Pane

    map.createPane("overallBubblePane");

    map.getPane(
      "overallBubblePane"
    ).style.zIndex = "500";

    state.bubbleRenderer = L.canvas({
      pane: "overallBubblePane",
      padding: 0.25
    });

    state.bubbleLayer = L.layerGroup()
      .addTo(map);

    state.tooltip = L.tooltip({
      direction: "top",
      offset: [0, -12],
      opacity: 1,
      interactive: false,
      className: "overall-county-tooltip"
    });

    // ====================================================
    // MAP MOUSEMOVE
    // ====================================================

    map.on("mousemove", event => {
      if (
        !state.loaded ||
        state.bubbleHover ||
        state.moving
      ) {
        return;
      }

      state.mouse = event.latlng;

      if (state.mouseFrame) {
        return;
      }

      state.mouseFrame =
        requestAnimationFrame(() => {
          state.mouseFrame = 0;

          if (
            state.loaded &&
            !state.bubbleHover &&
            !state.moving &&
            state.mouse
          ) {
            hoverArea(
              areaAt(
                state.mouse.lat,
                state.mouse.lng
              ),
              state.mouse
            );
          }
        });
    });

    // County / City click

    map.on("click", event => {
      if (!state.loaded) return;

      const area = areaAt(
        event.latlng.lat,
        event.latlng.lng
      );

      if (
        area &&
        countyMatches(area)
      ) {
        selectArea(area, null, true);
      }
    });

    // Hover cleanup

    map.getContainer().addEventListener(
      "mouseleave",
      () => hoverArea(null)
    );

    map.on(
      "movestart zoomstart",
      () => {
        state.moving = true;
        hoverArea(null);
      }
    );

    map.on("moveend", () => {
      state.moving = false;
    });

    map.on("zoomend", scheduleLayout);
  }

  // ============================================================
  // COUNTY/CITY BOUNDARY AND HOVER
  // ============================================================

  function styleOf(area) {
    if (
      state.hovered === area &&
      state.selected === area
    ) {
      return {
        color: "#315f80",
        weight: 1.8,
        opacity: 1,
        fill: true,
        fillColor: "#6fa7c5",
        fillOpacity: 0.18
      };
    }

    if (state.selected === area) {
      return {
        color: "#3f6f8c",
        weight: 1.25,
        opacity: 1,
        fill: true,
        fillColor: "#6fa7c5",
        fillOpacity: 0.10
      };
    }

    if (state.hovered === area) {
      return {
        color: "#426783",
        weight: 0.95,
        opacity: 0.95,
        fill: true,
        fillColor: "#74A7C5",
        fillOpacity: 0.12
      };
    }

    if (
      state.countyFilter.size ||
      state.countySearch
    ) {
      if (countyMatches(area)) {
        return {
          color: "#450084",
          weight: 1.7,
          opacity: 1,
          fill: true,
          fillColor: "#a78bfa",
          fillOpacity: 0.12
        };
      }

      return {
        color: "#94a3b8",
        weight: 0.25,
        opacity: 0.25,
        fill: true,
        fillColor: "#94a3b8",
        fillOpacity: 0.002
      };
    }

    return {
      color: "#64748b",
      weight: 0.35,
      opacity: 0.58,
      fill: true,
      fillColor: "#73A3BE",
      fillOpacity: 0.004
    };
  }

  function hideAreaTooltip() {
    if (
      state.tooltip &&
      state.map.hasLayer(state.tooltip)
    ) {
      state.map.removeLayer(state.tooltip);
    }
  }

  function hoverArea(area, latlng = null) {
    if (
      area &&
      !countyMatches(area)
    ) {
      area = null;
    }

    const previous = state.hovered;

    if (previous !== area) {
      state.hovered = area;

      if (previous) {
        previous.layer.setStyle(
          styleOf(previous)
        );
      }

      if (area) {
        area.layer.setStyle(
          styleOf(area)
        );

        area.layer.bringToFront();

        state.tooltip.setContent(
          safe(area.name)
        );
      }

      state.tooltipMovedAt = 0;
    }

    if (!area || state.bubbleHover) {
      hideAreaTooltip();
      return;
    }

    const now = performance.now();

    if (
      latlng &&
      (
        previous !== area ||
        now - state.tooltipMovedAt > 36
      )
    ) {
      state.tooltip.setLatLng(latlng);
      state.tooltipMovedAt = now;
    }

    if (!state.map.hasLayer(state.tooltip)) {
      state.tooltip.addTo(state.map);
    }
  }

  function loadAreas(data) {
    state.countyLayer = L.geoJSON(data, {
      pane: "overallCountyPane",
      interactive: false,

      style: () => ({
        color: "#64748b",
        weight: 0.35,
        opacity: 0.58,
        fill: true,
        fillColor: "#73A3BE",
        fillOpacity: 0.004
      }),

      onEachFeature(feature, layer) {
        const bounds = layer.getBounds();
        let anchor = bounds.getCenter();

        try {
          const [lng, lat] =
            turf.pointOnFeature(feature)
              .geometry.coordinates;

          anchor = L.latLng(lat, lng);
        } catch (error) {
          // Use bounds center as fallback.
        }

        const area = {
          id: String(
            feature.properties?.GEOID ?? ""
          ),

          name: areaName(feature),
          isCity: isCity(feature),

          feature,
          bounds,
          layer,
          anchor,

          candidates: null,
          geometryZoom: null,
          geometry: null
        };

        state.areas.push(area);
        addToGrid(area);
      }
    }).addTo(state.map);

    // Independent Cities checked first.

    for (const list of state.grid.values()) {
      list.sort(
        (a, b) =>
          Number(b.isCity) -
          Number(a.isCity)
      );
    }
  }

  // ============================================================
  // ZIP -> COUNTY/CITY -> PROGRAM COUNTS
  // ============================================================

  function loadCounts(zipText, overallText) {
    const coordinates = new Map();

    for (const row of parseCSV(zipText)) {
      const values = Object.values(row);

      const zip = zip5(
        row.zip ||
        row.zipcode ||
        values[0]
      );

      const lat = Number(
        row.latitude ||
        row.lat ||
        values[1]
      );

      const lng = Number(
        row.longitude ||
        row.lon ||
        row.lng ||
        values[2]
      );

      if (
        zip &&
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      ) {
        coordinates.set(zip, {
          lat,
          lng
        });
      }
    }

    const zipAreas = new Map();

    let matched = 0;
    let skipped = 0;

    state.counts.clear();

    for (const row of parseCSV(overallText)) {
      // Overall data is already filtered by MultiYearData.
      // Do not filter again using one selected academic year.
      // This allows counts from multiple years to be summed
      // within each program and county/independent city.

      const rawProgram = String(row.program || "")
        .trim()
        .toLowerCase();

      const isTFPara =
        rawProgram === "teaching fellows - paraprofessionals";

      const isTFOnCampus =
        rawProgram === "teaching fellows - on-campus";

      const normalizedProgram =
        (isTFPara || isTFOnCampus)
          ? "teaching fellows"
          : rawProgram;

      const program = PROGRAMS.find(
        p => p.id.toLowerCase() === normalizedProgram
      );

      const zip = zip5(
        row.zipcode ||
        row.zip
      );

      const count = Number(
        String(row.count ?? "")
          .replace(/,/g, "")
      );

      if (
        !program ||
        !zip ||
        !Number.isFinite(count) ||
        count < 0
      ) {
        skipped++;
        continue;
      }

      if (!zipAreas.has(zip)) {
        const point = coordinates.get(zip);

        zipAreas.set(
          zip,
          point
            ? areaAt(point.lat, point.lng)
            : null
        );
      }

      const area = zipAreas.get(zip);

      if (!area) {
        skipped++;
        continue;
      }

      const values =
        state.counts.get(area.id) || {};

      values[program.id] =
        (values[program.id] || 0) + count;

      if (isTFPara) {
        values["Teaching Fellows - Paraprofessionals"] =
          (values["Teaching Fellows - Paraprofessionals"] || 0)
          + count;
      }

      if (isTFOnCampus) {
        values["Teaching Fellows - On-Campus"] =
          (values["Teaching Fellows - On-Campus"] || 0)
          + count;
      }

      state.counts.set(
        area.id,
        values
      );

      matched++;
    }

    applyTeachingFellowsChoice(
      el("overallTeachingFellowsSubprogram")?.value || "all"
    );

    state.maxCount = Math.max(
      1,
      ...[...state.counts.values()]
        .flatMap(
          values =>
            PROGRAMS.map(
              p => values[p.id] || 0
            )
        )
    );

    const note = el("overallDataNote");

    if (note) {
      note.textContent =
        `Demonstration data · ${matched} ZIP-level records matched` +
        (
          skipped
            ? ` · ${skipped} not mapped`
            : ""
        ) +
        ". Counties and independent cities are reported separately. " +
        "Multicolor markers identify small areas with program data.";
    }
  }

  // ============================================================
  // ZOOM AND COUNTY/CITY SELECTION
  // ============================================================

  function zoomToArea(
    area,
    mode = "boundary"
  ) {
    if (!area) return;

    const map = state.map;

    if (
      mode === "boundary" &&
      !area.isCity
    ) {
      map.fitBounds(
        area.bounds,
        {
          padding: [35, 35],
          maxZoom: CONFIG.countyZoom,
          animate: true
        }
      );

      return;
    }

    const maxZoom = area.isCity
      ? CONFIG.cityZoom
      : CONFIG.countyZoom;

    const minZoom = mode === "detail"
      ? (
          area.isCity
            ? CONFIG.detailCityZoom
            : CONFIG.detailCountyZoom
        )
      : map.getZoom();

    const fitZoom = map.getBoundsZoom(
      area.bounds,
      false,
      L.point(110, 110)
    );

    const zoom = Math.min(
      maxZoom,
      Math.max(
        map.getZoom(),
        minZoom,
        fitZoom
      )
    );

    const center =
      area.bounds.getCenter();

    if (
      mode === "detail" &&
      map.getZoom() >= zoom &&
      map.getBounds().contains(center)
    ) {
      return;
    }

    map.flyTo(
      center,
      zoom,
      {
        animate: true,
        duration: 0.55
      }
    );
  }

  // ============================================================
  // PROGRAM FILTER: FOCUS REACHED AREAS OR RESET MAP
  // ============================================================

  function reachedAreas() {
    return state.areas.filter(area => {
      const values =
        state.counts.get(area.id) || {};

      return countyMatches(area) &&
        PROGRAMS.some(
          p =>
            state.mapPrograms.has(p.id) &&
            values[p.id] > 0
        );
    });
  }

  function resetMapView() {
    if (state.loaded) {
      state.map.setView(
        CONFIG.center,
        CONFIG.zoom,
        { animate: true }
      );
    }
  }

  function focusMapOnPrograms() {
    if (!state.loaded) return;

    const areas = reachedAreas();

    if (!areas.length) {
      resetMapView();
      return;
    }

    if (areas.length === 1) {
      state.map.setView(
        areas[0].anchor,
        CONFIG.zoom,
        { animate: true }
      );

      return;
    }

    const bounds = L.latLngBounds(
      areas.map(area => area.anchor)
    );

    state.map.fitBounds(bounds, {
      paddingTopLeft: [60, 60],
      paddingBottomRight: [60, 60],
      maxZoom: CONFIG.zoom,
      animate: true
    });
  }

  // ============================================================
  // CLEAR MAP SELECTION
  //
  // Called when:
  // - Program Filter -> Select All
  // - Program Filter -> Clear
  // - County / City Filter -> Reset
  // - A county filter excludes the previously selected area
  //
  // This resets the selected area and its visual state.
  // It does NOT change academic years, program filters,
  // county filters, or the underlying data.
  // ============================================================

  function clearMapSelection() {
    const previousSelected = state.selected;

    // Clear the currently selected county / city
    // and any focused program.
    state.selected = null;
    state.focus = null;

    // Reset detail-only filters to the current
    // main Program Filter selection.
    state.detailPrograms =
      new Set(state.mapPrograms);

    // Clear hover state and any pending mouse update.
    state.bubbleHover = false;
    state.mouse = null;

    if (state.mouseFrame) {
      cancelAnimationFrame(state.mouseFrame);
      state.mouseFrame = 0;
    }

    if (state.map) {
      hoverArea(null);
      hideAreaTooltip();
    } else {
      state.hovered = null;
    }

    // Remove the old selected boundary styling.
    // styleOf() now sees state.selected === null.
    if (previousSelected?.layer) {
      previousSelected.layer.setStyle(
        styleOf(previousSelected)
      );
    }

    // Remove the selected/focused appearance
    // from all existing program bubbles.
    refreshMarkerStyles();

    // Restore the Location Details panel to:
    // "Select a County".
    renderDetails();
  }

  function selectArea(
    area,
    program = null,
    zoom = false
  ) {
    const previous = state.selected;

    state.selected = area;
    state.focus = program;

    state.detailPrograms =
      new Set(state.mapPrograms);

    hoverArea(null);

    if (
      previous &&
      previous !== area
    ) {
      previous.layer.setStyle(
        styleOf(previous)
      );
    }

    area.layer.setStyle(
      styleOf(area)
    );

    area.layer.bringToFront();

    refreshMarkerStyles();
    renderDetails();

    if (zoom) {
      zoomToArea(area);
    }
  }

  // ============================================================
  // BUBBLE SIZE AND COUNTY/CITY CANDIDATE ANCHORS
  // ============================================================

  function radiusFor(count) {
    const fraction =
      Math.log1p(count) /
      Math.log1p(state.maxCount);

    const scale = Math.max(
      0.78,
      Math.min(
        1.18,
        Math.pow(
          1.065,
          state.map.getZoom() - CONFIG.zoom
        )
      )
    );

    return Math.max(
      3,
      Math.min(
        9.6,
        (
          3.8 +
          4.4 * Math.sqrt(fraction)
        ) * scale
      )
    );
  }

  function anchors(area) {
    if (area.candidates) {
      return area.candidates;
    }

    const sw =
      area.bounds.getSouthWest();

    const ne =
      area.bounds.getNorthEast();

    const out = [area.anchor];

    for (let iy = 0; iy < 4; iy++) {
      for (let ix = 0; ix < 4; ix++) {
        const lng =
          sw.lng +
          (ix + 0.5) *
          (ne.lng - sw.lng) / 4;

        const lat =
          sw.lat +
          (iy + 0.5) *
          (ne.lat - sw.lat) / 4;

        if (
          turf.booleanPointInPolygon(
            turf.point([lng, lat]),
            area.feature
          )
        ) {
          out.push(
            L.latLng(lat, lng)
          );
        }
      }
    }

    out.sort(
      (a, b) =>
        a.distanceTo(area.anchor) -
        b.distanceTo(area.anchor)
    );

    area.candidates = out;
    return out;
  }

  // ============================================================
  // SCREEN GEOMETRY CACHED PER ZOOM
  // ============================================================

  function boxFor(ring) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;

    for (const point of ring) {
      x0 = Math.min(x0, point.x);
      x1 = Math.max(x1, point.x);
      y0 = Math.min(y0, point.y);
      y1 = Math.max(y1, point.y);
    }

    return {
      x0,
      x1,
      y0,
      y1
    };
  }

  function projectedShape(area) {
    const zoom =
      state.map.getZoom();

    if (
      area.geometryZoom === zoom &&
      area.geometry
    ) {
      return area.geometry;
    }

    const geometry =
      area.feature.geometry;

    const polygons =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.type === "MultiPolygon"
          ? geometry.coordinates
          : [];

    // Simplification affects placement checks only.
    // The visible County boundary remains unchanged.

    const shape = polygons.map(
      polygon =>
        polygon.map(
          ring => {
            const points = ring.map(
              ([lng, lat]) =>
                state.map.project([
                  lat,
                  lng
                ])
            );

            const reduced =
              points.length > 35
                ? L.LineUtil.simplify(
                    points,
                    0.65
                  )
                : points;

            return {
              points: reduced,
              box: boxFor(reduced)
            };
          }
        )
    );

    area.geometryZoom = zoom;
    area.geometry = shape;

    return shape;
  }

  function inRing(point, ring) {
    const box = ring.box;

    if (
      point.x < box.x0 ||
      point.x > box.x1 ||
      point.y < box.y0 ||
      point.y > box.y1
    ) {
      return false;
    }

    const points = ring.points;
    let inside = false;

    for (
      let i = 0,
      j = points.length - 1;
      i < points.length;
      j = i++
    ) {
      const a = points[i];
      const b = points[j];

      if (
        (a.y > point.y) !==
        (b.y > point.y) &&
        point.x <
          (b.x - a.x) *
          (point.y - a.y) /
          (b.y - a.y) + a.x
      ) {
        inside = !inside;
      }
    }

    return inside;
  }

  function inside(point, shape) {
    return shape.some(
      polygon =>
        polygon.length &&
        inRing(
          point,
          polygon[0]
        ) &&
        !polygon.slice(1).some(
          hole => inRing(point, hole)
        )
    );
  }

  function circleFits(
    point,
    radius,
    shape
  ) {
    if (!inside(point, shape)) {
      return false;
    }

    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;

      const test = L.point(
        point.x +
        (radius + 1.3) *
        Math.cos(angle),

        point.y +
        (radius + 1.3) *
        Math.sin(angle)
      );

      if (!inside(test, shape)) {
        return false;
      }
    }

    return true;
  }

  // ============================================================
  // COMPACT BUBBLE ARRANGEMENT
  // ============================================================

  function pattern(items, rotation) {
    const n = items.length;

    const radius = Math.max(
      ...items.map(item => item.radius)
    );

    const d = radius + 2.6;

    let offsets;

    if (n === 1) {
      offsets = [[0, 0]];
    } else if (n === 2) {
      offsets = [
        [-d, 0],
        [d, 0]
      ];
    } else if (n === 3) {
      offsets = [
        [0, -d],
        [-d, d],
        [d, d]
      ];
    } else if (n === 4) {
      offsets = [
        [-d, -d],
        [d, -d],
        [d, d],
        [-d, d]
      ];
    } else if (n === 6) {
      const center = items.find(
        item => item.program.id === "Placements"
      );

      const outside = items.filter(
        item => item !== center
      );

      const maxOutsideRadius = Math.max(
        ...outside.map(item => item.radius)
      );

      const ringRadius = Math.max(
        maxOutsideRadius + (center?.radius || 0) + 3,
        (2 * maxOutsideRadius + 3) /
          (2 * Math.sin(Math.PI / outside.length))
      );

      const positions = new Map();

      if (center) {
        positions.set("Placements", [0, 0]);
      }

      outside.forEach((item, index) => {
        const angle =
          -Math.PI / 2 +
          (2 * Math.PI * index) / outside.length;

        positions.set(item.program.id, [
          ringRadius * Math.cos(angle),
          ringRadius * Math.sin(angle)
        ]);
      });

      offsets = items.map(
        item => positions.get(item.program.id) || [0, 0]
      );

    } else {
      const center = items.find(
        item =>
          item.program.id === "Placements"
      );

      const spacing =
        radius +
        (center?.radius || radius) +
        2.5;

      const fixed = {
        VAPSP: [0, -spacing],
        VAAPI: [spacing, 0],
        VAICC: [0, spacing],
        CTA: [-spacing, 0],
        Placements: [0, 0],
        "Teaching Fellows": [-spacing * 1.4, -spacing * 1.4]
      };

      offsets = items.map(
        item =>
          fixed[item.program.id]
      );
    }

    const c = Math.cos(rotation);
    const s = Math.sin(rotation);

    return items.map(
      (item, i) => ({
        ...item,

        dx:
          offsets[i][0] * c -
          offsets[i][1] * s,

        dy:
          offsets[i][0] * s +
          offsets[i][1] * c
      })
    );
  }

  function overlaps(
    point,
    radius,
    placed
  ) {
    return placed.some(
      other =>
        Math.hypot(
          point.x - other.point.x,
          point.y - other.point.y
        ) <
        radius +
        other.radius +
        2
    );
  }

  function compactGroup(
    area,
    items,
    placed
  ) {
    const shape = projectedShape(area);

    const home =
      state.map.project(area.anchor);

    let winner = null;
    let high = -Infinity;

    for (
      const anchor of
      anchors(area).slice(0, 10)
    ) {
      const origin =
        state.map.project(anchor);

      for (
        const angle of [
          0,
          Math.PI / 4
        ]
      ) {
        const group =
          pattern(items, angle).map(
            item => ({
              ...item,

              point: L.point(
                origin.x + item.dx,
                origin.y + item.dy
              )
            })
          );

        if (
          !group.every(
            item =>
              circleFits(
                item.point,
                item.radius,
                shape
              )
          )
        ) {
          continue;
        }

        if (
          group.some(
            item =>
              overlaps(
                item.point,
                item.radius,
                placed
              )
          )
        ) {
          continue;
        }

        if (
          group.some(
            (item, i) =>
              overlaps(
                item.point,
                item.radius,
                group.slice(0, i)
              )
          )
        ) {
          continue;
        }

        const gap = placed.length
          ? Math.min(
              60,
              ...group.flatMap(
                item =>
                  placed.map(
                    other =>
                      Math.hypot(
                        item.point.x - other.point.x,
                        item.point.y - other.point.y
                      ) -
                      item.radius -
                      other.radius
                  )
              )
            )
          : 60;

        const distance =
          Math.hypot(
            origin.x - home.x,
            origin.y - home.y
          );

        const score =
          gap * 0.6 -
          distance * 0.2;

        if (score > high) {
          high = score;
          winner = group;
        }
      }
    }

    return winner;
  }

  function summaryPosition(
    area,
    placed,
    radius
  ) {
    if (area.isCity) {
      return state.map.project(area.anchor);
    }

    const home =
      state.map.project(area.anchor);

    let best = home;
    let high = -Infinity;

    for (
      const anchor of
      anchors(area).slice(0, 12)
    ) {
      const point =
        state.map.project(anchor);

      const clearance = placed.length
        ? Math.min(
            ...placed.map(
              other =>
                Math.hypot(
                  point.x - other.point.x,
                  point.y - other.point.y
                ) -
                other.radius -
                radius
            )
          )
        : 80;

      const score =
        Math.min(75, clearance) -
        Math.hypot(
          point.x - home.x,
          point.y - home.y
        ) * 0.12;

      if (score > high) {
        high = score;
        best = point;
      }
    }

    return best;
  }

  function layout() {
    const occupied = [];
    const markers = [];

    const areas = state.areas
      .filter(countyMatches)
      .map(
      area => {
        const values =
          state.counts.get(area.id) || {};

        const visible = PROGRAMS.filter(
          p =>
            state.mapPrograms.has(p.id) &&
            values[p.id] > 0
        );

        return {
          area,
          values,
          visible
        };
      }
    ).filter(
      item => item.visible.length
    );

    areas.sort(
      (a, b) =>
        Number(b.area.isCity) -
        Number(a.area.isCity) ||
        a.area.id.localeCompare(
          b.area.id
        )
    );

    let summaryCount = 0;

    for (
      const {
        area,
        values,
        visible
      } of areas
    ) {
      const items = visible.map(
        program => ({
          program,
          count: values[program.id],
          radius: radiusFor(
            values[program.id]
          )
        })
      );

      const useBadge =
        area.isCity &&
        state.map.getZoom() <
        CONFIG.cityBadgeBelow;

      const group = useBadge
        ? null
        : compactGroup(
            area,
            items,
            occupied
          );

      if (group) {
        for (const item of group) {
          occupied.push({
            point: item.point,
            radius: item.radius
          });

          markers.push({
            type: "program",
            area,

            program: item.program,
            count: item.count,
            radius: item.radius,

            latlng:
              state.map.unproject(
                item.point
              )
          });
        }
      } else {
        const radius =
          area.isCity ? 8 : 7;

        const point = summaryPosition(
          area,
          occupied,
          radius
        );

        occupied.push({
          point,
          radius
        });

        markers.push({
          type: "summary",
          area,
          visible,
          radius,

          latlng:
            state.map.unproject(point)
        });

        summaryCount++;
      }
    }

    return {
      markers,
      summaryCount
    };
  }

  // ============================================================
  // BUBBLE TOOLTIPS
  // ============================================================

  function programTooltip(item) {
    return `
      <div class="overall-tooltip-content">

        <div class="overall-tooltip-field">
          <div class="overall-tooltip-label">
            PROGRAM
          </div>

          <div
            class="overall-tooltip-value overall-tooltip-program"
            style="color:${item.program.color}"
          >
            ${safe(item.program.id)}
          </div>
        </div>

        <div class="overall-tooltip-divider"></div>

        <div class="overall-tooltip-field">
          <div class="overall-tooltip-label">
            ADMINISTRATIVE AREA
          </div>

          <div class="overall-tooltip-value">
            ${safe(item.area.name)}
          </div>
        </div>

        <div class="overall-tooltip-divider"></div>

        <div class="overall-tooltip-field">
          <div class="overall-tooltip-label">
            REPORTED PARTICIPANTS
          </div>

          <div class="overall-tooltip-value overall-tooltip-count">
            ${fmt(item.count)}
          </div>
        </div>

      </div>
    `;
  }

  function summaryTooltip(item) {
    const programs = item.visible.map(
      p =>
        `<span style="color:${p.color}">${safe(p.id)}</span>`
    ).join(", ");

    return `
      <div class="overall-tooltip-content">

        <div class="overall-tooltip-field">
          <div class="overall-tooltip-label">
            PROGRAMS WITH DATA
          </div>

          <div class="overall-tooltip-value overall-tooltip-summary-programs">
            ${programs}
          </div>
        </div>

        <div class="overall-tooltip-divider"></div>

        <div class="overall-tooltip-field">
          <div class="overall-tooltip-label">
            ADMINISTRATIVE AREA
          </div>

          <div class="overall-tooltip-value">
            ${safe(item.area.name)}
          </div>
        </div>

      </div>
    `;
  }

  function badgeIcon(
    item,
    active,
    selectedProgram
  ) {
    const diameter = item.radius * 2;
    const n = item.visible.length;

    const bands = item.visible.map(
      (p, i) =>
        `${p.color} ${
          (100 * i / n).toFixed(2)
        }% ${
          (100 * (i + 1) / n).toFixed(2)
        }%`
    ).join(",");

    const center =
      selectedProgram?.color ||
      "#ffffff";

    const html = `
      <span style="
        display:block;
        position:relative;
        width:${diameter}px;
        height:${diameter}px;
        border-radius:50%;
        background:conic-gradient(${bands});
        border:${active ? 2 : 1.4}px solid ${
          active ? "#450084" : "#ffffff"
        };
        box-shadow:0 1px 4px rgba(35,20,54,.24);
      ">

        <span style="
          position:absolute;
          inset:35%;
          background:${center};
          border-radius:50%;
        "></span>

      </span>
    `;

    return L.divIcon({
      html,
      className: "",

      iconSize: [
        diameter,
        diameter
      ],

      iconAnchor: [
        item.radius,
        item.radius
      ]
    });
  }

  // ============================================================
  // BUBBLE HOVER AND CLICK
  // ============================================================

  function wireBubble(layer, item) {
    layer.on("mouseover", () => {
      state.bubbleHover = true;

      hoverArea(item.area);
      hideAreaTooltip();
    });

    layer.on("mouseout", event => {
      state.bubbleHover = false;

      hoverArea(
        areaAt(
          event.latlng.lat,
          event.latlng.lng
        ),
        event.latlng
      );
    });

    layer.on("click", event => {
      if (event.originalEvent) {
        L.DomEvent.stopPropagation(
          event.originalEvent
        );
      }

      selectArea(
        item.area,

        item.type === "program"
          ? item.program.id
          : null,

        true
      );
    });
  }

  // ============================================================
  // MAP RENDERING
  // ============================================================

  function scheduleLayout() {
    if (state.renderFrame) return;

    state.renderFrame =
      requestAnimationFrame(() => {
        state.renderFrame = 0;
        renderLayout();
      });
  }

  function renderLayout() {
    if (
      !state.loaded ||
      !state.map
    ) {
      return;
    }

    const key =
      state.map.getZoom() +
      "|" +
      [...state.mapPrograms]
        .sort()
        .join(",");

    if (key === state.layoutKey) {
      return;
    }

    const result = layout();

    state.layoutKey = key;
    state.summaryCount = result.summaryCount;
    state.bubbleHover = false;

    state.bubbleLayer.clearLayers();
    state.markerHandles = [];

    for (const item of result.markers) {
      let layer;

      if (item.type === "program") {
        layer = L.circleMarker(
          item.latlng,
          {
            renderer: state.bubbleRenderer,
            radius: item.radius,

            color: "#ffffff",
            weight: 1.5,
            opacity: 0.92,

            fillColor: item.program.color,
            fillOpacity: 0.56,

            interactive: true,
            bubblingMouseEvents: false
          }
        );

        layer.bindTooltip(
          programTooltip(item),
          {
            direction: "top",
            offset: [0, -7],
            opacity: 1,
            className: "overall-program-tooltip"
          }
        );
      } else {
        layer = L.marker(
          item.latlng,
          {
            pane: "overallBubblePane",
            bubblingMouseEvents: false,

            icon: badgeIcon(
              item,
              false,
              null
            )
          }
        );

        layer.bindTooltip(
          summaryTooltip(item),
          {
            direction: "top",
            offset: [0, -7],
            opacity: 1,
            className: "overall-program-tooltip"
          }
        );
      }

      wireBubble(layer, item);

      layer.addTo(
        state.bubbleLayer
      );

      state.markerHandles.push({
        layer,
        item,
        visual: null
      });
    }

    refreshMarkerStyles();
    updateReachSummary();
  }

  function refreshMarkerStyles() {
    for (
      const handle of
      state.markerHandles
    ) {
      const {
        item,
        layer
      } = handle;

      const active =
        state.selected === item.area;

      const focused =
        active &&
        state.focus === item.program?.id;

      const visual =
        `${active}|${focused}|${
          active
            ? state.focus
            : ""
        }`;

      if (handle.visual === visual) {
        continue;
      }

      handle.visual = visual;

      if (item.type === "program") {
        layer.setStyle({
          color: focused
            ? "#450084"
            : "#ffffff",

          weight: focused
            ? 2.5
            : 1.5,

          opacity: focused
            ? 1
            : 0.92,

          fillOpacity: focused
            ? 0.70
            : 0.56
        });
      } else {
        const chosen = active
          ? item.visible.find(
              p => p.id === state.focus
            )
          : null;

        layer.setIcon(
          badgeIcon(
            item,
            active,
            chosen
          )
        );
      }
    }
  }

  // ============================================================
  // MATCH RIGHT-SIDE TEXT TO LEFT-SIDE REACH SUMMARY
  // ============================================================

  function syncReachTypography() {
    const left = el("overallMapSummary");
    const right = el("overallCombinedMarkerCount");

    if (!left || !right) {
      return;
    }

    const style = window.getComputedStyle(left);

    right.style.fontFamily = style.fontFamily;
    right.style.fontSize = style.fontSize;
    right.style.fontWeight = style.fontWeight;
    right.style.fontStyle = style.fontStyle;
    right.style.lineHeight = style.lineHeight;
    right.style.letterSpacing = style.letterSpacing;
    right.style.color = style.color;

    right.style.whiteSpace = "nowrap";
  }

  // ============================================================
  // COMBINED MARKER INDICATOR NEXT TO COUNTY VIEW
  // ============================================================

  function ensureCombinedMarkerIndicator() {
    let indicator =
      el("overallCombinedMarkerIndicator");

    if (indicator) {
      syncReachTypography();
      return indicator;
    }

    const heading =
      el("overallMapSummary")
        ?.closest(".overall-panel-heading");

    const countyBadge =
      heading?.querySelector(
        ".overall-map-status"
      );

    if (!heading || !countyBadge) {
      return null;
    }

    heading.style.flexWrap = "wrap";

    const rightGroup =
      document.createElement("div");

    rightGroup.className =
      "overall-map-heading-right";

    rightGroup.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 12px;
      margin-left: auto;
    `;

    countyBadge.parentNode.insertBefore(
      rightGroup,
      countyBadge
    );

    rightGroup.appendChild(countyBadge);

    indicator =
      document.createElement("div");

    indicator.id =
      "overallCombinedMarkerIndicator";

    indicator.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      max-width: none;
      text-align: right;
      flex-shrink: 0;
    `;

    const countText =
      document.createElement("span");

    countText.id =
      "overallCombinedMarkerCount";

    countText.style.whiteSpace = "nowrap";

    const explanation =
      document.createElement("span");

    explanation.textContent =
      "Zoom in for individual bubbles";

    explanation.style.cssText = `
      color: #718096;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 400;
      line-height: 1.4;
      white-space: nowrap;
    `;

    indicator.append(
      countText,
      explanation
    );

    indicator.title =
      "At the current zoom level, some counties " +
      "or independent cities use one multicolor marker " +
      "instead of separate program bubbles.";

    rightGroup.insertBefore(
      indicator,
      countyBadge
    );

    syncReachTypography();

    window.addEventListener(
      "resize",
      syncReachTypography,
      { passive: true }
    );

    return indicator;
  }

  // ============================================================
  // REACH SUMMARY
  // ============================================================

  function updateReachSummary() {
    const summary =
      el("overallMapSummary");

    if (!summary) {
      return;
    }

    const reached =
      reachedAreas().length;

    summary.textContent =
      `${reached} Virginia counties or independent cities ` +
      `reached by selected programs`;

    const indicator =
      ensureCombinedMarkerIndicator();

    if (!indicator) {
      return;
    }

    const combinedCount =
      state.summaryCount;

    if (combinedCount === 0) {
      indicator.style.display = "none";
      return;
    }

    indicator.style.display = "flex";

    const countText =
      el("overallCombinedMarkerCount");

    if (countText) {
      countText.textContent =
        `${combinedCount} ${
          combinedCount === 1
            ? "area"
            : "areas"
        } shown with combined program markers`;
    }

    syncReachTypography();
  }

  // ============================================================
  // PROGRAM DETAILS NAVIGATION
  // ============================================================

  function detailURL(program) {
    const params = new URLSearchParams();

    const selection =
      window.MultiYearData?.getSelection?.();

    if (selection?.allHistorical) {
      params.set("years", "all");
    } else if (
      Array.isArray(selection?.years) &&
      selection.years.length > 1
    ) {
      params.set(
        "years",
        selection.years.join(",")
      );
    } else if (
      Array.isArray(selection?.years) &&
      selection.years.length === 1
    ) {
      params.set(
        "year",
        selection.years[0]
      );
    } else {
      const year = getYear();

      if (year) {
        params.set("year", year);
      }
    }

    params.set(
      "county_fips",
      state.selected?.id || ""
    );

    return `${program.page}?${params.toString()}`;
  }

  function focusProgram(id) {
    state.focus = id;

    refreshMarkerStyles();
    renderDetails();

    if (state.selected) {
      zoomToArea(
        state.selected,
        "detail"
      );
    }

    el("overallDetailBody")
      ?.querySelector(
        `[data-select-program="${id}"]`
      )
      ?.focus({
        preventScroll: true
      });
  }

  // ============================================================
  // RIGHT DETAIL PANEL
  // ============================================================

  function renderDetails() {
    const title =
      el("overallDetailTitle");

    const body =
      el("overallDetailBody");

    if (!title || !body) {
      return;
    }

    const area =
      state.selected;

    if (!area) {
      title.textContent =
        "Select a County";

      body.innerHTML = `
        <div class="overall-detail-empty">

          <div class="overall-detail-empty-icon">
            ◎
          </div>

          <h3>
            Explore program participation
          </h3>

          <p>
            Select a county, independent city,
            or program bubble to view its counts.
          </p>

        </div>
      `;

      return;
    }

    title.textContent =
      area.name;

    const counts =
      state.counts.get(area.id) || {};

    const max = Math.max(
      1,
      ...PROGRAMS.map(
        p => counts[p.id] || 0
      )
    );

    // ========================================================
    // DETAIL FILTERS
    // ========================================================

    const filters = PROGRAMS.map(
      p => `
        <label class="overall-detail-filter-choice">

          <input
            type="checkbox"
            data-detail-program="${p.id}"
            ${
              state.detailPrograms.has(p.id)
                ? "checked"
                : ""
            }
          >

          <span
            class="overall-detail-filter-dot"
            style="background:${p.color}"
          ></span>

          ${safe(p.id)}

        </label>
      `
    ).join("");

    // ========================================================
    // PROGRAM DISTRIBUTION BARS
    //
    // View details opens the destination in a NEW TAB.
    // target="_blank" and rel="noopener noreferrer"
    // are applied to every published program link.
    // ========================================================

    const bars = PROGRAMS.filter(
      p =>
        state.detailPrograms.has(p.id)
    ).map(p => {
      const record =
        counts[p.id];

      const count =
        record ?? 0;

      const has =
        count > 0;

      const focused =
        state.focus === p.id;

      const empty =
        record === undefined
          ? "No record"
          : "No participants";

      // ======================================================
      // UPDATED: OPEN PROGRAM DETAILS IN A NEW TAB
      // ======================================================

      const link = p.published
        ? `
          <a
            class="overall-detail-drill-link"
            href="${safe(detailURL(p))}"
            target="_blank"
            rel="noopener noreferrer"
            title="Open ${safe(p.id)} detailed dashboard in a new tab"
            aria-label="View ${safe(p.id)} details in a new tab"
          >
            View details
          </a>
        `
        : `
          <span
            class="overall-detail-drill-link is-upcoming"
            title="${safe(p.id)} detailed dashboard coming soon"
          >
            Coming soon
          </span>
        `;

      return `
        <div
          class="overall-detail-bar-row${
            focused ? " is-focused" : ""
          }${
            has ? "" : " is-empty"
          }"

          style="--program-color:${p.color}"
        >

          <button
            type="button"
            class="overall-detail-bar-main"
            data-select-program="${p.id}"
            aria-pressed="${focused}"
            aria-label="Highlight ${safe(p.id)} and focus map"
          >

            <span class="overall-detail-bar-heading">

              <span class="overall-detail-bar-name">
                <i class="overall-detail-bar-dot"></i>
                ${safe(p.id)}
              </span>

              ${
                has
                  ? `
                    <strong class="overall-detail-bar-count">
                      ${fmt(count)}
                    </strong>
                  `
                  : `
                    <span class="overall-detail-no-participants">
                      ${empty}
                    </span>
                  `
              }

            </span>

            ${
              has
                ? `
                  <span class="overall-detail-bar-track">

                    <span
                      class="overall-detail-bar-fill"
                      style="width:${
                        (100 * count / max).toFixed(2)
                      }%"
                    ></span>

                  </span>
                `
                : ""
            }

          </button>

          ${link}

        </div>
      `;
    }).join("") || `
      <p class="overall-detail-no-selection">
        No programs selected in Detail Filters.
      </p>
    `;

    // ========================================================
    // RENDER DETAIL CONTENT
    // ========================================================

    body.innerHTML = `
      <div class="overall-detail-content">

        ${
          area.isCity
            ? `
              <p class="overall-detail-included">
                Independent city · reported separately
                from surrounding counties.
              </p>
            `
            : ""
        }

        <div class="overall-detail-filter-header">

          <span>
            DETAIL FILTERS
          </span>

          <button
            type="button"
            id="overallDetailMatchMap"
          >
            Match Map
          </button>

        </div>

        <div class="overall-detail-filter-list">
          ${filters}
        </div>

        <p class="overall-detail-filter-help">
          Initially matches the main filters.
          Changes here affect this panel only.
        </p>

        <div class="overall-detail-chart-heading">

          <h3>
            Program Distribution
          </h3>

          <p>
            Reported counts by program in
            ${safe(area.name)}.
          </p>

        </div>

        <div class="overall-detail-chart">
          ${bars}
        </div>

        <p class="overall-detail-scale-note">
          Select a program row to highlight it
          and focus the map on its county or city.
        </p>

      

      </div>
    `;

    // Detail Filter changes

    body.querySelectorAll(
      "[data-detail-program]"
    ).forEach(input => {
      input.addEventListener(
        "change",
        () => {
          if (input.checked) {
            state.detailPrograms.add(
              input.dataset.detailProgram
            );
          } else {
            state.detailPrograms.delete(
              input.dataset.detailProgram
            );
          }

          renderDetails();
        }
      );
    });

    // Click Program row to highlight and focus map.

    body.querySelectorAll(
      "[data-select-program]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        () => {
          focusProgram(
            button.dataset.selectProgram
          );
        }
      );
    });

    // Restore Detail Filters to match main map filters.

    el("overallDetailMatchMap")
      ?.addEventListener(
        "click",
        () => {
          state.detailPrograms =
            new Set(state.mapPrograms);

          renderDetails();
        }
      );
  }

  // ============================================================
  // TOP PROGRAM FILTERS AND MAP AUTO-FOCUS
  // ============================================================

  function refreshFilters(cameraMode) {
    state.layoutKey = "";

    scheduleLayout();

    const node =
      el("overallFilterSummary");

    if (node) {
      node.textContent =
        `${state.mapPrograms.size} of ${document.querySelectorAll("input[data-overall-program]").length} programs selected`;
    }

    renderDetails();

    window.OverallReachUI?.renderMetrics?.();

    if (cameraMode === "reset") {
      resetMapView();
    } else {
      focusMapOnPrograms();
    }
  }

  function initFilters() {
    const boxes = [
      ...document.querySelectorAll(
        "[data-overall-program]"
      )
    ];

    function apply(
      next,
      cameraMode = "focus"
    ) {
      state.mapPrograms = next;

      boxes.forEach(box => {
        box.checked =
          next.has(
            box.dataset.overallProgram
          );
      });

      if (!next.has(state.focus)) {
        state.focus = null;
      }

      state.detailPrograms =
        new Set(next);

      // Select All and Clear use cameraMode="reset".
      // Reset the selected county/city at the same time.
      if (cameraMode === "reset") {
        clearMapSelection();
      }

      refreshFilters(cameraMode);
    }

    // Individual Program checkbox changes.

    boxes.forEach(box => {
      box.addEventListener(
        "change",
        () => {
          const next =
            new Set(state.mapPrograms);

          if (box.checked) {
            next.add(
              box.dataset.overallProgram
            );
          } else {
            next.delete(
              box.dataset.overallProgram
            );
          }

          apply(next, "focus");
        }
      );
    });

    // Select All: show all five programs and reset the map.

    el("overallSelectAll")
      ?.addEventListener(
        "click",
        () => {
          apply(
            new Set(
              PROGRAMS.map(p => p.id)
            ),
            "reset"
          );
        }
      );

    // Clear All: hide all bubbles and reset the map.

    el("overallClearAll")
      ?.addEventListener(
        "click",
        () => {
          apply(
            new Set(),
            "reset"
          );
        }
      );
  }

  // ============================================================
  // OVERALL COUNTY FILTER + KPI PUBLIC API
  // ============================================================

  // ============================================================
  // TEACHING FELLOWS SUBPROGRAM FILTER
  // ============================================================

  function applyTeachingFellowsChoice(choice) {
    // TF_DYNAMIC_COLOR_V1
    const activeTFColor =
      choice === "Teaching Fellows - Paraprofessionals"
        ? "#147F77"
        : choice === "Teaching Fellows - On-Campus"
          ? "#319A90"
          : "#168F83";

    const tfProgram = PROGRAMS.find(
      program => program.id === "Teaching Fellows"
    );

    if (tfProgram) {
      tfProgram.color = activeTFColor;
    }

    // Color of the main subfilter's selected text.
    const mainTFSelect = document.getElementById(
      "overallTeachingFellowsSubprogram"
    );

    if (mainTFSelect) {
      mainTFSelect.style.setProperty(
        "color",
        activeTFColor,
        "important"
      );

      mainTFSelect.style.setProperty(
        "font-weight",
        "400",
        "important"
      );
    }

    // Color dot in the main Program Filter.
    const mainTFDot = document.querySelector(
      ".overall-teaching-fellows-control .overall-color-dot"
    );

    if (mainTFDot) {
      mainTFDot.style.setProperty(
        "--dot",
        activeTFColor
      );
    }

    const paraName =
      "Teaching Fellows - Paraprofessionals";

    const campusName =
      "Teaching Fellows - On-Campus";

    for (const values of state.counts.values()) {
      const para = Number(values[paraName]) || 0;
      const campus = Number(values[campusName]) || 0;

      if (
        para > 0 ||
        campus > 0 ||
        Object.prototype.hasOwnProperty.call(
          values, "Teaching Fellows"
        )
      ) {
        if (choice === paraName) {
          values["Teaching Fellows"] = para;
        } else if (choice === campusName) {
          values["Teaching Fellows"] = campus;
        } else {
          values["Teaching Fellows"] = para + campus;
        }
      }
    }

    state.maxCount = Math.max(
      1,
      ...[...state.counts.values()].flatMap(
        values => PROGRAMS.map(
          program => Number(values[program.id]) || 0
        )
      )
    );
  }

  window.OverallReach = {

    setTeachingFellowsSubprogram(choice) {
      applyTeachingFellowsChoice(choice);
    },

    // Use the exact same navigation logic as
    // the existing Location Details panel.
    getProgramDetailURL(programId) {
      const program = PROGRAMS.find(
        p => p.id === programId
      );

      return program ? detailURL(program) : "";
    },


    isReady() {
      return state.loaded;
    },

    getAreas() {
      return state.areas
        .map(area => ({
          id: area.id,
          name: area.name,
          isCity: area.isCity
        }))
        .sort((a, b) =>
          a.name.localeCompare(b.name)
        );
    },

    getMatchingAreaCount() {
      return reachedAreas().length;
    },

    getProgramMetrics() {
      const eligibleAreas =
        state.areas.filter(countyMatches);

      return PROGRAMS
        .filter(program =>
          state.mapPrograms.has(program.id)
        )
        .map(program => {
          let participants = 0;
          let areas = 0;

          for (const area of eligibleAreas) {
            const values =
              state.counts.get(area.id) || {};

            const count =
              Number(values[program.id]) || 0;

            if (count > 0) {
              participants += count;
              areas++;
            }
          }

          return {
            id: program.id,
            color: program.color,
            participants,
            areas
          };
        });
    },

    setCountyFilter({
      ids = [],
      search = ""
    } = {}) {
      const validIds = new Set(
        state.areas.map(area => area.id)
      );

      state.countyFilter = new Set(
        (Array.isArray(ids) ? ids : [])
          .map(String)
          .filter(id => validIds.has(id))
      );

      state.countySearch = String(
        search ?? ""
      )
        .trim()
        .toLocaleLowerCase();

      // An empty county filter with no search means
      // "All Locations", including the Reset action.
      const countyReset =
        state.countyFilter.size === 0 &&
        state.countySearch === "";

      const selectedAreaExcluded =
        state.selected &&
        !countyMatches(state.selected);

      if (
        countyReset ||
        selectedAreaExcluded
      ) {
        clearMapSelection();
      } else if (state.map) {
        hoverArea(null);
      }

      for (const area of state.areas) {
        area.layer.setStyle(
          styleOf(area)
        );
      }

      state.layoutKey = "";

      if (state.loaded) {
        renderDetails();
        scheduleLayout();

        const active =
          state.countyFilter.size > 0 ||
          Boolean(state.countySearch);

        const matching =
          state.areas.filter(
            countyMatches
          );

        if (
          active &&
          matching.length === 1
        ) {
          zoomToArea(
            matching[0],
            "detail"
          );

        } else if (
          active &&
          matching.length > 1
        ) {
          const bounds = L.latLngBounds(
            matching.map(area => area.anchor)
          );

          state.map.fitBounds(
            bounds,
            {
              padding: [55, 55],
              maxZoom: CONFIG.countyZoom,
              animate: true
            }
          );

        } else if (!active) {
          resetMapView();
        }
      }
    }
  };

  // ============================================================
  // STARTUP
  // ============================================================

  async function start() {
    state.year = getYear();

    initFilters();

    try {
      notice("Initializing map...");

      initMap();

      notice(
        "Loading Virginia counties and program data..."
      );

      const [
        response,
        zipText,
        overallText
      ] = await Promise.all([
        fetch(CONFIG.countyURL),

        getText(CONFIG.zipURL),

        loadSelectedOverallText()
      ]);

      if (!response.ok) {
        throw new Error(
          `County boundaries: HTTP ${response.status}`
        );
      }

      const countyData =
        await response.json();

      if (!countyData.features?.length) {
        throw new Error(
          "No Virginia County geometry returned."
        );
      }

      loadAreas(countyData);
      loadCounts(zipText, overallText);

      state.loaded = true;

      renderLayout();
      renderDetails();

      notice("");

      window.dispatchEvent(
        new Event("overall-reach-ready")
      );

      requestAnimationFrame(() => {
        state.map.invalidateSize();
      });

    } catch (error) {
      console.error(
        "[Overall Program Reach]",
        error
      );

      notice(
        `Map could not be loaded: ${error.message}`,
        true
      );

      const summary =
        el("overallMapSummary");

      if (summary) {
        summary.textContent =
          "Map data could not be loaded";
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      { once: true }
    );
  } else {
    start();
  }

})();
