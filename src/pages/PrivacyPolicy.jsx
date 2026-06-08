import { Link } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-full bg-[#101822] text-slate-200 pb-16">
      <PageHeader title="Privacy Policy" backTo="/settings" />
      <article className="max-w-2xl mx-auto px-4 py-6 space-y-6 text-sm leading-relaxed">
        <p className="text-slate-400">Last updated: June 2026</p>

        <section>
          <h2 className="text-lg font-bold text-white mb-2">Overview</h2>
          <p>
            UBIRT (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates the UBIRT mobile app and website at{" "}
            <a href="https://app.ubirtai.site" className="text-[#3b82f6] hover:underline">
              app.ubirtai.site
            </a>
            . This policy explains what data we collect, how we use it, and your choices.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-2">Data we collect</h2>
          <ul className="list-disc pl-5 space-y-2 text-slate-300">
            <li>Account information: email, username, display name, profile photo, bio</li>
            <li>Content you create: posts, comments, messages, voice notes</li>
            <li>Usage data: likes, follows, wallet transactions, device push tokens</li>
            <li>Technical data: IP address, browser/device type, crash logs (if Sentry enabled)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-2">How we use data</h2>
          <ul className="list-disc pl-5 space-y-2 text-slate-300">
            <li>Provide and improve the social and creator features of UBIRT</li>
            <li>Process payments and wallet transactions via Paystack</li>
            <li>Send notifications you have opted into</li>
            <li>Moderate content and enforce community guidelines</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-2">Third-party services</h2>
          <p className="text-slate-300">
            We use Supabase (auth, database, storage), Vercel (hosting), Paystack (payments), Firebase/APNs
            (push notifications), and optionally OpenAI (AI features), Sentry (errors), and PostHog (analytics).
            Each provider has its own privacy policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-2">Your rights</h2>
          <p className="text-slate-300">
            You can update your profile in Settings, manage notification preferences, block users, and delete
            your account at any time. Deletion permanently removes your profile and associated content.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-2">Contact</h2>
          <p className="text-slate-300">
            Questions about privacy:{" "}
            <a href="mailto:hello@ubirtai.site" className="text-[#3b82f6] hover:underline">
              hello@ubirtai.site
            </a>
          </p>
        </section>

        <p className="text-slate-500 text-xs pt-4">
          See also our <Link to="/terms" className="text-[#3b82f6] hover:underline">Terms of Service</Link>.
        </p>
      </article>
    </div>
  );
}
