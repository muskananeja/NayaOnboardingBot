import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

/** Redirects to /login if there's no valid admin session. Returns whether the check has finished and passed. */
export function useAdminGuard(): { checked: boolean; allowed: boolean } {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d.admin) {
          setAllowed(true);
          setChecked(true);
        } else {
          router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
        }
      })
      .catch(() => {
        if (!cancelled) router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { checked, allowed };
}
