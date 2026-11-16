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
  background: '#0E0B1F',
  surface: '#171330',
  surfaceElevated: '#211B42',
  border: '#352C63',
  text: '#F4F6FB',
  textMuted: '#9AA3B5',
  accent: '#F5B544',
  accentDim: '#3D2D0E',
  danger: '#F07167',
  overlay: 'rgba(0, 0, 0, 0.55)',
  playerBg: '#000000',
  inputBackground: '#211B42',
};

export const LightColors: ThemeColors = {
  background: '#F6F3FF',
  surface: '#FFFFFF',
  surfaceElevated: '#ECE7FA',
  border: '#D8D0F0',
  text: '#12141A',
  textMuted: '#5B6475',
  accent: '#B3650A',
  accentDim: '#FBE9CC',
  danger: '#C0392B',
  overlay: 'rgba(0, 0, 0, 0.45)',
  playerBg: '#000000',
  inputBackground: '#ECE7FA',
};

/** @deprecated Use useColors() so light and dark both work. */
export const Colors = DarkColors;
