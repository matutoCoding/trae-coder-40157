<template>
  <div class="page-container">
    <div class="card">
      <div class="section-title">
        <el-icon><Connection /></el-icon>
        连续时段合并占用（连订）
      </div>
      <p class="text-muted mb-12" style="font-size: 13px;">
        选择同一钓友的相邻空闲钓位，系统将自动按连续区段合并预订。支持一整段连续钓位（如 A01~A04），不相邻的钓位会拆分为多个独立占用。
      </p>

      <el-form :model="mergeForm" label-width="100px" inline class="mb-12">
        <el-form-item label="钓友姓名">
          <el-input v-model="mergeForm.name" placeholder="姓名" style="width: 160px;" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="mergeForm.phone" placeholder="手机号" style="width: 160px;" />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker
            v-model="mergeForm.startTime"
            type="datetime"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择开始时间"
            style="width: 220px;"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker
            v-model="mergeForm.endTime"
            type="datetime"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择结束时间（可选）"
            style="width: 220px;"
          />
        </el-form-item>
        <el-form-item label="立即开钓">
          <el-switch v-model="mergeForm.checkInNow" />
          <span class="text-muted ml-8" style="font-size: 12px;">勾选后直接开始计费</span>
        </el-form-item>
        <el-form-item label="已收订金">
          <el-input-number
            v-model="mergeForm.deposit"
            :min="0"
            :precision="2"
            :step="10"
            placeholder="可选，结算时自动抵扣"
            style="width: 220px;"
          />
          <span class="text-muted ml-8" style="font-size: 12px;">元</span>
        </el-form-item>
      </el-form>

      <div class="merge-area">
        <div v-for="(spots, area) in spotStore.groupedByArea" :key="area" class="merge-area-section">
          <div class="area-label">{{ area }}</div>
          <div class="merge-spots-row">
            <div
              v-for="spot in spots"
              :key="spot.id"
              class="merge-spot"
              :class="getMergeSpotClass(spot.id)"
              @click="toggleMergeSpot(spot.id)"
            >
              <div class="ms-code">{{ spot.code }}</div>
              <div class="ms-name">{{ spot.name }}</div>
              <div class="ms-status">
                <span v-if="occStore.isSpotOccupied(spot.id)" class="text-danger">
                  {{ occStore.getSpotOccupation(spot.id)?.anglerName }}
                </span>
                <span v-else-if="spot.status === 'maintenance'" class="text-muted">维护中</span>
                <span v-else class="text-success">空闲</span>
              </div>
              <div v-if="mergeForm.selectedIds.includes(spot.id)" class="ms-check">
                <el-icon><Check /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-16">
        <div class="preview-section mb-12">
          <div class="section-title" style="font-size: 14px; margin-bottom: 8px;">
            <el-icon><MagicStick /></el-icon>
            预订预览
          </div>
          <div v-if="mergeForm.selectedIds.length === 0" class="text-muted">
            请点击上方钓位进行选择
          </div>
          <div v-else>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="选中钓位总数">
                {{ mergeForm.selectedIds.length }} 个
              </el-descriptions-item>
              <el-descriptions-item label="预计占用段数">
                <el-tag type="primary">{{ previewSegments.length }} 段</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="占用区段" :span="2">
                <div class="segments-preview">
                  <el-tag
                    v-for="(seg, idx) in previewSegments"
                    :key="idx"
                    type="success"
                    effect="light"
                    style="margin-right: 6px; margin-bottom: 4px;"
                  >
                    {{ seg.label }}
                    <span v-if="seg.length > 1" class="text-muted">(合并)</span>
                  </el-tag>
                </div>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </div>

        <div class="flex-between">
          <div>
            <span class="text-muted">已选钓位：</span>
            <el-tag
              v-for="id in mergeForm.selectedIds"
              :key="id"
              type="primary"
              closable
              style="margin-right: 6px;"
              @close="toggleMergeSpot(id)"
            >
              {{ spotStore.getSpotById(id)?.code }}
            </el-tag>
            <span v-if="mergeForm.selectedIds.length === 0" class="text-muted">请点击选择钓位</span>
          </div>
          <div class="flex-center" style="gap: 8px;">
            <el-button @click="clearSelection">清空选择</el-button>
            <el-button type="primary" :disabled="mergeForm.selectedIds.length < 1" @click="confirmMergeCreate">
              <el-icon><Link /></el-icon>
              确认预订（{{ previewSegments.length }}段 / {{ mergeForm.selectedIds.length }}个钓位）
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-16">
      <div class="section-title">
        <el-icon><Scissor /></el-icon>
        占用区间拆分（中途收竿）
      </div>
      <p class="text-muted mb-12" style="font-size: 13px;">
        点击合并占用中的某个钓位可选中，拆分后：选中的钓位立即进入待结算，剩余部分按连续性自动拆成多个独立占用段。
      </p>

      <el-table :data="mergedOccupations" stripe style="width: 100%">
        <el-table-column prop="anglerName" label="钓友" width="110" />
        <el-table-column label="占用钓位" min-width="260">
          <template #default="{ row }">
            <div class="occ-spots-bar">
              <div
                v-for="sid in row.spotIds"
                :key="sid"
                class="occ-spot-chip"
                :class="{ 
                  'chip-main': selectedSplitRow?.id === row.id && selectedSplitSpot === sid,
                  'chip-disabled': row.status !== 'active'
                }"
                @click="row.status === 'active' && selectSplitSpot(row, sid)"
              >
                <span>{{ spotStore.getSpotById(sid)?.code }}</span>
                <el-icon v-if="selectedSplitRow?.id === row.id && selectedSplitSpot === sid">
                  <Pointer />
                </el-icon>
              </div>
            </div>
            <div class="text-muted mt-4" style="font-size: 12px;">
              <el-tag v-if="row.status === 'reserved'" type="warning" size="small">已预约</el-tag>
              <el-tag v-else type="success" size="small">垂钓中</el-tag>
              已连续合并为 {{ row.spotIds.length }} 个相邻钓位
              <span v-if="row.status === 'active'">，点击选择要拆分收竿的钓位</span>
              <span v-else>，到店后可开钓</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="预约时间" width="170">
          <template #default="{ row }">
            <div style="font-size: 12px;">{{ formatShort(row.expectedStartTime || row.startTime) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="实际开钓" width="170">
          <template #default="{ row }">
            <div v-if="row.actualStartTime" style="font-size: 12px; color: #67c23a;">
              {{ formatShort(row.actualStartTime) }}
            </div>
            <span v-else class="text-muted" style="font-size: 12px;">未开钓</span>
          </template>
        </el-table-column>
        <el-table-column label="时长/档位" width="160">
          <template #default="{ row }">
            <div v-if="row.status === 'active'">
              <span class="text-primary">{{ getCurrentTier(row)?.name || '-' }}</span>
              <div class="text-muted">{{ getDuration(row) }}</div>
            </div>
            <div v-else-if="row.status === 'reserved'">
              <span class="text-muted">等待开钓</span>
              <div class="text-muted" v-if="row.expectedEndTime">
                预{{ getExpectedDuration(row) }}h
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="340" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'reserved'">
              <el-button size="small" type="success" @click="handleCheckIn(row)">
                <el-icon><Right /></el-icon>
                到店开钓
              </el-button>
              <el-button size="small" @click="goToSchedule(row)">
                <el-icon><Calendar /></el-icon>
                改期
              </el-button>
            </template>
            <template v-else>
              <el-button
                size="small"
                type="warning"
                :disabled="!canSplit(row)"
                @click="splitSelected(row)"
              >
                <el-icon><Scissor /></el-icon>
                拆分选中收竿
              </el-button>
              <el-button
                size="small"
                type="primary"
                @click="goToBill(row)"
              >
                <el-icon><Tickets /></el-icon>
                整段收竿
              </el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="mergedOccupations.length === 0" class="empty-tip">
        <el-empty description="当前没有合并占用的记录" />
      </div>
    </div>

    <div class="card mt-16">
      <div class="section-title">
        <el-icon><Timer /></el-icon>
        所有占用记录（含已预约和进行中）
      </div>
      <el-table :data="allOccupations" stripe style="width: 100%">
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
            <el-tag v-if="row.isMerged" type="warning" size="small">已合并</el-tag>
            <el-tag v-if="row.splitFromId" type="info" size="small">拆分后</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getOccStatusType(row)" size="small">
              {{ getOccStatusLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="预约时间" width="160">
          <template #default="{ row }">
            <span style="font-size: 12px;">{{ formatShort(row.expectedStartTime || row.startTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="实际开钓" width="160">
          <template #default="{ row }">
            <span v-if="row.actualStartTime" style="font-size: 12px; color: #67c23a;">
              {{ formatShort(row.actualStartTime) }}
            </span>
            <span v-else class="text-muted" style="font-size: 12px;">未开钓</span>
          </template>
        </el-table-column>
        <el-table-column label="垂钓时长" width="110">
          <template #default="{ row }">{{ getDuration(row) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'reserved'" size="small" type="success" @click="handleCheckIn(row)">
              到店开钓
            </el-button>
            <el-button v-else-if="row.status === 'active'" size="small" type="primary" @click="goToBill(row)">
              收竿结算
            </el-button>
            <el-button v-else-if="row.status === 'pending_bill'" size="small" type="primary" @click="goToBill(row, 'pending')">
              补录结算
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, h } from 'vue'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { useRouter } from 'vue-router'
import { useSpotStore } from '@/stores/spot'
import { useOccupationStore, useAnglerStore, getEffectiveStartTime } from '@/stores/occupation'
import { usePricingStore } from '@/stores/pricing'
import type { Occupation } from '@/types'
import { calcHours, formatDateTime } from '@/utils'

const spotStore = useSpotStore()
const occStore = useOccupationStore()
const anglerStore = useAnglerStore()
const pricingStore = usePricingStore()
const router = useRouter()

const now = formatDateTime(new Date())
const mergeForm = reactive({
  selectedIds: [] as string[],
  name: '',
  phone: '',
  startTime: now,
  endTime: '',
  checkInNow: false,
  deposit: 0
})

const selectedSplitRow = ref<Occupation | null>(null)
const selectedSplitSpot = ref<string>('')

const mergedOccupations = computed(() =>
  occStore.occupations.filter(o => 
    (o.status === 'active' || o.status === 'reserved') && 
    o.isMerged && o.spotIds.length > 1
  )
)

const allOccupations = computed(() =>
  occStore.occupations.filter(o => 
    o.status === 'active' || o.status === 'reserved' || o.status === 'pending_bill'
  )
)

const previewSegments = computed(() => {
  const segs = occStore.splitIntoContinuousSegments(mergeForm.selectedIds)
  return segs.map(ids => {
    const codes = ids.map(id => spotStore.getSpotById(id)?.code || '').filter(Boolean)
    const label = codes.length === 1
      ? codes[0]
      : `${codes[0]}~${codes[codes.length - 1]}`
    return { ids, label, length: ids.length }
  })
})

function getMergeSpotClass(id: string) {
  const classes: string[] = []
  const spot = spotStore.getSpotById(id)
  if (spot?.status === 'maintenance') classes.push('spot-disabled')
  else if (occStore.isSpotOccupied(id)) classes.push('spot-occupied-card')
  else classes.push('spot-idle')

  if (mergeForm.selectedIds.includes(id)) classes.push('spot-selected')
  return classes.join(' ')
}

function toggleMergeSpot(id: string) {
  const spot = spotStore.getSpotById(id)
  if (!spot || spot.status === 'maintenance') {
    ElMessage.warning('该钓位维护中，不可选')
    return
  }
  if (occStore.isSpotOccupied(id)) {
    ElMessage.warning('该钓位当前已被占用')
    return
  }
  const idx = mergeForm.selectedIds.indexOf(id)
  if (idx >= 0) {
    mergeForm.selectedIds.splice(idx, 1)
  } else {
    mergeForm.selectedIds.push(id)
  }
}

function clearSelection() {
  mergeForm.selectedIds = []
}

function confirmMergeCreate() {
  if (!mergeForm.name.trim() || !mergeForm.phone.trim()) {
    ElMessage.warning('请输入钓友姓名和电话')
    return
  }
  if (mergeForm.selectedIds.length === 0) {
    ElMessage.warning('请选择钓位')
    return
  }
  if (!mergeForm.startTime) {
    ElMessage.warning('请选择开始时间')
    return
  }
  if (mergeForm.endTime && new Date(mergeForm.endTime).getTime() <= new Date(mergeForm.startTime).getTime()) {
    ElMessage.warning('结束时间必须晚于开始时间')
    return
  }
  try {
    const angler = anglerStore.findOrCreate(mergeForm.name.trim(), mergeForm.phone.trim())
    const segs = occStore.splitIntoContinuousSegments(mergeForm.selectedIds)
    let created = 0
    for (const seg of segs) {
      occStore.createOccupation(seg, angler.id, angler.name, {
        expectedStartTime: mergeForm.startTime,
        expectedEndTime: mergeForm.endTime || undefined,
        checkInImmediately: mergeForm.checkInNow,
        deposit: mergeForm.deposit || 0
      })
      created++
    }
    ElMessage.success(`预订成功！共生成 ${created} 段${mergeForm.checkInNow ? '已开钓' : '预约'}，涉及 ${mergeForm.selectedIds.length} 个钓位${mergeForm.deposit ? `，已收订金 ¥${mergeForm.deposit.toFixed(2)}` : ''}`)
    mergeForm.selectedIds = []
    mergeForm.checkInNow = false
    mergeForm.deposit = 0
    selectedSplitRow.value = null
    selectedSplitSpot.value = ''
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

function selectSplitSpot(row: Occupation, sid: string) {
  if (selectedSplitRow.value?.id === row.id && selectedSplitSpot.value === sid) {
    selectedSplitRow.value = null
    selectedSplitSpot.value = ''
  } else {
    selectedSplitRow.value = row
    selectedSplitSpot.value = sid
  }
}

function canSplit(row: Occupation): boolean {
  return row.id === selectedSplitRow.value?.id && !!selectedSplitSpot.value && row.spotIds.includes(selectedSplitSpot.value)
}

function splitSelected(row: Occupation) {
  if (!selectedSplitSpot.value) {
    ElMessage.info('请先点击上方钓位选择要拆分收竿的位置')
    return
  }
  const spotCode = spotStore.getSpotById(selectedSplitSpot.value)?.code || ''
  const remainingIds = row.spotIds.filter(id => id !== selectedSplitSpot.value)
  const remainingSegs = occStore.splitIntoContinuousSegments(remainingIds)

  let msg = `确定将钓位 ${spotCode} 拆分收竿吗？\n\n`
  msg += `• 钓位 ${spotCode} 将立即进入待结算状态\n`
  if (remainingSegs.length === 0) {
    msg += `• 剩余无钓位`
  } else if (remainingSegs.length === 1) {
    const codes = remainingSegs[0].map(id => spotStore.getSpotById(id)?.code || '').join('、')
    msg += `• 剩余钓位 ${codes} 合并继续占用`
  } else {
    remainingSegs.forEach((seg, i) => {
      const codes = seg.map(id => spotStore.getSpotById(id)?.code || '').join('~')
      msg += `• 剩余第${i + 1}段：${codes} 独立占用\n`
    })
  }

  ElMessageBox.confirm(msg, '拆分确认', {
    confirmButtonText: '确认拆分',
    cancelButtonText: '取消',
    type: 'warning',
    dangerouslyUseHTMLString: false
  }).then(() => {
    try {
      const { removed, remaining } = occStore.splitSpotOff(row.id, selectedSplitSpot.value)
      const remInfo = remaining.length > 0
        ? `，剩余 ${remaining.length} 段独立占用`
        : ''
      selectedSplitRow.value = null
      selectedSplitSpot.value = ''
      const removedOcc = removed as Occupation
      ElNotification({
        title: '拆分成功',
        message: `钓位 ${spotCode} 已进入待结算${remInfo}`,
        type: 'success',
        duration: 5000,
        offset: 60,
        onClick: () => {
          goToBill(removedOcc)
        },
        action: h(
          'button',
          {
            class: 'el-button el-button--primary el-button--small',
            onClick: (e: Event) => {
              e.stopPropagation()
              goToBill(removedOcc)
            }
          },
          '去结算'
        )
      })
    } catch (e: any) {
      ElMessage.error(e.message)
    }
  }).catch(() => {})
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

function getCurrentTier(occ: Occupation) {
  const spot = spotStore.getSpotById(occ.spotId)
  const basePrice = spot ? spot.basePrice / 30 : 1
  const start = getEffectiveStartTime(occ)
  const info = pricingStore.calculateBilling(start, formatDateTime(new Date()), basePrice, occ.spotIds.length)
  return info.currentTier
}

function formatShort(s: string) {
  if (!s) return ''
  return s.substring(5, 16)
}

function getOccStatusType(occ: Occupation) {
  if (occ.status === 'reserved') return 'warning'
  if (occ.status === 'active') return 'success'
  if (occ.status === 'pending_bill') return 'warning'
  return 'info'
}

function getOccStatusLabel(occ: Occupation) {
  if (occ.status === 'reserved') return '已预约'
  if (occ.status === 'active') return '垂钓中'
  if (occ.status === 'pending_bill') return '待结算'
  if (occ.status === 'completed') return '已结束'
  return occ.status
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

function goToSchedule(row: Occupation) {
  router.push({ path: '/schedule', query: { occId: row.id } })
}

function goToBill(row: Occupation, tab: string = 'active') {
  router.push({ path: '/billing', query: { occId: row.id, tab } })
}
</script>

<style scoped>
.merge-area {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
}

.merge-area-section {
  margin-bottom: 14px;
}

.merge-area-section:last-child {
  margin-bottom: 0;
}

.area-label {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 8px;
}

.merge-spots-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.merge-spot {
  width: 120px;
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px 10px;
  cursor: pointer;
  position: relative;
  background: #fff;
  transition: all 0.2s;
  user-select: none;
}

.merge-spot:hover {
  border-color: #409eff;
}

.spot-idle {
  border-color: #67c23a;
}

.spot-selected {
  border-color: #409eff !important;
  background: #ecf5ff !important;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.spot-occupied-card {
  border-color: #f56c6c;
  background: #fef0f0;
  cursor: not-allowed;
  opacity: 0.8;
}

.spot-disabled {
  border-color: #dcdfe6;
  background: #f4f4f5;
  cursor: not-allowed;
  opacity: 0.6;
}

.ms-code {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
}

.ms-name {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ms-status {
  font-size: 12px;
  margin-top: 6px;
  font-weight: 500;
}

.ms-check {
  position: absolute;
  top: 4px;
  right: 4px;
  color: #409eff;
  font-size: 18px;
}

.preview-section {
  background: #f0f9ff;
  border: 1px solid #d9ecff;
  border-radius: 6px;
  padding: 12px 14px;
}

.segments-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.occ-spots-bar {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.occ-spot-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  background: #fdf6ec;
  color: #e6a23c;
  border: 1px solid #faecd8;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.15s;
}

.occ-spot-chip:hover {
  background: #faecd8;
}

.chip-main {
  background: #ecf5ff !important;
  color: #409eff !important;
  border-color: #d9ecff !important;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.15);
}

.chip-disabled {
  opacity: 0.6;
  cursor: not-allowed !important;
  background: #f4f4f5 !important;
  color: #909399 !important;
  border-color: #e9e9eb !important;
}

.chip-disabled:hover {
  background: #f4f4f5 !important;
}

.mt-4 {
  margin-top: 4px;
}

.ml-8 {
  margin-left: 8px;
}

.empty-tip {
  padding: 30px 0;
}
</style>
