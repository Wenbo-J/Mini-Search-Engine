import Head from 'next/head';
import { useState, FormEvent } from 'react';
import useSearch from '../hooks/useSearch';
import SearchResultCard from '../components/SearchResultCard';

const ITEMS_PER_PAGE = 10;

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { results, totalResults, loading, error, avgLatencyMs, cacheHitRate, search } = useSearch();

  const handleSearch = async (e?: FormEvent<HTMLFormElement>, page: number = 1) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setCurrentPage(page);
    await search(query, page, ITEMS_PER_PAGE);
  };

  const totalPages = Math.ceil(totalResults / ITEMS_PER_PAGE);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
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
          <button type="submit" disabled={loading || !query.trim()} style={{ padding: '10px 15px', fontSize: '16px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '0 4px 4px 0', cursor: 'pointer' }}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Metrics Display */}
        { !loading && !error && (avgLatencyMs !== undefined || cacheHitRate !== undefined) && results.length > 0 && (
          <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #eee', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
            <h4 style={{marginTop: 0, marginBottom: '5px'}}>Metrics:</h4>
            {/* avgLatencyMs is a placeholder in backend, will show 0.00ms for now */}
            {avgLatencyMs !== undefined && <p style={{margin: '2px 0'}}>Avg. Request Latency: {avgLatencyMs.toFixed(2)}ms</p>}
            {cacheHitRate !== undefined && <p style={{margin: '2px 0'}}>Cache Hit Rate: {(cacheHitRate * 100).toFixed(1)}%</p>}
          </div>
        )}

        {error && (
          <div style={{ color: 'red', border: '1px solid red', padding: '10px', marginBottom: '20px', borderRadius: '4px' }}>
            <p><strong>Error:</strong> {error.message}</p>
          </div>
        )}

        {loading && <p style={{ textAlign: 'center' }}>Loading results...</p>}

        {!loading && !error && results.length === 0 && query && (
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
              disabled={currentPage <= 1 || loading}
              style={{ padding: '8px 12px', margin: '0 5px', cursor: 'pointer' }}
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => handleSearch(undefined, currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              style={{ padding: '8px 12px', margin: '0 5px', cursor: 'pointer' }}
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
