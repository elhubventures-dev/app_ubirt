import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCreatorStudio } from "@/hooks/useCreatorStudio";
import { useToast } from "@/components/ui/use-toast";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { InputField } from "@/components/ui/InputField";
import { cn } from "@/lib/utils";
import { isLiveMode, isSupabaseConfigured } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { VideoFilters, getFilterClass } from "@/components/studio/VideoFilters";
import { AudioLibrary } from "@/components/studio/AudioLibrary";
import CaptionGenerator from "@/components/studio/CaptionGenerator";

const selectClass = "w-full rounded-2xl px-4 py-3 bg-white/5 border border-white/10 text-white focus:bg-white/10 transition-colors outline-none";

export default function Upload() {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Product");
  const [visibility, setVisibility] = useState("team");
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [filter, setFilter] = useState("none");
  const [audio, setAudio] = useState("original");
  const [captions, setCaptions] = useState([]);
  const fileInputRef = useRef(null);

  const { saveUpload, isSavingUpload, publishUpload, isPublishingUpload } = useCreatorStudio();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const canUploadFiles = isLiveMode() && isSupabaseConfigured();

  useEffect(() => {
    const recorded = location.state?.recordedFile;
    const preview = location.state?.recordedPreview;
    if (recorded) {
      setFile(recorded);
      setFilePreview(preview || URL.createObjectURL(recorded));
      setStep(2);
    }
  }, [location.state]);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setFilePreview(url);
      setStep(2);
    }
  };

  const onSubmit = async () => {
    try {
      const result = await saveUpload({
        payload: { title, description, category, visibility, filter, audio, captions },
        file: canUploadFiles ? file : null,
      });
      toast({ title: "Draft saved", description: `Upload ${result.id} has been stored successfully.` });
      navigate("/creator-studio");
    } catch (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    }
  };

  const nextStep = () => {
    if (step === 3 && !title) {
      toast({ title: "Title required", description: "Please enter a title.", variant: "destructive" });
      return;
    }
    setStep((s) => Math.min(s + 1, 4));
  };
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <div className="min-h-screen bg-[#101822] text-white flex flex-col relative overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-[#0a111a] via-[#101822] to-[#152336] z-0" />
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#0d5bba]/20 blur-[120px] rounded-full z-0 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 px-4 py-4 flex items-center justify-between border-b border-white/5 bg-[#101822]/50 backdrop-blur-md">
        <button onClick={() => step > 1 ? prevStep() : navigate(-1)} className="text-slate-400 p-2 hover:text-white rounded-full bg-white/5 transition-colors">
          <span className="material-symbols-outlined">{step > 1 ? "arrow_back" : "close"}</span>
        </button>
          <div className="flex gap-1.5 w-32 justify-center mx-auto absolute left-1/2 -translate-x-1/2">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? "bg-[#3b82f6]" : "bg-white/20"}`} />
            ))}
          </div>
        <div className="w-10" /> {/* Spacer */}
      </header>

      <main className="flex-1 relative z-10 p-4 max-w-md mx-auto w-full flex flex-col">
        <AnimatePresence mode="wait" custom={step}>
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="flex-1 flex flex-col"
            >
              <div className="mt-8">
                <h1 className="text-3xl font-bold tracking-tight">Select Media</h1>
                <p className="text-slate-400 mt-2 text-sm">Upload a video or image to get started.</p>
              </div>

              <div className="flex-1 flex items-center justify-center mt-8">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-[3/4] rounded-3xl border-2 border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-[#3b82f6]/50 transition-all flex flex-col items-center justify-center gap-4 group"
                >
                  <div className="w-16 h-16 rounded-full bg-[#3b82f6]/20 flex items-center justify-center text-[#3b82f6] group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[32px]">upload</span>
                  </div>
                  <span className="text-slate-300 font-medium">Tap to select media</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {!canUploadFiles && (
                <div className="mt-6 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-200/80 text-sm flex gap-3">
                  <span className="material-symbols-outlined text-yellow-500">info</span>
                  <p>Running in mock mode. File uploads are disabled. You can skip this step.</p>
                </div>
              )}
              
              {!canUploadFiles && (
                 <PrimaryButton className="mt-4 py-4 rounded-full" onClick={() => setStep(2)}>
                   Skip Media Selection
                 </PrimaryButton>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="flex-1 flex flex-col gap-6"
            >
              <div className="mt-4">
                <h1 className="text-2xl font-bold">Edit & Trim</h1>
              </div>

              {/* Live Preview Miniature for Editing */}
              <div className="h-64 rounded-2xl bg-black overflow-hidden relative shadow-lg ring-1 ring-white/10 shrink-0">
                {filePreview ? (
                  file?.type?.startsWith("image") ? (
                    <img src={filePreview} alt="Preview" className={`w-full h-full object-cover opacity-90 ${getFilterClass(filter)}`} />
                  ) : (
                    <video src={filePreview} className={`w-full h-full object-cover opacity-90 ${getFilterClass(filter)}`} muted loop autoPlay playsInline />
                  )
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                    <span className="text-slate-500 font-medium">No Media</span>
                  </div>
                )}
                
                {/* Mock timeline trimmer overlay */}
                {filePreview && file?.type?.startsWith("video") && (
                  <div className="absolute bottom-4 left-4 right-4 h-12 bg-black/40 backdrop-blur-md rounded-xl border border-white/20 flex items-center px-2 py-1">
                    <div className="w-full h-8 bg-slate-700/50 rounded-lg relative overflow-hidden">
                       {/* Playhead */}
                       <div className="absolute top-0 bottom-0 w-1 bg-[#3b82f6] left-1/3 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                       <div className="absolute top-0 bottom-0 left-4 right-1/4 bg-white/20 border-x-2 border-white" />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6 flex-1 overflow-y-auto hide-scrollbar pb-10">
                <VideoFilters currentFilter={filter} onSelectFilter={setFilter} />
                <AudioLibrary selectedAudio={audio} onSelectAudio={setAudio} />
                {(file?.type?.startsWith("video") || filePreview) && (
                   <CaptionGenerator videoFile={file} onCaptionsGenerated={setCaptions} />
                )}
                {captions.length > 0 && (
                  <div className="mt-2 text-xs text-green-400 font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    {captions.length} captions generated
                  </div>
                )}
              </div>

              <div className="mt-auto pt-6 bg-[#0a0f16]">
                <PrimaryButton className="w-full py-4 rounded-full text-base font-semibold" onClick={nextStep}>
                  Next
                </PrimaryButton>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="flex-1 flex flex-col gap-5"
            >
              <div className="mt-4">
                <h1 className="text-2xl font-bold">Details</h1>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Title</label>
                  <InputField
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="E.g., How to build an app..."
                    className="py-3 px-4 rounded-2xl bg-white/5 border-white/10"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Write a caption..."
                    className={cn(selectClass, "min-h-[120px] resize-none")}
                  />
                </div>
              </div>

              <div className="mt-auto pt-6">
                <PrimaryButton className="w-full py-4 rounded-full text-base font-semibold" onClick={nextStep}>
                  Next
                </PrimaryButton>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="flex-1 flex flex-col gap-6"
            >
              <div className="mt-4">
                <h1 className="text-2xl font-bold">Publish Settings</h1>
              </div>

              {/* Live Preview Miniature */}
              <div className="h-48 rounded-2xl bg-black overflow-hidden relative shadow-lg ring-1 ring-white/10">
                {filePreview ? (
                  file?.type?.startsWith("image") ? (
                    <img src={filePreview} alt="Preview" className={`w-full h-full object-cover opacity-80 ${getFilterClass(filter)}`} />
                  ) : (
                    <video src={filePreview} className={`w-full h-full object-cover opacity-80 ${getFilterClass(filter)}`} muted loop autoPlay playsInline />
                  )
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                    <span className="text-slate-500 font-medium">No Media</span>
                  </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="font-bold text-white text-sm truncate">{title || "Untitled Draft"}</h3>
                  <p className="text-xs text-slate-300 truncate">{description || "No description provided."}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
                    <option value="Product">Product</option>
                    <option value="Tutorial">Tutorial</option>
                    <option value="Community">Community</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Visibility</label>
                  <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className={selectClass}>
                    <option value="team">Team Only</option>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>

              <div className="mt-auto pt-6 flex gap-3">
                <PrimaryButton variant="secondary" className="flex-1 py-4 rounded-full" onClick={onSubmit} disabled={isSavingUpload || isPublishingUpload}>
                  Save Draft
                </PrimaryButton>
                <PrimaryButton 
                  className="flex-1 py-4 rounded-full" 
                  onClick={async () => {
                    try {
                      const result = await saveUpload({
                        payload: { title, description, category, visibility },
                        file: canUploadFiles ? file : null,
                      });
                      await publishUpload(result.id);
                      toast({ title: "Published!", description: "Your post is now live." });
                      navigate("/creator-studio");
                    } catch (error) {
                      toast({ title: "Publish failed", description: error.message, variant: "destructive" });
                    }
                  }} 
                  disabled={isSavingUpload || isPublishingUpload}
                >
                  Publish Now
                </PrimaryButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
