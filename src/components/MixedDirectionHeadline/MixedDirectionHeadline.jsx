/**
 * Headline: <product name> <remainder> — two visual parts, product slightly larger.
 * Splits on first comma (legacy) or first whitespace (current); comma is never rendered.
 */

function splitProductAndRemainder(raw) {
  const t = typeof raw === 'string' ? raw.trim() : ''
  if (!t) return { product: '', remainder: '' }

  const commaIdx = t.indexOf(',')
  const spaceIdx = t.search(/\s/)

  if (commaIdx !== -1 && (spaceIdx === -1 || commaIdx < spaceIdx)) {
    return {
      product: t.slice(0, commaIdx).trim(),
      remainder: t.slice(commaIdx + 1).trim()
    }
  }

  if (spaceIdx !== -1) {
    return {
      product: t.slice(0, spaceIdx),
      remainder: t.slice(spaceIdx + 1).trim()
    }
  }

  return { product: t, remainder: '' }
}

function MixedDirectionHeadline({ className, children }) {
  const text = children
  if (text == null || text === '') return null
  if (typeof text !== 'string') {
    return <h3 className={className}>{text}</h3>
  }

  const { product, remainder } = splitProductAndRemainder(text)

  return (
    <h3 className={className} dir="auto">
      <span className="ad-card-headline-line">
        <span className="ad-card-headline-product">
          <bdi>{product}</bdi>
        </span>
        {remainder ? (
          <span className="ad-card-headline-remainder">
            <bdi>{remainder}</bdi>
          </span>
        ) : null}
      </span>
    </h3>
  )
}

export default MixedDirectionHeadline
