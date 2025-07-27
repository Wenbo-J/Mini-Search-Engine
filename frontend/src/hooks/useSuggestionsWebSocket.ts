import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseSuggestionsWebSocketResult {
  suggestions: string[];
  loading: boolean;
  error: string | null;
  sendPrefix: (prefix: string) => void;
  connected: boolean;
}

// Connect directly to the backend WebSocket endpoint
const SUGGESTION_WS_URL = (() => {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    // Connect directly to the backend server
    return `${protocol}://localhost:8000/ws/suggestions`;
  }
  return '';
})();

export default function useSuggestionsWebSocket(debounceMs: number = 120): UseSuggestionsWebSocketResult {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastPrefix = useRef<string>('');

  // Connect WebSocket
  useEffect(() => {
    if (!SUGGESTION_WS_URL) {
      console.error('SUGGESTION_WS_URL is empty');
      return;
    }
    
    console.log('Attempting to connect to WebSocket:', SUGGESTION_WS_URL);
    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let closedByUser = false;

    function connect() {
      try {
        ws = new WebSocket(SUGGESTION_WS_URL);
        wsRef.current = ws;
        setConnected(false);
        setError(null);

        ws.onopen = () => {
          console.log('WebSocket connected successfully');
          setConnected(true);
          setError(null);
        };
        
        ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          setConnected(false);
          if (!closedByUser) {
            console.log('Attempting to reconnect...');
            reconnectTimeout = setTimeout(connect, 1000);
          }
        };
        
        ws.onerror = (e) => {
          console.error('WebSocket error:', e);
          setError('WebSocket connection failed');
        };
        
        ws.onmessage = (event) => {
          console.log('Received WebSocket message:', event.data);
          try {
            const data = JSON.parse(event.data);
            if (data.suggestions) {
              console.log('Setting suggestions:', data.suggestions);
              setSuggestions(data.suggestions);
              setLoading(false);
            } else if (data.error) {
              console.error('Server error:', data.error);
              setError(data.error);
              setLoading(false);
            }
          } catch (err) {
            console.error('Failed to parse suggestions:', err);
            setError('Failed to parse suggestions');
            setLoading(false);
          }
        };
      } catch (err) {
        console.error('Failed to create WebSocket:', err);
        setError('Failed to create WebSocket connection');
      }
    }
    
    connect();
    
    return () => {
      console.log('Cleaning up WebSocket connection');
      closedByUser = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Debounced sendPrefix
  const sendPrefix = useCallback((prefix: string) => {
    console.log('sendPrefix called with:', prefix);
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    setLoading(true);
    debounceTimeout.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          const message = JSON.stringify({ prefix });
          console.log('Sending WebSocket message:', message);
          wsRef.current.send(message);
          lastPrefix.current = prefix;
        } catch (err) {
          console.error('Failed to send prefix:', err);
          setError('Failed to send prefix');
          setLoading(false);
        }
      } else {
        console.log('WebSocket not ready, state:', wsRef.current?.readyState);
        setLoading(false);
      }
    }, debounceMs);
  }, [debounceMs]);

  // Clear suggestions if prefix is empty
  useEffect(() => {
    if (lastPrefix.current === '') {
      setSuggestions([]);
      setLoading(false);
    }
  }, [lastPrefix.current]);

  return { suggestions, loading, error, sendPrefix, connected };
} 