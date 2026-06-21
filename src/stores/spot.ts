import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FishingSpot } from '@/types'
import { genId } from '@/utils'

const defaultSpots: FishingSpot[] = [
  { id: 's1', name: 'A区1号钓位', code: 'A01', area: 'A区', type: 'single', position: 1, status: 'available', basePrice: 30, description: '近岸草区，鲫鱼多' },
  { id: 's2', name: 'A区2号钓位', code: 'A02', area: 'A区', type: 'single', position: 2, status: 'available', basePrice: 30, description: '水深3米' },
  { id: 's3', name: 'A区3号钓位', code: 'A03', area: 'A区', type: 'single', position: 3, status: 'available', basePrice: 30 },
  { id: 's4', name: 'A区4号钓位', code: 'A04', area: 'A区', type: 'single', position: 4, status: 'available', basePrice: 30 },
  { id: 's5', name: 'A区5号钓位', code: 'A05', area: 'A区', type: 'double', position: 5, status: 'available', basePrice: 50, description: '双人大钓位' },
  { id: 's6', name: 'B区1号钓位', code: 'B01', area: 'B区', type: 'single', position: 1, status: 'available', basePrice: 35, description: '湖心平台' },
  { id: 's7', name: 'B区2号钓位', code: 'B02', area: 'B区', type: 'single', position: 2, status: 'available', basePrice: 35 },
  { id: 's8', name: 'B区3号钓位', code: 'B03', area: 'B区', type: 'single', position: 3, status: 'maintenance', basePrice: 35, description: '维护中' },
  { id: 's9', name: 'B区4号钓位', code: 'B04', area: 'B区', type: 'single', position: 4, status: 'available', basePrice: 35 },
  { id: 's10', name: 'B区5号钓位', code: 'B05', area: 'B区', type: 'platform', position: 5, status: 'available', basePrice: 80, description: 'VIP浮台钓位' },
]

export const useSpotStore = defineStore('spot', () => {
  const spots = ref<FishingSpot[]>(loadFromStorage())

  function loadFromStorage(): FishingSpot[] {
    try {
      const saved = localStorage.getItem('fishing_spots')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return defaultSpots
  }

  function save() {
    localStorage.setItem('fishing_spots', JSON.stringify(spots.value))
  }

  const availableSpots = computed(() => spots.value.filter(s => s.status === 'available'))

  const groupedByArea = computed(() => {
    const groups: Record<string, FishingSpot[]> = {}
    spots.value.forEach(spot => {
      if (!groups[spot.area]) groups[spot.area] = []
      groups[spot.area].push(spot)
    })
    Object.values(groups).forEach(arr => arr.sort((a, b) => a.position - b.position))
    return groups
  })

  function getSpotById(id: string): FishingSpot | undefined {
    return spots.value.find(s => s.id === id)
  }

  function addSpot(data: Omit<FishingSpot, 'id'>) {
    const spot: FishingSpot = { ...data, id: genId() }
    spots.value.push(spot)
    save()
    return spot
  }

  function updateSpot(id: string, data: Partial<FishingSpot>) {
    const idx = spots.value.findIndex(s => s.id === id)
    if (idx !== -1) {
      spots.value[idx] = { ...spots.value[idx], ...data }
      save()
    }
  }

  function deleteSpot(id: string) {
    spots.value = spots.value.filter(s => s.id !== id)
    save()
  }

  function areAdjacent(spotId1: string, spotId2: string): boolean {
    const s1 = getSpotById(spotId1)
    const s2 = getSpotById(spotId2)
    if (!s1 || !s2) return false
    if (s1.area !== s2.area) return false
    return Math.abs(s1.position - s2.position) === 1
  }

  function getAdjacentSpots(spotId: string): FishingSpot[] {
    const spot = getSpotById(spotId)
    if (!spot) return []
    return spots.value.filter(s =>
      s.area === spot.area &&
      Math.abs(s.position - spot.position) === 1 &&
      s.status === 'available'
    )
  }

  return {
    spots,
    availableSpots,
    groupedByArea,
    getSpotById,
    addSpot,
    updateSpot,
    deleteSpot,
    areAdjacent,
    getAdjacentSpots
  }
})
