import {
  type ChangeEvent,
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
} from 'react'
import { LaboratoryScene } from './components/LaboratoryScene'
import { TemperatureChart } from './components/TemperatureChart'
import { createDefaultExperimentConfig } from './data/defaultExperiment'
import { runHeatTransferSimulation } from './simulation/heatModel'
import {
  createTimeTicks,
  createTimeTicksForRange,
  formatCompactTime,
  formatTemperature,
  formatTime,
} from './utils/formatters'
import './App.css'

const EXPERIMENT_CONFIG = createDefaultExperimentConfig()
const SIMULATION_POINTS = runHeatTransferSimulation(EXPERIMENT_CONFIG)
const MAX_POINT_INDEX = SIMULATION_POINTS.length - 1
const FINAL_POINT = SIMULATION_POINTS[MAX_POINT_INDEX] ?? SIMULATION_POINTS[0]
const MAX_TIME_SEC = FINAL_POINT.timeSec
const POINT_STEP_SEC = EXPERIMENT_CONFIG.dtSec
const PLAYBACK_INTERVAL_MS = 60
const PLAYBACK_STEP_POINTS = Math.max(1, Math.round(60 / POINT_STEP_SEC))
const OVERVIEW_TICKS = createTimeTicks(MAX_TIME_SEC, 7)
const DETAIL_WINDOW_SEC = Math.min(90 * 60, MAX_TIME_SEC)

const allTemperatures = SIMULATION_POINTS.flatMap((point) => [
  point.waterTempC,
  point.milkTempC,
])
const TEMPERATURE_DOMAIN: [number, number] = [
  Math.floor(Math.min(...allTemperatures, EXPERIMENT_CONFIG.ambientTempC)) - 2,
  Math.ceil(Math.max(...allTemperatures)) + 2,
]

const getDetailWindowStartSec = (currentTimeSec: number) => {
  const preferredStartSec = currentTimeSec - DETAIL_WINDOW_SEC * 0.28

  return Math.max(0, Math.min(preferredStartSec, MAX_TIME_SEC - DETAIL_WINDOW_SEC))
}

function App() {
  const [currentPointIndex, setCurrentPointIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const deferredPointIndex = useDeferredValue(currentPointIndex)
  const currentPoint = SIMULATION_POINTS[deferredPointIndex] ?? SIMULATION_POINTS[0]
  const detailWindowStartSec = getDetailWindowStartSec(currentPoint.timeSec)
  const detailWindowEndSec = Math.min(MAX_TIME_SEC, detailWindowStartSec + DETAIL_WINDOW_SEC)
  const detailTickMarks = createTimeTicksForRange(detailWindowStartSec, detailWindowEndSec, 6)
  const detailData = SIMULATION_POINTS.filter(
    (point) => point.timeSec >= detailWindowStartSec && point.timeSec <= detailWindowEndSec,
  )

  const advancePlayback = useEffectEvent(() => {
    startTransition(() => {
      setCurrentPointIndex((pointIndex) => {
        const nextPointIndex = Math.min(pointIndex + PLAYBACK_STEP_POINTS, MAX_POINT_INDEX)

        if (nextPointIndex >= MAX_POINT_INDEX) {
          setIsPlaying(false)
        }

        return nextPointIndex
      })
    })
  })

  useEffect(() => {
    if (!isPlaying) {
      return undefined
    }

    const timer = window.setInterval(() => {
      advancePlayback()
    }, PLAYBACK_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [isPlaying])

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextPointIndex = Number(event.currentTarget.value)
    startTransition(() => {
      setCurrentPointIndex(nextPointIndex)
    })
  }

  const handleReset = () => {
    setIsPlaying(false)
    startTransition(() => {
      setCurrentPointIndex(0)
    })
  }

  return (
    <div className="viewport-shell">
      <div className="app-shell">
        <header className="status-bar">
          <div className="headline-block">
            <p className="eyebrow">物理传热模拟实验</p>
            <h1>热水浴中的牛奶升温与冷却到室温</h1>
          </div>
          <div className="hero-stats">
            <div className="stat-card">
              <span className="stat-label">当前时间</span>
              <strong>{formatTime(currentPoint.timeSec)}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">热水</span>
              <strong>{formatTemperature(currentPoint.waterTempC)}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">牛奶</span>
              <strong>{formatTemperature(currentPoint.milkTempC)}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">到室温</span>
              <strong>{formatCompactTime(MAX_TIME_SEC)}</strong>
            </div>
          </div>
        </header>

        <main className="dashboard-grid">
          <section className="panel scene-panel">
            <LaboratoryScene config={EXPERIMENT_CONFIG} currentPoint={currentPoint} />
          </section>

          <section className="panel chart-panel">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">温度曲线</p>
                <h2>前段放大 + 全程概览</h2>
              </div>
              <span className="panel-pill">总时长 {formatCompactTime(MAX_TIME_SEC)}</span>
            </div>
            <TemperatureChart
              overviewData={SIMULATION_POINTS}
              detailData={detailData}
              currentPoint={currentPoint}
              overviewMaxTimeSec={MAX_TIME_SEC}
              detailStartTimeSec={detailWindowStartSec}
              detailEndTimeSec={detailWindowEndSec}
              temperatureDomain={TEMPERATURE_DOMAIN}
              overviewTickMarks={OVERVIEW_TICKS}
              detailTickMarks={detailTickMarks}
              formatAxisTime={formatCompactTime}
              formatTooltipTime={formatTime}
            />
          </section>
        </main>

        <section className="control-strip">
          <div className="control-summary">
            <div>
              <p className="panel-kicker">时间轴</p>
              <h2>拖动查看任意时刻，右侧图表会同步高亮</h2>
            </div>
            <div className="play-controls">
              <button
                type="button"
                className="action-button primary"
                onClick={() => setIsPlaying((playing) => !playing)}
              >
                {isPlaying ? '暂停' : '播放'}
              </button>
              <button type="button" className="action-button" onClick={handleReset}>
                回到开始
              </button>
            </div>
          </div>

          <div className="timeline-block">
            <div className="timeline-readout">
              <span>当前指针：{formatTime(currentPoint.timeSec)}</span>
              <span>
                热水 {formatTemperature(currentPoint.waterTempC)} / 牛奶{' '}
                {formatTemperature(currentPoint.milkTempC)}
              </span>
            </div>
            <input
              className="timeline-slider"
              type="range"
              min="0"
              max={MAX_POINT_INDEX}
              step="1"
              value={currentPointIndex}
              onChange={handleSliderChange}
              aria-label="模拟时间轴"
            />
            <div
              className="timeline-ticks"
              style={{ gridTemplateColumns: `repeat(${OVERVIEW_TICKS.length}, minmax(0, 1fr))` }}
              aria-hidden="true"
            >
              {OVERVIEW_TICKS.map((tick) => (
                <span key={tick}>{formatCompactTime(tick)}</span>
              ))}
            </div>
          </div>

          <div className="bottom-notes">
            <span>烧杯 250 mL / 热水 180 mL / 试管 18×180 mm / 牛奶 10 mL</span>
            <span>四节点耦合传热：水、牛奶、试管玻璃、烧杯玻璃</span>
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
