import type { Viewport } from "next";
import { StrictMode } from "react";
import Script from "next/script";
import { Geist } from "next/font/google";
import "@/components/DeerFlow/styles/globals.css";

import I18nServer from "@/components/i18n/i18n-server";
import { ChakraUIProviders } from "@/components/Provider/ChakraUIProvider";
import QueryClientProviderWrapper from "@/components/Provider/QueryClientProvider";
import { ThemeProviderWrapper } from "@/components/DeerFlow/components/deer-flow/theme-provider-wrapper";
import { Toaster } from "@/components/DeerFlow/components/deer-flow/toaster";
import { env } from "@/components/DeerFlow/env";

import ClientProvider from "../components/Provider/ClientProviders";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  userScalable: false,
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const LocaleLayout = ({ children }: { children: React.ReactNode }) => {
  // Get API URL from environment variable at server time
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  
  return (
    <html lang="en" className={`h-full ${geist.variable}`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#FFFFFF" />
        <link href="/favicon.ico" rel="icon" type="image/x-icon" />
        <Script id="markdown-it-fix" strategy="beforeInteractive">
          {`
            if (typeof window !== 'undefined' && typeof window.isSpace === 'undefined') {
              window.isSpace = function(code) {
                return code === 0x20 || code === 0x09 || code === 0x0A || code === 0x0B || code === 0x0C || code === 0x0D;
              };
            }
          `}
        </Script>
      </head>
      <body className="bg-app">
        <StrictMode>
          <ChakraUIProviders>
            <QueryClientProviderWrapper>
              <ClientProvider>
                <ThemeProviderWrapper>
                  <I18nServer>{children}</I18nServer>
                </ThemeProviderWrapper>
              </ClientProvider>
            </QueryClientProviderWrapper>
          </ChakraUIProviders>
        </StrictMode>
        <Toaster />
        
        {/* Load runtime config script using Next.js Script component */}
        <Script 
          src="/runtime-config.js" 
          strategy="beforeInteractive" 
          id="runtime-config"
        />
        
        {/* Inject API URL into window object with fallback */}
        <Script
          id="api-fallback"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (!window.__RUNTIME_CONFIG__) {
                window.__RUNTIME_CONFIG__ = { API_URL: "${apiBaseUrl}" };
              }
              window.__API_BASE_URL__ = window.__RUNTIME_CONFIG__.API_URL;
            `
          }}
        />
        
        {env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY && env.AMPLITUDE_API_KEY && (
          <>
            <Script src="https://cdn.amplitude.com/script/d2197dd1df3f2959f26295bb0e7e849f.js"></Script>
            <Script id="amplitude-init" strategy="lazyOnload">
              {`window.amplitude.init('${env.AMPLITUDE_API_KEY}', {"fetchRemoteConfig":true,"autocapture":true});`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
};

export default LocaleLayout; 