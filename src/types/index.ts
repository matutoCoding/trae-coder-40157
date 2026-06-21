export interface Angler {
  id: string
  name: string
  phone: string
  idCard?: string
  createTime: string
}

export interface FishingSpot {
  id: string
  name: string
  code: string
  area: string
  type: 'single' | 'double' | 'platform'
  position: number
  status: 'available' | 'maintenance' | 'closed'
  basePrice: number
  description?: string
}

export type OccupationStatus = 'reserved' | 'active' | 'completed' | 'split' | 'pending_bill' | 'cancelled'

export interface Occupation {
  id: string
  spotId: string
  spotIds: string[]
  anglerId: string
  anglerName: string
  startTime: string
  actualStartTime?: string
  endTime: string | null
  expectedStartTime?: string
  expectedEndTime?: string
  isMerged: boolean
  parentId: string | null
  status: OccupationStatus
  splitFromId?: string
  billingStatus: 'unbilled' | 'billed' | 'paid'
  deposit?: number
  createTime: string
}

export interface PriceTier {
  id: string
  name: string
  startHours: number
  endHours: number | null
  pricePerHour: number
  description?: string
  sort: number
}

export interface CatchRecord {
  id: string
  occupationId: string
  fishType: string
  weight: number
  unitPrice: number
  createTime: string
}

export interface BillingDetail {
  tierId: string
  tierName: string
  hours: number
  pricePerHour: number
  subtotal: number
}

export type BillStatus = 'active' | 'voided'

export interface Bill {
  id: string
  occupationId: string
  anglerId: string
  anglerName: string
  spotIds: string[]
  spotNames: string
  expectedStartTime: string
  actualStartTime: string
  endTime: string
  startTime: string
  totalHours: number
  billingDetails: BillingDetail[]
  fishingFee: number
  catches: CatchRecord[]
  catchTotal: number
  discount: number
  deposit: number
  totalAmount: number
  amountDue: number
  paid: boolean
  paidAmount: number
  paymentStatus: 'unpaid' | 'partial' | 'paid'
  billStatus: BillStatus
  voidReason?: string
  voidTime?: string
  payTime?: string
  createTime: string
}

export type ModuleKey = 'schedule' | 'merge' | 'pricing' | 'billing'
