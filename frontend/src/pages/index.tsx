import Head from 'next/head';
import { useState, FormEvent, useEffect } from 'react';
import useSearch from '../hooks/useSearch';
import SearchResultCard from '../components/SearchResultCard';
import MetricsDashboard from '../components/MetricsDashboard';
import useGlobalMetrics from '../hooks/useGlobalMetrics';

const ITEMS_PER_PAGE = 10;

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { results, totalResults, loading: searchLoading, error: searchError, search } = useSearch();
  const { fetchMetrics: refreshGlobalMetrics } = useGlobalMetrics(null);

  const handleSearch = async (e?: FormEvent<HTMLFormElement>, page: number = 1) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setCurrentPage(page);
    await search(query, page, ITEMS_PER_PAGE);
    refreshGlobalMetrics();
  };

  const totalPages = Math.ceil(totalResults / ITEMS_PER_PAGE);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '1000px', margin: '0 auto', padding: '20px', display: 'flex', gap: '20px' }}>
      <div style={{ flex: 3 }}>
        <Head>
          <title>Quick Legal Retriever</title>
          <meta name="description" content="Search interface" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <main>
          <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>Quick Legal Retriever</h1>

          <form onSubmit={(e) => handleSearch(e, 1)} style={{ display: 'flex', marginBottom: '20px' }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your search query..."
              style={{ flexGrow: 1, padding: '10px', fontSize: '16px', border: '1px solid #ccc', borderRadius: '4px 0 0 4px' }}
            />
            <button type="submit" disabled={searchLoading || !query.trim()} style={{ padding: '10px 15px', fontSize: '16px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '0 4px 4px 0', cursor: 'pointer' }}>
              {searchLoading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searchError && (
            <div style={{ color: 'red', border: '1px solid red', padding: '10px', marginBottom: '20px', borderRadius: '4px' }}>
              <p><strong>Search Error:</strong> {searchError.message}</p>
            </div>
          )}

          {searchLoading && <p style={{ textAlign: 'center' }}>Loading results...</p>}

          {!searchLoading && !searchError && results.length === 0 && query && (
            <p style={{ textAlign: 'center' }}>No results found for "{query}". Try a different search.</p>
          )}

          <div>
            {results.map((result) => (
              <SearchResultCard key={result.id} result={result} />
            ))}
          </div>

          {totalResults > 0 && totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '20px' }}>
              <button
                onClick={() => handleSearch(undefined, currentPage - 1)}
                disabled={currentPage <= 1 || searchLoading}
                style={{ padding: '8px 12px', margin: '0 5px', cursor: 'pointer' }}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handleSearch(undefined, currentPage + 1)}
                disabled={currentPage >= totalPages || searchLoading}
                style={{ padding: '8px 12px', margin: '0 5px', cursor: 'pointer' }}
              >
                Next
              </button>
            </div>
          )}
        </main>
      </div>
      <aside style={{ flex: 1, paddingTop: '100px' }}>
        <MetricsDashboard />
      </aside>
    </div>
  );
}
