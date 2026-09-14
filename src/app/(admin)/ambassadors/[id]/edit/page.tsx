import { notFound } from "next/navigation";
import { updateAmbassadorCampaign } from "@/app/actions/ambassador-campaigns";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common/page-header";
import { AmbassadorCampaignForm } from "@/components/common/ambassador-campaign-form";
import type { AmbassadorCampaign } from "@/lib/types";

export const metadata = { title: "Edit Ambassador Campaign · MintRewards QR" };
export const dynamic = "force-dynamic";

export default async function EditAmbassadorCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: campaign } = await supabase
    .from("ambassador_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) notFound();

  return (
    <div className="max-w-2xl">
      <PageHeader title="Edit Ambassador Campaign" description={(campaign as AmbassadorCampaign).title} />
      <AmbassadorCampaignForm
        action={updateAmbassadorCampaign.bind(null, id)}
        campaign={campaign as AmbassadorCampaign}
        submitLabel="Save Changes"
      />
    </div>
  );
}
