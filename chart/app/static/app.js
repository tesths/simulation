(function () {
  const Y_LABEL_STEPS = [0, 20, 40, 60, 80, 100];
  const OVERLAY_GROUP_COLORS = [
    "#2563eb",
    "#e35d47",
    "#059669",
    "#d97706",
    "#7c3aed",
    "#0f766e",
    "#db2777",
    "#4f46e5",
    "#65a30d",
    "#c2410c",
    "#0284c7",
    "#be123c",
    "#16a34a",
    "#8b5cf6",
    "#0891b2",
    "#ea580c",
    "#ca8a04",
    "#3b82f6",
    "#ec4899",
    "#22c55e",
  ];
  const OVERLAY_EXPAND_LABEL = "查看全班叠加图";
  const OVERLAY_COLLAPSE_LABEL = "收起全班叠加图";

  function createSvgElement(name, attributes = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attributes).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        return;
      }
      element.setAttribute(key, String(value));
    });
    return element;
  }

  function setStatus(message, isError = false) {
    const status = document.getElementById("save-status");
    if (!status) {
      return;
    }
    status.textContent = message;
    status.style.color = isError ? "#b42318" : "#1d4ed8";
  }

  function parseJson(value) {
    try {
      return JSON.parse(value || "null");
    } catch {
      return null;
    }
  }

  function renderEmptyChart(container, title) {
    container.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = title || "还没有填写数据";
    container.appendChild(empty);
  }

  function xPosition(labelCount, index, chartWidth, paddingLeft) {
    if (labelCount === 1) {
      return paddingLeft + chartWidth / 2;
    }
    return paddingLeft + (index / (labelCount - 1)) * chartWidth;
  }

  function yPosition(value, yMin, yMax, chartHeight, paddingTop) {
    return paddingTop + ((yMax - value) / (yMax - yMin || 1)) * chartHeight;
  }

  function buildSeriesPoints(payload, values, geometry) {
    return values.map((value, index) => ({
      x: xPosition(
        payload.labels.length,
        index,
        geometry.chartWidth,
        geometry.padding.left,
      ),
      y: yPosition(
        value,
        geometry.yMin,
        geometry.yMax,
        geometry.chartHeight,
        geometry.padding.top,
      ),
    }));
  }

  function drawAxes(svg, payload, geometry, style) {
    Y_LABEL_STEPS.forEach((value) => {
      const y = yPosition(
        value,
        geometry.yMin,
        geometry.yMax,
        geometry.chartHeight,
        geometry.padding.top,
      );
      svg.appendChild(
        createSvgElement("line", {
          x1: geometry.padding.left,
          y1: y,
          x2: geometry.width - geometry.padding.right,
          y2: y,
          stroke: style.gridColor,
          "stroke-width": 1,
        }),
      );
      const label = createSvgElement("text", {
        x: geometry.padding.left - 8,
        y: y + 5,
        fill: style.textColor,
        "font-size": style.labelSize,
        "font-weight": 700,
        "text-anchor": "end",
      });
      label.textContent = String(value);
      svg.appendChild(label);
    });

    payload.labels.forEach((labelValue, index) => {
      const x = xPosition(
        payload.labels.length,
        index,
        geometry.chartWidth,
        geometry.padding.left,
      );
      svg.appendChild(
        createSvgElement("line", {
          x1: x,
          y1: geometry.padding.top,
          x2: x,
          y2: geometry.height - geometry.padding.bottom,
          stroke: style.gridColor,
          "stroke-width": 1,
        }),
      );
      const label = createSvgElement("text", {
        x,
        y: geometry.height - geometry.padding.bottom + 28,
        fill: style.textColor,
        "font-size": style.labelSize,
        "font-weight": 700,
        "text-anchor": "middle",
      });
      label.textContent = String(labelValue);
      svg.appendChild(label);
    });

    svg.appendChild(
      createSvgElement("rect", {
        x: geometry.padding.left,
        y: geometry.padding.top,
        width: geometry.chartWidth,
        height: geometry.chartHeight,
        fill: "none",
        stroke: style.axisColor,
        "stroke-width": 1.4,
        rx: 10,
      }),
    );
  }

  function renderChart(container, payload, options = {}) {
    if (!container) {
      return;
    }

    if (!payload || !payload.has_data) {
      renderEmptyChart(container, "还没有填写数据");
      return;
    }

    const variant = options.variant || "student";
    const isDashboard = variant === "dashboard";
    const width = 680;
    const height = isDashboard ? 400 : 420;
    const padding = isDashboard
      ? { top: 32, right: 22, bottom: 58, left: 54 }
      : { top: 26, right: 18, bottom: 56, left: 50 };
    const geometry = {
      width,
      height,
      padding,
      chartWidth: width - padding.left - padding.right,
      chartHeight: height - padding.top - padding.bottom,
      yMin: payload.y_axis.min,
      yMax: payload.y_axis.max,
    };
    const style = {
      textColor: "#56657a",
      gridColor: "#d4deea",
      axisColor: "#9fb1c5",
      labelSize: isDashboard ? 14 : 12,
      legendSize: isDashboard ? 15 : 13,
      titleColor: "#163047",
    };

    container.innerHTML = "";

    const svg = createSvgElement("svg", {
      viewBox: `0 0 ${width} ${height}`,
      class: "chart-svg",
      role: "img",
      "aria-label": `${payload.group_name} 温度变化折线图`,
      preserveAspectRatio: "none",
    });

    drawAxes(svg, payload, geometry, style);

    payload.series.forEach((series, seriesIndex) => {
      const points = buildSeriesPoints(payload, series.values, geometry);
      svg.appendChild(
        createSvgElement("polyline", {
          fill: "none",
          stroke: series.color,
          "stroke-width": isDashboard ? 4 : 3.5,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          points: points.map(({ x, y }) => `${x},${y}`).join(" "),
        }),
      );

      points.forEach(({ x, y }) => {
        svg.appendChild(
          createSvgElement("circle", {
            cx: x,
            cy: y,
            r: isDashboard ? 4.8 : 4,
            fill: series.color,
            stroke: "#ffffff",
            "stroke-width": 2,
          }),
        );
      });

      const legendX = padding.left + 16 + seriesIndex * 146;
      svg.appendChild(
        createSvgElement("line", {
          x1: legendX,
          y1: 16,
          x2: legendX + 28,
          y2: 16,
          stroke: series.color,
          "stroke-width": 5,
          "stroke-linecap": "round",
        }),
      );
      const legendText = createSvgElement("text", {
        x: legendX + 36,
        y: 21,
        fill: style.titleColor,
        "font-size": style.legendSize,
        "font-weight": 700,
      });
      legendText.textContent = series.name;
      svg.appendChild(legendText);
    });

    container.appendChild(svg);
  }

  function overlayGroupColor(index) {
    return OVERLAY_GROUP_COLORS[index % OVERLAY_GROUP_COLORS.length];
  }

  function readOverlayState(dashboard) {
    const groups = Array.from(
      dashboard.querySelectorAll("[data-chart-card]"),
      (card, overlayIndex) => {
        const payload = parseJson(card.dataset.chart);
        if (!payload) {
          return null;
        }
        return { ...payload, overlayIndex };
      },
    ).filter(Boolean);

    return {
      classroomName: dashboard.dataset.currentClassroomName || "当前班级",
      totalGroupCount: groups.length,
      groupsWithData: groups.filter((group) => group.has_data),
    };
  }

  function renderOverlayLegend(container, groupsWithData) {
    container.innerHTML = "";
    groupsWithData.forEach((group) => {
      const item = document.createElement("span");
      item.className = "overlay-legend-item";
      item.style.setProperty(
        "--overlay-group-color",
        overlayGroupColor(group.overlayIndex),
      );

      const swatch = document.createElement("span");
      swatch.className = "overlay-legend-swatch";
      item.appendChild(swatch);

      const label = document.createElement("span");
      label.textContent = group.group_name;
      item.appendChild(label);

      container.appendChild(item);
    });
  }

  function renderOverlayChart(container, overlayState) {
    if (!container) {
      return;
    }

    if (!overlayState.groupsWithData.length) {
      renderEmptyChart(
        container,
        "还没有可叠加的数据，请先让至少一个小组提交记录",
      );
      return;
    }

    const referencePayload = overlayState.groupsWithData[0];
    const width = 1040;
    const height = 520;
    const padding = { top: 24, right: 28, bottom: 64, left: 58 };
    const geometry = {
      width,
      height,
      padding,
      chartWidth: width - padding.left - padding.right,
      chartHeight: height - padding.top - padding.bottom,
      yMin: referencePayload.y_axis.min,
      yMax: referencePayload.y_axis.max,
    };
    const style = {
      textColor: "#56657a",
      gridColor: "#d4deea",
      axisColor: "#9fb1c5",
      labelSize: 14,
    };

    container.innerHTML = "";

    const svg = createSvgElement("svg", {
      viewBox: `0 0 ${width} ${height}`,
      class: "chart-svg",
      role: "img",
      "aria-label": `${overlayState.classroomName}全班叠加温度变化折线图`,
      preserveAspectRatio: "none",
    });

    drawAxes(svg, referencePayload, geometry, style);

    overlayState.groupsWithData.forEach((group) => {
      const groupColor = overlayGroupColor(group.overlayIndex);
      group.series.forEach((series) => {
        const points = buildSeriesPoints(referencePayload, series.values, geometry);
        svg.appendChild(
          createSvgElement("polyline", {
            fill: "none",
            stroke: groupColor,
            "stroke-width": 3,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            "stroke-dasharray": series.key === "hot" ? "10 8" : null,
            points: points.map(({ x, y }) => `${x},${y}`).join(" "),
          }),
        );

        points.forEach(({ x, y }) => {
          svg.appendChild(
            createSvgElement("circle", {
              cx: x,
              cy: y,
              r: 2.6,
              fill: groupColor,
              stroke: "#ffffff",
              "stroke-width": 1.2,
            }),
          );
        });
      });
    });

    container.appendChild(svg);
  }

  function syncDashboardOverlay(dashboard, forceRenderChart = false) {
    const panel = dashboard.querySelector("[data-overlay-panel]");
    const summary = dashboard.querySelector("[data-overlay-summary]");
    const legend = dashboard.querySelector("[data-overlay-legend]");
    const stage = dashboard.querySelector("[data-overlay-stage]");
    if (!panel || !summary || !legend || !stage) {
      return;
    }

    const overlayState = readOverlayState(dashboard);
    summary.textContent = `已填写 ${overlayState.groupsWithData.length} / ${overlayState.totalGroupCount} 组`;
    renderOverlayLegend(legend, overlayState.groupsWithData);

    if (forceRenderChart || !panel.hidden) {
      renderOverlayChart(stage, overlayState);
      return;
    }

    stage.innerHTML = "";
  }

  function setOverlayExpanded(dashboard, isExpanded) {
    const panel = dashboard.querySelector("[data-overlay-panel]");
    const toggle = dashboard.querySelector("[data-overlay-toggle]");
    if (!panel || !toggle) {
      return;
    }

    const page = dashboard.closest(".teacher-page");
    panel.hidden = !isExpanded;
    panel.setAttribute("aria-hidden", String(!isExpanded));
    toggle.textContent = isExpanded
      ? OVERLAY_COLLAPSE_LABEL
      : OVERLAY_EXPAND_LABEL;
    toggle.setAttribute("aria-expanded", String(isExpanded));
    dashboard.classList.toggle("teacher-screen-expanded", isExpanded);
    if (page) {
      page.classList.toggle("teacher-page-expanded", isExpanded);
    }

    if (isExpanded) {
      syncDashboardOverlay(dashboard, true);
      return;
    }

    const stage = dashboard.querySelector("[data-overlay-stage]");
    if (stage) {
      stage.innerHTML = "";
    }
  }

  async function submitStudentForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    const chartContainer = document.querySelector("[data-student-chart]");
    const formData = new FormData(form);

    submitButton.disabled = true;
    setStatus("正在保存...");

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("保存失败，请检查输入数据");
      }

      const payload = await response.json();
      chartContainer.dataset.chart = JSON.stringify(payload);
      renderChart(chartContainer, payload, { variant: "student" });
      setStatus("保存成功，折线图已更新。");
    } catch (error) {
      setStatus(error.message || "保存失败，请稍后再试。", true);
    } finally {
      submitButton.disabled = false;
    }
  }

  function initStudentPage() {
    const form = document.getElementById("record-form");
    const chartContainer = document.querySelector("[data-student-chart]");
    if (!form || !chartContainer) {
      return;
    }

    const initialPayload = parseJson(chartContainer.dataset.chart);
    renderChart(chartContainer, initialPayload, { variant: "student" });
    form.addEventListener("submit", submitStudentForm);
  }

  function renderDashboardCard(card, payload) {
    const stage = card.querySelector("[data-chart-stage]");
    const dateNode = card.querySelector("[data-chart-date]");
    renderChart(stage, payload, { variant: "dashboard" });
    dateNode.textContent = payload.record_date ? payload.record_date : "未填写";
    card.dataset.chart = JSON.stringify(payload);
  }

  async function refreshGroupCard(dashboard, groupId) {
    const card = dashboard.querySelector(`[data-group-id="${groupId}"]`);
    if (!card) {
      return;
    }

    const response = await fetch(`/api/charts/group/${groupId}`);
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    renderDashboardCard(card, payload);
    const overlayPanel = dashboard.querySelector("[data-overlay-panel]");
    syncDashboardOverlay(dashboard, Boolean(overlayPanel && !overlayPanel.hidden));
  }

  function initTeacherPage() {
    const dashboard = document.querySelector("[data-teacher-dashboard]");
    if (!dashboard) {
      return;
    }

    const currentClassroomId = Number(
      dashboard.dataset.currentClassroomId || "0",
    );
    const cards = Array.from(dashboard.querySelectorAll("[data-chart-card]"));
    cards.forEach((card) => {
      const payload = parseJson(card.dataset.chart);
      renderDashboardCard(card, payload);
    });

    syncDashboardOverlay(dashboard, false);

    const overlayToggle = dashboard.querySelector("[data-overlay-toggle]");
    if (overlayToggle) {
      overlayToggle.addEventListener("click", () => {
        const overlayPanel = dashboard.querySelector("[data-overlay-panel]");
        if (!overlayPanel) {
          return;
        }
        setOverlayExpanded(dashboard, overlayPanel.hidden);
      });
    }

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    let socket = null;
    let reconnectTimer = null;

    const connect = () => {
      socket = new WebSocket(`${protocol}://${window.location.host}/ws/teacher`);

      socket.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        if (
          message.type === "group-updated" &&
          message.classroom_id === currentClassroomId
        ) {
          await refreshGroupCard(dashboard, message.group_id);
        }
      };

      socket.onclose = () => {
        if (reconnectTimer) {
          window.clearTimeout(reconnectTimer);
        }
        reconnectTimer = window.setTimeout(connect, 2000);
      };
    };

    connect();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initStudentPage();
    initTeacherPage();
  });
})();
