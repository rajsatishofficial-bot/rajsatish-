import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Sparkles,
  MessageSquare,
  Map as MapIcon,
  Navigation,
  Globe,
  SlidersHorizontal,
  Compass,
  AlertCircle,
  X,
  Layers,
} from 'lucide-react';
import { ChatThread } from './components/ChatThread.tsx';
import { MapContainer } from './components/MapContainer.tsx';
import { QuotaWarningBanner } from './components/QuotaWarningBanner.tsx';
import {
  ChatMessage,
  PlaceItem,
  AgentRole,
  MapCoordinates,
  RouteData,
} from './types/index.ts';

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AgentRole>('guide');
  const [useSearch, setUseSearch] = useState(true);
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceItem | null>(null);
  const [mapCenter, setMapCenter] = useState<MapCoordinates>({ lat: 48.8584, lng: 2.2945 });
  const [activeRoute, setActiveRoute] = useState<RouteData | null>(null);
  const [mobileTab, setMobileTab] = useState<'chat' | 'map'>('chat');
  const [showPlacesDrawer, setShowPlacesDrawer] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Quota exceeded listener
  useEffect(() => {
    const handleQuotaExceeded = () => {
      setQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  // Fetch API key from /api/config if not already in import.meta.env
  useEffect(() => {
    if (!mapsApiKey) {
      fetch('/api/config')
        .then((res) => res.json())
        .then((data) => {
          if (data.mapsApiKey) {
            setMapsApiKey(data.mapsApiKey);
          }
        })
        .catch((err) => console.warn('Could not fetch maps config:', err));
    }
  }, [mapsApiKey]);

  // Handle Send Message
  const handleSendMessage = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        text,
        timestamp: Date.now(),
      };

      const updatedHistory = [...messages, userMsg];
      setMessages(updatedHistory);
      setIsLoading(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedHistory.map((m) => ({ role: m.role, text: m.text })),
            role: selectedRole,
            mapContext: {
              lat: mapCenter.lat,
              lng: mapCenter.lng,
              selectedPlace: selectedPlace?.name,
            },
            useSearch,
          }),
        });

        if (!res.ok) {
          throw new Error(`Chat API error (${res.status})`);
        }

        const data = await res.json();

        const modelMsg: ChatMessage = {
          id: `model_${Date.now()}`,
          role: 'model',
          text: data.text || 'No response generated.',
          timestamp: Date.now(),
          places: data.places || [],
          groundingSources: data.groundingSources || [],
          searchQueries: data.searchQueries || [],
          modelUsed: data.modelUsed,
        };

        setMessages((prev) => [...prev, modelMsg]);

        // If places were extracted, merge them into places state
        if (data.places && data.places.length > 0) {
          setPlaces((prev) => {
            const existingIds = new Set(prev.map((p) => p.name.toLowerCase()));
            const newPlaces = data.places.filter(
              (p: PlaceItem) => !existingIds.has(p.name.toLowerCase())
            );
            return [...prev, ...newPlaces];
          });

          // Focus on the first newly discovered place
          setSelectedPlace(data.places[0]);
        }
      } catch (error) {
        console.error('Chat error:', error);
        const errMsg: ChatMessage = {
          id: `err_${Date.now()}`,
          role: 'model',
          text: `I encountered an issue connecting to the live intelligence service: ${(error as Error).message}. You can continue exploring places directly on the map!`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, selectedRole, mapCenter, selectedPlace, useSearch]
  );

  // Handle Ask About Place from Map
  const handleAskAboutPlace = useCallback(
    (place: PlaceItem) => {
      setSelectedPlace(place);
      const query = `Tell me more about "${place.name}"${
        place.address ? ` at ${place.address}` : ''
      }. What is it famous for, what are the hours/vibe, and what do you recommend doing or ordering here?`;
      handleSendMessage(query);
      setMobileTab('chat');
    },
    [handleSendMessage]
  );

  // Handle Request Directions
  const handleRequestDirections = useCallback(
    (destination: PlaceItem) => {
      // Find an origin: either an already selected place or current map center
      const origin =
        selectedPlace && selectedPlace.id !== destination.id
          ? { name: selectedPlace.name, lat: selectedPlace.lat, lng: selectedPlace.lng }
          : { name: 'Current Map View', lat: mapCenter.lat, lng: mapCenter.lng };

      setActiveRoute({
        origin,
        destination: {
          name: destination.name,
          lat: destination.lat,
          lng: destination.lng,
        },
        travelMode: 'DRIVING',
      });

      setSelectedPlace(destination);
      setMobileTab('map');
    },
    [selectedPlace, mapCenter]
  );

  // Filtered places
  const filteredPlaces = places.filter((p) => {
    if (selectedCategoryFilter === 'all') return true;
    return p.category === selectedCategoryFilter;
  });

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 text-slate-800 font-sans">
      {/* Sticky Mandatory Quota Defense Banner */}
      <QuotaWarningBanner visible={quotaExceeded} />

      {/* Main Navigation Bar */}
      <header className="h-14 px-4 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between z-30 shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight text-slate-900">MapGenie</span>
              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 font-bold text-[9px] rounded-full">
                AI MAPS
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Google Maps Platform + Gemini 3.8 Search Grounding
            </p>
          </div>
        </div>

        {/* Center / Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Pinned Places Counter / Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowPlacesDrawer(!showPlacesDrawer)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              places.length > 0
                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-xs hover:bg-blue-100'
                : 'bg-slate-100 text-slate-400 border-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            <span>{places.length} Spots Pinned</span>
          </button>

          {/* Mobile View Switcher */}
          <div className="flex md:hidden bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setMobileTab('chat')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                mobileTab === 'chat'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('map')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                mobileTab === 'map'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Map</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Left Panel: Chat Interface */}
        <div
          className={`w-full md:w-[440px] lg:w-[480px] shrink-0 h-full flex flex-col z-20 transition-all ${
            mobileTab === 'chat' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <ChatThread
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            selectedRole={selectedRole}
            onChangeRole={setSelectedRole}
            onSelectPlace={(p) => {
              setSelectedPlace(p);
              setMobileTab('map');
            }}
            onRequestDirections={handleRequestDirections}
            useSearch={useSearch}
            onToggleSearch={setUseSearch}
            onClearHistory={() => setMessages([])}
            currentAddress={`${mapCenter.lat.toFixed(3)}, ${mapCenter.lng.toFixed(3)}`}
          />
        </div>

        {/* Right Panel: Interactive Google Map */}
        <div
          className={`flex-1 h-full relative ${
            mobileTab === 'map' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <MapContainer
            apiKey={mapsApiKey}
            places={filteredPlaces}
            selectedPlace={selectedPlace}
            onSelectPlace={setSelectedPlace}
            onAskAboutPlace={handleAskAboutPlace}
            onMapCenterChange={setMapCenter}
            activeRoute={activeRoute}
            onClearRoute={() => setActiveRoute(null)}
          />

          {/* Slide-out Places Drawer Overlay */}
          {showPlacesDrawer && (
            <div className="absolute top-0 right-0 w-80 h-full bg-white/95 backdrop-blur-md border-l border-slate-200 shadow-2xl z-40 flex flex-col transition-all">
              <div className="p-3.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-xs text-slate-800">
                    Discovered Spots ({places.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPlacesDrawer(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Category Filter Chips */}
              <div className="p-2 border-b border-slate-100 flex gap-1 overflow-x-auto no-scrollbar">
                {['all', 'restaurant', 'cafe', 'attraction', 'park', 'shopping', 'bar'].map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategoryFilter(cat)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize shrink-0 transition-colors ${
                        selectedCategoryFilter === cat
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                )}
              </div>

              {/* Places List */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                {filteredPlaces.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No places found in this category. Ask MapGenie to discover spots!
                  </div>
                ) : (
                  filteredPlaces.map((place) => (
                    <div
                      key={place.id}
                      onClick={() => {
                        setSelectedPlace(place);
                        setMobileTab('map');
                      }}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        selectedPlace?.id === place.id
                          ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                          : 'border-slate-200 hover:border-blue-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-slate-900 leading-tight">
                          {place.name}
                        </span>
                        {place.rating && (
                          <span className="text-[10px] font-bold text-amber-500">
                            ★{place.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      {place.address && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {place.address}
                        </p>
                      )}
                      {place.highlight && (
                        <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                          "{place.highlight}"
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                        <span className="text-slate-400 capitalize">{place.category || 'Spot'}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRequestDirections(place);
                          }}
                          className="text-blue-600 font-semibold hover:underline flex items-center gap-0.5"
                        >
                          <Navigation className="w-2.5 h-2.5" />
                          <span>Directions</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
