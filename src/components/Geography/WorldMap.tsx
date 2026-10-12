import { memo, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Sphere,
  Graticule,
  ZoomableGroup,
  Marker,
} from 'react-simple-maps';
import { countries } from '../../data/geography/countries';
import './MapStyles.css';

// TopoJSON URL for world countries
const WORLD_TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface WorldMapProps {
  highlightedCountry: string | null; // ISO country code to highlight (for Say mode)
  highlightedOptions?: string[]; // Multiple choice options to highlight (includes correct + decoys)
  onCountryClick: (countryCode: string, countryName?: string) => void;
  continent?: string; // Filter to show only specific continent
  showLabels?: boolean;
  disabled?: boolean;
}

// Map country names from TopoJSON to our ISO codes
const countryNameToCode: Record<string, string> = {};
countries.forEach(country => {
  countryNameToCode[country.name] = country.id;
});

// Additional mappings for TopoJSON name variations
const nameVariations: Record<string, string> = {
  'United States of America': 'US',
  'United States': 'US',
  'United Kingdom': 'GB',
  'South Korea': 'KR',
  'North Korea': 'KP',
  'Russia': 'RU',
  'Russian Federation': 'RU',
  'Dem. Rep. Congo': 'CD',
  'Democratic Republic of the Congo': 'CD',
  'Congo': 'CG',
  'Republic of the Congo': 'CG',
  'Central African Rep.': 'CF',
  'Central African Republic': 'CF',
  'Eq. Guinea': 'GQ',
  'Equatorial Guinea': 'GQ',
  'S. Sudan': 'SS',
  'South Sudan': 'SS',
  'W. Sahara': 'EH',
  'Western Sahara': 'EH',
  'Czechia': 'CZ',
  'Czech Republic': 'CZ',
  'Bosnia and Herz.': 'BA',
  'Bosnia and Herzegovina': 'BA',
  'N. Macedonia': 'MK',
  'North Macedonia': 'MK',
  'Dominican Rep.': 'DO',
  'Dominican Republic': 'DO',
  'Falkland Is.': 'FK',
  'Falkland Islands': 'FK',
  "Côte d'Ivoire": 'CI',
  'Ivory Coast': 'CI',
  'Myanmar': 'MM',
  'Burma': 'MM',
  'Lao PDR': 'LA',
  'Laos': 'LA',
  'Vietnam': 'VN',
  'Viet Nam': 'VN',
  'United Arab Emirates': 'AE',
  'UAE': 'AE',
  'Taiwan': 'TW',
  'Vatican': 'VA',
  'Vatican City': 'VA',
  'eSwatini': 'SZ',
  'Swaziland': 'SZ',
  'Solomon Is.': 'SB',
  'Solomon Islands': 'SB',
  'New Caledonia': 'NC',
  'Fr. Polynesia': 'PF',
  'French Polynesia': 'PF',
  'Puerto Rico': 'PR',
  'Greenland': 'GL',
  // Additional African country variations
  'Somaliland': 'SO', // Part of Somalia in most maps
  'The Gambia': 'GM',
  'Gambia': 'GM',
};

// Continent bounding boxes for zooming - adjusted for geoEqualEarth projection
const continentBounds: Record<string, { center: [number, number]; scale: number }> = {
  'africa': { center: [20, 0], scale: 400 },      // Africa centered
  'asia': { center: [95, 30], scale: 320 },       // Asia centered
  'europe': { center: [15, 52], scale: 500 },     // Europe centered
  'north-america': { center: [-100, 45], scale: 350 },
  'south-america': { center: [-58, -15], scale: 400 },
  'oceania': { center: [145, -25], scale: 400 },
};

// Small countries that need a marker to be visible when highlighted
const smallCountryCoords: Record<string, [number, number]> = {
  'SG': [103.8, 1.35],    // Singapore
  'BH': [50.55, 26.07],   // Bahrain
  'MT': [14.5, 35.9],     // Malta
  'LU': [6.13, 49.61],    // Luxembourg
  'AD': [1.52, 42.51],    // Andorra
  'MC': [7.42, 43.73],    // Monaco
  'VA': [12.45, 41.9],    // Vatican City
  'SM': [12.46, 43.94],   // San Marino
  'LI': [9.55, 47.17],    // Liechtenstein
  'BN': [114.95, 4.53],   // Brunei
  'QA': [51.18, 25.3],    // Qatar
  'KW': [47.98, 29.37],   // Kuwait
  'MV': [73.5, 3.2],      // Maldives
  'TL': [125.73, -8.87],  // East Timor
  'DJ': [42.59, 11.59],   // Djibouti
  'SZ': [31.5, -26.5],    // Eswatini
  'LS': [28.23, -29.61],  // Lesotho
  'GM': [-15.31, 13.44],  // Gambia
  'GW': [-15.18, 11.8],   // Guinea-Bissau
  'SL': [-11.78, 8.46],   // Sierra Leone
  'TG': [0.82, 8.62],     // Togo
  'BJ': [2.32, 9.31],     // Benin
  'RW': [29.87, -1.94],   // Rwanda
  'BI': [29.92, -3.37],   // Burundi
  'HK': [114.17, 22.32],  // Hong Kong
  'MO': [113.55, 22.2],   // Macau
  'TW': [121.0, 23.5],    // Taiwan
  'PS': [35.23, 31.95],   // Palestine
  'LB': [35.86, 33.87],   // Lebanon
  'CY': [33.43, 35.13],   // Cyprus
};

// Get country code from TopoJSON name
function getCountryCode(name: string): string | null {
  // Check direct mapping first
  if (countryNameToCode[name]) return countryNameToCode[name];
  // Check variations
  if (nameVariations[name]) return nameVariations[name];
  // Return null if not found
  return null;
}

export const WorldMap = memo(function WorldMap({
  highlightedCountry,
  highlightedOptions = [],
  onCountryClick,
  continent,
  showLabels: _showLabels = false,
  disabled = false,
}: WorldMapProps) {
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([0, 20]);

  const handleClick = useCallback((geo: any) => {
    if (disabled) return;
    const countryName = geo.properties.name;
    const code = getCountryCode(countryName);
    if (code) {
      onCountryClick(code, countryName);
    }
  }, [disabled, onCountryClick]);

  // Handle clicking on small country marker
  const handleMarkerClick = useCallback((code: string) => {
    if (disabled) return;
    const country = countries.find(c => c.id === code);
    if (country) {
      onCountryClick(code, country.name);
    }
  }, [disabled, onCountryClick]);

  // Get projection settings based on continent
  const projectionSettings = useMemo(() => {
    if (continent && continentBounds[continent.toLowerCase()]) {
      return continentBounds[continent.toLowerCase()];
    }
    return { center: [0, 0] as [number, number], scale: 160 }; // World view for geoEqualEarth
  }, [continent]);

  // Reset zoom when continent changes
  useMemo(() => {
    setZoom(1);
    setCenter(projectionSettings.center);
  }, [projectionSettings.center]);

  // Check if highlighted country is a small one that needs a marker
  const smallCountryMarker = highlightedCountry && smallCountryCoords[highlightedCountry]
    ? { code: highlightedCountry, coords: smallCountryCoords[highlightedCountry], isMain: true }
    : null;

  // Get all small countries from options that need markers (for multiple choice mode)
  const smallCountryOptionMarkers = useMemo(() => {
    return highlightedOptions
      .filter(code => smallCountryCoords[code])
      .map(code => ({ code, coords: smallCountryCoords[code], isMain: false }));
  }, [highlightedOptions]);

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.5, 6));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.5, 0.5));
  const handleReset = () => {
    setZoom(1);
    setCenter(projectionSettings.center);
  };

  // Ref for the map container to attach event listeners
  const mapRef = useRef<HTMLDivElement>(null);

  // Block double-click zoom using capture phase event listener
  useEffect(() => {
    const container = mapRef.current;
    if (!container) return;

    const blockDoubleClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    };

    // Use capture phase to intercept before ZoomableGroup sees it
    container.addEventListener('dblclick', blockDoubleClick, true);

    return () => {
      container.removeEventListener('dblclick', blockDoubleClick, true);
    };
  }, []);

  return (
    <div className="map-container world-map" ref={mapRef}>
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{
          scale: projectionSettings.scale,
          center: projectionSettings.center,
        }}
        width={980}
        height={500}
        style={{
          width: '100%',
          height: 'auto',
        }}
      >
        <ZoomableGroup
          center={center}
          zoom={zoom}
          minZoom={0.5}
          maxZoom={6}
          onMoveEnd={({ coordinates }) => {
            // Only update center (panning), ignore zoom changes from double-click/wheel
            setCenter(coordinates as [number, number]);
          }}
        >
          <Sphere
            id="sphere"
            fill="#d4e8ed"
            stroke="#b0c4cc"
            strokeWidth={0.5}
          />
          <Graticule stroke="#c5d6dc" strokeWidth={0.3} />
          <Geographies geography={WORLD_TOPO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const countryName = geo.properties.name;
                const code = getCountryCode(countryName);
                // Only highlight if both values exist and match (prevents null === null bug)
                const isHighlighted = !!(highlightedCountry && code && highlightedCountry === code);
                // Check if this is one of the multiple choice options
                const isOption = !!(code && highlightedOptions.length > 0 && highlightedOptions.includes(code));
                // Country should be emphasized if it's highlighted OR if it's an option
                const isEmphasized = isHighlighted || isOption;
                // All countries are clickable - let the game logic determine if it's correct
                const isClickable = !disabled;

                // Determine fill color based on state
                const getFillColor = () => {
                  if (isHighlighted) return '#2196F3'; // Blue for the answer in Say mode
                  if (isOption) return '#FFC107'; // Yellow/gold for multiple choice options
                  return '#b8d4a8'; // Default green
                };

                const getStrokeColor = () => {
                  if (isHighlighted) return '#0D47A1';
                  if (isOption) return '#FF8F00';
                  return '#8fa87f';
                };

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => isClickable && handleClick(geo)}
                    className={`country ${isHighlighted ? 'country--highlighted' : ''} ${isOption ? 'country--option' : ''} ${disabled ? 'country--disabled' : ''}`}
                    style={{
                      default: {
                        fill: getFillColor(),
                        stroke: getStrokeColor(),
                        strokeWidth: isEmphasized ? 2.5 : 0.5,
                        outline: 'none',
                        cursor: isClickable ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                        filter: isEmphasized ? `drop-shadow(0 0 8px ${isHighlighted ? 'rgba(33, 150, 243, 0.7)' : 'rgba(255, 193, 7, 0.7)'})` : 'none',
                      },
                      hover: {
                        fill: isHighlighted ? '#42A5F5' : isOption ? '#FFD54F' : '#7cb342',
                        stroke: isHighlighted ? '#1565C0' : isOption ? '#FF6F00' : '#558b2f',
                        strokeWidth: isEmphasized ? 3 : 1.5,
                        outline: 'none',
                        cursor: isClickable ? 'pointer' : 'default',
                        filter: isEmphasized
                          ? `drop-shadow(0 0 12px ${isHighlighted ? 'rgba(33, 150, 243, 0.9)' : 'rgba(255, 193, 7, 0.9)'})`
                          : 'drop-shadow(0 0 4px rgba(124, 179, 66, 0.5))',
                      },
                      pressed: {
                        fill: isHighlighted ? '#1976D2' : isOption ? '#FFA000' : '#558b2f',
                        stroke: isHighlighted ? '#0D47A1' : isOption ? '#E65100' : '#33691e',
                        strokeWidth: isEmphasized ? 3 : 2,
                        outline: 'none',
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>

          {/* Markers for small countries that are hard to see */}
          {smallCountryMarker && (
            <Marker coordinates={smallCountryMarker.coords}>
              <g
                onClick={() => handleMarkerClick(smallCountryMarker.code)}
                style={{ cursor: disabled ? 'default' : 'pointer' }}
              >
                {/* Pulsing outer ring */}
                <circle
                  r={12}
                  fill="none"
                  stroke="#2196F3"
                  strokeWidth={3}
                  className="small-country-pulse"
                />
                {/* Inner filled circle */}
                <circle
                  r={8}
                  fill="#2196F3"
                  stroke="#0D47A1"
                  strokeWidth={2}
                />
                {/* Arrow pointing down */}
                <path
                  d="M0,-20 L0,-35"
                  stroke="#2196F3"
                  strokeWidth={3}
                  markerEnd="url(#arrowhead)"
                />
              </g>
            </Marker>
          )}

          {/* Markers for small countries in multiple choice options */}
          {smallCountryOptionMarkers.map((marker) => (
            <Marker key={marker.code} coordinates={marker.coords}>
              <g
                onClick={() => handleMarkerClick(marker.code)}
                style={{ cursor: disabled ? 'default' : 'pointer' }}
              >
                {/* Pulsing outer ring - yellow for options */}
                <circle
                  r={12}
                  fill="none"
                  stroke="#FFC107"
                  strokeWidth={3}
                  className="small-country-pulse"
                />
                {/* Inner filled circle */}
                <circle
                  r={8}
                  fill="#FFC107"
                  stroke="#FF8F00"
                  strokeWidth={2}
                />
              </g>
            </Marker>
          ))}

          {/* Arrow marker definitions */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="6"
              markerHeight="6"
              refX="3"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 6 3, 0 6" fill="#2196F3" />
            </marker>
            <marker
              id="arrowhead-yellow"
              markerWidth="6"
              markerHeight="6"
              refX="3"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 6 3, 0 6" fill="#FFC107" />
            </marker>
          </defs>
        </ZoomableGroup>
      </ComposableMap>

      {/* Zoom controls */}
      <div className="map-zoom-controls">
        <button
          className="map-zoom-btn"
          onClick={handleZoomIn}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          className="map-zoom-btn"
          onClick={handleZoomOut}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          className="map-zoom-btn map-zoom-btn--reset"
          onClick={handleReset}
          title="Reset view"
          aria-label="Reset view"
        >
          ↺
        </button>
      </div>
    </div>
  );
});

export default WorldMap;
