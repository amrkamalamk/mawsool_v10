import fetch from "node-fetch";

export default async function handler(req, res) {
  const { id } = req.query; // Interaction/Conversation ID

  // Genesys OAuth credentials (set in Vercel environment variables)
  const clientId = process.env.GENESYS_CLIENT_ID;
  const clientSecret = process.env.GENESYS_CLIENT_SECRET;
  const region = "mec1.pure.cloud"; // UAE CX2

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "Server configuration error: Missing Client ID or Secret" });
  }

  try {
    // 1️⃣ Fetch a fresh OAuth token
    const tokenResponse = await fetch(`https://login.${region}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&scope=recordings:view`,
      auth: Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(500).json({ error: "Failed to get access token from Genesys" });
    }

    // 2️⃣ Fetch recording media
    const recordingUrl = `https://api.${region}/api/v2/recordings/${id}/media`;
    const recordingResponse = await fetch(recordingUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!recordingResponse.ok) {
      return res
        .status(recordingResponse.status)
        .json({ error: `Failed to fetch recording: ${recordingResponse.statusText}` });
    }

    // 3️⃣ Stream audio back to frontend
    const audioBuffer = await recordingResponse.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}
