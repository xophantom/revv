"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
          <button className="absolute right-5 top-5 text-2xl text-white/70 hover:text-white" onClick={close} aria-label="fechar">✕</button>
          {lb.images.length > 1 && (
            <button className="absolute left-4 text-4xl text-white/60 hover:text-white" onClick={(e) => { e.stopPropagation(); open(lb.images, (lb.index - 1 + lb.images.length) % lb.images.length); }}>‹</button>
          )}
          <motion.img key={lb.index} src={lb.images[lb.index].url} alt={lb.images[lb.index].caption ?? ""} className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()} />
          {lb.images.length > 1 && (
            <button className="absolute right-4 text-4xl text-white/60 hover:text-white" onClick={(e) => { e.stopPropagation(); open(lb.images, (lb.index + 1) % lb.images.length); }}>›</button>
          )}
          {lb.images[lb.index].caption && <div className="mono absolute bottom-5 text-xs text-white/70">{lb.images[lb.index].caption}</div>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
