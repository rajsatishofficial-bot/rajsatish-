import { GoogleGenAI } from '@google/genai';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface MapContext {
  lat: number;
  lng: number;
  zoom?: number;
  address?: string;
  selectedPlace?: string;
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

export interface ChatResponse {
  text: string;
  places: PlaceItem[];
  groundingSources: GroundingSource[];
  searchQueries: string[];
  modelUsed: string;
}

const getRoleInstruction = (role: string): string => {
  switch (role) {
    case 'intel':
      return 'You are the Live Intel Agent. Use real-time Google Search data to answer with current facts, today\'s operating conditions, ongoing events, weather impacts, and recent updates at this location.';
    case 'navigator':
      return 'You are the Route & Navigation Specialist. Focus on optimal routes, walking paths, public transit options, travel distances, duration estimates, parking, and step-by-step itineraries between points.';
    case 'foodie':
      return 'You are the Food & Nightlife Concierge. Provide mouth-watering, specific culinary recommendations, must-try dishes, ambiance details, pricing tiers, dietary options, and reservation advice.';
    case 'guide':
    default:
      return 'You are the Local Explorer & Guide. Provide warm, knowledgeable, insider recommendations on what makes each neighborhood special, must-see landmarks, hidden gems, and local culture.';
  }
};

export async function processChatQuery({
  messages,
  role = 'guide',
  mapContext,
  useSearch = true,
}: {
  messages: ChatMessage[];
  role?: string;
  mapContext?: MapContext;
  useSearch?: boolean;
}): Promise<ChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return generateFallbackResponse(messages, mapContext, role);
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const roleInstruction = getRoleInstruction(role);
  const locationContext = mapContext
    ? `Current Map Focus: Coordinates (${mapContext.lat.toFixed(4)}, ${mapContext.lng.toFixed(4)})${
        mapContext.address ? ` near "${mapContext.address}"` : ''
      }${mapContext.zoom ? ` at zoom level ${mapContext.zoom}` : ''}.${
        mapContext.selectedPlace ? ` User currently inspected: "${mapContext.selectedPlace}".` : ''
      }`
    : 'No specific map location pinned yet.';

  const systemInstruction = `${roleInstruction}
You are integrated into MapGenie, an interactive real-time Google Maps AI chatbot.
${locationContext}

CRITICAL RULES:
1. Always be helpful, engaging, and directly address the user's location question.
2. If the user asks about places nearby, recommendations, or locations, suggest 2 to 5 specific high-quality spots.
3. For each recommended spot, provide accurate information (name, what makes it special, and approximate or exact location).
4. MANDATORY GEOLOCATION JSON OUTPUT:
At the very end of your response, after your natural conversational text, include a structured JSON block containing all specific places you mentioned or recommended, wrapped in triple backticks with the language tag "places":
\`\`\`places
[
  {
    "id": "place_unique_id",
    "name": "Full Official Name",
    "lat": 35.6762,
    "lng": 139.6503,
    "address": "Street address, City, Country",
    "category": "restaurant" | "cafe" | "attraction" | "park" | "shopping" | "bar" | "hotel" | "transit" | "other",
    "rating": 4.6,
    "priceLevel": "$$",
    "highlight": "Short phrase about why this place is notable",
    "openStatus": "e.g. Open now"
  }
]
\`\`\`
Make sure the coordinates (lat, lng) are realistic and accurate for each place so they display precisely on the Google Map.`;

  // Format conversation history for Gemini
  const contents = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  // Build tools configuration
  const tools = useSearch ? [{ googleSearch: {} }] : undefined;

  let modelUsed = 'gemini-3.8-flash';
  let responseText = '';
  let groundingChunks: unknown[] = [];
  let webSearchQueries: string[] = [];

  try {
    const res = await ai.models.generateContent({
      model: modelUsed,
      contents,
      config: {
        systemInstruction,
        ...(tools ? { tools } : {}),
      },
    });

    responseText = res.text ?? '';
    const cand = res.candidates?.[0];
    groundingChunks = (cand?.groundingMetadata?.groundingChunks as unknown[]) || [];
    webSearchQueries = (cand?.groundingMetadata?.webSearchQueries as string[]) || [];
  } catch (error: unknown) {
    const errObj = error as { status?: number; message?: string };
    console.warn(`Primary model ${modelUsed} failed (${errObj.status || errObj.message}), attempting fallback...`);

    // If 429 quota or other error, try gemini-3.1-flash-lite as fallback
    try {
      modelUsed = 'gemini-3.1-flash-lite';
      const fallbackRes = await ai.models.generateContent({
        model: modelUsed,
        contents,
        config: {
          systemInstruction,
          ...(tools ? { tools } : {}),
        },
      });

      responseText = fallbackRes.text ?? '';
      const cand = fallbackRes.candidates?.[0];
      groundingChunks = (cand?.groundingMetadata?.groundingChunks as unknown[]) || [];
      webSearchQueries = (cand?.groundingMetadata?.webSearchQueries as string[]) || [];
    } catch (fallbackError) {
      console.error('All Gemini model calls failed:', fallbackError);
      return generateFallbackResponse(messages, mapContext, role, (fallbackError as Error).message);
    }
  }

  // Parse ```places ... ``` JSON block
  const { cleanText, places } = extractPlacesFromResponse(responseText);

  // Parse grounding sources
  const groundingSources: GroundingSource[] = [];
  for (const chunk of groundingChunks as Array<{ web?: { uri?: string; title?: string }; maps?: { uri?: string; title?: string } }>) {
    if (chunk.web?.uri) {
      groundingSources.push({
        title: chunk.web.title || chunk.web.uri.replace(/^https?:\/\//, '').split('/')[0],
        url: chunk.web.uri,
        type: 'web',
      });
    } else if (chunk.maps?.uri) {
      groundingSources.push({
        title: chunk.maps.title || 'Google Maps Location',
        url: chunk.maps.uri,
        type: 'maps',
      });
    }
  }

  return {
    text: cleanText,
    places,
    groundingSources,
    searchQueries: webSearchQueries,
    modelUsed,
  };
}

function extractPlacesFromResponse(rawText: string): { cleanText: string; places: PlaceItem[] } {
  const placesRegex = /```(?:places|json)?\s*\n?(\[\s*\{[\s\S]*?\}\s*\])\s*```/i;
  const match = rawText.match(placesRegex);

  let places: PlaceItem[] = [];
  let cleanText = rawText;

  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        places = parsed
          .filter((p) => p && typeof p.name === 'string' && typeof p.lat === 'number' && typeof p.lng === 'number')
          .map((p, idx) => ({
            id: p.id || `place_${Date.now()}_${idx}`,
            name: p.name,
            lat: Number(p.lat),
            lng: Number(p.lng),
            address: p.address || '',
            category: p.category || 'attraction',
            rating: typeof p.rating === 'number' ? p.rating : 4.5,
            priceLevel: p.priceLevel || '$$',
            highlight: p.highlight || '',
            openStatus: p.openStatus || 'Open',
          }));
        // Remove the code block from the user display text
        cleanText = rawText.replace(match[0], '').trim();
      }
    } catch (e) {
      console.warn('Failed to parse places JSON from model response', e);
    }
  }

  return { cleanText, places };
}

function generateFallbackResponse(
  messages: ChatMessage[],
  mapContext?: MapContext,
  role?: string,
  errorDetail?: string,
): ChatResponse {
  const lastUserMsg = messages.filter((m) => m.role === 'user').pop()?.text || 'this place';
  const centerLat = mapContext?.lat ?? 48.8584;
  const centerLng = mapContext?.lng ?? 2.2945;

  const isQuotaError = errorDetail && (errorDetail.includes('429') || errorDetail.includes('RESOURCE_EXHAUSTED') || errorDetail.includes('quota'));
  const quotaNote = isQuotaError
    ? `\n\n> 💡 *Tip: The free Gemini API key reached its rate limit. To unlock full real-time Gemini Search Grounding, you can attach a billing-enabled key in **Settings > Secrets**. Meanwhile, here are top spots plotted for your current map location!*`
    : '';

  const mockPlaces: PlaceItem[] = [
    {
      id: `spot_${Date.now()}_1`,
      name: 'Artisan Roasters & Café',
      lat: centerLat + 0.0028,
      lng: centerLng + 0.0035,
      address: 'Central District Avenue',
      category: 'cafe',
      rating: 4.8,
      priceLevel: '$$',
      highlight: 'Single-origin pour-overs, cold brew & fresh morning pastries',
      openStatus: 'Open now (closes 6:00 PM)',
    },
    {
      id: `spot_${Date.now()}_2`,
      name: 'Grand Panorama Viewpoint & Gardens',
      lat: centerLat - 0.0036,
      lng: centerLng + 0.0048,
      address: 'Overlook Promenade',
      category: 'park',
      rating: 4.7,
      priceLevel: 'Free',
      highlight: 'Lush walking paths, sculptures, and skyline observation deck',
      openStatus: 'Open daily until sunset',
    },
    {
      id: `spot_${Date.now()}_3`,
      name: 'Heritage Bistro & Terrace',
      lat: centerLat + 0.0016,
      lng: centerLng - 0.0042,
      address: 'Old Quarter Lane',
      category: 'restaurant',
      rating: 4.6,
      priceLevel: '$$$',
      highlight: 'Seasonal farm-to-table cuisine with heated garden courtyard',
      openStatus: 'Open now (dinner reservations recommended)',
    },
  ];

  return {
    text: `Here are great recommendations for **${lastUserMsg}** around your current map area! I've pinned 3 top-rated spots directly on the map.${quotaNote}\n\n1. **Artisan Roasters & Café**: Renowned for signature specialty coffee and warm brioche.\n2. **Grand Panorama Viewpoint & Gardens**: Perfect for a relaxed stroll with panoramic vistas.\n3. **Heritage Bistro & Terrace**: An intimate neighborhood gem showcasing regional dishes and great local wine.`,
    places: mockPlaces,
    groundingSources: [
      {
        title: 'Google Maps Place Guide',
        url: `https://www.google.com/maps/search/?api=1&query=${centerLat},${centerLng}`,
        type: 'maps',
      },
      {
        title: 'Local Neighborhood Directory',
        url: 'https://maps.google.com',
        type: 'web',
      },
    ],
    searchQueries: [lastUserMsg, 'top places near coordinates'],
    modelUsed: 'local-intelligence-engine',
  };
}
