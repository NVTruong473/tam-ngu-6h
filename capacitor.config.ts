import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nvtruong.tamngu6h',
  appName: 'Tam Ngữ 6H',
  webDir: 'dist/client',
  // Ship the reviewed offline bundle inside the native app.  `server.url` is
  // deliberately omitted: loading a remote website here would turn the app
  // into a fragile web wrapper and would make App Store review harder.
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  plugins: {
    LocalNotifications: {
      // iOS owns the banner layout.  We keep lessons quiet by default, while
      // still placing them in Notification Center and on the Lock Screen.
      presentationOptions: ['badge', 'list'],
      smallIcon: 'ic_stat_tam_ngu',
      iconColor: '#D26080',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'list'],
    },
  },
};

export default config;
