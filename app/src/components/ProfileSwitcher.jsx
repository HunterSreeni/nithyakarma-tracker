import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProfileSwitcher() {
  const { profile, familyMembers, selectedMember, setSelectedMember } = useAuth()
  const navigate = useNavigate()
  const initials = (n) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="profile-switch">
      <button className={`ps-chip ${!selectedMember ? 'on' : ''}`} onClick={() => setSelectedMember(null)}>
        <span className="ps-av">{initials(profile.display_name)}</span>Me
      </button>
      {familyMembers.map(fm => (
        <button key={fm.id} className={`ps-chip ${selectedMember?.id === fm.id ? 'on' : ''}`}
          onClick={() => setSelectedMember(fm)}>
          <span className="ps-av">{initials(fm.name)}</span>{fm.name.split(' ')[0]}
        </button>
      ))}
      <button className="ps-chip" onClick={() => navigate('/profile#family')}>
        <span className="ps-av">+</span>Add child
      </button>
    </div>
  )
}
