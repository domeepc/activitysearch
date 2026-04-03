import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Package, Users } from "lucide-react";

interface ActivityDetailExtrasProps {
  maxParticipants: bigint;
  minAge: bigint;
  equipment: string[];
}

export function ActivityDetailExtras({
  maxParticipants,
  minAge,
  equipment,
}: ActivityDetailExtrasProps) {
  const hasParticipants = Boolean(maxParticipants);
  const hasMinAge = Boolean(minAge);
  const hasEquipment = equipment.length > 0;

  if (!hasParticipants && !hasMinAge && !hasEquipment) {
    return null;
  }

  return (
    <>
      <Separator />
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Additional Information</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {hasParticipants ? (
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Max Participants</p>
                <p className="text-sm text-muted-foreground">
                  {maxParticipants} people
                </p>
              </div>
            </div>
          ) : null}

          {hasMinAge ? (
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Minimum Age</p>
                <p className="text-sm text-muted-foreground">
                  {minAge} years
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {hasEquipment ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">Required Equipment</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {equipment.map((item, index) => (
                <Badge key={index} variant="outline">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
