const graphOptions = document.querySelector(".graph-options");
const graphTitle = document.getElementById("graph-title");
const currentGraph = document.getElementById("current-graph");
const graphPreview = document.getElementById("graph-preview");

graphOptions.addEventListener("click", (event) => {
    if (event.target.matches("button")) {
        const graph = event.target.textContent;
        graphTitle.textContent = graph;
        currentGraph.textContent = `Current graph : ${graph}`;
        graphPreview.hidden = graph !== "Dataset Map";
        graphOptions.closest(".graph-selector").open = false;
    }
});
