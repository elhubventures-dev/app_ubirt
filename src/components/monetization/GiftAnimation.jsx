import { motion, AnimatePresence } from "framer-motion";

export default function GiftAnimation({ gift, onDone }) {
  if (!gift) return null;

  return (
    <AnimatePresence onExitComplete={onDone}>
      <motion.div
        key={gift.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[400] pointer-events-none flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0.2, y: 80, opacity: 0 }}
          animate={{ scale: [0.2, 1.2, 1], y: [80, -20, 0], opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0, y: -60 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <span className="text-8xl drop-shadow-[0_0_30px_rgba(245,158,11,0.8)]">{gift.icon}</span>
          <p className="mt-4 text-xl font-black text-white drop-shadow-lg">{gift.name} sent!</p>
        </motion.div>
        {[...Array(12)].map((_, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
            animate={{
              opacity: [1, 1, 0],
              scale: [0, 1, 0.5],
              x: Math.cos((i / 12) * Math.PI * 2) * 120,
              y: Math.sin((i / 12) * Math.PI * 2) * 120 - 40,
            }}
            transition={{ duration: 1, delay: 0.1 }}
            className="absolute text-2xl"
          >
            ✨
          </motion.span>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
