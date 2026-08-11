"use client";

import { motion } from "motion/react";

interface ShiningTextProps {
  text: string;
  className?: string;
}

export function ShiningText({ text, className }: ShiningTextProps) {
  return (
    <motion.h1
      className={`bg-[linear-gradient(110deg,#6B7280,35%,#9CA3AF,50%,#6B7280,75%,#6B7280)] bg-[length:200%_100%] bg-clip-text text-transparent ${className ?? "text-base font-normal"}`}
      initial={{ backgroundPosition: "200% 0" }}
      animate={{ backgroundPosition: "-200% 0" }}
      transition={{
        repeat: Infinity,
        duration: 2,
        ease: "linear",
      }}
    >
      {text}
    </motion.h1>
  );
}
