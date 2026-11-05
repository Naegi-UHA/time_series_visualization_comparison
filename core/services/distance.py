import numpy as np
from aeon.distances import get_distance_function
from sklearn.manifold import TSNE


def pairwise_dataset_distances(
    datasets: list[list[list[float]]],
    method: str,
) -> np.ndarray:
    if len(datasets) < 2:
        raise ValueError("Select at least two datasets.")

    distance_matrix = np.zeros((len(datasets), len(datasets)), dtype=float)
    for first_index, first_dataset in enumerate(datasets):
        for second_index in range(first_index + 1, len(datasets)):
            distance = mean_pairwise_distance(
                first_dataset,
                datasets[second_index],
                method,
            )
            distance_matrix[first_index, second_index] = distance
            distance_matrix[second_index, first_index] = distance

    return distance_matrix


def tsne_projection(distance_matrix: np.ndarray) -> np.ndarray:
    dataset_count = len(distance_matrix)
    if dataset_count < 2:
        raise ValueError("Select at least two datasets.")

    perplexity = min(30.0, max(1.0, (dataset_count - 1) / 3))
    return TSNE(
        n_components=2,
        metric="precomputed",
        perplexity=perplexity,
        init="random",
        random_state=42,
    ).fit_transform(distance_matrix)


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
