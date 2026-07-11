import { createRouter, createWebHistory } from 'vue-router'
import * as autoRoutes from "vue-router/auto-routes";
import { useTokenStore } from '@/stores/tokenStore'
import { useAuthStore } from '@/stores/authStore'
import { isNowInLegionWarTime } from "@/utils/clubBattleUtils"

const generatedRoutes = autoRoutes.routes ?? [];

const my_routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: '首页',
      requiresToken: false
    }
  },
  {
    path: '/tokens',
    name: 'TokenImport',
    component: () => import('@/views/TokenImport/index.vue'),
    meta: {
      title: 'Token管理',
      requiresToken: false
    },
    props: route => ({
      token: route.query.token,
      name: route.query.name,
      server: route.query.server,
      wsUrl: route.query.wsUrl,
      api: route.query.api,
      auto: route.query.auto === 'true'
    })
  },
  {
    path: '/subscription',
    name: 'Subscription',
    component: () => import('@/views/Subscription.vue'),
    meta: {
      title: '订阅套餐',
      requiresToken: false
    }
  },
  {
    name: 'DefaultLayout',
    path: '/admin',
    component: () => import('@/layout/DefaultLayout.vue'),
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: {
          title: '控制台',
          requiresToken: true
        }
      },
      {
        path: 'game-features',
        name: 'GameFeatures',
        component: () => import('@/views/GameFeatures.vue'),
        meta: {
          title: '游戏功能',
          requiresToken: true
        }
      },
      {
        path: 'message-test',
        name: 'MessageTest',
        component: () => import('@/components/Test/MessageTester.vue'),
        meta: {
          title: '消息测试',
          requiresToken: true
        }
      },
      {
        path: 'legion-war',
        name: 'LegionWar',
        component: () => import('@/views/LegionWar.vue'),
        meta: {
          title: '实时盐场',
          requiresToken: true
        }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
        meta: {
          title: '个人设置',
          requiresToken: true
        }
      },
      {
        path: 'daily-tasks',
        name: 'DailyTasks',
        component: () => import('@/views/DailyTasks.vue'),
        meta: {
          title: '日常任务',
          requiresToken: true
        }
      },
      {
        path: 'batch-daily-tasks',
        name: 'BatchDailyTasks',
        component: () => import('@/views/BatchDailyTasks.vue'),
        meta: {
          title: '批量日常',
          requiresToken: true
        }
      },
      {
        path: 'task-logs',
        name: 'TaskLogs',
        component: () => import('@/views/TaskLogs.vue'),
        meta: {
          title: '任务日志',
          requiresToken: false
        }
      },
      // 增加自动路由引用
      ...generatedRoutes,
    ]
  },
  {
    path: '/task-logs',
    redirect: '/admin/task-logs'
  },
  {
    path: '/websocket-test',
    name: 'WebSocketTest',
    component: () => import('@/components/Test/WebSocketTester.vue'),
    meta: {
      title: 'WebSocket测试',
      requiresToken: true
    }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Auth/Login.vue'),
    meta: { title: '登录', guest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Auth/Register.vue'),
    meta: { title: '注册', guest: true }
  },
  {
    path: '/game-roles',
    redirect: '/tokens'
  },
  // 增加自动路由引用
  ...generatedRoutes,
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: {
      title: '页面不存在'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes: my_routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

// 热更新路由
autoRoutes.handleHotUpdate?.(router);

const publicPaths = new Set(['/', '/login', '/register'])

// 导航守卫
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  const tokenStore = useTokenStore()

  // 设置页面标题
  document.title = to.meta.title ? `${to.meta.title} - 咸鱼助手` : '咸鱼助手'

  // 未登录用户只能访问公开页面；requiresToken 只表示是否需要游戏Token。
  if (!authStore.isLoggedIn && !publicPaths.has(to.path)) {
    next('/login')
    return
  }

  // 已登录用户访问 guest 页面（登录/注册）时重定向
  if (authStore.isLoggedIn && to.meta.guest) {
    next('/admin/dashboard')
    return
  }

  if(to.name==="LegionWar"&&!isNowInLegionWarTime()){
    next('/admin/dashboard');
    return;
  }

  if (to.meta.requiresToken && !tokenStore.hasTokens) {
    next('/tokens')
  } else if (to.path === '/' && authStore.isLoggedIn) {
    next('/admin/dashboard')
  } else {
    next()
  }
})



export default router
