from django.test import SimpleTestCase

from core.services.distance import mean_pairwise_distance


class DatasetDistanceTests(SimpleTestCase):
    def test_uses_selected_distance_method(self):
        distance = mean_pairwise_distance([[0.0, 1.0, 2.0]], [[0.0, 2.0, 3.0]], "DTW")

        self.assertEqual(distance, 2.0)

    def test_rejects_unknown_distance_method(self):
        with self.assertRaises(ValueError):
            mean_pairwise_distance([[0.0]], [[1.0]], "unknown")

    def test_rejects_empty_time_series(self):
        with self.assertRaises(ValueError):
            mean_pairwise_distance([[]], [[1.0]], "dtw")
