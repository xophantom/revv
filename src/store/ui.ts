import { create } from "zustand";
type MaintFilter = { category: string | null; from: string | null; to: string | null };
type UiState = {
  maintFilter: MaintFilter;
  setMaintFilter: (f: Partial<MaintFilter>) => void;
  lightbox: { images: { url: string; caption?: string | null }[]; index: number } | null;
  openLightbox: (images: { url: string; caption?: string | null }[], index: number) => void;
  closeLightbox: () => void;
};
export const useUi = create<UiState>((set) => ({
  maintFilter: { category: null, from: null, to: null },
  setMaintFilter: (f) => set((s) => ({ maintFilter: { ...s.maintFilter, ...f } })),
  lightbox: null,
  openLightbox: (images, index) => set({ lightbox: { images, index } }),
  closeLightbox: () => set({ lightbox: null }),
}));
