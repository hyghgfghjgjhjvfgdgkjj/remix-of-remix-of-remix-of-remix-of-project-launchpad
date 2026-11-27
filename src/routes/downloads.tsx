import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCircle2, Download, FolderDown, LayoutGrid, Pause, Play, RotateCw, Trash2, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/youku/MobileNav";
import { desktopMode, desktopSetup } from "@/components/youku/InstallAppButton";
import { isNativeApp, nativeBridge, nativeDownloads, type NativeDownload } from "@/lib/native-app";

export const Route = createFileRoute("/downloads")({
  head: () => ({
    meta: [
      { title: "Downloads — MOVIE MAX app" },
      { name: "description", content: "Your Movie max app downloads: pause, resume, watch offline and export to your phone." },
      { property: "og:title", content: "Downloads — MOVIE MAX app" },
      { property: "og:description", content: "Download movies and series in the Movie max app and watch them offline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DownloadsPage,
});

type Filter = "all" | "active" | "done";

const size = (n: number) => {
  if (!n || n < 0) return "0 MB";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i < 2 ? 0 : 1)} ${units[i]}`;
};

function statusLine(d: NativeDownload) {
  const pct = d.total > 0 ? Math.floor((d.done * 100) / d.total) : 0;
  const of = d.total > 0 ? ` / ${size(d.total)}` : "";
  switch (d.status) {
    case "done":
      return `Downloaded · ${size(d.total || d.done)}`;
    case "running":
      return `${pct}% · ${size(d.done)}${of}${d.speed > 0 ? ` · ${size(d.speed)}/s` : ""}`;
    case "queued":
      return "Waiting to start…";
    case "network":
      return `No internet · resumes automatically · ${size(d.done)}${of}`;
    case "failed":
      return d.error || "Stopped · tap Resume";
    default:
      return `Paused · ${pct}% · ${size(d.done)}${of}`;
  }
}

function DownloadsPage() {
  const [native, setNative] = useState(false);
  const [items, setItems] = useState<NativeDownload[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [alertsOn, setAlertsOn] = useState(true);
  const [onDesktop, setOnDesktop] = useState(false);
  useEffect(() => setOnDesktop(desktopMode() === "windows"), []);

  useEffect(() => {
    setNative(isNativeApp());
    const read = () => {
      setItems(nativeDownloads());
      setAlertsOn(nativeBridge()?.notificationsOn?.() ?? true);
    };
    read();
    const t = window.setInterval(read, 1000);
    return () => window.clearInterval(t);
  }, []);

  const bridge = typeof window === "undefined" ? null : nativeBridge();
  const control = (action: "pause" | "resume" | "cancel" | "delete", id: string) => {
    bridge?.control?.(action, id);
    window.setTimeout(() => setItems(nativeDownloads()), 300);
  };
  const addWidget = () => {
    const ok = bridge?.addWidget?.();
    if (!ok) toast("Long-press an empty spot on your home screen → Widgets → Movie max → Latest movies.", { duration: 7000 });
  };

  const list = (items ?? []).filter((d) => (filter === "all" ? true : filter === "done" ? d.status === "done" : d.status !== "done"));
  const activeCount = (items ?? []).filter((d) => d.status !== "done").length;
  const doneCount = (items ?? []).filter((d) => d.status === "done").length;

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-30 bg-background px-4 pb-2 pt-3">
        <h1 className="text-xl font-bold text-foreground">Downloads</h1>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([
            ["all", `All ${items?.length ?? 0}`],
            ["active", `Downloading ${activeCount}`],
            ["done", `Completed ${doneCount}`],
          ] as const).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              variant="ghost"
              onClick={() => setFilter(key)}
              className={`h-9 rounded-md text-[13px] font-semibold ${filter === key ? "bg-app-accent/20 text-app-accent hover:bg-app-accent/20" : "bg-muted text-foreground/75 hover:bg-muted"}`}
            >
              {label}
            </Button>
          ))}
        </div>
      </header>

      {native && bridge?.addWidget && (
        <div className="mx-4 mt-2 grid grid-cols-2 gap-2">
          <Button type="button" variant="ghost" onClick={addWidget} className="h-auto flex-col items-start gap-1 rounded-lg bg-muted p-3 text-left hover:bg-muted">
            <LayoutGrid className="size-5 text-app-accent" />
            <span className="text-[13px] font-semibold text-foreground">Add widget</span>
            <span className="whitespace-normal text-[11px] font-normal text-muted-foreground">Latest movies on your home screen</span>
          </Button>
          <Button type="button" variant="ghost" onClick={() => bridge.enableNotifications?.()} className="h-auto flex-col items-start gap-1 rounded-lg bg-muted p-3 text-left hover:bg-muted">
            <Bell className="size-5 text-app-accent" />
            <span className="text-[13px] font-semibold text-foreground">{alertsOn ? "Movie alerts on" : "Turn on alerts"}</span>
            <span className="whitespace-normal text-[11px] font-normal text-muted-foreground">{alertsOn ? "Tap to see the newest now" : "Get new movies in notifications"}</span>
          </Button>
        </div>
      )}

      <main className="px-4 pt-2">
        {!native ? (
          <div className="mt-16 text-center">
            <Download className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-3 font-semibold text-foreground">Downloads live in the Movie max app</p>
            <p className="mt-1 text-sm text-muted-foreground">{onDesktop ? "Install the Windows desktop app to save movies and watch them offline." : "Install the Android app to save movies and watch them offline."}</p>
            <a href={onDesktop ? desktopSetup.url : "/downloads/MovieMax.apk"} download={onDesktop ? "MovieMax-Setup.exe" : "MovieMax.apk"} className="app-gradient mt-5 inline-flex h-11 items-center gap-2 rounded-xl px-6 font-bold text-app-accent-foreground">
              <Download className="size-5" /> Get the app
            </a>
          </div>
        ) : items === null ? (
          <p className="mt-16 text-center text-sm text-muted-foreground">Update the app to manage downloads here.</p>
        ) : list.length === 0 ? (
          <div className="mt-16 text-center">
            <FolderDown className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">{filter === "all" ? "No downloads yet. Tap Download on any movie or episode." : "Nothing here yet."}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((d) => {
              const pct = d.total > 0 ? Math.min(100, (d.done * 100) / d.total) : 0;
              const running = d.status === "running" || d.status === "queued";
              const done = d.status === "done";
              return (
                <li key={d.id} className="rounded-lg bg-muted p-3">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-md ${done ? "bg-app-accent/20 text-app-accent" : "bg-background text-muted-foreground"}`}>
                      {done ? <CheckCircle2 className="size-5" /> : d.status === "network" ? <WifiOff className="size-5" /> : <Download className="size-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[14px] font-semibold text-foreground">{d.name.replace(/\.mp4$/i, "")}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">{statusLine(d)}</p>
                    </div>
                  </div>
                  {!done && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                      <div className="app-gradient h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  <div className="mt-2.5 flex gap-2">
                    {done ? (
                      <>
                        <Button variant="ghost" type="button" size="sm" onClick={() => bridge?.watch?.(d.id)} className="app-gradient h-8 flex-1 gap-1 rounded-md font-bold text-app-accent-foreground">
                          <Play className="size-4" /> Watch
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => bridge?.exportFile?.(d.id)} className="h-8 flex-1 gap-1 rounded-md bg-background text-foreground hover:bg-background">
                          <FolderDown className="size-4" /> Export
                        </Button>
                        <Button type="button" size="sm" variant="ghost" aria-label="Delete" onClick={() => window.confirm("Delete this download from the app?") && control("delete", d.id)} className="h-8 rounded-md bg-background px-3 text-destructive hover:bg-background">
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {running ? (
                          <Button type="button" size="sm" variant="ghost" onClick={() => control("pause", d.id)} className="h-8 flex-1 gap-1 rounded-md bg-background text-foreground hover:bg-background">
                            <Pause className="size-4" /> Pause
                          </Button>
                        ) : (
                          <Button variant="ghost" type="button" size="sm" onClick={() => control("resume", d.id)} className="app-gradient h-8 flex-1 gap-1 rounded-md font-bold text-app-accent-foreground">
                            <RotateCw className="size-4" /> {d.status === "network" ? "Continue" : "Resume"}
                          </Button>
                        )}
                        <Button type="button" size="sm" variant="ghost" onClick={() => window.confirm("Cancel this download?") && control("cancel", d.id)} className="h-8 flex-1 gap-1 rounded-md bg-background text-destructive hover:bg-background">
                          <X className="size-4" /> Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <MobileNav />
    </div>
  );
}
