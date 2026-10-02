const uploadInput = document.getElementById("dataset-upload");
const datasetList = document.getElementById("dataset-list");

uploadInput.addEventListener("change", () => {
    for (const file of uploadInput.files) {
        const row = document.createElement("label");
        row.className = "dataset-row";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";

        const name = document.createElement("span");
        name.textContent = file.name;

        row.append(checkbox, name);
        datasetList.append(row);
    }
    uploadInput.value = "";
});