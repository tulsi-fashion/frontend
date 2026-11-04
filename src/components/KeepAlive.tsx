'use client';

import { useEffect } from 'react';

export default function KeepAlive() {
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_API_URL;
    if (!url) return;

    const ping = () => {
      fetch(`${url}/`, { method: 'GET', cache: 'no-store' }).catch(() => {});
    };

    ping();
    const id = setInterval(ping, 60_000);
    return () => clearInterval(id);
  }, []);

  return null;
}
