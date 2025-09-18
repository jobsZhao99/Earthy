import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  // { path: '/', component: () => import('../views/Bookings/BookingRecords/BookingRecordList.vue') },
  { path: '/booking', component: () => import('../views/Booking/BookingList.vue') },
  { path: '/booking/:id', name: 'BookingDetail', component: () => import('../views/Booking/BookingDetail.vue') },

  // { path: '/booking/:id', name: 'BookingDetail', component: () => import('../views/Bookings/BookingRecords/BookingRecordDetails.vue') },
  // { path: '/bookings/new', component: () => import('../views/Bookings/BookingRecords/BookingRecordEdit.vue') },
  // { path: '/bookings/:id/edit', component: () => import('../views/Bookings/BookingRecords/BookingRecordEdit.vue') },
  { path: '/property', component: () => import('../views/Property/PropertyList.vue') },
  { path: '/property/:id', component: () => import('../views/Property/PropertyDetail.vue') },
  { path: '/guest', component: () => import('../views/Guest/GuestList.vue') },
  { path: '/guest/:id', component: () => import('../views/Guest/GuestDetail.vue') },
  { path: '/report', component: () => import('../views/Report/Report.vue') },
  // { path: '/property-report', component: () => import('../views/Report/ReportProperties.vue') },
  // { path: '/ledgers', component: () => import('../views/Ledgers/List.vue') },
  // { path: '/today-bookings', component: () => import('../views/Bookings/BookingRecords/TodayBookingRecord.vue') },
  {
    path: '/search',
    component: () => import('../views/pages/Search.vue')
  },
  // {
  //   path: '/bookings/:id',
  //   name: 'BookingDetail',
  //   component: () => import('../views/Bookings/BookingRecords/BookingRecordDetails.vue'),
  // },

  {
    path: '/room/:id',
    component: () => import('../views/Room/RoomDetail.vue')
  },
  {
    path: '/room/:id/edit',
    component: () => import('../views/Room/RoomEdit.vue')
  },
  { path: '/ExampleRoomMap', component: () => import('../views/Properties/ExampleRoomMap.vue') },
  { path: '/settings', component: () => import('../views/System/Settings.vue') },

];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
