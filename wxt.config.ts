import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'Rasa - AI UI Customizer',
    description: 'Customize any website\'s UI through natural language commands powered by Claude AI',
    version: '1.0.0',
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png'
    },
    permissions: [
      'storage',
      'activeTab',
      'scripting',
      'sidePanel'
    ],
    host_permissions: [
      '<all_urls>'
    ],
    action: {
      default_title: 'Open Rasa UI Customizer',
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        128: 'icon/128.png'
      }
    },
    side_panel: {
      default_path: 'sidepanel.html'
    }
  }
});
