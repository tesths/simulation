import { createDefaultExperimentConfig } from '../data/defaultExperiment'
import { runHeatTransferSimulation } from './heatModel'

const calculateRelativeEnergyDrift = (
  config: ReturnType<typeof createDefaultExperimentConfig>,
) => {
  const points = runHeatTransferSimulation(config)
  const firstPoint = points[0]
  const lastPoint = points.at(-1)

  if (!lastPoint) {
    throw new Error('Simulation should return at least one point')
  }

  const totalEnergy = (point: (typeof points)[number]) =>
    point.waterTempC * config.water.massKg * config.water.specificHeatJPerKgK +
    point.milkTempC * config.milk.massKg * config.milk.specificHeatJPerKgK +
    point.testTubeGlassTempC *
      config.testTube.massKg *
      config.testTube.specificHeatJPerKgK +
    point.beakerGlassTempC * config.beaker.massKg * config.beaker.specificHeatJPerKgK

  return Math.abs(totalEnergy(lastPoint) - totalEnergy(firstPoint)) / totalEnergy(firstPoint)
}

describe('runHeatTransferSimulation', () => {
  it('starts at the configured initial temperatures', () => {
    const config = createDefaultExperimentConfig()

    const points = runHeatTransferSimulation(config)
    const firstPoint = points[0]

    expect(firstPoint.timeSec).toBe(0)
    expect(firstPoint.waterTempC).toBeCloseTo(60, 6)
    expect(firstPoint.milkTempC).toBeCloseTo(20, 6)
    expect(firstPoint.testTubeGlassTempC).toBeCloseTo(20, 6)
    expect(firstPoint.beakerGlassTempC).toBeCloseTo(60, 6)
  })

  it('cools water overall and keeps milk close to the water bath temperature', () => {
    const points = runHeatTransferSimulation(createDefaultExperimentConfig())
    let maxMilkLeadC = Number.NEGATIVE_INFINITY

    for (let index = 1; index < points.length; index += 1) {
      expect(points[index].waterTempC).toBeLessThanOrEqual(
        points[index - 1].waterTempC + 1e-3,
      )
      maxMilkLeadC = Math.max(maxMilkLeadC, points[index].milkTempC - points[index].waterTempC)
    }

    expect(points.at(-1)!.waterTempC).toBeLessThan(points[0].waterTempC)
    expect(points.at(-1)!.milkTempC).toBeGreaterThan(points[0].milkTempC)
    expect(maxMilkLeadC).toBeLessThan(0.3)
  })

  it('extends until the experiment reaches room-temperature equilibrium', () => {
    const config = createDefaultExperimentConfig()

    const points = runHeatTransferSimulation(config)
    const lastPoint = points.at(-1)

    expect(lastPoint).toBeDefined()
    expect(lastPoint!.timeSec).toBeGreaterThan(45 * 60)
    expect(lastPoint!.waterTempC).toBeCloseTo(config.ambientTempC, 6)
    expect(lastPoint!.milkTempC).toBeCloseTo(config.ambientTempC, 6)
    expect(lastPoint!.testTubeGlassTempC).toBeCloseTo(config.ambientTempC, 6)
    expect(lastPoint!.beakerGlassTempC).toBeCloseTo(config.ambientTempC, 6)
  })

  it('approximately conserves total energy when ambient losses are disabled', () => {
    const config = createDefaultExperimentConfig()
    config.ambientTempC = 20
    config.coefficients.airConvectionScale = 0
    config.durationSec = 20 * 60

    const drift = calculateRelativeEnergyDrift(config)

    expect(drift).toBeLessThan(0.01)
  })
})
