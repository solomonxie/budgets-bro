import { AppRegistry } from 'react-native';

import App from './App';

// "main" is the module name iOS asks for — see `startReactNative(
// withModuleName:)` in ios/BudgetsBro/AppDelegate.swift. Expo's
// registerRootComponent used to do this registration for us.
AppRegistry.registerComponent('main', () => App);
