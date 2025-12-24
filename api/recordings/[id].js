
/**
 * Vercel Serverless Function
 * Proxies call recordings from Genesys Cloud to the frontend.
 */
export default async function handler(req, res) {
console.log('Token value:', token ? 'Found' : 'Missing');
  const { id } = req.query; // Conversation ID
  const token = process.env.GENESYS_ACCESS_TOKEN;
  const region = 'mec1.pure.cloud'; // UAE Region for horizonscope-cx2

  export default async function handler(req, res) {
  const token = process.env.GENESYS_ACCESS_TOKEN; // declare first
  const { id } = req.query;

  if (!token) {
    console.error('Missing GENESYS_ACCESS_TOKEN environment variable');
    return res.status(500).json({ error: 'Server configuration error: Token missing' });
  }

  if (!id) {
    return res.status(400).json({ error: 'Conversation ID required' });
  }

  try {
    // 1. Fetch the list of recordings for this conversation
    const listUrl = `https://api.${region}/api/v2/conversations/${id}/recordings`;
    const listRes = await fetch(listUrl, {
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Accept': 'application/json' 
      }
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error(`Genesys List API Error (${listRes.status}):`, errText);
      return res.status(listRes.status).json({ error: 'Failed to locate recording metadata' });
    }

    const recordings = await listRes.json();
    if (!recordings || recordings.length === 0) {
      return res.status(404).json({ error: 'No recordings available for this interaction' });
    }

    // 2. Select the first non-deleted recording
    const recording = recordings.find(r => r.fileState !== 'DELETED') || recordings[0];
    if (recording.fileState === 'DELETED') {
      return res.status(404).json({ error: 'The recording has been deleted from Genesys Cloud' });
    }

    // 3. Request the signed MP3 playback URL
    // format=MP3 ensures the stream is compatible with standard HTML5 audio tags
    const mediaUrl = `https://api.${region}/api/v2/conversations/${id}/recordings/${recording.id}?format=MP3`;
    const mediaRes = await fetch(mediaUrl, {
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Accept': 'application/json' 
      }
    });

    if (!mediaRes.ok) {
      return res.status(mediaRes.status).json({ error: 'Failed to generate playback stream' });
    }

    const mediaData = await mediaRes.json();
    const finalMediaUri = mediaData.mediaUri || (mediaData.mediaUris && mediaData.mediaUris.web ? mediaData.mediaUris.web.uri : null);

    if (!finalMediaUri) {
      return res.status(404).json({ error: 'Playback URI not provided by Genesys' });
    }

    // 4. Fetch and stream the actual audio bytes from the signed URL
    const audioRes = await fetch(finalMediaUri);
    if (!audioRes.ok) {
      return res.status(audioRes.status).json({ error: 'Failed to stream audio from storage' });
    }

    const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';
    const contentLength = audioRes.headers.get('content-length');

    // Set appropriate headers for the HTML5 audio player
    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'public, max-age=3600'); 

    const arrayBuffer = await audioRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));

  } catch (error) {
    console.error('Recording Proxy Exception:', error);
    return res.status(500).json({ error: 'Internal server error during playback', details: error.message });
  }
}
