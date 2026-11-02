import { create } from "zustand";
type UiState = {
  lightbox: { images: { url: string; caption?: string | null }[]; index: number } | null;
  openLightbox: (images: { url: string; caption?: string | null }[], index: number) => void;
  closeLightbox: () => void;
};
export const useUi = create<UiState>((set) => ({
  lightbox: null,
  openLightbox: (images, index) => set({ lightbox: { images, index } }),
  closeLightbox: () => set({ lightbox: null }),
}));
