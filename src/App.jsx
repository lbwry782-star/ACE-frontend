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
    // First, check if there's a sid in URL (first-time entry after payment)
    let hasSidInUrl = false
    if (window.location.hash && window.location.hash.includes('?')) {
      const hashParts = window.location.hash.split('?')
      const hashQuery = hashParts[1]
      const hashParams = new URLSearchParams(hashQuery)
      if (hashParams.get('sid')) {
        hasSidInUrl = true
        // This is first-time entry after payment - don't clean storage yet
        // BuilderPage will handle saving sid to runtime and cleaning URL
        return
      }
    }

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

