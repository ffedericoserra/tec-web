import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomeNoLogin from './pages/HomeNoLogin.jsx';
import Museums from './pages/Museums.jsx';
import VisitSelect from './pages/VisitSelect.jsx';
import VisitRun from './pages/VisitRun.jsx';
import './styles/base.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeNoLogin />} />
        <Route path="/museums" element={<Museums />} />
        {/* Group visits are addressed by session code, not by museum/visit slug:
            a student joins with a code and shouldn't have to know either. It's
            the same runner component in session mode. Declared before the
            two-segment slug route so /session/:code can't be read as a museum. */}
        <Route path="/session/:sessionCode" element={<VisitRun />} />
        <Route path="/:museumSlug" element={<VisitSelect />} />
        <Route path="/:museumSlug/:visitSlug" element={<VisitRun />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
