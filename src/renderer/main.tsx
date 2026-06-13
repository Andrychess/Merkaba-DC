import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import '@shared/merkaba-api';
import { applyTheme, getCachedTheme } from './lib/applyTheme';

applyTheme(getCachedTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
