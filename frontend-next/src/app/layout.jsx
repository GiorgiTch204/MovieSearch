import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "MovieSearch Pro",
  description: "AI-Powered Hybrid Movie Search Engine",
  icons: {
    icon: "/imgs/msIcon.png",
    shortcut: "/imgs/msIcon.png",
    apple: "/imgs/msIcon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme')||'dark';document.documentElement.classList.toggle('dark',t!=='light')}catch(e){}`,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-surface-0 text-ink"
      >
        {children}
      </body>
    </html>
  );
}
