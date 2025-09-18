import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  // { path: '/', component: () => import('../views/Bookings/BookingRecords/BookingRecordList.vue') },
  { path: '/booking', component: () => import('../views/Booking/BookingList.vue') },
  { path: '/booking/:id', name: 'BookingDetail', component: () => import('../views/Booking/BookingDetail.vue') },

  // { path: '/booking/:id', name: 'BookingDetail', component: () => import('../views/Bookings/BookingRecords/BookingRecordDetails.vue') },
  // { path: '/bookings/new', component: () => import('../views/Bookings/BookingRecords/BookingRecordEdit.vue') },
  // { path: '/bookings/:id/edit', component: () => import('../views/Bookings/BookingRecords/BookingRecordEdit.vue') },
  { path: '/properties', component: () => import('../views/Properties/PropertyList.vue') },
  { path: '/properties/:id', component: () => import('../views/Properties/PropertyDetail.vue') },
  { path: '/guests', component: () => import('../views/Guests/GuestList.vue') },
  { path: '/guests/:id', component: () => import('../views/Guests/GuestDetail.vue') },
  { path: '/report', component: () => import('../views/Report/Report.vue') },
  { path: '/property-report', component: () => import('../views/Report/ReportProperties.vue') },
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
    path: '/rooms/:id',
    component: () => import('../views/Rooms/RoomDetail.vue')
  },
  {
    path: '/rooms/:id/edit',
    component: () => import('../views/Rooms/RoomEdit.vue')
  },
  { path: '/ExampleRoomMap', component: () => import('../views/Properties/ExampleRoomMap.vue') },
  { path: '/settings', component: () => import('../views/System/Settings.vue') },

];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
