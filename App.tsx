import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LockGate } from './src/screens/lock/LockScreen';
import { isDemoMode } from './src/db/client';
import { useAppStore } from './src/state/useAppStore';
import { openScreenshot, prepareScreenshot } from './src/demo/screenshot';

export default function App({ screen, lang }: { screen?: string; lang?: string }) {
  const setDemoModeFlag = useAppStore((s) => s.setDemoModeFlag);
  useEffect(() => {
    isDemoMode().then(setDemoModeFlag);
  }, [setDemoModeFlag]);
  useEffect(() => {
    if (screen) prepareScreenshot(lang).then(() => openScreenshot(screen));
  }, [screen, lang]);
  return (
    <>
      <RootNavigator />
      {/* Last child, so it covers the navigator and every modal over it. */}
      <LockGate />
      <StatusBar barStyle="light-content" />
    </>
  );
}
