# Revv — Design Doc

**Data:** 2026-05-31
**Status:** Aprovado, pronto para plano de implementação

Plataforma web para gerenciamento de veículos, manutenções automotivas e upgrades. Multi-usuário, SaaS hospedado. O usuário cadastra veículos e tem controle total sobre histórico de manutenções, upgrades, ficha técnica por veículo, alertas inteligentes e dashboard financeiro.

---

## 1. Stack & arquitetura

- **Next.js (App Router) + TypeScript** — Server Actions para mutations; Route Handlers apenas para o webhook/endpoint do UploadThing.
- **Prisma + PostgreSQL** — Postgres gerenciado (Neon ou Supabase).
- **NextAuth v5 (Auth.js)** + Prisma adapter — telas de login custom no estilo Track Day (sem UI de terceiros).
- **UploadThing** — upload de imagens e PDFs, múltiplos arquivos por registro.
- **Tailwind CSS + shadcn/ui** como base de componentes + **Framer Motion** para animações de entrada e transições.
- **Zustand** — estado client-side (filtros de histórico, estado do lightbox, UI).
- **Recharts** — gráficos do dashboard.

**Decisões transversais:**
- Dinheiro armazenado como **inteiro em centavos** (`costCents`), nunca float. Display em BRL.
- **Guard de autenticação:** middleware protege o grupo de rotas `(app)`. Toda query e mutation valida ownership (`vehicle.userId === session.user.id`); retorna 404 quando o recurso não pertence ao usuário.
- Dark mode é o padrão e único tema do v1.

---

## 2. Modelo de dados (Prisma)

```
User            // + Account / Session / VerificationToken (tabelas NextAuth)
  id, name, email, image, vehicles[]

Vehicle
  id, userId, name, plate?, make?, model?, year?, engine?, color?
  currentKm Int, photoKey?, photoUrl?, createdAt, updatedAt
  → spec (1:1), maintenances[], upgrades[], attachments[], customAlerts[]

VehicleSpec     // ficha de troca, relação 1:1 com Vehicle
  vehicleId @unique, data Json   // validado por Zod no app
  // Estrutura do JSON (todos os campos opcionais):
  //   engineOil { type, brand, capacityL, intervalKm, intervalMonths }
  //   oilFilter { brand, note }
  //   transmissionOil { type, intervalKm }
  //   airFilter { intervalKm }
  //   fuelFilter { intervalKm }
  //   cabinFilter { intervalKm }
  //   timingBelt { kind: "chain" | "belt", intervalKm, lastChangeKm }
  //   tires { size, psiFront, psiRear, rotationKm }
  //   sparkPlugs { type, intervalKm }
  //   brakeFluid { type: "DOT3" | "DOT4" | "DOT5.1", intervalMonths }
  //   coolant { type, intervalMonths }
  //   freeNotes: string   // ex: "sempre gasolina aditivada; ajustar válvulas a cada 30k"

MaintenanceRecord
  id, vehicleId, date, km Int, category (MaintenanceCategory), title,
  workshop?, costCents Int, notes?, createdAt
  → attachments[]

Upgrade
  id, vehicleId, date, name, category (UpgradeCategory), costCents Int,
  supplier?, notes?, createdAt
  → attachments[]   // foto antes/depois, peça, instalada

Attachment      // polimórfico via FKs opcionais; vehicleId sempre preenchido (galeria)
  id, vehicleId, maintenanceId?, upgradeId?
  kind ("image" | "pdf"), url, key, fileName, mime, size, caption?, createdAt

CustomAlert     // alertas avulsos (parte "manual" do híbrido)
  id, vehicleId, label, dueKm?, dueDate?, done Bool, createdAt
```

**Enums:**
- `MaintenanceCategory`: OIL, FILTERS, BRAKES, TIRES, REVISION, SUSPENSION, ELECTRICAL, FLUIDS, OTHER
- `UpgradeCategory`: EXHAUST, WHEELS, ECU, SUSPENSION, AESTHETIC, AUDIO, BRAKES, OTHER

**Notas de modelagem:**
- A ficha técnica usa um campo `Json` validado por Zod em vez de dezenas de colunas opcionais: o spec é grande, parcialmente preenchido e nunca consultado por coluna individual (só lido para exibir e para o alert engine). JSON + Zod mantém o schema enxuto e fácil de estender.
- `Attachment.vehicleId` é denormalizado (sempre setado) para a galeria do veículo ser uma query simples (`where vehicleId, kind = "image"`), independente de o anexo ter vindo de manutenção ou upgrade.
- `km` por registro (manutenção/upgrade) é o odômetro no momento do serviço; `Vehicle.currentKm` é o odômetro atual, atualizado manualmente. O alert engine compara os dois.

---

## 3. Alert engine (híbrido) — núcleo da lógica

Função pura `computeAlerts(vehicle, spec, maintenances, customAlerts)`:

1. Para cada intervalo definido na ficha (óleo, rodízio de pneus, fluido de freio, velas, etc.):
   - Cada item da ficha tem uma `MaintenanceCategory` fixa associada (mapa explícito no engine: engineOil/oilFilter → OIL, tires → TIRES, brakeFluid/coolant/transmissionOil → FLUIDS, sparkPlugs → ELECTRICAL, airFilter/fuelFilter/cabinFilter → FILTERS, timingBelt → REVISION). O rodízio de pneus usa a última manutenção TIRES; a troca de óleo a última OIL; e assim por diante.
   - Acha a última manutenção da categoria correspondente.
   - Calcula `kmRestante = intervalKm - (currentKm - recordKm)` e `mesesRestante` a partir das datas/intervalos.
2. Atribui status: `ok` / `soon` (dentro de um threshold configurável) / `overdue`.
3. Soma os `CustomAlert` (por `dueKm` e/ou `dueDate`), respeitando `done`.
4. Retorna lista ordenada por urgência.

Saída alimenta os chips de alerta no hero da página do veículo e a lista agregada no dashboard. É a peça mais importante da lógica de domínio e deve ser testada isoladamente (Vitest).

---

## 4. Rotas & módulos

```
(auth)/login                    — tela de login custom (Track Day)
(app)/garage                    — grid de veículos + ação criar
(app)/garage/[id]               — página do veículo (tabs)
(app)/garage/[id]/spec/edit     — editar ficha técnica
(app)/dashboard                 — dashboard financeiro global + alertas agregados
api/uploadthing                 — route handler do UploadThing
```

**Página do veículo** (layout aprovado em mockup):
- **Hero:** foto, nome, placa, ano/motor, odômetro editável, chips de alerta (derivados da ficha, em accent laranja).
- **`// FICHA DE TROCA`:** grid técnico (estilo spec sheet) com óleo, filtros, pneus, velas, correia, fluido de freio, arrefecimento + nota livre. Referência rápida no topo, editável.
- **Tabs:** Manutenções · Upgrades · Galeria · Financeiro.
  - *Manutenções/Upgrades:* lista/linhas com data, categoria (badge), título, oficina/fornecedor, km, anexos, custo. Filtros por tipo e período (estado em Zustand).
  - *Galeria:* grid de imagens (`Attachment` kind=image do veículo) com lightbox.
  - *Timeline de upgrades:* visual vertical das modificações ordenadas por data.
  - *Financeiro:* recorte financeiro do veículo.

---

## 5. Design system — Track Day

Direção visual escolhida (de 3 propostas): industrial e afiada, telemetria de pista.

**Tokens:**
```
bg        #0a0a0b   (preto absoluto)
surface   #141416
surface2  #1b1c1f
border    rgba(255,255,255,.08)
accent    #ff6a00   (laranja elétrico)
text      #ffffff
muted     rgba(255,255,255,.55)
```
- **Tipografia:** display/headings **Space Grotesk**; dados/números/labels técnicos **JetBrains Mono**.
- Radius 10–14px. Glassmorphism sutil em cards.
- **Framer Motion:** stagger na entrada de cards, transição suave entre tabs e páginas, animação do lightbox.
- Identidade própria, não genérica. Sem Inter/Roboto.

---

## 6. Error handling & testes

- **Server Actions** retornam um resultado tipado `{ ok: true, data } | { ok: false, error }`. Zod valida toda entrada na fronteira; erros viram toast no client.
- **Ownership check** em toda action e query. Recurso de outro usuário → 404.
- **Vitest** para a lógica de domínio: alert engine (principal), cálculos de custo/km, schemas Zod da ficha.
- `tsc --noEmit` + `next build` como gate de verificação ao fim de cada fase (nunca marcar fase como concluída sem build limpo e tipos OK).

---

## 7. Fases de implementação (paralelizável via subagents)

**Fase 0 — Fundação** (sequencial, bloqueia o resto):
scaffold Next + TS + Tailwind + shadcn; Prisma schema + migrate; NextAuth v5 + adapter; design tokens + shell/layout base; configuração do UploadThing.

**Fase 1** (paralelo):
- Garagem CRUD (lista de veículos, criar/editar, foto)
- Página do veículo (shell + tabs) + Ficha técnica CRUD

**Fase 2** (paralelo):
- Manutenções: CRUD + anexos + alert engine
- Upgrades: CRUD + anexos + galeria + timeline

**Fase 3** (paralelo):
- Dashboard financeiro (Recharts: total por veículo/geral, breakdown manutenção vs upgrade, gasto ao longo do tempo, KPIs — gasto médio mensal, custo por km, maior despesa)
- Export PDF (histórico completo por veículo)
- Custom alerts (criação/conclusão de alertas avulsos)

Cada fase termina com verificação de build, tipos e comportamento esperado antes de avançar.

---

## Decisões registradas

| Tema | Decisão |
|------|---------|
| Contexto | SaaS hospedado, multi-conta |
| Auth | NextAuth v5 (Auth.js) — login custom |
| Upload | UploadThing (imagens + PDFs) |
| Alertas | Híbrido (derivados da ficha + avulsos) |
| Dinheiro | Int em centavos |
| Ficha técnica | JSON validado por Zod, 1:1 por veículo |
| km | `currentKm` no veículo + km por registro |
| Visibilidade | Veículos privados por usuário (sem compartilhamento no v1) |
| Direção visual | Track Day (preto + laranja elétrico, Space Grotesk + JetBrains Mono) |
