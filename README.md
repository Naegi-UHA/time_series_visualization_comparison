# time_series_visualization_comparison
This is a project for our 3rd year in engineering school about time series, their interactive visualization and the comparison of similarities between between different datas.

## LaTeX report export

The LaTeX report export compiles its generated `.tex` source to a downloadable
PDF on the server. Install Tectonic and make its executable available on `PATH`;
Tectonic is recommended because it downloads required LaTeX packages
automatically. `pdflatex` is also supported when a LaTeX distribution with
TikZ, `booktabs`, `float`, and `xcolor` is installed.

The first Tectonic compilation may need internet access to download LaTeX
packages. If neither compiler is available, the export endpoint returns an
explicit error instead of downloading an uncompiled source file.
