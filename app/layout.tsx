import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { APP_NAME, DEFAULT_LOGO_URL } from "@/lib/branding";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Conflict-free school timetable generation for every school.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: DEFAULT_LOGO_URL, type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<Toaster richColors position="top-right" /></body></html>;
}
