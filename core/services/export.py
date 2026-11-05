import math
import re
import tempfile
from pathlib import Path

from odf.opendocument import OpenDocumentSpreadsheet
from odf.table import Table, TableCell, TableRow
from odf.text import P


def _is_finite_number(value):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def validate_comparison_export(payload):
    datasets = payload.get("datasets")
    distances = payload.get("distances")
    method = payload.get("method")
    if not isinstance(datasets, list) or len(datasets) < 2:
        raise ValueError("At least two compared datasets are required.")
    if not isinstance(distances, list):
        raise ValueError("Pairwise distances are missing.")
    if not isinstance(method, str):
        raise ValueError("The comparison method is missing.")

    normalized_datasets = []
    for dataset in datasets:
        if (
            not isinstance(dataset, dict)
            or not isinstance(dataset.get("name"), str)
            or not _is_finite_number(dataset.get("x"))
            or not _is_finite_number(dataset.get("y"))
        ):
            raise ValueError("Invalid dataset coordinates.")
        normalized_datasets.append({
            "name": dataset["name"],
            "x": float(dataset["x"]),
            "y": float(dataset["y"]),
            "color": dataset.get("color")
            if isinstance(dataset.get("color"), str)
            and re.fullmatch(r"#[0-9A-Fa-f]{6}", dataset["color"])
            else None,
        })

    expected_pairs = {
        (first, second)
        for first in range(len(normalized_datasets))
        for second in range(first + 1, len(normalized_datasets))
    }
    normalized_distances = []
    seen_pairs = set()
    for item in distances:
        indices = item.get("indices") if isinstance(item, dict) else None
        distance = item.get("distance") if isinstance(item, dict) else None
        if (
            not isinstance(indices, list)
            or len(indices) != 2
            or any(not isinstance(index, int) or isinstance(index, bool) for index in indices)
            or not _is_finite_number(distance)
        ):
            raise ValueError("Invalid pairwise distance data.")
        pair = tuple(indices)
        if pair not in expected_pairs or pair in seen_pairs:
            raise ValueError("Invalid or duplicate dataset pair.")
        seen_pairs.add(pair)
        normalized_distances.append({
            "indices": [pair[0], pair[1]],
            "first": normalized_datasets[pair[0]]["name"],
            "second": normalized_datasets[pair[1]]["name"],
            "distance": float(distance),
        })

    if seen_pairs != expected_pairs:
        raise ValueError("Pairwise distances must include every dataset pair.")

    return {
        "method": method,
        "datasets": normalized_datasets,
        "distances": normalized_distances,
    }


def _append_row(table, values):
    row = TableRow()
    for value in values:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            cell = TableCell(valuetype="float", value=str(value))
            cell.addElement(P(text=format(value, ".15g")))
        else:
            cell = TableCell(valuetype="string")
            cell.addElement(P(text=str(value)))
        row.addElement(cell)
    table.addElement(row)


def comparison_export_ods(payload):
    export_data = validate_comparison_export(payload)
    document = OpenDocumentSpreadsheet()

    dataset_table = Table(name="Dataset Map")
    _append_row(dataset_table, ["Dataset", "t-SNE 1 (X)", "t-SNE 2 (Y)"])
    for dataset in export_data["datasets"]:
        _append_row(dataset_table, [dataset["name"], dataset["x"], dataset["y"]])
    document.spreadsheet.addElement(dataset_table)

    distance_table = Table(name="Pairwise distances")
    _append_row(distance_table, ["Dataset 1", "Dataset 2", "Distance", "Method"])
    for distance in export_data["distances"]:
        _append_row(distance_table, [
            distance["first"],
            distance["second"],
            distance["distance"],
            export_data["method"],
        ])
    document.spreadsheet.addElement(distance_table)

    with tempfile.TemporaryDirectory() as temporary_directory:
        output_path = Path(temporary_directory) / "dataset-comparison.ods"
        document.save(str(output_path))
        return output_path.read_bytes()
