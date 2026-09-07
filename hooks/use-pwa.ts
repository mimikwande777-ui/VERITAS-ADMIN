'use client';

import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Run client detection after mount safely
    const initTimer = setTimeout(() => {
      // 1. Initial connectivity check
      setIsOnline(navigator.onLine);

      // 2. Standalone detection (PWA running installed)
      const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isNavStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      const standaloneActive = isDisplayStandalone || isNavStandalone;
      setIsStandalone(standaloneActive);
      setIsInstalled(standaloneActive);

      // 3. Platform detection
      const ua = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(ua) && !(window as unknown as { MSStream?: boolean }).MSStream;
      setIsIOS(isIOSDevice);
    }, 0);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 4. Listen for Chrome/Edge/Android beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // 5. Service Worker Management
    // In development or preview environments, ensure service workers are unregistered and caches cleared
    // to prevent webpack chunk collision and stale module caching.
    const isDev = 
      process.env.NODE_ENV !== 'production' || 
      (typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname.includes('127.0.0.1') ||
        window.location.hostname.includes('ais-dev-')
      ));

    if ('serviceWorker' in navigator) {
      if (isDev) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        });
        if ('caches' in window) {
          caches.keys().then((keys) => {
            for (const key of keys) {
              if (key.startsWith('veritas-admin-')) {
                caches.delete(key);
              }
            }
          });
        }
      } else if (window.location.pathname.startsWith('/admin')) {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/admin/' })
          .then((reg) => {
            setRegistration(reg);

            // Check for immediate updates
            if (reg.waiting) {
              setWaitingWorker(reg.waiting);
              setIsUpdateAvailable(true);
            }

            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    setWaitingWorker(newWorker);
                    setIsUpdateAvailable(true);
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.warn('[PWA] Service worker registration notice:', err);
          });
      }
    }

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setIsStandalone(true);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[PWA] Error triggering install prompt:', err);
      return false;
    }
  }, [deferredPrompt]);

  const updateServiceWorker = useCallback(() => {
    if (waitingWorker) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        }, { once: true });
      }
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [waitingWorker]);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isStandalone,
    isIOS,
    isOnline,
    isUpdateAvailable,
    install,
    updateServiceWorker,
    registration
  };
}
