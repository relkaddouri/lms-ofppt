import { getBilanPresences } from "@/app/actions/presences";
import PresencesTableau from "./PresencesTableau";

export const metadata = { title: "Présences" };

export default async function PresencesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bilan = await getBilanPresences(id);

  return <PresencesTableau bilan={bilan} />;
}
