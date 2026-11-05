import shutil
import subprocess
import tempfile
from pathlib import Path

from .export import validate_comparison_export


class LatexCompilationError(Exception):
    pass


_LATEX_ESCAPES = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}


def _latex_text(value):
    return "".join(_LATEX_ESCAPES.get(character, character) for character in str(value))


def _normalized_coordinates(datasets):
    x_values = [dataset["x"] for dataset in datasets]
    y_values = [dataset["y"] for dataset in datasets]
    min_x, max_x = min(x_values), max(x_values)
    min_y, max_y = min(y_values), max(y_values)
    spread_x = max_x - min_x or 1
    spread_y = max_y - min_y or 1

    return [
        (
            1 + (dataset["x"] - min_x) / spread_x * 10,
            1 + (dataset["y"] - min_y) / spread_y * 7,
        )
        for dataset in datasets
    ]


def _distance_color(distance, minimum, maximum):
    ratio = 0.5 if minimum == maximum else (distance - minimum) / (maximum - minimum)
    low = (69, 117, 180)
    high = (215, 48, 39)
    return "".join(
        f"{round(low[index] + ratio * (high[index] - low[index])):02X}"
        for index in range(3)
    )


def _dataset_map(datasets, distances):
    coordinates = _normalized_coordinates(datasets)
    lines = [
        r"\begin{tikzpicture}[x=1cm,y=1cm, every node/.style={font=\small}]",
        r"\draw[->,gray] (0,0) -- (12,0) node[right] {t-SNE 1};",
        r"\draw[->,gray] (0,0) -- (0,9) node[above] {t-SNE 2};",
    ]
    for pair in distances:
        first, second = pair["indices"]
        x1, y1 = coordinates[first]
        x2, y2 = coordinates[second]
        midpoint_x = (x1 + x2) / 2
        midpoint_y = (y1 + y2) / 2
        lines.extend([
            (
                f"\\draw[teal!70!black] ({x1:.3f},{y1:.3f}) -- "
                f"({x2:.3f},{y2:.3f});"
            ),
            (
                f"\\node[fill=white,inner sep=1pt,font=\\scriptsize] "
                f"at ({midpoint_x:.3f},{midpoint_y:.3f}) "
                f"{{{pair['distance']:.3f}}};"
            ),
        ])
    for index, (dataset, (x, y)) in enumerate(zip(datasets, coordinates)):
        color = dataset["color"][1:] if dataset["color"] else "526BFF"
        lines.extend([
            f"\\definecolor{{dataset{index}}}{{HTML}}{{{color}}}",
            (
                f"\\filldraw[fill=dataset{index},draw=black] "
                f"({x:.3f},{y:.3f}) circle (4pt);"
            ),
            (
                f"\\node[above=5pt,align=center] at ({x:.3f},{y:.3f}) "
                f"{{{_latex_text(dataset['name'])}}};"
            ),
        ])
    lines.append(r"\end{tikzpicture}")
    return "\n".join(lines)


def _heatmap(datasets, distances):
    count = len(datasets)
    matrix = [[0.0 for _ in range(count)] for _ in range(count)]
    values = []
    for pair in distances:
        first, second = pair["indices"]
        matrix[first][second] = pair["distance"]
        matrix[second][first] = pair["distance"]
        values.append(pair["distance"])

    minimum = min(values)
    maximum = max(values)
    lines = [
        r"\begin{tikzpicture}[x=1.65cm,y=0.85cm,every node/.style={font=\small}]",
    ]
    for index, dataset in enumerate(datasets):
        x = index + 0.5
        y = count + 0.5
        lines.append(
            f"\\node[rotate=45,anchor=west] at ({x:.2f},{y + 0.2:.2f}) "
            f"{{{_latex_text(dataset['name'])}}};"
        )
        lines.append(
            f"\\node[anchor=east] at (-0.1,{count - index - 0.5:.2f}) "
            f"{{{_latex_text(dataset['name'])}}};"
        )

    for row in range(count):
        for column in range(count):
            distance = matrix[row][column]
            color = "465553" if row == column else _distance_color(distance, minimum, maximum)
            x = column
            y = count - row - 1
            color_name = f"heatcell{row}_{column}"
            lines.extend([
                f"\\definecolor{{{color_name}}}{{HTML}}{{{color}}}",
                (
                    f"\\fill[{color_name}] ({x},{y}) rectangle "
                    f"({x + 1},{y + 1});"
                ),
                (
                    f"\\draw[white] ({x},{y}) rectangle ({x + 1},{y + 1});"
                ),
                (
                    f"\\node[text={'white' if row == column else 'black'}] "
                    f"at ({x + 0.5},{y + 0.5}) {{{distance:.3f}}};"
                ),
            ])
    lines.append(
        f"\\draw[gray] (0,0) rectangle ({count},{count});"
    )
    lines.append(r"\end{tikzpicture}")
    return "\n".join(lines)


def _latex_source(payload):
    export_data = validate_comparison_export(payload)
    datasets = export_data["datasets"]
    distances = export_data["distances"]
    method = _latex_text(export_data["method"].upper())

    distance_rows = "\n".join(
        f"{_latex_text(pair['first'])} & {_latex_text(pair['second'])} "
        f"& {pair['distance']:.6g} \\\\"
        for pair in distances
    )
    report = rf"""\documentclass[11pt,a4paper]{{article}}
\usepackage[utf8]{{inputenc}}
\usepackage[T1]{{fontenc}}
\usepackage[margin=2.2cm]{{geometry}}
\usepackage{{tikz}}
\usepackage{{booktabs}}
\usepackage{{float}}
\usepackage{{xcolor}}
\title{{Time-Series Dataset Comparison Report}}
\author{{Generated by Time-Series Dataset Similarity Explorer}}
\date{{\today}}
\begin{{document}}
\maketitle

\section{{Overview}}
This report summarizes the comparison of {len(datasets)} time-series datasets
using the \texttt{{{method}}} distance method. Pairwise distances are the
mean distances between the time series in each pair of datasets. The
two-dimensional Dataset Map uses the t-SNE coordinates calculated from the
same pairwise distance matrix. These coordinates are a projection and their
geometric separation is not itself the reported distance.

\section{{Dataset Map}}
Each point represents one dataset at its calculated t-SNE coordinates.
The edge labels show the corresponding pairwise distances.
\begin{{figure}}[H]
\centering
{_dataset_map(datasets, distances)}
\caption{{t-SNE Dataset Map with pairwise distance annotations.}}
\end{{figure}}

\section{{Pairwise Distance Heatmap}}
The heatmap shows the symmetric pairwise distance matrix. Blue indicates
smaller distances and red indicates larger distances; the diagonal represents
the zero self-distance.
\begin{{figure}}[H]
\centering
{_heatmap(datasets, distances)}
\caption{{Heatmap generated from the pairwise distances.}}
\end{{figure}}

\section{{Pairwise Results}}
\begin{{table}}[H]
\centering
\begin{{tabular}}{{llr}}
\toprule
Dataset 1 & Dataset 2 & Distance \\
\midrule
{distance_rows}
\bottomrule
\end{{tabular}}
\caption{{Pairwise distances calculated with the {method} method.}}
\end{{table}}
\end{{document}}
"""
    return report


def _compile_latex(source):
    compiler = shutil.which("tectonic") or shutil.which("pdflatex")
    if compiler is None:
        raise LatexCompilationError(
            "LaTeX export requires Tectonic or pdflatex to be installed and available on PATH."
        )

    with tempfile.TemporaryDirectory() as temporary_directory:
        working_directory = Path(temporary_directory)
        source_path = working_directory / "dataset-comparison.tex"
        pdf_path = working_directory / "dataset-comparison.pdf"
        source_path.write_text(source, encoding="utf-8")

        if Path(compiler).stem.lower() == "tectonic":
            command = [
                compiler,
                "--outdir",
                str(working_directory),
                str(source_path),
            ]
        else:
            command = [
                compiler,
                "-interaction=nonstopmode",
                "-halt-on-error",
                "-no-shell-escape",
                f"-output-directory={working_directory}",
                str(source_path),
            ]

        try:
            result = subprocess.run(
                command,
                cwd=working_directory,
                capture_output=True,
                text=True,
                timeout=300,
                check=False,
            )
        except subprocess.TimeoutExpired as error:
            raise LatexCompilationError(
                "LaTeX report compilation timed out."
            ) from error

        if result.returncode != 0:
            compiler_output = (result.stderr or result.stdout).strip()
            details = compiler_output[-2000:] or "No compiler output was provided."
            raise LatexCompilationError(
                f"LaTeX report compilation failed: {details}"
            )
        if not pdf_path.is_file():
            raise LatexCompilationError(
                "LaTeX compiler completed without producing a PDF."
            )

        pdf = pdf_path.read_bytes()
        if not pdf.startswith(b"%PDF-"):
            raise LatexCompilationError(
                "LaTeX compiler produced an invalid PDF."
            )
        return pdf


def comparison_latex_report(payload):
    return _compile_latex(_latex_source(payload))
