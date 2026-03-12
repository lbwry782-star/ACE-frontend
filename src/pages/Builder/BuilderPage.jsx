import { useEffect } from 'react'

// Any access to Builder must redirect to Preview immediately (all cases: direct URL, refresh, new tab, incognito, before/after payment).
const PREVIEW_REDIRECT_URL = 'https://ace-advertising.agency/'

function BuilderPage() {
  useEffect(() => {
    window.location.replace(PREVIEW_REDIRECT_URL)
  }, [])
  return null
}

export default BuilderPage
