import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import ErrorBoundary from './ErrorBoundary';

import * as serviceWorkerRegistration from './workers/serviceWorkerRegistration';

const App = lazy(()=>import('./App'))

const root = createRoot(document.getElementById('root'));
const loading = <Loading />
root.render(
  <StrictMode>
    <Suspense fallback={loading}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </Suspense>
  </StrictMode>
);

function Loading(props) {
  return (
    <div>
      <div className="navinit">
        <nav>
          <span>MilleGrilles</span>
        </nav>
      </div>

      <p className="titleinit">Preparation de Messagerie</p>
      <p>Veuillez patienter durant le chargement de l'application.</p>
      <ol>
        <li>Initialisation</li>
        <li>Chargement des composants dynamiques</li>
      </ol>
    </div>
  )
}

serviceWorkerRegistration.register();

// import React from 'react';
// import ReactDOM from 'react-dom';

// // Importer JS global
// import 'react-bootstrap/dist/react-bootstrap.min.js'

// // Importer cascade CSS global
// import 'bootstrap/dist/css/bootstrap.min.css'
// import 'font-awesome/css/font-awesome.min.css'
// import 'react-quill/dist/quill.snow.css'
// import './index.css'

// import App from './App'

// ReactDOM.render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>,
//   document.getElementById('root')
// )
