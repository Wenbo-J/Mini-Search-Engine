import React from 'react';
import useGlobalMetrics from '../hooks/useGlobalMetrics';

const MetricsDashboard: React.FC = () => {
  const { avgLatencyMs, cacheHitRate, loading, error, fetchMetrics, rawMetricsText } = useGlobalMetrics(30000); // Refresh every 30s

  const cardStyle: React.CSSProperties = {
    padding: '15px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    marginBottom: '20px',
  };

  const titleStyle: React.CSSProperties = {
    marginTop: 0,
    marginBottom: '10px',
    fontSize: '1.1em',
    color: '#333',
  };

  const metricItemStyle: React.CSSProperties = {
    margin: '5px 0',
    fontSize: '0.95em',
  };

  const errorStyle: React.CSSProperties = {
    color: 'red',
    fontSize: '0.9em',
  };
  
  const buttonStyle: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: '0.9em',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '10px',
  };

  if (loading && avgLatencyMs === null && cacheHitRate === null) { // Show loading only on initial fetch
    return <div style={cardStyle}><p>Loading global metrics...</p></div>;
  }

  return (
    <div style={cardStyle}>
      <h4 style={titleStyle}>Global Metrics</h4>
      {error && <p style={errorStyle}>Error fetching metrics: {error.message}</p>}
      
      {avgLatencyMs !== null ? (
        <p style={metricItemStyle}>
          Avg. Request Latency: <strong>{avgLatencyMs.toFixed(2)} ms</strong>
        </p>
      ) : (
        <p style={metricItemStyle}>Avg. Request Latency: N/A</p>
      )}
      
      {cacheHitRate !== null ? (
        <p style={metricItemStyle}>
          Cache Hit Rate: <strong>{(cacheHitRate * 100).toFixed(1)}%</strong>
        </p>
      ) : (
        <p style={metricItemStyle}>Cache Hit Rate: N/A</p>
      )}
      <button onClick={fetchMetrics} disabled={loading} style={buttonStyle}>
        {loading ? 'Refreshing...' : 'Refresh Metrics'}
      </button>
      {/* Uncomment to debug raw metrics output 
      <details>
        <summary>Raw Metrics Data</summary>
        <pre style={{ fontSize: '0.7em', maxHeight: '100px', overflowY: 'auto' }}>
          {rawMetricsText || 'No raw metrics data'}
        </pre>
      </details> 
      */}
    </div>
  );
};

export default MetricsDashboard; 