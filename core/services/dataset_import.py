import re
import tempfile
from pathlib import Path

import numpy as np
from aeon.datasets import load_from_arff_file, load_from_ts_file


_DIMENSION_FILE = re.compile(
    r"^(?P<name>.+)Dimension(?P<dimension>\d+)_(?P<split>TRAIN|TEST)\.arff$",
    re.I,
)


def _normalize_loaded_data(features, labels):
    if isinstance(features, np.ndarray) and features.dtype != object:
        samples = [features[index] for index in range(len(features))]
    else:
        samples = list(features)

    if labels is None:
        class_labels = [""] * len(samples)
    else:
        class_labels = [
            str(label)
            for label in np.asarray(labels, dtype=object).reshape(-1)
        ]
        if len(class_labels) != len(samples):
            raise ValueError("The number of labels does not match the number of time series.")

    records = []
    dimension_count = None
    for sample, label in zip(samples, class_labels):
        try:
            values = np.asarray(sample, dtype=float)
        except (TypeError, ValueError) as error:
            raise ValueError("The file contains non-numeric time-series values.") from error

        if values.ndim == 1:
            values = values.reshape(1, -1)
        if (
            values.ndim != 2
            or values.shape[0] == 0
            or values.shape[1] == 0
            or not np.isfinite(values).all()
        ):
            raise ValueError(
                "Each time series must contain finite values with matching lengths across dimensions."
            )
        if dimension_count is None:
            dimension_count = values.shape[0]
        elif values.shape[0] != dimension_count:
            raise ValueError(
                "All time series in a dataset must have the same number of dimensions."
            )

        records.append({"label": label, "series": values.tolist()})

    if not records:
        raise ValueError("The file does not contain any time series.")
    return {"series": records, "dimensions": dimension_count}


def _load_dataset(path):
    try:
        if path.suffix.lower() == ".ts":
            features, labels, _ = load_from_ts_file(
                str(path),
                return_meta_data=True,
            )
        else:
            features, labels = load_from_arff_file(str(path))
    except (OSError, UnicodeDecodeError, TypeError, ValueError, IndexError) as error:
        raise ValueError(f"Could not read {path.name}: {error}") from error

    return _normalize_loaded_data(features, labels)


def _separate_dimensions(name, data):
    dimension_count = data["dimensions"]
    datasets = []
    for dimension_index in range(dimension_count):
        datasets.append({
            "name": f"{name}_Dimension{dimension_index + 1}" if dimension_count > 1 else name,
            "dimensions": 1,
            "series": [
                {
                    "label": item["label"],
                    "series": item["series"][dimension_index],
                }
                for item in data["series"]
            ],
        })
    return datasets


def import_time_series_files(uploaded_files):
    if not uploaded_files:
        raise ValueError("Select at least one .arff or .ts file.")

    files = []
    for index, uploaded_file in enumerate(uploaded_files):
        filename = Path(uploaded_file.name).name
        suffix = Path(filename).suffix.lower()
        if suffix not in {".arff", ".ts"}:
            raise ValueError("Only .arff and .ts files can be imported by this endpoint.")
        files.append((index, filename, suffix, uploaded_file))

    imported = []
    with tempfile.TemporaryDirectory() as temporary_directory:
        root = Path(temporary_directory)
        for index, filename, suffix, uploaded_file in files:
            path = root / f"{index}{suffix}"
            with path.open("wb") as target:
                for chunk in uploaded_file.chunks():
                    target.write(chunk)

            match = _DIMENSION_FILE.fullmatch(filename)
            if match:
                name = f"{match['name']}_{match['split'].upper()}_Dimension{match['dimension']}"
            else:
                name = Path(filename).stem

            data = _load_dataset(path)
            if suffix == ".ts":
                data["name"] = name
                datasets = [data]
            else:
                datasets = _separate_dimensions(name, data)
            imported.extend(
                (index, dataset)
                for dataset in datasets
            )

    return [dataset for _, dataset in sorted(imported, key=lambda item: item[0])]
