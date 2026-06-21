<template>
  <div class="page-container">
    <div class="card">
      <div class="flex-between mb-16">
        <div class="section-title">
          <el-icon><Calendar /></el-icon>
          钓位排期
        </div>
        <div class="flex-center" style="gap: 12px;">
          <el-radio-group v-model="datePreset" size="default" @change="onPresetChange">
            <el-radio-button label="today">今天</el-radio-button>
            <el-radio-button label="tomorrow">明天</el-radio-button>
            <el-radio-button label="custom">自定义</el-radio-button>
          </el-radio-group>
          <el-date-picker
            v-if="datePreset === 'custom'"
            v-model="viewDate"
            type="date"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            style="width: 160px;"
          />
          <el-tag type="success" effect="light">空闲 {{ availableCount }}</el-tag>
          <el-tag type="primary" effect="light">已预约 {{ reservedCount }}</el-tag>
          <el-tag type="danger" effect="light">垂钓中 {{ activeCount }}</el-tag>
          <el-tag type="info" effect="light">维护 {{ maintenanceCount }}</el-tag>
        </div>
      </div>

      <div class="time-filter-bar mb-16">
        <el-radio-group v-model="timeRange" size="default">
          <el-radio-button label="all">全天</el-radio-button>
          <el-radio-button label="morning">上午 06:00-12:00</el-radio-button>
          <el-radio-button label="afternoon">下午 12:00-18:00</el-radio-button>
          <el-radio-button label="evening">夜钓 18:00-24:00</el-radio-button>
        </el-radio-group>
        <el-input
          v-model="searchKeyword"
          placeholder="快速查预约：输入姓名或手机号"
          clearable
          style="width: 260px; margin-left: 16px;"
          size="default"
          :prefix-icon="Search"
          @keyup.enter="handleSearch"
        >
          <template #append>
            <el-button @click="handleSearch">查找</el-button>
          </template>
        </el-input>
      </div>

      <div v-for="(spots, area) in spotStore.groupedByArea" :key="area" class="area-section">
        <div class="area-title">
          <el-icon><LocationFilled /></el-icon>
          {{ area }}
        </div>
        <div class="spots-grid">
          <div
            v-for="spot in spots"
            :key="spot.id"
            class="spot-card"
            :class="getSpotClass(spot.id)"
            @click="handleSpotClick(spot.id)"
          >
            <div class="spot-code">{{ spot.code }}</div>
            <div class="spot-name">{{ spot.name }}</div>
            <div class="spot-type">{{ getTypeLabel(spot.type) }}</div>
            <div v-if="getSpotStatus(spot.id) === 'active'" class="spot-angler">
              <el-icon><User /></el-icon>
              {{ getSpotAngler(spot.id) }}
            </div>
            <div v-else-if="getSpotStatus(spot.id) === 'reserved'" class="spot-reserved">
              <el-icon><Clock /></el-icon>
              已预约
            </div>
            <div v-else-if="spot.status === 'maintenance'" class="spot-maint">
              <el-icon><Tools /></el-icon>
              维护中
            </div>
            <div v-else class="spot-price">
              ¥{{ spot.basePrice }}/时起
            </div>
            <div v-if="getSpotUpcomingOccs(spot.id).length > 0" class="spot-timeline">
              <div class="timeline-title">
                <el-icon><Clock /></el-icon>
                当日排期
              </div>
              <div
                v-for="occ in getSpotUpcomingOccs(spot.id)"
                :key="occ.id"
                class="timeline-item"
                :class="'tl-' + occ.status"
                :title="`${occ.anglerName} ${formatShortTime(occ.expectedStartTime || occ.startTime)} ~ ${formatShortTime(occ.expectedEndTime || '正在垂钓')}`"
              >
                <span class="tl-time">{{ formatShortTime(occ.expectedStartTime || occ.startTime) }}</span>
                <span v-if="occ.status === 'reserved'" class="tl-tag tl-tag-warn">预</span>
                <span v-else-if="occ.status === 'active'" class="tl-tag tl-tag-active">钓</span>
                <span class="tl-name">{{ occ.anglerName }}</span>
                <span v-if="occ.deposit && occ.deposit > 0" class="tl-deposit">订¥{{ occ.deposit }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-16">
      <div class="section-title">
        <el-icon><List /></el-icon>
        {{ viewDateLabel }}的排期记录
      </div>
      <el-table :data="scheduledOccs" stripe style="width: 100%" :row-key="row => row.id"
        :row-class-name="getOccRowClassName" ref="occTableRef">
        <el-table-column prop="anglerName" label="钓友" width="120" />
        <el-table-column label="钓位" min-width="180">
          <template #default="{ row }">
            <el-tag
              v-for="sid in row.spotIds"
              :key="sid"
              :type="row.isMerged ? 'warning' : 'primary'"
              effect="light"
              style="margin-right: 4px;"
            >
              {{ spotStore.getSpotById(sid)?.code }}
            </el-tag>
            <el-tag v-if="row.isMerged" type="warning" size="small">合并</el-tag>
            <el-tag v-if="row.splitFromId" type="info" size="small">拆分后</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="预约时间" width="200">
          <template #default="{ row }">
            <div style="font-size: 12px;">
              <el-icon style="color: #e6a23c;"><Star /></el-icon>
              {{ formatShortDate(row.expectedStartTime || row.startTime) }}
            </div>
            <div class="text-muted" style="font-size: 12px;">
              至 {{ formatShortDate(row.expectedEndTime || '不限') }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="实际开钓" width="180">
          <template #default="{ row }">
            <div v-if="row.actualStartTime" style="font-size: 12px; color: #67c23a;">
              <el-icon><CircleCheck /></el-icon>
              {{ formatShortDate(row.actualStartTime) }}
            </div>
            <span v-else class="text-muted" style="font-size: 12px;">未开钓</span>
          </template>
        </el-table-column>
        <el-table-column label="收竿时间" width="180">
          <template #default="{ row }">
            <div v-if="row.endTime" style="font-size: 12px;">
              {{ formatShortDate(row.endTime) }}
            </div>
            <span v-else class="text-muted" style="font-size: 12px;">垂钓中</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getOccStatusType(row)" size="small">
              {{ getOccStatusLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="档位/时长" width="160">
          <template #default="{ row }">
            <div v-if="row.status === 'active' || row.status === 'pending_bill'">
              <span class="text-primary">{{ getCurrentTier(row)?.name || '-' }}</span>
              <div class="text-muted">{{ getDuration(row) }}</div>
            </div>
            <div v-else-if="row.status === 'reserved'">
              <span class="text-muted">等待开钓</span>
              <div class="text-muted" v-if="row.expectedEndTime">
                预{{ getExpectedDuration(row) }}小时
              </div>
            </div>
            <span v-else class="text-muted">已结束</span>
          </template>
        </el-table-column>
        <el-table-column label="订金" width="100">
          <template #default="{ row }">
            <span v-if="row.deposit && row.deposit > 0" style="color: #e6a23c; font-weight: 600;">
              ¥{{ row.deposit.toFixed(2) }}
            </span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="临界提示" width="200">
          <template #default="{ row }">
            <el-alert
              v-if="row.status === 'active' && getBillingInfo(row).nextTierInfo"
              :title="`距下一档还剩 ${getBillingInfo(row).nextTierInfo.hoursToNext.toFixed(2)} 小时`"
              type="warning"
              size="small"
              :closable="false"
              show-icon
            />
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'reserved'">
              <el-button size="small" type="success" @click="handleCheckIn(row)">
                <el-icon><Right /></el-icon>
                到店开钓
              </el-button>
              <el-button size="small" @click="goToBilling(row, 'pending')">
                <el-icon><Tickets /></el-icon>
                去结算
              </el-button>
              <el-button size="small" @click="handleReschedule(row)">
                <el-icon><Edit /></el-icon>
                改期
              </el-button>
              <el-button size="small" type="danger" @click="handleCancel(row)">
                <el-icon><Close /></el-icon>
                取消
              </el-button>
            </template>
            <template v-else-if="row.status === 'active'">
              <el-button size="small" @click="goToBilling(row)">
                <el-icon><Tickets /></el-icon>
                去结算
              </el-button>
              <el-button size="small" @click="goToMerge(row)">
                <el-icon><Connection /></el-icon>
                拆分
              </el-button>
            </template>
            <template v-else-if="row.status === 'pending_bill'">
              <el-button size="small" type="primary" @click="goToBilling(row, 'pending')">
                <el-icon><Tickets /></el-icon>
                补录结算
              </el-button>
            </template>
            <template v-else-if="row.billingStatus === 'unbilled'">
              <el-button size="small" type="primary" @click="goToBilling(row)">
                生成账单
              </el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="reserveDialogVisible" title="预订钓位" width="620px">
      <el-form :model="reserveForm" label-width="110px">
        <el-form-item label="预订日期">
          <el-date-picker
            v-model="reserveForm.date"
            type="date"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            placeholder="选择预订日期"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-time-picker
            v-model="reserveForm.startTime"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="选择开始时间"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-time-picker
            v-model="reserveForm.endTime"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="选择结束时间（可选）"
            style="width: 100%;"
          />
          <div class="text-muted mt-8" style="font-size: 12px;">
            不填结束时间则按实际收竿时间计算
          </div>
        </el-form-item>
        <el-form-item label="立即开钓">
          <el-switch v-model="reserveForm.checkInNow" />
          <span class="text-muted ml-8" style="font-size: 12px;">勾选后直接开始计费（无需再点"到店开钓"）</span>
        </el-form-item>

        <el-form-item label="选择钓位">
          <div class="spot-picker">
            <div
              v-for="s in availableForBooking"
              :key="s.id"
              class="picker-spot"
              :class="{ 'picker-selected': reserveForm.spotIds.includes(s.id) }"
              @click="togglePickerSpot(s.id)"
            >
              <div class="ps-code">{{ s.code }}</div>
              <div class="ps-name">{{ s.name }}</div>
              <div class="ps-price">¥{{ s.basePrice }}/时</div>
            </div>
          </div>
          <div class="mt-8">
            <el-tag v-if="reserveForm.spotIds.length > 0 && isContinuous" type="success" effect="light">
              <el-icon><Check /></el-icon>
              已构成连续区段（{{ reserveForm.spotIds.length }}个钓位）
            </el-tag>
            <el-tag v-else-if="reserveForm.spotIds.length > 1" type="danger" effect="light">
              <el-icon><Warning /></el-icon>
              钓位不连续或跨区域，将拆分为多段
            </el-tag>
          </div>
        </el-form-item>

        <el-form-item label="钓友姓名">
          <el-input v-model="reserveForm.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="reserveForm.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="已收订金">
          <el-input-number
            v-model="reserveForm.deposit"
            :min="0"
            :precision="2"
            :step="10"
            placeholder="可选，结算时自动抵扣"
            style="width: 240px;"
          />
          <span class="text-muted ml-8" style="font-size: 12px;">元</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reserveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmReserve">确认预订</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rescheduleDialogVisible" title="改期" width="500px">
      <el-descriptions v-if="rescheduleRow" :column="1" border size="small" class="mb-16">
        <el-descriptions-item label="钓友">{{ rescheduleRow.anglerName }}</el-descriptions-item>
        <el-descriptions-item label="钓位">
          <el-tag
            v-for="sid in rescheduleRow.spotIds"
            :key="sid"
            type="primary"
            effect="light"
            size="small"
            style="margin-right: 4px;"
          >
            {{ spotStore.getSpotById(sid)?.code }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="原预订时间">
          {{ rescheduleRow.expectedStartTime || rescheduleRow.startTime }}
          <span v-if="rescheduleRow.expectedEndTime"> ~ {{ rescheduleRow.expectedEndTime }}</span>
        </el-descriptions-item>
      </el-descriptions>
      <el-form :model="rescheduleForm" label-width="100px">
        <el-form-item label="新日期">
          <el-date-picker
            v-model="rescheduleForm.date"
            type="date"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            placeholder="选择新日期"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="新开始时间">
          <el-time-picker
            v-model="rescheduleForm.startTime"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="选择开始时间"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="新结束时间">
          <el-time-picker
            v-model="rescheduleForm.endTime"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="选择结束时间（可选）"
            style="width: 100%;"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rescheduleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmReschedule">确认改期</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useSpotStore } from '@/stores/spot'
import { useOccupationStore, useAnglerStore, getEffectiveStartTime } from '@/stores/occupation'
import { usePricingStore } from '@/stores/pricing'
import type { FishingSpot, Occupation } from '@/types'
import { calcHours, formatDateTime, formatDate } from '@/utils'

const router = useRouter()
const spotStore = useSpotStore()
const occStore = useOccupationStore()
const anglerStore = useAnglerStore()
const pricingStore = usePricingStore()

const datePreset = ref<'today' | 'tomorrow' | 'custom'>('today')
const viewDate = ref(formatDate(new Date()))
const timeRange = ref<'all' | 'morning' | 'afternoon' | 'evening'>('all')
const searchKeyword = ref('')
const highlightOccId = ref('')

function onPresetChange(v: string) {
  if (v === 'today') viewDate.value = formatDate(new Date())
  else if (v === 'tomorrow') {
    const t = new Date()
    t.setDate(t.getDate() + 1)
    viewDate.value = formatDate(t)
  }
}

const viewDateLabel = computed(() => {
  const today = formatDate(new Date())
  const tmr = new Date(); tmr.setDate(tmr.getDate() + 1)
  const tomorrow = formatDate(tmr)
  if (viewDate.value === today) return '今日'
  if (viewDate.value === tomorrow) return '明日'
  return viewDate.value
})

function getTimeRangeStartEnd(): { start?: string; end?: string } {
  if (timeRange.value === 'all') return {}
  const d = viewDate.value
  if (timeRange.value === 'morning') return { start: `${d} 06:00:00`, end: `${d} 12:00:00` }
  if (timeRange.value === 'afternoon') return { start: `${d} 12:00:00`, end: `${d} 18:00:00` }
  if (timeRange.value === 'evening') return { start: `${d} 18:00:00`, end: `${d} 23:59:59` }
  return {}
}

const allOccsForDate = computed(() => occStore.getOccupationsForDate(viewDate.value))

const scheduledOccs = computed(() => {
  const { start, end } = getTimeRangeStartEnd()
  if (!start && !end) return allOccsForDate.value
  return allOccsForDate.value.filter(o => {
    const os = new Date(getEffectiveStartTime(o)).getTime()
    let oe: number
    if (o.expectedEndTime) {
      oe = new Date(o.expectedEndTime).getTime()
    } else if (o.endTime) {
      oe = new Date(o.endTime).getTime()
    } else if (o.status === 'reserved' || o.status === 'active') {
      oe = Infinity
    } else {
      oe = Date.now()
    }
    const cs = start ? new Date(start).getTime() : 0
    const ce = end ? new Date(end).getTime() : Infinity
    return os < ce && oe > cs
  })
})

const reservedCount = computed(() =>
  scheduledOccs.value.filter(o => o.status === 'reserved').length
)
const activeCount = computed(() =>
  scheduledOccs.value.filter(o => o.status === 'active').length
)

const reserveDialogVisible = ref(false)
const reserveForm = reactive({
  spotIds: [] as string[],
  name: '',
  phone: '',
  date: viewDate.value,
  startTime: '08:00',
  endTime: '',
  checkInNow: false,
  deposit: 0
})

const rescheduleDialogVisible = ref(false)
const rescheduleRow = ref<Occupation | null>(null)
const rescheduleForm = reactive({
  date: '',
  startTime: '08:00',
  endTime: ''
})

watch(viewDate, (v) => { reserveForm.date = v })
watch(datePreset, () => { reserveForm.date = viewDate.value })

const availableForBooking = computed(() =>
  spotStore.spots.filter(s => s.status === 'available')
)

const isContinuous = computed(() => {
  if (reserveForm.spotIds.length <= 1) return true
  return occStore.validateContinuousSegment(reserveForm.spotIds).valid
})

const availableCount = computed(() => {
  return spotStore.spots.filter(s => {
    if (s.status !== 'available') return false
    return !scheduledOccs.value.some(o =>
      o.spotIds.includes(s.id) && (o.status === 'reserved' || o.status === 'active')
    )
  }).length
})

const maintenanceCount = computed(() => spotStore.spots.filter(s => s.status === 'maintenance').length)

function getTypeLabel(type: FishingSpot['type']) {
  const map = { single: '单人位', double: '双人位', platform: 'VIP浮台' }
  return map[type]
}

function getSpotOccupations(spotId: string): Occupation[] {
  return scheduledOccs.value.filter(o => o.spotIds.includes(spotId))
}

function getSpotUpcomingOccs(spotId: string): Occupation[] {
  const now = Date.now()
  const endOfDay = new Date(viewDate.value + ' 23:59:59').getTime()
  return getSpotOccupations(spotId)
    .filter(o => {
      const s = new Date(getEffectiveStartTime(o)).getTime()
      return s <= endOfDay
    })
    .sort((a, b) => new Date(getEffectiveStartTime(a)).getTime() - new Date(getEffectiveStartTime(b)).getTime())
    .slice(0, 3)
}

function getSpotStatus(spotId: string): 'available' | 'active' | 'reserved' | 'maintenance' {
  const spot = spotStore.getSpotById(spotId)
  if (spot?.status === 'maintenance' || spot?.status === 'closed') return 'maintenance'

  const occs = getSpotOccupations(spotId)
  if (occs.length === 0) return 'available'

  const viewDateStart = new Date(viewDate.value + ' 00:00:00').getTime()
  const viewDateEnd = new Date(viewDate.value + ' 23:59:59').getTime()

  const active = occs.find(o => {
    if (o.status === 'active') {
      const s = new Date(getEffectiveStartTime(o)).getTime()
      const e = o.expectedEndTime ? new Date(o.expectedEndTime).getTime() : Infinity
      return s <= viewDateEnd && e >= viewDateStart
    }
    return false
  })
  if (active) return 'active'

  const reserved = occs.find(o => {
    if (o.status === 'reserved') {
      const s = new Date(getEffectiveStartTime(o)).getTime()
      const e = o.expectedEndTime ? new Date(o.expectedEndTime).getTime() : Infinity
      return s <= viewDateEnd && e >= viewDateStart
    }
    return false
  })
  if (reserved) return 'reserved'

  return 'available'
}

function getSpotClass(id: string) {
  const st = getSpotStatus(id)
  if (st === 'maintenance') return 'spot-maint-card'
  if (st === 'active') return 'spot-occupied'
  if (st === 'reserved') return 'spot-future'
  return 'spot-available'
}

function getSpotAngler(id: string) {
  const viewDateStart = new Date(viewDate.value + ' 00:00:00').getTime()
  const viewDateEnd = new Date(viewDate.value + ' 23:59:59').getTime()
  const occ = getSpotOccupations(id).find(o => {
    if (o.status === 'active' || o.status === 'reserved') {
      const s = new Date(getEffectiveStartTime(o)).getTime()
      const e = o.expectedEndTime ? new Date(o.expectedEndTime).getTime() : Infinity
      return s <= viewDateEnd && e >= viewDateStart
    }
    return false
  })
  return occ?.anglerName || '-'
}

function formatShortTime(s: string) {
  if (!s) return ''
  return s.split(' ')[1]?.substring(0, 5) || s.substring(5, 16)
}

function formatShortDate(s: string) {
  if (!s) return ''
  return s.substring(5, 16)
}

function getOccStatusType(occ: Occupation) {
  if (occ.status === 'reserved') return 'warning'
  if (occ.status === 'active') return 'success'
  if (occ.status === 'pending_bill') return 'warning'
  if (occ.status === 'completed') return 'info'
  if (occ.status === 'cancelled') return 'info'
  return 'info'
}

function getOccStatusLabel(occ: Occupation) {
  if (occ.status === 'reserved') return '已预约'
  if (occ.status === 'active') return '垂钓中'
  if (occ.status === 'pending_bill') return '待结算'
  if (occ.status === 'completed') return '已结束'
  if (occ.status === 'cancelled') return '已取消'
  if (occ.status === 'split') return '已拆分'
  return occ.status
}

function getDuration(occ: Occupation) {
  const start = getEffectiveStartTime(occ)
  const end = occ.endTime || formatDateTime(new Date())
  const h = calcHours(start, end)
  return `${h.toFixed(1)}小时`
}

function getExpectedDuration(occ: Occupation) {
  if (!occ.expectedEndTime || !occ.expectedStartTime) return 0
  return calcHours(occ.expectedStartTime, occ.expectedEndTime).toFixed(1)
}

function getBillingInfo(occ: Occupation) {
  const spot = spotStore.getSpotById(occ.spotId)
  const basePrice = spot ? spot.basePrice / 30 : 1
  const start = getEffectiveStartTime(occ)
  return pricingStore.calculateBilling(start, formatDateTime(new Date()), basePrice, occ.spotIds.length)
}

function getCurrentTier(occ: Occupation) {
  return getBillingInfo(occ).currentTier
}

function togglePickerSpot(id: string) {
  const idx = reserveForm.spotIds.indexOf(id)
  if (idx >= 0) {
    reserveForm.spotIds.splice(idx, 1)
  } else {
    reserveForm.spotIds.push(id)
    const spot = spotStore.getSpotById(id)
    if (spot && reserveForm.spotIds.length > 0) {
      const check = occStore.validateContinuousSegment(reserveForm.spotIds)
      if (!check.valid) {
        ElMessage.info(check.message + '（将拆分为多段独立预订）')
      }
    }
  }
}

function handleSpotClick(id: string) {
  const spot = spotStore.getSpotById(id)
  if (!spot) return
  if (spot.status !== 'available') {
    ElMessage.warning('该钓位维护中或已关闭')
    return
  }
  const status = getSpotStatus(id)
  if (status === 'active' || status === 'reserved') {
    const occs = getSpotOccupations(id)
    if (occs.length > 0) {
      const info = occs.map(o =>
        `${getOccStatusLabel(o)} · ${o.anglerName} ${formatShortTime(o.expectedStartTime || o.startTime)}~${formatShortTime(o.expectedEndTime || '进行中')}`
      ).join('\n')
      ElMessageBox.alert(
        `该钓位排期：\n${info}`,
        '钓位已预订/占用',
        { confirmButtonText: '知道了', type: 'info' }
      )
    }
    return
  }
  reserveForm.spotIds = [id]
  reserveForm.date = viewDate.value
  reserveForm.name = ''
  reserveForm.phone = ''
  reserveForm.checkInNow = false
  reserveDialogVisible.value = true
}

function confirmReserve() {
  if (reserveForm.spotIds.length === 0) {
    ElMessage.warning('请选择钓位')
    return
  }
  if (!reserveForm.name.trim()) {
    ElMessage.warning('请输入钓友姓名')
    return
  }
  if (!reserveForm.phone.trim()) {
    ElMessage.warning('请输入联系电话')
    return
  }
  if (!reserveForm.startTime) {
    ElMessage.warning('请选择开始时间')
    return
  }
  const expectedStart = `${reserveForm.date} ${reserveForm.startTime}:00`
  const expectedEnd = reserveForm.endTime ? `${reserveForm.date} ${reserveForm.endTime}:00` : undefined

  if (expectedEnd && new Date(expectedEnd).getTime() <= new Date(expectedStart).getTime()) {
    ElMessage.warning('结束时间必须晚于开始时间')
    return
  }

  try {
    const angler = anglerStore.findOrCreate(reserveForm.name.trim(), reserveForm.phone.trim())

    const segments = occStore.splitIntoContinuousSegments(reserveForm.spotIds)
    if (segments.length === 0) throw new Error('请选择有效的钓位')

    let created = 0
    for (const seg of segments) {
      occStore.createOccupation(seg, angler.id, angler.name, {
        expectedStartTime: expectedStart,
        expectedEndTime: expectedEnd,
        checkInImmediately: reserveForm.checkInNow,
        deposit: reserveForm.deposit || 0
      })
      created++
    }
    ElMessage.success(`预订成功！共 ${created} 段${reserveForm.checkInNow ? '已开钓' : '预约'}，涉及 ${reserveForm.spotIds.length} 个钓位${reserveForm.deposit ? `，已收订金 ¥${reserveForm.deposit.toFixed(2)}` : ''}`)
    reserveDialogVisible.value = false
    reserveForm.spotIds = []
    reserveForm.deposit = 0
  } catch (e: any) {
    ElMessage.error(e.message || '预订失败')
  }
}

function handleCheckIn(row: Occupation) {
  ElMessageBox.confirm(
    `确定 ${row.anglerName} 已到店，开始垂钓吗？\n开钓后将开始计费。`,
    '到店确认',
    { confirmButtonText: '确认开钓', cancelButtonText: '取消', type: 'success' }
  ).then(() => {
    try {
      occStore.checkIn(row.id)
      ElMessage.success('已开钓，开始计费')
    } catch (e: any) {
      ElMessage.error(e.message)
    }
  }).catch(() => {})
}

function handleReschedule(row: Occupation) {
  rescheduleRow.value = row
  const dt = (row.expectedStartTime || row.startTime).split(' ')
  rescheduleForm.date = dt[0]
  rescheduleForm.startTime = dt[1]?.substring(0, 5) || '08:00'
  rescheduleForm.endTime = row.expectedEndTime ? row.expectedEndTime.split(' ')[1].substring(0, 5) : ''
  rescheduleDialogVisible.value = true
}

function confirmReschedule() {
  if (!rescheduleRow.value) return
  if (!rescheduleForm.date || !rescheduleForm.startTime) {
    ElMessage.warning('请选择日期和时间')
    return
  }
  const newStart = `${rescheduleForm.date} ${rescheduleForm.startTime}:00`
  const newEnd = rescheduleForm.endTime ? `${rescheduleForm.date} ${rescheduleForm.endTime}:00` : undefined

  if (newEnd && new Date(newEnd).getTime() <= new Date(newStart).getTime()) {
    ElMessage.warning('结束时间必须晚于开始时间')
    return
  }

  try {
    occStore.reschedule(rescheduleRow.value.id, newStart, newEnd)
    ElMessage.success('改期成功')
    rescheduleDialogVisible.value = false
    rescheduleRow.value = null
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

function handleCancel(row: Occupation) {
  ElMessageBox.confirm(
    `确定取消 ${row.anglerName} 的预约吗？\n取消后钓位将重新开放。`,
    '取消确认',
    { confirmButtonText: '确认取消', cancelButtonText: '保留', type: 'warning' }
  ).then(() => {
    try {
      occStore.cancelReservation(row.id)
      ElMessage.success('已取消预约，钓位已释放')
    } catch (e: any) {
      ElMessage.error(e.message)
    }
  }).catch(() => {})
}

function goToBilling(row: Occupation, tab: string = 'active') {
  router.push({ path: '/billing', query: { occId: row.id, tab } })
}

function goToMerge(row: Occupation) {
  router.push({ path: '/merge', query: { occId: row.id } })
}

const occTableRef = ref<any>(null)

function getOccRowClassName({ row }: { row: Occupation }) {
  if (row.id === highlightOccId.value) return 'occ-highlight-row'
  return ''
}

function handleSearch() {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) {
    ElMessage.warning('请输入姓名或手机号')
    return
  }

  const matched = occStore.occupations.filter(o => {
    if (o.status === 'cancelled' || o.status === 'split') return false
    return o.anglerName.toLowerCase().includes(kw) || o.anglerId.includes(kw)
  })

  const anglerMatched = anglerStore.anglers.filter(a =>
    a.name.toLowerCase().includes(kw) || a.phone.includes(kw)
  )
  const anglerIds = new Set(anglerMatched.map(a => a.id))
  const byAngler = occStore.occupations.filter(o => {
    if (o.status === 'cancelled' || o.status === 'split') return false
    return anglerIds.has(o.anglerId)
  })

  const all = [...new Map([...matched, ...byAngler].map(o => [o.id, o])).values()]
    .sort((a, b) => new Date(getEffectiveStartTime(b)).getTime() - new Date(getEffectiveStartTime(a)).getTime())

  if (all.length === 0) {
    ElMessage.warning(`没有找到 "${kw}" 的预约记录`)
    return
  }

  if (all.length === 1) {
    jumpToOcc(all[0])
    return
  }

  const options = all.map((o, i) => {
    const date = getEffectiveStartTime(o).substring(0, 10)
    const codes = o.spotIds.map(sid => spotStore.getSpotById(sid)?.code || '?').join(',')
    return `[${i + 1}] ${o.anglerName} · ${date} · ${codes} · ${getOccStatusLabel(o)}`
  })

  ElMessageBox.prompt(
    `找到 ${all.length} 条相关预约：\n\n${options.join('\n')}\n\n请输入序号跳转（1-${all.length}）`,
    `搜索结果：${kw}`,
    {
      confirmButtonText: '跳转',
      cancelButtonText: '取消',
      inputValue: '1',
      inputValidator: (v: string) => {
        const n = parseInt(v)
        if (!isNaN(n) && n >= 1 && n <= all.length) return true
        return `请输入 1 到 ${all.length} 之间的数字`
      }
    }
  ).then(({ value }) => {
    const n = parseInt(value)
    jumpToOcc(all[n - 1])
  }).catch(() => {})
}

function jumpToOcc(occ: Occupation) {
  const dateStr = getEffectiveStartTime(occ).substring(0, 10)
  datePreset.value = 'custom'
  viewDate.value = dateStr
  timeRange.value = 'all'

  nextTick(() => {
    highlightOccId.value = occ.id
    setTimeout(() => {
      highlightOccId.value = ''
    }, 5000)
    if (occTableRef.value) {
      const idx = scheduledOccs.value.findIndex(o => o.id === occ.id)
      if (idx >= 0 && occTableRef.value.scrollTo) {
        occTableRef.value.scrollTo({ top: idx * 50 })
      }
    }
    ElMessage.success(`已跳转到 ${dateStr}，定位 ${occ.anglerName} 的记录`)
  })
}
</script>

<style scoped>
.time-filter-bar {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 10px 14px;
}

.area-section {
  margin-bottom: 24px;
}

.area-title {
  font-size: 14px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.spots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 14px;
}

.spot-card {
  border: 2px solid #e4e7ed;
  border-radius: 10px;
  padding: 14px 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fafafa;
  user-select: none;
  position: relative;
}

.spot-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.spot-available {
  border-color: #67c23a;
  background: linear-gradient(135deg, #f0f9eb 0%, #ffffff 100%);
}

.spot-occupied {
  border-color: #f56c6c;
  background: linear-gradient(135deg, #fef0f0 0%, #ffffff 100%);
}

.spot-future {
  border-color: #e6a23c;
  background: linear-gradient(135deg, #fdf6ec 0%, #ffffff 100%);
}

.spot-maint-card {
  border-color: #909399;
  background: linear-gradient(135deg, #f4f4f5 0%, #ffffff 100%);
  cursor: not-allowed;
  opacity: 0.7;
}

.spot-code {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.spot-name {
  font-size: 12px;
  color: #606266;
  margin-top: 2px;
}

.spot-type {
  display: inline-block;
  font-size: 11px;
  color: #909399;
  margin-top: 3px;
  padding: 1px 8px;
  background: #f4f4f5;
  border-radius: 4px;
}

.spot-angler {
  margin-top: 8px;
  font-size: 13px;
  color: #f56c6c;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.spot-reserved {
  margin-top: 8px;
  font-size: 13px;
  color: #e6a23c;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.spot-maint {
  margin-top: 8px;
  font-size: 13px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 4px;
}

.spot-price {
  margin-top: 8px;
  font-size: 14px;
  color: #67c23a;
  font-weight: 600;
}

.spot-timeline {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed #e4e7ed;
  max-height: 110px;
  overflow-y: auto;
}

.timeline-title {
  font-size: 11px;
  color: #909399;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 3px;
  font-weight: 500;
}

.timeline-item {
  font-size: 11px;
  color: #606266;
  padding: 3px 6px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 3px;
  display: flex;
  align-items: center;
  gap: 5px;
  line-height: 1.4;
  flex-wrap: wrap;
}

.tl-time {
  font-family: 'Courier New', monospace;
  color: #409eff;
  font-weight: 600;
  font-size: 10px;
  flex-shrink: 0;
}

.tl-tag {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 700;
  flex-shrink: 0;
}

.tl-tag-warn {
  background: #fdf6ec;
  color: #e6a23c;
  border: 1px solid #faecd8;
}

.tl-tag-active {
  background: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fde2e2;
}

.tl-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}

.tl-deposit {
  font-size: 10px;
  color: #e6a23c;
  font-weight: 600;
  flex-shrink: 0;
}

.tl-reserved {
  background: #fdf6ec;
  color: #e6a23c;
}

.tl-active {
  background: #f0f9eb;
  color: #67c23a;
}

.spot-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
}

.picker-spot {
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  padding: 10px 8px;
  text-align: center;
  cursor: pointer;
  background: #fff;
  transition: all 0.15s;
  user-select: none;
}

.picker-spot:hover {
  border-color: #409eff;
}

.picker-selected {
  border-color: #409eff !important;
  background: #ecf5ff;
}

.ps-code {
  font-size: 15px;
  font-weight: 700;
  color: #303133;
}

.ps-name {
  font-size: 11px;
  color: #606266;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ps-price {
  font-size: 12px;
  color: #67c23a;
  margin-top: 2px;
}

.ml-8 {
  margin-left: 8px;
}

:deep(.occ-highlight-row) {
  background-color: #fdf6ec !important;
}

:deep(.occ-highlight-row td) {
  background-color: #fdf6ec !important;
  animation: occHighlightPulse 2s ease-in-out infinite;
}

@keyframes occHighlightPulse {
  0%, 100% { background-color: #fdf6ec; }
  50% { background-color: #faecd8; }
}
</style>
