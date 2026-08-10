import { useEffect, useRef, useState } from 'react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof window !== 'undefined' ? (window.Notification?.permission || 'default') : 'default'
  );
  const [subscribed, setSubscribed] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    let cancelled = false;

    navigator.serviceWorker.ready.then((reg) => {
      if (cancelled) return;
      registrationRef.current = reg;
      reg.pushManager.getSubscription().then((sub) => {
        if (!cancelled) setSubscribed(!!sub);
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const ensurePermission = async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) return 'denied';
    let p = Notification.permission;
    if (p === 'default') {
      p = await Notification.requestPermission();
      setPermission(p);
    }
    return p;
  };

  const subscribe = async (publicKey: string) => {
    const p = await ensurePermission();
    if (p !== 'granted') return false;

    try {
      const reg = await navigator.serviceWorker.ready;
      registrationRef.current = reg;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const payload = subscription.toJSON();
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: payload.endpoint,
          p256dh: payload.keys?.p256dh || '',
          auth: payload.keys?.auth || '',
          userAgent: navigator.userAgent,
        }),
      });

      setSubscribed(true);
      return true;
    } catch (err) {
      console.warn('Push subscribe failed:', err);
      return false;
    }
  };

  const unsubscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
        setSubscribed(false);
      }
    } catch (err) {
      console.warn('Push unsubscribe failed:', err);
    }
  };

  return { permission, subscribed, subscribe, unsubscribe, ensurePermission };
}
