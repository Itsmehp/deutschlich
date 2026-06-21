import { Card, CardContent } from "@/components/ui/card";
import { Flame } from "lucide-react";

export function StreakCard({ current, longest }: { current: number; longest: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <Flame className="h-10 w-10 text-orange-500" />
        <div>
          <p className="text-4xl font-bold">{current}</p>
          <p className="text-sm text-muted-foreground">day streak · best: {longest}</p>
        </div>
      </CardContent>
    </Card>
  );
}
