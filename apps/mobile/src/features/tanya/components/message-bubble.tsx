import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Icon } from '@/components/icons/icon';
import { Text } from '@/components/ui';
import { palette } from '@/theme';

type Props = {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  /** First mount animates in; re-renders (streaming tokens) must not. */
  animate?: boolean;
};

/** Moss avatar with the Rapih sparkle — sits beside every assistant message. */
export function AiAvatar({ size = 30 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: palette.moss,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name="sparkle" size={size * 0.46} color={palette.lime} />
    </View>
  );
}

/** Render lightweight inline **bold** so figures like **Rp 482rb** stand out. */
function renderRich(content: string, color: string): ReactNode {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: static split, stable order
        <Text key={i} variant="body" color={color} style={{ fontSize: 15, fontWeight: '700' }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return part;
  });
}

export function MessageBubble({ role, content, streaming, animate = true }: Props) {
  const isUser = role === 'user';
  const entering = animate ? FadeInDown.springify().damping(16).stiffness(170).mass(0.5) : undefined;

  if (isUser) {
    return (
      <Animated.View
        entering={entering}
        layout={LinearTransition.springify().damping(18)}
        style={{ alignSelf: 'flex-end', maxWidth: '82%', marginVertical: 4 }}>
        <View
          style={{
            backgroundColor: palette.lime,
            borderRadius: 20,
            borderTopRightRadius: 7,
            borderCurve: 'continuous',
            paddingVertical: 11,
            paddingHorizontal: 15,
          }}>
          <Text variant="body" color={palette.moss} style={{ fontSize: 15, lineHeight: 21 }}>
            {content}
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={entering}
      layout={LinearTransition.springify().damping(18)}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        alignSelf: 'flex-start',
        maxWidth: '90%',
        marginVertical: 4,
      }}>
      <AiAvatar />
      <View
        style={{
          flex: 1,
          backgroundColor: palette.card,
          borderRadius: 20,
          borderTopLeftRadius: 7,
          borderCurve: 'continuous',
          paddingVertical: 11,
          paddingHorizontal: 15,
          boxShadow: `0 2px 10px rgba(10,10,14,0.04), 0 0 0 1px ${palette.inkFaint}`,
        }}>
        <Text variant="body" color={palette.ink} style={{ fontSize: 15, lineHeight: 22 }}>
          {renderRich(content, palette.ink)}
          {streaming ? (
            <Text variant="body" color={palette.inkMute} style={{ fontSize: 15 }}>
              {' ▍'}
            </Text>
          ) : null}
        </Text>
      </View>
    </Animated.View>
  );
}
