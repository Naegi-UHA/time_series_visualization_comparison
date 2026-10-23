(function () {
    const mapPlaceholder = document.getElementById("map-placeholder");
    const mapResult = document.getElementById("dataset-map-result");

    window.graphRenderers = window.graphRenderers || {};
    window.graphRenderers["dataset-map"] = {
        render(result, selectedSets) {
            const xValues = result.datasets.map((dataset) => dataset.x);
            const yValues = result.datasets.map((dataset) => dataset.y);
            const minX = Math.min(...xValues);
            const maxX = Math.max(...xValues);
            const minY = Math.min(...yValues);
            const maxY = Math.max(...yValues);
            const spreadX = maxX - minX || 1;
            const spreadY = maxY - minY || 1;

            mapResult.replaceChildren();
            result.datasets.forEach((dataset, index) => {
                const point = document.createElement("div");
                point.className = `map-point ${index % 2 === 0 ? "map-point-a" : "map-point-b"}`;
                const sourceDataset = selectedSets[index];
                const color = sourceDataset.dataset.color;
                if (color) {
                    point.style.backgroundColor = color;
                }
                point.dataset.datasetId = sourceDataset.dataset.datasetId;
                point.style.left = `${15 + ((dataset.x - minX) / spreadX) * 70}%`;
                point.style.top = `${85 - ((dataset.y - minY) / spreadY) * 70}%`;
                point.title = dataset.name;

                const label = document.createElement("span");
                label.className = "map-point-label";
                label.textContent = dataset.name;
                point.append(label);
                mapResult.append(point);
            });

            mapPlaceholder.hidden = true;
            mapResult.hidden = false;
        },
    };
})();
