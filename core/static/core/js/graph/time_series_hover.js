(function () {
    const hoverTooltip = document.getElementById("time-series-hover-tooltip");
    const hoverStep = document.getElementById("time-series-hover-step");
    const hoverValue = document.getElementById("time-series-hover-value");
    let activeHoverGuides = null;

    function hideHover() {
        if (activeHoverGuides) {
            activeHoverGuides.setAttribute("visibility", "hidden");
            activeHoverGuides.setAttribute("aria-hidden", "true");
        }
        hoverTooltip.hidden = true;
        hoverTooltip.setAttribute("aria-hidden", "true");
    }

    function positionTooltip(event, visualization) {
        const overlayRect = visualization.getBoundingClientRect();
        const tooltipRect = hoverTooltip.getBoundingClientRect();
        const pointerX = event.clientX - overlayRect.left;
        const pointerY = event.clientY - overlayRect.top;
        let left = pointerX + 12;
        let top = pointerY - tooltipRect.height - 12;
        if (left + tooltipRect.width > overlayRect.width - 8) {
            left = pointerX - tooltipRect.width - 12;
        }
        if (top < 8) {
            top = pointerY + 12;
        }
        left = Math.max(8, Math.min(left, overlayRect.width - tooltipRect.width - 8));
        top = Math.max(8, Math.min(top, overlayRect.height - tooltipRect.height - 8));
        hoverTooltip.style.left = `${left}px`;
        hoverTooltip.style.top = `${top}px`;
    }

    function attachHover(event) {
        hideHover();
        const {
            chart,
            visualization,
            values,
            pointCoordinates,
            plotLeft,
            plotWidth,
            plotBottom,
        } = event.detail;
        const points = pointCoordinates.map(({ x, y }) => `${x},${y}`).join(" ");
        const hoverTarget = values.length === 1
            ? document.createElementNS("http://www.w3.org/2000/svg", "circle")
            : document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        hoverTarget.setAttribute("class", values.length === 1
            ? "time-series-hover-target-point"
            : "time-series-hover-target");
        if (values.length === 1) {
            hoverTarget.setAttribute("cx", pointCoordinates[0].x);
            hoverTarget.setAttribute("cy", pointCoordinates[0].y);
            hoverTarget.setAttribute("r", "12");
        } else {
            hoverTarget.setAttribute("points", points);
        }

        const guides = document.createElementNS("http://www.w3.org/2000/svg", "g");
        guides.setAttribute("class", "time-series-hover-guides");
        guides.setAttribute("visibility", "hidden");
        guides.setAttribute("aria-hidden", "true");
        const verticalGuide = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const horizontalGuide = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const marker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        verticalGuide.setAttribute("class", "time-series-hover-guide");
        horizontalGuide.setAttribute("class", "time-series-hover-guide");
        marker.setAttribute("r", "5");
        marker.setAttribute("class", "time-series-hover-marker");
        guides.append(verticalGuide, horizontalGuide, marker);
        chart.append(hoverTarget, guides);
        activeHoverGuides = guides;

        hoverTarget.addEventListener("pointermove", (pointerEvent) => {
            const screenMatrix = chart.getScreenCTM();
            if (!screenMatrix) {
                return;
            }
            const pointer = chart.createSVGPoint();
            pointer.x = pointerEvent.clientX;
            pointer.y = pointerEvent.clientY;
            const plotPointer = pointer.matrixTransform(screenMatrix.inverse());
            const stepIndex = values.length === 1
                ? 0
                : Math.max(0, Math.min(
                    values.length - 1,
                    Math.round((plotPointer.x - plotLeft) / plotWidth * (values.length - 1))
                ));
            const { x, y } = pointCoordinates[stepIndex];
            verticalGuide.setAttribute("x1", x);
            verticalGuide.setAttribute("x2", x);
            verticalGuide.setAttribute("y1", y);
            verticalGuide.setAttribute("y2", plotBottom);
            horizontalGuide.setAttribute("x1", plotLeft);
            horizontalGuide.setAttribute("x2", x);
            horizontalGuide.setAttribute("y1", y);
            horizontalGuide.setAttribute("y2", y);
            marker.setAttribute("cx", x);
            marker.setAttribute("cy", y);
            guides.setAttribute("visibility", "visible");
            guides.setAttribute("aria-hidden", "false");

            hoverStep.textContent = String(stepIndex + 1);
            hoverValue.textContent = Number(values[stepIndex].toPrecision(6)).toString();
            hoverTooltip.hidden = false;
            hoverTooltip.setAttribute("aria-hidden", "false");
            positionTooltip(pointerEvent, visualization);
        });
        hoverTarget.addEventListener("pointerleave", () => {
            if (activeHoverGuides === guides) {
                hideHover();
            }
        });
    }

    document.addEventListener("timeseriesplotrendered", attachHover);
    document.addEventListener("timeserieshoverhide", hideHover);
})();
