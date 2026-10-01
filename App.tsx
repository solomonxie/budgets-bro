import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LockGate } from './src/screens/lock/LockScreen';
import { isDemoMode } from './src/db/client';
import { useAppStore } from './src/state/useAppStore';

export default function App() {
  const demoMode = useAppStore((s) => s.demoMode);
  const setDemoModeFlag = useAppStore((s) => s.setDemoModeFlag);
  useEffect(() => {
    isDemoMode().then(setDemoModeFlag);
  }, [setDemoModeFlag]);
  return (
    <>
      {/* Keyed: switching demo mode swaps the database, so start over. */}
      <RootNavigator key={demoMode ? 'demo' : 'real'} />
      {/* Last child, so it covers the navigator and every modal over it. */}
      <LockGate />
      <StatusBar barStyle="light-content" />
    </>
  );
}
