"use client";

import { motion, AnimatePresence } from "motion/react";
import { ShiningText } from "@/components/ui/shining-text";
import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";

interface SplashScreenProps {
  show: boolean;
}

export function SplashScreen({ show }: SplashScreenProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-white"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          aria-label="Loading"
          role="status"
        >
          <DotPattern
            className={cn(
              "fill-neutral-400/50",
              "[mask-image:radial-gradient(600px_circle_at_center,white,transparent)]"
            )}
          />
          <motion.div
            className="relative z-10"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <ShiningText
              text="Delivering the Future"
              className="font-sans text-2xl sm:text-3xl font-normal tracking-[0.12em]"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
