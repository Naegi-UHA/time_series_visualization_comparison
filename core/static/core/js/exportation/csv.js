(function () {
    function escapeCsvValue(value) {
        let text = String(value);
        if (/^\s*[=+\-@]/.test(text)) {
            text = `'${text}`;
        }
        return `"${text.replaceAll('"', '""')}"`;
    }

    function buildComparisonCsv(result) {
        const rows = [
            ["Dataset Map coordinates"],
            ["Dataset", "t-SNE 1 (X)", "t-SNE 2 (Y)"],
            ...result.datasets.map(({ name, x, y }) => [name, x, y]),
            [],
            ["Pairwise distances"],
            ["Dataset 1", "Dataset 2", "Distance", "Method"],
            ...result.distances.map(({ indices, distance }) => [
                result.datasets[indices[0]].name,
                result.datasets[indices[1]].name,
                distance,
                result.method,
            ]),
        ];
        return `\uFEFF${rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n")}`;
    }

    window.comparisonCsv = { buildComparisonCsv };
})();
