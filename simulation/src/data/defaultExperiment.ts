import type { FluidProperties, SimulationConfig } from '../simulation/modelTypes'

const PI = Math.PI

const WATER_PROPERTIES: FluidProperties = {
  thermalConductivityWPerMK: 0.628,
  kinematicViscosityM2PerS: 0.658e-6,
  thermalDiffusivityM2PerS: 0.151e-6,
  thermalExpansionPerK: 0.00038,
  prandtlNumber: 4.36,
}

const MILK_PROPERTIES: FluidProperties = {
  thermalConductivityWPerMK: 0.53,
  kinematicViscosityM2PerS: 1.1e-6,
  thermalDiffusivityM2PerS: 0.133e-6,
  thermalExpansionPerK: 0.00033,
  prandtlNumber: 8.3,
}

const AIR_PROPERTIES: FluidProperties = {
  thermalConductivityWPerMK: 0.0263,
  kinematicViscosityM2PerS: 16e-6,
  thermalDiffusivityM2PerS: 22.6e-6,
  thermalExpansionPerK: 1 / 298,
  prandtlNumber: 0.71,
}

export const createDefaultExperimentConfig = (): SimulationConfig => {
  const beakerTotalHeightM = 0.09
  const beakerOuterRadiusM = 0.03715
  const beakerWallThicknessM = 0.0018
  const beakerBaseThicknessM = 0.0022
  const beakerInnerRadiusM = beakerOuterRadiusM - beakerWallThicknessM
  const waterVolumeM3 = 180e-6
  const waterHeightM = waterVolumeM3 / (PI * beakerInnerRadiusM ** 2)

  const tubeTotalLengthM = 0.18
  const tubeOuterRadiusM = 0.009
  const tubeWallThicknessM = 0.0015
  const tubeInnerRadiusM = tubeOuterRadiusM - tubeWallThicknessM
  const milkVolumeM3 = 10e-6
  const milkHeightM = milkVolumeM3 / (PI * tubeInnerRadiusM ** 2)
  const immersedLengthM = Math.min(waterHeightM, milkHeightM)
  const exposedLengthM = Math.max(milkHeightM - immersedLengthM, 0)

  const waterMassKg = 997 * waterVolumeM3
  const milkMassKg = 1030 * milkVolumeM3

  const testTubeGlassVolumeM3 =
    PI * (tubeOuterRadiusM ** 2 - tubeInnerRadiusM ** 2) * milkHeightM +
    PI * tubeOuterRadiusM ** 2 * tubeWallThicknessM

  const beakerGlassVolumeM3 =
    PI * (beakerOuterRadiusM ** 2 - beakerInnerRadiusM ** 2) * waterHeightM +
    PI * beakerOuterRadiusM ** 2 * beakerBaseThicknessM

  return {
    ambientTempC: 25,
    durationSec: 72 * 60 * 60,
    dtSec: 5,
    equilibriumToleranceC: 0.05,
    water: {
      initialTempC: 60,
      massKg: waterMassKg,
      specificHeatJPerKgK: 4180,
      freeSurfaceAreaM2: PI * beakerInnerRadiusM ** 2,
      surfaceLengthM: 2 * beakerInnerRadiusM,
      properties: WATER_PROPERTIES,
    },
    milk: {
      initialTempC: 20,
      massKg: milkMassKg,
      specificHeatJPerKgK: 3930,
      freeSurfaceAreaM2: PI * tubeInnerRadiusM ** 2,
      surfaceLengthM: 2 * tubeInnerRadiusM,
      properties: MILK_PROPERTIES,
    },
    testTube: {
      initialTempC: 20,
      massKg: testTubeGlassVolumeM3 * 2230,
      specificHeatJPerKgK: 753,
      conductivityWPerMK: 1.1,
      wallThicknessM: tubeWallThicknessM,
      innerContactAreaM2:
        2 * PI * tubeInnerRadiusM * milkHeightM + PI * tubeInnerRadiusM ** 2,
      immersedOuterAreaM2:
        2 * PI * tubeOuterRadiusM * immersedLengthM + PI * tubeOuterRadiusM ** 2,
      exposedOuterAreaM2: 2 * PI * tubeOuterRadiusM * exposedLengthM,
      totalLengthM: tubeTotalLengthM,
      milkLengthM: milkHeightM,
      immersedLengthM,
      exposedLengthM,
    },
    beaker: {
      initialTempC: 60,
      massKg: beakerGlassVolumeM3 * 2230,
      specificHeatJPerKgK: 753,
      conductivityWPerMK: 1.1,
      wallThicknessM: beakerWallThicknessM,
      innerWettedAreaM2:
        2 * PI * beakerInnerRadiusM * waterHeightM + PI * beakerInnerRadiusM ** 2,
      outerExposedAreaM2:
        2 * PI * beakerOuterRadiusM * waterHeightM + PI * beakerOuterRadiusM ** 2,
      totalHeightM: beakerTotalHeightM,
      wettedLengthM: waterHeightM,
    },
    air: {
      properties: AIR_PROPERTIES,
    },
    coefficients: {
      airConvectionScale: 1,
      liquidConvectionScale: 1,
      minimumAirConvectionWPerM2K: 4,
      minimumLiquidConvectionWPerM2K: 35,
    },
  }
}
