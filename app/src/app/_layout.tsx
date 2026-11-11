import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/colors';
import { IapProvider } from '@/providers/iap-provider';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.background,
    card: Colors.background,
    primary: Colors.accent,
    text: Colors.text,
    border: Colors.border,
    notification: Colors.accent,
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={navTheme}>
        <IapProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerTintColor: Colors.text,
            headerStyle: { backgroundColor: Colors.background },
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: Colors.background },
            animation: 'fade',
          }}
        >
          <Stack.Screen
            name="index"
            options={{ headerShown: false, title: 'OpenPlay' }}
          />
          <Stack.Screen
            name="player"
            options={{
              headerShown: false,
              title: 'Player',
              animation: 'fade',
              navigationBarHidden: true,
              statusBarHidden: true,
            }}
          />
          <Stack.Screen
            name="paywall"
            options={{ headerShown: false, title: 'OpenPlay Pro', presentation: 'modal' }}
          />
          <Stack.Screen
            name="settings"
            options={{ headerShown: false, title: 'Settings' }}
          />
        </Stack>
        </IapProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
