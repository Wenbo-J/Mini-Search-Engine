import React from 'react';
import { SearchResult } from '../hooks/useSearch'; // Assuming SearchResult is exported from useSearch

interface SearchResultCardProps {
  result: SearchResult;
}

const SearchResultCard: React.FC<SearchResultCardProps> = ({ result }) => {
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '8px' }}>{result.title}</h3>
      <p style={{ fontStyle: 'italic', color: '#555', fontSize: '0.9em' }}>
        Court: {result.court} | Date: {result.date} | Score: {result.score.toFixed(2)}
      </p>
      <p dangerouslySetInnerHTML={{ __html: result.snippet }} />
      {/* result.snippet should be sanitized to prevent XSS attacks */}
    </div>
  );
};

export default SearchResultCard;
