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
  background: '#0B0D12',
  surface: '#151922',
  surfaceElevated: '#1C2230',
  border: '#2A3142',
  text: '#F4F6FB',
  textMuted: '#9AA3B5',
  accent: '#6EE7A0',
  accentDim: '#164A32',
  danger: '#F07167',
  overlay: 'rgba(0, 0, 0, 0.55)',
  playerBg: '#000000',
  inputBackground: '#1C2230',
};

export const LightColors: ThemeColors = {
  background: '#F4F6FB',
  surface: '#FFFFFF',
  surfaceElevated: '#EEF1F7',
  border: '#D5DAE6',
  text: '#12141A',
  textMuted: '#5B6475',
  accent: '#0F8A4B',
  accentDim: '#D6F5E4',
  danger: '#C0392B',
  overlay: 'rgba(0, 0, 0, 0.45)',
  playerBg: '#000000',
  inputBackground: '#EEF1F7',
};

/** @deprecated Use useColors() so light and dark both work. */
export const Colors = DarkColors;
