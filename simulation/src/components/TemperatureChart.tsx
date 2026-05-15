import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SimulationPoint } from '../simulation/modelTypes'

interface TemperatureChartProps {
  overviewData: SimulationPoint[]
  detailData: SimulationPoint[]
  currentPoint: SimulationPoint
  overviewMaxTimeSec: number
  detailStartTimeSec: number
  detailEndTimeSec: number
  temperatureDomain: [number, number]
  overviewTickMarks: number[]
  detailTickMarks: number[]
  formatAxisTime: (seconds: number) => string
  formatTooltipTime: (seconds: number) => string
}

export const TemperatureChart = ({
  overviewData,
  detailData,
  currentPoint,
  overviewMaxTimeSec,
  detailStartTimeSec,
  detailEndTimeSec,
  temperatureDomain,
  overviewTickMarks,
  detailTickMarks,
  formatAxisTime,
  formatTooltipTime,
}: TemperatureChartProps) => (
  <div className="chart-shell">
    <div className="chart-focus">
      <div className="chart-caption">
        <strong>放大视图</strong>
        <span>
          {formatTooltipTime(detailStartTimeSec)} - {formatTooltipTime(detailEndTimeSec)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={detailData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="rgba(100, 86, 62, 0.14)" vertical={false} />
          <XAxis
            type="number"
            dataKey="timeSec"
            domain={[detailStartTimeSec, detailEndTimeSec]}
            ticks={detailTickMarks}
            tickFormatter={(value) => formatAxisTime(Number(value))}
            stroke="#86694a"
            tick={{ fill: '#70583f', fontSize: 12 }}
          />
          <YAxis
            domain={temperatureDomain}
            tickFormatter={(value) => `${value.toFixed(0)}°`}
            stroke="#86694a"
            tick={{ fill: '#70583f', fontSize: 12 }}
            width={42}
          />
          <Tooltip
            labelFormatter={(label) => `时间 ${formatTooltipTime(Number(label))}`}
            formatter={(value, name) => {
              const temperatureValue = Number(value)

              return [
                `${temperatureValue.toFixed(1)}°C`,
                name === 'waterTempC' ? '热水温度' : '牛奶温度',
              ]
            }}
            contentStyle={{
              borderRadius: '14px',
              border: '1px solid rgba(115, 87, 45, 0.18)',
              boxShadow: '0 14px 32px rgba(75, 54, 32, 0.12)',
              backgroundColor: 'rgba(255, 251, 243, 0.97)',
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '4px', color: '#614b35' }}
            formatter={(value) => (value === 'waterTempC' ? '热水温度' : '牛奶温度')}
          />
          <ReferenceLine x={currentPoint.timeSec} stroke="#72512a" strokeDasharray="5 5" />
          <Line
            type="monotone"
            dataKey="waterTempC"
            stroke="#ca6930"
            strokeWidth={3}
            dot={false}
            name="waterTempC"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="milkTempC"
            stroke="#6d8fc7"
            strokeWidth={3}
            dot={false}
            name="milkTempC"
            isAnimationActive={false}
          />
          <ReferenceDot
            x={currentPoint.timeSec}
            y={currentPoint.waterTempC}
            r={5}
            fill="#ca6930"
            stroke="#fff7ea"
            strokeWidth={2}
          />
          <ReferenceDot
            x={currentPoint.timeSec}
            y={currentPoint.milkTempC}
            r={5}
            fill="#6d8fc7"
            stroke="#fff7ea"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>

    <div className="chart-overview">
      <div className="chart-caption">
        <strong>全程概览</strong>
        <span>0 - {formatAxisTime(overviewMaxTimeSec)}</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={overviewData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(100, 86, 62, 0.12)" vertical={false} />
          <XAxis
            type="number"
            dataKey="timeSec"
            domain={[0, overviewMaxTimeSec]}
            ticks={overviewTickMarks}
            tickFormatter={(value) => formatAxisTime(Number(value))}
            stroke="#86694a"
            tick={{ fill: '#70583f', fontSize: 11 }}
          />
          <YAxis hide domain={temperatureDomain} />
          <Tooltip
            labelFormatter={(label) => `时间 ${formatTooltipTime(Number(label))}`}
            formatter={(value, name) => {
              const temperatureValue = Number(value)

              return [
                `${temperatureValue.toFixed(1)}°C`,
                name === 'waterTempC' ? '热水温度' : '牛奶温度',
              ]
            }}
            contentStyle={{
              borderRadius: '14px',
              border: '1px solid rgba(115, 87, 45, 0.18)',
              boxShadow: '0 14px 32px rgba(75, 54, 32, 0.12)',
              backgroundColor: 'rgba(255, 251, 243, 0.97)',
            }}
          />
          <ReferenceArea
            x1={detailStartTimeSec}
            x2={detailEndTimeSec}
            fill="rgba(216, 147, 71, 0.15)"
            strokeOpacity={0}
          />
          <ReferenceLine x={currentPoint.timeSec} stroke="#72512a" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="waterTempC"
            stroke="#ca6930"
            strokeWidth={2.2}
            dot={false}
            name="waterTempC"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="milkTempC"
            stroke="#6d8fc7"
            strokeWidth={2.2}
            dot={false}
            name="milkTempC"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
)
