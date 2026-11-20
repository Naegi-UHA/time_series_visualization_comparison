(function () {
    const datasetList = document.getElementById("dataset-list");
    const visualization = document.getElementById("time-series-visualization");
    const comparisonStatus = document.getElementById("comparison-status");
    const datasetTitle = document.getElementById("time-series-visualization-dataset-name");
    const seriesDimensionTitle = document.getElementById("time-series-visualization-series-dimension");
    const seriesSelector = document.getElementById("time-series-selector-control");
    const dimensionSelector = document.getElementById("dimension-selector-control");
    const seriesSummary = document.getElementById("time-series-selector-summary");
    const dimensionSummary = document.getElementById("dimension-selector-summary");
    const seriesOptions = document.getElementById("time-series-selector-options");
    const dimensionOptions = document.getElementById("dimension-selector-options");
    const chart = document.getElementById("time-series-chart");
    const quitButton = document.getElementById("quit-time-series-visualization");
    const svgNamespace = "http://www.w3.org/2000/svg";
    let activeDataset = null;
    let seriesIndex = 0;
    let dimensionIndex = 0;

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
        const width = 900;
        const height = 560;
        const margins = { top: 42, right: 32, bottom: 88, left: 86 };
        const plotWidth = width - margins.left - margins.right;
        const plotHeight = height - margins.top - margins.bottom;
        let minimum = values.reduce((current, value) => Math.min(current, value), Infinity);
        let maximum = values.reduce((current, value) => Math.max(current, value), -Infinity);
        if (minimum === maximum) {
            const padding = Math.abs(minimum) * 0.05 || 1;
            minimum -= padding;
            maximum += padding;
        }

        chart.replaceChildren();
        chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
        chart.setAttribute(
            "aria-label",
            `${activeDataset.name}, time series ${seriesIndex + 1}, dimension ${dimensionIndex + 1}`
        );

        for (let tick = 0; tick <= 4; tick += 1) {
            const ratio = tick / 4;
            const y = margins.top + ratio * plotHeight;
            const value = maximum - ratio * (maximum - minimum);
            chart.append(
                svgElement("line", {
                    x1: margins.left,
                    y1: y,
                    x2: width - margins.right,
                    y2: y,
                    class: "time-series-grid-line",
                }),
                svgElement("text", {
                    x: margins.left - 10,
                    y: y + 4,
                    class: "time-series-tick-label",
                    "text-anchor": "end",
                }, Number(value.toPrecision(4)).toString())
            );
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
            })
        );

        const stepTickCount = Math.min(10, values.length);
        for (let tick = 0; tick < stepTickCount; tick += 1) {
            const stepIndex = stepTickCount === 1
                ? 0
                : Math.round(tick * (values.length - 1) / (stepTickCount - 1));
            const x = margins.left + (values.length === 1
                ? plotWidth / 2
                : stepIndex / (values.length - 1) * plotWidth);
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

        const points = values.map((value, index) => {
            const x = margins.left + (values.length === 1
                ? plotWidth / 2
                : index / (values.length - 1) * plotWidth);
            const y = margins.top + (maximum - value) / (maximum - minimum) * plotHeight;
            return `${x},${y}`;
        });
        chart.append(
            svgElement("polyline", {
                points: points.join(" "),
                class: "time-series-line",
            }),
            svgElement("text", {
                x: margins.left + plotWidth / 2,
                y: height - 12,
                class: "time-series-axis-label",
                "text-anchor": "middle",
            }, "Time step"),
            svgElement("text", {
                x: 20,
                y: margins.top + plotHeight / 2,
                class: "time-series-axis-label",
                "text-anchor": "middle",
                transform: `rotate(-90 20 ${margins.top + plotHeight / 2})`,
            }, `Dimension ${dimensionIndex + 1} value`)
        );
        if (values.length === 1) {
            const x = margins.left + plotWidth / 2;
            const y = margins.top + (maximum - values[0]) / (maximum - minimum) * plotHeight;
            chart.append(svgElement("circle", {
                cx: x,
                cy: y,
                r: 5,
                class: "time-series-point",
            }));
        }
        datasetTitle.textContent = activeDataset.name;
        datasetTitle.title = activeDataset.name;
        seriesDimensionTitle.textContent =
            ` — Series ${seriesIndex + 1}, Dimension ${dimensionIndex + 1}`;
    }

    function closeVisualization() {
        visualization.hidden = true;
        visualization.setAttribute("aria-hidden", "true");
        activeDataset = null;
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
        const dimensionCount = dimensionsForSeries(series[0].series).length;
        activeDataset = {
            datasetId: checkbox.dataset.datasetId,
            name: checkbox.value,
            series,
        };
        seriesIndex = 0;
        dimensionIndex = 0;
        seriesSelector.open = false;
        dimensionSelector.open = false;
        comparisonStatus.textContent = "";

        seriesOptions.replaceChildren();
        series.forEach((item, index) => {
            const option = document.createElement("button");
            option.type = "button";
            option.dataset.seriesIndex = String(index);
            option.setAttribute("aria-pressed", String(index === seriesIndex));
            option.textContent = `Series ${index + 1}${item.label ? ` (class ${item.label})` : ""}`;
            seriesOptions.append(option);
        });
        seriesSummary.textContent =
            `Series 1${series[0].label ? ` (class ${series[0].label})` : ""}`;

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

    seriesOptions.addEventListener("click", (event) => {
        const option = event.target.closest("button[data-series-index]");
        if (!option || !activeDataset) {
            return;
        }
        seriesIndex = Number(option.dataset.seriesIndex);
        const item = activeDataset.series[seriesIndex];
        seriesSummary.textContent =
            `Series ${seriesIndex + 1}${item.label ? ` (class ${item.label})` : ""}`;
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
