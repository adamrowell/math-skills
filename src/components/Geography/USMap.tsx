import { memo, useCallback } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from 'react-simple-maps';
import { usStates } from '../../data/geography/usStates';
import './MapStyles.css';

// TopoJSON URL for US states (using Albers USA projection)
const US_TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

interface USMapProps {
  highlightedState: string | null; // State abbreviation to highlight (for Say mode)
  highlightedOptions?: string[]; // Multiple choice options to highlight (includes correct + decoys)
  onStateClick: (stateId: string, stateName?: string) => void;
  showLabels?: boolean;
  disabled?: boolean;
}

// State name to abbreviation mapping
const stateNameToAbbr: Record<string, string> = {};
usStates.forEach(state => {
  stateNameToAbbr[state.name] = state.abbreviation;
});

// State centroid positions for labels (approximate)
const stateCentroids: Record<string, [number, number]> = {
  'AL': [-86.9, 32.8], 'AK': [-153.5, 64.2], 'AZ': [-111.9, 34.2],
  'AR': [-92.4, 34.9], 'CA': [-119.4, 37.2], 'CO': [-105.5, 39.0],
  'CT': [-72.7, 41.6], 'DE': [-75.5, 39.0], 'FL': [-81.7, 28.1],
  'GA': [-83.5, 32.6], 'HI': [-155.5, 19.9], 'ID': [-114.5, 44.4],
  'IL': [-89.0, 40.0], 'IN': [-86.1, 39.9], 'IA': [-93.5, 42.0],
  'KS': [-98.4, 38.5], 'KY': [-85.3, 37.8], 'LA': [-92.0, 31.0],
  'ME': [-69.0, 45.4], 'MD': [-76.6, 39.0], 'MA': [-71.8, 42.2],
  'MI': [-84.5, 44.3], 'MN': [-94.3, 46.3], 'MS': [-89.7, 32.7],
  'MO': [-92.5, 38.4], 'MT': [-110.4, 47.0], 'NE': [-99.8, 41.5],
  'NV': [-117.0, 39.5], 'NH': [-71.6, 43.7], 'NJ': [-74.7, 40.2],
  'NM': [-106.0, 34.4], 'NY': [-75.5, 43.0], 'NC': [-79.4, 35.5],
  'ND': [-100.5, 47.4], 'OH': [-82.8, 40.3], 'OK': [-97.5, 35.5],
  'OR': [-120.5, 44.0], 'PA': [-77.6, 41.0], 'RI': [-71.5, 41.7],
  'SC': [-80.9, 33.9], 'SD': [-100.2, 44.4], 'TN': [-86.3, 35.8],
  'TX': [-99.3, 31.5], 'UT': [-111.7, 39.3], 'VT': [-72.7, 44.0],
  'VA': [-78.8, 37.5], 'WA': [-120.5, 47.4], 'WV': [-80.6, 38.9],
  'WI': [-89.6, 44.6], 'WY': [-107.5, 43.0],
};

export const USMap = memo(function USMap({
  highlightedState,
  highlightedOptions = [],
  onStateClick,
  showLabels = false,
  disabled = false,
}: USMapProps) {
  const handleClick = useCallback((geo: any) => {
    if (disabled) return;
    const stateName = geo.properties.name;
    const abbr = stateNameToAbbr[stateName];
    if (abbr) {
      onStateClick(abbr, stateName);
    }
  }, [disabled, onStateClick]);

  return (
    <div className="map-container us-map">
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{
          scale: 900,
        }}
        width={980}
        height={550}
        style={{
          width: '100%',
          height: 'auto',
        }}
      >
        <Geographies geography={US_TOPO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const stateName = geo.properties.name;
              const abbr = stateNameToAbbr[stateName];
              const isHighlighted = highlightedState === abbr;
              // Check if this is one of the multiple choice options
              const isOption = !!(abbr && highlightedOptions.length > 0 && highlightedOptions.includes(abbr));
              // State should be emphasized if it's highlighted OR if it's an option
              const isEmphasized = isHighlighted || isOption;

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
                  onClick={() => handleClick(geo)}
                  className={`state ${isHighlighted ? 'state--highlighted' : ''} ${isOption ? 'state--option' : ''} ${disabled ? 'state--disabled' : ''}`}
                  style={{
                    default: {
                      fill: getFillColor(),
                      stroke: getStrokeColor(),
                      strokeWidth: isEmphasized ? 2.5 : 0.5,
                      outline: 'none',
                      cursor: disabled ? 'default' : 'pointer',
                      transition: 'all 0.2s ease',
                      filter: isEmphasized ? `drop-shadow(0 0 8px ${isHighlighted ? 'rgba(33, 150, 243, 0.7)' : 'rgba(255, 193, 7, 0.7)'})` : 'none',
                    },
                    hover: {
                      fill: isHighlighted ? '#42A5F5' : isOption ? '#FFD54F' : '#7cb342',
                      stroke: isHighlighted ? '#1565C0' : isOption ? '#FF6F00' : '#558b2f',
                      strokeWidth: isEmphasized ? 3 : 1.5,
                      outline: 'none',
                      cursor: disabled ? 'default' : 'pointer',
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

        {/* Labels for hints */}
        {showLabels &&
          Object.entries(stateCentroids).map(([abbr, coords]) => (
            <Marker key={abbr} coordinates={coords}>
              <text
                textAnchor="middle"
                style={{
                  fontFamily: 'system-ui',
                  fontSize: '8px',
                  fontWeight: highlightedState === abbr ? 'bold' : 'normal',
                  fill: highlightedState === abbr ? '#FF5722' : '#333',
                  pointerEvents: 'none',
                }}
              >
                {abbr}
              </text>
            </Marker>
          ))}
      </ComposableMap>
    </div>
  );
});

export default USMap;
