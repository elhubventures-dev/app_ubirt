import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function Camera() {
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  // Simulate recording progress
  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsRecording(false);
            setTimeout(() => navigate('/upload'), 500); // go to upload wizard after finishing
            return 100;
          }
          return prev + 1; // 1% every 100ms = 10s total
        });
      }, 100);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isRecording, navigate]);

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white overflow-hidden relative">
      {/* Simulated Viewfinder Background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
         <img 
           src="https://images.unsplash.com/photo-1616091093714-c64882e9ab55?w=800&q=80" 
           alt="Camera View" 
           className={`w-full h-full object-cover transition-transform duration-1000 ${isRecording ? 'scale-105' : 'scale-100'}`} 
         />
         {/* Top gradient for visibility */}
         <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
         {/* Bottom gradient for visibility */}
         <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* Top Header */}
      <header className="absolute top-0 left-0 right-0 px-4 py-6 flex items-center justify-between z-10">
        <Link to="/" className="text-white drop-shadow-md hover:bg-white/10 rounded-full p-2 -ml-2 transition-colors">
          <span className="material-symbols-outlined text-[28px]">close</span>
        </Link>
        
        <div className="flex bg-black/40 backdrop-blur-md rounded-full overflow-hidden border border-white/10">
           <button className="px-4 py-1.5 text-xs font-semibold hover:bg-white/10 transition-colors border-r border-white/10">15s</button>
           <button className="px-4 py-1.5 text-xs font-semibold bg-white/20">60s</button>
           <button className="px-4 py-1.5 text-xs font-semibold hover:bg-white/10 transition-colors">3m</button>
        </div>

        <button className="text-white drop-shadow-md hover:bg-white/10 rounded-full p-2 -mr-2 transition-colors">
           <span className="material-symbols-outlined text-[26px]">music_note</span>
        </button>
      </header>

      {/* Right Sidebar Tools */}
      <div className="absolute right-3 top-24 flex flex-col gap-4 z-10 items-center">
         <ToolButton icon="flip_camera_ios" label="Flip" />
         <ToolButton icon="speed" label="Speed" />
         <ToolButton icon="filter_vintage" label="Filters" />
         <ToolButton icon="timer" label="Timer" />
         <ToolButton icon="flash_off" label="Flash" />
         <ToolButton icon="face_retouching_natural" label="Enhance" />
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center justify-center z-10 gap-6">
        
        {/* Record Button Container */}
        <div className="relative flex items-center justify-center">
           {/* Progress Ring */}
           <svg className="absolute w-[88px] h-[88px] -rotate-90 pointer-events-none">
             <circle 
                cx="44" cy="44" r="41" 
                fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" 
             />
             <motion.circle 
                cx="44" cy="44" r="41" 
                fill="none" stroke="#ef4444" strokeWidth="4" 
                strokeDasharray="257"
                strokeDashoffset={257 - (progress / 100) * 257}
                strokeLinecap="round"
             />
           </svg>

           {/* Inner Record Button */}
           <motion.button 
             onClick={toggleRecording}
             whileTap={{ scale: 0.9 }}
             className={`w-[72px] h-[72px] rounded-full flex items-center justify-center transition-colors ${
               isRecording ? 'bg-red-500/20' : 'bg-red-500/20'
             }`}
           >
              <motion.div 
                layout
                animate={{ 
                  borderRadius: isRecording ? "12px" : "50%",
                  width: isRecording ? "32px" : "60px",
                  height: isRecording ? "32px" : "60px",
                  backgroundColor: "#ef4444"
                }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              />
           </motion.button>
        </div>

        {/* Bottom Nav Text */}
        <div className="flex gap-6 text-sm font-semibold text-slate-300 drop-shadow-md">
           <span className="cursor-pointer hover:text-white transition-colors">Effects</span>
           <span className="text-white cursor-pointer relative after:content-[''] after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-white after:rounded-full">Video</span>
           <span className="cursor-pointer hover:text-white transition-colors">Photo</span>
           <span className="cursor-pointer hover:text-white transition-colors">Templates</span>
        </div>

      </div>

      {/* Upload From Gallery */}
      <AnimatePresence>
        {!isRecording && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-12 right-6 z-10"
          >
             <Link to="/upload" className="flex flex-col items-center gap-1 group">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20 group-hover:border-white transition-colors relative">
                   <img src="https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=100&q=80" alt="Gallery" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] font-semibold text-slate-200 drop-shadow-md">Upload</span>
             </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolButton({ icon, label }) {
  return (
    <div className="flex flex-col items-center gap-1 cursor-pointer group">
       <div className="bg-black/30 backdrop-blur-md p-2.5 rounded-full border border-white/10 group-hover:bg-white/20 transition-colors">
          <span className="material-symbols-outlined text-[22px] text-white drop-shadow-md">{icon}</span>
       </div>
       <span className="text-[10px] font-semibold text-slate-200 drop-shadow-md">{label}</span>
    </div>
  );
}
