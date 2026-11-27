(function () {
    const datasetList = document.getElementById("dataset-list");

    datasetList.addEventListener("click", (event) => {
        const editButton = event.target.closest(".dataset-name-edit");
        if (!editButton) {
            return;
        }

        const row = editButton.closest(".dataset-row");
        const checkbox = row.querySelector('input[type="checkbox"]');
        const nameElement = row.querySelector(".dataset-name");
        if (!nameElement) {
            return;
        }
        const input = document.createElement("input");
        input.type = "text";
        input.className = "dataset-name-input";
        input.value = checkbox.value;
        input.setAttribute("aria-label", `Modifier le nom de ${checkbox.value}`);
        editButton.disabled = true;
        nameElement.replaceWith(input);
        input.focus();
        input.select();

        const finishEditing = (save) => {
            if (!input.isConnected) {
                return;
            }

            const newName = input.value.trim();
            const name = save && newName ? newName : checkbox.value;
            checkbox.value = name;

            const replacement = document.createElement("span");
            replacement.className = "dataset-name";
            replacement.textContent = name;
            input.replaceWith(replacement);

            const row = replacement.closest(".dataset-row");
            const editButton = row.querySelector(".dataset-name-edit");
            editButton.disabled = false;
            editButton.setAttribute("aria-label", `Rename ${name}`);
            editButton.title = `Rename ${name}`;
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
    });
})();
