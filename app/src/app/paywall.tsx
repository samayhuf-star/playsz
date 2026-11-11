import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import { LEGAL_URLS, hasLegalUrl } from '@/constants/legal';
import { PLAN_COPY, PLAN_ORDER, type ProductId } from '@/constants/products';
import { useIapContext } from '@/providers/iap-provider';

const AUTO_RENEW = `Subscriptions automatically renew unless you cancel at least 24 hours before the end of the current period. Your store account will be charged for renewal within 24 hours prior to the end of the current period, at the price shown by the store at purchase. You can manage or cancel a subscription in your Google Play or Apple ID account settings. Lifetime is a one-time purchase and does not renew.`;

export default function PaywallScreen() {
  const router = useRouter();
  const iap = useIapContext();

  const openLegal = async (kind: 'terms' | 'privacy') => {
    const url = LEGAL_URLS[kind];
    if (!url) {
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
        <Text style={styles.topTitle}>Playsz Pro</Text>
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
          <View style={styles.unlocked}>
            <Text style={styles.unlockedTitle}>Pro is active on this device</Text>
            <Text style={styles.unlockedBody}>
              {iap.entitlement.productId
                ? `Current plan: ${PLAN_COPY[iap.entitlement.productId].title}.`
                : 'Your entitlement is saved on this device.'}
            </Text>
          </View>
        ) : null}

        {!iap.anyPriceLoaded ? (
          <View style={styles.unavailable}>
            <Text style={styles.unavailableTitle}>Prices unavailable</Text>
            <Text style={styles.unavailableBody}>
              The store did not return any products. Plans will show here once
              this device can reach Google Play or the App Store and the Pro
              products exist in the store consoles. Nothing will be charged
              until a real store price is shown.
            </Text>
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
                onPress={() => iap.setSelectedId(id)}
                style={[styles.plan, selected && styles.planSelected]}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planTitle}>{copy.title}</Text>
                  {copy.badge ? (
                    <Text style={styles.badge}>{copy.badge}</Text>
                  ) : null}
                </View>
                <Text style={styles.planPrice}>
                  {available && price ? price : 'Unavailable from the store'}
                </Text>
                <Text style={styles.planPeriod}>{copy.period}</Text>
              </Pressable>
            );
          })}
        </View>

        {iap.message ? <Text style={styles.message}>{iap.message}</Text> : null}

        <Pressable
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
                ? 'Working…'
                : iap.productAvailable(iap.selectedId)
                  ? `Continue with ${PLAN_COPY[iap.selectedId].title}`
                  : 'Selected plan unavailable'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.secondary}
          disabled={iap.busy}
          onPress={() => void iap.restore()}
        >
          <Text style={styles.secondaryLabel}>Restore purchases</Text>
        </Pressable>

        <Text style={styles.disclosure}>{AUTO_RENEW}</Text>

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
        ) : (
          <Text style={styles.legalMissing}>
            Terms and Privacy links will appear here once their live URLs are
            set in the app config. They are required before QA and store
            submit, and are not pointed at a placeholder host.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  close: { color: Colors.accent, fontWeight: '700', width: 64 },
  closeSpacer: { width: 64 },
  topTitle: {
    flex: 1,
    color: Colors.text,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  hero: { color: Colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  lead: { color: Colors.textMuted, fontSize: 15, lineHeight: 22 },
  unlocked: {
    backgroundColor: Colors.accentDim,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  unlockedTitle: { color: Colors.accent, fontWeight: '800' },
  unlockedBody: { color: Colors.text, fontSize: 13 },
  unavailable: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  unavailableTitle: { color: Colors.text, fontWeight: '800' },
  unavailableBody: { color: Colors.textMuted, fontSize: 13, lineHeight: 20 },
  plans: { gap: 10 },
  plan: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  planSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.surfaceElevated,
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', flex: 1 },
  badge: {
    color: Colors.accentDim,
    backgroundColor: Colors.accent,
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '800',
  },
  planPrice: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  planPeriod: { color: Colors.textMuted, fontSize: 13 },
  message: { color: Colors.danger, fontSize: 14, lineHeight: 20 },
  cta: {
    backgroundColor: Colors.accent,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaLabel: { color: Colors.accentDim, fontWeight: '800', fontSize: 16 },
  secondary: { alignItems: 'center', paddingVertical: 8 },
  secondaryLabel: { color: Colors.accent, fontWeight: '700', fontSize: 15 },
  disclosure: { color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, alignItems: 'center' },
  legalLink: { color: Colors.accent, fontWeight: '700', fontSize: 14 },
  legalDot: { color: Colors.textMuted },
  legalMissing: { color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
});
