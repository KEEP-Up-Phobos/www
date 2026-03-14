export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  name?: string;
  avatar?: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  birthdate?: string;
  interests?: string[];
  groups?: number[];
  photos?: string[];
  created_at?: string;
  is_admin?: boolean;
  isSuperUser?: boolean;
  [key: string]: any;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  category: string;
  image?: string;
  distance_km?: number;
  attendees?: number;
  url?: string;
  organizer?: User;
  showOnMap?: boolean;
  hasDate?: boolean;
  venue_name?: string;
  venue_city?: string;
  source?: string;
  [key: string]: any;
}

export interface EventCreateRequest {
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  category: string;
  image?: string;
  [key: string]: any;
}

export interface AuthResponse {
  ok: boolean;
  user: User;
  sessionToken?: string;
  bearerToken?: string;
  token?: string;
  socketTicket?: string;
  [key: string]: any;
}
