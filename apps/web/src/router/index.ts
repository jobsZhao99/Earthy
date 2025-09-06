import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', component: () => import('../views/Bookings/List.vue') },
  { path: '/bookings/new', component: () => import('../views/Bookings/New.vue') },
  { path: '/properties', component: () => import('../views/Properties/List.vue') }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
