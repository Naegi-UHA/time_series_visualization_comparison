(function () {
    const exportButton = document.getElementById("export-button");
    const comparisonStatus = document.getElementById("comparison-status");
    let latestResult = null;
    let latestSelectedSets = [];
    let exportWindow = null;

    document.addEventListener("comparisoncomplete", (event) => {
        latestResult = event.detail.result;
        latestSelectedSets = event.detail.selectedSets;
        exportButton.disabled = false;
    });

    exportButton.addEventListener("click", () => {
        exportWindow = window.open(
            exportButton.dataset.url,
            "dataset-comparison-export",
            "popup,width=520,height=460,resizable=yes"
        );
        if (!exportWindow) {
            comparisonStatus.textContent = "The export window was blocked by the browser.";
        }
    });

    window.addEventListener("message", (event) => {
        if (
            event.origin !== window.location.origin
            || event.source !== exportWindow
            || event.data?.type !== "request-export-data"
            || !latestResult
        ) {
            return;
        }

        const result = {
            ...latestResult,
            datasets: latestResult.datasets.map((dataset, index) => ({
                ...dataset,
                name: latestSelectedSets[index].value,
            })),
        };
        exportWindow.postMessage({ type: "export-data", result }, window.location.origin);
    });
})();
