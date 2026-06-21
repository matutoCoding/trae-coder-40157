<template>
  <el-container class="layout-container">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <el-icon :size="28"><Fishing /></el-icon>
        <span>垂钓园管理系统</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#001529"
        text-color="#bfcbd9"
        active-text-color="#409eff"
        class="menu"
      >
        <el-menu-item index="/schedule">
          <el-icon><Calendar /></el-icon>
          <span>钓位排期</span>
        </el-menu-item>
        <el-menu-item index="/spots">
          <el-icon><OfficeBuilding /></el-icon>
          <span>钓位建档</span>
        </el-menu-item>
        <el-menu-item index="/merge">
          <el-icon><Connection /></el-icon>
          <span>占用合并拆分</span>
        </el-menu-item>
        <el-menu-item index="/pricing">
          <el-icon><TrendCharts /></el-icon>
          <span>阶梯计费</span>
        </el-menu-item>
        <el-menu-item index="/billing">
          <el-icon><Tickets /></el-icon>
          <span>账单生成</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <span class="page-title">{{ currentTitle }}</span>
        </div>
        <div class="header-right">
          <el-tag type="info" effect="plain">
            <el-icon><Clock /></el-icon>
            {{ currentTime }}
          </el-tag>
        </div>
      </el-header>

      <el-main class="main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeMenu = computed(() => route.path)
const currentTitle = computed(() => (route.meta?.title as string) || '')

const currentTime = ref('')
let timer: number | null = null

function updateTime() {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  currentTime.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

onMounted(() => {
  updateTime()
  timer = window.setInterval(updateTime, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.layout-container {
  height: 100%;
}

.aside {
  background: #001529;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  background: #002140;
  border-bottom: 1px solid #002b4d;
}

.menu {
  border-right: none;
  flex: 1;
}

.menu :deep(.el-menu-item) {
  height: 50px;
  line-height: 50px;
}

.header {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.header-left .page-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.main {
  background: #f0f2f5;
  padding: 0;
  overflow-y: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
