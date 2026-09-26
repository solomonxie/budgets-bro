import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';

// Long enough that a tap or a scroll never lifts a row by accident.
const HOLD_MS = 350;
const SLOP = 6;
const SETTLE_MS = 120;

interface Drag {
  key: number;
  from: number;
  height: number;
}

// A column of rows that opens on tap and reorders on hold-and-drag. Same
// raw-responder shape as chartScrub: a finger that moves before the hold
// lands is a scroll, one that stays put lifts the row, and from then on
// the scroll is refused the gesture (the caller turns its ScrollView off
// through `onDragChange`) until the finger lifts.
export function DraggableList<T>({
  items,
  keyOf,
  renderItem,
  onPress,
  onReorder,
  onDragChange,
  gap,
}: {
  items: T[];
  keyOf: (item: T) => number;
  renderItem: (item: T, pressed: boolean) => ReactNode;
  onPress: (item: T) => void;
  onReorder: (items: T[]) => void;
  onDragChange: (dragging: boolean) => void;
  gap: number;
}) {
  // Shows the dropped order at once, before the write comes back as new
  // `items`.
  const [order, setOrder] = useState(items);
  const [source, setSource] = useState(items);
  if (items !== source) {
    setSource(items);
    setOrder(items);
  }
  const [pressedKey, setPressedKey] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [target, setTarget] = useState(0);
  const [dragY] = useState(() => new Animated.Value(0));
  // Only ever touched inside the handlers below, never during render.
  const layouts = useRef(new Map<number, { y: number; height: number }>());
  const gesture = useRef({
    holdTimer: null as ReturnType<typeof setTimeout> | null,
    dragging: false,
    settling: false,
    moved: false,
    startY: 0,
    startX: 0,
    target: 0,
  });

  const cancelHold = () => {
    const g = gesture.current;
    if (g.holdTimer) clearTimeout(g.holdTimer);
    g.holdTimer = null;
  };

  const targetFor = (from: number, dy: number) => {
    const own = layouts.current.get(keyOf(order[from]));
    if (!own) return from;
    const center = own.y + own.height / 2 + dy;
    let index = 0;
    order.forEach((item, i) => {
      const l = layouts.current.get(keyOf(item));
      if (i !== from && l && l.y + l.height / 2 < center) index++;
    });
    return index;
  };

  // How far the lifted row travels to sit in its new slot.
  const offsetTo = (from: number, to: number) => {
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    let total = 0;
    for (let i = lo; i <= hi; i++) {
      if (i === from) continue;
      total += (layouts.current.get(keyOf(order[i]))?.height ?? 0) + gap;
    }
    return to > from ? total : -total;
  };

  const finishDrag = (from: number, to: number) => {
    const g = gesture.current;
    g.dragging = false;
    g.settling = true;
    Animated.timing(dragY, {
      toValue: offsetTo(from, to),
      duration: SETTLE_MS,
      useNativeDriver: true,
    }).start(() => {
      g.settling = false;
      const next = [...order];
      next.splice(to, 0, next.splice(from, 1)[0]);
      setOrder(next);
      setDrag(null);
      onDragChange(false);
      if (to !== from) onReorder(next);
    });
  };

  const handlersFor = (item: T, index: number) => ({
    onStartShouldSetResponder: () => !gesture.current.settling,
    onResponderTerminationRequest: () => !gesture.current.dragging,
    onResponderGrant: (e: GestureResponderEvent) => {
      const g = gesture.current;
      g.startX = e.nativeEvent.pageX;
      g.startY = e.nativeEvent.pageY;
      g.moved = false;
      setPressedKey(keyOf(item));
      g.holdTimer = setTimeout(() => {
        g.holdTimer = null;
        g.dragging = true;
        g.target = index;
        dragY.setValue(0);
        setPressedKey(null);
        setTarget(index);
        setDrag({
          key: keyOf(item),
          from: index,
          height: layouts.current.get(keyOf(item))?.height ?? 0,
        });
        onDragChange(true);
      }, HOLD_MS);
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const g = gesture.current;
      const dy = e.nativeEvent.pageY - g.startY;
      if (g.dragging) {
        dragY.setValue(dy);
        const next = targetFor(index, dy);
        if (next !== g.target) {
          g.target = next;
          setTarget(next);
        }
        return;
      }
      if (
        Math.abs(e.nativeEvent.pageX - g.startX) > SLOP ||
        Math.abs(dy) > SLOP
      ) {
        g.moved = true;
        cancelHold();
        setPressedKey(null);
      }
    },
    onResponderRelease: () => {
      const g = gesture.current;
      const tapped = !g.dragging && !g.moved && g.holdTimer != null;
      cancelHold();
      setPressedKey(null);
      if (g.dragging) finishDrag(index, g.target);
      else if (tapped) onPress(item);
    },
    onResponderTerminate: () => {
      const g = gesture.current;
      cancelHold();
      setPressedKey(null);
      if (g.dragging) finishDrag(index, index);
    },
  });

  const shiftOf = (i: number) => {
    if (!drag || i === drag.from) return 0;
    const step = drag.height + gap;
    if (drag.from < target && i > drag.from && i <= target) return -step;
    if (target < drag.from && i >= target && i < drag.from) return step;
    return 0;
  };

  return (
    <View style={{ gap }}>
      {order.map((item, i) => {
        const key = keyOf(item);
        const active = drag?.key === key;
        return (
          <DraggableRow
            key={key}
            shift={shiftOf(i)}
            animate={drag != null}
            dragY={active ? dragY : null}
            onLayout={(e: LayoutChangeEvent) => {
              const { y, height } = e.nativeEvent.layout;
              layouts.current.set(key, { y, height });
            }}
            onPress={() => onPress(item)}
            handlers={handlersFor(item, i)}
          >
            {renderItem(item, pressedKey === key)}
          </DraggableRow>
        );
      })}
    </View>
  );
}

function DraggableRow({
  shift,
  animate,
  dragY,
  onLayout,
  onPress,
  handlers,
  children,
}: {
  shift: number;
  animate: boolean;
  dragY: Animated.Value | null;
  onLayout: (e: LayoutChangeEvent) => void;
  onPress: () => void;
  handlers: object;
  children: ReactNode;
}) {
  const [offset] = useState(() => new Animated.Value(0));
  // Rows make way while a drag is on; on drop they snap straight back in
  // the same frame the new order lands, so nothing jumps twice.
  useLayoutEffect(() => {
    if (animate) {
      Animated.timing(offset, {
        toValue: shift,
        duration: SETTLE_MS,
        useNativeDriver: true,
      }).start();
    } else {
      offset.setValue(shift);
    }
  }, [offset, shift, animate]);

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        { transform: [{ translateY: dragY ?? offset }] },
        dragY && styles.lifted,
      ]}
      accessible
      accessibilityRole="button"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={onPress}
      {...handlers}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lifted: {
    zIndex: 1,
    opacity: 0.95,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
