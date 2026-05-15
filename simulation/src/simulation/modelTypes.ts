export interface FluidProperties {
  thermalConductivityWPerMK: number
  kinematicViscosityM2PerS: number
  thermalDiffusivityM2PerS: number
  thermalExpansionPerK: number
  prandtlNumber: number
}

export interface ThermalNode {
  initialTempC: number
  massKg: number
  specificHeatJPerKgK: number
}

export interface FluidNode extends ThermalNode {
  freeSurfaceAreaM2: number
  surfaceLengthM: number
  properties: FluidProperties
}

export type WaterNode = FluidNode

export type MilkNode = FluidNode

export interface GlassNode extends ThermalNode {
  conductivityWPerMK: number
  wallThicknessM: number
}

export interface TestTubeNode extends GlassNode {
  innerContactAreaM2: number
  immersedOuterAreaM2: number
  exposedOuterAreaM2: number
  totalLengthM: number
  milkLengthM: number
  immersedLengthM: number
  exposedLengthM: number
}

export interface BeakerNode extends GlassNode {
  innerWettedAreaM2: number
  outerExposedAreaM2: number
  totalHeightM: number
  wettedLengthM: number
}

export interface SimulationCoefficients {
  airConvectionScale: number
  liquidConvectionScale: number
  minimumAirConvectionWPerM2K: number
  minimumLiquidConvectionWPerM2K: number
}

export interface SimulationConfig {
  ambientTempC: number
  durationSec: number
  dtSec: number
  equilibriumToleranceC: number
  water: WaterNode
  milk: MilkNode
  testTube: TestTubeNode
  beaker: BeakerNode
  air: {
    properties: FluidProperties
  }
  coefficients: SimulationCoefficients
}

export interface SimulationPoint {
  timeSec: number
  waterTempC: number
  milkTempC: number
  testTubeGlassTempC: number
  beakerGlassTempC: number
}
