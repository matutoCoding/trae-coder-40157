import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Bill, CatchRecord } from '@/types'
import { genId, formatDateTime, roundTo } from '@/utils'
import { usePricingStore } from './pricing'
import { useSpotStore } from './spot'
import { useOccupationStore, getEffectiveStartTime } from './occupation'

export const useBillStore = defineStore('bill', () => {
  const bills = ref<Bill[]>(loadFromStorage())
  const catches = ref<CatchRecord[]>(loadCatches())

  function loadFromStorage(): Bill[] {
    try {
      const saved = localStorage.getItem('fishing_bills')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return []
  }

  function loadCatches(): CatchRecord[] {
    try {
      const saved = localStorage.getItem('fishing_catches')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return []
  }

  function save() {
    localStorage.setItem('fishing_bills', JSON.stringify(bills.value))
    localStorage.setItem('fishing_catches', JSON.stringify(catches.value))
  }

  const unpaidBills = computed(() => bills.value.filter(b => !b.paid))
  const paidBills = computed(() => bills.value.filter(b => b.paid))

  function getBillById(id: string) {
    return bills.value.find(b => b.id === id)
  }

  function getBillByOccupation(occupationId: string) {
    return bills.value.find(b => b.occupationId === occupationId)
  }

  function getCatchesByOccupation(occupationId: string) {
    return catches.value.filter(c => c.occupationId === occupationId)
  }

  function addCatch(data: Omit<CatchRecord, 'id' | 'createTime'>) {
    const record: CatchRecord = {
      ...data,
      id: genId(),
      createTime: formatDateTime(new Date())
    }
    catches.value.push(record)
    save()
    return record
  }

  function deleteCatch(id: string) {
    catches.value = catches.value.filter(c => c.id !== id)
    save()
  }

  function generateBill(occupationId: string, endTime: string, discount: number = 0): Bill {
    const pricingStore = usePricingStore()
    const spotStore = useSpotStore()
    const occStore = useOccupationStore()

    const occ = occStore.getOccupationById(occupationId)
    if (!occ) throw new Error('占用记录不存在')

    const spotNames = occ.spotIds
      .map(id => spotStore.getSpotById(id)?.name || '未知')
      .join('、')

    const basePrice = occ.spotIds.length > 0
      ? (spotStore.getSpotById(occ.spotIds[0])?.basePrice || 30) / 30
      : 1

    const actualStartTime = getEffectiveStartTime(occ)
    const billing = pricingStore.calculateBilling(actualStartTime, endTime, basePrice, occ.spotIds.length)

    const occCatches = getCatchesByOccupation(occupationId)
    const catchTotal = roundTo(occCatches.reduce((sum, c) => sum + c.weight * c.unitPrice, 0))

    const totalAmount = roundTo(Math.max(0, billing.total + catchTotal - discount))

    const expectedStartTime = occ.expectedStartTime || occ.startTime

    const existing = getBillByOccupation(occupationId)
    if (existing) {
      Object.assign(existing, {
        expectedStartTime,
        actualStartTime,
        endTime,
        startTime: actualStartTime,
        totalHours: billing.totalHours,
        billingDetails: billing.details,
        fishingFee: billing.total,
        catches: occCatches,
        catchTotal,
        discount,
        totalAmount
      })
      occStore.markBilled(occupationId)
      save()
      return existing
    }

    const bill: Bill = {
      id: genId(),
      occupationId,
      anglerId: occ.anglerId,
      anglerName: occ.anglerName,
      spotIds: occ.spotIds,
      spotNames,
      expectedStartTime,
      actualStartTime,
      endTime,
      startTime: actualStartTime,
      totalHours: billing.totalHours,
      billingDetails: billing.details,
      fishingFee: billing.total,
      catches: occCatches,
      catchTotal,
      discount,
      totalAmount,
      paid: false,
      createTime: formatDateTime(new Date())
    }
    bills.value.push(bill)
    occStore.markBilled(occupationId)
    save()
    return bill
  }

  function markPaid(billId: string) {
    const bill = getBillById(billId)
    if (bill) {
      bill.paid = true
      bill.payTime = formatDateTime(new Date())
      const occStore = useOccupationStore()
      occStore.markPaid(bill.occupationId)
      save()
    }
  }

  return {
    bills,
    catches,
    unpaidBills,
    paidBills,
    getBillById,
    getBillByOccupation,
    getCatchesByOccupation,
    addCatch,
    deleteCatch,
    generateBill,
    markPaid
  }
})
