import OrgCard from "@/components/profile/OrgCard";
import SecurityCard from "@/components/profile/SecurityCard";
import PreferencesCard from "@/components/profile/PreferencesCard";
import ProfileClient from "@/components/profile/ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  return (
    <>
      <ProfileClient />
      <div className="mt-6" />
      <OrgCard />
      <div className="mt-6" />
      <SecurityCard />
      <div className="mt-6" />
      <PreferencesCard />
    </>
  );
}


