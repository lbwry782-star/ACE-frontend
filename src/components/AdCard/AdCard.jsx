import { useEffect } from 'react'
import { getFormatRatioCss, warnMarketingTextWordCountInDev } from '../../utils/builder1Campaign'
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

function AdCard({
  ad,
  format,
  productName,
  targetAdCount,
  language,
  onDownloadZip,
  zipLoading = false,
  zipError = null
}) {
  if (!ad) return null

  const marketingText = String(ad.marketingText ?? '').trim()
  const adFormat = String(format ?? 'portrait').trim().toLowerCase() || 'portrait'
  const ratioCss = getFormatRatioCss(adFormat)
  const textDirection = language === 'he' ? 'rtl' : language === 'en' ? 'ltr' : 'auto'

  useEffect(() => {
    if (marketingText) {
      warnMarketingTextWordCountInDev(marketingText)
    }
  }, [marketingText])

  const altText = buildAdAltText({
    productName,
    adIndex: ad.index,
    targetAdCount
  })

  return (
    <article className="builder1-ad-card" aria-label={altText}>
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
        <div className="builder1-marketing-text" dir={textDirection}>
          <p>{marketingText}</p>
        </div>
      ) : null}

      <div className="builder1-ad-actions">
        <button
          type="button"
          className="builder1-ad-download-zip"
          onClick={() => onDownloadZip?.(ad)}
          disabled={zipLoading || !ad.imageSrc}
        >
          {zipLoading ? 'DOWNLOADING…' : 'DOWNLOAD ZIP'}
        </button>
        {zipError ? (
          <p className="builder1-ad-download-error" role="alert">
            {zipError}
          </p>
        ) : null}
      </div>
    </article>
  )
}

export default AdCard
