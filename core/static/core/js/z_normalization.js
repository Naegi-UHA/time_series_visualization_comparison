(function (global) {
    function normalize(values) {
        if (
            !Array.isArray(values)
            || !values.length
            || values.some((value) => !Number.isFinite(value))
        ) {
            throw new Error("Z-normalization requires a non-empty series of finite values.");
        }

        let mean = 0;
        let sumSquaredDifferences = 0;
        values.forEach((value, index) => {
            const count = index + 1;
            const differenceFromMean = value - mean;
            mean += differenceFromMean / count;
            sumSquaredDifferences += differenceFromMean * (value - mean);
        });

        const standardDeviation = Math.sqrt(
            Math.max(0, sumSquaredDifferences / values.length)
        );
        if (standardDeviation === 0) {
            return values.map(() => 0);
        }
        return values.map((value) => (value - mean) / standardDeviation);
    }

    global.TimeSeriesZNormalization = Object.freeze({ normalize });
})(window);
