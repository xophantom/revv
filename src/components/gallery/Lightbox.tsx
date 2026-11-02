"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useUi } from "@/store/ui";

export function Lightbox() {
  const lb = useUi((s) => s.lightbox);
  const close = useUi((s) => s.closeLightbox);
  const open = useUi((s) => s.openLightbox);
  useEffect(() => {
    if (!lb) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") open(lb!.images, (lb!.index + 1) % lb!.images.length);
      if (e.key === "ArrowLeft") open(lb!.images, (lb!.index - 1 + lb!.images.length) % lb!.images.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lb, close, open]);
  return (
    <AnimatePresence>
      {lb && (
        <motion.div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <button className="absolute right-4 top-4 cursor-pointer rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" onClick={close} aria-label="Fechar"><X size={22} /></button>
          {lb.images.length > 1 && (
            <button className="absolute left-3 cursor-pointer rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Foto anterior" onClick={(e) => { e.stopPropagation(); open(lb.images, (lb.index - 1 + lb.images.length) % lb.images.length); }}><ChevronLeft size={32} /></button>
          )}
          <motion.img key={lb.index} src={lb.images[lb.index].url} alt={lb.images[lb.index].caption ?? ""} className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()} />
          {lb.images.length > 1 && (
            <button className="absolute right-3 cursor-pointer rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Próxima foto" onClick={(e) => { e.stopPropagation(); open(lb.images, (lb.index + 1) % lb.images.length); }}><ChevronRight size={32} /></button>
          )}
          {lb.images[lb.index].caption && <div className="tabular-nums absolute bottom-5 text-xs text-white/70">{lb.images[lb.index].caption}</div>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
