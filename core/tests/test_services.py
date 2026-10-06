import numpy as np
from django.test import SimpleTestCase

from core.services.distance import (
    classical_mds,
    mean_pairwise_distance,
    pairwise_dataset_distances,
)


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

    def test_calculates_one_distance_per_dataset_pair(self):
        datasets = [[[0.0, 1.0]], [[1.0, 2.0]], [[4.0, 5.0]]]

        distances = pairwise_dataset_distances(datasets, "dtw")

        self.assertEqual(distances.shape, (3, 3))
        self.assertTrue((distances.diagonal() == 0).all())
        self.assertTrue((distances == distances.T).all())

    def test_projects_pairwise_distances_to_two_dimensions(self):
        distances = np.array([
            [0.0, 1.0, 2.0],
            [1.0, 0.0, 1.0],
            [2.0, 1.0, 0.0],
        ])

        coordinates = classical_mds(distances)

        self.assertEqual(coordinates.shape, (3, 2))
        self.assertAlmostEqual(
            np.linalg.norm(coordinates[0] - coordinates[2]),
            2.0,
        )
