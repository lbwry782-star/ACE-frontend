# ACE Frontend

Frontend application built with React + Vite.

## Requirements

- Node.js 18+ 
- npm or yarn

## Installation

```bash
npm install
```

## Development

Run the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Build

Build for production:

```bash
npm run build
```

## Project Structure

```
frontend/
  src/
    components/     # Reusable components
    pages/         # Page components
    services/      # API services
    styles/        # Global styles
```

## Backend Connection

The frontend expects the backend to be running on `http://localhost:5000`.

Make sure the backend is running before starting the frontend.

## GitHub Pages Support

This application uses **HashRouter** for routing to ensure compatibility with GitHub Pages.

### Routes

- `/` or `/#/` - PreviewPage (דף תצוגה מקדימה)
- `/#/builder` - BuilderPage (דף יצירת פרסומות)

### Important Notes

- When refreshing the page or entering directly to the Builder page, use the hash route: `/#/builder`
- The HashRouter automatically handles hash-based navigation, so all internal links work correctly
- This setup ensures that GitHub Pages serves the app correctly without 404 errors on direct navigation

### Local Development

Routes work the same way locally:
- `http://localhost:3000/` - Preview page
- `http://localhost:3000/#/builder` - Builder page

The HashRouter works seamlessly in both local development and GitHub Pages deployment.

## GitHub Pages Deployment

This project is deployed to GitHub Pages **via GitHub Actions** (not from branch source).

### Important: Repository Settings

**You must configure GitHub Pages to use GitHub Actions:**

1. Go to repository **Settings** → **Pages**
2. Under **Source**, select **"GitHub Actions"** (not "Deploy from a branch")
3. Save the settings

### Automatic Deployment

After pushing to the `main` branch, the GitHub Actions workflow automatically:
1. Checks out the code
2. Sets up Node.js (LTS)
3. Installs dependencies (`npm ci`)
4. Builds the Vite application (`npm run build`)
5. Uploads the `dist` folder as a Pages artifact
6. Deploys to GitHub Pages

### Site URLs

- **Main site**: https://lbwry782-star.github.io/ACE-Frontend/
- **Builder page**: https://lbwry782-star.github.io/ACE-Frontend/#/builder

### Deployment Configuration

The deployment is configured via:
- `vite.config.js` - Sets `base: '/ACE-Frontend/'` for correct asset paths (case-sensitive)
- `.github/workflows/deploy.yml` - GitHub Actions workflow that builds and deploys the `dist` folder

### Manual Deployment

To manually trigger deployment:
1. Go to the repository's **Actions** tab
2. Select **"Deploy to GitHub Pages"** workflow
3. Click **"Run workflow"** → **"Run workflow"**

### Troubleshooting

**If you see a blank page:**
1. ✅ Verify GitHub Pages Source is set to **"GitHub Actions"** (not "Deploy from a branch")
2. ✅ Ensure the `base` path in `vite.config.js` matches your repository name exactly: `/ACE-Frontend/` (case-sensitive)
3. ✅ Check that the Actions workflow completed successfully (green checkmark)
4. ✅ Verify the workflow uploaded the `dist` folder (check workflow logs)
5. ✅ Clear browser cache and hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
6. ✅ Check browser console for 404 errors on assets

**Common issue:** If Pages is still deploying from branch source, change it to GitHub Actions in Settings → Pages.

