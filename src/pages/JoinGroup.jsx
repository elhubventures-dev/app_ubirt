import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";
import { useToast } from "@/components/ui/use-toast";

export default function JoinGroup() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState("joining");
  const joinedRef = useRef(false);

  const joinMutation = useMutation({
    mutationFn: () => dataProvider.joinGroupViaInvite(code),
    onSuccess: (conv) => {
      setStatus("success");
      toast({ title: `Joined ${conv.name}` });
      navigate(`/group/${conv.id}`, { replace: true });
    },
    onError: (error) => {
      setStatus("error");
      toast({ title: "Could not join group", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!code || joinedRef.current) return;
    joinedRef.current = true;
    joinMutation.mutate();
  }, [code]);

  return (
    <div className="min-h-[100dvh] bg-[#101822] text-white flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3b82f6] to-purple-500 flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-[32px]">groups</span>
      </div>

      {status === "joining" && (
        <>
          <div className="animate-spin-slow rounded-full h-8 w-8 border-t-2 border-b-2 border-[#3b82f6] mb-4" />
          <h1 className="text-xl font-bold">Joining group...</h1>
          <p className="text-slate-400 text-sm mt-2">Please wait while we add you to the group.</p>
        </>
      )}

      {status === "error" && (
        <>
          <h1 className="text-xl font-bold text-red-400">Could not join</h1>
          <p className="text-slate-400 text-sm mt-2 mb-6">
            This invite link may be invalid or expired.
          </p>
          <Link
            to="/messages"
            className="px-6 py-3 rounded-full bg-[#3b82f6] text-white font-semibold hover:bg-[#2563eb]"
          >
            Back to Messages
          </Link>
        </>
      )}
    </div>
  );
}
