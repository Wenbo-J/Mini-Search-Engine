import Head from 'next/head';
import { useState, FormEvent } from 'react';
import useSearch from '../hooks/useSearch';
import SearchResultCard from '../components/SearchResultCard';

const ITEMS_PER_PAGE = 10;

export default function HomePage() {
  const [query, setQuery] = useState('');
  const { results, loading, error, search } = useSearch();

  const handleSearch = async (e?: FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    await search(query, ITEMS_PER_PAGE);
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <Head>
        <title>Quick Legal Retriever</title>
        <meta name="description" content="Search interface" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>Quick Legal Retriever</h1>

        <form onSubmit={handleSearch} style={{ display: 'flex', marginBottom: '20px' }}>
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
      </main>
    </div>
  );
}
