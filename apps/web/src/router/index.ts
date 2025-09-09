import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', component: () => import('../views/Bookings/List.vue') },
  { path: '/bookings/new', component: () => import('../views/Bookings/New.vue') },
  { path: '/properties', component: () => import('../views/Properties/List.vue') },
  { path: '/properties/:id', component: () => import('../views/Properties/PropertyDetail.vue') },
  { path: '/guests/:id', component: () => import('../views/Guests/GuestDetail.vue') },
  { path: '/report', component: () => import('../views/Report/Report.vue') },
  { path: '/property-report', component: () => import('../views/Report/ReportProperties.vue') },
  // { path: '/ledgers', component: () => import('../views/Ledgers/List.vue') },
  { path: '/today-bookings', component: () => import('../views/Bookings/TodayBookings.vue') },

];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
