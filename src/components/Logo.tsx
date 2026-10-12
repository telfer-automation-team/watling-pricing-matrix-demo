import Image from "next/image";

export default function Logo({ className = "", width = 96 }: { className?: string; width?: number }) {
  return (
    <Image
      src="/jcb-logo.png"
      alt="JCB"
      width={width}
      height={Math.round((width * 253) / 800)}
      priority
      className={className}
    />
  );
}
