import json

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST

from .services.distance import classical_mds, pairwise_dataset_distances


def index(request):
    return render(request, "core/index.html")


@require_POST
def compare_datasets(request):
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Invalid JSON request."}, status=400)

    if not isinstance(payload, dict):
        return JsonResponse({"error": "The request must be a JSON object."}, status=400)

    datasets = payload.get("datasets")
    method = payload.get("method")
    if not isinstance(datasets, list) or len(datasets) < 2:
        return JsonResponse({"error": "Select at least two datasets."}, status=400)
    if not isinstance(method, str):
        return JsonResponse({"error": "Select a valid distance method."}, status=400)

    names = []
    series_data = []
    for dataset in datasets:
        if not isinstance(dataset, dict):
            return JsonResponse({"error": "Invalid dataset data."}, status=400)

        name = dataset.get("name")
        series = dataset.get("series")
        if not isinstance(name, str) or not isinstance(series, list):
            return JsonResponse({"error": "Invalid dataset data."}, status=400)
        if any(
            not isinstance(item, dict) or not isinstance(item.get("series"), list)
            for item in series
        ):
            return JsonResponse({"error": "Invalid time series data."}, status=400)

        names.append(name)
        series_data.append([item.get("series") for item in series])

    try:
        distance_matrix = pairwise_dataset_distances(series_data, method)
    except (TypeError, ValueError) as error:
        return JsonResponse({"error": str(error)}, status=400)

    coordinates = classical_mds(distance_matrix)
    return JsonResponse({
        "method": method.lower(),
        "datasets": [
            {"name": name, "x": float(coordinates[index, 0]), "y": float(coordinates[index, 1])}
            for index, name in enumerate(names)
        ],
        "distances": [
            {
                "datasets": [names[first_index], names[second_index]],
                "distance": float(distance_matrix[first_index, second_index]),
            }
            for first_index in range(len(names))
            for second_index in range(first_index + 1, len(names))
        ],
    })