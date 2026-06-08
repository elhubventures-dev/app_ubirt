import { Link } from "react-router-dom";
import { feedPostPath } from "@/lib/feedLinks";

export default function SharedPostBubble({ post, isMe }) {
  if (!post) return null;
  return (
    <Link
      to={feedPostPath(post.id)}
      onClick={(e) => e.stopPropagation()}
      className={`block rounded-xl overflow-hidden border ${
        isMe ? "border-white/20 bg-white/10" : "border-white/10 bg-black/20"
      } max-w-[220px]`}
    >
      {post.media_url ? (
        <img src={post.media_url} alt="" className="w-full aspect-[4/5] object-cover" />
      ) : null}
      <div className="p-2.5">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">Shared post</p>
        <p className="text-xs line-clamp-2">{post.caption || "View post"}</p>
      </div>
    </Link>
  );
}
