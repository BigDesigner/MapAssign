import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mapassign.app',
  appName: 'MapAssign',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
