import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PublicForm from './PublicForm.tsx'

// Route đơn giản: /form → PublicForm, còn lại → App quản trị
const isPublicForm = window.location.pathname === '/form' || window.location.pathname === '/form/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPublicForm ? <PublicForm /> : <App />}
  </StrictMode>,
)
