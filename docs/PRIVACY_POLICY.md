# Privacy Policy for Browser Copilot Agent

**Last Updated: February 10, 2026**

## Introduction
The Browser Copilot Agent ("Extension") is a developer tool designed to connect your browser to GitHub Copilot for automated testing and control. This Privacy Policy explains how we handle your data.

## Data Collection and Usage
The Extension is designed with a "Local-First" architecture. 

1.  **No Cloud Data Transmission**: The Extension does not send your browsing history, page content, or interaction data to any external cloud servers managed by the Extension developers.
2.  **Local Communication**: All data is transmitted locally via WebSocket to a Relay Server running on your authentication machine (`localhost`).
3.  **GitHub Copilot Interaction**: Data extracted from web pages (DOM, logs, screenshots) is only sent to VS Code and subsequently to GitHub Copilot *at your explicit request* during a chat session. Please refer to GitHub's Privacy Policy for how they handle data.

## Permissions

-   **Tabs & WebNavigation**: Used to identify the active tab for automation.
-   **Scripting & Debugger**: Used to execute commands (click, type) on your behalf.
-   **Storage**: Used to save local extension settings (e.g., connection port).

## Changes to this Policy
We may update our Privacy Policy from time to time. Thus, you are advised to review this page periodically for any changes.

## Contact Us
If you have any questions or suggestions about our Privacy Policy, do not hesitate to open an issue on our [GitHub Repository](https://github.com/jaypal1046/copilot-browser).
