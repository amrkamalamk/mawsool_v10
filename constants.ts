
import { Region } from './types';

export const GENESYS_ORG_DEFAULT = 'horizonscope-cx2';
export const GENESYS_REGION_DEFAULT = Region.UAE;
export const MOS_THRESHOLD_DEFAULT = 4.5;
export const POLLING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const QUEUE_NAME_DEFAULT = 'Super Chicken';

// Embedded credentials for horizonscope-cx2
export const DEFAULT_CLIENT_ID = 'ce4488b2-0651-48a8-9725-f91fb219dcff'; 
export const DEFAULT_CLIENT_SECRET = 'JT5aQGA0Vr3N7cSr0TKgWli8Nk6DUKgZymF0kp0NICo';

export interface ProxyOption {
  id: string;
  name: string;
  url: string;
  testUrl: string;
  description: string;
  supportsPost: boolean;
}

export const PROXY_OPTIONS: ProxyOption[] = [
  { 
    id: 'corsproxy-io',
    name: 'Standard Route (CORSProxy.io)', 
    url: 'https://corsproxy.io/?',
    testUrl: 'https://corsproxy.io/?https://google.com',
    description: 'Fastest route for Dubai/UAE region.',
    supportsPost: true
  },
  { 
    id: 'is-proxied',
    name: 'Enterprise Route (Vercel)', 
    url: 'https://is-proxied.vercel.app/api/proxy?url=',
    testUrl: 'https://is-proxied.vercel.app/api/proxy?url=https://google.com',
    description: 'Highly reliable fallback bridge.',
    supportsPost: true
  },
  { 
    id: 'direct',
    name: 'Direct Link (NO PROXY)', 
    url: '',
    testUrl: 'https://google.com',
    description: 'Bypasses all intermediaries. Requires "Allow CORS" extension.',
    supportsPost: true
  }
];

export const DEFAULT_PROXY = PROXY_OPTIONS[0].url;
