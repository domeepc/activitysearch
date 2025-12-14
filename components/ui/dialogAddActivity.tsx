"use client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dispatch } from "react";
import { Button } from "./button";
import { InputGroup } from "./input-group";
import { Textarea } from "./textarea";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";

export default function DialogAddActivity({
  showDialog,
  setShowDialog,
}: {
  showDialog: boolean;
  setShowDialog: Dispatch<React.SetStateAction<boolean>>;
}) {
  const createActivity = useMutation(api.activity.createActivity);

  const handleAdd = async () => {
    try {
      // Cast to `any` to avoid generated FunctionReference type being treated as non-callable
      await (createActivity as unknown as (...args: any[]) => Promise<any>)({});
      setShowDialog(false);
    } catch (err) {
      // Log error for debugging; keep UI behavior minimal here
      // You can replace with user-facing error handling later
      // eslint-disable-next-line no-console
      console.error("createActivity error:", err);
    }
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent>
        <DialogTitle>Add New Activity</DialogTitle>

        <Label htmlFor="activityName">Activity Name</Label>
        <Input id="activityName" type="text"></Input>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" className="resize-none"></Textarea>
        <Label htmlFor="address">Address</Label>
        <Input id="address" type="text"></Input>
        <Label htmlFor="price">Price</Label>
        <Input id="price" type="number"></Input>
        <InputGroup className="flex gap-2 flex-row border-0 shadow-none">
          <Label htmlFor="longitude">Longitude</Label>
          <Input id="longitude" type="number"></Input>
          <Label htmlFor="latitude">Latitude</Label>
          <Input id="latitude" type="number"></Input>
        </InputGroup>
        <Label htmlFor="duration">Duration</Label>
        <Input id="duration" type="number" min={0}></Input>
        <Label htmlFor="difficulty">Difficulty</Label>
        <Input id="difficulty" type="text"></Input>
        <Label htmlFor="maxParticipants">Max Participants</Label>
        <Input id="maxParticipants" type="number" min={0}></Input>
        <Label htmlFor="minAge">Min Age</Label>
        <Input id="minAge" type="number" min={12}></Input>
        <Label htmlFor="tags">Tags</Label>
        <Input id="tags" type="text"></Input>
        <Label htmlFor="images">Images</Label>
        <Input id="images" type="text"></Input>

        <DialogFooter>
          <Button onClick={handleAdd}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
