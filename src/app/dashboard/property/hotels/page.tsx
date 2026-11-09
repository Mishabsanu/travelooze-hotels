import { HotelListPage } from "@/components/property/PropertyPages";

export const metadata = { title: "Hotels" };

export default function Page({ searchParams }: PageProps<"/dashboard/property/hotels">) {
  return <HotelListPage searchParams={searchParams} />;
}
