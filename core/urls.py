from django.urls import path

from . import views


urlpatterns = [
    path("", views.index, name="index"),
    path("datasets/import/", views.import_datasets, name="import-datasets"),
    path("export/", views.export_page, name="export-page"),
    path("export/ods/", views.export_ods, name="export-ods"),
    path("export/pdf-graph/", views.export_pdf_graph, name="export-pdf-graph"),
    path("export/latex-report/", views.export_latex_report, name="export-latex-report"),
    path("compare/", views.compare_datasets, name="compare-datasets"),
]