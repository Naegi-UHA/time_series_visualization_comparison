import json

from django.test import SimpleTestCase
from django.urls import reverse


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
