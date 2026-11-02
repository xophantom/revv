import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerReadTools } from "./read-tools";
import { registerWriteTools } from "./write-tools";

export const SERVER_INFO = { name: "revv", version: "1.0.0" };

export const INSTRUCTIONS = `Revv é a garagem do usuário: veículos, manutenções, upgrades, abastecimentos, alertas e a ficha técnica (intervalos de troca).
- Comece por list_vehicles quando não souber o veículo. Onde pede "vehicle", o nome serve (parcial, se for único).
- Valores em reais (245.5 = R$ 245,50), litros com ponto decimal, datas AAAA-MM-DD; sem data, vale hoje no horário de Brasília.
- Ao registrar manutenção, veja os itens da ficha em get_vehicle (maintenanceItems) e marque os que foram feitos em items: é o que zera o alerta de cada item.
- Registrar manutenção ou abastecimento com km maior que o odômetro atualiza o odômetro.
- Para corrigir um registro use as ferramentas update_*; os ids vêm das listagens. Exclusões não têm volta: confirme com o usuário antes.
- Fotos e anexos só pelo app.`;

export function registerRevvTools(server: McpServer) {
  registerReadTools(server);
  registerWriteTools(server);
}
