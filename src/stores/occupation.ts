import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Occupation, Angler, OccupationStatus } from '@/types'
import { genId, formatDateTime } from '@/utils'
import { useSpotStore } from './spot'

export const useAnglerStore = defineStore('angler', () => {
  const anglers = ref<Angler[]>(loadFromStorage())

  function loadFromStorage(): Angler[] {
    try {
      const saved = localStorage.getItem('fishing_anglers')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return [
      { id: 'a1', name: '张三', phone: '13800138001', createTime: formatDateTime(new Date()) },
      { id: 'a2', name: '李四', phone: '13800138002', createTime: formatDateTime(new Date()) },
    ]
  }

  function save() {
    localStorage.setItem('fishing_anglers', JSON.stringify(anglers.value))
  }

  function getAnglerById(id: string) {
    return anglers.value.find(a => a.id === id)
  }

  function addAngler(data: Omit<Angler, 'id' | 'createTime'>) {
    const angler: Angler = { ...data, id: genId(), createTime: formatDateTime(new Date()) }
    anglers.value.push(angler)
    save()
    return angler
  }

  function updateAngler(id: string, data: Partial<Angler>) {
    const idx = anglers.value.findIndex(a => a.id === id)
    if (idx !== -1) {
      anglers.value[idx] = { ...anglers.value[idx], ...data }
      save()
    }
  }

  function findOrCreate(name: string, phone: string) {
    let angler = anglers.value.find(a => a.phone === phone)
    if (!angler) {
      angler = addAngler({ name, phone })
    }
    return angler
  }

  return { anglers, getAnglerById, addAngler, updateAngler, findOrCreate }
})

export function getEffectiveStartTime(occ: Occupation): string {
  return occ.actualStartTime || occ.expectedStartTime || occ.startTime
}

export const useOccupationStore = defineStore('occupation', () => {
  const occupations = ref<Occupation[]>(loadFromStorage())

  function loadFromStorage(): Occupation[] {
    try {
      const saved = localStorage.getItem('fishing_occupations')
      if (saved) {
        const parsed = JSON.parse(saved) as Occupation[]
        return parsed.map(o => ({
          billingStatus: 'unbilled',
          ...o
        }))
      }
    } catch (e) {}
    return []
  }

  function save() {
    localStorage.setItem('fishing_occupations', JSON.stringify(occupations.value))
  }

  const reservedOccupations = computed(() =>
    occupations.value.filter(o => o.status === 'reserved')
  )

  const activeOccupations = computed(() =>
    occupations.value.filter(o => o.status === 'active')
  )

  const completedOccupations = computed(() =>
    occupations.value.filter(o => o.status === 'completed')
  )

  const pendingBillOccupations = computed(() =>
    occupations.value.filter(o =>
      ((o.status === 'completed' || o.status === 'pending_bill' || o.status === 'reserved') &&
      o.billingStatus === 'unbilled')
    )
  )

  function isSpotOccupied(spotId: string, atTime?: string): boolean {
    const checkTime = atTime ? new Date(atTime).getTime() : Date.now()
    return occupations.value.some(o => {
      if (o.status === 'cancelled' || o.status === 'split') return false
      if (!o.spotIds.includes(spotId)) return false
      const start = new Date(getEffectiveStartTime(o)).getTime()
      const end = o.expectedEndTime ? new Date(o.expectedEndTime).getTime()
        : o.endTime ? new Date(o.endTime).getTime()
        : Infinity
      return checkTime >= start && checkTime < end
    })
  }

  function getSpotOccupation(spotId: string, atTime?: string): Occupation | undefined {
    const checkTime = atTime ? new Date(atTime).getTime() : Date.now()
    return occupations.value.find(o => {
      if (o.status === 'cancelled' || o.status === 'split') return false
      if (!o.spotIds.includes(spotId)) return false
      const start = new Date(getEffectiveStartTime(o)).getTime()
      const end = o.expectedEndTime ? new Date(o.expectedEndTime).getTime()
        : o.endTime ? new Date(o.endTime).getTime()
        : Infinity
      return checkTime >= start && checkTime < end
    })
  }

  function getOccupationById(id: string): Occupation | undefined {
    return occupations.value.find(o => o.id === id)
  }

  function checkTimeConflict(spotIds: string[], startTime: string, endTime?: string, excludeOccId?: string): { conflict: boolean; message?: string } {
    const s = new Date(startTime).getTime()
    const e = endTime ? new Date(endTime).getTime() : Infinity

    for (const occ of occupations.value) {
      if (occ.status === 'cancelled' || occ.status === 'split' || occ.status === 'completed') continue
      if (excludeOccId && occ.id === excludeOccId) continue

      const hasOverlap = spotIds.some(id => occ.spotIds.includes(id))
      if (!hasOverlap) continue

      const occStart = new Date(getEffectiveStartTime(occ)).getTime()
      const occEnd = occ.expectedEndTime ? new Date(occ.expectedEndTime).getTime()
        : occ.endTime ? new Date(occ.endTime).getTime()
        : Infinity

      if (s < occEnd && e > occStart) {
        const spotStore = useSpotStore()
        const conflictSpots = spotIds
          .filter(id => occ.spotIds.includes(id))
          .map(id => spotStore.getSpotById(id)?.code || id)
          .join('、')
        return {
          conflict: true,
          message: `钓位 ${conflictSpots} 在该时段已被 ${occ.anglerName} 预订（${getEffectiveStartTime(occ)} ~ ${occ.expectedEndTime || '不限'}）`
        }
      }
    }
    return { conflict: false }
  }

  function validateContinuousSegment(spotIds: string[]): { valid: boolean; message?: string } {
    if (spotIds.length <= 1) return { valid: true }
    const spotStore = useSpotStore()

    const withPos = spotIds
      .map(id => spotStore.getSpotById(id))
      .filter((s): s is NonNullable<typeof s> => !!s)

    if (withPos.length !== spotIds.length) {
      return { valid: false, message: '存在无效钓位' }
    }

    const areas = new Set(withPos.map(s => s.area))
    if (areas.size > 1) {
      return { valid: false, message: '跨区域钓位不能合并预订' }
    }

    const sorted = [...withPos].sort((a, b) => a.position - b.position)
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1].position - sorted[i].position !== 1) {
        return {
          valid: false,
          message: `钓位 ${sorted[i].code} 和 ${sorted[i + 1].code} 不相邻，中间存在断档`
        }
      }
    }
    return { valid: true }
  }

  function splitIntoContinuousSegments(spotIds: string[]): string[][] {
    if (spotIds.length === 0) return []
    if (spotIds.length === 1) return [spotIds]

    const spotStore = useSpotStore()
    const withPos = spotIds
      .map(id => ({ id, spot: spotStore.getSpotById(id) }))
      .filter((x): x is { id: string; spot: NonNullable<typeof x.spot> } => !!x.spot)

    const byArea: Record<string, typeof withPos> = {}
    for (const x of withPos) {
      if (!byArea[x.spot.area]) byArea[x.spot.area] = []
      byArea[x.spot.area].push(x)
    }

    const segments: string[][] = []
    for (const areaItems of Object.values(byArea)) {
      areaItems.sort((a, b) => a.spot.position - b.spot.position)
      let currentSeg = [areaItems[0].id]
      for (let i = 1; i < areaItems.length; i++) {
        if (areaItems[i].spot.position - areaItems[i - 1].spot.position === 1) {
          currentSeg.push(areaItems[i].id)
        } else {
          segments.push(currentSeg)
          currentSeg = [areaItems[i].id]
        }
      }
      segments.push(currentSeg)
    }
    return segments
  }

  function createOccupation(
    spotIds: string[],
    anglerId: string,
    anglerName: string,
    options?: {
      expectedStartTime?: string
      expectedEndTime?: string
      checkInImmediately?: boolean
      deposit?: number
    }
  ): Occupation {
    const spotStore = useSpotStore()
    const now = formatDateTime(new Date())
    const expectedStart = options?.expectedStartTime || now
    const isMerged = spotIds.length > 1

    if (isMerged) {
      const check = validateContinuousSegment(spotIds)
      if (!check.valid) {
        throw new Error(check.message || '钓位不构成连续区间')
      }
    }

    const conflict = checkTimeConflict(spotIds, expectedStart, options?.expectedEndTime)
    if (conflict.conflict) {
      throw new Error(conflict.message || '预订时段冲突')
    }

    spotIds.forEach(id => {
      const spot = spotStore.getSpotById(id)
      if (!spot) throw new Error(`钓位不存在: ${id}`)
      if (spot.status === 'maintenance') throw new Error(`钓位 ${spot.name} 维护中，不可预订`)
      if (spot.status === 'closed') throw new Error(`钓位 ${spot.name} 已关闭`)
    })

    const sortedIds = [...spotIds].sort((a, b) => {
      const sa = spotStore.getSpotById(a)
      const sb = spotStore.getSpotById(b)
      return (sa?.position || 0) - (sb?.position || 0)
    })

    const checkInImmediately = options?.checkInImmediately ?? false

    const occ: Occupation = {
      id: genId(),
      spotId: sortedIds[0],
      spotIds: sortedIds,
      anglerId,
      anglerName,
      startTime: now,
      actualStartTime: checkInImmediately ? now : undefined,
      endTime: null,
      expectedStartTime: options?.expectedStartTime,
      expectedEndTime: options?.expectedEndTime,
      isMerged,
      parentId: null,
      status: checkInImmediately ? 'active' : 'reserved',
      billingStatus: 'unbilled',
      deposit: options?.deposit || 0,
      createTime: now
    }
    occupations.value.push(occ)
    save()
    return occ
  }

  function checkIn(occupationId: string): Occupation {
    const occ = getOccupationById(occupationId)
    if (!occ) throw new Error('占用记录不存在')
    if (occ.status !== 'reserved') {
      throw new Error('只有已预约的记录才能开钓')
    }
    const now = formatDateTime(new Date())
    occ.status = 'active'
    occ.actualStartTime = now
    save()
    return occ
  }

  function reschedule(
    occupationId: string,
    newExpectedStartTime: string,
    newExpectedEndTime?: string
  ): Occupation {
    const occ = getOccupationById(occupationId)
    if (!occ) throw new Error('占用记录不存在')
    if (occ.status !== 'reserved') {
      throw new Error('只有未开始的预约才能改期')
    }

    const conflict = checkTimeConflict(occ.spotIds, newExpectedStartTime, newExpectedEndTime, occ.id)
    if (conflict.conflict) {
      throw new Error(conflict.message || '改期时段冲突')
    }

    occ.expectedStartTime = newExpectedStartTime
    occ.expectedEndTime = newExpectedEndTime
    save()
    return occ
  }

  function cancelReservation(occupationId: string): Occupation {
    const occ = getOccupationById(occupationId)
    if (!occ) throw new Error('占用记录不存在')
    if (occ.status !== 'reserved') {
      throw new Error('只有未开始的预约才能取消')
    }
    occ.status = 'cancelled'
    occ.endTime = formatDateTime(new Date())
    save()
    return occ
  }

  function splitSpotOff(occupationId: string, spotId: string): {
    remaining: Occupation[]
    removed: Occupation
  } {
    const occ = getOccupationById(occupationId)
    if (!occ || occ.status !== 'active') {
      throw new Error('占用记录不存在或已结束')
    }
    if (!occ.spotIds.includes(spotId)) {
      throw new Error('钓位不在当前占用中')
    }

    const now = formatDateTime(new Date())
    occ.status = 'split'
    occ.endTime = now

    const remainingIds = occ.spotIds.filter(id => id !== spotId)
    const segments = splitIntoContinuousSegments(remainingIds)

    const removed: Occupation = {
      id: genId(),
      spotId: spotId,
      spotIds: [spotId],
      anglerId: occ.anglerId,
      anglerName: occ.anglerName,
      startTime: occ.startTime,
      actualStartTime: occ.actualStartTime,
      endTime: now,
      expectedStartTime: occ.expectedStartTime,
      expectedEndTime: now,
      isMerged: false,
      parentId: occ.id,
      status: 'pending_bill',
      billingStatus: 'unbilled',
      splitFromId: occ.id,
      createTime: now
    }
    occupations.value.push(removed)

    const remainingOccs: Occupation[] = []
    for (const seg of segments) {
      const newOcc: Occupation = {
        id: genId(),
        spotId: seg[0],
        spotIds: seg,
        anglerId: occ.anglerId,
        anglerName: occ.anglerName,
        startTime: occ.startTime,
        actualStartTime: occ.actualStartTime,
        endTime: null,
        expectedStartTime: occ.expectedStartTime,
        expectedEndTime: occ.expectedEndTime,
        isMerged: seg.length > 1,
        parentId: occ.id,
        status: 'active',
        billingStatus: 'unbilled',
        splitFromId: occ.id,
        createTime: now
      }
      occupations.value.push(newOcc)
      remainingOccs.push(newOcc)
    }

    save()
    return { remaining: remainingOccs, removed }
  }

  function splitOccupationAt(occupationId: string, splitSpotId: string): Occupation[] {
    const occ = getOccupationById(occupationId)
    if (!occ || occ.status !== 'active') {
      throw new Error('占用记录不存在或已结束')
    }
    if (!occ.isMerged || occ.spotIds.length < 2) {
      throw new Error('该占用并非合并状态')
    }
    if (!occ.spotIds.includes(splitSpotId)) {
      throw new Error('钓位不在当前合并占用中')
    }

    const now = formatDateTime(new Date())
    occ.status = 'split'
    occ.endTime = now

    const splitIdx = occ.spotIds.indexOf(splitSpotId)
    const leftIds = occ.spotIds.slice(0, splitIdx)
    const rightIds = occ.spotIds.slice(splitIdx)

    const results: Occupation[] = []
    for (const ids of [leftIds, rightIds]) {
      if (ids.length === 0) continue
      const segments = splitIntoContinuousSegments(ids)
      for (const seg of segments) {
        const newOcc: Occupation = {
          id: genId(),
          spotId: seg[0],
          spotIds: seg,
          anglerId: occ.anglerId,
          anglerName: occ.anglerName,
          startTime: occ.startTime,
          actualStartTime: occ.actualStartTime,
          endTime: null,
          expectedStartTime: occ.expectedStartTime,
          expectedEndTime: occ.expectedEndTime,
          isMerged: seg.length > 1,
          parentId: occ.id,
          status: 'active',
          billingStatus: 'unbilled',
          splitFromId: occ.id,
          createTime: now
        }
        occupations.value.push(newOcc)
        results.push(newOcc)
      }
    }

    save()
    return results
  }

  function endOccupation(occupationId: string): Occupation {
    const occ = getOccupationById(occupationId)
    if (!occ) throw new Error('占用记录不存在')
    if (occ.status !== 'active' && occ.status !== 'reserved') {
      throw new Error('只有进行中或已预约的占用才能结束')
    }
    occ.status = 'completed'
    occ.endTime = formatDateTime(new Date())
    if (occ.billingStatus !== 'billed' && occ.billingStatus !== 'paid') {
      occ.billingStatus = 'unbilled'
    }
    save()
    return occ
  }

  function markBilled(occupationId: string) {
    const occ = getOccupationById(occupationId)
    if (occ) {
      occ.billingStatus = 'billed'
      save()
    }
  }

  function markPaid(occupationId: string) {
    const occ = getOccupationById(occupationId)
    if (occ) {
      occ.status = 'completed'
      occ.billingStatus = 'paid'
      save()
    }
  }

  function resetToUnbilled(occupationId: string) {
    const occ = getOccupationById(occupationId)
    if (occ) {
      occ.billingStatus = 'unbilled'
      if (occ.status === 'completed') {
        occ.status = 'pending_bill'
      }
      save()
    }
  }

  function getOccupationsForDate(dateStr: string): Occupation[] {
    const startOfDay = new Date(dateStr + ' 00:00:00').getTime()
    const endOfDay = new Date(dateStr + ' 23:59:59').getTime()
    return occupations.value.filter(o => {
      if (o.status === 'split' || o.status === 'cancelled') return false
      const s = new Date(getEffectiveStartTime(o)).getTime()
      let e: number
      if (o.endTime) {
        e = new Date(o.endTime).getTime()
      } else if (o.expectedEndTime) {
        e = new Date(o.expectedEndTime).getTime()
      } else if (o.status === 'reserved' || o.status === 'active') {
        e = Infinity
      } else {
        e = Date.now()
      }
      return s <= endOfDay && e >= startOfDay
    })
  }

  return {
    occupations,
    reservedOccupations,
    activeOccupations,
    completedOccupations,
    pendingBillOccupations,
    isSpotOccupied,
    getSpotOccupation,
    getOccupationById,
    createOccupation,
    checkIn,
    reschedule,
    cancelReservation,
    splitSpotOff,
    splitOccupationAt,
    endOccupation,
    markBilled,
    markPaid,
    resetToUnbilled,
    validateContinuousSegment,
    splitIntoContinuousSegments,
    checkTimeConflict,
    getOccupationsForDate
  }
})
