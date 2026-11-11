import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme } from 'expo-router';

import { DarkColors, LightColors, type ThemeColors } from '@/constants/colors';

export function useColorSchemeName(): 'light' | 'dark' {
  return useColorScheme() === 'light' ? 'light' : 'dark';
}

export function useColors(): ThemeColors {
  return useColorSchemeName() === 'light' ? LightColors : DarkColors;
}

export function useNavTheme(): typeof DarkTheme {
  const scheme = useColorSchemeName();
  const colors = useColors();
  const base = scheme === 'light' ? DefaultTheme : DarkTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.background,
      primary: colors.accent,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };
}

export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [colors, factory]);
}
