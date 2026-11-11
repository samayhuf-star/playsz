import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import { IapProvider } from '@/providers/iap-provider';
import { useColorSchemeName, useColors, useNavTheme } from '@/theme';

export default function RootLayout() {
  const colors = useColors();
  const navTheme = useNavTheme();
  const scheme = useColorSchemeName();

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.background }]}>
      <ThemeProvider value={navTheme}>
        <IapProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerTintColor: colors.text,
            headerStyle: { backgroundColor: colors.background },
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.background },
            animation: 'fade',
          }}
        >
          <Stack.Screen
            name="index"
            options={{ headerShown: false, title: 'Playsz' }}
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
            options={{ headerShown: false, title: 'Playsz Pro', presentation: 'modal' }}
          />
          <Stack.Screen
            name="settings"
            options={{ headerShown: false, title: 'Settings' }}
          />
          <Stack.Screen
            name="private-folder"
            options={{ headerShown: false, title: 'Private folder' }}
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
  },
});
