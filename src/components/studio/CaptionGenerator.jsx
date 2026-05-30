import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export default function CaptionGenerator({ videoFile, onCaptionsGenerated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setIsGenerating(true);
    // Simulate AI API call
    setTimeout(() => {
      setIsGenerating(false);
      setIsOpen(false);
      onCaptionsGenerated([
        { time: "0:00", text: "Welcome to this new video!" },
        { time: "0:03", text: "Today we are looking at something cool." },
        { time: "0:06", text: "Stay tuned for more." }
      ]);
      toast({
        title: "Captions generated!",
        description: "AI successfully generated captions for your video."
      });
    }, 2500);
  };

  return (
    <>
      <button 
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl mt-4 hover:border-purple-500/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-purple-400">subtitles</span>
          <span className="text-sm font-semibold text-slate-200">Auto-Generate Captions</span>
        </div>
        <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-medium">AI Magic</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !isGenerating && setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-[#151c28] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center overflow-hidden"
            >
              {isGenerating ? (
                <>
                  <div className="w-16 h-16 relative mb-4">
                    <div className="absolute inset-0 rounded-full border-4 border-white/10"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
                    <span className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-purple-400">psychology</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Analyzing Audio...</h3>
                  <p className="text-sm text-slate-400 mb-6">Our AI is transcribing your video. This may take a few moments.</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-4 text-purple-400">
                    <span className="material-symbols-outlined text-[32px]">record_voice_over</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Auto-Captions</h3>
                  <p className="text-sm text-slate-400 mb-6">
                    Automatically generate stylized captions for your video to boost engagement.
                  </p>
                  
                  <div className="flex gap-3 w-full">
                    <button 
                      onClick={() => setIsOpen(false)}
                      className="flex-1 py-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors font-semibold"
                    >
                      Cancel
                    </button>
                    <PrimaryButton 
                      onClick={handleGenerate}
                      className="flex-1 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 border-none"
                    >
                      Generate
                    </PrimaryButton>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
