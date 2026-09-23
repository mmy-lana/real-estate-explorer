import {
  AirVent,
  AlarmSmoke,
  Beef,
  Building,
  Castle,
  ChefHat,
  CircleParking,
  Droplets,
  Dumbbell,
  Fence,
  Flame,
  House,
  Laptop,
  MountainSnow,
  PawPrint,
  PlugZap,
  Rows3,
  Sailboat,
  Sofa,
  TentTree,
  Warehouse,
  WashingMachine,
  WavesLadder,
  Wifi,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { Amenity, PropertyType } from "../types";

/**
 * Exhaustive icon registries.
 *
 * `Record<Amenity, LucideIcon>` and `Record<PropertyType, LucideIcon>` make the
 * mappings complete by construction: adding a member to either union without an
 * icon is a compile-time error, so no runtime fallback branch is ever needed.
 */

export const AMENITY_ICONS: Record<Amenity, LucideIcon> = {
  wifi: Wifi,
  kitchen: ChefHat,
  washer: WashingMachine,
  dryer: Wind,
  air_conditioning: AirVent,
  heating: Flame,
  pool: WavesLadder,
  hot_tub: Droplets,
  free_parking: CircleParking,
  ev_charger: PlugZap,
  gym: Dumbbell,
  bbq_grill: Beef,
  patio: Fence,
  lake_access: Sailboat,
  ski_in_out: MountainSnow,
  workspace: Laptop,
  pets_allowed: PawPrint,
  smoke_alarm: AlarmSmoke,
};

export const PROPERTY_TYPE_ICONS: Record<PropertyType, LucideIcon> = {
  apartment: Building,
  house: House,
  villa: Castle,
  cabin: TentTree,
  loft: Warehouse,
  studio: Sofa,
  townhouse: Rows3,
};

/** Detail-sheet grouping for the amenity breakdown. */
export interface AmenityGroup {
  readonly id: string;
  readonly title: string;
  readonly members: readonly Amenity[];
}

export const AMENITY_GROUPS: readonly AmenityGroup[] = [
  {
    id: "essentials",
    title: "Essentials",
    members: ["wifi", "kitchen", "washer", "dryer", "workspace", "heating"],
  },
  {
    id: "comfort",
    title: "Comfort and climate",
    members: ["air_conditioning", "pool", "hot_tub", "gym"],
  },
  {
    id: "outdoor",
    title: "Outdoor and location",
    members: ["patio", "bbq_grill", "lake_access", "ski_in_out", "free_parking"],
  },
  {
    id: "practical",
    title: "Practical and safety",
    members: ["ev_charger", "pets_allowed", "smoke_alarm"],
  },
];

export function getAmenityIcon(amenity: Amenity): LucideIcon {
  return AMENITY_ICONS[amenity];
}

export function getPropertyTypeIcon(propertyType: PropertyType): LucideIcon {
  return PROPERTY_TYPE_ICONS[propertyType];
}
