import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Share2, PlusSquare, ArrowRight, ShieldCheck, Zap, X } from 'lucide-react';

export function PWAInstallOverlay() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone mode (already installed & opened from home screen)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    const standalone = checkStandalone();

    // 2. Check if iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    // 3. Listen for Chrome / Android beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!standalone) {
        setShowModal(true);
      }
    };

    // 4. Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowModal(false);
      setIsStandalone(true);
      console.log('[PWA] 🎉 App was successfully installed on device!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // If not standalone and not installed, show modal after brief 1.2s delay
    if (!standalone) {
      const timer = setTimeout(() => {
        setShowModal(true);
      }, 1200);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] User accepted the install prompt');
          setShowModal(false);
        } else {
          console.log('[PWA] User dismissed the install prompt');
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('[PWA] Error triggering install prompt:', err);
      }
    } else {
      // If browser already consumed prompt, instruct user
      alert('To install the app:\n1. Tap the 3-dots menu (⋮) in Chrome.\n2. Tap "Install App" or "Add to Home screen".');
    }
  };

  // If already running as installed standalone app, render nothing
  if (isStandalone || isInstalled) {
    return null;
  }

  // If user dismissed modal, show a slim persistent banner (light themed)
  if (isDismissed) {
    return (
      <div className="fixed bottom-3 left-3 right-3 md:left-auto md:right-4 md:bottom-4 z-[9999] bg-white border border-slate-200 text-slate-900 rounded-2xl shadow-xl p-3.5 flex items-center justify-between gap-3 animate-fade-in max-w-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">Install App for Best Experience</p>
            <p className="text-[11px] text-slate-500 truncate">Faster loading & lock screen alerts</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-sm transition shrink-0 cursor-pointer"
        >
          Install
        </button>
      </div>
    );
  }

  if (!showModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-md bg-white border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8 text-center">
        
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-600 to-amber-500" />

        {/* Dismiss Button */}
        <button
          onClick={() => {
            setShowModal(false);
            setIsDismissed(true);
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
          title="Continue in browser"
        >
          <X className="w-5 h-5" />
        </button>

        {/* College Emblem */}
        <div className="relative mx-auto w-20 h-20 mb-3 mt-1 flex items-center justify-center">
          <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-lg" />
          <img
            src="/logo.png"
            alt="VSBEC Logo"
            className="w-18 h-18 rounded-full border-2 border-indigo-100 shadow-md object-contain bg-white relative z-10 p-0.5"
          />
        </div>

        {/* Badge Pill */}
        <div className="mb-2">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-[11px] font-bold tracking-wider uppercase rounded-full">
            📱 Official App Required
          </span>
        </div>

        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mb-1">
          Install IT TaskManager
        </h2>
        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3.5">
          Department of Information Technology, VSBEC
        </p>

        <p className="text-xs text-slate-600 leading-relaxed mb-5 px-1">
          To ensure seamless access, real-time push notifications, and fast loading without Chrome toolbars, please install this portal as an official app on your device.
        </p>

        {/* Features Checklist */}
        <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 mb-5 text-left space-y-3">
          <div className="flex items-center gap-3 text-xs text-slate-700">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 text-amber-600">
              <Zap className="w-4 h-4" />
            </div>
            <span><b className="text-slate-900">Instant Launch:</b> Opens from your Home Screen like a native app</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-700">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span><b className="text-slate-900">Lock-Screen Alerts:</b> Never miss assignment deadlines</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-700">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 text-blue-600">
              <Smartphone className="w-4 h-4" />
            </div>
            <span><b className="text-slate-900">Full Screen:</b> Clean interface with no browser URL bars</span>
          </div>
        </div>

        {/* Instructions for iOS Safari */}
        {isIOS ? (
          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 mb-5 text-left">
            <p className="text-xs font-bold text-indigo-900 mb-2 flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-indigo-600" />
              <span>How to Install on iPhone / iPad:</span>
            </p>
            <ol className="text-[11.5px] text-slate-700 space-y-1.5 list-decimal list-inside leading-snug">
              <li>Tap the <b className="text-slate-900">Share button</b> (<Share2 className="w-3 h-3 inline text-indigo-600" />) at the bottom of Safari.</li>
              <li>Scroll down and tap <b className="text-slate-900">"Add to Home Screen"</b> (<PlusSquare className="w-3 h-3 inline text-indigo-600" />).</li>
              <li>Tap <b className="text-slate-900">"Add"</b> in the top right corner.</li>
            </ol>
          </div>
        ) : (
          /* Primary Install Button for Android / Chrome / PC */
          <button
            onClick={handleInstallClick}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-indigo-600 via-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 active:scale-[0.98] text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer mb-3"
          >
            <Download className="w-5 h-5 animate-bounce" />
            <span>INSTALL APP ON THIS DEVICE (1-TAP)</span>
          </button>
        )}

        {/* Secondary Bypass Button */}
        <button
          onClick={() => {
            setShowModal(false);
            setIsDismissed(true);
          }}
          className="text-xs text-slate-500 hover:text-slate-800 transition py-1 font-semibold flex items-center justify-center gap-1 mx-auto cursor-pointer"
        >
          <span>Continue in browser for now</span>
          <ArrowRight className="w-3 h-3" />
        </button>

      </div>
    </div>
  );
}

export default PWAInstallOverlay;
