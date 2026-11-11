import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ThemeColors } from '@/constants/colors';
import { useColors, useThemedStyles } from '@/theme';

type Props = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  requireConfirm?: boolean;
  onCancel: () => void;
  onSubmit: (password: string) => void;
};

export function PasswordModal({
  visible,
  title,
  body,
  confirmLabel,
  requireConfirm = false,
  onCancel,
  onSubmit,
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!password) {
      setError('Enter a password.');
      return;
    }
    if (requireConfirm && password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    onSubmit(password);
    setPassword('');
    setConfirm('');
    setError(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          {requireConfirm ? (
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <Pressable onPress={onCancel} style={styles.secondary}>
              <Text style={styles.secondaryLabel}>Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} style={styles.cta}>
              <Text style={styles.ctaLabel}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      gap: 10,
    },
    title: { color: c.text, fontSize: 18, fontWeight: '800' },
    body: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.inputBackground,
      color: c.text,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    error: { color: c.danger, fontSize: 13 },
    row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
    secondary: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    secondaryLabel: { color: c.text, fontWeight: '700' },
    cta: {
      backgroundColor: c.accent,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    ctaLabel: { color: c.accentDim, fontWeight: '800' },
  });
