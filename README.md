# BountyHunter OS

A comprehensive command center for bug bounty hunters featuring target tracking, payload libraries, and AI-powered vulnerability analysis.

## Features
- **Mission Dashboard**: Track bounties and research activity.
- **Target Management**: Curate lists of programs.
- **Payload Library**: Instant access to common security payloads.
- **Security Checklist**: Interactive task list based on OWASP.
- **AI Vulnerability Lab**: AI security partner powered by Gemini.
- **GitHub Integration**: Export reports directly to your repository.

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Create a `.env` file and add:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   APP_URL=your_app_url
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

## GitHub Integration Setup

To enable the "Export to GitHub" feature:
1. Create an OAuth App in your GitHub Developer Settings.
2. Set the Homepage URL and Callback URL to your app's URL.
3. Add the Client ID and Secret to your environment variables.
4. Connect your account in the app's Settings tab.
