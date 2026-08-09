/**
 * Safe async data-fetching hook.
 *
 * - Uses AbortController so that pending requests are cancelled when the
 *   component unmounts (e.g. user navigates backward / exits the page).
 * - Tracks a "mounted" flag so set-state calls are skipped after unmount,
 *   eliminating the "Can't perform a React state update on an unmounted
 *   component" warning that causes errors during rapid navigation.
 * - Provides consistent loading / error / data states across every page.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { AxiosRequestConfig } from 'axios';
import api from '../services/api';
import toast from 'react-hot-toast';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useAsyncData<T = any>(
  url: string,
  options?: AxiosRequestConfig
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  // Track whether the component is still mounted so we never call
  // setState after unmount (the root cause of the backward/exit error).
  const mountedRef = useRef(true);
  // Hold the currently-active AbortController so unmount/refetch always
  // cancels the in-flight request, even before its promise resolves.
  const controllerRef = useRef<AbortController | null>(null);

  const runFetch = useCallback(
    (signal: AbortSignal) => {
      return api
        .get<T>(url, { ...options, signal })
        .then((response) => {
          if (mountedRef.current && !signal.aborted) {
            setState({ data: response.data, loading: false, error: null });
          }
        })
        .catch((err: any) => {
          // Ignore abort errors — they happen intentionally when the user
          // navigates away before the request completes.
          if (err.name === 'CanceledError' || err.name === 'AbortError') {
            return;
          }
          if (mountedRef.current && !signal.aborted) {
            const message =
              err.response?.data?.message ||
              err.message ||
              'Failed to fetch data';
            setState({ data: null, loading: false, error: message });
          }
        });
    },
    [url]
  );

  useEffect(() => {
    mountedRef.current = true;

    // Cancel any request from a previous URL before starting a new one.
    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;
    const signal = controller.signal;

    setState((prev) => ({ ...prev, loading: true, error: null }));
    runFetch(signal);

    return () => {
      mountedRef.current = false;
      controller.abort();
      controllerRef.current = null;
    };
  }, [runFetch]);

  const refetch = useCallback(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    runFetch(controller.signal);
  }, [runFetch]);

  return { ...state, refetch };
}

/**
 * Fetches multiple endpoints in parallel with proper cancellation and
 * mount-state guards.  Use this for pages like Dashboard that need
 * several independent GETs at once.
 */
export function useParallelFetch<T extends Record<string, any>>(
  requests: Array<{ key: string; url: string; options?: AxiosRequestConfig }>
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchAll = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const promises = requests.map((req) =>
          api.get(req.url, { ...req.options, signal })
        );
        const results = await Promise.all(promises);

        if (mountedRef.current && !signal?.aborted) {
          const mapped = results.reduce((acc: any, res, idx) => {
            acc[requests[idx].key] = res.data;
            return acc;
          }, {} as T);
          setData(mapped);
          setLoading(false);
          setError(null);
        }
      } catch (err: any) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') {
          return;
        }
        if (mountedRef.current && !signal?.aborted) {
          const message =
            err.response?.data?.message ||
            err.message ||
            'Failed to fetch data';
          setError(message);
          setLoading(false);
        }
      }
    },
    // requests array identity is stable in most component trees.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requests.map((r) => r.url).join(',')]
  );

  useEffect(() => {
    mountedRef.current = true;
    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    fetchAll(controller.signal);

    return () => {
      mountedRef.current = false;
      controller.abort();
      controllerRef.current = null;
    };
  }, [fetchAll]);

  const refetch = useCallback(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    fetchAll(controller.signal);
  }, [fetchAll]);

  return { data, loading, error, refetch } as const;
}

/**
 * Hook for safe POST / PATCH / DELETE operations that respects
 * component mount state and request cancellation.
 */
export function useAsyncMutation() {
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const mutate = useCallback(
    async (
      url: string,
      method: 'POST' | 'PATCH' | 'DELETE' | 'PUT' = 'POST',
      data?: any,
      options?: AxiosRequestConfig
    ) => {
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const response = await api.request({
          url,
          method,
          data,
          ...options,
          signal: controller.signal,
        });

        if (!mountedRef.current || controller.signal.aborted) {
          return null;
        }

        return response.data;
      } catch (err: any) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') {
          return null;
        }

        const message =
          err.response?.data?.message ||
          err.message ||
          'Operation failed';

        if (mountedRef.current && !controller.signal.aborted) {
          toast.error(message);
        }

        throw err;
      }
    },
    []
  );

  return mutate;
}
