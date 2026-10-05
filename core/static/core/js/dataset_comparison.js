(function () {
    const compareButton = document.getElementById("compare-button");
    const datasetList = document.getElementById("dataset-list");
    const currentMethod = document.getElementById("current-method");
    const comparisonStatus = document.getElementById("comparison-status");
    const mapPlaceholder = document.getElementById("map-placeholder");
    const mapResult = document.getElementById("dataset-map-result");
    const mapDistanceLine = document.getElementById("map-distance-line");
    const mapPointA = document.getElementById("map-point-a");
    const mapPointB = document.getElementById("map-point-b");
    const mapDistanceLabel = document.getElementById("map-distance-label");
    const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]").value;

    compareButton.addEventListener("click", async () => {
        const selectedSets = [...datasetList.querySelectorAll("input[type=checkbox]:checked")];
        if (selectedSets.length !== 2) {
            comparisonStatus.textContent = "Please select exactly two datasets.";
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

            const gap = Math.min(80, 12 + Math.log1p(result.distance) * 12);
            const firstPoint = (100 - gap) / 2;
            const secondPoint = firstPoint + gap;

            mapDistanceLine.style.left = `${firstPoint}%`;
            mapDistanceLine.style.width = `${gap}%`;
            mapPointA.style.left = `${firstPoint}%`;
            mapPointA.querySelector(".map-point-label").textContent = result.datasets[0];
            mapPointB.style.left = `${secondPoint}%`;
            mapPointB.querySelector(".map-point-label").textContent = result.datasets[1];
            mapDistanceLabel.textContent = `${result.method.toUpperCase()} distance: ${result.distance.toFixed(4)}`;

            mapPlaceholder.hidden = true;
            mapResult.hidden = false;
            comparisonStatus.textContent = "Comparison complete.";
        } catch (error) {
            comparisonStatus.textContent = `Comparison failed: ${error.message}`;
        } finally {
            compareButton.disabled = false;
        }
    });
})();
