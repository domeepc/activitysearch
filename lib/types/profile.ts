import { Id } from "@/convex/_generated/dataModel";

export type OAuthProvider = "google" | "microsoft" | "facebook";

export type EmailVerificationStatus = boolean | null;

export interface ProfileFormData {
  avatar: string;
  name: string;
  lastname: string;
  username: string;
  email: string;
  description: string;
  contact: string;
  friends: Id<"users">[];
}

export interface ProfileErrors {
  name: string;
  lastname: string;
  email: string;
}

export interface ProfileViewProps {
  user: {
    _id: Id<"users">;
    name: string;
    lastname: string;
    username: string;
    slug: string;
    email: string;
    description: string;
    contact: string;
    avatar: string;
    totalExp: bigint;
    loyaltyPoints?: bigint;
    friends: Id<"users">[];
  } | null | undefined;
  currentUser: {
    _id: Id<"users">;
    friends: Id<"users">[];
  } | null | undefined;
}

