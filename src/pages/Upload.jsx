import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCreatorStudio } from "@/hooks/useCreatorStudio";
import { useToast } from "@/components/ui/use-toast";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { InputField } from "@/components/ui/InputField";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { ALLOWED_IMAGE_ACCEPT, validateImageFile } from "@/lib/uploadPolicy";
import { motion, AnimatePresence } from "framer-motion";
import { VideoFilters, getFilterClass } from "@/components/studio/VideoFilters";
import { getSoundById } from "@/lib/soundLibrary";
import PageHeader from "@/components/layout/PageHeader";

const selectClass = "w-full rounded-2xl px-4 py-3 bg-white/5 border border-white/10 text-white focus:bg-white/10 transition-colors outline-none";

export default function Upload() {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Product");
  const [visibility, setVisibility] = useState("public");
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
  const canUploadFiles = isSupabaseConfigured();

  useEffect(() => {
    const soundId = new URLSearchParams(location.search).get("sound");
    if (soundId && getSoundById(soundId)) {
      setAudio(soundId);
    }
  }, [location.search]);

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
    if (!selected) return;
    try {
      validateImageFile(selected);
      setFile(selected);
      setFilePreview(URL.createObjectURL(selected));
      setStep(2);
    } catch (error) {
      toast({ title: "Invalid file", description: error.message, variant: "destructive" });
    }
  };

  const publishNow = async () => {
    if (!title.trim()) {
      toast({ title: "Title required", description: "Please enter a title.", variant: "destructive" });
      return;
    }
    if (!file) {
      toast({ title: "Image required", description: "Select a JPG or PNG image first.", variant: "destructive" });
      return;
    }
    try {
      const result = await saveUpload({
        payload: { title, description, category, visibility, filter, audio, captions },
        file,
      });
      await publishUpload(result.id);
      toast({ title: "Published!", description: "Your post is now live." });
      navigate("/feed");
    } catch (error) {
      toast({ title: "Publish failed", description: error.message, variant: "destructive" });
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 3));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <div className="min-h-screen bg-[#101822] text-white flex flex-col relative overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-[#0a111a] via-[#101822] to-[#152336] z-0" />
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#0d5bba]/20 blur-[120px] rounded-full z-0 pointer-events-none" />

      <PageHeader
        onBack={() => (step > 1 ? prevStep() : navigate(-1))}
        backIcon={step > 1 ? "arrow_back" : "close"}
        backLabel={step > 1 ? "Previous step" : "Close"}
        center={
          <div className="flex gap-1.5 w-32">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? "bg-[#3b82f6]" : "bg-white/20"}`}
              />
            ))}
          </div>
        }
        className="bg-[#101822]/50"
      />

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
                <h1 className="text-3xl font-bold tracking-tight">Select Image</h1>
                <p className="text-slate-400 mt-2 text-sm">Upload a JPG or PNG photo to get started.</p>
              </div>

              <div className="flex-1 flex items-center justify-center mt-8">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-[3/4] rounded-3xl border-2 border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-[#3b82f6]/50 transition-all flex flex-col items-center justify-center gap-4 group"
                >
                  <div className="w-16 h-16 rounded-full bg-[#3b82f6]/20 flex items-center justify-center text-[#3b82f6] group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[32px]">upload</span>
                  </div>
                  <span className="text-slate-300 font-medium">Tap to select image</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_IMAGE_ACCEPT}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="mt-6 flex gap-3">
                <Link
                  to="/create"
                  className="flex-1 py-3 rounded-full bg-white/10 text-center text-sm font-semibold hover:bg-white/20"
                >
                  Use Camera
                </Link>
              </div>

              {!canUploadFiles && (
                <div className="mt-6 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-200/80 text-sm flex gap-3">
                  <span className="material-symbols-outlined text-yellow-500">info</span>
                  <p>Connect Supabase in your environment to enable uploads.</p>
                </div>
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
                <h1 className="text-2xl font-bold">Edit Photo</h1>
              </div>

              {/* Full-image preview — entire upload visible before publishing */}
              <div className="flex-1 min-h-[220px] max-h-[min(52vh,520px)] rounded-2xl bg-black overflow-hidden relative shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                {filePreview ? (
                  <img
                    src={filePreview}
                    alt="Preview"
                    className={`max-w-full max-h-full w-auto h-auto object-contain ${getFilterClass(filter)}`}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                    <span className="text-slate-500 font-medium">No image</span>
                  </div>
                )}
              </div>

              <div className="space-y-4 shrink-0 overflow-y-auto hide-scrollbar max-h-[38vh] pb-2">
                <VideoFilters currentFilter={filter} onSelectFilter={setFilter} previewSrc={filePreview} />
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
                <PrimaryButton
                  className="w-full py-4 rounded-full text-base font-semibold"
                  onClick={publishNow}
                  disabled={isSavingUpload || isPublishingUpload}
                >
                  {isSavingUpload || isPublishingUpload ? "Publishing..." : "Publish"}
                </PrimaryButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
