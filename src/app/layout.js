import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "StreamHub",
  description: "A YouTube-style streaming platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}