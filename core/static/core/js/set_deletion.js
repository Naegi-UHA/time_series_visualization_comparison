(function () {
    const datasetList = document.getElementById("dataset-list");

    datasetList.addEventListener("click", (event) => {
        if (event.target.matches(".delete-set-button")) {
            event.target.closest(".dataset-row").remove();
        }
    });
})();
