import { Link, useLocation } from 'react-router-dom'
import './header.css'

const BASE_URL = import.meta.env.BASE_URL
const HEADER_BACK_GIF_SRC = `${BASE_URL}assets/BACK.gif`
const HEADER_LOGO_SRC = `${BASE_URL}assets/${encodeURIComponent('לוגו.png')}`

function Header() {
  const { pathname } = useLocation()
  const isDemo = pathname === '/demo'
  const isDemo2 = pathname === '/demo2'
  const showDemoMobileBack = isDemo || isDemo2

  return (
    <header className={`header${showDemoMobileBack ? ' header--with-demo-back' : ''}`}>
      <div className="header-container">
        {showDemoMobileBack && (
          <Link
            to={isDemo ? '/preview2' : '/preview1'}
            className="header-demo-back"
            aria-label={isDemo ? 'חזרה לדף PREVIEW2' : 'חזרה לדף PREVIEW1'}
          >
            <img src={HEADER_BACK_GIF_SRC} alt="" className="header-demo-back-img" />
          </Link>
        )}
        <img
          src={HEADER_LOGO_SRC}
          alt=""
          className="header-logo"
          width={69}
          height={69}
        />
      </div>
    </header>
  )
}

export default Header