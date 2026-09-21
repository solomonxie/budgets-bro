import { StatusBar } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LockGate } from './src/screens/lock/LockScreen';

export default function App() {
  return (
    <>
      <RootNavigator />
      {/* Last child, so it covers the navigator and every modal over it. */}
      <LockGate />
      <StatusBar barStyle="light-content" />
    </>
  );
}
