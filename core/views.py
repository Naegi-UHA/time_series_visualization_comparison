import json

from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST

from .services.dataset_import import import_time_series_files
from .services.distance import (
    pairwise_dataset_distances,
    resolve_representative_strategy,
    tsne_projection,
)
from .services.export import comparison_export_ods
from .services.latex_report import LatexCompilationError, comparison_latex_report
from .services.pdf_graph import comparison_graph_pdf

_STRATEGY_LABELS = {
    "pairwise_mean": "Pairwise mean",
    "eba": "Elastic Barycenter Averaging",
    "medoid": "Medoid",
    "subgradient": "Subgradient barycenter",
}


def index(request):
    return render(request, "core/index.html")


def export_page(request):
    return render(request, "core/exportation.html")

@require_POST
def import_datasets(request):
    try:
        datasets = import_time_series_files(request.FILES.getlist("files"))
    except ValueError as error:
        return JsonResponse({"error": str(error)}, status=400)

    return JsonResponse({"datasets": datasets})


@require_POST
def export_ods(request):
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Invalid JSON request."}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({"error": "The request must be a JSON object."}, status=400)

    try:
        ods_file = comparison_export_ods(payload)
    except ValueError as error:
        return JsonResponse({"error": str(error)}, status=400)

    response = HttpResponse(
        ods_file,
        content_type="application/vnd.oasis.opendocument.spreadsheet",
    )
    response["Content-Disposition"] = 'attachment; filename="dataset-comparison.ods"'
    return response


@require_POST
def export_pdf_graph(request):
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Invalid JSON request."}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({"error": "The request must be a JSON object."}, status=400)

    try:
        pdf_file = comparison_graph_pdf(payload)
    except ValueError as error:
        return JsonResponse({"error": str(error)}, status=400)

    response = HttpResponse(pdf_file, content_type="application/pdf")
    response["Content-Disposition"] = 'attachment; filename="dataset-comparison.pdf"'
    return response


@require_POST
def export_latex_report(request):
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Invalid JSON request."}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({"error": "The request must be a JSON object."}, status=400)

    try:
        report = comparison_latex_report(payload)
    except ValueError as error:
        return JsonResponse({"error": str(error)}, status=400)
    except LatexCompilationError as error:
        return JsonResponse({"error": str(error)}, status=503)

    response = HttpResponse(report, content_type="application/pdf")
    response["Content-Disposition"] = 'attachment; filename="dataset-comparison.pdf"'
    return response


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
    strategy = payload.get("strategy", "pairwise_mean")
    distance_parameters = payload.get("distance_parameters", {})
    representative_parameters = payload.get("representative_parameters", {})
    if not isinstance(datasets, list) or len(datasets) < 2:
        return JsonResponse({"error": "Select at least two datasets."}, status=400)
    if not isinstance(method, str):
        return JsonResponse({"error": "Select a valid distance method."}, status=400)
    if not isinstance(strategy, str):
        return JsonResponse({"error": "Select a valid representative method."}, status=400)
    if not isinstance(distance_parameters, dict):
        return JsonResponse({"error": "Distance parameters must be an object."}, status=400)
    if not isinstance(representative_parameters, dict):
        return JsonResponse(
            {"error": "Representative method parameters must be an object."},
            status=400,
        )

    strategy, strategy_notice = resolve_representative_strategy(strategy, method)
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
        distance_matrix = pairwise_dataset_distances(
            series_data,
            method,
            strategy,
            distance_parameters,
            representative_parameters,
        )
    except (TypeError, ValueError) as error:
        return JsonResponse({"error": str(error)}, status=400)

    method_label = f"{_STRATEGY_LABELS[strategy]} + {method.upper()}"
    coordinates = tsne_projection(distance_matrix)
    return JsonResponse({
        "method": method.lower(),
        "strategy": strategy,
        "method_label": method_label,
        "strategy_notice": strategy_notice,
        "datasets": [
            {"name": name, "x": float(coordinates[index, 0]), "y": float(coordinates[index, 1])}
            for index, name in enumerate(names)
        ],
        "distances": [
            {
                "datasets": [names[first_index], names[second_index]],
                "indices": [first_index, second_index],
                "distance": float(distance_matrix[first_index, second_index]),
            }
            for first_index in range(len(names))
            for second_index in range(first_index + 1, len(names))
        ],
    })