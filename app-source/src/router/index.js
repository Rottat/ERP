import Vue from 'vue'
import VueRouter from 'vue-router'
import Login from '../views/login/Login.vue'
import Layout from '../components/AppLayout.vue'

Vue.use(VueRouter)  // 这一行不能出错

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/dashboard/Dashboard.vue') },
      { path: 'product', name: 'Product', component: () => import('@/views/product/Product.vue') },
      { path: 'customer', name: 'Customer', component: () => import('@/views/customer/Customer.vue') },
      { path: 'order', name: 'Order', component: () => import('@/views/order/Order.vue') },
      { path: 'stock', name: 'Stock', component: () => import('@/views/stock/Stock.vue') },
      { path: 'user', name: 'User', component: () => import('@/views/user/User.vue') },
      { path: 'profile', name: 'Profile', component: () => import('@/views/profile/Profile.vue') }
    ]
  }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.path !== '/login' && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router