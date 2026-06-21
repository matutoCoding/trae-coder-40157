<template>
  <div class="page-container">
    <div class="card">
      <div class="flex-between mb-16">
        <div class="section-title">
          <el-icon><Calendar /></el-icon>
          今日钓位排期
        </div>
        <div class="flex-center" style="gap: 12px;">
          <el-tag type="success" effect="light">空闲 {{ availableCount }}</el-tag>
          <el-tag type="danger" effect="light">占用 {{ occupiedCount }}</el-tag>
          <el-tag type="info" effect="light">维护 {{ maintenanceCount }}</el-tag>
        </div>
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
            <div v-if="occStore.isSpotOccupied(spot.id)" class="spot-angler">
              <el-icon><User /></el-icon>
              {{ getSpotAngler(spot.id) }}
            </div>
            <div v-else-if="spot.status === 'maintenance'" class="spot-maint">
              <el-icon><Tools /></el-icon>
              维护中
            </div>
            <div v-else class="spot-price">
              ¥{{ spot.basePrice }}/时起
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-16">
      <div class="section-title">
        <el-icon><List /></el-icon>
        当前进行中的占用
      </div>
      <el-table :data="activeList" stripe style="width: 100%">
        <el-table-column prop="anglerName" label="钓友" width="120" />
        <el-table-column label="钓位" min-width="180">
          <template #default="{ row }">
            <el-tag v-for="sid in row.spotIds" :key="sid" type="primary" effect="light" style="margin-right: 4px;">
              {{ spotStore.getSpotById(sid)?.code }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="开始时间" width="170">
          <template #default="{ row }">{{ row.startTime }}</template>
        </el-table-column>
        <el-table-column label="已垂钓" width="120">
          <template #default="{ row }">
            <el-tag :type="getDurationTagType(row)">{{ getDuration(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="当前档位/费用">
          <template #default="{ row }">
            <span v-if="getBillingInfo(row).currentTier" class="text-primary">
              {{ getBillingInfo(row).currentTier.name }} · {{ getBillingInfo(row).details.reduce((s, d) => s + d.subtotal, 0).toFixed(2) }}元
            </span>
          </template>
        </el-table-column>
        <el-table-column label="临界提示" width="200">
          <template #default="{ row }">
            <el-alert
              v-if="getBillingInfo(row).nextTierInfo"
              :title="`距下一档还剩 ${getBillingInfo(row).nextTierInfo.hoursToNext.toFixed(2)} 小时`"
              type="warning"
              size="small"
              :closable="false"
              show-icon
            />
            <span v-else class="text-muted">已到最高档</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="reserveDialogVisible" title="预订钓位" width="520px">
      <el-form :model="reserveForm" label-width="90px">
        <el-form-item label="选择钓位">
          <el-select
            v-model="reserveForm.spotIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="可多选相邻钓位合并"
            style="width: 100%"
          >
            <el-option
              v-for="s in reservableSpots"
              :key="s.id"
              :label="`${s.code} - ${s.name}`"
              :value="s.id"
            />
          </el-select>
          <div v-if="reserveForm.spotIds.length > 1" class="mt-8">
            <el-tag type="warning" effect="light">
              <el-icon><InfoFilled /></el-icon>
              相邻钓位将自动合并为整段占用
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
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSpotStore } from '@/stores/spot'
import { useOccupationStore, useAnglerStore } from '@/stores/occupation'
import { usePricingStore } from '@/stores/pricing'
import { useBillStore } from '@/stores/bill'
import type { FishingSpot, Occupation } from '@/types'
import { calcHours, roundTo, formatDateTime } from '@/utils'

const spotStore = useSpotStore()
const occStore = useOccupationStore()
const anglerStore = useAnglerStore()
const pricingStore = usePricingStore()
const billStore = useBillStore()

const reserveDialogVisible = ref(false)
const reserveForm = ref({ spotIds: [] as string[], name: '', phone: '' })

const availableCount = computed(() =>
  spotStore.spots.filter(s => s.status === 'available' && !occStore.isSpotOccupied(s.id)).length
)
const occupiedCount = computed(() =>
  spotStore.spots.filter(s => occStore.isSpotOccupied(s.id)).length
)
const maintenanceCount = computed(() =>
  spotStore.spots.filter(s => s.status === 'maintenance').length
)

const reservableSpots = computed(() =>
  spotStore.spots.filter(s => s.status === 'available' && !occStore.isSpotOccupied(s.id))
)

const activeList = computed(() => occStore.activeOccupations)

function getTypeLabel(type: FishingSpot['type']) {
  const map = { single: '单人位', double: '双人位', platform: 'VIP浮台' }
  return map[type]
}

function getSpotClass(id: string) {
  if (spotStore.getSpotById(id)?.status === 'maintenance') return 'spot-maint-card'
  if (occStore.isSpotOccupied(id)) return 'spot-occupied'
  return 'spot-available'
}

function getSpotAngler(id: string) {
  const occ = occStore.getSpotOccupation(id)
  return occ?.anglerName || '-'
}

function getDuration(occ: Occupation) {
  const h = calcHours(occ.startTime, formatDateTime(new Date()))
  return `${h.toFixed(1)}小时`
}

function getDurationTagType(occ: Occupation) {
  const h = calcHours(occ.startTime, formatDateTime(new Date()))
  if (h >= 8) return 'danger'
  if (h >= 4) return 'warning'
  return 'success'
}

function getBillingInfo(occ: Occupation) {
  const spot = spotStore.getSpotById(occ.spotId)
  const basePrice = spot ? spot.basePrice / 30 : 1
  return pricingStore.calculateBilling(occ.startTime, formatDateTime(new Date()), basePrice, occ.spotIds.length)
}

function handleSpotClick(id: string) {
  const spot = spotStore.getSpotById(id)
  if (!spot || spot.status !== 'available') {
    ElMessage.warning('该钓位暂不可预订')
    return
  }
  if (occStore.isSpotOccupied(id)) {
    const occ = occStore.getSpotOccupation(id)
    if (occ) {
      ElMessageBox.confirm(
        `钓位已被 ${occ.anglerName} 占用，开始时间：${occ.startTime}\n是否需要进行拆分或收竿操作？`,
        '占用信息',
        { confirmButtonText: '前往拆分管理', cancelButtonText: '关闭', type: 'info' }
      ).then(() => {
        location.hash = '#/merge'
      }).catch(() => {})
    }
    return
  }
  reserveForm.value = { spotIds: [id], name: '', phone: '' }
  reserveDialogVisible.value = true
}

function confirmReserve() {
  if (reserveForm.value.spotIds.length === 0) {
    ElMessage.warning('请选择钓位')
    return
  }
  if (!reserveForm.value.name.trim()) {
    ElMessage.warning('请输入钓友姓名')
    return
  }
  if (!reserveForm.value.phone.trim()) {
    ElMessage.warning('请输入联系电话')
    return
  }
  try {
    const angler = anglerStore.findOrCreate(reserveForm.value.name.trim(), reserveForm.value.phone.trim())
    occStore.createOccupation(reserveForm.value.spotIds, angler.id, angler.name)
    ElMessage.success(`成功预订 ${reserveForm.value.spotIds.length} 个钓位`)
    reserveDialogVisible.value = false
  } catch (e: any) {
    ElMessage.error(e.message || '预订失败')
  }
}
</script>

<style scoped>
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
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
}

.spot-card {
  border: 2px solid #e4e7ed;
  border-radius: 10px;
  padding: 16px 14px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fafafa;
  user-select: none;
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
  cursor: pointer;
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
  font-size: 13px;
  color: #606266;
  margin-top: 4px;
}

.spot-type {
  display: inline-block;
  font-size: 11px;
  color: #909399;
  margin-top: 4px;
  padding: 1px 8px;
  background: #f4f4f5;
  border-radius: 4px;
}

.spot-angler {
  margin-top: 10px;
  font-size: 13px;
  color: #f56c6c;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.spot-maint {
  margin-top: 10px;
  font-size: 13px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 4px;
}

.spot-price {
  margin-top: 10px;
  font-size: 14px;
  color: #67c23a;
  font-weight: 600;
}
</style>
