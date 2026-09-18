import Image from "next/image";

const SIZES = {
  sm: { icon: 18, text: "text-sm" },
  md: { icon: 24, text: "text-base sm:text-lg" },
} as const;

/**
 * The logo + wordmark lockup, reused wherever the app should look like a
 * product with a name instead of borrowed Vercel chrome — the board watermark
 * and the results screen's celebratory moment.
 */
export function Brand({ size = "sm" }: { size?: keyof typeof SIZES }) {
  const { icon, text } = SIZES[size];
  return (
    <span className={`inline-flex items-center gap-1.5 font-extrabold tracking-tight ${text}`}>
      <Image src="/logo.png" alt="" width={icon} height={icon} className="rounded-[20%]" />
      <span className="text-accent">jeoparty</span>
      <span className="text-foreground/70">.no</span>
    </span>
  );
}
