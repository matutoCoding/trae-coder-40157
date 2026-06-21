import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PriceTier, BillingDetail } from '@/types'
import { genId, calcHours, roundTo } from '@/utils'

const defaultTiers: PriceTier[] = [
  { id: 't1', name: '第1档（0-2小时）', startHours: 0, endHours: 2, pricePerHour: 30, sort: 1, description: '起步价' },
  { id: 't2', name: '第2档（2-4小时）', startHours: 2, endHours: 4, pricePerHour: 40, sort: 2, description: '中期加档' },
  { id: 't3', name: '第3档（4-6小时）', startHours: 4, endHours: 6, pricePerHour: 55, sort: 3 },
  { id: 't4', name: '第4档（6-8小时）', startHours: 6, endHours: 8, pricePerHour: 70, sort: 4, description: '长时间垂钓' },
  { id: 't5', name: '第5档（8小时以上）', startHours: 8, endHours: null, pricePerHour: 90, sort: 5, description: '包场档位' },
]

export const usePricingStore = defineStore('pricing', () => {
  const tiers = ref<PriceTier[]>(loadFromStorage())

  function loadFromStorage(): PriceTier[] {
    try {
      const saved = localStorage.getItem('fishing_tiers')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return defaultTiers
  }

  function save() {
    localStorage.setItem('fishing_tiers', JSON.stringify(tiers.value))
  }

  const sortedTiers = computed(() => [...tiers.value].sort((a, b) => a.sort - b.sort))

  function addTier(data: Omit<PriceTier, 'id'>) {
    const tier: PriceTier = { ...data, id: genId() }
    tiers.value.push(tier)
    save()
    return tier
  }

  function updateTier(id: string, data: Partial<PriceTier>) {
    const idx = tiers.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      tiers.value[idx] = { ...tiers.value[idx], ...data }
      save()
    }
  }

  function deleteTier(id: string) {
    tiers.value = tiers.value.filter(t => t.id !== id)
    save()
  }

  function calculateBilling(startTime: string, endTime: string, basePrice: number = 1, spotCount: number = 1): {
    totalHours: number
    details: BillingDetail[]
    total: number
    currentTier?: PriceTier
    nextTierInfo?: { tier: PriceTier; hoursToNext: number }
  } {
    const totalHours = calcHours(startTime, endTime)
    const details: BillingDetail[] = []
    let remainingHours = totalHours
    let total = 0

    const sorted = sortedTiers.value

    for (const tier of sorted) {
      const tierStart = tier.startHours
      const tierEnd = tier.endHours
      const tierDuration = tierEnd !== null ? tierEnd - tierStart : Infinity

      if (remainingHours <= 0) break

      if (totalHours > tierStart) {
        const hoursInTier = Math.min(
          tierDuration,
          Math.max(0, Math.min(remainingHours, totalHours - tierStart))
        )
        if (hoursInTier > 0) {
          const subtotal = roundTo(hoursInTier * tier.pricePerHour * basePrice * spotCount)
          details.push({
            tierId: tier.id,
            tierName: tier.name,
            hours: roundTo(hoursInTier, 2),
            pricePerHour: tier.pricePerHour,
            subtotal
          })
          total += subtotal
          remainingHours -= hoursInTier
        }
      }
    }

    let currentTier: PriceTier | undefined
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (totalHours >= sorted[i].startHours) {
        currentTier = sorted[i]
        break
      }
    }

    let nextTierInfo: { tier: PriceTier; hoursToNext: number } | undefined
    if (currentTier) {
      const currentIdx = sorted.findIndex(t => t.id === currentTier!.id)
      if (currentIdx < sorted.length - 1) {
        const nextTier = sorted[currentIdx + 1]
        const hoursToNext = roundTo(nextTier.startHours - totalHours, 2)
        if (hoursToNext > 0) {
          nextTierInfo = { tier: nextTier, hoursToNext }
        }
      }
    }

    return {
      totalHours: roundTo(totalHours, 2),
      details,
      total: roundTo(total),
      currentTier,
      nextTierInfo
    }
  }

  function getHoursForTier(tierId: string, totalHours: number): number {
    const tier = tiers.value.find(t => t.id === tierId)
    if (!tier) return 0
    const tierDuration = tier.endHours !== null ? tier.endHours - tier.startHours : Infinity
    if (totalHours <= tier.startHours) return 0
    return Math.min(tierDuration, totalHours - tier.startHours)
  }

  return {
    tiers,
    sortedTiers,
    addTier,
    updateTier,
    deleteTier,
    calculateBilling,
    getHoursForTier
  }
})
