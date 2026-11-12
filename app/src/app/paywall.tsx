import { useEffect } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ThemeColors } from '@/constants/colors';
import { LEGAL_URLS, PENDING_HOSTING, hasLegalUrl } from '@/constants/legal';
import { PLAN_COPY, PLAN_ORDER, type ProductId } from '@/constants/products';
import { useIapContext } from '@/providers/iap-provider';
import { useColorSchemeName, useThemedStyles } from '@/theme';

const AUTO_RENEW_IOS = `Subscriptions automatically renew unless you cancel at least 24 hours before the end of the current period. Your Apple ID account will be charged for renewal within 24 hours prior to the end of the current period, at the price shown by the App Store at purchase. You can manage or cancel a subscription in your Apple ID account settings. Lifetime is a one-time purchase and does not renew.`;

const AUTO_RENEW_ANDROID = `Subscriptions automatically renew unless you cancel at least 24 hours before the end of the current period. Your Google Play account will be charged for renewal within 24 hours prior to the end of the current period, at the price shown by Google Play at purchase. You can manage or cancel a subscription in your Google Play account settings. Lifetime is a one-time purchase and does not renew.`;

const PRICES_UNAVAILABLE_IOS =
  'The App Store did not return prices for these plans. Check your connection, then tap Retry. Nothing will be charged until a real store price is shown.';

const PRICES_UNAVAILABLE_ANDROID =
  'Google Play did not return prices for these plans. Check your connection, then tap Retry. Nothing will be charged until a real store price is shown.';

export default function PaywallScreen() {
  const router = useRouter();
  const iap = useIapContext();
  const { refreshProducts } = iap;
  const scheme = useColorSchemeName();
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    void refreshProducts();
  }, [refreshProducts]);

  const openLegal = async (kind: 'terms' | 'privacy') => {
    const url = LEGAL_URLS[kind];
    if (!url) {
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']} testID="paywall-screen">
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={styles.topBar}>
        <Pressable testID="paywall-close" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
        <Text style={styles.topTitle} testID="paywall-title">Playsz Pro</Text>
        <View style={styles.closeSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hero}>Unlock the rest of the extras</Text>
        <Text style={styles.lead}>
          The player stays free. Pro lifts the caps on exports and the private
          folder, and unlocks the local encrypted export. There are no ads in
          any plan.
        </Text>

        {iap.isPro ? (
          <View style={styles.unlocked} testID="paywall-unlocked">
            <Text style={styles.unlockedTitle}>Pro is active on this device</Text>
            <Text style={styles.unlockedBody}>
              {iap.entitlement.productId
                ? `Current plan: ${PLAN_COPY[iap.entitlement.productId].title}.`
                : 'Your entitlement is saved on this device.'}
            </Text>
          </View>
        ) : null}

        {!iap.anyPriceLoaded ? (
          <View style={styles.unavailable} testID="paywall-prices-unavailable">
            <Text style={styles.unavailableTitle}>Prices unavailable</Text>
            <Text style={styles.unavailableBody}>
              {Platform.OS === 'ios' ? PRICES_UNAVAILABLE_IOS : PRICES_UNAVAILABLE_ANDROID}
            </Text>
            <Pressable
              testID="paywall-retry"
              style={styles.retry}
              disabled={iap.catalogBusy}
              onPress={() => void iap.refreshProducts()}
            >
              <Text style={styles.retryLabel}>{iap.catalogBusy ? 'Loading prices' : 'Retry'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.plans}>
          {PLAN_ORDER.map((id: ProductId) => {
            const copy = PLAN_COPY[id];
            const price = iap.priceLabel(id);
            const selected = iap.selectedId === id;
            const available = iap.productAvailable(id);
            return (
              <Pressable
                key={id}
                testID={`paywall-plan-${id}`}
                onPress={() => iap.setSelectedId(id)}
                style={[styles.plan, selected && styles.planSelected]}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planTitle}>{copy.title}</Text>
                  {copy.badge ? (
                    <Text style={styles.badge}>{copy.badge}</Text>
                  ) : null}
                </View>
                <Text style={styles.planPrice} testID={`paywall-price-${id}`}>
                  {available && price ? price : 'Unavailable from the store'}
                </Text>
                <Text style={styles.planPeriod}>{copy.period}</Text>
              </Pressable>
            );
          })}
        </View>

        {iap.message ? <Text style={styles.message} testID="paywall-message">{iap.message}</Text> : null}

        <Pressable
          testID="paywall-buy"
          style={[
            styles.cta,
            (iap.busy || iap.isPro || !iap.productAvailable(iap.selectedId)) &&
              styles.ctaDisabled,
          ]}
          disabled={iap.busy || iap.isPro || !iap.productAvailable(iap.selectedId)}
          onPress={() => void iap.buy()}
        >
          <Text style={styles.ctaLabel}>
            {iap.isPro
              ? 'Already unlocked'
              : iap.busy
                ? 'Working'
                : iap.productAvailable(iap.selectedId)
                  ? `Continue with ${PLAN_COPY[iap.selectedId].title}`
                  : 'Selected plan unavailable'}
          </Text>
        </Pressable>

        <Pressable
          testID="paywall-restore"
          style={styles.secondary}
          disabled={iap.busy}
          onPress={() => void iap.restore()}
        >
          <Text style={styles.secondaryLabel}>Restore purchases</Text>
        </Pressable>

        <Text style={styles.disclosure}>{Platform.OS === 'ios' ? AUTO_RENEW_IOS : AUTO_RENEW_ANDROID}</Text>

        {hasLegalUrl('terms') || hasLegalUrl('privacy') ? (
          <View style={styles.legalRow}>
            {hasLegalUrl('terms') ? (
              <Pressable onPress={() => void openLegal('terms')}>
                <Text style={styles.legalLink}>Terms</Text>
              </Pressable>
            ) : null}
            {hasLegalUrl('terms') && hasLegalUrl('privacy') ? (
              <Text style={styles.legalDot}>·</Text>
            ) : null}
            {hasLegalUrl('privacy') ? (
              <Pressable onPress={() => void openLegal('privacy')}>
                <Text style={styles.legalLink}>Privacy</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {PENDING_HOSTING && (hasLegalUrl('terms') || hasLegalUrl('privacy')) ? (
          <Text style={styles.legalMissing}>
            These Terms and Privacy links use the planned GitHub Pages URLs
            and will 404 until the legal site is hosted.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  close: { color: c.accent, fontWeight: '700', width: 64 },
  closeSpacer: { width: 64 },
  topTitle: {
    flex: 1,
    color: c.text,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  hero: { color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  lead: { color: c.textMuted, fontSize: 15, lineHeight: 22 },
  unlocked: {
    backgroundColor: c.accentDim,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  unlockedTitle: { color: c.accent, fontWeight: '800' },
  unlockedBody: { color: c.text, fontSize: 13 },
  unavailable: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  unavailableTitle: { color: c.text, fontWeight: '800' },
  unavailableBody: { color: c.textMuted, fontSize: 13, lineHeight: 20 },
  retry: { alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 8 },
  retryLabel: { color: c.accent, fontWeight: '700', fontSize: 15 },
  plans: { gap: 10 },
  plan: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  planSelected: {
    borderColor: c.accent,
    backgroundColor: c.surfaceElevated,
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planTitle: { color: c.text, fontSize: 18, fontWeight: '700', flex: 1 },
  badge: {
    color: c.accentDim,
    backgroundColor: c.accent,
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '800',
  },
  planPrice: { color: c.text, fontSize: 20, fontWeight: '800' },
  planPeriod: { color: c.textMuted, fontSize: 13 },
  message: { color: c.danger, fontSize: 14, lineHeight: 20 },
  cta: {
    backgroundColor: c.accent,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaLabel: { color: c.accentDim, fontWeight: '800', fontSize: 16 },
  secondary: { alignItems: 'center', paddingVertical: 8 },
  secondaryLabel: { color: c.accent, fontWeight: '700', fontSize: 15 },
  disclosure: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, alignItems: 'center' },
  legalLink: { color: c.accent, fontWeight: '700', fontSize: 14 },
  legalDot: { color: c.textMuted },
  legalMissing: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
});
