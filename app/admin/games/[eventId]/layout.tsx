import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import GamesEventNav from "./GamesEventNav";

/** Every admin page of one event gets the same back button and menu on top. */
export default async function GamesEventLayout({ children, params }: LayoutProps<"/admin/games/[eventId]">) {
  const { eventId } = await params;
  const event = (await isAdmin())
    ? await prisma.gamesEvent.findUnique({ where: { id: eventId }, select: { name: true } })
    : null;
  return (
    <>
      {event && (
        <div className="max-w-2xl mx-auto w-full px-4 pt-4 sm:px-6 print:hidden">
          <GamesEventNav eventId={eventId} name={event.name} />
        </div>
      )}
      {children}
    </>
  );
}
