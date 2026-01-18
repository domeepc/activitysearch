import { AddressCoordinates } from "@/components/ui/address-autocomplete";

export interface ActivityFormData {
  activityName: string;
  description: string;
  address: string;
  coordinates: AddressCoordinates | null;
  price: string;
  duration: string;
  difficulty: string;
  maxParticipants: string;
  minAge: string;
  tags: string;
  equipment: string;
  images: string[];
  availableTimeSlots: string[];
}

export interface FormErrors {
  activityName?: string;
  description?: string;
  address?: string;
  coordinates?: string;
  price?: string;
  duration?: string;
  difficulty?: string;
  maxParticipants?: string;
  minAge?: string;
  tags?: string;
}

export const initialFormData: ActivityFormData = {
  activityName: "",
  description: "",
  address: "",
  coordinates: null,
  price: "",
  duration: "",
  difficulty: "",
  maxParticipants: "",
  minAge: "",
  tags: "",
  equipment: "",
  images: [],
  availableTimeSlots: [],
};

