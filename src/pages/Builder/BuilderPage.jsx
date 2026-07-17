import { useState, useRef, useEffect, useCallback, useContext } from 'react'
import ProductForm from '../../components/Form/ProductForm'
import AdCard from '../../components/AdCard/AdCard'
import ErrorPanel from '../../components/Error/ErrorPanel'
import { SecurityConfigContext } from '../../App'
import { fetchLatestPaid, API_BASE_URL, NetworkError, ApiError } from '../../services/api'
import {
  readBuilder1CampaignAdCount,
  resolveBuilder1InitialAdCount,
  getBuilder1GenerateButtonLabel,
  normalizeBuilder1FormatForApi,
  validateInitialCampaignResponse,
  validateNextAdResponse,
  createCampaignSessionFromInitial,
  appendAdToSession,
  buildInitialGeneratePayload,
  computeStageProgress,
  getStageLabel,
  sanitizeCampaignZipFilename,
  createDevMockInitialCampaign,
  createDevMockNextAd,
  parseRateLimitError,
  sortAdsByIndex,
  toBuilder1ZipImageBase64
} from '../../utils/builder1Campaign'
import './builder.css'

const BUILDER1_ACCESS_GUARD_DISABLED = true
const PREVIEW_REDIRECT_URL = 'https://ace-advertising.agency/#/preview'
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 15 * 60 * 1000

const STATE = {
  IDLE: 'IDLE',
  GENERATING: 'GENERATING',
  GENERATING_NEXT: 'GENERATING_NEXT',
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

function mapUserFacingError(err, code) {
  const raw = String(err?.message ?? err ?? 'Generation failed')
  const lower = raw.toLowerCase()
  const errCode = String(code ?? err?.code ?? '').toLowerCase()

  if (err instanceof NetworkError || err?.isNetworkError || errCode === 'network_error') {
    return 'Network error: Unable to connect to server. Please check your connection and try again.'
  }
  if (lower.includes('timed out') || lower.includes('timeout') || errCode === 'generation_timeout') {
    return 'Generation timed out. Please try again.'
  }
  if (lower.includes('response_contract') || errCode === 'response_contract_invalid') {
    return 'The server returned an invalid campaign response. Please try again.'
  }
  if (errCode === 'invalid_ad_count' || lower.includes('invalid_ad_count')) {
    return 'Invalid campaign size. Please refresh and try again.'
  }
  if (errCode === 'planning_failed' || lower.includes('planning_failed')) {
    return 'Campaign planning failed. Please try again.'
  }
  if (errCode === 'image_generation_failed' || lower.includes('image_generation')) {
    return 'Image generation failed. Please try again.'
  }
  if (errCode === 'campaign_not_found' || errCode === 'campaign_expired') {
    return 'Campaign session expired. Please start a new campaign.'
  }
  if (errCode === 'campaign_complete') {
    return 'This campaign is already complete.'
  }
  if (errCode === 'campaign_index_conflict' || errCode === 'campaign_generation_in_progress') {
    return 'Campaign generation is already in progress. Please wait.'
  }
  if (errCode === 'image_rate_limited' || errCode === 'rate_limited') {
    return 'Image generation is temporarily busy. Please try again shortly.'
  }
  if (lower.includes('not_found') || lower.includes('job_not_found')) {
    return 'Campaign job not found. Please start a new campaign.'
  }
  return raw
}

async function pollBuilder1Job({
  jobId,
  pollToken,
  isStale,
  onProgress,
  mode = 'initial',
  progressCtx = {}
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
      previousProgress = computeStageProgress(statusPayload, previousProgress, mode, progressCtx)
      if (onProgress) {
        onProgress({
          progress: previousProgress,
          stage: statusPayload?.stage
        })
      }
      continue
    }

    if (pollStatus === 'error') {
      const failCode = statusPayload?.error ?? statusPayload?.code
      const failMsg = statusPayload?.message ?? failCode
      const err = new Error(typeof failMsg === 'string' ? failMsg : 'Campaign generation failed')
      if (failCode) err.code = String(failCode)
      err.body = statusPayload
      err.status = statusResponse.status
      throw err
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
  const [targetAdCount, setTargetAdCount] = useState(() => readBuilder1CampaignAdCount())
  const [campaignSession, setCampaignSession] = useState(null)
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
  const [rateLimitState, setRateLimitState] = useState(null)
  const [retryCountdown, setRetryCountdown] = useState(0)

  const sidRef = useRef(null)
  const bootstrapCompleteRef = useRef(false)
  const fromPaymentCheckDoneRef = useRef(false)
  const generateRequestInFlightRef = useRef(false)
  const fillingResolvedNameRef = useRef(false)
  const initialPollTokenRef = useRef(0)
  const nextPollTokenRef = useRef(0)
  const mountedRef = useRef(true)
  const lockedTargetAdCountRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      initialPollTokenRef.current += 1
      nextPollTokenRef.current += 1
    }
  }, [])

  useEffect(() => {
    const stored = readBuilder1CampaignAdCount()
    setTargetAdCount(stored)
    if (lockedTargetAdCountRef.current == null) {
      lockedTargetAdCountRef.current = stored
    }
  }, [])

  useEffect(() => {
    if (!rateLimitState?.retryAvailableAt) {
      setRetryCountdown(0)
      return undefined
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((rateLimitState.retryAvailableAt - Date.now()) / 1000))
      setRetryCountdown(remaining)
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [rateLimitState])

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

  const displayLanguage = campaignSession?.campaign?.detectedLanguage === 'en' ? 'en' : 'he'
  const isGenerating = state === STATE.GENERATING || state === STATE.GENERATING_NEXT
  const campaignComplete =
    campaignSession != null &&
    campaignSession.generatedCount >= campaignSession.targetAdCount
  const canDownloadCampaign =
    campaignComplete && campaignSession.ads.length === campaignSession.targetAdCount
  const canGenerateAgain =
    campaignSession != null && campaignSession.canGenerateNext && !campaignComplete
  const showGenerateButton = !campaignComplete
  const generateButtonLabel = getBuilder1GenerateButtonLabel({
    hasGeneratedAds: Boolean(campaignSession?.generatedCount),
    canGenerateNext: Boolean(canGenerateAgain)
  })
  const generateButtonDisabled =
    isGenerating ||
    generateRequestInFlightRef.current ||
    (Boolean(rateLimitState) && retryCountdown > 0)

  const beginProgress = () => {
    setError(null)
    setDownloadError(null)
    setProgressKey((prev) => prev + 1)
    setProgressActive(true)
    setShowProgressBar(true)
    setProgressPercent(5)
    setStageLabel('')
  }

  const handleInitialSubmit = async (data) => {
    if (generateRequestInFlightRef.current) return

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

    generateRequestInFlightRef.current = true
    const pollToken = ++initialPollTokenRef.current
    const userLeftProductNameEmpty = !data.productName?.trim()
    const adCount = resolveBuilder1InitialAdCount({
      targetAdCount: lockedTargetAdCountRef.current ?? targetAdCount
    })
    lockedTargetAdCountRef.current = adCount
    setTargetAdCount(adCount)

    let requestBody
    try {
      requestBody = buildInitialGeneratePayload({
        productName: data.productName ?? '',
        productDescription: data.productDescription ?? '',
        format: data.imageSize,
        adCount
      })
    } catch (_) {
      setError('Please select a valid format.')
      setState(STATE.ERROR)
      generateRequestInFlightRef.current = false
      return
    }

    setIsProductNameAuto(false)
    if (!fieldsLocked) setFieldsLocked(true)

    setState(STATE.GENERATING)
    beginProgress()
    setRateLimitState(null)

    try {
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
        const rateInfo = parseRateLimitError({ status: response.status, body: createResponse, message: errStr })
        if (rateInfo.rateLimited) {
          throw Object.assign(new ApiError(errStr || 'Too many requests', { code: 'image_rate_limited', status: 429 }), {
            rateInfo
          })
        }
        throw new Error(errStr || `Server error: ${response.status}`)
      }

      const jobId = createResponse?.jobId
      if (!jobId || typeof jobId !== 'string' || !jobId.trim()) {
        throw new Error('Error creating campaign: missing jobId')
      }

      const rawResult = await pollBuilder1Job({
        jobId: jobId.trim(),
        pollToken,
        isStale: () => initialPollTokenRef.current !== pollToken || !mountedRef.current,
        mode: 'initial',
        progressCtx: { adIndex: 1, targetAdCount: adCount, language: displayLanguage },
        onProgress: ({ progress, stage }) => {
          if (initialPollTokenRef.current !== pollToken || !mountedRef.current) return
          setProgressPercent(progress)
          setStageLabel(
            getStageLabel({ stage, status: 'running' }, displayLanguage, 'initial', {
              adIndex: 1,
              targetAdCount: adCount
            })
          )
        }
      })

      if (initialPollTokenRef.current !== pollToken || !mountedRef.current) return

      const validated = validateInitialCampaignResponse(rawResult, adCount)
      if (!validated.ok) {
        throw new Error(validated.message || validated.error || 'response_contract_invalid')
      }

      const sessionResult = createCampaignSessionFromInitial(validated, adCount)
      if (!sessionResult.ok) {
        throw new Error(sessionResult.message || sessionResult.error || 'response_contract_invalid')
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
      setCampaignSession(sessionResult.session)
      setProgressPercent(100)
      setStageLabel(
        getStageLabel({ stage: 'done' }, validated.campaign.detectedLanguage, 'initial', {
          adIndex: 1,
          targetAdCount: adCount
        })
      )
      setProgressActive(false)
      setState(STATE.SUCCESS)
    } catch (err) {
      if (initialPollTokenRef.current !== pollToken || !mountedRef.current) return

      const rateInfo = err?.rateInfo ?? parseRateLimitError(err)
      if (rateInfo.rateLimited) {
        setError(mapUserFacingError(err, 'image_rate_limited'))
        setState(STATE.ERROR)
        setProgressActive(false)
        return
      }

      if (import.meta.env.DEV && (err instanceof NetworkError || err?.isNetworkError)) {
        const mock = createDevMockInitialCampaign(data, adCount)
        if (!mock.ok) {
          setError(mapUserFacingError(mock.message))
          setState(STATE.ERROR)
          setProgressActive(false)
          return
        }
        const sessionResult = createCampaignSessionFromInitial(mock, adCount)
        setIsDevMock(true)
        setCampaignSession(sessionResult.session)
        setProgressPercent(100)
        setProgressActive(false)
        setState(STATE.SUCCESS)
        return
      }

      setCampaignSession(null)
      setError(mapUserFacingError(err))
      setState(STATE.ERROR)
      setProgressActive(false)
    } finally {
      if (initialPollTokenRef.current === pollToken) {
        generateRequestInFlightRef.current = false
      }
    }
  }

  const handleGenerateNextAd = async () => {
    if (!campaignSession || generateRequestInFlightRef.current || isGenerating) return
    if (!campaignSession.canGenerateNext || campaignComplete) return

    const expectedIndex = campaignSession.nextAdIndex
    const pollToken = ++nextPollTokenRef.current
    generateRequestInFlightRef.current = true
    setState(STATE.GENERATING_NEXT)
    setError(null)
    setProgressKey((prev) => prev + 1)
    setProgressActive(true)
    setShowProgressBar(true)
    setProgressPercent(5)
    setStageLabel('')

    const progressCtx = {
      adIndex: expectedIndex,
      targetAdCount: campaignSession.targetAdCount,
      language: displayLanguage
    }

    try {
      let response
      try {
        response = await fetch(`${API_BASE_URL}/api/builder1-generate-next`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            campaignId: campaignSession.campaignId,
            expectedNextIndex: expectedIndex
          })
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
        const rateInfo = parseRateLimitError({ status: response.status, body: createResponse, message: errStr })
        if (rateInfo.rateLimited || response.status === 429) {
          const retryAfterSeconds = rateInfo.retryAfterSeconds ?? 30
          setRateLimitState({
            message:
              displayLanguage === 'he'
                ? 'יצירת התמונה עמוסה כרגע. נסו שוב בעוד רגע.'
                : 'Image generation is temporarily busy. Please try again shortly.',
            expectedNextIndex: expectedIndex,
            retryAfterSeconds,
            retryAvailableAt: Date.now() + retryAfterSeconds * 1000
          })
          setState(STATE.SUCCESS)
          setProgressActive(false)
          return
        }
        const errCode = createResponse?.error ?? createResponse?.code
        throw Object.assign(new Error(errStr), { code: errCode })
      }

      const jobId = createResponse?.jobId
      if (!jobId || typeof jobId !== 'string' || !jobId.trim()) {
        throw new Error('Error creating next ad: missing jobId')
      }

      const rawResult = await pollBuilder1Job({
        jobId: jobId.trim(),
        pollToken,
        isStale: () => nextPollTokenRef.current !== pollToken || !mountedRef.current,
        mode: 'next',
        progressCtx,
        onProgress: ({ progress, stage }) => {
          if (nextPollTokenRef.current !== pollToken || !mountedRef.current) return
          setProgressPercent(progress)
          setStageLabel(getStageLabel({ stage, status: 'running' }, displayLanguage, 'next', progressCtx))
        }
      })

      if (nextPollTokenRef.current !== pollToken || !mountedRef.current) return

      const validated = validateNextAdResponse(rawResult, {
        campaignId: campaignSession.campaignId,
        expectedIndex
      })
      if (!validated.ok) {
        throw new Error(validated.message || validated.error || 'response_contract_invalid')
      }

      const appendResult = appendAdToSession(campaignSession, validated)
      if (!appendResult.ok) {
        throw new Error(appendResult.message || appendResult.error || 'response_contract_invalid')
      }

      setIsDevMock(false)
      setCampaignSession(appendResult.session)
      setRateLimitState(null)
      setProgressPercent(100)
      setStageLabel(
        getStageLabel({ stage: 'done' }, displayLanguage, 'next', {
          adIndex: expectedIndex,
          targetAdCount: campaignSession.targetAdCount
        })
      )
      setProgressActive(false)
      setState(STATE.SUCCESS)
    } catch (err) {
      if (nextPollTokenRef.current !== pollToken || !mountedRef.current) return

      const rateInfo = parseRateLimitError(err)
      if (rateInfo.rateLimited || err?.status === 429) {
        const retryAfterSeconds = rateInfo.retryAfterSeconds ?? 30
        setRateLimitState({
          message:
            displayLanguage === 'he'
              ? 'יצירת התמונה עמוסה כרגע. נסו שוב בעוד רגע.'
              : 'Image generation is temporarily busy. Please try again shortly.',
          expectedNextIndex: expectedIndex,
          retryAfterSeconds,
          retryAvailableAt: Date.now() + retryAfterSeconds * 1000
        })
        setState(STATE.SUCCESS)
        setProgressActive(false)
        return
      }

      if (import.meta.env.DEV && (err instanceof NetworkError || err?.isNetworkError)) {
        const mock = createDevMockNextAd(campaignSession, expectedIndex)
        const appendResult = appendAdToSession(campaignSession, mock)
        if (appendResult.ok) {
          setIsDevMock(true)
          setCampaignSession(appendResult.session)
          setProgressActive(false)
          setState(STATE.SUCCESS)
          return
        }
      }

      setError(mapUserFacingError(err, err?.code))
      setState(STATE.SUCCESS)
      setProgressActive(false)
    } finally {
      if (nextPollTokenRef.current === pollToken) {
        generateRequestInFlightRef.current = false
      }
    }
  }

  const handleFormSubmit = (data) => {
    if (campaignSession?.campaignId && canGenerateAgain) {
      handleGenerateNextAd()
      return
    }
    handleInitialSubmit(data)
  }

  const handleProgressComplete = useCallback(() => {}, [])

  const handleRetryInitial = () => {
    handleInitialSubmit(formData)
  }

  useEffect(() => {
    if (fillingResolvedNameRef.current) {
      fillingResolvedNameRef.current = false
      return
    }
    setCampaignSession(null)
    setRateLimitState(null)
    lockedTargetAdCountRef.current = readBuilder1CampaignAdCount()
    setTargetAdCount(lockedTargetAdCountRef.current)
  }, [formData.productName, formData.productDescription])

  const handleDownloadCampaign = async () => {
    if (!campaignSession || !canDownloadCampaign || downloadLoading || isGenerating) return

    setDownloadLoading(true)
    setDownloadError(null)

    try {
      const ads = sortAdsByIndex(campaignSession.ads)
      const zipAds = ads.map((ad) => ({
        index: ad.index,
        imageBase64: toBuilder1ZipImageBase64(ad.imageSrc),
        headline: ad.headline,
        marketingText: ad.marketingText ?? ''
      }))

      const payload = {
        productName: campaignSession.campaign.productNameResolved,
        brandSlogan:
          campaignSession.composition?.brandSlogan ??
          campaignSession.campaign.brandSlogan ??
          '',
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
      a.download = sanitizeCampaignZipFilename(campaignSession.campaign.productNameResolved)
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

  const sortedAds = campaignSession ? sortAdsByIndex(campaignSession.ads) : []
  const campaignFormat =
    normalizeBuilder1FormatForApi(campaignSession?.campaign?.format) || 'portrait'

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
        onSubmit={handleFormSubmit}
        fieldsLocked={fieldsLocked}
        buttonText={generateButtonLabel}
        buttonDisabled={generateButtonDisabled}
        showSubmitButton={showGenerateButton}
        showProgress={showProgressBar}
        progressActive={progressActive}
        progressKey={progressKey}
        progressPercent={progressPercent}
        stageLabel={stageLabel}
        onProgressComplete={handleProgressComplete}
        isProductNameAuto={isProductNameAuto}
        onProductNameEdited={() => setIsProductNameAuto(false)}
      />

      {rateLimitState && (
        <div className="builder-rate-limit-panel" role="alert">
          <p>{rateLimitState.message}</p>
          {retryCountdown > 0 ? (
            <p className="builder-rate-limit-countdown">
              {displayLanguage === 'he'
                ? `אפשר לנסות שוב בעוד ${retryCountdown} שניות`
                : `You can try again in ${retryCountdown}s`}
            </p>
          ) : null}
        </div>
      )}

      {campaignSession && (
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
              ? `${campaignSession.generatedCount} מתוך ${campaignSession.targetAdCount} מודעות · ${campaignFormat}`
              : `${campaignSession.generatedCount} of ${campaignSession.targetAdCount} ads · ${campaignFormat}`}
          </p>

          {campaignComplete && (
            <p className="builder-campaign-complete">
              {displayLanguage === 'he' ? 'הקמפיין הושלם' : 'Campaign complete'}
            </p>
          )}

          <div className="builder-campaign-series">
            {sortedAds.map((ad) => (
              <AdCard
                key={`campaign-ad-${campaignSession.campaignId}-${ad.index}`}
                ad={ad}
                format={campaignFormat}
                productName={campaignSession.campaign.productNameResolved}
                targetAdCount={campaignSession.targetAdCount}
                language={displayLanguage}
              />
            ))}
          </div>

          <button
            type="button"
            className="builder-campaign-download"
            onClick={handleDownloadCampaign}
            disabled={!canDownloadCampaign || downloadLoading || isGenerating}
            title={
              !canDownloadCampaign
                ? displayLanguage === 'he'
                  ? 'הורדה זמינה לאחר השלמת כל המודעות'
                  : 'Download available after all ads are generated'
                : undefined
            }
          >
            {downloadLoading
              ? displayLanguage === 'he'
                ? 'מוריד קמפיין…'
                : 'Downloading campaign…'
              : canDownloadCampaign
                ? displayLanguage === 'he'
                  ? 'הורדת קמפיין / Download campaign'
                  : 'Download campaign / הורדת קמפיין'
                : displayLanguage === 'he'
                  ? 'הורדת קמפיין (לאחר השלמה)'
                  : 'Download campaign (when complete)'}
          </button>
          {downloadError ? (
            <p className="builder-campaign-download-error" role="alert">
              {downloadError}
            </p>
          ) : null}
        </section>
      )}

      {state === STATE.ERROR && error && !campaignSession && (
        <ErrorPanel error={error} onRetry={handleRetryInitial} buttonLabel="Retry" />
      )}
      {state === STATE.ERROR && error && campaignSession && (
        <p className="builder-campaign-download-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default BuilderPage
