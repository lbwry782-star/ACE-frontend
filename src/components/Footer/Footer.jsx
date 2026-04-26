import { getAgentDisplayName } from '../../utils/agentDisplayName'
import './footer.css'

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <p className="footer-line-en" lang="en">
          &copy; 2024 {getAgentDisplayName('en')}. All rights reserved.
        </p>
        <p className="footer-line-he" dir="rtl" lang="he">
          &copy; 2024 {getAgentDisplayName('he')}. כל הזכויות שמורות.
        </p>
      </div>
    </footer>
  )
}

export default Footer

