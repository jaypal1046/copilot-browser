# Chrome Web Store Privacy & Permissions Answers

Copy and paste these answers into the submission form.

## Single Purpose Description
Connect your browser to GitHub Copilot for automated browser control and testing.

## Permission Justifications

### `activeTab`
Used to access the currently active tab when the user triggers a command from VS Code, allowing the extension to perform actions like clicking or typing on that specific page without needing full history access.

### `storage`
Used to store user preferences and connection settings (e.g., the relay server URL) locally within the browser. No personal data is stored.

### `scripting`
Required to inject and execute automation scripts (like highlighting elements or performing interactions) into the web page in response to user commands from VS Code.

### `tabs`
Used to query the list of open tabs so the user can select which tab to automate or switch between tabs via VS Code commands.

### `webNavigation`
Used to detect when a page has finished loading so the extension knows when it is safe to execute automation commands.

### `webRequest`
Used to monitor network traffic for debugging purposes (User can ask "What network requests failed?"), allowing Copilot to analyze network activity.

### `debugger`
Required to attach to the tab for advanced automation capabilities, such as simulating input events and capturing precise screenshots, which are core features of the browser control agent.

### `cookies`
Used to retrieve cookies for the current domain only when explicitly requested by the user for debugging or testing authentication flows.

### `Host permission` (<all_urls>, localhost)
- `<all_urls>`: Required because the user may want to test or automate *any* website they navigate to. The extension is a general-purpose browser agent.
- `localhost`: Required to communicate with the local relay server (WebSocket) to receive commands from VS Code.

## Remote Code
**No, I am not using Remote code.**

## Data Usage
(Check the following boxes if you are *only* doing what is listed. Since this extension is local-first, you likely check **No** for most unless you explicitly send data elsewhere).

- **Web History**: Check this if you want to be safe, as `tabs` access technically exposes this. Justification: "The extension accesses the current tab URL to enable automation, but does not track or sell history."
- **User Activity**: Check this (Clicks, mouse position). Justification: "Used to simulate user interactions for automation."
- **Website Content**: Check this (Text, images). Justification: "Used to read page content so Copilot can answer questions about the page."

**Certify the 3 disclosures**: YES (Check all three).

## Privacy Policy URL
Since you are hosting this on GitHub, you can use a GitHub Gist or a file in your repo.
I have created a `PRIVACY_POLICY.md` for you.
**URL**: `https://github.com/jaypal1046/copilot-browser/blob/master/PRIVACY_POLICY.md`
(Make sure to push the code first so this link works!)
