# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub Security Advisories on this repository
(`Security` → `Report a vulnerability`). Do not open a public issue for a vulnerability report.

Include the DeepSeek Harness version, the profile, the plugin version, and reproduction steps.
Expected first response within 7 days.

## Supported versions

Security fixes target the latest `0.1.x` release on the `>=0.2.1-rc.2 <0.3.0-0` DeepSeek Harness
range. Older releases are unsupported.

## Permission boundary

`dsh-image-viewer-pro` is a local image viewer for images already shown in a DSH conversation.

- The Host entry is an empty placeholder; the browser half only intercepts clicks on content images.
- It reads no credentials, tokens, cookies, or files outside the image being displayed.
- It adds no network listener and no background request or telemetry. The only requests are those
  needed to display, download, or open the image the user selected.
- Download saves the current image to the browser's download folder; copy writes it to the clipboard.
- "Open with default app" goes through the Host's `session.openWorkspacePath`; remote `http(s)`
  images are handed to the default browser.
- No session content is modified, and closing the dialog restores the page.

## Third-party data

The plugin ships no telemetry and sends no data to third parties on its own. Remote images are
displayed by the browser from their original URL, so the remote server sees the same request any
web page would make; local images are served by the DSH Host on its own origin. The plugin does
not persist image data or URLs.
