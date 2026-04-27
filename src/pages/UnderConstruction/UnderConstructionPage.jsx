import './UnderConstructionPage.css'

const BASE_URL = import.meta.env.BASE_URL
const openingVideoSrc = `${BASE_URL}assets/${encodeURIComponent('ווידאו_פתיחה.mp4')}`
const welcomePng = `${BASE_URL}assets/${encodeURIComponent('ברוכים הבאים.png')}`
const agreeSrc = `${BASE_URL}assets/${encodeURIComponent('אני מסכים.png')}`
const checkboxSrc = `${BASE_URL}assets/${encodeURIComponent('תיבת סימון.png')}`
const spacer2Src = `${BASE_URL}assets/${encodeURIComponent('רווח2.png')}`
const termsSrc = `${BASE_URL}assets/${encodeURIComponent('לצפיה בתנאים.png')}`
const space4Png = `${BASE_URL}assets/${encodeURIComponent('רווח4.png')}`

function UnderConstructionPage() {
  return (
    <div className="under-construction-page">
      <video
        className="uc-bg-video"
        src={openingVideoSrc}
        autoPlay
        loop
        muted
        playsInline
      />

      <div className="uc-content">
        <div className="uc-block">
          <img src={welcomePng} alt="welcome" className="uc-welcome-png" />

          <div className="uc-png-row" dir="rtl">
            <img src={agreeSrc} alt="agree" />
            <img src={checkboxSrc} alt="checkbox" />
            <img src={spacer2Src} alt="space" />
            <img src={termsSrc} alt="terms" />
          </div>

          <img src={space4Png} alt="space4" className="uc-space4-png" />
        </div>
      </div>
    </div>
  )
}

export default UnderConstructionPage
