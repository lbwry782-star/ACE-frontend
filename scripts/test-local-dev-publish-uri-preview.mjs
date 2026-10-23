/**
 * Local publish-uri preview UI (GET only; no real publish).
 * Run: node scripts/test-local-dev-publish-uri-preview.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PUBLISH_BLOCKED_LIVE_MESSAGE,
  PUBLISH_CANDIDATE_NOTE,
  PUBLISH_URI_PREVIEW_PATH,
  buildPublishUriPreviewUrl,
  canExecutePublishUri,
  explainPublishBlocker,
  fetchPublishUriPreview,
  isPublishBlockedForLive,
  sanitizePublishUriPreviewPayload
} from '../src/utils/localDevPublishUriPreview.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

assert.equal(PUBLISH_URI_PREVIEW_PATH, '/api/local-dev/publish-uri/preview')
assert.equal(
  buildPublishUriPreviewUrl('http://127.0.0.1:5000').url,
  'http://127.0.0.1:5000/api/local-dev/publish-uri/preview'
)
assert.equal(buildPublishUriPreviewUrl('https://ace-backend-k1p6.onrender.com').ok, false)
assert.equal(canExecutePublishUri(), false)

const security = explainPublishBlocker('BACKEND_PUBLISH_SECURITY:e41f418:ACE_SECURITY_WEAKENED')
assert.match(security.explanation, /אבטחה/)
assert.match(security.technical, /e41f418/)
assert.equal(security.security, true)

const mixed = explainPublishBlocker('BACKEND_PUBLISH_MIXED_COMMIT:mix0001')
assert.match(mixed.explanation, /ערב/)

const blockedPayload = {
  ok: true,
  previewMode: 'READ_ONLY',
  executePublishEndpointAvailable: true,
  sessionId: 'ori-20261023-010342-2d952e88',
  production: {
    backendWeb: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    backendWorker: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    frontend: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    backendBranch: 'main',
    frontendBranch: 'main'
  },
  proposedChanges: {
    backend: {
      commits: [{ shortSha: 'e41f418', subject: 'security', classification: 'productCandidate' }],
      files: ['engine/ace_security_config.py']
    },
    frontend: { commits: [], files: [] }
  },
  workerImpact: { deployWithBackendWeb: true, proposedCommitSha: 'e41f418', note: 'preview' },
  commits: {
    productCandidate: { backend: [], frontend: [] },
    excludedLocal: { backend: [{ shortSha: 'c26ff18', subject: 'local undo', classification: 'excludedLocalInfraBranch' }], frontend: [] },
    mixedOrBlocked: [{ shortSha: 'mix0001', subject: 'mixed', classification: 'mixedProductAndLocal' }]
  },
  blockers: ['BACKEND_PUBLISH_SECURITY:e41f418:ACE_SECURITY_WEAKENED'],
  readiness: {
    hasProductChanges: true,
    canPrepareLocalPublish: true,
    verifiedSafeForLiveProduction: false,
    notes: ['verifiedSafeForLiveProduction requires zero blockers']
  },
  activeCycle: { status: 'OPEN' }
}

const sanitized = sanitizePublishUriPreviewPayload(blockedPayload)
assert.equal(sanitized.executePublishEndpointAvailable, false)
assert.equal(sanitized.readiness.verifiedSafeForLiveProduction, false)
assert.equal(isPublishBlockedForLive(sanitized), true)
assert.equal(sanitized.proposedChanges.backend.commits[0].shortSha, 'e41f418')
assert.equal(PUBLISH_BLOCKED_LIVE_MESSAGE, 'לא ניתן לפרסם את הגרסה הנוכחית.')
assert.match(PUBLISH_CANDIDATE_NOTE, /מועמד/)

const fetched = await fetchPublishUriPreview({
  backendBase: 'http://127.0.0.1:5000',
  fetchImpl: async (url, options) => {
    assert.equal(options.method, 'GET')
    assert.match(url, /\/api\/local-dev\/publish-uri\/preview$/)
    return { ok: true, status: 200, json: async () => blockedPayload }
  }
})
assert.equal(fetched.ok, true)
assert.equal(fetched.executePublishEndpointAvailable, false)
assert.ok(fetched.blockers.some((item) => item.includes('e41f418')))

const renderBlocked = await fetchPublishUriPreview({
  backendBase: 'https://ace-backend-k1p6.onrender.com'
})
assert.equal(renderBlocked.ok, false)

const panel = readFileSync(join(root, 'src/components/DevLocalControl/DevLocalControl.jsx'), 'utf8')
assert.match(panel, /'NEW'/)
assert.match(panel, /'CANCEL'/)
assert.match(panel, /PUBLISH/)
assert.match(panel, /fetchRegisteredPublishCandidatePreview/)
assert.match(panel, /handlePublishPreview/)
assert.match(panel, /canPreviewPublish/)
assert.doesNotMatch(panel, /publish-uri\/execute/)
assert.doesNotMatch(panel, /method:\s*['"]POST['"]/)
assert.match(panel, /startDevCycle/)
assert.match(panel, /executeCancelDevelopment/)

const dialog = readFileSync(
  join(root, 'src/components/DevLocalControl/PublishUriPreviewDialog.jsx'),
  'utf8'
)
assert.match(dialog, /סגור/)
assert.match(dialog, /בדיקת פרסום/)
assert.match(dialog, /canOfferPublishCandidateDryRun/)
assert.doesNotMatch(dialog, /תוכנית פרסום/)
assert.doesNotMatch(dialog, /מחזור הפיתוח הנוכחי/)
assert.doesNotMatch(dialog, /גרסת הייצור הנוכחית/)
assert.doesNotMatch(dialog, /שינויי Backend המועמדים לפרסום/)
assert.doesNotMatch(dialog, /שינויי Frontend המועמדים לפרסום/)
assert.doesNotMatch(dialog, /השפעה על Worker/)
assert.doesNotMatch(dialog, /שינויים מקומיים שהוחרגו/)
assert.doesNotMatch(dialog, /Commits חסומים/)
assert.doesNotMatch(dialog, /חסימות אבטחה/)
assert.doesNotMatch(dialog, /מצב המוכנות לפרסום/)
assert.doesNotMatch(dialog, />\s*אשר פרסום\s*</)
assert.doesNotMatch(dialog, />\s*Execute\s*</)
assert.doesNotMatch(dialog, /publish-uri\/execute/)
assert.doesNotMatch(dialog, /confirmPublish/)

const util = readFileSync(join(root, 'src/utils/localDevPublishUriPreview.js'), 'utf8')
assert.match(util, /method: 'GET'/)
assert.doesNotMatch(util, /method: 'POST'/)
assert.doesNotMatch(util, /publish-uri\/execute/)

const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
assert.doesNotMatch(app, /<DevLocalControl/)
assert.match(app, /LocalUndoPage/)

const builder1 = readFileSync(join(root, 'src/services/builder1Api.js'), 'utf8')
const builder2 = readFileSync(join(root, 'src/services/api.js'), 'utf8')
assert.doesNotMatch(builder1, /publish-uri/)
assert.doesNotMatch(builder2, /publish-uri/)

console.log('test-local-dev-publish-uri-preview: passed')
