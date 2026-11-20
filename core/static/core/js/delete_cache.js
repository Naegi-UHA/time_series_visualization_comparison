(function () {
    const deleteCacheButton = document.getElementById("delete-cache-button");

    deleteCacheButton.addEventListener("click", () => {
        document.dispatchEvent(new Event("comparisoncacheclear"));
    });
})();
