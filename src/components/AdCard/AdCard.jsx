import { forwardRef, useImperativeHandle, useRef } from 'react'
import './adcard.css'

/**
 * @typedef {object} Builder1CampaignPresentation
 * @property {string} format
 * @property {string} language
 * @property {string} direction
 * @property {string} brandName
 * @property {string} brandSlogan
 * @property {string} formatRatioCss
 * @property {string} safeMarginCss
 * @property {string} layoutClass
 * @property {string} brandPlacementClass
 * @property {string} sloganPlacementClass
 * @property {Record<string, string>} cssVariables
 */

/**
 * @typedef {object} Builder1CampaignAd
 * @property {number} index
 * @property {string|null} headline
 * @property {string} marketingText
 * @property {string} imageSrc
 */

const AdCard = forwardRef(function AdCard(
  {
    ad,
    campaign,
    presentation,
    format,
    language,
    productNameForAlt
  },
  ref
) {
  const compositionRef = useRef(null)

  useImperativeHandle(ref, () => ({
    getCaptureNode: () => compositionRef.current
  }))

  if (!ad || !presentation) return null

  const headlineText =
    ad.headline != null && String(ad.headline).trim() ? String(ad.headline).trim() : null
  const marketingText = String(ad.marketingText ?? '').trim()
  const brandName = presentation.brandName || String(campaign?.productNameResolved ?? '').trim()
  const brandSlogan = presentation.brandSlogan || String(campaign?.brandSlogan ?? '').trim()
  const adFormat = format || presentation.format || 'portrait'
  const formatClass = `ad-card-format-${adFormat}`
  const layoutClass = presentation.layoutClass || 'ad-card-layout-campaign_default'
  const placementClass = presentation.brandPlacementClass || 'ad-card-brand-placement-bottom_left'

  const altProduct = productNameForAlt || brandName || 'Product'
  const imageAlt = `${altProduct} — ad ${ad.index}`

  const compositionStyle = {
    '--ad-safe-margin': presentation.safeMarginCss,
    '--ad-format-ratio': presentation.formatRatioCss,
    '--visual-weight': '0.72',
    '--headline-weight': '0.28',
    ...presentation.cssVariables
  }

  return (
    <article className="ad-card ad-card-campaign-series" aria-labelledby={`ad-card-title-${ad.index}`}>
      <h3 id={`ad-card-title-${ad.index}`} className="ad-card-series-label">
        {language === 'he' ? `מודעה ${ad.index}` : `Ad ${ad.index}`}
      </h3>

      <div className="ad-card-composition">
        <div
          ref={compositionRef}
          className={`ad-card-composition-adunit ${layoutClass} ${formatClass} ${placementClass}`}
          style={compositionStyle}
          data-ad-format={adFormat}
          data-ad-index={ad.index}
          dir={presentation.direction}
        >
          {headlineText ? (
            <div className="ad-card-campaign-headline-zone" dir={presentation.direction}>
              <p className="ad-card-campaign-headline">{headlineText}</p>
            </div>
          ) : (
            <div className="ad-card-campaign-headline-zone ad-card-campaign-headline-zone--empty" aria-hidden="true" />
          )}

          {ad.imageSrc ? (
            <div className="ad-card-composition-visual-zone">
              <div className="ad-card-image">
                <img src={ad.imageSrc} alt={imageAlt} />
              </div>
            </div>
          ) : null}

          <div
            className={`ad-card-campaign-brand-block ${presentation.sloganPlacementClass || ''}`}
            dir={presentation.direction}
          >
            {brandName ? (
              <div className="ad-card-campaign-brand-name">
                <bdi>{brandName}</bdi>
              </div>
            ) : null}
            {brandSlogan ? (
              <div className="ad-card-campaign-brand-slogan">
                <bdi>{brandSlogan}</bdi>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {marketingText ? (
        <div className="ad-card-text" dir={presentation.direction}>
          <p>{marketingText}</p>
        </div>
      ) : null}
    </article>
  )
})

export default AdCard
