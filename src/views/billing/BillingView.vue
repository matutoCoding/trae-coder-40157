<template>
  <div class="page-container">
    <div class="card">
      <div class="flex-between mb-16">
        <div class="section-title">
          <el-icon><Tickets /></el-icon>
          账单生成 · 渔获过磅
        </div>
        <div class="flex-center" style="gap: 12px;">
          <el-tag type="warning" effect="light">
            <el-icon><Promotion /></el-icon>
            拆分待结算 {{ occStore.pendingBillOccupations.length }}
          </el-tag>
          <el-tag type="danger" effect="light">待支付 {{ billStore.unpaidBills.length }}</el-tag>
          <el-tag type="success" effect="light">已结算 {{ billStore.paidBills.length }}</el-tag>
        </div>
      </div>

      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="进行中（收竿结算）" name="active">
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
                <el-tag v-if="row.isMerged" type="warning" size="small">合并</el-tag>
                <el-tag v-if="row.splitFromId" type="info" size="small">拆分后</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="开始时间" width="170">
              <template #default="{ row }">{{ row.startTime }}</template>
            </el-table-column>
            <el-table-column label="垂钓时长" width="110">
              <template #default="{ row }">{{ getDuration(row) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="openWeighing(row)">
                  <el-icon><Scale /></el-icon>
                  过磅称重
                </el-button>
                <el-button size="small" type="primary" @click="generateBill(row)">
                  <el-icon><Tickets /></el-icon>
                  收竿结算
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="occStore.activeOccupations.length === 0" class="empty-tip">
            <el-empty description="当前没有进行中的占用" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="拆分待结算" name="pending">
          <el-alert
            type="warning"
            :closable="false"
            show-icon
            class="mb-12"
            title="以下为中途拆分出的钓位占用，已结束垂钓等待结算。可补录渔获然后生成账单。"
          />
          <el-table :data="occStore.pendingBillOccupations" stripe style="width: 100%">
            <el-table-column prop="anglerName" label="钓友" width="120" />
            <el-table-column label="钓位" min-width="180">
              <template #default="{ row }">
                <el-tag
                  v-for="sid in row.spotIds"
                  :key="sid"
                  type="warning"
                  effect="light"
                  style="margin-right: 4px;"
                >
                  {{ spotStore.getSpotById(sid)?.code }}
                </el-tag>
                <el-tag v-if="row.splitFromId" type="warning" size="small">中途拆分</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="垂钓时段" width="340">
              <template #default="{ row }">
                <div>{{ row.startTime }}</div>
                <div class="text-muted">至 {{ row.endTime }}</div>
                <div class="text-muted">共 {{ getFixedDuration(row) }} 小时</div>
              </template>
            </el-table-column>
            <el-table-column label="渔获" width="100">
              <template #default="{ row }">
                {{ getCatchCount(row.id) }} 条 / ¥{{ getCatchTotal(row.id).toFixed(2) }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag type="warning" size="small">待结算</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="openWeighing(row)">
                  <el-icon><Scale /></el-icon>
                  补录渔获
                </el-button>
                <el-button size="small" type="primary" @click="generatePendingBill(row)">
                  <el-icon><Tickets /></el-icon>
                  出账单
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="occStore.pendingBillOccupations.length === 0" class="empty-tip">
            <el-empty description="暂无拆分待结算的钓位" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="待支付账单" name="unpaid">
          <el-table :data="billStore.unpaidBills" stripe style="width: 100%">
            <el-table-column prop="anglerName" label="钓友" width="120" />
            <el-table-column prop="spotNames" label="钓位" min-width="180" show-overflow-tooltip />
            <el-table-column label="时间" width="340">
              <template #default="{ row }">
                <div>{{ row.startTime }}</div>
                <div class="text-muted">至 {{ row.endTime }}</div>
                <div class="text-muted">共 {{ row.totalHours }} 小时</div>
              </template>
            </el-table-column>
            <el-table-column label="垂钓费" width="100">
              <template #default="{ row }">¥{{ row.fishingFee.toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="渔获费" width="100">
              <template #default="{ row }">¥{{ row.catchTotal.toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="优惠" width="90">
              <template #default="{ row }">-¥{{ row.discount.toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="应收金额" width="130">
              <template #default="{ row }">
                <span class="text-danger" style="font-weight: 700; font-size: 16px;">
                  ¥{{ row.totalAmount.toFixed(2) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="viewBill(row)">查看明细</el-button>
                <el-button size="small" type="success" @click="handlePay(row)">
                  <el-icon><Wallet /></el-icon>
                  确认收款
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="billStore.unpaidBills.length === 0" class="empty-tip">
            <el-empty description="暂无待支付账单" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="已结算（已归档）" name="paid">
          <el-table :data="billStore.paidBills" stripe style="width: 100%">
            <el-table-column prop="anglerName" label="钓友" width="120" />
            <el-table-column prop="spotNames" label="钓位" min-width="180" show-overflow-tooltip />
            <el-table-column label="时长" width="100">
              <template #default="{ row }">{{ row.totalHours }}h</template>
            </el-table-column>
            <el-table-column label="实收金额" width="130">
              <template #default="{ row }">
                <span class="text-success" style="font-weight: 600;">¥{{ row.totalAmount.toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="收款时间" width="170">
              <template #default="{ row }">{{ row.payTime }}</template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="viewBill(row)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="billStore.paidBills.length === 0" class="empty-tip">
            <el-empty description="暂无已结算账单" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog v-model="weighingVisible" title="渔获过磅称重" width="580px">
      <div v-if="currentOcc" class="weighing-header">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="钓友">{{ currentOcc.anglerName }}</el-descriptions-item>
          <el-descriptions-item label="钓位">
            <el-tag
              v-for="sid in currentOcc.spotIds"
              :key="sid"
              type="primary"
              effect="light"
              size="small"
              style="margin-right: 4px;"
            >
              {{ spotStore.getSpotById(sid)?.code }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="开始时间">{{ currentOcc.startTime }}</el-descriptions-item>
          <el-descriptions-item label="结束时间">
            {{ currentOcc.endTime || '仍在垂钓中' }}
          </el-descriptions-item>
          <el-descriptions-item label="已垂钓" :span="2">
            <el-tag type="primary">{{ getDuration(currentOcc) }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="mt-16">
        <div class="section-title mb-8" style="font-size: 14px;">
          <el-icon><Fish /></el-icon>
          渔获记录
          <span class="text-muted" style="font-size: 12px; font-weight: normal;">（可多次称重累加）</span>
        </div>
        <el-table :data="currentCatches" border size="small" style="width: 100%;">
          <el-table-column prop="fishType" label="鱼种" width="110" />
          <el-table-column label="重量(斤)" width="110">
            <template #default="{ row }">{{ row.weight.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="单价(元/斤)" width="110">
            <template #default="{ row }">{{ row.unitPrice.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="小计" width="110">
            <template #default="{ row }">
              <span class="text-primary">¥{{ (row.weight * row.unitPrice).toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ row }">
              <el-button size="small" type="danger" text @click="deleteCatch(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="currentCatches.length === 0" class="empty-tip" style="padding: 20px 0;">
          <el-empty description="暂无渔获记录" :image-size="60" />
        </div>
      </div>

      <div class="weighing-form mt-16">
        <el-form inline label-width="80px">
          <el-form-item label="鱼种">
            <el-select v-model="catchForm.fishType" style="width: 130px;" filterable allow-create default-first-option>
              <el-option label="鲫鱼" value="鲫鱼" />
              <el-option label="鲤鱼" value="鲤鱼" />
              <el-option label="草鱼" value="草鱼" />
              <el-option label="鲢鱼" value="鲢鱼" />
              <el-option label="鳙鱼" value="鳙鱼" />
              <el-option label="鳊鱼" value="鳊鱼" />
              <el-option label="黑鱼" value="黑鱼" />
              <el-option label="青鱼" value="青鱼" />
            </el-select>
          </el-form-item>
          <el-form-item label="重量">
            <el-input-number
              v-model="catchForm.weight"
              :min="0"
              :step="0.1"
              :precision="2"
              style="width: 130px;"
            />
            <span class="text-muted" style="margin-left: 4px;">斤</span>
          </el-form-item>
          <el-form-item label="单价">
            <el-input-number
              v-model="catchForm.unitPrice"
              :min="0"
              :step="1"
              :precision="2"
              style="width: 130px;"
            />
            <span class="text-muted" style="margin-left: 4px;">元/斤</span>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="addCatch">
              <el-icon><Plus /></el-icon>
              添加称重
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <span>
            渔获费合计：
            <span class="text-danger" style="font-size: 18px; font-weight: 700;">
              ¥{{ totalCatchFee.toFixed(2) }}
            </span>
          </span>
          <div>
            <el-button @click="weighingVisible = false">关闭</el-button>
            <el-button type="primary" @click="weighingVisible = false; if(currentOcc) generateBill(currentOcc)">
              去结算出账单
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="billDetailVisible" :title="`账单明细 · ${currentBill?.anglerName || ''}`" width="640px">
      <div v-if="currentBill">
        <el-descriptions :column="2" border size="default">
          <el-descriptions-item label="账单号" :span="2">{{ currentBill.id }}</el-descriptions-item>
          <el-descriptions-item label="钓友">{{ currentBill.anglerName }}</el-descriptions-item>
          <el-descriptions-item label="钓位">{{ currentBill.spotNames }}</el-descriptions-item>
          <el-descriptions-item label="开始时间">{{ currentBill.startTime }}</el-descriptions-item>
          <el-descriptions-item label="结束时间">{{ currentBill.endTime }}</el-descriptions-item>
          <el-descriptions-item label="总时长" :span="2">{{ currentBill.totalHours }} 小时</el-descriptions-item>
        </el-descriptions>

        <div class="mt-16">
          <div class="section-title" style="font-size: 14px;">阶梯计费明细</div>
          <el-table :data="currentBill.billingDetails" border size="small">
            <el-table-column prop="tierName" label="档位" />
            <el-table-column label="单价" width="100">
              <template #default="{ row }">¥{{ row.pricePerHour }}/时</template>
            </el-table-column>
            <el-table-column label="时长" width="100">
              <template #default="{ row }">{{ row.hours }}h</template>
            </el-table-column>
            <el-table-column label="小计" width="110">
              <template #default="{ row }">
                <span class="text-primary">¥{{ row.subtotal.toFixed(2) }}</span>
              </template>
            </el-table-column>
          </el-table>
          <div class="subtotal-row">
            <span>垂钓费小计：</span>
            <span style="font-weight: 600;">¥{{ currentBill.fishingFee.toFixed(2) }}</span>
          </div>
        </div>

        <div class="mt-16" v-if="currentBill.catches.length > 0">
          <div class="section-title" style="font-size: 14px;">渔获明细</div>
          <el-table :data="currentBill.catches" border size="small">
            <el-table-column prop="fishType" label="鱼种" width="100" />
            <el-table-column label="重量" width="100">
              <template #default="{ row }">{{ row.weight.toFixed(2) }} 斤</template>
            </el-table-column>
            <el-table-column label="单价" width="100">
              <template #default="{ row }">¥{{ row.unitPrice }}/斤</template>
            </el-table-column>
            <el-table-column label="小计" width="110">
              <template #default="{ row }">
                <span class="text-primary">¥{{ (row.weight * row.unitPrice).toFixed(2) }}</span>
              </template>
            </el-table-column>
          </el-table>
          <div class="subtotal-row">
            <span>渔获费小计：</span>
            <span style="font-weight: 600;">¥{{ currentBill.catchTotal.toFixed(2) }}</span>
          </div>
        </div>

        <div class="bill-total mt-16">
          <div class="bill-line">
            <span class="text-muted">垂钓费：</span>
            <span>¥{{ currentBill.fishingFee.toFixed(2) }}</span>
          </div>
          <div class="bill-line">
            <span class="text-muted">渔获费：</span>
            <span>¥{{ currentBill.catchTotal.toFixed(2) }}</span>
          </div>
          <div class="bill-line">
            <span class="text-muted">优惠减免：</span>
            <span class="text-success">-¥{{ currentBill.discount.toFixed(2) }}</span>
          </div>
          <div class="bill-line bill-total-line">
            <span>应收金额：</span>
            <span class="text-danger" style="font-size: 22px; font-weight: 700;">
              ¥{{ currentBill.totalAmount.toFixed(2) }}
            </span>
          </div>
          <div class="bill-line" v-if="currentBill.paid">
            <span class="text-success">
              <el-icon><CircleCheck /></el-icon>
              已收款 · {{ currentBill.payTime }}
            </span>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="billDetailVisible = false">关闭</el-button>
        <el-button v-if="currentBill && !currentBill.paid" type="success" @click="handlePay(currentBill)">
          确认收款
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import { useSpotStore } from '@/stores/spot'
import { useOccupationStore } from '@/stores/occupation'
import { useBillStore } from '@/stores/bill'
import { usePricingStore } from '@/stores/pricing'
import type { Occupation, Bill, CatchRecord } from '@/types'
import { calcHours, formatDateTime, roundTo } from '@/utils'

const spotStore = useSpotStore()
const occStore = useOccupationStore()
const billStore = useBillStore()
const pricingStore = usePricingStore()
const route = useRoute()

const activeTab = ref('active')

const weighingVisible = ref(false)
const currentOcc = ref<Occupation | null>(null)
const currentCatches = ref<CatchRecord[]>([])
const catchForm = reactive({ fishType: '鲫鱼', weight: 1, unitPrice: 12 })

const billDetailVisible = ref(false)
const currentBill = ref<Bill | null>(null)

const totalCatchFee = computed(() =>
  roundTo(currentCatches.value.reduce((sum, c) => sum + c.weight * c.unitPrice, 0))
)

onMounted(() => {
  const occId = route.query.occId as string
  if (occId) {
    const occ = occStore.getOccupationById(occId)
    if (occ) {
      setTimeout(() => {
        if (occ.status === 'pending_bill' || occ.status === 'completed') {
          generatePendingBill(occ)
        } else {
          generateBill(occ)
        }
      }, 200)
    }
  }
  const tab = route.query.tab as string
  if (tab) activeTab.value = tab
})

function getDuration(occ: Occupation) {
  const end = occ.endTime || formatDateTime(new Date())
  const h = calcHours(occ.startTime, end)
  return `${h.toFixed(1)}小时`
}

function getFixedDuration(occ: Occupation) {
  if (!occ.endTime) return getDuration(occ).replace('小时', '')
  const h = calcHours(occ.startTime, occ.endTime)
  return h.toFixed(2)
}

function getCatchCount(occId: string) {
  return billStore.getCatchesByOccupation(occId).length
}

function getCatchTotal(occId: string) {
  return roundTo(
    billStore.getCatchesByOccupation(occId).reduce((s, c) => s + c.weight * c.unitPrice, 0)
  )
}

function openWeighing(occ: Occupation) {
  currentOcc.value = occ
  currentCatches.value = billStore.getCatchesByOccupation(occ.id)
  weighingVisible.value = true
}

function addCatch() {
  if (!currentOcc.value) return
  if (catchForm.weight <= 0) {
    ElMessage.warning('请输入有效重量')
    return
  }
  billStore.addCatch({
    occupationId: currentOcc.value.id,
    fishType: catchForm.fishType,
    weight: catchForm.weight,
    unitPrice: catchForm.unitPrice
  })
  currentCatches.value = billStore.getCatchesByOccupation(currentOcc.value.id)
  ElMessage.success(`已记录 ${catchForm.weight}斤 ${catchForm.fishType}`)
}

function deleteCatch(id: string) {
  billStore.deleteCatch(id)
  if (currentOcc.value) {
    currentCatches.value = billStore.getCatchesByOccupation(currentOcc.value.id)
  }
}

function doGenerateBill(occ: Occupation, useFixedEndTime: boolean = false) {
  ElMessageBox.prompt('请输入优惠金额（元）', '生成账单', {
    confirmButtonText: '确认生成',
    cancelButtonText: '取消',
    inputValue: '0',
    inputValidator: (value: string) => {
      const num = parseFloat(value)
      if (isNaN(num) || num < 0) return '请输入有效金额'
      return true
    },
    inputPlaceholder: '0'
  }).then(({ value }) => {
    try {
      const discount = parseFloat(value || '0')
      const endTime = useFixedEndTime && occ.endTime
        ? occ.endTime
        : formatDateTime(new Date())
      if (occ.status === 'active') {
        occStore.endOccupation(occ.id)
      }
      const bill = billStore.generateBill(occ.id, endTime, discount)
      ElMessage.success('账单已生成')
      currentBill.value = bill
      weighingVisible.value = false
      billDetailVisible.value = true
      activeTab.value = 'unpaid'
    } catch (e: any) {
      ElMessage.error(e.message)
    }
  }).catch(() => {})
}

function generateBill(occ: Occupation) {
  doGenerateBill(occ, false)
}

function generatePendingBill(occ: Occupation) {
  doGenerateBill(occ, true)
}

function viewBill(bill: Bill) {
  currentBill.value = bill
  billDetailVisible.value = true
}

function handlePay(bill: Bill) {
  ElMessageBox.confirm(
    `确认收到钓友 ${bill.anglerName} 的款项 ¥${bill.totalAmount.toFixed(2)} 吗？收款后本条记录将归档到已结算列表。`,
    '收款确认',
    { confirmButtonText: '确认收款', cancelButtonText: '取消', type: 'success' }
  ).then(() => {
    billStore.markPaid(bill.id)
    currentBill.value = billStore.getBillById(bill.id) || null
    ElMessage.success('收款成功，已归档')
  }).catch(() => {})
}
</script>

<style scoped>
.empty-tip {
  padding: 30px 0;
}

.mb-12 {
  margin-bottom: 12px;
}

.weighing-header {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 12px;
}

.weighing-form {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 12px;
}

.subtotal-row {
  display: flex;
  justify-content: flex-end;
  padding: 10px 4px 0;
  gap: 8px;
}

.bill-total {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px 20px;
}

.bill-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 14px;
}

.bill-total-line {
  padding-top: 12px;
  margin-top: 6px;
  border-top: 1px dashed #e4e7ed;
  font-size: 16px;
}
</style>
