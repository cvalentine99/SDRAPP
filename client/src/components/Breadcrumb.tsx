import { useLocation } from "wouter";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Activity,
  Database,
  Home,
  Radio,
  Search,
  Settings,
  Waves,
} from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const PAGE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  "/": { label: "Spectrum", icon: Waves },
  "/scanner": { label: "Scanner", icon: Search },
  "/device": { label: "Device", icon: Radio },
  "/recording": { label: "Recording", icon: Database },
  "/telemetry": { label: "Telemetry", icon: Activity },
  "/settings": { label: "Settings", icon: Settings },
};

interface SDRBreadcrumbProps {
  // Optional additional items to append (for deep navigation)
  additionalItems?: BreadcrumbItem[];
  // Optional current section context (e.g., frequency being analyzed)
  currentContext?: string;
}

export function SDRBreadcrumb({ additionalItems, currentContext }: SDRBreadcrumbProps) {
  const [location] = useLocation();

  const pageConfig = PAGE_CONFIG[location] || { label: "Unknown", icon: Home };
  const PageIcon = pageConfig.icon;

  const items: BreadcrumbItem[] = [
    { label: "SDR", href: "/", icon: Radio },
    { label: pageConfig.label, icon: PageIcon },
    ...(additionalItems || []),
  ];

  // If we have context (like current frequency), add it
  if (currentContext) {
    items.push({ label: currentContext });
  }

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const Icon = item.icon;

          return (
            <div key={index} className="flex items-center">
              {index > 0 && (
                <BreadcrumbSeparator className="mx-2 text-muted-foreground">
                  /
                </BreadcrumbSeparator>
              )}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="flex items-center gap-1.5 text-foreground">
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href={item.href}
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

// Compact version for the header
export function SDRBreadcrumbCompact() {
  const [location] = useLocation();

  const pageConfig = PAGE_CONFIG[location] || { label: "Unknown", icon: Home };
  const PageIcon = pageConfig.icon;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Radio className="w-4 h-4 text-primary" />
      <span className="text-muted-foreground">/</span>
      <div className="flex items-center gap-1.5 text-foreground">
        <PageIcon className="w-4 h-4 text-secondary" />
        <span>{pageConfig.label}</span>
      </div>
    </div>
  );
}
