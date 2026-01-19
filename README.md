# WebDepth Chrome Extension

WebDepth is a Chrome extension that analyzes the current website to identify the technologies used, including frameworks, libraries, CMS, and hosting providers. It detects technologies by analyzing:

- Global JavaScript variables (`window` objects)
- DOM elements (Meta tags, Selector matches)
- Script sources
- HTTP Response Headers

## Features

- **Technology Detection**: Identifies React, Vue, Angular, jQuery, WordPress, Shopify, and more.
- **Hosting & Server Detection**: Detects Vercel, Netlify, AWS, Nginx, Apache via headers.
- **Clean UI**: Modern, dark-mode-ready popup interface.
- **Extensible**: Easily add new technologies via JSON configuration.

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Toggle **Developer mode** in the top right corner.
4. Click **Load unpacked**.
5. Select the `WebDepth` directory.

## Usage

1. Navigate to any website.
2. Click the WebDepth icon in the Chrome toolbar.
3. View the list of detected technologies grouped by category.

## Development

### Project Structure

- `manifest.json`: Extension configuration (Manifest V3).
- `data/technologies.json`: The detection rules database.
- `scripts/content.js`: Content script for DOM analysis and script injection.
- `scripts/detector.js`: Injected script to access Main World window variables.
- `background.js`: Background service worker (header analysis, storage).
- `popup/`: UI for the extension.

### How to Add New Technologies

To add support for checking new technologies, you only need to edit **`data/technologies.json`**. The extension is designed to be data-driven, so no JavaScript changes are usually required.

#### JSON Key Schema

Add a new key with the name of the technology. The value is an object with the following optional properties:

```json
"Technology Name": {
  "categories": ["Category Name"], // Required. e.g. "CMS", "JavaScript Framework"
  
  // OPTIONAL: Check for global window variables (Main World)
  "window": ["variableName", "OtherVar"],
  
  // OPTIONAL: Check for script source URLs (DOM)
  "scriptSrc": ["identifiable-script.js", "cdn.example.com"],
  
  // OPTIONAL: Check for meta tags (DOM)
  "meta": { "generator": "Identity String", "other-meta": "value" },
  
  // OPTIONAL: Check for CSS selectors (DOM)
  "selector": ["#unique-id", ".unique-class"],
  
  // OPTIONAL: Check for HTTP Response Headers (Background)
  "headers": { "header-name": "partial-value-match" }
}
```

#### Examples

**Adding a new Framework (e.g., Svelte):**

```json
"Svelte": {
  "categories": ["JavaScript Framework"],
  "window": ["__svelte"],
  "selector": [".svelte-"]
}
```

**Adding a new Server (e.g., Caddy):**

```json
"Caddy": {
  "categories": ["Web Server"],
  "headers": { "server": "Caddy" }
}
```

After editing `technologies.json`, remember to **Refresh** the extension in `chrome://extensions` to apply changes.
