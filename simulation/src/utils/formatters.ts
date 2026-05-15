export const formatTime = (timeSec: number) => {
  const hours = Math.floor(timeSec / 3600)
  const minutes = Math.floor(timeSec / 60)
  const seconds = timeSec % 60

  if (hours > 0) {
    const remainingMinutes = Math.floor((timeSec % 3600) / 60)

    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export const formatCompactTime = (timeSec: number) => {
  if (timeSec >= 3600) {
    const hours = Math.floor(timeSec / 3600)
    const minutes = Math.floor((timeSec % 3600) / 60)

    if (minutes === 0) {
      return `${hours}h`
    }

    return `${hours}h ${minutes}m`
  }

  const minutes = Math.floor(timeSec / 60)

  if (minutes === 0) {
    return `${timeSec}s`
  }

  return `${minutes}m`
}

export const formatTemperature = (temperatureC: number) => `${temperatureC.toFixed(1)}°C`

export const createTimeTicks = (maxTimeSec: number, tickCount: number) =>
  createTimeTicksForRange(0, maxTimeSec, tickCount)

export const createTimeTicksForRange = (
  startTimeSec: number,
  endTimeSec: number,
  tickCount: number,
) => {
  if (tickCount <= 1) {
    return [startTimeSec, endTimeSec]
  }

  const ticks = Array.from({ length: tickCount }, (_, index) =>
    Math.round(startTimeSec + ((endTimeSec - startTimeSec) * index) / (tickCount - 1)),
  )

  ticks[0] = startTimeSec
  ticks[ticks.length - 1] = endTimeSec

  return Array.from(new Set(ticks))
}
