import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';

import App from './App.vue';
import router from './router';

// PrimeVue v4
import PrimeVue from 'primevue/config';   // ⚡ 要 import PrimeVue
import Aura from '@primevue/themes/aura'; // 或 Lara preset
import 'primeicons/primeicons.css';

const app = createApp(App);

// app.use(PrimeVue);
app.use(createPinia());

// ✅ 用 preset 模式配置主题
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: 'system'
    }
  }
});


app.use(router);
app.use(ElementPlus);
app.mount('#app');
