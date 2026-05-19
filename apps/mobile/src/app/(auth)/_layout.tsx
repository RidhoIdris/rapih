import { Stack } from 'expo-router';

import { palette } from '@/theme';

/** Auth stack: splash → login / register wizard → done. */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
      <Stack.Screen
        name="splash"
        options={{ contentStyle: { backgroundColor: palette.moss }, gestureEnabled: false }}
      />
      <Stack.Screen name="login" options={{ contentStyle: { backgroundColor: palette.bg } }} />
      <Stack.Screen
        name="register/email"
        options={{ contentStyle: { backgroundColor: palette.bg } }}
      />
      <Stack.Screen
        name="register/name"
        options={{ contentStyle: { backgroundColor: palette.bg } }}
      />
      <Stack.Screen
        name="register/income"
        options={{ contentStyle: { backgroundColor: palette.bg } }}
      />
      <Stack.Screen
        name="done"
        options={{ contentStyle: { backgroundColor: palette.moss }, gestureEnabled: false }}
      />
    </Stack>
  );
}
