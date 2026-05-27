import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";
import { getCurrentUser } from "@/lib/current-user";

export const metadata: Metadata = {
  title: "Crystal Procurement",
  description: "Crystal Group Procurement Portal",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body className="min-h-screen flex" suppressHydrationWarning>
        <ClientLayout user={user}>{children}</ClientLayout>
      </body>
    </html>
  );
}
