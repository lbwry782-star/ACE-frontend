import './UnderConstructionPage.css'

const BASE_URL = import.meta.env.BASE_URL
const openingVideoSrc = `${BASE_URL}assets/${encodeURIComponent('ווידאו_פתיחה.mp4')}`
const welcomePng = `${BASE_URL}assets/${encodeURIComponent('ברוכים הבאים.png')}`
const agreeSrc = `${BASE_URL}assets/${encodeURIComponent('אני מסכים.png')}`
const checkboxSrc = `${BASE_URL}assets/${encodeURIComponent('תיבת סימון.png')}`
const spacePng = `${BASE_URL}assets/${encodeURIComponent('רווח.png')}`
const termsSrc = `${BASE_URL}assets/${encodeURIComponent('לצפיה בתנאים.png')}`
const space4Png = `${BASE_URL}assets/${encodeURIComponent('רווח4.png')}`
const videoPng = `${BASE_URL}assets/${encodeURIComponent('וידאו.png')}`
const space3Png = `${BASE_URL}assets/${encodeURIComponent('רווח3.png')}`
const adPng = `${BASE_URL}assets/${encodeURIComponent('מודעה.png')}`

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
          <img src={welcomePng} alt="welcome" className="uc-img" />

          <div className="uc-top-row">
            <img src={agreeSrc} alt="agree" className="uc-img" />
            <img src={checkboxSrc} alt="checkbox" className="uc-img" />
            <img src={spacePng} alt="space" className="uc-img" />
            <img src={termsSrc} alt="terms" className="uc-img" />
          </div>

          <div className="uc-lower-row">
            <img src={space4Png} alt="space4" className="uc-img" />

            <div className="uc-choice-row">
              <img src={videoPng} alt="video" className="uc-img" />
              <img src={space3Png} alt="space3" className="uc-img" />
              <img src={adPng} alt="ad" className="uc-img" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UnderConstructionPage
