import { useNavigate, useSearchParams } from 'react-router'
import { SingleCompanyForm } from '../features/company-input/SingleCompanyForm.js'
import { CsvUpload } from '../features/csv-upload/CsvUpload.js'
import { ViewerCompanyContextCard } from '../features/relevancy/ViewerCompanyContextCard.js'

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
        <h1 className="font-display text-2xl font-medium text-app-text mb-2 tracking-tight">Resolve Companies</h1>
        <p className="text-app-text-muted text-sm leading-relaxed">
          Enter a company to resolve it against external data sources, fetch news, and score relevancy.
        </p>
      </div>

      <ViewerCompanyContextCard />

      {/* Tab toggle */}
      <div role="tablist" aria-label="Input mode" className="flex bg-stone-100 rounded-lg p-1 mb-6 w-fit">
        <button
          role="tab"
          aria-selected={tab === 'single'}
          onClick={() => updateTab('single')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'single'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          Single Company
        </button>
        <button
          role="tab"
          aria-selected={tab === 'csv'}
          onClick={() => updateTab('csv')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'csv'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
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
