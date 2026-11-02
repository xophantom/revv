import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { FuelType, MaintenanceCategory, UpgradeCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { specRuleOptions } from "@/domain/alerts";
import { vehicleSpecSchema } from "@/domain/spec-schema";
import { litersToMl } from "@/domain/fuel";
import { FUEL_TYPES, MAINTENANCE_CATEGORIES, UPGRADE_CATEGORIES } from "@/lib/categories";
import * as vehicles from "@/server/vehicles";
import * as maintenance from "@/server/maintenance";
import * as upgrades from "@/server/upgrades";
import * as fuel from "@/server/fuel";
import * as alerts from "@/server/alerts";
import * as spec from "@/server/spec";
import { specOf } from "./data";
import { brl, dateInput, day, failed, findVehicle, fromAction, guard, idInput, km, kmInput, reaisInput, toCents, today, userIdOf, vehicleRef } from "./helpers";

const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
// Edits can overwrite or clear fields (and update_spec can turn alerts off), so they aren't additive.
const EDIT = { ...WRITE, destructiveHint: true, idempotentHint: true } as const;
const DELETE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } as const;

const maintenanceCategory = z.enum(MAINTENANCE_CATEGORIES as [MaintenanceCategory, ...MaintenanceCategory[]])
  .describe("OIL Óleo · FILTERS Filtros · BRAKES Freios · TIRES Pneus · REVISION Revisão · SUSPENSION Suspensão · ELECTRICAL Elétrica · FLUIDS Fluidos · OTHER Outro");
const upgradeCategory = z.enum(UPGRADE_CATEGORIES as [UpgradeCategory, ...UpgradeCategory[]])
  .describe("EXHAUST Escape · WHEELS Rodas · ECU ECU/Remap · SUSPENSION Suspensão · AESTHETIC Estética · AUDIO Som · BRAKES Freios · OTHER Outro");
const fuelType = z.enum(FUEL_TYPES as [FuelType, ...FuelType[]]).describe("GASOLINE Gasolina · ETHANOL Etanol · DIESEL Diesel · OTHER Outro");
// Optional text on edits: omit to keep, null to clear.
const clearable = (what: string) => z.string().nullable().optional().describe(`${what}. Omita para manter, null para apagar`);
const blankIfNull = (v: string | null | undefined, keep: string | null) => (v === undefined ? keep ?? "" : v ?? "");

async function vehicleIdOf(userId: string, ref: string) {
  const found = await findVehicle(userId, ref);
  return typeof found === "string" ? { error: found } : { id: found.id, name: found.name };
}

const odometerNote = (km_: number | null) => (km_ != null ? `odômetro atualizado para ${km(km_)}` : undefined);

// Spec sheet groups with every field nullable, so update_spec can clear one (null) or keep it (omit).
type AnyObject = z.ZodObject<Record<string, z.ZodType>>;
const specChanges = z.object(Object.fromEntries(Object.entries(vehicleSpecSchema.shape).map(([group, schema]) => {
  const inner = (schema as unknown as z.ZodOptional<z.ZodType>).unwrap();
  if (!(inner instanceof z.ZodObject)) return [group, (inner as z.ZodType).nullable().optional()];
  const fields = Object.fromEntries(Object.entries((inner as AnyObject).shape).map(([f, s]) =>
    [f, (s as unknown as z.ZodOptional<z.ZodType>).unwrap().nullable().optional()]));
  return [group, z.object(fields).nullable().optional()];
})));

export function registerWriteTools(server: McpServer) {
  // --- vehicles -------------------------------------------------------------------------------

  server.registerTool("create_vehicle", {
    title: "Cadastrar veículo",
    description: "Cadastra um veículo novo na garagem.",
    inputSchema: z.object({
      name: z.string().min(1).describe("Apelido, ex.: Golf GTI"),
      plate: z.string().optional(), make: z.string().optional().describe("Marca"), model: z.string().optional().describe("Modelo"),
      year: z.number().int().min(1900).max(2100).optional(), engine: z.string().optional().describe("Motor, ex.: 2.0 TSI"),
      color: z.string().optional(), odometer: kmInput.optional().describe("Km atual"),
    }),
    annotations: WRITE,
  }, guard(async ({ odometer, plate, ...rest }, ctx) => {
    const res = await vehicles.createVehicle(userIdOf(ctx), { ...rest, plate: plate?.toUpperCase(), currentKm: odometer ?? 0 });
    return fromAction(res, (d) => ({ id: d.id, message: `Veículo "${rest.name}" cadastrado` }));
  }));

  server.registerTool("update_vehicle", {
    title: "Editar veículo",
    description: "Altera dados de um veículo. Envie só o que muda; null apaga o campo. Para o odômetro, prefira update_odometer.",
    inputSchema: z.object({
      vehicle: vehicleRef,
      name: z.string().min(1).optional(), plate: clearable("Placa"), make: clearable("Marca"), model: clearable("Modelo"),
      year: z.number().int().min(1900).max(2100).nullable().optional(), engine: clearable("Motor"), color: clearable("Cor"),
    }),
    annotations: EDIT,
  }, guard(async ({ vehicle, ...changes }, ctx) => {
    const userId = userIdOf(ctx);
    const v = await vehicleIdOf(userId, vehicle);
    if ("error" in v) return failed(v.error!);
    // Omitted fields stay undefined, which the service leaves untouched.
    const res = await vehicles.updateVehicle(userId, v.id, { ...changes, name: changes.name ?? v.name, plate: changes.plate?.toUpperCase() ?? changes.plate });
    return fromAction(res, () => ({ message: "Veículo atualizado" }));
  }));

  server.registerTool("update_odometer", {
    title: "Atualizar odômetro",
    description: "Define a quilometragem atual do veículo. Registrar manutenção ou abastecimento com km maior já atualiza sozinho.",
    inputSchema: z.object({ vehicle: vehicleRef, km: kmInput }),
    annotations: EDIT,
  }, guard(async ({ vehicle, km: value }, ctx) => {
    const userId = userIdOf(ctx);
    const v = await vehicleIdOf(userId, vehicle);
    if ("error" in v) return failed(v.error!);
    return fromAction(await vehicles.updateKm(userId, v.id, value), () => ({ message: `Odômetro: ${km(value)}` }));
  }));

  // --- maintenance ----------------------------------------------------------------------------

  server.registerTool("add_maintenance", {
    title: "Registrar manutenção",
    description: "Registra uma manutenção feita. Marque em `items` os itens da ficha que foram trocados (ids em get_vehicle → maintenanceItems): é isso que zera os alertas de cada item. Um km maior que o odômetro atualiza o odômetro.",
    inputSchema: z.object({
      vehicle: vehicleRef,
      title: z.string().min(1).describe("Ex.: Troca de óleo e filtro"),
      category: maintenanceCategory,
      km: kmInput,
      date: dateInput.optional(),
      items: z.array(z.string()).default([]).describe("Ids dos itens da ficha feitos neste serviço, ex.: [\"engineOil\", \"airFilter\"]"),
      cost: reaisInput.optional(),
      workshop: z.string().optional().describe("Oficina"),
      notes: z.string().optional(),
    }),
    annotations: WRITE,
  }, guard(async ({ vehicle, items, cost, date, ...rest }, ctx) => {
    const userId = userIdOf(ctx);
    const found = await findVehicle(userId, vehicle);
    if (typeof found === "string") return failed(found);
    const v = await db.vehicle.findFirst({ where: { id: found.id, userId }, include: { spec: true } });
    const known = specRuleOptions(specOf(v!)).map((r) => r.id);
    const unknown = items.filter((i) => !known.includes(i));
    if (unknown.length) return failed(`Itens desconhecidos na ficha deste veículo: ${unknown.join(", ")}. Válidos: ${known.join(", ") || "nenhum (ficha sem intervalos)"}`);
    const res = await maintenance.createMaintenance(userId, found.id, {
      ...rest, date: date ?? today(), specRuleIds: items, costCents: toCents(cost ?? 0), attachments: [],
    });
    return fromAction(res, (d) => ({ id: d.id, message: `Manutenção registrada em ${found.name}`, odometer: odometerNote(d.odometerUpdatedTo) }));
  }));

  server.registerTool("update_maintenance", {
    title: "Editar manutenção",
    description: "Altera uma manutenção (id em list_maintenance). Envie só o que muda. Anexos não mudam.",
    inputSchema: z.object({
      id: idInput("da manutenção"),
      title: z.string().min(1).optional(), category: maintenanceCategory.optional(), km: kmInput.optional(), date: dateInput.optional(),
      items: z.array(z.string()).optional().describe("Substitui a lista de itens da ficha"),
      cost: reaisInput.optional(), workshop: clearable("Oficina"), notes: clearable("Notas"),
    }),
    annotations: EDIT,
  }, guard(async ({ id, items, cost, date, workshop, notes, ...rest }, ctx) => {
    const userId = userIdOf(ctx);
    const m = await db.maintenanceRecord.findFirst({ where: { id, vehicle: { userId } }, include: { vehicle: { include: { spec: true } } } });
    if (!m) return failed("Manutenção não encontrada");
    if (items) {
      const known = specRuleOptions(specOf(m.vehicle)).map((r) => r.id);
      const unknown = items.filter((i) => !known.includes(i));
      if (unknown.length) return failed(`Itens desconhecidos na ficha deste veículo: ${unknown.join(", ")}. Válidos: ${known.join(", ") || "nenhum"}`);
    }
    const res = await maintenance.updateMaintenance(userId, id, {
      date: date ?? day(m.date), km: rest.km ?? m.km, category: rest.category ?? m.category, title: rest.title ?? m.title,
      specRuleIds: items ?? m.specRuleIds, costCents: cost != null ? toCents(cost) : m.costCents,
      workshop: blankIfNull(workshop, m.workshop), notes: blankIfNull(notes, m.notes), attachments: [], removeAttachmentIds: [],
    });
    return fromAction(res, (d) => ({ message: "Manutenção atualizada", odometer: odometerNote(d.odometerUpdatedTo) }));
  }));

  server.registerTool("delete_maintenance", {
    title: "Excluir manutenção",
    description: "Exclui uma manutenção e os anexos dela. Não dá para desfazer.",
    inputSchema: z.object({ id: idInput("da manutenção") }),
    annotations: DELETE,
  }, guard(async ({ id }, ctx) => fromAction(await maintenance.deleteMaintenance(userIdOf(ctx), id), () => ({ message: "Manutenção excluída" }))));

  // --- upgrades -------------------------------------------------------------------------------

  server.registerTool("add_upgrade", {
    title: "Registrar upgrade",
    description: "Registra um upgrade (modificação) no veículo.",
    inputSchema: z.object({
      vehicle: vehicleRef,
      name: z.string().min(1).describe("Ex.: Escape inox"),
      category: upgradeCategory,
      date: dateInput.optional(), cost: reaisInput.optional(), supplier: z.string().optional().describe("Fornecedor"), notes: z.string().optional(),
    }),
    annotations: WRITE,
  }, guard(async ({ vehicle, cost, date, ...rest }, ctx) => {
    const userId = userIdOf(ctx);
    const v = await vehicleIdOf(userId, vehicle);
    if ("error" in v) return failed(v.error!);
    const res = await upgrades.createUpgrade(userId, v.id, { ...rest, date: date ?? today(), costCents: toCents(cost ?? 0), attachments: [] });
    return fromAction(res, (d) => ({ id: d.id, message: `Upgrade registrado em ${v.name}` }));
  }));

  server.registerTool("update_upgrade", {
    title: "Editar upgrade",
    description: "Altera um upgrade (id em list_upgrades). Envie só o que muda.",
    inputSchema: z.object({
      id: idInput("do upgrade"),
      name: z.string().min(1).optional(), category: upgradeCategory.optional(), date: dateInput.optional(), cost: reaisInput.optional(),
      supplier: clearable("Fornecedor"), notes: clearable("Notas"),
    }),
    annotations: EDIT,
  }, guard(async ({ id, cost, date, supplier, notes, ...rest }, ctx) => {
    const userId = userIdOf(ctx);
    const u = await db.upgrade.findFirst({ where: { id, vehicle: { userId } } });
    if (!u) return failed("Upgrade não encontrado");
    const res = await upgrades.updateUpgrade(userId, id, {
      date: date ?? day(u.date), name: rest.name ?? u.name, category: rest.category ?? u.category,
      costCents: cost != null ? toCents(cost) : u.costCents, supplier: blankIfNull(supplier, u.supplier), notes: blankIfNull(notes, u.notes),
      attachments: [], removeAttachmentIds: [],
    });
    return fromAction(res, () => ({ message: "Upgrade atualizado" }));
  }));

  server.registerTool("delete_upgrade", {
    title: "Excluir upgrade",
    description: "Exclui um upgrade e os anexos dele. Não dá para desfazer.",
    inputSchema: z.object({ id: idInput("do upgrade") }),
    annotations: DELETE,
  }, guard(async ({ id }, ctx) => fromAction(await upgrades.deleteUpgrade(userIdOf(ctx), id), () => ({ message: "Upgrade excluído" }))));

  // --- fuel -----------------------------------------------------------------------------------

  const fuelPrice = z.object({
    total: reaisInput.optional().describe("Total pago em reais"),
    pricePerLiter: z.number().positive().max(100).optional().describe("Preço por litro em reais; usado para calcular o total quando ele não vier"),
  });

  server.registerTool("add_fuel", {
    title: "Registrar abastecimento",
    description: "Registra um abastecimento. Informe o total pago ou o preço por litro. O consumo (km/l) é medido entre tanques cheios, então marque fullTank=false quando não encher. Um km maior que o odômetro atualiza o odômetro.",
    inputSchema: fuelPrice.extend({
      vehicle: vehicleRef,
      km: kmInput,
      liters: z.number().positive().max(2000).describe("Litros, ex.: 40.5"),
      fuel: fuelType.default("GASOLINE"),
      fullTank: z.boolean().default(true).describe("Encheu o tanque?"),
      date: dateInput.optional(), station: z.string().optional().describe("Posto"), notes: z.string().optional(),
    }),
    annotations: WRITE,
  }, guard(async ({ vehicle, liters, total, pricePerLiter, date, ...rest }, ctx) => {
    const userId = userIdOf(ctx);
    const v = await vehicleIdOf(userId, vehicle);
    if ("error" in v) return failed(v.error!);
    const reais = total ?? (pricePerLiter != null ? liters * pricePerLiter : 0);
    const res = await fuel.createFuelRecord(userId, v.id, { ...rest, date: date ?? today(), volumeMl: litersToMl(liters), costCents: toCents(reais) });
    return fromAction(res, (d) => ({ id: d.id, message: `Abastecimento registrado em ${v.name}: ${liters} L, ${brl(toCents(reais))}`, odometer: odometerNote(d.odometerUpdatedTo) }));
  }));

  server.registerTool("update_fuel", {
    title: "Editar abastecimento",
    description: "Altera um abastecimento (id em list_fuel). Envie só o que muda.",
    inputSchema: fuelPrice.extend({
      id: idInput("do abastecimento"),
      km: kmInput.optional(), liters: z.number().positive().max(2000).optional(), fuel: fuelType.optional(), fullTank: z.boolean().optional(),
      date: dateInput.optional(), station: clearable("Posto"), notes: clearable("Notas"),
    }),
    annotations: EDIT,
  }, guard(async ({ id, liters, total, pricePerLiter, date, station, notes, ...rest }, ctx) => {
    const userId = userIdOf(ctx);
    const f = await db.fuelRecord.findFirst({ where: { id, vehicle: { userId } } });
    if (!f) return failed("Abastecimento não encontrado");
    const volumeMl = liters != null ? litersToMl(liters) : f.volumeMl;
    const costCents = total != null ? toCents(total) : pricePerLiter != null ? toCents((volumeMl / 1000) * pricePerLiter) : f.costCents;
    const res = await fuel.updateFuelRecord(userId, id, {
      date: date ?? day(f.date), km: rest.km ?? f.km, volumeMl, costCents, fuel: rest.fuel ?? f.fuel, fullTank: rest.fullTank ?? f.fullTank,
      station: station === undefined ? f.station ?? "" : station ?? "", notes: notes === undefined ? f.notes ?? "" : notes ?? "",
    });
    return fromAction(res, (d) => ({ message: "Abastecimento atualizado", odometer: odometerNote(d.odometerUpdatedTo) }));
  }));

  server.registerTool("delete_fuel", {
    title: "Excluir abastecimento",
    description: "Exclui um abastecimento. Não dá para desfazer.",
    inputSchema: z.object({ id: idInput("do abastecimento") }),
    annotations: DELETE,
  }, guard(async ({ id }, ctx) => fromAction(await fuel.deleteFuelRecord(userIdOf(ctx), id), () => ({ message: "Abastecimento excluído" }))));

  // --- custom alerts --------------------------------------------------------------------------

  const repeatFields = {
    repeatMonths: z.number().int().positive().max(120).nullable().optional().describe("Repetir a cada N meses (12 = anual, ex.: IPVA). Exige dueDate"),
    repeatKm: z.number().int().positive().max(1_000_000).nullable().optional().describe("Repetir a cada N km. Exige dueKm"),
  };

  server.registerTool("add_alert", {
    title: "Criar alerta",
    description: "Cria um alerta personalizado (IPVA, licenciamento, seguro, revisão na concessionária...) por data e/ou km. Pode repetir: ao concluir, o próximo é agendado.",
    inputSchema: z.object({
      vehicle: vehicleRef,
      label: z.string().min(1).describe("Descrição, ex.: IPVA"),
      dueDate: dateInput.optional().describe("Vencimento AAAA-MM-DD"),
      dueKm: kmInput.optional().describe("Vencimento por km"),
      ...repeatFields,
    }),
    annotations: WRITE,
  }, guard(async ({ vehicle, label, dueDate, dueKm, repeatMonths, repeatKm }, ctx) => {
    const userId = userIdOf(ctx);
    const v = await vehicleIdOf(userId, vehicle);
    if ("error" in v) return failed(v.error!);
    const res = await alerts.createCustomAlert(userId, v.id, { label, dueDate: dueDate ?? null, dueKm: dueKm ?? null, repeatMonths: repeatMonths ?? null, repeatKm: repeatKm ?? null });
    return fromAction(res, (d) => ({ id: d.id, message: `Alerta "${label}" criado em ${v.name}` }));
  }));

  server.registerTool("update_alert", {
    title: "Editar alerta",
    description: "Altera um alerta personalizado (id em get_vehicle → customAlerts ou get_alerts). Envie só o que muda; null apaga.",
    inputSchema: z.object({
      id: idInput("do alerta"),
      label: z.string().min(1).optional(),
      dueDate: dateInput.nullable().optional(), dueKm: kmInput.nullable().optional(),
      ...repeatFields,
    }),
    annotations: EDIT,
  }, guard(async ({ id, ...c }, ctx) => {
    const userId = userIdOf(ctx);
    const a = await db.customAlert.findFirst({ where: { id, vehicle: { userId } } });
    if (!a) return failed("Alerta não encontrado");
    const pick = <T,>(next: T | null | undefined, keep: T | null) => (next === undefined ? keep : next);
    const res = await alerts.updateCustomAlert(userId, id, {
      label: c.label ?? a.label,
      dueDate: c.dueDate === undefined ? (a.dueDate ? day(a.dueDate) : null) : c.dueDate,
      dueKm: pick(c.dueKm, a.dueKm), repeatMonths: pick(c.repeatMonths, a.repeatMonths), repeatKm: pick(c.repeatKm, a.repeatKm),
    });
    return fromAction(res, () => ({ message: "Alerta atualizado" }));
  }));

  for (const [name, title, wantDone] of [["complete_alert", "Concluir alerta", false], ["reopen_alert", "Reabrir alerta", true]] as const) {
    server.registerTool(name, {
      title,
      description: wantDone
        ? "Reabre um alerta personalizado que foi concluído. Alertas que repetem não ficam concluídos (já foram reagendados): para mudar a data deles use update_alert."
        : "Conclui um alerta personalizado. Se ele repete, em vez de fechar, agenda o próximo (ex.: IPVA do ano seguinte) e devolve a nova data ou km; para desfazer, use update_alert com a data anterior.",
      inputSchema: z.object({ id: idInput("do alerta") }),
      annotations: WRITE,
    }, guard(async ({ id }, ctx) => {
      const userId = userIdOf(ctx);
      const a = await db.customAlert.findFirst({ where: { id, vehicle: { userId } } });
      if (!a) return failed("Alerta não encontrado");
      if (a.done !== wantDone) return failed(wantDone ? "Este alerta já está pendente" : "Este alerta já está concluído");
      const res = await alerts.toggleCustomAlertDone(userId, id, { done: a.done, dueDate: a.dueDate?.toISOString() ?? null, dueKm: a.dueKm });
      return fromAction(res, (d) => d.next
        ? { message: "Concluído; próximo agendado", nextDueDate: d.next.dueDate && day(d.next.dueDate), nextDueKm: d.next.dueKm }
        : { message: wantDone ? "Alerta reaberto" : "Alerta concluído" });
    }));
  }

  server.registerTool("delete_alert", {
    title: "Excluir alerta",
    description: "Exclui um alerta personalizado. Não dá para desfazer.",
    inputSchema: z.object({ id: idInput("do alerta") }),
    annotations: DELETE,
  }, guard(async ({ id }, ctx) => fromAction(await alerts.deleteCustomAlert(userIdOf(ctx), id), () => ({ message: "Alerta excluído" }))));

  // --- spec sheet -----------------------------------------------------------------------------

  server.registerTool("update_spec", {
    title: "Editar ficha técnica",
    description: "Altera a ficha de troca do veículo, que define os intervalos e liga os alertas. Envie só o que muda; null apaga o campo ou o grupo. Grupos: engineOil {type, brand, capacityL, intervalKm, intervalMonths} · oilFilter {brand, note} · transmissionOil {type, intervalKm} · airFilter/fuelFilter/cabinFilter {intervalKm} · timingBelt {kind: belt|chain, intervalKm, lastChangeKm} · tires {size, psiFront, psiRear, rotationKm} · sparkPlugs {type, intervalKm} · brakeFluid {type: DOT3|DOT4|DOT5.1, intervalMonths} · coolant {type, intervalMonths} · freeNotes (texto).",
    inputSchema: z.object({ vehicle: vehicleRef, changes: specChanges }),
    annotations: EDIT,
  }, guard(async ({ vehicle, changes }, ctx) => {
    const userId = userIdOf(ctx);
    const found = await findVehicle(userId, vehicle);
    if (typeof found === "string") return failed(found);
    const v = await db.vehicle.findFirst({ where: { id: found.id, userId }, include: { spec: true } });
    const next: Record<string, unknown> = { ...specOf(v!) };
    for (const [group, change] of Object.entries(changes as Record<string, unknown>)) {
      if (change === undefined) continue;
      if (change === null) { delete next[group]; continue; }
      if (typeof change !== "object") { next[group] = change; continue; }
      const merged: Record<string, unknown> = { ...((next[group] as Record<string, unknown> | undefined) ?? {}) };
      for (const [field, value] of Object.entries(change as Record<string, unknown>)) {
        if (value === null) delete merged[field];
        else if (value !== undefined) merged[field] = value;
      }
      if (Object.keys(merged).length) next[group] = merged;
      else delete next[group];
    }
    return fromAction(await spec.upsertSpec(userId, found.id, next), () => ({ message: "Ficha atualizada", spec: next }));
  }));
}
