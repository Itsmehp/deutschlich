import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  cardsReviewed: number;
  correctCount: number;
  onStudyMore: () => void;
}

export function SessionSummary({ cardsReviewed, correctCount, onStudyMore }: Props) {
  const accuracy = cardsReviewed > 0 ? Math.round((correctCount / cardsReviewed) * 100) : 0;
  return (
    <div className="max-w-md mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Session Complete 🎉</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-3xl font-bold">{cardsReviewed}</p>
              <p className="text-sm text-muted-foreground">Cards</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{correctCount}</p>
              <p className="text-sm text-muted-foreground">Correct</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{accuracy}%</p>
              <p className="text-sm text-muted-foreground">Accuracy</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={onStudyMore} className="flex-1">Study More</Button>
            <Button variant="outline" className="flex-1" onClick={() => { window.location.href = "/dashboard"; }}>
              Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
