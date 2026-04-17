/**
 * Mixed English + Hebrew headlines: product name (LTR) + comma + Hebrew (RTL).
 * Parses on the first comma; strips spurious separators (e.g. middle dot) so only one "," shows.
 */

/** Trailing junk before the comma (e.g. middle dot ·); does not strip ASCII . or : from product names */
const TRAIL_SEP = /[\s\u00B7\u2022\u2024\u2219\u22C5\uFE58\u05BE\-]+$/u
/** Leading junk after the comma */
const LEAD_SEP = /^[\s\u00B7\u2022\u2024\u2219\u22C5\uFE58\u05BE\-]+/u

function cleanProductSegment(s) {
  return s.replace(TRAIL_SEP, '').trim()
}

function cleanHebrewSegment(s) {
  return s.replace(LEAD_SEP, '').trim()
}

/**
 * @returns {{ type: 'plain', text: string } | { type: 'split', product: string, hebrew: string }}
 */
export function parseMixedHeadline(text) {
  if (text == null || typeof text !== 'string') return { type: 'plain', text: '' }
  const idx = text.indexOf(',')
  if (idx === -1) return { type: 'plain', text }

  let product = cleanProductSegment(text.slice(0, idx))
  let hebrew = cleanHebrewSegment(text.slice(idx + 1))

  return { type: 'split', product, hebrew }
}

function MixedDirectionHeadline({ className, children }) {
  const text = children
  if (text == null || text === '') return null
  if (typeof text !== 'string') {
    return <h3 className={className}>{text}</h3>
  }

  const parsed = parseMixedHeadline(text)
  if (parsed.type === 'plain') {
    return <h3 className={className}>{parsed.text}</h3>
  }

  const { product, hebrew } = parsed

  return (
    <h3 className={className} dir="rtl">
      <span dir="ltr" className="ad-card-headline-product">
        {product}
      </span>
      <span className="ad-card-headline-comma" dir="ltr">
        {', '}
      </span>
      <span dir="rtl" className="ad-card-headline-hebrew" lang="he">
        {hebrew}
      </span>
    </h3>
  )
}

export default MixedDirectionHeadline
