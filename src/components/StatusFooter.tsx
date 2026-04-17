export const StatusFooter = () => (
  <footer className="fixed bottom-0 left-0 right-0 h-8 flex items-center justify-between px-12 z-50 bg-primary font-mono text-[10px] tracking-widest uppercase">
    <div className="text-primary-foreground/60">SYSTEM_STABLE // API_ACTIVE</div>
    <div className="flex space-x-8">
      <span className="text-low animate-pulse-soft">LATENCY_14MS</span>
      <span className="text-primary-foreground/60 hover:text-primary-foreground transition-opacity">
        NODE_PRIMARY
      </span>
    </div>
  </footer>
);
