import { isLocalUndoShell } from '../../utils/localDevUndoShell.js'
import {
  PUBLISH_BLOCKED_LIVE_MESSAGE,
  PUBLISH_CANDIDATE_NOTE,
  PUBLISH_LIVE_APPROVED_NOTE,
  explainPublishBlocker,
  isPublishBlockedForLive,
  isPublishSecurityBlocker
} from '../../utils/localDevPublishUriPreview.js'

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 14000,
  background: 'rgba(0, 0, 0, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 12,
  boxSizing: 'border-box'
}

const dialogStyle = {
  width: 'min(680px, 100%)',
  maxWidth: 'calc(100vw - 24px)',
  maxHeight: 'calc(100vh - 24px)',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: '#f7f6f2',
  color: '#232320',
  borderRadius: 8,
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.28)',
  fontFamily: "'Segoe UI', Arial, sans-serif",
  direction: 'rtl',
  textAlign: 'right',
  boxSizing: 'border-box'
}

const headerStyle = { flex: '0 0 auto', padding: '18px 18px 8px' }
const scrollStyle = {
  flex: '1 1 auto',
  minHeight: 0,
  minWidth: 0,
  overflowX: 'hidden',
  overflowY: 'auto',
  padding: '0 18px 12px',
  boxSizing: 'border-box'
}
const footerStyle = {
  flex: '0 0 auto',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  justifyContent: 'flex-start',
  padding: '10px 18px 16px',
  borderTop: '1px solid #deded5'
}
const titleStyle = { margin: 0, fontSize: 20, fontWeight: 700, overflowWrap: 'break-word' }
const sectionStyle = { margin: '0 0 14px', minWidth: 0, maxWidth: '100%' }
const headingStyle = { margin: '0 0 6px', fontSize: 14, fontWeight: 700 }
const textStyle = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.55,
  overflowWrap: 'break-word',
  wordBreak: 'normal',
  maxWidth: '100%'
}
const listStyle = {
  margin: '4px 0 0',
  paddingInlineStart: 18,
  fontSize: 13,
  lineHeight: 1.5,
  maxWidth: '100%',
  minWidth: 0
}
const listItemStyle = { minWidth: 0, maxWidth: '100%', overflowWrap: 'break-word' }
const ltrStyle = {
  display: 'block',
  direction: 'ltr',
  textAlign: 'left',
  unicodeBidi: 'isolate',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
  maxWidth: '100%',
  fontFamily: "Consolas, 'Courier New', monospace",
  fontSize: 12,
  lineHeight: 1.45
}
const blockerBoxStyle = {
  margin: '0 0 14px',
  padding: '10px 12px',
  borderRadius: 6,
  background: '#f4d6d0',
  border: '1px solid #c44c33',
  color: '#6b1f14',
  minWidth: 0,
  maxWidth: '100%',
  maxHeight: 'min(220px, 32vh)',
  overflowX: 'hidden',
  overflowY: 'auto',
  boxSizing: 'border-box'
}
const closeStyle = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: 4,
  background: '#232320',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer'
}

function LtrText({ children }) {
  return <span style={ltrStyle}>{children}</span>
}

function cycleLabel(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'OPEN') return 'מחזור פיתוח פעיל.'
  if (value === 'NONE') return 'אין מחזור פיתוח פעיל.'
  if (value === 'INVALID') return 'מצב המחזור אינו תקין.'
  if (value === 'CANCELLED') return 'המחזור הקודם בוטל.'
  return status ? `מצב מחזור: ${status}` : 'מצב המחזור אינו ידוע.'
}

function classificationLabel(classification) {
  const value = String(classification || '')
  if (value === 'productCandidate') return 'מועמד לפרסום'
  if (value === 'excludedLocalInfraBranch') return 'הוחרג — תשתית מקומית'
  if (value === 'mixedProductAndLocal') return 'חסום — ערבוב מוצר ומקומי'
  if (value === 'forbiddenLocalOnly') return 'חסום — שינוי מקומי'
  if (value === 'unclearPaths') return 'חסום — נתיבים לא ברורים'
  return value || 'ללא סיווג'
}

function CommitList({ rows, emptyLabel }) {
  if (!rows.length) return <p style={textStyle}>{emptyLabel}</p>
  return (
    <ul style={listStyle}>
      {rows.map((row) => (
        <li key={`${row.shortSha}-${row.subject}`} style={listItemStyle}>
          {row.shortSha ? <LtrText>{row.shortSha}</LtrText> : null}
          <span style={textStyle}>{row.subject || 'ללא נושא'}</span>
          <span style={textStyle}> — {classificationLabel(row.classification)}</span>
        </li>
      ))}
    </ul>
  )
}

function PathList({ paths, emptyLabel }) {
  if (!paths.length) return <p style={textStyle}>{emptyLabel}</p>
  return (
    <ul style={listStyle}>
      {paths.map((path) => (
        <li key={path} style={listItemStyle}>
          <LtrText>{path}</LtrText>
        </li>
      ))}
    </ul>
  )
}

function BlockerList({ items, title }) {
  if (!items.length) return null
  return (
    <div style={blockerBoxStyle}>
      <p style={{ ...headingStyle, color: '#6b1f14' }}>{title}</p>
      <ul style={listStyle}>
        {items.map((item) => {
          const explained = explainPublishBlocker(item)
          return (
            <li key={item} style={{ ...listItemStyle, marginBottom: 10 }}>
              <p style={textStyle}>{explained.explanation}</p>
              {explained.technical ? <span style={{ ...ltrStyle, marginTop: 4, color: '#7a3b30' }}>{explained.technical}</span> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function PublishUriPreviewDialog({ preview, onClose }) {
  if (!preview) return null
  const blocked = isPublishBlockedForLive(preview)
  const allBlockers = [
    ...(preview.blockers || []),
    ...(preview.registryInfraDrift || []),
    ...(preview.registryWipDrift || [])
  ]
  const securityBlockers = allBlockers.filter((item) => isPublishSecurityBlocker(item))
  const otherBlockers = allBlockers.filter((item) => !isPublishSecurityBlocker(item))
  const production = preview.production || {}
  const proposed = preview.proposedChanges || { backend: { commits: [], files: [] }, frontend: { commits: [], files: [] } }
  const worker = preview.workerImpact || {}
  const excluded = preview.commits?.excludedLocal || { backend: [], frontend: [] }
  const mixed = preview.commits?.mixedOrBlocked || []
  const readiness = preview.readiness || {}
  const shell = isLocalUndoShell()
  const overlay = shell
    ? { ...overlayStyle, alignItems: 'stretch', justifyContent: 'stretch', padding: 8 }
    : overlayStyle
  const dialog = shell
    ? { ...dialogStyle, width: '100%', maxWidth: '100%', maxHeight: '100%' }
    : dialogStyle

  return (
    <div style={overlay} role="presentation">
      <div
        style={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-uri-preview-title"
        dir="rtl"
      >
        <div style={headerStyle}>
          <h2 id="publish-uri-preview-title" style={titleStyle}>תוכנית פרסום</h2>
        </div>
        <div style={scrollStyle}>
          {blocked ? (
            <div style={blockerBoxStyle}>
              <p style={{ ...headingStyle, color: '#6b1f14' }}>{PUBLISH_BLOCKED_LIVE_MESSAGE}</p>
              <p style={textStyle}>אין אפשרות לביצוע פרסום במסך זה.</p>
            </div>
          ) : (
            <p style={textStyle}>{PUBLISH_LIVE_APPROVED_NOTE}</p>
          )}

          <BlockerList items={securityBlockers} title="חסימות אבטחה" />
          <BlockerList items={otherBlockers} title="חסימות" />

          <section style={sectionStyle}>
            <h3 style={headingStyle}>מחזור הפיתוח הנוכחי</h3>
            <p style={textStyle}>{cycleLabel(preview.activeCycle?.status)}</p>
            {preview.sessionId ? <LtrText>{preview.sessionId}</LtrText> : null}
            {preview.activeCycle?.message ? <p style={textStyle}>{preview.activeCycle.message}</p> : null}
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>גרסת הייצור הנוכחית</h3>
            <p style={textStyle}>Backend Web</p>
            <LtrText>{production.backendWeb || '—'}</LtrText>
            <p style={textStyle}>Backend Worker</p>
            <LtrText>{production.backendWorker || '—'}</LtrText>
            <p style={textStyle}>Frontend</p>
            <LtrText>{production.frontend || '—'}</LtrText>
            <p style={textStyle}>ענפים</p>
            <LtrText>
              {`Backend ${production.backendBranch || '—'} | Frontend ${production.frontendBranch || '—'}`}
            </LtrText>
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>שינויי Backend המועמדים לפרסום</h3>
            <p style={textStyle}>{PUBLISH_CANDIDATE_NOTE}</p>
            <CommitList rows={proposed.backend?.commits || []} emptyLabel="אין commits מועמדים ב-Backend." />
            <PathList paths={proposed.backend?.files || []} emptyLabel="אין קבצים מועמדים ב-Backend." />
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>שינויי Frontend המועמדים לפרסום</h3>
            <p style={textStyle}>{PUBLISH_CANDIDATE_NOTE}</p>
            <CommitList rows={proposed.frontend?.commits || []} emptyLabel="אין commits מועמדים ב-Frontend." />
            <PathList paths={proposed.frontend?.files || []} emptyLabel="אין קבצים מועמדים ב-Frontend." />
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>השפעה על Worker</h3>
            <p style={textStyle}>
              {worker.deployWithBackendWeb
                ? 'Worker מועמד לפרסום יחד עם Backend Web. זה אינו אישור לפרסום חי.'
                : 'אין פרסום Worker יחד עם Backend Web לפי התוכנית הנוכחית.'}
            </p>
            {worker.proposedCommitSha ? <LtrText>{worker.proposedCommitSha}</LtrText> : null}
            {worker.note ? <p style={textStyle}>{worker.note}</p> : null}
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>שינויים מקומיים שהוחרגו</h3>
            <CommitList rows={excluded.backend || []} emptyLabel="אין שינויים מקומיים שהוחרגו ב-Backend." />
            <CommitList rows={excluded.frontend || []} emptyLabel="אין שינויים מקומיים שהוחרגו ב-Frontend." />
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>Commits חסומים</h3>
            <CommitList rows={mixed} emptyLabel="אין commits חסומים לדיווח." />
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>מצב המוכנות לפרסום</h3>
            <p style={textStyle}>
              {readiness.hasProductChanges ? 'יש שינויי מוצר מועמדים.' : 'אין שינויי מוצר מועמדים.'}
            </p>
            <p style={textStyle}>
              {readiness.verifiedSafeForLiveProduction
                ? 'השרת מדווח שהגרסה בטוחה לייצור.'
                : 'הגרסה לא אושרה לפרסום חי.'}
            </p>
            {readiness.notes?.map((note) => (
              <p key={note} style={textStyle}>{note}</p>
            ))}
            {preview.note ? <p style={textStyle}>{preview.note}</p> : null}
            {preview.message && !preview.ok ? <p style={textStyle}>{preview.message}</p> : null}
          </section>
        </div>
        <div style={footerStyle}>
          <button type="button" style={closeStyle} onClick={onClose}>
            סגור
          </button>
        </div>
      </div>
    </div>
  )
}

export default PublishUriPreviewDialog
