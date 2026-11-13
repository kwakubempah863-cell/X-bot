import ping from 'ping'
import systeminformation from 'systeminformation'

function formatUptime(totalSeconds) {
  const totalMinutes = Math.floor(Math.max(0, Number(totalSeconds) || 0) / 60)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const parts = []

  if (days > 0) parts.push(`${days}d`)
  if (hours > 0 || days > 0) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)

  return parts.join(' ')
}

export async function getSystemStats() {
  const [cpu, memory, pingResult] = await Promise.all([
    systeminformation.currentLoad(),
    systeminformation.mem(),
    ping.promise.probe('8.8.8.8', { timeout: 2, min_reply: 1 })
  ])

  const cpuLoadPercent = Number(cpu.currentLoad)
  const ramUsedMb = memory.used / (1024 * 1024)
  const ramTotalGb = memory.total / (1024 * 1024 * 1024)

  if (![cpuLoadPercent, ramUsedMb, ramTotalGb].every(Number.isFinite)) {
    throw new Error('System information returned invalid CPU or memory statistics')
  }

  const pingTime = Number(pingResult.time)

  return {
    cpuLoadPercent: Number(cpuLoadPercent.toFixed(1)),
    ramUsedMb: Number(ramUsedMb.toFixed(1)),
    ramTotalGb: Number(ramTotalGb.toFixed(2)),
    botUptime: formatUptime(process.uptime()),
    botPing: pingResult.alive && Number.isFinite(pingTime)
      ? `${Math.round(pingTime)}ms`
      : 'Timeout'
  }
}
