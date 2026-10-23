import DevLocalControl from '../../components/DevLocalControl/DevLocalControl.jsx'

const pageStyle = {
  minHeight: '100vh',
  margin: 0,
  background: '#121214',
  overflow: 'hidden'
}

function LocalUndoPage() {
  return (
    <div style={pageStyle} data-ace-undo-shell="true">
      <DevLocalControl />
    </div>
  )
}

export default LocalUndoPage
