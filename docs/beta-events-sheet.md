# Beta event log: Google Sheet destination

`BETA_EVENTS_WEBHOOK_URL` needs somewhere durable to land. A Google Sheet with an
Apps Script web app is free and gives the grant reviewers a log they can open.
It keeps two tabs:

- **raw**: append-only. One row per event: the time received and the complete
  JSON exactly as the app sent it (including the app's own `raw` copy of the
  browser request). Never edited by hand; protect the tab.
- **events**: the same events spread into columns, for filtering and counting.
  This one is a convenience view. If it ever disagrees with `raw`, `raw` wins.

## Set up (about 5 minutes)

1. Create a Google Sheet, e.g. "BitYield beta events".
2. Extensions > Apps Script. Replace the contents with the script below.
3. Deploy > New deployment > type **Web app**. Execute as **Me**, who has access:
   **Anyone**. Copy the web app URL.
4. Put that URL in `BETA_EVENTS_WEBHOOK_URL` (Vercel, Production) and redeploy.
5. In the sheet, right-click the **raw** tab > Protect sheet, so only you can edit it.
6. Test: open `https://bityield.click/?ref=test` in a private window. A `visit`
   row should appear in both tabs within a few seconds.

Treat the web app URL like a secret: anyone who has it can append rows.

```js
const EVENT_COLUMNS = [
  'at', 'type', 'ref', 'wallet', 'visitorId', 'strategy', 'amountSats', 'positionId', 'txid', 'reason',
  'clientAt', 'path', 'firstSeenAt', 'firstRef', 'firstReferrer', 'firstUtmSource', 'firstUtmMedium',
  'firstUtmCampaign', 'isReturning', 'visitCount', 'landingPath', 'referrer', 'utmSource', 'utmMedium',
  'utmCampaign', 'country', 'userAgent',
];

function sheet_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    sh.setFrozenRows(1);
  }
  return sh;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const body = e.postData.contents; // the event JSON, exactly as received
    const ev = JSON.parse(body);
    sheet_('raw', ['receivedAt', 'json']).appendRow([new Date().toISOString(), body]);
    sheet_('events', EVENT_COLUMNS).appendRow(EVENT_COLUMNS.map((c) => (ev[c] === undefined ? '' : ev[c])));
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}
```

## What each event means

| type | fires when | notes |
|---|---|---|
| `visit` | once per browser session, on the first page load | `isReturning` / `visitCount` show repeat visits; `referrer` and `utm*` show where they came from |
| `wallet_connected` | a wallet connects | links `visitorId` to a wallet address |
| `deposit_attempted` / `_completed` / `_failed` | deposit flow | `txid` on completion; `reason` on failure |
| `withdraw_attempted` / `_completed` / `_failed` | withdraw flow | `positionId` identifies the position |

`ref` is the invite code as captured in the browser (it can be replaced if the
visitor later arrives through a different invite link). `firstRef`,
`firstReferrer` and `firstSeenAt` are written once, the first time that browser
ever loads the site, and never change. `visitorId` is a random id stored in the
browser; it is not derived from anything personal, but once a wallet connects it
links that browser's visits to that wallet, so say so in any privacy notice.

## Keeping the log trustworthy

- Do not edit or delete rows in **raw**. Fix mistakes by adding a note elsewhere.
- Download a snapshot (File > Download > CSV) weekly and keep it, so the history
  survives an accidental change.
- On-chain data is the source of truth for deposits and withdrawals. The events
  add context (source, visits, funnel steps) and should be reconciled against it.
- Funding independence is checked from the chain, not from events:
  `node contracts/scripts/funding-report.mjs --json report.json`.
