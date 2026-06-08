import { Link } from "react-router-dom";
import { parseTextWithMentions } from "@/lib/mentions";

export default function MentionText({ text, className = "" }) {
  const parts = parseTextWithMentions(text);
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.type === "mention" ? (
          <Link
            key={`${part.value}-${index}`}
            to={`/user/${part.value}`}
            className="text-[#60a5fa] hover:underline font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            @{part.value}
          </Link>
        ) : (
          <span key={`t-${index}`}>{part.value}</span>
        )
      )}
    </span>
  );
}
