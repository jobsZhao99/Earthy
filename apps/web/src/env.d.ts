/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE: string;
    // 你可以在这里添加其他 VITE_ 开头的环境变量类型
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  