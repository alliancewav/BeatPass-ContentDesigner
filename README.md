# BeatPass Content Designer

A visual content generation tool for the BeatPass blog. Transforms published blog articles into branded carousel slides and exportable media assets.

**Part of the [BeatPass](https://beatpass.ca) platform.**

---

## Overview

Content Designer connects to the BeatPass blog via the Ghost Content API, pulls article data, and generates professionally styled slide decks optimized for social media distribution. It supports multiple export formats including individual PNGs, ZIP bundles, and video composites.

### Key Features

- Automatic slide generation from blog article content
- Multiple visual themes with brand-consistent styling
- PNG, ZIP, and video export pipelines
- Password-protected access
- Responsive single-page application

### Tech Stack

- React 18 + Vite
- Tailwind CSS
- Ghost Content API integration
- html2canvas / JSZip / file-saver

### Repository Structure

```
.
├── public/            # Static assets (fonts, logos)
├── src/
│   ├── components/    # React UI components
│   ├── lib/           # Core logic (export, slides, themes, API)
│   ├── styles/        # Tailwind entry point
│   ├── config.js      # App configuration
│   ├── App.jsx        # Root component
│   └── main.jsx       # Entry point
├── index.html         # SPA shell
├── vite.config.js     # Vite configuration
├── tailwind.config.js # Tailwind configuration
└── package.json       # Dependencies
```

## Setup

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure the application in `src/config.js` with your Ghost API credentials and branding.
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Build for production:
   ```bash
   npm run build
   ```

## Related

- **[BeatPass Blog](https://github.com/alliancewav/BeatPass-Blog)** — Ghost CMS blog infrastructure and automation scripts.
- **[BeatPass](https://beatpass.ca)** — The beat licensing platform.

---

## License

This is proprietary software. All rights reserved by **Alliance Productions Records Inc.**

No part of this repository may be copied, modified, distributed, or reused in any form without explicit written permission. See [LICENSE](./LICENSE) for full terms.

## Contact

Alliance Productions Records Inc.
Email: contact.alliancewav@gmail.com
