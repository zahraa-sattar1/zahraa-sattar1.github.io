# GitHub Secrets For Firebase Backend Deploy

Add these repo secrets in GitHub Settings -> Secrets and variables -> Actions:

- FIREBASE_PROJECT_ID: your firebase project id
- FIREBASE_TOKEN: CI token from firebase login:ci

Generate token locally:

```bash
npm install -g firebase-tools
firebase login:ci
```

Copy token output into FIREBASE_TOKEN secret.

The workflow .github/workflows/deploy-firebase-backend.yml deploys backend resources when firebase files change on main or when manually triggered.
