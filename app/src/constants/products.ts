/** Store product ids from docs/PAYWALL_PLAN.md. Must match Play Console and App Store Connect. */
export const PRODUCT_IDS = {
  monthly: 'openplay_pro_monthly',
  yearly: 'openplay_pro_yearly',
  lifetime: 'openplay_pro_lifetime',
} as const;

export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];

export const SUBSCRIPTION_IDS: ProductId[] = [
  PRODUCT_IDS.monthly,
  PRODUCT_IDS.yearly,
];

export const ALL_PRODUCT_IDS: ProductId[] = [
  PRODUCT_IDS.monthly,
  PRODUCT_IDS.yearly,
  PRODUCT_IDS.lifetime,
];

export const FREE_EXPORTS_PER_DAY = 3;
export const FREE_PRIVATE_FOLDER_ITEMS = 10;

export const PLAN_ORDER: ProductId[] = [
  PRODUCT_IDS.yearly,
  PRODUCT_IDS.lifetime,
  PRODUCT_IDS.monthly,
];

export const PLAN_COPY: Record<
  ProductId,
  { title: string; period: string; badge?: string }
> = {
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
