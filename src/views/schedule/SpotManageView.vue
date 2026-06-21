<template>
  <div class="page-container">
    <div class="card">
      <div class="flex-between mb-16">
        <div class="section-title">
          <el-icon><OfficeBuilding /></el-icon>
          钓位建档管理
        </div>
        <el-button type="primary" @click="openDialog()">
          <el-icon><Plus /></el-icon>
          新增钓位
        </el-button>
      </div>

      <el-table :data="spotStore.spots" stripe style="width: 100%">
        <el-table-column prop="code" label="编号" width="100" />
        <el-table-column prop="name" label="钓位名称" min-width="160" />
        <el-table-column prop="area" label="区域" width="100" />
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <el-tag>{{ getTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="position" label="位置序号" width="100" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="基础价格" width="120">
          <template #default="{ row }">¥{{ row.basePrice }}/小时</template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑钓位' : '新增钓位'" width="480px">
      <el-form :model="form" label-width="90px" :rules="rules" ref="formRef">
        <el-form-item label="钓位编号" prop="code">
          <el-input v-model="form.code" placeholder="如 A01" />
        </el-form-item>
        <el-form-item label="钓位名称" prop="name">
          <el-input v-model="form.name" placeholder="如 A区1号钓位" />
        </el-form-item>
        <el-form-item label="区域" prop="area">
          <el-input v-model="form.area" placeholder="如 A区" />
        </el-form-item>
        <el-form-item label="钓位类型" prop="type">
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="单人位" value="single" />
            <el-option label="双人位" value="double" />
            <el-option label="VIP浮台" value="platform" />
          </el-select>
        </el-form-item>
        <el-form-item label="位置序号" prop="position">
          <el-input-number v-model="form.position" :min="1" :max="999" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="可用" value="available" />
            <el-option label="维护中" value="maintenance" />
            <el-option label="已关闭" value="closed" />
          </el-select>
        </el-form-item>
        <el-form-item label="基础价格" prop="basePrice">
          <el-input-number v-model="form.basePrice" :min="0" :step="5" style="width: 100%" />
          <span class="text-muted">元/小时（第1档基准）</span>
        </el-form-item>
        <el-form-item label="描述">
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
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useSpotStore } from '@/stores/spot'
import type { FishingSpot } from '@/types'

const spotStore = useSpotStore()

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<Partial<FishingSpot>>({
  code: '',
  name: '',
  area: 'A区',
  type: 'single',
  position: 1,
  status: 'available',
  basePrice: 30,
  description: ''
})

const rules: FormRules = {
  code: [{ required: true, message: '请输入钓位编号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入钓位名称', trigger: 'blur' }],
  area: [{ required: true, message: '请输入区域', trigger: 'blur' }],
  position: [{ required: true, message: '请输入位置序号', trigger: 'blur' }],
  basePrice: [{ required: true, message: '请输入基础价格', trigger: 'blur' }]
}

function getTypeLabel(type: FishingSpot['type']) {
  const map: Record<string, string> = { single: '单人位', double: '双人位', platform: 'VIP浮台' }
  return map[type]
}

function getStatusType(status: FishingSpot['status']) {
  const map: Record<string, string> = { available: 'success', maintenance: 'warning', closed: 'info' }
  return map[status]
}

function getStatusLabel(status: FishingSpot['status']) {
  const map: Record<string, string> = { available: '可用', maintenance: '维护中', closed: '已关闭' }
  return map[status]
}

function openDialog(row?: FishingSpot) {
  editingId.value = row?.id || null
  if (row) {
    Object.assign(form, row)
  } else {
    Object.assign(form, {
      code: '',
      name: '',
      area: 'A区',
      type: 'single',
      position: 1,
      status: 'available',
      basePrice: 30,
      description: ''
    })
  }
  dialogVisible.value = true
}

function submitForm() {
  formRef.value?.validate((valid) => {
    if (!valid) return
    try {
      if (editingId.value) {
        spotStore.updateSpot(editingId.value, form)
        ElMessage.success('更新成功')
      } else {
        spotStore.addSpot(form as Omit<FishingSpot, 'id'>)
        ElMessage.success('新增成功')
      }
      dialogVisible.value = false
    } catch (e: any) {
      ElMessage.error(e.message)
    }
  })
}

function handleDelete(id: string) {
  ElMessageBox.confirm('确定删除该钓位吗？此操作不可恢复。', '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  }).then(() => {
    spotStore.deleteSpot(id)
    ElMessage.success('已删除')
  }).catch(() => {})
}
</script>
