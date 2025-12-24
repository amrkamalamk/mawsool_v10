
export interface UnifiedDataPoint {
  timestamp: string;
  offered: number;
  answered: number;
  abandoned: number;
  mos: number | null;
  aht: number | null; // Average Handle Time in seconds
  agentsCount: number; // Number of unique agents active in this interval
  slPercent: number | null; // Service Level Percentage
  conversationsCount: number;
}

export interface AgentPerformance {
  userId: string;
  name: string;
  answered: number;
  missed: number; // Alerts that were not answered
  handleTimeMs: number;
  firstActivity: Date | null;
  lastActivity: Date | null;
}

export interface WrapUpData {
  name: string;
  count: number;
}

export interface BranchData {
  name: string;
  count: number;
}

export interface CallerData {
  number: string;
  count: number;
}

export interface InteractionData {
  id: string;
  startTime: string;
  direction: 'inbound' | 'outbound';
  durationMs: number;
  ani?: string;
  dnis?: string;
}

export interface MOSDataPoint {
  timestamp: string;
  mos: number;
  conversationsCount: number;
}

export interface Alert {
  id: string;
  timestamp: string;
  value: number;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export enum Region {
  UAE = 'mec1.pure.cloud',
  US_EAST = 'mypurecloud.com'
}

export interface GenesysCredentials {
  clientId: string;
  clientSecret: string;
  orgName: string;
  region: Region;
  proxyUrl?: string;
  manualToken?: string;
}
