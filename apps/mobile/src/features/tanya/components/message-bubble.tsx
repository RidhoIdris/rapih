import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Text } from '@/components/ui';
import { palette, tint } from '@/theme';

type Props = {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
};

export function MessageBubble({ role, content, streaming }: Props) {
  const isUser = role === 'user';
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!streaming) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.2, duration: 500, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [streaming, blink]);

  return (
    <View
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        backgroundColor: isUser ? tint.iris : palette.card,
        borderRadius: 18,
        borderCurve: 'continuous',
        ...(isUser ? { borderTopRightRadius: 6 } : { borderTopLeftRadius: 6 }),
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginVertical: 2,
      }}>
      <Text
        variant="body"
        color={isUser ? tint.irisInk : palette.ink}
        style={{ fontSize: 14, lineHeight: 20 }}>
        {content}
        {streaming ? (
          <Animated.Text style={{ opacity: blink, color: palette.inkSoft }}> ▍</Animated.Text>
        ) : null}
      </Text>
    </View>
  );
}
