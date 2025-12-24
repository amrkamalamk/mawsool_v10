# Mawsool - Telemetry & Recording Dashboard

Mawsool is a specialized monitoring dashboard for Genesys Cloud UAE. It provides real-time MOS (Mean Opinion Score) analysis, traffic insights, and call recording playback.

## 🚀 Deployment Instructions (Vercel)

### 1. Obtain a Genesys OAuth Token
- Log in to your Genesys Cloud UAE admin console.
- Create a **Client Credentials** grant under Integrations > OAuth.
- Assign the following scopes:
  - `analytics:readonly`
  - `recording:readonly`
  - `routing:readonly`
- Use the Client ID and Secret to generate a token (e.g., via Postman or cURL).

### 2. Configure Vercel
In your Vercel project settings (Environment Variables), add:
- `GENESYS_ACCESS_TOKEN`: The access token obtained in step 1.
- `API_KEY`: Your Google Gemini API Key (Required for the AI Analyst tab).

### 3. Deploy
Push the project code to your Git provider connected to Vercel. The `vercel.json` is already configured to route `/api/recordings` correctly.

## 📱 Features
- **Real-time MOS Monitoring**: Visualizes voice quality across the UAE region.
- **Recording Playback**: Securely streams call recordings for interactions in the last 5 minutes.
- **AI Analyst**: Uses Gemini 3 Pro to generate forensic hypotheses on quality dips.
- **PWA Support**: Installable on Android and iOS with offline status indicators.

## 🔒 Security
Recording playback is proxied through a Vercel Serverless Function to:
- Prevent CORS issues between browsers and Genesys S3 buckets.
- Protect your Genesys API Token from being exposed in client-side code.
- Provide a clean, consistent endpoint for the PWA audio player.
