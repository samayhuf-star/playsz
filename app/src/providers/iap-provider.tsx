import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import {
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
  productAvailable: (id: ProductId) => boolean;
  anyPriceLoaded: boolean;
  busy: boolean;
  message: string | null;
  buy: (id?: ProductId) => Promise<void>;
  restore: () => Promise<void>;
};

const IapContext = createContext<IapContextValue | null>(null);

function offerTokenFor(product: OfferProduct): string | undefined {
  if ('subscriptionOffers' in product && Array.isArray(product.subscriptionOffers)) {
    const token = product.subscriptionOffers.find((offer) => offer.offerTokenAndroid)
      ?.offerTokenAndroid;
    return token ?? undefined;
  }
  return undefined;
}

function collectKnownIds(purchases: Purchase[], extra?: { productId: string; isActive?: boolean; isSuspendedAndroid?: boolean | null }[]): ProductId | null {
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

export function IapProvider({ children }: { children: ReactNode }) {
  const [entitlement, setEntitlement] = useState<Entitlement>({
    isPro: false,
    productId: null,
    updatedAt: 0,
  });
  const [selectedId, setSelectedId] = useState<ProductId>(PRODUCT_IDS.yearly);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<OfferProduct[]>([]);
  const [restorePending, setRestorePending] = useState(false);

  const {
    connected,
    products,
    subscriptions,
    availablePurchases,
    activeSubscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    getAvailablePurchases,
    getActiveSubscriptions,
    restorePurchases,
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
            err instanceof Error
              ? err.message
              : 'The purchase finished in the store but could not be saved on this device. Try Restore.'
          );
        } finally {
          setBusy(false);
        }
      })();
    },
    onPurchaseError: (error) => {
      setBusy(false);
      if (isUserCancelledError(error)) {
        setMessage('Purchase cancelled.');
        return;
      }
      setMessage(error.message || 'Purchase failed. Please try again.');
    },
    onError: (error) => {
      setMessage(error.message || 'The store could not be reached.');
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
      setMessage(
        err instanceof Error ? err.message : 'Could not refresh purchases from the store.'
      );
    }
  }, [connected, getActiveSubscriptions, getAvailablePurchases]);

  useEffect(() => {
    if (!connected || Platform.OS === 'web') {
      return;
    }
    void (async () => {
      try {
        await fetchProducts({ skus: [PRODUCT_IDS.lifetime], type: 'in-app' });
        await fetchProducts({
          skus: [...SUBSCRIPTION_IDS],
          type: 'subs',
        });
        await refreshOwnership();
      } catch (err) {
        setMessage(
          err instanceof Error
            ? err.message
            : 'Store products are unavailable on this device.'
        );
      }
    })();
  }, [connected, fetchProducts, refreshOwnership]);

  useEffect(() => {
    const merged = new Map<string, OfferProduct>();
    for (const item of [...products, ...subscriptions]) {
      merged.set(item.id, item);
    }
    setCatalog([...merged.values()]);
  }, [products, subscriptions]);

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
        if (isUserCancelledError(err)) {
          setMessage('Purchase cancelled.');
          return;
        }
        setMessage(err instanceof Error ? err.message : 'Purchase failed.');
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
      setMessage(err instanceof Error ? err.message : 'Restore failed.');
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
      productAvailable,
      anyPriceLoaded,
      busy,
      message,
      buy,
      restore,
    }),
    [
      anyPriceLoaded,
      busy,
      buy,
      catalog,
      connected,
      entitlement,
      message,
      priceLabel,
      productAvailable,
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
