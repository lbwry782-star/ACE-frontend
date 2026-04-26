import { getAgentDisplayName } from '../../utils/agentDisplayName'
import './header.css'

function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <h1 className="header-title">
          <span className="header-title-en" lang="en">
            {getAgentDisplayName('en')}
          </span>
          <span className="header-title-he" dir="rtl" lang="he">
            {getAgentDisplayName('he')}
          </span>
        </h1>
      </div>
    </header>
  )
}

export default Header

