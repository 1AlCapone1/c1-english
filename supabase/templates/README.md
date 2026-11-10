# E-mail templates (Supabase → Authentication → Emails)

Suggested subjects: **Potwierdź konto – C1 English Academy** and **Reset hasła – C1 English Academy**.
The templates are e-mail-safe (tables + inline styles), with a fallback link and a version for narrow screens.

Paste these into **Confirm signup** and **Reset password** (subject e.g. "Potwierdź konto – C1 English Academy").

Why: the link opens the app directly (`/?token_hash=…`), and the token is used only after the user clicks
**„Potwierdź weryfikację”**. This
- works on any device or browser (it doesn't depend on where the user registered),
- doesn't depend on the Redirect URLs list,
- stops e-mail scanners that "click" links automatically from using up the one-time link.

Requirement: **Authentication → URL Configuration → Site URL = `https://1alcapone1.github.io/c1-english/`**
(with the trailing slash), and in Redirect URLs: `https://1alcapone1.github.io/c1-english/**`.

The default Supabase template (`{{ .ConfirmationURL }}`) also works once the Site URL is set correctly. The app
handles both formats (`?token_hash=` and `?code=`), as well as error redirects (`#error=…&error_code=otp_expired`).
