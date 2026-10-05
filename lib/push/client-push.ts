'use client';

/**
 * Converts a URL-safe Base64 encoded VAPID public key into a Uint8Array
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushSupportStatus {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  isIOS: boolean;
  isStandalone: boolean;
  needsPwaInstallForIos: boolean;
}

/**
 * Evaluates browser and device support for Web Push Notifications
 */
export function checkPushSupport(): PushSupportStatus {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      permission: 'unsupported',
      isIOS: false,
      isStandalone: false,
      needsPwaInstallForIos: false,
    };
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;
  const hasNotification = 'Notification' in window;

  const supported = hasServiceWorker && hasPushManager && hasNotification;
  const permission = hasNotification ? Notification.permission : 'unsupported';

  // iOS 16.4+ requires PWA to be installed to the Home Screen for Web Push
  const needsPwaInstallForIos = isIOS && !isStandalone;

  return {
    supported: supported && !needsPwaInstallForIos,
    permission,
    isIOS,
    isStandalone,
    needsPwaInstallForIos,
  };
}

/**
 * Requests browser permission and subscribes to Web Push
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<{
  subscription: PushSubscription | null;
  error?: string;
}> {
  if (typeof window === 'undefined') {
    return { subscription: null, error: 'Window not available' };
  }

  const support = checkPushSupport();
  if (support.needsPwaInstallForIos) {
    return {
      subscription: null,
      error: 'On iPhone/iPad, please add VERITAS Admin to your Home Screen first to enable Web Push notifications.',
    };
  }

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return { subscription: null, error: 'Web Push is not supported on this browser.' };
  }

  try {
    // 1. Explicitly request notification permission from user
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        subscription: null,
        error: permission === 'denied' 
          ? 'Notification permission was blocked in browser settings. Please enable notifications for this site.'
          : 'Notification permission was not granted.',
      };
    }

    // 2. Obtain service worker registration
    const registration = await navigator.serviceWorker.ready;
    if (!registration.pushManager) {
      return { subscription: null, error: 'PushManager unavailable in service worker.' };
    }

    // 3. Check for existing subscription or create new
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      });
    }

    return { subscription };
  } catch (err: any) {
    console.error('[CLIENT PUSH] Subscription error:', err);
    return { subscription: null, error: err?.message || 'Failed to subscribe to Web Push' };
  }
}

/**
 * Unsubscribes from browser PushManager
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.pushManager) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        return await subscription.unsubscribe();
      }
    }
    return true;
  } catch (err) {
    console.error('[CLIENT PUSH] Unsubscribe error:', err);
    return false;
  }
}

/**
 * Gets the current active browser push subscription if present
 */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.pushManager) {
      return await registration.pushManager.getSubscription();
    }
    return null;
  } catch {
    return null;
  }
}
