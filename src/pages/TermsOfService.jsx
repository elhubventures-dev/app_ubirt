import { Link } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";

export default function TermsOfService() {
  return (
    <div className="min-h-full bg-[#101822] text-slate-200 pb-16">
      <PageHeader title="Terms of Service" backTo="/settings" />
      <article className="max-w-2xl mx-auto px-4 py-6 space-y-6 text-sm leading-relaxed">
        <p className="text-slate-400">Last updated: June 2026</p>

        <section>
          <h2 className="text-lg font-bold text-white mb-2">Acceptance</h2>
          <p className="text-slate-300">
            By using UBIRT you agree to these terms. If you do not agree, do not use the service. You must be
            at least 13 years old (or the minimum age in your country) to create an account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-2">Your account</h2>
          <p className="text-slate-300">
            You are responsible for your account credentials and all activity under your account. Provide
            accurate information and keep your profile details up to date.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-2">Content & conduct</h2>
          <ul className="list-disc pl-5 space-y-2 text-slate-300">
            <li>You retain ownership of content you post; you grant UBIRT a license to host and display it</li>
            <li>Do not post illegal, harassing, hateful, or sexually explicit content involving minors</li>
            <li>Do not spam, impersonate others, or attempt to manipulate the platform</li>
            <li>We may remove content or suspend accounts that violate these rules</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-2">Virtual coins & payments</h2>
          <p className="text-slate-300">
            Platform coins and gift coins are virtual balances within UBIRT. Purchases are processed by Paystack.
            Withdrawals of gift coin earnings are subject to review and minimum thresholds. Coins have no cash
            value outside the platform except where explicitly withdrawn per our payout policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-2">Termination</h2>
          <p className="text-slate-300">
            You may delete your account in Settings. We may suspend or terminate accounts that violate these
            terms or applicable law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-2">Disclaimer</h2>
          <p className="text-slate-300">
            UBIRT is provided &quot;as is&quot; without warranties. We are not liable for indirect damages arising
            from use of the service to the extent permitted by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-2">Contact</h2>
          <p className="text-slate-300">
            Legal inquiries:{" "}
            <a href="mailto:hello@ubirtai.site" className="text-[#3b82f6] hover:underline">
              hello@ubirtai.site
            </a>
          </p>
        </section>

        <p className="text-slate-500 text-xs pt-4">
          See also our <Link to="/privacy" className="text-[#3b82f6] hover:underline">Privacy Policy</Link>.
        </p>
      </article>
    </div>
  );
}
