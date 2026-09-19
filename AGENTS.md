# React Native, bare

No Expo. Not the Expo SDK, not Expo Go, not a dev server — see
[`docs/DESIGN.md`](docs/DESIGN.md#no-expo-go-no-dev-server). If a fix seems to
want an `expo-*` package, pick a community library instead.

Read the exact versioned docs at https://reactnative.dev/docs/0.86/getting-started
before writing any code.

`ios/` is a real Xcode project, edited by hand. `npm run ios` is the whole
loop: Release build straight onto the paired iPhone.

Physical iPhone only. Never build, install, or run on a simulator — the sim
build crashes on iOS 27. If the paired device isn't reachable, stop and say
so; don't fall back to a simulator.
