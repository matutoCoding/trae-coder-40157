import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Bill, CatchRecord, BillStatus } from '@/types'
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
      if (saved) {
        const parsed = JSON.parse(saved) as Bill[]
        return parsed.map(b => ({
          deposit: 0,
          amountDue: b.totalAmount,
          paidAmount: b.paid ? b.totalAmount : 0,
          paymentStatus: (b.paid ? 'paid' : 'unpaid') as any,
          billStatus: 'active' as BillStatus,
          ...b
        }))
      }
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

  const activeBills = computed(() => bills.value.filter(b => b.billStatus === 'active'))
  const voidedBills = computed(() => bills.value.filter(b => b.billStatus === 'voided'))
  const unpaidBills = computed(() => activeBills.value.filter(b => b.paymentStatus !== 'paid'))
  const paidBills = computed(() => activeBills.value.filter(b => b.paymentStatus === 'paid'))
  const partialBills = computed(() => activeBills.value.filter(b => b.paymentStatus === 'partial'))

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

  function generateBill(occupationId: string, endTime: string, discount: number = 0, extraDeposit: number = 0): Bill {
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

    const deposit = roundTo((occ.deposit || 0) + extraDeposit)
    const subtotal = roundTo(billing.total + catchTotal)
    const totalAmount = roundTo(Math.max(0, subtotal - discount))
    const amountDue = roundTo(Math.max(0, totalAmount - deposit))

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
        deposit,
        totalAmount,
        amountDue,
        billStatus: 'active' as BillStatus
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
      deposit,
      totalAmount,
      amountDue,
      paid: false,
      paidAmount: 0,
      paymentStatus: 'unpaid',
      billStatus: 'active',
      createTime: formatDateTime(new Date())
    }
    bills.value.push(bill)
    occStore.markBilled(occupationId)
    save()
    return bill
  }

  function markPaid(billId: string, paymentAmount?: number) {
    const bill = getBillById(billId)
    if (!bill) return
    if (bill.billStatus !== 'active') throw new Error('账单已作废，无法收款')

    const payAmt = paymentAmount !== undefined ? roundTo(paymentAmount) : bill.amountDue
    if (payAmt <= 0) throw new Error('收款金额必须大于0')
    if (payAmt > bill.amountDue) throw new Error(`收款金额不能超过待收款 ¥${bill.amountDue.toFixed(2)}`)

    bill.paidAmount = roundTo(bill.paidAmount + payAmt)
    bill.amountDue = roundTo(Math.max(0, bill.amountDue - payAmt))

    if (bill.amountDue <= 0.001) {
      bill.paid = true
      bill.paymentStatus = 'paid'
      bill.payTime = formatDateTime(new Date())
      const occStore = useOccupationStore()
      occStore.markPaid(bill.occupationId)
    } else {
      bill.paid = false
      bill.paymentStatus = 'partial'
    }
    save()
    return bill
  }

  function voidBill(billId: string, reason: string = '') {
    const bill = getBillById(billId)
    if (!bill) throw new Error('账单不存在')
    if (bill.billStatus !== 'active') throw new Error('账单已作废')
    if (bill.paymentStatus === 'paid') throw new Error('已收款账单不能作废，若需调整请联系管理员')

    bill.billStatus = 'voided'
    bill.voidReason = reason
    bill.voidTime = formatDateTime(new Date())

    const occStore = useOccupationStore()
    occStore.resetToUnbilled(bill.occupationId)
    save()
    return bill
  }

  return {
    bills,
    catches,
    activeBills,
    voidedBills,
    unpaidBills,
    paidBills,
    partialBills,
    getBillById,
    getBillByOccupation,
    getCatchesByOccupation,
    addCatch,
    deleteCatch,
    generateBill,
    markPaid,
    voidBill
  }
})
