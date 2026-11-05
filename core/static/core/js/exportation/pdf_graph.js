(function () {
    async function downloadComparisonGraphPdf(result, { url, csrfToken, filename }) {
        if (!csrfToken) {
            throw new Error("Security token unavailable. Reload the export window and try again.");
        }

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken,
            },
            body: JSON.stringify(result),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "The PDF graph export could not be created.");
        }

        const objectUrl = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }

    window.comparisonPdfGraph = { download: downloadComparisonGraphPdf };
})();
