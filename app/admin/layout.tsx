import { isAdmin } from "@/lib/adminAuth";
import AdminNav from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();
  if (!admin) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AdminNav />
      {children}
    </div>
  );
}
