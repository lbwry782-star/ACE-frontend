import { getFormatRatioCss } from '../../utils/builder1Campaign'
import './adcard.css'

/**
 * @typedef {object} Builder1CampaignAd
 * @property {number} index
 * @property {string|null} headline
 * @property {string} marketingText
 * @property {string} imageSrc
 */

function buildAdAltText({ productName, adIndex, targetAdCount }) {
  const name = String(productName ?? 'Product').trim() || 'Product'
  const idx = Number(adIndex)
  const total = Number(targetAdCount)
  if (Number.isInteger(total) && total > 0 && Number.isInteger(idx) && idx > 0) {
    return `${name} — advertisement ${idx} of ${total}`
  }
  if (Number.isInteger(idx) && idx > 0) {
    return `${name} — advertisement ${idx}`
  }
  return `${name} — advertisement`
}

function AdCard({ ad, format, productName, targetAdCount, language }) {
  if (!ad) return null

  const marketingText = String(ad.marketingText ?? '').trim()
  const adFormat = String(format ?? 'portrait').trim().toLowerCase() || 'portrait'
  const ratioCss = getFormatRatioCss(adFormat)
  const seriesLabel =
    Number(targetAdCount) > 0
      ? language === 'he'
        ? `מודעה ${ad.index} מתוך ${targetAdCount}`
        : `Ad ${ad.index} of ${targetAdCount}`
      : language === 'he'
        ? `מודעה ${ad.index}`
        : `Ad ${ad.index}`

  const altText = buildAdAltText({
    productName,
    adIndex: ad.index,
    targetAdCount
  })

  return (
    <article className="builder1-ad-card" aria-labelledby={`builder1-ad-title-${ad.index}`}>
      <h3 id={`builder1-ad-title-${ad.index}`} className="builder1-ad-series-label">
        {seriesLabel}
      </h3>

      <div
        className="builder1-ad-canvas"
        style={{ '--builder1-ad-ratio': ratioCss }}
        data-ad-format={adFormat}
        data-ad-index={ad.index}
      >
        {ad.imageSrc ? (
          <img className="builder1-final-ad-image" src={ad.imageSrc} alt={altText} />
        ) : null}
      </div>

      {marketingText ? (
        <div className="builder1-marketing-text" dir="auto">
          <p>{marketingText}</p>
        </div>
      ) : null}
    </article>
  )
}

export default AdCard
