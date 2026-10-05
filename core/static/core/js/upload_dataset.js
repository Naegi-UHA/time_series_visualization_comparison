const uploadInput = document.getElementById("dataset-upload");
const datasetList = document.getElementById("dataset-list");
const importStatus = document.getElementById("import-status");

function parseDataset(text) {
    const rows = text.split(/\r?\n/).filter((line) => line.trim());
    let expectedValueCount = null;

    return rows.map((line, index) => {
        const [label, ...values] = line.trim().split(/\s+/);
        const series = values.map(Number);

        if (!label || series.length === 0 || series.some((value) => !Number.isFinite(value))) {
            throw new Error(`Ligne ${index + 1} invalide.`);
        }
        if (expectedValueCount !== null && series.length !== expectedValueCount) {
            throw new Error(`La ligne ${index + 1} n'a pas le même nombre de valeurs que les autres.`);
        }

        expectedValueCount = series.length;
        return { label, series };
    });
}

uploadInput.addEventListener("change", async () => {
    const file = uploadInput.files[0];
    if (!file) {
        return;
    }

    try {
        const data = parseDataset(await file.text());
        const filename = file.name.replace(/\.[^.]+$/, "");

        datasetList.replaceChildren();
        data.forEach(({ label: classLabel, series }, index) => {
            const row = document.createElement("label");
            row.className = "dataset-row";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = `${filename}_${index + 1}`;
            checkbox.dataset.classLabel = classLabel;
            checkbox.dataset.series = JSON.stringify(series);

            const name = document.createElement("span");
            name.textContent = checkbox.value;

            row.append(checkbox, name);
            datasetList.append(row);
        });

        importStatus.hidden = true;
        importStatus.textContent = "";
    } catch (error) {
        importStatus.textContent = `Import impossible : ${error.message}`;
        importStatus.hidden = false;
    } finally {
        uploadInput.value = "";
    }
});