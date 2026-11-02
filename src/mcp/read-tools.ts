import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { MaintenanceCategory, UpgradeCategory } from "@prisma/client";
import { specRuleOptions } from "@/domain/alerts";
import { telemetryItems } from "@/domain/telemetry";
import { firstLoggedKm, summarizeFinance, toFinanceEntries, type FinancePeriod } from "@/domain/finance";
import { formatKmPerLiter, formatLiters, summarizeFuel } from "@/domain/fuel";
import { recurrenceLabel } from "@/domain/recurrence";
import { alertDetail } from "@/lib/alert-text";
import { FUEL_CATEGORY_LABEL, FUEL_LABELS, MAINTENANCE_CATEGORIES, MAINTENANCE_LABELS, UPGRADE_LABELS } from "@/lib/categories";
import { todayDateOnly } from "@/lib/dates";
import { alertsOf, loadVehicle, loadVehicles, specOf, type LoadedVehicle } from "./data";
import { brl, day, done, failed, findVehicle, guard, km, userIdOf, vehicleRef } from "./helpers";

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const STATUS: Record<string, string> = { overdue: "atrasado", soon: "em breve", unknown: "sem histórico", ok: "em dia" };
const limitInput = z.number().int().min(1).max(200).default(20).describe("Quantos registros, mais recentes primeiro (padrão 20)");

async function vehicleOrError(userId: string, ref: string): Promise<LoadedVehicle | string> {
  const found = await findVehicle(userId, ref);
  if (typeof found === "string") return found;
  return (await loadVehicle(userId, found.id)) ?? "Veículo não encontrado";
}

const vehicleLine = (v: { make: string | null; model: string | null; year: number | null; engine: string | null; color: string | null }) =>
  [[v.make, v.model].filter(Boolean).join(" "), v.year, v.engine, v.color].filter(Boolean).join(" · ") || null;

export function registerReadTools(server: McpServer) {
  server.registerTool("list_vehicles", {
    title: "Listar veículos",
    description: "Lista os veículos da garagem com odômetro, contagem de alertas e gasto total. Use primeiro para descobrir ids e nomes.",
    inputSchema: z.object({}),
    annotations: READ,
  }, guard(async (_args, ctx) => {
    const vehicles = await loadVehicles(userIdOf(ctx));
    return done(vehicles.map((v) => {
      const alerts = alertsOf(v);
      const count = (s: string) => alerts.filter((a) => a.status === s).length;
      const spent = [...v.maintenances, ...v.upgrades, ...v.fuelRecords].reduce((a, r) => a + r.costCents, 0);
      return {
        id: v.id, name: v.name, plate: v.plate, details: vehicleLine(v), odometer: km(v.currentKm),
        alerts: { overdue: count("overdue"), soon: count("soon"), noHistory: count("unknown") },
        totalSpent: brl(spent),
      };
    }));
  }));

  server.registerTool("get_vehicle", {
    title: "Ver veículo",
    description: "Detalhes de um veículo: dados, odômetro, ficha técnica com o estado de cada item (quanto falta para a próxima troca), alertas personalizados e os itens da ficha que uma manutenção pode marcar (use os ids em add_maintenance.items).",
    inputSchema: z.object({ vehicle: vehicleRef }),
    annotations: READ,
  }, guard(async ({ vehicle }, ctx) => {
    const v = await vehicleOrError(userIdOf(ctx), vehicle);
    if (typeof v === "string") return failed(v);
    const spec = specOf(v);
    const alerts = alertsOf(v);
    const fuel = summarizeFuel(v.fuelRecords);
    return done({
      id: v.id, name: v.name, plate: v.plate, make: v.make, model: v.model, year: v.year, engine: v.engine, color: v.color,
      odometer: km(v.currentKm),
      specSheet: telemetryItems(spec, alerts).map((t) => ({
        item: t.label,
        spec: [t.value, ...t.details].filter(Boolean).join(" · ") || null,
        interval: t.interval,
        status: t.alert ? STATUS[t.alert.status] : null,
        detail: t.alert ? alertDetail(t.alert) : null,
        lastService: t.alert && (t.alert.lastDate || t.alert.lastKm != null)
          ? [t.alert.lastDate && day(t.alert.lastDate), t.alert.lastKm != null && km(t.alert.lastKm)].filter(Boolean).join(" · ")
          : null,
      })),
      specNotes: spec.freeNotes ?? null,
      rawSpec: spec,
      maintenanceItems: specRuleOptions(spec).map((r) => ({ id: r.id, label: r.label, category: r.category })),
      customAlerts: v.customAlerts.map((c) => {
        const state = alerts.find((a) => a.source === "custom" && a.id === c.id);
        return {
          id: c.id, label: c.label, dueDate: c.dueDate && day(c.dueDate), dueKm: c.dueKm, repeats: recurrenceLabel(c),
          done: c.done, status: state ? STATUS[state.status] : null, detail: state ? alertDetail(state) : null,
        };
      }),
      counts: { maintenance: v.maintenances.length, upgrades: v.upgrades.length, fuel: v.fuelRecords.length },
      fuel: fuel.avgKmPerLiter != null ? { averageConsumption: formatKmPerLiter(fuel.avgKmPerLiter), lastConsumption: fuel.lastKmPerLiter != null ? formatKmPerLiter(fuel.lastKmPerLiter) : null } : null,
    });
  }));

  server.registerTool("get_alerts", {
    title: "Ver alertas",
    description: "Alertas que pedem atenção (atrasados, em breve, sem histórico) de um veículo ou de todos. Itens da ficha (kind=spec) somem ao registrar a manutenção com o item marcado; alertas personalizados (kind=custom) são concluídos com complete_alert.",
    inputSchema: z.object({
      vehicle: vehicleRef.optional().describe("Veículo (id ou nome). Vazio: todos"),
      includeNoHistory: z.boolean().default(true).describe("Incluir itens sem nenhum registro ainda"),
    }),
    annotations: READ,
  }, guard(async ({ vehicle, includeNoHistory }, ctx) => {
    const userId = userIdOf(ctx);
    let vehicles = await loadVehicles(userId);
    if (vehicle) {
      const found = await findVehicle(userId, vehicle);
      if (typeof found === "string") return failed(found);
      vehicles = vehicles.filter((v) => v.id === found.id);
    }
    const rank = { overdue: 0, soon: 1, unknown: 2, ok: 3 };
    const items = vehicles
      .flatMap((v) => alertsOf(v)
        .filter((a) => a.status === "overdue" || a.status === "soon" || (includeNoHistory && a.status === "unknown"))
        .map((a) => ({ a, v })))
      .sort((x, y) => rank[x.a.status] - rank[y.a.status])
      .map(({ a, v }) => ({ vehicle: v.name, vehicleId: v.id, kind: a.source, id: a.id, label: a.label, status: STATUS[a.status], detail: alertDetail(a) }));
    return done(items.length ? items : "Nada atrasado ou próximo");
  }));

  server.registerTool("list_maintenance", {
    title: "Listar manutenções",
    description: "Histórico de manutenções de um veículo, mais recentes primeiro, com ids para editar ou excluir.",
    inputSchema: z.object({
      vehicle: vehicleRef,
      limit: limitInput,
      category: z.enum(MAINTENANCE_CATEGORIES as [MaintenanceCategory, ...MaintenanceCategory[]]).optional().describe("Filtrar por categoria"),
      since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Só a partir desta data (AAAA-MM-DD)"),
    }),
    annotations: READ,
  }, guard(async ({ vehicle, limit, category, since }, ctx) => {
    const v = await vehicleOrError(userIdOf(ctx), vehicle);
    if (typeof v === "string") return failed(v);
    const items = new Map(specRuleOptions(specOf(v)).map((r) => [r.id, r.label]));
    const rows = v.maintenances
      .filter((m) => (!category || m.category === category) && (!since || day(m.date) >= since))
      .slice(0, limit)
      .map((m) => ({
        id: m.id, date: day(m.date), km: km(m.km), category: MAINTENANCE_LABELS[m.category], title: m.title,
        items: m.specRuleIds.map((id) => items.get(id) ?? id), workshop: m.workshop, cost: brl(m.costCents), notes: m.notes,
        attachments: m._count.attachments,
      }));
    return done(rows.length ? rows : "Nenhuma manutenção encontrada");
  }));

  server.registerTool("list_upgrades", {
    title: "Listar upgrades",
    description: "Upgrades (modificações) de um veículo, mais recentes primeiro, com ids para editar ou excluir.",
    inputSchema: z.object({ vehicle: vehicleRef, limit: limitInput }),
    annotations: READ,
  }, guard(async ({ vehicle, limit }, ctx) => {
    const v = await vehicleOrError(userIdOf(ctx), vehicle);
    if (typeof v === "string") return failed(v);
    const rows = v.upgrades.slice(0, limit).map((u) => ({
      id: u.id, date: day(u.date), name: u.name, category: UPGRADE_LABELS[u.category], supplier: u.supplier,
      cost: brl(u.costCents), notes: u.notes, attachments: u._count.attachments,
    }));
    return done(rows.length ? rows : "Nenhum upgrade registrado");
  }));

  server.registerTool("list_fuel", {
    title: "Listar abastecimentos",
    description: "Abastecimentos de um veículo (mais recentes primeiro) com consumo por tanque, e o resumo: consumo médio, último consumo, custo por km e total. O consumo é medido entre tanques cheios.",
    inputSchema: z.object({ vehicle: vehicleRef, limit: limitInput }),
    annotations: READ,
  }, guard(async ({ vehicle, limit }, ctx) => {
    const v = await vehicleOrError(userIdOf(ctx), vehicle);
    if (typeof v === "string") return failed(v);
    const s = summarizeFuel(v.fuelRecords);
    return done({
      summary: {
        fills: s.fills,
        averageConsumption: s.avgKmPerLiter != null ? formatKmPerLiter(s.avgKmPerLiter) : null,
        lastConsumption: s.lastKmPerLiter != null ? formatKmPerLiter(s.lastKmPerLiter) : null,
        fuelCostPerKm: s.costPerKmCents != null ? brl(s.costPerKmCents) : null,
        averagePricePerLiter: s.avgPricePerLiterCents != null ? brl(s.avgPricePerLiterCents) : null,
        totalSpent: brl(s.totalCents),
        totalLiters: formatLiters(s.totalLiters),
      },
      fills: [...s.records].reverse().slice(0, limit).map((r) => ({
        id: r.id, date: day(r.date), km: km(r.km), liters: formatLiters(r.liters), total: brl(r.costCents),
        pricePerLiter: r.pricePerLiterCents != null ? brl(r.pricePerLiterCents) : null, fuel: FUEL_LABELS[r.fuel],
        fullTank: r.fullTank, consumption: r.kmPerLiter != null ? formatKmPerLiter(r.kmPerLiter) : null, station: r.station, notes: r.notes,
      })),
    });
  }));

  server.registerTool("get_finance", {
    title: "Resumo financeiro",
    description: "Gastos de um veículo ou da garagem toda no período: total, média mensal, custo por km (todo o histórico), maior despesa, por categoria e por mês.",
    inputSchema: z.object({
      vehicle: vehicleRef.optional().describe("Veículo (id ou nome). Vazio: todos"),
      period: z.enum(["6m", "12m", "year", "all"]).default("all").describe("6m e 12m contam meses inteiros até o atual; year = ano corrente; all = tudo"),
    }),
    annotations: READ,
  }, guard(async ({ vehicle, period }, ctx) => {
    const userId = userIdOf(ctx);
    let vehicles = await loadVehicles(userId);
    if (vehicle) {
      const found = await findVehicle(userId, vehicle);
      if (typeof found === "string") return failed(found);
      vehicles = vehicles.filter((v) => v.id === found.id);
    }
    const s = summarizeFinance({
      entries: vehicles.flatMap(toFinanceEntries),
      odometers: vehicles.map((v) => ({ vehicleId: v.id, currentKm: v.currentKm, firstKm: firstLoggedKm(v) })),
      today: todayDateOnly(),
      period: period as FinancePeriod,
    });
    const categoryLabel = (kind: string, category: string) =>
      kind === "fuel" ? FUEL_CATEGORY_LABEL : kind === "upgrade" ? `${UPGRADE_LABELS[category as UpgradeCategory]} (upgrade)` : MAINTENANCE_LABELS[category as MaintenanceCategory];
    const names = new Map(vehicles.map((v) => [v.id, v.name]));
    return done({
      period,
      total: brl(s.totalCents),
      split: { maintenance: brl(s.maintenanceCents), upgrades: brl(s.upgradeCents), fuel: brl(s.fuelCents) },
      monthlyAverage: brl(s.monthlyAvgCents),
      costPerKmAllTime: s.costPerKmCents != null ? brl(s.costPerKmCents) : null,
      largestExpense: s.maxExpense ? { title: s.maxExpense.title, date: day(s.maxExpense.date), cost: brl(s.maxExpense.costCents) } : null,
      byCategory: s.byCategory.map((c) => ({ category: categoryLabel(c.kind, c.category), total: brl(c.cents) })),
      byVehicle: Object.entries(s.byVehicle).map(([id, cents]) => ({ vehicle: names.get(id) ?? id, total: brl(cents) })),
      byMonth: s.byMonth.slice(-24).map((m) => ({ month: m.month, total: brl(m.cents) })),
    });
  }));
}
