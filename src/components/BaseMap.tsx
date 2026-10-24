import { Camera, Map, type CameraRef, type MapProps, type ViewStateChangeEvent } from "@maplibre/maplibre-react-native";
import type { ReactNode, Ref } from "react";
import { StyleSheet, View, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from "react-native";
import { MAP_STYLE_DARK, MAP_STYLE_LIGHT, TURKEY_CENTER } from "@/lib/config";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "./ui";

type Props = {
  cameraRef?: Ref<CameraRef>;
  initialCenter?: [number, number];
  initialZoom?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onRegionDidChange?: (e: ViewStateChangeEvent) => void;
  onRegionIsChanging?: (e: ViewStateChangeEvent) => void;
  onPress?: MapProps["onPress"];
  onLongPress?: MapProps["onLongPress"];
  attributionBottom?: number;
  interactive?: boolean;
};

// Tüm haritaların ortak temeli: tema uyumlu stil + OSM atfı
export function BaseMap({ cameraRef, initialCenter = TURKEY_CENTER, initialZoom = 5.2, children, style, onRegionDidChange, onRegionIsChanging, onPress, onLongPress, attributionBottom = 6, interactive = true }: Props) {
  const { isDark, colors } = useTheme();
  return (
    <View style={[{ flex: 1 }, style]}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        logo={false}
        attribution={false}
        compass={interactive}
        compassPosition={{ top: 120, right: 12 }}
        scaleBar={false}
        tintColor={colors.primary}
        touchPitch={false}
        dragPan={interactive}
        touchZoom={interactive}
        doubleTapZoom={interactive}
        touchRotate={interactive}
        onPress={onPress}
        onLongPress={onLongPress}
        onRegionDidChange={onRegionDidChange ? (e: NativeSyntheticEvent<ViewStateChangeEvent>) => onRegionDidChange(e.nativeEvent) : undefined}
        onRegionIsChanging={onRegionIsChanging ? (e: NativeSyntheticEvent<ViewStateChangeEvent>) => onRegionIsChanging(e.nativeEvent) : undefined}
      >
        <Camera ref={cameraRef} initialViewState={{ center: initialCenter, zoom: initialZoom }} minZoom={4} maxZoom={18} />
        {children}
      </Map>
      <View pointerEvents="none" style={{ position: "absolute", left: 8, bottom: attributionBottom, backgroundColor: colors.surface + "CC", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
        <Txt variant="caption" color="secondary">© OpenStreetMap</Txt>
      </View>
    </View>
  );
}
