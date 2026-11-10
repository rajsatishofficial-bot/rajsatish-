/// <reference types="google.maps" />
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  APIProvider,
  Map as GoogleMapComponent,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useMapsLibrary,
  MapMouseEvent,
} from '@vis.gl/react-google-maps';
import {
  Compass,
  Crosshair,
  Layers,
  MapPin,
  Navigation2,
  Sparkles,
  ExternalLink,
  Coffee,
  Utensils,
  Landmark,
  TreePine,
  ShoppingBag,
  Beer,
  Building,
  RotateCcw,
  Search,
  Route as RouteIcon,
  X,
} from 'lucide-react';
import { PlaceItem, MapCoordinates, RouteData } from '../types/index.ts';

interface MapContainerProps {
  apiKey: string;
  places: PlaceItem[];
  selectedPlace: PlaceItem | null;
  onSelectPlace: (place: PlaceItem | null) => void;
  onAskAboutPlace: (place: PlaceItem) => void;
  onMapCenterChange: (center: MapCoordinates) => void;
  activeRoute: RouteData | null;
  onClearRoute: () => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  cafe: { bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-400' },
  restaurant: { bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-400' },
  attraction: { bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-400' },
  park: { bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-400' },
  shopping: { bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-400' },
  bar: { bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-400' },
  hotel: { bg: 'bg-indigo-600', text: 'text-indigo-600', border: 'border-indigo-400' },
  transit: { bg: 'bg-slate-600', text: 'text-slate-600', border: 'border-slate-400' },
  other: { bg: 'bg-teal-600', text: 'text-teal-600', border: 'border-teal-400' },
};

function getCategoryIcon(category?: string) {
  switch (category) {
    case 'cafe':
      return <Coffee className="w-3.5 h-3.5 text-white" />;
    case 'restaurant':
      return <Utensils className="w-3.5 h-3.5 text-white" />;
    case 'park':
      return <TreePine className="w-3.5 h-3.5 text-white" />;
    case 'shopping':
      return <ShoppingBag className="w-3.5 h-3.5 text-white" />;
    case 'bar':
      return <Beer className="w-3.5 h-3.5 text-white" />;
    case 'hotel':
      return <Building className="w-3.5 h-3.5 text-white" />;
    case 'transit':
      return <Navigation2 className="w-3.5 h-3.5 text-white" />;
    case 'attraction':
    default:
      return <Landmark className="w-3.5 h-3.5 text-white" />;
  }
}

// Inner Controller that has access to useMap()
const MapController: React.FC<{
  places: PlaceItem[];
  selectedPlace: PlaceItem | null;
  onSelectPlace: (place: PlaceItem | null) => void;
  onAskAboutPlace: (place: PlaceItem) => void;
  onMapCenterChange: (center: MapCoordinates) => void;
  activeRoute: RouteData | null;
  onClearRoute: () => void;
}> = ({
  places,
  selectedPlace,
  onSelectPlace,
  onAskAboutPlace,
  onMapCenterChange,
  activeRoute,
  onClearRoute,
}) => {
  const map = useMap('main-map');
  const routesLib = useMapsLibrary('routes');
  const geometryLib = useMapsLibrary('geometry');

  const [userLocation, setUserLocation] = useState<MapCoordinates | null>(null);
  const [clickedLocation, setClickedLocation] = useState<MapCoordinates | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [searchQuery, setSearchQuery] = useState('');
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  // Pan to selected place when it changes
  useEffect(() => {
    if (map && selectedPlace) {
      map.panTo({ lat: selectedPlace.lat, lng: selectedPlace.lng });
      if ((map.getZoom() ?? 0) < 14) {
        map.setZoom(15);
      }
    }
  }, [map, selectedPlace]);

  // Fit bounds to show all places when new places arrive
  useEffect(() => {
    if (map && places.length > 0 && !selectedPlace) {
      const bounds = new google.maps.LatLngBounds();
      places.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      if (userLocation) bounds.extend(userLocation);
      map.fitBounds(bounds, { top: 70, right: 70, bottom: 70, left: 70 });
    }
  }, [map, places, selectedPlace, userLocation]);

  // Listen to map center change
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('idle', () => {
      const center = map.getCenter();
      if (center) {
        onMapCenterChange({ lat: center.lat(), lng: center.lng() });
      }
    });
    return () => google.maps.event.removeListener(listener);
  }, [map, onMapCenterChange]);

  // Handle Map Click
  const handleMapClick = useCallback((e: MapMouseEvent) => {
    if (e.detail.latLng) {
      setClickedLocation(e.detail.latLng);
    }
  }, []);

  // Compute and Render Route using modern Routes API
  useEffect(() => {
    if (!map || !routesLib) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
      setRouteInfo(null);
    }

    if (!activeRoute) return;

    try {
      const travelModeEnum =
        routesLib.TravelMode[activeRoute.travelMode] || routesLib.TravelMode.DRIVING;

      const request: any = {
        origin: { lat: activeRoute.origin.lat, lng: activeRoute.origin.lng },
        destination: { lat: activeRoute.destination.lat, lng: activeRoute.destination.lng },
        travelMode: travelModeEnum,
        fields: ['routes.distanceMeters', 'routes.durationMillis', 'routes.polyline.encodedPolyline'],
      };

      const routeConstructor = (routesLib as any).Route;
      const computePromise = routeConstructor.computeRoutes
        ? routeConstructor.computeRoutes(request)
        : new routeConstructor().computeRoutes(request);

      computePromise
        .then((response: any) => {
          if (response.routes && response.routes.length > 0) {
            const route = response.routes[0];
            if (route.polyline?.encodedPolyline && geometryLib) {
              const path = geometryLib.encoding.decodePath(route.polyline.encodedPolyline);
              const polyline = new google.maps.Polyline({
                path,
                geodesic: true,
                strokeColor: '#3B82F6',
                strokeOpacity: 0.9,
                strokeWeight: 6,
                map,
              });
              polylineRef.current = polyline;

              // Format duration and distance
              const distKm = (route.distanceMeters ? route.distanceMeters / 1000 : 0).toFixed(1);
              const durMin = route.durationMillis
                ? Math.round(route.durationMillis / 60000)
                : 0;

              setRouteInfo({
                distance: `${distKm} km`,
                duration: `${durMin} min`,
              });

              // Fit bounds to polyline
              const bounds = new google.maps.LatLngBounds();
              path.forEach((pt: google.maps.LatLng) => bounds.extend(pt));
              map.fitBounds(bounds, 50);
            }
          }
        })
        .catch((err: unknown) => {
          console.warn('Routes calculation failed, drawing fallback polyline', err);
          // Fallback direct polyline
          const fallbackPath = [
            { lat: activeRoute.origin.lat, lng: activeRoute.origin.lng },
            { lat: activeRoute.destination.lat, lng: activeRoute.destination.lng },
          ];
          const polyline = new google.maps.Polyline({
            path: fallbackPath,
            geodesic: true,
            strokeColor: '#3B82F6',
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map,
          });
          polylineRef.current = polyline;
        });
    } catch (e) {
      console.warn('Error in routesLib calculation', e);
    }
  }, [map, routesLib, geometryLib, activeRoute]);

  // Locate user with GPS
  const handleLocateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(coords);
          if (map) {
            map.panTo(coords);
            map.setZoom(15);
          }
        },
        (err) => {
          console.warn('Geolocation error:', err.message);
        },
        { enableHighAccuracy: true },
      );
    }
  };

  // Search Address / Jump to Location
  const handleSearchAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !map) return;

    try {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { address: searchQuery },
        (results: any, status: any) => {
          if (status === 'OK' && results && results[0]?.geometry?.location) {
            const loc = results[0].geometry.location;
            map.panTo(loc);
            map.setZoom(14);
            onMapCenterChange({ lat: loc.lat(), lng: loc.lng() });
          }
        }
      );
    } catch (err) {
      console.warn('Geocoding search failed', err);
    }
  };

  return (
    <>
      {/* Floating Map Search & Controls Overlay */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 pointer-events-none">
        {/* Address Search Bar */}
        <form
          onSubmit={handleSearchAddress}
          className="pointer-events-auto flex items-center bg-white/95 backdrop-blur-md shadow-lg rounded-full px-3.5 py-1.5 border border-slate-200/80 w-full md:w-80 transition-all focus-within:ring-2 focus-within:ring-blue-500"
        >
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any city, place or address..."
            className="w-full text-xs md:text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 hover:text-slate-600 text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Map View Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-white/95 backdrop-blur-md shadow-lg rounded-full p-1 border border-slate-200/80 self-end md:self-auto">
          <button
            type="button"
            onClick={handleLocateUser}
            title="My Current Location"
            className="p-2 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-colors flex items-center gap-1 text-xs font-medium"
          >
            <Crosshair className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Locate Me</span>
          </button>

          <button
            type="button"
            onClick={() => setMapType((prev) => (prev === 'roadmap' ? 'hybrid' : 'roadmap'))}
            title="Toggle Satellite / Roadmap"
            className="p-2 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-colors flex items-center gap-1 text-xs font-medium"
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">{mapType === 'roadmap' ? 'Satellite' : 'Roadmap'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (map) {
                map.setZoom(13);
                if (places[0]) map.panTo({ lat: places[0].lat, lng: places[0].lng });
              }
            }}
            title="Reset Map View"
            className="p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Route Summary Floating Card */}
      {activeRoute && (
        <div className="absolute bottom-4 left-3 right-3 md:left-6 md:right-auto md:w-96 z-10 pointer-events-auto bg-white/95 backdrop-blur-md shadow-xl rounded-2xl p-4 border border-blue-200/80">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
              <RouteIcon className="w-4 h-4" />
              <span>Active Navigation Route</span>
            </div>
            <button
              onClick={onClearRoute}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
              <div>
                <span className="text-slate-400 font-medium">Origin:</span>{' '}
                <span className="text-slate-800 font-semibold">{activeRoute.origin.name}</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 shrink-0" />
              <div>
                <span className="text-slate-400 font-medium">Destination:</span>{' '}
                <span className="text-slate-800 font-semibold">{activeRoute.destination.name}</span>
              </div>
            </div>
            {routeInfo && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-slate-700">
                <span className="font-semibold text-blue-700 text-sm">{routeInfo.duration}</span>
                <span className="text-slate-500 font-medium">{routeInfo.distance} ({activeRoute.travelMode.toLowerCase()})</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map Element */}
      <GoogleMapComponent
        id="main-map"
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        className="w-full h-full min-h-[350px]"
        defaultCenter={{ lat: 48.8584, lng: 2.2945 }} // Default Paris / center
        defaultZoom={13}
        mapTypeId={mapType}
        gestureHandling="greedy"
        disableDefaultUI={false}
        zoomControl={true}
        streetViewControl={true}
        mapTypeControl={false}
        onClick={handleMapClick}
      >
        {/* User GPS Location Marker */}
        {userLocation && (
          <AdvancedMarker position={userLocation} title="Your Location">
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-blue-400 opacity-75" />
              <div className="relative w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-md flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full" />
              </div>
            </div>
          </AdvancedMarker>
        )}

        {/* Temporary Clicked Location Marker */}
        {clickedLocation && (
          <AdvancedMarker position={clickedLocation} onClick={() => setClickedLocation(null)}>
            <div className="p-1 bg-amber-500 text-white rounded-full shadow-lg border-2 border-white animate-bounce">
              <MapPin className="w-4 h-4" />
            </div>
          </AdvancedMarker>
        )}

        {/* Clicked Location InfoWindow */}
        {clickedLocation && (
          <InfoWindow
            position={clickedLocation}
            onCloseClick={() => setClickedLocation(null)}
          >
            <div className="p-2 max-w-[220px]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                <span>Selected Coordinates</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {clickedLocation.lat.toFixed(4)}, {clickedLocation.lng.toFixed(4)}
              </p>
              <button
                onClick={() => {
                  onAskAboutPlace({
                    id: `custom_${Date.now()}`,
                    name: `Location (${clickedLocation.lat.toFixed(3)}, ${clickedLocation.lng.toFixed(3)})`,
                    lat: clickedLocation.lat,
                    lng: clickedLocation.lng,
                    category: 'attraction',
                    highlight: 'Point selected on map',
                  });
                  setClickedLocation(null);
                }}
                className="mt-2 w-full py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                <span>Ask MapGenie About This</span>
              </button>
            </div>
          </InfoWindow>
        )}

        {/* Discovered Places Markers */}
        {places.map((place) => {
          const isSelected = selectedPlace?.id === place.id;
          const style = CATEGORY_COLORS[place.category || 'other'] || CATEGORY_COLORS.other;

          return (
            <AdvancedMarker
              key={place.id}
              position={{ lat: place.lat, lng: place.lng }}
              onClick={() => onSelectPlace(place)}
              title={place.name}
            >
              <div
                className={`group relative flex items-center justify-center transition-transform cursor-pointer ${
                  isSelected ? 'scale-125 z-30' : 'hover:scale-110'
                }`}
              >
                {/* Pin Shape */}
                <div
                  className={`w-8 h-8 rounded-full ${style.bg} border-2 border-white shadow-md flex items-center justify-center text-white`}
                >
                  {getCategoryIcon(place.category)}
                </div>
                {/* Rating Badge */}
                {place.rating && (
                  <div className="absolute -top-1.5 -right-2 px-1 py-0.2 bg-white text-slate-800 font-bold text-[9px] rounded-full shadow border border-slate-100 flex items-center">
                    ★{place.rating.toFixed(1)}
                  </div>
                )}
              </div>
            </AdvancedMarker>
          );
        })}

        {/* Selected Place Details InfoWindow */}
        {selectedPlace && (
          <InfoWindow
            position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
            onCloseClick={() => onSelectPlace(null)}
          >
            <div className="p-2.5 max-w-[280px]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    {selectedPlace.category || 'Place'}
                  </span>
                  <h3 className="font-bold text-sm text-slate-900 mt-1 leading-snug">
                    {selectedPlace.name}
                  </h3>
                </div>
                {selectedPlace.rating && (
                  <span className="text-amber-500 font-bold text-xs shrink-0 flex items-center gap-0.5">
                    ★ {selectedPlace.rating.toFixed(1)}
                  </span>
                )}
              </div>

              {selectedPlace.address && (
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {selectedPlace.address}
                </p>
              )}

              {selectedPlace.highlight && (
                <p className="text-[11px] text-slate-700 mt-1.5 bg-blue-50/70 p-1.5 rounded border border-blue-100/60 italic">
                  "{selectedPlace.highlight}"
                </p>
              )}

              {selectedPlace.openStatus && (
                <div className="mt-1.5 text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{selectedPlace.openStatus}</span>
                  {selectedPlace.priceLevel && (
                    <span className="text-slate-400 ml-1">• {selectedPlace.priceLevel}</span>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => onAskAboutPlace(selectedPlace)}
                  className="w-full py-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask Chatbot About This</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${selectedPlace.name} ${selectedPlace.address || ''}`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>View on Google Maps</span>
                  </a>
                </div>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMapComponent>
    </>
  );
};

export const MapContainer: React.FC<MapContainerProps> = ({
  apiKey,
  places,
  selectedPlace,
  onSelectPlace,
  onAskAboutPlace,
  onMapCenterChange,
  activeRoute,
  onClearRoute,
}) => {
  return (
    <div className="relative w-full h-full bg-slate-100 overflow-hidden">
      <APIProvider
        apiKey={apiKey}
        libraries={['places', 'routes', 'geometry', 'marker']}
      >
        <MapController
          places={places}
          selectedPlace={selectedPlace}
          onSelectPlace={onSelectPlace}
          onAskAboutPlace={onAskAboutPlace}
          onMapCenterChange={onMapCenterChange}
          activeRoute={activeRoute}
          onClearRoute={onClearRoute}
        />
      </APIProvider>
    </div>
  );
};
