export type ThemeColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentDim: string;
  danger: string;
  overlay: string;
  playerBg: string;
  inputBackground: string;
};

export const DarkColors: ThemeColors = {
  background: '#0B0B0F',
  surface: '#14151B',
  surfaceElevated: '#1D1F27',
  border: '#2C2F3A',
  text: '#F4F6FB',
  textMuted: '#9AA3B5',
  accent: '#6EE7B7',
  accentDim: '#0F2D24',
  danger: '#F07167',
  overlay: 'rgba(0, 0, 0, 0.55)',
  playerBg: '#000000',
  inputBackground: '#1D1F27',
};

export const LightColors: ThemeColors = {
  background: '#F4F7F5',
  surface: '#FFFFFF',
  surfaceElevated: '#E4ECE8',
  border: '#CBD8D1',
  text: '#12141A',
  textMuted: '#5B6475',
  accent: '#0B7A55',
  accentDim: '#D5F2E6',
  danger: '#C0392B',
  overlay: 'rgba(0, 0, 0, 0.45)',
  playerBg: '#000000',
  inputBackground: '#E4ECE8',
};

/** @deprecated Use useColors() so light and dark both work. */
export const Colors = DarkColors;
