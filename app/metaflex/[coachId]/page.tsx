/**
 * Public MetaFlex Quiz (v1 design embedded with coach attribution)
 */
export const dynamic = "force-dynamic";

export default function MetaFlexPage({ params }: { params: { coachId: string } }) {
  return (
    <main className="h-screen w-screen overflow-hidden bg-white">
      <iframe
        src={`/metaflex-v1.html?coach=${encodeURIComponent(params.coachId)}`}
        title="UP Wellness Ops · MetaFlex Quiz"
        className="h-full w-full border-0"
      />
    </main>
  );
}
