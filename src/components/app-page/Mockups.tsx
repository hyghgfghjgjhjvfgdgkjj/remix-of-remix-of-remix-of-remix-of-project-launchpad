import type { ReactNode } from "react";
import { Download, Search, ShieldAlert, ShieldCheck, Check, FolderOpen, Home, Film, Tv, User } from "lucide-react";
import movieMaxLogo from "@/assets/moviemax-logo.png";

/** iPhone-style frame (CSS only) holding a mini screen. */
export function IPhone({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative mx-auto aspect-[9/19] w-full max-w-[280px] rounded-[2.6rem] border-[10px] border-foreground/90 bg-background shadow-2xl ring-1 ring-border ${className}`}>
      <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-foreground/90" />
      <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-background">{children}</div>
    </div>
  );
}

const POSTERS = ["from-primary/80 to-accent", "from-accent to-secondary", "from-secondary to-primary/60", "from-primary to-muted", "from-muted to-accent", "from-accent/70 to-primary"];

export function AppHomeScreen() {
  return (
    <div className="flex h-full flex-col pt-8 text-[9px]">
      <div className="flex items-center gap-1.5 px-3">
        <img src={movieMaxLogo} alt="" className="h-5 w-auto" draggable={false} />
        <div className="flex flex-1 items-center gap-1 rounded-full bg-muted px-2 py-1 text-muted-foreground"><Search className="size-2.5" />Search movies</div>
        <User className="size-3.5 text-muted-foreground" />
      </div>
      <div className="mt-2 flex gap-2 px-3 font-semibold text-muted-foreground"><span className="text-primary">Home</span><span>Movies</span><span>Series</span><span>Luganda</span></div>
      <div className="mx-3 mt-2 aspect-video rounded-xl bg-linear-to-br from-primary to-accent p-2 text-primary-foreground">
        <p className="mt-8 text-[11px] font-black">Now Trending</p><p className="opacity-80">VJ Junior · Action</p>
      </div>
      {["Latest Luganda", "Popular Movies"].map((row) => (
        <div key={row} className="mt-2 px-3">
          <p className="mb-1 font-bold text-foreground">{row}</p>
          <div className="grid grid-cols-3 gap-1.5">{POSTERS.slice(0, 3).map((g, i) => <div key={i} className={`aspect-[2/3] rounded-md bg-linear-to-br ${g}`} />)}</div>
        </div>
      ))}
      <div className="mt-auto flex justify-around border-t border-border py-2 text-muted-foreground">
        <Home className="size-3.5 text-primary" /><Film className="size-3.5" /><Download className="size-3.5" /><Tv className="size-3.5" />
      </div>
    </div>
  );
}

/** Small Android dialog-like screens for each step. */
export function PhoneStep({ step }: { step: number }) {
  const dialog = (title: string, body: ReactNode, actions: ReactNode, icon?: ReactNode) => (
    <div className="flex h-full items-center bg-foreground/40 p-3 pt-8">
      <div className="w-full rounded-2xl bg-card p-3 text-[10px] text-card-foreground shadow-xl">
        {icon}
        <p className="text-xs font-bold">{title}</p>
        <div className="mt-1 text-muted-foreground">{body}</div>
        <div className="mt-3 flex justify-end gap-3 font-bold text-primary">{actions}</div>
      </div>
    </div>
  );
  switch (step) {
    case 1:
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 pt-8 text-center text-[10px]">
          <img src={movieMaxLogo} alt="" className="h-8 w-auto" draggable={false} />
          <p className="font-bold">MOVIE MAX for Android</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 font-bold text-primary-foreground ring-4 ring-primary/30"><Download className="size-3" />Download app</span>
          <p className="text-muted-foreground">MovieMax.apk</p>
        </div>
      );
    case 2:
      return dialog("Download file?", <>MovieMax.apk may be harmful. Do you want to keep it anyway?</>, <><span className="text-muted-foreground">Cancel</span><span className="rounded bg-primary/15 px-1">Download anyway</span></>);
    case 3:
      return (
        <div className="h-full p-3 pt-8 text-[10px]">
          <p className="mb-2 text-xs font-bold">Downloads</p>
          <div className="flex items-center gap-2 rounded-xl bg-primary/15 p-2 ring-2 ring-primary">
            <img src={movieMaxLogo} alt="" className="size-7 rounded object-contain" draggable={false} />
            <div className="min-w-0 flex-1"><p className="font-bold">MovieMax.apk</p><p className="text-muted-foreground">Tap to open</p></div>
            <FolderOpen className="size-3.5 text-primary" />
          </div>
        </div>
      );
    case 4:
      return dialog("Install unknown apps", <><p>For your security, your phone can't install apps from this source.</p><div className="mt-2 flex items-center justify-between rounded-lg bg-muted p-2 text-foreground">Allow from this source<span className="h-3.5 w-6 rounded-full bg-primary ring-2 ring-primary/30" /></div></>, <span>Settings</span>);
    case 5:
      return dialog("Blocked by Play Protect", <>Play Protect doesn't recognise this app's developer.</>, <><span className="rounded bg-primary/15 px-1">More details</span><span className="text-muted-foreground">OK</span></>, <ShieldAlert className="mb-1 size-5 text-primary" />);
    case 6:
      return dialog("Blocked by Play Protect", <>Tap <b className="text-foreground">Install anyway</b> under the details.</>, <span className="rounded bg-primary/15 px-1">Install anyway</span>, <ShieldCheck className="mb-1 size-5 text-primary" />);
    case 7:
      return dialog("Movie max", <div className="mt-1"><div className="h-1.5 w-full overflow-hidden rounded bg-muted"><div className="h-full w-3/4 rounded bg-primary" /></div><p className="mt-1">Installing…</p></div>, <span className="text-muted-foreground">Cancel</span>, <img src={movieMaxLogo} alt="" className="mb-1 h-5 w-auto" draggable={false} />);
    default:
      return dialog("App installed", <span className="flex items-center gap-1"><Check className="size-3 text-primary" />Movie max is ready.</span>, <><span className="text-muted-foreground">Done</span><span className="rounded bg-primary/15 px-1">Open</span></>);
  }
}

/** Windows setup window mockup, styled after the real installer screens. */
export function WindowsStep({ step }: { step: number }) {
  const shell = (title: string, body: ReactNode, buttons: string[], primary: string) => (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-[10px] text-card-foreground shadow-xl">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted px-2 py-1.5">
        <img src={movieMaxLogo} alt="" className="h-3 w-auto" draggable={false} /><span className="flex-1 truncate font-semibold">{title}</span><span className="text-muted-foreground">— ☐ ✕</span>
      </div>
      <div className="flex min-h-32">{body}</div>
      <div className="flex justify-end gap-2 border-t border-border bg-muted/60 p-2">
        {buttons.map((b) => <span key={b} className={`rounded border px-3 py-1 ${b === primary ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{b}</span>)}
      </div>
    </div>
  );
  const side = <div className="flex w-1/3 items-start justify-center bg-linear-to-b from-primary to-accent p-3"><img src={movieMaxLogo} alt="" className="w-full max-w-14 rounded bg-card p-1" draggable={false} /></div>;
  switch (step) {
    case 1:
      return shell("MovieMax-Setup.exe", <div className="flex flex-1 flex-col items-center justify-center gap-1 p-3 text-center"><Download className="size-6 text-primary" /><p className="font-bold">Download finished</p><p className="text-muted-foreground">Open MovieMax-Setup.exe. If Windows shows a blue screen, click More info → Run anyway.</p></div>, ["Open file"], "Open file");
    case 2:
      return shell("Installer Language", <div className="flex flex-1 gap-2 p-3"><img src={movieMaxLogo} alt="" className="size-8 rounded object-contain" draggable={false} /><div className="flex-1"><p>Please select a language.</p><div className="mt-2 rounded border border-border px-2 py-1">English ▾</div></div></div>, ["OK", "Cancel"], "OK");
    case 3:
      return shell("Movie max Setup", <>{side}<div className="flex-1 p-3"><p className="text-xs font-bold">Welcome to Movie max Setup</p><p className="mt-1 text-muted-foreground">Setup will guide you through the installation. Click Next to continue.</p></div></>, ["Next >", "Cancel"], "Next >");
    case 4:
      return shell("Movie max Setup", <div className="flex-1 p-3"><p className="font-bold">Installing</p><p className="text-muted-foreground">Please wait while Movie max is being installed.</p><div className="mt-3 h-2 overflow-hidden rounded bg-muted"><div className="h-full w-2/3 bg-primary" /></div></div>, ["< Back", "Next >", "Cancel"], "Next >");
    default:
      return shell("Movie max Setup", <>{side}<div className="flex-1 space-y-1 p-3"><p className="text-xs font-bold">Completing Movie max Setup</p><p className="flex items-center gap-1"><Check className="size-3 rounded-sm bg-primary text-primary-foreground" />Create desktop shortcut</p><p className="flex items-center gap-1"><Check className="size-3 rounded-sm bg-primary text-primary-foreground" />Launch Movie max</p></div></>, ["Finish"], "Finish");
  }
}
