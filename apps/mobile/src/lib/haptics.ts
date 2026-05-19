import * as Haptics from 'expo-haptics';

/**
 * Thin haptics wrapper. No-ops off iOS so screens can call it
 * unconditionally. Use `tap()` on primary CTAs, `select()` on
 * choice chips/toggles, `success()` after completing a flow.
 */
const isIOS = process.env.EXPO_OS === 'ios';

export const haptics = {
  tap: () => isIOS && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  select: () => isIOS && Haptics.selectionAsync(),
  success: () => isIOS && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
};
