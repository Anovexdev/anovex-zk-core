import { useState, useEffect } from 'react';

const PROCESSING_TERMS = [
  "INITIALIZING ZK PROOF",
  "ENCRYPTING SWAP DATA",
  "STEALTH ROUTING ACTIVE",
  "OBFUSCATING SIGNATURE",
  "RELAY NETWORK SYNC",
  "ANONYMOUS EXECUTION",
];

export function ProcessingBadge() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    const termInterval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % PROCESSING_TERMS.length);
    }, 1000);

    return () => clearInterval(termInterval);
  }, []);

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots((prev) => {
        if (prev === "...") return "";
        return prev + ".";
      });
    }, 333);

    return () => clearInterval(dotsInterval);
  }, []);

  return (
    <div className="inline-flex items-center gap-2.5 px-4 py-2 lg:pl-0 lg:pr-4 rounded-full bg-gradient-to-r from-purple-1/10 to-purple-2/10 border border-purple-1/30 backdrop-blur-sm">
      <div className="relative flex items-center justify-center w-2 h-2">
        <div className="absolute w-2 h-2 bg-purple-1 rounded-full animate-ping" />
        <div className="relative w-1.5 h-1.5 bg-purple-1 rounded-full" />
      </div>
      <span className="text-xs font-mono font-medium bg-gradient-to-r from-purple-1 to-purple-2 bg-clip-text text-transparent whitespace-nowrap">
        {PROCESSING_TERMS[currentIndex]}
        <span className="inline-block w-6 text-left">{dots}</span>
      </span>
    </div>
  );
}
