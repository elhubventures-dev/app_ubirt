import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";

function roleLabel(role) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

export default function GroupSettingsSheet({ conversation, onClose, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState(conversation?.inviteCode ?? null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term.trim()), 300);
    return () => clearTimeout(timer);
  }, [term]);

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["group-add-search", debouncedTerm],
    queryFn: () => dataProvider.search(debouncedTerm),
    enabled: showAddMembers && debouncedTerm.length > 0,
  });

  const inviteUrl =
    typeof window !== "undefined" && inviteCode
      ? `${window.location.origin}/group/join/${inviteCode}`
      : "";

  const existingMemberIds = new Set((conversation?.members ?? []).map((m) => m.id));
  const searchUsers = (searchResults?.users ?? []).filter((u) => !existingMemberIds.has(u.id));

  const copyInviteLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast({ title: "Invite link copied" });
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  };

  const handleRegenerateInvite = async () => {
    setBusy(true);
    try {
      const code = await dataProvider.regenerateGroupInvite(conversation.id);
      setInviteCode(code);
      toast({ title: "New invite link generated" });
      onUpdated?.();
    } catch (err) {
      toast({ title: "Failed to regenerate link", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleAddMember = async (memberId) => {
    setBusy(true);
    try {
      await dataProvider.addGroupMembers(conversation.id, [memberId]);
      toast({ title: "Member added" });
      setTerm("");
      setShowAddMembers(false);
      onUpdated?.();
    } catch (err) {
      toast({ title: "Could not add member", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (memberId, role) => {
    setBusy(true);
    try {
      await dataProvider.updateGroupMemberRole(conversation.id, memberId, role);
      toast({ title: role === "admin" ? "Promoted to admin" : "Demoted to member" });
      onUpdated?.();
    } catch (err) {
      toast({ title: "Could not update role", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    setBusy(true);
    try {
      await dataProvider.removeGroupMember(conversation.id, memberId);
      toast({ title: memberId === user?.id ? "You left the group" : "Member removed" });
      onUpdated?.();
      if (memberId === user?.id) onClose?.();
    } catch (err) {
      toast({ title: "Could not remove member", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const content = (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-[201] max-h-[90dvh] bg-[#101822] rounded-t-3xl flex flex-col shadow-2xl border-t border-white/10"
      >
        <div className="flex justify-center p-3 shrink-0">
          <div className="w-12 h-1.5 bg-white/20 rounded-full" />
        </div>

        <div className="px-4 pb-3 flex justify-between items-center border-b border-white/5 shrink-0">
          <h3 className="font-semibold text-lg">Group Settings</h3>
          <button type="button" onClick={onClose} className="text-slate-400 p-1 hover:text-white rounded-full bg-white/5">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
          {conversation?.canManage && inviteCode && (
            <section>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Invite Link</h4>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-3">
                <p className="text-xs text-slate-400 break-all">{inviteUrl}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    disabled={busy}
                    className="flex-1 py-2.5 rounded-xl bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] disabled:opacity-50"
                  >
                    Copy Link
                  </button>
                  <button
                    type="button"
                    onClick={handleRegenerateInvite}
                    disabled={busy}
                    className="px-4 py-2.5 rounded-xl bg-white/5 text-slate-300 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Members ({conversation?.memberCount ?? conversation?.members?.length ?? 0})
              </h4>
              {conversation?.canManage && (
                <button
                  type="button"
                  onClick={() => setShowAddMembers((v) => !v)}
                  className="text-[#3b82f6] text-xs font-semibold hover:underline"
                >
                  {showAddMembers ? "Cancel" : "Add"}
                </button>
              )}
            </div>

            {showAddMembers && (
              <div className="mb-3 space-y-2">
                <input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Search users to add..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none"
                />
                {debouncedTerm && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {isSearching ? (
                      <p className="text-sm text-slate-400 py-2">Searching...</p>
                    ) : searchUsers.length === 0 ? (
                      <p className="text-sm text-slate-400 py-2">No users found.</p>
                    ) : (
                      searchUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          disabled={busy}
                          onClick={() => handleAddMember(u.id)}
                          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 disabled:opacity-50"
                        >
                          <img
                            src={u.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${u.username}`}
                            alt=""
                            className="w-8 h-8 rounded-full"
                          />
                          <span className="text-sm text-white truncate">{u.name}</span>
                          <span className="material-symbols-outlined text-[#3b82f6] text-[18px] ml-auto">person_add</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              {(conversation?.members ?? []).map((member) => {
                const isMe = member.id === user?.id;
                const isOwner = conversation?.myRole === "owner";
                const canManageMember =
                  conversation?.canManage && !isMe && member.role !== "owner";

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5"
                  >
                    <img
                      src={member.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${member.username || member.name}`}
                      alt=""
                      className="w-10 h-10 rounded-full shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {member.name}{isMe ? " (You)" : ""}
                      </p>
                      <p className="text-xs text-slate-400">{roleLabel(member.role)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isOwner && member.role !== "owner" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            handleRoleChange(member.id, member.role === "admin" ? "member" : "admin")
                          }
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white/10 text-slate-300 hover:bg-white/15 disabled:opacity-50"
                        >
                          {member.role === "admin" ? "Demote" : "Make Admin"}
                        </button>
                      )}
                      {(canManageMember || (isMe && member.role !== "owner")) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                          aria-label={isMe ? "Leave group" : "Remove member"}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {isMe ? "logout" : "person_remove"}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </motion.div>
    </>
  );

  return createPortal(content, document.body);
}
