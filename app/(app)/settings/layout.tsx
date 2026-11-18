import { PageContainer } from "@/components/common/page-container";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer className="max-w-[1100px]">
      <div className="flex flex-col gap-6 md:flex-row md:gap-10">
        <div className="md:w-48 md:shrink-0">
          <SettingsNav />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </PageContainer>
  );
}
