
import { UnifiedDataPoint, Region, GenesysCredentials, AgentPerformance, WrapUpData, BranchData, CallerData, InteractionData } from "../types";

let accessToken: string | null = null;
let tokenExpiry: number = 0;
let detectedRegion: string | null = null;
const userCache: Record<string, string> = {};

const BAGHDAD_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3 for Baghdad
const SL_THRESHOLD_MS = 10000;

const normalizeDNIS = (dnis: string): string => {
  if (!dnis) return "";
  const digits = dnis.replace(/\D/g, '');
  return digits.slice(-10);
};

const DNIS_TO_BRANCH: Record<string, string> = {
  "7734011011": "Al-Dolai", "7735011011": "Al-Dolai", "7834011011": "Al-Dolai", "7835011011": "Al-Dolai",
  "7742101010": "Al-Krada", "7746101010": "Al-Krada", "7842101010": "Al-Krada", "7846101010": "Al-Krada",
  "7736121212": "Al-Sadr - Tawn Hyp.", "7737121212": "Al-Sadr - Tawn Hyp.", "7836121212": "Al-Sadr - Tawn Hyp.", "7837121212": "Al-Sadr - Tawn Hyp.",
  "7732224446": "ElMansour", "7732224447": "ElMansour", "7832224447": "ElMansour", "7852224447": "ElMansour",
  "7722900007": "Palestine St.", "7822400007": "Palestine St.", "7822900007": "Palestine St.", "7722400007": "Palestine St.",
  "7734171717": "Palestine St. - Tawn Hyp.", "7735171717": "Palestine St. - Tawn Hyp.", "7834171717": "Palestine St. - Tawn Hyp.", "7835171717": "Palestine St. - Tawn Hyp.",
  "7746161616": "Salehia - Tawn Hyp.", "7747161616": "Salehia - Tawn Hyp.", "7846161616": "Salehia - Tawn Hyp.", "7847161616": "Salehia - Tawn Hyp.",
  "7736141414": "Al Jamiya", "7737141414": "Al Jamiya", "7836141414": "Al Jamiya", "7837141414": "Al Jamiya",
  "7750000403": "Zayouna", "7750000406": "Zayouna", "7850000403": "Zayouna", "7850000406": "Zayouna",
};

const WRAP_UP_MAPPING: Record<string, string> = {
  "c649a66b-38c9-4ef5-b022-3445b061e5a0": "Order Placed طلب",
  "7553e655-f4b2-44d9-9037-407d0ec9d5f6": "Delay In Delivery تأخير في الطلب",
  "332220a7-576d-47fb-9b33-55ee16998fd9": "Order Canceled الغاء طلب",
  "d3244924-1997-45bf-8df4-9a1ef95105e3": "Complaint مشكلة في طلب",
  "6f6652bc-5a15-4c80-93c1-50c86ccec218": "Inquiry استعلام",
  "ININ-WRAP-UP-TIMEOUT": "ININ-WRAP-UP-TIMEOUT",
  "6c340a6b-f981-4a24-aa7e-980533cb841e": "Missed or Wrong Call رقم خاطئ او مكالمة فائته"
};

const getProxiedUrl = (url: string, proxy?: string) => {
  if (!proxy || proxy.trim() === '' || proxy === 'DIRECT' || proxy.includes('NO PROXY')) return url;
  const cleanProxy = proxy.trim();
  if (cleanProxy.includes('corsproxy.io')) {
     return `https://corsproxy.io/?${encodeURIComponent(url)}`;
  }
  return cleanProxy.endsWith('/') || cleanProxy.endsWith('?') ? `${cleanProxy}${url}` : `${cleanProxy}/${url}`;
};

const sanitize = (val: string): string => val.replace(/[\x00-\x1F\x7F]/g, '').trim();

const base64Encode = (str: string): string => {
  try { return btoa(unescape(encodeURIComponent(str))); } catch (e) { return btoa(str); }
};

const formatISO = (date: Date) => date.toISOString().split('.')[0] + 'Z';

export const getAccessToken = async (creds: GenesysCredentials): Promise<{token: string, region: string}> => {
  if (accessToken && Date.now() < tokenExpiry && detectedRegion === creds.region) {
    return { token: accessToken, region: detectedRegion };
  }
  
  const authUrl = `https://login.${creds.region}/oauth/token`;
  const targetUrl = getProxiedUrl(authUrl, creds.proxyUrl);
  const authHeader = `Basic ${base64Encode(`${sanitize(creds.clientId)}:${sanitize(creds.clientSecret)}`)}`;
  
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Authentication Failed: ${response.status} ${errorData.error_description || errorData.message || ''}`);
    }
    
    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
    detectedRegion = creds.region;
    return { token: accessToken!, region: detectedRegion! };
  } catch (err: any) {
    if (err.message === 'Failed to fetch') {
      throw new Error('Failed to fetch: This is likely a CORS issue. Please try switching the Proxy Route in the settings.');
    }
    throw err;
  }
};

const fetchUserNames = async (creds: GenesysCredentials, userIds: string[]): Promise<void> => {
  const missingIds = userIds.filter(id => !userCache[id]);
  if (missingIds.length === 0) return;

  const { token, region } = await getAccessToken(creds);
  const url = getProxiedUrl(`https://api.${region}/api/v2/users/search`, creds.proxyUrl);
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageSize: 100,
        query: [{ type: "EXACT", fields: ["id"], values: missingIds }]
      })
    });
    if (res.ok) {
      const data = await res.json();
      data.results?.forEach((u: any) => { userCache[u.id] = u.name; });
    }
  } catch (e) { console.error("Error fetching user names", e); }
};

export const getQueueIdByName = async (creds: GenesysCredentials, queueName: string): Promise<{queueId: string, actualRegion: string}> => {
  const { token, region } = await getAccessToken(creds);
  const queueUrl = getProxiedUrl(`https://api.${region}/api/v2/routing/queues?name=${encodeURIComponent(queueName.trim())}`, creds.proxyUrl);
  
  const response = await fetch(queueUrl, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(`Queue lookup failed: ${response.status}`);
  }

  const data = await response.json();
  const queue = data.entities?.find((q: any) => q.name.toLowerCase() === queueName.toLowerCase());
  if (queue) return { queueId: queue.id, actualRegion: region };
  throw new Error(`Queue '${queueName}' not found.`);
};

export const fetchRecentInteractions = async (
  creds: GenesysCredentials,
  queueId: string,
  activeRegion: string
): Promise<InteractionData[]> => {
  const { token } = await getAccessToken(creds);
  const now = new Date();
  const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const interval = `${formatISO(fiveMinsAgo)}/${formatISO(now)}`;

  const targetUrl = `https://api.${activeRegion}/api/v2/analytics/conversations/details/query`;
  const res = await fetch(getProxiedUrl(targetUrl, creds.proxyUrl), {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      interval: interval,
      segmentFilters: [{ type: "and", predicates: [{ type: "dimension", dimension: "queueId", operator: "matches", value: queueId }] }]
    })
  });

  if (!res.ok) return [];
  const data = await res.json();
  const conversations = data.conversations || [];

  return conversations.map((conv: any): InteractionData => {
    let direction: 'inbound' | 'outbound' = 'inbound';
    let ani = '';
    let dnis = '';
    
    conv.participants?.forEach((p: any) => {
      if (p.purpose === 'customer' || p.purpose === 'external') {
        p.sessions?.forEach((s: any) => {
          if (s.mediaType === 'voice') {
            direction = s.direction === 'outbound' ? 'outbound' : 'inbound';
            ani = s.ani?.replace(/^(tel:|sip:)/, '').split('@')[0] || '';
            dnis = s.dnis?.replace(/^(tel:|sip:)/, '').split('@')[0] || '';
          }
        });
      }
    });

    const startTime = new Date(conv.conversationStart);
    const endTime = conv.conversationEnd ? new Date(conv.conversationEnd) : new Date();

    return {
      id: conv.conversationId,
      startTime: new Date(startTime.getTime() + BAGHDAD_OFFSET_MS).toISOString().replace('T', ' ').split('.')[0],
      direction,
      durationMs: endTime.getTime() - startTime.getTime(),
      ani,
      dnis
    };
  }).sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
};

export const fetchRecordingMediaUrl = async (
  creds: GenesysCredentials,
  conversationId: string,
  activeRegion: string
): Promise<string | null> => {
  // Use the secure Vercel backend proxy to stream the recording
  // This avoids exposing credentials in the client and handles S3 redirects server-side
  return `/api/recordings/${conversationId}`;
};

export const fetchRealtimeMetrics = async (
  creds: GenesysCredentials, 
  queueId: string, 
  activeRegion: string, 
  startDateStr?: string,
  endDateStr?: string
): Promise<{ 
  history: UnifiedDataPoint[], 
  agents: AgentPerformance[], 
  topCallers: CallerData[],
  wrapUpData: WrapUpData[],
  branchData: BranchData[]
}> => {
  const { token } = await getAccessToken(creds);
  
  const startStr = startDateStr || new Date().toISOString().split('T')[0];
  const endStr = endDateStr || startStr;
  const startDate = new Date(startStr);
  const endDate = new Date(endStr);
  const now = new Date();
  
  const dailyIntervalConfigs: { interval: string, fetchNeeded: boolean, shiftStartUTC: Date, shiftEndUTC: Date }[] = [];
  let current = new Date(startDate);
  
  while (current <= endDate) {
    const y = current.getUTCFullYear();
    const m = current.getUTCMonth();
    const d = current.getUTCDate();
    const shiftStart = new Date(Date.UTC(y, m, d, 6, 0, 0));
    const shiftEnd = new Date(shiftStart.getTime() + (18 * 60 * 60 * 1000));
    dailyIntervalConfigs.push({
      interval: `${formatISO(shiftStart)}/${formatISO(shiftEnd)}`,
      fetchNeeded: shiftStart < now,
      shiftStartUTC: shiftStart,
      shiftEndUTC: shiftEnd
    });
    current.setUTCDate(current.getUTCDate() + 1);
    if (dailyIntervalConfigs.length > 31) break;
  }

  const buckets: Record<string, any> = {};
  const agentMap: Record<string, AgentPerformance> = {};
  const callerMap: Record<string, number> = {};
  const wrapUpMap: Record<string, number> = {};
  const branchMap: Record<string, number> = {};

  dailyIntervalConfigs.forEach(conf => {
    let slot = new Date(conf.shiftStartUTC.getTime());
    while (slot < conf.shiftEndUTC) {
      const localSlot = new Date(slot.getTime() + BAGHDAD_OFFSET_MS);
      const datePart = localSlot.toISOString().split('T')[0];
      const h = localSlot.getUTCHours().toString().padStart(2, '0');
      const m = localSlot.getUTCMinutes().toString().padStart(2, '0');
      const key = `${datePart} ${h}:${m}`;
      if (!buckets[key]) {
        buckets[key] = { offered: 0, answered: 0, slMet: 0, abandoned: 0, mosSum: 0, mosCount: 0, hSum: 0, hCount: 0, agents: new Set<string>() };
      }
      slot = new Date(slot.getTime() + 30 * 60 * 1000);
    }
  });

  for (const conf of dailyIntervalConfigs) {
    if (!conf.fetchNeeded) continue;
    let pageNumber = 1;
    let hasMore = true;
    while (hasMore && pageNumber <= 100) {
      const targetUrl = `https://api.${activeRegion}/api/v2/analytics/conversations/details/query`;
      const res = await fetch(getProxiedUrl(targetUrl, creds.proxyUrl), { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({
          interval: conf.interval,
          paging: { pageSize: 100, pageNumber },
          segmentFilters: [{ type: "and", predicates: [{ type: "dimension", dimension: "queueId", operator: "matches", value: queueId }] }]
        }) 
      });

      if (!res.ok) throw new Error(`Analytics failed: ${res.status}`);
      const data = await res.json();
      const conversations = data.conversations || [];
      
      conversations.forEach((conv: any) => {
        const st = new Date(conv.conversationStart);
        const localDate = new Date(st.getTime() + BAGHDAD_OFFSET_MS);
        const datePart = localDate.toISOString().split('T')[0];
        const h = localDate.getUTCHours();
        const m = localDate.getUTCMinutes() >= 30 ? '30' : '00';
        const key = `${datePart} ${h.toString().padStart(2, '0')}:${m}`;
        
        if (buckets[key]) {
          buckets[key].offered += 1;
          let convAnswered = false;
          let convSlMet = false;

          conv.participants?.forEach((p: any) => {
            if (p.purpose === 'customer' || p.purpose === 'external') {
              p.sessions?.forEach((s: any) => {
                const rawRemote = s.ani || s.remote;
                if (rawRemote) {
                  const cleanRemote = rawRemote.replace(/^(tel:|sip:)/, '').split('@')[0];
                  callerMap[cleanRemote] = (callerMap[cleanRemote] || 0) + 1;
                }
                
                if (s.mediaType === 'voice' && s.dnis) {
                  const rawDnis = s.dnis.replace(/^(tel:|sip:)/, '').split('@')[0];
                  const normalizedDnis = normalizeDNIS(rawDnis);
                  const branchName = DNIS_TO_BRANCH[normalizedDnis];
                  if (branchName) {
                    branchMap[branchName] = (branchMap[branchName] || 0) + 1;
                  }
                }
              });
            }

            const isAgent = p.purpose === 'agent' || p.purpose === 'user';
            if (isAgent && p.userId) {
              if (!agentMap[p.userId]) {
                agentMap[p.userId] = { userId: p.userId, name: 'Loading...', answered: 0, missed: 0, handleTimeMs: 0, firstActivity: null, lastActivity: null };
              }
              const agent = agentMap[p.userId];
              p.sessions?.forEach((s: any) => {
                if (s.mediaType !== 'voice') return;
                buckets[key].agents.add(p.userId);
                
                s.mediaEndpointStats?.forEach((stat: any) => {
                  const v = stat.mos || stat.minMos;
                  if (v > 0) { buckets[key].mosSum += v; buckets[key].mosCount += 1; }
                });

                let agentInteracted = false;
                s.segments?.forEach((seg: any) => {
                  const segStart = new Date(seg.segmentStart);
                  const segEnd = seg.segmentEnd ? new Date(seg.segmentEnd) : new Date();
                  if (!agent.firstActivity || segStart < agent.firstActivity) agent.firstActivity = segStart;
                  if (!agent.lastActivity || segEnd > agent.lastActivity) agent.lastActivity = segEnd;

                  if (seg.wrapUpName || seg.wrapUpCode) {
                    const code = seg.wrapUpCode;
                    const wuName = (code && WRAP_UP_MAPPING[code]) 
                      ? WRAP_UP_MAPPING[code] 
                      : (seg.wrapUpName || seg.wrapUpCode || 'Uncoded');
                    
                    wrapUpMap[wuName] = (wrapUpMap[wuName] || 0) + 1;
                  }

                  if (['interact', 'talk', 'hold', 'afterCallWork'].includes(seg.segmentType)) {
                    convAnswered = true;
                    agentInteracted = true;
                    const dur = segEnd.getTime() - segStart.getTime();
                    buckets[key].hSum += dur;
                    agent.handleTimeMs += dur;
                    if (seg.segmentType === 'interact' && (segStart.getTime() - st.getTime() <= SL_THRESHOLD_MS)) convSlMet = true;
                  }
                });
                if (agentInteracted) agent.answered += 1;
                else if (s.segments?.some((seg: any) => seg.segmentType === 'alert')) agent.missed += 1;
              });
            }
          });
          if (convAnswered) { buckets[key].answered += 1; buckets[key].hCount += 1; if (convSlMet) buckets[key].slMet += 1; }
          else if (conv.participants?.some((p: any) => p.purpose === 'acd')) buckets[key].abandoned += 1;
        }
      });
      if (conversations.length < 100) hasMore = false; else pageNumber++;
    }
  }

  const history = Object.keys(buckets).sort().map(k => ({
    timestamp: k, offered: buckets[k].offered, answered: buckets[k].answered, abandoned: buckets[k].abandoned,
    slPercent: buckets[k].offered > 0 ? (buckets[k].slMet / buckets[k].offered) * 100 : null,
    mos: buckets[k].mosCount > 0 ? buckets[k].mosSum / buckets[k].mosCount : null,
    aht: buckets[k].hCount > 0 ? (buckets[k].hSum / 1000) / buckets[k].hCount : null,
    agentsCount: buckets[k].agents.size, conversationsCount: buckets[k].offered
  }));

  const userIds = Object.keys(agentMap);
  await fetchUserNames(creds, userIds);
  const agents = userIds.map(id => ({ ...agentMap[id], name: userCache[id] || 'Unknown Agent' }));

  const topCallers: CallerData[] = Object.entries(callerMap)
    .map(([number, count]) => ({ number, count }))
    .sort((a, b) => b.count - a.count);

  const wrapUpData: WrapUpData[] = Object.entries(wrapUpMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const branchData: BranchData[] = Object.entries(branchMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return { history, agents, topCallers, wrapUpData, branchData };
};

export const clearToken = () => { accessToken = null; tokenExpiry = 0; detectedRegion = null; };
