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
          <el-tag type="danger" effect="light">占用 {{ occupiedCount }}</el-tag>
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
            <div v-if="getSpotStatus(spot.id) === 'occupied'" class="spot-angler">
              <el-icon><User /></el-icon>
              {{ getSpotAngler(spot.id) }}
            </div>
            <div v-else-if="getSpotStatus(spot.id) === 'future'" class="spot-booked">
              <el-icon><Clock /></el-icon>
              已预订
            </div>
            <div v-else-if="spot.status === 'maintenance'" class="spot-maint">
              <el-icon><Tools /></el-icon>
              维护中
            </div>
            <div v-else class="spot-price">
              ¥{{ spot.basePrice }}/时起
            </div>
            <div v-if="getSpotOccupations(spot.id).length > 0" class="spot-timeline">
              <div
                v-for="occ in getSpotOccupations(spot.id)"
                :key="occ.id"
                class="timeline-item"
                :title="`${occ.anglerName} ${formatShortTime(occ.expectedStartTime || occ.startTime)} ~ ${formatShortTime(occ.expectedEndTime || '正在垂钓')}`"
              >
                {{ occ.anglerName }}
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
      <el-table :data="scheduledOccs" stripe style="width: 100%">
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
          </template>
        </el-table-column>
        <el-table-column label="预订时段" width="340">
          <template #default="{ row }">
            <div>
              <el-icon><Star /></el-icon>
              {{ row.expectedStartTime || row.startTime }}
            </div>
            <div v-if="row.expectedEndTime || row.endTime" class="text-muted">
              至 {{ row.expectedEndTime || row.endTime }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getOccStatusType(row)" size="small">
              {{ getOccStatusLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="档位/时长" width="180">
          <template #default="{ row }">
            <div v-if="row.status === 'active' || row.status === 'pending_bill'">
              <span class="text-primary">{{ getCurrentTier(row)?.name || '-' }}</span>
              <div class="text-muted">{{ getDuration(row) }}</div>
            </div>
            <span v-else class="text-muted">已结束</span>
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
      </el-table>
    </div>

    <el-dialog v-model="reserveDialogVisible" title="预订钓位" width="600px">
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
      </el-form>
      <template #footer>
        <el-button @click="reserveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmReserve">确认预订</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSpotStore } from '@/stores/spot'
import { useOccupationStore, useAnglerStore } from '@/stores/occupation'
import { usePricingStore } from '@/stores/pricing'
import type { FishingSpot, Occupation } from '@/types'
import { calcHours, formatDateTime, formatDate } from '@/utils'

const spotStore = useSpotStore()
const occStore = useOccupationStore()
const anglerStore = useAnglerStore()
const pricingStore = usePricingStore()

const datePreset = ref<'today' | 'tomorrow' | 'custom'>('today')
const viewDate = ref(formatDate(new Date()))
const timeRange = ref<'all' | 'morning' | 'afternoon' | 'evening'>('all')

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
    const os = new Date(o.expectedStartTime || o.startTime).getTime()
    const oe = o.expectedEndTime ? new Date(o.expectedEndTime).getTime()
      : o.endTime ? new Date(o.endTime).getTime()
      : Date.now()
    const cs = start ? new Date(start).getTime() : 0
    const ce = end ? new Date(end).getTime() : Infinity
    return os < ce && oe > cs
  })
})

const reserveDialogVisible = ref(false)
const reserveForm = reactive({
  spotIds: [] as string[],
  name: '',
  phone: '',
  date: viewDate.value,
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
  const { start, end } = getTimeRangeStartEnd()
  const checkAt = start || `${viewDate.value} 12:00:00`
  return spotStore.spots.filter(s => {
    if (s.status !== 'available') return false
    return !scheduledOccs.value.some(o => o.spotIds.includes(s.id))
  }).length
})

const occupiedCount = computed(() => scheduledOccs.value.length)
const maintenanceCount = computed(() => spotStore.spots.filter(s => s.status === 'maintenance').length)

function getTypeLabel(type: FishingSpot['type']) {
  const map = { single: '单人位', double: '双人位', platform: 'VIP浮台' }
  return map[type]
}

function getSpotOccupations(spotId: string): Occupation[] {
  return scheduledOccs.value.filter(o => o.spotIds.includes(spotId))
}

function getSpotStatus(spotId: string): 'available' | 'occupied' | 'future' | 'maintenance' {
  const spot = spotStore.getSpotById(spotId)
  if (spot?.status === 'maintenance' || spot?.status === 'closed') return 'maintenance'

  const now = Date.now()
  const occs = getSpotOccupations(spotId)
  if (occs.length === 0) return 'available'

  const active = occs.find(o => {
    const s = new Date(o.expectedStartTime || o.startTime).getTime()
    const e = o.expectedEndTime ? new Date(o.expectedEndTime).getTime() : Infinity
    return now >= s && now < e
  })
  if (active) return 'occupied'
  return 'future'
}

function getSpotClass(id: string) {
  const st = getSpotStatus(id)
  if (st === 'maintenance') return 'spot-maint-card'
  if (st === 'occupied') return 'spot-occupied'
  if (st === 'future') return 'spot-future'
  return 'spot-available'
}

function getSpotAngler(id: string) {
  const now = Date.now()
  const occ = getSpotOccupations(id).find(o => {
    const s = new Date(o.expectedStartTime || o.startTime).getTime()
    const e = o.expectedEndTime ? new Date(o.expectedEndTime).getTime() : Infinity
    return now >= s && now < e
  })
  return occ?.anglerName || '-'
}

function formatShortTime(s: string) {
  if (!s) return ''
  return s.split(' ')[1]?.substring(0, 5) || s.substring(5, 16)
}

function getOccStatusType(occ: Occupation) {
  if (occ.status === 'active') return 'success'
  if (occ.status === 'pending_bill') return 'warning'
  if (occ.status === 'completed') return 'info'
  return 'info'
}

function getOccStatusLabel(occ: Occupation) {
  if (occ.status === 'active') return '垂钓中'
  if (occ.status === 'pending_bill') return '待结算'
  if (occ.status === 'completed') return '已结束'
  return occ.status
}

function getDuration(occ: Occupation) {
  const h = calcHours(occ.startTime, formatDateTime(new Date()))
  return `${h.toFixed(1)}小时`
}

function getBillingInfo(occ: Occupation) {
  const spot = spotStore.getSpotById(occ.spotId)
  const basePrice = spot ? spot.basePrice / 30 : 1
  return pricingStore.calculateBilling(occ.startTime, formatDateTime(new Date()), basePrice, occ.spotIds.length)
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
  if (status === 'occupied' || status === 'future') {
    const occs = getSpotOccupations(id)
    if (occs.length > 0) {
      const info = occs.map(o =>
        `${o.anglerName} ${formatShortTime(o.expectedStartTime || o.startTime)}~${formatShortTime(o.expectedEndTime || '进行中')}`
      ).join('\n')
      ElMessageBox.alert(
        `该钓位排期：\n${info}`,
        '钓位已占用/预订',
        { confirmButtonText: '知道了', type: 'info' }
      )
    }
    return
  }
  reserveForm.spotIds = [id]
  reserveForm.date = viewDate.value
  reserveForm.name = ''
  reserveForm.phone = ''
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
        expectedEndTime: expectedEnd
      })
      created++
    }
    ElMessage.success(`预订成功！共 ${created} 段占用，涉及 ${reserveForm.spotIds.length} 个钓位`)
    reserveDialogVisible.value = false
    reserveForm.spotIds = []
  } catch (e: any) {
    ElMessage.error(e.message || '预订失败')
  }
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

.spot-booked {
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
  margin-top: 6px;
  max-height: 40px;
  overflow: hidden;
}

.timeline-item {
  font-size: 10px;
  color: #909399;
  padding: 1px 4px;
  background: #f5f7fa;
  border-radius: 3px;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
</style>
