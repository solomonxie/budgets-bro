import { createContext, useContext } from 'react';

// Lets something dragged inside a ScreenContainer's scroll (a slider) hold
// the page still while the finger is down.
export const ScrollLockContext = createContext<(locked: boolean) => void>(
  () => {},
);

export const useScrollLock = () => useContext(ScrollLockContext);
