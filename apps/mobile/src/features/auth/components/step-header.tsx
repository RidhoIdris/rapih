import { View } from 'react-native';

import { palette, space } from '@/theme';
import { BackButton, ProgressDots, Text } from '@/components/ui';

/**
 * Shared register-wizard header: back button · progress dots · optional
 * "Lewati" (skip). Used by all 3 signup steps.
 */
export function StepHeader({
  step,
  total = 3,
  onSkip,
}: {
  step: number;
  total?: number;
  onSkip?: () => void;
}) {
  return (
    <View
      style={{
        paddingTop: space.xl,
        paddingHorizontal: space.xl,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
      <BackButton />
      <ProgressDots step={step} total={total} />
      {onSkip ? (
        <Text variant="bodySm" color={palette.inkSoft} onPress={onSkip}>
          Lewati
        </Text>
      ) : (
        <View style={{ width: 38 }} />
      )}
    </View>
  );
}
