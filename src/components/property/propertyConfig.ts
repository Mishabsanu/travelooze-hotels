export const HOTEL_UI = {
  label: "Hotel",
  plural: "Hotels",
  basePath: "/dashboard/property/hotels",
  apiBase: "/api/hotels",
  description: "Properties in the group, their category and GST details",
} as const;

export const ROOM_TYPE_UI = {
  label: "Room Type",
  plural: "Room Types & Rates",
  basePath: "/dashboard/property/room-types",
  apiBase: "/api/room-types",
  description: "Room categories of each hotel and the nightly rate for every meal plan (before GST)",
} as const;

export const ROOM_UI = {
  label: "Room",
  plural: "Rooms",
  basePath: "/dashboard/property/rooms",
  apiBase: "/api/rooms",
  description: "Every sellable room, its type and housekeeping status",
} as const;
