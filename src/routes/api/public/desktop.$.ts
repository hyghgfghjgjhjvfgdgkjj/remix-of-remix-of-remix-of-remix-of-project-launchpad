import { createFileRoute } from "@tanstack/react-router";
import { fetchHome, fetchMostTrending, searchCatalog, fetchDetails, fetchSources, fetchRelated } from "@/lib/moviebox";
import { CATEGORIES, isAdultItem } from "@/lib/categories";
import { restListTitles } from "@/lib/luo-rest";
import { fsWhere } from "@/lib/developer-api";

const DESKTOP_PLANS = {
  vip: [
    { id: "daily", name: "Daily pass", price: 1000, days: 1, note: "HD 720p · 1 device", devices: 1 },
    { id: "weekly", name: "Weekly", price: 5000, days: 7, note: "Full HD · 2 devices", devices: 2 },
    { id: "monthly", name: "Monthly", price: 15000, days: 30, note: "Full HD · 4 devices", devices: 4 },
  ],
  svip: [
    { id: "s-monthly", name: "Monthly Premium", price: 25000, days: 30, note: "4K · 4 devices", devices: 4 },
    { id: "s-quarterly", name: "Quarterly Premium", price: 60000, days: 90, note: "4K · downloads", devices: 4 },
    { id: "s-yearly", name: "Yearly Premium", price: 180000, days: 365, note: "4K · TV app · no ads", devices: 5 },
  ],
};
let uploadsCache: { at: number; rows: Awaited<ReturnType<typeof restListTitles>> } | null = null;
let plansCache: { at: number; v: unknown } | null = null;

/** Data for the standalone desktop app: catalog, categories, details and in-app play links. */
const cors = { "access-control-allow-origin": "*" };
const json = (d: unknown, s = 120) => Response.json(d, { headers: { ...cors, "cache-control": `public, max-age=${s}` } });
const cats = () => CATEGORIES.filter((c) => !c.adult && c.slug !== "home").map((c) => ({ slug: c.slug, label: c.short, icon: c.icon, type: c.type ?? null }));
const nb = async (p: string) => {
  const r = await fetch(`https://portal.naraboxtv.com/api/v1/${p}`, { signal: AbortSignal.timeout(12000), headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("Luganda unavailable");
  return r.json() as Promise<any>;
};

export const Route = createFileRoute("/api/public/desktop/$")({
  server: { handlers: { POST: async ({ request, params }) => {
    if (params._splat !== "pay") return json({ error: "Not found" }, 0);
    try {
      const b = (await request.json()) as { phone?: string; amount?: number; reference?: string; description?: string };
      const phone = String(b.phone ?? "").replace(/\D/g, "").slice(0, 15);
      const amount = Number(b.amount);
      if (phone.length < 9 || !(amount > 0) || !/^LUO-[\w-]{6,80}$/.test(String(b.reference))) return json({ status: "failed", message: "Check the phone number" }, 0);
      const { startDeposit } = await import("@/lib/pawapay.server");
      return json(await startDeposit({ phone: phone.startsWith("0") ? "256" + phone.slice(1) : phone, amount, currency: "UGX", reference: String(b.reference), description: String(b.description ?? "Subscription").slice(0, 60) }), 0);
    } catch (e) { return json({ status: "failed", message: e instanceof Error ? e.message : "Payment failed" }, 0); }
  }, GET: async ({ request, params }) => {
    const url = new URL(request.url); const q = url.searchParams;
    const [action, id] = (params._splat ?? "").split("/");
    try {
      switch (action) {
        case "home": {
          const [home, trending] = await Promise.allSettled([fetchHome(), fetchMostTrending()]);
          const h = home.status === "fulfilled" ? home.value : { rows: [] as any[] };
          return json({ trending: trending.status === "fulfilled" ? trending.value : [], rows: h.rows, categories: cats() }, 300);
        }
        case "uploads": {
          const lang = id === "teso" ? "teso" : id === "luo" ? "luo" : "luganda";
          if (!uploadsCache || Date.now() - uploadsCache.at > 600_000) {
            const rows = await restListTitles();
            if (rows.length) uploadsCache = { at: Date.now(), rows };
          }
          const items = (uploadsCache?.rows ?? []).filter((t) => t.language === lang && t.poster)
            .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 60)
            .map((t) => ({ id: `up-${t.id}`, title: t.title, poster: t.poster, year: t.year, genre: t.genre ?? "", vj: t.vj, type: "movie", direct: t.videoUrl, description: t.description }));
          return json({ items }, 300);
        }
        case "plans": {
          if (!plansCache || Date.now() - plansCache.at > 600_000) {
            const row = await fsWhere("app_settings", "key", "plans").then((r) => r[0]).catch(() => null);
            plansCache = { at: Date.now(), v: (row?.["value"] as unknown) ?? DESKTOP_PLANS };
          }
          return json({ plans: plansCache.v }, 300);
        }
        case "pay-status": {
          if (!/^[0-9a-f-]{36}$/i.test(id ?? "")) return json({ status: "failed", message: "Bad id" }, 0);
          const { depositStatus } = await import("@/lib/pawapay.server");
          return json(await depositStatus(id!), 0);
        }
        case "category": {
          if (id === "trending") { const items = (await fetchMostTrending()).filter((i) => i.poster && !isAdultItem(i)); if (items.length && (Number(q.get("page")) || 1) === 1) return json({ items }, 300); }
          const c = CATEGORIES.find((x) => x.slug === id && !x.adult);
          if (!c) return json({ items: [] });
          const page = Math.max(1, Math.min(200, Number(q.get("page")) || 1));
          const lists = await Promise.allSettled((c.keywords ?? [c.keyword]).slice(0, 4).map((k) => searchCatalog(k, page)));
          const seen = new Set<string>();
          const items = lists.flatMap((l) => (l.status === "fulfilled" ? l.value : []))
            .filter((i) => i.poster && !isAdultItem(i) && (!c.type || i.type === c.type) && !seen.has(i.id) && seen.add(i.id));
          return json({ items }, 300);
        }
        case "search": {
          const term = (q.get("q") ?? "").trim().slice(0, 120);
          return json({ items: term ? (await searchCatalog(term, 1)).filter((i) => !isAdultItem(i)) : [] }, 120);
        }
        case "luganda": {
          const kind = id === "tv-shows" ? "tv-shows" : "movies";
          const page = Math.max(1, Number(q.get("page")) || 1);
          const body = await nb(`${kind}?page=${page}&per_page=30&sort=latest&order=desc`);
          return json({ items: (body.data ?? []).filter((i: any) => i.is_playable !== false && (kind === "tv-shows" || i.videoUrl)).map((i: any) => ({ id: `nb-${kind}-${i.id}`, title: i.title, poster: i.thumbnail, backdrop: i.backdrop, year: i.releaseDate?.slice(0, 4) ?? null, genre: (i.genre ?? []).join(", "), type: kind === "movies" ? "movie" : "series", vj: i.vj })) }, 300);
        }
        case "title": {
          if (!id) return json({ error: "Missing id" });
          const m = /^nb-(movies|tv-shows)-(\d+)$/.exec(id);
          if (m) {
            const raw = await nb(`${m[1]}/${m[2]}`); const d = raw.data ?? raw ?? {};
            const eps = (d.seasons ?? []).flatMap((s: any) => s.episodes.filter((e: any) => e.videoUrl).map((e: any) => ({ season: s.number, episode: e.number, title: e.title, url: e.videoUrl })));
            return json({ id, title: d.title, description: d.description, poster: d.thumbnail, backdrop: d.backdrop, year: d.releaseDate?.slice(0, 4) ?? null, genre: (d.genre ?? []).join(", "), vj: d.vj, seasons: [], luganda: { url: d.videoUrl ?? null, episodes: eps } });
          }
          if (!/^\d{1,80}$/.test(id)) return json({ error: "Invalid id" });
          return json(await fetchDetails(id), 300);
        }
        case "related": {
          if (!id || !/^\d{1,80}$/.test(id)) return json({ items: [] });
          const d = await fetchDetails(id);
          return json({ items: (await fetchRelated(d)).filter((i) => !isAdultItem(i)).slice(0, 18) }, 600);
        }
        case "play": {
          if (!id || !/^\d{1,80}$/.test(id)) return json({ sources: [] });
          const se = Number(q.get("se")) || 0, ep = Number(q.get("ep")) || 0;
          const list = await fetchSources(id, se, ep);
          const sources = list.filter((s) => !s.promo).map((s) => {
            const p = new URLSearchParams({ subjectId: id, se: String(se), ep: String(se > 0 ? Math.max(1, ep) : 0), resourceId: s.id, res: String(s.resolution || 0) });
            const d = new URLSearchParams(p); d.set("dl", `${(q.get("name") || "movie").replace(/[^\w\s.()-]+/g, "").trim().slice(0, 80) || "movie"} ${s.resolution}p.mp4`);
            return { resolution: s.resolution, size: s.size, url: `${url.origin}/api/public/movie?${p}`, download: `${url.origin}/api/public/movie?${d}`, subtitles: s.captions.map((c) => ({ label: c.label, url: `${url.origin}/api/public/subtitle?url=${encodeURIComponent(c.url)}` })) };
          }).sort((a, b) => b.resolution - a.resolution);
          return json({ sources }, 20);
        }
      }
      return json({ error: "Unknown action" });
    } catch {
      return Response.json({ error: "Unavailable" }, { status: 503, headers: cors });
    }
  } } },
});
