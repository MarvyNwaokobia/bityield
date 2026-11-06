'use client';

import { useEffect } from 'react';
import { captureReferralFromUrl, trackVisit } from '@/lib/track';

/** Renders nothing. On first load of any page it captures a `?ref=` beta invite
 *  code and the visitor's first-touch source into localStorage, and logs one
 *  `visit` event per browser session. See lib/track.ts. */
export function ReferralCapture() {
  useEffect(() => {
    captureReferralFromUrl();
    trackVisit();
  }, []);
  return null;
}
