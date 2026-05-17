/**
 * Public Health Check (v1 design embedded via iframe with coach attribution).
 * The v1 HTML reads ?coach=... from URL and POSTs to /api/check/submit.
 */
export const dynamic = "force-dynamic";

export default function PublicCheckPage({ params }: { params: { coachId: string } }) {
  return (
    <main className="h-screen w-screen overflow-hidden bg-white">
      <iframe
        src={`/healthcheck-v1.html?coach=${encodeURIComponent(params.coachId)}`}
        title="UP Wellness Ops · Health Check"
        className="h-full w-full border-0"
      />
    </main>
  );
}
