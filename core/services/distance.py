import math
import numbers

import numpy as np
from aeon.distances import get_distance_function
from aeon.clustering.averaging import (
    elastic_barycenter_average,
    subgradient_barycenter_average,
)
from sklearn.manifold import TSNE


_DISTANCE_PARAMETER_RULES = {
    "dtw": {
        "window": ("float", 0, 1),
        "itakura_max_slope": ("float", 0, 1),
    },
    "dtw_gi": {
        "window": ("float", 0, 1),
        "itakura_max_slope": ("float", 0, 1),
        "max_iter": ("int", 1, None),
        "use_bias": ("bool", None, None),
    },
    "shape_dtw": {
        "window": ("float", 0, 1),
        "reach": ("int", 1, None),
        "itakura_max_slope": ("float", 0, 1),
    },
    "ddtw": {
        "window": ("float", 0, 1),
        "itakura_max_slope": ("float", 0, 1),
    },
    "wdtw": {
        "window": ("float", 0, 1),
        "g": ("float", 0, None),
        "itakura_max_slope": ("float", 0, 1),
    },
    "wddtw": {
        "window": ("float", 0, 1),
        "g": ("float", 0, None),
        "itakura_max_slope": ("float", 0, 1),
    },
    "adtw": {
        "window": ("float", 0, 1),
        "itakura_max_slope": ("float", 0, 1),
        "warp_penalty": ("float", 0, None),
    },
    "soft_dtw": {
        "gamma": ("float", 0, None),
        "window": ("float", 0, 1),
        "itakura_max_slope": ("float", 0, 1),
    },
    "msm": {
        "window": ("float", 0, 1),
        "independent": ("bool", None, None),
        "c": ("float", 0, None),
        "itakura_max_slope": ("float", 0, 1),
    },
    "twe": {
        "window": ("float", 0, 1),
        "nu": ("float", 0.000001, None),
        "lmbda": ("float", 1, None),
        "itakura_max_slope": ("float", 0, 1),
    },
}
_STRATEGIES = {"pairwise_mean", "eba", "medoid", "subgradient"}
_REPRESENTATIVE_PARAMETER_DEFAULTS = {
    "eba": {"max_iters": 30, "tol": 0.00001},
    "subgradient": {
        "max_iters": 30,
        "tol": 0.00001,
        "initial_step_size": 0.05,
        "final_step_size": 0.005,
    },
}


def resolve_representative_strategy(strategy: str, method: str) -> tuple[str, str | None]:
    method = method.lower()
    if method == "dtw_gi" and strategy in {"eba", "subgradient"}:
        return (
            "medoid",
            "DTW_GI is not supported by Aeon's barycenter routines; Medoid was selected.",
        )
    if method in {"ddtw", "wddtw"} and strategy == "eba":
        return (
            "subgradient",
            f"EBA returns non-finite barycenters with {method.upper()}; Subgradient was selected.",
        )
    return strategy, None


def pairwise_dataset_distances(
    datasets: list[list[list[float] | list[list[float]]]],
    method: str,
    strategy: str = "pairwise_mean",
    distance_parameters: dict | None = None,
    representative_parameters: dict | None = None,
) -> np.ndarray:
    if len(datasets) < 2:
        raise ValueError("Select at least two datasets.")

    method = method.lower()
    strategy, _ = resolve_representative_strategy(strategy, method)
    if strategy not in _STRATEGIES:
        raise ValueError(f"Unsupported representative method: {strategy}")
    distance_function = _get_distance_function(method)
    distance_parameters = _validated_parameters(
        distance_parameters,
        _DISTANCE_PARAMETER_RULES[method],
        "distance",
    )
    validated_representative_parameters = _validated_parameters(
        representative_parameters,
        _representative_parameter_rules(strategy),
        "representative method",
    )
    representative_parameters = {
        **_REPRESENTATIVE_PARAMETER_DEFAULTS.get(strategy, {}),
        **validated_representative_parameters,
    }

    if strategy != "pairwise_mean":
        representatives = [
            _dataset_representatives(
                dataset,
                strategy,
                method,
                distance_function,
                distance_parameters,
                representative_parameters,
            )
            for dataset in datasets
        ]
    else:
        representatives = None

    distance_matrix = np.zeros((len(datasets), len(datasets)), dtype=float)
    for first_index, first_dataset in enumerate(datasets):
        for second_index in range(first_index + 1, len(datasets)):
            if representatives is None:
                distance = _mean_pairwise_distance(
                    first_dataset,
                    datasets[second_index],
                    distance_function,
                    distance_parameters,
                )
            else:
                distance = _mean_representative_distance(
                    representatives[first_index],
                    representatives[second_index],
                    distance_function,
                    distance_parameters,
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


def _as_series_array(series: list[float] | list[list[float]]) -> np.ndarray:
    try:
        values = np.asarray(series, dtype=float)
    except (TypeError, ValueError) as error:
        raise ValueError("Time series values must be numeric.") from error

    if values.ndim == 1:
        values = values.reshape(1, -1)
    if (
        values.ndim != 2
        or values.shape[0] == 0
        or values.shape[1] == 0
        or not np.isfinite(values).all()
    ):
        raise ValueError(
            "Each time series must contain finite numeric values in one or more dimensions."
        )
    return values


def mean_pairwise_distance(
    first_dataset: list[list[float] | list[list[float]]],
    second_dataset: list[list[float] | list[list[float]]],
    method: str,
    distance_parameters: dict | None = None,
) -> float:
    if not first_dataset or not second_dataset:
        raise ValueError("Each dataset must contain at least one time series.")

    method = method.lower()
    distance_function = _get_distance_function(method)
    distance_parameters = _validated_parameters(
        distance_parameters,
        _DISTANCE_PARAMETER_RULES[method],
        "distance",
    )
    return _mean_pairwise_distance(
        first_dataset,
        second_dataset,
        distance_function,
        distance_parameters,
    )


def _get_distance_function(method):
    try:
        return get_distance_function(method)
    except ValueError as error:
        raise ValueError(f"Unsupported distance method: {method}") from error


def _validated_parameters(parameters, rules, description):
    if parameters is None:
        parameters = {}
    if not isinstance(parameters, dict):
        raise ValueError(f"{description.capitalize()} parameters must be an object.")

    unknown_parameters = set(parameters) - set(rules)
    if unknown_parameters:
        raise ValueError(
            f"Unsupported {description} parameter: {sorted(unknown_parameters)[0]}"
        )

    validated = {}
    for name, value in parameters.items():
        kind, minimum, maximum = rules[name]
        if kind == "bool":
            if not isinstance(value, bool):
                raise ValueError(f"{name} must be a boolean.")
            validated[name] = value
            continue
        if isinstance(value, bool) or not isinstance(value, numbers.Real):
            raise ValueError(f"{name} must be a number.")
        if kind == "int" and not isinstance(value, numbers.Integral):
            raise ValueError(f"{name} must be an integer.")

        numeric_value = int(value) if kind == "int" else float(value)
        if not math.isfinite(numeric_value):
            raise ValueError(f"{name} must be finite.")
        if minimum is not None and numeric_value < minimum:
            raise ValueError(f"{name} must be at least {minimum}.")
        if maximum is not None and numeric_value > maximum:
            raise ValueError(f"{name} must be at most {maximum}.")
        validated[name] = numeric_value
    return validated


def _representative_parameter_rules(strategy):
    if strategy in {"eba", "subgradient"}:
        rules = {
            "max_iters": ("int", 1, None),
            "tol": ("float", 0.000000001, None),
        }
        if strategy == "subgradient":
            rules.update({
                "initial_step_size": ("float", 0.000000001, None),
                "final_step_size": ("float", 0.000000001, None),
            })
        return rules
    return {}


def _mean_pairwise_distance(
    first_dataset,
    second_dataset,
    distance_function,
    distance_parameters,
):
    if not first_dataset or not second_dataset:
        raise ValueError("Each dataset must contain at least one time series.")

    distances = []
    for first_series in first_dataset:
        first_array = _as_series_array(first_series)
        for second_series in second_dataset:
            second_array = _as_series_array(second_series)
            for first_dimension in range(first_array.shape[0]):
                for second_dimension in range(second_array.shape[0]):
                    distances.append(_calculate_distance(
                        distance_function,
                        first_array[first_dimension],
                        second_array[second_dimension],
                        distance_parameters,
                    ))

    return float(np.mean(distances))


def _dataset_representatives(
    dataset,
    strategy,
    method,
    distance_function,
    distance_parameters,
    representative_parameters,
):
    if not dataset:
        raise ValueError("Each dataset must contain at least one time series.")

    series_arrays = [_as_series_array(series) for series in dataset]
    dimension_count = series_arrays[0].shape[0]
    if any(series.shape[0] != dimension_count for series in series_arrays):
        raise ValueError("All time series in a dataset must have the same dimensions.")

    representatives = []
    for dimension_index in range(dimension_count):
        dimension_series = [series[dimension_index] for series in series_arrays]
        if strategy == "medoid":
            representative = _medoid_series(
                dimension_series,
                distance_function,
                distance_parameters,
            )
        else:
            lengths = {len(series) for series in dimension_series}
            if len(lengths) != 1:
                raise ValueError(
                    f"{strategy.upper()} requires equal-length series within each dimension."
                )
            data = np.stack(dimension_series)[:, np.newaxis, :]
            barycenter_parameters = {
                name: value
                for name, value in distance_parameters.items()
                if name == "window"
            }
            common_parameters = {
                "distance": method,
                "max_iters": representative_parameters["max_iters"],
                "tol": representative_parameters["tol"],
                "random_state": 42,
                **barycenter_parameters,
            }
            if strategy == "eba":
                representative = elastic_barycenter_average(data, **common_parameters)
            else:
                common_parameters.update({
                    "initial_step_size": representative_parameters["initial_step_size"],
                    "final_step_size": representative_parameters["final_step_size"],
                })
                representative = subgradient_barycenter_average(data, **common_parameters)
            representative = _as_series_array(representative)[0]
        representatives.append(representative)
    return representatives


def _medoid_series(series, distance_function, distance_parameters):
    if len(series) == 1:
        return series[0]

    totals = np.zeros(len(series), dtype=float)
    for first_index in range(len(series)):
        for second_index in range(first_index + 1, len(series)):
            distance = _calculate_distance(
                distance_function,
                series[first_index],
                series[second_index],
                distance_parameters,
            )
            totals[first_index] += distance
            totals[second_index] += distance
    return series[int(np.argmin(totals))]


def _mean_representative_distance(
    first_representatives,
    second_representatives,
    distance_function,
    distance_parameters,
):
    distances = [
        _calculate_distance(
            distance_function,
            first_dimension,
            second_dimension,
            distance_parameters,
        )
        for first_dimension in first_representatives
        for second_dimension in second_representatives
    ]
    return float(np.mean(distances))


def _calculate_distance(distance_function, first_series, second_series, parameters):
    distance = float(distance_function(
        first_series[np.newaxis, :],
        second_series[np.newaxis, :],
        **parameters,
    ))
    if not np.isfinite(distance):
        raise ValueError("The selected distance method returned a non-finite value.")
    return distance
