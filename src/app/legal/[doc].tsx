import { Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Screen, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { legal, type LegalDoc } from "@/lib/legal";

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: LegalDoc }>();
  const { locale } = useI18n();
  const d = legal[locale][doc as LegalDoc] ?? legal[locale].terms;
  return (
    <Screen>
      <Stack.Screen options={{ title: d.title }} />
      <Txt variant="footnote" color="secondary" style={{ marginTop: 12 }}>{d.updated}</Txt>
      {d.sections.map((s) => (
        <View key={s.h} style={{ marginTop: 20 }}>
          <Txt variant="headline">{s.h}</Txt>
          <Txt variant="body" style={{ marginTop: 6 }} selectable>{s.p}</Txt>
        </View>
      ))}
    </Screen>
  );
}
