import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Occupation, Angler } from '@/types'
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

export const useOccupationStore = defineStore('occupation', () => {
  const occupations = ref<Occupation[]>(loadFromStorage())

  function loadFromStorage(): Occupation[] {
    try {
      const saved = localStorage.getItem('fishing_occupations')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return []
  }

  function save() {
    localStorage.setItem('fishing_occupations', JSON.stringify(occupations.value))
  }

  const activeOccupations = computed(() =>
    occupations.value.filter(o => o.status === 'active')
  )

  const completedOccupations = computed(() =>
    occupations.value.filter(o => o.status === 'completed')
  )

  function isSpotOccupied(spotId: string): boolean {
    return activeOccupations.value.some(o =>
      o.status === 'active' && o.spotIds.includes(spotId)
    )
  }

  function getSpotOccupation(spotId: string): Occupation | undefined {
    return activeOccupations.value.find(o => o.spotIds.includes(spotId))
  }

  function getOccupationById(id: string): Occupation | undefined {
    return occupations.value.find(o => o.id === id)
  }

  function createOccupation(spotIds: string[], anglerId: string, anglerName: string): Occupation {
    const spotStore = useSpotStore()
    const now = formatDateTime(new Date())
    const isMerged = spotIds.length > 1

    if (isMerged) {
      for (let i = 0; i < spotIds.length - 1; i++) {
        if (!spotStore.areAdjacent(spotIds[i], spotIds[i + 1])) {
          throw new Error('只有相邻钓位才能合并预订')
        }
      }
    }

    spotIds.forEach(id => {
      if (isSpotOccupied(id)) {
        const spot = spotStore.getSpotById(id)
        throw new Error(`钓位 ${spot?.name || id} 已被占用`)
      }
    })

    const sortedIds = [...spotIds].sort((a, b) => {
      const sa = spotStore.getSpotById(a)
      const sb = spotStore.getSpotById(b)
      return (sa?.position || 0) - (sb?.position || 0)
    })

    const occ: Occupation = {
      id: genId(),
      spotId: sortedIds[0],
      spotIds: sortedIds,
      anglerId,
      anglerName,
      startTime: now,
      endTime: null,
      isMerged,
      parentId: null,
      status: 'active',
      createTime: now
    }
    occupations.value.push(occ)
    save()
    return occ
  }

  function splitOccupation(occupationId: string, splitSpotId: string, splitTime?: string): Occupation[] {
    const occ = getOccupationById(occupationId)
    if (!occ || occ.status !== 'active') {
      throw new Error('占用记录不存在或已结束')
    }
    if (!occ.isMerged || occ.spotIds.length < 2) {
      throw new Error('该占用并非合并状态，无需拆分')
    }
    if (!occ.spotIds.includes(splitSpotId)) {
      throw new Error('钓位不在当前合并占用中')
    }

    const spotStore = useSpotStore()
    const now = splitTime || formatDateTime(new Date())

    const splitIdx = occ.spotIds.indexOf(splitSpotId)
    const leftIds = occ.spotIds.slice(0, splitIdx)
    const rightIds = occ.spotIds.slice(splitIdx + 1)

    occ.status = 'split'
    occ.endTime = now

    const results: Occupation[] = []

    if (leftIds.length > 0) {
      const left: Occupation = {
        id: genId(),
        spotId: leftIds[0],
        spotIds: leftIds,
        anglerId: occ.anglerId,
        anglerName: occ.anglerName,
        startTime: occ.startTime,
        endTime: null,
        isMerged: leftIds.length > 1,
        parentId: occ.id,
        status: 'active',
        splitFromId: occ.id,
        createTime: now
      }
      occupations.value.push(left)
      results.push(left)
    }

    if (rightIds.length > 0) {
      const right: Occupation = {
        id: genId(),
        spotId: rightIds[0],
        spotIds: rightIds,
        anglerId: occ.anglerId,
        anglerName: occ.anglerName,
        startTime: occ.startTime,
        endTime: null,
        isMerged: rightIds.length > 1,
        parentId: occ.id,
        status: 'active',
        splitFromId: occ.id,
        createTime: now
      }
      occupations.value.push(right)
      results.push(right)
    }

    save()
    return results
  }

  function splitSpotOff(occupationId: string, spotId: string): { remaining: Occupation | null; removed: Occupation } {
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

    const removedIds = [spotId]
    const remainingIds = occ.spotIds.filter(id => id !== spotId)

    const removed: Occupation = {
      id: genId(),
      spotId: spotId,
      spotIds: removedIds,
      anglerId: occ.anglerId,
      anglerName: occ.anglerName,
      startTime: occ.startTime,
      endTime: now,
      isMerged: false,
      parentId: occ.id,
      status: 'completed',
      splitFromId: occ.id,
      createTime: now
    }
    occupations.value.push(removed)

    let remaining: Occupation | null = null
    if (remainingIds.length > 0) {
      remaining = {
        id: genId(),
        spotId: remainingIds[0],
        spotIds: remainingIds,
        anglerId: occ.anglerId,
        anglerName: occ.anglerName,
        startTime: occ.startTime,
        endTime: null,
        isMerged: remainingIds.length > 1,
        parentId: occ.id,
        status: 'active',
        splitFromId: occ.id,
        createTime: now
      }
      occupations.value.push(remaining)
    }

    save()
    return { remaining, removed }
  }

  function endOccupation(occupationId: string): Occupation {
    const occ = getOccupationById(occupationId)
    if (!occ) throw new Error('占用记录不存在')
    occ.status = 'completed'
    occ.endTime = formatDateTime(new Date())
    save()
    return occ
  }

  return {
    occupations,
    activeOccupations,
    completedOccupations,
    isSpotOccupied,
    getSpotOccupation,
    getOccupationById,
    createOccupation,
    splitOccupation,
    splitSpotOff,
    endOccupation
  }
})
