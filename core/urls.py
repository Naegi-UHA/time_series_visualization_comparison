from django.urls import path

from . import views


urlpatterns = [
    path("", views.index, name="index"),
    path("compare/", views.compare_datasets, name="compare-datasets"),
]