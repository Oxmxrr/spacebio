import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tailwind.css'; // <- your single Tailwind entry
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
