import { HotelDetailPage } from "@/components/property/PropertyPages";

export const metadata = { title: "Hotel" };

export default function Page({ params }: PageProps<"/dashboard/property/hotels/[id]">) {
  return <HotelDetailPage params={params} />;
}
