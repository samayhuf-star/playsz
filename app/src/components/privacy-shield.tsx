import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

/** Covers the app in the app switcher and while the screen is being captured. */
export function PrivacyShield() {
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setCovered(s !== 'active'));
    return () => sub.remove();
  }, []);
  if (!covered) return null;
  return (
    <View style={styles.shield} pointerEvents="none">
      <Text style={styles.name}>Dimmer</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shield: { ...StyleSheet.absoluteFill, backgroundColor: '#0B0B0F', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  name: { color: '#6EE7B7', fontSize: 28, fontWeight: '800', letterSpacing: 1 },
});
