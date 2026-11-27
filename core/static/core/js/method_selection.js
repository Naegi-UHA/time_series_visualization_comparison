(function () {
    const methodControl = document.querySelector(".method-control");
    const trigger = document.getElementById("method-settings-trigger");
    const panel = document.getElementById("method-settings-panel");
    const form = document.getElementById("method-settings-form");
    const currentMethod = document.getElementById("current-method");
    const strategySelect = document.getElementById("representative-method");
    const distanceSelect = document.getElementById("distance-method");
    const strategyDescription = document.getElementById("representative-method-description");
    const distanceParameters = document.getElementById("distance-parameters");
    const closeButton = document.getElementById("method-settings-close");
    const cancelButton = document.getElementById("method-settings-cancel");
    const strategyLabels = {
        eba: "EBA",
        medoid: "Medoid",
        subgradient: "Subgradient",
        pairwise_mean: "Pairwise mean",
    };
    const strategyDescriptions = {
        eba: "Builds one elastic barycenter for each dataset dimension; series in each dimension must have equal lengths.",
        medoid: "Uses the existing series with the smallest total distance as each dimension's representative.",
        subgradient: "Builds one barycenter per dimension using subgradient updates; series in each dimension must have equal lengths.",
        pairwise_mean: "Keeps the original calculation: the mean distance across all series and dimension pairs.",
    };
    const derivativeDistances = new Set(["ddtw", "wddtw"]);
    const optionalWindow = {
        name: "window",
        label: "Window (0-1)",
        type: "number",
        min: 0,
        max: 1,
        step: 0.01,
        optional: true,
    };
    const optionalSlope = {
        name: "itakura_max_slope",
        label: "Slope (0-1)",
        type: "number",
        min: 0,
        max: 1,
        step: 0.01,
        optional: true,
    };
    const distanceFieldDefinitions = {
        dtw: [optionalWindow, optionalSlope],
        dtw_gi: [optionalWindow, optionalSlope],
        shape_dtw: [optionalWindow, optionalSlope],
        ddtw: [optionalWindow, optionalSlope],
        wdtw: [optionalWindow, optionalSlope],
        wddtw: [optionalWindow, optionalSlope],
        adtw: [optionalWindow, optionalSlope],
        soft_dtw: [optionalWindow, optionalSlope],
        msm: [optionalWindow, optionalSlope],
        twe: [optionalWindow, optionalSlope],
    };

    let activeSettings = {
        strategy: "eba",
        distance: "dtw",
        distance_parameters: {},
    };

    function renderFields(container, definitions, values) {
        container.replaceChildren();
        if (!definitions.length) {
            container.textContent = "No additional parameters.";
            return;
        }

        definitions.forEach((definition) => {
            const label = document.createElement("label");
            label.className = "method-settings-field";
            if (definition.type === "checkbox") {
                label.classList.add("is-checkbox");
            }

            const caption = document.createElement("span");
            caption.textContent = definition.label;
            label.append(caption);

            const input = document.createElement("input");
            input.id = `method-parameter-${definition.name}`;
            input.name = definition.name;
            input.type = definition.type;
            input.dataset.parameterName = definition.name;
            if (definition.type === "checkbox") {
                input.checked = values[definition.name] ?? definition.value;
            } else {
                input.min = String(definition.min);
                input.step = String(definition.step);
                if (definition.max !== undefined) {
                    input.max = String(definition.max);
                }
                input.required = !definition.optional;
                input.placeholder = definition.optional ? "Aeon default" : "";
                const value = values[definition.name] ?? definition.value;
                input.value = value === undefined ? "" : String(value);
            }
            label.append(input);
            container.append(label);
        });
    }

    function updateStrategyForDistance() {
        const requestedStrategy = strategySelect.value;
        const distance = distanceSelect.value;
        if (distance === "dtw_gi" && ["eba", "subgradient"].includes(requestedStrategy)) {
            strategySelect.value = "medoid";
            strategyDescription.textContent =
                "Aeon does not support DTW_GI barycenters; Medoid is selected automatically.";
        } else if (derivativeDistances.has(distance) && requestedStrategy === "eba") {
            strategySelect.value = "subgradient";
            strategyDescription.textContent =
                `EBA produces invalid ${distance.toUpperCase()} barycenters; Subgradient is selected automatically.`;
        } else if (distance === "dtw_gi" && strategySelect.value === "medoid") {
            strategyDescription.textContent =
                "DTW_GI uses Medoid because Aeon does not support it in barycenter routines.";
        } else {
            strategyDescription.textContent = strategyDescriptions[strategySelect.value];
        }
    }

    function renderParameterFields(settings) {
        updateStrategyForDistance();
        const distance = distanceSelect.value;
        renderFields(
            distanceParameters,
            distanceFieldDefinitions[distance],
            settings.distance_parameters || {}
        );
    }

    function openPanel() {
        const settings = JSON.parse(JSON.stringify(activeSettings));
        strategySelect.value = settings.strategy;
        distanceSelect.value = settings.distance;
        renderParameterFields(settings);
        panel.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        methodControl.classList.add("is-open");
    }

    function closePanel() {
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
        methodControl.classList.remove("is-open");
    }

    function readParameters(container, definitions) {
        const values = {};
        definitions.forEach((definition) => {
            const input = container.querySelector(`[name="${definition.name}"]`);
            if (definition.type === "checkbox") {
                values[definition.name] = input.checked;
            } else if (input.value !== "") {
                values[definition.name] = input.valueAsNumber;
            }
        });
        return values;
    }

    function applySettings() {
        if (!form.reportValidity()) {
            return;
        }

        updateStrategyForDistance();
        const strategy = strategySelect.value;
        const distance = distanceSelect.value;
        activeSettings = {
            strategy,
            distance,
            distance_parameters: readParameters(
                distanceParameters,
                distanceFieldDefinitions[distance]
            ),
        };
        currentMethod.dataset.method = distance;
        currentMethod.dataset.strategy = strategy;
        currentMethod.dataset.settings = JSON.stringify(activeSettings);
        currentMethod.textContent =
            `current method : ${strategyLabels[strategy]} + ${distance.toUpperCase()}`;
        closePanel();
    }

    trigger.addEventListener("click", () => {
        if (panel.hidden) {
            openPanel();
        } else {
            closePanel();
        }
    });
    strategySelect.addEventListener("change", () => {
        updateStrategyForDistance();
    });
    distanceSelect.addEventListener("change", () => {
        renderParameterFields({ distance_parameters: {} });
    });
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        applySettings();
    });
    closeButton.addEventListener("click", closePanel);
    cancelButton.addEventListener("click", closePanel);
    document.addEventListener("pointerdown", (event) => {
        if (
            !panel.hidden
            && !panel.contains(event.target)
            && !trigger.contains(event.target)
        ) {
            closePanel();
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !panel.hidden) {
            closePanel();
        }
    });

    currentMethod.dataset.settings = JSON.stringify(activeSettings);
    renderParameterFields(activeSettings);
})();
