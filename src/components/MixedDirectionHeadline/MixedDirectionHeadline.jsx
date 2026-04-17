/**
 * Renders API headline text verbatim (no comma replacement, no stripping, no reordering).
 * Wraps in <bdi> so mixed English + Hebrew follows Unicode bidi without frontend string surgery.
 */
function MixedDirectionHeadline({ className, children }) {
  const text = children
  if (text == null || text === '') return null
  if (typeof text !== 'string') {
    return <h3 className={className}>{text}</h3>
  }

  return (
    <h3 className={className}>
      <bdi>{text}</bdi>
    </h3>
  )
}

export default MixedDirectionHeadline
