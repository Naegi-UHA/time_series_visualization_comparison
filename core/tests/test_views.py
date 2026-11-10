import json
import re
import zipfile
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from django.urls import reverse

from core.services.export import validate_comparison_export
from core.services.latex_report import _latex_source


COMPARISON_EXPORT = {
    "method": "dtw",
    "datasets": [
        {"name": "first", "x": -1.25, "y": 2.5, "color": "#F4A6A6"},
        {"name": "second", "x": 1.25, "y": -2.5, "color": "#9CCBE8"},
    ],
    "distances": [{"indices": [0, 1], "distance": 3.75}],
}


class DatasetComparisonViewTests(SimpleTestCase):
    def test_import_endpoint_returns_multivariate_ts_as_one_dataset(self):
        uploaded_file = SimpleUploadedFile(
            "small.ts",
            b"""@problemName SmallMultivariate
@timestamps false
@missing false
@univariate false
@dimensions 2
@equalLength true
@classLabel true A B
@data
1,2,3:4,5,6:A
2,3,4:5,6,7:B
""",
        )

        response = self.client.post(
            reverse("import-datasets"),
            {"files": uploaded_file},
        )

        self.assertEqual(response.status_code, 200)
        datasets = response.json()["datasets"]
        self.assertEqual([dataset["name"] for dataset in datasets], ["small"])
        self.assertEqual([dataset["dimensions"] for dataset in datasets], [2])
        self.assertEqual(
            datasets[0]["series"][0]["series"],
            [
                [1.0, 2.0, 3.0],
                [4.0, 5.0, 6.0],
            ],
        )

    def test_import_endpoint_rejects_unsupported_file_type(self):
        uploaded_file = SimpleUploadedFile("dataset.csv", b"a,b,c")

        response = self.client.post(
            reverse("import-datasets"),
            {"files": uploaded_file},
        )

        self.assertEqual(response.status_code, 400)

    def test_compare_endpoint_calculates_multivariate_dataset_distances(self):
        response = self.client.post(
            reverse("compare-datasets"),
            data=json.dumps({
                "method": "dtw",
                "datasets": [
                    {
                        "name": "first",
                        "series": [{"label": "A", "series": [[0.0, 1.0], [1.0, 2.0]]}],
                    },
                    {
                        "name": "second",
                        "series": [{"label": "A", "series": [[0.0, 2.0], [1.0, 3.0]]}],
                    },
                ],
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["distances"]), 1)

    def test_compare_endpoint_returns_pairwise_distances_and_coordinates(self):
        response = self.client.post(
            reverse("compare-datasets"),
            data=json.dumps({
                "method": "DTW",
                "datasets": [
                    {"name": "first", "series": [{"series": [0.0, 1.0, 2.0]}]},
                    {"name": "second", "series": [{"series": [0.0, 2.0, 3.0]}]},
                    {"name": "third", "series": [{"series": [2.0, 3.0, 4.0]}]},
                ],
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["method"], "dtw")
        self.assertEqual(len(response.json()["datasets"]), 3)
        self.assertEqual(len(response.json()["distances"]), 3)
        self.assertEqual(
            {tuple(distance["datasets"]) for distance in response.json()["distances"]},
            {("first", "second"), ("first", "third"), ("second", "third")},
        )
        self.assertEqual(
            {tuple(distance["indices"]) for distance in response.json()["distances"]},
            {(0, 1), (0, 2), (1, 2)},
        )
        self.assertTrue(all(
            isinstance(dataset["x"], float) and isinstance(dataset["y"], float)
            for dataset in response.json()["datasets"]
        ))

    def test_compare_endpoint_requires_at_least_two_sets(self):
        response = self.client.post(
            reverse("compare-datasets"),
            data=json.dumps({"method": "dtw", "datasets": []}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    def test_main_page_accepts_all_supported_dataset_formats(self):
        response = self.client.get(reverse("index"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'accept=".txt,.ts,.arff,text/plain"')
        self.assertContains(response, 'id="toggle-all-datasets"')
        self.assertContains(response, "Toggle all")
        self.assertContains(response, "Multivariate .ts files are imported as one dataset.")

    def test_export_page_renders_format_picker(self):
        response = self.client.get(reverse("export-page"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, ".csv")
        self.assertContains(response, ".ods")
        self.assertContains(response, ".pdf : only graph")
        self.assertContains(response, 'data-format="pdf-graph"')
        self.assertContains(response, "LaTeX report (.pdf)")
        self.assertContains(response, 'data-format="latex-report"')
        self.assertContains(response, 'id="export-filename"')
        self.assertContains(response, 'value="dataset-comparison"')

    def test_export_ods_returns_spreadsheet_with_both_sheets(self):
        response = self.client.post(
            reverse("export-ods"),
            data=json.dumps(COMPARISON_EXPORT),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.oasis.opendocument.spreadsheet",
        )
        self.assertIn("attachment; filename=", response["Content-Disposition"])
        with zipfile.ZipFile(BytesIO(response.content)) as archive:
            content = archive.read("content.xml").decode("utf-8")
        self.assertIn("Dataset Map", content)
        self.assertIn("Pairwise distances", content)
        self.assertIn("first", content)
        self.assertIn("3.75", content)

    def test_export_ods_rejects_missing_pairwise_distances(self):
        payload = {**COMPARISON_EXPORT, "distances": []}

        response = self.client.post(
            reverse("export-ods"),
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("every dataset pair", response.json()["error"])

    def test_export_pdf_graph_returns_dataset_map_and_heatmap_pages(self):
        response = self.client.post(
            reverse("export-pdf-graph"),
            data=json.dumps(COMPARISON_EXPORT),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("attachment; filename=", response["Content-Disposition"])
        self.assertTrue(response.content.startswith(b"%PDF-"))
        self.assertEqual(len(re.findall(rb"/Type\s*/Page\b", response.content)), 2)

    def test_export_pdf_graph_rejects_invalid_comparison_data(self):
        payload = {**COMPARISON_EXPORT, "datasets": []}

        response = self.client.post(
            reverse("export-pdf-graph"),
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    def test_comparison_export_preserves_valid_dataset_colors(self):
        export_data = validate_comparison_export(COMPARISON_EXPORT)

        self.assertEqual(
            [dataset["color"] for dataset in export_data["datasets"]],
            ["#F4A6A6", "#9CCBE8"],
        )

    @patch("core.services.latex_report.shutil.which")
    @patch("core.services.latex_report.subprocess.run")
    def test_export_latex_report_returns_compiled_pdf(
        self,
        run_compiler,
        find_compiler,
    ):
        find_compiler.side_effect = lambda name: "tectonic.exe" if name == "tectonic" else None

        def create_pdf(command, **options):
            output_path = Path(options["cwd"]) / "dataset-comparison.pdf"
            output_path.write_bytes(b"%PDF-1.7\ncompiled report")
            return run_compiler.return_value

        run_compiler.return_value.returncode = 0
        run_compiler.return_value.stdout = ""
        run_compiler.return_value.stderr = ""
        run_compiler.side_effect = create_pdf

        response = self.client.post(
            reverse("export-latex-report"),
            data=json.dumps(COMPARISON_EXPORT),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn('filename="dataset-comparison.pdf"', response["Content-Disposition"])
        self.assertTrue(response.content.startswith(b"%PDF-"))
        self.assertEqual(run_compiler.call_args.args[0][0], "tectonic.exe")

    def test_export_latex_report_escapes_special_dataset_name_characters(self):
        payload = {
            **COMPARISON_EXPORT,
            "datasets": [
                {**COMPARISON_EXPORT["datasets"][0], "name": "first_#"},
                COMPARISON_EXPORT["datasets"][1],
            ],
        }

        report = _latex_source(payload)

        self.assertIn(r"first\_\#", report)

    @patch("core.services.latex_report.shutil.which", return_value=None)
    def test_export_latex_report_reports_missing_compiler(self, _find_compiler):
        response = self.client.post(
            reverse("export-latex-report"),
            data=json.dumps(COMPARISON_EXPORT),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 503)
        self.assertIn("Tectonic or pdflatex", response.json()["error"])

    def test_export_latex_report_rejects_invalid_comparison_data(self):
        payload = {**COMPARISON_EXPORT, "datasets": []}

        response = self.client.post(
            reverse("export-latex-report"),
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
