import Head from 'next/head';
import { useState, FormEvent, useRef } from 'react';
import useSearch from '../hooks/useSearch';
import SearchResultCard from '../components/SearchResultCard';
import MetricsDashboard from '../components/MetricsDashboard';
import useGlobalMetrics from '../hooks/useGlobalMetrics';
import useSuggestionsWebSocket from '../hooks/useSuggestionsWebSocket';

const ITEMS_PER_PAGE = 10;

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { results, totalResults, loading: searchLoading, error: searchError, search } = useSearch();
  const { fetchMetrics: refreshGlobalMetrics } = useGlobalMetrics(null);

  // Suggestions
  const {
    suggestions,
    loading: suggestionsLoading,
    error: suggestionsError,
    sendPrefix,
    connected: suggestionsConnected,
  } = useSuggestionsWebSocket(120);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle input change and send prefix for suggestions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(!!value);
    setHighlightedIndex(-1);
    sendPrefix(value);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    handleSearch(undefined, 1, suggestion);
    if (inputRef.current) inputRef.current.blur();
  };

  // Handle keyboard navigation
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSuggestionClick(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Hide suggestions on blur (with a small delay to allow click)
  const handleInputBlur = () => {
    setTimeout(() => setShowSuggestions(false), 100);
  };

  // Modified handleSearch to optionally accept a value
  const handleSearch = async (
    e?: FormEvent<HTMLFormElement>,
    page: number = 1,
    value?: string
  ) => {
    if (e) e.preventDefault();
    const searchValue = value !== undefined ? value : query;
    if (!searchValue.trim()) return;
    setCurrentPage(page);
    await search(searchValue, page, ITEMS_PER_PAGE);
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

          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <form onSubmit={(e) => handleSearch(e, 1)} style={{ display: 'flex' }} autoComplete="off">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                onBlur={handleInputBlur}
                placeholder="Enter your search query..."
                style={{ flexGrow: 1, padding: '10px', fontSize: '16px', border: '1px solid #ccc', borderRadius: '4px 0 0 4px' }}
                autoComplete="off"
                spellCheck={false}
                onFocus={() => setShowSuggestions(!!query)}
              />
              <button type="submit" disabled={searchLoading || !query.trim()} style={{ padding: '10px 15px', fontSize: '16px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '0 4px 4px 0', cursor: 'pointer' }}>
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
            </form>
            {/* Suggestions Dropdown */}
            {showSuggestions && (suggestionsLoading || suggestions.length > 0) && (
              <ul
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  border: '1px solid #ccc',
                  borderTop: 'none',
                  borderRadius: '0 0 4px 4px',
                  zIndex: 10,
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              >
                {suggestionsLoading && (
                  <li style={{ padding: '10px', color: '#888' }}>Loading suggestions...</li>
                )}
                {suggestions.map((s, i) => (
                  <li
                    key={s}
                    onMouseDown={() => handleSuggestionClick(s)}
                    style={{
                      padding: '10px',
                      background: i === highlightedIndex ? '#f0f4ff' : 'white',
                      cursor: 'pointer',
                      fontWeight: i === highlightedIndex ? 600 : 400,
                    }}
                  >
                    {s}
                  </li>
                ))}
                {suggestionsError && (
                  <li style={{ padding: '10px', color: 'red' }}>{suggestionsError}</li>
                )}
                {!suggestionsLoading && suggestions.length === 0 && !suggestionsError && (
                  <li style={{ padding: '10px', color: '#888' }}>No suggestions</li>
                )}
              </ul>
            )}
          </div>

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
