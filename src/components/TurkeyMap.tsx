import { useMemo } from "react";
import Svg, { G, Path } from "react-native-svg";
import { useTheme } from "@/theme/ThemeProvider";

const W_LNG = [25.6, 44.9], W_LAT = [35.8, 42.2];
const ASPECT = (W_LAT[1] - W_LAT[0]) / ((W_LNG[1] - W_LNG[0]) * Math.cos((39 * Math.PI) / 180));

export type ProvinceShapes = { type: "FeatureCollection"; features: { id: number; properties: { code: number; name: string }; geometry: { type: "MultiPolygon"; coordinates: number[][][][] } | { type: "Polygon"; coordinates: number[][][] } }[] };

// İl sınırlarından SVG Türkiye haritası; gezilen iller renklenir
export function TurkeyMap({ shapes, visited, width, visitedColor, emptyColor, strokeColor }: { shapes: ProvinceShapes; visited: Set<number>; width: number; visitedColor?: string; emptyColor?: string; strokeColor?: string }) {
  const { colors } = useTheme();
  const height = width * ASPECT;
  const paths = useMemo(() => shapes.features.map((f) => {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    let d = "";
    for (const poly of polys) for (const ring of poly) {
      ring.forEach(([lng, lat], i) => {
        const x = ((lng - W_LNG[0]) / (W_LNG[1] - W_LNG[0])) * width;
        const y = ((W_LAT[1] - lat) / (W_LAT[1] - W_LAT[0])) * height;
        d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      });
      d += "Z";
    }
    return { code: f.properties.code, d };
  }), [shapes, width, height]);
  return (
    <Svg width={width} height={height}>
      <G>
        {paths.map((p) => (
          <Path key={p.code} d={p.d} fill={visited.has(p.code) ? visitedColor ?? colors.mapVisited : emptyColor ?? colors.mapUnvisited}
            stroke={strokeColor ?? colors.background} strokeWidth={0.6} fillRule="evenodd" />
        ))}
      </G>
    </Svg>
  );
}

export const turkeyMapHeight = (width: number) => width * ASPECT;
