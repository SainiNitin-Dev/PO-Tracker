import type { TrackingType } from "./progression";

export const OFFLINE_OWNER_KEY = "progressive:offline-owner";
export const offlineWorkoutKey = (userId: string) =>
  `progressive:offline-workout:${userId}`;

export type OfflinePlan = {
  userId: string;
  gymId: string;
  gymName: string;
  dayId: string;
  dayName: string;
  exercises: {
    name: string;
    equipmentId: string;
    trackingType: TrackingType;
    targetSets: number;
    repMin: number | null;
    repMax: number | null;
    timeTargetSeconds: number | null;
  }[];
};
