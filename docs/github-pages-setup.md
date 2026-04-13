# GitHub Pages Setup

## 1. Push repository

Push this project to a GitHub repository with default branch main.

## 2. Enable Pages in repository settings

In GitHub:

- Open Settings -> Pages
- Source: GitHub Actions

The workflow .github/workflows/deploy-pages.yml deploys on every push to main.

## 3. Expected site URL

- https://<username>.github.io/<repository>/

If your repository is a project page, relative links in this project already work.

## 4. Verify deployment

After first push, open Actions tab and confirm:

- Deploy Dashboard to GitHub Pages -> success

Then open the Pages URL.
