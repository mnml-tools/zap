import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// The linked @mnml-tools/ui has its own dev copy of React; dedupe keeps one React for hooks.
export default defineConfig({plugins:[react()],resolve:{dedupe:['react','react-dom','@tauri-apps/api','@tauri-apps/plugin-process','@tauri-apps/plugin-updater','lucide-react']},server:{port:1420,strictPort:true},clearScreen:false});
