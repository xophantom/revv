import { describe, it, expect } from "vitest";
import type { AlertStatus } from "@/domain/alerts";
import { digestItems, digestKey, planDigest, DIGEST_REPEAT_DAYS, type DigestItem } from "@/lib/alert-digest";
import { alertDigestEmail, alertLink, alertMailer, appBaseUrl, digestSubject } from "@/lib/alert-email";

function item(id: string, status: AlertStatus, over: Partial<DigestItem> = {}): DigestItem {
  return {
    id, label: id, status, source: "custom", driver: "km",
    remainingKm: status === "overdue" ? -2430 : 800, remainingDays: null,
    intervalKm: null, intervalMonths: null, lastKm: null, lastDate: null,
    vehicleId: "v1", vehicleName: "Civic",
    ...over,
  };
}

const today = new Date("2026-11-02");
const alerts = [item("a", "overdue"), item("b", "soon"), item("c", "ok"), item("d", "unknown")];

describe("digestItems", () => {
  it("keeps only overdue and soon, overdue first", () => {
    const out = digestItems([item("s", "soon"), item("ok", "ok"), item("o", "overdue"), item("u", "unknown")]);
    expect(out.map((a) => a.id)).toEqual(["o", "s"]);
  });
});

describe("digestKey", () => {
  it("ignores order", () => {
    expect(digestKey([item("a", "overdue"), item("b", "soon")])).toBe(digestKey([item("b", "soon"), item("a", "overdue")]));
  });
  it("changes with the status, the alert or the vehicle", () => {
    const k = digestKey([item("a", "soon")]);
    expect(digestKey([item("a", "overdue")])).not.toBe(k);
    expect(digestKey([item("x", "soon")])).not.toBe(k);
    expect(digestKey([item("a", "soon", { vehicleId: "v2" })])).not.toBe(k);
  });
  it("ignores wording that changes daily", () => {
    expect(digestKey([item("a", "overdue", { remainingKm: -10 })])).toBe(digestKey([item("a", "overdue", { remainingKm: -900 })]));
  });
});

describe("planDigest", () => {
  const key = digestKey(digestItems(alerts));

  it("sends nothing when no item is overdue or soon", () => {
    expect(planDigest({ alerts: [item("c", "ok"), item("d", "unknown")], lastKey: null, lastAt: null, today })).toEqual({ send: false });
  });

  it("sends the first time", () => {
    const plan = planDigest({ alerts, lastKey: null, lastAt: null, today });
    expect(plan.send).toBe(true);
    if (plan.send) {
      expect(plan.items.map((a) => a.id)).toEqual(["a", "b"]);
      expect(plan.key).toBe(key);
    }
  });

  it("skips an unchanged list sent less than a week ago", () => {
    const lastAt = new Date("2026-10-27T11:00:05Z"); // 6 days
    expect(planDigest({ alerts, lastKey: key, lastAt, today }).send).toBe(false);
  });

  it("repeats an unchanged list after 7 days, even if this run is seconds earlier", () => {
    const lastAt = new Date("2026-10-26T11:00:05Z");
    expect(DIGEST_REPEAT_DAYS).toBe(7);
    expect(planDigest({ alerts, lastKey: key, lastAt, today }).send).toBe(true);
  });

  it("counts days in the app timezone", () => {
    // 01:00 UTC on the 27th is still the 26th in São Paulo: 7 calendar days
    const lastAt = new Date("2026-10-27T01:00:00Z");
    expect(planDigest({ alerts, lastKey: key, lastAt, today }).send).toBe(true);
  });

  it("sends nothing when an item is resolved and nothing new appears", () => {
    const lastAt = new Date("2026-11-01T11:00:00Z");
    expect(planDigest({ alerts: [item("a", "overdue")], lastKey: key, lastAt, today }).send).toBe(false);
  });

  it("sends when a new item appears, even with others resolved", () => {
    const lastAt = new Date("2026-11-01T11:00:00Z");
    expect(planDigest({ alerts: [item("a", "overdue"), item("z", "soon")], lastKey: key, lastAt, today }).send).toBe(true);
  });

  it("sends as soon as the list changes", () => {
    const lastAt = new Date("2026-11-01T11:00:00Z");
    const escalated = [item("a", "overdue"), item("b", "overdue")];
    expect(planDigest({ alerts: escalated, lastKey: key, lastAt, today }).send).toBe(true);
  });
});

describe("alert e-mail", () => {
  const items = [
    item("engineOil", "overdue", { label: "Troca de óleo", source: "spec" }),
    item("c1", "soon", { label: "IPVA <2027>", driver: "time", remainingKm: null, remainingDays: 13, vehicleId: "v2", vehicleName: "Fusca & cia" }),
    item("c2", "overdue", { label: "Seguro", driver: "time", remainingKm: null, remainingDays: -13, vehicleId: "v2", vehicleName: "Fusca & cia" }),
  ];

  it("summarizes the counts in the subject", () => {
    expect(digestSubject(items)).toBe("Revv: 2 atrasados, 1 em breve");
    expect(digestSubject([items[0]])).toBe("Revv: 1 atrasado");
    expect(digestSubject([items[1]])).toBe("Revv: 1 em breve");
  });

  it("escapes HTML and groups items per vehicle with their detail and links", () => {
    const { html, text } = alertDigestEmail({ items, baseUrl: "https://revv.app" });
    expect(html).toContain("IPVA &lt;2027&gt;");
    expect(html).toContain("Fusca &amp; cia");
    expect(html).not.toContain("IPVA <2027>");
    expect(html).toContain("https://revv.app/garage/v1?registrar=engineOil");
    expect(html).toContain("https://revv.app/garage/v2#alertas");
    expect(html).toContain("https://revv.app/dashboard");
    expect(text).toContain("- [atrasado] Troca de óleo: passou 2.430 km");
    expect(text).toContain("- [atrasado] Seguro: venceu há 13 dias");
    expect(text).toContain("- [em breve] IPVA <2027>: faltam 13 dias");
    expect(text.indexOf("Fusca & cia")).toBeGreaterThan(text.indexOf("Troca de óleo"));
  });

  it("links spec items to the service form and custom ones to the alert list", () => {
    expect(alertLink("https://x", { vehicleId: "v 1", id: "engineOil", source: "spec" })).toBe("https://x/garage/v%201?registrar=engineOil");
    expect(alertLink("https://x", { vehicleId: "v1", id: "c1", source: "custom" })).toBe("https://x/garage/v1#alertas");
  });

  it("picks the base URL from APP_URL, AUTH_URL, then the Vercel production host", () => {
    expect(appBaseUrl({ APP_URL: "https://revv.app/", AUTH_URL: "https://a.dev" })).toBe("https://revv.app");
    expect(appBaseUrl({ AUTH_URL: "https://a.dev/api/auth" })).toBe("https://a.dev");
    expect(appBaseUrl({ VERCEL_PROJECT_PRODUCTION_URL: "revv.vercel.app" })).toBe("https://revv.vercel.app");
    expect(appBaseUrl({}, "http://localhost:3000")).toBe("http://localhost:3000");
    expect(appBaseUrl({})).toBeNull();
  });

  it("uses its own Resend settings, falling back to the login ones", () => {
    expect(alertMailer({})).toBeNull();
    expect(alertMailer({ AUTH_RESEND_KEY: "k1", AUTH_EMAIL_FROM: "A <a@x>" })).toEqual({ apiKey: "k1", from: "A <a@x>" });
    expect(alertMailer({ RESEND_API_KEY: "k2", AUTH_RESEND_KEY: "k1", ALERT_EMAIL_FROM: "B <b@x>", AUTH_EMAIL_FROM: "A <a@x>" }))
      .toEqual({ apiKey: "k2", from: "B <b@x>" });
  });
});
