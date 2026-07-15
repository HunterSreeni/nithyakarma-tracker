import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

const EFFECTIVE = '11 July 2026'
const CONTACT = 'support@sreeniverse.co.in'

function LegalShell({ title, children }) {
  const navigate = useNavigate()
  return (
    <div className="legal-page">
      <div className="legal-head">
        <button className="legal-back" onClick={() => navigate(-1)} aria-label="Go back"><ChevronLeft size={16} strokeWidth={2.5} /> Back</button>
        <div className="auth-logo" style={{ fontSize: '1rem', margin: 0 }}>Nithya<span>karma</span></div>
      </div>
      <h1 className="legal-title">{title}</h1>
      <div className="legal-date">Effective {EFFECTIVE} · Sreeniverse</div>
      <div className="legal-body">{children}</div>
      <div className="legal-foot">Questions? <a href={`mailto:${CONTACT}`}>{CONTACT}</a></div>
    </div>
  )
}

export function TermsPage() {
  return (
    <LegalShell title="Terms &amp; Conditions">
      <p>
        Nithyakarma is a personal tool from <b>Sreeniverse</b> to help you track your own daily
        spiritual practices and rituals (nitya karma anushtanam) drawn from the Hindu, Brahmin
        tradition - Sandhyavandhanam, parayanam, japam and similar observances. It is a personal
        devotional aid. It respects every faith and community and is not a statement about, or
        against, any other religion or belief. By creating an account or using the app, you agree
        to these Terms.
      </p>

      <h3>Your account</h3>
      <p>
        You are responsible for keeping your login secure and for activity under your account.
        Please provide accurate details. One account per person.
      </p>

      <h3>Family members</h3>
      <p>
        You may add family-member profiles (for example, children) to track on their behalf. By
        adding a profile you confirm you are that person's parent or legal guardian and are
        authorised to manage their observances in the app.
      </p>

      <h3>Guidance, not authority</h3>
      <p>
        The practice list and reminders are provided for your convenience. Nithyakarma is a tracker,
        not a religious authority, and does not guarantee scriptural or ritual completeness or
        correctness. For the correct way to perform any anushtanam, please follow your acharya,
        family elders, or sampradaya.
      </p>

      <h3>Acceptable use</h3>
      <p>
        Use the app lawfully and for personal use. Do not attempt to disrupt, reverse-engineer, or
        abuse the service or other users.
      </p>

      <h3>Free app, ads &amp; referrals</h3>
      <p>
        The app is free. On Android it may show ads; referrals can grant ad-free periods. These
        offerings may change over time.
      </p>

      <h3>Availability &amp; liability</h3>
      <p>
        The service is provided "as is" and may be changed or interrupted. To the extent permitted
        by law, Sreeniverse is not liable for indirect or consequential losses arising from use of
        the app.
      </p>

      <h3>Ending your use</h3>
      <p>
        You can delete your account at any time from Profile → Danger zone, which permanently
        removes your data. We may suspend accounts that violate these Terms.
      </p>

      <h3>Changes &amp; governing law</h3>
      <p>
        We may update these Terms; continued use means you accept the changes. These Terms are
        governed by the laws of India.
      </p>
    </LegalShell>
  )
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This policy explains what <b>Sreeniverse</b> collects in the Nithyakarma app and how it is
        used. The app is a personal tracker for your Hindu, Brahmin-tradition daily practices; we
        collect only what is needed to run it.
      </p>

      <h3>What we collect</h3>
      <ul>
        <li><b>Account:</b> your email and password (handled by our auth provider; the password is stored only as a secure hash).</li>
        <li><b>Profile:</b> display name and gender (used only to offer gender-appropriate practices such as Sandhyavandhanam), plus your streaks, punya points, tier and referral code.</li>
        <li><b>Family members you add:</b> name, gender, upanayanam status and opt-in flags.</li>
        <li><b>Practice data:</b> which anushtanams you track, your daily logs, and your timezone (for reminders).</li>
        <li><b>Notifications:</b> your reminder preference and push tokens for web/Android.</li>
      </ul>

      <h3>How we use it</h3>
      <p>
        To provide the tracker, compute streaks and tiers, send the reminders you enable, show
        community leaderboards (which you can opt out of), and apply referrals.
      </p>

      <h3>Who processes your data</h3>
      <ul>
        <li><b>Supabase</b> - authentication and database hosting.</li>
        <li><b>Firebase Cloud Messaging (Google)</b> - delivering Android push reminders.</li>
        <li><b>Google AdMob</b> - ads on Android only (skipped when ad-free); AdMob may use device identifiers per Google's policies.</li>
        <li><b>WhatsApp</b> - the "share" button simply opens a WhatsApp link with text you choose; we do not send your data to WhatsApp ourselves.</li>
      </ul>

      <h3>Leaderboards</h3>
      <p>
        If you appear on a leaderboard, other members can see your display name, tier and streak.
        You can hide yourself any time from Profile → Privacy. Children's entries (Bala Sabha) show
        first name only and require parent opt-in.
      </p>

      <h3>Deleting your data</h3>
      <p>
        You can delete your account any time from Profile → Danger zone. This permanently removes
        your profile, family-member profiles, all logs, streaks and leaderboard entries.
      </p>

      <h3>Security &amp; children</h3>
      <p>
        Passwords are hashed and row-level security restricts your data to you. Family-member
        profiles are managed entirely by the parent/guardian - children do not log in and we do not
        collect data directly from them.
      </p>

      <h3>Changes &amp; contact</h3>
      <p>
        We may update this policy; continued use means acceptance. This policy is governed by the
        laws of India. For any privacy request, contact us at the address below.
      </p>
    </LegalShell>
  )
}
