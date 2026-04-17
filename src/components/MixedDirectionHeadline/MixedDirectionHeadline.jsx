/**
 * Renders mixed English+Hebrew headlines (e.g. "PRODUCT, עברית") with correct bidi:
 * product name stays in an LTR-isolated span; Hebrew flows RTL. String content is unchanged.
 */
function MixedDirectionHeadline({ className, children }) {
  const text = children
  if (text == null || text === '') return null
  if (typeof text !== 'string') {
    return <h3 className={className}>{text}</h3>
  }

  const idx = text.indexOf(',')
  if (idx === -1) {
    return <h3 className={className}>{text}</h3>
  }

  const before = text.slice(0, idx)
  const after = text.slice(idx)

  return (
    <h3 className={className} dir="rtl">
      <span dir="ltr" className="ad-card-headline-product">
        {before}
      </span>
      {after}
    </h3>
  )
}

export default MixedDirectionHeadline
