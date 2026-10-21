import React from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

const geoUrl = "/india-states.json";

const STATE_COORDINATES: Record<string, [number, number]> = {
  "Andhra Pradesh": [79.74, 15.91],
  "Arunachal Pradesh": [94.72, 28.21],
  "Assam": [92.93, 26.20],
  "Bihar": [85.31, 25.09],
  "Chhattisgarh": [81.86, 21.27],
  "Goa": [74.12, 15.29],
  "Gujarat": [71.19, 22.25],
  "Haryana": [76.08, 29.05],
  "Himachal Pradesh": [77.17, 31.10],
  "Jharkhand": [85.27, 23.61],
  "Karnataka": [75.71, 15.31],
  "Kerala": [76.27, 10.85],
  "Madhya Pradesh": [78.65, 22.97],
  "Maharashtra": [75.71, 19.75],
  "Manipur": [93.90, 24.66],
  "Meghalaya": [91.36, 25.46],
  "Mizoram": [92.93, 23.16],
  "Nagaland": [94.56, 26.15],
  "Odisha": [85.09, 20.95],
  "Punjab": [75.34, 31.14],
  "Rajasthan": [74.21, 27.02],
  "Sikkim": [88.51, 27.53],
  "Tamil Nadu": [78.65, 11.12],
  "Telangana": [79.01, 18.11],
  "Tripura": [91.98, 23.94],
  "Uttar Pradesh": [80.94, 26.84],
  "Uttarakhand": [79.01, 30.06],
  "West Bengal": [87.85, 22.98],
  "Delhi": [77.10, 28.70]
};

export default function IndiaMap({ disasters }: { disasters: any[] }) {
  const markers = disasters.map(d => {
    const coords = STATE_COORDINATES[d.state];
    return coords ? { ...d, coordinates: coords } : null;
  }).filter(d => d !== null);

  const getMarkerColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return '#E0745E'; // Terracotta
      case 'HIGH': return '#F4B13B'; // Gold
      case 'MEDIUM': return '#0F3D3A'; // Forest
      default: return '#0F3D3A';
    }
  };

  // Map each state to its highest active disaster severity
  const activeStateSeverities: Record<string, string> = {};
  disasters.forEach(d => {
    const stateName = d.state.toLowerCase();
    const current = activeStateSeverities[stateName];
    if (!current || d.severity === 'CRITICAL' || (d.severity === 'HIGH' && current !== 'CRITICAL')) {
      activeStateSeverities[stateName] = d.severity;
    }
  });

  return (
    <div className="w-full flex items-center justify-center p-4">
      <div style={{ width: "100%", maxWidth: "700px", height: "600px" }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 1000,
            center: [81, 23.5] // Adjusted slightly down to fit J&K perfectly
          }}
          width={700}
          height={600}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const geoName = geo.properties?.ST_NM?.toLowerCase() || '';
                
                // Match the geoName to our state severities
                const matchedState = Object.keys(activeStateSeverities).find(
                  s => geoName.includes(s) || s.includes(geoName)
                );
                
                const severity = matchedState ? activeStateSeverities[matchedState] : null;
                const fillStyle = severity ? getMarkerColor(severity) : "#F2E6D6";

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fillStyle}
                    stroke="#0F3D3A" 
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none", fill: fillStyle, transition: "fill 0.3s" },
                      hover: { fill: "#E0745E", outline: "none", opacity: 0.8 }, 
                      pressed: { outline: "none" },
                    } as any}
                  />
                );
              })
            }
          </Geographies>

          {markers.map((marker, i) => (
            <Marker key={i} coordinates={marker.coordinates}>
              <circle r={8} fill={getMarkerColor(marker.severity)} stroke="#fff" strokeWidth={2} className="drop-shadow-sm" />
              <text
                textAnchor="middle"
                y={22}
                style={{ fontFamily: "Inter, sans-serif", fill: "#0F3D3A", fontSize: "11px", fontWeight: "bold" }}
              >
                {marker.name}
              </text>
            </Marker>
          ))}
        </ComposableMap>
      </div>
    </div>
  );
}
