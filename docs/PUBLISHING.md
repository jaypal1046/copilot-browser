# 🚀 Publishing to VS Code Marketplace

You will need these details to fill out the form at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage).

## 📝 Publisher Details

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Name** | `Jay Pal` | Or your full name / company name |
| **ID** | `jaypal-browser-copilot` | **Must match `package.json`!** |
| **Domain** | *(Leave empty)* | unless you own a domain |
| **Description** | `Connect GitHub Copilot to your browser for automated testing and control` | |
| **Source code**| `https://github.com/jaypal1046/copilot-browser` | |

---

## ✅ Step-by-Step Guide

### 1. Create Publisher
1.  Go to [VS Code Marketplace Management](https://marketplace.visualstudio.com/manage).
2.  Sign in.
3.  Click **Create Publisher**.
4.  Fill in the details from the table above.
    -   **Important**: Make sure the **ID** is exactly: `jaypal-browser-copilot`

### 2. Get Access Token (PAT)
1.  Go to [Azure DevOps](https://dev.azure.com/).
2.  User Settings (top right) → **Personal Access Tokens**.
3.  **+ New Token**:
    -   Name: `VS Code Publishing`
    -   Organization: `All accessible organizations`
    -   Expiration: `1 year`
    -   Scopes: **Marketplace** → **Manage** (at the bottom).
4.  **Copy the token**.

### 3. Login & Publish

Run these commands in your terminal:

```bash
# Install tool
npm install -g @vscode/vsce

# Navigate to extension folder
cd vscode-extension

# Login (paste your token when asked)
npx vsce login jaypal-browser-copilot

# Package & Publish
npx vsce publish
```

---

### ⚠️ I have already updated your `package.json`!

I set your publisher ID to: `"jaypal-browser-copilot"`
And your repository to: `"https://github.com/jaypal1046/copilot-browser.git"`

**If you change the ID on the website, let me know so I can update the code.**
