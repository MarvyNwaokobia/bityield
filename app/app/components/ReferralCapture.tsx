'use client';

import { useEffect } from 'react';
import { captureReferralFromUrl } from '@/lib/track';

/** Renders nothing — just captures a `?ref=` beta invite code into
 *  localStorage on first load of any page. See lib/track.ts. */
export function ReferralCapture() {
  useEffect(() => {
    captureReferralFromUrl();
  }, []);
  return null;
}
