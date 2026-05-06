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
        <Route path="/:museumSlug" element={<VisitSelect />} />
        <Route path="/:museumSlug/:visitSlug" element={<VisitRun />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
