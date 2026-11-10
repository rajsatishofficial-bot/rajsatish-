export type AgentRole = 'guide' | 'intel' | 'navigator' | 'foodie';

export interface AgentPersona {
  id: AgentRole;
  name: string;
  tagline: string;
  icon: string;
  description: string;
  defaultPrompt: string;
}

export interface PlaceItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  category?: 'restaurant' | 'cafe' | 'attraction' | 'park' | 'shopping' | 'bar' | 'hotel' | 'transit' | 'other';
  rating?: number;
  priceLevel?: string;
  highlight?: string;
  openStatus?: string;
}

export interface GroundingSource {
  title: string;
  url: string;
  type: 'web' | 'maps';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  places?: PlaceItem[];
  groundingSources?: GroundingSource[];
  searchQueries?: string[];
  modelUsed?: string;
}

export interface MapCoordinates {
  lat: number;
  lng: number;
}

export interface RouteData {
  origin: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
  distanceMeters?: number;
  duration?: string;
  travelMode: 'DRIVING' | 'WALKING' | 'TRANSIT';
}
