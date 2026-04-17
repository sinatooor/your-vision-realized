import { TopAppBar } from "@/components/TopAppBar";
import { SideNav } from "@/components/SideNav";
import { StatusFooter } from "@/components/StatusFooter";
import { SummaryBar } from "@/components/SummaryBar";
import { ConflictCard } from "@/components/ConflictCard";
import { conflicts } from "@/data/conflicts";

const Index = () => {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col overflow-x-hidden">
      <TopAppBar />
      <div className="flex flex-1 pt-[89px]">
        <SideNav />
        <main className="md:ml-80 flex-1 bg-surface min-h-screen px-6 md:px-16 py-12 md:py-16 pb-32">
          <SummaryBar />
          <section className="flex flex-col space-y-12 max-w-5xl">
            {conflicts.map((c) => (
              <ConflictCard key={c.id} conflict={c} />
            ))}
          </section>
        </main>
      </div>
      <StatusFooter />
    </div>
  );
};

export default Index;
