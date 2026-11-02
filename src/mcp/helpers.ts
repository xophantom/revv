import "server-only";
import { z } from "zod";
import type { ActionResult } from "@/lib/result";
import { db } from "@/lib/db";
import { centsToBRL } from "@/lib/money";
import { formatDateOnly, todayInputValue } from "@/lib/dates";

// The caller's user id, set by the route's token check (src/app/api/mcp/route.ts).
export function userIdOf(ctx: { http?: { authInfo?: { extra?: Record<string, unknown> } } }): string {
  const id = ctx.http?.authInfo?.extra?.userId;
  if (typeof id !== "string") throw new ToolError("Sessão inválida: conecte o Revv de novo");
  return id;
}

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

export function done(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function failed(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

const ERRORS: Record<string, string> = { not_found: "Registro não encontrado (ou não pertence a esta conta)" };

// Service result → tool result.
export function fromAction<T>(res: ActionResult<T>, onOk: (data: T) => unknown): ToolResult {
  return res.ok ? done(onOk(res.data)) : failed(ERRORS[res.error] ?? res.error);
}

// An error whose message is meant for the user (and Claude), unlike internal ones (Prisma, Zod...).
export class ToolError extends Error {}

// Every tool runs through this, so a thrown error reaches Claude as a tool error, not a 500.
export function guard<A, C>(fn: (args: A, ctx: C) => Promise<ToolResult>) {
  return async (args: A, ctx: C): Promise<ToolResult> => {
    try {
      return await fn(args, ctx);
    } catch (err) {
      if (err instanceof ToolError) return failed(err.message);
      console.error("[mcp]", err);
      return failed("Erro inesperado no Revv. Tente de novo; se continuar, confira os dados pelo app.");
    }
  };
}

// --- input pieces -------------------------------------------------------------------------------

export const vehicleRef = z.string().min(1).describe("Veículo: o id ou o nome (como em list_vehicles). Nome parcial serve se for único");
export const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD").describe("Data AAAA-MM-DD. Padrão: hoje (horário de Brasília)");
export const kmInput = z.number().int().min(0).max(9_999_999).describe("Quilometragem do odômetro, número inteiro (ex.: 87430)");
export const reaisInput = z.number().min(0).max(1_000_000).describe("Valor em reais, ex.: 245.5 para R$ 245,50");
export const idInput = (what: string) => z.string().min(1).describe(`Id ${what} (veja nas ferramentas de listagem)`);

export const today = () => todayInputValue();
export const toCents = (reais: number) => Math.round(reais * 100);
export const brl = (cents: number) => centsToBRL(cents);
export const day = (d: Date | string) => formatDateOnly(d, "yyyy-MM-dd");
export const km = (n: number) => `${n.toLocaleString("pt-BR")} km`;

// --- vehicle lookup -----------------------------------------------------------------------------

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

// By id, then exact name, then a unique partial name (accents and case ignored).
export async function findVehicle(userId: string, ref: string): Promise<{ id: string; name: string } | string> {
  const vehicles = await db.vehicle.findMany({ where: { userId }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
  if (!vehicles.length) return "Nenhum veículo cadastrado. Crie um com create_vehicle";
  const byId = vehicles.find((v) => v.id === ref);
  if (byId) return byId;
  const q = fold(ref);
  const exact = vehicles.filter((v) => fold(v.name) === q);
  if (exact.length === 1) return exact[0];
  const partial = vehicles.filter((v) => fold(v.name).includes(q));
  if (partial.length === 1) return partial[0];
  const names = vehicles.map((v) => `"${v.name}" (${v.id})`).join(", ");
  return partial.length > 1 ? `"${ref}" é ambíguo entre: ${partial.map((v) => v.name).join(", ")}` : `Veículo "${ref}" não encontrado. Veículos: ${names}`;
}
