from io import BytesIO

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.colors import LinearSegmentedColormap

from .export import validate_comparison_export


def comparison_graph_pdf(payload):
    export_data = validate_comparison_export(payload)
    datasets = export_data["datasets"]
    names = [dataset["name"] for dataset in datasets]
    distances = export_data["distances"]
    distance_values = [item["distance"] for item in distances]

    distance_matrix = np.zeros((len(datasets), len(datasets)), dtype=float)
    for item in distances:
        first_index, second_index = item["indices"]
        distance_matrix[first_index, second_index] = item["distance"]
        distance_matrix[second_index, first_index] = item["distance"]

    output = BytesIO()
    with matplotlib.rc_context({"text.parse_math": False}), PdfPages(output) as pdf:
        figure, axis = plt.subplots(figsize=(11.7, 8.3))
        for item in distances:
            first_index, second_index = item["indices"]
            first = datasets[first_index]
            second = datasets[second_index]
            axis.plot(
                [first["x"], second["x"]],
                [first["y"], second["y"]],
                color="#7fc7c1",
                alpha=0.75,
                linewidth=1.2,
                zorder=1,
            )
            midpoint_x = (first["x"] + second["x"]) / 2
            midpoint_y = (first["y"] + second["y"]) / 2
            axis.annotate(
                f'{item["distance"]:.3f}',
                (midpoint_x, midpoint_y),
                xytext=(0, 5),
                textcoords="offset points",
                ha="center",
                fontsize=11,
                color="#263238",
                bbox={"facecolor": "white", "edgecolor": "none", "alpha": 0.8, "pad": 1},
                zorder=3,
            )

        for dataset in datasets:
            axis.scatter(
                dataset["x"],
                dataset["y"],
                s=220,
                c=dataset["color"] or "#526bff",
                edgecolors="#263238",
                linewidths=1.2,
                zorder=2,
            )
            axis.annotate(
                dataset["name"],
                (dataset["x"], dataset["y"]),
                xytext=(0, 12),
                textcoords="offset points",
                ha="center",
                fontsize=12,
                fontweight="medium",
            )
        axis.set_title(f'Dataset Map — {export_data["method"].upper()}', fontsize=18, pad=16)
        axis.set_xlabel("t-SNE 1", fontsize=14)
        axis.set_ylabel("t-SNE 2", fontsize=14)
        axis.tick_params(axis="both", labelsize=11)
        axis.set_aspect("equal", adjustable="datalim")
        axis.grid(True, alpha=0.2)
        figure.tight_layout()
        pdf.savefig(figure)
        plt.close(figure)

        figure, axis = plt.subplots(figsize=(11.7, 8.3))
        masked_matrix = np.ma.masked_where(
            np.eye(len(datasets), dtype=bool),
            distance_matrix,
        )
        heatmap_colors = LinearSegmentedColormap.from_list(
            "dataset-distance",
            ["#4575b4", "#d73027"],
        )
        heatmap_colors.set_bad("#465553")
        minimum = min(distance_values)
        maximum = max(distance_values)
        if minimum == maximum:
            minimum -= 0.5
            maximum += 0.5
        image = axis.imshow(
            masked_matrix,
            cmap=heatmap_colors,
            vmin=minimum,
            vmax=maximum,
        )
        axis.set_xticks(range(len(names)), labels=names, rotation=45, ha="right")
        axis.set_yticks(range(len(names)), labels=names)
        axis.set_title(
            f'Pairwise Distance Heatmap — {export_data["method"].upper()}',
            fontsize=18,
            pad=16,
        )
        axis.set_xlabel("Dataset", fontsize=14)
        axis.set_ylabel("Dataset", fontsize=14)
        axis.tick_params(axis="both", labelsize=11)
        for row in range(len(names)):
            for column in range(len(names)):
                axis.text(
                    column,
                    row,
                    f"{distance_matrix[row, column]:.3f}",
                    ha="center",
                    va="center",
                    color="white" if row == column else "black",
                    fontsize=11,
                )
        figure.colorbar(image, ax=axis, label="Distance").ax.tick_params(labelsize=11)
        figure.tight_layout()
        pdf.savefig(figure)
        plt.close(figure)

    return output.getvalue()
