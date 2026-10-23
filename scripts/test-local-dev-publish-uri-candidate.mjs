/**
 * Registered publish-candidate discovery, Candidate Preview, and Dry-run UI.
 * Run: node scripts/test-local-dev-publish-uri-candidate.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PUBLISH_CANDIDATE_DISCOVERY_FAILED_MESSAGE,
  PUBLISH_CANDIDATE_ELIGIBLE_MESSAGE,
  PUBLISH_CANDIDATE_FINGERPRINT_STALE_MESSAGE,
  PUBLISH_CANDIDATE_NONE_MESSAGE,
  PUBLISH_CANDIDATE_NO_CYCLE_MESSAGE,
  PUBLISH_CANDIDATE_STALE_MESSAGE,
  PUBLISH_URI_CANDIDATE_DRY_RUN_PATH,
  PUBLISH_URI_CANDIDATE_PREVIEW_PATH,
  PUBLISH_URI_CANDIDATE_REGISTERED_PATH,
  buildPublishUriCandidatePreviewUrl,
  canDryRunPublishCandidate,
  fetchPublishUriCandidatePreview,
  fetchRegisteredPublishCandidate,
  fetchRegisteredPublishCandidatePreview,
  isCandidateEligibleForPublish,
  postPublishUriCandidateDryRun,
  sanitizeCandidateBackendSha,
  sanitizePublishUriCandidatePreviewPayload
} from '../src/utils/localDevPublishUriCandidate.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const CANDIDATE_SHA = 'cccccccccccccccccccccccccccccccccccccccc'
const FINGERPRINT = 'd'.repeat(64)

assert.equal(PUBLISH_URI_CANDIDATE_REGISTERED_PATH, '/api/local-dev/publish-uri/candidate/registered')
assert.equal(PUBLISH_URI_CANDIDATE_PREVIEW_PATH, '/api/local-dev/publish-uri/candidate/preview')
assert.equal(PUBLISH_URI_CANDIDATE_DRY_RUN_PATH, '/api/local-dev/publish-uri/candidate/dry-run')
assert.equal(sanitizeCandidateBackendSha('not-a-sha'), '')
assert.equal(sanitizeCandidateBackendSha(CANDIDATE_SHA.toUpperCase()), CANDIDATE_SHA)
assert.equal(
  buildPublishUriCandidatePreviewUrl('http://127.0.0.1:5000', CANDIDATE_SHA).url,
  `http://127.0.0.1:5000/api/local-dev/publish-uri/candidate/preview?candidateBackendSha=${CANDIDATE_SHA}`
)
assert.equal(buildPublishUriCandidatePreviewUrl('http://127.0.0.1:5000', 'HEAD').ok, false)
assert.equal(buildPublishUriCandidatePreviewUrl('https://ace-backend-k1p6.onrender.com', CANDIDATE_SHA).ok, false)

const none = await fetchRegisteredPublishCandidate({
  backendBase: 'http://127.0.0.1:5000',
  fetchImpl: async (url, options) => {
    assert.equal(options.method, 'GET')
    assert.match(url, /\/api\/local-dev\/publish-uri\/candidate\/registered$/)
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        hasRegisteredCandidate: false,
        status: 'NONE',
        message: 'No publish candidate registered for local discovery.'
      })
    }
  }
})
assert.equal(none.hasRegisteredCandidate, false)
assert.equal(none.message, PUBLISH_CANDIDATE_NONE_MESSAGE)

const stale = await fetchRegisteredPublishCandidatePreview({
  backendBase: 'http://127.0.0.1:5000',
  fetchImpl: async (url) => {
    assert.doesNotMatch(url, /\/publish-uri\/preview(\?|$)/)
    assert.doesNotMatch(url, /\/candidate\/preview/)
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        hasRegisteredCandidate: false,
        status: 'STALE',
        candidateBackendSha: CANDIDATE_SHA
      })
    }
  }
})
assert.equal(stale.ok, false)
assert.equal(stale.discoveryStatus, 'STALE')
assert.equal(stale.message, PUBLISH_CANDIDATE_STALE_MESSAGE)
assert.equal(stale.candidateBackendSha, '')

const badJson = await fetchRegisteredPublishCandidatePreview({
  backendBase: 'http://127.0.0.1:5000',
  fetchImpl: async () => ({
    ok: false,
    status: 404,
    json: async () => {
      throw new Error('not json')
    }
  })
})
assert.equal(badJson.ok, false)
assert.equal(badJson.discoveryStatus, 'NONE')
assert.equal(badJson.message, PUBLISH_CANDIDATE_DISCOVERY_FAILED_MESSAGE)

const noCycle = await fetchRegisteredPublishCandidate({
  backendBase: 'http://127.0.0.1:5000',
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, hasRegisteredCandidate: false, status: 'NO_ACTIVE_CYCLE' })
  })
})
assert.equal(noCycle.message, PUBLISH_CANDIDATE_NO_CYCLE_MESSAGE)

const previewPayload = {
  ok: true,
  previewKind: 'CANDIDATE_BACKEND',
  publishUriPreviewFingerprint: FINGERPRINT,
  candidateBackendSha: CANDIDATE_SHA,
  executePublishEndpointAvailable: true,
  candidateDryRunAvailable: true,
  production: {
    backendWeb: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    frontend: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  },
  proposedChanges: {
    backend: {
      proposedHeadSha: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      commits: [{ shortSha: 'ccccccc', subject: 'candidate change', classification: 'productCandidate' }],
      files: ['engine/ace_publish.py']
    },
    frontend: { commits: [], files: [] }
  },
  blockers: [],
  candidateBlockers: [],
  warnings: ['worker note'],
  readiness: {
    hasProductChanges: true,
    candidateVerifiedSafeForPublish: true,
    verifiedSafeForLiveProduction: true,
    notes: []
  }
}

const loaded = await fetchRegisteredPublishCandidatePreview({
  backendBase: 'http://127.0.0.1:5000',
  fetchImpl: async (url, options) => {
    assert.equal(options.method, 'GET')
    if (url.endsWith('/api/local-dev/publish-uri/candidate/registered')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          hasRegisteredCandidate: true,
          status: 'ACTIVE',
          candidateBackendSha: CANDIDATE_SHA
        })
      }
    }
    assert.match(url, new RegExp(`/candidate/preview\\?candidateBackendSha=${CANDIDATE_SHA}$`))
    assert.doesNotMatch(url, /\/publish-uri\/preview(\?|$)/)
    return { ok: true, status: 200, json: async () => previewPayload }
  }
})
assert.equal(loaded.ok, true)
assert.equal(loaded.previewKind, 'CANDIDATE_BACKEND')
assert.equal(loaded.candidateBackendSha, CANDIDATE_SHA)
assert.equal(loaded.executePublishEndpointAvailable, false)
assert.equal(isCandidateEligibleForPublish(loaded), true)
assert.equal(canDryRunPublishCandidate(loaded), true)
assert.equal(loaded.proposedChanges.backend.proposedHeadSha, 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
assert.notEqual(loaded.candidateBackendSha, loaded.proposedChanges.backend.proposedHeadSha)

const rejectedSha = await fetchPublishUriCandidatePreview({
  backendBase: 'http://127.0.0.1:5000',
  candidateBackendSha: 'WIP_HEAD',
  fetchImpl: async () => {
    throw new Error('must not fetch without a registered SHA')
  }
})
assert.equal(rejectedSha.ok, false)

const dryRun = await postPublishUriCandidateDryRun({
  backendBase: 'http://127.0.0.1:5000',
  candidateBackendSha: CANDIDATE_SHA,
  publishUriPreviewFingerprint: FINGERPRINT,
  fetchImpl: async (url, options) => {
    assert.equal(options.method, 'POST')
    assert.equal(url, 'http://127.0.0.1:5000/api/local-dev/publish-uri/candidate/dry-run')
    const body = JSON.parse(options.body)
    assert.deepEqual(Object.keys(body).sort(), ['candidateBackendSha', 'publishUriPreviewFingerprint'])
    assert.equal(body.candidateBackendSha, CANDIDATE_SHA)
    assert.equal(body.publishUriPreviewFingerprint, FINGERPRINT)
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        dryRun: true,
        fingerprintMatched: true,
        candidateBackendSha: CANDIDATE_SHA,
        preview: previewPayload,
        note: 'Dry-run only; no push, deploy, registry, or git mutations.'
      })
    }
  }
})
assert.equal(dryRun.ok, true)
assert.match(dryRun.message, /הצליחה/)
assert.match(dryRun.note, /Dry-run/)

const staleFp = await postPublishUriCandidateDryRun({
  backendBase: 'http://127.0.0.1:5000',
  candidateBackendSha: CANDIDATE_SHA,
  publishUriPreviewFingerprint: FINGERPRINT,
  fetchImpl: async () => ({
    ok: false,
    status: 409,
    json: async () => ({
      ok: false,
      dryRun: true,
      error: 'ace_publish_uri_candidate_fingerprint_stale',
      message: 'stale'
    })
  })
})
assert.equal(staleFp.ok, false)
assert.equal(staleFp.message, PUBLISH_CANDIDATE_FINGERPRINT_STALE_MESSAGE)

const sanitized = sanitizePublishUriCandidatePreviewPayload(previewPayload)
assert.equal(sanitized.executePublishEndpointAvailable, false)
assert.equal(PUBLISH_CANDIDATE_ELIGIBLE_MESSAGE.includes('כשיר'), true)

const panel = readFileSync(join(root, 'src/components/DevLocalControl/DevLocalControl.jsx'), 'utf8')
assert.match(panel, /fetchRegisteredPublishCandidatePreview/)
assert.match(panel, /postPublishUriCandidateDryRun/)
assert.match(panel, /handlePublishPreview/)
assert.match(panel, /handlePublishDryRun/)
assert.doesNotMatch(panel, /fetchPublishUriPreview/)
assert.doesNotMatch(panel, /publish-uri\/execute/)
assert.doesNotMatch(panel, /method:\s*['"]POST['"]/)
assert.doesNotMatch(panel, /258337ca/)
assert.doesNotMatch(panel, /proposedHeadSha/)

const dialog = readFileSync(
  join(root, 'src/components/DevLocalControl/PublishUriPreviewDialog.jsx'),
  'utf8'
)
assert.match(dialog, /תוכנית פרסום/)
assert.match(dialog, /בדיקת פרסום/)
assert.match(dialog, /SHA מועמד הפרסום/)
assert.match(dialog, /תוצאות בדיקת פרסום/)
assert.match(dialog, /Candidate Preview/)
assert.match(dialog, /PUBLISH_CANDIDATE_ELIGIBLE_MESSAGE/)
assert.doesNotMatch(dialog, />\s*אשר פרסום\s*</)
assert.doesNotMatch(dialog, /publish-uri\/execute/)
assert.doesNotMatch(dialog, /confirmPublish/)

const util = readFileSync(join(root, 'src/utils/localDevPublishUriCandidate.js'), 'utf8')
assert.match(util, /candidate\/registered/)
assert.match(util, /candidate\/preview/)
assert.match(util, /candidate\/dry-run/)
assert.match(util, /method: 'POST'/)
assert.doesNotMatch(util, /publish-uri\/execute/)
assert.doesNotMatch(util, /\/publish-uri\/preview/)
assert.doesNotMatch(util, /258337ca/)
assert.doesNotMatch(util, /WIP_DEFAULT/)

const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
assert.doesNotMatch(app, /<DevLocalControl/)
assert.match(app, /LocalUndoPage/)

console.log('test-local-dev-publish-uri-candidate: passed')
