const uploadInput = document.getElementById("dataset-upload");
const datasetList = document.getElementById("dataset-list");
const importStatus = document.getElementById("import-status");
const pastelColors = [
    "#F4A6A6", "#F3C08B", "#F2DD8C", "#B9D9A0", "#8FD3C1", "#9CCBE8", "#B7B1E6", "#E4A9D4",
    "#E98989", "#EFA96B", "#E6CD64", "#9DC97A", "#69BFA8", "#79B8DE", "#9B91D4", "#D77CBF",
    "#D96B75", "#D98C55", "#C6A94F", "#78A95E", "#4A9B83", "#558FB8", "#7769AF", "#B45D9A",
];
let nextDatasetId = 0;

function getAvailableDatasetColor() {
    const usedColors = new Set(
        [...datasetList.querySelectorAll('input[type="checkbox"]')]
            .map((checkbox) => checkbox.dataset.color)
            .filter(Boolean)
            .map((color) => color.toUpperCase())
    );
    return pastelColors.find((color) => !usedColors.has(color.toUpperCase())) || pastelColors[0];
}

datasetList.addEventListener("click", (event) => {
    const nameButton = event.target.closest(".dataset-name");
    if (nameButton) {
        const checkbox = nameButton.closest(".dataset-row").querySelector('input[type="checkbox"]');
        const input = document.createElement("input");
        input.type = "text";
        input.className = "dataset-name-input";
        input.value = checkbox.value;
        input.setAttribute("aria-label", `Modifier le nom de ${checkbox.value}`);
        nameButton.replaceWith(input);
        input.focus();
        input.select();

        const finishEditing = (save) => {
            if (!input.isConnected) {
                return;
            }

            const newName = input.value.trim();
            const name = save && newName ? newName : checkbox.value;
            checkbox.value = name;

            const replacement = document.createElement("button");
            replacement.type = "button";
            replacement.className = "dataset-name";
            replacement.textContent = name;
            replacement.setAttribute("aria-label", `Modifier le nom de ${name}`);
            input.replaceWith(replacement);

            const row = replacement.closest(".dataset-row");
            row.querySelector(".color-picker-toggle").setAttribute(
                "aria-label",
                `Customize color for ${name}`
            );
            row.querySelector(".delete-set-button").setAttribute(
                "aria-label",
                `Supprimer ${name}`
            );

            if (save) {
                document.dispatchEvent(new CustomEvent("datasetrename"));
            }
        };

        input.addEventListener("keydown", (keyEvent) => {
            if (keyEvent.key === "Enter") {
                keyEvent.preventDefault();
                finishEditing(true);
            } else if (keyEvent.key === "Escape") {
                finishEditing(false);
            }
        });
        input.addEventListener("blur", () => finishEditing(true));
        return;
    }

    const button = event.target.closest(".color-picker-toggle, .color-swatch, .color-apply-button");
    if (!button) {
        return;
    }

    const row = button.closest(".dataset-row");
    const colorButton = row.querySelector(".color-picker-toggle");
    const colorEditor = row.querySelector(".color-editor");
    const checkbox = row.querySelector('input[type="checkbox"]');

    if (button.matches(".color-picker-toggle")) {
        colorEditor.hidden = !colorEditor.hidden;
        colorButton.setAttribute("aria-expanded", String(!colorEditor.hidden));
        if (!colorEditor.hidden) {
            const selectedColor = checkbox.dataset.color || "";
            checkbox.dataset.pendingColor = selectedColor;
            colorEditor.querySelectorAll(".color-swatch").forEach((swatch) => {
                const selected = swatch.dataset.color === selectedColor;
                swatch.classList.toggle("selected", selected);
                swatch.setAttribute("aria-pressed", String(selected));
            });
        }
        return;
    }

    if (button.matches(".color-swatch")) {
        checkbox.dataset.pendingColor = button.dataset.color;
        colorEditor.querySelectorAll(".color-swatch").forEach((swatch) => {
            const selected = swatch === button;
            swatch.classList.toggle("selected", selected);
            swatch.setAttribute("aria-pressed", String(selected));
        });
        return;
    }

    const color = checkbox.dataset.pendingColor;
    if (color) {
        checkbox.dataset.color = color;
        colorButton.style.setProperty("--selected-color", color);
        document.querySelectorAll("#dataset-map-result .map-point").forEach((point) => {
            if (point.dataset.datasetId === checkbox.dataset.datasetId) {
                point.style.backgroundColor = color;
            }
        });
    }
    colorEditor.hidden = true;
    colorButton.setAttribute("aria-expanded", "false");
});

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
        const datasetColor = getAvailableDatasetColor();

        const row = document.createElement("div");
        row.className = "dataset-row";

        const setLabel = document.createElement("div");
        setLabel.className = "dataset-label";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = filename;
        checkbox.dataset.series = JSON.stringify(data);
        checkbox.dataset.datasetId = String(nextDatasetId++);
        checkbox.dataset.color = datasetColor;

        const name = document.createElement("button");
        name.type = "button";
        name.className = "dataset-name";
        name.textContent = filename;
        name.setAttribute("aria-label", `Modifier le nom de ${filename}`);

        const actions = document.createElement("div");
        actions.className = "dataset-actions";

        const colorButton = document.createElement("button");
        colorButton.type = "button";
        colorButton.className = "color-picker-toggle";
        colorButton.style.setProperty("--selected-color", datasetColor);
        colorButton.setAttribute("aria-label", `Customize color for ${filename}`);
        colorButton.setAttribute("aria-expanded", "false");
        colorButton.textContent = "Color";

        const colorEditor = document.createElement("div");
        colorEditor.className = "color-editor";
        colorEditor.hidden = true;

        const palette = document.createElement("div");
        palette.className = "color-palette";
        pastelColors.forEach((color, index) => {
            const swatch = document.createElement("button");
            swatch.type = "button";
            swatch.className = "color-swatch";
            swatch.dataset.color = color;
            swatch.style.setProperty("--swatch-color", color);
            swatch.setAttribute("aria-label", `Pastel color ${index + 1}`);
            swatch.setAttribute("aria-pressed", "false");
            swatch.title = color;
            palette.append(swatch);
        });
        colorEditor.append(palette);

        const applyColorButton = document.createElement("button");
        applyColorButton.type = "button";
        applyColorButton.className = "color-apply-button";
        applyColorButton.textContent = "Apply";
        colorEditor.append(applyColorButton);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-set-button";
        deleteButton.setAttribute("aria-label", `Supprimer ${filename}`);
        deleteButton.textContent = "×";

        setLabel.append(checkbox, name);
        actions.append(colorButton, deleteButton);
        row.append(setLabel, actions, colorEditor);
        datasetList.append(row);

        importStatus.hidden = true;
        importStatus.textContent = "";
    } catch (error) {
        importStatus.textContent = `Import impossible : ${error.message}`;
        importStatus.hidden = false;
    } finally {
        uploadInput.value = "";
    }
});