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

    def test_distance_averages_all_crossed_dimension_pairs(self):
        distance = mean_pairwise_distance(
            [[[0.0, 1.0, 2.0], [1.0, 2.0, 3.0]]],
            [[[0.0, 2.0, 3.0], [1.0, 3.0, 4.0]]],
            "dtw",
        )

        self.assertEqual(distance, 2.75)

    def test_distance_supports_different_dimension_counts(self):
        distance = mean_pairwise_distance(
            [[[0.0, 0.0], [10.0, 10.0]]],
            [[[0.0, 0.0]]],
            "dtw",
        )

        self.assertEqual(distance, 100.0)

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

    def test_representative_strategies_support_different_dimension_counts(self):
        datasets = [
            [
                [[0.0, 1.0, 2.0], [1.0, 2.0, 3.0]],
                [[0.0, 2.0, 3.0], [2.0, 3.0, 4.0]],
            ],
            [
                [[0.0, 1.0, 2.0]],
                [[1.0, 2.0, 3.0]],
            ],
        ]
        strategies = ("eba", "medoid", "subgradient")

        for strategy in strategies:
            representative_parameters = {}
            if strategy in {"eba", "subgradient"}:
                representative_parameters.update(max_iters=2, tol=1e-5)
            if strategy == "subgradient":
                representative_parameters.update(
                    initial_step_size=0.05,
                    final_step_size=0.005,
                )

            with self.subTest(strategy=strategy):
                distances = pairwise_dataset_distances(
                    datasets,
                    "dtw",
                    strategy,
                    {"window": 0.5},
                    representative_parameters,
                )

                self.assertEqual(distances.shape, (2, 2))
                self.assertTrue(np.isfinite(distances).all())
                self.assertTrue((distances == distances.T).all())

    def test_barycenter_strategies_reject_unequal_series_lengths(self):
        datasets = [
            [[0.0, 1.0], [0.0, 1.0, 2.0]],
            [[0.0, 1.0], [0.0, 1.0, 2.0]],
        ]

        with self.assertRaisesRegex(ValueError, "requires equal-length"):
            pairwise_dataset_distances(datasets, "dtw", "eba")

    def test_distance_methods_accept_window_and_slope_with_eba_selection(self):
        datasets = [
            [
                [0.0, 1.0, 0.0, 2.0, 1.0, 3.0, 2.0, 4.0],
                [1.0, 0.0, 2.0, 1.0, 3.0, 2.0, 4.0, 3.0],
            ],
            [
                [0.5, 1.5, 0.5, 2.5, 1.5, 3.5, 2.5, 4.5],
                [1.5, 0.5, 2.5, 1.5, 3.5, 2.5, 4.5, 3.5],
            ],
        ]
        methods = (
            "dtw",
            "dtw_gi",
            "shape_dtw",
            "ddtw",
            "wdtw",
            "wddtw",
            "adtw",
            "soft_dtw",
            "msm",
            "twe",
        )

        for method in methods:
            distance_parameters = {
                "window": 0.5,
                "itakura_max_slope": 0.5,
            }
            with self.subTest(method=method):
                distances = pairwise_dataset_distances(
                    datasets,
                    method,
                    "eba",
                    distance_parameters,
                )

                self.assertTrue(np.isfinite(distances).all())
                self.assertEqual(distances.shape, (2, 2))

    def test_rejects_nonpositive_barycenter_parameters(self):
        datasets = [[[0.0, 1.0]], [[1.0, 2.0]]]

        with self.assertRaises(ValueError):
            pairwise_dataset_distances(
                datasets,
                "dtw",
                "eba",
                representative_parameters={"tol": 0},
            )

        with self.assertRaises(ValueError):
            mean_pairwise_distance(
                [[0.0, 1.0]],
                [[1.0, 2.0]],
                "twe",
                {"nu": 0},
            )

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
