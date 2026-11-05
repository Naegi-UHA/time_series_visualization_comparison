(function () {
    const mapPlaceholder = document.getElementById("map-placeholder");
    const mapResult = document.getElementById("dataset-map-result");
    const linesToggle = document.getElementById("dataset-map-lines-toggle");
    let showDistanceLines = true;
    let activeInfoPoint = null;
    let datasetInfoCard = null;

    function hideDatasetInfo() {
        if (!activeInfoPoint) {
            return;
        }
        activeInfoPoint.setAttribute("aria-expanded", "false");
        datasetInfoCard.remove();
        activeInfoPoint = null;
        datasetInfoCard = null;
    }

    function positionDatasetInfo(point) {
        if (!datasetInfoCard || !point || !mapResult.clientWidth || !mapResult.clientHeight) {
            return;
        }

        const mapBounds = mapResult.getBoundingClientRect();
        const pointBounds = point.getBoundingClientRect();
        const cardBounds = datasetInfoCard.getBoundingClientRect();
        const gap = 12;
        let left = pointBounds.right - mapBounds.left + gap;
        if (left + cardBounds.width > mapResult.clientWidth - 8) {
            left = pointBounds.left - mapBounds.left - cardBounds.width - gap;
        }
        left = Math.max(8, Math.min(left, mapResult.clientWidth - cardBounds.width - 8));
        const top = Math.max(
            8,
            Math.min(
                pointBounds.top - mapBounds.top
                    + (pointBounds.height - cardBounds.height) / 2,
                mapResult.clientHeight - cardBounds.height - 8
            )
        );
        datasetInfoCard.style.left = `${left}px`;
        datasetInfoCard.style.top = `${top}px`;
    }

    function showDatasetInfo(point) {
        const source = point.dataset;
        const name = point.dataset.name;
        const rows = [
            ["Time series", source.seriesCount],
            ["Classes", source.classCount],
            ["Dimensions", source.dimensionCount],
        ];
        const card = document.createElement("section");
        card.className = "dataset-info-card";
        card.setAttribute("aria-label", `Dataset information for ${name}`);

        const heading = document.createElement("h3");
        heading.textContent = name;
        card.append(heading);

        const list = document.createElement("dl");
        rows.forEach(([label, value]) => {
            const term = document.createElement("dt");
            term.textContent = label;
            const detail = document.createElement("dd");
            detail.textContent = value;
            list.append(term, detail);
        });
        card.append(list);

        point.setAttribute("aria-expanded", "true");
        mapResult.append(card);
        activeInfoPoint = point;
        datasetInfoCard = card;
        requestAnimationFrame(() => positionDatasetInfo(point));
    }

    mapResult.addEventListener("click", (event) => {
        const point = event.target.closest(".map-point");
        if (!point) {
            return;
        }

        if (point === activeInfoPoint) {
            hideDatasetInfo();
            return;
        }
        hideDatasetInfo();
        showDatasetInfo(point);
    });

    function niceTicks(minimum, maximum, targetCount = 5) {
        const range = maximum - minimum;
        if (!range) {
            return [minimum];
        }

        const roughStep = range / (targetCount - 1);
        const magnitude = 10 ** Math.floor(Math.log10(roughStep));
        const normalizedStep = roughStep / magnitude;
        const step = (normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10)
            * magnitude;
        const ticks = [];
        for (let value = Math.ceil(minimum / step) * step; value <= maximum; value += step) {
            ticks.push(Number(value.toPrecision(12)));
        }
        return ticks;
    }

    function formatAxisValue(value) {
        return Number(value.toPrecision(4)).toString();
    }

    function updateDistanceLabels() {
        const width = mapResult.clientWidth;
        const height = mapResult.clientHeight;
        if (!width || !height) {
            return;
        }

        mapResult.querySelectorAll(".map-distance-label").forEach((label) => {
            const dx = (Number(label.dataset.x2) - Number(label.dataset.x1)) * width;
            const dy = (Number(label.dataset.y2) - Number(label.dataset.y1)) * height;
            let angle = Math.atan2(dy, dx) * 180 / Math.PI;
            if (angle > 90 || angle < -90) {
                angle += 180;
            }
            label.style.transform =
                `translate(-50%, -50%) rotate(${angle}deg) translateY(-7px)`;
        });
    }

    linesToggle.addEventListener("click", () => {
        showDistanceLines = !showDistanceLines;
        linesToggle.textContent = showDistanceLines ? "Hide lines" : "Show lines";
        linesToggle.setAttribute("aria-label", showDistanceLines
            ? "Hide distance lines"
            : "Show distance lines");
        linesToggle.setAttribute("aria-pressed", String(showDistanceLines));
        mapResult.classList.toggle("hide-distance-lines", !showDistanceLines);
    });

    document.addEventListener("graphchange", (event) => {
        linesToggle.hidden = event.detail.graph !== "dataset-map" || mapResult.hidden;
        requestAnimationFrame(updateDistanceLabels);
    });

    const resizeObserver = new ResizeObserver(() => {
        updateDistanceLabels();
        positionDatasetInfo(activeInfoPoint);
    });
    resizeObserver.observe(mapResult);
    resizeObserver.observe(document.getElementById("graph-preview"));

    window.graphRenderers = window.graphRenderers || {};
    window.graphRenderers["dataset-map"] = {
        render(result, selectedSets) {
            const xValues = result.datasets.map((dataset) => dataset.x);
            const yValues = result.datasets.map((dataset) => dataset.y);
            let minX = Math.min(...xValues);
            let maxX = Math.max(...xValues);
            let minY = Math.min(...yValues);
            let maxY = Math.max(...yValues);
            if (minX === maxX) {
                const padding = Math.abs(minX) * 0.05 || 1;
                minX -= padding;
                maxX += padding;
            }
            if (minY === maxY) {
                const padding = Math.abs(minY) * 0.05 || 1;
                minY -= padding;
                maxY += padding;
            }
            const spreadX = maxX - minX;
            const spreadY = maxY - minY;

            mapResult.replaceChildren();
            activeInfoPoint = null;
            datasetInfoCard = null;
            mapResult.classList.toggle("hide-distance-lines", !showDistanceLines);

            const axes = document.createElement("div");
            axes.className = "map-axes";
            axes.setAttribute("aria-label", "t-SNE coordinate axes");
            const xAxis = document.createElement("div");
            xAxis.className = "map-axis map-axis-x";
            const yAxis = document.createElement("div");
            yAxis.className = "map-axis map-axis-y";
            axes.append(xAxis, yAxis);

            niceTicks(minX, maxX).forEach((tick) => {
                const position = 15 + ((tick - minX) / spreadX) * 70;
                const mark = document.createElement("span");
                mark.className = "map-axis-tick map-axis-tick-x";
                mark.style.left = `${position}%`;
                mark.textContent = formatAxisValue(tick);
                axes.append(mark);
            });
            niceTicks(minY, maxY).forEach((tick) => {
                const position = 85 - ((tick - minY) / spreadY) * 70;
                const mark = document.createElement("span");
                mark.className = "map-axis-tick map-axis-tick-y";
                mark.style.top = `${position}%`;
                mark.textContent = formatAxisValue(tick);
                axes.append(mark);
            });

            const xLabel = document.createElement("span");
            xLabel.className = "map-axis-label map-axis-label-x";
            xLabel.textContent = "t-SNE 1";
            const yLabel = document.createElement("span");
            yLabel.className = "map-axis-label map-axis-label-y";
            yLabel.textContent = "t-SNE 2";
            axes.append(xLabel, yLabel);
            mapResult.append(axes);

            const points = result.datasets.map((dataset) => ({
                x: 15 + ((dataset.x - minX) / spreadX) * 70,
                y: 85 - ((dataset.y - minY) / spreadY) * 70,
            }));

            const lines = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            lines.classList.add("map-distance-lines");
            lines.setAttribute("viewBox", "0 0 100 100");
            lines.setAttribute("preserveAspectRatio", "none");
            lines.setAttribute("aria-hidden", "true");
            result.distances.forEach(({ indices, distance }) => {
                const [firstIndex, secondIndex] = indices;
                const firstPoint = points[firstIndex];
                const secondPoint = points[secondIndex];
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", firstPoint.x);
                line.setAttribute("y1", firstPoint.y);
                line.setAttribute("x2", secondPoint.x);
                line.setAttribute("y2", secondPoint.y);
                lines.append(line);

                const distanceLabel = document.createElement("span");
                distanceLabel.className = "map-distance-label";
                distanceLabel.textContent = distance.toFixed(3);
                distanceLabel.dataset.x1 = firstPoint.x / 100;
                distanceLabel.dataset.y1 = firstPoint.y / 100;
                distanceLabel.dataset.x2 = secondPoint.x / 100;
                distanceLabel.dataset.y2 = secondPoint.y / 100;
                distanceLabel.style.left = `${(firstPoint.x + secondPoint.x) / 2}%`;
                distanceLabel.style.top = `${(firstPoint.y + secondPoint.y) / 2}%`;
                distanceLabel.title =
                    `${result.datasets[firstIndex].name} / ${result.datasets[secondIndex].name}`;
                mapResult.append(distanceLabel);
            });
            mapResult.prepend(lines);

            result.datasets.forEach((dataset, index) => {
                const point = document.createElement("button");
                point.type = "button";
                point.className = `map-point ${index % 2 === 0 ? "map-point-a" : "map-point-b"}`;
                const sourceDataset = selectedSets[index];
                point.dataset.name = dataset.name;
                point.dataset.seriesCount = sourceDataset.dataset.seriesCount;
                point.dataset.classCount = sourceDataset.dataset.classCount;
                point.dataset.dimensionCount = sourceDataset.dataset.dimensionCount;
                const color = sourceDataset.dataset.color;
                if (color) {
                    point.style.backgroundColor = color;
                }
                point.dataset.datasetId = sourceDataset.dataset.datasetId;
                point.style.left = `${points[index].x}%`;
                point.style.top = `${points[index].y}%`;
                point.title = dataset.name;
                point.setAttribute(
                    "aria-label",
                    `Show dataset information for ${dataset.name}`
                );
                point.setAttribute("aria-expanded", "false");

                const label = document.createElement("span");
                label.className = "map-point-label";
                label.textContent = dataset.name;
                point.append(label);
                mapResult.append(point);
            });

            mapPlaceholder.hidden = true;
            mapResult.hidden = false;
            linesToggle.hidden = document.getElementById("graph-preview").dataset.currentGraph
                !== "dataset-map";
            linesToggle.textContent = showDistanceLines ? "Hide lines" : "Show lines";
            linesToggle.setAttribute("aria-pressed", String(showDistanceLines));
            requestAnimationFrame(updateDistanceLabels);
        },
    };
})();
