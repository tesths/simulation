import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SimulationPoint } from '../simulation/modelTypes'

const WATER_LINE_COLOR = '#ca6930'
const TUBE_WATER_LINE_COLOR = '#4f8fcb'
const TUBE_WATER_LINE_DASH = '10 6'

interface TemperatureChartProps {
  overviewData: SimulationPoint[]
  currentPoint: SimulationPoint
  overviewMaxTimeSec: number
  overviewTemperatureDomain: [number, number]
  overviewTickMarks: number[]
  formatAxisTime: (seconds: number) => string
  formatTooltipTime: (seconds: number) => string
}

export const TemperatureChart = ({
  overviewData,
  currentPoint,
  overviewMaxTimeSec,
  overviewTemperatureDomain,
  overviewTickMarks,
  formatAxisTime,
  formatTooltipTime,
}: TemperatureChartProps) => {
  const currentTemperatureGap = Math.abs(currentPoint.waterTempC - currentPoint.milkTempC)
  const displayedOverviewMaxTimeSec = Math.max(overviewMaxTimeSec, 1)

  return (
    <div className="chart-shell">
      <div className="chart-overview">
        <div className="chart-caption">
          <strong>全程概览</strong>
          <span>0 - {formatAxisTime(overviewMaxTimeSec)}</span>
        </div>
        <div className="chart-key" aria-label="温度曲线图例">
          <span className="chart-key-item">
            <span className="chart-key-line water" aria-hidden="true" />
            烧杯水温
          </span>
          <span className="chart-key-item">
            <span className="chart-key-line milk" aria-hidden="true" />
            试管水温
          </span>
          <span className="chart-key-gap">
            当前温差 {currentTemperatureGap.toFixed(1)}°C
          </span>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={overviewData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="rgba(100, 86, 62, 0.14)" vertical={false} />
            <XAxis
              type="number"
              dataKey="timeSec"
              domain={[0, displayedOverviewMaxTimeSec]}
              ticks={overviewTickMarks}
              tickFormatter={(value) => formatAxisTime(Number(value))}
              stroke="#86694a"
              tick={{ fill: '#70583f', fontSize: 12 }}
            />
            <YAxis
              domain={overviewTemperatureDomain}
              tickCount={6}
              tickFormatter={(value) => `${Math.round(Number(value))}°`}
              stroke="#86694a"
              tick={{ fill: '#70583f', fontSize: 12 }}
              width={52}
            />
            <Tooltip
              labelFormatter={(label) => `时间 ${formatTooltipTime(Number(label))}`}
              formatter={(value, name) => {
                const temperatureValue = Number(value)

                return [
                  `${temperatureValue.toFixed(1)}°C`,
                  name === 'waterTempC' ? '烧杯水温' : '试管水温',
                ]
              }}
              contentStyle={{
                borderRadius: '14px',
                border: '1px solid rgba(115, 87, 45, 0.18)',
                boxShadow: '0 14px 32px rgba(75, 54, 32, 0.12)',
                backgroundColor: 'rgba(255, 251, 243, 0.97)',
              }}
            />
            <ReferenceLine x={currentPoint.timeSec} stroke="#72512a" strokeDasharray="5 5" />
            <Line
              type="monotone"
              dataKey="waterTempC"
              stroke={WATER_LINE_COLOR}
              strokeWidth={3.2}
              dot={false}
              name="waterTempC"
              isAnimationActive={false}
              strokeLinecap="round"
            />
            <Line
              type="monotone"
              dataKey="milkTempC"
              stroke={TUBE_WATER_LINE_COLOR}
              strokeWidth={3}
              strokeDasharray={TUBE_WATER_LINE_DASH}
              dot={false}
              name="milkTempC"
              isAnimationActive={false}
              strokeLinecap="round"
            />
            <ReferenceDot
              x={currentPoint.timeSec}
              y={currentPoint.waterTempC}
              r={6}
              fill={WATER_LINE_COLOR}
              stroke="#fff7ea"
              strokeWidth={2}
            />
            <ReferenceDot
              x={currentPoint.timeSec}
              y={currentPoint.milkTempC}
              r={4.6}
              fill="#fff7ea"
              stroke={TUBE_WATER_LINE_COLOR}
              strokeWidth={2.4}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
