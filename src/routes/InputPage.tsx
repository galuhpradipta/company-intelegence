import { useState } from 'react'
import { useNavigate } from 'react-router'
import { SingleCompanyForm } from '../features/company-input/SingleCompanyForm.js'
import { CsvUpload } from '../features/csv-upload/CsvUpload.js'

export function InputPage() {
  const [tab, setTab] = useState<'single' | 'csv'>('single')
  const navigate = useNavigate()

  function handleResolved(companyId: string) {
    navigate(`/company/${companyId}`)
  }

  function handleBatchCreated(batchId: string) {
    navigate(`/results/${batchId}`)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Resolve Companies</h1>
        <p className="text-gray-500 text-sm">
          Enter a company to resolve it against external data sources, fetch news, and score relevancy.
        </p>
      </div>

      {/* Tab toggle */}
      <div className="flex bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => setTab('single')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'single'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Single Company
        </button>
        <button
          onClick={() => setTab('csv')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'csv'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          CSV Upload
        </button>
      </div>

      {tab === 'single' ? (
        <SingleCompanyForm onResolved={handleResolved} />
      ) : (
        <CsvUpload onBatchCreated={handleBatchCreated} />
      )}
    </div>
  )
}
