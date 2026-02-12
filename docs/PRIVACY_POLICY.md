# Privacy Policy for Copilot Browser

**Last Updated: February 12, 2026**

## 1. Introduction
The **Copilot Browser** extension (and its companion **Copilot Browser-vscode**) is a developer tool designed to bridge your web browser with GitHub Copilot in VS Code. This integration allows you to perform automated testing, validaton, and browser control directly from your editor.

We are committed to transparency and ensuring your privacy. This policy explains what data we handle and how it is processed.

## 2. Data Collection and Processing
We adhere to a strict **"Local-First"** architecture.

### 2.1. No Remote Data Collection
**We do not collect, store, or transmit your personal data, browsing history, or page content to our own servers.** The extension operates entirely locally on your machine.

### 2.2. Local Communication
All communication occurs locally between the Chrome Extension and the VS Code Extension via a WebSocket connection on your machine (typically `ws://localhost:8080`). No data leaves your local network during this relay process.

### 2.3. Interaction with GitHub Copilot
The extension acts as a conduit. Data extracted from web pages (such as DOM structure, console logs, or screenshots) is sent to VS Code **only when you explicitly trigger a command**.
-   This data is then passed to the GitHub Copilot Chat API to generate answers or perform actions.
-   Please refer to the [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement) for details on how GitHub handles data sent to Copilot.

## 3. Permissions and Usage
We request the minimum set of permissions necessary for the extension's core functionality.

| Permission | Purpose |
| :--- | :--- |
| **`activeTab`** | To identify the currently active tab for automation commands. |
| **`scripting`** | To inject the necessary scripts for DOM query and interaction (e.g., clicking elements). |
| **`storage`** | To save your local configuration settings (e.g., relay server port). |
| **`debugger`** | To attach to the tab for advanced automation features like network monitoring or simulating input. |
| **`webNavigation`** | To track page load states and ensure automation waits for pages to be ready. |
| **`tabs`** | To manage tabs (open, close, switch) as requested by your automation scripts. |

## 4. Third-Party Services
This extension is designed to work with:
-   **Visual Studio Code**: The editor where the companion extension runs.
-   **GitHub Copilot**: The AI service processing your queries.

We do not integrate with any other third-party analytics, tracking, or advertising services.

## 5. Changes to This Policy
We may update this Privacy Policy to reflect changes in our practices or service offerings. If we make significant changes, we will notify you by updating the date at the top of this policy.

## 6. Contact Us
If you have any questions, concerns, or suggestions regarding this Privacy Policy, please open an issue on our [GitHub Repository](https://github.com/jaypal1046/copilot-browser).
