(function () {
    const heatmapPlaceholder = document.getElementById("heatmap-placeholder");
    const heatmapResult = document.getElementById("heatmap-result");
    const resetViewButton = document.getElementById("heatmap-reset-view");
    const colorSelector = document.getElementById("heatmap-color-selector");
    const colorOptions = colorSelector.querySelector(".heatmap-color-options");
    const graphPreview = document.getElementById("graph-preview");
    const colorMapHexStops = {
        Oranges: ["#FFF5EB", "#FEE6CE", "#FDD0A2", "#FDAE6A", "#FD8C3B", "#F16813", "#D84801", "#A53603", "#7F2704"],
        Blues: ["#F7FBFF", "#DEEBF7", "#C6DBEF", "#9DCAE1", "#6AAED6", "#4191C6", "#2070B4", "#08509B", "#08306B"],
        Greens: ["#F7FCF5", "#E5F5E0", "#C7E9C0", "#A0D99B", "#73C476", "#40AA5D", "#228A44", "#006C2C", "#00441B"],
        Purples: ["#FCFBFD", "#EFEDF5", "#DADAEB", "#BCBDDC", "#9E9AC8", "#807CBA", "#6950A3", "#53268F", "#3F007D"],
        Reds: ["#FFF5F0", "#FEE0D2", "#FCBBA1", "#FC9272", "#FB694A", "#EE3A2C", "#CA181D", "#A30F15", "#67000D"],
        viridis: ["#440154", "#472D7B", "#3B528B", "#2C728E", "#21918C", "#28AE80", "#5EC962", "#ADDC30", "#FDE725"],
        plasma: ["#0D0887", "#4C02A1", "#7E03A8", "#AA2395", "#CC4778", "#E66C5C", "#F89540", "#FDC527", "#F0F921"],
        inferno: ["#000004", "#210C4A", "#57106E", "#8A226A", "#BC3754", "#E45A31", "#F98E09", "#F9CB35", "#FCFFA4"],
        magma: ["#000004", "#1D1147", "#51127C", "#832681", "#B73779", "#E75263", "#FC8961", "#FEC488", "#FCFDBF"],
        cividis: ["#00224E", "#1A386F", "#434E6C", "#61656F", "#7D7C78", "#9B9476", "#BCAE6C", "#DEC958", "#FEE838"],
    };
    const colorMaps = Object.fromEntries(
        Object.entries(colorMapHexStops).map(([name, stops]) => [
            name,
            stops.map((color) => color.match(/[A-Fa-f0-9]{2}/g).map((channel) => parseInt(channel, 16))),
        ])
    );
    let activeColorMap = "Oranges";
    let currentDistanceRange = null;
    let heatmapContent = null;
    let heatmapViewport = null;
    let zoom = 1;
    let panX = 0;
    let panY = 0;

    function resetHeatmapView() {
        zoom = 1;
        panX = 0;
        panY = 0;
        updateHeatmapScale();
    }

    resetViewButton.addEventListener("click", resetHeatmapView);

    function colorMapGradient(name) {
        return colorMapHexStops[name]
            .map((color, index, stops) => `${color} ${(index / (stops.length - 1)) * 100}%`)
            .join(", ");
    }

    colorOptions.querySelectorAll("button[data-colormap]").forEach((button) => {
        button.style.setProperty("--colormap-preview", colorMapGradient(button.dataset.colormap));
    });

    function updateHeatmapColors() {
        if (!currentDistanceRange) {
            return;
        }

        heatmapResult.querySelectorAll(".heatmap-table td[data-distance]").forEach((cell) => {
            const backgroundColor = colorForDistance(
                Number(cell.dataset.distance),
                currentDistanceRange.minimum,
                currentDistanceRange.maximum
            );
            cell.style.backgroundColor = backgroundColor;
            cell.style.color = textColorForBackground(backgroundColor);
        });
        const scale = heatmapResult.querySelector(".heatmap-legend-scale");
        if (scale) {
            scale.style.backgroundImage = `linear-gradient(90deg, ${colorMapGradient(activeColorMap)})`;
        }
        const legend = heatmapResult.querySelector(".heatmap-legend");
        if (legend) {
            legend.setAttribute(
                "aria-label",
                `Color gradient showing smaller distances on the left and larger distances on the right, using ${activeColorMap}.`
            );
        }
    }

    colorOptions.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-colormap]");
        if (!button || !colorMaps[button.dataset.colormap]) {
            return;
        }

        activeColorMap = button.dataset.colormap;
        colorOptions.querySelectorAll("button[data-colormap]").forEach((option) => {
            option.setAttribute("aria-pressed", String(option === button));
        });
        colorSelector.open = false;
        updateHeatmapColors();
    });

    function updateHeatmapScale() {
        if (!heatmapContent || !heatmapViewport || !heatmapViewport.clientWidth) {
            return;
        }

        const fitScale = Math.min(
            1,
            heatmapViewport.clientWidth / heatmapContent.offsetWidth,
            heatmapViewport.clientHeight / heatmapContent.offsetHeight
        );
        heatmapContent.style.transform =
            `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${fitScale * zoom})`;
    }

    const resizeObserver = new ResizeObserver(() => {
        panX = 0;
        panY = 0;
        updateHeatmapScale();
    });
    resizeObserver.observe(heatmapResult);

    document.addEventListener("graphchange", (event) => {
        resetViewButton.hidden = event.detail.graph !== "heat-map" || !heatmapContent;
        colorSelector.hidden = event.detail.graph !== "heat-map" || !heatmapContent;
        if (colorSelector.hidden) {
            colorSelector.open = false;
        }
        requestAnimationFrame(updateHeatmapScale);
    });

    function colorForDistance(distance, minDistance, maxDistance) {
        const ratio = maxDistance === minDistance
            ? 0.5
            : (distance - minDistance) / (maxDistance - minDistance);
        const stops = colorMaps[activeColorMap];
        const position = ratio * (stops.length - 1);
        const lowerIndex = Math.floor(position);
        const upperIndex = Math.min(lowerIndex + 1, stops.length - 1);
        const fraction = position - lowerIndex;
        const channels = stops[lowerIndex].map((channel, index) =>
            Math.round(channel + fraction * (stops[upperIndex][index] - channel))
        );
        return `rgb(${channels.join(", ")})`;
    }

    function textColorForBackground(backgroundColor) {
        const channels = backgroundColor.match(/\d+/g).map((channel) => Number(channel) / 255);
        const [red, green, blue] = channels.map((channel) =>
            channel <= 0.04045
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4
        );
        const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        return luminance >= 0.179 ? "#000" : "#fff";
    }

    window.graphRenderers = window.graphRenderers || {};
    window.graphRenderers["heat-map"] = {
        getColorMap() {
            return activeColorMap;
        },
        render(result) {
            const datasetCount = result.datasets.length;
            const matrix = Array.from(
                { length: datasetCount },
                () => Array(datasetCount).fill(0)
            );

            result.distances.forEach(({ indices, distance }) => {
                const [firstIndex, secondIndex] = indices;
                matrix[firstIndex][secondIndex] = distance;
                matrix[secondIndex][firstIndex] = distance;
            });

            const distances = result.distances.map(({ distance }) => distance);
            const minDistance = Math.min(...distances);
            const maxDistance = Math.max(...distances);
            currentDistanceRange = { minimum: minDistance, maximum: maxDistance };
            const table = document.createElement("table");
            table.className = "heatmap-table";
            table.setAttribute("aria-label", "Pairwise dataset distance matrix");

            const head = document.createElement("thead");
            const headerRow = document.createElement("tr");
            const corner = document.createElement("th");
            corner.scope = "col";
            corner.textContent = "Dataset";
            headerRow.append(corner);
            result.datasets.forEach((dataset) => {
                const header = document.createElement("th");
                header.scope = "col";
                header.textContent = dataset.name;
                headerRow.append(header);
            });
            head.append(headerRow);
            table.append(head);

            const body = document.createElement("tbody");
            result.datasets.forEach((dataset, rowIndex) => {
                const row = document.createElement("tr");
                const rowHeader = document.createElement("th");
                rowHeader.scope = "row";
                rowHeader.textContent = dataset.name;
                row.append(rowHeader);

                result.datasets.forEach((columnDataset, columnIndex) => {
                    const cell = document.createElement("td");
                    const distance = matrix[rowIndex][columnIndex];
                    cell.textContent = distance.toFixed(3);
                    cell.title = `${dataset.name} / ${columnDataset.name}: ${distance}`;
                    if (rowIndex === columnIndex) {
                        cell.className = "heatmap-diagonal";
                    } else {
                        cell.dataset.distance = String(distance);
                        const backgroundColor = colorForDistance(
                            distance,
                            minDistance,
                            maxDistance
                        );
                        cell.style.backgroundColor = backgroundColor;
                        cell.style.color = textColorForBackground(backgroundColor);
                    }
                    row.append(cell);
                });
                body.append(row);
            });
            table.append(body);

            const legend = document.createElement("div");
            legend.className = "heatmap-legend";
            legend.setAttribute("aria-label", "Blue indicates smaller distance; red indicates larger distance.");
            const lowLabel = document.createElement("span");
            lowLabel.textContent = `Smaller distance (${minDistance.toFixed(3)})`;
            const scale = document.createElement("span");
            scale.className = "heatmap-legend-scale";
            scale.style.backgroundImage = `linear-gradient(90deg, ${colorMapGradient(activeColorMap)})`;
            const highLabel = document.createElement("span");
            highLabel.textContent = `Larger distance (${maxDistance.toFixed(3)})`;
            legend.append(lowLabel, scale, highLabel);
            legend.setAttribute(
                "aria-label",
                `Color gradient showing smaller distances on the left and larger distances on the right, using ${activeColorMap}.`
            );

            const viewport = document.createElement("div");
            viewport.className = "heatmap-viewport";
            viewport.setAttribute("role", "region");
            viewport.setAttribute(
                "aria-label",
                "Heatmap. Use the mouse wheel to zoom and hold the left mouse button to move."
            );
            const content = document.createElement("div");
            content.className = "heatmap-content";
            content.append(table, legend);
            const zoomHint = document.createElement("span");
            zoomHint.className = "heatmap-zoom-hint";
            zoomHint.textContent = "Wheel: zoom · Hold left click: move";
            heatmapResult.replaceChildren(zoomHint, viewport);
            viewport.append(content);
            heatmapViewport = viewport;
            heatmapContent = content;
            zoom = 1;
            panX = 0;
            panY = 0;
            resetViewButton.hidden = graphPreview.dataset.currentGraph !== "heat-map";
            colorSelector.hidden = graphPreview.dataset.currentGraph !== "heat-map";

            let dragStart = null;
            viewport.addEventListener("pointerdown", (event) => {
                if (event.button !== 0) {
                    return;
                }

                dragStart = {
                    pointerId: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                    panX,
                    panY,
                };
                viewport.setPointerCapture(event.pointerId);
                viewport.classList.add("is-dragging");
                event.preventDefault();
            });
            viewport.addEventListener("pointermove", (event) => {
                if (!dragStart || event.pointerId !== dragStart.pointerId) {
                    return;
                }

                panX = dragStart.panX + event.clientX - dragStart.x;
                panY = dragStart.panY + event.clientY - dragStart.y;
                updateHeatmapScale();
            });
            function endDrag(event) {
                if (!dragStart || event.pointerId !== dragStart.pointerId) {
                    return;
                }

                if (viewport.hasPointerCapture(event.pointerId)) {
                    viewport.releasePointerCapture(event.pointerId);
                }
                dragStart = null;
                viewport.classList.remove("is-dragging");
            }
            viewport.addEventListener("pointerup", endDrag);
            viewport.addEventListener("pointercancel", endDrag);

            viewport.addEventListener("wheel", (event) => {
                event.preventDefault();
                const nextZoom = Math.min(4, Math.max(0.5, zoom * Math.exp(-event.deltaY * 0.002)));
                const zoomRatio = nextZoom / zoom;
                const bounds = viewport.getBoundingClientRect();
                const pointerX = event.clientX - bounds.left - bounds.width / 2;
                const pointerY = event.clientY - bounds.top - bounds.height / 2;
                panX = pointerX * (1 - zoomRatio) + panX * zoomRatio;
                panY = pointerY * (1 - zoomRatio) + panY * zoomRatio;
                zoom = nextZoom;
                updateHeatmapScale();
            }, { passive: false });

            heatmapPlaceholder.hidden = true;
            heatmapResult.hidden = false;
            requestAnimationFrame(updateHeatmapScale);
        },
    };
})();
