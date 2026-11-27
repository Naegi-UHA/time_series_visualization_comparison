(function () {
    const datasetList = document.getElementById("dataset-list");
    const visualization = document.getElementById("time-series-visualization");
    const comparisonStatus = document.getElementById("comparison-status");
    const datasetTitle = document.getElementById("time-series-visualization-dataset-name");
    const seriesDimensionTitle = document.getElementById("time-series-visualization-series-dimension");
    const classSelector = document.getElementById("class-selector-control");
    const seriesSelector = document.getElementById("time-series-selector-control");
    const dimensionSelector = document.getElementById("dimension-selector-control");
    const classSummary = document.getElementById("class-selector-summary");
    const seriesSummary = document.getElementById("time-series-selector-summary");
    const dimensionSummary = document.getElementById("dimension-selector-summary");
    const classOptions = document.getElementById("class-selector-options");
    const seriesOptions = document.getElementById("time-series-selector-options");
    const dimensionOptions = document.getElementById("dimension-selector-options");
    const chart = document.getElementById("time-series-chart");
    const normalizationToggle = document.getElementById("z-normalization-toggle");
    const quitButton = document.getElementById("quit-time-series-visualization");
    const svgNamespace = "http://www.w3.org/2000/svg";
    let activeDataset = null;
    let selectedClass = "";
    let seriesIndex = 0;
    let dimensionIndex = 0;
    let showZNormalization = true;

    function classForSeries(item) {
        return String(item.label ?? "");
    }

    function classLabel(label) {
        return label ? `Class ${label}` : "Unlabeled";
    }

    function renderSeriesOptions() {
        seriesOptions.replaceChildren();
        activeDataset.series.forEach((item, index) => {
            if (classForSeries(item) !== selectedClass) {
                return;
            }
            const option = document.createElement("button");
            option.type = "button";
            option.dataset.seriesIndex = String(index);
            option.setAttribute("aria-pressed", String(index === seriesIndex));
            option.textContent =
                `Series ${index + 1}${selectedClass ? ` (class ${selectedClass})` : ""}`;
            seriesOptions.append(option);
        });

        seriesSummary.textContent =
            `Series ${seriesIndex + 1}${selectedClass ? ` (class ${selectedClass})` : ""}`;
    }

    function selectClass(label) {
        selectedClass = label;
        seriesIndex = activeDataset.series.findIndex(
            (item) => classForSeries(item) === selectedClass
        );
        classSummary.textContent = classLabel(selectedClass);
        classOptions.querySelectorAll("button").forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.classLabel === selectedClass));
        });
        classSelector.open = false;
        seriesSelector.open = false;
        renderSeriesOptions();
        drawSeries();
    }

    function svgElement(name, attributes, text) {
        const element = document.createElementNS(svgNamespace, name);
        Object.entries(attributes).forEach(([attribute, value]) => {
            element.setAttribute(attribute, value);
        });
        if (text !== undefined) {
            element.textContent = text;
        }
        return element;
    }

    function dimensionsForSeries(series) {
        if (!Array.isArray(series) || !series.length) {
            throw new Error("The selected time series contains no values.");
        }
        const dimensions = Array.isArray(series[0]) ? series : [series];
        if (dimensions.some((dimension) =>
            !Array.isArray(dimension)
            || !dimension.length
            || dimension.some((value) => !Number.isFinite(value))
        )) {
            throw new Error("The selected time series contains invalid values.");
        }
        return dimensions;
    }

    function drawSeries() {
        if (!activeDataset) {
            return;
        }

        const item = activeDataset.series[seriesIndex];
        const dimensions = dimensionsForSeries(item.series);
        const values = dimensions[dimensionIndex];
        const normalizedValues = showZNormalization
            ? window.TimeSeriesZNormalization.normalize(values)
            : null;
        const width = 900;
        const height = 560;
        const margins = {
            top: 42,
            right: 32,
            bottom: 88,
            left: 86,
        };
        const plotWidth = width - margins.left - margins.right;
        const plotHeight = height - margins.top - margins.bottom;
        const xForIndex = (index) => margins.left + (values.length === 1
            ? plotWidth / 2
            : index / (values.length - 1) * plotWidth);
        function scaleForSeries(seriesValues, symmetric = false) {
            let minimum = seriesValues.reduce(
                (current, value) => Math.min(current, value),
                Infinity
            );
            let maximum = seriesValues.reduce(
                (current, value) => Math.max(current, value),
                -Infinity
            );
            if (symmetric) {
                const limit = Math.max(
                    1,
                    Math.ceil(Math.max(Math.abs(minimum), Math.abs(maximum)) * 2) / 2
                );
                minimum = -limit;
                maximum = limit;
            } else if (minimum === maximum) {
                const padding = Math.abs(minimum) * 0.05 || 1;
                minimum -= padding;
                maximum += padding;
            }
            return {
                minimum,
                maximum,
                yForValue: (value) =>
                    margins.top + (maximum - value) / (maximum - minimum) * plotHeight,
            };
        }
        const standardScale = scaleForSeries(values);
        const normalizedScale = normalizedValues
            ? scaleForSeries(normalizedValues, true)
            : null;
        const pointCoordinates = values.map((value, index) => ({
            x: xForIndex(index),
            y: standardScale.yForValue(value),
        }));
        const normalizedPointCoordinates = normalizedValues
            ? normalizedValues.map((value, index) => ({
                x: xForIndex(index),
                y: normalizedScale.yForValue(value),
            }))
            : null;

        chart.replaceChildren();
        document.dispatchEvent(new Event("timeserieshoverhide"));
        chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
        chart.setAttribute(
            "aria-label",
            `${activeDataset.name}, time series ${seriesIndex + 1}, dimension ${dimensionIndex + 1}`
                + (normalizedValues ? ", standard and Z-normalized values" : "")
        );

        for (let tick = 0; tick <= 4; tick += 1) {
            const ratio = tick / 4;
            const y = margins.top + ratio * plotHeight;
            const value = standardScale.maximum
                - ratio * (standardScale.maximum - standardScale.minimum);
            chart.append(
                svgElement("line", {
                    x1: margins.left,
                    y1: y,
                    x2: width - margins.right,
                    y2: y,
                    class: "time-series-grid-line",
                }),
                svgElement("text", {
                    x: margins.left - 4,
                    y: y + 4,
                    class: "time-series-tick-label",
                    "text-anchor": "end",
                }, Number(value.toPrecision(4)).toString())
            );
            if (normalizedScale) {
                const normalizedValue = normalizedScale.maximum
                    - ratio * (normalizedScale.maximum - normalizedScale.minimum);
                chart.append(svgElement("text", {
                    x: width - margins.right - 8,
                    y: y + 4,
                    class: "time-series-tick-label time-series-z-tick-label",
                    "text-anchor": "end",
                }, Number(normalizedValue.toPrecision(4)).toString()));
            }
        }

        chart.append(
            svgElement("line", {
                x1: margins.left,
                y1: margins.top,
                x2: margins.left,
                y2: height - margins.bottom,
                class: "time-series-axis",
            }),
            svgElement("line", {
                x1: margins.left,
                y1: height - margins.bottom,
                x2: width - margins.right,
                y2: height - margins.bottom,
                class: "time-series-axis",
            }),
            ...(normalizedScale ? [svgElement("line", {
                x1: width - margins.right,
                y1: margins.top,
                x2: width - margins.right,
                y2: height - margins.bottom,
                class: "time-series-axis time-series-z-axis",
            })] : [])
        );

        const stepTickCount = Math.min(10, values.length);
        for (let tick = 0; tick < stepTickCount; tick += 1) {
            const stepIndex = stepTickCount === 1
                ? 0
                : Math.round(tick * (values.length - 1) / (stepTickCount - 1));
            const x = xForIndex(stepIndex);
            const textAnchor = tick === 0 && tick === stepTickCount - 1
                ? "middle"
                : tick === 0
                    ? "start"
                    : tick === stepTickCount - 1
                        ? "end"
                        : "middle";
            chart.append(
                svgElement("line", {
                    x1: x,
                    y1: height - margins.bottom,
                    x2: x,
                    y2: height - margins.bottom + 8,
                    class: "time-series-axis",
                }),
                svgElement("text", {
                    x,
                    y: height - margins.bottom + 28,
                    class: "time-series-tick-label",
                    "text-anchor": textAnchor,
                }, String(stepIndex + 1))
            );
        }

        const points = pointCoordinates.map(({ x, y }) => `${x},${y}`);

        chart.append(svgElement("polyline", {
            points: points.join(" "),
            class: "time-series-line time-series-line-standard",
        }));
        if (normalizedPointCoordinates) {
            const normalizedPoints = normalizedPointCoordinates
                .map(({ x, y }) => `${x},${y}`);
            chart.append(svgElement("polyline", {
                points: normalizedPoints.join(" "),
                class: "time-series-line time-series-line-normalized",
            }));
        }
        chart.append(
            svgElement("text", {
                x: margins.left + plotWidth / 2,
                y: height - 12,
                class: "time-series-axis-label",
                "text-anchor": "middle",
            }, "Time step"),
            svgElement("text", {
                x: 14,
                y: margins.top + plotHeight / 2,
                class: "time-series-axis-label",
                "text-anchor": "middle",
                transform: `rotate(-90 14 ${margins.top + plotHeight / 2})`,
            }, `Dimension ${dimensionIndex + 1} value`)
        );
        if (normalizedScale) {
            const axisLabelX = width - 16;
            const axisLabelY = margins.top + plotHeight / 2;
            chart.append(svgElement("text", {
                x: axisLabelX,
                y: axisLabelY,
                class: "time-series-axis-label time-series-z-axis-label",
                "text-anchor": "middle",
                transform: `rotate(90 ${axisLabelX} ${axisLabelY})`,
            }, "Z amplitude"));
        }
        if (values.length === 1) {
            chart.append(svgElement("circle", {
                cx: pointCoordinates[0].x,
                cy: pointCoordinates[0].y,
                r: 5,
                class: "time-series-point time-series-point-standard",
            }));
            if (normalizedPointCoordinates) {
                chart.append(svgElement("circle", {
                    cx: normalizedPointCoordinates[0].x,
                    cy: normalizedPointCoordinates[0].y,
                    r: 5,
                    class: "time-series-point time-series-point-normalized",
                }));
            }
        }
        datasetTitle.textContent = activeDataset.name;
        datasetTitle.title = activeDataset.name;
        seriesDimensionTitle.textContent =
            ` — Series ${seriesIndex + 1}, Dimension ${dimensionIndex + 1}`;
        document.dispatchEvent(new CustomEvent("timeseriesplotrendered", {
            detail: {
                chart,
                visualization,
                values,
                pointCoordinates,
                plotLeft: margins.left,
                plotWidth,
                plotBottom: height - margins.bottom,
            },
        }));
    }

    function closeVisualization() {
        visualization.hidden = true;
        visualization.setAttribute("aria-hidden", "true");
        document.dispatchEvent(new Event("timeserieshoverhide"));
        activeDataset = null;
        classSelector.open = false;
        seriesSelector.open = false;
        dimensionSelector.open = false;
        chart.replaceChildren();
    }

    function openVisualization(datasetId) {
        const checkbox = [...datasetList.querySelectorAll('input[type="checkbox"]')]
            .find((item) => item.dataset.datasetId === datasetId);
        if (!checkbox) {
            return;
        }

        const series = JSON.parse(checkbox.dataset.series);
        if (!Array.isArray(series) || !series.length) {
            throw new Error("The selected dataset contains no time series.");
        }
        const classes = [...new Set(series.map(classForSeries))];
        selectedClass = classes[0];
        const dimensionCount = dimensionsForSeries(series[0].series).length;
        activeDataset = {
            datasetId: checkbox.dataset.datasetId,
            name: checkbox.value,
            series,
            classes,
        };
        showZNormalization = true;
        normalizationToggle.setAttribute("aria-pressed", "true");
        seriesIndex = series.findIndex((item) => classForSeries(item) === selectedClass);
        dimensionIndex = 0;
        classSelector.open = false;
        seriesSelector.open = false;
        dimensionSelector.open = false;
        comparisonStatus.textContent = "";

        classOptions.replaceChildren();
        classes.forEach((label) => {
            const option = document.createElement("button");
            option.type = "button";
            option.dataset.classLabel = label;
            option.setAttribute("aria-pressed", String(label === selectedClass));
            option.textContent = classLabel(label);
            classOptions.append(option);
        });
        classSummary.textContent = classLabel(selectedClass);
        classSummary.setAttribute("aria-disabled", String(classes.length === 1));
        classSummary.tabIndex = classes.length === 1 ? -1 : 0;
        classSelector.classList.toggle("is-disabled", classes.length === 1);

        renderSeriesOptions();

        dimensionOptions.replaceChildren();
        for (let index = 0; index < dimensionCount; index += 1) {
            const option = document.createElement("button");
            option.type = "button";
            option.dataset.dimensionIndex = String(index);
            option.setAttribute("aria-pressed", String(index === dimensionIndex));
            option.textContent = `Dimension ${index + 1}`;
            dimensionOptions.append(option);
        }
        dimensionSummary.textContent = "Dimension 1";
        dimensionSummary.setAttribute("aria-disabled", String(dimensionCount === 1));
        dimensionSummary.tabIndex = dimensionCount === 1 ? -1 : 0;
        dimensionSelector.classList.toggle("is-disabled", dimensionCount === 1);
        if (dimensionCount === 1) {
            dimensionSelector.open = false;
        }

        visualization.hidden = false;
        visualization.setAttribute("aria-hidden", "false");
        drawSeries();
    }

    classOptions.addEventListener("click", (event) => {
        const option = event.target.closest("button[data-class-label]");
        if (!option || !activeDataset) {
            return;
        }
        selectClass(option.dataset.classLabel);
    });

    seriesOptions.addEventListener("click", (event) => {
        const option = event.target.closest("button[data-series-index]");
        if (!option || !activeDataset) {
            return;
        }
        seriesIndex = Number(option.dataset.seriesIndex);
        seriesSummary.textContent =
            `Series ${seriesIndex + 1}${selectedClass ? ` (class ${selectedClass})` : ""}`;
        seriesOptions.querySelectorAll("button").forEach((button) => {
            button.setAttribute("aria-pressed", String(button === option));
        });
        seriesSelector.open = false;
        drawSeries();
    });

    dimensionOptions.addEventListener("click", (event) => {
        const option = event.target.closest("button[data-dimension-index]");
        if (!option || !activeDataset) {
            return;
        }
        dimensionIndex = Number(option.dataset.dimensionIndex);
        dimensionSummary.textContent = `Dimension ${dimensionIndex + 1}`;
        dimensionOptions.querySelectorAll("button").forEach((button) => {
            button.setAttribute("aria-pressed", String(button === option));
        });
        dimensionSelector.open = false;
        drawSeries();
    });

    normalizationToggle.addEventListener("click", () => {
        showZNormalization = !showZNormalization;
        normalizationToggle.setAttribute("aria-pressed", String(showZNormalization));
        drawSeries();
    });

    document.addEventListener("timeseriesvisualizationrequest", (event) => {
        try {
            openVisualization(event.detail.datasetId);
        } catch (error) {
            closeVisualization();
            comparisonStatus.textContent = `Visualization failed: ${error.message}`;
            console.error("Could not display the selected time series.", error);
        }
    });
    document.addEventListener("graphchange", closeVisualization);
    document.addEventListener("comparisoncomplete", closeVisualization);
    document.addEventListener("datasetrename", closeVisualization);
    datasetList.addEventListener("click", (event) => {
        if (!event.target.matches(".delete-set-button") || !activeDataset) {
            return;
        }
        const checkbox = event.target.closest(".dataset-row")
            .querySelector('input[type="checkbox"]');
        if (checkbox.dataset.datasetId === activeDataset.datasetId) {
            closeVisualization();
        }
    });
    quitButton.addEventListener("click", closeVisualization);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !visualization.hidden) {
            closeVisualization();
        }
    });
})();
