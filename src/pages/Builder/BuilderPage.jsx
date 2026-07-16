import { useState, useRef, useEffect, useCallback, useContext, useMemo } from 'react'
import ProductForm from '../../components/Form/ProductForm'
import ProgressBar from '../../components/ProgressBar/ProgressBar'
import AdCard from '../../components/AdCard/AdCard'
import ErrorPanel from '../../components/Error/ErrorPanel'
import { SecurityConfigContext } from '../../App'
import { fetchLatestPaid, API_BASE_URL, NetworkError, ApiError } from '../../services/api'
import {
  normalizeBuilder1AdCount,
  normalizeBuilder1FormatForApi,
  validateCampaignResponse,
  buildCampaignPresentation,
  computeStageProgress,
  getStageLabel,
  sanitizeCampaignZipFilename,
  createDevMockCampaign
} from '../../utils/builder1Campaign'
import { captureNodeAsPngBase64 } from '../../utils/builder1Capture'
import './builder.css'

const BUILDER1_ACCESS_GUARD_DISABLED = true
const PREVIEW_REDIRECT_URL = 'https://ace-advertising.agency/#/preview'
const BUILDER1_MAX_ADS_SESSION_KEY = 'ace_builder1_max_ads'
const DEFAULT_BUILDER1_SESSION_LIMIT = 2
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 15 * 60 * 1000

const STATE = {
  IDLE: 'IDLE',
  GENERATING: 'GENERATING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR'
}

const redirectToPreview = () => {
  if (BUILDER1_ACCESS_GUARD_DISABLED) return
  window.location.href = PREVIEW_REDIRECT_URL
}

function hasBuilder1DevQueryUnlock() {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash || ''
  if (hash.includes('?')) {
    const query = hash.split('?').slice(1).join('?')
    if (new URLSearchParams(query).get('dev') === '1') return true
  }
  try {
    if (new URLSearchParams(window.location.search || '').get('dev') === '1') return true
  } catch (_) {
    /* ignore */
  }
  return false
}

function isBuilder1DevAccessBypass() {
  if (BUILDER1_ACCESS_GUARD_DISABLED) return true
  if (typeof window === 'undefined') return false
  if (hasBuilder1DevQueryUnlock()) return true
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') return true
  return Boolean(import.meta.env?.DEV)
}

function resolveBuilder1SessionLimit() {
  return normalizeBuilder1AdCount(
    (() => {
      try {
        return sessionStorage.getItem(BUILDER1_MAX_ADS_SESSION_KEY)
      } catch (_) {
        return null
      }
    })() ?? DEFAULT_BUILDER1_SESSION_LIMIT
  )
}

function mapUserFacingError(err) {
  const raw = String(err?.message ?? err ?? 'Generation failed')
  const lower = raw.toLowerCase()
  if (err instanceof NetworkError || err?.isNetworkError) {
    return 'Network error: Unable to connect to server. Please check your connection and try again.'
  }
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'Generation timed out. Please try again.'
  }
  if (lower.includes('response_contract')) {
    return 'The server returned an invalid campaign response. Please try again.'
  }
  if (lower.includes('invalid_ad_count')) {
    return 'Invalid campaign size. Please refresh and try again.'
  }
  if (lower.includes('planning_failed')) {
    return 'Campaign planning failed. Please try again.'
  }
  if (lower.includes('image_generation')) {
    return 'Image generation failed. Please try again.'
  }
  if (lower.includes('not_found') || lower.includes('job_not_found')) {
    return 'Campaign job not found. Please start a new campaign.'
  }
  return raw
}

async function pollBuilder1CampaignJob({
  jobId,
  pollToken,
  isStale,
  onProgress
}) {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  let previousProgress = 0

  while (Date.now() < deadline) {
    if (isStale()) {
      throw new Error('Stale poll cancelled')
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    if (isStale()) {
      throw new Error('Stale poll cancelled')
    }

    let statusResponse
    try {
      statusResponse = await fetch(
        `${API_BASE_URL}/api/builder1-status?jobId=${encodeURIComponent(jobId)}`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' }
        }
      )
    } catch (fetchErr) {
      if (
        fetchErr instanceof TypeError ||
        String(fetchErr?.message ?? '').includes('fetch') ||
        String(fetchErr?.message ?? '').includes('Network')
      ) {
        throw new NetworkError('Network error: Unable to connect to server')
      }
      throw fetchErr
    }

    const statusPayload = await statusResponse.json().catch(() => null)
    const pollStatus = statusPayload?.status

    if (!statusResponse.ok) {
      if (statusResponse.status === 404) {
        throw new Error('job_not_found')
      }
      const msg = statusPayload?.message ?? statusPayload?.error
      throw new Error(typeof msg === 'string' ? msg : `Server error: ${statusResponse.status}`)
    }

    if (pollStatus === 'running') {
      previousProgress = computeStageProgress(statusPayload, previousProgress)
      if (onProgress) {
        onProgress({
          progress: previousProgress,
          stage: statusPayload?.stage,
          completedAds: statusPayload?.completedAds,
          totalAds: statusPayload?.totalAds
        })
      }
      continue
    }

    if (pollStatus === 'error') {
      const failMsg = statusPayload?.message ?? statusPayload?.error
      throw new Error(typeof failMsg === 'string' ? failMsg : 'Campaign generation failed')
    }

    if (pollStatus === 'done') {
      if (onProgress) {
        onProgress({ progress: 100, stage: 'done' })
      }
      return statusPayload?.result ?? null
    }
  }

  throw new Error('Generation timed out. Please try again.')
}

function BuilderPage() {
  const { securityEnabled = true, securityConfigLoaded = false } = useContext(SecurityConfigContext)
  const [state, setState] = useState(STATE.IDLE)
  const [sessionLimit, setSessionLimit] = useState(DEFAULT_BUILDER1_SESSION_LIMIT)
  const [campaignResult, setCampaignResult] = useState(null)
  const [formData, setFormData] = useState({
    productName: '',
    productDescription: '',
    imageSize: ''
  })
  const [isProductNameAuto, setIsProductNameAuto] = useState(false)
  const [fieldsLocked, setFieldsLocked] = useState(false)
  const [error, setError] = useState(null)
  const [isDevMock, setIsDevMock] = useState(false)
  const [progressActive, setProgressActive] = useState(false)
  const [progressKey, setProgressKey] = useState(0)
  const [showProgressBar, setShowProgressBar] = useState(false)
  const [progressPercent, setProgressPercent] = useState(0)
  const [stageLabel, setStageLabel] = useState('')
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [downloadError, setDownloadError] = useState(null)

  const sidRef = useRef(null)
  const bootstrapCompleteRef = useRef(false)
  const fromPaymentCheckDoneRef = useRef(false)
  const requestInFlightRef = useRef(false)
  const fillingResolvedNameRef = useRef(false)
  const pollTokenRef = useRef(0)
  const mountedRef = useRef(true)
  const adCardRefs = useRef({})

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      pollTokenRef.current += 1
    }
  }, [])

  useEffect(() => {
    setSessionLimit(resolveBuilder1SessionLimit())
  }, [])

  useEffect(() => {
    if (BUILDER1_ACCESS_GUARD_DISABLED) {
      let baseHash = window.location.hash
      let sidFromUrl = null
      if (window.location.hash && window.location.hash.includes('?')) {
        const hashParts = window.location.hash.split('?')
        baseHash = hashParts[0]
        const hashParams = new URLSearchParams(hashParts[1])
        sidFromUrl = hashParams.get('sid')
        if (sidFromUrl) {
          sidRef.current = sidFromUrl
          window.history.replaceState(null, '', baseHash)
        }
      }
      if (!sidFromUrl && window.location.search) {
        const searchParams = new URLSearchParams(window.location.search)
        sidFromUrl = searchParams.get('sid')
        if (sidFromUrl) {
          sidRef.current = sidFromUrl
          const clean = window.location.pathname + (window.location.hash || '#/builder')
          window.history.replaceState(null, '', clean)
        }
      }
      bootstrapCompleteRef.current = true
      fromPaymentCheckDoneRef.current = true
      return
    }

    if (!securityConfigLoaded) return
    if (!securityEnabled) {
      bootstrapCompleteRef.current = true
      return
    }
    if (bootstrapCompleteRef.current || fromPaymentCheckDoneRef.current) return

    let baseHash = window.location.hash
    let sidFromUrl = null
    let fromPayment = false

    if (window.location.hash && window.location.hash.includes('?')) {
      const hashParts = window.location.hash.split('?')
      baseHash = hashParts[0]
      const hashParams = new URLSearchParams(hashParts[1])
      sidFromUrl = hashParams.get('sid')
      fromPayment = hashParams.get('fromPayment') === '1'
      if (sidFromUrl) {
        sidRef.current = sidFromUrl
        bootstrapCompleteRef.current = true
        window.history.replaceState(null, '', baseHash)
        return
      }
    }

    if (!sidFromUrl && !fromPayment && window.location.search) {
      const searchParams = new URLSearchParams(window.location.search)
      sidFromUrl = searchParams.get('sid')
      fromPayment = searchParams.get('fromPayment') === '1'
      if (sidFromUrl) {
        sidRef.current = sidFromUrl
        bootstrapCompleteRef.current = true
        const clean = window.location.pathname + (window.location.hash || '#/builder')
        window.history.replaceState(null, '', clean)
        return
      }
    }

    if (sidRef.current) {
      bootstrapCompleteRef.current = true
      return
    }

    if (fromPayment) {
      fromPaymentCheckDoneRef.current = true
      fetchLatestPaid()
        .then((data) => {
          if (data.sid && data.status === 'paid') {
            sidRef.current = data.sid
            bootstrapCompleteRef.current = true
            const cleanUrl = window.location.search
              ? window.location.pathname + baseHash
              : baseHash
            window.history.replaceState(null, '', cleanUrl)
            return
          }
          if (!BUILDER1_ACCESS_GUARD_DISABLED && !isBuilder1DevAccessBypass()) {
            redirectToPreview()
          } else {
            bootstrapCompleteRef.current = true
          }
        })
        .catch(() => {
          if (!BUILDER1_ACCESS_GUARD_DISABLED && !isBuilder1DevAccessBypass()) {
            redirectToPreview()
          } else {
            bootstrapCompleteRef.current = true
          }
        })
    } else if (!BUILDER1_ACCESS_GUARD_DISABLED && !isBuilder1DevAccessBypass()) {
      redirectToPreview()
    } else {
      bootstrapCompleteRef.current = true
    }
  }, [securityEnabled, securityConfigLoaded])

  const campaignPresentation = useMemo(() => {
    if (!campaignResult?.campaign || !campaignResult?.composition) return null
    return buildCampaignPresentation(campaignResult.campaign, campaignResult.composition)
  }, [campaignResult])

  const handleSubmit = async (data) => {
    if (requestInFlightRef.current) return

    if (!BUILDER1_ACCESS_GUARD_DISABLED && !securityConfigLoaded) return
    if (
      !BUILDER1_ACCESS_GUARD_DISABLED &&
      securityEnabled &&
      !sidRef.current &&
      !fromPaymentCheckDoneRef.current &&
      !isBuilder1DevAccessBypass()
    ) {
      redirectToPreview()
      return
    }

    requestInFlightRef.current = true
    const pollToken = ++pollTokenRef.current
    const userLeftProductNameEmpty = !data.productName?.trim()
    const adCount = normalizeBuilder1AdCount(sessionLimit)
    const format = normalizeBuilder1FormatForApi(data.imageSize)

    if (!format) {
      setError('Please select a valid format.')
      setState(STATE.ERROR)
      requestInFlightRef.current = false
      return
    }

    setIsProductNameAuto(false)
    if (!fieldsLocked) setFieldsLocked(true)

    setState(STATE.GENERATING)
    setError(null)
    setDownloadError(null)
    setProgressKey((prev) => prev + 1)
    setProgressActive(true)
    setShowProgressBar(true)
    setProgressPercent(5)
    setStageLabel('')

    try {
      const requestBody = {
        productName: data.productName ?? '',
        productDescription: data.productDescription ?? '',
        format,
        adCount
      }

      let response
      try {
        response = await fetch(`${API_BASE_URL}/api/builder1-generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(requestBody)
        })
      } catch (fetchErr) {
        if (
          fetchErr instanceof TypeError ||
          String(fetchErr?.message ?? '').includes('fetch') ||
          String(fetchErr?.message ?? '').includes('Network')
        ) {
          throw new NetworkError('Network error: Unable to connect to server')
        }
        throw fetchErr
      }

      const createResponse = await response.json().catch(() => null)
      if (!response.ok && response.status !== 202) {
        const msg = createResponse?.message ?? createResponse?.error
        const errStr = typeof msg === 'string' ? msg : (msg?.message ?? `Server error: ${response.status}`)
        if (response.status === 429 || String(errStr).toLowerCase().includes('rate')) {
          throw new ApiError(errStr || 'Too many requests', { code: 'RATE_LIMITED', status: response.status })
        }
        throw new Error(errStr || `Server error: ${response.status}`)
      }

      const jobId = createResponse?.jobId
      if (!jobId || typeof jobId !== 'string' || !jobId.trim()) {
        throw new Error('Error creating campaign: missing jobId')
      }

      const rawResult = await pollBuilder1CampaignJob({
        jobId: jobId.trim(),
        pollToken,
        isStale: () => pollTokenRef.current !== pollToken || !mountedRef.current,
        onProgress: ({ progress, stage, completedAds, totalAds }) => {
          if (pollTokenRef.current !== pollToken || !mountedRef.current) return
          setProgressPercent(progress)
          setStageLabel(
            getStageLabel(
              { stage, completedAds, totalAds, status: 'running' },
              'he'
            )
          )
        }
      })

      if (pollTokenRef.current !== pollToken || !mountedRef.current) return

      const validated = validateCampaignResponse(rawResult, adCount)
      if (!validated.ok) {
        throw new Error(validated.message || validated.error || 'response_contract_invalid')
      }

      if (userLeftProductNameEmpty && validated.campaign.productNameResolved) {
        fillingResolvedNameRef.current = true
        setFormData((prev) => ({
          ...prev,
          productName: validated.campaign.productNameResolved
        }))
        setIsProductNameAuto(true)
      }

      setIsDevMock(false)
      setCampaignResult({
        campaign: validated.campaign,
        ads: validated.ads,
        composition: validated.composition
      })
      adCardRefs.current = {}
      setProgressPercent(100)
      setStageLabel(getStageLabel({ stage: 'done' }, validated.campaign.detectedLanguage))
      setProgressActive(false)
      setState(STATE.SUCCESS)
    } catch (err) {
      if (pollTokenRef.current !== pollToken || !mountedRef.current) return

      if (err instanceof ApiError && err.code === 'RATE_LIMITED') {
        setError('Too many requests. Please wait a moment and try again.')
        setState(STATE.ERROR)
        setProgressActive(false)
        return
      }

      if (
        import.meta.env.DEV &&
        (err instanceof NetworkError || err?.isNetworkError)
      ) {
        const mock = createDevMockCampaign(data, adCount)
        setIsDevMock(true)
        setCampaignResult({
          campaign: mock.campaign,
          ads: mock.ads,
          composition: mock.composition
        })
        adCardRefs.current = {}
        setProgressPercent(100)
        setStageLabel(getStageLabel({ stage: 'done' }, mock.campaign.detectedLanguage))
        setProgressActive(false)
        setState(STATE.SUCCESS)
        return
      }

      setError(mapUserFacingError(err))
      setState(STATE.ERROR)
      setProgressActive(false)
    } finally {
      if (pollTokenRef.current === pollToken) {
        requestInFlightRef.current = false
      }
    }
  }

  const handleProgressComplete = useCallback(() => {}, [])

  const handleRetry = () => {
    handleSubmit(formData)
  }

  const getButtonText = () => {
    if (state === STATE.GENERATING) {
      return campaignResult ? 'GENERATING NEW CAMPAIGN…' : 'GENERATING CAMPAIGN…'
    }
    if (campaignResult) {
      return 'GENERATE NEW CAMPAIGN / יצירת קמפיין חדש'
    }
    return 'GENERATE CAMPAIGN / יצירת קמפיין'
  }

  const isButtonDisabled = () => state === STATE.GENERATING

  useEffect(() => {
    if (fillingResolvedNameRef.current) {
      fillingResolvedNameRef.current = false
      return
    }
    setCampaignResult(null)
    adCardRefs.current = {}
  }, [formData.productName, formData.productDescription])

  const handleDownloadCampaign = async () => {
    if (!campaignResult || downloadLoading || state === STATE.GENERATING) return

    setDownloadLoading(true)
    setDownloadError(null)

    try {
      const ads = campaignResult.ads
      const zipAds = []

      for (const ad of ads) {
        const cardRef = adCardRefs.current[ad.index]
        const node = cardRef?.getCaptureNode?.()
        if (!node) {
          throw new Error(`Could not capture ad ${ad.index}`)
        }
        try {
          const composedImageBase64 = await captureNodeAsPngBase64(node)
          zipAds.push({
            index: ad.index,
            imageBase64: `data:image/png;base64,${composedImageBase64}`,
            headline: ad.headline,
            marketingText: ad.marketingText ?? ''
          })
        } catch (captureErr) {
          throw new Error(`Failed to capture ad ${ad.index}`)
        }
      }

      const payload = {
        productName: campaignResult.campaign.productNameResolved,
        brandSlogan:
          campaignPresentation?.brandSlogan ??
          campaignResult.composition.brandSlogan ??
          campaignResult.campaign.brandSlogan,
        ads: zipAds
      }

      const response = await fetch(`${API_BASE_URL}/api/builder1-download-zip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/zip, application/octet-stream, */*'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errBody = await response.json().catch(async () => {
          const errText = await response.text().catch(() => '')
          return { message: errText || `Server error: ${response.status}` }
        })
        const msg = errBody?.message || errBody?.error || `Server error: ${response.status}`
        throw new Error(typeof msg === 'string' ? msg : 'Download failed')
      }

      const zipBlob = await response.blob()
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = sanitizeCampaignZipFilename(campaignResult.campaign.productNameResolved)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (downloadErr) {
      setDownloadError(mapUserFacingError(downloadErr))
    } finally {
      setDownloadLoading(false)
    }
  }

  const displayLanguage = campaignResult?.campaign?.detectedLanguage === 'en' ? 'en' : 'he'

  return (
    <div className="builder-page">
      <div className="builder-title-block">
        <h1 className="builder-title">יוצר מודעות</h1>
        <span className="builder-warning" dir="rtl">
          (אין לרענן את הדף)
        </span>
      </div>

      <ProductForm
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        fieldsLocked={fieldsLocked}
        buttonText={getButtonText()}
        buttonDisabled={isButtonDisabled()}
        showProgress={showProgressBar}
        progressActive={progressActive}
        progressKey={progressKey}
        progressPercent={progressPercent}
        stageLabel={stageLabel}
        onProgressComplete={handleProgressComplete}
        isProductNameAuto={isProductNameAuto}
        onProductNameEdited={() => setIsProductNameAuto(false)}
      />

      {campaignResult && campaignPresentation && (
        <section className="builder-campaign-results" aria-live="polite">
          {isDevMock && (
            <div className="demo-mode-notice">
              Dev mock campaign — backend unavailable in development.
            </div>
          )}
          <h2 className="builder-campaign-heading">
            {displayLanguage === 'he' ? 'קמפיין פרסומי' : 'Advertising campaign'}
          </h2>
          <p className="builder-campaign-meta">
            {displayLanguage === 'he'
              ? `${campaignResult.ads.length} מודעות · ${campaignPresentation.format}`
              : `${campaignResult.ads.length} ads · ${campaignPresentation.format}`}
          </p>

          <div className="builder-campaign-series">
            {campaignResult.ads.map((ad) => (
              <AdCard
                key={`campaign-ad-${ad.index}`}
                ref={(instance) => {
                  if (instance) {
                    adCardRefs.current[ad.index] = instance
                  } else {
                    delete adCardRefs.current[ad.index]
                  }
                }}
                ad={ad}
                campaign={campaignResult.campaign}
                presentation={campaignPresentation}
                format={campaignPresentation.format}
                language={displayLanguage}
                productNameForAlt={campaignResult.campaign.productNameResolved}
              />
            ))}
          </div>

          <button
            type="button"
            className="builder-campaign-download"
            onClick={handleDownloadCampaign}
            disabled={downloadLoading || state === STATE.GENERATING}
          >
            {downloadLoading
              ? displayLanguage === 'he'
                ? 'מוריד קמפיין…'
                : 'Downloading campaign…'
              : displayLanguage === 'he'
                ? 'הורדת קמפיין / Download campaign'
                : 'Download campaign / הורדת קמפיין'}
          </button>
          {downloadError ? (
            <p className="builder-campaign-download-error" role="alert">
              {downloadError}
            </p>
          ) : null}
        </section>
      )}

      {state === STATE.ERROR && error && (
        <ErrorPanel error={error} onRetry={handleRetry} buttonLabel="Retry" />
      )}
    </div>
  )
}

export default BuilderPage
