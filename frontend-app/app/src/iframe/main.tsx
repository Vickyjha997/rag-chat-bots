import React from 'react'
import ReactDOM from 'react-dom/client'
import { WidgetApp } from './widget/WidgetApp'
import './widget/chat-widget.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WidgetApp />
  </React.StrictMode>,
)

