import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export default function ProfileQASection({ profileId, username, isSelf }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState({});

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["profile-questions", profileId],
    queryFn: () => dataProvider.getProfileQuestions(profileId),
    enabled: Boolean(profileId),
  });

  const submitMutation = useMutation({
    mutationFn: (q) => dataProvider.submitProfileQuestion(profileId, q),
    onSuccess: () => {
      setQuestion("");
      queryClient.invalidateQueries({ queryKey: ["profile-questions", profileId] });
      toast({ title: "Question sent" });
    },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const answerMutation = useMutation({
    mutationFn: ({ questionId, answer }) => dataProvider.answerProfileQuestion(questionId, answer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-questions", profileId] });
      toast({ title: "Answer published" });
    },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const publicAnswers = questions.filter((q) => q.answer);
  const pending = isSelf ? questions.filter((q) => !q.answer) : [];

  return (
    <section className="mt-8 px-4">
      <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Q&amp;A</h2>

      {!isSelf && user && (
        <div className="mb-4 flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={`Ask @${username} a question...`}
            className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white"
          />
          <PrimaryButton
            onClick={() => submitMutation.mutate(question.trim())}
            disabled={submitMutation.isPending || question.trim().length < 3}
            className="rounded-xl px-4 shrink-0"
          >
            Ask
          </PrimaryButton>
        </div>
      )}

      {isSelf && pending.length > 0 && (
        <div className="mb-4 space-y-3">
          <p className="text-xs text-slate-500">Pending questions</p>
          {pending.map((q) => (
            <div key={q.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-sm text-white font-medium">{q.question}</p>
              <p className="text-xs text-slate-500 mt-1">from {q.askerName}</p>
              <textarea
                value={answerDrafts[q.id] ?? ""}
                onChange={(e) => setAnswerDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                placeholder="Write your answer..."
                rows={2}
                className="w-full mt-3 rounded-xl bg-[#0d1420] border border-white/10 px-3 py-2 text-sm text-white resize-none"
              />
              <PrimaryButton
                className="mt-2 rounded-xl text-sm"
                onClick={() => answerMutation.mutate({ questionId: q.id, answer: answerDrafts[q.id] })}
                disabled={answerMutation.isPending || !(answerDrafts[q.id]?.trim())}
              >
                Publish answer
              </PrimaryButton>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-slate-500 text-sm">Loading...</p>
      ) : !publicAnswers.length ? (
        <p className="text-slate-500 text-sm">No public Q&amp;A yet.</p>
      ) : (
        <div className="space-y-3">
          {publicAnswers.map((q) => (
            <div key={q.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-[#3b82f6] font-semibold">Q: {q.question}</p>
              <p className="text-sm text-slate-200 mt-2">A: {q.answer}</p>
              {q.askerUsername ? (
                <Link to={`/user/${q.askerUsername}`} className="text-[10px] text-slate-500 mt-2 inline-block hover:text-[#3b82f6]">
                  Asked by @{q.askerUsername}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
