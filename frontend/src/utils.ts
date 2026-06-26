export const parseCPU = (cpuStr: string): number => {
  if (!cpuStr) return 0
  if (cpuStr.endsWith('n')) return parseInt(cpuStr.slice(0, -1)) / 1000000000
  if (cpuStr.endsWith('m')) return parseInt(cpuStr.slice(0, -1)) / 1000
  return parseInt(cpuStr)
}

export const parseMemory = (memStr: string): number => {
  if (!memStr) return 0
  if (memStr.endsWith('Ki')) return parseInt(memStr.slice(0, -2)) / (1024 * 1024)
  if (memStr.endsWith('Mi')) return parseInt(memStr.slice(0, -2)) / 1024
  if (memStr.endsWith('Gi')) return parseInt(memStr.slice(0, -2))
  return parseInt(memStr)
}
