import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/ui';
import { palette } from '@/theme';

/**
 * Email/password signup is removed in v1 (social-only). This route exists only
 * to redirect deep links and old navigation paths to the social login screen.
 */
export default function RegisterEmailRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(auth)/login');
  }, [router]);
  return (
    <Screen background={palette.bg} bottomInset={0}>
      <View />
    </Screen>
  );
}
