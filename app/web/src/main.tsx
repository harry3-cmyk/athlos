import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import { LOCAL } from './lib/api';
import './styles.css';

// Hébergement statique : routage par ancre (#/…), qui survit au rechargement sans configuration serveur.
const Router = LOCAL ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
);
