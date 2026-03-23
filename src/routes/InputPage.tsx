import { useNavigate, useSearchParams } from 'react-router'
import { SingleCompanyForm } from '../features/company-input/SingleCompanyForm.js'
import { CsvUpload } from '../features/csv-upload/CsvUpload.js'

export function InputPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  function handleResolved(companyId: string) {
    navigate(`/company/${companyId}`)
  }

  function handleBatchCreated(batchId: string) {
    navigate(`/results/${batchId}`)
  }

  const initialValues = {
    companyName: searchParams.get('companyName') ?? '',
    domain: searchParams.get('domain') ?? '',
    address: searchParams.get('address') ?? '',
    city: searchParams.get('city') ?? '',
    state: searchParams.get('state') ?? '',
    country: searchParams.get('country') ?? 'US',
    industry: searchParams.get('industry') ?? '',
  }
  const tab = searchParams.get('tab') === 'csv' ? 'csv' : 'single'
  const singleFormKey = JSON.stringify(initialValues)

  function updateTab(nextTab: 'single' | 'csv') {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', nextTab)
    setSearchParams(nextParams, { replace: true })
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
          onClick={() => updateTab('single')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'single'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Single Company
        </button>
        <button
          onClick={() => updateTab('csv')}
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
        <SingleCompanyForm
          key={singleFormKey}
          onResolved={handleResolved}
          initialValues={initialValues}
        />
      ) : (
        <CsvUpload onBatchCreated={handleBatchCreated} />
      )}
    </div>
  )
}
