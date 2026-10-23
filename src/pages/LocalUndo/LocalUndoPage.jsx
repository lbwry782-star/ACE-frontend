import { useEffect } from 'react'
import DevLocalControl from '../../components/DevLocalControl/DevLocalControl.jsx'

const pageStyle = {
  minHeight: '100vh',
  margin: 0,
  background: 'Canvas',
  color: 'CanvasText',
  colorScheme: 'light dark',
  overflow: 'hidden'
}

function LocalUndoPage() {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const previous = {
      htmlBg: html.style.background,
      htmlScheme: html.style.colorScheme,
      bodyBg: body.style.background,
      bodyColor: body.style.color,
      bodyScheme: body.style.colorScheme
    }
    html.style.background = 'Canvas'
    html.style.colorScheme = 'light dark'
    body.style.background = 'Canvas'
    body.style.color = 'CanvasText'
    body.style.colorScheme = 'light dark'
    return () => {
      html.style.background = previous.htmlBg
      html.style.colorScheme = previous.htmlScheme
      body.style.background = previous.bodyBg
      body.style.color = previous.bodyColor
      body.style.colorScheme = previous.bodyScheme
    }
  }, [])

  return (
    <div style={pageStyle} data-ace-undo-shell="true">
      <DevLocalControl />
    </div>
  )
}

export default LocalUndoPage
