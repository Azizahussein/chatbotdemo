import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { auth } from "@/auth";
import { SessionProvider } from "next-auth/react";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-poppins",
});

export default async function ChatbotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userSession = await auth();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider>
        <div className={cn("min-h-screen bg-background", poppins.variable, "antialiased", "flex")}>
          {children}
        </div>
      </SessionProvider>
      <Toaster />
    </ThemeProvider>
  );
}
