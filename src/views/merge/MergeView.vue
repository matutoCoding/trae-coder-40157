<template>
  <div class="page-container">
    <div class="card">
      <div class="section-title">
        <el-icon><Connection /></el-icon>
        连续时段合并占用（连订）
      </div>
      <p class="text-muted mb-12" style="font-size: 13px;">
        选择同一钓友的相邻空闲钓位，一次性合并预订，系统自动合并为整段占用。
      </p>

      <el-form :model="mergeForm" label-width="100px" inline class="mb-12">
        <el-form-item label="钓友姓名">
          <el-input v-model="mergeForm.name" placeholder="姓名" style="width: 160px;" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="mergeForm.phone" placeholder="手机号" style="width: 160px;" />
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

      <div class="mt-16 flex-between">
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
        <el-button type="primary" :disabled="mergeForm.selectedIds.length < 1" @click="confirmMergeCreate">
          <el-icon><Link /></el-icon>
          合并预订（{{ mergeForm.selectedIds.length }}个钓位）
        </el-button>
      </div>
    </div>

    <div class="card mt-16">
      <div class="section-title">
        <el-icon><Scissor /></el-icon>
        占用区间拆分（中途收竿）
      </div>
      <p class="text-muted mb-12" style="font-size: 13px;">
        合并占用支持按钓位拆分。选择某个占用中的钓位，可将其中途收竿拆分出来单独结算。
      </p>

      <el-table :data="mergedOccupations" stripe style="width: 100%">
        <el-table-column prop="anglerName" label="钓友" width="110" />
        <el-table-column label="合并占用钓位" min-width="220">
          <template #default="{ row }">
            <div class="occ-spots-bar">
              <div
                v-for="sid in row.spotIds"
                :key="sid"
                class="occ-spot-chip"
                :class="{ 'chip-main': sid === selectedSplitRow?.id && selectedSplitSpot === sid }"
                @click="selectSplitSpot(row, sid)"
              >
                <span>{{ spotStore.getSpotById(sid)?.code }}</span>
                <el-icon v-if="selectedSplitRow?.id === row.id && selectedSplitSpot === sid">
                  <Pointer />
                </el-icon>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="开始时间" width="170">
          <template #default="{ row }">{{ row.startTime }}</template>
        </el-table-column>
        <el-table-column label="垂钓时长" width="110">
          <template #default="{ row }">{{ getDuration(row) }}</template>
        </el-table-column>
        <el-table-column label="档位" width="140">
          <template #default="{ row }">
            <span class="text-primary">{{ getCurrentTier(row)?.name || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="warning"
              :disabled="!canSplit(row)"
              @click="splitSelected(row)"
            >
              <el-icon><Scissor /></el-icon>
              拆分选中
            </el-button>
            <el-button
              size="small"
              type="primary"
              @click="goToBill(row)"
            >
              <el-icon><Tickets /></el-icon>
              收竿结算
            </el-button>
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
        所有进行中的占用
      </div>
      <el-table :data="occStore.activeOccupations" stripe style="width: 100%">
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
          </template>
        </el-table-column>
        <el-table-column label="开始时间" width="170">
          <template #default="{ row }">{{ row.startTime }}</template>
        </el-table-column>
        <el-table-column label="垂钓时长" width="110">
          <template #default="{ row }">{{ getDuration(row) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="goToBill(row)">收竿结算</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { useSpotStore } from '@/stores/spot'
import { useOccupationStore, useAnglerStore } from '@/stores/occupation'
import { usePricingStore } from '@/stores/pricing'
import type { Occupation, FishingSpot } from '@/types'
import { calcHours, formatDateTime } from '@/utils'

const spotStore = useSpotStore()
const occStore = useOccupationStore()
const anglerStore = useAnglerStore()
const pricingStore = usePricingStore()
const router = useRouter()

const mergeForm = reactive({
  selectedIds: [] as string[],
  name: '',
  phone: ''
})

const selectedSplitRow = ref<Occupation | null>(null)
const selectedSplitSpot = ref<string>('')

const mergedOccupations = computed(() =>
  occStore.activeOccupations.filter(o => o.isMerged && o.spotIds.length > 1)
)

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
    ElMessage.warning('该钓位已被占用')
    return
  }
  const idx = mergeForm.selectedIds.indexOf(id)
  if (idx >= 0) {
    mergeForm.selectedIds.splice(idx, 1)
  } else {
    if (mergeForm.selectedIds.length > 0) {
      const allAdjacent = mergeForm.selectedIds.every(sid => spotStore.areAdjacent(sid, id) || sid === id)
      if (!allAdjacent) {
        ElMessage.warning('只能选择相邻的钓位进行合并')
        return
      }
    }
    mergeForm.selectedIds.push(id)
  }
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
  try {
    const angler = anglerStore.findOrCreate(mergeForm.name.trim(), mergeForm.phone.trim())
    occStore.createOccupation(mergeForm.selectedIds, angler.id, angler.name)
    ElMessage.success(`成功合并预订 ${mergeForm.selectedIds.length} 个钓位`)
    mergeForm.selectedIds = []
    mergeForm.name = ''
    mergeForm.phone = ''
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

function selectSplitSpot(row: Occupation, sid: string) {
  selectedSplitRow.value = row
  selectedSplitSpot.value = sid
}

function canSplit(row: Occupation): boolean {
  return row.id === selectedSplitRow.value?.id && !!selectedSplitSpot.value && row.spotIds.includes(selectedSplitSpot.value)
}

function splitSelected(row: Occupation) {
  if (!selectedSplitSpot.value) {
    ElMessage.info('请先点击钓位选择要拆分的位置')
    return
  }
  const spotCode = spotStore.getSpotById(selectedSplitSpot.value)?.code || ''
  ElMessageBox.confirm(
    `确定将钓位 ${spotCode} 从中途拆分收竿吗？该钓位将独立结算，剩余钓位继续占用。`,
    '拆分确认',
    { confirmButtonText: '确认拆分', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    try {
      const { removed } = occStore.splitSpotOff(row.id, selectedSplitSpot.value)
      ElMessage.success(`拆分成功，已为 ${spotCode} 生成结算记录`)
      selectedSplitRow.value = null
      selectedSplitSpot.value = ''
    } catch (e: any) {
      ElMessage.error(e.message)
    }
  }).catch(() => {})
}

function getDuration(occ: Occupation) {
  const h = calcHours(occ.startTime, formatDateTime(new Date()))
  return `${h.toFixed(1)}小时`
}

function getCurrentTier(occ: Occupation) {
  const spot = spotStore.getSpotById(occ.spotId)
  const basePrice = spot ? spot.basePrice / 30 : 1
  const info = pricingStore.calculateBilling(occ.startTime, formatDateTime(new Date()), basePrice, occ.spotIds.length)
  return info.currentTier
}

function goToBill(row: Occupation) {
  router.push({ path: '/billing', query: { occId: row.id } })
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

.empty-tip {
  padding: 30px 0;
}
</style>
