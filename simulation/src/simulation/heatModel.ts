import type { FluidProperties, SimulationConfig, SimulationPoint } from './modelTypes'

const GRAVITY = 9.81

interface Temperatures {
  waterTempC: number
  milkTempC: number
  testTubeGlassTempC: number
  beakerGlassTempC: number
}

const calculateNaturalConvectionCoefficient = (
  deltaTempC: number,
  characteristicLengthM: number,
  fluid: FluidProperties,
  scale: number,
  minimumWPerM2K: number,
) => {
  if (scale <= 0 || characteristicLengthM <= 0) {
    return 0
  }

  const deltaT = Math.max(Math.abs(deltaTempC), 0.1)
  const rayleighNumber =
    (GRAVITY *
      fluid.thermalExpansionPerK *
      deltaT *
      characteristicLengthM ** 3) /
    (fluid.kinematicViscosityM2PerS * fluid.thermalDiffusivityM2PerS)

  const limitedRayleighNumber = Math.min(Math.max(rayleighNumber, 1e-1), 1e12)
  const prandtlTerm = (1 + (0.492 / fluid.prandtlNumber) ** (9 / 16)) ** (8 / 27)
  const nusseltNumber =
    (0.825 + (0.387 * limitedRayleighNumber ** (1 / 6)) / prandtlTerm) ** 2

  return Math.max(minimumWPerM2K, (nusseltNumber * fluid.thermalConductivityWPerMK) / characteristicLengthM) * scale
}

const calculateConvectiveResistance = (coefficient: number, areaM2: number) => {
  if (coefficient <= 0 || areaM2 <= 0) {
    return Number.POSITIVE_INFINITY
  }

  return 1 / (coefficient * areaM2)
}

const calculateHalfWallResistance = (
  wallThicknessM: number,
  conductivityWPerMK: number,
  areaM2: number,
) => {
  if (conductivityWPerMK <= 0 || areaM2 <= 0) {
    return Number.POSITIVE_INFINITY
  }

  return wallThicknessM / (2 * conductivityWPerMK * areaM2)
}

const calculateHeatFlows = (temperatures: Temperatures, config: SimulationConfig) => {
  const hWaterTube = calculateNaturalConvectionCoefficient(
    temperatures.waterTempC - temperatures.testTubeGlassTempC,
    config.testTube.immersedLengthM,
    config.water.properties,
    config.coefficients.liquidConvectionScale,
    config.coefficients.minimumLiquidConvectionWPerM2K,
  )

  const hMilkTube = calculateNaturalConvectionCoefficient(
    temperatures.milkTempC - temperatures.testTubeGlassTempC,
    config.testTube.milkLengthM,
    config.milk.properties,
    config.coefficients.liquidConvectionScale,
    config.coefficients.minimumLiquidConvectionWPerM2K,
  )

  const hWaterBeaker = calculateNaturalConvectionCoefficient(
    temperatures.waterTempC - temperatures.beakerGlassTempC,
    config.beaker.wettedLengthM,
    config.water.properties,
    config.coefficients.liquidConvectionScale,
    config.coefficients.minimumLiquidConvectionWPerM2K,
  )

  const hWaterAir = calculateNaturalConvectionCoefficient(
    temperatures.waterTempC - config.ambientTempC,
    config.water.surfaceLengthM,
    config.air.properties,
    config.coefficients.airConvectionScale,
    config.coefficients.minimumAirConvectionWPerM2K,
  )

  const hMilkAir = calculateNaturalConvectionCoefficient(
    temperatures.milkTempC - config.ambientTempC,
    config.milk.surfaceLengthM,
    config.air.properties,
    config.coefficients.airConvectionScale,
    config.coefficients.minimumAirConvectionWPerM2K,
  )

  const hTubeAir = calculateNaturalConvectionCoefficient(
    temperatures.testTubeGlassTempC - config.ambientTempC,
    config.testTube.exposedLengthM || config.testTube.milkLengthM,
    config.air.properties,
    config.coefficients.airConvectionScale,
    config.coefficients.minimumAirConvectionWPerM2K,
  )

  const hBeakerAir = calculateNaturalConvectionCoefficient(
    temperatures.beakerGlassTempC - config.ambientTempC,
    config.beaker.wettedLengthM,
    config.air.properties,
    config.coefficients.airConvectionScale,
    config.coefficients.minimumAirConvectionWPerM2K,
  )

  const waterToTubeResistance =
    calculateConvectiveResistance(hWaterTube, config.testTube.immersedOuterAreaM2) +
    calculateHalfWallResistance(
      config.testTube.wallThicknessM,
      config.testTube.conductivityWPerMK,
      config.testTube.immersedOuterAreaM2,
    )

  const milkToTubeResistance =
    calculateConvectiveResistance(hMilkTube, config.testTube.innerContactAreaM2) +
    calculateHalfWallResistance(
      config.testTube.wallThicknessM,
      config.testTube.conductivityWPerMK,
      config.testTube.innerContactAreaM2,
    )

  const waterToBeakerResistance =
    calculateConvectiveResistance(hWaterBeaker, config.beaker.innerWettedAreaM2) +
    calculateHalfWallResistance(
      config.beaker.wallThicknessM,
      config.beaker.conductivityWPerMK,
      config.beaker.innerWettedAreaM2,
    )

  const waterToAirResistance = calculateConvectiveResistance(
    hWaterAir,
    config.water.freeSurfaceAreaM2,
  )

  const milkToAirResistance = calculateConvectiveResistance(
    hMilkAir,
    config.milk.freeSurfaceAreaM2,
  )

  const tubeToAirResistance =
    calculateConvectiveResistance(hTubeAir, config.testTube.exposedOuterAreaM2) +
    calculateHalfWallResistance(
      config.testTube.wallThicknessM,
      config.testTube.conductivityWPerMK,
      config.testTube.exposedOuterAreaM2,
    )

  const beakerToAirResistance =
    calculateConvectiveResistance(hBeakerAir, config.beaker.outerExposedAreaM2) +
    calculateHalfWallResistance(
      config.beaker.wallThicknessM,
      config.beaker.conductivityWPerMK,
      config.beaker.outerExposedAreaM2,
    )

  return {
    waterToTubeW:
      (temperatures.waterTempC - temperatures.testTubeGlassTempC) / waterToTubeResistance,
    milkToTubeW:
      (temperatures.milkTempC - temperatures.testTubeGlassTempC) / milkToTubeResistance,
    waterToBeakerW:
      (temperatures.waterTempC - temperatures.beakerGlassTempC) / waterToBeakerResistance,
    waterToAirW: (temperatures.waterTempC - config.ambientTempC) / waterToAirResistance,
    milkToAirW: (temperatures.milkTempC - config.ambientTempC) / milkToAirResistance,
    tubeToAirW:
      (temperatures.testTubeGlassTempC - config.ambientTempC) / tubeToAirResistance,
    beakerToAirW:
      (temperatures.beakerGlassTempC - config.ambientTempC) / beakerToAirResistance,
  }
}

const calculateDerivatives = (temperatures: Temperatures, config: SimulationConfig) => {
  const heatFlows = calculateHeatFlows(temperatures, config)

  const waterHeatCapacityJPerK =
    config.water.massKg * config.water.specificHeatJPerKgK
  const milkHeatCapacityJPerK = config.milk.massKg * config.milk.specificHeatJPerKgK
  const tubeHeatCapacityJPerK =
    config.testTube.massKg * config.testTube.specificHeatJPerKgK
  const beakerHeatCapacityJPerK =
    config.beaker.massKg * config.beaker.specificHeatJPerKgK

  return {
    waterTempC:
      (-heatFlows.waterToTubeW - heatFlows.waterToBeakerW - heatFlows.waterToAirW) /
      waterHeatCapacityJPerK,
    milkTempC: (-heatFlows.milkToTubeW - heatFlows.milkToAirW) / milkHeatCapacityJPerK,
    testTubeGlassTempC:
      (heatFlows.waterToTubeW + heatFlows.milkToTubeW - heatFlows.tubeToAirW) /
      tubeHeatCapacityJPerK,
    beakerGlassTempC:
      (heatFlows.waterToBeakerW - heatFlows.beakerToAirW) / beakerHeatCapacityJPerK,
  }
}

const addScaledDerivatives = (
  temperatures: Temperatures,
  derivatives: Temperatures,
  scale: number,
): Temperatures => ({
  waterTempC: temperatures.waterTempC + derivatives.waterTempC * scale,
  milkTempC: temperatures.milkTempC + derivatives.milkTempC * scale,
  testTubeGlassTempC:
    temperatures.testTubeGlassTempC + derivatives.testTubeGlassTempC * scale,
  beakerGlassTempC:
    temperatures.beakerGlassTempC + derivatives.beakerGlassTempC * scale,
})

const integrateStep = (temperatures: Temperatures, config: SimulationConfig) => {
  const dt = config.dtSec
  const k1 = calculateDerivatives(temperatures, config)
  const k2 = calculateDerivatives(addScaledDerivatives(temperatures, k1, dt / 2), config)
  const k3 = calculateDerivatives(addScaledDerivatives(temperatures, k2, dt / 2), config)
  const k4 = calculateDerivatives(addScaledDerivatives(temperatures, k3, dt), config)

  return {
    waterTempC:
      temperatures.waterTempC +
      (dt / 6) * (k1.waterTempC + 2 * k2.waterTempC + 2 * k3.waterTempC + k4.waterTempC),
    milkTempC:
      temperatures.milkTempC +
      (dt / 6) * (k1.milkTempC + 2 * k2.milkTempC + 2 * k3.milkTempC + k4.milkTempC),
    testTubeGlassTempC:
      temperatures.testTubeGlassTempC +
      (dt / 6) *
        (k1.testTubeGlassTempC +
          2 * k2.testTubeGlassTempC +
          2 * k3.testTubeGlassTempC +
          k4.testTubeGlassTempC),
    beakerGlassTempC:
      temperatures.beakerGlassTempC +
      (dt / 6) *
        (k1.beakerGlassTempC +
          2 * k2.beakerGlassTempC +
          2 * k3.beakerGlassTempC +
          k4.beakerGlassTempC),
  }
}

const hasReachedRoomTemperatureEquilibrium = (
  temperatures: Temperatures,
  config: SimulationConfig,
) =>
  Math.abs(temperatures.waterTempC - config.ambientTempC) <= config.equilibriumToleranceC &&
  Math.abs(temperatures.milkTempC - config.ambientTempC) <= config.equilibriumToleranceC &&
  Math.abs(temperatures.testTubeGlassTempC - config.ambientTempC) <=
    config.equilibriumToleranceC &&
  Math.abs(temperatures.beakerGlassTempC - config.ambientTempC) <=
    config.equilibriumToleranceC

const snapToAmbient = (ambientTempC: number): Temperatures => ({
  waterTempC: ambientTempC,
  milkTempC: ambientTempC,
  testTubeGlassTempC: ambientTempC,
  beakerGlassTempC: ambientTempC,
})

export const runHeatTransferSimulation = (config: SimulationConfig): SimulationPoint[] => {
  const pointCount = Math.floor(config.durationSec / config.dtSec)
  const points: SimulationPoint[] = []

  let temperatures: Temperatures = {
    waterTempC: config.water.initialTempC,
    milkTempC: config.milk.initialTempC,
    testTubeGlassTempC: config.testTube.initialTempC,
    beakerGlassTempC: config.beaker.initialTempC,
  }

  points.push({
    timeSec: 0,
    ...temperatures,
  })

  for (let step = 1; step <= pointCount; step += 1) {
    temperatures = integrateStep(temperatures, config)

    if (hasReachedRoomTemperatureEquilibrium(temperatures, config)) {
      temperatures = snapToAmbient(config.ambientTempC)
    }

    points.push({
      timeSec: step * config.dtSec,
      ...temperatures,
    })
  }

  return points
}
