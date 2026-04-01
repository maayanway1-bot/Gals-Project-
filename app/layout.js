import "./globals.css";

export const metadata = {
  title: "Acupuncture App",
  description: "Practice management for acupuncture practitioners",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="ltr">
      <body className="bg-slate-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
