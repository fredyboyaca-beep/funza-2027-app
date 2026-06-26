import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { AppLayout } from './layouts/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Electoral } from './pages/Electoral';
import { Mapa } from './pages/Mapa';
import { Territorio } from './pages/Territorio';
import { Ciudadanos } from './pages/Ciudadanos';
import { Problematicas } from './pages/Problematicas';
import { Simulador } from './pages/Simulador';
import { IA } from './pages/IA';
import { InteligenciaTerritorial } from './pages/InteligenciaTerritorial';

function currentPage() {
  return window.location.hash.replace('#', '') || 'dashboard';
}

function App() {
  const [page, setPageState] = useState(currentPage());
  const pages: any = {
    dashboard: <Dashboard />,
    electoral: <Electoral />,
    mapa: <Mapa />,
    territorio: <Territorio />,
    inteligencia: <InteligenciaTerritorial />,
    ciudadanos: <Ciudadanos />,
    problematicas: <Problematicas />,
    simulador: <Simulador />,
    ia: <IA />,
  };

  useEffect(() => {
    const syncHash = () => setPageState(currentPage());
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const setPage = (next: string) => {
    window.location.hash = next;
    setPageState(next);
  };

  return <AppLayout setPage={setPage}>{pages[page] || pages.dashboard}</AppLayout>;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
