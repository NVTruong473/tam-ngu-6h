import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"),
  title: "Tam Ngữ 6H",
  description: "Bài học Anh – Trung ngắn gọn theo nhịp ngày, lưu trực tiếp trên iPhone.",
  applicationName: "Tam Ngữ 6H",
  manifest: "./manifest.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Tam Ngữ 6H" },
  icons: {
    icon: "./icons/icon-192.png",
    apple: "./icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "Tam Ngữ 6H",
    description: "Mỗi 6 giờ, một câu mới · một lời dành riêng cho cậu",
    type: "website",
    locale: "vi_VN",
    images: [{ url: "./og.png", width: 1200, height: 630, alt: "Tam Ngữ 6H" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff8f5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
