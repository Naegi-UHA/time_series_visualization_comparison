import json
import zipfile
from io import BytesIO

from django.test import SimpleTestCase
from django.urls import reverse


COMPARISON_EXPORT = {
    "method": "dtw",
    "datasets": [
        {"name": "first", "x": -1.25, "y": 2.5},
        {"name": "second", "x": 1.25, "y": -2.5},
    ],
    "distances": [{"indices": [0, 1], "distance": 3.75}],
}


class DatasetComparisonViewTests(SimpleTestCase):
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

    def test_export_page_renders_format_picker(self):
        response = self.client.get(reverse("export-page"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, ".csv")
        self.assertContains(response, ".ods")

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
