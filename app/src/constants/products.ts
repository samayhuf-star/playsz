/** Store product ids from docs/PAYWALL_PLAN.md. Must match Play Console and App Store Connect. */
export const PRODUCT_IDS = {
  // Offered plan (17 Nov 2026): weekly $1.99 with a 7-day free trial. Create it in App Store Connect and Play Console.
  weekly: 'playsz_pro_weekly',
  // Retired from the paywall; still recognised so existing buyers keep Pro.
  monthly: 'playsz_pro_monthly',
  yearly: 'playsz_pro_yearly',
  lifetime: 'playsz_pro_lifetime',
} as const;

export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];

/** The only plan shown on the paywall and loaded from the store catalog. */
export const OFFERED_IDS: ProductId[] = [PRODUCT_IDS.weekly];
export const FREE_TRIAL_DAYS = 7;

export const SUBSCRIPTION_IDS: ProductId[] = [
  PRODUCT_IDS.weekly,
  PRODUCT_IDS.monthly,
  PRODUCT_IDS.yearly,
];

export const ALL_PRODUCT_IDS: ProductId[] = [
  PRODUCT_IDS.weekly,
  PRODUCT_IDS.monthly,
  PRODUCT_IDS.yearly,
  PRODUCT_IDS.lifetime,
];

export const FREE_EXPORTS_PER_DAY = 3;
export const FREE_PRIVATE_FOLDER_ITEMS = 10;

export const PLAN_ORDER: ProductId[] = [PRODUCT_IDS.weekly];

export const PLAN_COPY: Record<
  ProductId,
  { title: string; period: string; badge?: string }
> = {
  [PRODUCT_IDS.weekly]: {
    title: 'Weekly',
    period: '7 days free, then per week, auto-renews',
    badge: '7 days free',
  },
  [PRODUCT_IDS.yearly]: {
    title: 'Yearly',
    period: 'per year, auto-renews',
    badge: 'Most popular',
  },
  [PRODUCT_IDS.lifetime]: {
    title: 'Lifetime',
    period: 'one-time purchase',
    badge: 'Best value',
  },
  [PRODUCT_IDS.monthly]: {
    title: 'Monthly',
    period: 'per month, auto-renews',
  },
};
