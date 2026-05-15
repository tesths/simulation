import type { SimulationConfig, SimulationPoint } from '../simulation/modelTypes'

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const mixHexColor = (from: string, to: string, ratio: number) => {
  const safeRatio = clamp(ratio, 0, 1)
  const channels = [0, 2, 4].map((offset) => {
    const start = Number.parseInt(from.slice(1 + offset, 3 + offset), 16)
    const end = Number.parseInt(to.slice(1 + offset, 3 + offset), 16)
    const mixed = Math.round(start + (end - start) * safeRatio)

    return mixed.toString(16).padStart(2, '0')
  })

  return `#${channels.join('')}`
}

const getWaterColor = (temperatureC: number) =>
  mixHexColor('#75b3ef', '#ec9051', (temperatureC - 25) / 35)

const getMilkColor = (temperatureC: number) =>
  mixHexColor('#d6e2ff', '#fbe6bb', (temperatureC - 20) / 40)

interface LaboratorySceneProps {
  config: SimulationConfig
  currentPoint: SimulationPoint
}

interface ThermometerProps {
  x: number
  topY: number
  bottomY: number
  width: number
  bulbRadius: number
  temperatureC: number
  columnColor: string
  labelX: number
  labelY: number
  labelAlign?: 'start' | 'end'
}

const Thermometer = ({
  x,
  topY,
  bottomY,
  width,
  bulbRadius,
  temperatureC,
  columnColor,
  labelX,
  labelY,
  labelAlign = 'start',
}: ThermometerProps) => {
  const bulbCenterY = bottomY - bulbRadius
  const stemBottomY = bulbCenterY - bulbRadius * 0.88
  const stemHeight = stemBottomY - topY
  const fillRatio = clamp(temperatureC / 65, 0, 1)
  const fillHeight = Math.max(stemHeight * fillRatio, width * 0.9)
  const fillTopY = stemBottomY - fillHeight
  const thermometerLeft = x - width / 2
  const capillaryWidth = Math.max(width * 0.22, 2)
  const capillaryLeft = x - capillaryWidth / 2
  const backingWidth = Math.max(width * 0.58, capillaryWidth + 2)
  const backingLeft = x - backingWidth / 2
  const tickStartY = topY + 12
  const tickGap = stemHeight / 6.4
  const tickRightX = thermometerLeft + width + 4

  return (
    <g className="thermometer">
      <rect
        x={backingLeft}
        y={topY + 4}
        width={backingWidth}
        height={stemHeight - 8}
        rx={backingWidth / 2}
        fill="rgba(255, 252, 246, 0.8)"
      />
      <rect
        x={thermometerLeft}
        y={topY}
        width={width}
        height={stemHeight}
        rx={width / 2}
        fill="rgba(252, 254, 255, 0.92)"
        stroke="#7f95aa"
        strokeWidth="1.6"
      />
      <circle
        cx={x}
        cy={bulbCenterY}
        r={bulbRadius}
        fill="rgba(252, 254, 255, 0.95)"
        stroke="#7f95aa"
        strokeWidth="1.6"
      />
      <circle
        cx={x}
        cy={bulbCenterY}
        r={bulbRadius * 0.73}
        fill="rgba(255, 255, 255, 0.72)"
        stroke="rgba(143, 162, 182, 0.6)"
        strokeWidth="0.8"
      />
      <rect
        x={capillaryLeft}
        y={fillTopY}
        width={capillaryWidth}
        height={fillHeight}
        rx={capillaryWidth / 2}
        fill={columnColor}
      />
      <ellipse
        cx={x}
        cy={fillTopY}
        rx={capillaryWidth / 2}
        ry={Math.max(capillaryWidth * 0.28, 1.1)}
        fill={columnColor}
      />
      <circle cx={x} cy={bulbCenterY} r={bulbRadius * 0.52} fill={columnColor} />
      <path
        d={`M${thermometerLeft + width * 0.22} ${topY + 8} V${stemBottomY + bulbRadius * 0.16}`}
        fill="none"
        stroke="rgba(255,255,255,0.58)"
        strokeWidth={Math.max(width * 0.16, 1.4)}
        strokeLinecap="round"
      />
      <path
        d={Array.from({ length: 7 }, (_, index) => {
          const tickY = tickStartY + index * tickGap
          const tickLength = index % 2 === 0 ? 7 : 4.2

          return `M${tickRightX} ${tickY} h${tickLength}`
        }).join(' ')}
        stroke="rgba(108, 89, 66, 0.52)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <g transform={`translate(${labelX}, ${labelY})`}>
        <rect
          x={labelAlign === 'start' ? 0 : -72}
          y="-13"
          width="72"
          height="22"
          rx="10"
          fill="rgba(255, 252, 246, 0.96)"
          stroke="rgba(128, 98, 64, 0.18)"
        />
        <text
          x={labelAlign === 'start' ? 36 : -36}
          y="2"
          textAnchor="middle"
          className="thermometer-label"
        >
          {temperatureC.toFixed(1)}°C
        </text>
      </g>
    </g>
  )
}

export const LaboratoryScene = ({ config, currentPoint }: LaboratorySceneProps) => {
  const beakerFillRatio = clamp(
    config.beaker.wettedLengthM / config.beaker.totalHeightM,
    0.18,
    0.88,
  )
  const tubeFillRatio = clamp(
    config.testTube.milkLengthM / config.testTube.totalLengthM,
    0.08,
    0.72,
  )
  const immersedRatio = clamp(
    config.testTube.immersedLengthM / config.testTube.totalLengthM,
    0.06,
    0.66,
  )

  const beakerInnerTopY = 66
  const beakerInnerBottomY = 302
  const beakerInnerHeight = beakerInnerBottomY - beakerInnerTopY
  const waterTopY = beakerInnerBottomY - beakerInnerHeight * beakerFillRatio

  const tubeInnerTopY = 26
  const tubeInnerBottomY = 272
  const tubeInnerHeight = tubeInnerBottomY - tubeInnerTopY
  const milkTopY = tubeInnerBottomY - tubeInnerHeight * tubeFillRatio
  const immersionTopY = tubeInnerBottomY - tubeInnerHeight * immersedRatio

  const waterColor = getWaterColor(currentPoint.waterTempC)
  const milkColor = getMilkColor(currentPoint.milkTempC)

  return (
    <div className="scene-stack">
      <svg
        className="laboratory-scene"
        viewBox="16 -4 382 320"
        role="img"
        aria-label="带实时温度计的烧杯和试管温度模拟"
      >
        <defs>
          <linearGradient id="glassSheen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.72)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.14)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.35)" />
          </linearGradient>
          <linearGradient id="benchGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#dec8aa" />
            <stop offset="100%" stopColor="#f2e6ce" />
          </linearGradient>
          <clipPath id="beakerClip">
            <path d="M116 66 H304 V284 C304 302 292 314 274 318 H146 C128 314 116 302 116 284 Z" />
          </clipPath>
          <clipPath id="tubeClip">
            <path d="M228 26 H258 V256 A15 15 0 0 1 243 272 A15 15 0 0 1 228 256 Z" />
          </clipPath>
        </defs>

        <rect x="0" y="0" width="420" height="340" rx="30" fill="#f7edd9" />
        <ellipse cx="210" cy="308" rx="144" ry="17" fill="rgba(72, 50, 31, 0.12)" />
        <rect x="84" y="300" width="252" height="16" rx="8" fill="url(#benchGlow)" />

        <g clipPath="url(#beakerClip)">
          <rect
            x="116"
            y={waterTopY}
            width="188"
            height={beakerInnerBottomY - waterTopY}
            fill={waterColor}
            opacity="0.72"
          />
          <rect x="116" y={waterTopY - 5} width="188" height="10" fill="rgba(255,255,255,0.36)" />
        </g>

        <g clipPath="url(#tubeClip)">
          <rect
            x="228"
            y={milkTopY}
            width="30"
            height={tubeInnerBottomY - milkTopY}
            fill={milkColor}
            opacity="0.92"
          />
          <rect x="228" y={milkTopY - 3} width="30" height="6" fill="rgba(255,255,255,0.58)" />
        </g>

        <rect
          x="220"
          y={immersionTopY}
          width="46"
          height={tubeInnerBottomY - immersionTopY}
          rx="18"
          fill="rgba(116, 197, 232, 0.1)"
          stroke="rgba(108, 168, 209, 0.35)"
          strokeDasharray="4 6"
        />

        <path
          d="M110 54 Q114 62 116 66 H304 Q306 62 310 54"
          fill="none"
          stroke="#8ea4b8"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M116 66 H304 V284 C304 302 292 314 274 318 H146 C128 314 116 302 116 284 Z"
          fill="url(#glassSheen)"
          stroke="#8da4b7"
          strokeWidth="4"
        />
        <path
          d="M228 18 H258 V256 A15 15 0 0 1 243 272 A15 15 0 0 1 228 256 Z"
          fill="url(#glassSheen)"
          stroke="#8da4b7"
          strokeWidth="4"
        />

        <path
          d="M130 74 V292"
          fill="none"
          stroke="rgba(255,255,255,0.64)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M238 26 V260"
          fill="none"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="7"
          strokeLinecap="round"
        />

        <Thermometer
          x={158}
          topY={12}
          bottomY={280}
          width={12}
          bulbRadius={10}
          temperatureC={currentPoint.waterTempC}
          columnColor="#c45f2f"
          labelX={104}
          labelY={78}
          labelAlign="end"
        />

        <Thermometer
          x={244}
          topY={8}
          bottomY={248}
          width={7}
          bulbRadius={6}
          temperatureC={currentPoint.milkTempC}
          columnColor="#708fc2"
          labelX={290}
          labelY={78}
        />

        <g className="scene-annotation">
          <text x="34" y="60" className="scene-label">
            烧杯热水
          </text>
          <path d="M84 56 C108 54 124 74 140 110" fill="none" stroke="#b86c34" strokeWidth="2" />
        </g>

        <g className="scene-annotation">
          <text x="304" y="38" className="scene-label">
            试管牛奶
          </text>
          <path d="M296 44 C278 52 264 78 252 112" fill="none" stroke="#7d6b4a" strokeWidth="2" />
        </g>

        <g className="scene-annotation">
          <text x="286" y="296" className="scene-label ambient-label">
            室温 {config.ambientTempC.toFixed(0)}°C
          </text>
        </g>
      </svg>
    </div>
  )
}
