(function () {
    const datasetList = document.getElementById("dataset-list");

    datasetList.addEventListener("click", (event) => {
        const nameButton = event.target.closest(".dataset-name");
        if (!nameButton) {
            return;
        }

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
    });
})();
