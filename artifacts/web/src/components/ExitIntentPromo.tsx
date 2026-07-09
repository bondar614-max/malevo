import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { X, Gift } from "lucide-react";
import { useLocation } from "wouter";

interface ExitPromoSettings {
  enabled: boolean;
  title: string;
  body: string;
  offer: string;
  couponCode: string;
  buttonText: string;
  buttonUrl: string;
  imageUrl: string;
}

const SEEN_KEY = "photogen_exit_promo_seen";

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed || "/photo";
}

export function ExitIntentPromo() {
  const [location] = useLocation();
  const [settings, setSettings] = useState<ExitPromoSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(SEEN_KEY) === "1");

  const isAdmin = location.startsWith("/admin");
  const show = useCallback(() => {
    if (!settings?.enabled || dismissed || isAdmin) return;
    sessionStorage.setItem(SEEN_KEY, "1");
    setDismissed(true);
    setOpen(true);
  }, [dismissed, isAdmin, settings?.enabled]);

  useEffect(() => {
    if (isAdmin) return;
    const controller = new AbortController();
    fetch("/api/promo/exit-intent", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ExitPromoSettings | null) => {
        if (data?.enabled) setSettings(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isAdmin]);

  useEffect(() => {
    if (!settings?.enabled || dismissed || isAdmin) return;

    const onMouseOut = (event: MouseEvent) => {
      if (event.clientY <= 0 && !event.relatedTarget) show();
    };
    const onMouseMove = (event: MouseEvent) => {
      if (event.clientY <= 12) show();
    };
    const onTouchStart = () => {
      window.setTimeout(show, 45_000);
    };

    document.addEventListener("mouseout", onMouseOut);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("touchstart", onTouchStart, { once: true });
    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("touchstart", onTouchStart);
    };
  }, [dismissed, isAdmin, settings?.enabled, show]);

  if (!settings || !open) return null;

  const buttonUrl = normalizeUrl(settings.buttonUrl);

  function close() {
    setOpen(false);
  }

  async function onCta() {
    if (settings?.couponCode) {
      try {
        await navigator.clipboard.writeText(settings.couponCode);
      } catch {
        /* clipboard can be unavailable in insecure contexts */
      }
    }
    window.location.href = buttonUrl;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
      <button className="absolute inset-0 bg-black/75 backdrop-blur-sm" type="button" aria-label="Закрыть" onClick={close} />
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#141416] shadow-2xl">
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white/75 transition hover:text-white"
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>

        <div className="grid md:grid-cols-[0.9fr_1.1fr]">
          <div className="min-h-56 bg-secondary md:min-h-full">
            {settings.imageUrl ? (
              <img src={settings.imageUrl} alt="" className="h-full min-h-56 w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-56 items-center justify-center bg-gradient-primary">
                <Gift className="h-20 w-20 text-white" />
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center p-6 sm:p-8">
            {settings.offer && (
              <div className="mb-4 inline-flex w-fit items-center rounded-full border border-[#7C3AED]/40 bg-[#7C3AED]/15 px-3 py-1 text-sm font-semibold text-[#C4B5FD]">
                {settings.offer}
              </div>
            )}
            <h2 className="text-3xl font-bold leading-tight text-white sm:text-4xl">{settings.title}</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">{settings.body}</p>
            {settings.couponCode && (
              <div className="mt-5 flex w-fit items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Купон</span>
                <span className="font-mono text-lg font-bold text-white">{settings.couponCode}</span>
              </div>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <ButtonLike onClick={onCta}>{settings.buttonText}</ButtonLike>
              <button type="button" onClick={close} className="h-12 px-5 text-sm font-semibold text-muted-foreground hover:text-white">
                Не сейчас
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ButtonLike({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-12 rounded-xl bg-gradient-primary px-6 text-sm font-bold text-white shadow-[0_12px_30px_rgba(124,58,237,0.28)] transition hover:scale-[1.01]"
    >
      {children}
    </button>
  );
}
