import { useEffect, useState } from "react";
import { Row, Screen, Section, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { supabase } from "@/lib/supabase";

async function fetchBlocked() {
  const { data } = await supabase.from("blocks").select("blocked_id");
  const ids = (data ?? []).map((b) => b.blocked_id);
  const { data: profs } = ids.length ? await supabase.from("profiles").select("id, username").in("id", ids) : { data: [] as any[] };
  return (profs ?? []) as { id: string; username: string }[];
}

export default function Blocked() {
  const { t } = useI18n();
  const [list, setList] = useState<{ id: string; username: string }[] | null>(null);
  const load = () => fetchBlocked().then(setList);
  useEffect(() => { fetchBlocked().then(setList); }, []);
  return (
    <Screen>
      {list && list.length === 0 ? <Txt variant="subhead" color="secondary" style={{ marginTop: 24, textAlign: "center" }}>{t("settings.noBlocked")}</Txt> : null}
      {list && list.length ? (
        <Section>
          {list.map((p, i) => (
            <Row key={p.id} title={`@${p.username}`} last={i === list.length - 1}
              right={<Txt variant="subheadMedium" color="brand" onPress={async () => { await supabase.from("blocks").delete().eq("blocked_id", p.id); load(); }}>{t("settings.unblock")}</Txt>} />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
