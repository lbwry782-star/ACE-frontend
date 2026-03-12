import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import Header from './components/Header/Header'
import Footer from './components/Footer/Footer'
import PreviewPage from './pages/Preview/PreviewPage'
import BuilderPage from './pages/Builder/BuilderPage'
import DemoPage from './pages/Demo/DemoPage'

function App() {
  // Clean sid-related data on app initialization - ONLY if no sid in URL
  useEffect(() => {
    console.warn('ACE_BUILDER_DEBUG: App mount — storage cleanup effect running', {
      href: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash
    })
    // iCount returns to site root with no URL params; detect post-payment return via one-time sessionStorage marker
    const hash = window.location.hash || ''
    const isRootWithoutBuilder = (window.location.pathname === '/' || window.location.pathname === '') && (hash === '' || hash === '#/' || hash === '#')
    if (isRootWithoutBuilder && sessionStorage.getItem('ace_payment_return_pending') === '1') {
      sessionStorage.removeItem('ace_payment_return_pending')
      window.location.hash = '#/builder?fromPayment=1'
      return
    }
    // First, check if there's a sid or fromPayment in URL (first-time entry after payment)
    let hasSidInUrl = false
    if (window.location.hash && window.location.hash.includes('?')) {
      const hashParts = window.location.hash.split('?')
      const hashQuery = hashParts[1]
      const hashParams = new URLSearchParams(hashQuery)
      if (hashParams.get('sid')) {
        hasSidInUrl = true
        console.warn('ACE_BUILDER_DEBUG: App — hash contains sid; skipping storage cleanup (lawful entry path)', {
          sidInHash: true
        })
        // This is first-time entry after payment - don't clean storage yet
        // BuilderPage will handle saving sid to runtime and cleaning URL
        return
      }
    }
    // Payment redirect may put params in search only (?fromPayment=1#/builder) — don't clean yet
    if (window.location.search) {
      const searchParams = new URLSearchParams(window.location.search)
      if (searchParams.get('sid') || searchParams.get('fromPayment') === '1') {
        console.warn('ACE_BUILDER_DEBUG: App — search has sid/fromPayment; skipping storage cleanup', {
          sidInSearch: !!searchParams.get('sid'),
          fromPaymentInSearch: searchParams.get('fromPayment') === '1'
        })
        return
      }
    }

    console.warn('ACE_BUILDER_DEBUG: App — no lawful URL params; will clean sid-related storage (refresh/direct/tab/incognito path)')
    // Only clean storage if there's NO sid in URL (REFRESH / TAB / INCOGNITO scenario)
    if (!hasSidInUrl) {
      // Remove sid from all persistent storage
      localStorage.removeItem('sid')
      sessionStorage.removeItem('sid')
      
      // Remove any related keys that might exist
      localStorage.removeItem('entitlementSid')
      sessionStorage.removeItem('entitlementSid')
      localStorage.removeItem('paymentSid')
      sessionStorage.removeItem('paymentSid')
      
      // Clean any other potential sid-related keys from localStorage
      const localStorageKeysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.toLowerCase().includes('sid')) {
          localStorageKeysToRemove.push(key)
        }
      }
      localStorageKeysToRemove.forEach(key => localStorage.removeItem(key))
      
      // Clean any other potential sid-related keys from sessionStorage
      const sessionStorageKeysToRemove = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && key.toLowerCase().includes('sid')) {
          sessionStorageKeysToRemove.push(key)
        }
      }
      sessionStorageKeysToRemove.forEach(key => sessionStorage.removeItem(key))
      console.warn('ACE_BUILDER_DEBUG: App — storage cleanup done', {
        localStorageKeysRemoved: localStorageKeysToRemove.length,
        sessionStorageKeysRemoved: sessionStorageKeysToRemove.length
      })
    }
  }, [])

  return (
    <Router>
      <div className="app">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<PreviewPage />} />
            <Route path="/builder" element={<BuilderPage />} />
            <Route path="/demo" element={<DemoPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  )
}

export default App

