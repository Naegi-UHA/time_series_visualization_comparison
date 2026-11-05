from django.urls import path

from . import views


urlpatterns = [
    path("", views.index, name="index"),
    path("export/", views.export_page, name="export-page"),
    path("export/ods/", views.export_ods, name="export-ods"),
    path("compare/", views.compare_datasets, name="compare-datasets"),
]