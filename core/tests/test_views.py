import json

from django.test import SimpleTestCase
from django.urls import reverse


class DatasetComparisonViewTests(SimpleTestCase):
    def test_compare_endpoint_returns_distance_for_two_sets(self):
        response = self.client.post(
            reverse("compare-datasets"),
            data=json.dumps({
                "method": "DTW",
                "datasets": [
                    {"name": "first", "series": [{"series": [0.0, 1.0, 2.0]}]},
                    {"name": "second", "series": [{"series": [0.0, 2.0, 3.0]}]},
                ],
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["distance"], 2.0)
        self.assertEqual(response.json()["method"], "dtw")

    def test_compare_endpoint_requires_two_sets(self):
        response = self.client.post(
            reverse("compare-datasets"),
            data=json.dumps({"method": "dtw", "datasets": []}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
