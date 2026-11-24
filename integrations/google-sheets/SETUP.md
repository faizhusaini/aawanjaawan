# Connect Google Sheets and get your website URL

This version runs the whole website on Google Apps Script. Google hosts the website and stores requests in your Google Sheet. You do not need to run the Python server or buy separate website hosting.

## One-time setup (in your Google account)

1. Create a blank Google Sheet named **Aawan Jaawan Community**. Keep the sheet's sharing setting **Restricted**; website visitors do not need sheet access.
2. In the sheet choose **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` with the contents of this folder's `Code.gs` file.
4. Click **+ → HTML**, name it **Index** (capital I), and replace its contents with this folder's `Index.html` file.
5. Save. Select **setup** in the function dropdown and click **Run**. Review and authorize the requested spreadsheet access. The script creates a **Posts** tab and its column headings automatically.
6. Choose **Deploy → New deployment → Web app**.
7. Set **Execute as: Me**. Choose the visitor access you want. For a link that works for community members without Google sign-in, select **Anyone**, if your account permits it. This makes the website and its post/contact data accessible to anyone with its URL; the underlying spreadsheet remains restricted. If your Workspace administrator disallows this option, ask them about permitted access.
8. Click **Deploy**, authorize if prompted, and copy the **Web app URL** ending in `/exec`. That is the website URL to share with your community. The `/dev` testing link is for script editors, not your community.

Your Google authorization must be done by you. No Google credentials or API keys need to be pasted into this repository or the website.

## Try it before sharing

- Open the `/exec` URL. The shared board starts empty, with no fictional demo posts.
- Post a trip with a future date and your WhatsApp number. Confirm a row appears in **Posts**.
- Open the URL on another browser/device. The same trip should appear.
- Edit its note in the sheet. Refresh the page or wait up to 30 seconds for the board to update.
- Set its **status** to `completed` or `cancelled`. It disappears from the board on the next refresh, but the row remains in the sheet.
- Click **Connect** and confirm the WhatsApp recipient is correct.

## Managing posts

Columns are created automatically:

`id | name | phone | route | date | mode | help | note | type | created | status`

- **route:** `lko` means Lucknow → Hyderabad; `hyd` means Hyderabad → Lucknow.
- **date:** `YYYY-MM-DD`, for example `2026-12-20`. India time determines which trips are past.
- **type:** `trip` or `request`.
- **status:** `active` shows on the board; `completed` or `cancelled` hides it.
- Keep phone numbers as plain text, including the country code.
- Edit dates, notes, names, or status directly in the sheet. Do not rename/reorder column headings. Leave IDs and created timestamps unchanged.
- Older trips are hidden automatically; rows stay available in the sheet.
- Existing SQLite or browser-local posts are not automatically migrated.

## Updating the design or code

Run `python3 build.py` to regenerate `Index.html` from the website source. Paste the updated generated HTML and/or `Code.gs` into Apps Script, save, then use **Deploy → Manage deployments → Edit → Version: New version → Deploy**. Keep the existing deployment to preserve the same community URL.

## Limits

This is a small-community board, subject to Google Apps Script quotas. Anyone permitted to access the web app can read posts/contact numbers and submit a post. The server validates inputs and serializes writes; formula-like text is stored as text. Member sign-in, spam protection, and self-service edit/delete are not implemented. The sheet owner can hide/delete posts. Never put sensitive information in a post. Keep sheet editor access limited to trusted administrators.

The generated files have been checked locally, including simulated spreadsheet reads/writes. A live Google connection can only be verified after you deploy and authorize it in your account.

Official references:
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/html/communication
