import { WardrobeProvider } from "@/components/WardrobeProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <WardrobeProvider>{children}</WardrobeProvider>;
}
