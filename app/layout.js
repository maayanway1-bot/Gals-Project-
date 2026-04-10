import "../tokens.css";
import "./globals.css";

export const metadata = {
  title: "Private Clinic App",
  description: "A private patient management tool for acupuncture and Chinese medicine practitioners.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Private Clinic App",
  },
  verification: {
    google: "iZBMCbfiJvMLA3kPFbWy_bTPAp4Py0PyaK7a4fx70L4",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        {children}
      </body>
    </html>
  );
}
