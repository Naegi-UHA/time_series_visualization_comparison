const graphOptions = document.querySelector(".graph-options");
const graphTitle = document.getElementById("graph-title");
const currentGraph = document.getElementById("current-graph");
const graphPreview = document.getElementById("graph-preview");

graphOptions.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-graph]");
    if (button) {
        const graph = button.dataset.graph;
        const title = button.textContent.trim();
        graphTitle.textContent = title;
        currentGraph.textContent = `Current graph : ${title}`;
        graphPreview.dataset.currentGraph = graph;
        graphPreview.querySelectorAll("[data-graph-view]").forEach((view) => {
            view.hidden = view.dataset.graphView !== graph;
        });
        graphOptions.closest(".graph-selector").open = false;
        document.dispatchEvent(new CustomEvent("graphchange", { detail: { graph } }));
    }
});
