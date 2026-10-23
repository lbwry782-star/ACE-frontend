import {
  NO_ACTIVE_CYCLE_MESSAGE,
  NO_WORK_TO_CANCEL_MESSAGE,
  canConfirmCancelExecute,
  explainBlocker
} from '../../utils/localDevCancelPreview.js'
import { EXECUTE_LONG_WAIT_MESSAGE, EXECUTE_UNAVAILABLE_MESSAGE, formatElapsed } from '../../utils/localDevCycleApi.js'
import { mapProgressSteps, stepStateLabel } from '../../utils/localDevCancelProgress.js'

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 11900,
  background: 'transparent',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'flex-end',
  padding: '12px 12px 12px 348px',
  boxSizing: 'border-box',
  pointerEvents: 'none'
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
  boxSizing: 'border-box',
  pointerEvents: 'auto'
}

const headerStyle = {
  flex: '0 0 auto',
  padding: '18px 18px 8px'
}

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

const titleStyle = {
  margin: 0,
  fontSize: 20,
  fontWeight: 700,
  overflowWrap: 'break-word',
  wordBreak: 'normal'
}

const sectionStyle = {
  margin: '0 0 14px',
  minWidth: 0,
  maxWidth: '100%'
}

const headingStyle = {
  margin: '0 0 6px',
  fontSize: 14,
  fontWeight: 700
}

const textStyle = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.55,
  overflowWrap: 'break-word',
  wordBreak: 'normal',
  whiteSpace: 'normal',
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

const listItemStyle = {
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'break-word',
  wordBreak: 'normal'
}

const ltrStyle = {
  display: 'block',
  direction: 'ltr',
  textAlign: 'left',
  unicodeBidi: 'isolate',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
  maxWidth: '100%',
  minWidth: 0,
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

const blockerItemStyle = {
  ...listItemStyle,
  marginBottom: 10
}

const technicalStyle = {
  ...ltrStyle,
  marginTop: 4,
  color: '#7a3b30'
}

const confirmStyle = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: 4,
  background: '#c44c33',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer'
}

const confirmDisabledStyle = {
  ...confirmStyle,
  opacity: 0.55,
  cursor: 'not-allowed'
}

const progressBoxStyle = {
  margin: '0 0 14px',
  padding: '12px',
  borderRadius: 6,
  background: '#ece8df',
  minWidth: 0,
  maxWidth: '100%'
}

const pulseStyle = {
  display: 'inline-block',
  width: 10,
  height: 10,
  marginInlineEnd: 8,
  borderRadius: '50%',
  background: '#c44c33',
  boxShadow: '0 0 0 4px rgba(196, 76, 51, 0.18)'
}

function LtrText({ children }) {
  return <span style={ltrStyle}>{children}</span>
}

function CommitList({ rows, emptyLabel }) {
  if (!rows.length) {
    return <p style={textStyle}>{emptyLabel}</p>
  }
  return (
    <ul style={listStyle}>
      {rows.map((row) => (
        <li key={`${row.shortSha}-${row.subject}`} style={listItemStyle}>
          {row.shortSha ? <LtrText>{row.shortSha}</LtrText> : null}
          <span style={textStyle}>{row.subject || 'ללא נושא'}</span>
          {row.classification ? (
            <LtrText>{row.classification}</LtrText>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function PathList({ paths, emptyLabel }) {
  if (!paths.length) {
    return <p style={textStyle}>{emptyLabel}</p>
  }
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

function EnvKeyList({ env, label }) {
  const keys = [...env.addedKeys, ...env.removedKeys, ...env.changedKeys]
  return (
    <div style={{ minWidth: 0, maxWidth: '100%' }}>
      <p style={textStyle}>
        <strong>{label}:</strong>
        {keys.length ? '' : ' אין שינוי זמני בשמות המשתנים.'}
      </p>
      {keys.length ? (
        <ul style={listStyle}>
          {env.addedKeys.map((key) => (
            <li key={`add-${key}`} style={listItemStyle}>
              <LtrText>{key}</LtrText>
              <span style={textStyle}> (נוסף)</span>
            </li>
          ))}
          {env.removedKeys.map((key) => (
            <li key={`rm-${key}`} style={listItemStyle}>
              <LtrText>{key}</LtrText>
              <span style={textStyle}> (יוסר)</span>
            </li>
          ))}
          {env.changedKeys.map((key) => (
            <li key={`ch-${key}`} style={listItemStyle}>
              <LtrText>{key}</LtrText>
              <span style={textStyle}> (ישוחזר)</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function BlockerList({ items }) {
  if (!items.length) return null
  return (
    <div style={blockerBoxStyle}>
      <p style={{ ...headingStyle, color: '#6b1f14' }}>חסימות</p>
      <ul style={{ ...listStyle, paddingInlineStart: 18 }}>
        {items.map((item) => {
          const explained = explainBlocker(item)
          return (
            <li key={item} style={blockerItemStyle}>
              <p style={textStyle}>{explained.explanation}</p>
              {explained.technical ? (
                <span style={technicalStyle}>{explained.technical}</span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function CancelDevelopmentPreviewDialog({
  preview,
  onConfirm,
  confirming = false,
  confirmError = '',
  elapsedSeconds = 0,
  progressSnapshot = null
}) {
  const isNoneCycle = preview?.activeCycle?.status === 'NONE'
  const canConfirm = preview ? canConfirmCancelExecute(preview) : false
  const blockers = [...(preview?.blockers || []), ...(preview?.registryInfraDrift || [])]
  const preBaseline = preview?.preBaselineWarnings || []
  const backup = preview?.backupExpectations || {}
  const executeUnavailable = Boolean(preview) && !confirming && !isNoneCycle && !canConfirm
  const showConfirm = Boolean(preview) && !isNoneCycle

  return (
    <div style={overlayStyle}>
      <div
        style={dialogStyle}
        role="region"
        aria-labelledby="cancel-dev-preview-title"
        dir="rtl"
      >
        <div style={headerStyle}>
          <h2 id="cancel-dev-preview-title" style={titleStyle}>
            {confirming ? 'מבטל את הפיתוח' : 'בדיקת ביטול הפיתוח'}
          </h2>
        </div>

        <div style={scrollStyle}>
          {confirming ? (
            <div style={progressBoxStyle} aria-live="polite">
              <p style={textStyle}>
                <span style={pulseStyle} aria-hidden="true" />
                הפעולה פעילה.
              </p>
              <p style={textStyle}>זמן שחלף: {formatElapsed(elapsedSeconds)}</p>
              <p style={textStyle}>{EXECUTE_LONG_WAIT_MESSAGE}</p>
              <p style={{ ...headingStyle, marginTop: 10 }}>שלבים</p>
              <ul style={listStyle}>
                {mapProgressSteps(progressSnapshot).map((step) => (
                  <li key={step.id} style={listItemStyle}>
                    {step.label} — {stepStateLabel(step.state)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {!confirming && !preview ? (
            <p style={textStyle}>לחצו על בטל את הפיתוח כדי לטעון בדיקה עדכנית.</p>
          ) : confirming || !preview ? null : isNoneCycle ? (
            <p style={textStyle}>{NO_ACTIVE_CYCLE_MESSAGE}</p>
          ) : (
            <>
              <BlockerList items={blockers} />

              {preBaseline.length ? (
                <div style={blockerBoxStyle}>
                  <p style={{ ...headingStyle, color: '#6b1f14' }}>אזהרות pre-baseline</p>
                  <ul style={listStyle}>
                    {preBaseline.map((item) => (
                      <li key={`${item.repo}-${item.shortSha}`} style={blockerItemStyle}>
                        <p style={textStyle}>
                          קיים commit שלפני נקודת הבסיס
                          {item.requiresExplicitScope ? ', והוא דורש הכללה מפורשת.' : '.'}
                        </p>
                        <span style={technicalStyle}>
                          {[item.repo, item.shortSha, item.subject].filter(Boolean).join(' — ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <section style={sectionStyle}>
                <h3 style={headingStyle}>מחזור פיתוח פעיל</h3>
                <p style={textStyle}>
                  {preview.cycleActive ? 'כן' : NO_ACTIVE_CYCLE_MESSAGE}
                </p>
              </section>

              <section style={sectionStyle}>
                <h3 style={headingStyle}>עבודה זמנית לביטול</h3>
                <p style={textStyle}>{preview.hasWork ? 'כן' : NO_WORK_TO_CANCEL_MESSAGE}</p>
              </section>

              <section style={sectionStyle}>
                <h3 style={headingStyle}>ביטול עקרוני במנוע</h3>
                <p style={textStyle}>
                  {canConfirm
                    ? 'כן. הביטול בפועל יישלח רק אחרי אישור מפורש במסך זה.'
                    : EXECUTE_UNAVAILABLE_MESSAGE}
                </p>
              </section>

              <section style={sectionStyle}>
                <h3 style={headingStyle}>שינויים שיבוטלו</h3>
                <p style={textStyle}>Commits ב-Backend</p>
                <CommitList rows={preview.commitsToCancel?.backend || []} emptyLabel="אין commits לביטול ב-Backend." />
                <p style={textStyle}>Commits ב-Frontend</p>
                <CommitList rows={preview.commitsToCancel?.frontend || []} emptyLabel="אין commits לביטול ב-Frontend." />
                <p style={textStyle}>קבצים ב-Backend</p>
                <PathList paths={preview.pathsToRevert?.backend || []} emptyLabel="אין קבצים לביטול ב-Backend." />
                <p style={textStyle}>קבצים ב-Frontend</p>
                <PathList paths={preview.pathsToRevert?.frontend || []} emptyLabel="אין קבצים לביטול ב-Frontend." />
                <EnvKeyList env={preview.envChanges?.backend || { addedKeys: [], removedKeys: [], changedKeys: [] }} label="משתני ENV ב-Backend (שמות בלבד)" />
                <EnvKeyList env={preview.envChanges?.frontend || { addedKeys: [], removedKeys: [], changedKeys: [] }} label="משתני ENV ב-Frontend (שמות בלבד)" />
              </section>

              <section style={sectionStyle}>
                <h3 style={headingStyle}>שינויים שיישמרו</h3>
                <p style={textStyle}>תשתית הפיתוח הקבועה</p>
                <PathList
                  paths={[
                    ...(preview.infraPreserved?.paths?.backend || []),
                    ...(preview.infraPreserved?.paths?.frontend || [])
                  ]}
                  emptyLabel="אין נתיבי תשתית נוספים לשימור מעבר לענף התשתית."
                />
                <p style={textStyle}>Commits של תשתית</p>
                <CommitList
                  rows={[
                    ...(preview.infraPreserved?.commits?.backend || []),
                    ...(preview.infraPreserved?.commits?.frontend || [])
                  ]}
                  emptyLabel={
                    preview.infraTargets?.frontendCommit || preview.infraTargets?.backendCommit
                      ? 'יישמרו יעדי התשתית המצוינים למטה.'
                      : 'אין commits תשתית נוספים לשימור.'
                  }
                />
                {preview.infraTargets?.frontendCommit || preview.infraTargets?.backendCommit ? (
                  <LtrText>
                    {`Frontend ${preview.infraTargets.frontendCommit || '—'} | Backend ${preview.infraTargets.backendCommit || '—'}`}
                  </LtrText>
                ) : null}
                <p style={textStyle}>ענפי WIP וגיבויים</p>
                <PathList
                  paths={preview.wipBranches || []}
                  emptyLabel="אין ענפי WIP נוספים לדיווח. הגיבויים נשמרים מחוץ לביטול."
                />
              </section>

              <section style={sectionStyle}>
                <h3 style={headingStyle}>גיבוי ושחזור</h3>
                <p style={textStyle}>
                  {backup.note || 'זו בדיקת תצוגה בלבד. הקריאה אינה יוצרת גיבוי ואינה מבצעת ביטול.'}
                  {backup.recoveryGuideFile ? ` מדריך השחזור: ${backup.recoveryGuideFile}.` : ''}
                </p>
              </section>
            </>
          )}
        </div>

        {showConfirm ? (
          <div style={footerStyle}>
            <button
              type="button"
              style={canConfirm && !confirming ? confirmStyle : confirmDisabledStyle}
              onClick={canConfirm && !confirming ? onConfirm : undefined}
              disabled={!canConfirm || confirming}
              aria-disabled={!canConfirm || confirming}
            >
              {confirming ? 'מבטל…' : 'אשר ביטול'}
            </button>
          </div>
        ) : null}
        {confirmError ? (
          <p style={{ ...textStyle, padding: '0 18px 14px', color: '#6b1f14' }}>{confirmError}</p>
        ) : executeUnavailable && !isNoneCycle ? (
          <p style={{ ...textStyle, padding: '0 18px 14px', color: '#6b1f14' }}>
            {EXECUTE_UNAVAILABLE_MESSAGE}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default CancelDevelopmentPreviewDialog
