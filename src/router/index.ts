import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/schedule',
    children: [
      {
        path: 'schedule',
        name: 'schedule',
        component: () => import('@/views/schedule/ScheduleView.vue'),
        meta: { title: '钓位排期', icon: 'Calendar' }
      },
      {
        path: 'merge',
        name: 'merge',
        component: () => import('@/views/merge/MergeView.vue'),
        meta: { title: '占用合并拆分', icon: 'Connection' }
      },
      {
        path: 'pricing',
        name: 'pricing',
        component: () => import('@/views/pricing/PricingView.vue'),
        meta: { title: '阶梯计费', icon: 'TrendCharts' }
      },
      {
        path: 'billing',
        name: 'billing',
        component: () => import('@/views/billing/BillingView.vue'),
        meta: { title: '账单生成', icon: 'Tickets' }
      },
      {
        path: 'spots',
        name: 'spots',
        component: () => import('@/views/schedule/SpotManageView.vue'),
        meta: { title: '钓位建档', icon: 'OfficeBuilding' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
