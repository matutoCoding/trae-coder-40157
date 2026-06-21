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

export type OccupationStatus = 'active' | 'completed' | 'split' | 'pending_bill'

export interface Occupation {
  id: string
  spotId: string
  spotIds: string[]
  anglerId: string
  anglerName: string
  startTime: string
  endTime: string | null
  expectedStartTime?: string
  expectedEndTime?: string
  isMerged: boolean
  parentId: string | null
  status: OccupationStatus
  splitFromId?: string
  billingStatus: 'unbilled' | 'billed' | 'paid'
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

export interface Bill {
  id: string
  occupationId: string
  anglerId: string
  anglerName: string
  spotIds: string[]
  spotNames: string
  startTime: string
  endTime: string
  totalHours: number
  billingDetails: BillingDetail[]
  fishingFee: number
  catches: CatchRecord[]
  catchTotal: number
  discount: number
  totalAmount: number
  paid: boolean
  payTime?: string
  createTime: string
}

export type ModuleKey = 'schedule' | 'merge' | 'pricing' | 'billing'
