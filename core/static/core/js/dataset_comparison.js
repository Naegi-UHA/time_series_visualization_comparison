(function () {
    const compareButton = document.getElementById("compare-button");
    const datasetList = document.getElementById("dataset-list");
    const currentMethod = document.getElementById("current-method");
    const comparisonStatus = document.getElementById("comparison-status");
    const graphPreview = document.getElementById("graph-preview");
    const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]").value;
    let latestResult = null;
    let latestSelectedSets = [];

    function renderCurrentGraph() {
        const graph = graphPreview.dataset.currentGraph;
        const renderer = window.graphRenderers && window.graphRenderers[graph];
        if (latestResult && renderer) {
            const resultWithCurrentNames = {
                ...latestResult,
                datasets: latestResult.datasets.map((dataset, index) => ({
                    ...dataset,
                    name: latestSelectedSets[index].value,
                })),
            };
            renderer.render(resultWithCurrentNames, latestSelectedSets);
        }
    }

    document.addEventListener("graphchange", renderCurrentGraph);
    document.addEventListener("datasetrename", renderCurrentGraph);

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

            latestResult = result;
            latestSelectedSets = selectedSets;
            renderCurrentGraph();
            comparisonStatus.textContent =
                `${result.datasets.length} datasets compared using ${result.method.toUpperCase()}.`;
        } catch (error) {
            comparisonStatus.textContent = `Comparison failed: ${error.message}`;
        } finally {
            compareButton.disabled = false;
        }
    });
})();
