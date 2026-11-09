import { HotelEditPage } from "@/components/property/PropertyPages";

export const metadata = { title: "Edit Hotel" };

export default function Page({ params }: PageProps<"/dashboard/property/hotels/[id]/edit">) {
  return <HotelEditPage params={params} />;
}
