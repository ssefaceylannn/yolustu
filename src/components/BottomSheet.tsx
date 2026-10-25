/* eslint-disable react-hooks/refs */
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Animated, PanResponder, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/typography";
import { shadow } from "./ui";

// Sürüklenebilir alt panel: aşağıda küçük şerit, ortada yarım, en üstte tam ekran.
// Tutamak ve başlık alanından tutup çekilir.
export function BottomSheet({ header, children, peek = 120 }: { header: ReactNode; children: ReactNode; peek?: number }) {
  "use no memo"; // hareket değerleri ref'te tutulur; derleyici optimizasyonu kapalı
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const snaps = useMemo(() => [peek, Math.round(height * 0.5), height - insets.top - 8], [peek, height, insets.top]);
  const h = useRef(new Animated.Value(snaps[1])).current;
  const current = useRef(snaps[1]);
  const start = useRef(snaps[1]);

  useEffect(() => {
    const id = h.addListener(({ value }) => { current.current = value; });
    return () => h.removeListener(id);
  }, [h]);

  const snapTo = (v: number) => Animated.spring(h, { toValue: v, useNativeDriver: false, bounciness: 0, speed: 16 }).start();

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: () => { start.current = current.current; },
    onPanResponderMove: (_, g) => {
      h.setValue(Math.max(snaps[0], Math.min(snaps[2], start.current - g.dy)));
    },
    onPanResponderRelease: (_, g) => {
      const projected = current.current - g.vy * 120;
      const target = snaps.reduce((a, b) => (Math.abs(b - projected) < Math.abs(a - projected) ? b : a));
      snapTo(target);
    },
    onPanResponderTerminationRequest: () => false,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [snaps]);

  return (
    <Animated.View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: h, backgroundColor: colors.background,
      borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: "hidden", ...shadow(3) }}>
      <View {...pan.panHandlers}>
        <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.separator }} />
        </View>
        {header}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Animated.View>
  );
}
