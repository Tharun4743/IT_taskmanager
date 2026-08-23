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

  // If user dismissed modal, show a slim persistent top banner
  if (isDismissed) {
    return (
      <div className="fixed bottom-3 left-3 right-3 md:left-auto md:right-4 md:bottom-4 z-[9999] bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 border border-blue-500/40 text-white rounded-xl shadow-2xl p-3 flex items-center justify-between gap-3 animate-fade-in max-w-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4 text-blue-300" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">Install App for Best Experience</p>
            <p className="text-[10px] text-blue-200/80 truncate">Faster loading & lock screen alerts</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow transition shrink-0"
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
    <div className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-6 md:p-7 text-center">
        
        {/* Top Glow & Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-amber-500" />

        {/* Dismiss Button */}
        <button
          onClick={() => {
            setShowModal(false);
            setIsDismissed(true);
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          title="Continue in browser"
        >
          <X className="w-5 h-5" />
        </button>

        {/* College Emblem with Animated Glow */}
        <div className="relative mx-auto w-20 h-20 mb-4 mt-2 flex items-center justify-center">
          <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
          <img
            src="/logo.png"
            alt="VSBEC Logo"
            className="w-18 h-18 rounded-full border-2 border-amber-500 shadow-xl object-contain bg-white relative z-10"
          />
        </div>

        {/* Title */}
        <span className="inline-block px-3 py-1 bg-blue-500/10 border border-blue-400/30 text-blue-300 text-[11px] font-bold tracking-wider uppercase rounded-full mb-2">
          📱 Official App Required
        </span>

        <h2 className="text-xl md:text-2xl font-black text-white tracking-tight mb-1">
          Install IT TaskManager
        </h2>
        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-4">
          Department of Information Technology, VSBEC
        </p>

        <p className="text-xs text-slate-300 leading-relaxed mb-5 px-2">
          To ensure seamless access, real-time push notifications, and fast loading without Chrome toolbars, please install this portal as an official app on your device.
        </p>

        {/* Features Checklist */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 mb-5 text-left space-y-2">
          <div className="flex items-center gap-2.5 text-xs text-slate-200">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span><b>Instant Launch:</b> Opens from your Home Screen like a native app</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span><b>Lock-Screen Alerts:</b> Never miss assignment deadlines</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-200">
            <Smartphone className="w-4 h-4 text-blue-400 shrink-0" />
            <span><b>Full Screen:</b> Clean interface with no browser URL bars</span>
          </div>
        </div>

        {/* Instructions for iOS Safari */}
        {isIOS ? (
          <div className="bg-blue-950/40 border border-blue-500/40 rounded-xl p-4 mb-5 text-left">
            <p className="text-xs font-bold text-blue-300 mb-2 flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-blue-400" />
              <span>How to Install on iPhone / iPad:</span>
            </p>
            <ol className="text-[11.5px] text-slate-300 space-y-1.5 list-decimal list-inside leading-snug">
              <li>Tap the <b>Share button</b> (<Share2 className="w-3 h-3 inline text-blue-400" />) at the bottom of Safari.</li>
              <li>Scroll down and tap <b>"Add to Home Screen"</b> (<PlusSquare className="w-3 h-3 inline text-blue-400" />).</li>
              <li>Tap <b>"Add"</b> in the top right corner.</li>
            </ol>
          </div>
        ) : (
          /* Primary Install Button for Android / Chrome / PC */
          <button
            onClick={handleInstallClick}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-black text-sm rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-95 mb-3"
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
          className="text-xs text-slate-400 hover:text-slate-200 transition py-1 font-medium flex items-center justify-center gap-1 mx-auto"
        >
          <span>Continue in Chrome browser for now</span>
          <ArrowRight className="w-3 h-3" />
        </button>

      </div>
    </div>
  );
}

export default PWAInstallOverlay;
