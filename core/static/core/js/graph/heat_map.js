(function () {
    const heatmapPlaceholder = document.getElementById("heatmap-placeholder");
    const heatmapResult = document.getElementById("heatmap-result");
    const resetViewButton = document.getElementById("heatmap-reset-view");
    const graphPreview = document.getElementById("graph-preview");
    const lowColor = [69, 117, 180];
    const highColor = [215, 48, 39];
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
        requestAnimationFrame(updateHeatmapScale);
    });

    function colorForDistance(distance, minDistance, maxDistance) {
        const ratio = maxDistance === minDistance
            ? 0.5
            : (distance - minDistance) / (maxDistance - minDistance);
        const channels = lowColor.map((channel, index) =>
            Math.round(channel + ratio * (highColor[index] - channel))
        );
        return `rgb(${channels.join(", ")})`;
    }

    window.graphRenderers = window.graphRenderers || {};
    window.graphRenderers["heat-map"] = {
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
                        cell.style.backgroundColor = colorForDistance(
                            distance,
                            minDistance,
                            maxDistance
                        );
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
            const highLabel = document.createElement("span");
            highLabel.textContent = `Larger distance (${maxDistance.toFixed(3)})`;
            legend.append(lowLabel, scale, highLabel);

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
