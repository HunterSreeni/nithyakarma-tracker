import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { TIERS } from '../utils/tiers'

function InfoShell({ title, children }) {
  const navigate = useNavigate()
  return (
    <div className="legal-page">
      <div className="legal-head">
        <button className="legal-back" onClick={() => navigate(-1)} aria-label="Go back"><ChevronLeft size={16} strokeWidth={2.5} /> Back</button>
        <div className="auth-logo" style={{ fontSize: '1rem', margin: 0 }}>Nithya<span>karma</span></div>
      </div>
      <h1 className="legal-title">{title}</h1>
      <div className="legal-body">{children}</div>
    </div>
  )
}

export function AboutPage() {
  return (
    <InfoShell title="About Nithyakarma">
      <p>
        Nithyakarma is a daily tracker for <b>nitya karma anushtanam</b> - the day-to-day observances
        of the Hindu, Brahmin tradition: Sandhyavandhanam, parayanam, japam, and the practices that go
        with them. It was built by <b>Sreeniverse</b> out of a simple, familiar problem - keeping up a
        daily practice is easy to start and easy to quietly let slip, and there was no tool made for
        this specific tradition that made it easy to see, at a glance, what's done and what's not.
      </p>

      <h3>What it's for</h3>
      <p>
        Mark your Sandhyavandhanam (all three sandhyas), your parayanams, and your japam as you
        complete them. The app tracks your streak, tops up your punya, and moves you up a tier as you
        keep at it - a missed day here and there doesn't have to reset months of practice, thanks to
        streak freezes that build up as you go.
      </p>

      <h3>Family, too</h3>
      <p>
        Parents can add family members - typically children - and mark their observances on their
        behalf, each with their own streak and progress. An optional, first-name-only Bala Sabha
        leaderboard lets kids see how they're doing against others, entirely opt-in.
      </p>

      <h3>Respect for every tradition</h3>
      <p>
        Nithyakarma is built for one specific tradition and names it plainly, but it isn't a statement
        about, or against, any other faith or community. If you keep a different daily practice,
        we'd genuinely like to hear about it.
      </p>

      <h3>A personal project</h3>
      <p>
        This app is made and maintained by one person, not a company - if something's broken, missing,
        or could be better, reaching out actually reaches the person who can fix it.
      </p>
    </InfoShell>
  )
}

export function KarmaPage() {
  return (
    <InfoShell title="How Punya &amp; Tiers Work">
      <p>
        Every anushtanam you mark earns <b>punya</b> - points that add up over time and move you
        through a tier ladder. Here's exactly how it's calculated, no guessing required.
      </p>

      <h3>Punya per mark</h3>
      <p>
        Punya is weighted by effort, not flat per log:
      </p>
      <ul>
        <li><b>+5</b> - most practices (Sandhyavandhanam per sandhya, japam, lighter parayanams)</li>
        <li><b>+8</b> - longer parayanams (Vishnu Sahasranamam, Lalitha Sahasranamam, Soundarya
          Lahari, Narayaneeyam, Bhagavad Gita, Bhagavatam)</li>
        <li><b>+12</b> - the longest (Sri Rudram, Devi Mahatmyam)</li>
      </ul>
      <p>
        Sandhyavandhanam only counts the day complete once all three sandhyas (Prathakala, Madhyanika,
        Saayamkala) are marked - each sandhya earns punya on its own as you mark it.
      </p>

      <h3>Tiers</h3>
      <p>Punya moves you up through five tiers:</p>
      <ul>
        {TIERS.map(t => (
          <li key={t.name}><b>{t.name}</b> - from {t.min} punya</li>
        ))}
      </ul>

      <h3>Streaks</h3>
      <p>
        Your overall streak grows by one for every day you complete <i>all</i> your scheduled
        practices. Miss a day and the streak normally resets - unless you have a streak freeze
        available, in which case one freeze is spent automatically to cover a single missed day and
        your streak keeps climbing.
      </p>

      <h3>Streak freezes</h3>
      <p>
        Freeze credits are capped by your tier, and levelling up tops you up to the new cap right
        away:
      </p>
      <ul>
        <li>Shishya - 1 freeze</li>
        <li>Sadhaka - 2 freezes</li>
        <li>Yogi - 3 freezes</li>
        <li>Rishi - 4 freezes</li>
        <li>Brahmarishi - 5 freezes</li>
      </ul>
      <p>
        A successful referral also grants +1 freeze credit (capped the same way) to both you and the
        person you referred, plus 30 days ad-free each.
      </p>

      <h3>Learning verses</h3>
      <p>
        Marking a verse learned on the Learning page earns punya the same way, but doesn't drive your
        streak on its own - genuinely completing the practice from the Today page is what keeps your
        streak alive.
      </p>
    </InfoShell>
  )
}
