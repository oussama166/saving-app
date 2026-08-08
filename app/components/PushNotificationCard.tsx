'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';

// Active/désactive les notifications push (voir public/sw.js pour les
// handlers push/notificationclick, lib/webPush.ts côté serveur). L'état
// affiché est lu directement depuis pushManager.getSubscription() de CE
// navigateur — pas d'appel serveur nécessaire pour savoir si CET appareil
// est abonné (chaque appareil a son propre PushSubscription en base).
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

type Status = 'checking' | 'unsupported' | 'no-key' | 'subscribed' | 'unsubscribed' | 'denied' | 'sw-not-ready';

// navigator.serviceWorker.ready ne se résout QUE si un service worker est
// actif sur cette page — s'il n'y en a aucun (ex: SW désenregistré par
// ServiceWorkerRegister.tsx en dev, ou jamais activé), la promesse reste en
// attente indéfiniment. On la course contre un timeout pour ne jamais
// laisser le bouton bloqué en "chargement" sans explication.
function serviceWorkerReadyWithTimeout(ms = 4000): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) => setTimeout(() => reject(new Error('sw-timeout')), ms)),
  ]);
}

export default function PushNotificationCard() {
  const [status, setStatus] = useState<Status>('checking');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkStatus() {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('unsupported');
        return;
      }
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        setStatus('no-key');
        return;
      }
      if (Notification.permission === 'denied') {
        setStatus('denied');
        return;
      }
      try {
        const registration = await serviceWorkerReadyWithTimeout();
        const existing = await registration.pushManager.getSubscription();
        setStatus(existing ? 'subscribed' : 'unsubscribed');
      } catch {
        setStatus('sw-not-ready');
      }
    }
    checkStatus();
  }, []);

  const handleSubscribe = async () => {
    setError(null);
    setWorking(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'unsubscribed');
        return;
      }
      const registration = await serviceWorkerReadyWithTimeout();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string) as BufferSource,
      });
      const json = subscription.toJSON();
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      const result = await res.json();
      if (!result.success) {
        setError(result.error || "Erreur lors de l'activation");
        return;
      }
      setStatus('subscribed');
    } catch (err) {
      console.error('Push subscribe error:', err);
      if (err instanceof Error && err.message === 'sw-timeout') {
        setStatus('sw-not-ready');
      } else {
        setError("Impossible d'activer les notifications push");
      }
    } finally {
      setWorking(false);
    }
  };

  const handleUnsubscribe = async () => {
    setError(null);
    setWorking(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus('unsubscribed');
    } catch (err) {
      console.error('Push unsubscribe error:', err);
      setError('Erreur lors de la désactivation');
    } finally {
      setWorking(false);
    }
  };

  if (status === 'unsupported' || status === 'no-key') return null;

  return (
    <div className="flex flex-col items-start justify-between gap-4 p-6 border bg-surface rounded-2xl border-line sm:flex-row sm:items-center">
      <div className="flex items-center gap-4">
        <div className="p-3 border bg-orange-600/20 rounded-xl border-orange-500/20">
          {status === 'subscribed' ? (
            <BellRing className="w-6 h-6 text-orange-400" />
          ) : (
            <Bell className="w-6 h-6 text-orange-400" />
          )}
        </div>
        <div>
          <h2 className="text-sm font-black tracking-tight uppercase text-ink">Notifications push</h2>
          <p className="text-subtle text-xs mt-0.5 max-w-md">
            Reçois les rappels d&apos;abonnements (et autres alertes) directement sur cet appareil, en plus de l&apos;email.
          </p>
          {status === 'denied' && (
            <p className="mt-1 text-xs text-red-400">
              Notifications bloquées dans les réglages du navigateur — autorise-les pour ce site puis recharge la page.
            </p>
          )}
          {status === 'sw-not-ready' && (
            <p className="mt-1 text-xs text-red-400">
              Service worker pas encore actif — recharge la page. Si ça persiste : les notifications push ne marchent
              qu&apos;avec <code>npm run build &amp;&amp; npm run start</code> (pas <code>npm run dev</code>, qui
              désactive volontairement le service worker en développement).
            </p>
          )}
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        </div>
      </div>

      {status === 'checking' ? (
        <Loader2 className="w-5 h-5 animate-spin text-subtle" />
      ) : status === 'denied' ? null : status === 'sw-not-ready' ? (
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 bg-surface-alt hover:bg-surface-strong text-body text-sm font-bold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap border border-line"
        >
          Recharger
        </button>
      ) : status === 'subscribed' ? (
        <button
          onClick={handleUnsubscribe}
          disabled={working}
          className="flex items-center gap-2 bg-surface-alt hover:bg-surface-strong disabled:opacity-50 disabled:cursor-not-allowed text-body text-sm font-bold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap border border-line"
        >
          {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellOff className="w-4 h-4" />}
          Désactiver
        </button>
      ) : (
        <button
          onClick={handleSubscribe}
          disabled={working}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
        >
          {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          Activer
        </button>
      )}
    </div>
  );
}
