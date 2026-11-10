# time_series_visualization_comparison
This is a project for our 3rd year in engineering school about time series, their interactive visualization and the comparison of similarities between between different datas.

## Dataset upload

The uploader accepts the existing whitespace-delimited `.txt` format as well as
`.ts` and `.arff` files. `.ts` and `.arff` files are parsed by aeon on the server;
the existing `.txt` parser remains in the browser. Multivariate `.ts` files are
imported as one dataset containing all dimensions. Upload each `.arff` file
separately to select and compare dimensions independently; ARFF files already
split by dimension (for example `NameDimension1_TRAIN.arff`) are imported as
individual datasets.

## LaTeX report export

The LaTeX report export compiles its generated `.tex` source to a downloadable
PDF on the server. Install Tectonic and make its executable available on `PATH`;
Tectonic is recommended because it downloads required LaTeX packages
automatically. `pdflatex` is also supported when a LaTeX distribution with
TikZ, `booktabs`, `float`, and `xcolor` is installed.

The first Tectonic compilation may need internet access to download LaTeX
packages. If neither compiler is available, the export endpoint returns an
explicit error instead of downloading an uncompiled source file.
