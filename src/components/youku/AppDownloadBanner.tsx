import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, X } from "lucide-react";
import movieMaxLogo from "@/assets/moviemax-logo.png";
import { isNativeApp } from "@/lib/native-app";
import { WHATSAPP_PROMPT_CLOSED_EVENT } from "@/components/youku/WhatsAppPrompt";

const KEY = "moviemax:app-banner-closed";

/** Small bottom banner that sends visitors to the /app download page. Replaces the WhatsApp pop-up. */
export function AppDownloadBanner() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const done = () => window.dispatchEvent(new Event(WHATSAPP_PROMPT_CLOSED_EVENT));
    let closed = false;
    try { closed = sessionStorage.getItem(KEY) === "1"; } catch { /* unavailable */ }
    if (isNativeApp() || closed || /Electron/i.test(navigator.userAgent) || location.pathname.startsWith("/app") || location.pathname.startsWith("/desktop-account")) {
      window.setTimeout(done, 0);
      return;
    }
    const t = window.setTimeout(() => setOpen(true), 2500);
    return () => window.clearTimeout(t);
  }, []);
  const close = () => {
    setOpen(false);
    try { sessionStorage.setItem(KEY, "1"); } catch { /* unavailable */ }
    window.dispatchEvent(new Event(WHATSAPP_PROMPT_CLOSED_EVENT));
  };
  if (!open) return null;
  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in md:bottom-6">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur">
        <img src={movieMaxLogo} alt="" className="size-11 shrink-0 rounded-xl object-contain" draggable={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">Get the MOVIE MAX app</p>
          <p className="truncate text-xs text-muted-foreground">Android & Windows · watch and download faster</p>
        </div>
        <Link to="/app" onClick={close} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
          <Download className="size-3.5" />Get app
        </Link>
        <button type="button" aria-label="Close" onClick={close} className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
      </div>
    </div>
  );
}
