import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freeTrialDays, planKindForProductId, planPeriodText } from '../src/lib/intro-offer.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const weekTrial = {
  subscriptionOffers: [
    { type: 'introductory', paymentMode: 'free-trial', period: { unit: 'week', value: 1 }, periodCount: 1 },
  ],
};
const dayTrial = {
  subscriptionOffers: [
    { type: 'introductory', paymentMode: 'free-trial', period: { unit: 'day', value: 7 }, periodCount: 1 },
  ],
};
const paidIntro = {
  subscriptionOffers: [
    { type: 'introductory', paymentMode: 'pay-as-you-go', period: { unit: 'month', value: 1 }, periodCount: 3 },
  ],
};
const legacyIOS = {
  introductoryPricePaymentModeIOS: 'free-trial',
  introductoryPriceSubscriptionPeriodIOS: 'week',
  introductoryPriceNumberOfPeriodsIOS: '1',
};

describe('7-day free trial copy', () => {
  it('reads the trial length from the store offer', () => {
    assert.equal(freeTrialDays(weekTrial), 7);
    assert.equal(freeTrialDays(dayTrial), 7);
    assert.equal(freeTrialDays(legacyIOS), 7);
    assert.equal(freeTrialDays(paidIntro), null);
    assert.equal(freeTrialDays({ introductoryPricePaymentModeIOS: 'empty' }), null);
    assert.equal(freeTrialDays({}), null);
    assert.equal(freeTrialDays(null), null);
  });

  it('eligible user with a trial: "7 days free, then <price>/month" (or /year)', () => {
    assert.equal(
      planPeriodText({
        kind: 'monthly',
        currentPeriod: 'per month, auto-renews',
        price: '$2.99',
        trialDays: 7,
      }),
      '7 days free, then $2.99/month'
    );
    assert.equal(
      planPeriodText({
        kind: 'yearly',
        currentPeriod: 'per year, auto-renews',
        price: '9,99 €',
        trialDays: 7,
      }),
      '7 days free, then 9,99 €/year'
    );
  });

  it('no trial, not eligible, or missing price: the current copy stays', () => {
    assert.equal(
      planPeriodText({
        kind: 'monthly',
        currentPeriod: 'per month, auto-renews',
        price: '$2.99',
        trialDays: null,
      }),
      'per month, auto-renews'
    );
    assert.equal(
      planPeriodText({
        kind: 'yearly',
        currentPeriod: 'per year, auto-renews',
        price: '$9.99',
      }),
      'per year, auto-renews'
    );
    assert.equal(
      planPeriodText({
        kind: 'monthly',
        currentPeriod: 'per month, auto-renews',
        price: null,
        trialDays: 7,
      }),
      'per month, auto-renews'
    );
  });

  it('lifetime copy is unchanged even if a trial length is passed by mistake', () => {
    assert.equal(planKindForProductId('playsz_pro_lifetime'), 'lifetime');
    assert.equal(planKindForProductId('playsz_pro_monthly'), 'monthly');
    assert.equal(planKindForProductId('playsz_pro_yearly'), 'yearly');
    assert.equal(
      planPeriodText({
        kind: 'lifetime',
        currentPeriod: 'one-time purchase',
        price: '$29.99',
        trialDays: 7,
      }),
      'one-time purchase'
    );
  });

  it('trial days are only set when StoreKit says the user is eligible', () => {
    const src = read('src/providers/iap-provider.tsx');
    assert.match(src, /const days = daysFromOffer && \(await introEligible\(item\)\) \? daysFromOffer : null;/);
    assert.match(src, /isEligibleForIntroOfferIOS\(group\)/);
    const fn = src.slice(src.indexOf('async function introEligible'), src.indexOf('function offerTokenFor'));
    assert.match(fn, /catch[\s\S]*return false/);
    assert.match(read('src/app/paywall.tsx'), /planPeriodText\(/);
    assert.match(read('src/lib/intro-offer.ts'), /plan\.price/);
  });

  it('StoreKit test config gives monthly and yearly a 1-week free intro offer, and leaves lifetime unchanged', () => {
    const sk = JSON.parse(read('ios-storekit/Playsz.storekit'));
    const subs = sk.subscriptionGroups[0].subscriptions;
    for (const id of ['playsz_pro_monthly', 'playsz_pro_yearly']) {
      const s = subs.find((x: { productID: string }) => x.productID === id);
      assert.ok(s, id);
      assert.deepEqual(
        { mode: s.introductoryOffer.paymentMode, period: s.introductoryOffer.subscriptionPeriod },
        { mode: 'free', period: 'P1W' },
        id
      );
    }
    const lifetime = sk.products.find((x: { productID: string }) => x.productID === 'playsz_pro_lifetime');
    assert.ok(lifetime);
    assert.equal(lifetime.introductoryOffer, undefined);
    assert.equal(lifetime.type, 'NonConsumable');
  });
});
