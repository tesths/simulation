(function () {
  const Y_LABEL_STEPS = [0, 20, 40, 60, 80, 100];

  function createSvgElement(name, attributes = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attributes).forEach(([key, value]) => {
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

  function renderEmptyChart(container, title) {
    container.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = title || "还没有填写数据";
    container.appendChild(empty);
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

    container.innerHTML = "";

    const width = 680;
    const height = isDashboard ? 400 : 420;
    const padding = isDashboard
      ? { top: 32, right: 22, bottom: 58, left: 54 }
      : { top: 26, right: 18, bottom: 56, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const yMin = payload.y_axis.min;
    const yMax = payload.y_axis.max;
    const textColor = "#56657a";
    const gridColor = "#d4deea";
    const axisColor = "#9fb1c5";
    const labelSize = isDashboard ? 14 : 12;
    const legendSize = isDashboard ? 15 : 13;
    const titleColor = "#163047";

    const svg = createSvgElement("svg", {
      viewBox: `0 0 ${width} ${height}`,
      class: "chart-svg",
      role: "img",
      "aria-label": `${payload.group_name} 温度变化折线图`,
      preserveAspectRatio: "none",
    });

    Y_LABEL_STEPS.forEach((value) => {
      const y =
        padding.top + ((yMax - value) / (yMax - yMin || 1)) * chartHeight;
      svg.appendChild(
        createSvgElement("line", {
          x1: padding.left,
          y1: y,
          x2: width - padding.right,
          y2: y,
          stroke: gridColor,
          "stroke-width": 1,
        }),
      );
      const label = createSvgElement("text", {
        x: padding.left - 8,
        y: y + 5,
        fill: textColor,
        "font-size": labelSize,
        "font-weight": 700,
        "text-anchor": "end",
      });
      label.textContent = String(value);
      svg.appendChild(label);
    });

    payload.labels.forEach((labelValue, index) => {
      const x =
        padding.left +
        (payload.labels.length === 1
          ? chartWidth / 2
          : (index / (payload.labels.length - 1)) * chartWidth);
      svg.appendChild(
        createSvgElement("line", {
          x1: x,
          y1: padding.top,
          x2: x,
          y2: height - padding.bottom,
          stroke: gridColor,
          "stroke-width": 1,
        }),
      );
      const label = createSvgElement("text", {
        x,
        y: height - padding.bottom + 28,
        fill: textColor,
        "font-size": labelSize,
        "font-weight": 700,
        "text-anchor": "middle",
      });
      label.textContent = String(labelValue);
      svg.appendChild(label);
    });

    svg.appendChild(
      createSvgElement("rect", {
        x: padding.left,
        y: padding.top,
        width: chartWidth,
        height: chartHeight,
        fill: "none",
        stroke: axisColor,
        "stroke-width": 1.4,
        rx: 10,
      }),
    );

    payload.series.forEach((series, seriesIndex) => {
      const points = series.values.map((value, index) => {
        const x =
          padding.left +
          (payload.labels.length === 1
            ? chartWidth / 2
            : (index / (payload.labels.length - 1)) * chartWidth);
        const y =
          padding.top + ((yMax - value) / (yMax - yMin || 1)) * chartHeight;
        return { x, y };
      });

      const polyline = createSvgElement("polyline", {
        fill: "none",
        stroke: series.color,
        "stroke-width": isDashboard ? 4 : 3.5,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        points: points.map(({ x, y }) => `${x},${y}`).join(" "),
      });
      svg.appendChild(polyline);

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
        fill: titleColor,
        "font-size": legendSize,
        "font-weight": 700,
      });
      legendText.textContent = series.name;
      svg.appendChild(legendText);
    });

    container.appendChild(svg);
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

    const initialPayload = JSON.parse(chartContainer.dataset.chart || "null");
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

  async function refreshGroupCard(groupId) {
    const card = document.querySelector(`[data-group-id="${groupId}"]`);
    if (!card) {
      return;
    }

    const response = await fetch(`/api/charts/group/${groupId}`);
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    renderDashboardCard(card, payload);
  }

  function initTeacherPage() {
    const dashboard = document.querySelector("[data-teacher-dashboard]");
    if (!dashboard) {
      return;
    }

    const currentClassroomId = Number(
      dashboard.dataset.currentClassroomId || "0",
    );
    const cards = Array.from(document.querySelectorAll("[data-chart-card]"));
    cards.forEach((card) => {
      const payload = JSON.parse(card.dataset.chart || "null");
      renderDashboardCard(card, payload);
    });

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
          await refreshGroupCard(message.group_id);
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
