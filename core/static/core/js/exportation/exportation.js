(function () {
    const formatOptions = document.querySelector(".export-format-selector .graph-options");
    const currentFormat = document.getElementById("current-export-format");
    const downloadButton = document.getElementById("export-download-button");
    const exportStatus = document.getElementById("export-status");
    let filenameInput = document.getElementById("export-filename");
    const formatControl = document.querySelector(".export-format-control");
    const csrfTokenInput = document.querySelector("[name=csrfmiddlewaretoken]");
    const csrfCookie = document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith("csrftoken="))
        ?.slice("csrftoken=".length);
    const csrfToken = csrfTokenInput?.value || csrfCookie;
    let selectedFormat = "csv";
    let comparisonResult = null;

    if (!filenameInput) {
        const label = document.createElement("label");
        label.className = "export-filename-control";
        label.htmlFor = "export-filename";
        label.append("File name");

        filenameInput = document.createElement("input");
        filenameInput.id = "export-filename";
        filenameInput.name = "filename";
        filenameInput.type = "text";
        filenameInput.value = "dataset-comparison";
        filenameInput.maxLength = 120;
        filenameInput.autocomplete = "off";
        filenameInput.required = true;
        label.append(filenameInput);

        const hint = document.createElement("span");
        hint.textContent = "The selected format extension will be added automatically.";
        label.append(hint);
        formatControl.before(label);
    }

    function receiveComparison(result) {
        if (
            !result
            || !Array.isArray(result.datasets)
            || result.datasets.length < 2
            || !Array.isArray(result.distances)
            || typeof result.method !== "string"
        ) {
            exportStatus.textContent = "The comparison data is invalid.";
            downloadButton.disabled = true;
            return;
        }

        comparisonResult = result;
        downloadButton.disabled = false;
        exportStatus.textContent = "Comparison data ready to export.";
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function getExportFilename() {
        const baseName = filenameInput.value
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
            .trim()
            .replace(/[. ]+$/g, "")
            .replace(/\.(csv|ods|pdf|tex)$/i, "")
            .trim();
        if (!baseName) {
            throw new Error("Enter a valid file name.");
        }
        const extensions = {
            "pdf-graph": "pdf",
            "latex-report": "pdf",
        };
        const extension = extensions[selectedFormat] || selectedFormat;
        return `${baseName}.${extension}`;
    }

    formatOptions.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-format]");
        if (!button) {
            return;
        }
        selectedFormat = button.dataset.format;
        const formatLabels = {
            "pdf-graph": ".pdf : only graph",
            "latex-report": "LaTeX report (.pdf)",
        };
        const formatLabel = formatLabels[selectedFormat] || `.${selectedFormat}`;
        currentFormat.textContent = `Current format: ${formatLabel}`;
        formatOptions.closest(".export-format-selector").open = false;
    });

    window.addEventListener("message", (event) => {
        if (
            event.origin !== window.location.origin
            || event.source !== window.opener
            || event.data?.type !== "export-data"
        ) {
            return;
        }
        receiveComparison(event.data.result);
    });

    window.addEventListener("load", () => {
        if (window.opener) {
            window.opener.postMessage(
                { type: "request-export-data" },
                window.location.origin
            );
        } else {
            exportStatus.textContent = "Open this window from the comparison page to export data.";
        }
    });

    downloadButton.addEventListener("click", async () => {
        if (!comparisonResult) {
            return;
        }

        downloadButton.disabled = true;
        exportStatus.textContent = "Preparing your export...";
        try {
            const filename = getExportFilename();
            if (selectedFormat === "csv") {
                const csv = window.comparisonCsv.buildComparisonCsv(comparisonResult);
                downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
            } else if (selectedFormat === "pdf-graph") {
                await window.comparisonPdfGraph.download(comparisonResult, {
                    url: downloadButton.dataset.pdfUrl,
                    csrfToken,
                    filename,
                });
            } else if (selectedFormat === "latex-report") {
                await window.comparisonLatexReport.download(comparisonResult, {
                    url: downloadButton.dataset.latexUrl,
                    csrfToken,
                    filename,
                });
            } else {
                if (!csrfToken) {
                    throw new Error("Security token unavailable. Reload the export window and try again.");
                }
                const response = await fetch(downloadButton.dataset.url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": csrfToken,
                    },
                    body: JSON.stringify(comparisonResult),
                });
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || "The ODS export could not be created.");
                }
                downloadBlob(await response.blob(), filename);
            }
            window.close();
        } catch (error) {
            exportStatus.textContent = `Export failed: ${error.message}`;
            downloadButton.disabled = false;
        }
    });
})();
