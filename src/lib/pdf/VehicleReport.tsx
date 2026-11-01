import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { Vehicle, VehicleSpec, MaintenanceRecord, Upgrade } from "@prisma/client";
import { vehicleSpecSchema, emptySpec, type VehicleSpecData } from "@/domain/spec-schema";
import { MAINTENANCE_LABELS, UPGRADE_LABELS } from "@/lib/categories";
import { centsToBRL } from "@/lib/money";
import { formatDateOnly } from "@/lib/dates";

const ACCENT = "#ff6a00";
const DARK = "#1a1a1a";
const MUTED = "#666666";
const BORDER = "#dddddd";
const HEADER_BG = "#f5f5f5";

const styles = StyleSheet.create({
  page: { backgroundColor: "#ffffff", color: DARK, padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  header: { borderBottomWidth: 2, borderBottomColor: ACCENT, paddingBottom: 10, marginBottom: 14 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  name: { fontSize: 22, fontFamily: "Helvetica-Bold", color: ACCENT },
  subtitle: { fontSize: 9, color: MUTED, marginTop: 3 },
  odometer: { fontSize: 9, color: DARK, marginTop: 3, fontFamily: "Helvetica-Bold" },
  wordmark: { fontSize: 13, fontFamily: "Helvetica-Bold", color: ACCENT, letterSpacing: 1 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: ACCENT, marginBottom: 6 },
  specGrid: { flexDirection: "row", flexWrap: "wrap" },
  specItem: { width: "50%", flexDirection: "row", marginBottom: 3, paddingRight: 8 },
  specLabel: { color: MUTED, marginRight: 4 },
  specValue: { color: DARK },
  empty: { color: MUTED, fontStyle: "italic" },
  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 2 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER },
  trLast: { flexDirection: "row" },
  th: { backgroundColor: HEADER_BG, padding: 4, fontFamily: "Helvetica-Bold", fontSize: 8, color: DARK },
  td: { padding: 4, fontSize: 8, color: DARK },
  footer: { marginTop: 14, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  footerLabel: { color: MUTED },
  footerValue: { fontFamily: "Helvetica-Bold", color: DARK },
  footerTotal: { fontFamily: "Helvetica-Bold", color: ACCENT, fontSize: 11 },
});

const fmtDate = (d: Date) => formatDateOnly(d, "dd/MM/yyyy");

// Column widths per table (sum to 100%). Keeps headers and rows aligned.
const MAINT_COLS = ["13%", "12%", "16%", "27%", "20%", "12%"];
const UPG_COLS = ["15%", "30%", "20%", "23%", "12%"];

function specSummary(spec: VehicleSpecData): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const push = (label: string, value: string | number | undefined | null) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") out.push({ label, value: String(value) });
  };
  push("Óleo (tipo)", spec.engineOil?.type);
  push("Óleo (marca)", spec.engineOil?.brand);
  if (spec.engineOil?.capacityL != null) push("Óleo (capacidade)", `${spec.engineOil.capacityL} L`);
  if (spec.engineOil?.intervalKm != null) push("Óleo (intervalo)", `${spec.engineOil.intervalKm.toLocaleString("pt-BR")} km`);
  if (spec.engineOil?.intervalMonths != null) push("Óleo (meses)", `${spec.engineOil.intervalMonths} m`);
  push("Filtro de óleo", spec.oilFilter?.brand);
  push("Óleo do câmbio", spec.transmissionOil?.type);
  if (spec.transmissionOil?.intervalKm != null) push("Câmbio (intervalo)", `${spec.transmissionOil.intervalKm.toLocaleString("pt-BR")} km`);
  if (spec.airFilter?.intervalKm != null) push("Filtro de ar", `${spec.airFilter.intervalKm.toLocaleString("pt-BR")} km`);
  if (spec.fuelFilter?.intervalKm != null) push("Filtro de combustível", `${spec.fuelFilter.intervalKm.toLocaleString("pt-BR")} km`);
  if (spec.cabinFilter?.intervalKm != null) push("Filtro de cabine", `${spec.cabinFilter.intervalKm.toLocaleString("pt-BR")} km`);
  if (spec.timingBelt?.kind) push("Correia/corrente", spec.timingBelt.kind === "belt" ? "Correia" : "Corrente");
  if (spec.timingBelt?.intervalKm != null) push("Correia (intervalo)", `${spec.timingBelt.intervalKm.toLocaleString("pt-BR")} km`);
  push("Pneus (medida)", spec.tires?.size);
  if (spec.tires?.psiFront != null) push("Pneus (PSI diant.)", String(spec.tires.psiFront));
  if (spec.tires?.psiRear != null) push("Pneus (PSI tras.)", String(spec.tires.psiRear));
  if (spec.tires?.rotationKm != null) push("Rodízio de pneus", `${spec.tires.rotationKm.toLocaleString("pt-BR")} km`);
  push("Velas (tipo)", spec.sparkPlugs?.type);
  if (spec.sparkPlugs?.intervalKm != null) push("Velas (intervalo)", `${spec.sparkPlugs.intervalKm.toLocaleString("pt-BR")} km`);
  push("Fluido de freio", spec.brakeFluid?.type);
  if (spec.brakeFluid?.intervalMonths != null) push("Freio (meses)", `${spec.brakeFluid.intervalMonths} m`);
  push("Arrefecimento", spec.coolant?.type);
  if (spec.coolant?.intervalMonths != null) push("Arrefecimento (meses)", `${spec.coolant.intervalMonths} m`);
  push("Notas", spec.freeNotes);
  return out;
}

export type VehicleReportData = Vehicle & {
  spec: VehicleSpec | null;
  maintenances: MaintenanceRecord[];
  upgrades: Upgrade[];
};

export function VehicleReport({ vehicle }: { vehicle: VehicleReportData }) {
  let spec: VehicleSpecData = emptySpec();
  try {
    if (vehicle.spec) spec = vehicleSpecSchema.parse(vehicle.spec.data);
  } catch {
    spec = emptySpec();
  }
  const specItems = specSummary(spec);

  const maintTotal = vehicle.maintenances.reduce((s, m) => s + m.costCents, 0);
  const upgTotal = vehicle.upgrades.reduce((s, u) => s + u.costCents, 0);
  const grandTotal = maintTotal + upgTotal;

  const subtitle = [vehicle.plate ?? "—", vehicle.year ?? "—", vehicle.engine ?? "—"].join(" · ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.name}>{vehicle.name}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
              <Text style={styles.odometer}>Odômetro: {vehicle.currentKm.toLocaleString("pt-BR")} km</Text>
            </View>
            <Text style={styles.wordmark}>REVV</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ficha técnica</Text>
          {specItems.length === 0 ? (
            <Text style={styles.empty}>Ficha não preenchida</Text>
          ) : (
            <View style={styles.specGrid}>
              {specItems.map((it, i) => (
                <View key={i} style={styles.specItem}>
                  <Text style={styles.specLabel}>{it.label}:</Text>
                  <Text style={styles.specValue}>{it.value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manutenções ({vehicle.maintenances.length})</Text>
          {vehicle.maintenances.length === 0 ? (
            <Text style={styles.empty}>Nenhuma manutenção registrada</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tr}>
                <Text style={[styles.th, { width: MAINT_COLS[0] }]}>Data</Text>
                <Text style={[styles.th, { width: MAINT_COLS[1] }]}>Km</Text>
                <Text style={[styles.th, { width: MAINT_COLS[2] }]}>Categoria</Text>
                <Text style={[styles.th, { width: MAINT_COLS[3] }]}>Título</Text>
                <Text style={[styles.th, { width: MAINT_COLS[4] }]}>Oficina</Text>
                <Text style={[styles.th, { width: MAINT_COLS[5] }]}>Custo</Text>
              </View>
              {vehicle.maintenances.map((m, i) => (
                <View key={m.id} style={i === vehicle.maintenances.length - 1 ? styles.trLast : styles.tr}>
                  <Text style={[styles.td, { width: MAINT_COLS[0] }]}>{fmtDate(m.date)}</Text>
                  <Text style={[styles.td, { width: MAINT_COLS[1] }]}>{m.km.toLocaleString("pt-BR")}</Text>
                  <Text style={[styles.td, { width: MAINT_COLS[2] }]}>{MAINTENANCE_LABELS[m.category]}</Text>
                  <Text style={[styles.td, { width: MAINT_COLS[3] }]}>{m.title}</Text>
                  <Text style={[styles.td, { width: MAINT_COLS[4] }]}>{m.workshop ?? "—"}</Text>
                  <Text style={[styles.td, { width: MAINT_COLS[5] }]}>{centsToBRL(m.costCents)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upgrades ({vehicle.upgrades.length})</Text>
          {vehicle.upgrades.length === 0 ? (
            <Text style={styles.empty}>Nenhum upgrade registrado</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tr}>
                <Text style={[styles.th, { width: UPG_COLS[0] }]}>Data</Text>
                <Text style={[styles.th, { width: UPG_COLS[1] }]}>Nome</Text>
                <Text style={[styles.th, { width: UPG_COLS[2] }]}>Categoria</Text>
                <Text style={[styles.th, { width: UPG_COLS[3] }]}>Fornecedor</Text>
                <Text style={[styles.th, { width: UPG_COLS[4] }]}>Custo</Text>
              </View>
              {vehicle.upgrades.map((u, i) => (
                <View key={u.id} style={i === vehicle.upgrades.length - 1 ? styles.trLast : styles.tr}>
                  <Text style={[styles.td, { width: UPG_COLS[0] }]}>{fmtDate(u.date)}</Text>
                  <Text style={[styles.td, { width: UPG_COLS[1] }]}>{u.name}</Text>
                  <Text style={[styles.td, { width: UPG_COLS[2] }]}>{UPGRADE_LABELS[u.category]}</Text>
                  <Text style={[styles.td, { width: UPG_COLS[3] }]}>{u.supplier ?? "—"}</Text>
                  <Text style={[styles.td, { width: UPG_COLS[4] }]}>{centsToBRL(u.costCents)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Total manutenções</Text>
            <Text style={styles.footerValue}>{centsToBRL(maintTotal)}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Total upgrades</Text>
            <Text style={styles.footerValue}>{centsToBRL(upgTotal)}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Total geral</Text>
            <Text style={styles.footerTotal}>{centsToBRL(grandTotal)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
