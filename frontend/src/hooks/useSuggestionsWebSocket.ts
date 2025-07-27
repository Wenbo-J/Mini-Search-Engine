import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseSuggestionsWebSocketResult {
  suggestions: string[];
  loading: boolean;
  error: string | null;
  sendPrefix: (prefix: string) => void;
  connected: boolean;
}

const SUGGESTION_WS_URL = (() => {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}/ws/suggestions`;
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
    if (!SUGGESTION_WS_URL) return;
    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let closedByUser = false;

    function connect() {
      ws = new WebSocket(SUGGESTION_WS_URL);
      wsRef.current = ws;
      setConnected(false);
      setError(null);

      ws.onopen = () => {
        setConnected(true);
        setError(null);
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closedByUser) {
          // Try to reconnect after a short delay
          reconnectTimeout = setTimeout(connect, 1000);
        }
      };
      ws.onerror = (e) => {
        setError('WebSocket error');
        ws.close();
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.suggestions) {
            setSuggestions(data.suggestions);
            setLoading(false);
          } else if (data.error) {
            setError(data.error);
            setLoading(false);
          }
        } catch (err) {
          setError('Failed to parse suggestions');
          setLoading(false);
        }
      };
    }
    connect();
    return () => {
      closedByUser = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      wsRef.current?.close();
    };
  }, []);

  // Debounced sendPrefix
  const sendPrefix = useCallback((prefix: string) => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    setLoading(true);
    debounceTimeout.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ prefix }));
          lastPrefix.current = prefix;
        } catch (err) {
          setError('Failed to send prefix');
          setLoading(false);
        }
      } else {
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