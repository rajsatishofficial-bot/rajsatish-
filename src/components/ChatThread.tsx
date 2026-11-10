import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Search,
  Globe,
  MapPin,
  ExternalLink,
  Navigation,
  Bot,
  User,
  Trash2,
  HelpCircle,
  Coffee,
  Calendar,
  UtensilsCrossed,
  Footprints,
  Compass,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import { ChatMessage, PlaceItem, AgentPersona, AgentRole } from '../types/index.ts';

interface ChatThreadProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  selectedRole: AgentRole;
  onChangeRole: (role: AgentRole) => void;
  onSelectPlace: (place: PlaceItem) => void;
  onRequestDirections: (destination: PlaceItem) => void;
  useSearch: boolean;
  onToggleSearch: (enabled: boolean) => void;
  onClearHistory: () => void;
  currentAddress?: string;
}

const AGENT_PERSONAS: AgentPersona[] = [
  {
    id: 'guide',
    name: 'Local Guide',
    tagline: 'Neighborhood highlights & secrets',
    icon: '🧭',
    description: 'Expert on cultural spots, scenic viewpoints, and authentic neighborhood vibes.',
    defaultPrompt: 'What are the top hidden gems and iconic spots around here?',
  },
  {
    id: 'intel',
    name: 'Live Intel',
    tagline: 'Search-grounded real-time updates',
    icon: '🔍',
    description: 'Answers with live web data, today\'s hours, current events, and live status.',
    defaultPrompt: "What's happening in this area today and are local attractions open?",
  },
  {
    id: 'foodie',
    name: 'Food & Nightlife',
    tagline: 'Menus, dining & drinks concierge',
    icon: '🍽️',
    description: 'Hyper-specific culinary recommendations, signature dishes, ambiance, and price tiers.',
    defaultPrompt: 'Recommend the top 3 best-rated local restaurants and what to order.',
  },
  {
    id: 'navigator',
    name: 'Route Planner',
    tagline: 'Itineraries & navigation',
    icon: '🚗',
    description: 'Calculates distances, walking routes, transit guidance, and multi-stop journeys.',
    defaultPrompt: 'Suggest a smooth 2-hour walking tour starting from here.',
  },
];

const QUICK_PROMPTS = [
  { label: '☕ Specialty Coffee', query: 'Find the best specialty coffee shops and cafes nearby with high ratings.' },
  { label: '🌟 Top Sights & Culture', query: 'What are the most interesting landmarks or museums near this map location?' },
  { label: '🍕 Authentic Food', query: 'Recommend 3 authentic local restaurants with great ambiance open today.' },
  { label: '🚶 Walking Itinerary', query: 'Give me a scenic walking route to explore the best of this area.' },
  { label: '📅 Current Events & Status', query: 'Are there any festivals, concerts, or notable events happening around here today?' },
];

export const ChatThread: React.FC<ChatThreadProps> = ({
  messages,
  onSendMessage,
  isLoading,
  selectedRole,
  onChangeRole,
  onSelectPlace,
  onRequestDirections,
  useSearch,
  onToggleSearch,
  onClearHistory,
  currentAddress,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activePersona = AGENT_PERSONAS.find((p) => p.id === selectedRole) || AGENT_PERSONAS[0];

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Top Chat Header */}
      <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        {/* Role Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors text-left"
          >
            <span className="text-lg">{activePersona.icon}</span>
            <div>
              <div className="flex items-center gap-1 font-bold text-xs text-slate-800">
                <span>{activePersona.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className="text-[10px] text-slate-400 truncate max-w-[130px]">
                {activePersona.tagline}
              </p>
            </div>
          </button>

          {isRoleMenuOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 overflow-hidden">
              <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Select Chatbot Persona & Role
              </div>
              {AGENT_PERSONAS.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => {
                    onChangeRole(persona.id);
                    setIsRoleMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-start gap-2.5 hover:bg-slate-50 transition-colors ${
                    selectedRole === persona.id ? 'bg-blue-50/70 border-l-3 border-blue-600' : ''
                  }`}
                >
                  <span className="text-xl mt-0.5">{persona.icon}</span>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{persona.name}</div>
                    <div className="text-[11px] text-slate-500 leading-tight">{persona.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Real-Time Search Grounding Toggle */}
          <button
            type="button"
            onClick={() => onToggleSearch(!useSearch)}
            title="Toggle Google Search Grounding for live real-time information"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              useSearch
                ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            <Globe className={`w-3.5 h-3.5 ${useSearch ? 'text-blue-600' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">Search Grounding</span>
          </button>

          {/* Clear History */}
          <button
            type="button"
            onClick={onClearHistory}
            title="Reset conversation"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center px-4 py-8">
            <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg mb-3">
              <Sparkles className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold text-slate-900">MapGenie Location Chatbot</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Ask any question about restaurants, routes, hidden spots, or live events near your current map view.
            </p>

            {currentAddress && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-full text-[11px] text-slate-600">
                <MapPin className="w-3 h-3 text-blue-600" />
                <span className="truncate max-w-[220px]">Map center: {currentAddress}</span>
              </div>
            )}

            {/* Quick Prompt Starters */}
            <div className="w-full mt-6 space-y-1.5 text-left">
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase block mb-1">
                Suggested Prompts
              </span>
              {QUICK_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSendMessage(item.query)}
                  className="w-full text-left p-2.5 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-200 rounded-xl transition-all text-xs text-slate-700 flex items-center justify-between group"
                >
                  <span className="font-medium">{item.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isUser = message.role === 'user';

            return (
              <div
                key={message.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs md:text-sm leading-relaxed shadow-xs ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-xs'
                      : 'bg-slate-100 text-slate-800 rounded-tl-xs border border-slate-200/60'
                  }`}
                >
                  {/* Message Text with Simple Markdown Paragraphs */}
                  <div className="space-y-1.5 whitespace-pre-wrap">
                    {message.text}
                  </div>

                  {/* Discovered Places Cards */}
                  {!isUser && message.places && message.places.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200 space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <span>Pinned Locations ({message.places.length})</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {message.places.map((place) => (
                          <div
                            key={place.id}
                            className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-1.5 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div>
                                <h4 className="font-bold text-xs text-slate-900 leading-tight">
                                  {place.name}
                                </h4>
                                {place.address && (
                                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                                    {place.address}
                                  </p>
                                )}
                              </div>
                              {place.rating && (
                                <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                                  ★ {place.rating.toFixed(1)}
                                </span>
                              )}
                            </div>

                            {place.highlight && (
                              <p className="text-[11px] text-slate-600 italic line-clamp-2">
                                "{place.highlight}"
                              </p>
                            )}

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-1">
                              <span className="text-[10px] font-medium text-slate-400 capitalize">
                                {place.category || 'Spot'} {place.priceLevel ? `• ${place.priceLevel}` : ''}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onSelectPlace(place)}
                                  className="px-2 py-0.8 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors"
                                >
                                  <MapPin className="w-3 h-3" />
                                  <span>View on Map</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRequestDirections(place)}
                                  className="px-2 py-0.8 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors"
                                >
                                  <Navigation className="w-3 h-3" />
                                  <span>Route</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Real-time Google Search Grounding Citations */}
                  {!isUser && message.groundingSources && message.groundingSources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-200">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 mb-1.5">
                        <Globe className="w-3 h-3 text-blue-500" />
                        <span>Real-Time Google Search Grounding Sources:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {message.groundingSources.map((source, sIdx) => (
                          <a
                            key={sIdx}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] text-blue-600 hover:text-blue-800 hover:border-blue-300 transition-colors"
                          >
                            <span className="truncate max-w-[140px]">{source.title}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs shadow-xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading Spinner / Typing state */}
        {isLoading && (
          <div className="flex gap-2.5 items-center text-slate-500 text-xs">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 text-xs animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-100 px-3 py-2 rounded-2xl flex items-center gap-1.5 border border-slate-200/60">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
              <span className="ml-1 text-[11px] text-slate-500">
                {useSearch ? 'Searching Google & analyzing map...' : 'Thinking...'}
              </span>
            </div>
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>

      {/* Quick Prompt Pill Carousel (when messages exist) */}
      {messages.length > 0 && (
        <div className="px-3 py-1.5 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 bg-slate-50/50">
          {QUICK_PROMPTS.slice(0, 3).map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSendMessage(item.query)}
              className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-full text-[11px] font-medium text-slate-600 shrink-0 transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200 bg-white shrink-0">
        <div className="relative flex items-center bg-slate-100 rounded-2xl border border-slate-200/80 focus-within:border-blue-500 focus-within:bg-white transition-all shadow-inner">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${activePersona.name} about this area...`}
            className="w-full py-2.5 pl-3.5 pr-10 text-xs md:text-sm bg-transparent outline-none resize-none text-slate-800 placeholder-slate-400"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className={`absolute right-1.5 p-2 rounded-xl transition-all ${
              inputText.trim() && !isLoading
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
