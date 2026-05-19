import { useColorScheme as useRNColorScheme } from 'react-native';

export type AppColorScheme = 'light' | 'dark';

export function useColorScheme(): AppColorScheme {
  const colorScheme = useRNColorScheme();

  return colorScheme === 'dark' ? 'dark' : 'light';
}
