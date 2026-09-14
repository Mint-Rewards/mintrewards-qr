import { createAmbassadorCampaign } from "@/app/actions/ambassador-campaigns";
import { PageHeader } from "@/components/common/page-header";
import { AmbassadorCampaignForm } from "@/components/common/ambassador-campaign-form";

export const metadata = { title: "New Ambassador Campaign · MintRewards QR" };

export default function NewAmbassadorCampaignPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New Ambassador Campaign"
        description="One campaign equals one QR code that opens the public sign-up form."
      />
      <AmbassadorCampaignForm action={createAmbassadorCampaign} submitLabel="Create Campaign" />
    </div>
  );
}
