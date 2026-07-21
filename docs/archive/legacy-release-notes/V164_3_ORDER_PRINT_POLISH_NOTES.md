# Phoenix Hibachi V164.3 — Order Age + Print Polish

No SQL required.

## Changes
- Admin order cards now show a right-side order age badge, based on created_at / createdAt / submitted_at fields.
  - Under 1 hour: minutes ago.
  - Under 24 hours: hours ago.
  - Under 30 days: days ago.
  - Older: submitted date with year when needed.
- V120 Modify time button is hidden because date/time editing is already inside Order details / edit.
- Print invoice now uses a cleaner one-page style:
  - centered on Letter page
  - less ink
  - lighter highlight colors
  - fewer heavy lines
  - larger than V164.1 so it fills the page better
  - still constrained to one page where possible
- Invoice footer that caused blank/extra pages is removed in generated invoice output.

## Test
1. Open Admin → Orders.
2. Confirm each order card shows an age badge such as “Received 2h ago”.
3. Confirm only Order details / edit shows, no separate Modify time button.
4. Print a high-item invoice and confirm Chrome preview says 1 page.
5. Confirm invoice is centered, larger, and cleaner.
