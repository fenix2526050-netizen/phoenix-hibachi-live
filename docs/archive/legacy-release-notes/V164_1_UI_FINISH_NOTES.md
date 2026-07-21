# Phoenix OS V164.1 UI Finish Notes

This patch does not require a new Supabase SQL migration.

Fixes included:

1. Admin order tools
   - Hides the duplicate `Modify time` action.
   - Renames `Order details` to `Order details / edit`.
   - Keeps date/time editing inside the details panel.
   - Prevents admin/dashboard action bars from sticking over content while scrolling.

2. Order details clarity
   - Adds a `Food / proteins` line into the staff order details panel.
   - Rewords protein output so customers/staff do not see confusing `160/160 portions` text.

3. Invoice print
   - Forces one-page compact invoice print mode for Chrome print preview.
   - Hides the small red automated footer in print because it was creating a nearly blank second page.
   - Keeps invoice branding, logo, watermark, payment ledger, coupon/gift-card/wallet placeholders.

4. System popups
   - Replaces raw browser `alert()` with a centered Phoenix-styled modal alert.
   - Keeps confirm/delete browser behavior unchanged to avoid breaking destructive-action confirmations.

Test after upload:

- Open Admin Dashboard.
- Open an order details panel.
- Confirm there is no separate visible Modify Time button.
- Confirm date/time editor is inside Order details / edit.
- Print invoice and check Chrome preview says 1 page.
- Save profile/contact and confirm the popup uses the Phoenix-styled centered modal.
