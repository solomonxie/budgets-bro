# Lock

```
LockScreen.tsx  (exports LockGate — mounted last in App.tsx)
┌───────────────────────────────┐
│ Modal (fullScreen, no animation)│  covers the navigator *and* any Modal
│                                  │  already presented over it
├───────────────────────────────┤
│ locked + passcode mode          │──→ ../../components/ui/PasscodeEntry.tsx
│ locked + biometric mode         │──→ inline; prompts on mount, button to
│                                  │    retry (secure/appLock.ts)
│ covered only (not frontmost)     │──→ inline; app name, nothing to answer
└───────────────────────────────┘
```

- State comes from `hooks/useAppLock.ts`: `locked` (prove who you are) and
  `covered` (app isn't frontmost — this is the app-switcher snapshot).
- One minute of grace: coming straight back doesn't ask again.
- Mode lives in `app_settings` (`app_lock_mode`); the passcode and the
  biometric marker live in the Keychain (`secure/appLock.ts`), device-only
  and out of every backup.
