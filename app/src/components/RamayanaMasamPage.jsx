import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

const KANDAMS = [
  { name: 'Bala Kandam', desc: "Rama's birth and childhood in Ayodhya, his marriage to Sita after breaking Shiva's bow at her swayamvara." },
  { name: 'Ayodhya Kandam', desc: 'Rama is set to be crowned king, but Kaikeyi exiles him to the forest for fourteen years; he leaves with Sita and Lakshmana.' },
  { name: 'Aranya Kandam', desc: 'Life in the forest, the killing of Ravana\'s sister Surpanakha, and the abduction of Sita by Ravana.' },
  { name: 'Kishkindha Kandam', desc: 'Rama allies with Sugriva and the vanaras, Hanuman is introduced, and the search for Sita begins.' },
  { name: 'Sundara Kandam', desc: "Hanuman's leap to Lanka, finding Sita, and burning the city - widely read on its own for its focus on devotion and courage." },
  { name: 'Yuddha Kandam', desc: "The war with Ravana's army, his defeat, Sita's return, and Rama's coronation in Ayodhya." },
]

export default function RamayanaMasamPage() {
  const navigate = useNavigate()
  return (
    <div className="legal-page">
      <div className="legal-head">
        <button className="legal-back" onClick={() => navigate(-1)} aria-label="Go back"><ChevronLeft size={16} strokeWidth={2.5} /> Back</button>
        <div className="auth-logo" style={{ fontSize: '1rem', margin: 0 }}>Nithya<span>karma</span></div>
      </div>
      <h1 className="legal-title">Ramayana Masam</h1>
      <div className="legal-body">
        <p>
          Karkidakam, the Malayalam month roughly spanning mid-July to mid-August, is traditionally
          set aside in Kerala for reading the Ramayana - specifically the Adhyatma Ramayanam
          Kilippattu, Thunchath Ezhuthachan's 17th-century Malayalam retelling, read seated before a
          lit lamp.
        </p>
        <p>
          There's no fixed daily schedule - the six kandams below are read at your own pace across
          the month, finishing by the last day of Karkidakam. Tradition holds that the reading should
          never stop on a passage dealing with war, death or sorrow; if a session ends there, read a
          little further to a more auspicious line first. The seventh kandam, Uttara Kandam, is not
          part of this reading.
        </p>

        <h3>The six kandams</h3>
        <ul>
          {KANDAMS.map(k => (
            <li key={k.name}><b>{k.name}</b> - {k.desc}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
