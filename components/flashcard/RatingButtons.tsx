import { Button } from "@/components/ui/button";

interface Props {
  onRate: (rating: 1 | 2 | 3 | 4) => void;
  disabled?: boolean;
}

const RATINGS = [
  { label: "Again", value: 1 as const, className: "border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950" },
  { label: "Hard", value: 2 as const, className: "border-orange-500 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950" },
  { label: "Good", value: 3 as const, className: "border-green-500 text-green-500 hover:bg-green-50 dark:hover:bg-green-950" },
  { label: "Easy", value: 4 as const, className: "border-blue-500 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950" },
];

export function RatingButtons({ onRate, disabled }: Props) {
  return (
    <div className="flex gap-3 justify-center">
      {RATINGS.map((r) => (
        <Button
          key={r.value}
          variant="outline"
          className={r.className}
          onClick={() => onRate(r.value)}
          disabled={disabled}
        >
          {r.label}
        </Button>
      ))}
    </div>
  );
}
