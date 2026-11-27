(function () {
    const placeholder = document.getElementById("distance-animation-placeholder");
    const animation = document.getElementById("distance-animation");
    const chart = document.getElementById("distance-animation-chart");
    const seriesLabel = document.getElementById("distance-animation-series-label");
    const methodLabel = document.getElementById("distance-animation-method");
    const distanceValue = document.getElementById("distance-animation-distance-value");
    const status = document.getElementById("distance-animation-status");
    const replayButton = document.getElementById("distance-animation-replay");
    const datasetSelectors = [
        {
            details: document.getElementById("distance-animation-selector-a"),
            summary: document.getElementById("distance-animation-selector-a-summary"),
            options: document.getElementById("distance-animation-selector-a-options"),
            label: "First",
        },
        {
            details: document.getElementById("distance-animation-selector-b"),
            summary: document.getElementById("distance-animation-selector-b-summary"),
            options: document.getElementById("distance-animation-selector-b-options"),
            label: "Second",
        },
    ];
    const legend = [
        {
            color: document.getElementById("distance-animation-legend-color-a"),
            label: document.getElementById("distance-animation-legend-label-a"),
        },
        {
            color: document.getElementById("distance-animation-legend-color-b"),
            label: document.getElementById("distance-animation-legend-label-b"),
        },
    ];

    const SVG_NS = "http://www.w3.org/2000/svg";
    const DURATION = 8500;
    const DRAW_DURATION = 2600;
    const MAX_DISPLAY_POINTS = 100;
    const plot = { left: 62, right: 596, top: 24, bottom: 205 };
    let activeAnimation = null;
    let comparisonDetail = null;
    let selectedDatasetIndices = [0, 1];
    let frameId = null;

    function svgElement(tag, attributes) {
        const element = document.createElementNS(SVG_NS, tag);
        Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
        return element;
    }

    function addText(parent, x, y, value, anchor) {
        const text = svgElement("text", { x, y, "text-anchor": anchor || "middle" });
        text.textContent = value;
        parent.append(text);
        return text;
    }

    function formatNumber(value) {
        return Number(value).toLocaleString(undefined, {
            maximumFractionDigits: 2,
        });
    }

    function downsample(values) {
        if (values.length <= MAX_DISPLAY_POINTS) {
            return values;
        }

        return Array.from({ length: MAX_DISPLAY_POINTS }, (_, index) => {
            const sourceIndex = Math.round(index * (values.length - 1) / (MAX_DISPLAY_POINTS - 1));
            return values[sourceIndex];
        });
    }

    function extractFirstSeries(dataset) {
        let records;
        try {
            records = JSON.parse(dataset.dataset.series);
        } catch (error) {
            throw new Error(`Could not read the series in dataset "${dataset.value}".`);
        }

        if (!Array.isArray(records) || records.length === 0 || !Array.isArray(records[0].series)) {
            throw new Error(`Dataset "${dataset.value}" has no series to animate.`);
        }

        const record = records[0];
        const rawValues = Array.isArray(record.series[0]) ? record.series[0] : record.series;
        const values = rawValues.map(Number);
        if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
            throw new Error(`The first series in dataset "${dataset.value}" contains no finite values.`);
        }

        return {
            datasetName: dataset.value,
            label: record.label || "Series 1",
            values: downsample(values),
            color: /^#[0-9a-f]{6}$/i.test(dataset.dataset.color || "")
                ? dataset.dataset.color
                : null,
        };
    }

    function createChart(seriesA, seriesB) {
        const allValues = [...seriesA.values, ...seriesB.values];
        let minimum = Math.min(...allValues);
        let maximum = Math.max(...allValues);
        if (minimum === maximum) {
            const padding = Math.abs(minimum) * 0.1 || 1;
            minimum -= padding;
            maximum += padding;
        }

        const chartHeight = plot.bottom - plot.top;
        const chartWidth = plot.right - plot.left;
        const valueToY = (value) => plot.bottom - ((value - minimum) / (maximum - minimum)) * chartHeight;
        const indexToX = (index, length) => plot.left + (index / Math.max(length - 1, 1)) * chartWidth;

        chart.replaceChildren();
        chart.style.setProperty("--animation-series-a", seriesA.color || "var(--graph-line)");
        chart.style.setProperty("--animation-series-b", seriesB.color || "var(--graph-line-normalized)");

        for (let tick = 0; tick <= 4; tick += 1) {
            const y = plot.top + (chartHeight * tick) / 4;
            const value = maximum - ((maximum - minimum) * tick) / 4;
            chart.append(
                svgElement("line", {
                    x1: plot.left,
                    x2: plot.right,
                    y1: y,
                    y2: y,
                    class: "distance-animation-grid",
                })
            );
            addText(chart, plot.left - 8, y + 4, formatNumber(value), "end");
        }

        chart.append(
            svgElement("line", {
                x1: plot.left,
                x2: plot.left,
                y1: plot.top,
                y2: plot.bottom,
                class: "distance-animation-axis",
            }),
            svgElement("line", {
                x1: plot.left,
                x2: plot.right,
                y1: plot.bottom,
                y2: plot.bottom,
                class: "distance-animation-axis",
            })
        );

        for (let tick = 0; tick <= 4; tick += 1) {
            const x = plot.left + (chartWidth * tick) / 4;
            addText(chart, x, plot.bottom + 18, `${tick * 25}%`);
        }
        addText(chart, (plot.left + plot.right) / 2, 245, "Normalized time");

        const lineA = svgElement("polyline", { class: "distance-animation-series distance-animation-series-a" });
        const lineB = svgElement("polyline", { class: "distance-animation-series distance-animation-series-b" });
        const link = svgElement("line", { class: "distance-animation-link", visibility: "hidden" });
        const markerA = svgElement("circle", {
            class: "distance-animation-marker distance-animation-marker-a",
            r: 5,
            visibility: "hidden",
        });
        const markerB = svgElement("circle", {
            class: "distance-animation-marker distance-animation-marker-b",
            r: 5,
            visibility: "hidden",
        });
        chart.append(lineA, lineB, link, markerA, markerB);

        return {
            lineA,
            lineB,
            link,
            markerA,
            markerB,
            pointFor(values, index) {
                return {
                    x: indexToX(index, values.length),
                    y: valueToY(values[index]),
                };
            },
        };
    }

    function pointsFor(values, pointCount, pointFor) {
        return values
            .slice(0, pointCount)
            .map((_, index) => {
                const point = pointFor(values, index);
                return `${point.x},${point.y}`;
            })
            .join(" ");
    }

    function renderDatasetSelectors() {
        datasetSelectors.forEach((selector) => selector.options.replaceChildren());
        comparisonDetail.selectedSets.forEach((dataset, index) => {
            datasetSelectors.forEach((selector, side) => {
                const otherSelection = selectedDatasetIndices[1 - side];
                const selectedIndex = selectedDatasetIndices[side];
                const name = dataset.value;

                if (index === selectedIndex) {
                    selector.summary.textContent = name;
                    selector.summary.title = name;
                    selector.summary.setAttribute("aria-label", `${selector.label} dataset: ${name}`);
                }

                const option = document.createElement("button");
                option.type = "button";
                option.dataset.datasetIndex = String(index);
                option.textContent = name;
                option.title = name;
                option.disabled = index === otherSelection;
                option.setAttribute("aria-pressed", String(index === selectedIndex));
                selector.options.append(option);
            });
        });
    }

    function updateCurrentAnimation() {
        const [indexA, indexB] = selectedDatasetIndices;
        const datasetA = comparisonDetail.selectedSets[indexA];
        const datasetB = comparisonDetail.selectedSets[indexB];
        const seriesA = extractFirstSeries(datasetA);
        const seriesB = extractFirstSeries(datasetB);
        const [firstIndex, secondIndex] = [indexA, indexB].sort((first, second) => first - second);
        const pairDistance = comparisonDetail.result.distances.find((item) =>
            Array.isArray(item.indices) &&
            item.indices[0] === firstIndex &&
            item.indices[1] === secondIndex
        );
        if (!pairDistance || !Number.isFinite(Number(pairDistance.distance))) {
            throw new Error(`The comparison result has no distance for "${datasetA.value}" and "${datasetB.value}".`);
        }

        const chartParts = createChart(seriesA, seriesB);
        chart.setAttribute("aria-label", `${seriesA.datasetName} vs ${seriesB.datasetName}`);
        seriesLabel.textContent = `${seriesA.label} ↔ ${seriesB.label}`;
        methodLabel.textContent =
            `Dataset distance · ${comparisonDetail.result.method_label || String(comparisonDetail.result.method || "Distance")}`;
        distanceValue.textContent = formatNumber(pairDistance.distance);

        [seriesA, seriesB].forEach((series, index) => {
            legend[index].color.style.backgroundColor =
                series.color || (index === 0 ? "var(--graph-line)" : "var(--graph-line-normalized)");
            legend[index].label.textContent = series.datasetName;
            legend[index].label.title = series.datasetName;
        });

        return {
            seriesA,
            seriesB,
            chartParts,
            distance: Number(pairDistance.distance),
            stepCount: Math.max(seriesA.values.length, seriesB.values.length),
        };
    }

    function buildAnimation(detail) {
        if (!Array.isArray(detail.selectedSets) || detail.selectedSets.length < 2) {
            throw new Error("At least two selected datasets are required for the animation.");
        }
        if (!detail.result || !Array.isArray(detail.result.distances)) {
            throw new Error("The comparison result does not contain pairwise distances.");
        }

        comparisonDetail = detail;
        selectedDatasetIndices = [0, 1];
        renderDatasetSelectors();
        return updateCurrentAnimation();
    }

    function selectDataset(side, index) {
        if (
            !comparisonDetail ||
            !Number.isInteger(index) ||
            index < 0 ||
            index >= comparisonDetail.selectedSets.length ||
            index === selectedDatasetIndices[1 - side]
        ) {
            return;
        }

        selectedDatasetIndices[side] = index;
        datasetSelectors[side].details.open = false;
        renderDatasetSelectors();
        try {
            activeAnimation = updateCurrentAnimation();
            startAnimation();
        } catch (error) {
            showError(error);
        }
    }

    function showError(error) {
        if (frameId !== null) {
            cancelAnimationFrame(frameId);
            frameId = null;
        }
        activeAnimation = null;
        animation.hidden = true;
        replayButton.hidden = true;
        placeholder.hidden = false;
        placeholder.textContent = `Animation unavailable: ${error.message}`;
    }

    function startAnimation() {
        if (!activeAnimation) {
            return;
        }
        if (frameId !== null) {
            cancelAnimationFrame(frameId);
        }

        const { seriesA, seriesB, chartParts, stepCount, distance } = activeAnimation;
        const { lineA, lineB, link, markerA, markerB, pointFor } = chartParts;
        lineA.setAttribute("points", "");
        lineB.setAttribute("points", "");
        link.setAttribute("visibility", "hidden");
        markerA.setAttribute("visibility", "hidden");
        markerB.setAttribute("visibility", "hidden");
        animation.dataset.animationState = "running";
        status.textContent = "Drawing the selected example series…";

        let startedAt = null;
        let lastStatusUpdate = 0;
        let lastStep = -1;
        let curvesDrawn = false;

        function frame(timestamp) {
            if (startedAt === null) {
                startedAt = timestamp;
            }
            const elapsed = Math.min(timestamp - startedAt, DURATION);

            if (elapsed < DRAW_DURATION || !curvesDrawn) {
                const drawProgress = Math.min(elapsed / DRAW_DURATION, 1);
                const countA = Math.max(1, Math.ceil(seriesA.values.length * drawProgress));
                const countB = Math.max(1, Math.ceil(seriesB.values.length * drawProgress));
                lineA.setAttribute("points", pointsFor(seriesA.values, countA, pointFor));
                lineB.setAttribute("points", pointsFor(seriesB.values, countB, pointFor));
                if (drawProgress >= 1) {
                    curvesDrawn = true;
                }
            }

            if (elapsed >= DRAW_DURATION) {
                const comparisonProgress = Math.min(
                    (elapsed - DRAW_DURATION) / (DURATION - DRAW_DURATION),
                    1
                );
                const step = Math.min(stepCount - 1, Math.floor(comparisonProgress * stepCount));
                if (step !== lastStep) {
                    lastStep = step;
                    const indexA = Math.round(step * (seriesA.values.length - 1) / Math.max(stepCount - 1, 1));
                    const indexB = Math.round(step * (seriesB.values.length - 1) / Math.max(stepCount - 1, 1));
                    const pointA = pointFor(seriesA.values, indexA);
                    const pointB = pointFor(seriesB.values, indexB);
                    link.setAttribute("x1", pointA.x);
                    link.setAttribute("y1", pointA.y);
                    link.setAttribute("x2", pointB.x);
                    link.setAttribute("y2", pointB.y);
                    markerA.setAttribute("cx", pointA.x);
                    markerA.setAttribute("cy", pointA.y);
                    markerB.setAttribute("cx", pointB.x);
                    markerB.setAttribute("cy", pointB.y);
                    link.setAttribute("visibility", "visible");
                    markerA.setAttribute("visibility", "visible");
                    markerB.setAttribute("visibility", "visible");

                    if (elapsed - lastStatusUpdate >= 500 || step === stepCount - 1) {
                        const localDifference = Math.abs(seriesA.values[indexA] - seriesB.values[indexB]);
                        status.textContent =
                            `Point comparison ${step + 1}/${stepCount} · local absolute difference: ${formatNumber(localDifference)}`;
                        lastStatusUpdate = elapsed;
                    }
                }
            }

            if (elapsed >= DURATION) {
                animation.dataset.animationState = "complete";
                status.textContent = `Animation complete · dataset distance: ${formatNumber(distance)}`;
                frameId = null;
                return;
            }

            frameId = requestAnimationFrame(frame);
        }

        frameId = requestAnimationFrame(frame);
    }

    datasetSelectors.forEach((selector, side) => {
        selector.options.addEventListener("click", (event) => {
            const option = event.target.closest("button[data-dataset-index]");
            if (option && !option.disabled) {
                selectDataset(side, Number(option.dataset.datasetIndex));
            }
        });
        selector.details.addEventListener("toggle", () => {
            if (selector.details.open) {
                datasetSelectors[1 - side].details.open = false;
            }
        });
    });

    replayButton.addEventListener("click", startAnimation);
    document.addEventListener("comparisoncomplete", (event) => {
        try {
            activeAnimation = buildAnimation(event.detail);
            placeholder.hidden = true;
            animation.hidden = false;
            replayButton.hidden = false;
            startAnimation();
        } catch (error) {
            showError(error);
        }
    });
})();
