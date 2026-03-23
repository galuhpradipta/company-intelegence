import { createBrowserRouter } from 'react-router'
import { Layout } from './app/Layout.js'
import { InputPage } from './routes/InputPage.js'
import { ResultsPage } from './routes/ResultsPage.js'
import { CompanyDetailPage } from './routes/CompanyDetailPage.js'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <InputPage /> },
      { path: 'results/:batchId', element: <ResultsPage /> },
      { path: 'company/:companyId', element: <CompanyDetailPage /> },
    ],
  },
])
