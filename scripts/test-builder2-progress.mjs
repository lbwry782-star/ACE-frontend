/**
 * Builder2 progress display tests.
 * Run: npm run test:builder2
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  BUILDER2_ESTIMATED_DURATION_MS,
  BUILDER2_PROGRESS_COMPLETION_DURATION_MS,
  BUILDER2_PROGRESS_HEADLINE_HE,
  BUILDER2_PROGRESS_ESTIMATE_HE,
  BUILDER2_PROGRESS_SEPARATOR,
  BUILDER2_PROGRESS_MAX_WHILE_RUNNING,
  computeBuilder2Progress,
  computeBuilder2CompletionProgress,
  resolveBuilder2ProgressFrame,
  getBuilder2RemainingTimeText,
  formatBuilder2ProgressStatusLine,
  resolveBuilder2JobStartTime,
  clearBuilder2JobStartTime,
  clearAllBuilder2JobStartTimes
} from '../src/utils/builder2Progress.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const builder2PageSource = readFileSync(join(root, 'src/pages/Builder2/Builder2Page.jsx'), 'utf8')
const productForm2Source = readFileSync(join(root, 'src/components/Form/ProductForm2.jsx'), 'utf8')
const progressBarSource = readFileSync(join(root, 'src/components/ProgressBar/Builder2ProgressBar.jsx'), 'utf8')
const progressCss = readFileSync(join(root, 'src/components/ProgressBar/builder2-progress.css'), 'utf8')
const builder1ProgressBarSource = readFileSync(
  join(root, 'src/components/ProgressBar/Builder1ProgressBar.jsx'),
  'utf8'
)
const builder1ProgressCss = readFileSync(join(root, 'src/components/ProgressBar/builder1-progress.css'), 'utf8')
const builder1ProgressJs = readFileSync(join(root, 'src/utils/builder1Progress.js'), 'utf8')

// Dedicated Builder2 component
assert.match(productForm2Source, /Builder2ProgressBar/)
assert.match(builder2PageSource, /resolveBuilder2JobStartTime/)
assert.match(builder2PageSource, /clearProgressJobTiming/)
assert.match(builder2PageSource, /handleProgressRevealReady/)
assert.doesNotMatch(builder2PageSource, /from '\.\.\/\.\.\/components\/ProgressBar\/ProgressBar'/)
assert.doesNotMatch(builder2PageSource, /builder1Progress/)
assert.doesNotMatch(builder2PageSource, /Builder1ProgressBar/)

// Builder1 files remain isolated
assert.doesNotMatch(builder1ProgressBarSource, /builder2-progress/)
assert.doesNotMatch(builder1ProgressBarSource, /Builder2ProgressBar/)
assert.doesNotMatch(builder1ProgressCss, /builder2-progress/)
assert.doesNotMatch(builder1ProgressJs, /builder2/i)

// Exact Hebrew copy
assert.equal(BUILDER2_PROGRESS_HEADLINE_HE, 'יוצר וידאו איכותי')
assert.equal(BUILDER2_PROGRESS_ESTIMATE_HE, 'זמן משוער: 8–12 דקות')
assert.equal(BUILDER2_PROGRESS_SEPARATOR, ' · ')

const singleLine = formatBuilder2ProgressStatusLine('נותרו כ־10 דקות')
assert.match(
  singleLine,
  /יוצר וידאו איכותי · זמן משוער: 8–12 דקות · נותרו כ־10 דקות/
)
assert.doesNotMatch(singleLine, /\n/)
assert.doesNotMatch(progressBarSource, /<br/i)

const overdueLine = formatBuilder2ProgressStatusLine(
  'הווידאו עדיין בעבודה — מסיימים את הפרטים האחרונים'
)
assert.match(
  overdueLine,
  /יוצר וידאו איכותי · זמן משוער: 8–12 דקות · הווידאו עדיין בעבודה — מסיימים את הפרטים האחרונים/
)

// Single-line RTL layout
assert.match(progressBarSource, /builder2-progress-status-line/)
assert.match(progressBarSource, /formatBuilder2ProgressStatusLine/)
assert.match(progressCss, /builder2-progress-status-line[\s\S]*direction:\s*rtl/)
assert.match(progressCss, /builder2-progress-status-line[\s\S]*white-space:\s*nowrap/)
assert.match(progressCss, /builder2-progress-status-line[\s\S]*text-align:\s*center/)
assert.doesNotMatch(progressBarSource, /builder2-progress-estimate/)
assert.doesNotMatch(progressBarSource, /builder2-progress-remaining/)

// LTR fill anchoring
assert.match(progressCss, /\.builder2-progress[\s\S]*direction:\s*ltr/)
assert.match(progressCss, /\.builder2-progress-track[\s\S]*direction:\s*ltr/)
assert.match(progressCss, /\.builder2-progress-fill[\s\S]*left:\s*0/)
assert.match(progressCss, /\.builder2-progress-fill[\s\S]*right:\s*auto/)
assert.match(progressCss, /\.builder2-progress-fill[\s\S]*transform-origin:\s*left center/)
assert.doesNotMatch(progressCss, /inset-inline-start/)
assert.doesNotMatch(progressCss, /scaleX\(-1\)/)
assert.match(progressBarSource, /className="builder2-progress"[\s\S]*dir="ltr"/)
assert.match(progressBarSource, /builder2-progress-status-line[\s\S]*dir="rtl"/)

// Ten-minute curve
assert.equal(BUILDER2_ESTIMATED_DURATION_MS, 600_000)
assert.ok(computeBuilder2Progress(600_000, 0) >= 88)
assert.ok(computeBuilder2Progress(600_000, 0) <= 92)
assert.ok(computeBuilder2Progress(720_000, 0) < 97)
assert.ok(computeBuilder2Progress(1_800_000, 0) <= BUILDER2_PROGRESS_MAX_WHILE_RUNNING)
assert.ok(
  resolveBuilder2ProgressFrame({ elapsedMs: 999_999, previousPercent: 0 }) < 100
)
assert.equal(
  resolveBuilder2ProgressFrame({
    elapsedMs: 1000,
    previousPercent: 90,
    taskSucceeded: true,
    completionFromPercent: 90,
    completionElapsedMs: BUILDER2_PROGRESS_COMPLETION_DURATION_MS
  }),
  100
)

// Remaining time
assert.equal(getBuilder2RemainingTimeText(0), 'נותרו כ־10 דקות')
assert.equal(getBuilder2RemainingTimeText(20_000), 'נותרו כ־10 דקות')
assert.equal(getBuilder2RemainingTimeText(70_000), 'נותרו כ־9 דקות')
assert.equal(getBuilder2RemainingTimeText(320_000), 'נותרו כ־5 דקות')
assert.equal(getBuilder2RemainingTimeText(541_000), 'נותרה פחות מדקה לפי ההערכה')
assert.equal(
  getBuilder2RemainingTimeText(600_000),
  'הווידאו עדיין בעבודה — מסיימים את הפרטים האחרונים'
)
for (const sample of [0, 30_000, 600_000, 900_000]) {
  assert.doesNotMatch(getBuilder2RemainingTimeText(sample), /-/)
}

// Job timer isolation (Builder2-only map)
clearAllBuilder2JobStartTimes()
const jobAStart = resolveBuilder2JobStartTime('b2-job-a', 1000)
const jobBStart = resolveBuilder2JobStartTime('b2-job-b', 2000)
assert.notEqual(jobAStart, jobBStart)
assert.equal(resolveBuilder2JobStartTime('b2-job-a'), jobAStart)
clearBuilder2JobStartTime('b2-job-a')
assert.equal(resolveBuilder2JobStartTime('b2-job-a', 3000), 3000)
clearAllBuilder2JobStartTimes()

// Builder2 form elements unchanged (fields, labels, validation)
assert.match(productForm2Source, /productName-b2/)
assert.match(productForm2Source, /productDescription-b2/)
assert.match(productForm2Source, /Product Name \(leave blank/)
assert.match(productForm2Source, /שם המוצר/)
assert.match(productForm2Source, /Product Description \*/)
assert.match(productForm2Source, /תיאור המוצר/)
assert.match(productForm2Source, /Product description is required/)
assert.match(productForm2Source, /submit-button/)
assert.doesNotMatch(productForm2Source, /imageSize/)

// Mobile responsive copy scaling
assert.match(progressCss, /@media \(max-width: 520px\)[\s\S]*builder2-progress-status-line/)

console.log('builder2 progress tests passed')
