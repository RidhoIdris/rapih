import { View } from 'react-native';

import { palette } from '@/theme';

/** Step indicator — `total` bars, the first `step` filled (1-indexed). */
export function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: 18,
            height: 3,
            borderRadius: 3,
            backgroundColor: i < step ? palette.moss : palette.sandDeep,
          }}
        />
      ))}
    </View>
  );
}
