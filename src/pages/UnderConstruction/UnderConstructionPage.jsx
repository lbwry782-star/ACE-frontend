import './UnderConstructionPage.css'

const BASE_URL = import.meta.env.BASE_URL
const openingVideoSrc = `${BASE_URL}assets/${encodeURIComponent('ווידאו_פתיחה.mp4')}`
const agreeSrc = `${BASE_URL}assets/${encodeURIComponent('אני מסכים.png')}`
const checkboxSrc = `${BASE_URL}assets/${encodeURIComponent('תיבת סימון.png')}`
const spacer2Src = `${BASE_URL}assets/${encodeURIComponent('רווח2.png')}`
const termsSrc = `${BASE_URL}assets/${encodeURIComponent('לצפיה בתנאים.png')}`

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
        <div className="uc-png-row" dir="rtl">
          <img src={agreeSrc} alt="" />
          <img src={checkboxSrc} alt="" />
          <img src={spacer2Src} alt="" />
          <img src={termsSrc} alt="" />
        </div>
      </div>
    </div>
  )
}

export default UnderConstructionPage
