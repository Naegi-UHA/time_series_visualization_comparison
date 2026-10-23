(function () {
    const heatmapPlaceholder = document.getElementById("heatmap-placeholder");
    const heatmapResult = document.getElementById("heatmap-result");
    const lowColor = [69, 117, 180];
    const highColor = [215, 48, 39];

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

            heatmapResult.replaceChildren(table, legend);
            heatmapPlaceholder.hidden = true;
            heatmapResult.hidden = false;
        },
    };
})();
