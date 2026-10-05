import numpy as np
from aeon.distances import get_distance_function


def _as_series_array(series: list[float]) -> np.ndarray:
    try:
        values = np.asarray(series, dtype=float)
    except (TypeError, ValueError) as error:
        raise ValueError("Time series values must be numeric.") from error

    if values.ndim != 1 or values.size == 0 or not np.isfinite(values).all():
        raise ValueError("Each time series must contain finite numeric values.")
    return values.reshape(1, -1)


def mean_pairwise_distance(
    first_dataset: list[list[float]],
    second_dataset: list[list[float]],
    method: str,
) -> float:
    if not first_dataset or not second_dataset:
        raise ValueError("Each dataset must contain at least one time series.")

    try:
        distance_function = get_distance_function(method.lower())
    except ValueError as error:
        raise ValueError(f"Unsupported distance method: {method}") from error

    distances = []
    for first_series in first_dataset:
        first_array = _as_series_array(first_series)
        for second_series in second_dataset:
            second_array = _as_series_array(second_series)
            distance = float(distance_function(first_array, second_array))
            if not np.isfinite(distance):
                raise ValueError("The selected distance method returned a non-finite value.")
            distances.append(distance)

    return float(np.mean(distances))
