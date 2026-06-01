"use client";
import { motion } from "framer-motion";
export function AnimatedCard({ children, i = 0, className }: { children: React.ReactNode; i?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.3 }} className={className}>
      {children}
    </motion.div>
  );
}
