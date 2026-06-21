<template>
  <div class="page-container">
    <div class="card">
      <div class="flex-between mb-16">
        <div class="section-title">
          <el-icon><TrendCharts /></el-icon>
          阶梯档位维护
        </div>
        <el-button type="primary" @click="openDialog()">
          <el-icon><Plus /></el-icon>
          新增档位
        </el-button>
      </div>

      <div class="tier-visual mb-16">
        <div class="tier-timeline">
          <div
            v-for="(tier, idx) in pricingStore.sortedTiers"
            :key="tier.id"
            class="tier-bar"
            :style="{ background: tierColors[idx % tierColors.length], flex: tier.endHours ? (tier.endHours - tier.startHours) : 2 }"
          >
            <div class="tier-bar-name">{{ tier.name }}</div>
            <div class="tier-bar-price">¥{{ tier.pricePerHour }}/时</div>
          </div>
        </div>
        <div class="tier-axis">
          <span>0h</span>
          <span v-for="(tier, idx) in pricingStore.sortedTiers" :key="tier.id">
            {{ tier.endHours ? tier.endHours + 'h' : '∞' }}
          </span>
        </div>
      </div>

      <el-table :data="pricingStore.sortedTiers" stripe style="width: 100%">
        <el-table-column prop="sort" label="序号" width="80" align="center" />
        <el-table-column prop="name" label="档位名称" min-width="160" />
        <el-table-column label="时长区间" width="180">
          <template #default="{ row }">
            {{ row.startHours }}h ~ {{ row.endHours !== null ? row.endHours + 'h' : '不限' }}
          </template>
        </el-table-column>
        <el-table-column label="单价" width="120">
          <template #default="{ row }">
            <span class="text-danger" style="font-weight: 600;">¥{{ row.pricePerHour }}/时</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="card mt-16">
      <div class="section-title">
        <el-icon><Calculator /></el-icon>
        用量逐档计价（模拟计算）
      </div>
      <div class="calc-section">
        <el-form inline label-width="100px">
          <el-form-item label="垂钓时长">
            <el-input-number
              v-model="calcHours"
              :min="0"
              :step="0.5"
              :precision="1"
              style="width: 150px;"
            />
            <span class="text-muted" style="margin-left: 6px;">小时</span>
          </el-form-item>
          <el-form-item label="钓位数量">
            <el-input-number v-model="calcSpots" :min="1" :max="10" style="width: 150px;" />
          </el-form-item>
          <el-form-item label="钓位基准">
            <el-select v-model="calcSpotId" style="width: 180px;">
              <el-option
                v-for="s in spotStore.spots"
                :key="s.id"
                :label="`${s.code} (¥${s.basePrice}/时)`"
                :value="s.id"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <div v-if="calcResult" class="calc-result">
        <div class="calc-summary mb-12">
          <div class="summary-row">
            <span class="text-muted">总时长：</span>
            <span style="font-size: 16px; font-weight: 600;">{{ calcResult.totalHours }} 小时</span>
          </div>
          <div class="summary-row">
            <span class="text-muted">当前档位：</span>
            <el-tag type="primary">{{ calcResult.currentTier?.name || '未进入' }}</el-tag>
          </div>
          <div class="summary-row" v-if="calcResult.nextTierInfo">
            <el-alert
              :title="`距离【${calcResult.nextTierInfo.tier.name}】还剩 ${calcResult.nextTierInfo.hoursToNext.toFixed(2)} 小时`"
              type="warning"
              size="small"
              :closable="false"
              show-icon
              style="margin: 0;"
            />
          </div>
        </div>

        <el-table :data="calcResult.details" border style="width: 100%">
          <el-table-column prop="tierName" label="档位" />
          <el-table-column label="档位单价" width="120">
            <template #default="{ row }">¥{{ row.pricePerHour }}/时</template>
          </el-table-column>
          <el-table-column label="该档时长" width="120">
            <template #default="{ row }">{{ row.hours }} 小时</template>
          </el-table-column>
          <el-table-column label="小计" width="140">
            <template #default="{ row }">
              <span class="text-primary" style="font-weight: 600;">¥{{ row.subtotal.toFixed(2) }}</span>
            </template>
          </el-table-column>
        </el-table>

        <div class="total-row mt-12">
          <span style="font-size: 16px; color: #606266;">垂钓费合计：</span>
          <span style="font-size: 28px; font-weight: 700; color: #f56c6c;">
            ¥{{ calcResult.total.toFixed(2) }}
          </span>
        </div>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑档位' : '新增档位'" width="480px">
      <el-form :model="form" label-width="100px" :rules="rules" ref="formRef">
        <el-form-item label="档位名称" prop="name">
          <el-input v-model="form.name" placeholder="如 第1档（0-2小时）" />
        </el-form-item>
        <el-form-item label="序号" prop="sort">
          <el-input-number v-model="form.sort" :min="1" :max="99" style="width: 100%" />
        </el-form-item>
        <el-form-item label="起始时长" prop="startHours">
          <el-input-number v-model="form.startHours" :min="0" :step="0.5" style="width: 100%" />
          <span class="text-muted">小时（含）</span>
        </el-form-item>
        <el-form-item label="结束时长" prop="endHours">
          <el-input-number
            v-model="form.endHours"
            :min="0"
            :step="0.5"
            :controls="form.endHours !== null"
            style="width: 100%"
          />
          <el-checkbox v-model="endUnlimited" style="margin-left: 8px;">不限</el-checkbox>
        </el-form-item>
        <el-form-item label="单价" prop="pricePerHour">
          <el-input-number v-model="form.pricePerHour" :min="0" :step="5" style="width: 100%" />
          <span class="text-muted">元/小时</span>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { usePricingStore } from '@/stores/pricing'
import { useSpotStore } from '@/stores/spot'
import type { PriceTier } from '@/types'
import { formatDateTime } from '@/utils'

const pricingStore = usePricingStore()
const spotStore = useSpotStore()

const tierColors = ['#67c23a', '#409eff', '#e6a23c', '#f56c6c', '#909399', '#8e44ad']

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const formRef = ref<FormInstance>()
const endUnlimited = ref(false)
const form = reactive<Partial<PriceTier>>({
  name: '',
  sort: 1,
  startHours: 0,
  endHours: 2,
  pricePerHour: 30,
  description: ''
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入档位名称', trigger: 'blur' }],
  startHours: [{ required: true, message: '请输入起始时长', trigger: 'blur' }],
  pricePerHour: [{ required: true, message: '请输入单价', trigger: 'blur' }]
}

const calcHours = ref(3)
const calcSpots = ref(2)
const calcSpotId = ref(spotStore.spots[0]?.id || '')

const calcResult = computed(() => {
  if (calcHours.value <= 0) return null
  const spot = spotStore.getSpotById(calcSpotId.value)
  const basePrice = spot ? spot.basePrice / 30 : 1
  const now = new Date()
  const start = new Date(now.getTime() - calcHours.value * 60 * 60 * 1000)
  return pricingStore.calculateBilling(
    formatDateTime(start),
    formatDateTime(now),
    basePrice,
    calcSpots.value
  )
})

watch(endUnlimited, (val) => {
  form.endHours = val ? null : 2
})

function openDialog(row?: PriceTier) {
  editingId.value = row?.id || null
  if (row) {
    Object.assign(form, row)
    endUnlimited.value = row.endHours === null
  } else {
    const maxSort = pricingStore.tiers.reduce((m, t) => Math.max(m, t.sort), 0)
    Object.assign(form, {
      name: '',
      sort: maxSort + 1,
      startHours: 0,
      endHours: 2,
      pricePerHour: 30,
      description: ''
    })
    endUnlimited.value = false
  }
  dialogVisible.value = true
}

function submitForm() {
  formRef.value?.validate((valid) => {
    if (!valid) return
    const data = { ...form, endHours: endUnlimited.value ? null : form.endHours }
    try {
      if (editingId.value) {
        pricingStore.updateTier(editingId.value, data)
        ElMessage.success('更新成功')
      } else {
        pricingStore.addTier(data as Omit<PriceTier, 'id'>)
        ElMessage.success('新增成功')
      }
      dialogVisible.value = false
    } catch (e: any) {
      ElMessage.error(e.message)
    }
  })
}

function handleDelete(id: string) {
  ElMessageBox.confirm('确定删除该档位吗？', '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  }).then(() => {
    pricingStore.deleteTier(id)
    ElMessage.success('已删除')
  }).catch(() => {})
}
</script>

<style scoped>
.tier-visual {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 20px;
}

.tier-timeline {
  display: flex;
  height: 70px;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.tier-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 500;
  transition: all 0.2s;
}

.tier-bar:hover {
  filter: brightness(1.1);
}

.tier-bar-name {
  font-size: 13px;
}

.tier-bar-price {
  font-size: 16px;
  font-weight: 700;
  margin-top: 4px;
}

.tier-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

.calc-section {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.calc-result {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px;
}

.calc-summary {
  display: flex;
  gap: 24px;
  align-items: center;
  flex-wrap: wrap;
}

.summary-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.total-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px dashed #ebeef5;
}
</style>
