import React from 'react';
import NextLink from 'next/link'; // Import NextLink for client-side navigation
import { SearchResult } from '../hooks/useSearch'; // Assuming SearchResult is exported from useSearch

interface SearchResultCardProps {
  result: SearchResult;
}

const SearchResultCard: React.FC<SearchResultCardProps> = ({ result }) => {
  // Basic styling for the clickable card
  const cardStyle: React.CSSProperties = {
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
    display: 'block', // Make the whole area of the link clickable
    textDecoration: 'none', // Remove underline from link
    color: 'inherit', // Inherit text color
    cursor: 'pointer', // Change cursor to pointer
  };

  const hoverStyle: React.CSSProperties = {
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)', // Add a subtle shadow on hover
  };

  // State for hover (optional, can also be done with CSS :hover)
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    // Use NextLink for client-side navigation to a potential document page
    // The href is a placeholder for now, as the actual document page isn't built yet.
    <NextLink href={`/doc/${result.id}`} passHref legacyBehavior>
      <a 
        style={{ ...cardStyle, ...(isHovered ? hoverStyle : {}) }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        // Consider adding target="_blank" rel="noopener noreferrer" if you want to open in a new tab
      >
        <h3 style={{ marginTop: 0, marginBottom: '8px' }}>{result.title}</h3>
        <p style={{ fontStyle: 'italic', color: '#555', fontSize: '0.9em' }}>
          Court: {result.court} | Date: {result.date} | Score: {result.score.toFixed(2)}
        </p>
        <p dangerouslySetInnerHTML={{ __html: result.snippet }} />
        {/* result.snippet should be sanitized to prevent XSS attacks */}
      </a>
    </NextLink>
  );
};

export default SearchResultCard;
