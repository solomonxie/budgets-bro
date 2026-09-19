import { createContext, useContext, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// ~9 rows tall. Unfolded in place there's no sheet fighting for the screen,
// so the list can run long — what it pushes below the fold (the pad, Save)
// isn't in use while you're picking.
const PANEL_MAX_HEIGHT = 9 * 54;

// The option rows carry 4pt of their own (DropdownField,
// SearchableDropdownField); the panel adds the rest, so their text lines up
// with the label of the row they unfolded from and the hairlines run the
// full width of the card rather than a narrow box inside it.
const OPTION_ROW_PADDING = 4;

interface GroupApi {
  openId: string | null;
  toggle: (id: string) => void;
  close: () => void;
}

const GroupContext = createContext<GroupApi | null>(null);

// Wrap a form whose pickers should open in place: the options unfold under
// the row that owns them and push the rest of the form down, rather than a
// sheet floating over the page you were reading (the form stays visible, and
// there is no modal transition between "what I typed" and "what I'm
// picking"). One at a time — opening a row collapses whichever was open.
export function ExpandingFieldGroup({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const api = useMemo<GroupApi>(
    () => ({
      openId,
      toggle: (id) => setOpenId((current) => (current === id ? null : id)),
      close: () => setOpenId(null),
    }),
    [openId],
  );
  return <GroupContext.Provider value={api}>{children}</GroupContext.Provider>;
}

// Null outside a group — a picker with no group above it keeps its modal.
export function useExpandingField() {
  const group = useContext(GroupContext);
  const id = useId();
  if (!group) return null;
  return {
    expanded: group.openId === id,
    toggle: () => group.toggle(id),
    close: group.close,
  };
}

interface ExpandedPanelProps {
  children: ReactNode;
  // Pinned above the scrollable list — a search box. Full-bleed: it spans
  // the card edge to edge like the row it unfolded from, so it brings its
  // own horizontal padding.
  sticky?: ReactNode;
  // Off for content that owns its own vertical gesture (a date spinner),
  // which would otherwise fight the list's scroll.
  scroll?: boolean;
}

// The unfolded content, recessed into the row it belongs to.
export function ExpandedPanel({
  children,
  sticky,
  scroll = true,
}: ExpandedPanelProps) {
  return (
    <View style={styles.panel}>
      {sticky ?? null}
      {scroll ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.block}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.background, paddingBottom: spacing.xs },
  block: { paddingHorizontal: spacing.md },
  list: { maxHeight: PANEL_MAX_HEIGHT },
  listContent: {
    paddingHorizontal: spacing.md - OPTION_ROW_PADDING,
    paddingBottom: spacing.xs,
  },
});
