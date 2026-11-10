import numpy as np
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase

from core.services.dataset_import import import_time_series_files
from core.services.distance import (
    mean_pairwise_distance,
    pairwise_dataset_distances,
    tsne_projection,
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

    def test_distance_supports_multivariate_time_series(self):
        distance = mean_pairwise_distance(
            [[[0.0, 1.0, 2.0], [1.0, 2.0, 3.0]]],
            [[[0.0, 2.0, 3.0], [1.0, 3.0, 4.0]]],
            "dtw",
        )

        self.assertEqual(distance, 4.0)

    def test_distance_rejects_different_dimension_counts(self):
        with self.assertRaisesMessage(ValueError, "same number of dimensions"):
            mean_pairwise_distance(
                [[[0.0, 1.0]]],
                [[[0.0, 1.0], [1.0, 2.0]]],
                "dtw",
            )

    def test_imports_multivariate_ts_as_one_dataset(self):
        content = b"""@problemName SmallMultivariate
@timestamps false
@missing false
@univariate false
@dimensions 2
@equalLength true
@classLabel true A B
@data
1,2,3:4,5,6:A
2,3,4:5,6,7:B
"""
        uploaded_file = SimpleUploadedFile("small.ts", content)

        datasets = import_time_series_files([uploaded_file])

        self.assertEqual([dataset["name"] for dataset in datasets], ["small"])
        self.assertEqual(datasets[0]["dimensions"], 2)
        self.assertEqual(datasets[0]["series"][0], {
            "label": "a",
            "series": [
                [1.0, 2.0, 3.0],
                [4.0, 5.0, 6.0],
            ],
        })
        self.assertTrue(np.isfinite(mean_pairwise_distance(
            [item["series"] for item in datasets[0]["series"]],
            [item["series"] for item in datasets[0]["series"]],
            "dtw",
        )))

    def test_imports_dimension_split_arff_files_separately(self):
        first_dimension = b"""@relation MotionDimension1
@attribute t1 numeric
@attribute t2 numeric
@attribute class {A,B}
@data
1,2,A
3,4,B
"""
        second_dimension = b"""@relation MotionDimension2
@attribute t1 numeric
@attribute t2 numeric
@attribute class {A,B}
@data
5,6,A
7,8,B
"""
        files = [
            SimpleUploadedFile("MotionDimension1_TRAIN.arff", first_dimension),
            SimpleUploadedFile("MotionDimension2_TRAIN.arff", second_dimension),
        ]

        datasets = import_time_series_files(files)

        self.assertEqual([dataset["name"] for dataset in datasets], [
            "Motion_TRAIN_Dimension1",
            "Motion_TRAIN_Dimension2",
        ])
        self.assertEqual([dataset["dimensions"] for dataset in datasets], [1, 1])
        self.assertEqual(datasets[0]["series"][1], {
            "label": "B",
            "series": [3.0, 4.0],
        })
        self.assertEqual(datasets[1]["series"][1], {
            "label": "B",
            "series": [7.0, 8.0],
        })

    def test_import_allows_selecting_one_dimension_split_arff(self):
        content = b"""@relation MotionDimension2
@attribute t1 numeric
@attribute class {A}
@data
1,A
"""
        uploaded_file = SimpleUploadedFile("MotionDimension2_TRAIN.arff", content)

        datasets = import_time_series_files([uploaded_file])

        self.assertEqual(len(datasets), 1)
        self.assertEqual(datasets[0]["name"], "Motion_TRAIN_Dimension2")
        self.assertEqual(datasets[0]["dimensions"], 1)

    def test_calculates_one_distance_per_dataset_pair(self):
        datasets = [[[0.0, 1.0]], [[1.0, 2.0]], [[4.0, 5.0]]]

        distances = pairwise_dataset_distances(datasets, "dtw")

        self.assertEqual(distances.shape, (3, 3))
        self.assertTrue((distances.diagonal() == 0).all())
        self.assertTrue((distances == distances.T).all())

    def test_projects_pairwise_distances_to_two_dimensions_with_tsne(self):
        distances = np.array([
            [0.0, 1.0, 2.0],
            [1.0, 0.0, 1.0],
            [2.0, 1.0, 0.0],
        ])

        coordinates = tsne_projection(distances)

        self.assertEqual(coordinates.shape, (3, 2))
        self.assertTrue(np.isfinite(coordinates).all())
        np.testing.assert_array_equal(coordinates, tsne_projection(distances))

    def test_tsne_projection_supports_two_datasets(self):
        distances = np.array([
            [0.0, 1.0],
            [1.0, 0.0],
        ])

        coordinates = tsne_projection(distances)

        self.assertEqual(coordinates.shape, (2, 2))
        self.assertTrue(np.isfinite(coordinates).all())
