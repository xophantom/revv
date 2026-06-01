"use client";
import { Toaster as Sonner } from "sonner";
export function Toaster() {
  return <Sonner theme="dark" position="top-right" toastOptions={{ style: { background: "#141416", border: "1px solid rgba(255,255,255,.08)", color: "#fff" } }} />;
}
