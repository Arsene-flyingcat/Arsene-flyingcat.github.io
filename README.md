# arsene — Personal Website

A static personal website for project updates, research, and blog posts. Built with plain HTML, CSS, and JavaScript — no frameworks, no build tools.

## Features

- Modern, colorful design with animated gradients and dark/light mode
- Pixel-art world map that tracks visitor locations
- Responsive mobile-first layout with hamburger navigation
- Scroll-reveal animations (IntersectionObserver)
- Shared header/footer injected via JS (no server-side templating)
- Blog and research templates for easy content creation

## Quick Start

```bash
# Serve locally
python3 -m http.server 8000

# Then open http://localhost:8000
```

Any static file server works — the site is pure HTML/CSS/JS.

## Adding Content

### New Blog Post

1. Copy `blog/_template.html` to `blog/your-post-slug.html`
2. Edit the title, date, tags, and content in the new file
3. Add a card entry in `blog/index.html` (copy the commented template block)
4. Optionally add a card to the "Recent Posts" section on `index.html`

### New Research Entry

1. Copy `research/_template.html` to `research/your-paper-slug.html`
2. Edit the title, authors, venue, abstract, and BibTeX
3. Add a card entry in `research/index.html`

### New Project

Add a new card to the grid in `projects/index.html`. Copy an existing card block and update the thumbnail gradient, title, description, tags, and links.

## Visitor Map (Optional Firebase Setup)

The pixel world map works out of the box in local-only mode (shows only the current visitor). To persist visitor data across sessions:

1. Create a free Firebase project at [firebase.google.com](https://firebase.google.com)
2. Enable **Realtime Database** (start in test mode or set rules below)
3. Copy your Firebase config object
4. Open `assets/js/visitor-map.js` and replace `FIREBASE_CONFIG = null` with your config
5. Set these database rules for basic security:

```json
{
  "rules": {
    "visitors": {
      ".read": true,
      ".write": true,
      "$visitor": {
        ".validate": "newData.hasChildren(['lat', 'lon', 'ts'])"
      }
    }
  }
}
```

The free Firebase Spark plan (1GB storage, 10GB/month transfer) is more than enough.

## Deploying to GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source to **Deploy from a branch** → `main` / `/ (root)`
4. Your site will be live at `https://yourusername.github.io/repo-name/`

For a custom 404 page, GitHub Pages automatically uses `404.html` at the repo root.

## Project Structure

```
proj_blog/
├── index.html                    # Home page
├── blog/
│   ├── index.html                # Blog listing
│   ├── _template.html            # Template for new posts
│   └── hello-world.html          # Example post
├── research/
│   ├── index.html                # Research listing
│   ├── _template.html            # Template for new entries
│   └── example-research.html     # Example entry
├── projects/
│   └── index.html                # Projects card grid
├── about/
│   └── index.html                # About page
├── 404.html                      # Custom 404
├── assets/
│   ├── css/
│   │   ├── theme.css             # CSS custom properties (light/dark)
│   │   ├── main.css              # Reset, typography, layout, .prose
│   │   ├── components.css        # Nav, cards, buttons, tags, footer
│   │   └── animations.css        # Keyframes, .reveal, hover effects
│   ├── js/
│   │   ├── main.js               # Orchestrator
│   │   ├── components.js         # Shared header/footer injection
│   │   ├── theme-toggle.js       # Dark/light mode
│   │   ├── mobile-nav.js         # Hamburger menu
│   │   ├── scroll-reveal.js      # Scroll animations
│   │   └── visitor-map.js        # Pixel world map + Firebase
│   ├── components/
│   │   ├── header.html           # Shared nav fragment
│   │   └── footer.html           # Shared footer fragment
│   └── images/
│       └── favicon.svg
└── README.md
```

## Customization

- **Colors**: Edit CSS custom properties in `assets/css/theme.css`
- **Name/branding**: Update "arsene" in `header.html`, `footer.html`, and page titles
- **Social links**: Update URLs in `footer.html` and `about/index.html`
- **Fonts**: Change the Google Fonts import in each HTML `<head>`

## License

MIT
