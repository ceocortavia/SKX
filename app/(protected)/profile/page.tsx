import OrgCard from "@/components/profile/OrgCard";
import ProfileClient from "@/components/profile/ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  return (
    <>
      <ProfileClient />
      <div className="mt-6" />
      <OrgCard />
    </>
  );
}


