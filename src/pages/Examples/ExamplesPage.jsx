import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { EXAMPLES } from './examplesData.js'
import './ExamplesPage.css'

const BASE_URL = import.meta.env.BASE_URL
const EXAMPLES_LOGO_SRC = `${BASE_URL}assets/${encodeURIComponent('EXAMPLES_LOGO.png')}`
const APP_EXAMPLES_CLASS = 'app--examples-page'
const HOME_PATH = '/'

function publicAssetSrc(fileName) {
  const name = String(fileName ?? '').trim()
  if (!name) return ''
  return `${BASE_URL}assets/${encodeURIComponent(name)}`
}

function mediaAspectStyle(item) {
  const width = Number(item.mediaWidth)
  const height = Number(item.mediaHeight)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined
  }
  return { aspectRatio: `${width} / ${height}` }
}

function LeftArrow() {
  return (
    <svg className="examples-arrow" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path
        d="M7.4 2.2 3.6 6l3.8 3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function isLightPlaceholder(background) {
  const hex = String(background ?? '').replace('#', '')
  if (hex.length !== 6) return true
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 140
}

function ExampleMedia({ item }) {
  const src = publicAssetSrc(item.src)
  const toneClass = isLightPlaceholder(item.placeholderBackground)
    ? 'examples-placeholder--light'
    : 'examples-placeholder--dark'
  const ratioStyle = mediaAspectStyle(item)

  if (item.type === 'video' && src) {
    return (
      <div
        className="examples-media-frame examples-media-frame--video"
        style={ratioStyle}
      >
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
        >
          הדפדפן אינו תומך בניגון וידאו.
        </video>
      </div>
    )
  }

  if (item.type === 'image' && src) {
    return (
      <div
        className="examples-media-frame examples-media-frame--image"
        style={ratioStyle}
      >
        <img src={src} alt={item.hideCaption ? '' : item.productName} loading="lazy" />
      </div>
    )
  }

  const ratioClass =
    item.type === 'video' ? 'examples-placeholder--video' : 'examples-placeholder--image'

  return (
    <div
      className={`examples-placeholder ${ratioClass} ${toneClass}`}
      style={{ backgroundColor: item.placeholderBackground, ...ratioStyle }}
    >
      <span>{item.placeholderLabel}</span>
    </div>
  )
}

function ExampleCardField({ as: Tag = 'p', className, label, value }) {
  return (
    <Tag className={className}>
      <span className="examples-card-label">{label}</span>
      {' '}
      <span className="examples-card-value">{value}</span>
    </Tag>
  )
}

function ExampleCard({ item }) {
  return (
    <article className="examples-card">
      <ExampleMedia item={item} />
      {item.hideCaption ? null : (
        <div className="examples-card-meta">
          <ExampleCardField
            as="h3"
            className="examples-card-name"
            label="שם המוצר:"
            value={item.productName}
          />
          <ExampleCardField
            className="examples-card-desc"
            label="תיאור המוצר:"
            value={item.productDescription}
          />
        </div>
      )}
    </article>
  )
}

function ExamplesPage() {
  useEffect(() => {
    const app = document.querySelector('.app')
    if (!app) return undefined
    app.classList.add(APP_EXAMPLES_CLASS)
    return () => {
      app.classList.remove(APP_EXAMPLES_CLASS)
    }
  }, [])

  const videos = EXAMPLES.filter((item) => item.type === 'video')
  const images = EXAMPLES.filter((item) => item.type === 'image')

  return (
    <div className="examples-page" dir="rtl" lang="he">
      <div className="examples-shell">
        <header className="examples-top">
          <img
            src={EXAMPLES_LOGO_SRC}
            alt="לוגו אורי"
            className="examples-logo"
          />
          <Link to={HOME_PATH} className="examples-skip">
            דלג
            <LeftArrow />
          </Link>
        </header>

        <section className="examples-hero" aria-labelledby="examples-title">
          <h1 id="examples-title" className="examples-title">
            דוגמאות של סרטוני וידאו
            <br />
            ומודעות של 'אורי'
          </h1>
        </section>

        <section className="examples-section" aria-labelledby="examples-videos-heading">
          <h2 id="examples-videos-heading" className="examples-section-title">
            סרטוני וידאו
          </h2>
          <div className="examples-grid">
            {videos.map((item) => (
              <ExampleCard key={item.id} item={item} />
            ))}
          </div>
        </section>

        <section className="examples-section" aria-labelledby="examples-images-heading">
          <h2 id="examples-images-heading" className="examples-section-title">
            מודעות תמונה
          </h2>
          <div className="examples-grid">
            {images.map((item) => (
              <ExampleCard key={item.id} item={item} />
            ))}
          </div>
        </section>

        <div className="examples-enter-wrap">
          <Link to={HOME_PATH} className="examples-enter">
            כניסה לאורי
            <LeftArrow />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ExamplesPage
