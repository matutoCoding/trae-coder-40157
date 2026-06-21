export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function calcHours(start: string, end: string): number {
  const diff = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(0, diff / (1000 * 60 * 60))
}

export function roundTo(num: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals)
  return Math.round(num * factor) / factor
}
