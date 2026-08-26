import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { APP_NAME } from "@/lib/branding";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Conflict-free school timetable generation for every school.",
  icons: {
    icon: [
      { url: "/logogridwithouttext.png", type: "image/png" },
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/logogridwithouttext.png",
    apple: "/logogridwithouttext.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<Toaster richColors position="top-right" /></body></html>;
}
