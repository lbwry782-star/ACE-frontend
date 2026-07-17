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
 * @property {string} headlinePlacementClass
 * @property {string} headlineAlignmentClass
 * @property {string} headlineTreatmentClass
 * @property {string} brandPlacementClass
 * @property {string} sloganPlacementClass
 * @property {string} copySafeAreaClass
 * @property {string} backgroundTreatmentClass
 * @property {string} borderTreatmentClass
 * @property {string} recurringGraphicDeviceClass
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
    targetAdCount,
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
  const brandPlacementClass = presentation.brandPlacementClass || 'ad-card-brand-placement-bottom_left'
  const totalAds = Number(targetAdCount) > 0 ? Number(targetAdCount) : null

  const altProduct = productNameForAlt || brandName || 'Product'
  const imageAlt = `${altProduct} — ad ${ad.index}`

  const compositionClassNames = [
    'ad-card-composition-adunit',
    'ad-card-composition-canvas',
    layoutClass,
    formatClass,
    brandPlacementClass,
    presentation.copySafeAreaClass,
    presentation.backgroundTreatmentClass,
    presentation.borderTreatmentClass,
    presentation.recurringGraphicDeviceClass,
    presentation.imageStyleClass
  ]
    .filter(Boolean)
    .join(' ')

  const compositionStyle = {
    '--ad-safe-margin': presentation.safeMarginCss,
    '--ad-format-ratio': presentation.formatRatioCss,
    ...presentation.cssVariables
  }

  const seriesLabel =
    totalAds != null
      ? language === 'he'
        ? `מודעה ${ad.index} מתוך ${totalAds}`
        : `Ad ${ad.index} of ${totalAds}`
      : language === 'he'
        ? `מודעה ${ad.index}`
        : `Ad ${ad.index}`

  return (
    <article className="ad-card ad-card-campaign-series" aria-labelledby={`ad-card-title-${ad.index}`}>
      <h3 id={`ad-card-title-${ad.index}`} className="ad-card-series-label">
        {seriesLabel}
      </h3>

      <div className="ad-card-composition">
        <div
          ref={compositionRef}
          className={compositionClassNames}
          style={compositionStyle}
          data-ad-format={adFormat}
          data-ad-index={ad.index}
          dir={presentation.direction}
        >
          {ad.imageSrc ? (
            <div className="ad-card-visual-layer" aria-hidden="true">
              <img src={ad.imageSrc} alt={imageAlt} className="ad-card-visual-image" />
            </div>
          ) : null}

          <div
            className={`ad-card-copy-safe-overlay ${presentation.copySafeAreaClass || 'ad-card-copy-safe-standard'}`}
            dir={presentation.direction}
          >
            {headlineText ? (
              <p
                className={[
                  'ad-card-headline-overlay',
                  presentation.headlinePlacementClass,
                  presentation.headlineAlignmentClass,
                  presentation.headlineTreatmentClass
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <bdi>{headlineText}</bdi>
              </p>
            ) : null}
          </div>

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
