import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { env, qrBaseUrl } from "@/lib/env";
import { ambassadorShareCaption } from "@/lib/ambassador/share";
import { AmbassadorCardSuccess } from "@/components/ambassador/card-success";
import type { AmbassadorStatus } from "@/lib/ambassador/config";

export const dynamic = "force-dynamic";

/**
 * PUBLIC, durable card page -- one per ambassador. Two jobs:
 *
 *  1. Lets a student revisit/download their card later (the inline success view
 *     after submission is not bookmarkable).
 *  2. Is the URL actually handed to LinkedIn's share intent. LinkedIn's crawler reads
 *     THIS page's Open Graph tags for the post preview -- see share.ts for why that's
 *     the only "caption prefill" LinkedIn allows a third-party site.
 */
async function loadAmbassador(id: string) {
  const admin = createAdminClient();
  const { data: ambassador } = await admin
    .from("mint_ambassadors")
    .select("id, full_name, ambassador_status, card_file_path, campaign_id")
    .eq("id", id)
    .maybeSingle();

  if (!ambassador || !ambassador.card_file_path) return null;

  const { data: campaign } = await admin
    .from("ambassador_campaigns")
    .select("share_caption")
    .eq("id", ambassador.campaign_id)
    .maybeSingle();

  const { data: pub } = admin.storage
    .from(env.AMBASSADOR_CARDS_BUCKET)
    .getPublicUrl(ambassador.card_file_path);

  return {
    ambassador,
    cardUrl: pub.publicUrl,
    caption: ambassadorShareCaption(campaign?.share_caption ?? null, ambassador.full_name),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const loaded = await loadAmbassador(id);
  if (!loaded) return { title: "Mint Ambassador · MintRewards" };

  const title = `${loaded.ambassador.full_name} is a Mint Ambassador`;
  return {
    title,
    description: loaded.caption,
    openGraph: {
      title,
      description: loaded.caption,
      images: [loaded.cardUrl],
    },
  };
}

export default async function AmbassadorCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loaded = await loadAmbassador(id);
  if (!loaded) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <AmbassadorCardSuccess
          fullName={loaded.ambassador.full_name}
          status={loaded.ambassador.ambassador_status as AmbassadorStatus}
          cardUrl={loaded.cardUrl}
          cardPageUrl={`${qrBaseUrl()}/a/card/${loaded.ambassador.id}`}
          shareCaption={loaded.caption}
        />
      </div>
    </div>
  );
}
