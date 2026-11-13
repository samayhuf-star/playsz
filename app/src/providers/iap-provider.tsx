import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import {
  fetchProducts as queryStoreProducts,
  isEligibleForIntroOfferIOS,
  isUserCancelledError,
  useIAP,
  type Product,
  type ProductSubscription,
  type Purchase,
} from 'expo-iap';

import {
  ALL_PRODUCT_IDS,
  PRODUCT_IDS,
  SUBSCRIPTION_IDS,
  type ProductId,
} from '@/constants/products';
import {
  isKnownProductId,
  loadEntitlement,
  saveEntitlement,
  type Entitlement,
} from '@/lib/entitlement';
import { freeTrialDays, type ProductLike } from '@/lib/intro-offer';
import { friendlyStoreMessage, isStoreUserCancel } from '@/lib/store-errors';

type OfferProduct = Product | ProductSubscription;

type IapContextValue = {
  isPro: boolean;
  entitlement: Entitlement;
  connected: boolean;
  storeReady: boolean;
  products: OfferProduct[];
  selectedId: ProductId;
  setSelectedId: (id: ProductId) => void;
  priceLabel: (id: ProductId) => string | null;
  trialDays: (id: ProductId) => number | null;
  productAvailable: (id: ProductId) => boolean;
  anyPriceLoaded: boolean;
  busy: boolean;
  catalogBusy: boolean;
  message: string | null;
  buy: (id?: ProductId) => Promise<void>;
  restore: () => Promise<void>;
  refreshProducts: () => Promise<void>;
};

const IapContext = createContext<IapContextValue | null>(null);

const FETCH_ATTEMPTS = 3;
const FETCH_RETRY_MS = 800;

async function introEligible(product: OfferProduct | undefined): Promise<boolean> {
  if (!product) return false;
  if (Platform.OS !== 'ios') return true;
  const group = (product as { subscriptionGroupIdIOS?: string | null }).subscriptionGroupIdIOS;
  if (!group) return false;
  try {
    return !!(await isEligibleForIntroOfferIOS(group));
  } catch {
    return false;
  }
}

function offerTokenFor(product: OfferProduct): string | undefined {
  if ('subscriptionOffers' in product && Array.isArray(product.subscriptionOffers)) {
    const token = product.subscriptionOffers.find((offer) => offer.offerTokenAndroid)
      ?.offerTokenAndroid;
    return token ?? undefined;
  }
  return undefined;
}

function collectKnownIds(
  purchases: Purchase[],
  extra?: { productId: string; isActive?: boolean; isSuspendedAndroid?: boolean | null }[]
): ProductId | null {
  for (const purchase of purchases) {
    if (
      isKnownProductId(purchase.productId) &&
      (purchase.purchaseState === 'purchased' || purchase.purchaseState === 'unknown') &&
      purchase.productId === PRODUCT_IDS.lifetime
    ) {
      return PRODUCT_IDS.lifetime;
    }
  }
  for (const purchase of purchases) {
    if (
      isKnownProductId(purchase.productId) &&
      SUBSCRIPTION_IDS.includes(purchase.productId) &&
      purchase.purchaseState !== 'pending'
    ) {
      return purchase.productId;
    }
  }
  if (extra) {
    for (const sub of extra) {
      if (isKnownProductId(sub.productId) && sub.isActive && !sub.isSuspendedAndroid) {
        return sub.productId;
      }
    }
  }
  return null;
}

function isCancel(error: unknown): boolean {
  try {
    if (isUserCancelledError(error)) return true;
  } catch {
    // Fall through to the envelope-aware helper.
  }
  return isStoreUserCancel(error);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function mergeCatalog(
  lifetime: OfferProduct[] | null | undefined,
  subscriptions: OfferProduct[] | null | undefined
): OfferProduct[] {
  const merged = new Map<string, OfferProduct>();
  for (const item of [...(lifetime ?? []), ...(subscriptions ?? [])]) {
    if (item?.id) merged.set(item.id, item);
  }
  return [...merged.values()];
}

export function IapProvider({ children }: { children: ReactNode }) {
  const [entitlement, setEntitlement] = useState<Entitlement>({
    isPro: false,
    productId: null,
    updatedAt: 0,
  });
  const [selectedId, setSelectedId] = useState<ProductId>(PRODUCT_IDS.yearly);
  const [busy, setBusy] = useState(false);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<OfferProduct[]>([]);
  const [trialDaysById, setTrialDaysById] = useState<Partial<Record<ProductId, number | null>>>({});
  const [restorePending, setRestorePending] = useState(false);
  const fetchingRef = useRef(false);

  const {
    connected,
    products,
    subscriptions,
    availablePurchases,
    activeSubscriptions,
    requestPurchase,
    finishTransaction,
    getAvailablePurchases,
    getActiveSubscriptions,
    restorePurchases,
    reconnect,
  } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void (async () => {
        try {
          await finishTransaction({ purchase, isConsumable: false });
          if (isKnownProductId(purchase.productId)) {
            const next = await saveEntitlement({
              isPro: true,
              productId: purchase.productId,
            });
            setEntitlement(next);
            setMessage('Pro is unlocked on this device.');
          }
        } catch (err) {
          setMessage(
            friendlyStoreMessage(
              err,
              'The purchase finished in the store but could not be saved on this device. Try Restore.'
            )
          );
        } finally {
          setBusy(false);
        }
      })();
    },
    onPurchaseError: (error) => {
      setBusy(false);
      if (isCancel(error)) {
        setMessage(null);
        return;
      }
      setMessage(friendlyStoreMessage(error, 'Purchase failed. Please try again.'));
    },
    onError: (error) => {
      if (isCancel(error)) {
        setMessage(null);
        return;
      }
      setMessage(
        friendlyStoreMessage(error, 'The store could not be reached. Please try again.')
      );
    },
  });

  useEffect(() => {
    void loadEntitlement().then(setEntitlement);
  }, []);

  const refreshOwnership = useCallback(async () => {
    if (!connected) {
      return;
    }
    try {
      await getAvailablePurchases();
      await getActiveSubscriptions([...SUBSCRIPTION_IDS]);
    } catch (err) {
      if (isCancel(err)) {
        setMessage(null);
        return;
      }
      setMessage(
        friendlyStoreMessage(err, 'Could not refresh purchases from the store. Please try again.')
      );
    }
  }, [connected, getActiveSubscriptions, getAvailablePurchases]);

  const resolveTrialDays = useCallback(async (items: OfferProduct[]) => {
    const next: Partial<Record<ProductId, number | null>> = {
      [PRODUCT_IDS.lifetime]: null,
    };
    for (const id of SUBSCRIPTION_IDS) {
      const item = items.find((entry) => entry.id === id);
      const daysFromOffer = freeTrialDays(item as ProductLike | undefined);
      const days = daysFromOffer && (await introEligible(item)) ? daysFromOffer : null;
      next[id] = days;
    }
    setTrialDaysById(next);
  }, []);

  const loadCatalogOnce = useCallback(async (): Promise<number> => {
    const lifetime = (await queryStoreProducts({
      skus: [PRODUCT_IDS.lifetime],
      type: 'in-app',
    })) as OfferProduct[] | null;
    const subs = (await queryStoreProducts({
      skus: [...SUBSCRIPTION_IDS],
      type: 'subs',
    })) as OfferProduct[] | null;
    const merged = mergeCatalog(lifetime, subs);
    setCatalog(merged);
    await resolveTrialDays(merged);
    return merged.filter((item) => ALL_PRODUCT_IDS.includes(item.id as ProductId)).length;
  }, [resolveTrialDays]);

  const refreshProducts = useCallback(async () => {
    if (Platform.OS === 'web') {
      return;
    }
    if (fetchingRef.current) {
      return;
    }
    fetchingRef.current = true;
    setCatalogBusy(true);
    setMessage(null);
    try {
      let ready = connected;
      if (!ready) {
        try {
          ready = await reconnect();
        } catch (err) {
          if (isCancel(err)) {
            setMessage(null);
            return;
          }
          setMessage(
            friendlyStoreMessage(err, 'The store is not available on this device yet.')
          );
          return;
        }
      }
      if (!ready) {
        setMessage('The store is not available on this device yet.');
        return;
      }
      let loaded = 0;
      let lastError: unknown;
      for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
        try {
          loaded = await loadCatalogOnce();
          lastError = undefined;
          if (loaded >= ALL_PRODUCT_IDS.length) {
            break;
          }
        } catch (err) {
          lastError = err;
          if (isCancel(err)) {
            setMessage(null);
            return;
          }
        }
        if (attempt < FETCH_ATTEMPTS - 1) {
          await wait(FETCH_RETRY_MS * (attempt + 1));
        }
      }
      if (lastError) {
        setMessage(
          friendlyStoreMessage(
            lastError,
            'Could not load prices from the store. Please try again.'
          )
        );
      }
    } finally {
      fetchingRef.current = false;
      setCatalogBusy(false);
    }
  }, [connected, loadCatalogOnce, reconnect]);

  // Load prices once the store connection is ready. Do not sync ownership at startup.
  useEffect(() => {
    if (!connected || Platform.OS === 'web') {
      return;
    }
    void refreshProducts();
  }, [connected, refreshProducts]);

  useEffect(() => {
    const merged = mergeCatalog(products, subscriptions);
    if (merged.length > 0) {
      setCatalog(merged);
      void resolveTrialDays(merged);
    }
  }, [products, resolveTrialDays, subscriptions]);

  useEffect(() => {
    const owned = collectKnownIds(availablePurchases, activeSubscriptions);
    if (owned) {
      void saveEntitlement({ isPro: true, productId: owned }).then(setEntitlement);
      if (restorePending) {
        setMessage('Purchases restored. Pro is unlocked on this device.');
        setRestorePending(false);
      }
      return;
    }
    if (restorePending) {
      setMessage('No Pro purchase was found for this store account.');
      setRestorePending(false);
    }
  }, [activeSubscriptions, availablePurchases, restorePending]);

  const productAvailable = useCallback(
    (id: ProductId) => catalog.some((item) => item.id === id),
    [catalog]
  );

  const priceLabel = useCallback(
    (id: ProductId) => {
      const item = catalog.find((entry) => entry.id === id);
      return item?.displayPrice ?? null;
    },
    [catalog]
  );

  const trialDays = useCallback(
    (id: ProductId) => trialDaysById[id] ?? null,
    [trialDaysById]
  );

  const anyPriceLoaded = catalog.some((item) =>
    ALL_PRODUCT_IDS.includes(item.id as ProductId)
  );

  const buy = useCallback(
    async (id?: ProductId) => {
      const productId = id ?? selectedId;
      setMessage(null);
      if (!connected) {
        setMessage('The store is not available on this device yet.');
        return;
      }
      const item = catalog.find((entry) => entry.id === productId);
      if (!item) {
        setMessage('This plan is unavailable from the store right now.');
        return;
      }
      setBusy(true);
      try {
        if (productId === PRODUCT_IDS.lifetime) {
          await requestPurchase({
            request: {
              apple: { sku: productId },
              google: { skus: [productId] },
            },
            type: 'in-app',
          });
        } else {
          const offerToken = offerTokenFor(item);
          await requestPurchase({
            request: {
              apple: { sku: productId },
              google: {
                skus: [productId],
                subscriptionOffers: offerToken
                  ? [{ sku: productId, offerToken }]
                  : [],
              },
            },
            type: 'subs',
          });
        }
      } catch (err) {
        setBusy(false);
        if (isCancel(err)) {
          setMessage(null);
          return;
        }
        setMessage(friendlyStoreMessage(err, 'Purchase failed. Please try again.'));
      }
    },
    [catalog, connected, requestPurchase, selectedId]
  );

  const restore = useCallback(async () => {
    setMessage(null);
    setBusy(true);
    try {
      setRestorePending(true);
      await restorePurchases();
      await refreshOwnership();
    } catch (err) {
      setRestorePending(false);
      if (isCancel(err)) {
        setMessage(null);
      } else {
        setMessage(friendlyStoreMessage(err, 'Restore failed. Please try again.'));
      }
    } finally {
      setBusy(false);
    }
  }, [refreshOwnership, restorePurchases]);

  const value = useMemo<IapContextValue>(
    () => ({
      isPro: entitlement.isPro,
      entitlement,
      connected,
      storeReady: connected,
      products: catalog,
      selectedId,
      setSelectedId,
      priceLabel,
      trialDays,
      productAvailable,
      anyPriceLoaded,
      busy,
      catalogBusy,
      message,
      buy,
      restore,
      refreshProducts,
    }),
    [
      anyPriceLoaded,
      busy,
      buy,
      catalog,
      catalogBusy,
      connected,
      entitlement,
      message,
      priceLabel,
      trialDays,
      productAvailable,
      refreshProducts,
      restore,
      selectedId,
    ]
  );

  return <IapContext.Provider value={value}>{children}</IapContext.Provider>;
}

export function useIapContext(): IapContextValue {
  const value = useContext(IapContext);
  if (!value) {
    throw new Error('useIapContext must be used inside IapProvider');
  }
  return value;
}
