'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from './api';

export interface MasterOption {
  id: string;
  name: string;
  code: string;
  sort_order?: number;
}

/** Active, non-deleted entries of a master (e.g. /api/categories, /api/sizes) for dropdowns. */
export function useMasterDropdown(basePath: string) {
  const [items, setItems] = useState<MasterOption[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`${basePath}/dropdown`);
      setItems(Array.isArray(res?.success?.data) ? res.success.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => { reload(); }, [reload]);

  return { items, loading, reload };
}
