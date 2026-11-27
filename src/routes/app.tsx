import { createFileRoute } from "@tanstack/react-router";
import { Download, Monitor, Smartphone, Tv, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { desktopSetup } from "@/components/youku/InstallAppButton";
import { IPhone, AppHomeScreen, PhoneStep, WindowsStep } from "@/components/app-page/Mockups";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Download the MOVIE MAX App — Android & Windows" },
      { name: "description", content: "Download MOVIE MAX for Android and Windows with step-by-step install guides, including how to pass Play Protect." },
      { property: "og:title", content: "Download the MOVIE MAX App" },
      { property: "og:description", content: "Android and Windows apps with step-by-step install guides." },
    ],
  }),
  component: AppPage,
});

const PHONE_STEPS = [
  "Tap Download app on this page.",
  "If your browser warns you, tap Download anyway.",
  "Open MovieMax.apk from your notifications or Downloads.",
  "Tap Settings and turn on Allow from this source, then go back.",
  "Play Protect may appear — tap More details.",
  "Tap Install anyway. The app is safe; it is just not from the Play Store.",
  "Wait while Movie max installs.",
  "Tap Open. You're ready to watch!",
];
const PC_STEPS = [
  "Click Download for Windows, then open MovieMax-Setup.exe.",
  "Choose your language and click OK.",
  "Click Next on the welcome screen.",
  "Wait while Movie max installs.",
  "Keep Create desktop shortcut and Launch ticked, then click Finish.",
];

function StepNo({ n }: { n: number }) {
  return <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">{n}</span>;
}

function AppPage() {
  return (
    <main className="min-h-screen bg-background pb-28 text-foreground">
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 md:grid-cols-2 md:pt-16">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-primary">MOVIE MAX apps</p>
          <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">Movies, Luganda & series — in your pocket and on your PC.</h1>
          <p className="mt-4 text-muted-foreground">Faster streaming, background downloads, offline viewing and new-movie alerts.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2 rounded-full"><a href="/downloads/MovieMax.apk" download="MovieMax.apk"><Smartphone className="size-4" />Download for Android</a></Button>
            <Button asChild size="lg" variant="secondary" className="gap-2 rounded-full"><a href={desktopSetup.url}><Monitor className="size-4" />Download for Windows</a></Button>
            <Button size="lg" variant="outline" disabled className="gap-2 rounded-full"><Tv className="size-4" />TV · Coming soon</Button>
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-10 -z-0 rounded-full bg-primary/30 blur-3xl" />
          <IPhone className="relative"><AppHomeScreen /></IPhone>
        </div>
      </section>

      <section id="mobile" className="mx-auto mt-20 max-w-6xl px-4">
        <div className="flex items-center gap-2"><Smartphone className="size-6 text-primary" /><h2 className="text-2xl font-black">Install on Android</h2></div>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-primary" />Includes how to pass Google Play Protect.</p>
        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {PHONE_STEPS.map((text, i) => (
            <div key={i} className="rounded-3xl border border-border bg-card p-3">
              <IPhone className="max-w-[170px] border-[6px]"><PhoneStep step={i + 1} /></IPhone>
              <div className="mt-3 flex gap-2"><StepNo n={i + 1} /><p className="text-sm">{text}</p></div>
            </div>
          ))}
        </div>
        <Button asChild size="lg" className="mt-6 gap-2 rounded-full"><a href="/downloads/MovieMax.apk" download="MovieMax.apk"><Download className="size-4" />Download Android app</a></Button>
      </section>

      <section id="desktop" className="mx-auto mt-20 max-w-6xl px-4">
        <div className="flex items-center gap-2"><Monitor className="size-6 text-primary" /><h2 className="text-2xl font-black">Install on Windows</h2></div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PC_STEPS.map((text, i) => (
            <div key={i} className="rounded-3xl border border-border bg-card p-4">
              <WindowsStep step={i + 1} />
              <div className="mt-3 flex gap-2"><StepNo n={i + 1} /><p className="text-sm">{text}</p></div>
            </div>
          ))}
        </div>
        <Button asChild size="lg" className="mt-6 gap-2 rounded-full"><a href={desktopSetup.url}><Download className="size-4" />Download for Windows</a></Button>
      </section>

      <section id="tv" className="mx-auto mt-20 max-w-6xl px-4">
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-linear-to-br from-primary/20 to-accent/20 p-10 text-center">
          <Tv className="size-10 text-primary" />
          <h2 className="text-2xl font-black">MOVIE MAX for TV</h2>
          <p className="text-muted-foreground">Coming soon to Android TV and smart TVs.</p>
          <span className="rounded-full bg-muted px-4 py-1.5 text-sm font-bold">Coming soon</span>
        </div>
      </section>
    </main>
  );
}
