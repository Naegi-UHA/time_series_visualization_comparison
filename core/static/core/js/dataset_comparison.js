(function () {
    const compareButton = document.getElementById("compare-button");
    const datasetList = document.getElementById("dataset-list");
    const currentMethod = document.getElementById("current-method");
    const comparisonStatus = document.getElementById("comparison-status");
    const mapPlaceholder = document.getElementById("map-placeholder");
    const mapResult = document.getElementById("dataset-map-result");
    const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]").value;

    compareButton.addEventListener("click", async () => {
        const selectedSets = [...datasetList.querySelectorAll("input[type=checkbox]:checked")];
        if (selectedSets.length < 2) {
            comparisonStatus.textContent = "Please select at least two datasets.";
            return;
        }

        const datasets = selectedSets.map((checkbox) => ({
            name: checkbox.value,
            series: JSON.parse(checkbox.dataset.series),
        }));

        compareButton.disabled = true;
        comparisonStatus.textContent = "Calculating distance...";

        try {
            const response = await fetch(compareButton.dataset.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken,
                },
                body: JSON.stringify({
                    method: currentMethod.dataset.method,
                    datasets,
                }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "The comparison could not be completed.");
            }

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
            comparisonStatus.textContent =
                `${result.datasets.length} datasets compared using ${result.method.toUpperCase()}.`;
        } catch (error) {
            comparisonStatus.textContent = `Comparison failed: ${error.message}`;
        } finally {
            compareButton.disabled = false;
        }
    });
})();
